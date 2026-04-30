/**
 * Generic LLM provider for OpenAI-compatible, Anthropic-compatible, and
 * LM Studio native APIs.
 *
 * This is the semantic provider path for DialectOS: the provider receives the
 * full dialect/context/formality prompt and is expected to perform translation
 * plus dialect adaptation, not generic machine translation.
 */

import type { ProviderCapability, TranslateOptions, TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { fetchWithRedirects } from "../fetch-utils.js";
import { extractSentinels, restoreSentinels } from "../sentinel-extraction.js";
import { applyAgreementFixes } from "../agreement-validator.js";
import { normalizePunctuation } from "../punctuation-normalizer.js";
import { fixAccentuation } from "../accentuation.js";
import { normalizeCapitalization } from "../capitalization.js";
import { normalizeTypography } from "../typography.js";
import { applyLexicalSubstitution } from "../lexical-substitution.js";
import { applyVoseo } from "../voseo-adapter.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@dialectos/security";
import { ALL_SPANISH_DIALECTS, languageCodeSchema, getVocabularyForDialect, getSyntacticRules } from "@dialectos/types";
import type { SpanishDialect } from "@dialectos/types";

const DEFAULT_MAX_PAYLOAD_CHARS = 50000;
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

export type LLMApiFormat = "openai" | "anthropic" | "lmstudio";

export interface LLMProviderOptions {
  /** Full chat/message endpoint URL. */
  endpoint?: string;
  /** Model name understood by the configured LLM endpoint. */
  model?: string;
  /** Wire protocol to use for the configured endpoint. */
  apiFormat?: LLMApiFormat;
  /** Load an LM Studio model before native chat if it is not already loaded. */
  lmStudioJitLoad?: boolean;
  /** Optional native LM Studio load configuration. */
  lmStudioLoadConfig?: {
    context_length?: number;
    eval_batch_size?: number;
    flash_attention?: boolean;
    num_experts?: number;
    offload_kv_cache_to_gpu?: boolean;
  };
  /** Optional bearer token. Required by most hosted LLM endpoints, optional for local gateways. */
  apiKey?: string;
  /** Anthropic API version header. Only used when apiFormat is "anthropic". */
  anthropicVersion?: string;
  /** Allow localhost/private endpoint URLs for explicitly configured local LLM gateways. */
  allowLocal?: boolean;
  timeoutMs?: number;
  maxPayloadChars?: number;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  maxRequests?: number;
  windowMs?: number;
  /** Enable two-call pipeline: general Spanish grammar fix, then dialect adaptation. */
  twoCallMode?: boolean;
}

function validateLLMEndpoint(urlStr: string, allowLocal: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SecurityError("Invalid LLM endpoint URL", ErrorCode.INVALID_INPUT);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SecurityError("LLM endpoint must use http or https", ErrorCode.INVALID_INPUT);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("[fc") ||
    hostname.startsWith("[fd");

  if (isLocal && !allowLocal) {
    throw new SecurityError(
      "LLM endpoint cannot point to localhost/private addresses unless LLM_ALLOW_LOCAL=1",
      ErrorCode.INVALID_INPUT
    );
  }

  return urlStr;
}

function extractChatCompletionText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
  const content = first?.message?.content ?? first?.text;
  // Modern OpenAI responses may return content as an array of parts
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const typed = part as { type?: unknown; text?: unknown };
        if (typed.type === "text" && typeof typed.text === "string") {
          return typed.text;
        }
        // Fallback: any object with a text field
        const maybeText = typed.text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("")
      .trim();
    return text.length > 0 ? text : undefined;
  }
  if (typeof content !== "string" || content.trim().length === 0) return undefined;
  return stripReasoningTags(content.trim());
}

const REASONING_TAG_RE = /<think[\s>][\s\S]*?<\/think>|<thinking[\s>][\s\S]*?<\/thinking>|<tiz[\s>][\s\S]*?<\/tiz>/gi;

function stripReasoningTags(text: string): string {
  const stripped = text.replace(REASONING_TAG_RE, "").trim();
  return stripped.length > 0 ? stripped : text;
}

function extractAnthropicText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;

  const text = content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const maybeText = (part as { text?: unknown }).text;
      return typeof maybeText === "string" ? maybeText : "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
}

function extractLMStudioText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;

  const text = output
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const typed = item as { type?: unknown; content?: unknown };
      return typed.type === "message" && typeof typed.content === "string"
        ? typed.content
        : "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
}

function buildSystemPrompt(): string {
  return "You are a Spanish translation engine for DialectOS. Translate to the requested dialect. Output ONLY the Spanish translation — no preamble, explanations, alternatives, or English text.";
}

function buildStrictSystemPrompt(dialect?: string, text?: string): string {
  const base = "Translate to Spanish. Output ONLY the Spanish text. No English. No preamble. No explanation. Start with the first Spanish word immediately.";
  if (!dialect || !text) return base;
  const hint = buildTargetedVocabHint(text, dialect);
  return hint ? `${base}\n${hint}` : base;
}

function buildCompactSystemPrompt(): string {
  return "Translate to Spanish. Output ONLY the Spanish text. Follow the dialect vocabulary exactly. No English. No explanation.";
}

