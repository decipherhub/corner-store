---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-06
element-name: Affiliate / Control Person (계열자·지배관계인 판정)
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough."
substance-sot: "보경 walkthrough — A-06_법리검증기준서_v1.md (2026-07-21). 레포 docs 교체 대상."
reflects-decisions: [ADR-004, ADR-006, ADR-008(D-B)]
umbrella: "SPEC.md — 공유 개념(검증 패턴 B/C·person-group·off-chain Layer 5)은 여기에 의한다"
stateful: false
review-required: legal
tags: [requirement-spec, A-06, affiliate, control-person, rule-144, stateless, R2, R4]
---

# A-06 Affiliate / Control Person — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-06(계열자·지배관계인 판정)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 법리검증기준서에 의한다. 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로 제2부는 목표 규격이며, 계열 여부를 확인·소비하는 온체인 패턴은 증명서형(패턴 B) 형제 부품 `AccreditedInvestor.sol`(A-03)과 감시형(패턴 C) 형제 부품 `SurveillanceFlag.sol`(F-02)을 참조한다. 시스템 공유 개념(Element·Recipe·Manifest·검증 패턴·person-group·off-chain Layer 5)은 `SPEC.md`에 의한다.

본 부품은 어느 매도인이 발행인의 계열자(affiliate)인지를 Rule 144의 질적 지배 기준으로 판정하여, 그 결과로 Rule 144 재판매 조건군의 적용 범위를 결정하는 신원·자격 판정 부품이다. 판정 명칭에 쓰인 "내부자"는 계열자(Rule 144 affiliate)를 가리키는 것으로서, 증권거래법 §16의 내부자(insider)와는 근거와 기준이 다르므로 구별한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-06은 어느 매도인이 발행인의 계열자인지를 거래 직전에 판정하는 부품이다. 계열 여부는 그 자체로 거래를 막는 결론이 아니라, 매도인에게 Rule 144의 어떤 조건이 붙는지를 가르는 분기점이다. 매도인이 계열자가 아니면 비계열 안전항으로 조건이 크게 줄고, 계열자이면 현행 공시정보·물량 한도·매도 방법·Form 144의 조건군이 병행하여 붙는다. 이 판정은 지분율 같은 정량 문턱이 아니라 지배관계의 질적 기준으로 이루어지며, 매도 시점의 판단과 함께 소정 기간의 소급 확인(look-back)을 요구한다. 본 부품은 계열 여부를 온체인에서 재계산하지 아니하고 Trusted Issuer의 서명 claim을 확인하며(패턴 B), 정량 스크리닝의 경계 사안은 사람의 판단으로 넘긴다(패턴 C).

## 2. 규범적 근거

계열자 판정의 뿌리는 인수인 개념의 확장에 있다. 1933년 증권법 §2(a)(11)은 그 말미에서 "발행인"에 발행인을 직접·간접으로 지배하거나 발행인에 의하여 지배되거나 발행인과 공동의 지배 아래 있는 자를 포함한다고 규정한다(15 U.S.C. § 77b(a)(11)). 그 결과 계열자로부터 유통을 목적으로 취득하거나 계열자를 위하여 매도하는 자도 인수인이 될 수 있고, 계열자 자신의 매도 역시 이 위험에 놓인다. Rule 144은 이 위험에 대한 안전항이며, 계열 여부가 안전항의 조건 구성을 가른다.

계열자의 정의는 Rule 144(a)(1)에 있다(17 C.F.R. § 230.144(a)(1)). 그 정의가 쓰는 "지배(control)"를 Rule 144은 자체적으로 정의하지 아니하므로, Rule 405의 지배 정의가 확립된 해석 기준으로 적용되고(17 C.F.R. § 230.405), SEC의 공식 간행물이 Rule 144 맥락에서 그 정식을 그대로 확인한다(SEC, *Rule 144: Selling Restricted and Control Securities*). 비계열 자격의 요건은 Rule 144(b)(1)이, 계열자에 대한 소급 tail은 (b)(2)가, 매도 계산 주체의 합산 범위는 (a)(2)가 정한다. 이들과 대비되는 축으로 투자회사법의 affiliated person 정의(15 U.S.C. § 80a-2(a)(3))와 지배 추정(동 § 80a-2(a)(9)), 증권거래법 §16의 내부자 규정(15 U.S.C. § 78p(a)(1))이 있으나, 이들은 정량·자동 기준을 두는 다른 계보로서 Rule 144 판정식에 이식되지 아니한다.

