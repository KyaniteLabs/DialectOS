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
// Spain-only plural nouns ending in -éis that are not verbs.
const EIS_NOUNS = new Set(["jerséis"]);

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

interface Pair { tu: string; vos: string; tuImp?: string; vosImp?: string }
let pairs: Pair[] | undefined;
function verbPairs(): Pair[] {
  if (pairs) return pairs;
  pairs = [];
  for (const v of VERB_CONJUGATIONS) {
    if (v.category !== "conjugation-pattern") continue;
    const tu = v.forms["es-ES"];
    const vos = v.forms["es-AR"];
    if (!tu?.present_2s || !vos?.present_2s) continue;
    pairs.push({
      tu: tu.present_2s.toLowerCase(),
      vos: vos.present_2s.toLowerCase(),
      tuImp: tu.imperative_2s?.toLowerCase(),
      vosImp: vos.imperative_2s?.toLowerCase(),
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
    for (const w of words) {
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
      }
    }
  }

  if (dialect !== "es-ES") {
    for (const w of words) {
      const plural = /^(vosotr[oa]s|vuestr[oa]s?|sois)$/.test(w)
        || (/^\p{L}{3,}(áis|éis)$/u.test(w) && !EIS_NOUNS.has(w));
      if (plural) {
        add({ kind: "vosotros-outside-spain", found: w, expected: "ustedes",
          message: `"${w}" is a vosotros form; ${dialect} uses "ustedes" and its third-person plural verbs.` });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
