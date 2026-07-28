---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: E-01
element-name: Form D Filing (Form D 확인 · Notice of Exempt Offering)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(FormDFiling.sol, mock) 기준.
substance-sot: "보경 walkthrough — E-01_FormD확인.md (2026-07-21). 레포 docs 교체 대상."
implements: "src/compliance/elements/FormDFiling.sol (ELEMENT_ID E-01-v1, mock)"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Manifest·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, E-01, form-d, issuer-status, R1]
---

# E-01 Form D Filing — 요구사항 명세서

본 문서는 컴플라이언스 부품 E-01(Form D 확인)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `FormDFiling.sol`(E-01-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 매수인이 아니라 발행자·자산을 본다. 따라서 실패는 매수인 교체로 치유되지 아니하고 자산 단위로 차단된다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

E-01은 이 자산의 발행자가 이 발행에 대하여 SEC에 Form D(면제 발행 통지)를 제출하였는지를 거래 직전에 확인하는 부품이다. Form D는 등록서류가 아니라 통지로서 심사·승인·연방 수수료가 없으며, 사모 시장의 유일한 공개 창의 역할을 한다.

## 2. 규범적 근거 — 그리고 결정적 구조

Form D 제출은 Rule 503이 요구하나(17 C.F.R. § 230.503), 이것은 Rule 506(c) 면제의 조건이 아니다. Rule 506(c)(1)이 조건으로 열거하는 것은 §230.501과 §230.502(a)·(d)뿐이고 §230.503은 빠져 있다. 따라서 Form D를 제출하지 아니하여도 그 발행은 여전히 §5 면제를 받으며, 이미 종결된 실체적 거래가 소급하여 위법한 미등록 증권이 되지 아니한다. 그러나 면제 유지와 위법 아님은 다른 말이다. Rule 503 위반은 그 자체로 증권법 위반이며, SEC는 §8A의 중지명령과 민사제재금을 부과할 수 있다(2024-12-20 SEC는 Form D 미제출만을 이유로 3개 발행자를 제재하였다; Release 33-11347). 나아가 위반을 이유로 법원 유지명령을 받으면 이후 Rule 504·506 발행이 막히고(Rule 507), 실무상 가장 먼저 터지는 것은 주(州)이다. Rule 506 증권은 covered security로 주 등록이 선점되나 §18(b)(4)(F)의 단서가 주의 notice filing 요구권을 보존하고 §18(c)(3)이 filing·fee 미제출을 이유로 그 주 안의 offer·sale을 정지할 수 있게 한다(15 U.S.C. § 77r). 주 신고는 Form D 사본을 기초로 하므로 Form D 미제출은 주 신고 자체를 불성립시킨다.

## 3. 쟁점별 논증

### 3.1 이 부품이 지키는 것은 면제가 아니라 운영 위험이다

E-01의 실패가 무엇을 의미하는지가 문제된다. Form D 미제출은 면제를 깨지 아니하므로, 본 부품은 면제 상실을 구현하는 부품이 아니다. 본 부품은 면제는 살아 있으나 발행자가 제재·실격·주 정지 위험에 노출된 자산을 우리 거래장이 계속 유통시킬 것인가라는 운영상의 물음에 답하는 보수적 게이트이다. 이 성격 규정이 본 부품 전체를 지배한다.

### 3.2 506(c)에는 탈출구가 없다

일반 청약을 한 발행이 Form D 의무를 피할 수 있는지가 문제된다. Rule 500(c)는 Regulation D 준수 시도가 배타적 선택이 아니어서 §4(a)(2)를 따로 주장할 수 있다고 하나, 이 탈출구는 일반 청약을 하는 순간 닫힌다. 일반 청약을 한 발행은 §4(a)(2)의 비공모 거래일 수 없으므로 Rule 506(c)에 의존할 수밖에 없고, 그 결과 Form D 제출 의무가 확정된다.

### 3.3 발행자·자산 단위

본 부품이 누구를 보는지가 문제된다. A 계열이 매수인의 자격을 보는 것과 달리 본 부품은 발행이 규제 준수 상태인지를 보므로, 실패의 의미가 다르다. 매수인 교체로 치유되지 아니하고 자산 단위로 차단된다. 또한 최초 매도일은 결제일이나 토큰 발행일이 아니라 투자자가 철회 불가능하게 계약상 구속된 날이므로, 온체인 이벤트를 기산점으로 삼으면 마감을 놓친다.

## 4. 확정 사항 및 잔여 쟁점

Form D 의무의 성격(면제 조건 아님·독립 제재 라인)과 운영 게이트로서의 위치는 위와 같이 확정되었다. 다만 현재 컨트랙트는 제출 여부 하나만을 보며, 보경 규격이 요구하는 Manifest 면제 주장과의 정합, 15일 제출 기한, 연차 수정의 지연, 최초 매도일 기산은 아직 구현되지 아니한다. 역외 발행자도 Rule 503을 지므로 D-01의 FPI 같은 선행 분기가 없다는 점도 확인되었다.

---

# 제2부. 구현 명세 (컨트랙트 `FormDFiling.sol` — 현재 mock)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `E-01-v1` |
| 분류 | 발행자 상태(ISSUER_STATUS) — `asset` 키 |
| 검증 패턴 | 공적 데이터 확인형(ATTESTATION_BASED) · EX_ANTE_VERIFY · ONE_TIME |
| 상태 | STATELESS |
| 활성 | R1(Reg D 506(c) 발행) 전용. |
| 의존 | B-01(manifest 정합) · E-03(bad actor) · A-01/A-02(선행 글로벌 게이트) |

## 6. 인터페이스 (현행)

```solidity
// 판정 (view). asset을 검사(매수인 무시). 미기재는 fail-closed.
function check(address, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);
//   passed = formDFiled[asset]; else code 1

// 운영자 설정 (onlyOperator). 취소는 setFormDFiled(asset, false, 0).
function setFormDFiled(address asset, bool filed, bytes32 ref) external;
```

현행 컨트랙트는 자산별 제출 여부(`formDFiled`)와 참조 해시(`filingRef`)를 두고, 제출되었으면 통과·아니면 차단(코드 1)한다. Production 출처는 EDGAR oracle 또는 해시 앵커된 상장 계약 확인이다.

## 7. 현행 구현과 목표 규격의 격차

| 항목 | 현행 `FormDFiling.sol` | 목표 규격(보경 walkthrough) |
|---|---|---|
| 판정 | 제출 여부 boolean | G1 존재 + G4 면제 주장 정합(Item 06c·3C.7 vs Manifest) |
| 기한 | 없음 | Rule 503(a)(1) 15일(≤15 적법, 주말·공휴일 연장) |
| 수정 | 없음 | 연차 수정 1주년 이내 |
| 기산점 | 없음 | 최초 매도일 = 철회 불가 계약 구속일 |
| 출처 | 운영자 flag | EDGAR oracle / 상장 계약 확인 |

## 8. 기능 요구사항

- **REQ-E01-1 (제출 확인, 현행).** 시스템은 자산에 대하여 Form D가 제출되었으면 통과하고, 아니면 차단한다(코드 1). 미기재는 fail-closed이다.
- **REQ-E01-2 (정합, 목표).** Form D의 면제 주장(Item 06c·3C.7)이 Manifest의 발행 프레임워크와 일치하여야 한다.
- **REQ-E01-3 (기한, 목표).** 최초 매도일로부터 15일 이내에 제출되어야 하며, 마감일이 주말·공휴일이면 다음 영업일로 연장된다.
- **REQ-E01-4 (수정, 목표).** 요구되는 연차 수정이 1주년 이내에 제출되어야 한다.
- **REQ-E01-5 (기산점, 목표).** 최초 매도일은 온체인 이벤트가 아니라 투자자가 철회 불가능하게 계약상 구속된 날로 한다.

## 9. reasonCode

| n | Code | 발생 조건 | 상태 |
|---|---|---|---|
| 1 | `FAIL_NO_FORM_D` | Form D 미제출(미기재 포함) | 현행 |
| (목표) | `FAIL_FORM_D_MISMATCH` / `FAIL_FORM_D_LATE` / `FAIL_FORM_D_AMENDMENT_LATE` | 정합·기한·수정 위반 | 목표 |

## 10. 불변식

1. Form D 미제출은 면제를 깨지 아니한다. 본 부품은 운영 게이트이다.
2. 본 부품은 발행자·자산을 보며 매수인 교체로 치유되지 아니한다.
3. 미기재는 fail-closed이다.
4. 역외 발행자도 Rule 503을 지므로 FPI 같은 선행 분기가 없다.

## 11. 의존성

```
EDGAR oracle / 상장 계약 확인 → 제출 사실 → E-01 (목표)
B-01(manifest) → 면제 주장 정합(목표)
E-03·A-01·A-02 → R1 전용 3인방·선행 게이트
```

## 12. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | Form D 미제출 | FAIL_NO_FORM_D(1) |
| 2 | Form D 제출 | PASS |
| 3 (목표) | 면제 주장 불일치 | FAIL_FORM_D_MISMATCH |
| 4 (목표) | 최초 매도 16일 후 제출 | FAIL_FORM_D_LATE |
| 5 (목표) | 마감 주말 → 다음 영업일 제출 | PASS(연장) |
| 6 (목표) | 연차 수정 지연 | FAIL_FORM_D_AMENDMENT_LATE |

## 13. Demo 및 Production 범위

| 구분 | Demo (현행) | Production |
|---|---|---|
| 제출 사실 | 운영자 `setFormDFiled` | EDGAR oracle / 상장 계약 |
| 판정 | 제출 여부 | 정합·기한·수정 |
| 테스트 | 실제 BUIDL Form D fixture(CIK 0002013810) | — |

## 14. 잔여 확정 항목

1. 면제 주장 정합(Item 06c·3C.7 vs Manifest).
2. 15일 제출 기한·주말 연장·연차 수정.
3. 최초 매도일 기산(계약 구속일).
4. EDGAR oracle 연동.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5·6·8·9절 (현행 구현) | 실장 | `FormDFiling.sol` (E-01-v1) |
| 제7·14절 (격차·목표) | 실장·목표 | `FormDFiling.sol` + 보경 walkthrough |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `E-01_FormD확인.md` (2026-07-21) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/FormDFiling.sol`
- 결정: `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 77d(a)(2)·§ 77r(b)(4)(F)·(c)(3) · 17 C.F.R. § 230.503·§ 230.506(c)·§ 230.507·§ 230.500(c)·§ 239.500 · SEC Release 33-11347 · Form D FAQ (2026)

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: Form D=통지(면제 조건 아님·506(c)(1)에 §503 미열거)→FAIL≠면제상실·독립 제재 라인(§8A·Rule 507·**주 정지**)·506(c) 탈출구 없음·발행자/자산 단위·최초매도일=계약구속일·역외도 Rule 503. 제2부: 실장 `FormDFiling.sol`(mock — 제출 boolean·reason code 1)과 목표 규격(정합·15일 기한·연차 수정·EDGAR)의 격차 명시.
