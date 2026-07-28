---
type: recipe-requirement-spec
recipe-id: R3
recipe-name: ICA §3(c)(7) Fund
project: RWA DEX (Giwa) · corner-store
status: v2.0 (2026-07-28) — 2부 구성(제1부 법률논증 산문 + 제2부 구현명세). Part II는 실장 컨트랙트(Fund3c7Recipe.sol · BuidlLikeFundRecipe.sol) 기준.
substance-sot: "승준 recipe walkthrough — R3_ICA-3c7-Fund.md v1.0 (2026-06-17, 조문별 삼단논법). 보경 recipe 검토본 없음 — 법률 검토 필요."
implements: "src/compliance/recipes/Fund3c7Recipe.sol (recipeId 2, {A-13}, fund-bit gated) · BuidlLikeFundRecipe.sol (recipeId 3, {A-13, BUIDL-MIN}, fund-bit gated)."
reflects-decisions: [ADR-004, ADR-006, ADR-008]
umbrella: "SPEC.md — 공유 개념(Element/Recipe/Manifest·Router cumulative AND·경계)은 여기에 의한다"
legal-effect: "발행자가 ICA상 investment company가 아님(§3(c)(7) 제외) → ICA 등록·실체규제 면제"
review-required: legal
tags: [recipe-requirement-spec, R3, ica, 3c7, qualified-purchaser, always-on]
---

# R3 ICA §3(c)(7) Fund — 요구사항 명세서 (Recipe)

> **저술 지위 고지.** 본 Recipe의 법적 논증은 승준 recipe walkthrough(2026-06-17)를 산문 2부 형식으로 재구성한 것이며, 대응 보경 recipe 검토본은 없다 — 법률 검토 전 상태(제4절). 제2부의 두 기준 컨트랙트(`Fund3c7Recipe.sol`, `BuidlLikeFundRecipe.sol`)는 모두 mock이며, 그 요소 집합은 법적 논증이 요구하는 이상 집합보다 축약되어 있다(제10절 seam).

본 문서는 컴플라이언스 **Recipe** R3(ICA §3(c)(7) 펀드)의 요구사항 명세서이다. **제1부**는 R3가 성립·유지시키는 법률효과 — "이 발행자는 1940년 투자회사법(ICA)상 investment company가 아니다(§3(c)(7) 제외)" — 의 근거와 조문별 도출을, **제2부**는 이를 구현한 컨트랙트 기준의 활성화·구성·거절 명세를 규정한다. R3는 발행·재판매를 불문하고 모든 이전에 상시 얹히는 누적(always-on cumulative) Recipe라는 점에서 R1·R2와 구조가 다르다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

R3는 underlying 증권을 담는 토큰 펀드·SPV가 1940년 투자회사법상 investment company에 해당함에도, §3(c)(7)의 제외에 의하여 그 등록·실체규제를 받지 아니한다는 법률효과를 논증하는 Recipe이다. §3(c)(7)은 발행증권 전부가 취득 시점에 적격구매자(qualified purchaser)인 자에 의하여 보유되고 발행자가 공모를 하지 아니할 것을 요구하며, 이 두 요건은 현재형·전원(exclusively)이어서 1회 검사로 끝나지 아니하고 모든 이전 시점마다 유지되어야 한다. 그러므로 R3는 발행(R1)·재판매(R2)에 항상 곱해지는 상시 조건이다.

## 2. 규범적 근거

투자회사법 §3(a)(1)(C)는 총자산의 40%를 초과하는 투자증권을 보유하는 발행자를 investment company로 정의한다(15 U.S.C. § 80a-3(a)(1)(C)). underlying 증권을 담는 SPV·펀드는 이에 해당하여 원칙적으로 ICA의 등록·실체규제를 받는다. §3(c)(7)(A)는 이 정의로부터의 제외를 규정하는데, 그 발행증권이 취득 시점에 적격구매자인 자에 의하여 배타적으로(exclusively) 보유되고, 발행자가 그 증권의 공모(public offering)를 하지 아니할 것을 요건으로 한다(15 U.S.C. § 80a-3(c)(7)(A)). 적격구매자는 §2(a)(51)이 정의하며, 5백만 달러 이상의 투자자산을 보유한 자연인·가족회사, 일정한 신탁, 재량으로 2천5백만 달러 이상을 운용하는 기관 등이 이에 해당한다(15 U.S.C. § 80a-2(a)(51)). 이 두 요건이 모든 시점에 충족되면 발행자는 investment company가 아니게 되어 ICA 규제를 면한다.

