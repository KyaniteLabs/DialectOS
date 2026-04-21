# Dialect Grammar Profiles Implementation Plan

**Goal:** Add source-backed grammar profiles and dialect-specific semantic prompt instructions for all 25 Spanish dialects so translation guidance is not just generic context or vocabulary replacement.

**Architecture:** Add canonical dialect grammar/profile data to `@espanol/types`, export lookup helpers, and have CLI semantic context include the relevant profile guidance. Keep the system dependency-free and conservative: profile notes describe defaults and regional variation without pretending native-speaker validation has happened.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, existing @espanol packages.

---

## Scope
- 25 `DialectGrammarProfile` entries keyed by `SpanishDialect`.
- Coverage fields: voseo, plural address, leismo/laismo/loismo notes, formality norms, taboo/ambiguity notes, and semantic prompt guidance.
- Source references from RAE/ASALE and other broad dialect references.
- Tests proving every dialect has source-backed profiles and key dialects expose correct guidance.
- CLI semantic context uses the profile guidance.

## Verification
- Focused tests for dialect profiles and semantic context.
- `pnpm build`
- `pnpm -r exec tsc --noEmit`
- `pnpm test`
- `pnpm audit --audit-level low`
- npm pack dry-run package-content check.
