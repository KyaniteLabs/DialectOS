import type { SpanishDialect } from "./index.js";

export type DialectMarketTier = "major" | "regional" | "heritage";
export type DialectEvidenceTier = "corpus-backed" | "reference-backed" | "draft";
export type DialectRiskLevel = "low" | "medium" | "high";
export type DialectConfidence = "low" | "medium" | "high";
export type SlangPolicy = "avoid-by-default";
export type TabooPolicy = "never-unless-requested";
export type AmbiguityPolicy = "prefer-neutral-alternative";

export interface DialectQualityContract {
  code: SpanishDialect;
  marketTier: DialectMarketTier;
  evidenceTier: DialectEvidenceTier;
  riskLevel: DialectRiskLevel;
  grammarConfidence: DialectConfidence;
  lexicalConfidence: DialectConfidence;
  slangPolicy: SlangPolicy;
  tabooPolicy: TabooPolicy;
  ambiguityPolicy: AmbiguityPolicy;
  fallbackBehavior: string[];
  safetyRules: string[];
  releaseGateNotes: string[];
}

const UNIVERSAL_SAFETY = [
  "Avoid slang by default unless the user explicitly requests a casual or slang register.",
  "Never introduce taboo or identity-loaded terms unless the source explicitly requires them.",
  "Prefer neutral alternatives when a regional word is ambiguous, sexual, insulting, or audience-dependent.",
];

function contract(
  code: SpanishDialect,
  overrides: Pick<DialectQualityContract, "marketTier" | "evidenceTier" | "riskLevel" | "grammarConfidence" | "lexicalConfidence"> &
    Partial<Pick<DialectQualityContract, "fallbackBehavior" | "safetyRules" | "releaseGateNotes">>
): DialectQualityContract {
  const localizationStrength = overrides.evidenceTier === "corpus-backed" && overrides.riskLevel !== "high"
    ? "Localize grammar and common vocabulary confidently when context is clear."
    : "Use neutral, respectful Spanish first; localize conservatively when evidence is weak or risk is high.";

  return {
    code,
    marketTier: overrides.marketTier,
    evidenceTier: overrides.evidenceTier,
    riskLevel: overrides.riskLevel,
    grammarConfidence: overrides.grammarConfidence,
    lexicalConfidence: overrides.lexicalConfidence,
    slangPolicy: "avoid-by-default",
    tabooPolicy: "never-unless-requested",
    ambiguityPolicy: "prefer-neutral-alternative",
    fallbackBehavior: overrides.fallbackBehavior || [
      localizationStrength,
      "If the dialect-specific choice is uncertain, prefer a broadly intelligible neutral Spanish rendering.",
    ],
    safetyRules: [...UNIVERSAL_SAFETY, ...(overrides.safetyRules || [])],
    releaseGateNotes: overrides.releaseGateNotes || [
      "Safe for release with automated profile guidance and tests.",
      "Still benefits from native-speaker review and gold-corpus evaluation.",
    ],
  };
}

const major = (code: SpanishDialect, extra?: Partial<DialectQualityContract>) => contract(code, {
  marketTier: "major",
  evidenceTier: "corpus-backed",
  riskLevel: "medium",
  grammarConfidence: "high",
  lexicalConfidence: "high",
  ...extra,
});

const regional = (code: SpanishDialect, extra?: Partial<DialectQualityContract>) => contract(code, {
  marketTier: "regional",
  evidenceTier: "reference-backed",
  riskLevel: "medium",
  grammarConfidence: "medium",
  lexicalConfidence: "medium",
  ...extra,
});

const heritage = (code: SpanishDialect, extra?: Partial<DialectQualityContract>) => contract(code, {
  marketTier: "heritage",
  evidenceTier: "draft",
  riskLevel: "high",
  grammarConfidence: "low",
  lexicalConfidence: "low",
  fallbackBehavior: [
    "Use conservative neutral Spanish; do not fake local fluency.",
    "Only apply heritage or contact-language flavor when explicitly requested and source-supported.",
  ],
  releaseGateNotes: [
    "Release as experimental/heritage mode, not as fully validated mainstream dialect output.",
    "Requires native-speaker or specialist review before aggressive localization.",
  ],
  ...extra,
});

