/**
 * Translation memory with persistent JSON storage, TTL, and LRU eviction
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { SecurityError, ErrorCode, createSecureTempPath } from "@dialectos/security";
import type { TranslationResult, TranslateOptions } from "./types.js";

export interface CachedTranslation {
  result: TranslationResult;
  expiresAt: number;
}

interface CacheEntry {
  result: TranslationResult;
  expiresAt: number;
  lastAccessedAt: number;
}

interface CacheFile {
  version: number;
  entries: Record<string, CacheEntry>;
}

export interface TranslationMemoryOptions {
  cacheDir?: string;
  maxSize?: number;
  defaultTtlMs?: number;
}

/**
 * Disk-persistence lifecycle (in-process only; nothing about it is stored).
 *
 *   idle          --set()-->              writing        (starts the persist loop)
 *   writing       --set()-->              writing-dirty  (coalesce: one more pass needed)
 *   writing-dirty --set()-->              writing-dirty
 *   writing-dirty --loop starts a pass--> writing
 *   writing       --pass done / failed--> idle
 *   writing-dirty --pass failed-->        idle           (dirty data retried on next set())
 *
 * Replaces the old `persistPromise` + `pendingPersist` flag pair, where
 * `pendingPersist === true` with no loop running was representable.
 */
export const PERSIST_STATES = ["idle", "writing", "writing-dirty"] as const;
export type PersistState = (typeof PERSIST_STATES)[number];

export const PERSIST_TRANSITIONS: Readonly<Record<PersistState, readonly PersistState[]>> = {
  idle: ["writing"],
  writing: ["writing-dirty", "idle"],
  "writing-dirty": ["writing-dirty", "writing", "idle"],
};

export class IllegalPersistTransitionError extends Error {
  constructor(
    readonly from: PersistState,
    readonly to: PersistState
  ) {
    super(`Illegal translation-memory persist transition: ${from} -> ${to}`);
    this.name = "IllegalPersistTransitionError";
  }
}

const CACHE_VERSION = 1;
const DEFAULT_MAX_SIZE = 10_000;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Persistent translation cache keyed by SHA-256 hash of request parameters.
 *
 * Features:
 * - Disk-backed JSON storage with atomic writes
 * - Per-entry TTL (default 30 days)
 * - LRU eviction when max size is exceeded
 * - Safe for concurrent reads/writes within a single process
 */
export class TranslationMemory {
  private readonly cachePath: string;
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly data = new Map<string, CacheEntry>();
  private persistState: PersistState = "idle";
  /** The running persist loop; non-null exactly when persistState !== "idle". */
  private persistPromise: Promise<void> | null = null;
  private persistGeneration = 0;

  constructor(options: TranslationMemoryOptions = {}) {
    const cacheDir = this.resolveCacheDir(options.cacheDir);
    this.cachePath = path.join(cacheDir, "translation-memory.json");
    const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    if (!Number.isInteger(maxSize)) {
      throw new Error("TranslationMemory maxSize must be an integer");
    }
    this.maxSize = maxSize;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.load();
  }

