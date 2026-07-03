# Token & Identity Layer

## Responsibility

이 레이어는 토큰 발행자 측의 보유 자격과 실제 token transfer enforcement를
담당한다. Corner Store가 소유하거나 대체하는 레이어가 아니라 ERC-3643과 발행자
설정을 재사용하는 외부 trust boundary다.

핵심 질문은 다음과 같다.

> 이 주소가 이 토큰을 보유하거나 전송받을 자격이 있는가?

## Owned Components

- ERC-3643 Token
- ONCHAINID
- Identity Registry
- Trusted Issuers Registry
- Claim Topics Registry
- 발행자 Compliance 컨트랙트와 Modules
- `isVerified` 및 `canTransfer`

## Inputs And Outputs

입력:

- sender, receiver, amount
- receiver identity와 claims
- 발행자 compliance module 상태

출력:

- transfer 허용 또는 revert
- 발행자 규칙에 따른 최종 token movement

Corner Store의 Manifest, `ComplianceDecision` 또는 venue를 생성·선택하지 않는다.

## Trust Boundaries

- Identity와 claim의 진실성은 발행자와 trusted issuer 체계에 의존한다.
- Corner Store는 ERC-3643 Registry를 조회하거나 transfer 결과를 재사용하지만,
  발행자 설정을 임의로 완화하지 않는다.
- Pool, escrow, settlement, custody wallet처럼 RWA를 실제 보유하는 주소는 필요한
  IdentityRegistry 등록을 완료해야 한다.

## Invariants

- Corner Store 사전 검사가 성공해도 ERC-3643 transfer가 거부되면 전체 실행은
  원자적으로 실패해야 한다.
- ERC-3643 검사를 통과했다고 해서 venue, 거래 규모, 상대방, 운영자 조건이
  자동으로 허용되는 것은 아니다.
- ERC-3643 직접 전송은 Corner Store `ExecutionRouter`, 4-Layer evaluation과
  stateful `commit()`을 자동으로 실행하지 않는다. 직접 전송 경로의 제한은 발행자
  token-level policy에 위임되거나 제품 범위 밖으로 명시되어야 한다.
- RWA-RWA pair는 양쪽 토큰의 identity/compliance 조건을 각각 만족해야 한다.
- 규제 토큰을 delist해도 일반 ERC-20 경로로 자동 전환하지 않는다.

## Integration Points

- 4-Layer Compliance Stack은 Manifest의 issuer coverage를 기준으로 발행 측에서
  이미 검증한 사실과 거래 측 추가 검사를 구분한다.
- 필요할 경우 `isVerified`, `canTransfer` 결과를 preview에 포함할 수 있지만 실제
  token transfer 결과를 대체하지 않는다.
- Venue Layer는 실제 토큰 보유 주소와 callback/settlement 흐름을 명시한다.
- Deployment & Operations Layer는 venue 활성화 전에 필요한 identity 등록을
  preflight한다.
- AMM Pool이 ERC-3643을 보유하면 발행자 IdentityRegistry에서 필요한 적격 venue
  주소로 등록되어야 한다. 사용자와 Pool이 ERC-3643을 수신하는 각 방향에서
  identity/transfer 조건을 검증한다.
- 명시적 `UNREGULATED` 일반 ERC-20 public path는 4-Layer 보장 밖의 pass-through로
  취급한다.

## Current Decisions

- ERC-3643의 identity와 발행자 compliance 모듈을 재사용한다.
- Corner Store는 발행 측 coverage를 중복하지 않는 execution-level compliance를
  추가한다.
- Corner Store는 router-mediated trade에 대한 DEX-level compliance layer이며,
  모든 ERC-3643 token movement의 전역 enforcement layer로 표현하지 않는다.
- AMM Pool처럼 자산을 보유하는 주소는 venue identity 등록 대상으로 본다.
- Adapter가 토큰을 보관하지 않는 구조를 우선한다.

## Open Decisions

- venue/custody 주소 등록의 실제 발행자 운영 절차
- RFQ와 Order Book settlement가 토큰을 보유하는지 여부
- 실제 KYC, sanctions, claim provider
- identity 변경과 기존 주문·견적 처리 방식

## References

- [`MVP-v2-multi-venue.md` - ERC-3643 Boundary](../MVP-v2-multi-venue.md#4-erc-3643-boundary)
- [`MVP-v2-multi-venue.md` - Venue Execution](../MVP-v2-multi-venue.md#8-venue-execution)
