/**
 * LLM prompt construction for translation and dialect adaptation.
 *
 * Builds system and user prompts tailored to model capability tiers,
 * from compact (≤8B params) to full-size models. Compact models get
 * all instructions and vocabulary hints in the system prompt with a
 * bare source-text user prompt; full models handle mixed user prompts.
 */

import { getVocabularyForDialect, getSyntacticRules } from "@dialectos/types";
import type { SpanishDialect } from "@dialectos/types";
import type { TranslateOptions } from "../types.js";
import { sanitizeForPrompt } from "./llm-response.js";

// ---------------------------------------------------------------------------
// Model capability detection
// ---------------------------------------------------------------------------

/**
 * Detect models too small for full semantic-context prompts.
 * Models ≤ 8B active/effective params get a compact prompt that
 * skips the heavy dialect context — they echo it instead of translating.
 */
export function isCompactModel(model: string | undefined): boolean {
  if (!model) return false;
  if (process.env.LLM_COMPACT_PROMPT === "1") return true;
  if (process.env.LLM_COMPACT_PROMPT === "0") return false;

  const lower = model.toLowerCase();
  // MiniMax M-series models are weak/compact
  if (lower.includes("minimax")) return true;
  // MoE names (including Liquid LFM) specify active parameters as "A1B".
  const activeMatch = lower.match(/(?:^|[-_/:])a(\d*\.?\d+)b\b/);
  if (activeMatch) return parseFloat(activeMatch[1]) <= 8;
  // Effective-param markers (e.g. "e2b" = effective 2B)
  const effMatch = lower.match(/e(\d*\.?\d+)b/);
  if (effMatch && parseFloat(effMatch[1]) <= 8) return true;
  // Total-param markers (e.g. "0.6b", "1.2b", "8b")
  const paramMatch = lower.match(/(\d*\.?\d+)b/);
  if (paramMatch && parseFloat(paramMatch[1]) <= 8) return true;
  // Million-parameter counts must use the same threshold as billion counts.
  const millionMatch = lower.match(/(\d*\.?\d+)m\b/);
  if (millionMatch) return parseFloat(millionMatch[1]) <= 8000;
  return false;
}

/**
 * Classify a model into a capability tier used by quality gates.
 */
