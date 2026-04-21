import { promises as fs, constants } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const CURRENT_CHECKPOINT_SCHEMA_VERSION = 1;

export interface TranslationCheckpoint {
  schemaVersion: number;
  sourcePath: string;
  sourceHash?: string;
  totalSections: number;
  translatedByIndex: Record<number, string>;
}

function isValidCheckpoint(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === "object" && !Array.isArray(obj);
}

function sanitizeCheckpoint(parsed: Record<string, unknown>): TranslationCheckpoint | null {
  // Prototype pollution protection
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  if (dangerousKeys.some((key) => Object.prototype.hasOwnProperty.call(parsed, key))) {
    return null;
  }

  const sourcePath = parsed.sourcePath;
  if (typeof sourcePath !== "string" || sourcePath.length === 0) {
    return null;
  }

  const schemaVersion =
    typeof parsed.schemaVersion === "number"
      ? parsed.schemaVersion
      : 0; // Pre-versioning checkpoints default to 0

  const totalSections =
    typeof parsed.totalSections === "number" && !isNaN(parsed.totalSections)
      ? parsed.totalSections
      : 0;

  const sourceHash =
    typeof parsed.sourceHash === "string" ? parsed.sourceHash : undefined;

  const translatedByIndex =
    isValidCheckpoint(parsed.translatedByIndex)
      ? (parsed.translatedByIndex as Record<number, string>)
      : {};

  return {
    schemaVersion,
    sourcePath,
    sourceHash,
    totalSections,
    translatedByIndex,
  };
}

/**
 * Migrate an older checkpoint schema to the current version.
 * Returns null if the checkpoint is too old to migrate.
 */
export function migrateCheckpoint(
  data: TranslationCheckpoint
): TranslationCheckpoint | null {
  if (data.schemaVersion === CURRENT_CHECKPOINT_SCHEMA_VERSION) {
    return data;
  }

  if (data.schemaVersion > CURRENT_CHECKPOINT_SCHEMA_VERSION) {
    // Future schema version — cannot safely downgrade
    return null;
  }

  // Schema version 0 → 1: add schemaVersion field (already defaulted during sanitization)
  if (data.schemaVersion === 0) {
    return {
      ...data,
      schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
    };
  }

  // Unsupported old version — cannot migrate safely
  return null;
}

export async function loadCheckpoint(path: string): Promise<TranslationCheckpoint | null> {
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = JSON.parse(raw);

    const sanitized = sanitizeCheckpoint(parsed);
    if (!sanitized) {
      console.warn(`Checkpoint at ${path} is missing required fields or contains dangerous keys — ignoring`);
      return null;
    }

    const migrated = migrateCheckpoint(sanitized);
    if (!migrated) {
      console.warn(
        `Checkpoint at ${path} uses unsupported schema version ${sanitized.schemaVersion} — ignoring`
      );
      return null;
    }

    return migrated;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`Failed to load checkpoint at ${path}: ${code || error}`);
    }
    return null;
  }
}

function createSecureTempPath(targetPath: string): string {
  const dir = dirname(targetPath);
  const suffix = randomBytes(8).toString("hex");
  return join(dir, `.checkpoint_${suffix}.tmp`);
}

/**
 * Atomically save a checkpoint using write-to-temp + rename.
 * Uses O_EXCL (wx) to prevent race conditions from concurrent writes.
 */
export async function saveCheckpoint(path: string, data: TranslationCheckpoint): Promise<void> {
  const payload: TranslationCheckpoint = {
    ...data,
    schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
  };
  const tempPath = createSecureTempPath(path);
  const content = JSON.stringify(payload, null, 2);
  try {
    await fs.writeFile(tempPath, content, { encoding: "utf-8", flag: "wx", mode: 0o600 });
    await fs.rename(tempPath, path);
  } catch (error) {
    // Best-effort cleanup of temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Remove checkpoint files older than maxAgeMs from a directory.
 * Only removes files matching *.checkpoint.json to avoid accidents.
 */
export async function pruneStaleCheckpoints(
  dir: string,
  maxAgeMs: number
): Promise<number> {
  const now = Date.now();
  let removed = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".checkpoint.json")) {
        continue;
      }
      const fullPath = join(dir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtime.getTime() > maxAgeMs) {
          await fs.unlink(fullPath);
          removed++;
        }
      } catch {
        // Ignore per-file errors and continue pruning
      }
    }
  } catch {
    // Ignore directory read errors (e.g., directory doesn't exist)
  }

  return removed;
}

export function hashSource(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
