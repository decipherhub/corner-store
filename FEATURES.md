# Features

## State Rules

- `not-started` → `active`: 해당 feature 작업을 시작할 때
- `active` → `passing`: 모든 Verification이 통과했을 때
- `active` → `blocked`: 외부 정보나 결정이 없어 진행할 수 없을 때
- `blocked` → `active`: 차단 사유가 해소되었을 때

동시에 하나의 feature만 `active` 상태로 둔다.

## HE-001 — Harness Baseline

### Behavior

- 새 세션이 저장소만 읽고 현재 상태와 다음 작업을 복구할 수 있다.
- 필수 명령과 완료 조건이 한 곳에서 안내된다.
- feature, progress, decision과 quality 상태가 저장소에 기록된다.
- 전체 검증을 한 명령으로 실행할 수 있다.

### Verification

- `scripts/check.sh`
- `git diff --check`
- Harness 필수 문서와 링크 수동 검토

### State

passing

### Notes

- 완료 계획: `docs/exec-plans/completed/HE-001-harness-baseline.md`
- 제품 아키텍처 내용은 이 feature에서 변경하지 않는다.

## DOC-001 — Imported Architecture Alignment

### Behavior

- imported 문서에서 확정된 제품 방향과 변경 요청을 구분한다.
- 공식 제품 명세가 Compliance Core, Execution Integration Kit, reference DEX와
  4-Layer 모델을 일관되게 설명한다.
- pair 거래에서 양쪽 자산의 classification과 Manifest를 누락하지 않는다.
- 기존 문서의 충돌하는 용어와 가정을 정리한다.
- 열린 설계 결정은 확정된 구현처럼 표현하지 않는다.

### Verification

- 관련 문서 간 용어·책임·흐름 교차 검토
- Markdown 링크 확인
- `scripts/check.sh`
- `git diff --check`

### State

passing

### Notes

- 입력 분류: 완료 Exec Plan의 `Input Classification`
- 완료 계획: `docs/exec-plans/completed/DOC-001-imported-architecture-alignment.md`
- 확정 방향과 개발팀이 결정해야 할 change request를 구분해 반영한다.

## FND-001 — Foundry Product Foundation

### Behavior

- Foundry template를 제품 개발 구조로 교체한다.
- 제품 interface, type, error와 mock fixture를 컴파일할 수 있다.
- 이후 compliance와 execution feature가 재사용할 테스트 기반을 제공한다.

### Verification

- `forge fmt --check`
- `forge build`
- `forge test --offline`

### State

passing

### Notes

- 현재 제품 구조는 Compliance Core, Execution Integration Kit, reference adapters와
  Foundry unit/integration fixture를 포함한다.
- production Manifest lifecycle, RFQ dealer/custody, OrderBook은 별도 feature다.

## RFQ-001 — Reference RFQ Settlement

### Behavior

- RFQ가 AMM과 같은 `ExecutionRouter`/Adapter slot에 등록·교체될 수 있다.
- RFQ quote는 maker가 EIP-712로 서명하고 chainId, RFQAdapter, maker, taker,
  token, amount, venue, nonce, expiry에 바인딩된다.
- RFQAdapter는 Router-only로 동작하고 direct adapter bypass를 거부한다.
- 매 fill은 Router의 최신 compliance evaluation 이후 full-fill/exact-taker로만
  settlement된다.
- reference TypeScript service는 quote 생성, expiry/nonce 부여, EIP-712 signing
  요청만 담당한다.

### Verification

- `forge fmt`
- `forge build`
- `forge test --offline --match-path test/unit/execution/RFQAdapter.t.sol -vv`
- `forge test --offline`
- `cd services/rfq && npm test`
- `git diff --check`

### State

passing

### Notes

- Non-goals: partial fill, orderbook, production pricing engine, dealer inventory,
  custody 확장, websocket/order discovery.
