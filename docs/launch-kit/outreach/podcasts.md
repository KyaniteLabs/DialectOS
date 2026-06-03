> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Podcast Outreach

---

## 1. JS Party (Changelog)

**Contact:** https://changelog.com/jsparty
**Audience:** JavaScript developers
**Format:** Guest appearance

**Subject:** Guest pitch: Building an MCP server for Spanish dialect translation in TypeScript

**Body:**

Hi JS Party team,

I'd love to come on the show to talk about DialectOS — an open-source Spanish dialect translation server we built as a TypeScript monorepo.

**Topics I can cover:**
- What is MCP (Model Context Protocol) and why it matters for JS devs
- Building a stdio JSON-RPC server in TypeScript
- Monorepo architecture with pnpm workspaces
- Translation memory with SHA-256 caching
- Adversarial testing for AI-generated content
- The real-world problem: why generic Spanish fails in production

**About me:** Simon Gonzalez, builder of DialectOS. Previously [add relevant background].

**Repo:** https://github.com/KyaniteLabs/DialectOS

Available for recording any time. Would love to chat!

Best,
Simon

---

## 2. The Changelog

**Contact:** https://changelog.com/contact
**Audience:** open-source enthusiasts
**Format:** Guest appearance

**Subject:** open-source project pitch: DialectOS — Spanish dialect translation engine

**Body:**

Hi Changelog team,

I'd like to pitch DialectOS for the show — it's an open-source translation engine for Spanish regional dialects with MCP integration.

**Why it fits The Changelog:**
- open-source (Apache-2.0)
- Solves a real problem with technical depth
- Interesting architecture (provider registry, circuit breaker, quality gates)
- Built in the open on GitHub

**Topics:**
- Why "Spanish" is not one language
- Building quality gates for AI translation
- MCP and the future of AI tool integration
- Testing strategies for translation software

**Repo:** https://github.com/KyaniteLabs/DialectOS

Would love to be considered.

Best,
Simon Gonzalez

---

## 3. Latent Space

**Contact:** https://www.latent.space/contact (or email/podcast platforms)
**Audience:** AI/ML engineers, researchers
**Format:** Guest appearance

**Subject:** Guest pitch: Adversarial quality gates for LLM translation

**Body:**

Hi Latent Space team,

I'd love to come on to discuss DialectOS and the broader topic of quality-gating LLM outputs.

**What we built:**
DialectOS is a Spanish dialect translation system that applies adversarial quality gates to LLM-generated translations. We catch semantic drift, negation drops, and structure breaks before they reach users.

**Technical angles:**
- Semantic similarity scoring for cross-lingual pairs
- Negation preservation as a hard gate
- Provider registry with circuit breaker + fallback chains
- Translation memory with deterministic caching
- automated tests including adversarial fixtures

**Why it matters for AI:**
As more apps use LLMs for translation, quality validation becomes critical. We're building the testing infrastructure that generic translation APIs skip.

**Repo:** https://github.com/KyaniteLabs/DialectOS

Available any time. Would love to discuss!

Best,
Simon Gonzalez

---

## 4. Software Engineering Daily

**Contact:** https://softwareengineeringdaily.com/contact/
**Audience:** Software engineers

**Subject:** Project pitch: DialectOS — TypeScript monorepo for Spanish dialect translation

**Body:**

Hi SE Daily team,

I'd like to pitch DialectOS for an episode — it's an open-source Spanish dialect translation server built as a TypeScript monorepo.

**Topics:**
- Monorepo architecture with pnpm workspaces
- Building MCP servers for AI assistants
- Provider registry and circuit breaker patterns
- Quality gates for AI-generated content
- Testing strategies for NLP applications

**Repo:** https://github.com/KyaniteLabs/DialectOS

Let me know if you're interested!

Best,
Simon Gonzalez

---

## 5. Backend Engineering Show

**Contact:** Search for contact form or host email
**Audience:** Backend engineers

**Subject:** Backend architecture deep dive: DialectOS translation server

**Body:**

Hi Backend Engineering Show team,

I'd love to do a deep dive on DialectOS — our open-source translation server's backend architecture.

**Architecture highlights:**
- Provider registry with weighted fallback chains
- Circuit breaker with half-open probe locks
- Translation memory: SHA-256 keyed, TTL eviction, LRU
- Atomic disk persistence with generation-safe clears
- Rate limiting + SSRF protection
- Chaos harness for deterministic resilience testing

**Repo:** https://github.com/KyaniteLabs/DialectOS

Interested?

Best,
Simon Gonzalez
