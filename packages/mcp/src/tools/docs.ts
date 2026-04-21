/**
 * MCP Tools for Markdown Translation
 *
 * Provides 4 MCP tools:
 * - translate_markdown: Translate a markdown file preserving structure
 * - extract_translatable: Extract translatable text from markdown
 * - translate_api_docs: Translate API documentation with table/list handling
 * - create_bilingual_doc: Create side-by-side bilingual document
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type {
  MarkdownSection,
  SpanishDialect,
  ProviderName,
} from "@espanol/types";
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@espanol/markdown-parser";
import {
  validateMarkdownPath,
  validateContentLength,
  RateLimiter,
  SecurityError,
  createSafeError,
} from "@espanol/security";
import type { ProviderRegistry } from "@espanol/providers";
import { ToolResult } from "../lib/types.js";
import type { BaseToolOptions } from "../lib/types.js";
import { createProviderRegistry as createProviderRegistryImpl } from "../lib/provider-factory.js";
import { prepareProviderRequest } from "../lib/provider-request.js";

// Re-export for backward compatibility
export { createProviderRegistryImpl as createProviderRegistry };

// ============================================================================
// Types
// ============================================================================

interface DocsToolsOptions extends BaseToolOptions {}

interface TranslateMarkdownParams {
  filePath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
  formal?: boolean;
  informal?: boolean;
}

interface ExtractTranslatableParams {
  filePath: string;
}

interface TranslateApiDocsParams {
  filePath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
}

interface CreateBilingualDocParams {
  filePath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle translate_markdown tool
 */
async function handleTranslateMarkdown(
  params: TranslateMarkdownParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate and get file path
    const validatedPath = validateMarkdownPath(params.filePath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto();

    // Determine formality
    let formality: "formal" | "informal" | "auto" = "auto";
    if (params.formal) formality = "formal";
    if (params.informal) formality = "informal";

    // Translate translatable sections
    const translatedSections: MarkdownSection[] = [];

    for (const section of parsed.sections) {
      if (!section.translatable) {
        // Keep non-translatable sections as-is
        translatedSections.push(section);
      } else {
        // Translate the content
        const prepared = prepareProviderRequest(
          registry,
          provider.name,
          section.content,
          "en",
          params.dialect || "es-ES",
          { formality, dialect: params.dialect }
        );
        const result = await provider.translate(
          section.content,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );

        translatedSections.push({
          ...section,
          content: result.translatedText,
        });
      }
    }

    // Reconstruct markdown
    const translated = reconstructMarkdown(parsed.sections, translatedSections);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translated,
            sectionsProcessed: parsed.translatableSections,
            codeBlocksPreserved: parsed.codeBlockCount,
            linksPreserved: parsed.linkCount,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle extract_translatable tool
 */
async function handleExtractTranslatable(
  params: ExtractTranslatableParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate and get file path
    const validatedPath = validateMarkdownPath(params.filePath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Build sections array
    const sections = parsed.sections
      .filter((s) => s.translatable)
      .map((s) => ({
        type: s.type,
        content: s.content,
      }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            sections,
            totalSections: parsed.sections.length,
            translatableCount: parsed.translatableSections,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle translate_api_docs tool
 */
async function handleTranslateApiDocs(
  params: TranslateApiDocsParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate and get file path
    const validatedPath = validateMarkdownPath(params.filePath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto();

    // Translate translatable sections
    const translatedSections: MarkdownSection[] = [];

    for (const section of parsed.sections) {
      if (!section.translatable) {
        translatedSections.push(section);
      } else {
        // For API docs, add context about documentation
        const prepared = prepareProviderRequest(
          registry,
          provider.name,
          section.content,
          "en",
          params.dialect || "es-ES",
          {
            context: "API documentation",
            dialect: params.dialect,
          }
        );
        const result = await provider.translate(
          section.content,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );

        translatedSections.push({
          ...section,
          content: result.translatedText,
        });
      }
    }

    // Reconstruct markdown
    const translated = reconstructMarkdown(parsed.sections, translatedSections);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translated,
            sectionsProcessed: parsed.translatableSections,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle create_bilingual_doc tool
 */
async function handleCreateBilingualDoc(
  params: CreateBilingualDocParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate and get file path
    const validatedPath = validateMarkdownPath(params.filePath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto();

    // Build bilingual document
    const bilingualParts: string[] = [];

    for (const section of parsed.sections) {
      if (!section.translatable) {
        // Keep non-translatable sections as-is
        bilingualParts.push(section.raw);
      } else {
        // Translate the content
        const prepared = prepareProviderRequest(
          registry,
          provider.name,
          section.content,
          "en",
          params.dialect || "es-ES",
          { dialect: params.dialect }
        );
        const result = await provider.translate(
          section.content,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );

        // Add side-by-side sections
        bilingualParts.push("## Original");
        bilingualParts.push(section.raw);
        bilingualParts.push("");
        bilingualParts.push("## Translation");
        bilingualParts.push(result.translatedText);
        bilingualParts.push("");
        bilingualParts.push("---");
        bilingualParts.push("");
      }
    }

    const bilingual = bilingualParts.join("\n");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            bilingual,
            sectionsProcessed: parsed.translatableSections,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register all docs tools with the MCP server
 */
export function registerDocsTools(
  server: McpServer,
  options: DocsToolsOptions = {}
): void {
  // Create registry if not provided
  const registry = options.registry || createProviderRegistryImpl();

  // Create rate limiter if not provided
  const rateLimiter = options.rateLimiter || new RateLimiter(60, 60000);

  // Register translate_markdown tool
  server.tool(
    "translate_markdown",
    "Translate a markdown file while preserving structure (code blocks, links, etc.)",
    {
      filePath: z.string().describe("Path to the markdown file to translate"),
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (deepl, libre, mymemory)"),
      formal: z.boolean().optional().describe("Use formal tone (for languages that distinguish formal/informal)"),
      informal: z.boolean().optional().describe("Use informal tone (for languages that distinguish formal/informal)"),
    },
    async (params) => {
      return handleTranslateMarkdown(params as TranslateMarkdownParams, registry, rateLimiter);
    }
  );

  // Register extract_translatable tool
  server.tool(
    "extract_translatable",
    "Extract translatable text from a markdown file (excludes code blocks, HTML)",
    {
      filePath: z.string().describe("Path to the markdown file to analyze"),
    },
    async (params) => {
      return handleExtractTranslatable(params as ExtractTranslatableParams, registry, rateLimiter);
    }
  );

  // Register translate_api_docs tool
  server.tool(
    "translate_api_docs",
    "Translate API documentation markdown with optimized handling for tables and lists",
    {
      filePath: z.string().describe("Path to the API documentation markdown file"),
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (deepl, libre, mymemory)"),
    },
    async (params) => {
      return handleTranslateApiDocs(params as TranslateApiDocsParams, registry, rateLimiter);
    }
  );

  // Register create_bilingual_doc tool
  server.tool(
    "create_bilingual_doc",
    "Create a side-by-side bilingual document with original and translated sections",
    {
      filePath: z.string().describe("Path to the markdown file to translate"),
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (deepl, libre, mymemory)"),
    },
    async (params) => {
      return handleCreateBilingualDoc(params as CreateBilingualDocParams, registry, rateLimiter);
    }
  );
}
