/**
 * Tests for translate-readme command
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createTranslateReadmeCommand } from "../commands/translate-readme.js";
import type { TranslationProvider } from "@espanol/types";
import type { ProviderRegistry } from "@espanol/providers";

// Mock provider for testing
class MockProvider implements TranslationProvider {
  readonly name = "mock";
  private translateFn: (text: string) => string;

  constructor(translateFn: (text: string) => string) {
    this.translateFn = translateFn;
  }

  async translate(
    text: string,
    _sourceLang: string,
    _targetLang: string,
    _options?: unknown
  ) {
    return {
      translatedText: this.translateFn(text),
      provider: "mock" as const,
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
}

describe("translate-readme command", () => {
  const testDir = "/tmp/espanol-cli-test";
  const inputFile = path.join(testDir, "README.md");
  const outputFile = path.join(testDir, "README.es.md");

  // Helper to execute command
  async function executeCommand(
    registry: ProviderRegistry,
    args: string[]
  ): Promise<void> {
    const command = createTranslateReadmeCommand(() => registry);
    const program = new Command();
    program.addCommand(command);
    program.configureOutput({
      writeErr: () => {}, // Suppress error output
      writeOut: () => {}, // Suppress normal output
    });

    // Add the command name to args
    await program.parseAsync(["translate-readme", ...args], { from: "user" });
  }

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("markdown parsing", () => {
    it("should parse headings and paragraphs correctly", async () => {
      const content = "# My Title\n\nThis is a paragraph.";
      await fs.writeFile(inputFile, content);

      // Simple translation: add prefix
      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# [ES] My Title");
      expect(result).toContain("[ES] This is a paragraph.");
    });

    it("should not translate code blocks", async () => {
      const content = `
# Installation

\`\`\`bash
npm install my-package
\`\`\`

Run the code:
\`\`\`javascript
console.log("Hello");
\`\`\`
`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => {
          // Code blocks shouldn't reach here
          if (text.includes("npm install") || text.includes('console.log')) {
            throw new Error("Code block should not be translated");
          }
          return `[ES] ${text}`;
        })
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      // Code blocks should be preserved exactly
      expect(result).toContain("```bash");
      expect(result).toContain("npm install my-package");
      expect(result).toContain("```javascript");
      expect(result).toContain('console.log("Hello")');
    });

    it("should preserve link URLs but translate link text", async () => {
      const content = `[Click here](https://example.com) for more info.`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => text.replace("Click here", "Haga clic aquí"))
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("[Haga clic aquí](https://example.com)");
    });

    it("should preserve image URLs but translate alt text", async () => {
      const content = `![Logo](https://example.com/logo.png)`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => text.replace("Logo", "Logotipo"))
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("[Logotipo](https://example.com/logo.png)");
    });
  });

  describe("file handling", () => {
    it("should handle empty files", async () => {
      await fs.writeFile(inputFile, "");

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toBe("");
    });

    it("should handle files with only frontmatter", async () => {
      const content = `---
title: My Document
date: 2024-01-01
---`;

      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      // Frontmatter should be preserved
      expect(result).toContain("---");
      expect(result).toContain("title: My Document");
    });

    it("should reject non-existent files", async () => {
      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await expect(
        executeCommand(registry, ["/nonexistent/file.md", "--output", outputFile])
      ).rejects.toThrow();
    });
  });

  describe("translation options", () => {
    it("should pass dialect option to provider", async () => {
      const content = "# Hello";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES-MX] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--dialect", "es-MX", "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# [ES-MX] Hello");
    });

    it("should pass formality option to provider", async () => {
      const content = "# Hello";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[Formal] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--formal", "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# [Formal] Hello");
    });

    it("should pass informal option to provider", async () => {
      const content = "# Hello";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[Informal] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--informal", "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# [Informal] Hello");
    });
  });

  describe("error handling", () => {
    it("should handle translation errors gracefully", async () => {
      const content = "# Hello";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider(() => {
          throw new Error("Translation failed");
        })
      ) as ProviderRegistry;

      await expect(
        executeCommand(registry, [inputFile, "--output", outputFile])
      ).rejects.toThrow();
    });

    it("should reject invalid markdown file paths", async () => {
      const content = "# Hello";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      // Try to use a path traversal attack
      await expect(
        executeCommand(registry, ["../../../etc/passwd", "--output", outputFile])
      ).rejects.toThrow();
    });
  });

  describe("output options", () => {
    it("should write to output file when specified", async () => {
      const content = "# Test";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      // Check output file exists
      const exists = await fs.access(outputFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# [ES] Test");
    });

    it("should output to stdout when no output file specified", async () => {
      const content = "# Test";
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await executeCommand(registry, [inputFile]);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("# [ES] Test"));

      consoleLogSpy.mockRestore();
    });
  });

  describe("complex markdown", () => {
    it("should handle lists correctly", async () => {
      const content = `
# Features

- First item
- Second item
- Third item
`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) =>
          text
            .replace("Features", "Características")
            .replace("First item", "Primer elemento")
            .replace("Second item", "Segundo elemento")
            .replace("Third item", "Tercer elemento")
        )
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("# Características");
      expect(result).toContain("- Primer elemento");
      expect(result).toContain("- Segundo elemento");
      expect(result).toContain("- Tercer elemento");
    });

    it("should handle blockquotes", async () => {
      const content = `> This is a quote`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => text.replace("This is a quote", "Esta es una cita"))
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("> Esta es una cita");
    });

    it("should handle horizontal rules", async () => {
      const content = `# Title\n\n---\n\nContent`;
      await fs.writeFile(inputFile, content);

      const registry = new MockRegistry(
        new MockProvider((text) => `[ES] ${text}`)
      ) as ProviderRegistry;

      await executeCommand(registry, [inputFile, "--output", outputFile]);

      const result = await fs.readFile(outputFile, "utf-8");
      expect(result).toContain("---");
    });
  });
});
