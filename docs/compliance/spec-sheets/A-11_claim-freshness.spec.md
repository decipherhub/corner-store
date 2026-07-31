---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-11
element-name: Claim Freshness (증명 유효기간)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(ClaimFreshness.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-11_증명-유효기간.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/ClaimFreshness.sol (ELEMENT_ID A-11-v1)"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Trusted Issuer·claim·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-11, claim-freshness, 506c, qp, cascade]
---

# A-11 Claim Freshness — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-11(증명 유효기간)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `ClaimFreshness.sol`(A-11-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 자격의 실체(누가 적격투자자인가·적격구매자인가)를 판정하지 아니하고, 이미 발급된 자격 증명이 거래 시점에도 유효기간 내에 있는지의 시간축만을 본다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-11은 이미 발급된 자격 증명이 이 거래 시점에도 아직 유효한지를 거래 직전에 판정하는 보조 부품이다. 자격의 실체 판정은 부품 A-03(적격투자자)·A-13(적격구매자)이 하며, 본 부품은 그 증명이 발급된 뒤 너무 오래되어 더는 신뢰할 수 없게 되지 아니하였는지만을 본다.

## 2. 규범적 근거

두 갈래의 신선도가 서로 다른 근거에서 나온다. 적격투자자 갈래는 법규에 근거한다. 2012년 JOBS Act가 도입한 Rule 506(c)는 일반청약을 허용하는 대신 발행인에게 모든 매수인이 적격투자자임을 검증하기 위한 상당한 조치를 지웠고(17 C.F.R. § 230.506(c)(2)(ii)), 2020년 개정으로 신설된 Rule 506(c)(2)(ii)(E)는 한 번 검증한 자에 대하여 반대 정보가 없고 서면 진술을 받으면 검증일로부터 5년간 그 검증을 재사용할 수 있게 하였다(SEC Release 33-10884). 이 5년이 적격투자자 증명 유효기간의 직접 근거이다.

적격구매자 갈래에는 법규상 유효기간이 없다. 투자회사법 §3(c)(7)은 취득 시점에 적격구매자일 것을 요구할 뿐 재검증·만료 조항을 두지 아니하며(15 U.S.C. § 80a-3(c)(7)(A)), §2(a)(51)의 정의도 자산 기준만 정할 뿐 시간 차원이 없다. 따라서 적격구매자 증명의 유효기간은 법규에서 도출되는 값이 아니라 Decipher가 위험관리로 정하는 정책값이다.

## 3. 쟁점별 논증

### 3.1 A-11과 C-01의 구별

본 부품이 보유기간 부품과 어떻게 다른지가 문제된다. 본 부품은 자격 증명이 검증된 시점부터의 경과를 보고, 보유기간 부품(C-01)은 증권 자체를 취득 시점부터 보유한 기간을 본다. 같은 시간 검사처럼 보이나 대상·기산점·근거 조문이 모두 다르다.

### 3.2 5년은 법이 준 기간, 1년은 정책이 정한 기간

두 유효기간의 성격이 문제된다. 적격투자자의 5년은 Rule 506(c)(2)(ii)(E)가 명시한 재사용 기간으로서 법규가 준 최대치이다. 적격구매자의 1년은 법규가 아니라 Decipher가 정한 정책값으로서, 법이 허용한 최대치를 그대로 쓰지 아니하고 더 짧게 잡은 보수적 완충이다. 이 구분은 코드·문서·이용자 메시지 어디에서도 흐려져서는 아니 되며, 1년을 법적 요건인 것처럼 표시하여서는 아니 된다.

### 3.3 두 시계와 존립 위험

왜 적격구매자 쪽을 더 좁게 잡는지가 문제된다. 결과의 비대칭 때문이다. §3(c)(7) 펀드는 단 한 명의 비적격구매자 보유자가 생기면 펀드 전체의 면제가 붕괴할 수 있는 존립적 결과를 낳는 반면, 적격투자자 신선도가 어긋나면 그 한 건의 검증 흠결이 문제될 뿐이다. 그러므로 결과가 치명적인 적격구매자 쪽을 더 짧은 창(1년)으로, 덜 치명적인 적격투자자 쪽을 법규가 허용한 최대치(5년)로 막는다. 유의할 점은, 적격구매자 신선도의 목적이 기존 보유자를 계속 감시하는 것이 아니라 새로운 취득 시점에 매수인이 적격구매자였다고 합리적으로 믿을 수 있는 최신 증명을 확보하는 데 있다는 것이다(§3(c)(7)(A)는 취득 시점 기준이다).

### 3.4 basis-agnostic 보조 부품

본 부품이 자격 범주를 발급하는지가 문제된다. 본 부품은 증명의 범주를 발급하지 아니하고, 이미 부여된 증명의 유효기간만을 검사한다. 따라서 표준 자격 범주 전부에 동일하게 적용되며, 자격의 실체 판단은 A-03·A-13에 위임한다. 또한 재판매가 Rule 144 경로인 경우 매수인의 적격투자자 요건이 없으므로 적격투자자 신선도가 자동으로 붙지 아니한다.

## 4. 확정 사항 및 잔여 쟁점

두 갈래의 유효기간 근거(적격투자자 5년 법규·적격구매자 1년 정책)와 A-11의 보조 성격은 위와 같이 확정되었다. 잔여로는 적격구매자 정책값(1년)의 위험관리 재검토와 취득 시점의 기준 시각 정의(C-01과 공유)가 있다.

---

# 제2부. 구현 명세 (컨트랙트 `ClaimFreshness.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-11-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) · PERIODIC |
| 검증 패턴 | 기계 판정형 · DETERMINISTIC (서명 timestamp의 산술 비교) |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) |
| 상태 | STATELESS |
| 활성 | R1 · R2의 §4(a)(7) 분기(적격투자자). R3(적격구매자). A-03·A-13의 보조(cascade). |
| 의존 | Trusted Issuer(verifiedAt·issuerExpiry 발급) · A-03·A-13(자격 실체) |

