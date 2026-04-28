import type { SpanishDialect } from "@dialectos/types";
import { COGER_TABOO_DIALECTS, isDialectInRegion, isDialectInList } from "@dialectos/types";

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

export interface LexicalComplianceResult {
  passed: boolean;
  score: number;
  violations: string[];
}

/**
 * Check translated output against lexical ambiguity expectations.
 * Returns a compliance score (0-1) and list of violations.
 */
export function checkLexicalCompliance(
  translated: string,
  expectations: LexicalAmbiguityExpectations
): LexicalComplianceResult {
  const violations: string[] = [];
  const lowerTranslated = translated.toLowerCase();

  for (const group of expectations.requiredOutputGroups) {
    const hasAny = group.some((term) => lowerTranslated.includes(term.toLowerCase()));
    if (!hasAny) {
      violations.push(`Missing required term: expected one of [${group.join(", ")}]`);
    }
  }

  for (const term of expectations.forbiddenOutputTerms) {
    if (lowerTranslated.includes(term.toLowerCase())) {
      violations.push(`Forbidden term detected: ${term}`);
    }
  }

  const totalChecks = expectations.requiredOutputGroups.length + expectations.forbiddenOutputTerms.length;
  const passedChecks = totalChecks - violations.length;
  const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;

  return { passed: violations.length === 0, score, violations };
}

