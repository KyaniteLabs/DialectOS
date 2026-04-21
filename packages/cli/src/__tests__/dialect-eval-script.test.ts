import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("dialect eval script", () => {
  it("scores fixture outputs and writes an audit artifact", () => {
    const outDir = join(tmpdir(), `dialect-eval-script-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    execFileSync("node", [
      "scripts/dialect-eval.mjs",
      `--out=${outDir}`,
      "--dialects=es-PA,es-PR,es-MX,es-AR,es-ES",
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      total: number;
      passed: number;
      failed: number;
      results: Array<{ fixture: string; passes: boolean; output: string }>;
    };

    expect(results.total).toBeGreaterThanOrEqual(7);
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
    expect(results.results.some((result) => result.fixture === "pa-transit-neutral")).toBe(true);

    rmSync(outDir, { recursive: true, force: true });
  });
});
