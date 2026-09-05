# Features

## State Rules

- `not-started` → `active`: 해당 feature 작업을 시작할 때
- `active` → `passing`: 모든 Verification이 통과했을 때
- `active` → `blocked`: 외부 정보나 결정이 없어 진행할 수 없을 때
- `blocked` → `active`: 차단 사유가 해소되었을 때

동시에 하나의 feature만 `active` 상태로 둔다.


## PORTAL-004 — Stateful Portfolio and Asset Operations

### Behavior

- RFQ 체결 완료 시점에 주문 수량·가격·수수료·거래 ID를 단 한 번 저장하고,
  동일한 browser state에서 홈 요약, 내 자산, 거래 내역과 발행사 자산 현황이
  같은 체결 결과를 읽는다.
- 선택한 거래 가능 자산의 반복 매수는 보유 수량과 평가액을 누적하며 새로고침·직접 화면 이동 후에도
  localStorage 기반 demo state를 유지한다. 기존 PORTAL-003 state는 보수적으로
  마이그레이션한다. 완료된 ABCF 체결 또는 기존 ABCF 보유 상태는 발행사 운영
  화면에서도 해당 자산을 활성 자산으로 노출한다.
- Figma 시드처럼 초기에는 KTB/MMF만 거래 가능하고 KLM/ABCF는 자산별 자격이
  없으며, ABCF 자격 승인이 KLM까지 해제하지 않는다. 각 거래 가능 자산의
  `거래하기`는 해당 자산 주문 화면과 journal로 연결된다.
- 발행사 홈과 자산 현황에서 전체 주문을 일시정지·재개할 수 있고, 그 상태는
  투자자 거래 목록·주문 화면에 즉시 반영되어 자격 보유 자산의 신규 quote/fill을
  차단한다. 자격 미보유 자산은 `거래 자격 없음` 상태를 유지한다.
- 일시정지와 재개 이력을 PII-free browser-only 운영 기록으로 표시하고 실제
  operator API, signer, RPC 또는 온체인 pause 권한과 혼동하지 않는다.

### Verification

- model regression passed: exact settlement accounting, duplicate completion
  idempotency including pending-order replay, repeated purchase accumulation,
  legacy state migration, pause normalization and pending-order cancellation
- product portal smoke, JavaScript syntax and `git diff --check`: passed
- headless Chrome 1440x900 walkthrough: 19 assertions passed across buy → completion
  → holdings/history/home/issuer metrics, pause cancellation, issuer pause → investor
  blocked order → issuer resume; four visual checkpoints reviewed
- Figma follow-up: fresh state keeps KLM/ABCF unavailable, KTB/MMF and qualified
  ABCF route to their own order context, ABCF qualification does not unlock KLM,
  KLM qualification remains asset-scoped, and issuer-visible global pause disables only
  qualified assets; 23 Chrome assertions
  and fresh investor/issuer 1440x900 screenshots reviewed
- repository-wide `scripts/check.sh`: passed in PR CI with Foundry 870/870, all
  service smoke tests and vendored deploy-v3 10/10
- current tree `scripts/check.sh`: passed with Homebrew Node 24 after the two unrelated
  pre-existing Solidity formatting drifts were temporarily formatted and restored
- Anvil/GIWA E2E not rerun: browser-only state/UI changes do not touch contracts,
  deployment, RPC or testnet paths

### State

passing


## PORTAL-003 — Figma Visual Parity and Stable Demo Identity

### Behavior

- 제공된 1440x900 Figma PNG를 기준으로 투자자·발행사 핵심 화면의 정보 구조,
  spacing, card/list layout, action hierarchy와 상태 표현을 정렬한다.
- 투자자 계정은 항상 `Robin / 0xB0B7...91C4`, 발행사 계정은 항상
  `ABC 자산운용 / Peter`로 표시하며 실제 wallet/SSO 연결 없이도 완결된 demo
  session처럼 보인다.
- production-like integration facade는 유지하되 Figma의 핵심 화면 hierarchy를
  밀어내지 않고 account/evidence detail 안에서 제공한다.

### Verification

- `npm test --prefix services/product-portal-demo`: passed
- Chrome 1440x900 reference-image comparison: investor home/trade/qualification/order/
  completion and issuer home/basic/rules/evidence/review/live passed
- Chrome 1440x720 reduced-height regression: bottom investor/issuer identity remains
  visible inside the fixed viewport sidebar
- Chrome 1440x720 direct-route regression: `#/investor/qualification` and legacy
  `#/investor/provider` both render the qualification page without opening the
  provider modal; only the explicit `인증 받기` action can open it
- `scripts/check.sh`: passed under installed Node 24 with Foundry 870/870, all
  service smoke tests and vendored deploy-v3 10/10; two unrelated pre-existing
  Solidity formatting drift files were temporarily formatted under a restoration
  trap and restored byte-for-byte
- `git diff --check`: passed
- Anvil/GIWA E2E not rerun: browser-only HTML/CSS/model changes do not touch
  contracts, deployment, RPC or testnet paths

### State

passing


## PORTAL-002 — Production-like Demo Integration Facades

### Behavior

- 실제 외부 권한이나 transaction을 사용하지 않으면서 wallet session, KYC/TA
  evidence, multi-dealer RFQ matching, quote signature verification과 on-chain
  settlement progress를 완성된 제품 수준의 sandbox UI로 표현한다.
- 투자자 파일 처리와 발행사 일곱 evidence modal은 서로 다른 입력·진행·성공 상태를
  가지며 PII/credential은 저장하거나 전송하지 않는다.
- 기존 Figma layout, `INTERACTION_SPEC.md` route/timer와 PORTAL-001 browser-only
  trust boundary를 유지한다.

### Verification

- `npm test --prefix services/product-portal-demo`: passed
- Chrome CDP investor/issuer facade walkthrough: 22 assertions passed
- Chrome 1440x900 visual review: quote, wallet, sanctions, investor completion,
  qualification approval and issuer activation passed; completion and activation
  action rows share a baseline and centered approval actions share a width
- Full `scripts/check.sh`: passed with Foundry 870/870, all service smoke and
  deploy-v3 10/10 after temporarily formatting the two known pre-existing drift
  files under a restoration trap; the original files were restored byte-for-byte
- `git diff --check`: passed
- Anvil/GIWA E2E not rerun: browser-only facade code does not change contracts,
  deployment, RPC or testnet paths

### State

passing


## PORTAL-001 — Figma Investor and Issuer Product Demo

### Behavior

- `INTERACTION_SPEC.md`와 Figma `[디자인] 투자자 흐름` / `[디자인] 발행인 흐름`을
  1440px desktop reference demo로 구현한다.
- 투자자 자격 신청, 인증기관/파일 제출 시뮬레이션, RFQ 견적·체결 상태와 발행사
  기본 정보, 발행 조건, 증빙 준비, 심사, 자산 현황을 각각 재현한다.
- `ABCF`는 Figma catalog처럼 처음부터 보이고, 발행사에서 거래를 시작하면 동일
  browser origin의 투자자 화면에 activation 알림이 반영되는 cross-flow를 제공한다.
- 실제 wallet, KYC/TA provider, 파일 전송, 법률 판단, RFQ signer 또는 온체인
  settlement와 분리된 reference/mock UI로 유지한다.

### Verification

- `npm test --prefix services/product-portal-demo`: passed
- Chrome 1440x900 render: investor home, issuer rules and investor order passed;
  Figma 28x28 avatar and 22x22 order handle geometry verified
- Chrome CDP interaction walkthrough: investor qualification/provider/file/review,
  minimum order/quote/fill/post-trade and issuer rules/review/cross-flow passed
- Full `scripts/check.sh`: passed with Foundry 870/870, all service smoke and
  deploy-v3 10/10 after temporarily formatting the two known pre-existing drift
  files under a restoration trap; the original files were restored byte-for-byte
- Direct current-tree `scripts/check.sh` remains blocked at `forge fmt --check` by
  the pre-existing `script/DeployProductionCore.s.sol` and
  `script/DemoScenarios.s.sol` drift; PORTAL-001 does not modify either file
- `git diff --check`: passed
- Anvil/GIWA E2E not rerun: this feature adds a browser-only mock and changes no
  contract, deployment, RPC or testnet path

### State

passing


## CORE-005 — Compliance Core Production Hardening

### Behavior

- Element registrations are immutable per `bytes32 elementId`, pin implementation
  metadata/version hashes and store a default enforcement action for compiled
  manifest plans.
- Recipe registration now supports canonical normalized aliases, domain-separated
  `bytes32 recipeKey` derivation and legacy numeric aliases without dynamic
  runtime alias lookup. Alias/key collisions and version overwrite attempts are
  rejected.
- `TokenPolicyRegistry` compiles bounded per-binding Element enforcement rules at
  manifest registration/update time. Normal onboarding is strengthen-only:
  `FLAG_ONLY < OPERATOR_REVIEW < BLOCK`; `FORCE_FLAG_ONLY` is accepted only for
  Elements whose immutable default is already `FLAG_ONLY`.
- The Engine evaluates compiled plans and propagates an Element's exact nonzero
  `reasonCode`; recipe-scoped code `1` is only the fallback when an Element
  returns zero.
- Production onboarding Toolkit/CLI support v2 canonical recipe alias/key,
  Element default enforcement, bounded overrides, compiled plan commitments and
  dual-mode verification while preserving legacy v1 configs/calldata ordering.

### Verification

- `npm test --prefix services/toolkit`
- `npm test --prefix services/cli`
- Targeted Forge registry tests: 86 passed
- Targeted Engine tests: 37 passed
- Targeted RegD integration tests: 6 passed
- Full `forge test --offline`: 870/870 passed
- Isolated `/tmp` full `scripts/check.sh`: passed after formatting only the
  pre-existing `script/DeployProductionCore.s.sol` and
  `script/DemoScenarios.s.sol` drift in the copy and running fresh `npm ci` for
  copied stale `node_modules`; this full check was before the final
  Solidity-only bijection guard, and post-fix full `forge test --offline`
  870/870 passed
- Full Anvil E2E: `buidl-like` and `reg-d` passed with 7/7 scenarios and RFQ
  flows
- Original-tree `scripts/check.sh` remains blocked by pre-existing formatting
  drift in `script/DeployProductionCore.s.sol` and `script/DemoScenarios.s.sol`.
  `DemoScenarios` has only the scoped G005 reason-contract edit here and was not
  broad-formatted.
- `git diff --check`

### State

passing


## DEPLOY-003 — Production ERC-3643 Asset Onboarding

### Behavior

- Production onboarding is separated from local Anvil/demo `toolkit-onboard` and
  from core deployment. A versioned `corner-store.production-onboarding.json`
  declares the exact existing ERC-3643 token, IdentityRegistry/Compliance wiring,
  Corner Store registries/adapters, PII-free legal package hash, Elements, Recipes,
  Manifest, RecipeBinding[], governance Safe metadata, explicit operator executor,
  active venues, RFQ makers, signer delegates and read-only inventory requirements.
- The Toolkit validates the onboarding file with exact-object schemas, rejects
  unknown fields, duplicate addresses/ids, unsupported codeHash keys, signer-secret
  shaped fields, raw contact PII and incoherent RFQ/inventory relationships.
- `production-onboarding-plan` renders deterministic Element/Recipe/Manifest,
  venue, maker, signer schedule and owner-only delayed signer execution calldata plus Safe-compatible unsigned drafts.
  It uses collision-free stage IDs, partitions Safe-owner and operator-authority
  drafts, includes Safe/required approval/proposal identity on Safe drafts and
  explicit executor/proposal identity on operator drafts, separates governance-owner/governance-delayed/operator
  authority, refuses output overwrite, and never signs, broadcasts, transfers
  tokens or generates ERC-20 approvals. Inventory appears as a read-only
  verification dependency before service open.
- `production-onboarding-verify` uses RPC read calls only and fails closed on
  unavailable or mismatched ERC-3643 wiring, Identity Registry dependencies,
  Element/Recipe registrations, Manifest hash/fields/bindings, ACTIVE Manifest
  declarer/approver, governance Safe ownership of safe-owner targets, global/asset/venue pause gates, venue config, TokenPolicyRegistry/RFQAdapter operator authorization, maker approval,
  signer delegate activation and inventory balance/allowance minima. Pending signer
  authorization is reported but is not production-ready.
