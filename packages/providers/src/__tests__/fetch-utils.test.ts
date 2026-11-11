import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchWithRedirects, stripSensitiveHeaders } from "../fetch-utils.js";

const CREDENTIALS = {
  Authorization: "Bearer secret-bearer",
  "x-api-key": "secret-x-api-key",
  "api-key": "secret-azure-key",
  "x-goog-api-key": "secret-goog-key",
  Cookie: "session=secret",
};

function listen(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; origin: string }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

describe("fetchWithRedirects credential handling", () => {
  let seen: IncomingHttpHeaders | undefined;
  let target: { server: Server; origin: string };
  let redirector: { server: Server; origin: string };

  beforeAll(async () => {
    target = await listen((req, res) => {
      seen = req.headers;
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
    redirector = await listen((req, res) => {
      if (req.url === "/same") {
        res.writeHead(302, { location: "/final" });
        res.end();
        return;
      }
      if (req.url === "/final") {
        seen = req.headers;
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      res.writeHead(307, { location: `${target.origin}/landing` });
      res.end();
    });
  });

  afterAll(() => {
    target.server.close();
    redirector.server.close();
  });

  it("drops every credential header on a cross-origin redirect", async () => {
    seen = undefined;
    const res = await fetchWithRedirects(`${redirector.origin}/start`, {
      init: {
        method: "POST",
        headers: { ...CREDENTIALS, "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      },
    });
    expect(res.status).toBe(200);
    expect(seen).toBeDefined();
    for (const name of Object.keys(CREDENTIALS)) {
      expect(seen?.[name.toLowerCase()], `${name} leaked across origins`).toBeUndefined();
    }
    expect(seen?.["content-type"]).toBe("application/json");
    expect(seen?.accept).toBe("application/json");
  });

  it("keeps credentials on a same-origin redirect", async () => {
    seen = undefined;
    await fetchWithRedirects(`${redirector.origin}/same`, {
      init: { headers: { "x-api-key": "secret-x-api-key" } },
    });
    expect(seen?.["x-api-key"]).toBe("secret-x-api-key");
  });

  it("stripSensitiveHeaders keeps only the safe allowlist", () => {
    const stripped = new Headers(
      stripSensitiveHeaders({ headers: { ...CREDENTIALS, "Content-Type": "text/plain", "X-Custom-Token": "t" } }).headers,
    );
    expect([...stripped.keys()]).toEqual(["content-type"]);
  });
});
