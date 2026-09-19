/**
 * Tests for the JSON-RPC `params: null` stdio guard.
 *
 * Regression for adversarial finding 1 (2026-09-19): a request with
 * `params: null` was silently dropped by the MCP SDK — no JSON-RPC
 * response at all. The guard answers such requests directly with
 * -32602 Invalid params and keeps them away from the SDK. Silence is
 * the failure mode these tests pin down.
 */

import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createNullParamsGuard, jsonRpcNullParamsRequestId } from "../lib/null-params-guard.js";

describe("jsonRpcNullParamsRequestId", () => {
  it("detects a request with params: null and returns its id", () => {
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","params":null,"id":777}')).toBe(777);
    expect(jsonRpcNullParamsRequestId('{"jsonrpc":"2.0","id":"abc","method":"tools/list","params":null}')).toBe("abc");
  });

  it("ignores valid requests, notifications, other params shapes, and garbage", () => {
    expect(jsonRpcNullParamsRequestId('{"method":"tools/list","id":1}')).toBeNull(); // params omitted
    expect(jsonRpcNullParamsRequestId('{"method":"notifications/initialized"}')).toBeNull(); // notification
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":2,"params":{}}')).toBeNull();
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":3,"params":[]}')).toBeNull();
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":4,"params":{"name":"x"}}')).toBeNull();
    expect(jsonRpcNullParamsRequestId('this is definitely not json <<<>>>')).toBeNull();
    expect(jsonRpcNullParamsRequestId('[1,2,3]')).toBeNull();
  });
});

describe("createNullParamsGuard", () => {
  function collect() {
    const written: string[] = [];
    return {
      written,
      stdout: { write: (s: string) => { written.push(s); return true; } } as unknown as NodeJS.WritableStream,
    };
  }

  function readAll(stream: PassThrough): Promise<string> {
    return new Promise((resolve) => {
      let data = "";
      stream.on("data", (c) => { data += c; });
      stream.on("end", () => resolve(data));
    });
  }

  it("answers params:null with -32602 and filters it from the stream", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);
    guard.end('{"method":"tools/call","params":null,"id":777}\n{"method":"tools/list","id":778}\n');

    const passed = await done;
    expect(passed).not.toContain('"id":777');
    expect(passed).toContain('"id":778');

    expect(written.length).toBe(1);
    const response = JSON.parse(written[0]);
    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 777,
      error: { code: -32602, message: expect.stringContaining("Invalid params") },
    });
  });

  it("passes valid requests, notifications, and garbage lines through untouched", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);
    const input = 'this is not json\n{"method":"notifications/initialized"}\n{"method":"tools/list","id":2}\n';
    guard.end(input);

    expect(await done).toBe(input);
    expect(written).toEqual([]);
  });

  it("buffers partial lines across chunks", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);
    guard.write('{"method":"tools/call","par');
    guard.write('ams":null,"id":991}\n{"method":"x","id":992}');
    guard.end("\n");

    const passed = await done;
    expect(passed).not.toContain('"id":991');
    expect(passed).toContain('"id":992');
    expect(JSON.parse(written[0]).id).toBe(991);
  });

  it("answers a trailing params:null line without a newline on flush", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);
    guard.end('{"method":"tools/call","params":null,"id":123}');

    expect(await done).toBe("");
    expect(JSON.parse(written[0]).id).toBe(123);
  });
});

// ---------------------------------------------------------------------------
// End-to-end against the built server binary. CI builds before testing; in
// dev, run `pnpm build` first (repo AGENTS.md pitfall #1). Skipped when the
// dist build is absent so unit-level `vitest run` on source still passes.
// ---------------------------------------------------------------------------
const distIndex = join(__dirname, "..", "..", "dist", "index.js");

describe.skipIf(!existsSync(distIndex))("built server: params:null over stdio", () => {
  it("responds to params:null with -32602 and stays alive afterwards", async () => {
    const proc = spawn(process.execPath, [distIndex], {
      cwd: tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c; });

    const lines: string[] = [];
    proc.stdout.setEncoding("utf8");
    const waiters: Array<(line: string) => void> = [];
    proc.stdout.on("data", (chunk: string) => {
      let buffer = chunk;
      while (buffer.includes("\n")) {
        const nl = buffer.indexOf("\n");
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const waiter = waiters.shift();
        if (waiter) waiter(line);
        else lines.push(line);
      }
    });
    const nextLine = () => new Promise<string>((resolve) => waiters.push(resolve));

    try {
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "regression-test", version: "0.0.0" } } }) + "\n");
      const initLine = await Promise.race([nextLine(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("initialize timed out")), 15000))]);
      expect(JSON.parse(initLine).id).toBe(1);

      // The adversarial probe: explicit null params must get a response.
      proc.stdin.write('{"method":"tools/call","params":null,"id":777}\n');
      const nullParamsLine = await Promise.race([nextLine(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("no response to params:null within 8s — the original silent drop")), 8000))]);
      const response = JSON.parse(nullParamsLine);
      expect(response.id).toBe(777);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);

      // Liveness: the server must still answer normal traffic.
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 778, method: "tools/list", params: {} }) + "\n");
      const livenessLine = await Promise.race([nextLine(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("server not alive after params:null")), 8000))]);
      expect(JSON.parse(livenessLine).id).toBe(778);
      expect(JSON.parse(livenessLine).result).toBeDefined();
    } finally {
      proc.stdin.end();
      await new Promise<void>((resolve) => proc.on("exit", () => resolve()));
    }
  }, 45000);
});
