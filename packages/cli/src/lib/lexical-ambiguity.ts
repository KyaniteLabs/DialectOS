import type { SpanishDialect } from "@espanol/types";

export interface LexicalAmbiguityRule {
  id: string;
  dialects: readonly SpanishDialect[] | "all";
  sourcePattern: RegExp;
  guidance: string;
  expectations?: {
    requiredOutputGroups?: readonly (readonly string[])[];
    forbiddenOutputTerms?: readonly string[];
  } | ((dialect: SpanishDialect) => {
    requiredOutputGroups?: readonly (readonly string[])[];
    forbiddenOutputTerms?: readonly string[];
  });
}

export interface LexicalAmbiguityExpectations {
  matchedRuleIds: string[];
  requiredOutputGroups: string[][];
  forbiddenOutputTerms: string[];
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
    id: "citrus-orange-juice",
    dialects: "all",
    sourcePattern: /\b(orange juice|jugo de naranja|zumo de naranja|jugo de china)\b/i,
    guidance: "For the citrus/orange-juice semantic field, resolve regional polysemy instead of translating china literally. In Puerto Rican Spanish, jugo de china is the natural orange juice expression. In Dominican Spanish, china may also refer to orange in this field. For other dialects, use naranja/anaranjado according to fruit/color context and do not leave china unless quoting a Puerto Rican/Dominican expression.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["jugo", "zumo"],
        dialect === "es-PR" || dialect === "es-DO"
          ? ["china", "naranja"]
          : ["naranja"],
      ],
      forbiddenOutputTerms: dialect === "es-PR" || dialect === "es-DO" ? [] : ["china"],
    }),
  },
  {
    id: "citrus-orange-color",
    dialects: "all",
    sourcePattern: /\b(orange color|color naranja|color china|chinita)\b/i,
    guidance: "For the orange color semantic field, Puerto Rican Spanish may use china/chinita colloquially, while most dialects prefer naranja or anaranjado. Do not confuse the color with the country China.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-PR" ? ["china", "chinita", "naranja", "anaranjado"] : ["naranja", "anaranjado"],
      ],
      forbiddenOutputTerms: dialect === "es-PR" ? [] : ["china", "chinita"],
    }),
  },
  {
    id: "baby-guagua",
    dialects: "all",
    sourcePattern: /\b(baby|infant|newborn|beb[eé]|guagua)\b/i,
    guidance: "For the baby/infant semantic field, guagua is natural in Chilean and some Andean varieties, but in Puerto Rican, Dominican, and Cuban Spanish guagua strongly points to bus in transit contexts. Use bebé/niño/infante for babies in Caribbean Spanish; do not use guagua there unless the source is about a bus.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-CL" || dialect === "es-EC" || dialect === "es-BO" || dialect === "es-PE"
          ? ["guagua", "bebé", "bebe", "niño", "niña", "infante"]
          : ["bebé", "bebe", "niño", "niña", "infante"],
      ],
      forbiddenOutputTerms: dialect === "es-PR" || dialect === "es-DO" || dialect === "es-CU" ? ["guagua"] : [],
    }),
  },
  {
    id: "pickup-file",
    dialects: "all",
    sourcePattern: /\b(pick up|grab|get|take)\b.{0,40}\b(file|files|document|documents|attachment|attachments)\b/i,
    guidance: "For retrieving files/documents, use recoger/recoge, recuperar/recupera, obtener/obtén, or buscar/busca according to context. Do not change the action to descargar/download unless the source explicitly says download. Avoid coger in taboo-risk dialects.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["archivo", "archivos", "documento", "documentos", "adjunto", "adjuntos"],
        ["recoge", "recoger", "recupera", "recuperar", "obtén", "obtener", "busca", "buscar"],
      ],
      forbiddenOutputTerms: [
        "descarga",
        "descargar",
        "bajar",
        ...(TABOO_RISK_COGER_DIALECTS.includes(dialect) ? ["coge", "coger"] : []),
      ],
    }),
  },
  {
    id: "pickup-package",
    dialects: "all",
    sourcePattern: /\b(pick up|grab|get|take)\b.{0,40}\b(package|packages|parcel|order|badge|ticket)\b/i,
    guidance: "For physical pickup of an item, use recoger/recoge or retirar/retira according to register. Agarrar can work only in casual physical-grab contexts. Do not change pickup into download. Avoid coger in taboo-risk dialects.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["paquete", "paquetes", "pedido", "boleto", "ticket", "credencial"],
        ["recoge", "recoger", "retira", "retirar"],
      ],
      forbiddenOutputTerms: [
        "descarga",
        "descargar",
        ...(TABOO_RISK_COGER_DIALECTS.includes(dialect) ? ["coge", "coger"] : []),
      ],
    }),
  },
  {
    id: "take-bus",
    dialects: "all",
    sourcePattern: /\b(take|catch|ride|get on|board)\b.{0,30}\b(bus|train|metro|subway|taxi|cab|shuttle)\b/i,
    guidance: "For taking transportation, use tomar/toma or abordar/aborda by register and dialect. Do not use coger outside Spain/Andorra. Preserve dialect-specific vehicle terms such as guagua where the dialect contract requires them.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-CU" || dialect === "es-DO" || dialect === "es-PR"
          ? ["guagua", "autobús", "bus"]
          : dialect === "es-MX"
            ? ["bus", "autobús", "camión"]
            : ["bus", "autobús", "ómnibus", "colectivo", "guagua", "camión"],
        dialect === "es-ES" || dialect === "es-AD"
          ? ["coge", "coger", "toma", "tomar", "aborda", "abordar"]
          : ["toma", "tomar", "aborda", "abordar"],
      ],
      forbiddenOutputTerms: dialect === "es-ES" || dialect === "es-AD"
        ? []
        : ["coge", "coger", "agarra", "agarrar"],
    }),
  },
  {
    id: "take-photo",
    dialects: "all",
    sourcePattern: /\b(take|snap|capture)\b.{0,30}\b(photo|picture|screenshot|screen shot|image)\b/i,
    guidance: "For taking a photo/screenshot, use tomar or sacar/capturar according to dialect and UI register. Never literalize this as coger.",
    expectations: {
      requiredOutputGroups: [
        ["foto", "fotografía", "captura", "imagen", "pantalla"],
        ["toma", "tomar", "saca", "sacar", "captura", "capturar", "haz", "hacer"],
      ],
      forbiddenOutputTerms: ["coge", "coger", "agarra", "agarrar", "recoge", "recoger"],
    },
  },
  {
    id: "take-medicine",
    dialects: "all",
    sourcePattern: /\b(take)\b.{0,30}\b(medicine|medication|pill|dose|tablet)\b/i,
    guidance: "For taking medicine, use tomar. Do not use coger/agarrar/recoger.",
    expectations: {
      requiredOutputGroups: [
        ["medicina", "medicamento", "pastilla", "dosis", "tableta"],
        ["toma", "tomar", "tómate", "tomarse"],
      ],
      forbiddenOutputTerms: ["coge", "coger", "agarra", "agarrar", "recoge", "recoger"],
    },
  },
  {
    id: "grab-bag",
    dialects: TABOO_RISK_COGER_DIALECTS,
    sourcePattern: /\b(grab|take)\b.{0,30}\b(bag|keys|phone|laptop|backpack)\b/i,
    guidance: "For physically grabbing a personal object, use agarrar/tomar depending on register. Do not use coger in taboo-risk dialects.",
    expectations: {
      requiredOutputGroups: [
        ["bolsa", "llaves", "teléfono", "celular", "laptop", "mochila"],
        ["agarra", "agarrar", "toma", "tomar"],
      ],
      forbiddenOutputTerms: ["coge", "coger", "recoge", "recoger"],
    },
  },
  {
    id: "tidy-room",
    dialects: "all",
    sourcePattern: /\b(pick up|clean up|tidy up|straighten up)\b.{0,40}\b(room|bedroom)\b/i,
    guidance: "For tidying a room, translate the household-cleanup sense, not physical pickup. In Puerto Rican Spanish, recoger el cuarto is natural for tidying the room. Elsewhere, ordenar/arreglar/recoger la habitación/el cuarto may fit by dialect and register.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-PR" ? ["cuarto", "habitación"] : ["cuarto", "habitación", "pieza", "recámara"],
        dialect === "es-PR"
          ? ["recoge", "recoger", "ordena", "ordenar", "arregla", "arreglar"]
          : ["ordena", "ordenar", "arregla", "arreglar", "recoge", "recoger"],
      ],
      forbiddenOutputTerms: ["coge", "coger", "levanta", "levantar"],
    }),
  },
];