## 3. 쟁점별 논증

### 3.1 §3(c)(7)(A) 전단 — 전원 적격구매자 (배타적·취득시점·현재형)

§3(c)(7)(A) 전단은 발행증권 전부를 각 취득 시점에 적격구매자인 자가 보유할 것을 요구한다. exclusively라는 문언상 단 한 명이라도 비적격구매자가 유입되면 제외가 상실된다. Element A-13이 매수인의 적격구매자 claim(5백만/2천5백만 달러 기준)을 확인하고, 매수인이 법인인 경우 Element A-08(자격 분류)과 필요 시 A-09(구성원 look-through)가 그 법인의 적격성을 확립한다. 이 검사는 모든 이전에서 매수인에 대하여 강제되어야 하며, 한 거래라도 비적격구매자가 유입되면 그 거래가 §3(c)(7)을 깨므로 차단된다. 다만 증여·유증·이혼·사망 등 비자발적 이전으로 적격구매자로부터 증권을 받은 자는 적격구매자로 간주되므로(§3(c)(7)(A) 2문), 이 예외 경로는 off-chain 사유 claim으로 처리한다.

### 3.2 §3(c)(7)(A) 후단 — 공모 아님

§3(c)(7)(A) 후단은 발행자가 공모를 하고 있지 아니하고 그때 이를 하려고 제안하지도 아니할 것을 요구한다. Element B-04(엔진 선택 — RFQ·화이트리스트 폐쇄 풀)가 공개 모집 자체를 구조적으로 차단하고, Element A-12(고의적 외면 차단)가 권유 행태의 위험신호를 포착한다. 이는 R1의 506(c)가 general solicitation을 허용하는 것과 충돌하지 아니한다 — 506(c) 발행은 제4조(a)(2)의 비공개를 기반으로 "공모 아님"으로 취급되므로, 폐쇄 풀이 양쪽 조건을 동시에 충족시킨다. 그러므로 B-04와 A-12가 통과하면 공모 아님 요건이 충족된다.

### 3.3 별건 — 보유자 수와 §12(g)의 구별

여기서 정확성상 중요한 구별이 있다. §3(c)(7) 자체에는 보유자 수 제한이 없다 — 100인 제한은 §3(c)(1)의 것으로 §3(c)(7)과 다르다. 토큰의 명의 보유자 수가 일정 임계를 넘으면 발생하는 것은 증권거래소법 §12(g)의 등록 트리거이지 §3(c)(7)의 상실이 아니다(15 U.S.C. § 78l(g)). §3(c)(7) 펀드는 ICA 미등록이어서 §12(g)(2)(B) 면제를 받지 못해 이 트리거에 노출되므로, Element D-01이 명의 보유자 수를 관리한다. D-01의 근거는 §12(g)이며 그 카운팅 단위는 Rule 12g5-1의 held of record(법인 = 1)로, §3(c)(7)의 적격 판정과는 목적도 방향도 다르다(ADR-008 정오 참조). D-01은 R3와 함께 상시 작동하나, 엄밀히는 R3(§3(c)(7))가 아니라 §12(g)를 지키는 별건이다.

### 3.4 상시성 — 매 거래가 검문소

§3(c)(7)의 두 요건이 현재형·전원이라는 점에서 R3의 본질이 나온다. R1(발행 1회)·R2(경로 택일)와 달리, R3는 발행·재판매·모든 이전 시점마다 전 보유자의 적격성이 유지되는지를 검사한다. 코드상 이는 모든 이전 전 매수인에 대한 A-13 검사와, 기존 보유자 집합에 비적격구매자가 0이라는 불변식으로 표현된다. 그러므로 R3는 독립 실행되지 아니하고 R1·R2의 모든 통과에 곱해진다.

## 4. 확정 사항 및 잔여 쟁점

§3(c)(7)(A)의 두 요건과 그 상시성, §12(g)와의 구별은 위와 같이 확정되었다. 잔여 쟁점은 다음과 같다. 첫째, exclusively 불변식(기존 보유자 집합에 비적격구매자 0)의 온체인 코드화는 매 이전 전 검사와 보유자 집합 검증의 통합 설계를 요한다. 둘째, knowledgeable employee 예외(Rule 3c-5)와 비자발적 이전 예외는 A-13 입력 스키마의 예외 플래그·증빙 claim으로 흡수하며 신규 Element는 불요하다. 셋째, 적격구매자 자산 실재성(5백만/2천5백만 달러)은 결정론 판정이 아니라 신뢰 발급자의 off-chain attestation에 의한다. 넷째, 본 Recipe의 법적 논증은 보경 검토 전이므로 확정에 앞서 법률 검토를 요한다.

