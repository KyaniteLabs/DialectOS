/**
 * Retry policy with exponential backoff and jitter
 * Retries transient failures while avoiding permanent errors
 */

export interface RetryOptions {
  signal?: AbortSignal;
  maxTotalDurationMs?: number;
}

export class RetryPolicy {
  constructor(
    private readonly maxRetries: number,
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number
  ) {}

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    let lastError: Error | undefined;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Check for abort signal
      if (options?.signal?.aborted) {
        throw new Error("Request aborted");
      }

      // Check total duration deadline
      if (options?.maxTotalDurationMs && Date.now() - startTime >= options.maxTotalDurationMs) {
        throw new Error("Retry exceeded total duration limit");
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx)
        if (this.isClientError(lastError)) {
          throw lastError;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= this.maxRetries) {
          throw lastError;
        }

        // Wait before retrying
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay, options?.signal);
      }
    }

    throw lastError || new Error("Retry failed");
  }

  /**
   * Check if error is a client error (4xx) that shouldn't be retried
   */
  private isClientError(error: Error): boolean {
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);

    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

    // Cap at max delay
    return Math.min(this.maxDelayMs, exponentialDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds, abortable via signal
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      if (signal) {
        const abortHandler = () => {
          clearTimeout(timeout);
          reject(new Error("Request aborted"));
        };
        if (signal.aborted) {
          abortHandler();
        } else {
          signal.addEventListener("abort", abortHandler, { once: true });
        }
      }
    });
  }
}