- Example onboarding JSON is syntactically valid but uses obvious placeholder
  non-live addresses/hashes; issuer/legal/TA evidence remains an external trust
  boundary and cannot be inferred from a token address.

### Verification

- `npm test --prefix services/toolkit`
- `npm test --prefix services/cli`
- `git diff --check`

### State

passing


## RFQ-005 — Production RFQ Host Hardening

### Behavior

- RFQ production HTTP hosting is separated into `services/rfq-host` instead of
  turning the local Anvil demo backend into a production server. The host wraps
  the durable `RFQQuoteCoordinator` and leaves pricing, risk, signer custody,
  transactional storage, TLS termination and WORM audit infrastructure as
  operator-owned replacement ports.
- `/rfq/quote` validates request size, JSON and schema before authentication. An
  authenticator port returns a principal and exact taker claim, and the host
  binds that normalized taker to the body `taker`; missing/invalid auth returns
  401 and mismatches return 403 without storing raw auth material.
- Rate limiting is a replaceable port with a bounded in-memory reference
  implementation. Limiter keys use hashed principals, and 429 responses include
  `Retry-After`. Oversized requests return 413.
- The host calls coordinator `quoteWithEvidence()`, so the actual pricing result
  and actual risk decision returned inside the durable quote call must carry
  `snapshotId`, `version`, `observedAt`, `validUntil` and availability. Missing,
  stale, future-skewed or unavailable metadata fails closed before nonce
  reservation or signing, and idempotent replay returns persisted evidence
  without provider recall or re-signing. A strict replay of an existing RESERVED
  record revalidates persisted evidence before signing; stale/missing/future/
  unavailable evidence revokes the reservation, releases the lease and burns the
  nonce. Fresh risk `decision: rejected` returns a stable risk rejection before
  reserve/sign without exposing raw risk reason.
- Signer verification failures, stale/unavailable dependencies, auth abuse,
  rate limits and audit sink failures trigger a bounded best-effort incident
  hook. Strict audit is enabled by default and quote issuance fails closed if
  PII-free audit persistence fails.
- Audit events contain hashed principal/request/idempotency identifiers, persisted
  actual coordinator module/snapshot/version metadata, timestamps and on-chain
  identifiers only;
  raw bearer tokens, raw idempotency keys, raw request bodies, signer refs and
  stack traces are excluded. Metrics labels are bounded and do not include
  principals or addresses.
- `/health` exposes only generic service status. Non-loopback public bind is
  refused unless the operator explicitly acknowledges external TLS/trusted-proxy
  termination.

### Verification

- `npm test --prefix services/rfq`
- `npm test --prefix services/rfq-host`
- `npm test --prefix services/rfq-demo-backend`
- `git diff --check`

### State

passing

## RFQ-004 — Durable Quote Coordinator

### Behavior

- RFQ SDK는 기존 demo-friendly quote service를 유지하면서 production 서비스가 교체해
  구현할 수 있는 `QuoteCoordinatorStore` 포트와 `RFQQuoteCoordinator` 경계를 제공한다.
- coordinator는 `(chainId, adapter/verifyingContract, maker)` scope에서 nonce를
  원자적으로 증가시키고, idempotency key hash와 request hash를 durable record에
  저장한다. 같은 key+request는 재시작 후에도 같은 signed quote를 반환하며, 같은
  key의 다른 request는 fail-closed conflict로 거부한다.
- pricing/risk rejection은 nonce와 inventory reservation 전에 종료된다. 새 firm quote는
  nonce, idempotency record와 maker outgoing token inventory lease를 하나의 store
  transaction에서 예약한다. signer 실패, 만료, revoke, finalized fill/cancel은 lease를
  정확히 한 번 해제하고 nonce는 재사용하지 않는다.
- local/single-host reference file store는 Node built-ins만 사용해 restart persistence,
  lock 기반 cross-instance atomicity, concurrent over-reservation 방지를 시연한다. HA
  production은 같은 포트를 operator transactional DB/queue/indexer로 구현해야 한다.
- coordinator는 external signer가 반환한 EIP-712 signature를 로컬에서 검증한 뒤에만
  응답하고, idempotency key와 signer key ref는 durable audit record에 raw value가 아닌
  hash로 저장한다.
- fill/cancel observation은 transaction hash, block number/hash를 기록하고 configured
  confirmation depth 이후 terminal 상태로 확정한다. reorg/noncanonical block은 observed
  상태를 `PUBLISHED`로 되돌리고 lease를 유지한다. Partial fill은 계속 비지원이다.

### Verification

- `npm test --prefix services/rfq`
- `git diff --check`

### State

passing

## STUDIO-002 — Localized Evidence-Gated Workflow

### Behavior

- Deployment Studio는 한국어를 기본으로 제공하고 사용자가 English로 전환한
  선택을 브라우저에 유지한다.
- 설정 저장, Doctor, 배포 계획, 배포, Artifact 검증, DEX 실행 단계는 이전
  단계의 실제 evidence가 존재할 때만 완료로 표시한다.
- 후속 단계 데이터가 남아 있더라도 선행 설정이 저장되지 않았다면 완료 표시와
  실행 버튼을 fail-closed한다.

### Verification

- `npm test --prefix services/deployment-studio`
- `git diff --check`

### State

passing

## DOC-004 — Product Architecture and Technical Whitepaper

### Behavior

- 외부 이해관계자가 Corner Store의 문제 정의, 제품 경계, 정책 조합 모델,
  Router-mediated 실행 보장과 RFQ 통합 구조를 하나의 문서에서 이해할 수 있다.
- 백서는 현재 구현과 production 후속 과제를 분리하고, ERC-3643/ONCHAINID,
  issuer/TA, Corner Store와 운영자의 trust boundary를 과장 없이 설명한다.
- 프로젝트 목적, 대상 통합자, 성공 기준, control/execution plane, 핵심 ABI,
  protocol invariant, adoption path와 architectural trade-off를 명시한다.
- GitBook과 GitHub에서 직접 렌더링할 수 있는 Mermaid diagram으로 system
  context, policy composition, fill-time enforcement, RFQ module과 보호 경계를
  시각화한다.
- ERC-3643, EIP-712와 illustrative legal profile의 공식 1차 자료를 연결하고,
  기술 구현 증거와 법률·운영·production 미검증 범위를 구분한다.
- 루트 README와 문서 인덱스에서 백서에 바로 접근할 수 있다.

### Verification

- 백서의 내부 링크가 모두 존재한다.
- Mermaid code fence와 diagram 종류를 정적 검증한다.
- `forge test --offline --match-path test/unit/compliance/Engine.t.sol`
- `forge test --offline --match-path test/integration/RFQFlow.t.sol`
- `npm test --prefix services/rfq`
- `git diff --check`

### State

passing

## DEMO-015 — RFQ Session History and Targeted Claim Expiry

### Behavior

- My RFQs는 브라우저 세션에서 요청한 firm quote를 덮어쓰지 않고 누적하며,
  taker, 매수/매도 방향, quote payload와 `quoted | accepted | rejected |
  expired` 상태를 개별 RFQ에 유지한다.
- 사용자 화면은 현재 선택한 지갑이 taker인 RFQ만 표시하고, Admin만 현재
  브라우저 세션의 전체 RFQ를 조회한다.
- 과거 RFQ를 다시 선택하면 해당 quote의 방향과 정확한 `amountIn`으로
  Pre-check와 payload review를 다시 수행한다.
- temporal demo는 전역 freshness cap을 줄이지 않고 지정된 투자자 claim의
  `verifiedAt`만 조정한다. Enforcement Case 준비 직후에는 대상도 적격이어야
  하며, 1시간 유효 quote 발급 후 Anvil 시간을 15분 전진했을 때 대상 claim만
  만료되고 다른 적격 투자자는 계속 거래할 수 있어야 한다.
- Maker 화면은 다중 Maker 관리 기능으로 오해되지 않도록, 현재 주입된 단일
  Maker의 승인 철회 후 기존 서명 quote가 거부되는 보안 시연으로 표시한다.
- Admin의 QP 근거·look-through 기록은 operator 트랜잭션 receipt를 기다린 뒤
  block number와 transaction hash를 화면에 표시한다.
- mock pricing impact는 fill 횟수 고정값이 아니라 실제 체결 RWA 수량에
  비례하고 scenario cap을 적용한다.
- 사용자 차트는 전체 기간 하나만 제공하며, fill point의 방향·정확한 체결가·
  수량·시각은 상시 label 대신 hover/focus tooltip으로 표시한다.

### Verification

- `npm test --prefix services/operator-dashboard`
- `npm test --prefix services/rfq-demo-backend`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

## DEMO-014 — RFQ Counter-Amount Preview

### Behavior

- RFQ 생성 화면이 사용자가 입력한 지불 수량과 backend pre-check가 계산한
  반대 페어의 예상 수령량을 함께 표시한다.
- 매수는 qUSD 지불 → BUIDL-like 수령, 매도는 BUIDL-like 지불 → qUSD 수령으로
  현재 선택 방향에 맞춰 단위와 자산을 전환한다.
- 예상 단가는 하드코딩하지 않고 현재 mock pricing과 pre-check의
  `amountIn`/`amountOut`으로 계산한다.
- 입력 변경 중에는 이전 예상치를 즉시 지우고 최신 pre-check 응답 이후에만
  다시 표시한다.

### Verification

- `npm test --prefix services/operator-dashboard`
- `git diff --check`

### State

passing

## DEMO-013 — Deployment-to-DEX Showcase Handoff

### Behavior

- reference DEX demo가 production과 별개의 core 구현을 다시 만들지 않고
  `DeployProductionCore.deployCore()`에서 같은 registry/engine/router/adapter
  stack을 배포한다.
- production core 배포와 demo-only ERC-3643 fixture, mock TA, inventory,
  policy/venue activation을 명시적으로 구분한다.
- versioned showcase config가 profile, scenario, mode와 runtime port를 주입하고,
  plan mode가 사전 준비값과 실행 순서를 transaction 없이 출력한다.
- showcase runner가 core deployment → demo activation → artifact verification →
  asset onboarding → RFQ backend → Operator API/Dashboard 순서로 기존 demo를
  재현한다.
- Deployment Studio에서 reference stack을 배포·검증한 뒤 `Start DEX demo`를
  누르면 두 번째 배포 없이 기존 CLI onboarding을 최초 1회 실행해 선택한 demo
  Manifest/venue를 같은 stack에서 활성화하고, 해당 project의 exact artifact,
  scenario와 배포 RPC로 RFQ backend, Operator API와 Dashboard를 시작한다.
  RPC/artifact가 달라지거나 RFQ venue가 비활성화된 경우 fail closed한다.
- artifact와 UI 문서는 local rehearsal이 production deployment 또는 legal
  onboarding evidence가 아님을 명시한다.

### Verification

- showcase config/plan smoke test
- `forge test --offline --match-path test/unit/deployment/DeployProductionCore.t.sol`
- BUIDL-like RFQ showcase E2E
- Studio deploy → verify → same-artifact DEX handoff integration
- Studio first-start demo onboarding 및 restart idempotency smoke
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- 완료 계획:
  `docs/exec-plans/completed/DEMO-013-deployment-to-dex-showcase-handoff.md`
- production deployment script와 reference demo는
  `ProductionCoreDeployer.deployCore()` 구현을 공유하지만, local Mock TA,
  deterministic account, fixture policy/inventory activation은 production
  evidence로 취급하지 않는다.

## DEPLOY-002 — Public Testnet RFQ Reference Deployment

### Behavior

- 기존 Anvil `DeployStack`과 showcase 경로를 변경하지 않고 공개 EVM
  테스트넷용 RFQ-only reference deployment를 별도 제공한다.
- RPC, chain ID, deployer, governance, operator, maker와 세 investor 주소를
  runtime input으로 받고 deterministic Anvil account를 사용하지 않는다.
- Foundry keystore 또는 Ledger가 deployment transaction을 서명하며 repository
  config와 artifact에는 private key나 credential-bearing RPC를 기록하지 않는다.
