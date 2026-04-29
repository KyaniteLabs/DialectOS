# Changelog

All notable changes to DialectOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

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

[0.3.0]: https://github.com/Pastorsimon1798/DialectOS/releases/tag/v0.3.0
[0.2.0]: https://github.com/Pastorsimon1798/DialectOS/releases/tag/v0.2.0
[0.1.0]: https://github.com/Pastorsimon1798/DialectOS/releases/tag/v0.1.0
