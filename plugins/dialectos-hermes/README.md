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
- **Network:** `detect`, `list`, `validate` are offline. `translate` sends text only to an explicitly selected provider (`llm`, `deepl`, `libre`, or `mymemory`), supplied in settings or the tool call. Missing selection and `auto` are refused before spawning; there is no automatic provider fallback. Slash translation requires the provider setting. Detect/validate still work without a provider.
- **Secrets / provider activation:** `LLM_API_KEY`, `LLM_API_URL`, `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_API_FORMAT`, `DEEPL_AUTH_KEY`, `DEEPL_API_URL`, `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY`, plus activation/endpoint settings `ENABLE_MYMEMORY`, `LLM_ALLOW_LOCAL`, `LM_STUDIO_URL`, are read only via Hermes secret scope and passed only to the DialectOS child. The child gets a scrubbed env (PATH/HOME/locale/proxy/npm cache + those scoped values), never full `os.environ`. MyMemory only registers when `ENABLE_MYMEMORY=1`; localhost/Ollama endpoints need `LLM_ALLOW_LOCAL=1` (and `LM_STUDIO_URL` when applicable).
- **Local data:** cache, corpus and `qa_ledger.json` live under `<HERMES_HOME>/plugin-data/dialectos/` (per profile). Nothing else is written; corpus recording is off.
- **No telemetry.** No background jobs; nothing runs unless a hook matches or you call a tool/slash.

## Settings (`plugins.entries.dialectos.settings`)

| Key | Default | Notes |
|---|---|---|
| `dialectos_command` | `npx -y --package=<v0.3.1 tgz> dialectos` | CLI prefix |
| `default_dialect` | `es-MX` | `es-XX` |
| `provider` | empty (translation disabled) | Explicit `llm\|deepl\|libre\|mymemory`; `auto` refused |
| `inject_on_spanish` | `true` | pre_llm_call brief |
| `allow_translate_slash_on_gateway` | `false` | gateway safety |
| `timeout_seconds` | `120` | per CLI call |

## Known issues

- First call is slow (tarball download); offline machines need a pre-installed `dialectos`.
- Free providers (MyMemory/Libre) only take base `es`; dialect shaping is then post-processing — configure an LLM provider for best dialect fidelity.
- Source/detection input is capped at 8000 chars; validation accepts translated text up to 100000 chars (`MAX_OUT`). Successful translations are not silently truncated; oversized tool/slash results return an explicit size error.
- Validate is plain text only. The pinned v0.3.1 output judge rejects code fences unconditionally, including `.md` file mode; file-mode structure checking does not bypass that rejection. Fenced-document QA is not supported by this workflow.
- `/dialectos list` renders all 25 code/name pairs; the agent list tool retains full metadata.
- Validation uses inline CLI arguments; OS byte limits can reject very large Unicode inputs even below the character cap, with an explicit startup error.
- No Desktop pane or banner/screenshots yet.

License: Apache-2.0 (same as DialectOS).
