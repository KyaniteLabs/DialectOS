import type { SpanishDialect } from "./index.js";
import type { DictionaryEntry, SemanticField, Variant } from "./dialectal-dictionary.js";
import { DICTIONARY } from "./dialectal-dictionary.js";
import type { VerbConjugation } from "./verb-conjugations.js";
import { VERB_CONJUGATIONS } from "./verb-conjugations.js";
import { ALL_AMERICAN_DIALECTS, FULL_VOSEO_DIALECTS, REGIONAL_VOSEO_DIALECTS } from "./dialect-regions.js";

// --- Types ---

export interface VocabularySwap {
  concept: string;
  englishGloss: string;
  field: SemanticField;
  preferredTerm: string;
  frequency: 1 | 2 | 3;
  register: "formal" | "informal" | "universal";
  avoidTerms: string[];
}

export interface ForbiddenTerm {
  term: string;
  concept: string;
  reason: string;
  severity: "error" | "warning";
}

export interface DialectComplianceViolation {
  concept: string;
  expectedTerm: string;
  foundTerm: string;
  severity: "error" | "warning";
  message: string;
}

export interface DialectComplianceResult {
  passed: boolean;
  score: number;
  violations: DialectComplianceViolation[];
  checkedConcepts: number;
}

export interface SyntacticRule {
  id: string;
  dialects: readonly SpanishDialect[] | "all";
  rule: string;
  enforcement: "prompt-only" | "validate";
}

// --- Helper: resolve variant for a dialect ---

function resolveVariant(entry: DictionaryEntry, dialect: SpanishDialect): Variant | undefined {
  if (entry.variants[dialect]) return entry.variants[dialect];
  if (entry.panHispanic) return { term: entry.panHispanic, frequency: 1, register: "universal" as const };
  if (entry.variants["es-ES"]) return entry.variants["es-ES"];
  return undefined;
}

// Collect all unique terms across all dialects for an entry
function getAllTerms(entry: DictionaryEntry): string[] {
  const terms = new Set<string>();
  if (entry.panHispanic) terms.add(entry.panHispanic);
  for (const v of Object.values(entry.variants)) {
    if (v) terms.add(v.term);
  }
  return [...terms];
}

// --- Query functions ---

export function getVocabularyForDialect(dialect: SpanishDialect): VocabularySwap[] {
  const swaps: VocabularySwap[] = [];
  for (const entry of DICTIONARY) {
    const variant = resolveVariant(entry, dialect);
    if (!variant) continue;
    const allTerms = getAllTerms(entry);
    const avoidTerms = allTerms.filter(t => t !== variant.term);
    swaps.push({
      concept: entry.concept,
      englishGloss: entry.englishGloss,
      field: entry.field,
      preferredTerm: variant.term,
      frequency: variant.frequency,
      register: variant.register,
      avoidTerms,
    });
  }
  return swaps.sort((a, b) => a.frequency - b.frequency);
}

export function getVocabularyByField(dialect: SpanishDialect, field: SemanticField): VocabularySwap[] {
  return getVocabularyForDialect(dialect).filter(s => s.field === field);
}

export function getForbiddenTerms(dialect: SpanishDialect): ForbiddenTerm[] {
  const forbidden: ForbiddenTerm[] = [];
  for (const entry of DICTIONARY) {
    const variant = resolveVariant(entry, dialect);
    if (!variant) continue;
    const allTerms = getAllTerms(entry);
    for (const term of allTerms) {
      if (term === variant.term) continue;
      forbidden.push({
        term,
        concept: entry.concept,
        reason: `"${term}" is not the preferred term for ${dialect} (use "${variant.term}" instead)`,
        severity: "warning",
      });
    }
    // Taboo terms get error severity
    if (variant.notes?.includes("vulgar") || variant.notes?.includes("taboo")) {
      const tabooTerm = entry.variants["es-ES"]?.term;
      if (tabooTerm && tabooTerm !== variant.term) {
        const existing = forbidden.find(f => f.term === tabooTerm && f.concept === entry.concept);
        if (existing) existing.severity = "error";
      }
    }
  }
  return forbidden;
}

