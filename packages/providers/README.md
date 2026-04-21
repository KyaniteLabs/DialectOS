# @espanol/providers

Translation providers with circuit breaker, retry logic, and capability negotiation.

## Supported Providers

| Provider | Auth Required | Dialect Support | Max Payload |
|----------|---------------|-----------------|-------------|
| LLM | Optional by gateway | Semantic dialect-aware | 50,000 chars default |
| DeepL | ✅ API key | Native/approximate | 50,000 chars |
| LibreTranslate | Optional | None | 5,000 chars |
| MyMemory | ❌ Free | None | 500 chars |

## Usage

```typescript
import { ProviderRegistry, LLMProvider, DeepLProvider, LibreTranslateProvider, MyMemoryProvider } from "@espanol/providers";

const registry = new ProviderRegistry();

// Register semantic provider first
registry.register(new LLMProvider({
  endpoint: process.env.LLM_API_URL,
  model: process.env.LLM_MODEL,
  apiKey: process.env.LLM_API_KEY,
}));

// Register fallback utilities
registry.register(new DeepLProvider(process.env.DEEPL_AUTH_KEY));
registry.register(new LibreTranslateProvider({ endpoint: "https://libretranslate.de" }));
registry.register(new MyMemoryProvider());

// Get best available provider; semantic dialect providers are preferred
const provider = registry.getAuto();
const result = await provider.translate("Hello", "en", "es");
```

## Capability Negotiation

```typescript
// Check if a provider supports a language
const errors = registry.validateRequest("deepl", text, "en", "es-MX", { formality: "formal" });
if (errors.length > 0) {
  console.log(errors[0].reason); // "Provider does not support dialect variants"
}
```

## Chaos Testing

```typescript
import { ChaosProvider } from "@espanol/providers";

const chaos = new ChaosProvider(realProvider, { mode: "http-5xx", failOnCalls: [1, 2] });
// Injects deterministic failures for resilience testing
```
