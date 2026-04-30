import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkTranslationEngine } from "../engine.js";
import { TranslationMemory } from "../../translation-memory.js";
import type { BulkTranslationItem, TranslationProvider, TranslationResult } from "../../types.js";

function createMockProvider(
  results: Map<string, TranslationResult>,
  failTexts?: Set<string>
): TranslationProvider {
  return {
    name: "mock",
    async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      if (failTexts?.has(text)) {
        throw new Error(`Mock failure for: ${text}`);
      }
      const result = results.get(text);
      if (result) return result;
      return { translatedText: `translated:${text}` };
    },
  };
}

function createFreshCache(): TranslationMemory {
  // Use a temporary in-memory cache that doesn't persist to disk
  return new TranslationMemory({
    cacheDir: `/tmp/dialectos-test-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

describe("BulkTranslationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates empty array immediately", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache() });
    const provider = createMockProvider(new Map());
    const result = await engine.translate([], provider);

    expect(result.successes).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.totalLatencyMs).toBe(0);
  });

  it("translates single item successfully", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache() });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(1);
    expect(result.successes[0].item.id).toBe("1");
    expect(result.successes[0].result.translatedText).toBe("translated:Hello");
    expect(result.failures).toHaveLength(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.apiCalls).toBe(1);
    expect(result.cacheHits).toBe(0);
  });

  it("deduplicates identical source texts", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache() });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
      { id: "2", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
      { id: "3", sourceText: "World", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(3);
    expect(result.apiCalls).toBe(2); // "Hello" once, "World" once
    expect(result.cacheHits).toBe(0);
  });

  it("uses cache on second run with same engine", async () => {
    const cache = createFreshCache();
    const engine = new BulkTranslationEngine({ cache });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
    ];

    // First run
    const result1 = await engine.translate(items, provider);
    expect(result1.cacheHits).toBe(0);
    expect(result1.apiCalls).toBe(1);

    // Second run with same engine (same cache)
    const result2 = await engine.translate(items, provider);
    expect(result2.cacheHits).toBe(1);
    expect(result2.apiCalls).toBe(0);
  });

  it("retries failed items and collects in DLQ after exhaustion", async () => {
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxRetries: 2,
      retryDelayMs: 10,
    });
    const failTexts = new Set(["FailMe"]);
    const provider = createMockProvider(new Map(), failTexts);
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "FailMe", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: "Hello", sourceLang: "en", targetLang: "es" },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(1);
    expect(result.successes[0].item.id).toBe("2");
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].item.id).toBe("1");
    expect(result.failures[0].retryCount).toBe(2);
    expect(result.allSucceeded).toBe(false);
  });

  it("reports progress correctly", async () => {
    const progressEvents: Array<{ total: number; completed: number; succeeded: number }> = [];
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxConcurrency: 2,
      onProgress: (p) => {
        progressEvents.push({ total: p.total, completed: p.completed, succeeded: p.succeeded });
      },
    });

    const results = new Map<string, TranslationResult>([
      ["A", { translatedText: "a" }],
      ["B", { translatedText: "b" }],
      ["C", { translatedText: "c" }],
    ]);
    const provider = createMockProvider(results);
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: "B", sourceLang: "en", targetLang: "es" },
      { id: "3", sourceText: "C", sourceLang: "en", targetLang: "es" },
    ];

    await engine.translate(items, provider);

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].total).toBe(3);
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent.completed).toBe(3);
    expect(lastEvent.succeeded).toBe(3);
  });

  it("checkpoint saves and resumes correctly", async () => {
    const checkpointPath = `/tmp/test-bulk-checkpoint-${Date.now()}.json`;
    const cache = createFreshCache();
    try {
      const engine1 = new BulkTranslationEngine({
        cache,
        checkpointPath,
        checkpointInterval: 1,
      });

      const results = new Map<string, TranslationResult>([
        ["A", { translatedText: "a" }],
      ]);
      const provider = createMockProvider(results);
      const items: BulkTranslationItem[] = [
        { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      ];

      const result1 = await engine1.translate(items, provider);
      expect(result1.successes).toHaveLength(1);
      expect(result1.successes[0].result.translatedText).toBe("a");

      // Create new engine with fresh cache but same checkpoint
      // The item was completed, so checkpoint should restore it directly
      const engine2 = new BulkTranslationEngine({ cache: createFreshCache(), checkpointPath });
      const result2 = await engine2.translate(items, provider);

      // Should be resumed from checkpoint — no API call, no cache hit needed
      expect(result2.successes).toHaveLength(1);
      expect(result2.successes[0].result.translatedText).toBe("a");
      expect(result2.cacheHits).toBe(0);
      expect(result2.apiCalls).toBe(0);
    } finally {
      try {
        const fs = await import("node:fs");
        fs.unlinkSync(checkpointPath);
      } catch {
        // ignore
      }
    }
  });
});