export function detectModelTier(model: string | undefined): "tiny" | "small" | "medium" | "large" {
  if (!model) return "large";
  if (process.env.LLM_COMPACT_PROMPT === "1") return "small";
  if (process.env.LLM_COMPACT_PROMPT === "0") return "large";

  const lower = model.toLowerCase();
  if (lower.includes("minimax")) return "small";
  const activeMatch = lower.match(/(?:^|[-_/:])a(\d*\.?\d+)b\b/);
  if (activeMatch) {
    const params = parseFloat(activeMatch[1]);
    if (params <= 1) return "tiny";
    if (params <= 8) return "small";
    return "medium";
  }
  const millionMatch = lower.match(/(\d*\.?\d+)m\b/);
  if (millionMatch) {
    const params = parseFloat(millionMatch[1]) / 1000;
    if (params <= 1) return "tiny";
    if (params <= 8) return "small";
    return "medium";
  }

  const effMatch = lower.match(/e(\d*\.?\d+)b/);
  if (effMatch) {
    const params = parseFloat(effMatch[1]);
    if (params <= 1) return "tiny";
    if (params <= 8) return "small";
    return "medium";
  }

  const paramMatch = lower.match(/(\d*\.?\d+)b/);
  if (paramMatch) {
    const params = parseFloat(paramMatch[1]);
    if (params <= 1) return "tiny";
    if (params <= 8) return "small";
    return "medium";
  }

  return "large";
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

/**
 * Default system prompt for full-size models.
 * Dialect instructions go in the user prompt for full models.
 */
export function buildSystemPrompt(): string {
  return "You are a Spanish translation engine for DialectOS. Translate to the requested dialect. Output ONLY the Spanish translation — no preamble, explanations, alternatives, or English text.";
}

/**
 * Strict retry prompt used when quality gates fail on the first attempt.
 */
export function buildStrictSystemPrompt(dialect: string, text: string): string {
  const base = "Translate to Spanish. Output ONLY the Spanish text. No English. No preamble. No explanation. Start with the first Spanish word immediately.";
  if (!dialect || !text) return base;
  const hint = buildTargetedVocabHint(text, dialect);
  return hint ? `${base}\n${hint}` : base;
}

/**
 * Dialect-specific system prompt with targeted vocabulary hints.
 * Used for compact/weak models where ALL instructions must live in the
 * system prompt — the user prompt contains ONLY the source text.
 */
export function buildDialectSystemPrompt(
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

/**
 * System prompt for the first call in two-call mode: general Spanish
 * grammar fix, dialect-agnostic.
 */
export function buildGeneralGrammarSystemPrompt(): string {
  return "You are a Spanish language editor. Your task is to produce clean, grammatically correct, standard Spanish text. If the input is in another language, translate it to Spanish. If the input is already Spanish, fix any grammar, spelling, punctuation, or syntax errors. Output ONLY the Spanish text — no preamble, explanations, alternatives, or English text.";
}

/**
 * System prompt for the second call in two-call mode: dialect adaptation
 * of standard Spanish text.
 */
export function buildDialectAdaptationSystemPrompt(): string {
  return "You are a Spanish dialect adapter. Adapt the following standard Spanish text to the requested dialect. Apply the dialect vocabulary and grammar rules exactly. Output ONLY the adapted Spanish text — no preamble, explanations, alternatives, or English text.";
}

// ---------------------------------------------------------------------------
// Vocabulary hint builders
// ---------------------------------------------------------------------------

/**
 * For compact models, extract only vocabulary entries whose concept or gloss
 * matches words in the source text. This avoids the 17KB+ vocabulary table
 * that overwhelms small models, while preserving dialect-critical terms.
 *
 * Scoring: exact whole-word concept match = 2 points, substring match = 1 point.
 * Only the top-scored entries (score >= 2) are included to suppress noise.
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

      for (const w of conceptWords) {
        if (sourceWords.has(w)) score += 2;
        else if (sourceLower.includes(w)) score += 1;
      }

      if (score === 0 && s.englishGloss.length > 2) {
        const glossWords = s.englishGloss.toLowerCase().split(/[\s,;.()\/]+/).filter(w => w.length > 2);
        for (const w of glossWords) {
          if (sourceWords.has(w)) { score += 2; break; }
        }
      }

      if (score >= 2) scored.push({ swap: s, score });
    }

    if (scored.length === 0) return "";
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6);
    const hints = top.map(({ swap: s }) => {
      const avoid = s.avoidTerms.length > 0 ? ` (NOT ${s.avoidTerms.slice(0, 2).join(", ")})` : "";
      return `${s.concept.replace(/_/g, " ")} → ${s.preferredTerm}${avoid}`;
    }).join("; ");

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

  if (/\b(you|i|we|they)\s+have\s+a\b/.test(lower)) {
    hints.push('Possessive "have" (owning something) = "tener". Do not use "haber".');
  }

  if (/^you\b/i.test(text.trim())) {
    hints.push('Preserve "you" as tú/vos. Do not change to "yo" (I).');
  }

  if (/^do\s+you\b/i.test(text.trim()) || /^are\s+you\b/i.test(text.trim()) || /^can\s+you\b/i.test(text.trim())) {
    hints.push('Translate the question exactly. Do not answer it.');
  }

  return hints.join(" ");
}

// Cache for Spanish→hint reverse lookup
const spanishHintCache = new Map<SpanishDialect, Map<string, { concept: string; preferredTerm: string }>>();

function buildSpanishHintMap(dialect: SpanishDialect): Map<string, { concept: string; preferredTerm: string }> {
  const swaps = getVocabularyForDialect(dialect);
  const map = new Map<string, { concept: string; preferredTerm: string }>();
  for (const s of swaps) {
    for (const avoid of s.avoidTerms) {
      const key = avoid.toLowerCase();
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
 * that are wrong for the target dialect. This is much more effective
 * than scanning English source text because we can directly detect
 * wrong-dialect terms in the input.
 */
export function buildSpanishVocabHint(text: string, dialect: string): string {
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

// ---------------------------------------------------------------------------
// User prompt
// ---------------------------------------------------------------------------

/**
 * Build the user-facing prompt that accompanies the source text.
 * For compact models, returns ONLY the source text (all instructions
 * are in the system prompt). For full models, appends translation
 * instructions and optional context.
 */
export function buildUserPrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
  options: TranslateOptions = {},
  model?: string
): string {
  const sanitized = sanitizeForPrompt(text);
  const compact = model ? isCompactModel(model) : false;
  // Keep controls family-specific; do not assume LFM supports Qwen's /no_think.
  const isQwen = model?.toLowerCase().includes("qwen") ?? false;
  const dialect = options.dialect || targetLang;

  // Compact models: system prompt has all instructions, user prompt is bare text
  if (compact) {
    return [
      sanitized,
      isQwen ? "/no_think" : undefined,
    ].filter(Boolean).join("\n");
  }

  // Full models: mix instructions + context in user prompt
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
