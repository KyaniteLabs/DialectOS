# Minimal image so MCP directories (e.g. Glama) can start the stdio server and
# run introspection checks. Builds this checkout from source: the @dialectos/*
# packages are not published to npm.
FROM node:26-slim AS builder

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable

WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:26-slim AS runtime

ENV NODE_ENV=production
RUN groupadd -r dialectos && useradd -r -g dialectos -d /app -s /sbin/nologin dialectos
WORKDIR /app
COPY --from=builder --chown=dialectos:dialectos /app ./
USER dialectos

ENTRYPOINT ["node", "/app/packages/mcp/dist/index.js"]
