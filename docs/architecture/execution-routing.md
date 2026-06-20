# Execution & Routing Layer

## Responsibility

이 레이어는 SDK의 **Execution Integration Kit**다. 사용자 요청을 받고 4-Layer
Compliance Stack의 결정을 검증한 뒤 허용된 venue adapter로 실행을 위임한다.

핵심 질문은 다음과 같다.

> 이 decision으로 어떤 adapter와 venue를 실행할 수 있는가?

법률 규칙을 직접 평가하거나 AMM 가격 계산, RFQ 협상, Order Book matching을
수행하지 않는다.

## Owned Components

- 특정 venue에 종속되지 않는 generic `ExecutionRouter`
- Adapter를 등록·중단·교체하는 `VenueRegistry`
- `VenueSelector`
- 공통 execution request와 types
- 공통 Adapter interface, 등록과 dispatch
- nonce, deadline, replay protection
- execution events

MVP의 `VenueSelector`는 자동 best execution이 아니다. 사용자가 요청한 venue가
decision 범위에 포함되는지 검증하거나 결정적인 단일 선택만 수행한다.

Uniswap v3, RFQ와 Order Book의 구체 Adapter 및 Corner Store 배포 configuration은
이 레이어의 공통 SDK가 아니라 reference DEX 구현에 속한다.

## Inputs And Outputs

입력:

- 사용자 execution request
- 요청 actor와 token/amount
- venue type 또는 정확한 venue
- nonce와 deadline

출력:

- 현재 execution context에 대해 `ComplianceEngine`이 생성한 Manifest-bound decision
- 검증된 adapter 호출
- execution result와 event
- 위반 시 명시적인 revert/reason

## Trust Boundaries

- Router는 Registry에 등록된 adapter와 venue만 신뢰한다.
- Adapter 구현체 교체와 중단은 권한이 분리된 관리 작업이다.
- Adapter와 settlement contract는 Router-only authorization 또는 동등한
  호출자 제한을 가져야 한다.
- decision 자체가 유효해도 요청 parameter가 decision과 다르면 실행하지 않는다.
- Router를 지원 진입점으로 둔다고 ERC-3643 직접 전송, 표준 pool 직접 호출,
  wrapper/vault/custodian 이전 또는 offchain beneficial ownership 이전이
  기술적으로 차단되는 것은 아니다.
- Corner Store 4-Layer compliance 보장은 Router 지원 경로에 한정한다. 직접 token
  transfer, 직접 pool/venue 호출과 non-router settlement는 Corner Store 지원
  실행으로 간주하지 않는다.

## Invariants

- 미등록·중단된 adapter, venue, operator로 실행할 수 없다.
- Router는 실제 execution/fill 트랜잭션에서 최신 Manifest와 cumulative
  multi-Recipe 평가 결과를 얻은 뒤 Adapter를 호출한다.
- Adapter에 전달하는 decision은 actor, token, amount, venue, version, expiry와
  execution nonce에 바인딩한다.
- 실행 caller는 `context.initiator`와 일치해야 한다.
- nonce 재사용과 deadline 초과 요청을 거부한다.
- Router는 matching 로직과 법률 규칙을 포함하지 않는다.
- Router에 의도하지 않은 사용자 자산 잔액이 남지 않는다.
- pause 또는 delist 이후 신규 실행을 허용하지 않는다.

## Current Decisions

- policy evaluation과 venue dispatch 책임을 분리하기 위해 `ExecutionRouter`와
  `ComplianceEngine`을 분리한다.
- generic Router와 Adapter 경계는 SDK에 포함하고, 모든 구체 venue는 공통 Adapter
  interface를 구현한다.
- 제3의 DEX는 Router를 수정하지 않고 Adapter 등록으로 execution venue를 확장한다.
- 자산마다 허용 venue가 다를 수 있으므로 단순 `token -> pool` 매핑을 사용하지
  않는다.
- MVP에서는 자동 최적 체결과 multi-venue order splitting을 구현하지 않는다.
- 주문·견적 생성 시점의 평가는 사용자 피드백과 사전 검증에 사용할 수 있지만,
  실제 settlement 권한은 fill 트랜잭션의 최신 평가에서만 생성한다.
- 외부 preview decision은 표시와 사전 검증 용도이며 실행 권한으로 입력받지 않는다.
- 명시적 `UNREGULATED` 자산만 public execution pass-through를 사용할 수 있다.
  이 경로에는 Corner Store 4-Layer 보장이 없다.
- Manifest와 `UNREGULATED` 분류가 모두 없는 자산은 `UNKNOWN`으로 거부한다.
- `ACTIVE` Manifest가 존재하면 invalid Recipe reference, unsupported engine 또는
  상태 불일치를 pass-through로 완화하지 않는다.
- 표준 pool 직접 호출에는 ERC-3643 자체 transfer enforcement만 적용될 수 있다.
  비우회 4-Layer enforcement가 필요한 production RWA venue는 별도 enforcement와
  외부 승인이 확정되기 전 활성화하지 않는다.
- RFQ와 Order Book settlement는 Router-only authorization 또는 동등한 권한 모델이
  확정되기 전 production-supported venue로 취급하지 않는다.

## Open Decisions

- exact venue 지정과 deterministic selector의 최종 API
- 외부 preview API의 응답 형식
- nonce scope와 batch execution
- adapter upgrade/replace governance
- Router-exclusive, token-level enforcement, limited-scope 중 production 보장 모델
- 일반 ERC-20 public venue fast path의 허용 venue와 관측 이벤트 범위
- 자산 classification onboarding과 integrator API

## References

- [`MVP-v2-multi-venue.md` - System Shape](../MVP-v2-multi-venue.md#3-system-shape)
- [`MVP-v2-multi-venue.md` - Multi-Recipe Evaluation](../MVP-v2-multi-venue.md#6-multi-recipe-evaluation)
- [`MVP-v2-multi-venue.md` - Venue Execution](../MVP-v2-multi-venue.md#8-venue-execution)
