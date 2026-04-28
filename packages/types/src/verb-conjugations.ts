import type { SpanishDialect } from "./index.js";
import { FULL_VOSEO_DIALECTS, REGIONAL_VOSEO_DIALECTS, TÚ_ONLY_DIALECTS, PARQUEAR_DIALECTS } from "./dialect-regions.js";

export interface VerbConjugationForms {
  present_2s?: string;
  imperative_2s?: string;
  present_subj_2s?: string;
  preterite_1s?: string;
  preterite_3s?: string;
}

export interface VerbConjugation {
  infinitive: string;
  meaning: string;
  category: "lemma-change" | "conjugation-pattern";
  regionalInfinitive?: Partial<Record<SpanishDialect, string>>;
  forms: Partial<Record<SpanishDialect, VerbConjugationForms>>;
  usageNotes?: Partial<Record<SpanishDialect, string>>;
}

// Voseo classification — sourced from dialect-regions.ts:
//   FULL_VOSEO_DIALECTS: AR, UY, PY, GT, HN, SV, NI, CR
//   REGIONAL_VOSEO_DIALECTS: BO, EC, CO, VE, CL
//   TÚ_ONLY_DIALECTS: ES, AD, MX, PE, PR, DO, CU, PA, US, GQ, PH, BZ

type V = VerbConjugationForms;
const VOSEO_DIALECTS = [...FULL_VOSEO_DIALECTS, ...REGIONAL_VOSEO_DIALECTS] as SpanishDialect[];
const TÚ_DIALECTS = [...TÚ_ONLY_DIALECTS] as SpanishDialect[];

function túForms(present_2s: string, imperative_2s: string): V {
  return { present_2s, imperative_2s };
}
function vosForms(present_2s: string, imperative_2s: string): V {
  return { present_2s, imperative_2s };
}

function buildForms(tú: V, vos: V): Partial<Record<SpanishDialect, V>> {
  const forms: Partial<Record<SpanishDialect, V>> = {};
  for (const d of TÚ_DIALECTS) forms[d] = tú;
  for (const d of VOSEO_DIALECTS) forms[d] = vos;
  return forms;
}

