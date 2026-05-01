# Dialect Detection Corpus

A labeled benchmark corpus for Spanish dialect detection accuracy testing.

## Structure

```
packages/benchmarks/dialect-detection-corpus/
├── samples.json    # 250 labeled samples (10 per dialect × 25 dialects)
├── README.md       # This file
```

### Corpus Statistics

| Metric | Value |
|--------|-------|
| Total samples | 250 |
| Dialects | 25 |
| Samples per dialect | 10 |
| Easy samples | 75 (3 per dialect) |
| Medium samples | 100 (4 per dialect) |
| Hard samples | 75 (3 per dialect) |

### Sample Format

Each sample is a JSON object:

```json
{
  "text": "Che, boludo, ¿vos tomás el bondi al laburo?",
  "expectedDialect": "es-AR",
  "difficulty": "easy",
  "tags": ["che", "boludo", "vos", "bondi", "laburo"]
}
```

- `text` — The Spanish text to detect
- `expectedDialect` — The expected dialect code (e.g., `es-AR`)
- `difficulty` — `easy` | `medium` | `hard`
- `tags` — Descriptive tags for the sample's linguistic features

### Difficulty Levels

- **Easy**: Contains 2+ unique/diagnostic keywords from the dialect's keyword set (e.g., "¡Qué chévere, pana!" for Venezuela).
- **Medium**: Contains 1 diagnostic keyword + disambiguating context (e.g., "Voy a coger el guagua" — context disambiguates "guagua" as bus vs baby).
- **Hard**: No obvious keywords; requires grammar/register detection (e.g., "¿Vos sabés dónde queda?" for voseo regions, or "¿Queréis tomar algo?" for Spain).

## How Samples Were Chosen

Samples were crafted using the keyword lists from `packages/mcp/src/tools/translator-data.ts` (`DIALECT_METADATA`) and `packages/cli/src/lib/dialect-info.ts` (extended keyword, formal, and slang terms). Each sample aims to be realistic Spanish that native speakers of the target dialect would actually say or write.

### Keyword Sources

- **MCP `DIALECT_METADATA`**: Core keywords per dialect (8–10 terms) used for the primary detection algorithm.
- **CLI `DIALECT_METADATA`**: Extended sets including `formalTerms` and `slangTerms` (≈30 terms per dialect) used to enrich sample variety.

### Grammatical Signals

Hard samples deliberately avoid obvious lexical keywords and instead rely on:
- **Voseo**: verb endings in `-ás`, `-és`, `-ís` and pronoun `vos` (Argentina, Uruguay, Paraguay, Bolivia)
- **Vosotros**: verb endings in `-áis`, `-éis`, `-ís` and pronoun `vosotros` (Spain, Andorra)
- **Neutral register**: generic tú-form sentences that test whether the algorithm defaults correctly or confuses similar dialects

## How to Run the Benchmark

### Run the detection benchmark

```bash
node scripts/benchmark-detection.mjs
```

### Options

| Flag | Description |
|------|-------------|
| `--corpus=<path>` | Override corpus path (default: `packages/benchmarks/dialect-detection-corpus/samples.json`) |
| `--out=<dir>` | Output directory for reports (default: `packages/benchmarks/dialect-detection-corpus/results/`) |

### Outputs

The script writes two files to the output directory:

- `report.json` — Structured JSON with top-1 accuracy, top-3 accuracy, average confidence, confusion matrix, per-dialect breakdown, and per-difficulty breakdown.
- `report.md` — Human-readable Markdown summary.

### Exit Codes

- `0` — Benchmark completed and top-1 accuracy ≥ 0.50
- `1` — Benchmark completed but top-1 accuracy < 0.50 (CI gate)

## Quality Bar

All samples were reviewed to ensure:
1. **Realism**: Native speakers of the target dialect would plausibly produce the utterance.
2. **Keyword grounding**: Easy/medium samples are anchored in documented regional vocabulary.
3. **Minimal cross-dialect leakage**: Hard samples avoid keywords that strongly signal a different dialect.
