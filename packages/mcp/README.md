# @dialectos/mcp

Model Context Protocol server providing 18 tools for Spanish dialect translation across 25 regional variants.

> v0.3.2 is distributed as GitHub Release tarballs. `GET https://registry.npmjs.org/@kyanitelabs/dialectos` and `GET https://registry.npmjs.org/dialectos` both return 404 — there is no npm package. The tarball bundles the unpublished `@dialectos/*` workspace packages.

## Usage

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "pnpm",
      "args": [
        "dlx",
        "https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.2/dialectos-mcp-0.3.2.tgz"
      ],
      "env": {
        "DEEPL_AUTH_KEY": "your-key",
        "ALLOWED_LOCALE_DIRS": "/path/to/locales"
      }
    }
  }
}
```

`ALLOWED_LOCALE_DIRS` is a comma-separated list of the only directories the
server may read or write; when set, it replaces the working directory. Without
it the server falls back to its working directory, but never to `/` or your
home directory, so set it when your client starts servers from either.

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
- `search_glossary` — Search 300+ source-attributed glossary terms
- `list_dialects` — List all 25 supported dialects
- `research_regional_term` — Research source-backed regional lexeme proposals without mutating runtime data
- `validate_translation` — Check an existing translation with the same validator as the CLI and GitHub Action

## Security

- stdout reserved for MCP messages; all logging goes to stderr
- Structured JSON error handling
- Graceful shutdown on SIGINT/SIGTERM
