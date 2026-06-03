> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Twitter/X Thread: DialectOS Launch

**Best time to post:** Tuesday or Thursday, 9-11 AM PT
**Hashtags:** #buildinpublic #i18n #mcp #spanish #open-source #localization #ai #translation

---

## Tweet 1 (Hook)
We shipped a product to Mexico using our Spain Spanish translations.

Users thought we were being intentionally rude.

Here's what we learned about Spanish — and why we built DialectOS 🧵

---

## Tweet 2 (The Problem)
Spanish is not one language.

It's 25 regional variants with different vocabulary, formality levels, slang, and grammar.

- Mexico: "carro"
- Spain: "coche"
- Argentina: "auto"
- Puerto Rico: "jugo de china" (not "jugo de naranja")

Generic "Spanish" fails 24 out of 25 countries.

---

## Tweet 3 (The Punchline)
Google Translate has 1 Spanish option.

DeepL has ~5.

We built support for all 25 — with quality gates that catch bad translations before they reach users.

---

## Tweet 4 (What It Is)
DialectOS is an open-source Spanish dialect translation server.

It runs as:
- An MCP server (Claude Desktop, Cursor, etc. use it natively)
- A CLI tool
- A Node.js library

25 dialects. 17 MCP tools. automated tests.

---

## Tweet 5 (MCP Angle)
MCP (Model Context Protocol) is the hottest thing in AI tooling right now.

DialectOS is the first MCP server built specifically for Spanish dialects.

Your AI assistant can now translate to Mexican Spanish, Argentinian voseo, or Puerto Rican Spanish — natively.

---

## Tweet 6 (Quality Gates)
We don't trust translations blindly.

Every output passes 4 quality gates:
- Token integrity (protected terms preserved)
- Glossary fidelity (enforced terminology)
- Structure integrity (markdown, tables intact)
- Semantic similarity (meaning didn't drift)

If "Do not click" becomes "Haz clic" → auto-rejected.

---

## Tweet 7 (Demo)
Live demo:

Translate "Pick up the file" to Mexican Spanish:
- Generic: "Recoge el archivo" (fine)
- But "pick up" can mean "tidy" → "Recoge el cuarto"
- Or worse: inappropriate verb in some contexts

DialectOS applies dialect context + semantic gates.

🔗 https://kyanitelabs.github.io/DialectOS

---

## Tweet 8 (Technical)
Architecture:

MCP Client → @dialectos/mcp → @dialectos/cli → Provider Registry

Providers:
- LLM (OpenAI / Anthropic / LM Studio local)
- DeepL
- LibreTranslate / MyMemory

Circuit breaker + rate limiter + translation memory (SHA-256 cache).

---

## Tweet 9 (open-source)
- automated tests across 7 packages
- Apache-2.0
- GitHub Release tarballs
- TypeScript, pnpm workspace

We test harder than we market.

Star it if it helps your project ⭐

🔗 https://github.com/KyaniteLabs/DialectOS

---

## Tweet 10 (CTA)
Building for Latin America?

Don't ship generic Spanish.

Ship Mexican Spanish. Argentinian Spanish. Puerto Rican Spanish.

Your users will notice.

⭐ https://github.com/KyaniteLabs/DialectOS

---

**Optional reply tweets (for engagement):**

Reply to Tweet 2: "What's the most surprising Spanish regional word you've encountered? Mine: 'guagua' means bus in Puerto Rico... and baby in Chile. 😅"

Reply to Tweet 6: "We caught GPT-4 translating 'Do not proceed' as 'Procede inmediatamente' — the exact opposite. That's why the negation gate exists."

Reply to Tweet 9: "Fun fact: We have more tests (746) than stars (1). Help us fix that ratio? 😂"
