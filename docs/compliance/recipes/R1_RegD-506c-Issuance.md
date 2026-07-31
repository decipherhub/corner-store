---
type: recipe-requirement-spec
recipe-id: R1
recipe-name: Reg D 506(c) Issuance
project: RWA DEX (Giwa) · corner-store
status: v2.0 (2026-07-28) — 2부 구성(제1부 법률논증 산문 + 제2부 구현명세). element spec 형식에 정합. Part II는 실장 컨트랙트(RegD506cRecipe.sol) 기준.
substance-sot: "승준 recipe walkthrough — R1_RegD-506c-Issuance.md v1.2 (2026-06-17, 조문별 삼단논법). 보경 recipe 검토본 없음 — 법률 검토 필요."
implements: "src/compliance/recipes/RegD506cRecipe.sol (recipeId 1, version 2, 9-element 참조 배선). 컨트랙트 주석: 'illustrative reference wiring, NOT approved production policy'."
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Element/Recipe/Manifest·Router cumulative AND·경계)은 여기에 의한다"
legal-effect: "Securities Act §5 등록 면제 성립 (Reg D Rule 506(c) 사모)"
review-required: legal
tags: [recipe-requirement-spec, R1, reg-d, 506c, issuance, R1]
---

# R1 Reg D 506(c) Issuance — 요구사항 명세서 (Recipe)

> **저술 지위 고지.** 본 Recipe의 법적 논증은 승준이 작성한 recipe walkthrough(2026-06-17, 조문별 삼단논법)를 산문 2부 형식으로 재구성한 것이며, 대응하는 보경 recipe 검토본은 존재하지 아니한다. 따라서 제1부는 element spec의 보경 파생분과 달리 **법률 검토 전 상태**이다(제4절). 또한 제2부의 기준 컨트랙트 `RegD506cRecipe.sol`은 스스로 "illustrative reference wiring, NOT approved production policy"로 선언한 참조 배선이므로, 그 요소 집합은 확정 정책이 아니다(제10절 seam).

본 문서는 컴플라이언스 **Recipe** R1(Reg D 506(c) 발행)의 요구사항 명세서이다. Element가 개별 요건을 판정한다면, Recipe는 그 요건들의 판정 결과를 결합하여 **하나의 법률효과가 성립함을 논증**한다. **제1부**는 R1이 성립시키는 법률효과 — "이 발행이 Rule 506(c)로 §5 등록을 면제받는다" — 의 법적 근거와 조문별 도출을, **제2부**는 이를 구현한 컨트랙트 `RegD506cRecipe.sol` 기준의 활성화·구성·거절 명세를 규정한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

R1은 특정 발행이 Regulation D Rule 506(c)의 사모 면제 요건을 전부 충족하여, 증권법 제5조의 등록 의무를 면제받는다는 법률효과를 논증하는 Recipe이다. 그 논증은 단일 요건이 아니라 506(c)가 요구하는 조문 하나하나에 대해 이루어지며, 각 요건을 충족하는 것은 개별 Element이다. 모든 요건의 소결론이 참이면 종합결론으로서 면제가 성립한다. 요건이 하나라도 불충족이면 그 면제는 성립하지 아니하고, 발행은 기본값인 제5조 위반으로 회귀한다.

## 2. 규범적 근거

증권법 제5조는 등록신고서 없는 증권의 청약·매도를 원칙적으로 금지한다(15 U.S.C. § 77e). 이 금지에서 벗어나는 길의 하나가 제4조(a)(2)의 사모(private placement) 면제로, 발행인이 수행하는 공모(public offering)에 해당하지 아니하는 거래를 면제한다(15 U.S.C. § 77d(a)(2)). Rule 506(c)는 이 제4조(a)(2)의 안전항(safe harbor)이다. Rule 506(a)는 "506(b) 또는 (c)의 조건을 충족하는 발행인의 청약·매도는 제4조(a)(2)상의 공모에 해당하지 아니하는 거래로 간주한다"고 규정하므로(17 C.F.R. § 230.506(a)), R1의 과제는 506(c)가 요구하는 조건이 전부 충족됨을 보이는 것이다. 그 조건이 충족되면 제4조(a)(2)의 사모로 간주되고, 따라서 제5조 등록이 면제된다.

