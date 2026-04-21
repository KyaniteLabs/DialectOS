/**
 * @espanol/security
 *
 * Unified security module for Espanol MCP servers
 * Provides path validation, sanitization, rate limiting, and security controls
 *
 * Security fixes from red team audit:
 * - Uses fs.realpathSync() to resolve symlinks BEFORE checking allowed dirs
 * - Uses fs.lstatSync() to detect and REJECT symlinks entirely when requested
 * - Rejects null bytes (\x00) in paths
 * - Rejects control characters (except \n, \r, \t)
 * - Checks resolved path starts with allowed dir after realpath
 * - Reduced MAX_FILE_SIZE from 10MB to 512KB
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import DOMPurify from "isomorphic-dompurify";

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE = 512 * 1024;       // 512KB (reduced from 10MB)
export const MAX_CONTENT_LENGTH = 50000;        // 50K characters
export const MAX_PATH_LENGTH = 1024;
export const MAX_KEYS = 10000;
export const MAX_STRING_LENGTH = 50000;
export const MAX_ARRAY_LENGTH = 20;
export const MAX_RECURSION_DEPTH = 20;
export const HTTP_TIMEOUT = 30000;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for security violations
 */
export enum ErrorCode {
  PATH_TRAVERSAL = "PATH_TRAVERSAL",
  INVALID_PATH = "INVALID_PATH",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  CONTENT_TOO_LONG = "CONTENT_TOO_LONG",
  INVALID_INPUT = "INVALID_INPUT",
  RATE_LIMITED = "RATE_LIMITED",
  SANITIZATION_FAILED = "SANITIZATION_FAILED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  INVALID_JSON = "INVALID_JSON",
  DEPTH_EXCEEDED = "DEPTH_EXCEEDED",
  CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
  KEY_LIMIT_EXCEEDED = "KEY_LIMIT_EXCEEDED",
}

/**
 * Security error class with error code
 */
export class SecurityError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_INPUT) {
    super(message);
    this.name = "SecurityError";
    this.code = code;
  }
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Get allowed directories from environment and defaults
 */
function getAllowedDirs(): string[] {
  const allowed = new Set<string>([process.cwd()]);

  // Add ALLOWED_LOCALE_DIRS from environment
  const envDirs = process.env.ALLOWED_LOCALE_DIRS;
  if (envDirs) {
    envDirs.split(",").forEach((dir) => {
      const resolved = path.resolve(dir.trim());
      allowed.add(resolved);
    });
  }

  // In test mode, also allow /tmp and /test
  const isTestMode = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  if (isTestMode) {
    allowed.add("/tmp");
    allowed.add("/test");
  }

  return Array.from(allowed);
}

/**
 * Validate a file path to prevent path traversal and symlink attacks
 *
 * Security fixes:
 * - Uses fs.realpathSync() to resolve symlinks BEFORE checking allowed dirs
 * - Rejects null bytes (\x00)
 * - Rejects control characters (except \n, \r, \t)
 * - Checks resolved path starts with allowed dir after realpath
 *
 * @param filePath - The file path to validate
 * @param allowedDirs - Optional list of allowed directories (defaults to env vars + cwd)
 * @returns The validated absolute path
 * @throws SecurityError if validation fails
 */
export interface ValidateFilePathOptions {
  rejectSymlinks?: boolean;
}

