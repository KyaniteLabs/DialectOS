# Changelog

All notable changes to DialectOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Hermes plugin 0.3.0 lets the agent drive the Desktop page.** Recorded tool calls refresh the verdict-only history through local Desktop events, and `dialectos_show` opens a section and optionally focuses a dialect code. Live events take precedence over an older REST response. Events carry counts, section names and dialect codes only; tools still work on Hermes builds without the event bridge. The skill and slash status explain that a person enables the pane in Capabilities -> Plugins.
- **Hermes plugin 0.2.2 ships the Chakra Petch font license** (`desktop/OFL.txt`) for the font its desktop page embeds. Its README says the page's Translate button answers anyone who can reach the dashboard, and that DialectOS is not endorsed by Nous Research.

### Fixed

- **The Hermes plugin no longer downloads DialectOS on every call.** The old default ran `npx --package=<release URL>`, which fetched the 6 MB tarball on each call and failed after about 70 seconds without a network, so "detect, list and validate run offline" was not true. The plugin now downloads the v0.3.2 tarball once, refuses it unless it matches a pinned sha256, unpacks it under `plugin-data/dialectos/cli/` and runs it with `node`. A tarball placed in the data folder installs it without internet. A saved copy of the old `npx` default is read as the new default. The docs now say Node 22.13, which the CLI needs.
- **`dialectos_validate` no longer passes French, changed numbers or a mostly missing translation.** The CLI passed all three. The plugin now blocks a translation that drops or changes a number from the source, reads as English, French, Portuguese or Italian, or is under half the source's length. The page says "Passed the form checks (meaning not checked)", because a reversed claim still passes.
- **The agent could switch the Hermes plugin's translate provider.** With `llm` in settings, a `dialectos_translate` call that named `mymemory` sent the text to MyMemory. The setting now wins; the call's `provider` is used only when settings name none.
- **`/dialectos translate` treated unnamed and scheduled sessions as local.** A gateway session that named no platform, and cron runs, could translate from the slash command. Now only the CLI, TUI, desktop app and ACP count as local; everything else needs `allow_translate_slash_on_gateway`.
- **The dialect brief came in for "the Spanish flu".** Any mention of Spanish or LATAM added the brief, including "do not answer in Spanish", while "en argentino" and "Castilian" were missed. The brief now needs a Spanish target and skips refusals.
- **`/dialectos status` crashed on a damaged ledger, and slash `validate` split code like `std :: move` at the wrong place.** Status now shows an empty history, validate splits at the middle ` :: `, and slash checks are recorded in the same history as the tool.
- **CI never ran the plugin against the real CLI.** GitHub CI now builds the CLI and runs the offline validate matrix through it.

### Changed

- **Hermes plugin 0.2.1 runs the v0.3.2 CLI.** The plugin now downloads the v0.3.2 release tarball instead of v0.3.1, so translations that contain code blocks pass the check when the blocks match the source. Its README, tool descriptions and bundled skill drop the "fix not yet released" notes.

## [0.3.2] - 2026-11-11

### Fixed

- **Adjectives kept the old noun's gender after a swap:** "El ordenador está listo" became "La computadora está listo". The adjective after a linking verb (*es*, *está*, *son*, *parece*…) now follows the new noun. Adjectives placed right after the noun are left alone, because the next word may be a verb.
- **MCP `manage_dialect_variants` left *vosotros* in Latin American output** while the CLI changed it. Both now turn *vosotros/vosotras* into *ustedes* and *vuestro(s)/vuestra(s)* into *su(s)*; the CLI used to miss *vosotras* and the feminine possessives. Verb endings (*tenéis*) are not conjugated.
- **The browser demo ran a word table, not the engine:** it now ships the same lexical substitution the CLI and MCP server use (bundled with esbuild into `docs/dialectos-engine.js`, about 58 KB gzipped), and lists what changed by diffing the words, so agreement fixes show up.
- **"The first MCP server for Spanish dialects":** nothing backs "first", so the README, the site's structured data and the launch kit now say "an MCP server built for Spanish dialects".

