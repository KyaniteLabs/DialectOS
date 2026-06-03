> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Reddit Post: r/javascript

**Title:** We built an MCP server for Spanish dialect translation in TypeScript — automated tests, 25 dialects

**Body:**

Hey r/javascript — wanted to share a project we've been working on.

**DialectOS** is a Spanish dialect translation engine built as a TypeScript monorepo. It exposes 17 MCP tools and a CLI.

**Why TypeScript?**

Because the target users are JavaScript developers who need to localize apps for Latin America. The MCP server integrates with Claude Desktop, Cursor, and any MCP-compatible client.

**Workspace structure:**

```
packages/
  @dialectos/mcp          — 17 tools, stdio JSON-RPC server
  @dialectos/cli          — CLI commands + quality gates
  @dialectos/providers    — LLM/DeepL/LibreTranslate with circuit breaker
  @dialectos/security     — Rate limiting, SSRF protection
  @dialectos/types        — Shared types + glossary data
  @dialectos/locale-utils — JSON locale diff/merge
  @dialectos/markdown-parser — Structure-preserving markdown AST
```

**Key technical decisions:**

1. **pnpm workspace** — clean dependency graph, shared tsconfig
2. **MCP over stdio** — not HTTP, so no server needed for local use
3. **Provider registry pattern** — LLM primary, DeepL fallback, LibreTranslate fallback
4. **Translation memory** — SHA-256 keyed cache with TTL + LRU eviction
5. **Adversarial fixtures** — automated tests including semantic drift, negation gates, grammar detection

**Quality gates** are the fun part:

```typescript
// Semantic backstop catches "Do not click" → "Haz clic"
const result = combinedSemanticCheck(source, translated);
if (result.negationDropped) {
  return { passed: false, finalScore: 0.1 };
}
```

**Try it:**

```bash
GitHub Release tarball or local source checkout
dialectos translate "Hello world" --dialect es-MX
```

**Repo:** https://github.com/KyaniteLabs/DialectOS

Feedback welcome! Especially on the MCP stdio implementation and the provider fallback chain.
