> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Reddit Post: r/selfhosted

**Title:** DialectOS — Self-hosted Spanish dialect translation via MCP (25 variants, automated tests)

**Body:**

I've been building DialectOS — an open-source Spanish dialect translation server that runs entirely self-hosted.

**The problem it solves:**

Every translation API treats Spanish as one language. But "orange juice" in Puerto Rico is "jugo de china," not "jugo de naranja." "Car" is "coche" in Spain, "carro" in Mexico, and "auto" in Argentina.

Generic Spanish fails 24 out of 25 countries.

**What DialectOS does:**

- Translates to **25 Spanish regional variants** (es-MX, es-AR, es-PR, es-CL, etc.)
- Runs as an **MCP server** — Claude Desktop, Cursor, etc. can use it natively
- **Self-hosted** — works with LM Studio, Ollama, or any local LLM
- Preserves markdown structure (tables, code blocks, links)
- Applies adversarial quality gates (catches semantic drift, negation drops)
- i18n locale file diff/merge

**Self-hosting setup:**

```bash
git clone https://github.com/KyaniteLabs/DialectOS.git
cd DialectOS
pnpm install
pnpm build

# Run with local LLM via LM Studio
LM_STUDIO_URL="http://127.0.0.1:1234" \
LLM_MODEL="qwen3.5-9b" \
LLM_API_FORMAT="lmstudio" \
pnpm dialect:eval -- --live --provider=llm
```

**Tech stack:** TypeScript, pnpm workspace, 7 packages, automated tests.

**License:** Apache-2.0.

Demo: https://kyanitelabs.github.io/DialectOS
Repo: https://github.com/KyaniteLabs/DialectOS

Would love feedback from the selfhosted community!
