# Semantic Dialect Context Implementation Plan

**Goal:** Stop relying on word-level replacement alone by giving translation providers explicit semantic context: domain, intent, register, and dialect style guidance.

**Architecture:** Add a dependency-free CLI semantic-context module. It classifies text into domain/intent/register signals, retrieves dialect metadata, and builds provider context strings that instruct providers to preserve meaning over literal word substitution. Thread this context through plain text, README, and API-doc translation paths. Add tests for classifier behavior and command propagation.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, existing provider interfaces.

---

## Tasks
1. Add failing tests for semantic domain/intent/register context generation.
2. Add failing tests that `translate` and `translate-readme` pass context to providers.
3. Implement `packages/cli/src/lib/semantic-context.ts`.
4. Thread context into `translate`, `translate-readme`, and `translate-api-docs` provider options.
5. Update docs to describe semantic context guidance honestly.
6. Run build, typecheck, tests, audit, and pack checks.