export function validateFilePath(
  filePath: string,
  allowedDirs?: string[],
  options?: ValidateFilePathOptions
): string {
  // Check path length
  if (filePath.length > MAX_PATH_LENGTH) {
    throw new SecurityError("Path exceeds maximum length", ErrorCode.INVALID_PATH);
  }

  // Check for null bytes
  if (filePath.includes("\x00")) {
    throw new SecurityError("Path contains null bytes", ErrorCode.PATH_TRAVERSAL);
  }

  // Check for control characters (except \n, \r, \t)
  const controlChars = filePath.split("").filter((char) => {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x00 && code <= 0x08) ||
      (code >= 0x0b && code <= 0x0c) ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    );
  });

  if (controlChars.length > 0) {
    throw new SecurityError(
      "Path contains invalid control characters",
      ErrorCode.INVALID_PATH
    );
  }

  // Check for path traversal attempts in original path
  if (filePath.includes("..")) {
    throw new SecurityError("Path traversal detected", ErrorCode.PATH_TRAVERSAL);
  }

  // Resolve to absolute path and normalize
  let resolvedPath: string;
  try {
    resolvedPath = path.resolve(filePath);
  } catch (error) {
    throw new SecurityError("Invalid path", ErrorCode.INVALID_PATH);
  }

  // CRITICAL: Use realpathSync to resolve symlinks BEFORE checking allowed dirs
  let realPath: string;
  let isSymlink = false;
  try {
    // Check if path is a symlink using lstatSync
    try {
      const lstats = fs.lstatSync(resolvedPath);
      isSymlink = lstats.isSymbolicLink();
    } catch {
      // File doesn't exist yet — can't be a symlink
    }

    if (options?.rejectSymlinks && isSymlink) {
      throw new SecurityError(
        "Symbolic links are not allowed",
        ErrorCode.PATH_TRAVERSAL
      );
    }

    realPath = fs.realpathSync.native(resolvedPath);
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    // File doesn't exist yet — resolve parent directory (which exists) and rejoin
    const parentDir = path.dirname(resolvedPath);
    try {
      const realParent = fs.realpathSync.native(parentDir);
      realPath = path.join(realParent, path.basename(resolvedPath));
    } catch {
      // Parent doesn't exist either — use resolved path as-is
      realPath = resolvedPath;
    }
  }

  // Check against allowed directories
  const dirs = allowedDirs ?? getAllowedDirs();

  // Check if the REAL path (after symlink resolution) is within allowed directories
  let isAllowed = false;
  for (const allowedDir of dirs) {
    let resolvedAllowedDir: string;
    try {
      resolvedAllowedDir = fs.realpathSync.native(path.resolve(allowedDir));
    } catch {
      resolvedAllowedDir = path.resolve(allowedDir);
    }
    const relativePath = path.relative(resolvedAllowedDir, realPath);

    if (!relativePath.startsWith("..")) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    throw new SecurityError(
      "Path is outside allowed directories",
      ErrorCode.PATH_TRAVERSAL
    );
  }

  return realPath;
}

/**
 * Validate a markdown file path
 * Ensures the file has a .md or .markdown extension
 *
 * @param filePath - The markdown file path to validate
 * @returns The validated absolute path
 * @throws SecurityError if validation fails
 */
export function validateMarkdownPath(filePath: string, allowedDirs?: string[]): string {
  const validatedPath = validateFilePath(filePath, allowedDirs);

  // Use path.extname for proper extension checking
  const ext = path.extname(validatedPath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    throw new SecurityError(
      "Only .md and .markdown files are allowed",
      ErrorCode.INVALID_PATH
    );
  }

  return validatedPath;
}

/**
 * Validate a JSON file path
 * Ensures the file has a .json extension
 *
 * @param filePath - The JSON file path to validate
 * @param options - Validation options
 * @returns The validated absolute path
 * @throws SecurityError if validation fails
 */
export interface ValidateJsonPathOptions {
  mustExist?: boolean;
  checkSize?: boolean;
}

export function validateJsonPath(
  filePath: string,
  options?: ValidateJsonPathOptions,
  allowedDirs?: string[]
): string {
  const validatedPath = validateFilePath(filePath, allowedDirs);

  // Use path.extname for proper extension checking
  const ext = path.extname(validatedPath).toLowerCase();
  if (ext !== ".json") {
    throw new SecurityError(
      "Only .json files are allowed",
      ErrorCode.INVALID_PATH
    );
  }

  // Check if file exists (if required)
  if (options?.mustExist) {
    try {
      fs.accessSync(validatedPath, fs.constants.R_OK);
    } catch {
      throw new SecurityError("File not found", ErrorCode.INVALID_PATH);
    }

    // Check file size (if required)
    if (options?.checkSize) {
      checkFileSize(validatedPath);
    }
  }

  return validatedPath;
}

