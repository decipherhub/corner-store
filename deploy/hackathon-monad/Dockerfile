# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22.14.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
COPY services/testnet-rfq-demo/package.json services/testnet-rfq-demo/package-lock.json services/testnet-rfq-demo/tsconfig.json ./services/testnet-rfq-demo/
COPY services/rfq/package.json services/rfq/package-lock.json ./services/rfq/
COPY services/testnet-rfq-demo/src ./services/testnet-rfq-demo/src
COPY services/testnet-rfq-demo/public ./services/testnet-rfq-demo/public
COPY services/rfq/src ./services/rfq/src
RUN npm ci --ignore-scripts --prefix services/rfq \
 && npm ci --ignore-scripts --prefix services/testnet-rfq-demo \
 && npm run build --prefix services/testnet-rfq-demo \
 && npm prune --omit=dev --prefix services/testnet-rfq-demo

FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.title="Corner Store Monad hackathon RFQ demo" \
      org.opencontainers.image.description="Artifact-bound, wallet-signed public-testnet reference UI" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
WORKDIR /opt/corner-store/services/testnet-rfq-demo
COPY --from=build --chown=10001:10001 /workspace/services/testnet-rfq-demo/package.json ./package.json
COPY --from=build --chown=10001:10001 /workspace/services/testnet-rfq-demo/dist ./dist
COPY --from=build --chown=10001:10001 /workspace/services/testnet-rfq-demo/public ./public
COPY --from=build --chown=10001:10001 /workspace/services/testnet-rfq-demo/node_modules ./node_modules
ENV NODE_ENV=production \
    CORNER_STORE_TESTNET_DEMO_HOST=0.0.0.0 \
    CORNER_STORE_TESTNET_DEMO_PORT=8791 \
    CORNER_STORE_TESTNET_PUBLIC_ACKNOWLEDGEMENT=hackathon-testnet-only
EXPOSE 8791
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8791/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
USER 10001:10001
CMD ["node", "dist/testnet-rfq-demo/src/index.js"]
