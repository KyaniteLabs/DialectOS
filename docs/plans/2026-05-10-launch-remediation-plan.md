# DialectOS Launch Remediation Implementation Plan

**Goal:** Turn DialectOS from a repo with passing proxy checks and false public claims into a launchable product whose public site, packages, GitHub Action, Docker deploy, security posture, validation gates, and documentation are all truthful and reproducible.

**Architecture:** Repair the product contract from the outside in: first remove/neutralize false public claims, then make the public surfaces real, then harden release/deploy/package gates, then repair correctness and silent-failure paths. Each phase adds executable proof before changing claims back to positive launch language. Do not claim launch readiness until every proof command in the final gate passes from a clean checkout and, where applicable, against the live public URL.

**Tech Stack:** TypeScript ES2022, pnpm workspaces, Node16 module resolution, Vitest, Node `node:test`, GitHub Actions, GitHub Pages, npm tarballs, Docker Compose, MCP SDK, shell scripts under `scripts/`.

---

## Current Launch Verdict

**Do not launch.** The audit found systemic contract drift: public-facing docs say one thing, runtime/deploy/package/security behavior does another. Passing `pnpm build` and `pnpm test` are insufficient because they do not cover live Pages, npm installability, GitHub Action usability, Docker reproducibility, blocking security audit, coverage, strict certification, or partial-write failure behavior.

## Non-Negotiable Rules For This Remediation

1. **No positive public claim without a verifier.** If a doc says npm install works, a clean tarball install smoke must pass in CI. If a doc says public demo works, live URL smoke must pass in CI or be explicitly marked unavailable.
2. **Fail closed for launch-critical flows.** No “warnings are fine” or partial output success on release/certification/CI paths.
3. **Fix tests before code where possible.** Add failing tests that reproduce each audited failure, then implement the smallest fix.
4. **Keep commits atomic and Lore-compliant.** Every commit must explain why, include `Tested:` and `Not-tested:` trailers, and avoid mixing public-copy cleanup with runtime changes.
5. **Do not reintroduce fake launch proof.** Mock-only certs may remain as unit fixtures, but public launch claims must cite real strict or live verification.
6. **Verify on `origin/main` before release.** Branch-local success is not enough.
7. **Preserve `.js` extensions in local TypeScript imports.** Required by the repo’s Node16 module configuration.
8. **Do not edit dictionary data in TypeScript wrappers.** Dictionary data edits go to `packages/types/src/dialectal-dictionary.json`.

## Global Definition of Done

A release candidate is launch-ready only when all of the following pass from a clean checkout:

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
npm pack --workspaces --pack-destination /tmp/dialectos-pack
# Then install all generated tarballs in an empty temp project and smoke imports/bins.
docker compose config
docker compose build
```

And these live/public checks pass:

```bash
curl -fsSL https://kyanitelabs.github.io/DialectOS/ >/tmp/dialectos-index.html
curl -fsSL https://kyanitelabs.github.io/DialectOS/robots.txt
curl -fsSL https://kyanitelabs.github.io/DialectOS/sitemap.xml
curl -fsSL https://kyanitelabs.github.io/DialectOS/llms.txt
curl -fsSL https://dialectos.kyanitelabs.tech/api/status
curl -fsS -X OPTIONS https://dialectos.kyanitelabs.tech/api/translate -D - -o /dev/null
```

If the canonical public host changes, update these commands and docs in the same commit.

---

## Phase 0: Stabilize The Baseline

### Task 0.1: Create A Clean Baseline Branch

**Files:** none initially.

**Step 1: Sync main**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git status --short --branch
```

Expected: clean `main` tracking `origin/main`.

**Step 2: Create branch**

```bash
git switch -c fix/launch-remediation-foundation
```

**Step 3: Capture baseline evidence**

```bash
mkdir -p audits/launch-remediation-2026-05-10
{
  date -u
  git rev-parse HEAD
  pnpm --version
  node --version
} > audits/launch-remediation-2026-05-10/baseline.txt
```

**Step 4: Commit only if an audit artifact is intentionally retained**

```bash
git add audits/launch-remediation-2026-05-10/baseline.txt
git commit -m "Record launch remediation baseline

Constraint: remediation must start from current main evidence, not stale branch state.
Confidence: high
Scope-risk: narrow
Tested: captured git/node/pnpm baseline
Not-tested: no runtime behavior changed"
```

---

## Phase 1: Stop False Public Claims

This phase is highest ROI because the public docs currently misrepresent installability, license, tests, security, package availability, and launch readiness.

### Task 1.1: Replace False README Claims With Current-State Language

**Files:**
- Modify: `README.md`
- Test: `docs/__tests__/demo-contract.test.mjs` or create `docs/__tests__/public-claims.test.mjs`

**Step 1: Add a failing public-claims test**

Create `docs/__tests__/public-claims.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const files = ['README.md', 'SECURITY.md', '.llm', 'ROADMAP.md'];
const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8') ]));

test('public docs do not claim unpublished packages or unreleased actions', () => {
  for (const [file, text] of Object.entries(contents)) {
    assert.doesNotMatch(text, /npm install -g @dialectos\/cli/iu, `${file} advertises unpublished CLI package`);
    assert.doesNotMatch(text, /npx -y @dialectos\/mcp/iu, `${file} advertises unpublished MCP package`);
    assert.doesNotMatch(text, /KyaniteLabs\/DialectOS\/action@v0\.3\.0/iu, `${file} advertises unreleased action`);
  }
});

test('public docs do not call BSL current version open source or production-free', () => {
  for (const [file, text] of Object.entries(contents)) {
    assert.doesNotMatch(text, /open[- ]source/iu, `${file} uses open-source for current BSL release`);
    assert.doesNotMatch(text, /production use allowed|allows production use/iu, `${file} overstates BSL production rights`);
  }
});

test('public docs do not hardcode stale test or security counts', () => {
  for (const [file, text] of Object.entries(contents)) {
    assert.doesNotMatch(text, /\b1,?034\b/iu, `${file} hardcodes stale test count`);
    assert.doesNotMatch(text, /0 vulnerabilities|zero vulnerabilities/iu, `${file} hardcodes false vulnerability count`);
  }
});
```

**Step 2: Run and verify failure**

```bash
node --test docs/__tests__/public-claims.test.mjs
```

Expected: fail on current README/SECURITY/.llm/ROADMAP claims.

**Step 3: Rewrite README sections**

Modify `README.md`:
- Replace “open-source” with “source-available under BSL 1.1 until Apache-2.0 conversion on 2030-04-20”.
- Replace `1034 tests` badge with either no fixed count or a generated/tested statement.
- Replace npm install with local development instructions until npm publish is real:

```md
> Package publishing is not enabled yet. For local development, clone the repository and use `pnpm`.
```

- Replace GitHub Action examples with “planned” or remove until tag/path works.
- Replace “production use allowed” with BSL-accurate language:

```md
Commercial/production use requires a commercial license or explicit Additional Use Grant until the Change Date.
```

**Step 4: Run tests**

```bash
node --test docs/__tests__/public-claims.test.mjs
pnpm test
```

Expected: public-claims test passes; full test suite passes.

**Step 5: Commit**

```bash
git add README.md docs/__tests__/public-claims.test.mjs
git commit -m "Stop overstating DialectOS public launch claims

Constraint: npm packages, v0.3.0 action, zero-vulnerability, and open-source claims are not true today.
Rejected: keep aspirational launch copy | public docs must reflect verified current state.
Confidence: high
Scope-risk: moderate
Tested: node --test docs/__tests__/public-claims.test.mjs; pnpm test
Not-tested: live site deploy pending later phases"
```

### Task 1.2: Fix SECURITY.md To Match Actual Security State

**Files:**
- Modify: `SECURITY.md`
- Modify/Create: `docs/__tests__/public-claims.test.mjs`

**Step 1: Extend test**

Add assertions that `SECURITY.md` must not claim private-IP SSRF protection or ANSI stripping until tests prove it:

```js
test('security policy only claims implemented controls', () => {
  const text = readFileSync('SECURITY.md', 'utf8');
  assert.doesNotMatch(text, /private IP ranges|localhost/iu);
  assert.doesNotMatch(text, /ANSI sanitization/iu);
});
```

**Step 2: Run failure**

```bash
node --test docs/__tests__/public-claims.test.mjs
```

Expected: fails until SECURITY.md is corrected.

**Step 3: Rewrite SECURITY.md**

- Supported versions: current version `0.3.x`, or state “no stable supported release yet”.
- SSRF: “Provider endpoint validation is under remediation; do not rely on untrusted provider URLs.”
- Audit: “CI currently runs audit but remediation is pending” until blocking audit is true.
- Sanitization: list only redaction that is tested.

**Step 4: Run verification**

```bash
node --test docs/__tests__/public-claims.test.mjs
pnpm audit --audit-level=moderate || true
```

Expected: docs test passes; audit still fails and is documented honestly.

**Step 5: Commit**

