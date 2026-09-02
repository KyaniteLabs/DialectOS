import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const files = ['README.md', 'SECURITY.md', '.llm', 'ROADMAP.md'];
const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')]));
const cliReadme = readFileSync('packages/cli/README.md', 'utf8');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const launchKitFiles = walk('docs/launch-kit');
const collateralFiles = [
  'docs/social-launch-kit.md',
  ...launchKitFiles,
];

const allContents = { ...contents };
for (const file of collateralFiles) {
  try {
    allContents[file] = readFileSync(file, 'utf8');
  } catch {
    // skip missing
  }
}

test('public docs do not claim unpublished npm packages', () => {
  for (const [file, text] of Object.entries(allContents)) {
    assert.doesNotMatch(text, /npm install -g @dialectos\/cli/iu, `${file} advertises unpublished CLI package`);
    assert.doesNotMatch(text, /npx -y @dialectos\/mcp/iu, `${file} advertises unpublished MCP package`);
  }
});

test('public docs may reference the released v0.3.0 GitHub Action tag', () => {
  const text = readFileSync('docs/github-action.md', 'utf8');
  assert.match(text, /KyaniteLabs\/DialectOS\/action@v0\.3\.0/iu);
});

test('public install docs point users to release tarballs before source checkout', () => {
  const rootLlms = readFileSync('llms.txt', 'utf8');
  const docsLlms = readFileSync('docs/llms.txt', 'utf8');

  assert.doesNotMatch(contents['README.md'], /Setup requires cloning the repo and building from source/iu);
  assert.match(contents['README.md'], /GitHub Release tarballs/iu);
  assert.match(contents['README.md'], /dialectos-mcp-0\.3\.0\.tgz/iu);
  assert.match(rootLlms, /GitHub Release tarballs/iu);
  assert.match(docsLlms, /GitHub Release tarballs/iu);
});

test('CLI README command examples use the installed dialectos binary', () => {
  assert.doesNotMatch(cliReadme, /^node packages\/cli\/dist\/index\.js/mu);
  assert.match(cliReadme, /\bdialectos translate "Hello world" --dialect es-MX\b/u);
});

test('public docs do not contain stale BSL license claims', () => {
  for (const [file, text] of Object.entries(allContents)) {
    assert.doesNotMatch(text, /BSL|Business Source|Change Date|Additional Use Grant/iu, `${file} contains stale BSL-era license language`);
    assert.doesNotMatch(text, /becomes Apache-2\.0|Apache-2\.0 in 2030|2030-04-20/iu, `${file} contains stale delayed-Apache language`);
  }
});

test('public docs do not hardcode stale test or security counts', () => {
  for (const [file, text] of Object.entries(allContents)) {
    assert.doesNotMatch(text, /\b1,?034\b/iu, `${file} hardcodes stale test count`);
    assert.doesNotMatch(text, /0 vulnerabilities|zero vulnerabilities/iu, `${file} hardcodes false vulnerability count`);
  }
});

test('security policy only claims implemented controls', () => {
  const text = readFileSync('SECURITY.md', 'utf8');
  assert.doesNotMatch(text, /private IP ranges|localhost/iu, 'SECURITY.md claims private IP SSRF protection');
  assert.doesNotMatch(text, /ANSI sanitization/iu, 'SECURITY.md claims ANSI sanitization');
});
