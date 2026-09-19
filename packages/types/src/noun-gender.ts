/**
 * Spanish noun gender database and lookup.
 *
 * Provides grammatical gender (m/f) for Spanish nouns using:
 * 1. An exception map for nouns whose gender doesn't follow morphology
 * 2. Morphological rules as fallback (most -o = m, most -a = f)
 *
 * Used by the agreement validator and prompt hint generation to catch
 * article-noun mismatches like "el computadora" or "la mapa".
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type NounGender = "m" | "f";

// Nouns ending in -a that are MASCULINE (exception to the -a = feminine rule)
const MASC_A_ENDINGS: ReadonlySet<string> = new Set([
  "mapa", "problema", "sistema", "tema", "idioma", "drama", "clima",
  "programa", "planeta", "poema", "lema", "diagrama", "telegrama",
  "fantasma", "aroma", "axioma", "cinema", "croma", "dogma",
  "ema", "enigma", "epigrama", "esquema", "estigma", "estratega",
  "guru", "huracan", "lingua", "monarca", "paraguas", "piloto",
  "sofa", "taxista", "testigo", "tranvia", "turista", "atleta",
  "artista", "optimista", "periodista", "pianista", "ventilador",
  // NOTE: "papa" (potato) is intentionally NOT here — it is feminine in the
  // food sense ("la papa"); only the Pope is "el Papa".
]);

// Homograph nouns whose ARTICLE carries meaning: the same spelling is a
// different word depending on the article, so no single gender can be
// resolved. For these the engine must NEVER rewrite the article —
// `resolveNounGender` returns undefined so every consumer preserves the
// source article verbatim, and the agreement validator surfaces an
// informational note instead of a correction.
//
// CEO rule, 2026-09-19: "el papa" (the Pope) / "la papa" (the potato) /
// "el papá" (the dad) are three different words, all correct as written.
const AMBIGUOUS_NOUNS: ReadonlySet<string> = new Set([
  "papa",   // el papa (Pope) / la papa (potato) — real dialectal swap (concept "potato": patata/papa)
  "cometa", // el cometa (astronomy) / la cometa (kite) — corpus term (concept "kite_toy")
  "guía",   // el guía (male guide) / la guía (female guide, guidebook) — RAE: amb.
  "frente", // la frente (forehead) / el frente (battle/political front) — no rule today; listed to stay safe
  "orden",  // la orden (command, religious order) / el orden (order/sequence) — no rule today; listed to stay safe
]);

// Nouns ending in -o or consonant that are FEMININE (exception to the -o = masculine rule)
const FEM_EXCEPTIONS: ReadonlySet<string> = new Set([
  "mano", "foto", "moto", "radio", "flor", "labor",
  "sal", "miel", "piel",
  "suerte", "noche",
  "calle", "llave", "base", "clase", "clave", "especie",
  "frase", "gente", "ley", "luz", "mente", "muerte",
  "nariz", "nube", "parte", "paz", "piedra", "pez",
  "prueba", "purga", "red", "serie", "sed", "sidra",
  "simiente", "sorpresa", "tarde", "torre", "trampa",
  // Dialect-specific nouns with tricky gender
  "guagua",  // feminine in Cuba/DR/PR/Canarias (bus)
  "plata",   // feminine (money/silver) — not actually an exception but often confused
  // NOTE: "color" and "calor" are masculine ("el color", "el calor") and are
  // resolved correctly by the -or morphological rule; do not list them here.
]);

// Direct gender map for nouns that don't follow any reliable rule.
// Loaded from gender-overrides.json at runtime.
const genderOverrideData: Record<string, string> = JSON.parse(
  readFileSync(join(__dirname, "gender-overrides.json"), "utf-8")
);

const GENDER_OVERRIDES: ReadonlyMap<string, NounGender> = new Map(
  Object.entries(genderOverrideData) as [string, NounGender][]
);

/**
 * Try to convert a plural noun to its singular form.
 * Returns the singular form, or the original if not clearly plural.
 */
function singularize(word: string): string {
  // Words ending in -ces → -z (e.g., "voces" → "voz", "laces" → "laz")
  if (word.endsWith("ces") && word.length > 4) {
    return word.slice(0, -3) + "z";
  }
  // Words ending in -es (consonant-stem plurals): "ciudades" → "ciudad"
  if (word.endsWith("es") && word.length > 3) {
    const withoutEs = word.slice(0, -2);
    // Check if singular form exists in overrides — if so, use it
    if (GENDER_OVERRIDES.has(withoutEs)) return withoutEs;
    // Otherwise just strip -es
    return withoutEs;
  }
  // Words ending in -s (vowel-stem plurals): "carros" → "carro", "casas" → "casa"
  if (word.endsWith("s") && word.length > 2) {
    const withoutS = word.slice(0, -1);
    // Don't strip -s from short words or words ending in consonant+s (already singular-ish)
    if (GENDER_OVERRIDES.has(withoutS)) return withoutS;
    // If it ends in vowel+s, strip the s
    if (/[aeiou]$/.test(withoutS)) return withoutS;
  }
  return word;
}

const ACCENT_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u",
};

/**
 * Resolve the grammatical gender of a Spanish noun.
 *
 * Priority:
 * 1. Accent-sensitive overrides — keys stored WITH an accent are distinct
 *    words ("papá" = dad, masculine), not spelling variants of the
 *    unaccented twin ("papa" = ambiguous homograph)
 * 2. Ambiguous homographs — never resolved; the article is meaning-bearing
 *    ("el papa"/"la papa") and consumers must preserve it verbatim
 * 3. Explicit override map (unaccented keys: "autobús" → "autobus")
 * 4. Exception lists (masculine -a nouns, feminine -o/consonant nouns)
 * 5. Morphological rules (-o → m, -a → f, -ción/-dad → f, -aje/-or → m, etc.)
 *
 * Returns undefined for words that aren't recognizable as Spanish nouns
 * and for ambiguous homographs (use `isAmbiguousNoun` to tell them apart).
 */
