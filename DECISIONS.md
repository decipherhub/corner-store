# Decisions

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

거래마다 applicable Recipe를 식별하고 Element 합집합을 cumulative AND로 평가한다.
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
