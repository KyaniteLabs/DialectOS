/**
 * Deterministic chaos provider for resilience testing.
 *
 * Wraps any TranslationProvider and injects configurable failure modes
 * to validate fallback, circuit breaker, and retry behavior.
 */

import type { TranslationProvider, TranslationResult, ProviderCapability, TranslateOptions } from "./types.js";

export type ChaosMode =
  | "latency"
  | "timeout"
  | "malformed-json"
  | "http-5xx"
  | "http-429"
  | "partial-failure"
  | "random-failure";

export interface ChaosScenario {
  /** Failure mode to inject */
  mode: ChaosMode;
  /** Probability of failure (0-1) for random-failure mode */
  probability?: number;
  /** Latency delay in ms for latency mode */
  delayMs?: number;
  /** Which call indices to fail (1-based). If empty, all calls may fail. */
  failOnCalls?: number[];
  /** Error message to return */
  errorMessage?: string;
}

export class ChaosProvider implements TranslationProvider {
  readonly name: string;
  private inner: TranslationProvider;
  private scenario: ChaosScenario;
  private callCount = 0;

  constructor(inner: TranslationProvider, scenario: ChaosScenario) {
    this.name = `chaos-${inner.name}`;
    this.inner = inner;
    this.scenario = scenario;
  }

  getCapabilities(): ProviderCapability {
    return this.inner.getCapabilities?.() ?? {
      name: this.name,
      displayName: this.name,
      needsApiKey: false,
      supportsFormality: false,
      supportsContext: false,
      supportsDialect: false,
      supportedSourceLangs: [],
      supportedTargetLangs: [],
      maxPayloadChars: 0,
      dialectHandling: "none",
    };
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult> {
    this.callCount++;

    const shouldFail =
      this.scenario.failOnCalls && this.scenario.failOnCalls.length > 0
        ? this.scenario.failOnCalls.includes(this.callCount)
        : true;

    if (!shouldFail) {
      return this.inner.translate(text, sourceLang, targetLang, options);
    }

    switch (this.scenario.mode) {
      case "latency": {
        await sleep(this.scenario.delayMs ?? 100);
        return this.inner.translate(text, sourceLang, targetLang, options);
      }

      case "timeout": {
        throw new Error(
          this.scenario.errorMessage ?? "Chaos: simulated timeout"
        );
      }

      case "malformed-json": {
        throw new Error(
          this.scenario.errorMessage ?? "Chaos: simulated malformed JSON response"
        );
      }

      case "http-5xx": {
        throw Object.assign(
          new Error(this.scenario.errorMessage ?? "Chaos: simulated 500 Internal Server Error"),
          { statusCode: 500 }
        );
      }

      case "http-429": {
        throw Object.assign(
          new Error(this.scenario.errorMessage ?? "Chaos: simulated 429 Too Many Requests"),
          { statusCode: 429 }
        );
      }

      case "partial-failure": {
        // Return a translation but with corrupted content to simulate partial failure
        return {
          translatedText: "",
          provider: this.name as any,
        };
      }

      case "random-failure": {
        const prob = this.scenario.probability ?? 0.5;
        if (Math.random() < prob) {
          throw new Error(this.scenario.errorMessage ?? "Chaos: random failure");
        }
        return this.inner.translate(text, sourceLang, targetLang, options);
      }

      default:
        return this.inner.translate(text, sourceLang, targetLang, options);
    }
  }

  reset(): void {
    this.callCount = 0;
  }

  getCallCount(): number {
    return this.callCount;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
