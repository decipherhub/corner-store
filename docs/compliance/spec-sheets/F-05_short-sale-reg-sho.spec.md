---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: F-05
element-name: Short Sale Restriction (공매도 규율 · Reg SHO)
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 승준 walkthrough 기반(보경 미검토)."
substance-sot: "승준 walkthrough — F-05_short-sale-reg-sho.md (레포 docs/compliance/elements). 보경 검토본 없음 — 법률 검토 필요."
review-required: legal
umbrella: "SPEC.md — 공유 개념(Element/Recipe/Manifest·온·오프체인 경계·검증 패턴·timing·F-04 Reg M 대비)은 여기에 의한다"
stateful: "조건부 — Rule 204 close-out에 한하여 STATEFUL(잠정), 나머지 STATELESS. 승격 시 확정."
tags: [requirement-spec, F-05, short-sale, reg-sho, conduct-operational, target-spec, deferred, review-required]
---

# F-05 Short Sale Restriction (Reg SHO) — 요구사항 명세서

> **저술 지위 고지.** 본 부품에는 보경 변호사가 검토한 element walkthrough가 존재하지 아니하며, 승준이 작성한 spec-only stub만이 유일한 실질 출처이다. 따라서 **제1부의 법적 논증은 그 미검토 stub에서 파생된 것으로서, 법률 검토로 확정되기 전까지 권위 있는 근거로 인용될 수 없으며**(제4절), 검토를 요한다. 또한 본 부품은 코드로 구현되지 아니하였으므로(2026-06-17 DEFERRED 결정), **제2부는 규율 대상 행위가 장래 도입될 경우를 상정한 목표 명세**이다.

본 문서는 컴플라이언스 부품 F-05(공매도 규율)의 요구사항 명세서이다. **제1부**는 본 부품이 강제할 규율의 법적 근거와 그 도출 과정을, **제2부**는 이를 구현하기 위한 목표 인터페이스·상태·인수 기준을 규정한다. 법적 실질은 보경 검토본이 아니라 승준의 spec-only stub에 의거하며, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로 제2부는 목표 규격이다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 다른 부품과 달리 규율 대상 행위 자체의 존부가 선결 문제로 놓인다. Regulation SHO가 규율하는 행위는 공매도 주문이나, 현재 대상 거래장에는 공매도·증거금 거래·차입 매도의 mechanism이 존재하지 아니하여 규율할 행위가 발생하지 아니한다. 따라서 본 부품은 코드로 구현되지 아니한 채 설계 명세로만 유지되며, 규율 대상 행위가 장래 도입되는 경우에 갖추어야 할 목표 규격을 규정한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

F-05는 미국 공매도 규제인 Regulation SHO(17 C.F.R. §§ 242.200–204)가 요구하는 공매도 주문의 표시·차입 확인·가격 제한·결제불이행 처리를, 규율 대상 행위가 존재하는 경우에 한하여 거래 직전 판정하고 사후에 추적하는 부품이다. 그러나 본 부품에 있어서는 그 규율 대상 행위가 현 시스템에 실재하는지가 먼저 판단되어야 한다. Reg SHO의 수범 행위는 공매도 주문이고 공매도는 매도인이 소유하지 아니한 증권의 매도인데, 대상 거래장은 발행된 토큰의 whitelist 기반 2차 이전만을 지원할 뿐 공매도·증거금 거래·차입 매도의 기능을 두지 아니한다. 규율의 방아쇠가 되는 행위 자체가 부재하므로, 승준 walkthrough는 본 부품을 코드로 구현하지 아니하고 설계 명세로만 유지하기로 결정하였다(2026-06-17 DEFERRED). 본 명세의 제2부는 그 결정을 존중하되, 규율 대상 행위가 장래 도입될 경우 본 부품이 갖추어야 할 목표 규격을 미리 규정한다.

## 2. 규범적 근거

