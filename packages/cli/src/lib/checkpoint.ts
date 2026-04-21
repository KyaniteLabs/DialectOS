import { promises as fs, constants } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export interface TranslationCheckpoint {
  sourcePath: string;
  sourceHash?: string;
  totalSections: number;
  translatedByIndex: Record<number, string>;
}

export async function loadCheckpoint(path: string): Promise<TranslationCheckpoint | null> {
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed.sourcePath) {
      console.warn(`Checkpoint at ${path} is missing required fields — ignoring`);
      return null;
    }
    // Prototype pollution protection: reject if any key is a dangerous prototype property
    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    if (dangerousKeys.some((key) => key in parsed)) {
      console.warn(`Checkpoint at ${path} contains dangerous keys — ignoring`);
      return null;
    }
    return {
      sourcePath: String(parsed.sourcePath),
      sourceHash: parsed.sourceHash ? String(parsed.sourceHash) : undefined,
      totalSections: Number(parsed.totalSections) || 0,
      translatedByIndex: typeof parsed.translatedByIndex === "object" && parsed.translatedByIndex !== null
        ? parsed.translatedByIndex as Record<number, string>
        : {},
    };
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
  const tempPath = createSecureTempPath(path);
  const content = JSON.stringify(data, null, 2);
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

export function hashSource(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
