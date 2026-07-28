---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-01
element-name: Sanctions Screening (OFAC 제재 스크리닝)
status: v0.1 (2026-07-22) — 2부 구성. Part II는 실장 컨트랙트(Sanctions.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-01_제재-명단.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/Sanctions.sol (ELEMENT_ID A-01-v1, 커밋 'upgrade A-01 sanctions to walkthrough spec')"
reflects-decisions: [ADR-002(R-XJ always-on), OD-CI-5]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Element/Recipe/Manifest·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-01, sanctions, ofac, always-on, R-XJ]
---

# A-01 Sanctions Screening — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-01(제재 스크리닝)의 요구사항 명세서이다. **제1부**는 본 부품이 강제하는 규율의 법적 근거와 그 도출 과정을, **제2부**는 이를 구현한 명세를 규정한다.

본 부품의 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며(부록 참조), 제2부는 레포에 실장된 컨트랙트 `Sanctions.sol`(A-01-v1)을 기준으로 한다. 즉 제2부의 인터페이스·상태·reason code는 제안이 아니라 현재 구현된 계약이다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-01은 거래의 어느 당사자(또는 그 지갑, 또는 그가 50% 이상 보유한 법인)가 미국 재무부 해외자산통제국(OFAC)의 제재 명단에 해당하는지를 거래 직전에 확인하여, 해당하는 경우 거래를 차단하는 부품이다. 본 부품은 다른 부품과 근본적으로 다른 세 가지 성격을 가진다. 첫째, 증권법이 아니라 제재법 위에 선다. 둘째, 위반에 무과실 책임이 따른다. 셋째, 특정 Recipe의 구성요소가 아니라 모든 거래에 적용되는 전역 게이트이다.

## 2. 적용 법령의 체계

미국 제재법의 출발점은 국제비상경제권한법(IEEPA)이다. 대통령이 그 원천이 미국 밖에 있는 비상하고 이례적인 위협에 대하여 국가비상사태를 선포하면(50 U.S.C. § 1701), 대통령은 그 위협과 관련된 재산과 거래를 차단·금지할 권한을 가진다(50 U.S.C. § 1702). 이 권한을 위임받아 OFAC이 차단 대상을 SDN 명단(Specially Designated Nationals and Blocked Persons List)에 등재하고, 미국 관할에 속하는 자와 재산은 그 대상과의 거래가 원칙적으로 전면 금지된다.

규칙 차원에서는 각 제재 프로그램이 31 C.F.R. Chapter V(Parts 500–599)에서 금지거래와 벌칙을 규정하며, 보고·기록·차단해제 절차는 31 C.F.R. Part 501에 의한다. 나아가 OFAC은 해석 지침으로 두 가지를 발한 바 있는데, 하나는 차단대상이 합산 50% 이상 보유한 법인을 자동으로 차단대상으로 보는 지침(Revised 50% Rule Guidance, 2014-08-13)이고, 다른 하나는 제재 의무가 가상자산 거래에도 동일하게 적용되며 SDN 명단에 디지털 자산 지갑 주소가 식별자로 포함된다는 지침(Sanctions Compliance Guidance for the Virtual Currency Industry, 2021-10-15)이다. 일부 legacy 프로그램은 적성국교역법(TWEA, 50 U.S.C. §§ 4301–4341)에 근거하나, 본 부품은 근거 프로그램과 무관하게 OFAC이 차단한 대상 전체를 명단으로 대조하므로 판정 결과는 동일하다.

## 3. 쟁점별 논증

### 3.1 증권법과의 독립성

A-01이 증권 자격 판정과 어떠한 관계에 있는지가 문제된다. 증권법은 등록하거나 면제 요건을 갖추면 적법하게 매도할 수 있는 구조이나, 제재법은 면제의 문제가 아니라 금지의 문제이다. 차단대상과의 거래는 어떠한 증권법 면제를 갖추든 무관하게 금지된다. 그러므로 A-01은 Reg D 면제의 성립 여부(R1) 또는 펀드 자격(R3)과 독립적으로 작동하며, 적격투자자(A-03)나 적격구매자(A-13) 판정이 통과되더라도 당사자가 차단대상이면 거래는 금지된다. 역으로 A-01의 통과는 증권 적격을 의미하지 아니한다.

