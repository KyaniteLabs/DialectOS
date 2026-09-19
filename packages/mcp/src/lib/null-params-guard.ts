/**
 * JSON-RPC 2.0 `params: null` guard for the stdio MCP server.
 *
 * JSON-RPC 2.0 requires a response to every request carrying an id, and
 * `params` must be a structured value when present. Explicit `null` params
 * is therefore invalid params (-32602) — but the MCP SDK silently drops
 * such requests instead of answering them, leaving the client waiting.
 *
 * This guard sits between process.stdin and the StdioServerTransport. It
 * scans the stream line-wise; every request whose `params` is exactly JSON
 * null is answered directly with a -32602 error on stdout and removed from
 * the stream so the SDK never sees it. All other bytes pass through
 * untouched (including invalid JSON, notifications, and responses).
 */

import { Transform } from "node:stream";

/**
 * If the line is a JSON-RPC request with `params: null`, return its id so
 * the caller can answer it; otherwise return null.
 */
export function jsonRpcNullParamsRequestId(line: string): string | number | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const message = JSON.parse(trimmed) as Record<string, unknown>;
    if (
      typeof message === "object" &&
      message !== null &&
      message.method !== undefined &&
      message.id !== undefined &&
      message.params === null
    ) {
      return message.id as string | number;
    }
  } catch {
    // Not valid JSON — pass the line through untouched.
  }
  return null;
}

function nullParamsResponse(id: string | number): string {
  return (
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Invalid params: params must be an object, not null" },
    }) + "\n"
  );
}

/**
 * Create the stdin guard Transform. Malformed requests are answered on
 * `stdout` (default process.stdout) exactly when they are filtered out.
 */
export function createNullParamsGuard(stdout: NodeJS.WritableStream = process.stdout): Transform {
  let partialLine = "";
  return new Transform({
    transform(
      chunk: Buffer,
      _encoding: BufferEncoding,
      callback: (error: Error | null, data: Buffer | string | null) => void
    ): void {
      partialLine += chunk.toString("utf8");
      const lines = partialLine.split("\n");
      partialLine = lines.pop() ?? "";
      const forwarded = lines.filter((line) => {
        const nullParamsId = jsonRpcNullParamsRequestId(line);
        if (nullParamsId !== null) {
          stdout.write(nullParamsResponse(nullParamsId));
          return false;
        }
        return true;
      });
      callback(null, forwarded.length > 0 ? Buffer.from(forwarded.join("\n") + "\n", "utf8") : null);
    },
    flush(callback: (error: Error | null, data: Buffer | string | null) => void): void {
      if (partialLine.length > 0) {
        const line = partialLine;
        partialLine = "";
        const nullParamsId = jsonRpcNullParamsRequestId(line);
        if (nullParamsId !== null) {
          stdout.write(nullParamsResponse(nullParamsId));
          callback(null, null);
        } else {
          callback(null, Buffer.from(line + "\n", "utf8"));
        }
      } else {
        callback(null, null);
      }
    },
  });
}
