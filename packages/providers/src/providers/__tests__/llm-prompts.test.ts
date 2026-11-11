import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCompactModel,
  detectModelTier,
  buildSystemPrompt,
  buildDialectSystemPrompt,
  buildUserPrompt,
} from "../llm-prompts.js";

const PROMPT_BUDGET = 8_000; // chars
afterEach(() => vi.unstubAllEnvs());

describe("model capability detection", () => {
  it.each([
    ["LFM2-8B-A1B", true, "tiny"],
    ["lfm2-1.2b", true, "small"],
    ["LFM3-24B-A2B", true, "small"],
    ["liquid/lfm-40b-a3b", true, "small"],
    ["liquid/lfm-40b-a12b", false, "medium"],
    ["liquid/lfm-350m", true, "tiny"],
    ["LFM3-preview", false, "large"],
  ])("classifies %s by active parameters when present", (model, compact, tier) => {
    expect(isCompactModel(model)).toBe(compact);
    expect(detectModelTier(model)).toBe(tier);
  });

  it("keeps explicit prompt overrides for Liquid models", () => {
    vi.stubEnv("LLM_COMPACT_PROMPT", "0");
    expect(isCompactModel("LFM2-8B-A1B")).toBe(false);
    expect(detectModelTier("LFM2-8B-A1B")).toBe("large");
    vi.stubEnv("LLM_COMPACT_PROMPT", "1");
    expect(isCompactModel("liquid/lfm-40b-a12b")).toBe(true);
    expect(detectModelTier("liquid/lfm-40b-a12b")).toBe("small");
  });

  it.each([
    ["liquid/lfm-1200m", true, "small"],
    ["LFM3-9000M", false, "medium"],
    ["lfm2-350m", true, "tiny"],
    ["lfm2-1000m", true, "tiny"],
  ])("converts million-parameter counts for %s", (model, compact, tier) => {
    expect(isCompactModel(model)).toBe(compact);
    expect(detectModelTier(model)).toBe(tier);
  });
  it("detects compact models by param count", () => {
    expect(isCompactModel("llama-3.1-8b")).toBe(true);
    expect(isCompactModel("llama-3.1-70b")).toBe(false);
    expect(isCompactModel("qwen2.5-0.5b")).toBe(true);
    expect(isCompactModel("minimax-m2")).toBe(true);
    expect(isCompactModel(undefined)).toBe(false);
  });

  it("classifies model tiers", () => {
    expect(detectModelTier("qwen2.5-0.5b")).toBe("tiny");
    expect(detectModelTier("llama-3.1-8b")).toBe("small");
    expect(detectModelTier("llama-3.1-70b")).toBe("medium");
    expect(detectModelTier("gpt-4o")).toBe("large");
  });
});

describe("prompt size budget", () => {
  it.each(["LFM2-1.2B-Reasoning", "LFM3-24B-A2B-Reasoning", "liquid/lfm-preview"])(
    "does not send undocumented thinking-off controls to %s", (model) => {
      const prompt = buildUserPrompt("Hello", "en", "es", { dialect: "es-MX" }, model);
      expect(prompt).not.toContain("/no_think");
      expect(prompt).not.toContain("/think");
    }
  );

  it("uses a compact prompt for Liquid models with small active parameter counts", () => {
    expect(buildUserPrompt("Hello", "en", "es", {}, "LFM3-24B-A2B-Reasoning")).toBe("Hello");
  });

  it.each(["qwen3-0.6b", "qwen3-32b"])("retains Qwen thinking-off control for %s", (model) => {
    expect(buildUserPrompt("Hello", "en", "es", {}, model)).toContain("/no_think");
  });
  it("buildSystemPrompt is compact", () => {
    expect(buildSystemPrompt().length).toBeLessThan(PROMPT_BUDGET);
  });

  it("buildDialectSystemPrompt for tiny input stays under budget", () => {
    const prompt = buildDialectSystemPrompt("es-MX", "Hello");
    expect(prompt.length).toBeLessThan(PROMPT_BUDGET);
  });

  it("buildUserPrompt for tiny input stays under budget", () => {
    const prompt = buildUserPrompt("Hello", "en", "es", { dialect: "es-MX" }, "gpt-4o");
    expect(prompt.length).toBeLessThan(PROMPT_BUDGET);
  });

  it("compact model user prompt is bare source text", () => {
    const prompt = buildUserPrompt("Hello world", "en", "es", { dialect: "es-MX" }, "qwen2.5-0.5b");
    expect(prompt).toContain("Hello world");
    expect(prompt).not.toContain("Translate the above text");
  });

  it("full model user prompt includes instruction", () => {
    const prompt = buildUserPrompt("Hello world", "en", "es", { dialect: "es-MX" }, "gpt-4o");
    expect(prompt).toContain("Translate the above text");
    expect(prompt).toContain("es-MX");
  });
});
