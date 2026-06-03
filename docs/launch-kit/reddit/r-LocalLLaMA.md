> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Reddit Post: r/LocalLLaMA

**Title:** DialectOS: Translate to 25 Spanish variants with any local LLM (LM Studio, Ollama compatible)

**Body:**

If you're running local models and need to translate content to Spanish dialects, most tools assume you want generic "Spanish."

But local models can do much better with the right prompts.

**DialectOS** is an open-source translation engine that feeds dialect-specific prompts + grammar profiles + glossary constraints to any LLM:

**Compatible with:**
- LM Studio (native API)
- Ollama (via OpenAI-compatible endpoint)
- Any OpenAI-compatible local server

**What it does:**

```bash
# Test any local model against 25 Spanish dialects
LM_STUDIO_URL="http://127.0.0.1:1234" \
LLM_MODEL="qwen3.5-9b" \
LLM_API_FORMAT="lmstudio" \
pnpm dialect:certify -- --live --provider=llm --out=/tmp/certify
```

This runs adversarial tests and writes:
- `events.jsonl` — per-sample results
- `progress.json` — live progress
- `results.json` — aggregate scores

**Certified models for v0.3.0:**
- `glm-4.5-air` (cloud, Anthropic-compatible)
- `qwen3.5-9b` (local, via LM Studio)

**Features:**
- 25 Spanish dialects with regional vocabulary
- Voseo detection (Argentina, Uruguay)
- Leísmo/laísmo/loísmo grammar detection
- Semantic backstop catches drift
- Translation memory with SHA-256 cache
- automated tests

**Repo:** https://github.com/KyaniteLabs/DialectOS

Has anyone else worked on dialect-aware prompting for local models? Curious about your approaches.
