import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Configuration System", () => {
  const tempDir = join(tmpdir(), "espanol-mcp-config-test");

  beforeEach(() => {
    // Clear all env vars that might affect config
    delete process.env.ESPANOL_RATE_LIMIT;
    delete process.env.ESPANOL_MAX_FILE_SIZE;
    delete process.env.ESPANOL_MAX_CONTENT_LENGTH;
    delete process.env.ALLOWED_LOCALE_DIRS;
    delete process.env.ESPANOL_LOG_LEVEL;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true }); } catch {}
  });

  it("should return default config when no args or env", async () => {
    const { loadConfig } = await import("../lib/config.js");
    const config = loadConfig();

    expect(config.rateLimit.maxRequests).toBe(60);
    expect(config.rateLimit.windowMs).toBe(60000);
    expect(config.security.maxFileSize).toBe(512 * 1024);
    expect(config.security.maxContentLength).toBe(50000);
    expect(config.security.allowedDirs).toEqual([]);
    expect(config.logging.level).toBe("error");
  });

  it("should override rate limit from env var", async () => {
    vi.stubEnv("ESPANOL_RATE_LIMIT", "120,30000");
    const { loadConfig } = await import("../lib/config.js");
    const config = loadConfig();

    expect(config.rateLimit.maxRequests).toBe(120);
    expect(config.rateLimit.windowMs).toBe(30000);
  });



  it("should not leak env overrides into later default config loads", async () => {
    const { loadConfig } = await import("../lib/config.js");

    vi.stubEnv("ESPANOL_RATE_LIMIT", "120,30000");
    expect(loadConfig().rateLimit.maxRequests).toBe(120);

    vi.unstubAllEnvs();
    delete process.env.ESPANOL_RATE_LIMIT;

    expect(loadConfig().rateLimit.maxRequests).toBe(60);
    expect(loadConfig().rateLimit.windowMs).toBe(60000);
  });

  it("should fail fast on invalid numeric env vars", async () => {
    vi.stubEnv("ESPANOL_RATE_LIMIT", "many,soon");
    const { loadConfig } = await import("../lib/config.js");

    expect(() => loadConfig()).toThrow(/Invalid MCP config env ESPANOL_RATE_LIMIT/);
  });

  it("should override max file size from env var", async () => {
    vi.stubEnv("ESPANOL_MAX_FILE_SIZE", "1048576");
    const { loadConfig } = await import("../lib/config.js");
    const config = loadConfig();

    expect(config.security.maxFileSize).toBe(1048576);
  });

  it("should override allowed dirs from env var", async () => {
    vi.stubEnv("ALLOWED_LOCALE_DIRS", "/locales,/data");
    const { loadConfig } = await import("../lib/config.js");
    const config = loadConfig();

    expect(config.security.allowedDirs).toEqual(["/locales", "/data"]);
  });


  it("should fail fast on invalid log level env var", async () => {
    vi.stubEnv("ESPANOL_LOG_LEVEL", "verbose");
    const { loadConfig } = await import("../lib/config.js");

    expect(() => loadConfig()).toThrow(/Invalid MCP config env ESPANOL_LOG_LEVEL/);
  });

  it("should parse config file", async () => {
    mkdirSync(tempDir, { recursive: true });
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      rateLimit: { maxRequests: 100, windowMs: 30000 },
      logging: { level: "debug" },
    }));

    const { loadConfig } = await import("../lib/config.js");
    const config = loadConfig(configPath);

    expect(config.rateLimit.maxRequests).toBe(100);
    expect(config.rateLimit.windowMs).toBe(30000);
    expect(config.logging.level).toBe("debug");
  });

  it("should fail fast on invalid config file", async () => {
    mkdirSync(tempDir, { recursive: true });
    const configPath = join(tempDir, "bad.json");
    writeFileSync(configPath, "not valid json{{{");

    const { loadConfig } = await import("../lib/config.js");

    expect(() => loadConfig(configPath)).toThrow(/Invalid MCP config/);
  });

  it("should get config path from CLI args", async () => {
    const { getConfigPath } = await import("../lib/config.js");

    // Mock process.argv
    const originalArgv = process.argv;
    process.argv = ["node", "index.js", "--config", "/etc/espanol.json"];

    const path = getConfigPath();
    expect(path).toBe("/etc/espanol.json");

    process.argv = originalArgv;
  });

  it("should return undefined when no --config arg", async () => {
    const { getConfigPath } = await import("../lib/config.js");

    const originalArgv = process.argv;
    process.argv = ["node", "index.js"];

    const path = getConfigPath();
    expect(path).toBeUndefined();

    process.argv = originalArgv;
  });
});
