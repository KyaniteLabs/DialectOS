# Provider Dogfood Dialect Eval Implementation Plan

**Goal:** Run dialect-eval fixtures through provider-like translation outputs and produce audit artifacts that score forbidden terms, context propagation, and provider output readiness.

**Architecture:** Add a dependency-free `scripts/dialect-eval.mjs` harness. It loads existing fixture JSON, builds deterministic mock-provider outputs by default for CI/offline use, validates forbidden output terms, records semantic context presence, and writes timestamped artifacts under `audits/dialect-eval-*`. Real providers can be added later without changing fixture format.

**Tech Stack:** Node ESM script, JSON fixtures, Vitest smoke test via CLI script execution.

---

## Tasks
1. Add script and npm command.
2. Add script-level tests/smoke via a fixture output artifact command.
3. Ensure artifacts are deterministic enough for CI but ignored unless explicitly committed.
4. Run build, typecheck, tests, audit, pack checks.
