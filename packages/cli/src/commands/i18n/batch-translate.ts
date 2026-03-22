/**
 * Batch-translate command handler
 * Translates base locale to multiple target dialects
 */

import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { validateFilePath, MAX_ARRAY_LENGTH } from "@espanol/security";
import type { TranslationProvider, SpanishDialect, ProviderName } from "@espanol/types";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import { writeError, writeInfo } from "../../lib/output.js";
import { join } from "node:path";

/**
 * Validate dialect codes
 *
 * @param dialects - Array of dialect codes to validate
 * @throws Error if any dialect code is invalid
 */
function validateDialects(dialects: SpanishDialect[]): void {
  for (const dialect of dialects) {
    if (!ALL_SPANISH_DIALECTS.includes(dialect)) {
      throw new Error(`Invalid dialect code: ${dialect}`);
    }
  }
}

/**
 * Execute the batch-translate command
 *
 * @param directory - Directory containing locale files
 * @param baseLocale - Base locale code (e.g., "en")
 * @param targets - Array of target Spanish dialects
 * @param providerName - Translation provider name (or undefined for auto)
 * @param getProvider - Function to get the translation provider
 * @throws Error if validation fails, file reading fails, translation fails, or writing fails
 */
export async function executeBatchTranslate(
  directory: string,
  baseLocale: string,
  targets: SpanishDialect[],
  providerName: ProviderName | undefined,
  getProvider: (name?: ProviderName) => TranslationProvider
): Promise<void> {
  try {
    // Get translation provider
    const provider = getProvider(providerName);

    // Validate targets array
    if (targets.length === 0) {
      writeError("At least one target dialect is required");
      process.exit(1);
    }

    if (targets.length > MAX_ARRAY_LENGTH) {
      writeError(`Cannot exceed ${MAX_ARRAY_LENGTH} target dialects`);
      process.exit(1);
    }

    // Validate dialect codes
    validateDialects(targets);

    // Validate directory path
    const validatedDir = validateFilePath(directory);

    // Read base locale file
    const basePath = join(validatedDir, `${baseLocale}.json`);
    const baseEntries = readLocaleFile(basePath);

    // Track total translations
    let totalTranslated = 0;

    // Translate to each target dialect
    for (const targetDialect of targets) {
      try {
        const targetPath = join(validatedDir, `${targetDialect}.json`);

        // Check if target file exists
        let targetEntries: any[] = [];
        try {
          targetEntries = readLocaleFile(targetPath);
        } catch {
          // File doesn't exist yet, start with empty array
          targetEntries = [];
        }

        // Translate all base keys
        const translatedEntries: any[] = [];

        for (const baseEntry of baseEntries) {
          try {
            const result = await provider.translate(
              baseEntry.value,
              baseLocale,
              "es",
              { dialect: targetDialect }
            );

            translatedEntries.push({
              key: baseEntry.key,
              value: result.translatedText,
            });

            totalTranslated++;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            writeError(
              `Failed to translate key "${baseEntry.key}" to ${targetDialect}: ${message}`
            );
            throw error;
          }
        }

        // Write translated locale file
        writeLocaleFile(targetPath, translatedEntries, 2);
      } catch (error) {
        // Re-throw for outer catch block
        throw error;
      }
    }

    // Output summary
    writeInfo("Batch translation completed");
    writeInfo(`Directory: ${validatedDir}`);
    writeInfo(`Base locale: ${baseLocale}`);
    writeInfo(`Targets: ${targets.join(", ")}`);
    writeInfo(`Total keys translated: ${totalTranslated}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
