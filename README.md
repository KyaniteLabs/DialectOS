<p align="center">
  <img src="assets/dialectos-hero.webp" alt="DialectOS — Spanish dialect localization MCP server: translate and QA across 25 regional variants" width="100%">
</p>

<div align="center">

# 🌎 DialectOS

**The first Model Context Protocol server built specifically for Spanish dialects.**

DialectOS is an open-source Spanish dialect translation server that runs as an MCP (Model Context Protocol) tool and CLI. It translates content into 25 regional Spanish variants — Mexican, Argentinian, Colombian, Puerto Rican, and more — while preserving markdown structure, enforcing glossary terms, and applying adversarial quality gates that catch semantic drift before it reaches users.

[![CI](https://github.com/KyaniteLabs/DialectOS/actions/workflows/ci.yml/badge.svg)](https://github.com/KyaniteLabs/DialectOS/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/KyaniteLabs/DialectOS/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-11.7.0-orange)](package.json)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)
[![Security](https://img.shields.io/badge/security-hardened-success)](https://github.com/KyaniteLabs/DialectOS/security)

[📖 Documentation](#what-is-dialectos) ·
[🚀 Quick Start](#quick-start) ·
[🛠️ MCP Tools](#mcp-tools) ·
[📦 Packages](#packages) ·
[🤝 Contributing](CONTRIBUTING.md) ·
[📋 Roadmap](ROADMAP.md)

</div>

---

## What is DialectOS?

DialectOS is a Spanish localization and dialect QA system for AI agents, documentation teams, app developers, and support organizations. Built with TypeScript on Node.js, it provides MCP tools, CLI workflows, glossary enforcement, locale-file validation, and adversarial quality gates for 25 regional Spanish variants.

Spanish is not one language — it's **25 regional variants** with different vocabulary, formality levels, slang, and grammatical preferences. Existing translation tools treat Spanish as a monolith. DialectOS solves this by understanding regional differences, preserving document structure, enforcing consistent terminology, and running as a native MCP server so AI assistants can translate and validate natively.

> *"We shipped a product to Mexico using our Spain Spanish translations. Users thought we were being intentionally rude."*

---

## Features

| Feature | Google Translate | DeepL API | **DialectOS** |
|---------|-----------------|-----------|---------------|
| Spanish dialect awareness | ❌ Generic "Spanish" | ⚠️ Limited variants | ✅ **25 regional variants** |
| MCP native integration | ❌ | ❌ | ✅ **17 MCP tools** |
| Markdown structure preservation | ❌ | ❌ | ✅ **Tables, code blocks, links intact** |
| i18n locale file support | ❌ | ❌ | ✅ **JSON locale diff & merge** |
| Gender-neutral language | ❌ | ❌ | ✅ **elles / latine / -x** |
| Formality checking (tú vs usted) | ❌ | ❌ | ✅ **Cross-dialect consistency** |
| Adversarial quality gates | ❌ | ❌ | ✅ **Semantic drift + structure validation** |
| LLM-first dialect adaptation | ❌ Generic MT | ⚠️ Limited dialect control | ✅ **Any OpenAI/Anthropic/LM Studio local LLM** |
| Translation validation (any provider) | ❌ | ❌ | ✅ **`dialectos validate` — standalone check** |
| GitHub CI integration | ❌ | ❌ | ✅ **Composite action for PR validation** |
| Auto-glossary from corrections | ❌ | ❌ | ✅ **Learns from user feedback** |
| Public benchmark suite | ❌ | ❌ | ✅ **205 adversarial samples across 25 dialects** |

### Additional capabilities

- **Translate** — English (or any source language) to 25 regional Spanish variants
- **Detect** — Identify the dialect of existing Spanish text
- **Validate** — Check translations against dialect contracts, glossaries, and formality rules
- **Glossary enforcement** — Lock in approved terminology per dialect and flag drift
- **Markdown preservation** — Tables, code fences, links, and frontmatter survive translation intact
- **Locale file support** — Diff and merge JSON locale files across dialects
- **Adversarial QA gates** — Automated checks catch semantic drift, register mismatches, and structural regressions
- **CLI and MCP** — Use as a command-line tool or expose to AI assistants via Model Context Protocol
- **Agent skill** — Compatible with agent hosts via [`skills/dialectos/SKILL.md`](skills/dialectos/SKILL.md)

---

## Installation

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 11.7.0

### From a release tarball (recommended for MCP/CLI use)

Download the latest release tarball from [GitHub Releases](https://github.com/KyaniteLabs/DialectOS/releases). DialectOS is distributed via release tarballs — not the npm registry — for MCP server and CLI installs.

```bash
# Install the MCP server tarball with pnpm
pnpm dlx https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.0/dialectos-mcp-0.3.0.tgz
```

### From source (for local development or the browser demo)

```bash
git clone https://github.com/KyaniteLabs/DialectOS.git
cd DialectOS
pnpm install
pnpm build
```

### Docker

A minimal Docker image is available for running the MCP server in containerized environments:

```bash
docker build -t dialectos-mcp .
docker run -e LLM_API_URL="https://your-endpoint" -e LLM_API_KEY="your-key" dialectos-mcp
```

---

## Quick Start

### MCP setup

Add the released MCP server to Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "pnpm",
      "args": [
        "dlx",
        "https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.0/dialectos-mcp-0.3.0.tgz"
      ],
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

For local development from a source checkout, run `pnpm build` and point your MCP client at `packages/mcp/dist/index.js`.

### CLI usage

After installing from a release tarball or building from source:

```bash
# Translate a file to Mexican Spanish
dialectos translate --dialect es-MX --input docs/README.en.md --output docs/README.es-MX.md

# Validate a translation against dialect rules
dialectos validate --dialect es-CO --input docs/README.es-CO.md

# Research a regional term
dialectos research-regional-term --term "computadora" --dialects es-MX,es-AR,es-CO
```

### Full-app browser demo

The browser demo calls a local DialectOS backend, which in turn calls the configured provider stack:

```bash
LLM_API_URL="http://127.0.0.1:1234/v1/chat/completions" \
LLM_API_FORMAT="openai" \
LLM_MODEL="your-local-model-name" \
LLM_ALLOW_LOCAL=1 \
pnpm demo
```

Open `http://127.0.0.1:8080`. For a beginner container walkthrough, see [`docs/full-app-demo.md`](docs/full-app-demo.md).

### LM Studio local model testing

Start LM Studio's local server, then point DialectOS at any downloaded local model:

```bash
LM_STUDIO_URL="http://127.0.0.1:1234" \
LLM_MODEL="publisher/model-key-or-api-identifier" \
LLM_API_FORMAT="lmstudio" \
pnpm dialect:eval -- --live --provider=llm --out=/tmp/dialectos-lmstudio-eval
```

---

## Usage

### MCP Tools

DialectOS exposes 17 MCP tools for use by AI assistants and automated workflows:

| Tool | Description |
|------|-------------|
| `translate` | Translate content to a target Spanish dialect |
| `detect` | Identify the dialect of Spanish text |
| `validate` | Check translations against dialect contracts |
| `glossary-enforce` | Enforce approved terminology per dialect |
| `dialect-contract` | Get or update dialect-specific rules |
| `locale-diff` | Diff JSON locale files across dialects |
| `locale-merge` | Merge locale file changes across dialects |
| `formality-check` | Verify tú/usted register consistency |
| `gender-neutral` | Apply gender-neutral language patterns |
| `structure-check` | Validate markdown structure preservation |
| `benchmark` | Run dialect quality benchmarks |
| `research-regional-term` | Look up regional vocabulary differences |
| ...and more | See full tool documentation in [`docs/`](docs/) |

### Agent Skill

DialectOS includes a public agent skill at [`skills/dialectos/SKILL.md`](skills/dialectos/SKILL.md). Use `$dialectos` in compatible agent hosts when you want an agent to choose the right MCP or CLI workflow for regional Spanish translation, markdown preservation, locale-file validation, glossary enforcement, register checks, and launch-readiness QA.

### GitHub Actions

DialectOS provides a composite GitHub Action for validating Spanish translations in CI/CD pipelines. See [`docs/github-action.md`](docs/github-action.md) for setup instructions and [`action.yml`](action.yml) for the action definition.

### Recommended certified models

For v0.3.0, the recommended default cloud model is `glm-4.5-air` through the Z.ai international Anthropic-compatible endpoint. Use `glm-5.1` for higher-confidence/premium results, or `qwen3.5-9b` via LM Studio for local/offline certification.

```bash
export LLM_API_URL="https://api.z.ai/api/anthropic/v1/messages"
export LLM_MODEL="glm-4.5-air"
export LLM_API_FORMAT="anthropic"
export LLM_API_KEY="your-key"
```

---

## Packages

DialectOS is organized as a monorepo with the following packages:

| Package | Description |
|---------|-------------|
| [`packages/mcp`](packages/mcp) | MCP server exposing dialect tools over stdio |
| [`packages/cli`](packages/cli) | Command-line interface for translation and validation |
| [`packages/types`](packages/types) | Shared TypeScript type definitions |
| [`packages/locale-utils`](packages/locale-utils) | Locale file parsing, diffing, and merging utilities |
| [`packages/providers`](packages/providers) | LLM provider adapters (OpenAI, Anthropic, LM Studio) |
| [`packages/security`](packages/security) | Input sanitization and security utilities |
| [`packages/markdown-parser`](packages/markdown-parser) | Markdown-aware structure preservation |
| [`packages/benchmarks`](packages/benchmarks) | Benchmark runner and result analysis |

---

## FAQ

### How is DialectOS different from Google Translate or DeepL?

Google Translate and DeepL treat Spanish as a single language. DialectOS understands 25 regional variants and applies dialect-specific vocabulary, formality rules, and grammatical patterns. It also preserves markdown structure, enforces glossaries, and integrates natively with AI assistants via MCP.

### Which Spanish dialects does DialectOS support?

DialectOS supports 25 regional variants including Mexican (es-MX), Argentinian (es-AR), Colombian (es-CO), Puerto Rican (es-PR), Chilean (es-CL), Peruvian (es-PE), Spanish from Spain (es-ES), and more. Each dialect has its own contract defining vocabulary, formality defaults, and grammar rules.

### Do I need an LLM to use DialectOS?

For translation, yes — DialectOS orchestrates an LLM provider (OpenAI, Anthropic, LM Studio, or any OpenAI-compatible endpoint). For validation, detection, glossary checks, and structure inspection, you can use DialectOS without an LLM. The CLI's `validate` command runs dialect contract checks locally.

### Can I use DialectOS with a local LLM?

Yes. DialectOS supports LM Studio and any OpenAI-compatible local endpoint. Set `LLM_API_FORMAT=lmstudio` and point `LM_STUDIO_URL` at your local server.

### Is DialectOS free to use?

DialectOS is open source under the Apache 2.0 license. The Spanish Launch Certification audit service is a paid offering — see the [certification details](docs/spanish-launch-certification.md) for pricing and scope.

### How do I add DialectOS to my CI pipeline?

DialectOS provides a composite GitHub Action. Add it to your workflow to validate Spanish translations on every pull request. See [`docs/github-action.md`](docs/github-action.md) for configuration.

---

## Contributing

We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.

For security issues, please see [`SECURITY.md`](SECURITY.md).

---

## License

DialectOS is licensed under the [Apache License 2.0](LICENSE).

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for planned features and milestones.

---

## Acknowledgments

- Built by the [Kyanite Labs](https://github.com/KyaniteLabs) team
- Uses the [Model Context Protocol](https://modelcontextprotocol.io) standard
- Benchmark data and adversarial samples in [`audits/`](audits/) and [`benchmarks/`](benchmarks/)