```bash
git add SECURITY.md docs/__tests__/public-claims.test.mjs
git commit -m "Align security policy with implemented controls

Constraint: current audit and sanitizer behavior do not support previous hardening claims.
Rejected: leave SECURITY.md aspirational | security docs must not create false assurances.
Confidence: high
Scope-risk: narrow
Tested: node --test docs/__tests__/public-claims.test.mjs; pnpm audit --audit-level=moderate observed pending advisories
Not-tested: vulnerability remediation deferred to security phase"
```

### Task 1.3: Quarantine Launch Kit And Social Collateral

**Files:**
- Modify: `docs/launch-kit/**`
- Modify: `docs/social-launch-kit.md`
- Modify: `docs/launch-kit/submissions/**`
- Test: `docs/__tests__/public-claims.test.mjs`

**Step 1: Expand stale-claim test to launch collateral**

Use a recursive file list in the test:

```js
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
```

Then include `docs/launch-kit` and `docs/social-launch-kit.md`.

**Step 2: Run failure**

```bash
node --test docs/__tests__/public-claims.test.mjs
```

Expected: many stale collateral failures.

**Step 3: Add launch-kit warning header**

At the top of each launch collateral file, add:

```md
> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
```

Then remove or neutralize false claims.

**Step 4: Run verification**

```bash
node --test docs/__tests__/public-claims.test.mjs
rg -n "open[- ]source|1034|KyaniteLabs/DialectOS/action@v0\.3\.0|npm install -g @dialectos/cli|npx -y @dialectos/mcp|0 vulnerabilities|native-reviewed" README.md SECURITY.md .llm ROADMAP.md docs --glob '!docs/plans/2026-05-10-launch-remediation-plan.md'
```

Expected: no unauthorized stale claims outside the remediation plan.

**Step 5: Commit**

```bash
git add docs/launch-kit docs/social-launch-kit.md docs/__tests__/public-claims.test.mjs
git commit -m "Quarantine launch collateral until proof gates pass

Constraint: current collateral repeats false npm, action, test-count, and license claims.
Rejected: delete all launch kit content | drafts can remain if clearly blocked from publication.
Confidence: high
Scope-risk: moderate
Tested: node --test docs/__tests__/public-claims.test.mjs; rg stale public claims
Not-tested: collateral copy quality after future launch proof"
```

---

## Phase 2: Fix Public Site And Discovery

### Task 2.1: Decide Canonical Host And Update Static Assets

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/robots.txt`
- Modify: `docs/sitemap.xml`
- Create: `docs/llms.txt`
- Optional: `docs/CNAME` if using custom domain
- Test: `docs/__tests__/demo-contract.test.mjs`

**Step 1: Choose one canonical host**

Use one of these and delete references to the other:
- GitHub Pages default: `https://kyanitelabs.github.io/DialectOS/`
- Custom domain: `https://kyanitelabs.tech/DialectOS/` only if Pages config and DNS actually work.

Given current 404 on custom domain, safest initial target is GitHub Pages default unless DNS is intentionally repaired.

**Step 2: Add failing discovery test**

Extend `docs/__tests__/demo-contract.test.mjs` or create `docs/__tests__/discovery-files.test.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('docs deployment contains discovery files', () => {
  for (const path of ['docs/index.html', 'docs/robots.txt', 'docs/sitemap.xml', 'docs/llms.txt']) {
    assert.equal(existsSync(path), true, `${path} must exist because Pages uploads docs/`);
  }
});

test('docs links use paths valid under docs/ deployment root', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.doesNotMatch(html, /href="docs\/full-app-demo\.md"/u);
  assert.match(html, /href="full-app-demo\.md"/u);
});
```

**Step 3: Run failure**

```bash
node --test docs/__tests__/discovery-files.test.mjs
```

Expected: fails because `docs/llms.txt` is absent and link path is wrong.

**Step 4: Implement minimal docs fix**

- Copy root `llms.txt` into `docs/llms.txt`, but remove false package/action/open-source claims first.
- Change `href="docs/full-app-demo.md"` to `href="full-app-demo.md"`.
- Ensure robots and sitemap point at the chosen canonical URL.
- If custom domain is required, add `docs/CNAME` and verify Pages settings.

**Step 5: Verify locally**

```bash
node --test docs/__tests__/discovery-files.test.mjs
node scripts/build-demo.cjs --check
pnpm test
```

**Step 6: Commit**

```bash
git add docs/index.html docs/robots.txt docs/sitemap.xml docs/llms.txt docs/__tests__/discovery-files.test.mjs
git commit -m "Make Pages discovery files deployment-real

Constraint: Pages uploads docs/ only, so root llms.txt and broken docs/ links are invisible publicly.
Rejected: rely on green Pages workflow | the workflow did not prove public discovery routes.
Confidence: high
Scope-risk: moderate
Tested: node --test docs/__tests__/discovery-files.test.mjs; node scripts/build-demo.cjs --check; pnpm test
Not-tested: live Pages smoke until deployment phase"
```

### Task 2.2: Fix Demo Receipt And Button State

**Files:**
- Modify: `docs/index.html`
- Test: `docs/__tests__/demo-contract.test.mjs` or new JS DOM/static test

**Step 1: Add failing test for live success cleanup**

If staying static, add an AST/string contract test that forbids early `return` before button reset. Better: add a browser-like unit using `node:vm` and mocked DOM/fetch.

Minimum static test:

```js
test('live translation path resets button in finally block', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.match(html, /finally\s*\{/u);
  assert.match(html, /translateButton'\)\.disabled\s*=\s*false/u);
  assert.doesNotMatch(html, /\['quality', 'judge passed'\]/u);
});
```

**Step 2: Run failure**

```bash
node --test docs/__tests__/demo-contract.test.mjs
```

Expected: fails until code has `finally` and no hardcoded `judge passed`.

**Step 3: Implement UI fix**

In `runTranslation()`:
- Put button re-enable/text reset in `finally`.
- On live backend failure, render a visible provider error before falling back or require explicit client-mode selection.
- Receipt rows must come from actual response fields: `providerUsed`, `fallbackCount`, `qualityScore`, `warnings`, `cacheHit`, `backstop`, `mode`.
- If backend does not provide a field, render `not reported`, not “passed”.

Pseudo-structure:

```js
try {
  // backend attempt
} catch (error) {
  backendAvailable = false;
  renderBackendFailure(error);
  // only client fallback if product explicitly wants it and receipt marks it
} finally {
  if (requestId === translateRequestId) {
    $('translateButton').disabled = false;
    $('translateButton').textContent = 'Translate with full app';
  }
}
```

**Step 4: Verify**

```bash
node --test docs/__tests__/demo-contract.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add docs/index.html docs/__tests__/demo-contract.test.mjs
git commit -m "Make demo receipts reflect real runtime state

Constraint: public demo previously hardcoded quality and left the button disabled on live success.
Rejected: keep static receipt copy | receipts must be real or explicitly unknown.
Confidence: high
Scope-risk: moderate
Tested: node --test docs/__tests__/demo-contract.test.mjs; pnpm test
Not-tested: live browser smoke pending deployment phase"
```

### Task 2.3: Add Live Pages Smoke To Workflow

**Files:**
- Modify: `.github/workflows/pages.yml`
- Create: `scripts/smoke-pages.mjs`
- Test: `scripts/__tests__/pages-smoke.test.mjs`

**Step 1: Create testable smoke script**

`scripts/smoke-pages.mjs`:

```js
#!/usr/bin/env node
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/smoke-pages.mjs <base-url>');
const paths = ['/', '/robots.txt', '/sitemap.xml', '/llms.txt'];
for (const path of paths) {
  const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.href} returned ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error(`${url.href} returned empty body`);
}
```

**Step 2: Add a script test with mocked fetch**

`scripts/__tests__/pages-smoke.test.mjs` should spawn the script against a local temporary HTTP server that serves all paths and another that returns 404.

**Step 3: Verify test fails before script, passes after script**

```bash
node --test scripts/__tests__/pages-smoke.test.mjs
```

**Step 4: Update workflow**

After deploy step:

```yaml
      - name: Smoke deployed Pages site
        run: node scripts/smoke-pages.mjs "${{ steps.deployment.outputs.page_url }}"
```

**Step 5: Verify**

```bash
node --test scripts/__tests__/pages-smoke.test.mjs
pnpm test
```

**Step 6: Commit**

```bash
git add .github/workflows/pages.yml scripts/smoke-pages.mjs scripts/__tests__/pages-smoke.test.mjs
git commit -m "Gate Pages deploy on public discovery smoke

Constraint: previous Pages success still served public 404s.
Rejected: trust deploy-pages success alone | public URL behavior is the product contract.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/pages-smoke.test.mjs; pnpm test
Not-tested: live workflow run until PR deployment"
```

---

## Phase 3: Make Packages Installable And Publish-Ready

### Task 3.1: Add Package Metadata And Replace `workspace:*` For Packed Output