이러한 성격 때문에 A-01은 특정 Recipe의 부속이 아니라 모든 Recipe(R1·R2·R3)에 필수로 부착되는 거래 단위의 전역 게이트이다. 이 분류는 OD-CI-5로 확정되었으며(walkthrough §10), 아키텍처상 A-01은 독립적 거래-수준 strict-liability 게이트로서 R-XJ(횡단·always-on, ADR-002)의 일부로 항상 켜진다.

### 3.2 무과실 책임과 사전 차단

A-01을 왜 사후 감시가 아니라 사전 차단으로 설계하는지가 문제된다. IEEPA의 민사 과태료 조항(50 U.S.C. § 1705(b))은 고의를 요건으로 하지 아니한다. 즉 차단대상인 줄 몰랐더라도 거래가 성사되면 위반이 성립한다. 고의(willful)는 형사 책임(§ 1705(c))의 요건일 뿐이며, 민사에서는 과태료 액수를 정하는 요소에 불과하다. 또한 과태료 상한이 거래당 산정되므로 위법 거래가 누적되면 그 부담이 커진다.

따라서 사후에 "몰랐다"로 방어할 수 없고, 거래 전에 기계가 차단하여야 한다. 이 무과실 책임의 결과로 A-01은 fail-closed로 설계된다. 즉 검사 결과가 불확실한 경우 통과가 아니라 차단 또는 보류를 기본으로 하며, 오탐은 사후 해제 절차로 푼다(제3.6절·제9절).

### 3.3 검사 대상의 범위

A-01이 누구를 검사하는지가 문제된다. 자격 부품이 매수인만을 심사하는 것과 달리, A-01은 거래의 모든 당사자, 즉 매수인과 매도인을 함께 본다. 매도인이 차단대상이면 매수인이 깨끗하더라도 거래는 금지되기 때문이다. 나아가 각 당사자에 대하여 신원과 지갑 주소를 이중으로 대조한다. 신원은 A-04가 지갑을 실세계 신원으로 해소한 결과를 SDN 등재 식별자에 대조하고, 지갑 주소는 SDN 등재 주소에 직접 대조한다.

### 3.4 50% Rule — 법인의 재귀 합산

법인 당사자를 어디까지 투시하는지가 문제된다. OFAC의 50% Rule에 의하면 차단대상 1인 이상이 합산하여 직접 또는 간접으로 50% 이상 보유한 법인은 그 법인이 SDN 명단에 없더라도 그 자체로 차단대상으로 본다. 합산 시 서로 다른 프로그램으로 차단된 자들의 지분도 합산하며, 간접 보유는 중간 법인을 통한 보유를 포함한다. 이 판정은 부품 A-09의 재귀 look-through 엔진과 구조적으로 동형이나, A-09가 구성원의 적격성을 평가하는 반면 A-01은 구성원의 차단 여부를 합산한다는 점에서 대상 명단과 판정이 다르다. 지분·실소유 데이터가 off-chain에 있으므로 합산은 off-chain에서 이루어지고 그 결과가 claim으로 들어온다. 50%는 포함 기준으로서 정확히 50%도 차단이다.

### 3.5 지갑 주소의 스크리닝

DEX 맥락에서 온체인 검사의 근거가 문제된다. OFAC은 2018년부터 SDN 등재 항목에 디지털 자산 지갑 주소를 식별자로 포함하며, 제재 의무는 가상자산 거래에도 동일하게 적용된다(VC Guidance, 2021-10-15). 지갑 주소는 SDN 등재 주소와 정확히 일치하는지로 판정하므로 결정론적이며, 이 부분이 A-01을 기계 판정형으로 분류하게 하는 핵심이다. 다만 등재 주소와 지갑을 공유한 연관 주소의 식별은 결정론을 넘는 휴리스틱이므로 자동 차단이 아니라 감시(F-02·A-12)의 영역으로 다룬다.

### 3.6 하이브리드 검증구조

A-01이 단일 검증 패턴인지가 문제된다. A-01은 두 패턴의 결합이다. 지갑 측은 온체인 SDN 지갑 집합과 코드가 직접 대조하는 결정론적 판정(패턴 A)이고, 신원 측과 50% Rule 측은 Trusted Issuer가 off-chain에서 스크리닝하여 발급한 서명 claim을 코드가 확인하는 증명서형 판정(패턴 B)이다. 이 이중성의 함의로, 지갑 집합은 oracle로 온체인에 동기화되어야 하고 신원 claim은 명단 갱신에 대비한 현행성 관리(A-11 연동)를 요한다.

## 4. 확정 사항 및 잔여 쟁점

