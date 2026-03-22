/**
 * Tests for the dialects commands (list, detect)
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeOutput, writeError } from "../lib/output.js";

// Mock output functions
vi.mock("../lib/output.js", () => ({
  writeOutput: vi.fn(),
  writeError: vi.fn(),
}));

describe("dialects command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("dialects list", () => {
    it("should list all 20 Spanish dialects", async () => {
      const { executeDialectsList } = await import("../commands/dialects.js");

      await executeDialectsList({ format: "text" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-ES");
      expect(output).toContain("es-MX");
      expect(output).toContain("es-AR");
      expect(output).toContain("Peninsular Spanish");
    });

    it("should format output as JSON when --format json", async () => {
      const { executeDialectsList } = await import("../commands/dialects.js");

      await executeDialectsList({ format: "json" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty("code");
      expect(parsed[0]).toHaveProperty("name");
      expect(parsed[0]).toHaveProperty("description");
    });

    it("should include all 20 dialect codes", async () => {
      const { executeDialectsList } = await import("../commands/dialects.js");

      await executeDialectsList({ format: "json" });

      const output = vi.mocked(writeOutput).mock.calls[0][0];
      const parsed = JSON.parse(output);
      const codes = parsed.map((d: any) => d.code);

      // Check all 20 dialects are present
      expect(codes).toContain("es-ES");
      expect(codes).toContain("es-MX");
      expect(codes).toContain("es-AR");
      expect(codes).toContain("es-CO");
      expect(codes).toContain("es-CU");
      expect(codes).toContain("es-PE");
      expect(codes).toContain("es-CL");
      expect(codes).toContain("es-VE");
      expect(codes).toContain("es-UY");
      expect(codes).toContain("es-PY");
      expect(codes).toContain("es-BO");
      expect(codes).toContain("es-EC");
      expect(codes).toContain("es-GT");
      expect(codes).toContain("es-HN");
      expect(codes).toContain("es-SV");
      expect(codes).toContain("es-NI");
      expect(codes).toContain("es-CR");
      expect(codes).toContain("es-PA");
      expect(codes).toContain("es-DO");
      expect(codes).toContain("es-PR");
      expect(codes.length).toBe(20);
    });
  });

  describe("dialects detect", () => {
    it("should detect Mexican Spanish (es-MX) from keyword markers", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("La computadora está en el departamento. Usé la pluma para escribir.");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-MX");
    });

    it("should detect Argentine Spanish (es-AR) from keyword markers", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("Che, voy en auto al laburo. ¿Comemos papa hoy?");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-AR");
    });

    it("should detect Colombian Spanish (es-CO) from keyword markers", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("¡Parce! ¿Qué más? ¡Chévere! Veci, vamos a la fiesta.");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-CO");
    });

    it("should detect Peninsular Spanish (es-ES) from keyword markers", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("El ordenador está en el coche. Bebo zumo. ¡Vale! Vosotros venís.");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-ES");
    });

    it("should return default dialect (es-ES) when no markers detected", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("El texto es neutral y no tiene marcadores regionales obvios.");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toContain("es-ES");
    });

    it("should include confidence score in output", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("computadora");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toMatch(/confidence|confianza/i);
    });

    it("should format output as JSON when --format json", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("computadora");

      await executeDialectsDetect("computadora", { format: "json" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[1][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("dialect");
      expect(parsed).toHaveProperty("confidence");
      expect(typeof parsed.confidence).toBe("number");
    });

    it("should handle empty text gracefully", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("");

      expect(writeOutput).toHaveBeenCalled();
    });

    it("should be case-insensitive when detecting markers", async () => {
      const { executeDialectsDetect } = await import("../commands/dialects.js");

      await executeDialectsDetect("COMPUTADORA Auto LABURO");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should detect at least one dialect
      expect(output).toMatch(/es-[A-Z]{2}/i);
    });
  });

  describe("error handling", () => {
    it("should handle invalid format option gracefully", async () => {
      const { executeDialectsList } = await import("../commands/dialects.js");

      // Invalid format should default to text
      await executeDialectsList({ format: "invalid" as any });

      expect(writeOutput).toHaveBeenCalled();
    });
  });
});
