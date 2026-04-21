# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

Instead, report security concerns via [GitHub Security Advisories](https://github.com/Pastorsimon1798/DialectOS/security/advisories/new) or email the maintainer directly.

We will:
1. Acknowledge receipt within 48 hours
2. Provide an initial assessment within 7 days
3. Issue a fix and coordinated disclosure timeline

## Security Hardening

DialectOS has undergone adversarial security auditing with the following measures in place:

### Input Validation
- **SSRF protection**: All provider endpoint URLs are validated against private IP ranges, localhost, and non-HTTP(S) protocols
- **Path traversal protection**: File paths are validated before any filesystem operations
- **Content length limits**: Maximum payload sizes enforced per provider capability

### Output Safety
- **HTML injection detection**: Structure validator rejects disallowed HTML tags in translated output
- **ANSI sanitization**: Console output strips escape sequences to prevent terminal injection
- **Auth key redaction**: DeepL API keys are automatically redacted from error messages

### Resilience
- **Circuit breaker**: Prevents cascade failures when providers are down
- **Rate limiting**: Per-provider request throttling with configurable windows
- **Atomic writes**: Checkpoint files use temp-file + rename pattern with O_EXCL

### Dependencies
- `pnpm audit` is run in CI — currently **0 vulnerabilities**
- Dependabot alerts are monitored and resolved via `pnpm.overrides`

## Recent Security Work

- April 2026: Resolved 18 Critical/High/Medium findings from adversarial audit
- Added semantic drift detection to catch quality degradation attacks
- Implemented provider capability negotiation for safe request validation
- Added chaos harness for deterministic resilience testing
