import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mcpState = vi.hoisted(() => ({
  constructorArgs: [] as unknown[][],
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn(function(...args: unknown[]) {
    mcpState.constructorArgs.push(args);
    return { tool: vi.fn(), connect: vi.fn() };
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("../tools/docs.js", () => ({
  registerDocsTools: vi.fn(),
}));

vi.mock("../tools/i18n.js", () => ({
  registerI18nTools: vi.fn(),
}));

vi.mock("../tools/translator.js", () => ({
  registerTranslatorTools: vi.fn(),
}));

vi.mock("@dialectos/providers", () => ({
  createProviderRegistry: vi.fn().mockReturnValue({}),
}));

vi.mock("@dialectos/security", () => ({
  RateLimiter: vi.fn(function() { return {}; }),
  configureSecurity: vi.fn(),
}));

describe("MCP server bootstrap", () => {
  beforeEach(() => {
    mcpState.constructorArgs = [];
    vi.resetModules();
  });

  it("should use the package.json version in MCP server metadata", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(
      readFileSync(join(here, "../../package.json"), "utf-8")
    ) as { version: string };

    const { createServer } = await import("../index.js");
    createServer();

    expect(mcpState.constructorArgs[0]?.[0]).toMatchObject({
      name: "@dialectos/mcp",
      version: packageJson.version,
    });
  });

  it("enforces the security section of its config on every tool", async () => {
    const security = await import("@dialectos/security");
    const { createServer } = await import("../index.js");
    createServer({
      rateLimit: { maxRequests: 60, windowMs: 60000 },
      security: { maxFileSize: 2048, maxContentLength: 1000, allowedDirs: ["/srv/locales"] },
      logging: { level: "error" },
    });
    expect(security.configureSecurity).toHaveBeenLastCalledWith({
      allowedDirs: ["/srv/locales"],
      maxFileSize: 2048,
      maxContentLength: 1000,
      allowHomeAsWorkingDir: false,
    });
  });
});