export function resolveNounGender(noun: string): NounGender | undefined {
  const lower = noun.toLowerCase();
  // Unaccented twin: override keys and exception lists are stored without
  // accents ("autobus"), so lookups must normalize "autobús" -> "autobus".
  // Morphological suffix checks below keep the accented form (ción, ón).
  const plain = lower.replace(/[áéíóúü]/g, (c) => ACCENT_MAP[c] ?? c);

  // 1. Accent-sensitive override lookup: the verbatim accented form is a
  //    DIFFERENT WORD ("papá" the dad), checked before accent normalization
  //    and before the ambiguity check below.
  const accentedOverride = GENDER_OVERRIDES.get(lower);
  if (accentedOverride) return accentedOverride;

  // 2. Ambiguous homographs ("el papa"/"la papa"): exact, accent-preserving
  //    match only — never match the unaccented twin of a different word.
  //    Checked before the unaccented override path so stale data in
  //    gender-overrides.json can never re-enable article rewriting here.
  if (AMBIGUOUS_NOUNS.has(lower)) return undefined;

  // 3. Explicit overrides (unaccented keys)
  const override = GENDER_OVERRIDES.get(plain);
  if (override) return override;

  // 4. Singularize if plural and try again. The accented singular carries
  //    word identity ("papás" → "papá" → masculine; "papas" → "papa" →
  //    ambiguous), so it is checked before the unaccented singular.
  const singularAccented = singularize(lower);
  if (singularAccented !== lower) {
    const singularAccentedOverride = GENDER_OVERRIDES.get(singularAccented);
    if (singularAccentedOverride) return singularAccentedOverride;
    if (AMBIGUOUS_NOUNS.has(singularAccented)) return undefined;
  }

  const singular = singularize(plain);
  if (singular !== plain) {
    const singularOverride = GENDER_OVERRIDES.get(singular);
    if (singularOverride) return singularOverride;
    // Check exceptions with singular form
    if (MASC_A_ENDINGS.has(singular)) return "m";
    if (FEM_EXCEPTIONS.has(singular)) return "f";
    // Morphological rules on singular form
    if (singular.endsWith("o")) return "m";
    if (singular.endsWith("a")) return "f";
    if (/(?:ción|sión|dad|tad|tud|umbre|icie|eza|encia|ancia)$/.test(singular)) return "f";
    if (/(?:aje|or|ón|án|és)$/.test(singular)) return "m";
  }

  // Strip articles if present (e.g., "la casa" → "casa")
  const stripped = lower.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "");
  const strippedPlain = plain.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "");

  // 2. Check exception lists
  if (MASC_A_ENDINGS.has(strippedPlain)) return "m";
  if (FEM_EXCEPTIONS.has(strippedPlain)) return "f";

  // 3. Morphological rules
  if (stripped.endsWith("o")) return "m";
  if (stripped.endsWith("a")) return "f";

  // Feminine suffixes
  if (/(?:ción|sión|dad|tad|tud|umbre|icie|eza|encia|ancia|logía|grafía)$/.test(stripped)) return "f";
  if (/(?:cion|sion)$/.test(strippedPlain)) return "f";

  // Masculine suffixes
  if (/(?:aje|or|ón|án|és|al|il|ar|ero|orio|ico|ismo|ista)$/.test(stripped)) return "m";

  // -e is mixed — no reliable rule
  // -i, -u are rare for nouns

  return undefined;
}

/**
 * Check if a noun is a gender homograph whose article carries meaning
 * ("el papa" the Pope / "la papa" the potato / "el papá" the dad).
 *
 * Consumers must preserve the source article of these nouns verbatim
 * and, where they report diagnostics, emit an informational note
 * instead of a correction.
 */
export function isAmbiguousNoun(noun: string): boolean {
  const lower = noun.toLowerCase();
  if (AMBIGUOUS_NOUNS.has(lower)) return true;
  // Plural forms ("las papas", "las guías") inherit the ambiguity of
  // their singular; singularize preserves accents, so "papás" (dads)
  // singularizes to "papá", which is NOT ambiguous.
  const singular = singularize(lower);
  return singular !== lower && AMBIGUOUS_NOUNS.has(singular);
}

/**
 * Check if an article matches a noun's gender.
 * Returns true if they agree, false if they disagree, undefined if gender unknown.
 */
export function articleMatchesNoun(article: string, noun: string): boolean | undefined {
  const gender = resolveNounGender(noun);
  if (!gender) return undefined;

  const art = article.toLowerCase();

  const mascArticles = new Set(["el", "un", "del", "al", "los", "unos", "ese", "aquel", "este"]);
  const femArticles = new Set(["la", "una", "de la", "a la", "las", "unas", "esa", "aquella", "esta"]);

  if (gender === "m") return mascArticles.has(art) || !femArticles.has(art);
  if (gender === "f") return femArticles.has(art) || !mascArticles.has(art);

  return undefined;
}

/**
 * Get the definite article for a noun based on its gender.
 */
export function definiteArticle(noun: string): string {
  return resolveNounGender(noun) === "f" ? "la" : "el";
}

/**
 * Get the indefinite article for a noun based on its gender.
 */
export function indefiniteArticle(noun: string): string {
  return resolveNounGender(noun) === "f" ? "una" : "un";
}
