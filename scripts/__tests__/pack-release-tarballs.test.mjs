import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { ensurePackageBuilt } from "../lib/ensure-built.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;

function pack(outdir) {
  return spawnSync(process.execPath, ["scripts/pack-release-tarballs.mjs", outdir], {
    encoding: "utf8",
    cwd: ROOT,
    env: {
      ...process.env,
      npm_config_cache: join(outdir, ".npm-cache"),
    },
  });
}

// Packing vendors the dependency closure from the registry — do it once for
// the whole file (takes minutes, not seconds).
let cachedOutdir = null;
function ensurePacked() {
  if (cachedOutdir) return cachedOutdir;
  ensurePackageBuilt("cli");
  ensurePackageBuilt("mcp");
  const outdir = mkdtempSync(join(tmpdir(), "dialectos-pack-test-"));
  const result = pack(outdir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  cachedOutdir = outdir;
  return outdir;
}

test("pack-release-tarballs emits cli and mcp tarballs with the full dep closure bundled", () => {
  const outdir = ensurePacked();

  const cliPkg = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8"));
  const mcpPkg = JSON.parse(readFileSync(join(ROOT, "packages/mcp/package.json"), "utf8"));
  const cliTar = join(outdir, `dialectos-cli-${cliPkg.version}.tgz`);
  const mcpTar = join(outdir, `dialectos-mcp-${mcpPkg.version}.tgz`);

  for (const tarball of [cliTar, mcpTar]) {
    const listing = spawnSync("tar", ["-tzf", tarball], { encoding: "utf8" });
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /package\/node_modules\/@dialectos\/locale-utils\/package\.json/);
    assert.match(listing.stdout, /package\/node_modules\/@dialectos\/types\/package\.json/);
    assert.match(listing.stdout, /package\/node_modules\/@dialectos\/security\/package\.json/);
    assert.match(listing.stdout, /package\/node_modules\/@dialectos\/markdown-parser\/package\.json/);
    assert.match(listing.stdout, /package\/node_modules\/@dialectos\/providers\/package\.json/);
    // The 2026-10-27 defect: npm skips deps co-declared by bundled packages,
    // so the transitive closure must ship inside the tarball.
    assert.match(
      listing.stdout,
      /package\/node_modules\/isomorphic-dompurify\/package\.json/,
      "isomorphic-dompurify must be vendored",
    );
    assert.match(listing.stdout, /package\/node_modules\/zod\/package\.json/, "zod must be vendored");
    assert.match(listing.stdout, /package\/node_modules\/jsdom\/package\.json/, "jsdom must be vendored");
  }

  const extractDir = mkdtempSync(join(tmpdir(), "dialectos-pack-extract-"));
  spawnSync("tar", ["-xzf", cliTar, "-C", extractDir], { stdio: "ignore" });
  const manifest = JSON.parse(readFileSync(join(extractDir, "package", "package.json"), "utf8"));
  for (const lib of [
    "@dialectos/types",
    "@dialectos/security",
    "@dialectos/locale-utils",
    "@dialectos/markdown-parser",
    "@dialectos/providers",
  ]) {
    assert.ok(manifest.bundleDependencies.includes(lib), `${lib} must stay bundled`);
  }
  for (const pub of ["isomorphic-dompurify", "zod", "jsdom", "commander", "marked"]) {
    assert.ok(manifest.bundleDependencies.includes(pub), `${pub} must be in bundleDependencies`);
  }
  assert.ok(manifest.dependencies.zod, "public deps of bundled libs must be hoisted");
  assert.ok(manifest.dependencies["isomorphic-dompurify"]);
  for (const ver of Object.values(manifest.dependencies)) {
    assert.notEqual(ver, "workspace:*");
  }
});

test("packed cli tarball installs offline and runs (defect bar 2026-10-27)", { timeout: 300_000 }, () => {
  const outdir = ensurePacked();
  const cliPkg = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8"));
  const mcpPkg = JSON.parse(readFileSync(join(ROOT, "packages/mcp/package.json"), "utf8"));

  const smoke = spawnSync(
    process.execPath,
    [
      "scripts/tarball-install-smoke.mjs",
      join(outdir, `dialectos-cli-${cliPkg.version}.tgz`),
      join(outdir, `dialectos-mcp-${mcpPkg.version}.tgz`),
    ],
    { encoding: "utf8", cwd: ROOT, timeout: 240_000 },
  );
  assert.equal(smoke.status, 0, smoke.stderr || smoke.stdout);
  assert.match(smoke.stdout, /receipt 2 OK/);
  assert.match(smoke.stdout, /receipt 3 OK/);
  assert.match(smoke.stdout, /receipt 4 OK/);
});
