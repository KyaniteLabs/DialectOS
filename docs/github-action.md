# DialectOS GitHub Action

Validate Spanish translations in CI with dialect-aware quality checks.

## Usage

Add to your `.github/workflows/validate-pr.yml`:

```yaml
name: Validate Translations

on:
  pull_request:
    paths:
      - '**/*.es.json'
      - '**/*.es-*.json'
      - 'locales/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: KyaniteLabs/DialectOS@v0.3.0
        with:
          dialect: es-MX
          fail-on-blocking: true
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `dialect` | Yes | `es-ES` | Spanish dialect code (e.g., es-ES, es-MX, es-AR, es-CO) |
| `source-dir` | No | `.` | Directory containing translation files |
| `target-patterns` | No | `""` | Comma-separated glob patterns for translated files |
| `glossary-file` | No | `""` | Path to JSON glossary for terminology checks |
| `fail-on-blocking` | No | `true` | Fail on blocking issues vs. any issue |
| `format` | No | `text` | Output format: text or json |
| `strict` | No | `false` | Treat all issues (not just blocking) as failures |

## What It Checks

- **Token preservation**: Protected tokens (placeholders, URLs, code) survive translation
- **Structure integrity**: Markdown/HTML structure matches source
- **Lexical compliance**: Dialect-specific vocabulary constraints
- **Semantic quality**: Meaning preservation (negation, key terms)
- **Output judge**: No prompt leakage, no unchanged English, no explanations

## Example: Multi-dialect Matrix

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dialect: [es-ES, es-MX, es-AR, es-CO]
    steps:
      - uses: actions/checkout@v4
      - uses: KyaniteLabs/DialectOS@v0.3.0
        with:
          dialect: ${{ matrix.dialect }}
```

## Output

The action writes a `dialectos-validation-comment.md` file you can post as a PR comment using `actions/github-script@v7`.
