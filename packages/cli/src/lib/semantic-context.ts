import type { SpanishDialect, FormalityLevel } from "@espanol/types";
import { getDialectInfo } from "./dialect-info.js";

export type SemanticDomain =
  | "technical"
  | "localization"
  | "security"
  | "business"
  | "support"
  | "marketing"
  | "general";

export type SemanticIntent =
  | "instructional"
  | "error-message"
  | "reference"
  | "promotional"
  | "support"
  | "general";

export interface SemanticContextSignals {
  domain: SemanticDomain;
  intent: SemanticIntent;
  register: FormalityLevel;
  matchedSignals: string[];
}

export interface BuildSemanticContextOptions {
  text: string;
  dialect: SpanishDialect;
  formality?: FormalityLevel;
  documentKind?: "plain" | "readme" | "api-docs" | "i18n";
  sectionType?: string;
}

const DOMAIN_PATTERNS: Array<{ domain: SemanticDomain; signals: RegExp[] }> = [
  { domain: "security", signals: [/\bauth(orization|entication)?\b/i, /\btoken\b/i, /\bsecret\b/i, /\bpermission\b/i, /\bssrf\b/i, /\bxss\b/i] },
  { domain: "localization", signals: [/\blocale\b/i, /\bi18n\b/i, /\btranslation memory\b/i, /\bglossary\b/i, /\bdialect\b/i] },
  { domain: "technical", signals: [/\bapi\b/i, /\bendpoint\b/i, /\bcli\b/i, /\bjson\b/i, /\bmarkdown\b/i, /\bfunction\b/i, /\bserver\b/i] },
  { domain: "business", signals: [/\binvoice\b/i, /\bbilling\b/i, /\bcontract\b/i, /\bsubscription\b/i, /\brevenue\b/i] },
  { domain: "support", signals: [/\bhelp\b/i, /\bsupport\b/i, /\btroubleshoot\b/i, /\bcontact us\b/i, /\bissue\b/i] },
  { domain: "marketing", signals: [/\blaunch\b/i, /\bsign up\b/i, /\btry it\b/i, /\bfeature\b/i, /\bbenefit\b/i] },
];

const INTENT_PATTERNS: Array<{ intent: SemanticIntent; signals: RegExp[] }> = [
  { intent: "error-message", signals: [/\berror\b/i, /\bfailed\b/i, /\binvalid\b/i, /\bnot found\b/i, /\bdenied\b/i] },
  { intent: "instructional", signals: [/\bclick\b/i, /\bselect\b/i, /\brun\b/i, /\binstall\b/i, /\bconfigure\b/i] },
  { intent: "reference", signals: [/\bparameter\b/i, /\breturns?\b/i, /\bexample\b/i, /\bendpoint\b/i, /\bfield\b/i] },
  { intent: "promotional", signals: [/\btry\b/i, /\bnew\b/i, /\bfast\b/i, /\bpowerful\b/i, /\bfree\b/i] },
  { intent: "support", signals: [/\bcontact\b/i, /\bhelp\b/i, /\btroubleshoot\b/i, /\bfaq\b/i] },
];

function scorePatterns<T extends string>(
  text: string,
  patterns: Array<{ [key: string]: unknown; signals: RegExp[] }>,
  key: string,
  fallback: T
): { value: T; matchedSignals: string[] } {
  let best = { value: fallback, score: 0, matchedSignals: [] as string[] };
  for (const item of patterns) {
    const matched = item.signals.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
    if (matched.length > best.score) {
      best = { value: item[key] as T, score: matched.length, matchedSignals: matched };
    }
  }
  return { value: best.value as T, matchedSignals: best.matchedSignals };
}

export function analyzeSemanticContext(
  text: string,
  requestedFormality: FormalityLevel = "auto"
): SemanticContextSignals {
  const domain = scorePatterns<SemanticDomain>(text, DOMAIN_PATTERNS, "domain", "general");
  const intent = scorePatterns<SemanticIntent>(text, INTENT_PATTERNS, "intent", "general");
  const formalMarkers = /\b(please|dear|sincerely|policy|contract|documentation|reference)\b/i.test(text);
  const informalMarkers = /\b(hey|cool|awesome|y'all|buddy|guys)\b/i.test(text);
  const register = requestedFormality !== "auto"
    ? requestedFormality
    : formalMarkers && !informalMarkers
      ? "formal"
      : informalMarkers
        ? "informal"
        : "auto";

  return {
    domain: domain.value,
    intent: intent.value,
    register,
    matchedSignals: [...domain.matchedSignals, ...intent.matchedSignals],
  };
}

export function buildSemanticTranslationContext(options: BuildSemanticContextOptions): string {
  const signals = analyzeSemanticContext(options.text, options.formality || "auto");
  const dialect = getDialectInfo(options.dialect);
  const dialectTerms = dialect
    ? [...dialect.formalTerms.slice(0, 4), ...dialect.slangTerms.slice(0, 4)].join(", ")
    : options.dialect;

  return [
    "Translate by preserving meaning, intent, and reader expectations; do not translate literally word-by-word.",
    `Target dialect: ${dialect?.name || options.dialect} (${options.dialect}).`,
    `Document domain: ${signals.domain}; intent: ${signals.intent}; register: ${signals.register}.`,
    options.documentKind ? `Document kind: ${options.documentKind}.` : undefined,
    options.sectionType ? `Current section type: ${options.sectionType}.` : undefined,
    dialectTerms ? `Use regional vocabulary naturally where appropriate; examples/signals: ${dialectTerms}.` : undefined,
    "Preserve product names, code identifiers, URLs, placeholders, markdown structure, and glossary-locked terms.",
    "Prefer idiomatic Spanish for the target audience over one-to-one lexical substitution.",
  ].filter(Boolean).join(" ");
}
