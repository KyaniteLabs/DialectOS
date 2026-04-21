import { z } from "zod";

// ============================================================================
// Spanish Dialect Types
// ============================================================================

/**
 * All 25 Spanish dialect codes following BCP 47 standard
 * Covers all Spanish-speaking countries and major territories
 */
export type SpanishDialect =
  | "es-ES" | "es-MX" | "es-AR" | "es-CO" | "es-CU"
  | "es-PE" | "es-CL" | "es-VE" | "es-UY" | "es-PY"
  | "es-BO" | "es-EC" | "es-GT" | "es-HN" | "es-SV"
  | "es-NI" | "es-CR" | "es-PA" | "es-DO" | "es-PR"
  | "es-GQ" | "es-US" | "es-PH" | "es-BZ" | "es-AD";

/**
 * Dialect metadata with name and description
 * Consolidated from traductor-mcp
 */
export interface DialectInfo {
  code: SpanishDialect;
  name: string;
  description: string;
}

/**
 * All 25 Spanish dialects as a constant array
 */
export const ALL_SPANISH_DIALECTS: SpanishDialect[] = [
  "es-ES", "es-MX", "es-AR", "es-CO", "es-CU",
  "es-PE", "es-CL", "es-VE", "es-UY", "es-PY",
  "es-BO", "es-EC", "es-GT", "es-HN", "es-SV",
  "es-NI", "es-CR", "es-PA", "es-DO", "es-PR",
  "es-GQ", "es-US", "es-PH", "es-BZ", "es-AD",
];

/**
 * Default Spanish dialect (Castilian Spanish from Spain)
 */
export const DEFAULT_DIALECT: SpanishDialect = "es-ES";

// ============================================================================
// Translation Provider Types
// ============================================================================

/**
 * Supported translation providers
 */
export type ProviderName = "deepl" | "deepl-free" | "libre" | "mymemory";

/**
 * Translation options
 */
export interface TranslateOptions {
  /** Formality level for languages that distinguish formal/informal address */
  formality?: "formal" | "informal" | "auto";
  /** Additional context to help with translation accuracy */
  context?: string;
  /** Specific dialect variant (e.g., "es-MX" for Mexican Spanish) */
  dialect?: SpanishDialect;
}

/**
 * Translation provider interface
 * All translation providers must implement this interface
 */
export interface TranslationProvider {
  /** Unique provider name */
  readonly name: string;

  /**
   * Translate text from source language to target language
   * @param text - Text to translate
   * @param sourceLang - Source language code (e.g., "en", "es", "auto" for auto-detect)
   * @param targetLang - Target language code (e.g., "en", "es")
   * @param options - Optional translation parameters
   * @returns Promise resolving to translation result
   */
  translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult>;

  /**
   * Return capability metadata for this provider.
   * Used for capability negotiation and early validation.
   */
  getCapabilities?(): ProviderCapability;
}

/**
 * Provider capability metadata
 * Used for capability negotiation and request validation
 */
export interface ProviderCapability {
  /** Unique provider name */
  name: string;
  /** Display name for UI purposes */
  displayName: string;
  /** Whether provider requires API key */
  needsApiKey: boolean;
  /** Whether provider supports formality option */
  supportsFormality: boolean;
  /** Whether provider supports context option */
  supportsContext: boolean;
  /** Whether provider supports dialect option */
  supportsDialect: boolean;
  /** Supported source language codes */
  supportedSourceLangs: string[];
  /** Supported target language codes */
  supportedTargetLangs: string[];
  /** Maximum payload size in characters */
  maxPayloadChars: number;
  /** How the provider handles dialect variants */
  dialectHandling: "native" | "approximate" | "none";
  /** Rate limit hints (requests per window) */
  rateLimitHints?: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * @deprecated Use ProviderCapability instead
 */
export interface ProviderMetadata extends ProviderCapability {}

// ============================================================================
// Translation Request/Result Types
// ============================================================================

/**
 * Translation request parameters
 * Consolidated from traductor-mcp
 */
export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  dialect?: SpanishDialect;
  formality?: FormalityLevel;
  context?: string;
  provider?: ProviderName;
}

/**
 * Translation result
 * Consolidated from traductor-mcp
 */
export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  detectedSourceLang?: string; // Alias for detectedLanguage for compatibility
  provider?: ProviderName;
  dialect?: SpanishDialect;
  confidence?: number; // Confidence score of the translation (0-1, if available)
}

// ============================================================================
// Formality Types
// ============================================================================

/**
 * Formality level for translations
 * Consolidated from traductor-mcp
 */
export type FormalityLevel = "formal" | "informal" | "auto";

/**
 * DeepL's formality parameter values
 * Consolidated from traductor-mcp
 */
export type DeepLFormality = "more" | "less" | "default";

