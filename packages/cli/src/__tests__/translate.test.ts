/**
 * Tests for the translate command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { TranslationProvider, TranslateOptions } from "@espanol/types";
import { executeTranslate } from "../commands/translate.js";

function makeProvider(
  translateImpl: (text: string, sourceLang: string, targetLang: string, options?: TranslateOptions) => Promise<string> | string =
    async () => "Hola mundo"
): TranslationProvider {
  return {
    name: "mymemory",
    translate: vi.fn(async (text, sourceLang, targetLang, options) => ({
      translatedText: await translateImpl(text, sourceLang, targetLang, options),
      detectedLanguage: "en",
      provider: "mymemory" as const,
    })),
  };
}

describe("translate command", () => {
  const testDir = "/tmp/espanol-translate-test";
  const inputFile = path.join(testDir, "input.txt");
  const outputFile = path.join(testDir, "output.txt");
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should translate command-line text with default options", async () => {
    const provider = makeProvider();
    const getProvider = vi.fn().mockReturnValue(provider);

    await executeTranslate("Hello world", {}, getProvider);

    expect(getProvider).toHaveBeenCalledWith(undefined);
    expect(provider.translate).toHaveBeenCalledWith("Hello world", "auto", "es", expect.objectContaining({
      formality: "auto",
      dialect: "es-ES",
      context: expect.stringContaining("do not translate literally word-by-word"),
    }));
    expect(stdoutSpy).toHaveBeenCalledWith("Hola mundo");
  });

  it("should pass provider, dialect, and formal options", async () => {
    const provider = makeProvider((text) => `[formal] ${text}`);
    const getProvider = vi.fn().mockReturnValue(provider);

    await executeTranslate("Hello", {
      provider: "libre",
      dialect: "es-MX",
      formal: true,
    }, getProvider);

    expect(getProvider).toHaveBeenCalledWith("libre");
    expect(provider.translate).toHaveBeenCalledWith("Hello", "auto", "es", expect.objectContaining({
      formality: "formal",
      dialect: "es-MX",
      context: expect.stringContaining("Mexican Spanish"),
    }));
    expect(stdoutSpy).toHaveBeenCalledWith("[formal] Hello");
  });

  it("should prefer informal when informal option is set", async () => {
    const provider = makeProvider((text) => `[informal] ${text}`);
    const getProvider = vi.fn().mockReturnValue(provider);

    await executeTranslate("Hello", { informal: true }, getProvider);

    expect(provider.translate).toHaveBeenCalledWith("Hello", "auto", "es", expect.objectContaining({
      formality: "informal",
      dialect: "es-ES",
      context: expect.stringContaining("register: informal"),
    }));
  });

  it("should read input from file and write output to file", async () => {
    await fs.writeFile(inputFile, "File input");
    const provider = makeProvider((text) => `translated: ${text}`);

    await executeTranslate(undefined, { inputFile, output: outputFile }, () => provider);

    await expect(fs.readFile(outputFile, "utf-8")).resolves.toBe("translated: File input");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("should reject invalid dialect codes", async () => {
    const provider = makeProvider();

    await expect(
      executeTranslate("Hello", { dialect: "es-XX" as never }, () => provider)
    ).rejects.toThrow("Invalid dialect");
    expect(provider.translate).not.toHaveBeenCalled();
  });

  it("should reject unsupported provider names", async () => {
    const provider = makeProvider();

    await expect(
      executeTranslate("Hello", { provider: "deepl-free" }, () => provider)
    ).rejects.toThrow("Invalid provider");
    expect(provider.translate).not.toHaveBeenCalled();
  });

  it("should rethrow provider translation errors", async () => {
    const provider = makeProvider(async () => {
      throw new Error("provider down");
    });

    await expect(executeTranslate("Hello", {}, () => provider)).rejects.toThrow("provider down");
    expect(stderrSpy).toHaveBeenCalledWith("Error: provider down\n");
  });
});
