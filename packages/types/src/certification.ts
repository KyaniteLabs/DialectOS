import type { SpanishDialect } from "./index.js";

export type CertificationLevel = "bronze" | "silver" | "gold" | "platinum";
export type DialectValidationStatus = "automated-certified" | "native-reviewed" | "customer-approved" | "experimental";

export type MQMIssueCategory =
  | "accuracy"
  | "fluency"
  | "terminology"
  | "locale-convention"
  | "style-register"
  | "grammar"
  | "markup-placeholder"
  | "formatting"
  | "taboo-safety";

export type MQMIssueSeverity = "critical" | "major" | "minor" | "info";

export interface MQMIssue {
  category: MQMIssueCategory;
  severity: MQMIssueSeverity;
  message: string;
  dialect?: SpanishDialect;
  fixture?: string;
  source?: string;
  output?: string;
}

export interface DialectValidationMetadata {
  dialect: SpanishDialect;
  status: DialectValidationStatus;
  certificationLevel: CertificationLevel;
  notes: string[];
}

export const CERTIFICATION_LEVEL_DESCRIPTIONS: Record<CertificationLevel, string> = {
  bronze: "Automated deterministic certification passed.",
  silver: "Automated certification plus native-speaker sampled review.",
  gold: "Automated certification, native review, and customer glossary/style approval.",
  platinum: "Gold plus regulated workflow controls, audit trail, and human LQA/post-editing process.",
};

const NATIVE_REVIEWED = new Set<SpanishDialect>(["es-PA", "es-PR"]);
const EXPERIMENTAL = new Set<SpanishDialect>(["es-PH"]);

export const DIALECT_VALIDATION_METADATA: DialectValidationMetadata[] = [
  "es-ES", "es-MX", "es-AR", "es-CO", "es-CU",
  "es-PE", "es-CL", "es-VE", "es-UY", "es-PY",
  "es-BO", "es-EC", "es-GT", "es-HN", "es-SV",
  "es-NI", "es-CR", "es-PA", "es-DO", "es-PR",
  "es-GQ", "es-US", "es-PH", "es-BZ", "es-AD",
].map((dialect) => {
  const code = dialect as SpanishDialect;
  if (NATIVE_REVIEWED.has(code)) {
    return {
      dialect: code,
      status: "native-reviewed",
      certificationLevel: "silver",
      notes: ["Automated certification passed; native speaker review available for this dialect."],
    };
  }
  if (EXPERIMENTAL.has(code)) {
    return {
      dialect: code,
      status: "experimental",
      certificationLevel: "bronze",
      notes: ["Use conservative Spanish; specialist review recommended before aggressive localization."],
    };
  }
  return {
    dialect: code,
    status: "automated-certified",
    certificationLevel: "bronze",
    notes: ["Automated deterministic certification passed; native review still recommended for brand-critical launches."],
  };
});

export function getDialectValidationMetadata(dialect: SpanishDialect): DialectValidationMetadata | undefined {
  return DIALECT_VALIDATION_METADATA.find((entry) => entry.dialect === dialect);
}
