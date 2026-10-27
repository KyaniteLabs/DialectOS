import { promises as fs } from "node:fs";
import { validateFilePath } from "@dialectos/security";
import type { SpanishDialect, ValidationReport } from "@dialectos/types";
import { validateTranslation } from "../lib/validate-translation.js";
import { loadGlossary } from "../lib/glossary-enforcement.js";
import { loadProtectedTokens } from "../lib/token-protection.js";
import { writeOutput, writeError, writeInfo } from "../lib/output.js";
import { assertKnownDialect } from "../lib/assert-known-dialect.js";

export interface ValidateOptions {
  sourceFile?: string;
  translatedFile?: string;
  dialect: SpanishDialect;
  glossaryFile?: string;
  protectTokens?: string;
  format: "text" | "json";
  strict: boolean;
  locale?: string;
  localeBase?: string;
}

async function readFileContent(path: string): Promise<string> {
  const validatedPath = validateFilePath(path);
  return fs.readFile(validatedPath, "utf-8");
}

function formatTextReport(report: ValidationReport): string {
  const lines: string[] = [];
  const status = report.valid ? "PASS" : "FAIL";

  lines.push(`Validation: ${status} (dialect: ${report.dialect})`);
  lines.push(`Quality score: ${report.qualityScore.score}/100`);
  lines.push(`  Token integrity: ${(report.qualityScore.tokenIntegrity * 100).toFixed(0)}%`);
  lines.push(`  Glossary fidelity: ${(report.qualityScore.glossaryFidelity * 100).toFixed(0)}%`);
  lines.push(`  Structure integrity: ${report.qualityScore.structureIntegrity === 1 ? "pass" : "fail"}`);
  lines.push(`  Semantic similarity: ${(report.qualityScore.semanticSimilarity * 100).toFixed(0)}%`);
  lines.push(`  Lexical compliance: ${(report.qualityScore.lexicalCompliance * 100).toFixed(0)}%`);

  lines.push(`Semantic check: ${report.semanticCheck.passed ? "pass" : "fail"} (score: ${(report.semanticCheck.finalScore * 100).toFixed(0)}%)`);
  if (report.semanticCheck.negationDropped) {
    lines.push("  WARNING: Negation was dropped in translation");
  }

  if (report.structureValidation) {
    lines.push(`Structure validation: ${report.structureValidation.valid ? "pass" : "fail"}`);
    for (const v of report.structureValidation.violations) {
      lines.push(`  - ${v}`);
    }
  }

  if (report.lexicalCompliance.violations.length > 0) {
    lines.push("Lexical violations:");
    for (const v of report.lexicalCompliance.violations) {
      lines.push(`  - ${v}`);
    }
  }

  if (report.outputJudge.issues.length > 0) {
    lines.push(`Output judge: ${report.outputJudge.blockingIssues.length} blocking, ${report.outputJudge.issues.length} total`);
    for (const issue of report.outputJudge.issues) {
      lines.push(`  - [${issue.severity}] ${issue.message}`);
    }
  }

  return lines.join("\n");
}

export async function executeValidate(
  sourceText: string | undefined,
  translatedText: string | undefined,
  options: ValidateOptions
): Promise<void> {
  const dialect = assertKnownDialect(options.dialect);
  const { format, strict } = options;

  // Load glossary
  const glossary = await loadGlossary(options.glossaryFile);

  // Load protected tokens
  const protectedTokens = options.protectTokens
    ? await loadProtectedTokens(options.protectTokens)
    : [] as string[];

  // Locale file validation mode
  if (options.locale) {
    await executeLocaleValidation(options, glossary?.mappings || {}, protectedTokens);
    return;
  }

  // Read source content
  let source = sourceText ?? "";
  if (options.sourceFile) {
    source = await readFileContent(options.sourceFile);
  }

  // Read translated content
  let translated = translatedText ?? "";
  if (options.translatedFile) {
    translated = await readFileContent(options.translatedFile);
  }

  if (!translated) {
    throw new Error("No translated content provided. Use --translated-file or pass text as argument.");
  }

  // Detect markdown
  const isMarkdown = options.sourceFile?.endsWith(".md") || options.translatedFile?.endsWith(".md") || false;

  const report = validateTranslation({
    source,
    translated,
    dialect,
    protectedTokens,
    glossary: glossary?.mappings || {},
    isMarkdown,
  });

  if (format === "json") {
    writeOutput(JSON.stringify(report, null, 2));
  } else {
    writeOutput(formatTextReport(report));
  }

  // Determine exit behavior
  const shouldFail = strict
    ? report.outputJudge.issues.length > 0 || !report.valid
    : report.outputJudge.blockingIssues.length > 0 || !report.valid;

  if (shouldFail) {
    writeInfo(`\nValidation failed with ${report.blockingIssues.length} blocking issue(s).`);
    process.exit(1);
  }
}

async function executeLocaleValidation(
  options: ValidateOptions,
  glossaryMappings: Record<string, string>,
  protectedTokens: string[]
): Promise<void> {
  const { locale, localeBase, dialect, format, strict } = options;
  if (!locale) return;

  const localeContent = await readFileContent(locale);
  const localeData = JSON.parse(localeContent) as Record<string, string>;
  const baseContent = localeBase ? await readFileContent(localeBase) : "";
  const baseData = baseContent ? JSON.parse(baseContent) as Record<string, string> : {} as Record<string, string>;

  const reports: Array<{ key: string; report: ValidationReport }> = [];
  let anyBlocking = false;

  for (const [key, value] of Object.entries(localeData)) {
    const source = baseData[key] || key;
    const report = validateTranslation({
      source,
      translated: value,
      dialect,
      protectedTokens,
      glossary: glossaryMappings,
      isMarkdown: false,
    });
    reports.push({ key, report });
    if (!report.valid) anyBlocking = true;
  }

  if (format === "json") {
    writeOutput(JSON.stringify(reports, null, 2));
  } else {
    const total = reports.length;
    const passed = reports.filter((r) => r.report.valid).length;
    writeOutput(`Locale validation: ${passed}/${total} keys passed for ${dialect}`);

    for (const { key, report } of reports) {
      if (!report.valid) {
        writeOutput(`\n  [FAIL] ${key}:`);
        for (const issue of report.blockingIssues) {
          writeOutput(`    - ${issue}`);
        }
      }
    }
  }

  if (anyBlocking) {
    process.exit(1);
  }
}
