import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('live translation path resets button in finally block', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.match(html, /finally\s*\{/u, 'must have a finally block for button cleanup');
  assert.match(html, /translateButton'\)\.disabled\s*=\s*false/u, 'must re-enable button');
});

test('demo does not hardcode judge passed', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.doesNotMatch(html, /\['quality',\s*'judge passed'\]/u, 'must not hardcode quality verdict');
});

test('demo receipts use real response fields', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.doesNotMatch(html, /judge passed/u, 'must not contain hardcoded judge passed text');
});

test('live receipt only claims checks the demo backend runs', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  // web-demo-service runs the output judge and idiom check; the semantic
  // backstop, negation gate and grammar detection live in the CLI/MCP paths.
  assert.doesNotMatch(html, /backstop \+ negation gate/u);
  assert.match(html, /output judge \+ idiom check/u);
  assert.match(html, /not run by this demo/u);
});

test('translation output and receipt announce updates to assistive tech', () => {
  const html = readFileSync('docs/index.html', 'utf8');
  assert.match(html, /id="outputBox"[^>]*aria-live="polite"/u);
  assert.match(html, /class="receipt-grid"[^>]*aria-live="polite"/u);
});
