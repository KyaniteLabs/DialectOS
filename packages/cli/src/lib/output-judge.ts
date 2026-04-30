import type { SpanishDialect } from "@dialectos/types";

export type OutputJudgeCategory =
  | "accuracy"
  | "dialect"
  | "format"
  | "markup-placeholder"
  | "prompt-leak"
  | "provider-protocol"
  | "register"
  | "taboo-safety";

export type OutputJudgeSeverity = "critical" | "major" | "minor" | "info";

export interface OutputJudgeSample {
  id?: string;
  source: string;
  register?: string;
  documentKind?: string;
  forbiddenOutputTerms?: string[];
  requiredOutputAny?: string[];
  requiredOutputGroups?: string[][];
  preferredOutputAny?: string[];
}

export interface OutputJudgeIssue {
  category: OutputJudgeCategory;
  severity: OutputJudgeSeverity;
  message: string;
}

export interface OutputJudgeResult {
  issues: OutputJudgeIssue[];
  blockingIssues: OutputJudgeIssue[];
}

const PROMPT_LEAK_PATTERNS = [
  /\bdialect quality contract\b/i,
  /\blexical ambiguity constraints\b/i,
  /\btarget dialect\b/i,
  /\bsource language\b/i,
  /\bsource text\b/i,
  /\bforbidden output\b/i,
  /\btaboo policy\b/i,
  /\bdo not translate literally\b/i,
  /\bdialect fidelity\b/i,
  /\bformality.*regional nuances\b/i,
];

const EXPLANATION_PATTERNS = [
  /^\s*(translation|traducci[oó]n)\s*:/i,
  /\bhere is (a |the )?translat/i,
  /\bhere('s| is) (a |the )?(translated|spanish)\b/i,
  /\bbelow is (a |the )?translat/i,
  /\baqu[ií] (est[aá]|tienes) (la )?traducci[oó]n\b/i,
  /\bsure,? i can help/i,
  /\bokay,? i understand/i,
  /\blet'?s begin/i,
  /```/,
  /^\s*<<<\s*$/m,
];

const ENGLISH_FUNCTION_WORDS = /\b(the|before|after|from|your|with|without|support|payment|office|package|file|room|guests|arrive|deployment|message|this|english|sentence|should|remain|impossible)\b/i;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function extractPlaceholders(text: string): string[] {
  return unique([
    ...(text.match(/\{[A-Za-z0-9_]+\}/g) || []),
    ...(text.match(/%\{[A-Za-z0-9_]+\}/g) || []),
    ...(text.match(/\{\{[A-Za-z0-9_.-]+\}\}/g) || []),
    ...(text.match(/:[A-Za-z][A-Za-z0-9_]*/g) || []),
  ]);
}

function extractUrls(text: string): string[] {
  return unique(text.match(/https?:\/\/[^\s)]+/g) || []);
}

function containsWholeTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(text);
}

function isBlocking(issue: OutputJudgeIssue): boolean {
  return issue.severity === "critical" || issue.severity === "major";
}

export function judgeTranslationOutput(
  sample: OutputJudgeSample,
  dialect: SpanishDialect,
  output: string
): OutputJudgeResult {
  const issues: OutputJudgeIssue[] = [];
  const trimmed = output.trim();

  if (!trimmed) {
    issues.push({
      category: "provider-protocol",
      severity: "critical",
      message: "Provider returned empty output.",
    });
    return { issues, blockingIssues: issues };
  }

  for (const token of extractPlaceholders(sample.source)) {
    if (!trimmed.includes(token)) {
      issues.push({
        category: "markup-placeholder",
        severity: "critical",
        message: `Placeholder was not preserved: ${token}`,
      });
    }
  }

  for (const url of extractUrls(sample.source)) {
    if (!trimmed.includes(url)) {
      issues.push({
        category: "markup-placeholder",
        severity: "critical",
        message: `URL was not preserved: ${url}`,
      });
    }
  }

  if (PROMPT_LEAK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    issues.push({
      category: "prompt-leak",
      severity: "critical",
      message: "Output appears to include internal prompt, policy, or context text.",
    });
  }

  if (EXPLANATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    issues.push({
      category: "provider-protocol",
      severity: "major",
      message: "Output includes explanation, labels, or markdown fences instead of only translated text.",
    });
  }

  if (trimmed === sample.source.trim() && ENGLISH_FUNCTION_WORDS.test(sample.source)) {
    issues.push({
      category: "accuracy",
      severity: "major",
      message: "Output is unchanged despite English source text.",
    });
  }

  if (ENGLISH_FUNCTION_WORDS.test(trimmed) && /[áéíóúñ¿¡]/i.test(trimmed)) {
    issues.push({
      category: "accuracy",
      severity: "minor",
      message: "Output appears to mix untranslated English function words with Spanish.",
    });
  }

  for (const term of sample.forbiddenOutputTerms || []) {
    if (containsWholeTerm(trimmed, term)) {
      issues.push({
        category: "taboo-safety",
        severity: "critical",
        message: `Forbidden term present: ${term}`,
      });
    }
  }

  for (const group of sample.requiredOutputGroups || []) {
    if (!group.some((term) => containsWholeTerm(trimmed, term))) {
      issues.push({
        category: "accuracy",
        severity: "critical",
        message: `Missing required semantic trait for ${dialect}; expected one of: ${group.join(", ")}`,
      });
    }
  }

  if (sample.requiredOutputAny?.length && !sample.requiredOutputAny.some((term) => containsWholeTerm(trimmed, term))) {
    issues.push({
      category: "accuracy",
      severity: "critical",
      message: `Missing required dialect/output trait for ${dialect}; expected one of: ${sample.requiredOutputAny.join(", ")}`,
    });
  }

  if (sample.preferredOutputAny?.length && !sample.preferredOutputAny.some((term) => containsWholeTerm(trimmed, term))) {
    issues.push({
      category: "dialect",
      severity: "minor",
      message: `Missing preferred dialect trait for ${dialect}; expected one of: ${sample.preferredOutputAny.join(", ")}`,
    });
  }

  return {
    issues,
    blockingIssues: issues.filter(isBlocking),
  };
}

