# DialectOS

Spanish regional localization and QA for agents, documentation teams and app developers: choose a dialect/register, translate while protecting structure/glossary/tokens, then inspect quality warnings before shipping. CLI, MCP and a browser demo wrap the same TypeScript packages. It is not proof of native-speaker accuracy or a standards-body certification.

## What exists

- 25 dialect profiles exposed by the actual CLI and an 834-entry bundled dialect dictionary; morphology/voseo, register, idiom, agreement and formatting support.
- Translation provider registry for configured LLM, DeepL, LibreTranslate and opt-in MyMemory, plus caching/circuit-breaker and bulk paths.
- Markdown and locale-JSON processing, glossary/protected tokens, output post-processing and adaptive quality gates; standalone validation can check supplied text without calling a translation provider.
- Evaluation/adversarial/document certification scripts, fixtures and a generated browser demo. README's 205-sample benchmark and paid launch-audit offer are product/reference claims, not independently reproduced quality or a payment/fulfillment backend verified here.

## Bounded proof

Seven workspace packages built; 13 pure lexical-substitution tests passed; CLI listed 25 dialects and validated a synthetic supplied English/Spanish sentence. Dictionary was counted from source. Static demo landing rendered in Chromium with API requests blocked. An initial invocation of library `dist/index.js` produced no CLI output; actual executable is `dist/cli.js`.

No provider/model, paid audit, document overwrite, live translation benchmark or linguistic acceptance was exercised. Validation can report pass even when no dialect-specific concepts were checked (the synthetic result checked zero); read all evidence/coverage, not only its score. See [ARCHITECTURE.md](ARCHITECTURE.md) and [README.md](README.md).