**Files:**
- Modify: `packages/*/package.json`
- Modify: `package.json`
- Test: new `scripts/__tests__/package-metadata.test.mjs`

**Step 1: Add metadata test**

Create `scripts/__tests__/package-metadata.test.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageDirs = readdirSync('packages').filter((name) => {
  try { JSON.parse(readFileSync(join('packages', name, 'package.json'), 'utf8')); return true; }
  catch { return false; }
});

test('workspace packages have publish metadata', () => {
  for (const dir of packageDirs) {
    const file = join('packages', dir, 'package.json');
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    for (const field of ['license', 'publishConfig', 'repository', 'homepage', 'bugs', 'engines', 'packageManager', 'sideEffects']) {
      assert.notEqual(pkg[field], undefined, `${file} missing ${field}`);
    }
  }
});

test('published workspace dependencies use concrete semver ranges', () => {
  for (const dir of packageDirs) {
    const file = join('packages', dir, 'package.json');
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      assert.doesNotMatch(String(version), /^workspace:/u, `${file} dependency ${name} uses ${version}`);
    }
  }
});
```

**Step 2: Run failure**

```bash
node --test scripts/__tests__/package-metadata.test.mjs
```

Expected: fails on missing metadata and `workspace:*`.

**Step 3: Update manifests**

For every workspace package:

```json
{
  "license": "BSL-1.1",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "https://github.com/KyaniteLabs/DialectOS.git", "directory": "packages/<name>" },
  "homepage": "https://github.com/KyaniteLabs/DialectOS#readme",
  "bugs": { "url": "https://github.com/KyaniteLabs/DialectOS/issues" },
  "engines": { "node": ">=20.19.0" },
  "packageManager": "pnpm@9.15.0",
  "sideEffects": false
}
```

Replace internal dependencies with `"0.3.0"` or `"^0.3.0"`. Prefer exact `0.3.0` for synchronized monorepo packages unless release policy says otherwise.

**Step 4: Verify package manager still links locally**

```bash
pnpm install --frozen-lockfile
pnpm build
node --test scripts/__tests__/package-metadata.test.mjs
```

If pnpm no longer links local packages automatically with version ranges, add `linkWorkspacePackages=true` / workspace protocol strategy to `.npmrc` only if needed and tested.

**Step 5: Commit**

```bash
git add package.json packages/*/package.json scripts/__tests__/package-metadata.test.mjs pnpm-lock.yaml
git commit -m "Make workspace package manifests publish-ready

Constraint: packed packages failed clean npm install because workspace:* leaked into tarballs.
Rejected: rely on pnpm-only installs | public npm install claims require npm consumer compatibility.
Confidence: high
Scope-risk: broad
Tested: pnpm install --frozen-lockfile; pnpm build; node --test scripts/__tests__/package-metadata.test.mjs
Not-tested: npm publish dry-run deferred to package smoke task"
```

### Task 3.2: Add Clean Tarball Install/Import/Bin Smoke

**Files:**
- Create: `scripts/package-smoke.mjs`
- Create: `scripts/__tests__/package-smoke.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write smoke script**

`scripts/package-smoke.mjs` should:
1. Build packages.
2. Pack each package to a temp dir.
3. Create empty temp npm project.
4. Install all tarballs.
5. Import each library package.
6. Run `npx dialectos --help` and `npx dialectos-mcp --help` or a safe MCP startup smoke.
7. Verify bin target files are executable in tarball metadata.

Core commands inside script:

```js
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', encoding: 'utf8', ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with ${res.status}`);
}
```

**Step 2: Write script test**

At minimum, test that the script can parse `--help` and fails for a missing tarball directory. Full integration can be in CI.

**Step 3: Run failure/success**

```bash
node scripts/package-smoke.mjs
```

Expected before fixes: fail on `workspace:*` or bin mode. After Task 3.1 and bin fix: pass.

**Step 4: Fix bin executable modes**

Options:
- Add a postbuild script to `chmod +x dist/index.js` for CLI and MCP.
- Or configure pack step to preserve executable mode.

Modify:
- `packages/cli/package.json` build script: `tsc && chmod +x dist/index.js`
- `packages/mcp/package.json` build script: `tsc && chmod +x dist/index.js`

**Step 5: Update CI**

Replace current dry-run pack block in `.github/workflows/ci.yml` with:

```yaml
      - name: Verify packages install from tarballs
        run: node scripts/package-smoke.mjs
```

**Step 6: Verify**

```bash
pnpm build
node scripts/package-smoke.mjs
pnpm test
```

**Step 7: Commit**

```bash
git add scripts/package-smoke.mjs scripts/__tests__/package-smoke.test.mjs .github/workflows/ci.yml packages/cli/package.json packages/mcp/package.json pnpm-lock.yaml
git commit -m "Prove packages install from clean tarballs

Constraint: npm pack dry-run missed workspace protocol leakage and non-executable bins.
Rejected: package-content-only checks | consumers need install, import, and bin execution proof.
Confidence: high
Scope-risk: broad
Tested: pnpm build; node scripts/package-smoke.mjs; pnpm test
Not-tested: npm publish to registry"
```

### Task 3.3: Split CLI Binary From Importable Library Or Mark CLI As CLI-Only

**Files:**
- Option A modify: `packages/cli/src/index.ts`, create `packages/cli/src/cli.ts`, create `packages/cli/src/api.ts`
- Option B modify: `packages/cli/README.md`, `packages/cli/package.json`
- Test: `packages/cli/src/__tests__/import.test.ts`

**Recommended Option A**: create real importable API and keep binary side effects in `cli.ts`.

**Step 1: Add failing import test**

```ts
import { describe, expect, it } from 'vitest';

describe('@dialectos/cli import surface', () => {
  it('exports library helpers without parsing process argv', async () => {
    const mod = await import('../api.js');
    expect(mod).toHaveProperty('createCliProgram');
  });
});
```

**Step 2: Refactor minimally**

- Move commander setup into `createCliProgram()`.
- `src/cli.ts` calls `createCliProgram().parseAsync(process.argv)`.
- `src/index.ts` exports library helpers only.
- `package.json` bin points to `dist/cli.js`.

**Step 3: Verify**

```bash
pnpm --filter=@dialectos/cli test
pnpm build
node packages/cli/dist/cli.js --help
node -e "import('@dialectos/cli').then(m=>console.log(Object.keys(m)))"
```

**Step 4: Commit**

```bash
git add packages/cli/src packages/cli/package.json
git commit -m "Separate CLI binary from importable API

Constraint: package import previously loaded command parsing and exported nothing useful.
Rejected: document around side effects | package consumers need a stable import contract.
Confidence: medium
Scope-risk: broad
Tested: pnpm --filter=@dialectos/cli test; pnpm build; node packages/cli/dist/cli.js --help; package import smoke
Not-tested: downstream third-party imports"
```

---

## Phase 4: Fix GitHub Action Or Remove It From Public Docs

### Task 4.1: Make Composite Action Path Correct

**Files:**
- Modify: `action.yml`
- Create: `scripts/__tests__/github-action.test.mjs`
- Modify: `docs/github-action.md` only after action is real

**Step 1: Add static test for root action paths**

```js
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const action = readFileSync('action.yml', 'utf8');

test('root composite action does not escape github.action_path', () => {
  assert.doesNotMatch(action, /github\.action_path\s*}}\/\.\./u);
  assert.match(action, /working-directory:\s*\$\{\{ github\.action_path }}/u);
  assert.match(action, /node \$\{\{ github\.action_path }}\/scripts\/ci-validate\.mjs/u);
});
```

**Step 2: Run failure**

```bash
node --test scripts/__tests__/github-action.test.mjs
```

Expected: fails on current `../` paths.

**Step 3: Fix action**

Change:

```yaml
working-directory: ${{ github.action_path }}
node ${{ github.action_path }}/scripts/ci-validate.mjs
```

**Step 4: Add local action simulation**

Add script `scripts/smoke-action-layout.mjs` that verifies required files exist relative to repo root and runs `node scripts/ci-validate.mjs --dialect=es-MX --source-dir=. --target-patterns='*.never-match'` expecting controlled no-files behavior only if that is acceptable. Prefer create temp locale fixture and verify nonzero on bad translation.

**Step 5: Verify**

```bash
node --test scripts/__tests__/github-action.test.mjs
node scripts/smoke-action-layout.mjs
pnpm test
```

**Step 6: Commit**

```bash
git add action.yml scripts/__tests__/github-action.test.mjs scripts/smoke-action-layout.mjs
git commit -m "Fix root composite action path contract

