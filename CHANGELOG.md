# Changelog

All notable changes to DialectOS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-20

### Added

#### Security & Resilience
- Adversarial fixture corpus for CI regression testing (4 fixtures, 6 tests)
- Adversarial CI lane with pass/fail thresholds
- Provider capability negotiation with language normalization
- Provider chaos harness with 7 deterministic failure modes
- Versioned checkpoint schema (v1) with migration and retention
- Operator policy profiles: strict, balanced, permissive
- Semantic drift quality gate with heuristic similarity scoring
- Reliability telemetry collector with health reports

#### Infrastructure
- SSRF protection on all provider endpoints
- Circuit breaker with half-open probe locks
- Atomic checkpoint writes using temp-file + rename pattern
- HTML injection detection in translated output
- Prototype pollution protection in checkpoint loading
- Rate limiting with configurable windows per provider

#### Quality
- Word overlap, length ratio, and entity preservation semantic scoring
- Structure validation for markdown (tables, code blocks, links)
- Glossary enforcement with strict mode
- Protected token preservation for brand names and identifiers
- Quality score now includes semantic similarity component

#### Providers
- DeepL provider with formality mapping and context support
- LibreTranslate provider with endpoint SSRF validation
- MyMemory provider with grapheme-aware chunking
- Provider registry with capability-based validation

#### CLI
- `translate-readme` with checkpoint resumption
- `translate-api-docs` with partial failure policies
- `i18n detect-missing` for locale file comparison
- `i18n batch-translate` for multi-dialect workflows
- `dialects list` with metadata for all 20 variants

#### MCP
- 16 MCP tools for markdown, i18n, and translation operations
- Structured JSON error handling
- Graceful shutdown on SIGINT/SIGTERM

[0.1.0]: https://github.com/Pastorsimon1798/DialectOS/releases/tag/v0.1.0
