# @espanol/mcp

MCP adapter for DialectOS — provides 16 Model Context Protocol tools for Spanish dialect translation, i18n management, and documentation translation.

## Installation

```bash
pnpm add @espanol/mcp
```

## Quick Start

Add to your MCP client configuration:

**Claude Desktop** (`claude_desktop_config.json`):
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

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "dialectos": {
      "command": "npx",
      "args": ["-y", "@espanol/mcp"],
      "env": {}
    }
  }
}
```

## 16 Available Tools

### Markdown Translation (4 tools)

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `translate_markdown` | Translate markdown preserving code blocks, links, tables | `filePath`, `dialect?`, `provider?` |
| `extract_translatable` | Extract translatable text from markdown | `filePath` |
| `translate_api_docs` | Translate API docs with table/list handling | `filePath`, `dialect?`, `provider?` |
| `create_bilingual_doc` | Create side-by-side bilingual document | `filePath`, `dialect?`, `provider?` |

### i18n Operations (6 tools)

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `detect_missing_keys` | Compare locale files, find missing keys | `basePath`, `targetPath` |
| `translate_missing_keys` | Translate missing keys to target locale | `basePath`, `targetPath`, `dialect?` |
| `batch_translate_locales` | Batch translate to multiple dialects | `directory`, `targets[]` |
| `manage_dialect_variants` | Create dialect-specific variants | `sourcePath`, `variant` |
| `check_formality` | Check formality consistency | `localePath`, `register?` |
| `apply_gender_neutral` | Apply gender-neutral language | `localePath`, `strategy?` |

### Translation (6 tools)

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `translate_text` | Translate text to Spanish dialect | `text`, `dialect?`, `formal?` |
| `detect_dialect` | Detect Spanish dialect from text | `text` |
| `translate_code_comment` | Translate code comments | `code`, `dialect?` |
| `translate_readme` | Translate README files | `filePath`, `dialect?` |
| `search_glossary` | Search built-in glossary (500+ terms) | `query` |
| `list_dialects` | List all 20 Spanish dialects | (none) |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPL_AUTH_KEY` | DeepL API key | (none) |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint URL | (none) |
| `ALLOWED_LOCALE_DIRS` | Comma-separated allowed directories | `process.cwd()` |
| `ENABLE_MYMEMORY` | Opt-in enable legacy MyMemory provider | `0` |
| `MYMEMORY_RATE_LIMIT` | MyMemory provider requests/min (when enabled) | `60` |
| `ESPANOL_RATE_LIMIT` | Rate limit as `max,windowMs` | `60,60000` |
| `ESPANOL_LOG_LEVEL` | Logging level | `error` |

### Config File

```bash
espanol-mcp --config ./dialectos.config.json
```

```json
{
  "rateLimit": { "maxRequests": 100, "windowMs": 60000 },
  "security": {
    "maxFileSize": 524288,
    "maxContentLength": 50000,
    "allowedDirs": ["/path/to/locales"]
  },
  "logging": { "level": "info" }
}
```

## Security

- Path traversal protection on all file operations
- Symlink resolution via `fs.realpathSync`
- Content length validation (512KB files, 50KB content)
- Rate limiting (60 requests/minute default)
- Input sanitization (no null bytes, no control chars)
- Error message sanitization (no API keys, no stack traces)

## Development

```bash
pnpm --filter @espanol/mcp test
pnpm --filter @espanol/mcp build
```
