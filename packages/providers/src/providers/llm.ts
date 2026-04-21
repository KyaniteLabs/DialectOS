/**
 * Generic OpenAI-compatible LLM provider.
 *
 * This is the semantic provider path for DialectOS: the provider receives the
 * full dialect/context/formality prompt and is expected to perform translation
 * plus dialect adaptation, not generic machine translation.
 */

import type { ProviderCapability, TranslateOptions, TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@espanol/security";
import { ALL_SPANISH_DIALECTS, languageCodeSchema } from "@espanol/types";

const DEFAULT_MAX_PAYLOAD_CHARS = 50000;
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60000;

export interface LLMProviderOptions {
  /** Full OpenAI-compatible chat completions endpoint. */
  endpoint?: string;
  /** Model name understood by the configured LLM endpoint. */
  model?: string;
  /** Optional bearer token. Required by most hosted LLM endpoints, optional for local gateways. */
  apiKey?: string;
  /** Allow localhost/private endpoint URLs for explicitly configured local LLM gateways. */
  allowLocal?: boolean;
  timeoutMs?: number;
  maxPayloadChars?: number;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  maxRequests?: number;
  windowMs?: number;
}

function validateLLMEndpoint(urlStr: string, allowLocal: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SecurityError("Invalid LLM endpoint URL", ErrorCode.INVALID_INPUT);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SecurityError("LLM endpoint must use http or https", ErrorCode.INVALID_INPUT);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("[fc") ||
    hostname.startsWith("[fd");

  if (isLocal && !allowLocal) {
    throw new SecurityError(
      "LLM endpoint cannot point to localhost/private addresses unless LLM_ALLOW_LOCAL=1",
      ErrorCode.INVALID_INPUT
    );
  }

  return urlStr;
}

function extractChatCompletionText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
  const content = first?.message?.content ?? first?.text;
  return typeof content === "string" && content.trim().length > 0
    ? content.trim()
    : undefined;
}

function buildSystemPrompt(): string {
  return [
    "You are a semantic dialect-aware Spanish translation engine for DialectOS.",
    "Translate meaning, intent, register, and audience expectations; never do word-by-word literal substitution when it damages dialect fidelity.",
    "Use the requested dialect grammar, formality, taboo, ambiguity, glossary, and style context exactly.",
    "Return only the translated text. Do not add explanations, labels, markdown fences, or alternatives.",
  ].join(" ");
}

function buildUserPrompt(text: string, sourceLang: string, targetLang: string, options: TranslateOptions = {}): string {
  return [
    `Source language: ${sourceLang}.`,
    `Target language: ${targetLang}.`,
    options.dialect ? `Target dialect: ${options.dialect}.` : undefined,
    options.formality ? `Formality: ${options.formality}.` : undefined,
    options.context ? `Dialect/context instructions: ${options.context}` : undefined,
    "Source text:",
    text,
  ].filter(Boolean).join("\n");
}

export class LLMProvider implements TranslationProvider {
  readonly name = "llm";
  private endpoint: string;
  private model: string;
  private apiKey?: string;
  private timeoutMs: number;
  private maxPayloadChars: number;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private needsApiKey: boolean;

  constructor(options: LLMProviderOptions = {}) {
    const endpoint = options.endpoint || process.env.LLM_API_URL || process.env.LLM_ENDPOINT || "";
    const model = options.model || process.env.LLM_MODEL || "";
    const allowLocal = options.allowLocal ?? process.env.LLM_ALLOW_LOCAL === "1";

    if (!endpoint) {
      throw new Error("LLM_API_URL environment variable is required");
    }
    if (!model) {
      throw new Error("LLM_MODEL environment variable is required");
    }

    this.endpoint = validateLLMEndpoint(endpoint, allowLocal);
    this.model = model;
    this.apiKey = options.apiKey || process.env.LLM_API_KEY;
    this.needsApiKey = Boolean(this.apiKey);
    this.timeoutMs = options.timeoutMs || parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || HTTP_TIMEOUT;
    this.maxPayloadChars = options.maxPayloadChars || parseInt(process.env.LLM_MAX_PAYLOAD_CHARS || "", 10) || DEFAULT_MAX_PAYLOAD_CHARS;
    this.breaker = new CircuitBreaker(options.failureThreshold || 5, options.resetTimeoutMs || 60000);
    this.rateLimiter = new RateLimiter(
      options.maxRequests || parseInt(process.env.LLM_RATE_LIMIT || "", 10) || DEFAULT_MAX_REQUESTS,
      options.windowMs || parseInt(process.env.LLM_RATE_WINDOW_MS || "", 10) || DEFAULT_WINDOW_MS
    );
  }

  getCapabilities(): ProviderCapability {
    return {
      name: this.name,
      displayName: "Generic LLM",
      needsApiKey: this.needsApiKey,
      supportsFormality: true,
      supportsContext: true,
      supportsDialect: true,
      supportedSourceLangs: ["auto", "en", "es"],
      supportedTargetLangs: ["es", ...ALL_SPANISH_DIALECTS],
      maxPayloadChars: this.maxPayloadChars,
      dialectHandling: "semantic",
      rateLimitHints: { maxRequests: DEFAULT_MAX_REQUESTS, windowMs: DEFAULT_WINDOW_MS },
    };
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult> {
    validateContentLength(text);
    if (text.length > this.maxPayloadChars) {
      throw new Error(`Payload too large: ${text.length} chars exceeds max ${this.maxPayloadChars}`);
    }

    const sourceResult = languageCodeSchema.safeParse(sourceLang === "auto" ? "en" : sourceLang);
    const targetResult = languageCodeSchema.safeParse(targetLang.split("-")[0]);
    if (!sourceResult.success || !targetResult.success) {
      throw new SecurityError("Invalid language code", ErrorCode.INVALID_INPUT);
    }

    if (!this.breaker.canExecute()) {
      throw new Error("LLM provider is temporarily unavailable (circuit open)");
    }
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(text, sourceLang, targetLang, options) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`LLM API error: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        clearTimeout(timeoutId);
        throw new Error("Invalid response content type");
      }

      const data = await response.json();
      clearTimeout(timeoutId);
      const translatedText = extractChatCompletionText(data);
      if (!translatedText) {
        throw new Error("LLM response did not include translated content");
      }

      this.breaker.recordSuccess();
      return {
        translatedText,
        provider: "llm",
        dialect: options?.dialect,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      this.breaker.recordFailure();
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw new Error(sanitizeErrorMessage(error instanceof Error ? error.message : String(error)));
    }
  }
}
