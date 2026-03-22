/**
 * Glossary commands: search and get
 */

import { writeOutput } from "../lib/output.js";
import {
  searchGlossary,
  getGlossaryByCategory,
  formatGlossaryResults
} from "../lib/glossary-data.js";

/**
 * Command options for glossary search
 */
export interface GlossarySearchOptions {
  format?: "text" | "json";
}

/**
 * Search glossary for matching terms
 */
export async function executeGlossarySearch(
  query: string,
  options: GlossarySearchOptions = {}
): Promise<void> {
  const format = options.format || "text";

  // Search for matching entries
  const results = searchGlossary(query);

  // Format and output
  const output = formatGlossaryResults(results, format);
  writeOutput(output);
}

/**
 * Command options for glossary get
 */
export interface GlossaryGetOptions {
  category?: string;
  format?: "text" | "json";
}

/**
 * Get glossary entries by category
 */
export async function executeGlossaryGet(options: GlossaryGetOptions = {}): Promise<void> {
  const format = options.format || "text";

  // Get entries by category (or all if no category specified)
  const results = getGlossaryByCategory(options.category);

  // Format and output
  const output = formatGlossaryResults(results, format);
  writeOutput(output);
}
