/**
 * Semantic similarity tests
 * Addresses GitHub issue #9
 *
 * These tests verify cross-lingual EN→ES translation quality scoring.
 * Word overlap is meaningless across languages, so the scorer uses
 * Spanish presence heuristics, length ratio, and entity preservation.
 */

import { describe, it, expect } from "vitest";
import {
  calculateSemanticSimilarity,
  meetsSemanticThreshold,
} from "../lib/semantic-similarity.js";

describe("semantic similarity", () => {
  it("should nuke identical text as LLM copy-paste failure", () => {
    const result = calculateSemanticSimilarity("Hello world", "Hello world");
    expect(result.score).toBe(0);
    expect(result.wordOverlap).toBe(0);
    expect(result.lengthRatio).toBe(0);
  });

  it("should detect empty translation as drift", () => {
    const result = calculateSemanticSimilarity(
      "The quick brown fox jumps",
      ""
    );
    expect(result.score).toBe(0);
    expect(result.wordOverlap).toBe(0);
  });

  it("should detect non-Spanish garbage as drift", () => {
    const result = calculateSemanticSimilarity(
      "API endpoint returns JSON data",
      "hello world foo bar baz"
    );
    // No Spanish chars, no Spanish endings, high English word ratio
    expect(result.score).toBeLessThanOrEqual(0.45);
    expect(result.wordOverlap).toBeLessThanOrEqual(0.3);
  });

  it("should score valid Spanish translation highly", () => {
    const result = calculateSemanticSimilarity(
      "The API endpoint returns JSON data",
      "El endpoint de la API devuelve información en formato JSON"
    );
    // Spanish diacritics present (información), reasonable length, entities preserved
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.entityPreservation).toBeGreaterThan(0.3);
    expect(result.wordOverlap).toBeGreaterThan(0.3);
  });

  it("does not penalize a short UI string for capitalising its first word", () => {
    const result = calculateSemanticSimilarity("Welcome", "Bienvenido");
    expect(result.entityPreservation).toBe(1);
    expect(meetsSemanticThreshold(result.score)).toBe(true);
  });

  it("still penalizes a short source whose mid-sentence name disappears", () => {
    const result = calculateSemanticSimilarity("Email Maria at Kyanite Labs about the release", "Escribe");
    expect(meetsSemanticThreshold(result.score)).toBe(false);
  });

  it("should penalize very short translations", () => {
    const result = calculateSemanticSimilarity(
      "This is a long paragraph with many words about translation quality",
      "ok"
    );
    expect(result.lengthRatio).toBeLessThan(0.5);
    expect(result.score).toBeLessThan(0.5);
  });

  it("should penalize very long translations", () => {
    const result = calculateSemanticSimilarity(
      "Short text",
      "This is an extremely long translation that goes on and on and on with many extra words that were not in the original source text at all"
    );
    expect(result.lengthRatio).toBeLessThan(0.5);
    expect(result.score).toBeLessThan(0.5);
  });

  it("should preserve entities across languages", () => {
    const result = calculateSemanticSimilarity(
      "Kyanite Labs uses the MCP Protocol",
      "Kyanite Labs utiliza el Protocolo MCP"
    );
    expect(result.entityPreservation).toBeGreaterThan(0.3);
  });

  it("should handle Spanish without diacritics (valid but lower score)", () => {
    const result = calculateSemanticSimilarity(
      "the quick brown fox",
      "el rapido zorro marron"
    );
    // No Spanish-specific chars, but Spanish morphology and reasonable length
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.lengthRatio).toBeGreaterThan(0.5);
  });

  it("should meet strict threshold for high scores", () => {
    expect(meetsSemanticThreshold(0.8, "strict")).toBe(true);
    expect(meetsSemanticThreshold(0.6, "strict")).toBe(true);
    expect(meetsSemanticThreshold(0.59, "strict")).toBe(false);
  });

  it("should meet standard threshold for moderate scores", () => {
    expect(meetsSemanticThreshold(0.5, "standard")).toBe(true);
    expect(meetsSemanticThreshold(0.4, "standard")).toBe(true);
    expect(meetsSemanticThreshold(0.39, "standard")).toBe(false);
  });
});
