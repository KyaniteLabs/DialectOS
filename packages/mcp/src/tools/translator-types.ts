import type { ProviderName } from "@dialectos/types";
import type { SpanishDialect } from "@dialectos/types";

export interface TranslateTextParams {
  text: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
  formal?: boolean;
  informal?: boolean;
}

export interface DetectDialectParams {
  text: string;
}

export interface TranslateCodeCommentParams {
  code: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
}

export interface TranslateReadmeParams {
  filePath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
  formal?: boolean;
  informal?: boolean;
}

export interface SearchGlossaryParams {
  query: string;
}

export interface ListDialectsParams {}

export interface ResearchRegionalTermParams {
  concept: string;
  dialects: string;
  semanticField?: string;
}

export interface McpRegionalResearchSource {
  title: string;
  link: string;
  snippet?: string;
}

export type McpResearchConfidence = "low" | "medium" | "high";

export interface McpRegionalLexemeProposal {
  dialect: SpanishDialect;
  preferred: string[];
  accepted: string[];
  forbidden: string[];
  confidence: McpResearchConfidence;
  rationale: string;
  sources: McpRegionalResearchSource[];
}
