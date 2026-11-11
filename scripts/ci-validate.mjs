#!/usr/bin/env node
/**
 * CI validation script for DialectOS.
 *
 * Detects changed locale/translation files and runs `dialectos validate` on each.
 * Outputs results and generates a PR comment body.
 *
 * Usage:
 *   node scripts/ci-validate.mjs --dialect=es-MX [--source-dir=.] [--target-patterns=...]
 *     [--locale-base=en.json] [--strict] [--allow-empty]
 *
 * Fail-closed rules:
 *   - The CLI binary must exist; a missing or wrong --cli-path is an error, never a pass.
 *   - Explicit --target-patterns that match zero files is an error (misconfiguration),
 *     unless --allow-empty is set. Auto-detect mode with nothing changed passes.
 *   - Any non-zero exit from the CLI counts as a failure.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePackageBuilt } from "./lib/ensure-built.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".worktrees"]);

/** Convert a glob (supports **, *, ?) to an anchored RegExp over "/"-separated paths. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[\\^$.+()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`, "u");
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/**
 * Match files under rootDir against glob patterns. A pattern without "/" matches the
 * basename at any depth (gitignore-style); otherwise it matches the path relative to rootDir.
 */
export function findFiles(rootDir, patterns) {
  const matchers = patterns.map((p) => {
    const trimmed = p.trim().replace(/^\.\//, "");
    return { basenameOnly: !trimmed.includes("/"), re: globToRegExp(trimmed) };
  });
  const files = walk(rootDir).filter((file) => {
    const rel = relative(rootDir, file).split(sep).join("/");
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    return matchers.some((m) => m.re.test(m.basenameOnly ? base : rel));
  });
  return [...new Set(files)].sort();
}

function parseArgs(argv) {
  const args = new Map();
  for (const arg of argv) {
    if (arg === "--") continue;
    const stripped = arg.replace(/^--/, "");
    const eq = stripped.indexOf("=");
    const key = eq === -1 ? stripped : stripped.slice(0, eq);
    const value = eq === -1 ? "" : stripped.slice(eq + 1);
    args.set(key, value || "true");
  }
  return args;
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function issueMessages(output) {
  try {
    const parsed = JSON.parse(output);
    // Locale mode returns [{ key, report }]; file mode returns a single report.
    const reports = Array.isArray(parsed) ? parsed : [{ key: "", report: parsed }];
    const messages = [];
    for (const { key, report } of reports) {
      for (const issue of report?.blockingIssues ?? []) {
        const msg = typeof issue === "string" ? issue : issue.message;
        messages.push(key ? `${key}: ${msg}` : msg);
      }
    }
    return messages;
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const dialect = args.get("dialect");
  if (!dialect) {
    console.error("Error: --dialect is required (e.g., --dialect=es-MX)");
    process.exit(1);
  }

  const sourceDir = args.get("source-dir") || ".";
  const targetPatterns = (args.get("target-patterns") || "").split(",").map((p) => p.trim()).filter(Boolean);
  const glossaryFile = args.get("glossary-file") || "";
  const localeBase = args.get("locale-base") || "";
  const failOnBlocking = args.get("fail-on-blocking") !== "false";
  const strict = args.get("strict") === "true";
  const allowEmpty = args.get("allow-empty") === "true";
  const explicitCliPath = args.get("cli-path");
  const cliPath = explicitCliPath || join(REPO_ROOT, "packages/cli/dist/cli.js");

  if (!explicitCliPath) ensurePackageBuilt("cli");
  if (!existsSync(cliPath)) {
    console.error(`Error: DialectOS CLI not found at ${cliPath}. Build the repo first (pnpm -r build).`);
    process.exit(2);
  }

  function detectTargetFiles() {
    if (targetPatterns.length > 0) return findFiles(sourceDir, targetPatterns);

    // Auto-detect: try git diff first, fall back to common patterns.
    try {
      const diffOutput = execFileSync(
        "git",
        ["diff", "--name-only", "--diff-filter=ACM", "origin/main", "HEAD"],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
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
              f.endsWith(`.${dialect}.json`) ||
              f.endsWith(`-${dialect}.json`) ||
              f.endsWith(`-${dialect}.md`))
        );
      if (changed.length > 0) return changed;
    } catch {
      // Not in CI or no git — fall through
    }

    return findFiles(sourceDir, [`*.${dialect}.json`, "*.es.json", `*-${dialect}.json`, `*-${dialect}.md`]);
  }

  function validateFile(filePath) {
    const validateArgs = [cliPath, "validate", `--dialect=${dialect}`, "--format=json"];
    if (strict) validateArgs.push("--strict");
    if (glossaryFile) validateArgs.push(`--glossary-file=${glossaryFile}`);

    if (filePath.endsWith(".json")) {
      validateArgs.push(`--locale=${filePath}`);
      if (localeBase) validateArgs.push(`--locale-base=${localeBase}`);
    } else {
      // Markdown/text: pair with the source file when one exists next to it.
      const baseName = filePath.replace(new RegExp(`[-.]${escapeRegExp(dialect)}(?=\\.[^.]+$)`), "");
      if (baseName !== filePath && existsSync(baseName)) {
        validateArgs.push(`--source-file=${baseName}`);
      }
      validateArgs.push(`--translated-file=${filePath}`);
    }

    try {
      const output = execFileSync(process.execPath, validateArgs, {
        encoding: "utf-8",
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      // A pass needs a report. Exit 0 with no parseable JSON means the wrong
      // entry point ran (e.g. the library dist/index.js), so fail closed.
      if (issueMessages(output.trim()) === null) {
        return {
          file: filePath,
          passed: false,
          output: "",
          error: `CLI at ${cliPath} exited 0 without a JSON validation report`,
        };
      }
      return { file: filePath, passed: true, output: output.trim() };
    } catch (error) {
      return {
        file: filePath,
        passed: false,
        output: error.stdout?.trim() || "",
        error: error.stderr?.trim() || error.message,
      };
    }
  }

  const targetFiles = detectTargetFiles();

  if (targetFiles.length === 0) {
    if (targetPatterns.length > 0 && !allowEmpty) {
      console.error(
        `Error: target-patterns (${targetPatterns.join(", ")}) matched no files under ${sourceDir}. ` +
          "Fix the patterns, or set allow-empty to pass when nothing matches."
      );
      process.exit(1);
    }
    console.log(`No translation files found for dialect ${dialect}.`);
    process.exit(0);
  }

  console.log(`Validating ${targetFiles.length} file(s) for dialect ${dialect}...`);

  const results = targetFiles.map(validateFile);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${results.length}`);

  const commentLines = [
    "## DialectOS Translation Validation",
    "",
    `**Dialect**: ${dialect} | **Files**: ${results.length} | **Passed**: ${passed} | **Failed**: ${failed}`,
    "",
  ];

  for (const result of results) {
    console.log(`  [${result.passed ? "PASS" : "FAIL"}] ${result.file}`);
    commentLines.push(`${result.passed ? "✅" : "❌"} \`${result.file}\``);
    if (result.passed) continue;
    const messages = issueMessages(result.output);
    const lines = messages && messages.length > 0 ? messages : [result.error || "Validation failed"];
    for (const msg of lines) console.log(`         - ${msg}`);
    for (const msg of lines.slice(0, 5)) commentLines.push(`  > ${msg}`);
  }

  const commentPath = join(process.cwd(), "dialectos-validation-comment.md");
  writeFileSync(commentPath, commentLines.join("\n") + "\n");
  console.log(`\nPR comment body written to ${commentPath}`);

  if (failed > 0 && failOnBlocking) {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
