/**
 * Translation memory with persistent JSON storage, TTL, and LRU eviction
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { SecurityError, ErrorCode, createSecureTempPath } from "@espanol/security";
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

  constructor(options: TranslationMemoryOptions = {}) {
    const cacheDir = this.resolveCacheDir(options.cacheDir);
    this.cachePath = path.join(cacheDir, "translation-memory.json");
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
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
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed.entries)) {
        if (entry.expiresAt > now) {
          this.data.set(key, entry);
        }
      }
    } catch {
      // File missing or corrupt — start fresh
    }
  }

  private async persist(): Promise<void> {
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
    await fs.promises.rename(tempPath, this.cachePath);
  }

  /**
   * Compute a SHA-256 cache key from request parameters.
   * Includes text, sourceLang, targetLang, dialect, formality, and context.
   */
  computeKey(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): string {
    const payload = JSON.stringify({
      text,
      sourceLang: sourceLang.toLowerCase(),
      targetLang: targetLang.toLowerCase(),
      dialect: options?.dialect,
      formality: options?.formality,
      context: options?.context,
    });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Retrieve a cached translation by key.
   * Returns null if missing or expired.
   */
  async get(key: string): Promise<CachedTranslation | null> {
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      await this.persist();
      return null;
    }

    entry.lastAccessedAt = Date.now();
    return { result: entry.result, expiresAt: entry.expiresAt };
  }

  /**
   * Store a translation result in the cache.
   * Evicts expired entries first, then LRU if still at capacity.
   */
  async set(key: string, result: TranslationResult, ttlMs?: number): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);

    // Evict expired entries first
    for (const [k, v] of this.data) {
      if (v.expiresAt <= now) {
        this.data.delete(k);
      }
    }

    // LRU eviction if at capacity
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
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

    await this.persist();
  }

  /**
   * Clear all cached entries and delete the persistent file.
   */
  async clear(): Promise<void> {
    this.data.clear();
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