## 3. 쟁점별 논증

### 3.1 506(c)(1) — Rule 501·502(a)·(d) 충족

Rule 506(c)(1)은 면제 자격을 위하여 매도가 Rule 501(정의)과 Rule 502(a)(통합)·502(d)(이전제한)의 모든 조건을 충족할 것을 요구한다(17 C.F.R. § 230.506(c)(1)). 여기서 유의할 것은 502(c)(general solicitation 금지)가 포함되지 아니한다는 점이다 — 광고를 허용하는 것이 506(c)의 핵심이며, 502(c)는 506(b) 전용이다. Rule 501의 적격투자자 정의는 Element A-03이 매수인의 적격 claim을 확인함으로써 충족되고, Rule 502(d)의 이전제한은 Element B-03(제한 표식)과 A-12(인수인화 방지를 위한 합리적 주의)가 충족한다. 다만 Rule 502(a)의 통합(integration) — 이 발행이 다른 발행과 부당하게 합산되는지 — 은 거래 단위 사실이 아니라 발행 구조 차원의 사실이어서, 이를 판정하는 Element가 존재하지 아니한다. 따라서 506(c)(1)은 501·502(d)에 관하여는 충족되나, 502(a) 통합에 관하여는 부품 미커버 상태로 남는다(제4절).

### 3.2 506(c)(2)(i) — 매수인 전원 적격투자자

Rule 506(c)(2)(i)은 그 발행의 모든 매수인이 적격투자자일 것을 요구한다(17 C.F.R. § 230.506(c)(2)(i)). Element A-03은 매수인의 적격투자자 claim(존재·서명·발급자·만료·근거)을 확인하여 통과 여부를 판정하며, 매수인이 법인인 경우 Element A-08(자격 분류)과 필요 시 A-09(구성원 look-through)가 그 법인이 전원 적격 구조임을 확립한다. 적격성의 실체 판단은 신뢰 발급자(Trusted Issuer)가 off-chain에서 수행하여 claim에 부호화하므로, Recipe는 그 결과를 결합할 뿐이다. 그러므로 A-03이(법인이면 A-08·A-09와 함께) 통과하면 "모든 매수인이 적격투자자"라는 요건이 충족된다.

### 3.3 506(c)(2)(ii) — 합리적 검증

Rule 506(c)(2)(ii)은 발행인이 매수인의 적격 지위를 검증하기 위한 합리적 조치(reasonable steps to verify)를 취할 것을 요구한다(17 C.F.R. § 230.506(c)(2)(ii)). 이는 단순한 자기신고 체크박스로는 충족되지 아니하며, 조문이 예시하는 소득·순자산·제3자 확인 등의 방법은 의무가 아니라 비배타적 안전항 예시로서 다른 합리적 방법도 허용된다(SEC Release No. 33-9415). Element A-03은 claim의 검증 근거(verificationBasis — 예컨대 고액 최소투자금 방식, C&DI 256.36)가 신뢰 발급자 정책상 인정되는지 확인하고, Element A-12는 그 검증에 모순되는 위험신호(red flag)를 포착하여 고의적 외면(willful blindness)을 차단함으로써 합리적 주의를 증거화한다. 검증의 합리성 판단 자체는 발급 단계에서 결정된다. 그러므로 A-03의 검증 근거가 인정되고 A-12의 위험신호가 없으면 합리적 검증 요건이 충족된다.

### 3.4 506(d)·(e) — 부적격자 부재 및 시행 전 사유 공시

