/**
 * Semantic backstop for borderline heuristic scores (0.35–0.6).
 *
 * When the primary heuristic scorer returns a borderline result, this module
 * provides additional lightweight checks to help decide whether the translation
 * is semantically adequate.
 *
 * Checks performed:
 * 1. Negation preservation — ensures "not" / "no" / "nunca" are not dropped or flipped
 * 2. Keyword overlap — content-word overlap using frequency-weighted matching
 * 3. Structural parity — sentence count ratio, paragraph count ratio
 */

import { calculateSemanticSimilarity } from "./semantic-similarity.js";

export interface BackstopResult {
  /** Whether the backstop considers the translation adequate */
  adequate: boolean;
  /** Overall backstop score (0–1) */
  score: number;
  /** Individual check results */
  checks: {
    negationPreservation: number;
    keywordOverlap: number;
    structuralParity: number;
  };
}

const NEGATION_WORDS_EN = new Set([
  "not", "no", "never", "nothing", "nobody", "nowhere", "neither", "nor",
  "none", "without", "lack", "absent", "refuse", "deny", "decline",
  "reject", "prevent", "avoid", "stop", "cease", "cannot",
]);

const NEGATION_WORDS_ES = new Set([
  "no", "nunca", "jamás", "nada", "nadie", "ninguno", "ninguna", "ningún",
  "ni", "sin", "falta", "ausente", "rechazar", "negar", "rehusar",
  "evitar", "impedir", "detener", "parar", "carecer",
]);

/** English stop words to filter out from keyword extraction */
const STOP_WORDS_EN = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "and", "but", "or", "yet", "so", "if",
  "because", "although", "though", "while", "where", "when", "that",
  "which", "who", "whom", "whose", "what", "this", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "its", "our", "their", "mine",
  "yours", "hers", "ours", "theirs", "myself", "yourself", "himself",
  "herself", "itself", "ourselves", "yourselves", "themselves",
]);

/** Spanish stop words */
const STOP_WORDS_ES = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del",
  "al", "y", "o", "pero", "a", "en", "con", "por", "para", "sin",
  "sobre", "entre", "hasta", "desde", "hacia", "durante", "mediante",
  "según", "ante", "bajo", "contra", "hasta", "excepto", "salvo",
  "es", "son", "fue", "fueron", "ser", "estar", "está", "están",
  "estuvo", "estuvieron", "ha", "han", "había", "habían", "tengo",
  "tiene", "tienen", "tuve", "tuvieron", "hago", "hace", "hacen",
  "hice", "hicieron", "voy", "va", "van", "fui", "fueron", "doy",
  "da", "dan", "di", "dieron", "soy", "eres", "es", "somos", "son",
  "que", "quien", "cual", "cuales", "cuyo", "cuya", "donde", "cuando",
  "como", "cuanto", "cuanta", "este", "esta", "esto", "ese", "esa",
  "eso", "aquel", "aquella", "aquello", "mío", "tuyo", "suyo", "nuestro",
  "vuestra", "mí", "ti", "sí", "mismo", "misma", "tan", "tanto", "tal",
  "muy", "más", "menos", "poco", "mucho", "tanto", "todo", "toda",
  "todos", "todas", "cada", "otro", "otra", "otros", "otras", "mismo",
  "misma", "mismos", "mismas", "tal", "tales", "alguno", "alguna",
  "algunos", "algunas", "ninguno", "ninguna", "uno", "una", "unos",
  "unas", "varios", "varias", "demasiado", "demasiada", "bastante",
  "casi", "apenas", "solo", "sólo", "también", "tampoco", "sí",
  "no", "nunca", "jamás", "ya", "aún", "todavía", "ahora", "entonces",
  "después", "antes", "luego", "pronto", "siempre", "nunca",
]);

function normalizeText(text: string): string {
  return (text ?? "").normalize("NFC");
}

function isNegationWord(word: string, lang: "en" | "es"): boolean {
  const set = lang === "en" ? NEGATION_WORDS_EN : NEGATION_WORDS_ES;
  return set.has(word.toLowerCase());
}

