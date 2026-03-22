/**
 * Detect-missing command handler
 * Compares two locale files and reports missing, extra, and common keys
 */

import { readLocaleFile, diffLocales } from "@espanol/locale-utils";
import { writeError, writeInfo } from "../../lib/output.js";

/**
 * Execute the detect-missing command
 *
 * @param basePath - Path to the base locale file (reference)
 * @param targetPath - Path to the target locale file (to compare against)
 * @throws Error if file reading fails
 */
export async function executeDetectMissing(
  basePath: string,
  targetPath: string
): Promise<void> {
  try {
    // Read both locale files
    const baseEntries = readLocaleFile(basePath);
    const targetEntries = readLocaleFile(targetPath);

    // Compare the locales
    const diff = diffLocales(baseEntries, targetEntries);

    // Output results
    writeInfo(
      `Missing keys in target (${diff.missingInTarget.length}):${diff.missingInTarget.length > 0 ? " " + diff.missingInTarget.join(", ") : ""}`
    );
    writeInfo(
      `Extra keys in target (${diff.extraInTarget.length}):${diff.extraInTarget.length > 0 ? " " + diff.extraInTarget.join(", ") : ""}`
    );
    writeInfo(
      `Common keys (${diff.commonKeys.length}):${diff.commonKeys.length > 0 ? " " + diff.commonKeys.join(", ") : ""}`
    );

    // Exit with code 1 if there are missing keys
    if (diff.missingInTarget.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(message);
    throw error;
  }
}
