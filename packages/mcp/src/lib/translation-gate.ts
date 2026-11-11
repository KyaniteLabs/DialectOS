import { validateTranslation } from "@dialectos/cli/validate";
import type { SpanishDialect, ValidationReport } from "@dialectos/types";
import { ToolResult } from "./types.js";

export const QUALITY_GATE_FAILED = "QUALITY_GATE_FAILED";

export interface GateInput {
  source: string;
  translated: string;
  dialect: SpanishDialect;
  isMarkdown?: boolean;
}

export interface GateResult {
  report: ValidationReport;
  /** Issues that stop the translation from being returned or written. */
  blocking: string[];
  /** Issues reported alongside a translation that is still returned. */
  advisories: string[];
}

const SCORE_ONLY_SEMANTIC = "Semantic quality below threshold";

/**
 * Run the same validator the CLI and GitHub Action use on a translation the
 * MCP server is about to return.
 *
 * One check is advisory here: a semantic score below threshold with no
 * dropped negation. That score is a length/overlap heuristic that marks
 * correct short UI strings as failures ("Welcome" -> "Bienvenido" scores
 * 26%), so blocking on it would reject good translations. A dropped
 * negation, broken tokens or structure, dialect errors, output-judge
 * findings and literal idioms all still block.
 */
export function gateTranslation(input: GateInput): GateResult {
  const report = validateTranslation({
    source: input.source,
    translated: input.translated,
    dialect: input.dialect,
    isMarkdown: input.isMarkdown ?? false,
  });
  const scoreOnly = !report.semanticCheck.passed && !report.semanticCheck.negationDropped;
  const blocking: string[] = [];
  const advisories: string[] = [];
  for (const issue of report.blockingIssues) {
    if (scoreOnly && issue.startsWith(SCORE_ONLY_SEMANTIC)) advisories.push(issue);
    else blocking.push(issue);
  }
  return { report, blocking, advisories };
}

/** Compact, JSON-safe summary of a gate result for tool output. */
export function summarizeGate(gate: GateResult) {
  return {
    valid: gate.blocking.length === 0,
    score: gate.report.qualityScore.score,
    blockingIssues: gate.blocking,
    advisories: gate.advisories,
  };
}

/** MCP error result for a translation that failed the quality gate. */
export function qualityGateFailure(gate: GateResult, warnings: string[] = []): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: QUALITY_GATE_FAILED,
          message: `Translation failed the quality gate: ${gate.blocking.join("; ")}`,
          validation: summarizeGate(gate),
          warnings,
        }),
      },
    ],
    isError: true,
  };
}

/**
 * Throw when a translation fails the gate. Per-section loops use this so a
 * rejected section takes the same keep-the-original fallback as a provider
 * error, and the reason lands in that tool's `errors` list.
 */
export function assertGate(input: GateInput): void {
  const gate = gateTranslation(input);
  if (gate.blocking.length > 0) {
    throw new Error(`${QUALITY_GATE_FAILED}: ${gate.blocking.join("; ")}`);
  }
}
