import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/cli');
const manifest = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
const binary = path.resolve(project, manifest.bin.dialectos);
assert(!path.relative(project, binary).startsWith('..'), 'CLI binary must remain in its package');

function invoke(args, expectedStatus) {
  const result = spawnSync(process.execPath, [binary, ...args], {
    encoding: 'utf8', timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, expectedStatus, result.stderr);
  return result.stdout + result.stderr;
}

assert.match(invoke(['--help'], 0), /Usage: dialectos/);
const dialects = invoke(['dialects', 'list'], 0);
assert.match(dialects, /es-MX/);
assert.match(dialects, /es-AR/);
assert.match(invoke(['ci-intentionally-invalid-command'], 1), /unknown command/i);
console.log('Built package binary passed help, local query, and invalid-command acceptance.');
