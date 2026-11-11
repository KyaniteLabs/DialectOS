import { describe, it, expect } from "vitest";
import { extractCodeComments } from "../tools/translator-handlers.js";

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
});
