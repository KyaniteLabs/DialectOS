# DialectOS Multi-Dimensional Adversarial Audit Report

**Date:** 2026-04-20  
**Auditor:** Kimi Code CLI (autonomous red-team)  
**Scope:** All 7 packages + CI + cross-package comorbidity  
**Test Status:** 480/480 passing (baseline)  
**Open Issues:** 15 tracked (#2–#16)  

---

## Executive Summary

| Severity | Count | Categories |
|----------|-------|------------|
| 🔴 Critical | 4 | SSRF, API key leakage, dangling promises, resource exhaustion |
| 🟠 High | 8 | Timing attacks, Unicode corruption, input validation gaps, TOCTOU |
| 🟡 Medium | 14 | Race conditions, circuit breaker flaws, info disclosure, retry abuse |
| 🟢 Low | 12 | Code hygiene, inconsistency, missing docs, test gaps |

**Key Insight:** The codebase has strong *point defenses* (path validation, error sanitization, structure checks) but significant *interaction failures* — components that are safe in isolation become unsafe when composed. The circuit breaker, rate limiter, and retry policies have mutual blindspots that an adversary can exploit to cause cascading failures or resource exhaustion.

---

## 🔴 CRITICAL

### C1. SSRF via Unvalidated LibreTranslate Endpoint
- **File:** `packages/providers/src/providers/libre-translate.ts:19-35, 93-94`
- **Issue:** `LibreTranslateProvider` accepts arbitrary `endpoint` URL from constructor or `LIBRETRANSLATE_URL` without validation.
- **Exploit:** `endpoint = "http://169.254.169.254/latest/meta-data/"` → fetch() calls AWS IMDS.
- **Fix:** Use `validateUrl()` from `@espanol/security`, block private IP ranges, require known path structure.
- **Status:** NOT covered by any open issue. **New finding.**

### C2. DeepL API Key Leakage in Error Messages
- **File:** `packages/providers/src/providers/deepl.ts:106-113`
- **Issue:** `sanitizeErrorMessage()` only matches `sk-...` and 32+ char hex strings. DeepL keys (e.g., `abc-123-def:fx`) do NOT match these patterns.
- **Exploit:** Trigger auth failure; error propagated to logs/MCP client contains raw key.
- **Fix:** Add DeepL-specific pattern to `sanitizeErrorMessage`, or pre-redact `authKey` in `DeepLProvider` before wrapping error.
- **Status:** NOT covered by any open issue. **New finding.**

### C3. Dangling Promise / Resource Leak on DeepL Timeout
- **File:** `packages/providers/src/providers/deepl.ts:92-97`
- **Issue:** `Promise.race` rejects with timeout error, but underlying `deepl-node` request is NOT cancelled. Socket leaks accumulate.
- **Exploit:** Flood with large translations to slow endpoint. Each timeout leaves a dangling request.
- **Fix:** Use `AbortController` with `fetch`-based REST API instead of SDK, or check if SDK supports cancellation signals.
- **Status:** NOT covered by any open issue. **New finding.**

### C4. Unbounded Memory Growth in RateLimiter
- **File:** `packages/security/src/index.ts:563-596`
- **Issue:** `RateLimiter.requests` array is only filtered on `acquire()`. Under sustained load below the threshold, the array grows without bound (one entry per request).
- **Exploit:** Send 1,000,000 requests at 59/min. Array has 1M entries → ~8MB+ heap growth, never cleaned until `acquire()` is called again.
- **Fix:** Cap array size, or use a circular buffer / counter approach instead of storing every timestamp.
- **Status:** NOT covered by any open issue. **New finding.**

---

## 🟠 HIGH

### H1. Response Body Hang — No Timeout on `response.json()`
- **File:** `packages/providers/src/providers/libre-translate.ts:101-117`, `packages/providers/src/providers/my-memory.ts:136-162`
- **Issue:** `clearTimeout(timeoutId)` is called immediately after `fetch()` resolves, BEFORE `response.json()` is awaited. Malicious server sends headers fast but stalls body.
- **Exploit:** Compromised LibreTranslate sends `Content-Type: application/json` then hangs. Process blocks forever.
- **Fix:** Keep `AbortController` active until full body is parsed. Wrap `response.json()` in a second timeout race.
- **Status:** NOT covered by any open issue. **New finding.**

### H2. Missing Input Validation on Language Codes
- **File:** All provider `translate()` methods
- **Issue:** `@espanol/types` exports `languageCodeSchema` and `formalitySchema`, but NO provider uses them. Arbitrary strings passed to external APIs.
- **Exploit:** `targetLang = "es'); DROP TABLE translations; --"` — passed directly to APIs. While APIs likely sanitize, this bypasses client-side safety nets.
- **Fix:** Validate all inputs with Zod schemas before calling providers.
- **Status:** Related to #8 (provider capability negotiation) but more fundamental. **New finding.**

### H3. MyMemory Chunking Breaks Surrogate Pairs
- **File:** `packages/providers/src/providers/my-memory.ts:76-110`
- **Issue:** `chunkText` uses UTF-16 `String.prototype.slice()`. Emojis and historic scripts (surrogate pairs) split at chunk boundaries.
- **Exploit:** Text with emoji at position 449: `"a".repeat(449) + "😀"` → slice produces lone surrogate `\uD83D`.
- **Fix:** Use `Intl.Segmenter` or grapheme-cluster-aware library for chunking.
- **Status:** NOT covered by any open issue. **New finding.**

### H4. No Maximum Text Length Validation in Providers
- **File:** All provider `translate()` entry points
- **Issue:** None validate `text.length` before sending to APIs or chunking. Multi-megabyte strings cause memory exhaustion and excessive billing.
- **Exploit:** `provider.translate("a".repeat(50_000_000), ...)`
- **Fix:** Enforce `MAX_CONTENT_LENGTH` (50,000 chars) at provider boundary.
- **Status:** NOT covered by any open issue. **New finding.**

### H5. TOCTOU in Checkpoint File Operations
- **File:** `packages/cli/src/lib/checkpoint.ts:42-44`
- **Issue:** `saveCheckpoint` uses `fs.writeFile` without atomic write pattern. If process crashes during write, checkpoint is corrupted.
- **Exploit:** Kill process during large translation; checkpoint file is partial JSON.
- **Fix:** Use atomic write pattern (write to temp + rename) like `locale-utils` does.
- **Status:** NOT covered by any open issue. **New finding.**

### H6. Race Condition in Checkpoint Concurrent Access
- **File:** `packages/cli/src/commands/translate-api-docs.ts:245-251`, `translate-readme.ts:218-225`
- **Issue:** Checkpoint saved inside the translation loop. If two processes translate the same file concurrently, checkpoints interleave and corrupt.
- **Exploit:** Run two `translate-api-docs` instances on same file simultaneously.
- **Fix:** Use file locking, or write checkpoint atomically with `O_EXCL` temp file + rename.
- **Status:** NOT covered by any open issue. **New finding.**

### H7. Command Injection via Filename in Error Messages
- **File:** `packages/cli/src/commands/translate-api-docs.ts:185`, `translate-readme.ts:228`
- **Issue:** `console.error` logs raw section content on translation failure. If section contains ANSI escape sequences or terminal control codes, they execute in the operator's terminal.
- **Exploit:** Markdown file containing `\x1b[2J\x1b[H` (clear screen) in a section. On translation failure, terminal clears.
- **Fix:** Sanitize console.error output — strip control sequences or use structured logging.
- **Status:** NOT covered by any open issue. **New finding.**

### H8. Path Traversal in Auto-Generated Checkpoint Paths
- **File:** `packages/cli/src/commands/translate-api-docs.ts:297-298`, `translate-readme.ts:159`
- **Issue:** `rawCheckpointPath = \`${options.output || validatedPath}.checkpoint.json\`` — if `options.output` contains `../`, the checkpoint is written outside allowed directories.
- **Exploit:** `options.output = "../../../tmp/evil"` → checkpoint writes to `/tmp/evil.checkpoint.json`.
- **Fix:** Always validate the final checkpoint path through `validateFilePath()`, even for auto-generated paths.
- **Status:** NOT covered by any open issue. **New finding.**

---

## 🟡 MEDIUM

### M1. Circuit Breaker Race Condition in Half-Open State
- **File:** `packages/providers/src/circuit-breaker.ts:22-83`
- **Issue:** `canExecute()` and `getState()` both mutate state. Multiple concurrent requests can pass through half-open. If one fails, others still call `recordSuccess()`/`recordFailure()`, corrupting recovery.
- **Fix:** Make `getState()` pure. Use atomic probe flag in `canExecute()` — only ONE request allowed through half-open.
- **Status:** Related to #13 (chaos harness) but specific bug. **New finding.**

### M2. MyMemory Breaker Success-Flood Masking Failures
- **File:** `packages/providers/src/providers/my-memory.ts:112-177`
- **Issue:** `recordSuccess()` called per CHUNK. Large text = 50 successes masking 1 failure. Breaker never opens.
- **Fix:** Record success/failure at REQUEST level, not chunk level.
- **Status:** NOT covered by any open issue. **New finding.**

### M3. MyMemory Retries on 4xx Client Errors
- **File:** `packages/providers/src/providers/my-memory.ts:149-151, 178-199`
- **Issue:** Retry loop does not distinguish 4xx from 5xx. `400 Bad Request` retried up to 4 times.
- **Fix:** Inspect `response.status`. If 4xx, fail immediately without retry.
- **Status:** NOT covered by any open issue. **New finding.**

### M4. Retry Policy Missing Total Timeout and Abort Support
- **File:** `packages/providers/src/retry.ts:16-42`
- **Issue:** No global deadline on retry loops. Long backoff can exceed caller's timeout, consuming event-loop time.
- **Fix:** Add `AbortSignal` and `maxTotalDurationMs` parameters.
- **Status:** NOT covered by any open issue. **New finding.**

### M5. Rate Limiter is Request-Based, Not Character-Based
- **File:** All providers
- **Issue:** DeepL free tier is 500K chars/month, but limiter counts requests. 10 requests of 50K chars each exhaust quota without triggering limiter.
- **Fix:** Add character-based quota tracker alongside request-based limiter.
- **Status:** NOT covered by any open issue. **New finding.**

### M6. `ProviderRegistry.getAuto()` Has No Load Balancing
- **File:** `packages/providers/src/registry.ts:48-56`
- **Issue:** Always returns first provider in insertion order. Healthy provider #2 never used if #1 is slow but not failed enough to open circuit.
- **Fix:** Implement round-robin or latency-aware selection.
- **Status:** Related to #8. **New finding.**

### M7. Information Disclosure in Registry Errors
- **File:** `packages/providers/src/registry.ts:40, 55`
- **Issue:** Error messages expose internal architecture (`Provider not found: ${name}`, `all circuits are open`).
- **Fix:** Return generic messages externally, log detailed internally.
- **Status:** NOT covered by any open issue. **New finding.**

### M8. Token Protection Regex Denial of Service
- **File:** `packages/cli/src/lib/token-protection.ts:54-57`
- **Issue:** `restoreProtectedTokens` builds regex from placeholder: `new RegExp("\\b" + normalized + "\\b", "g")`. If placeholder contains regex metacharacters (from adversarial input), it can cause ReDoS.
- **Exploit:** Token containing `(__ESPANOL_TOKEN_0__)` with nested groups → catastrophic backtracking.
- **Fix:** Escape regex metacharacters before building pattern, or use `String.prototype.replaceAll()` instead.
- **Status:** NOT covered by any open issue. **New finding.**

### M9. Markdown Parser URL Regex ReDoS
- **File:** `packages/markdown-parser/src/index.ts:57-89`
- **Issue:** `extractUrlsFromContent` uses greedy regex `\[([^\]]+)\]\(([^)]+)\)` on unbounded input. Specially crafted markdown with nested brackets causes exponential backtracking.
- **Exploit:** `"[".repeat(10000) + "](http://x.com)"` → process hangs.
- **Fix:** Use a proper markdown parser for URL extraction, or cap input size before regex matching.
- **Status:** NOT covered by any open issue. **New finding.**

### M10. MCP Server Stdio Protocol Contamination
- **File:** `packages/mcp/src/index.ts:66-70`
- **Issue:** `console.error` in error handlers writes to stderr, which is okay for MCP, BUT `createSafeError` in `@espanol/security` also uses `console.error`. Any library call that triggers error sanitization contaminates stderr with non-JSON output.
- **Fix:** In MCP context, redirect all logging to a file or use a structured logger that respects MCP protocol boundaries.
- **Status:** NOT covered by any open issue. **New finding.**

### M11. Dialect Detection Keyword Pollution
- **File:** `packages/mcp/src/tools/translator.ts:570-650`
- **Issue:** `detect_dialect` uses simple keyword inclusion. An adversary can craft text with keywords from multiple dialects to manipulate detection.
- **Exploit:** `"vosotros computadora auto papa"` → scores for both es-ES and es-MX. Order-dependent tie-breaking is unpredictable.
- **Fix:** Use normalized scoring, document tie-breaking, or reject ambiguous inputs.
- **Status:** NOT covered by any open issue. **New finding.**

### M12. Gender-Neutral Transform Regex Injection
- **File:** `packages/mcp/src/tools/i18n.ts:169-229`, `packages/cli/src/commands/i18n/apply-gender-neutral.ts`
- **Issue:** `new RegExp("\\b" + source + "\\b", "gi")` — if `source` contains regex metacharacters, it causes unexpected behavior or ReDoS.
- **Exploit:** Locale value containing `(a+)+` as a "word" to transform.
- **Fix:** Escape regex metacharacters in source terms before building patterns.
- **Status:** NOT covered by any open issue. **New finding.**

### M13. Structure Validator HTML Tag Bypass
- **File:** `packages/cli/src/lib/structure-validator.ts:64-75`
- **Issue:** Tag regex `<([a-z][a-z0-9-]*)\b[^>]*>` can miss uppercase tags (`<SCRIPT>`) and tags with newlines in attributes.
- **Exploit:** Translated content contains `<SCRIPT\nSRC=...>` — regex fails to match.
- **Fix:** Use case-insensitive flag and multiline-aware parsing, or use DOMPurify for tag extraction.
- **Status:** NOT covered by any open issue. **New finding.**

### M14. Locale-Utils Has Its Own (Weaker) Security Implementation
- **File:** `packages/locale-utils/src/index.ts:36-108`
- **Issue:** Duplicates `SecurityError`, `ErrorCode`, `sanitizeErrorMessage`, `validateJsonPath` inline with weaker implementations. `validateJsonPath` does NOT check path traversal or allowed directories.
- **Exploit:** `readLocaleFile("../../../etc/passwd")` succeeds because extension-only check.
- **Fix:** Import from `@espanol/security` instead of duplicating. The comment says "inline for now until package is implemented" — it IS implemented.
- **Status:** NOT covered by any open issue. **New finding.**

---

## 🟢 LOW

### L1. Unused `HTTP_TIMEOUT` Import in MyMemory
- **File:** `packages/providers/src/providers/my-memory.ts:8`
- **Issue:** `HTTP_TIMEOUT` imported but never used. MyMemory has its own `DEFAULT_MYMEMORY_TIMEOUT`.
- **Fix:** Remove unused import or consolidate timeout handling.

### L2. LibreTranslate Ignores `options.context` and `options.dialect`
- **File:** `packages/providers/src/providers/libre-translate.ts:53-62`
- **Issue:** Accepts context/dialect but silently drops them. Functional bug causing incorrect translations.
- **Fix:** Pass supported options or throw if unsupported options are provided.

### L3. MyMemory `chunkText` Early Return Logic Mismatch
- **File:** `packages/providers/src/providers/my-memory.ts:77-79`
- **Issue:** `MAX_CHARS` is 500 but `CHUNK_SIZE` is 450. Early return uses 500, causing inconsistency.
- **Fix:** Unify logic — chunk at `CHUNK_SIZE` (450), validate against `MAX_CHARS` (500).

### L4. `translate-readme` Uses Hardcoded `"es"` as Target Language
- **File:** `packages/cli/src/commands/translate-readme.ts:201`
- **Issue:** Calls `translateWithFallback(..., "en", "es", ...)` — dialect info in `translateOptions` but targetLang is always `"es"`, not the specific dialect.
- **Fix:** Pass `options.dialect` as targetLang, consistent with `translate-api-docs`.

### L5. Missing Test Coverage for Critical Paths
- **Files:** All provider tests, CLI tests
- **Gaps:**
  - No SSRF tests for LibreTranslate endpoint
  - No timeout-during-response-body tests
  - No malformed JSON response tests
  - No Unicode surrogate pair splitting tests
  - No concurrent circuit breaker corruption tests
  - No 4xx error retry behavior tests
  - No DeepL key leakage tests with non-`sk-` formatted keys
  - No checkpoint concurrent access tests
  - No path traversal in auto-generated checkpoint path tests
  - No ReDoS tests for token protection or URL extraction

### L6. Quality Score Has No Semantic Component
- **File:** `packages/cli/src/lib/quality-score.ts`
- **Issue:** Scores are based on token integrity, glossary fidelity, and structure. No check for semantic drift (meaning change).
- **Fix:** Add back-translation similarity or embedding-based semantic check. This is tracked as #9.

### L7. No Adversarial CI Lane
- **File:** `.github/workflows/ci.yml`
- **Issue:** CI only runs unit tests. No continuous adversarial testing.
- **Fix:** Add adversarial fixture corpus as required CI job. Tracked as #11.

### L8. Generated Artifacts Not Excluded from Git
- **File:** `.gitignore`
- **Issue:** Checkpoint files (`*.checkpoint.json`) not in `.gitignore`. Tests create them in cwd.
- **Fix:** Add checkpoint patterns to `.gitignore`. Tracked as #15.

### L9. MCP Tool Schemas Allow Invalid Dialect Codes
- **File:** `packages/mcp/src/tools/translator.ts:976`, `packages/mcp/src/tools/docs.ts:422`
- **Issue:** Zod schema is `z.string().optional()` for dialect, not `dialectSchema`. Invalid dialects passed through to providers.
- **Fix:** Use `dialectSchema` from `@espanol/types` in all MCP tool registrations.

### L10. Batch Translate Missing Input Sanitization
- **File:** `packages/mcp/src/tools/i18n.ts:407-490`
- **Issue:** Errors array in response concatenates raw error messages: `errors.push(`${targetDialect}/${entry.key}: ${error}`)`. Can leak internal paths or provider details.
- **Fix:** Sanitize error messages before adding to response.

### L11. `detectIdentityTokens` False Positives on File Paths
- **File:** `packages/cli/src/lib/token-protection.ts:62-78`
- **Issue:** Domain regex `/\b[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}\b/g` matches file paths like `config.json`, `package.lock`.
- **Fix:** Require TLD from known domain list, or exclude common file extensions.

### L12. Missing `Content-Length` Check in MCP File Tools
- **File:** `packages/mcp/src/tools/translator.ts:775-778`, `packages/mcp/src/tools/docs.ts:86-89`
- **Issue:** `readFileSync` reads entire file before `validateContentLength`. A multi-GB file will exhaust memory before validation.
- **Fix:** Check file size with `statSync` before reading, or stream read with size limit.

---

## Cross-Package Comorbidity Matrix

| Attack Vector | Security | Providers | CLI | MCP | Impact |
|--------------|----------|-----------|-----|-----|--------|
| SSRF via Libre endpoint | — | C1 | — | — | Data exfiltration |
| API key leak in errors | C2 | C2 | — | — | Credential exposure |
| Dangling promises | — | C3 | — | — | Resource exhaustion |
| Rate limiter unbounded growth | C4 | — | — | — | Memory DoS |
| Concurrent checkpoint corruption | — | — | H6 | — | Data corruption |
| Half-open breaker flood | — | M1 | — | — | False recovery |
| Token regex ReDoS | — | — | M8 | — | CPU exhaustion |
| URL regex ReDoS | — | — | — | M9 | CPU exhaustion |
| Locale-utils path bypass | H8 (locale-utils) | — | — | — | File read |
| Structure validator bypass | — | — | M13 | — | HTML injection |
| Error info disclosure | — | M7 | H7 | M10 | Reconnaissance |

---

## Recommendations by Priority

### Immediate (This Week)
1. Fix SSRF in LibreTranslate (C1) — validate endpoint URL
2. Fix DeepL key leakage (C2) — add DeepL key pattern to sanitizer
3. Fix dangling promises (C3) — use abortable fetch or SDK cancellation
4. Fix RateLimiter memory growth (C4) — cap array or use counter
5. Fix path traversal in checkpoint paths (H8) — always validate

### Short-Term (Next 2 Weeks)
6. Fix response.json() hang (H1) — keep timeout active
7. Add language code validation (H2) — use Zod schemas
8. Fix surrogate pair splitting (H3) — Unicode-aware chunking
9. Add text length limits (H4) — enforce at provider boundary
10. Fix circuit breaker race condition (M1) — atomic probe flag
11. Fix locale-utils security duplication (M14) — import from `@espanol/security`

### Medium-Term (Next Month)
12. Build provider chaos harness (#13)
13. Add adversarial CI lane (#11)
14. Add semantic drift quality gate (#9)
15. Versioned checkpoint schema (#10)
16. Standardize operator policy profiles (#14)

---

## Test Gap Inventory

| Component | Current Tests | Missing Tests |
|-----------|--------------|---------------|
| Security | 65 | Unicode path normalization, null byte variations, ReDoS, max array growth |
| Providers | 35 | SSRF, timeout-body-hang, 4xx-retry, surrogate-pairs, concurrent breaker, key-leak |
| MCP | 80 | Invalid dialect rejection, file size pre-check, error protocol contamination |
| CLI | 171 | Concurrent checkpoint, path traversal checkpoint, ANSI injection, ReDoS |
| Markdown Parser | 73 | ReDoS on URL regex, nested bracket exhaustion |
| Locale Utils | 55 | Path traversal via duplicated validateJsonPath, atomic write failure |
| Types | 41 | Schema validation edge cases |

**Total Missing Test Coverage:** ~45+ adversarial scenarios not currently tested.

---

*End of Report*
