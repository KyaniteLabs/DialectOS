import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const engine = readFileSync(new URL("../dialectos-engine.js", import.meta.url), "utf8");

test("docs demo is wired to the full app backend", () => {
  assert.match(html, /Full-app translator/i);
  assert.match(html, /fetch\('\/api\/translate'/);
  assert.match(html, /live backend → LLM, static page → vocabulary engine/);
  assert.match(html, /Translate with full app/i);
});

test("docs demo uses the client engine when backend is unreachable", () => {
  assert.match(html, /dialectos-engine\.js/);
  assert.match(html, /backendAvailable/);
  assert.match(html, /window\.detectDialect/);
  assert.match(html, /window\.applyAdaptations/);
  assert.match(html, /\/api\/status/);
  assert.doesNotMatch(html, /already compatible/);
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


const { existsSync } = await import("node:fs");

test("landing page ships the checked-in SVG logo asset", () => {
  assert.equal(existsSync(new URL("../assets/dialectos-logo.svg", import.meta.url)), true);
});

test("landing page uses the SVG logo in the main brand lockup and not the old PNG", () => {
  assert.match(html, /class="brand-logo"/);
  assert.match(html, /src="assets\/dialectos-logo\.svg"/);
  assert.doesNotMatch(html, /dialectos-logo\.png/);
});
