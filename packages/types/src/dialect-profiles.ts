import type { SpanishDialect } from "./index.js";

export type VoseoType = "none" | "regional" | "informal" | "common" | "dominant";

export interface DialectSourceRef {
  label: string;
  url: string;
}

export interface DialectGrammarProfile {
  code: SpanishDialect;
  pluralAddress: string;
  voseo: {
    type: VoseoType;
    notes: string[];
  };
  leismoLaismoLoismoNotes: string[];
  formalityNorms: string[];
  tabooAndAmbiguityNotes: string[];
  semanticPromptGuidance: string[];
  sourceRefs: DialectSourceRef[];
}

const RAE_VOSEO = {
  label: "RAE/ASALE Nueva gramática: variantes del voseo",
  url: "https://www.rae.es/gram%C3%A1tica/morfolog%C3%ADa/la-conjugaci%C3%B3n-regular-ii-las-variantes-del-voseo",
};
const RAE_LEISMO = {
  label: "RAE/ASALE: leísmo, laísmo y loísmo",
  url: "https://www.rae.es/buen-uso-espa%C3%B1ol/le%C3%ADsmo-la%C3%ADsmo-y-lo%C3%ADsmo",
};
const DPD = {
  label: "RAE/ASALE Diccionario panhispánico de dudas",
  url: "https://www.asale.org/obras-academicas/diccionarios/diccionario-panhispanico-de-dudas-0",
};
const DLE = {
  label: "ASALE Diccionario de americanismos",
  url: "https://www.asale.org/damer/",
};
const NGLE = {
  label: "RAE/ASALE Nueva gramática de la lengua española",
  url: "https://www.rae.es/gram%C3%A1tica/",
};

function profile(
  code: SpanishDialect,
  partial: Omit<DialectGrammarProfile, "code" | "sourceRefs"> & { sourceRefs?: DialectSourceRef[] }
): DialectGrammarProfile {
  return {
    code,
    ...partial,
    sourceRefs: partial.sourceRefs || [DPD, RAE_VOSEO, RAE_LEISMO],
  };
}

const AMERICA_PRONOUN_NOTE = "Use ustedes for all second-person plural contexts; do not generate vosotros forms unless quoting Spain-specific content.";
const DEFAULT_CLITIC_NOTE = "Prefer standard lo/la/le clitic distinctions in neutral formal output; avoid introducing leísmo, laísmo, or loísmo unless the source explicitly requires it.";
const DEFAULT_FORMALITY = [
  "Use tú/vos only for clearly informal copy; use usted for formal support, legal, business, or public-service text.",
  "When register is ambiguous, prefer a respectful neutral tone rather than slang-heavy localization.",
];

