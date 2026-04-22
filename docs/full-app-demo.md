# DialectOS full-app demo, explained like you are five

This demo is for testing the real product path from a browser.

## The tiny mental model

Imagine three blocks:

1. **Browser page** — the buttons and text box you click.
2. **DialectOS backend** — the safe middleman. It receives browser requests and calls DialectOS code.
3. **Model/provider** — the brain that actually writes the translation.

The browser must **not** call the model directly because that would expose API keys and skip server-side checks.

So the flow is:

```text
browser -> DialectOS demo backend -> provider registry -> local/cloud model
```

## When should something go in a container?

Use a container when setup would otherwise be annoying or inconsistent.

Good container uses:

- You need Node, pnpm, build steps, and server startup to work the same way for everyone.
- You want to deploy the same thing locally, on a VPS, or in staging.
- You have multiple moving parts and want one command to start them.

Bad container uses:

- Storing secrets inside the image.
- Baking a huge model file into the app image when a model volume/sidecar is cleaner.
- Hiding broken setup instead of documenting it.

## Local mode: easiest if you already have LM Studio or another model server

Start your model server first. It needs to expose an OpenAI-compatible chat endpoint.

Then run:

```bash
LLM_API_URL="http://127.0.0.1:1234/v1/chat/completions" \
LLM_API_FORMAT="openai" \
LLM_MODEL="your-local-model-name" \
LLM_ALLOW_LOCAL=1 \
pnpm demo
```

Open:

```text
http://127.0.0.1:8080
```

What happens:

- `pnpm demo` builds DialectOS.
- It starts `scripts/demo-server.mjs`.
- The page calls `/api/translate`.
- The server calls the real provider stack with semantic dialect prompts.

## Container mode: app container plus model container

This repo includes:

- `Dockerfile.demo` — builds the DialectOS demo backend image.
- `docker-compose.yml` — starts the demo backend and an Ollama model service.

Start the model container first:

```bash
docker compose up -d ollama
```

Download the model into the persistent Ollama volume:

```bash
docker compose --profile setup run --rm ollama-pull
```

Start the full demo:

```bash
docker compose up --build demo
```

Then open:

```text
http://127.0.0.1:8080
```

What each container does:

- `demo` is the website plus DialectOS backend.
- `ollama` is the local model server.
- `ollama-pull` is a one-shot setup helper that downloads the model.
- `ollama-models` is a persistent volume, so the model does not download again every time.

## VPS mode, like Hostinger

A VPS is useful for staging because other people can open a real URL.

Recommended VPS shape:

```text
public HTTPS URL
  -> reverse proxy
  -> DialectOS demo container
  -> provider endpoint
```

The provider endpoint can be:

- an Ollama sidecar if the VPS is strong enough,
- a remote LM Studio/OpenAI-compatible endpoint,
- or a cloud model provider.

CPU-only VPS warning: local models can be slow without a GPU. The VPS can still host the web/API layer while the model runs somewhere else.

## Safety rules

- Never put API keys in browser JavaScript.
- Never commit `.env` files.
- Never expose a public demo without rate limits/auth if it uses paid providers.
- If `/api/status` says no provider is configured, fix the model/provider first.

