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

## Learn, when it fits

After a regional-term or address-form validate miss, first fix and present the
requested translation. Then, at most once per conversation session, offer one
casual invitation: “Want a quick regional word tip or a one-question quiz?”
Treat a decline or silence as the end of the invitation for that session. Skip
the invitation when the user is rushing, has declined learning, or has already
seen it this session. Track that choice only in conversation context.

When the user opts in, use `dialectos_learn` with `action: tip` or `action: quiz`
and their target `dialect`. A tip may name the missed `concept`. For a quiz,
ask its returned question, then submit `action: answer` with the quiz's exact
`concept`, `dialect` and their typed `answer`. Show the canonical term and one
contrast; keep it brief. Learning runs offline and saves only concept progress,
never the translation or answer. If the dictionary is unavailable, state that
briefly and return to the user's task. Gateway chats allow reading only; grade
answers in a local session or the DialectOS page. Forget requires the user's
explicit request and `confirm: true`.

Use `dialectos_show` to change the section in an open Desktop page: `translate` (Translate or detect), `check`, `dialects`, `by_dialect` or `recent`; optionally pass `item_id: "es-AR"` (a 5-character dialect code) to select the variant or focus its row, including the most recent matching call in Recent. Use the Desktop palette command to open the page.

Check that DialectOS appears in the Desktop sidebar or command palette; a person enables the pane in Capabilities -> Plugins, then opens the page and leaves it open when using `dialectos_show`.

Tool calls refresh the open page's verdict-only history through local events; `dialectos_show` asks it to change section without confirming delivery, and Hermes builds without the event bridge keep the tools working without page control.

## Limits

- Validate accepts translations up to 100000 chars and sources up to 8000 chars via private temporary `.md` files (cleaned after subprocess completion). The pinned v0.3.2 CLI judges code blocks against the source: they must stay byte-identical, including the info string. Do not change the pin silently. Formal/informal flags and hooks remain advisory, not a blocking expected-register contract; no live-provider proof is implied by offline QA.
- Whole files, README/API-docs translation, i18n key diffing, glossaries and certification run via the DialectOS CLI directly (`dialectos translate-readme`, `dialectos i18n …`) — not exposed as Hermes tools.
- Never claim a translation is "certified" from this plugin alone.
