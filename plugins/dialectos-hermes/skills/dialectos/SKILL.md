---
name: dialectos
description: Localize text into a specific regional Spanish dialect (25 variants) and QA-gate it with the DialectOS Hermes tools instead of producing generic Spanish.
---

# DialectOS (Hermes plugin)

Use when the user wants Spanish for a specific audience (Mexico, Argentina, Spain, Colombia, Puerto Rico, US Hispanic, …), asks to localize copy/UI strings, or asks which dialect a Spanish text is in.

## Workflow

1. **Pick the dialect.** Ask or infer the audience. `dialectos_list_dialects` enumerates codes (`es-MX`, `es-AR`, `es-ES`, …). Default is the plugin's `default_dialect` (es-MX).
2. **Pick formality.** `formal: true` → usted; `false` → tú (or vos for voseo dialects like es-AR). Say which you chose.
3. **Detect** existing Spanish with `dialectos_detect` before rewriting it.
4. **Translate** with `dialectos_translate` (≤ 8000 chars per call; split long docs by section). This sends text to the configured provider — don't send secrets or private data unless the user agreed.
5. **QA gate:** always run `dialectos_validate` on the result (pass `source` when you have it). Fix blocking issues and re-validate before presenting.
6. Present: translation, dialect + formality, and the validate verdict.

## Limits

- Whole files, README/API-docs translation, i18n key diffing, glossaries and certification run via the DialectOS CLI directly (`dialectos translate-readme`, `dialectos i18n …`) — not exposed as Hermes tools in v0.1.0.
- Never claim a translation is "certified" from this plugin alone.
