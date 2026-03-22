/**
 * MyMemory translation provider
 * Free, no authentication required. Rate limited to 5000 chars per request.
 */

import type { TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT } from "@espanol/security";

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MYMEMORY_TIMEOUT = 15000; // 15 seconds (faster timeout for free service)
const MAX_CHARS = 5000;

export class MyMemoryProvider implements TranslationProvider {
  readonly name = "mymemory";
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(options?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    maxRequests?: number;
    windowMs?: number;
  }) {
    // Initialize circuit breaker
    this.breaker = new CircuitBreaker(
      options?.failureThreshold || 5,
      options?.resetTimeoutMs || 60000
    );

    // Initialize rate limiter (lower limit for free service)
    this.rateLimiter = new RateLimiter(
      options?.maxRequests || 10,
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
    // Warn if text exceeds character limit
    if (text.length > MAX_CHARS) {
      console.warn(
        `MyMemory: Request text exceeds ${MAX_CHARS} character limit (got ${text.length} chars)`
      );
    }

    // Check circuit breaker
    if (!this.breaker.canExecute()) {
      throw new Error("MyMemory provider is temporarily unavailable (circuit open)");
    }

    // Check rate limit
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MYMEMORY_TIMEOUT);

    try {
      // Build URL parameters
      const params = new URLSearchParams({
        q: text,
        langpair: `${sourceLang === "auto" ? "autodetect" : sourceLang}|${targetLang}`,
      });

      const url = `${MYMEMORY_ENDPOINT}?${params.toString()}`;

      // Execute request - NO auth header for MyMemory
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Validate response
      if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.statusText}`);
      }

      // Validate Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response content type");
      }

      const data = await response.json() as {
        responseStatus: number;
        responseDetails?: string;
        responseData: { translatedText: string };
      };

      // Check response status
      if (data.responseStatus !== 200) {
        throw new Error(`MyMemory error: ${data.responseDetails || "Unknown error"}`);
      }

      // Record success
      this.breaker.recordSuccess();

      return {
        translatedText: data.responseData.translatedText,
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
      throw new Error(sanitizeErrorMessage(`MyMemory error: ${message}`));
    }
  }
}
