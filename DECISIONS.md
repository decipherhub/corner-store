# Decisions

## D018 — Investor and issuer journeys stay a browser-only reference service

Date: 2026-09-05

### Context

Figma defines connected investor qualification/RFQ and issuer onboarding journeys,
but the repository's existing dashboards have narrower operator, deployment or
testnet-wallet responsibilities. Folding the designs into those services would blur
production trust boundaries and couple a presentation state machine to live APIs.

### Decision

Implement the journeys in `services/product-portal-demo` as a dependency-free,
browser-only reference service. It reuses visual and server conventions but owns no
wallet, PII, provider, legal decision, signer, inventory or settlement authority.
Cross-flow activation is persisted only in same-origin `localStorage`. Product-like
wallet, provider, dealer, signer and settlement facades may expose interactive status
and evidence, but they must not acquire those external authorities or export demo
results as production evidence.

### Alternatives Considered

- Extend Operator Dashboard: rejected because it is a read-only operational surface,
  not an investor or issuer workflow.
- Extend Deployment Studio: rejected because local deployment orchestration must not
  become a product onboarding simulator.
- Connect immediately to production APIs: rejected because authenticated provider,
  legal, custody and settlement contracts are outside the Figma interaction spec.

### Consequences

- Product UX can be tested and demonstrated without changing Anvil, GIWA or production
  execution paths.
- UI state cannot be cited as production compliance, onboarding or settlement evidence.
- A future production frontend must replace the reference state ports with explicit,
  authenticated APIs and preserve fail-closed boundaries.

### Related Files

- `services/product-portal-demo/`
- `docs/product-portal-demo.md`
- `INTERACTION_SPEC.md`
- `FEATURES.md`

## D010 — Configuration-driven Toolkit is the operator entry point

Date: 2026-07-22

### Context

CLI 명령과 Foundry 배포 스크립트를 사용자가 각각 조합하면 자산 profile, venue,
deployment artifact가 서로 어긋날 수 있고, 같은 설정을 dashboard/backend가
재사용하기 어렵다.

### Decision

versioned JSON Toolkit config를 사용자 입력의 source of truth로 둔다. 초기 schema는
asset profile, deployment artifact/network, 활성 venue와 operator/investor/maker
role reference를 포함하며, 공통 validator가 CLI와 이후 deployer/API/dashboard에서
재사용된다. CLI는 `toolkit-init`과 `toolkit-validate`를 제공하고, 배포 artifact의
profile과 설정이 충돌하면 fail-closed한다.

### Alternatives Considered

- CLI별 옵션과 Foundry env만 유지: 반복 입력과 profile drift를 막지 못해 제외
- YAML을 먼저 도입: 새 parser dependency와 두 개의 설정 문법을 만들게 되어 JSON
  schema를 먼저 확정한 뒤 adapter로 확장하기로 함

### Consequences

- deployment/simulation/operator workflow가 동일한 설정 계약을 소비할 수 있다.
- schema migration과 secret custody는 별도 단계로 남는다.

### Related Files

- `services/toolkit/src/config.ts`
- `docs/architecture/deployment-operations.md`
- `FEATURES.md`

## D001 — Repository-managed Harness를 사용한다

Date: 2026-06-09

### Context

프로젝트 상태와 다음 작업이 대화나 외부 메모에 의존하면 새 에이전트 세션이
정확한 범위와 완료 조건을 복구하기 어렵다.

### Decision

다음 역할을 저장소 파일로 관리한다.

- 진입 지침: `AGENTS.md`
- 아키텍처 라우터: `ARCHITECTURE.md`
- feature 상태: `FEATURES.md`
- 세션 상태: `PROGRESS.md`
- 결정 이유: `DECISIONS.md`
- 품질 상태: `QUALITY.md`
- 큰 작업 계획: `docs/exec-plans/`
- 전체 검증: `scripts/check.sh`

### Alternatives Considered

- 대화와 외부 노트만 사용: 세션 간 복구와 검증 근거가 약해 제외
- 모든 내용을 `AGENTS.md`에 작성: 진입 문서가 길어지고 중복되므로 제외

### Consequences

- 작업 전후 상태 문서 갱신 비용이 생긴다.
- 대신 작업 범위, 결정 이유와 검증 결과가 저장소에 남는다.

### Related Files

- `AGENTS.md`
- `FEATURES.md`
- `PROGRESS.md`

## D002 — 외부 제품 방향을 별도 migration feature로 반영한다

Date: 2026-06-09

### Context

팀 공유 입력에는 SDK/reference DEX와 4-Layer compliance 모델을 설명하는 새 제품
방향이 있다. 기존 공식 문서와 동시에 수정하면 Harness 구조 변경과 제품 경계
변경이 섞인다.

### Decision

Harness baseline에서는 당시 `docs/`를 공식 source of truth로 유지했다. 외부 입력
반영은 `DOC-001` feature와 별도 Exec Plan에서 수행했다.

### Alternatives Considered

- Harness 작업과 아키텍처 migration을 동시에 수행: 변경 범위와 검증 기준이
  혼합되어 제외

### Consequences

- HE-001 동안 당시 문서와 다음 방향 입력 자료가 함께 존재했다.
- DOC-001에서 채택된 방향을 공식 source-of-truth에 반영하고 migration pending
  상태를 종료한다.

### Related Files

- `docs/exec-plans/completed/DOC-001-imported-architecture-alignment.md`
- `docs/product-specs/index.md`
- `FEATURES.md`

## D003 — SDK를 주 제품, Corner Store를 reference DEX로 정의한다

Date: 2026-06-09

### Context

기존 문서는 Corner Store 자체를 multi-venue execution product로 설명했다.
팀 공유 자료는 장기 성공 기준을 제3의 DEX와 운영주체가 재사용하는 DEX-level
compliance 표준과 SDK 채택으로 정의한다.

### Decision

주 제품은 등록 가능한 compliance policy core와 교체 가능한 execution venue
integration kit로 구성된 Solidity SDK다.

