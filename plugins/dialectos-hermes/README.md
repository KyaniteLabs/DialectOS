# DialectOS for Hermes

Spanish is not one language to its readers. "Coger el autobús" is ordinary in Madrid and rude in Mexico City. This plugin lets Hermes translate into the variant you mean, from 25 regional variants, and check the result before you send it. It wraps the DialectOS v0.3.2 command-line tool.

## What it adds

- **A dialect brief.** When a message asks for Spanish or names a variant such as `es-AR`, Hermes adds a short brief: pick the variant, translate, then check. It needs a Spanish target ("into Spanish", "a Spanish version", "en argentino"), so a bare mention such as "the Spanish flu" or "LATAM sales" doesn't trigger it, and neither does "don't answer in Spanish". Generic words like "localize" or "i18n" don't trigger it either. This is the `pre_llm_call` hook.
- **Five agent tools.**
  - `dialectos_translate` translates into a variant through the provider you choose.
  - `dialectos_detect` names the variant a Spanish text is written in. It runs offline.
  - `dialectos_validate` checks a translation against its source, offline. It needs the source.
  - `dialectos_list_dialects` lists the 25 variants.
  - `dialectos_learn` offers offline comparisons, a daily tip and a casual quiz with private progress.
  - `dialectos_show` asks an open, enabled Desktop page to show `translate` (Translate or detect), `check`, `dialects`, `by_dialect` or `recent`; an optional `item_id` dialect code such as `es-AR` selects the variant or focuses its row.
- **A slash command.** `/dialectos detect | list | translate | validate | status | learn | quiz | tip | answer | help` does the same from chat. For `validate`, write `<source> :: <translation>`; when the text itself contains ` :: `, the middle separator splits the two. Slash checks go into the same history as the tool. It takes text only: no file paths, no server mode, and no corpus or benchmark commands.
- **A skill.** The bundled `dialectos:dialectos` skill walks the agent through pick, translate and check.
- **A check history.** After each translate, detect, validate or list tool call, a ledger records the verdict. It keeps the tool, the variant, and the pass and issue counts, never the text. This is the `post_tool_call` hook.
- **A DialectOS page.** It lives in the Hermes desktop app (sidebar and ⌘K) and as a tab in the web dashboard. You can detect a variant, translate with an automatic check, check any source and translation pair, browse the variants, and see the check history per variant. It needs Hermes 0.23.0 or later.

## Learn

Learn turns a regional miss into something you can remember. It uses the bundled
834-concept dictionary for 25 Spanish variants, without a model or network call.
A bus is **colectivo** in `es-AR`, **camión** in `es-MX`, **guagua** in `es-CU`
and **autobús** in `es-ES`. Each comparison includes an English gloss and three
to five other variants where the dictionary has them. Register and usage notes
come back with the tool's comparison, including warnings about informal terms.

Try a tip even before your first check:

```text
/dialectos tip es-AR
/dialectos tip es-AR bus
/dialectos quiz es-AR
/dialectos answer es-AR bus colectivo
/dialectos learn stats es-AR
/dialectos learn cards es-AR
```

Answer with the concept id and variant from your quiz; it may be a different
concept from the example above. Spaces, case and accents around an answer do
not affect matching. Explicit dictionary alternates count; another region's
term does not count automatically. With no due cards, the quiz offers the day's
tip as practice, unless you already reviewed that card today and it is not due.
Viewing a tip or quiz never adds a card; answering practice does.

Validation captures regional-term misses and address-form misses automatically,
without changing the QA result. Vocabulary cards contain canonical dictionary
terms. Address cards save only a fixed concept id and variant: the dictionary
does not contain pronoun grammar. Their comparisons use a small standard
written-register guide, which does not cover every community's address choices.
The current v0.3.2 validator emits vocabulary misses; address capture also accepts
`addressForms` reports when supplied by the validator or its integration.

