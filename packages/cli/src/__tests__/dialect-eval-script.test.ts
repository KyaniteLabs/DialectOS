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
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      total: number;
      passed: number;
      failed: number;
      live: boolean;
      results: Array<{ fixture: string; passes: boolean; output: string; provider: string; live: boolean; qualityWarnings: string[] }>;
    };

    expect(results.total).toBeGreaterThanOrEqual(25);
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
    expect(results.live).toBe(false);
    expect(results.results.some((result) => result.fixture === "pa-transit-neutral")).toBe(true);
    expect(results.results.every((result) => result.provider === "mock-semantic" && result.live === false)).toBe(true);
    expect(results.results.every((result) => Array.isArray(result.qualityWarnings))).toBe(true);

    rmSync(outDir, { recursive: true, force: true });
  });
  it("reports a clear error when live mode has no configured provider", () => {
    const outDir = join(tmpdir(), `dialect-eval-live-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    expect(() => execFileSync("node", [
      "scripts/dialect-eval.mjs",
      `--out=${outDir}`,
      "--dialects=es-PA",
      "--provider=auto",
      "--live",
    ], {
      cwd: join(import.meta.dirname, "../../../.."),
      stdio: "pipe",
      env: { ...process.env, DEEPL_AUTH_KEY: "", LIBRETRANSLATE_URL: "", ENABLE_MYMEMORY: "" },
    })).toThrow(/No live providers are configured/);

    rmSync(outDir, { recursive: true, force: true });
  });

});
