/**
 * Tests for translate-api-docs and extract-translatable commands
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeOutput, writeError } from "../lib/output.js";
import { executeTranslateApiDocs, executeExtractTranslatable } from "../commands/translate-api-docs.js";
import type { TranslationProvider } from "@espanol/types";
import * as path from "node:path";

// Mock dependencies
const mockWriteOutput = vi.fn();
const mockWriteError = vi.fn();

vi.mock("../lib/output.js", () => ({
  writeOutput: (output: string) => mockWriteOutput(output),
  writeError: (message: string) => mockWriteError(message),
}));

const mockParseMarkdown = vi.fn();
const mockReconstructMarkdown = vi.fn();
const mockExtractTranslatableText = vi.fn();

vi.mock("@espanol/markdown-parser", () => ({
  parseMarkdown: () => mockParseMarkdown(),
  reconstructMarkdown: (...args: unknown[]) => mockReconstructMarkdown(...args),
  extractTranslatableText: (...args: unknown[]) => mockExtractTranslatableText(...args),
}));

const mockValidateFilePath = vi.fn();
const mockValidateContentLength = vi.fn();

vi.mock("@espanol/security", () => ({
  validateFilePath: (path: string) => mockValidateFilePath(path),
  validateContentLength: (...args: unknown[]) => mockValidateContentLength(...args),
}));

const mockReadFile = vi.fn();

vi.mock("node:fs", () => ({
  promises: {
    readFile: (path: string, encoding: string) => mockReadFile(path, encoding),
  },
}));

describe("extract-translatable command", () => {
  let mockProvider: TranslationProvider;

  beforeEach(() => {
    mockProvider = {
      name: "mymemory",
      translate: vi.fn().mockResolvedValue({
        translatedText: "Hola mundo",
        detectedLanguage: "en",
        provider: "mymemory" as const,
      }),
    };

    // Reset mocks
    mockWriteOutput.mockReset();
    mockWriteError.mockReset();
    mockReadFile.mockReset();
    mockParseMarkdown.mockReset();
    mockReconstructMarkdown.mockReset();
    mockValidateFilePath.mockReset();
    mockValidateContentLength.mockReset();

    // Default mock implementations
    mockValidateFilePath.mockImplementation((path: string) => path);
    mockValidateContentLength.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("output formatting", () => {
    it("should output translatable sections with type prefix", async () => {
      mockReadFile.mockResolvedValue("# API Reference\n\nThis is an API documentation.\n\n```console.log('code')```");

      mockParseMarkdown.mockReturnValue({
        sections: [
          { type: "heading", content: "# API Reference", raw: "# API Reference", translatable: true },
          { type: "paragraph", content: "This is an API documentation.", raw: "This is an API documentation.", translatable: true },
          { type: "code", content: "console.log('code')", raw: "```console.log('code')```", translatable: false },
        ],
        translatableSections: 2,
        codeBlockCount: 1,
        linkCount: 0,
      });

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeExtractTranslatable("./test-api.md", getProvider);

      expect(mockWriteOutput).toHaveBeenCalledWith(
        "heading: # API Reference\nparagraph: This is an API documentation."
      );
    });

    it("should exclude code blocks from output", async () => {
      mockReadFile.mockResolvedValue("# Title\n\n```const x = 1;```\n\nDescription");

      mockParseMarkdown.mockReturnValue({
        sections: [
          { type: "heading", content: "Title", raw: "# Title", translatable: true },
          { type: "code", content: "const x = 1;", raw: "```const x = 1;```", translatable: false },
          { type: "paragraph", content: "Description", raw: "Description", translatable: true },
        ],
        translatableSections: 2,
        codeBlockCount: 1,
        linkCount: 0,
      });

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeExtractTranslatable("./test.md", getProvider);

      const output = mockWriteOutput.mock.calls[0]?.[0] as string;
      expect(output).not.toContain("code:");
    });

    it("should exclude HTML blocks from output", async () => {
      mockReadFile.mockResolvedValue("Text\n\n<div>html</div>");

      mockParseMarkdown.mockReturnValue({
        sections: [
          { type: "paragraph", content: "Text", raw: "Text", translatable: true },
          { type: "html", content: "<div>html</div>", raw: "<div>html</div>", translatable: false },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeExtractTranslatable("./test.md", getProvider);

      const output = mockWriteOutput.mock.calls[0]?.[0] as string;
      expect(output).not.toContain("html:");
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid file paths", async () => {
      mockValidateFilePath.mockImplementation(() => {
        throw new Error("Path traversal detected");
      });

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await expect(executeExtractTranslatable("../../../etc/passwd", getProvider)).rejects.toThrow("Path traversal detected");
    });
  });
});

describe("translate-api-docs command", () => {
  let mockProvider: TranslationProvider;
  const testDir = "/tmp/espanol-cli-api-test";
  const tokenFile = path.join(testDir, "tokens.json");
  const glossaryFile = path.join(testDir, "glossary.json");

  beforeEach(() => {
    mockProvider = {
      name: "mymemory",
      translate: vi.fn().mockResolvedValue({
        translatedText: "Traducción",
        detectedLanguage: "en",
        provider: "mymemory" as const,
      }),
    };

    // Reset mocks
    mockWriteOutput.mockReset();
    mockWriteError.mockReset();
    mockReadFile.mockReset();
    mockParseMarkdown.mockReset();
    mockReconstructMarkdown.mockReset();
    mockValidateFilePath.mockReset();
    mockValidateContentLength.mockReset();

    // Default mock implementations
    mockValidateFilePath.mockImplementation((path: string) => path);
    mockValidateContentLength.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("table handling", () => {
    it("should translate tables cell-by-cell", async () => {
      mockReadFile.mockResolvedValue("| Header1 | Header2 |\n|---------|---------|\n| Cell1   | Cell2   |");

      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "table",
            content: "Header1 Header2 Cell1 Cell2",
            raw: "| Header1 | Header2 |\n|---------|---------|\n| Cell1   | Cell2   |",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      mockReconstructMarkdown.mockReturnValue("| Header1 | Header2 |\n|---------|---------|\n| Cell1   | Cell2   |");

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs("./test-table.md", "es-ES", undefined, getProvider);

      expect(mockProvider.translate).toHaveBeenCalledWith(
        "Header1 Header2 Cell1 Cell2",
        "auto",
        "es-ES",
        { dialect: "es-ES" }
      );
      expect(mockWriteOutput).toHaveBeenCalled();
    });
  });

  describe("list handling", () => {
    it("should preserve nested list structure", async () => {
      mockReadFile.mockResolvedValue("- Item 1\n  - Nested item");

      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "list",
            content: "Item 1\nNested item",
            raw: "- Item 1\n  - Nested item",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      mockReconstructMarkdown.mockReturnValue("- Item 1\n  - Nested item");

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs("./test-list.md", "es-ES", undefined, getProvider);

      expect(mockProvider.translate).toHaveBeenCalledWith(
        "Item 1\nNested item",
        "auto",
        "es-ES",
        { dialect: "es-ES" }
      );
      expect(mockWriteOutput).toHaveBeenCalled();
    });
  });

  describe("code block preservation", () => {
    it("should preserve code blocks unchanged", async () => {
      mockReadFile.mockResolvedValue("```javascript\nconst x = 1;\n```\n\nSome text");

      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "code",
            content: "const x = 1;",
            raw: "```javascript\nconst x = 1;\n```",
            translatable: false,
          },
          {
            type: "paragraph",
            content: "Some text",
            raw: "Some text",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 1,
        linkCount: 0,
      });

      mockReconstructMarkdown.mockReturnValue("```javascript\nconst x = 1;\n```\n\nSome text");

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs("./test-code.md", "es-ES", undefined, getProvider);

      // Code blocks should not be translated
      expect(mockProvider.translate).toHaveBeenCalledTimes(1);
      expect(mockProvider.translate).toHaveBeenCalledWith(
        "Some text",
        "auto",
        "es-ES",
        { dialect: "es-ES" }
      );
      expect(mockWriteOutput).toHaveBeenCalled();
    });
  });

  describe("frontmatter preservation", () => {
    it("should preserve YAML frontmatter", async () => {
      mockReadFile.mockResolvedValue("---\ntitle: API Docs\n---\n\n# API");

      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "html",
            content: "---\ntitle: API Docs\n---",
            raw: "---\ntitle: API Docs\n---",
            translatable: false,
          },
          {
            type: "heading",
            content: "# API",
            raw: "# API",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      mockReconstructMarkdown.mockReturnValue("---\ntitle: API Docs\n---\n\n# API");

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs("./test-frontmatter.md", "es-ES", undefined, getProvider);

      expect(mockProvider.translate).toHaveBeenCalledWith(
        "# API",
        "auto",
        "es-ES",
        { dialect: "es-ES" }
      );
      expect(mockWriteOutput).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid dialect", async () => {
      mockValidateFilePath.mockImplementation((path: string) => path);

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await expect(
        executeTranslateApiDocs("./test.md", "invalid-dialect" as any, undefined, getProvider)
      ).rejects.toThrow("Invalid dialect");
    });

    it("should throw error for invalid file paths", async () => {
      mockValidateFilePath.mockImplementation(() => {
        throw new Error("Path traversal detected");
      });

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await expect(executeTranslateApiDocs("../../../etc/passwd", "es-ES", undefined, getProvider)).rejects.toThrow("Path traversal detected");
    });
  });

  describe("protected tokens", () => {
    it("should preserve protected tokens in translated API docs", async () => {
      mockReadFile.mockImplementation((filePath: string) => {
        if (filePath === tokenFile) {
          return Promise.resolve(JSON.stringify({
            tokens: ["Kyanite Labs", "@pastorsimon1798"],
          }));
        }
        return Promise.resolve("Kyanite Labs by @pastorsimon1798");
      });
      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "paragraph",
            content: "Kyanite Labs by @pastorsimon1798",
            raw: "Kyanite Labs by @pastorsimon1798",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      (mockProvider.translate as any).mockImplementation(async (inputText: string) => ({
        translatedText: inputText
          .replace("Kyanite Labs", "Laboratorios Cianita")
          .replace("@pastorsimon1798", "@pastoresimon1798"),
        detectedLanguage: "en",
        provider: "mymemory",
      }));

      mockReconstructMarkdown.mockImplementation((_orig: unknown, translated: any[]) => translated[0].content);

      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs("./test.md", "es-ES", { protectTokens: tokenFile }, getProvider);

      expect(mockWriteOutput).toHaveBeenCalledWith(expect.stringContaining("Kyanite Labs"));
      expect(mockWriteOutput).toHaveBeenCalledWith(expect.stringContaining("@pastorsimon1798"));
    });

    it("should enforce strict glossary mappings in API doc translation", async () => {
      mockReadFile.mockImplementation((filePath: string) => {
        if (filePath === glossaryFile) {
          return Promise.resolve(JSON.stringify({
            mappings: {
              "agentic engineering": "ingenieria agentic",
              Shorts: "Shorts",
            },
            critical: ["agentic engineering"],
          }));
        }
        return Promise.resolve("agentic engineering with Shorts");
      });

      mockParseMarkdown.mockReturnValue({
        sections: [
          {
            type: "paragraph",
            content: "agentic engineering with Shorts",
            raw: "agentic engineering with Shorts",
            translatable: true,
          },
        ],
        translatableSections: 1,
        codeBlockCount: 0,
        linkCount: 0,
      });

      (mockProvider.translate as any).mockImplementation(async (inputText: string) => ({
        translatedText: `[ES] ${inputText}`,
        detectedLanguage: "en",
        provider: "mymemory",
      }));

      mockReconstructMarkdown.mockImplementation((_orig: unknown, translated: any[]) => translated[0].content);
      const getProvider = vi.fn().mockReturnValue(mockProvider);

      await executeTranslateApiDocs(
        "./test.md",
        "es-ES",
        { glossaryFile, glossaryMode: "strict" as any },
        getProvider
      );

      const out = mockWriteOutput.mock.calls[0]?.[0] as string;
      expect(out).toContain("ingenieria agentic");
      expect(out).toContain("Shorts");
    });
  });
});
