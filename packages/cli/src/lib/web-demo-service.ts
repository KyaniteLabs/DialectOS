import type { ProviderRegistry } from "@espanol/providers";
import type { FormalityLevel, SpanishDialect } from "@espanol/types";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import { validateContentLength } from "@espanol/security";
import { detectDialect } from "./dialect-info.js";
import { createProviderRegistry } from "./provider-factory.js";
import { translateWithFallback } from "./resilient-translation.js";
import { buildSemanticTranslationContext } from "./semantic-context.js";

export interface WebDemoTranslateRequest {
  text: string;
  dialect: SpanishDialect;
  provider?: string;
  formality?: FormalityLevel;
}

export interface WebDemoProviderStatus {
  configured: boolean;
  providers: string[];
  semanticProviders: string[];
  message: string;
}

export interface WebDemoTranslateResult {
  translatedText: string;
  dialect: SpanishDialect;
  providerUsed: string;
  fallbackCount: number;
  retryCount: number;
  sourceDetection: ReturnType<typeof detectDialect>;
  semanticContext: string;
  providerStatus: WebDemoProviderStatus;
}

const VALID_PROVIDERS = new Set(["auto", "llm", "deepl", "libre", "mymemory"]);

export function validateWebDemoDialect(dialect: string): SpanishDialect {
  if (!ALL_SPANISH_DIALECTS.includes(dialect as SpanishDialect)) {
    throw new Error(`Invalid dialect: ${dialect}`);
  }
  return dialect as SpanishDialect;
}

function validateWebDemoProvider(provider: string | undefined): string | undefined {
  if (!provider || provider === "auto") return undefined;
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }
  return provider;
}

export function getWebDemoProviderStatus(
  registry: ProviderRegistry = createProviderRegistry()
): WebDemoProviderStatus {
  const providers = registry.listProviders();
  const semanticProviders = providers.filter((name) =>
    registry.getCapabilities(name)?.dialectHandling === "semantic"
  );

  return {
    configured: providers.length > 0,
    providers,
    semanticProviders,
    message: providers.length > 0
      ? `Configured providers: ${providers.join(", ")}`
      : "No provider configured. Start a local OpenAI-compatible model or set LLM_API_URL + LLM_MODEL.",
  };
}

export async function translateForWebDemo(
  request: WebDemoTranslateRequest,
  registry: ProviderRegistry = createProviderRegistry()
): Promise<WebDemoTranslateResult> {
  const text = request.text.trim();
  if (!text) {
    throw new Error("No input text provided");
  }
  validateContentLength(text);

  const dialect = validateWebDemoDialect(request.dialect);
  const provider = validateWebDemoProvider(request.provider);
  const formality = request.formality ?? "auto";
  const providerStatus = getWebDemoProviderStatus(registry);
  if (!providerStatus.configured) {
    throw new Error(providerStatus.message);
  }

  const semanticContext = buildSemanticTranslationContext({
    text,
    dialect,
    formality,
    documentKind: "plain",
  });

  const translated = await translateWithFallback(
    registry,
    provider,
    text,
    "auto",
    "es",
    {
      dialect,
      formality,
      context: semanticContext,
    },
    { delayMs: 0 }
  );

  return {
    translatedText: translated.translatedText,
    dialect,
    providerUsed: translated.providerUsed,
    fallbackCount: translated.fallbackCount,
    retryCount: translated.retryCount,
    sourceDetection: detectDialect(text),
    semanticContext,
    providerStatus,
  };
}

