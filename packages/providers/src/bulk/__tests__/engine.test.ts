import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkTranslationEngine } from "../engine.js";
import { TranslationMemory } from "../../translation-memory.js";
import type { BulkTranslationItem, TranslationProvider, TranslationResult } from "../../types.js";

function createMockProvider(
  results: Map<string, TranslationResult>,
  failTexts?: Set<string>,
  delayMs?: number
): TranslationProvider {
  return {
    name: "mock",
    async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
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

  it("bypasses cache when useCache is false", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache(), useCache: false });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
    ];

    const result1 = await engine.translate(items, provider);
    expect(result1.cacheHits).toBe(0);
    expect(result1.apiCalls).toBe(1);

    const result2 = await engine.translate(items, provider);
    expect(result2.cacheHits).toBe(0);
    expect(result2.apiCalls).toBe(1);
  });

  it("does not retry when maxRetries is 0", async () => {
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxRetries: 0,
      retryDelayMs: 10,
    });
    const failTexts = new Set(["FailMe"]);
    const provider = createMockProvider(new Map(), failTexts);
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "FailMe", sourceLang: "en", targetLang: "es" },
    ];

    const result = await engine.translate(items, provider);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].retryCount).toBe(0);
    expect(result.allSucceeded).toBe(false);
  });

  it("marks allSucceeded false when every item fails", async () => {
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxRetries: 1,
      retryDelayMs: 10,
    });
    const failTexts = new Set(["A", "B"]);
    const provider = createMockProvider(new Map(), failTexts);
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: "B", sourceLang: "en", targetLang: "es" },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(0);
    expect(result.failures).toHaveLength(2);
    expect(result.allSucceeded).toBe(false);
    expect(result.apiCalls).toBe(0);
  });

  it("normalizes whitespace for deduplication", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache() });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: " Hello ", sourceLang: "en", targetLang: "es" },
      { id: "3", sourceText: "Hello  World", sourceLang: "en", targetLang: "es" },
      { id: "4", sourceText: "Hello World", sourceLang: "en", targetLang: "es" },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(4);
    expect(result.apiCalls).toBe(2); // "Hello" deduped, "Hello World" deduped
  });

  it("respects maxConcurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const provider: TranslationProvider = {
      name: "mock",
      async translate() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 50));
        inFlight--;
        return { translatedText: "ok" };
      },
    };

    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxConcurrency: 2,
    });

    const items: BulkTranslationItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      sourceText: `Text${i + 1}`,
      sourceLang: "en",
      targetLang: "es",
    }));

    await engine.translate(items, provider);

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("calls onCheckpoint when checkpoint is saved", async () => {
    const checkpointPath = `/tmp/test-bulk-checkpoint-${Date.now()}.json`;
    const checkpoints: unknown[] = [];

    try {
      const engine = new BulkTranslationEngine({
        cache: createFreshCache(),
        checkpointPath,
        checkpointInterval: 1,
        onCheckpoint: (cp) => checkpoints.push(cp),
      });

      const provider = createMockProvider(new Map([["A", { translatedText: "a" }]]));
      const items: BulkTranslationItem[] = [
        { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      ];

      await engine.translate(items, provider);

      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
      const cp = checkpoints[checkpoints.length - 1] as { version: number; totalItems: number };
      expect(cp.version).toBe(2);
      expect(cp.totalItems).toBe(1);
    } finally {
      try {
        const fs = await import("node:fs");
        fs.unlinkSync(checkpointPath);
      } catch {
        // ignore
      }
    }
  });

  it("ignores invalid checkpoint files gracefully", async () => {
    const checkpointPath = `/tmp/test-bulk-checkpoint-${Date.now()}.json`;

    try {
      const fs = await import("node:fs");
      fs.writeFileSync(checkpointPath, "not-valid-json", "utf-8");

      const engine = new BulkTranslationEngine({
        cache: createFreshCache(),
        checkpointPath,
      });

      const provider = createMockProvider(new Map([["A", { translatedText: "a" }]]));
      const items: BulkTranslationItem[] = [
        { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      ];

      const result = await engine.translate(items, provider);

      expect(result.successes).toHaveLength(1);
      expect(result.apiCalls).toBe(1);
    } finally {
      try {
        const fs = await import("node:fs");
        fs.unlinkSync(checkpointPath);
      } catch {
        // ignore
      }
    }
  });

  it("resumes partial checkpoint (some items done, some pending)", async () => {
    const checkpointPath = `/tmp/test-bulk-checkpoint-${Date.now()}.json`;

    try {
      // Pre-seed checkpoint with item "1" completed, item "2" pending
      const fs = await import("node:fs");
      fs.writeFileSync(
        checkpointPath,
        JSON.stringify({
          version: 2,
          createdAt: new Date().toISOString(),
          completedIds: ["1"],
          completedResults: [{ id: "1", result: { translatedText: "checkpoint-a" } }],
          failedItems: [],
          totalItems: 2,
        }),
        "utf-8"
      );

      const engine = new BulkTranslationEngine({
        cache: createFreshCache(),
        checkpointPath,
      });

      const provider = createMockProvider(new Map([["B", { translatedText: "b" }]]));
      const items: BulkTranslationItem[] = [
        { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
        { id: "2", sourceText: "B", sourceLang: "en", targetLang: "es" },
      ];

      const result = await engine.translate(items, provider);

      expect(result.successes).toHaveLength(2);
      expect(result.successes[0].result.translatedText).toBe("checkpoint-a");
      expect(result.successes[1].result.translatedText).toBe("b");
      expect(result.apiCalls).toBe(1); // Only "B" needed a call
    } finally {
      try {
        const fs = await import("node:fs");
        fs.unlinkSync(checkpointPath);
      } catch {
        // ignore
      }
    }
  });

  it("reports estimatedRemainingMs in progress events", async () => {
    const progressEvents: Array<{ estimatedRemainingMs: number | null }> = [];
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      maxConcurrency: 1,
      onProgress: (p) => {
        progressEvents.push({ estimatedRemainingMs: p.estimatedRemainingMs });
      },
    });

    // Provider with consistent ~50ms delay
    const provider = createMockProvider(new Map(), undefined, 50);
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: "B", sourceLang: "en", targetLang: "es" },
    ];

    await engine.translate(items, provider);

    // Progress is emitted after each completion, so first event already has latency data
    const estimates = progressEvents.map((e) => e.estimatedRemainingMs);
    expect(estimates.every((e) => e !== null && e >= 0)).toBe(true);
  });

  it("handles onProgress callback that throws without failing translation", async () => {
    let callCount = 0;
    const engine = new BulkTranslationEngine({
      cache: createFreshCache(),
      onProgress: () => {
        callCount++;
        if (callCount === 1) throw new Error("progress boom");
      },
    });

    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "A", sourceLang: "en", targetLang: "es" },
    ];

    const result = await engine.translate(items, provider);

    expect(result.successes).toHaveLength(1);
    expect(callCount).toBe(1);
  });

  it("deduplicates items with same text even if languages differ (uses representative)", async () => {
    const engine = new BulkTranslationEngine({ cache: createFreshCache() });
    const provider = createMockProvider(new Map());
    const items: BulkTranslationItem[] = [
      { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es" },
      { id: "2", sourceText: "Hello", sourceLang: "en", targetLang: "fr" },
    ];

    const result = await engine.translate(items, provider);

    // Both items succeed but only one API call due to sourceText dedup
    expect(result.successes).toHaveLength(2);
    expect(result.apiCalls).toBe(1);
    // The representative item (first pending) drives the translation call
    expect(result.successes[0].result.translatedText).toBe("translated:Hello");
    expect(result.successes[1].result.translatedText).toBe("translated:Hello");
  });
});
