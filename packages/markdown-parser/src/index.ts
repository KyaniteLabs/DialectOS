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

import { marked, type Token } from "marked";
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

// Minimal interface for token walking — we use runtime checks for href/tokens/items
interface WalkableToken {
  href?: string;
  tokens?: WalkableToken[];
  items?: WalkableToken[];
  text?: string;
  type?: string;
  raw?: string;
  depth?: number;
  lang?: string;
  codeBlockStyle?: "indented" | "fenced";
  title?: string | null;
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
  const seen = new Set<string>();

  // Use marked's lexer to safely tokenize content (no regex ReDoS)
  const tokens = marked.lexer(content);

  function walkTokens(tokens: WalkableToken[]): void {
    for (const token of tokens) {
      if (token.href && typeof token.href === "string") {
        if (!seen.has(token.href)) {
          seen.add(token.href);
          urls.push(token.href);
        }
      }
      if (token.tokens && Array.isArray(token.tokens)) {
        walkTokens(token.tokens);
      }
      if (token.items && Array.isArray(token.items)) {
        walkTokens(token.items);
      }
    }
  }

  walkTokens(tokens);
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
function tokenToSection(token: WalkableToken): MarkdownSection {
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
  const tokens: WalkableToken[] = marked.lexer(remainingContent) as WalkableToken[];

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
      return reconstructTable(original, translated);
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

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuter = trimmed.startsWith("|") && trimmed.endsWith("|")
    ? trimmed.slice(1, -1)
    : trimmed;
  return withoutOuter.split("|").map((cell) => cell.trim());
}

function isAlignmentRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function formatTableRow(cells: string[], hadOuterPipes: boolean): string {
  const body = cells.map((cell) => ` ${cell.trim()} `).join("|");
  return hadOuterPipes ? `|${body}|` : body;
}

function tableContentCells(content: string): string[] | null {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((line) => line.includes("|"))) {
    return lines
      .filter((line) => !isAlignmentRow(line))
      .flatMap(splitTableRow)
      .filter((cell) => cell.length > 0);
  }
  return null;
}

function translatedCellsByOriginalShape(originalCells: string[], translatedContent: string): string[] {
  const tableCells = tableContentCells(translatedContent);
  if (tableCells && tableCells.length === originalCells.length) {
    return tableCells;
  }

  const translatedWords = translatedContent.split(/\s+/).filter(Boolean);
  if (translatedWords.length === 0) {
    return [];
  }

  const cells: string[] = [];
  let wordIndex = 0;
  for (const originalCell of originalCells) {
    const wordCount = Math.max(originalCell.split(/\s+/).filter(Boolean).length, 1);
    const next = translatedWords.slice(wordIndex, wordIndex + wordCount);
    if (next.length < wordCount) {
      return [];
    }
    cells.push(next.join(" "));
    wordIndex += wordCount;
  }

  if (wordIndex !== translatedWords.length) {
    return [];
  }

  return cells;
}

function reconstructTable(original: MarkdownSection, translated: MarkdownSection): string {
  const lines = original.raw.split("\n");
  const dataRows = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes("|") && !isAlignmentRow(line));
  const originalCells = dataRows.flatMap(({ line }) => splitTableRow(line));
  const translatedCells = translatedCellsByOriginalShape(originalCells, translated.content);

  if (originalCells.length === 0 || translatedCells.length !== originalCells.length) {
    return original.raw;
  }

  let translatedIndex = 0;
  const rebuilt = [...lines];
  for (const { line, index } of dataRows) {
    const cellCount = splitTableRow(line).length;
    const rowCells = translatedCells.slice(translatedIndex, translatedIndex + cellCount);
    translatedIndex += cellCount;
    rebuilt[index] = formatTableRow(rowCells, line.trim().startsWith("|") && line.trim().endsWith("|"));
  }

  return rebuilt.join("\n");
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
