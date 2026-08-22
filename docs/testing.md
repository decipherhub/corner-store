# Testing Guide

## Test Layers

### Static Verification

```sh
forge fmt --check
forge lint --severity high --deny warnings src
forge build
```

Foundry high-severity production lint를 fail-closed gate로 사용한다. medium/low
warning budget과 별도 보안 분석기는 후속 범위다.

### Unit Tests

제품 Foundry 테스트:

```sh
forge test --offline
```

현재 제품 테스트는 compliance registry/engine, execution router, AMM adapter,
RFQ adapter와 TREX fixture 기반 integration path를 포함한다.
`--offline`은 외부 시그니처 조회를 차단해 로컬 검증을 결정적으로 유지하고,
일부 macOS 환경의 Foundry nightly 프록시 초기화 충돌을 피한다.

RFQ TypeScript SDK smoke test:

```sh
cd services/rfq
npm ci
npm test
```

이 smoke test는 EIP-712 typed-data shape, high-level SDK quote flow, pricing/nonce/risk seams, expiry/nonce 부여, unsafe JavaScript number 거부와 monotonic nonce fallback을 검증한다.

RFQ demo backend와 CLI smoke test:

```sh
cd services/rfq-demo-backend && npm ci && npm test
cd services/cli && npm ci && npm test
```

RFQ production host hardening smoke test:

```sh
cd services/rfq-host && npm ci && npm test
```

Host smoke는 인증 401/403, malformed/oversize/Content-Length 413,
hashed-principal rate limit 429, limiter capacity principal-spray 방어, 실제
coordinator pricing/risk evidence freshness fail-closed, fresh risk rejection 422,
RESERVED replay evidence 재검증/terminal release, signer call/verification
failure, strict audit failure 후 같은 quote/no-resign retry, incident-hook
failure isolation, PII-free audit redaction, bounded metrics, successful quote와
idempotent replay를 검증한다.


Backend smoke는 injected scenario loading, ephemeral HTTP server의 health/quote
API, fixed-rate pricing, maker signature, monotonic nonce와 numeric amount
거부를 검증한다. CLI smoke는 backend quote request path, 기존 quote-file/서명
검증 경로, `production-onboarding-plan --out` immutable export/overwrite
refusal and `production-onboarding-verify` fail-closed nonzero behavior를 함께
검증한다.

Standalone SDK integration smoke:

```sh
cd services/toolkit
npm test
```

Toolkit smoke는 unified `create`가 생성하는 `library-only`,
`reference-service`, `existing-backend` 세 mode의 manifest, `.env.example`,
vendored `vendor/rfq-service`, optional Docker files, overwrite refusal과
standalone package scripts(`doctor`, `deploy`, `verify`, `test:module`)를
검증한다. Production onboarding smoke는 exact schema/unknown-field rejection,
PII/secret rejection, deterministic Element/Recipe/Manifest/Venue/RFQ calldata,
Safe/operator draft governance/proposal metadata, authority partition, explicit
operator executor metadata, safe-owner target owner checks, stage dependency including governance-delayed signer execution, mandatory active venue/inventory
gates, RFQ activation coherence, AMM-only coherent mode, read-only
inventory stage, ACTIVE Manifest field verification, pause gate verification and
pending-vs-active signer and safe-owner target owner mismatch/unavailable and operator role mismatch/unavailable fail-closed behavior를 포함한다. SDK-002 문서 또는 packaging 변경에서는 CLI help, `doctor`,
dry-run `deploy`, `verify`/preflight와 `test-module` command path도 별도로
확인한다.

Generated consumer projects should keep this local gate:

```sh
npm test
```

생성된 프로젝트의 `npm test`는 TypeScript build 후
`corner-store test-module dist/module-conformance.js`를 실행한다. 이 conformance
gate는 custom RFQ pricing/risk/signer/nonce module set이 SDK contract를 만족하는지
검사한다. Signer는 65-byte 형식뿐 아니라 EIP-712 payload에서 configured maker로
복구되어야 한다. 이 gate는 production pricing 품질이나 signer custody를 인증하지
않는다.

