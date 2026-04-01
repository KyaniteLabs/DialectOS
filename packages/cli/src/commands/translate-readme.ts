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
import {
  parseMarkdown,
  reconstructMarkdown,
} from "@espanol/markdown-parser";
import { validateMarkdownPath, createSecureTempPath } from "@espanol/security";
import type { ProviderRegistry } from "@espanol/providers";
import {
  loadProtectedTokens,
  protectTokensInText,
  restoreProtectedTokens,
} from "../lib/token-protection.js";
import {
  loadGlossary,
  prepareGlossaryProtectedText,
  type GlossaryMode,
} from "../lib/glossary-enforcement.js";

interface TranslateReadmeOptions {
  dialect: string;
  output?: string;
  provider?: string;
  formal?: boolean;
  informal?: boolean;
  protectTokens?: string;
  glossaryFile?: string;
  glossaryMode?: GlossaryMode;
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
    .action(async (input: string, options: TranslateReadmeOptions) => {
      try {
        await translateReadme(input, options, getRegistry);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
          throw error;
        }
        throw error;
      }
    });
}

/**
 * Main translation function
 */
async function translateReadme(
  input: string,
  options: TranslateReadmeOptions,
  getRegistry: () => ProviderRegistry
): Promise<void> {
  // 1. Validate input path
  const validatedPath = validateMarkdownPath(input);

  // 2. Read file content
  const content = await fs.readFile(validatedPath, "utf-8");

  // 3. Parse markdown
  const parsed = parseMarkdown(content);

  if (parsed.sections.length === 0) {
    const result = "";
    if (options.output) {
      await writeOutput(options.output, result);
    } else {
      console.log(result);
    }
    return;
  }

  // 4. Get translation provider
  const registry = getRegistry();
  const provider = options.provider
    ? registry.get(options.provider)
    : registry.getAuto();

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

  for (const section of parsed.sections) {
    if (!section.translatable) {
      // Non-translatable sections keep original
      translatedSections.push(section);
    } else {
      const glossaryChunk = prepareGlossaryProtectedText(
        section.content,
        glossary,
        glossaryMode
      );
      const protectedChunk = protectTokensInText(glossaryChunk.text, protectedTokens);
      // Translate the content
      const result = await provider.translate(
        protectedChunk.text,
        "en", // Assume source is English
        "es", // Target is Spanish
        translateOptions
      );

      // Create translated section
      translatedSections.push({
        ...section,
        content: restoreProtectedTokens(
          restoreProtectedTokens(result.translatedText, protectedChunk.replacements),
          glossaryChunk.replacements
        ),
      });
    }
  }

  // 7. Reconstruct markdown
  const translated = reconstructMarkdown(parsed.sections, translatedSections);

  // 8. Write output
  if (options.output) {
    await writeOutput(options.output, translated);
  } else {
    console.log(translated);
  }
}

/**
 * Write output to file with atomic write
 * Uses temp file + rename for atomicity
 */
async function writeOutput(filePath: string, content: string): Promise<void> {
  // Create temp file in same directory as target
  const tempPath = createSecureTempPath(filePath);

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, "utf-8");

    // Atomic rename to final path
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