- 실제 T-REX ERC-3643/ONCHAINID fixture, BUIDL-like illustrative policy,
  Corner Store Engine/Router/RFQ adapter, mock quote token, actor claim과
  양방향 inventory를 배포·활성화한다.
- maker와 investor allowance는 각 외부 participant signer가 별도 approval
  script로 제출하며 deployer가 대신 승인하지 않는다.
- read-only verifier가 chain/artifact, runtime code, governance ownership,
  operator authorization, Manifest, RFQ venue, maker approval, inventory와
  선택적 allowance를 fail-closed로 검증한다.
- 검증이 끝난 결과만 `deployments/public/`의 append-only artifact로 승격하고,
  named protocol/identity 주소, 전체 transaction receipt 요약과 CREATE contract
  index를 기록해 CLI나 후속 demo가 언제든 동일 배포물을 조회할 수 있게 한다.
- artifact는 credential을 포함하지 않으며 이 배포가 production issuer
  onboarding이나 실제 BUIDL/Securitize 연동이 아니라는 경계를 명시한다.

### Verification

- `forge fmt --check`
- `forge build --offline`
- `forge test --offline --match-path test/unit/deployment/DeployProductionCore.t.sol`
- isolated Anvil에서 external-address deployment broadcast
- participant별 approval broadcast 후 `VerifyTestnetRFQ` readiness 검증
- `scripts/check.sh`
- `bash -n scripts/deploy-testnet-rfq.sh`
- `git diff --check`

### State

passing

### Notes

- 공개 테스트넷의 실제 RPC broadcast와 explorer verification은 대상 네트워크,
  faucet 자금과 explorer credential이 주입될 때 수행한다.
- public-testnet artifact를 소비하는 interactive RFQ demo runtime은 기존
  Anvil backend의 chain-31337 경계를 완화하지 않고 별도 feature로 구현한다.

## DEMO-016 — Artifact-bound Public Testnet RFQ Demo

### Behavior

- 기존 Anvil showcase/backend를 변경하지 않고 검증된
  `deployments/public/*.json`만 source of truth로 사용하는 별도 runtime을
  제공한다.
- 시작 시 artifact chain, contract bytecode, Manifest, Maker와 inventory를
  검증하고 다른 RPC나 Maker key를 fail-closed로 거부한다.
- backend는 RFQ SDK를 사용해 artifact Maker의 firm quote만 서명하며 investor
  private key나 operator 권한을 보유하지 않는다.
- 사용자는 브라우저 지갑으로 input token allowance와 최종 Router transaction을
  직접 서명한다. quote 검토값과 Router `venueData`는 동일 payload를 사용하고,
  체결 시 ComplianceEngine이 최신 상태를 다시 평가한다.
- UI는 deployment lineage/주소, network, token metadata, Manifest/Maker readiness,
  지갑 balance/allowance/QP 상태, pre-check, quote, transaction hash와 block을
  표시한다. host, port, RPC, explorer, artifact, rate와 signer는 runtime input이다.

### Verification

- `npm test --prefix services/testnet-rfq-demo`
- `bash -n scripts/run-testnet-rfq-demo.sh`
- isolated Anvil에서 public artifact deployment + Maker/investor approvals
- `/api/state`, `/api/wallet`, `/api/precheck`, `/api/quote`
- external investor signer의 Router static call + broadcast settlement
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- public testnet Maker key는 disposable fixture key이며 production custody나 HSM
  signer가 아니다.
- local Anvil security showcase는 계속 `scripts/showcase.sh`를 사용한다.

## DEPLOY-001 — Production Deployment Workflow

### Behavior

- production deployment workflow를 local/demo Deployment Studio와 분리하고,
  core-only Foundry script와 Toolkit/CLI operational path로 구현한다.
- ERC-3643 token과 ONCHAINID onboarding을 외부 issuer trust boundary로 다루고,
  Corner Store Manifest activation 전에 token, identity registry, trusted issuer와
  pilot identity evidence를 확인한다.
- Safe address, expected owner count `M`, threshold `N`, owner list, chain ID와
  payload target/calldata를 signing 전에 검증한다.
- production signing은 external signer 또는 Safe-style multisig 경계에서 수행하며
  browser mainnet broadcast와 browser private key 입력은 범위 밖으로 둔다.
- legal-approved Element/Recipe/Asset Compliance Manifest package만 production
  activation 후보가 되며 illustrative demo recipe나 fixture는 production approval로
  취급하지 않는다.
- venue, maker, signer와 inventory activation은 bytecode/role/Manifest/registry
  검증 이후 단계적으로 수행한다.
- dry-run, fork simulation, multisig proposal review와 monitoring/finality evidence를
  production readiness 기록으로 요구한다.
- Deployment Studio는 production config, Safe/ERC-3643 preflight와 signer-free
  plan export까지만 제공하고 production signing/broadcast는 외부 CLI signer
  경계에서 수행한다.
- core deployment artifact는 schema, chain, role, venue flag와 배포 주소를
  기록하며 post-deployment verify가 exact runtime code hash, release provenance,
  ownership, operator와 Router/Engine binding을 fail-closed로 확인한다.
- production config는 approved RPC host, reviewed source commit과 deterministic
  contract bundle hash를 고정하고 deploy 직전에 실제 입력과 재대조한다.

### Verification

- `docs/deployment-production.md` required-content 수동 검토
- README, ARCHITECTURE, docs index, deployment operations, decision, feature,
  progress 문서 간 링크와 용어 교차 검토
- `forge test --offline --match-path test/unit/deployment/DeployProductionCore.t.sol`
- Toolkit, CLI와 Deployment Studio smoke tests
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/DEPLOY-001-production-deployment-workflow.md`
- 이 feature는 production deployment tooling과 runbook을 구현한다. 실제 production
  transaction, Safe proposal execution, legal approval 또는 monitoring live 상태를
  passing으로 주장하지 않는다.

## HE-001 — Harness Baseline

### Behavior

- 새 세션이 저장소만 읽고 현재 상태와 다음 작업을 복구할 수 있다.
- 필수 명령과 완료 조건이 한 곳에서 안내된다.
- feature, progress, decision과 quality 상태가 저장소에 기록된다.
- 전체 검증을 한 명령으로 실행할 수 있다.

### Verification

- `scripts/check.sh`
- `git diff --check`
- Harness 필수 문서와 링크 수동 검토

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/HE-001-harness-baseline.md`
- 제품 아키텍처 내용은 이 feature에서 변경하지 않는다.

## DOC-001 — Imported Architecture Alignment

### Behavior

- imported 문서에서 확정된 제품 방향과 변경 요청을 구분한다.
- 공식 제품 명세가 Compliance Core, Execution Integration Kit, reference DEX와
  4-Layer 모델을 일관되게 설명한다.
- pair 거래에서 양쪽 자산의 classification과 Manifest를 누락하지 않는다.
- 기존 문서의 충돌하는 용어와 가정을 정리한다.
- 열린 설계 결정은 확정된 구현처럼 표현하지 않는다.

### Verification

- 관련 문서 간 용어·책임·흐름 교차 검토
- Markdown 링크 확인
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- 입력 분류: 완료 Exec Plan의 `Input Classification`
- 완료 계획: `docs/exec-plans/completed/DOC-001-imported-architecture-alignment.md`
- 확정 방향과 개발팀이 결정해야 할 change request를 구분해 반영한다.

## FND-001 — Foundry Product Foundation

### Behavior

- Foundry template를 제품 개발 구조로 교체한다.
- 제품 interface, type, error와 mock fixture를 컴파일할 수 있다.
- 이후 compliance와 execution feature가 재사용할 테스트 기반을 제공한다.

### Verification

- `forge fmt --check`
- `forge build`
- `forge test --offline`

### State

passing

### Notes

- 현재 제품 구조는 Compliance Core, Execution Integration Kit, reference adapters와
  Foundry unit/integration fixture를 포함한다.
- production Manifest lifecycle, RFQ dealer/custody, OrderBook은 별도 feature다.

## RFQ-001 — Reference RFQ Settlement

### Behavior

- RFQ가 AMM과 같은 `ExecutionRouter`/Adapter slot에 등록·교체될 수 있다.
- RFQ quote는 maker가 EIP-712로 서명하고 chainId, RFQAdapter, maker, taker,
  token, amount, venue, nonce, expiry에 바인딩된다.
- RFQAdapter는 Router-only로 동작하고 direct adapter bypass를 거부한다.
- 매 fill은 Router의 최신 compliance evaluation 이후 full-fill/exact-taker로만
  settlement된다.
- reference TypeScript service는 quote 생성, expiry/nonce 부여, EIP-712 signing
  요청만 담당한다.

### Verification

- `forge fmt`
- `forge build`
- `forge test --offline --match-path test/unit/execution/RFQAdapter.t.sol -vv`
- `forge test --offline`
- `cd services/rfq && npm test`
- `git diff --check`

### State

passing

### Notes

- Non-goals: partial fill, orderbook, production pricing engine, dealer inventory,
  custody 확장, websocket/order discovery.

## DEMO-001 — BUIDL-like ERC-3643 Demo Asset

### Behavior

- `src/demo/BuidlLikeDemoAsset.sol`이 Giwa MVP용 BUIDL-like asset profile을 제공한다.
- 테스트 fixture가 profile의 이름/심볼로 실제 ERC-3643/T-REX 토큰을 배포한다.
- profile Manifest는 Reg D 506(c) 발행 Recipe와 ICA 3(c)(7) fund Recipe를 동시에 바인딩한다.
- `factsPacked` fund bit가 켜진 자산에서는 BUIDL-like fund Recipe가 A-13 Qualified Purchaser와 minimum investment 검사를 활성화한다.
- BUIDL-like flow test는 실제 Securitize/TA 연결 대신 `MockSecuritizeTA` fixture로 investor facts를 만들고, 그 결과를 ERC-3643 registry와 Corner Store Elements에 sync한다.
- protected Router 경로에서 QP buyer는 체결되고, accredited-only/non-QP buyer는 토큰 이동 전 거절된다.
- sanctioned QP buyer는 token movement 전에 compliance reject된다.
- QP buyer라도 BUIDL-like minimum investment 미만이면 token movement 전에 compliance reject된다.
- expired TA profile은 current eligibility로 sync되지 않고 token movement 전에 compliance reject된다.
- engine-level AI/QP flags가 통과해도 ERC-3643-unverified recipient는 settlement에서 rollback된다.
- QP/규제 로직은 BUIDL 전용 토큰 override가 아니라 Manifest/Recipe/Element에 남긴다.
- DS Protocol/Securitize-style Compliance Service는 profile 문서에서 adapter seam으로 매핑한다.
- 현실 BlackRock BUIDL 연동, Securitize claim 연동, NAV/redemption/distribution rail은 범위 밖이다.

### Verification

- `forge fmt --check src/demo/BuidlLikeDemoAsset.sol test/fixtures/TREXSuite.sol test/fixtures/MockSecuritizeTA.sol test/integration/IntegrationBase.sol test/integration/BUIDLLikeFlow.t.sol src/compliance/elements/BuidlMinimumInvestment.sol src/compliance/recipes/BuidlLikeFundRecipe.sol test/unit/compliance/BuidlLikeFundRecipe.t.sol`
- `forge test --offline --match-path test/integration/BUIDLLikeFlow.t.sol -vv`
- `forge test --offline --match-path test/unit/compliance/BuidlLikeFundRecipe.t.sol -vv`
- `forge test --offline`

## RFQ-002 — RFQ v2 Hardening

### Behavior

- maker(dealer) approval이 operator-curated allowlist로 강제된다. 미승인 maker의
  quote는 서명이 유효해도 settlement에서 거부된다(`RFQMakerNotApproved`).
- `setMakerApproved(address,bool)`는 `onlyOperator`이며 `MakerApprovalSet` event를
  emit한다.
- maker는 자신의 nonce namespace에 대해 `cancelQuoteNonce`/`cancelQuoteNonces`로
  outstanding quote를 취소할 수 있다. idempotent(used nonce는 no-op)하며 상태
  전이 시에만 `RFQQuoteCancelled` event를 emit한다.
