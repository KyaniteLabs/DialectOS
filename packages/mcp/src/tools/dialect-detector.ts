/**
 * Pure dialect detection logic (keywords + grammar).
 *
 * Exported so the benchmark runner and handlers can share the same algorithm.
 */

import { DIALECT_METADATA } from "./translator-data.js";
import {
  detectGrammarSignals,
  getGrammarFamily,
  type GrammarSignals,
} from "./grammar-detector.js";

/* ------------------------------------------------------------------ */
/*  IDF-weighted keyword scoring                                       */
/* ------------------------------------------------------------------ */

const totalDialects = DIALECT_METADATA.length;

const KEYWORD_FREQ = (() => {
  const freq = new Map<string, number>();
  for (const d of DIALECT_METADATA) {
    for (const k of d.keywords) {
      const key = k.toLowerCase();
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  return freq;
})();

const KEYWORD_WEIGHTS = (() => {
  const weights = new Map<string, number>();
  for (const [kw, count] of KEYWORD_FREQ) {
    weights.set(kw, Math.log(totalDialects / count));
  }
  return weights;
})();

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

/** Pre-compiled regexes for each keyword using Unicode word boundaries.
 *  Prevents substring false-positives (e.g. "po" inside "poco", "ta" inside "prestas").
 */
const KEYWORD_REGEXES = (() => {
  const map = new Map<string, RegExp>();
  for (const d of DIALECT_METADATA) {
    for (const k of d.keywords) {
      if (!map.has(k)) {
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        map.set(k, new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu"));
      }
    }
  }
  return map;
})();

/* ------------------------------------------------------------------ */
/*  Grammar scoring constants                                          */
/* ------------------------------------------------------------------ */

const GRAMMAR_MAX_BOOST = 3.0;
const GRAMMAR_WEIGHT = 0.6;

interface ScoredDialect {
  dialect: string;
  keywordScore: number;
  grammarBoost: number;
  combinedScore: number;
  confidence: number;
  keywords: string[];
}

export interface DetectionResult {
  dialect: string;
  confidence: number;
  name: string;
  matchedKeywords: string[];
  ambiguity?: string;
}

function getVoseoWeight(dialect: string): number {
  switch (dialect) {
    case "es-AR":
    case "es-UY":
    case "es-PY":
      return 0.75; // core Rioplatense
    case "es-BO":
    case "es-NI":
    case "es-CR":
    case "es-GT":
    case "es-HN":
    case "es-SV":
    case "es-PA":
      return 0.65; // full voseo
    case "es-EC":
      return 0.45; // partial voseo
    default:
      return 0; // non-voseo
  }
}

/**
 * Detect the Spanish dialect of a text using keyword + grammar signals.
 */
export function detectDialect(text: string): DetectionResult {
  const scores = scoreAllDialects(text);
  return pickBestDialect(scores);
}

/**
 * Score all dialects for a text. Returns sorted array (best first).
 * Useful for benchmark top-N evaluation.
 */
export function scoreAllDialects(text: string): ScoredDialect[] {
  const grammarSignals = detectGrammarSignals(text);
  const scores: ScoredDialect[] = [];

  for (const dialect of DIALECT_METADATA) {
    let keywordScore = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of dialect.keywords) {
      const re = KEYWORD_REGEXES.get(keyword)!;
      if (re.test(text)) {
        keywordScore += KEYWORD_WEIGHTS.get(keyword.toLowerCase()) || 0;
        matchedKeywords.push(keyword);
      }
    }

    let grammarBoost = 0;

    // Voseo boost
    if (grammarSignals.voseo > 0) {
      const voseoWeight = getVoseoWeight(dialect.code);
      if (voseoWeight > 0) {
        grammarBoost += grammarSignals.voseo * voseoWeight;
      }
    }

    // Vosotros boost
    if (grammarSignals.vosotros > 0 && dialect.code === "es-ES") {
      grammarBoost += grammarSignals.vosotros * 0.9;
    }

    // Leísmo boost
    if (grammarSignals.leismo > 0 && dialect.code === "es-ES") {
      grammarBoost += grammarSignals.leismo * 0.3;
    }

    // Diminutive boost (Mexico is notably high)
    if (grammarSignals.diminutives > 0 && dialect.code === "es-MX") {
      grammarBoost += Math.min(grammarSignals.diminutives * 0.2, 0.8);
    }

    // Tú pronoun boost for tuteo dialects
    if (grammarSignals.tuPronoun > 0 && getGrammarFamily(dialect.code) === "tuteo") {
      grammarBoost += grammarSignals.tuPronoun * 0.15;
    }

    grammarBoost = Math.min(grammarBoost, GRAMMAR_MAX_BOOST);
    const combinedScore = keywordScore + grammarBoost * GRAMMAR_WEIGHT;
    const keywordPotential = DIALECT_POTENTIAL.get(dialect.code) || 1;
    const combinedPotential = keywordPotential + GRAMMAR_MAX_BOOST * GRAMMAR_WEIGHT;
    const confidence = Math.min(combinedScore / combinedPotential, 1);

    if (combinedScore > 0) {
      scores.push({
        dialect: dialect.code,
        keywordScore,
        grammarBoost,
        combinedScore,
        confidence,
        keywords: matchedKeywords,
      });
    }
  }

  // Sort by combined score descending
  scores.sort((a, b) => b.combinedScore - a.combinedScore);

  return scores;
}

function pickBestDialect(scores: ScoredDialect[]): DetectionResult {
  if (scores.length === 0) {
    return {
      dialect: "es-ES",
      confidence: 0,
      name: "Spanish",
      matchedKeywords: [],
    };
  }

  // Ambiguity check: if second-best is within 10% of top,
  // and they do NOT share the same grammar family, reject as ambiguous.
  if (
    scores.length >= 2 &&
    scores[1].combinedScore >= 0.9 * scores[0].combinedScore
  ) {
    const family0 = getGrammarFamily(scores[0].dialect);
    const family1 = getGrammarFamily(scores[1].dialect);
    const bothGrammarOnly =
      scores[0].keywordScore === 0 && scores[1].keywordScore === 0;

    const sameFamilyBypass =
      family0 !== null &&
      family0 === family1 &&
      bothGrammarOnly;

    if (!sameFamilyBypass) {
      return {
        dialect: "es-ES",
        confidence: 0,
        name: "Spanish",
        matchedKeywords: [],
        ambiguity: `Input contains conflicting dialect markers (${scores[0].dialect} vs ${scores[1].dialect})`,
      };
    }
  }

  const bestMatch = scores[0];
  const dialectInfo = DIALECT_METADATA.find((d) => d.code === bestMatch.dialect);

  return {
    dialect: bestMatch.dialect,
    confidence: bestMatch.confidence,
    name: dialectInfo?.name || "Spanish",
    matchedKeywords: bestMatch.keywords,
  };
}
