/**
 * Shared operator policy profiles for translation commands.
 *
 * Profiles map consistently across commands so operators don't need to
 * remember individual flag combinations.
 */

export type PolicyProfile = "strict" | "balanced" | "permissive";
export type FailurePolicy = "strict" | "allow-partial";
export type StructureMode = "warn" | "strict";
export type GlossaryMode = "off" | "strict";

export interface TranslationPolicy {
  /** Policy profile name */
  profile: PolicyProfile;
  /** How to handle section translation failures */
  failurePolicy: FailurePolicy;
  /** Whether to validate markdown structure after translation */
  validateStructure: boolean;
  /** Structure validation mode */
  structureMode: StructureMode;
  /** Glossary enforcement mode */
  glossaryMode: GlossaryMode;
  /** Whether to auto-protect identity tokens */
  protectIdentities: boolean;
  /** Whether to resume from checkpoints */
  resume: boolean;
  /** Minimum semantic similarity required before output is considered safe */
  semanticThreshold: number | null;
}

const POLICY_PRESETS: Record<PolicyProfile, TranslationPolicy> = {
  strict: {
    profile: "strict",
    failurePolicy: "strict",
    validateStructure: true,
    structureMode: "strict",
    glossaryMode: "strict",
    protectIdentities: true,
    resume: true,
    semanticThreshold: 0.6,
  },
  balanced: {
    profile: "balanced",
    failurePolicy: "allow-partial",
    validateStructure: true,
    structureMode: "warn",
    glossaryMode: "strict",
    protectIdentities: true,
    resume: true,
    semanticThreshold: 0.4,
  },
  permissive: {
    profile: "permissive",
    failurePolicy: "allow-partial",
    validateStructure: false,
    structureMode: "warn",
    glossaryMode: "off",
    protectIdentities: false,
    resume: false,
    semanticThreshold: null,
  },
};

/**
 * Resolve a policy profile to concrete settings.
 * Individual options override preset values when provided.
 */
export function resolvePolicy(
  profile: PolicyProfile = "balanced",
  overrides?: Partial<Omit<TranslationPolicy, "profile">>
): TranslationPolicy {
  const preset = POLICY_PRESETS[profile];
  if (!preset) {
    throw new Error(
      `Unknown policy profile: ${profile}. Valid profiles: ${Object.keys(POLICY_PRESETS).join(", ")}`
    );
  }

  return {
    ...preset,
    ...overrides,
    profile,
  };
}

/**
 * List available policy profiles with descriptions.
 */
export function listPolicyProfiles(): { name: PolicyProfile; description: string }[] {
  return [
    {
      name: "strict",
      description:
        "Fail on any section error, enforce structure validation, glossary, and identity protection. Suitable for production releases.",
    },
    {
      name: "balanced",
      description:
        "Allow partial output on failures, warn on structure issues, enforce glossary and identity protection. Default for CI.",
    },
    {
      name: "permissive",
      description:
        "Maximize throughput: skip validation, allow partial failures, disable glossary and identity protection. Suitable for drafts.",
    },
  ];
}

export function shouldFailSemanticQuality(
  policy: TranslationPolicy,
  semanticSimilarity: number
): boolean {
  return policy.semanticThreshold !== null && semanticSimilarity < policy.semanticThreshold;
}

export function formatSemanticQualityError(
  policy: TranslationPolicy,
  semanticSimilarity: number
): string {
  const threshold = policy.semanticThreshold ?? 0;
  return `Semantic quality gate failed for ${policy.profile} policy: ${(semanticSimilarity * 100).toFixed(
    0
  )}% is below required ${(threshold * 100).toFixed(0)}%`;
}