/**
 * Build a dialect-specific system prompt with targeted vocabulary hints.
 * For compact/weak models, ALL instructions and hints go in the system prompt,
 * and the user prompt contains ONLY the source text. Weak models cannot
 * reliably separate instructions from content when mixed in the user prompt.
 */
function buildDialectSystemPrompt(
  dialect: string,
  text: string,
  formality?: string
): string {
  const base = "You are a Spanish translation engine. Translate the input text to Spanish. Output ONLY the Spanish translation — no preamble, no explanation, no English. Preserve grammatical person: I → yo, you → tú/vos, he/she → él/ella, we → nosotros, they → ellos.";
  const vocabHint = buildTargetedVocabHint(text, dialect);
  const parts = [base];
  if (vocabHint) {
    parts.push(vocabHint);
  }
  if (formality && formality !== "auto") {
    parts.push(`Use ${formality} register.`);
  }
  return parts.join(" ");
}

function buildGeneralGrammarSystemPrompt(): string {
  return "You are a Spanish language editor. Your task is to produce clean, grammatically correct, standard Spanish text. If the input is in another language, translate it to Spanish. If the input is already Spanish, fix any grammar, spelling, punctuation, or syntax errors. Output ONLY the Spanish text — no preamble, explanations, alternatives, or English text.";
}

function buildDialectAdaptationSystemPrompt(): string {
  return "You are a Spanish dialect adapter. Adapt the following standard Spanish text to the requested dialect. Apply the dialect vocabulary and grammar rules exactly. Output ONLY the adapted Spanish text — no preamble, explanations, alternatives, or English text.";
}

