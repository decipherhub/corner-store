# Corner Store Development Roadmap

> 제품 범위는 [`MVP-v2-multi-venue.md`](./MVP-v2-multi-venue.md), 책임과 trust
> boundary는 [`architecture/`](./architecture/README.md)를 기준으로 한다.
> 이 문서는 구현 순서, 검증 기준과 blocker만 관리한다.

## Current State

완료:

- SDK를 주 제품, Corner Store를 reference DEX로 정의
- Element, Recipe, Manifest, Operator 이름 기반 4-Layer 모델 확정
- cumulative multi-Recipe와 Asset Compliance Manifest 아키텍처 반영
- ERC-3643/ONCHAINID 외부 trust boundary 정의
- AMM, RFQ와 Order Book Adapter 경계 정의
- Uniswap v3 vendored deployment profile 분리와 단위 테스트
- Foundry product scaffold와 공통 type/error/event/interface
- Element/Recipe registry와 illustrative compliance elements/recipes
- Token policy registry와 bounded RecipeBinding(required/path/flag) evaluation
- generic ExecutionRouter, VenueRegistry, VenueSelector와 공통 Adapter interface
- AMM reference adapter와 RFQ v1 reference settlement adapter
- pinned canonical Uniswap v3 factory/pool CREATE2, liquidity callback와
  Router-protected ERC-3643 buy/sell integration test
- RFQ quote signer SDK, local MVP backend와 CLI/Router settlement flow
- `buidl-like`/`reg-d` profile별 live Anvil deployment, Toolkit preflight/checkpoint와
  protected AMM/RFQ E2E
- versioned Toolkit config, validation/simulation, deploy/test/onboard/checkpoint와
  multisig proposal handoff
- Element/Recipe/Adapter/provider template metadata와 required-input validation
- versioned RFQ pricing/risk/signer/nonce capability contract, shared conformance
  suite와 reference/existing-backend scaffold
- read-only Operator API, finality-aware/file-backed event index와 safe
  multisig-oriented dashboard
- central global/asset/venue pause enforcement와 delayed unpause, versioned
  Manifest history 및 delayed semantic update control plane
- provider-neutral compliance data SDK, attested acquisition snapshot과
  hash-chain rejection/surveillance audit foundation
- Foundry unit/integration tests와 전체 developer/operator service 및 vendored
  deploy-v3를 검증하는 repository-wide GitHub Actions gate

남은 주요 작업:

- canonical recipe-key alias와 per-element enforcement override compiler
- production legal Element 기준과 승인된 operator 입력 모델
- 실제 Securitize/TA provider adapter, production WORM/indexer와 amount-specific
  lot allocation 정책
- ADR-009 기준 RFQ maker authorizer, durable nonce/idempotency, production
  pricing/inventory-risk와 endpoint hardening 구현
- partial fill은 새 quote/adapter version 설계 이후 구현
- production Uniswap v3 pool/LP onboarding과 unified deployment orchestration
- Order Book matching/custody/surveillance 모델
- production TLS, secret rotation, 실제 multisig provider와 live RPC
  finality/recovery 운영
- medium warning budget, independent security analysis와 production security/legal review

## Delivery Strategy

```mermaid
flowchart LR
  P0["Phase 0<br/>Foundation"] --> P1["Phase 1<br/>SDK Contracts"]
  P1 --> P2["Phase 2<br/>Manifest & Multi-Recipe"]
  P2 --> P3["Phase 3<br/>Execution Integration Kit"]
  P3 --> P4["Phase 4<br/>Reference Venue Proof"]
  P4 --> P5["Phase 5<br/>Operations"]
```

첫 testnet proof의 종료점:

1. mock ERC-3643 자산에 `ACTIVE` Manifest를 등록한다.
2. transaction context에 따라 복수 Recipe가 활성화된다.
3. required Recipe는 cumulative AND, 명시된 path option은 group OR로 평가되고
   non-blocking finding은 flag로 분리된다.
4. 허용된 engine의 Adapter로만 실행된다.
5. Corner Store 또는 ERC-3643 거부 시 전체 settlement가 원자적으로 실패한다.
6. 명시적 `UNREGULATED` 일반 ERC-20 public path에는 4-Layer 보장이 없고,
   `UNKNOWN` 자산은 거부됨을 테스트한다.
