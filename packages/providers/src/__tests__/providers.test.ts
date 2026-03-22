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
  TranslationProvider,
  TranslationResult,
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

    // Should be in half-open state
    expect(breaker.getState()).toBe("half-open");
    expect(breaker.canExecute()).toBe(true);
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

  it("should throw when getting non-existent provider", () => {
    const registry = new ProviderRegistry();

    expect(() => registry.get("nonexistent")).toThrow("Provider not found");
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

    expect(() => registry.getAuto()).toThrow("No available providers");
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

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
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

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
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

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
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

    process.env.LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
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

    const provider = new MyMemoryProvider();

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

    const provider = new MyMemoryProvider();
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

    const provider = new MyMemoryProvider();

    await expect(provider.translate("Hello", "en", "es")).rejects.toThrow(
      "Invalid response content type"
    );
  });

  it("should warn when text exceeds 5000 characters", async () => {
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
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const longText = "a".repeat(6000);
    await provider.translate(longText, "en", "es");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("exceeds 5000 character limit")
    );

    consoleSpy.mockRestore();
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
