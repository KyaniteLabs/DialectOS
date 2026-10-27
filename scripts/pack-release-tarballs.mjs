#!/usr/bin/env node
/**
 * Pack the two GitHub-release tarballs (@dialectos/cli and @dialectos/mcp)
 * with the five unpublished @dialectos/* workspace packages bundled inside
 * so `pnpm add -g <cli.tgz>` / `pnpm dlx <mcp.tgz>` work without the npm
 * registry. Public npm deps of those siblings are hoisted onto the parent
 * manifest (pnpm does not fetch deps-of-bundled-deps).
 *
 * Usage: node scripts/pack-release-tarballs.mjs [outdir]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { ensurePackageBuilt } from "./lib/ensure-built.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIBS = ["types", "security", "locale-utils", "markdown-parser", "providers"];
const TARGETS = ["cli", "mcp"];

function readPkg(pkg) {
  return JSON.parse(readFileSync(join(ROOT, "packages", pkg, "package.json"), "utf8"));
}

function stage(pkg, stageRoot) {
  ensurePackageBuilt(pkg);
  const src = join(ROOT, "packages", pkg);
  const dest = join(stageRoot, pkg);
  mkdirSync(dest, { recursive: true });
  cpSync(join(src, "package.json"), join(dest, "package.json"));
  if (existsSync(join(src, "README.md"))) {
    cpSync(join(src, "README.md"), join(dest, "README.md"));
  }
  cpSync(join(src, "dist"), join(dest, "dist"), { recursive: true });

  const pj = JSON.parse(readFileSync(join(dest, "package.json"), "utf8"));
  const deps = { ...(pj.dependencies || {}) };
  const bundled = [];

  for (const lib of LIBS) {
    ensurePackageBuilt(lib);
    const libSrc = join(ROOT, "packages", lib);
    const libPj = readPkg(lib);
    bundled.push(libPj.name);
    const libDest = join(dest, "node_modules", "@dialectos", lib);
    mkdirSync(libDest, { recursive: true });
    cpSync(join(libSrc, "package.json"), join(libDest, "package.json"));
    if (existsSync(join(libSrc, "README.md"))) {
      cpSync(join(libSrc, "README.md"), join(libDest, "README.md"));
    }
    cpSync(join(libSrc, "dist"), join(libDest, "dist"), { recursive: true });
    for (const [dep, ver] of Object.entries(libPj.dependencies || {})) {
      if (dep.startsWith("@dialectos/")) continue;
      if (!(dep in deps)) deps[dep] = ver;
    }
  }

  pj.dependencies = deps;
  pj.bundleDependencies = bundled;
  writeFileSync(join(dest, "package.json"), `${JSON.stringify(pj, null, 2)}\n`);
  return dest;
}

function packStaged(stageDir, outdir) {
  const output = execFileSync("npm", ["pack", "--pack-destination", outdir], {
    cwd: stageDir,
    encoding: "utf8",
    env: process.env,
  });
  const name = output.trim().split("\n").pop();
  return join(outdir, name);
}

function sha256(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function main() {
  const outdir = resolve(process.argv[2] || join(ROOT, "dist-release"));
  mkdirSync(outdir, { recursive: true });
  const stageRoot = join(tmpdir(), `dialectos-pack-${process.pid}`);
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  const packed = [];
  try {
    for (const pkg of TARGETS) {
      const staged = stage(pkg, stageRoot);
      const tarball = packStaged(staged, outdir);
      packed.push(tarball);
      console.log(`packed ${pkg}: ${tarball}`);
    }
  } finally {
    rmSync(stageRoot, { recursive: true, force: true });
  }

  const sums = packed
    .map((p) => `${sha256(p)}  ${p.split("/").pop()}`)
    .join("\n") + "\n";
  writeFileSync(join(outdir, "SHA256SUMS.txt"), sums);
  console.log(`wrote ${join(outdir, "SHA256SUMS.txt")}`);
}

main();
