<div align="center">

# 🌎 DialectOS

**The first Model Context Protocol server built specifically for Spanish dialects.**

Translate, detect, and adapt content across **25 regional Spanish variants** while preserving markdown structure, code comments, and locale file formatting.

[![CI](https://github.com/Pastorsimon1798/DialectOS/actions/workflows/ci.yml/badge.svg)](https://github.com/Pastorsimon1798/DialectOS/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-595%20passing-brightgreen)](https://github.com/Pastorsimon1798/DialectOS/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.0-orange)](package.json)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)
[![Security](https://img.shields.io/badge/security-hardened-success)](https://github.com/Pastorsimon1798/DialectOS/security)

[📖 Documentation](https://github.com/Pastorsimon1798/DialectOS#readme) ·
[🚀 Quick Start](#quick-start) ·
[🛠️ MCP Tools](#mcp-tools) ·
[📦 Packages](#packages) ·
[🤝 Contributing](CONTRIBUTING.md) ·
[📋 Roadmap](ROADMAP.md)

</div>

---

## ✨ What makes DialectOS different?

| Feature | Google Translate | DeepL API | **DialectOS** |
|---------|-----------------|-----------|---------------|
| Spanish dialect awareness | ❌ Generic "Spanish" | ⚠️ Limited variants | ✅ **25 regional variants** |
| MCP native integration | ❌ | ❌ | ✅ **16 MCP tools** |
| Markdown structure preservation | ❌ | ❌ | ✅ **Tables, code blocks, links intact** |
| i18n locale file support | ❌ | ❌ | ✅ **JSON/YAML/PO diff & merge** |
| Gender-neutral language | ❌ | ❌ | ✅ **elles / latine / -x** |
| Formality checking (tú vs usted) | ❌ | ❌ | ✅ **Cross-dialect consistency** |
| Adversarial quality gates | ❌ | ❌ | ✅ **Semantic drift + structure validation** |
| Self-hosted / free tier | ❌ Paid | ⚠️ Limited free | ✅ **LibreTranslate + MyMemory fallback** |

---

## 🎯 Why this exists

> *"We shipped a product to Mexico using our Spain Spanish translations. Users thought we were being intentionally rude."*

Spanish is not one language — it's **25 regional variants** with different vocabulary, formality levels, slang, and grammatical preferences. Existing translation tools treat Spanish as a monolith.

**DialectOS solves this by:**
- Understanding regional differences (es-MX vs es-ES vs es-AR vs es-CO...)
- Preserving technical document structure during translation
- Providing glossary enforcement for consistent terminology
- Adding quality gates that catch semantic drift before it reaches users
- Running as an MCP server so AI assistants can translate natively

---

## 🚀 Quick Start

### 30-second MCP setup

Add to your Claude Desktop, Cursor, or any MCP client:

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

### CLI install

```bash
# Install globally
npm install -g @espanol/cli

# Translate to Mexican Spanish
espanol translate "Hello world" --dialect es-MX

# Translate a README preserving structure
espanol translate-readme README.md --dialect es-AR --output README.ar.md

# Detect missing i18n keys
espanol i18n detect-missing ./locales/en.json ./locales/es.json

# List all supported dialects
espanol dialects list
```

### From source

```bash
git clone https://github.com/Pastorsimon1798/DialectOS.git
cd DialectOS
pnpm install
pnpm build
pnpm test        # 595 tests passing
```

---

## 🛠️ MCP Tools

### Markdown Translation (4 tools)
| Tool | Description |
|------|-------------|
| `translate_markdown` | Translate while preserving tables, code blocks, links |
| `extract_translatable` | Extract only translatable text from markdown |
| `translate_api_docs` | Translate API docs with table cell-level translation |
| `create_bilingual_doc` | Side-by-side bilingual documents |

### i18n Operations (6 tools)
| Tool | Description |
|------|-------------|
| `detect_missing_keys` | Compare locale files for missing keys |
| `translate_missing_keys` | Auto-translate missing keys |
| `batch_translate_locales` | Batch translate to multiple dialects |
| `manage_dialect_variants` | Create dialect-specific variants |
| `check_formality` | Check tú vs usted consistency |
| `apply_gender_neutral` | Apply gender-neutral language |

### Translation (6 tools)
| Tool | Description |
|------|-------------|
| `translate_text` | Translate to any Spanish dialect |
| `detect_dialect` | Detect dialect from sample text |
| `translate_code_comment` | Translate comments, preserve code |
| `translate_readme` | Full README translation pipeline |
| `search_glossary` | Search 500+ term glossary |
| `list_dialects` | List all 25 supported dialects |

---

## 📦 Packages

| Package | Version | Description | Tests |
|---------|---------|-------------|-------|
| [`@espanol/mcp`](packages/mcp) | `0.1.0` | 16 MCP tools (stdio server) | 80 |
| [`@espanol/cli`](packages/cli) | `0.1.0` | CLI commands for translation workflows | 223 |
| [`@espanol/providers`](packages/providers) | `0.1.0` | DeepL, LibreTranslate, MyMemory with circuit breaker | 58 |
| [`@espanol/security`](packages/security) | `0.1.0` | Rate limiting, SSRF protection, sanitization | 65 |
| [`@espanol/types`](packages/types) | `0.1.0` | Shared TypeScript types | 41 |
| [`@espanol/locale-utils`](packages/locale-utils) | `0.1.0` | Locale file diff/merge utilities | 55 |
| [`@espanol/markdown-parser`](packages/markdown-parser) | `0.1.0` | Structure-preserving markdown parser | 73 |

**Total: 595 tests across 7 packages**

---

## 🛡️ Security & Quality

DialectOS has undergone adversarial security hardening:

- **18 CVEs resolved** via dependency overrides
- **SSRF protection** on all provider endpoints
- **Circuit breaker** with half-open probe locks
- **Atomic checkpoint writes** with schema versioning
- **HTML injection detection** in translated output
- **Semantic drift scoring** — catches "looks valid but meaning changed"
- **Provider capability negotiation** — validates language support before API calls
- **Chaos harness** for deterministic resilience testing

See [`SECURITY.md`](SECURITY.md) for details.

---

## 🎨 Supported Dialects

| Code | Region | Example Difference |
|------|--------|-------------------|
| `es-ES` | Spain | *"Coche"* (car), *"Ordenador"* (computer) |
| `es-MX` | Mexico | *"Carro"*, *"Computadora"* |
| `es-AR` | Argentina | *"Auto"*, *"Computadora"*, *"Che"* |
| `es-CO` | Colombia | *"Carro"*, *"Computador"*, *"Chévere"* |
| `es-CL` | Chile | *"Auto"*, *"Computadora"*, *"Caleta"* |
| `es-PE` | Peru | *"Carro"*, *"Computadora"*, *"Pe"* |
| `es-VE` | Venezuela | *"Carro"*, *"Computadora"*, *"Chamo"* |
| `es-UY` | Uruguay | *"Auto"*, *"Computadora"*, *"Bo"* |
| `es-GQ` | Equatorial Guinea | *"Carro"*, *"Camisola"*, *"Bacalao"* |
| `es-US` | United States | *"Carro"*, *"Computadora"*, *"Pocha"* |
| `es-PH` | Philippines (Chavacano) | *"Carro"*, *"Jendeh"*, *"Kame"* |
| `es-BZ` | Belize | *"Carro"*, *"Breki"*, *"Kriol"* |
| `es-AD` | Andorra | *"Carro"*, *"Madriu"*, *"Caldea"* |

...and 12 more. Full list via `espanol dialects list`.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Client                            │
│              (Claude Desktop / Cursor / etc.)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ stdio
┌──────────────────────▼──────────────────────────────────────┐
│                   @espanol/mcp                               │
│              16 tools • JSON-RPC over stdio                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   @espanol/cli                               │
│   translate-readme • translate-api-docs • i18n • dialects   │
│   ├─ Policy profiles (strict/balanced/permissive)           │
│   ├─ Quality gates (token/glossary/structure/semantic)      │
│   ├─ Checkpoint resumption                                  │
│   └─ Telemetry & health reports                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                @espanol/providers                            │
│   ┌─────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│   │  DeepL  │  │ LibreTranslate  │  │   MyMemory      │    │
│   │ Primary │  │ Self-hosted     │  │ Free fallback   │    │
│   └─────────┘  └─────────────────┘  └─────────────────┘    │
│        │                │                    │              │
│        └────────────────┴────────────────────┘              │
│              Circuit Breaker + Rate Limiter                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Quality Gates

Every translation passes through 4 quality dimensions:

```
Quality Score = tokenIntegrity×25% + glossaryFidelity×30% + structureIntegrity×20% + semanticSimilarity×25%
```

| Gate | What it checks | Example failure |
|------|---------------|-----------------|
| **Token Integrity** | Protected terms preserved | "Kyanite Labs" → "Cianita Labs" |
| **Glossary Fidelity** | Enforced terminology used | "API" → "Interfaz" (when glossary says "API") |
| **Structure Integrity** | Markdown structure intact | Missing code fence, broken table |
| **Semantic Similarity** | Meaning not drifted | "API is down" → "Hello world" |

---

## 🤝 Contributing

We welcome contributors! See [`CONTRIBUTING.md`](CONTRIBUTING.md) for:
- Setting up your development environment
- Running the test suite
- Submitting pull requests
- Code style guidelines

**Good first issues** are tagged with `good first issue` — perfect for newcomers.

---

## 📋 Roadmap

See [`ROADMAP.md`](ROADMAP.md) for upcoming features including:
- Portuguese dialect support (pt-BR, pt-PT)
- Real-time collaborative translation
- Custom provider plugins
- VS Code extension

---

## 📄 License

MIT — see [`LICENSE`](LICENSE) for details.

---

<div align="center">

Made with ❤️ by [Pastorsimon1798](https://github.com/Pastorsimon1798) and contributors.

**Star ⭐ this repo if it helps your project!**

</div>
