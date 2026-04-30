/**
 * Bulk translation engine types
 */

import type { TranslationResult, TranslateOptions, SpanishDialect } from "@dialectos/types";
import type { TranslationMemory } from "../translation-memory.js";

export interface BulkTranslationItem {
  /** Stable identifier for checkpointing and reporting */
  id: string;
  /** Source text to translate */
  sourceText: string;
  /** Source language code */
  sourceLang: string;
  /** Target language code */
  targetLang: string;
  /** Translation options (dialect, formality, context) */
  options?: TranslateOptions;
}

export interface BulkTranslationSuccess {
  item: BulkTranslationItem;
  result: TranslationResult;
  latencyMs: number;
  cacheHit: boolean;
  retryCount: number;
}

export interface BulkTranslationFailure {
  item: BulkTranslationItem;
  error: string;
  retryCount: number;
  /** ISO timestamp */
  failedAt: string;
}

export interface BulkTranslationResult {
  /** Successfully translated items */
  successes: BulkTranslationSuccess[];
  /** Failed items (dead-letter queue) */
  failures: BulkTranslationFailure[];
  /** Items that were skipped due to cache hit */
  cacheHits: number;
  /** Total unique API calls made */
  apiCalls: number;
  /** Total latency for the entire bulk operation */
  totalLatencyMs: number;
  /** Whether all items succeeded */
  allSucceeded: boolean;
}

export interface BulkTranslationProgress {
  /** Total items to process */
  total: number;
  /** Items completed (success or failure) */
  completed: number;
  /** Successful translations */
  succeeded: number;
  /** Failed translations */
  failed: number;
  /** Cache hits */
  cacheHits: number;
  /** Currently in-flight translations */
  inFlight: number;
  /** Estimated time remaining in ms (null if unknown) */
  estimatedRemainingMs: number | null;
}

export interface BulkCheckpoint {
  version: number;
  /** ISO timestamp */
  createdAt: string;
  /** Items that have been successfully processed */
  completedIds: string[];
  /** Completed item results (for true resume without cache) */
  completedResults: Array<{ id: string; result: TranslationResult }>;
  /** Items that failed */
  failedItems: BulkTranslationFailure[];
  /** Total items in the job */
  totalItems: number;
}

export interface BulkEngineOptions {
  /** Maximum concurrent API calls (default: 4) */
  maxConcurrency?: number;
  /** Maximum retries per item (default: 2) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Whether to use translation memory cache (default: true) */
  useCache?: boolean;
  /** Optional pre-configured translation memory cache */
  cache?: TranslationMemory;
  /** Checkpoint interval: save progress every N items (default: 50) */
  checkpointInterval?: number;
  /** Optional checkpoint file path for resumable jobs */
  checkpointPath?: string;
  /** Progress callback — called on every item completion */
  onProgress?: (progress: BulkTranslationProgress) => void;
  /** Checkpoint callback — called when checkpoint is saved */
  onCheckpoint?: (checkpoint: BulkCheckpoint) => void;
}
