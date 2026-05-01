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
import { prepareProviderRequest } from "../lib/provider-request.js";
import { DIALECT_METADATA, researchRegionalTermMcp, serperSearch } from "./translator-data.js";

/* ------------------------------------------------------------------ */
/*  IDF-weighted dialect detection helpers                           */
/* ------------------------------------------------------------------ */

/** Map<lowercaseKeyword, weight> where weight = ln(totalDialects / freq) */
const KEYWORD_WEIGHTS = (() => {
  const totalDialects = DIALECT_METADATA.length;
  const freq = new Map<string, number>();
  for (const d of DIALECT_METADATA) {
    for (const k of d.keywords) {
      const key = k.toLowerCase();
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  const weights = new Map<string, number>();
  for (const [kw, count] of freq) {
    weights.set(kw, Math.log(totalDialects / count));
  }
  return weights;
})();

/** Maximum possible weighted score for each dialect (sum of all its keyword weights) */
const DIALECT_POTENTIAL = (() => {
  const map = new Map<string, number>();
  for (const d of DIALECT_METADATA) {
    let sum = 0;
    for (const k of d.keywords) {
      sum += KEYWORD_WEIGHTS.get(k.toLowerCase()) || 0;
    }
    map.set(d.code, sum);
  }
  return map;
})();

import type {
  TranslateTextParams,
  DetectDialectParams,
  TranslateCodeCommentParams,
  TranslateReadmeParams,
  SearchGlossaryParams,
  ListDialectsParams,
  ResearchRegionalTermParams,
} from "./translator-types.js";

interface ScoredDialect {
  dialect: string;
  rawScore: number;
  confidence: number;
  keywords: string[];
}

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
    const prepared = prepareProviderRequest(
      registry,
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

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translatedText: result.translatedText,
            provider: result.provider || provider.name,
            dialect: params.dialect || "es-ES",
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

    // Search for dialect keywords using IDF-weighted scoring
    const lowerText = params.text.toLowerCase();
    const scores: ScoredDialect[] = [];

    for (const dialect of DIALECT_METADATA) {
      let rawScore = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of dialect.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (lowerText.includes(lowerKeyword)) {
          rawScore += KEYWORD_WEIGHTS.get(lowerKeyword) || 0;
          matchedKeywords.push(keyword);
        }
      }

      if (rawScore > 0) {
        const potential = DIALECT_POTENTIAL.get(dialect.code) || 1;
        scores.push({
          dialect: dialect.code,
          rawScore,
          confidence: Math.min(rawScore / potential, 1),
          keywords: matchedKeywords,
        });
      }
    }

    // Sort by raw weighted score descending
    scores.sort((a, b) => b.rawScore - a.rawScore);

    // Reject ambiguous inputs: if the second-best dialect is within 10% of
    // the top raw score, the input contains conflicting dialect markers.
    if (scores.length >= 2 && scores[1].rawScore >= 0.9 * scores[0].rawScore) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              dialect: "es-ES",
              confidence: 0,
              name: "Spanish",
              matchedKeywords: [],
              ambiguity: `Input contains conflicting dialect markers (${scores[0].dialect} vs ${scores[1].dialect})`,
            }),
          },
        ],
      };
    }

    // Return best match or default
    const bestMatch = scores[0];
    const confidence = bestMatch ? bestMatch.confidence : 0;
    const detectedDialect = bestMatch ? bestMatch.dialect : "es-ES";
    const matchedKeywords = bestMatch ? bestMatch.keywords : [];
    const dialectInfo = DIALECT_METADATA.find((d) => d.code === detectedDialect);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            dialect: detectedDialect,
            confidence,
            name: dialectInfo?.name || "Spanish",
            matchedKeywords,
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

    // Collect all comment matches with their positions
    interface CommentMatch {
      full: string;
      content: string;
      isSingleLine: boolean;
      index: number;
    }

    const comments: CommentMatch[] = [];
    const singleLineRegex = /\/\/(.*)$/gm;
    const multiLineRegex = /\/\*([\s\S]*?)\*\//g;

    let match: RegExpExecArray | null;
    while ((match = singleLineRegex.exec(params.code)) !== null) {
      const content = match[1].trim();
      if (content.length > 0 && /\b(the|and|is|in|at|of|for|with|to)\b/i.test(content)) {
        comments.push({ full: match[0], content, isSingleLine: true, index: match.index });
      }
    }

    while ((match = multiLineRegex.exec(params.code)) !== null) {
      const content = match[1].trim();
      if (content.length > 0 && /\b(the|and|is|in|at|of|for|with|to)\b/i.test(content)) {
        comments.push({ full: match[0], content, isSingleLine: false, index: match.index });
      }
    }

    // Translate each comment sequentially
    let commentsTranslated = 0;
    const errors: string[] = [];
    const replacements: Array<{ original: string; translated: string }> = [];

    for (const comment of comments) {
      try {
        const prepared = prepareProviderRequest(
          registry,
          provider.name,
          comment.content,
          "en",
          params.dialect || "es-ES",
          { context: "code comment", dialect: params.dialect }
        );
        const result = await provider.translate(
          comment.content,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );

        const translated = comment.isSingleLine
          ? `// ${result.translatedText}`
          : `/* ${result.translatedText} */`;

        replacements.push({ original: comment.full, translated });
        commentsTranslated++;
      } catch (error) {
        const safe = createSafeError(error);
        errors.push(`comment@${comment.index}: ${safe.error}`);
      }
    }

    // Apply replacements in reverse order to preserve indices
    let translatedCode = params.code;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { original, translated } = replacements[i];
      translatedCode = translatedCode.replace(original, translated);
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
