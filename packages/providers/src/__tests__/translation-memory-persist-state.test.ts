/**
 * Explicit persist-lifecycle tests for TranslationMemory.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  IllegalPersistTransitionError,
  PERSIST_STATES,
  PERSIST_TRANSITIONS,
  TranslationMemory,
  type PersistState,
} from "../translation-memory.js";

const EXPECTED: Record<PersistState, Record<PersistState, boolean>> = {
  idle: { idle: false, writing: true, "writing-dirty": false },
  writing: { idle: true, writing: false, "writing-dirty": true },
  "writing-dirty": { idle: true, writing: true, "writing-dirty": true },
};

function readDiskKeys(dir: string): string[] {
  const raw = fs.readFileSync(path.join(dir, "translation-memory.json"), "utf-8");
  return Object.keys((JSON.parse(raw) as { entries: Record<string, unknown> }).entries).sort();
}

describe("TranslationMemory persist state machine — table", () => {
  it("declares a row for every state", () => {
    expect(Object.keys(PERSIST_TRANSITIONS).sort()).toEqual([...PERSIST_STATES].sort());
    expect(Object.keys(EXPECTED).sort()).toEqual([...PERSIST_STATES].sort());
  });

  it("matches the expected legal/illegal matrix exhaustively", () => {
    for (const from of PERSIST_STATES) {
      for (const to of PERSIST_STATES) {
        expect(PERSIST_TRANSITIONS[from].includes(to), `${from} -> ${to}`).toBe(EXPECTED[from][to]);
      }
    }
  });
});

describe("TranslationMemory persist state machine — behaviour", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dialectos-tm-persist-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("refuses every illegal transition at the single writer", () => {
    for (const from of PERSIST_STATES) {
      for (const to of PERSIST_STATES) {
        if (EXPECTED[from][to]) continue;
        const mem = new TranslationMemory({ cacheDir: dir });
        (mem as unknown as { persistState: PersistState }).persistState = from;
        expect(() =>
          (mem as unknown as { movePersistState(to: PersistState): void }).movePersistState(to)
        ).toThrow(IllegalPersistTransitionError);
        expect(mem.getPersistState()).toBe(from);
      }
    }
  });

  it("idle -> writing -> idle for a single set()", async () => {
    const mem = new TranslationMemory({ cacheDir: dir });
    expect(mem.getPersistState()).toBe("idle");
    const p = mem.set("a", { translatedText: "A" });
    expect(mem.getPersistState()).toBe("writing");
    await p;
    expect(mem.getPersistState()).toBe("idle");
  });

  it("writing -> writing-dirty -> writing -> idle when writes overlap", async () => {
    const mem = new TranslationMemory({ cacheDir: dir });
    const p1 = mem.set("a", { translatedText: "A" });
    const p2 = mem.set("b", { translatedText: "B" });
    expect(mem.getPersistState()).toBe("writing-dirty");
    await Promise.all([p1, p2]);
    expect(mem.getPersistState()).toBe("idle");
  });

  // Regression: a set() that arrived while a write was in flight used to
  // resolve immediately, before any disk write containing its entry.
  it("a coalesced set() resolves only after its entry is on disk", async () => {
    const mem = new TranslationMemory({ cacheDir: dir });
    void mem.set("a", { translatedText: "A" });
    await mem.set("b", { translatedText: "B" });
    expect(readDiskKeys(dir)).toEqual(["a", "b"]);
  });

  it("returns to idle after a failed write (even while dirty) and persists on the next set()", async () => {
    const mem = new TranslationMemory({ cacheDir: dir });
    vi.spyOn(mem as unknown as { doPersist(): Promise<void> }, "doPersist").mockRejectedValueOnce(
      new Error("disk full")
    );
    const p1 = mem.set("a", { translatedText: "A" });
    const p2 = mem.set("b", { translatedText: "B" });
    expect(mem.getPersistState()).toBe("writing-dirty");
    await Promise.all([p1, p2]); // failure is swallowed
    expect(mem.getPersistState()).toBe("idle");
    expect(fs.existsSync(path.join(dir, "translation-memory.json"))).toBe(false);

    await mem.set("c", { translatedText: "C" });
    expect(mem.getPersistState()).toBe("idle");
    expect(readDiskKeys(dir)).toEqual(["a", "b", "c"]);
  });

  it("random interleavings always drain to idle with every key on disk", async () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const mem = new TranslationMemory({ cacheDir: dir });
    const keys: string[] = [];
    for (let round = 0; round < 10; round++) {
      const batch: Promise<void>[] = [];
      const n = 1 + Math.floor(rand() * 6);
      for (let i = 0; i < n; i++) {
        const key = `k${round}-${i}`;
        keys.push(key);
        batch.push(mem.set(key, { translatedText: key }));
        expect(PERSIST_STATES).toContain(mem.getPersistState());
        expect(mem.getPersistState()).not.toBe("idle");
      }
      if (rand() < 0.5) await Promise.all(batch);
      else await batch[batch.length - 1];
      // The last caller's promise covers every earlier change too.
      expect(readDiskKeys(dir)).toEqual([...keys].sort());
    }
    // Let any trailing loop settle.
    await mem.set("final", { translatedText: "F" });
    expect(mem.getPersistState()).toBe("idle");
  });
});
