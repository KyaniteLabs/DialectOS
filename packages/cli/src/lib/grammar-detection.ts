/**
 * Grammar feature detection for Spanish dialect identification.
 *
 * Detects grammatical markers that distinguish dialects:
 * - Voseo ("vos" + voseo verb conjugations like -ás, -és, -ís)
 * - Leísmo (using "le" as direct object)
 * - Laísmo (using "la/las" as indirect object)
 * - Loísmo (using "lo/los" as indirect object)
 * - Vosotros forms (Spain)
 */

export interface GrammarFeatures {
  /** Voseo detected ("vos" + voseo endings) */
  hasVoseo: boolean;
  /** Leísmo detected ("le/les" as direct object) */
  hasLeismo: boolean;
  /** Laísmo detected ("la/las" as indirect object) */
  hasLaismo: boolean;
  /** Loísmo detected ("lo/los" as indirect object) */
  hasLoismo: boolean;
  /** Vosotros forms detected (Spain-specific) */
  hasVosotros: boolean;
  /** Ustedes used instead of vosotros (Latin America) */
  hasUstedes: boolean;
}

/** Simple voseo verb ending detection: common voseo endings */
const VOSEO_ENDINGS = [
  "ás", "és", "ís", // present indicative voseo
];

/** Common Spanish words ending in voseo-like suffixes that are NOT voseo */
const VOSEO_FALSE_POSITIVES = new Set([
  "más", "país", "atrás", "después", "adiós", "anís", "francés", "inglés",
  "portugués", "japonés", "alemán", "holandés", "irlandés", "finlandés",
  "polonés", "escocés", "galés", "vietnamita", "chino", "coreano",
]);

/** Vosotros verb endings */
const VOSOTROS_ENDINGS = ["áis", "éis", "ís"];

/**
 * Detect grammar features in Spanish text.
 *
 * These are probabilistic heuristics. Combine with lexical keyword
 * detection for higher-confidence dialect identification.
 */
export function detectGrammarFeatures(text: string): GrammarFeatures {
  const lower = text.toLowerCase();
  // Strip punctuation from words for ending checks
  const cleanWords = lower.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""));

  // Voseo: "vos" pronoun OR words ending in voseo endings
  const hasVosPronoun = /\bvos\b/.test(lower);
  const hasVoseoEnding = cleanWords.some((w) =>
    VOSEO_ENDINGS.some((ending) => w.endsWith(ending)) && !VOSEO_FALSE_POSITIVES.has(w)
  );
  const hasVoseo = hasVosPronoun || hasVoseoEnding;

  // Vosotros: explicit pronoun OR verb with -áis/-éis/-ís
  const hasVosotrosPronoun = /\bvosotros\b/.test(lower) || /\bvosotras\b/.test(lower);
  const hasVosotrosEnding = cleanWords.some((w) =>
    VOSOTROS_ENDINGS.some((ending) => w.endsWith(ending))
  );
  const hasVosotros = hasVosotrosPronoun || hasVosotrosEnding;

  // Ustedes
  const hasUstedes = /\bustedes\b/.test(lower);

  // Leísmo: "le/les" used with direct-object verbs (masculine animate)
  // This is a heuristic — we look for "le/les" before common person-directed verbs
  const leismoTriggers = new Set([
    "vi", "veo", "viendo", "visto",
    "encontré", "saludé", "llamé", "conocí", "visité",
    "ayudé", "invité", "besé", "abrazé", "quiero", "amo", "respeto",
    "escuché", "esperé", "busqué", "perdí", "gané", "vencí",
    "tomé", "llevé", "doy", "daré",
    "mostré", "enseñé", "expliqué", "pregunté", "respondí",
    "grité", "susurré", "insulté", "prometí", "juré", "confesé",
    "oculté", "escondí", "protegí", "defendí", "cuidé", "atendí",
    "serví", "ayudé", "maté", "asesiné", "rompí", "corté",
    "dividí", "separé", "encerré", "detuve", "arresté", "capturé",
    "atrapé", "junté", "mezclé", "agregué", "incluí",
    "escribí", "preparé", "organizé", "planifiqué", "ordené",
    "mandé", "indiqué", "dibujé", "describí", "definí",
    "cambié", "modifiqué", "noté", "observé", "descubrí",
    "hallé", "encontré", "localicé", "ubicé", "coloqué",
    "puse", "metí", "tiré", "arrojé", "lancé", "disparé",
    "acerté", "erré", "equivogué", "fallé", "fracasé",
    "triunfé", "vencí", "gané", "perdí",
  ]);
  const hasLeismo = /\b(le|les)\b/.test(lower) &&
    Array.from(leismoTriggers).some((verb) => lower.includes("le " + verb) || lower.includes("les " + verb));

  // Laísmo: "la/las" used with indirect-object verbs
  const laismoVerbs = new Set([
    "di", "dio", "da", "dan", "dando", "dado", "doy", "dieron",
    "pregunté", "contesté", "respondí", "expliqué", "dije",
    "conté", "repetí", "grité", "susurré", "confesé",
    "revelé", "oculté", "escondí",
  ]);
  const hasLaismo = /\b(la|las)\b/.test(lower) &&
    Array.from(laismoVerbs).some((verb) => lower.includes("la " + verb) || lower.includes("las " + verb));

  // Loísmo: "lo/los" used with indirect-object verbs
  const hasLoismo = /\b(lo|los)\b/.test(lower) &&
    Array.from(laismoVerbs).some((verb) => lower.includes("lo " + verb) || lower.includes("los " + verb));

  return {
    hasVoseo,
    hasLeismo,
    hasLaismo,
    hasLoismo,
    hasVosotros,
    hasUstedes,
  };
}

/** Infer dialect probability hints from grammar features */
export function grammarFeaturesToDialectHints(
  features: GrammarFeatures
): { dialect: string; confidence: number }[] {
  const hints: { dialect: string; confidence: number }[] = [];

  if (features.hasVoseo) {
    hints.push({ dialect: "es-AR", confidence: 0.7 });
    hints.push({ dialect: "es-UY", confidence: 0.6 });
    hints.push({ dialect: "es-PY", confidence: 0.6 });
    hints.push({ dialect: "es-BO", confidence: 0.5 });
  }

  if (features.hasVosotros) {
    hints.push({ dialect: "es-ES", confidence: 0.8 });
    hints.push({ dialect: "es-AD", confidence: 0.6 });
  }

  if (features.hasUstedes && !features.hasVosotros) {
    hints.push({ dialect: "es-MX", confidence: 0.3 });
    hints.push({ dialect: "es-CO", confidence: 0.3 });
    hints.push({ dialect: "es-PE", confidence: 0.3 });
    hints.push({ dialect: "es-VE", confidence: 0.3 });
    hints.push({ dialect: "es-CL", confidence: 0.3 });
  }

  if (features.hasLeismo) {
    hints.push({ dialect: "es-ES", confidence: 0.4 });
  }

  return hints;
}
