# @espanol/security

Security utilities for input validation, sanitization, and rate limiting.

## Features

- **SSRF Protection** — Validate URLs against private IPs, localhost, non-HTTP(S) protocols
- **Rate Limiting** — Token bucket rate limiter with configurable windows
- **Path Validation** — Prevent path traversal attacks
- **Content Length Validation** — Enforce maximum payload sizes
- **Error Sanitization** — Strip ANSI sequences and redact sensitive data

## Usage

```typescript
import { validateFilePath, RateLimiter, SecurityError, ErrorCode } from "@espanol/security";

// Validate file path
try {
  const safePath = validateFilePath("../../../etc/passwd");
} catch (e) {
  // Throws: Path traversal detected
}

// Rate limiting
const limiter = new RateLimiter(60, 60000); // 60 requests per minute
await limiter.acquire(); // Throws if rate exceeded

// Structured errors
throw new SecurityError("Invalid input", ErrorCode.INVALID_INPUT);
```
