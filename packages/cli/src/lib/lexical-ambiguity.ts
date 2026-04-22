import type { SpanishDialect } from "@espanol/types";

export interface LexicalAmbiguityRule {
  id: string;
  dialects: readonly SpanishDialect[] | "all";
  sourcePattern: RegExp;
  guidance: string;
}

const TABOO_RISK_COGER_DIALECTS: readonly SpanishDialect[] = [
  "es-MX", "es-AR", "es-CL", "es-CO", "es-VE",
  "es-US", "es-PA", "es-PR", "es-DO", "es-CU",
  "es-PE", "es-EC", "es-BO", "es-PY", "es-UY",
  "es-GT", "es-HN", "es-SV", "es-NI", "es-CR",
  "es-BZ",
];

export const LEXICAL_AMBIGUITY_RULES: readonly LexicalAmbiguityRule[] = [
  {
    id: "pickup-file",
    dialects: TABOO_RISK_COGER_DIALECTS,
    sourcePattern: /\b(pick up|grab|get|take)\b.{0,40}\b(file|files|document|documents|attachment|attachments)\b/i,
    guidance: "For retrieving files/documents, use recoger/recoge/recuperar as appropriate. Do not use coger. Do not change the action to descargar/download unless the source explicitly says download.",
  },
  {
    id: "pickup-package",
    dialects: TABOO_RISK_COGER_DIALECTS,
    sourcePattern: /\b(pick up|grab|get|take)\b.{0,40}\b(package|packages|parcel|order|badge|ticket)\b/i,
    guidance: "For physical pickup of an item, use recoger/recoge or retirar/retira according to register. Agarrar can work in casual physical-grab contexts. Do not use coger in taboo-risk dialects.",
  },
  {
    id: "take-bus",
    dialects: "all",
    sourcePattern: /\b(take|catch|ride|get on|board)\b.{0,30}\b(bus|train|metro|subway|taxi|cab|shuttle)\b/i,
    guidance: "For taking transportation, use tomar/toma or abordar/aborda by register and dialect. Do not use coger outside Spain/Andorra. Preserve dialect-specific vehicle terms such as guagua where the dialect contract requires them.",
  },
  {
    id: "take-photo",
    dialects: "all",
    sourcePattern: /\b(take|snap|capture)\b.{0,30}\b(photo|picture|screenshot|screen shot|image)\b/i,
    guidance: "For taking a photo/screenshot, use tomar or sacar/capturar according to dialect and UI register. Never literalize this as coger.",
  },
  {
    id: "take-medicine",
    dialects: "all",
    sourcePattern: /\b(take)\b.{0,30}\b(medicine|medication|pill|dose|tablet)\b/i,
    guidance: "For taking medicine, use tomar. Do not use coger/agarrar/recoger.",
  },
  {
    id: "grab-bag",
    dialects: TABOO_RISK_COGER_DIALECTS,
    sourcePattern: /\b(grab|take)\b.{0,30}\b(bag|keys|phone|laptop|backpack)\b/i,
    guidance: "For physically grabbing a personal object, use agarrar/tomar depending on register. Do not use coger in taboo-risk dialects.",
  },
];

function appliesToDialect(rule: LexicalAmbiguityRule, dialect: SpanishDialect): boolean {
  return rule.dialects === "all" || rule.dialects.includes(dialect);
}

export function buildLexicalAmbiguityGuidance(text: string, dialect: SpanishDialect): string | undefined {
  const matched = LEXICAL_AMBIGUITY_RULES.filter((rule) =>
    appliesToDialect(rule, dialect) && rule.sourcePattern.test(text)
  );

  if (matched.length === 0) {
    return undefined;
  }

  return [
    "Lexical ambiguity constraints:",
    ...matched.map((rule) => `[${rule.id}] ${rule.guidance}`),
  ].join(" ");
}

