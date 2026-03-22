/**
 * Tests for the translate-keys command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeTranslateKeys } from "../../commands/i18n/translate-keys.js";
import type { TranslationProvider } from "@espanol/types";
import type { SpanishDialect } from "@espanol/types";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
  diffLocales: vi.fn(),
}));

vi.mock("../../lib/output.js", () => ({
  writeError: vi.fn(),
  writeInfo: vi.fn(),
}));

import { readLocaleFile, writeLocaleFile, diffLocales } from "@espanol/locale-utils";
import { writeError, writeInfo } from "../../lib/output.js";

describe("translate-keys command", () => {
  let mockProvider: TranslationProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock provider
    mockProvider = {
      name: "mymemory",
      translate: vi.fn().mockResolvedValue({
        translatedText: "Hola mundo",
      }),
    };

    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("success cases", () => {
    it("should translate missing keys from base to target locale", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
        { key: "nav.home", value: "Home" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
      ];

      const updatedTarget = [
        { key: "common.hello", value: "Hola" },
        { key: "common.goodbye", value: "Adiós" },
        { key: "nav.home", value: "Inicio" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.goodbye", "nav.home"],
        extraInTarget: [],
        commonKeys: ["common.hello"],
      });

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Adiós" })
        .mockResolvedValueOnce({ translatedText: "Inicio" });

      await executeTranslateKeys(
        "./locales/en.json",
        "./locales/es.json",
        "es-MX",
        undefined,
        () => mockProvider
      );

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "./locales/es.json",
        updatedTarget,
        2
      );

      expect(writeInfo).toHaveBeenCalledWith("Translated 2 missing keys");
    });

    it("should skip translation when no keys are missing", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: [],
        extraInTarget: [],
        commonKeys: ["common.hello"],
      });

      await executeTranslateKeys(
        "./locales/en.json",
        "./locales/es.json",
        "es-ES",
        undefined,
        () => mockProvider
      );

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "./locales/es.json",
        mockTarget,
        2
      );

      expect(writeInfo).toHaveBeenCalledWith("No missing keys to translate");
      expect(mockProvider.translate).not.toHaveBeenCalled();
    });

    it("should preserve extra keys in target locale", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
        { key: "common.farewell", value: "Despedida" },
      ];

      const updatedTarget = [
        { key: "common.hello", value: "Hola" },
        { key: "common.farewell", value: "Despedida" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: [],
        extraInTarget: ["common.farewell"],
        commonKeys: ["common.hello"],
      });

      await executeTranslateKeys(
        "./locales/en.json",
        "./locales/es.json",
        "es-AR",
        undefined,
        () => mockProvider
      );

      expect(writeLocaleFile).toHaveBeenCalledWith(
        "./locales/es.json",
        updatedTarget,
        2
      );
    });
  });

  describe("translation functionality", () => {
    it("should use correct dialect for translation", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.friend", value: "Friend" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.friend"],
        extraInTarget: [],
        commonKeys: ["common.hello"],
      });

      vi.mocked(mockProvider.translate).mockResolvedValue({
        translatedText: "Amigo",
      });

      await executeTranslateKeys(
        "./locales/en.json",
        "./locales/es.json",
        "es-AR" as SpanishDialect,
        undefined,
        () => mockProvider
      );

      expect(mockProvider.translate).toHaveBeenCalledWith(
        "Friend",
        "en",
        "es",
        expect.objectContaining({
          dialect: "es-AR",
        })
      );
    });

    it("should translate multiple keys sequentially", async () => {
      const mockBase = [
        { key: "a", value: "A" },
        { key: "b", value: "B" },
        { key: "c", value: "C" },
      ];

      const mockTarget: any[] = [];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["a", "b", "c"],
        extraInTarget: [],
        commonKeys: [],
      });

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "A-es" })
        .mockResolvedValueOnce({ translatedText: "B-es" })
        .mockResolvedValueOnce({ translatedText: "C-es" });

      await executeTranslateKeys(
        "./locales/en.json",
        "./locales/es.json",
        "es-ES",
        undefined,
        () => mockProvider
      );

      expect(mockProvider.translate).toHaveBeenCalledTimes(3);
    });
  });

  describe("error handling", () => {
    it("should handle non-existent base file", async () => {
      vi.mocked(readLocaleFile).mockImplementation((path) => {
        if (path === "./locales/en.json") {
          throw new Error("File not found");
        }
        return [];
      });

      await expect(
        executeTranslateKeys(
          "./locales/en.json",
          "./locales/es.json",
          "es-ES",
          undefined,
          () => mockProvider
        )
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });

    it("should handle non-existent target file", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockImplementation(() => {
          throw new Error("File not found");
        });

      await expect(
        executeTranslateKeys(
          "./locales/en.json",
          "./locales/es.json",
          "es-ES",
          undefined,
          () => mockProvider
        )
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });

    it("should handle translation errors gracefully", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
      ];

      const mockTarget: any[] = [];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.hello", "common.goodbye"],
        extraInTarget: [],
        commonKeys: [],
      });

      vi.mocked(mockProvider.translate)
        .mockResolvedValueOnce({ translatedText: "Hola" })
        .mockRejectedValueOnce(new Error("Translation failed"));

      await expect(
        executeTranslateKeys(
          "./locales/en.json",
          "./locales/es.json",
          "es-ES",
          undefined,
          () => mockProvider
        )
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });

    it("should handle write errors", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      const mockTarget: any[] = [];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.hello"],
        extraInTarget: [],
        commonKeys: [],
      });

      vi.mocked(writeLocaleFile).mockImplementation(() => {
        throw new Error("Write failed");
      });

      await expect(
        executeTranslateKeys(
          "./locales/en.json",
          "./locales/es.json",
          "es-ES",
          undefined,
          () => mockProvider
        )
      ).rejects.toThrow();

      expect(writeError).toHaveBeenCalled();
    });
  });
});
