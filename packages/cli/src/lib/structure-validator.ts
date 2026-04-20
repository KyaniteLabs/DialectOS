import { parseMarkdown } from "@espanol/markdown-parser";

export interface StructureValidationResult {
  valid: boolean;
  violations: string[];
}

const ALLOWED_INLINE_HTML_TAGS = new Set([
  "a",
  "code",
  "em",
  "strong",
  "img",
  "br",
  "sup",
  "sub",
  "kbd",
  "details",
  "summary",
]);

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export function validateMarkdownStructure(
  originalContent: string,
  translatedContent: string
): StructureValidationResult {
  const violations: string[] = [];

  const original = parseMarkdown(originalContent);
  const translated = parseMarkdown(translatedContent);

  if (original.sections.length !== translated.sections.length) {
    violations.push(
      `Section count mismatch: original=${original.sections.length}, translated=${translated.sections.length}`
    );
  }

  const originalTypes = original.sections.map((s) => s.type);
  const translatedTypes = translated.sections.map((s) => s.type);
  if (originalTypes.join("|") !== translatedTypes.join("|")) {
    violations.push("Section type order changed during translation");
  }

  const originalHeadingCount = countMatches(originalContent, /^#{1,6}\s/mg);
  const translatedHeadingCount = countMatches(translatedContent, /^#{1,6}\s/mg);
  if (originalHeadingCount !== translatedHeadingCount) {
    violations.push(
      `Heading count mismatch: original=${originalHeadingCount}, translated=${translatedHeadingCount}`
    );
  }

  const originalFenceCount = countMatches(originalContent, /```/g);
  const translatedFenceCount = countMatches(translatedContent, /```/g);
  if (originalFenceCount !== translatedFenceCount) {
    violations.push(
      `Code fence count mismatch: original=${originalFenceCount}, translated=${translatedFenceCount}`
    );
  }

  const tagRegex = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/gi;
  const translatedTags = Array.from(translatedContent.matchAll(tagRegex)).map(
    (m) => m[1].toLowerCase()
  );
  const unexpectedTags = translatedTags.filter(
    (tag) => !ALLOWED_INLINE_HTML_TAGS.has(tag)
  );
  if (unexpectedTags.length > 0) {
    violations.push(
      `Unexpected HTML tags introduced: ${Array.from(new Set(unexpectedTags)).join(", ")}`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
