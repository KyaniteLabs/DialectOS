/**
 * Generic LLM provider for OpenAI-compatible, Anthropic-compatible, and
 * LM Studio native APIs.
 *
 * This is the semantic provider path for DialectOS: the provider receives the
 * full dialect/context/formality prompt and is expected to perform translation
 * plus dialect adaptation, not generic machine translation.
 */

import type { ProviderCapability, TranslateOptions, TranslationProvider, TranslationResult } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { fetchWithRedirects } from "../fetch-utils.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@dialectos/security";
import { ALL_SPANISH_DIALECTS, languageCodeSchema } from "@dialectos/types";

const DEFAULT_MAX_PAYLOAD_CHARS = 50000;
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

export type LLMApiFormat = "openai" | "anthropic" | "lmstudio";

export interface LLMProviderOptions {
  /** Full chat/message endpoint URL. */
  endpoint?: string;
  /** Model name understood by the configured LLM endpoint. */
  model?: string;
  /** Wire protocol to use for the configured endpoint. */
  apiFormat?: LLMApiFormat;
  /** Load an LM Studio model before native chat if it is not already loaded. */
  lmStudioJitLoad?: boolean;
  /** Optional native LM Studio load configuration. */
  lmStudioLoadConfig?: {
    context_length?: number;
    eval_batch_size?: number;
    flash_attention?: boolean;
    num_experts?: number;
    offload_kv_cache_to_gpu?: boolean;
  };
  /** Optional bearer token. Required by most hosted LLM endpoints, optional for local gateways. */
  apiKey?: string;
  /** Anthropic API version header. Only used when apiFormat is "anthropic". */
  anthropicVersion?: string;
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
  // Modern OpenAI responses may return content as an array of parts
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const typed = part as { type?: unknown; text?: unknown };
        if (typed.type === "text" && typeof typed.text === "string") {
          return typed.text;
        }
        // Fallback: any object with a text field
        const maybeText = typed.text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("")
      .trim();
    return text.length > 0 ? text : undefined;
  }
  return typeof content === "string" && content.trim().length > 0
    ? content.trim()
    : undefined;
}

function extractAnthropicText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;

  const text = content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const maybeText = (part as { text?: unknown }).text;
      return typeof maybeText === "string" ? maybeText : "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
}

function extractLMStudioText(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return undefined;

  const text = output
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const typed = item as { type?: unknown; content?: unknown };
      return typed.type === "message" && typeof typed.content === "string"
        ? typed.content
        : "";
    })
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
}

function buildSystemPrompt(): string {
  return [
    "You are a semantic dialect-aware Spanish translation engine for DialectOS.",
    "Translate meaning, intent, register, and audience expectations; never do word-by-word literal substitution when it damages dialect fidelity.",
    "Use the requested dialect grammar, formality, taboo, ambiguity, glossary, and style context exactly.",
    "Return only the translated text. Do not add explanations, labels, markdown fences, or alternatives.",
  ].join(" ");
}

function buildStrictSystemPrompt(): string {
  return [
    "You are a semantic dialect-aware Spanish translation engine for DialectOS.",
    "Your previous attempt failed. This retry MUST return only the raw translated Spanish text.",
    "NO explanations. NO labels. NO markdown fences. NO alternatives. NO source text.",
    "Translate meaning, intent, register, and audience expectations; never do word-by-word literal substitution when it damages dialect fidelity.",
    "Use the requested dialect grammar, formality, taboo, ambiguity, glossary, and style context exactly.",
  ].join(" ");
}

