# Red Team Follow-Up Issue Tickets

Source: `audits/adversarial-2026-04-01/REDTEAM-REPORT.md`

## Ticket 1
- Title: `translate-api-docs`: add explicit partial-failure policy flag
- Severity: SEV-2 (high)
- Type: Reliability / Safety
- Suggested owner: CLI maintainer
- Goal:
  - Add a CLI option like `--failure-policy strict|allow-partial` (default `strict`).
  - Ensure command semantics are explicit and operator-controlled for degraded provider cases.

## Ticket 2
- Title: Add checkpoint hash invalidation regression tests
- Severity: SEV-2 (high)
- Type: Test coverage / Data correctness
- Suggested owner: CLI maintainer
- Goal:
  - Add tests proving resume does not reuse stale checkpoints after source changes.
  - Cover both `translate-readme` and `translate-api-docs`.

## Ticket 3
- Title: Add adversarial fixture corpus to CLI test suite
- Severity: SEV-3 (medium)
- Type: Quality / Regression prevention
- Suggested owner: QA + CLI maintainer
- Goal:
  - Add a minimal fixture pack under `packages/cli/src/__tests__/fixtures`.
  - Include markdown injection, token-lock stress, mixed-format docs, and noisy text.
  - Wire into repeatable CI checks.
