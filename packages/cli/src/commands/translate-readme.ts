/**
 * translate-readme command
 * Translate a markdown file (README, docs) preserving structure
 *
 * Features:
 * - Parses markdown with @espanol/markdown-parser
 * - Preserves code blocks, links, images, tables, frontmatter
 * - Translates only translatable sections
 * - Atomic write to output file
 */

import { Command } from "commander";
import { promises as fs } from "node:fs";
import type { SpanishDialect, TranslateOptions, MarkdownSection } from "@espanol/types";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@espanol/markdown-parser";
import { validateMarkdownPath, validateFilePath, validateContentLength } from "@espanol/security";
import { writeOutput, writeError, writeInfo, sanitizeConsoleOutput } from "../lib/output.js";
import type { ProviderRegistry } from "@espanol/providers";
import {
  loadProtectedTokens,
  protectTokensInText,
  restoreProtectedTokens,
  detectIdentityTokens,
} from "../lib/token-protection.js";
import {
  loadGlossary,
  prepareGlossaryProtectedText,
  type GlossaryMode,
} from "../lib/glossary-enforcement.js";
import { validateMarkdownStructure } from "../lib/structure-validator.js";
import {
  loadCheckpoint,
  saveCheckpoint,
  hashSource,
  CURRENT_CHECKPOINT_SCHEMA_VERSION,
  type TranslationCheckpoint,
} from "../lib/checkpoint.js";
import {
  translateWithFallback,
  type AdaptivePacingState,
} from "../lib/resilient-translation.js";
import { calculateQualityScore } from "../lib/quality-score.js";
import {
  formatSemanticQualityError,
  resolvePolicy,
  shouldFailSemanticQuality,
  type PolicyProfile,
} from "../lib/translation-policy.js";
import { TelemetryCollector, globalTelemetry } from "../lib/telemetry.js";
import { buildSemanticTranslationContext } from "../lib/semantic-context.js";

interface TranslateReadmeOptions {
  dialect: string;
  output?: string;
  provider?: string;
  formal?: boolean;
  informal?: boolean;
  protectTokens?: string;
  glossaryFile?: string;
  glossaryMode?: GlossaryMode;
  protectIdentities?: boolean;
  validateStructure?: boolean;
  structureMode?: "warn" | "strict";
  checkpointFile?: string;
  resume?: boolean;
  failurePolicy?: "strict" | "allow-partial";
  policy?: PolicyProfile;
}

/**
 * Create the translate-readme command
 *
 * @param getRegistry - Function to get the provider registry
 * @returns Commander command instance
 */
