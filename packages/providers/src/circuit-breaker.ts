/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by temporarily disabling failing services
 */

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number
  ) {}

  /**
   * Check if execution is allowed through the circuit
   */
  canExecute(): boolean {
    const now = Date.now();

    // If circuit is open, check if we can transition to half-open
    if (this.state === "open") {
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.state = "half-open";
        this.failureCount = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // If in half-open state, any failure should immediately reopen
    if (this.state === "half-open") {
      this.state = "open";
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      return;
    }

    // Check if we should open the circuit
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    }
  }

  /**
   * Get the current circuit state
   */
  getState(): CircuitState {
    // Auto-transition to half-open if timeout has passed
    if (this.state === "open" && this.nextAttemptTime) {
      const now = Date.now();
      if (now >= this.nextAttemptTime) {
        this.state = "half-open";
        this.failureCount = 0;
      }
    }

    return this.state;
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}
