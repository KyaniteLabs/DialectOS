/**
 * Dialect information and detection patterns
 * Provides metadata about Spanish dialects with formal vs. casual register support
 */

import type { SpanishDialect } from "@espanol/types";

/**
 * Register-aware dialect metadata
 */
export interface DialectMetadata {
  code: SpanishDialect;
  name: string;
  description: string;
  /** General keywords for detection (blend of formal + casual) */
  keywords: string[];
  /** Terms typical of formal/professional/academic contexts */
  formalTerms: string[];
  /** Slang, colloquial, and street-language terms */
  slangTerms: string[];
}

/**
 * Comprehensive metadata for all 25 Spanish dialects.
 * Each dialect has:
 *   - ~15 general keywords
 *   - ~8 formal/professional terms
 *   - ~8 slang/casual terms
 */
export const DIALECT_METADATA: DialectMetadata[] = [
  {
    code: "es-ES",
    name: "Peninsular Spanish",
    description: "Spanish from Spain (Castilian)",
    keywords: [
      "ordenador", "coche", "zumo", "vale", "vosotros",
      "vuestro", "conducir", "aparcar", "ladrillo", "patata",
      "piso", "coger", "móvil", "bolígrafo", "autobús"
    ],
    formalTerms: [
      "ordenador", "vosotros", "conducir", "aparcar",
      "coger", "bolígrafo", "autobús", "frigorífico"
    ],
    slangTerms: [
      "vale", "tío", "tía", "mola", "guay",
      "flipar", "chaval", "currar"
    ]
  },
  {
    code: "es-MX",
    name: "Mexican Spanish",
    description: "Spanish from Mexico",
    keywords: [
      "computadora", "carro", "pluma", "jugo", "departamento",
      "camión", "habitación", "rentar", "estacionamiento", "aguacate",
      "plátano", "falda", "celular", "chido", "güey"
    ],
    formalTerms: [
      "computadora", "departamento", "estacionamiento",
      "habitación", "rentar", "camión", "plátano", "celular"
    ],
    slangTerms: [
      "chido", "güey", "neta", "padre", "chamba",
      "crudo", "fresa", "naco"
    ]
  },
  {
    code: "es-AR",
    name: "Argentine Spanish",
    description: "Spanish from Argentina",
    keywords: [
      "papa", "auto", "laburo", "che", "vos",
      "pibe", "mina", "bondi", "quilombo", "fiaca",
      "morfar", "pulenta", "guita", "boludo", "piola"
    ],
    formalTerms: [
      "auto", "computadora", "departamento", "celular",
      "remera", "frutilla", "poroto", "maní"
    ],
    slangTerms: [
      "che", "pibe", "mina", "bondi", "quilombo",
      "fiaca", "morfar", "boludo"
    ]
  },
  {
    code: "es-CO",
    name: "Colombian Spanish",
    description: "Spanish from Colombia",
    keywords: [
      "parce", "chévere", "veci", "mono", "rajo",
      "guaro", "chino", "llave", "marica", "guayabo",
      "vaina", "bacano", "pilas", "pana", "rumba"
    ],
    formalTerms: [
      "computador", "carro", "celular", "esfero",
      "papa", "lentes", "maní", "banano"
    ],
    slangTerms: [
      "parce", "chévere", "veci", "mono", "vaina",
      "bacano", "pilas", "pana", "rumba", "parcero"
    ]
  },
  {
    code: "es-CU",
    name: "Cuban Spanish",
    description: "Spanish from Cuba",
    keywords: [
      "asere", "yuma", "jinetera", "grifo", "guagua",
      "fufú", "mechero", "pichar", "temba", "socio",
      "qué bola", "candela", "jama", "pinchar", "yal"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "apartamento",
      "guagua", "papa", "lentes", "habichuela"
    ],
    slangTerms: [
      "asere", "yuma", "jinetera", "grifo", "fufú",
      "mechero", "pichar", "temba", "qué bola", "jama"
    ]
  },
  {
    code: "es-PE",
    name: "Peruvian Spanish",
    description: "Spanish from Peru",
    keywords: [
      "chibolo", "causa", "chifa", "poto", "brich",
      "huaico", "chapo", "flaco", "mina", "pata",
      "chela", "jato", "huarique", "pe", "cholo"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "pluma",
      "papa", "lentes", "maní", "frutilla"
    ],
    slangTerms: [
      "chibolo", "causa", "chifa", "poto", "pata",
      "chela", "jato", "huarique", "cholo", "flaco"
    ]
  },
  {
    code: "es-CL",
    name: "Chilean Spanish",
    description: "Spanish from Chile",
    keywords: [
      "wea", "hueón", "cachái", "pololo", "fome",
      "bacán", "palta", "choclo", "guagua", "lianta",
      "chucha", "la raja", "flaite", "caleta", "al tiro"
    ],
    formalTerms: [
      "auto", "computadora", "celular", "papa",
      "lentes", "maní", "poroto", "frutilla"
    ],
    slangTerms: [
      "wea", "hueón", "cachái", "pololo", "fome",
      "bacán", "lianta", "chucha", "flaite", "caleta"
    ]
  },
  {
    code: "es-VE",
    name: "Venezuelan Spanish",
    description: "Spanish from Venezuela",
    keywords: [
      "chamo", "pana", "guarambare", "chinga", "pajúo",
      "siso", "pirobo", "sifrino", "cocuyo", "porra",
      "chimbo", "morrocoy", "guarapo", "arrecho", "ladilla"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "lapicero",
      "papa", "lentes", "maní", "caraota"
    ],
    slangTerms: [
      "chamo", "pana", "guarambare", "pajúo", "pirobo",
      "sifrino", "porra", "chimbo", "arrecho", "ladilla"
    ]
  },
  {
    code: "es-UY",
    name: "Uruguayan Spanish",
    description: "Spanish from Uruguay",
    keywords: [
      "bo", "ta", "vamo", "chajá", "gurí",
      "porta", "fogón", "fiaca", "payador", "changa",
      "mufa", "karai", "gurisa", "mate", "cana"
    ],
    formalTerms: [
      "auto", "computadora", "apartamento", "celular",
      "papa", "anteojos", "frutilla", "poroto"
    ],
    slangTerms: [
      "bo", "ta", "vamo", "chajá", "gurí",
      "porta", "fogón", "fiaca", "changa", "mufa"
    ]
  },
  {
    code: "es-PY",
    name: "Paraguayan Spanish",
    description: "Spanish from Paraguay",
    keywords: [
      "jopara", "chipa", "terere", "tranquilopa", "haku",
      "mbarete", "de balde", "al pedo", "vai-vai", "me hallo",
      "chake", "che", "gua'u", "jaha", "jagua"
    ],
    formalTerms: [
      "auto", "computadora", "celular", "papa",
      "anteojos", "frutilla", "poroto", "maní"
    ],
    slangTerms: [
      "jopara", "chipa", "terere", "tranquilopa", "haku",
      "mbarete", "de balde", "al pedo", "vai-vai", "chake"
    ]
  },
  {
    code: "es-BO",
    name: "Bolivian Spanish",
    description: "Spanish from Bolivia",
    keywords: [
      "wawa", "jach'a", "ch'iti", "qhatu", "jallalla",
      "ch'usa", "llunk'u", "api", "chairo", "pucha",
      "chango", "cholita", "jichi", "q'omer", "llajwa"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol", "wawa", "cholita"
    ],
    slangTerms: [
      "wawa", "ch'iti", "jallalla", "ch'usa", "pucha",
      "chango", "jichi", "q'omer", "llajwa", "chutar"
    ]
  },
  {
    code: "es-EC",
    name: "Ecuadorian Spanish",
    description: "Spanish from Ecuador",
    keywords: [
      "chévere", "pana", "chado", "guagua", "chulla",
      "chucha", "bacán", "caña", "longo", "achachay",
      "chibolo", "yapa", "cacho", "ñaño", "chuchaqui"
    ],
    formalTerms: [
      "computador", "carro", "celular", "esfero",
      "papa", "lentes", "maní", "banano"
    ],
    slangTerms: [
      "chévere", "pana", "chado", "chulla", "chucha",
      "bacán", "longo", "achachay", "chibolo", "yapa"
    ]
  },
  {
    code: "es-GT",
    name: "Guatemalan Spanish",
    description: "Spanish from Guatemala",
    keywords: [
      "pisto", "chapín", "shute", "chucho", "clavo",
      "boche", "shumo", "ishtmo", "chiclero", "canche",
      "culero", "morral", "cipote", "patojo", "bochinche"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol"
    ],
    slangTerms: [
      "pisto", "shute", "chucho", "clavo", "boche",
      "shumo", "canche", "culero", "morral", "bochinche"
    ]
  },
  {
    code: "es-HN",
    name: "Honduran Spanish",
    description: "Spanish from Honduras",
    keywords: [
      "catracho", "mañe", "pucher", "chepa", "cirilo",
      "arrastrado", "tirijisi", "chino", "pichu", "chure",
      "choco", "chule", "cipote", "bayunco", "ñaño"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol"
    ],
    slangTerms: [
      "catracho", "mañe", "pucher", "chepa", "tirijisi",
      "pichu", "chure", "choco", "chule", "bayunco"
    ]
  },
  {
    code: "es-SV",
    name: "Salvadoran Spanish",
    description: "Spanish from El Salvador",
    keywords: [
      "guanaco", "bicho", "puch", "chero", "tuanis",
      "chel", "ceo", "chunche", "pisto", "chamba",
      "pacha", "chivo", "chuco", "cerote", "maje"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol"
    ],
    slangTerms: [
      "bicho", "puch", "chero", "tuanis", "chel",
      "ceo", "chunche", "pisto", "chamba", "cerote"
    ]
  },
  {
    code: "es-NI",
    name: "Nicaraguan Spanish",
    description: "Spanish from Nicaragua",
    keywords: [
      "pinolero", "chele", "naca", "sapa", "bicho",
      "tropas", "chunche", "arre", "samaritano", "chavalo",
      "jincho", "pichilingo", "bole", "chigüe", "maje"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol"
    ],
    slangTerms: [
      "chele", "naca", "sapa", "bicho", "tropas",
      "chunche", "arre", "jincho", "pichilingo", "bole"
    ]
  },
  {
    code: "es-CR",
    name: "Costa Rican Spanish",
    description: "Spanish from Costa Rica",
    keywords: [
      "pura vida", "tuanis", "mae", "pisto", "pulpería",
      "chunche", "brete", "yigüirro", "guaro", "roine",
      "sarasa", "jupa", "bomba", "carajillo", "guacho"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "frijol"
    ],
    slangTerms: [
      "pura vida", "tuanis", "mae", "pisto", "chunche",
      "brete", "guaro", "roine", "sarasa", "jupa"
    ]
  },
  {
    code: "es-PA",
    name: "Panamanian Spanish",
    description: "Spanish from Panama",
    keywords: [
      "sorrin", "chombo", "fufu", "aju", "tongo",
      "pelar", "chivo", "chilin", "rasca", "talla",
      "majare", "chuleta", "yeye", "chicha", "pitillo"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "lapicero",
      "papa", "lentes", "frijol"
    ],
    slangTerms: [
      "sorrin", "chombo", "fufu", "aju", "tongo",
      "pelar", "palo", "yeyo", "majare", "chuleta"
    ]
  },
  {
    code: "es-DO",
    name: "Dominican Spanish",
    description: "Spanish from Dominican Republic",
    keywords: [
      "tiguere", "concon", "vívere", "aplatar", "guagua",
      "pora", "jevo", "china", "bandola", "kukú",
      "papichulo", "vaina", "que lo que", "chin", "yeyo"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "apartamento",
      "guagua", "papa", "lentes", "habichuela"
    ],
    slangTerms: [
      "tiguere", "concon", "vívere", "pora", "jevo",
      "bandola", "kukú", "papichulo", "vaina", "que lo que"
    ]
  },
  {
    code: "es-PR",
    name: "Puerto Rican Spanish",
    description: "Spanish from Puerto Rico",
    keywords: [
      "bichote", "cabrón", "zafacón", "pulpo", "guagua",
      "jevo", "pichar", "chota", "almohada", "floor",
      "parking", "chevere", "nene", "mami", "papi"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "apartamento",
      "guagua", "papa", "lentes", "habichuela"
    ],
    slangTerms: [
      "bichote", "cabrón", "pulpo", "jevo", "pichar",
      "chota", "floor", "parking", "chevere", "janguear"
    ]
  },
  {
    code: "es-GQ",
    name: "Equatoguinean Spanish",
    description: "Spanish from Equatorial Guinea (only African Spanish-speaking country)",
    keywords: [
      "ñame", "guineano", "bubi", "fang", "malabo",
      "fufú", "batata", "camisola", "bacalao", "bangá",
      "malamba", "ndowe", "annobón", "bioko", "río muni"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "guineano", "malabo", "annobón"
    ],
    slangTerms: [
      "ñame", "fufú", "batata", "camisola", "bacalao",
      "bangá", "malamba", "ndowe", "bata", "mongomo"
    ]
  },
  {
    code: "es-US",
    name: "U.S. Spanish",
    description: "Spanish spoken in the United States (Chicano and heritage varieties)",
    keywords: [
      "troca", "parquear", "lonche", "wacha", "cholo",
      "ese", "firme", "simón", "vato", "carnal",
      "neta", "mande", "fresa", "chafa", "huero"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "mija", "mijo", "raza"
    ],
    slangTerms: [
      "troca", "parquear", "lonche", "wacha", "cholo",
      "ese", "firme", "simón", "vato", "carnal"
    ]
  },
  {
    code: "es-PH",
    name: "Philippine Spanish",
    description: "Spanish from the Philippines (Chavacano creole and historical Spanish)",
    keywords: [
      "jendeh", "kame", "kita", "evo", "quilaya",
      "tamén", "onde", "kamo", "sila", "conele",
      "connosotros", "nisos", "vusos", "jaha", "mo'o"
    ],
    formalTerms: [
      "kame", "kita", "kamo", "sila", "conele",
      "connosotros", "nisos", "vusos", "jaha", "onde"
    ],
    slangTerms: [
      "jendeh", "evo", "quilaya", "tamén", "mo'o",
      "ta", "maga", "eli", "akon", "dele"
    ]
  },
  {
    code: "es-BZ",
    name: "Belizean Spanish",
    description: "Spanish from Belize",
    keywords: [
      "breki", "kriol", "garífuna", "cayos", "beliceño",
      "zapote", "cayuco", "bway", "mopan", "kekchi",
      "yucatec", "placencia", "dangriga", "criollo", "mestizo"
    ],
    formalTerms: [
      "computadora", "carro", "celular", "papa",
      "lentes", "beliceño", "mestizo", "criollo"
    ],
    slangTerms: [
      "breki", "kriol", "cayos", "zapote", "cayuco",
      "bway", "mopan", "kekchi", "placencia", "dangriga"
    ]
  },
  {
    code: "es-AD",
    name: "Andorran Spanish",
    description: "Spanish from Andorra (Catalan-influenced Peninsular Spanish)",
    keywords: [
      "andorrano", "madriu", "canillo", "escaldes", "encamp",
      "ordino", "massana", "caldea", "comú", "pirineo",
      "andorra", "parroquia", "principado", "vall", "pas"
    ],
    formalTerms: [
      "andorrano", "madriu", "canillo", "escaldes", "encamp",
      "ordino", "massana", "caldea", "parroquia", "principado"
    ],
    slangTerms: [
      "comú", "pirineo", "vall", "pas", "xaval",
      "doncs", "molt", "clar", "aixo", "andorra"
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
 * Register preference for detection
 */
export type RegisterPreference = "any" | "formal" | "slang";

/**
 * Detection result with register awareness
 */
export interface DetectionResult {
  dialect: SpanishDialect | null;
  confidence: number;
  name: string | null;
  matchedKeywords: string[];
  registerHint: "formal" | "slang" | "neutral";
  isReliable: boolean;
  reason?: "matched-dialect-markers" | "insufficient-dialect-markers";
}

function getWordBoundaries(text: string): Set<string> {
  const words = new Set<string>();
  const tokens = text.toLowerCase().match(/[a-záéíóúüñ'’]+/g) || [];
  for (const token of tokens) {
    words.add(token);
  }
  const allTokens = text.toLowerCase().match(/[a-záéíóúüñ'’]+/g) || [];
  for (let i = 0; i < allTokens.length - 1; i++) {
    words.add(`${allTokens[i]} ${allTokens[i + 1]}`);
    if (i < allTokens.length - 2) {
      words.add(`${allTokens[i]} ${allTokens[i + 1]} ${allTokens[i + 2]}`);
    }
  }
  return words;
}

/**
 * Detect dialect from text using keyword matching.
 * @param text Text to analyze
 * @param register Optional register preference ("formal" | "slang" | "any")
 */
export function detectDialect(text: string, register: RegisterPreference = "any"): DetectionResult {
  const lowerText = text.toLowerCase();
  const wordSet = getWordBoundaries(text);

  // Score each dialect
  const scores = DIALECT_METADATA.map(dialect => {
    const match = (kw: string) => {
      const k = kw.toLowerCase();
      return k.includes(" ") ? lowerText.includes(k) : wordSet.has(k);
    };

    const generalMatches = dialect.keywords.filter(match);
    const formalMatches = dialect.formalTerms.filter(match);
    const slangMatches = dialect.slangTerms.filter(match);

    // Weighted scoring based on register preference
    let score = generalMatches.length;
    if (register === "formal") {
      score = formalMatches.length * 2 + generalMatches.length;
    } else if (register === "slang") {
      score = slangMatches.length * 2 + generalMatches.length;
    }

    const allMatched = [...new Set([...generalMatches, ...formalMatches, ...slangMatches])];

    // Determine register hint
    let registerHint: "formal" | "slang" | "neutral" = "neutral";
    if (slangMatches.length > formalMatches.length) registerHint = "slang";
    else if (formalMatches.length > slangMatches.length) registerHint = "formal";

    return {
      dialect,
      score,
      matchedKeywords: allMatched,
      registerHint,
      slangCount: slangMatches.length,
      formalCount: formalMatches.length,
    };
  });

  // Sort by score (descending)
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];

  // Calculate confidence
  let confidence = 0.1;
  if (best.score === 1) confidence = 0.3;
  else if (best.score === 2) confidence = 0.5;
  else if (best.score === 3) confidence = 0.7;
  else if (best.score >= 4) confidence = 0.9;

  const isReliable = best.score > 0;

  return {
    dialect: isReliable ? best.dialect.code : null,
    confidence: isReliable ? confidence : 0,
    name: isReliable ? best.dialect.name : null,
    matchedKeywords: best.matchedKeywords,
    registerHint: best.registerHint,
    isReliable,
    reason: isReliable ? "matched-dialect-markers" : "insufficient-dialect-markers",
  };
}

/**
 * Format dialect list for display
 */
export function formatDialectList(format: "text" | "json"): string {
  if (format === "json") {
    return JSON.stringify(DIALECT_METADATA, null, 2);
  }

  const lines = [
    "Spanish Dialects",
    "=================",
    ""
  ];

  for (const dialect of DIALECT_METADATA) {
    lines.push(`${dialect.code} - ${dialect.name}`);
    lines.push(`  ${dialect.description}`);
    lines.push(`  Formal: ${dialect.formalTerms.slice(0, 5).join(", ")}...`);
    lines.push(`  Slang:  ${dialect.slangTerms.slice(0, 5).join(", ")}...`);
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
      name: result.name,
      registerHint: result.registerHint,
      isReliable: result.isReliable,
      reason: result.reason,
    }, null, 2);
  }

  const confidencePercent = Math.round(result.confidence * 100);
  if (!result.isReliable) {
    return [
      "Detected Dialect: unknown (insufficient dialect markers)",
      "Confidence: 0%",
      "Register: neutral",
      "No specific keywords detected; not guessing a dialect"
    ].join("\n");
  }

  return [
    `Detected Dialect: ${result.dialect} (${result.name})`,
    `Confidence: ${confidencePercent}%`,
    `Register: ${result.registerHint}`,
    result.matchedKeywords.length > 0
      ? `Matched Keywords: ${result.matchedKeywords.join(", ")}`
      : "No specific keywords detected"
  ].join("\n");
}