## 3. 쟁점별 논증

### 3.1 계열 판정이 무엇을 켜는가

계열 여부의 판정이 어떤 법률효과를 가지는지가 문제된다. §2(a)(11)이 계열자를 "발행인"에 포함시키는 결과, 계열자의 매도와 계열자를 위한 매도에는 인수인 리스크가 따르고, Rule 144(b)(2)는 그 매도에 이 조의 모든 조건을 붙인다. 반대로 비계열자의 매도는 (b)(1)에 따라 조건이 축소된다. 따라서 계열 판정은 그 자체가 거래의 통과·차단을 결정하는 관문이 아니라, 뒤따르는 Rule 144 조건군의 적용 범위를 정하는 분기이다. 본 시스템에서 계열 판정이 참이 되면 현행 공시정보(Rule 144(c) → E-05), 물량 한도(Rule 144(e) → C-08), 매도 방법(Rule 144(f)·(g) → C-09), Form 144(Rule 144(h) → E-06)의 네 조건이 연쇄로 활성화된다. 그러므로 본 부품의 산출은 판정 결과(계열·비계열·심사)이며, 실제 차단은 그 결과가 켜는 하류 부품이 수행한다.

### 3.2 지배의 질적 기준과 bright-line 금지

계열 여부를 정량 문턱으로 판정할 수 있는지가 문제된다. Rule 405는 지배를 "의결권증권의 소유·계약 그 밖의 방법 여하를 불문하고, 직접·간접으로 어떤 자의 경영과 정책의 방향을 지시하거나 지시를 야기할 수 있는 힘의 보유"로 정의하며, 여기에는 어떠한 지분율 기준도 없다(17 C.F.R. § 230.405). 이 무정량성이 본 부품의 bright-line 금지 원칙의 조문상 뿌리이다. 나아가 Rule 144은 지배를 자체 정의하지 아니하므로, 그 적용은 Rule 405 정의(Layer 1)와 이를 Rule 144 맥락에 적용함을 확인하는 SEC 간행물(Layer 2)의 2단 구성으로 이해하여야 하며, "Rule 144(a)(1)이 Rule 405를 정의로 지정한다"는 식의 단정은 부정확하다. 그러므로 어떠한 지분율(5%·10%·25% 등)도 계열 여부의 PASS/FAIL 규칙으로 코딩되어서는 아니 되고, 그러한 수치는 오직 스크리닝과 심사 라우팅의 입력으로만 등장하여야 한다. 판정은 사실과 정황에 대한 질적 평가로 남는다.

### 3.3 이사·임원의 취급 — 예시의 규칙 승격 금지

이사·임원이라는 지위만으로 계열자가 되는지가 문제된다. SEC 간행물은 임원·이사·대주주를 지배관계에 있는 자의 예시로 들되 이를 "such as"의 예시로만 제시하며, 자동 범주나 지분율 기준으로 규정하지 아니한다. 즉 Rule 144에서 이사·임원의 지위는 지배관계를 시사하는 실무상 추정일 뿐, 그 지위만으로 계열자가 확정되는 것은 아니다. 이는 투자회사법 §2(a)(3)(D)가 임원·이사·파트너·직원을 직함만으로 affiliated person으로 규정하는 것과 정반대의 구조이다(15 U.S.C. § 80a-2(a)(3)(D)). 따라서 본 부품은 운영상 추정(스크리닝 정책)과 법적 판정(사실·정황)을 분리하여야 하며, 직함에 근거한 자동 계열 판정을 두어서는 아니 된다. 직함 표지는 심사 큐로의 입력으로만 기능한다.

### 3.4 이중 look-back — 비계열 자격과 계열 tail

