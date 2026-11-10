import { describe, expect, it } from "vitest";
import { ALL_SPANISH_DIALECTS } from "@dialectos/types";
import { assertKnownDialect } from "../lib/assert-known-dialect.js";
import { executeValidate } from "../commands/validate.js";

describe("assertKnownDialect", () => {
  it("accepts every supported dialect", () => {
    for (const code of ALL_SPANISH_DIALECTS) {
      expect(assertKnownDialect(code)).toBe(code);
    }
  });

  it("rejects unknown codes with an actionable retry hint", () => {
    expect(() => assertKnownDialect("xx-XX")).toThrow(/Unknown dialect 'xx-XX'/);
    expect(() => assertKnownDialect("xx-XX")).toThrow(/dialectos dialects list/);
  });
});

describe("executeValidate dialect gate", () => {
  it("fails closed on garbage dialect before scoring", async () => {
    await expect(
      executeValidate("Click the button", "Haz clic", {
        dialect: "xx-XX" as never,
        format: "text",
        strict: false,
      }),
    ).rejects.toThrow(/Unknown dialect 'xx-XX'/);
  });
});