const GARBAGE_PATTERNS = [
  /```/,
  /^\s*(translation|traducci[oó]n)\s*:/i,
  /\bhere is (the )?translation\b/i,
  /\baqu[ií] (est[aá]|tienes) (la )?traducci[oó]n\b/i,
  /\bdialect quality contract\b/i,
  /\blexical ambiguity constraints\b/i,
  /\bforbidden output\b/i,
  /\btaboo policy\b/i,
  /\bdo not translate literally\b/i,
];

function isGarbageOutput(source: string, output: string): boolean {
  const trimmed = output.trim();
  if (!trimmed) return true;
  // Unchanged from source (common LLM failure)
  if (trimmed.toLowerCase() === source.trim().toLowerCase()) return true;
  // Contains garbage patterns
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

const SANITIZE_MAP: Array<[RegExp, string]> = [
  [/—/g, "-"],           // em-dash → hyphen
  [/–/g, "-"],           // en-dash → hyphen
  [/‘|’/g, "'"],    // smart single quotes
  [/“|”/g, '"'],    // smart double quotes
  [/€/g, "EUR"],         // € → EUR
  [/£/g, "GBP"],         // £ → GBP
  [/¥/g, "JPY"],         // ¥ → JPY
  [/…/g, "..."],         // … → ...
];

function sanitizeForPrompt(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SANITIZE_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function buildUserPrompt(text: string, sourceLang: string, targetLang: string, options: TranslateOptions = {}): string {
  const sanitized = sanitizeForPrompt(text);
  return [
    `Source language: ${sourceLang}.`,
    `Target language: ${targetLang}.`,
    options.dialect ? `Target dialect: ${options.dialect}.` : undefined,
    options.formality ? `Formality: ${options.formality}.` : undefined,
    options.context ? `Dialect/context instructions: ${options.context}` : undefined,
    "Source text (delimited by <<< and >>>):",
    "<<<",
    sanitized,
    ">>>",
  ].filter(Boolean).join("\n");
}

export class LLMProvider implements TranslationProvider {
  readonly name = "llm";
  private endpoint: string;
  private model: string;
  private apiFormat: LLMApiFormat;
  private apiKey?: string;
  private anthropicVersion: string;
  private lmStudioJitLoad: boolean;
  private lmStudioLoadConfig: LLMProviderOptions["lmStudioLoadConfig"];
  private timeoutMs: number;
  private maxPayloadChars: number;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private needsApiKey: boolean;
  private allowLocal: boolean;
  private activeCount = 0;
  private maxConcurrency: number;
  private maxQueueSize: number;
  private queue: Array<() => void> = [];

  constructor(options: LLMProviderOptions = {}) {
    const model = options.model || process.env.LLM_MODEL || "";
    const apiFormat = options.apiFormat || process.env.LLM_API_FORMAT || "openai";
    const endpoint = options.endpoint ||
      process.env.LLM_API_URL ||
      process.env.LLM_ENDPOINT ||
      process.env.LM_STUDIO_URL ||
      (apiFormat === "lmstudio" ? "http://127.0.0.1:1234" : "");
    const allowLocal = options.allowLocal ?? (apiFormat === "lmstudio" || process.env.LLM_ALLOW_LOCAL === "1");

    if (!endpoint) {
      throw new Error("LLM_API_URL environment variable is required");
    }
    if (!model) {
      throw new Error("LLM_MODEL environment variable is required");
    }
    if (apiFormat !== "openai" && apiFormat !== "anthropic" && apiFormat !== "lmstudio") {
      throw new Error("LLM_API_FORMAT must be 'openai', 'anthropic', or 'lmstudio'");
    }

    this.allowLocal = allowLocal;
    this.endpoint = this.normalizeEndpoint(validateLLMEndpoint(endpoint, allowLocal));
    this.model = model;
    this.apiFormat = apiFormat;
    this.apiKey = options.apiKey || process.env.LLM_API_KEY;
    this.anthropicVersion = options.anthropicVersion || process.env.LLM_ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION;
    this.lmStudioJitLoad = options.lmStudioJitLoad ?? process.env.LM_STUDIO_JIT_LOAD !== "0";
    this.lmStudioLoadConfig = {
      ...this.loadConfigFromEnv(),
      ...(options.lmStudioLoadConfig || {}),
    };
    this.needsApiKey = Boolean(this.apiKey);
    this.timeoutMs = options.timeoutMs || parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || HTTP_TIMEOUT;
    this.maxPayloadChars = options.maxPayloadChars || parseInt(process.env.LLM_MAX_PAYLOAD_CHARS || "", 10) || DEFAULT_MAX_PAYLOAD_CHARS;
    this.breaker = new CircuitBreaker(options.failureThreshold || 5, options.resetTimeoutMs || 60000);
    this.rateLimiter = new RateLimiter(
      options.maxRequests || parseInt(process.env.LLM_RATE_LIMIT || "", 10) || DEFAULT_MAX_REQUESTS,
      options.windowMs || parseInt(process.env.LLM_RATE_WINDOW_MS || "", 10) || DEFAULT_WINDOW_MS
    );
    this.maxConcurrency = parseInt(process.env.LLM_MAX_CONCURRENCY || "", 10) || 1;
    this.maxQueueSize = parseInt(process.env.LLM_MAX_QUEUE || "", 10) || 10;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
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

  private acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error("LLM provider busy — too many pending requests. Try again later."));
    }
    return new Promise<void>((resolve, reject) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
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
    await this.acquireSlot();
    try {
      // Attempt 1: normal prompt
      let result = await this._doTranslate(text, sourceLang, targetLang, options, buildSystemPrompt());

      // If output looks like garbage, retry once with a stricter prompt
      if (isGarbageOutput(text, result.translatedText)) {
        result = await this._doTranslate(text, sourceLang, targetLang, options, buildStrictSystemPrompt());
        if (isGarbageOutput(text, result.translatedText)) {
          throw new Error("LLM produced garbage output after retry");
        }
      }

      this.breaker.recordSuccess();
      return result;
    } finally {
      this.releaseSlot();
    }
  }

  private async _doTranslate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslateOptions | undefined,
    systemPrompt: string
  ): Promise<TranslationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const userPrompt = buildUserPrompt(text, sourceLang, targetLang, options);
      const headers = this.buildHeaders();
      if (this.apiFormat === "lmstudio" && this.lmStudioJitLoad) {
        await this.ensureLMStudioModelLoaded(headers, controller.signal);
      }

      const response = await fetchWithRedirects(this.inferenceUrl(), {
        init: {
          method: "POST",
          headers,
          body: JSON.stringify(this.buildRequestBody(systemPrompt, userPrompt)),
          signal: controller.signal,
        },
        validateUrl: (url) => validateLLMEndpoint(url, this.allowLocal),
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

      // Guard against runaway response sizes before parsing JSON
      const contentLength = response.headers.get("content-length");
      const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
        clearTimeout(timeoutId);
        throw new Error("LLM response exceeds maximum allowed size");
      }

      // Keep timeout active while reading body — start a fresh timeout race
      let bodyTimeoutId: ReturnType<typeof setTimeout> | undefined;
      const data = (await Promise.race([
        response.json(),
        new Promise<never>((_, reject) => {
          bodyTimeoutId = setTimeout(
            () => reject(new Error("Response body timed out")),
            this.timeoutMs
          );
        }),
      ])) as unknown;
      if (bodyTimeoutId) clearTimeout(bodyTimeoutId);
      clearTimeout(timeoutId);
      const translatedText = this.extractResponseText(data);
      if (!translatedText) {
        throw new Error("LLM response did not include translated content");
      }
      // Hard cap on translated text length to prevent downstream OOM/processing issues
      const MAX_RESPONSE_CHARS = 100_000;
      if (translatedText.length > MAX_RESPONSE_CHARS) {
        throw new Error(`LLM response too long: ${translatedText.length} chars exceeds max ${MAX_RESPONSE_CHARS}`);
      }

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

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (this.apiFormat === "anthropic") {
      headers["anthropic-version"] = this.anthropicVersion;
      if (this.apiKey) {
        headers["x-api-key"] = this.apiKey;
      }
      return headers;
    }

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildRequestBody(systemPrompt: string, userPrompt: string): Record<string, unknown> {
    if (this.apiFormat === "lmstudio") {
      return {
        model: this.model,
        system_prompt: systemPrompt,
        input: userPrompt,
        temperature: 0.2,
        max_output_tokens: 4096,
        store: false,
      };
    }

    if (this.apiFormat === "anthropic") {
      return {
        model: this.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      };
    }

    return {
      model: this.model,
      temperature: 0.2,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  }

  private extractResponseText(data: unknown): string | undefined {
    switch (this.apiFormat) {
      case "anthropic":
        return extractAnthropicText(data);
      case "lmstudio":
        return extractLMStudioText(data);
      default:
        return extractChatCompletionText(data);
    }
  }

  private normalizeEndpoint(endpoint: string): string {
    return this.apiFormat === "lmstudio"
      ? endpoint.replace(/\/+$/, "")
      : endpoint;
  }

  private inferenceUrl(): string {
    return this.apiFormat === "lmstudio"
      ? `${this.endpoint}/api/v1/chat`
      : this.endpoint;
  }

  private async ensureLMStudioModelLoaded(headers: Record<string, string>, signal: AbortSignal): Promise<void> {
    const listResponse = await fetch(`${this.endpoint}/api/v1/models`, {
      method: "GET",
      headers,
      signal,
    });
    if (!listResponse.ok) {
      throw new Error(`LM Studio models API error: ${listResponse.statusText}`);
    }
    const listContentType = listResponse.headers.get("content-type");
    if (!listContentType?.includes("application/json")) {
      throw new Error("Invalid LM Studio models response content type");
    }
    const listData = await listResponse.json() as { models?: Array<{ key?: string; loaded_instances?: unknown[] }> };
    const model = listData.models?.find((candidate) => candidate.key === this.model);
    if (model?.loaded_instances && model.loaded_instances.length > 0) {
      return;
    }

    const loadResponse = await fetch(`${this.endpoint}/api/v1/models/load`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        ...this.lmStudioLoadConfig,
      }),
      signal,
    });
    if (!loadResponse.ok) {
      throw new Error(`LM Studio load API error: ${loadResponse.statusText}`);
    }
  }

  private loadConfigFromEnv(): LLMProviderOptions["lmStudioLoadConfig"] {
    return {
      context_length: parseOptionalInteger(process.env.LM_STUDIO_CONTEXT_LENGTH),
      eval_batch_size: parseOptionalInteger(process.env.LM_STUDIO_EVAL_BATCH_SIZE),
      flash_attention: parseOptionalBoolean(process.env.LM_STUDIO_FLASH_ATTENTION),
      num_experts: parseOptionalInteger(process.env.LM_STUDIO_NUM_EXPERTS),
      offload_kv_cache_to_gpu: parseOptionalBoolean(process.env.LM_STUDIO_OFFLOAD_KV_CACHE_TO_GPU),
    };
  }
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}
