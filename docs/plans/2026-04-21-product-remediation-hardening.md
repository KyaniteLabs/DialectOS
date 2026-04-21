# Product Remediation Hardening Implementation Plan

**Goal:** Convert the audit findings into a coherent product-hardening slice that removes false-green translation behavior, unifies CLI/MCP contracts, makes partial failures explicit, and makes the package/docs surfaces honest.

**Architecture:** Introduce shared domain helpers for providers, dialects, glossary, adaptations, quality gating, and table reconstruction rather than continuing duplicated CLI/MCP logic. Keep the changes dependency-free and backwards-compatible at the public CLI/MCP boundary while making unsupported provider/dialect combinations explicit. Tests lock each audited failure before production changes.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Commander, MCP SDK, existing @espanol/* packages.

---

## Scope and priorities

### P0 correctness gates
- Canonicalize provider names (`libre` alias to `libretranslate`, remove fake `deepl-free` behavior unless registered).
- Enforce provider capability validation before provider calls.
- Normalize dialect target handling: external providers receive language `es`; dialect stays in options/context unless provider declares native dialect support.
- Make semantic quality thresholds hard gates for strict/balanced policy.
- Reconstruct markdown table cells with translated content instead of discarding translations.

### P1 MCP parity
- Reuse shared CLI/domain data for MCP dialect list, detection, glossary, and manage-variants behavior.
- Add MCP schema validation for dialect/provider inputs.
- Make per-key translation failures explicit in MCP responses.
- Wire MCP config into server startup.

### P2 product hygiene
- Add package `files` allowlists so npm tarballs ship runtime artifacts only.
- Fix version/documentation claims that currently overstate shipped behavior.
- Add CI pack checks and focused regression tests.

---

## Task 1: Provider contract tests

**Files:**
- Modify: `packages/cli/src/__tests__/translate.test.ts`
- Modify: `packages/cli/src/__tests__/translate-api-docs.test.ts`
- Modify: `packages/providers/src/__tests__/providers.test.ts`

**Steps:**
1. Add failing tests proving `--provider libre` resolves to the registered LibreTranslate provider.
2. Add failing tests proving `deepl-free` is not advertised unless a provider is registered.
3. Add failing tests proving providers with `dialectHandling: none` receive target language `es`, not `es-MX`.
4. Run focused tests and verify failures are the expected contract failures.

## Task 2: Provider contract implementation

**Files:**
- Modify: `packages/providers/src/registry.ts`
- Modify: `packages/cli/src/lib/resilient-translation.ts`
- Modify: `packages/cli/src/commands/translate.ts`
- Modify: `packages/cli/src/commands/translate-readme.ts`
- Modify: `packages/cli/src/commands/translate-api-docs.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/providers/src/providers/libre-translate.ts`

**Steps:**
1. Add provider alias canonicalization in registry.
2. Add `prepareProviderRequest()` helper that validates capabilities and downgrades target language to `es` for non-native dialect providers.
3. Thread provider-used/fallback metadata out of fallback translation.
4. Remove or alias stale CLI provider labels.

## Task 3: Markdown table reconstruction tests and implementation

**Files:**
- Modify: `packages/markdown-parser/src/__tests__/parser.test.ts`
- Modify: `packages/markdown-parser/src/index.ts`

**Steps:**
1. Add a failing test that translated table cell text appears in reconstructed markdown while pipes/alignment remain.
2. Implement cell-aware reconstruction for simple GitHub-flavored markdown tables.
3. Add edge tests for header/body cell count mismatch falling back safely.

## Task 4: Quality gate tests and implementation

**Files:**
- Modify: `packages/cli/src/__tests__/translation-policy.test.ts`
- Modify: `packages/cli/src/__tests__/translate-readme.test.ts`
- Modify: `packages/cli/src/lib/translation-policy.ts`
- Modify: `packages/cli/src/commands/translate-readme.ts`
- Modify: `packages/cli/src/commands/translate-api-docs.ts`

**Steps:**
1. Add tests proving low semantic similarity fails in strict/balanced policy.
2. Keep permissive mode warn-only.
3. Implement semantic threshold enforcement after quality calculation and before output write.

## Task 5: MCP parity and explicit failures

**Files:**
- Modify: `packages/mcp/src/tools/translator.ts`
- Modify: `packages/mcp/src/tools/i18n.ts`
- Modify: `packages/mcp/src/tools/docs.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: MCP tests under `packages/mcp/src/__tests__`.

**Steps:**
1. Replace duplicated dialect/glossary/adaptation logic with imports from CLI/domain modules where practical.
2. Validate schemas using shared zod schemas.
3. Return errors/skipped counts for partial translation failures; set `isError` when no requested work succeeds.
4. Load config at MCP startup and inject rate limiter.

## Task 6: Packaging/docs/CI hygiene

**Files:**
- Modify: package manifests in `packages/*/package.json`.
- Modify: `.github/workflows/ci.yml`.
- Modify: `README.md`, `ROADMAP.md`, `CHANGELOG.md` as needed.

**Steps:**
1. Add `files` allowlists to publish only dist/runtime docs.
2. Add pack dry-run checks to CI.
3. Correct README claims to match actual glossary/support surfaces, or update code to make claims true.

## Verification

Run in order:
1. `pnpm -r exec tsc --noEmit`
2. `pnpm test`
3. `pnpm audit --audit-level low`
4. `npm pack --dry-run` for representative packages and confirm tests/source are excluded.
5. `git status --short`

## Commit strategy

Use one Lore-style commit for the coherent hardening bundle unless the diff becomes too large; then split into `provider-contracts`, `markdown-quality`, `mcp-parity`, and `packaging-docs` commits.
