# @espanol/locale-utils

Utilities for locale file diff, merge, and comparison.

## Features

- Detect missing keys between locale files
- Compare nested object structures
- Support JSON, YAML, and PO formats
- Preserve formatting and comments where possible

## Usage

```typescript
import { detectMissingKeys, mergeLocales } from "@espanol/locale-utils";

// Find keys in source but missing in target
const missing = detectMissingKeys(sourceJson, targetJson);
// Returns: ["nav.home", "nav.settings.title"]

// Merge translations into target
const merged = mergeLocales(targetJson, translations);
```
