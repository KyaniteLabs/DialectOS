#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const input = args.get("input") || args.get("cert") || "audits/release-candidate-2026-04-22/model-matrix.json";
const out = args.get("out") || "audits/dialect-report.md";
const customer = args.get("customer") || "Customer";
const product = args.get("product") || "Spanish localization";
const generatedAt = new Date().toISOString();
const issueCategoryByPattern = [
  [/Forbidden output term|taboo|chombo|cabrón|bicho|puñeta|coger/i, "taboo-safety"],
  [/placeholder|ICU|URL|code fence|markdown|structure/i, "markup-placeholder"],
  [/Missing required output trait|dialect|guagua|voseo|vosotros|palta|llajwa|llajua/i, "locale-convention"],
  [/formality|formal|informal|usted|tú|vos/i, "style-register"],
  [/glossary|terminology/i, "terminology"],
  [/grammar|invalid form|recoga/i, "grammar"],
  [/meaning|intent|download|pickup/i, "accuracy"],
];

const severityByPattern = [
  [/Forbidden output term|Missing required output trait|placeholder|ICU|URL|structure|Provider error|timed out/i, "critical"],
  [/Missing preferred dialect trait|quality warning|unstable/i, "major"],
];

const validationStatus = {
  "es-PA": { status: "native-reviewed", level: "silver" },
  "es-PR": { status: "native-reviewed", level: "silver" },
  "es-PH": { status: "experimental", level: "bronze" },
};

function classifyIssue(message) {
  const category = issueCategoryByPattern.find(([pattern]) => pattern.test(message))?.[1] || "accuracy";
  const severity = severityByPattern.find(([pattern]) => pattern.test(message))?.[1] || "minor";
  return { category, severity };
}

function dialectStatus(dialect) {
  return validationStatus[dialect] || { status: "automated-certified", level: "bronze" };
}


function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function normalizeResult(result, label = "Certification") {
  return {
    label: result.label || label,
    file: result.file,
    total: result.total ?? result.totalSamples ?? result.results?.length ?? 0,
    passed: result.passed ?? result.results?.filter((row) => row.passes).length ?? 0,
    failed: result.failed ?? result.results?.filter((row) => row.passes === false).length ?? 0,
    warnings: result.warnings ?? 0,
    unstable: result.unstable ?? result.unstableCount ?? 0,
    outputVariance: result.outputVariance ?? result.outputVarianceCount ?? 0,
    dialects: result.dialects ?? (result.results ? new Set(result.results.map((row) => row.dialect).filter(Boolean)).size : undefined),
    failures: result.failures || result.results?.filter((row) => row.passes === false).map((row) => ({
      dialect: row.dialect,
      fixture: row.fixture,
      source: row.source,
      output: row.output,
      failures: row.failures || [],
      qualityWarnings: row.qualityWarnings || [],
    })) || [],
  };
}

function loadInputs(inputPath) {
  const resolved = resolve(inputPath);
  if (!existsSync(resolved)) {
    throw new Error(`Input not found: ${inputPath}`);
  }
  const parsed = readJson(resolved);
  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => normalizeResult(item, item.label || `Certification ${index + 1}`));
  }
  return [normalizeResult(parsed, basename(inputPath))];
}

function gradeFor(summary) {
  if (summary.failed > 0) return "No-Go";
  if (summary.unstable > 0) return "Conditional";
  if (summary.warnings > 0 || summary.outputVariance > 0) return "Pass with Notes";
  return "Pass";
}