A-01의 전역 게이트 지위는 OD-CI-5로, 항상 켜지는 성격은 ADR-002(R-XJ)로 확정되었다. 다만 다음 사항은 후속 보완을 요한다. 첫째, 신원 측 스크리닝 claim의 스키마와 스크리닝 데이터 소스(명단 동기화 주기, oracle 방식). 둘째, 이름 유사도 경계값(review 및 block 임계)은 정책값으로서 운영자가 설정하며 법이 고정하는 것은 50% 소유 기준뿐이다. 셋째, 연관 지갑 휴리스틱은 A-01의 결정론적 차단 너머 감시(F-02) 영역으로 경계를 둔다.

---

# 제2부. 구현 명세 (컨트랙트 `Sanctions.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-01-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) · 전역 게이트 |
| 검증 패턴 | 하이브리드 — 지갑(A, 결정론) + 신원·50%(B, claim) |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) |
| 상태 | STATELESS · DETERMINISTIC |
| 활성 | 전 Recipe 보편(R1·R2·R3 필수), R-XJ always-on(ADR-002) |
| 의존 부품 | A-04(신원 해소) · A-11(claim 현행성) · A-09(50% Rule 재귀 hook) · A-02(관할 축, 경계) |

## 6. 인터페이스

컨트랙트는 판정 진입점 하나와 운영자 설정 함수들로 구성된다. `user`는 매수인, `counterparty`는 매도인을 가리키며, `asset`·`amount`·`context`는 사용하지 아니한다(제재는 당사자 단위).

```solidity
// 판정 (view)
function check(address user, address counterparty, address /*asset*/, uint256 /*amount*/, bytes /*context*/)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setBlocked(address user, bool isBlocked) external;                 // 패턴 A: 온체인 SDN 지갑 집합
function setClaimRegime(bool enabled, bool enforceCounterparty) external;   // 패턴 B on/off, 상대방 claim 강제
function setClaim(address subject, ScreeningClaim claim) external;          // 신원 스크리닝 claim 기재
function setCurrentListVersion(uint32 version) external;                    // 명단 버전(구버전 claim 무효화)
function setScreeningThresholds(uint16 reviewBps, uint16 blockBps) external;// fuzzy 매칭 경계(정책값)
```

## 7. 상태 및 구성

| 요소 | 유형 | 의미 |
|---|---|---|
| `blocked[address]` | mapping→bool | 패턴 A 온체인 SDN 지갑 집합. `setBlocked`로 기재. |
| `claims[address]` | mapping→ScreeningClaim | 주체별 신원 스크리닝 claim(패턴 B). 운영자가 일괄 기재하고 `check`는 확인만. |
| `claimRegimeEnabled` | bool (기본 false) | 패턴 B 마스터 스위치. 기본값 false는 지갑 전용(legacy) 동작. |
| `enforceCounterpartyClaim` | bool (기본 false) | 참이면 상대방에게도 claim 파이프라인 적용. |
| `currentListVersion` | uint32 (기본 0) | 현행 SDN 명단 버전. claim의 버전이 다르면 stale(코드 8). |
| `reviewThresholdBps` / `blockThresholdBps` | uint16 (기본 7500/9500) | fuzzy 이름 매칭 경계. 운영자 정책값. |
| `FIFTY_PCT_BPS` | 상수 5000 | 50% Rule 기준(법정). 포함(`>=`). |

`ScreeningClaim` 구조: `exists · issuerTrusted · signatureValid · expiry · screenedListVersion · identityMatchBps · isEntity · ltStatus(LookThroughStatus) · blockedOwnershipBps`.

## 8. 기능 요구사항

- **REQ-A01-1 (양 당사자 지갑 대조).** 시스템은 매수인과 매도인의 지갑을 온체인 SDN 집합과 대조하여, 어느 한쪽이라도 등재된 경우 거래를 차단하여야 한다. 미등재 상대방(예: AMM 풀)은 통과한다.
- **REQ-A01-2 (claim 파이프라인, 조건부).** `claimRegimeEnabled`가 참인 경우, 시스템은 매수인에 대하여 항상, 상대방에 대하여는 `enforceCounterpartyClaim`이 참인 경우에 한하여 신원 스크리닝 claim을 확인하여야 한다.
- **REQ-A01-3 (claim 검증 순서).** claim 확인은 존재(코드 4) → 발급자 신뢰(5) → 서명(6) → 만료(7, 엄격 `>`) → 명단 버전(8) → 이름 매칭 경계(review 10 / block 2) → 법인 look-through 완료(9) → 합산 지분 50% 이상(3)의 순서로 하여야 한다.
- **REQ-A01-4 (50% Rule).** 법인 당사자에 대하여, look-through가 완료되지 아니하면 보류(코드 9)하고, 합산 차단지분이 5000bps(50%) 이상이면 차단(코드 3)하여야 한다.
- **REQ-A01-5 (fail-closed).** 검사 결과가 불확실한 경우 통과가 아니라 차단 또는 보류를 기본으로 하여야 한다.
- **REQ-A01-6 (STATELESS).** 시스템은 상태를 보유하지 아니한다. 판정은 거래 시점의 현행 명단·claim에 대한 스냅샷이다. 명단 갱신은 데이터 갱신이지 부품 상태가 아니다.

