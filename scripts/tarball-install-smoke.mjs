#!/usr/bin/env node
/**
 * Runtime install smoke for the GitHub-release tarballs.
 * Usage: node scripts/tarball-install-smoke.mjs <cli-tarball> <mcp-tarball>
 *
 * Reproduces the 2026-10-27 defect bar against each tarball from a
 * pristine npm prefix + cache (no registry access — "--offline" proves the
 * closure is fully bundled):
 *
 * CLI (four receipts):
 *   1. npm install -g <tarball> --offline  → exit 0
 *   2. dialectos --version                 → prints the package version
 *   3. dialectos validate … --dialect xx-XX → exit != 0 AND actionable
 *      error naming the dialect + pointing at `dialectos dialects list`
 *   4. dialectos validate … --dialect es-MX → exit 0
 *
 * MCP:
 *   1. npm install -g <tarball> --offline  → exit 0
 *   2. JSON-RPC initialize over stdin      → valid serverInfo response
 *
 * The README documents pnpm as the primary install path ("a single
 * `pnpm add -g` / `pnpm dlx` command works"), so the same tarballs are also
 * smoked through pnpm at the repo-pinned version (packageManager field —
 * never an unpinned "latest", 11.12.0 is a known-broken release for these
 * paths). The pnpm legs stay hermetic: local tarball paths only (no GitHub
 * release URLs), and pnpm's global bin / store / cache / state dirs are
 * pinned into a pristine sandbox per leg.
 *
 * pnpm CLI leg (four receipts, mirroring npm):
 *   1. pnpm add -g <tarball>               → exit 0 (sandbox global bin dir
 *      on PATH — otherwise ERR_PNPM_GLOBAL_BIN_DIR_NOT_IN_PATH)
 *   2. dialectos --version                 → prints the package version
 *   3. dialectos validate … --dialect xx-XX → exit != 0 AND actionable
 *   4. dialectos validate … --dialect es-MX → exit 0
 *
 * pnpm MCP leg:
 *   1. pnpm dlx <tarball>                  → installs and runs the bin
 *   2. JSON-RPC initialize over stdin      → serverInfo @dialectos/mcp at
 *      the package version
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [cliTarballArg, mcpTarballArg] = process.argv.slice(2);
if (!cliTarballArg || !mcpTarballArg) {
  console.error(
    "Usage: node scripts/tarball-install-smoke.mjs <cli-tarball> <mcp-tarball>",
  );
  process.exit(1);
}
const cliTarball = resolve(cliTarballArg);
const mcpTarball = resolve(mcpTarballArg);

function installGlobal(tarball) {
  const sandbox = mkdtempSync(join(tmpdir(), "dialectos-install-smoke-"));
  const prefix = join(sandbox, "prefix");
  const cache = join(sandbox, "cache");
  try {
    execFileSync(
      "npm",
      [
        "install",
        "--global",
        "--offline",
        "--no-audit",
        "--no-fund",
        `--prefix=${prefix}`,
        `--cache=${cache}`,
        "--loglevel=error",
        tarball,
      ],
      { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    return { prefix, sandbox };
  } catch (err) {
    rmSync(sandbox, { recursive: true, force: true });
    throw new Error(`offline global install failed for ${tarball}: ${err.stdout} ${err.stderr}`);
  }
}

function run(binPath, args) {
  try {
    const stdout = execFileSync(binPath, args, {
      encoding: "utf8",
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

/** Version recorded in the tarball's own manifest (package/package.json). */
function readTarballVersion(tarball) {
  const manifest = execFileSync(
    "tar",
    ["-xzOf", tarball, "package/package.json"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(manifest).version;
}

/**
 * The pnpm version the gate runs is the repo's own pin (root packageManager
 * field). An unpinned "latest" resolution is not acceptable: pnpm 11.12.0 is
 * a deprecated, known-broken release for both `pnpm add -g` and `pnpm dlx`.
 */
function pinnedPnpmVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager || "");
  if (!match) {
    throw new Error(
      `root package.json must pin packageManager to an exact pnpm semver (got '${pkg.packageManager}')`,
    );
  }
  return match[1];
}

/**
 * Resolve a pnpm binary at exactly the pinned version. Prefers a PATH pnpm
 * that already reports the pin (CI installs it via pnpm/action-setup);
 * otherwise bootstraps `pnpm@<pin>` with npm into the stage dir. Fails
 * closed if the resolved binary does not report the exact pin.
 */