Regulation SHO는 증권거래법(Securities Exchange Act of 1934)에 근거하여 증권거래위원회(SEC)가 제정한 공매도 규제 규칙군으로서, 네 개의 규율축으로 구성된다. 첫째, Rule 200은 공매도를 "매도인이 소유하지 아니한 증권의 매도"로 정의하고, 매도 주문에 매수(long)와 공매도(short)의 구분을 표시하도록 한다(17 C.F.R. § 242.200, 특히 (g)의 order marking). 둘째, Rule 201은 어느 증권의 가격이 직전 거래일 종가 대비 당일 10퍼센트 이상 하락한 경우, 가격 기준이 발동된 동안 당시 최우선매수호가(national best bid) 이하의 공매도를 제한하는 가격 기준(alternative uptick, short sale price test)을 둔다(17 C.F.R. § 242.201). 셋째, Rule 203은 공매도에 앞서 차입 가능한 증권을 확보(locate)하도록 요구하여 무차입 공매도를 금지한다(17 C.F.R. § 242.203(b)(1)). 넷째, Rule 204는 결제 실패(fail to deliver)가 발생한 경우 규정 기한 내 강제 매수(buy-in)를 통한 결제 이행(close-out)을 의무화한다(17 C.F.R. § 242.204). 이 규제는 한국 자본시장법의 공매도 규율 — 차입공매도 원칙 허용·무차입공매도 금지·업틱룰 — 과 규율 목적이 상응한다.

## 3. 쟁점별 논증

### 3.1 규율 대상 행위의 존부

본 부품이 규율할 행위가 현 시스템에 실재하는지가 먼저 문제된다. Reg SHO의 수범 행위는 공매도 주문이고, 공매도는 매도인이 소유하지 아니한 증권을 매도하는 거래이다. 그런데 대상 거래장은 이미 발행되어 whitelist에 등재된 토큰의 2차 이전만을 지원할 뿐, 공매도·증거금 거래·차입 매도를 성립시키는 mechanism을 두지 아니한다. 규율의 방아쇠가 되는 행위 자체가 부재하므로, 지금 차단할 대상이 존재하지 아니한다. 이 점에서 본 부품은 상시 발행이 "끝나지 아니하는 매수 금지"를 낳아 always-on 차단을 요구하였던 Reg M(F-04)과 정반대의 구조에 선다. F-04는 규율 대상 행위(발행자의 자기 매수)가 시스템에 실재하여 구현이 필요하였던 반면, F-05는 그 행위가 부재하다.

### 3.2 비활성 stub로 두는 근거 — 절약 원칙

규율 대상이 부재한 부품을 어떻게 취급할 것인지가 문제된다. 작동할 일이 없는 부품을 상시 활성으로 배치하면 gas와 복잡도만 증가할 뿐 법적 포섭 범위는 늘지 아니한다. 따라서 본 부품은 설계 명세로 기록하되 코드로 구현하지 아니하고, 규율 대상 행위가 도입되는 시점에 구현 부품으로 승격하는 것이 옳다. 부품의 실재 여부를 가르는 판별 기준은 "이 규제가 막으려는 행위가 현 시스템에 실재하는가"이며, 실재하면 구현(F-04), 부재하면 stub(F-05)이다. 이는 승준 walkthrough가 F-04와의 대비를 통하여 제시한 판별 규칙으로서, 본 명세도 이를 따른다.

### 3.3 승격의 방아쇠

본 부품이 언제 구현으로 전환되는지가 문제된다. 승준 walkthrough는 다음 네 경우를 승격의 방아쇠로 든다. 첫째, 거래장에 공매도 또는 공매도 포지션 기능이 도입되는 경우이다. 둘째, 증거금·레버리지 거래가 도입되는 경우이다. 셋째, 공매도와 동등한 효과를 내는 파생상품(선물·옵션·synthetic)이 도입되는 경우이다. 넷째, 대상 자산이 공매도가 가능한 다른 시장에 상장되어 간접적으로 공매도 노출이 형성되는 경우이다. 이 중 하나라도 충족되면 본 부품은 비활성에서 활성 판정 부품으로 전환되며, 그 시점에 Rule 200·201·203·204의 원문 대조와 테스트가 선행되어야 한다.

### 3.4 공개시장 부재 자산에서의 적용 난점

