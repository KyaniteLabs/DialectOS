/**
 * DeepL translation provider
 * Uses deepl-node SDK with built-in retries and timeout handling
 */

import * as deepl from "deepl-node";
import type { TranslationProvider, TranslationResult, ProviderCapability } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@espanol/security";
import { languageCodeSchema } from "@espanol/types";

const DEEPL_FORMALITY_MAP: Record<string, "more" | "less" | "default"> = {
  formal: "more",
  informal: "less",
  auto: "default",
};

const DEEPL_SUPPORTED_LANGS = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hu", "id",
  "it", "ja", "ko", "lt", "lv", "nb", "nl", "pl", "pt", "ro", "ru", "sk",
  "sl", "sv", "tr", "uk", "zh",
];

export class DeepLProvider implements TranslationProvider {
  readonly name = "deepl";
  private client: deepl.DeepLClient;
  private authKey: string;
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
    this.authKey = authKey;

    // Use mock client if provided (for testing), otherwise create real client
    // minTimeout controls axios request timeout — when it fires, the underlying
    // HTTP request is aborted, preventing dangling promises.
    this.client =
      mockClient ||
      new deepl.DeepLClient(authKey, {
        minTimeout: options?.timeout || HTTP_TIMEOUT,
      });

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

  getCapabilities(): ProviderCapability {
    return {
      name: this.name,
      displayName: "DeepL",
      needsApiKey: true,
      supportsFormality: true,
      supportsContext: true,
      supportsDialect: true,
      supportedSourceLangs: [...DEEPL_SUPPORTED_LANGS, "auto"],
      supportedTargetLangs: DEEPL_SUPPORTED_LANGS,
      maxPayloadChars: 50000,
      dialectHandling: "native",
      rateLimitHints: { maxRequests: 60, windowMs: 60000 },
    };
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

    // Validate language codes
    const sourceResult = languageCodeSchema.safeParse(sourceLang === "auto" ? "en" : sourceLang);
    const targetResult = languageCodeSchema.safeParse(targetLang);
    if (!sourceResult.success || !targetResult.success) {
      throw new SecurityError("Invalid language code", ErrorCode.INVALID_INPUT);
    }

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

      // Execute translation — axios timeout (minTimeout) aborts the underlying
      // HTTP request automatically, avoiding dangling promises from Promise.race.
      const result = await this.client.translateText(
        text,
        sourceLangUpper,
        targetLangUpper,
        translateOptions
      );

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
      if (message.includes(this.authKey)) {
        message = message.replaceAll(this.authKey, "[REDACTED]");
      }
      throw new Error(sanitizeErrorMessage(`DeepL error: ${message}`));
    }
  }
}
