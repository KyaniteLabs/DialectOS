import { SecurityError, ErrorCode } from "@dialectos/security";
import { ALL_SPANISH_DIALECTS, type SpanishDialect } from "@dialectos/types";
import type { McpRegionalLexemeProposal, ResearchRegionalTermParams, McpRegionalResearchSource } from "./translator-types.js";

/**
 * Metadata for all 25 Spanish dialects with detection keywords
 */
export const DIALECT_METADATA: Array<{
  code: SpanishDialect;
  name: string;
  description: string;
  keywords: string[];
}> = [
  {
    code: "es-ES",
    name: "Castilian Spanish (Spain)",
    description: "Standard Spanish from Spain, using vosotros for informal plural",
    keywords: [
      "vosotros",
      "vosotras",
      "ordenador",
      "coche",
      "patata",
      "autobús",
      "apartamento",
      "bao",
      "vale",
    ],
  },
  {
    code: "es-MX",
    name: "Mexican Spanish",
    description: "Spanish spoken in Mexico",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "camión",
      "departamento",
      "chido",
      "wey",
      "güey",
      "neta",
      "chamba",
    ],
  },
  {
    code: "es-AR",
    name: "Argentine Spanish",
    description: "Rioplatense Spanish from Argentina, using voseo",
    keywords: [
      "vos",
      "computadora",
      "auto",
      "papa",
      "colectivo",
      "departamento",
      "che",
      "boludo",
      "bondi",
      "laburo",
    ],
  },
  {
    code: "es-CO",
    name: "Colombian Spanish",
    description: "Spanish spoken in Colombia",
    keywords: [
      "computador",
      "carro",
      "papa",
      "bus",
      "apartamento",
      "parcero",
      "chévere",
      "bacano",
    ],
  },
  {
    code: "es-CU",
    name: "Cuban Spanish",
    description: "Spanish spoken in Cuba",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "guagua",
      "asere",
      "yuma",
      "jinetero",
      "acere",
      "ma",
      "añá",
    ],
  },
  {
    code: "es-PE",
    name: "Peruvian Spanish",
    description: "Spanish spoken in Peru",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "pata",
      "causa",
      "chévere",
      "bro",
      "al toque",
    ],
  },
  {
    code: "es-CL",
    name: "Chilean Spanish",
    description: "Spanish spoken in Chile",
    keywords: [
      "computador",
      "auto",
      "papa",
      "micro",
      "departamento",
      "wea",
      "po",
      "cachái",
      "hueón",
      "bakán",
    ],
  },
  {
    code: "es-VE",
    name: "Venezuelan Spanish",
    description: "Spanish spoken in Venezuela",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "chamo",
      "burda",
      "guara",
      "pana",
      "chévere",
    ],
  },
  {
    code: "es-UY",
    name: "Uruguayan Spanish",
    description: "Spanish spoken in Uruguay",
    keywords: [
      "vos",
      "computadora",
      "auto",
      "papa",
      "colectivo",
      "departamento",
      "che",
      "bo",
      "ta",
      "laburo",
    ],
  },
  {
    code: "es-PY",
    name: "Paraguayan Spanish",
    description: "Spanish spoken in Paraguay",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "che",
      "vos",
      "mbarete",
      "jaha",
      "vy'a",
    ],
  },
  {
    code: "es-BO",
    name: "Bolivian Spanish",
    description: "Spanish spoken in Bolivia",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "wawa",
      "chal",
      "puchero",
      "sullca",
      "joven",
    ],
  },
  {
    code: "es-EC",
    name: "Ecuadorian Spanish",
    description: "Spanish spoken in Ecuador",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "departamento",
      "chévere",
      "guagua",
      "yapa",
      "ñaño",
      "canguil",
    ],
  },
  {
    code: "es-GT",
    name: "Guatemalan Spanish",
    description: "Spanish spoken in Guatemala",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "chapín",
      "cabal",
      "shuco",
      "pisto",
      "bo",
    ],
  },
  {
    code: "es-HN",
    name: "Honduran Spanish",
    description: "Spanish spoken in Honduras",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "catracho",
      "maje",
      "cipote",
      "chuco",
      "pisto",
    ],
  },
  {
    code: "es-SV",
    name: "Salvadoran Spanish",
    description: "Spanish spoken in El Salvador",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "guanaco",
      "chuco",
      "cipote",
      "pisto",
      "vaya",
    ],
  },
  {
    code: "es-NI",
    name: "Nicaraguan Spanish",
    description: "Spanish spoken in Nicaragua",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "nica",
      "chigüe",
      "cipote",
      "pisto",
      "sapién",
    ],
  },
  {
    code: "es-CR",
    name: "Costa Rican Spanish",
    description: "Spanish spoken in Costa Rica",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "tico",
      "tica",
      "mae",
      "chine",
      "pura vida",
    ],
  },
  {
    code: "es-PA",
    name: "Panamanian Spanish",
    description: "Spanish spoken in Panama",
    keywords: [
      "computadora",
      "carro",
      "papa",
      "bus",
      "departamento",
      "pana",
      "chuleta",
      "yeye",
      "qué xopa",
      "chombo",
    ],
  },
  {
    code: "es-DO",
    name: "Dominican Spanish",
    description: "Spanish spoken in Dominican Republic",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "bus",
      "apartamento",
      "vos",
      "tiguere",
      "dime",
      "concho",
      "qué lo qué",
    ],
  },
  {
    code: "es-PR",
    name: "Puerto Rican Spanish",
    description: "Spanish spoken in Puerto Rico",
    keywords: [
      "computadora",
      "auto",
      "papa",
      "guagua",
      "apartamento",
      "vos",
      "cabra",
      "pichar",
      "janguear",
      "broki",
    ],
  },
  {
    code: "es-GQ",
    name: "Equatoguinean Spanish",
    description: "Spanish spoken in Equatorial Guinea",
    keywords: ["guineano", "malabo", "bubi", "fang", "annobón", "bioko", "ñame", "fufú"],
  },
  {
    code: "es-US",
    name: "U.S. Spanish",
    description: "Spanish spoken in the United States by Chicano and heritage communities",
    keywords: ["troca", "parquear", "lonche", "wacha", "cholo", "vato", "carnal", "neta"],
  },
  {
    code: "es-PH",
    name: "Philippine Spanish",
    description: "Spanish and Chavacano-influenced Spanish from the Philippines",
    keywords: ["jendeh", "kame", "kita", "quilaya", "tamén", "onde", "conele", "vusos"],
  },
  {
    code: "es-BZ",
    name: "Belizean Spanish",
    description: "Spanish spoken in Belize",
    keywords: ["beliceño", "kriol", "garífuna", "cayos", "mestizo", "criollo", "dangriga", "mopan"],
  },
  {
    code: "es-AD",
    name: "Andorran Spanish",
    description: "Catalan-influenced Spanish from Andorra",
    keywords: ["andorrano", "canillo", "escaldes", "encamp", "ordino", "massana", "pirineo", "andorra"],
  },
];

