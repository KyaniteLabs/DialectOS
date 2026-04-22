import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
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
      env: {
        ...process.env,
        DEEPL_AUTH_KEY: "",
        LIBRETRANSLATE_URL: "",
        ENABLE_MYMEMORY: "",
        LLM_API_URL: "",
        LLM_ENDPOINT: "",
        LM_STUDIO_URL: "",
        LLM_MODEL: "",
      },
    })).toThrow(/No live providers are configured/);

    rmSync(outDir, { recursive: true, force: true });
  }, 10000);


  it("certify writes incremental progress, events, and a summary", () => {
    const outDir = join(tmpdir(), `dialect-certify-script-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    execFileSync("node", [
      "scripts/dialect-certify.mjs",
      `--out=${outDir}`,
      "--dialects=es-PA,es-PR",
      "--sample-timeout-ms=10000",
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      total: number;
      passed: number;
      failed: number;
      results: Array<{ elapsedMs: number; passes: boolean }>;
    };
    const progress = JSON.parse(readFileSync(join(outDir, "progress.json"), "utf-8")) as {
      total: number;
      completed: number;
      failed: number;
    };
    const events = readFileSync(join(outDir, "events.jsonl"), "utf-8").trim().split("\n").map((line) => JSON.parse(line) as { event: string });

    expect(results.total).toBeGreaterThanOrEqual(4);
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
    expect(results.results.every((result) => typeof result.elapsedMs === "number")).toBe(true);
    expect(progress.completed).toBe(results.total);
    expect(progress.failed).toBe(0);
    expect(events.some((event) => event.event === "sample_started")).toBe(true);
    expect(events.some((event) => event.event === "sample_completed")).toBe(true);

    rmSync(outDir, { recursive: true, force: true });
  });

  it("certify records per-sample timeout failures incrementally", () => {
    const outDir = join(tmpdir(), `dialect-certify-timeout-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    expect(() => execFileSync("node", [
      "scripts/dialect-certify.mjs",
      `--out=${outDir}`,
      "--dialects=es-PA",
      "--sample-timeout-ms=1",
      "--live",
      "--provider=llm",
    ], {
      cwd: join(import.meta.dirname, "../../../.."),
      stdio: "pipe",
      env: {
        ...process.env,
        LLM_API_URL: "http://127.0.0.1:1234",
        LLM_MODEL: "timeout-test-model",
        LLM_API_FORMAT: "lmstudio",
        DIALECT_CERTIFY_TEST_DELAY_MS: "50",
      },
    })).toThrow();

    expect(existsSync(join(outDir, "results.json"))).toBe(true);
    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      failed: number;
      results: Array<{ failures: string[] }>;
    };
    expect(results.failed).toBeGreaterThan(0);
    expect(results.results[0].failures.join(" ")).toContain("Sample timed out after 1ms");

    rmSync(outDir, { recursive: true, force: true });
  });


  it("certify retries transient sample process failures", () => {
    const outDir = join(tmpdir(), `dialect-certify-retry-${process.pid}`);
    const failDir = join(tmpdir(), `dialect-certify-fail-once-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });
    rmSync(failDir, { recursive: true, force: true });

    execFileSync("node", [
      "scripts/dialect-certify.mjs",
      `--out=${outDir}`,
      "--dialects=es-AR",
      "--sample-retries=1",
      "--sample-timeout-ms=10000",
    ], {
      cwd: join(import.meta.dirname, "../../../.."),
      stdio: "pipe",
      env: { ...process.env, DIALECT_CERTIFY_TEST_FAIL_ONCE_DIR: failDir },
    });

    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      failed: number;
      results: Array<{ attempts: number; passes: boolean }>;
    };
    const events = readFileSync(join(outDir, "events.jsonl"), "utf-8").trim().split("\n").map((line) => JSON.parse(line) as { event: string });

    expect(results.failed).toBe(0);
    expect(results.results[0].passes).toBe(true);
    expect(results.results[0].attempts).toBe(2);
    expect(events.some((event) => event.event === "sample_retrying")).toBe(true);

    rmSync(outDir, { recursive: true, force: true });
    rmSync(failDir, { recursive: true, force: true });
  });


  it("adversarial certify writes a failure matrix and repeatability summary", () => {
    const outDir = join(tmpdir(), `dialect-adversarial-certify-${process.pid}`);
    rmSync(outDir, { recursive: true, force: true });

    execFileSync("node", [
      "scripts/dialect-certify-adversarial.mjs",
      `--out=${outDir}`,
      "--repeat=2",
      "--sample-timeout-ms=10000",
    ], { cwd: join(import.meta.dirname, "../../../.."), stdio: "pipe" });

    const results = JSON.parse(readFileSync(join(outDir, "results.json"), "utf-8")) as {
      totalRuns: number;
      totalSamples: number;
      failed: number;
      unstableCount: number;
      results: Array<{ category: string; severity: string; run: number }>;
    };
    const matrix = readFileSync(join(outDir, "failure-matrix.md"), "utf-8");

    expect(results.totalRuns).toBe(2);
    expect(results.totalSamples).toBeGreaterThanOrEqual(20);
    expect(results.failed).toBe(0);
    expect(results.unstableCount).toBe(0);
    expect(results.results.some((result) => result.category === "dialect-collision")).toBe(true);
    expect(results.results.some((result) => result.severity === "critical")).toBe(true);
    expect(matrix).toContain("Adversarial Dialect Certification Matrix");
    expect(matrix).toContain("dialect-collision");

    rmSync(outDir, { recursive: true, force: true });
  }, 30000);

});
