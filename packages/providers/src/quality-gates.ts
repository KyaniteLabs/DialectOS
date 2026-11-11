/**
 * Quality Gates — adaptive validation layer for translation outputs
 *
 * Gates detect problems. They do NOT fix them.
 * A gate failure triggers retry; a gate pass emits telemetry.
 *
 * Gates are tier-dependent: strong models skip expensive gates.
 */

import type { SpanishDialect } from "@dialectos/types";
import { validateDialectCompliance, negationDropped } from "@dialectos/types";
import { GARBAGE_PATTERNS, COMMON_ENGLISH_WORDS } from "./data/garbage-patterns.js";

export type ModelTier = "tiny" | "small" | "medium" | "large";

export interface QualityGateResult {
  name: string;
  passed: boolean;
  details?: string;
}

export interface QualityGateContext {
  sourceText: string;
  translatedText: string;
  dialect: SpanishDialect;
  modelTier: ModelTier;
}

export type QualityGate = (
  context: QualityGateContext
) => QualityGateResult | Promise<QualityGateResult>;

// ============================================================================
// Cheap gates (run for all tiers where applicable)
// ============================================================================

/**
 * Length sanity check: output should be within reasonable bounds of source.
 */
export function lengthSanityCheck(context: QualityGateContext): QualityGateResult {
  const { sourceText, translatedText } = context;
  const srcLen = sourceText.trim().length;
  const outLen = translatedText.trim().length;

  if (srcLen === 0) {
    return { name: "lengthSanity", passed: true };
  }

  const ratio = outLen / srcLen;

  if (ratio > 4) {
    return {
      name: "lengthSanity",
      passed: false,
      details: `Output ${outLen} chars is ${ratio.toFixed(1)}x source length (max 4x)`,
    };
  }

  if (ratio < 0.15 && srcLen > 10) {
    return {
      name: "lengthSanity",
      passed: false,
      details: `Output ${outLen} chars is ${(ratio * 100).toFixed(0)}% of source (min 15%)`,
    };
  }

  return { name: "lengthSanity", passed: true };
}

/**
 * Dialect compliance check: verify correct dialect terms using the full dictionary.
 * Delegates to validateDialectCompliance from @dialectos/types for thoroughness.
 */