승격을 가정하더라도, 대상 자산의 성격이 각 규율축의 적용에 난점을 낳는다는 점이 문제된다. Rule 201의 가격 기준은 최우선매수호가를 전제로 하므로, 국가 거래소에 상장되거나 공표 시세가 형성되지 아니한 native-issuance 자산에서는 기준이 될 호가 자체가 존재하지 아니할 수 있다. 이는 물량 한도(C-08)에서 4주 평균 거래량 기준이 무시장 자산에서 영에 수렴하였던 것과 동형의 구조적 문제이다. 마찬가지로 Rule 203의 locate 요건은 차입 가능 물량과 대차 시장을 전제하므로, 대차 mechanism이 없는 자산에서 그 요건이 어떻게 성립하는지가 불명확하다. 이러한 난점은 본 부품이 규율 대상 행위와 함께 도입될 mechanism의 구체적 형태에 의존하여 결정되므로, 승격 시 자산 맥락과 함께 재검토되어야 한다.

### 3.5 수범 주체 문제

본 부품이 강제하려는 의무의 수범자가 누구인지가 문제된다. Reg SHO의 locate·close-out 의무는 통상 broker-dealer에게 부과된다. 대상 거래장이 broker-dealer로 등록·취급되지 아니하는 구간에서는 본 부품이 강제하려는 의무의 규범적 귀속 주체가 불분명하며, 이는 의심거래 보고(F-03)에서 보고 의무의 활성화가 broker-dealer 지위에 연동되었던 것과 같은 미결 지점이다. 따라서 수범 주체의 확정은 본 부품의 승격·활성화와 함께 판단되어야 한다.

## 4. 저술 지위 및 검토 요청

전술한 바와 같이 본 부품의 법적 실질은 보경 변호사의 검토를 거친 walkthrough가 아니라 승준이 작성한 spec-only stub에 의거한다. 위 논증은 그 stub의 판단(규율 대상 행위의 부재·절약 원칙·승격 방아쇠)을 정리하고 1차 출처인 Reg SHO 원문에 연결한 것에 불과하며, 아직 법률 검토로 확정되지 아니하였다. 따라서 다음 사항에 관하여 검토를 요한다.

첫째, native-issuance RWA 맥락에서 Reg SHO의 수범 행위(공매도)가 실제로 발생하지 아니한다는 판단, 그리고 그에 근거한 코드 미구현 결정의 타당성. 특히 2차 거래에서 매도인이 보유하지 아니한 토큰을 매도하는 형태나 결제 지연이 사실상 공매도에 해당할 여지가 없는지를 포함한다. 둘째, Reg SHO의 적용 대상 증권의 범위 — 대상 토큰(펀드 지분형 RWA 등)이 Reg SHO가 규율하는 증권에 해당하는지, 아니면 그 성격상 적용에서 벗어나는지. 셋째, locate·close-out 의무의 수범 주체 — 대상 거래장이 broker-dealer로 등록·취급되지 아니하는 경우 본 부품이 강제하려는 의무의 규범적 귀속(제3.5절, F-03과 연동). 넷째, 공개시장·최우선매수호가가 부재한 자산에서 Rule 201 가격 기준과 Rule 203 locate 요건이 성립하는 방식(제3.4절). 다섯째, 승준 stub가 든 네 가지 build-trigger의 완결성 — 공매도 효과를 내는 다른 mechanism의 유무와, 각 trigger에서 적용될 Rule의 범위·순서. 여섯째, 코드 미구현 결정 자체의 유지 여부 — 규율 대상 행위가 부재하더라도 방어적으로 baseline dormant gate를 두는 것이 옳은지. 확정된 논증은 element walkthrough로 승격하여 본 명세의 원 출처로 삼는다.

---

# 제2부. 구현 명세 (목표 — 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `F-05-v1` (미구현) |
| 분류 | 행위·운영 규율(CONDUCT_OPERATIONAL) |
| 검증 패턴 | A(기계 판정: 표시·가격 비교) + B(차입 증빙 attestation) 혼합 추정 — 승격 시 확정 |
| 판정 시점 | 거래 전 관문(PRE_TRADE_GATE, 공매도 주문 시점) + 거래 후 상태 갱신(Rule 204 close-out) |
| 상태 | 조건부 STATEFUL — Rule 204 close-out(fail-to-deliver 시계)에 한함, 나머지 STATELESS. 승격 시 확정 |
| 활성 | 비활성(dormant). 현 시스템에 공매도·증거금·차입 매도 mechanism 부재로 수범 행위 없음. Build-trigger(제3.3절) 충족 시 활성 |
| 의존 부품 | Manifest(공매도 지원 선언) · B-04(엔진·주문 유형) · 시장 price feed(Rule 201) · locate/borrow attestation 소스(Rule 203) · Layer 5(Rule 204 상태) |

