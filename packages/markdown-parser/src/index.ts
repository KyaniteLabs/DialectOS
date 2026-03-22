/**
 * @espanol/markdown-parser
 *
 * Safe markdown parser using marked library
 * Replaces vulnerable regex-based parser
 *
 * Features:
 * - Uses marked tokenizer for parsing (no regex ReDoS)
 * - Validates all URLs via @espanol/security
 * - Sanitizes HTML blocks with DOMPurify
 * - Preserves code blocks, inline code, links, images
 * - Supports translation workflows
 */

import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import {
  type MarkdownSection,
  type MarkdownSectionType,
  type ParsedMarkdown,
} from "@espanol/types";
import {
  validateMarkdownUrl,
  sanitizeHtml,
  SecurityError,
} from "@espanol/security";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended token type from marked with additional properties
 */
interface MarkedToken {
  type: string;
  raw?: string;
  text?: string;
  depth?: number;
  items?: any[];
  lang?: string;
  codeBlockStyle?: "indented" | "fenced";
  tokens?: any[];
  href?: string;
  title?: string;
  [key: string]: any;
}

// ============================================================================
// URL Extraction and Validation
// ============================================================================

/**
 * Extract all URLs from markdown content
 * Used for validation before parsing
 */
function extractUrlsFromContent(content: string): string[] {
  const urls: string[] = [];

  // Match inline links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  // Match images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  // Match autolinks: <url>
  const autolinkRegex = /<([^>\s]+)>/g;
  while ((match = autolinkRegex.exec(content)) !== null) {
    const url = match[1];
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.push(url);
    }
  }

  // Match reference-style link definitions: [ref]: url
  const refRegex = /^\s*\[([^\]]+)\]:\s*(\S+)/gm;
  while ((match = refRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}

/**
 * Validate all URLs in markdown content
 * Throws SecurityError if any URL is malicious
 */
function validateAllUrls(content: string): void {
  const urls = extractUrlsFromContent(content);

  for (const url of urls) {
    try {
      validateMarkdownUrl(url);
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      // Re-throw as SecurityError for consistency
      throw new SecurityError(
        `Invalid URL in markdown: ${url}`,
        error instanceof Error && "code" in error
          ? (error as any).code
          : undefined
      );
    }
  }
}

// ============================================================================
// Token to Section Conversion
// ============================================================================

/**
 * Convert a marked token to a MarkdownSection
 */
function tokenToSection(token: MarkedToken): MarkdownSection {
  const raw = token.raw || "";

  switch (token.type) {
    case "heading": {
      return {
        type: "heading" as MarkdownSectionType,
        content: token.text || "",
        raw,
        translatable: true,
      };
    }

    case "paragraph": {
      return {
        type: "paragraph" as MarkdownSectionType,
        content: token.text || "",
        raw,
        translatable: true,
      };
    }

    case "code": {
      return {
        type: "code" as MarkdownSectionType,
        content: token.text || "",
        raw,
        translatable: false, // Code blocks are never translated
      };
    }

    case "table": {
      // Extract table content from header and rows
      let content = "";

      // Add header content
      if (token.header && Array.isArray(token.header)) {
        for (const cell of token.header) {
          if (cell && cell.text) {
            content += cell.text + " ";
          }
        }
      }

      // Add row content
      if (token.rows && Array.isArray(token.rows)) {
        for (const row of token.rows) {
          if (row && Array.isArray(row)) {
            for (const cell of row) {
              if (cell && cell.text) {
                content += cell.text + " ";
              }
            }
          }
        }
      }

      return {
        type: "table" as MarkdownSectionType,
        content: content.trim(),
        raw,
        translatable: true, // Table cell content is translatable
      };
    }

    case "list": {
      // Extract list item text
      let content = "";
      if (token.items && Array.isArray(token.items)) {
        for (const item of token.items) {
          if (item.text) {
            content += item.text + "\n";
          } else if (item.tokens && Array.isArray(item.tokens)) {
            for (const subToken of item.tokens) {
              if (subToken.text || subToken.raw) {
                content += subToken.text || subToken.raw;
              }
            }
            content += "\n";
          }
        }
      }

      return {
        type: "list" as MarkdownSectionType,
        content: content.trim(),
        raw,
        translatable: true, // List content is translatable
      };
    }

    case "blockquote": {
      return {
        type: "blockquote" as MarkdownSectionType,
        content: token.text || "",
        raw,
        translatable: true,
      };
    }

    case "hr": {
      return {
        type: "horizontal-rule" as MarkdownSectionType,
        content: raw || "---",
        raw: raw || "---",
        translatable: false,
      };
    }

    case "html": {
      // Check if this is actually a horizontal rule (marked sometimes parses them as html)
      const trimmed = raw.trim();
      if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
        return {
          type: "horizontal-rule" as MarkdownSectionType,
          content: trimmed,
          raw,
          translatable: false,
        };
      }

      // Sanitize HTML blocks
      const sanitized = sanitizeHtml(token.text || "");
      return {
        type: "html" as MarkdownSectionType,
        content: sanitized, // Even if empty, this is the sanitized version
        raw,
        translatable: false, // HTML blocks are not translated
      };
    }

    default: {
      // Handle unknown token types
      return {
        type: "paragraph" as MarkdownSectionType,
        content: token.text || raw,
        raw,
        translatable: true,
      };
    }
  }
}

