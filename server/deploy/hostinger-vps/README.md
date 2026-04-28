# Hostinger VPS deploy bundle

Deploy the DialectOS demo server with a real LLM backend on a Hostinger VPS.

## Architecture

- **dialectos-api** — Node.js container running the demo server + LLM provider
- **caddy** — HTTPS reverse proxy with auto-TLS

## LLM provider

**Groq (recommended, free tier):**
- Sign up at https://console.groq.com (no credit card)
- Create an API key
- Free: 30 req/min, 6K tokens/min, ~14.4K req/day
- Model: `llama-3.3-70b-versatile` (good Spanish dialect handling)

**Home inference (alternative):**
- Same Tailscale pattern as Dclutter
- Point `LLM_API_URL` at `host.docker.internal:1234/v1` or your Tailscale IP

## DNS prerequisite

Point a subdomain at the VPS public IP with an A record:

```text
dialectos-api.kyanitelabs.tech  A  <vps-public-ip>
```

## VPS setup

SSH to the Hostinger VPS. Install Docker if not present (see Dclutter's README for Ubuntu steps).

## Deploy

```bash
# Clone the repo on the VPS
git clone https://github.com/Pastorsimon1798/DialectOS.git
cd DialectOS/server/deploy/hostinger-vps

# Configure
cp env.example env.hostinger
nano env.hostinger  # Fill in your domain, Groq API key

# Build and start
docker compose --env-file env.hostinger up -d --build
docker compose --env-file env.hostinger ps

# Verify
./smoke.sh https://dialectos-api.kyanitelabs.tech
```

## Connecting the GitHub Pages demo

The landing page at `pastorsimon1798.github.io/DialectOS` automatically tries the VPS API
when the local `/api/status` endpoint is unreachable. No extra configuration needed —
the page falls back to client-side vocabulary adaptation if the VPS is down.

## Logs

```bash
docker compose --env-file env.hostinger logs --tail=100 dialectos-api
```
