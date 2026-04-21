/**
 * Reliability telemetry collector
 *
 * Captures structured runtime metrics during translation operations.
 * Emits JSON to stderr for ingestion by external dashboards.
 */

export interface TranslationMetrics {
  /** Command that initiated the translation */
  command: string;
  /** Primary provider requested */
  provider?: string;
  /** Provider that actually served the request (may differ after fallback) */
  providerUsed?: string;
  /** Number of provider fallbacks that occurred */
  fallbackCount: number;
  /** Number of retry attempts across all providers */
  retryCount: number;
  /** Number of sections/blocks translated */
  sectionCount: number;
  /** Number of sections that failed translation */
  failureCount: number;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Token integrity percentage (0-1) */
  tokenIntegrity: number;
  /** Glossary fidelity percentage (0-1) */
  glossaryFidelity: number;
  /** Structure integrity (1 = pass, 0 = fail) */
  structureIntegrity: number;
  /** Semantic similarity score (0-1) */
  semanticSimilarity: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Target dialect */
  dialect?: string;
  /** ISO timestamp */
  timestamp: string;
}

export interface HealthReport {
  /** Total translations recorded */
  totalTranslations: number;
  /** Successful translations */
  successCount: number;
  /** Failed translations */
  failureCount: number;
  /** Average quality score */
  avgQualityScore: number;
  /** Average token integrity */
  avgTokenIntegrity: number;
  /** Provider usage distribution */
  providerUsage: Record<string, number>;
  /** Total fallback events */
  totalFallbacks: number;
  /** Fallback rate (0-1) */
  fallbackRate: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Report generation timestamp */
  generatedAt: string;
}

export class TelemetryCollector {
  private metrics: TranslationMetrics[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  record(metric: TranslationMetrics): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxEntries) {
      this.metrics.shift();
    }
  }

  getMetrics(): readonly TranslationMetrics[] {
    return this.metrics;
  }

  clear(): void {
    this.metrics = [];
  }

  generateHealthReport(): HealthReport {
    const total = this.metrics.length;
    if (total === 0) {
      return {
        totalTranslations: 0,
        successCount: 0,
        failureCount: 0,
        avgQualityScore: 0,
        avgTokenIntegrity: 0,
        providerUsage: {},
        totalFallbacks: 0,
        fallbackRate: 0,
        failureRate: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const successCount = this.metrics.filter((m) => m.failureCount === 0).length;
    const totalFallbacks = this.metrics.reduce((sum, m) => sum + m.fallbackCount, 0);
    const providerUsage: Record<string, number> = {};

    for (const m of this.metrics) {
      const key = m.providerUsed || m.provider || "unknown";
      providerUsage[key] = (providerUsage[key] || 0) + 1;
    }

    const avgQualityScore =
      this.metrics.reduce((sum, m) => sum + m.qualityScore, 0) / total;
    const avgTokenIntegrity =
      this.metrics.reduce((sum, m) => sum + m.tokenIntegrity, 0) / total;

    return {
      totalTranslations: total,
      successCount,
      failureCount: total - successCount,
      avgQualityScore: Math.round(avgQualityScore * 100) / 100,
      avgTokenIntegrity: Math.round(avgTokenIntegrity * 100) / 100,
      providerUsage,
      totalFallbacks,
      fallbackRate: Math.round((totalFallbacks / total) * 100) / 100,
      failureRate: Math.round(((total - successCount) / total) * 100) / 100,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Emit a single metric as structured JSON to stderr.
   * Safe for MCP environments where stdout is reserved.
   */
  static emitMetric(metric: TranslationMetrics): void {
    process.stderr.write(`[telemetry] ${JSON.stringify(metric)}\n`);
  }

  /**
   * Emit a health report as structured JSON to stderr.
   */
  static emitReport(report: HealthReport): void {
    process.stderr.write(`[health] ${JSON.stringify(report)}\n`);
  }
}

/** Global singleton for CLI-wide metric collection */
export const globalTelemetry = new TelemetryCollector();
