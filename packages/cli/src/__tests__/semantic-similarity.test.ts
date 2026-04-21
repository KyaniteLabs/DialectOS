/**
 * Semantic similarity tests
 * Addresses GitHub issue #9
 */

import { describe, it, expect } from "vitest";
import {
  calculateSemanticSimilarity,
  meetsSemanticThreshold,
} from "../lib/semantic-similarity.js";

describe("semantic similarity", () => {
  it("should score identical texts as 1.0", () => {
    const result = calculateSemanticSimilarity("Hello world", "Hello world");
    expect(result.score).toBe(1);
    expect(result.wordOverlap).toBe(1);
    expect(result.lengthRatio).toBe(1);
  });

  it("should detect empty translation as drift", () => {
    const result = calculateSemanticSimilarity(
      "The quick brown fox jumps",
      ""
    );
    expect(result.score).toBeLessThanOrEqual(0.35);
    expect(result.wordOverlap).toBe(0);
  });

  it("should detect completely different text as drift", () => {
    const result = calculateSemanticSimilarity(
      "API endpoint returns JSON data",
      "hello world foo bar baz"
    );
    expect(result.score).toBeLessThanOrEqual(0.35);
    expect(result.wordOverlap).toBe(0);
  });

  it("should tolerate normal translation variation", () => {
    const result = calculateSemanticSimilarity(
      "The API endpoint returns JSON data",
      "El punto final de la API devuelve datos JSON"
    );
    // Should have some overlap on "api" and "json"
    expect(result.score).toBeGreaterThan(0.2);
    expect(result.entityPreservation).toBeGreaterThan(0);
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

  it("should handle texts with no entities", () => {
    const result = calculateSemanticSimilarity(
      "the quick brown fox",
      "the fast brown fox"
    );
    expect(result.entityPreservation).toBeGreaterThanOrEqual(0.3);
    expect(result.wordOverlap).toBeGreaterThan(0.5);
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
