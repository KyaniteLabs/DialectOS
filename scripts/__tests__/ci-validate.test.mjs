import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { globToRegExp, findFiles } from '../ci-validate.mjs';
import { ensurePackageBuilt } from '../lib/ensure-built.mjs';

const REPO = resolve(import.meta.dirname, '../..');
const SCRIPT = join(REPO, 'scripts/ci-validate.mjs');
const CLI = join(REPO, 'packages/cli/dist/cli.js');

ensurePackageBuilt('cli');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'dialectos-ci-validate-'));
  mkdirSync(join(dir, 'locales/nested'), { recursive: true });
  writeFileSync(join(dir, 'locales/en.json'), JSON.stringify({ greeting: 'Hello {name}, open the file' }));
  writeFileSync(join(dir, 'locales/good.es-MX.json'), JSON.stringify({ greeting: 'Hola {name}, abre el archivo' }));
  writeFileSync(join(dir, 'locales/nested/bad.es-MX.json'), JSON.stringify({ greeting: 'Hola, abre el archivo' }));
  return dir;
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, '--dialect=es-MX', '--source-dir=.', ...args], {
    cwd,
    encoding: 'utf-8',
  });
}

test('globToRegExp handles **/, * and ? like a real glob', () => {
  assert.ok(globToRegExp('**/*.es.json').test('a.es.json'));
  assert.ok(globToRegExp('**/*.es.json').test('x/y/a.es.json'));
  assert.ok(!globToRegExp('*.es.json').test('x/a.es.json'));
  assert.ok(globToRegExp('locales/??.json').test('locales/en.json'));
  assert.ok(!globToRegExp('locales/*.json').test('locales/deep/en.json'));
});

test('findFiles matches nested files for **/ patterns and basenames for bare patterns', () => {
  const dir = fixture();
  try {
    const nested = findFiles(dir, ['**/*.es-MX.json']).map((f) => f.slice(dir.length + 1));
    assert.deepEqual(nested, ['locales/good.es-MX.json', 'locales/nested/bad.es-MX.json']);
    const bare = findFiles(dir, ['bad.es-MX.json']).map((f) => f.slice(dir.length + 1));
    assert.deepEqual(bare, ['locales/nested/bad.es-MX.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a broken translation fails the gate end to end through the real CLI binary', () => {
  const dir = fixture();
  try {
    const res = run(dir, '--target-patterns=**/*.es-MX.json', '--locale-base=locales/en.json', `--cli-path=${CLI}`);
    assert.equal(res.status, 1, `expected exit 1, got ${res.status}\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /\[FAIL\] .*bad\.es-MX\.json/u);
    assert.match(res.stdout, /\[PASS\] .*good\.es-MX\.json/u);
    assert.match(res.stdout, /Placeholder was not preserved: \{name\}/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a clean translation passes, and the default cli-path is the binary', () => {
  const dir = fixture();
  try {
    const res = run(dir, '--target-patterns=good.es-MX.json', '--locale-base=locales/en.json');
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /1 passed, 0 failed/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the library entry (dist/index.js) can no longer fake a pass', () => {
  const dir = fixture();
  try {
    const res = run(
      dir,
      '--target-patterns=bad.es-MX.json',
      '--locale-base=locales/en.json',
      `--cli-path=${join(REPO, 'packages/cli/dist/index.js')}`,
    );
    assert.notEqual(res.status, 0, 'running the library entry must not count as a pass');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('explicit patterns that match nothing fail unless allow-empty is set', () => {
  const dir = fixture();
  try {
    const empty = run(dir, '--target-patterns=**/*.fr.json', `--cli-path=${CLI}`);
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /matched no files/u);
    const allowed = run(dir, '--target-patterns=**/*.fr.json', '--allow-empty', `--cli-path=${CLI}`);
    assert.equal(allowed.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing CLI binary is an error, not a pass', () => {
  const dir = fixture();
  try {
    const res = run(dir, '--target-patterns=good.es-MX.json', `--cli-path=${join(dir, 'nope.js')}`);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /CLI not found/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validate --format json keeps stdout pure JSON when validation fails', () => {
  const res = spawnSync(
    process.execPath,
    [CLI, 'validate', '--dialect=es-MX', '--source=Do not open {file}', '--format=json', 'Abre el archivo'],
    { encoding: 'utf-8' },
  );
  assert.equal(res.status, 1, res.stderr);
  assert.doesNotThrow(() => JSON.parse(res.stdout), `stdout was not JSON:\n${res.stdout}`);
  assert.match(res.stderr, /Validation failed/u);
});
