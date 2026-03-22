/**
 * Tests for MCP docs tools
 * Tests the 4 MCP tools: translate_markdown, extract_translatable, translate_api_docs, create_bilingual_doc
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

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
vi.mock("@espanol/markdown-parser", () => ({
  parseMarkdown: vi.fn(),
  reconstructMarkdown: vi.fn(),
  extractTranslatableText: vi.fn(),
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
  extractTranslatableText,
} from "@espanol/markdown-parser";
import {
  validateMarkdownPath,
  RateLimiter,
  createSafeError,
  SecurityError,
} from "@espanol/security";
import { ProviderRegistry } from "@espanol/providers";

describe("MCP Docs Tools", () => {
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

    // Mock readFileSync to return sample markdown
    vi.mocked(readFileSync).mockReturnValue(
      "# Hello World\n\nThis is a test paragraph.\n\n```javascript\nconsole.log('code');\n```"
    );

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

    // Mock extractTranslatableText
    vi.mocked(extractTranslatableText).mockReturnValue([
      "Hello World",
      "This is a test paragraph.",
    ]);

    // Mock validateMarkdownPath
    vi.mocked(validateMarkdownPath).mockReturnValue("/test/path.md");

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
  });

  describe("Tool Registration", () => {
    it("should register all 4 docs tools", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      expect(mockServer.tool).toHaveBeenCalledTimes(4);
      const toolNames = vi.mocked(mockServer.tool).mock.calls.map((call) => call[0]);
      expect(toolNames).toContain("translate_markdown");
      expect(toolNames).toContain("extract_translatable");
      expect(toolNames).toContain("translate_api_docs");
      expect(toolNames).toContain("create_bilingual_doc");
    });
  });

  describe("translate_markdown tool", () => {
    it("should translate markdown file successfully", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      // Get the handler for translate_markdown
      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      expect(translateCall).toBeDefined();

      const handler = translateCall![3];
      const params = {
        filePath: "/test/path.md",
        dialect: "es-ES" as const,
        provider: "mymemory" as const,
      };

      const result = await handler(params as any);

      // Verify the result structure
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translated).toBeDefined();
      expect(parsedResult.sectionsProcessed).toBe(2);
      expect(parsedResult.codeBlocksPreserved).toBe(1);
      expect(parsedResult.linksPreserved).toBe(0);
    });

    it("should handle rate limiting errors", async () => {
      mockRateLimiter.acquire = vi.fn().mockRejectedValue(
        new SecurityError("Rate limit exceeded", "RATE_LIMITED")
      );

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      const handler = translateCall![3];

      const result = await handler({ filePath: "/test/path.md" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.error).toBe("RATE_LIMITED");
    });

    it("should handle invalid path errors", async () => {
      vi.mocked(validateMarkdownPath).mockImplementation(() => {
        throw new SecurityError("Invalid path", "PATH_TRAVERSAL");
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      const handler = translateCall![3];

      const result = await handler({ filePath: "/invalid/path.md" } as any);

      expect(result.isError).toBe(true);
      const parsedResult = JSON.parse(result.content[0].text);
      // The error is returned with "Invalid path" message and default code
      expect(parsedResult.error).toBeDefined();
      expect(parsedResult.message).toBeDefined();
    });
  });

  describe("extract_translatable tool", () => {
    it("should extract translatable text from markdown", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const extractCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "extract_translatable"
      );
      expect(extractCall).toBeDefined();

      const handler = extractCall![3];
      const result = await handler({ filePath: "/test/path.md" } as any);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.sections).toBeDefined();
      expect(Array.isArray(parsedResult.sections)).toBe(true);
      expect(parsedResult.totalSections).toBe(3); // All sections including code
      expect(parsedResult.translatableCount).toBe(2); // Only translatable
    });

    it("should return sections with type and content", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const extractCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "extract_translatable"
      );
      const handler = extractCall![3];
      const result = await handler({ filePath: "/test/path.md" } as any);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.sections[0]).toHaveProperty("type");
      expect(parsedResult.sections[0]).toHaveProperty("content");
      expect(parsedResult.sections[0].type).toBe("heading");
      expect(parsedResult.sections[0].content).toBe("Hello World");
    });
  });

  describe("translate_api_docs tool", () => {
    it("should translate API documentation", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const apiCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_api_docs"
      );
      expect(apiCall).toBeDefined();

      const handler = apiCall![3];
      const result = await handler({
        filePath: "/test/api.md", dialect: "es-MX" as const
      } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.translated).toBeDefined();
      expect(parsedResult.sectionsProcessed).toBeDefined();
      expect(parsedResult.sectionsProcessed).toBe(2);
    });
  });

  describe("create_bilingual_doc tool", () => {
    it("should create side-by-side bilingual document", async () => {
      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const bilingualCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "create_bilingual_doc"
      );
      expect(bilingualCall).toBeDefined();

      const handler = bilingualCall![3];
      const result = await handler({
        filePath: "/test/path.md", dialect: "es-ES" as const
      } as any);

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.bilingual).toBeDefined();
      expect(parsedResult.sectionsProcessed).toBeDefined();
      expect(parsedResult.bilingual).toContain("## Original");
      expect(parsedResult.bilingual).toContain("## Translation");
    });
  });

  describe("Rate Limiting", () => {
    it("should call rate limiter for each tool invocation", async () => {
      const mockAcquire = vi.fn().mockResolvedValue(undefined);
      mockRateLimiter.acquire = mockAcquire;

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      // Test translate_markdown
      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      await translateCall![3]({ filePath: "/test/path.md" } as any);

      expect(mockAcquire).toHaveBeenCalled();
    });
  });

  describe("Error Response Format", () => {
    it("should return standardized error format", async () => {
      vi.mocked(parseMarkdown).mockImplementation(() => {
        throw new Error("Parse error");
      });

      const { registerDocsTools } = await import("../tools/docs.js");
      const mockServer = {
        tool: vi.fn(),
      };

      registerDocsTools(mockServer as any, { registry: mockRegistry });

      const translateCall = vi.mocked(mockServer.tool).mock.calls.find(
        (call) => call[0] === "translate_markdown"
      );
      const handler = translateCall![3];
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
      // Set environment variables
      const originalDeeplKey = process.env.DEEPL_AUTH_KEY;
      const originalLibreUrl = process.env.LIBRETRANSLATE_URL;

      process.env.DEEPL_AUTH_KEY = "test-key";
      process.env.LIBRETRANSLATE_URL = "http://test.com";

      const { createProviderRegistry } = await import("../tools/docs.js");
      const registry = createProviderRegistry();

      expect(registry).toBeDefined();
      expect(registry.register).toHaveBeenCalled();

      // Restore environment
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