- Compliance Core는 context, Element/Recipe/Manifest registry, evaluation과
  structured decision을 제공한다.
- Execution Integration Kit는 generic `ExecutionRouter`, `VenueRegistry`, 공통
  Adapter interface와 dispatch/replay protection을 제공한다.

Corner Store DEX는 SDK에 구체 Adapter, testnet policy fixture와 배포·운영 구성을
결합해 실행 가능성을 증명하는 reference implementation이다.

### Alternatives Considered

- Corner Store DEX만 제품으로 유지: integration 재사용성과 표준화 목표를 충분히
  설명하지 못해 제외
- TypeScript client SDK를 즉시 주 제품으로 정의: 실제 소비자와 ABI가 없어 범위를
  과도하게 확정하므로 제외

### Consequences

- SDK 공통 컴포넌트는 Uniswap이나 Corner Store-specific 코드에 의존하지 않는다.
- 정책은 Element/Recipe/Manifest 등록으로, 실행 venue는 Adapter 등록으로 확장한다.
- Uniswap v3/RFQ/Order Book의 구체 Adapter와 Corner Store 배포 구성은 reference
  구현이며 SDK integrator에게 강제되지 않는다.
- TypeScript tooling과 package 배포 형식은 실제 integration 요구가 생길 때 결정한다.

### Related Files

- `docs/MVP-v2-multi-venue.md`
- `docs/ROADMAP.md`
- `ARCHITECTURE.md`

## D004 — 이름 기반 4-Layer와 cumulative multi-Recipe를 사용한다

Date: 2026-06-09

### Context

기존 3-Layer 문서는 Recipe가 자산 정책과 규제 조합을 함께 담당하고, 거래당 하나의
Recipe를 선택하는 인상을 주었다. 법률 연구는 한 거래에 발행·재판매·펀드·행위
등 복수 법률효과가 동시에 적용된다는 구조를 제시했다.

### Decision

거래 측 compliance를 Element, Recipe, Manifest, Operator의 이름 기반 4-Layer로
정의한다.

- Element: 구성요건 사실
- Recipe: 법률효과 하나
- Manifest: 자산별 Recipe/engine/version/coverage binding
- Operator: 판단·승인·감시

거래마다 applicable Recipe를 식별한다. Required Recipe의 Element는 cumulative
AND로 평가하고, ADR-007 이후 명시적 path option과 flag-only binding을 분리한다.
기존 ExecutionRouter, ComplianceEngine과 Adapter 분리는 유지한다.

### Alternatives Considered

- 기존 Token Policy에 모든 정보를 유지: 법률 조합과 자산 binding 책임이 섞여 제외
- 하나의 종합 Recipe 사용: 독립 법률효과의 재사용과 동시 적용을 표현하기 어려워 제외

### Consequences

- Manifest lifecycle과 multi-Recipe orchestration이 핵심 구현 phase가 된다.
- Element 수와 production 법률 기준은 별도 승인 전 확정하지 않는다.
- acquisition source, stateful commit hook과 reject logging은 열린 결정으로 남는다.

### Related Files

- `docs/architecture/compliance-policy.md`
- `docs/architecture/asset-manifest.md`
- `docs/ROADMAP.md`

## D005 — 누락된 자산 분류는 fail-closed한다

Date: 2026-06-09

### Context

연구 입력의 실행 흐름은 Manifest가 없는 일반 ERC-20에 early exit를 제안한다.
그러나 Manifest 부재만으로 자산이 비규제임을 판정하면 regulated asset의 onboarding
누락이 public path 우회로 바뀔 수 있다.

### Decision

일반 ERC-20 public execution은 명시적 `UNREGULATED` 분류에만 허용한다. Manifest와
`UNREGULATED` 분류가 모두 없는 자산은 `UNKNOWN`으로 fail-closed한다.

`ACTIVE` Manifest의 invalid reference, unsupported engine 또는 version 오류도
fail-closed한다.

pair 거래에서는 `tokenIn`과 `tokenOut`을 각각 분류한다. 양쪽 모두 명시적
`UNREGULATED`일 때만 public pass-through를 허용하고, 하나 이상의 regulated 자산이
있으면 양쪽에서 확인된 모든 regulated Manifest를 함께 평가한다.

### Alternatives Considered

- Manifest 부재를 곧바로 public pass-through로 처리: onboarding 누락이 규제
  우회가 될 수 있어 제외
- 모든 자산을 regulated로 처리: 일반 ERC-20 integration 비용이 과도해 제외

### Consequences

- API, event와 테스트가 `UNKNOWN`, `UNREGULATED`, regulated evaluation을
  구분해야 한다.
- mixed pair와 regulated-regulated pair에서 어느 한쪽의 Manifest도 생략할 수 없다.
- production onboarding에서 명시적 asset classification을 요구한다.
- 기술적으로 우회 불가능한 규제 enforcement가 필요하면 별도 venue 통제가 필요하다.

### Related Files

- `docs/MVP-v2-multi-venue.md`
- `docs/architecture/asset-manifest.md`
- `docs/security.md`

## D006 — Corner Store compliance 보장은 Router 경로에 한정한다

Date: 2026-06-21

### Context

PR #12 이후 Corner Store 내부 실행 경로는 다음 경계를 갖는다.

- regulated-regulated pair에서 양쪽 ACTIVE Manifest를 모두 평가한다.
- 누락된 Recipe reference는 fail-closed한다.
- AMM Adapter 실행은 Router-only다.
- Router caller는 `context.initiator`와 일치해야 한다.

그러나 이런 보강은 Corner Store 경로를 거치는 거래에만 적용된다. 사용자가
ERC-3643 token을 직접 전송하거나, AMM pool/RFQ settlement/wrapper/custodian을
직접 사용하면 `ExecutionRouter`, `ComplianceEngine.evaluate()`와
`ComplianceEngine.commit()`을 우회할 수 있다.

