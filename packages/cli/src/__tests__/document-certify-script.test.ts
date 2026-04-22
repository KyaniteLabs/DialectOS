import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("document adversarial certification", () => {
  it("certifies README, API docs, and locale outputs with structural assertions", () => {
    const outDir = join(tmpdir(), `document-certify-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    execFileSync("node", [
      "scripts/dialect-certify-documents.mjs",
      `--out=${outDir}`,
      "--dialects=es-MX,es-PA,es-PR,es-AR,es-ES,es-CL,es-BO",
      "--sample-timeout-ms=10000",
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const summary = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      total: number;
      passed: number;
      failed: number;
      results: Array<{ dialect: string; passes: boolean; files: { readmeOut: string; apiOut: string; localeOut: string } }>;
    };
    expect(summary.total).toBe(7);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(7);
    const mx = summary.results.find((result) => result.dialect === "es-MX")!;
    const readme = readFileSync(mx.files.readmeOut, "utf-8");
    expect(readme).toContain("{userName}");
    expect(readme).toContain("%{count}");
    expect(readme).toContain("https://example.com/app");

    rmSync(outDir, { recursive: true, force: true });
  });

  it("records missing output files instead of crashing", () => {
    const outDir = join(tmpdir(), `document-certify-live-failure-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    expect(() => execFileSync("node", [
      "scripts/dialect-certify-documents.mjs",
      `--out=${outDir}`,
      "--dialects=es-MX",
      "--sample-timeout-ms=10000",
    ], {
      cwd: join(import.meta.dirname, "../../../.."),
      stdio: "pipe",
      env: {
        ...process.env,
        DIALECT_DOC_CERT_SKIP_README_OUTPUT: "1",
      },
    })).toThrow();

    const summary = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      total: number;
      failed: number;
      results: Array<{ dialect: string; passes: boolean; failures: string[] }>;
    };
    expect(summary.total).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[0].passes).toBe(false);
    expect(summary.results[0].failures.join(" ")).toContain("README output missing");

    rmSync(outDir, { recursive: true, force: true });
  });
});
