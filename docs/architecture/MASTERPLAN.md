# DialectOS Architecture Masterplan

**Date:** 2026-04-30  
**Status:** Design Complete → Implementation In Progress  
**Scope:** Full Application Architecture (all packages, all surfaces, all flows)  

---

## 1. Executive Summary

DialectOS is a **Spanish dialect-aware translation system** with four user surfaces (CLI, MCP Server, HTTP API, GitHub Action), seven npm packages, and a translation pipeline that adapts to model capability at runtime.

**The Core Insight:** Weak models (≤350M parameters) are not problems to avoid — they are **quality canaries** that expose every crack in the pipeline that strong models paper over with raw capacity. A 360M model scoring 69% tells us more about our pipeline deficiencies than a 4B model scoring 100%.

**The Goal:** Harden the pipeline so the gap between weak and strong models shrinks, with **zero regression** for strong models. Every fix must improve weak models or be neutral for strong ones.

**Launch Readiness:** The codebase is structurally sound (545 tests passing, TypeScript clean, security red-team hardened). The blockers for production launch are operational: sequential batch translation, disabled caching, missing bulk resilience, and incomplete observability. These are fixable today.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DialectOS Full Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      USER SURFACE LAYER                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │    CLI     │  │   MCP      │  │  HTTP API  │  │  GitHub    │    │   │
│  │  │  (Node)    │  │  Server    │  │  (Demo)    │  │   Action   │    │   │
│  │  │ 19 cmds    │  │ 18 tools   │  │ 2 routes   │  │ 1 composite│    │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │   │
│  │        │               │               │               │            │   │
│  │        └───────────────┴───────────────┴───────────────┘            │   │
│  │                          │                                          │   │
│  │                    ┌─────┴─────┐                                    │   │
│  │                    │  @dialectos/cli  │  Commander.js entry point   │   │
│  │                    └─────┬─────┘                                    │   │
│  └──────────────────────────┼──────────────────────────────────────────┘   │
│                             │                                              │
│  ┌──────────────────────────┼──────────────────────────────────────────┐  │
│  │                   APPLICATION SERVICES LAYER                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │   i18n      │  │   Docs      │  │   Quality   │  │  Research  │  │  │
│  │  │  Commands   │  │  Commands   │  │  Commands   │  │  Commands  │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │  │
│  │         │                │                │               │         │  │
│  │  ┌──────┴────────────────┴────────────────┴───────────────┘         │  │
│  │  │              Shared Libraries (packages/cli/src/lib/)             │  │
│  │  │  • resilient-translation.ts  • telemetry.ts  • checkpoint.ts     │  │
│  │  │  • token-protection.ts       • quality-score.ts                 │  │
│  │  │  • glossary-enforcement.ts   • semantic-context.ts              │  │
│  │  │  • validate-translation.ts   • output-judge.ts                  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     TRANSLATION ENGINE LAYER                         │  │
│  │                    (@dialectos/providers)                            │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │   Provider   │  │   Provider   │  │   Provider   │              │  │
│  │  │   Registry   │  │   Registry   │  │   Registry   │              │  │
│  │  │  (Ranking +  │  │  (Circuit +  │  │  (Caching +  │              │  │
│  │  │  Failover)   │  │  Retry)      │  │  Memory)     │              │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │  │
│  │         │                 │                 │                      │  │
│  │         └─────────────────┴─────────────────┘                      │  │
│  │                           │                                        │  │
│  │         ┌─────────────────┴─────────────────┐                      │  │
│  │         ▼                                   ▼                      │  │
│  │  ┌──────────────┐              ┌──────────────────────┐           │  │
│  │  │    LLM       │              │   Cloud Providers    │           │  │
│  │  │  Provider    │              │  (DeepL/Libre/MyMem) │           │  │
│  │  │              │              │                      │           │  │
│  │  │ • Prompt     │              │ • Request normalize  │           │  │
│  │  │ • Garbage    │              │ • Dialect strip      │           │  │
│  │  │ • Post-proc  │              │ • Response parse     │           │  │
│  │  └──────┬───────┘              └──────────┬───────────┘           │  │
│  │         │                                 │                        │  │
│  │         └────────────────┬────────────────┘                        │  │
│  │                          ▼                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │              POST-PROCESSING PIPELINE (9 steps)              │  │  │
│  │  │  1. Lexical Substitution    6. Accentuation Fix             │  │  │
│  │  │  2. Untranslated Words      7. Capitalization Norm          │  │  │
│  │  │  3. Voseo Adapter           8. Typography Norm              │  │  │
│  │  │  4. Agreement Fixes         9. Sentinel Restore             │  │  │
│  │  │  5. Punctuation Norm                                         │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │              QUALITY GATES (model-tier adaptive)             │  │  │
│  │  │  • dialectComplianceCheck  • personConsistencyCheck         │  │  │
│  │  │  • haberTenerCheck         • lengthSanityCheck              │  │  │
│  │  │  • semanticSimilarityCheck (tiny models only)               │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      DOMAIN MODEL LAYER                              │  │
│  │                     (@dialectos/types)                               │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │   Dialectal  │  │   Verb       │  │   Dialect    │              │  │
│  │  │   Dictionary │  │   Conjugation│  │   Regions    │              │  │
│  │  │  (~11.9K     │  │  Tables      │  │  (25 codes)  │              │  │
│  │  │   entries)   │  │              │  │              │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │   Quality    │  │   Grammar    │  │   Noun       │              │  │
│  │  │   Contracts  │  │   Profiles   │  │   Gender     │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    CROSS-CUTTING CONCERNS                            │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │   Security   │  │  Resilience  │  │Observability │              │  │
│  │  │(@dialectos/  │  │  (Circuit    │  │  (Telemetry  │              │  │
│  │  │  security)   │  │   Breaker,   │  │   + Metrics) │              │  │
│  │  │              │  │   Retry)     │  │              │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    PERSISTENCE LAYER                                 │  │
│  │                                                                      │  │
│  │  Translation Memory  ·  Checkpoints  ·  Dead-Letter Queue           │  │
│  │  Translation Corpus  ·  Telemetry DB (SQLite)                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Architecture

