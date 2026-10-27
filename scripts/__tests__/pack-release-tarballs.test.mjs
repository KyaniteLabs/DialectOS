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

test("pack-release-tarballs emits bundled cli and mcp tarballs", () => {
  ensurePackageBuilt("cli");
  ensurePackageBuilt("mcp");
  const outdir = mkdtempSync(join(tmpdir(), "dialectos-pack-test-"));
  const result = pack(outdir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

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
  }

  const extractDir = mkdtempSync(join(tmpdir(), "dialectos-pack-extract-"));
  spawnSync("tar", ["-xzf", cliTar, "-C", extractDir], { stdio: "ignore" });
  const manifest = JSON.parse(readFileSync(join(extractDir, "package", "package.json"), "utf8"));
  assert.deepEqual(manifest.bundleDependencies, [
    "@dialectos/types",
    "@dialectos/security",
    "@dialectos/locale-utils",
    "@dialectos/markdown-parser",
    "@dialectos/providers",
  ]);
  assert.ok(manifest.dependencies.zod, "public deps of bundled libs must be hoisted");
  assert.ok(manifest.dependencies["isomorphic-dompurify"]);
  for (const ver of Object.values(manifest.dependencies)) {
    assert.notEqual(ver, "workspace:*");
  }
});
