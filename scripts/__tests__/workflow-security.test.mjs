import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflowsDir = '.github/workflows';
const workflowFiles = readdirSync(workflowsDir)
  .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  .map((f) => join(workflowsDir, f));

// Workflows that reference reusable workflows with mutable refs for documented reasons
const mutableRefAllowlist = new Map([]);

test('all workflows declare explicit permissions', () => {
  for (const file of workflowFiles) {
    const text = readFileSync(file, 'utf8');
    assert.match(text, /permissions:\s*\n/m, `${file} missing explicit permissions block`);
  }
});

test('no workflow uses mutable action ref without allowlist', () => {
  for (const file of workflowFiles) {
    const text = readFileSync(file, 'utf8');
    const allowed = mutableRefAllowlist.get(file);
    const usesLines = text.split('\n').filter((l) => l.trim().startsWith('uses:'));
    for (const line of usesLines) {
      const ref = line.trim().replace('uses:', '').trim();
      // Skip local reusable workflow refs that are allowlisted
      if (allowed && ref === allowed) continue;
      // Flag mutable refs (@main, @master, @v1 without patch)
      if (/@[a-z]+$/i.test(ref) && !ref.includes('@sha')) {
        assert.fail(`${file} uses mutable ref: ${ref}`);
      }
    }
  }
});

test('dependabot covers github-actions ecosystem', () => {
  const dependabot = readFileSync('.github/dependabot.yml', 'utf8');
  assert.match(dependabot, /package-ecosystem:\s*"github-actions"/);
});
