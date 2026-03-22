/**
 * LibreTranslate provider
 * Free, community-run translation service with optional authentication
 */

import type { TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT } from "@espanol/security";

const LIBRETRANSLATE_TIMEOUT = 30000; // 30 seconds

export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "libretranslate";
  private endpoint: string;
  private apiKey?: string;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(options?: {
    endpoint?: string;
    apiKey?: string;
    failureThreshold?: number;
    resetTimeoutMs?: number;
    maxRequests?: number;
    windowMs?: number;
  }) {
    // Get endpoint from env var or options
    this.endpoint =
      options?.endpoint ||
      process.env.LIBRETRANSLATE_URL ||
      "";

    if (!this.endpoint) {
      throw new Error("LIBRETRANSLATE_URL environment variable is required");
    }

    // Get API key from env var or options (optional)
    this.apiKey = options?.apiKey || process.env.LIBRETRANSLATE_API_KEY;

    // Initialize circuit breaker
    this.breaker = new CircuitBreaker(
      options?.failureThreshold || 5,
      options?.resetTimeoutMs || 60000
    );

    // Initialize rate limiter
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
    // Check circuit breaker
    if (!this.breaker.canExecute()) {
      throw new Error("LibreTranslate provider is temporarily unavailable (circuit open)");
    }

    // Check rate limit
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LIBRETRANSLATE_TIMEOUT);

    try {
      // Build request headers - API key in Authorization header, NEVER in URL params
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      // Build request body
      const body = JSON.stringify({
        q: text,
        source: sourceLang === "auto" ? "auto" : sourceLang.toLowerCase(),
        target: targetLang.toLowerCase(),
        format: "text",
      });

      // Execute request
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Validate response
      if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.statusText}`);
      }

      // Validate Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response content type");
      }

      const data = await response.json() as {
        translatedText: string;
        detectedLanguage?: { language: string };
      };

      // Record success
      this.breaker.recordSuccess();

      return {
        translatedText: data.translatedText,
        detectedSourceLang: data.detectedLanguage?.language?.toUpperCase(),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === "AbortError") {
        this.breaker.recordFailure();
        throw new Error("Request timed out");
      }

      // Record failure
      this.breaker.recordFailure();

      // Sanitize error message
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(sanitizeErrorMessage(`LibreTranslate error: ${message}`));
    }
  }
}
