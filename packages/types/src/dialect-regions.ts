import type { SpanishDialect } from "./index.js";

// ============================================================================
// Dialect Region Definitions
// ============================================================================
//
// Single source of truth for all regional groupings used across DialectOS.
// Each region is named, documented with its linguistic basis, and validated
// by tests that verify completeness, non-overlap, and coverage of all 25 dialects.
//
// Sources:
//   - ASALE (Asociación de Academias de la Lengua Española)
//   - Moreno Fernández, J. (2009) "Las variedades de la lengua española"
//   - Lipski, J.M. (1994) "Latin American Spanish"
//   - Canfield, D.L. (1981) "Spanish Pronunciation in the Americas"
// ============================================================================

export interface DialectRegion {
  id: string;
  name: string;
  dialects: readonly SpanishDialect[];
  /** Linguistic features that justify grouping these dialects together */
  basis: string;
}

// --- Primary regions (each dialect belongs to exactly one) ---

export const DIALECT_REGIONS = {
  peninsular: {
    id: "peninsular",
    name: "Peninsular Spanish",
    dialects: ["es-ES", "es-AD"],
    basis: "vosotros for informal plural, pretérito perfecto compuesto for recent past, accepted leísmo, aparcamiento/coche/ordenador/móvil lexical set",
  } satisfies DialectRegion,

  mexican: {
    id: "mexican",
    name: "Mexican Spanish",
    dialects: ["es-MX"],
    basis: "Largest standalone variety; carro/camión/computadora lexical set; tú only (no voseo); distinctive intonation",
  } satisfies DialectRegion,

  caribbean: {
    id: "caribbean",
    name: "Caribbean Spanish",
    dialects: ["es-CU", "es-DO", "es-PR"],
    basis: "Greater Antilles: s-aspiration, yeísmo, /d/ weakening, guagua/zafacón/parqueo lexical set, heavy English contact (PR, DO)",
  } satisfies DialectRegion,

  centralAmerica: {
    id: "centralAmerica",
    name: "Central American Spanish",
    dialects: ["es-GT", "es-HN", "es-SV", "es-NI", "es-CR", "es-PA"],
    basis: "Shared voseo (CR partial), gasolinería/boleto lexical set, Central American isthmus features, English contact in PA (Canal Zone)",
  } satisfies DialectRegion,

  rioplatense: {
    id: "rioplatense",
    name: "Rioplatense Spanish",
    dialects: ["es-AR", "es-UY", "es-PY"],
    basis: "Full voseo with distinctive intonation contour, auto/heladera/colectivo/frazada lexical set, SHE merging (yeísmo rehilado)",
  } satisfies DialectRegion,

  andean: {
    id: "andean",
    name: "Andean Spanish",
    dialects: ["es-PE", "es-BO", "es-EC"],
    basis: "Quechua/Aymara substrate influence, choclo/computador lexical set, revaluation of vowel distinctions,高地 s-aspiration (variable)",
  } satisfies DialectRegion,

  chilean: {
    id: "chilean",
    name: "Chilean Spanish",
    dialects: ["es-CL"],
    basis: "Isolated southern cone variety: palta/computador/polera lexical set, partial voseo (informal only), distinctive /x/ and /tʃ/ realizations",
  } satisfies DialectRegion,

  northernSouthAmerica: {
    id: "northernSouthAmerica",
    name: "Northern South American Spanish",
    dialects: ["es-CO", "es-VE"],
    basis: "Shared lexical norms (tiquete/acelerador), partial voseo in informal registers, Caribbean-influenced coastal varieties vs. interior norms",
  } satisfies DialectRegion,

  usLatino: {
    id: "usLatino",
    name: "US Spanish",
    dialects: ["es-US"],
    basis: "Contact variety with English across Mexican-American, Puerto Rican, and Cuban communities; parquear/troca/lonche/chequear contact phenomena",
  } satisfies DialectRegion,

  heritage: {
    id: "heritage",
    name: "Heritage/Contact dialects",
    dialects: ["es-GQ", "es-PH", "es-BZ"],
    basis: "Small speaker populations with heavy contact from other languages (French/indigenous in GQ, English/Tagalog in PH, English in BZ); limited dialect-specific data",
  } satisfies DialectRegion,
} as const;

// --- Derived lists (computed from regions, never hardcoded) ---

/** All Latin American + heritage dialects (everything except es-ES and es-AD) */
export const ALL_AMERICAN_DIALECTS: readonly SpanishDialect[] = [
  ...DIALECT_REGIONS.mexican.dialects,
  ...DIALECT_REGIONS.caribbean.dialects,
  ...DIALECT_REGIONS.centralAmerica.dialects,
  ...DIALECT_REGIONS.rioplatense.dialects,
  ...DIALECT_REGIONS.andean.dialects,
  ...DIALECT_REGIONS.chilean.dialects,
  ...DIALECT_REGIONS.northernSouthAmerica.dialects,
  ...DIALECT_REGIONS.usLatino.dialects,
  ...DIALECT_REGIONS.heritage.dialects,
];