Rule 506(d)는 발행인·임원·20% 이상 의결지분 보유자·발기인·주선 대가 수령자 등 covered person에게 자격상실 사유(중죄 유죄판결·SEC 제재명령 등, 사유별 5년 또는 10년 look-back)가 있으면 면제 자체가 박탈된다고 규정한다(17 C.F.R. § 230.506(d)). Rule 506(e)는 그 사유가 2013년 9월 23일 이전에 발생한 경우 자격상실은 아니나 매수인에게 서면으로 공시할 것을 요구한다(17 C.F.R. § 230.506(e)). Element E-03(부적격자 배제)이 covered person 중 결격자의 부재와 시행 전 사유의 공시 완료를 배경조사 결과 claim으로 확인함으로써, 이 두 요건이 충족된다.

### 3.5 Rule 503 — Form D 제출 (위생요건)

Rule 503(a)는 Reg D 발행인이 최초 매도 후 15일 이내에 Form D 매도 통지를 제출할 것을 요구한다(17 C.F.R. § 230.503(a)). 다만 이는 면제의 직접 조건이 아니어서, 미제출이 곧바로 면제 상실을 초래하지는 아니한다. Element E-01이 EDGAR상 Form D 제출 사실을 오라클 claim으로 확인한다. 미제출 시의 처리(R1 실패로 볼 것인지 경고로 볼 것인지)는 정책 사항으로 남긴다(제4절).

### 3.6 종합결론과 횡단 전제

위 요건들의 소결론이 모두 참이면, Rule 506(c)의 전 조건이 충족되어 Rule 506(a)에 따라 제4조(a)(2)의 공모 아닌 거래로 간주되고, 따라서 제5조 등록이 면제된다. 다만 이 발행이 적법하기 위하여는 506(c) 자체 요건 외에 횡단 전제도 충족되어야 한다 — 제재 대상 아님(A-01), 허용 관할(A-02), 판매 중 발행자 매수 금지(F-04)는 상시 전제층 R-XJ가 공급하고, claim의 유효성·신원 무결성·신상카드 무결성·토큰 규격(A-11·A-04·B-01·B-02)은 판정의 기술적 전제이다.

## 4. 확정 사항 및 잔여 쟁점

506(c) 면제의 조문별 논증 구조는 위와 같이 확정되었다. 다만 잔여 쟁점이 있다. 첫째, Rule 502(a)의 통합은 거래 단위가 아니라 발행 구조 차원의 사실이어서 이를 판정하는 Element가 없다 — 발행자 attestation을 확인하는 신규 Element(가칭 E-02)의 신설이 필요하며, 이는 Element Pool Freeze(ADR-004) 변경을 요하는 제안 상태이다. 둘째, 502(d)의 인수인 비해당은 사람의 판단이 필요한 사항이어서 Element로 완결되지 아니하고 B-03·A-12·R2(재판매 통제)로 off-chain 위임된다. 셋째, Form D 미제출의 처리 정책은 미확정이다. 넷째, R1은 §3(c)(7) 펀드 발행에서 R3와 누적(cumulative)으로 작동하므로, 공유 Element의 1회 평가·결과 공유를 위한 엔진 협응이 필요하다. 다섯째, 본 Recipe의 법적 논증은 보경 검토 전이므로 확정에 앞서 법률 검토를 요한다.

---

# 제2부. 구현 명세 (컨트랙트 `RegD506cRecipe.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| recipeId · version | `1` · `2` |
| 컨트랙트 | `RegD506cRecipe.sol` (BaseRecipe 상속, IRecipe 구현) |
| 활성화 | `isApplicable` 미오버라이드 → 상시 참(always applicable) |
| 구성 요소 | `requiredElements()` = 9종 (아래 §7) |
| 법률효과 | §5 등록 면제(Reg D 506(c)) |
| 결합 방식 | Router의 cumulative AND — 요소 중 하나라도 실패면 거래 revert |
| 지위 | 참조 배선(illustrative), 확정 production 정책 아님(§10) |

## 6. 활성화 (Activation)

`RegD506cRecipe.sol`은 `BaseRecipe`의 기본 `isApplicable`(상시 참)을 오버라이드하지 아니한다. 즉 컨트랙트 수준에서 R1은 조건 없이 활성이다. 개념상으로는 `Manifest.issuanceFramework = RegD506c`인 자산에만 적용되어야 하나, 그 게이팅은 현재 컨트랙트가 아니라 상위 배선(Router가 어느 자산에 이 Recipe를 붙이는지)에 위임되어 있다. 이 always-on 설계와 Manifest 기반 조건 활성의 정합은 production seam이다(§10).