---

# 제2부. 구현 명세 (컨트랙트 `Fund3c7Recipe.sol` · `BuidlLikeFundRecipe.sol` 기준)

## 5. 시스템 내 위치

R3 계열은 두 컨트랙트로 실장되어 있다. R-라벨(R3)과 컨트랙트 `recipeId`는 다르므로 유의한다.

| 컨트랙트 | recipeId · ver | 구성 요소 | 활성화 |
|---|---|---|---|
| `Fund3c7Recipe.sol` | `2` · `1` | `{A-13}` | fund-bit 조건부 |
| `BuidlLikeFundRecipe.sol` | `3` · `1` | `{A-13, BUIDL-MIN}` | fund-bit 조건부 |

- 법률효과: §3(c)(7) 제외(ICA 면제) 유지.
- 결합 방식: Router의 cumulative AND. R3는 R1·R2에 상시 곱해진다(§9).

## 6. 활성화 (Activation)

두 컨트랙트 모두 `isApplicable(bytes context)`를 오버라이드하여, 엔진이 전달하는 `abi.encode(factsPacked, ctx)`의 선두 워드를 디코드하고 **bit 0("fund") 이 설정된 경우에만 활성**된다(`(factsPacked & 1) == 1`). 즉 R1의 always-on과 달리, R3는 Manifest가 그 자산을 펀드로 표지한 때에만 발동한다. 이는 제1부 §5의 "§3(c)(7) 구조 자산에만 적용"과 정합한다.

- **REQ-R3-1 (조건부 활성).** 시스템은 Manifest factsPacked bit 0이 설정된(펀드) 자산에 대하여만 R3를 활성화하여야 한다.

## 7. 구성 (Composition) — 요소 AND 집합

- **REQ-R3-2 (Fund3c7 구성).** `Fund3c7Recipe`는 `{A-13}`(적격구매자)의 통과를 요구한다.
- **REQ-R3-3 (BuidlLike 구성).** `BuidlLikeFundRecipe`는 `{A-13, BUIDL-MIN}`(적격구매자 + 데모 최소투자금)의 통과를 요구한다.
- **REQ-R3-4 (상시 평가).** fund-bit 자산의 모든 이전에서 매수인 A-13이 평가되어야 한다(§3.4 상시성). 단 기존 보유자 집합 불변식은 현재 컨트랙트 범위 밖이다(§10 seam).

## 8. 거절 (reasonCode)

R3 실패는 `RECIPE_R3_3C7_FAIL`로 표면화하되, 실제 차단은 실패 Element의 코드로 전파된다 — A-13 실패는 "매수인 적격구매자 아님 → §3(c)(7) 전원 요건 붕괴"로 읽히며, 전원 요건이라 예외 없는 hard block이다. D-01(§12(g)) 초과는 R3가 아니라 별건 경고로 다룬다.

## 9. Conflict·Interaction — 상시 누적

| 상대 | 패턴 | 설명 |
|---|---|---|
| R1(발행) | Cumulative(항상) | §3(c)(7) 펀드 발행이면 R1(506(c) A-03)+R3(A-13) 동시. 적격구매자 ⊂ 적격투자자(QP가 더 엄격)이므로 A-13 통과면 A-03도 사실상 충족 |
| R2(재판매) | Cumulative(항상) | 재판매 매수인도 적격구매자여야 함(전원·상시) |
| R-XJ | Cumulative(always-on) | A-01·A-02 공유 |
| §3(c)(1)(100인) | 대체 경로 | 적격구매자 불요·100인 제한 — 본 시스템은 §3(c)(7) 채택(무제한 적격구매자). Manifest로 분기 |

## 10. Mock·Production Seam (현재 구현) ⭐

컨트랙트의 요소 집합은 제1부 논증이 요구하는 이상 집합보다 축약되어 있다.

