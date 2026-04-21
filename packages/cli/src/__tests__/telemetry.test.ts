/**
 * Telemetry tests
 * Addresses GitHub issue #12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TelemetryCollector,
  globalTelemetry,
  type TranslationMetrics,
} from "../lib/telemetry.js";

describe("TelemetryCollector", () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    collector = new TelemetryCollector();
    globalTelemetry.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should record and retrieve metrics", () => {
    const metric: TranslationMetrics = {
      command: "translate-readme",
      provider: "deepl",
      providerUsed: "deepl",
      fallbackCount: 0,
      retryCount: 0,
      sectionCount: 5,
      failureCount: 0,
      qualityScore: 98,
      tokenIntegrity: 1,
      glossaryFidelity: 1,
      structureIntegrity: 1,
      durationMs: 1200,
      dialect: "es-ES",
      timestamp: new Date().toISOString(),
    };

    collector.record(metric);
    expect(collector.getMetrics()).toHaveLength(1);
    expect(collector.getMetrics()[0].qualityScore).toBe(98);
  });

  it("should enforce maxEntries limit", () => {
    const smallCollector = new TelemetryCollector(3);
    for (let i = 0; i < 5; i++) {
      smallCollector.record(makeMetric({ qualityScore: i }));
    }

    expect(smallCollector.getMetrics()).toHaveLength(3);
    expect(smallCollector.getMetrics()[0].qualityScore).toBe(2);
    expect(smallCollector.getMetrics()[2].qualityScore).toBe(4);
  });

  it("should generate empty health report when no metrics", () => {
    const report = collector.generateHealthReport();
    expect(report.totalTranslations).toBe(0);
    expect(report.avgQualityScore).toBe(0);
    expect(report.failureRate).toBe(0);
  });

  it("should calculate provider usage distribution", () => {
    collector.record(makeMetric({ providerUsed: "deepl" }));
    collector.record(makeMetric({ providerUsed: "deepl" }));
    collector.record(makeMetric({ providerUsed: "mymemory" }));

    const report = collector.generateHealthReport();
    expect(report.providerUsage).toEqual({ deepl: 2, mymemory: 1 });
  });

  it("should calculate fallback rate", () => {
    collector.record(makeMetric({ fallbackCount: 0 }));
    collector.record(makeMetric({ fallbackCount: 1 }));
    collector.record(makeMetric({ fallbackCount: 2 }));

    const report = collector.generateHealthReport();
    expect(report.totalFallbacks).toBe(3);
    expect(report.fallbackRate).toBe(1); // 3 fallbacks / 3 translations
  });

  it("should calculate failure rate", () => {
    collector.record(makeMetric({ failureCount: 0 }));
    collector.record(makeMetric({ failureCount: 0 }));
    collector.record(makeMetric({ failureCount: 1 }));

    const report = collector.generateHealthReport();
    expect(report.successCount).toBe(2);
    expect(report.failureCount).toBe(1);
    expect(report.failureRate).toBeCloseTo(0.33, 1);
  });

  it("should calculate average quality and token integrity", () => {
    collector.record(makeMetric({ qualityScore: 80, tokenIntegrity: 0.9 }));
    collector.record(makeMetric({ qualityScore: 100, tokenIntegrity: 1 }));

    const report = collector.generateHealthReport();
    expect(report.avgQualityScore).toBe(90);
    expect(report.avgTokenIntegrity).toBe(0.95);
  });

  it("should emit metric to stderr", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const metric = makeMetric({ command: "test", qualityScore: 95 });

    TelemetryCollector.emitMetric(metric);

    expect(stderrSpy).toHaveBeenCalledOnce();
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain("[telemetry]");
    expect(written).toContain("test");
    expect(written).toContain("95");
    stderrSpy.mockRestore();
  });

  it("should emit health report to stderr", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    collector.record(makeMetric({ qualityScore: 100 }));
    const report = collector.generateHealthReport();

    TelemetryCollector.emitReport(report);

    expect(stderrSpy).toHaveBeenCalledOnce();
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain("[health]");
    expect(written).toContain("100");
    stderrSpy.mockRestore();
  });

  it("globalTelemetry should be a singleton", () => {
    globalTelemetry.record(makeMetric({ qualityScore: 77 }));
    expect(globalTelemetry.getMetrics()).toHaveLength(1);
    expect(globalTelemetry.getMetrics()[0].qualityScore).toBe(77);
  });
});

function makeMetric(overrides: Partial<TranslationMetrics> = {}): TranslationMetrics {
  return {
    command: "translate-readme",
    provider: "deepl",
    providerUsed: "deepl",
    fallbackCount: 0,
    retryCount: 0,
    sectionCount: 3,
    failureCount: 0,
    qualityScore: 100,
    tokenIntegrity: 1,
    glossaryFidelity: 1,
    structureIntegrity: 1,
    semanticSimilarity: 1,
    durationMs: 500,
    dialect: "es-ES",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
