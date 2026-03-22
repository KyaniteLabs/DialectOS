/**
 * Dialect information and detection patterns
 * Provides metadata about Spanish dialects and keyword-based detection
 */

import type { SpanishDialect } from "@espanol/types";

/**
 * Dialect metadata with name, description, and detection patterns
 */
export interface DialectMetadata {
  code: SpanishDialect;
  name: string;
  description: string;
  keywords: string[]; // Unique words/expressions that identify this dialect
}

/**
 * Comprehensive metadata for all 20 Spanish dialects
 */
export const DIALECT_METADATA: DialectMetadata[] = [
  {
    code: "es-ES",
    name: "Peninsular Spanish",
    description: "Spanish from Spain (Castilian)",
    keywords: [
      "ordenador", "coche", "zumo", "vale", "vosotros",
      "bajara", "vuestro", "conducir", "aparcar",
      "ladrillo", "patata", "piso", "coger"
    ]
  },
  {
    code: "es-MX",
    name: "Mexican Spanish",
    description: "Spanish from Mexico",
    keywords: [
      "computadora", "carro", "pluma", "jugo", "departamento",
      "camión", "habitación", "rentar", "estacionamiento",
      "aguacate", "plátano", "cocinar", "falda"
    ]
  },
  {
    code: "es-AR",
    name: "Argentine Spanish",
    description: "Spanish from Argentina",
    keywords: [
      "papa", "auto", "laburo", "che", "vos",
      "pibe", "mina", "bondi", "quilombo",
      "fiaca", "morfar", "pulenta", "guita"
    ]
  },
  {
    code: "es-CO",
    name: "Colombian Spanish",
    description: "Spanish from Colombia",
    keywords: [
      "parce", "chévere", "veci", "mono", "rajo",
      "guaro", "chino", "lacio", "marica",
      "quee", "vaina", "bacano", "pilas"
    ]
  },
  {
    code: "es-CU",
    name: "Cuban Spanish",
    description: "Spanish from Cuba",
    keywords: [
      "asere", "yuma", "jinetera", "papaya", "algo",
      "grifo", "bajar", "guagua", "fufú",
      "mechero", "pichar", "temba", "socio"
    ]
  },
  {
    code: "es-PE",
    name: "Peruvian Spanish",
    description: "Spanish from Peru",
    keywords: [
      "chibolo", "causa", "chifa", "poto", "brich",
      "huaico", "chapo", "chamoco", "laminero",
      "pata", "chela", "jato", "chibolo"
    ]
  },
  {
    code: "es-CL",
    name: "Chilean Spanish",
    description: "Spanish from Chile",
    keywords: [
      "wea", "hueón", "cachái", "pololo", "fome",
      "rita", "palta", "choclo", "guagua",
      "lianta", "rica", "cobre", "flaite"
    ]
  },
  {
    code: "es-VE",
    name: "Venezuelan Spanish",
    description: "Spanish from Venezuela",
    keywords: [
      "chamo", "pana", "guarambare", "chinga", "pajúo",
      "siso", "pirobo", "sifrino", "cocuyo",
      "porra", "chimbo", "morrocoy", "guarapo"
    ]
  },
  {
    code: "es-UY",
    name: "Uruguayan Spanish",
    description: "Spanish from Uruguay",
    keywords: [
      "bo", "ta", "vamo", "chajá", "gurí",
      "porta", "fogón", "fiaca", "payador",
      "tiza", "yuneta", "karai", "gurisa"
    ]
  },
  {
    code: "es-PY",
    name: "Paraguayan Spanish",
    description: "Spanish from Paraguay",
    keywords: [
      "ché", "gua'u", "mbarete", "juana", "cara",
      "puro", "chana", "koyá", "jaha",
      "vy'a", "pyhare", "ra'e", "ryru"
    ]
  },
  {
    code: "es-BO",
    name: "Bolivian Spanish",
    description: "Spanish from Bolivia",
    keywords: [
      "wawa", "jach'a", "luk'ana", "qhatu", "yati",
      "t'aqa", "p'utu", "wayra", "jallalla",
      "ch'usa", "llunk'u", "api", "chairo"
    ]
  },
  {
    code: "es-EC",
    name: "Ecuadorian Spanish",
    description: "Spanish from Ecuador",
    keywords: [
      "chévere", "pana", "chado", "guagua", "chulla",
      "vida", "ché", "bacán", "caña",
      "longo", "tú", "chibolo", "país"
    ]
  },
  {
    code: "es-GT",
    name: "Guatemalan Spanish",
    description: "Spanish from Guatemala",
    keywords: [
      "pisto", "chapín", "shute", "chucho", "clavo",
      "boche", "pisto", "shumo", "ishtmo",
      "agregar", "chucho", "pisto", "morral"
    ]
  },
  {
    code: "es-HN",
    name: "Honduran Spanish",
    description: "Spanish from Honduras",
    keywords: [
      "catracho", "mañe", "pucher", "chepa", "cirilo",
      "arrastrado", "pucher", "tirijisi", "chino",
      "pichu", "chure", "choco", "chule"
    ]
  },
  {
    code: "es-SV",
    name: "Salvadoran Spanish",
    description: "Spanish from El Salvador",
    keywords: [
      "guanaco", "bicho", "puch", "chero", "tuanis",
      "bicho", "puch", "chel", "ceo",
      "chunche", "pisto", "chamba", "pacha"
    ]
  },
  {
    code: "es-NI",
    name: "Nicaraguan Spanish",
    description: "Spanish from Nicaragua",
    keywords: [
      "pinolero", "chele", "naca", "sapa", "bicho",
      "tropas", "chunche", "arre", "samaritano",
      "chavalo", "jincho", "pichilingo", "bole"
    ]
  },
  {
    code: "es-CR",
    name: "Costa Rican Spanish",
    description: "Spanish from Costa Rica",
    keywords: [
      "pura vida", "tuanis", "mae", "pisto", "pulpería",
      "chunche", "brete", "yigüirro", "pura",
      "vida", "roine", "sarasa", "jupa"
    ]
  },
  {
    code: "es-PA",
    name: "Panamanian Spanish",
    description: "Spanish from Panama",
    keywords: [
      "sorrin", "chombo", "fufu", "aju", "tongo",
      "pelar", "chivo", "pichichi", "mus",
      "cucaracha", "tongo", "sorrin", "majare"
    ]
  },
  {
    code: "es-DO",
    name: "Dominican Spanish",
    description: "Spanish from Dominican Republic",
    keywords: [
      "tiguere", "concon", "vívere", "aplatar", "kilo",
      "guagua", "pora", "jevo", "china",
      "moto", "bandola", "kukú", "papichulo"
    ]
  },
  {
    code: "es-PR",
    name: "Puerto Rican Spanish",
    description: "Spanish from Puerto Rico",
    keywords: [
      "bichote", "cabrón", "aye", "zafacón", "pulpo",
      "guagua", "jevo", "pichar", "chota",
      "almohada", "floor", "parking", "chevere"
    ]
  }
];

