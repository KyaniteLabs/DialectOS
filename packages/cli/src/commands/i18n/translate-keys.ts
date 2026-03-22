/**
 * Translate-keys command handler
 * Translates missing keys from base locale to target locale
 */

import { readLocaleFile, writeLocaleFile, diffLocales } from "@espanol/locale-utils";
import type { TranslationProvider, SpanishDialect, ProviderName } from "@espanol/types";
import { writeError, writeInfo } from "../../lib/output.js";

/**
 * Execute the translate-keys command
 *
 * @param basePath - Path to the base locale file (source of truth)
 * @param targetPath - Path to the target locale file (to update)
 * @param dialect - Spanish dialect for translation
 * @param providerName - Translation provider name (or undefined for auto)
 * @param getProvider - Function to get the translation provider
 * @throws Error if file reading, translation, or writing fails
 */
export async function executeTranslateKeys(
  basePath: string,
  targetPath: string,
  dialect: SpanishDialect,
  providerName: ProviderName | undefined,
  getProvider: (name?: ProviderName) => TranslationProvider
): Promise<void> {
  try {
    // Get translation provider
    const provider = getProvider(providerName);

    // Read both locale files
    const baseEntries = readLocaleFile(basePath);
    const targetEntries = readLocaleFile(targetPath);

    // Find missing keys
    const diff = diffLocales(baseEntries, targetEntries);

    if (diff.missingInTarget.length === 0) {
      writeInfo("No missing keys to translate");
      // Write the target file as-is to ensure consistency
      writeLocaleFile(targetPath, targetEntries, 2);
      return;
    }

    // Translate missing keys
    let translatedCount = 0;
    const updatedTarget = [...targetEntries];

    for (const missingKey of diff.missingInTarget) {
      const baseEntry = baseEntries.find((e) => e.key === missingKey);
      if (!baseEntry) continue;

      try {
        const result = await provider.translate(
          baseEntry.value,
          "en",
          "es",
          { dialect }
        );

        updatedTarget.push({ key: missingKey, value: result.translatedText });
        translatedCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeError(`Failed to translate key "${missingKey}": ${message}`);
        throw error;
      }
    }

    // Write updated target locale
    writeLocaleFile(targetPath, updatedTarget, 2);

    writeInfo(`Translated ${translatedCount} missing keys`);
  } catch (error) {
    // Write error if not already written
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
