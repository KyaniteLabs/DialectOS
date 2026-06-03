---
name: dialectos
description: Use DialectOS for Spanish dialect translation, localization QA, i18n locale-file validation, glossary enforcement, register/formality checks, gender-neutral language, and launch certification across regional Spanish variants through MCP or CLI.
---

# DialectOS

Use DialectOS when an agent needs regional Spanish localization that preserves structure and checks quality, not generic translation. It supports 25 Spanish dialect variants, glossary enforcement, markdown preservation, locale-file workflows, and adversarial quality gates.

## Start Here

- Read `../../README.md` for quick start, provider setup, supported workflows, and certification commands.
- Read `../../packages/cli/README.md` for CLI commands.
- Read `../../packages/mcp/README.md` for MCP tools and client configuration.
- Use `../../llms.txt` for a compact public summary when another agent needs project context.

## Choose A Surface

- MCP: best when an agent host needs tools such as `translate_markdown`, `translate_text`, `detect_missing_keys`, `check_formality`, `search_glossary`, or `list_dialects`.
- CLI: best for local docs, README translation, locale JSON validation, benchmark runs, certification, and report generation.
- Demo/server workflows: use only when the user explicitly wants the browser demo or local provider testing.

## Workflow

1. Identify source type: plain text, markdown, API docs, README, locale JSON, glossary, or certification artifact.
2. Identify target dialects such as `es-MX`, `es-AR`, `es-CO`, `es-ES`, `es-PR`, or the user-specified set.
3. Preserve structure. For markdown, API docs, and locale JSON, use DialectOS structure-aware commands/tools rather than generic translation.
4. Apply QA:
   - validate semantic correctness,
   - check placeholder and key preservation,
   - enforce glossary terms,
   - check formal/informal register,
   - run adversarial or document certification for launch-critical work.
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
        "https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.0/dialectos-mcp-0.3.0.tgz"
      ],
      "env": {
        "ALLOWED_LOCALE_DIRS": "/path/to/locales"
      }
    }
  }
}
```

## Guardrails

- Do not collapse all Spanish into generic "Spanish"; always name the target dialect.
- Do not translate code, placeholders, links, JSON keys, or markdown structure unless the DialectOS workflow explicitly says it is safe.
- Use `strict` policy or certification workflows for launch-critical docs, app strings, support macros, and customer-facing copy.
- Treat provider outputs as candidates until validation passes.
