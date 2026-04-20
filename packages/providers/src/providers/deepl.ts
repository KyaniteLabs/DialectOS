/**
 * DeepL translation provider
 * Uses deepl-node SDK with built-in retries and timeout handling
 */

import * as deepl from "deepl-node";
import type { TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength } from "@espanol/security";

const DEEPL_FORMALITY_MAP: Record<string, "more" | "less" | "default"> = {
  formal: "more",
  informal: "less",
  auto: "default",
};

export class DeepLProvider implements TranslationProvider {
  readonly name = "deepl";
  private client: deepl.DeepLClient;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(
    apiKey?: string,
    mockClient?: deepl.DeepLClient,
    options?: {
      timeout?: number;
      failureThreshold?: number;
      resetTimeoutMs?: number;
      maxRequests?: number;
      windowMs?: number;
    }
  ) {
    const authKey = apiKey || process.env.DEEPL_AUTH_KEY;
    if (!authKey) {
      throw new Error("DEEPL_AUTH_KEY environment variable is required");
    }

    // Use mock client if provided (for testing), otherwise create real client
    this.client = mockClient || new deepl.DeepLClient(authKey);

    // Initialize circuit breaker
    this.breaker = new CircuitBreaker(
      options?.failureThreshold || 5,
      options?.resetTimeoutMs || 60000
    );

    // Initialize rate limiter (DeepL free tier: 500K chars/month)
    this.rateLimiter = new RateLimiter(
      options?.maxRequests || 60,
      options?.windowMs || 60000
    );
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: {
      formality?: "formal" | "informal" | "auto";
      context?: string;
      dialect?: string;
    }
  ): Promise<TranslationResult> {
    // Validate input length before processing
    validateContentLength(text);

    // Check circuit breaker
    if (!this.breaker.canExecute()) {
      throw new Error("DeepL provider is temporarily unavailable (circuit open)");
    }

    // Check rate limit
    await this.rateLimiter.acquire();

    try {
      // Map formality to DeepL format
      const formality = DEEPL_FORMALITY_MAP[options?.formality || "auto"] || "default";

      // Build translate options
      const translateOptions: deepl.TranslateTextOptions = {
        formality,
      };

      if (options?.context) {
        translateOptions.context = options.context;
      }

      // DeepL uses uppercase language codes
      const targetLangUpper = targetLang.toUpperCase() as deepl.TargetLanguageCode;
      const sourceLangUpper: deepl.SourceLanguageCode | null =
        sourceLang === "auto" ? null : (sourceLang.toUpperCase() as deepl.SourceLanguageCode);

      // Execute translation with timeout
      const result = await Promise.race<deepl.TextResult>([
        this.client.translateText(text, sourceLangUpper, targetLangUpper, translateOptions),
        new Promise<deepl.TextResult>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), HTTP_TIMEOUT)
        ),
      ]);

      // Record success
      this.breaker.recordSuccess();

      return {
        translatedText: result.text,
        detectedSourceLang: result.detectedSourceLang?.toUpperCase(),
      };
    } catch (error) {
      // Record failure
      this.breaker.recordFailure();

      // Sanitize error message
      // Pre-sanitize with known authKey to catch any format edge cases
      let message = error instanceof Error ? error.message : String(error);
      const authKey = (this.client as any).authKey;
      if (authKey && typeof authKey === "string" && message.includes(authKey)) {
        message = message.replaceAll(authKey, "[REDACTED]");
      }
      throw new Error(sanitizeErrorMessage(`DeepL error: ${message}`));
    }
  }
}
