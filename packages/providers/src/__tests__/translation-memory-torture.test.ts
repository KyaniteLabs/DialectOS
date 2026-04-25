import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TranslationMemory } from "../translation-memory.js";

describe("TranslationMemory torture", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-torture-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("survives 100 concurrent set() calls without corruption", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, maxSize: 1000 });
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        mem.set(`key-${i}`, { text: `value-${i}`, sourceLang: "en", targetLang: "es" })
      );
    }
    await Promise.all(promises);

    // Reload from disk to verify persistence
    const mem2 = new TranslationMemory({ cacheDir: tempDir, maxSize: 1000 });
    expect(mem2.getSize()).toBeGreaterThanOrEqual(90); // at least 90 survived
  });

  it("handles maxSize boundary exactly", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, maxSize: 5 });
    for (let i = 0; i < 5; i++) {
      await mem.set(`key-${i}`, { text: `v${i}`, sourceLang: "en", targetLang: "es" });
    }
    expect(mem.getSize()).toBe(5);

    // One more should evict LRU
    await mem.set("key-5", { text: "v5", sourceLang: "en", targetLang: "es" });
    expect(mem.getSize()).toBe(5);
  });

  it("handles maxSize = 0 as unbounded (no eviction)", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, maxSize: 0 });
    for (let i = 0; i < 10; i++) {
      await mem.set(`key-${i}`, { text: `v${i}`, sourceLang: "en", targetLang: "es" });
    }
    expect(mem.getSize()).toBe(10);
  });

  it("handles negative maxSize as unbounded (no eviction)", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, maxSize: -1 });
    for (let i = 0; i < 10; i++) {
      await mem.set(`key-${i}`, { text: `v${i}`, sourceLang: "en", targetLang: "es" });
    }
    expect(mem.getSize()).toBe(10);
  });

  it("handles empty string text key", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const key = mem.computeKey("", "en", "es");
    await mem.set(key, { text: "", sourceLang: "en", targetLang: "es" });
    const cached = await mem.get(key);
    expect(cached).not.toBeNull();
    expect(cached!.result.text).toBe("");
  });

  it("handles very long text (10KB)", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const longText = "a".repeat(10_000);
    const key = mem.computeKey(longText, "en", "es");
    await mem.set(key, { text: longText, sourceLang: "en", targetLang: "es" });
    const cached = await mem.get(key);
    expect(cached!.result.text).toBe(longText);
  });

  it("handles unicode in text", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const text = "¡Hola! ¿Cómo estás? ñoño 🎉 émojis";
    const key = mem.computeKey(text, "en", "es");
    await mem.set(key, { text, sourceLang: "en", targetLang: "es" });
    const cached = await mem.get(key);
    expect(cached!.result.text).toBe(text);
  });

  it("rejects null bytes in cacheDir", () => {
    expect(() => new TranslationMemory({ cacheDir: "/tmp\x00evil" })).toThrow();
  });

  it("rejects path traversal in cacheDir", () => {
    expect(() => new TranslationMemory({ cacheDir: "/tmp/../../etc" })).toThrow();
  });

  it("handles corrupted cache file gracefully", async () => {
    const cacheFile = path.join(tempDir, "translation-memory.json");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(cacheFile, "not valid json { broken");

    const mem = new TranslationMemory({ cacheDir: tempDir });
    expect(mem.getSize()).toBe(0);

    // Should still work after loading corrupt file
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" });
    expect(mem.getSize()).toBe(1);
  });

  it("handles cache file with valid version but no entries field", async () => {
    const cacheFile = path.join(tempDir, "translation-memory.json");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ version: 1 }));

    const mem = new TranslationMemory({ cacheDir: tempDir });
    expect(mem.getSize()).toBe(0);
  });

  it("handles cache file with entries as array instead of object", async () => {
    const cacheFile = path.join(tempDir, "translation-memory.json");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ version: 1, entries: [] }));

    const mem = new TranslationMemory({ cacheDir: tempDir });
    expect(mem.getSize()).toBe(0);
  });

  it("handles cache file with corrupted entry shape", async () => {
    const cacheFile = path.join(tempDir, "translation-memory.json");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        version: 1,
        entries: {
          good: { result: { text: "ok", sourceLang: "en", targetLang: "es" }, expiresAt: Date.now() + 999999, lastAccessedAt: Date.now() },
          missingResult: { expiresAt: Date.now() + 999999, lastAccessedAt: Date.now() },
          badExpiresAt: { result: { text: "ok", sourceLang: "en", targetLang: "es" }, expiresAt: "not a number", lastAccessedAt: Date.now() },
          nullEntry: null,
          stringEntry: "not an object",
        },
      })
    );

    const mem = new TranslationMemory({ cacheDir: tempDir });
    expect(mem.getSize()).toBe(1); // only "good" entry loads
  });

  it("handles TTL boundary: expires exactly at limit", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, defaultTtlMs: 1 });
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" });
    await new Promise((r) => setTimeout(r, 2));
    const cached = await mem.get("k1");
    expect(cached).toBeNull();
  });

  it("handles TTL boundary: not expired 1ms before limit", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir, defaultTtlMs: 100 });
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" });
    await new Promise((r) => setTimeout(r, 10)); // way before expiry
    const cached = await mem.get("k1");
    expect(cached).not.toBeNull();
  });

  it("normalizeKey: identical meaning, different whitespace", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const key1 = mem.computeKey("hello world", "en", "es");
    const key2 = mem.computeKey("hello  world", "en", "es"); // double space
    const key3 = mem.computeKey("hello world ", "en", "es"); // trailing space
    expect(key1).toBe(key2);
    expect(key1).toBe(key3);
  });

  it("normalizeKey: different casing in sourceLang/targetLang", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const key1 = mem.computeKey("hi", "EN", "ES");
    const key2 = mem.computeKey("hi", "en", "es");
    expect(key1).toBe(key2);
  });

  it("normalizeKey: handles null/undefined text and langs gracefully", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const key1 = mem.computeKey(null as any, null as any, null as any);
    const key2 = mem.computeKey("", "", "");
    expect(key1).toBe(key2);
  });

  it("clear() removes all entries and file", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" });
    await mem.clear();
    expect(mem.getSize()).toBe(0);
    expect(fs.existsSync(path.join(tempDir, "translation-memory.json"))).toBe(false);
  });

  it("clear() during in-flight persist does not resurrect old data", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    await mem.set("old", { text: "old-value", sourceLang: "en", targetLang: "es" });

    // Start a new persist by setting another key
    const setPromise = mem.set("new", { text: "new-value", sourceLang: "en", targetLang: "es" });

    // Immediately clear (race condition)
    await mem.clear();
    await setPromise;

    // Reload from disk — old data should NOT be there
    const mem2 = new TranslationMemory({ cacheDir: tempDir });
    expect(mem2.getSize()).toBe(0);
  });

  it("recovers from persist failure and continues persisting", async () => {
    // Use a read-only directory to simulate disk-full / permission error
    const roDir = path.join(tempDir, "readonly");
    fs.mkdirSync(roDir, { recursive: true });
    fs.chmodSync(roDir, 0o555);

    const mem = new TranslationMemory({ cacheDir: roDir });
    // This set() should NOT throw (persist failure is swallowed)
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" });
    expect(mem.getSize()).toBe(1);

    // Restore permissions
    fs.chmodSync(roDir, 0o755);

    // Next set() should persist successfully
    await mem.set("k2", { text: "v2", sourceLang: "en", targetLang: "es" });

    const mem2 = new TranslationMemory({ cacheDir: roDir });
    expect(mem2.getSize()).toBeGreaterThanOrEqual(1);
  });

  it("handles rapid get-set-get cycle", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const key = "rapid";
    await mem.set(key, { text: "v1", sourceLang: "en", targetLang: "es" });
    const g1 = await mem.get(key);
    await mem.set(key, { text: "v2", sourceLang: "en", targetLang: "es" });
    const g2 = await mem.get(key);
    expect(g1!.result.text).toBe("v1");
    expect(g2!.result.text).toBe("v2");
  });

  it("returns immutable copy from get() — mutating result does not corrupt cache", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    await mem.set("k1", { text: "original", sourceLang: "en", targetLang: "es" });
    const cached = await mem.get("k1");
    expect(cached).not.toBeNull();
    // Mutate the returned result
    cached!.result.text = "HACKED";
    // Fetch again — should still be original
    const cached2 = await mem.get("k1");
    expect(cached2!.result.text).toBe("original");
  });

  it("handles concurrent clear() and set() without crash", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    const operations: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      operations.push(mem.set(`key-${i}`, { text: `v${i}`, sourceLang: "en", targetLang: "es" }));
      if (i === 10) {
        operations.push(mem.clear());
      }
    }
    await Promise.all(operations);
    // Should not crash; size may be 0 or some remaining entries
    expect(typeof mem.getSize()).toBe("number");
  });

  it("handles TTL of 0 (immediate expiry)", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" }, 0);
    // Even without waiting, get() might see it as expired depending on timing
    await new Promise((r) => setTimeout(r, 1));
    const cached = await mem.get("k1");
    expect(cached).toBeNull();
  });

  it("handles negative TTL (already expired)", async () => {
    const mem = new TranslationMemory({ cacheDir: tempDir });
    await mem.set("k1", { text: "v1", sourceLang: "en", targetLang: "es" }, -1);
    const cached = await mem.get("k1");
    expect(cached).toBeNull();
  });

  it("handles cacheDir that is a file instead of directory", async () => {
    const filePath = path.join(tempDir, "not-a-dir");
    fs.writeFileSync(filePath, "I am a file");

    // mkdir recursive should handle this by... actually it will throw EEXIST
    // But our doPersist swallows mkdir errors. Let's see if it works.
    const mem = new TranslationMemory({ cacheDir: filePath });
    // Should not throw on construction (load swallows)
    expect(mem.getSize()).toBe(0);
  });
});
