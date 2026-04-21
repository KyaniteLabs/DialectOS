/**
 * Translate command handler
 * Translates text from source language to target Spanish dialect
 */

import * as fs from "node:fs";
import { Readable } from "node:stream";
import type { TranslationProvider } from "@espanol/types";
import type { SpanishDialect, ProviderName, FormalityLevel } from "@espanol/types";
import { DEFAULT_DIALECT, ALL_SPANISH_DIALECTS } from "@espanol/types";
import { validateFilePath, validateContentLength } from "@espanol/security";
import { writeOutput, writeError } from "../lib/output.js";

/**
 * Options for the translate command
 */
export interface TranslateCommandOptions {
  /** Spanish dialect (default: es-ES) */
  dialect?: SpanishDialect;
  /** Translation provider (default: auto) */
  provider?: string;
  /** Formality level */
  formal?: boolean;
  informal?: boolean;
  autoFormality?: boolean;
  /** Read from file instead of text argument */
  inputFile?: string;
  /** Write output to file instead of stdout */
  output?: string;
}

/**
 * Get formality level from options
 */
function getFormality(options: TranslateCommandOptions): FormalityLevel {
  if (options.formal) return "formal";
  if (options.informal) return "informal";
  return "auto";
}

/**
 * Read input text from various sources
 * Priority: text argument > input file > stdin
 */
async function readInput(
  textArg: string | undefined,
  options: TranslateCommandOptions
): Promise<string> {
  // If text argument is provided, use it
  if (textArg && textArg.length > 0) {
    // Validate content length
    validateContentLength(textArg);
    return textArg;
  }

  // If input file is specified, read from file
  if (options.inputFile) {
    const validatedPath = validateFilePath(options.inputFile);
    const content = await fs.promises.readFile(validatedPath, "utf-8");
    validateContentLength(content);
    return content;
  }

  // Read from stdin
  return readFromStdin();
}

/**
 * Read text from stdin
 */
function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    process.stdin.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf-8");
      try {
        validateContentLength(text);
        resolve(text);
      } catch (error) {
        reject(error);
      }
    });

    process.stdin.on("error", (error) => {
      reject(new Error(`Failed to read from stdin: ${error.message}`));
    });
  });
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
 * Validate provider name (or "auto" for automatic selection)
 */
function validateProvider(provider: string | undefined): string | undefined {
  if (!provider) return undefined;

  const validProviders: ProviderName[] = ["deepl", "libre", "mymemory"];
  if (provider !== "auto" && !validProviders.includes(provider as ProviderName)) {
    throw new Error(
      `Invalid provider: ${provider}. Valid providers are: auto, ${validProviders.join(", ")}`
    );
  }
  return provider;
}

/**
 * Execute the translate command
 */
export async function executeTranslate(
  textArg: string | undefined,
  options: TranslateCommandOptions,
  getProvider: (name?: string) => TranslationProvider
): Promise<void> {
  try {
    // Validate and parse options
    const dialect = options.dialect
      ? validateDialect(options.dialect)
      : DEFAULT_DIALECT;
    const provider = validateProvider(options.provider);
    const formality = getFormality(options);

    // Read input text
    const text = await readInput(textArg, options);

    if (!text.trim()) {
      writeError("No input text provided");
      process.exit(1);
    }

    // Get translation provider
    const translationProvider = getProvider(provider);

    // Perform translation
    const result = await translationProvider.translate(text, "auto", "es", {
      formality,
      dialect,
    });

    // Write output
    await writeOutput(result.translatedText, options.output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