- router는 `context.venueType`이 등록된 `VenueConfig.venueType`와 불일치하면
  거부한다(`VenueTypeMismatch`).
- venue 위협 모델이 `docs/rfq-threat-model.md`에 문서화된다.

### Verification

- `forge test --offline`(전체 133/133 유지)
- RFQAdapter unit test: `test_execute_revertsWhenMakerNotApproved`,
  `test_setMakerApproved_onlyOperator`, `test_setMakerApproved_setsAndEmits`,
  `test_execute_revertsAfterApprovalRevoked`,
  `test_cancelQuoteNonce_blocksSubsequentFill`,
  `test_cancelQuoteNonce_emitsOnFirstCancelOnly`,
  `test_cancelQuoteNonce_scopedToCaller`, `test_cancelQuoteNonces_batchCancels`,
  `test_cancelQuoteNonce_afterFillIsNoOp`
- Router unit test: `test_execute_revertsWhenVenueTypeMismatchesRegistry`
- `cd services/rfq && npm test`(unchanged-service guard)
- `docs/rfq-threat-model.md` 존재와 `docs/security.md`/`docs/README.md` 링크 무결성

### State

passing

### Notes

- 정책 결정: D008(maker approval adapter-local, full-fill, non-custodial,
  nonce-scoped idempotent cancel).
- Non-goals: partial fill, dealer inventory, signer key custody, shared dealer
  registry.
- Deferred follow-up (완료): router-path maker-approval/cancellation
  integration-test 시나리오를 `test/integration/RFQFlow.t.sol`에서 real ERC-3643
  스택 위 protected path로 커버한다.

## RFQ-003 — Maker Authorizer and Regulated Amount Cap

### Behavior

- maker settlement account와 quote signer를 분리하는 versioned authorizer를 제공한다.
- maker 직접 ECDSA, governed EOA delegate와 ERC-1271 maker 서명을 검증한다.
- signer 권한 추가는 delay를 거치고 revoke는 즉시 적용되며, fill은 현재 권한을
  다시 검사한다.
- RFQ quote schema와 exact full-fill/replay/cancel/Router-only 불변식은 유지한다.
- finite compliance cap은 결제 notional이 아니라 regulated asset quantity에
  적용하고, cap의 대상 token이 요청 pair와 일치하지 않으면 fail-closed한다.

### Verification

- MakerAuthorizer unit tests
- RFQAdapter direct/delegated/revoked/ERC-1271 authorization tests
- Router finite-cap buy/sell/invalid-axis tests
- RFQ integration and full repository checks
- BUIDL-like RFQ E2E

### State

passing

### Notes

- Completed plan: `docs/exec-plans/completed/RFQ-003-maker-authorizer-cap.md`
- Non-goals: partial fill, custody, durable nonce coordinator, production hosting.

## CMP-001 — Reg D 506(c) 9-element Recipe

### Behavior

- illustrative Reg D 506(c) element library가 reference 9-element set을 커버한다:
  A-01 sanctions, A-02 jurisdiction, A-03 accredited, A-04 identity uniqueness,
  A-05 US-tax-resident 제외, B-01 asset classification(REG_D), B-02
  ERC-3643-native asset, C-01 Rule 144 lockup, E-01 Form D filing.
- `RegD506cRecipe`는 이 9-element set을 요구한다(id 1, version 2,
  always-applicable). illustrative reference wiring이며 approved production
  policy가 아니다.
- 새 element의 attestation setter는 operator-gated(`Governed`/`onlyOperator`)이며
  production data source(OFAC/ONCHAINID/ERC-165/EDGAR)는 approval-gated seam으로
  남는다.
- C-01 Lockup은 injected mock acquisition source를 통해 test fixture에서만
  활성화된다. production holding-period 활성화 default는 변경하지 않는다.
- 완전히 attested된 buyer + asset은 real ERC-3643 router 경로로 settle되고,
  element family별로 하나를 깨면 그 element의 reasonCode로 거부된다.

### Verification

- `forge test --offline`(전체 195/195, pre-task 189 + 신규 6).
- Recipe unit test: `test_regd_ids_and_elements`(9 element, version 2, id 1,
  always-applicable).
- 통합 test `test/integration/RegD506cElements.t.sol`:
  `test_happyPath_nineElements_buySucceeds`,
  `test_reject_jurisdictionDisallowed`, `test_reject_jurisdictionUnset`,
  `test_reject_identityUnbound`, `test_reject_usTaxResidentFlagged`,
  `test_reject_assetNotClassifiedRegD`.
- 기존 통합/unit fixture(MultiRecipe, Surveillance, EmergencyPause, Invariants,
  SwapFlow, Engine)는 shared setup helper로 9-element attestation을 추가해 유지.
- `forge fmt`.

## DOC-002 — RFQ SDK and MVP Demo Planning

### Behavior

- RFQ backend 운영을 Corner Store가 제공하지 않는다는 제품 경계를 명확히 한다.
- RFQ backend SDK, local reference example, MVP demo backend를 서로 다른 레이어로 분리한다.
- 구현 순서는 SDK interface 정리 → local reference example → MVP demo backend로 기록한다.
- production RFQ hardening(dealer approval, custody, cancellation, partial fill)은 별도 트랙으로 유지한다.
- roadmap과 product spec index에서 RFQ SDK/MVP backend 후속 작업을 찾을 수 있다.

### Verification

- RFQ venue architecture, product-spec index, roadmap, FEATURES, PROGRESS 교차 검토
- `git diff --check`

### State

passing

### Notes

- 데모 문서: `docs/compliance/07-buidl-implementation.md`
- Profile spec: `docs/product-specs/buidl-like-demo-profile.md`
- 현재 구현은 local BUIDL-like profile + fixture다. 실제 BUIDL 온보딩은 법률 확정, issuer/trusted-claim 연동, 1차/2차 rail 분리 후 별도 feature로 진행한다.

- 정책 결정: D009(9-element in-place 확장, operator-gated setter, Lockup은
  fixture-only mock acquisition source).
- Deferred follow-up: ungated legacy mock element(A-01/A-03/QP)의 operator-gate
  정렬, production data source 연결, acquisition/lot data source와 holding-period
  활성화 조건 결정.
- Non-goals: production legal 활성화, direction-aware element application.

## E2E-001 — Live Anvil E2E & Demo Runner

### Behavior

- `scripts/e2e-anvil.sh`가 fresh Anvil 노드를 띄우고 전체 스택을 배포
  (`script/DeployStack.s.sol`)한 뒤 7-scenario demo suite
  (`script/DemoScenarios.s.sol`)를 구동하고, scenario별 narrative + evidence +
  `PASS`/`FAIL`을 출력한 다음 노드를 teardown한다. 완전히 offline로 동작하고,
  하나라도 실패하면 스크립트가 non-zero로 종료한다. `--port`, `--keep` 플래그를
  지원한다(`--keep`은 이후 Anvil을 계속 실행해 인터랙티브 demo/UI attach 가능).
- `DeployStack`은 registries(Element/Recipe/TokenPolicy/Operator),
  ComplianceEngine, ExecutionRouter+VenueRegistry+VenueSelector,
  CornerStoreFactory, 11개 element, 두 recipe(RegD 506(c) id 1, 3(c)(7) id 2) +
  surveillance-enabled RegD 변형(id 7), MockPool AMM venue, RFQAdapter venue,
  그리고 REAL ERC-3643 token + OnchainID 스택을 live 노드에 배포하고 주소를
  `deployments/anvil-e2e.json`(gitignore)로 기록한다. T-REX 배포 코어는
  `test/fixtures/TREXCore.sol`로 추출해 test fixture와 script가 공유한다.
- 7 scenario: (1) factory 1-call onboarding(propose→approve+venue), (2) compliant
  trade 성공, (3) live element rejection(A-02 flip → `ComplianceRejected`, off-chain
  reason-code 재계산 후 복원), (4) manifest lifecycle(suspend 차단 → resume 재거래),
  (5) RFQ venue(EIP-712 quote 서명 → `RFQFilled`, 미승인 maker `RFQMakerNotApproved`),
  (6) surveillance(threshold 초과 시 `SurveillanceFlag`), (7) bypass 시도(direct
  adapter.execute → `NotAuthorized`).
- src/(제품 코드) 변경 없음. `tools/deploy-v3`에 의존하지 않는다(vendor isolation);
  AMM venue는 MockPool을 쓰고, 실제 Uniswap v3 pool 배포는 별도 follow-up으로 남는다.

### Verification

- `scripts/e2e-anvil.sh`(fresh + repeat) 2회 실행, 각 7/7 PASS + exit 0.
- `scripts/e2e-anvil.sh --keep` 실행 후 Anvil이 계속 살아 있음을 확인.
- `forge test --offline`(238/238 유지; TREXSuite→TREXCore 추출 후에도 green).
- `forge fmt --check`.

### State

passing

### Notes

- runbook: `docs/demo.md`(실행법, scenario 순서, reason-code 재계산, mock/real 구분).
- 관련 결정: D008/D009(illustrative element library, manifest lifecycle). 실제
  Uniswap v3 pool 배포와 production data source 연결은 out-of-scope.
- Non-goals: 실 Uniswap v3 pool, production governance key management,
  direction-aware element application.

## CMP-002 — Manifest Lifecycle & Operator Approval Flow

### Behavior

- Manifest는 validated state machine을 따른다: UNKNOWN --register--> PROPOSED
  --approve--> ACTIVE, ACTIVE <--resume--/--suspend--> SUSPENDED,
  {ACTIVE, SUSPENDED} --retire--> RETIRED(terminal), UNKNOWN --setUnregulated-->
  UNREGULATED --clearUnregulated--> UNKNOWN. 그 외 모든 transition은
  `InvalidManifestTransition`으로 revert한다.
- `registerManifest`는 caller-supplied status를 무시하고 항상 PROPOSED로 착지하며
  `declaredBy = msg.sender`를 기록한다. `approveManifest`는 `approvedBy`를 기록하고
  issuance recipe가 비어 있으면 revert한다. raw `setStatus`는 제거되었다.
- owner가 자산을 classify(register/setUnregulated/clearUnregulated)하고 operator가
  기존 manifest의 lifecycle(approve/suspend/resume/retire)을 구동한다.
- `ComplianceEngine.evaluate`는 side별 positive allowlist(UNREGULATED 또는 ACTIVE만
  허용)로 default-deny한다. UNKNOWN/SUSPENDED/PROPOSED/RETIRED와 미래 member는
  fail-closed하며, both-UNREGULATED fast-path는 유지된다.
- `CornerStoreFactory.registerRWAToken`은 register→approve를 한 governed call에서
  실행하고 token은 ACTIVE로 끝난다(`declaredBy`/`approvedBy` = factory).

### Verification

- `forge test --offline`(전체 227/227, pre-task 212 + 신규 15).
- Engine unit test(default-deny fail-closed): `test_proposed_against_unregulated_fails_closed`,
  `test_retired_against_unregulated_fails_closed`, `test_proposed_against_active_fails_closed`,
  `test_retired_against_active_fails_closed_both_orderings`(양방향 ordering).
- Registry unit test(clearUnregulated + onlyOwner-vs-onlyOperator):
  `test_clearUnregulated_from_UNREGULATED`, `test_clearUnregulated_then_register_ok`,
  `test_clearUnregulated_reverts_when_UNKNOWN`, `test_clearUnregulated_reverts_when_PROPOSED`,
  `test_clearUnregulated_reverts_when_ACTIVE`, `test_clearUnregulated_reverts_for_non_owner`,
  `test_clearUnregulated_reverts_for_operator`, `test_setUnregulated_reverts_for_operator`.
- 통합 test `test/integration/EmergencyPause.t.sol`(router end-to-end):
  `test_proposedPolicy_failsClosed`, `test_retiredPolicy_failsClosed`,
  `test_suspendThenResume_tradesAgain`.
- 기존 registry lifecycle state-machine unit test(Task 1, 25 tests)는 유지.
- `forge fmt`.

- Product spec: `docs/product-specs/rfq-backend-sdk-and-demo.md`
- 이 feature는 문서 계획 작업이며 `services/rfq` 구현은 후속 feature에서 진행한다.

