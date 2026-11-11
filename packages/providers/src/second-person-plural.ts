/**
 * Spain uses "vosotros" for the informal second person plural; every other
 * variant uses "ustedes". This swaps the pronoun and its possessives.
 *
 * Verb endings ("tenéis" -> "tienen") are not conjugated here.
 */

import type { SpanishDialect } from "@dialectos/types";
import { applyCase } from "./morphology.js";

const RULES: Array<{ from: RegExp; to: (m: string, g1?: string) => string }> = [
  { from: /(?<![\p{L}\p{N}])vosotr[oa]s(?![\p{L}\p{N}])/giu, to: (m) => applyCase(m, "ustedes") },
  {
    from: /(?<![\p{L}\p{N}])vuestr([oa]s?)(?![\p{L}\p{N}])/giu,
    to: (m, g1 = "") => applyCase(m, g1.endsWith("s") ? "sus" : "su"),
  },
];

/** Replace vosotros forms with ustedes forms for any variant other than es-ES. */
export function adaptSecondPersonPlural(text: string, dialect: SpanishDialect): string {
  if (!text || dialect === "es-ES") return text;
  let out = text;
  for (const { from, to } of RULES) out = out.replace(from, (m, g1) => to(m, g1));
  return out;
}
