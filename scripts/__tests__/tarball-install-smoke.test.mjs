import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SMOKE = readFileSync(join(ROOT, "scripts", "tarball-install-smoke.mjs"), "utf8");

test("root package.json pins the exact pnpm version the smoke gate resolves", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  // 11.12.0 is a deprecated, known-broken release for `pnpm add -g` and
  // `pnpm dlx`; the gate must never resolve to an unpinned "latest".
  assert.equal(pkg.packageManager, "pnpm@11.1.1");
});

test("smoke gate pins pnpm to the repo packageManager field, never 'latest'", () => {
  assert.match(SMOKE, /packageManager/u, "gate must derive the pin from packageManager");
  assert.ok(
    SMOKE.includes("^pnpm@(\\d+\\.\\d+\\.\\d+)$"),
    "pin must be an exact semver, not a range",
  );
  assert.match(SMOKE, /pnpm@\$\{pin\}/u, "bootstrap must install exactly the pinned pnpm");
  assert.match(
    SMOKE,
    /refusing an unpinned pnpm leg/u,
    "gate must fail closed when the resolved pnpm is not the pin",
  );
});

test("pnpm CLI leg pins global/store/cache dirs and the global bin dir into a sandbox", () => {
  for (const flag of ["--global-dir=", "--store-dir=", "--cache-dir="]) {
    assert.ok(SMOKE.includes(flag), `add leg must pass ${flag}`);
  }
  // pnpm 11 exits ERR_PNPM_GLOBAL_BIN_DIR_NOT_IN_PATH unless the sandbox
  // global bin dir (PNPM_HOME/bin) is on PATH before invocation.
  assert.match(SMOKE, /env\.PNPM_HOME =/u, "sandbox must set PNPM_HOME");
  assert.match(
    SMOKE,
    /env\.PATH = `\$\{join\(dirs\.pnpmHome, "bin"\)\}/u,
    "sandbox global bin dir must be prepended to PATH",
  );
});

test("pnpm legs stay hermetic: XDG state/data/cache and npm cache pinned into the sandbox", () => {
  for (const v of ["XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "npm_config_cache"]) {
    assert.match(SMOKE, new RegExp(`env\\.${v} =`, "u"), `sandbox must pin ${v}`);
  }
});

test("pnpm dlx leg uses the --config form pnpm dlx accepts", () => {
  // `pnpm dlx` rejects bare --store-dir/--cache-dir ("Unknown options").
  assert.ok(SMOKE.includes("--config.store-dir="), "dlx leg must use --config.store-dir=");
  assert.ok(SMOKE.includes("--config.cache-dir="), "dlx leg must use --config.cache-dir=");
});

test("pnpm legs assert the tarball's own version, not just any output", () => {
  assert.match(SMOKE, /readTarballVersion/u, "legs must read the tarball manifest version");
  assert.match(
    SMOKE,
    /info\?\.name !== "@dialectos\/mcp"/u,
    "MCP legs must assert serverInfo.name is @dialectos/mcp",
  );
  assert.match(
    SMOKE,
    /printed !== expectedVersion/u,
    "CLI leg must assert --version equals the tarball manifest version",
  );
});

test("npm offline legs stay intact alongside the pnpm legs", () => {
  assert.match(SMOKE, /"--offline"/u, "npm legs must keep the pristine offline install");
  assert.match(SMOKE, /installGlobal\(tarball\)/u, "npm legs must keep installGlobal");
});