// "coger" is taboo in all American dialects except GQ and PH — see dialect-regions.ts
const TABOO_RISK_COGER_DIALECTS = COGER_TABOO_DIALECTS;

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
  {
    id: "bicho-insect",
    dialects: "all",
    sourcePattern: /\b(bug|insect|pest|creepy.?crawl|beetle|critter|bite)\b/i,
    guidance: "For insect/bug references, bicho is standard in Spain, Colombia, Venezuela, and most of South America but is vulgar (penis) in Puerto Rican and Dominican Spanish. Use insecto, error, or problema for PR/DO; bicho is safe elsewhere. In IT context, translate 'bug' as error/problema/defecto, not bicho.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["insecto", "error", "problema", "defecto", "plaga"],
      ],
      forbiddenOutputTerms: dialect === "es-PR" || dialect === "es-DO" ? ["bicho"] : [],
    }),
  },

  {
    id: "concha-shell",
    dialects: "all",
    sourcePattern: /\b(seashell|shell|clam|scallop|mussel|oyster)\b/i,
    guidance: "For shell/seashell references, concha is standard in Spain but is vulgar (vagina) in Argentine, Uruguayan, Chilean, and Peruvian Spanish. Use caracol (for snail shells), caparazón (for turtle/animal shells), or valva (for bivalve shells) in those dialects. Concha is safe in ES, MX, CO, and Central America.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["concha", "caracol", "caparazón", "valva", "cáscara", "cobertura"],
      ],
      forbiddenOutputTerms: dialect === "es-AR" || dialect === "es-UY" || dialect === "es-CL" || dialect === "es-PE" || dialect === "es-BO" || dialect === "es-PY" ? ["concha"] : [],
    }),
  },

  {
    id: "coger-take-generic",
    dialects: "all",
    sourcePattern: /\b(take|grab|get|pick up|catch)\b(?!.{0,40}(file|package|photo|medicine|bag|room|bus|train))\b/i,
    guidance: "For generic 'take/grab/get', coger is standard in Spain and Andorra but is vulgar (fuck) in most of Latin America. Use tomar, agarrar, or recoger in American dialects. Only use coger for es-ES and es-AD.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["toma", "tomar", "agarra", "agarrar", "recoge", "recoger", "obtiene", "obtener"],
      ],
      forbiddenOutputTerms: TABOO_RISK_COGER_DIALECTS.includes(dialect) ? ["coger", "coge"] : [],
    }),
  },

  {
    id: "paja-straw",
    dialects: "all",
    sourcePattern: /\b(drinking straw|straw|sorbete|pitillo|pajita)\b/i,
    guidance: "For drinking straw, paja is standard in Spain (pajita) but in much of Latin America paja colloquially means masturbation. Use sorbete (AR, UY), pajita (ES), pitillo (CO, VE, EC), popote (MX, GT, HN, SV), calimate (DO), or pajilla (PR, DO).",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-ES" || dialect === "es-AD"
          ? ["pajita", "paja"]
          : dialect === "es-MX" || dialect === "es-GT" || dialect === "es-HN" || dialect === "es-SV"
            ? ["popote"]
            : dialect === "es-AR" || dialect === "es-UY" || dialect === "es-PY"
              ? ["sorbete"]
              : dialect === "es-CO" || dialect === "es-VE" || dialect === "es-EC"
                ? ["pitillo"]
                : dialect === "es-PR" || dialect === "es-DO"
                  ? ["pajilla"]
                  : ["pajita", "sorbete", "pitillo", "popote"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "papaya-fruit",
    dialects: "all",
    sourcePattern: /\b(papaya|papayas|fruta bomba|lechosa)\b/i,
    guidance: "For the papaya fruit, papaya is vulgar (vagina) in Cuban Spanish. Use frutabomba in Cuban context, lechosa in Dominican and some Venezuelan contexts. Papaya is safe in all other dialects.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-CU"
          ? ["frutabomba", "fruta bomba"]
          : dialect === "es-DO" || dialect === "es-VE"
            ? ["lechosa", "papaya"]
            : ["papaya", "lechosa", "frutabomba"],
      ],
      forbiddenOutputTerms: dialect === "es-CU" ? ["papaya"] : [],
    }),
  },

  {
    id: "pito-whistle",
    dialects: "all",
    sourcePattern: /\b(whistle|referee|blow the whistle|whistling)\b/i,
    guidance: "For whistle references, pito is standard in some regions but is vulgar (penis) in Colombian and Venezuelan Spanish. Use silbato or silbido for CO/VE. Pito is safe in ES, MX, AR, and most other dialects.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-CO" || dialect === "es-VE"
          ? ["silbato", "silbido", "pito"]
          : ["pito", "silbato", "silbido"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "bola-ball",
    dialects: "all",
    sourcePattern: /\b(bouncy ball|beach ball|disco ball|ball game|ballroom|ball bearing|pitching|catching a ball|throwing a ball)\b/i,
    guidance: "For ball/sphere references, bola/bolo is standard but can carry vulgar connotations (scrotum/testicles) in some informal contexts. In formal/technical text, bola is universally acceptable. In CO/VE, bola can also mean 'lie'. Use pelota for sports contexts. Avoid boludo/boluda (vulgar intensifier in AR/UY).",
    expectations: {
      requiredOutputGroups: [
        ["bola", "pelota", "esfera", "balón"],
      ],
      forbiddenOutputTerms: ["boludo", "boluda"],
    },
  },

  {
    id: "polla-chicken",
    dialects: "all",
    sourcePattern: /\b(chicken|hen|poultry|rooster)\b(?!.?valve|.?pit|.?fight)/i,
    guidance: "For chicken/hen references, polla is vulgar (penis) in Spain and several other dialects. Use pollo/polla carefully: pollo for the meat/animal is safe; polla specifically means hen but should be avoided in ES due to vulgar connotation. Use gallina for hen, pollo for chicken meat/animal.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["pollo", "gallina", "ave", "carne de pollo"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "bollo-bread",
    dialects: "all",
    sourcePattern: /\b(bun|bread roll|muffin|pastry|croissant|doughnut|pastry roll)\b/i,
    guidance: "For bread/pastry references, bollo is standard for a bread roll in CO, VE, and Caribbean Spanish but can carry sexual connotations in some informal contexts. Use pan, panecillo, or rollo for safe alternatives. In CU, 'hacer un bollo' is slang for making a mistake.",
    expectations: {
      requiredOutputGroups: [
        ["bollo", "pan", "panecillo", "rollo", "pastelito"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "huevos-eggs",
    dialects: "all",
    sourcePattern: /\b(eggs?|scrambled|fried eggs|boiled eggs|omelet)\b/i,
    guidance: "For egg references, huevos is standard but in Mexican, Colombian, and several other dialects it colloquially means testicles. In formal food/recipe context, huevos is perfectly acceptable. Only avoid in deliberately informal/casual registers where double meaning could cause offense. In formal text, huevos is always correct.",
    expectations: {
      requiredOutputGroups: [
        ["huevos", "huevo"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "chingar-bother",
    dialects: "all",
    sourcePattern: /\b(pester|harass|mess with|piss off)\b/i,
    guidance: "For 'bother/annoy', chingar is extremely vulgar in Mexican Spanish (equivalent to 'to fuck'). In GT/HN/SV it can mean 'to bother' but is still coarse. Use molestar, fastidiar, or incomodar in all formal contexts. Never use chingar in professional translation.",
    expectations: {
      requiredOutputGroups: [
        ["molestar", "molesta", "molestia", "molestias", "fastidiar", "fastidia", "incomodar", "incomoda"],
      ],
      forbiddenOutputTerms: ["chingar", "chinga"],
    },
  },

  {
    id: "madrazo-hit",
    dialects: ["es-MX"],
    sourcePattern: /\b(punch|smack|slap|blow to the|struck|biff|whack|thump)\b/i,
    guidance: "For 'hit/blow', madrazo is Mexican slang for a strong blow/hit. It is informal and potentially vulgar. Use golpe, puñetazo, or bofetada in formal Mexican Spanish. Madrazo should not appear in professional translations.",
    expectations: {
      requiredOutputGroups: [
        ["golpe", "puñetazo", "bofetada", "golpear", "pegar"],
      ],
      forbiddenOutputTerms: ["madrazo", "madrazos"],
    },
  },

  {
    id: "pinga-vulgar",
    dialects: ["es-CU", "es-DO", "es-PR", "es-VE"],
    sourcePattern: /\b(damn|fuck|shit|dick|prick|cock)\b/i,
    guidance: "Pinga is an extremely vulgar term (penis) used as a general intensifier in Cuban, Dominican, and Puerto Rican Spanish. Never translate any English term into pinga. Use maldición, demonio, or other register-appropriate intensifiers.",
    expectations: {
      requiredOutputGroups: [
        ["maldición", "demonio", "diablos"],
      ],
      forbiddenOutputTerms: ["pinga"],
    },
  },

  {
    id: "chucha-dog",
    dialects: "all",
    sourcePattern: /\b(bitch|female dog|dog|puppy)\b/i,
    guidance: "For 'female dog/bitch', chucha is a common word for dog in Salvadoran Spanish but is vulgar in Chilean Spanish and means 'cold' in Ecuadorian slang. Use perra for female dog universally, or perro/ Perrito for dogs in general. Avoid chucha in formal text.",
    expectations: {
      requiredOutputGroups: [
        ["perra", "perro", "perrito", "can"],
      ],
      forbiddenOutputTerms: ["chucha"],
    },
  },

  {
    id: "carepicha-vulgar",
    dialects: ["es-NI"],
    sourcePattern: /\b(awesome|amazing|cool|great|badass)\b/i,
    guidance: "Carepicha and carechimba are Nicaraguan vulgar intensifiers. Never use them in professional translation. Use increíble, fantástico, genial, or excelente.",
    expectations: {
      requiredOutputGroups: [
        ["increíble", "fantástico", "genial", "excelente", "impresionante"],
      ],
      forbiddenOutputTerms: ["carepicha", "carechimba"],
    },
  },

  {
    id: "chocha-satisfied",
    dialects: "all",
    sourcePattern: /\b(satisfied|happy|pleased|content|glad)\b/i,
    guidance: "Chocha/chocho can mean 'satisfied/happy' informally in Spain and some regions, but in other dialects chocha is vulgar. Use contento, satisfecho, feliz, or alegre for formal translation. Avoid chocho/chocha in all formal output.",
    expectations: {
      requiredOutputGroups: [
        ["contento", "satisfecho", "feliz", "alegre", "complacido"],
      ],
      forbiddenOutputTerms: ["chocha", "chocho"],
    },
  },

  {
    id: "leche-milk",
    dialects: "all",
    sourcePattern: /\b(milk|dairy|cream|creamy)\b/i,
    guidance: "For milk/dairy references, leche is standard and universally correct in food context. In informal contexts, leche can have sexual connotations in some dialects, but in formal food/product documentation, leche is always appropriate.",
    expectations: {
      requiredOutputGroups: [
        ["leche", "lácteo", "crema"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "fajar-beat",
    dialects: ["es-CO", "es-VE", "es-EC"],
    sourcePattern: /\b(spank|punish|whip|cane|corporal punishment)\b/i,
    guidance: "For 'beat/defeat/spank', fajar can mean 'to beat' in CO/VE but also has vulgar connotations. Use vencer, derrotar, or golpear in formal contexts.",
    expectations: {
      requiredOutputGroups: [
        ["vencer", "derrotar", "golpear", "ganar"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "teta-breast",
    dialects: "all",
    sourcePattern: /\b(breast|chest|bosom|nipple)\b/i,
    guidance: "For breast/chest references, teta is informal/vulgar in many dialects. Use pecho, seno, or mama in formal and medical contexts. Teta should only appear in deliberately informal register.",
    expectations: {
      requiredOutputGroups: [
        ["pecho", "seno", "mama", "torso"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "pirobo-vulgar",
    dialects: ["es-CO"],
    sourcePattern: /\b(asshole|jerk|idiot|moron|dumb|stupid)\b/i,
    guidance: "Pirobo is an extremely vulgar Colombian insult. Never use it in professional translation. Use idiota, tonto, or estúpido if the register calls for it.",
    expectations: {
      requiredOutputGroups: [
        ["idiota", "tonto", "estúpido", "necio"],
      ],
      forbiddenOutputTerms: ["pirobo"],
    },
  },

  {
    id: "chaqueta-jacket-mx",
    dialects: ["es-MX"],
    sourcePattern: /\b(jacket|coat)\b/i,
    guidance: "In Mexican Spanish, 'chaqueta' is vulgar slang for masturbation. Always use 'chamarra' for jacket/coat in MX. This is one of the most dangerous dialectal traps.",
    expectations: {
      requiredOutputGroups: [
        ["chamarra", "chaqueta"],
      ],
      forbiddenOutputTerms: ["chaqueta"],
    },
  },

  {
    id: "chaqueta-jacket-ar",
    dialects: ["es-AR"],
    sourcePattern: /\b(jacket|coat)\b/i,
    guidance: "In Argentine Spanish, 'campera' is the standard term for jacket/coat. 'Chaqueta' is understood but less common.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["campera", "chaqueta"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "negro-racial",
    dialects: "all",
    sourcePattern: /\b(black person|black man|black woman|african american|negro)\b/i,
    guidance: "The word 'negro/negra' is the standard Spanish term for the color black and is used as a racial descriptor in many dialects. In formal contexts, use 'afrodescendiente' or 'persona afrodescendiente'. In some dialects (especially Caribbean), 'negro/negra' used as an address term can be offensive. Context determines register.",
    expectations: {
      requiredOutputGroups: [
        ["negro", "negra", "afrodescendiente", "persona negra"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "gordo-affectionate",
    dialects: "all",
    sourcePattern: /\b(fat|overweight|chubby)\b/i,
    guidance: "'Gordo/gorda' is used as an affectionate nickname in AR, UY, MX, and parts of Central America, but can be offensive as a descriptor elsewhere. In formal translation, use 'con sobrepeso' or 'persona con obesidad'. In informal contexts where the source is endearing, 'gordo/gorda' may be appropriate in the right dialects.",
    expectations: {
      requiredOutputGroups: [
        ["gordo", "gorda", "con sobrepeso", "persona con obesidad", "regordete"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "bombilla-lightbulb",
    dialects: ["es-AR", "es-UY", "es-PY"],
    sourcePattern: /\b(lightbulb|bulb|lamp)\b/i,
    guidance: "In Rioplatense Spanish, 'bombilla' refers to the metal straw used for drinking mate, not a lightbulb. Use 'foco' (MX, Central Am, most LatAm) or 'bombilla' (ES) for lightbulb. In AR/UY/PY, use 'lámpara' or 'foco' for lightbulb.",
    expectations: {
      requiredOutputGroups: [
        ["foco", "lámpara", "ampolleta", "bombilla"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "pajilla-straw",
    dialects: ["es-PR", "es-DO", "es-VE"],
    sourcePattern: /\b(straw|drinking straw)\b/i,
    guidance: "'Pajilla' is the standard term for drinking straw in Puerto Rico, but in DO and VE it can have vulgar connotations. Use 'pajita' (ES), 'popote' (MX), 'sorbete' (AR, UY, CL), 'pitillo' (CO, VE), or 'cañita' (PE) depending on dialect.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["pajilla", "pitillo", "sorbete", "popote", "cañita"],
      ],
      forbiddenOutputTerms: dialect === "es-DO" || dialect === "es-VE" ? ["pajilla"] : [],
    }),
  },

  {
    id: "mamacita-catcall",
    dialects: ["es-MX", "es-CO", "es-CU", "es-DO", "es-PR"],
    sourcePattern: /\b(baby|sexy|hot girl|babe|sweetheart|honey)\b/i,
    guidance: "'Mamacita' is a term of endearment that can also function as street harassment (catcalling) in MX, CO, and Caribbean dialects. In professional translation, avoid it entirely. Use 'cariño', 'mi amor', or 'querida' for endearment.",
    expectations: {
      requiredOutputGroups: [
        ["cariño", "mi amor", "querida", "tesoro"],
      ],
      forbiddenOutputTerms: ["mamacita"],
    },
  },

  {
    id: "gringo-context",
    dialects: ["es-MX", "es-GT", "es-HN", "es-SV", "es-NI", "es-CR", "es-PA"],
    sourcePattern: /\b(foreigner|american|gringo|anglo)\b/i,
    guidance: "'Gringo' is widely used in Mexico and Central America to refer to people from the US. It can be neutral, affectionate, or pejorative depending on tone and context. In formal translation, use 'estadounidense' for neutral reference. 'Gringo' is acceptable in informal contexts.",
    expectations: {
      requiredOutputGroups: [
        ["estadounidense", "gringo", "norteamericano"],
      ],
      forbiddenOutputTerms: [],
    },
  },

  // --- Phase 3D: Additional high-priority ambiguity rules ---

  {
    id: "mono-chango-monkey",
    dialects: ["es-MX"],
    sourcePattern: /\b(monkey|ape|chimp)\b/i,
    guidance: "In Mexican Spanish, 'chango' means monkey and is widely used. 'Mono' is understood but less colloquial. Do not use 'chango' outside MX/GT/HN contexts where it may confuse.",
    expectations: {
      requiredOutputGroups: [["chango", "mono", "simio"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "chiva-goat-pr",
    dialects: ["es-PR", "es-HN", "es-NI"],
    sourcePattern: /\b(goat|kid)\b/i,
    guidance: "'Chiva' is common for goat in PR, HN, NI. In CO slang, 'chiva' means a cool thing/party. In Argentina, 'chiva' can mean angry. Context matters.",
    expectations: (dialect) => ({
      requiredOutputGroups: [["chiva", "cabra", "chivo"]],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "gonorrea-insult-co",
    dialects: ["es-CO"],
    sourcePattern: /\b(gonorrea|gonorrhea|insult|idiot|jerk)\b/i,
    guidance: "In Colombian Spanish, 'gonorrea' is an extremely offensive insult completely divorced from its medical meaning. NEVER use it as an insult in translation. For medical contexts, use 'gonorrea' clinically with appropriate framing. For insults, use 'idiota', 'imbecil', 'tonto'.",
    expectations: {
      requiredOutputGroups: [["idiota", "imbécil", "tonto", "estúpido"]],
      forbiddenOutputTerms: ["gonorrea"],
    },
  },

  {
    id: "hijueputa-insult-co-ve",
    dialects: ["es-CO", "es-VE"],
    sourcePattern: /\b(son of a bitch|motherfucker|SOB|bastard)\b/i,
    guidance: "'Hijueputa' (contraction of hijo de puta) is the most common strong insult in CO and VE. It is extremely vulgar. Use 'hijo de puta' (standard vulgarity) or 'maldito' (milder) in translation unless the source demands extreme register.",
    expectations: {
      requiredOutputGroups: [["hijo de puta", "maldito", "condenado"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "pirobo-insult-co",
    dialects: ["es-CO"],
    sourcePattern: /\b(faggot|gay slur|homophobic slur)\b/i,
    guidance: "'Pirobo' is a homophobic slur in Colombian Spanish. Do not use it in any translation context. Use neutral terminology or omit depending on translation goals.",
    expectations: {
      requiredOutputGroups: [[]],
      forbiddenOutputTerms: ["pirobo"],
    },
  },

  {
    id: "arrecho-angry-ve",
    dialects: ["es-VE", "es-CO"],
    sourcePattern: /\b(angry|furious|pissed off|horny|aroused)\b/i,
    guidance: "'Arrecho' in Venezuela means angry/furious colloquially, but in parts of CO and VE it can mean sexually aroused (vulgar). In VE it is extremely common for 'angry'. In formal translation, use 'enojado', 'furioso', or 'enfadado'.",
    expectations: {
      requiredOutputGroups: [["enojado", "furioso", "enfadado", "bravo"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "vaina-thing-do-ve",
    dialects: ["es-VE", "es-DO"],
    sourcePattern: /\b(thing|stuff|whatchamacallit|thingamajig)\b/i,
    guidance: "'Vaina' is extremely common in VE and DO for 'thing/stuff' — it is perhaps the most versatile word in Venezuelan Spanish. It can be neutral or vulgar depending on context and accompanying words. In formal translation, use 'cosa', 'asunto', or 'tema'.",
    expectations: {
      requiredOutputGroups: [["cosa", "asunto", "tema", "vaina"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "chevere-cool-ve-dr",
    dialects: ["es-VE", "es-DO", "es-PR", "es-CO", "es-PA"],
    sourcePattern: /\b(cool|awesome|great|neat|nice)\b/i,
    guidance: "'Chévere' is the standard 'cool/awesome' in VE, CO, DO, PR, PA. It originated in Venezuela. In other dialects, 'genial', 'bárbaro' (AR), 'padre' (MX), 'guay' (ES) are preferred.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["chévere", "chévere", "bueno", "genial"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "bobo-fool-caribbean",
    dialects: ["es-CO", "es-VE", "es-CU", "es-DO", "es-PR"],
    sourcePattern: /\b(fool|silly|stupid|dumb)\b/i,
    guidance: "'Bobo/boba' means fool/silly in most dialects, but in CO and VE it can have stronger connotations. In Caribbean Spanish it is mild. Use 'tonto' for neutral, 'bobo' for mild colloquial.",
    expectations: {
      requiredOutputGroups: [["tonto", "bobo", "necio"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "gaveta-drawer-pr-do",
    dialects: ["es-PR", "es-DO", "es-CU"],
    sourcePattern: /\b(drawer|cabinet|dresser)\b/i,
    guidance: "'Gaveta' is standard for drawer in PR, DO, CU. In most other dialects, 'cajón' is standard. 'Gaveta' may sound regional outside Caribbean.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-PR" || dialect === "es-DO" || dialect === "es-CU"
          ? ["gaveta", "cajón"]
          : ["cajón", "gaveta"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "pico-spout-chile",
    dialects: ["es-CL", "es-CO", "es-VE"],
    sourcePattern: /\b(spout|nozzle|beak|bill|peak)\b/i,
    guidance: "'Pico' means beak/spout/peak in standard Spanish, but in CL, CO, and parts of VE it is vulgar slang for penis. Use 'boquilla' or 'pitorro' for spout in these dialects.",
    expectations: (dialect) => ({
      requiredOutputGroups: [["boquilla", "pitorro", "apéndice"]],
      forbiddenOutputTerms: dialect === "es-CL" ? ["pico"] : [],
    }),
  },

  {
    id: "pajita-straw-spain",
    dialects: ["es-ES", "es-AD"],
    sourcePattern: /\b(straw|drinking straw)\b/i,
    guidance: "'Pajita' is the standard term for drinking straw in Spain, but in many Latin American dialects 'paja' and 'pajita' have masturbatory connotations. Use 'pajita' only for es-ES/es-AD.",
    expectations: {
      requiredOutputGroups: [["pajita", "pajita", "pajilla"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "paja-masturbation",
    dialects: ["es-AR", "es-UY", "es-PY", "es-CO", "es-VE", "es-CL", "es-PE", "es-EC", "es-BO"],
    sourcePattern: /\b(masturbat|jerking off|handjob)\b/i,
    guidance: "'Hacerse una paja' or 'paja' alone means masturbation in most LatAm dialects. 'Paja' also means straw/hay literally. Avoid 'paja' for straw in these dialects — use 'pajilla', 'pitillo', 'sorbete', 'popote' etc. instead.",
    expectations: {
      requiredOutputGroups: [["masturbación", "masturbarse"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "tortilla-bread-mx",
    dialects: ["es-MX", "es-GT", "es-HN", "es-SV", "es-NI"],
    sourcePattern: /\b(tortilla|flatbread|wrap)\b/i,
    guidance: "In Mexico and Central America, 'tortilla' refers to the corn/wheat flatbread staple. In Spain, 'tortilla' means an omelette (tortilla española). Context determines meaning — clarify when ambiguous.",
    expectations: {
      requiredOutputGroups: [["tortilla"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "tortilla-omelette-es",
    dialects: ["es-ES", "es-AD"],
    sourcePattern: /\b(omelette|omelet|tortilla española)\b/i,
    guidance: "In Spain, 'tortilla' means omelette (typically potato omelette = tortilla española). The flatbread is 'tortilla mexicana'. Do not translate omelette as 'omelette' (French loanword) when 'tortilla' is the standard Spanish term.",
    expectations: {
      requiredOutputGroups: [["tortilla", "tortilla francesa"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "carro-car-vs-cart",
    dialects: "all",
    sourcePattern: /\b(car|automobile|vehicle|cart|wagon)\b/i,
    guidance: "'Carro' means car in most LatAm, but in parts of rural Spain/Andorra it can mean cart/wagon. 'Coche' is the standard term for car in ES. In CO, 'carro' is universal. Context matters for transport vs cart.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-ES" || dialect === "es-AD"
          ? ["coche", "automóvil", "vehículo", "carro"]
          : ["carro", "coche", "automóvil", "vehículo", "auto"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "computadora-gender",
    dialects: ["es-CO", "es-CL", "es-EC", "es-VE"],
    sourcePattern: /\b(computer|laptop|notebook)\b/i,
    guidance: "'Computadora' (feminine) is standard in most LatAm, but CO, CL, EC prefer 'computador' (masculine). VE uses both. Match the gender to the local norm.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        dialect === "es-CO" || dialect === "es-CL" || dialect === "es-EC"
          ? ["computador", "computadora"]
          : ["computadora", "computador"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "bicho-insect-taboo",
    dialects: ["es-PR", "es-DO"],
    sourcePattern: /\b(bug|insect|beetle|pest)\b/i,
    guidance: "'Bicho' is standard for bug/insect in many dialects, but in PR and DO it is a vulgar term for penis. Use 'insecto', 'bicho' (with care), or 'plaga' depending on context. Avoid in formal registers in Caribbean.",
    expectations: (dialect) => ({
      requiredOutputGroups: [["insecto", "bicho", "plaga"]],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "papel-toilet-paper",
    dialects: ["es-VE", "es-CO"],
    sourcePattern: /\b(toilet paper|bathroom tissue)\b/i,
    guidance: "'Papel higiénico' is universal formal term. In VE informal, 'papel' alone can mean toilet paper but may be ambiguous. Always use 'papel higiénico' for clarity.",
    expectations: {
      requiredOutputGroups: [["papel higiénico"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "guagua-bus-caribbean",
    dialects: ["es-CU", "es-DO", "es-PR"],
    sourcePattern: /\b(bus|coach|transit|public transport)\b/i,
    guidance: "'Guagua' is the standard term for bus in CU, DO, PR. In CL/EC/BO it means baby. Do not use 'guagua' for bus outside Caribbean dialects. In formal contexts, 'autobús' works everywhere.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["guagua", "autobús", "bus"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "acelgas-dismissive",
    dialects: ["es-ES"],
    sourcePattern: /\b(nonsense|rubbish|bullshit|BS)\b/i,
    guidance: "'Acelgas' (literally chard) is used colloquially in Spain to mean nonsense/rubbish. For general translation, use 'tonterías', 'memeces', or 'absurdos'.",
    expectations: {
      requiredOutputGroups: [["tonterías", "memeces", "absurdos", "necedades"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "chancla-sandal-punishment",
    dialects: ["es-MX", "es-GT", "es-HN", "es-SV", "es-NI", "es-CR"],
    sourcePattern: /\b(sandal|flip.flop|slipper|corporal punishment)\b/i,
    guidance: "'Chancla' is the standard sandal/flip-flop in Mexico and Central America, but carries cultural connotation of maternal discipline ('la chancla'). In formal translation of clothing, it is neutral.",
    expectations: {
      requiredOutputGroups: [["chancla", "sandalia", "chancleta"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "mate-drink-ar-uy",
    dialects: ["es-AR", "es-UY", "es-PY"],
    sourcePattern: /\b(mate|yerba mate|herbal infusion)\b/i,
    guidance: "'Mate' is the iconic infused drink of AR, UY, PY. The drinking vessel is also called 'mate' (or 'porongo'). Do not confuse with 'maté' (I killed) or 'mate' (checkmate). Context is usually clear from cultural setting.",
    expectations: {
      requiredOutputGroups: [["mate", "yerba mate", "infusión"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "plata-silver-money",
    dialects: "all",
    sourcePattern: /\b(money|cash|silver|coins)\b/i,
    guidance: "'Plata' means silver (metal) universally, but in most LatAm it is also the most common colloquial term for money. 'Pasta' (ES informal), 'lana' (MX), 'guita' (AR), 'luca' (CL, individual note). For formal: 'dinero'.",
    expectations: {
      requiredOutputGroups: [["dinero", "plata", "efectivo"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "lata-can-pain",
    dialects: ["es-MX"],
    sourcePattern: /\b(can|tin|canned|annoying|pain)\b/i,
    guidance: "'Lata' means tin/can universally, but in Mexican Spanish 'dar la lata' means to annoy/be a pain. Context determines meaning. For metal containers, 'lata' is neutral.",
    expectations: {
      requiredOutputGroups: [["lata", "envase", "bote"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "saco-jacket-co",
    dialects: ["es-CO", "es-VE"],
    sourcePattern: /\b(jacket|blazer|sport coat|suit jacket)\b/i,
    guidance: "'Saco' is the standard term for jacket/blazer in CO and VE. In other dialects 'saco' can mean sack/bag. Use 'chaqueta' for MX (where 'chaqueta' has no vulgar connotation in this context), 'americana' (ES formal).",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["saco", "chaqueta", "americana", "blazer"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "palta-avocado-southern",
    dialects: ["es-CL", "es-PE", "es-AR", "es-UY"],
    sourcePattern: /\b(avocado|palta|aguacate)\b/i,
    guidance: "'Palta' is the standard term for avocado in CL, PE, AR, UY. 'Aguacate' is used in MX, Central Am, CO, Caribbean. Both terms are understood everywhere but regional preference is strong.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["palta", "aguacate"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "poroto-bean-southern",
    dialects: ["es-CL", "es-AR", "es-UY", "es-PY"],
    sourcePattern: /\b(bean|beans|legume|green bean)\b/i,
    guidance: "'Poroto' is the standard term for bean in CL, AR, UY, PY. 'Frijol' is used in MX, Central Am, CO. 'Judía' and 'alubia' in ES. Strong regional preference.",
    expectations: (dialect) => ({
      requiredOutputGroups: [
        ["poroto", "frijol", "judía", "alubia", "habichuela"],
      ],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "chompa-jacket-andean",
    dialects: ["es-PE", "es-BO", "es-EC"],
    sourcePattern: /\b(jacket|coat|windbreaker)\b/i,
    guidance: "'Chompa' is common for jacket/sweater in Andean regions (PE, BO, EC). From English 'jumper'. Use 'chaqueta' for formal, 'chompa' is informal standard.",
    expectations: {
      requiredOutputGroups: [["chompa", "chaqueta", "campera"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "billetera-wallet-ar-uy",
    dialects: ["es-AR", "es-UY", "es-PY", "es-CL"],
    sourcePattern: /\b(wallet|billfold|purse)\b/i,
    guidance: "'Billetera' is standard for wallet in Southern Cone. 'Cartera' in AR/UY means purse/handbag, while in MX/ES 'cartera' can mean wallet. 'Portafolio' in CO. Regional preference is strong.",
    expectations: (dialect) => ({
      requiredOutputGroups: [["billetera", "cartera", "portafolio"]],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "laptop-notebook-ar",
    dialects: ["es-AR", "es-UY"],
    sourcePattern: /\b(laptop|notebook|portable computer)\b/i,
    guidance: "'Notebook' (loanword) is the most common term for laptop in AR and UY. 'Laptop' is used in most LatAm. 'Portátil' in ES. The loanword is fully naturalized in Rioplatense Spanish.",
    expectations: (dialect) => ({
      requiredOutputGroups: [["notebook", "laptop", "portátil", "computadora portátil"]],
      forbiddenOutputTerms: [],
    }),
  },

  {
    id: "tuerta-one-eyed",
    dialects: ["es-PR", "es-DO"],
    sourcePattern: /\b(one.eyed|blind in one eye|patch)\b/i,
    guidance: "'Tuerto/tuerta' means one-eyed and is used across all dialects. In PR/DO slang, it can have additional colloquial meanings. In formal contexts, use 'persona con pérdida de visión en un ojo'.",
    expectations: {
      requiredOutputGroups: [["tuerto", "tuerta"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "limon-lemon-lime",
    dialects: "all",
    sourcePattern: /\b(lemon|lime|citrus|yellow citrus|green citrus)\b/i,
    guidance: "'Limón' is used for both lemon and lime in most LatAm, while Spain distinguishes 'limón' (lemon) from 'lima' (lime). In MX, 'limón' usually means lime. Context clarification may be needed for precise botanical distinction.",
    expectations: {
      requiredOutputGroups: [["limón", "lima"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "recia-strong-woman",
    dialects: ["es-CO", "es-VE", "es-EC"],
    sourcePattern: /\b(strong woman|formidable woman|tough woman)\b/i,
    guidance: "'Recia' in Andean and northern South American Spanish describes a strong, hardworking woman and is generally positive. In other dialects it may sound unusual. 'Mujer fuerte' works universally.",
    expectations: {
      requiredOutputGroups: [["recia", "mujer fuerte", "fuerte"]],
      forbiddenOutputTerms: [],
    },
  },

  {
    id: "chingar-vulgar-mx",
    dialects: ["es-MX"],
    sourcePattern: /\b(fuck|screw|mess up|ruin)\b/i,
    guidance: "'Chingar' is the most versatile vulgar verb in Mexican Spanish (like 'fuck' in English). Its conjugated forms appear in countless expressions. In formal translation, use 'molestar', 'arruinar', 'fastidiar'. The vulgar form should only appear when source demands it.",
    expectations: {
      requiredOutputGroups: [["molestar", "arruinar", "fastidiar", "joder"]],
      forbiddenOutputTerms: [],
    },
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
