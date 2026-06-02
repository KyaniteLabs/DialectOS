import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

function safeFixturePath(rootDir, requestUrl) {
  const url = new URL(requestUrl || '/', 'http://127.0.0.1');
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.slice(1);
  const absolute = resolve(rootDir, relativePath);
  const rel = relative(rootDir, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }
  return absolute;
}

function startServer(rootDir, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = safeFixturePath(rootDir, req.url);
      if (!path) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      try {
        const data = readFileSync(path, 'utf8');
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(port, () => resolve(server));
  });
}

function runSmoke(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/smoke-pages.mjs', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('smoke-pages passes against a valid site', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dialectos-smoke-'));
  writeFileSync(join(dir, 'index.html'), '<html>hello</html>');
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  writeFileSync(join(dir, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>');
  writeFileSync(join(dir, 'llms.txt'), '# DialectOS');

  const server = await startServer(dir, 0);
  const port = server.address().port;

  try {
    const res = await runSmoke(`http://127.0.0.1:${port}`);
    assert.equal(res.code, 0, `smoke should pass: ${res.stderr}`);
    assert.match(res.stdout, /Pages smoke passed/);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test('smoke-pages fails against a 404 site', async () => {
  const server = await startServer(tmpdir(), 0);
  const port = server.address().port;

  try {
    const res = await runSmoke(`http://127.0.0.1:${port}`);
    assert.notEqual(res.code, 0, 'smoke should fail on 404');
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test('fixture server treats malformed encoded paths as 404', async () => {
  const server = await startServer(tmpdir(), 0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/%E0%A4%A`);
    assert.equal(res.status, 404);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
