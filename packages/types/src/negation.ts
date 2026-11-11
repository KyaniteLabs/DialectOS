/**
 * Negation preservation, shared by the provider quality gates and the CLI
 * validator. A translation that drops "not" inverts the instruction
 * ("You must not delete the file" -> "Debes eliminar el archivo"), so this is
 * a hard check, not a score.
 *
 * The word lists are deliberately narrow: only grammatical negators, never
 * verbs like "stop" or "avoid", whose Spanish renderings carry no negator.
 */

const NEGATORS_EN = new Set([
  "not", "no", "never", "nothing", "nobody", "nowhere", "neither", "nor",
  "none", "cannot", "without",
]);

const NEGATORS_ES = new Set([
  "no", "nunca", "jamás", "nada", "nadie", "ninguno", "ninguna", "ningún",
  "ningunos", "ningunas", "ni", "sin", "tampoco",
]);

function words(text: string): string[] {
  return (text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/n't\b/g, " not")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countNegators(text: string, lang: "en" | "es"): number {
  const set = lang === "en" ? NEGATORS_EN : NEGATORS_ES;
  return words(text).filter((w) => set.has(w)).length;
}

/** True when the English source negates and the Spanish output has no negator at all. */
export function negationDropped(source: string, translated: string): boolean {
  return countNegators(source, "en") > 0 && countNegators(translated, "es") === 0;
}
