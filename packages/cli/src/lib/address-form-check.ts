/**
 * Second-person address forms: tú vs vos, and vosotros outside Spain.
 *
 * - Full-voseo variants (es-AR, es-UY, es-PY, es-GT, es-HN, es-SV, es-NI) say
 *   "vos tenés", never "tú tienes", and never the mix "vos tienes".
 * - Tuteo-only variants (es-ES, es-MX and the rest outside the voseo lists)
 *   never use the stressed voseo verb ("podés", "querés").
 * - Every variant but es-ES uses "ustedes" for the informal plural.
 *
 * Variants with only regional voseo (es-CO, es-CL, es-VE, es-BO, es-EC,
 * es-CR) are left alone: both forms are native somewhere in them.
 *
 * Verb forms come from the conjugation table. Tú forms that are also common
 * nouns or adjectives ("cuentas", "llenas", "tapas") are skipped, because
 * the check cannot parse a sentence.
 */

import type { SpanishDialect } from "@dialectos/types";
import { VERB_CONJUGATIONS, FULL_VOSEO_DIALECTS, REGIONAL_VOSEO_DIALECTS } from "@dialectos/types";

export interface AddressFormViolation {
  kind: "tu-in-voseo-dialect" | "mixed-voseo" | "voseo-in-tuteo-dialect" | "vosotros-outside-spain";
  found: string;
  expected?: string;
  message: string;
}

export interface AddressFormResult {
  passed: boolean;
  violations: AddressFormViolation[];
}

// Tú present forms that double as everyday nouns/adjectives.
const TU_HOMOGRAPHS = new Set([
  "sales", "cuentas", "llamas", "partes", "pasas", "esperas", "faltas", "cortas",
  "llenas", "formas", "ganas", "pagas", "tapas", "causas", "vales", "tomas",
  "lavas", "bajas", "cocinas", "limpias", "quedas", "ves", "das", "mueves",
  "cambias", "ventas", "vendes", "cantas", "presentas", "creas", "lees",
]);
const VOS_HOMOGRAPHS = new Set(["sos"]);
const CLITICS = /^(?:me|te|lo|la|los|las|le|les|nos|se)+$/;
// Valid plural nouns ending in -áis/-éis that are not vosotros verbs.
const AIS_EIS_NOUNS = new Set(["jerséis", "bonsáis", "samuráis", "jeréis", "spráis", "guirigáis"]);
// Unambiguous irregular bare tú imperatives (never 3s indicative) mapped to voseo.
const BARE_TU_IMPERATIVES: Record<string, string> = {
  ten: "tené",
  pon: "poné",
  haz: "hacé",
};
// Words that precede 3pl present indicative "ven" ("they see"), not imperative "ven" ("come").
const VER_3PL_PRECEDERS = new Set([
  "ellos", "ellas", "ustedes", "quienes", "todos", "todas", "muchos", "muchas",
  "algunos", "algunas", "varios", "varias", "ambos", "ambas", "estos", "estas",
  "esos", "esas", "aquellos", "aquellas", "se", "nos", "te", "me", "lo", "la",
  "los", "las", "le", "les", "no", "nunca", "ya", "aún", "todavía", "solo",
  "sólo", "también", "siempre", "que", "como", "donde", "cuando", "si",
]);
// Voseo -er/-ir imperatives that collide with standard 1s preterite or other tuteo forms.
const VOS_IMP_HOMOGRAPHS = new Set([
  "creé", // 1s preterite of crear
  "salí", "viví", "escribí", "abrí", "subí", "recibí", "permití", "sentí",
  "dormí", "pedí", "seguí", "morí", "partí", "cubrí", "imprimí", "reuní", "influí",
]);
// Enclitic vosotros imperatives: -ad/-ed/-id + object pronoun ("preparadlo", "hacedlo", "decidme").
const VOSOTROS_IMP_ENCLITIC = /^\p{L}{2,}(?:ad|ed|id)(?:lo|la|los|las|me|nos|le|les)$/u;
// Common non-verb nouns/words ending in -ad/-ed/-id to never treat as bare vosotros imperatives.
const VOSOTROS_IMP_NOUNS = new Set(["id", "red", "sed", "vid", "lid", "pared", "merced", "madrid", "david"]);

