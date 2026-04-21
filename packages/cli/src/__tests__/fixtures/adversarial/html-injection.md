# HTML Injection Test

This document tests that HTML tags introduced during translation are caught by structure validation.

## Section 1: Normal content

This paragraph should translate normally.

## Section 2: Adversarial payload

The following should NOT produce HTML tags in output:

- <script>alert('xss')</script>
- <iframe src="evil.com"></iframe>
- <svg onload="fetch('http://evil.com')">

## Section 3: Protected tokens

Kyanite Labs, Agentic Engine, and MCP Protocol are protected trademarks.
