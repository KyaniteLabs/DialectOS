# @espanol/markdown-parser

Structure-preserving markdown parser for translation workflows.

## Features

- Parses headings, paragraphs, code blocks, tables, lists, blockquotes
- Preserves structure during round-trip translation
- Extracts URLs safely using marked lexer (no regex ReDoS)
- Validates extracted URLs via security module

## Usage

```typescript
import { parseMarkdown, reconstructMarkdown, extractTranslatableText } from "@espanol/markdown-parser";

// Parse markdown into sections
const parsed = parseMarkdown(content);
// parsed.sections = [{ type: "heading", content: "# Title", translatable: true }, ...]

// Reconstruct after translation
const translated = reconstructMarkdown(originalSections, translatedSections);

// Extract only translatable text
const text = extractTranslatableText(content);
```

## Security

URL extraction uses `marked.lexer()` instead of regex to prevent ReDoS attacks. All extracted URLs are validated through `@espanol/security` before processing.
