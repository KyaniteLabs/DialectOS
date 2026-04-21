/**
 * Tests for @espanol/providers package
 * Tests CircuitBreaker, RetryPolicy, ProviderRegistry, and all providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CircuitBreaker,
  RetryPolicy,
  ProviderRegistry,
  DeepLProvider,
  LibreTranslateProvider,
  MyMemoryProvider,
  LLMProvider,
  TranslationProvider,
  TranslationResult,
  ChaosProvider,
} from "../index.js";
import { SecurityError, ErrorCode, sanitizeErrorMessage } from "@espanol/security";

// Mock fetch for HTTP providers
global.fetch = vi.fn();

describe("CircuitBreaker", () => {
  it("should start in closed state", () => {
    const breaker = new CircuitBreaker(3, 1000);
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe("closed");
  });

  it("should open after failure threshold is reached", () => {
    const breaker = new CircuitBreaker(3, 1000);

    // Record failures up to threshold
    breaker.recordFailure();
    expect(breaker.getState()).toBe("closed");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("closed");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
    expect(breaker.canExecute()).toBe(false);
  });

  it("should transition to half-open after reset timeout", async () => {
    const breaker = new CircuitBreaker(3, 100); // 100ms timeout

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // canExecute() triggers transition to half-open
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe("half-open");
  });

  it("should close after success in half-open state", async () => {
    const breaker = new CircuitBreaker(3, 100); // 100ms timeout

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // canExecute() triggers transition to half-open
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe("half-open");

    // Record success
    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
  });

  it("should reopen on failure in half-open state", async () => {
    const breaker = new CircuitBreaker(3, 100); // 100ms timeout

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // canExecute() triggers transition to half-open
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe("half-open");

    // Record failure
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
    expect(breaker.canExecute()).toBe(false);
  });

  it("should reset failure count on success in closed state", () => {
    const breaker = new CircuitBreaker(5, 1000);

    // Some failures, then success
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();

    // Should need 5 more failures to open
    for (let i = 0; i < 4; i++) {
      breaker.recordFailure();
    }
    expect(breaker.getState()).toBe("closed");

    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
  });

  it("should allow only one probe request in half-open state", async () => {
    const breaker = new CircuitBreaker(3, 100); // 100ms timeout

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // First canExecute() should succeed and lock the probe
    expect(breaker.canExecute()).toBe(true);
    // Second concurrent canExecute() should fail while probe is in flight
    expect(breaker.canExecute()).toBe(false);
    expect(breaker.getState()).toBe("half-open");

    // After success, circuit closes and probe lock releases
    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });

  it("should auto-release probe lock after timeout if no result recorded", async () => {
    const breaker = new CircuitBreaker(3, 100); // 100ms timeout

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // First canExecute() locks the probe
    expect(breaker.canExecute()).toBe(true);
    // Second call fails immediately
    expect(breaker.canExecute()).toBe(false);

    // Simulate time passing beyond the probe lock timeout (5s)
    // We can't wait 5s in tests, so we verify the internal state:
    // If we manually reset the probe lock time to the past, it should allow a new probe
    (breaker as any).probeLockTime = Date.now() - 6000;
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe("half-open");
  });
});

describe("RetryPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should return result on first success", async () => {
    const policy = new RetryPolicy(3, 10, 100);
    const fn = vi.fn().mockResolvedValue("success");

    const result = await policy.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on network error", async () => {
    const policy = new RetryPolicy(3, 10, 100);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue("success");

    const result = await policy.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry on 400 client error", async () => {
    const policy = new RetryPolicy(3, 10, 100);
    const error = new Error("Bad Request");
    (error as any).statusCode = 400;
    const fn = vi.fn().mockRejectedValue(error);

    await expect(policy.execute(fn)).rejects.toThrow("Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on 500 server error", async () => {
    const policy = new RetryPolicy(3, 10, 100);
    const error = new Error("Internal Server Error");
    (error as any).statusCode = 500;
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue("success");

    const result = await policy.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should use exponential backoff with jitter", async () => {
    const policy = new RetryPolicy(3, 10, 100);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("success");

    const start = Date.now();
    await policy.execute(fn);
    const duration = Date.now() - start;

    // Should have taken at least 10ms (base delay) + some for second retry
    expect(duration).toBeGreaterThanOrEqual(10);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries exhausted", async () => {
    const policy = new RetryPolicy(2, 10, 100);
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));

    await expect(policy.execute(fn)).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should respect abort signal", async () => {
    const policy = new RetryPolicy(3, 1000, 5000);
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    const controller = new AbortController();

    // Abort after a short delay
    setTimeout(() => controller.abort(), 50);

    await expect(policy.execute(fn, { signal: controller.signal })).rejects.toThrow("Request aborted");
  });

  it("should respect maxTotalDurationMs", async () => {
    const policy = new RetryPolicy(3, 100, 5000);
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));

    await expect(policy.execute(fn, { maxTotalDurationMs: 50 })).rejects.toThrow("Retry exceeded total duration limit");
  });
});

describe("ProviderRegistry", () => {
  it("should register and retrieve providers", () => {
    const registry = new ProviderRegistry();
    const mockProvider: TranslationProvider = {
      name: "mock",
      translate: async () => ({ translatedText: "test" }),
    };

    registry.register(mockProvider);
    const retrieved = registry.get("mock");

    expect(retrieved).toBe(mockProvider);
  });

  it("should resolve canonical provider aliases", () => {
    const registry = new ProviderRegistry();
    const libreProvider: TranslationProvider = {
      name: "libretranslate",
      translate: async () => ({ translatedText: "test" }),
    };

    registry.register(libreProvider);

    expect(registry.get("libre")).toBe(libreProvider);
    expect(registry.isAvailable("libre")).toBe(true);
  });

  it("should not alias nonexistent DeepL free provider to DeepL", () => {
    const registry = new ProviderRegistry();
    const deeplProvider: TranslationProvider = {
      name: "deepl",
      translate: async () => ({ translatedText: "test" }),
    };

    registry.register(deeplProvider);

    expect(() => registry.get("deepl-free")).toThrow("Provider not available");
  });

  it("should throw when getting non-existent provider", () => {
    const registry = new ProviderRegistry();

    expect(() => registry.get("nonexistent")).toThrow("Provider not available");
  });

  it("should return first available provider with getAuto", () => {
    const registry = new ProviderRegistry();

    const mockProvider1: TranslationProvider = {
      name: "provider1",
      translate: async () => ({ translatedText: "test1" }),
    };

    const mockProvider2: TranslationProvider = {
      name: "provider2",
      translate: async () => ({ translatedText: "test2" }),
    };

    registry.register(mockProvider1);
    registry.register(mockProvider2);

    const auto = registry.getAuto();
    expect(auto).toBe(mockProvider1);
  });

  it("should skip providers with open circuits in getAuto", () => {
    const registry = new ProviderRegistry();

    const mockProvider1: TranslationProvider = {
      name: "provider1",
      translate: async () => ({ translatedText: "test1" }),
    };

    const mockProvider2: TranslationProvider = {
      name: "provider2",
      translate: async () => ({ translatedText: "test2" }),
    };

    registry.register(mockProvider1);
    registry.register(mockProvider2);

    // Open circuit on first provider
    const breaker1 = (registry as any).providers.get("provider1")?.breaker;
    if (breaker1) {
      for (let i = 0; i < 5; i++) {
        breaker1.recordFailure();
      }
    }

    const auto = registry.getAuto();
    expect(auto).toBe(mockProvider2);
  });

  it("should throw when all providers have open circuits", () => {
    const registry = new ProviderRegistry();

    const mockProvider1: TranslationProvider = {
      name: "provider1",
      translate: async () => ({ translatedText: "test1" }),
    };

    const mockProvider2: TranslationProvider = {
      name: "provider2",
      translate: async () => ({ translatedText: "test2" }),
    };

    registry.register(mockProvider1);
    registry.register(mockProvider2);

    // Open all circuits
    for (const [_, entry] of (registry as any).providers) {
      if (entry.breaker) {
        for (let i = 0; i < 5; i++) {
          entry.breaker.recordFailure();
        }
      }
    }

    expect(() => registry.getAuto()).toThrow("No translation providers are currently available");
  });

  it("should list all registered provider names", () => {
    const registry = new ProviderRegistry();

    const mockProvider1: TranslationProvider = {
      name: "provider1",
      translate: async () => ({ translatedText: "test1" }),
    };

    const mockProvider2: TranslationProvider = {
      name: "provider2",
      translate: async () => ({ translatedText: "test2" }),
    };

    registry.register(mockProvider1);
    registry.register(mockProvider2);

    const names = registry.listProviders();
    expect(names).toEqual(["provider1", "provider2"]);
  });
});

describe("DeepLProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should translate text successfully", async () => {
    const mockClient = {
      translateText: vi.fn().mockResolvedValue({
        text: "Hola",
        detectedSourceLang: "EN",
      }),
    };

    const provider = new DeepLProvider("test-key", mockClient as any);

    const result = await provider.translate("Hello", "en", "es");

    expect(result.translatedText).toBe("Hola");
    expect(result.detectedSourceLang).toBe("EN");
    expect(mockClient.translateText).toHaveBeenCalledWith(
      "Hello",
      "EN",
      "ES",
      expect.objectContaining({
        formality: "default",
      })
    );
  });

  it("should map formality correctly", async () => {
    const mockClient = {
      translateText: vi.fn().mockResolvedValue({
        text: "Hola",
      }),
    };

    const provider = new DeepLProvider("test-key", mockClient as any);

    await provider.translate("Hello", "en", "es", { formality: "formal" });
    expect(mockClient.translateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        formality: "more",
      })
    );

    await provider.translate("Hello", "en", "es", { formality: "informal" });
    expect(mockClient.translateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        formality: "less",
      })
    );
  });

  it("should pass context to DeepL", async () => {
    const mockClient = {
      translateText: vi.fn().mockResolvedValue({
        text: "Hola",
      }),
    };

    const provider = new DeepLProvider("test-key", mockClient as any);

    await provider.translate("Hello", "en", "es", {
      context: "This is a greeting",
    });

    expect(mockClient.translateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        context: "This is a greeting",
      })
    );
  });

  it("should handle auto-detect source language", async () => {
    const mockClient = {
      translateText: vi.fn().mockResolvedValue({
        text: "Hola",
        detectedSourceLang: "EN",
      }),
    };

    const provider = new DeepLProvider("test-key", mockClient as any);

    await provider.translate("Hello", "auto", "es");

    expect(mockClient.translateText).toHaveBeenCalledWith(
      "Hello",
      null,
      "ES",
      expect.any(Object)
    );
  });

  it("should sanitize error messages", async () => {
    const mockClient = {
      translateText: vi.fn().mockRejectedValue(
        new Error("API key sk-1234567890abcdefghijklmnopqrst failed")
      ),
    };

    const provider = new DeepLProvider("test-key", mockClient as any);

    try {
      await provider.translate("Hello", "en", "es");
    } catch (error) {
      expect((error as Error).message).not.toContain("sk-1234567890abcdefghijklmnopqrst");
      expect((error as Error).message).toContain("[REDACTED]");
    }
  });
});

describe("LibreTranslateProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
  });

  it("should translate text successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        translatedText: "Hola",
        detectedLanguage: { language: "en" },
      }),
    } as any);

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com";
    const provider = new LibreTranslateProvider();

    const result = await provider.translate("Hello", "en", "es");

    expect(result.translatedText).toBe("Hola");
    expect(result.detectedSourceLang).toBe("EN");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://libretranslate.com/translate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining("Hello"),
      })
    );
  });

  it("should include API key in header if provided", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({ translatedText: "Hola" }),
    } as any);

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com";
    process.env.LIBRETRANSLATE_API_KEY = "test-key-123";
    const provider = new LibreTranslateProvider();

    await provider.translate("Hello", "en", "es");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Authorization": "Bearer test-key-123",
        }),
      })
    );
  });

  it("should validate content-type", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "text/html";
          return null;
        },
      },
      json: async () => ({}),
    } as any);

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com";
    const provider = new LibreTranslateProvider();

    await expect(provider.translate("Hello", "en", "es")).rejects.toThrow(
      "Invalid response content type"
    );
  });

  it("should throw if LIBRETRANSLATE_URL is not set", () => {
    delete process.env.LIBRETRANSLATE_URL;

    expect(() => new LibreTranslateProvider()).toThrow(
      "LIBRETRANSLATE_URL environment variable is required"
    );
  });

  it("should handle timeout", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    vi.mocked(global.fetch).mockImplementation(() =>
      new Promise((_, reject) => {
        setTimeout(() => reject(abortError), 100);
      })
    );

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com";
    const provider = new LibreTranslateProvider();

    await expect(provider.translate("Hello", "en", "es")).rejects.toThrow(
      "Request timed out"
    );
  });
});

describe("MyMemoryProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
  });

  it("should translate text successfully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        responseData: {
          translatedText: "Hola",
        },
        responseStatus: 200,
      }),
    } as any);

    const provider = new MyMemoryProvider({ maxRetries: 0, retryDelayMs: 1 });

    const result = await provider.translate("Hello", "en", "es");

    expect(result.translatedText).toBe("Hola");
  });

  it("should not include auth header", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        responseData: { translatedText: "Hola" },
        responseStatus: 200,
      }),
    } as any);

    const provider = new MyMemoryProvider({ maxRetries: 0, retryDelayMs: 1 });
    await provider.translate("Hello", "en", "es");

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    const fetchOptions = fetchCall[1];

    // Check that either there's no headers object, or it doesn't contain Authorization
    if (fetchOptions && fetchOptions.headers) {
      expect(fetchOptions.headers).not.toHaveProperty("Authorization");
    }
  });

  it("should validate content-type", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "text/html";
          return null;
        },
      },
      json: async () => ({}),
    } as any);

    const provider = new MyMemoryProvider({ maxRetries: 0, retryDelayMs: 1 });

    await expect(provider.translate("Hello", "en", "es")).rejects.toThrow(
      "Invalid response content type"
    );
  });

  it("should translate long text by chunking", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        responseData: { translatedText: "translated" },
        responseStatus: 200,
      }),
    } as any);

    const provider = new MyMemoryProvider({
      maxRequests: 1000,
      maxRetries: 0,
      retryDelayMs: 1,
    });

    const longText = "a".repeat(6000);
    const result = await provider.translate(longText, "en", "es");
    expect(result.translatedText.length).toBeGreaterThan(0);
    expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(1);
  });
});

describe("Error sanitization", () => {
  it("should sanitize provider errors", async () => {
    vi.mocked(global.fetch).mockRejectedValue(
      new Error("Request failed with API key sk-secret1234567890abcdef")
    );

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
    const provider = new LibreTranslateProvider();

    try {
      await provider.translate("Hello", "en", "es");
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("sk-secret1234567890abcdef");
    }
  });
});

describe("Rate limiting", () => {
  it("should allow requests within rate limit", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        responseData: { translatedText: "translated" },
        responseStatus: 200,
      }),
    } as any);

    const provider = new MyMemoryProvider();

    // Should succeed
    await provider.translate("Hello", "en", "es");
    await provider.translate("World", "en", "es");
  });

  it("should throw when rate limit exceeded", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === "content-type") return "application/json";
          return null;
        },
      },
      json: async () => ({
        responseData: { translatedText: "translated" },
        responseStatus: 200,
      }),
    } as any);

    // Create provider with very low rate limit for testing
    const provider = new MyMemoryProvider();
    (provider as any).rateLimiter = new (await import("@espanol/security")).RateLimiter(2, 1000);

    // Should succeed first 2 times
    await provider.translate("Hello", "en", "es");
    await provider.translate("World", "en", "es");

    // Should throw on 3rd
    await expect(provider.translate("Test", "en", "es")).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});

describe("Provider capabilities", () => {

  it("LLM should report semantic dialect support", () => {
    const provider = new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "dialect-model",
      apiKey: "test-key",
    });
    const caps = provider.getCapabilities!();
    expect(caps.name).toBe("llm");
    expect(caps.supportsFormality).toBe(true);
    expect(caps.supportsContext).toBe(true);
    expect(caps.supportsDialect).toBe(true);
    expect(caps.dialectHandling).toBe("semantic");
    expect(caps.needsApiKey).toBe(true);
    expect(caps.supportedTargetLangs).toContain("es");
  });

  it("LLM should send dialect context to an OpenAI-compatible chat endpoint", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => name === "content-type" ? "application/json" : null,
      },
      json: async () => ({
        choices: [{ message: { content: "Vos podés actualizar tu cuenta ahora." } }],
      }),
    } as any);

    const provider = new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "dialect-model",
      apiKey: "test-key",
    });

    const result = await provider.translate("You can update your account now.", "en", "es", {
      dialect: "es-AR",
      formality: "informal",
      context: "Use pronominal and verbal voseo.",
    });

    expect(result.translatedText).toBe("Vos podés actualizar tu cuenta ahora.");
    expect(result.provider).toBe("llm");
    expect(result.dialect).toBe("es-AR");
    expect(global.fetch).toHaveBeenCalledWith("https://llm.example/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      }),
    }));
    const body = JSON.parse(vi.mocked(global.fetch).mock.calls.at(-1)![1]!.body as string);
    expect(body.model).toBe("dialect-model");
    expect(body.messages[0].content).toContain("semantic dialect-aware Spanish translation engine");
    expect(body.messages[1].content).toContain("Target dialect: es-AR");
    expect(body.messages[1].content).toContain("Use pronominal and verbal voseo");
    expect(body.messages[1].content).toContain("You can update your account now.");
  });

  it("LLM should reject missing chat completions content", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ choices: [] }),
    } as any);

    const provider = new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "dialect-model",
    });

    await expect(provider.translate("Hello", "en", "es", { dialect: "es-MX" })).rejects.toThrow(
      "LLM response did not include translated content"
    );
  });
  it("DeepL should report native dialect support", () => {
    const provider = new DeepLProvider("test-key", undefined, {
      timeout: 5000,
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      maxRequests: 10,
      windowMs: 1000,
    });
    const caps = provider.getCapabilities!();
    expect(caps.name).toBe("deepl");
    expect(caps.supportsFormality).toBe(true);
    expect(caps.supportsDialect).toBe(true);
    expect(caps.dialectHandling).toBe("native");
    expect(caps.needsApiKey).toBe(true);
    expect(caps.maxPayloadChars).toBe(50000);
    expect(caps.supportedTargetLangs).toContain("es");
    expect(caps.rateLimitHints).toEqual({ maxRequests: 60, windowMs: 60000 });
  });

  it("LibreTranslate should report no dialect support", () => {
    const provider = new LibreTranslateProvider({
      endpoint: "https://libretranslate.de",
    });
    const caps = provider.getCapabilities!();
    expect(caps.name).toBe("libretranslate");
    expect(caps.supportsFormality).toBe(false);
    expect(caps.supportsDialect).toBe(false);
    expect(caps.dialectHandling).toBe("none");
    expect(caps.needsApiKey).toBe(false);
    expect(caps.maxPayloadChars).toBe(5000);
  });

  it("MyMemory should report small payload limit", () => {
    const provider = new MyMemoryProvider();
    const caps = provider.getCapabilities!();
    expect(caps.name).toBe("mymemory");
    expect(caps.maxPayloadChars).toBe(500);
    expect(caps.dialectHandling).toBe("none");
    expect(caps.rateLimitHints).toEqual({ maxRequests: 10, windowMs: 60000 });
  });


  it("Registry auto should prefer semantic dialect providers over generic providers", () => {
    const registry = new ProviderRegistry();
    const generic: TranslationProvider = {
      name: "generic",
      translate: async () => ({ translatedText: "genérico" }),
      getCapabilities: () => ({
        name: "generic",
        displayName: "Generic",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en", "auto"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 1000,
        dialectHandling: "none",
      }),
    };
    const semantic: TranslationProvider = {
      name: "semantic",
      translate: async () => ({ translatedText: "vos podés" }),
      getCapabilities: () => ({
        name: "semantic",
        displayName: "Semantic",
        needsApiKey: true,
        supportsFormality: true,
        supportsContext: true,
        supportsDialect: true,
        supportedSourceLangs: ["en", "auto"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 1000,
        dialectHandling: "semantic",
      }),
    };

    registry.register(generic);
    registry.register(semantic);

    expect(registry.getAuto().name).toBe("semantic");
  });

  it("Registry should preserve dialect and context for semantic providers", () => {
    const registry = new ProviderRegistry();
    registry.register(new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "dialect-model",
    }));

    const prepared = registry.prepareRequest("llm", "hello", "auto", "es", {
      dialect: "es-PR",
      formality: "formal",
      context: "Use Puerto Rican vocabulary naturally.",
    });

    expect(prepared.targetLang).toBe("es");
    expect(prepared.options.dialect).toBe("es-PR");
    expect(prepared.options.context).toContain("Puerto Rican");
    expect(prepared.options.formality).toBe("formal");
    expect(prepared.warnings).toEqual([]);
  });

  it("Registry should return capabilities by name", () => {
    const registry = new ProviderRegistry();
    const mockProvider: TranslationProvider = {
      name: "mock",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "mock",
        displayName: "Mock",
        needsApiKey: false,
        supportsFormality: true,
        supportsContext: false,
        supportsDialect: true,
        supportedSourceLangs: ["en", "es"],
        supportedTargetLangs: ["en", "es", "fr"],
        maxPayloadChars: 1000,
        dialectHandling: "approximate",
      }),
    };

    registry.register(mockProvider);
    const caps = registry.getCapabilities("mock");

    expect(caps).not.toBeNull();
    expect(caps!.maxPayloadChars).toBe(1000);
    expect(caps!.dialectHandling).toBe("approximate");
  });

  it("Registry should find providers by target language", () => {
    const registry = new ProviderRegistry();
    const providerEs: TranslationProvider = {
      name: "es-only",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "es-only",
        displayName: "ES Only",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 1000,
        dialectHandling: "none",
      }),
    };
    const providerFr: TranslationProvider = {
      name: "fr-only",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "fr-only",
        displayName: "FR Only",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["fr"],
        maxPayloadChars: 1000,
        dialectHandling: "none",
      }),
    };

    registry.register(providerEs);
    registry.register(providerFr);

    const esProviders = registry.findByTargetLang("es");
    expect(esProviders).toHaveLength(1);
    expect(esProviders[0].name).toBe("es-only");

    const frProviders = registry.findByTargetLang("fr");
    expect(frProviders).toHaveLength(1);
    expect(frProviders[0].name).toBe("fr-only");
  });

  it("Registry validateRequest should catch oversized payloads", () => {
    const registry = new ProviderRegistry();
    const provider: TranslationProvider = {
      name: "tiny",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "tiny",
        displayName: "Tiny",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 10,
        dialectHandling: "none",
      }),
    };

    registry.register(provider);
    const errors = registry.validateRequest("tiny", "this is way too long", "en", "es");

    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain("Payload too large");
  });

  it("Registry validateRequest should catch unsupported languages", () => {
    const registry = new ProviderRegistry();
    const provider: TranslationProvider = {
      name: "mono",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "mono",
        displayName: "Mono",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 10000,
        dialectHandling: "none",
      }),
    };

    registry.register(provider);
    const errors = registry.validateRequest("mono", "hi", "de", "ja");

    expect(errors.length).toBeGreaterThanOrEqual(2);
    const reasons = errors.map((e) => e.reason);
    expect(reasons.some((r) => r.includes("Unsupported source language"))).toBe(true);
    expect(reasons.some((r) => r.includes("Unsupported target language"))).toBe(true);
  });

  it("Registry validateRequest should catch unsupported dialect", () => {
    const registry = new ProviderRegistry();
    const provider: TranslationProvider = {
      name: "nodialect",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "nodialect",
        displayName: "No Dialect",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 10000,
        dialectHandling: "none",
      }),
    };

    registry.register(provider);
    const errors = registry.validateRequest("nodialect", "hi", "en", "es", {
      dialect: "es-MX",
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain("does not support dialect");
  });

  it("Registry should prepare dialect requests for providers without native dialect support", () => {
    const registry = new ProviderRegistry();
    const provider: TranslationProvider = {
      name: "nodialect",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "nodialect",
        displayName: "No Dialect",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en", "auto"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 10000,
        dialectHandling: "none",
      }),
    };

    registry.register(provider);
    const prepared = registry.prepareRequest("nodialect", "hello", "en", "es-MX", {
      dialect: "es-MX",
    });

    expect(prepared.targetLang).toBe("es");
    expect(prepared.options).not.toHaveProperty("dialect");
    expect(prepared.warnings).toContain("Provider nodialect does not support dialect es-MX; using generic Spanish target es");
  });

  it("Registry validateRequest should return empty for valid requests", () => {
    const registry = new ProviderRegistry();
    const provider: TranslationProvider = {
      name: "good",
      translate: async () => ({ translatedText: "test" }),
      getCapabilities: () => ({
        name: "good",
        displayName: "Good",
        needsApiKey: false,
        supportsFormality: true,
        supportsContext: false,
        supportsDialect: true,
        supportedSourceLangs: ["en", "auto"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 10000,
        dialectHandling: "native",
      }),
    };

    registry.register(provider);
    const errors = registry.validateRequest("good", "hello", "auto", "es", {
      formality: "formal",
      dialect: "es-MX",
    });

    expect(errors).toHaveLength(0);
  });
});

describe("ChaosProvider", () => {
  it("should inject timeout errors", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "timeout" });
    await expect(chaos.translate("hi", "en", "es")).rejects.toThrow(
      "simulated timeout"
    );
  });

  it("should inject HTTP 5xx errors", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "http-5xx" });
    await expect(chaos.translate("hi", "en", "es")).rejects.toThrow("500");
  });

  it("should inject HTTP 429 errors", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "http-429" });
    await expect(chaos.translate("hi", "en", "es")).rejects.toThrow("429");
  });

  it("should inject latency but eventually succeed", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "latency", delayMs: 50 });
    const start = Date.now();
    const result = await chaos.translate("hi", "en", "es");
    const elapsed = Date.now() - start;

    expect(result.translatedText).toBe("ok");
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("should inject partial failures (empty response)", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "partial-failure" });
    const result = await chaos.translate("hi", "en", "es");

    expect(result.translatedText).toBe("");
  });

  it("should only fail on specified call indices", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, {
      mode: "timeout",
      failOnCalls: [2, 3],
    });

    // Call 1 succeeds
    const r1 = await chaos.translate("a", "en", "es");
    expect(r1.translatedText).toBe("ok");

    // Call 2 fails
    await expect(chaos.translate("b", "en", "es")).rejects.toThrow();

    // Call 3 fails
    await expect(chaos.translate("c", "en", "es")).rejects.toThrow();

    // Call 4 succeeds
    const r4 = await chaos.translate("d", "en", "es");
    expect(r4.translatedText).toBe("ok");
  });

  it("should delegate getCapabilities to inner provider", () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
      getCapabilities: () => ({
        name: "stable",
        displayName: "Stable",
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: ["en"],
        supportedTargetLangs: ["es"],
        maxPayloadChars: 1000,
        dialectHandling: "none",
      }),
    };

    const chaos = new ChaosProvider(inner, { mode: "timeout" });
    const caps = chaos.getCapabilities();

    expect(caps).not.toBeNull();
    expect(caps!.name).toBe("stable");
    expect(caps!.maxPayloadChars).toBe(1000);
  });

  it("should track call count", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "latency", delayMs: 1 });
    expect(chaos.getCallCount()).toBe(0);

    await chaos.translate("a", "en", "es");
    expect(chaos.getCallCount()).toBe(1);

    await chaos.translate("b", "en", "es");
    expect(chaos.getCallCount()).toBe(2);
  });

  it("should reset call count", async () => {
    const inner: TranslationProvider = {
      name: "stable",
      translate: async () => ({ translatedText: "ok" }),
    };

    const chaos = new ChaosProvider(inner, { mode: "latency", delayMs: 1 });
    await chaos.translate("a", "en", "es");
    expect(chaos.getCallCount()).toBe(1);

    chaos.reset();
    expect(chaos.getCallCount()).toBe(0);
  });

  it("should demonstrate registry fallback under chaos", async () => {
    const registry = new ProviderRegistry();

    // Primary provider fails with 5xx
    const primary: TranslationProvider = {
      name: "primary",
      translate: async () => ({ translatedText: "primary" }),
    };
    const chaosPrimary = new ChaosProvider(primary, { mode: "http-5xx" });

    // Fallback provider succeeds
    const fallback: TranslationProvider = {
      name: "fallback",
      translate: async () => ({ translatedText: "fallback" }),
    };

    registry.register(chaosPrimary);
    registry.register(fallback);

    // First call opens circuit on chaos-primary after failure
    await expect(
      registry.get("chaos-primary").translate("hi", "en", "es")
    ).rejects.toThrow("500");

    // Circuit breaker records failure
    registry.recordFailure("chaos-primary");

    // getAuto should skip chaos-primary if circuit is open
    // (manually open it for deterministic test)
    const breaker = registry.getBreaker("chaos-primary");
    if (breaker) {
      for (let i = 0; i < 5; i++) breaker.recordFailure();
    }

    const auto = registry.getAuto();
    expect(auto.name).toBe("fallback");
    const result = await auto.translate("hi", "en", "es");
    expect(result.translatedText).toBe("fallback");
  });
});