계열자였던 자가 언제부터 비계열자로 취급되는지가 문제된다. Rule 144(b)(1)은 비계열 자격을 두 요건의 결합으로 정한다. 매도 시점에 계열자가 아닐 것과, 매도에 앞선 소정 기간 동안 계열자였던 적이 없을 것이다(17 C.F.R. § 230.144(b)(1)). 그런데 그 소급 기간의 단위가 조문 사이에서 의도적으로 다르다. (b)(1)은 "직전 3개월(preceding three months)"이라는 역월을 쓰고, 계열자에 대한 tail을 정하는 (b)(2)는 "매도 직전 90일(90 days immediately before the sale)"이라는 일수를 쓴다(동 § 230.144(b)(2)). 역월 3개월은 89일에서 92일 사이로 변동하므로 두 기간은 경계에서 일치하지 아니한다. 따라서 이 둘을 하나의 "90일"로 통합하여 서술하거나 구현하면 경계일의 오판정을 낳는다. 비계열 판정 로직은 매도 시점 비계열과 소급 무계열의 두 원자 검증을 모두 담아야 하고, 온체인 게이트는 두 기간을 각각 평가하거나 보수적으로 그 중 긴 기간을 요구하여야 한다. 계열자에서 비계열자로의 상태 전이에서, tail이 경과하기 전에 비계열 안전항 경로를 여는 것이 본 부품의 가장 흔한 오구현 지점이다.

### 3.5 person 합산의 용도 구분

Rule 144(a)(2)의 10% 합산이 계열 판정 기준인지가 문제된다. (a)(2)는 매도의 계산 주체인 "person"을 확장하여, 동거하는 친족과 배우자, 그들이 합산 10퍼센트 이상의 수익지분을 갖거나 수탁자 등으로 있는 신탁·유산, 그들이 합산 10퍼센트 이상의 지분을 가진 법인·단체를 포함시킨다(17 C.F.R. § 230.144(a)(2)). 이 10퍼센트는 계열 여부의 판정 기준이 아니라, "누구의 매도로 세는가"라는 합산 범위의 정의이다. 그 용처는 세 갈래로 구분된다. 본 부품의 판정 대상 확장(계열자 본인 외에 합산 person을 게이트에 태울지), C-08의 물량 합산, Form 144 임계 계산의 입력이다. 이 10퍼센트를 지배 기준으로 승격시키면 §3.2의 bright-line 금지에 반한다. 합산 person의 확정은 신원 그래프에 의존하므로, 본 부품은 A-04와 A-09의 identity graph를 입력으로 받아 판정 대상을 확정한다.

### 3.6 control securities — 취득 경로 불문

Rule 144의 조건이 계열자가 보유한 제한증권에만 미치는지가 문제된다. Rule 144(b)(2)는 계열자의 매도 대상을 "제한증권 또는 그 밖의 증권(restricted or any other securities)"으로 규정한다(17 C.F.R. § 230.144(b)(2)). 즉 계열자의 보유분은 그것이 제한증권인지 여부와 무관하게 Rule 144의 조건 대상이 되며, 이것이 control securities 개념의 문언 근거이다. 본 시스템의 토큰이 어차피 전부 제한증권이라는 사실이 이 법리를 생략할 이유가 되지는 아니한다. 계열 여부는 증권이 아니라 사람에 붙는 속성이므로, 계열자로 판정된 자의 보유분은 취득 경로를 불문하고 조건군의 대상으로 취급되어야 한다.

### 3.7 축 교차 오염 금지 — ICA·§16 대조와 dormancy