function resolvePnpm(stage, pin) {
  const probe = spawnSync("pnpm", ["--version"], {
    encoding: "utf8",
    cwd: ROOT,
  });
  if (probe.status === 0) {
    const probed = (probe.stdout || "")
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .pop();
    if (probed === pin) {
      return { bin: "pnpm", source: "PATH" };
    }
    console.log(`  PATH pnpm is ${probed ?? "unreadable"}; pinning pnpm@${pin} via npm bootstrap`);
  }

  const toolDir = join(stage, "pnpm-tool");
  const npmCache = join(stage, "npm-cache");
  mkdirSync(npmCache, { recursive: true });
  execFileSync(
    "npm",
    [
      "install",
      "--global",
      "--no-audit",
      "--no-fund",
      `--prefix=${toolDir}`,
      `--cache=${npmCache}`,
      "--loglevel=error",
      `pnpm@${pin}`,
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
  const bin = join(toolDir, "bin", "pnpm");
  const booted = spawnSync(bin, ["--version"], { encoding: "utf8" });
  const bootedVersion = (booted.stdout || "").trim();
  if (booted.status !== 0 || bootedVersion !== pin) {
    throw new Error(
      `bootstrapped pnpm reports ${bootedVersion} (rc=${booted.status}), expected the pinned ${pin} — refusing an unpinned pnpm leg`,
    );
  }
  return { bin, source: `npm bootstrap pnpm@${pin}` };
}

/**
 * Pristine per-leg pnpm sandbox. The global bin dir (PNPM_HOME/bin in pnpm
 * 11) MUST be on PATH before `pnpm add -g` or pnpm exits
 * ERR_PNPM_GLOBAL_BIN_DIR_NOT_IN_PATH; the store/cache/state/data dirs are
 * pinned into the sandbox so the leg never touches host pnpm state (which
 * may be read-only or shared on constrained CI hosts).
 */
function pnpmSandbox(stage) {
  const sandbox = mkdtempSync(join(stage, "pnpm-leg-"));
  const dirs = {
    root: sandbox,
    pnpmHome: join(sandbox, "pnpm-home"),
    store: join(sandbox, "store"),
    cache: join(sandbox, "cache"),
    global: join(sandbox, "global"),
  };
  mkdirSync(join(dirs.pnpmHome, "bin"), { recursive: true });
  for (const dir of ["store", "cache", "global", "xdg-data", "xdg-cache", "xdg-state", "npm-cache"]) {
    mkdirSync(join(sandbox, dir), { recursive: true });
  }
  const env = { ...process.env };
  env.PNPM_HOME = dirs.pnpmHome;
  env.PATH = `${join(dirs.pnpmHome, "bin")}${delimiter}${dirs.pnpmHome}${delimiter}${env.PATH ?? ""}`;
  env.XDG_DATA_HOME = join(sandbox, "xdg-data");
  env.XDG_CACHE_HOME = join(sandbox, "xdg-cache");
  env.XDG_STATE_HOME = join(sandbox, "xdg-state");
  // The host env may point npm_config_cache at a read-only npm cache.
  env.npm_config_cache = join(sandbox, "npm-cache");
  return { dirs, env };
}

function assertCliReceipts(label, dialectosBin) {
  // Receipt 2: --version prints the package version.
  const version = run(dialectosBin, ["--version"]);
  const printed = (version.stdout || "").trim();
  if (version.code !== 0 || !printed) {
    throw new Error(`dialectos --version failed: rc=${version.code} out='${printed}'`);
  }
  console.log(`  ${label}receipt 2 OK: dialectos --version -> ${printed}`);

  // Receipt 3: unknown dialect fails closed with an actionable error.
  const bad = run(dialectosBin, ["validate", "Haz clic", "--dialect", "xx-XX"]);
  const badOut = `${bad.stdout}${bad.stderr}`;
  if (bad.code === 0) {
    throw new Error(`unknown dialect xx-XX did NOT fail closed (rc=0): ${badOut}`);
  }
  if (!badOut.includes("xx-XX") || !badOut.includes("dialectos dialects list")) {
    throw new Error(
      `unknown-dialect error is not actionable (must name the dialect and point at 'dialectos dialects list'): ${badOut}`,
    );
  }
  console.log(`  ${label}receipt 3 OK: xx-XX fails closed (rc=${bad.code}) with actionable error`);

  // Receipt 4: known dialect passes. The positional is the TRANSLATED text;
  // a real English source scores semantic similarity and passes, while an
  // omitted/identical source scores 0% and blocks (as designed).
  const good = run(dialectosBin, [
    "validate",
    "Haz clic aquí",
    "--source",
    "Click here",
    "--dialect",
    "es-MX",
  ]);
  if (good.code !== 0 || !`${good.stdout}${good.stderr}`.includes("PASS")) {
    throw new Error(
      `known dialect es-MX failed (rc=${good.code}): ${good.stdout}${good.stderr}`,
    );
  }
  console.log(`  ${label}receipt 4 OK: es-MX validate passes`);

  return printed;
}

function smokeCli(tarball) {
  const { prefix, sandbox } = installGlobal(tarball);
  try {
    // Receipt 1 is installGlobal's exit-0 (throw above on failure).
    assertCliReceipts("", join(prefix, "bin", "dialectos"));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function smokeMcp(tarball, expectedVersion) {
  const { prefix, sandbox } = installGlobal(tarball);
  try {
    const child = spawn(join(prefix, "bin", "dialectos-mcp"), [], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "install-smoke", version: "0.0.0" },
        },
      })}\n`,
    );
    // The server's stdin guard flushes on EOF — closing stdin is the normal
    // one-shot MCP lifecycle and guarantees the response is written.
    child.stdin.end();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && !out.includes("\n")) {
      await new Promise((r) => setTimeout(r, 100));
    }
    child.kill("SIGKILL");
    assertInitializeResponse(out, err, expectedVersion);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

function assertInitializeResponse(out, err, expectedVersion, label = "") {
  const line = out.split("\n").find((l) => l.trim().startsWith("{"));
  if (!line) {
    throw new Error(`MCP server never answered initialize (stderr: ${err})`);
  }
  const resp = JSON.parse(line);
  const info = resp.result?.serverInfo;
  if (
    resp.error ||
    info?.name !== "@dialectos/mcp" ||
    (expectedVersion && info?.version !== expectedVersion)
  ) {
    throw new Error(
      `MCP initialize failed (want serverInfo @dialectos/mcp@${expectedVersion ?? "any"}): ${line}`,
    );
  }
  console.log(
    `  ${label}MCP initialize OK: ${info.name}@${info.version}`,
  );
}

function smokeCliPnpm(stage, pnpm, tarball) {
  const expectedVersion = readTarballVersion(tarball);
  const { dirs, env } = pnpmSandbox(stage);
  try {
    // Receipt 1: `pnpm add -g <tarball>` exits 0 from a pristine sandbox
    // (global bin dir on PATH, store/cache/state/global dirs pinned in).
    execFileSync(
      pnpm.bin,
      [
        "add",
        "--global",
        `--global-dir=${dirs.global}`,
        `--store-dir=${dirs.store}`,
        `--cache-dir=${dirs.cache}`,
        tarball,
      ],
      { cwd: dirs.root, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    console.log("  pnpm CLI receipt 1 OK: pnpm add --global exit 0");

    // Receipts 2–4 run the linked global bin (pnpm 11 links into PNPM_HOME/bin).
    const printed = assertCliReceipts("pnpm CLI ", join(dirs.pnpmHome, "bin", "dialectos"));
    if (printed !== expectedVersion) {
      throw new Error(
        `dialectos --version printed '${printed}' but the tarball manifest says '${expectedVersion}'`,
      );
    }
  } catch (err) {
    throw new Error(
      `pnpm add -g leg failed for ${tarball} (pnpm ${pnpm.version}): ${err.stdout ?? ""}${err.stderr ?? ""}${err.message}`,
    );
  } finally {
    rmSync(dirs.root, { recursive: true, force: true });
  }
}

async function smokeMcpPnpm(stage, pnpm, tarball) {
  const expectedVersion = readTarballVersion(tarball);
  const { dirs, env } = pnpmSandbox(stage);
  try {
    // `pnpm dlx <tarball>` runs the package's single bin. dlx rejects bare
    // --store-dir/--cache-dir flags, so they go through the --config form.
    const child = spawn(
      pnpm.bin,
      [
        "dlx",
        `--config.store-dir=${dirs.store}`,
        `--config.cache-dir=${dirs.cache}`,
        tarball,
      ],
      { cwd: dirs.root, env, stdio: ["pipe", "pipe", "pipe"], detached: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "install-smoke", version: "0.0.0" },
        },
      })}\n`,
    );
    child.stdin.end();
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline && !out.includes("\n")) {
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
    assertInitializeResponse(out, err, expectedVersion, "pnpm ");
  } finally {
    rmSync(dirs.root, { recursive: true, force: true });
  }
}

console.log(`smoking CLI tarball: ${cliTarball}`);
await smokeCli(cliTarball);
console.log(`smoking MCP tarball: ${mcpTarball}`);
await smokeMcp(mcpTarball, readTarballVersion(mcpTarball));

// pnpm legs — the README-documented install path, at the repo-pinned version.
const pin = pinnedPnpmVersion();
const pnpmStage = mkdtempSync(join(tmpdir(), "dialectos-pnpm-smoke-"));
try {
  const pnpm = { ...resolvePnpm(pnpmStage, pin), version: pin };
  console.log(`pnpm ${pin} via ${pnpm.source}`);
  console.log(`smoking CLI tarball via pnpm add -g: ${cliTarball}`);
  smokeCliPnpm(pnpmStage, pnpm, cliTarball);
  console.log(`smoking MCP tarball via pnpm dlx: ${mcpTarball}`);
  await smokeMcpPnpm(pnpmStage, pnpm, mcpTarball);
} finally {
  rmSync(pnpmStage, { recursive: true, force: true });
}
console.log(`tarball install smoke passed for cli + mcp (npm legs + pnpm ${pin} legs)`);