const GARBAGE_PATTERNS = [
  /```/,
  /^\s*(translation|traducci[oó]n)\s*:/i,
  /\bhere is (a |the )?translat/i,
  /\bhere('s| is) (a |the )?(translated|spanish)\b/i,
  /\bbelow is (a |the )?translat/i,
  /\baqu[ií] (est[aá]|tienes) (la )?traducci[oó]n\b/i,
  /\bdialect quality contract\b/i,
  /\blexical ambiguity constraints\b/i,
  /\bforbidden output\b/i,
  /\btaboo policy\b/i,
  /\bdo not translate literally\b/i,
  /\bsure,? i can help/i,
  /\bokay,? i understand/i,
  /\blet'?s begin/i,
  /\bof (the |your )?(provided |given |original )?text\b/i,
  /^\s*<<<\s*$/m,
  // Weak-model hallucinations observed in benchmark runs
  /^\s*elote\s*$/i,                      // Corn hallucination for baby/strawberry/elevator
  /^\s*mazorca\s*$/i,                    // Another corn variant
  /^\s*es-[a-z]{2}\s*$/i,                // Dialect code only (es-MX, es-AR, etc.)
  /\/no_think/,                           // Qwen tag leaked into output
  /^\s*voseo\s*:/i,                       // Dialect annotation instead of translation
  /^\s*la respuesta es\s*:/i,             // Quiz-answer format
  /\bnice\s+[a-z]+\b/i,                   // Spanglish (nice casa, nice carro)
  /\bgood\s+[a-z]+\b/i,                   // Spanglish
  // Meta-instruction outputs (model tells user how to translate instead of translating)
  /\bpuede\s+decirlo\s+en\s+español\b/i,
  /\bpuedes\s+decirlo\s+en\s+español\b/i,
  /\bdilo\s+en\s+español\b/i,
  /\btraduce\s+(esto|lo siguiente)\b/i,
  // Conversational/assistant mode fragments (weak models answer instead of translate)
  /^\s*¡?Bienvenido!?\s*$/i,
  /\bEntiendo\.?\s*Estoy listo\b/i,
  // Nonsense repetition patterns
  /\bfrutill[ao]\b.*\bfrutill[ao]\b/i,
  // Known hallucinated words that never appear in valid translations
  /\bcampero\b/i,
];

// Reasoning/thinking tags emitted by qwen3 and other thinking-capable models.
const THINK_TAG_PATTERN = /<think[^>]*>[\s\S]*?<\/think\s*>/g;

// Common conversational preambles small models emit before the actual translation.
const PREAMBLE_PATTERNS: Array<[RegExp, string]> = [
  [/^[\s\S]*?(Sure,? I can help[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Okay,? I understand[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Here is (a |the )?(translated |Spanish )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Here's (a |the )?(translated |Spanish )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Below is (a |the )?[^\n]*:\s*\n+)/i, ""],
  [/^[\s\S]*?(Let me (help|translate|provide|begin)[^\n]*\n+)/i, ""],
  [/^[\s\S]*?(Let's begin[^\n]*\n+)/i, ""],
  [/^\s*<<<\s*\n/m, ""],
  [/\n\s*>>>\s*$/m, ""],
  // Spanish conversational preambles (weak models)
  [/^\s*¡?Bienvenido!?\s*\n*/i, ""],
  [/^\s*Entiendo\.?\s*Estoy listo[^\n]*\n+/i, ""],
  [/^\s*Claro,?\s*(puedo|te puedo)[^\n]*\n+/i, ""],
];

function stripPreamble(text: string): string {
  let result = text;
  // Strip reasoning/thinking tags first (qwen3, etc.)
  result = result.replace(THINK_TAG_PATTERN, "");
  for (const [pattern, replacement] of PREAMBLE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}

function isGarbageOutput(source: string, output: string): boolean {
  const trimmed = output.trim();
  if (!trimmed) return true;
  // Unchanged from source (common LLM failure)
  if (trimmed.toLowerCase() === source.trim().toLowerCase()) return true;
  // Contains garbage patterns
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Detect mostly-English output (untranslated). Heuristic: if the output has
  // no Spanish-specific characters and contains common English words, it's
  // likely untranslated. Skip very short outputs to avoid false positives.
  if (trimmed.length > 15) {
    const hasSpanishChar = /[áéíóúñ¿¡]/i.test(trimmed);
    const hasSpanishWord = /\b(el|la|un|una|los|las|es|está|son|muy|más|pero|porque|como|cuando|donde|qué|cómo|quién|cuál|este|ese|aquel|mi|tu|su|nuestro|vuestro|con|para|por|sin|sobre|entre|desde|hasta|hacia|durante|mediante|según|salvo|excepto|mismo|tal|cual|tan|tanto|todo|nada|algo|alguien|nadie|ninguno|cada|otro|mismo|propio|único|cierto|varios|todos|ambos|algunos|muchos|pocos|demasiado|bastante|mucho|poco|nada|algo|tan|tanto|cómo|cuándo|dónde|por qué|para qué)\b/i.test(trimmed);
    const commonEnglishWords = /\b(the|is|are|was|were|have|has|had|do|does|did|will|would|could|should|may|might|can|this|that|these|those|with|from|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|now|also|back|down|off|over|out|up|about|because|but|if|or|since|though|while|although|unless|until|whether|either|neither|both|and|yet|still|however|therefore|moreover|furthermore|nevertheless|otherwise|meanwhile|instead|besides|actually|probably|certainly|definitely|absolutely|completely|totally|exactly|precisely|specifically|particularly|especially|generally|usually|normally|typically|frequently|often|sometimes|occasionally|rarely|seldom|never|always|constantly|continuously|repeatedly|regularly|daily|weekly|monthly|yearly|early|late|soon|recently|already|yet|still|before|after|later|earlier|formerly|previously|currently|presently|immediately|instantly|directly|straight|slowly|quickly|rapidly|suddenly|gradually|eventually|finally|initially|originally|primarily|mainly|mostly|largely|partly|slightly|somewhat|fairly|pretty|rather|quite|very|extremely|incredibly|unbelievably|amazingly|surprisingly|remarkably|notably|significantly|substantially|considerably|greatly|deeply|strongly|weakly|hardly|barely|scarcely|nearly|almost|practically|virtually|essentially|basically|fundamentally|ultimately|absolutely|relatively|comparatively|exceptionally|extraordinarily|tremendously|enormously|hugely|vastly|widely|narrowly|closely|loosely|tightly|firmly|softly|gently|roughly|smoothly|easily|difficultly|simply|complexly|plainly|clearly|obviously|evidently|apparently|seemingly|presumably|supposedly|allegedly|reportedly|supposedly|theoretically|hypothetically|potentially|possibly|perhaps|maybe|likely|probably|presumably|undoubtedly|unquestionably|indisputably|incontrovertibly|indefinitely|permanently|temporarily|briefly|shortly|momentarily|instantaneously|simultaneously|consecutively|sequentially|successively|alternately|reciprocally|mutually|jointly|collectively|individually|separately|independently|exclusively|inclusively|collectively|altogether|entirely|wholly|fully|partially|incompletely|adequately|insufficiently|sufficiently|appropriately|properly|correctly|incorrectly|wrongly|rightly|justly|unjustly|fairly|unfairly|equally|unequally|similarly|differently|likewise|otherwise|instead|alternatively|conversely|inversely|oppositely|contrarily|contrastingly|correspondingly|accordingly|consequently|subsequently|accordingly|thus|hence|thereby|whereby|whatsoever|whatsoever|whatever|whichever|whoever|whomever|whenever|wherever|however|whyever)\b/g;
    const englishWordCount = (trimmed.match(commonEnglishWords) || []).length;
    if (!hasSpanishChar && !hasSpanishWord && englishWordCount >= 3) {
      return true;
    }
  }

  // Length ratio check: translations should be roughly similar in length to
  // the source. Wild deviations suggest hallucination or failure.
  const sourceLen = source.trim().length;
  const outputLen = trimmed.length;
  if (sourceLen > 10 && outputLen > 0) {
    const ratio = outputLen / sourceLen;
    if (ratio > 4) return true;  // Output is 4x longer than source
    if (ratio < 0.15) return true; // Output is <15% of source length
  }

  return false;
}

const SANITIZE_MAP: Array<[RegExp, string]> = [
  [/—/g, "-"],           // em-dash → hyphen
  [/–/g, "-"],           // en-dash → hyphen
  [/‘|’/g, "'"],    // smart single quotes
  [/“|”/g, '"'],    // smart double quotes
  [/€/g, "EUR"],         // € → EUR
  [/£/g, "GBP"],         // £ → GBP
  [/¥/g, "JPY"],         // ¥ → JPY
  [/…/g, "..."],         // … → ...
];

// Chat template format markers that can be abused for prompt injection
const FORMAT_INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/<\|im_start\|>\s*(system|assistant|user)\b[^<]*<\|im_end\|>/gi, ""],  // ChatML blocks
  [/<\|im_start\|>/gi, ""],           // ChatML start
  [/<\|im_end\|>/gi, ""],             // ChatML end
  [/\[INST\][\s\S]*?\[\/INST\]/gi, ""],  // Llama/Mistral blocks
  [/\[INST\]/gi, ""],                 // Llama [INST]
  [/\[\/INST\]/gi, ""],               // Llama [/INST]
  [/###\s*Instruction:/gi, ""],       // Alpaca
  [/###\s*Response:/gi, ""],          // Alpaca
  [/###\s*System:/gi, ""],            // Alpaca variant
  [/<system>[\s\S]*?<\/system>/gi, ""],   // XML-style system tags
  [/<system>/gi, ""],                 // orphan <system>
  [/<\/system>/gi, ""],               // orphan </system>
  [/<\|assistant\|>/gi, ""],          // Phi/Gemma style
  [/<\|user\|>/gi, ""],               // Phi/Gemma style
  [/<\|system\|>/gi, ""],             // Phi/Gemma style
  [/^\s*(SYSTEM|ASSISTANT|USER|INSTRUCTION)\s*:\s*/gm, ""],  // Role prefix lines
];

function stripFormatInjection(text: string): string {
  let result = text;
  for (const [pattern, replacement] of FORMAT_INJECTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeForPrompt(text: string): string {
  let result = stripFormatInjection(text);
  for (const [pattern, replacement] of SANITIZE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Detect models too small for full semantic-context prompts.
 * Models ≤ 8B params (or specified in MB) get a compact prompt that
 * skips the heavy dialect context — they echo it instead of translating.
 */
function isCompactModel(model: string): boolean {
  if (process.env.LLM_COMPACT_PROMPT === "1") return true;
  if (process.env.LLM_COMPACT_PROMPT === "0") return false;

  const lower = model.toLowerCase();
  // MiniMax M-series models are weak/compact
  if (lower.includes("minimax")) return true;
  // Effective-param markers (e.g., "e2b" = effective 2B)
  const effMatch = lower.match(/e(\d*\.?\d+)b/);
  if (effMatch && parseFloat(effMatch[1]) <= 8) return true;
  // Total-param markers (e.g., "0.6b", "1.2b", "8b")
  const paramMatch = lower.match(/(\d*\.?\d+)b/);
  if (paramMatch && parseFloat(paramMatch[1]) <= 8) return true;
  // Models specified in MB (e.g., "461M") are always compact
  if (/\d+m\b/.test(lower)) return true;
  return false;
}

/**
 * For compact models, extract only vocabulary entries whose concept or gloss
 * matches words in the source text. This avoids the 17KB+ vocabulary table
 * that overwhelms small models, while preserving dialect-critical terms.
 *
 * Scoring: exact whole-word concept match = 2 points, substring match = 1 point.
 * Only the top-scored entries (score >= 2) are included to suppress noise
 * from concepts like "usb_drive" matching on the word "drive".
 */
function buildTargetedVocabHint(text: string, dialect: string): string {
  try {
    const swaps = getVocabularyForDialect(dialect as SpanishDialect);
    const sourceLower = text.toLowerCase();
    const sourceWords = new Set(sourceLower.split(/\s+/));

    type ScoredSwap = { swap: typeof swaps[number]; score: number };
    const scored: ScoredSwap[] = [];

    for (const s of swaps) {
      if (s.avoidTerms.length === 0) continue;
      const conceptWords = s.concept.split(/[_\s]+/).filter(w => w.length > 2);
      let score = 0;

      // Exact whole-word match on concept name (highest signal)
      for (const w of conceptWords) {
        if (sourceWords.has(w)) score += 2;
        else if (sourceLower.includes(w)) score += 1;
      }

      // Tokenize englishGloss and check individual words
      if (score === 0 && s.englishGloss.length > 2) {
        const glossWords = s.englishGloss.toLowerCase().split(/[\s,;.()\/]+/).filter(w => w.length > 2);
        for (const w of glossWords) {
          if (sourceWords.has(w)) { score += 2; break; }
        }
      }

      if (score >= 2) scored.push({ swap: s, score });
    }

    if (scored.length === 0) return "";
    // Take top matches, cap at 6 to avoid overwhelming small context
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6);
    const hints = top.map(({ swap: s }) => {
      const avoid = s.avoidTerms.length > 0 ? ` (NOT ${s.avoidTerms.slice(0, 2).join(", ")})` : "";
      return `${s.concept.replace(/_/g, " ")} → ${s.preferredTerm}${avoid}`;
    }).join("; ");

    // Add grammar rules for the dialect — validate rules plus critical prompt-only ones
    const rules = getSyntacticRules(dialect as SpanishDialect);
    const grammarHints = rules
      .filter(r => r.enforcement === "validate" || r.id === "plural-address-vosotros" || r.id === "plural-address-ustedes")
      .map(r => r.rule)
      .slice(0, 3);

    const parts = [`Dialect: ${dialect}. Use: ${hints}.`];
    if (grammarHints.length > 0) {
      parts.push(grammarHints.join(" "));
    }
    return parts.join(" ");
  } catch {
    return "";
  }
}

/**
 * Build targeted grammar hints based on specific English patterns in the source.
 * Weak models often fail on ambiguous constructions; explicit rules help.
 */
function buildTargetedGrammarHint(text: string): string {
  const hints: string[] = [];
  const lower = text.toLowerCase();

  // Possessive "have" vs auxiliary "have" — weak models confuse these
  if (/\b(you|i|we|they)\s+have\s+a\b/.test(lower)) {
    hints.push('Possessive "have" (owning something) = "tener". Do not use "haber".');
  }

  // "You" at sentence start — weak models sometimes flip to first person (answering mode)
  if (/^you\b/i.test(text.trim())) {
    hints.push('Preserve "you" as tú/vos. Do not change to "yo" (I).');
  }

  // Question form — weak models sometimes answer instead of translate
  if (/^do\s+you\b/i.test(text.trim()) || /^are\s+you\b/i.test(text.trim()) || /^can\s+you\b/i.test(text.trim())) {
    hints.push('Translate the question exactly. Do not answer it.');
  }

  return hints.join(" ");
}

// Cache: dialect → Map<lowercaseConcept, preferredTerm>
const conceptCache = new Map<string, Map<string, string>>();

function getConceptMap(dialect: SpanishDialect): Map<string, string> {
  const key = dialect;
  if (conceptCache.has(key)) return conceptCache.get(key)!;
  const map = new Map<string, string>();
  const swaps = getVocabularyForDialect(dialect);
  for (const s of swaps) {
    // Only index by exact concept name to avoid false positives from gloss words
    map.set(s.concept.toLowerCase(), s.preferredTerm);
  }
  conceptCache.set(key, map);
  return map;
}

/**
 * Fix untranslated English words that appear in the output.
 * Weak models sometimes leave English nouns untranslated (e.g., "elevator").
 * Only replaces exact concept-name matches to avoid false positives.
 */
function fixUntranslatedWords(text: string, dialect: SpanishDialect): string {
  const conceptMap = getConceptMap(dialect);
  if (conceptMap.size === 0) return text;

  // Tokenize and replace words that match dictionary concepts exactly
  return text.replace(/\b([a-zA-Z]+)\b/g, (match) => {
    const lower = match.toLowerCase();
    const replacement = conceptMap.get(lower);
    if (!replacement) return match;
    // Preserve case pattern
    if (match === match.toUpperCase()) return replacement.toUpperCase();
    if (match[0] === match[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

// Cache for Spanish→hint reverse lookup
const spanishHintCache = new Map<SpanishDialect, Map<string, { concept: string; preferredTerm: string }>>();

function buildSpanishHintMap(dialect: SpanishDialect): Map<string, { concept: string; preferredTerm: string }> {
  const swaps = getVocabularyForDialect(dialect);
  const map = new Map<string, { concept: string; preferredTerm: string }>();
  for (const s of swaps) {
    for (const avoid of s.avoidTerms) {
      const key = avoid.toLowerCase();
      // Only store the first match (shorter wrong terms may be shadowed by longer ones,
      // but the lexical substitution post-processor will catch those)
      if (!map.has(key)) {
        map.set(key, { concept: s.concept, preferredTerm: s.preferredTerm });
      }
    }
  }
  return map;
}

function getSpanishHintMap(dialect: SpanishDialect): Map<string, { concept: string; preferredTerm: string }> {
  let map = spanishHintCache.get(dialect);
  if (!map) {
    map = buildSpanishHintMap(dialect);
    spanishHintCache.set(dialect, map);
  }
  return map;
}

/**
 * Build dialect vocabulary hints by scanning SPANISH text for words
 * that are wrong for the target dialect.
 *
 * This is much more effective than scanning English source text because
 * we can directly detect wrong-dialect terms in the input.
 */
function buildSpanishVocabHint(text: string, dialect: string): string {
  try {
    const hintMap = getSpanishHintMap(dialect as SpanishDialect);
    const textLower = text.toLowerCase();
    const words = new Set(textLower.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2));

    const hints: string[] = [];
    for (const word of words) {
      const entry = hintMap.get(word);
      if (entry) {
        hints.push(`${entry.concept.replace(/_/g, " ")} → ${entry.preferredTerm} (NOT ${word})`);
      }
    }

    if (hints.length === 0) return "";

    // Add grammar rules
    const rules = getSyntacticRules(dialect as SpanishDialect);
    const grammarHints = rules
      .filter(r => r.enforcement === "validate" || r.id === "plural-address-vosotros" || r.id === "plural-address-ustedes")
      .map(r => r.rule)
      .slice(0, 3);

    const parts = [`Dialect: ${dialect}. Use: ${hints.slice(0, 10).join("; ")}.`];
    if (grammarHints.length > 0) {
      parts.push(grammarHints.join(" "));
    }
    return parts.join(" ");
  } catch {
    return "";
  }
}

function buildUserPrompt(text: string, sourceLang: string, targetLang: string, options: TranslateOptions = {}, model?: string): string {
  const sanitized = sanitizeForPrompt(text);
  const compact = model ? isCompactModel(model) : false;
  const isQwen = model?.toLowerCase().includes("qwen") ?? false;
  const dialect = options.dialect || targetLang;

  // For compact/weak models, ALL instructions and vocab hints go in the
  // SYSTEM prompt (see buildDialectSystemPrompt). The user prompt must
  // contain ONLY the source text — weak models cannot separate instructions
  // from content when mixed together.
  if (compact) {
    return [
      sanitized,
      isQwen ? "/no_think" : undefined,
    ].filter(Boolean).join("\n");
  }

  // Full models can handle instructions + context in the user prompt.
  const ctx = options.context || undefined;
  const instruction = `Translate the above text to ${dialect} Spanish${options.formality && options.formality !== "auto" ? ` (${options.formality} register)` : ""}.`;

  return [
    sanitized,
    "",
    isQwen ? "/no_think" : undefined,
    instruction,
    ctx,
  ].filter(Boolean).join("\n");
}

export class LLMProvider implements TranslationProvider {
  readonly name = "llm";
  private endpoint: string;
  private model: string;
  private apiFormat: LLMApiFormat;
  private apiKey?: string;
  private anthropicVersion: string;
  private lmStudioJitLoad: boolean;
  private lmStudioLoadConfig: LLMProviderOptions["lmStudioLoadConfig"];
  private timeoutMs: number;
  private maxPayloadChars: number;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private needsApiKey: boolean;
  private allowLocal: boolean;
  private activeCount = 0;
  private maxConcurrency: number;
  private maxQueueSize: number;
  private queue: Array<() => void> = [];
  private twoCallMode: boolean;

  constructor(options: LLMProviderOptions = {}) {
    const model = options.model || process.env.LLM_MODEL || "";
    const apiFormat = options.apiFormat || process.env.LLM_API_FORMAT || "openai";
    const endpoint = options.endpoint ||
      process.env.LLM_API_URL ||
      process.env.LLM_ENDPOINT ||
      process.env.LM_STUDIO_URL ||
      (apiFormat === "lmstudio" ? "http://127.0.0.1:1234" : "");
    const allowLocal = options.allowLocal ?? (apiFormat === "lmstudio" || process.env.LLM_ALLOW_LOCAL === "1");

    if (!endpoint) {
      throw new Error("LLM_API_URL environment variable is required");
    }
    if (!model) {
      throw new Error("LLM_MODEL environment variable is required");
    }
    if (apiFormat !== "openai" && apiFormat !== "anthropic" && apiFormat !== "lmstudio") {
      throw new Error("LLM_API_FORMAT must be 'openai', 'anthropic', or 'lmstudio'");
    }

    this.allowLocal = allowLocal;
    this.endpoint = this.normalizeEndpoint(validateLLMEndpoint(endpoint, allowLocal));
    this.model = model;
    this.apiFormat = apiFormat;
    this.apiKey = options.apiKey || process.env.LLM_API_KEY;
    this.anthropicVersion = options.anthropicVersion || process.env.LLM_ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION;
    this.lmStudioJitLoad = options.lmStudioJitLoad ?? process.env.LM_STUDIO_JIT_LOAD !== "0";
    this.lmStudioLoadConfig = {
      ...this.loadConfigFromEnv(),
      ...(options.lmStudioLoadConfig || {}),
    };
    this.needsApiKey = Boolean(this.apiKey);
    this.timeoutMs = options.timeoutMs || parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || HTTP_TIMEOUT;
    this.maxPayloadChars = options.maxPayloadChars || parseInt(process.env.LLM_MAX_PAYLOAD_CHARS || "", 10) || DEFAULT_MAX_PAYLOAD_CHARS;
    this.breaker = new CircuitBreaker(options.failureThreshold || 5, options.resetTimeoutMs || 60000);
    this.rateLimiter = new RateLimiter(
      options.maxRequests || parseInt(process.env.LLM_RATE_LIMIT || "", 10) || DEFAULT_MAX_REQUESTS,
      options.windowMs || parseInt(process.env.LLM_RATE_WINDOW_MS || "", 10) || DEFAULT_WINDOW_MS
    );
    this.maxConcurrency = parseInt(process.env.LLM_MAX_CONCURRENCY || "", 10) || 1;
    this.maxQueueSize = parseInt(process.env.LLM_MAX_QUEUE || "", 10) || 10;
    this.twoCallMode = options.twoCallMode ?? process.env.LLM_TWO_CALL_MODE === "1";
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
  }

  getCapabilities(): ProviderCapability {
    return {
      name: this.name,
      displayName: "Generic LLM",
      needsApiKey: this.needsApiKey,
      supportsFormality: true,
      supportsContext: true,
      supportsDialect: true,
      supportedSourceLangs: ["auto", "en", "es"],
      supportedTargetLangs: ["es", ...ALL_SPANISH_DIALECTS],
      maxPayloadChars: this.maxPayloadChars,
      dialectHandling: "semantic",
      rateLimitHints: { maxRequests: DEFAULT_MAX_REQUESTS, windowMs: DEFAULT_WINDOW_MS },
    };
  }

  private acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error("LLM provider busy — too many pending requests. Try again later."));
    }
    return new Promise<void>((resolve, reject) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult> {
    validateContentLength(text);
    if (text.length > this.maxPayloadChars) {
      throw new Error(`Payload too large: ${text.length} chars exceeds max ${this.maxPayloadChars}`);
    }

    const sourceResult = languageCodeSchema.safeParse(sourceLang === "auto" ? "en" : sourceLang);
    const targetResult = languageCodeSchema.safeParse(targetLang.split("-")[0]);
    if (!sourceResult.success || !targetResult.success) {
      throw new SecurityError("Invalid language code", ErrorCode.INVALID_INPUT);
    }

    if (!this.breaker.canExecute()) {
      throw new Error("LLM provider is temporarily unavailable (circuit open)");
    }
    await this.rateLimiter.acquire();
    await this.acquireSlot();
    try {
      // Extract sentinels once for the whole pipeline
      const { text: strippedText, sentinels } = extractSentinels(text);

      let result: TranslationResult;
      if (this.twoCallMode) {
        result = await this._doTwoCallTranslate(strippedText, sourceLang, targetLang, options, sentinels);
      } else {
        // Attempt 1: dialect-aware system prompt for compact models (with vocab hints),
        // generic system prompt for full models (hints in user prompt).
        const dialect = options?.dialect || targetLang;
        const sysPrompt = isCompactModel(this.model)
          ? buildDialectSystemPrompt(dialect, strippedText, options?.formality)
          : buildSystemPrompt();
        result = await this._doSingleCallTranslate(strippedText, sourceLang, targetLang, options, sysPrompt, sentinels);

        // If output looks like garbage, retry once with a stricter prompt
        if (isGarbageOutput(text, result.translatedText)) {
          const retryPrompt = buildStrictSystemPrompt(dialect, strippedText);
          result = await this._doSingleCallTranslate(strippedText, sourceLang, targetLang, options, retryPrompt, sentinels);
          if (isGarbageOutput(text, result.translatedText)) {
            throw new Error("LLM produced garbage output after retry");
          }
        }
      }

      this.breaker.recordSuccess();
      return result;
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    } finally {
      this.releaseSlot();
    }
  }

  private async _callLLM(
    systemPrompt: string,
    userPrompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const headers = this.buildHeaders();
    if (this.apiFormat === "lmstudio" && this.lmStudioJitLoad) {
      await this.ensureLMStudioModelLoaded(headers, signal);
    }

    const response = await fetchWithRedirects(this.inferenceUrl(), {
      init: {
        method: "POST",
        headers,
        body: JSON.stringify(this.buildRequestBody(systemPrompt, userPrompt)),
        signal,
      },
      validateUrl: (url) => validateLLMEndpoint(url, this.allowLocal),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("Invalid response content type");
    }

    const contentLength = response.headers.get("content-length");
    const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      throw new Error("LLM response exceeds maximum allowed size");
    }

    const data = (await Promise.race([
      response.json(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Response body timed out")), this.timeoutMs);
      }),
    ])) as unknown;

    const rawText = this.extractResponseText(data);
    const translatedText = stripPreamble(rawText || "");
    if (!translatedText) {
      throw new Error("LLM response did not include translated content");
    }

    const MAX_RESPONSE_CHARS = 100_000;
    if (translatedText.length > MAX_RESPONSE_CHARS) {
      throw new Error(`LLM response too long: ${translatedText.length} chars exceeds max ${MAX_RESPONSE_CHARS}`);
    }

    return translatedText;
  }

  private async _doSingleCallTranslate(
    strippedText: string,
    sourceLang: string,
    targetLang: string,
    options: TranslateOptions | undefined,
    systemPrompt: string,
    sentinels: Map<string, string>
  ): Promise<TranslationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const userPrompt = buildUserPrompt(strippedText, sourceLang, targetLang, options, this.model);
      const translatedText = await this._callLLM(systemPrompt, userPrompt, controller.signal);
      clearTimeout(timeoutId);

      return {
        translatedText: this._runPostProcessing(translatedText, sentinels, options),
        provider: "llm",
        dialect: options?.dialect,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw new Error(sanitizeErrorMessage(error instanceof Error ? error.message : String(error)));
    }
  }

  private async _doTwoCallTranslate(
    strippedText: string,
    sourceLang: string,
    targetLang: string,
    options: TranslateOptions | undefined,
    sentinels: Map<string, string>
  ): Promise<TranslationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs * 2);

    try {
      // Call 1: General Spanish grammar fix (dialect-agnostic)
      const generalSystemPrompt = buildGeneralGrammarSystemPrompt();
      const generalUserPrompt = strippedText;
      const call1Output = await this._callLLM(generalSystemPrompt, generalUserPrompt, controller.signal);

      // Call 2: Dialect adaptation with Spanish-input vocabulary hints
      const dialect = options?.dialect || targetLang;
      const spanishHint = buildSpanishVocabHint(call1Output, dialect);

      // For compact models: put hints in system prompt, user prompt = only Spanish text
      const isCompact = isCompactModel(this.model);
      const dialectSystemPrompt = isCompact
        ? `${buildDialectAdaptationSystemPrompt()} ${spanishHint}`.trim()
        : buildDialectAdaptationSystemPrompt();
      const dialectUserPrompt = isCompact
        ? call1Output
        : [
            call1Output,
            "",
            `Adapt the above text to ${dialect} Spanish${options?.formality && options.formality !== "auto" ? ` (${options.formality} register)` : ""}.`,
            spanishHint,
          ].filter(Boolean).join("\n");

      const call2Output = await this._callLLM(dialectSystemPrompt, dialectUserPrompt, controller.signal);
      clearTimeout(timeoutId);

      return {
        translatedText: this._runPostProcessing(call2Output, sentinels, options),
        provider: "llm",
        dialect: options?.dialect,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw new Error(sanitizeErrorMessage(error instanceof Error ? error.message : String(error)));
    }
  }

  private _runPostProcessing(
    text: string,
    sentinels: Map<string, string>,
    options: TranslateOptions | undefined
  ): string {
    // Post-processing pipeline: deterministic fixes in order
    // 1. Lexical substitution (wrong-dialect → right-dialect words)
    // 2. Fix untranslated English words (weak model fallback)
    // 3. Voseo verb swap (tú → vos for voseo dialects)
    // 4. Agreement validation
    // 5. Punctuation normalization
    // 6. Accentuation correction
    // 7. Capitalization normalization
    // 8. Typography normalization
    // 9. Sentinel restoration (always last)
    const dialect = options?.dialect;
    let result = text;

    if (dialect) {
      result = applyLexicalSubstitution(result, dialect);
      result = fixUntranslatedWords(result, dialect);
      result = applyVoseo(result, dialect, options?.formality);
    }

    result = applyAgreementFixes(result);
    result = normalizePunctuation(result);
    result = fixAccentuation(result);
    result = normalizeCapitalization(result);
    result = normalizeTypography(result);
    result = restoreSentinels(result, sentinels);

    return result;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (this.apiFormat === "anthropic") {
      headers["anthropic-version"] = this.anthropicVersion;
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }
      return headers;
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildRequestBody(systemPrompt: string, userPrompt: string): Record<string, unknown> {
    if (this.apiFormat === "lmstudio") {
      return {
        model: this.model,
        system_prompt: systemPrompt,
        input: userPrompt,
        temperature: 0,
        max_output_tokens: 4096,
        store: false,
      };
    }

    if (this.apiFormat === "anthropic") {
      return {
        model: this.model,
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      };
    }

    return {
      model: this.model,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  }

  private extractResponseText(data: unknown): string | undefined {
    switch (this.apiFormat) {
      case "anthropic":
        return extractAnthropicText(data);
      case "lmstudio":
        return extractLMStudioText(data);
      default:
        return extractChatCompletionText(data);
    }
  }

  private normalizeEndpoint(endpoint: string): string {
    return this.apiFormat === "lmstudio"
      ? endpoint.replace(/\/+$/, "")
      : endpoint;
  }

  private inferenceUrl(): string {
    return this.apiFormat === "lmstudio"
      ? `${this.endpoint}/api/v1/chat`
      : this.endpoint;
  }

  private async ensureLMStudioModelLoaded(headers: Record<string, string>, signal: AbortSignal): Promise<void> {
    const listResponse = await fetch(`${this.endpoint}/api/v1/models`, {
      method: "GET",
      headers,
      signal,
    });
    if (!listResponse.ok) {
      throw new Error(`LM Studio models API error: ${listResponse.statusText}`);
    }
    const listContentType = listResponse.headers.get("content-type");
    if (!listContentType?.includes("application/json")) {
      throw new Error("Invalid LM Studio models response content type");
    }
    const listData = await listResponse.json() as { models?: Array<{ key?: string; loaded_instances?: unknown[] }> };
    const model = listData.models?.find((candidate) => candidate.key === this.model);
    if (model?.loaded_instances && model.loaded_instances.length > 0) {
      return;
    }

    const loadResponse = await fetch(`${this.endpoint}/api/v1/models/load`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        ...this.lmStudioLoadConfig,
      }),
      signal,
    });
    if (!loadResponse.ok) {
      throw new Error(`LM Studio load API error: ${loadResponse.statusText}`);
    }
  }

  private loadConfigFromEnv(): LLMProviderOptions["lmStudioLoadConfig"] {
    return {
      context_length: parseOptionalInteger(process.env.LM_STUDIO_CONTEXT_LENGTH),
      eval_batch_size: parseOptionalInteger(process.env.LM_STUDIO_EVAL_BATCH_SIZE),
      flash_attention: parseOptionalBoolean(process.env.LM_STUDIO_FLASH_ATTENTION),
      num_experts: parseOptionalInteger(process.env.LM_STUDIO_NUM_EXPERTS),
      offload_kv_cache_to_gpu: parseOptionalBoolean(process.env.LM_STUDIO_OFFLOAD_KV_CACHE_TO_GPU),
    };
  }
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}
