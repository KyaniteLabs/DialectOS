# DialectOS Launch Kit

Copy-paste these for social media, forums, and outreach.

---

## Hacker News ("Show HN")

**Title:** Show HN: DialectOS – MCP server for Spanish dialect translation (25 variants)

**Body:**

Most translation tools treat Spanish as a monolith. If you ship es-ES to Mexico, users notice.

DialectOS is a Model Context Protocol server that understands 25 Spanish regional variants. It preserves markdown structure, enforces glossaries, and has quality gates that catch semantic drift.

**What it does:**
- 16 MCP tools for AI assistants (Claude, Cursor, etc.)
- Translate to es-MX, es-AR, es-CO, es-ES, and 21 more
- Structure-preserving markdown translation (tables, code blocks, links)
- i18n operations: detect missing keys, batch translate, check formality
- 3 providers with automatic fallback (DeepL → LibreTranslate → MyMemory)

**Tech stack:** TypeScript, pnpm monorepo, 608 tests, Vitest

**Repo:** https://github.com/Pastorsimon1798/DialectOS

Would love feedback from anyone working on multilingual products!

---

## Twitter/X Thread

**Tweet 1:**
Most translation APIs treat Spanish as one language.

It's not. Mexico, Argentina, Colombia, Spain — all different.

I built DialectOS: the first MCP server for Spanish dialects.

25 variants. Structure preservation. Quality gates.

🧵

**Tweet 2:**
The problem: ship es-ES to Mexico and users think you're being rude.

"Coche" vs "carro". "Ordenador" vs "computadora". "Tú" vs "usted".

DialectOS knows the difference and translates accordingly.

**Tweet 3:**
16 MCP tools means Claude, Cursor, and any MCP client can translate natively.

No wrappers. No glue code. Just works.

Markdown, API docs, i18n files, code comments — all preserved.

**Tweet 4:**
Security matters when you're piping content through translation APIs.

- SSRF protection on all endpoints
- Circuit breakers + rate limiting
- Semantic drift detection
- 18 CVEs resolved, zero current vulnerabilities

**Tweet 5:**
608 tests. 7 packages. pnpm monorepo. TypeScript.

Source available. BSL 1.1 license (Apache-2.0 on 2030-04-20).

If you're building multilingual products, give it a look.

⭐ https://github.com/Pastorsimon1798/DialectOS

---

## Reddit r/selfhosted

**Title:** [Showcase] DialectOS — Self-hosted Spanish dialect translation with MCP support

**Body:**

I built DialectOS because existing translation APIs treat Spanish as a single language. In reality, Mexico, Argentina, Colombia, and Spain all have significant differences in vocabulary, formality, and grammar.

**Features:**
- 25 Spanish dialects with metadata
- Self-hosted via LibreTranslate (or use DeepL/MyMemory)
- MCP server — integrates with Claude, Cursor, etc.
- Structure-preserving markdown translation
- i18n utilities (detect missing keys, batch translate, formality check)
- Security hardened (SSRF protection, circuit breakers, rate limiting)

**Tech:** TypeScript, pnpm monorepo, 608 tests

**License:** BSL 1.1 (becomes Apache-2.0 on 2030-04-20)

https://github.com/Pastorsimon1798/DialectOS

---

## LinkedIn Post

Most translation tools treat Spanish as one language. They're wrong.

Mexico, Argentina, Colombia, Spain — each has distinct vocabulary, formality levels, and grammatical preferences. Ship Spain Spanish to Mexico and users notice.

I built DialectOS to solve this. It's a Model Context Protocol server that understands 25 Spanish regional variants and preserves document structure during translation.

For teams building multilingual products, this means:
- ✅ Consistent terminology across regions
- ✅ Formality-appropriate translations (tú vs usted)
- ✅ Markdown, tables, and code blocks stay intact
- ✅ Quality gates catch semantic drift before release

Source available, BSL 1.1 licensed, 608 tests passing.

https://github.com/Pastorsimon1798/DialectOS

#i18n #localization #mcp #ai #typescript #opensource

---

## Product Hunt

**Tagline:** The first MCP server built for Spanish dialects

**Description:**
DialectOS translates content across 25 Spanish regional variants while preserving markdown structure, code comments, and locale file formatting. It runs as a Model Context Protocol server, so Claude, Cursor, and other MCP clients can translate natively.

**Key features:**
- 25 Spanish dialects (es-MX, es-AR, es-CO, es-ES, etc.)
- 16 MCP tools for AI assistants
- Structure-preserving markdown translation
- i18n operations (missing key detection, batch translation, formality checking)
- 3 providers with automatic fallback
- Security hardened with SSRF protection and circuit breakers

**Tech stack:** TypeScript, pnpm monorepo, 608 tests

**License:** BSL 1.1 (source available, becomes Apache-2.0 on 2030-04-20)

---

## Email Newsletter / Blog Pitch

**Subject:** New open-source tool: Spanish dialect translation for AI workflows

DialectOS is a new open-source project that solves a problem most translation tools ignore: Spanish has 25 regional variants, and treating them as one language produces poor user experiences.

It runs as a Model Context Protocol server, making it the first translation infrastructure designed specifically for AI assistant integration. Claude, Cursor, and any MCP client can translate to Mexican Spanish, Argentine Spanish, Colombian Spanish, and 22 more variants without wrappers or glue code.

The project includes security hardening (SSRF protection, circuit breakers, adversarial testing), quality gates (semantic drift detection, glossary enforcement), and a full CLI for CI/CD pipelines.

https://github.com/Pastorsimon1798/DialectOS
