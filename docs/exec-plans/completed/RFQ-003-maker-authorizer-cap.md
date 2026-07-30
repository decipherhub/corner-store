# RFQ-003 — Maker Authorizer and Regulated Amount Cap

## Goal

maker settlement account와 quote signer를 분리하고, finite compliance cap을
regulated asset quantity에 적용해 ADR-009의 첫 contract migration을 완료한다.

## In Scope

1. versioned `IMakerAuthorizer`
2. maker 직접 ECDSA, governed EOA delegate, ERC-1271 검증
3. delayed authority expansion과 immediate revoke
4. RFQAdapter fill-time current signer authorization
5. regulated-token-bound finite amount cap
6. deployment fixture와 관련 문서 migration

## Out of Scope

- partial fill 또는 protocol custody
- durable nonce/idempotency coordinator
- production pricing/risk, authentication 또는 hosted service
- 두 regulated asset 각각에 서로 다른 cap을 적용하는 다중-cap contract

## Execution

1. 현재 RFQ authorization과 amount-cap 회귀를 테스트로 고정한다.
2. authorizer와 governance lifecycle 테스트를 추가한다.
3. RFQAdapter가 immutable authorizer를 사용하도록 migration한다.
4. decision에 cap 대상 token을 binding하고 Router buy/sell 검사를 정렬한다.
5. deployment, fixture와 문서를 갱신한다.
6. targeted/full test와 live BUIDL-like RFQ E2E를 실행한다.

## Completion Evidence

- signer addition은 delay 전 실행 불가
- revoke 이후 기존 delegated quote fill 거부
- maker direct ECDSA와 ERC-1271 지원
- regulated tokenOut buy와 tokenIn sell finite cap 검증
- invalid cap token fail-closed
- 기존 exact full-fill, replay, cancellation, direct-call 방어 유지
- repository check와 BUIDL-like RFQ E2E 통과
