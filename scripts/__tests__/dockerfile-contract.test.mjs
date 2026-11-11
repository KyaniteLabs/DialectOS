import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const dockerfileDemo = readFileSync('Dockerfile.demo', 'utf8');
const dockerfileServer = readFileSync('server/Dockerfile', 'utf8');
const composeRoot = readFileSync('docker-compose.yml', 'utf8');
const composeHostinger = readFileSync('server/deploy/hostinger-vps/docker-compose.yml', 'utf8');

test('Dockerfile.demo copies tsconfig.base.json', () => {
  assert.ok(dockerfileDemo.includes('tsconfig.base.json'), 'Dockerfile.demo must copy tsconfig.base.json');
});

test('server/Dockerfile copies tsconfig.base.json', () => {
  assert.ok(dockerfileServer.includes('tsconfig.base.json'), 'server/Dockerfile must copy tsconfig.base.json');
});

test('server/Dockerfile copies scripts/lib/ensure-built.mjs', () => {
  assert.ok(
    dockerfileServer.includes('scripts/lib/ensure-built.mjs'),
    'server/Dockerfile must copy scripts/lib/ensure-built.mjs'
  );
});

test('docker-compose.yml does not hard-require .env file', () => {
  assert.doesNotMatch(composeRoot, /^\s*env_file:/m, 'root docker-compose.yml must not hard-require env_file');
});

test('.env.example exists', () => {
  assert.ok(existsSync('.env.example'), '.env.example must exist');
});

test('hostinger docker-compose references an existing Dockerfile', () => {
  const dockerfileMatch = composeHostinger.match(/dockerfile:\s*(.+)/);
  assert.ok(dockerfileMatch, 'hostinger docker-compose must declare a dockerfile');
  const dockerfilePath = dockerfileMatch[1].trim();
  assert.ok(existsSync(dockerfilePath), `hostinger docker-compose references missing ${dockerfilePath}`);
});

test('root Dockerfile builds the MCP server from this checkout', () => {
  const dockerfile = readFileSync('Dockerfile', 'utf8');
  assert.doesNotMatch(dockerfile, /npm install -g/, 'root Dockerfile must not install a package from the npm registry');
  assert.match(dockerfile, /pnpm install --frozen-lockfile/, 'root Dockerfile must install from the lockfile');
  assert.match(dockerfile, /ENTRYPOINT \["node", "\/app\/packages\/mcp\/dist\/index\.js"\]/, 'root Dockerfile must start the built MCP server');
});
