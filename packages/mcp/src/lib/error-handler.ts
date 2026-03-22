/**
 * Global error handling for MCP server
 */

import { createSafeError } from "@espanol/security";

/**
 * Setup global process error handlers for graceful shutdown
 * Note: Uses console.error (stderr) since stdout is reserved for MCP protocol
 */
export function setupGlobalHandlers(): void {
  process.on("uncaughtException", (error: unknown) => {
    const safe = createSafeError(error);
    console.error(JSON.stringify({ level: "fatal", error: safe.code, message: safe.error }));
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const safe = createSafeError(reason);
    console.error(JSON.stringify({ level: "error", error: safe.code, message: safe.error }));
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    console.error(JSON.stringify({ level: "info", message: `Received ${signal}, shutting down` }));
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
