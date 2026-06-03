import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const REQUIRED_FIELDS = [
  'name',
  'version',
  'description',
  'license',
  'repository',
  'homepage',
  'bugs',
  'keywords',
  'engines',
  'publishConfig',
];

const packages = readdirSync('packages')
  .map((p) => join('packages', p, 'package.json'))
  .filter((p) => {
    try {
      const json = JSON.parse(readFileSync(p, 'utf8'));
      return !json.private;
    } catch {
      return false;
    }
  });

assert.ok(packages.length > 0, 'expected at least one publishable workspace package');

for (const path of packages) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));

  test(`${pkg.name} has required publish metadata`, () => {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        field in pkg,
        `${path} missing required field: ${field}`
      );
    }
  });

  test(`${pkg.name} publishConfig.access is public`, () => {
    assert.equal(pkg.publishConfig?.access, 'public', `${path} publishConfig.access must be 'public'`);
  });

  test(`${pkg.name} license is Apache-2.0`, () => {
    assert.equal(pkg.license, 'Apache-2.0', `${path} license must be Apache-2.0`);
  });

  test(`${pkg.name} engines.node is >=20.0.0`, () => {
    assert.equal(pkg.engines?.node, '>=20.0.0', `${path} engines.node must be '>=20.0.0'`);
  });
}
