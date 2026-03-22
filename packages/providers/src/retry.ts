/**
 * Retry policy with exponential backoff and jitter
 * Retries transient failures while avoiding permanent errors
 */

export class RetryPolicy {
  constructor(
    private readonly maxRetries: number,
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number
  ) {}

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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
        await this.sleep(delay);
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
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
