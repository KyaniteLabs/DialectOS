/**
 * translate-api-docs and extract-translatable command handlers
 * Translates API documentation markdown files with special handling for tables and lists
 */

import * as fs from "node:fs";
import type { TranslationProvider, SpanishDialect, MarkdownSection, ParsedMarkdown, TranslateOptions } from "@espanol/types";
import { DEFAULT_DIALECT, ALL_SPANISH_DIALECTS } from "@espanol/types";
import { parseMarkdown, reconstructMarkdown, extractTranslatableText } from "@espanol/markdown-parser";
import { validateFilePath, validateContentLength } from "@espanol/security";
import type { ProviderRegistry } from "@espanol/providers";
import { writeOutput, writeError } from "../lib/output.js";
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
import { loadCheckpoint, saveCheckpoint, type TranslationCheckpoint } from "../lib/checkpoint.js";
import {
  translateWithFallback,
  type AdaptivePacingState,
} from "../lib/resilient-translation.js";
import { calculateQualityScore } from "../lib/quality-score.js";

// ============================================================================
// extract-translatable Command
// ============================================================================

/**
 * Execute the extract-translatable command
 * Extracts and outputs only translatable sections from a markdown file
 *
 * @param input - Path to the input markdown file
 * @param getProvider - Provider factory function (unused but kept for consistency)
 */