Constraint: documented action path escaped repo root and could not find package files/scripts.
Rejected: keep action docs while broken | consumers need a working composite layout.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/github-action.test.mjs; node scripts/smoke-action-layout.mjs; pnpm test
Not-tested: real external repository action invocation"
```

### Task 4.2: Fix `ci-validate` Pattern Matching And No-File Semantics

**Files:**
- Modify: `scripts/ci-validate.mjs`
- Create/Modify: `scripts/__tests__/ci-validate.test.mjs`
- Modify: `.github/workflows/validate-pr.yml`

**Step 1: Add failing integration test**

Create temp dir:

```js
// locales/app.es-MX.json should match **/*.es-MX.json
```

Spawn:

```bash
node scripts/ci-validate.mjs --dialect=es-MX --source-dir=<tmp> --target-patterns='**/*.es-MX.json'
```

Expected after fix: validates file. Current behavior: no files found.

**Step 2: Decide no-file policy**

For a PR validation action, no matching files with explicit `target-patterns` should be an error unless `--allow-empty=true` is passed.

Add CLI arg:

```js
const allowEmpty = args.get('allow-empty') === 'true';
```

If no files:

```js
if (targetFiles.length === 0) {
  console.error(`No translation files found for dialect ${dialect}.`);
  process.exit(allowEmpty ? 0 : 1);
}
```

**Step 3: Replace `find -name` glob behavior**

Use `git ls-files` when in repo, or Node recursive walk + `minimatch` only if adding dependency is approved. Since no new deps preferred, implement small recursive walk and support `**/`, `*.ext`, suffix patterns.

**Step 4: Verify**

```bash
node --test scripts/__tests__/ci-validate.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add scripts/ci-validate.mjs scripts/__tests__/ci-validate.test.mjs .github/workflows/validate-pr.yml
git commit -m "Make CI translation validation fail closed on missing targets

Constraint: glob patterns previously missed nested locale files and exited success.
Rejected: treat no matches as success by default | PR validation must prove it actually checked files.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/ci-validate.test.mjs; pnpm test
Not-tested: GitHub PR comment permissions until workflow run"
```

### Task 4.3: Release Or Remove Action Version Claims

**Files:**
- Modify: `README.md`
- Modify: `docs/github-action.md`
- Modify: `.github/workflows/ci.yml` if action smoke added

**Step 1: Keep docs blocked until tag exists**

If no `v0.3.0` tag is cut, docs should use:

```md
Status: planned. Do not use `KyaniteLabs/DialectOS/action@v0.3.0` until the release is published.
```

**Step 2: Add release verification before restoring positive docs**

```bash
git ls-remote --tags origin v0.3.0
```

Expected before positive docs: tag exists.

**Step 3: Commit**

```bash
git add README.md docs/github-action.md
git commit -m "Block GitHub Action docs until release exists

Constraint: v0.3.0 action reference is not currently a verified consumer surface.
Rejected: advertise unreleased action | docs must not instruct consumers into broken workflows.
Confidence: high
Scope-risk: narrow
Tested: rg action@v0.3.0 README.md docs/github-action.md
Not-tested: future tagged action release"
```

---

## Phase 5: Repair Docker And Deploy Reproducibility

### Task 5.1: Make Root Compose Config Work Without Private `.env`

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example` or `server/deploy/.../env.example` if absent
- Create: `scripts/__tests__/compose-config.test.mjs`

**Step 1: Add failing compose test**

Test spawns:

```bash
docker compose --env-file .env.example config
```

Expected current failure because root `.env` is hard-required and no root `.env.example` exists.

**Step 2: Add root `.env.example`**

```env
LLM_API_URL=http://host.docker.internal:1234/v1/chat/completions
LLM_API_FORMAT=openai
LLM_MODEL=replace-with-model
DIALECTOS_DEMO_CORS_ORIGIN=https://kyanitelabs.github.io
```

No fake secret-shaped placeholder like `gsk_...`.

**Step 3: Modify compose**

Use optional env file if Compose version supports it:

```yaml
env_file:
  - path: .env
    required: false
```

Otherwise document `docker compose --env-file .env.example` and remove hard `env_file: .env`.

**Step 4: Verify**

```bash
docker compose --env-file .env.example config
node --test scripts/__tests__/compose-config.test.mjs
```

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example scripts/__tests__/compose-config.test.mjs
git commit -m "Make root compose configuration reproducible

Constraint: docker compose config failed from clean checkout because .env was hard-required.
Rejected: require hidden local env for config validation | launch deploys need documented reproducible config.
Confidence: high
Scope-risk: moderate
Tested: docker compose --env-file .env.example config; node --test scripts/__tests__/compose-config.test.mjs
Not-tested: full image build until Dockerfile task"
```

### Task 5.2: Fix `server/Dockerfile` Build And Runtime Context

**Files:**
- Modify: `server/Dockerfile`
- Modify: `server/deploy/hostinger-vps/docker-compose.yml`
- Test: `scripts/__tests__/dockerfile.test.mjs`

**Step 1: Add Dockerfile static test**

Assert builder copies `tsconfig.base.json` and runtime copies `scripts/lib/ensure-built.mjs` or avoids needing it.

**Step 2: Fix Dockerfile**

Builder stage:

```dockerfile
COPY tsconfig.base.json vitest.workspace.ts ./
COPY scripts ./scripts
COPY docs ./docs
```

Runtime stage:

```dockerfile
COPY scripts/lib/ensure-built.mjs ./scripts/lib/ensure-built.mjs
```

Better: modify `scripts/demo-server.mjs` to skip `ensureAllBuilt()` if dist is already present in production runtime, but test this explicitly.

**Step 3: Fix Hostinger context**

From `server/deploy/hostinger-vps`, repo root is `../../..`, not `../..`.

```yaml
build:
  context: ../../..
  dockerfile: server/Dockerfile
```

**Step 4: Verify**

```bash
node --test scripts/__tests__/dockerfile.test.mjs
docker compose -f server/deploy/hostinger-vps/docker-compose.yml --env-file server/deploy/hostinger-vps/env.example config
# If Docker available and acceptable:
docker compose --env-file .env.example build
```

**Step 5: Commit**

```bash
git add server/Dockerfile server/deploy/hostinger-vps/docker-compose.yml scripts/__tests__/dockerfile.test.mjs
git commit -m "Repair Docker build contexts and demo runtime files

Constraint: server Docker build omitted root TypeScript config and runtime omitted ensure-built dependency.
Rejected: rely on Dockerfile.demo only | deployment bundle must build from its documented compose path.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/dockerfile.test.mjs; docker compose config commands
Not-tested: production VPS deployment"
```

### Task 5.3: Align Hostnames And CORS/Headers

**Files:**
- Modify: `docs/index.html`
- Modify: `docker-compose.yml`
- Modify: `server/deploy/hostinger-vps/README.md`
- Modify: `server/deploy/hostinger-vps/Caddyfile`
- Modify: `server/deploy/hostinger-vps/env.example`
- Test: `scripts/__tests__/deploy-config.test.mjs`

**Step 1: Pick API host**

Use exactly one:
- `dialectos.kyanitelabs.tech`, or
- `dialectos-api.kyanitelabs.tech`.

Update all files to match.

**Step 2: Align CORS**

If public site is the only browser origin, replace `Access-Control-Allow-Origin *` with explicit allowed origin, configurable through env.

**Step 3: Add security headers**

At Caddy level add:

```caddyfile
Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
Permissions-Policy "geolocation=(), microphone=(), camera=()"
Cross-Origin-Opener-Policy "same-origin"
```

Use CSP only after testing because static demo may need inline scripts; target eventual nonce/hash CSP.

**Step 4: Verify**

```bash
node --test scripts/__tests__/deploy-config.test.mjs
docker compose -f server/deploy/hostinger-vps/docker-compose.yml --env-file server/deploy/hostinger-vps/env.example config
```

**Step 5: Commit**

```bash
git add docs/index.html docker-compose.yml server/deploy/hostinger-vps
git commit -m "Align deploy hostnames and edge headers

