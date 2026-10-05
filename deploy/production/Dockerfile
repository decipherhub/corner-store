# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22.14.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b

FROM ${NODE_IMAGE} AS rfq-build
WORKDIR /workspace
COPY services/rfq/package.json services/rfq/package-lock.json services/rfq/tsconfig.json ./services/rfq/
COPY services/rfq-host/package.json services/rfq-host/package-lock.json services/rfq-host/tsconfig.json ./services/rfq-host/
COPY services/rfq/src ./services/rfq/src
COPY services/rfq-host/src ./services/rfq-host/src
RUN npm ci --ignore-scripts --prefix services/rfq \
 && npm ci --ignore-scripts --prefix services/rfq-host
RUN npm run build --prefix services/rfq \
 && npm run build --prefix services/rfq-host \
 && npm prune --omit=dev --prefix services/rfq-host \
 && npm prune --omit=dev --prefix services/rfq

FROM ${NODE_IMAGE} AS rfq-host
LABEL org.opencontainers.image.title="Corner Store production RFQ host" \
      org.opencontainers.image.description="Operator-integrated RFQ host boundary; external durable dependencies required" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
WORKDIR /opt/corner-store
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq/package.json ./services/rfq/package.json
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq/dist/src ./services/rfq/dist/src
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq/node_modules ./services/rfq/node_modules
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq-host/package.json ./services/rfq-host/package.json
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq-host/dist/src ./services/rfq-host/dist/src
COPY --from=rfq-build --chown=10001:10001 /workspace/services/rfq-host/node_modules ./services/rfq-host/node_modules
ENV NODE_ENV=production
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
USER 10001:10001
CMD ["node", "services/rfq-host/dist/src/main.js"]

FROM ${NODE_IMAGE} AS operator-build
WORKDIR /workspace
COPY services/toolkit/package.json services/toolkit/package-lock.json services/toolkit/tsconfig.json ./services/toolkit/
COPY services/operator-api/package.json services/operator-api/package-lock.json services/operator-api/tsconfig.json ./services/operator-api/
COPY services/toolkit/src ./services/toolkit/src
COPY services/operator-api/src ./services/operator-api/src
RUN npm ci --ignore-scripts --prefix services/toolkit \
 && npm ci --ignore-scripts --prefix services/operator-api
RUN npm run build --prefix services/toolkit \
 && npm run build --prefix services/operator-api \
 && npm prune --omit=dev --prefix services/operator-api \
 && npm prune --omit=dev --prefix services/toolkit

FROM ${NODE_IMAGE} AS operator-api
LABEL org.opencontainers.image.title="Corner Store production read-only Operator API" \
      org.opencontainers.image.description="Authenticated read-only deployment and policy observation boundary" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
WORKDIR /opt/corner-store
COPY --from=operator-build --chown=10001:10001 /workspace/services/toolkit/package.json ./services/toolkit/package.json
COPY --from=operator-build --chown=10001:10001 /workspace/services/toolkit/dist/src ./services/toolkit/dist/src
COPY --from=operator-build --chown=10001:10001 /workspace/services/toolkit/node_modules ./services/toolkit/node_modules
COPY --from=operator-build --chown=10001:10001 /workspace/services/operator-api/package.json ./services/operator-api/package.json
COPY --from=operator-build --chown=10001:10001 /workspace/services/operator-api/dist/src ./services/operator-api/dist/src
COPY --from=operator-build --chown=10001:10001 /workspace/services/operator-api/node_modules ./services/operator-api/node_modules
ENV NODE_ENV=production
EXPOSE 8788
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8788/api/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
USER 10001:10001
CMD ["node", "services/operator-api/dist/src/production-main.js"]
