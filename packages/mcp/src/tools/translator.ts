/**
 * MCP Tools for Translation
 *
 * Provides 6 MCP tools:
 * - translate_text: Translate text to Spanish dialect
 * - detect_dialect: Detect Spanish dialect from text
 * - translate_code_comment: Translate code comments (basic, text extraction)
 * - translate_readme: Translate a README markdown file
 * - search_glossary: Search the built-in glossary
 * - list_dialects: List all Spanish dialects with metadata
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type {
  SpanishDialect,
  ProviderName,
} from "@espanol/types";
import { searchGlossary } from "@espanol/types";
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@espanol/markdown-parser";
import {
  validateMarkdownPath,
  validateContentLength,
  RateLimiter,
  SecurityError,
  ErrorCode,
  createSafeError,
} from "@espanol/security";
import {
  ProviderRegistry,
} from "@espanol/providers";
import { ToolResult } from "../lib/types.js";
import { createProviderRegistry } from "../lib/provider-factory.js";
import { prepareProviderRequest } from "../lib/provider-request.js";

// ============================================================================
// Types
// ============================================================================

interface TranslateTextParams {
  text: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
  formal?: boolean;
  informal?: boolean;
}

interface DetectDialectParams {
  text: string;
}

interface TranslateCodeCommentParams {
  code: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
}

interface TranslateReadmeParams {
  filePath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
  formal?: boolean;
  informal?: boolean;
}

interface SearchGlossaryParams {
  query: string;
}

interface ListDialectsParams {}

// ============================================================================
// Dialect Metadata
// ============================================================================

/**
 * Metadata for all 25 Spanish dialects with detection keywords
 */
