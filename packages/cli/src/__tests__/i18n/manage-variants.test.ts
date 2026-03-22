/**
 * Tests for the i18n manage-variants command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  writeLocaleFile: vi.fn(),
}));

vi.mock("@espanol/security", () => ({
  validateFilePath: vi.fn((path) => path),
}));

import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { executeManageVariants } from "../../commands/i18n/manage-variants.js";
import type { I18nEntry } from "@espanol/types";

describe("i18n manage-variants command", () => {
  const mockReadLocaleFile = readLocaleFile as ReturnType<typeof vi.fn>;
  const mockWriteLocaleFile = writeLocaleFile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("dialect adaptations", () => {
    it("should apply vosotros → ustedes for Latin American variants", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "greeting", value: "Hola vosotros" },
        { key: "farewell", value: "Adiós vosotros" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("ustedes");
      expect(writtenEntries[0].value).not.toContain("vosotros");
    });

    it("should apply ordenador → computadora for es-MX", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "device.computer", value: "Mi ordenador está encendido" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("computadora");
      expect(writtenEntries[0].value).not.toContain("ordenador");
    });

    it("should apply coche → carro for es-MX", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "vehicle.car", value: "Mi coche es rojo" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("carro");
      expect(writtenEntries[0].value).not.toContain("coche");
    });

    it("should apply bolígrafo → pluma for es-MX", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "items.pen", value: "Dame el bolígrafo" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("pluma");
      expect(writtenEntries[0].value).not.toContain("bolígrafo");
    });

    it("should apply zumo → jugo for es-MX", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "drinks.juice", value: "Un zumo de naranja" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("jugo");
      expect(writtenEntries[0].value).not.toContain("zumo");
    });

    it("should apply patata → papa for es-AR", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "food.potato", value: "Me gustan las patatas" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-AR",
        output: "/path/to/es-AR.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("papa");
      expect(writtenEntries[0].value).not.toContain("patata");
    });

    it("should apply móvil → celular for Latin American variants", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "device.phone", value: "Mi móvil está cargado" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-CO",
        output: "/path/to/es-CO.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("celular");
      expect(writtenEntries[0].value).not.toContain("móvil");
    });
  });

  describe("edge cases", () => {
    it("should handle words not needing changes", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "common.hello", value: "Hola mundo" },
        { key: "common.thanks", value: "Gracias" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola mundo");
      expect(writtenEntries[1].value).toBe("Gracias");
    });

    it("should handle empty locale file", async () => {
      const sourceEntries: I18nEntry[] = [];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalledWith(
        "/path/to/es-MX.json",
        []
      );
    });

    it("should preserve nested structure in output", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "nav.home.title", value: "Inicio" },
        { key: "nav.home.subtitle", value: "Bienvenido vosotros" },
        { key: "nav.about.title", value: "Acerca de" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries).toHaveLength(3);
      expect(writtenEntries[0].key).toBe("nav.home.title");
      expect(writtenEntries[1].key).toBe("nav.home.subtitle");
      expect(writtenEntries[2].key).toBe("nav.about.title");
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid dialect", async () => {
      await expect(
        executeManageVariants({
          source: "/path/to/es-ES.json",
          variant: "es-INVALID" as any,
          output: "/path/to/output.json",
        })
      ).rejects.toThrow("Invalid dialect");
    });

    it("should propagate errors from readLocaleFile", async () => {
      mockReadLocaleFile.mockImplementation(() => {
        throw new Error("Failed to read file");
      });

      await expect(
        executeManageVariants({
          source: "/path/to/es-ES.json",
          variant: "es-MX",
          output: "/path/to/es-MX.json",
        })
      ).rejects.toThrow("Failed to read file");
    });
  });

  describe("regional variations", () => {
    it("should not make changes when source and variant are same", async () => {
      const sourceEntries: I18nEntry[] = [
        { key: "greeting", value: "Hola vosotros" },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-ES",
        output: "/path/to/es-ES-copy.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toBe("Hola vosotros");
    });

    it("should handle multiple adaptations in single value", async () => {
      const sourceEntries: I18nEntry[] = [
        {
          key: "message",
          value: "Vosotros, usad vuestro ordenador y su coche",
        },
      ];

      mockReadLocaleFile.mockReturnValue(sourceEntries);
      mockWriteLocaleFile.mockImplementation(() => {});

      await executeManageVariants({
        source: "/path/to/es-ES.json",
        variant: "es-MX",
        output: "/path/to/es-MX.json",
      });

      expect(mockWriteLocaleFile).toHaveBeenCalled();
      const writtenEntries = mockWriteLocaleFile.mock.calls[0][1] as I18nEntry[];
      expect(writtenEntries[0].value).toContain("ustedes");
      expect(writtenEntries[0].value).toContain("su");
      expect(writtenEntries[0].value).toContain("computadora");
      expect(writtenEntries[0].value).toContain("carro");
      expect(writtenEntries[0].value).not.toContain("vosotros");
      expect(writtenEntries[0].value).not.toContain("vuestro");
      expect(writtenEntries[0].value).not.toContain("ordenador");
    });
  });
});
