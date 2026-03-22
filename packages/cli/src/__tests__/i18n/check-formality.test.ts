/**
 * Tests for the i18n check-formality command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
}));

vi.mock("@espanol/security", () => ({
  validateFilePath: vi.fn((path) => path),
}));

import { readLocaleFile } from "@espanol/locale-utils";
import { executeCheckFormality } from "../../commands/i18n/check-formality.js";
import type { I18nEntry } from "@espanol/types";

describe("i18n check-formality command", () => {
  const mockReadLocaleFile = readLocaleFile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formal register checks", () => {
    it("should detect informal 'tú' in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "Hola tú" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("greeting");
      expect(result.issues[0].suggestion).toContain("usted");
    });

    it("should detect informal 'vos' in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "¿Qué hacés, vos?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("greeting");
      expect(result.issues[0].suggestion).toContain("usted");
    });

    it("should detect informal 'vosotros' in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.plural", value: "Hola vosotros" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("greeting.plural");
      expect(result.issues[0].suggestion).toContain("ustedes");
    });

    it("should detect 'estás' (informal second person) in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "question", value: "¿Cómo estás?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("question");
      expect(result.issues[0].suggestion).toContain("está");
    });

    it("should accept formal 'usted' in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "Hola usted, ¿cómo está?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(0);
    });

    it("should accept formal 'ustedes' in formal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.plural", value: "Hola ustedes" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(0);
    });
  });

  describe("informal register checks", () => {
    it("should detect formal 'usted' in informal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "Hola usted, ¿cómo está?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "informal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("greeting");
      expect(result.issues[0].suggestion).toContain("tú");
    });

    it("should detect formal 'ustedes' in informal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.plural", value: "Hola ustedes" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "informal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("greeting.plural");
      expect(result.issues[0].suggestion).toContain("vosotros");
    });

    it("should accept informal 'tú' in informal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "Hola tú, ¿cómo estás?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "informal",
      });

      expect(result.issues).toHaveLength(0);
    });

    it("should accept informal 'vosotros' in informal register", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting.plural", value: "Hola vosotros" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "informal",
      });

      expect(result.issues).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty locale file", async () => {
      const entries: I18nEntry[] = [];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(0);
      expect(result.totalKeys).toBe(0);
    });

    it("should handle values with no formality issues", async () => {
      const entries: I18nEntry[] = [
        { key: "common.hello", value: "Hola mundo" },
        { key: "common.thanks", value: "Gracias" },
        { key: "common.goodbye", value: "Adiós" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(0);
      expect(result.totalKeys).toBe(3);
    });

    it("should detect multiple formality issues in single value", async () => {
      const entries: I18nEntry[] = [
        { key: "message", value: "Tú y vosotros venid aquí" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].key).toBe("message");
      expect(result.issues[0].suggestion).toContain("usted");
    });

    it("should handle mixed case variations", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting1", value: "Tú" },
        { key: "greeting2", value: "tú" },
        { key: "greeting3", value: "TÚ" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(3);
      expect(result.issues[0].suggestion).toContain("usted");
      expect(result.issues[1].suggestion).toContain("usted");
      expect(result.issues[2].suggestion).toContain("usted");
    });

    it("should not flag words that contain informal pronouns as substrings", async () => {
      const entries: I18nEntry[] = [
        { key: "tech.status", value: "estatus del sistema" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should propagate errors from readLocaleFile", async () => {
      mockReadLocaleFile.mockImplementation(() => {
        throw new Error("Failed to read file");
      });

      await expect(
        executeCheckFormality({
          locale: "/path/to/es.json",
          register: "formal",
        })
      ).rejects.toThrow("Failed to read file");
    });
  });

  describe("suggestions", () => {
    it("should provide specific suggestions for tú → usted", async () => {
      const entries: I18nEntry[] = [
        { key: "greeting", value: "Hola tú" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues[0].suggestion).toContain("usted");
    });

    it("should provide specific suggestions for estáis → están", async () => {
      const entries: I18nEntry[] = [
        { key: "question", value: "¿Cómo estáis?" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues[0].suggestion).toContain("están");
    });

    it("should provide specific suggestions for tenéis → tienen", async () => {
      const entries: I18nEntry[] = [
        { key: "statement", value: "Ustedes tenéis razón" },
      ];

      mockReadLocaleFile.mockReturnValue(entries);

      const result = await executeCheckFormality({
        locale: "/path/to/es.json",
        register: "formal",
      });

      expect(result.issues[0].suggestion).toContain("tienen");
    });
  });
});
