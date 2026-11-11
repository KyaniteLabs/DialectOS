import { afterEach, describe, expect, it, vi } from "vitest";
import { createProviderRegistry } from "../../factory.js";
import { DialectOutputPipeline } from "../../pipeline/index.js";
import { stripPreamble } from "../llm-response.js";
import { LLMProvider } from "../llm.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function providerFor(data: unknown, format = "openai", twoCall = false) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  })));
  vi.stubEnv("LLM_TWO_CALL_MODE", twoCall ? "1" : "0");
  vi.stubEnv("LM_STUDIO_JIT_LOAD", "0");
  vi.stubEnv("LLM_COMPACT_PROMPT", "");
  vi.stubEnv("LLM_API_KEY", "");
  return createProviderRegistry({
    LLM_API_URL: "https://llm.example/v1/chat/completions",
    LLM_MODEL: "LFM2-1.2B",
    LLM_API_FORMAT: format,
  }).get("llm");
}

describe("local-model response handling", () => {
  it("unwraps a fenced JSON translation before quality gates", async () => {
    providerFor({ choices: [{ message: {
      content: '\uFEFF  ```json\n{"message":"Hola mundo."}\n```  ',
    } }] });
    // Isolate response handling from typography's independent JSON quote changes.
    const provider = new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "LFM2-1.2B",
      pipeline: new DialectOutputPipeline([]),
    });
    const result = await provider.translate('{"message":"Hello world."}', "en", "es", { dialect: "es-MX" });
    expect(result.translatedText).toBe('{"message":"Hola mundo."}');
  });

  it("preserves fenced JSON when no source context is available", () => {
    expect(stripPreamble('```json\n{"message":"Hola"}\n```'))
      .toBe('```json\n{"message":"Hola"}\n```');
  });

  it("preserves fenced content present in the source", () => {
    const source = '```json\n{"message":"Hello"}\n```';
    const translated = '```json\n{"message":"Hola"}\n```';
    expect(stripPreamble(translated, source)).toBe(translated);
  });

  it("preserves inline backticks and unfenced JSON", () => {
    expect(stripPreamble("Usa `nombre`.", "Use `name`.")).toBe("Usa `nombre`.");
    expect(stripPreamble('{"message":"Hola"}', '{"message":"Hello"}'))
      .toBe('{"message":"Hola"}');
  });

  it("unwraps responses in both stages of two-call translation", async () => {
    const provider = providerFor({ choices: [{ message: {
      content: "```text\nHola mundo.\n```",
    } }] }, "openai", true);
    const result = await provider.translate("Hello world.", "en", "es", { dialect: "es-MX" });
    expect(result.translatedText).toBe("Hola mundo.");
  });

  it.each([
    ["empty choices", { choices: [] }],
    ["null choice", { choices: [null] }],
    ["null content", { choices: [{ message: { content: null } }] }],
    ["whitespace content", { choices: [{ message: { content: "\uFEFF \r\n\t" } }] }],
    ["empty content array", { choices: [{ message: { content: [] } }] }],
    ["reasoning only", { choices: [{ message: { content: "<think>private notes</think>" } }] }],
    ["truncated reasoning", { choices: [{ message: { content: "<think>private notes" } }] }],
    ["prefilled reasoning", { choices: [{ message: { content: "private notes</think>" } }] }],
    ["control tokens only", { choices: [{ message: { content: "<|startoftext|><|endoftext|>" } }] }],
    ["assistant header only", { choices: [{ message: { content: "<|im_start|>assistant" } }] }],
    ["refused content", { choices: [{ message: { content: "Hola", refusal: "Request refused" } }] }],
    ["empty fenced response", { choices: [{ message: { content: "```json\n\n```" } }] }],
  ])("rejects %s through the provider", async (_name, data) => {
    const provider = providerFor(data);
    await expect(provider.translate("Hello world.", "en", "es", { dialect: "es-MX" }))
      .rejects.toThrow("LLM response did not include translated content");
  });

  it.each([
    ["openai", { choices: [{ message: { content: [
      { type: "text", text: "\uFEFF <|startoftext|><|im_start|>assistant\n<think>private notes</think>Hola mundo.<|im_end|>" },
    ] } }] }],
    ["anthropic", { content: [{ type: "text", text: "<think>private notes</think>Hola mundo.<|endoftext|>" }] }],
    ["lmstudio", { output: [{ type: "message", content: "<think>private notes</think>Hola mundo.<|endoftext|>" }] }],
  ])("cleans reasoning and template artifacts in the %s provider path", async (format, data) => {
    const provider = providerFor(data, format);
    const result = await provider.translate("Hello world.", "en", "es", { dialect: "es-MX" });
    expect(result.translatedText).toBe("Hola mundo.");
  });
});
