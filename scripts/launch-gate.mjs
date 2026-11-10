#!/usr/bin/env node
/**
 * Launch readiness gate for DialectOS.
 *
 * Runs the full Definition of Done verification from a clean checkout.
 * Fails fast on the first blocking failure.
 *
 * Usage:
 *   node scripts/launch-gate.mjs [--no-docker]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const noDocker = args.has("--no-docker");

const failures = [];

function run(label, command, opts = {}) {
  console.log(`\n▶ ${label}`);
  const [cmd, ...commandArgs] = command;
  const result = spawnSync(cmd, commandArgs, {
    stdio: "inherit",
    encoding: "utf-8",
    shell: false,
    ...opts,
  });
  if (result.status !== 0) {
    failures.push(label);
    console.error(`✖ FAILED: ${label}`);
    if (opts.fatal !== false) {
      console.error(`\nLaunch gate blocked by: ${label}`);
      process.exit(1);
    }
  } else {
    console.log(`✔ ${label}`);
  }
}

function checkEnv(label, varName) {
  console.log(`\n▶ ${label}`);
  if (!process.env[varName]) {
    failures.push(label);
    console.error(`✖ MISSING: ${varName} is not set`);
    return false;
  }
  console.log(`✔ ${label}`);
  return true;
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("  DialectOS Launch Readiness Gate");
console.log("═══════════════════════════════════════════════════════════════");

// 1. Clean build artifacts
run("Clean dist directories", ["sh", "-c", "rm -rf packages/*/dist"]);

// 2. Install
run("Install dependencies", ["pnpm", "install", "--frozen-lockfile"]);

// 3. Build
run("Build all packages", ["pnpm", "build"]);

// 4. Typecheck
run("Type-check all packages", ["pnpm", "-r", "exec", "tsc", "--noEmit"]);

// 5. Unit + contract tests
run("Run test suite", ["pnpm", "test"]);

// 6. Coverage
run("Run coverage suite", ["pnpm", "test:coverage"]);

// 7. Audit (non-fatal until advisories are remediated)
run("Run dependency audit", ["pnpm", "audit", "--audit-level=moderate"], { fatal: false });

// 8. Benchmarks
run("Run translation benchmark", ["node", "scripts/benchmark.mjs", "--out=/tmp/dialectos-benchmark"]);
run("Run detection benchmark", ["node", "scripts/benchmark-detection.mjs", "--out=/tmp/dialectos-detection", "--min-top1=0.5", "--min-top3=0.6", "--min-hard-top1=0.0"], { fatal: false });

// 9. Strict certification (mock mode for gate; live requires provider credentials)
run("Run strict certification", [
  "node", "scripts/dialect-certify.mjs",
  "--fail-on-warnings=true", "--judge=true", "--out=/tmp/dialectos-cert",
]);
run("Run strict adversarial certification", [
  "node", "scripts/dialect-certify-adversarial.mjs",
  "--fail-on-warnings=true", "--judge=true", "--out=/tmp/dialectos-adv",
]);
run("Run strict document certification", [
  "node", "scripts/dialect-certify-documents.mjs",
  "--allow-mock=true", "--policy=strict", "--out=/tmp/dialectos-doc-cert",
]);

// 10. Package smoke
run("Pack CLI package", ["sh", "-c", "cd packages/cli && pnpm pack --pack-destination /tmp"]);
run("Verify packages install from tarballs", ["node", "scripts/tarball-smoke.mjs", "/tmp/dialectos-cli-0.3.1.tgz"]);

// 11. Docker checks
if (!noDocker) {
  if (existsSync("docker-compose.yml")) {
    run("Validate Docker Compose config", ["docker", "compose", "config"]);
  }
  if (existsSync("server/deploy/hostinger-vps/docker-compose.yml")) {
    // Ensure env.hostinger exists for compose validation
    if (!existsSync("server/deploy/hostinger-vps/env.hostinger")) {
      const { copyFileSync } = await import("node:fs");
      copyFileSync("server/deploy/hostinger-vps/env.example", "server/deploy/hostinger-vps/env.hostinger");
    }
    run("Validate Hostinger Compose config", [
      "docker", "compose",
      "-f", "server/deploy/hostinger-vps/docker-compose.yml",
      "--env-file", "server/deploy/hostinger-vps/env.example",
      "config",
    ]);
  }
} else {
  console.log("\n▶ Docker checks skipped (--no-docker)");
}

// 12. Docs public-claim tests
run("Run docs contract tests", ["node", "--test", "docs/__tests__/public-claims.test.mjs"]);
run("Run discovery file tests", ["node", "--test", "docs/__tests__/discovery-files.test.mjs"]);
run("Run demo contract tests", ["node", "--test", "docs/__tests__/demo-contract.test.mjs"]);
run("Run private-residue tests", ["node", "--test", "docs/__tests__/private-residue.test.mjs"]);

// Summary
console.log("\n═══════════════════════════════════════════════════════════════");
if (failures.length === 0) {
  console.log("  ✔ ALL GATES PASSED — Launch candidate is ready.");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
} else {
  console.log(`  ✖ ${failures.length} NON-FATAL GATE(S) FAILED`);
  console.log("  Blockers:");
  for (const f of failures) {
    console.log(`    - ${f}`);
  }
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(1);
}
