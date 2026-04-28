import type { SpanishDialect, FormalityLevel } from "@dialectos/types";
import { buildDialectQualityPrompt, getDialectGrammarProfile, buildDialectVocabularyPrompt, buildConjugationPrompt, getSyntacticRules } from "@dialectos/types";
import { getDialectInfo } from "./dialect-info.js";
import { buildLexicalAmbiguityGuidance } from "./lexical-ambiguity.js";

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

function buildDictionaryPrompt(dialect: SpanishDialect): string | undefined {
  const vocabPrompt = buildDialectVocabularyPrompt(dialect);
  const conjPrompt = buildConjugationPrompt(dialect);
  const rules = getSyntacticRules(dialect);
  const ruleText = rules.length > 0 ? rules.map(r => r.rule).join(" ") : undefined;
  const parts = [vocabPrompt, conjPrompt, ruleText].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function buildOutputConstraintPrompt(text: string, dialect: SpanishDialect): string | undefined {
  const constraints: string[] = [
    "Do not copy forbidden examples, taboo examples, or ambiguity warnings into the output.",
    "If this context says a term is avoid-by-default or never-unless-requested, never emit that term unless it appears in the source text.",
  ];
  const lower = text.toLowerCase();

  if (dialect === "es-BO" && /\bhot sauce\b/.test(lower)) {
    constraints.push("For Bolivian food-context hot sauce, the output must include one of: llajwa, llajua.");
  }
  if (dialect === "es-CL" && /\bavocado\b/.test(lower)) {
    constraints.push("For Chilean food-context avocado, the output must use palta, not aguacate.");
  }
  if (dialect === "es-PR" && /\borange juice\b|\bjugo de naranja\b|\bjugo de china\b/.test(lower)) {
    constraints.push("For Puerto Rican citrus-context orange juice, the output must use jugo de china; do not use jugo de naranja unless explicitly explaining non-Puerto-Rican usage.");
  }
  if (dialect !== "es-PR" && dialect !== "es-DO" && /\bjugo de china\b/.test(lower)) {
    constraints.push("If the source says Puerto Rican jugo de china, preserve the orange-juice meaning for this target dialect with naranja, not China/china.");
  }
  if ((dialect === "es-PR" || dialect === "es-DO" || dialect === "es-CU") && /\b(baby|infant|newborn)\b/.test(lower)) {
    constraints.push(`For ${dialect} baby/infant context, use bebé/niño/infante; do not use guagua because guagua is transit-coded in this dialect.`);
  }
  if ((dialect === "es-CU" || dialect === "es-DO" || dialect === "es-PR") && /\bbus\b/.test(lower)) {
    constraints.push(`For ${dialect} transit-context bus, the output should use guagua, not bus/autobús, unless the source explicitly asks for generic Spanish.`);
  }
  if (dialect === "es-PA" && /\bbus\b/.test(lower)) {
    constraints.push("For Panamanian transit-context bus, keep bus as bus. The output must not contain: cueco, chombo, yeyé.");
  }
  if (dialect === "es-MX" && /\bpick up\b/.test(lower) && /\bfile\b/.test(lower)) {
    constraints.push("For technical file pickup, use the exact correct form recoge (preferred), recoger, toma, or agarra by meaning; do not use the invalid form recoga, do not use coger, and do not change the intent to download unless the source says download.");
  }
  if (dialect === "es-PH" && /\bphilippine names\b/.test(lower)) {
    constraints.push("For Philippine names, preserve the Philippine reference using Filipinas/filipinos/filipinas rather than only singular adjectival filipino.");
  }
  if (dialect === "es-US" && /\bpark the car\b/.test(lower)) {
    constraints.push("For formal U.S. Spanish public-service parking instructions, use singular respectful wording such as estacione/estaciona/parquee/parquea; do not use Spain-only aparcar.");
  }
  if ((dialect === "es-GT" || dialect === "es-HN" || dialect === "es-NI" || dialect === "es-SV") && /\byou can update your account now\b/.test(lower)) {
    constraints.push(`For informal ${dialect} account-update copy, the output must use Central American voseo such as vos podés/podés; do not use tú/puedes.`);
  }

  return constraints.length >= 2
    ? `Output constraints: ${constraints.join(" ")}`
    : undefined;
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
  const grammarProfile = getDialectGrammarProfile(options.dialect);
  const qualityPrompt = buildDialectQualityPrompt(options.dialect);
  const outputConstraintPrompt = buildOutputConstraintPrompt(options.text, options.dialect);
  const lexicalAmbiguityGuidance = buildLexicalAmbiguityGuidance(options.text, options.dialect);
  const dialectTerms = dialect
    ? [...dialect.formalTerms.slice(0, 4), ...dialect.slangTerms.slice(0, 4)].join(", ")
    : options.dialect;
  const grammarGuidance = grammarProfile
    ? [
        grammarProfile.pluralAddress,
        ...grammarProfile.voseo.notes.slice(0, 2),
        ...grammarProfile.leismoLaismoLoismoNotes.slice(0, 1),
        ...grammarProfile.formalityNorms.slice(0, 2),
        ...grammarProfile.tabooAndAmbiguityNotes.slice(0, 2),
        ...grammarProfile.semanticPromptGuidance,
      ].join(" ")
    : undefined;

  return [
    "Translate by preserving meaning, intent, and reader expectations; do not translate literally word-by-word.",
    `Target dialect: ${dialect?.name || options.dialect} (${options.dialect}).`,
    `Document domain: ${signals.domain}; intent: ${signals.intent}; register: ${signals.register}.`,
    options.documentKind ? `Document kind: ${options.documentKind}.` : undefined,
    options.sectionType ? `Current section type: ${options.sectionType}.` : undefined,
    dialectTerms ? `Use regional vocabulary naturally where appropriate; examples/signals: ${dialectTerms}.` : undefined,
    buildDictionaryPrompt(options.dialect),
    grammarGuidance ? `Dialect grammar and style profile: ${grammarGuidance}` : undefined,
    qualityPrompt ? `Dialect quality contract: ${qualityPrompt}` : undefined,
    lexicalAmbiguityGuidance,
    outputConstraintPrompt,
    "Preserve product names, code identifiers, URLs, placeholders, markdown structure, and glossary-locked terms.",
    "Prefer idiomatic Spanish for the target audience over one-to-one lexical substitution.",
  ].filter(Boolean).join(" ");
}
