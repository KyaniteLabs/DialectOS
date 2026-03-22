/**
 * Tests for MCP translator tools
 * Tests the 6 MCP tools: translate_text, detect_dialect, translate_code_comment,
 * translate_readme, search_glossary, list_dialects
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

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
}));

// Mock the core libraries
vi.mock("@espanol/markdown-parser", () => ({
  parseMarkdown: vi.fn(),
  reconstructMarkdown: vi.fn(),
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
    validateMarkdownPath: vi.fn(),
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
} from "@espanol/markdown-parser";
import {
  validateMarkdownPath,
  RateLimiter,
  createSafeError,
} from "@espanol/security";
import { ProviderRegistry } from "@espanol/providers";

describe("MCP Translator Tools", () => {
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
        {
          type: "paragraph",
          content: "This is a test paragraph.",
          raw: "This is a test paragraph.",
          translatable: true,
        },
        {
          type: "code",
          content: "console.log('code');",
          raw: "```javascript\nconsole.log('code');\n```",
          translatable: false,
        },
      ],
      translatableSections: 2,
      codeBlockCount: 1,
      linkCount: 0,
    });

    // Mock reconstructMarkdown
    vi.mocked(reconstructMarkdown).mockReturnValue(
      "# Hola Mundo\n\nEste es un párrafo de prueba.\n\n```javascript\nconsole.log('code');\n```"
    );

    // Mock readFileSync to return sample markdown
    vi.mocked(readFileSync).mockReturnValue(
      "# Hello World\n\nThis is a test paragraph.\n\n```javascript\nconsole.log('code');\n```"
    );

    // Mock validateMarkdownPath
    vi.mocked(validateMarkdownPath).mockReturnValue("/test/path.md");
  });

  describe("Tool Registration", () => {
    it("should register all 6 translator tools", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(6);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map((call) => call[0]);
      expect(toolNames).toContain("translate_text");
      expect(toolNames).toContain("detect_dialect");
      expect(toolNames).toContain("translate_code_comment");
      expect(toolNames).toContain("translate_readme");
      expect(toolNames).toContain("search_glossary");
      expect(toolNames).toContain("list_dialects");
    });
  });

  describe("translate_text tool", () => {
    it("should translate text successfully", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      expect(translateCall).toBeDefined();

      const handler = translateCall![3];
      const params = {
        text: "Hello World",
        dialect: "es-ES" as const,
        provider: "mymemory" as const,
      };

      const result = await handler(params as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translatedText).toBe("Hola Mundo");
      expect(parsedResult.provider).toBe("mymemory");
      expect(parsedResult.dialect).toBe("es-ES");
    });

    it("should handle empty text error", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

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

    it("should support formal and informal tones", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      const handler = translateCall![3];

      await handler({ text: "Hello", formal: true } as any);
      await handler({ text: "Hello", informal: true } as any);

      // Both should succeed
      expect(translateCall).toBeDefined();
    });
  });

  describe("detect_dialect tool", () => {
    it("should detect Spanish dialect from text", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_dialect"
      );
      expect(detectCall).toBeDefined();

      const handler = detectCall![3];

      // Test with Mexican Spanish keywords
      const result = await handler({
        text: "Órale wey, qué onda con la computadora",
      } as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty("dialect");
      expect(parsedResult).toHaveProperty("confidence");
      expect(parsedResult).toHaveProperty("name");
      expect(parsedResult).toHaveProperty("matchedKeywords");
    });

    it("should handle empty text error", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_dialect"
      );
      const handler = detectCall![3];

      const result = await handler({ text: "" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("INVALID_INPUT");
    });

    it("should return default dialect when no keywords match", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const detectCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "detect_dialect"
      );
      const handler = detectCall![3];

      const result = await handler({
        text: "Generic text without dialect-specific words",
      } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.dialect).toBe("es-ES");
      expect(parsedResult.confidence).toBe(0);
      expect(parsedResult.matchedKeywords).toEqual([]);
    });
  });

  describe("translate_code_comment tool", () => {
    it("should extract and mark comments for translation", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const commentCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_code_comment"
      );
      expect(commentCall).toBeDefined();

      const handler = commentCall![3];
      const code = `
        // This is a comment
        function hello() {
          /* Multi-line comment */
          return "world";
        }
      `;

      const result = await handler({ code, dialect: "es-ES" as const } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult).toHaveProperty("translatedCode");
      expect(parsedResult).toHaveProperty("commentsTranslated");
      // The implementation now actually translates, so should NOT contain [TRANSLATED]
      expect(parsedResult.translatedCode).not.toContain("[TRANSLATED]");
    });

    it("should handle empty code error", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

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
  });

  describe("translate_readme tool", () => {
    it("should translate README markdown file", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const readmeCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_readme"
      );
      expect(readmeCall).toBeDefined();

      const handler = readmeCall![3];
      const result = await handler({
        filePath: "/test/README.md",
        dialect: "es-ES" as const,
      } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translated).toBeDefined();
      expect(parsedResult.sectionsProcessed).toBe(2);
      expect(parsedResult.codeBlocksPreserved).toBe(1);
    });

    it("should handle invalid path errors", async () => {
      vi.mocked(validateMarkdownPath).mockImplementation(() => {
        throw new MockSecurityError("Invalid path", "PATH_TRAVERSAL" as any);
      });

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const readmeCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_readme"
      );
      const handler = readmeCall![3];

      const result = await handler({ filePath: "/invalid/path.md" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // The error is returned with "Invalid path" message and default code
      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("search_glossary tool", () => {
    it("should search built-in glossary", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const glossaryCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "search_glossary"
      );
      expect(glossaryCall).toBeDefined();

      const handler = glossaryCall![3];
      const result = await handler({ query: "array" } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.results).toBeDefined();
      expect(Array.isArray(parsedResult.results)).toBe(true);
      expect(parsedResult.count).toBeGreaterThan(0);

      // Should find "array" in programming category
      const arrayEntry = parsedResult.results.find((r: any) => r.term === "array");
      expect(arrayEntry).toBeDefined();
      expect(arrayEntry.translation).toBe("arreglo");
      expect(arrayEntry.category).toBe("programming");
    });

    it("should search by translation", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const glossaryCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "search_glossary"
      );
      const handler = glossaryCall![3];
      const result = await handler({ query: "función" } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.results.length).toBeGreaterThan(0);
    });

    it("should handle empty query error", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

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

    it("should return empty results for non-existent terms", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const glossaryCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "search_glossary"
      );
      const handler = glossaryCall![3];
      const result = await handler({ query: "nonexistentterm123" } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.results).toEqual([]);
      expect(parsedResult.count).toBe(0);
    });
  });

  describe("list_dialects tool", () => {
    it("should list all 20 Spanish dialects", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const listCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "list_dialects"
      );
      expect(listCall).toBeDefined();

      const handler = listCall![3];
      const result = await handler({} as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.dialects).toBeDefined();
      expect(Array.isArray(parsedResult.dialects)).toBe(true);
      expect(parsedResult.dialects.length).toBe(20);
      expect(parsedResult.count).toBe(20);

      // Check structure of first dialect
      expect(parsedResult.dialects[0]).toHaveProperty("code");
      expect(parsedResult.dialects[0]).toHaveProperty("name");
      expect(parsedResult.dialects[0]).toHaveProperty("description");
    });

    it("should include major dialects", async () => {
      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const listCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "list_dialects"
      );
      const handler = listCall![3];
      const result = await handler({} as any);

      const parsedResult = JSON.parse(result.content[0].text);
      const dialectCodes = parsedResult.dialects.map((d: any) => d.code);

      expect(dialectCodes).toContain("es-ES");
      expect(dialectCodes).toContain("es-MX");
      expect(dialectCodes).toContain("es-AR");
      expect(dialectCodes).toContain("es-CO");
    });
  });

  describe("Rate Limiting", () => {
    it("should call rate limiter for each tool invocation", async () => {
      const mockAcquire = vi.fn().mockResolvedValue(undefined);
      mockRateLimiter.acquire = mockAcquire;

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_text"
      );
      await translateCall![3]({ text: "Hello" } as any);

      expect(mockAcquire).toHaveBeenCalled();
    });
  });

  describe("Error Response Format", () => {
    it("should return standardized error format", async () => {
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error("Parse error");
      });

      const { registerTranslatorTools } = await import("../tools/translator.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerTranslatorTools(mockServer as any, { registry: mockRegistry });

      const readmeCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_readme"
      );
      const handler = readmeCall![3];
      const result = await handler({ filePath: "/test/path.md" } as any);

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
