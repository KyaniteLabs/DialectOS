# DialectOS v0.1.0-rc1 Release Candidate Report

Date: 2026-04-22
Commit base: `51922ac` plus this report branch
Status: **RC approved for tagging after this report lands**

## Launch decision

**Decision: GO for `v0.1.0-rc1`.**

DialectOS has passed:

- unit/integration suite
- package allowlist checks
- low-severity npm audit
- basic 25-dialect certification
- expanded 125-sample adversarial certification
- long-document certification for README/API-doc/locale JSON flows
- local LM Studio certification
- Z.ai cloud model certification via Anthropic-compatible API

## Recommended model policy

| Use case | Recommendation | Evidence |
| --- | --- | --- |
| Default cloud launch | `glm-4.5-air` | Passed basic cert, expanded adversarial cert, and long-document cert with zero failures. Fastest cloud cert observed. |
| Higher-confidence cloud option | `glm-5.1` | Passed full basic 25-dialect cert with zero failures/warnings. |
| Alternate cloud option | `glm-4.7` | Passed full basic 25-dialect cert with zero failures/warnings. |
| Local/offline mode | `qwen3.5-9b` via LM Studio | Passed basic cert and expanded adversarial cert with zero failures/warnings. |
| Local high-capability mode | `qwen3.6-35b-a3b` via LM Studio | Passed targeted fixes and adversarial subset; slower, with one transient provider error observed/recovered on retry. |

## Final verification commands

Run on current main before this report branch:

```bash
pnpm build
pnpm -r exec tsc --noEmit
pnpm test
pnpm audit --audit-level low
npm pack --dry-run guard for all packages
```

Results:

| Check | Result |
| --- | --- |
| `pnpm build` | pass |
| `pnpm -r exec tsc --noEmit` | pass |
| `pnpm test` | pass, 693 tests |
| `pnpm audit --audit-level low` | pass |
| npm pack dry-run guard | pass, no test/fixture artifacts packed |

## Certification matrix

See `model-matrix.json` in this directory for machine-readable summaries.

| Certification | Result | Artifact |
| --- | --- | --- |
| GLM 5.1 basic 25-dialect cert | 27/27 pass, 0 warnings | `/tmp/dialectos-zai-glm51-full/results.json` |
| GLM 4.7 basic 25-dialect cert | 27/27 pass, 0 warnings | `/tmp/dialectos-zai-glm47-full/results.json` |
| GLM 4.5 Air basic 25-dialect cert | 27/27 pass, 0 warnings | `/tmp/dialectos-zai-glm45air-full/results.json` |
| GLM 4.5 Air expanded adversarial cert | 125/125 pass, 0 warnings | `/tmp/dialectos-expanded-adversarial-glm45air-v2/results.json` |
| GLM 4.5 Air long-document cert | 7/7 pass | `/tmp/dialectos-doc-cert-cloud-glm45air-final/results.json` |
| qwen3.5-9b basic cert | 27/27 pass, 0 warnings | `/tmp/dialectos-certify-qwen35-9b-final/results.json` |
| qwen3.5-9b expanded adversarial cert | 125/125 pass, 0 warnings | `/tmp/dialectos-expanded-adversarial-qwen35-9b-v2/results.json` |
| qwen3.6-35b targeted fix cert | 2/2 pass | `/tmp/dialectos-certify-qwen36-gq-mx/results.json` |
| qwen3.6-35b adversarial subset | 11/11 pass | `/tmp/dialectos-adversarial-qwen36/results.json` |
| Mock expanded adversarial cert on current main | 125/125 pass | `/tmp/dialectos-main-expanded-adversarial-final/results.json` |
| Mock document cert on current main | 7/7 pass | `/tmp/dialectos-main-doc-cert-final/results.json` |

## Known limitations / non-blockers

1. **Long-document live cert was run for GLM 4.5 Air only.**
   - GLM 5.1 and GLM 4.7 passed basic cert, but not the live document cert in this run.
   - Non-blocking because GLM 4.5 Air is the recommended default.

2. **qwen3.6 full monolithic runs are too slow for the old `dialect:eval` shape.**
   - This is why `dialect:certify` exists.
   - qwen3.6 passed targeted fixes and adversarial subset; use incremental cert for future qwen3.6 tests.

3. **Expanded adversarial suite is still finite.**
   - It covers 125 samples across 25 dialects, but not every false friend, domain, or document structure.
   - Future hardening should add domain packs: legal, medical, finance, education, e-commerce, gaming, government.

4. **No semantic judge scoring yet.**
   - Current gates are deterministic and strong for known traits, but they do not fully judge naturalness or deep semantic adequacy.
   - A future LLM-as-judge or bilingual embedding rubric can add another quality layer.

5. **Live cloud credentials must be passed through environment/session configuration.**
   - Do not inline secrets in scripts/docs.

## Release instructions

After this report lands on `main`:

```bash
git tag v0.1.0-rc1
git push origin v0.1.0-rc1
```

Then publish packages/docs if desired.

## Verdict

**DialectOS is ready for `v0.1.0-rc1`.**

Recommended launch posture:

- Default provider: `llm`
- Default cloud model recommendation: `glm-4.5-air`
- Premium/safer cloud option: `glm-5.1`
- Local/offline recommendation: `qwen3.5-9b` via LM Studio
