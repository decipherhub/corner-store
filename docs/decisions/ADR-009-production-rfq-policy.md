# ADR-009 — Production RFQ Dealer and Settlement Policy

- **상태:** Accepted (2026-07-30)
- **유형:** RFQ production 운영·정산 경계
- **적용 범위:** Corner Store RFQ SDK와 protected Router settlement
- **비적용 범위:** 특정 dealer/custodian 인허가, vendor 선정, hosted service

## Context

현재 RFQ v1은 exact-taker, exact full-fill, non-custodial settlement와 fill-time
Router compliance를 검증한다. SDK-001은 pricing, risk, signer와 nonce를 교체 가능한
module로 만들었지만 conformance는 production 운영 품질을 인증하지 않는다.

production 전환 전에 다음 결합을 해소해야 한다.

- 현재 `RFQAdapter`는 `maker`를 inventory account와 ECDSA signer로 동시에 사용한다.
- in-memory nonce는 단일 process demo에는 충분하지만 다중 instance와 재시작을
  견디지 못한다.
- pricing/risk 결과의 운영 근거와 idempotency/audit 계약이 없다.
- Router의 finite `maxAmount` 검사는 현재 `amountIn`에만 적용되지만 정책은
  regulated asset 수량을 제한해야 한다.
- partial fill을 같은 quote/adapter에 추가하면 nonce, remaining amount와
  compliance commit 의미가 바뀐다.

## Trade-off Summary

| 결정축 | 선택 | 얻는 것 | 비용/잔여 위험 | 재검토 조건 |
| --- | --- | --- | --- | --- |
| protocol custody | non-custodial | atomicity, 작은 trust surface | dealer external custody/allowance 운영 필요 | escrow/netting이 법적·사업적으로 필수 |
| fill | exact full-fill | 단순 replay/cancel/commit | 큰 주문의 체결 유연성 감소 | 새 adapter와 partial accounting 승인 |
| signer | maker와 분리 | rotation, HSM/MPC, smart account | authorizer governance 추가 | 없음; production 필수 seam |
| nonce | durable monotonic | multi-instance/restart 안전 | storage/reconciliation 운영 | 없음; production 필수 |
| inventory | off-chain lease | concurrent over-quote 방지 | external balance 이동 잔여 위험 | on-chain escrow를 별도 제품으로 선택 |
| compliance | Router fresh evaluation | quote 이후 상태 변경 반영 | quote가 fill에서 거부될 수 있음 | 재사용 가능한 signed decision 설계 시 |

## Decision

### 1. Settlement and custody

Corner Store production RFQ v1은 **protocol non-custodial + atomic exact full-fill**로
유지한다.

- Taker와 maker settlement account 사이에서 Adapter가 서명된 정확한 양을 한
  transaction 안에서 이동한다.
- Router와 Adapter는 거래 전후 자산 잔액을 보관하지 않는다.
- maker inventory, end-user custody와 fiat settlement 책임은 operator/dealer의
  외부 시스템에 있다.
- RWA를 보유하거나 받는 maker/custody account는 발행자 identity/transfer
  restriction을 충족해야 한다.
- fee-on-transfer, rebasing 또는 transfer 결과가 quote amount와 달라지는 자산은
  별도 adapter 없이는 지원하지 않는다.

이 결정은 custody가 사라진다는 뜻이 아니다. Corner Store protocol이 custody를
소유하지 않을 뿐, maker settlement account의 외부 custodian과 운영 통제는
dealer 책임으로 명시한다.

### 2. Fill policy

v1 quote는 **전량 체결 또는 전량 revert**다. 잔량은 새 quote로 다시 요청한다.

partial fill은 기존 Adapter의 옵션이 아니라 새로운 quote schema와 adapter version을
요구한다. 해당 version은 original amount, remaining amount, cumulative fill,
rounding, cancel/fill race와 매 fill의 최신 compliance/commit을 별도로 정의해야 한다.

### 3. Maker and signer authority

