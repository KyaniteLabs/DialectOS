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
import { createProviderRegistry } from "@dialectos/providers";
import {
  handleTranslateText,
  handleDetectDialect,
  handleTranslateCodeComment,
  handleTranslateReadme,
  handleSearchGlossary,
  handleResearchRegionalTerm,
  handleListDialects,
} from "./translator-handlers.js";
import { registerScoredTool } from "./metadata.js";
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
export { detectDialect } from "./dialect-detector.js";

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

  registerScoredTool(
    server,
    "translate_text",
    {
      title: "Translate text to Spanish dialect",
      description:
        "Translate a short text string from English into one Spanish regional dialect and return the translated text plus provider metadata. This does not read or write files; it may call the selected translation provider.",
      inputSchema: {
        text: z.string().min(1).describe("Source text to translate. Plain text only; for Markdown files use translate_markdown or translate_readme."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code. Defaults to es-ES when omitted; examples include es-MX, es-AR, and es-CO."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
        formal: z.boolean().optional().describe("Request formal Spanish register. Do not set both formal and informal."),
        informal: z.boolean().optional().describe("Request informal Spanish register. Do not set both informal and formal."),
      },
      annotations: {
        title: "Translate text to Spanish dialect",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => handleTranslateText(params as TranslateTextParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "detect_dialect",
    {
      title: "Detect Spanish dialect",
      description:
        "Analyze Spanish text and rank likely regional dialects using vocabulary, grammar, and weighted scoring across 25 variants. Returns the detected dialect, confidence signals, and evidence; it does not translate or modify text.",
      inputSchema: {
        text: z.string().min(1).describe("Spanish text to analyze for regional dialect signals."),
      },
      annotations: {
        title: "Detect Spanish dialect",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => handleDetectDialect(params as DetectDialectParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "translate_code_comment",
    {
      title: "Translate code comments",
      description:
        "Translate English // and /* */ comments inside a code snippet into a Spanish dialect while leaving executable code unchanged. Returns a translated code string and comment-level error list; it does not write files.",
      inputSchema: {
        code: z.string().min(1).describe("Source code text containing comments to translate. The tool only rewrites comments detected in this string."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code for translated comments. Defaults to es-ES when omitted."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
      },
      annotations: {
        title: "Translate code comments",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => handleTranslateCodeComment(params as TranslateCodeCommentParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "translate_readme",
    {
      title: "Translate README Markdown",
      description:
        "Read a README Markdown file, translate translatable prose into a Spanish dialect, and return translated Markdown with code blocks and structure preserved. Reads the file only; it does not overwrite the README.",
      inputSchema: {
        filePath: z.string().min(1).describe("Path to the README Markdown file to read and translate."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code. Defaults to es-ES when omitted."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
        formal: z.boolean().optional().describe("Request formal Spanish register. Do not set both formal and informal."),
        informal: z.boolean().optional().describe("Request informal Spanish register. Do not set both informal and formal."),
      },
      annotations: {
        title: "Translate README Markdown",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => handleTranslateReadme(params as TranslateReadmeParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "search_glossary",
    {
      title: "Search translation glossary",
      description:
        "Search DialectOS's built-in technical and business glossary for matching source terms and localized Spanish equivalents. Returns matching glossary records and count; it does not call external services or modify glossary data.",
      inputSchema: {
        query: z.string().min(1).describe("Term, phrase, or keyword to search in the built-in glossary."),
      },
      annotations: {
        title: "Search translation glossary",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => handleSearchGlossary(params as SearchGlossaryParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "research_regional_term",
    {
      title: "Research regional Spanish term",
      description:
        "Generate a source-backed proposal for how a concept is expressed across selected Spanish dialects. Returns candidate terms, confidence, and sources; it does not mutate runtime translation data.",
      inputSchema: {
        concept: z.string().min(1).describe("Concept or phrase to research, such as orange juice or mobile app onboarding."),
        dialects: z.string().min(1).describe("Comma-separated Spanish dialect codes to research, such as es-PR,es-MX."),
        semanticField: z.string().min(1).optional().describe("Optional domain or semantic field that narrows the research context, such as food-drink, legal, or software-ui."),
      },
      annotations: {
        title: "Research regional Spanish term",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => handleResearchRegionalTerm(params as ResearchRegionalTermParams, registry, rateLimiter)
  );

  registerScoredTool(
    server,
    "list_dialects",
    {
      title: "List supported Spanish dialects",
      description:
        "Return all 25 Spanish dialect codes supported by DialectOS with names and short descriptions. This is a read-only catalog lookup and does not require a translation provider.",
      inputSchema: {},
      annotations: {
        title: "List supported Spanish dialects",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => handleListDialects(params as ListDialectsParams, registry, rateLimiter)
  );
}
