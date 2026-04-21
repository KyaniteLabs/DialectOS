# @espanol/mcp

Model Context Protocol server providing 16 tools for Spanish dialect translation.

## Usage

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "npx",
      "args": ["-y", "@espanol/mcp"],
      "env": {
        "DEEPL_AUTH_KEY": "your-key",
        "ALLOWED_LOCALE_DIRS": "/path/to/locales"
      }
    }
  }
}
```

## Available Tools

### Markdown Translation
- `translate_markdown` — Translate markdown preserving structure
- `extract_translatable` — Extract translatable text
- `translate_api_docs` — Translate API documentation
- `create_bilingual_doc` — Create side-by-side bilingual docs

### i18n Operations
- `detect_missing_keys` — Compare locale files
- `translate_missing_keys` — Auto-translate missing keys
- `batch_translate_locales` — Batch translate to multiple dialects
- `manage_dialect_variants` — Create dialect-specific variants
- `check_formality` — Check tú vs usted consistency
- `apply_gender_neutral` — Apply gender-neutral language

### Translation
- `translate_text` — Translate to any Spanish dialect
- `detect_dialect` — Detect dialect from text
- `translate_code_comment` — Translate comments, preserve code
- `translate_readme` — Full README translation pipeline
- `search_glossary` — Search 500+ term glossary
- `list_dialects` — List all 20 supported dialects

## Security

- stdout reserved for MCP messages; all logging goes to stderr
- Structured JSON error handling
- Graceful shutdown on SIGINT/SIGTERM
