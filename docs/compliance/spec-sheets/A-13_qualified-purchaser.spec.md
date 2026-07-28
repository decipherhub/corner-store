---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-13
element-name: Qualified Purchaser (적격구매자)
status: v0.1 (2026-07-22) — 2부 구성. Part II는 실장 컨트랙트(QualifiedPurchaser.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-13_Qualified-Purchaser.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/QualifiedPurchaser.sol (ELEMENT_ID A-13-v1, 커밋 'upgrade A-13 qualified purchaser to walkthrough spec')"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Element/Recipe/Manifest·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-13, qualified-purchaser, ica-3c7, R3]
---

# A-13 Qualified Purchaser — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-13(적격구매자)의 요구사항 명세서이다. **제1부**는 본 부품이 강제하는 규율의 법적 근거와 그 도출 과정을, **제2부**는 이를 구현한 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `QualifiedPurchaser.sol`(A-13-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-13은 투자회사법(ICA) §3(c)(7) 펀드의 지분을 매수하려는 자가 적격구매자(Qualified Purchaser, QP)인지를 거래 직전에 확인하는 부품이다. §3(c)(7) 펀드는 투자회사 등록 의무를 면제받는 대신 그 지분을 취득 시점에 QP인 자만이 보유하여야 하므로, 비-QP가 유입되면 펀드 전체의 면제가 훼손될 위험에 놓인다. 본 부품은 그 면제 status를 매수인 측에서 지키는 핵심 검사원이다.

## 2. 적용 법령의 체계

미국 연방 증권규제는 단일 법률이 아니라 국면별로 나뉜 복수의 법률로 구성되며, 그중 집합투자기구(펀드) 자체의 규율을 맡는 것이 1940년 투자회사법이다. 투자회사법은 등록 펀드에 자산 분리보관·지배구조·차입 한도·이해관계자 거래 제한 등 엄격한 규율을 부과하되, 세련된 투자자만을 상대하는 펀드에는 §3(c)에 면제 통로를 둔다. 그중 §3(c)(7)은 1996년 전국증권시장개선법(NSMIA)으로 신설된 것으로서, 투자자 인원의 상한을 두지 아니하는 대신 그 지분을 보유하는 모든 자가 QP일 것을 요구한다(15 U.S.C. § 80a-3(c)(7)).

QP의 정의는 §2(a)(51)(A)와 그에 따른 SEC 규칙에 의한다(15 U.S.C. § 80a-2(a)(51)(A); 17 C.F.R. §§ 270.2a51-1 이하). 유의할 점은 이 QP 요건이 증권법상 적격투자자(AI) 요건과 다른 축이라는 것이다. AI는 1933년 증권법의 발행·재판매 면제(Rule 506(c)·§4(a)(7))에서 매수인의 순자산·소득을 기준으로 하는 반면, QP는 투자회사법의 펀드 등록 면제에서 매수인의 투자자산(investments)을 기준으로 한다. 두 자격은 근거 법·판단 기준·작동 국면이 모두 다르므로, 하나의 통과가 다른 하나의 통과를 의미하지 아니한다.

## 3. 쟁점별 논증

### 3.1 QP와 AI의 구별

A-13이 적격투자자 판정(A-03)과 어떠한 관계에 있는지가 문제된다. 적격투자자는 증권을 파는 행위(발행·재판매)에 대한 면제 요건으로서 매수인의 순자산 또는 소득을 기준으로 하고, 적격구매자는 펀드라는 회사의 등록 면제 요건으로서 매수인의 투자자산을 기준으로 한다. 나아가 증권법 축은 거래마다 적용되는 반면, 투자회사법 축은 거래 시점과 무관하게 펀드의 상시 status로 유지되어야 한다. 따라서 A-03의 통과를 A-13의 통과로 취급하는 것은 서로 다른 법체계와 기준을 혼동하는 것으로서 치명적 오작동이 된다. 두 부품은 분리된다.

### 3.2 "취득 시점에 QP인 자에 의한 배타적 보유"

A-13을 왜 보수적으로 설계하는지가 문제된다. §3(c)(7)의 면제는 펀드의 모든 지분이 취득 시점에 QP인 자에 의하여 배타적으로(exclusively) 소유될 것을 조건으로 한다. 이 조건은 개별 거래가 아니라 펀드 전체의 status에 관한 것이므로, 단 한 명의 비-QP가 유입되어도 펀드 전체의 면제가 훼손될 위험이 발생한다. 그 결과는 미등록 투자회사로의 전락, SEC의 집행, 계약의 집행가능성 상실, 상업적 unwind 등으로 이어질 수 있다. 그러므로 A-13은 의심스러운 경우 통과가 아니라 차단 또는 심사 회부를 기본으로 하며, 이 존립적(existential) 성격이 pre-trade 게이트로서의 엄격성을 정당화한다.

다만 그 강제력의 경로에 관하여는 최근 변경이 있었다. 종전에는 §47(b)가 위반 계약 당사자에게 rescission의 사적 소권을 부여한다는 견해(*Oxford Univ. Bank v. Lansuppe Feeder*, 2019)가 있었으나, 2026년 연방대법원은 *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*, 608 U.S. ___ (2026)에서 §47(b)가 사인에게 독립적 rescission 소송권을 부여하지 아니한다고 판시하였다. 따라서 비-QP 유입의 강제력은 사적 소권이 아니라 미등록 투자회사 운영·SEC 집행·계약 집행가능성·상업적 unwind·발행인 측 계약 책임에서 나온다.

### 3.3 QP가 되는 다섯 경로와 안 세는 예외

누가 QP인지가 문제된다. §2(a)(51)(A)는 네 가지 경로를 규정한다. 즉 (i) 투자자산 500만 달러 이상을 보유한 자연인, (ii) 가족회사, (iii) 일정 요건의 신탁, (iv) 재량으로 2,500만 달러 이상을 운용·보유하는 자이다. 여기에 SEC 규칙이 적격기관투자자(QIB)를 QP로 간주하는 경로(Rule 2a51-1(g)(1))를 더한다. 한편 Rule 3c-5는 펀드의 인지 있는 임직원(knowledgeable employee)을 QP 판정 인원에서 제외하며, Rule 3c-6은 증여·상속·이혼 등 비자발적 이전을 QP 간주로 처리한다. 본 부품은 매수인의 QP 근거(basis)를 이 경로들 중 하나로 분기하여 판정한다.

### 3.4 임계치는 온체인에서 계산하지 아니한다

금액 요건을 어디에서 판단하는지가 문제된다. 투자자산 500만 달러 또는 2,500만 달러의 산정은 Rule 2a51-1에 따라 주거용·사업용 자산의 제외, 공정가치 평가, 취득용 차입금의 차감 등 법적 판단을 요하며, 이는 온체인에서 계산할 수 없다. 따라서 금액의 충족 여부는 Trusted Issuer가 off-chain에서 사전에 판단하고, 온체인 부품은 그 결과만 확인한다. 그 결과 온체인에는 어떠한 금액도 나타나지 아니한다. 임계치는 포함 기준으로서 정확히 500만·2,500만 달러도 충족이다.

### 3.5 합리적 신뢰 안전항과 증명서 구조

온체인에서 QP를 확정할 수 없는데 어떻게 판정이 성립하는지가 문제된다. Rule 2a51-1(h)의 합리적 신뢰(reasonable belief) 안전항은, 검증에 근거하여 매수인을 QP라고 합리적으로 믿은 경우 사후에 실제로는 비-QP였음이 드러나더라도 면제가 곧바로 붕괴하지 아니하도록 한다. 이 안전항이 증명서(claim) 구조의 법적 토대이다. 즉 Trusted Issuer(예: Securitize)가 off-chain 실사에 근거하여 QP 여부를 판단하고 서명 claim을 발급하면, 본 부품은 그 claim의 존재·진위·발급자 신뢰·현행성·근거 경로만을 확인한다. QP 판정 자체(가족관계·신탁 형성 목적·투자자산 평가)는 법적 판단이므로 온체인이 수행하지 아니한다.

### 3.6 법인·신탁의 look-through

법인 또는 신탁이 매수인인 경우 어디까지 투시하는지가 문제된다. 가족회사와 신탁의 QP 판정은 그 실질 소유자의 자격을 확인하는 look-through를 요한다(Rule 2a51-3, 2a51-2). 이 재귀적 판정은 부품 A-09의 look-through 엔진을 통하여 수행되며, 그 완료 여부가 본 부품의 판정에 반영된다. look-through가 기록되지 아니하였거나(미개시) 진행 중인 경우와 실패한 경우를 구분하여 처리한다.

### 3.7 취득 시점 요건과 현행성

QP 자격을 언제를 기준으로 보는지가 문제된다. §3(c)(7)(A)는 QP 여부를 취득 시점(at the time of acquisition)을 기준으로 판단하도록 한다. 이를 구현상 claim의 현행성 상한(freshness cap)으로 옮긴다. 즉 claim의 검증 시점으로부터 일정 기간이 지나면 현행성을 상실한 것으로 본다. 이 상한은 부품 A-11과 조율되며, Decipher는 1년을 권고하되 보수적으로 5년 옵션을 둔다.

## 4. 확정 사항 및 잔여 쟁점

QP 판정의 경로·기준·증명서 구조는 위와 같이 확정되었다. 다만 다음 사항은 확인 또는 후속을 요한다. 첫째, §3(c)(7)의 두 번째 조건인 공모 부재(no public offering)에 관하여, 2차 거래의 상시 호가가 이를 훼손하는지는 미결이며 Recipe 차원의 쟁점이다(발행분은 JOBS Act § 201(b)(2)로 해소되나 2차는 별개). 둘째, 인원 관리에 관하여 §3(c)(7) 펀드도 1934년법 §12(g)의 등록 트리거 때문에 실무상 보유자 수를 관리하며, 이는 부품 D-01의 소관으로서 본 부품과 구별된다.

---

# 제2부. 구현 명세 (컨트랙트 `QualifiedPurchaser.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-13-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 증명서형(ATTESTATION_BASED) |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS (Element 한정) |
| 활성 | R3(ICA §3(c)(7) Fund)이 조건부로 호출 |
| 의존 부품 | A-09(look-through) · A-06(affiliate) · A-11(freshness) · A-08(법인 자격) |

`§3(c)(7)` status 자체는 holder composition·비자발적 이전 예외·§12(g) holder-count 등 상태 정보에 걸려 있으나, 이는 Recipe·Manifest·Operator layer가 관리하며 본 Element는 매수 시점 claim 스냅샷만 본다.

## 6. 인터페이스

`user`는 매수 예정자, `asset`은 펀드 토큰이며 그 주소가 KE 판정의 펀드 식별자로 쓰인다. `counterparty`·`amount`·`context`는 사용하지 아니한다.

```solidity
// 판정 (view)
function check(address user, address /*counterparty*/, address asset, uint256 /*amount*/, bytes /*context*/)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setQp(address user, bool isQp) external;          // legacy: true → 완전 유효한 NATURAL claim 기재
function setQpClaim(address user, QpClaim claim) external; // rich claim 기재
function setFreshnessCap(uint64 cap) external;             // 현행성 상한(정책값, 기본 365일)

// view
function qp(address user) external view returns (bool);    // claim 보유 여부(legacy getter 형태)
```

## 7. 상태 및 구성

`QpBasis` 열거형(경로): `NONE · NATURAL(2(a)(51)(A)(i)) · FAMILY_COMPANY(ii) · TRUST(iii) · INSTITUTIONAL(iv, $25M) · QIB(2a51-1(g)(1) 간주) · KNOWLEDGEABLE_EMPLOYEE(Rule 3c-5) · OTHER(경계 → 심사)`.

`QpClaim` 구조: `basis · signatureValid · issuerTrusted · verifiedAt(현행성 기준 시각) · ltStatus(LookThroughStatus, A-09) · coveredCompany(KE 전용, 펀드 키와 일치해야)`.

| 요소 | 유형 | 의미 |
|---|---|---|
| `claimOf[address]` | mapping→QpClaim | 매수인별 QP claim. 기본 basis NONE → 코드 1. |
| `freshnessCap` | uint64 (기본 365일) | 취득 시점 요건의 현행성 상한(정책값). A-11 조율. |

임계치($5M 자연인·가족, $25M 기관, 포함)는 Trusted Issuer가 off-chain에서 사전 판단하며 온체인에 금액이 나타나지 아니한다.

## 8. 기능 요구사항

- **REQ-A13-1 (파이프라인 순서).** 시스템은 존재·위조(1) → 발급자 신뢰(3) → 현행성(2) → 근거 경로 분기의 순서로 판정하여야 한다.
- **REQ-A13-2 (존재·위조).** claim이 없거나(basis NONE) 서명이 무효이면 차단한다(코드 1).
- **REQ-A13-3 (현행성).** 검증 시점으로부터의 경과가 `freshnessCap`을 초과하면 차단한다(코드 2, 엄격 `>`이므로 상한에 정확히 도달한 경우는 통과).
- **REQ-A13-4 (직접 경로).** 근거가 NATURAL·INSTITUTIONAL·QIB이면 통과한다. 그 임계·QIB 지위는 off-chain에서 사전 판단되므로 온체인 금액 검사를 하지 아니한다.
- **REQ-A13-5 (법인·신탁 look-through).** 근거가 FAMILY_COMPANY 또는 TRUST이면 look-through 상태를 확인한다. 미개시(NONE)는 코드 4, 진행 중(PENDING)은 보류(코드 5), 실패(FAILED)는 신탁이면 코드 6·가족회사이면 코드 7로 처리하고, 완료(COMPLETED)이면 통과한다.
- **REQ-A13-6 (KE).** 근거가 KNOWLEDGEABLE_EMPLOYEE이면 claim의 covered company가 자산(펀드) 키와 일치하여야 하며, 불일치 시 차단한다(코드 8).
- **REQ-A13-7 (경계).** 근거가 OTHER이면 자동 판정하지 아니하고 심사에 회부한다(코드 9).

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(recipeId, "A-13-v1", n)`으로 인코딩하며, `n`은 walkthrough §6.2와 일치한다.

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `FAIL_NOT_QP` | claim 없음 또는 서명 위조 |
| 2 | `FAIL_QP_CLAIM_EXPIRED` | 현행성 상한 초과(엄격 `>`) |
| 3 | `FAIL_UNTRUSTED_QP_CLAIM_ISSUER` | 발급자 미등록 |
| 4 | `FAIL_QP_LOOKTHROUGH_REQUIRED` | 가족회사·신탁, look-through 미개시 |
| 5 | `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED` | look-through 진행 중(보류) |
| 6 | `FAIL_TRUST_DISQUALIFIED` | 신탁 look-through 실패 |
| 7 | `FAIL_FAMILY_CO_NOT_QP` | 가족회사 look-through 실패 |
| 8 | `FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED` | KE covered company ≠ 펀드 키 |
| 9 | `REVIEW_QP_UNCERTAIN` | 근거 OTHER — 수동 심사 |

## 10. Mock·Legacy 경계 (현재 구현)

`setQp(user, true)`는 호환성을 위하여 완전히 유효한 자연인 claim(NATURAL·서명 유효·발급자 신뢰·검증 시점 현재·look-through 없음)을 기재하므로 그대로 통과한다. 리치 claim은 `setQpClaim`으로 기재한다. KE 판정의 펀드 식별자는 본 구현에서 자산 주소를 그대로 사용한다.

## 11. 불변식

1. 온체인에는 어떠한 금액도 나타나지 아니한다(임계치는 off-chain 사전판정).
2. 본 부품은 QP 판정 자체를 수행하지 아니하고 서명 claim을 확인한다(Rule 2a51-1(h)).
3. 현행성 경계는 엄격 `>`이므로 상한에 정확히 도달한 claim은 통과한다.
4. 가족회사·신탁의 실패 코드는 신탁(6)과 가족회사(7)로 구분되어 온체인에 보존된다.
5. 본 Element는 상태를 보유하지 아니한다.

## 12. 의존성

```
A-09(look-through) → 가족회사·신탁 실질소유자 재귀 판정 → A-13 (ltStatus)
A-06(affiliate)    → 계열자 맥락 → A-13(cascade)
A-11(freshness)    → 취득 시점 요건의 현행성 상한 조율 → A-13
A-08(법인 자격)    → 법인 매수인 자격 → A-13(cascade)
D-01(holder count) → §12(g) 인원 관리(Recipe 차원, 본 부품과 구별)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | claim 없음 | FAIL_NOT_QP |
| 2 | 서명 위조 | FAIL_NOT_QP |
| 3 | 발급자 미등록 | FAIL_UNTRUSTED_QP_CLAIM_ISSUER |
| 4 | 현행성 상한 초과 | FAIL_QP_CLAIM_EXPIRED |
| 5 | 자연인 $5M(NATURAL) 유효 | PASS |
| 6 | 기관 $25M(INSTITUTIONAL) 유효 | PASS |
| 7 | QIB 간주 | PASS |
| 8 | 가족회사, look-through 미개시 | FAIL_QP_LOOKTHROUGH_REQUIRED |
| 9 | 신탁, look-through 진행 중 | FAIL_QP_LOOKTHROUGH_NOT_COMPLETED (보류) |
| 10 | 신탁, look-through 실패 | FAIL_TRUST_DISQUALIFIED |
| 11 | 가족회사, look-through 실패 | FAIL_FAMILY_CO_NOT_QP |
| 12 | KE, covered company ≠ 펀드 키 | FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED |
| 13 | 근거 OTHER | REVIEW_QP_UNCERTAIN |
| 14 | A-03(AI) 통과이나 QP claim 없음 | FAIL_NOT_QP (AI와 독립) |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| claim 발급 | 운영자 `setQp`/`setQpClaim` 기재 | Securitize 등 Trusted Issuer QP claim 파이프라인 |
| 임계 산정 | off-chain 사전판정(mock) | Rule 2a51-1 investments 실사 |
| look-through | ltStatus 수동 기재 | A-09 재귀 엔진 연동 |
| 펀드 키(KE) | 자산 주소 | 펀드 식별자 체계 |
| 현행성 | 기본 365일 | 취득 시점 정책(A-11)과 확정 |

## 15. 잔여 확정 항목

1. §3(c)(7) 공모 부재(Condition 2) — 2차 거래 상시 호가의 영향(Recipe 차원, No-Action Letter 후보).
2. §12(g) 인원 관리와의 역할 분담(D-01).
3. 현행성 상한 값(1년 권고 vs 5년)과 A-11 조율.
4. KE 펀드 식별자 체계(현재 자산 주소 사용).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~9·11~13절 (구현) | 실장 | `QualifiedPurchaser.sol` (A-13-v1) |
| 제10절 (mock 경계) | 실장 | `QualifiedPurchaser.sol` 주석 |
| 제14절 (Demo/Production) | 파생·실장 | walkthrough §3.0.1 + 컨트랙트 기본값 |

법적 실질을 본 문서에서 임의로 수정하지 아니한다. 보경 walkthrough가 개정되면 파생 절을, 컨트랙트가 변경되면 제2부를 재생성한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-13_Qualified-Purchaser.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/QualifiedPurchaser.sol`
- 결정: `ADR-004`(Element Pool Freeze) · `ADR-006`(asset-agnostic)
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 80a-2(a)(51)(A) · § 80a-3(c)(7) · 17 C.F.R. §§ 270.2a51-1(2a51-1(g)·(h))·270.2a51-2·270.2a51-3·270.3c-5·270.3c-6 · JOBS Act § 201(b)(2) · *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*, 608 U.S. ___ (2026)

## C. 변경 로그

- [2026-07-22] v0.1 — 2부 구성. 제1부는 보경 walkthrough(§1·§3) 기반 법률 메모 체 산문(논증 7 — QP/AI 구별·exclusively QP·5경로+KE·off-chain 임계·reasonable belief·look-through·취득시점 현행성), 제2부는 실장 컨트랙트 `QualifiedPurchaser.sol` 기준(QpBasis 8종·QpClaim·파이프라인·REQ-A13-1~7·9 reason code·mock 경계). §47(b) 사적소권을 부정한 2026 FS Credit v. Saba 반영. A-13은 보경 기반 실구현 부품이라 제2부는 현행 계약.