export function createTranslateReadmeCommand(
  getRegistry: () => ProviderRegistry
): Command {
  return new Command("translate-readme")
    .description(
      "Translate a markdown file (README, docs) preserving structure"
    )
    .argument("<input>", "Input markdown file path")
    .requiredOption("-d, --dialect <dialect>", "Target Spanish dialect", "es-ES")
    .option("-o, --output <file>", "Output file path")
    .option("-p, --provider <provider>", "Translation provider")
    .option("-f, --formal", "Use formal register")
    .option("-i, --informal", "Use informal register")
    .option("--protect-tokens <file>", "JSON file with protected tokens")
    .option("--glossary-file <file>", "JSON glossary file with term mappings")
    .option("--glossary-mode <mode>", "Glossary mode: off|strict", "off")
    .option("--protect-identities", "Auto-protect handles/domains/usernames", true)
    .option("--no-protect-identities", "Disable auto identity protection")
    .option("--validate-structure", "Validate markdown structure after translation", true)
    .option("--no-validate-structure", "Disable structure validation")
    .option("--structure-mode <mode>", "Structure validation mode: warn|strict", "strict")
    .option("--checkpoint-file <file>", "Checkpoint file for resumable translation")
    .option("--resume", "Resume from checkpoint when available", true)
    .option("--no-resume", "Ignore existing checkpoint")
    .option("--failure-policy <policy>", "Behavior on section failure: strict|allow-partial")
    .option("--policy <profile>", "Policy profile: strict|balanced|permissive", "balanced")
    .action(async (input: string, options: TranslateReadmeOptions) => {
      // Resolve policy profile and merge with explicit overrides
      const policy = resolvePolicy(options.policy, {
        failurePolicy: options.failurePolicy,
        validateStructure: options.validateStructure,
        structureMode: options.structureMode,
        glossaryMode: options.glossaryMode,
        protectIdentities: options.protectIdentities,
        resume: options.resume,
      });
      const mergedOptions: TranslateReadmeOptions = {
        ...options,
        failurePolicy: policy.failurePolicy,
        validateStructure: policy.validateStructure,
        structureMode: policy.structureMode,
        glossaryMode: policy.glossaryMode,
        protectIdentities: policy.protectIdentities,
        resume: policy.resume,
      };
      try {
        const result = await translateReadme(input, mergedOptions, getRegistry);
        globalTelemetry.record({
          command: "translate-readme",
          provider: mergedOptions.provider,
          providerUsed: result.providerUsed,
          fallbackCount: result.fallbackCount,
          retryCount: result.retryCount,
          sectionCount: result.sectionCount,
          failureCount: result.failureCount,
          qualityScore: result.qualityScore,
          tokenIntegrity: result.tokenIntegrity,
          glossaryFidelity: result.glossaryFidelity,
          structureIntegrity: result.structureIntegrity,
          semanticSimilarity: result.semanticSimilarity,
          durationMs: result.durationMs,
          dialect: mergedOptions.dialect,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof Error) {
          writeError(error.message);
          throw error;
        }
        throw error;
      }
    });
}

/**
 * Main translation function
 */
export interface TranslateReadmeResult {
  qualityScore: number;
  tokenIntegrity: number;
  glossaryFidelity: number;
  structureIntegrity: number;
  semanticSimilarity: number;
  providerUsed?: string;
  fallbackCount: number;
  retryCount: number;
  failureCount: number;
  sectionCount: number;
  durationMs: number;
}

async function translateReadme(
  input: string,
  options: TranslateReadmeOptions,
  getRegistry: () => ProviderRegistry
): Promise<TranslateReadmeResult> {
  const startTime = Date.now();
  let providerUsed: string | undefined;
  let fallbackCount = 0;
  let retryCount = 0;

  // 1. Validate input path
  const validatedPath = validateMarkdownPath(input);

  // 1b. Validate dialect
  if (options.dialect && !ALL_SPANISH_DIALECTS.includes(options.dialect as SpanishDialect)) {
    throw new Error(
      `Invalid dialect: ${options.dialect}. Valid dialects are: ${ALL_SPANISH_DIALECTS.join(", ")}`
    );
  }

  // 2. Read file content
  const content = await fs.readFile(validatedPath, "utf-8");
  validateContentLength(content);

  // 3. Parse markdown
  const parsed = parseMarkdown(content);

  if (parsed.sections.length === 0) {
    if (options.output) {
      await writeOutput("", options.output);
    } else {
      writeInfo("");
    }
    return {
      qualityScore: 100,
      tokenIntegrity: 1,
      glossaryFidelity: 1,
      structureIntegrity: 1,
      semanticSimilarity: 1,
      fallbackCount: 0,
      retryCount: 0,
      failureCount: 0,
      sectionCount: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. Get translation provider
  const registry = getRegistry();
  // 5. Build translation options
  const translateOptions: TranslateOptions = {
    dialect: options.dialect as SpanishDialect,
    formality: options.formal
      ? "formal"
      : options.informal
        ? "informal"
        : undefined,
  };

  // 6. Translate each translatable section
  const translatedSections: MarkdownSection[] = [];
  const protectedTokens = await loadProtectedTokens(options.protectTokens);
  const glossary = await loadGlossary(options.glossaryFile);
  const glossaryMode = (options.glossaryMode || "off") as GlossaryMode;
  const rawCheckpointPath = options.checkpointFile || `${options.output || validatedPath}.checkpoint.json`;
  // Always validate checkpoint paths to prevent traversal via --output
  const checkpointPath = validateFilePath(rawCheckpointPath);
  const checkpoint = options.resume ? await loadCheckpoint(checkpointPath) : null;
  const sourceHash = hashSource(content);
  const translatedByIndex: Record<number, string> =
    checkpoint && checkpoint.sourcePath === validatedPath && checkpoint.sourceHash === sourceHash
      ? checkpoint.translatedByIndex
      : (() => {
          if (checkpoint && !checkpoint.sourceHash) {
            writeInfo("Checkpoint predates source hashing — retranslating all sections");
          }
          return {} as Record<number, string>;
        })();
  const pacing: AdaptivePacingState = { delayMs: 0 };
  let failures = 0;

  for (const [idx, section] of parsed.sections.entries()) {
    if (!section.translatable) {
      // Non-translatable sections keep original
      translatedSections.push(section);
    } else {
      if (idx in translatedByIndex) {
        translatedSections.push({ ...section, content: translatedByIndex[idx] });
        continue;
      }
      const glossaryChunk = prepareGlossaryProtectedText(
        section.content,
        glossary,
        glossaryMode
      );
      const runtimeTokens = options.protectIdentities
        ? detectIdentityTokens(glossaryChunk.text)
        : [];
      const mergedTokens = Array.from(new Set([...protectedTokens, ...runtimeTokens]));
      const protectedChunk = protectTokensInText(glossaryChunk.text, mergedTokens);
      try {
        const semanticContext = buildSemanticTranslationContext({
          text: section.content,
          dialect: options.dialect as SpanishDialect,
          formality: translateOptions.formality,
          documentKind: "readme",
          sectionType: section.type,
        });
        const result = await translateWithFallback(
          registry,
          options.provider,
          protectedChunk.text,
          "en",
          "es",
          { ...translateOptions, context: semanticContext },
          pacing
        );

        const translatedContent = restoreProtectedTokens(
          restoreProtectedTokens(result.translatedText, protectedChunk.replacements),
          glossaryChunk.replacements
        );
        providerUsed = result.providerUsed;
        fallbackCount += result.fallbackCount;
        retryCount += result.retryCount;

        // Create translated section
        translatedSections.push({
          ...section,
          content: translatedContent,
        });

        // Only checkpoint successful translations
        translatedByIndex[idx] = translatedContent;
        const state: TranslationCheckpoint = {
          schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
          sourcePath: validatedPath,
          sourceHash,
          totalSections: parsed.sections.length,
          translatedByIndex,
        };
        await saveCheckpoint(checkpointPath, state);
      } catch (error) {
        // Keep original section on failure — do NOT checkpoint
        writeError(
          `Failed to translate section ${idx}: ${sanitizeConsoleOutput(error instanceof Error ? error.message : String(error))}`
        );
        translatedSections.push(section);
        failures++;
      }
    }
  }

  // 7. Reconstruct markdown
  const translated = reconstructMarkdown(parsed.sections, translatedSections);

  // 7b. Enforce failure policy
  const failurePolicy = options.failurePolicy ?? "strict";
  if (failures > 0 && failurePolicy === "strict") {
    throw new Error(`Section translation failed for ${failures} translatable block(s)`);
  }
  if (failures > 0 && failurePolicy === "allow-partial") {
    writeInfo(`Partial translation output: ${failures} translatable block(s) failed`);
  }

  // Call validateMarkdownStructure once and reuse the result
  const validation = options.validateStructure
    ? validateMarkdownStructure(content, translated)
    : { valid: true, violations: [] };

  if (options.validateStructure && !validation.valid) {
    const msg = `Structure validation failed: ${validation.violations.join("; ")}`;
    if ((options.structureMode || "strict") === "strict") {
      throw new Error(msg);
    }
    writeInfo(msg);
  }

  const quality = calculateQualityScore(
    content,
    translated,
    protectedTokens,
    glossary?.mappings || {},
    validation.valid
  );
  const policy = resolvePolicy(options.policy || "balanced", {
    failurePolicy: options.failurePolicy,
    validateStructure: options.validateStructure,
    structureMode: options.structureMode,
    glossaryMode,
    protectIdentities: options.protectIdentities,
    resume: options.resume,
  });
  const semanticGateApplies = content.trim().length >= 120 || translated.trim().length >= 120;
  if (semanticGateApplies && shouldFailSemanticQuality(policy, quality.semanticSimilarity)) {
    throw new Error(formatSemanticQualityError(policy, quality.semanticSimilarity));
  }
  writeInfo(
    `[quality] score=${quality.score} token=${(quality.tokenIntegrity * 100).toFixed(
      0
    )}% glossary=${(quality.glossaryFidelity * 100).toFixed(0)}% structure=${
      quality.structureIntegrity === 1 ? "pass" : "fail"
    } semantic=${(quality.semanticSimilarity * 100).toFixed(0)}%`
  );

  // 8. Write output
  await writeOutput(translated, options.output);

  // Clean up checkpoint file after successful completion
  try {
    await fs.unlink(checkpointPath);
  } catch {
    // Checkpoint may not exist — ignore
  }

  return {
    qualityScore: quality.score,
    tokenIntegrity: quality.tokenIntegrity,
    glossaryFidelity: quality.glossaryFidelity,
    structureIntegrity: quality.structureIntegrity,
    semanticSimilarity: quality.semanticSimilarity,
    providerUsed,
    fallbackCount,
    retryCount,
    failureCount: failures,
    sectionCount: parsed.sections.length,
    durationMs: Date.now() - startTime,
  };
}
