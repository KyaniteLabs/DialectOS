<div align="center">

# 🌎 DialectOS

**The first Model Context Protocol server built specifically for Spanish dialects.**

Translate, detect, and adapt content across **25 regional Spanish variants** while preserving markdown structure, code comments, and locale file formatting.

[![CI](https://github.com/Pastorsimon1798/DialectOS/actions/workflows/ci.yml/badge.svg)](https://github.com/Pastorsimon1798/DialectOS/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-737%20passing-brightgreen)](https://github.com/Pastorsimon1798/DialectOS/actions)
[![License](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](LICENSE)
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


## Spanish Launch Certification

DialectOS is available as a paid Spanish localization launch audit. We certify your Spanish docs, app strings, support macros, or locale files across target dialects and deliver an MQM-aligned launch-readiness report.

- Beta pilot: **$500**
- Scope: up to 10,000 source words and 5 target dialects
- Deliverables: certification report, issue list, severity table, recommended fixes, launch decision
- Sample report: [`audits/sample-customer-report.md`](audits/sample-customer-report.md)
- Offer details: [`docs/spanish-launch-certification.md`](docs/spanish-launch-certification.md)

## ✨ What makes DialectOS different?

| Feature | Google Translate | DeepL API | **DialectOS** |
|---------|-----------------|-----------|---------------|
| Spanish dialect awareness | ❌ Generic "Spanish" | ⚠️ Limited variants | ✅ **25 regional variants** |
| MCP native integration | ❌ | ❌ | ✅ **17 MCP tools** |
| Markdown structure preservation | ❌ | ❌ | ✅ **Tables, code blocks, links intact** |
| i18n locale file support | ❌ | ❌ | ✅ **JSON locale diff & merge** |
| Gender-neutral language | ❌ | ❌ | ✅ **elles / latine / -x** |
| Formality checking (tú vs usted) | ❌ | ❌ | ✅ **Cross-dialect consistency** |
| Adversarial quality gates | ❌ | ❌ | ✅ **Semantic drift + structure validation** |
| LLM-first dialect adaptation | ❌ Generic MT | ⚠️ Limited dialect control | ✅ **Any OpenAI/Anthropic/LM Studio local LLM + dialect contracts** |

---

## 🎯 Why this exists

> *"We shipped a product to Mexico using our Spain Spanish translations. Users thought we were being intentionally rude."*

Spanish is not one language — it's **25 regional variants** with different vocabulary, formality levels, slang, and grammatical preferences. Existing translation tools treat Spanish as a monolith.

**DialectOS solves this by:**
- Understanding regional differences (es-MX vs es-ES vs es-AR vs es-CO...)
- Preserving technical document structure during translation
- Providing glossary enforcement for consistent terminology
- Adding semantic context, dialect grammar profiles, quality contracts, and quality gates that catch drift before it reaches users
- Running as an MCP server so AI assistants can translate natively

---

## 🚀 Quick Start

### Full-app browser demo

The browser demo is no longer a fake/static rule replacer. It calls a local
DialectOS backend, and that backend calls the configured provider stack.

```bash
LLM_API_URL="http://127.0.0.1:1234/v1/chat/completions" \
LLM_API_FORMAT="openai" \
LLM_MODEL="your-local-model-name" \
LLM_ALLOW_LOCAL=1 \
pnpm demo
```

Open `http://127.0.0.1:8080`.

For the beginner container walkthrough, see
[`docs/full-app-demo.md`](docs/full-app-demo.md).

### 30-second MCP setup

Add to your Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "npx",
      "args": ["-y", "@espanol/mcp"],
      "env": {
        "LLM_API_URL": "https://your-llm-gateway/v1/chat/completions",
        "LLM_MODEL": "your-dialect-capable-model",
        "LLM_API_KEY": "your-key-if-required",
        "LLM_API_FORMAT": "openai",
        "ALLOWED_LOCALE_DIRS": "/path/to/locales"
      }
    }
  }
}
```

### Recommended certified models

For `v0.1.0-rc3`, the recommended default cloud model is `glm-4.5-air` through the Z.ai international Anthropic-compatible endpoint. It passed basic, expanded adversarial, and long-document certification. Use `glm-5.1` when you want the higher-confidence/premium option, and `qwen3.5-9b` via LM Studio for local/offline certification.

```bash
export LLM_API_URL="https://api.z.ai/api/anthropic/v1/messages"
export LLM_MODEL="glm-4.5-air"
export LLM_API_FORMAT="anthropic"
export LLM_API_KEY="..."
```

### LM Studio local model testing

Start LM Studio's local server, then point DialectOS at any downloaded local model. `LLM_API_FORMAT=lmstudio` uses LM Studio's native REST API and loads the model just-in-time when needed.

```bash
LM_STUDIO_URL="http://127.0.0.1:1234" \
LLM_MODEL="publisher/model-key-or-api-identifier" \
LLM_API_FORMAT="lmstudio" \
pnpm dialect:eval -- --live --provider=llm --out=/tmp/dialectos-lmstudio-eval
```

### Incremental provider certification

Use `dialect:certify` for long local-model or cloud-provider runs. It writes `events.jsonl`, `progress.json`, and an incrementally updated `results.json` after every sample, with per-sample timeout protection.

```bash
LM_STUDIO_URL="http://127.0.0.1:1234" \
LLM_MODEL="qwen3.5-9b" \
LLM_API_FORMAT="lmstudio" \
pnpm dialect:certify -- --live --provider=llm --sample-timeout-ms=300000 --out=/tmp/dialectos-certify
```

### Adversarial dialect certification

Use `dialect:certify:adversarial` to run paraphrase, dialect-collision, taboo-copy, placeholder, register, and repeatability traps. It wraps `dialect:certify` and writes a `failure-matrix.md` plus aggregate repeatability results.

```bash
pnpm dialect:certify:adversarial -- --live --provider=llm --repeat=2 --sample-timeout-ms=300000 --out=/tmp/dialectos-adversarial
```

### Long-document certification

Use `dialect:certify:documents` to certify README/API-doc/locale JSON flows, not just sentence fixtures. It checks markdown structure, placeholders, URLs, code fences, API tables, and locale JSON outputs.

```bash
pnpm dialect:certify:documents -- --live --provider=llm --dialects=es-MX,es-PA,es-PR --out=/tmp/dialectos-doc-cert
```

### Customer-facing certification report

Use `dialect:report` to turn certification artifacts into a customer-facing Markdown deliverable for paid launch audits.

```bash
pnpm dialect:report -- --input=audits/release-candidate-2026-04-22/model-matrix.json --out=customer-report.md --customer="Acme SaaS" --product="Spanish launch"
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
pnpm test        # 742 tests passing
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