production 모델에서 다음 역할을 분리한다.

- `maker`: token inventory와 settlement allowance를 가진 계정
- `quote signer`: maker를 대신해 firm quote를 발행하는 회전 가능한 authority
- `operator`: maker onboarding, venue pause와 signer policy의 governance owner

현재 `recover(hash) == maker` 결합은 reference v1 호환 경로로 유지하지만 production
adapter는 versioned maker-authorizer seam을 사용해야 한다.

- EOA delegate와 ERC-1271 smart-account 검증을 지원할 수 있어야 한다.
- signer 추가는 권한 확대이므로 governance delay/승인을 거친다.
- signer/maker revoke와 venue pause는 위험 축소이므로 즉시 가능해야 한다.
- signer revoke 이후 과거 signed quote도 fill 시점의 current authorization에서
  거부된다.
- signer secret은 SDK config, integration manifest, log 또는 image에 저장하지 않는다.

### 4. Durable nonce and idempotency

on-chain replay namespace는 `(chainId, adapter, maker, nonce)`다. production nonce
module은 다음을 보장한다.

- maker별 atomic monotonic allocation
- 다중 process에서 unique constraint 또는 동등한 compare-and-set
- client idempotency key에 대해 동일 요청은 동일 quote 결과
- 한 번 예약·서명 시도한 nonce는 실패 후에도 재사용하지 않음
- restart 시 on-chain fill/cancel event와 reconciliation 가능

호출 순서는 `validate/auth → price → risk → reserve nonce → sign → persist audit →
respond`다. risk 거부는 nonce와 signer를 사용하지 않는다. nonce 예약 뒤 장애가 나면
gap은 허용하지만 재사용은 금지한다.

production firm quote는 balance check만 하지 않고 **time-bounded off-chain inventory
reservation**을 요구한다. quote coordinator가 idempotency record, maker nonce와
inventory reservation을 하나의 durable transaction에서 확정한다. 개별 SDK module
interface만으로 이 원자성을 제공한다고 주장하지 않는다.

quote lifecycle은 다음 상태를 가진다.

```text
RECEIVED
  → RESERVED(nonce + inventory lease)
  → SIGNED
  → PUBLISHED
  → FILL_OBSERVED → FILLED_FINAL
  → CANCEL_OBSERVED → CANCELLED_FINAL
  → EXPIRED
  → SIGN_FAILED / REVOKED
```

- `SIGN_FAILED`도 nonce는 소모하고 reservation은 해제한다.
- fill/cancel은 confirmation depth 전까지 observed 상태로 유지한다.
- reorg 시 observed 상태를 `PUBLISHED`로 되돌리고 expiry/authorization/risk를
  재평가한다.
- finalized fill/cancel 또는 expiry/revoke에서 reservation을 해제한다.

### 5. Pricing and inventory risk

pricing과 risk는 off-chain dealer service이며 compliance authority가 아니다.
Operator governance는 허용 module/version과 limit envelope를 승인하고, 독립
surveillance owner는 self-dealing/price anomaly를 감시한다. signer process가
가격·limit을 임의 변경하지 못하도록 역할을 분리한다.

- pricing input은 asset pair, side, exact base-unit amount, market-data snapshot과
  expiry/freshness를 포함한다.
- risk는 balance/allowance, inventory, concentration, size와 dependency freshness를
  서명 전에 검사한다.
- 동시 firm quote가 같은 inventory를 중복 약속하지 않도록 reservation을 원자적으로
  차감한다. 외부 custody transfer로 실제 balance가 바뀔 수 있으므로 fill revert
  잔여 위험은 남고, dedicated settlement account와 reconciliation으로 줄인다.
- stale/missing market, inventory 또는 policy dependency는 fail-closed한다.
- caller는 maker, amountOut, nonce 또는 module version을 임의 지정하지 못한다.
- quote hash와 함께 pricing snapshot ID, module versions, risk result와 request
  idempotency key를 PII-free audit record에 남긴다.

