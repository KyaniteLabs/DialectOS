import type { SpanishDialect } from "./index.js";

export interface ValidationReport {
  valid: boolean;
  dialect: SpanishDialect;
  qualityScore: {
    score: number;
    tokenIntegrity: number;
    glossaryFidelity: number;
    structureIntegrity: number;
    semanticSimilarity: number;
    lexicalCompliance: number;
  };
  semanticCheck: {
    finalScore: number;
    primaryScore: number;
    passed: boolean;
    negationDropped: boolean;
  };
  lexicalCompliance: {
    passed: boolean;
    score: number;
    violations: string[];
  };
  dialectCompliance: {
    passed: boolean;
    score: number;
    violations: Array<{
      concept: string;
      expectedTerm: string;
      foundTerm: string;
      severity: "error" | "warning";
      message: string;
    }>;
    checkedConcepts: number;
  };
  outputJudge: {
    issues: Array<{
      category: string;
      severity: "critical" | "major" | "minor" | "info";
      message: string;
    }>;
    blockingIssues: Array<{
      category: string;
      severity: "critical" | "major" | "minor" | "info";
      message: string;
    }>;
  };
  structureValidation?: {
    valid: boolean;
    violations: string[];
  };
  blockingIssues: string[];
  timestamp: string;
}

export interface ValidateTranslationOptions {
  source: string;
  translated: string;
  dialect: SpanishDialect;
  protectedTokens?: string[];
  glossary?: Record<string, string>;
  isMarkdown?: boolean;
}
