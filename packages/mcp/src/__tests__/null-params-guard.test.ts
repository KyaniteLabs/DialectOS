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
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","params":null,"id":777}')).toEqual({ id: 777 });
    expect(jsonRpcNullParamsRequestId('{"jsonrpc":"2.0","id":"abc","method":"tools/list","params":null}')).toEqual({ id: "abc" });
  });

  it("also matches \"id\": null requests — undefined means no match, null id means match (F4)", () => {
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","params":null,"id":null}')).toEqual({ id: null });
  });

  it("ignores valid requests, notifications, other params shapes, and garbage", () => {
    expect(jsonRpcNullParamsRequestId('{"method":"tools/list","id":1}')).toBeUndefined(); // params omitted
    expect(jsonRpcNullParamsRequestId('{"method":"notifications/initialized"}')).toBeUndefined(); // notification
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":2,"params":{}}')).toBeUndefined();
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":3,"params":[]}')).toBeUndefined();
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":4,"params":{"name":"x"}}')).toBeUndefined();
    expect(jsonRpcNullParamsRequestId('this is definitely not json <<<>>>')).toBeUndefined();
    expect(jsonRpcNullParamsRequestId('[1,2,3]')).toBeUndefined();
    // F5: the pattern inside a *string value* is a gate, not a verdict — parse decides.
    expect(jsonRpcNullParamsRequestId('{"method":"tools/call","id":5,"params":{"text":"fake \\"params\\": null inside"}}')).toBeUndefined();
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

  it("answers \"id\": null + params:null instead of silently dropping it (F4)", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);
    guard.end('{"method":"tools/call","params":null,"id":null}\n{"method":"tools/list","id":456}\n');

    const passed = await done;
    expect(passed).not.toContain('"params":null');
    expect(passed).toContain('"id":456');

    expect(written.length).toBe(1);
    const response = JSON.parse(written[0]);
    expect(response.error.code).toBe(-32602);
    expect(response.id).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(response, "id")).toBe(true);
  });

  it("F1 regression: multibyte UTF-8 split across chunk boundaries survives byte-identical", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);

    // Spanish text full of 2-byte sequences (á é í ó ú ñ); split the buffer
    // between a lead byte and its continuation byte.
    const payload = Buffer.from(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 900,
        method: "tools/call",
        params: { name: "translate_text", arguments: { text: "Mi papá hacía café y la niña comía año tras año." } },
      }) + "\n",
      "utf8"
    );
    let split = -1;
    for (let i = 0; i < payload.length - 1; i += 1) {
      if ((payload[i] & 0xe0) === 0xc0 && (payload[i + 1] & 0xc0) === 0x80) {
        split = i + 1;
        break;
      }
    }
    expect(split).toBeGreaterThan(0);

    guard.write(payload.subarray(0, split));
    await new Promise((r) => setImmediate(r));
    guard.write(payload.subarray(split));
    await new Promise((r) => setImmediate(r));
    guard.end();
    const passed = await done;

    // Round-trip intact: byte-identical payload, zero U+FFFD.
    expect(Buffer.compare(Buffer.from(passed, "utf8"), payload)).toBe(0);
    expect(passed).not.toContain("\uFFFD");
    const parsed = JSON.parse(passed.trim());
    expect(parsed.params.arguments.text).toContain("papá hacía café");
    expect(written).toEqual([]);
  });

  it("F1 regression: params:null request with a multibyte id split across chunks gets a clean -32602", async () => {
    const { written, stdout } = collect();
    const guard = createNullParamsGuard(stdout);
    const out = new PassThrough();
    guard.pipe(out);
    const done = readAll(out);

    const payload = Buffer.from('{"method":"tools/call","params":null,"id":"café"}\n', "utf8");
    // Split inside the é (2-byte sequence).
    let split = -1;
    for (let i = 0; i < payload.length - 1; i += 1) {
      if ((payload[i] & 0xe0) === 0xc0 && (payload[i + 1] & 0xc0) === 0x80) {
        split = i + 1;
        break;
      }
    }
    expect(split).toBeGreaterThan(0);

    guard.write(payload.subarray(0, split));
    await new Promise((r) => setImmediate(r));
    guard.write(payload.subarray(split));
    await new Promise((r) => setImmediate(r));
    guard.end();
    await done;

    expect(written.length).toBe(1);
    const response = JSON.parse(written[0]);
    expect(response.id).toBe("café");
    expect(response.error.code).toBe(-32602);
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

  it("F1+F4 end-to-end: params:null with a multibyte id straddling the 64KB pipe boundary gets a clean -32602", async () => {
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

      // Engineer a params:null request whose id "café" straddles a write
      // boundary: pad with a huge valid notification line before it, then
      // split the write so the é is cut between lead and continuation byte.
      const padding = " ".repeat(65536);
      const probe = Buffer.from(
        `{"jsonrpc":"2.0","method":"notifications/initialized","params":{},"pad":"${padding}"}\n` +
        `{"jsonrpc":"2.0","id":"café","method":"tools/call","params":null}\n`,
        "utf8"
      );
      // Find the é in the probe line and split the buffer mid-sequence.
      const idStart = probe.indexOf('"id":"café"', "utf8");
      expect(idStart).toBeGreaterThan(0);
      let split = -1;
      for (let i = idStart; i < probe.length - 1; i += 1) {
        if ((probe[i] & 0xe0) === 0xc0 && (probe[i + 1] & 0xc0) === 0x80) {
          split = i + 1;
          break;
        }
      }
      expect(split).toBeGreaterThan(0);

      proc.stdin.write(probe.subarray(0, split));
      await new Promise((r) => setTimeout(r, 25));
      proc.stdin.write(probe.subarray(split));

      const nullParamsLine = await Promise.race([nextLine(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("no response to params:null within 8s")), 8000))]);
      const response = JSON.parse(nullParamsLine);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
      // The corruption the review proved: id came back as "caf\ufffd\ufffd".
      expect(response.id).toBe("café");
      expect(response.id).not.toContain("\uFFFD");

      // Liveness afterwards.
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 778, method: "tools/list", params: {} }) + "\n");
      const livenessLine = await Promise.race([nextLine(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("server not alive")), 8000))]);
      expect(JSON.parse(livenessLine).id).toBe(778);
    } finally {
      proc.stdin.end();
      await new Promise<void>((resolve) => proc.on("exit", () => resolve()));
    }
  }, 45000);
});