export const VERB_CONJUGATIONS: VerbConjugation[] = [

// --- Category A: Lemma-changing verbs ---

{
  infinitive: "conducir",
  meaning: "to drive/operate a vehicle",
  category: "lemma-change",
  regionalInfinitive: {
    "es-MX": "manejar", "es-AR": "manejar", "es-CO": "manejar", "es-CU": "manejar",
    "es-PE": "manejar", "es-CL": "manejar", "es-VE": "manejar", "es-UY": "manejar",
    "es-PY": "manejar", "es-BO": "manejar", "es-EC": "manejar", "es-GT": "manejar",
    "es-HN": "manejar", "es-SV": "manejar", "es-NI": "manejar", "es-CR": "manejar",
    "es-PA": "manejar", "es-DO": "manejar", "es-PR": "manejar", "es-US": "manejar",
    "es-GQ": "manejar", "es-PH": "manejar", "es-BZ": "manejar",
  },
  forms: {},
  usageNotes: {
    "es-ES": "conducir is standard formal register; manejar also understood",
  },
},

{
  infinitive: "aparcar",
  meaning: "to park a vehicle",
  category: "lemma-change",
  regionalInfinitive: {
    "es-MX": "estacionar", "es-AR": "estacionar", "es-CO": "estacionar", "es-CU": "parquear",
    "es-PE": "estacionar", "es-CL": "estacionar", "es-VE": "estacionar", "es-UY": "estacionar",
    "es-PY": "estacionar", "es-BO": "estacionar", "es-EC": "estacionar", "es-GT": "estacionar",
    "es-HN": "estacionar", "es-SV": "estacionar", "es-NI": "estacionar", "es-CR": "parquear",
    "es-PA": "parquear", "es-DO": "parquear", "es-PR": "parquear", "es-US": "parquear",
    "es-GQ": "estacionar", "es-PH": "estacionar", "es-BZ": "parquear",
  },
  forms: {},
  usageNotes: {
    "es-ES": "aparcar is standard; estacionar is also valid formal",
    "es-PR": "parquear is standard; from English park",
    "es-CU": "parquear is standard; estacionar is formal",
    "es-DO": "parquear is standard; estacionar is formal",
    "es-PA": "parquear is standard; from English park",
    "es-US": "parquear is standard; from English park",
    "es-CR": "parquear is common; estacionar also valid",
    "es-BZ": "parquear is standard; English is co-official",
  },
},

{
  infinitive: "alquilar",
  meaning: "to rent",
  category: "lemma-change",
  regionalInfinitive: {
    "es-MX": "rentar", "es-GT": "rentar", "es-HN": "rentar", "es-SV": "rentar",
    "es-NI": "rentar", "es-CR": "rentar", "es-PA": "rentar",
  },
  forms: {},
},

{
  infinitive: "encender",
  meaning: "to turn on / ignite",
  category: "lemma-change",
  regionalInfinitive: {
    "es-MX": "prender", "es-CO": "prender", "es-VE": "prender", "es-GT": "prender",
    "es-HN": "prender", "es-SV": "prender", "es-NI": "prender", "es-CR": "prender",
    "es-PA": "prender", "es-EC": "prender", "es-PR": "prender", "es-DO": "prender",
    "es-CU": "prender", "es-BO": "prender", "es-PE": "prender", "es-US": "prender",
  },
  forms: {},
},

{
  infinitive: "facturar",
  meaning: "to charge/bill for service",
  category: "lemma-change",
  forms: {},
  usageNotes: {
    "es-MX": "facturar is used in service/commercial billing contexts; cobrar is the general verb for charging",
  },
},

{
  infinitive: "congelar",
  meaning: "to freeze",
  category: "lemma-change",
  regionalInfinitive: {},
  forms: {},
  usageNotes: {
    "es-PR": "congelar is standard; frizar/frisar is informal anglicism",
    "es-US": "congelar is standard; frizar is informal anglicism",
    "es-DO": "congelar is standard; frisar is informal anglicism",
  },
},

// --- Category B: Conjugation-pattern verbs (voseo) ---

{
  infinitive: "ser",
  meaning: "to be",
  category: "conjugation-pattern",
  forms: buildForms(túForms("eres", "sé"), vosForms("sos", "sé")),
},

{
  infinitive: "tener",
  meaning: "to have",
  category: "conjugation-pattern",
  forms: buildForms(túForms("tienes", "ten"), vosForms("tenés", "tené")),
},

{
  infinitive: "poder",
  meaning: "to be able to",
  category: "conjugation-pattern",
  forms: buildForms(túForms("puedes", "pued"), vosForms("podés", "podé")),
},

{
  infinitive: "ir",
  meaning: "to go",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vas", "ve"), vosForms("vas", "andá")),
},

{
  infinitive: "hacer",
  meaning: "to do/make",
  category: "conjugation-pattern",
  forms: buildForms(túForms("haces", "haz"), vosForms("hacés", "hacé")),
},

{
  infinitive: "decir",
  meaning: "to say/tell",
  category: "conjugation-pattern",
  forms: buildForms(túForms("dices", "di"), vosForms("decís", "decí")),
},

{
  infinitive: "querer",
  meaning: "to want",
  category: "conjugation-pattern",
  forms: buildForms(túForms("quieres", "quiere"), vosForms("querés", "queré")),
},

{
  infinitive: "saber",
  meaning: "to know",
  category: "conjugation-pattern",
  forms: buildForms(túForms("sabes", "sabe"), vosForms("sabés", "sabé")),
},

{
  infinitive: "dar",
  meaning: "to give",
  category: "conjugation-pattern",
  forms: buildForms(túForms("das", "da"), vosForms("das", "da")),
},

{
  infinitive: "venir",
  meaning: "to come",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vienes", "ven"), vosForms("venís", "vení")),
},

{
  infinitive: "poner",
  meaning: "to put",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pones", "pon"), vosForms("ponés", "poné")),
},

{
  infinitive: "salir",
  meaning: "to leave",
  category: "conjugation-pattern",
  forms: buildForms(túForms("sales", "sal"), vosForms("salís", "salí")),
},

{
  infinitive: "volver",
  meaning: "to return",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vuelves", "vuelve"), vosForms("volvés", "volvé")),
},

{
  infinitive: "jugar",
  meaning: "to play",
  category: "conjugation-pattern",
  forms: buildForms(túForms("juegas", "juega"), vosForms("jugás", "jugá")),
},

{
  infinitive: "pensar",
  meaning: "to think",
  category: "conjugation-pattern",
  forms: buildForms(túForms("piensas", "piensa"), vosForms("pensás", "pensá")),
},

{
  infinitive: "sentir",
  meaning: "to feel",
  category: "conjugation-pattern",
  forms: buildForms(túForms("sientes", "siente"), vosForms("sentís", "sentí")),
},

{
  infinitive: "dormir",
  meaning: "to sleep",
  category: "conjugation-pattern",
  forms: buildForms(túForms("duermes", "duerme"), vosForms("dormís", "dormí")),
},

{
  infinitive: "pedir",
  meaning: "to ask for",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pides", "pide"), vosForms("pedís", "pedí")),
},

{
  infinitive: "seguir",
  meaning: "to follow",
  category: "conjugation-pattern",
  forms: buildForms(túForms("sigues", "sigue"), vosForms("seguís", "seguí")),
},

{
  infinitive: "morir",
  meaning: "to die",
  category: "conjugation-pattern",
  forms: buildForms(túForms("mueres", "muere"), vosForms("morís", "morí")),
},

{
  infinitive: "hablar",
  meaning: "to speak",
  category: "conjugation-pattern",
  forms: buildForms(túForms("hablas", "habla"), vosForms("hablás", "hablá")),
},

{
  infinitive: "comer",
  meaning: "to eat",
  category: "conjugation-pattern",
  forms: buildForms(túForms("comes", "come"), vosForms("comés", "comé")),
},

{
  infinitive: "vivir",
  meaning: "to live",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vives", "vive"), vosForms("vivís", "viví")),
},

{
  infinitive: "comprar",
  meaning: "to buy",
  category: "conjugation-pattern",
  forms: buildForms(túForms("compras", "compra"), vosForms("comprás", "comprá")),
},

{
  infinitive: "trabajar",
  meaning: "to work",
  category: "conjugation-pattern",
  forms: buildForms(túForms("trabajas", "trabaja"), vosForms("trabajás", "trabajá")),
},

{
  infinitive: "buscar",
  meaning: "to search/look for",
  category: "conjugation-pattern",
  forms: buildForms(túForms("buscas", "busca"), vosForms("buscás", "buscá")),
},

{
  infinitive: "necesitar",
  meaning: "to need",
  category: "conjugation-pattern",
  forms: buildForms(túForms("necesitas", "necesita"), vosForms("necesitás", "necesitá")),
},

{
  infinitive: "entender",
  meaning: "to understand",
  category: "conjugation-pattern",
  forms: buildForms(túForms("entiendes", "entiende"), vosForms("entendés", "entendé")),
},

{
  infinitive: "mostrar",
  meaning: "to show",
  category: "conjugation-pattern",
  forms: buildForms(túForms("muestras", "muestra"), vosForms("mostrás", "mostrá")),
},

{
  infinitive: "recordar",
  meaning: "to remember",
  category: "conjugation-pattern",
  forms: buildForms(túForms("recuerdas", "recuerda"), vosForms("recordás", "recordá")),
},

];
