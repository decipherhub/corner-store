# Venue Layer

## Responsibility

Venue Layer는 AMM, RFQ, Order Book의 고유한 검증과 settlement를 Adapter로
캡슐화한다.

핵심 질문은 다음과 같다.

> 선택된 venue에서 요청을 어떻게 안전하게 검증하고 결제할 것인가?

각 Adapter는 Compliance Policy를 정의하지 않고, `ExecutionRouter`가 전달한 request와
decision을 venue 고유 parameter에 바인딩한다.

## Common Adapter Contract

모든 venue는 다음 공통 책임을 가진다.

- 등록된 venue implementation 검증
- request/decision과 venue parameter binding
- venue 고유 signature, callback, order 검증
- 실제 execution/fill 트랜잭션에서 Router가 생성한 최신 compliance decision 검증
- custody와 asset flow 명시
- execution event 발생
- non-custodial인 경우 잔액 비보관

## AMM - Uniswap v3

### Role

Uniswap v3는 Corner Store의 첫 번째 AMM venue다. 전체 DEX가 아니라
`UniswapV3Adapter` 뒤에 있는 execution implementation으로 취급한다.

### Adapter Responsibilities

- 등록된 factory와 pool 검증
- `uniswapV3SwapCallback` origin 검증
- pool, token, amount, direction, slippage, deadline binding
- callback payment
- 잔여 토큰 비보관
- Pool CREATE2 주소 계산과 identity 등록 preflight

### Current Decisions

- upstream `SwapRouter02`를 지원 진입점으로 배포하지 않는다.
- Uniswap v3 인프라는 Corner Store 최소 deployment profile을 사용한다.
- Pool은 deploy-v3가 아니라 venue onboarding 과정에서 생성한다.
- RWA Pool은 필요한 IdentityRegistry 등록 후 활성화한다.
- `ExecutionRouter`는 지원 진입점이지만 표준 pool의 직접 호출을 그 자체로 차단하지
  않는다.

### Open Decisions

- 허용 fee tier
- 초기 liquidity와 LP 운영 정책
- 직접 pool 호출에 적용할 추가 enforcement
- RWA-RWA pair onboarding 절차

## RFQ

### Role

RFQ는 기관, 대량 거래, 승인 상대방 거래를 위한 경로다. 견적 탐색과 협상은
오프체인, 검증과 settlement는 온체인으로 시작한다.

### Adapter Responsibilities

- EIP-712 signature와 domain 검증
- maker/taker/token/amount/price binding
- nonce, expiry, replay protection
- dealer/operator 상태 검증
- fill 트랜잭션의 최신 decision과 quote parameter binding
- 결정에 따른 partial fill accounting

### Open Decisions

- dealer 승인 모델
- exact taker 또는 taker class
- partial fill 허용 여부
- settlement custody와 identity 등록
- quote cancellation 방식

결정 전 기본값은 exact fill, 미등록 dealer 거부, custody 모델 미확정 시 구현
보류다.

## Order Book

### Role

Order Book은 지정가, 취소, 부분 체결, matcher/operator가 필요한 시장에 사용한다.

### Adapter Responsibilities

- order, market, pair, maker parameter binding
- nonce, expiry, cancellation
- remaining amount와 partial fill accounting
- matcher/operator 검증
- fill 트랜잭션의 최신 maker/taker decision 검증
- settlement atomicity와 surveillance event

### Open Decisions

- on-chain 또는 off-chain matching
- price-time priority 적용 여부
- matcher 권한과 감시 책임
- escrow/custody 모델
- 동결·취소·잔액 회수 절차

matching과 custody 모델이 결정되기 전에는 구현하지 않는다.

## Shared Invariants

- 주문·견적 생성 시점 검사만으로 settlement 검사를 대체하지 않는다. 실제 fill
  트랜잭션에서 Router가 최신 policy와 actor/operator 상태를 평가한다.
- total fill은 signed amount를 초과하지 않는다.
- 중단된 venue/operator의 신규 settlement를 거부한다.
- 다른 venue의 request나 decision을 재사용할 수 없다.
- Adapter가 custody를 갖는 경우 identity, 회계, 회수, 비상 절차를 명시한다.

## References

- [`MVP-v2-multi-venue.md` - Venue별 실행 모델](../../MVP-v2-multi-venue.md#7-venue별-실행-모델)
- [`MVP-v2-multi-venue.md` - Factory와 등록 흐름](../../MVP-v2-multi-venue.md#9-factory와-등록-흐름)
- [`CORNER_STORE_PROFILE.md`](../../../tools/deploy-v3/CORNER_STORE_PROFILE.md)
