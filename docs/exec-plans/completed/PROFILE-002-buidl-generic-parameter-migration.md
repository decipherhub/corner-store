# PROFILE-002 — Generic-parameter BUIDL-like Demo Migration

## Outcome

BUIDL-like local demo의 QP+minimum behavior를 유지하면서 자산 전용 Element wiring을
generic `MIN-AMOUNT-v1`과 versioned `ManifestPolicyConfig`로 교체한다.

## In Scope

- generic QP+minimum Recipe family version 2
- demo ManifestPolicyConfig와 factory/CLI/testnet onboarding wiring
- legacy BUIDL-specific Element/Recipe 비활성화와 reason/documentation 정리
- profile conformance, full checks와 BUIDL-like/Reg-D Anvil regression

## Out of Scope

- 실제 BlackRock/Securitize BUIDL 정책값 확정 또는 production activation
- issuer/legal evidence 생성, Safe 서명·제출 또는 GIWA broadcast
- legacy immutable contract 삭제

## Stop Condition

신규 BUIDL-like deployment에 `BUIDL-MIN-v1`이 등록·binding되지 않고 exact demo
threshold가 Manifest config에서 `MIN-AMOUNT-v1`로 전달되며, 근거 없는 production
activation 경계가 문서와 schema v5 gate에 고정되고 두 Anvil profile이 통과한다.
