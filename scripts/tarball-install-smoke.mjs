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
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [cliTarball, mcpTarball] = process.argv.slice(2);
if (!cliTarball || !mcpTarball) {
  console.error(
    "Usage: node scripts/tarball-install-smoke.mjs <cli-tarball> <mcp-tarball>",
  );
  process.exit(1);
}

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

function run(prefix, bin, args) {
  try {
    const stdout = execFileSync(join(prefix, "bin", bin), args, {
      encoding: "utf8",
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function smokeCli(tarball) {
  const { prefix, sandbox } = installGlobal(tarball);
  try {
    // Receipt 2: --version prints.
    const version = run(prefix, "dialectos", ["--version"]);
    const printed = (version.stdout || "").trim();
    if (version.code !== 0 || !printed) {
      throw new Error(`dialectos --version failed: rc=${version.code} out='${printed}'`);
    }
    console.log(`  receipt 2 OK: dialectos --version -> ${printed}`);

    // Receipt 3: unknown dialect fails closed with an actionable error.
    const bad = run(prefix, "dialectos", ["validate", "Haz clic", "--dialect", "xx-XX"]);
    const badOut = `${bad.stdout}${bad.stderr}`;
    if (bad.code === 0) {
      throw new Error(`unknown dialect xx-XX did NOT fail closed (rc=0): ${badOut}`);
    }
    if (!badOut.includes("xx-XX") || !badOut.includes("dialectos dialects list")) {
      throw new Error(
        `unknown-dialect error is not actionable (must name the dialect and point at 'dialectos dialects list'): ${badOut}`,
      );
    }
    console.log(`  receipt 3 OK: xx-XX fails closed (rc=${bad.code}) with actionable error`);

    // Receipt 4: known dialect passes. The positional is the TRANSLATED text;
    // a real English source scores semantic similarity and passes, while an
    // omitted/identical source scores 0% and blocks (as designed).
    const good = run(prefix, "dialectos", [
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
    console.log("  receipt 4 OK: es-MX validate passes");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

async function smokeMcp(tarball) {
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
    const line = out.split("\n").find((l) => l.trim().startsWith("{"));
    if (!line) {
      throw new Error(`MCP server never answered initialize (stderr: ${err})`);
    }
    const resp = JSON.parse(line);
    if (resp.error || !resp.result?.serverInfo?.name) {
      throw new Error(`MCP initialize failed: ${line}`);
    }
    console.log(`  MCP initialize OK: ${resp.result.serverInfo.name}@${resp.result.serverInfo.version}`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

console.log(`smoking CLI tarball: ${cliTarball}`);
await smokeCli(cliTarball);
console.log(`smoking MCP tarball: ${mcpTarball}`);
await smokeMcp(mcpTarball);
console.log("tarball install smoke passed for cli + mcp");
