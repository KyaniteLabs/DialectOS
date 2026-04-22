import type { ProviderRegistry } from "@espanol/providers";
import type { FormalityLevel, SpanishDialect } from "@espanol/types";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import { validateContentLength } from "@espanol/security";
import { detectDialect } from "./dialect-info.js";
import { createProviderRegistry } from "./provider-factory.js";
import { buildSemanticTranslationContext } from "./semantic-context.js";

export interface WebDemoTranslateRequest {
  text: string;
  dialect: SpanishDialect;
  provider?: string;
  formality?: FormalityLevel;
}

export interface WebDemoProviderStatus {
  configured: boolean;
  ready: boolean;
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
  semanticPromptApplied: boolean;
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
    ready: semanticProviders.length > 0,
    providers,
    semanticProviders,
    message: semanticProviders.length > 0
      ? `Semantic providers ready: ${semanticProviders.join(", ")}`
      : providers.length > 0
        ? `Configured providers are not semantic enough for the full-app demo: ${providers.join(", ")}. Start an LLM provider with LLM_API_URL + LLM_MODEL.`
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
  if (!providerStatus.ready) {
    throw new Error(providerStatus.message);
  }
  if (provider && !providerStatus.semanticProviders.includes(provider)) {
    throw new Error(`Provider ${provider} is not semantic enough for the full-app demo. Use one of: ${providerStatus.semanticProviders.join(", ")}`);
  }

  const semanticContext = buildSemanticTranslationContext({
    text,
    dialect,
    formality,
    documentKind: "plain",
  });

  const translated = await translateWithSemanticDemoProviders(
    registry,
    provider ? [provider] : providerStatus.semanticProviders,
    text,
    "auto",
    "es",
    {
      dialect,
      formality,
      context: semanticContext,
    },
  );

  return {
    translatedText: translated.translatedText,
    dialect,
    providerUsed: translated.providerUsed,
    fallbackCount: translated.fallbackCount,
    retryCount: translated.retryCount,
    sourceDetection: detectDialect(text),
    semanticPromptApplied: true,
    providerStatus,
  };
}

async function translateWithSemanticDemoProviders(
  registry: ProviderRegistry,
  providers: string[],
  text: string,
  sourceLang: string,
  targetLang: string,
  options: {
    dialect: SpanishDialect;
    formality: FormalityLevel;
    context: string;
  }
): Promise<{
  translatedText: string;
  providerUsed: string;
  fallbackCount: number;
  retryCount: number;
}> {
  const errors: string[] = [];
  for (const [attemptIndex, name] of providers.entries()) {
    try {
      const provider = registry.get(name);
      const prepared = registry.prepareRequest(name, text, sourceLang, targetLang, options);
      const result = await provider.translate(
        text,
        prepared.sourceLang,
        prepared.targetLang,
        prepared.options
      );
      registry.recordSuccess(name);
      return {
        translatedText: result.translatedText,
        providerUsed: provider.name,
        fallbackCount: attemptIndex,
        retryCount: 0,
      };
    } catch (error) {
      registry.recordFailure(name);
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All semantic demo providers failed (${providers.join(" -> ")}): ${errors.join(" | ")}`);
}
