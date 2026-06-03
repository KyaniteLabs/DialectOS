import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const files = ['README.md', 'SECURITY.md', '.llm', 'ROADMAP.md'];
const contents = Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')]));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const launchKitFiles = walk('docs/launch-kit');
const collateralFiles = [
  'docs/social-launch-kit.md',
  'docs/SEO-AI-SEO-MASTERPLAN.md',
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

test('public docs do not call BSL current version open source or production-free', () => {
  for (const [file, text] of Object.entries(allContents)) {
    assert.doesNotMatch(text, /open[- ]source/iu, `${file} uses open-source for current BSL release`);
    assert.doesNotMatch(text, /production use allowed|allows production use/iu, `${file} overstates BSL production rights`);
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
