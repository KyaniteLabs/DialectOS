/**
 * Grammar-aware dialect detection signals.
 *
 * Detects grammatical markers that distinguish Spanish dialects:
 * - Voseo (vos + voseo verb endings)
 * - Vosotros (vosotros + vosotros verb endings)
 * - Leísmo (le/les as direct object for people)
 * - Diminutive frequency (-ito/-ita)
 * - Tú vs Vos pronoun presence
 */

export interface GrammarSignals {
  /** Voseo strength 0–3 (pronoun + verb forms) */
  voseo: number;
  /** Vosotros strength 0–3 (pronoun + verb forms) */
  vosotros: number;
  /** Leísmo strength 0–1 */
  leismo: number;
  /** Number of diminutives found */
  diminutives: number;
  /** Number of "tú" pronouns found */
  tuPronoun: number;
  /** Number of "vos" pronouns found (excluding vosotros) */
  vosPronoun: number;
}

const VOSEO_PRESENT_BLOCKLIST = new Set([
  "más",
  "atrás",
  "además",
  "quizás",
  "jamás",
  "país",
  "países",
  "anís",
  "francés",
  "inglés",
  "portugués",
  "cafés",
  "bebés",
  "mes",
  "meses",
  "interés",
  "intereses",
  "franceses",
  "españoles",
  "analís",
  "crisis",
  "hipótesis",
  "síntesis",
  "paréntesis",
  "énfasis",
  "oasis",
  "tesis",
  "déficit",
  "próceres",
  // Common adverbs ending in -és that are not voseo verb forms
  "después",
]);

const IMPERATIVE_BLOCKLIST = new Set([
  "más",
  "está",
  "será",
  "iré",
  "café",
  "bebé",
  "ahí",
  "así",
  "allá",
  "quizá",
  "día",
  "días",
  "mamá",
  "papá",
  "sofá",
  "canapé",
  "menú",
  "tabú",
  "perú",
  "tía",
  "tío",
  "río",
  "anís",
  "jamás",
  "quizás",
  "están",
  "serán",
  "irán",
  "darán",
  "estarán",
  "tendrán",
  "podrán",
  "querrán",
  "sabrán",
  "habrá",
  "tendré",
  "podré",
  "querré",
  "sabré",
  "habré",
  "estaré",
  "daré",
  "veré",
  "pondré",
  "vendré",
  "saldré",
  "diré",
  "haré",
  "oí",
  // Common preterite 1st-person and non-imperative words ending in -á/-é
  "qué",
  "dejé",
  "compré",
  "llegué",
  "saqué",
  "busqué",
  "pagué",
  "jugué",
  "empecé",
  "creé",
  "quedé",
  "pasé",
  "acá",
]);

const VOSOTROS_FALSE_POSITIVES = new Set([
  "adelante",
  "red",
  "lid",
  "mid",
  "pared",
  "sed",
  "usted",
  "huésped",
  "césped",
  "madrid",
  "david",
  "vid",
  "ardid",
]);

/** Nouns ending in -dad/-tad (verdad, ciudad, libertad) look like vosotros imperatives. */
function isAbstractNoun(word: string): boolean {
  return /(?:dad|tad)$/.test(word);
}

/** Split text into Spanish words (handles accented characters). */
function getWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-záéíóúñü]+/)
    .filter((w) => w.length > 0);
}

/**
 * Detect grammar signals in Spanish text.
 */
export function detectGrammarSignals(text: string): GrammarSignals {
  const words = getWords(text);
  const lower = text.toLowerCase();

  // Vos pronoun (not part of vosotros — word boundary prevents that)
  const vosPronoun = (lower.match(/\bvos\b/g) || []).length;

  // Tú pronoun — use Unicode-aware boundaries because \b does not work
  // with accented characters (ú is not a \w character in JavaScript).
  const tuPronoun = (lower.match(/(?<![a-z0-9_áéíóúñ])tú(?![a-z0-9_áéíóúñ])/g) || []).length;

  // Voseo present indicative: words ending in -ás, -és, -ís
  const voseoPresentMatches = words.filter((w) => {
    if (!/^[a-záéíóúñ]+[áéí]s$/.test(w)) return false;
    if (VOSEO_PRESENT_BLOCKLIST.has(w)) return false;
    // Exclude future-tense forms (llegarás, comerás, etc.)
    if (/(?:arás|erás|irás)$/.test(w)) return false;
    return true;
  });

  // Voseo imperative: short words ending in accented -á or -é
  const voseoImperativeMatches = words.filter((w) => {
    if (!/^[a-záéíóúñ]{2,7}[áé]$/.test(w)) return false;
    if (IMPERATIVE_BLOCKLIST.has(w)) return false;
    // Exclude future/conditional infinitive endings
    if (/[aeiou]r[áé]$/.test(w)) return false;
    return true;
  });

  // Vosotros pronoun
  const vosotrosPronoun = (lower.match(/\bvosotr[oa]s\b/g) || []).length;

  // Vosotros present indicative: -áis, -éis (strong signal)
  // Note: -ís is shared with voseo and intentionally omitted here to avoid double-counting.
  const vosotrosPresentMatches = words.filter((w) =>
    /^[a-záéíóúñ]+(?:áis|éis)$/.test(w)
  );

  // Vosotros imperative: -ad, -ed, -id
  const vosotrosImperativeMatches = words.filter(
    (w) =>
      /^[a-záéíóúñ]+(?:ad|ed|id)$/.test(w) &&
      !VOSOTROS_FALSE_POSITIVES.has(w) &&
      !isAbstractNoun(w)
  );

  // Leísmo: le/les as the direct object of a verb that takes one. Verbs
  // whose "le" is an indirect object (decir, dar, preguntar: "le dije la
  // verdad") are correct Spanish everywhere and are not listed.
  const leismoPattern =
    /(?<![\p{L}\p{N}_])(le|les)\s+(?:vi|viste|vio|veo|ves|ve|conozco|conoces|conoce|quiero|quieres|quiere|encontré|encontraste|encontró|llamé|llamaste|llamó|busqué|buscaste|buscó|saludé|saludaste|saludó)(?![\p{L}\p{N}_])/gu;
  const leismoMatches = (lower.match(leismoPattern) || []).length;

  // Diminutives
  const diminutiveMatches = words.filter((w) =>
    /^[a-záéíóúñ]+(?:ito|ita|itos|itas)$/.test(w)
  ).length;

  const voseoScore = Math.min(
    vosPronoun + voseoPresentMatches.length + voseoImperativeMatches.length,
    3
  );
  const vosotrosScore = Math.min(
    vosotrosPronoun + vosotrosPresentMatches.length + vosotrosImperativeMatches.length,
    3
  );

  return {
    voseo: voseoScore,
    vosotros: vosotrosScore,
    leismo: Math.min(leismoMatches, 1),
    diminutives: diminutiveMatches,
    tuPronoun,
    vosPronoun,
  };
}

/**
 * Return the grammar family for a dialect.
 * Used to determine whether two dialects share the same grammatical profile.
 */
export function getGrammarFamily(dialect: string): "voseo" | "vosotros" | "tuteo" | null {
  const voseoDialects = new Set([
    "es-AR",
    "es-UY",
    "es-PY",
    "es-BO",
    "es-NI",
    "es-CR",
    "es-GT",
    "es-HN",
    "es-SV",
    "es-PA",
    "es-EC",
  ]);
  if (voseoDialects.has(dialect)) return "voseo";
  if (dialect === "es-ES") return "vosotros";
  if (dialect.startsWith("es-")) return "tuteo";
  return null;
}