/**
 * Get dialect metadata by code
 */
export function getDialectInfo(code: SpanishDialect): DialectMetadata | undefined {
  return DIALECT_METADATA.find(d => d.code === code);
}

/**
 * Detect dialect from text using keyword matching
 * Returns the best matching dialect with confidence score
 */
export interface DetectionResult {
  dialect: SpanishDialect;
  confidence: number;
  name: string;
  matchedKeywords: string[];
}

export function detectDialect(text: string): DetectionResult {
  const lowerText = text.toLowerCase();

  // Score each dialect based on keyword matches
  const scores = DIALECT_METADATA.map(dialect => {
    const matchedKeywords = dialect.keywords.filter(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );

    return {
      dialect,
      score: matchedKeywords.length,
      matchedKeywords
    };
  });

  // Sort by score (descending)
  scores.sort((a, b) => b.score - a.score);

  // Get the best match
  const best = scores[0];

  // Calculate confidence based on number of matches
  // 0 matches = low confidence, 3+ matches = high confidence
  let confidence = 0.1; // Base confidence
  if (best.score === 1) confidence = 0.3;
  else if (best.score === 2) confidence = 0.5;
  else if (best.score === 3) confidence = 0.7;
  else if (best.score >= 4) confidence = 0.9;

  return {
    dialect: best.dialect.code,
    confidence,
    name: best.dialect.name,
    matchedKeywords: best.matchedKeywords
  };
}

/**
 * Format dialect list for display
 */
export function formatDialectList(format: "text" | "json"): string {
  if (format === "json") {
    return JSON.stringify(DIALECT_METADATA, null, 2);
  }

  // Text format
  const lines = [
    "Spanish Dialects",
    "=================",
    ""
  ];

  for (const dialect of DIALECT_METADATA) {
    lines.push(`${dialect.code} - ${dialect.name}`);
    lines.push(`  ${dialect.description}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format detection result for display
 */
export function formatDetectionResult(result: DetectionResult, format: "text" | "json"): string {
  if (format === "json") {
    return JSON.stringify({
      dialect: result.dialect,
      confidence: result.confidence,
      name: result.name
    }, null, 2);
  }

  // Text format
  const confidencePercent = Math.round(result.confidence * 100);
  return [
    `Detected Dialect: ${result.dialect} (${result.name})`,
    `Confidence: ${confidencePercent}%`,
    result.matchedKeywords.length > 0
      ? `Matched Keywords: ${result.matchedKeywords.join(", ")}`
      : "No specific keywords detected (default dialect)"
  ].join("\n");
}
