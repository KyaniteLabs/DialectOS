# @espanol/cli

CLI commands for Spanish dialect translation workflows.

## Installation

```bash
npm install -g @espanol/cli
```

## Commands

### Translation

```bash
# Translate text to a specific dialect
espanol translate "Hello world" --dialect es-MX

# Translate a README preserving structure
espanol translate-readme README.md --dialect es-AR --output README.ar.md

# Translate API documentation
espanol translate-api-docs api.md --dialect es-CO --output api.co.md
```

### i18n

```bash
# Detect missing keys between locale files
espanol i18n detect-missing ./locales/en.json ./locales/es.json

# Translate missing keys
espanol i18n translate-missing ./locales/en.json ./locales/es.json --dialect es-MX

# Batch translate to multiple dialects
espanol i18n batch-translate ./locales/en.json --dialects es-MX,es-AR,es-CO

# Check formality consistency
espanol i18n check-formality ./locales/es.json --expected formal

# Apply gender-neutral language
espanol i18n apply-gender-neutral ./locales/es.json --output ./locales/es-neutral.json
```

### Dialects

```bash
# List all supported dialects
espanol dialects list

# Detect dialect from text
espanol dialects detect "Che boludo, qué onda?"
```

### Glossary

```bash
# Search glossary terms
espanol glossary search "API"

# Get detailed term info
espanol glossary get "machine learning"
```

## Policy Profiles

Choose a preset for safety/reliability tradeoffs:

```bash
# Strict: fail on any error, enforce all validations
espanol translate-readme README.md --policy strict --dialect es-ES

# Balanced (default): allow partial output, warn on issues
espanol translate-readme README.md --policy balanced --dialect es-MX

# Permissive: maximize throughput, skip validations
espanol translate-readme README.md --policy permissive --dialect es-AR
```

## Quality Gates

Every translation is scored across 4 dimensions:
- **Token Integrity** — Protected terms preserved
- **Glossary Fidelity** — Enforced terminology used
- **Structure Integrity** — Markdown structure intact
- **Semantic Similarity** — Meaning not drifted

Output: `score=95 token=100% glossary=100% structure=pass semantic=91%`
