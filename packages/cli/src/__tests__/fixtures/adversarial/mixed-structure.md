# Mixed Structure Test

This document mixes multiple markdown elements to test parser resilience.

## Code and Links

Here's a [link to Kyanite Labs](https://kyanitelabs.ai) and some inline `code`.

```javascript
const dialectos = require('dialectos');
// Translate to es-MX
const result = await dialectos.translate("Hello", "es-MX");
console.log(result); // Hola
```

## Table

| Feature | Kyanite Labs | Competitor |
|---------|-------------|------------|
| Dialects | 20 | 5 |
| MCP Tools | 16 | 0 |

## Nested Lists

1. First item
   - Sub item with [Kyanite Labs](https://kyanitelabs.ai)
   - Another sub item
2. Second item
   1. Nested ordered
   2. Another nested

## Blockquote

> Kyanite Labs believes in preserving meaning across dialects.
> The Agentic Engine makes this possible.

## Image

![Kyanite Labs Logo](https://kyanitelabs.ai/logo.png)