같은 프로젝트에 공존하는 다른 법의 계열·지배 개념이 Rule 144 판정에 스며드는지가 문제된다. 본 자산은 투자회사법 §3(c)(7) 펀드 구조(R3) 위에 서 있으므로, 투자회사법의 affiliated person 정의가 A-06으로 새어 들어올 위험이 실재한다. 그러나 그 축은 Rule 144과 정반대의 정량·자동 체계이다. 투자회사법 §2(a)(3)은 5퍼센트 이상 의결권증권 보유를 자동 affiliated person으로 삼고(15 U.S.C. § 80a-2(a)(3)(A)·(B)), 임원·이사·파트너·직원을 직함만으로 포함시키며(동 (D)), §2(a)(9)는 25퍼센트 초과 보유에 지배 추정을 두고 이를 반증 가능하게 한다(15 U.S.C. § 80a-2(a)(9)). Rule 405에는 이러한 추정이 존재하지 아니한다. 한편 "내부자"라는 표제는 증권거래법 §16과 혼동되기 쉬우나, §16의 지분선은 10퍼센트 초과이고 그 의무는 §12에 따라 등록된 클래스에만 미친다(15 U.S.C. § 78p(a)(1); 15 U.S.C. § 78l(g)). 본 자산군의 토큰은 §12에 등록되지 아니하므로(보유자 수를 2,000명 미만으로 유지하여 §12(g) 등록을 회피하는 것이 D-01의 취지이다) §16은 이 자산군에 휴면 상태이다. 따라서 투자회사법의 5퍼센트·직함·25퍼센트 추정과 §16의 10퍼센트 초과 기준은 Rule 144 계열 판정식에 규칙으로 이식되어서는 아니 되며, 이들 수치는 운영 스크리닝의 힌트(심사 큐 입력)로만 쓰일 수 있다. 계열이라는 단어가 등장할 때마다 그것이 어느 법의 개념인지 특정되어야 한다.

## 4. 확정 사항 및 잔여 쟁점

계열 판정의 질적 지배 기준(Rule 405, bright-line 부재), 매도 시점과 소급의 이중 look-back(역월 3개월과 90일의 별개 단위), (a)(2) 합산의 매도 계산 범위로서의 성격, control securities의 취득 경로 불문, 투자회사법·§16 축과의 분리와 §16 휴면, 그리고 계열 판정이 켜는 4연쇄 캐스케이드는 위와 같이 확정되었다. 다만 다음은 확정 또는 후속을 요한다. 첫째, 원 법리검증기준서는 파일 미동기화로 A-06 본문과 확정 원문의 축조 대조(verbatim diff)를 유보하였으며, 그 재개 절차가 §5에 남아 있다. 둘째, SEC 간행물의 "예시" 명제에 특정 C&DI 번호를 근거로 다는 서술이 A-06 본문에 있는 경우, 그 번호 자체가 미검증 항목으로서 별도 확인을 요한다. 셋째, 경계 심사로 라우팅할 정량 스크리닝 임계의 캘리브레이션은 운영 정책으로 확정되어야 한다. 넷째, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다.

---

# 제2부. 구현 명세 (목표 규격 — 전용 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `A-06-v1` (미구현) |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) · 계열관계(AFFILIATION) |
| 검증 패턴 | 증명서형(ATTESTATION_BASED, 패턴 B) + 감시형(MONITORING_BASED, 패턴 C) |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) |
| 상태 | STATELESS (계열 이력·look-back은 off-chain attestation. person-group 누적 상태는 하류 C-08·D-01 소관) |
| 활성 | R2(§4(a)(7)·Rule 144 재판매) 조건부 · R4(시장행위 감시) 조건부. 계열 판정 참이면 Rule 144 캐스케이드 활성. |
| 의존 | 상류: A-04·A-09(person-group) · A-11(claim 현행성) · Trusted Issuer(Securitize TA, 계열 attestation). 하류: E-05·C-08·C-09·E-06(캐스케이드) · C-08·D-01(person-group 키) · A-12·F-02·F-03(신호) · Operator(심사). |

전용 컨트랙트가 없으므로, 계열 claim 검증(패턴 B)의 온체인 형태는 `AccreditedInvestor.sol`(A-03)을, 경계 감시 flag(패턴 C)의 형태는 `SurveillanceFlag.sol`(F-02)을 모델로 한다. 계열 이력의 소급(look-back)과 person-group 해소는 off-chain 컴플라이언스 데이터 레이어(Layer 5)의 attestation과 identity graph에서 공급된다.

## 6. 목표 판정 구조

판정 결과는 `{ NON_AFFILIATE · AFFILIATE · REVIEW }`의 세 값이다. 비계열은 안전항 조건이 축소되는 통과 상태이고, 계열은 Rule 144 캐스케이드가 활성화되는 상태이며, 심사는 정량 스크리닝의 경계에서 사람의 판단으로 넘어가는 상태이다. 이는 거절 코드의 나열이 아니라 판정의 격자이다.

비계열 판정은 두 원자의 결합으로만 성립한다.

