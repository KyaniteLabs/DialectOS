> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
---
title: "How We Built Adversarial Quality Gates for AI Translation"
published: false
description: "Four quality dimensions, semantic drift detection, and adversarial traps that catch bad translations before they reach users."
tags: translation, ai, quality-assurance, testing, spanish, mcp, nlp, typescript
---

# How We Built Adversarial Quality Gates for AI Translation

LLMs are great at translation — until they're not.

We've seen GPT-4 translate "Do not click this button" into "Haz clic en este botón" (the exact opposite meaning). We've seen it preserve English phrases inside Spanish output. We've seen it break markdown tables and drop code fences.

That's why we built **adversarial quality gates** into DialectOS.

## The Four Dimensions

Every translation gets scored on:

```
Quality Score = tokenIntegrity×25% + glossaryFidelity×30% + structureIntegrity×20% + semanticSimilarity×25%
```

### 1. Token Integrity (25%)

Are protected terms preserved? If your glossary says "Kyanite Labs" must stay "Kyanite Labs," a translation to "Cianita Labs" fails this gate.

**Test:** Exact string match for glossary-protected terms.

### 2. Glossary Fidelity (30%)

Are enforced terminology rules followed? If the glossary maps "API" → "API" (not "Interfaz de programación"), any deviation fails.

**Test:** Term-level exact matching against glossary mappings.

### 3. Structure Integrity (20%)

Is markdown structure intact? Missing code fences, broken tables, or shifted headers all fail.

**Test:** Parse translated markdown and compare AST structure to source.

### 4. Semantic Similarity (25%)

Has meaning drifted? This is the hardest and most important.

**Test:** Cross-lingual presence detection + length ratio + entity preservation.

## The Semantic Backstop

When the heuristic score is borderline (0.35–0.6), a second gate kicks in:

1. **Negation preservation** — Count negation words in source vs translated. If source says "don't" and translated drops it → fail.
2. **Keyword overlap** — Content word overlap weighted by frequency.
3. **Structural parity** — Sentence count ratio, paragraph count ratio.

Example failure:
- Source: `"Do not, under any circumstances, proceed!"`
- Translated: `"Procede inmediatamente."`
- Result: **Negation dropped → auto-rejected**

## Adversarial Test Fixtures

We maintain a corpus of adversarial traps:

| Trap Type | Example | What It Tests |
|-----------|---------|---------------|
| **Paraphrase** | "The meeting was canceled" vs "We called off the meeting" | Semantic consistency under rephrasing |
| **Dialect collision** | Same text translated to 2 different dialects | Dialect differentiation |
| **Taboo copy** | English phrases copied into Spanish output | Copy-paste failure detection |
| **Placeholder** | `"{{username}}"` → missing or translated | Template preservation |
| **Register** | Formal text with slang markers | Register consistency |
| **Repeatability** | Same input translated twice | Determinism check |

## The Certification Pipeline

We run three certification modes:

1. **`dialect:certify`** — Sentence-level fixtures, writes incremental progress
2. **`dialect:certify:adversarial`** — All traps above + failure matrix
3. **`dialect:certify:documents`** — README/API-doc/locale JSON flows

Each produces:
- `events.jsonl` — per-sample results
- `progress.json` — live progress
- `results.json` — aggregate scores
- `failure-matrix.md` — categorized failures

## Numbers

- **automated tests** across 7 packages
- **18 CVEs** resolved
- **4 quality gates** with semantic backstop
- **6 adversarial trap categories**
- **0** silent static fallback paths

## Try It

```bash
GitHub Release tarball or local source checkout
dialectos translate "Do not proceed" --dialect es-MX
# If negation drops, you'll see the quality gate fail explicitly
```

## Why This Matters

Most translation tools fail silently. They give you output that *looks* correct but means the wrong thing. DialectOS makes every failure visible.

---

*What's the worst translation bug you've seen in production?*
