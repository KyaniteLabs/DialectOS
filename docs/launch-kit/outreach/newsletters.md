> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Newsletter Outreach

---

## 1. JavaScript Weekly

**Contact:** https://javascriptweekly.com/contact (or tweet @JavaScriptDaily)
**Audience:** 100K+ JavaScript developers

**Subject:** New open-source project: MCP server for Spanish dialect translation in TypeScript

**Body:**

Hi JavaScript Weekly team,

I wanted to share DialectOS — an open-source Spanish dialect translation engine we built as a TypeScript monorepo.

It exposes 17 MCP (Model Context Protocol) tools so AI assistants like Claude can translate to 25 Spanish regional variants natively. Think of it as a translation layer that understands Mexican Spanish, Argentinian voseo, and Puerto Rican vocabulary — not just generic "Spanish."

**Key details:**
- 7 packages in a pnpm workspace
- automated tests
- Structure-preserving markdown translation
- Adversarial quality gates (catches semantic drift)
- Works with OpenAI, Anthropic, or local LLMs
- Apache-2.0 license

**Repo:** https://github.com/KyaniteLabs/DialectOS
**Demo:** https://kyanitelabs.github.io/DialectOS

Would love to be featured in an upcoming issue. Happy to provide more details or a guest post.

Best,
Simon Gonzalez

---

## 2. Node Weekly

**Contact:** https://nodeweekly.com/contact
**Audience:** Node.js developers

**Subject:** DialectOS — Node.js-based MCP server for 25 Spanish dialects

**Body:**

Hi Node Weekly team,

We're building DialectOS — a Spanish dialect translation server that runs on Node.js 20+.

It started from a real production issue: we shipped Spain Spanish translations to Mexico, and users thought we were being rude. Turns out "Spanish" is 25 regional variants, not one language.

**Technical highlights:**
- TypeScript monorepo with pnpm workspaces
- 17 MCP tools exposed over stdio JSON-RPC
- Provider registry with circuit breaker pattern
- Translation memory with SHA-256 keyed caching
- automated tests across 7 packages

**Repo:** https://github.com/KyaniteLabs/DialectOS

Would be great to get coverage in Node Weekly.

Best,
Simon Gonzalez

---

## 3. AI Tools Weekly

**Contact:** Search for submission form or editor email
**Audience:** AI tool builders and users

**Subject:** DialectOS — First MCP server for Spanish dialect translation

**Body:**

Hi AI Tools Weekly team,

MCP (Model Context Protocol) is exploding right now. We built what might be the first domain-specific MCP server — for Spanish dialect translation.

**What it does:**
- 17 MCP tools for translation, i18n, glossary, and research
- 25 Spanish regional variants (not just generic "Spanish")
- Adversarial quality gates that catch bad AI translations
- Works with any LLM provider (OpenAI, Anthropic, local)

**Why it matters:**
Most AI translation produces generic Spanish. But Mexican Spanish, Argentinian voseo, and Puerto Rican Spanish are fundamentally different. DialectOS adds dialect-aware prompts + quality validation.

**Repo:** https://github.com/KyaniteLabs/DialectOS

Interested in covering this?

Best,
Simon Gonzalez

---

## 4. Console.dev

**Contact:** https://console.dev/contact
**Audience:** Senior developers, tool curators

**Subject:** open-source tool recommendation: DialectOS

**Body:**

Hi Console team,

I'd like to recommend DialectOS for your newsletter — it's an open-source Spanish dialect translation server with MCP integration.

**Why it fits Console:**
- Developer-first (TypeScript, CLI, MCP server)
- Solves a real problem (generic Spanish translation fails in production)
- High test coverage (automated tests)
- Clean architecture (pnpm workspace, provider registry, circuit breaker)

**Repo:** https://github.com/KyaniteLabs/DialectOS

Would love to be considered.

Best,
Simon Gonzalez

---

## 5. Hacker Newsletter

**Contact:** Part of Hacker News — no direct submission, but being on HN front page gets you featured
**Strategy:** Get your Show HN to the front page

---

## 6. Pointer.io

**Contact:** https://pointer.io/submit
**Audience:** Software engineers

**Subject:** DialectOS — Spanish dialect translation with MCP support

**Body:**

Hi Pointer team,

We're building DialectOS — an open-source translation engine for Spanish regional dialects.

It exposes 17 MCP tools, supports 25 dialects, and applies adversarial quality gates to catch semantic drift in AI translations.

**Repo:** https://github.com/KyaniteLabs/DialectOS

Would love to be featured.

Best,
Simon Gonzalez
