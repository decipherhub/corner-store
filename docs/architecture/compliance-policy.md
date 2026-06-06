# Compliance Policy Layer

## Responsibility

이 레이어는 거래 context와 versioned policy를 평가해 구조화된
`ComplianceDecision`을 생성한다.

핵심 질문은 다음과 같다.

> 이 거래가 현재 허용되는가? 허용된다면 어떤 venue에서 얼마까지 가능한가?

이 레이어는 swap, quote fill, order fill을 직접 실행하지 않는다.

## Owned Components

- `ComplianceEngine`
- `TokenPolicyRegistry`
- `RecipeRegistry`
- `ElementRegistry`
- `OperatorRegistry`
- Elements와 Recipes
- `ComplianceDecision`
- policy evaluation audit events

`VenueRegistry`의 venue metadata는 Execution & Routing Layer가 소유하지만,
ComplianceEngine이 허용 venue와 operator를 평가할 때 조회한다.

## Inputs And Outputs

입력 context에는 최소한 다음 정보가 포함될 수 있다.

- initiator, buyer, seller
- tokenIn, tokenOut, amount, direction
- offering 또는 program ID
- order 또는 quote ID
- 요청 venue type과 주소
- operator
- policy version과 evaluation time

출력은 boolean이 아니라 조건을 포함한 decision이다.

```solidity
struct ComplianceDecision {
    bool allowed;
    bytes32 policyId;
    uint64 policyVersion;
    uint64 validUntil;
    uint256 maxAmount;
    uint256 allowedVenueTypes;
    bytes32 allowedVenuesHash;
    bytes32 reasonCode;
    bytes32 decisionHash;
}
```

`allowedVenueTypes`는 venue 종류의 허용 범위를 나타내고, `allowedVenuesHash`는 정확한
venue 주소 또는 허용 venue 집합을 execution context에 바인딩한다. 집합의 encoding과
검증 API는 Phase 1에서 인터페이스 테스트와 함께 확정한다.

## Policy Model

- Element: 하나의 검증 책임
- Recipe: 여러 Element의 조합
- Token Policy: token/program에 적용할 Recipe, venue, operator, 기간, 상태
- Operator Policy: operator 활성 상태와 venue 연결

법률 규칙은 Router나 Adapter에 하드코딩하지 않고 Element/Recipe 및 versioned
reference로 주입한다.

## Trust Boundaries

- 법률 판단의 정확성은 승인된 policy definition과 reference data에 의존한다.
- `ComplianceEngine`은 external provider의 진실성을 보장하지 않는다.
- policy 변경 권한과 긴급 중단 권한은 실행 권한과 분리해야 한다.
- decision은 다른 context에서 재사용할 수 없도록 `decisionHash`에 바인딩한다.

## Invariants

- `UNKNOWN`, `SUSPENDED`, delisted policy는 신규 실행을 허용하지 않는다.
- policy mapping이 없다는 사실만으로 자산을 unregulated로 판단하지 않는다.
- decision은 actor, token, amount, venue, policy version, expiry에 바인딩된다.
- `maxAmount`와 `validUntil`을 초과한 실행은 거부한다.
- 평가 결과와 reason code를 감사 가능한 event로 남긴다.
- 실제 execution/fill 트랜잭션은 최신 policy version과 actor/operator 상태를
  평가한다. 주문·견적 생성 시점의 decision만으로 settlement하지 않는다.

## Current Decisions

- 법률·컴플라이언스 판단과 matching engine 실행을 분리한다.
- boolean 결과 대신 구조화된 `ComplianceDecision`을 사용한다.
- 미확정 정책은 permissive default가 아니라 fail-closed로 처리한다.
- policy를 token 하나가 아니라 token/program/context 기준으로 versioning한다.
- 최소 `OperatorRegistry`를 초기 아키텍처에 포함한다.

## Open Decisions

- 초기 production Element와 Recipe 목록
- Reg D 및 유통규제 규칙의 정확한 enforcement point
- 허용 venue 집합의 encoding과 검증 API
- policy update 후 기존 order/quote의 취소·표시 UX
- operator/dealer 승인 기준
- 필수 reason code, reporting, surveillance event
- pause, policy update, delist 권한의 최종 governance

## References

- [`MVP-v2-multi-venue.md` - Compliance Decision](../MVP-v2-multi-venue.md#4-compliance-decision)
- [`MVP-v2-multi-venue.md` - 3-Layer Compliance 구조](../MVP-v2-multi-venue.md#5-3-layer-compliance-구조)
- [`MVP-v2-multi-venue.md` - Early Exit](../MVP-v2-multi-venue.md#10-early-exit와-일반-erc-20)
