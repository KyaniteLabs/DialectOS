# Dialect Evaluation Harness Implementation Plan

**Goal:** Add deterministic evaluation fixtures and tests that prove dialect prompts/contracts avoid obvious grammar, register, and taboo mistakes before live provider dogfooding.

**Architecture:** Add JSON fixtures for initial dialects (`es-PA`, `es-PR`, `es-MX`, `es-AR`, `es-ES`) plus a test helper that validates semantic context against required/forbidden prompt traits. This is not native output scoring yet; it is a release gate ensuring the prompt and contracts carry the right constraints.

**Tech Stack:** TypeScript, Vitest, JSON fixtures.

---

## Tasks
1. Add fixture schema/types for dialect eval samples.
2. Add fixtures for Panama, Puerto Rico, Mexico, Argentina, Spain.
3. Add tests that verify context includes required traits and excludes forbidden prompt traits.
4. Add docs for native review fixtures and future provider dogfood.
5. Run build, typecheck, tests, audit, and pack checks.