export function dialectComplianceCheck(context: QualityGateContext): QualityGateResult {
  const { sourceText, translatedText, dialect } = context;

  try {
    const result = validateDialectCompliance(sourceText, translatedText, dialect);
    if (!result.passed && result.violations.length > 0) {
      const v = result.violations[0];
      return {
        name: "dialectCompliance",
        passed: false,
        details: `${v.message} (and ${result.violations.length - 1} more)`,
      };
    }
  } catch (e) {
    // If dictionary lookup fails, we cannot verify compliance — fail the gate explicitly
    return {
      name: "dialectCompliance",
      passed: false,
      details: `Dictionary lookup failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { name: "dialectCompliance", passed: true };
}

// ============================================================================
// Garbage pattern detection (moved from LLMProvider)
// ============================================================================


/**
 * Short strings with no English function words ("Total", "Hotel", "Email",
 * "Chat") are often spelled the same in Spanish; returning them unchanged is
 * a correct translation, not garbage.
 */
function isLikelyCognate(source: string): boolean {
  const wordCount = source.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 3) return false;
  return (source.match(COMMON_ENGLISH_WORDS) || []).length === 0;
}

/**
 * Garbage pattern check: detect empty output, unchanged source, garbage patterns,
 * mostly-English output, and wild length deviations.
 */
export function garbagePatternCheck(context: QualityGateContext): QualityGateResult {
  const { sourceText, translatedText } = context;
  const trimmed = translatedText.trim();
  const source = sourceText.trim();

  if (!trimmed) {
    return { name: "garbagePattern", passed: false, details: "Empty output" };
  }

  if (trimmed.toLowerCase() === source.toLowerCase() && !isLikelyCognate(source)) {
    return { name: "garbagePattern", passed: false, details: "Output unchanged from source" };
  }

  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { name: "garbagePattern", passed: false, details: `Garbage pattern matched: ${pattern.source}` };
    }
  }

  if (trimmed.length > 15) {
    const hasSpanishChar = /[áéíóúñ¿¡]/i.test(trimmed);
    const hasSpanishWord =
      /\b(el|la|un|una|los|las|es|está|son|muy|más|pero|porque|como|cuando|donde|qué|cómo|quién|cuál|este|ese|aquel|mi|tu|su|nuestro|vuestro|con|para|por|sin|sobre|entre|desde|hasta|hacia|durante|mediante|según|salvo|excepto|mismo|tal|cual|tan|tanto|todo|nada|algo|alguien|nadie|ninguno|cada|otro|mismo|propio|único|cierto|varios|todos|ambos|algunos|muchos|pocos|demasiado|bastante|mucho|poco|nada|algo|tan|tanto|cómo|cuándo|dónde|por qué|para qué)\b/i.test(trimmed);
    const englishWordCount = (trimmed.match(COMMON_ENGLISH_WORDS) || []).length;
    if (!hasSpanishChar && !hasSpanishWord && englishWordCount >= 3) {
      return { name: "garbagePattern", passed: false, details: "Mostly English output (untranslated)" };
    }
  }

  const sourceLen = source.length;
  const outputLen = trimmed.length;
  if (sourceLen > 10 && outputLen > 0) {
    const ratio = outputLen / sourceLen;
    if (ratio > 4) {
      return { name: "garbagePattern", passed: false, details: `Output ${outputLen} chars is ${ratio.toFixed(1)}x source length` };
    }
    if (ratio < 0.15) {
      return { name: "garbagePattern", passed: false, details: `Output ${outputLen} chars is ${(ratio * 100).toFixed(0)}% of source` };
    }
  }

  return { name: "garbagePattern", passed: true };
}

// ============================================================================
// Gates for tiny/small models only
// ============================================================================

/**
 * Person consistency check: detect "You" → "Yo" flips.
 */
export function personConsistencyCheck(context: QualityGateContext): QualityGateResult {
  const { sourceText, translatedText } = context;
  const srcLower = sourceText.trim().toLowerCase();
  const outLower = translatedText.trim().toLowerCase();

  // Source starts with "You" (second person)
  const sourceIsYou = /^\s*you\b/i.test(sourceText);

  // Output starts with "Yo" (first person) — this is the flip
  const outputIsYo = /^\s*yo\b/i.test(translatedText);

  if (sourceIsYou && outputIsYo) {
    return {
      name: "personConsistency",
      passed: false,
      details: `Source "You..." translated as "Yo..." (person flip)`,
    };
  }

  // Also catch "Tú" → "Yo" or "Usted" → "Yo"
  if (sourceIsYou && /^\s*yo\b/i.test(translatedText)) {
    return {
      name: "personConsistency",
      passed: false,
      details: `Source "You..." translated as first person`,
    };
  }

  return { name: "personConsistency", passed: true };
}

/**
 * Haber vs tener check: detect possessive "have" mapped to auxiliary "haber".
 */
export function haberTenerCheck(context: QualityGateContext): QualityGateResult {
  const { sourceText, translatedText } = context;
  const srcLower = sourceText.trim().toLowerCase();
  const outLower = translatedText.trim().toLowerCase();

  // Source is "You have a [noun]" (possessive)
  const possessiveHave = /\byou\s+have\s+a\b/i.test(sourceText);

  // Output uses "has/has" (auxiliary haber) instead of "tienes/tiene" (possessive tener)
  const usesHaber = /\b(te\s+has\s+dado|has\s+dado|te\s+ha\s+dado|ha\s+dado)\b/i.test(translatedText);

  if (possessiveHave && usesHaber) {
    return {
      name: "haberTener",
      passed: false,
      details: `Possessive "have" mistranslated as auxiliary "haber"`,
    };
  }

  return { name: "haberTener", passed: true };
}

/**
 * Negation preservation: "You must not delete the file" -> "Debes eliminar el
 * archivo" inverts the instruction. Runs on every tier.
 */
export function negationPreservationCheck(context: QualityGateContext): QualityGateResult {
  if (negationDropped(context.sourceText, context.translatedText)) {
    return {
      name: "negationPreservation",
      passed: false,
      details: "Source negates but the translation has no Spanish negator (no, nunca, sin, ...)",
    };
  }
  return { name: "negationPreservation", passed: true };
}

// ============================================================================
// Gate registry
// ============================================================================

interface GateConfig {
  gate: QualityGate;
  tiers: ModelTier[];
}

const GATE_REGISTRY: GateConfig[] = [
  { gate: garbagePatternCheck, tiers: ["tiny", "small", "medium", "large"] },
  { gate: lengthSanityCheck, tiers: ["tiny", "small", "medium", "large"] },
  { gate: dialectComplianceCheck, tiers: ["tiny", "small", "medium", "large"] },
  { gate: negationPreservationCheck, tiers: ["tiny", "small", "medium", "large"] },
  { gate: personConsistencyCheck, tiers: ["tiny", "small"] },
  { gate: haberTenerCheck, tiers: ["tiny", "small"] },
];

/**
 * Run all quality gates applicable to the given model tier.
 */
export async function runQualityGates(
  context: QualityGateContext
): Promise<QualityGateResult[]> {
  const results: QualityGateResult[] = [];

  for (const config of GATE_REGISTRY) {
    if (!config.tiers.includes(context.modelTier)) {
      continue;
    }

    try {
      const result = await config.gate(context);
      results.push(result);
    } catch (error) {
      results.push({
        name: config.gate.name,
        passed: false, // A gate that cannot run cannot vouch for the output: fail closed
        details: `Gate error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return results;
}
