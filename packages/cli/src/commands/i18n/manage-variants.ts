/**
 * i18n manage-variants command handler
 * Creates dialect-specific variants of locale files
 *
 * Adaptation rules cover 200+ everyday vocabulary differences across
 * all 25 Spanish dialects: technology, transport, food, household,
 * clothing, and regional slang.
 */

import type { SpanishDialect, I18nEntry, VariantResult } from "@dialectos/types";
import { ALL_SPANISH_DIALECTS } from "@dialectos/types";
import { readLocaleFile, writeLocaleFile } from "@dialectos/locale-utils";
import { validateFilePath } from "@dialectos/security";
import { applyLexicalSubstitution } from "@dialectos/providers";

/**
 * Options for the manage-variants command
 */
export interface ManageVariantsOptions {
  /** Path to source locale file (e.g., es-ES.json) */
  source: string;
  /** Target dialect variant (e.g., es-MX, es-AR) */
  variant: SpanishDialect;
  /** Path to output locale file */
  output: string;
}

// ============================================================================
// Core vocabulary differences by semantic category
// ============================================================================

/** 2nd person plural: Spain uses vosotros; Americas use ustedes */
const VOSOTROS_ADAPTATION = [
  { from: /\bvosotr[oa]s\b/gi, to: "ustedes", description: "2nd person plural pronoun" },
  { from: /\bvuestr[oa]s\b/gi, to: "sus", description: "2nd person plural possessive" },
  { from: /\bvuestr[oa]\b/gi, to: "su", description: "2nd person plural possessive" },
];

/** Technology & devices */
const TECH_ADAPTATIONS: Record<SpanishDialect, Array<{ from: RegExp; to: string; description: string }>> = {
  "es-ES": [],
  "es-MX": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bfrigorífico\b/gi, to: "refrigerador", description: "refrigerator" },
    { from: /\bfrigoríficos\b/gi, to: "refrigeradores", description: "refrigerator" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bjudía\b/gi, to: "frijol", description: "bean" },
    { from: /\bjudías\b/gi, to: "frijoles", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "cacahuate$1", description: "peanut" },
    { from: /\bmaletero\b/gi, to: "cajuela", description: "trunk" },
    { from: /\bmaleteros\b/gi, to: "cajuelas", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
    { from: /\bconducimos\b/gi, to: "manejamos", description: "drive (1st person pl)" },
    { from: /\bconducido\b/gi, to: "manejado", description: "driven" },
  ],
  "es-AR": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "departamento$1", description: "apartment" },
    { from: /\bfrigorífico(s)?\b/gi, to: "heladera$1", description: "refrigerator" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía\b/gi, to: "poroto", description: "bean" },
    { from: /\bjudías\b/gi, to: "porotos", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bmaletero\b/gi, to: "baúl", description: "trunk" },
    { from: /\bmaleteros\b/gi, to: "baúles", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
    { from: /\bconducimos\b/gi, to: "manejamos", description: "drive (1st person pl)" },
    { from: /\bconducido\b/gi, to: "manejado", description: "driven" },
  ],
  "es-CO": [
    { from: /\bordenador\b/gi, to: "computador", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadores", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía\b/gi, to: "frijol", description: "bean" },
    { from: /\bjudías\b/gi, to: "frijoles", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bplátano\b/gi, to: "banano", description: "banana" },
    { from: /\bmaletero\b/gi, to: "maletero", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
  ],
  "es-CU": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús\b/gi, to: "guagua", description: "bus" },
    { from: /\bautobuses\b/gi, to: "guaguas", description: "bus" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
  ],
  "es-PE": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
  ],
  "es-CL": [
    { from: /\bordenador\b/gi, to: "computador", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadores", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\baguacate(s)?\b/gi, to: "palta$1", description: "avocado" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bcamiseta(s)?\b/gi, to: "polera$1", description: "t-shirt" },
    { from: /\bmaletero\b/gi, to: "maletero", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
    { from: /\bconducimos\b/gi, to: "manejamos", description: "drive (1st person pl)" },
  ],
  "es-VE": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "lapicero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "caraota$1", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bcamiseta(s)?\b/gi, to: "franela$1", description: "t-shirt" },
    { from: /\bmaletero\b/gi, to: "maletero", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
  ],
  "es-UY": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bfrigorífico(s)?\b/gi, to: "heladera$1", description: "refrigerator" },
  ],
  "es-PY": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
  ],
  "es-BO": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-EC": [
    { from: /\bordenador(es)?\b/gi, to: "computador$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía\b/gi, to: "frejol", description: "bean" },
    { from: /\bjudías\b/gi, to: "frejoles", description: "bean" },
    { from: /\bcacahuete\b/gi, to: "maní", description: "peanut" },
    { from: /\bcacahuetes\b/gi, to: "maníes", description: "peanut" },
    { from: /\bplátano\b/gi, to: "banano", description: "banana" },
  ],
  "es-GT": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-HN": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-SV": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-NI": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-CR": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-PA": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "lapicero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-DO": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús\b/gi, to: "guagua", description: "bus" },
    { from: /\bautobuses\b/gi, to: "guaguas", description: "bus" },
    { from: /\bgafas\b/gi, to: "espejuelos", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
  ],
  "es-PR": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús\b/gi, to: "guagua", description: "bus" },
    { from: /\bautobuses\b/gi, to: "guaguas", description: "bus" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
    { from: /\bmaletero\b/gi, to: "maletero", description: "trunk" },
    { from: /\bconducir\b/gi, to: "manejar", description: "drive" },
    { from: /\bconduzco\b/gi, to: "manejo", description: "drive (1st person)" },
    { from: /\bconduce\b/gi, to: "maneja", description: "drive (3rd person)" },
    { from: /\bconducen\b/gi, to: "manejan", description: "drive (3rd person pl)" },
  ],
  "es-GQ": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-US": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-PH": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-BZ": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-AD": [
    { from: /\bordenador\b/gi, to: "computadora", description: "computer" },
    { from: /\bordenadores\b/gi, to: "computadoras", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
};

/**
 * Assemble complete adaptation list for each dialect
 * = vosotros rules + tech rules + any dialect-specific extras
 */
const DIALECT_ADAPTATIONS: Record<
  SpanishDialect,
  Array<{ from: RegExp; to: string; description: string }>
> = {
  "es-ES": [],
  "es-MX": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-MX"]],
  "es-AR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-AR"]],
  "es-CO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CO"]],
  "es-CU": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CU"]],
  "es-PE": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PE"]],
  "es-CL": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CL"]],
  "es-VE": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-VE"]],
  "es-UY": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-UY"]],
  "es-PY": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PY"]],
  "es-BO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-BO"]],
  "es-EC": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-EC"]],
  "es-GT": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-GT"]],
  "es-HN": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-HN"]],
  "es-SV": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-SV"]],
  "es-NI": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-NI"]],
  "es-CR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CR"]],
  "es-PA": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PA"]],
  "es-DO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-DO"]],
  "es-PR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PR"]],
  "es-GQ": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-GQ"]],
  "es-US": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-US"]],
  "es-PH": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PH"]],
  "es-BZ": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-BZ"]],
  "es-AD": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-AD"]],
};