### 3.1 Package Dependency Graph

```
                    ┌─────────────────┐
                    │ @dialectos/cli  │  (CLI entry, 19 commands)
                    │ @dialectos/mcp  │  (MCP server, 18 tools)
                    └────────┬────────┘
                             │ depends on
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ @dialectos/     │  │ @dialectos/     │  │ @dialectos/     │
│ locale-utils    │  │ markdown-parser │  │ providers       │
│ (i18n file ops) │  │ (safe markdown) │  │ (translation    │
└────────┬────────┘  └────────┬────────┘  │  engine)        │
         │                    │           └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │ depends on
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ @dialectos/     │  │                 │  │ (external: zod) │
│ security        │  │                 │  │                 │
│ (path, SSRF,    │  │                 │  │                 │
│  rate limit)    │  │                 │  │                 │
└────────┬────────┘  │                 │  │                 │
         │           │                 │  │                 │
         └───────────┴─────────────────┘  │                 │
                     │                    │                 │
                     ▼                    │                 │
         ┌─────────────────┐              │                 │
         │ @dialectos/types│◄─────────────┘                 │
         │ (domain model,  │              │                 │
         │  25 dialects)   │              │                 │
         └─────────────────┘              │                 │
                                          │                 │
                                          └─────────────────┘
```

### 3.2 Package Responsibilities

| Package | Responsibility | Key Externals | Lines of Code |
|---------|---------------|---------------|---------------|
| **`@dialectos/types`** | Domain model: 25 Spanish dialects, Zod schemas, provider interfaces, dictionary (~11.9K entries), verb conjugations, grammar profiles, quality contracts, noun gender rules | `zod` | ~12K |
| **`@dialectos/security`** | Cross-cutting security: path traversal (realpath TOCTOU fix), symlink rejection, null-byte filtering, file size guards, HTML sanitization (DOMPurify), URL validation, error sanitization (API key redaction), sliding-window rate limiter, secure temp files | `zod`, `isomorphic-dompurify` | ~500 |
| **`@dialectos/locale-utils`** | i18n file operations: atomic read/write (temp+rename, O_EXCL), flatten/unflatten nested JSON, diff locales, circular reference detection, depth limits, prototype pollution blocking | `zod` | ~300 |
| **`@dialectos/markdown-parser`** | Safe markdown parsing: `marked` lexer (no ReDoS), URL validation, HTML sanitization, frontmatter extraction, parse→reconstruct for translation workflows | `marked`, `isomorphic-dompurify`, `zod` | ~400 |
| **`@dialectos/providers`** | Translation engine: 4 providers (LLM, DeepL, LibreTranslate, MyMemory), circuit breaker, retry policy, translation memory, corpus, chaos testing, sentinel extraction, agreement validation, false friends, voseo adapter, lexical substitution, typography normalization | `zod` | ~3.5K |
| **`@dialectos/cli`** | User interface layer: 19 CLI commands, shared libraries (resilient translation, telemetry, checkpointing, token protection, quality scoring, glossary enforcement, semantic context, validation, output judge) | `commander` | ~4K |
| **`@dialectos/mcp`** | MCP adapter: 18 tools exposing translation, i18n, docs, glossary, and research capabilities via `@modelcontextprotocol/sdk` | `@modelcontextprotocol/sdk`, `zod` | ~800 |

