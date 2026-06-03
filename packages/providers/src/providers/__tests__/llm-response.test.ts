import { describe, expect, it } from "vitest";
import { extractChatCompletionText, stripPreamble } from "../llm-response.js";

describe("LLM response sanitization", () => {
  it("does not preserve reasoning-only responses", () => {
    expect(stripPreamble("<think>internal notes</think>")).toBe("");
    expect(
      extractChatCompletionText({
        choices: [{ message: { content: "<think>internal notes</think>" } }],
      })
    ).toBe("");
  });

  it("removes complete reasoning blocks before translated text", () => {
    expect(stripPreamble("<thinking>internal notes</thinking>\nHola")).toBe("Hola");
  });

  it("leaves malformed reasoning tags intact", () => {
    expect(stripPreamble("<think>internal notes")).toBe("<think>internal notes");
  });
});
