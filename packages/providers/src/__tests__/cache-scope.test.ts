/**
 * The cache and bulk dedup must never hand one request's result to another:
 * different providers/models and different targets are different answers.
 */
import { describe, it, expect, afterEach } from "vitest";
import { TranslationMemory } from "../translation-memory.js";
import { CachedProvider } from "../cached-provider.js";
import { BulkTranslationEngine } from "../bulk/engine.js";
import type { TranslationProvider } from "../types.js";

function fake(name: string, identity?: string): TranslationProvider & { calls: number } {
  const p = {
    name,
    calls: 0,
    async translate(text: string, _s: string, targetLang: string, options?: { dialect?: string }) {
      p.calls++;
      return { translatedText: `${identity ?? name}:${targetLang}:${options?.dialect ?? "-"}:${text}` };
    },
    ...(identity ? { cacheIdentity: () => identity } : {}),
  };
  return p;
}

const memories: TranslationMemory[] = [];
function memory() {
  const m = new TranslationMemory({ cacheDir: `/tmp/dialectos-scope-${Date.now()}-${memories.length}` });
  memories.push(m);
  return m;
}
afterEach(async () => {
  await Promise.all(memories.splice(0).map((m) => m.clear()));
});

describe("cache scope", () => {
  it("keys differ by provider identity", () => {
    const m = memory();
    expect(m.computeKey("hi", "en", "es", undefined, "deepl")).not.toBe(
      m.computeKey("hi", "en", "es", undefined, "llm|openai|http://x|model-a")
    );
  });

  it("a shared cache never serves provider A's result to provider B", async () => {
    const m = memory();
    const a = new CachedProvider(fake("deepl"), m);
    const b = new CachedProvider(fake("libre"), m);
    expect((await a.translate("hello", "en", "es")).translatedText).toMatch(/^deepl:/);
    expect((await b.translate("hello", "en", "es")).translatedText).toMatch(/^libre:/);
  });

  it("two LLM models with the same provider name keep separate entries", async () => {
    const m = memory();
    const a = new CachedProvider(fake("llm", "llm|openai|http://x|model-a"), m);
    const b = new CachedProvider(fake("llm", "llm|openai|http://x|model-b"), m);
    await a.translate("hello", "en", "es");
    expect((await b.translate("hello", "en", "es")).translatedText).toContain("model-b");
  });
});

describe("bulk dedup", () => {
  it("does not merge the same text sent to different dialects", async () => {
    const provider = fake("deepl");
    const engine = new BulkTranslationEngine({ useCache: false, retryDelayMs: 0 });
    const res = await engine.translate(
      [
        { id: "1", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
        { id: "2", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-AR" } },
        { id: "3", sourceText: "Hello", sourceLang: "en", targetLang: "es", options: { dialect: "es-MX" } },
      ],
      provider
    );
    expect(provider.calls).toBe(2);
    const byId = Object.fromEntries(res.successes.map((s) => [s.item.id, s.result.translatedText]));
    expect(byId["1"]).toContain("es-MX");
    expect(byId["2"]).toContain("es-AR");
    expect(byId["3"]).toBe(byId["1"]);
  });
});

