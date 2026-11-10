import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const server = JSON.parse(readFileSync("server.json", "utf8"));
const changelog = readFileSync("CHANGELOG.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const llms = readFileSync("llms.txt", "utf8");
const version = pkg.version;

test("current version is one story across public metadata", () => {
  assert.equal(server.version, version);
  assert.match(changelog, new RegExp(`^## \\[${version}\\]`, "m"));
  assert.match(readme, new RegExp(`DialectOS v${version} is distributed`));
  assert.match(readme, new RegExp(`/releases/download/v${version}/dialectos-cli-${version}\\.tgz`));
  assert.match(readme, new RegExp(`/releases/download/v${version}/dialectos-mcp-${version}\\.tgz`));
  assert.match(llms, new RegExp(`v${version}`));
  assert.doesNotMatch(llms, /@kyanitelabs\/dialectos/);
});

test("server.json does not claim an unpublished npm package", () => {
  // Repo-only record until act ② publishes real @dialectos/* packages (#249):
  // the registry rejects raw tarball URLs, so packages may only bind npm
  // identifiers, and any entry must carry the current version.
  const packages = server.packages ?? [];
  for (const { identifier = "", version: packageVersion } of packages) {
    assert.doesNotMatch(identifier, /@kyanitelabs\/dialectos/);
    assert.doesNotMatch(identifier, /^https?:\/\//);
    assert.equal(packageVersion, version);
  }
});

test("validate CLI example matches the released surface (no --translated-only lie)", () => {
  assert.match(
    readme,
    /dialectos validate --source "Click the button" --translated "Haz clic en el botón" --dialect es-MX/,
  );
});