## 7. 구성 (Composition) — 요소 AND 집합

`requiredElements()`는 다음 9종을 반환하며, Router는 이들을 cumulative AND로 평가한다.

| 순번 | Element ID | 부품 | 이 Recipe에서의 역할 |
|---|---|---|---|
| 1 | `A-01-v1` | 제재 명단 | 횡단 전제(§3.6) |
| 2 | `A-02-v1` | 국가 제한 | 횡단 전제 |
| 3 | `A-03-v1` | 적격투자자 | ㉡ 전원 적격 + ㉢ 검증 근거 |
| 4 | `A-04-v1` | 신원 중복 | 기술적 전제(dedup) |
| 5 | `A-05-v1` | 미국세법상 거주자 배제 | 발행 범위 scoping |
| 6 | `B-01-v1` | 신상카드 정합 | 기술적 전제(최선행) |
| 7 | `B-02-v1` | 토큰 표준 | 기술적 전제(ERC-3643) |
| 8 | `C-01-v1` | 보유기간(Rule 144) | (주의: 재판매 개념 — §10 seam) |
| 9 | `E-01-v1` | Form D 제출 | ㉨ 위생요건 |

- **REQ-R1-1 (구성 강제).** 시스템은 `requiredElements()`의 9종 전부가 통과할 때에만 R1을 통과시켜야 하며, 하나라도 실패하면 거래를 차단하여야 한다(cumulative AND).
- **REQ-R1-2 (신상카드 최선행).** B-01은 다른 요소의 입력(사실)을 공급하므로 union 내 최선행으로 평가되어야 한다.
- **REQ-R1-3 (활성화).** 컨트랙트 활성화는 상시 참이며, 자산 한정은 상위 배선이 담당한다(§6).

## 8. 거절 (reasonCode)

R1 실패는 `RECIPE_R1_REGD_ISSUANCE_FAIL`로 표면화하되, 실제 차단은 실패한 Element의 reasonCode로 전파된다 — 예컨대 A-03이 `FAIL_NOT_ACCREDITED`를 내면 "506(c)(2)(i) 전원 적격 불충족 → 면제 불성립"으로 읽힌다. 어느 조문 요건이 왜 불충족인지가 그 Element 코드에 담긴다.

## 9. Conflict·Interaction

| 상대 | 패턴 | 설명 |
|---|---|---|
| R3(§3(c)(7)) | Cumulative | BUIDL형 자산은 506(c) 발행 + §3(c)(7) 펀드가 동시 성립 — 발행에 적격투자자(A-03)와 적격구매자(A-13)가 모두 요구됨 |
| R2(재판매) | Orthogonal | R1은 1차 발행, R2는 restricted 증권의 2차 재판매 — 발행 후 별도 경로 |
| R-XJ | Cumulative(always-on) | A-01·A-02·F-04 공유 |
| Reg A 발행 | Conflict | 발행 framework은 단일 — 양립 불가 |

## 10. Mock·Production Seam (현재 구현) ⭐

본 컨트랙트의 요소 집합과 제1부의 법적 논증이 요구하는 이상적 집합 사이에 실질적 차이가 있으며, 이는 컨트랙트가 스스로 "illustrative reference wiring, NOT approved production policy"로 선언한 지점이다.

| 506(c) 논증이 요구(제1부) | 컨트랙트 9종에 포함? | seam |
|---|---|---|
| A-03(적격) | ✅ 포함 | — |
| A-03.verificationBasis + **A-12**(합리적 검증·주의) | A-12 **미포함** | ㉢ 합리적 검증의 red-flag 축이 배선에서 빠짐 |
| **E-03**(506(d)/(e) 부적격자·공시) | **미포함** | ㉣㉤ 부적격자 축이 배선에서 빠짐 — 법적으로 면제를 깨는 사유인데 게이트 없음 |
| **B-03**(502(d) 제한 표식) | **미포함** | ㉠ 이전제한 축이 B-02로 갈음되어 있음 |
| E-01(Form D) | ✅ 포함 | — |
| 통합 502(a) | 없음(E-02 미신설) | 제4절 gap |

