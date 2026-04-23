#!/usr/bin/env node
/**
 * @espanol/mcp
 *
 * MCP adapter for Espanol — provides Model Context Protocol tools for translation
 *
 * This package exposes MCP tools for:
 * - Markdown translation (translate_markdown)
 * - Extracting translatable text (extract_translatable)
 * - API documentation translation (translate_api_docs)
 * - Bilingual document creation (create_bilingual_doc)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDocsTools } from "./tools/docs.js";
import { registerI18nTools } from "./tools/i18n.js";
import { registerTranslatorTools } from "./tools/translator.js";
import { setupGlobalHandlers } from "./lib/error-handler.js";
import { loadConfig, getConfigPath, type MCPConfig } from "./lib/config.js";
import { createProviderRegistry } from "./lib/provider-factory.js";
import { RateLimiter } from "@espanol/security";

// ============================================================================
// MCP Server Setup
// ============================================================================

/**
 * Create and configure the MCP server
 */
function createServer(config: MCPConfig = loadConfig()): McpServer {
  const server = new McpServer(
    {
      name: "@espanol/mcp",
      version: "0.1.0",
    },
    {
      capabilities: {},
    }
  );

  const registry = createProviderRegistry();
  const rateLimiter = new RateLimiter(
    config.rateLimit.maxRequests,
    config.rateLimit.windowMs
  );

  // Register all tool categories (17 tools total)
  registerDocsTools(server, { registry, rateLimiter });
  registerI18nTools(server, { registry, rateLimiter });
  registerTranslatorTools(server, { registry, rateLimiter });

  return server;
}

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the MCP server with stdio transport
 */
async function main(): Promise<void> {
  setupGlobalHandlers();
  const server = createServer(loadConfig(getConfigPath()));

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Server is now running and listening for MCP messages
  // No need to log anything as stdout/stderr are used for the protocol
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "fatal", error: "MCP_STARTUP_FAILED", message }));
    process.exit(1);
  });
}

// Export for testing
export { createServer };
export { registerDocsTools } from "./tools/docs.js";
export { registerI18nTools } from "./tools/i18n.js";
export { registerTranslatorTools } from "./tools/translator.js";
