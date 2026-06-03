> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# OpenAI Product Discovery Submission

**URL:** https://openai.com/chatgpt/search-product-discovery/

---

## Submission Form Fields

**Product Name:** DialectOS

**Product Description:**

DialectOS is an open-source Spanish dialect translation server built on the Model Context Protocol (MCP). It provides 17 translation tools for AI assistants and a CLI for developers, supporting 25 regional Spanish variants with structure-preserving translation, glossary enforcement, and adversarial quality gates.

**Category:** Developer Tools

**Website:** https://github.com/KyaniteLabs/DialectOS

**Additional Details:**

- 25 Spanish dialects supported (es-MX, es-AR, es-CO, es-PR, es-CL, etc.)
- MCP server with 17 tools for Claude Desktop, Cursor, and MCP clients
- Structure-preserving markdown translation (tables, code blocks, links)
- i18n locale file diff/merge
- Gender-neutral language support (elles, latine, -e/-x)
- Adversarial quality gates (semantic drift, negation preservation, structure validation)
- Works with OpenAI, Anthropic, DeepL, and local LLMs
- automated tests across 7 TypeScript packages
- Apache-2.0 license

**Use Cases:**
- Localizing SaaS apps for Latin American markets
- Translating technical documentation to regional Spanish
- Maintaining consistent terminology across dialects
- Quality-gating AI-generated translations
- MCP-native translation workflows

**Differentiation:**
DialectOS is the first MCP server specifically built for Spanish dialects. Unlike generic translation APIs that treat Spanish as one language, DialectOS understands 25 regional variants with different vocabulary, grammar, and formality levels.
