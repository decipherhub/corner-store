# Execution & Routing Layer

## Responsibility

이 레이어는 사용자 요청을 받고 Compliance Policy Layer의 결정을 검증한 뒤
허용된 venue adapter로 실행을 위임한다.

핵심 질문은 다음과 같다.

> 이 decision으로 어떤 adapter와 venue를 실행할 수 있는가?

법률 규칙을 직접 평가하거나 AMM 가격 계산, RFQ 협상, Order Book matching을
수행하지 않는다.

## Owned Components

- `ExecutionRouter`
- `VenueRegistry`
- `VenueSelector`
- 공통 execution request와 types
- adapter 등록 및 dispatch
- nonce, deadline, replay protection
- execution events

MVP의 `VenueSelector`는 자동 best execution이 아니다. 사용자가 요청한 venue가
decision 범위에 포함되는지 검증하거나 결정적인 단일 선택만 수행한다.

## Inputs And Outputs

입력:

- 사용자 execution request
- 요청 actor와 token/amount
- venue type 또는 정확한 venue
- nonce와 deadline
- ComplianceEngine이 생성한 decision

출력:

- 검증된 adapter 호출
- execution result와 event
- 위반 시 명시적인 revert/reason

## Trust Boundaries

- Router는 Registry에 등록된 adapter와 venue만 신뢰한다.
- Adapter 구현체 교체와 중단은 권한이 분리된 관리 작업이다.
- decision 자체가 유효해도 요청 parameter가 decision과 다르면 실행하지 않는다.
- Router를 지원 진입점으로 둔다고 표준 pool 직접 호출이 기술적으로 차단되는 것은
  아니다.

## Invariants

- 미등록·중단된 adapter, venue, operator로 실행할 수 없다.
- decision의 actor, token, amount, venue, version, expiry를 다시 검증한다.
- nonce 재사용과 deadline 초과 요청을 거부한다.
- Router는 matching 로직과 법률 규칙을 포함하지 않는다.
- Router에 의도하지 않은 사용자 자산 잔액이 남지 않는다.
- pause 또는 delist 이후 신규 실행을 허용하지 않는다.

## Current Decisions

- 단일 `ComplianceRouter` 대신 `ExecutionRouter`와 `ComplianceEngine`을 분리한다.
- 모든 venue는 공통 Adapter 경계를 구현한다.
- 자산마다 허용 venue가 다를 수 있으므로 단순 `token -> pool` 매핑을 사용하지
  않는다.
- MVP에서는 자동 최적 체결과 multi-venue order splitting을 구현하지 않는다.

## Open Decisions

- exact venue 지정과 deterministic selector의 최종 API
- decision을 Router가 직접 생성할지 별도 호출 결과로 받을지
- nonce scope와 batch execution
- adapter upgrade/replace governance
- 일반 ERC-20의 public venue fast path 범위

## References

- [`MVP-v2-multi-venue.md` - 전체 아키텍처](../MVP-v2-multi-venue.md#2-전체-아키텍처)
- [`MVP-v2-multi-venue.md` - Venue Registry와 선택 정책](../MVP-v2-multi-venue.md#6-venue-registry와-선택-정책)
- [`MVP-v2-multi-venue.md` - 컨트랙트별 책임](../MVP-v2-multi-venue.md#11-컨트랙트별-책임)