function extractContentWords(text: string, lang: "en" | "es"): string[] {
  const stopWords = lang === "en" ? STOP_WORDS_EN : STOP_WORDS_ES;
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

function expandContractions(text: string): string {
  // Expand common English negation contractions BEFORE stripping punctuation
  return text
    .replace(/\bcan't\b/gi, "can not")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bdon't\b/gi, "do not")
    .replace(/\bdoesn't\b/gi, "does not")
    .replace(/\bdidn't\b/gi, "did not")
    .replace(/\bisn't\b/gi, "is not")
    .replace(/\baren't\b/gi, "are not")
    .replace(/\bwasn't\b/gi, "was not")
    .replace(/\bweren't\b/gi, "were not")
    .replace(/\bhaven't\b/gi, "have not")
    .replace(/\bhasn't\b/gi, "has not")
    .replace(/\bhadn't\b/gi, "had not")
    .replace(/\bwouldn't\b/gi, "would not")
    .replace(/\bcouldn't\b/gi, "could not")
    .replace(/\bshouldn't\b/gi, "should not")
    .replace(/\bmightn't\b/gi, "might not")
    .replace(/\bmustn't\b/gi, "must not")
    .replace(/\bshan't\b/gi, "shall not")
    .replace(/\bneedn't\b/gi, "need not");
}

function countNegations(text: string, lang: "en" | "es"): number {
  let processed = normalizeText(text).toLowerCase();
  if (lang === "en") {
    processed = expandContractions(processed);
  }
  const words = processed
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.filter((w) => isNegationWord(w, lang)).length;
}

function computeKeywordOverlap(sourceWords: string[], translatedWords: string[]): number {
  if (sourceWords.length === 0 && translatedWords.length === 0) return 1;
  if (sourceWords.length === 0 || translatedWords.length === 0) return 0;

  const sourceSet = new Set(sourceWords);
  const translatedSet = new Set(translatedWords);

  let matches = 0;
  for (const word of sourceSet) {
    if (translatedSet.has(word)) {
      matches++;
    }
  }

  // Jaccard-like overlap: intersection / union
  const union = new Set([...sourceSet, ...translatedSet]);
  return matches / union.size;
}

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "sra", "st", "jr",
  "etc", "eg", "ie", "vs", "vol", "vols", "inc", "ltd", "corp",
  "am", "pm", "ej",
]);

const PROTECT = "\uE000";

function protectAbbreviations(text: string): string {
  return normalizeText(text)
    .replace(/\bp\.\s*ej\./gi, `p${PROTECT} ej${PROTECT}`)
    .replace(/\be\.g\./gi, `e${PROTECT}g${PROTECT}`)
    .replace(/\bi\.e\./gi, `i${PROTECT}e${PROTECT}`)
    .replace(/\ba\.m\./gi, `a${PROTECT}m${PROTECT}`)
    .replace(/\bp\.m\./gi, `p${PROTECT}m${PROTECT}`);
}

function restoreAbbreviations(text: string): string {
  return text.replace(new RegExp(PROTECT, "g"), ".");
}

function splitSentences(text: string): string[] {
  let protectedText = protectAbbreviations(text);
  for (const abbr of ABBREVIATIONS) {
    const regex = new RegExp(`\\b${abbr.replace(/\./g, "\\.")}\\.`, "giu");
    protectedText = protectedText.replace(regex, (match) => match.replace(/\./g, PROTECT));
  }
  return protectedText
    .split(/[.!?]+/)
    .map((s) => restoreAbbreviations(s).trim())
    .filter((s) => s.length > 0);
}

function computeStructuralParity(source: string, translated: string): number {
  const sourceSentences = splitSentences(source);
  const translatedSentences = splitSentences(translated);

  const sourceParagraphs = source.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const translatedParagraphs = translated.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // If one side is empty and the other is not, structural parity is 0
  const sourceEmpty = sourceSentences.length === 0 && sourceParagraphs.length === 0;
  const translatedEmpty = translatedSentences.length === 0 && translatedParagraphs.length === 0;
  if ((sourceEmpty && !translatedEmpty) || (!sourceEmpty && translatedEmpty)) {
    return 0;
  }

  const sentenceRatio = sourceSentences.length > 0
    ? translatedSentences.length / sourceSentences.length
    : 1;
  const paragraphRatio = sourceParagraphs.length > 0
    ? translatedParagraphs.length / sourceParagraphs.length
    : 1;

  // Penalize if sentence count changes by more than 50%
  const sentenceScore = sentenceRatio >= 0.5 && sentenceRatio <= 1.5 ? 1 : Math.max(0, 1 - Math.abs(1 - sentenceRatio));
  const paragraphScore = paragraphRatio >= 0.5 && paragraphRatio <= 1.5 ? 1 : Math.max(0, 1 - Math.abs(1 - paragraphRatio));

  return (sentenceScore + paragraphScore) / 2;
}

/**
 * Run the semantic backstop on a borderline translation.
 *
 * @param source — original source text
 * @param translated — translated output
 * @param heuristicScore — the primary heuristic score (should be 0.35–0.6)
 * @returns BackstopResult with adequacy judgment
 */
export function runSemanticBackstop(
  source: string,
  translated: string,
  heuristicScore: number
): BackstopResult {
  // Guard against null/undefined inputs
  const safeSource = source ?? "";
  const safeTranslated = translated ?? "";

  // Negation preservation: compare negation counts
  const sourceNegations = countNegations(safeSource, "en");
  const translatedNegations = countNegations(safeTranslated, "es");
  // If source has negations, translated should too. Allow for some variation.
  let negationPreservation: number;
  if (sourceNegations === 0 && translatedNegations === 0) {
    negationPreservation = 1;
  } else if (sourceNegations > 0 && translatedNegations === 0) {
    negationPreservation = 0; // Dropped negations = critical failure
  } else if (sourceNegations === 0 && translatedNegations > 0) {
    negationPreservation = 0.5; // Added negations = suspicious
  } else {
    const ratio = Math.min(sourceNegations, translatedNegations) / Math.max(sourceNegations, translatedNegations);
    negationPreservation = ratio;
  }

  // Keyword overlap on content words
  const sourceWords = extractContentWords(safeSource, "en");
  const translatedWords = extractContentWords(safeTranslated, "es");
  const keywordOverlap = computeKeywordOverlap(sourceWords, translatedWords);

  // Structural parity
  const structuralParity = computeStructuralParity(safeSource, safeTranslated);

  // Weighted backstop score
  // Negation is critical (40%), keywords matter (40%), structure is a signal (20%)
  const backstopScore =
    negationPreservation * 0.4 +
    keywordOverlap * 0.4 +
    structuralParity * 0.2;

  // Adequacy decision: if backstopScore >= 0.55, consider adequate
  // For very borderline heuristic scores (< 0.45), require higher backstop
  const threshold = heuristicScore < 0.45 ? 0.6 : 0.55;
  const adequate = backstopScore >= threshold;

  return {
    adequate,
    score: Math.round(backstopScore * 100) / 100,
    checks: {
      negationPreservation: Math.round(negationPreservation * 100) / 100,
      keywordOverlap: Math.round(keywordOverlap * 100) / 100,
      structuralParity: Math.round(structuralParity * 100) / 100,
    },
  };
}

/**
 * Check if a score is in the borderline zone where the backstop should run.
 */
export function isBorderlineScore(score: number): boolean {
  return score >= 0.35 && score <= 0.6;
}

/**
 * Combined semantic check: runs primary heuristic, then backstop if borderline.
 * ALWAYS checks negation preservation — a dropped negation is an automatic fail
 * regardless of how good the surface statistics look.
 *
 * @returns finalScore — the heuristic score, or the backstop score if borderline
 * @returns backstop — undefined if score was not borderline (unless negation fail)
 */
export interface CombinedSemanticCheckResult {
  finalScore: number;
  primaryScore: number;
  backstop?: BackstopResult;
  passed: boolean;
  negationDropped?: boolean;
  /** Set when the primary scorer throws, so callers can surface the error instead of silently ignoring it. */
  error?: string;
}

export function combinedSemanticCheck(
  source: string,
  translated: string
): CombinedSemanticCheckResult {
  const safeSource = source ?? "";
  const safeTranslated = translated ?? "";

  let primary: { score: number };
  try {
    primary = calculateSemanticSimilarity(safeSource, safeTranslated);
  } catch (e) {
    // Primary scorer failed — surface the error so the orchestrator can report it
    return {
      finalScore: 0,
      primaryScore: 0,
      passed: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Mandatory negation check: source has negation but translation doesn't = fail
  const sourceNegations = countNegations(safeSource, "en");
  const translatedNegations = countNegations(safeTranslated, "es");
  const negationDropped = sourceNegations > 0 && translatedNegations === 0;

  if (negationDropped) {
    // Run backstop anyway to get detailed diagnostics
    const backstop = runSemanticBackstop(safeSource, safeTranslated, primary.score);
    return {
      finalScore: 0.1,
      primaryScore: primary.score,
      backstop,
      passed: false,
      negationDropped: true,
    };
  }

  if (!isBorderlineScore(primary.score)) {
    return {
      finalScore: primary.score,
      primaryScore: primary.score,
      passed: primary.score >= 0.4,
      negationDropped: false,
    };
  }

  const backstop = runSemanticBackstop(safeSource, safeTranslated, primary.score);
  const finalScore = backstop.adequate
    ? Math.max(primary.score, 0.45) // Boost to passing if backstop confirms
    : primary.score;

  return {
    finalScore: Math.round(finalScore * 100) / 100,
    primaryScore: primary.score,
    backstop,
    passed: backstop.adequate,
    negationDropped: false,
  };
}
