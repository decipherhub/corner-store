# SDK-005 — External DEX Adapter Starter and Conformance

## Goal

기존 DEX 개발자가 core source를 수정하지 않고 생성된 Adapter 경계에서 Corner
Store Router를 연결하고 공통 안전성 검증을 실행하게 한다.

## In Scope

1. `dex-integration` 전용 minimal Solidity Adapter
2. TypeScript execution request builder와 versioned venue descriptor
3. actual ExecutionRouter 기반 allow/reject/direct-call/rollback conformance
4. packed external project의 Foundry build/test gate
5. production responsibility documentation

## Out of Scope

- 특정 AMM/orderbook/RFQ settlement 구현
- 외부 venue callback/token accounting 보증
- production deployment 또는 governance transaction 제출

## Completion Evidence

- Generated clean project compiles TypeScript and Solidity from packed packages.
- Allowed flow executes before commit; compliance rejection never reaches venue.
- Direct Adapter calls fail and a venue revert rolls back nonce and commit state.
- Existing templates and repository checks remain passing.

## Result

- `dex-integration` now generates the Adapter, request client, descriptor and
  real-Router conformance without core source modification.
- Packed clean projects pass TypeScript/RFQ build and all four Adapter scenarios.
- Full Foundry 950/950, repository checks and deploy-v3 10/10 pass.