Constraint: docs, compose, and Hostinger bundle disagreed on API host and CORS/header behavior.
Rejected: keep multiple public API names | one canonical host reduces launch/debug ambiguity.
Confidence: medium
Scope-risk: moderate
Tested: node --test scripts/__tests__/deploy-config.test.mjs; hostinger compose config
Not-tested: live DNS/TLS issuance"
```

---

## Phase 6: Make Security Gates Honest And Blocking

### Task 6.1: Block On `pnpm audit`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `pnpm-lock.yaml` and package versions as needed
- Test: CI plus local audit

**Step 1: Remove `continue-on-error`**

Change `.github/workflows/ci.yml:38-40` to fail on audit.

**Step 2: Remediate advisories**

Run:

```bash
pnpm audit --audit-level=moderate
pnpm update <affected packages> --latest
```

Do not blindly update major dependencies without test pass. Current likely affected chain includes `fast-uri`, `hono`, `ip-address`, and transitive consumers.

**Step 3: Verify**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm audit --audit-level=moderate
```

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml package.json packages/*/package.json pnpm-lock.yaml
git commit -m "Make dependency audit a blocking launch gate

Constraint: SECURITY.md claimed clean audit while CI ignored moderate/high advisories.
Rejected: continue-on-error audit | security regressions must block launch.
Confidence: high
Scope-risk: moderate
Tested: pnpm build; pnpm test; pnpm audit --audit-level=moderate
Not-tested: Dependabot future PR behavior"
```

### Task 6.2: Fix SSRF And Redirect Credential Leakage

**Files:**
- Modify: `packages/security/src/index.ts`
- Modify: `packages/providers/src/fetch-utils.ts`
- Test: `packages/security/src/__tests__/security.test.ts`
- Test: create `packages/providers/src/__tests__/fetch-utils.test.ts`

**Step 1: Add SSRF tests**

In security tests assert `validateUrl()` rejects:
- `http://localhost:1234`
- `http://127.0.0.1`
- `http://[::1]`
- `http://169.254.169.254/latest/meta-data`
- integer/encoded localhost variants
- private IPv4 ranges `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`

Allow only `http`/`https` public hosts where appropriate.

**Step 2: Add redirect tests**

`fetchWithRedirects` should not forward `Authorization`, cookies, or body/method to a different origin unless explicitly allowed.

Test fake fetch sequence:
1. First response 302 to `https://evil.example/steal`.
2. Assert second request lacks `Authorization`, `Cookie`, and body, or throws on cross-origin redirect.

Preferred safer policy: throw on cross-origin redirect unless `allowCrossOriginRedirects` is true.

**Step 3: Implement**

- Use WHATWG `URL`.
- Resolve DNS if needed for hostname private IP checks, but be careful with async APIs. For direct IP literals, block immediately.
- For fetch redirect, compare `new URL(next).origin` to previous origin.

**Step 4: Verify**

```bash
pnpm --filter=@dialectos/security test
pnpm --filter=@dialectos/providers test -- fetch-utils
pnpm test
```

**Step 5: Commit**

```bash
git add packages/security/src packages/providers/src/fetch-utils.ts packages/providers/src/__tests__/fetch-utils.test.ts
git commit -m "Fail closed on private URLs and credentialed redirects

Constraint: security docs claimed SSRF protection while redirect helper forwarded credentials across origins.
Rejected: caller-only validation | provider fetch utilities must enforce safe redirect semantics.
Confidence: high
Scope-risk: broad
Tested: pnpm --filter=@dialectos/security test; pnpm --filter=@dialectos/providers test -- fetch-utils; pnpm test
Not-tested: DNS rebinding protection for all resolver edge cases"
```

### Task 6.3: Fix Error Sanitization And Audit Log Swallowing

**Files:**
- Modify: `packages/security/src/index.ts`
- Test: `packages/security/src/__tests__/security.test.ts`

**Step 1: Add sanitizer tests**

Assert redaction for:
- `gsk_...`
- `ghp_...`
- `Bearer secret-token`
- ANSI escape sequences
- URLs containing tokens

**Step 2: Add audit-log error behavior test**

Decide policy: for security audit logging, either return `Result` or throw on write failure in strict mode. Do not silently swallow in contexts that claim auditability.

**Step 3: Implement minimal sanitizer**

Add regexes for common provider/GitHub/Bearer keys and ANSI strip:

```ts
sanitized = sanitized.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
sanitized = sanitized.replace(/gsk_[A-Za-z0-9_\-]{10,}/g, '[REDACTED]');
sanitized = sanitized.replace(/gh[pousr]_[A-Za-z0-9_]{20,}/g, '[REDACTED]');
sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, 'Bearer [REDACTED]');
```

**Step 4: Verify**

```bash
pnpm --filter=@dialectos/security test
pnpm test
```

**Step 5: Commit**

```bash
git add packages/security/src/index.ts packages/security/src/__tests__/security.test.ts
git commit -m "Redact provider tokens and terminal escapes consistently

Constraint: current sanitizer leaked Groq/GitHub/Bearer forms and ANSI escapes despite docs claims.
Rejected: document partial sanitizer only | errors cross CLI/MCP boundaries and need safe defaults.
Confidence: high
Scope-risk: narrow
Tested: pnpm --filter=@dialectos/security test; pnpm test
Not-tested: exhaustive secret-pattern corpus beyond covered providers"
```

---

## Phase 7: Stop Silent Partial Success

### Task 7.1: Make MCP Locale Tools Fail On Partial Writes Unless Explicitly Allowed

**Files:**
- Modify: `packages/mcp/src/tools/i18n.ts`
- Test: `packages/mcp/src/__tests__/i18n.test.ts`

**Step 1: Add failing tests**

Cases:
- `translate_missing_keys`: one provider failure among missing keys must return `isError: true` by default and must not write partial target.
- `batch_translate_locales`: all failures must return `isError: true`; partial failures should either not write or write only with `allowPartial: true`.

**Step 2: Add schema flag**

Add optional `allowPartial: boolean` default false to tool schemas.

**Step 3: Implement fail-closed**

Collect results in memory. Only call `writeLocaleFile()` if:
- no errors, or
- `allowPartial === true` and result metadata clearly says partial.

**Step 4: Verify**

```bash
pnpm --filter=@dialectos/mcp test
pnpm test
```

**Step 5: Commit**

```bash
git add packages/mcp/src/tools/i18n.ts packages/mcp/src/__tests__/i18n.test.ts
git commit -m "Fail MCP locale writes closed by default

Constraint: MCP tools previously wrote partial translation files while reporting non-error results.
Rejected: silent partial success | agents need explicit failure semantics to avoid corrupting locale files.
Confidence: high
Scope-risk: moderate
Tested: pnpm --filter=@dialectos/mcp test; pnpm test
Not-tested: real MCP client UX after schema change"
```

### Task 7.2: Make CLI Website Translation Fail Closed By Default

**Files:**
- Modify: `packages/cli/src/commands/translate-website.ts`
- Test: create `packages/cli/src/__tests__/translate-website.test.ts`

**Step 1: Add tests**

- Provider fails one string: command should not write mixed output by default.
- With `--allow-partial`, command writes partial output and DLQ, exits with explicit partial status if appropriate.

**Step 2: Add option**

```ts
.option('--allow-partial', 'Write partial outputs when some strings fail')
```

**Step 3: Implement staging writes**

Build outputs in memory or temp directory. Only rename into place after success. For partial mode, include clear report.

**Step 4: Verify**

```bash
pnpm --filter=@dialectos/cli test -- translate-website
pnpm test
```

**Step 5: Commit**

```bash
git add packages/cli/src/commands/translate-website.ts packages/cli/src/__tests__/translate-website.test.ts
git commit -m "Prevent default partial website translation writes

Constraint: translate-website wrote mixed source/translated output despite recorded failures.
Rejected: DLQ as sufficient safety | generated assets must be atomic unless partial mode is explicit.
Confidence: high
Scope-risk: moderate
Tested: pnpm --filter=@dialectos/cli test -- translate-website; pnpm test
Not-tested: very large website performance after staging writes"
```

### Task 7.3: Replace Swallowed Persistence Errors With Result/Warning Surfaces

**Files:**
- Modify: `packages/providers/src/translation-memory.ts`
- Modify: `packages/providers/src/translation-corpus.ts`
- Modify: `packages/cli/src/lib/telemetry-store.ts`
- Modify: `packages/providers/src/bulk/engine.ts`
- Tests: existing provider/CLI tests plus new failure-path tests

**Step 1: List current swallowed catches**

Use:

```bash
rg -n "catch\s*\{|\.catch\(" packages/providers/src packages/cli/src/lib --glob '!**/__tests__/**'
```

**Step 2: Add tests for each persistence component**

- Corrupt cache file should emit warning object or expose status, not silently start fresh in strict mode.
- Checkpoint save failure should be surfaced in `BulkTranslationResult.warnings`.
- Telemetry write failure should return `Result` or report warning.

**Step 3: Implement warnings without breaking callers**

Add `warnings: string[]` to result types where appropriate. For existing APIs, default to non-throwing but observable; strict CLI paths can fail on warnings.

**Step 4: Verify**

```bash
pnpm --filter=@dialectos/providers test
pnpm --filter=@dialectos/cli test
pnpm test
```

**Step 5: Commit**

```bash
git add packages/providers/src packages/cli/src/lib packages/types/src
git commit -m "Surface persistence failures instead of swallowing them

Constraint: cache, corpus, checkpoint, and telemetry failures were invisible to launch-critical flows.
Rejected: throw everywhere | warnings preserve compatibility while enabling strict callers to fail closed.
Confidence: medium
Scope-risk: broad
Tested: pnpm --filter=@dialectos/providers test; pnpm --filter=@dialectos/cli test; pnpm test
Not-tested: all downstream strict-mode integrations"
```

---

## Phase 8: Repair Validation And Certification Truth

### Task 8.1: Make `dialect-certify-adversarial` Forward Strict Flags

**Files:**
- Modify: `scripts/dialect-certify-adversarial.mjs`
- Test: `packages/cli/src/__tests__/dialect-eval-script.test.ts` or new `scripts/__tests__/dialect-certify-adversarial.test.mjs`

**Step 1: Add failing script test**

Create fixture with warning-only failure and run:

```bash
node scripts/dialect-certify-adversarial.mjs --fixtures=<tmp> --fail-on-warnings=true --judge=true --out=<tmpout>
```

Expected after fix: nonzero. Current: strict flags are not forwarded.

**Step 2: Forward flags**

In `passThroughArgs()`, include:

```js
for (const key of ['provider', 'dialects', 'sample-timeout-ms', 'sample-retries', 'fail-on-warnings', 'judge']) {
  if (args.has(key)) forwarded.push(`--${key}=${args.get(key)}`);
}
```

**Step 3: Verify**

```bash
node --test scripts/__tests__/dialect-certify-adversarial.test.mjs
pnpm test
```

**Step 4: Commit**

```bash
git add scripts/dialect-certify-adversarial.mjs scripts/__tests__/dialect-certify-adversarial.test.mjs
git commit -m "Forward strict certification flags through adversarial runner

Constraint: adversarial certify accepted warning-only outputs despite strict caller intent.
Rejected: wrapper-specific defaults | strictness must survive every certification layer.
Confidence: high
Scope-risk: narrow
Tested: node --test scripts/__tests__/dialect-certify-adversarial.test.mjs; pnpm test
Not-tested: live provider adversarial cert"
```

### Task 8.2: Make Document Certification Strict And Non-Mock For Launch

**Files:**
- Modify: `scripts/dialect-certify-documents.mjs`
- Test: `scripts/__tests__/document-certify-script.test.mjs`

**Step 1: Add options**

- `--policy=strict|balanced|permissive`, default `strict` for live.
- `--allow-mock=true` required for mock mode when command is used in launch scripts.
- `--fail-on-warnings=true`.

**Step 2: Add tests**

- Default launch invocation refuses mock unless `--allow-mock=true`.
- Live command does not pass `--policy permissive` or `--failure-policy allow-partial` by default.

**Step 3: Implement**

Change lines where live invokes CLI to use strict options.

**Step 4: Verify**

```bash
node --test scripts/__tests__/document-certify-script.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add scripts/dialect-certify-documents.mjs scripts/__tests__/document-certify-script.test.mjs
git commit -m "Make document certification strict for launch use

Constraint: document cert used permissive partial-output live commands and mock defaults.
Rejected: treat document cert as marketing proof | launch certification must fail closed.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/document-certify-script.test.mjs; pnpm test
Not-tested: live provider cert due credential dependency"
```

### Task 8.3: Make Validation Fail Nonsense And Semantic Drift

**Files:**
- Modify: `packages/cli/src/lib/validate-translation.ts`
- Modify: `packages/cli/src/lib/output-judge.ts`
- Modify: `packages/cli/src/lib/structure-validator.ts`
- Tests: existing and new CLI tests

**Step 1: Add failing tests**

Cases:
- Source: “Do not click the button”; output: “Haz clic en el botón” must fail.
- Source: “Payment failed”; output: “La documentación está lista” must fail.
- Markdown image demotion `![alt](url)` to `[alt](url)` must fail.
- Table cell count/content drift must fail.

**Step 2: Implement conservative gates**

- Negation preservation: source negation words require target negation unless exception list.
- Link/image cardinality and type preservation.
- Table row/cell cardinality preservation.
- Unchanged English detection for English source.
- Required output concepts from fixture metadata must be enforced where present.

**Step 3: Verify**

```bash
pnpm --filter=@dialectos/cli test -- validate output-judge structure-validator
pnpm test
node scripts/benchmark.mjs --out=/tmp/dialectos-benchmark
```

**Step 4: Commit**

```bash
git add packages/cli/src/lib packages/cli/src/__tests__
git commit -m "Make validation reject semantic drift and markdown corruption

Constraint: previous validators certified nonsense, dropped negation, image demotion, and table drift.
Rejected: score-only heuristics | launch gates need explicit catastrophic-failure checks.
Confidence: medium
Scope-risk: broad
Tested: pnpm --filter=@dialectos/cli test; pnpm test; node scripts/benchmark.mjs --out=/tmp/dialectos-benchmark
Not-tested: full live provider semantic benchmark"
```

### Task 8.4: Raise Detection Benchmark Thresholds

**Files:**
- Modify: `scripts/benchmark-detection.mjs`
- Modify: `packages/benchmarks/dialect-detection-corpus/README.md`
- Modify tests if any

**Step 1: Set real quality bar**

Current `top1 >= 50%` is barely above chance among 25 dialects and not launch-worthy. Choose:
- top1 >= 80%
- top3 >= 90%
- hard samples >= 60%
- average confidence calibrated or not used as quality proof.

**Step 2: Add thresholds as CLI args**

```bash
--min-top1=0.8 --min-top3=0.9 --min-hard-top1=0.6
```

Defaults should be launch-grade.

**Step 3: Verify current failure**

```bash
node scripts/benchmark-detection.mjs --out=/tmp/dialectos-detection
```

Expected: fail until detector is improved.

**Step 4: Commit threshold change separately from detector improvement**

```bash
git add scripts/benchmark-detection.mjs packages/benchmarks/dialect-detection-corpus/README.md
git commit -m "Raise dialect detection benchmark to launch-grade thresholds

Constraint: 51.6 percent top-1 accuracy is not acceptable for a public dialect engine.
Rejected: keep 50 percent gate | low benchmark bars create false confidence.
Confidence: high
Scope-risk: narrow
Tested: node scripts/benchmark-detection.mjs --out=/tmp/dialectos-detection observed expected failure until detector improves
Not-tested: improved detector implementation"
```

---

## Phase 9: Align Package READMEs, Examples, And Agent Guidance To Actual APIs

### Task 9.1: Generate Package README API Tables From Actual Exports

**Files:**
- Modify: `packages/*/README.md`
- Create: `scripts/__tests__/package-readmes.test.mjs`

**Step 1: Add tests that README examples reference real exports**

Parse `dist/index.d.ts` or source index files and assert README does not mention known false APIs:
- `detectMissingKeys`
- `mergeLocales`
- `@dialectos/types/dialectal-vocabulary` unless exported in package exports.
- `validateInput`
- `parseLocale`
- `normalizeLocale`
- `restoreMarkdown`
- `createMcpServer`

**Step 2: Run failure**

```bash
node --test scripts/__tests__/package-readmes.test.mjs
```

**Step 3: Rewrite READMEs**

Use actual exports:
- `@dialectos/locale-utils`: `readLocaleFile`, `writeLocaleFile`, `flattenLocale`, `unflattenLocale`, `diffLocales`.
- `@dialectos/markdown-parser`: `parseMarkdown`, `reconstructMarkdown`, `extractTranslatableText`, `countCodeBlocks`, `countLinks`.
- `@dialectos/security`: document current limitations honestly.
- `@dialectos/types`: only root import unless subpaths are added.
- `@dialectos/providers`: recommend `createProviderRegistry()` first.
- `@dialectos/mcp`: document actual `createServer` export or rename export.
- `@dialectos/cli`: say CLI-only unless API split is complete.

**Step 4: Verify**

```bash
node --test scripts/__tests__/package-readmes.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add packages/*/README.md scripts/__tests__/package-readmes.test.mjs
git commit -m "Align package READMEs with exported APIs

Constraint: package docs advertised missing functions, subpaths, and security guarantees.
Rejected: leave README examples aspirational | package docs are consumer contracts.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/package-readmes.test.mjs; pnpm test
Not-tested: external docs rendering"
```

### Task 9.2: Fix Basic Example Commands

**Files:**
- Modify: `examples/basic-translation/README.md`
- Test: `scripts/__tests__/examples.test.mjs`

**Step 1: Add test**

Assert examples do not contain unpublished install commands or stale batch flags.

**Step 2: Rewrite example**

Use local dev commands until packages publish:

```bash
pnpm install
pnpm build
node packages/cli/dist/index.js translate-readme README.md --dialect es-MX --output README.es-MX.md --policy balanced
node packages/cli/dist/index.js i18n batch-translate locales --targets es-MX,es-AR,es-CO,es-ES
```

After npm publish is real, update to `npx dialectos` and prove via package smoke.

**Step 3: Verify**

```bash
node --test scripts/__tests__/examples.test.mjs
pnpm test
```

**Step 4: Commit**

```bash
git add examples/basic-translation/README.md scripts/__tests__/examples.test.mjs
git commit -m "Make basic example match current CLI reality

Constraint: example used unpublished package install and stale batch flags.
Rejected: leave example as future syntax | examples must be runnable by a new developer.
Confidence: high
Scope-risk: narrow
Tested: node --test scripts/__tests__/examples.test.mjs; pnpm test
Not-tested: example end-to-end with real provider"
```

### Task 9.3: Fix AGENTS.md Export Contract

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md` if it repeats package contract
- Test: `scripts/__tests__/agent-guidance.test.mjs`

**Step 1: Add test**

Assert key exports listed in AGENTS appear in actual `dist/index.d.ts` or source `index.ts`.

**Step 2: Update table**

Current false entries:
- `DICTIONARY` should be actual dictionary export name.
- `VERB_CONJUGATIONS` should be actual export name.
- `validateInput` missing.
- `parseLocale`, `normalizeLocale` missing.
- `restoreMarkdown` missing; actual `reconstructMarkdown`.
- `createMcpServer` missing; actual `createServer`.

**Step 3: Verify**

```bash
node --test scripts/__tests__/agent-guidance.test.mjs
pnpm test
```

**Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md scripts/__tests__/agent-guidance.test.mjs
git commit -m "Align agent guidance with actual package exports

Constraint: future agents were being routed to functions that do not exist.
Rejected: trust prose docs over type exports | AGENTS is an execution contract and must be test-backed.
Confidence: high
Scope-risk: narrow
Tested: node --test scripts/__tests__/agent-guidance.test.mjs; pnpm test
Not-tested: downstream agent behavior"
```

---

## Phase 10: Clean Runtime, Private, And Fake Evidence Residue

### Task 10.1: Remove Tracked `.omc` Runtime State

**Files:**
- Remove from git: `.omc/**`
- Modify: `.gitignore` only if needed
- Test: `scripts/__tests__/repo-hygiene.test.mjs`

**Step 1: Add hygiene test**

```js
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

test('ignored runtime state is not tracked', () => {
  const tracked = execFileSync('git', ['ls-files', '.omc', '.omx', '.claude'], { encoding: 'utf8' });
  assert.equal(tracked.trim(), '');
});
```

**Step 2: Remove tracked files**

```bash
git rm -r --cached .omc
```

Do not delete local ignored state unless explicitly needed; just untrack it.

**Step 3: Verify**

```bash
node --test scripts/__tests__/repo-hygiene.test.mjs
git status --short
```

**Step 4: Commit**

```bash
git add .gitignore scripts/__tests__/repo-hygiene.test.mjs
git rm -r --cached .omc
git commit -m "Stop tracking local agent runtime state

Constraint: ignored .omc runtime files were tracked and dirty, making repo handoff noisy.
Rejected: preserve runtime state in git | local agent state is not product source.
Confidence: high
Scope-risk: narrow
Tested: node --test scripts/__tests__/repo-hygiene.test.mjs; git status --short
Not-tested: restoring historical agent replay data"
```

### Task 10.2: Remove Private Inference Endpoints From Public Repo

**Files:**
- Modify: `.cursorrules`
- Modify: `.windsurfrules`
- Modify: `.github/copilot-instructions.md`
- Modify: `scripts/real-benchmark.mjs`
- Modify: `scripts/model-benchmark.py`
- Modify or archive: `benchmark_runs/20260430-real-benchmark-summary.md`
- Test: `scripts/__tests__/private-endpoints.test.mjs`

**Step 1: Add test**

Assert no tracked non-test/non-remediation file contains `localhost` or private Tailscale endpoint.

**Step 2: Replace defaults**

In `scripts/real-benchmark.mjs`, require explicit `LLM_API_URL`:

```js
const API_URL = process.env.LLM_API_URL;
if (!API_URL) {
  throw new Error('LLM_API_URL is required for real benchmark; no private default is provided.');
}
```

**Step 3: Rewrite agent docs**

Remove claims about org-wide protected branches, exact linters that do not exist, and private inference.

**Step 4: Verify**

```bash
node --test scripts/__tests__/private-endpoints.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add .cursorrules .windsurfrules .github/copilot-instructions.md scripts/real-benchmark.mjs scripts/model-benchmark.py benchmark_runs scripts/__tests__/private-endpoints.test.mjs
git commit -m "Remove private inference assumptions from public repo

Constraint: public docs and scripts referenced a private Tailscale inference endpoint.
Rejected: keep local defaults for convenience | public launch repo must not depend on private infrastructure.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/private-endpoints.test.mjs; pnpm test
Not-tested: maintainer local benchmark convenience"
```

### Task 10.3: Mark Or Remove Fake Customer Reports

**Files:**
- Modify/remove: `audits/sample-customer-report.md`
- Modify/remove: `audits/release-candidate-2026-04-22/**`
- Modify: `scripts/dialect-report.mjs`
- Test: `scripts/__tests__/dialect-report-script.test.mjs`

**Step 1: Decide policy**

Either delete fake reports or label them as fixtures. Preferred:
- Move samples under `packages/cli/src/__tests__/fixtures/reports/` if used by tests.
- Remove launch-facing `audits/sample-customer-report.md` if not real.

**Step 2: Remove hardcoded native-reviewed statuses**

In `scripts/dialect-report.mjs`, read validation statuses from input evidence only. Do not hardcode `es-PA` / `es-PR` as native-reviewed.

**Step 3: Add test**

Assert generated report does not include `native-reviewed` unless input explicitly contains that status.

**Step 4: Verify**

```bash
node --test scripts/__tests__/dialect-report-script.test.mjs
pnpm test
```

**Step 5: Commit**

```bash
git add audits scripts/dialect-report.mjs scripts/__tests__/dialect-report-script.test.mjs packages/cli/src/__tests__/fixtures
git commit -m "Remove fake native-review proof from launch reports

Constraint: sample reports presented mock certification as customer-ready evidence.
Rejected: hardcoded native-reviewed labels | certification reports must derive status from input evidence.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/dialect-report-script.test.mjs; pnpm test
Not-tested: real customer report generation"
```

---

## Phase 11: Performance And Scalability Remediation

### Task 11.1: Reduce Semantic Prompt Bloat

**Files:**
- Modify: `packages/providers/src/providers/llm-prompts.ts`
- Modify: `packages/cli/src/lib/semantic-context.ts` if relevant
- Test: provider/CLI prompt tests

**Step 1: Add prompt-size tests**

For tiny input “Hello”, assert prompt/context under a fixed budget, for example `< 8_000` chars unless live mode requests expanded context.

**Step 2: Implement profile-based context**

- Default: compact dialect metadata, only target dialect, only relevant ambiguity hints.
- Expanded: opt-in for certification/research.

**Step 3: Verify**

```bash
pnpm --filter=@dialectos/providers test -- llm-prompts
pnpm --filter=@dialectos/cli test -- semantic-context
pnpm test
```

**Step 4: Commit**

```bash
git add packages/providers/src/providers/llm-prompts.ts packages/cli/src/lib/semantic-context.ts packages/**/__tests__
git commit -m "Bound semantic prompt size for normal translations