export const DIALECT_GRAMMAR_PROFILES: DialectGrammarProfile[] = [
  profile("es-ES", {
    pluralAddress: "Use vosotros/vosotras for informal plural in most Peninsular contexts; use ustedes for formal plural or Canary/Andalusian-influenced contexts.",
    voseo: { type: "none", notes: ["Do not use American voseo for Spain-oriented output.", "Use tú for singular informal address."] },
    leismoLaismoLoismoNotes: ["Limited person-masculine leísmo is accepted in parts of central/northern Spain, but avoid laísmo/loísmo in educated neutral output.", "Default to standard lo/la/le unless a regional Peninsular style is explicitly requested."],
    formalityNorms: ["Use tú/vosotros for informal product copy.", "Use usted/ustedes for formal, legal, medical, or public-administration copy."],
    tabooAndAmbiguityNotes: ["coger is neutral in Spain; do not over-avoid it for Peninsular output.", "Avoid American slang such as güey, parce, boludo, or chévere unless quoting."],
    semanticPromptGuidance: ["Preserve Peninsular address contrast between tú/vosotros and usted/ustedes.", "Prefer idiomatic Spain vocabulary such as ordenador, móvil, coche, vale only where natural.", "Keep formal documentation precise and not slangy.", "Do not Latin-Americanize grammar or plural address."],
  }),
  profile("es-MX", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["Mainstream Mexican Spanish is tuteante; do not use vos/voseo in standard Mexican output.", "Use tú for informal singular and usted for formal or respectful singular."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Do not introduce Spain-style leísmo as a dialect feature."],
    formalityNorms: ["Use usted in formal customer support, public service, and business flows.", "Use tú for consumer UI when the brand voice is casual."],
    tabooAndAmbiguityNotes: ["coger is often sexual/vulgar in Mexico; prefer tomar, agarrar, recoger, or elegir according to meaning.", "madre/padre expressions are highly context-sensitive; avoid slang unless the audience and register are explicit."],
    semanticPromptGuidance: ["Use Mexican vocabulary naturally, not just literal replacements.", "Avoid vos and vosotros entirely in generated copy.", "Resolve ambiguous coger based on intent rather than translating it literally.", "Keep business/support tone warm but respectful."],
  }),
  profile("es-AR", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "dominant", notes: ["Use pronominal and verbal voseo for informal Argentine/Rioplatense copy: vos tenés, vos podés, vos querés.", "Use tú only when source/audience explicitly requires non-Rioplatense neutrality."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Do not import Peninsular leísmo into neutral Argentine output."],
    formalityNorms: ["Use vos for informal/product copy.", "Use usted for formal institutional, legal, medical, or high-stakes support text."],
    tabooAndAmbiguityNotes: ["boludo can be friendly or insulting depending on relationship; avoid in formal or unknown-audience output.", "Concha and coger are vulgar/sexual in Argentina; disambiguate intent before rendering."],
    semanticPromptGuidance: ["For informal Argentine output, preserve voseo morphology naturally.", "Use ustedes for plural address.", "Avoid overusing che/boludo unless clearly casual and safe.", "Favor Rioplatense idiom while preserving source intent."],
  }),
  profile("es-CO", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Voseo is regional, especially in areas such as Antioquia/Valle; do not use it as the default for national Colombian copy.", "Tú and usted coexist; usted is frequent beyond strictly formal contexts."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Avoid leísmo/laísmo/loísmo as generated dialect markers."],
    formalityNorms: ["Use usted for respectful support/business copy unless a youthful casual voice is requested.", "Use tú for broadly neutral consumer copy; reserve vos for explicitly regional/Paisa/Vallecaucano flavor."],
    tabooAndAmbiguityNotes: ["marica/parce can be friendly or offensive depending on region and relationship; avoid in formal/unknown-audience text.", "coger can be acceptable in some senses but prefer tomar/agarrar/recoger when ambiguity is possible."],
    semanticPromptGuidance: ["Default to nationally intelligible Colombian Spanish, not heavy slang.", "Respect the tú/usted distinction; do not force voseo unless regional intent is explicit.", "Use Colombian vocabulary like computador/carro/esfero when natural.", "Avoid slang terms that may be insulting without context."],
  }),
  profile("es-CU", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["Cuban Spanish is tuteante in ordinary informal singular address.", "Do not generate voseo for Cuban output."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Use standard clitics for formal written output."],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["asere/socio are colloquial and relationship-dependent; avoid in professional output.", "yuma and socio can carry social nuance; do not literalize without context."],
    semanticPromptGuidance: ["Use Caribbean/Cuban flavor only when the register permits it.", "Keep technical/support copy clear and neutral.", "Use ustedes for plural address.", "Avoid voseo and Peninsular vosotros."],
  }),
  profile("es-PE", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Peruvian Spanish is tuteante in most national contexts; voseo appears sporadically in border/northern/southern areas.", "Do not default to voseo for national Peruvian output."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Avoid making clitic deviations a Peruvian style marker."],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["pata/causa are colloquial; avoid in formal copy.", "cholo can be identity, affectionate, or offensive depending on context; avoid unless source clearly intends it."],
    semanticPromptGuidance: ["Default to neutral Peruvian Spanish with ustedes plural.", "Do not force slang like causa/pata into formal text.", "Use regional vocabulary only where it preserves audience fit.", "Preserve technical meaning over lexical flavor."],
  }),
  profile("es-CL", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "informal", notes: ["Chilean voseo is highly informal and often mixed with tú; use only for explicitly casual Chilean voice.", "For neutral/formal output use tú/usted, not heavy voseo."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Do not introduce Peninsular clitic patterns."],
    formalityNorms: ["Use usted for formal/service contexts.", "Use tú for neutral informal; use voseo/po/cachái only in clearly colloquial copy."],
    tabooAndAmbiguityNotes: ["weón/wea can be friendly or offensive; avoid outside intentionally colloquial content.", "coger is not the safest general choice; prefer tomar/agarrar/recoger by meaning."],
    semanticPromptGuidance: ["Keep Chilean output comprehensible; do not overload with slang.", "Use cachái/po/weón only when the requested register is very informal.", "Use ustedes for plural address.", "Preserve formal clarity in support/legal/technical text."],
  }),
  profile("es-VE", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Voseo is regional, notably in western/Zulia usage; do not use as national default.", "Default to tú/usted unless a regional western Venezuelan voice is requested."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["arrecho can mean angry, difficult, or impressive depending on context; avoid in formal copy.", "marico/marica can be offensive; avoid unless clearly quoted/colloquial."],
    semanticPromptGuidance: ["Use Venezuelan vocabulary naturally but keep formal content neutral.", "Do not default to voseo nationally.", "Use ustedes plural.", "Disambiguate emotionally loaded slang before rendering."],
  }),
  profile("es-UY", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "dominant", notes: ["Uruguayan/Rioplatense informal address commonly uses vos with voseo morphology.", "Use tú only for pan-regional neutrality or explicit source constraints."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use vos for informal local voice.", "Use usted in formal business, government, legal, or medical copy."],
    tabooAndAmbiguityNotes: ["bo/ta are colloquial markers; avoid in formal output.", "boludo can be friendly or insulting; avoid unless context is safe."],
    semanticPromptGuidance: ["Use natural Uruguayan/Rioplatense voseo for informal audience fit.", "Use ustedes for plural address.", "Keep formal text neutral and precise.", "Do not overstuff copy with bo/ta slang."],
  }),
  profile("es-PY", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "common", notes: ["Paraguayan Spanish commonly uses vos in informal contexts, alongside influence from Guaraní/Jopara.", "Use usted for formal/respectful contexts."] },
    leismoLaismoLoismoNotes: ["RAE notes Paraguayan le usage can be influenced by Guaraní; for broad formal output still preserve standard lo/la/le distinctions.", "Do not introduce nonstandard clitics unless representing local speech intentionally."],
    formalityNorms: ["Use vos for informal local voice; use usted for formal and respectful contexts.", "Avoid Jopara-heavy phrasing unless explicitly requested."],
    tabooAndAmbiguityNotes: ["al pedo and similar expressions are colloquial/vulgar; avoid in formal copy.", "Guaraní/Jopara insertions require audience certainty."],
    semanticPromptGuidance: ["Allow vos for informal Paraguayan voice, but keep formal text standard.", "Use ustedes plural.", "Avoid unrequested Guaraní/Jopara mixing.", "Preserve standard clitic usage in formal documentation."],
  }),
  profile("es-BO", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Bolivian Spanish has regional voseo, but national neutral output should not assume it.", "Use tú/usted unless a voseante region/register is requested."] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["cholo/cholita can be identity or sensitive; handle respectfully.", "Regional indigenous-language terms should not be inserted without audience context."],
    semanticPromptGuidance: ["Default to clear Bolivian Spanish with respectful tone.", "Do not force voseo or indigenous-language markers.", "Use ustedes plural.", "Treat identity terms carefully."],
  }),
  profile("es-EC", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Ecuadorian Spanish is broadly tuteante/ustedeante; voseo can occur regionally but is not the national default.", "Use tú/usted for general output." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["chucha and related terms can be vulgar; avoid in formal copy.", "longo can be sensitive/offensive; avoid unless source intent is clear."],
    semanticPromptGuidance: ["Use neutral Ecuadorian vocabulary and respectful tone.", "Avoid regional slang unless register is explicit.", "Use ustedes plural.", "Do not default to voseo."],
  }),
  profile("es-GT", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "common", notes: ["Guatemalan Spanish commonly uses vos in informal/familiar contexts, often alongside tú and usted.", "Use usted for formal or respectful address." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use vos only when an informal local voice is intended.", "Use usted for public-facing, formal, or respectful support copy."],
    tabooAndAmbiguityNotes: ["cerote/culero can be offensive; avoid unless quoted or explicitly requested.", "pisto is colloquial for money; avoid in formal financial copy unless audience fit is explicit."],
    semanticPromptGuidance: ["Use vos for informal Guatemalan voice when appropriate.", "Use usted for respectful/formal contexts.", "Use ustedes plural.", "Avoid strong slang in broad-audience copy."],
  }),
  profile("es-HN", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "common", notes: ["Honduran Spanish commonly permits vos in informal contexts.", "Use usted for formal/respectful contexts." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["maje can be friendly or insulting; avoid in formal or unknown-audience output.", "Regional slang should be used sparingly and intentionally."],
    semanticPromptGuidance: ["Use vos only for informal Honduran audience fit.", "Use usted for formal support/business copy.", "Use ustedes plural.", "Keep technical text neutral and clear."],
  }),
  profile("es-SV", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "dominant", notes: ["Salvadoran Spanish strongly uses vos in informal/familiar contexts.", "Use usted for formal, respectful, and many service contexts." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use vos for informal local voice.", "Use usted for formal/support/legal copy."],
    tabooAndAmbiguityNotes: ["cerote/maje can be offensive; avoid unless clearly colloquial and safe.", "bicho is regional but can be informal; avoid in formal child/user references."],
    semanticPromptGuidance: ["Use Salvadoran voseo for informal copy when appropriate.", "Use usted for respectful and formal contexts.", "Use ustedes plural.", "Avoid strong slang in broad public copy."],
  }),
  profile("es-NI", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "dominant", notes: ["Nicaraguan Spanish commonly uses vos in informal contexts.", "Use usted for formal or respectful address." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["maje and related slang can be insulting; avoid in formal copy.", "Regional slang requires clear audience fit."],
    semanticPromptGuidance: ["Use vos for informal Nicaraguan voice when requested.", "Use usted for formal/support text.", "Use ustedes plural.", "Keep technical text neutral and not slang-heavy."],
  }),
  profile("es-CR", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "common", notes: ["Costa Rican Spanish uses usted very broadly and vos in many informal contexts; tú is less central.", "Do not over-tutear Costa Rican output." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Usted is common even beyond highly formal contexts; it is safe for support and product UI.", "Vos can signal informal/local familiarity; use only when the requested voice is casual."],
    tabooAndAmbiguityNotes: ["mae is colloquial; avoid in formal copy.", "pura vida is iconic but can sound forced in serious contexts."],
    semanticPromptGuidance: ["Prefer usted for respectful Costa Rican UX/support copy.", "Use vos only for explicitly informal/local voice.", "Use ustedes plural.", "Avoid forced pura vida/mae branding unless requested."],
  }),
  profile("es-PA", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["Panamanian national output should default to tú/usted, not voseo.", "Use ustedes for plural address." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["cueco/chombo and related terms can be sensitive or offensive; avoid unless source intent is explicit.", "yeyé is social-label slang; avoid in neutral product copy."],
    semanticPromptGuidance: ["Use neutral Panamanian Spanish with tú/usted as appropriate.", "Do not default to voseo.", "Use ustedes plural.", "Keep Caribbean/Central American slang restrained."],
  }),
  profile("es-DO", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["Dominican Spanish is tuteante; do not generate voseo.", "Use usted for formal and respectful contexts." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["tiguere/vaina are informal and context-sensitive; avoid in formal output.", "que lo que is very casual; do not use in broad professional copy."],
    semanticPromptGuidance: ["Use Dominican flavor only when casual register is explicit.", "Use tú/usted and ustedes; no voseo/vosotros.", "Keep support/legal/technical copy standard and clear.", "Avoid heavy phonetic or slang representation."],
  }),
  profile("es-PR", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["Puerto Rican Spanish is tuteante; do not generate voseo.", "Use usted for formal/respectful contexts." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: DEFAULT_FORMALITY,
    tabooAndAmbiguityNotes: ["cabrón can be friendly or highly offensive; avoid unless audience/context is explicit.", "Spanglish/English borrowings can be natural but should not be overinserted."],
    semanticPromptGuidance: ["Use Puerto Rican vocabulary naturally without caricature.", "Use tú/usted and ustedes; avoid vos/vosotros.", "Allow common tech/business English terms only where audience-appropriate.", "Avoid strong slang in formal copy."],
  }),
  profile("es-GQ", {
    pluralAddress: "Use neutral standard plural address; preserve vosotros only when a Peninsular-style context explicitly calls for it, otherwise ustedes is broadly intelligible.",
    voseo: { type: "none", notes: ["Do not use American voseo for Equatoguinean Spanish.", "Use tú/usted according to formality." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE, "Avoid importing central-Spain leísmo/laísmo as a dialect marker."],
    formalityNorms: ["Use formal neutral Spanish for public/institutional content.", "Use local lexical flavor sparingly and only when context supports it."],
    tabooAndAmbiguityNotes: ["Do not invent Africanisms or Chavacano-like forms.", "Use Equatoguinean place/culture terms only when sourced by the input."],
    semanticPromptGuidance: ["Use conservative standard Spanish with Equatoguinean awareness.", "Avoid American voseo and slang.", "Do not over-Peninsularize unless requested.", "Keep formal/institutional tone precise."],
  }),
  profile("es-US", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "none", notes: ["U.S. Spanish is heterogeneous but standard public copy should not default to voseo.", "Use tú/usted depending on audience and formality." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use clear, pan-Hispanic U.S. Spanish for public service and support.", "Allow common U.S. institutional terms and English proper nouns; avoid unnecessary Spanglish."],
    tabooAndAmbiguityNotes: ["Spanglish may be natural for some audiences but can alienate others; use only when requested.", "Avoid regional slang that privileges one heritage community unless targeted."],
    semanticPromptGuidance: ["Use accessible U.S. Spanish suitable for diverse heritage audiences.", "Preserve English proper nouns, agencies, product names, and legal terms where expected.", "Use ustedes plural; avoid vos/vosotros.", "Prefer clarity over localized slang."],
  }),
  profile("es-PH", {
    pluralAddress: "Use conservative standard Spanish address; use ustedes for plural address unless the source explicitly asks for Chavacano/historical Philippine flavor.",
    voseo: { type: "none", notes: ["Do not use American voseo for Philippine Spanish.", "Avoid inventing Chavacano forms in ordinary Spanish translation." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use formal neutral Spanish for institutional/historical content.", "Only introduce Chavacano-like signals when explicitly requested and source-supported."],
    tabooAndAmbiguityNotes: ["Philippine Spanish/Chavacano identity is sensitive; do not fabricate creole forms.", "Spanish is not a general everyday national language; avoid overlocalizing assumptions."],
    semanticPromptGuidance: ["Use conservative, intelligible Spanish unless Chavacano is explicitly requested.", "Do not default to Latin American slang or voseo.", "Preserve Philippine names and cultural terms.", "Keep technical/support text neutral."],
  }),
  profile("es-BZ", {
    pluralAddress: AMERICA_PRONOUN_NOTE,
    voseo: { type: "regional", notes: ["Belizean Spanish sits in contact with Central American and Caribbean varieties; do not assume voseo unless audience/register supports it.", "Use tú/usted for general output." ] },
    leismoLaismoLoismoNotes: [DEFAULT_CLITIC_NOTE],
    formalityNorms: ["Use clear neutral Spanish for public/service content.", "Do not overmix Kriol/English unless explicitly requested."],
    tabooAndAmbiguityNotes: ["Kriol/English code-switching may be natural for some audiences but should not be fabricated.", "Ethnonyms and identity terms require respectful context."],
    semanticPromptGuidance: ["Use Belize-aware neutral Spanish with Central American/Caribbean sensitivity.", "Use ustedes plural.", "Avoid unrequested Kriol/English mixing.", "Use regional vocabulary sparingly and only when meaning is clear."],
  }),
  profile("es-AD", {
    pluralAddress: "Use Peninsular-style tú/vosotros for informal Spanish in Andorran contexts; use usted/ustedes for formal address.",
    voseo: { type: "none", notes: ["Do not use American voseo for Andorran Spanish.", "Catalan contact may affect local context, but generated Spanish should remain grammatical Spanish." ] },
    leismoLaismoLoismoNotes: ["Avoid leísmo/laísmo/loísmo unless representing a specific Peninsular speaker style.", "Default to standard lo/la/le in formal copy."],
    formalityNorms: ["Use tú/vosotros for informal local/Spain-adjacent content.", "Use usted/ustedes for institutional, legal, tourism, and official copy."],
    tabooAndAmbiguityNotes: ["Do not insert Catalan words unless source/context requires them.", "Avoid Latin American vocabulary defaults for Andorran audience."],
    semanticPromptGuidance: ["Use Spain-adjacent grammar and plural address for Andorran Spanish.", "Respect Catalan names/institutions without code-mixing unnecessarily.", "Avoid American voseo/slang.", "Keep tourism/institutional copy polished and formal where appropriate."],
  }),
];

export function getDialectGrammarProfile(code: SpanishDialect): DialectGrammarProfile | undefined {
  return DIALECT_GRAMMAR_PROFILES.find((profile) => profile.code === code);
}