### Decision

현재 skeleton의 보안·제품 보장은 제한된 범위 모델로 정의한다.

Corner Store는 router-mediated trade에 대해 DEX-level compliance를 강제한다.
Router 밖의 RWA 이동 또는 경제적 소유권 이전은 자동으로 Corner Store 4-Layer
evaluation과 stateful `commit()`을 거치지 않는다.

Router 밖 경로는 production deployment에서 다음 중 하나로 처리해야 한다.

- ERC-3643 token/compliance module이 핵심 제한을 직접 강제한다.
- end user가 직접 호출할 수 없는 controlled venue/settlement로 제한한다.
- 제품 문서와 사용자-facing 설명에서 명시적으로 out-of-scope로 선언한다.

### Alternatives Considered

- Router-exclusive model을 즉시 확정: 임의의 third-party pool과 직접 호출 가능한
  venue를 기술적으로 차단하는 방식이 아직 설계되지 않아 제외한다.
- Token-level enforcement model을 즉시 확정: ERC-3643 issuer module이 Corner
  Store의 모든 Recipe, cap, venue와 surveillance 요구를 대체한다는 외부 운영
  계약이 없어 제외한다.
- 모든 non-router path를 암묵적으로 안전하다고 취급: Corner Store 검사가 생략될
  수 있어 제외한다.

### Consequences

- `docs/security.md`와 `ARCHITECTURE.md`는 protected path와 non-protected path를
  명시해야 한다.
- RFQ/Order Book settlement와 future Adapter는 Router-only authorization 또는
  동등한 호출자 제한을 merge 조건으로 가져야 한다.
- 직접 ERC-3643 transfer, 직접 venue call, wrapper/vault/custodian과 offchain
  beneficial ownership transfer는 별도 제한·위임·out-of-scope 결정 전까지 Corner
  Store 보장으로 표현하지 않는다.
- Stateful surveillance는 Router 경로에서만 완전성을 주장할 수 있다.

### Related Files

- `docs/security.md`
- `ARCHITECTURE.md`
- `docs/architecture/execution-routing.md`

## D007 — PD-1~PD-7 Phase 1 architecture baseline을 확정한다

Date: 2026-07-14

### Context

Phase 1 구현 전에 Manifest schema, Recipe evaluation, post-trade state,
identity claim, enforcement action, governance와 lifecycle record 보존 방식에
대한 개발팀 합의가 필요했다.

이 결정들은 BUIDL-like demo나 RFQ/API 구현보다 상위의 아키텍처 baseline이다.

### Decision

PD-1~PD-7을 Phase 1 architecture baseline으로 확정한다.

- PD-1: Manifest는 explicit core + registry-backed `RecipeBinding` 구조를 사용한다.
- PD-2: Router/Engine은 Manifest-level multi-Recipe binding 모델을 사용한다.
- PD-3: token transfer 기준 acquisition timestamp와 router execution context를 분리하고, post-trade commit은 idempotent하게 처리한다.
- PD-4: investor qualification은 ERC-3643/ONCHAINID claim pipeline을 기본 인터페이스로 사용하고, Securitize/TA는 adapter boundary로 연동한다.
- PD-5: `BLOCK`, `FLAG_ONLY`, `OPERATOR_REVIEW` 중심의 enforcement action 모델과 constrained override를 사용한다.
- PD-6: governance authority는 외부 Safe-style multisig를 사용하고, compliance relaxation은 timelock을 요구한다.
- PD-7: Manifest lifecycle은 semantic versioning, append-only history, central pause state와 hash-anchored record preservation을 사용한다.

### Alternatives Considered

- PD별 ADR을 7개로 분리: 현재 결정들이 하나의 Phase 1 구조 freeze를 구성하므로
  단일 baseline ADR로 묶는 편이 리뷰와 추적에 더 적합해 보류한다.
- 현행 `issuanceRecipeId + fundRecipeId` 구조 유지: BUIDL-like demo에는 충분하지만
  future policy 조합과 path option을 표현하기 어려워 transitional 구조로만 남긴다.
- Corner Store 전용 identity model 신설: ERC-3643/T-REX와 ONCHAINID 호환성을
  해치고 TA/KYC provider 연동성이 떨어져 제외한다.

### Consequences

- PD-1~PD-7은 더 이상 열린 구조 질문이 아니며, 후속 작업은 구현 명세와 migration issue로 진행한다.
- 현재 코드의 transitional 구조는 별도 implementation branch에서 `RecipeBinding[]`, compiled plan, lifecycle registry 등으로 이전해야 한다.
- 실제 Securitize/TA 연동은 공식/current interface 확인 후 별도 refinement issue에서 처리한다.

### Related Files

- `docs/decisions/ADR-007-pd-architecture-decisions.md`
- `docs/decisions/decision-register.md`
- `docs/architecture/phase1-structural-decisions-proposed.md`

## D008 — RFQ v2 hardening: maker approval, full-fill, non-custodial, nonce-scoped cancel

Date: 2026-07-04

### Context

RFQ v1(RFQ-001)은 EIP-712 signed quote와 router-only settlement를 확정했으나
dealer approval, signer custody, quote cancellation, partial fill을 열린 항목으로
남겼다(`docs/security.md` RFQ Safety, D006 protected-path 경계). v2 hardening에서
maker approval gate와 maker-initiated cancellation을 구현하면서 이들 항목의 범위와
정책을 확정할 필요가 있다.

### Decision

RFQ venue의 다음 정책을 확정한다.

- maker approval은 adapter-local하며 operator가 관리한다(`RFQAdapter.approvedMaker`,
  `setMakerApproved` onlyOperator). 여러 quote-driven venue가 공유하는 dealer
  registry는 두 번째 quote-driven venue가 생길 때까지 도입하지 않는다.
- fill 정책은 full-fill을 유지한다. compliance 판정은 평가된 정확한 amount에
  바인딩되며, partial fill은 아직 설계되지 않은 per-fill 재평가 semantics를
  요구하므로 채택하지 않는다.