Cards start in box 1, due today. A correct answer moves one box up, up to box 5;
a wrong answer or another validation miss returns it to box 1. The five boxes
use intervals of **0, 1, 3, 7 and 21 days**, counted by UTC date. A card in box 5
stays there after a correct answer. A date-and-variant seed picks the daily tip,
so it is the same across sessions that day. There are no streaks or reminders.
The desktop page and dashboard include a Learn section with the tip, due count
and one keyboard-accessible quiz.

`dialectos_learn` accepts `action: tip | quiz | answer | stats | cards | forget`,
`dialect`, and, for an answer, `concept` and `answer`. `tip` also accepts a
`concept` for a specific comparison. `cards` returns 20 at a time with
`next_offset`; pass it as `offset` to read more. Gateway platforms can read tips,
quizzes, stats and cards. Changing progress needs a local session or the trusted
DialectOS page. To remove a variant's cards, use
`/dialectos learn forget es-AR --confirm` or `action: forget` with `confirm: true`.

**Privacy disclosure:** Learn adds `plugin-data/dialectos/learning.json`, written
atomically with mode **0600**, under the same profile as the verdict ledger. It
saves only concept ids, variant codes, canonical dictionary terms, box numbers
and due dates. It never saves your source text, translations, typed answers or
violation messages. A damaged learning file is kept as a private
`learning.json.corrupt-*` backup before starting fresh. These recovery backups
stay local; delete them yourself when no longer needed. Learn never installs
the CLI: it lazily reads the dictionary from the installed release, caches it,
and explains when that data is missing. Custom CLI commands need the pinned
release dictionary present too.
If the dictionary disappears, forgetting still works when the selected variant
owns every card. Restore the dictionary before forgetting one of several
variants so the remaining terms can be checked before they are rewritten.

The open Desktop page reacts to agent tool calls via local Desktop events: recorded calls refresh its verdict-only history, and `dialectos_show` points to a section or dialect without changing the current route; an older REST response cannot overwrite a live update. The palette command opens the page. Events carry only counts, section names and dialect codes, never source text or translations. With no Desktop client, events are a logged no-op; older Hermes builds without the event bridge still run the tools, but cannot drive the page.

## Install

```bash
hermes plugins install KyaniteLabs/DialectOS/plugins/dialectos-hermes
hermes plugins enable dialectos
```

You need Node 22.13 or later, with `node` on your PATH.

Check that DialectOS appears in the Desktop sidebar or command palette; a person enables the pane in Capabilities -> Plugins, then leaves the page open.

## What it does on your machine

- **It downloads code once.** The first call downloads `https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.2/dialectos-cli-0.3.2.tgz` (about 6 MB, all dependencies bundled). The plugin checks it against a pinned sha256, refuses it on a mismatch, unpacks it to `<HERMES_HOME>/plugin-data/dialectos/cli/0.3.2/` and runs it with `node`. Later calls use that copy and don't touch the network. On a machine without internet, put the tarball in `<HERMES_HOME>/plugin-data/dialectos/` and the plugin uses it instead (the hash is still checked). To run your own copy, set `dialectos_command`, for example to `dialectos` after `pnpm add -g <tarball>`.
- **Translate is the only network call.** Detect, list and validate run offline. Translate sends text only to the provider you name in settings, or, when settings name none, in the tool call: `llm`, `deepl`, `libre` or `mymemory`. If you name none, or name `auto`, it refuses before starting anything, and it never falls back to another provider. When settings name a provider, the agent can't switch to another one. The slash command and the page's Translate button use the provider from settings, and the page sends text only when you press Translate.
- **Keys stay scoped.** The plugin reads provider keys and endpoints only through Hermes's secret scope and passes them only to the DialectOS process. These are `LLM_API_KEY`, `LLM_API_URL`, `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_API_FORMAT`, `DEEPL_AUTH_KEY`, `DEEPL_API_URL`, `LIBRETRANSLATE_URL` and `LIBRETRANSLATE_API_KEY`, plus the switches `ENABLE_MYMEMORY`, `LLM_ALLOW_LOCAL` and `LM_STUDIO_URL`. That process gets a cleaned environment: PATH, HOME, locale, proxy and npm cache settings, plus those keys. It never sees the rest of your environment. MyMemory is used only when `ENABLE_MYMEMORY=1`. A local endpoint such as Ollama needs `LLM_ALLOW_LOCAL=1`, and LM Studio also needs `LM_STUDIO_URL`.
- **Data stays in one folder.** The CLI copy, the cache, the corpus, `qa_ledger.json` and Learn's `learning.json` live in `<HERMES_HOME>/plugin-data/dialectos/`, one per profile. Checks run from the page add the same verdict-only rows, marked `via: page`. Corpus recording is off. Learn stores concept progress only, never text; damaged files get private recovery backups.
- **The page answers anyone who can reach your dashboard.** Its Translate button sends text with your provider keys. Keep the Hermes dashboard on localhost unless you trust everyone who can reach it.
- **Nothing runs in the background.** There is no telemetry and there are no background jobs. The plugin acts only when its hook matches a message or when you call a tool or the slash command.

