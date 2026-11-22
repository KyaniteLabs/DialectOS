# DialectOS — Wave 3 vendor-surface package (STAGED, unsubmitted)

STAGED PACKAGING ONLY. Not submitted, not listed, not published.
Wave 3 vendor-surface packaging for in-repo review. CEO-gated per surface.
Voice assets are DO-NOT-COMMIT. Copy pack remains ungated draft.


Version: `0.3.1`

## Surfaces in this tree

- Claude Code: `.claude-plugin/plugin.json` + `.mcp.json`
- ZCode: `.zcode-plugin/plugin.json`
- MiniMax community format: `.minimax-plugin/plugin.json` (no icon.png — MiniMax incomplete)
- Grok catalog payload: `.grok-plugin/entry.json` (UNSUBMITTED)
- OpenCode npm source: `opencode-plugin/` (`private: true`)
- Kimi: `kimi-plugin/README.md`
- DSH: blocked

## MCP launch (stdio, if applicable)

```
pnpm dlx https://github.com/KyaniteLabs/DialectOS/releases/download/v0.3.0/dialectos-mcp-0.3.0.tgz
```

## Explicit non-actions

- No marketplace upload, directory submit, npm publish, or MCP registry publish.
- No GPU window. No CS candidate verdict.
- Publishing/listing remains CEO-gated per surface.

## Gaps still blocked

- No marketplace upload.
- `@kyanitelabs/dialectos` npm 404 — smithery.yaml that targets it was NOT added to the product repo.
- MCP registry record is `tech.kyanitelabs/dialectos@0.1.0` with empty packages; repo package is 0.3.1; working MCP artifact is GitHub Release v0.3.0 tarball. These three are not the same binding.
- MiniMax missing icon.png.
- Grok SHA unpinned. DSH schema unverified.
- Voice/copy gate BLOCKED; ungated copy pack not used.
