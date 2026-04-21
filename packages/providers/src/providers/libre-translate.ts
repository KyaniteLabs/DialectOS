/**
 * LibreTranslate provider
 * Free, community-run translation service with optional authentication
 */

import type { TranslationProvider, TranslationResult, ProviderCapability } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@espanol/security";
import { languageCodeSchema } from "@espanol/types";

const LIBRETRANSLATE_TIMEOUT = 30000; // 30 seconds

/**
 * Validate LibreTranslate endpoint URL to prevent SSRF.
 * Blocks private IP ranges, localhost, and non-HTTP(S) protocols.
 */
function validateLibreEndpoint(urlStr: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SecurityError("Invalid LibreTranslate endpoint URL", ErrorCode.INVALID_INPUT);
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SecurityError("LibreTranslate endpoint must use http or https", ErrorCode.INVALID_INPUT);
  }

  // Block localhost
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SecurityError("LibreTranslate endpoint cannot point to localhost", ErrorCode.INVALID_INPUT);
  }

  // Block private IP ranges and link-local
  if (
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.startsWith("[::1]") ||
    hostname.startsWith("[fc") ||
    hostname.startsWith("[fd")
  ) {
    throw new SecurityError("LibreTranslate endpoint cannot point to internal addresses", ErrorCode.INVALID_INPUT);
  }

  return urlStr;
}

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
    const rawEndpoint =
      options?.endpoint ||
      process.env.LIBRETRANSLATE_URL ||
      "";

    if (!rawEndpoint) {
      throw new Error("LIBRETRANSLATE_URL environment variable is required");
    }

    this.endpoint = validateLibreEndpoint(rawEndpoint);

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

  getCapabilities(): ProviderCapability {
    return {
      name: this.name,
      displayName: "LibreTranslate",
      needsApiKey: false,
      supportsFormality: false,
      supportsContext: false,
      supportsDialect: false,
      supportedSourceLangs: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ar"],
      supportedTargetLangs: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ar"],
      maxPayloadChars: 5000,
      dialectHandling: "none",
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

      // Execute request against LibreTranslate translate route
      const endpoint = this.endpoint.replace(/\/+$/, "");
      const response = await fetch(`${endpoint}/translate`, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      // Validate response before clearing timeout — malicious server could
      // send headers quickly but stall the body indefinitely.
      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`LibreTranslate API error: ${response.statusText}`);
      }

      // Validate Content-Type
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        clearTimeout(timeoutId);
        throw new Error("Invalid response content type");
      }

      // Keep timeout active while reading body — start a fresh timeout race
      let bodyTimeoutId: ReturnType<typeof setTimeout> | undefined;
      const data = (await Promise.race([
        response.json(),
        new Promise<never>((_, reject) => {
          bodyTimeoutId = setTimeout(
            () => reject(new Error("Response body timed out")),
            LIBRETRANSLATE_TIMEOUT
          );
        }),
      ])) as {
        translatedText: string;
        detectedLanguage?: { language: string };
      };
      if (bodyTimeoutId) clearTimeout(bodyTimeoutId);
      clearTimeout(timeoutId);

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
