/**
 * Explicit state-machine tests for CircuitBreaker:
 * - the transition table is exhaustive over CIRCUIT_STATES
 * - every legal transition is reachable through the public API
 * - every illegal transition is refused
 * - per-state invariants hold after every step of random operation sequences
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CIRCUIT_STATES,
  CIRCUIT_TRANSITIONS,
  CircuitBreaker,
  IllegalCircuitTransitionError,
  isCircuitState,
  isLegalCircuitTransition,
  type CircuitBreakerSnapshot,
  type CircuitState,
} from "../circuit-breaker.js";

const THRESHOLD = 3;
const RESET_MS = 1000;
const PROBE_LOCK_MS = 5000;

/** The expected legal-move matrix, written out independently of the source. */
const EXPECTED: Record<CircuitState, Record<CircuitState, boolean>> = {
  closed: { closed: true, open: true, "half-open": false },
  open: { closed: true, open: true, "half-open": true },
  "half-open": { closed: true, open: true, "half-open": false },
};

function assertInvariants(s: CircuitBreakerSnapshot): void {
  switch (s.state) {
    case "closed":
      expect(s.nextAttemptTime).toBeUndefined();
      expect(s.probeCount).toBe(0);
      expect(s.probeLockTime).toBeUndefined();
      expect(s.failureCount).toBeLessThan(THRESHOLD);
      return;
    case "open":
      expect(s.nextAttemptTime).toBeTypeOf("number");
      expect(s.probeCount).toBe(0);
      expect(s.probeLockTime).toBeUndefined();
      return;
    case "half-open":
      expect(s.nextAttemptTime).toBeUndefined();
      expect(s.probeCount).toBeGreaterThanOrEqual(1);
      expect(s.probeLockTime).toBeTypeOf("number");
      return;
    default: {
      // Adding a state without an invariant here fails to compile AND at runtime.
      const exhaustive: never = s.state;
      throw new Error(`no invariants for state ${String(exhaustive)}`);
    }
  }
}

function openBreaker(b: CircuitBreaker): void {
  for (let i = 0; i < THRESHOLD; i++) b.recordFailure();
}

describe("CircuitBreaker state machine — table", () => {
  it("declares a transition row for every state and nothing else", () => {
    expect(Object.keys(CIRCUIT_TRANSITIONS).sort()).toEqual([...CIRCUIT_STATES].sort());
    expect(Object.keys(EXPECTED).sort()).toEqual([...CIRCUIT_STATES].sort());
    for (const from of CIRCUIT_STATES) {
      for (const to of CIRCUIT_TRANSITIONS[from]) {
        expect(isCircuitState(to)).toBe(true);
      }
    }
  });

  it("matches the expected legal/illegal matrix exhaustively", () => {
    for (const from of CIRCUIT_STATES) {
      for (const to of CIRCUIT_STATES) {
        expect(isLegalCircuitTransition(from, to), `${from} -> ${to}`).toBe(EXPECTED[from][to]);
      }
    }
  });

  it("refuses every illegal transition at the single writer", () => {
    for (const from of CIRCUIT_STATES) {
      for (const to of CIRCUIT_STATES) {
        if (EXPECTED[from][to]) continue;
        const b = new CircuitBreaker(THRESHOLD, RESET_MS);
        (b as unknown as { state: CircuitState }).state = from;
        const before = b.getState();
        expect(() =>
          (b as unknown as { transition(to: CircuitState, now: number): void }).transition(to, Date.now())
        ).toThrow(IllegalCircuitTransitionError);
        expect(b.getState()).toBe(before);
      }
    }
  });

  it("isCircuitState rejects unknown values", () => {
    expect(isCircuitState("closed")).toBe(true);
    expect(isCircuitState("halfopen")).toBe(false);
    expect(isCircuitState(undefined)).toBe(false);
  });
});

