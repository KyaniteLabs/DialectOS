# @dialectos/cli

CLI commands for Spanish dialect translation workflows.

> v0.3.0 is distributed through GitHub Release tarballs, not the npm registry.

## Installation

```bash
# Install the released CLI tarball
pnpm add -g https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.0/dialectos-cli-0.3.0.tgz

# Or use a local source checkout
pnpm install
pnpm build
```

## Commands

### Translation

```bash
# Translate text to a specific dialect
node packages/cli/dist/index.js translate "Hello world" --dialect es-MX

# Translate with formal / informal register
node packages/cli/dist/index.js translate "Hello world" --dialect es-MX --formal
node packages/cli/dist/index.js translate "Hello world" --dialect es-AR --informal

# Translate a README preserving structure
node packages/cli/dist/index.js translate-readme README.md --dialect es-AR --output README.ar.md

# Translate API documentation
node packages/cli/dist/index.js translate-api-docs api.md --dialect es-CO --output api.co.md
```

### i18n

```bash
# Detect missing keys between locale files
node packages/cli/dist/index.js i18n detect-missing ./locales/en.json ./locales/es.json

# Translate missing keys
node packages/cli/dist/index.js i18n translate-keys ./locales/en.json ./locales/es.json --dialect es-MX

# Batch translate to multiple dialects
node packages/cli/dist/index.js i18n batch-translate ./locales --base en --targets es-MX,es-AR,es-CO

# Create dialect-specific variant from es-ES base
node packages/cli/dist/index.js i18n manage-variants ./locales/es-ES.json --variant es-MX

# Check formality consistency
node packages/cli/dist/index.js i18n check-formality ./locales/es.json --register formal

# Apply gender-neutral language
node packages/cli/dist/index.js i18n apply-gender-neutral ./locales/es.json --strategy latine
```

### Dialects

```bash
# List all supported dialects
node packages/cli/dist/index.js dialects list

# Detect dialect from text
node packages/cli/dist/index.js dialects detect "Che boludo, qué onda?"
node packages/cli/dist/index.js dialects detect "Estimado señor, le saludo cordialmente" --register formal
```

### Glossary

```bash
# Search glossary terms
node packages/cli/dist/index.js glossary search "API"

# Get detailed term info
node packages/cli/dist/index.js glossary get --category programming
```

## Policy Profiles

Choose a preset for safety/reliability tradeoffs:

```bash
# Strict: fail on any error, enforce all validations
node packages/cli/dist/index.js translate-readme README.md --policy strict --dialect es-ES

# Balanced (default): allow partial output, warn on issues
node packages/cli/dist/index.js translate-readme README.md --policy balanced --dialect es-MX

# Permissive: maximize throughput, skip validations
node packages/cli/dist/index.js translate-readme README.md --policy permissive --dialect es-AR
```