Constraint: tiny inputs produced 20KB-plus prompt context, increasing latency and cost.
Rejected: always include full dialect universe | default prompts should include only relevant target context.
Confidence: medium
Scope-risk: moderate
Tested: provider and CLI prompt/context tests; pnpm test
Not-tested: live model quality regression across all providers"
```

### Task 11.2: Make Bulk Dedup Key Include Request Semantics

**Files:**
- Modify: `packages/providers/src/bulk/engine.ts`
- Test: `packages/providers/src/bulk/__tests__/engine.test.ts`

**Step 1: Add failing test**

Two items with same `sourceText` but different `targetLang`/dialect must produce two provider calls and distinct outputs.

**Step 2: Implement dedup key**

Replace source-only map with:

```ts
const key = JSON.stringify({
  sourceText: normalized,
  sourceLang: item.sourceLang,
  targetLang: item.targetLang,
  dialect: item.options?.dialect,
  formality: item.options?.formality,
  context: item.options?.context,
});
```

Keep original source text in representative item.

**Step 3: Verify**

```bash
pnpm --filter=@dialectos/providers test -- bulk
pnpm test
```

**Step 4: Commit**

```bash
git add packages/providers/src/bulk/engine.ts packages/providers/src/bulk/__tests__/engine.test.ts
git commit -m "Deduplicate bulk translations by full request semantics