/**
 * Check if a file exceeds size limits
 *
 * @param filePath - The file path to check
 * @param maxSize - Maximum file size in bytes (defaults to MAX_FILE_SIZE)
 * @throws SecurityError if file is too large
 */
export function checkFileSize(
  filePath: string,
  maxSize: number = MAX_FILE_SIZE
): void {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > maxSize) {
      throw new SecurityError(
        `File exceeds maximum size of ${maxSize} bytes`,
        ErrorCode.FILE_TOO_LARGE
      );
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new SecurityError("Unable to read file", ErrorCode.INVALID_PATH);
  }
}

/**
 * Validate content length
 *
 * @param content - The content to validate
 * @param maxLength - Maximum allowed length (defaults to MAX_CONTENT_LENGTH)
 * @throws SecurityError if content is too long
 */
export function validateContentLength(
  content: string,
  maxLength: number = MAX_CONTENT_LENGTH
): void {
  if (content.length > maxLength) {
    throw new SecurityError(
      `Content exceeds maximum length of ${maxLength} characters`,
      ErrorCode.CONTENT_TOO_LONG
    );
  }
}

/**
 * Validate that input contains no null bytes
 *
 * @param input - The input to validate
 * @throws SecurityError if null bytes are found
 */
export function validateNoNullBytes(input: string): void {
  if (input.includes("\x00")) {
    throw new SecurityError(
      "Input contains null bytes",
      ErrorCode.INVALID_INPUT
    );
  }
}

/**
 * Validate that input contains no control characters (except \n, \r, \t)
 *
 * @param input - The input to validate
 * @throws SecurityError if control characters are found
 */
export function validateNoControlChars(input: string): void {
  const controlChars = input.split("").filter((char) => {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x00 && code <= 0x08) ||
      (code >= 0x0b && code <= 0x0c) ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    );
  });

  if (controlChars.length > 0) {
    throw new SecurityError(
      "Input contains invalid control characters",
      ErrorCode.INVALID_INPUT
    );
  }
}

// ============================================================================
// HTML Sanitization
// ============================================================================

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses isomorphic-dompurify with strict configuration
 *
 * @param html - The HTML content to sanitize
 * @returns The sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: false,
    });
  } catch (error) {
    throw new SecurityError(
      "Failed to sanitize HTML",
      ErrorCode.SANITIZATION_FAILED
    );
  }
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate a URL to ensure it uses safe protocols
 * Allows: http, https, mailto
 * Blocks: javascript, data, vbscript, file
 *
 * @param url - The URL to validate
 * @throws SecurityError if URL is unsafe
 */
export function validateUrl(url: string): void {
  const lowerUrl = url.toLowerCase().trim();

  // Block dangerous protocols
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "about:",
    "chrome:",
  ];

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      throw new SecurityError(
        "Unsafe URL protocol detected",
        ErrorCode.INVALID_INPUT
      );
    }
  }

  // If URL has a protocol, ensure it's safe
  if (lowerUrl.includes("://")) {
    const safeProtocols = ["http:", "https:", "mailto:", "ftp:", "ftps:"];
    const hasSafeProtocol = safeProtocols.some((p) => lowerUrl.startsWith(p));

    if (!hasSafeProtocol) {
      throw new SecurityError(
        "Unsafe URL protocol detected",
        ErrorCode.INVALID_INPUT
      );
    }
  }
}

/**
 * Validate a markdown URL
 * Only allows http and https protocols
 *
 * @param url - The URL to validate
 * @throws SecurityError if URL is unsafe
 */
