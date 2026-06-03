# DialectOS Release Runbook

## Version Bump Process

1. Update version in root `package.json` and all `packages/*/package.json`.
2. Update `CHANGELOG.md` with changes since last release.
3. Run the full verification commands below.
4. Create a git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
5. Push the tag: `git push origin vX.Y.Z`.

## Clean Verification Commands

From a clean checkout:

```bash
rm -rf packages/*/dist
pnpm install --frozen-lockfile
pnpm build
pnpm -r exec tsc --noEmit
pnpm test
pnpm test:coverage
pnpm audit --audit-level=moderate
node scripts/benchmark.mjs --out=/tmp/dialectos-benchmark
node scripts/benchmark-detection.mjs --out=/tmp/dialectos-detection
pnpm dialect:certify -- --fail-on-warnings=true --judge=true --out=/tmp/dialectos-cert
pnpm dialect:certify:adversarial -- --fail-on-warnings=true --judge=true --out=/tmp/dialectos-adv
pnpm dialect:certify:documents -- --live=true --policy=strict --out=/tmp/dialectos-doc-cert
mkdir -p /tmp/dialectos-pack
for pkg in packages/*; do
  [ -f "$pkg/package.json" ] || continue
  (cd "$pkg" && pnpm pack --pack-destination /tmp/dialectos-pack)
done
docker compose config
```

## npm Publish Order

Publish in dependency order:

1. `@dialectos/types`
2. `@dialectos/security`
3. `@dialectos/locale-utils`
4. `@dialectos/markdown-parser`
5. `@dialectos/providers`
6. `@dialectos/cli`
7. `@dialectos/mcp`

## GitHub Release

After tagging and verifying CI passes, create a GitHub Release from the tag.
The release notes are auto-generated from PR labels per `.github/release.yml`.

## Rollback / Unpublish Policy

- Within 72 hours of publish: `npm unpublish <package>@<version>`
- After 72 hours: publish a patch version with the fix; do not unpublish

## License Note

All packages are released under Apache-2.0.
