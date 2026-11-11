/**
 * DeepL translation provider
 * Uses DeepL's HTTP API directly to avoid SDK transitive dependency risk.
 */

import type { TranslationProvider, TranslationResult, ProviderCapability } from "../types.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { fetchWithRedirects } from "../fetch-utils.js";
import { RateLimiter, sanitizeErrorMessage, HTTP_TIMEOUT, validateContentLength, SecurityError, ErrorCode } from "@dialectos/security";
import { languageCodeSchema } from "@dialectos/types";

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

type DeepLFormality = "more" | "less" | "default";
type DeepLTranslateOptions = { formality?: DeepLFormality; context?: string };
type DeepLTranslation = { text: string; detectedSourceLang?: string };
type DeepLClientLike = {
  translateText(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    options: DeepLTranslateOptions
  ): Promise<DeepLTranslation>;
};

function validateDeepLEndpoint(urlStr: string | undefined): string | undefined {
  if (!urlStr) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SecurityError("Invalid DeepL API URL", ErrorCode.INVALID_INPUT);
  }
  if (parsed.protocol !== "https:") {
    throw new SecurityError("DeepL API URL must use https", ErrorCode.INVALID_INPUT);
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = ["api.deepl.com", "api-free.deepl.com"];
  if (!allowedHosts.includes(hostname)) {
    throw new SecurityError(`DeepL API URL must point to ${allowedHosts.join(" or ")}`, ErrorCode.INVALID_INPUT);
  }
  return urlStr;
}

class FetchDeepLClient implements DeepLClientLike {
  constructor(
    private readonly authKey: string,
    private readonly timeoutMs: number,
    private readonly endpoint = validateDeepLEndpoint(process.env.DEEPL_API_URL) || (
      authKey.endsWith(":fx")
        ? "https://api-free.deepl.com/v2/translate"
        : "https://api.deepl.com/v2/translate"
    )
  ) {}

  async translateText(
    text: string,
    sourceLang: string | null,
    targetLang: string,
    options: DeepLTranslateOptions
  ): Promise<DeepLTranslation> {
    const body = new URLSearchParams();
    body.set("text", text);
    body.set("target_lang", targetLang);
    if (sourceLang) body.set("source_lang", sourceLang);
    if (options.formality && options.formality !== "default") body.set("formality", options.formality);
    if (options.context) body.set("context", options.context);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetchWithRedirects(this.endpoint, {
        init: {
          method: "POST",
          headers: {
            authorization: `DeepL-Auth-Key ${this.authKey}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          signal: controller.signal,
        },
        validateUrl: (url) => validateDeepLEndpoint(url),
      });
      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.status} ${response.statusText}`);
      }

      // Keep timeout active while reading body — start a fresh timeout race
      let bodyTimeout: ReturnType<typeof setTimeout> | undefined;
      const data = (await Promise.race([
        response.json(),
        new Promise<never>((_, reject) => {
          bodyTimeout = setTimeout(
            () => reject(new Error("Response body timed out")),
            this.timeoutMs
          );
        }),
      ])) as {
        translations?: Array<{ text?: unknown; detected_source_language?: unknown }>;
      };
      if (bodyTimeout) clearTimeout(bodyTimeout);

      const first = data.translations?.[0];
      if (!first || typeof first.text !== "string") {
        throw new Error("DeepL API response did not include translated text");
      }
      return {
        text: first.text,
        detectedSourceLang: typeof first.detected_source_language === "string"
          ? first.detected_source_language
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("DeepL request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class DeepLProvider implements TranslationProvider {
  readonly name = "deepl";
  private client: DeepLClientLike;
  private authKey: string;
  private breaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(
    apiKey?: string,
    mockClient?: DeepLClientLike,
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

    this.client = mockClient || new FetchDeepLClient(authKey, options?.timeout || HTTP_TIMEOUT);

    this.breaker = new CircuitBreaker(
      options?.failureThreshold || 5,
      options?.resetTimeoutMs || 60000
    );

    this.rateLimiter = new RateLimiter(
      options?.maxRequests || 60,
      options?.windowMs || 60000
    );
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.breaker;
  }

  getCapabilities(): ProviderCapability {
    return {
      name: this.name,
      displayName: "DeepL",
      needsApiKey: true,
      supportsFormality: true,
      supportsContext: true,
      // translate() sends the base code ("ES"), so a Spanish variant such as
      // es-MX comes back as generic Spanish. Say so, so the registry warns
      // and prefers a provider that can actually honour the dialect.
      supportsDialect: false,
      supportedSourceLangs: [...DEEPL_SUPPORTED_LANGS, "auto"],
      supportedTargetLangs: DEEPL_SUPPORTED_LANGS,
      maxPayloadChars: 50000,
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
    validateContentLength(text);

    const sourceResult = languageCodeSchema.safeParse(sourceLang === "auto" ? "en" : sourceLang);
    const targetResult = languageCodeSchema.safeParse(targetLang);
    if (!sourceResult.success || !targetResult.success) {
      throw new SecurityError("Invalid language code", ErrorCode.INVALID_INPUT);
    }

    if (!this.breaker.canExecute()) {
      throw new Error("DeepL provider is temporarily unavailable (circuit open)");
    }

    await this.rateLimiter.acquire();

    try {
      const formality = DEEPL_FORMALITY_MAP[options?.formality || "auto"] || "default";
      const translateOptions: DeepLTranslateOptions = { formality };
      if (options?.context) {
        translateOptions.context = options.context;
      }

      // DeepL only accepts base language codes (e.g., "ES", not "ES-MX")
      const targetLangUpper = targetLang.split("-")[0].toUpperCase();
      const sourceLangUpper = sourceLang === "auto" ? null : sourceLang.toUpperCase();

      const result = await this.client.translateText(
        text,
        sourceLangUpper,
        targetLangUpper,
        translateOptions
      );

      this.breaker.recordSuccess();

      return {
        translatedText: result.text,
        detectedSourceLang: result.detectedSourceLang?.toUpperCase(),
      };
    } catch (error) {
      this.breaker.recordFailure();

      let message = error instanceof Error ? error.message : String(error);
      // Redact the auth key case-insensitively (DeepL keys may appear in
      // different casing in some error responses).
      const lowerMessage = message.toLowerCase();
      const lowerKey = this.authKey.toLowerCase();
      let idx = lowerMessage.indexOf(lowerKey);
      while (idx !== -1) {
        message = message.slice(0, idx) + "[REDACTED]" + message.slice(idx + this.authKey.length);
        idx = message.toLowerCase().indexOf(lowerKey, idx + "[REDACTED]".length);
      }
      // Also redact the bare UUID part (without :fx suffix) which some
      // proxies or logs may strip.
      const uuidPart = this.authKey.split(":")[0];
      if (uuidPart && uuidPart !== this.authKey) {
        const lowerUuid = uuidPart.toLowerCase();
        idx = lowerMessage.indexOf(lowerUuid);
        while (idx !== -1) {
          message = message.slice(0, idx) + "[REDACTED]" + message.slice(idx + uuidPart.length);
          idx = message.toLowerCase().indexOf(lowerUuid, idx + "[REDACTED]".length);
        }
      }
      throw new Error(sanitizeErrorMessage(`DeepL error: ${message}`));
    }
  }
}
