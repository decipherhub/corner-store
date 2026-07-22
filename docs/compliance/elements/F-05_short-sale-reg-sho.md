---
type: element-spec-stub
element-id: F-05
element-name: Short-Sale Restriction (Reg SHO)
parent-recipe: (유통규제 — 미부착·deferred)
internal-id: ELE.F-05
status: spec-only stub — **DEFERRED (코드 미구현 결정, 2026-06-17)**
decision-ref: 쟁점 등록부 §1-가 F-05 (freeze-blocking, 규제 담당 단독 결정)
audience: 개발팀·법무팀·외부 consultant
related-external-sources:
  - "17 CFR §§ 242.200–204 (Regulation SHO): https://www.law.cornell.edu/cfr/text/17/part-242"
  - "Rule 201 (alternative uptick / short sale price test): https://www.law.cornell.edu/cfr/text/17/242.201"
created: 2026-06-17
tags: [element, F-05, reg-sho, short-sale, spec-stub, deferred]
---

# F-05 Short-Sale Restriction (Reg SHO) — Spec-Only Stub

> **이 문서는 무엇인가.** F-05는 **일부러 구현을 보류한 부품**이다. 이 stub은 "빠뜨린 게 아니라 의식적으로 미뤘다"는 사실과, *언제·어떤 조건에서 코드로 승격하는지*를 기록하는 카탈로그 항목이다. 지금은 코드(Solidity/판정 로직)를 만들지 않는다.

## 1. 결정 (Decision)

**F-05는 spec-only stub으로 둔다 — 코드 미구현, 설계 메모만 유지.** (쟁점 등록부 §1-가, 규제 담당 단독 결정, 2026-06-17. 채널 [G].)

근거: 현재 Decipher DEX는 **공매도(short sale)·margin·차입 매도 기능이 없다.** Reg SHO의 수범 행위(공매도 주문) 자체가 발생하지 않으므로, 지금 차단 코드를 만들 *대상*이 없다. Reg M(F-04)이 "상시 발행 = 끝나지 않는 매수 금지"라서 always-on이 필요했던 것과 대조적이다 — F-05는 *트리거가 되는 행위 자체가 부재*하다.

## 2. 무엇을 다루나 (Reg SHO 개요 — 승격 시 구현 대상)

**Regulation SHO**(17 CFR §§ 242.200–204)는 미국 공매도 규제다. 한국 자본시장법의 공매도 규제(차입공매도 원칙 허용·무차입공매도 금지·업틱룰)의 사촌.

| Rule | 내용 (쉽게 말하면) | 한국법 감각 |
|---|---|---|
| **Rule 200** | 주문에 long/short를 표시(order marking) + "short sale" 정의 | 매도 구분 표시 |
| **Rule 201** | **alternative uptick rule** — 하루 10%+ 급락한 종목은 직전 최우선매수호가 이하로 공매도 금지(price test circuit breaker) | 업틱룰·공매도 가격제한 |
| **Rule 203** | **locate/borrow** — 빌릴 주식을 먼저 확보해야 공매도 가능(무차입 공매도 금지) | 차입공매도 원칙·무차입 금지 |
| **Rule 204** | **close-out** — 결제 실패(fail to deliver) 시 강제 매수(buy-in) 의무 | 결제불이행 처리 |

## 3. 왜 지금은 보류인가

- **수범 행위 부재**: 공매도/margin/파생 기능이 없는 DEX에서는 Reg SHO가 규율할 행위가 일어나지 않는다.
- **Parsimony(부품 절약) 원칙**: 작동할 일이 없는 부품을 always-on으로 켜두면 gas·복잡도만 늘고 법적 커버리지는 0이다. 메모로 남기고 트리거 시 승격이 옳다.
- **F-04와의 대비로 본 판별 규칙**: "이 규제가 막을 *행위가 현 시스템에 실재하는가?*" → 실재(F-04 발행자 매수)면 구현, 부재(F-05 공매도)면 stub.

## 4. Build-Trigger — 언제 코드로 승격하나

다음 중 하나라도 도입되면 F-05를 spec-only에서 구현 부품으로 승격한다.

1. DEX에 **공매도/short position** 기능 도입
2. **margin/leveraged trading** 도입
3. 공매도 효과를 내는 **파생(선물·옵션·synthetic)** 도입
4. (간접) 다른 자산군이 공매도 가능한 시장에 listing

승격 시 작업: 3-axis 좌표 확정 → 판정 로직(의사 코드) 작성 → Rule 200/201/203/204 **full citation 검증**(연방규칙 원문 대조) → 테스트 케이스 → Recipe 부착. *지금은 이 작업을 하지 않는다.*

## 5. 3-Axis 좌표 (잠정 placeholder — 승격 시 확정)

| axis | 잠정 값 | 메모 |
|---|---|---|
| Decidability | DETERMINISTIC (가격 비교·차입 확인) + ATTESTATION(차입 증빙) 혼합 추정 | 승격 시 확정 |
| Timing | AT_TRADE (공매도 주문 시점) | — |
| Statefulness | STATEFUL 가능성 (fail-to-deliver 추적은 상태 보유) | Rule 204 close-out이 상태 필요 |

## 6. 변경 로그

- **[2026-06-17] spec-only stub 신설 · DEFERRED 결정.** 쟁점 등록부 §1-가 freeze-blocking 4건 중 2번째(F-05). 결정: 코드 미구현·메모만. 근거: 현 DEX에 공매도/margin 부재로 수범 행위 없음(Parsimony). Build-trigger 4종·승격 시 작업 목록·3-axis placeholder 기록. (F-04는 ADR-001로 추가 확정 — 행위 실재 vs 부재가 두 결정을 가름.)
