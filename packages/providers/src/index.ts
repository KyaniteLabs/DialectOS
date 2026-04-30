/**
 * @dialectos/providers
 *
 * Translation providers with strategy pattern, circuit breaker, and retry logic
 */

// Core types
export * from "./types.js";

// Circuit breaker and retry
export { CircuitBreaker } from "./circuit-breaker.js";
export { RetryPolicy } from "./retry.js";
export { ProviderRegistry } from "./registry.js";

// Translation memory and caching
export { TranslationMemory } from "./translation-memory.js";
export type { CachedTranslation, TranslationMemoryOptions } from "./translation-memory.js";
export { CachedProvider } from "./cached-provider.js";

// Providers
export { DeepLProvider } from "./providers/deepl.js";
export { LibreTranslateProvider } from "./providers/libre-translate.js";
export { MyMemoryProvider } from "./providers/my-memory.js";
export { LLMProvider } from "./providers/llm.js";

// Translation corpus
export { TranslationCorpus } from "./translation-corpus.js";
export type { TranslationCorpusOptions } from "./translation-corpus.js";
export type { CorpusEntry, CorrectionEntry, CorpusStats } from "./corpus-types.js";

// Chaos testing
export { ChaosProvider } from "./chaos-provider.js";
export type { ChaosScenario, ChaosMode } from "./chaos-provider.js";

// Sentinel extraction
export { extractSentinels, restoreSentinels } from "./sentinel-extraction.js";
export type { ExtractionResult } from "./sentinel-extraction.js";

// Agreement validation
export { validateAgreement, applyAgreementFixes } from "./agreement-validator.js";
export type { AgreementWarning, AgreementResult } from "./agreement-validator.js";

// Post-processing
export { normalizePunctuation } from "./punctuation-normalizer.js";
export { fixAccentuation } from "./accentuation.js";
export { normalizeCapitalization } from "./capitalization.js";
export { normalizeTypography } from "./typography.js";
export { detectFalseFriends } from "./false-friends.js";
export type { FalseFriendWarning } from "./false-friends.js";

// Lexical substitution and voseo adapter
export { applyLexicalSubstitution } from "./lexical-substitution.js";
export { applyVoseo } from "./voseo-adapter.js";

// Bulk translation engine
export { BulkTranslationEngine } from "./bulk/engine.js";
export { Semaphore } from "./bulk/semaphore.js";
export type {
  BulkTranslationItem,
  BulkTranslationSuccess,
  BulkTranslationFailure,
  BulkTranslationResult,
  BulkTranslationProgress,
  BulkCheckpoint,
  BulkEngineOptions,
} from "./bulk/types.js";

// Factory
export {
  createProviderRegistry,
  getDefaultProviderRegistry,
  resetDefaultProviderRegistryForTests,
} from "./factory.js";
export type { ProviderFactoryEnv } from "./factory.js";

// Quality gates
export { runQualityGates, lengthSanityCheck, dialectComplianceCheck, personConsistencyCheck, haberTenerCheck } from "./quality-gates.js";
export type { QualityGateResult, QualityGateContext, ModelTier } from "./quality-gates.js";