Compliance data SDK smoke test:

```sh
cd services/compliance-data
npm ci
npm test
```

TA lot lineage/완납 clock, conservative snapshot, broken-lineage fail-closed,
idempotent person-group commit, rolling volume/holder counts, hash-chain 변조 탐지와
provider-neutral TA/KYC evidence refresh conformance를 검증한다. KYC suite는 exact
subject/identity/asset binding, provider outage/timeout/malformed request·result/stale/future fail-closed,
revoked/ineligible/sanctions handling, deterministic evidence hash, replay/conflict,
recursive PII/unknown schema rejection, PII-free audit/error output, strict audit-before-publish fail-closed, production store return revalidation, bounded incident hook failure and
"no cached success on outage" behavior를 포함한다.

Deployment Studio smoke test:

```sh
cd services/deployment-studio
npm ci
npm test
```

Studio smoke는 workspace path confinement, Toolkit/integration validation,
secret-shaped scenario key rejection, HttpOnly session mutation guard,
operator-injected broadcast guard, server-side doctor/dry-run evidence,
deploy progress, artifact/verify/activation/handoff와 UI wiring을 검증한다.
검증 상태는 재시작 후 유지되며 config/integration/scenario/artifact hash가
바뀌면 보수적으로 무효화되어야 한다.

Vendored deploy tool 테스트:

```sh
cd tools/deploy-v3
yarn test
```

### Integration Tests

Foundry integration tests는 mock/ERC-3643 fixture를 사용해 regulated swap,
multi-Recipe, surveillance, emergency pause와 invariant path를 검증한다.
`tools/deploy-v3`의 Corner Store profile은 unit test로 구성과 순서를 검증하며,
canonical Uniswap v3 integration test는 같은 pinned package artifact로 factory와
pool을 배포해 CREATE2, mint/swap callback과 실제 ERC-3643 transfer를 검증한다.
따라서 fresh checkout에서는 `tools/deploy-v3`의 `yarn install --frozen-lockfile`이
먼저 필요하며 `scripts/check.sh`가 이를 자동 bootstrap한다.

자동화된 live Anvil deployment/E2E는 `scripts/e2e-anvil.sh`로 제공된다(아래 E2E
Tests 및 `docs/demo.md` 참조).

### E2E Tests

live Anvil E2E는 `scripts/e2e-anvil.sh`로 자동화되어 있다(features `E2E-001`,
`DEMO-002`). 이 러너는 fresh Anvil 노드에 선택한 asset profile의 전체 스택을
배포(`script/DeployStack.s.sol`)하고 7-scenario demo suite를 구동
(`script/DemoScenarios.s.sol`)한다. 이어서 CLI로 선택 profile을 재온보딩하고
RFQ demo backend를 띄워 quote를 요청한 뒤 Router/RFQAdapter를 통한 성공과
revoked-maker 실패까지 실행한다.
단계별 observable evidence와 `PASS`/`FAIL`을 출력하며 하나라도 실패하면 non-zero로
종료한다. 실행 방법과 scenario 순서, reason code 재계산, mock/real 구분은
`docs/demo.md`(demo runbook)를 참조한다.

```sh
scripts/e2e-anvil.sh            # BUIDL-like 배포 → scenario → backend RFQ → teardown
scripts/e2e-anvil.sh --profile reg-d
scripts/e2e-anvil.sh --keep     # 이후 Anvil을 계속 실행(인터랙티브 demo)
```

이 러너가 커버하는 최소 E2E는 다음을 포함한다.