전용 컨트랙트가 없으므로 본 절 이하는 목표 규격이다. 현 시스템에서 본 부품은 어느 거래에도 개입하지 아니하는 비활성 상태이며, 아래 판정 구조·인터페이스·요구사항은 승격 시점에 실장 기준으로 확정된다.

## 6. 목표 판정 구조

본 부품의 판정은 두 층으로 나뉜다. 첫째 층은 공매도 주문 시점의 거래 전 관문으로서, ① 주문이 공매도로 표시되었는지(Rule 200(g)), ② 차입 locate 증빙이 확인되는지(Rule 203), ③ 가격 기준 발동 중 최우선매수호가 이하가 아닌지(Rule 201)를 순차로 검사하여 하나라도 위반하면 거절한다. 둘째 층은 거래 후 결제 국면의 상태 추적으로서, 결제 실패가 발생하면 규정 기한 내 강제 매수를 통한 결제 이행을 관리한다(Rule 204). 다만 대상 거래장에 공매도 mechanism이 선언되지 아니한 동안에는 첫째 층의 관문에 도달하는 공매도 주문 자체가 존재하지 아니하므로, 본 부품은 어느 거래도 차단하지 아니하는 비활성 상태로 통과시킨다.

Rule 204 close-out의 상태 전이는 다음과 같다.

`SETTLED → FAIL_TO_DELIVER → { CLOSED_OUT · OVERDUE }`

정상 결제는 `SETTLED`로 종료되고, 결제 실패는 `FAIL_TO_DELIVER`에서 규정 기한 내 강제 매수로 `CLOSED_OUT`에 이르며, 기한을 도과하면 `OVERDUE`로 전이되어 후속 거래를 제한한다.

## 7. 목표 인터페이스

본 절의 시그니처·타입·호출 규약은 개발팀의 실현가능성 확정 이전의 제안이며, 승격 시점에 확정된다.

```
// 온체인 pre-trade 관문 (공매도 주문 시점):
check(order: ShortOrderRef, asset: AssetRef, ctx: TxContext) -> Result
Result = { passed: bool, reasonCode: ReasonCode }

// 판정 순서(공매도로 표시된 주문에 한함):
//   1) Rule 200(g) marking  → 표시 없는 공매도는 FAIL_SHORT_NOT_MARKED
//   2) Rule 203  locate      → 증빙 없는 무차입 공매도는 FAIL_LOCATE_MISSING
//   3) Rule 201  price test  → 기준 발동 중 best bid 이하이면 FAIL_PRICE_TEST

// 거래 후 상태 (Rule 204, Layer 5):
onSettlementFail(tx) -> { asset, party, failedAt, closeOutBy }   // fail-to-deliver 시계
```

Manifest에 공매도 지원이 선언되지 아니한 자산·거래장에서는 `check`가 호출되는 공매도 주문 자체가 성립하지 아니하며, 본 부품은 `PASS_NO_SHORT_CONDUCT`로 비활성 통과한다. 선언이 불명확한 경우는 `REVIEW_SHORT_CAPABILITY_UNDECLARED`로 심사에 회부한다.

## 8. 기능 요구사항 (목표)

