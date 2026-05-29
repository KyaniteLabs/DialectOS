import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { ensurePackageBuilt } from "../lib/ensure-built.mjs";

function run(args) {
  return spawnSync(process.execPath, ["scripts/tarball-smoke.mjs", ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
}

function createFakeTarball(dir, pkg) {
  const pkgDir = join(dir, "package");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify(pkg, null, 2));
  // Create a dummy main file
  if (pkg.main) {
    mkdirSync(dirname(join(pkgDir, pkg.main)), { recursive: true });
    writeFileSync(join(pkgDir, pkg.main), "// dummy\n");
  }
  if (pkg.bin) {
    const bins = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin;
    for (const [_, path] of Object.entries(bins)) {
      mkdirSync(dirname(join(pkgDir, path)), { recursive: true });
      writeFileSync(join(pkgDir, path), "#!/usr/bin/env node\n// dummy\n");
    }
  }
  const tarball = join(dir, "fake.tgz");
  spawnSync("tar", ["-czf", tarball, "-C", dir, "package"], { stdio: "ignore" });
  return tarball;
}

test("tarball-smoke passes on clean tarball", () => {
  const tmp = mkdtempSync(join(tmpdir(), "dialectos-tarball-ok-"));
  const tarball = createFakeTarball(tmp, {
    name: "@dialectos/fake",
    version: "0.1.0",
    main: "dist/index.js",
    bin: { fake: "dist/cli.js" },
    dependencies: { "some-dep": "^1.0.0" },
  });
  const result = run([tarball]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Tarball smoke passed/u);
});

test("tarball-smoke fails on workspace:* dependency", () => {
  const tmp = mkdtempSync(join(tmpdir(), "dialectos-tarball-bad-"));
  const tarball = createFakeTarball(tmp, {
    name: "@dialectos/fake",
    version: "0.1.0",
    main: "dist/index.js",
    dependencies: { "@dialectos/types": "workspace:*" },
  });
  const result = run([tarball]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unresolved workspace dependency/u);
});

test("tarball-smoke fails on missing bin shebang", () => {
  const tmp = mkdtempSync(join(tmpdir(), "dialectos-tarball-noshebang-"));
  const pkgDir = join(tmp, "package");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify({
    name: "@dialectos/fake",
    version: "0.1.0",
    bin: { fake: "dist/cli.js" },
  }, null, 2));
  mkdirSync(join(pkgDir, "dist"), { recursive: true });
  writeFileSync(join(pkgDir, "dist/cli.js"), "// no shebang\n");
  const tarball = join(tmp, "fake.tgz");
  spawnSync("tar", ["-czf", tarball, "-C", tmp, "package"], { stdio: "ignore" });
  const result = run([tarball]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing shebang/u);
});

test("tarball-smoke passes on real @dialectos/types pack", () => {
  ensurePackageBuilt("types");
  const packResult = spawnSync("pnpm", ["pack", "--pack-destination", tmpdir()], {
    cwd: "packages/types",
    encoding: "utf8",
  });
  assert.equal(packResult.status, 0, packResult.stderr);
  const tarball = packResult.stdout.trim().split("\n").pop();
  const result = run([tarball]);
  assert.equal(result.status, 0, result.stderr);
});

test("tarball-smoke passes on real @dialectos/cli pack", () => {
  ensurePackageBuilt("cli");
  const packResult = spawnSync("pnpm", ["pack", "--pack-destination", tmpdir()], {
    cwd: "packages/cli",
    encoding: "utf8",
  });
  assert.equal(packResult.status, 0, packResult.stderr);
  const tarball = packResult.stdout.trim().split("\n").pop();
  const result = run([tarball]);
  assert.equal(result.status, 0, result.stderr);
});