- 허용된 거래의 실행 성공
- applicable Recipe 중 하나의 Element 거부에 따른 원자적 실패
- RecipeBinding의 REQUIRED/PATH/FLAG truth table과 stateful commit 중복 방지
- Manifest lifecycle, version과 supported engine binding
- ERC-3643 transfer 거부의 원자적 실패
- 지원 Router 경로와 직접 venue 호출의 보장 차이
- `UNKNOWN`, explicit `UNREGULATED` public path와 regulated path의 보장 차이
- unregulated-regulated mixed pair의 regulated Manifest 적용
- regulated-regulated pair의 양쪽 Manifest/Recipe 누적 적용
- Adapter 등록·교체·중단 시 Router와 compliance policy 불변성
- `buidl-like | reg-d` asset profile 선택과 동일한 protected execution path
- backend-signed quote의 CLI 요청과 Router/RFQAdapter settlement
- backend/UI 매수(결제 자산→RWA)와 매도(RWA→결제 자산)의 실제 양방향 settlement
- 매도 후 taker RWA 감소와 결제 자산 증가
- backend quote 발급 후 maker revoke 시 fill-time 거부
- RFQAdapter 직접 호출의 status `0` receipt와 RWA/결제 자산 잔액 불변
- quote 이후 maker revoke 거부의 실패 receipt와 잔액 불변
- 적격 A/B와 비적격 wallet fixture의 실제 QP pre-check
- 비적격 taker-bound signed quote의 Router fill-time compliance 거부
- quote 이후 QP claim 만료 거부의 reasonCode, 실패 receipt와 잔액 불변
- Admin QP fixture 변경과 원상복구
- scenario JSON에서 wallet/표시값/최소금액/시간 조건 주입
- scenario JSON에서 Anvil account, 초기 investor/maker/pool 물량, 양방향 기본
  거래량, TTL과 mock pricing 주입
- 배포 artifact의 scenario hash와 backend 입력 일치 검증
- quote 발급 당시 적격인 투자자의 QP freshness 만료
- 아직 TTL이 남은 동일 quote의 Router fill-time `FAIL_QP_CLAIM_EXPIRED` 거부
- temporal scenario 후 injected baseline QP 상태 복원

### Integrated Check

```sh
scripts/check.sh
```

이 명령은 현재 저장소에서 지원하는 format, lint, build와 test를 순서대로 실행한다.
현재 포함 범위는 Foundry fmt/lint/build/test, RFQ SDK·demo backend·CLI·Toolkit,
generated standalone consumer smoke, Compliance Data SDK,
Deployment Studio, Operator API/dashboard smoke, vendored deploy-v3 test와 whitespace check다. GitHub
Actions도 동일한 스크립트를 실행한다. Node 서비스는 lockfile 기반 `npm ci`를
사용하고, vendored deploy-v3는 `yarn.lock` 기반 설치 후 테스트한다.

RFQ SDK smoke는 reference와 custom pricing/risk/signer/nonce 세트에 동일
conformance contract를 적용한다. 이 suite는 capability, base-unit quote,
typed-data binding, expiry, module 호출 순서, risk fail-closed, signature shape와
maker-scoped monotonic nonce를 검사한다. Toolkit smoke는 두 scaffold mode,
overwrite 거부, environment-name-only manifest와 secret-free `.env.example`을
검증한다. Fresh directory integration check는 vendored SDK에 prebuilt `dist`가
없는 상태에서 두 scaffold의 `npm install && npm test`를 실행한다.

## Manual Verification

문서-only 변경은 다음을 추가 확인한다.

- source-of-truth 링크가 유효한가
- 같은 개념이 서로 다른 이름이나 책임으로 설명되지 않는가
- 확정된 결정과 열린 질문이 구분되는가
- `git diff --check`가 통과하는가

## Completion Rule

feature의 `Verification`에 적힌 모든 검증이 통과해야 `passing`으로 변경할 수 있다.
실행할 수 없는 검증은 생략하지 말고 `PROGRESS.md`에 원인과 대체 검증을 기록한다.