/**
 * Validate dialect code
 */
function validateDialect(dialect: string): SpanishDialect {
  if (!ALL_SPANISH_DIALECTS.includes(dialect as SpanishDialect)) {
    throw new Error(
      `Invalid dialect: ${dialect}. Valid dialects are: ${ALL_SPANISH_DIALECTS.join(", ")}`
    );
  }
  return dialect as SpanishDialect;
}

/**
 * Apply dialect-specific adaptations to a single value
 */
function applyAdaptations(value: string, variant: SpanishDialect): string {
  const adaptations = DIALECT_ADAPTATIONS[variant];
  if (!adaptations || adaptations.length === 0) {
    return value; // No adaptations for this dialect
  }

  let adapted = value;
  for (const { from, to } of adaptations) {
    adapted = adapted.replace(from, to);
  }
  return adapted;
}

/**
 * Execute the manage-variants command
 */
export async function executeManageVariants(
  options: ManageVariantsOptions
): Promise<VariantResult> {
  // Validate dialect
  const variant = validateDialect(options.variant);

  // Validate and read source file
  const validatedSourcePath = validateFilePath(options.source);
  const entries = readLocaleFile(validatedSourcePath);

  // Apply dialect adaptations
  const adaptedEntries: I18nEntry[] = [];
  const changes: string[] = [];

  for (const entry of entries) {
    const originalValue = entry.value;
    // The shared engine swaps vocabulary with article and plural agreement
    // ("el ordenador" -> "la computadora"); the table then handles what the
    // engine does not cover, such as vosotros -> ustedes.
    const adaptedValue = variant === "es-ES"
      ? originalValue
      : applyAdaptations(applyLexicalSubstitution(originalValue, variant), variant);

    if (adaptedValue !== originalValue) {
      changes.push(`${entry.key}: "${originalValue}" → "${adaptedValue}"`);
    }

    adaptedEntries.push({
      key: entry.key,
      value: adaptedValue,
    });
  }

  // Write adapted locale to output file
  writeLocaleFile(options.output, adaptedEntries);

  return {
    adapted: changes.length > 0,
    changes,
  };
}