```
NON_AFFILIATE ⟺ ¬controlAtSale ∧ ¬lookback
  controlAtSale  = 매도 시점 Rule 405 지배관계 (144(a)(1))
  lookback       = within3Months ∨ within90Days
                     within3Months = 직전 3역월 계열 이력 (144(b)(1), 89~92일 변동)
                     within90Days  = 직전 90일 계열 이력 (144(b)(2))
                   (보수적 구현: max(직전 3역월, 90일) 무계열 요구)
```

`controlAtSale`이 참이면 `AFFILIATE`, 매도 시점에는 비계열이나 `lookback`이 참이면 `AFFILIATE_TAIL`로서 tail 경과 전까지 계열자로 취급한다. 정량 스크리닝 임계(≥5%·>10%·>25% 등)의 도달이나 직함 추정의 성립은 그 자체로 계열을 확정하지 아니하고 `REVIEW`로 라우팅한다. 판정 대상은 매도인 본인이 아니라 Rule 144(a)(2)로 확장된 person-group이다.

## 7. 목표 인터페이스

```solidity
// 판정 (view). user = 매도인. 계열 여부를 소비처(Router·캐스케이드·카운터)에 공급.
function check(address user, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);
//   claim = affiliateClaimOf[personGroup(user)];
//   패턴 B: 존재(1) → 발급자 신뢰(2) → 서명(3) → 만료(4)  ── 실패 시 fail-closed
//   person-group 미해소(5) ── fail-closed
//   claim.controlAtSale → 코드 6(AFFILIATE, passed=true, Router가 캐스케이드 활성)
//   claim.lookback(직전 3역월 ∨ 90일) → 코드 7(AFFILIATE_TAIL)
//   경계(정량 스크리닝·직함 추정, bright-line 아님) → 코드 8(REVIEW, Operator)
//   비계열(¬controlAtSale ∧ ¬lookback) → passed=true, reasonCode=0

// 계열 상태 coarse view — Router 캐스케이드 라우팅 · C-08/D-01 person-group 키 · A-12/F-02/F-03 신호 소비
function affiliateStatus(address user) external view returns (bool isAffiliate, uint8 tailState);

// off-chain (Layer 5 · Securitize TA attestation, 패턴 B):
attestAffiliate(personGroup) -> {
    controlAtSale: bool,   // 매도 시점 지배관계 (144(a)(1) / 405)
    within3Months: bool,   // 직전 3역월 계열 이력 (144(b)(1))
    within90Days:  bool,   // 직전 90일 계열 이력 (144(b)(2))
    sig
}
personGroup(user) = resolve(A-04 identity graph · A-09 look-through · Rule 144(a)(2) 합산)
```

계열 판정은 지분율을 온체인에서 다시 계산하는 방식이 아니라, off-chain에서 사실·정황으로 이루어진 판정을 Trusted Issuer가 서명 claim으로 발급하고 온체인은 그 claim의 진위와 소급 표지만을 확인하는 방식이다(패턴 B). 경계 사안은 차단하지 아니하고 Operator로 라우팅한다(패턴 C).

## 8. 기능 요구사항 (목표)