역으로 컨트랙트에는 논증상 R1 코어가 아닌 요소가 포함되어 있다 — A-05(발행 범위 scoping)와 특히 **C-01(Rule 144 보유기간)**은 재판매(R2) 개념이어서 1차 발행 Recipe에 드는 것이 부자연스럽다. 요컨대 컨트랙트의 9종은 note-14 전략보고서의 참조 세트를 배선한 것이지, 506(c) 면제를 법적으로 완결하는 최소·정확 집합이 아니다. production 확정 시 A-12·E-03·B-03의 편입과 C-01의 제외(또는 R2로 이관), 통합(E-02) 신설을 검토하여야 한다.

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 9종 전부 통과 | R1 PASS(면제 성립) |
| 2 | A-03 실패(비적격 매수인) | RECIPE_R1_...FAIL (506(c)(2)(i)) |
| 3 | E-01 실패(Form D 미확인) | RECIPE_R1_...FAIL (503) |
| 4 | B-01 실패(카드 오염) | 최선행 차단 |
| 5 | 횡단 A-01/A-02 실패 | R-XJ 축 차단 |

## 12. 잔여 확정 항목

1. 요소 집합의 production 확정 — A-12·E-03·B-03 편입, C-01 제외/이관, 통합 E-02 신설(§10).
2. 활성화의 Manifest 조건화(현재 always-on) — §6.
3. R1∧R3 cumulative 엔진 협응(공유 요소 1회 평가).
4. Form D 미제출 처리 정책.
5. 본 Recipe 법적 논증의 보경 검토(review-required: legal).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생(승준 walkthrough 재구성, 보경 미검토) | 승준 recipe walkthrough R1 v1.2 (2026-06-17) §4 조문별 삼단논법 |
| 제5~9·11절 (구현) | 실장 | `RegD506cRecipe.sol` (recipeId 1, v2) |
| 제10절 (seam) | 실장·분석 | `RegD506cRecipe.sol` 주석 + 제1부 논증 대조 |

## B. 근거 문헌

- 원 출처(substance): 승준 recipe walkthrough `R1_RegD-506c-Issuance.md` v1.2 (2026-06-17). 보경 recipe 검토본 없음.
- 구현: `src/compliance/recipes/RegD506cRecipe.sol` · `BaseRecipe.sol` (IRecipe)
- 결정: `ADR-004`(Element Pool Freeze) · `ADR-006`(asset-agnostic)
- 공유 개념: `SPEC.md`
- 1차 출처: 17 C.F.R. § 230.506(a)·(c)·(d)·(e) · § 230.501 · § 230.502(a)·(d) · § 230.503 · 15 U.S.C. § 77e · § 77d(a)(2) · SEC Release No. 33-9415

## C. 변경 로그

- [2026-07-28] v2.0 — element spec과 동일한 2부 형식(제1부 법률논증 산문 + 제2부 구현명세)으로 재작성. 기존 v1.2(2026-06-17, 조문별 삼단논법 단일부 형식)를 대체. 제1부는 506(c)(1)·(2)(i)·(2)(ii)·506(d)·(e)·503 조문별 논증을 산문화. 제2부는 실장 `RegD506cRecipe.sol`(recipeId 1·v2·9요소·always-on) 기준. ⭐ 컨트랙트 9요소 세트(A-01·02·03·04·05·B-01·02·C-01·E-01)가 논증상 이상 세트와 다름(A-12·E-03·B-03 누락, C-01 과잉)을 §10 seam으로 명시 — 컨트랙트 자기선언 "illustrative, NOT approved production policy" 반영. 보경 recipe 검토 없어 review-required: legal.
- [2026-06-17] v1.2 — (구) 조문별 삼단논법 walkthrough. §4를 ㉠~㉨ 조문별 [원문→대전제→소전제(부품)→소결론]으로 전개.
