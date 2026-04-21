# Dialect Quality Contract Implementation Plan

**Goal:** Make every supported dialect safer without human babysitting by adding a quality contract that controls evidence confidence, risk, slang/taboo behavior, and fallback policy.

**Architecture:** Add canonical dialect quality contracts to `@espanol/types`, derive prompt policy helpers from them, and include that policy in CLI semantic translation context. Keep it dependency-free and conservative: high-risk or low-evidence dialects should prompt providers toward neutral respectful output instead of fake localization.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest.

---

## Tasks
1. Add failing tests for quality contract coverage and key dialect risk/fallback behavior.
2. Add `dialect-quality.ts` with `DialectQualityContract` for all 25 dialects.
3. Export helpers from `@espanol/types`.
4. Include contract-derived policy guidance in semantic translation context.
5. Add semantic-context tests proving high/medium/heritage behavior.
6. Update docs to mention quality contracts and verified test count.
7. Run build, typecheck, tests, audit, and pack checks.