export function validateMarkdownUrl(url: string): void {
  const lowerUrl = url.toLowerCase().trim();

  // Only allow http and https
  if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
    throw new SecurityError(
      "Only http and https URLs are allowed in markdown",
      ErrorCode.INVALID_INPUT
    );
  }

  // Double-check no dangerous protocols slipped through
  validateUrl(url);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Sanitize error messages to remove sensitive information
 * Removes:
 * - API keys (sk-..., key=..., 32+ char hex strings)
 * - File paths (Unix and Windows)
 * - Newlines (prevent log injection)
 *
 * @param message - The error message to sanitize
 * @returns The sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove API keys with sk- prefix
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]");

  // Remove key=value patterns with long values
  sanitized = sanitized.replace(/key=[a-zA-Z0-9]{32,}/gi, "[REDACTED]");

  // Remove 32+ character hex strings (likely keys/tokens)
  sanitized = sanitized.replace(/\b[a-f0-9]{32,}\b/gi, "[REDACTED]");

  // Remove DeepL API keys (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx)
  sanitized = sanitized.replace(
    /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-z]{2}\b/gi,
    "[REDACTED]"
  );

  // Remove DeepL API keys without suffix (legacy format)
  sanitized = sanitized.replace(
    /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
    "[REDACTED]"
  );

  // Remove Unix file paths
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-./~]+/g, "[path]");

  // Remove Windows file paths
  sanitized = sanitized.replace(/[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+/g, "[path]");
  sanitized = sanitized.replace(/\\[a-zA-Z0-9_\-\.\\]+/g, "[path]");

  // Remove newlines to prevent log injection
  sanitized = sanitized.replace(/[\r\n]+/g, " ");

  // If message is now empty or just whitespace, return generic message
  if (!sanitized.trim()) {
    return "An error occurred";
  }

  return sanitized;
}

/**
 * Create a safe error response
 * Standardizes error format and never includes stack traces
 *
 * @param error - The error to handle
 * @returns Object with sanitized error message and code
 */
export function createSafeError(error: unknown): {
  error: string;
  code: ErrorCode;
} {
  // Log the real error for debugging
  if (error instanceof Error) {
    console.error(`[Security] ${error.name}: ${error.message}`);
  } else {
    console.error(`[Security] ${String(error)}`);
  }

  // Extract message
  const message =
    error instanceof Error ? error.message : String(error);

  // Sanitize the message
  const sanitized = sanitizeErrorMessage(message);

  // Determine error code
  let code = ErrorCode.INVALID_INPUT;
  if (error instanceof SecurityError) {
    code = error.code;
  } else if (message.includes("size") || message.includes("too large")) {
    code = ErrorCode.FILE_TOO_LARGE;
  } else if (message.includes("length") || message.includes("too long")) {
    code = ErrorCode.CONTENT_TOO_LONG;
  } else if (message.includes("path")) {
    code = ErrorCode.INVALID_PATH;
  }

  return { error: sanitized, code };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Acquire a request slot
   * @throws SecurityError if rate limit is exceeded
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove requests outside the current window
    this.requests = this.requests.filter(
      (time) => now - time < this.windowMs
    );

    // Hard cap to prevent memory exhaustion from misconfigured large limits
    const MAX_ARRAY_SIZE = Math.max(this.maxRequests * 2, 1000);
    if (this.requests.length > MAX_ARRAY_SIZE) {
      this.requests = this.requests.slice(-this.maxRequests);
    }

    // Check if limit is exceeded
    if (this.requests.length >= this.maxRequests) {
      throw new SecurityError(
        "Rate limit exceeded",
        ErrorCode.RATE_LIMITED
      );
    }

    // Add current request
    this.requests.push(now);
  }
}

// ============================================================================
// Temporary File Handling
// ============================================================================

/**
 * Create a secure temporary file path
 * Generates a random suffix using crypto.randomBytes
 *
 * @param targetPath - The target file path
 * @returns A secure temporary path in the same directory
 */
export function createSecureTempPath(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const basename = path.basename(targetPath, ext);

  // Generate random suffix (8 bytes = 16 hex chars)
  const randomSuffix = crypto.randomBytes(8).toString("hex");

  const tempPath = path.join(dir, `${basename}_${randomSuffix}${ext}`);

  return tempPath;
}