- custody는 non-custodial을 유지한다. settlement는 두 개의 `safeTransferFrom`
  leg로 수행하며, adapter는 자산을 보관하지 않는다. custodial RFQ variant는
  범위 밖이다.
- cancellation은 nonce-scoped이며 idempotent하다. `usedQuoteNonce` fill guard를
  재사용하여 cancel과 fill이 같은 nonce namespace를 공유한다. cancel-vs-fill
  race는 먼저 채굴된 transaction으로 해소된다.

### Alternatives Considered

- 공유 dealer registry를 즉시 도입: 두 번째 quote-driven venue가 없어 abstraction을
  과도하게 확정하므로 제외
- partial fill 지원: compliance 판정과 amount binding, per-fill 재평가 semantics가
  미설계여서 제외
- custodial settlement: 자산 보관 위험과 별도 신뢰 가정이 필요해 reference 범위
  밖으로 제외
- cancel을 revert 기반 또는 별도 mapping으로 구현: fill guard와 상태를 이중화하고
  race semantics를 복잡하게 만들어 제외

### Consequences

- maker off-boarding은 operator의 `setMakerApproved(maker, false)`로 처리한다.
- signer key custody와 operator key management(multisig/HSM/rotation)은 여전히
  open decision이며 production hardening에서 확정한다.
- partial fill과 dealer inventory risk는 별도 feature spec 전까지 비활성이다.
- 위협 모델은 `docs/rfq-threat-model.md`가 source of truth다.

### Related Files

- `docs/rfq-threat-model.md`
- `docs/security.md`
- `src/execution/adapters/rfq/RFQAdapter.sol`
- `FEATURES.md`

## D009 — Reg D 506(c) recipe를 9-element reference set으로 확장한다

Date: 2026-07-04

### Context