// --- Prompt builders ---

export function buildDialectVocabularyPrompt(dialect: SpanishDialect): string {
  const swaps = getVocabularyForDialect(dialect);
  const fields = new Set<SemanticField>(swaps.map(s => s.field));
  const lines: string[] = [`Vocabulary for ${dialect}:`];

  for (const field of fields) {
    const fieldSwaps = swaps.filter(s => s.field === field);
    // Include all entries that have alternatives (avoidTerms > 0), sorted by frequency
    const impactful = fieldSwaps
      .filter(s => s.avoidTerms.length > 0)
      .sort((a, b) => a.frequency - b.frequency);
    if (impactful.length === 0) continue;
    const entries = impactful.map(s => {
      const avoid = s.avoidTerms.length > 0 ? `, avoid ${s.avoidTerms.slice(0, 3).join("/")}` : "";
      return `${s.concept} → ${s.preferredTerm}${avoid}`;
    });
    lines.push(`[${field}] ${entries.join("; ")}`);
  }

  return lines.join("\n");
}

export function buildConjugationPrompt(dialect: SpanishDialect): string {
  const lines: string[] = [`Verb usage for ${dialect}:`];

  // Lemma-changing verbs
  for (const verb of VERB_CONJUGATIONS) {
    if (verb.category !== "lemma-change" || !verb.regionalInfinitive) continue;
    const regional = verb.regionalInfinitive[dialect];
    if (regional && regional !== verb.infinitive) {
      lines.push(`- Use ${regional} (not ${verb.infinitive}) for "${verb.meaning}"`);
    }
  }

  // Voseo conjugation (full + regional voseo)
  const voseoAll = [...FULL_VOSEO_DIALECTS, ...REGIONAL_VOSEO_DIALECTS];
  if (voseoAll.includes(dialect)) {
    lines.push("Voseo conjugation (use vos, not tú):");
    const voseoVerbs = VERB_CONJUGATIONS.filter(v => v.category === "conjugation-pattern");
    for (const verb of voseoVerbs) {
      const vosForm = verb.forms[dialect];
      const túForm = verb.forms["es-ES"];
      if (vosForm?.present_2s && túForm?.present_2s && vosForm.present_2s !== túForm.present_2s) {
        lines.push(`- ${verb.infinitive}: vos ${vosForm.present_2s} (not tú ${túForm.present_2s})`);
      }
    }
  }

  return lines.length <= 1 ? "" : lines.join("\n");
}

// --- Validation ---

const CONCEPT_PATTERNS: Array<{ concept: string; patterns: RegExp[] }> = (() => {
  const map: Array<{ concept: string; patterns: RegExp[] }> = [];
  for (const entry of DICTIONARY) {
    const words = entry.englishGloss
      .split(/[\s,;.()\/]+/)
      .filter(w => w.length >= 4)
      .map(w => w.toLowerCase());
    if (words.length === 0) continue;
    const patterns = words.map(w => new RegExp(`\\b${w}\\b`, "i"));
    map.push({ concept: entry.concept, patterns });
  }
  return map;
})();

export function validateDialectCompliance(
  source: string,
  translated: string,
  dialect: SpanishDialect,
): DialectComplianceResult {
  const violations: DialectComplianceViolation[] = [];
  let checkedCount = 0;
  const lowerSource = source.toLowerCase();
  const lowerTranslated = translated.toLowerCase();

  for (const entry of DICTIONARY) {
    const cp = CONCEPT_PATTERNS.find(c => c.concept === entry.concept);
    if (!cp) continue;
    const matched = cp.patterns.some(p => p.test(lowerSource));
    if (!matched) continue;
    checkedCount++;

    const expected = resolveVariant(entry, dialect);
    if (!expected) continue;

    const expectedLower = expected.term.toLowerCase();
    const allTerms = getAllTerms(entry);

    // Check if expected term is present
    const hasExpected = lowerTranslated.includes(expectedLower);

    // Check if a wrong-dialect term is present instead
    for (const term of allTerms) {
      if (term === expectedLower) continue;
      if (lowerTranslated.includes(term.toLowerCase())) {
        if (!hasExpected) {
          const severity: "error" | "warning" = expected.notes?.includes("vulgar") ? "error" : "warning";
          violations.push({
            concept: entry.concept,
            expectedTerm: expected.term,
            foundTerm: term,
            severity,
            message: `Expected "${expected.term}" for ${dialect} but found "${term}" (${entry.englishGloss})`,
          });
        }
        break;
      }
    }
  }

  const score = checkedCount > 0 ? (checkedCount - violations.length) / checkedCount : 1;
  return {
    passed: violations.length === 0,
    score,
    violations,
    checkedConcepts: checkedCount,
  };
}

