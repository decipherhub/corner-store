# DEPLOY-002 — Production Service Container Contract

## Goal

Issue #115에 따라 Docker 실행 자체를 production-ready 주장과 혼동하지 않으면서,
운영자가 외부 durable coordinator/store, 인증, shared limiter, pricing/risk, signer,
RPC policy resolver와 audit sink를 주입할 수 있는 RFQ host 및 read-only Operator API
OCI contract를 제공한다.

## In scope

1. versioned RFQ bootstrap module contract와 exact `CORNER_STORE_RFQ_*` runtime schema
2. liveness/readiness 분리와 dependency unavailable fail-closed gate
3. signal 기반 bounded graceful shutdown과 secret-free startup/error logging
4. Operator API의 production entrypoint, mounted token/config/artifact readiness
5. pinned multi-stage non-root images와 read-only Compose/Kubernetes-compatible example
6. image build/runtime smoke, missing dependency와 secret redaction regression
7. SBOM/vulnerability scan release hook와 운영 책임 문서

## Out of scope

- 특정 DB, Redis, KMS/HSM, RPC, audit 또는 cloud vendor 구현
- private key나 production credential 제공
- in-memory/local-file adapter를 production 기본값으로 사용
- TLS termination, ingress, secret manager, HA database 또는 WORM 서비스 운영
- demo sandbox image/Compose 변경

## Verification

- `npm test --prefix services/rfq-host`
- `npm test --prefix services/operator-api`
- `scripts/production-container-smoke.sh`
- `scripts/check.sh`
- `git diff --check`

## Result

- Added pinned multi-stage `rfq-host` and `operator-api` OCI targets containing
  compiled runtime files and production dependencies only.
- Added exact versioned environment schemas, fail-closed dependency readiness,
  mounted immutable evidence/token checks and bounded idempotent shutdown.
- Added a versioned RFQ bootstrap contract that has no in-memory or local-file
  production fallback and requires all durable/auth/signer/risk/policy/audit ports.
- Added a digest-only hardened Compose example and documented external platform,
  SBOM, vulnerability scan and production activation responsibilities.
- RFQ/Operator service smoke, OCI read-only runtime smoke, Compose validation,
  full repository checks and BUIDL-like RFQ E2E passed.