## RFQ-SDK-001 — RFQ Backend SDK Interfaces

### Behavior

- `services/rfq`가 RFQ backend를 만들기 위한 TypeScript SDK helper를 제공한다.
- integrator는 `createRFQService(...).quote(...)` high-level API로 taker/token/amount/venue만 넣고 `RFQAdapter` 호환 signed quote를 받을 수 있다.
- SDK는 EIP-712 typed-data shape, chainId/verifyingContract binding, nonce, expiry, amount validation과 signature flow를 처리한다.
- signer, nonce store, pricing provider, inventory/risk check는 교체 가능한 interface로 제공한다.
- local reference component는 `InMemoryNonceStore`, `FixedRatePricingProvider`, `NoopInventoryRiskCheck`로 제한한다.
- production server, hosted backend, pricing strategy, signer custody, inventory management와 compliance final decision은 범위 밖이다.

### Verification

- `cd services/rfq && npm test`
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- SDK README: `services/rfq/README.md`
- Product spec: `docs/product-specs/rfq-backend-sdk-and-demo.md`
- MVP demo backend는 이 SDK를 기반으로 후속 feature에서 구현한다.

## DEMO-002 — MVP RFQ Demo Backend

### Behavior

- `services/rfq-demo-backend`가 RFQ SDK를 사용해 local Anvil용 signed quote HTTP API를 제공한다.
- backend는 deployment artifact의 approved maker, RFQ adapter, venue와 QUOTE/RWA pair에 고정되며 mock fixed-rate pricing을 사용한다.
- CLI `rfq-quote --backend <url>`가 backend quote를 기존 quote JSON 형식으로 저장하고 기존 `buy --venue rfq` protected Router flow에서 사용한다.
- live runner와 CLI는 `buidl-like | reg-d` asset profile을 선택하며, issue #40의
  기본값은 BUIDL-like metadata + Reg D/QP/minimum-investment Manifest다.
- live runner가 backend quote → CLI → Router/RFQAdapter 성공과 revoked-maker
  실패를 자동 실행한다.
- `scripts/e2e-anvil.sh --mode rfq`는 AMM·lifecycle·surveillance 설명을 건너뛰고
  mock TA profile → Toolkit/CLI → backend-signed quote → protected RFQ settlement
  → revoked-maker rejection만 보여주는 짧은 MVP 시연 경로를 제공한다.
- Dashboard는 사용자 중심의 Dashboard → RFQ 거래 → My RFQs → Portfolio 흐름을
  기본 navigation으로 제공하고 Security proof와 read-only Operator view는 Advanced로
  분리한다. 사용자는 local backend에서 exact signed quote를 요청·비교·검토한 뒤
  protected Router settlement를 실행하고 실제 session balance delta를 Portfolio에서
  확인한다. Security proof는 on-chain maker revoke 상태를
  명시적 restore 전까지 유지해 현재 정책 enforcement를 가시화한다. 브라우저에는
  private key가 전달되지 않는다.
- Trader의 live firm rate는 `/demo/quote` 금액에서 계산한다. 비교 maker, 가격 곡선,
  spread와 활동 통계는 multi-maker/market-data API가 생기기 전까지 명시적으로
  `Demo fixture data`와 `Preview only`로 표시해 실제 실행 가능 quote와 구분한다.
- 헤더의 **?** presenter guide가 정상 거래, maker-revocation 보안 시나리오,
  live/fixture 경계와 각 버튼의 실제 backend/Operator API 연결을 대시보드 안에서
  설명한다.
- backend는 pricing, signing과 nonce 발급만 담당하며 compliance 최종 판단을 하지 않는다.
- long-lived demo backend는 CLI와 동일한 Anvil 계정을 함께 사용해도 각 transaction의
  pending nonce를 다시 조회하고 settlement action을 직렬화해 stale nonce와 중복 제출을
  방지한다. live E2E는 UI와 동일하게 quote 요청 후 그 exact quote를 trade endpoint에
  제출하고, CLI activity 이후 backend 재체결까지 검증한다.
- dashboard는 `/rfq-api` same-origin proxy로 backend에 연결되어 custom launcher
  port에서도 frontend 수정 없이 동작한다. trade endpoint는 제출된 quote의
  maker/taker/token pair/venue/domain/signature를 deployment artifact와 대조한 뒤에만
  local settlement를 실행한다.
- production pricing, signer custody, persistent nonce, inventory/risk control과 hosted operation은 명시적으로 범위 밖이다.

### Verification

- `cd services/rfq-demo-backend && npm test`
- `cd services/cli && npm test`
- `scripts/check.sh`
- `scripts/e2e-anvil.sh --profile buidl-like`
- `scripts/e2e-anvil.sh --profile reg-d`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- `scripts/check.sh` 통과: Foundry 248/248, RFQ SDK, CLI, RFQ demo backend와 deploy-v3.
- backend smoke가 HTTP quote, fixed pricing, maker signature, monotonic nonce와 invalid amount를 검증한다.
- CLI smoke가 `--backend` request path를 검증하고 기존 `RFQFlow.t.sol`이 protected Router settlement의 성공/거부 경로를 검증한다.
- Foundry v1.7.1 clean build에서 `buidl-like`과 `reg-d` 두 profile 모두
  통과: 각각 7/7 scenarios, backend-signed quote settlement, revoked-maker 거부.
- RFQ-first dashboard/runbook: `services/operator-dashboard`의 사용자 중심 4개
  기본 화면과 2개 Advanced 화면, local HTTP server smoke, `--mode rfq` live E2E를
  검증했다. 시연 순서는
  `docs/rfq-demo-guide.md`를 기준으로 한다.

## CLI-001 — corner-store Reference CLI

### Behavior

- `services/cli/`에 TypeScript CLI(`corner-store`)를 추가해, forge 스크립트를 직접
  다루지 않고 터미널에서 live 노드 대상으로 전체 스택을 구동한다: onboarding,
  attestation, manifest lifecycle, AMM/RFQ 거래, reason-code 디코딩. 기대 환경은
  Anvil E2E 배포(`scripts/e2e-anvil.sh --keep` + `deployments/anvil-e2e.json`).
- 명령: `status`(주소/manifest/venue/per-element attestation 상태, `--json`),
  `onboard`(factory 1-call, ACTIVE면 retire→register→approve),
  `manifest <status|suspend|resume|retire>`, `attest <element> <subject> [value...]`
  (9개 element setter), `investor-setup <addr> --profile ...`(선택 profile attestation +
  C-01 acquisition seed + QUOTE funding), `kyc <addr>`(ERC-3643 identity/claim,
  `script/KycInvestor.s.sol` forge 스크립트로 위임), `buy <amountIn>`
  (`--venue amm|rfq`, `--min`, `--quote`), `rfq-quote`/`rfq-cancel`(services/rfq
  EIP-712 서명 라이브러리 재사용), `maker <approve|revoke>`, `reason <bytes32>`.
- reason 디코딩은 `(recipeId∈{1,2,7}) × (11 element) × code 1` + engine의 policy-status
  거부(`encode(0,"POLICY",status)`)를 오프라인 사전계산해 매칭한다. `ComplianceRejected`
  를 잡는 모든 명령이 자동 디코딩하고, 실패 tx는 디코딩된 reason과 함께 non-zero 종료.
- chain 상호작용은 ethers(services/rfq에는 web3 라이브러리가 없어 CLI가 유일하게 도입),
  ABI는 `src/abi.ts`의 hand-written fragment(`out/` 비의존). src/ 제품 코드 변경 없음;
  신규 Solidity는 `script/KycInvestor.s.sol` 하나(shared `TREXCore` 재사용, 이미 배포된
  T-REX 스택에 re-bind).

### Verification

- `npm test`(services/cli): reason-table decode round-trip(`cast keccak` ground-truth
  대조) + quote-file round-trip 스모크, 네트워크 불필요.
- Live 노드 walkthrough(fresh account 4): `status` → `onboard` → `investor-setup` →
  `kyc` → `buy`(AMM PASS, +100 RWA) → `attest jurisdiction ZZ` → `buy`(FAIL, decoded
  `recipe 1 / A-02-v1 / Jurisdiction`) → restore → `manifest suspend` → `buy`(FAIL,
  `POLICY / SUSPENDED`) → `resume` → `buy`(PASS) → `rfq-quote` → `buy --venue rfq`
  (PASS) → `maker revoke` → `buy --venue rfq`(FAIL, `RFQMakerNotApproved`).
  전 실패 경로 non-zero 종료 + 디코딩 확인.
- `forge test --offline` 238/238 유지(Solidity 측 추가는 `KycInvestor.s.sol`뿐).

### State

passing

### Notes

- runbook: `services/cli/README.md`("CLI demo" 레시피), `docs/demo.md`의
  "CLI로 직접 해보기" 섹션.
- `kyc`는 repo root에서 실행해야 한다(상대 fs_permissions + 스크립트 경로). CLI가
  forge cwd를 repo root로 설정하고 artifact를 root-상대 경로로 전달한다.
- Non-goals: 프로덕션 key 관리, out/ ABI 커플링, 두 번째 web3 라이브러리 도입.

## CLI-002 — corner-store CLI v2 (preflight · trade surface · observability)

### Behavior

- 기존 `services/cli`에 명령 7개를 더한다(제품 코드/스크립트 변경 없음, `services/cli/**`
  + 문서만):
  - `check <buyer> [--venue amm|rfq] [--amount n] [--json]` — 거래 없이 per-element
    preflight. active manifest의 recipe id → `requiredElements()` →
    `ElementRegistry.elementOf` → 각 element `check(buyer, seller, rwa, amount, "")`를
    eth_call로 실행하고, `engine.evaluate(ctx)`(view)로 전체 verdict를 낸다. 표(id/name/
    PASS·FAIL)+verdict 라인, FAIL 행은 디코딩된 reason, verdict가 rejected면 exit 1.
    엔진은 `ctx.buyer`만 스크리닝(비-direction-aware)하므로 subject를 무시하는 asset-side
    원소(B-01/B-02/E-01)는 표에 `[asset-side]`로 표기해 per-buyer FAIL 오독을 막는다.
  - `sell <amountIn> [--min]` — AMM 매도(tokenIn=RWA, tokenOut=QUOTE). `buy`를 미러링하되
    `test/integration/SwapFlow.t.sol::test_sell_shaped_success`의 컨텍스트(ctx.buyer=매도자,
    venueData=zeroForOne=false)를 그대로 따른다.
  - `balances [addr...] [--json]` — RWA/QUOTE 잔고 + amm/rfq adapter allowance(기본: 5개
    well-known 역할).
  - `watch [--from block]` — `eth_getLogs` 폴링(~2s) 이벤트 tail: Executed, RFQFilled,
    RFQQuoteCancelled, MakerApprovalSet, ManifestRegistered, ManifestStatusChanged,
    SurveillanceFlag. reason/label·status·elementId 디코딩, `--from`은 히스토리 재생.
  - `faucet <addr> <amount>` — QUOTE 민팅(MockERC20.mint permissionless, demo 전용).
  - `snapshot` / `restore <id>` — anvil `evm_snapshot`/`evm_revert`(RPC 미지원 시 명확한 에러).
  - `quote-inspect <file> [--json]` — 서명 quote 디코딩: services/rfq 타입드데이터로 서명자
    복구(==maker PASS/FAIL), 만료 카운트다운, on-chain `usedQuoteNonce`/`approvedMaker`.
    실패 검사가 하나라도 있으면 exit 1.
- 재사용 원칙 준수: reason 디코딩은 기존 `reason.ts`, EIP-712 복구는 services/rfq lib의
  domain+types로 `ethers.verifyTypedData`(타입 문자열 재선언 없음). ABI fragment는 계속
  hand-written(`out/` 비의존)이며 실제 컨트랙트 소스와 대조해 추가했다.

### Verification

- `npm test`(services/cli): quote-inspect 서명자 복구 round-trip(valid + tampered) +
  reason-decode 회귀(check가 쓰는 recipe-aware per-element code) 스모크, 네트워크 불필요.
