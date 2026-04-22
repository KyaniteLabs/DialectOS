import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const engine = readFileSync(new URL("../dialectos-engine.js", import.meta.url), "utf8");

test("docs demo is wired to the full app backend", () => {
  assert.match(html, /Full-App Translator/);
  assert.match(html, /fetch\('\/api\/translate'/);
  assert.match(html, /browser → local demo backend → provider registry → LLM semantic dialect prompt/);
  assert.match(html, /Translate with Full App/);
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