- **REQ-F05-1 (수범 행위 부재 시 비활성).** 시스템에 공매도·증거금·차입 매도 mechanism이 없는 동안 본 부품은 판정 대상이 없으며 비활성으로 둔다. 규율 대상 행위가 부재한 상태에서 본 부품은 어느 거래도 차단하지 아니한다.
- **REQ-F05-2 (주문 표시, Rule 200(g)).** 공매도 기능이 도입되면 모든 매도 주문은 매수·공매도로 표시되어야 하며, 공매도로 표시된 주문만 본 부품의 판정 대상이 된다. 공매도임에도 표시되지 아니한 주문은 거절한다.
- **REQ-F05-3 (차입 확인, Rule 203).** 공매도 주문은 차입 가능 물량에 대한 locate 증빙이 확인된 경우에만 통과시킨다. 증빙이 없는 무차입 공매도는 거절한다.
- **REQ-F05-4 (가격 제한, Rule 201).** 대상 자산이 직전 거래일 종가 대비 당일 10퍼센트 이상 하락하여 가격 기준이 발동된 경우, 당시 최우선매수호가 이하의 공매도를 거절한다.
- **REQ-F05-5 (결제 이행, Rule 204).** 결제 실패가 발생한 경우 규정 기한 내 강제 매수를 통한 결제 이행을 추적·관리한다. 본 요구사항은 상태를 보유한다(조건부 STATEFUL).
- **REQ-F05-6 (승격).** 공매도·증거금·파생·간접 상장 중 하나가 도입되면 본 부품을 비활성에서 활성 판정 부품으로 승격하고, Rule 200·201·203·204의 원문 대조와 테스트를 선행한다.
- **REQ-F05-7 (Manifest 선언).** 자산 또는 거래장이 공매도를 지원하는지는 Manifest에 선언되며, 본 부품은 그 선언을 전제로 활성화된다. 선언이 없거나 불명확한 경우 심사에 회부한다.

## 9. reasonCode

아래 코드는 승준 walkthrough에 대응하는 reasonCode 표(§6.1 등)가 부재하여 본 명세에서 저술한 것이며, 승격 시 법률·개발 검토로 확정한다.

| Code | 발생 조건 | 처리 |
|---|---|---|
| `PASS` | 공매도가 아니거나, 표시·차입·가격 요건을 모두 충족한 공매도 | 통과 |
| `PASS_NO_SHORT_CONDUCT` | 거래장에 공매도 mechanism 부재 — 규율 대상 행위 없음 | 통과(비활성). 본 부품이 관여하지 아니함 |
| `FAIL_SHORT_NOT_MARKED` | 공매도이나 주문에 공매도 표시 없음(Rule 200(g)) | 거절 |
| `FAIL_LOCATE_MISSING` | 차입 locate 증빙 부재(Rule 203(b)(1)) — 무차입 공매도 | 거절 |
| `FAIL_PRICE_TEST` | 가격 기준 발동 중 최우선매수호가 이하의 공매도(Rule 201) | 거절 |
| `FAIL_CLOSE_OUT_OVERDUE` | 결제 실패 후 규정 기한 내 close-out 미이행(Rule 204) | 거절·강제 매수 |
| `REVIEW_SHORT_CAPABILITY_UNDECLARED` | Manifest에 공매도 지원 선언이 없거나 불명확 | 심사 회부 |

## 10. 의존성

```
Manifest(공매도 지원 선언)          → 활성 조건            → F-05
B-04(엔진·주문 유형)                → long/short marking   → F-05 (Rule 200(g))
시장 price feed                     → best bid·circuit breaker → F-05 (Rule 201)
locate/borrow attestation 소스      → 차입 증빙            → F-05 (Rule 203)
(Trusted Issuer·대차 desk)
Layer 5(fail-to-deliver 추적)       → close-out 상태·시계  → F-05 (Rule 204)
```

본 부품은 위 의존이 모두 갖추어질 때에만 완전한 판정을 수행할 수 있으며, 그 중 시장 price feed와 대차 attestation은 대상 자산이 공개시장·대차시장을 갖는지에 좌우된다(제3.4절, 검토 대상).

## 11. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| T1 | 공매도 mechanism 없는 현 거래장의 임의 매도 | `PASS_NO_SHORT_CONDUCT` (비활성) |
| T2 | 공매도 기능 도입 후, 매수(long) 매도 | `PASS` (비대상) |
| T3 | 표시 없는 공매도 | `FAIL_SHORT_NOT_MARKED` |
| T4 | locate 증빙 없는 공매도 | `FAIL_LOCATE_MISSING` |
| T5 | 가격 기준 발동 중 최우선매수호가 이하의 공매도 | `FAIL_PRICE_TEST` |
| T6 | 가격 기준 발동 중 최우선매수호가 초과의 공매도 | `PASS` |
| T7 | 결제 실패 후 규정 기한 도과 | `FAIL_CLOSE_OUT_OVERDUE` (강제 매수) |
| T8 | Manifest에 공매도 지원 선언 없음·불명확 | `REVIEW_SHORT_CAPABILITY_UNDECLARED` |