// --- Syntactic rules ---

export const SYNTACTIC_RULES: SyntacticRule[] = [
  {
    id: "plural-address-vosotros",
    dialects: ["es-ES", "es-AD"],
    rule: "Use vosotros for informal plural address (not ustedes for informal).",
    enforcement: "prompt-only",
  },
  {
    id: "plural-address-ustedes",
    dialects: ALL_AMERICAN_DIALECTS,
    rule: "Use ustedes for all plural address (formal and informal). Do not use vosotros.",
    enforcement: "prompt-only",
  },
  {
    id: "voseo-AR-UY-PY",
    dialects: ["es-AR", "es-UY", "es-PY"],
    rule: "Use voseo: vos (not tú) for informal singular address. Conjugate: -ar→-ás, -er→-és, -ir→-ís. Vos sos (not tú eres), vos tenés (not tú tienes).",
    enforcement: "validate",
  },
  {
    id: "voseo-central-america",
    dialects: ["es-GT", "es-HN", "es-SV", "es-NI"],
    rule: "Use voseo: vos for informal singular. Conjugate like Rioplatense: -ar→-ás, -er→-és, -ir→-ís.",
    enforcement: "validate",
  },
  {
    id: "voseo-BO-EC",
    dialects: ["es-BO", "es-EC"],
    rule: "Voseo is common in informal speech: vos tenés, vos podés. Use tú in formal/written contexts unless specifically targeting informal register.",
    enforcement: "prompt-only",
  },
  {
    id: "voseo-CO-VE-CL",
    dialects: ["es-CO", "es-VE", "es-CL"],
    rule: "Voseo exists in informal registers but tú is standard in formal writing. Default to tú for formal, vos for informal.",
    enforcement: "prompt-only",
  },
  {
    id: "voseo-CR-regional",
    dialects: ["es-CR"],
    rule: "Costa Rican Spanish uses usted extensively even in informal contexts. Vos is common in informal speech but not dominant. Default to usted for neutral register, vos for explicitly informal contexts. Avoid tú unless specifically requested.",
    enforcement: "prompt-only",
  },
  {
    id: "leismo-spain",
    dialects: ["es-ES", "es-AD"],
    rule: "Leísmo is accepted: use le for male direct object (a Juan le vi). Use lo for female and inanimate direct objects.",
    enforcement: "prompt-only",
  },
  {
    id: "loismo-americas",
    dialects: ALL_AMERICAN_DIALECTS,
    rule: "Use lo/la for direct objects consistently. Avoid leísmo (le for direct objects). Le is only for indirect objects.",
    enforcement: "prompt-only",
  },
  {
    id: "pretérito-vs-perfecto",
    dialects: ["es-ES", "es-AD"],
    rule: "Use pretérito perfecto compuesto for recent past actions (hoy he comido) and pretérito indefinido for remote past (ayer comí).",
    enforcement: "prompt-only",
  },
  {
    id: "pretérito-simple-americas",
    dialects: ALL_AMERICAN_DIALECTS,
    rule: "Use pretérito indefinido (simple past) for completed actions regardless of recency (hoy comí, ayer comí). The perfecto compuesto is rare in most registers.",
    enforcement: "prompt-only",
  },
  {
    id: "usted-respect-MX-CO",
    dialects: ["es-MX", "es-CO"],
    rule: "Use usted for formal address and with strangers, elders, and authority. Tú is standard informal. Never mix tú/usted with same person.",
    enforcement: "prompt-only",
  },
  {
    id: "clitic-placement",
    dialects: "all",
    rule: "Place clitic pronouns before conjugated verbs (lo veo) and after infinitives/gerunds/imperatives as enclitics (verlo, viéndolo, velo). Do not place enclitics after conjugated finite verbs.",
    enforcement: "prompt-only",
  },
  {
    id: "existential-haber",
    dialects: "all",
    rule: "Use singular 'hay' for existential 'there is/are'. Do not agree 'haber' with the subject (hay muchos libros, NOT han muchos libros) in formal registers.",
    enforcement: "prompt-only",
  },
  {
    id: "preposition-de-acuerdo",
    dialects: ALL_AMERICAN_DIALECTS,
    rule: "Use 'de acuerdo con' (not 'de acuerdo a') for 'in agreement with' or 'according to'.",
    enforcement: "prompt-only",
  },
  {
    id: "queismo-dequeismo",
    dialects: "all",
    rule: "Use 'pienso que', 'creo que', 'digo que' (correct queísmo). Avoid dequeísmo: 'pienso de que', 'creo de que' is stigmatized. American Spanish tends toward correct queísmo; Peninsular Spanish has more dequeísmo in colloquial registers.",
    enforcement: "prompt-only",
  },
  {
    id: "voseo-imperative",
    dialects: ["es-AR", "es-UY", "es-PY", "es-GT", "es-HN", "es-SV", "es-NI"],
    rule: "Vos imperative: -ar→-á (hablá), -er→-é (tené), -ir→-í (vení). NOT the tú imperative. Irregular: andá (ir), sé (ser), di (decir). Do NOT use tú imperatives like 'habla', 'ten', 'ven' with vos.",
    enforcement: "validate",
  },
  {
    id: "future-tense-preference",
    dialects: "all",
    rule: "Colloquial speech prefers 'voy a + infinitive' (periphrastic future) across all dialects. Synthetic future (comeré, hablarás) is formal/literary. Caribbean and informal Latin American Spanish rarely use synthetic future in speech.",
    enforcement: "prompt-only",
  },
  {
    id: "gerund-duration",
    dialects: ["es-US", "es-MX", "es-GT", "es-HN", "es-SV", "es-NI", "es-CR", "es-PA"],
    rule: "Avoid English-influenced gerund of duration: 'estoy viviendo aquí hace 3 años' → use 'hace 3 años que vivo aquí' or 'llevo 3 años viviendo aquí'. The gerund of duration is a common anglicism in US and Central American Spanish.",
    enforcement: "prompt-only",
  },
  {
    id: "article-personal-names",
    dialects: ["es-GT", "es-HN", "es-SV", "es-NI", "es-CR", "es-PA"],
    rule: "Article before given names is standard: 'la María', 'el José'. This is grammatically correct in Central American Spanish and would sound wrong if omitted in informal registers. Do not apply in other dialects.",
    enforcement: "prompt-only",
  },
  {
    id: "past-tense-andean",
    dialects: ["es-BO", "es-EC"],
    rule: "Andean Spanish can use pretérito perfecto compuesto for recent past actions (hoy he comido) due to Quechua substrate influence, similar to Peninsular Spanish but for different linguistic reasons. This is NOT an error — it is a legitimate Andean feature.",
    enforcement: "prompt-only",
  },
  {
    id: "person-first-language",
    dialects: "all",
    rule: "In formal registers, prefer person-first language for disability references: 'persona con discapacidad' (not 'discapacitado'), 'persona sorda' (not 'sorda' as noun), 'persona ciega' (not 'ciega' as noun), 'persona con movilidad reducida' (not 'minusválido'). In informal registers, adjective forms are acceptable but noun forms (el ciego, el sordo) are stigmatized in most dialects. Always prefer 'persona con X' over 'X-person' constructions.",
    enforcement: "prompt-only",
  },
];

export function getSyntacticRules(dialect: SpanishDialect): SyntacticRule[] {
  return SYNTACTIC_RULES.filter(rule => {
    if (rule.dialects === "all") return true;
    return (rule.dialects as readonly SpanishDialect[]).includes(dialect);
  });
}
