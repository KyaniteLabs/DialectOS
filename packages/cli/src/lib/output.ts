/**
 * Output utilities for the CLI
 * Handles writing to stdout and files
 */

import * as fs from "node:fs";
import { validateFilePath } from "@espanol/security";

/**
 * Write output to stdout or file
 * @param output - The output content
 * @param filePath - Optional file path. If not provided, writes to stdout
 */
export async function writeOutput(
  output: string,
  filePath?: string
): Promise<void> {
  if (filePath) {
    // Validate and resolve file path
    const validatedPath = validateFilePath(filePath);
    await fs.promises.writeFile(validatedPath, output, "utf-8");
  } else {
    // Write to stdout
    process.stdout.write(output);
  }
}

/**
 * Write error message to stderr
 * @param message - The error message
 */
export function writeError(message: string): void {
  process.stderr.write(`Error: ${message}\n`);
}

/**
 * Write info message to stderr (for non-error status messages)
 * @param message - The info message
 */
export function writeInfo(message: string): void {
  process.stderr.write(`${message}\n`);
}
