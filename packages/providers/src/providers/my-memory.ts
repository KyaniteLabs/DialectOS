/**
 * MyMemory translation provider
 * Free, no authentication required. Public endpoint enforces small query sizes.
 */

import type { TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@espanol/security";
import { languageCodeSchema } from "@espanol/types";

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const DEFAULT_MYMEMORY_TIMEOUT = 15000; // 15 seconds (faster timeout for free service)
const MAX_CHARS = 500;
const CHUNK_SIZE = 450;

export class MyMemoryProvider implements TranslationProvider {
  readonly name = "mymemory";
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    maxRequests?: number;
    windowMs?: number;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
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

    const envTimeout = parseInt(process.env.MYMEMORY_TIMEOUT_MS || "", 10);
    this.timeoutMs =
      options?.timeoutMs ||
      (envTimeout > 0 ? envTimeout : DEFAULT_MYMEMORY_TIMEOUT);
    const envRetries = parseInt(process.env.MYMEMORY_MAX_RETRIES || "", 10);
    this.maxRetries = options?.maxRetries ?? (envRetries > 0 ? envRetries : 4);
    const envRetryDelay = parseInt(process.env.MYMEMORY_RETRY_DELAY_MS || "", 10);
    this.retryDelayMs = options?.retryDelayMs ?? (envRetryDelay > 0 ? envRetryDelay : 2000);
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

    // Use Intl.Segmenter for grapheme-aware splitting (Node 20+)
    // This prevents splitting surrogate pairs (emojis, historic scripts)
    const segmenter =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? new Intl.Segmenter("en", { granularity: "grapheme" })
        : null;

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

      // If we have a segmenter, ensure we don't split a grapheme cluster
      if (segmenter && splitAt < remaining.length) {
        const segments = Array.from(segmenter.segment(remaining));
        let charCount = 0;
        let graphemeIdx = 0;
        for (const seg of segments) {
          charCount += seg.segment.length;
          graphemeIdx++;
          if (charCount >= splitAt) {
            break;
          }
        }
        splitAt = segments.slice(0, graphemeIdx).reduce((sum, s) => sum + s.segment.length, 0);
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

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const params = new URLSearchParams({
          q: chunk,
          langpair: `${sourceLang === "auto" ? "autodetect" : sourceLang}|${targetLang}`,
        });
        const url = `${MYMEMORY_ENDPOINT}?${params.toString()}`;
        const response = await fetch(url, { method: "GET", signal: controller.signal });

        if (response.status === 429 && attempt < this.maxRetries) {
          clearTimeout(timeoutId);
          const retryAfter = parseInt(response.headers.get("retry-after") || "", 10);
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : this.retryDelayMs * (attempt + 1);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          clearTimeout(timeoutId);
          throw new Error(`MyMemory API error: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          clearTimeout(timeoutId);
          throw new Error("Invalid response content type");
        }

        // Keep timeout active while reading body — start a fresh timeout race
        const data = (await Promise.race([
          response.json(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Response body timed out")), this.timeoutMs)
          ),
        ])) as {
          responseStatus: number;
          responseDetails?: string;
          responseData: { translatedText: string };
        };

        clearTimeout(timeoutId);
        if (data.responseStatus !== 200) {
          if (
            /TOO MANY REQUESTS|RATE LIMIT/i.test(data.responseDetails || "") &&
            attempt < this.maxRetries
          ) {
            await new Promise((r) =>
              setTimeout(r, this.retryDelayMs * (attempt + 1))
            );
            continue;
          }
          throw new Error(`MyMemory error: ${data.responseDetails || "Unknown error"}`);
        }

        this.breaker.recordSuccess();
        return data.responseData.translatedText;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          if (attempt < this.maxRetries) {
            await new Promise((r) =>
              setTimeout(r, this.retryDelayMs * (attempt + 1))
            );
            continue;
          }
          this.breaker.recordFailure();
          throw new Error("Request timed out");
        }
        if (attempt < this.maxRetries) {
          await new Promise((r) =>
            setTimeout(r, this.retryDelayMs * (attempt + 1))
          );
          continue;
        }
        this.breaker.recordFailure();
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(sanitizeErrorMessage(`MyMemory error: ${message}`));
      }
    }
    this.breaker.recordFailure();
    throw new Error("MyMemory error: max retries exceeded");
  }
}
