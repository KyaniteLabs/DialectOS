/**
 * Spanish term matching for the lexical checks.
 *
 * A required or forbidden term must still match when the translation inflects
 * it or adds a written accent: "agarrá" (voseo imperative) and "coged"
 * (vosotros imperative) both satisfy a rule that lists "agarrar" or "coger".
 * Before this, the exact whole-word match failed a correct es-AR "Agarrá las
 * frutillas" for a missing "take" verb.
 */

const ENCLITICS = "(?:me|te|lo|la|los|las|le|les|nos|se)*";

// Inflections that may follow a verb stem, written without accents because
// both sides are compared accent-folded.
const VERB_ENDINGS = [
  "a", "as", "amos", "ais", "ad", "an", "ar", "ando", "ado", "ada", "ados", "adas",
  "aba", "abas", "aban", "ara", "aran", "aria", "aste", "aron",
  "e", "es", "emos", "eis", "ed", "en", "er", "era", "eran", "eria",
  "i", "is", "imos", "id", "ir", "ira", "iran", "iria",
  "ia", "ias", "ian", "iendo", "ido", "ida", "idos", "idas", "iste", "io", "ieron",
  "o",
].join("|");

export function foldAccents(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-́̈]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const cache = new Map<string, RegExp>();

/** Regex matching a term as a whole word in accent-folded text, inflected when it is an infinitive. */
function termRegex(term: string): RegExp {
  const key = term;
  const hit = cache.get(key);
  if (hit) return hit;
  const folded = foldAccents(term).trim();
  let body = escapeRegExp(folded);
  const inf = /^(\p{L}{2,})(ar|er|ir)$/u.exec(folded);
  if (inf && !folded.includes(" ")) {
    const stems = new Set([inf[1]]);
    // Orthographic stem changes before a/o: coger -> coja, seguir -> siga.
    if (inf[1].endsWith("g") && inf[2] !== "ar") stems.add(inf[1].slice(0, -1) + "j");
    if (inf[1].endsWith("gu") && inf[2] === "ir") stems.add(inf[1].slice(0, -1));
    if (inf[1].endsWith("c") && inf[2] === "ar") stems.add(inf[1].slice(0, -1) + "qu");
    if (inf[1].endsWith("g") && inf[2] === "ar") stems.add(inf[1] + "u");
    body = `(?:${escapeRegExp(folded)}|(?:${[...stems].map(escapeRegExp).join("|")})(?:${VERB_ENDINGS})${ENCLITICS})`;
  }
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${body}(?=$|[^\\p{L}\\p{N}_])`, "u");
  cache.set(key, re);
  return re;
}

/** True when the term (or, for an infinitive, any inflection of it) appears in text. */
export function hasTerm(text: string, term: string): boolean {
  if (!term) return false;
  return termRegex(term).test(foldAccents(text));
}