Constraint: source-only dedupe reused one dialect result for other dialect targets.
Rejected: cache by text alone | dialect/formality/context are part of translation identity.
Confidence: high
Scope-risk: moderate
Tested: pnpm --filter=@dialectos/providers test -- bulk; pnpm test
Not-tested: memory impact on very large mixed-dialect jobs"
```

### Task 11.3: Validate Concurrency And Cache Bounds

**Files:**
- Modify: `packages/providers/src/bulk/semaphore.ts`
- Modify: `packages/providers/src/translation-memory.ts`
- Tests: provider tests

**Step 1: Add tests**

- `maxConcurrency <= 0` throws configuration error.
- `TranslationMemory maxSize <= 0` either throws or has explicit documented unbounded mode not used by default.

**Step 2: Implement validation**

```ts
if (!Number.isInteger(permits) || permits < 1) throw new Error('Semaphore permits must be >= 1');
```

**Step 3: Verify**

```bash
pnpm --filter=@dialectos/providers test
pnpm test
```

**Step 4: Commit**

```bash
git add packages/providers/src/bulk/semaphore.ts packages/providers/src/translation-memory.ts packages/providers/src/__tests__ packages/providers/src/bulk/__tests__
git commit -m "Reject invalid bulk concurrency and cache bounds

Constraint: zero concurrency could hang and non-positive cache size disabled eviction silently.
Rejected: accept invalid knobs | configuration errors must fail before work starts.
Confidence: high
Scope-risk: narrow
Tested: pnpm --filter=@dialectos/providers test; pnpm test
Not-tested: external callers relying on invalid values"
```

---

## Phase 12: CI, Coverage, And Release Provenance

### Task 12.1: Install Coverage Provider And Add Coverage Gate

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vitest.workspace.ts` or package configs if needed
- Modify: `.github/workflows/ci.yml`