### 3.3 Build & Test Architecture

**Build Tool:** `tsc` only (no bundler). Each package compiles `src/` → `dist/` with declarations.
- Target: `ES2022`, Module: `Node16`, Strict: true
- `declaration: true`, `isolatedModules: true`

**Test Framework:** `vitest` in every package + `node --test` for root-level integration tests.
- 69 test files across all packages
- Security package has custom `vitest.config.ts` with globals and setup file

**CI/CD:** GitHub Actions on self-hosted macOS ARM64 runners
- `ci.yml`: Build, `npm pack` dry-run, unit tests, adversarial tests (Node 22 & 24 matrix)
- `pages.yml`: Deploy `docs/` to GitHub Pages
- `validate-pr.yml`: Validate PRs touching `*.es.json`, `*-es.md`, `locales/**`
- **Bug found:** `ci.yml` references `@espanol/cli` (old name) instead of `@dialectos/cli`

**Distribution:**
- npm scoped packages `@dialectos/*`
- Binaries: `dialectos` (CLI), `dialectos-mcp` (MCP server)
- Docker: `server/Dockerfile` (production), `Dockerfile.demo` (demo)
- **Gap:** No automated publish workflow; versions manually pinned to `0.3.0`

---

## 4. User Surface Architecture

### 4.1 CLI Surface (`dialectos`)

**Binary:** `dialectos` (v0.3.0)

| Command | Subcommands | Purpose | Surface Completeness |
|---------|-------------|---------|---------------------|
| `translate` | — | Single text/file/stdin translation | ✅ Complete |
| `validate` | — | Validate existing translations | ✅ Complete |
| `translate-readme` | — | Section-by-section markdown translation | ✅ Complete |
| `extract-translatable` | — | Extract translatable text from markdown | ✅ Complete |
| `translate-api-docs` | — | API documentation translation | ✅ Complete |
| `research-regional-term` | — | Regional term research | ⚠️ Sparse priors |
| `corpus` | `stats`, `export` | Translation corpus management | ⚠️ Read-only |
| `benchmark` | `run`, `report` | Quality benchmarking | ✅ Complete |
| `dialects` | `list`, `detect` | Dialect metadata | ⚠️ Detection is keyword-only |
| `glossary` | `search`, `get`, `suggest`, `diff` | Glossary management | ⚠️ No add/edit |
| `i18n` | `detect-missing`, `translate-keys`, `batch-translate`, `manage-variants`, `check-formality`, `apply-gender-neutral` | i18n workflow | 🔴 batch-translate is broken |

**🔴 Critical Gap:** `batch-translate` is **sequential, fail-stop, no deduplication, no checkpointing, no caching**. For a website with 1000 strings across 3 dialects, this means ~3000 sequential API calls with no recovery from failures.

### 4.2 MCP Server Surface (`dialectos-mcp`)

**Transport:** stdio (MCP protocol)
**Tools:** 17 across 3 categories

| Category | Tools | Completeness |
|----------|-------|-------------|
| **Docs** | `translate_markdown`, `extract_translatable`, `translate_api_docs`, `create_bilingual_doc` | ✅ Complete |
| **i18n** | `detect_missing_keys`, `translate_missing_keys`, `batch_translate_locales`, `manage_dialect_variants`, `check_formality`, `apply_gender_neutral` | 🔴 `batch_translate_locales` inherits CLI bugs |
| **Translator** | `translate_text`, `detect_dialect`, `translate_code_comment`, `translate_readme`, `search_glossary`, `research_regional_term`, `list_dialects` | ⚠️ `detect_dialect` is keyword-only; `translate_code_comment` only handles `//` and `/* */` |

### 4.3 HTTP API Surface (`demo-server.mjs`)

**Entry:** `node scripts/demo-server.mjs` or Docker
**Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /` / `GET /index.html` | GET | Static files (demo UI) |
| `GET /api/status` | GET | Provider health check |
| `POST /api/translate` | POST | Translation endpoint |

**🔴 Critical Gap:** No `dialectos serve` CLI command. The HTTP server is a separate script, not accessible via the CLI binary.

### 4.4 GitHub Action Surface (`action.yml`)

**Name:** DialectOS Translation Validation
**Type:** Composite action
**Purpose:** Validate translations in PRs touching locale files

**Inputs:** `dialect`, `source-dir`, `target-patterns`, `glossary-file`, `fail-on-blocking`, `format`, `strict`

**🔴 Gap:** Only validates; does not translate. No "translate and validate" mode.

---

## 5. Translation Pipeline Architecture

### 5.1 Request Flow

```
User Request
    │
    ▼
