/**
 * translate-api-docs and extract-translatable command handlers
 * Translates API documentation markdown files with special handling for tables and lists
 */

import * as fs from "node:fs";
import type { TranslationProvider, SpanishDialect, MarkdownSection, ParsedMarkdown } from "@espanol/types";
import { DEFAULT_DIALECT, ALL_SPANISH_DIALECTS } from "@espanol/types";
import { parseMarkdown, reconstructMarkdown, extractTranslatableText } from "@espanol/markdown-parser";
import { validateFilePath, validateContentLength } from "@espanol/security";
import { writeOutput, writeError } from "../lib/output.js";

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
  provider: TranslationProvider,
  dialect: SpanishDialect
): Promise<MarkdownSection> {
  if (!section.translatable) {
    return section;
  }

  try {
    const result = await provider.translate(section.content, "auto", dialect, {
      dialect,
    });

    return {
      ...section,
      content: result.translatedText,
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
  provider: TranslationProvider,
  dialect: SpanishDialect
): Promise<MarkdownSection[]> {
  const translatedSections: MarkdownSection[] = [];

  for (const section of parsed.sections) {
    if (section.translatable) {
      const translated = await translateSection(section, provider, dialect);
      translatedSections.push(translated);
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
  getProvider: (name?: string) => TranslationProvider
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
    const provider = getProvider(providerName);

    // Translate all translatable sections
    const translatedSections = await translateSections(parsed, provider, validatedDialect);

    // Reconstruct markdown with translated content
    const translated = reconstructMarkdown(parsed.sections, translatedSections);

    // Write output
    await writeOutput(translated, options?.output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