const DIALECT_METADATA: Array<{
  code: SpanishDialect;
  name: string;
  description: string;
  keywords: string[];
}> = [
  {
    code: "es-ES",
    name: "Castilian Spanish (Spain)",
    description: "Standard Spanish from Spain, using vosotros for informal plural",
    keywords: [
      "vosotros",
      "vosotras",
      "ordenador",
      "coche",
      "patata",
      "autobús",
      "apartamento",
      "bao",
      "vale",
    ],
  },
  {
    code: "es-MX",
    name: "Mexican Spanish",
    description: "Spanish spoken in Mexico",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "camión",
      "departamento",
      "órale",
      "chingado",
      "wey",
      "neta",
      "aquí",
    ],
  },
  {
    code: "es-AR",
    name: "Rioplatense Spanish (Argentina)",
    description: "Spanish spoken in Argentina and Uruguay, using voseo",
    keywords: [
      "vos",
      "computadora",
      "auto",
      "papa",
      "colectivo",
      "departamento",
      "che",
      "boludo",
      "mina",
      "laburo",
      "plata",
    ],
  },
  {
    code: "es-CO",
    name: "Colombian Spanish",
    description: "Spanish spoken in Colombia",
    keywords: [
      "computador",
      "carro",
      "papa",
      "bus",
      "apartamento",
      "qué más",
      "parcero",
      "chino",
      "rumba",
      "bacano",
    ],
  },
  {
    code: "es-CU",
    name: "Cuban Spanish",
    description: "Spanish spoken in Cuba",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "guagua",
      "asere",
      "yuma",
      "jinetero",
      "acere",
      "ma",
      "añá",
    ],
  },
  {
    code: "es-PE",
    name: "Peruvian Spanish",
    description: "Spanish spoken in Peru",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "pata",
      "causa",
      "chévere",
      "bro",
      "al toque",
    ],
  },
  {
    code: "es-CL",
    name: "Chilean Spanish",
    description: "Spanish spoken in Chile",
    keywords: [
      "computador",
      "auto",
      "papa",
      "micro",
      "departamento",
      "wea",
      "po",
      "cachái",
      "hueón",
      "bakán",
    ],
  },
  {
    code: "es-VE",
    name: "Venezuelan Spanish",
    description: "Spanish spoken in Venezuela",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "chamo",
      "burda",
      "guara",
      "pana",
      "chévere",
    ],
  },
  {
    code: "es-UY",
    name: "Uruguayan Spanish",
    description: "Spanish spoken in Uruguay",
    keywords: [
      "vos",
      "computadora",
      "auto",
      "papa",
      "colectivo",
      "departamento",
      "che",
      "bo",
      "ta",
      "laburo",
    ],
  },
  {
    code: "es-PY",
    name: "Paraguayan Spanish",
    description: "Spanish spoken in Paraguay",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "che",
      "vos",
      "mbarete",
      "jaha",
      "vy'a",
    ],
  },
  {
    code: "es-BO",
    name: "Bolivian Spanish",
    description: "Spanish spoken in Bolivia",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "wawa",
      "chal",
      "puchero",
      "sullca",
      "joven",
    ],
  },
  {
    code: "es-EC",
    name: "Ecuadorian Spanish",
    description: "Spanish spoken in Ecuador",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "chévere",
      "pana",
      "bacán",
      "chazo",
      "tío",
    ],
  },
  {
    code: "es-GT",
    name: "Guatemalan Spanish",
    description: "Spanish spoken in Guatemala",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "clavo",
      "pisto",
      "chucho",
      "cobarde",
    ],
  },
  {
    code: "es-HN",
    name: "Honduran Spanish",
    description: "Spanish spoken in Honduras",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "cheque",
      "maña",
      "puchería",
      "chunche",
    ],
  },
  {
    code: "es-SV",
    name: "Salvadoran Spanish",
    description: "Spanish spoken in El Salvador",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "chévere",
      "bicho",
      "puchado",
      "chero",
    ],
  },
  {
    code: "es-NI",
    name: "Nicaraguan Spanish",
    description: "Spanish spoken in Nicaragua",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "chévere",
      "tuanis",
      "arre",
      "jalado",
    ],
  },
  {
    code: "es-CR",
    name: "Costa Rican Spanish",
    description: "Spanish spoken in Costa Rica",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "pura vida",
      "mae",
      "tuanis",
      "brete",
    ],
  },
  {
    code: "es-PA",
    name: "Panamanian Spanish",
    description: "Spanish spoken in Panama",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "chévere",
      "culillo",
      "pilin",
      "yeye",
    ],
  },
  {
    code: "es-DO",
    name: "Dominican Spanish",
    description: "Spanish spoken in Dominican Republic",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "tiguere",
      "dime",
      "concho",
      "qué lo qué",
    ],
  },
  {
    code: "es-PR",
    name: "Puerto Rican Spanish",
    description: "Spanish spoken in Puerto Rico",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "guagua",
      "apartamento",
      "vos",
      "cabra",
      "pichar",
      "janguear",
      "broki",
    ],
  },
  {
    code: "es-GQ",
    name: "Equatoguinean Spanish",
    description: "Spanish spoken in Equatorial Guinea",
    keywords: ["guineano", "malabo", "bubi", "fang", "annobón", "bioko", "ñame", "fufú"],
  },
  {
    code: "es-US",
    name: "U.S. Spanish",
    description: "Spanish spoken in the United States by Chicano and heritage communities",
    keywords: ["troca", "parquear", "lonche", "wacha", "cholo", "vato", "carnal", "neta"],
  },
  {
    code: "es-PH",
    name: "Philippine Spanish",
    description: "Spanish and Chavacano-influenced Spanish from the Philippines",
    keywords: ["jendeh", "kame", "kita", "quilaya", "tamén", "onde", "conele", "vusos"],
  },
  {
    code: "es-BZ",
    name: "Belizean Spanish",
    description: "Spanish spoken in Belize",
    keywords: ["beliceño", "kriol", "garífuna", "cayos", "mestizo", "criollo", "dangriga", "mopan"],
  },
  {
    code: "es-AD",
    name: "Andorran Spanish",
    description: "Catalan-influenced Spanish from Andorra",
    keywords: ["andorrano", "canillo", "escaldes", "encamp", "ordino", "massana", "pirineo", "andorra"],
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle translate_text tool
 */
async function handleTranslateText(
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
      : registry.getAuto();

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
async function handleDetectDialect(
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

    // Search for dialect keywords
    const lowerText = params.text.toLowerCase();
    const scores: Array<{ dialect: SpanishDialect; score: number; keywords: string[] }> = [];

    for (const dialect of DIALECT_METADATA) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of dialect.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score++;
          matchedKeywords.push(keyword);
        }
      }

      if (score > 0) {
        scores.push({
          dialect: dialect.code,
          score,
          keywords: matchedKeywords,
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return best match or default
    const bestMatch = scores[0];
    // 3 keyword matches = 100% confidence
    const CONFIDENCE_NORMALIZER = 3;
    const confidence = bestMatch ? Math.min(bestMatch.score / CONFIDENCE_NORMALIZER, 1) : 0;
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
async function handleTranslateCodeComment(
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
      : registry.getAuto();

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
async function handleTranslateReadme(
  params: TranslateReadmeParams,
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
    const translatedSections = [];
    let codeBlocksPreserved = 0;

    for (const section of parsed.sections) {
      if (!section.translatable) {
        translatedSections.push(section);
        if (section.type === "code") {
          codeBlocksPreserved++;
        }
      } else {
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
            codeBlocksPreserved,
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
 * Handle search_glossary tool
 */
async function handleSearchGlossary(
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
 * Handle list_dialects tool
 */
async function handleListDialects(
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

// ============================================================================
// Tool Registration
// ============================================================================

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
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
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
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
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
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (llm, deepl, libre, mymemory)"),
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
