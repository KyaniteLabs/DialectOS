FROM node:26-slim AS builder

ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY docs/ ./docs/
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:26-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080

# Create non-root user for security
RUN groupadd -r dialectos && useradd -r -g dialectos -d /app -s /sbin/nologin dialectos

WORKDIR /app
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder /app/packages/cli/package.json ./packages/cli/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/security/dist ./packages/security/dist
COPY --from=builder /app/packages/security/package.json ./packages/security/package.json
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/packages/providers/package.json ./packages/providers/package.json
COPY --from=builder /app/packages/markdown-parser/dist ./packages/markdown-parser/dist
COPY --from=builder /app/packages/markdown-parser/package.json ./packages/markdown-parser/package.json
COPY --from=builder /app/packages/locale-utils/dist ./packages/locale-utils/dist
COPY --from=builder /app/packages/locale-utils/package.json ./packages/locale-utils/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

COPY --from=builder /app/scripts/demo-server.mjs ./scripts/demo-server.mjs
COPY --from=builder /app/scripts/lib/ensure-built.mjs ./scripts/lib/ensure-built.mjs
COPY --from=builder /app/docs/index.html ./docs/index.html
COPY --from=builder /app/docs/dialectos-engine.js ./docs/dialectos-engine.js
COPY --from=builder /app/docs/assets ./docs/assets
COPY --from=builder /app/docs/full-app-demo.md ./docs/full-app-demo.md

# Set ownership to non-root user
RUN chown -R dialectos:dialectos /app

USER dialectos

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8080') + '/api/status').then(r => { if (!r.ok) throw 1; return r.json() }).then(j => { if (!j.ok) throw 1 }).catch(() => process.exit(1))"

CMD ["node", "scripts/demo-server.mjs"]
