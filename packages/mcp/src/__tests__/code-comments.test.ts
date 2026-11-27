import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  extractCodeComments,
  handleTranslateCodeComment,
} from "../tools/translator-handlers.js";

/** Audit ledger row 38. The only "//" is inside a string, and that string contains "the". */
const COMMENT_SHAPED_STRING = 'const label = "// The world";';

describe("extractCodeComments", () => {
  it("ignores // inside string literals such as URLs", () => {
    const code = [
      'const url = "https://example.com/api"; // fetch the list of users',
      "const b = 'http://x.test//path';",
      "const t = `see https://docs.test for the details`;",
    ].join("\n");
    const found = extractCodeComments(code);
    expect(found.map((c) => c.content)).toEqual(["fetch the list of users"]);
    expect(code.slice(found[0].index, found[0].index + found[0].full.length)).toBe(
      "// fetch the list of users"
    );
  });

  it("finds block comments and does not double-count // inside them", () => {
    const code = "/* see http://a.test for the spec */\nx = 1; /* the end */";
    const found = extractCodeComments(code);
    expect(found.map((c) => [c.isSingleLine, c.content])).toEqual([
      [false, "see http://a.test for the spec"],
      [false, "the end"],
    ]);
  });

  it("handles escaped quotes inside strings", () => {
    const code = 'const s = "a \\" // not a comment"; // the real one';
    expect(extractCodeComments(code).map((c) => c.content)).toEqual(["the real one"]);
  });

  it("records the position of each duplicate comment separately", () => {
    const code = "a(); // the same\nb(); // the same";
    const found = extractCodeComments(code);
    expect(found).toHaveLength(2);
    expect(found[1].index).toBe(code.lastIndexOf("//"));
  });

  it("does not treat a string whose value is a // comment as a comment", () => {
    expect(extractCodeComments(COMMENT_SHAPED_STRING)).toEqual([]);
  });

  it("keeps a real comment after a comment-shaped string and leaves the assignment alone", () => {
    const code = `${COMMENT_SHAPED_STRING}\nconst count = 1; // keep the count`;
    const found = extractCodeComments(code);
    expect(found.map((c) => c.content)).toEqual(["keep the count"]);
    expect(code.slice(0, found[0].index)).toBe(
      'const label = "// The world";\nconst count = 1; '
    );
  });
});

describe("translate_code_comment string literals", () => {
  it("reports zero comments and returns code that still parses", async () => {
    const translate = vi.fn(async () => ({ translatedText: "EL MUNDO" }));
    const registry = {
      get: () => ({ name: "mock", translate }),
      getAuto: () => ({ name: "mock", translate }),
      prepareRequest: () => ({
        sourceLang: "en",
        targetLang: "es-ES",
        options: {},
        warnings: [],
      }),
    };
    const result = await handleTranslateCodeComment(
      { code: COMMENT_SHAPED_STRING, dialect: "es-ES" },
      registry as never,
      { acquire: async () => undefined } as never
    );

    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.commentsTranslated).toBe(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.translatedCode).toBe(COMMENT_SHAPED_STRING);
    expect(translate).not.toHaveBeenCalled();

    const dir = mkdtempSync(join(tmpdir(), "dialectos-comment-"));
    const file = join(dir, "audit.js");
    writeFileSync(file, `${parsed.translatedCode}\n`);
    execFileSync("node", ["--check", file], { stdio: "pipe" });
  });
});

/** Registry stub whose provider records every comment it is asked to translate. */
function commentRegistry(translatedText = "Hola mundo") {
  const provider = { name: "mock", translate: vi.fn(async () => ({ translatedText })) };
  const registry = {
    get: () => provider,
    getAuto: () => provider,
    prepareRequest: () => ({
      sourceLang: "en",
      targetLang: "es-ES",
      options: {},
      warnings: [],
    }),
  };
  const translateCodeComment = async (code: string) =>
    JSON.parse(
      (
        await handleTranslateCodeComment({ code, dialect: "es-ES" }, registry as never, {
          acquire: async () => undefined,
        } as never)
      ).content[0].text
    );
  return { provider, translateCodeComment };
}

/** Audit ledger row 39: this comment was dropped before any provider call. */
describe("translate_code_comment English candidate selection", () => {
  it("translates the short English comment // Hello world", async () => {
    const { provider, translateCodeComment } = commentRegistry("Hola mundo");
    const parsed = await translateCodeComment("const x = 1; // Hello world");

    expect(provider.translate).toHaveBeenCalledTimes(1);
    expect(provider.translate.mock.calls[0][0]).toBe("Hello world");
    expect(parsed.commentsTranslated).toBe(1);
    expect(parsed.errors).toEqual([]);
    expect(parsed.translatedCode).toBe("const x = 1; // Hola mundo");
  });

  it("still translates // The world, the paired comment from the audit", async () => {
    const { translateCodeComment } = commentRegistry("El mundo");
    const parsed = await translateCodeComment("x(); // The world");

    expect(parsed.commentsTranslated).toBe(1);
    expect(parsed.translatedCode).toBe("x(); // El mundo");
  });

  it("translates English comments containing none of the old nine stopwords", async () => {
    const { translateCodeComment } = commentRegistry("Maneja errores de reintento");
    const parsed = await translateCodeComment("// Handles retry errors\nretry();");

    expect(parsed.commentsTranslated).toBe(1);
    expect(parsed.errors).toEqual([]);
  });

  it("translates a short block comment", async () => {
    const { translateCodeComment } = commentRegistry("Hola mundo");
    const parsed = await translateCodeComment("/* Hello world */\nx();");

    expect(parsed.commentsTranslated).toBe(1);
    expect(parsed.translatedCode).toBe("/* Hola mundo */\nx();");
  });

  it("reports tooling directives it skips instead of dropping them silently", async () => {
    const { provider, translateCodeComment } = commentRegistry();
    const code = "// @ts-ignore\n// eslint-disable-next-line no-console\nconst x = 1;";
    const parsed = await translateCodeComment(code);

    expect(provider.translate).not.toHaveBeenCalled();
    expect(parsed.commentsTranslated).toBe(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.commentsSkipped).toBe(2);
    expect(parsed.skipped.map((s: { reason: string }) => s.reason)).toEqual([
      "directive",
      "directive",
    ]);
    expect(parsed.translatedCode).toBe(code);
  });

  it("reports comments that are already Spanish instead of re-translating them", async () => {
    const { provider, translateCodeComment } = commentRegistry();
    const code = "const ready = true; // el valor está listo";
    const parsed = await translateCodeComment(code);

    expect(provider.translate).not.toHaveBeenCalled();
    expect(parsed.commentsTranslated).toBe(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.commentsSkipped).toBe(1);
    expect(parsed.skipped[0].reason).toBe("already Spanish");
    expect(parsed.translatedCode).toBe(code);
  });
});
