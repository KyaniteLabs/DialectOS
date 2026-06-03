import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');

test('release workflow is workflow_dispatch only', () => {
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /push:\s*\n\s*tags:/);
  assert.doesNotMatch(workflow, /\bnpm publish\b/);
});

test('release workflow includes verification steps', () => {
  assert.match(workflow, /pnpm test/);
  assert.match(workflow, /pnpm test:coverage/);
  assert.match(workflow, /pnpm audit/);
});

test('release workflow includes package smoke', () => {
  assert.match(workflow, /tarball-smoke/);
});

test('release workflow includes dry-run publish', () => {
  assert.match(workflow, /default:\s*false/);
  assert.match(workflow, /pnpm publish --dry-run/);
});

test('release workflow gates real publish behind explicit input', () => {
  assert.match(workflow, /type:\s*boolean/);
  assert.match(workflow, /if:\s*\$\{\{\s*inputs\.publish\s*\}\}/);
  assert.match(workflow, /pnpm publish --access public --no-git-checks/);
});

test('release workflow skips versions already published to npm', () => {
  assert.match(workflow, /npm view "\$name@\$version" version/);
  assert.match(workflow, /already exists on npm; skipping/);
});