// ============================================================================
// Frontmatter Detection
// ============================================================================

/**
 * Check if content starts with YAML frontmatter
 * Frontmatter must start with --- and have a closing --- later
 */
function hasFrontmatter(content: string): boolean {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return false;
  }

  // Check if there's a closing --- within the first few lines
  const lines = trimmed.split("\n");
  // Frontmatter must have closing --- within first 20 lines
  const checkLimit = Math.min(lines.length, 20);
  for (let i = 1; i < checkLimit; i++) {
    if (lines[i].trim() === "---") {
      return true; // Valid frontmatter
    }
  }

  return false; // No closing --- found, not frontmatter
}

/**
 * Extract and remove YAML frontmatter from content
 * Returns [frontmatterRaw, remainingContent]
 */
function extractFrontmatter(content: string): [string, string] {
  if (!hasFrontmatter(content)) {
    return ["", content];
  }

  const lines = content.split("\n");
  let endIdx = -1;

  // Find the closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    // No closing --- found, treat entire content as frontmatter
    return [content, ""];
  }

  const frontmatter = lines.slice(0, endIdx + 1).join("\n");
  const remaining = lines.slice(endIdx + 1).join("\n");

  return [frontmatter, remaining];
}

// ============================================================================
// Main Parsing Function
// ============================================================================

/**
 * Parse markdown into sections for translation
 *
 * @param content - Markdown content to parse
 * @returns ParsedMarkdown with sections and metadata
 * @throws SecurityError if URLs are invalid
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  // Validate all URLs first (before any parsing)
  validateAllUrls(content);

  const sections: MarkdownSection[] = [];
  let codeBlockCount = 0;
  let linkCount = 0;

  // Extract and handle frontmatter
  const [frontmatter, remainingContent] = extractFrontmatter(content);

  if (frontmatter) {
    // Add frontmatter as a non-translatable section
    sections.push({
      type: "html" as MarkdownSectionType,
      content: frontmatter,
      raw: frontmatter,
      translatable: false,
    });
  }

  // Count code blocks before parsing
  codeBlockCount = countCodeBlocks(remainingContent);
  linkCount = countLinks(remainingContent);

  // Use marked lexer to tokenize
  const tokens: MarkedToken[] = marked.lexer(remainingContent) as MarkedToken[];

  // Convert tokens to sections
  for (const token of tokens) {
    const section = tokenToSection(token);

    // Filter out empty sections (whitespace-only content)
    // But keep HTML sections even if empty (sanitized scripts)
    if (section.content.trim() || section.type === "horizontal-rule" || section.type === "html") {
      sections.push(section);
    }
  }

  // Count translatable sections
  const translatableSections = sections.filter((s) => s.translatable).length;

  return {
    sections,
    translatableSections,
    codeBlockCount,
    linkCount,
  };
}

// ============================================================================
// Reconstruction Function
// ============================================================================

/**
 * Reconstruct markdown from translated sections
 *
 * @param sections - Original sections
 * @param translatedSections - Translated sections (same length)
 * @returns Reconstructed markdown document
 */
export function reconstructMarkdown(
  sections: MarkdownSection[],
  translatedSections: MarkdownSection[]
): string {
  if (sections.length === 0) {
    return "";
  }

  if (sections.length !== translatedSections.length) {
    throw new Error(
      "Section count mismatch: original and translated must have same length"
    );
  }

  const parts: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const original = sections[i];
    const translated = translatedSections[i];

    // If not translatable, use original raw
    if (!original.translatable) {
      parts.push(original.raw);
    } else {
      // For translatable sections, we need to reconstruct
      // preserving the structure but using translated content
      parts.push(reconstructSection(original, translated));
    }
  }

  return parts.join("\n\n").trim();
}

/**
 * Reconstruct a single section from original and translated
 */
