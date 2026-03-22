/**
 * Shared MCP tool types
 */

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface BaseToolOptions {
  registry?: import("@espanol/providers").ProviderRegistry;
  rateLimiter?: import("@espanol/security").RateLimiter;
}
