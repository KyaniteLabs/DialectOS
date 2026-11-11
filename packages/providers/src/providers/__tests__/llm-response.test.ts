import { describe, expect, it } from "vitest";
import { extractResponseText, extractChatCompletionText, stripPreamble, sanitizeForPrompt } from "../llm-response.js";

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

  it("strips reasoning from content arrays after joining text parts", () => {
    expect(extractChatCompletionText({
      choices: [{ message: { content: [
        { type: "text", text: "<thi" },
        { type: "text", text: "nk>internal notes</think>\nHola" },
      ] } }],
    })).toBe("Hola");
  });

  it("does not preserve reasoning-only content arrays", () => {
    expect(extractChatCompletionText({
      choices: [{ message: { content: [
        { type: "text", text: "<think>internal notes</think>" },
      ] } }],
    })).toBe("");
  });

  it.each(["think", "thinking", "tiz"])("drops truncated <%s> reasoning", (tag) => {
    expect(stripPreamble(`<${tag}>internal notes`)).toBe("");
    expect(stripPreamble(`Hola<${tag}>internal notes`)).toBe("Hola");
    expect(stripPreamble(`<${tag} data-mode='reasoning'>internal notes`)).toBe("");
    expect(stripPreamble(`<${tag}`)).toBe("");
  });

  it.each(["think", "thinking", "tiz"])("drops prefilled reasoning before an orphan </%s>", (tag) => {
    expect(stripPreamble(`internal notes</${tag}>\nHola`)).toBe("Hola");
    expect(stripPreamble(`internal notes</${tag}>`)).toBe("");
  });

  it("preserves unrelated tags and ordinary text", () => {
    expect(stripPreamble("<thinker>Hola</thinker>")).toBe("<thinker>Hola</thinker>");
    expect(stripPreamble("Hola mundo")).toBe("Hola mundo");
  });

  it.each([
    "startoftext", "endoftext", "im_start", "im_end",
    "tool_call_start", "tool_call_end", "tool_list_start", "tool_list_end",
    "tool_response_start", "tool_response_end", "file_separator", "fim_suffix",
  ])("strips the <%s> control token from responses and prompts", (token) => {
    const text = `<|${token}|>Hola`;
    expect(stripPreamble(text)).toBe("Hola");
    expect(sanitizeForPrompt(text)).toBe("Hola");
  });

  it("strips consecutive control tokens while preserving ordinary markup", () => {
    expect(stripPreamble("<|startoftext|><|file_separator|><p>Hola</p><|endoftext|>"))
      .toBe("<p>Hola</p>");
  });

  it.each([
    ["<|im_start|>assistant\nHola", "Hola"],
    ["<|im_start|>assistant", ""],
    ["\uFEFF  <|im_start|>assistant\r\nHola<|im_end|>", "Hola"],
    ["<|startoftext|><|im_start|>assistant\nHola<|im_end|>", "Hola"],
    ["assistant Hola", "assistant Hola"],
  ])("removes an assistant template header from %j without losing the answer", (text, expected) => {
    expect(stripPreamble(text)).toBe(expected);
  });

  it("removes a bare assistant header from prompt input", () => {
    expect(sanitizeForPrompt("<|im_start|>assistant\nHola")).toBe("Hola");
  });

  it("rejects a refusal even when a gateway also supplies content or legacy text", () => {
    expect(extractChatCompletionText({ choices: [{
      message: { refusal: "Request refused", content: "Lo siento, no puedo ayudar." },
      text: "Lo siento, no puedo ayudar.",
    }] })).toBeNull();
    expect(extractChatCompletionText({ choices: [{
      message: { refusal: "Request refused", content: null }, text: "Hola",
    }] })).toBeNull();
  });

  it("rejects content arrays containing a refusal part", () => {
    expect(extractChatCompletionText({ choices: [{ message: { content: [
      { type: "refusal", refusal: "Request refused", text: "Lo siento." },
      { type: "text", text: "Hola" },
    ] } }] })).toBeNull();
  });

  it("accepts ordinary content when the refusal field is null", () => {
    expect(extractChatCompletionText({ choices: [{
      message: { refusal: null, content: "Hola" },
    }] })).toBe("Hola");
  });

  it.each(["openai", "anthropic"])("ignores explicitly non-text parts in %s responses", (format) => {
    const content = [
      { type: "reasoning", text: "private reasoning" },
      { type: "thinking", text: "more private reasoning" },
      { type: "image_url", text: "image metadata" },
      { type: "text", text: "Hola" },
      { text: " mundo" },
      { type: "output_text", text: "." },
    ];
    const data = format === "openai" ? { choices: [{ message: { content } }] } : { content };
    expect(extractResponseText(format, data)).toBe("Hola mundo.");
  });

  it.each([
    ["İ<think>private notes</think>Hola", "İHola"],
    ["<THINK>İ private notes</THINK>Hola", "Hola"],
  ])("preserves Unicode offsets while stripping reasoning from %j", (text, expected) => {
    expect(stripPreamble(text)).toBe(expected);
  });

  it.each(["think", "thinking", "tiz"])("keeps nested <%s> reasoning private when the outer block is truncated", (tag) => {
    expect(stripPreamble(`<${tag}>outer<${tag}>inner</${tag}>private tail`)).toBe("");
    expect(stripPreamble(`Hola<${tag}>outer<${tag}>inner</${tag}>private tail`)).toBe("Hola");
    expect(stripPreamble(`<${tag}>outer<${tag}>inner</${tag}>tail</${tag}>Hola`)).toBe("Hola");
  });

  it("removes the assistant header before reasoning stripping joins adjacent text", () => {
    const text = "<|im_start|>assistant<think>private notes</think>Hola<|im_end|>";
    expect(stripPreamble(text)).toBe("Hola");
    expect(stripPreamble(extractChatCompletionText({ choices: [{ message: { content: text } }] }) ?? ""))
      .toBe("Hola");
    expect(stripPreamble(extractChatCompletionText({ choices: [{ message: { content: [
      { type: "text", text },
    ] } }] }) ?? "")).toBe("Hola");
  });

  it.each(["Bienvenido a nuestra comunidad.", "¡Bienvenido!", "Bienvenidos a casa."])(
    "preserves a real welcome translation: %s", (text) => {
      expect(stripPreamble(text)).toBe(text);
    }
  );

  it("still removes a standalone welcome preamble line", () => {
    expect(stripPreamble("¡Bienvenido!\nHola mundo.")).toBe("Hola mundo.");
  });
});
