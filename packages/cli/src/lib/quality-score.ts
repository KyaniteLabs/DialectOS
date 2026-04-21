import { calculateSemanticSimilarity } from "./semantic-similarity.js";

export interface QualityScore {
  score: number;
  tokenIntegrity: number;
  glossaryFidelity: number;
  structureIntegrity: number;
  semanticSimilarity: number;
}

export function calculateQualityScore(
  source: string,
  translated: string,
  protectedTokens: string[],
  glossary: Record<string, string>,
  structureValid: boolean
): QualityScore {
  const tokenChecks = protectedTokens.filter((t) => source.includes(t));
  const tokenHits = tokenChecks.filter((t) => translated.includes(t)).length;
  const tokenIntegrity = tokenChecks.length === 0 ? 1 : tokenHits / tokenChecks.length;

  const glossaryChecks = Object.entries(glossary).filter(([src]) => source.includes(src));
  const glossaryHits = glossaryChecks.filter(([, tgt]) => translated.includes(tgt)).length;
  const glossaryFidelity = glossaryChecks.length === 0 ? 1 : glossaryHits / glossaryChecks.length;

  const structureIntegrity = structureValid ? 1 : 0;

  const semantic = calculateSemanticSimilarity(source, translated);
  const semanticSimilarity = semantic.score;

  const score = Math.round(
    (tokenIntegrity * 0.25 +
      glossaryFidelity * 0.3 +
      structureIntegrity * 0.2 +
      semanticSimilarity * 0.25) *
      100
  );

  return { score, tokenIntegrity, glossaryFidelity, structureIntegrity, semanticSimilarity };
}
