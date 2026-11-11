/**
 * Deterministic voseo adapter post-processor.
 *
 * For voseo dialects, scans Spanish text for tú verb forms and swaps them
 * to the corresponding vos forms using the conjugation tables.
 *
 * Only activates for dialects where voseo is standard (FULL_VOSEO_DIALECTS)
 * or common in informal registers (REGIONAL_VOSEO_DIALECTS).
 */

import type { SpanishDialect } from "@dialectos/types";
import {
  VERB_CONJUGATIONS,
  FULL_VOSEO_DIALECTS,
  REGIONAL_VOSEO_DIALECTS,
} from "@dialectos/types";
import { applyCase } from "./morphology.js";

interface VoseoSwap {
  tuForm: string;
  vosForm: string;
  infinitive: string;
  mood: "present" | "imperative";
}

// Cache: dialect → array of voseo swaps
const voseoCache = new Map<SpanishDialect, VoseoSwap[]>();

function buildVoseoSwaps(dialect: SpanishDialect): VoseoSwap[] {
  const swaps: VoseoSwap[] = [];
  for (const verb of VERB_CONJUGATIONS) {
    if (verb.category !== "conjugation-pattern") continue;
    const tu = verb.forms["es-ES"];
    const vos = verb.forms[dialect];
    if (!tu || !vos) continue;

    if (tu.present_2s && vos.present_2s && tu.present_2s !== vos.present_2s) {
      swaps.push({
        tuForm: tu.present_2s.toLowerCase(),
        vosForm: vos.present_2s,
        infinitive: verb.infinitive,
        mood: "present",
      });
    }
    // NOTE: Imperative swaps are disabled because Spanish imperatives often
    // collide with common nouns (e.g. "cuenta" = noun "account" vs imperative
    // of "contar"). Without sentence parsing, imperative substitution has
    // unacceptable false-positive rates. Present-tense forms are unambiguous.
    // if (tu.imperative_2s && vos.imperative_2s && tu.imperative_2s !== vos.imperative_2s) {
    //   swaps.push({
    //     tuForm: tu.imperative_2s.toLowerCase(),
    //     vosForm: vos.imperative_2s,
    //     infinitive: verb.infinitive,
    //     mood: "imperative",
    //   });
    // }
  }
  return swaps;
}

function getVoseoSwaps(dialect: SpanishDialect): VoseoSwap[] {
  let swaps = voseoCache.get(dialect);
  if (!swaps) {
    swaps = buildVoseoSwaps(dialect);
    voseoCache.set(dialect, swaps);
  }
  return swaps;
}

/** Build a regex that matches a word with word boundaries. */
function wordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "giu");
}

/**
 * Check if a dialect should receive voseo swaps.
 *
 * - Full voseo dialects: always swap unless explicitly formal
 * - Regional voseo dialects: only swap when explicitly informal
 * - Tú-only dialects: never swap
 */
function shouldApplyVoseo(dialect: SpanishDialect, formality?: string): boolean {
  if (FULL_VOSEO_DIALECTS.includes(dialect)) {
    return formality !== "formal";
  }
  if (REGIONAL_VOSEO_DIALECTS.includes(dialect)) {
    return formality === "informal";
  }
  return false;
}

/**
 * Apply deterministic voseo verb substitution.
 *
 * @param text - Spanish text to process
 * @param dialect - Target Spanish dialect
 * @param formality - Formality level (skip voseo if "formal")
 * @returns Text with voseo verb forms where appropriate
 */
export function applyVoseo(text: string, dialect: SpanishDialect, formality?: string): string {
  if (!text || !dialect || !shouldApplyVoseo(dialect, formality)) return text;

  const swaps = getVoseoSwaps(dialect);
  if (swaps.length === 0) return text;

  // Sort by tuForm length descending for priority matching
  const sorted = [...swaps].sort((a, b) => b.tuForm.length - a.tuForm.length);

  // Quoted text is someone's exact words and stays as written.
  return mapOutsideQuotes(text, (segment) => {
    let result = segment;
    for (const swap of sorted) {
      const regex = wordRegex(swap.tuForm);
      result = result.replace(regex, (match, before, after) => {
        const matched = match.slice(before.length, match.length - after.length);
        const replacement = applyCase(matched, swap.vosForm);
        return `${before}${replacement}${after}`;
      });
    }
    // The pronoun moves with its verb: "tú tienes" becomes "vos tenés",
    // never the hybrid "tú tenés".
    for (const [tuForm, vosForm] of PRONOUN_SWAPS) {
      result = result.replace(wordRegex(tuForm), (match, before, after) => {
        const matched = match.slice(before.length, match.length - after.length);
        return `${before}${applyCase(matched, vosForm)}${after}`;
      });
    }
    result = result.replace(PREPOSITIONAL_TI, (match, prep: string) =>
      match.endsWith("ti") ? `${prep}vos` : match
    );
    return result;
  });
}

/** Second-person pronouns that change with voseo. Possessive "tu" and clitic "te" do not. */
const PRONOUN_SWAPS: ReadonlyArray<[string, string]> = [
  ["contigo", "con vos"],
  ["tú", "vos"],
];

/** "ti" only after a preposition, lowercase, so "el equipo de TI" (IT) is left alone. */
const PREPOSITIONAL_TI =
  /(?<![\p{L}\p{N}])((?:a|ante|con|contra|de|desde|en|entre|hacia|hasta|para|por|según|sin|sobre|tras)\s+)ti(?![\p{L}\p{N}])/giu;

const QUOTED = /"[^"\n]*"|“[^”]*”|«[^»]*»/g;

/** Apply `fn` to the parts of `text` that are not inside quotation marks. */
function mapOutsideQuotes(text: string, fn: (segment: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(QUOTED)) {
    out += fn(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(text.slice(last));
}
