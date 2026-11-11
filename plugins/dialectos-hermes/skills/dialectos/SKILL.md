---
name: dialectos
description: Localize text into a specific regional Spanish dialect (25 variants) and QA-gate it with the DialectOS Hermes tools instead of producing generic Spanish.
---

# DialectOS (Hermes plugin)

Use when the user wants Spanish for a specific audience (Mexico, Argentina, Spain, Colombia, Puerto Rico, US Hispanic, …), asks to localize Spanish copy/UI strings, or asks which dialect a Spanish text is in. Do **not** use this for non-Spanish localization (German, Japanese, …).

## Workflow

1. **Pick the dialect.** Ask or infer the audience. `dialectos_list_dialects` enumerates codes (`es-MX`, `es-AR`, `es-ES`, …). Default is the plugin's `default_dialect` (es-MX).
2. **Pick formality.** `formal: true` → usted; `false` → tú (or vos for voseo dialects like es-AR). Say which you chose.
3. **Detect** existing Spanish with `dialectos_detect` before rewriting it.
4. **Translate** with `dialectos_translate` (≤ 8000 source chars per call; split long docs by section). Select an explicit `llm`, `deepl`, `libre`, or `mymemory` provider in settings or the call; missing selection and `auto` are refused, with no automatic fallback. This sends text to that provider — don't send secrets or private data unless the user agreed.
5. **QA gate:** always run `dialectos_validate` with both `translated` **and** `source` (the original text). Empty source always fails semantic QA. Fix blocking issues and re-validate before presenting. A pass is not proof of meaning: the checks can pass a flipped negation or a wrong word sense, so compare the meaning against the source yourself before presenting.
6. Present: translation, dialect + formality, and the validate verdict.

## Limits

- Validate accepts translations up to 100000 chars and sources up to 8000 chars via private temporary `.md` files (cleaned after subprocess completion). The pinned v0.3.2 CLI judges code blocks against the source: they must stay byte-identical, including the info string. Do not change the pin silently. Formal/informal flags and hooks remain advisory, not a blocking expected-register contract; no live-provider proof is implied by offline QA.
- Whole files, README/API-docs translation, i18n key diffing, glossaries and certification run via the DialectOS CLI directly (`dialectos translate-readme`, `dialectos i18n …`) — not exposed as Hermes tools.
- Never claim a translation is "certified" from this plugin alone.