## 12. 잔여 확정 항목

1. 규율 대상 행위 부재 판단과 코드 미구현 결정의 법률 검토(제4절).
2. Reg SHO 적용 대상 증권의 범위 — 대상 토큰이 규율 대상에 해당하는지(제4절).
3. 수범 주체(broker-dealer 지위)와 locate·close-out 의무의 귀속(제3.5절, F-03 연동).
4. 공개시장·대차시장 부재 자산에서 Rule 201 가격 기준·Rule 203 locate 요건의 성립 방식(제3.4절).
5. Rule 204 close-out 시계·강제 매수 인프라(승격 시).
6. 3-axis 좌표(Decidability·Timing·Statefulness) 확정 및 판정 로직 의사코드(승격 시).
7. 부품 목록 등재·Recipe 부착 여부(승격 시, freeze 변경 절차).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | **파생 (보경 미검토)** | 승준 walkthrough §1~5 (spec-only stub) + 1차 출처 Reg SHO 원문 |
| 제4절 (저술 지위·검토 요청) | 신규 | 본 명세 |
| 제5~8·10~11절 (목표 구현) | 목표 | 승준 walkthrough §4(승격 작업)·§5(3-axis) + `SPEC.md` §2~3(패턴·timing)·§6(Layer 5) |
| 제9절 (reasonCode) | **신규 저술** | 본 명세 — walkthrough에 대응 표 부재 |
| 제12절 (잔여 확정) | 파생·신규 | 승준 walkthrough §4·§5 + 본 명세 |

제1부는 보경 검토를 받지 아니한 승준 draft에서 파생되었으므로, 법률 검토로 확정될 때까지 권위 있는 근거로 인용하지 아니한다. 검토로 확정된 논증은 element walkthrough로 승격하여 이후 개정의 단방향 동기화 기준으로 삼는다.

## B. 근거 문헌

- 원 출처(substance): 승준 walkthrough `F-05_short-sale-reg-sho.md` (2026-06-17, spec-only stub·DEFERRED) — 레포 `docs/compliance/elements/`. **보경 검토본 없음 — 법률 검토 필요.**
- 결정 맥락: 쟁점 등록부 §1-가 F-05 (freeze-blocking, 규제 담당 단독 결정, 2026-06-17). F-04는 ADR-001로 대비 확정(행위 실재 vs 부재가 두 결정을 가름).
- 공유 개념: `SPEC.md` 제2·3·6·7절 (Element/Recipe/Manifest·검증 패턴·timing·Layer 5·예방/탐지 경계)
- 대비 부품: `spec-sheets/F-03_suspicious-activity.spec.md`(broker-dealer 활성화 미결) · `spec-sheets/C-08_volume-limit.spec.md`(무시장 자산 기준 귀착) — 동형 미결 지점 참조
- 1차 출처: 17 C.F.R. § 242.200 (short sale 정의 · (g) order marking) · § 242.201 (alternative uptick price test) · § 242.203(b)(1) (locate) · § 242.204 (close-out) — Regulation SHO, Securities Exchange Act of 1934 하 SEC 규칙

## C. 변경 로그

- **[2026-07-28] v0.1** — 승준 spec-only stub 기반 2부 명세 신설(보경 미검토). 제1부: 규율 대상 행위(공매도) 부재 → 비활성 stub 근거·F-04 대비 판별 기준·승격 방아쇠 4종·무시장 자산 적용 난점(Rule 201 최우선매수호가·Rule 203 locate)·수범 주체(broker-dealer) 미결. 제2부: 컨트랙트 미구현 → 목표 규격(pre-trade 관문 + Rule 204 조건부 STATEFUL·목표 인터페이스·REQ-F05-1~7·reasonCode 7종 저술). 법률 검토 6항(제4절) 명시. 승준 draft는 보경 검토 전이므로 권위 인용 유보.