function escapePipes(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function collectSummary(results) {
  const totals = results.reduce((acc, result) => {
    acc.total += result.total || 0;
    acc.passed += result.passed || 0;
    acc.failed += result.failed || 0;
    acc.warnings += result.warnings || 0;
    acc.unstable += result.unstable || 0;
    acc.outputVariance += result.outputVariance || 0;
    return acc;
  }, { total: 0, passed: 0, failed: 0, warnings: 0, unstable: 0, outputVariance: 0 });
  return { ...totals, grade: gradeFor(totals) };
}

function recommendedAction(summary) {
  if (summary.failed > 0) return "Do not launch until failed checks are resolved and certification is rerun.";
  if (summary.unstable > 0) return "Launch only after repeatability instability is triaged or accepted in writing.";
  if (summary.warnings > 0 || summary.outputVariance > 0) return "Launch is acceptable with documented notes; review warnings before high-risk campaigns.";
  return "Launch candidate is certified for the tested scope.";
}

function issueRows(results) {
  return results.flatMap((result) => result.failures.flatMap((failure) => {
    const messages = [...(failure.failures || []), ...(failure.qualityWarnings || [])];
    return messages.map((message) => ({
      certification: result.label,
      dialect: failure.dialect,
      fixture: failure.fixture,
      source: failure.source,
      output: failure.output,
      message,
      ...classifyIssue(message),
    }));
  }));
}

function issueSummary(issues) {
  const summary = {};
  for (const issue of issues) {
    summary[issue.severity] = (summary[issue.severity] || 0) + 1;
    summary[issue.category] = (summary[issue.category] || 0) + 1;
  }
  return summary;
}

function render(results) {
  const summary = collectSummary(results);
  const lines = [];
  lines.push(`# DialectOS Certification Report: ${customer}`);
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Product/scope: ${product}`);
  lines.push(`Overall grade: **${summary.grade}**`);
  lines.push("");
  lines.push("## Executive summary");
  lines.push("");
  lines.push(`- Total checks: ${summary.total}`);
  lines.push(`- Passed: ${summary.passed}`);
  lines.push(`- Failed: ${summary.failed}`);
  lines.push(`- Warnings: ${summary.warnings}`);
  lines.push(`- Unstable samples: ${summary.unstable}`);
  lines.push(`- Output-variance notes: ${summary.outputVariance}`);
  lines.push(`- Recommendation: ${recommendedAction(summary)}`);
  lines.push("");
  lines.push("## MQM-aligned issue summary");
  lines.push("");
  const issues = issueRows(results);
  const mqm = issueSummary(issues);
  lines.push(`- Critical: ${mqm.critical || 0}`);
  lines.push(`- Major: ${mqm.major || 0}`);
  lines.push(`- Minor: ${mqm.minor || 0}`);
  lines.push(`- Locale convention: ${mqm["locale-convention"] || 0}`);
  lines.push(`- Taboo/safety: ${mqm["taboo-safety"] || 0}`);
  lines.push(`- Markup/placeholder: ${mqm["markup-placeholder"] || 0}`);
  lines.push("");
  lines.push("## Dialect validation status");
  lines.push("");
  lines.push("| Dialect | Status | Level |");
  lines.push("| --- | --- | --- |");
  const dialects = Array.from(new Set(results.flatMap((result) => result.failures.map((failure) => failure.dialect)).filter(Boolean))).sort();
  if (dialects.length === 0) {
    lines.push("| Certified scope | automated-certified | bronze |");
    lines.push("| es-PA | native-reviewed | silver |");
    lines.push("| es-PR | native-reviewed | silver |");
  } else {
    for (const dialect of dialects) {
      const status = dialectStatus(dialect);
      lines.push(`| ${dialect} | ${status.status} | ${status.level} |`);
    }
  }
  lines.push("");
  lines.push("## Certification matrix");
  lines.push("");
  lines.push("| Certification | Grade | Passed | Failed | Warnings | Dialects | Notes |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- |");
  for (const result of results) {
    lines.push(`| ${escapePipes(result.label)} | ${gradeFor(result)} | ${result.passed}/${result.total} | ${result.failed} | ${result.warnings} | ${result.dialects ?? ""} | ${result.unstable ? `${result.unstable} unstable` : result.outputVariance ? `${result.outputVariance} output variance` : ""} |`);
  }
  lines.push("");
  lines.push("## Failure details");
  lines.push("");
  if (issues.length === 0) {
    lines.push("No failed certification rows in the supplied artifacts.");
  } else {
    lines.push("| Certification | Dialect | Fixture | Severity | MQM category | Message | Output |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const issue of issues) {
      lines.push(`| ${escapePipes(issue.certification)} | ${escapePipes(issue.dialect)} | ${escapePipes(issue.fixture)} | ${issue.severity} | ${issue.category} | ${escapePipes(issue.message)} | ${escapePipes(issue.output)} |`);
    }
  }
  lines.push("");
  lines.push("## Commercial packaging suggestion");
  lines.push("");
  lines.push("- Use this report as the customer-facing deliverable for a paid Spanish Localization Launch Certification.");
  lines.push("- Recommended entry package: fixed-scope launch audit with certified dialect matrix and remediation notes.");
  lines.push("- Recommended recurring package: CI/GitHub certification on localization pull requests.");
  lines.push("");
  lines.push("## Limits");
  lines.push("");
  lines.push("This report certifies only the supplied artifacts and test scope. It does not replace native-speaker review for legal, medical, regulated, or brand-sensitive campaigns.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const results = loadInputs(input);
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, render(results));
console.log(JSON.stringify({ out, certifications: results.length, grade: collectSummary(results).grade }, null, 2));