- **REQ-A06-1 (질적 지배 기준).** 시스템은 지분율 등 정량 기준을 Rule 144 축의 PASS/FAIL 규칙으로 삼지 아니하고, Rule 405의 질적 지배 기준(경영과 정책의 방향을 지시하거나 지시를 야기할 힘)으로 계열 여부를 판정하여야 한다.
- **REQ-A06-2 (claim 확인, 패턴 B).** 시스템은 계열 여부를 온체인에서 재계산하지 아니하고, Trusted Issuer가 발급한 서명 claim의 존재·발급자 신뢰·서명·만료를 확인하여야 한다.
- **REQ-A06-3 (이중 look-back).** 시스템은 비계열 판정에 매도 시점 비계열과 소급 무계열을 모두 요구하되, 소급은 Rule 144(b)(1)의 직전 3역월과 (b)(2)의 직전 90일을 각각 평가하거나 보수적으로 그 중 긴 기간을 적용하여야 하며, 두 기간을 하나의 "90일"로 통합하여서는 아니 된다.
- **REQ-A06-4 (tail sub-check).** 시스템은 상태 전이(계열 → 비계열) 시 tail이 경과하기 전에는 비계열 안전항 경로(R2)를 허용하여서는 아니 된다.
- **REQ-A06-5 (person-group 확장).** 시스템은 Rule 144(a)(2)의 합산 person(본인·동거 친족·합산 10퍼센트 이상 신탁·법인)을 A-04·A-09 identity graph로 해소하여 판정 대상을 확정하여야 하며, 이 10퍼센트를 지배 기준으로 승격하여서는 아니 된다.
- **REQ-A06-6 (직함 비자동).** 시스템은 이사·임원 등 직함만으로 계열자로 자동 판정하여서는 아니 되며, 그러한 표지는 운영 스크리닝의 심사 입력으로만 사용하여야 한다.
- **REQ-A06-7 (캐스케이드 활성).** 시스템은 계열 판정 시 Rule 144 조건군 E-05(현행정보 144(c))·C-08(물량 144(e))·C-09(매도방법 144(f)·(g))·E-06(Form 144 144(h))을 활성화하여야 한다.
- **REQ-A06-8 (control securities).** 시스템은 계열자의 보유분을 제한증권 여부와 무관하게 Rule 144 조건의 대상으로 취급하여야 한다(Rule 144(b)(2) "restricted or any other securities").
- **REQ-A06-9 (축 분리).** 시스템은 투자회사법 §2(a)(3)·(a)(9)의 자동·정량 기준(5퍼센트 이상·직함·25퍼센트 초과 추정)과 증권거래법 §16의 10퍼센트 초과 기준을 Rule 144 계열 판정식에 이식하여서는 아니 된다.
- **REQ-A06-10 (§16 dormancy).** 시스템은 대상 토큰이 §12 미등록인 경우 §16 지위와 Form 3/4/5 의무를 활성 의무로 취급하여서는 아니 되며, 10퍼센트 초과 표지는 운영 스크리닝 힌트로만 사용하여야 한다.
- **REQ-A06-11 (보수적 기본값).** 시스템은 판정에 필요한 claim이나 person-group이 확정되지 아니하면 fail-closed로 차단하고, 경계 사안은 Operator 심사로 라우팅하여야 한다.

## 9. reasonCode

본 부품의 원 출처인 보경 법리검증기준서는 원문 확정·대조 표준으로서 전용 실패코드 절(§6.1)을 두지 아니한다. 아래 코드는 그 실질 — §1(확정 원문)·§2(연산자·기간 판정표)·§3(대조 체크리스트 C1–C14)·§4(우선 오류 패턴) — 에서 유도한 목표 규격이며, 인코딩은 다른 부품과 같이 `ReasonCodes.encode(recipeId, "A-06-v1", n)`을 따른다.

| n | Code | 발생 조건 | 판정 | 근거 |
|---|---|---|---|---|
| 1 | `NO_AFFILIATE_CLAIM` | 계열 여부 claim 부재 | 차단(fail-closed) | §1.10 |
| 2 | `UNTRUSTED_AFFILIATE_ISSUER` | claim 발급자 미신뢰(Trusted Issuer 아님) | 차단(fail-closed) | 패턴 B |
| 3 | `INVALID_AFFILIATE_SIGNATURE` | claim 서명 무효 | 차단(fail-closed) | 패턴 B |
| 4 | `AFFILIATE_CLAIM_EXPIRED` | claim 만료 | 차단(fail-closed) | 패턴 B |
| 5 | `PERSONGROUP_UNRESOLVED` | Rule 144(a)(2) person-group 미해소(A-04·A-09 결손) | 차단(fail-closed) | §1.5 |
| 6 | `AFFILIATE_CONTROL` | Rule 405 지배관계 확인 → 계열자 | 계열 → 캐스케이드(통과) | §1.1·§1.2·§1.6 |
| 7 | `AFFILIATE_TAIL` | 매도 시점 비계열이나 직전 3역월/90일 내 계열 이력 → tail 미경과 | 계열 → 캐스케이드(통과) | §1.3·§1.4·§4 패턴 1 |
| 8 | `REVIEW_AFFILIATE_BOUNDARY` | 정량 스크리닝 임계 도달·직함 추정 성립, bright-line 아님 | REVIEW(Operator) | §1.7–1.9·§1.10·§4 패턴 2·3 |

