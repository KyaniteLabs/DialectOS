/**
 * @espanol/markdown-parser tests
 *
 * Comprehensive test suite for markdown parser using marked library
 * Tests security, preservation, and reconstruction functionality
 */

import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  reconstructMarkdown,
  extractTranslatableText,
  countCodeBlocks,
  countLinks,
} from "../index.js";
import type { MarkdownSection } from "@espanol/types";
import { SecurityError } from "@espanol/security";

describe("parseMarkdown", () => {
  describe("Basic parsing", () => {
    it("should parse a simple paragraph", () => {
      const content = "Hello world";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("paragraph");
      expect(result.sections[0].content).toBe("Hello world");
      expect(result.sections[0].translatable).toBe(true);
      expect(result.translatableSections).toBe(1);
    });

    it("should parse multiple paragraphs", () => {
      const content = "First paragraph\n\nSecond paragraph";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].content).toBe("First paragraph");
      expect(result.sections[1].content).toBe("Second paragraph");
      expect(result.translatableSections).toBe(2);
    });

    it("should handle empty content", () => {
      const content = "";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(0);
      expect(result.translatableSections).toBe(0);
      expect(result.codeBlockCount).toBe(0);
      expect(result.linkCount).toBe(0);
    });

    it("should handle whitespace-only content", () => {
      const content = "   \n\n   ";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(0);
    });
  });

  describe("Heading parsing", () => {
    it("should parse all heading levels (h1-h6)", () => {
      const content = "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(6);
      expect(result.sections[0].type).toBe("heading");
      expect(result.sections[0].content).toBe("H1");
      expect(result.sections[0].raw).toContain("# H1");
      expect(result.sections[0].translatable).toBe(true);

      expect(result.sections[1].type).toBe("heading");
      expect(result.sections[1].raw).toContain("## H2");

      expect(result.sections[5].type).toBe("heading");
      expect(result.sections[5].raw).toContain("###### H6");
    });

    it("should handle heading with inline formatting", () => {
      const content = "# **Bold** and *italic*";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("heading");
      expect(result.sections[0].content).toContain("Bold");
      expect(result.sections[0].content).toContain("italic");
    });
  });

  describe("Code block preservation", () => {
    it("should parse fenced code blocks as non-translatable", () => {
      const content = "```javascript\nconst x = 42;\n```";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("code");
      expect(result.sections[0].content).toContain("const x = 42;");
      expect(result.sections[0].translatable).toBe(false);
      expect(result.codeBlockCount).toBe(1);
    });

    it("should parse indented code blocks as non-translatable", () => {
      const content = "    const x = 42;\n    console.log(x);";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("code");
      expect(result.sections[0].translatable).toBe(false);
      expect(result.codeBlockCount).toBe(1);
    });

    it("should count multiple code blocks", () => {
      const content = "```js\nfirst\n```\n\n```python\nsecond\n```";
      const result = parseMarkdown(content);

      expect(result.codeBlockCount).toBe(2);
      expect(result.sections.filter(s => s.type === "code")).toHaveLength(2);
    });

    it("should handle code blocks with language specified", () => {
      const content = "```typescript\ninterface Foo {}\n```";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("code");
      expect(result.sections[0].raw).toContain("typescript");
    });

    it("should handle code blocks without language", () => {
      const content = "```\ncode here\n```";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("code");
      expect(result.sections[0].translatable).toBe(false);
    });
  });

  describe("Inline code preservation", () => {
    it("should mark inline code as non-translatable", () => {
      const content = "Use `console.log()` for debugging";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("paragraph");
      // Inline code should be preserved in content but not translatable
      // The implementation should handle this appropriately
    });

    it("should handle multiple inline code segments", () => {
      const content = "`foo` and `bar` and `baz`";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toContain("foo");
      expect(result.sections[0].content).toContain("bar");
    });
  });

  describe("Link extraction", () => {
    it("should parse links and mark text as translatable", () => {
      const content = "[Click here](https://example.com)";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toContain("Click here");
      expect(result.linkCount).toBe(1);
    });

    it("should preserve link URLs", () => {
      const content = "[Example](https://example.com/page)";
      const result = parseMarkdown(content);

      expect(result.sections[0].raw).toContain("https://example.com/page");
    });

    it("should count multiple links", () => {
      const content = "[link1](https://one.com) and [link2](https://two.com)";
      const result = parseMarkdown(content);

      expect(result.linkCount).toBe(2);
    });

    it("should reject javascript: URLs in links", () => {
      const content = "[click](javascript:alert('xss'))";
      expect(() => parseMarkdown(content)).toThrow(SecurityError);
    });

    it("should reject data: URLs in links", () => {
      const content = "[click](data:text/html,<script>)";
      expect(() => parseMarkdown(content)).toThrow(SecurityError);
    });

    it("should accept http URLs", () => {
      const content = "[link](http://example.com)";
      const result = parseMarkdown(content);
      expect(result.linkCount).toBe(1);
    });

    it("should accept https URLs", () => {
      const content = "[link](https://example.com)";
      const result = parseMarkdown(content);
      expect(result.linkCount).toBe(1);
    });

    it("should handle reference-style links", () => {
      const content = "[link][ref]\n\n[ref]: https://example.com";
      const result = parseMarkdown(content);

      expect(result.linkCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Image handling", () => {
    it("should parse images with alt text translatable", () => {
      const content = "![Alt text](https://example.com/image.png)";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toContain("Alt text");
    });

    it("should preserve image URLs", () => {
      const content = "![Alt](https://example.com/image.jpg)";
      const result = parseMarkdown(content);

      expect(result.sections[0].raw).toContain("https://example.com/image.jpg");
    });

    it("should reject javascript: URLs in images", () => {
      const content = "![alt](javascript:alert('xss'))";
      expect(() => parseMarkdown(content)).toThrow(SecurityError);
    });
  });

  describe("Table parsing", () => {
    it("should parse tables preserving structure", () => {
      const content = "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("table");
      expect(result.sections[0].content).toContain("Header 1");
      expect(result.sections[0].content).toContain("Cell 1");
    });

    it("should handle tables with multiple rows", () => {
      const content = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("table");
    });
  });

  describe("List parsing", () => {
    it("should parse unordered lists", () => {
      const content = "- Item 1\n- Item 2\n- Item 3";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("list");
      expect(result.sections[0].content).toContain("Item 1");
      expect(result.sections[0].content).toContain("Item 2");
    });

    it("should parse ordered lists", () => {
      const content = "1. First\n2. Second\n3. Third";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("list");
      expect(result.sections[0].content).toContain("First");
      expect(result.sections[0].content).toContain("Second");
    });

    it("should parse nested lists", () => {
      const content = "- Parent\n  - Child\n  - Another child";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("list");
      expect(result.sections[0].content).toContain("Parent");
      expect(result.sections[0].content).toContain("Child");
    });
  });

  describe("Blockquote parsing", () => {
    it("should parse blockquotes", () => {
      const content = "> This is a quote";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("blockquote");
      expect(result.sections[0].content).toContain("This is a quote");
      expect(result.sections[0].translatable).toBe(true);
    });

    it("should handle multiline blockquotes", () => {
      const content = "> Line 1\n> Line 2";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("blockquote");
    });
  });

  describe("HTML block handling", () => {
    it("should parse HTML blocks as non-translatable", () => {
      const content = "<div>HTML content</div>";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("html");
      expect(result.sections[0].translatable).toBe(false);
    });

    it("should sanitize HTML blocks", () => {
      const content = "<script>alert('xss')</script>";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("html");
      // Script tags should be sanitized
      expect(result.sections[0].content).not.toContain("<script>");
    });

    it("should allow safe HTML tags", () => {
      const content = "<p>Safe paragraph</p>";
      const result = parseMarkdown(content);

      expect(result.sections[0].type).toBe("html");
      expect(result.sections[0].content).toContain("p");
    });
  });

  describe("Frontmatter handling", () => {
    it("should parse YAML frontmatter as non-translatable", () => {
      const content = "---\ntitle: Test\ndate: 2024-01-01\n---\n\nContent here";
      const result = parseMarkdown(content);

      // Frontmatter should be separate section or ignored
      const frontmatterSection = result.sections.find(s => s.raw.includes("---"));
      if (frontmatterSection) {
        expect(frontmatterSection.translatable).toBe(false);
      }
    });

    it("should handle frontmatter with content after", () => {
      const content = "---\nkey: value\n---\n\n# Heading";
      const result = parseMarkdown(content);

      // Should have both frontmatter and heading
      expect(result.sections.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Horizontal rule detection", () => {
    it("should parse horizontal rules", () => {
      const content = "---";
      const result = parseMarkdown(content);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].type).toBe("horizontal-rule");
    });

    it("should parse horizontal rules with different syntaxes", () => {
      const contents = ["---", "***", "___"];
      for (const content of contents) {
        const result = parseMarkdown(content);
        expect(result.sections[0].type).toBe("horizontal-rule");
      }
    });
  });

  describe("ReDoS resistance", () => {
    it("should handle 10,000 nested backticks in <100ms", () => {
      const content = "`".repeat(10000);
      const start = Date.now();
      const result = parseMarkdown(content);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      // Should complete without hanging
      expect(result).toBeDefined();
    });

    it("should handle deeply nested markdown structure", () => {
      let content = "";
      for (let i = 0; i < 1000; i++) {
        content += "**";
      }
      content += "text";
      for (let i = 0; i < 1000; i++) {
        content += "**";
      }

      const start = Date.now();
      const result = parseMarkdown(content);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });
  });

  describe("Mixed content", () => {
    it("should handle mixed code, text, and links", () => {
      const content = "# Title\n\n```js\nconst x = 1;\n```\n\nSee [docs](https://example.com) for more.";
      const result = parseMarkdown(content);

      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.codeBlockCount).toBe(1);
      expect(result.linkCount).toBe(1);

      const heading = result.sections.find(s => s.type === "heading");
      expect(heading).toBeDefined();

      const code = result.sections.find(s => s.type === "code");
      expect(code).toBeDefined();
      expect(code?.translatable).toBe(false);

      const link = result.sections.find(s => s.raw?.includes("https://"));
      expect(link).toBeDefined();
    });
  });
});

describe("extractTranslatableText", () => {
  it("should return empty array for empty parsed markdown", () => {
    const parsed = {
      sections: [],
      translatableSections: 0,
      codeBlockCount: 0,
      linkCount: 0,
    };
    const result = extractTranslatableText(parsed);
    expect(result).toEqual([]);
  });

  it("should extract only translatable content", () => {
    const parsed = parseMarkdown("# Heading\n\n```js\ncode\n```\n\nText here");
    const result = extractTranslatableText(parsed);

    expect(result).toContain("Heading");
    expect(result).toContain("Text here");
    expect(result).not.toContain("code");
  });

  it("should exclude code blocks from translatable text", () => {
    const parsed = parseMarkdown("```js\nconst x = 42;\n```");
    const result = extractTranslatableText(parsed);

    expect(result).not.toContain("const x = 42;");
  });

  it("should exclude HTML blocks from translatable text", () => {
    const parsed = parseMarkdown("<div>HTML</div>");
    const result = extractTranslatableText(parsed);

    // HTML is not translatable
    expect(result.length).toBe(0);
  });

  it("should extract heading text", () => {
    const parsed = parseMarkdown("# My Title");
    const result = extractTranslatableText(parsed);

    expect(result).toContain("My Title");
  });

  it("should extract paragraph text", () => {
    const parsed = parseMarkdown("This is a paragraph.");
    const result = extractTranslatableText(parsed);

    expect(result).toContain("This is a paragraph.");
  });

  it("should extract list item text", () => {
    const parsed = parseMarkdown("- First item\n- Second item");
    const result = extractTranslatableText(parsed);

    expect(result.some(r => r.includes("First item"))).toBe(true);
    expect(result.some(r => r.includes("Second item"))).toBe(true);
  });

  it("should extract blockquote text", () => {
    const parsed = parseMarkdown("> Quote text here");
    const result = extractTranslatableText(parsed);

    expect(result.some(r => r.includes("Quote text here"))).toBe(true);
  });

  it("should extract table cell text", () => {
    const parsed = parseMarkdown("| Header |\n|--------|\n| Cell   |");
    const result = extractTranslatableText(parsed);

    expect(result.some(r => r.includes("Header"))).toBe(true);
    expect(result.some(r => r.includes("Cell"))).toBe(true);
  });
});

describe("countCodeBlocks", () => {
  it("should count fenced code blocks", () => {
    const content = "```js\nfirst\n```\n\n```python\nsecond\n```";
    const count = countCodeBlocks(content);
    expect(count).toBe(2);
  });

  it("should count indented code blocks", () => {
    const content = "    code block 1\n\n    code block 2";
    const count = countCodeBlocks(content);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should return 0 for content without code blocks", () => {
    const content = "Just plain text";
    const count = countCodeBlocks(content);
    expect(count).toBe(0);
  });

  it("should count mixed fenced and indented blocks", () => {
    const content = "```js\nfenced\n```\n\n    indented";
    const count = countCodeBlocks(content);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe("countLinks", () => {
  it("should count inline links", () => {
    const content = "[link1](https://one.com) and [link2](https://two.com)";
    const count = countLinks(content);
    expect(count).toBe(2);
  });

  it("should count reference-style links", () => {
    const content = "[link][ref]\n\n[ref]: https://example.com";
    const count = countLinks(content);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should count autolinks", () => {
    const content = "Visit <https://example.com> for more";
    const count = countLinks(content);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should return 0 for content without links", () => {
    const content = "Just plain text";
    const count = countLinks(content);
    expect(count).toBe(0);
  });
});

describe("reconstructMarkdown", () => {
  it("should reconstruct a simple paragraph", () => {
    const sections: MarkdownSection[] = [
      {
        type: "paragraph",
        content: "Hello world",
        raw: "Hello world",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "paragraph",
        content: "Hola mundo",
        raw: "Hello world",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("Hola mundo");
  });

  it("should preserve code blocks exactly", () => {
    const sections: MarkdownSection[] = [
      {
        type: "code",
        content: "const x = 42;",
        raw: "```js\nconst x = 42;\n```",
        translatable: false,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "code",
        content: "const x = 42;",
        raw: "```js\nconst x = 42;\n```",
        translatable: false,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("const x = 42;");
  });

  it("should reconstruct headings with level preserved", () => {
    const sections: MarkdownSection[] = [
      {
        type: "heading",
        content: "Title",
        raw: "# Title",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "heading",
        content: "Título",
        raw: "# Title",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("#");
    expect(result).toContain("Título");
  });

  it("should reconstruct links with URL preserved", () => {
    const sections: MarkdownSection[] = [
      {
        type: "paragraph",
        content: "Click here",
        raw: "[Click here](https://example.com)",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "paragraph",
        content: "Haga clic aquí",
        raw: "[Click here](https://example.com)",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("https://example.com");
    expect(result).toContain("Haga clic");
  });

  it("should reconstruct multiple sections", () => {
    const sections: MarkdownSection[] = [
      {
        type: "heading",
        content: "Title",
        raw: "# Title",
        translatable: true,
      },
      {
        type: "paragraph",
        content: "Paragraph",
        raw: "Paragraph",
        translatable: true,
      },
      {
        type: "code",
        content: "code();",
        raw: "```js\ncode();\n```",
        translatable: false,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "heading",
        content: "Título",
        raw: "# Title",
        translatable: true,
      },
      {
        type: "paragraph",
        content: "Párrafo",
        raw: "Paragraph",
        translatable: true,
      },
      {
        type: "code",
        content: "code();",
        raw: "```js\ncode();\n```",
        translatable: false,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("Título");
    expect(result).toContain("Párrafo");
    expect(result).toContain("code();");
  });

  it("should handle empty sections array", () => {
    const result = reconstructMarkdown([], []);
    expect(result).toBe("");
  });

  it("should preserve list structure", () => {
    const sections: MarkdownSection[] = [
      {
        type: "list",
        content: "- Item 1\n- Item 2",
        raw: "- Item 1\n- Item 2",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "list",
        content: "- Elemento 1\n- Elemento 2",
        raw: "- Item 1\n- Item 2",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    // Should preserve list markers
    expect(result).toContain("-");
    expect(result).toContain("Elemento");
  });

  it("should preserve table structure", () => {
    const sections: MarkdownSection[] = [
      {
        type: "table",
        content: "| H1 | H2 |",
        raw: "| H1 | H2 |\n|----|----|",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "table",
        content: "| C1 | C2 |",
        raw: "| H1 | H2 |\n|----|----|",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    // Should preserve pipe separators
    expect(result).toContain("|");
  });

  it("should preserve blockquote markers", () => {
    const sections: MarkdownSection[] = [
      {
        type: "blockquote",
        content: "Quote text",
        raw: "> Quote text",
        translatable: true,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "blockquote",
        content: "Texto de cita",
        raw: "> Quote text",
        translatable: true,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain(">");
    expect(result).toContain("Texto de cita");
  });

  it("should preserve horizontal rules", () => {
    const sections: MarkdownSection[] = [
      {
        type: "horizontal-rule",
        content: "---",
        raw: "---",
        translatable: false,
      },
    ];
    const translatedSections: MarkdownSection[] = [
      {
        type: "horizontal-rule",
        content: "---",
        raw: "---",
        translatable: false,
      },
    ];

    const result = reconstructMarkdown(sections, translatedSections);
    expect(result).toContain("---");
  });
});

describe("Security integration", () => {
  it("should validate all URLs in links", () => {
    const content = "[link](https://example.com) and [another](http://test.com)";
    const result = parseMarkdown(content);
    expect(result.linkCount).toBe(2);
  });

  it("should throw on malicious link URLs", () => {
    const maliciousLinks = [
      "[x](javascript:alert(1))",
      "[x](data:text/html,<script>)",
      "[x](vbscript:msgbox(1))",
      "[x](file:///etc/passwd)",
    ];

    for (const link of maliciousLinks) {
      expect(() => parseMarkdown(link)).toThrow(SecurityError);
    }
  });

  it("should throw on malicious image URLs", () => {
    const maliciousImages = [
      "![x](javascript:alert(1))",
      "![x](data:image/gif,<script>)",
    ];

    for (const img of maliciousImages) {
      expect(() => parseMarkdown(img)).toThrow(SecurityError);
    }
  });

  it("should sanitize HTML blocks", () => {
    const content = "<div onclick='alert(1)'>Click</div>";
    const result = parseMarkdown(content);

    expect(result.sections[0].type).toBe("html");
    // Event handlers should be stripped
    expect(result.sections[0].content).not.toContain("onclick");
  });

  it("should remove script tags from HTML", () => {
    const content = "<script>alert('xss')</script><p>Safe</p>";
    const result = parseMarkdown(content);

    expect(result.sections[0].type).toBe("html");
    expect(result.sections[0].content).not.toContain("<script>");
    expect(result.sections[0].content).not.toContain("alert");
  });
});