### Translation (7 tools)
| Tool | Description |
|------|-------------|
| `translate_text` | Translate with semantic context, grammar profiles, and quality contracts |
| `detect_dialect` | Detect dialect from sample text |
| `translate_code_comment` | Translate comments, preserve code |
| `translate_readme` | Full README translation pipeline |
| `search_glossary` | Search 300+ source-attributed glossary terms |
| `list_dialects` | List all 25 supported dialects |
| `research_regional_term` | Research source-backed regional lexeme proposals without mutating runtime data |

---

## 📦 Packages

| Package | Version | Description | Tests |
|---------|---------|-------------|-------|
| [`@espanol/mcp`](packages/mcp) | `0.1.0` | 17 MCP tools (stdio server) | 86 |
| [`@espanol/cli`](packages/cli) | `0.1.0` | CLI commands for semantic translation workflows | 320 |
| [`@espanol/providers`](packages/providers) | `0.1.0` | LLM, DeepL, LibreTranslate, MyMemory with circuit breaker | 71 |
| [`@espanol/security`](packages/security) | `0.1.0` | Rate limiting, SSRF protection, sanitization | 66 |
| [`@espanol/types`](packages/types) | `0.1.0` | Shared TypeScript types + glossary, profile, certification, and quality data | 54 |
| [`@espanol/locale-utils`](packages/locale-utils) | `0.1.0` | Locale file diff/merge utilities | 55 |
| [`@espanol/markdown-parser`](packages/markdown-parser) | `0.1.0` | Structure-preserving markdown parser | 74 |

**Total: 742 tests across 7 packages plus the full-app docs, demo-server, and static-hardening contracts**

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
│              17 tools • JSON-RPC over stdio                  │
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
│   │   LLM   │  │     DeepL       │  │ Libre/MyMemory │   │
│   │ Primary │  │ Paid fallback   │  │ Generic fallback│    │
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
- OpenAI-compatible, Anthropic-compatible, and LM Studio local gateways via `LLM_API_URL`/`LM_STUDIO_URL` + `LLM_MODEL` + `LLM_API_FORMAT`
- VS Code extension

---

## 📄 License

BSL 1.1 — see [`LICENSE`](LICENSE) for details. The Licensed Work will become available under Apache-2.0 on 2030-04-20.

---

<div align="center">

Made with ❤️ by [Pastorsimon1798](https://github.com/Pastorsimon1798) and contributors.

**Star ⭐ this repo if it helps your project!**

</div>
