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
});
