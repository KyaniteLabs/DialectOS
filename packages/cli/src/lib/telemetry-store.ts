/**
 * Telemetry persistence store
 * Writes structured telemetry events to append-only JSONL files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createSecureTempPath } from "@dialectos/security";

export interface TelemetryEvent {
  eventId: string;
  timestamp: string;
  command: string;
  provider: string;
  providerUsed: string;
  dialect: string;
  sourceLang: string;
  targetLang: string;
  modelName?: string;
  modelTier?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  retryCount: number;
  fallbackCount: number;
  cacheHit: boolean;
  postProcessorsApplied: Array<{ name: string; changed: boolean }>;
  qualityGates?: Array<{ name: string; passed: boolean }>;
  failureClass?: string;
  sourceTextHash: string;
  translatedTextHash: string;
}

export interface TelemetryStoreOptions {
  /** Directory for telemetry files (default: ~/.cache/dialectos/telemetry) */
  dir?: string;
  /** Max file size before rotation in bytes (default: 10MB) */
  maxFileSize?: number;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export class TelemetryStore {
  private dir: string;
  private maxFileSize: number;
  private currentFile: string;

  constructor(options: TelemetryStoreOptions = {}) {
    this.dir = options.dir ?? path.join(process.env.HOME || "/tmp", ".cache", "dialectos", "telemetry");
    this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    fs.mkdirSync(this.dir, { recursive: true });
    this.currentFile = this.resolveCurrentFile();
  }

  private resolveCurrentFile(): string {
    const files = fs.readdirSync(this.dir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort();

    if (files.length > 0) {
      const latest = path.join(this.dir, files[files.length - 1]);
      try {
        const stats = fs.statSync(latest);
        if (stats.size < this.maxFileSize) {
          return latest;
        }
      } catch {
        // Fall through to create new file
      }
    }

    return path.join(this.dir, `telemetry_${new Date().toISOString().slice(0, 10)}.jsonl`);
  }

  write(event: TelemetryEvent): void {
    try {
      const line = JSON.stringify(event) + "\n";

      // Check if we need to rotate
      try {
        const stats = fs.statSync(this.currentFile);
        if (stats.size >= this.maxFileSize) {
          this.currentFile = path.join(
            this.dir,
            `telemetry_${new Date().toISOString().slice(0, 10)}-${Date.now()}.jsonl`
          );
        }
      } catch {
        // File doesn't exist yet
      }

      fs.appendFileSync(this.currentFile, line, "utf-8");
    } catch {
      // Telemetry persistence is best-effort
    }
  }

  /**
   * Query telemetry events with simple filtering.
   * Loads events from the last N files (default: all files from today).
   */
  query(options: {
    since?: Date;
    until?: Date;
    command?: string;
    dialect?: string;
    provider?: string;
    failureClass?: string;
    limit?: number;
  } = {}): TelemetryEvent[] {
    const results: TelemetryEvent[] = [];
    const files = fs.readdirSync(this.dir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse();

    for (const file of files) {
      const filepath = path.join(this.dir, file);
      const content = fs.readFileSync(filepath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as TelemetryEvent;

          if (options.since && new Date(event.timestamp) < options.since) continue;
          if (options.until && new Date(event.timestamp) > options.until) continue;
          if (options.command && event.command !== options.command) continue;
          if (options.dialect && event.dialect !== options.dialect) continue;
          if (options.provider && event.provider !== options.provider) continue;
          if (options.failureClass && event.failureClass !== options.failureClass) continue;

          results.push(event);

          if (options.limit && results.length >= options.limit) {
            return results;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    return results;
  }

  /**
   * Get aggregate statistics from telemetry.
   */
  stats(since?: Date): {
    totalEvents: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    failureRate: number;
    providerUsage: Record<string, number>;
    dialectUsage: Record<string, number>;
  } {
    const events = this.query({ since, limit: 100000 });

    const totalEvents = events.length;
    if (totalEvents === 0) {
      return {
        totalEvents: 0,
        avgLatencyMs: 0,
        cacheHitRate: 0,
        failureRate: 0,
        providerUsage: {},
        dialectUsage: {},
      };
    }

    const totalLatency = events.reduce((sum, e) => sum + e.latencyMs, 0);
    const cacheHits = events.filter((e) => e.cacheHit).length;
    const failures = events.filter((e) => e.failureClass).length;

    const providerUsage: Record<string, number> = {};
    const dialectUsage: Record<string, number> = {};

    for (const e of events) {
      providerUsage[e.providerUsed] = (providerUsage[e.providerUsed] || 0) + 1;
      dialectUsage[e.dialect] = (dialectUsage[e.dialect] || 0) + 1;
    }

    return {
      totalEvents,
      avgLatencyMs: Math.round(totalLatency / totalEvents),
      cacheHitRate: Math.round((cacheHits / totalEvents) * 100),
      failureRate: Math.round((failures / totalEvents) * 100),
      providerUsage,
      dialectUsage,
    };
  }
}

let globalStore: TelemetryStore | null = null;

export function getGlobalTelemetryStore(): TelemetryStore {
  if (!globalStore) {
    globalStore = new TelemetryStore();
  }
  return globalStore;
}
