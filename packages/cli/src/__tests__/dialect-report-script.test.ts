import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("dialect report script", () => {
  it("renders a customer-facing launch report from certification artifacts", () => {
    const dir = join(tmpdir(), `dialect-report-${process.pid}`);
    const input = join(dir, "matrix.json");
    const out = join(dir, "report.md");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(input, JSON.stringify([
      { label: "Basic cert", total: 27, passed: 27, failed: 0, warnings: 0, dialects: 25, failures: [] },
      { label: "Adversarial cert", total: 125, passed: 125, failed: 0, warnings: 0, dialects: 25, unstable: 0, outputVariance: 0, failures: [] },
    ], null, 2));

    execFileSync("node", [
      "scripts/dialect-report.mjs",
      `--input=${input}`,
      `--out=${out}`,
      "--customer=Acme SaaS",
      "--product=Spanish launch",
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const report = readFileSync(out, "utf-8");
    expect(report).toContain("DialectOS Certification Report: Acme SaaS");
    expect(report).toContain("Overall grade: **Pass**");
    expect(report).toContain("Launch candidate is certified");
    expect(report).toContain("MQM-aligned issue summary");
    expect(report).toContain("Dialect validation status");
    expect(report).toContain("Basic cert");
    expect(report).toContain("Adversarial cert");

    rmSync(dir, { recursive: true, force: true });
  });

  it("grades reports with failures as no-go", () => {
    const dir = join(tmpdir(), `dialect-report-fail-${process.pid}`);
    const input = join(dir, "matrix.json");
    const out = join(dir, "report.md");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(input, JSON.stringify({
      label: "Failed cert",
      total: 1,
      passed: 0,
      failed: 1,
      warnings: 0,
      failures: [{ dialect: "es-PA", fixture: "taboo", failures: ["Forbidden output term present: chombo"], output: "chombo" }],
    }, null, 2));

    execFileSync("node", [
      "scripts/dialect-report.mjs",
      `--input=${input}`,
      `--out=${out}`,
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const report = readFileSync(out, "utf-8");
    expect(report).toContain("Overall grade: **No-Go**");
    expect(report).toContain("Do not launch");
    expect(report).toContain("taboo-safety");
    expect(report).toContain("critical");
    expect(report).toContain("Forbidden output term present: chombo");

    rmSync(dir, { recursive: true, force: true });
  });
});
