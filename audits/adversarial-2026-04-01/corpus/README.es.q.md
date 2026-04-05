#  DialectOS  

Servidor de traducción de dialecto español construido en el Protocolo Modelo de Contexto (MCP).

 DialectOS   proporciona 16 herramientas MCP que entienden las diferencias de dialecto español —traduciendo, detectando y adaptando contenido a 20 variantes regionales (es-ES, es-MX, es-AR, es-CO, etc.) preservando la estructura de marcado, los comentarios de código y el formato de archivo locale.

## Arquitectura

```
packages/
├── mcp/              @espanol/mcp       — 16 MCP tools (stdio server)
├── cli/              @espanol/cli       — CLI commands for translation workflows
├── providers/        @espanol/providers — DeepL, LibreTranslate, MyMemory
├── security/         @espanol/security  — Rate limiting, path validation, sanitization
├── types/            @espanol/types    — Shared TypeScript types
├── locale-utils/     @espanol/locale-utils   — Locale file diff/merge utilities
└── markdown-parser/  @espanol/markdown-parser — Structure-preserving markdown parser
```

## 16 MCP Tools

Traducción del mercado (4)**

- `translate markdown` — Traducir el marcador al conservar la estructura
- `extract translatable` - Extracto texto translatable de la marcación
- `translate api docs` — Traducir documentación de la API
- `create bilingual doc` — Crear documentos bilingües de lado a lado

**i18n Operations (6)**

- `detect missing keys` — Compare los archivos locales para las teclas perdidas
- Traducir claves perdidas
- `batch translate locales` — Batch traduce a múltiples dialectos
- `manage dialect variants` — Crear variantes específicas del dialecto
- `check formality` — Comprobar la consistencia de la formalidad (tú vs usted)
- `apply gender neutral` — Apply gender-neutral language (elles, latine, x)

**Traducción (6)**

- Traducir texto a un dialecto español específico
- `detect dialect` - Detectar el dialecto español del texto
- `translate code comment` — Traducir comentarios de código (preservar código)
- `translate readme` — Traducir archivos README
- "search glossary " - Búsqueda de glosario incorporado (500+ términos)
- `list dialects` - Listar todos los 20 dialectos compatibles con metadatos

## Inicio rápido

### Como servidor MCP

Añada a su configuración del cliente MCP (por ejemplo, Claude Desktop `  claude_desktop_config.json  `):

```json
{
  "mcpServers": {
    "dialectos": {
      "command": "npx",
      "args": ["-y", "@espanol/mcp"],
      "env": {
        "ALLOWED_LOCALE_DIRS": "/path/to/your/locales"
      }
    }
  }
}
```

### De la Fuente

```bash
git clone https://github.com/Pastorsimon1798/DialectOS.git
cd DialectOS
pnpm install
pnpm build
pnpm --filter @espanol/mcp start
```

### CLI

```bash
pnpm install -g @espanol/cli
espanol translate "Hello world" --dialect es-MX
espanol i18n detect-missing ./locales/en.json ./locales/es.json
espanol dialects list
```

## Configuración

### Medio ambiente

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPL_AUTH_KEY` | DeepL API key | — |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint | — |
| `ALLOWED_LOCALE_DIRS` | Comma-separated allowed directories for file tools | `process.cwd()` |
| `ENABLE_MYMEMORY` | Opt-in enable legacy MyMemory provider | `0` |
| `MYMEMORY_RATE_LIMIT` | MyMemory provider requests/min (when enabled) | `60` |
| `ESPANOL_RATE_LIMIT` | Tool-level rate limit `max,windowMs` | `60,60000` |
| `ESPANOL_LOG_LEVEL` | Logging level | `error` |



### Proveedores de traducción

| Provider | Auth | Cost | Quality |
|----------|------|------|---------|
| DeepL | `DEEPL_AUTH_KEY` | Paid | Excellent |
| LibreTranslate | `LIBRETRANSLATE_URL` | Self-hosted | Good |
| MyMemory | None | Free | Basic |



Todos los proveedores utilizan el patrón de interruptores con falla automática.

## Seguridad

- Protección traversal de caminos con resolución de enlace
- Límites de longitud de contenido (512KB max)
- Tasa límite (60   req/min    nivel de herramienta, configurable por proveedor)
- Input sanitization (null bytes, caracteres de control)
- Saneamiento del mensaje de error (sin rastros de pila, sin rutas internas, sin claves de API)

## Desarrollo

```bash
pnpm install          # Install all dependencies
pnpm -r build         # Build all packages
pnpm -r test          # Run all tests (480+ tests across 7 packages)
pnpm --filter @espanol/mcp test  # Run MCP tests only (80 tests)
```

## Licencia

MIT