┌─────────────────┐
│  Ingestion      │  Parse input format → TranslatableUnit[]
│  (CLI/MCP/HTTP) │  Protect sentinels (URLs, code, emails)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pre-Translation│  Deduplicate → Analyze dialect-critical terms
│  Intelligence   │  Select model strategy (compact/standard/minimal)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Provider       │  Registry.getAuto() → ranked provider selection
│  Selection      │  Circuit breaker check → capability validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Provider   │  Build prompt (system + user) based on strategy
│  (or cloud)     │  API call → response parsing → preamble stripping
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Garbage        │  isGarbageOutput()? → retry with stricter prompt
│  Detection      │  Max 1 retry currently; should be adaptive per tier
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post-Processing│  9-step deterministic pipeline
│  Pipeline       │  (see §5.2)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Quality Gates  │  Tier-dependent validation (see §5.3)
│  (NEW)          │  Gate failure → retry; gate pass → telemetry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Output         │  Restore sentinels → render format → write file
│  Rendering      │  Emit telemetry event
└─────────────────┘
```

### 5.2 Post-Processing Pipeline (9 Steps)

Executed in strict order. Each step is idempotent, composable, and safe (no-op is always correct).

| Step | Function | File | Cost | What It Does |
|------|----------|------|------|-------------|
| 1 | `applyLexicalSubstitution` | `lexical-substitution.ts` | cheap | Wrong-dialect → right-dialect word swaps. O(1) ruleMap lookup. Handles depluralization. Article gender fix (`el computadora` → `la computadora`). |
| 2 | `fixUntranslatedWords` | `llm.ts` | cheap | English concept names → Spanish (e.g., "elevator" → "elevador"). Exact concept match only. |
| 3 | `applyVoseo` | `voseo-adapter.ts` | cheap | tú → vos verb form substitution for voseo dialects. Present tense only. Imperatives disabled (noun collision risk). |
| 4 | `applyAgreementFixes` | `agreement-validator.ts` | cheap | Article-noun gender/number mismatch detection. Only applies gender fixes (number disabled to avoid overcorrection). |
| 5 | `normalizePunctuation` | `punctuation-normalizer.ts` | cheap | Missing `¿` and `¡` insertion at sentence starts. |
| 6 | `fixAccentuation` | `accentuation.ts` | cheap | Missing tildes: `mas→más`, `tambien→también`, `si,→sí,`, `Tu→Tú`. |
| 7 | `normalizeCapitalization` | `capitalization.ts` | cheap | Spanish casing rules: lowercase days/months/languages mid-sentence. |
| 8 | `normalizeTypography` | `typography.ts` | cheap | `...→…`, `--→—`, straight→curly quotes. Respects code spans. |
| 9 | `restoreSentinels` | `sentinel-extraction.ts` | cheap | Restore `{{URL_0}}`, `{{CODE_1}}` placeholders. **Always last.** |

**Performance:** All 9 steps are regex-based string operations. Total cost is sub-millisecond per translation. Strong models do not skip steps because the cost is negligible and correctness is paramount.

### 5.3 Quality Gates (Adaptive, Tier-Dependent)

**NEW** — runs after post-processing, only for flagged model tiers.

| Gate | Cost | Tiers | Detects | Action on Failure |
|------|------|-------|---------|-------------------|
| `lengthSanityCheck` | cheap | all | Output >4× or <15% of source length | Retry with stricter prompt |
| `dialectComplianceCheck` | cheap | all | Forbidden terms in output (e.g., "coche" in es-MX) | Retry with reinforced glossary |
| `personConsistencyCheck` | cheap | tiny, small | "You" → "Yo" flips | Retry with person-preservation hint |
| `haberTenerCheck` | cheap | tiny, small | Auxiliary "haber" used for possessive "tener" | Retry with have→tener hint |
| `semanticSimilarityCheck` | expensive | tiny only | Embedding-based semantic drift (strawberry→star) | Retry + flag for manual review |

**Key Rule:** Gates that fail trigger retry. Gates that pass emit telemetry. Expensive gates only run for tiny models where the failure rate justifies the cost.

### 5.4 Adaptive Strategy by Model Tier

The pipeline configures itself based on runtime model metadata.

| Model Tier | Detected By | Prompt Style | Post-Processors | Quality Gates | Max Retries |
|------------|-------------|--------------|-----------------|---------------|-------------|
| **Tiny** (≤350M) | `/\d{2,3}m\b/i`, `isCompactModel()` | Compact: all hints in system prompt, user prompt = text only | All 9 + all gates | All gates + semantic similarity | 3 |
| **Small** (0.6B–1B) | `/\d{3}m\b/i` or `/0\.\d+b/i` | Full hints in system prompt, clean user prompt | All 9 + cheap gates | Length + dialect + person + haber | 2 |
| **Medium** (2B–8B) | `/[2-8]b/i` | Compact hints, standard user prompt | All 9 (no gates) | Length sanity only | 1 |
| **Large** (≥9B) | `/[9]\d*b/i` or `/\d{2}b/i` | Minimal hints, standard prompt | All 9 (no gates) | None | 0 |

---

## 6. Quality Assurance Architecture

### 6.1 The Canary-Driven QA Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CANARY-DRIVEN QUALITY ASSURANCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│   │   Weak      │────▶│   Pipeline  │────▶│  Failure    │            │
│   │   Models    │     │   Execution │     │  Telemetry  │            │
│   │  (360M)     │     │             │     │  (SQLite)   │            │
│   └─────────────┘     └─────────────┘     └──────┬──────┘            │
│                                                   │                   │
│                          ┌────────────────────────┘                   │
│                          ▼                                            │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│   │   Strong    │◀────│   Fix       │◀────│  Cluster    │           │
│   │   Models    │     │  Applied    │     │  Analysis   │           │
│   │   (4B+)     │     │             │     │             │           │
│   └─────────────┘     └─────────────┘     └─────────────┘           │
│        │                                               ▲             │
│        │         ┌─────────────────────────────────────┘             │
│        │         ▼                                                   │
│        │    ┌─────────────┐     ┌─────────────┐                     │
│        └───▶│  Validate   │◀────│  Auto-Test  │                     │
│             │   Fix       │     │  Generated  │                     │
│             │             │     │             │                     │
│             └─────────────┘     └─────────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Benchmarking Infrastructure

| Benchmark | Script | Scope | Models | Test Cases |
|-----------|--------|-------|--------|------------|
| **Real Benchmark** | `scripts/real-benchmark.mjs` | End-to-end provider pipeline | 8 tiers (270M–40B) | 31 cases (vocab, voseo, dialect coverage) |
| **Adversarial Benchmark** | `scripts/benchmark.mjs` | Adversarial fixture corpus | Configurable | 60+ lexical rules, fixture files |
| **Dialect Evaluation** | `scripts/dialect-eval.mjs` | Fixture-based scoring | Configurable | Rich fixture schema with output judge |
| **Dialect Certification** | `scripts/dialect-certify.mjs` | Pass/fail certification | Configurable | Certification thresholds per dialect |
| **Adversarial Certification** | `scripts/dialect-certify-adversarial.mjs` | Repeat-run instability | Configurable | Detects non-deterministic failures |

### 6.3 Failure Taxonomy

Every translation failure is classified into one of 11 categories:

| Class | Description | Example | Root Cause Layer |
|-------|-------------|---------|------------------|
| `garbage_output` | Nonsensical, preamble, conversational | "¡Bienvenido!" | Prompt / Model |
| `hallucination` | Invented words not in source | "campero" for bus | Model |
| `dialect_violation` | Forbidden term for target dialect | "coche" in es-MX | Post-processor / Dictionary |
| `untranslated_words` | English words left in output | "elevator" untranslated | Post-processor / Model |
| `person_flip` | You → Yo, etc. | "Yo lo hago bien" | Prompt / Model |
| `verb_confusion` | haber vs tener, ser vs estar | "Te has dado" for "You have" | Prompt / Model |
| `semantic_drift` | Output meaning differs from source | "strawberry" → "estrella" | Model |
| `agreement_error` | Gender/number mismatch | "el computadora" | Post-processor |
| `punctuation_error` | Missing ¿ ¡ or wrong punctuation | "Como te llamas" | Post-processor |
| `network_error` | Timeout, DNS, HTTP error | Connection refused | Infrastructure |
| `provider_error` | Circuit breaker, rate limit | "Provider busy" | Infrastructure |

---

## 7. Security Architecture

### 7.1 Threat Model

DialectOS operates in three deployment modes with different threat profiles:

| Mode | Threat Level | Primary Concerns |
|------|-------------|------------------|
| **CLI (local)** | Low | Path traversal, malicious input files |
| **MCP Server (local)** | Low-Medium | Prompt injection via tool parameters |
| **HTTP Demo (networked)** | Medium-High | SSRF, DoS, prompt injection, information disclosure |
| **GitHub Action (CI)** | Low | Secret exposure in logs, supply chain |

### 7.2 Defense Layers

| Layer | Feature | Implementation | Quality |
|-------|---------|----------------|---------|
| **Input Validation** | Path traversal protection | `realpathSync.native` + prefix check | Excellent |
| | File size limits | 512KB default | Good |
| | Content length limits | 50K chars | Good |
| | Symlink rejection | `lstatSync` + option | Good |
| **URL Security** | Protocol whitelist | `http`/`https` only | Good |
| | SSRF protection | Per-hop redirect validation | Good |
| | Private IP blocking | CIDR range check | Good |
| **Prompt Injection** | Tag stripping | ChatML, Llama, Alpaca, Phi, XML | Good |
| | Garbage detection | 35+ patterns | Good |
| **Output Sanitization** | HTML sanitization | DOMPurify strict | Good |
| | Error sanitization | API key redaction | Good |
| **Rate Limiting** | Sliding window | Per-key buckets, 10K cap | Good (single process) |
| **Resilience** | Circuit breaker | Half-open probe lock | Good |
| | Retry with backoff | Exponential + jitter | Good |

### 7.3 Security Gaps Blocking Production

| Gap | Severity | Risk | Fix |
|-----|----------|------|-----|
| Docker runs as root | 🔴 Critical | Container escape | Add `USER node` directive |
| No audit logging | 🔴 Critical | Cannot investigate incidents | Add structured audit log |
| No secret management | 🔴 Critical | API keys in env vars | Document vault integration |
| Self-hosted CI runners only | 🔴 Critical | Supply chain risk | Add GitHub-hosted runner fallback |
| In-memory rate limiter | 🟡 High | Not cluster-safe | Document Redis integration |
| No HTTPS/TLS config | 🟡 High | MITM risk | Add Caddy/reverse-proxy docs |
| No dependency scanning | 🟡 High | Supply chain | Add `npm audit` to CI |
| No CORS policy | 🟡 High | Browser attacks | Add CORS middleware |
| No RBAC/authn/authz | 🟢 Medium | Unauthorized access | Document API key auth |

---

## 8. Observability Architecture

### 8.1 Current State

| Component | Exists | Quality | Storage |
|-----------|--------|---------|---------|
| Telemetry Collector | ✅ | Basic (in-memory, stderr JSON) | 10K-entry circular buffer |
| Health Report | ✅ | Basic | stderr JSON |
| Benchmark Reports | ✅ | Good | JSON files |
| CI Validation | ✅ | Good | PR comments |

### 8.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY STACK                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Translation Events ──▶  SQLite Store  ──▶  Queries / Reports        │
│        │                      │                                          │
│        │                      ▼                                          │
│        │              ┌──────────────┐                                   │
│        │              │  Dashboard   │  (future: web UI)                │
│        │              │  Queries:    │                                   │
│        │              │  • Failure   │                                   │
│        │              │    clusters  │                                   │
│        │              │  • Latency   │                                   │
│        │              │    p99       │                                   │
│        │              │  • Provider  │                                   │
│        │              │    health    │                                   │
│        │              └──────────────┘                                   │
│        │                                                                 │
│        └──────────────────────────────────────────▶  stderr (MCP-safe)  │
│                                                                         │
│   Audit Events ────────▶  Audit Log (JSONL)  ──▶  Security Review      │
│                                                                         │
│   Health Checks ───────▶  /api/status  ──▶  Load Balancer / K8s        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Telemetry Schema

```typescript
interface TranslationTelemetry {
  eventId: string;
  timestamp: string;
  unitId: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  dialect: SpanishDialect;
  
