# DialectOS Roadmap

This document outlines the planned direction for DialectOS. It is a living document — priorities may shift based on community feedback and contributor interest.

## 🎯 Vision

Become the **most accurate open-source engine for Spanish dialect detection and adaptation**. We focus on depth over breadth: 25 Spanish variants with high-quality keyword detection, register classification, and vocabulary adaptation rules.

## 📅 Short Term (Next 1–3 Months)

### Detection Accuracy
- [ ] **Reduce cross-dialect false positives** — "chévere", "pana", "guagua" appear in multiple dialects; weight context and co-occurrence signals
- [ ] **Grammar feature detection** — Detect voseo ("vos" + verb conjugations), leísmo/laísmo/loísmo, yeísmo distinctions
- [ ] **Confidence calibration** — Better score thresholds so low-confidence input falls back to neutral rather than guessing
- [ ] **Labeled benchmark corpus** — Hand-label 500+ text samples per dialect for accuracy testing

### Register & Style
- [ ] **Finer register granularity** — Split "slang" into "street", "youth", "regional casual"; split "formal" into "business", "academic", "legal"
- [ ] **Register-aware translations** — Pass register signal to LLM providers (GPT-4, Claude) for tone-matched output
- [ ] **Gender-neutral register** — Formal register should default to inclusive language (elles, latine, -e/-x endings where appropriate)

### Adaptation Rules
- [ ] **Grammar adaptations in manage-variants** — Vosotros→ustedes, voseo verb endings, subjunctive variations
- [ ] **Regional phrase replacements** — "Qué lo que" → "¿Qué tal?" for formal contexts, etc.
- [ ] **Number/date/currency formatting** — MM/DD/YYYY for es-US, DD/MM/YYYY for most others, currency symbols

## 📅 Medium Term (3–6 Months)

### Provider Quality
- [ ] **Dialect-specific prompts for LLM providers** — Feed dialect keywords + register markers into GPT-4/Claude prompts for better translations
- [ ] **Provider quality benchmarks per dialect** — Measure which provider (DeepL, GPT-4, LibreTranslate) handles each dialect best
- [ ] **Translation memory / caching** — Cache previously translated strings keyed by (text, dialect, register) to reduce API costs

### Community & Data
- [ ] **Community keyword contributions** — Accept PRs adding verified slang/formal terms per dialect
- [ ] **Dialect research citations** — Link each keyword to a source (academic paper, native speaker survey, regional dictionary)
- [ ] **Coverage dashboard** — Visual map showing which dialects have strong vs weak keyword coverage

## 📅 Long Term (6–12 Months)

### Beyond Text
- [ ] **Speech-to-text dialect detection** — Classify Spanish dialect from audio samples
- [ ] **Real-time chat adaptation** — WebSocket pipeline that rewrites incoming Spanish messages to the recipient's preferred dialect

### Quality & Trust
- [ ] **Human evaluation pipeline** — Native speakers rate translation quality per dialect; feed scores back into provider selection
- [ ] **Adversarial robustness** — Test detection against code-switching (Spanglish, Portuñol), typos, and social media shorthand

## 🗳️ How to Influence the Roadmap

1. **Vote with reactions** — Add 👍 to issues you care about
2. **Open an issue** — Describe the feature and why it matters
3. **Start a discussion** — Share your use case in GitHub Discussions
4. **Contribute code** — The fastest way to get a feature shipped

## ✅ Recently Completed

- [x] **25 Spanish dialects** — Expanded from 20 to 25 (added `es-GQ`, `es-US`, `es-PH`, `es-BZ`, `es-AD`)
- [x] **Formal vs slang register differentiation** — `detectRegister()`, `--register` CLI flag, MCP `register` param
- [x] **Comprehensive dialect adaptations** — 200+ vocabulary rules in `manage-variants` covering all 25 dialects
- [x] Adversarial fixture corpus + CI lane
- [x] Provider capability negotiation
- [x] Semantic drift quality gate
- [x] Versioned checkpoint schema with migration
- [x] Reliability telemetry + health reports
- [x] Provider chaos harness
- [x] Operator policy profiles (strict/balanced/permissive)

---

*Last updated: April 2026*
