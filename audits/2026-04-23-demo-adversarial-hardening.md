# Demo/API adversarial hardening — 2026-04-23

## Scope
Public demo server and landing-page integration for `dialectos.kyanitelabs.tech`.

## Failure modes found and addressed

| Class | Finding | Fix | Regression evidence |
| --- | --- | --- | --- |
| Public source exposure | The demo server would serve repo files such as `/package.json`, `/scripts/demo-server.mjs`, `/packages/cli/src/lib/web-demo-service.ts`, and traversal variants like `/docs/../package.json`. | Replaced repo-root static serving with a public-file allowlist. | `demo server does not expose repo implementation files as public assets` |
| Malformed URL path | Bad percent-encoded static paths surfaced as HTTP 500. | Malformed static paths now return HTTP 400 with a client error. | `demo server treats malformed encoded static paths as bad requests` |
| Dirty JSON body | `null` JSON could produce server errors instead of a client error. | Translation body must be a JSON object before service execution. | `demo server rejects non-object JSON bodies before translation` |
| Non-string field coercion | Object/array values in `text`, `provider`, or `formality` could reach translation services or cause misleading 500s. | Required/optional string fields are validated before service execution. | `demo server rejects non-string translation fields before translation` |
| Local hardening headers | Static/JSON responses relied on upstream headers in production but not local/demo-server behavior. | Added baseline `x-content-type-options: nosniff` and `referrer-policy` headers to JSON/static responses. | Covered by server response tests and manual probes |

## Explicitly retained
- `/docs/full-app-demo.md` remains public for the container guide.
- `/docs/index.html`, `/index.html`, `/`, and `/docs/dialectos-engine.js` remain public where needed.
- `/api/status` and `/api/translate` behavior remains provider-backed; no static translation fallback was introduced.

## Remaining watchlist
- The live Traefik layer still owns production security headers such as HSTS and noindex.
- The server intentionally returns provider/quality errors visibly; future work can introduce stable error codes without hiding failures.
