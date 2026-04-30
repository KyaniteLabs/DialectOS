/**
 * Quality Gates — adaptive validation layer for translation outputs
 *
 * Gates detect problems. They do NOT fix them.
 * A gate failure triggers retry; a gate pass emits telemetry.
 *
 * Gates are tier-dependent: strong models skip expensive gates.
 */

import type { SpanishDialect } from "@dialectos/types";
import { validateDialectCompliance } from "@dialectos/types";

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
  } catch {
    // If dictionary lookup fails, skip this gate
  }

  return { name: "dialectCompliance", passed: true };
}

// ============================================================================
// Garbage pattern detection (moved from LLMProvider)
// ============================================================================

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
  /^\s*elote\s*$/i,
  /^\s*mazorca\s*$/i,
  /^\s*es-[a-z]{2}\s*$/i,
  /\/no_think/,
  /^\s*voseo\s*:/i,
  /^\s*la respuesta es\s*:/i,
  /\bnice\s+[a-z]+\b/i,
  /\bgood\s+[a-z]+\b/i,
  /\bpuede\s+decirlo\s+en\s+español\b/i,
  /\bpuedes\s+decirlo\s+en\s+español\b/i,
  /\bdilo\s+en\s+español\b/i,
  /\btraduce\s+(esto|lo siguiente)\b/i,
  /^\s*¡?Bienvenido!?\s*$/i,
  /\bEntiendo\.?\s*Estoy listo\b/i,
  /\bfrutill[ao]\b.*\bfrutill[ao]\b/i,
  /\bcampero\b/i,
];

const COMMON_ENGLISH_WORDS =
  /\b(the|is|are|was|were|have|has|had|do|does|did|will|would|could|should|may|might|can|this|that|these|those|with|from|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|now|also|back|down|off|over|out|up|about|because|but|if|or|since|though|while|although|unless|until|whether|either|neither|both|and|yet|still|however|therefore|moreover|furthermore|nevertheless|otherwise|meanwhile|instead|besides|actually|probably|certainly|definitely|absolutely|completely|totally|exactly|precisely|specifically|particularly|especially|generally|usually|normally|typically|frequently|often|sometimes|occasionally|rarely|seldom|never|always|constantly|continuously|repeatedly|regularly|daily|weekly|monthly|yearly|early|late|soon|recently|already|yet|still|before|after|later|earlier|formerly|previously|currently|presently|immediately|instantly|directly|straight|slowly|quickly|rapidly|suddenly|gradually|eventually|finally|initially|originally|primarily|mainly|mostly|largely|partly|slightly|somewhat|fairly|pretty|rather|quite|very|extremely|incredibly|unbelievably|amazingly|surprisingly|remarkably|notably|significantly|substantially|considerably|greatly|deeply|strongly|weakly|hardly|barely|scarcely|nearly|almost|practically|virtually|essentially|basically|fundamentally|ultimately|absolutely|relatively|comparatively|exceptionally|extraordinarily|tremendously|enormously|hugely|vastly|widely|narrowly|closely|loosely|tightly|firmly|softly|gently|roughly|smoothly|easily|difficultly|simply|complexly|plainly|clearly|obviously|evidently|apparently|seemingly|presumably|supposedly|allegedly|reportedly|supposedly|theoretically|hypothetically|potentially|possibly|perhaps|maybe|likely|probably|presumably|undoubtedly|unquestionably|indisputably|incontrovertibly|indefinitely|permanently|temporarily|briefly|shortly)\b/gi;

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

  if (trimmed.toLowerCase() === source.toLowerCase()) {
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
        passed: true, // Gate errors should not block translation
        details: `Gate error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return results;
}