export async function executeExtractTranslatable(
  input: string,
  getProvider: (name?: string) => TranslationProvider
): Promise<void> {
  try {
    // Validate and resolve file path
    const validatedPath = validateFilePath(input);

    // Read markdown content
    const content = await fs.promises.readFile(validatedPath, "utf-8");
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Extract translatable sections and format output
    const outputLines: string[] = [];

    for (const section of parsed.sections) {
      if (section.translatable && section.content) {
        // Format: type: content
        outputLines.push(`${section.type}: ${section.content}`);
      }
    }

    const output = outputLines.join("\n");

    // Write to stdout
    await writeOutput(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}

// ============================================================================
// translate-api-docs Command
// ============================================================================

/**
 * Options for the translate-api-docs command
 */
export interface TranslateApiDocsOptions {
  /** Spanish dialect (default: es-ES) */
  dialect?: SpanishDialect;
  /** Translation provider (default: auto) */
  provider?: string;
  /** Write output to file instead of stdout */
  output?: string;
  /** Optional protected token file path */
  protectTokens?: string;
  /** Optional glossary file path */
  glossaryFile?: string;
  /** Glossary mode */
  glossaryMode?: GlossaryMode;
  /** Auto-protect identity-like tokens */
  protectIdentities?: boolean;
  /** Validate markdown structure */
  validateStructure?: boolean;
  /** Validation mode */
  structureMode?: "warn" | "strict";
  /** Checkpoint file for resumable processing */
  checkpointFile?: string;
  /** Resume from checkpoint */
  resume?: boolean;
}

/**
 * Validate dialect code
 */
function validateDialect(dialect: string): SpanishDialect {
  if (!ALL_SPANISH_DIALECTS.includes(dialect as SpanishDialect)) {
    throw new Error(
      `Invalid dialect: ${dialect}. Valid dialects are: ${ALL_SPANISH_DIALECTS.join(", ")}`
    );
  }
  return dialect as SpanishDialect;
}

/**
 * Translate a single section
 * For tables and lists, we translate the content as a whole
 */
async function translateSection(
  section: MarkdownSection,
  registry: ProviderRegistry,
  preferredProvider: string | undefined,
  dialect: SpanishDialect,
  protectedTokens: string[],
  glossary: Awaited<ReturnType<typeof loadGlossary>>,
  glossaryMode: GlossaryMode,
  protectIdentities: boolean,
  pacing: AdaptivePacingState
): Promise<MarkdownSection> {
  if (!section.translatable) {
    return section;
  }

  try {
    const glossaryChunk = prepareGlossaryProtectedText(
      section.content,
      glossary,
      glossaryMode
    );
    const runtimeTokens = protectIdentities
      ? detectIdentityTokens(glossaryChunk.text)
      : [];
    const mergedTokens = Array.from(new Set([...protectedTokens, ...runtimeTokens]));
    const protectedChunk = protectTokensInText(glossaryChunk.text, mergedTokens);
    const options: TranslateOptions = {
      dialect,
    };
    const result = await translateWithFallback(
      registry,
      preferredProvider,
      protectedChunk.text,
      "auto",
      dialect,
      options,
      pacing
    );

    return {
      ...section,
      content: restoreProtectedTokens(
        restoreProtectedTokens(result.translatedText, protectedChunk.replacements),
        glossaryChunk.replacements
      ),
    };
  } catch (error) {
    // If translation fails, return original section
    console.error(`Failed to translate section: ${error instanceof Error ? error.message : String(error)}`);
    return section;
  }
}

/**
 * Translate all translatable sections in parsed markdown
 */
async function translateSections(
  parsed: ParsedMarkdown,
  registry: ProviderRegistry,
  preferredProvider: string | undefined,
  dialect: SpanishDialect,
  protectedTokens: string[],
  glossary: Awaited<ReturnType<typeof loadGlossary>>,
  glossaryMode: GlossaryMode,
  protectIdentities: boolean,
  checkpointPath: string,
  sourcePath: string,
  resume: boolean
): Promise<MarkdownSection[]> {
  const translatedSections: MarkdownSection[] = [];
  const checkpoint = resume ? await loadCheckpoint(checkpointPath) : null;
  const translatedByIndex = checkpoint?.translatedByIndex || {};
  const pacing: AdaptivePacingState = { delayMs: 0 };

  for (const [idx, section] of parsed.sections.entries()) {
    if (section.translatable) {
      if (translatedByIndex[idx]) {
        translatedSections.push({ ...section, content: translatedByIndex[idx] });
        continue;
      }
      const translated = await translateSection(
        section,
        registry,
        preferredProvider,
        dialect,
        protectedTokens,
        glossary,
        glossaryMode,
        protectIdentities,
        pacing
      );
      translatedSections.push(translated);
      translatedByIndex[idx] = translated.content;
      const state: TranslationCheckpoint = {
        sourcePath,
        totalSections: parsed.sections.length,
        translatedByIndex,
      };
      await saveCheckpoint(checkpointPath, state);
    } else {
      // Keep non-translatable sections as-is
      translatedSections.push(section);
    }
  }

  return translatedSections;
}

/**
 * Execute the translate-api-docs command
 * Translates an API documentation markdown file with special handling for tables and lists
 *
 * @param input - Path to the input markdown file
 * @param dialect - Target Spanish dialect
 * @param options - Command options
 * @param getProvider - Provider factory function
 */
export async function executeTranslateApiDocs(
  input: string,
  dialect: string,
  options: TranslateApiDocsOptions | undefined,
  getRegistry: () => ProviderRegistry
): Promise<void> {
  try {
    // Validate and resolve file path
    const validatedPath = validateFilePath(input);

    // Validate dialect
    const validatedDialect = dialect ? validateDialect(dialect) : DEFAULT_DIALECT;

    // Read markdown content
    const content = await fs.promises.readFile(validatedPath, "utf-8");
    validateContentLength(content);

    // Parse markdown
    const parsed = parseMarkdown(content);

    // Get translation provider
    const providerName = options?.provider;
    const registry = getRegistry();
    const protectedTokens = await loadProtectedTokens(options?.protectTokens);
    const glossary = await loadGlossary(options?.glossaryFile);
    const glossaryMode = (options?.glossaryMode || "off") as GlossaryMode;
    const protectIdentities = options?.protectIdentities !== false;
    const checkpointPath =
      options?.checkpointFile || `${options?.output || validatedPath}.checkpoint.json`;
    const resume = options?.resume !== false;

    // Translate all translatable sections
    const translatedSections = await translateSections(
      parsed,
      registry,
      providerName,
      validatedDialect,
      protectedTokens,
      glossary,
      glossaryMode,
      protectIdentities,
      checkpointPath,
      validatedPath,
      resume
    );

    // Reconstruct markdown with translated content
    const translated = reconstructMarkdown(parsed.sections, translatedSections);

    const validation = validateMarkdownStructure(content, translated);
    if (options?.validateStructure !== false) {
      if (!validation.valid) {
        const msg = `Structure validation failed: ${validation.violations.join("; ")}`;
        if ((options?.structureMode || "strict") === "strict") {
          throw new Error(msg);
        }
        console.warn(msg);
      }
    }

    // Write output
    await writeOutput(translated, options?.output);
    const quality = calculateQualityScore(
      content,
      translated,
      protectedTokens,
      glossary?.mappings || {},
      validation.valid
    );
    console.error(
      `[quality] score=${quality.score} token=${(quality.tokenIntegrity * 100).toFixed(
        0
      )}% glossary=${(quality.glossaryFidelity * 100).toFixed(0)}% structure=${
        quality.structureIntegrity === 1 ? "pass" : "fail"
      }`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
