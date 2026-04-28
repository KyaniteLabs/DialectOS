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
//   FULL_VOSEO_DIALECTS: AR, UY, PY, GT, HN, SV, NI
//   REGIONAL_VOSEO_DIALECTS: BO, EC, CR, CO, VE, CL
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

{
  infinitive: "platicar",
  meaning: "to chat/converse",
  category: "lemma-change",
  regionalInfinitive: {
    "es-ES": "charlar", "es-AD": "charlar",
  },
  forms: {},
  usageNotes: {
    "es-ES": "charlar is standard; platicar is understood but uncommon",
    "es-MX": "platicar is standard for casual conversation",
  },
},

{
  infinitive: "extrañar",
  meaning: "to miss someone/something",
  category: "lemma-change",
  regionalInfinitive: {
    "es-ES": "echar de menos", "es-AD": "echar de menos",
  },
  forms: {},
  usageNotes: {
    "es-ES": "echar de menos is standard; extrañar sounds American",
    "es-AR": "extrañar is standard",
  },
},

{
  infinitive: "enojarse",
  meaning: "to get angry",
  category: "lemma-change",
  regionalInfinitive: {
    "es-ES": "enfadarse", "es-AD": "enfadarse",
    "es-CO": "calentarse", "es-VE": "calentarse",
    "es-DO": "bravarse", "es-PR": "bravarse", "es-CU": "bravarse",
  },
  forms: {},
  usageNotes: {
    "es-ES": "enfadarse is standard",
    "es-MX": "enojarse is standard across all registers",
    "es-AR": "enojarse is standard; enfadarse sounds peninsular",
    "es-CO": "calentarse is informal standard; enojarse also understood",
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

{
  infinitive: "leer",
  meaning: "to read",
  category: "conjugation-pattern",
  forms: buildForms(túForms("lees", "lee"), vosForms("leés", "leé")),
},

{
  infinitive: "escribir",
  meaning: "to write",
  category: "conjugation-pattern",
  forms: buildForms(túForms("escribes", "escribe"), vosForms("escribís", "escribí")),
},

{
  infinitive: "abrir",
  meaning: "to open",
  category: "conjugation-pattern",
  forms: buildForms(túForms("abres", "abre"), vosForms("abrís", "abrí")),
},

{
  infinitive: "cerrar",
  meaning: "to close",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cierras", "cierra"), vosForms("cerrás", "cerrá")),
},

{
  infinitive: "empezar",
  meaning: "to begin",
  category: "conjugation-pattern",
  forms: buildForms(túForms("empiezas", "empieza"), vosForms("empezás", "empezá")),
},

{
  infinitive: "terminar",
  meaning: "to finish",
  category: "conjugation-pattern",
  forms: buildForms(túForms("terminas", "termina"), vosForms("terminás", "terminá")),
},

{
  infinitive: "dejar",
  meaning: "to let/leave",
  category: "conjugation-pattern",
  forms: buildForms(túForms("dejas", "deja"), vosForms("dejás", "dejá")),
},

{
  infinitive: "entrar",
  meaning: "to enter",
  category: "conjugation-pattern",
  forms: buildForms(túForms("entras", "entra"), vosForms("entrás", "entrá")),
},

{
  infinitive: "subir",
  meaning: "to go up",
  category: "conjugation-pattern",
  forms: buildForms(túForms("subes", "sube"), vosForms("subís", "subí")),
},

{
  infinitive: "bajar",
  meaning: "to go down",
  category: "conjugation-pattern",
  forms: buildForms(túForms("bajas", "baja"), vosForms("bajás", "bajá")),
},

{
  infinitive: "traer",
  meaning: "to bring",
  category: "conjugation-pattern",
  forms: buildForms(túForms("traes", "trae"), vosForms("traés", "traé")),
},

{
  infinitive: "pagar",
  meaning: "to pay",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pagas", "paga"), vosForms("pagás", "pagá")),
},

{
  infinitive: "cambiar",
  meaning: "to change",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cambias", "cambia"), vosForms("cambiás", "cambiá")),
},

{
  infinitive: "ganar",
  meaning: "to win/earn",
  category: "conjugation-pattern",
  forms: buildForms(túForms("ganas", "gana"), vosForms("ganás", "ganá")),
},

{
  infinitive: "perder",
  meaning: "to lose",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pierdes", "pierde"), vosForms("perdés", "perdé")),
},

{
  infinitive: "recibir",
  meaning: "to receive",
  category: "conjugation-pattern",
  forms: buildForms(túForms("recibes", "recibe"), vosForms("recibís", "recibí")),
},

{
  infinitive: "crear",
  meaning: "to create",
  category: "conjugation-pattern",
  forms: buildForms(túForms("creas", "crea"), vosForms("creás", "creá")),
},

{
  infinitive: "mejorar",
  meaning: "to improve",
  category: "conjugation-pattern",
  forms: buildForms(túForms("mejoras", "mejora"), vosForms("mejorás", "mejorá")),
},

{
  infinitive: "permitir",
  meaning: "to allow",
  category: "conjugation-pattern",
  forms: buildForms(túForms("permites", "permite"), vosForms("permitís", "permití")),
},

{
  infinitive: "explicar",
  meaning: "to explain",
  category: "conjugation-pattern",
  forms: buildForms(túForms("explicas", "explica"), vosForms("explicás", "explicá")),
},

{
  infinitive: "responder",
  meaning: "to answer/respond",
  category: "conjugation-pattern",
  forms: buildForms(túForms("respondes", "responde"), vosForms("respondés", "respondé")),
},

{
  infinitive: "resultar",
  meaning: "to turn out/result",
  category: "conjugation-pattern",
  forms: buildForms(túForms("resultas", "resulta"), vosForms("resultás", "resultá")),
},

{
  infinitive: "incluir",
  meaning: "to include",
  category: "conjugation-pattern",
  forms: buildForms(túForms("incluyes", "incluye"), vosForms("incluís", "incluí")),
},

{
  infinitive: "controlar",
  meaning: "to control",
  category: "conjugation-pattern",
  forms: buildForms(túForms("controlas", "controla"), vosForms("controlás", "controlá")),
},

{
  infinitive: "alcanzar",
  meaning: "to reach/achieve",
  category: "conjugation-pattern",
  forms: buildForms(túForms("alcanzas", "alcanza"), vosForms("alcanzás", "alcanzá")),
},

{
  infinitive: "vender",
  meaning: "to sell",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vendes", "vende"), vosForms("vendés", "vendé")),
},

{
  infinitive: "correr",
  meaning: "to run",
  category: "conjugation-pattern",
  forms: buildForms(túForms("corres", "corre"), vosForms("corrés", "corré")),
},

{
  infinitive: "evitar",
  meaning: "to avoid",
  category: "conjugation-pattern",
  forms: buildForms(túForms("evitas", "evita"), vosForms("evitás", "evitá")),
},

{
  infinitive: "mantener",
  meaning: "to maintain",
  category: "conjugation-pattern",
  forms: buildForms(túForms("mantienes", "mantiene"), vosForms("mantenés", "mantené")),
},

{
  infinitive: "desarrollar",
  meaning: "to develop",
  category: "conjugation-pattern",
  forms: buildForms(túForms("desarrollas", "desarrolla"), vosForms("desarrollás", "desarrollá")),
},

{
  infinitive: "reconocer",
  meaning: "to recognize",
  category: "conjugation-pattern",
  forms: buildForms(túForms("reconoces", "reconoce"), vosForms("reconocés", "reconocé")),
},

{
  infinitive: "generar",
  meaning: "to generate",
  category: "conjugation-pattern",
  forms: buildForms(túForms("generas", "genera"), vosForms("generás", "generá")),
},

{
  infinitive: "producir",
  meaning: "to produce",
  category: "conjugation-pattern",
  forms: buildForms(túForms("produces", "produce"), vosForms("producís", "producí")),
},

{
  infinitive: "establecer",
  meaning: "to establish",
  category: "conjugation-pattern",
  forms: buildForms(túForms("estableces", "establece"), vosForms("establecés", "establecé")),
},

{
  infinitive: "publicar",
  meaning: "to publish",
  category: "conjugation-pattern",
  forms: buildForms(túForms("publicas", "publica"), vosForms("publicás", "publicá")),
},

{
  infinitive: "reducir",
  meaning: "to reduce",
  category: "conjugation-pattern",
  forms: buildForms(túForms("reduces", "reduce"), vosForms("reducís", "reducí")),
},

{
  infinitive: "intentar",
  meaning: "to try/attempt",
  category: "conjugation-pattern",
  forms: buildForms(túForms("intentas", "intenta"), vosForms("intentás", "intentá")),
},

{
  infinitive: "ofrecer",
  meaning: "to offer",
  category: "conjugation-pattern",
  forms: buildForms(túForms("ofreces", "ofrece"), vosForms("ofrecés", "ofrecé")),
},

{
  infinitive: "cumplir",
  meaning: "to fulfill",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cumples", "cumple"), vosForms("cumplís", "cumplí")),
},

{
  infinitive: "representar",
  meaning: "to represent",
  category: "conjugation-pattern",
  forms: buildForms(túForms("representas", "representa"), vosForms("representás", "representá")),
},

{
  infinitive: "crecer",
  meaning: "to grow",
  category: "conjugation-pattern",
  forms: buildForms(túForms("creces", "crece"), vosForms("crecés", "crecé")),
},

{
  infinitive: "dirigir",
  meaning: "to direct/manage",
  category: "conjugation-pattern",
  forms: buildForms(túForms("diriges", "dirige"), vosForms("dirigís", "dirigí")),
},

{
  infinitive: "eliminar",
  meaning: "to eliminate",
  category: "conjugation-pattern",
  forms: buildForms(túForms("eliminas", "elimina"), vosForms("eliminás", "eliminá")),
},

{
  infinitive: "informar",
  meaning: "to inform",
  category: "conjugation-pattern",
  forms: buildForms(túForms("informas", "informa"), vosForms("informás", "informá")),
},

{
  infinitive: "promover",
  meaning: "to promote",
  category: "conjugation-pattern",
  forms: buildForms(túForms("promueves", "promueve"), vosForms("promovés", "promové")),
},

{
  infinitive: "distribuir",
  meaning: "to distribute",
  category: "conjugation-pattern",
  forms: buildForms(túForms("distribuyes", "distribuye"), vosForms("distribuís", "distribuí")),
},

{
  infinitive: "aceptar",
  meaning: "to accept",
  category: "conjugation-pattern",
  forms: buildForms(túForms("aceptas", "acepta"), vosForms("aceptás", "aceptá")),
},

{
  infinitive: "construir",
  meaning: "to build",
  category: "conjugation-pattern",
  forms: buildForms(túForms("construyes", "construye"), vosForms("construís", "construí")),
},

{
  infinitive: "realizar",
  meaning: "to carry out",
  category: "conjugation-pattern",
  forms: buildForms(túForms("realizas", "realiza"), vosForms("realizás", "realizá")),
},

{
  infinitive: "presentar",
  meaning: "to present",
  category: "conjugation-pattern",
  forms: buildForms(túForms("presentas", "presenta"), vosForms("presentás", "presentá")),
},

{
  infinitive: "administrar",
  meaning: "to administer",
  category: "conjugation-pattern",
  forms: buildForms(túForms("administras", "administra"), vosForms("administrás", "administrá")),
},

{
  infinitive: "analizar",
  meaning: "to analyze",
  category: "conjugation-pattern",
  forms: buildForms(túForms("analizas", "analiza"), vosForms("analizás", "analizá")),
},

{
  infinitive: "enviar",
  meaning: "to send",
  category: "conjugation-pattern",
  forms: buildForms(túForms("envías", "envía"), vosForms("enviás", "enviá")),
},

{
  infinitive: "depender",
  meaning: "to depend",
  category: "conjugation-pattern",
  forms: buildForms(túForms("dependes", "depende"), vosForms("dependés", "dependé")),
},

{
  infinitive: "facilitar",
  meaning: "to facilitate",
  category: "conjugation-pattern",
  forms: buildForms(túForms("facilitas", "facilita"), vosForms("facilitás", "facilitá")),
},

{
  infinitive: "aplicar",
  meaning: "to apply",
  category: "conjugation-pattern",
  forms: buildForms(túForms("aplicas", "aplica"), vosForms("aplicás", "aplicá")),
},

{
  infinitive: "continuar",
  meaning: "to continue",
  category: "conjugation-pattern",
  forms: buildForms(túForms("continúas", "continúa"), vosForms("continuás", "continuá")),
},

{
  infinitive: "repetir",
  meaning: "to repeat",
  category: "conjugation-pattern",
  forms: buildForms(túForms("repites", "repite"), vosForms("repetís", "repetí")),
},

{
  infinitive: "servir",
  meaning: "to serve",
  category: "conjugation-pattern",
  forms: buildForms(túForms("sirves", "sirve"), vosForms("servís", "serví")),
},

{
  infinitive: "elegir",
  meaning: "to choose",
  category: "conjugation-pattern",
  forms: buildForms(túForms("eliges", "elige"), vosForms("elegís", "elegí")),
},

{
  infinitive: "conseguir",
  meaning: "to get/obtain",
  category: "conjugation-pattern",
  forms: buildForms(túForms("consigues", "consigue"), vosForms("conseguís", "conseguí")),
},

{
  infinitive: "considerar",
  meaning: "to consider",
  category: "conjugation-pattern",
  forms: buildForms(túForms("consideras", "considera"), vosForms("considerás", "considerá")),
},

{
  infinitive: "decidir",
  meaning: "to decide",
  category: "conjugation-pattern",
  forms: buildForms(túForms("decides", "decide"), vosForms("decidís", "decidí")),
},

{
  infinitive: "determinar",
  meaning: "to determine",
  category: "conjugation-pattern",
  forms: buildForms(túForms("determinas", "determina"), vosForms("determinás", "determiná")),
},

{
  infinitive: "existir",
  meaning: "to exist",
  category: "conjugation-pattern",
  forms: buildForms(túForms("existes", "existe"), vosForms("existís", "existí")),
},

{
  infinitive: "formar",
  meaning: "to form",
  category: "conjugation-pattern",
  forms: buildForms(túForms("formas", "forma"), vosForms("formás", "formá")),
},

{
  infinitive: "expresar",
  meaning: "to express",
  category: "conjugation-pattern",
  forms: buildForms(túForms("expresas", "expresa"), vosForms("expresás", "expresá")),
},

{
  infinitive: "nacer",
  meaning: "to be born",
  category: "conjugation-pattern",
  forms: buildForms(túForms("naces", "nace"), vosForms("nacés", "nacé")),
},

{
  infinitive: "disponer",
  meaning: "to arrange/dispose",
  category: "conjugation-pattern",
  forms: buildForms(túForms("dispones", "dispone"), vosForms("disponés", "disponé")),
},

{
  infinitive: "ocurrir",
  meaning: "to occur",
  category: "conjugation-pattern",
  forms: buildForms(túForms("ocurres", "ocurre"), vosForms("ocurrís", "ocurrí")),
},

{
  infinitive: "observar",
  meaning: "to observe",
  category: "conjugation-pattern",
  forms: buildForms(túForms("observas", "observa"), vosForms("observás", "observá")),
},

{
  infinitive: "estudiar",
  meaning: "to study",
  category: "conjugation-pattern",
  forms: buildForms(túForms("estudias", "estudia"), vosForms("estudiás", "estudiá")),
},

{
  infinitive: "bailar",
  meaning: "to dance",
  category: "conjugation-pattern",
  forms: buildForms(túForms("bailas", "baila"), vosForms("bailás", "bailá")),
},

{
  infinitive: "cantar",
  meaning: "to sing",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cantas", "canta"), vosForms("cantás", "cantá")),
},

{
  infinitive: "cocinar",
  meaning: "to cook",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cocinas", "cocina"), vosForms("cocinás", "cociná")),
},

{
  infinitive: "lavar",
  meaning: "to wash",
  category: "conjugation-pattern",
  forms: buildForms(túForms("lavas", "lava"), vosForms("lavás", "lavá")),
},

{
  infinitive: "limpiar",
  meaning: "to clean",
  category: "conjugation-pattern",
  forms: buildForms(túForms("limpias", "limpia"), vosForms("limpiás", "limpiá")),
},

{
  infinitive: "preparar",
  meaning: "to prepare",
  category: "conjugation-pattern",
  forms: buildForms(túForms("preparas", "prepara"), vosForms("preparás", "prepará")),
},

{
  infinitive: "apagar",
  meaning: "to turn off",
  category: "conjugation-pattern",
  forms: buildForms(túForms("apagas", "apaga"), vosForms("apagás", "apagá")),
},

{
  infinitive: "cortar",
  meaning: "to cut",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cortas", "corta"), vosForms("cortás", "cortá")),
},

{
  infinitive: "faltar",
  meaning: "to be missing/lack",
  category: "conjugation-pattern",
  forms: buildForms(túForms("faltas", "falta"), vosForms("faltás", "faltá")),
},

{
  infinitive: "golpear",
  meaning: "to hit/strike",
  category: "conjugation-pattern",
  forms: buildForms(túForms("golpeas", "golpea"), vosForms("golpeás", "golpeá")),
},

{
  infinitive: "levantar",
  meaning: "to lift/raise",
  category: "conjugation-pattern",
  forms: buildForms(túForms("levantas", "levanta"), vosForms("levantás", "levantá")),
},

{
  infinitive: "llegar",
  meaning: "to arrive",
  category: "conjugation-pattern",
  forms: buildForms(túForms("llegas", "llega"), vosForms("llegás", "llegá")),
},

{
  infinitive: "llenar",
  meaning: "to fill",
  category: "conjugation-pattern",
  forms: buildForms(túForms("llenas", "llena"), vosForms("llenás", "llená")),
},

{
  infinitive: "mirar",
  meaning: "to look/watch",
  category: "conjugation-pattern",
  forms: buildForms(túForms("miras", "mira"), vosForms("mirás", "mirá")),
},

{
  infinitive: "olvidar",
  meaning: "to forget",
  category: "conjugation-pattern",
  forms: buildForms(túForms("olvidas", "olvida"), vosForms("olvidás", "olvidá")),
},

{
  infinitive: "organizar",
  meaning: "to organize",
  category: "conjugation-pattern",
  forms: buildForms(túForms("organizas", "organiza"), vosForms("organizás", "organizá")),
},

{
  infinitive: "preguntar",
  meaning: "to ask",
  category: "conjugation-pattern",
  forms: buildForms(túForms("preguntas", "pregunta"), vosForms("preguntás", "preguntá")),
},

{
  infinitive: "quitar",
  meaning: "to remove",
  category: "conjugation-pattern",
  forms: buildForms(túForms("quitas", "quita"), vosForms("quitás", "quitá")),
},

{
  infinitive: "regresar",
  meaning: "to return",
  category: "conjugation-pattern",
  forms: buildForms(túForms("regresas", "regresa"), vosForms("regresás", "regresá")),
},

{
  infinitive: "tapar",
  meaning: "to cover",
  category: "conjugation-pattern",
  forms: buildForms(túForms("tapas", "tapa"), vosForms("tapás", "tapá")),
},

{
  infinitive: "imprimir",
  meaning: "to print",
  category: "conjugation-pattern",
  forms: buildForms(túForms("imprimes", "imprime"), vosForms("imprimís", "imprimí")),
},

{
  infinitive: "googlear",
  meaning: "to google/search online",
  category: "conjugation-pattern",
  forms: buildForms(túForms("googleas", "googlea"), vosForms("googleás", "googleá")),
},

// --- Missing top-100 verbs (added by frequency rank) ---

{
  infinitive: "estar",
  meaning: "to be (location, state, condition)",
  category: "conjugation-pattern",
  forms: buildForms(túForms("estás", "está"), vosForms("estás", "está")),
},

{
  infinitive: "haber",
  meaning: "to have (auxiliary); there is/are",
  category: "conjugation-pattern",
  forms: buildForms(túForms("has", "he"), vosForms("habés", "habé")),
},

{
  infinitive: "ver",
  meaning: "to see",
  category: "conjugation-pattern",
  forms: buildForms(túForms("ves", "ve"), vosForms("ves", "ve")),
},

{
  infinitive: "pasar",
  meaning: "to pass, to happen",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pasas", "pasa"), vosForms("pasás", "pasá")),
},

{
  infinitive: "parecer",
  meaning: "to seem, to appear",
  category: "conjugation-pattern",
  forms: buildForms(túForms("pareces", "parece"), vosForms("parecés", "parecé")),
},

{
  infinitive: "quedar",
  meaning: "to remain, to stay, to agree to meet",
  category: "conjugation-pattern",
  forms: buildForms(túForms("quedas", "queda"), vosForms("quedás", "quedá")),
},

{
  infinitive: "creer",
  meaning: "to believe, to think",
  category: "conjugation-pattern",
  forms: buildForms(túForms("crees", "cree"), vosForms("creés", "creé")),
},

{
  infinitive: "llevar",
  meaning: "to carry, to wear, to take",
  category: "conjugation-pattern",
  forms: buildForms(túForms("llevas", "lleva"), vosForms("llevás", "llevá")),
},

{
  infinitive: "encontrar",
  meaning: "to find, to encounter",
  category: "conjugation-pattern",
  forms: buildForms(túForms("encuentras", "encuentra"), vosForms("encontrás", "encontrá")),
},

{
  infinitive: "contar",
  meaning: "to count, to tell/narrate",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cuentas", "cuenta"), vosForms("contás", "contá")),
},

{
  infinitive: "conocer",
  meaning: "to know (a person/place), to be acquainted with",
  category: "conjugation-pattern",
  forms: buildForms(túForms("conoces", "conoce"), vosForms("conocés", "conocé")),
},

{
  infinitive: "llamar",
  meaning: "to call, to name",
  category: "conjugation-pattern",
  forms: buildForms(túForms("llamas", "llama"), vosForms("llamás", "llamá")),
},

{
  infinitive: "deber",
  meaning: "to must, to should, to owe",
  category: "conjugation-pattern",
  forms: buildForms(túForms("debes", "debe"), vosForms("debés", "debé")),
},

{
  infinitive: "comenzar",
  meaning: "to begin, to start",
  category: "conjugation-pattern",
  forms: buildForms(túForms("comienzas", "comienza"), vosForms("comenzás", "comenzá")),
},

{
  infinitive: "esperar",
  meaning: "to wait, to hope, to expect",
  category: "conjugation-pattern",
  forms: buildForms(túForms("esperas", "espera"), vosForms("esperás", "esperá")),
},

{
  infinitive: "tomar",
  meaning: "to take, to drink",
  category: "conjugation-pattern",
  forms: buildForms(túForms("tomas", "toma"), vosForms("tomás", "tomá")),
},

{
  infinitive: "partir",
  meaning: "to leave, to split, to depart",
  category: "conjugation-pattern",
  forms: buildForms(túForms("partes", "parte"), vosForms("partís", "partí")),
},

{
  infinitive: "valer",
  meaning: "to be worth, to be valid",
  category: "conjugation-pattern",
  forms: buildForms(túForms("vales", "vale"), vosForms("valés", "valé")),
},

{
  infinitive: "obtener",
  meaning: "to obtain, to get",
  category: "conjugation-pattern",
  forms: buildForms(túForms("obtienes", "obtiene"), vosForms("obtenés", "obtené")),
},

{
  infinitive: "aparecer",
  meaning: "to appear, to show up",
  category: "conjugation-pattern",
  forms: buildForms(túForms("apareces", "aparece"), vosForms("aparecés", "aparecé")),
},

{
  infinitive: "mover",
  meaning: "to move, to shift",
  category: "conjugation-pattern",
  forms: buildForms(túForms("mueves", "mueve"), vosForms("movés", "mové")),
},

{
  infinitive: "utilizar",
  meaning: "to use, to utilize",
  category: "conjugation-pattern",
  forms: buildForms(túForms("utilizas", "utiliza"), vosForms("utilizás", "utilizá")),
},

{
  infinitive: "ganar",
  meaning: "to win, to earn",
  category: "conjugation-pattern",
  forms: buildForms(túForms("ganas", "gana"), vosForms("ganás", "ganá")),
},

{
  infinitive: "interesar",
  meaning: "to interest, to matter",
  category: "conjugation-pattern",
  forms: buildForms(túForms("interesas", "interesa"), vosForms("interesanás", "interesá")),
},

{
  infinitive: "comprender",
  meaning: "to understand, to comprehend",
  category: "conjugation-pattern",
  forms: buildForms(túForms("comprendes", "comprende"), vosForms("comprendés", "comprendé")),
},

{
  infinitive: "influir",
  meaning: "to influence",
  category: "conjugation-pattern",
  forms: buildForms(túForms("influyes", "influye"), vosForms("influís", "influí")),
},

{
  infinitive: "causar",
  meaning: "to cause, to bring about",
  category: "conjugation-pattern",
  forms: buildForms(túForms("causas", "causa"), vosForms("causás", "causá")),
},

{
  infinitive: "aconsejar",
  meaning: "to advise, to counsel",
  category: "conjugation-pattern",
  forms: buildForms(túForms("aconsejas", "aconseja"), vosForms("aconsejás", "aconsejá")),
},

{
  infinitive: "reunir",
  meaning: "to gather, to meet, to assemble",
  category: "conjugation-pattern",
  forms: buildForms(túForms("reúnes", "reúne"), vosForms("reunís", "reuní")),
},

{
  infinitive: "cubrir",
  meaning: "to cover",
  category: "conjugation-pattern",
  forms: buildForms(túForms("cubres", "cubre"), vosForms("cubrís", "cubrí")),
},

{
  infinitive: "caer",
  meaning: "to fall, to drop",
  category: "conjugation-pattern",
  forms: buildForms(túForms("caes", "cae"), vosForms("caés", "caé")),
},

];