  modelName: string;
  modelTier: "tiny" | "small" | "medium" | "large";
  
  strategy: {
    promptStyle: string;
    maxRetries: number;
    garbageDetection: string;
  };
  
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  
  postProcessorsApplied: Array<{
    name: string;
    changed: boolean;
    details?: string;
  }>;
  
  qualityGates: Array<{
    name: string;
    passed: boolean;
    details?: string;
  }>;
  
  retryCount: number;
  retryReasons: string[];
  
  failureClass?: FailureClass;
  providerUsed: string;
  fallbackCount: number;
  cacheHit: boolean;
}
```

---

## 9. Deployment & Distribution Architecture

### 9.1 Distribution Channels

| Channel | Status | Mechanism | Gap |
|---------|--------|-----------|-----|
| **npm packages** | Ready | `@dialectos/*` scoped packages | No automated publish workflow |
| **CLI binary** | Ready | `dialectos` via npm global | — |
| **MCP binary** | Ready | `dialectos-mcp` via npm global | — |
| **Docker** | Ready | `server/Dockerfile`, `Dockerfile.demo` | Runs as root |
| **GitHub Action** | Ready | `action.yml` composite action | — |
| **GitHub Pages** | Ready | `pages.yml` deploys `docs/` | — |

### 9.2 Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Images                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  dialectos:prod     │    │  dialectos:demo     │        │
│  │  (server/Dockerfile)│    │  (Dockerfile.demo)  │        │
│  │                     │    │                     │        │
│  │  • node:20-slim     │    │  • node:24-bookworm │        │
│  │  • Multi-stage      │    │  • Single-stage     │        │
│  │  • Healthcheck      │    │  • Dev server       │        │
│  │  • Port 8080        │    │  • Port 8080        │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                             │
│  Deployment:                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Caddy (reverse proxy + TLS)                        │   │
│  │  ────────────────────────────────────────────────   │   │
│  │  docker-compose.yml (Hostinger VPS template)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 CI/CD Pipeline

```
Push/PR to main
    │
    ▼
┌─────────────────┐
│  Build & Test   │  pnpm install → pnpm -r build → pnpm -r test
│  (Node 22 & 24) │  npm pack --dry-run (ensure no test fixtures leak)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Adversarial    │  Run adversarial fixture corpus
│  Tests          │  (Note: CI references @espanol/cli — BUG)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy Docs    │  Deploy docs/ to GitHub Pages
│  (pages.yml)    │
└─────────────────┘
```

---

## 10. Data Flows — Complete User Journeys

### 10.1 Journey A: Single Text Translation

```
dialectos translate "Hello world" --dialect es-MX --formal
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Parse CLI args → validate dialect "es-MX"                   │
│ 2. getDefaultProviderRegistry() → createProviderRegistry()      │
│    • Reads LLM_API_URL, LLM_MODEL from env                      │
│    • Registers LLMProvider (semantic)                           │
│ 3. registry.getAuto("es", { dialect: "es-MX" })                │
│    • Ranks: semantic > native > approximate                     │
│    • Selects LLMProvider                                        │
│ 4. Build semantic context → detect formality → protect identities│
│ 5. provider.translate("Hello world", "en", "es", { dialect })  │
│    • isCompactModel()? → build compact prompt                   │
│    • extractSentinels() → no sentinels in this text             │
│    • API call → "Hola mundo"                                    │
│    • isGarbageOutput()? → passes                                │
│ 6. _runPostProcessing() → 9 steps (no changes needed)          │
│ 7. Write "Hola mundo" to stdout                                │
│ 8. Emit telemetry (stderr JSON with [telemetry] prefix)        │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Journey B: i18n Batch Translation (Current — Broken)

```
dialectos i18n batch-translate ./locales --base en --targets es-MX,es-AR,es-ES
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Read ./locales/en.json → [{key, value}, ...]                │
│ 2. For each target dialect (3 dialects):                       │
│    For each key (say 1000 keys):                               │
│      await provider.translate(key.value, "en", "es", {dialect})│
│      ← SEQUENTIAL, NO DEDUP, NO CACHE, NO CHECKPOINT           │
│      ← If ANY key fails → throw error → ENTIRE BATCH ABORTS    │
│ 3. Write translated file (OVERWRITES existing entries)         │
└─────────────────────────────────────────────────────────────────┘
```

**🔴 This is the #1 launch blocker.**

### 10.3 Journey C: i18n Batch Translation (Target — Fixed)

```
dialectos i18n batch-translate ./locales --base en --targets es-MX,es-AR,es-ES
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Ingest ./locales/en.json → TranslatableUnit[]               │
│ 2. Deduplicate: 1000 keys → 650 unique strings                  │
│ 3. Check TranslationMemory: 200 cache hits → 450 API calls      │
│ 4. BulkTranslationEngine.translate(450 units, {concurrency: 4})│
│    • Parallel execution with semaphore                          │
│    • Per-unit retry with adaptive backoff                       │
│    • Dead-letter queue: 2 failures collected, batch continues   │
│ 5. Post-processing + quality gates per unit                     │
│ 6. Rehydrate dedup map: 650 → 1000 entries                      │
│ 7. Merge with existing target files (preserve existing trans)   │
│ 8. Write output files                                           │
│ 9. Emit telemetry for all 1000 units                            │
│ 10. Report: 998 success, 2 DLQ, 200 cache hits, 4:32 total     │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4 Journey D: Website Translation

```
dialectos translate-website ./my-site --base en --targets es-MX,es-AR
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Discover translatable assets:                                │
│    • Locale files: ./my-site/locales/en.json                    │
│    • Markdown files: ./my-site/content/**/*.md                  │
│    • (Future: HTML files)                                       │
│ 2. Ingest all assets → unified TranslatableUnit[]               │
│ 3. Deduplicate across all sources                               │
│ 4. For each target dialect:                                     │
│    • Run BulkTranslationEngine                                  │
│    • Checkpoint every 100 units                                 │
│    • Collect failures in DLQ                                    │
│ 5. Render outputs:                                              │
│    • ./my-site/locales/es-MX.json                               │
│    • ./my-site/locales/es-AR.json                               │
│    • ./my-site/content/**/*.es-MX.md                            │
│    • ./my-site/content/**/*.es-AR.md                            │
│ 6. Generate report:                                             │
│    • Total strings, unique strings, cache hits                  │
│    • Per-dialect statistics                                     │
│    • Failure summary with DLQ path                              │
│    • Quality gate summary                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 10.5 Journey E: MCP Integration

