/**
 * Dialects commands: list and detect
 */

import { writeOutput } from "../lib/output.js";
import {
  formatDialectList,
  formatDetectionResult,
  detectDialect,
  type RegisterPreference
} from "../lib/dialect-info.js";

/**
 * Command options for dialects list
 */
export interface DialectsListOptions {
  format?: "text" | "json";
}

/**
 * List all Spanish dialects
 */
export async function executeDialectsList(options: DialectsListOptions = {}): Promise<void> {
  const format = options.format || "text";
  const output = formatDialectList(format);
  writeOutput(output);
}

/**
 * Command options for dialects detect
 */
export interface DialectsDetectOptions {
  format?: "text" | "json";
  register?: RegisterPreference;
}

/**
 * Detect Spanish dialect from text
 */
export async function executeDialectsDetect(
  text: string,
  options: DialectsDetectOptions = {}
): Promise<void> {
  const format = options.format || "text";
  const register = options.register || "any";

  // Detect dialect with register preference
  const result = detectDialect(text, register);

  // Format and output
  const output = formatDetectionResult(result, format);
  writeOutput(output);
}
