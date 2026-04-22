import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOTS = ["packages", "scripts"];
const SKIP = new Set(["dist", "node_modules", ".git"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      walk(absolute, files);
    } else if ([...SOURCE_EXTENSIONS].some((extension) => absolute.endsWith(extension))) {
      files.push(absolute);
    }
  }
  return files;
}

test("source does not contain empty catch blocks that swallow failures", () => {
  const offenders = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const source = readFileSync(file, "utf8");
      if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/m.test(source)) {
        offenders.push(file);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

