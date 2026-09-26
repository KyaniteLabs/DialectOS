# Architecture Audit — 2026-04-30

Post-refactor audit after completing all 7 items from the previous architecture audit.

## Executive Summary

**Good:** No circular dependencies, no empty catch blocks, no duplicated dialect sets, clean dependency graph, all 7 previous audit items resolved.

**Concerns:** MCP package has 66+ pre-existing test failures, several large files remain untested, `verb-conjugations.ts` is the next 1,276-line monolith.

---

## 1. Large Files / God Objects Remaining

| File | Lines | Verdict |
|------|-------|---------|
| `packages/types/src/verb-conjugations.ts` | 1,276 | **Extract to JSON** — same pattern as dictionary |
| `packages/cli/src/lib/lexical-ambiguity.ts` | 1,268 | Monitor — mostly data tables, not logic |
| `packages/mcp/src/tools/translator.ts` | 1,205 | **Candidate** — could split by tool type |
| `packages/security/src/index.ts` | 746 | **Low priority** — single-purpose package |
| `packages/markdown-parser/src/index.ts` | 734 | **Low priority** — single-purpose package |
| `packages/types/src/glossary-data.ts` | 657 | Monitor — data-heavy |

### Recommendation
Extract `verb-conjugations.ts` data to `verb-conjugations.json` following the same pattern used for `dialectal-dictionary.json`. ROI is lower (1,276 vs 11,959 lines) but the structural benefit for linguist contributors is the same.

---

## 2. Test Coverage Gaps

### Packages with significant untested source files

**providers** (18 untested files):
- `providers/llm.ts`, `providers/deepl.ts`, `providers/libre-translate.ts`, `providers/my-memory.ts`
- `bulk/engine.ts`, `bulk/semaphore.ts`, `bulk/types.ts`
- `pipeline/types.ts`, `pipeline/steps.ts`, `pipeline/index.ts`
- `factory.ts`, `registry.ts`, `translation-memory.ts`, `chaos-provider.ts`
- `accentuation.ts`, `retry.ts`, `fetch-utils.ts`, `punctuation-normalizer.ts`

**cli** (19 untested files):
- `lib/validate-translation.ts`, `lib/idiom-detection.ts`, `lib/dialect-info.ts`
- `lib/structure-validator.ts`, `lib/quality-score.ts`, the telemetry store
- `lib/glossary-enforcement.ts`, `lib/glossary-data.ts`, `lib/translation-memory.ts`
- `lib/output.ts`
- `commands/serve.ts`, `commands/translate-website.ts`, `commands/research.ts`, `commands/benchmark.ts`
- `commands/i18n/translate-keys.ts`, `commands/i18n/detect-missing.ts`, `commands/i18n/batch-translate.ts`
- `commands/i18n/manage-variants.ts`, `commands/i18n/check-formality.ts`, `commands/i18n/apply-gender-neutral.ts`

**types** (4 untested files):
- `validation.ts`, `result.ts`, `verb-conjugations-extra.ts`, `index.ts`

**security** (1 untested file):
- `index.ts` (the entire package)

**locale-utils** (1 untested file):
- `index.ts` (the entire package)

**markdown-parser** (1 untested file):
- `index.ts` (the entire package)

### Recommendation
Priority order for adding tests:
1. `security/src/index.ts` — entire package untested
2. `providers/src/bulk/engine.ts` — complex concurrent logic
3. `providers/src/translation-memory.ts` — cache correctness
4. `cli/src/lib/validate-translation.ts` — central orchestrator

---

## 3. Pre-existing Test Failures (MCP Package)

**Status:** 66+ failures across `docs.test.ts` and `security.test.ts`

**Root cause:** Test expectations expect JSON-formatted tool responses (`JSON.parse(result.content[0].text)`), but the actual tool handlers return markdown text (`"# Hello World"`). This suggests either:
- The tool output format changed and tests weren't updated
- The mock setup is incomplete (missing mock for some intermediate layer)

**Error pattern:**
```
SyntaxError: Unexpected token '#', "# Hello Wo..." is not valid JSON
```

**Not caused by recent refactors** — no changes were made to MCP package or its dependencies.

### Recommendation
Fix the mock setup in `packages/mcp/src/__tests__/docs.test.ts` and `security.test.ts` to match the actual tool response format, or update the tools to return JSON as the tests expect.

---

## 4. Package Dependency Graph

```
types ← security ← locale-utils ← cli
              ← markdown-parser ← mcp
              ← providers ← cli, mcp
```

**Clean — no circular dependencies.**

---

## 5. Error Handling Hygiene

- **No empty catch blocks** found across source code
- `Result<T, E>` type is introduced and used in validation pipeline
- Most catch blocks propagate or log errors

---

## 6. Documentation

**Newly created:**
- `AGENTS.md` — agent onboarding guide
- `docs/linguist-guide.md` — contributor guide for dictionary JSON editing

**Still missing:**
- Architecture decision records (ADRs) for major refactors
- Provider setup guide (API keys, endpoints, compatibility modes)

---

## 7. Performance Observations

- CLI script integration tests spawn actual child processes → 5+ min suite time
- `demo-server.mjs` auto-builds on startup if dist missing → adds ~10s cold start
- BulkEngine checkpoint I/O is synchronous (`fs.writeFileSync`) — could be async for large jobs

---

## Ranked Action Items

| Rank | Item | Effort | Impact |
|------|------|--------|--------|
| 1 | Fix 66+ MCP test failures | Medium | High |
| 2 | Add tests for `security/src/index.ts` | Medium | High |
| 3 | Extract `verb-conjugations.ts` → JSON | Low | Medium |
| 4 | Add tests for `providers/src/bulk/engine.ts` | Medium | Medium |
| 5 | Split `mcp/src/tools/translator.ts` (1,205 lines) | Medium | Medium |
| 6 | Make BulkEngine checkpoint I/O async | Low | Low |