판정 순서(컨트랙트 `check`): 지갑(user) → 지갑(counterparty) → [regime 시] claim 파이프라인(user 항상, counterparty는 강제 시).

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(recipeId, "A-01-v1", n)`으로 인코딩하며, `n`은 walkthrough §6과 일치한다.

| n | Code | 발생 조건 | 처리 · 해제 경로 |
|---|---|---|---|
| 1 | `FAIL_SDN_WALLET_MATCH` | 지갑이 SDN 집합에 등재 | 차단 + 보고(§501.603) / 오탐이면 Compliance Release |
| 2 | `FAIL_SDN_IDENTITY_MATCH` | 이름 매칭 ≥ block 경계 | 차단 / 실제 지정자는 delisting, 오탐은 Compliance Release |
| 3 | `FAIL_50PCT_RULE` | 합산 차단지분 ≥ 50% | 차단 / 합산 오류 시 Compliance Release |
| 4 | `FAIL_NO_SANCTIONS_CLAIM` | claim 없음(regime on) | onboarding·재스크리닝 |
| 5 | `FAIL_UNTRUSTED_SANCTIONS_ISSUER` | 발급기관 미등록 | 운영자 확인 |
| 6 | `FAIL_INVALID_SANCTIONS_SIGNATURE` | 서명 무효 | 위조 가능성, 차단 |
| 7 | `FAIL_SANCTIONS_CLAIM_EXPIRED` | 만료(엄격 `>`) | 재스크리닝(A-11) |
| 8 | `FAIL_SANCTIONS_CLAIM_STALE_LIST` | 구버전 명단 기준 | 재스크리닝(명단 갱신 반영) |
| 9 | `FAIL_50PCT_LOOKTHROUGH_PENDING` | 법인 look-through 미완 | 보류(A-09 대기) |
| 10 | `REVIEW_SANCTIONS_UNCERTAIN` | 이름 매칭 [review, block) | 보류 + manual review |

거절 코드에는 근거 프로그램(`programTag`)과 차단 근거를 함께 기록하여 사후 보고(§501.603/.604)와 해제(§501.806 Compliance Release / §501.807 delisting / §501.801 specific license)가 가능하도록 한다.

## 10. Mock·Opt-in 경계 (현재 구현)

현재 컨트랙트는 walkthrough spec을 구현하되 데모를 위한 경계를 둔다. `claimRegimeEnabled`의 기본값이 false이므로 기본 동작은 지갑 전용(legacy)이며, 신원 claim 파이프라인은 명시적으로 켜야 작동한다. 또한 `enforceCounterpartyClaim`의 기본값이 false인 것은 풀·거래장 매도인이 claim을 보유하지 아니하는 mock 경계를 반영한 것으로서, 지갑 대조는 상대방에 대하여 여전히 수행된다. 실제 배포에서는 매도인 신원을 off-chain에서 먼저 해소한 뒤 claim 파이프라인을 적용한다.

## 11. 불변식

1. 매수인 또는 매도인 중 하나라도 매칭되면 거래 전체가 차단된다(fail-closed, 양 당사자).
2. 지갑 대조는 온체인 exact match로 결정론적이며 항상 수행된다.
3. 신원·50% 판정의 실질(누가 SDN인가, 소유구조)은 off-chain에서 확정되어 claim으로 들어오고, 컨트랙트는 이를 확인만 한다.
4. 50% 기준은 포함(`>=` 5000bps)이다.
5. 본 부품은 상태를 보유하지 아니한다.

## 12. 의존성

```
A-04(신원 해소) → 지갑→신원 → A-01 신원 측 대조의 전제
A-11(현행성)    → claim 만료·명단 버전 → A-01
A-09(재귀 엔진) → 50% Rule look-through hook 공유(명단은 별개) → A-01
A-02(관할 축)   → 국적·포괄 국가 제재(경계 — 둘 다 통과해야) → A-01과 상보
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 매수인 지갑이 SDN 등재 | FAIL_SDN_WALLET_MATCH |
| 2 | 매도인 지갑이 SDN 등재(매수인 clean) | FAIL_SDN_WALLET_MATCH (양 당사자) |
| 3 | 매수인 신원이 SDN과 고신뢰 매칭 | FAIL_SDN_IDENTITY_MATCH |
| 4 | 매수인 신원이 부분 유사(경계) | REVIEW_SANCTIONS_UNCERTAIN |
| 5 | 법인 매수인, 단일 차단대상 60% 보유 | FAIL_50PCT_RULE |
| 6 | 법인 매수인, 서로 다른 프로그램 차단자 각 30%(합산 60%) | FAIL_50PCT_RULE (프로그램 교차 합산) |
| 7 | 법인 매수인, 차단대상 40% 보유 | PASS (50% 미만) |
| 8 | 법인 매수인, 간접 보유(차단자→중간법인 100%→대상 51%) | FAIL_50PCT_RULE (간접 합산) |
| 9 | claim 없음(regime on) | FAIL_NO_SANCTIONS_CLAIM |
| 10 | claim 만료 | FAIL_SANCTIONS_CLAIM_EXPIRED |
| 11 | claim의 명단 버전이 구버전 | FAIL_SANCTIONS_CLAIM_STALE_LIST |
| 12 | 법인 look-through 미완 | FAIL_50PCT_LOOKTHROUGH_PENDING |
| 13 | A-13(QP)·A-03(AI) PASS이나 지갑 SDN 매칭 | FAIL_SDN_WALLET_MATCH (제재는 증권 자격과 독립) |
| 14 | 양 당사자·지갑·법인구조 모두 clean | PASS |

