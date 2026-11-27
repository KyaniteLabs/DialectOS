import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

// Guard for card t_3d696dd0 (audit ledger row 41).
//
// The shipped page advertises a "stress preset" per chip. Each preset must be
// exercised against the client engine this page actually ships, and every
// expectation the page displays must be one that engine fulfils. Before this
// guard existed the Puerto Rico orange chip promised `jugo de china` and the
// room chip promised `recoger el cuarto`, while the shipped client engine can
// only perform word-level vocabulary swaps: the canonical shared engine emits
// `El jugo de naranja ...` for the same source too. Those two outcomes belong
// to the semantic/LLM layer, so a client-mode chip must not display them as a
// client-mode result.
//
// `data-client-expect` / `data-client-absent` make each chip's promise
// executable: the tokens listed as expected must appear in the engine output,
// and the tokens listed as absent must no longer be there.

const html = readFileSync('docs/index.html', 'utf8');
const engineSource = readFileSync('docs/dialectos-engine.js', 'utf8');

const PRESETS = Object.fromEntries(
  [...html.matchAll(/'([^']+)':\s*\{\s*text:\s*'([^']*)',\s*target:\s*'([^']*)'\s*\}/gu)]
    .map(([, key, text, target]) => [key, { text, target }]),
);

const CHIPS = [...html.matchAll(
  /<button class="chip" data-preset="([^"]+)"([^>]*)>([^<]*)<small>([^<]*)<\/small><\/button>/gu,
)].map(([, key, attrs, label, copy]) => ({
  key,
  label: label.trim(),
  copy: copy.trim(),
  expect: (attrs.match(/data-client-expect="([^"]*)"/u)?.[1] ?? '').split(/\s+/u).filter(Boolean),
  absent: (attrs.match(/data-client-absent="([^"]*)"/u)?.[1] ?? '').split(/\s+/u).filter(Boolean),
}));

// Outcomes the page itself files under "Semantic traps": the client engine has
// no phrase-sense or polysemy resolution, so a client-mode chip may only show
// them as a backend/semantic-layer result.
const SEMANTIC_ONLY = [
  ['es-pr-orange', 'jugo de china'],
  ['es-pr-room', 'recoger el cuarto'],
];

const lower = (value) => value.toLocaleLowerCase('es');
const mentions = (haystack, needle) => lower(haystack).includes(lower(needle));

function loadClientEngine() {
  const window = {};
  runInContext(engineSource, createContext({ window }), { filename: 'docs/dialectos-engine.js' });
  return window;
}

const engine = loadClientEngine();
const runPreset = (preset) => engine.adaptForDialect(preset.text, preset.target);

test('every shipped preset has exactly one chip, and every chip a preset', () => {
  assert.ok(CHIPS.length > 0, 'docs/index.html must ship at least one preset chip');
  assert.deepEqual(CHIPS.map((chip) => chip.key).sort(), Object.keys(PRESETS).sort());
  assert.equal(new Set(CHIPS.map((chip) => chip.key)).size, CHIPS.length, 'duplicate chip');
});

test('every chip declares the client-mode result it displays', () => {
  for (const chip of CHIPS) {
    assert.ok(
      chip.expect.length > 0,
      `chip ${chip.key} must declare data-client-expect so its displayed expectation stays testable`,
    );
  }
});

test('the shipped client engine delivers every declared preset expectation', () => {
  assert.equal(typeof engine.adaptForDialect, 'function', 'the shipped bundle must expose adaptForDialect');
  for (const chip of CHIPS) {
    const preset = PRESETS[chip.key];
    const out = runPreset(preset);
    for (const token of chip.expect) {
      assert.ok(
        mentions(out, token),
        `chip ${chip.key} promises "${token}" but the client engine produced: ${out}`,
      );
    }
    for (const token of chip.absent) {
      assert.ok(
        !mentions(out, token),
        `chip ${chip.key} says "${token}" is swapped out but the client engine kept it: ${out}`,
      );
    }
  }
});

test('every arrow claim in the chip copy is what the client engine does', () => {
  for (const chip of CHIPS) {
    const preset = PRESETS[chip.key];
    const out = runPreset(preset);
    for (const [, from, to] of chip.copy.matchAll(/(\S+)\s*→\s*([^\s,.;]+)/gu)) {
      assert.ok(mentions(preset.text, from), `chip ${chip.key} claims "${from} → ${to}" but the source has no "${from}"`);
      assert.ok(mentions(out, to), `chip ${chip.key} claims "${from} → ${to}" but the output has no "${to}": ${out}`);
      assert.ok(!mentions(out, from), `chip ${chip.key} claims "${from} → ${to}" but the output still has "${from}": ${out}`);
    }
  }
});

test('the page does not display a semantic-layer outcome as a client-mode result', () => {
  for (const [key, phrase] of SEMANTIC_ONLY) {
    const chip = CHIPS.find((candidate) => candidate.key === key);
    assert.ok(chip, `missing chip ${key}`);
    const out = runPreset(PRESETS[key]);
    assert.match(chip.copy, /client mode/iu, `chip ${key} must qualify its claim as client-mode behavior`);
    if (!mentions(out, phrase)) {
      assert.ok(
        !mentions(chip.copy, phrase),
        `chip ${key} displays "${phrase}" but the shipped client engine cannot produce it: ${out}`,
      );
    }
  }
});