비계열 판정(¬지배 ∧ ¬look-back)은 `passed=true, reasonCode=0`이며 표에 두지 아니한다. 코드 6·7은 차단이 아니라 계열 상태의 확정으로서, `passed=true`와 함께 `affiliateStatus`를 참으로 세워 하류 캐스케이드가 조건을 적용하게 한다. 코드 8은 A-03의 `REVIEW_AI_UNCERTAIN`(코드 9)과 같이 사람의 심사가 완료될 때까지 보류하는 성격이다.

## 10. 불변식

1. 어떤 지분율도 Rule 144 축의 PASS/FAIL 규칙이 아니다. 수치는 스크리닝과 심사 입력으로만 등장한다.
2. 이사·임원 등 직함은 자동 계열 사유가 아니다. 운영 추정과 법적 판정은 분리된다.
3. 비계열 판정은 매도 시점과 소급의 두 원자를 모두 요구한다. 소급의 두 단위(역월 3개월·90일)를 하나로 통합하지 아니한다.
4. Rule 144(a)(2)의 10퍼센트는 합산 범위이지 지배 기준이 아니다.
5. 투자회사법(5퍼센트 이상·직함·25퍼센트 초과 추정)과 §16(10퍼센트 초과)의 기준은 Rule 144 판정식에 이식하지 아니한다.
6. 판정 불가 시 fail-closed로 차단하고, 경계 시 Operator 심사로 라우팅한다.

## 11. 의존성

```
A-04(신원 dedup) · A-09(법인 look-through) → identity graph → person-group 확정 → A-06
Trusted Issuer(Securitize TA) → 계열 attestation(패턴 B) → A-06
A-11(claim 현행성) → attestation 유효기간 → A-06
A-06(계열 판정 참) → E-05(144(c)) · C-08(144(e)) · C-09(144(f)·(g)) · E-06(144(h)) 캐스케이드
A-06(person-group·계열 상태) → C-08 · D-01 stateful 카운터의 상태 키
A-06(계열 링크) → A-12(모름항변 차단) · F-02 · F-03(감시) 신호
A-06 경계 → Operator 심사
```

## 12. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 지배관계 없음 + 소급 무계열 + 유효 claim | NON_AFFILIATE (비계열 안전항, passed·reason 0) |
| 2 | Rule 405 지배관계 확인 | AFFILIATE_CONTROL(6) — 캐스케이드(E-05·C-08·C-09·E-06) 활성 |
| 3 | 매도 시점 비계열이나 직전 3역월/90일 내 계열 이력 | AFFILIATE_TAIL(7) — tail 미경과, 비계열 경로 차단 |
| 4 | 경계일(역월 3개월과 90일 사이) 계열 이력 | AFFILIATE_TAIL(7) — 보수적 max 적용, 단일 90일 통합 금지 |
| 5 | 10퍼센트 주주(지분 임계 도달, 지배 불명) | REVIEW_AFFILIATE_BOUNDARY(8) — 자동 계열 아님 |
| 6 | 이사·임원 지위만 존재 | REVIEW_AFFILIATE_BOUNDARY(8) — 운영 추정, 법적 판정은 사실·정황 |
| 7 | 투자회사법 5퍼센트·25퍼센트 요소만 존재(Rule 144 지배 아님) | NON_AFFILIATE — 축 분리, 이식 금지 |
| 8 | claim 부재 | NO_AFFILIATE_CLAIM(1) — fail-closed |
| 9 | claim 발급자 미신뢰·서명 무효·만료 | 코드 2·3·4 — fail-closed |
| 10 | person-group 미해소(A-04·A-09 미완) | PERSONGROUP_UNRESOLVED(5) |
| 11 | §16 10퍼센트 초과(§12 미등록 토큰) | 판정 무영향 — dormant, 스크리닝 힌트로만 |
| 12 | 계열자의 비제한증권 보유분 | Rule 144 조건 대상(control securities) |

## 13. Demo 및 Production 범위

