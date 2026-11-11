import { readFileSync } from "node:fs";
import { searchGlossary } from "@dialectos/types";
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@dialectos/markdown-parser";
import {
  validateMarkdownPath,
  validateContentLength,
  checkFileSize,
  RateLimiter,
  SecurityError,
  ErrorCode,
  createSafeError,
} from "@dialectos/security";
import {
  ProviderRegistry,
} from "@dialectos/providers";
import { ToolResult } from "../lib/types.js";
import { gateTranslation, qualityGateFailure, summarizeGate, QUALITY_GATE_FAILED } from "../lib/translation-gate.js";
import { DIALECT_METADATA, researchRegionalTermMcp, serperSearch } from "./translator-data.js";
import { detectDialect } from "./dialect-detector.js";

import type {
  TranslateTextParams,
  DetectDialectParams,
  TranslateCodeCommentParams,
  TranslateReadmeParams,
  SearchGlossaryParams,
  ListDialectsParams,
  ResearchRegionalTermParams,
  ValidateTranslationParams,
} from "./translator-types.js";

/**
 * Handle translate_text tool
 */
export async function handleTranslateText(
  params: TranslateTextParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate input
    if (!params.text || params.text.trim().length === 0) {
      throw new SecurityError("Text cannot be empty", ErrorCode.INVALID_INPUT);
    }

    validateContentLength(params.text);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    // Determine formality
    let formality: "formal" | "informal" | "auto" = "auto";
    if (params.formal) formality = "formal";
    if (params.informal) formality = "informal";

    // Translate
    const prepared = registry.prepareRequest(
      provider.name,
      params.text,
      "en",
      params.dialect || "es-ES",
      { formality, dialect: params.dialect }
    );
    const result = await provider.translate(
      params.text,
      prepared.sourceLang,
      prepared.targetLang,
      prepared.options
    );

    const gate = gateTranslation({
      source: params.text,
      translated: result.translatedText,
      dialect: params.dialect || "es-ES",
    });
    if (gate.blocking.length > 0) return qualityGateFailure(gate, prepared.warnings);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translatedText: result.translatedText,
            provider: result.provider || provider.name,
            dialect: params.dialect || "es-ES",
            warnings: prepared.warnings,
            validation: summarizeGate(gate),
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
 * Handle validate_translation tool: the same checks the CLI `validate`
 * command and the GitHub Action run, for a translation made anywhere.
 * A failing report is a normal result (valid: false), not a tool error.
 */
export async function handleValidateTranslation(
  params: ValidateTranslationParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    await rateLimiter.acquire();
    if (!params.source?.trim() || !params.translated?.trim()) {
      throw new SecurityError("source and translated cannot be empty", ErrorCode.INVALID_INPUT);
    }
    validateContentLength(params.source);
    validateContentLength(params.translated);

    // Same report the CLI `validate` command prints, unfiltered.
    const { report } = gateTranslation({
      source: params.source,
      translated: params.translated,
      dialect: params.dialect,
      isMarkdown: params.markdown ?? false,
    });
    return { content: [{ type: "text", text: JSON.stringify(report) }] };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: safeError.code, message: safeError.error }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle detect_dialect tool
 */
export async function handleDetectDialect(
  params: DetectDialectParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate input
    if (!params.text || params.text.trim().length === 0) {
      throw new SecurityError("Text cannot be empty", ErrorCode.INVALID_INPUT);
    }

    validateContentLength(params.text);

    // Detect dialect using keyword + grammar signals
    const result = detectDialect(params.text);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
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

export interface CodeComment {
  full: string;
  content: string;
  isSingleLine: boolean;
  index: number;
}

/**
 * Find `//` and `/* *\/` comments in C-family source, skipping anything
 * inside '...', "..." or `...` string literals (so a URL such as
 * "https://example.com" is never treated as a comment).
 */
export function extractCodeComments(code: string): CodeComment[] {
  const out: CodeComment[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i++;
      while (i < code.length && code[i] !== ch) {
        if (code[i] === "\\") i++;
        else if (ch !== "`" && code[i] === "\n") break; // unterminated
        i++;
      }
      i++;
      continue;
    }
    if (ch === "/" && code[i + 1] === "/") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = code.length;
      const full = code.slice(i, end);
      const content = full.slice(2).trim();
      if (content) out.push({ full, content, isSingleLine: true, index: i });
      i = end;
      continue;
    }
    if (ch === "/" && code[i + 1] === "*") {
      const close = code.indexOf("*/", i + 2);
      const end = close === -1 ? code.length : close + 2;
      const full = code.slice(i, end);
      const content = code.slice(i + 2, close === -1 ? end : close).trim();
      if (content) out.push({ full, content, isSingleLine: false, index: i });
      i = end;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * Handle translate_code_comment tool
 */
export async function handleTranslateCodeComment(
  params: TranslateCodeCommentParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate input
    if (!params.code || params.code.trim().length === 0) {
      throw new SecurityError("Code cannot be empty", ErrorCode.INVALID_INPUT);
    }

    validateContentLength(params.code);

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    const comments = extractCodeComments(params.code).filter((c) =>
      /\b(the|and|is|in|at|of|for|with|to)\b/i.test(c.content)
    );

    // Translate each comment sequentially
    let commentsTranslated = 0;
    const errors: string[] = [];
    const warnings = new Set<string>();
    const replacements: Array<{ index: number; length: number; translated: string }> = [];

    for (const comment of comments) {
      try {
        const prepared = registry.prepareRequest(
          provider.name,
          comment.content,
          "en",
          params.dialect || "es-ES",
          { context: "code comment", dialect: params.dialect }
        );
        prepared.warnings.forEach((w) => warnings.add(w));
        const result = await provider.translate(
          comment.content,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );
        const gate = gateTranslation({
          source: comment.content,
          translated: result.translatedText,
          dialect: params.dialect || "es-ES",
        });
        if (gate.blocking.length > 0) {
          errors.push(`comment@${comment.index}: ${QUALITY_GATE_FAILED}: ${gate.blocking.join("; ")}`);
          continue;
        }

        const translated = comment.isSingleLine
          ? `// ${result.translatedText}`
          : `/* ${result.translatedText} */`;

        replacements.push({ index: comment.index, length: comment.full.length, translated });
        commentsTranslated++;
      } catch (error) {
        const safe = createSafeError(error);
        errors.push(`comment@${comment.index}: ${safe.error}`);
      }
    }

    // Splice by position, last first, so earlier indices stay valid and an
    // identical comment elsewhere in the file is never hit by mistake.
    let translatedCode = params.code;
    for (const r of [...replacements].sort((a, b) => b.index - a.index)) {
      translatedCode =
        translatedCode.slice(0, r.index) + r.translated + translatedCode.slice(r.index + r.length);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translatedCode,
            commentsTranslated,
            errors,
            skippedCount: errors.length,
            warnings: [...warnings],
          }),
        },
      ],
      isError: commentsTranslated === 0 && comments.length > 0 && errors.length > 0,
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
 * Handle translate_readme tool
 */
export async function handleTranslateReadme(
  params: TranslateReadmeParams,
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
    const translatedSections = [];
    const errors: string[] = [];
    const warnings = new Set<string>();
    let codeBlocksPreserved = 0;
    let sectionsTranslated = 0;

    for (const section of parsed.sections) {
      if (!section.translatable) {
        translatedSections.push(section);
        if (section.type === "code") {
          codeBlocksPreserved++;
        }
      } else {
        try {
          const prepared = registry.prepareRequest(
            provider.name,
            section.content,
            "en",
            params.dialect || "es-ES",
            { formality, dialect: params.dialect }
          );
          prepared.warnings.forEach((w) => warnings.add(w));
          const result = await provider.translate(
            section.content,
            prepared.sourceLang,
            prepared.targetLang,
            prepared.options
          );
          const gate = gateTranslation({
            source: section.content,
            translated: result.translatedText,
            dialect: params.dialect || "es-ES",
            isMarkdown: true,
          });
          if (gate.blocking.length > 0) {
            errors.push(`${section.type}: ${QUALITY_GATE_FAILED}: ${gate.blocking.join("; ")}`);
            translatedSections.push(section);
            continue;
          }

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
            codeBlocksPreserved,
            errors,
            warnings: [...warnings],
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
 * Handle search_glossary tool
 */
export async function handleSearchGlossary(
  params: SearchGlossaryParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate input
    if (!params.query || params.query.trim().length === 0) {
      throw new SecurityError("Query cannot be empty", ErrorCode.INVALID_INPUT);
    }

    // Search canonical shared glossary
    const results = searchGlossary(params.query);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            results,
            count: results.length,
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
 * Handle research_regional_term tool
 */
export async function handleResearchRegionalTerm(
  params: ResearchRegionalTermParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    await rateLimiter.acquire();
    validateContentLength(params.concept);
    const result = await researchRegionalTermMcp(params, process.env.SERPER_API_KEY ? serperSearch : undefined);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: safeError.code, message: safeError.error }) }],
      isError: true,
    };
  }
}

/**
 * Handle list_dialects tool
 */
export async function handleListDialects(
  _params: ListDialectsParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    const dialects = DIALECT_METADATA.map((d) => ({
      code: d.code,
      name: d.name,
      description: d.description,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            dialects,
            count: dialects.length,
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
