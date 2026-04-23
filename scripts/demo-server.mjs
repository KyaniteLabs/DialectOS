#!/usr/bin/env node
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const MAX_JSON_BYTES = 128 * 1024;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
};

function createRateLimiter(options = {}) {
  const maxRequests = Number(options.maxRequests || process.env.DIALECTOS_DEMO_RATE_LIMIT || 60);
  const windowMs = Number(options.windowMs || process.env.DIALECTOS_DEMO_RATE_WINDOW_MS || 60000);
  const buckets = new Map();

  return {
    check(key) {
      const now = Date.now();
      const current = buckets.get(key);
      if (!current || now >= current.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: Math.max(maxRequests - 1, 0), resetMs: windowMs };
      }
      current.count += 1;
      return {
        allowed: current.count <= maxRequests,
        remaining: Math.max(maxRequests - current.count, 0),
        resetMs: Math.max(current.resetAt - now, 0),
      };
    },
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function readDialect(body) {
  const candidate = body?.dialect ?? body?.targetDialect ?? body?.targetLocale ?? body?.locale;
  if (candidate === undefined || candidate === null || String(candidate).trim() === "") {
    throw new Error("Target dialect is required. Send dialect, targetDialect, or targetLocale, for example es-PR.");
  }
  return String(candidate).trim();
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function staticPathFor(urlPath, rootDir) {
  const pathname = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = pathname === "/"
    ? "docs/index.html"
    : pathname.replace(/^\/+/, "");
  const absolute = path.resolve(rootDir, relative);
  if (!absolute.startsWith(rootDir + path.sep) && absolute !== rootDir) {
    return undefined;
  }
  return absolute;
}

async function serveStatic(req, res, rootDir) {
  const absolute = staticPathFor(req.url || "/", rootDir);
  if (!absolute) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(absolute);
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(absolute).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

async function loadDefaultServices(rootDir) {
  const serviceUrl = pathToFileURL(path.join(rootDir, "packages/cli/dist/lib/web-demo-service.js")).href;
  const service = await import(serviceUrl);
  return {
    status: () => service.getWebDemoProviderStatus(),
    translate: (request) => service.translateForWebDemo(request),
  };
}

export function createDemoServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const rateLimiter = createRateLimiter(options.rateLimit);
  const servicesPromise = options.services
    ? Promise.resolve(options.services)
    : loadDefaultServices(rootDir);

  return createServer(async (req, res) => {
    try {
      const method = req.method || "GET";
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if ((method === "GET" || method === "HEAD") && url.pathname === "/favicon.ico") {
        res.writeHead(204, { "cache-control": "public, max-age=86400" });
        res.end();
        return;
      }

      if (method === "GET" && url.pathname === "/api/status") {
        const services = await servicesPromise;
        sendJson(res, 200, { ok: true, ...(await services.status()) });
        return;
      }

      if (method === "POST" && url.pathname === "/api/translate") {
        const key = req.socket.remoteAddress || "unknown";
        const rate = rateLimiter.check(key);
        if (!rate.allowed) {
          sendJson(res, 429, {
            ok: false,
            error: `Rate limit exceeded. Try again in ${Math.ceil(rate.resetMs / 1000)}s.`,
          });
          return;
        }
        const services = await servicesPromise;
        let body;
        try {
          body = await readJson(req);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: safeError(error) });
          return;
        }
        try {
          const result = await services.translate({
            text: String(body.text || ""),
            dialect: readDialect(body),
            provider: body.provider ? String(body.provider) : "auto",
            formality: body.formality ? String(body.formality) : "auto",
          });
          sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          const message = safeError(error);
          const status = /No provider configured|No translation providers|Provider not available/i.test(message)
            ? 503
            : /Invalid|No input|required|too large/i.test(message)
              ? 400
              : 500;
          sendJson(res, status, { ok: false, error: message });
        }
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { ok: false, error: "Unknown API route" });
        return;
      }

      if (method !== "GET" && method !== "HEAD") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      await serveStatic(req, res, rootDir);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: safeError(error) });
    }
  });
}

export async function startDemoServer(options = {}) {
  const port = Number(options.port || process.env.DIALECTOS_DEMO_PORT || 8080);
  const host = String(options.host || process.env.DIALECTOS_DEMO_HOST || "127.0.0.1");
  const server = createDemoServer(options);
  await new Promise((resolve) => server.listen(port, host, resolve));
  // eslint-disable-next-line no-console
  console.log(`DialectOS full-app demo: http://${host}:${port}`);
  // eslint-disable-next-line no-console
  console.log("The browser calls /api/translate, which calls the configured DialectOS provider stack.");
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDemoServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
