# PORTAL-004 — Stateful Portfolio and Asset Operations

## Goal

투자자와 발행사 화면을 하나의 browser-only domain state로 연결해 체결, 보유
자산, 거래 이력과 자산 운영 상태가 서로 모순되지 않는 제품 데모를 만든다.

## In Scope

1. 체결 시점의 idempotent purchase journal과 ABCF 보유 수량 누적
2. 동적 홈 요약, 보유 자산과 별도 거래 내역 화면
3. 발행사 현황의 자산별 pause/resume control과 운영 이력
4. pause 상태의 투자자 목록·주문·quote/fill fail-closed 반영
5. 기존 localStorage demo state migration

## Out of Scope

- 실제 wallet balance, RFQ host, signer, RPC 또는 on-chain transaction
- production operator authorization, multisig 또는 incident workflow
- 매도, partial fill, quote expiry/reorg의 실제 settlement semantics
- contract, deployment 또는 testnet 변경

## State Invariants

- 한 pending order는 거래 ID 기준으로 최대 한 번만 holdings와 history에 반영한다.
- portfolio summary와 issuer metrics는 저장된 holdings/transactions에서 계산한다.
- paused ABCF는 새 quote와 fill을 진행하지 못하며 기존 holdings/history는 보존한다.
- 사용자가 제공한 미추적 파일은 수정·삭제·stage하지 않는다.

## Verification Plan

1. Model unit assertions로 settlement/idempotency/migration/pause를 고정한다.
2. Portal smoke와 JS syntax/whitespace를 실행한다.
3. 1440px browser flow에서 investor/issuer cross-flow를 확인한다.
4. repository-wide `scripts/check.sh`를 실행한다.

## Completion Evidence

- Product portal model/smoke, JavaScript syntax and whitespace: passed
- Headless Chrome 1440x900 cross-flow: 18 assertions passed
- Visual checkpoints: holdings, transaction history, issuer paused metrics and
  investor blocked order reviewed
- PR CI repository-wide `scripts/check.sh`: passed with Foundry 870/870, all
  service smoke tests and vendored deploy-v3 10/10
- Anvil/GIWA E2E not rerun because no contract, deployment, RPC or testnet path changed
