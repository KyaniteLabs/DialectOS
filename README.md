# DialectOS

Spanish dialect translation server built on the Model Context Protocol (MCP).

DialectOS provides 16 MCP tools that understand Spanish dialect differences — translating, detecting, and adapting content across 20 regional variants (es-ES, es-MX, es-AR, es-CO, etc.) while preserving markdown structure, code comments, and locale file formatting.

## Architecture

```
packages/
├── mcp/              @espanol/mcp       — 16 MCP tools (stdio server)
├── cli/              @espanol/cli       — CLI commands for translation workflows
├── providers/        @espanol/providers — DeepL, LibreTranslate, MyMemory
├── security/         @espanol/security  — Rate limiting, path validation, sanitization
├── types/            @espanol/types    — Shared TypeScript types
├── locale-utils/     @espanol/locale   — Locale file diff/merge utilities
└── markdown-parser/  @espanol/md       — Structure-preserving markdown parser
```

## 16 MCP Tools

**Markdown Translation (4)**
- `translate_markdown` — Translate markdown while preserving structure
- `extract_translatable` — Extract translatable text from markdown
- `translate_api_docs` — Translate API documentation
- `create_bilingual_doc` — Create side-by-side bilingual documents

**i18n Operations (6)**
- `detect_missing_keys` — Compare locale files for missing keys
- `translate_missing_keys` — Translate missing keys
- `batch_translate_locales` — Batch translate to multiple dialects
- `manage_dialect_variants` — Create dialect-specific variants
- `check_formality` — Check formality consistency (tú vs usted)
- `apply_gender_neutral` — Apply gender-neutral language (elles, latine, x)

**Translation (6)**
- `translate_text` — Translate text to a specific Spanish dialect
- `detect_dialect` — Detect Spanish dialect from text
- `translate_code_comment` — Translate code comments (preserving code)
- `translate_readme` — Translate README files
- `search_glossary` — Search built-in glossary (500+ terms)
- `list_dialects` — List all 20 supported dialects with metadata

## Quick Start

### As MCP Server

Add to your MCP client configuration (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "npx",
      "args": ["-y", "@espanol/mcp"],
      "env": {
        "ALLOWED_LOCALE_DIRS": "/path/to/your/locales"
      }
    }
  }
}
```

### From Source

```bash
git clone https://github.com/Pastorsimon1798/DialectOS.git
cd DialectOS
pnpm install
pnpm build
pnpm --filter @espanol/mcp start
```

### CLI

```bash
pnpm install -g @espanol/cli
espanol translate "Hello world" --dialect es-MX
espanol i18n detect-missing ./locales/en.json ./locales/es.json
espanol dialects list
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPL_AUTH_KEY` | DeepL API key | — |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint | — |
| `ALLOWED_LOCALE_DIRS` | Comma-separated allowed directories for file tools | `process.cwd()` |
| `MYMEMORY_RATE_LIMIT` | MyMemory provider requests/min | `60` |
| `ESPANOL_RATE_LIMIT` | Tool-level rate limit `max,windowMs` | `60,60000` |
| `ESPANOL_LOG_LEVEL` | Logging level | `error` |

### Translation Providers

| Provider | Auth | Cost | Quality |
|----------|------|------|---------|
| DeepL | `DEEPL_AUTH_KEY` | Paid | Excellent |
| LibreTranslate | `LIBRETRANSLATE_URL` | Self-hosted | Good |
| MyMemory | None | Free | Basic |

All providers use circuit breaker pattern with automatic failover.

## Security

- Path traversal protection with symlink resolution
- Content length limits (512KB max)
- Rate limiting (60 req/min tool-level, configurable per-provider)
- Input sanitization (null bytes, control characters)
- Error message sanitization (no stack traces, no internal paths, no API keys)

## Development

```bash
pnpm install          # Install all dependencies
pnpm -r build         # Build all packages
pnpm -r test          # Run all tests (480+ tests across 7 packages)
pnpm --filter @espanol/mcp test  # Run MCP tests only (80 tests)
```

## License

MIT
