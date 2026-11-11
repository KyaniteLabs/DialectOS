/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by temporarily disabling failing services
 *
 * Lifecycle (the ONLY legal moves; every write goes through `transition()`):
 *
 *   closed    --recordFailure (failures >= threshold)-->  open
 *   closed    --recordSuccess / reset-->                  closed
 *   open      --canExecute (reset timeout elapsed)-->     half-open   (caller becomes the probe)
 *   open      --recordFailure (still >= threshold)-->     open        (re-arms the timeout)
 *   open      --recordSuccess (late in-flight call)-->    closed
 *   half-open --recordSuccess (probe ok)-->               closed
 *   half-open --recordFailure (probe failed)-->           open
 *   any       --reset()-->                                closed      (operator escape hatch)
 *
 * Per-state invariants (checked by tests after every step):
 *   closed    : nextAttemptTime undefined, probeCount 0, probeLockTime undefined
 *   open      : nextAttemptTime defined,   probeCount 0, probeLockTime undefined
 *   half-open : nextAttemptTime undefined, probeCount >= 1, probeLockTime defined
 */

export const CIRCUIT_STATES = ["closed", "open", "half-open"] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

/** Legal `from → to` moves. Self-loops are listed explicitly where allowed. */
export const CIRCUIT_TRANSITIONS: Readonly<Record<CircuitState, readonly CircuitState[]>> = {
  closed: ["closed", "open"],
  open: ["open", "half-open", "closed"],
  "half-open": ["closed", "open"],
};

export function isCircuitState(value: unknown): value is CircuitState {
  return typeof value === "string" && (CIRCUIT_STATES as readonly string[]).includes(value);
}

export function isLegalCircuitTransition(from: CircuitState, to: CircuitState): boolean {
  return CIRCUIT_TRANSITIONS[from].includes(to);
}

export class IllegalCircuitTransitionError extends Error {
  constructor(
    readonly from: CircuitState,
    readonly to: CircuitState
  ) {
    super(`Illegal circuit breaker transition: ${from} -> ${to}`);
    this.name = "IllegalCircuitTransitionError";
  }
}

/** Read-only view of the breaker's internal bookkeeping (for tests/diagnostics). */
export interface CircuitBreakerSnapshot {
  state: CircuitState;
  failureCount: number;
  nextAttemptTime?: number;
  probeCount: number;
  probeLockTime?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private nextAttemptTime?: number;
  private probeLockTime?: number;
  private probeCount = 0;
  private static readonly PROBE_LOCK_TIMEOUT_MS = 5000;
  private static readonly MAX_PROBE_COUNT = 1;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number
  ) {}

  /**
   * The single writer of `state`. Refuses illegal moves and establishes the
   * per-state invariants documented at the top of this file.
   */
  private transition(to: CircuitState, now: number): void {
    if (!isLegalCircuitTransition(this.state, to)) {
      throw new IllegalCircuitTransitionError(this.state, to);
    }
    this.state = to;
    switch (to) {
      case "closed":
        this.failureCount = 0;
        this.nextAttemptTime = undefined;
        this.probeLockTime = undefined;
        this.probeCount = 0;
        return;
      case "open":
        this.nextAttemptTime = now + this.resetTimeoutMs;
        this.probeLockTime = undefined;
        this.probeCount = 0;
        return;
      case "half-open":
        this.failureCount = 0;
        this.nextAttemptTime = undefined;
        // The call that triggered this move becomes the probe request.
        this.probeCount = 1;
        this.probeLockTime = now;
        return;
      default: {
        const exhaustive: never = to;
        throw new Error(`Unhandled circuit state: ${String(exhaustive)}`);
      }
    }
  }

  /** Whether the half-open probe slot is currently held by a live probe. */
  private probeSlotHeld(now: number): boolean {
    return (
      this.probeCount >= CircuitBreaker.MAX_PROBE_COUNT &&
      this.probeLockTime !== undefined &&
      now - this.probeLockTime < CircuitBreaker.PROBE_LOCK_TIMEOUT_MS
    );
  }

  /**
   * Pure availability check: would `canExecute()` return true right now?
   * Unlike `canExecute()` it never claims the half-open probe slot and never
   * moves the state, so it is safe for "is this provider usable?" queries.
   */
  wouldAllow(now: number = Date.now()): boolean {
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        return this.nextAttemptTime !== undefined && now >= this.nextAttemptTime;
      case "half-open":
        return !this.probeSlotHeld(now);
      default: {
        const exhaustive: never = this.state;
        throw new Error(`Unhandled circuit state: ${String(exhaustive)}`);
      }
    }
  }

  /**
   * Check if execution is allowed through the circuit.
   * Only ONE concurrent request is allowed through in half-open state.
   * This CLAIMS the probe slot when it returns true in half-open state, so
   * call it only right before actually making the request.
   */
  canExecute(): boolean {
    const now = Date.now();
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        if (this.nextAttemptTime !== undefined && now >= this.nextAttemptTime) {
          this.transition("half-open", now);
          return true;
        }
        return false;
      case "half-open":
        // The probe lock auto-expires after PROBE_LOCK_TIMEOUT_MS so a probe
        // that never reports back cannot wedge the breaker forever.
        if (this.probeSlotHeld(now)) {
          return false;
        }
        if (this.probeCount >= CircuitBreaker.MAX_PROBE_COUNT) {
          this.probeCount = 0; // lock expired — release the stale slot
        }
        this.probeCount++;
        this.probeLockTime = now;
        return true;
      default: {
        const exhaustive: never = this.state;
        throw new Error(`Unhandled circuit state: ${String(exhaustive)}`);
      }
    }
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.transition("closed", Date.now());
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    const now = Date.now();
    this.failureCount++;

    // If in half-open state, any failure should immediately reopen
    if (this.state === "half-open") {
      this.transition("open", now);
      return;
    }

    // Check if we should open the circuit (or re-arm the timeout if open)
    if (this.failureCount >= this.failureThreshold) {
      this.transition("open", now);
    }
  }

  /**
   * Get the current circuit state (pure, no side effects)
   */
  getState(): CircuitState {
    return this.state;
  }

  /** Read-only copy of internal bookkeeping (pure, no side effects). */
  getSnapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
      probeCount: this.probeCount,
      probeLockTime: this.probeLockTime,
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.transition("closed", Date.now());
  }
}
