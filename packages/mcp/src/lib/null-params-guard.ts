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
 *
 * Hardening (wave 2, 2026-09-19, from the independent review):
 * - F1: chunk reassembly decodes via StringDecoder, so a multibyte UTF-8
 *   sequence straddling a chunk boundary is buffered, never corrupted into
 *   U+FFFD halves (pattern ported from achiote@0.2.2, CGO-16).
 * - F4: `"id": null` requests are also answered (with `"id": null` in the
 *   error response, as JSON-RPC prescribes for unknown ids) instead of
 *   being silently dropped.
 * - F5: lines that cannot contain `"params": null` pass through without a
 *   JSON.parse — the guard no longer doubles the SDK's parse cost on
 *   ordinary traffic.
 */

import { Transform } from "node:stream";
import { StringDecoder } from "node:string_decoder";

/** A line only reaches JSON.parse when this cheap pattern is present. */
const NULL_PARAMS_PATTERN = /"params"\s*:\s*null/;

/**
 * If the line is a JSON-RPC request with `params: null`, return its id
 * (which may legitimately be JSON null — F4) wrapped in an object;
 * otherwise return undefined.
 *
 * The wrapper distinguishes "no match" from a matched request whose id is
 * null; both used to collapse to the same null sentinel, which silently
 * dropped `"id": null` requests (review finding F4).
 */
export function jsonRpcNullParamsRequestId(
  line: string
): { id: string | number | null } | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return undefined;
  // F5: skip the parse entirely for lines without the null-params pattern.
  // The regex is a gate, not a verdict — a line whose *string values*
  // happen to contain `"params": null` still parses and passes through.
  if (!NULL_PARAMS_PATTERN.test(trimmed)) return undefined;
  try {
    const message = JSON.parse(trimmed) as Record<string, unknown>;
    if (
      typeof message === "object" &&
      message !== null &&
      message.method !== undefined &&
      "id" in message &&
      message.params === null
    ) {
      const id = message.id;
      if (id === null || typeof id === "string" || typeof id === "number") {
        return { id };
      }
      return undefined;
    }
  } catch {
    // Not valid JSON — pass the line through untouched.
  }
  return undefined;
}

function nullParamsResponse(id: string | number | null): string {
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
  // F1: a multibyte UTF-8 sequence can straddle a chunk boundary;
  // Buffer.toString() per chunk would decode each half into U+FFFD.
  // StringDecoder buffers incomplete sequences until they complete.
  const utf8Decoder = new StringDecoder("utf8");
  return new Transform({
    transform(
      chunk: Buffer,
      _encoding: BufferEncoding,
      callback: (error: Error | null, data: Buffer | string | null) => void
    ): void {
      partialLine += utf8Decoder.write(chunk);
      const lines = partialLine.split("\n");
      partialLine = lines.pop() ?? "";
      const forwarded = lines.filter((line) => {
        const nullParams = jsonRpcNullParamsRequestId(line);
        if (nullParams !== undefined) {
          stdout.write(nullParamsResponse(nullParams.id));
          return false;
        }
        return true;
      });
      callback(null, forwarded.length > 0 ? Buffer.from(forwarded.join("\n") + "\n", "utf8") : null);
    },
    flush(callback: (error: Error | null, data: Buffer | string | null) => void): void {
      partialLine += utf8Decoder.end();
      if (partialLine.length > 0) {
        const line = partialLine;
        partialLine = "";
        const nullParams = jsonRpcNullParamsRequestId(line);
        if (nullParams !== undefined) {
          stdout.write(nullParamsResponse(nullParams.id));
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