## 14. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 패턴 A(지갑) | 온체인 `blocked` 집합, 운영자 기재 | oracle 기반 SDN 지갑 집합 동기화 |
| 패턴 B(신원 claim) | 기본 off(`claimRegimeEnabled=false`) | Securitize 등 Trusted Issuer claim 파이프라인 상시 |
| 상대방 claim | 미강제(풀 매도인 claim 부재) | 매도인 신원 off-chain 해소 후 강제 |
| 명단 버전·임계 | 운영자 기본값 | 명단 갱신 주기·임계 정책 확정 |

## 15. 잔여 확정 항목

1. 신원 스크리닝 claim 스키마와 명단 동기화(oracle) 방식·주기.
2. fuzzy 이름 매칭 경계값(review/block)의 운영 정책(법은 50% 소유만 고정).
3. 연관 지갑 휴리스틱의 감시(F-02) 경계.
4. `programTag`·해제 경로 힌트의 보고 파이프라인(§501.603/.604) 연동.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3·§10 |
| 제5~9·11~13절 (구현) | 실장 | `Sanctions.sol` (A-01-v1) |
| 제10절 (mock 경계) | 실장 | `Sanctions.sol` 주석 |
| 제14절 (Demo/Production) | 파생·실장 | walkthrough §3.11 + 컨트랙트 기본값 |

법적 실질을 본 문서에서 임의로 수정하지 아니한다. 보경 walkthrough가 개정되면 해당 파생 절을, 컨트랙트가 변경되면 제2부를 재생성한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-01_제재-명단.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/Sanctions.sol`
- 결정: `ADR-002`(R-XJ always-on) · OD-CI-5(A-01 독립 게이트, walkthrough §10)
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 50 U.S.C. §§ 1701·1702·1705 (IEEPA) · 50 U.S.C. §§ 4301–4341 (TWEA) · 31 C.F.R. Chapter V · 31 C.F.R. Part 501 · OFAC Revised 50% Rule Guidance (2014-08-13) · OFAC VC Guidance (2021-10-15)

## C. 변경 로그

- [2026-07-22] v0.1 — 2부 구성. 제1부는 보경 walkthrough(§1·§3·§10) 기반 법률 메모 체 산문(논증 6), 제2부는 실장 컨트랙트 `Sanctions.sol` 기준(인터페이스·상태·REQ-A01-1~6·10 reason code·mock 경계). A-01은 보경 기반으로 실구현된 부품이라 제2부는 제안이 아니라 현행 계약. OD-CI-5(독립 게이트)·ADR-002(always-on) 반영.