/** Dialects where voseo is the standard informal register */
export const FULL_VOSEO_DIALECTS: readonly SpanishDialect[] = [
  ...DIALECT_REGIONS.rioplatense.dialects,  // AR, UY, PY
  "es-GT", "es-HN", "es-SV", "es-NI",  // Central America (excluding CR — see REGIONAL)
];

/** Dialects where voseo exists but tú is standard in formal writing */
export const REGIONAL_VOSEO_DIALECTS: readonly SpanishDialect[] = [
  "es-BO", "es-EC",  // Andean with informal voseo
  "es-CR",  // CR uses usted heavily; vos is common informal but not dominant
  ...DIALECT_REGIONS.northernSouthAmerica.dialects,  // CO, VE
  ...DIALECT_REGIONS.chilean.dialects,  // CL
];

/** Dialects that use tú exclusively (no voseo) */
export const TÚ_ONLY_DIALECTS: readonly SpanishDialect[] = [
  ...DIALECT_REGIONS.peninsular.dialects,  // ES, AD
  ...DIALECT_REGIONS.mexican.dialects,  // MX
  "es-PE",  // Andean (Peru uses tú)
  ...DIALECT_REGIONS.caribbean.dialects,  // CU, DO, PR
  "es-PA",  // Central America (PA uses tú)
  ...DIALECT_REGIONS.usLatino.dialects,  // US
  ...DIALECT_REGIONS.heritage.dialects,  // GQ, PH, BZ
];

/** Dialects where "coger" is taboo/vulgar (all American except GQ, PH, and BZ) */
export const COGER_TABOO_DIALECTS: readonly SpanishDialect[] = ALL_AMERICAN_DIALECTS.filter(
  d => d !== "es-GQ" && d !== "es-PH" && d !== "es-BZ",
);

/** Dialects with significant English contact phenomena in standard register */
export const CONTACT_PHENOMENA_DIALECTS: readonly SpanishDialect[] = [
  "es-DO", "es-PR",  // Caribbean (excluding CU — historical, not contemporary contact)
  "es-VE",  // chevere, chequear, etc.
  "es-PA",  // Canal Zone English contact
  ...DIALECT_REGIONS.usLatino.dialects,  // US
  "es-BZ",  // English is co-official
];

/** Dialects that use parquear (not aparcar/estacionar) for "to park" */
export const PARQUEAR_DIALECTS: readonly SpanishDialect[] = [
  ...DIALECT_REGIONS.caribbean.dialects,  // CU, DO, PR
  "es-CR",  // Costa Rican standard
  "es-PA",  // Panamanian standard
  "es-VE",  // Venezuelan standard informal
  ...DIALECT_REGIONS.usLatino.dialects,  // US
  "es-BZ",  // English co-official
];

// --- Helper functions ---

type RegionId = keyof typeof DIALECT_REGIONS;

/** Get all dialects belonging to one or more named regions */
export function getDialectsForRegions(regionIds: RegionId[]): SpanishDialect[] {
  const result: SpanishDialect[] = [];
  for (const id of regionIds) {
    const region = DIALECT_REGIONS[id];
    if (region) result.push(...region.dialects);
  }
  return result;
}

/** Check if a dialect belongs to a named region */
export function isDialectInRegion(dialect: SpanishDialect, regionId: RegionId): boolean {
  const region = DIALECT_REGIONS[regionId];
  return region ? (region.dialects as readonly string[]).includes(dialect) : false;
}

/** Check if a dialect belongs to a derived list */
export function isDialectInList(dialect: SpanishDialect, list: readonly SpanishDialect[]): boolean {
  return (list as readonly string[]).includes(dialect);
}

// --- Compile-time validation ---

const ALL_25_DIALECTS: readonly SpanishDialect[] = [
  "es-ES", "es-MX", "es-AR", "es-CO", "es-CU",
  "es-PE", "es-CL", "es-VE", "es-UY", "es-PY",
  "es-BO", "es-EC", "es-GT", "es-HN", "es-SV",
  "es-NI", "es-CR", "es-PA", "es-DO", "es-PR",
  "es-GQ", "es-US", "es-PH", "es-BZ", "es-AD",
];

const ALL_REGION_DIALECTS = Object.values(DIALECT_REGIONS).flatMap(r => r.dialects);
const uniqueRegionDialects = new Set(ALL_REGION_DIALECTS);

if (uniqueRegionDialects.size !== ALL_25_DIALECTS.length) {
  const missing = ALL_25_DIALECTS.filter(d => !uniqueRegionDialects.has(d));
  const extra = ALL_REGION_DIALECTS.filter(d => !ALL_25_DIALECTS.includes(d));
  throw new Error(
    `Dialect regions do not cover all 25 dialects exactly once.` +
    (missing.length ? ` Missing: ${missing.join(", ")}.` : "") +
    (extra.length ? ` Extra: ${extra.join(", ")}.` : ""),
  );
}
