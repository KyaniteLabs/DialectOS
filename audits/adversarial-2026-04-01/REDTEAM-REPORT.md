# DialectOS Full Adversarial Audit Report

Date: 2026-04-01  
Repo: `DialectOS-latest` (main, latest local state)

## Scope executed

- Security/abuse red-team testing across CLI and provider boundaries.
- Translation-quality adversarial testing on licensed corpus + DialectOS repo docs.
- Reliability/comorbidity testing for provider failures and checkpoint resume behavior.
- Upstream fixes implemented and re-tested end to end.

## Corpus and licensing

See `audits/adversarial-2026-04-01/corpus/LICENSE-CATALOG.md`.

Corpus used:
- `declaration-excerpt.md` (U.S. federal public domain source excerpt)
- `constitution-excerpt.md` (U.S. federal public domain source excerpt)
- `nasa-apollo11-excerpt.md` (NASA public-domain-basis excerpt)
- `synthetic-adversarial-pack.md` (synthetic adversarial cases)
- `token-lock-stress.md` (synthetic token integrity cases)

## Findings (ranked)

### High

1. `translate-api-docs` false-green behavior on provider failure.
- Symptom before fix: command exited `0` and printed quality even when section translations failed.
- Impact: CI and operators can accept incomplete translations as success.
- Repro (before fix):
  - Set bad provider endpoint and run `translate-api-docs`.
  - Observed `code=0` despite section-level failures.

2. Checkpoint resume stale-output risk.
- Symptom before fix: resume could reuse stale checkpoint after source document changed.
- Impact: output drift from current source without warning.
- Repro (before fix):
  - Translate once with checkpoint, edit source, rerun with `--resume`.
  - Output did not contain new source token.

### Medium

3. `translate` command and Libre compatibility.
- Symptom before fix: plain `translate` sent dialect as target language and got `BAD REQUEST`.
- Impact: one major CLI capability failed under Libre provider.

### Low / expected

4. Strict structure validation blocks unsafe HTML/script content.
- Expected strict-mode fail on synthetic injection file.
- Confirms guard effectiveness.

## Fixes implemented

1. Canonical target language for plain translate.
- File: `packages/cli/src/commands/translate.ts`
- Change: provider target language normalized to `es`; dialect kept in options.

2. Checkpoint source-hash integrity.
- Files:
  - `packages/cli/src/lib/checkpoint.ts`
  - `packages/cli/src/commands/translate-readme.ts`
  - `packages/cli/src/commands/translate-api-docs.ts`
- Change:
  - add `sourceHash` to checkpoint schema,
  - compute SHA-256 of source content,
  - only reuse checkpoint when path + hash match.

3. Hard-fail `translate-api-docs` when section translations fail.
- File: `packages/cli/src/commands/translate-api-docs.ts`
- Change:
  - track section-level translation failures,
  - throw non-zero error in strict flow if failures > 0.

## Security and abuse checks run

- Path traversal blocked (`../../../etc/passwd`) with explicit error.
- Outside-allowed-directory blocked with explicit error.
- Error sanitization check: API-key-like secret not leaked in provider failure output.
- Strict structure validator caught injected tags (`script`, `g`) as designed.
- Token/glossary lock stress maintained `100%` integrity under strict mode.

## Quality results

Quality matrix artifact: `audits/adversarial-2026-04-01/quality-matrix.json`

Observed on corpus + repo docs:
- strict translation pass rate: `100%`
- token integrity: `100%`
- glossary fidelity: `100%`
- structure integrity: `pass`

## Final regression and dogfood status

Final matrix artifact: `audits/adversarial-2026-04-01/final-dogfood-matrix.json`

Final status:
- `all_green: true`

Validated capabilities:
- monorepo build/test,
- `translate`,
- `translate-readme` strict,
- `translate-api-docs` strict and bad-provider fail semantics,
- checkpoint/resume invalidation on source change,
- dialect and glossary command surfaces,
- i18n command family behavior (including expected non-zero semantics for missing keys).

## Remaining recommendations

- Add an explicit CLI flag to control `translate-api-docs` partial-failure policy (`strict|allow-partial`), defaulting to strict.
- Add a dedicated unit test for checkpoint hash invalidation in CLI tests.
- Add a small adversarial corpus fixture set under `packages/cli/src/__tests__/fixtures` for long-term regression guarding.