## 6. 인터페이스

```solidity
// 판정 (view). user = 매수인
function check(address user, address, address, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setClaim(address user, FreshClaimType claimType, uint64 verifiedAt, uint64 issuerExpiry) external;
```

`FreshClaimType`: `UNKNOWN · AI · QP`. `FreshnessClaim`: `claimType · verifiedAt(0=미설정) · issuerExpiry(0=없음, 설정되고 cap보다 짧으면 우선)`.

## 7. 유효기간 상수와 판정

| 상수 | 값 | 성격 |
|---|---|---|
| `CAP_AI` | 5년 | **법규**(Rule 506(c)(2)(ii)(E)) |
| `CAP_QP` | 1년 | **정책**(비법규 — 코드·문서·메시지에 법적 요건으로 표시 금지) |

판정: 유효기간은 `verifiedAt + cap`이고, 발급자 지정 만료(issuerExpiry)가 더 짧으면 그것이 우선한다(더 엄격한 것이 항상 지배). 비교는 엄격 `>`이므로 상한에 정확히 도달한 경우는 통과한다(포함 창).

## 8. 기능 요구사항

- **REQ-A11-1 (기준 없음).** `verifiedAt`이 0이면 산술 기준이 없으므로 차단한다(코드 1).
- **REQ-A11-2 (유형 미상 fail-closed).** `claimType`이 UNKNOWN이면 차단하며(코드 5), 결코 느슨한 적격투자자 상한으로 기본 처리하지 아니한다.
- **REQ-A11-3 (상한 선택).** 유형이 적격구매자이면 1년, 그 밖이면 5년을 적용한다.
- **REQ-A11-4 (발급자 만료 우선).** 발급자 지정 만료가 규정·정책 상한보다 짧으면 그것을 유효기간으로 한다.
- **REQ-A11-5 (판정).** 거래 시점이 유효기간을 초과하면 차단한다. 발급자 만료로 인한 초과는 코드 4, 규정·정책 상한 초과는 적격구매자이면 코드 3·적격투자자이면 코드 2로 한다. 상한에 정확히 도달한 경우는 통과한다.

