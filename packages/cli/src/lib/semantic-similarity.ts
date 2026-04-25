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
  return (text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Extract potential named entities (capitalized words, numbers, codes).
 */
function extractEntities(text: string): string[] {
  const safe = (text ?? "").normalize("NFC");
  const entities = new Set<string>();
  // Multi-word capitalized phrases (proper nouns like "Kyanite Labs")
  const phrases = safe.match(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)+\b/g);
  if (phrases) phrases.forEach((e) => entities.add(e.toLowerCase().replace(/\s+/g, "_")));
  // Single capitalized words (exclude sentence-initial common words)
  const capitalized = safe.match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g);
  if (capitalized) {
    const commonWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "she", "use", "her", "man", "men", "run", "say", "too", "ago", "air", "art", "bad", "big", "bit", "car", "dog", "eat", "far", "few", "fun", "got", "guy", "hit", "hot", "job", "kid", "law", "let", "lot", "low", "mom", "mud", "nod", "own", "pay", "pen", "pie", "pop", "put", "red", "sad", "sat", "set", "sin", "sir", "sit", "six", "sky", "son", "sun", "tab", "tag", "tan", "ten", "tie", "tin", "tip", "toe", "ton", "top", "toy", "try", "tub", "tug", "van", "vet", "via", "war", "wet", "win", "won", "wow", "yes", "yet", "zip", "el", "la", "los", "las", "un", "una", "de", "del", "al", "en", "es", "son", "por", "con", "para", "pero", "más", "muy", "sus", "les", "nos", "sin", "sobre", "entre", "desde", "todo", "todos", "esta", "este", "esto", "estos", "estas", "ese", "eso", "esos", "esas", "cada", "otro", "otra", "otros", "otras", "mismo", "misma", "mismos", "mismas", "tan", "tanto", "tanta", "tantos", "tantas", "cómo", "qué", "quién", "cuál", "cuándo", "dónde", "por_qué"]);
    capitalized.forEach((e) => {
      const lower = e.toLowerCase();
      if (!commonWords.has(lower)) entities.add(lower);
    });
  }
  // Mixed alphanumeric codes and acronyms (API, JSON, MCP, v2, etc.)
  const codes = safe.match(/\b[A-Z]{2,}\b|\b[A-Za-z]+[0-9][A-Za-z0-9]*\b/g);
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
 * Calculate cross-lingual presence score for EN→ES translation.
 * Word overlap is meaningless across languages, so we check for:
 * - Spanish-specific characters (áéíóúñ¿¡)
 * - Spanish morphological markers (ción, mente, idad, etc.)
 * - Reasonable length ratio
 * - Source != target (catches copy-paste LLM failures)
 */
function calculateCrossLingualPresence(source: string, translated: string): number {
  const trimmedSource = source.trim().toLowerCase();
  const trimmedTranslated = translated.trim().toLowerCase();

  // Common LLM failure: returns the source text unchanged
  if (trimmedSource === trimmedTranslated) {
    return 0;
  }

  // Empty translation is a total failure
  if (trimmedTranslated.length === 0) {
    return 0;
  }

  // Empty source with non-empty translation is also suspicious
  if (trimmedSource.length === 0) {
    return 0;
  }

  let score = 0;

  // Spanish-specific characters are strong signals
  if (/[áéíóúñ¿¡ü]/i.test(translated)) {
    score += 0.4;
  }

  // Spanish morphological endings
  if (/\b\w+(?:ción|mente|idad|anza|encia|imiento|oso|osa|ico|ica|able|ible|dad|tad|tud|aje|ez|eza)\b/giu.test(translated)) {
    score += 0.3;
  }

  // Reasonable length ratio for EN→ES (Spanish is ~15% longer)
  const ratio = source.length > 0 ? translated.length / source.length : 1;
  if (ratio >= 0.5 && ratio <= 2.0) {
    score += 0.2;
  }

  // Penalize if the output is mostly English function words
  const englishWords = (translated.match(/\b(the|and|or|is|are|was|were|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall|this|that|these|those|with|from|for|about|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just)\b/gi) || []).length;
  const totalWords = translated.split(/\s+/).filter((w) => w.length > 0).length;
  const englishRatio = totalWords > 0 ? englishWords / totalWords : 0;
  if (englishRatio < 0.3) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Calculate semantic similarity between source and translated text.
 *
 * For cross-lingual EN→ES translation, word overlap is not meaningful.
 * We replace it with cross-lingual presence heuristics.
 *
 * Weights:
 * - crossLingualPresence: 25%
 * - lengthRatio: 35%
 * - entityPreservation: 40%
 */
export function calculateSemanticSimilarity(
  source: string,
  translated: string
): SemanticScore {
  const safeSource = (source ?? "").normalize("NFC");
  const safeTranslated = (translated ?? "").normalize("NFC");
  const crossLingualPresence = calculateCrossLingualPresence(safeSource, safeTranslated);

  // If source and target are identical (common LLM failure), nuke the score.
  if (crossLingualPresence === 0) {
    return {
      score: 0,
      wordOverlap: 0,
      lengthRatio: 0,
      entityPreservation: 0,
    };
  }

  // Length ratio: penalize translations that are very short or very long.
  // Spanish is typically ~15% longer than English; allow 0.5x to 2.0x range.
  const sourceLen = safeSource.trim().length;
  const translatedLen = safeTranslated.trim().length;
  const rawRatio = sourceLen > 0 ? translatedLen / sourceLen : 1;
  // Map ratio to score: 1.0 = perfect, 0.4 or 2.5 = poor
  const lengthRatio =
    rawRatio >= 1
      ? clamp(2.5 - rawRatio * 1.5, 0, 1)
      : clamp(rawRatio * 2, 0, 1);

  // Entity preservation
  const sourceEntities = extractEntities(safeSource);
  const translatedEntities = extractEntities(safeTranslated);
  const entityPreservation =
    sourceEntities.length === 0
      ? 1
      : jaccardSimilarity(sourceEntities, translatedEntities);

  const score =
    crossLingualPresence * 0.25 + lengthRatio * 0.35 + entityPreservation * 0.4;

  return {
    score: Math.round(score * 100) / 100,
    wordOverlap: Math.round(crossLingualPresence * 100) / 100,
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
