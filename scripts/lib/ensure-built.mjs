/**
 * Helper to ensure compiled dist/ artifacts exist before scripts try to import them.
 * Runs `pnpm build` automatically if the requested package dist is missing.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

/**
 * Ensure the dist/ directory for a given workspace package exists.
 * If missing, runs `pnpm build` for that package.
 */
export function ensurePackageBuilt(packageName) {
  const distPath = join(PROJECT_ROOT, "packages", packageName, "dist");
  if (existsSync(distPath)) return;

  console.error(`[ensure-built] packages/${packageName}/dist/ missing — running pnpm build...`);
  execFileSync("pnpm", ["build"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

/**
 * Ensure all workspace packages are built.
 */
export function ensureAllBuilt() {
  const distPath = join(PROJECT_ROOT, "packages", "cli", "dist");
  if (existsSync(distPath)) return;

  console.error("[ensure-built] dist/ missing — running pnpm build...");
  execFileSync("pnpm", ["build"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: process.env,
  });
}