## Settings

Set these under `plugins.entries.dialectos.settings`.

| Key | Default | What it does |
|---|---|---|
| `dialectos_command` | empty: the verified v0.3.2 copy above | How to run DialectOS. The old `npx` default is read as empty |
| `default_dialect` | `es-MX` | The variant used when none is given |
| `provider` | empty, so Translate is off | `llm`, `deepl`, `libre` or `mymemory`; `auto` is refused |
| `inject_on_spanish` | `true` | Adds the dialect brief to Spanish requests |
| `allow_translate_slash_on_gateway` | `false` | Allows `/dialectos translate` on chat platforms such as Discord |
| `timeout_seconds` | `120` | Time limit for each DialectOS call |

## Known issues

- **Checks see form, not meaning.** The v0.3.2 CLI checks placeholders, links, structure and regional terms. The plugin adds three checks the CLI misses: every number in the source must be in the translation (spelled-out numbers up to twelve count), the translation must not read as English, French, Portuguese or Italian, and it must be at least half the source's length. A translation whose meaning changed, such as a dropped "not" or a reversed claim, still passes. Read the output before you use it.
- **Code blocks must match exactly.** The check fails a translation whose code blocks differ from the source in any byte, including the language tag. Earlier versions (v0.3.1) failed every translation that contained a code block; v0.3.2 fixed that.
- **Free providers are less regional.** MyMemory and LibreTranslate only take generic Spanish (`es`), so the regional wording is applied afterwards. An LLM provider gives better results.
- **The first call is slower** while the plugin downloads and checks DialectOS. Machines without internet need the tarball placed in the data folder, or DialectOS installed and set as `dialectos_command`.
- **Text limits.** Text to translate or detect is capped at 8,000 characters. A translation to check can be up to 100,000. A result that is too large comes back as a size error, never silently cut short.
- **Temporary files.** A check writes the texts to private temporary files in the plugin's data folder and deletes them afterwards, whether the check passes or fails. While the check runs they are plain text in a folder only you can read. If the machine crashes mid-check, a file can be left behind for you to delete.
- **Chat platforms.** `/dialectos translate` works only in the CLI, TUI, desktop app and ACP. Chat platforms, webhooks, the API server, kanban workers and scheduled runs need `allow_translate_slash_on_gateway: true`.
- **Older Hermes.** On Hermes versions before 0.23.0, the hook, tools, slash command and skill load, but the page and dashboard tab don't.
- **Platforms.** Tested on Linux only. macOS and Windows are unverified.

License: Apache-2.0, the same as DialectOS. DialectOS is an independent project by KyaniteLabs and is not endorsed by Nous Research.

The desktop page embeds a subset of the Chakra Petch font, Copyright 2018 The Chakra Petch Project Authors, under the SIL Open Font License 1.1. See [desktop/OFL.txt](desktop/OFL.txt).