/**
 * Maps our formality levels to DeepL's formality parameter
 * Consolidated from traductor-mcp
 */
export const DEEPL_FORMALITY_MAP: Record<FormalityLevel, DeepLFormality> = {
  formal: "more",
  informal: "less",
  auto: "default",
};

// ============================================================================
// I18n Types
// ============================================================================

/**
 * A single i18n key-value pair
 * Consolidated from i18n-espanol-mcp
 */
export interface I18nEntry {
  key: string;
  value: string;
}

/**
 * Result of comparing two locale files
 * Consolidated from i18n-espanol-mcp
 */
export interface LocaleDiff {
  missingInTarget: string[];
  extraInTarget: string[];
  commonKeys: string[];
}

/**
 * Formality issue found during audit
 * Consolidated from i18n-espanol-mcp
 */
export interface FormalityIssue {
  key: string;
  value: string;
  suggestion: string;
}

// ============================================================================
// Gender Neutral Types
// ============================================================================

/**
 * Gender-neutral language strategies
 * Consolidated from i18n-espanol-mcp
 */
export type GenderNeutralStrategy = "latine" | "elles" | "x" | "descriptive";

/**
 * Variant creation result
 * Consolidated from i18n-espanol-mcp
 */
export interface VariantResult {
  adapted: boolean;
  changes: string[];
}

/**
 * Batch translation result
 * Consolidated from i18n-espanol-mcp
 */
export interface BatchTranslationResult {
  directory: string;
  baseLocale: string;
  targets: SpanishDialect[];
  totalKeys: number;
  totalTranslated: number;
  errors: string[];
}

// ============================================================================
// Markdown Types
// ============================================================================

/**
 * Markdown section types
 * Consolidated from docs-espanol-mcp
 */
export type MarkdownSectionType =
  | "heading"
  | "paragraph"
  | "code"
  | "table"
  | "list"
  | "blockquote"
  | "html"
  | "horizontal-rule";

/**
 * A markdown section extracted for translation
 * Consolidated from docs-espanol-mcp
 */
export interface MarkdownSection {
  type: MarkdownSectionType;
  content: string;
  raw: string;
  translatable: boolean;
}

/**
 * Result of parsing markdown into sections
 * Consolidated from docs-espanol-mcp
 */
export interface ParsedMarkdown {
  sections: MarkdownSection[];
  translatableSections: number;
  codeBlockCount: number;
  linkCount: number;
}

/**
 * Result of translating a markdown document
 * Consolidated from docs-espanol-mcp
 */
export interface TranslatedMarkdown {
  translated: string;
  sectionsProcessed: number;
  codeBlocksPreserved: number;
  linksPreserved: number;
}

// ============================================================================
// Glossary Types
// ============================================================================

/**
 * Glossary entry for technical terms
 * Consolidated from traductor-mcp
 */
export interface GlossaryEntry {
  term: string;
  translation: string;
  category?: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Validates language codes (e.g., "en", "es-ES")
 * Format: 2-letter language code, optionally followed by hyphen and 2-letter country code
 */
export const languageCodeSchema = z.string().min(1).regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
  message: "Invalid language code format. Expected format: 'en' or 'en-US'",
});

/**
 * Validates Spanish dialect codes (all 25 supported dialects)
 */
export const dialectSchema = z.enum([
  "es-ES", "es-MX", "es-AR", "es-CO", "es-CU",
  "es-PE", "es-CL", "es-VE", "es-UY", "es-PY",
  "es-BO", "es-EC", "es-GT", "es-HN", "es-SV",
  "es-NI", "es-CR", "es-PA", "es-DO", "es-PR",
  "es-GQ", "es-US", "es-PH", "es-BZ", "es-AD",
], {
  errorMap: () => ({ message: "Invalid Spanish dialect code" }),
});

/**
 * Validates translation provider names
 */
export const providerNameSchema = z.enum(["deepl", "deepl-free", "libre", "mymemory"], {
  errorMap: () => ({ message: "Invalid translation provider" }),
});

/**
 * Validates formality levels
 */
export const formalitySchema = z.enum(["formal", "informal", "auto"], {
  errorMap: () => ({ message: "Invalid formality level" }),
});

/**
 * Validates complete translation requests
 * All required string fields must have at least 1 character
 */
export const translationRequestSchema = z.object({
  text: z.string().min(1, "Text cannot be empty"),
  sourceLang: languageCodeSchema,
  targetLang: languageCodeSchema,
  dialect: dialectSchema.optional(),
  formality: formalitySchema.optional(),
  context: z.string().min(1).optional(),
  provider: providerNameSchema.optional(),
});

/**
 * Validates batch translation target arrays
 * Must have at least 1 dialect and at most 25 dialects
 */
export const batchTargetsSchema = z.array(dialectSchema).min(1, "At least one target dialect is required").max(25, "Cannot exceed 25 target dialects");
