/**
 * Comprehensive security test suite for MCP tools
 * Tests all 16 MCP tools against common attack vectors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// Mock fs module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
}));

// Mock core libraries
vi.mock("@espanol/markdown-parser", () => ({
  parseMarkdown: vi.fn(),
  reconstructMarkdown: vi.fn(),
  extractTranslatableText: vi.fn(),
}));

vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
  diffLocales: vi.fn(),
}));

vi.mock("@espanol/security", () => {
  // Create SecurityError inline for the mock
  class SecurityError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "SecurityError";
      this.code = code;
    }
  }

  return {
    validateMarkdownPath: vi.fn(),
    validateFilePath: vi.fn(),
    validateContentLength: vi.fn(),
    validateJsonPath: vi.fn(),
    RateLimiter: vi.fn().mockImplementation(() => ({
      acquire: vi.fn().mockResolvedValue(undefined),
    })),
    SecurityError,
    createSafeError: vi.fn((error) => {
      // Check if it's a SecurityError by checking for code property
      if (error && typeof error === "object" && "code" in error) {
        return {
          error: (error as any).message,
          code: (error as any).code,
        };
      }
      return {
        error: error instanceof Error ? error.message : String(error),
        code: "INVALID_INPUT",
      };
    }),
    MAX_ARRAY_LENGTH: 20,
    MAX_FILE_SIZE: 512 * 1024,
    MAX_CONTENT_LENGTH: 50000,
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
  parseMarkdown,
  reconstructMarkdown,
  extractTranslatableText,
} from "@espanol/markdown-parser";
import {
  readLocaleFile,
  writeLocaleFile,
  diffLocales,
} from "@espanol/locale-utils";
import {
  validateMarkdownPath,
  validateFilePath,
  validateJsonPath,
  validateContentLength,
  RateLimiter,
  createSafeError,
  SecurityError,
  MAX_ARRAY_LENGTH,
  MAX_CONTENT_LENGTH,
} from "@espanol/security";
import { ProviderRegistry } from "@espanol/providers";

describe("MCP Security Tests", () => {
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

    // Mock parseMarkdown
    vi.mocked(parseMarkdown).mockReturnValue({
      sections: [
        {
          type: "heading",
          content: "Hello World",
          raw: "# Hello World",
          translatable: true,
        },
      ],
      translatableSections: 1,
      codeBlockCount: 0,
      linkCount: 0,
    });

    // Mock reconstructMarkdown
    vi.mocked(reconstructMarkdown).mockReturnValue("# Hola Mundo");

    // Mock extractTranslatableText
    vi.mocked(extractTranslatableText).mockReturnValue(["Hello World"]);

    // Mock readLocaleFile
    vi.mocked(readLocaleFile).mockReturnValue([
      { key: "hello", value: "Hello World" },
    ]);

    // Mock diffLocales
    vi.mocked(diffLocales).mockReturnValue({
      missingInTarget: [],
      extraInTarget: [],
      commonKeys: ["hello"],
    });

    // Mock validation functions
    vi.mocked(validateMarkdownPath).mockReturnValue("/test/path.md");
    vi.mocked(validateFilePath).mockReturnValue("/test/locales");
    vi.mocked(validateJsonPath).mockReturnValue("/test/locale.json");
    vi.mocked(validateContentLength).mockReturnValue(true);

    // Mock readFileSync
    vi.mocked(readFileSync).mockReturnValue("# Hello World");
  });

  describe("1. Path Traversal Protection", () => {
    it("should reject path traversal in docs tools", async () => {
      // Setup mock to throw on path traversal
      vi.mocked(validateMarkdownPath).mockImplementation((path) => {
        if (path.includes("..")) {
          throw new SecurityError("Path traversal detected", "PATH_TRAVERSAL");
        }
        return path as string;
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = { tool: vi.fn() };
      registerDocsTools(mockServer as any, { registry: mockRegistry });

      // Test translate_markdown
      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      const handler = translateCall![3];
      const result = await handler({
        filePath: "../../../etc/passwd",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.message).toBeDefined();
    });

    it("should reject path traversal in i18n tools", async () => {
      vi.mocked(validateJsonPath).mockImplementation((path) => {
        if (path.includes("..")) {
          throw new SecurityError("Path traversal detected", "PATH_TRAVERSAL");
        }
        return path as string;
      });

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = { tool: vi.fn() };
      registerI18nTools(mockServer as any, { registry: mockRegistry });

      // Test detect_missing_keys
      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      const handler = detectCall![3];
      const result = await handler({
        basePath: "../../../etc/passwd",
        targetPath: "/test/target.json",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBeDefined();
    });

    it("should reject path traversal in translator tools", async () => {
      vi.mocked(validateMarkdownPath).mockImplementation((path) => {
        if (path.includes("..")) {
          throw new SecurityError("Path traversal detected", "PATH_TRAVERSAL");
        }
        return path as string;
      });

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      // Test translate_readme
      const readmeCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_readme"
      );
      const handler = readmeCall![3];
      const result = await handler({
        filePath: "../../../etc/passwd",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBeDefined();
    });
  });

  describe("2. Content Length Validation", () => {
    it("should reject oversized content", async () => {
      vi.mocked(validateContentLength).mockImplementation((content) => {
        if (typeof content === "string" && content.length > MAX_CONTENT_LENGTH) {
          throw new SecurityError(
            "Content exceeds maximum length",
            "CONTENT_TOO_LONG"
          );
        }
        return true;
      });

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      const handler = translateCall![3];

      // Create content exceeding MAX_CONTENT_LENGTH (50000)
      const oversizedText = "a".repeat(50001);
      const result = await handler({
        text: oversizedText,
      } as any);

      // Success responses don't have isError property, only errors do
      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // The error field contains the error code
      expect(parsedResult.error).toBe("CONTENT_TOO_LONG");
      expect(parsedResult.message).toBeDefined();
    });

    it("should reject oversized markdown files", async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        const oversizedContent = "# " + "a".repeat(60000);
        return oversizedContent;
      });

      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new SecurityError(
          "Content exceeds maximum length",
          "CONTENT_TOO_LONG"
        );
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = { tool: vi.fn() };
      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const extractCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "extract_translatable"
      );
      const handler = extractCall![3];
      const result = await handler({
        filePath: "/test/large.md",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("CONTENT_TOO_LONG");
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("3. Empty/Invalid Input", () => {
    it("should reject empty text for translate_text", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      const handler = translateCall![3];
      const result = await handler({ text: "" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("INVALID_INPUT");
    });

    it("should reject empty code for translate_code_comment", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const commentCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_code_comment"
      );
      const handler = commentCall![3];
      const result = await handler({ code: "" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("INVALID_INPUT");
    });

    it("should reject empty query for search_glossary", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const glossaryCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "search_glossary"
      );
      const handler = glossaryCall![3];
      const result = await handler({ query: "" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("INVALID_INPUT");
    });
  });

  describe("4. Rate Limiting", () => {
    it("should enforce rate limiting after threshold", async () => {
      let callCount = 0;
      const limitedRateLimiter = {
        acquire: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount > 2) {
            return Promise.reject(
              new SecurityError("Rate limit exceeded", "RATE_LIMITED")
            );
          }
          return Promise.resolve(undefined);
        }),
      };
      vi.mocked(RateLimiter).mockImplementation(() => limitedRateLimiter);

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      const handler = translateCall![3];

      // First two calls should succeed (no isError property)
      const result1 = await handler({ text: "Hello" } as any);
      expect(result1.isError).toBeUndefined();

      const result2 = await handler({ text: "World" } as any);
      expect(result2.isError).toBeUndefined();

      // Third call should fail with rate limit error
      const result3 = await handler({ text: "Test" } as any);
      expect(result3.isError).toBe(true);
      const parsedResult = JSON.parse(result3.content[0].text);
      expect(parsedResult.error).toBe("RATE_LIMITED");
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("5. Error Sanitization", () => {
    it("should sanitize API keys from error messages", async () => {
      // Mock createSafeError to test sanitization
      vi.mocked(createSafeError).mockImplementation((error) => {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        // Remove API keys
        const sanitized = errorMsg.replace(/sk-[a-zA-Z0-9]{32,}/g, "[REDACTED]");
        return {
          error: sanitized,
          code: "API_ERROR",
        };
      });

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };

      // Mock provider to throw error with API key
      const registryWithKeyError = {
        get: vi.fn().mockReturnValue({
          name: "deepl",
          translate: vi.fn().mockRejectedValue(
            new Error(
              "API request failed with key sk-1234567890abcdef1234567890abcdef"
            )
          ),
        }),
      } as unknown as ProviderRegistry;

      registerTranslatorTools(mockServer as any, {
        registry: registryWithKeyError,
      });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      const handler = translateCall![3];
      const result = await handler({ text: "Hello" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // API key should be redacted
      expect(parsedResult.error).not.toContain("sk-1234567890abcdef");
    });

    it("should sanitize stack traces from error messages", async () => {
      const errorWithStack = new Error("Something went wrong");
      errorWithStack.stack = "Error: Something went wrong\n    at /node_modules/foo.js:123:45\n    at /app/index.js:67:89";

      vi.mocked(createSafeError).mockReturnValue({
        error: "Something went wrong",
        code: "UNKNOWN_ERROR",
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = { tool: vi.fn() };
      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      const handler = translateCall![3];

      // Trigger error
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw errorWithStack;
      });

      const result = await handler({
        filePath: "/test/path.md",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // Should not contain stack trace markers
      expect(parsedResult.error).not.toContain("at ");
      expect(parsedResult.error).not.toContain("/node_modules/");
    });

    it("should sanitize internal paths from error messages", async () => {
      vi.mocked(createSafeError).mockImplementation((error) => {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        // Remove internal paths
        const sanitized = errorMsg
          .replace(/\/node_modules\/[^\s]+/g, "[INTERNAL]")
          .replace(/\/\.cache\/[^\s]+/g, "[INTERNAL]");
        return {
          error: sanitized,
          code: "UNKNOWN_ERROR",
        };
      });

      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = { tool: vi.fn() };
      registerI18nTools(mockServer as any, { registry: mockRegistry });

      // Trigger error with internal path
      vi.mocked(readLocaleFile).mockImplementation(() => {
        throw new Error(
          "Failed to read file at /node_modules/@espanol/locale-utils/data/es.json"
        );
      });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_missing_keys"
      );
      const handler = detectCall![3];
      const result = await handler({
        basePath: "/test/base.json",
        targetPath: "/test/target.json",
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // Internal path should be redacted
      expect(parsedResult.error).not.toContain("/node_modules/");
    });
  });

  describe("6. Batch Array Limit", () => {
    it("should enforce MAX_ARRAY_LENGTH on batch_translate_locales", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = { tool: vi.fn() };
      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const batchCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "batch_translate_locales"
      );
      const handler = batchCall![3];

      // Create array exceeding MAX_ARRAY_LENGTH (20)
      const tooManyTargets = Array.from(
        { length: 21 },
        (_, i) => `es-XX-${i}` as any
      );

      const result = await handler({
        directory: "/test/locales",
        targets: tooManyTargets,
      } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // The error should indicate validation failure
      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.message).toBeDefined();
    });

    it("should accept arrays within MAX_ARRAY_LENGTH limit", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = { tool: vi.fn() };
      registerI18nTools(mockServer as any, { registry: mockRegistry });

      const batchCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "batch_translate_locales"
      );
      const handler = batchCall![3];

      // Create array at exactly MAX_ARRAY_LENGTH (20)
      const validTargets = Array.from(
        { length: 20 },
        (_, i) => `es-XX-${i}` as any
      );

      const result = await handler({
        directory: "/test/locales",
        targets: validTargets,
      } as any);

      // Success responses don't have isError property
      expect(result.isError).toBeUndefined();
    });
  });

  describe("7. Tool Registration Verification", () => {
    it("should register exactly 4 docs tools", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = { tool: vi.fn() };
      registerDocsTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(4);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map(
        (call) => call[0]
      );
      expect(toolNames).toEqual([
        "translate_markdown",
        "extract_translatable",
        "translate_api_docs",
        "create_bilingual_doc",
      ]);
    });

    it("should register exactly 6 i18n tools", async () => {
      const { registerI18nTools } = await import("../tools/i18n.js");
      const mockServer = { tool: vi.fn() };
      registerI18nTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(6);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map(
        (call) => call[0]
      );
      expect(toolNames).toEqual([
        "detect_missing_keys",
        "translate_missing_keys",
        "batch_translate_locales",
        "manage_dialect_variants",
        "check_formality",
        "apply_gender_neutral",
      ]);
    });

    it("should register exactly 6 translator tools", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = { tool: vi.fn() };
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(6);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map(
        (call) => call[0]
      );
      expect(toolNames).toEqual([
        "translate_text",
        "detect_dialect",
        "translate_code_comment",
        "translate_readme",
        "search_glossary",
        "list_dialects",
      ]);
    });

    it("should register all 16 tools total", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const { registerI18nTools } = await import("../tools/i18n.js");
      const { registerTranslatorTools } = await import(
        "../tools/translator.js"
      );

      const mockServer = { tool: vi.fn() };

      registerDocsTools(mockServer as any, { registry: mockRegistry });
      registerI18nTools(mockServer as any, { registry: mockRegistry });
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(16);
    });
  });

  describe("8. Error Response Format Consistency", () => {
    it("should return consistent error format for all tools", async () => {
      // Force all tools to error
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error("Test error");
      });
      vi.mocked(readLocaleFile).mockImplementation(() => {
        throw new Error("Test error");
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const { registerI18nTools } = await import("../tools/i18n.js");
      const { registerTranslatorTools } = await import(
        "../tools/translator.js"
      );

      const mockServer = { tool: vi.fn() };

      registerDocsTools(mockServer as any, { registry: mockRegistry });
      registerI18nTools(mockServer as any, { registry: mockRegistry });
      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      // Test a sample of tools from each category
      const toolsToTest = [
        "translate_markdown",
        "detect_missing_keys",
        "translate_text",
      ];

      for (const toolName of toolsToTest) {
        const toolCall = vi.mocked(mockServer.tool).mock.calls.find(
          (call) => call[0] === toolName
        );
        expect(toolCall).toBeDefined();

        const handler = toolCall![3];
        const result = await handler({} as any);

        // Verify error format
        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe("text");

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult).toHaveProperty("error");
        expect(typeof parsedResult.error).toBe("string");
      }
    });
  });
});
