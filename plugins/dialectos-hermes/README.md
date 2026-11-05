# DialectOS for Hermes (native plugin)

Regional Spanish localization across **25 dialect variants** with QA gates — inside Hermes. Wraps the DialectOS v0.3.1 CLI.

| Surface | What it does |
|---|---|
| `pre_llm_call` | When a message asks for Spanish / an `es-XX` code (not bare localize/i18n), injects a dialect + QA brief (pick variant, translate, validate) |
| `post_tool_call` | Appends `dialectos_*` verdicts (tool, dialect, pass/issue count — **no text**) to a QA ledger |
| `/dialectos detect\|list\|translate\|validate\|status\|help` | Text-only slash; no file paths, `serve`, corpus export or benchmarks. `validate` needs `<source> :: <translated>`. `translate` is refused on gateway platforms unless `allow_translate_slash_on_gateway: true` |
| `dialectos_translate` | Translate to a dialect (network provider) |
| `dialectos_detect` | Offline dialect detection |
| `dialectos_validate` | Offline plain-text QA gate (leakage, formality); **source required**; markdown/fences rejected |
| `dialectos_list_dialects` | The 25 variants |
| Skill `dialectos:dialectos` | Pick → translate → validate workflow |

## Install

```bash
hermes plugins install KyaniteLabs/DialectOS --subdir plugins/dialectos-hermes
hermes plugins enable dialectos
```

Requires **Node ≥ 20** and `npx` on PATH.

## Disclosure

- **Downloads code:** first use runs `npx -y --package=https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.1/dialectos-cli-0.3.1.tgz dialectos` (DialectOS is distributed as GitHub Release tarballs, not on npm). Override with `dialectos_command` (e.g. `dialectos` after `pnpm add -g <tarball>`).
- **Network:** `detect`, `list`, `validate` are offline. `translate` sends the text to the chosen provider: `auto` picks whichever provider you configured (LLM endpoint, DeepL, LibreTranslate, or MyMemory). **With no provider configured, translate returns "No translation providers are currently available"**; detect/validate still work.
- **Secrets / provider activation:** `LLM_API_KEY`, `LLM_API_URL`, `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_API_FORMAT`, `DEEPL_AUTH_KEY`, `DEEPL_API_URL`, `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY`, plus activation/endpoint settings `ENABLE_MYMEMORY`, `LLM_ALLOW_LOCAL`, `LM_STUDIO_URL`, are read only via Hermes secret scope and passed only to the DialectOS child. The child gets a scrubbed env (PATH/HOME/locale/proxy/npm cache + those scoped values), never full `os.environ`. MyMemory only registers when `ENABLE_MYMEMORY=1`; localhost/Ollama endpoints need `LLM_ALLOW_LOCAL=1` (and `LM_STUDIO_URL` when applicable).
- **Local data:** cache, corpus and `qa_ledger.json` live under `<HERMES_HOME>/plugin-data/dialectos/` (per profile). Nothing else is written; corpus recording is off.
- **No telemetry.** No background jobs; nothing runs unless a hook matches or you call a tool/slash.

## Settings (`plugins.entries.dialectos.settings`)

| Key | Default | Notes |
|---|---|---|
| `dialectos_command` | `npx -y --package=<v0.3.1 tgz> dialectos` | CLI prefix |
| `default_dialect` | `es-MX` | `es-XX` |
| `provider` | `auto` | `auto\|llm\|deepl\|libre\|mymemory` |
| `inject_on_spanish` | `true` | pre_llm_call brief |
| `allow_translate_slash_on_gateway` | `false` | gateway safety |
| `timeout_seconds` | `120` | per CLI call |

## Known issues

- First call is slow (tarball download); offline machines need a pre-installed `dialectos`.
- Free providers (MyMemory/Libre) only take base `es`; dialect shaping is then post-processing — configure an LLM provider for best dialect fidelity.
- Input text is capped at 8000 chars per call; successful translations are not silently truncated (oversized results return an explicit size error).
- Validate is plain text only; markdown/code structure QA stays on the DialectOS CLI with `.md` files.
- No Desktop pane or banner/screenshots yet.

License: Apache-2.0 (same as DialectOS).