```
Claude Desktop → MCP stdio → dialectos-mcp
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. MCP client calls translate_text:                            │
│    { text: "Hello", dialect: "es-MX" }                         │
│ 2. MCP server validates params with Zod schemas                │
│ 3. Calls same provider pipeline as CLI                         │
│ 4. Returns { translatedText: "Hola", ... }                     │
│ 5. Telemetry emitted to stderr ([telemetry] prefix)            │
│    → stdout reserved for MCP protocol                           │
└─────────────────────────────────────────────────────────────────┘
```

### 10.6 Journey F: HTTP Demo

```
Browser → POST /api/translate { text, dialect }
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Express/Fastify server receives request                      │
│ 2. Rate limit check (per-IP sliding window)                    │
│ 3. Validate request body                                        │
│ 4. Call web-demo-service.ts → translateForWebDemo()            │
│    • Requires semantic provider (rejects cloud MT)             │
│    • Runs full pipeline + quality warnings                     │
│ 5. Return JSON with translatedText, latency, qualityWarnings   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Roadmap

### Phase 1: Launch Blockers (Today)
- [ ] `BulkTranslationEngine`: dedup, parallelism, DLQ, checkpoints, progress
- [ ] Enhanced `batch-translate`: use BulkTranslationEngine, merge (don't overwrite)
- [ ] New `translate-website` command
- [ ] `dialectos serve` command (wrap demo-server.mjs)
- [ ] Enable TranslationMemory by default for bulk ops
- [ ] Fix CI `@espanol/cli` → `@dialectos/cli` reference
- [ ] Wire telemetry persistence (SQLite)

### Phase 2: Quality Hardening
- [ ] Quality gates: `dialectComplianceCheck`, `personConsistencyCheck`, `haberTenerCheck`
- [ ] Adaptive retry: tier-dependent max retries, escalating strictness
- [ ] Telemetry dashboard queries
- [ ] Failure clustering and auto-test-case generation

### Phase 3: Operational Hardening
- [ ] Docker: add `USER node`, resource limits
- [ ] Add audit logging to security module
- [ ] Add `npm audit` to CI
- [ ] Document secret management integration
- [ ] Add CORS middleware to demo server

### Phase 4: Advanced Features
- [ ] HTML ingestion and tag preservation
- [ ] Semantic similarity validation (embeddings)
- [ ] Corpus → few-shot prompting pipeline
- [ ] Dictionary gap detection from telemetry
- [ ] Automated versioning and publish workflow

---

## 12. Launch Readiness Checklist

### Code Quality
- [x] 545/545 tests passing
- [x] TypeScript compiles clean across 8 packages
- [x] Security red-team hardened (path traversal, SSRF, XSS, prompt injection)
- [x] Circuit breaker, retry, rate limiting implemented
- [x] 25 Spanish dialects supported
- [x] ~11.9K dictionary entries

### User Surfaces
- [x] CLI with 19 commands
- [x] MCP server with 18 tools
- [x] HTTP demo server with 2 routes
- [x] GitHub Action for CI validation

### Critical Gaps (Must Fix Before Launch)
- [ ] `batch-translate` is sequential and fail-stop
- [ ] Translation memory disabled by default
- [ ] No deduplication in bulk operations
- [ ] No dead-letter queue for failures
- [ ] No checkpoint/resume in batch-translate
- [ ] No `dialectos serve` command
- [ ] CI references stale package name
- [ ] Docker runs as root

### Nice to Have (Post-Launch)
- [ ] Telemetry dashboard
- [ ] Semantic similarity validation
- [ ] HTML ingestion
- [ ] Corpus-driven few-shot prompting
- [ ] Automated publish workflow

---

## 13. Architectural Principles (Reiterated)

1. **Zero-Regression Hardening**: Every fix must improve weak models or be neutral for strong models. Never add latency to strong models.

2. **Adaptive Pipeline**: The pipeline configures itself based on runtime model metadata. Strong models skip expensive defensive layers.

3. **Observability-First**: Every translation produces telemetry. Every failure is classified. Every retry is logged.

4. **Deterministic Post-Processing**: All 9 steps are idempotent, composable, measurable, and safe. Order is strict.

5. **Bulk-First Design**: Website translation is the primary use case. Single-text is a degenerate batch of size 1.

6. **Canary-Driven QA**: Weak models expose pipeline cracks. Every failure is a data point. Fix the pipeline, not the model.

---

*This architecture covers the full DialectOS application: 7 packages, 4 user surfaces, the translation engine, quality assurance, security, observability, deployment, and all user journeys. The codebase is structurally sound. The launch blockers are operational and fixable today.*
