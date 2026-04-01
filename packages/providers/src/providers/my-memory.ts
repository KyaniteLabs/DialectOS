/**
 * MyMemory translation provider
 * Free, no authentication required. Public endpoint enforces small query sizes.
 */

import type { TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT } from "@espanol/security";

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MYMEMORY_TIMEOUT = 15000; // 15 seconds (faster timeout for free service)
const MAX_CHARS = 500;
const CHUNK_SIZE = 450;

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
    const chunks = this.chunkText(text, CHUNK_SIZE);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      translatedChunks.push(await this.translateChunk(chunk, sourceLang, targetLang));
    }

    return {
      translatedText: translatedChunks.join(""),
    };
  }

  private chunkText(text: string, maxLength: number): string[] {
    if (text.length <= MAX_CHARS) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      const window = remaining.slice(0, maxLength);
      let splitAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
        window.lastIndexOf(", "),
        window.lastIndexOf(" ")
      );

      if (splitAt < Math.floor(maxLength * 0.5)) {
        splitAt = maxLength;
      }

      const cut = window.slice(0, splitAt).length;
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }

    return chunks;
  }

  private async translateChunk(
    chunk: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    if (chunk.length > MAX_CHARS) {
      throw new Error(`Chunk exceeds MyMemory max size (${MAX_CHARS})`);
    }

    if (!this.breaker.canExecute()) {
      throw new Error("MyMemory provider is temporarily unavailable (circuit open)");
    }

    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MYMEMORY_TIMEOUT);

    try {
      const params = new URLSearchParams({
        q: chunk,
        langpair: `${sourceLang === "auto" ? "autodetect" : sourceLang}|${targetLang}`,
      });
      const url = `${MYMEMORY_ENDPOINT}?${params.toString()}`;
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response content type");
      }

      const data = (await response.json()) as {
        responseStatus: number;
        responseDetails?: string;
        responseData: { translatedText: string };
      };
      if (data.responseStatus !== 200) {
        throw new Error(`MyMemory error: ${data.responseDetails || "Unknown error"}`);
      }

      this.breaker.recordSuccess();
      return data.responseData.translatedText;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        this.breaker.recordFailure();
        throw new Error("Request timed out");
      }
      this.breaker.recordFailure();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(sanitizeErrorMessage(`MyMemory error: ${message}`));
    }
  }
}
