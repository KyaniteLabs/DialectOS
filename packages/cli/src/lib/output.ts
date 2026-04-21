/**
 * Output utilities for the CLI
 * Handles writing to stdout and files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { validateFilePath } from "@espanol/security";

/**
 * Create a secure temporary file path in the same directory as the target
 */
function createSecureTempPath(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const basename = path.basename(targetPath, ext);
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return path.join(dir, `${basename}_${randomSuffix}${ext}`);
}

/**
 * Write output to stdout or file (atomic write for files)
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

    // Atomic write: temp file + rename to prevent partial writes
    const tempPath = createSecureTempPath(validatedPath);
    try {
      await fs.promises.writeFile(tempPath, output, "utf-8");
      await fs.promises.rename(tempPath, validatedPath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } else {
    // Write to stdout
    process.stdout.write(output);
  }
}

/**
 * Strip ANSI escape sequences and terminal control characters
 * to prevent injection when logging untrusted content.
 */
export function sanitizeConsoleOutput(message: string): string {
  // Remove ANSI escape sequences
  let sanitized = message.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  // Remove other control characters (keep tab, newline, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  return sanitized;
}

/**
 * Write error message to stderr
 * @param message - The error message
 */
export function writeError(message: string): void {
  process.stderr.write(`Error: ${sanitizeConsoleOutput(message)}\n`);
}

/**
 * Write info message to stderr (for non-error status messages)
 * @param message - The info message
 */
export function writeInfo(message: string): void {
  process.stderr.write(`${sanitizeConsoleOutput(message)}\n`);
}
