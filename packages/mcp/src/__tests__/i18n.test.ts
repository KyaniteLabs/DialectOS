/**
 * Tests for MCP i18n tools
 * Tests the 6 MCP tools: detect_missing_keys, translate_missing_keys, batch_translate_locales,
 * manage_dialect_variants, check_formality, apply_gender_neutral
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock SecurityError class
class MockSecurityError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SecurityError";
    this.code = code;
  }
}

// Mock fs module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock the core libraries
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
  diffLocales: vi.fn(),
}));

vi.mock("@espanol/security", () => {
  // Create SecurityError inline
  class SecurityError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "SecurityError";
      this.code = code;
    }
  }

  return {
    validateJsonPath: vi.fn(),
    validateFilePath: vi.fn(),
    validateContentLength: vi.fn(),
    RateLimiter: vi.fn().mockImplementation(() => ({
      acquire: vi.fn().mockResolvedValue(undefined),
    })),
    SecurityError,
    createSafeError: vi.fn((error) => {
      if (error.code) {
        return { error: error.message, code: error.code };
      }
      return {
        error: error instanceof Error ? error.message : String(error),
        code: "INVALID_INPUT",
      };
    }),
    MAX_ARRAY_LENGTH: 20,
  };
});

vi.mock("@espanol/providers", () => ({
  ProviderRegistry: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    getAuto: vi.fn(),
    register: vi.fn(),
  })),
  DeepLProvider: vi.fn(),
  LibreTranslateProvider: vi.fn(),
  MyMemoryProvider: vi.fn(),
}));

import {
  readLocaleFile,
  writeLocaleFile,
  diffLocales,
} from "@espanol/locale-utils";
import {
  validateJsonPath,
  validateFilePath,
  RateLimiter,
  createSafeError,
  MAX_ARRAY_LENGTH,
} from "@espanol/security";
import { ProviderRegistry } from "@espanol/providers";

describe("MCP i18n Tools", () => {
  let mockRegistry: ProviderRegistry;
  let mockRateLimiter: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock rate limiter
    mockRateLimiter = {
      acquire: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(RateLimiter).mockImplementation(() => mockRateLimiter);

    // Create mock registry
    mockRegistry = {
      get: vi.fn(),
      getAuto: vi.fn(),
      register: vi.fn(),
    } as unknown as ProviderRegistry;

    // Mock provider translate
    const mockTranslate = vi.fn().mockResolvedValue({
      translatedText: "Hola Mundo",
      provider: "mymemory" as const,
    });

    mockRegistry.get = vi.fn().mockReturnValue({
      name: "mymemory",
      translate: mockTranslate,
    });

    mockRegistry.getAuto = vi.fn().mockReturnValue({
      name: "mymemory",
      translate: mockTranslate,
    });

    // Mock readLocaleFile to return sample data
    vi.mocked(readLocaleFile).mockReturnValue([
      { key: "hello", value: "Hello World" },
      { key: "goodbye", value: "Goodbye" },
      { key: "welcome", value: "Welcome" },
    ]);

    // Mock diffLocales
    vi.mocked(diffLocales).mockReturnValue({
      missingInTarget: ["welcome"],
      extraInTarget: [],
      commonKeys: ["hello", "goodbye"],
    });

    // Mock validateJsonPath
    vi.mocked(validateJsonPath).mockReturnValue("/test/locale.json");

    // Mock validateFilePath
    vi.mocked(validateFilePath).mockReturnValue("/test/locales");

    // Mock writeLocaleFile
    vi.mocked(writeLocaleFile).mockReturnValue(undefined);
  });

  describe("Tool Registration", () => {
    it("should register all 6 i18n tools", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(6);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map((call) => call[0]);
      expect(toolNames).toContain("detect_missing_keys");
      expect(toolNames).toContain("translate_missing_keys");
      expect(toolNames).toContain("batch_translate_locales");
      expect(toolNames).toContain("manage_dialect_variants");
      expect(toolNames).toContain("check_formality");
      expect(toolNames).toContain("apply_gender_neutral");
    });
  });

  describe("detect_missing_keys tool", () => {
    it("should detect missing keys between locale files", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      expect(detectCall).toBeDefined();

      const handler = detectCall![3];
      const params = {
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
      };

      const result = await handler(params as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.missingInTarget).toEqual(["welcome"]);
      expect(parsedResult.extraInTarget).toEqual([]);
      expect(parsedResult.commonKeys).toEqual(["hello", "goodbye"]);
    });

    it("should handle invalid path errors", async () => {
      vi.mocked(validateJsonPath).mockImplementation(() => {
        throw new MockSecurityError("Invalid path", "PATH_TRAVERSAL" as any);
      });

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      const handler = detectCall![3];

      const result = await handler({
        basePath: "/invalid/base.json",
        targetPath: "/test/target.json",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // The error is returned with "Invalid path" message and default code
      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("translate_missing_keys tool", () => {
    it("should translate missing keys from base to target locale", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_missing_keys"
      );
      expect(translateCall).toBeDefined();

      const handler = translateCall![3];
      const params = {
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
        dialect: "es-ES" as const,
        provider: "mymemory" as const,
      };

      const result = await handler(params as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translatedCount).toBe(1);
      expect(parsedResult.missingKeys).toEqual(["welcome"]);
      expect(writeLocaleFile).toHaveBeenCalled();
    });

    it("should handle when no keys are missing", async () => {
      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: [],
        extraInTarget: [],
        commonKeys: ["hello", "goodbye", "welcome"],
      });

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_missing_keys"
      );
      const handler = translateCall![3];

      const result = await handler({
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
      } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translatedCount).toBe(0);
      expect(parsedResult.missingKeys).toEqual([]);
    });
  });

  describe("batch_translate_locales tool", () => {
    it("should translate base locale to multiple target dialects", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const batchCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "batch_translate_locales"
      );
      expect(batchCall).toBeDefined();

      const handler = batchCall![3];
      const params = {
        directory: "/test/locales",
        baseLocale: "en",
        targets: ["es-MX", "es-AR", "es-CO"] as const,
        provider: "mymemory" as const,
      };

      const result = await handler(params as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.totalKeys).toBe(3);
      // totalTranslated will be 0 in this test because readLocaleFile returns all keys
      // and the diff shows no missing keys to translate
      expect(parsedResult.targets).toEqual(["es-MX", "es-AR", "es-CO"]);
      expect(parsedResult.errors).toEqual([]);
    });

    it("should enforce MAX_ARRAY_LENGTH limit on targets", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const batchCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "batch_translate_locales"
      );
      const handler = batchCall![3];

      // Create array exceeding MAX_ARRAY_LENGTH
      const tooManyTargets = Array.from({ length: 21 }, (_, i) => `es-XX-${i}` as any);

      const result = await handler({
        directory: "/test/locales",
        targets: tooManyTargets,
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("VALIDATION_FAILED");
    });
  });

  describe("manage_dialect_variants tool", () => {
    it("should apply dialect-specific adaptations", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const dialectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "manage_dialect_variants"
      );
      expect(dialectCall).toBeDefined();

      const handler = dialectCall![3];
      const params = {
        sourcePath: "/test/es-ES.json",
        variant: "es-MX" as const,
        outputPath: "/test/es-MX.json",
      };

      const result = await handler(params as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty("adapted");
      expect(parsedResult).toHaveProperty("changes");
      expect(Array.isArray(parsedResult.changes)).toBe(true);
    });

    it("should return no adaptations for unsupported dialects", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const dialectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "manage_dialect_variants"
      );
      const handler = dialectCall![3];

      const result = await handler({
        sourcePath: "/test/es-ES.json",
        variant: "es-ES" as const,
      } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.adapted).toBe(false);
      expect(parsedResult.changes).toEqual([]);
    });
  });

  describe("check_formality tool", () => {
    it("should check for informal pronouns in formal register", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const formalityCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "check_formality"
      );
      expect(formalityCall).toBeDefined();

      const handler = formalityCall![3];

      // Mock readLocaleFile to return entries with informal pronouns
      vi.mocked(readLocaleFile).mockReturnValue([
        { key: "greeting", value: "Hola, ¿cómo estás tú?" },
        { key: "farewell", value: "Hasta luego" },
      ]);

      const result = await handler({
        localePath: "/test/es.json",
        register: "formal" as const,
      } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.totalKeys).toBe(2);
      expect(parsedResult.issues).toBeDefined();
      expect(Array.isArray(parsedResult.issues)).toBe(true);
    });

    it("should check for formal pronouns in informal register", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const formalityCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "check_formality"
      );
      const handler = formalityCall![3];

      // Mock readLocaleFile to return entries with formal pronouns
      vi.mocked(readLocaleFile).mockReturnValue([
        { key: "greeting", value: "Hola, ¿cómo está usted?" },
      ]);

      const result = await handler({
        localePath: "/test/es.json",
        register: "informal" as const,
      } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.issues).toBeDefined();
      expect(Array.isArray(parsedResult.issues)).toBe(true);
    });
  });

  describe("apply_gender_neutral tool", () => {
    it("should apply latine gender-neutral strategy", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const genderCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "apply_gender_neutral"
      );
      expect(genderCall).toBeDefined();

      const handler = genderCall![3];

      // Mock readLocaleFile to return entries with gendered language
      vi.mocked(readLocaleFile).mockReturnValue([
        { key: "welcome_all", value: "Bienvenidos todos" },
        { key: "users", value: "Usuarios del sistema" },
      ]);

      const result = await handler({
        localePath: "/test/es.json",
        strategy: "latine" as const,
      } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.adapted).toBe(true);
      expect(parsedResult.changes).toBeDefined();
      expect(Array.isArray(parsedResult.changes)).toBe(true);
      expect(writeLocaleFile).toHaveBeenCalled();
    });

    it("should apply descriptive gender-neutral strategy", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const genderCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "apply_gender_neutral"
      );
      const handler = genderCall![3];

      vi.mocked(readLocaleFile).mockReturnValue([
        { key: "welcome_all", value: "Bienvenidos todos" },
      ]);

      const result = await handler({
        localePath: "/test/es.json",
        strategy: "descriptive" as const,
      } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.adapted).toBe(true);
      expect(writeLocaleFile).toHaveBeenCalled();
    });

    it("should reject invalid gender-neutral strategy", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const genderCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "apply_gender_neutral"
      );
      const handler = genderCall![3];

      const result = await handler({
        localePath: "/test/es.json",
        strategy: "invalid" as any,
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("INVALID_INPUT");
    });
  });

  describe("Rate Limiting", () => {
    it("should call rate limiter for each tool invocation", async () => {
      const mockAcquire = vi.fn().mockResolvedValue(undefined);
      mockRateLimiter.acquire = mockAcquire;

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      await detectCall![3]({
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
      } as any);

      expect(mockAcquire).toHaveBeenCalled();
    });
  });

  describe("Error Response Format", () => {
    it("should return standardized error format", async () => {
      vi.mocked(readLocaleFile).mockImplementation(() => {
        throw new Error("Read error");
      });

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      const handler = detectCall![3];
      const result = await handler({
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
      } as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty("error");
      expect(typeof parsedResult.error).toBe("string");
    });
  });

  describe("createProviderRegistry", () => {
    it("should create provider registry with environment providers", async () => {
      const originalDeeplKey = process.env.DEEPL_AUTH_KEY;
      const originalLibreUrl = process.env.LIBRETRANSLATE_URL;

      process.env.DEEPL_AUTH_KEY = "test-key";
      process.env.LIBRETRANSLATE_URL = "http://test.com";

      const { createProviderRegistry } = await import("../lib/provider-factory.js");
      const registry = createProviderRegistry();

      expect(registry).toBeDefined();
      expect(registry.register).toHaveBeenCalled();

      if (originalDeeplKey === undefined) {
        delete process.env.DEEPL_AUTH_KEY;
      } else {
        process.env.DEEPL_AUTH_KEY = originalDeeplKey;
      }

      if (originalLibreUrl === undefined) {
        delete process.env.LIBRETRANSLATE_URL;
      } else {
        process.env.LIBRETRANSLATE_URL = originalLibreUrl;
      }
    });
  });
});
