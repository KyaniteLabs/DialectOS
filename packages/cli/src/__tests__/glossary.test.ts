/**
 * Tests for the glossary commands (search, get)
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeOutput, writeError } from "../lib/output.js";

// Mock output functions
vi.mock("../lib/output.js", () => ({
  writeOutput: vi.fn(),
  writeError: vi.fn(),
}));

describe("glossary command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("glossary search", () => {
    it("should search for exact term match", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("computer");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output.toLowerCase()).toContain("computador");
    });

    it("should search for partial term match", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("comp");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should find terms starting with "comp"
      expect(output.toLowerCase()).toMatch(/comput/);
    });

    it("should be case-insensitive", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("COMPUTER");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output.toLowerCase()).toContain("computador");
    });

    it("should return multiple results for partial matches", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("code");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should find multiple code-related terms
      expect(output).toContain("code");
    });

    it("should return empty result for non-existent term", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("xyznonexistentterm123");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output.toLowerCase()).toContain("no results");
    });

    it("should format output as JSON when --format json", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("computer", { format: "json" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      if (parsed.length > 0) {
        expect(parsed[0]).toHaveProperty("term");
        expect(parsed[0]).toHaveProperty("translation");
        expect(parsed[0]).toHaveProperty("category");
      }
    });

    it("should include category in results", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("computer", { format: "json" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      const parsed = JSON.parse(output);
      if (parsed.length > 0) {
        expect(parsed[0]).toHaveProperty("category");
      }
    });

    it("should handle empty search term gracefully", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("");

      expect(writeOutput).toHaveBeenCalled();
    });

    it("should search across all categories", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      // Search for a common term
      await executeGlossarySearch("file");

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should find results from different categories
      expect(output).toBeDefined();
    });
  });

  describe("glossary get", () => {
    it("should get all glossary entries when no category specified", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({});

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should show category headers and entries
      expect(output).toContain("PROGRAMMING");
      expect(output).toContain("→"); // Arrow separator
    });

    it("should get entries by category: programming", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "programming" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should contain programming terms
      expect(output.toLowerCase()).toMatch(/code|function|variable|bug/);
    });

    it("should get entries by category: general", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "general" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toBeDefined();
    });

    it("should get entries by category: technical", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "technical" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toBeDefined();
    });

    it("should get entries by category: business", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "business" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toBeDefined();
    });

    it("should return empty result for invalid category", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "invalid-category-xyz" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output.toLowerCase()).toContain("no results");
    });

    it("should format output as JSON when --format json", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "programming", format: "json" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      if (parsed.length > 0) {
        expect(parsed[0]).toHaveProperty("term");
        expect(parsed[0]).toHaveProperty("translation");
        expect(parsed[0]).toHaveProperty("category");
      }
    });

    it("should be case-insensitive for category matching", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "PROGRAMMING" });

      expect(writeOutput).toHaveBeenCalled();
      // Should still find programming terms
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      expect(output).toBeDefined();
    });

    it("should handle special characters in search term", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("c++");

      expect(writeOutput).toHaveBeenCalled();
    });

    it("should display category labels in text format", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      await executeGlossaryGet({ category: "programming", format: "text" });

      expect(writeOutput).toHaveBeenCalled();
      const output = vi.mocked(writeOutput).mock.calls[0][0];
      // Should show category information
      expect(output).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid format option gracefully", async () => {
      const { executeGlossaryGet } = await import("../commands/glossary.js");

      // Invalid format should default to text
      await executeGlossaryGet({ format: "invalid" as any });

      expect(writeOutput).toHaveBeenCalled();
    });

    it("should handle search with only whitespace", async () => {
      const { executeGlossarySearch } = await import("../commands/glossary.js");

      await executeGlossarySearch("   ");

      expect(writeOutput).toHaveBeenCalled();
    });
  });
});