7. mixed pair와 regulated-regulated pair에서 양쪽 Manifest의 적용 정책을 모두
   평가한다.

법률 연구의 41개 Element 전체 구현은 첫 proof의 완료 조건이 아니다. 첫 proof는
법적 정확성을 주장하지 않는 **축약 시뮬레이션 Recipe**로 구조를 증명한다.

## Phase 0 — Foundation

### Goal

Foundry template를 SDK와 reference integration 개발 기반으로 교체한다.

Status: implemented for the current reference proof.

### Deliverables

- 디렉터리와 dependency direction
- 공통 context, IDs, errors와 events
- interface-only SDK package boundary
- mock token, identity, claim, Element와 Adapter fixture
- CI, formatter, build와 test command

### Completion

- template 코드 없이 컴파일된다.
- SDK 공통 컴포넌트가 Uniswap 또는 Corner Store-specific implementation에
  의존하지 않는다.
- mock 허용·거부와 external transfer failure를 재사용할 수 있다.
- `scripts/check.sh`와 CI가 통과한다.

### Blockers

- upgradeability는 별도 결정 전 도입하지 않는다.
- package 배포 형식은 Solidity source/library 형태를 우선하고 TypeScript SDK는
  실제 소비자 요구가 생길 때 결정한다.

## Phase 1 — SDK Contracts

### Goal

Element와 Recipe의 portable interface, registry와 version semantics를 구현한다.

Status: implemented for illustrative/reference Elements and Recipes; production
legal criteria remain approval-gated.

### Deliverables

- `IElement`와 immutable/versioned Element reference
- `IRecipe`와 Recipe metadata/activation interface
- `ElementRegistry`와 `RecipeRegistry`
- transaction compliance context
- reason code와 deterministic evaluation result
- illustrative Element/Recipe fixture

### Completion

- 하나의 Element는 하나의 사실만 평가한다.
- Recipe는 하나의 법률효과와 Element subset을 표현한다.
- 기존 Element를 여러 Recipe가 재사용할 수 있다.
- invalid, inactive 또는 unknown version은 regulated evaluation에서 거부된다.
- 연구에서 제안된 Element 수나 법률 기준값을 production truth로 하드코딩하지
  않는다.

### Interface Decision Gate

IElement 최초 확정 전에 stateful Element commit hook을 결정한다.

선택지:

- check-only interface 후 별도 state transition contract
- `check`와 `commit` 분리
- optional capability interface

어떤 선택이든 failed settlement가 누적 상태를 남기면 안 된다.

## Phase 2 — Manifest and Multi-Recipe

### Goal

자산별 규제·engine binding과 cumulative multi-Recipe evaluation을 구현한다.

Status: bounded RecipeBinding evaluation, validated lifecycle, monotonic
history/version과 timelocked semantic update control plane이 구현됨.

### Deliverables

- `ManifestCore`와 Manifest registry/resolver
- proposal, approval, activation, suspension, retirement lifecycle
- Recipe set, resale path, supported engine과 version binding
- issuer-side coverage representation
- applicable Recipe identification
- REQUIRED AND, path-group OR/group 간 AND와 FLAG_ONLY finding
- selected-path stateful commit와 duplicate Element commit 방지
- structured `ComplianceDecision`
- preview/evaluate API와 audit events

### Completion

- 한 Manifest에 복수 Recipe를 binding할 수 있다.
- transaction context에 따라 Recipe subset이 활성화된다.
- 모든 applicable required Recipe가 AND로 평가되고 각 path group은 하나 이상의
  통과 경로를 요구하며 FLAG_ONLY 실패는 실행을 막지 않는다.
- duplicate Element 최적화가 결과 의미를 바꾸지 않는다.
- decision이 actor, asset, amount, engine/venue, Manifest version, nonce와 expiry에
  바인딩된다.
- `ACTIVE` Manifest의 invalid reference와 unsupported engine은 거부된다.
- `UNKNOWN`, `UNREGULATED` pass-through와 regulated evaluation 결과를 API와
  event에서 구분한다.
- 양쪽 모두 명시적 `UNREGULATED`일 때만 pass-through하고, 하나 이상의 regulated
  자산이 있으면 양쪽 regulated Manifest의 applicable Recipe를 합쳐 평가한다.