- Live walkthrough(`scripts/e2e-anvil.sh --keep`, fresh account 4): `check`(미attested →
  A-02/A-03/A-04/C-01 FAIL + rejected, exit 1) → `investor-setup`+`kyc` → `check`(전 PASS,
  ALLOWED) → `faucet` → `buy`(+100 RWA) → `sell 40`(RWA -40, QUOTE +40) → `balances`
  전/후 → `snapshot`(0x11) → `attest jurisdiction ZZ` → `check`(정확히 A-02 하나 FAIL,
  exit 1) → `restore 0x11` → `check`(ALLOWED) → `watch --from 0`(세션 이벤트 디코딩 재생,
  라이브 MakerApprovalSet tail) → `rfq-quote` → `quote-inspect`(전 PASS) → 파일 서명
  변조 → `quote-inspect`(signature FAIL, exit 1).
- `forge test --offline` 238/238 유지(Solidity 변경 없음).

### State

passing

### Notes

- runbook: `services/cli/README.md`(CLI v2 명령/주의), `docs/demo.md`.
- `check`는 엔진이 direction-aware가 아니라는 점을 도움말·표기로 명시(asset-side 라벨).
- `snapshot`/`restore`는 anvil 전용; `restore`는 이후 스냅샷을 무효화(문서화).
- Non-goals: CLI-001과 동일(프로덕션 key 관리, out/ ABI 커플링, 2차 web3 라이브러리).

## TOOLKIT-001 — Versioned Config Foundation

### Behavior

- 사용자가 자산 profile과 사용할 venue를 JSON 설정에서 선택한다.
- `schemaVersion`으로 설정 형식을 고정하고, 잘못된 profile·venue·operator 계정은
  배포 전에 fail-closed 검증한다.
- `services/toolkit`의 validator를 CLI가 재사용한다.
- `corner-store toolkit-init`과 `corner-store toolkit-validate`로 설정 생성·검증을
  같은 인터페이스에서 수행한다.
- `corner-store toolkit-simulate`로 artifact/profile/venue binding과 read-only 실행
  순서를 트랜잭션 전에 확인한다.
- `corner-store toolkit-preflight`로 실제 deployment artifact의 주소와 선택 profile,
  venue 구성을 mutation 전에 검증한다.
- `corner-store toolkit-onboard`가 같은 config를 preflight한 뒤에만 선택한 profile과
  venue를 manifest에 반영한다.
- `corner-store toolkit-checkpoint`가 config/artifact hash와 deployment state를
  secret-free immutable JSON으로 기록하고 기존 checkpoint 덮어쓰기를 거부한다.
- `corner-store toolkit-proposal`이 target/calldata/reason/artifact hash를 담은
  draft governance proposal만 생성하며 multisig 실행은 수행하지 않는다.
- draft proposal을 Safe-compatible transaction payload로 export할 수 있지만, Toolkit은
  서명·제출·승인 상태 변경을 수행하지 않는다.
- `corner-store toolkit-deploy`가 기존 `DeployStack.s.sol`을 config profile에 맞춰
  호출하며, 기본은 dry-run이고 `--broadcast`를 명시해야만 mutation한다.
- `corner-store toolkit-test`가 동일한 사용자 진입점에서 repository-wide
  `scripts/check.sh`를 실행한다.
- live Anvil E2E가 실제 deployment artifact에 대해 Toolkit preflight와 immutable
  checkpoint를 실행한 뒤 CLI onboarding/RFQ settlement를 수행한다.
- BUIDL-like와 Reg D profile별 Toolkit config fixture를 각각 검증한다.
- Toolkit config는 governance multisig alias와 required approval 수를 명시하며 private key나
  signer material은 포함하지 않는다.
- Element/Recipe/Adapter/provider 템플릿과 required input/trust-boundary 검증을
  제공해 확장 시 기존 compliance/router 경계를 복사하지 않도록 한다.
- private key를 받지 않는 read-only Operator API로 config/deployment snapshot과
  normalized event index를 제공한다.
- read-only Operator dashboard가 profile/venue/event snapshot을 표시하고,
  변경은 외부 multisig proposal 검토 후 실행하도록 경계를 둔다.
- Operator API가 local/demo in-memory index와 교체 가능한 file-backed event index를
  제공하며 마지막 block cursor를 보존한다.
- finality-aware indexer가 confirmation depth 이후 block만 저장하고 finalized block
  hash가 바뀌면 fail-closed로 중단한다.
- Operator API가 선택적 Bearer token 인증을 지원하며 health endpoint 외 조회를
  인증 없이 노출하지 않는다.
- `/metrics`가 요청 수·인증 실패·indexed event count를 Prometheus 형식으로
  노출하며 주소·token 값은 포함하지 않는다.
- Wave-2 illustrative elements는 기본 Foundry script discovery 경로 밖의
  `tools/deploy-wave2/DeployWave2Elements.s.sol`에서 opt-in으로 등록해 기본
  BUIDL-like/Reg D demo의 배포 범위와 컴파일 그래프를 보존한다.

### Verification

- `cd services/toolkit && npm test` (simulation/template/preflight mismatch 포함)
- `cd services/operator-api && npm test`
- `cd services/operator-dashboard && npm test`
- `cd services/cli && npm test`
- `scripts/check.sh`

### State

passing

### Scope

이번 단계에서 공통 설정 계약, validation/simulation, preflight/onboard/deploy/test,
checkpoint와 governance handoff, operator API/indexer 및 read-only dashboard까지
구현·검증했다. production TLS/secret rotation, 실제 multisig provider, live RPC
finality/recovery와 production RFQ custody는 별도 후속 feature다.

## OPS-001 — High-severity Solidity Lint Gate

### Behavior

- production Solidity source에 Foundry의 high-severity lint를 실행한다.
- high-severity warning이 하나라도 있으면 local repository check와 CI가 실패한다.
- test fixture의 medium/low 경고는 별도 warning-budget feature로 분리한다.
- venue bitmask는 명시적 `uint256(1)`을 사용해 shift operand 폭을 고정한다.

### Verification

- `forge lint --severity high --deny warnings src`
- `forge test --offline`
- `scripts/check.sh`

### State

passing

### Scope

새 정적 분석 의존성을 추가하지 않고 Foundry stable에 내장된 production lint만
fail-closed gate로 도입한다. Slither와 medium warning 정리는 후속 범위다.

## OPS-002 — Repository-wide CI Parity

### Behavior

- GitHub Actions가 local `scripts/check.sh`와 동일한 repository-wide gate를 실행한다.
- RFQ SDK, CLI, demo backend, Toolkit, Operator API/dashboard와 vendored deploy-v3가
  pull request마다 검증된다.
- npm 서비스는 각 lockfile을 cache key와 deterministic install에 사용한다.
- vendored deploy-v3는 자체 `yarn.lock`과 directory boundary 안에서만 설치·검증한다.

### Verification

- `scripts/check.sh`
- GitHub Actions `Run repository-wide checks`

### State

passing

### Scope

기존 local gate와 CI의 범위를 일치시킨다. live Anvil E2E는 별도 실행 비용과
환경 격리가 필요하므로 이 feature의 PR gate에는 포함하지 않는다.

## DOC-003 — Goal Completion and Operations Alignment

### Behavior

- ROADMAP이 이미 구현된 Toolkit, Operator API/dashboard와 profile별 live E2E를
  완료 상태로 기록하고 production 후속 범위와 구분한다.
- incident response가 현재의 asset/venue/maker containment 경로, 외부
  ERC-3643/ONCHAINID boundary와 multisig/timelock recovery gate를 따른다.
- 미구현 central pause, production custody/hosting/finality를 구현된 기능처럼
  표현하지 않는다.

### Verification

- `scripts/e2e-anvil.sh --profile buidl-like`
- `scripts/e2e-anvil.sh --profile reg-d`
- Markdown link와 `git diff --check` 검토

### State

passing

### Scope

문서 정합화와 운영 runbook만 추가한다. contract, API 또는 production 운영 정책은
변경하지 않는다.

## PROD-001 — Production Control Plane

### Behavior

- `OperatorRegistry`가 global, asset, venue pause의 단일 source of truth가 된다.
- operator는 위험을 즉시 중단할 수 있지만 unpause는 owner가 예약한 뒤 최소
  timelock이 지난 후에만 실행할 수 있다.
- `ExecutionRouter`는 compliance evaluation과 venue dispatch 전에 global, 양쪽
  asset, venue pause를 fail-closed로 검사한다.
- Manifest lifecycle은 현재 version, pending update, full manifest hash와
  append-only history hash를 보존한다.
- ACTIVE/SUSPENDED Manifest의 semantic update는 별도 pending proposal로 저장되고
  timelock 이후 승인되며, suspended asset을 update만으로 재개할 수 없다.
- lifecycle/pause 변경은 actor, old/new value, reasonCode/reasonHash와 effective time을
  event로 남긴다.

### Verification

- `forge fmt --check`
- `forge lint --severity high --deny warnings src`
- `forge test --offline --match-path test/unit/registry/OperatorRegistry.t.sol -vv`
- `forge test --offline --match-path test/unit/registry/TokenPolicyRegistry.t.sol -vv`
- `forge test --offline --match-path test/unit/execution/Router.t.sol -vv`
- `forge test --offline --match-path test/integration/EmergencyPause.t.sol -vv`
- `forge test --offline`
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/PROD-001-production-control-plane.md`
- governance owner는 외부 Safe-style multisig를 전제로 하며 컨트랙트 내부에
  n-of-m signer 로직을 구현하지 않는다.
- issuer disable, production multisig provider와 chain별 timelock 값은 후속 운영
  설정이며, 현재 manifest에 issuer identity가 없으므로 asset pause로 fail-closed한다.

## DATA-001 — Compliance Data Layer Foundation

### Behavior

- ADR-008의 Transfer Agent 경계를 provider-neutral TypeScript SDK로 제공한다.
- per-lot acquisition 입력은 lineage, 완납일과 freshness를 검증하고 보수적인
  holder×asset snapshot으로 컴파일한다.
- `Lockup`은 operator-attested snapshot의 상태와 만료를 fail-closed로 검사한다.
- 거절 시도와 router 밖 transfer finding은 PII 없이 hash-chain audit trail에
  append할 수 있다.
- person-group 단위 volume/holder state는 execution idempotency를 보장한다.
- 실제 Securitize API, WORM storage와 production surveillance hosting은 adapter
  교체 지점으로 남기며 구현되었다고 주장하지 않는다.

### Verification

- `forge fmt --check`
- `forge test --offline --match-path test/unit/compliance/AcquisitionSource.t.sol -vv`
- `forge test --offline --match-path test/unit/compliance/Elements.t.sol -vv`
- `cd services/compliance-data && npm test`
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/DATA-001-compliance-data-layer.md`
- 실제 Securitize/TA field mapping은 공식 API 계약이 제공될 때 별도 provider
  adapter로 구현한다.
- 단일 holder×asset snapshot은 모든 현재 lot 중 가장 늦은 clock을 사용하므로
  amount-specific lot allocation 전까지 일부 mature lot 매도를 보수적으로 막을 수 있다.

### Related Files

- `services/compliance-data/`
- `src/registry/AttestedAcquisitionSource.sol`
- `src/compliance/elements/Lockup.sol`
- `test/unit/compliance/AcquisitionSource.t.sol`


## DATA-002 — Provider-Neutral TA/KYC Evidence

### Behavior

- `services/compliance-data` exposes a provider-neutral TA/KYC evidence boundary without
  hardcoding Securitize or another vendor API. Operator adapters supply provider results;
  Corner Store core accepts only subject/identity/asset bindings and PII-free hashes.
- `KycEvidenceCoordinator` validates exact taker/identity/asset binding, exact request/result/fact schemas, bounded provider IDs,
  schema versions, assessment/source evidence hashes, provider timeout, freshness/future skew and explicit
  `ACTIVE | REVOKED | INELIGIBLE` status before materializing evidence.
- Canonical `evidenceHash` is domain-separated over normalized provider/schema,
  subject/identity/asset, facts, timestamps, status and source hash. Any fact, revocation or
  lineage change changes the hash.
