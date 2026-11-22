/**
 * Real filesystem contract for manage_dialect_variants.
 * The unit suite mocks writeLocaleFile, so it cannot prove source bytes.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerI18nTools } from "../tools/i18n.js";

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureHandler(): (params: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> {
  const handlers = new Map<string, (params: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }>>();
  const server = {
    registerTool: (
      name: string,
      _config: unknown,
      handler: (params: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }>,
    ) => {
      handlers.set(name, handler);
    },
  };
  registerI18nTools(server as never, {
    registry: { get() { throw new Error("provider unused"); } } as never,
  });
  const handler = handlers.get("manage_dialect_variants");
  if (!handler) throw new Error("manage_dialect_variants was not registered");
  return handler;
}

describe("manage_dialect_variants source bytes", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overwrite=false leaves source bytes unchanged when outputPath resolves to the source", async () => {
    const dir = mkdtempSync(join("/tmp", "dialectos-overwrite-"));
    dirs.push(dir);
    const source = join(dir, "es.json");
    const alias = join(dir, "alias.json");
    const original = Buffer.from('{"computer":"el ordenador"}\n');
    writeFileSync(source, original);
    symlinkSync(source, alias);
    const before = sha256(readFileSync(source));
    const handler = captureHandler();

    const sameString = await handler({
      sourcePath: source,
      outputPath: source,
      variant: "es-MX",
      overwrite: false,
    });
    const aliasPath = await handler({
      sourcePath: source,
      outputPath: alias,
      variant: "es-MX",
      overwrite: false,
    });

    expect(sameString.isError).toBe(true);
    expect(aliasPath.isError).toBe(true);
    expect(JSON.parse(sameString.content[0].text).error).toBe("VALIDATION_FAILED");
    expect(readFileSync(source).equals(original)).toBe(true);
    expect(sha256(readFileSync(source))).toBe(before);
  });

  it("a distinct outputPath still writes the variant and leaves the source unchanged", async () => {
    const dir = mkdtempSync(join("/tmp", "dialectos-overwrite-"));
    dirs.push(dir);
    const source = join(dir, "es.json");
    const output = join(dir, "out.json");
    const original = Buffer.from('{"computer":"el ordenador"}\n');
    writeFileSync(source, original);
    const handler = captureHandler();

    const result = await handler({
      sourcePath: source,
      outputPath: output,
      variant: "es-MX",
      overwrite: false,
    });

    expect(result.isError).not.toBe(true);
    expect(readFileSync(source).equals(original)).toBe(true);
    expect(readFileSync(output, "utf8")).toContain("la computadora");
  });
});