reference Reg D 506(c) set을 향한 compliance module buildout이 최우선 작업이다.
strategy report note-14는 Reg D 506(c) 판정을 9개 element로 분해한다. 기존
`RegD506cRecipe`는 illustrative 2-element(A-01 sanctions + A-03 accredited)만
요구했다. 나머지 element와 recipe 확장을 landing하면서, 열린 legal 결정과
production data source는 여전히 approval-gated로 남겨야 한다(ROADMAP Phase 1:
"implemented for illustrative/reference Elements and Recipes; production legal
criteria remain approval-gated").

### Decision

- 6개의 새 illustrative element를 추가한다(note-14 Reg D 506(c) set의 adapter):
  `Jurisdiction`(A-02), `IdentityUniqueness`(A-04), `UsTaxResident`(A-05),
  `AssetClassification`(B-01, `bytes32 requiredClassification` 생성자 인자),
  `Erc3643Native`(B-02), `FormDFiling`(E-01). attestation setter는 모두
  operator-gated(`Governed`/`onlyOperator`)이며, production data source
  (OFAC oracle, ONCHAINID claim, ERC-165 introspection, EDGAR)는 approval-gated
  seam으로 남는다.
- `RegD506cRecipe`를 in-place로 9-element set으로 확장한다(순서: A-01, A-02,
  A-03, A-04, A-05, B-01, B-02, C-01, E-01). recipe id는 1 유지, version은 2로
  bump, 여전히 always-applicable. 이는 illustrative reference wiring이며 approved
  production policy가 아니다(ROADMAP/MVP-v2 gating 언어를 따른다).
- C-01 Lockup은 test fixture에서 injected mock acquisition source
  (`IAcquisitionSource`)를 통해서만 참여한다. production acquisition/lot data
  source 결정과 holding-period 활성화 default는 변경하지 않는다(CR-3 seam,
  ROADMAP: "acquisition data가 필요한 Recipe는 data source가 결정되기 전
  활성화하지 않는다"). recipe는 illustrative fixture로 남는다.

### Alternatives Considered

- 새 element에 ungated setter를 사용(legacy mock element와 동일): state-input
  write-gate가 없어 hardening 방향과 어긋나므로 제외. 대신 새 element는
  `Governed`/`onlyOperator`를 쓴다(legacy element와의 divergence).
- Lockup을 recipe에서 제외: 9-element reference set을 완전히 wiring하지 못하므로
  제외. mock acquisition source로 fixture에서만 활성화한다.
- production data source(OFAC/ONCHAINID/ERC-165/EDGAR)를 지금 연결: legal 검토와
  data source 결정이 미완이라 제외. approval-gated seam으로 남긴다.

### Consequences

- ungated legacy mock element(Sanctions A-01, AccreditedInvestor A-03,
  QualifiedPurchaser)와 새 operator-gated element 사이에 hardening divergence가
  생긴다. legacy element 정렬은 follow-up으로 추적한다.
- `RegD506cRecipe`(id 1)를 issuance recipe로 쓰는 모든 fixture(unit
  `Engine.t.sol`, 통합 `IntegrationBase`/`SwapFlow`)는 9개 element를 모두
  만족하도록 buyer/asset attestation을 추가해야 했다(fix fixtures, not product
  code). engine/registry/router product code는 변경하지 않았다.
- production 활성화 전 legal 검토, acquisition/lot data source 결정, production
  data source 연결은 여전히 open이다.

### Related Files

- `src/compliance/recipes/RegD506cRecipe.sol`
- `src/compliance/elements/Jurisdiction.sol`,
  `src/compliance/elements/IdentityUniqueness.sol`,
  `src/compliance/elements/UsTaxResident.sol`,
  `src/compliance/elements/AssetClassification.sol`,
  `src/compliance/elements/Erc3643Native.sol`,
  `src/compliance/elements/FormDFiling.sol`,
  `src/compliance/elements/Lockup.sol`
- `test/integration/IntegrationBase.sol`,
  `test/integration/RegD506cElements.t.sol`
- `test/unit/compliance/Recipes.t.sol`, `test/unit/compliance/Engine.t.sol`
- `docs/ROADMAP.md`

## D010 — Manifest lifecycle를 validated state machine로 만들고 engine을 default-deny로 닫는다

Date: 2026-07-04

### Context

MVP-v2 §5는 asset Manifest에 explicit operator approval step을 포함한 full
lifecycle을 요구한다. 기존 `TokenPolicyRegistry`는 임의 상태를 덮어쓰는 raw
`setStatus`만 제공했고(승인 단계 없음), `ComplianceEngine.evaluate`는 SUSPENDED와
UNKNOWN만 명시적으로 reject한 뒤 나머지를 `_evaluateActivePair`로 흘려보냈다. 이
구조에 PROPOSED/RETIRED 상태를 추가하면 두 개의 fail-open 구멍이 생긴다: (a)
PROPOSED/RETIRED 자산이 UNREGULATED와 pair되면 element가 0개 수집되어 `allowed =
true`, (b) PROPOSED/RETIRED가 ACTIVE와 pair되면 ACTIVE side만 검증되고 거래가
통과한다.

### Decision

**1. Lifecycle state machine (states/transitions).** Manifest는 아래 transition만
허용하는 명시적 state machine을 따른다. 그 외 모든 (state, action)은 dedicated
custom error `Errors.InvalidManifestTransition`으로 revert한다.

| From | Action | To | Gate |
| --- | --- | --- | --- |
| UNKNOWN 또는 RETIRED | `registerManifest` | PROPOSED | onlyOwner |
| PROPOSED | `approveManifest` | ACTIVE | onlyOperator (issuance recipe 필수) |
| ACTIVE | `suspendManifest(reasonCode)` | SUSPENDED | onlyOperator |
| SUSPENDED | `scheduleManifestResume` 후 `resumeManifest` | ACTIVE | owner schedule + timelock + operator execute |
| ACTIVE 또는 SUSPENDED | `retireManifest(reasonCode)` | RETIRED (terminal) | onlyOperator |
| UNKNOWN | `setUnregulated` | UNREGULATED | onlyOwner |
| UNREGULATED | `clearUnregulated` | UNKNOWN | onlyOwner |

`registerManifest`는 caller가 넣은 `m.status`를 무시하고 항상 PROPOSED로 착지하며
`declaredBy = msg.sender`를 기록한다. `approveManifest`는 `approvedBy = msg.sender`를
기록한다. MANIFEST-002 이후 completeness floor는 deprecated issuance field가 아니라
비어 있지 않고 최소 하나의 blocking/path gate가 있는 validated `RecipeBinding[]`다.
RETIRED는 terminal이며 재발행은 RETIRED→register→approve 경로로만 가능하다. gating
model: owner가 자산을 classify/declare(register/setUnregulated/clearUnregulated)하고,
operator가 approve/suspend/retire와 예약된 resume 실행을 구동한다. resume 예약과
semantic update 예약은 D011에 따라 owner governance가 담당한다.

**2. Enum-append storage rationale.** `PolicyStatus`에 PROPOSED(4)와 RETIRED(5)를
SUSPENDED(3) 뒤에 APPEND한다. 기존 numeric value(UNKNOWN=0, UNREGULATED=1,
ACTIVE=2, SUSPENDED=3)는 storage layout과 enum↔uint cast에서 load-bearing이므로
절대 재정렬하지 않는다. 그 결과 enum의 numeric order는 lifecycle graph의 semantic
order와 일치하지 않는다(type 파일에 명시적 주석). UNKNOWN=0을 유지하는 것은 absent
manifest가 fail-closed default가 되도록 하는 핵심이다.

**3. `setStatus` 제거.** raw `setStatus` overwrite는 제거한다(pre-production
breaking change; 모든 caller/test/factory를 이 feature에서 갱신). validation 없는
상태 덮어쓰기는 approval step과 transition guard를 우회하므로 유지할 수 없다.

**4. Engine default-deny 재구조화 (positive allowlist).** `evaluate`의 enumerated
bad-status 검사(SUSPENDED/UNKNOWN reject)를 side별 positive allowlist로 교체한다:
각 side는 UNREGULATED 또는 ACTIVE여야 하며, 그 외(UNKNOWN/SUSPENDED/PROPOSED/
RETIRED와 미래에 추가될 모든 member)는 fail-closed한다. bad state를 열거하는 대신
permitted state를 열거하는 이유: reject list에 새 상태를 추가하는 것을 잊으면
그대로 fail-open이 되지만, allowlist는 새로 추가된 상태를 default로 거부하므로
"append-only 안전"하다. both-UNREGULATED fast-path pass-through는 유지한다.
`commit`은 router가 `evaluate`를 먼저 호출하고 reject 시 revert하므로 rejected
pair에서 도달 불가능하다 — mirror guard가 필요 없고, in-file 주석으로 이유를
남긴다(재구조화하지 않음).

**5. `clearUnregulated` correction path.** 잘못 UNREGULATED로 tag된 token을
UNKNOWN(clean slate)으로 되돌려 이후 regulated manifest로 register할 수 있게 한다.
onlyOwner이며 UNREGULATED가 아닌 상태에서 호출하면 `InvalidManifestTransition`.
setUnregulated와 대칭인 governance classification 호출이다.

**6. `declaredBy = msg.sender` semantics와 factory consequence.** register는
`declaredBy = msg.sender`, approve는 `approvedBy = msg.sender`를 기록한다.
`CornerStoreFactory.registerRWAToken`은 register→approve를 한 governed call에서
연속 실행하며 factory가 registry의 owner이자 approving operator다(배포 시
governance가 registry ownership을 factory로 이전). 그 결과 이 경로로 onboarding된
token의 `declaredBy`/`approvedBy`는 factory 주소이며, attribution은 factory
경계에서 멈춘다.

### Alternatives Considered

- **Engine에서 reject list(bad state 열거) 유지**: PolicyStatus에 member를 추가할
  때마다 reject list 갱신을 잊으면 fail-open이 되므로 제외. positive allowlist는
  구조적으로 fail-closed default를 보장한다.
- **enum member를 semantic order로 재정렬**: storage layout과 enum↔uint cast가
  깨지므로 제외. append-only만 허용한다.
- **`setStatus`를 deprecated로 유지**: validation 우회 경로가 남으므로 제외
  (pre-production이라 breaking removal 비용이 낮다).
- **PROPOSED/RETIRED에 UNKNOWN/SUSPENDED와 다른 별도 reason-code family 부여**:
  기존 `_rejectPolicy`가 이미 `uint32(status)`를 reason code에 인코딩하므로 side의
  실제 status를 그대로 넘기면 distinct code가 자동으로 나온다 — 추가 scheme 불필요.

### Consequences

- 모든 onboarding은 propose→approve 2단계를 거친다(factory는 한 call에서 collapse).
- ACTIVE manifest의 issuance recipe re-point는 retire→register→approve 경로를
  써야 한다(ACTIVE 위 re-register는 illegal).
- engine은 미래에 PolicyStatus member가 추가되어도 default로 fail-closed한다.
- fixture는 register→approve(및 UNREGULATED는 setUnregulated)로 통일된다.

### Related Files

- `src/types/ComplianceTypes.sol` (enum append + 주석)
- `src/registry/TokenPolicyRegistry.sol`,
  `src/interfaces/compliance/ITokenPolicyRegistry.sol`
- `src/compliance/ComplianceEngine.sol` (evaluate default-deny gate)
- `src/factory/CornerStoreFactory.sol` (register+approve, natspec)
- `test/unit/compliance/Engine.t.sol`,
  `test/unit/registry/TokenPolicyRegistry.t.sol`
- `test/integration/EmergencyPause.t.sol`, `test/integration/IntegrationBase.sol`,
  `test/integration/Surveillance.t.sol`

## D011 — 위험 중단은 즉시, 재개와 Manifest 의미 변경은 timelock으로 분리한다

Date: 2026-07-22

### Context

ADR-007은 모든 Router가 공유하는 central pause state, 즉시 containment, 지연된
compliance relaxation, Manifest semantic version/history 보존을 요구한다. 기존
reference stack은 venue suspension과 Manifest status만 있어 global/asset pause가
없었고, 재개와 core fact 변경을 즉시 수행할 수 있었다. 배포 후
`TokenPolicyRegistry.owner()`가 Factory가 되므로 owner-only governance 호출을 EOA가
직접 실행할 수도 없었다.

### Decision

1. `OperatorRegistry`를 global/asset/venue pause의 source of truth로 사용하고 Router는
   nonce 소비와 compliance evaluation 전에 세 범위를 모두 fail-closed로 검사한다.
2. operator는 pause와 Manifest suspend처럼 위험을 줄이는 동작을 즉시 수행한다.
   unpause는 owner가 예약하고 최소 1일 뒤 owner가 실행한다.
3. Manifest resume와 ACTIVE/SUSPENDED semantic update도 owner 예약과 최소 1일
   timelock을 요구한다. update activation은 version을 증가시키며 기존 SUSPENDED
   상태를 해제하지 않는다.
4. Manifest version, current hash, chained history hash와 pause history hash를
   보존하고 actor, old/new, reason, effective time을 append-only event로 남긴다.
5. 배포 후 registry owner인 `CornerStoreFactory`가 resume/update schedule/cancel을
   forwarding한다. Factory owner는 production에서 외부 Safe-style governance다.
   registry operator는 delay가 지난 동작의 실행과 즉시 tightening을 담당한다.

### Consequences

- 사고 containment는 timelock 없이 가능하지만 재개는 같은 actor가 즉시 우회할 수
  없다.
- Factory ownership wiring을 유지하면서 governance 호출이 실제 배포에서도
  도달 가능하다.
- chain별 delay, 실제 Safe provider, issuer-level disable과 RecipeBinding migration은
  후속 production 설정/feature다.

### Related Files

- `src/registry/OperatorRegistry.sol`
- `src/registry/TokenPolicyRegistry.sol`
- `src/execution/ExecutionRouter.sol`
- `src/factory/CornerStoreFactory.sol`
- `test/integration/EmergencyPause.t.sol`
- `scripts/e2e-anvil.sh`

## D012 — 취득 lot와 거절·감시 상태는 provider-neutral off-chain 계층으로 수렴한다

Date: 2026-07-22

### Context

ADR-008은 acquisition source, person-group state, reject logging과 Router 밖 transfer
감시를 하나의 off-chain compliance data layer로 결정했다. 기존 `Lockup`은 만료나
lineage 상태 없이 단일 timestamp만 읽었고, 실제 provider 계약이 없다는 이유로
현재 문서에는 해당 결정을 여전히 open으로 표시한 곳이 남아 있었다.

### Decision

1. Transfer Agent별 API는 `TransferAgentProvider` adapter 뒤에 둔다. Corner Store
   core는 Securitize 전용 undocumented field를 하드코딩하지 않는다.
2. per-lot 입력은 acquisition date, payment completion, source type과 lineage를
   검증한다. 단일 holder×asset 온체인 snapshot은 lot 선택을 과대 추정하지 않도록
   현재 lot 중 가장 늦은 유효 clock을 사용한다.
3. 온체인 `AttestedAcquisitionSource`에는 clock, observation/expiry, PII-free
   source hash와 status만 저장한다. missing, broken lineage, stale과 immature는
   `Lockup`에서 서로 다른 reason으로 fail-closed한다.
4. person-group volume/holder state는 execution id로 idempotent하게 commit한다.
   동일 id+동일 내용은 no-op, 동일 id+다른 내용은 충돌로 거부한다.
5. rejected attempt와 Router 밖 transfer finding은 off-chain hash-chain audit
   record로 보존한다. 이 local SDK는 tamper evidence를 제공하지만 production WORM,
   retention 또는 SAR 시스템이라고 주장하지 않는다.

### Consequences

- mock TA로 전체 경계를 테스트할 수 있으나 실제 Securitize compatibility는 공식
  API 계약과 provider 인증을 확인하기 전까지 미구현이다.
- 보수적인 latest-lot clock은 안전하지만 일부 mature lot 매도를 과도하게 막을 수
  있다. amount-specific lot allocation/FIFO는 provider 계약이 확정될 때 별도
  versioned adapter로 추가한다.
- PII, 원본 lot 문서와 감사 원장은 온체인에 저장하지 않는다.

### Related Files

- `docs/decisions/ADR-008-compliance-seam-decisions.md`
- `services/compliance-data/`
- `src/registry/AttestedAcquisitionSource.sol`
- `src/compliance/elements/Lockup.sol`

## D013 — Stateful commit은 regulated token 위치에서 실제 이동 방향을 유도한다

Date: 2026-07-29

### Context

`ctx.buyer`와 `ctx.seller`는 엔진의 검증 대상/상대방 역할이다. RFQ 매도처럼 검증
대상 taker가 RWA를 `tokenIn`으로 보내는 거래에서도 taker를 `buyer` 역할에 유지한다.
기존 commit은 항상 `seller → buyer`로 기록해 실제 `tokenIn` 이동과 반대였다.

### Decision

stateful element의 `onTransfer` 방향은 regulated token 위치에서 결정한다.

- regulated token이 `tokenOut`: `seller → buyer`, `amountOut`
- regulated token이 `tokenIn`: `buyer → seller`, `amountIn`

pre-trade element의 검증 대상 역할과 post-trade 자산 이동 방향을 분리한다.

### Consequences

- RFQ/AMM 매도에서 holder count, surveillance와 후속 stateful element가 실제 RWA
  이동 방향을 받는다.
- `buyer/seller` 명칭만 보고 실제 token sender/recipient를 추론하면 안 된다.

### Related Files

- `src/compliance/ComplianceEngine.sol`
- `test/unit/compliance/Engine.t.sol`
- `docs/architecture/SKELETON_GUIDE.md`

## D014 — RFQ 모듈 의미와 통합·배포 표현을 분리한다

Date: 2026-07-29

### Context

RFQ SDK의 pricing, risk, signer와 nonce seam은 교체 가능했지만 integrator가
reference demo backend나 저장소 전체 구조를 채택하지 않고 해당 계약을 선택·검증·
scaffold하는 공통 표면이 없었다.

### Decision

1. `services/rfq`가 versioned module capability와 공통 conformance 의미를 소유한다.
2. `services/toolkit`은 module ID와 environment variable 이름만 가진 별도
   integration manifest와 secret-free generator를 소유한다.
3. `services/cli`는 reference service 또는 existing-backend scaffold를 rendering할
   뿐 pricing, risk나 compliance 결정을 추가하지 않는다.
4. `services/rfq-demo-backend`는 같은 module contract를 사용하는 reference
   consumer로 유지한다.
5. Docker Compose는 선택형 export이며 Corner Store SDK의 필수 runtime이 아니다.

### Consequences

- integrator는 필요한 RFQ module만 교체하고 기존 backend에 SDK를 삽입할 수 있다.
- conformance는 인터페이스 호환성을 증명하지만 production pricing, signer custody,
  nonce durability, risk 또는 법률 적합성을 인증하지 않는다.
- module config 값과 secret은 manifest나 generated source에 기록하지 않는다.

### Related Files

- `services/rfq/src/modules.ts`
- `services/rfq/src/conformance.ts`
- `services/toolkit/src/integration.ts`
- `services/toolkit/src/scaffold.ts`
- `docs/sdk-integration.md`

## D015 — Production RFQ v1은 non-custodial exact full-fill로 유지한다

Date: 2026-07-30

### Context

RFQ v1과 SDK-001은 protected settlement와 교체 가능한 backend module을 제공하지만
production custody, signer rotation, durable nonce, pricing/inventory risk와 partial
fill 책임은 열려 있었다. 현재 Adapter는 maker inventory account와 ECDSA signer를
동일 주소로 결합하고 Router의 finite `maxAmount`도 결제자산 `amountIn` 축만
검사하므로 그대로 production 경계로 간주할 수 없다.

### Decision

1. production RFQ v1은 protocol non-custodial, atomic exact full-fill을 유지한다.
   잔량은 새 quote로 처리하고 partial fill은 새 quote/adapter version으로 분리한다.
2. maker settlement account와 quote signer를 분리한다. production Adapter는
   ECDSA delegate/ERC-1271을 수용하는 versioned maker-authorizer를 fill 시점에
   검사한다. signer 추가는 governed/delayed, revoke는 즉시 가능하다.
3. production nonce는 `(chainId, adapter, maker)` scope에서 atomic monotonic하게
   할당하고 idempotency key와 request hash를 durable하게 저장한다. 예약한 nonce는
   장애가 나도 재사용하지 않는다.
4. pricing/inventory risk는 operator-owned off-chain module이며 stale/missing
   dependency에서 fail-closed한다. Router의 최신 compliance가 최종 gate다.
5. compliance `maxAmount`는 regulated asset quantity에 적용한다. finite cap 활성화
   전에 buy/sell 방향에 맞게 Router를 수정한다.
6. production endpoint는 auth, TLS, rate limit, PII-free audit와 incident
   reconciliation을 요구한다. Corner Store conformance는 운영·법률 인증이 아니다.

### Consequences

- current exact full-fill quote schema와 non-custodial transfer 원자성은 유지된다.
- signer authorization, regulated amount cap, durable nonce와 production middleware는
  독립 구현 feature로 분리된다.
- 특정 dealer/custodian/KMS/database vendor와 인허가 적합성은 operator 선택 및
  별도 검토로 남는다.

### Related Files

- `docs/decisions/ADR-009-production-rfq-policy.md`
- `docs/product-specs/production-rfq-policy.md`
- `src/execution/adapters/rfq/RFQAdapter.sol`
- `src/execution/ExecutionRouter.sol`
- `services/rfq/`

## D016 — Production deployment uses external signer and staged activation

Date: 2026-07-31

### Context

Deployment Studio and `toolkit-deploy` provide local/demo configuration,
dry-run and Anvil broadcast paths. Treating that browser-controlled path as
production deployment would blur demo fixtures, production ERC-3643 onboarding,
legal approval, signer custody and Safe governance.

### Decision

Production deployment is a separate operations workflow:

1. ERC-3643 token and ONCHAINID onboarding evidence is verified as an external
   issuer trust boundary before Corner Store activation.
2. Governance authority is verified by Safe proxy address, runtime code hash,
   expected singleton/mastercopy, owner count `M`, threshold `N`, owner list,
   chain ID, payload target addresses and calldata before signing.
3. Production signing uses an external signer or Safe-style multisig boundary.
   Browser applications do not hold production keys and do not broadcast
   mainnet/production transactions.
4. Element, Recipe and Asset Compliance Manifest activation requires a
   legal-approved package. Demo profiles, fixture identities and illustrative
   recipes are not production approval evidence.
5. Venue, maker, signer and inventory activation happens only after dry-run,
   fork simulation, multisig review, bytecode/role/Manifest verification and
   monitoring readiness.
6. CLI production broadcast requires a frozen evidence file bound to the
   current config hash, source commit, successful dry-run and target-chain fork
   simulation.

### Alternatives Considered

- Extend Deployment Studio into a production broadcaster: rejected because it
  would put key custody and mainnet mutation behind a browser/local demo control
  surface.
- Treat demo scenario and illustrative recipe data as production activation
  evidence: rejected because legal approval, issuer onboarding and production
  data-source contracts are separate trust boundaries.
- Skip Safe owner/threshold verification and rely on an address label: rejected
  because governance authority depends on the exact owner set, threshold,
  chain and payload.

### Consequences

- Production deployment docs are separate from local/demo runbooks.
- Browser UI may support review and evidence display, but not production
  broadcast.
- Repository tooling may pass without claiming any deployment transaction or
  Safe proposal succeeded on a production network.
- Actual Safe provider, custody vendor, RPC/finality policy and legal approval
  references remain deployment-specific inputs.

### Related Files

- `docs/deployment-production.md`
- `docs/architecture/deployment-operations.md`
- `docs/deployment-studio.md`
- `FEATURES.md`
- `PROGRESS.md`

## D017 — Compliance Core uses immutable versioned policy objects and compiled enforcement

Date: 2026-08-23

### Context

Production asset onboarding needs stable references to legal-approved Elements,
Recipes and Manifest bindings. Mutable registry overwrites, ambiguous aliases,
trade-time override resolution or fabricated generic reason codes would make Safe
review and post-deployment reconciliation unreliable.

### Decision

1. Element registration is immutable for a given `bytes32 elementId`. The registry
   stores the implementation, metadata hash, version hash and default enforcement
   action at registration time.
2. Recipe registration is immutable per `(recipeKey, version)`. The canonical
   `recipeKey` is derived as `keccak256(abi.encode(RECIPE_KEY_DOMAIN,
   aliasHash))`, where `RECIPE_KEY_DOMAIN = keccak256("corner-store.recipe-key.v1")`
   and Toolkit aliases are ASCII-normalized before hashing. The canonical recipe
   family is bijective with its legacy numeric `recipeId`: neither
   `recipeId -> recipeKey` nor `recipeKey -> recipeId` may be rebound, and all
   later versions under the same key continue to use the first registered
   `recipeId`.
3. `TokenPolicyRegistry` compiles Element rules when a Manifest is registered or
   semantically updated. Runtime evaluation consumes the compiled binding plan and
   does not perform unbounded alias or override resolution.
4. Normal onboarding may only strengthen enforcement (`FLAG_ONLY <
   OPERATOR_REVIEW < BLOCK`). `FORCE_FLAG_ONLY` is not a downgrade escape hatch;
   it is valid only when the Element's immutable default is already `FLAG_ONLY`.
5. Compliance rejection should preserve an Element's exact nonzero reason code.
   Recipe-scoped code `1` is retained only as a fallback for Elements that return
   `bytes32(0)` on failure.
6. Production Toolkit/CLI v2 onboarding exports canonical alias/key commitments,
   compiled plan hashes and bounded override calldata, while legacy v1 input and
   numeric `recipeId` compatibility remain accepted for existing demos.

### Alternatives Considered

- Mutable in-place Element or Recipe updates: rejected because reviewed Safe
  payloads and signed quotes could silently point at different policy code.
- Use raw human-readable aliases in runtime paths: rejected because normalization
  and collision handling must be resolved before activation.
- Permit downgrade overrides during normal onboarding: rejected because a token
  onboarding file should not weaken a legal-approved Element default outside a
  separate governance process.
- Always report recipe-scoped generic code `1`: rejected because Elements already
  expose more precise rejection taxonomies needed for audit and operator support.

### Consequences

- New production onboarding should use v2 alias/key and compiled-plan fields.
- Existing local Anvil/demo v1 configs continue to work through legacy numeric
  aliases, but v1 artifacts are compatibility inputs, not production approval.
- Legal approval, ERC-3643/ONCHAINID issuer wiring and TA/KYC provider evidence
  remain external trust boundaries; compiled plan hashes prove only technical
  binding consistency.

### Related Files

- `src/registry/ElementRegistry.sol`
- `src/registry/RecipeRegistry.sol`
- `src/registry/TokenPolicyRegistry.sol`
- `src/compliance/ComplianceEngine.sol`
- `services/toolkit/src/production-onboarding.ts`
- `services/cli/src/commands.ts`
- `docs/architecture/asset-manifest.md`
- `docs/architecture/compliance-policy.md`
