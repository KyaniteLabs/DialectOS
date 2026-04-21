import { describe, expect, it, vi } from "vitest";
import type { TranslationProvider } from "@espanol/types";
import type { ProviderRegistry } from "@espanol/providers";
import { translateWithFallback } from "../lib/resilient-translation.js";

class TestRegistry implements Partial<ProviderRegistry> {
  providers: Record<string, TranslationProvider>;
  failures: string[] = [];
  successes: string[] = [];

  constructor(providers: Record<string, TranslationProvider>) {
    this.providers = providers;
  }

  get(name: string): TranslationProvider {
    const provider = this.providers[name];
    if (!provider) throw new Error("Provider not available");
    return provider;
  }

  listProviders(): string[] {
    return Object.keys(this.providers);
  }

  isAvailable(name: string): boolean {
    return name in this.providers;
  }

  recordSuccess(name: string): void {
    this.successes.push(name);
  }

  recordFailure(name: string): void {
    this.failures.push(name);
  }
}

describe("translateWithFallback", () => {
  it("should report the provider used and fallback count", async () => {
    const failing: TranslationProvider = {
      name: "primary",
      translate: vi.fn().mockRejectedValue(new Error("down")),
    };
    const succeeding: TranslationProvider = {
      name: "secondary",
      translate: vi.fn().mockResolvedValue({ translatedText: "Hola" }),
    };
    const registry = new TestRegistry({
      primary: failing,
      secondary: succeeding,
    }) as ProviderRegistry;

    const result = await translateWithFallback(
      registry,
      "primary",
      "Hello",
      "en",
      "es",
      {},
      { delayMs: 0 }
    );

    expect(result.translatedText).toBe("Hola");
    expect(result.providerUsed).toBe("secondary");
    expect(result.fallbackCount).toBe(1);
    expect(result.retryCount).toBe(0);
  });
});