## 9. reasonCode

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `FAIL_NO_VERIFIED_AT` | `verifiedAt` 미설정 |
| 2 | `FAIL_CLAIM_STALE_AI` | 적격투자자 증명이 5년(법규) 초과 |
| 3 | `FAIL_CLAIM_STALE_QP` | 적격구매자 증명이 1년(정책) 초과 |
| 4 | `FAIL_CLAIM_EXPIRED` | 발급자 지정 만료(상한보다 짧음) 초과 |
| 5 | `FAIL_UNKNOWN_CLAIM_TYPE` | 유형 미상(fail-closed) |

## 10. 신뢰 모델

- **REQ-A11-6 (발급자 책임).** `verifiedAt`·`issuerExpiry`는 기초 증명에 서명한 Trusted Issuer가 off-chain에서 확인한 값이며, 본 부품은 이를 액면 그대로 신뢰하고 그 위에서 결정론적 산술만 수행한다. 잘못된 `verifiedAt`의 책임은 발급자에게 있고 본 부품에 있지 아니하다.

## 11. 불변식

1. 적격투자자 5년은 법규, 적격구매자 1년은 정책이다. 후자를 법적 요건으로 표시하지 아니한다.
2. 유형 미상은 fail-closed이며 느슨한 상한으로 떨어지지 아니한다.
3. 발급자 만료가 더 짧으면 항상 지배한다(더 엄격한 것 우선).
4. 상한은 포함 창(엄격 `>` 초과만 실패)이다.
5. 본 부품은 자격 실체를 판정하지 아니한다(보조 부품).

## 12. 의존성

```
Trusted Issuer → verifiedAt·issuerExpiry → A-11
A-03(AI)·A-13(QP) → 자격 실체(본 부품은 유효기간만) — cascade
A-11 ↔ C-01 : 취득 시점 기준 시각 정의 공유(별개 시계)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | verifiedAt 미설정 | FAIL_NO_VERIFIED_AT(1) |
| 2 | 유형 UNKNOWN | FAIL_UNKNOWN_CLAIM_TYPE(5) |
| 3 | AI, 4년 경과 | PASS |
| 4 | AI, 5년+1일 경과 | FAIL_CLAIM_STALE_AI(2) |
| 5 | AI, 정확히 5년 | PASS(포함) |
| 6 | QP, 11개월 경과 | PASS |
| 7 | QP, 1년+1일 경과 | FAIL_CLAIM_STALE_QP(3) |
| 8 | issuerExpiry(6개월) 설정, 7개월 경과 | FAIL_CLAIM_EXPIRED(4) |
| 9 | AI/QP 동시(별도 인스턴스) | 각 시계 독립(QP 먼저 만료) |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| verifiedAt | 운영자 `setClaim` | Trusted Issuer 서명 값 |
| QP 정책값 | 1년 고정 | 위험관리 재검토 |
| 재검증 알림 | — | QP 시계 기준 프런트 알림 |

## 15. 잔여 확정 항목

1. 적격구매자 정책값(1년)의 위험관리 재검토.
2. 취득 시점 기준 시각 정의(C-01과 공유 ADR).
3. Trusted Issuer 연동(현재 운영자 기재).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~13절 (구현) | 실장 | `ClaimFreshness.sol` (A-11-v1) |
| 제10절 (신뢰 모델) | 실장 | `ClaimFreshness.sol` 주석 |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-11_증명-유효기간.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/ClaimFreshness.sol`
- 결정: `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 17 C.F.R. § 230.506(c)(2)(i)·(ii)·(ii)(E)·(ii)(C) · 15 U.S.C. § 80a-3(c)(7)(A)·§ 80a-2(a)(51) · JOBS Act § 201(a) · SEC Release 33-10884·33-9415

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: AI 5년(법규 506(c)(2)(ii)(E)·Release 33-10884) vs QP 1년(정책·ICA §3(c)(7) 무만료)·A-11≠C-01·basis-agnostic·두 시계·QP 존립위험(더 좁은 창). 제2부: 실장 `ClaimFreshness.sol`(FreshClaimType·CAP_AI/CAP_QP·issuer 만료 우선·strict `>` 포함창·UNKNOWN fail-closed·REQ-A11-1~6·5 reason code). 컨트랙트가 "QP 1년=정책, 법적 요건 표시 금지"를 주석에 명시. A-11은 보경 기반 실구현이라 제2부는 현행 계약.
