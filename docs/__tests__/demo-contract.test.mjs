import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const engine = readFileSync(new URL("../dialectos-engine.js", import.meta.url), "utf8");

test("docs demo is wired to the full app backend", () => {
  assert.match(html, /Full-app translator/i);
  assert.match(html, /fetch\('\/api\/translate'/);
  assert.match(html, /browser to backend, backend to provider registry/);
  assert.match(html, /Translate with full app/i);
});

test("docs demo never silently falls back to static rule substitutions", () => {
  assert.doesNotMatch(html, /already compatible/);
  assert.doesNotMatch(html, /applyAdaptations\(text, target\)/);
  assert.match(html, /No static translation fallback was used/);
  assert.match(html, /\/api\/status/);
});

test("static docs engine has common three-word regional terms", () => {
  assert.match(engine, /\baguacate\b/);
  assert.match(engine, /\bpalta\b/);
  assert.match(engine, /\bguagua\b/);
  assert.match(engine, /\bbus\b/);
});

test("static docs engine does not guess a dialect on low-confidence text", () => {
  assert.match(engine, /insufficient-dialect-markers/);
  assert.match(engine, /isReliable/);
  assert.match(engine, /dialect: isReliable \? best\.dialect\.code : null/);
});
