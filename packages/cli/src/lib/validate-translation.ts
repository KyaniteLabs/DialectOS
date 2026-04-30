import type { SpanishDialect, ValidateTranslationOptions, ValidationReport } from "@dialectos/types";
import { validateDialectCompliance } from "@dialectos/types";
import { validateMarkdownStructure } from "./structure-validator.js";
import { buildLexicalAmbiguityExpectations, checkLexicalCompliance } from "./lexical-ambiguity.js";
import type { LexicalComplianceResult } from "./lexical-ambiguity.js";
import { checkIdiomCompliance } from "./idiom-detection.js";
import { calculateQualityScore } from "./quality-score.js";
import type { QualityScore } from "./quality-score.js";
import { combinedSemanticCheck } from "./semantic-backstop.js";
import { judgeTranslationOutput } from "./output-judge.js";
import type { OutputJudgeResult } from "./output-judge.js";

export function validateTranslation(options: ValidateTranslationOptions): ValidationReport {
  const { source, translated, dialect, protectedTokens = [], glossary = {}, isMarkdown = false } = options;

  // 1. Structure validation (markdown only)
  const structureValidation = isMarkdown
    ? validateMarkdownStructure(source, translated)
    : undefined;

  // 2. Lexical ambiguity expectations + compliance
  const lexicalExpectations = buildLexicalAmbiguityExpectations(source, dialect);
  const lexicalCompliance: LexicalComplianceResult = checkLexicalCompliance(translated, lexicalExpectations);

  // 3. Dialect vocabulary compliance
  const dialectCompliance = validateDialectCompliance(source, translated, dialect);

  // 4. Quality score
  const qualityScore: QualityScore = calculateQualityScore(
    source,
    translated,
    protectedTokens,
    glossary,
    structureValidation?.valid ?? true,
    lexicalCompliance.score
  );

  // 5. Semantic backstop
  const semanticCheck = combinedSemanticCheck(source, translated);

  // 6. Output judge
  const judge: OutputJudgeResult = judgeTranslationOutput(
    {
      source,
      register: "auto",
      documentKind: isMarkdown ? "api-docs" : "plain",
      forbiddenOutputTerms: lexicalExpectations.forbiddenOutputTerms,
      requiredOutputGroups: lexicalExpectations.requiredOutputGroups,
    },
    dialect,
    translated
  );

  // 7. Idiom detection (literal translation traps)
  const idiomCheck = checkIdiomCompliance(translated, source, dialect);

  // Collect all blocking issues
  const blockingIssues: string[] = [];

  if (structureValidation && !structureValidation.valid) {
    blockingIssues.push(...structureValidation.violations);
  }

  if (!lexicalCompliance.passed) {
    blockingIssues.push(...lexicalCompliance.violations);
  }

  for (const violation of dialectCompliance.violations) {
    if (violation.severity === "error") {
      blockingIssues.push(violation.message);
    }
  }

  if (semanticCheck.error) {
    blockingIssues.push(`Semantic check failed: ${semanticCheck.error}`);
  } else if (!semanticCheck.passed) {
    if (semanticCheck.negationDropped) {
      blockingIssues.push("Negation was dropped in translation");
    } else {
      blockingIssues.push(`Semantic quality below threshold: ${(semanticCheck.finalScore * 100).toFixed(0)}%`);
    }
  }

  for (const issue of judge.blockingIssues) {
    blockingIssues.push(issue.message);
  }

  if (!idiomCheck.passed) {
    for (const trap of idiomCheck.literalTraps) {
      blockingIssues.push(`Literal idiom translation detected: "${trap}" is a word-for-word rendering, not an idiomatic Spanish equivalent.`);
    }
  }

  return {
    valid: blockingIssues.length === 0,
    dialect,
    qualityScore,
    semanticCheck: {
      finalScore: semanticCheck.finalScore,
      primaryScore: semanticCheck.primaryScore,
      passed: semanticCheck.passed,
      negationDropped: semanticCheck.negationDropped ?? false,
    },
    lexicalCompliance,
    dialectCompliance,
    outputJudge: {
      issues: judge.issues.map((i) => ({ category: i.category, severity: i.severity, message: i.message })),
      blockingIssues: judge.blockingIssues.map((i) => ({ category: i.category, severity: i.severity, message: i.message })),
    },
    idiomCheck: {
      passed: idiomCheck.passed,
      literalTraps: idiomCheck.literalTraps,
    },
    structureValidation,
    blockingIssues,
    timestamp: new Date().toISOString(),
  };
}