- Provider outage/timeout, malformed or missing fields, stale/future data, binding mismatch,
  sanctions hit, non-verified KYC, ineligible/revoked status, missing/failed strict success audit,
  store mismatch/conflict all fail closed and never return eligible materialization. Cached last-good evidence
  is not used to hide refresh outages.
- `InMemoryKycEvidenceStore` is a reference/conformance store only; production deployments must
  replace it with transactional durable/HA storage. It enforces idempotent replay,
  same-assessment conflict detection and monotonic protection so older active evidence cannot
  overwrite newer or revoked evidence.
- Audit and incident hooks use PII-free hashes, bounded status/reason codes and on-chain IDs
  only. Strict success audit runs before eligible store publish; store failure after success audit adds a fail audit/incident. Failure-audit and incident-hook errors are bounded/non-recursive.
- ERC-3643/ONCHAINID remains an external trust boundary: the output is evidence for an
  issuer/TA-approved adapter, not direct claim issuance or registry writes.

### Verification

- `npm test --prefix services/compliance-data`
- `git diff --check`

### State

passing

### Notes

- Implements the D012/PD-4 provider-neutral boundary; no new vendor compatibility decision was
  introduced.
- Existing mock TA and local demo flows are unchanged.

### Related Files

- `services/compliance-data/src/kyc.ts`
- `services/compliance-data/test/smoke.ts`
- `services/compliance-data/README.md`

## MANIFEST-002 — RecipeBinding Manifest Migration

### Behavior

- 자산 Manifest는 고정 `issuanceRecipeId + fundRecipeId` 대신 bounded
  `RecipeBinding[]`를 registry에 저장한다.
- `REQUIRED_BLOCKING` Recipe는 AND, 같은 `pathGroupId`의 `PATH_OPTION`은 OR,
  서로 다른 path group은 AND로 평가한다.
- `FLAG_ONLY` 실패는 거래를 막지 않고 `ComplianceDecision.flagsBitmap`과 Router
  event로 노출한다.
- binding 변경은 full manifest hash 변경과 기존 timelock/version/history를 거친다.
- binding 수, recipe/version, path group과 duplicate 입력은 등록 시 fail-closed로
  검증한다.

### Verification

- RecipeBinding registry/lifecycle unit tests
- REQUIRED/PATH/FLAG engine regression tests
- pair-side, stateful commit와 Router event integration tests
- `scripts/check.sh`
- `buidl-like` / `reg-d` live E2E

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/MANIFEST-002-recipe-binding-migration.md`
- canonical `bytes32 recipeKey` alias와 per-element enforcement override compiler는
  별도 versioned refinement로 남긴다.

## AMM-001 — Canonical Uniswap v3 Pool E2E

### Behavior

- vendored `@uniswap/v3-core` artifact로 canonical factory/pool을 배포한다.
- CREATE2 예상 주소와 factory가 생성한 pool 주소가 일치해야 한다.
- 실제 pool을 verified ERC-3643 holder, venue와 adapter allowlist에 등록한다.
- 초기화·유동성 공급 후 `ExecutionRouter → UniswapV3Adapter → pool` exact-input
  swap이 실제 callback과 ERC-3643 transfer를 거쳐 성공한다.
- 미등록 pool/callback은 계속 fail-closed이고 Router/Adapter는 잔액을 보유하지 않는다.

### Verification

- canonical factory/pool deployment와 CREATE2 preflight integration test
- protected buy/sell, compliance rejection와 callback authorization tests
- `scripts/check.sh`

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/AMM-001-real-uniswap-v3-e2e.md`
- vendored Solidity source를 제품 `src/`로 복사하지 않는다.
- production fee-tier 승인, LP 운영 정책과 unified deploy CLI는 별도 후속 범위다.

## OPS-003 — Operator Deployment and Manifest Snapshot

### Behavior

- read-only Operator Dashboard가 배포 artifact의 execution/control-plane 주소를 표시한다.
- Demo onboarding 직후 Manifest status, version과 RecipeBinding 수를 snapshot으로 저장한다.
- Operator API가 snapshot을 `/api/v1/manifest`로 제공하고 Dashboard가 이를 표시한다.
- Dashboard, CLI와 RFQ backend가 연결된 local BUIDL-like walkthrough를 한 번에 실행할 수 있다.

### Verification

- `npm test --prefix services/operator-api`
- `npm test --prefix services/operator-dashboard`
- `npm test --prefix services/cli`
- `forge build --offline --jobs 1`
- `scripts/e2e-anvil.sh --profile buidl-like`
- `git diff --check`

### State

passing

### Notes

- snapshot은 demo/reference checkpoint이며 production indexer나 live RPC provider가 아니다.
- production Manifest lifecycle mutation과 governance action은 별도 범위다.

## DEMO-003 — Role-aware RFQ Compliance Walkthrough

### Behavior

- 헤더에서 Admin, 적격투자자 A/B와 비적격투자자 fixture를 전환한다.
- 사용자 RFQ 생성·수락 전에 현재 온체인 QP, maker 승인과 자산 정책을 pre-check한다.
- quote는 선택한 taker 지갑에 EIP-712로 binding되고 다른 지갑이 재사용할 수 없다.
- 비적격 사용자의 일반 quote 요청은 차단되며, 별도 proof action은 signed quote도
  Router의 최신 `ComplianceEngine` 검사에서 거부됨을 보여준다.
- Admin은 QP 결과를 직접 토글하지 않고 로컬 Anvil의 QP basis, claim 서명,
  trusted issuer, look-through와 fund binding 사실을 실제 트랜잭션으로 기록한다.
  A-13 Element가 법률-기술 변환 규칙에 따라 적격 결과를 계산하며, maker 승인과
  체결·거부·정책 변경 내역도 조회한다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `forge build --offline --force`
- `forge test --offline`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- 지갑 선택은 local demo persona이며 production authentication/custody가 아니다.
- pre-check는 UX용 사전 판단이고 최종 권한은 Router fill-time evaluation에 있다.

## DEMO-004 — Injectable Temporal RFQ Scenario

### Behavior

- 데모 자산 표시값, maker 이름, 지갑 persona, 초기 QP 상태, preview quote와
  freshness 시간 조건을 versioned scenario JSON으로 주입한다.
- 주소는 UI에 하드코딩하지 않고 fresh Anvil 배포 artifact와 scenario의
  `artifactKey` mapping으로 확인한다.
- `scripts/demo.sh --scenario <path>`와 E2E가 동일한 scenario를 사용한다.
- scenario 준비는 초기 QP 상태와 freshness cap을 실제 로컬 Anvil 트랜잭션으로
  기록한다.
- quote 발급 당시 적격이던 투자자의 QP claim만 만료시키고, 아직 유효한 동일
  signed quote가 Router의 fill-time 검사에서 거부되는 것을 보여준다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- scenario는 local deterministic fixture이며 실제 identity provider가 아니다.
- 임의 주소를 UI에서 가장하지 않는다. 거래 지갑은 배포 artifact와 일치하는
  funded Anvil signer여야 한다.

## DEMO-005 — Bidirectional RFQ Demo

### Behavior

- 매수는 taker의 결제 자산을 maker에게 보내고 maker의 ERC-3643 RWA를 받는다.
- 매도는 token pair를 반대로 binding해 taker의 RWA를 maker에게 보내고 maker의
  결제 자산을 받는다.
- scenario가 RWA와 결제 자산의 표시 정보/decimals를 주입하며 UI 주소나 자산
  symbol에 의존하지 않는다.
- 배포 fixture는 매수·매도를 어느 순서로 실행해도 되도록 양쪽 inventory와
  RFQAdapter allowance를 준비한다.
- Portfolio와 체결 결과는 RWA 및 결제 자산의 실제 온체인 증감량을 함께 표시한다.
- stateful commit은 RWA가 tokenOut이면 maker→taker, tokenIn이면 taker→maker로
  실제 regulated transfer 방향을 기록한다.

### Verification

- `forge test --offline --match-contract RFQFlowTest`
- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- RFQ 가격은 local demo trade-impact provider이며 production pricing,
  inventory/risk engine과 multi-maker aggregation은 후속 범위다.

## DEMO-006 — Deployment-bound Injectable RFQ Fixtures

### Behavior

- versioned scenario가 데모 계정 binding, 초기 투자자/maker/pool 물량, 매수·매도
  기본 수량, quote TTL과 mock pricing을 주입한다.
- 배포 스크립트가 선택한 scenario를 읽어 실제 Anvil mint/approval 계정과 금액에
  반영하며, UI 전용 하드코딩 값으로 가장하지 않는다.
- scenario의 지갑별 초기 QP 상태를 실제 A-13 fixture에 반영하고, `qUSD / RWA`
  가격은 backend와 Solidity demo 모두 매수 시 역산·매도 시 정방향으로 계산한다.
- 배포 artifact가 scenario schema version과 content hash를 보존하고 backend는
  다른 scenario로 시작하려는 경우 fail-closed한다.
- 사용자와 maker 잔액은 scenario 값을 그대로 표시하지 않고 배포 후 실제
  `balanceOf`를 조회한다.
- CLI/E2E는 scenario에 지정된 investor 계정을 사용하므로 기본 Anvil account 1에
  의존하지 않는다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `forge build --offline`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- 비기본 account, 초기 물량과 비 1:1 mock price·변경된 지갑별 QP 상태 scenario 전체 E2E
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- scenario는 local mock data provider다. production은 RFQ SDK의 pricing,
  nonce, signer와 inventory/risk interface에 실제 provider를 주입한다.
- preview quote는 계속 명시적인 presentation fixture이며 executable liquidity로
  취급하지 않는다.

## DEMO-007 — Law-first QP and Dynamic RFQ Market Demo

### Behavior

- 사용자 화면은 내부 Element ID보다 ICA §3(c)(7)와 §2(a)(51)의 Qualified
  Purchaser 법적 기준을 우선 표시하고, `A-13-v1`은 기술 상세로만 제공한다.
- QP basis별 통과 조건과 KE(Knowledgeable Employee)의 대상 펀드 일치 요건을
  Admin 화면에서 바로 설명한다.
- scenario가 초기 `qUSD / RWA` 가격과 fill당 impact bps를 주입한다.
- 성공한 매수는 다음 mock 시장가격을 올리고 성공한 매도는 내리며, 이후
  pre-check, firm quote, 포트폴리오 참고가격이 동일한 runtime 가격을 사용한다.
- 거부된 거래는 가격을 바꾸지 않고 demo setup은 초기 가격으로 복원한다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- 이 가격 변화는 발표용 결정론적 mock market이다. 실제 RFQ 가격은 외부 시세,
  maker inventory, spread와 risk engine을 주입해야 한다.

## DEMO-008 — RWA-aware RFQ Market Chart

### Behavior

- 사용자 Dashboard는 scenario에서 주입한 기초자산/NAV와 indicative RFQ mid
  히스토리를 서로 다른 series로 표시한다.
- indicative spread band를 표시하고 실제 Router 체결만 매수/매도 fill point와
  거래량에 포함한다.
- 성공한 체결은 다음 indicative 가격과 history API를 함께 갱신하며, 거부된
  거래는 가격·체결 history를 변경하지 않는다.
- 차트는 fixture와 live fill의 출처를 명확히 구분하고 sparse RFQ 거래를 연속
  CLOB/AMM 캔들처럼 가장하지 않는다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- production에서는 mock NAV series를 실제 oracle/NAV provider로, in-memory
  fill history를 indexer/query service로 교체한다.

## DEMO-009 — Resilient Repeated-Trade UX

### Behavior

- backend는 현재 RFQ 가격, 자산 최소수량과 scenario buffer를 사용해 다음
  매수·매도의 최소 안전 입력값을 계산한다.
- 새 RFQ와 매수/매도 전환은 이 값을 기본 입력으로 사용하되, 사용자가 더 작은
  값을 직접 입력하면 기존 minimum-investment 정책이 그대로 거부한다.
- 짧은 시간에 생성된 체결점은 실제 timestamp를 보존하면서 차트에서는 체결
  순서로 분리하고, 가격축은 최소 범위를 유지해 작은 mock 변동을 과장하지 않는다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

## DEMO-010 — RFQ Chart Fill Evidence

### Behavior