이 기록은 서명된 quote의 의미를 변경하지 않으며 production WORM/retention
provider를 대체하지 않는다.

### 6. Authentication and operations

- production quote endpoint는 TLS, authenticated client/taker binding, request-size
  limit, rate limit와 abuse monitoring을 갖는다.
- pre-check와 quote issuance는 UX/리스크 경계이며 법적 최종 허용을 보장하지 않는다.
- Router는 매 fill에서 최신 Manifest, claim, maker/signer와 venue 상태를 다시
  검사한다.
- incident 순서는 `venue pause → signer/maker revoke → outstanding nonce cancel →
  inventory allowance 회수 → audit reconciliation`이다.

책임 분리는 다음과 같다.

| 역할 | 책임 |
| --- | --- |
| Issuer/TA | identity/claim과 token-level transfer restriction |
| Protocol governance | Router/Adapter upgrade, authorizer 정책과 delayed expansion |
| Operator | maker onboarding, venue pause, module/limit 승인과 incident commander |
| Dealer/maker | pricing, inventory, settlement account와 quote obligations |
| RFQ host | auth, idempotency, durable lifecycle, rate limit와 availability |
| Signer custodian | KMS/HSM/MPC key access, rotation, attestation과 audit |
| Indexer/surveillance | finalized fill/cancel reconciliation, anomaly와 out-of-router 탐지 |
| Taker/custodian | request authorization, wallet control과 token allowance |

### 7. Amount-cap axis

`ComplianceDecision.maxAmount`는 결제자산 notional이 아니라 **regulated asset
quantity**에 적용한다.

- regulated token이 `tokenIn`이면 `amountIn`
- regulated token이 `tokenOut`이면 `amountOut`
- regulated-regulated pair는 각 자산별 cap 표현이 필요하므로 단일 `maxAmount`
  contract를 그대로 확장하지 않는다.

finite cap이 활성화되기 전에 Router/decision contract를 이 의미와 일치시켜야 한다.

## Rejected Alternatives

| 대안 | 기각 이유 |
| --- | --- |
| Router/Adapter custody | identity, 회계, 회수와 라이선스 책임이 core protocol에 침투 |
| custody가 없는 것으로 표현 | dealer inventory의 실제 custodian/운영 책임을 숨김 |
| 기존 quote에 즉시 partial fill 추가 | replay, rounding, commit과 cancel 의미가 불명확 |
| maker private key가 항상 직접 서명 | 기관 signer rotation과 smart custody account에 부적합 |
| timestamp/random nonce | multi-instance uniqueness와 restart recovery를 보장하지 못함 |
| balance check만으로 firm quote 발급 | concurrent quote가 inventory를 중복 약속할 수 있음 |
| backend pre-check 결과를 on-chain에서 재사용 | quote 이후 claim/policy 변경을 놓침 |
| pricing/risk conformance를 production 인증으로 간주 | business policy와 데이터 품질을 검증하지 않음 |

## Consequences

- current v1의 단순성과 원자성은 유지된다.
- production signer authorization과 regulated amount cap contract migration은
  RFQ-003에서 완료했다.
- production backend는 durable storage와 external signer가 필수지만 특정 vendor는
  core SDK에 강제되지 않는다.
- partial fill은 독립 feature로 남으며 기존 quote와 혼용하지 않는다.
- 실제 dealer/custodian 운영의 법률·라이선스 검토는 operator 책임으로 남는다.

## Related

- [`../product-specs/production-rfq-policy.md`](../product-specs/production-rfq-policy.md)
- [`../../src/execution/adapters/rfq/RFQAdapter.sol`](../../src/execution/adapters/rfq/RFQAdapter.sol)
- [`../../src/execution/ExecutionRouter.sol`](../../src/execution/ExecutionRouter.sol)
- [`../rfq-threat-model.md`](../rfq-threat-model.md)
- [`../sdk-integration.md`](../sdk-integration.md)
