/**
 * MCP Tools for Translation
 *
 * Provides 7 MCP tools:
 * - translate_text: Translate text to Spanish dialect
 * - detect_dialect: Detect Spanish dialect from text
 * - translate_code_comment: Translate code comments (basic, text extraction)
 * - translate_readme: Translate a README markdown file
 * - search_glossary: Search the built-in glossary
 * - list_dialects: List all Spanish dialects with metadata
 * - research_regional_term: Create source-backed lexeme proposals without mutating runtime data
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dialectSchema, providerNameSchema } from "@dialectos/types";
import { RateLimiter } from "@dialectos/security";
import { ProviderRegistry } from "@dialectos/providers";
import { createProviderRegistry } from "../lib/provider-factory.js";
import {
  handleTranslateText,
  handleDetectDialect,
  handleTranslateCodeComment,
  handleTranslateReadme,
  handleSearchGlossary,
  handleResearchRegionalTerm,
  handleListDialects,
} from "./translator-handlers.js";
import type {
  TranslateTextParams,
  DetectDialectParams,
  TranslateCodeCommentParams,
  TranslateReadmeParams,
  SearchGlossaryParams,
  ListDialectsParams,
  ResearchRegionalTermParams,
} from "./translator-types.js";

export type {
  TranslateTextParams,
  DetectDialectParams,
  TranslateCodeCommentParams,
  TranslateReadmeParams,
  SearchGlossaryParams,
  ListDialectsParams,
  ResearchRegionalTermParams,
  McpRegionalResearchSource,
  McpResearchConfidence,
  McpRegionalLexemeProposal,
} from "./translator-types.js";

export { DIALECT_METADATA } from "./translator-data.js";

/**
 * Register all translator tools with the MCP server
 */
export function registerTranslatorTools(
  server: McpServer,
  options: { registry?: ProviderRegistry; rateLimiter?: RateLimiter } = {}
): void {
  // Create registry if not provided
  const registry = options.registry || createProviderRegistry();

  // Create rate limiter if not provided
  const rateLimiter = options.rateLimiter || new RateLimiter(60, 60000);

  // Register translate_text tool
  server.tool(
    "translate_text",
    "Translate text to a Spanish dialect",
    {
      text: z.string().describe("Text to translate"),
      dialect: dialectSchema.optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: providerNameSchema.optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
      formal: z.boolean().optional().describe("Use formal tone"),
      informal: z.boolean().optional().describe("Use informal tone"),
    },
    async (params) => {
      return handleTranslateText(params as TranslateTextParams, registry, rateLimiter);
    }
  );

  // Register detect_dialect tool
  server.tool(
    "detect_dialect",
    "Detect Spanish dialect from text using keyword matching",
    {
      text: z.string().describe("Text to analyze for dialect detection"),
    },
    async (params) => {
      return handleDetectDialect(params as DetectDialectParams, registry, rateLimiter);
    }
  );

  // Register translate_code_comment tool
  server.tool(
    "translate_code_comment",
    "Extract and translate code comments (basic text extraction)",
    {
      code: z.string().describe("Source code with comments to translate"),
      dialect: dialectSchema.optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: providerNameSchema.optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
    },
    async (params) => {
      return handleTranslateCodeComment(params as TranslateCodeCommentParams, registry, rateLimiter);
    }
  );

  // Register translate_readme tool
  server.tool(
    "translate_readme",
    "Translate a README markdown file preserving structure",
    {
      filePath: z.string().describe("Path to the README markdown file"),
      dialect: dialectSchema.optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: providerNameSchema.optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
      formal: z.boolean().optional().describe("Use formal tone"),
      informal: z.boolean().optional().describe("Use informal tone"),
    },
    async (params) => {
      return handleTranslateReadme(params as TranslateReadmeParams, registry, rateLimiter);
    }
  );

  // Register search_glossary tool
  server.tool(
    "search_glossary",
    "Search the built-in glossary for technical and business terms",
    {
      query: z.string().describe("Search query for glossary terms"),
    },
    async (params) => {
      return handleSearchGlossary(params as SearchGlossaryParams, registry, rateLimiter);
    }
  );

  // Register research_regional_term tool
  server.tool(
    "research_regional_term",
    "Research a regional term as a source-backed proposal; does not mutate runtime translation data",
    {
      concept: z.string().describe("Concept or phrase to research, e.g. orange juice"),
      dialects: z.string().describe("Comma-separated dialect codes, e.g. es-PR,es-MX"),
      semanticField: z.string().optional().describe("Semantic field, e.g. food-drink"),
    },
    async (params) => {
      return handleResearchRegionalTerm(params as ResearchRegionalTermParams, registry, rateLimiter);
    }
  );

  // Register list_dialects tool
  server.tool(
    "list_dialects",
    "List all 20 Spanish dialects with metadata",
    {},
    async (params) => {
      return handleListDialects(params as ListDialectsParams, registry, rateLimiter);
    }
  );
}