- full off-chain manifest hash와 on-chain core의 version 변경이 추적된다.

### Design Decisions

1. acquisition/lot source와 reject audit seam은 ADR-008/D012로 결정되고 DATA-001
   foundation으로 구현되었다.
2. Manifest scope: token 또는 token×venue
3. issuer coverage encoding
4. canonical recipe-key alias와 per-element enforcement override compiler

실제 Rule 144 production 활성화는 provider API, lot allocation과 운영 저장소가
검증될 때까지 보류한다.

## Phase 3 — Execution Integration Kit

### Goal

제3의 DEX도 재사용할 수 있는 generic Router와 Adapter 등록·dispatch 경계를
구현한다.

Status: implemented for the reference proof with AMM and RFQ adapters.

### Deliverables

- `ExecutionRouter`
- `VenueRegistry`와 최소 deterministic selector
- 공통 Adapter interface
- Adapter registration/dispatch
- nonce, deadline와 replay protection
- execution events
- `UNKNOWN`, explicit `UNREGULATED`와 regulated path의 명시적 분기

### Completion

- 미등록·중단 Adapter, venue와 operator로 실행할 수 없다.
- settlement 직전에 Manifest와 actor/operator 상태를 평가한다.
- preview decision을 실행 권한으로 재사용할 수 없다.
- request와 decision mismatch, expiry와 nonce reuse가 거부된다.
- Router에 의도하지 않은 자산 잔액이 남지 않는다.
- 직접 venue 호출에는 Corner Store 4-Layer 보장이 없음을 테스트한다.
- mock Adapter를 교체·등록·중단해도 Router와 compliance policy 코드를 수정하지
  않는다.

### Non-goals

- best execution
- order splitting
- venue-native matching
- production operator governance

## Phase 4 — Reference Venue Proof

Corner Store reference DEX의 구체 Venue는 공통 SDK/Router 기반 위에서 독립적으로
구현한다.

### 4A. Uniswap v3 AMM

Status: Router-protected reference adapter, MockPool live demo와 pinned canonical
Uniswap v3 core factory/pool integration E2E가 구현됨. production pool/LP onboarding과
unified deploy command는 후속 작업이다.

Deliverables:

- `UniswapV3Adapter`
- factory, pool과 callback verification
- Manifest engine/venue binding
- CREATE2 pool identity preflight
- Corner Store deploy-v3 profile integration
- automated Anvil deployment and swap test

Completion:

- 허용 Manifest/Recipe scenario의 swap이 성공한다.
- unsupported engine, failing Element와 ERC-3643 transfer가 전체 swap을 되돌린다.
- spoof callback과 미등록 pool이 거부된다.
- Adapter balance invariant가 유지된다.
- 명시적 `UNREGULATED` 일반 ERC-20 public path가 별도 보장 수준으로 성공한다.
- unregulated-regulated mixed pair와 regulated-regulated pair가 양쪽 Manifest
  규칙을 모두 적용한다.

Blockers:

- fee tier와 Pool IdentityRegistry onboarding
- 해당 시나리오의 AMM 허용에 대한 법률 검토

### 4B. RFQ

Status: v1 reference settlement, backend SDK and local MVP demo backend
implemented. ADR-009 accepted the production dealer/settlement baseline;
implementation prerequisites remain.

Deliverables:

- EIP-712 quote
- signature, nonce, expiry와 taker binding
- Router-only RFQ Adapter와 latest compliance evaluation
- 최소 TypeScript quote signer reference service
- RFQ backend SDK interface와 local reference example 계획은 `docs/product-specs/rfq-backend-sdk-and-demo.md`를 따른다.
- local MVP demo backend는 SDK와 live-Anvil artifact/CLI를 재사용한다.
- partial fill policy는 v1 non-goal로 유지

Completion:

- invalid signer, replay와 expired quote가 거부된다.
- Manifest/Recipe 또는 operator 변경이 fill에 반영된다.
- signed quote와 request amount가 정확히 일치한다.

Production implementation prerequisites:

- ADR-009 maker-authorizer와 regulated-quantity cap migration
- durable nonce/idempotency와 external signer integration
- production pricing/inventory-risk, auth/audit/monitoring implementation
- partial fill은 새 quote/adapter version의 별도 설계·검토