  private resolveCacheDir(override?: string): string {
    const dir = override ?? process.env.DIALECTOS_CACHE_DIR;
    if (dir) {
      if (dir.includes("..")) {
        throw new SecurityError(
          "Cache directory cannot contain path traversal sequences",
          ErrorCode.PATH_TRAVERSAL
        );
      }
      if (dir.includes("\x00")) {
        throw new SecurityError(
          "Cache directory cannot contain null bytes",
          ErrorCode.INVALID_INPUT
        );
      }
      return path.resolve(dir);
    }
    return path.join(os.homedir(), ".cache", "dialectos");
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.cachePath, "utf-8");
      const parsed = JSON.parse(raw) as CacheFile;
      if (parsed.version !== CACHE_VERSION) {
        return;
      }
      if (!parsed.entries || typeof parsed.entries !== "object" || Array.isArray(parsed.entries)) {
        return;
      }
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed.entries)) {
        if (
          entry &&
          typeof entry === "object" &&
          typeof entry.expiresAt === "number" &&
          entry.expiresAt > now &&
          entry.result &&
          typeof entry.result === "object"
        ) {
          this.data.set(key, entry);
        }
      }
    } catch {
      // File missing or corrupt — start fresh
    }
  }

  private async doPersist(): Promise<void> {
    const generation = this.persistGeneration;

    try {
      await fs.promises.mkdir(path.dirname(this.cachePath), { recursive: true });
    } catch {
      // Ignore mkdir errors
    }

    const payload: CacheFile = {
      version: CACHE_VERSION,
      entries: Object.fromEntries(this.data),
    };

    const tempPath = createSecureTempPath(this.cachePath);
    await fs.promises.writeFile(tempPath, JSON.stringify(payload), "utf-8");

    // Only rename if generation hasn't changed (clear() wasn't called during persist)
    if (generation === this.persistGeneration) {
      await fs.promises.rename(tempPath, this.cachePath);
    } else {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Compute a SHA-256 cache key from request parameters.
   * Includes text, sourceLang, targetLang, dialect, formality, and context.
   * Text is normalized (trimmed, whitespace collapsed) before hashing.
   */
  computeKey(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): string {
    const normalizedText = (text ?? "").trim().replace(/\s+/g, " ");
    const payload = JSON.stringify({
      text: normalizedText,
      sourceLang: (sourceLang ?? "").toLowerCase(),
      targetLang: (targetLang ?? "").toLowerCase(),
      dialect: options?.dialect,
      formality: options?.formality,
      context: options?.context,
    });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Retrieve a cached translation by key.
   * Returns null if missing or expired.
   * Expired entries are removed lazily (no immediate disk write).
   */
  async get(key: string): Promise<CachedTranslation | null> {
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }

    entry.lastAccessedAt = Date.now();
    // Return a shallow copy to prevent callers from mutating the cached object
    return { result: { ...entry.result }, expiresAt: entry.expiresAt };
  }

  /**
   * Store a translation result in the cache.
   * Evicts expired entries periodically (every 100 writes), then LRU if at capacity.
   * Serializes disk writes to prevent race condition corruption.
   */
  private writeCount = 0;

  async set(key: string, result: TranslationResult, ttlMs?: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);

    // Evict expired entries periodically (every 100 writes) to amortize cost
    this.writeCount++;
    if (this.writeCount % 100 === 0) {
      for (const [k, v] of this.data) {
        if (v.expiresAt <= now) {
          this.data.delete(k);
        }
      }
    }

    // LRU eviction if at capacity (maxSize <= 0 disables eviction / allows unbounded)
    if (this.maxSize > 0 && this.data.size >= this.maxSize && !this.data.has(key)) {
      let lruKey: string | null = null;
      let lruTime = Infinity;
      for (const [k, v] of this.data) {
        if (v.lastAccessedAt < lruTime) {
          lruTime = v.lastAccessedAt;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.data.delete(lruKey);
      }
    }

    this.data.set(key, {
      result,
      expiresAt,
      lastAccessedAt: now,
    });

    await this.enqueuePersist();
  }

  /** The single writer of `persistState`; refuses illegal moves. */
  private movePersistState(to: PersistState): void {
    if (!PERSIST_TRANSITIONS[this.persistState].includes(to)) {
      throw new IllegalPersistTransitionError(this.persistState, to);
    }
    this.persistState = to;
  }

  /** Current disk-persistence state (for diagnostics/tests). */
  getPersistState(): PersistState {
    return this.persistState;
  }

  /**
   * Request a persist. Resolves once a disk write that includes the caller's
   * change has completed (or failed and been swallowed).
   */
  private async enqueuePersist(): Promise<void> {
    if (this.persistState !== "idle" && this.persistPromise) {
      // Coalesce into the running loop; it will make one more pass that
      // includes this change before it resolves.
      this.movePersistState("writing-dirty");
      await this.persistPromise;
      return;
    }

    this.movePersistState("writing");
    this.persistPromise = this.runPersistLoop();
    await this.persistPromise;
  }

  private async runPersistLoop(): Promise<void> {
    try {
      await this.doPersist();
      while (this.persistState === "writing-dirty") {
        this.movePersistState("writing");
        await this.doPersist();
      }
    } catch {
      // Persist failure should not deadlock future writes.
      // In-memory cache continues to work; disk will retry on next write.
    } finally {
      this.movePersistState("idle");
      this.persistPromise = null;
    }
  }

  /**
   * Clear all cached entries and delete the persistent file.
   */
  async clear(): Promise<void> {
    this.data.clear();
    this.persistGeneration++;
    try {
      await fs.promises.unlink(this.cachePath);
    } catch {
      // Ignore missing file
    }
  }

  /**
   * Return the number of entries currently in memory.
   */
  getSize(): number {
    return this.data.size;
  }
}