function tokens(text: string): string[] {
  return (text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-́]/g, "").normalize("NFC");
}

interface Pair { infinitive: string; tu: string; vos: string; tuImp?: string; vosImp?: string; vosotrosImp?: string }
let pairs: Pair[] | undefined;
let bareVosotrosImps: Set<string> | undefined;
function verbPairs(): Pair[] {
  if (pairs) return pairs;
  pairs = [];
  bareVosotrosImps = new Set();
  for (const v of VERB_CONJUGATIONS) {
    if (v.category !== "conjugation-pattern") continue;
    const tu = v.forms["es-ES"];
    const vos = v.forms["es-AR"];
    if (!tu?.present_2s || !vos?.present_2s) continue;
    const inf = v.infinitive.toLowerCase();
    const vosotrosImp = /[aei]r$/.test(inf) ? `${inf.slice(0, -1)}d` : undefined;
    if (vosotrosImp && !VOSOTROS_IMP_NOUNS.has(vosotrosImp)) {
      bareVosotrosImps.add(vosotrosImp);
    }
    pairs.push({
      infinitive: inf,
      tu: tu.present_2s.toLowerCase(),
      vos: vos.present_2s.toLowerCase(),
      tuImp: tu.imperative_2s?.toLowerCase(),
      vosImp: vos.imperative_2s?.toLowerCase(),
      vosotrosImp,
    });
  }
  return pairs;
}

/** "escúchame", "dime", "ponlo": a tú imperative with an enclitic pronoun. */
function tuImperativeWithClitic(word: string): Pair | undefined {
  for (const p of verbPairs()) {
    if (!p.tuImp || !p.vosImp || p.tuImp === p.vosImp) continue;
    const base = stripAccents(p.tuImp);
    const w = stripAccents(word);
    if (!w.startsWith(base) || w.length === base.length) continue;
    if (!CLITICS.test(w.slice(base.length))) continue;
    // Polysyllabic tú imperatives carry a written accent once a clitic is
    // added ("mírame"); the voseo form does not ("mirame"). Monosyllabic
    // ones ("di", "pon") have distinct voseo stems ("decime", "ponelo").
    const monosyllabic = (base.match(/[aeiou]+/g) || []).length === 1;
    if (monosyllabic || word !== w) return p;
  }
  return undefined;
}

/** "decime", "ponelo", "venite", "hablame": a voseo imperative with an enclitic pronoun. */
function vosImperativeWithClitic(word: string): Pair | undefined {
  for (const p of verbPairs()) {
    if (!p.tuImp || !p.vosImp || p.tuImp === p.vosImp) continue;
    const base = stripAccents(p.vosImp);
    const tuBase = stripAccents(p.tuImp);
    const w = stripAccents(word);
    if (!w.startsWith(base) || w.length === base.length) continue;
    if (!CLITICS.test(w.slice(base.length))) continue;
    // Distinct stem ("decime", "ponelo", "hacelo", "venite", "andate") or
    // unaccented polysyllabic voseo ("hablame", "mirame", "escuchame") where
    // tuteo requires a written accent ("háblame", "mírame", "escúchame").
    const distinctStem = base !== tuBase;
    const unaccentedPolysyllabic = word === w && (base.match(/[aeiou]+/g) || []).length >= 2;
    if (distinctStem || unaccentedPolysyllabic) return p;
  }
  return undefined;
}

/** Bare imperative "ven" ("come!") vs 3pl present indicative "ven" ("they see"). */
function isBareImperativeVen(words: string[], index: number, rawText: string): boolean {
  if (words[index] !== "ven") return false;
  const prev = index > 0 ? words[index - 1] : undefined;
  if (prev && VER_3PL_PRECEDERS.has(prev)) return false;
  if (index === 0) return true;
  const next = words[index + 1];
  if (next && /^(?:aquí|acá|conmigo|para|a|ya|pronto|rápido)$/.test(next)) return true;
  // Clause-initial after punctuation (e.g. "Escúchame, ven." or "¡Ven!")
  return /(?:^|[,;:!?¡¿.]\s+)ven\b/i.test(rawText.normalize("NFC"));
}