| 구분 | Demo | Production |
|---|---|---|
| 계열 판정 | mock 계열 claim | Securitize TA 서명 attestation 검증(패턴 B) |
| look-back | 단순 플래그 | 직전 3역월과 90일 이중 평가(또는 max) |
| person-group | 단순 personId | A-04·A-09 identity graph + (a)(2) 합산 |
| 경계 심사 | 개념 시연 | 정량 스크리닝 임계·Operator 대시보드 라우팅 |
| 캐스케이드 | 개념 연결 | E-05·C-08·C-09·E-06 활성 배선 |

§4(a)(7)이 주 경로이고 본 부품은 Rule 144 경로 및 감시에서 조건부로 작동하므로, 데모 단계에서는 mock 계열 claim과 단순 person-group으로 충분하다.

## 14. 잔여 확정 항목

1. 전용 컨트랙트·판정 로직 구현(현재 미구현).
2. A-06 본문의 원문 블록을 확정 원문(법리검증기준서 §1)과 축조 대조 — 파일 재동기화 후 §5 재개 절차.
3. 이사·임원 예시 명제의 특정 C&DI 번호 검증(법리검증기준서 §1.10 미검증 항목).
4. 경계 심사 스크리닝 임계 캘리브레이션(운영 정책).
5. person-group 키의 A-04·A-09 연동과 동시성.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1(확정 원문)·§4(오류 패턴) |
| 제3.7절 (축 대조·dormancy) | 파생 | 보경 walkthrough §1.7–1.9·§2 |
| 제5~8·10~13절 (목표 구현) | 목표 | 보경 walkthrough §2·§3(C1–C14) + `SPEC.md`(패턴 B/C·person-group) |
| 제9절 (reasonCode) | 목표(파생) | 보경 walkthrough §1·§2·§3·§4 — 원 walkthrough가 §6.1 실패코드 절을 두지 아니하여 실질에서 유도 |

전용 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `A-06_법리검증기준서_v1.md` (검토 2026-07-21 · 원문 확정 기준일 2026-07-06) — 레포 `docs/compliance/elements/` 교체 대상. 본 기준서는 A-06 본문이 아니라 그 대조 표준이며, 인용 원문은 ecfr.gov·uscode.house.gov·sec.gov 승인 소스에서 확정되었다.
- 공유 개념: `SPEC.md` 제1·2·6절 (검증 패턴 B/C · person-group · off-chain Layer 5)
- 결정: `ADR-004`(Element Pool Freeze v1) · `ADR-006`(부품 asset-agnostic) · `ADR-008-compliance-seam-decisions.md`(§2 D-B person-group 카운터)
- 1차 출처: 15 U.S.C. § 77b(a)(11) · 17 C.F.R. § 230.144(a)(1) · § 230.144(a)(2) · § 230.144(b)(1) · § 230.144(b)(2) · § 230.144(c) · § 230.144(e)(1) · § 230.144(h) · 17 C.F.R. § 230.405 · 15 U.S.C. § 80a-2(a)(3) · § 80a-2(a)(9) · 15 U.S.C. § 78p(a)(1) · 15 U.S.C. § 78l(g) · 17 C.F.R. § 240.12b-2 (병행 정의) · SEC, *Rule 144: Selling Restricted and Control Securities* (SEC 공식 간행물, Layer 2)

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 법리검증기준서 기반. 제1부: Rule 144 계열자 판정의 질적 지배 기준(Rule 405, bright-line 금지·2단 authority)·이중 look-back(144(b)(1) 직전 3역월 / (b)(2) 90일의 별개 단위)·(a)(2) person 합산의 매도 계산 범위 성격·control securities(취득 경로 불문)·축 교차 오염 금지(투자회사법 §2(a)(3)·(a)(9)·§16 dormancy)·§77b(a)(11) 캐스케이드. 제2부: 전용 컨트랙트 미구현 → 목표 규격(판정 격자 NON_AFFILIATE/AFFILIATE/REVIEW·패턴 B claim 검증 + 패턴 C 경계 flag·reasonCode 8종·E-05/C-08/C-09/E-06 캐스케이드 배선). 원 walkthrough가 파일 미동기화로 A-06 본문 축조 대조를 §5 재개 절차로 유보하고 C&DI 번호를 미검증 항목으로 남겨 review-required: legal. reasonCode는 원 walkthrough에 §6.1 실패코드 절이 없어 §1~§4 실질에서 유도.