### 4C. Order Book

Deliverables:

- signed order, cancellation, expiry와 fill accounting
- matcher/operator validation
- Order Book Adapter와 settlement event

Completion:

- cancelled/expired order를 fill할 수 없다.
- 각 fill 직전에 최신 Manifest evaluation을 수행한다.
- total fill이 order amount를 초과하지 않는다.

Blockers:

- on-chain/off-chain matching
- custody/escrow
- surveillance responsibility

## Phase 5 — Deployment and Operations

### Goal

SDK와 reference DEX를 반복 배포하고 Manifest/권한 상태를 검증 가능하게 운영한다.

Status: reference/demo Toolkit, checkpoint/proposal handoff, Operator API/indexer,
dashboard, metrics와 incident runbook은 구현됨. production hosting, key custody,
실제 multisig provider와 chain별 recovery 정책은 후속 작업이다.

RFQ integration Toolkit은 core SDK와 reference app을 분리하고 선택형 Compose
export를 제공한다. production module의 운영 품질과 secret custody는 integrator
책임이며 conformance 통과만으로 인증되지 않는다.

### Deliverables

- integrated deployment orchestrator
- deployment manifest와 schema validation
- source/code/config verification
- role handoff와 multisig integration
- indexer, monitoring와 incident runbook
- Manifest proposal/approval workflow

### Completion

- clean environment 배포와 partial failure recovery가 재현된다.
- deployment manifest와 on-chain code/config/roles가 일치한다.
- deployer 임시 권한이 제거된다.
- Manifest activation/suspension incident drill을 수행한다.
- reject logging 결정에 따른 audit path를 검증한다.

Reference/demo evidence:

- `toolkit-init` → validate/simulate/preflight/deploy/test/onboard/checkpoint/proposal
  workflow가 같은 versioned config를 사용한다.
- `buidl-like`와 `reg-d` live E2E가 7/7 scenario, protected RFQ settlement와
  revoked-maker rejection을 검증한다.
- Operator API/dashboard는 read-only이며 signer material이나 transaction endpoint를
  노출하지 않는다.
- incident containment/recovery 절차는 [`operations/incident-response.md`](./operations/incident-response.md)를 따른다.

### Blockers

- production chain
- operator와 legal responsibility
- governance/key management
- production security and legal review

## Near-Term Issues

가까운 후속 이슈:

1. `#65 feat(rfq): add versioned maker authorizer and regulated-amount cap`
2. `#66 feat(rfq): add durable nonce/idempotency reference adapter`
3. `#67 feat(rfq): add production module audit envelope and service hardening`
4. `feat(compliance): RecipeBinding 기반 production Asset Compliance Manifest schema/migration`
5. `feat(compliance): verified TA provider adapter와 amount-specific lot allocation`
6. `feat(amm): production pool/LP onboarding과 unified deployment 연결`
7. `feat(orderbook): matching/custody/surveillance 모델 결정 후 Order Book adapter 구현`
8. `ops(production): TLS, secret rotation, 실제 multisig provider와 live RPC
   finality/recovery 구현`
9. `security: medium warning budget, independent analysis와 production review`

## Decision Backlog

| 결정 | 영향 Phase | 결정 전 기본값 |
| --- | --- | --- |
| production TA provider/API | 2 | mock provider + conservative snapshot만 사용 |
| amount-specific lot allocation | 2 | 모든 current lot가 mature해야 통과 |
| Manifest scope | 2 | 결정 전 external API와 storage 확정 금지 |
| Manifest 공개 범위 | 2, 5 | full document는 off-chain, 공개 필드는 미정 |
| production WORM/retention provider | 2, 5 | local tamper-evident log만 사용 |
| initial engine/scenario | 4 | 법률 검토된 illustrative scenario만 활성 |
| production operator/governance | 5 | test-only admin, production 배포 금지 |

## Definition of Done

각 phase는 다음 조건을 모두 만족해야 완료다.

- 관련 interface와 invariant가 문서화됨
- unit/integration/E2E 중 해당 layer 검증 통과
- 보안·권한·replay·failure path 검증
- current source-of-truth와 구현 용어가 일치
- 열린 법률 결정을 확정된 코드 규칙처럼 표현하지 않음
- `scripts/check.sh` 통과
