---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-03
element-name: Accredited Investor (적격투자자)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(AccreditedInvestor.sol) 기준. 승준 Component Spec Sheet(_PM/) 대체.
substance-sot: "보경 walkthrough — Element.A-03_Accredited-Investor.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/AccreditedInvestor.sol (ELEMENT_ID A-03-v1, 커밋 'upgrade A-03 accredited investor to walkthrough spec')"
reflects-decisions: [ADR-005, ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
supersedes: "_PM/A-03 적격투자자 — 개발 Component Spec Sheet (v1.0) — staging 기반 잠정본"
tags: [requirement-spec, A-03, accredited-investor, reg-d, 506c, R1, R2]
---

# A-03 Accredited Investor — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-03(적격투자자)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `AccreditedInvestor.sol`(A-03-v1)을 기준으로 한다. 본 문서는 종전의 승준 Component Spec Sheet(staging 기반 잠정본)를 대체한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-03은 매수인이 Regulation D Rule 506(c) 발행 또는 §4(a)(7) 재판매 경로에서 요구되는 적격투자자인지를 거래 직전에 확인하는 부품이다. 증권을 등록 없이 매도하려면 등록 면제가 필요하고, Rule 506(c)는 일반청약(general solicitation)을 허용하는 대신 모든 매수인이 적격투자자일 것과 발행인이 그 자격을 검증하기 위한 상당한 조치를 취할 것을 요구한다. 본 부품은 매수인의 재산·소득·자격을 온체인에서 다시 계산하지 아니하고, Trusted Issuer가 검증하여 발급한 서명 claim의 존재·발급자 신뢰·서명·만료·검증 근거만을 확인한다.

## 2. 규범적 근거

증권법 §5의 등록 원칙에서 출발한다(15 U.S.C. § 77e). 사모 발행의 기본 면제는 §4(a)(2)이고(15 U.S.C. § 77d(a)(2)), 그 안전항인 Rule 506(c)는 일반청약을 허용하되 모든 매수인이 적격투자자일 것과 발행인이 상당한 조치로 이를 검증할 것을 요구한다(17 C.F.R. § 230.506(c), (c)(2)(ii)). 적격투자자의 정의는 Rule 501(a)의 각 범주에 의한다(17 C.F.R. § 230.501(a)). 재판매 국면에서는 §4(a)(7)이 각 매수인의 적격투자자 요건을 두므로 본 부품이 그 경로에서도 작동한다(15 U.S.C. § 77d(a)(7), § 77d(d)(1)).

유의할 정정이 있다. 일반청약 금지의 원문은 Rule 506(b)가 아니라 Rule 502(c)이며, Rule 506(d)는 매수인 자격이 아니라 발행인·관련자의 부적격자(bad actor) 결격으로서 부품 E-03의 소관이다. 또한 고액 최소투자금액은 검증의 한 요소일 뿐 자동으로 적격투자자를 인정하는 규칙이 아니다.

## 3. 쟁점별 논증

### 3.1 본 부품이 판정하지 아니하는 것

A-03이 재산·소득을 계산하는지가 문제된다. 적격투자자 여부는 재산·소득·자격의 실체 판단으로서 온체인에서 수행할 수 없으며, Rule 506(c)(2)(ii)의 검증 책임은 발행인에게 있다. 따라서 그 판단은 Trusted Issuer가 off-chain에서 수행하여 서명 claim으로 발급하고, 본 부품은 그 claim의 존재·발급자 신뢰·서명·만료·검증 근거·범주만을 확인한다.

### 3.2 상당한 검증 조치

무엇이 상당한 검증인지가 문제된다. Rule 506(c)(2)(ii)는 매수인의 적격 여부를 검증하기 위한 상당한 조치를 요구하며, 그 판단은 상황에 따른 객관적 평가이다(SEC Release 33-9415). SEC 스태프는 고액의 최소투자금액과 매수인의 서면 진술의 결합을 상당한 조치의 한 방법으로 볼 수 있다고 하였으나(Latham & Watkins No-Action Letter, 2025-03-12; C&DI 256.35·256.36), 이는 하나의 요소일 뿐 자동 인정 규칙이 아니다. 본 부품은 그 검증이 성립하였다는 claim의 표지(검증 근거 수락)만을 확인한다.

### 3.3 활성화 — 발행과 재판매

본 부품이 언제 작동하는지가 문제된다. 발행(Rule 506(c))에서는 매수인의 적격투자자 요건이 항상 요구되므로 본 부품이 작동한다. 재판매에서는 경로에 따라 갈린다. §4(a)(7) 경로는 각 매수인의 적격투자자 요건을 두므로 본 부품이 작동하나, Rule 144 경로는 매수인의 적격투자자 요건을 두지 아니하므로 본 부품이 작동하지 아니한다. 대상 자산의 재판매 경로가 어느 것인지는 종전에 미결이었으나(Q-B1), 본 프로젝트는 ADR-005로 §4(a)(7)을 주 경로로 확정하였으므로 재판매에서도 본 부품이 작동한다. 이 경로 구분은 자산별 설정으로 다룬다.

### 3.4 적격구매자와의 구별

적격투자자와 적격구매자의 관계가 문제된다. 대상 자산과 같은 §3(c)(7) 펀드는 매수인이 적격투자자이면서 동시에 적격구매자일 것을 요구한다. 본 부품은 그중 적격투자자만을 확인하며, 적격구매자는 부품 A-13이 확인한다. 두 자격은 근거 법과 기준이 다르므로 하나의 통과가 다른 하나의 통과를 의미하지 아니한다.

### 3.5 전원 적격 소유자 범주의 look-through

법인 매수인의 적격 여부가 문제된다. Rule 501(a)(8)의 전원 적격 소유자 범주는 그 법인의 지분 소유자 전원이 적격투자자일 것을 요구하므로 실질 소유자에 대한 look-through를 요한다. 이 재귀 판정은 부품 A-09의 look-through 결과를 입력으로 받으며, 그 완료 여부가 본 부품의 판정에 반영된다.

## 4. 확정 사항 및 잔여 쟁점

발행·재판매의 활성화 구조와 검증 근거의 확인 방식은 위와 같이 확정되었으며, 종전의 재판매 경로 미결(Q-B1)은 ADR-005로 §4(a)(7) 확정에 의하여 해소되었다. 다만 §4(a)(7)의 general solicitation 판정 등 일부는 변호사 트랙의 잔여 사항으로 남는다.

---

# 제2부. 구현 명세 (컨트랙트 `AccreditedInvestor.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-03-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 증명서형(ATTESTATION_BASED) |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS |
| 활성 | R1(506(c) 발행) · R2의 §4(a)(7) 분기. Rule 144 분기에서는 휴면. |
| 의존 부품 | A-04(신원) · A-11(claim 현행성) · A-01(제재) · A-09(전원 적격 소유자 look-through) · D-01(coarse `accredited` view 소비) |

## 6. 인터페이스

```solidity
// 판정 (view). user = 매수인
function check(address user, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setAccredited(address user, bool isAccredited) external;   // legacy: true → 완전 유효 DIRECT claim
function setClaim(address user, AiClaim claim) external;            // rich claim
function setRequires506cVerification(address asset, bool required) external; // 506(c) 검증 근거 강제(opt-in)
function setSec4a7Path(address asset, bool enabled) external;       // §4(a)(7) 재판매 경로 표시(opt-in)

// view
function accredited(address user) external view returns (bool);     // coarse view(D-01 소비)
```

## 7. 상태 및 구성

`AiClaimBasis` 열거형: `NONE · DIRECT(대부분의 Rule 501(a) 범주가 온체인에서 동일 해소되어 통합) · ALL_EQUITY_OWNERS(Rule 501(a)(8) look-through) · OTHER(미지원, fail-closed)`.

`AiClaim` 구조: `exists · issuerTrusted · signatureValid · expiry(0=없음) · verificationBasisAccepted(506(c)(2)(ii) 상당한 조치 근거) · basis · ltStatus((a)(8) 전용) · reviewRequired`.

| 요소 | 유형 | 의미 |
|---|---|---|
| `claimOf[address]` | mapping→AiClaim | 매수인별 AI claim |
| `accredited[address]` | mapping→bool | claim 존재의 coarse view(D-01 소비, `setAccredited`/`setClaim`이 동기 유지) |
| `requires506cVerification[asset]` | bool (기본 false) | 자산별 506(c) 검증 근거 강제(opt-in) |
| `sec4a7PathOf[asset]` | bool (기본 false) | 자산의 재판매 경로가 §4(a)(7)임을 표시(opt-in) |

## 8. 기능 요구사항

- **REQ-A03-1 (파이프라인 순서).** 시스템은 존재(1) → 발급자 신뢰(2) → 서명(3) → 만료(4, 엄격 `>`) → [자산 506(c) 요구 시] 검증 근거(5) → [자산 §4(a)(7) 경로 시] 범주 없음 shell(6) → 범주 OTHER(8) → 전원 적격 소유자 look-through 미완(7) → 수동 심사(9)의 순서로 판정하여야 한다.
- **REQ-A03-2 (claim 확인).** 시스템은 재산·소득·자격을 재계산하지 아니하고 claim의 표지만을 확인한다.
- **REQ-A03-3 (검증 근거 강제).** 자산이 506(c) 검증을 요구하는 경우, 검증 근거가 수락되지 아니한 claim은 차단한다(코드 5).
- **REQ-A03-4 (재판매 경로 휴면).** Rule 144 경로(`sec4a7PathOf`=false)에서는 본 부품이 매수인 적격을 요구하지 아니한다(휴면). §4(a)(7) 경로에서만 범주 없음 shell을 차단한다(코드 6).
- **REQ-A03-5 (look-through).** 범주가 전원 적격 소유자인 경우 look-through가 완료되지 아니하면 차단한다(코드 7; 미개시·진행·실패 모두 코드 7).

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(recipeId, "A-03-v1", n)`으로 인코딩하며, `n`은 walkthrough §6과 일치한다.

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `NO_AI_CLAIM` | claim 없음(legacy "비적격" 실패와 동일 의미) |
| 2 | `UNTRUSTED_AI_CLAIM_ISSUER` | 발급자 미신뢰 |
| 3 | `INVALID_AI_CLAIM_SIGNATURE` | 서명 무효 |
| 4 | `AI_CLAIM_EXPIRED` | 만료(엄격 `>`) |
| 5 | `506C_VERIFICATION_NOT_ESTABLISHED` | 자산 506(c) 요구 + 검증 근거 미수락 |
| 6 | `4A7_PURCHASER_NOT_AI` | §4(a)(7) 경로 + claim shell(범주 NONE) |
| 7 | `AI_LOOKTHROUGH_PENDING` | 전원 적격 소유자 + look-through 미완(NONE/PENDING/FAILED) |
| 8 | `AI_CATEGORY_UNSUPPORTED` | 범주 OTHER |
| 9 | `REVIEW_AI_UNCERTAIN` | 수동 심사 표시 |

문서 모호성 해소: 코드 6은 좁게 범위된다. attest-only claim에서 존재하고 유효한 claim은 그 자체로 적격 판정이므로, 완전히 없는 claim은 코드 1로 실패하고, 존재하나 범주가 부여되지 아니한 shell만 §4(a)(7) 자산에서 코드 6이 된다. 코드 7은 문서에 별도의 look-through 실패 코드가 없어 NONE·PENDING·FAILED가 모두 코드 7로 매핑된다.

## 10. Legacy·Opt-in 경계 (현재 구현)

`setAccredited(user, true)`는 완전히 유효한 DIRECT claim(존재·신뢰·유효 서명·무만료·검증 근거 수락·범주 DIRECT)을 기재하여 그대로 통과한다. `accredited` coarse view는 claim에서 파생하지 아니하고 별도 저장 bool로 유지되어 D-01 등 소비처에 진실한 값을 준다. 신규 엄격성(`requires506cVerification`·`sec4a7PathOf`)은 운영자 설정이며 기본값이 꺼짐이므로, 현재 통과하는 흐름이 갑자기 실패하지 아니한다.

## 11. 불변식

1. 본 부품은 재산·소득·자격 실체를 재판정하지 아니한다(claim 확인).
2. 만료 경계는 엄격 `>`이므로 만료 시각에 정확히 도달한 claim은 통과한다.
3. Rule 144 경로에서는 휴면하며, §4(a)(7) 경로에서만 매수인 적격을 요구한다.
4. 범주 OTHER는 fail-closed(코드 8)이다.
5. 본 부품은 상태를 보유하지 아니한다.

## 12. 의존성

```
Trusted Issuer → AI claim(검증 결과) → A-03
A-04(신원) · A-11(현행성) · A-01(제재) → 병렬·보조
A-09(look-through) → 전원 적격 소유자 범주 → A-03 (ltStatus)
A-03(accredited coarse view) → D-01(비-AI 카운트 입력)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | claim 없음 | NO_AI_CLAIM(1) |
| 2 | 발급자 미신뢰 | UNTRUSTED_AI_CLAIM_ISSUER(2) |
| 3 | 서명 무효 | INVALID_AI_CLAIM_SIGNATURE(3) |
| 4 | 만료 초과 | AI_CLAIM_EXPIRED(4) |
| 5 | 506(c) 요구 자산, 검증 근거 미수락 | 506C_VERIFICATION_NOT_ESTABLISHED(5) |
| 6 | §4(a)(7) 자산, 범주 NONE shell | 4A7_PURCHASER_NOT_AI(6) |
| 7 | Rule 144 경로(sec4a7=false), claim 없음 | 휴면(A-03 미요구) — 경로 부품이 처리 |
| 8 | 전원 적격 소유자, look-through 미완 | AI_LOOKTHROUGH_PENDING(7) |
| 9 | 범주 OTHER | AI_CATEGORY_UNSUPPORTED(8) |
| 10 | 유효 DIRECT claim | PASS |
| 11 | A-13(QP) 통과이나 AI claim 없음 | NO_AI_CLAIM (AI와 QP 독립) |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| claim 발급 | 운영자 `setAccredited`/`setClaim` | Trusted Issuer(Sumsub 등) AI claim |
| 검증 근거 | opt-in(기본 off) | 506(c) reasonable steps 상시 |
| 재판매 경로 | `sec4a7PathOf` opt-in | ADR-005 §4(a)(7) 상시 |
| 범주 | DIRECT/전원적격/OTHER 통합 | Rule 501(a) 세부 범주 |

## 15. 잔여 확정 항목

1. §4(a)(7)의 general solicitation 판정(변호사 트랙).
2. Rule 501(a) 세부 범주와 claim 스키마.
3. Trusted Issuer 연동(현재 운영자 기재).
4. 검증 근거 강제·§4(a)(7) 경로 토글의 상시화(현재 opt-in).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제3.3절 (재판매 경로) | 결정 | ADR-005 (Q-B1 해소) |
| 제5~9·11~13절 (구현) | 실장 | `AccreditedInvestor.sol` (A-03-v1) |
| 제10절 (legacy·opt-in) | 실장 | `AccreditedInvestor.sol` 주석 |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-03_Accredited-Investor.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/AccreditedInvestor.sol`
- 결정: `ADR-005`(§4(a)(7) 주 경로·Q-B1 해소) · `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 77e·§ 77d(a)(2)·§ 77d(a)(7)·§ 77d(d)(1) · 17 C.F.R. § 230.501(a)·§ 230.502(c)·§ 230.502(d)·§ 230.506(c)·§ 230.506(c)(2)(ii) · SEC Release 33-9415 · Latham & Watkins NAL (2025-03-12) · C&DI 256.35·256.36

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 승준 Component Spec Sheet(staging) 대체. 제1부: §5→§4(a)(2)→506(c)(general solicitation+AI+검증)·Rule 501(a) 정의·검증 근거(Latham NAL/C&DI factor)·발행 active·재판매 §4(a)(7) active/Rule 144 dormant(Q-B1→ADR-005 해소)·QP 구별·(a)(8) look-through. 제2부: 실장 `AccreditedInvestor.sol`(AiClaimBasis·AiClaim·`sec4a7PathOf`·`requires506cVerification` opt-in·REQ-A03-1~5·9 reason code·doc-ambiguity 해소). A-03은 보경 기반 실구현이라 제2부는 현행 계약.
