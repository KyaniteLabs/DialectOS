# ADR 0001: Publishable Packages Use Concrete Semver, Not `workspace:*`

## Status

Superseded by the v0.3.0 GitHub Release tarball distribution path.

Current release packaging uses `pnpm pack`/`pnpm publish --dry-run` because pnpm rewrites `workspace:*` dependencies in packed artifacts. npm registry publishing remains optional and guarded.

## Context

DialectOS is a pnpm workspace monorepo. Internal packages currently declare cross-dependencies with `workspace:*`:

```json
"@dialectos/types": "workspace:*"
```

This is idiomatic for pnpm development: it guarantees the local version is always used and prevents version drift during active development.

However, `workspace:*` is **not resolvable by npm**. When consumers run `npm install @dialectos/cli` from a published tarball, npm encounters `workspace:*` in the transitive dependency tree and fails.

The v0.3.0 release distributes package tarballs through GitHub Releases. npm registry publishing is optional and intentionally guarded because it requires an npm token.

## Decision

Keep `workspace:*` for local development and use pnpm-based release packaging so published tarballs receive concrete dependency versions.

## Consequences

### Positive
- GitHub Release tarballs keep local workspace development simple while still producing installable artifacts.
- `scripts/tarball-smoke.mjs` verifies packed artifacts do not leak `workspace:*`.
- npm registry publishing can be enabled later without changing local development dependency declarations.

### Negative
- Consumers install from GitHub Release tarball URLs until npm publishing is explicitly enabled.
- The release workflow must continue using pnpm packaging; raw `npm pack` does not rewrite workspace protocol dependencies.

## Alternatives Considered

1. **Keep `workspace:*` and rely on pnpm publish rewrite.**
   - pnpm can rewrite `workspace:*` to the actual version during `pnpm publish`.
   - Accepted for v0.3.0 because the release workflow and tarball smoke tests now use pnpm packaging.

2. **Use `workspace:^0.3.0`.**
   - Still workspace-protocol; npm cannot resolve it.
   - Rejected for the same consumer-compatibility reason.
