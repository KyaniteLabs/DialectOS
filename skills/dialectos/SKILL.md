---
name: dialectos
description: Use DialectOS to translate and QA Spanish across 25 regional dialect variants. Covers markdown/docs translation that preserves structure, i18n locale validation, glossary enforcement, formality checks, and launch certification via MCP or CLI.
---

# DialectOS

Use DialectOS when an agent needs regional Spanish localization that preserves structure and checks quality, not generic translation. It supports 25 Spanish dialect variants (`packages/types/src/dialect-profiles.ts`), glossary enforcement, markdown preservation, locale-file workflows, and adversarial quality gates.

## Start Here

- Read `../../README.md` for quick start, provider setup, supported workflows, and certification commands.
- Read `../../packages/cli/README.md` for CLI commands.
- Read `../../packages/mcp/README.md` for the 17 MCP tools and client configuration.
- Use `../../llms.txt` for a compact public summary when another agent needs project context.

## Choose A Surface

- MCP: best when an agent host needs tools such as `translate_markdown`, `translate_text`, `detect_missing_keys`, `check_formality`, `search_glossary`, or `list_dialects`.
- CLI: best for local docs, README translation, locale JSON validation, benchmark runs, certification, and report generation.
- Demo/server workflows: use only when the user explicitly wants the browser demo or local provider testing.

## Default path (do this first)

1. Identify the source type: plain text, markdown, API docs, README, locale JSON, glossary, or certification artifact.
2. Identify the target dialects (`es-MX`, `es-AR`, `es-CO`, `es-ES`, `es-PR`, or the user-specified set; `dialectos dialects list` enumerates all 25).
3. Preserve structure. For markdown, API docs, and locale JSON, use the structure-aware commands/tools rather than generic translation:
   - markdown/README: `dialectos translate-readme <input> --dialect <d> [--output <file>]` (resumable checkpoints, structure validation, `--glossary-mode strict`).
   - API docs: `dialectos translate-api-docs <input> --dialect <d> --output <file>`.
   - locale JSON: `dialectos i18n detect-missing <base> <target>` then `dialectos i18n translate-keys <base> <target> --dialect <d>`.
4. Apply QA:
   - validate semantic correctness (`dialectos validate --source ... --translated ... --dialect <d>`, `--strict` exits nonzero on any issue),
   - check placeholder and key preservation,
   - enforce glossary terms (`--glossary-file`, `--glossary-mode strict`),
   - check formal/informal register (`dialectos i18n check-formality`),
   - run adversarial or document certification for launch-critical work (`scripts/dialect-certify*.mjs`, gated by `scripts/launch-gate.mjs`).
5. Report dialect-specific risks plainly: semantic drift, register mismatch, regional term mismatch, placeholder loss, glossary conflict, or launch readiness.

## CLI Examples

```bash
dialectos translate "Hello world" --dialect es-MX
dialectos translate-readme README.md --dialect es-AR --output README.ar.md
dialectos translate-api-docs api.md --dialect es-CO --output api.co.md
dialectos validate --source "Click the button" --translated "Haz clic en el boton" --dialect es-MX
dialectos validate --source-file en.json --translated-file es-MX.json --dialect es-MX --format json
dialectos i18n detect-missing ./locales/en.json ./locales/es.json
dialectos dialects list
```

## MCP Setup

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "pnpm",
      "args": [
        "dlx",
        "https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.1/dialectos-mcp-0.3.1.tgz"
      ],
      "env": {
        "ALLOWED_LOCALE_DIRS": "/path/to/locales"
      }
    }
  }
}
```

## Cautions

- Do not collapse all Spanish into generic "Spanish"; always name the target dialect.
- Do not translate code, placeholders, links, JSON keys, or markdown structure unless the DialectOS workflow explicitly says it is safe.
- Use `strict` policy or certification workflows for launch-critical docs, app strings, support macros, and customer-facing copy.
- Treat provider outputs as candidates until validation passes.
