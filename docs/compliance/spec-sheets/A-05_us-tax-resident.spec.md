---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-05
element-name: US Tax Resident Exclusion (미국 세법상 거주자 배제)
status: v0.1 (2026-07-28) — walkthrough 부재로 제1부 법리를 본 명세에서 저술함. 법률 검토(보경) 필요.
substance-sot: "없음 — 본 명세가 1차 저술. 컨트랙트 NatSpec의 설계 의도를 법리로 전개함. 확정 시 element walkthrough로 승격 예정."
implements: "src/compliance/elements/UsTaxResident.sol (ELEMENT_ID A-05-v1, 커밋 'Add A-05-v1 US tax resident compliance element (illustrative)')"
reflects-decisions: [ADR-004(pool 신규 등재 필요), ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·ONCHAINID claim·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
review-required: legal
tags: [requirement-spec, A-05, us-tax-resident, reg-s, scoping, new-element]
---

# A-05 US Tax Resident Exclusion — 요구사항 명세서

> **저술 지위 고지.** 본 부품은 대응하는 element walkthrough가 존재하지 아니한다(보경 검토본·승준 초안 모두 없음). 컨트랙트 `UsTaxResident.sol`은 개발팀이 데모용으로 선반영한 것으로서, **제1부의 법적 논증은 파생이 아니라 본 명세에서 1차 저술**하되 컨트랙트 NatSpec이 밝힌 설계 의도(IRS Substantial Presence Test에 따른 미국 세법상 거주자 배제)를 법리로 전개한 것이다. 확정에 앞서 법률 검토를 요한다(제4절). 또한 본 부품은 Element Pool Freeze v1(ADR-004)에 포함되지 아니하였으므로 신규 등재 절차를 요한다.

본 문서는 컴플라이언스 부품 A-05(미국 세법상 거주자 배제)의 요구사항 명세서이다. **제1부**는 본 부품이 강제하는 규율의 후보 법적 근거와 검토가 필요한 쟁점을, **제2부**는 실장된 컨트랙트 `UsTaxResident.sol`을 기준으로 한 구현 명세를 규정한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-05는 거래 상대방이 미국 세법상 거주자인 경우 그 거래를 차단하는 부품이다. 컨트랙트 NatSpec에 따르면 본 부품은 MVP(Phase 1·2)의 범위를 미국 세법상 거주자가 아닌 자로 한정하기 위한 것으로서, 미국 국세청의 실질적 체류 기준(Substantial Presence Test, 26 U.S.C. § 7701(b))에 따라 거주자로 판정된 자에 대하여 판정을 실패시킨다. 본 부품은 특정 증권법 요건을 직접 구현한다기보다, 초기 단계에서 미국 인적 범위(US person perimeter)를 좁혀 규제·세무 복잡성을 축소하려는 범위 설정(scoping) 성격의 부품이며, 그 정확한 법적 성격 규명은 검토 대상이다.

## 2. 규범적 근거 (후보)

미국 증권규제에서 인적 범위를 미국 밖으로 한정하는 대표적 장치는 Regulation S이다. Regulation S는 미국 밖에서 미국인(US person)이 아닌 자를 상대로 이루어지는 청약·매도에 대하여 증권법 제5조의 등록의무가 적용되지 아니하는 안전항(safe harbor)을 규정한다(17 C.F.R. § 230.901–905). 특히 발행자·시장의 성격에 따라 category 2·3의 거래 제한(transaction restrictions)과 미국인에 대한 지향적 판매 노력의 금지가 부과된다. 발행 단계에서 Regulation D 506(c)에 의존하는 자산이라도, 초기 유통을 비(非)미국인으로 한정하는 설계는 미국 내 재판매로 인한 등록의무 회귀 위험을 축소하는 방향으로 작동할 수 있다.

다만 유의할 구분이 있다. Regulation S가 말하는 미국인(US person)은 원칙적으로 거주(residence)를 기준으로 정의되는 반면(17 C.F.R. § 230.902(k)), 본 컨트랙트가 채택한 실질적 체류 기준은 연방 소득세법상의 거주자(resident alien) 판정 기준(26 U.S.C. § 7701(b))이다. 두 기준은 상당 부분 중첩하나 동일하지 아니하다. 따라서 본 부품이 세법상 거주자 기준을 미국인 배제의 대리 지표(proxy)로 사용하는 것이 Regulation S의 미국인 정의와 정합하는지, 또는 본 부품의 목적이 증권법상 인적 범위 통제가 아니라 세무·운영상(FATCA 보고·원천징수·실효연계소득 등) 복잡성 회피에 있는지는 검토를 요한다.

## 3. 쟁점별 논증

### 3.1 배제 방식: 증명 부재 통과인가, 적극 증명 요구인가

본 부품이 어떤 방식으로 배제를 강제하는지가 문제된다. 컨트랙트의 현재 구현은 운영자가 특정 지갑을 미국 세법상 거주자로 표시(flag)한 경우에만 그 지갑을 차단하고, 표시되지 아니한 기본 상태의 지갑은 통과시킨다. 즉 표시의 부재를 "미국 세법상 거주자가 아님"으로 취급하는 배제형(exclusion) 구조이다. 그러나 이는 다른 자격 부품이 채택하는 적극 증명형(Pattern B — 증명서의 존재·발급자·유효기간 확인)과 방향이 반대이며, 증명이 없을 때 차단이 아니라 통과로 귀결한다는 점에서 본 시스템의 fail-closed 원칙과 어긋난다. 컨트랙트 NatSpec 스스로 이 점을 명시하고, 상용 구현에서는 표시의 부재로부터 비거주성을 추론하는 대신 비거주성에 관한 적극적 증명(claim)을 요구하여야 한다고 밝히고 있다. 따라서 배제 방식의 전환(증명 부재 통과 → 적극 비거주 증명 요구)은 확정 전 반드시 해소되어야 할 쟁점이다.

### 3.2 판정 기준의 원천: 세법상 거주자와 온체인 증명의 접합

미국 세법상 거주자 여부를 온체인에서 어떻게 확인하는지가 문제된다. 실질적 체류 기준은 당해 연도 및 직전 2개 연도의 미국 체류 일수를 가중 합산하는 사실 판정으로서, 온체인에서 결정할 수 없다. 따라서 그 판정은 신뢰할 수 있는 발급자(Trusted Issuer, 예컨대 신원확인·세무 지위 확인을 수행하는 기관)가 오프체인에서 수행하고 그 결과를 ONCHAINID claim으로 온체인에 반영하는 구조가 되어야 한다. 현재 구현의 운영자 표시(operator flag)는 이 발급자 증명의 자리표(placeholder)이며, 상용 구현에서는 발급자·claim topic·유효기간을 갖춘 증명 확인으로 대체된다.

### 3.3 다른 인적 범위 부품과의 경계

본 부품이 A-01(제재)·A-02(국가 제한)과 어떻게 구별되는지가 문제된다. A-01은 제재 명단(OFAC) 해당 여부를, A-02는 거주 국가의 허용 여부를 각 판정한다. A-05는 그와 별개로 미국 세법상 거주자라는 특정 지위를 배제 사유로 삼는다. 세 부품은 모두 인적 범위를 좁히나 근거 규범과 판정 사실이 다르므로 독립적으로 작동하며, 어느 하나의 통과가 다른 하나의 통과를 함의하지 아니한다. 특히 A-02의 국가 기준과 A-05의 세법상 거주자 기준이 미국 관련 판정에서 중복·상충하지 아니하도록 부착 조합을 정리하는 것은 Recipe 구성의 검토 사항이다.

## 4. 저술 지위 및 검토 요청

전술한 바와 같이 본 부품은 대응 walkthrough가 없어 제1부의 논증을 본 명세에서 저술하였다. 따라서 다음 사항에 관하여 법률 검토가 필요하다. 첫째, 본 부품의 목적이 Regulation S의 미국인 배제(증권법상 인적 범위 통제)인지, 세무·운영상 복잡성 회피(비증권법적 범위 설정)인지의 성격 규명. 둘째, 세법상 거주자 기준(26 U.S.C. § 7701(b))을 미국인(17 C.F.R. § 230.902(k)) 배제의 대리 지표로 사용하는 것의 정합성. 셋째, 현재의 증명 부재 통과(fail-open) 구조를 적극 비거주 증명 요구(fail-closed, Pattern B)로 전환하여야 하는지의 확정. 넷째, A-01·A-02와의 부착 조합에서 미국 관련 판정의 중복·상충 정리. 확정된 논증은 element walkthrough로 승격하여 본 명세의 원 출처로 삼는다.

---

# 제2부. 구현 명세 (컨트랙트 `UsTaxResident.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-05-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 배제형(현재 mock) — 운영자 표시 부재 시 통과. 상용: 적극 증명형(Pattern B) |
| 판정 시점 | 사전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS · DETERMINISTIC |
| 활성 | 인적 범위 부품 — 미국 세법상 거주자 배제가 요구되는 Recipe에 부착(구성 검토 사항) |
| 의존 관계 | A-01(제재)·A-02(국가)와 독립 병렬 — 상호 함의 없음 |

`user`는 판정 대상 상대방(수신자)이다.

## 6. 판정 구조

컨트랙트는 자산이 아니라 지갑 주소에 대한 단일 불리언 표시를 저장한다.

- `usTaxResident[user]` — 해당 지갑이 미국 세법상 거주자로 표시되었는지. 기본값 `false`.
- `check`는 `passed = !usTaxResident[user]`로 판정한다. 즉 표시된 거주자만 차단하고, 표시되지 아니한 지갑은 통과한다(현재 mock의 배제형 구조 — 제3.1절의 쟁점).

## 7. 인터페이스

```solidity
// 판정 (view). user=판정 대상 상대방.
function check(address user, address, address, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator)
function setUsTaxResident(address investor, bool isResident) external; // 거주자 표시 (ONCHAINID claim의 자리표)
```

## 8. 기능 요구사항

- **REQ-A05-1 (거주자 배제).** 시스템은 상대방이 미국 세법상 거주자로 표시된 경우 차단하여야 한다(코드 1).
- **REQ-A05-2 (기본 통과 — mock 한정).** 표시되지 아니한 지갑은 통과한다. 이는 현재 데모 구현의 배제형 구조이며, 상용 구현에서는 비거주성에 관한 적극 증명의 부재를 차단으로 귀결시켜야 한다(제10절 seam·제3.1절).

## 9. reasonCode

컨트랙트는 `ReasonCodes.encode(0, "A-05-v1", n)`으로 인코딩한다. 대응 walkthrough가 없으므로 코드명은 본 명세에서 부여한다.

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `US_TAX_RESIDENT_EXCLUDED` | 상대방이 미국 세법상 거주자로 표시됨 |

## 10. Mock·Production Seam (현재 구현)

| 항목 | 현재 구현(mock) | 상용(target) |
|---|---|---|
| 판정 원천 | 운영자 표시(`setUsTaxResident`) | Trusted Issuer의 ONCHAINID claim(발급자·topic·유효기간) |
| 배제 방향 | 증명 부재 통과(fail-open) | 적극 비거주 증명 요구(fail-closed, Pattern B) |
| 판정 기준 | 세법상 거주자 표시 단일 불리언 | 세법상 거주자 기준과 Regulation S 미국인 정의의 정합 확정 후 반영 |

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 상대방이 거주자로 표시됨 | US_TAX_RESIDENT_EXCLUDED(1) |
| 2 | 상대방이 표시되지 아니함(mock 기본) | PASS(단, 상용에서는 증명 부재 차단 — 제10절) |

## 12. 잔여 확정 항목

1. 배제형(fail-open) → 적극 증명형(fail-closed, Pattern B) 전환 여부와 시점.
2. 운영자 표시 → ONCHAINID claim(발급자·topic·유효기간) 대체.
3. 세법상 거주자 기준과 Regulation S 미국인 정의의 접합(제2·3.2절).
4. A-01·A-02와의 부착 조합 정리(제3.3절).
5. 본 부품의 성격 규명(증권법상 범위 통제 vs 세무·운영상 범위 설정) — 제4절 검토 결과 반영.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 1차 저술 | 본 명세(walkthrough 부재) + `UsTaxResident.sol` NatSpec의 설계 의도 |
| 제5~11절 (구현) | 실장 | `UsTaxResident.sol` (A-05-v1) |
| 제10절 (mock/seam) | 실장 | `UsTaxResident.sol` NatSpec |

## B. 근거 문헌

- 원 출처(substance): 없음 — 본 명세가 1차 저술(법률 검토 대기).
- 구현: `src/compliance/elements/UsTaxResident.sol` (A-05-v1)
- 결정: `ADR-004`(pool 신규 등재 필요) · `ADR-006`(asset-agnostic)
- 공유 개념: `SPEC.md` (ONCHAINID claim·Trusted Issuer·경계)
- 후보 1차 출처: 17 C.F.R. § 230.901–905 · § 230.902(k) · 26 U.S.C. § 7701(b) · 15 U.S.C. § 77e (검토를 통해 확정)

## C. 변경 로그

- 2026-07-28 (v0.1) — 초안. walkthrough 부재로 제1부 1차 저술(컨트랙트 NatSpec 설계 의도 전개). `UsTaxResident.sol`(A-05-v1) 기반 제2부. 배제형 fail-open 구조·세법상 거주자 대 Regulation S 미국인 구분을 §3·§4·§10에 쟁점으로 명시. 법률 검토(보경) 대기.