- 사용자 차트는 왜곡되거나 중복되는 짧은 구간 선택 없이 전체 기간을 표시한다.
- 실제 Router fill은 매수/매도 marker로 표시하고, 체결 단가·RWA 수량·
  실제 timestamp는 hover/focus tooltip에서 확인한다.
- 최근 체결은 단가, RWA 수량, 실제 timestamp와 transaction hash를
  별도 fill tape로 제공하고 fixture line과 구분한다.
- RFQ가 sparse하거나 같은 초에 체결되어도 marker는 실행 순서로 분리한다.

### Verification

- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

## DEMO-011 — Interpolated History and Repeat Liquidity

### Behavior

- scenario의 가격 anchor를 주입된 sample interval로 보간해 전체 기간의
  NAV와 indicative history를 안정적으로 표시한다.
- 원본 가격 경로와 sample interval은 scenario에 남아 있고 Dashboard에
  별도 가격 fixture를 하드코딩하지 않는다.
- demo investor와 maker의 양방향 재고는 최소수량 RFQ를 연속으로 시연할 수
  있도록 설정한다.
- E2E는 동일 투자자의 연속 매수 4회와 연속 매도 4회를 실제 Router에서
  체결해 재고와 nonce 경로를 검증한다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

## DEMO-012 — Enforcement Case Workflow

### Behavior

- Admin은 Adapter 직접 호출, quote 이후 claim 만료, quote 이후 Maker 승인 취소를
  각각 독립된 enforcement case로 연다.
- 각 case는 기준 상태 준비, firm quote 발급, 정책 변경, 실행 제출, 증거 검토,
  상태 복구를 별도 단계로 수행하며 한 버튼으로 전체 시나리오를 연출하지 않는다.
- 차단 증거는 실제 status `0` transaction receipt, 거부 사유 또는 reasonCode,
  실패 전후 RWA/결제 자산 잔액 불변과 실행 trace를 함께 제공한다.
- UI는 Element → Recipe → Manifest → ExecutionRouter → Adapter binding과
  일반 ERC-3643 token enforcement 대비 Corner Store 실행 경로 통제를 표시한다.

### Verification

- `npm test --prefix services/rfq-demo-backend`
- `npm test --prefix services/operator-dashboard`
- `scripts/e2e-anvil.sh --profile buidl-like --mode rfq`
- `git diff --check`

### State

passing

### Notes

- case와 evidence는 local Anvil 운영 워크스페이스다. production의 영속 case store,
  인증, 감사 로그 서명과 외부 indexer를 대신하지 않는다.

## SDK-001 — Modular Integration and Deployment Toolkit

### Behavior

- integrator가 Corner Store core, RFQ SDK, reference application을 구분해 필요한
  모듈만 선택할 수 있다.
- RFQ pricing, inventory/risk, signer와 nonce persistence는 versioned capability
  contract 뒤에서 교체할 수 있다.
- CLI가 reference RFQ service 또는 기존 backend 연결 예제를 secret 없이
  scaffold한다.
- Docker Compose는 필수 runtime이 아니라 선택 가능한 reference deployment
  output으로만 생성한다.
- reference 및 custom module이 같은 conformance suite를 통과한다.

### Verification

- `cd services/rfq && npm test`
- `cd services/toolkit && npm test`
- `cd services/cli && npm test`
- generated scaffold build/smoke
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- completed plan: `docs/exec-plans/completed/SDK-001-modular-integration-toolkit.md`
- hosted dealer, custody, production pricing/inventory와 Kubernetes는 범위 밖이다.

## SDK-002 — Standalone Integration and Deployment Workflow

### Behavior

- 외부 사용자가 단일 CLI 흐름으로 프로젝트 생성, 진단, 배포 계획, 검증과 RFQ
  module conformance를 실행한다.
- library-only, reference-service와 existing-backend 모드를 지원하고 Docker는
  명시적으로 선택한 경우에만 생성한다.
- contracts, Toolkit, RFQ SDK와 CLI를 repository 내부 전용이 아닌 package-ready
  artifact로 검증한다.
- 생성 프로젝트는 주소나 secret을 하드코딩하지 않고 versioned config와
  deployment artifact를 source of truth로 사용한다.
- 기존 `toolkit-*` 명령은 compatibility alias로 유지한다.

### Verification

- clean generated-project install/build/doctor
- custom RFQ module conformance CLI
- package dry-run
- repository check
- Docker-independent deployment dry-run

### State

passing

### Notes

- completed plan: `docs/exec-plans/completed/SDK-002-standalone-integration-workflow.md`
- production durable nonce와 service hardening은 #66/#67 module로 유지한다.

## SDK-003 — Publishable Package Release Contract

### Behavior

- CLI, Toolkit과 RFQ SDK를 각각 npm tarball로 build/pack하고 저장소 밖 clean
  project에서 설치한다.
- Toolkit의 public CommonJS/types export와 기본 config simulation을 packed artifact
  기준으로 검증한다.
- package SemVer, schema/capability version 분리, release gate와 rollback 가능한
  migration 절차를 문서화한다.
- generated project의 RFQ conformance, CLI doctor/deploy dry-run과 packaged contract
  build가 repository-relative package resolution 없이 통과해야 한다.

### Verification

- `npm test --prefix services/toolkit`
- `npm test --prefix services/rfq`
- `npm test --prefix services/cli`
- `scripts/sdk-product-smoke.sh`
- `git diff --check`

### State

passing

### Notes

- production npm registry publish와 release credential 사용은 이 저장소 검증 범위
  밖이며, PR merge 후 별도 release 권한으로 수행한다.

## STUDIO-001 — Local Deployment Studio

### Behavior

- 로컬 운영자가 브라우저에서 integration mode를 선택하고 실제
  `corner-store.config.json`, `corner-store.integration.json`과 demo-only
  `corner-store.scenario.json`을 생성·검토한다.
- Local Control API가 허용된 workspace 내부에서만 CLI를 실행하고 `doctor`,
  deployment dry-run, Anvil demo broadcast와 `verify` 결과를 구조화해 반환한다.
- required doctor failure는 배포를 차단하고, 배포 artifact는 주소의 source of
  truth로 표시하며 verify 이후 기존 Operations Dashboard로 handoff한다.
- UI는 demo fixture와 production configuration을 명확히 분리하고 private key,
  production secret 또는 mainnet broadcast 입력을 제공하지 않는다.
- integration mode와 account/governance role label은 contextual guide로 실제
  생성물, integrator 책임과 reference 경계를 설명한다.
- network preset은 Anvil, public testnet, Arbitrum과 GIWA/custom EVM을 설정 및
  dry-run 대상으로 제공하되 direct broadcast는 runtime 오설정으로도 확장할 수
  없는 Anvil-only gate와 operator RPC allowlist로 제한한다.
- RFQ module은 검증된 reference ID와 custom adapter slot을 선택하게 하며,
  module ID 입력이 package 설치나 runtime 구현을 의미하지 않음을 표시한다.
- Activation은 온체인 mutation 버튼이 아닌 manual evidence checklist임을
  명시한다.

### Verification

- Local Control API path confinement와 command guard unit/smoke
- config/integration validation과 JSON persistence smoke
- doctor → dry-run → artifact/verify state transition smoke
- Deployment Studio static UI/control wiring smoke
- contextual help, network preset/custom target와 module preset/custom slot smoke
- 로컬 Anvil deployment walkthrough
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- Completed plan: `docs/exec-plans/completed/STUDIO-001-local-deployment-studio.md`
- production ERC-3643 onboarding, mainnet deploy/multisig execution과 secret custody는
  범위 밖이다.

## RFQ-POLICY-001 — Production RFQ Policy

### Behavior

- production RFQ v1은 protocol non-custodial, exact full-fill을 유지한다.
- maker settlement account와 quote signer를 분리하고 current authorization을
  fill 시점에 다시 검사한다.
- durable nonce는 maker scope에서 atomic/monotonic하게 할당되며 idempotency
  conflict와 restart reconciliation을 지원한다.
- pricing/inventory risk는 서명 전 fail-closed module이고 Router의 최신
  compliance가 최종 gate다.
- partial fill은 기존 quote의 옵션이 아니라 새 quote/adapter version이다.
- finite compliance cap은 regulated asset quantity에 적용한다.

### Verification

- ADR/product spec consistency review
- current contract/SDK gap mapping
- hostile concurrency, signer rotation과 fill-time policy test matrix
- independent architecture/critic review
- `git diff --check`

### State

passing

### Notes

- completed plan: `docs/exec-plans/completed/RFQ-POLICY-001-production-rfq-policy.md`
- 특정 custodian/dealer/KMS/database vendor와 법률 적합성은 범위 밖이다.
## CMP-004 — Wave-3 Illustrative Element Library

### Behavior

- 새로 문서화된 illustrative element 6개를 구현한다: A-06 Affiliate,
  A-12 Red Flag Knowledge Bar, E-03 Bad Actor Disqualification,
  F-01 Operator Self-Dealing, F-03 Fraud Surveillance,
  F-04 Reg M restricted-period buying gate. 각 element는 `docs/elements`
  브랜치에 추가된 new-format `docs/compliance/elements` walkthrough 문서를
  근거로 구현한다.
- attestation setter는 operator-gated(`Governed`/`onlyOperator`)이며 production
  data source는 각 element 헤더의 approval-gated seam으로 남는다.
- fail-closed default를 유지한다. F-01 OperatorSelfDealing은 `registryAvailable`
  default가 false여서 operator가 roster를 적재하고 명시적으로 켜기 전까지 모든
  거래가 fail-closed된다.
- monitoring element(A-12, F-03)는 거래를 막지 않는다. A-12는 pre-trade
  STATELESS로 표시만 하고 `check()`는 항상 pass하며, F-03은 STATEFUL post-trade
  로 no-tipping-off party-facing surface(operator-gated view)를 통해 감시만 한다.
- illustrative reference wiring이며 approved production policy가 아니다.
  element는 `tools/deploy-wave3/DeployWave3Elements.s.sol`에서 opt-in으로만
  등록하고 active recipe에 붙이지 않는다. 기본 demo 배포 범위는 변경하지 않는다.
- CLI(`services/cli`)의 reason-decode 테이블이 wave-3 6개 element를 wave-2와
  동일한 수준(name label + per-element reason-code decode 테이블 + smoke-test
  enumeration)으로 커버한다. wave-2와 마찬가지로 `attest` 명령
  (`services/cli/src/elements.ts`의 `ELEMENT_IDS`, 원본 9개)이나 DeployStack에는
  추가하지 않는다.

### Verification

- `forge test --offline`(전체 770/770, pre-task 582 + 신규 188).
- `cd services/cli && npm test`(CLI reason-decode 테이블이 이제 wave-3를 커버).
- per-element unit test: `test/unit/compliance/elements/Affiliate.t.sol`,
  `test/unit/compliance/elements/RedFlagKnowledgeBar.t.sol`,
  `test/unit/compliance/elements/BadActorDisqualification.t.sol`,
  `test/unit/compliance/elements/OperatorSelfDealing.t.sol`,
  `test/unit/compliance/elements/FraudSurveillance.t.sol`,
  `test/unit/compliance/elements/RegMIssuerBuying.t.sol`.
- `forge fmt --check`.
- `forge lint --severity high --deny warnings src`.

### State

passing

### Notes

- wave-2 precedent은 `TOOLKIT-001` Notes(기본 script discovery 밖 opt-in 등록으로
  기본 demo의 컴파일 그래프/배포 범위 보존)와 동일하다. wave-3 element는
  DeployStack이나 active recipe에 추가하지 않는다.
- production data-source seam은 각 element 헤더에 문서화되어 있다(OFAC/ONCHAINID/
  EDGAR 등은 approval-gated seam).
- F-01 OperatorSelfDealing의 `registryAvailable` fail-closed default는 deploy
  script가 자동으로 켜지 않는다. operator가 roster 적재 후 명시적으로
  `setRegistryAvailable(true)`를 호출해야 통과가 시작된다.
- F-03 FraudSurveillance는 STATEFUL(`BaseStatefulElement`)이므로 배포 후
  `setEngine(engine)` wiring이 필요하다(wave-2 D-01 HolderCount와 동일 패턴).