describe("CircuitBreaker state machine — every legal transition via the public API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("closed -> closed (success / reset)", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    b.recordFailure();
    b.recordSuccess();
    expect(b.getSnapshot()).toMatchObject({ state: "closed", failureCount: 0 });
    b.reset();
    assertInvariants(b.getSnapshot());
  });

  it("closed -> open at the threshold", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    b.recordFailure();
    b.recordFailure();
    expect(b.getState()).toBe("closed");
    b.recordFailure();
    expect(b.getState()).toBe("open");
    expect(b.getSnapshot().nextAttemptTime).toBe(RESET_MS);
  });

  it("open -> open re-arms the timeout on further failures", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(500);
    b.recordFailure();
    expect(b.getSnapshot()).toMatchObject({ state: "open", nextAttemptTime: 1500 });
  });

  it("open -> half-open only once the timeout elapses, and the caller holds the probe", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS - 1);
    expect(b.canExecute()).toBe(false);
    expect(b.getState()).toBe("open");
    vi.setSystemTime(RESET_MS);
    expect(b.canExecute()).toBe(true);
    expect(b.getSnapshot()).toMatchObject({ state: "half-open", probeCount: 1, failureCount: 0 });
    assertInvariants(b.getSnapshot());
  });

  it("open -> closed when a late in-flight call succeeds", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    b.recordSuccess();
    assertInvariants(b.getSnapshot());
    expect(b.getState()).toBe("closed");
  });

  it("half-open -> closed on probe success", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS);
    b.canExecute();
    b.recordSuccess();
    expect(b.getState()).toBe("closed");
    assertInvariants(b.getSnapshot());
  });

  it("half-open -> open on probe failure (single failure is enough)", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS);
    b.canExecute();
    b.recordFailure();
    expect(b.getSnapshot()).toMatchObject({ state: "open", nextAttemptTime: 2 * RESET_MS });
    assertInvariants(b.getSnapshot());
  });

  it("half-open -> closed via reset()", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS);
    b.canExecute();
    b.reset();
    assertInvariants(b.getSnapshot());
    expect(b.getState()).toBe("closed");
  });

  it("half-open probe lock expires so an abandoned probe cannot wedge the breaker", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS);
    expect(b.canExecute()).toBe(true);
    expect(b.canExecute()).toBe(false);
    vi.setSystemTime(RESET_MS + PROBE_LOCK_MS);
    expect(b.canExecute()).toBe(true);
    expect(b.getSnapshot().probeCount).toBe(1);
  });
});

describe("CircuitBreaker.wouldAllow (pure peek)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("never changes state or claims the probe slot", () => {
    const b = new CircuitBreaker(THRESHOLD, RESET_MS);
    openBreaker(b);
    vi.setSystemTime(RESET_MS);
    const before = b.getSnapshot();
    expect(b.wouldAllow()).toBe(true);
    expect(b.wouldAllow()).toBe(true);
    expect(b.getSnapshot()).toEqual(before);
    // The real request still gets the probe after any number of peeks.
    expect(b.canExecute()).toBe(true);
    expect(b.wouldAllow()).toBe(false);
  });
});

/** Small deterministic PRNG so failures are reproducible from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("CircuitBreaker — stateful model test (random operation sequences)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  const visitedAcrossSeeds = new Set<CircuitState>();

  // Weighted so failures/timeouts are common enough to reach every state.
  const OPS = [
    "canExecute", "canExecute", "canExecute",
    "failure", "failure", "failure", "failure",
    "tick", "tick", "tick",
    "wouldAllow", "success", "reset", "bigTick",
  ] as const;

  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}: invariants hold and every move is legal`, () => {
      const rand = mulberry32(seed);
      const b = new CircuitBreaker(THRESHOLD, RESET_MS);
      let now = 0;
      visitedAcrossSeeds.add(b.getState());

      for (let step = 0; step < 400; step++) {
        const op = OPS[Math.floor(rand() * OPS.length)];
        const before = b.getSnapshot();
        let allowed: boolean | undefined;

        switch (op) {
          case "canExecute": {
            const peek = b.wouldAllow();
            allowed = b.canExecute();
            // wouldAllow() must predict canExecute() exactly.
            expect(allowed).toBe(peek);
            break;
          }
          case "wouldAllow":
            b.wouldAllow();
            expect(b.getSnapshot()).toEqual(before);
            break;
          case "success":
            b.recordSuccess();
            break;
          case "failure":
            b.recordFailure();
            break;
          case "reset":
            b.reset();
            break;
          case "tick":
            now += Math.floor(rand() * 600);
            vi.setSystemTime(now);
            break;
          case "bigTick":
            now += PROBE_LOCK_MS;
            vi.setSystemTime(now);
            break;
        }

        const after = b.getSnapshot();
        assertInvariants(after);
        expect(isLegalCircuitTransition(before.state, after.state) || before.state === after.state).toBe(true);
        visitedAcrossSeeds.add(after.state);

        // Operation-specific postconditions.
        if (op === "success" || op === "reset") expect(after.state).toBe("closed");
        if (op === "failure" && before.state === "half-open") expect(after.state).toBe("open");
        if (op === "canExecute" && before.state === "open" && !allowed) expect(after.state).toBe("open");
        if (op === "canExecute" && before.state === "half-open" && allowed) {
          // A granted half-open call always holds a fresh probe lock.
          expect(after.probeLockTime).toBe(now);
        }
      }
    });
  }

  it("the random walks together visited every state", () => {
    expect([...visitedAcrossSeeds].sort()).toEqual([...CIRCUIT_STATES].sort());
  });
});
