# PROD-001 — Production Control Plane

## Objective

ADR-007의 governance/lifecycle 결정을 현재 reference registry/router에 반영해,
위험 중단은 즉시 가능하고 재개·semantic Manifest update는 timelock을 통과하며
모든 변경이 append-only hash/event로 추적되는 production control-plane baseline을
만든다.

## In Scope

- `OperatorRegistry` global/asset/venue pause state
- immediate pause, owner-scheduled timelocked unpause, cancellation
- `ExecutionRouter` central pause enforcement
- Manifest monotonic version과 lifecycle history hash
- ACTIVE/SUSPENDED Manifest pending update와 delayed activation
- actor/old/new/reason/effective-time events
- unit/integration regression tests와 source-of-truth 문서 정렬

## Out of Scope

- Safe 자체의 signer/threshold 구현
- production multisig provider 또는 chain-specific deployment
- issuer identity schema와 issuer-level pause
- legal Element 값, Securitize API, acquisition lot data
- RFQ custody/partial fill, real Uniswap v3, Order Book

## Constraints

- 기존 initial register → approve 흐름과 ABI는 가능한 한 유지한다.
- pause는 tightening이므로 operator 즉시 실행을 허용한다.
- unpause와 active Manifest semantic update는 owner + timelock을 요구한다.
- suspended Manifest update는 suspension을 해제하지 않는다.
- full legal document는 off-chain에 두고 hash만 온체인에 보존한다.

## Test Spec

1. global/asset/venue pause가 Router 실행을 각각 거부한다.
2. operator가 pause할 수 있지만 즉시 unpause할 수 없다.
3. owner가 unpause를 예약하고 delay 후 실행할 수 있다.
4. pending unpause는 재-pause 또는 명시적 cancel로 무효화된다.
5. initial Manifest는 version 1로 시작하고 기존 lifecycle이 유지된다.
6. ACTIVE/SUSPENDED update는 pending으로 저장되고 delay 전 승인되지 않는다.
7. update activation은 version/hash/history hash를 변경하고 old/new를 event에 남긴다.
8. suspended Manifest update는 계속 SUSPENDED다.
9. invalid/empty pending update와 권한 없는 변경은 fail-closed한다.
10. 전체 Foundry와 repository check가 통과한다.

## Completion

- 위 동작과 테스트가 모두 통과했다.
- `FEATURES.md`, `PROGRESS.md`, architecture/security/operations 문서를 실제 구현과
  정렬했다.
- `scripts/check.sh`: Foundry 609/609, service smoke 전체, deploy-v3 10/10 통과.
- `buidl-like`와 `reg-d`: 각 7/7 scenario, 실제 1일 timelock resume 뒤 AMM settlement,
  backend RFQ success/revoked-maker rejection 통과.
- 관련 없는 코드와 scratch 파일은 변경 세트에 포함하지 않는다.
