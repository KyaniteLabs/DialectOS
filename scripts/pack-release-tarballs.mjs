#!/usr/bin/env node
/**
 * Pack the two GitHub-release tarballs (@dialectos/cli and @dialectos/mcp)
 * with the five unpublished @dialectos/* workspace packages AND the full
 * transitive closure of their public npm dependencies bundled inside, so
 * `npm install -g <cli.tgz>` works with zero registry access.
 *
 * Why the full closure: npm does not install dependencies it considers part
 * of a bundleDependencies subtree ("deps of bundled deps"). The previous
 * strategy — hoisting public deps (isomorphic-dompurify, zod, marked, …)
 * onto the parent manifest and relying on npm to fetch them — silently
 * skipped every dep co-declared by a bundled @dialectos/* package, leaving
 * empty node_modules dirs and an install that exits 0 but crashes at
 * runtime with ERR_MODULE_NOT_FOUND (defect on v0.3.1, 2026-10-27).
 * Bundling the resolved closure makes the tarball standalone and immune to
 * that behavior.
 *
 * Usage: node scripts/pack-release-tarballs.mjs [outdir]
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";
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

  // Vendor the full transitive closure of every public dependency so the
  // tarball installs with no registry access at all.
  const { names: vendored, nested } = vendorClosure(pkg, deps, stageRoot);
  for (const name of vendored) {
    if (!bundled.includes(name)) bundled.push(name);
  }
  bundled.sort();

  pj.dependencies = deps;
  pj.bundleDependencies = bundled;
  writeFileSync(join(dest, "package.json"), `${JSON.stringify(pj, null, 2)}\n`);
  return { dest, bundleNames: bundled, nested };
}

/**
 * Resolve `deps` (name -> range) into a real installed tree, then move that
 * tree into <stageRoot>/<pkg>/node_modules/. Returns the list of top-level
 * package names that were vendored. The @dialectos/* workspace packages are
 * staged by the caller and are excluded here — they are not on the registry.
 */
function vendorClosure(pkg, deps, stageRoot) {
  const publicDeps = Object.fromEntries(
    Object.entries(deps).filter(([name]) => !name.startsWith("@dialectos/")),
  );
  const vendorRoot = join(stageRoot, `${pkg}-vendor`);
  const cacheDir = join(stageRoot, "npm-cache");
  rmSync(vendorRoot, { recursive: true, force: true });
  mkdirSync(vendorRoot, { recursive: true });
  writeFileSync(
    join(vendorRoot, "package.json"),
    `${JSON.stringify({ name: "dialectos-vendor", private: true, dependencies: publicDeps }, null, 2)}\n`,
  );

  console.log(`vendoring closure for ${pkg}: ${Object.keys(publicDeps).length} direct deps`);
  execFileSync(
    "npm",
    [
      "install",
      "--omit=dev",
      "--omit=optional",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `--cache=${cacheDir}`,
      "--loglevel=error",
    ],
    { cwd: vendorRoot, stdio: "inherit", env: process.env },
  );

  const vendorNm = join(vendorRoot, "node_modules");
  const destNm = join(stageRoot, pkg, "node_modules");
  const names = [];
  const nested = [];
  for (const entry of readdirSync(vendorNm)) {
    if (entry.startsWith(".")) continue; // .bin, .package-lock.json
    if (entry.startsWith("@")) {
      mkdirSync(join(destNm, entry), { recursive: true });
      for (const sub of readdirSync(join(vendorNm, entry))) {
        names.push(`${entry}/${sub}`);
        renameSync(join(vendorNm, entry, sub), join(destNm, entry, sub));
      }
    } else {
      names.push(entry);
      renameSync(join(vendorNm, entry), join(destNm, entry));
    }
  }

  collectNested(destNm, destNm, nested);
  rmSync(vendorRoot, { recursive: true, force: true });
  return { names, nested };
}

/**
 * npm may nest conflicting versions inside a vendored package's own
 * node_modules. That is the standard bundled-dependency layout and packs
 * fine — but we record every nested package so the packed tarball can be
 * verified to actually contain it (npm pack dropping a nested dir would
 * otherwise go unnoticed until runtime).
 */
function collectNested(root, dir, found) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = join(dir, entry.name);
    if (entry.name === "node_modules") {
      for (const nmEntry of readdirSync(child)) {
        if (nmEntry.startsWith(".")) continue;
        if (nmEntry.startsWith("@")) {
          for (const sub of readdirSync(join(child, nmEntry))) {
            const rel = `${relative(root, child)}/${nmEntry}/${sub}`;
            if (!found.includes(rel)) found.push(rel);
            collectNested(root, join(child, nmEntry, sub), found);
          }
        } else {
          const rel = `${relative(root, child)}/${nmEntry}`;
          if (!found.includes(rel)) found.push(rel);
          collectNested(root, join(child, nmEntry), found);
        }
      }
      continue;
    }
    collectNested(root, child, found);
  }
}

/**
 * Assert the packed tarball really carries every bundled package (top-level
 * and nested). Returns the number of verified entries.
 */
function verifyPacked(tarball, bundleNames, nestedPaths) {
  const listing = execFileSync("tar", ["-tzf", tarball], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const have = new Set(listing);
  const missing = [];
  for (const name of bundleNames) {
    if (!have.has(`package/node_modules/${name}/package.json`)) {
      missing.push(`package/node_modules/${name}/package.json`);
    }
  }
  for (const rel of nestedPaths) {
    if (!have.has(`package/node_modules/${rel}/package.json`)) {
      missing.push(`package/node_modules/${rel}/package.json`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `npm pack dropped bundled packages from ${tarball.split("/").pop()}:\n  ${missing.join("\n  ")}`,
    );
  }
  return bundleNames.length + nestedPaths.length;
}

function packStaged(stageDir, outdir, cacheDir) {
  const output = execFileSync(
    "npm",
    ["pack", "--pack-destination", outdir, `--cache=${cacheDir}`, "--loglevel=error"],
    {
      cwd: stageDir,
      encoding: "utf8",
      env: process.env,
    },
  );
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
      const { dest, bundleNames, nested } = stage(pkg, stageRoot);
      const tarball = packStaged(dest, outdir, join(stageRoot, "npm-cache"));
      verifyPacked(tarball, bundleNames, nested);
      packed.push(tarball);
      console.log(
        `packed ${pkg}: ${tarball} (${bundleNames.length} bundled + ${nested.length} nested verified)`,
      );
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
