#!/usr/bin/env node
/**
 * CI validation script for DialectOS.
 *
 * Detects changed locale/translation files and runs dialectos validate on each.
 * Outputs results and generates a PR comment body.
 *
 * Usage:
 *   node scripts/ci-validate.mjs --dialect=es-MX [--source-dir=.] [--target-patterns=...] [--strict]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensurePackageBuilt } from "./lib/ensure-built.mjs";

ensurePackageBuilt("cli");

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const dialect = args.get("dialect");
if (!dialect) {
  console.error("Error: --dialect is required (e.g., --dialect=es-MX)");
  process.exit(1);
}

const sourceDir = args.get("source-dir") || ".";
const targetPatterns = (args.get("target-patterns") || "").split(",").filter(Boolean);
const glossaryFile = args.get("glossary-file") || "";
const failOnBlocking = args.get("fail-on-blocking") !== "false";
const format = args.get("format") || "text";
const strict = args.get("strict") === "true";

// Detect changed files (CI mode) or scan directory (local mode)
function detectTargetFiles() {
  if (targetPatterns.length > 0) {
    // Use specified patterns
    const files = [];
    for (const pattern of targetPatterns) {
      try {
        const output = execFileSync("find", [sourceDir, "-name", pattern.trim(), "-type", "f"], {
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        });
        files.push(...output.trim().split("\n").filter(Boolean));
      } catch {
        // Pattern matched nothing
      }
    }
    return [...new Set(files)];
  }

  // Auto-detect: try git diff first, fallback to common patterns
  try {
    const diffOutput = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACM", "origin/main", "HEAD"],
      { encoding: "utf-8" }
    );
    const changed = diffOutput
      .trim()
      .split("\n")
      .filter(
        (f) =>
          f &&
          (f.endsWith(".es.json") ||
            f.endsWith(".es-ES.json") ||
            f.endsWith("-es.md") ||
            f.endsWith(`-${dialect}.json`) ||
            f.endsWith(`-${dialect}.md`))
      );
    if (changed.length > 0) return changed;
  } catch {
    // Not in CI or no git — fall through
  }

  // Fallback: scan for common locale patterns
  const fallbackPatterns = [
    `*.${dialect}.json`,
    `*.es.json`,
    `*-${dialect}.json`,
    `*-${dialect}.md`,
  ];
  const files = [];
  for (const pattern of fallbackPatterns) {
    try {
      const output = execFileSync("find", [sourceDir, "-name", pattern, "-type", "f"], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      files.push(...output.trim().split("\n").filter(Boolean));
    } catch {
      // No matches
    }
  }
  return [...new Set(files)];
}

function validateFile(filePath) {
  const cliPath = join(process.cwd(), "packages/cli/dist/index.js");
  const validateArgs = [
    cliPath,
    "validate",
    `--dialect=${dialect}`,
    `--format=json`,
  ];
  if (strict) validateArgs.push("--strict");
  if (glossaryFile) validateArgs.push(`--glossary-file=${glossaryFile}`);

  // Determine if this is a locale JSON or markdown file
  if (filePath.endsWith(".json")) {
    // For locale JSON files, use --locale mode
    validateArgs.push(`--locale=${filePath}`);
  } else {
    // For markdown/text files, use positional arg + --source-file
    // Try to find a matching source file
    const baseName = filePath.replace(new RegExp(`[-.]${dialect}`, ""), "");
    if (existsSync(baseName)) {
      validateArgs.push(`--source-file=${baseName}`, `--translated-file=${filePath}`);
    } else {
      validateArgs.push(`--translated-file=${filePath}`);
    }
  }

  try {
    const output = execFileSync("node", validateArgs, {
      encoding: "utf-8",
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { file: filePath, passed: true, output: output.trim() };
  } catch (error) {
    const execError = error;
    return {
      file: filePath,
      passed: false,
      output: execError.stdout?.trim() || "",
      error: execError.stderr?.trim() || execError.message,
    };
  }
}

// Main
const targetFiles = detectTargetFiles();

if (targetFiles.length === 0) {
  console.log(`No translation files found for dialect ${dialect}.`);
  process.exit(0);
}

console.log(`Validating ${targetFiles.length} file(s) for dialect ${dialect}...`);

const results = targetFiles.map(validateFile);
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${results.length}`);

for (const result of results) {
  const icon = result.passed ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${result.file}`);
  if (!result.passed && result.output) {
    try {
      const report = JSON.parse(result.output);
      if (report.blockingIssues) {
        for (const issue of report.blockingIssues) {
          console.log(`         - ${typeof issue === "string" ? issue : issue.message}`);
        }
      }
    } catch {
      console.log(`         ${result.error || result.output}`);
    }
  }
}

// Generate PR comment body
const commentLines = [
  `## DialectOS Translation Validation`,
  ``,
  `**Dialect**: ${dialect} | **Files**: ${results.length} | **Passed**: ${passed} | **Failed**: ${failed}`,
  ``,
];

for (const result of results) {
  const icon = result.passed ? "✅" : "❌";
  commentLines.push(`${icon} \`${result.file}\``);
  if (!result.passed && result.output) {
    try {
      const report = JSON.parse(result.output);
      if (report.blockingIssues) {
        for (const issue of report.blockingIssues.slice(0, 5)) {
          const msg = typeof issue === "string" ? issue : issue.message;
          commentLines.push(`  > ${msg}`);
        }
      }
    } catch {
      commentLines.push(`  > ${result.error || "Validation failed"}`);
    }
  }
}

const commentPath = join(process.cwd(), "dialectos-validation-comment.md");
writeFileSync(commentPath, commentLines.join("\n") + "\n");
console.log(`\nPR comment body written to ${commentPath}`);

if (failed > 0 && failOnBlocking) {
  process.exit(1);
}
