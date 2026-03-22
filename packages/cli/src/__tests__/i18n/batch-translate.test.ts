/**
 * Tests for the batch-translate command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeBatchTranslate } from "../../commands/i18n/batch-translate.js";
import type { TranslationProvider } from "@espanol/types";
import type { SpanishDialect } from "@espanol/types";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
}));

vi.mock("@espanol/security", () => ({
  validateFilePath: vi.fn(),
  MAX_ARRAY_LENGTH: 20,
}));

vi.mock("../../lib/output.js", () => ({
  writeError: vi.fn(),
  writeInfo: vi.fn(),
}));

import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { validateFilePath } from "@espanol/security";
import { writeError, writeInfo } from "../../lib/output.js";

describe("batch-translate command", () => {
  let mockProvider: TranslationProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock provider
    mockProvider = {
      name: "mymemory",
      translate: vi.fn().mockResolvedValue({
        translatedText: "Traducción",
      }),
    };

    // Mock validateFilePath to return an absolute path (path.join normalizes ./ prefixes)
    vi.mocked(validateFilePath).mockImplementation((path) => {
      return path.startsWith("./") ? path.slice(2) : path;
    });

    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("success cases", () => {
    it("should translate base locale to multiple target dialects", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
      ];

      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Hola" })
        .mockResolvedValueOnce({ translatedText: "Adiós" })
        .mockResolvedValueOnce({ translatedText: "Buen día" })
        .mockResolvedValueOnce({ translatedText: "Chau" });

      await executeBatchTranslate(
        "./locales",
        "en",
        ["es-MX", "es-AR"],
        undefined,
        () => mockProvider
      );

      // Should write 2 target files
      expect(writeLocaleFile).toHaveBeenCalledTimes(2);

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "locales/es-MX.json",
        [
          { key: "common.hello", value: "Hola" },
          { key: "common.goodbye", value: "Adiós" },
        ],
        2
      );

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "locales/es-AR.json",
        [
          { key: "common.hello", value: "Buen día" },
          { key: "common.goodbye", value: "Chau" },
        ],
        2
      );

      expect(writeInfo).toHaveBeenCalledWith("Batch translation completed");
      expect(writeInfo).toHaveBeenCalledWith("Directory: locales");
      expect(writeInfo).toHaveBeenCalledWith("Base locale: en");
      expect(writeInfo).toHaveBeenCalledWith("Targets: es-MX, es-AR");
      expect(writeInfo).toHaveBeenCalledWith("Total keys translated: 4");
    });

    it("should handle single target dialect", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(mockProvider.translate).mockResolvedValue({
        translatedText: "Hola",
      });

      await executeBatchTranslate(
        "./locales",
        "en",
        ["es-ES"],
        undefined,
        () => mockProvider
      );

      expect(writeLocaleFile).toHaveBeenCalledTimes(1);
      expect(writeLocaleFile).toHaveBeenCalledWith(
        "locales/es-ES.json",
        [{ key: "common.hello", value: "Hola" }],
        2
      );
    });

    it("should update existing target locale files", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "nav.home", value: "Home" },
      ];

      const existingTarget = [
        { key: "common.hello", value: "Hola antigua" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(existingTarget);

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Hola" })
        .mockResolvedValueOnce({ translatedText: "Inicio" });

      await executeBatchTranslate(
        "./locales",
        "en",
        ["es-ES"],
        undefined,
        () => mockProvider
      );

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "locales/es-ES.json",
        [
          { key: "common.hello", value: "Hola" },
          { key: "nav.home", value: "Inicio" },
        ],
        2
      );
    });
  });

  describe("validation", () => {
    it("should respect MAX_ARRAY_LENGTH limit", async () => {
      const mockBase = [{ key: "test", value: "Test" }];
      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      // Create 21 target dialects (exceeds MAX_ARRAY_LENGTH of 20)
      const targets: SpanishDialect[] = Array.from({ length: 21 }, (_, i) =>
        `es-${i}` as SpanishDialect
      );

      await expect(
        executeBatchTranslate("./locales", "en", targets, undefined, () => mockProvider)
      ).rejects.toThrow("Process exited with code 1");

      expect(writeError).toHaveBeenCalledWith(
        "Cannot exceed 20 target dialects"
      );
    });

    it("should validate directory path with validateFilePath", async () => {
      const mockBase = [{ key: "test", value: "Test" }];
      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(validateFilePath).mockImplementation(() => {
        throw new Error("Invalid path");
      });

      await expect(
        executeBatchTranslate("./locales", "en", ["es-ES"], undefined, () => mockProvider)
      ).rejects.toThrow();

      expect(validateFilePath).toHaveBeenCalledWith("./locales");
      expect(writeError).toHaveBeenCalled();
    });

    it("should reject empty targets array", async () => {
      await expect(
        executeBatchTranslate("./locales", "en", [], undefined, () => mockProvider)
      ).rejects.toThrow("Process exited with code 1");

      expect(writeError).toHaveBeenCalledWith(
        "At least one target dialect is required"
      );
    });

    it("should reject invalid dialect codes", async () => {
      const mockBase = [{ key: "test", value: "Test" }];
      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      // Type assertion to bypass TypeScript check for invalid dialect
      const invalidTargets = ["invalid-dialect"] as SpanishDialect[];

      await expect(
        executeBatchTranslate("./locales", "en", invalidTargets, undefined, () => mockProvider)
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });
  });

  describe("translation functionality", () => {
    it("should use correct dialect for each translation", async () => {
      const mockBase = [
        { key: "common.you", value: "You" },
      ];

      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Tú" })
        .mockResolvedValueOnce({ translatedText: "Usted" });

      await executeBatchTranslate(
        "./locales",
        "en",
        ["es-AR", "es-ES"],
        undefined,
        () => mockProvider
      );

      expect(mockProvider.translate).toHaveBeenNthCalledWith(1, "You", "en", "es", {
        dialect: "es-AR",
      });
      expect(mockProvider.translate).toHaveBeenNthCalledWith(2, "You", "en", "es", {
        dialect: "es-ES",
      });
    });

    it("should handle large locale files", async () => {
      const mockBase = Array.from({ length: 100 }, (_, i) => ({
        key: `key.${i}`,
        value: `Value ${i}`,
      }));

      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      // Mock all translations
      vi.mocked(mockProvider.translate).mockResolvedValue({
        translatedText: "Traducción",
      });

      await executeBatchTranslate(
        "./locales",
        "en",
        ["es-ES"],
        undefined,
        () => mockProvider
      );

      expect(mockProvider.translate).toHaveBeenCalledTimes(100);
      expect(writeLocaleFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should handle non-existent base locale file", async () => {
      vi.mocked(readLocaleFile).mockImplementation(() => {
        throw new Error("File not found");
      });

      await expect(
        executeBatchTranslate("./locales", "en", ["es-ES"], undefined, () => mockProvider)
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });

    it("should handle translation errors gracefully", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
      ];

      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Hola" })
        .mockRejectedValueOnce(new Error("Translation failed"));

      await expect(
        executeBatchTranslate("./locales", "en", ["es-ES"], undefined, () => mockProvider)
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });

    it("should handle write errors", async () => {
      const mockBase = [{ key: "test", value: "Test" }];
      vi.mocked(readLocaleFile).mockReturnValue(mockBase);

      vi.mocked(writeLocaleFile).mockImplementation(() => {
        throw new Error("Write failed");
      });

      await expect(
        executeBatchTranslate("./locales", "en", ["es-ES"], undefined, () => mockProvider)
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });
  });
});