| §3(c)(7) 논증이 요구(제1부) | 컨트랙트 포함? | seam |
|---|---|---|
| ㉠ 전원 적격구매자 — A-13 | ✅ (Fund3c7·BuidlLike 모두) | — |
| ㉠ 법인 매수인 — A-08·A-09 | **미포함** | 법인 적격성 확립 축이 빠짐 |
| ㉡ 공모 아님 — **B-04·A-12** | **미포함** | 후단(비공개) 요건 자체가 배선에 없음 — mock은 매수인 자격만 봄 |
| exclusively 불변식(기존 보유자 비-QP 0) | **미포함** | 컨트랙트는 현재 매수인 A-13만 확인, 보유자 집합 상태 불변식 없음 |
| §12(g) 보유자 수 — D-01 | R3 구성에 없음(별건 부착) | D-01은 Manifest 부착 별건, R3 requiredElements 아님 |

즉 현재 `Fund3c7Recipe`는 "적격구매자 확인"이라는 ㉠의 자연인 축만 mock으로 구현하며, ㉡(공모 아님, B-04·A-12)과 법인 look-through(A-08·A-09), 상시 불변식은 production seam이다. `BuidlLikeFundRecipe`는 여기에 데모 최소투자금(BUIDL-MIN)을 더한 자산별 배선이다. production 확정 시 ㉡ 축과 법인 축의 편입, exclusively 상태 불변식의 온체인화를 검토하여야 한다.

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | fund-bit 미설정 자산 | R3 미발동(isApplicable=false) |
| 2 | fund-bit 설정, 매수인 A-13 통과 | Fund3c7 PASS |
| 3 | fund-bit 설정, 매수인 비적격구매자 | RECIPE_R3_...FAIL (전원 요건 hard block) |
| 4 | BuidlLike, A-13 통과·BUIDL-MIN 미달 | BUIDL-MIN 코드로 차단 |
| 5 | D-01(§12(g)) 초과 | 별건 경고(R3 자체 실패 아님) |

## 12. 잔여 확정 항목

1. ㉡(공모 아님) 축 B-04·A-12의 R3 구성 편입(현재 미포함).
2. 법인 매수인 look-through(A-08·A-09) 편입.
3. exclusively 불변식(보유자 집합 비-QP 0)의 온체인화 — D-01 카운터와 통합.
4. knowledgeable employee(Rule 3c-5)·비자발 이전 예외의 A-13 입력 스키마화.
5. R-라벨(R3) 대 컨트랙트 recipeId(2·3)의 명명 정리.
6. 본 Recipe 법적 논증의 보경 검토(review-required: legal).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생(승준 walkthrough 재구성, 보경 미검토) | 승준 recipe walkthrough R3 v1.0 (2026-06-17) §4 |
| 제5~9·11절 (구현) | 실장 | `Fund3c7Recipe.sol` · `BuidlLikeFundRecipe.sol` |
| 제10절 (seam) | 실장·분석 | 두 컨트랙트 주석 + 제1부 논증 대조 |

## B. 근거 문헌

- 원 출처(substance): 승준 recipe walkthrough `R3_ICA-3c7-Fund.md` v1.0 (2026-06-17). 보경 recipe 검토본 없음.
- 구현: `src/compliance/recipes/Fund3c7Recipe.sol` · `BuidlLikeFundRecipe.sol` · `BaseRecipe.sol`
- 결정: `ADR-004`(Element Pool Freeze) · `ADR-006`(asset-agnostic) · `ADR-008`(§12(g) held-of-record 정오 — D-01)
- 공유 개념: `SPEC.md`
- 1차 출처: 15 U.S.C. § 80a-3(a)(1)(C) · § 80a-3(c)(7)(A) · § 80a-2(a)(51) · § 78l(g)(§12(g)) · 17 C.F.R. § 270.3c-5

## C. 변경 로그

- [2026-07-28] v2.0 — element spec과 동일한 2부 형식으로 재작성. 기존 v1.0(2026-06-17, 조문별 삼단논법 단일부)을 대체. 제1부는 §3(c)(7)(A) 전단(전원 QP)·후단(공모 아님)·§2(a)(51) QP 정의·§12(g) 별건 구별·상시성을 산문화. §12(g) held-of-record는 ADR-008 정오와 정합. 제2부는 `Fund3c7Recipe.sol`(recipeId 2, {A-13})·`BuidlLikeFundRecipe.sol`(recipeId 3, {A-13,BUIDL-MIN}) 기준. ⭐ mock이 ㉠ 자연인 축(A-13)만 구현하고 ㉡(B-04·A-12)·법인 look-through(A-08·A-09)·exclusively 불변식이 빠졌음을 §10 seam으로 명시. review-required: legal.
- [2026-06-17] v1.0 — (구) 조문별 삼단논법 walkthrough.
