/**
 * Adversarial fixture corpus tests
 * Validates resilience against audit-identified edge cases
 * Addresses GitHub issue #6
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createTranslateReadmeCommand } from "../commands/translate-readme.js";
import { restoreProtectedTokens } from "../lib/token-protection.js";
import type { TranslationProvider } from "@espanol/types";
import type { ProviderRegistry } from "@espanol/providers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "adversarial");

// Adversarial provider that simulates real-world provider misbehavior
class AdversarialProvider implements TranslationProvider {
  readonly name = "adversarial";
  private mode: "html-injection" | "token-normalization" | "normal";

  constructor(mode: "html-injection" | "token-normalization" | "normal" = "normal") {
    this.mode = mode;
  }

  async translate(text: string, _sourceLang: string, _targetLang: string) {
    if (this.mode === "html-injection") {
      // Inject disallowed HTML tags into translated output
      return {
        translatedText: text + ' <script>alert("xss")</script>',
        provider: "adversarial" as const,
      };
    }
    if (this.mode === "token-normalization") {
      // Normalize placeholder tokens (mimics real provider behavior)
      return {
        translatedText: text
          .replace(/__ESPANOL_TOKEN_(\d+)__/g, "ESPANOL TOKEN $1")
          .replace(/__ESPANOL_GLOSS_(\d+)__/g, "ESPANOL GLOSS $1"),
        provider: "adversarial" as const,
      };
    }
    // Normal mode — identity translation
    return {
      translatedText: text,
      provider: "adversarial" as const,
    };
  }
}

// Mock registry
class MockRegistry implements Partial<ProviderRegistry> {
  private provider: TranslationProvider;

  constructor(provider: TranslationProvider) {
    this.provider = provider;
  }

  getAuto(): TranslationProvider {
    return this.provider;
  }

  get(_name: string): TranslationProvider {
    return this.provider;
  }

  listProviders(): string[] {
    return [this.provider.name];
  }

  isAvailable(_name: string): boolean {
    return true;
  }

  recordSuccess(_name: string): void {}
  recordFailure(_name: string): void {}
}

async function executeCommand(
  registry: ProviderRegistry,
  args: string[]
): Promise<void> {
  const command = createTranslateReadmeCommand(() => registry);
  const program = new Command();
  program.addCommand(command);
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });
  await program.parseAsync(["translate-readme", ...args], { from: "user" });
}

describe("adversarial fixture corpus", () => {
  const testDir = "/tmp/espanol-adversarial-test";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("html-injection.md", () => {
    it("should reject HTML tag injection from provider", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "html-injection.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "html-injection.md");
      const outputFile = path.join(testDir, "html-injection.es.md");
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new AdversarialProvider("html-injection")
      ) as ProviderRegistry;

      await expect(
        executeCommand(registry, [
          inputFile,
          "--output",
          outputFile,
          "--dialect",
          "es-ES",
        ])
      ).rejects.toThrow(/Structure validation failed/);
    });

    it("should accept clean translation without HTML injection", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "html-injection.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "html-injection-clean.md");
      const outputFile = path.join(testDir, "html-injection-clean.es.md");
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new AdversarialProvider("normal")
      ) as ProviderRegistry;

      // Use --no-validate-structure because the fixture input itself contains
      // disallowed HTML tags (as examples); we are testing provider behavior,
      // not input validation.
      await expect(
        executeCommand(registry, [
          inputFile,
          "--output",
          outputFile,
          "--dialect",
          "es-ES",
          "--no-validate-structure",
          "--policy",
          "permissive",
        ])
      ).resolves.not.toThrow();
    });
  });

  describe("token-stress.md", () => {
    it("should preserve protected tokens with --protect-tokens", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "token-stress.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "token-stress.md");
      const outputFile = path.join(testDir, "token-stress.es.md");
      const tokensFile = path.join(testDir, "tokens.json");
      await fs.writeFile(inputFile, content);
      await fs.writeFile(
        tokensFile,
        JSON.stringify([
          "Kyanite Labs",
          "DialectOS",
          "Agentic Engine",
          "MCP Protocol",
          "DeepL Provider",
          "LibreTranslate Provider",
          "MyMemory Provider",
          "Provider Registry",
          "Circuit Breaker",
          "Rate Limiter",
        ])
      );

      const registry = new MockRegistry(
        new AdversarialProvider("normal")
      ) as ProviderRegistry;

      await executeCommand(registry, [
        inputFile,
        "--output",
        outputFile,
        "--dialect",
        "es-ES",
        "--protect-tokens",
        tokensFile,
        "--policy",
        "permissive",
      ]);

      const output = await fs.readFile(outputFile, "utf-8");
      expect(output).toContain("Kyanite Labs");
      expect(output).toContain("DialectOS");
      expect(output).toContain("Agentic Engine");
      expect(output).toContain("MCP Protocol");
    });

    it("should restore tokens even when provider normalizes placeholders", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "token-stress.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "token-stress-norm.md");
      const outputFile = path.join(testDir, "token-stress-norm.es.md");
      const tokensFile = path.join(testDir, "tokens-norm.json");
      await fs.writeFile(inputFile, content);
      await fs.writeFile(
        tokensFile,
        JSON.stringify(["Kyanite Labs", "DialectOS"])
      );

      const registry = new MockRegistry(
        new AdversarialProvider("token-normalization")
      ) as ProviderRegistry;

      await executeCommand(registry, [
        inputFile,
        "--output",
        outputFile,
        "--dialect",
        "es-ES",
        "--protect-tokens",
        tokensFile,
        "--policy",
        "permissive",
      ]);

      const output = await fs.readFile(outputFile, "utf-8");
      // Token restoration should handle normalized placeholders
      expect(output).toContain("Kyanite Labs");
      expect(output).toContain("DialectOS");
    });
  });

  describe("mixed-structure.md", () => {
    it("should preserve code blocks, links, tables, and lists", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "mixed-structure.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "mixed-structure.md");
      const outputFile = path.join(testDir, "mixed-structure.es.md");
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new AdversarialProvider("normal")
      ) as ProviderRegistry;

      await executeCommand(registry, [
        inputFile,
        "--output",
        outputFile,
        "--dialect",
        "es-ES",
      ]);

      const output = await fs.readFile(outputFile, "utf-8");
      // Code block markers preserved
      expect(output).toContain("```javascript");
      // Link URL preserved
      expect(output).toContain("https://kyanitelabs.ai");
      // Table structure preserved
      expect(output).toContain("| Feature |");
      // Image URL preserved
      expect(output).toContain("https://kyanitelabs.ai/logo.png");
    });
  });

  describe("colloquial.md", () => {
    it("should handle regional slang without errors", async () => {
      const content = await fs.readFile(
        path.join(fixturesDir, "colloquial.md"),
        "utf-8"
      );
      const inputFile = path.join(testDir, "colloquial.md");
      const outputFile = path.join(testDir, "colloquial.es.md");
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new AdversarialProvider("normal")
      ) as ProviderRegistry;

      await expect(
        executeCommand(registry, [
          inputFile,
          "--output",
          outputFile,
          "--dialect",
          "es-ES",
          "--policy",
          "permissive",
        ])
      ).resolves.not.toThrow();
    });
  });

  describe("checkpoint path traversal protection", () => {
    it("blocks auto-generated checkpoint path traversal via --output", async () => {
      const content = "# Hello\n\nWorld.";
      const inputFile = path.join(testDir, "traversal-input.md");
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new AdversarialProvider("normal")
      ) as ProviderRegistry;

      // --output with traversal should cause validateFilePath to reject the checkpoint
      await expect(
        executeCommand(registry, [
          inputFile,
          "--output",
          "../../../etc/passwd.txt",
          "--dialect",
          "es-ES",
        ])
      ).rejects.toThrow();
    });
  });

  describe("token protection ReDoS resistance", () => {
    it("completes quickly with adversarial long placeholders", () => {
      const longPlaceholder = "__ESPANOL_TOKEN_0__" + "_".repeat(5000);
      const replacements = new Map<string, string>([
        [longPlaceholder, "safe-token"],
      ]);
      const text = "some translated text with " + longPlaceholder;

      const start = Date.now();
      const result = restoreProtectedTokens(text, replacements);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(result).toContain("safe-token");
    });

    it("is safe with regex metacharacters in placeholders", () => {
      const maliciousPlaceholder = "__ESPANOL_TOKEN_(a+)+__";
      const replacements = new Map<string, string>([
        [maliciousPlaceholder, "safe-token"],
      ]);
      // Exact match is handled by split/join; regex path is exercised but
      // word boundaries may prevent matching normalized forms with non-word
      // trailing chars. The critical property is that it does not hang.
      const text = "translated text containing " + maliciousPlaceholder;

      const start = Date.now();
      const result = restoreProtectedTokens(text, replacements);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(result).toContain("safe-token");
    });
  });
});
