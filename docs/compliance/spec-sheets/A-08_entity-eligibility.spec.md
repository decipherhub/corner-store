---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-08
element-name: Entity Eligibility (법인 자격 산정 · 매수인 측)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(EntityEligibility.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-08_법인_자격_산정(발행측).md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/EntityEligibility.sol (ELEMENT_ID A-08-v1) · interfaces/compliance/ILookThroughSource.sol"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Trusted Issuer·claim·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-08, entity-eligibility, ai, qp, look-through, R1, R3]
---

# A-08 Entity Eligibility — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-08(법인 자격 산정, 매수인 측)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `EntityEligibility.sol`(A-08-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품이 보는 것은 언제나 매수인 측 법인이며, 발행인 관계인 판정은 부품 A-06의 소관으로서 본 부품과 구별된다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-08은 매수인이 법인인 경우, 그 법인이 해당 거래에서 요구되는 자격(발행 국면의 적격투자자, 펀드 국면의 적격구매자)의 법인 단위 요건을 충족하는지를 판정하고, 충족 경로가 구성원 look-through를 요구하면 부품 A-09로 위임하는 분기·라우팅 부품이다. 자연인 자격은 A-03·A-13이 직접 판정하며, 본 부품은 매수인이 법인일 때만 작동한다.

## 2. 규범적 근거

법인 매수인의 자격은 두 축에서 나온다. 발행 축은 Rule 501(a)의 법인 적격투자자 범주로서 자산·투자 임계값과 취득 목적 설립 아님을 요건으로 한다(17 C.F.R. § 230.501(a)). 펀드 축은 투자회사법 §2(a)(51)(A)의 법인 적격구매자 정의(가족회사, 신탁, 2,500만 달러 재량운용)와 그에 따른 규칙(17 C.F.R. § 270.2a51-1·2a51-2·2a51-3)으로서, 적격기관투자자를 적격구매자로 간주하는 경로(Rule 2a51-1(g)(1))를 포함한다. 두 축 모두 법인 단위의 사실은 off-chain에서 검증되어 claim으로 유입되며, 그 법적 토대는 합리적 신뢰 안전항(Rule 2a51-1(h))과 발행인의 검증 의무(Rule 506(c)(2)(ii))이다.

## 3. 쟁점별 논증

### 3.1 법인은 두 겹으로 본다

법인 자격을 어떻게 판정하는지가 문제된다. 자연인이 단일 인격을 보는 것과 달리 법인은 두 겹을 본다. 첫째, 법인 자체가 직접 자격을 갖는가(등록 기관, 자산 임계값 충족, 재량 운용)이고, 둘째, 구성원을 통해서만 자격을 얻는가(전원 적격투자자 보유, 가족회사, 전원 적격구매자)이다. 본 부품은 첫 겹(범주 분류·임계값·취득 목적 설립 판정)을 판정하고, 둘째 겹(구성원 추적)이 필요하면 A-09에 위임한다.

### 3.2 우회 방지 — 급조 회사 배제와 look-through

법인이 자격 우회의 통로가 되는 것을 어떻게 막는지가 문제된다. 무자격자가 회사·신탁 껍데기 뒤에 숨거나 이 거래만을 위해 회사를 급조하여 자산 요건을 형식적으로 맞출 수 있다. 미국법은 이를 두 겹으로 막는다. 하나는 급조 회사 배제로서 취득 목적으로 설립된 회사는 원칙적으로 직접 자격을 인정하지 아니한다. 다른 하나는 look-through로서 지분을 자연인까지 추적하여 구성원의 자격을 확인한다(Rule 2a51-3). 본 부품 설계 부담의 대부분이 이 우회 방지 논리에서 나온다.

### 3.3 하나의 부품이 두 축을 다루는 이유

발행 축과 펀드 축이 왜 한 부품인지가 문제된다. 적격투자자와 적격구매자는 기준이 다르나 법인일 때의 판정 절차는 구조가 같다. 범주로 분류하고, 임계값을 비교하며, 급조 여부를 보고, 필요하면 구성원을 추적한다. 따라서 본 부품은 이 공통 절차를 하나의 기계로 구현하고, 어느 축을 적용할지는 활성화된 경로에 따라 분기한다. 두 축이 동시에 요구되는 발행에서는 두 자격을 모두 충족하여야 한다(AND).

### 3.4 임계값의 부등호

임계값의 경계가 문제된다. 적격투자자 직접 자산 경로의 500만 달러는 초과 기준으로서 정확히 500만 달러는 미충족이고, 적격구매자 가족회사의 500만 달러와 기관의 2,500만 달러는 이상 기준으로서 정확히 그 값도 충족이다. 세 경로에 하나의 부등호를 쓰면 적격투자자 경계를 센트 단위로 오판한다.

### 3.5 활성화와 존립 위험

본 부품이 언제 켜지는지가 문제된다. 매수인이 법인일 때만 작동하며, 어느 축이 요구되는지는 자산·거래 맥락에 따른 결정으로서 과거의 발행 방식이 자동으로 축을 소환하지 아니한다. §3(c)(7) 펀드는 법인 매수인 하나가 잘못 통과하면 펀드 전체의 면제가 무너질 수 있으므로, 형식적 자산 충족만으로는 부족하고 취득 목적 설립 판정과 구성원 look-through가 핵심 안전장치가 된다.

## 4. 확정 사항 및 잔여 쟁점

법인 두 겹 판정과 우회 방지 구조는 위와 같이 확정되었다. 잔여로는 적격기관투자자 간주 경로의 세부 요건, 전환·펀드 매수인의 beneficial owner 산정(Rule 2a51-2), 그리고 급조 회사의 look-through 치유 범위가 있다.

---

# 제2부. 구현 명세 (컨트랙트 `EntityEligibility.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-08-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 증명서형(ATTESTATION_BASED) |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS |
| 활성 | R1(적격투자자)·R3(적격구매자) 중 자산별 요구 축. 자연인 매수인은 휴면. |
| 의존 | A-09(`ILookThroughSource` 주입) · A-03·A-13(범주 기준) · A-06(발행인 affiliate, 별개 축) |

## 6. 인터페이스

```solidity
constructor(ILookThroughSource lookThroughSource_);   // A-09 seam(0이면 revert)

// 판정 (view). user = 매수인 법인, asset = 요구 축 선택
function check(address user, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);
// AND 게이트 실패의 축별 코드를 감사 로그로 남기는 비-view 동반 함수
function diagnose(address user, address asset) external returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setEntityClaim(address user, EntityClaim claim) external;
function setRequiredTracks(address asset, uint8 tracks) external;   // bit0=AI(R1), bit1=QP(R3)
```

`AiBasis`: `NONE · DIRECT_ASSETS((a)(3)/(7)/(9)/(12)) · ALL_OWNERS_AI((a)(8))`. `QpBasis`: `NONE · FAMILY_COMPANY((ii)) · INSTITUTIONAL((iv) $25M) · QIB(2a51-1(g)(1)) · TRUST((iii))`. `EntityClaim`: `isEntity · aiBasis · qpBasis · investmentsUsd · formedForPurpose · qibConfirmed · directReqsMet`.

## 7. 임계값과 부등호

| 상수 | 값 | 부등호 |
|---|---|---|
| `AI_DIRECT_MIN_USD` | 5,000,000 | `>` (초과, 정확히 5M 미충족) |
| `QP_FAMILY_MIN_USD` | 5,000,000 | `>=` (이상, 정확히 5M 충족) |
| `QP_INSTITUTIONAL_MIN_USD` | 25,000,000 | `>=` (이상) |

## 8. 기능 요구사항

- **REQ-A08-1 (휴면).** 자산의 요구 축이 없거나 매수인이 법인이 아니면 통과(휴면)한다.
- **REQ-A08-2 (AND 게이트).** 두 축이 모두 요구되면 둘 다 통과하여야 하며, 하나라도 실패하면 코드 8로 차단한다. 단일 축이면 그 축의 코드를 반환한다. 축별 상세 코드는 `diagnose`가 이벤트로 남긴다.
- **REQ-A08-3 (AI 축).** 범주(1) → 직접 자산 경로의 급조 회사 배제(4, 치유는 (a)(8) 재분류) → 초과 임계값(2) → (a)(8) 구성원 look-through(NONE/PENDING 5, FAILED 6) → 범주별 직접 요건(7)의 순서로 판정한다.
- **REQ-A08-4 (QP 축).** 범주(1) → 신탁(급조 시 치유 없음 4, 그 밖 look-through 5/6) / 가족회사·기관(이상 임계값 2, 급조 시 2a51-3 look-through로 치유 5/6) / 적격기관투자자(확인 안 되면 3) → 범주별 직접 요건(7)의 순서로 판정한다.
- **REQ-A08-5 (look-through 위임).** 구성원 추적은 주입된 A-09(`ILookThroughSource.statusOf`)의 결과에 의한다. NONE/PENDING은 거절이 아니라 대기(코드 5), FAILED는 거절(코드 6)이다.

## 9. reasonCode

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `ENTITY_CATEGORY_MISMATCH` | 주장 범주가 활성 축에 없음 |
| 2 | `ENTITY_THRESHOLD_NOT_MET` | 임계값 미달(부등호 적용) |
| 3 | `ENTITY_QIB_UNCONFIRMED` | 적격기관투자자 미확인 |
| 4 | `ENTITY_FORMED_FOR_PURPOSE` | 급조 회사(직접 경로 배제·신탁 치유 없음) |
| 5 | `ENTITY_LOOKTHROUGH_REQUIRED` | A-09 NONE/PENDING(대기) |
| 6 | `ENTITY_LOOKTHROUGH_FAILED` | A-09가 비적격 구성원 발견 |
| 7 | `ENTITY_DIRECT_REQ_MISSING` | 범주별 추가 요건 미충족 |
| 8 | `ENTITY_AND_GATE_FAIL` | 두 축 활성 + 하나 이상 실패 |

## 10. 불변식

1. 자연인 매수인은 휴면이다(A-03·A-13이 판정).
2. 급조 회사는 직접 자산 경로로 통과할 수 없다. 적격투자자는 (a)(8) 재분류로, 적격구매자 가족회사·기관은 2a51-3 look-through로 치유되나, 신탁은 치유가 없다.
3. AI 직접 임계값은 초과(`>`), QP 임계값은 이상(`>=`)이다.
4. 구성원 추적은 A-09에 위임한다(본 부품은 라우팅).
5. 본 부품은 상태를 보유하지 아니한다.

## 11. 의존성

```
A-09(ILookThroughSource.statusOf) → 구성원 재귀 자격 → A-08
A-03·A-13 → 범주 정의(본 부품은 법인 판정 기계)
A-06 → 발행인 affiliate(별개 축, look-through 중 발견 시)
Trusted Issuer → entity claim(범주·자산·급조·QIB·직접요건)
```

## 12. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 자연인 매수인(isEntity=false) | PASS(휴면) |
| 2 | 요구 축 없음 | PASS(휴면) |
| 3 | AI DIRECT_ASSETS, 자산 $6M, 비급조 | PASS |
| 4 | AI DIRECT_ASSETS, 자산 정확히 $5M | ENTITY_THRESHOLD_NOT_MET(2, 초과) |
| 5 | AI DIRECT_ASSETS, 급조 | ENTITY_FORMED_FOR_PURPOSE(4) |
| 6 | AI ALL_OWNERS_AI, look-through PENDING | ENTITY_LOOKTHROUGH_REQUIRED(5) |
| 7 | QP FAMILY, 자산 정확히 $5M | PASS(이상) |
| 8 | QP INSTITUTIONAL, 자산 $24M | ENTITY_THRESHOLD_NOT_MET(2) |
| 9 | QP QIB, 미확인 | ENTITY_QIB_UNCONFIRMED(3) |
| 10 | QP TRUST, 급조 | ENTITY_FORMED_FOR_PURPOSE(4, 치유 없음) |
| 11 | AI·QP 동시 활성, QP만 실패 | ENTITY_AND_GATE_FAIL(8) + diagnose 이벤트 |

## 13. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| entity 사실 | 운영자 `setEntityClaim` | Trusted Issuer 검증 claim |
| 요구 축 | 운영자 `setRequiredTracks` | 자산·거래 맥락 |
| look-through | 주입 A-09(mock) | A-09 재귀 엔진 |
| 범주 | 통합(DIRECT_ASSETS 등) | Rule 501(a)·§2(a)(51) 세부 |

## 14. 잔여 확정 항목

1. 적격기관투자자 간주 경로 세부 요건.
2. 전환·펀드 매수인 beneficial owner 산정(Rule 2a51-2).
3. 급조 회사 look-through 치유 범위(2a51-3).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~12절 (구현) | 실장 | `EntityEligibility.sol` (A-08-v1) |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-08_법인_자격_산정(발행측).md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/EntityEligibility.sol` · `interfaces/compliance/ILookThroughSource.sol`
- 결정: `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 80a-2(a)(51)(A)(ii)·(iii)·(iv)·§ 80a-3(c)(7) · 17 C.F.R. § 230.501(a)·§ 270.2a51-1(g)(1)·(h)·§ 270.2a51-2·§ 270.2a51-3 · JOBS Act § 201(b)(2) · SEC Release IC-22597·33-10824

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 법인 두 겹(직접자격/구성원)·AI(R1)/QP(R3) 이축·우회방지(급조배제·look-through)·부등호(AI `>`/QP `>=`)·존립위험·A-09 라우팅. 제2부: 실장 `EntityEligibility.sol`(AiBasis/QpBasis·requiredTracks bitmask·AND 게이트·formed-for-purpose 치유 분기·임계값 strict/inclusive·A-09 seam·REQ-A08-1~5·8 reason code·diagnose 동반). A-08은 보경 기반 실구현이라 제2부는 현행 계약.
