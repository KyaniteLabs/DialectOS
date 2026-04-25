/**
 * CircuitBreaker adversarial concurrency tests
 * Validates atomic probe limits and state consistency under race conditions
 */

import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../circuit-breaker.js";

describe("CircuitBreaker concurrent half-open", () => {
  it("allows only one probe through under concurrent canExecute calls", async () => {
    const breaker = new CircuitBreaker(3, 50);

    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fire many concurrent canExecute calls with slight jitter
    const promises = Array.from({ length: 20 }, async () => {
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      return breaker.canExecute();
    });

    const results = await Promise.all(promises);
    const allowed = results.filter(Boolean).length;

    expect(allowed).toBe(1);
    expect(breaker.getState()).toBe("half-open");
  });

  it("does not corrupt state when concurrent probe fails", async () => {
    const breaker = new CircuitBreaker(3, 50);

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Only one gets through
    const allowed = breaker.canExecute();
    expect(allowed).toBe(true);

    // Simulate another concurrent caller getting rejected
    const rejected = breaker.canExecute();
    expect(rejected).toBe(false);

    // Failure should reopen cleanly
    breaker.recordFailure();
    expect(breaker.getState()).toBe("open");
    expect(breaker.canExecute()).toBe(false);
  });

  it("does not corrupt state when concurrent probe succeeds", async () => {
    const breaker = new CircuitBreaker(3, 50);

    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const allowed = breaker.canExecute();
    expect(allowed).toBe(true);

    // Concurrent caller blocked
    expect(breaker.canExecute()).toBe(false);

    // Success should close cleanly
    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canExecute()).toBe(true);
  });
});
