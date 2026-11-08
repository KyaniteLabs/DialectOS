# DialectOS architecture

```text
CLI / MCP / demo -> types/security + markdown/locale parsing -> provider registry
 -> configured translation provider -> ordered dialect output pipeline -> quality report
supplied source/translation -> standalone validation -> scores/issues/coverage
```

Seven packages divide dialect/schema/dictionary data, security/path/rate/error handling, locale IO, Markdown structure, providers, CLI orchestration and MCP integration. CLI library exports (`dist/index.js`) and executable (`dist/cli.js`) are distinct. Thin scripts import built CLI modules and may trigger builds if absent.

[Provider factory](packages/providers/src/factory.ts) registers only configured endpoints/models/keys; MyMemory is opt-in. [Output pipeline](packages/providers/src/pipeline/dialect-output-pipeline.ts) fixes lexical terms, untranslated words, voseo, agreement, punctuation, accentuation, capitalization, typography and restored sentinels in a defined order. [Quality gates](packages/providers/src/quality-gates.ts) detect rather than fix problems, and vary by model tier. [Validation](packages/cli/src/commands/validate.ts) reads supplied text/files and reports structure, glossary, token, semantic, lexical and output-judge checks. [Demo server](scripts/demo-server.mjs) serves allowlisted/static docs and API routes; static demo rendering is not a provider-backed translation receipt.

## Risks / failure modes

- Provider selection controls outbound content, credential use and spend. Never silently substitute a paid/remote provider; local endpoint configuration does not itself establish model correctness.
- Post-processing can introduce meaning/grammar errors. Adaptive gates, similarity heuristics and dialect terms cannot cover every context; a pass with zero checked concepts does not establish dialect fidelity. Preserve native-speaker review for consequential content.
- Locale/document writes and bulk output can overwrite user artifacts; path/security checks and explicit output scope matter. Generated demo data and mocked evals must remain distinct from live translation evidence.
- Circuit/rate/provider failures, malformed locale files and lost structure/tokens must remain visible. A “certify” command/report name is not external accreditation or commercial service acceptance.

## Docs proof

Purpose/rules, package boundaries, factory/pipeline/gate/validation/demo source inspected. Build, 13 lexical tests, real dialect listing and synthetic supplied-text validation passed; static demo screenshot captured, API blocked. Protected default Corepack cache was read-only; isolated scratch Corepack/pnpm storage used. No provider call, model, live certification or file overwrite/deletion suite. Independent linguistic/user acceptance remains open; revert docs for rollback.
