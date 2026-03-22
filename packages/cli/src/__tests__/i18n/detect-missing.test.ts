/**
 * Tests for the detect-missing command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeDetectMissing } from "../../commands/i18n/detect-missing.js";
import { writeError, writeInfo } from "../../lib/output.js";

// Mock the workspace packages
vi.mock("@espanol/locale-utils", () => ({
  readLocaleFile: vi.fn(),
  diffLocales: vi.fn(),
}));

vi.mock("../../lib/output.js", () => ({
  writeError: vi.fn(),
  writeInfo: vi.fn(),
}));

import { readLocaleFile, diffLocales } from "@espanol/locale-utils";

describe("detect-missing command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("success cases", () => {
    it("should detect missing keys in target locale", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
        { key: "nav.home", value: "Home" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.goodbye", "nav.home"],
        extraInTarget: [],
        commonKeys: ["common.hello"],
      });

      // This test expects exit code 1, so we need to catch the error
      try {
        await executeDetectMissing("./locales/en.json", "./locales/es.json");
      } catch (e) {
        // Expected to throw due to process.exit(1)
      }

      expect(writeInfo).toHaveBeenCalledWith("Missing keys in target (2): common.goodbye, nav.home");
      expect(writeInfo).toHaveBeenCalledWith("Extra keys in target (0):");
      expect(writeInfo).toHaveBeenCalledWith("Common keys (1): common.hello");
    });

    it("should detect extra keys in target locale", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
      ];

      const mockTarget = [
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

      await executeDetectMissing("./locales/en.json", "./locales/es.json");

      expect(writeInfo).toHaveBeenCalledWith("Missing keys in target (0):");
      expect(writeInfo).toHaveBeenCalledWith("Extra keys in target (1): common.farewell");
      expect(writeInfo).toHaveBeenCalledWith("Common keys (1): common.hello");
    });

    it("should show common keys when no differences", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
        { key: "common.goodbye", value: "Adiós" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: [],
        extraInTarget: [],
        commonKeys: ["common.hello", "common.goodbye"],
      });

      await executeDetectMissing("./locales/en.json", "./locales/es.json");

      expect(writeInfo).toHaveBeenCalledWith("Missing keys in target (0):");
      expect(writeInfo).toHaveBeenCalledWith("Extra keys in target (0):");
      expect(writeInfo).toHaveBeenCalledWith("Common keys (2): common.hello, common.goodbye");
    });

    it("should exit with code 0 when no missing keys", async () => {
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

      await executeDetectMissing("./locales/en.json", "./locales/es.json");

      // Should not call process.exit with code 1
      expect(writeInfo).toHaveBeenCalled();
    });
  });

  describe("exit code handling", () => {
    it("should exit with code 1 when there are missing keys", async () => {
      const mockBase = [
        { key: "common.hello", value: "Hello" },
        { key: "common.goodbye", value: "Goodbye" },
      ];

      const mockTarget = [
        { key: "common.hello", value: "Hola" },
      ];

      vi.mocked(readLocaleFile)
        .mockReturnValueOnce(mockBase)
        .mockReturnValueOnce(mockTarget);

      vi.mocked(diffLocales).mockReturnValue({
        missingInTarget: ["common.goodbye"],
        extraInTarget: [],
        commonKeys: ["common.hello"],
      });

      await expect(
        executeDetectMissing("./locales/en.json", "./locales/es.json")
      ).rejects.toThrow("Process exited with code 1");
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
        executeDetectMissing("./locales/en.json", "./locales/es.json")
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
        executeDetectMissing("./locales/en.json", "./locales/es.json")
      ).rejects.toThrow();
      expect(writeError).toHaveBeenCalled();
    });

    it("should handle invalid JSON in base file", async () => {
      vi.mocked(readLocaleFile).mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      await expect(
        executeDetectMissing("./locales/en.json", "./locales/es.json")
      ).rejects.toThrow();
      expect(writeError).toHaveBeenCalled();
    });
  });
});
