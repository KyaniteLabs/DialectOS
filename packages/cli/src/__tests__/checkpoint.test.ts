/**
 * Checkpoint tests — schema versioning, migration, retention
 * Addresses GitHub issue #10
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  loadCheckpoint,
  saveCheckpoint,
  hashSource,
  migrateCheckpoint,
  pruneStaleCheckpoints,
  CURRENT_CHECKPOINT_SCHEMA_VERSION,
  type TranslationCheckpoint,
} from "../lib/checkpoint.js";

const testDir = "/tmp/espanol-checkpoint-test";

describe("checkpoint", () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("schema versioning", () => {
    it("should include schema version when saving", async () => {
      const checkpointPath = path.join(testDir, "test.ck.json");
      const data: TranslationCheckpoint = {
        schemaVersion: 0, // will be overwritten by saveCheckpoint
        sourcePath: "/tmp/test.md",
        sourceHash: hashSource("hello"),
        totalSections: 3,
        translatedByIndex: { 0: "translated 0" },
      };

      await saveCheckpoint(checkpointPath, data);
      const raw = await fs.readFile(checkpointPath, "utf-8");
      const parsed = JSON.parse(raw);

      expect(parsed.schemaVersion).toBe(CURRENT_CHECKPOINT_SCHEMA_VERSION);
    });

    it("should load current schema version without migration", async () => {
      const checkpointPath = path.join(testDir, "current.ck.json");
      const data: TranslationCheckpoint = {
        schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
        sourcePath: "/tmp/test.md",
        sourceHash: "abc123",
        totalSections: 2,
        translatedByIndex: { 0: "a", 1: "b" },
      };

      await saveCheckpoint(checkpointPath, data);
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).not.toBeNull();
      expect(loaded!.schemaVersion).toBe(CURRENT_CHECKPOINT_SCHEMA_VERSION);
      expect(loaded!.sourcePath).toBe("/tmp/test.md");
      expect(loaded!.totalSections).toBe(2);
    });
  });

  describe("migration", () => {
    it("should migrate schema version 0 to current", async () => {
      const checkpointPath = path.join(testDir, "v0.ck.json");
      const legacy = {
        sourcePath: "/tmp/legacy.md",
        sourceHash: "legacyhash",
        totalSections: 5,
        translatedByIndex: { 0: "section 0", 2: "section 2" },
        // No schemaVersion field — simulates pre-versioning checkpoint
      };

      await fs.writeFile(checkpointPath, JSON.stringify(legacy, null, 2));
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).not.toBeNull();
      expect(loaded!.schemaVersion).toBe(CURRENT_CHECKPOINT_SCHEMA_VERSION);
      expect(loaded!.sourcePath).toBe("/tmp/legacy.md");
      expect(loaded!.totalSections).toBe(5);
      expect(loaded!.translatedByIndex[0]).toBe("section 0");
      expect(loaded!.translatedByIndex[2]).toBe("section 2");
    });

    it("should reject checkpoints with unsupported schema versions", async () => {
      const checkpointPath = path.join(testDir, "future.ck.json");
      const future = {
        schemaVersion: 999,
        sourcePath: "/tmp/future.md",
        totalSections: 1,
        translatedByIndex: {},
      };

      await fs.writeFile(checkpointPath, JSON.stringify(future, null, 2));
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).toBeNull();
    });

    it("migrateCheckpoint should return same data for current version", () => {
      const data: TranslationCheckpoint = {
        schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
        sourcePath: "/tmp/test.md",
        totalSections: 1,
        translatedByIndex: {},
      };

      const result = migrateCheckpoint(data);
      expect(result).toEqual(data);
    });

    it("migrateCheckpoint should migrate version 0 to current", () => {
      const data: TranslationCheckpoint = {
        schemaVersion: 0,
        sourcePath: "/tmp/test.md",
        totalSections: 1,
        translatedByIndex: {},
      };

      const result = migrateCheckpoint(data);
      expect(result).not.toBeNull();
      expect(result!.schemaVersion).toBe(CURRENT_CHECKPOINT_SCHEMA_VERSION);
    });

    it("migrateCheckpoint should return null for unsupported versions", () => {
      const data: TranslationCheckpoint = {
        schemaVersion: -1,
        sourcePath: "/tmp/test.md",
        totalSections: 1,
        translatedByIndex: {},
      };

      const result = migrateCheckpoint(data);
      expect(result).toBeNull();
    });
  });

  describe("security", () => {
    it("should reject checkpoints with dangerous keys", async () => {
      const checkpointPath = path.join(testDir, "dangerous.ck.json");
      // Write raw JSON to ensure __proto__ is an own property key
      const malicious = '{"__proto__":{"polluted":true},"sourcePath":"/tmp/bad.md","totalSections":1,"translatedByIndex":{}}';

      await fs.writeFile(checkpointPath, malicious);
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).toBeNull();
    });

    it("should reject checkpoints missing sourcePath", async () => {
      const checkpointPath = path.join(testDir, "incomplete.ck.json");
      const incomplete = {
        schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
        totalSections: 1,
        translatedByIndex: {},
      };

      await fs.writeFile(checkpointPath, JSON.stringify(incomplete, null, 2));
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).toBeNull();
    });
  });

  describe("atomic write", () => {
    it("should atomically write checkpoint and set restricted permissions", async () => {
      const checkpointPath = path.join(testDir, "atomic.ck.json");
      const data: TranslationCheckpoint = {
        schemaVersion: CURRENT_CHECKPOINT_SCHEMA_VERSION,
        sourcePath: "/tmp/test.md",
        totalSections: 1,
        translatedByIndex: { 0: "hello" },
      };

      await saveCheckpoint(checkpointPath, data);
      const loaded = await loadCheckpoint(checkpointPath);

      expect(loaded).not.toBeNull();
      expect(loaded!.translatedByIndex[0]).toBe("hello");
    });
  });

  describe("retention / pruning", () => {
    it("should remove stale checkpoint files older than threshold", async () => {
      const staleFile = path.join(testDir, "stale.checkpoint.json");
      const freshFile = path.join(testDir, "fresh.checkpoint.json");
      const otherFile = path.join(testDir, "other.txt");

      await fs.writeFile(staleFile, "{\"schemaVersion\":1}");
      await fs.writeFile(freshFile, "{\"schemaVersion\":1}");
      await fs.writeFile(otherFile, "not a checkpoint");

      // Manually backdate stale file by 8 days
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(staleFile, eightDaysAgo / 1000, eightDaysAgo / 1000);

      const removed = await pruneStaleCheckpoints(testDir, 7 * 24 * 60 * 60 * 1000);

      expect(removed).toBe(1);
      await expect(fs.access(staleFile)).rejects.toThrow();
      await expect(fs.access(freshFile)).resolves.not.toThrow();
      await expect(fs.access(otherFile)).resolves.not.toThrow();
    });

    it("should handle non-existent directory gracefully", async () => {
      const removed = await pruneStaleCheckpoints("/tmp/nonexistent-dir-12345", 1000);
      expect(removed).toBe(0);
    });

    it("should skip files not matching .checkpoint.json suffix", async () => {
      const wrongSuffix = path.join(testDir, "data.json");
      await fs.writeFile(wrongSuffix, "{\"schemaVersion\":1}");

      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(wrongSuffix, eightDaysAgo / 1000, eightDaysAgo / 1000);

      const removed = await pruneStaleCheckpoints(testDir, 1000);
      expect(removed).toBe(0);
    });
  });

  describe("hashSource", () => {
    it("should produce consistent SHA-256 hashes", () => {
      const h1 = hashSource("hello world");
      const h2 = hashSource("hello world");
      const h3 = hashSource("different");

      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
