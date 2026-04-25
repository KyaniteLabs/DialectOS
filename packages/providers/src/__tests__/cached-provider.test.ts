/**
 * Tests for CachedProvider and TranslationMemory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationMemory } from "../translation-memory.js";
import { CachedProvider } from "../cached-provider.js";
import { ProviderRegistry } from "../registry.js";
import type { TranslationProvider, TranslationResult } from "../types.js";

describe("TranslationMemory", () => {
  let memory: TranslationMemory;

  beforeEach(() => {
    memory = new TranslationMemory({
      cacheDir: `/tmp/dialectos-test-${Date.now()}`,
      maxSize: 100,
    });
  });

  afterEach(async () => {
    await memory.clear();
  });

  it("should compute consistent SHA-256 keys", () => {
    const key1 = memory.computeKey("hello", "en", "es", { dialect: "es-MX" });
    const key2 = memory.computeKey("hello", "en", "es", { dialect: "es-MX" });
    const key3 = memory.computeKey("hello", "en", "es", { dialect: "es-AR" });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should include formality and context in key", () => {
    const base = memory.computeKey("hello", "en", "es");
    const withFormality = memory.computeKey("hello", "en", "es", { formality: "formal" });
    const withContext = memory.computeKey("hello", "en", "es", { context: "greeting" });

    expect(base).not.toBe(withFormality);
    expect(base).not.toBe(withContext);
    expect(withFormality).not.toBe(withContext);
  });

  it("should store and retrieve translations", async () => {
    const result: TranslationResult = { translatedText: "hola" };
    const key = memory.computeKey("hello", "en", "es");

    await memory.set(key, result);
    const cached = await memory.get(key);

    expect(cached).not.toBeNull();
    expect(cached!.result.translatedText).toBe("hola");
  });

  it("should return null for missing keys", async () => {
    const cached = await memory.get("nonexistent-key");
    expect(cached).toBeNull();
  });

  it("should return null for expired entries", async () => {
    const result: TranslationResult = { translatedText: "hola" };
    const key = memory.computeKey("hello", "en", "es");

    await memory.set(key, result, -1); // already expired
    const cached = await memory.get(key);

    expect(cached).toBeNull();
  });

  it("should clear all entries", async () => {
    await memory.set("key1", { translatedText: "a" });
    await memory.clear();

    expect(await memory.get("key1")).toBeNull();
    expect(memory.getSize()).toBe(0);
  });

  it("should evict oldest entries when max size is exceeded", async () => {
    const smallMemory = new TranslationMemory({
      cacheDir: `/tmp/dialectos-test-lru-${Date.now()}`,
      maxSize: 3,
    });

    await smallMemory.set("key1", { translatedText: "a" });
    await new Promise((r) => setTimeout(r, 5));
    await smallMemory.set("key2", { translatedText: "b" });
    await new Promise((r) => setTimeout(r, 5));
    await smallMemory.set("key3", { translatedText: "c" });

    // Access key1 to make it more recent
    await smallMemory.get("key1");

    await smallMemory.set("key4", { translatedText: "d" });

    expect(await smallMemory.get("key1")).not.toBeNull();
    expect(await smallMemory.get("key2")).toBeNull(); // least recently used
    expect(await smallMemory.get("key3")).not.toBeNull();
    expect(await smallMemory.get("key4")).not.toBeNull();

    await smallMemory.clear();
  });

  it("should persist and reload across instances", async () => {
    const cacheDir = `/tmp/dialectos-test-reload-${Date.now()}`;
    const mem1 = new TranslationMemory({ cacheDir, maxSize: 100 });

    const result: TranslationResult = { translatedText: "hola", detectedSourceLang: "en" };
    const key = mem1.computeKey("hello", "en", "es");
    await mem1.set(key, result);

    // Simulate new process by creating a new instance
    const mem2 = new TranslationMemory({ cacheDir, maxSize: 100 });
    const cached = await mem2.get(key);

    expect(cached).not.toBeNull();
    expect(cached!.result.translatedText).toBe("hola");
    expect(cached!.result.detectedSourceLang).toBe("en");

    await mem1.clear();
    await mem2.clear();
  });

  it("should reject cache dirs with path traversal", () => {
    expect(() => {
      new TranslationMemory({ cacheDir: "/tmp/../etc" });
    }).toThrow("path traversal");
  });

  it("should reject cache dirs with null bytes", () => {
    expect(() => {
      new TranslationMemory({ cacheDir: "/tmp/foo\x00bar" });
    }).toThrow("null bytes");
  });
});

describe("CachedProvider", () => {
  let memory: TranslationMemory;
  let mockProvider: TranslationProvider;

  beforeEach(() => {
    memory = new TranslationMemory({
      cacheDir: `/tmp/dialectos-test-provider-${Date.now()}`,
      maxSize: 100,
    });
    mockProvider = {
      name: "mock",
      translate: vi.fn().mockResolvedValue({ translatedText: "hola" }),
    };
  });

  afterEach(async () => {
    await memory.clear();
  });

  it("should delegate to provider on cache miss and store result", async () => {
    const cached = new CachedProvider(mockProvider, memory);

    const result = await cached.translate("hello", "en", "es");

    expect(result.translatedText).toBe("hola");
    expect(mockProvider.translate).toHaveBeenCalledTimes(1);
    expect(mockProvider.translate).toHaveBeenCalledWith("hello", "en", "es", undefined);
  });

  it("should return cached result on hit without calling provider", async () => {
    const cached = new CachedProvider(mockProvider, memory);

    await cached.translate("hello", "en", "es");
    const stats1 = cached.getCacheStats();
    expect(stats1.hits).toBe(0);
    expect(stats1.misses).toBe(1);

    const result2 = await cached.translate("hello", "en", "es");
    const stats2 = cached.getCacheStats();
    expect(result2.translatedText).toBe("hola");
    expect(stats2.hits).toBe(1);
    expect(stats2.misses).toBe(1);
    expect(mockProvider.translate).toHaveBeenCalledTimes(1);
  });

  it("should pass through getCapabilities", () => {
    const cached = new CachedProvider(mockProvider, memory);
    // Falls back to default capabilities when inner provider has none
    const fallbackCaps = cached.getCapabilities();
    expect(fallbackCaps.name).toBe("mock");
    expect(fallbackCaps.dialectHandling).toBe("none");

    const providerWithCaps: TranslationProvider = {
      ...mockProvider,
      getCapabilities: () => ({
        name: "mock",
        displayName: "Mock",
        needsApiKey: false,
        supportsFormality: true,
        supportsContext: false,
        supportsDialect: true,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 5000,
        dialectHandling: "semantic",
      }),
    };

    const cached2 = new CachedProvider(providerWithCaps, memory);
    const caps = cached2.getCapabilities();
    expect(caps).toBeDefined();
    expect(caps.name).toBe("mock");
    expect(caps.dialectHandling).toBe("semantic");
  });

  it("should use different cache keys for different options", async () => {
    const cached = new CachedProvider(mockProvider, memory);

    await cached.translate("hello", "en", "es", { dialect: "es-MX" });
    await cached.translate("hello", "en", "es", { dialect: "es-AR" });

    expect(mockProvider.translate).toHaveBeenCalledTimes(2);
  });

  it("should expose name from wrapped provider", () => {
    const cached = new CachedProvider(mockProvider, memory);
    expect(cached.name).toBe("mock");
  });
});

describe("ProviderRegistry with cache", () => {
  it("should wrap providers with CachedProvider when useCache is enabled", async () => {
    const cacheDir = `/tmp/dialectos-test-registry-${Date.now()}`;
    const cache = new TranslationMemory({ cacheDir, maxSize: 100 });
    const registry = new ProviderRegistry(5, 60000, true, cache);

    const mockProvider: TranslationProvider = {
      name: "mock",
      translate: vi.fn().mockResolvedValue({ translatedText: "hola" }),
    };

    registry.register(mockProvider);

    const provider = registry.get("mock");
    const result = await provider.translate("hello", "en", "es");

    expect(result.translatedText).toBe("hola");
    expect(mockProvider.translate).toHaveBeenCalledTimes(1);

    // Second call should hit cache
    await provider.translate("hello", "en", "es");
    expect(mockProvider.translate).toHaveBeenCalledTimes(1);

    await cache.clear();
  });

  it("should not cache when useCache is false in constructor", async () => {
    const registry = new ProviderRegistry(5, 60000, false);

    const mockProvider: TranslationProvider = {
      name: "mock",
      translate: vi.fn().mockResolvedValue({ translatedText: "hola" }),
    };

    registry.register(mockProvider);

    const provider = registry.get("mock");
    await provider.translate("hello", "en", "es");
    await provider.translate("hello", "en", "es");

    expect(mockProvider.translate).toHaveBeenCalledTimes(2);
  });

  it("should allow per-provider cache override", async () => {
    const cacheDir = `/tmp/dialectos-test-override-${Date.now()}`;
    const cache = new TranslationMemory({ cacheDir, maxSize: 100 });
    const registry = new ProviderRegistry(5, 60000, true, cache);

    const cachedProvider: TranslationProvider = {
      name: "cached",
      translate: vi.fn().mockResolvedValue({ translatedText: "hola" }),
    };
    const uncachedProvider: TranslationProvider = {
      name: "uncached",
      translate: vi.fn().mockResolvedValue({ translatedText: "adios" }),
    };

    registry.register(cachedProvider);
    registry.register(uncachedProvider, false);

    const cached = registry.get("cached");
    const uncached = registry.get("uncached");

    await cached.translate("hello", "en", "es");
    await cached.translate("hello", "en", "es");
    expect(cachedProvider.translate).toHaveBeenCalledTimes(1);

    await uncached.translate("bye", "en", "es");
    await uncached.translate("bye", "en", "es");
    expect(uncachedProvider.translate).toHaveBeenCalledTimes(2);

    await cache.clear();
  });
});
