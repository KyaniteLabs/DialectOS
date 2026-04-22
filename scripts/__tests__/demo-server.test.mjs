import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoServer } from "../demo-server.mjs";

async function startTestServer(services) {
  const server = createDemoServer({ services, rateLimit: { maxRequests: 100, windowMs: 60000 } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function startRateLimitedTestServer(services) {
  const server = createDemoServer({ services, rateLimit: { maxRequests: 1, windowMs: 60000 } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

test("demo server translates through injected full-app service", async () => {
  const calls = [];
  const { server, baseUrl } = await startTestServer({
    status: () => ({
      configured: true,
      providers: ["llm"],
      semanticProviders: ["llm"],
      message: "Configured providers: llm",
    }),
    translate: async (request) => {
      calls.push(request);
      return {
        translatedText: "Recoge el archivo antes de estacionar el carro.",
        dialect: request.dialect,
        providerUsed: "llm",
        fallbackCount: 0,
        retryCount: 0,
        sourceDetection: {
          dialect: "es-ES",
          confidence: 0.1,
          name: "Peninsular Spanish",
          matchedKeywords: [],
          registerHint: "neutral",
        },
        semanticPromptApplied: true,
        providerStatus: {
          configured: true,
          ready: true,
          providers: ["llm"],
          semanticProviders: ["llm"],
          message: "Semantic providers ready: llm",
        },
      };
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Pick up the file before you park the car.",
        dialect: "es-MX",
        provider: "auto",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.translatedText, "Recoge el archivo antes de estacionar el carro.");
    assert.equal(body.providerUsed, "llm");
    assert.equal(body.semanticPromptApplied, true);
    assert.equal(body.semanticContext, undefined);
    assert.equal(JSON.stringify(body).includes("Dialect quality contract"), false);
    assert.deepEqual(calls, [{
      text: "Pick up the file before you park the car.",
      dialect: "es-MX",
      provider: "auto",
      formality: "auto",
    }]);
  } finally {
    server.close();
  }
});

test("demo server returns provider errors instead of static fallback output", async () => {
  const { server, baseUrl } = await startTestServer({
    status: () => ({
      configured: false,
      ready: false,
      providers: [],
      semanticProviders: [],
      message: "No provider configured",
    }),
    translate: async () => {
      throw new Error("No provider configured. Start a local model.");
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hola", dialect: "es-PR" }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.match(body.error, /No provider configured/);
    assert.notEqual(body.translatedText, "hola");
  } finally {
    server.close();
  }
});

test("demo server exposes provider status for the browser UI", async () => {
  const { server, baseUrl } = await startTestServer({
    status: () => ({
      configured: true,
      ready: true,
      providers: ["llm"],
      semanticProviders: ["llm"],
      message: "Semantic providers ready: llm",
    }),
    translate: async () => {
      throw new Error("not used");
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/status`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.configured, true);
    assert.equal(body.ready, true);
    assert.deepEqual(body.providers, ["llm"]);
  } finally {
    server.close();
  }
});

test("demo server handles favicon without a noisy 404", async () => {
  const { server, baseUrl } = await startTestServer({
    status: () => ({
      configured: true,
      ready: true,
      providers: ["llm"],
      semanticProviders: ["llm"],
      message: "Semantic providers ready: llm",
    }),
    translate: async () => {
      throw new Error("not used");
    },
  });

  try {
    const response = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(response.status, 204);
  } finally {
    server.close();
  }
});

test("demo server rejects malformed JSON as a client error", async () => {
  const { server, baseUrl } = await startTestServer({
    status: () => ({
      configured: true,
      ready: true,
      providers: ["llm"],
      semanticProviders: ["llm"],
      message: "Semantic providers ready: llm",
    }),
    translate: async () => {
      throw new Error("should not be called");
    },
  });

  try {
    const response = await fetch(`${baseUrl}/api/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{broken",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.match(body.error, /JSON|Unexpected|position|Expected/i);
  } finally {
    server.close();
  }
});

test("demo server rate limits translation requests", async () => {
  const { server, baseUrl } = await startRateLimitedTestServer({
    status: () => ({
      configured: true,
      ready: true,
      providers: ["llm"],
      semanticProviders: ["llm"],
      message: "Semantic providers ready: llm",
    }),
    translate: async (request) => ({
      translatedText: request.text,
      dialect: request.dialect,
      providerUsed: "llm",
      fallbackCount: 0,
      retryCount: 0,
      sourceDetection: {
        dialect: null,
        confidence: 0,
        name: null,
        matchedKeywords: [],
        registerHint: "neutral",
        isReliable: false,
      },
      semanticPromptApplied: true,
      providerStatus: {
        configured: true,
        ready: true,
        providers: ["llm"],
        semanticProviders: ["llm"],
        message: "Semantic providers ready: llm",
      },
    }),
  });

  try {
    const payload = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hola", dialect: "es-MX" }),
    };
    const first = await fetch(`${baseUrl}/api/translate`, payload);
    const second = await fetch(`${baseUrl}/api/translate`, payload);
    const body = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.match(body.error, /Rate limit exceeded/);
  } finally {
    server.close();
  }
});