**Step 1: Add dependency**

```bash
pnpm add -D @vitest/coverage-v8 -w
```

**Step 2: Verify current coverage**

```bash
pnpm test:coverage
```

**Step 3: Add thresholds gradually**

Do not set unrealistic global 90% immediately. Start with a floor that fails only on catastrophic no coverage, then raise per package after tests are added.

**Step 4: Add CI step**

```yaml
      - run: pnpm test:coverage
```

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .github/workflows/ci.yml vitest.workspace.ts packages/*/vitest.config.*
git commit -m "Make coverage command executable in CI

Constraint: pnpm test:coverage failed because coverage provider was missing.
Rejected: keep broken coverage script | launch gates must be runnable from clean checkout.
Confidence: high
Scope-risk: moderate
Tested: pnpm test:coverage; pnpm test
Not-tested: final coverage thresholds for all packages"
```

### Task 12.2: Add Release Workflow With Provenance Dry Run

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `docs/RELEASE.md`
- Test: static workflow test

**Step 1: Document release policy**

`docs/RELEASE.md` must include:
- version bump process
- clean verification commands
- npm publish order
- tag creation
- GitHub release
- rollback/unpublish policy
- BSL/license note

**Step 2: Add workflow**

Start with manual `workflow_dispatch` dry-run job:
- install
- build
- test
- coverage
- audit
- package smoke
- npm publish `--dry-run` for every package

Do not enable real publish until registry ownership is verified.

**Step 3: Verify static workflow**

Add `scripts/__tests__/release-workflow.test.mjs` that checks release workflow includes audit, coverage, package smoke, and dry-run publish.

**Step 4: Commit**

```bash
git add .github/workflows/release.yml docs/RELEASE.md scripts/__tests__/release-workflow.test.mjs
git commit -m "Add dry-run release workflow and release runbook

Constraint: repo had release notes config but no reproducible publish/provenance process.
Rejected: publish manually from local state | releases need CI-backed repeatable gates.
Confidence: medium
Scope-risk: moderate
Tested: node --test scripts/__tests__/release-workflow.test.mjs; pnpm test
Not-tested: real npm publish credentials"
```

### Task 12.3: Pin Or Govern GitHub Actions

**Files:**
- Modify: `.github/workflows/*.yml`
- Modify: `.github/dependabot.yml`
- Test: `scripts/__tests__/workflow-security.test.mjs`

**Step 1: Add workflow security test**

Assert:
- Top-level permissions present in all workflows.
- No reusable workflow uses mutable `@main` unless explicitly allowlisted with reason.
- Dependabot includes `github-actions` ecosystem.

**Step 2: Fix workflows**

- Add top-level `permissions` to all workflows.
- Replace `KyaniteLabs/.github/...@main` with pinned SHA or remove Blacksmith probe if not launch-critical.
- Add Dependabot GitHub Actions ecosystem.

**Step 3: Verify**

```bash
node --test scripts/__tests__/workflow-security.test.mjs
pnpm test
```

**Step 4: Commit**

```bash
git add .github/workflows .github/dependabot.yml scripts/__tests__/workflow-security.test.mjs
git commit -m "Harden workflow permissions and action update coverage

Constraint: CI used mutable workflow refs and did not track GitHub Actions updates.
Rejected: rely on default permissions and branch refs | release gates are part of supply-chain security.
Confidence: medium
Scope-risk: moderate
Tested: node --test scripts/__tests__/workflow-security.test.mjs; pnpm test
Not-tested: every external action pinned to immutable SHA"
```

---

## Phase 13: Final Launch Readiness Gate

### Task 13.1: Create One Launch Gate Script

**Files:**
- Create: `scripts/launch-gate.mjs`
- Create: `scripts/__tests__/launch-gate.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Script the global Definition of Done**

`launch-gate.mjs` should run or orchestrate:
- clean dist
- install check (CI already installed, so script can skip by flag)
- build
- typecheck
- test
- coverage
- audit
- benchmark
- detection benchmark
- strict certification
- package smoke
- compose config/build check
- docs public-claim tests

Support `--no-docker` for machines without Docker, but CI/release must run Docker.

**Step 2: Add test**

Test command construction and failure propagation with mocked child process runner.

**Step 3: Add npm script**

```json
"launch:gate": "node scripts/launch-gate.mjs"
```

**Step 4: Verify**

```bash
node --test scripts/__tests__/launch-gate.test.mjs
pnpm launch:gate -- --no-docker
```

Expected: may fail until all earlier phases complete. Do not mark launch ready until it passes.

**Step 5: Commit**

```bash
git add scripts/launch-gate.mjs scripts/__tests__/launch-gate.test.mjs package.json .github/workflows/ci.yml
git commit -m "Codify launch readiness as one executable gate

Constraint: prior launch confidence depended on scattered proxy checks and stale reports.
Rejected: manual checklist only | launch readiness must be reproducible by CI and future agents.
Confidence: high
Scope-risk: moderate
Tested: node --test scripts/__tests__/launch-gate.test.mjs; pnpm launch:gate -- --no-docker observed remaining blockers or pass
Not-tested: live public URL checks unless configured"
```

### Task 13.2: Re-Enable Positive Launch Claims Only After Gate Passes

**Files:**
- Modify: `README.md`
- Modify: `docs/index.html`
- Modify: `docs/launch-kit/**`
- Modify: `.llm`, `docs/llms.txt`

**Step 1: Run full launch gate**

```bash
pnpm launch:gate
```

Expected: pass.

**Step 2: Verify package registry if claiming npm**

```bash
npm view @dialectos/cli version
npm view @dialectos/mcp version
npm view @dialectos/types version
npm view @dialectos/providers version
npm view @dialectos/security version
npm view @dialectos/locale-utils version
npm view @dialectos/markdown-parser version
```

Expected: versions match release docs.

**Step 3: Verify live site**

```bash
node scripts/smoke-pages.mjs https://kyanitelabs.github.io/DialectOS/
```

**Step 4: Restore only verified positive claims**

Examples:
- “source-available under BSL 1.1” unless Apache conversion has happened.
- Exact test count only if generated by script in same commit.
- “npm install” only after packages are published and package smoke passes.
- “GitHub Action” only after tag/release exists and action smoke passes.

**Step 5: Commit**

```bash
git add README.md docs .llm
git commit -m "Restore launch copy from verified release evidence

Constraint: positive claims are allowed only after executable launch gates and live smokes pass.
Rejected: aspirational launch copy | public docs must cite current release truth.
Confidence: high
Scope-risk: broad
Tested: pnpm launch:gate; npm view package versions; node scripts/smoke-pages.mjs <canonical-url>
Not-tested: third-party search index refresh timing"
```

---

## Suggested PR Sequence

Do not put all phases in one PR. Use this order:

1. **PR 1: Public claim rollback** — Phase 1 only.
2. **PR 2: Public site/discovery smoke** — Phase 2.
3. **PR 3: Package installability** — Phase 3.
4. **PR 4: Action and CI validation** — Phase 4.
5. **PR 5: Docker/deploy reproducibility** — Phase 5.
6. **PR 6: Security hardening and audit blocking** — Phase 6.
7. **PR 7: Fail-closed CLI/MCP writes** — Phase 7.
8. **PR 8: Certification and validation truth** — Phase 8.
9. **PR 9: Docs/API/examples alignment** — Phase 9.
10. **PR 10: Repo hygiene/private residue cleanup** — Phase 10.
11. **PR 11: Performance/scalability fixes** — Phase 11.
12. **PR 12: Release and launch gate** — Phases 12-13.

Each PR should include:
- exact commands run
- failing-before/passing-after evidence for new tests
- known gaps
- Lore-compliant commits
- no unrelated cleanup

## Final Stop Condition

Stop remediation only when:

1. `pnpm launch:gate` passes from clean checkout.
2. Live Pages/discovery smoke passes.
3. API status/OPTIONS/translate smoke passes.
4. npm packages are published or all npm install claims are removed.
5. GitHub Action is tagged and smoke-tested or all action claims are removed.
6. SECURITY.md claims match current tests and audit output.
7. No tracked private endpoints/runtime state/fake launch reports remain.
8. Public docs use BSL-accurate language.
9. The final PR description includes all verification evidence and remaining non-launch-blocking caveats.

Until all nine are true, the correct launch status remains: **Do not launch**.