- **Dictionary words lost their accents and ñ:** 404 dictionary terms were stored without them (`bano`, `aplicacion`, `cunada`), so substitutions wrote misspelled Spanish and `papa` (potato) stood in for `papá` (father). The terms are restored and checked against a Spanish spelling dictionary. *Guagua*, the standard word for bus in Cuba, Puerto Rico and the Dominican Republic, and *camión* in Mexico are now marked neutral rather than informal.
- **Word swaps changed the meaning or tone of a sentence:** "El padre de Juan llegó" (es-MX) became "La papa…", and "Tengo un hermano" (es-VE) became "Tengo una mano". A swap no longer makes text more casual (neutral to slang), and when a word has several senses it is swapped only if one sense clearly dominates; otherwise it is left alone ("guagua" can be a bus or a baby).
- **Noun gender:** `día` is masculine, and `papá`/`mamá` are told apart from `papa` (potato), so article fixes after a swap no longer write "la día" or "la papá".
- **Register, voseo, gender-neutral and grammar checks missed accented words (2026-11-10 roast, item 10):** their `\b` regexes stopped at accents, so *tú*, *está* and *bebé* went unseen. They now use Unicode word boundaries.
  - `check_formality` no longer flags *son*, *van*, *tienen* or *está* as formal; only *usted*/*ustedes* count as formal.
  - `apply_gender_neutral` (descriptive) turns "Hola a todos" into "Hola a todas y todos", not "todas y todos y todos". It keeps the original casing, and a second run changes nothing.
  - The voseo adapter leaves quoted speech alone and moves the pronoun with its verb: "Tú tienes" becomes "Vos tenés", never "tú tenés". *Para ti* and *contigo* become *para vos* and *con vos*; *TI* (IT) and possessive *tu* are untouched.
  - The grammar detector no longer reads "Le dije la verdad" as leísmo or vosotros, or nouns like *verdad*, *pared* and *usted* as vosotros imperatives.
  - The semantic score no longer marks short UI strings like "Welcome" → "Bienvenido" as low quality just because they start with a capital letter.
- **The leísmo prompt rule told the model to use *lo* for a female direct object.** It now says *la* for a female direct object and *lo* for a masculine thing.
- **Circuit breaker double-counting and stolen half-open probe (2026-11-10):** when a provider owns its circuit breaker (DeepL, LLM, LibreTranslate, MyMemory), `ProviderRegistry` shared it but still claimed the half-open probe in `isAvailable()`/`getAuto()` and recorded every outcome a second time. A recovered backend could never close the circuit through `translateWithFallback` (the provider's own `canExecute()` was refused and the refusal re-opened it), and N failures counted as 2N. The registry now only peeks (`CircuitBreaker.wouldAllow()`) and does not re-record for provider-owned breakers; `CachedProvider` forwards `getCircuitBreaker()` so caching no longer creates a second, desynchronized breaker.
- **The MCP server could read and write anywhere under `/` or your home directory** when a client launched it from there without `ALLOWED_LOCALE_DIRS`. The implicit working-directory fallback now refuses the filesystem root and, for the MCP server, the home directory; an explicit `ALLOWED_LOCALE_DIRS` list (or `security.allowedDirs`) replaces the working directory instead of adding to it; relative paths containing `..` are rejected; and the config's `maxFileSize`/`maxContentLength` limits are actually enforced.
- **`translate_code_comment` translated text inside strings:** `"https://example.com"` was read as a `//` comment and sent to the provider. Comments are now found by a scanner that skips string literals, and each translation is spliced in at its own position, so a duplicate comment elsewhere in the file is no longer overwritten.
- **One provider's cached translation was served for another:** the translation-memory key ignored the provider, so switching from DeepL to an LLM (or between two LLM models) returned the old result. Keys now include the provider identity (`cacheIdentity()`; the LLM provider uses its API format, endpoint and model). Existing cache entries miss once and are rebuilt.
- **Bulk translation merged the same text sent to different targets:** "Hello" to es-MX and es-AR (or to `es` and `fr`) made one call and gave both items the first result. Deduplication now keys on text, languages, dialect, formality and context.
- **`TranslationMemory.set()` resolved before its entry was on disk** when another write was in flight. A coalesced `set()` now resolves after the persist pass that includes it.
- **`dialectos validate` printed a passing-looking score on a failed check (2026-11-10 roast, item 11):** a FAIL report now says the score is a component average only and how many blocking issues failed it.
- **The CLI's `manage-variants` broke article agreement when a swap changed a noun's gender:** "El ordenador" became "El computadora". It now uses the shared lexical substitution, which fixes the article.
- **`scripts/benchmark.mjs` crashed with a TypeError** because it called `translate` with the wrong argument order. Both paths now pass `(sample, dialect)`.
- **The web demo reported cache hits it could not see:** it guessed a hit when the cache size did not change. It now reports a hit only when the cache's own hit counter moved for that request.
- **The web demo's receipt claimed checks the demo never runs.** Live mode said "judge + backstop + negation gate" and "voseo / leísmo / laísmo detection"; the demo backend runs only the output judge and the idiom check. The receipt now says so; the backstop, negation gate and grammar detection run in the CLI and MCP paths.
- **Screen readers missed demo results:** the output box and the runtime receipt are now `aria-live` status regions.

### Security

- **Quoted-speech detection in the voseo adapter could take quadratic time:** a long run of unmatched “ or « made the pattern rescan the rest of the text from every opener (about 1.3 s for 50,000 of them). Each quote body now excludes its own opener, so the scan is linear. Found by CodeQL.
- Patched production dependency advisories (1 critical, 7 high): `hono` 4.13.11, `@hono/node-server` 2.1.3, `undici` 7.30.1, `body-parser` 2.4.0, `qs` 6.16.1, `fast-uri` 3.1.9, `ip-address` 10.7.4, `dompurify` 3.4.17 and `zod` 4.6.6 via workspace overrides; `@dialectos/mcp` now requires `@modelcontextprotocol/sdk` ^1.32.1. Dev tooling moves to `vite` 7.3.7, `vitest` 4.1.12 and `esbuild` 0.28.1. `pnpm audit` reports no known vulnerabilities.
- Release tarballs are vendored with `npm install`, which ignores `pnpm-lock.yaml`; the packing script now carries the workspace overrides into the vendored manifest so the bundled closure gets the same patched versions. Packages the closure depends on directly get the patched version pinned in `dependencies`, since npm 11 rejects an override that conflicts with a direct dependency (`EOVERRIDE`); transitive ones go in npm `overrides`.
- The release workflow's dependency audit now blocks the release on any high or critical production advisory instead of only logging it.

### Changed

- **The root `Dockerfile` builds this repository from source** (`pnpm install --frozen-lockfile && pnpm build`) and runs the MCP server as a non-root user. It previously installed the unrelated `@espanol/mcp` package.
- **Node ≥ 22.13.0 is now required** in every package (Commander 15 needs ≥ 22.12, jsdom and isomorphic-dompurify need ^22.13). pnpm is pinned to 11.1.1 in the README, CONTRIBUTING and `.ci/profile.json`.
- **Coverage floors** are set per package at about five points under measured coverage, and `pnpm test:coverage` enforces them.
- **GitHub Pages:** the `docs/CNAME` file is gone and the Pages smoke test now fails on a cross-host redirect or a page without "DialectOS", instead of passing on the org landing page.
- **Public claims qualified:** es-AD, es-BZ, es-PH, es-GQ and es-US are marked experimental; dialect detection's 54.8% top-1 figure is published and labelled non-independent (the corpus was written from the detector's own keywords); the competitor table credits DeepL's official MCP server; "18 CVEs resolved" is replaced by what was actually patched; launch and SEO docs now say 18 MCP tools, not 17.
- `scripts/build-demo.cjs` extracts engine constants by name instead of by line number (output unchanged).

- Circuit breaker and translation-memory persist lifecycles are now explicit state machines (`CIRCUIT_STATES`/`CIRCUIT_TRANSITIONS`, `PERSIST_STATES`/`PERSIST_TRANSITIONS`) with a single guarded transition function each; bulk checkpoints are built by one `buildBulkCheckpoint()` (on-disk v2 format unchanged).

### Added

- **`validate_translation` MCP tool:** checks an existing translation with the validator the CLI `validate` command and the GitHub Action use, without calling a provider. The MCP server now has 18 tools.
- **pnpm install legs in the release smoke gate (2026-11-01):** `scripts/tarball-install-smoke.mjs` now also gates the install commands the README documents — `pnpm add -g <cli.tgz>` and `pnpm dlx <mcp.tgz>` — against the same locally packed tarballs the npm legs use (file paths only, no GitHub release URL fetches). pnpm runs at the repo-pinned `pnpm@11.1.1`, resolved from the root `packageManager` field: a PATH pnpm is used only when it reports exactly the pin, otherwise the pin is bootstrapped via `npm install -g pnpm@<pin>`, and a resolved binary that is not exactly the pin fails the gate (unpinned "latest" is not acceptable — 11.12.0 is a deprecated, known-broken release for both paths). Each pnpm leg runs in a pristine sandbox with the sandbox global bin dir (`PNPM_HOME/bin`) prepended to `PATH` (otherwise pnpm exits `ERR_PNPM_GLOBAL_BIN_DIR_NOT_IN_PATH`) and pnpm's global/store/cache/state/data dirs pinned inside the sandbox so constrained CI hosts are covered. Receipts: `dialectos --version` prints the tarball manifest's own version; `validate --dialect xx-XX` exits non-zero naming the dialect and pointing at `dialectos dialects list`; `validate --dialect es-MX` passes; `pnpm dlx` answers a JSON-RPC `initialize` with `serverInfo` `@dialectos/mcp` at the tarball version. The existing npm offline legs are unchanged; the gate fails when any documented leg fails.

### Fixed

- **CI gate always passed (2026-11-10 roast, P0):** the GitHub Action and `scripts/ci-validate.mjs` ran `packages/cli/dist/index.js`, which is the library entry. It exits 0 without validating anything, so every file "passed". They now run the `dist/cli.js` binary. A pass also needs a parseable JSON report, and a missing binary exits 2. `target-patterns` now uses real glob matching (`**/*.es.json` used to match nothing). Explicit patterns that match no files fail unless the new `allow-empty` input is set. A new `locale-base` input supplies source text for locale JSON. Action inputs now reach the script through `env:` instead of being interpolated into `run:`, and the Action runs on Node 22, which Commander 15 requires. An end-to-end test drives the real binary on a broken and a clean locale.
- **`validate --format json` stdout was not pure JSON on failure:** the "Validation failed" line now goes to stderr. In locale mode `--strict` now counts non-blocking issues, and text output gets its newlines back.
- **Credential headers leaked on cross-origin redirects (P1):** `fetchWithRedirects` stripped only `authorization`, `cookie`, `proxy-authorization` and `www-authenticate`, so the Anthropic `x-api-key` followed a redirect to another origin. Cross-origin hops now keep only an allowlist (`accept`, `accept-language`, `content-language`, `content-type`, `user-agent`). The LM Studio model list and load calls now go through the same validated fetch, and the Serper search calls refuse redirects. A behavioural test with two local servers covers the leak.
- **LLM body-timeout timer never cleared:** every successful call left a pending timer behind. It is now cleared in `finally`.
- **Quality gates failed open (2026-11-10 roast, P1):** a gate that threw was counted as passed. It now fails. A new negation gate runs on every model tier. Unchanged output passes only for short cognates such as "Hotel" or "Taxi", not whole English sentences. Gate failures in the LLM provider throw `QualityGateError`, which no longer counts toward tripping the circuit breaker. The two-call mode now runs the gates too.
- **Dialect vocabulary check matched the wrong words:** it matched English glosses ("computer (Spain)") instead of the concept, so the flagship "ordenador in es-MX" case was never flagged. It now matches concept headwords on word boundaries, allows plurals and inflections, and reports each violation once.
- **MCP translations skipped the validator (P1):** `translate_text`, `translate_code_comment`, `translate_readme`, `translate_markdown`, `translate_api_docs`, `create_bilingual_doc`, `translate_missing_keys` and `batch_translate_locales` now run the same validator as the CLI and the GitHub Action. A blocked single translation returns `QUALITY_GATE_FAILED`. A blocked section, comment or locale key keeps its original text, or stays missing, and the reason goes in `errors`. A semantic score below threshold without a dropped negation is reported in `advisories` and does not block, because that score marks correct short strings as failures ("Welcome" → "Bienvenido" scores 26%). Provider downgrade warnings are now returned as `warnings` instead of being dropped. The tarball for `@dialectos/mcp` now bundles `@dialectos/cli` for the shared validator.
- **DeepL claimed native dialect support:** it always sent the base `ES` code, so es-MX came back as generic Spanish with no warning. DeepL now reports no dialect support, so the registry warns and prefers a provider that can honour the dialect.

- **Release tarballs runtime-broken on clean machines (2026-10-27 defect):** `npm install -g dialectos-cli-0.3.1.tgz` exited 0 but every CLI invocation crashed with `ERR_MODULE_NOT_FOUND: isomorphic-dompurify` — npm silently skips installing any dependency that is also declared by a `bundleDependencies` package ("deps of bundled deps" are assumed present), so the previous hoist-only strategy left `isomorphic-dompurify`, `zod`, `marked` and the whole `jsdom` tree as empty directories. `scripts/pack-release-tarballs.mjs` now vendors the full transitive closure (resolved by a real `npm install`) into the tarball and verifies every bundled/nested package is present in the packed artifact; the release tarballs now install fully offline. New `scripts/tarball-install-smoke.mjs` gates releases on the defect bar: pristine-prefix offline install → `--version` prints → unknown dialect fails closed with an actionable error → known dialect passes. The v0.3.1 GitHub release assets were rebuilt and SHA256SUMS.txt replaced accordingly.

### docs: dated licence-history note (wording only; terms unchanged)

- Added [LICENSING.md](LICENSING.md) recording the MIT → BSL-1.1 → Apache-2.0 sequence with dates, stating that GitHub release `v0.2.0` (2026-04-27) shipped BSL-1.1, and that an MIT → BSL → Apache sequence does not automatically reach previously published MIT-licensed copies. No licence file or grant was changed. Deprecating the v0.2.0 source archives remains a CEO-gated release act and was not performed.

## [0.3.1] - 2026-10-27

### Fixed

Operator-path ship blockers from the 2026-10-26 portfolio audit (L1#1, L1#5, L1#6, L2#19–22):

- **Install path:** GitHub Release CLI/MCP tarballs now bundle the five unpublished `@dialectos/{types,security,locale-utils,markdown-parser,providers}` packages (`bundleDependencies` + hoisted public npm deps). `pnpm add -g <cli.tgz>` / `pnpm dlx <mcp.tgz>` no longer 404 on the registry. Packer: `scripts/pack-release-tarballs.mjs`. npm publishing remains CEO-gated and is not claimed.
- **Dialect gate:** `dialectos validate --dialect xx-XX` now exits non-zero with an actionable error that names the unknown dialect and points at `dialectos dialects list`. Unknown codes are no longer silently scored as PASS.
- **CLI surface:** `validate` accepts `--translated <text>` in addition to the positional argument, matching the README example.
- **One version story:** `server.json` is 0.3.1 and points at the GitHub tarball URL (no unpublished `@kyanitelabs/dialectos` npm identifier). README, CHANGELOG, llms.txt, package.json, and CLI `--version` agree on 0.3.1.

Fixes for the four adversarial break-protocol findings (CGO adversary lane, 2026-09-19 — `REFUTE 4/10`):

- **Protocol survival (H1):** `tools/call` (and every method) with `params: null` is now answered with a JSON-RPC `-32602 Invalid params` response instead of being silently dropped by the MCP SDK. A line-wise stdin guard (`mcp/src/lib/null-params-guard.ts`) intercepts explicit-null-params requests before the transport sees them; all other traffic passes through untouched.
- **Grammar (core value):** `manage_dialect_variants` now runs the shared deterministic engine (`applyLexicalSubstitution` from `@dialectos/providers`) instead of a naive word-swap table, so article gender agrees with the substituted noun — "el ordenador" → "la computadora", never "el computadora" — with plural ("los ordenadores" → "las computadoras") and case preservation. Also fixed the noun-gender resolver: accent normalization now actually strips accents (accented lookups used to miss the unaccented override keys), "papa" is no longer mis-listed as masculine (would have produced "el papa" from "la patata"), and "color"/"calor" are no longer mis-listed as feminine.
- **Data-loss trap:** `manage_dialect_variants` no longer overwrites `sourcePath` by default. Without `outputPath` it writes a sibling variant file (`<stem>-<variant>.json`, or `<variant>.json` when the source stem is a locale code) and reports it as `outputPath` in the response; rewriting the source in place now requires an explicit `overwrite: true` opt-in. Multi-variant workflows no longer destroy their base locale.
- **Publish readiness:** all `@dialectos/*` internal dependencies now use real semver ranges (`^0.3.0`) instead of `workspace:*`, so packed tarballs are installable from any registry (`npm pack` manifests no longer carry the unsupported `workspace:` protocol; `npm install <tarball>` no longer fails with EUNSUPPORTEDPROTOCOL). `linkWorkspacePackages: true` keeps pnpm linking local packages in the workspace during development, and the lockfile is regenerated so `pnpm install --frozen-lockfile` (CI) passes from a fresh clone.

## [0.3.0] - 2026-04-27

### Added

#### Quality Assurance Mode (`dialectos validate`)
- `dialectos validate` — standalone command to validate existing translations against dialect quality checks
- Extracted `validateTranslation()` pipeline function from translate-api-docs into reusable module
- Supports `--source-file`, `--translated-file`, `--dialect`, `--glossary-file`, `--protect-tokens`, `--format text|json`, `--strict`, `--locale`
- `ValidationReport` type with quality score, semantic check, lexical compliance, output judge, and structure validation
- CLI exits 0 on pass, 1 on blocking issues (or any issue with `--strict`)
- Refactored translate-api-docs to use shared `validateTranslation()` internally

#### Translation Corpus
- `TranslationCorpus` class for dialect-indexed JSONL storage at `~/.cache/dialectos/corpus/`
- `CorpusEntry` and `CorrectionEntry` types for structured storage
- `CorpusStats` with per-dialect counts and quality distribution
- Atomic writes via temp file + rename (same pattern as TranslationMemory)
- Path validation via `@dialectos/security`
- `dialectos corpus stats` — corpus size, quality distribution, dialect coverage
- `dialectos corpus export --dialect <d> --output <path>` — export JSONL
- `--corpus` flag on `translate` and `translate-api-docs` commands for opt-in capture

#### Public Dialect Quality Benchmark
- Expanded adversarial fixtures from 130 to 205 samples across all 25 dialects
- 3 new adversarial categories: `negation-preservation`, `formality-consistency`, `cultural-adaptation`
- 75 new samples (3 per dialect) with dialect-specific cultural data, voseo/vosotros-aware formality, and negation traps
- `scripts/benchmark.mjs` runner evaluating fixtures via `validateTranslation()` pipeline
- `dialectos benchmark run` and `dialectos benchmark report` CLI commands
- `benchmarks/README.md` with methodology, contribution guide, and score interpretation
- 50+ critical-severity samples for certification threshold

#### GitHub Action for Translation CI
- `action.yml` composite action for CI validation of Spanish translations
- Inputs: `dialect`, `source-dir`, `target-patterns`, `glossary-file`, `fail-on-blocking`, `format`, `strict`
- `scripts/ci-validate.mjs` — detects changed locale files and runs validation per file
- `.github/workflows/validate-pr.yml` — PR validation with multi-dialect matrix (es-ES, es-MX, es-AR, es-CO)
- Posts validation comment on PR via `actions/github-script@v7`
- `docs/github-action.md` with usage guide and multi-dialect matrix example

#### Auto-Glossary from Corrections
- `generateGlossarySuggestions()` engine — groups corrections by source phrase + corrected term
- `wordDiff()` for position-by-position word comparison between original and corrected translations
- Confidence scoring: 0.4 × dialect factor + 0.6 × frequency factor
- `dialectos glossary suggest` — generates suggestions from corpus corrections with `--interactive` mode
- `dialectos glossary diff <before> <after>` — compares two glossary JSON files (added/removed/changed)
- Correction capture wired into validate and translate commands

### Changed
#### Architecture refactoring and dictionary overhaul (moved here from [0.3.1] during the Layer 5 audit)
- These changes (7d311c1, c820e7e) are ancestors of the 177af57 main cut that produced the v0.3.0 release artifacts on 2026-06-03 UTC (commit dated 2026-06-02 19:41 −0700), so they shipped in v0.3.0; the v0.3.0 tag was later re-cut to 7e616fd (privity wave G4). The relocation also dropped a duplicate empty "Dialectal Dictionary Overhaul" heading that sat above the real one.

#### Architecture Refactoring
- Extracted shared morphology helpers (`applyCase`, `spanishPluralize`) to `providers/src/morphology.ts` — deduplicated from 3 files
- Removed hidden dependency: `@dialectos/locale-utils` no longer re-exports `@dialectos/security` symbols
- Added compile-time completeness check for dialect metadata (all 25 dialects validated)
- Removed 3 pass-through factory wrappers — CLI and MCP now import directly from `@dialectos/providers`
- Extracted inline data to JSON files: garbage patterns, false friends, accent fixes, word lists, gender overrides
- Split `llm.ts` (955 lines) into 3 focused modules: `llm.ts` (class + wire protocol), `llm-prompts.ts` (prompt construction), `llm-response.ts` (response extraction + sanitization)
- Reorganized `@dialectos/types` index with clear separation between pure types and runtime data modules
- Exported `extractResponseText` from providers for testability
- Fixed duplicate `export *` in providers index

#### Dialectal Dictionary Overhaul
- Stripped 500 mechanically propagated entries to pan-Hispanic only (no fake dialect variation)
- Added 58 new high-dialectal-variation concepts across 4 batches with genuine per-dialect variants
- Made `variants` field optional on `DictionaryEntry` — entries with no dialect variation use `panHispanic` only
- Added null safety throughout `dialectal-vocabulary.ts` and tests for optional `variants`
- Fixed 11 orphaned entries that lost both `panHispanic` and `variants` during stripping
- **Total: 833 concepts** — 333 with real dialect variation (3–17 distinct terms), 500 pan-Hispanic

#### New high-variation concepts
- **Food**: drinking_straw (pajita/pitillo/popote/sorbete), sweet_potato (batata/camote/boniato), passion_fruit (maracuyá/cherimola/parchita), caramel_spread (dulce de leche/manjar/cajeta), soft_drink (refresco/gaseosa/soda), popsicle (helado/paleta/chupachicos), hot_dog (pancho/completo/jote), popcorn (pochoclo/pororó/cabritas/canguil/cancha/crispeta/cotufas), avocado (aguacate/palta), peach (melocotón/durazno), corn (elote/choclo/jojoto/mazorca), bean (frijol/judía/poroto/caraota/habichuela), banana (banana/plátano/cambur/guineo)
- **Household**: baby_bottle (biberón/mamadera/chupete/tetero), pacifier (chupete/bobo/chupón), light_switch (interruptor/llave/boton), dustpan (recogedor/elefante/.palette), adhesive_tape (cinta/tela/pega), stroller (cochecito/carriola/carrito), blender (licuadora/batidora)
- **Transport**: flat_tire (pinchazo/llanta ponchada/bomba), car_horn (bocina/cláxon/pito), drivers_license (carnet/licencia/registro/libreta)
- **Social**: cool_awesome (chévere/bacán/padre/copado/brutal), snobby_person (pijo/figurita/cheto/sifrino/fresa), guy_dude (sujeto/tipo/chabón/ese/cabro), bribe (mordida/coima/soborno/peaje), boyfriend_girlfriend (novio/chamuyo/jevo/pretendiente/ennovio), money_slang (plata/lana/pasta/pisto/chavos), informal_address (tío/che/parcero/pana/güey/mae/asere), being_broke (sin un peso/pelado/sin una luca/sin un duro), lots_of (harto/pila/chin/chingo), party_celebration (carrete/rumba/parranda)
- **Actions**: to_hitchhike (hacer dedo/hacer botella/pedir aventón/raite), to_get_angry (enojarse/enfadarse/calentarse/arrecharse), to_get_drunk (emborracharse/curarse/chuparse/mamarse), to_steal_slang (afanar/pitiar/piar), to_work_slang (chambear/laburar/currar), to_leave_slang (rajarse/pirarse), to_miss_someone (extrañar/echar de menos), to_chat (platicar/charlar), to_drink (beber/tomar)
- **People**: kid_informal (pibe/chamo/chaval/cabro/chibolo/patajo/cipote), cop_informal (yuta/paco/tomba/tombo/tira/pasma), blonde_person (rubio/mona/chele), bandaid (tirita/curita/afterito)
- **Education**: to_fail_class (reprobar/suspender/desaprobar/perder), skip_class (hacer la cimarra/jugar a la pelota/hacerse el loco), homework (tarea/deberes)
- **Medicine**: hangover (resaca/cruda/goma/guayabo/ratón), common_cold (resfriado/catarro/resfrío), street_food_stall (carrito/puesto/kiosko/colmado)
- **Clothing**: bra (sujetador/corpiño/sostén), flip_flops (chanclas/ojotas/chancletas), jacket (chaqueta/chamarra/campera)
- **Body**: belly_stomach (panza/barriga/guata/buche)
- **Transport**: car_informal (coche/auto/carro), swimming_pool (piscina/pila), highway (autopista/autovía/carretera), shower (ducha/regadera), gasoline (gasolina/nafta/bencina), subway (metro/subte)

- All 7 packages bumped from `0.2.0` to `0.3.0`
- Adversarial fixture test updated with 3 new categories and critical threshold raised to 50

## [0.2.0] - 2026-04-27

### Added

#### Grammar & Semantic Analysis
- Grammar detection pipeline: voseo, leísmo/laísmo/loísmo, yeísmo detection with exact bigram matching
- Semantic backstop with negation preservation, keyword overlap, and structural parity checking
- Negation detection: 15 English contractions (`dont`, `cant`, `cannot`, `wont`, etc.) + apostrophe stripping
- Spanish negation coverage expanded with `ningún`, `nunca`, `jamás`, `nadie`, and 18 other markers
- Abbreviation-protected sentence splitting (e.g. "Dr.", "Sr.") to prevent false grammar boundaries
- NFC Unicode normalization for consistent text processing

#### Translation Memory
- Persistent translation cache with TTL, LRU eviction, and serialized atomic writes
- `get()` returns shallow clones to prevent caller mutation
- `clear()` is generation-safe against concurrent persist operations
- `load()` validates all entries before hydration
- `maxSize <= 0` guard and null-safe `computeKey()`

#### Adversarial Hardening
- Expanded adversarial certification suite: 125 samples across all 25 dialects
- Torture tests: +27 memory, +42 backstop, +41 grammar detection tests
- Public demo adversarial hardening: source exposure prevention, malformed path handling, dirty JSON rejection, non-string field validation
- Security headers (`x-content-type-options: nosniff`, `referrer-policy`) on static and JSON responses

#### Provider Quality
- LLM promoted to primary translation provider with dialect-specific semantic prompts
- Anthropic-compatible API support for cloud LLM providers
- LM Studio local model certification and JIT provider support
- Provider-agnostic output judge for quality gating
- Web demo output judge to prevent static fallback presentation
- Semantic ambiguity matrix and regional polysemy gates
- Dialect quality contracts embedded in LLM prompts

#### Certification & Reporting
- Long-document certification harness (README, API docs, locale JSON flows)
- Incremental dialect certification runner (`dialect:certify`)
- Expanded adversarial dialect certification (`dialect:certify-adversarial`)
- Customer certification report generator with MQM-aligned metrics
- Spanish launch audit offer documentation

#### Launch & Documentation
- Complete launch kit: 24 files (~15K words) across Product Hunt, HN, Dev.to, Medium, Reddit, Twitter, Stack Overflow, and more
- SEO/AI SEO hardening: OG tags, schema.org JSON-LD, FAQ section, comparison table, `.llm` crawler file
- Landing page redesign with SVG logo, real-time dialect detection demo, and register classification
- Interactive browser demo exercising the full translation backend (not static fallbacks)
- CITATION.cff updated with BSL-1.1 license and 25 dialect variants

### Changed

#### Dependencies
- `vitest` 3.2.4 → 4.1.5 (major bump; constructor mocks converted to `function()` syntax for compatibility)
- `isomorphic-dompurify` 3.9.0 → 3.10.0 (dompurify 3.4.0 → 3.4.1)

### Fixed
- Translation memory race condition during concurrent persist/clear operations
- Cross-dialect false positive reduction via co-occurrence weighting in grammar detection
- Provider registry balancing and dialect validation edge cases
- Semantic scorer edge cases from post-merge review
- MCP test compatibility with vitest 4 constructor-mock requirements

## [0.1.0] - 2026-04-20

### Added

#### Security & Resilience
- Adversarial fixture corpus for CI regression testing (4 fixtures, 6 tests)
- Adversarial CI lane with pass/fail thresholds
- Provider capability negotiation with language normalization
- Provider chaos harness with 7 deterministic failure modes
- Versioned checkpoint schema (v1) with migration and retention
- Operator policy profiles: strict, balanced, permissive
- Semantic drift quality gate with heuristic similarity scoring
- Reliability telemetry collector with health reports

#### Infrastructure
- SSRF protection on all provider endpoints
- Circuit breaker with half-open probe locks
- Atomic checkpoint writes using temp-file + rename pattern
- HTML injection detection in translated output
- Prototype pollution protection in checkpoint loading
- Rate limiting with configurable windows per provider

#### Quality
- Word overlap, length ratio, and entity preservation semantic scoring
- Structure validation for markdown (tables, code blocks, links)
- Glossary enforcement with strict mode
- Protected token preservation for brand names and identifiers
- Quality score now includes semantic similarity component

#### Providers
- DeepL provider with formality mapping and context support
- LibreTranslate provider with endpoint SSRF validation
- MyMemory provider with grapheme-aware chunking
- Provider registry with capability-based validation

#### Dialect Expansion (20 → 25)
- Added 5 new dialects: `es-GQ` (Equatorial Guinea), `es-US` (U.S. Spanish), `es-PH` (Philippine/Chavacano), `es-BZ` (Belize), `es-AD` (Andorra)
- Expanded keyword sets from ~13 to 20–30 verified lexical items per dialect
- Full `DIALECT_ADAPTATIONS` coverage for all 25 dialects in `manage-variants`
- Verified keywords via web research to avoid false positives (e.g. replaced Tagalog words with Chavacano markers for `es-PH`)

#### Register Differentiation (Formal vs Slang)
- `DialectMetadata` now includes `formalMarkers`, `slangMarkers`, and `grammarFeatures`
- `detectRegister(text)` classifies input as `"formal" | "neutral" | "slang"` via marker scoring
- `getRegisterMarkers(dialect)` returns per-dialect formal/slang marker sets
- CLI `--register <formal|neutral|slang>` flag on `translate` and `translate-api-docs`
- MCP `register` parameter on `translate_missing_keys` and `batch_translate_locales`
- `dialects detect` command outputs register classification alongside dialect code

#### CLI
- `translate-readme` with checkpoint resumption
- `translate-api-docs` with partial failure policies
- `i18n detect-missing` for locale file comparison
- `i18n batch-translate` for multi-dialect workflows
- `i18n manage-variants` with 200+ vocabulary adaptation rules across 25 dialects
- `dialects list` with metadata for all 25 variants
- `dialects detect` with register classification

#### MCP
- 16 MCP tools for markdown, i18n, and translation operations
- `register` parameter on translation tools for formal/slang/neutral output
- Structured JSON error handling
- Graceful shutdown on SIGINT/SIGTERM

[0.3.2]: https://github.com/KyaniteLabs/DialectOS/releases/tag/v0.3.2
[0.3.1]: https://github.com/KyaniteLabs/DialectOS/releases/tag/v0.3.1
[0.3.0]: https://github.com/KyaniteLabs/DialectOS/releases/tag/v0.3.0
[0.2.0]: https://github.com/KyaniteLabs/DialectOS/releases/tag/v0.2.0
[0.1.0]: https://github.com/KyaniteLabs/DialectOS/releases/tag/v0.1.0
