import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

for (const name of ['types', 'providers']) {
  test(`${name} build propagates real TypeScript errors before copying assets`, () => {
    const project = path.join(root, 'packages', name);
    const manifest = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
    const fixture = mkdtempSync(path.join(tmpdir(), 'dialectos-build-failure-'));
    try {
      mkdirSync(path.join(fixture, 'src', 'data'), { recursive: true });
      mkdirSync(path.join(fixture, 'dist'), { recursive: true });
      writeFileSync(path.join(fixture, 'src', 'asset.json'), '{}');
      writeFileSync(path.join(fixture, 'src', 'data', 'asset.json'), '{}');
      writeFileSync(path.join(fixture, 'broken.ts'), 'const value: string = 123;');
      writeFileSync(path.join(fixture, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { noEmit: true, types: [] }, files: ['broken.ts'],
      }));
      const result = spawnSync('sh', ['-c', manifest.scripts.build], {
        cwd: fixture,
        env: { ...process.env, PATH: path.join(project, 'node_modules', '.bin') + path.delimiter + process.env.PATH },
        encoding: 'utf8',
        timeout: 30000,
      });
      assert.ifError(result.error);
      assert.match(result.stdout + result.stderr, /TS2322/, 'the real compiler must reject the fixture');
      assert.notEqual(result.status, 0, 'asset copying must not hide compilation failure');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