function reconstructSection(
  original: MarkdownSection,
  translated: MarkdownSection
): string {
  switch (original.type) {
    case "heading": {
      // Extract heading level from raw (e.g., "# " -> level 1)
      const match = original.raw.match(/^(#{1,6})\s/);
      if (match) {
        const level = match[1];
        return `${level} ${translated.content}`;
      }
      return translated.content;
    }

    case "paragraph": {
      // For paragraphs, check if there are links that need URL preservation
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const urlMatches = [...original.raw.matchAll(linkRegex)];

      // If original has links, extract URLs and create links with translated text
      if (urlMatches.length > 0) {
        // If there's only one link and translated content is plain text,
        // create a link with the translated text
        if (urlMatches.length === 1 && !translated.content.includes("](")) {
          const url = urlMatches[0][2];
          return `[${translated.content}](${url})`;
        }

        // Multiple links or translated content already has link format
        // Try to replace URLs in translated content
        let result = translated.content;
        let matchIdx = 0;
        result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, text) => {
          if (matchIdx < urlMatches.length) {
            const url = urlMatches[matchIdx][2];
            matchIdx++;
            return `[${text}](${url})`;
          }
          return match;
        });
        return result;
      }

      return translated.content;
    }

    case "code": {
      // Code blocks are never translated, use original
      return original.raw;
    }

    case "table": {
      // Tables: try to preserve structure
      // This is a simplified version - a full implementation would
      // parse the table structure and replace cell content
      return original.raw; // Preserve original structure for now
    }

    case "list": {
      // Lists: preserve structure markers, replace content
      const lines = original.raw.split("\n");
      const translatedLines = translated.content.split("\n");
      const result: string[] = [];
      let translatedIdx = 0;

      for (const line of lines) {
        // Check if this is a list item line (starts with -, *, +, or number)
        const listItemMatch = line.match(/^(\s*[-*+]|\s*\d+\.)\s+/);
        if (listItemMatch && translatedIdx < translatedLines.length) {
          const marker = listItemMatch[1];
          const translatedContent = translatedLines[translatedIdx].trim();
          result.push(`${marker} ${translatedContent}`);
          translatedIdx++;
        } else {
          // Preserve empty lines or non-list-item lines
          result.push(line);
        }
      }

      return result.join("\n");
    }

    case "blockquote": {
      // Blockquotes: preserve the > marker
      const lines = original.raw.split("\n");
      const translatedLines = translated.content.split("\n");
      const result: string[] = [];

      for (let i = 0; i < Math.max(lines.length, translatedLines.length); i++) {
        const marker = lines[i]?.match(/^>\s*/)?.[0] || "> ";
        const content = translatedLines[i] || "";
        result.push(`${marker}${content}`);
      }

      return result.join("\n");
    }

    case "html": {
      // HTML is not translated, use original
      return original.raw;
    }

    case "horizontal-rule": {
      return original.raw;
    }

    default: {
      return translated.content;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all translatable text from parsed markdown
 *
 * @param parsed - Parsed markdown result
 * @returns Array of translatable text strings
 */
export function extractTranslatableText(parsed: ParsedMarkdown): string[] {
  const texts: string[] = [];

  for (const section of parsed.sections) {
    if (section.translatable && section.content) {
      texts.push(section.content);
    }
  }

  return texts;
}

/**
 * Count code blocks in markdown content
 * Counts both fenced (```) and indented code blocks
 *
 * @param content - Markdown content
 * @returns Number of code blocks
 */
export function countCodeBlocks(content: string): number {
  let count = 0;

  // Count fenced code blocks
  const fencedRegex = /```[\s\S]*?```/g;
  const fencedMatches = content.match(fencedRegex);
  if (fencedMatches) {
    count += fencedMatches.length;
  }

  // Count indented code blocks (4+ spaces or tab at line start)
  const lines = content.split("\n");
  let inIndentedBlock = false;

  for (const line of lines) {
    // Check if line starts with 4+ spaces or a tab
    const isIndented = /^(\t|    )./.test(line);
    const isEmpty = line.trim() === "";

    if (isIndented) {
      if (!inIndentedBlock) {
        count++;
        inIndentedBlock = true;
      }
    } else if (!isEmpty) {
      inIndentedBlock = false;
    }
  }

  return count;
}

/**
 * Count links in markdown content
 * Counts inline links, reference links, and autolinks
 *
 * @param content - Markdown content
 * @returns Number of links
 */
export function countLinks(content: string): number {
  let count = 0;

  // Count inline links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const linkMatches = content.match(linkRegex);
  if (linkMatches) {
    count += linkMatches.length;
  }

  // Count reference-style links: [text][ref]
  const refLinkRegex = /\[([^\]]+)\]\[[^\]]*\]/g;
  const refLinkMatches = content.match(refLinkRegex);
  if (refLinkMatches) {
    count += refLinkMatches.length;
  }

  // Count autolinks: <url>
  const autolinkRegex = /<(https?:\/\/[^>]+)>/g;
  let match;
  while ((match = autolinkRegex.exec(content)) !== null) {
    count++;
  }

  return count;
}
