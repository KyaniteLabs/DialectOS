/**
 * Lightweight semantic similarity scorer for translation quality.
 *
 * Uses heuristic signals (word overlap, length ratio, entity preservation)
 * as a proxy for true semantic similarity. Catches obvious drift without
 * requiring external embedding services.
 */

export interface SemanticScore {
  /** Overall semantic score (0-1) */
  score: number;
  /** Word overlap / Jaccard similarity (0-1) */
  wordOverlap: number;
  /** Length ratio (closer to 1 is better) */
  lengthRatio: number;
  /** Named entity preservation score (0-1) */
  entityPreservation: number;
}

/**
 * Extract simple word-like tokens from text.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Extract potential named entities (capitalized words, numbers, codes).
 */
function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  // Capitalized words (potential proper nouns)
  const capitalized = text.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g);
  if (capitalized) capitalized.forEach((e) => entities.add(e.toLowerCase()));
  // Numbers and codes
  const codes = text.match(/\b[a-zA-Z0-9_-]{4,}\b/g);
  if (codes) codes.forEach((e) => entities.add(e.toLowerCase()));
  return Array.from(entities);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate semantic similarity between source and translated text.
 *
 * Weights:
 * - wordOverlap: 50%
 * - lengthRatio: 30%
 * - entityPreservation: 20%
 */
export function calculateSemanticSimilarity(
  source: string,
  translated: string
): SemanticScore {
  const sourceTokens = tokenize(source);
  const translatedTokens = tokenize(translated);

  const wordOverlap = jaccardSimilarity(sourceTokens, translatedTokens);

  // Length ratio: penalize translations that are very short or very long
  const sourceLen = source.trim().length;
  const translatedLen = translated.trim().length;
  const rawRatio = sourceLen > 0 ? translatedLen / sourceLen : 1;
  // Map ratio to score: 1.0 = perfect, 0.5 or 2.0 = poor
  const lengthRatio =
    rawRatio >= 1
      ? clamp(2 - rawRatio, 0, 1)
      : clamp(rawRatio * 2 - 0.5, 0, 1);

  // Entity preservation
  const sourceEntities = extractEntities(source);
  const translatedEntities = extractEntities(translated);
  const entityPreservation =
    sourceEntities.length === 0
      ? 1
      : jaccardSimilarity(sourceEntities, translatedEntities);

  const score =
    wordOverlap * 0.5 + lengthRatio * 0.3 + entityPreservation * 0.2;

  return {
    score: Math.round(score * 100) / 100,
    wordOverlap: Math.round(wordOverlap * 100) / 100,
    lengthRatio: Math.round(lengthRatio * 100) / 100,
    entityPreservation: Math.round(entityPreservation * 100) / 100,
  };
}

/**
 * Check if semantic score meets the threshold for a given policy mode.
 */
export function meetsSemanticThreshold(
  score: number,
  mode: "strict" | "standard" = "standard"
): boolean {
  return mode === "strict" ? score >= 0.6 : score >= 0.4;
}