export const DIALECT_QUALITY_CONTRACTS: DialectQualityContract[] = [
  major("es-MX", {
    safetyRules: ["Avoid literal coger; prefer tomar/agarrar/recoger/elegir by meaning."],
  }),
  major("es-US", {
    riskLevel: "medium",
    lexicalConfidence: "medium",
    fallbackBehavior: [
      "Use accessible U.S. Spanish for diverse heritage audiences; localize conservatively.",
      "Avoid community-specific slang unless the target audience is explicit.",
    ],
  }),
  major("es-CO", {
    safetyRules: ["Avoid marica/parce unless explicitly casual and audience-safe."],
  }),
  major("es-ES", {
    safetyRules: ["Use vosotros where appropriate, but keep formal contexts with usted/ustedes."],
  }),
  major("es-AR", {
    safetyRules: ["Use voseo confidently for informal Argentine copy; avoid boludo unless explicitly casual."],
  }),
  major("es-PE", { lexicalConfidence: "medium" }),
  major("es-VE", { lexicalConfidence: "medium", safetyRules: ["Avoid arrecho/marico in formal or unknown-audience copy."] }),
  major("es-CL", { riskLevel: "high", safetyRules: ["Avoid Chilean slang such as weón/wea unless explicitly requested."] }),
  major("es-EC", { lexicalConfidence: "medium" }),
  major("es-GT", { grammarConfidence: "medium", safetyRules: ["Use vos only for explicit informal local voice; avoid cerote/culero."] }),
  major("es-DO", { lexicalConfidence: "medium", safetyRules: ["Avoid tiguere/vaina/que lo que in formal copy."] }),
  major("es-CU", { lexicalConfidence: "medium", safetyRules: ["Avoid asere/yuma in professional output unless explicitly requested."] }),

  regional("es-BO", { riskLevel: "medium" }),
  regional("es-HN", { safetyRules: ["Use vos only for informal local voice; avoid maje in formal copy."] }),
  regional("es-PY", { riskLevel: "high", grammarConfidence: "medium", safetyRules: ["Avoid unrequested Guaraní/Jopara mixing."] }),
  regional("es-NI", { grammarConfidence: "high", safetyRules: ["Use vos only when informal Nicaraguan voice is intended."] }),
  regional("es-SV", { grammarConfidence: "high", safetyRules: ["Avoid cerote/maje unless explicitly casual and safe."] }),
  regional("es-CR", { grammarConfidence: "high", safetyRules: ["Prefer usted for respectful Costa Rican copy; avoid forced mae/pura vida branding."] }),
  regional("es-PA", {
    evidenceTier: "reference-backed",
    riskLevel: "medium",
    grammarConfidence: "high",
    lexicalConfidence: "medium",
    safetyRules: ["Avoid cueco/chombo/yeyé unless explicitly relevant and safe."],
  }),
  regional("es-UY", { grammarConfidence: "high", lexicalConfidence: "medium", safetyRules: ["Use voseo for informal local voice; avoid boludo in unknown-audience copy."] }),
  regional("es-PR", {
    evidenceTier: "reference-backed",
    riskLevel: "medium",
    grammarConfidence: "high",
    lexicalConfidence: "medium",
    safetyRules: ["Avoid cabrón, bicho, and puñeta unless explicitly requested and audience-safe."],
  }),

  heritage("es-GQ", {
    marketTier: "regional",
    evidenceTier: "reference-backed",
    fallbackBehavior: [
      "Use conservative standard Spanish with Equatoguinean awareness; do not fake local slang.",
      "Prefer formal/institutional clarity when uncertain.",
    ],
  }),
  heritage("es-PH"),
  heritage("es-BZ", {
    marketTier: "regional",
    fallbackBehavior: [
      "Use neutral Belize-aware Spanish; do not invent Kriol/English mixing.",
      "Prefer broadly intelligible Central American/Caribbean Spanish when uncertain.",
    ],
  }),
  heritage("es-AD", {
    marketTier: "regional",
    fallbackBehavior: [
      "Use conservative Spain-adjacent Spanish; do not insert Catalan words without source support.",
      "Prefer formal neutral output for tourism, official, or business contexts.",
    ],
  }),
];

export function getDialectQualityContract(code: SpanishDialect): DialectQualityContract | undefined {
  return DIALECT_QUALITY_CONTRACTS.find((contract) => contract.code === code);
}

export function buildDialectQualityPrompt(code: SpanishDialect): string {
  const contract = getDialectQualityContract(code);
  if (!contract) return "";

  return [
    `Dialect quality contract for ${code}: marketTier=${contract.marketTier}; evidenceTier=${contract.evidenceTier}; riskLevel=${contract.riskLevel}; grammarConfidence=${contract.grammarConfidence}; lexicalConfidence=${contract.lexicalConfidence}.`,
    `Slang policy: ${contract.slangPolicy}. Taboo policy: ${contract.tabooPolicy}. Ambiguity policy: ${contract.ambiguityPolicy}.`,
    `Fallback behavior: ${contract.fallbackBehavior.join(" ")}`,
    `Safety rules: ${contract.safetyRules.join(" ")}`,
    `Release notes: ${contract.releaseGateNotes.join(" ")}`,
  ].join(" ");
}
