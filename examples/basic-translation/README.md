# Basic Translation Example

This example demonstrates how to use DialectOS to translate a README file to multiple Spanish dialects.

## Setup

```bash
npm install @espanol/cli
```

## Translate to Mexican Spanish

```bash
npx espanol translate-readme README.md \
  --dialect es-MX \
  --output README.es-MX.md \
  --policy balanced
```

## Translate to Argentine Spanish

```bash
npx espanol translate-readme README.md \
  --dialect es-AR \
  --output README.es-AR.md \
  --policy strict
```

## Batch translate i18n files

```bash
npx espanol i18n batch-translate locales/en.json \
  --dialects es-MX,es-AR,es-CO,es-ES \
  --output-dir locales/
```

## Check what changed

```bash
npx espanol i18n detect-missing locales/en.json locales/es-MX.json
```
