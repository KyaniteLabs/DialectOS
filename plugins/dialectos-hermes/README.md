# DialectOS for Hermes

Spanish is not one language to its readers. "Coger el autobús" is ordinary in Madrid and rude in Mexico City. This plugin lets Hermes translate into the variant you mean, from 25 regional variants, and check the result before you send it. It wraps the DialectOS v0.3.2 command-line tool.

## What it adds

- **A dialect brief.** When a message asks for Spanish or names a variant such as `es-AR`, Hermes adds a short brief: pick the variant, translate, then check. Generic words like "localize" or "i18n" don't trigger it. This is the `pre_llm_call` hook.
- **Four agent tools.**
  - `dialectos_translate` translates into a variant through the provider you choose.
  - `dialectos_detect` names the variant a Spanish text is written in. It runs offline.
  - `dialectos_validate` checks a translation against its source, offline. It needs the source.
  - `dialectos_list_dialects` lists the 25 variants.
- **A slash command.** `/dialectos detect | list | translate | validate | status | help` does the same from chat. For `validate`, write `<source> :: <translation>`. It takes text only: no file paths, no server mode, and no corpus or benchmark commands.
- **A skill.** The bundled `dialectos:dialectos` skill walks the agent through pick, translate and check.
- **A check history.** After each DialectOS tool call, a ledger records the verdict. It keeps the tool, the variant, and the pass and issue counts, never the text. This is the `post_tool_call` hook.
- **A DialectOS page.** It lives in the Hermes desktop app (sidebar and ⌘K) and as a tab in the web dashboard. You can detect a variant, translate with an automatic check, check any source and translation pair, browse the variants, and see the check history per variant. It needs Hermes 0.23.0 or later.

## Install

```bash
hermes plugins install KyaniteLabs/DialectOS/plugins/dialectos-hermes
hermes plugins enable dialectos
```

You need Node 20 or later, with `npx` on your PATH.

## What it does on your machine

- **It downloads code.** The first call runs `npx -y --package=https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.2/dialectos-cli-0.3.2.tgz dialectos`. DialectOS ships as GitHub Release tarballs, not on npm. To use an installed copy instead, set `dialectos_command`, for example to `dialectos` after `pnpm add -g <tarball>`.
- **Translate is the only network call.** Detect, list and validate run offline. Translate sends text only to the provider you name in settings or in the tool call: `llm`, `deepl`, `libre` or `mymemory`. If you name none, or name `auto`, it refuses before starting anything, and it never falls back to another provider. The slash command and the page's Translate button use the provider from settings, and the page sends text only when you press Translate.
- **Keys stay scoped.** The plugin reads provider keys and endpoints only through Hermes's secret scope and passes them only to the DialectOS process. These are `LLM_API_KEY`, `LLM_API_URL`, `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_API_FORMAT`, `DEEPL_AUTH_KEY`, `DEEPL_API_URL`, `LIBRETRANSLATE_URL` and `LIBRETRANSLATE_API_KEY`, plus the switches `ENABLE_MYMEMORY`, `LLM_ALLOW_LOCAL` and `LM_STUDIO_URL`. That process gets a cleaned environment: PATH, HOME, locale, proxy and npm cache settings, plus those keys. It never sees the rest of your environment. MyMemory is used only when `ENABLE_MYMEMORY=1`. A local endpoint such as Ollama needs `LLM_ALLOW_LOCAL=1`, and LM Studio also needs `LM_STUDIO_URL`.
- **Data stays in one folder.** The cache, the corpus and `qa_ledger.json` live in `<HERMES_HOME>/plugin-data/dialectos/`, one per profile. Checks run from the page add the same verdict-only rows, marked `via: page`. Corpus recording is off, and nothing else is written.
- **Nothing runs in the background.** There is no telemetry and there are no background jobs. The plugin acts only when its hook matches a message or when you call a tool or the slash command.

## Settings

Set these under `plugins.entries.dialectos.settings`.

| Key | Default | What it does |
|---|---|---|
| `dialectos_command` | the v0.3.2 `npx` command above | How to run DialectOS |
| `default_dialect` | `es-MX` | The variant used when none is given |
| `provider` | empty, so Translate is off | `llm`, `deepl`, `libre` or `mymemory`; `auto` is refused |
| `inject_on_spanish` | `true` | Adds the dialect brief to Spanish requests |
| `allow_translate_slash_on_gateway` | `false` | Allows `/dialectos translate` on chat platforms such as Discord |
| `timeout_seconds` | `120` | Time limit for each DialectOS call |

## Known issues

- **Checks are advisory.** The v0.3.2 checks look at placeholders, structure and regional terms. They can pass a translation whose meaning changed, such as a dropped "not" or the wrong sense of a word. Read the output before you use it.
- **Code blocks must match exactly.** The check fails a translation whose code blocks differ from the source in any byte, including the language tag. Earlier versions (v0.3.1) failed every translation that contained a code block; v0.3.2 fixed that.
- **Free providers are less regional.** MyMemory and LibreTranslate only take generic Spanish (`es`), so the regional wording is applied afterwards. An LLM provider gives better results.
- **The first call is slow** while `npx` downloads DialectOS. Machines without internet need DialectOS installed and set as `dialectos_command`.
- **Text limits.** Text to translate or detect is capped at 8,000 characters. A translation to check can be up to 100,000. A result that is too large comes back as a size error, never silently cut short.
- **Temporary files.** A check writes the texts to private temporary files in the plugin's data folder and deletes them afterwards, whether the check passes or fails. While the check runs they are plain text in a folder only you can read. If the machine crashes mid-check, a file can be left behind for you to delete.
- **Chat platforms.** `/dialectos translate` is refused on gateway platforms unless you set `allow_translate_slash_on_gateway: true`.
- **Older Hermes.** On Hermes versions before 0.23.0, the hook, tools, slash command and skill load, but the page and dashboard tab don't.
- **Platforms.** Tested on Linux only. macOS and Windows are unverified.

License: Apache-2.0, the same as DialectOS. DialectOS is an independent project by KyaniteLabs and is not endorsed by Nous Research.
