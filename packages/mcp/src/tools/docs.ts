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
} from "@dialectos/types";
import { dialectSchema, providerNameSchema } from "@dialectos/types";
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@dialectos/markdown-parser";
import {
  validateMarkdownPath,
  validateContentLength,
  checkFileSize,
  RateLimiter,
  createSafeError,
} from "@dialectos/security";
import type { ProviderRegistry } from "@dialectos/providers";
import { ToolResult } from "../lib/types.js";
import type { BaseToolOptions } from "../lib/types.js";
import { createProviderRegistry } from "@dialectos/providers";
import { registerScoredTool } from "./metadata.js";

// Re-export for backward compatibility
export { createProviderRegistry };

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

    // Check file size before reading into memory (prevent OOM)
    checkFileSize(validatedPath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    // Determine formality
    let formality: "formal" | "informal" | "auto" = "auto";
    if (params.formal) formality = "formal";
    if (params.informal) formality = "informal";

    // Translate translatable sections
    const translatedSections: MarkdownSection[] = [];
    const errors: string[] = [];
    let sectionsTranslated = 0;

    for (const section of parsed.sections) {
      if (!section.translatable) {
        // Keep non-translatable sections as-is
        translatedSections.push(section);
      } else {
        try {
          // Translate the content
          const prepared = registry.prepareRequest(
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
          sectionsTranslated++;
        } catch (error) {
          const safe = createSafeError(error);
          errors.push(`${section.type}: ${safe.error}`);
          // Fallback: keep original content for this section
          translatedSections.push(section);
        }
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
            sectionsTranslated,
            errors,
            codeBlocksPreserved: parsed.codeBlockCount,
            linksPreserved: parsed.linkCount,
          }),
        },
      ],
      isError: sectionsTranslated === 0 && parsed.translatableSections > 0,
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

    // Check file size before reading into memory (prevent OOM)
    checkFileSize(validatedPath);

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

    // Check file size before reading into memory (prevent OOM)
    checkFileSize(validatedPath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    // Translate translatable sections
    const translatedSections: MarkdownSection[] = [];
    const errors: string[] = [];
    let sectionsTranslated = 0;

    for (const section of parsed.sections) {
      if (!section.translatable) {
        translatedSections.push(section);
      } else {
        try {
          // For API docs, add context about documentation
          const prepared = registry.prepareRequest(
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
          sectionsTranslated++;
        } catch (error) {
          const safe = createSafeError(error);
          errors.push(`${section.type}: ${safe.error}`);
          translatedSections.push(section);
        }
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
            sectionsTranslated,
            errors,
          }),
        },
      ],
      isError: sectionsTranslated === 0 && parsed.translatableSections > 0,
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

    // Check file size before reading into memory (prevent OOM)
    checkFileSize(validatedPath);

    // Read file content
    const content = readFileSync(validatedPath, "utf-8");

    // Validate content length
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    // Build bilingual document
    const bilingualParts: string[] = [];
    const errors: string[] = [];
    let sectionsTranslated = 0;

    for (const section of parsed.sections) {
      if (!section.translatable) {
        // Keep non-translatable sections as-is
        bilingualParts.push(section.raw);
      } else {
        try {
          // Translate the content
          const prepared = registry.prepareRequest(
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
          sectionsTranslated++;
        } catch (error) {
          const safe = createSafeError(error);
          errors.push(`${section.type}: ${safe.error}`);
          // Fallback: include original only
          bilingualParts.push("## Original");
          bilingualParts.push(section.raw);
          bilingualParts.push("");
          bilingualParts.push("---");
          bilingualParts.push("");
        }
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
            sectionsTranslated,
            errors,
          }),
        },
      ],
      isError: sectionsTranslated === 0 && parsed.translatableSections > 0,
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
  const registry = options.registry || createProviderRegistry();

  // Create rate limiter if not provided
  const rateLimiter = options.rateLimiter || new RateLimiter(60, 60000);

  registerScoredTool(
    server,
    "translate_markdown",
    {
      title: "Translate Markdown file",
      description:
        "Read an ordinary Markdown file, translate translatable prose into a Spanish dialect, and return reconstructed Markdown while preserving code blocks, links, and non-translatable sections. Use this for general Markdown pages, articles, or docs; use translate_readme for repository README files with badges/install/license sections, and use translate_api_docs for endpoint/reference documentation. Reads the file only, may call the selected translation provider under the configured rate limiter, and does not overwrite the source file.",
      inputSchema: {
        filePath: z.string().min(1).describe("Path to the Markdown file to read and translate."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code. Defaults to es-ES when omitted; examples include es-MX, es-AR, and es-CO."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
        formal: z.boolean().optional().describe("Request formal Spanish register. Do not set both formal and informal."),
        informal: z.boolean().optional().describe("Request informal Spanish register. Do not set both informal and formal."),
      },
      annotations: {
        title: "Translate Markdown file",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      return handleTranslateMarkdown(params as TranslateMarkdownParams, registry, rateLimiter);
    }
  );

  registerScoredTool(
    server,
    "extract_translatable",
    {
      title: "Extract translatable Markdown text",
      description:
        "Read a Markdown file and return only the prose sections considered safe to translate, excluding code blocks and other protected structure. This is a read-only analysis tool and does not call a translation provider.",
      inputSchema: {
        filePath: z.string().min(1).describe("Path to the Markdown file to inspect for translatable sections."),
      },
      annotations: {
        title: "Extract translatable Markdown text",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      return handleExtractTranslatable(params as ExtractTranslatableParams, registry, rateLimiter);
    }
  );

  registerScoredTool(
    server,
    "translate_api_docs",
    {
      title: "Translate API documentation",
      description:
        "Read API documentation Markdown and translate prose into a Spanish dialect with documentation context for endpoints, HTTP methods, route paths, parameters, status codes, code examples, tables, lists, and technical terms. Use this for API/reference docs, not general Markdown or repository README pages. Returns translated Markdown and errors; it may call the selected translation provider under the configured rate limiter and does not modify the file.",
      inputSchema: {
        filePath: z.string().min(1).describe("Path to the API documentation Markdown file to read and translate."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code. Defaults to es-ES when omitted."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
      },
      annotations: {
        title: "Translate API documentation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      return handleTranslateApiDocs(params as TranslateApiDocsParams, registry, rateLimiter);
    }
  );

  registerScoredTool(
    server,
    "create_bilingual_doc",
    {
      title: "Create bilingual Markdown document",
      description:
        "Read a Markdown file and return a bilingual document that pairs original sections with Spanish translations. The result is returned as Markdown text; the source file is read only and not overwritten.",
      inputSchema: {
        filePath: z.string().min(1).describe("Path to the Markdown file to read and convert into a bilingual document."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code for translated sections. Defaults to es-ES when omitted."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
      },
      annotations: {
        title: "Create bilingual Markdown document",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      return handleCreateBilingualDoc(params as CreateBilingualDocParams, registry, rateLimiter);
    }
  );
}
