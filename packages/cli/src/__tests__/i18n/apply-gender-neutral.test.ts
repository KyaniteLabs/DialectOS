/**
 * Tests for the i18n apply-gender-neutral command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
}));

vi.mock("@espanol/security", () => ({
  validateFilePath: vi.fn((path) => path),
}));

import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { executeApplyGenderNeutral } from "../../commands/i18n/apply-gender-neutral.js";
import type { I18nEntry } from "@espanol/types";

describe("i18n apply-gender-neutral command", () => {
  const mockReadLocaleFile = readLocaleFile as ReturnType<typeof vi.fn>;
  const mockWriteLocaleFile = writeLocaleFile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("latine strategy", () => {
    it("should apply latine strategy: todos → todes", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.all", value: "Hola todos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola todes");
    });

    it("should apply latine strategy: bienvenidos → bienvenides", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.welcome", value: "bienvenidos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("bienvenides");
    });

    it("should apply latine strategy: amigos → amigues", async () => {
      const entries: I18nEntry[] = [
        { key: "people.friends", value: "Mis amigos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Mis amigues");
    });

    it("should apply latine strategy: todos las → todes les", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.all", value: "todos las" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("todes");
    });
  });

  describe("elles strategy", () => {
    it("should apply elles strategy: todos → elles", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.all", value: "Hola todos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "elles",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola elles");
    });

    it("should apply elles strategy: bienvenidos → bienvenides", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.welcome", value: "bienvenidos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "elles",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("bienvenides");
    });

    it("should apply elles strategy: amigos → amigues", async () => {
      const entries: I18nEntry[] = [
        { key: "people.friends", value: "Mis amigos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "elles",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Mis amigues");
    });
  });

  describe("x strategy", () => {
    it("should apply x strategy: todos → todxs", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.all", value: "Hola todos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "x",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola todxs");
    });

    it("should apply x strategy: bienvenidos → bienvenidxs", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.welcome", value: "bienvenidos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "x",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("bienvenidxs");
    });

    it("should apply x strategy: amigos → amigxs", async () => {
      const entries: I18nEntry[] = [
        { key: "people.friends", value: "Mis amigos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "x",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Mis amigxs");
    });
  });

  describe("descriptive strategy", () => {
    it("should apply descriptive strategy: todos → todas y todos", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.all", value: "Hola todos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "descriptive",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola todas y todos");
    });

    it("should apply descriptive strategy: bienvenidos → bienvenidas y bienvenidos", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.welcome", value: "bienvenidos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "descriptive",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("bienvenidas y bienvenidos");
    });

    it("should apply descriptive strategy: amigos → amigas y amigos", async () => {
      const entries: I18nEntry[] = [
        { key: "people.friends", value: "Mis amigos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "descriptive",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Mis amigas y amigos");
    });
  });

  describe("edge cases", () => {
    it("should handle words not needing changes", async () => {
      const entries: I18nEntry[] = [
        { key: "common.hello", value: "Hola mundo" },
        { key: "common.thanks", value: "Gracias" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola mundo");
      expect(writtenEntries[1].value).toBe("Gracias");
    });

    it("should handle empty locale file", async () => {
      const entries: I18nEntry[] = [];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalledWith("/path/to/es.json", []);
    });

    it("should preserve nested structure in output", async () => {
      const entries: I18nEntry[] = [
        { key: "nav.home.title", value: "Inicio" },
        { key: "nav.home.welcome", value: "Bienvenidos todos" },
        { key: "nav.about.title", value: "Acerca de" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries).toHaveLength(3);
      expect(writtenEntries[0].key).toBe("nav.home.title");
      expect(writtenEntries[1].key).toBe("nav.home.welcome");
      expect(writtenEntries[2].key).toBe("nav.about.title");
    });

    it("should handle multiple gendered words in single value", async () => {
      const entries: I18nEntry[] = [
        { key: "message", value: "Bienvenidos todos y todas mis amigos" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("Bienvenides");
      expect(writtenEntries[0].value).toContain("todes");
      expect(writtenEntries[0].value).toContain("amigues");
    });

    it("should handle case variations", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting1", value: "Todos" },
        { key: "greeting2", value: "todos" },
        { key: "greeting3", value: "TODOS" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeApplyGenderNeutral({
        locale: "/path/to/es.json",
        strategy: "latine",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Todes");
      expect(writtenEntries[1].value).toBe("todes");
      expect(writtenEntries[2].value).toBe("TODES");
    });
  });

  describe("error handling", () => {
    it("should propagate errors from readLocaleFile", async () => {
      mockReadLocaleFile.mockImplementation(() => {
        throw new Error("Failed to read file");
      });

      await expect(
        executeApplyGenderNeutral({
          locale: "/path/to/es.json",
          strategy: "latine",
        })
      ).rejects.toThrow("Failed to read file");
    });
  });
});