export function parseMcpDialectList(value: string): SpanishDialect[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    if (!ALL_SPANISH_DIALECTS.includes(item as SpanishDialect)) {
      throw new SecurityError(`Invalid dialect: ${item}`, ErrorCode.INVALID_INPUT);
    }
    return item as SpanishDialect;
  });
}

export function mcpBuiltInResearchPrior(concept: string, dialect: SpanishDialect): Omit<McpRegionalLexemeProposal, "sources"> {
  if (/orange juice|jugo de china|jugo de naranja/i.test(concept)) {
    if (dialect === "es-PR") {
      return { dialect, preferred: ["jugo de china"], accepted: ["jugo de naranja"], forbidden: [], confidence: "high", rationale: "Puerto Rican citrus usage maps china to sweet orange, so orange juice is jugo de china." };
    }
    if (dialect === "es-DO") {
      return { dialect, preferred: ["jugo de china", "jugo de naranja"], accepted: ["jugo de naranja"], forbidden: [], confidence: "medium", rationale: "Dominican usage may use china for orange, while jugo de naranja remains broadly accepted." };
    }
    return { dialect, preferred: ["jugo de naranja"], accepted: ["zumo de naranja"], forbidden: ["jugo de china"], confidence: "medium", rationale: "Outside PR/DO citrus contexts, naranja is the safer default for orange." };
  }
  return { dialect, preferred: [], accepted: [], forbidden: [], confidence: "low", rationale: "No built-in prior for this concept yet; use gathered sources for review before promoting data." };
}

export async function researchRegionalTermMcp(
  params: ResearchRegionalTermParams,
  search?: (query: string) => Promise<McpRegionalResearchSource[]>
) {
  const concept = params.concept.trim();
  if (!concept) throw new SecurityError("Concept cannot be empty", ErrorCode.INVALID_INPUT);
  const dialects = parseMcpDialectList(params.dialects);
  const warnings: string[] = [];
  const proposals: McpRegionalLexemeProposal[] = [];
  for (const dialect of dialects) {
    const prior = mcpBuiltInResearchPrior(concept, dialect);
    const sources = search ? await search(`${concept} ${dialect} regional Spanish term`) : [];
    if (!search) warnings.push("No search adapter configured; using built-in priors only.");
    proposals.push({ ...prior, sources: sources.slice(0, 4) });
  }
  return {
    concept: concept.toLowerCase(),
    semanticField: params.semanticField || "general",
    dialects,
    generatedAt: new Date().toISOString(),
    mode: "research-proposal",
    mutationPolicy: "never-mutates-runtime-data",
    proposals,
    suggestedFixtures: proposals.map((proposal) => ({
      dialect: proposal.dialect,
      source: concept,
      requiredOutputGroups: proposal.preferred.length ? [proposal.preferred] : [],
      forbiddenOutputTerms: proposal.forbidden,
    })),
    warnings: [...new Set(warnings)],
  };
}

export async function serperSearch(query: string): Promise<McpRegionalResearchSource[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!response.ok) throw new Error(`Serper search failed: ${response.status}`);
  const data = await response.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic || []).filter((item) => item.title && item.link).map((item) => ({
    title: item.title!,
    link: item.link!,
    snippet: item.snippet,
  }));
}
