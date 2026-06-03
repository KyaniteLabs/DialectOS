# AGENTS.md — DialectOS

Agent-focused guidance for the DialectOS Spanish dialect translation system.

## Public Agent Skill
- `skills/dialectos/SKILL.md` is the public skill for this repo.
- Invoke `$dialectos` in compatible agent hosts for regional Spanish localization, markdown/API-doc preservation, locale JSON validation, glossary enforcement, formality checks, gender-neutral language, and launch certification.
- Keep the skill aligned with `packages/cli/README.md`, `packages/mcp/README.md`, provider setup, and certification commands when those surfaces change.

## Project Structure

pnpm monorepo with 7 workspace packages under `packages/`:

| Package | Role | Key exports |
|---------|------|-------------|
| `@dialectos/types` | Types, schemas, dictionary data | `SpanishDialect`, `DICTIONARY`, `VERB_CONJUGATIONS` |
| `@dialectos/security` | Rate limiting, path validation, error sanitization | `RateLimiter`, `validateFilePath` |
| `@dialectos/locale-utils` | Locale file read/write, flatten, diff | `readLocaleFile`, `writeLocaleFile`, `diffLocales` |
| `@dialectos/markdown-parser` | Markdown structure preservation | `parseMarkdown`, `reconstructMarkdown` |
| `@dialectos/providers` | Translation providers + post-processing | `LLMProvider`, `createProviderRegistry`, `BulkTranslationEngine` |
| `@dialectos/cli` | CLI commands, evaluation scripts, web demo | `dialectos` binary |
| `@dialectos/mcp` | MCP server for IDE integration | `createServer` |

Scripts in `scripts/` are thin Node CLIs that import from `packages/cli/dist/`.

## Build

```bash
pnpm install
pnpm build        # tsc for all 7 packages
pnpm test         # vitest across all packages + static checks
```

**Important:** Scripts that import from `dist/` will auto-trigger `pnpm build` if dist is missing (via `scripts/lib/ensure-built.mjs`).

## Testing

- Unit tests: `vitest` per package
- Script integration tests: spawn actual child processes (slow — 5+ min for full CLI suite)
- Static checks: `node --test docs/__tests__/*.test.mjs scripts/__tests__/*.test.mjs`

To run only fast CLI tests (skip script spawning):
```bash
cd packages/cli && npx vitest run src/__tests__/eval-harness.test.ts src/__tests__/provider-factory.test.ts src/__tests__/output-judge.test.ts
```

## Key Patterns

### Provider Factory
Always use `createProviderRegistry()` to get providers. Don't instantiate `LLMProvider` directly unless injecting a custom pipeline.

### Evaluation Scripts
All eval logic lives in `packages/cli/src/lib/eval-harness.ts`. Scripts in `scripts/` are thin wrappers. If you modify mock translation, term checking, or live provider setup, change it in `eval-harness.ts` — not in individual scripts.

### Dictionary Data
The 834-entry dialectal dictionary lives in `packages/types/src/dialectal-dictionary.json` (data) and `packages/types/src/dialectal-dictionary.ts` (types + runtime loader). Linguist contributors should edit the JSON, not the TypeScript.

### Result Type
`Result<T, E>` from `@dialectos/types` is the preferred pattern for explicit error handling. Use `ok(value)` and `err(error)` helpers. Avoid silent catch blocks.

## Conventions

- **Language:** TypeScript, target ES2022, module Node16
- **Imports:** Use `.js` extensions for all local imports (required by Node16 resolution)
- **JSON imports:** Use `fs.readFileSync` + `JSON.parse` at runtime. ESM import attributes (`with { type: "json" }`) are not supported by the current tsconfig (`module: Node16`).
- **Scripts:** Keep them as thin CLIs. Shared logic goes into `packages/cli/src/lib/`.
- **Tests:** Name test files `*.test.ts`. Use vitest's `describe`/`it`/`expect`.

## Common Pitfalls

1. **Forgetting `pnpm build` after type changes** — Scripts import from `dist/`. The `ensure-built.mjs` helper catches this, but running tests directly with vitest on source doesn't.
2. **Modifying `dialectal-dictionary.ts` instead of `.json`** — The data is in JSON now. The `.ts` file only exports types and the runtime loader.
3. **Adding duplicate eval logic in scripts** — Use `eval-harness.ts`.
4. **Breaking mock translator ordering** — Word-level replacements (e.g., `password` → `contraseña`) must happen before sentence-level patterns that depend on them.

<!-- EMPOWER_ORCHESTRATOR:START -->
## Empower the Orchestrator

This repository is governed by the Empower Orchestrator law. Every top-level/orchestrator agent session is an audition to improve the system, not only finish the current task.

When you notice a repeatable task done 3+ times or a recurring agent failure mode, consider shipping the smallest durable artifact that prevents the repetition: a tool, skill, slash command, hook, guardrail, memory entry, test, verifier, or doctrine doc.

This applies to top-level/orchestrator sessions. Background workers execute their assigned slice and do not independently widen scope.

Before dispatching automation or creating a durable system change, state the four-question blast-radius check in chat:

1. Scale: one file/workspace/all sessions?
2. Severity: minor friction/broken workflow/data loss or leaked content?
3. Reversibility: single revert/manual cleanup/surgery?
4. Predictability: bounded failure mode/guessing/unknown?

All green permits auto mode. Any yellow requires inline human approval. Any red means do not dispatch; do the work inline or escalate.

Worker discipline: isolated worktree/sandbox, one artifact equals one commit/change unit, verify before commit, register through the target tool's native discovery surface, and never write outside the assigned scope.

Success line: “I noticed X, found a better way. The system just got an upgrade.”

Full recipe: `docs/agent-law/empower-orchestrator.md`.
<!-- EMPOWER_ORCHESTRATOR:END -->