function appliesToDialect(rule: LexicalAmbiguityRule, dialect: SpanishDialect): boolean {
  return rule.dialects === "all" || rule.dialects.includes(dialect);
}

export function buildLexicalAmbiguityGuidance(text: string, dialect: SpanishDialect): string | undefined {
  const matched = findMatchedLexicalAmbiguityRules(text, dialect);

  if (matched.length === 0) {
    return undefined;
  }

  return [
    "Lexical ambiguity constraints:",
    ...matched.map((rule) => `[${rule.id}] ${rule.guidance}`),
  ].join(" ");
}

export function findMatchedLexicalAmbiguityRules(
  text: string,
  dialect: SpanishDialect
): readonly LexicalAmbiguityRule[] {
  return LEXICAL_AMBIGUITY_RULES.filter((rule) =>
    appliesToDialect(rule, dialect) && rule.sourcePattern.test(text)
  );
}

export function buildLexicalAmbiguityExpectations(
  text: string,
  dialect: SpanishDialect
): LexicalAmbiguityExpectations {
  const matched = findMatchedLexicalAmbiguityRules(text, dialect);
  const requiredOutputGroups: string[][] = [];
  const forbiddenOutputTerms = new Set<string>();

  for (const rule of matched) {
    const expectations = typeof rule.expectations === "function"
      ? rule.expectations(dialect)
      : rule.expectations;
    for (const group of expectations?.requiredOutputGroups || []) {
      requiredOutputGroups.push([...group]);
    }
    for (const term of expectations?.forbiddenOutputTerms || []) {
      forbiddenOutputTerms.add(term);
    }
  }

  return {
    matchedRuleIds: matched.map((rule) => rule.id),
    requiredOutputGroups,
    forbiddenOutputTerms: [...forbiddenOutputTerms],
  };
}
