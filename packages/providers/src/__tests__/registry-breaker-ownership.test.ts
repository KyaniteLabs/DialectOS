/**
 * Regression tests: the registry and a provider that owns its circuit breaker
 * must drive ONE breaker through ONE set of transitions.
 *
 * Before the fix, the registry shared the provider's breaker but still
 * (a) claimed the half-open probe in isAvailable()/getAuto(), so the provider's
 *     own canExecute() inside translate() was refused and a recovered backend
 *     could never close the circuit, and
 * (b) recorded every outcome a second time, so N real failures counted as 2N.
 * And with caching on, CachedProvider hid getCircuitBreaker(), so the registry
 * built a second, desynchronized breaker.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CircuitBreaker } from "../circuit-breaker.js";
import { ProviderRegistry } from "../registry.js";
import { TranslationMemory } from "../translation-memory.js";
import type { TranslationProvider, TranslationResult } from "../types.js";

const THRESHOLD = 3;
const RESET_MS = 1000;

/** Mimics DeepL/LLM/Libre/MyMemory: guards and records on its own breaker. */
class SelfGuardingProvider implements TranslationProvider {
  readonly name = "selfguard";
  readonly breaker = new CircuitBreaker(THRESHOLD, RESET_MS);
  healthy = true;
  calls = 0;

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
  }

  async translate(text: string): Promise<TranslationResult> {
    if (!this.breaker.canExecute()) {
      throw new Error("selfguard is temporarily unavailable (circuit open)");
    }
    this.calls++;
    if (!this.healthy) {
      this.breaker.recordFailure();
      throw new Error("backend down");
    }
    this.breaker.recordSuccess();
    return { translatedText: `es:${text}` };
  }
}

/** The same sequence translateWithFallback / web-demo-service perform. */
async function callThroughRegistry(registry: ProviderRegistry, name: string): Promise<boolean> {
  if (!registry.isAvailable(name)) return false;
  try {
    await registry.get(name).translate("hi", "en", "es");
    registry.recordSuccess(name);
    return true;
  } catch {
    registry.recordFailure(name);
    return false;
  }
}

describe("ProviderRegistry + provider-owned circuit breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("counts each real failure once (does not trip early)", async () => {
    const provider = new SelfGuardingProvider();
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS);
    registry.register(provider);
    provider.healthy = false;

    await callThroughRegistry(registry, provider.name);
    await callThroughRegistry(registry, provider.name);

    // Two real failures with a threshold of three: must still be closed.
    expect(provider.breaker.getState()).toBe("closed");
  });

  it("lets a recovered backend close the circuit through the registry", async () => {
    const provider = new SelfGuardingProvider();
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS);
    registry.register(provider);
    provider.healthy = false;
    for (let i = 0; i < THRESHOLD; i++) await callThroughRegistry(registry, provider.name);
    expect(provider.breaker.getState()).toBe("open");

    provider.healthy = true;
    vi.setSystemTime(RESET_MS);
    const ok = await callThroughRegistry(registry, provider.name);

    expect(ok).toBe(true);
    expect(provider.calls).toBe(THRESHOLD + 1);
    expect(provider.breaker.getState()).toBe("closed");
  });

  it("getAuto() does not steal the probe from the provider it returns", async () => {
    const provider = new SelfGuardingProvider();
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS);
    registry.register(provider);
    for (let i = 0; i < THRESHOLD; i++) provider.breaker.recordFailure();
    vi.setSystemTime(RESET_MS);

    const chosen = registry.getAuto();
    await expect(chosen.translate("hi", "en", "es")).resolves.toEqual({ translatedText: "es:hi" });
    expect(provider.breaker.getState()).toBe("closed");
  });

  it("isAvailable() is a pure check for provider-owned breakers", () => {
    const provider = new SelfGuardingProvider();
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS);
    registry.register(provider);
    for (let i = 0; i < THRESHOLD; i++) provider.breaker.recordFailure();
    vi.setSystemTime(RESET_MS);

    expect(registry.isAvailable(provider.name)).toBe(true);
    expect(registry.isAvailable(provider.name)).toBe(true);
    // Neither check moved the state or took the probe slot.
    expect(provider.breaker.getState()).toBe("open");
    expect(provider.breaker.canExecute()).toBe(true);
  });

  it("still gates and records for plain providers (registry-owned breaker)", async () => {
    const plain: TranslationProvider = {
      name: "plain",
      translate: vi.fn().mockRejectedValue(new Error("down")),
    };
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS);
    registry.register(plain);

    for (let i = 0; i < THRESHOLD; i++) await callThroughRegistry(registry, "plain");
    expect(registry.getBreaker("plain")?.getState()).toBe("open");
    expect(registry.isAvailable("plain")).toBe(false);

    vi.setSystemTime(RESET_MS);
    // The registry is the gatekeeper here: first check claims the only probe.
    expect(registry.isAvailable("plain")).toBe(true);
    expect(registry.getBreaker("plain")?.getState()).toBe("half-open");
    expect(registry.isAvailable("plain")).toBe(false);
  });
});

describe("ProviderRegistry with caching shares the provider's breaker", () => {
  let cacheDir: string;
  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "dialectos-breaker-"));
  });
  afterEach(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

  it("uses the inner provider's breaker instead of a second one", () => {
    const provider = new SelfGuardingProvider();
    const registry = new ProviderRegistry(THRESHOLD, RESET_MS, true, new TranslationMemory({ cacheDir }));
    registry.register(provider);

    expect(registry.getBreaker(provider.name)).toBe(provider.breaker);
  });
});