export function checkAddressForms(translated: string, dialect: SpanishDialect): AddressFormResult {
  const violations: AddressFormViolation[] = [];
  const words = tokens(translated);
  const seen = new Set<string>();
  const add = (v: AddressFormViolation) => {
    const key = `${v.kind}:${v.found}`;
    if (!seen.has(key)) { seen.add(key); violations.push(v); }
  };

  const fullVoseo = FULL_VOSEO_DIALECTS.includes(dialect);
  const regionalVoseo = REGIONAL_VOSEO_DIALECTS.includes(dialect);

  if (fullVoseo) {
    const hasVos = words.includes("vos");
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === "tú") {
        add({ kind: "tu-in-voseo-dialect", found: "tú", expected: "vos",
          message: `"tú" is not used in ${dialect}; use "vos".` });
        continue;
      }
      const p = verbPairs().find((x) => x.tu === w && x.tu !== x.vos);
      if (p && !TU_HOMOGRAPHS.has(w)) {
        add({ kind: hasVos ? "mixed-voseo" : "tu-in-voseo-dialect", found: w, expected: p.vos,
          message: hasVos
            ? `"vos" with the tú verb "${w}"; ${dialect} says "${p.vos}".`
            : `"${w}" is the tú form; ${dialect} uses voseo "${p.vos}".` });
        continue;
      }
      if (BARE_TU_IMPERATIVES[w]) {
        add({ kind: "tu-in-voseo-dialect", found: w, expected: BARE_TU_IMPERATIVES[w],
          message: `"${w}" is a tú imperative; ${dialect} uses voseo "${BARE_TU_IMPERATIVES[w]}".` });
        continue;
      }
      if (isBareImperativeVen(words, i, translated)) {
        add({ kind: "tu-in-voseo-dialect", found: w, expected: "vení",
          message: `"${w}" is a tú imperative; ${dialect} uses voseo "vení".` });
        continue;
      }
      const imp = tuImperativeWithClitic(w);
      if (imp) {
        add({ kind: "tu-in-voseo-dialect", found: w, expected: imp.vosImp,
          message: `"${w}" is a tú imperative; ${dialect} uses the voseo imperative ("${imp.vosImp}" + pronoun).` });
      }
    }
  } else if (!regionalVoseo) {
    for (const w of words) {
      if (VOS_HOMOGRAPHS.has(w)) continue;
      const p = verbPairs().find((x) => x.vos === w && x.tu !== x.vos);
      if (p) {
        add({ kind: "voseo-in-tuteo-dialect", found: w, expected: p.tu,
          message: `"${w}" is a voseo form, not used in ${dialect}; use "${p.tu}".` });
        continue;
      }
      const vImp = !VOS_IMP_HOMOGRAPHS.has(w)
        ? verbPairs().find((x) => x.vosImp === w && x.tuImp && x.vosImp !== x.tuImp)
        : undefined;
      if (vImp) {
        add({ kind: "voseo-in-tuteo-dialect", found: w, expected: vImp.tuImp,
          message: `"${w}" is a voseo imperative, not used in ${dialect}; use "${vImp.tuImp}".` });
        continue;
      }
      const vClitic = vosImperativeWithClitic(w);
      if (vClitic) {
        add({ kind: "voseo-in-tuteo-dialect", found: w, expected: vClitic.tuImp,
          message: `"${w}" is a voseo imperative, not used in ${dialect}; use the tú imperative ("${vClitic.tuImp}" + pronoun).` });
      }
    }
  }

  if (dialect !== "es-ES") {
    verbPairs();
    for (const w of words) {
      const plural = /^(vosotr[oa]s|vuestr[oa]s?|sois)$/.test(w)
        || (/^\p{L}{3,}(áis|éis)$/u.test(w) && !AIS_EIS_NOUNS.has(w))
        || VOSOTROS_IMP_ENCLITIC.test(w)
        || (bareVosotrosImps?.has(w) ?? false);
      if (plural) {
        add({ kind: "vosotros-outside-spain", found: w, expected: "ustedes",
          message: `"${w}" is a vosotros form; ${dialect} uses "ustedes" and its third-person plural verbs.` });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
