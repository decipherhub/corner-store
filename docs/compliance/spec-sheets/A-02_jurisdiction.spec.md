---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-02
element-name: Jurisdiction & Residence Gate (국가·거주 제한)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(Jurisdiction.sol, mock) 기준.
substance-sot: "보경 walkthrough — A-02_국가거주제한.md (2026-07-22). 레포 docs 교체 대상."
implements: "src/compliance/elements/Jurisdiction.sol (ELEMENT_ID A-02-v1, mock)"
reflects-decisions: [ADR-002, ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Trusted Issuer·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-02, jurisdiction, reg-s, ofac, R-XJ]
---

# A-02 Jurisdiction & Residence Gate — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-02(국가·거주 제한)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `Jurisdiction.sol`(A-02-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-02는 매수인의 관할(거주·국적, 법인이면 설립지)이 이 거래를 하여도 되는 관할인지를 거래 직전에 판정하는 부품이다. "하여도 되는 관할"의 기준은 서로 다른 두 법체계에서 동시에 나온다. 하나는 증권법으로서 어느 관할의 사람에게 매도할 자격이 있는지를 묻고, 다른 하나는 제재법으로서 어느 관할과 거래하는 것이 그 자체로 위법인지를 묻는다. 본 부품은 이 두 질문을 한 관문에서 함께 통과시켜야 거래를 허가한다.

## 2. 규범적 근거

첫째 축은 증권법의 속지주의이다. 증권법 §5의 등록 원칙은 미국 안에서 작동하며(15 U.S.C. § 77e), Regulation S는 §5가 미국 내 거래에만 적용됨을 전제로 역외 면제를 둔다(17 C.F.R. § 230.901). 그 결과 매수인이 미국인(U.S. person, 17 C.F.R. § 230.902(k))인지가 국내 면제(Reg D 506(c)) lane과 역외 면제(Reg S) lane 중 어느 쪽을 타는지를 가른다.

둘째 축은 제재법의 관할 금지이다. 증권법과 무관하게 미국은 특정 국가·지역과의 거의 모든 거래를 금지하며, 그 근거는 국제긴급경제권한법(50 U.S.C. § 1702·§ 1705)과 대적성국교역법(50 U.S.C. § 4305)이고, 재무부 해외자산통제국(OFAC)이 이를 프로그램(예: 31 C.F.R. § 560.204)으로 집행한다. 이 금지는 명단이 아니라 관할 소속으로 걸린다.

## 3. 쟁점별 논증

### 3.1 두 축의 성격 차이

두 축이 모두 관할을 보되 성격이 정반대인 점이 문제된다. 증권법 축은 매도할 자격의 문제로서, 미국인이 아니어서 차단되더라도 이는 자격 미달이 아니라 역외 lane이 아직 열리지 아니한 결과이므로 나중에 Reg S 경로를 열면 통과할 수 있는 상태이다. 반면 제재법 축은 금지의 문제로서, 포괄제재 관할에 속하면 갱신이나 재심사로 풀리지 아니하는 절대적 차단이다. 그러므로 두 축의 실패는 서로 다른 사유 코드로 분리되어야 한다. 하나는 확장 가능한 자격 lane 미개방이고, 다른 하나는 되돌릴 수 없는 제재 차단이다.

### 3.2 A-01과 A-02의 분업

같은 제재라도 A-01과 A-02의 소관이 다른 점이 문제된다. A-01은 명단 기반으로서 특정 주체가 SDN 명단에 올랐는지를 대조하고(50% Rule 포함), A-02는 관할 기반으로서 특정 국가·지역 전체에 대한 포괄제재에 매수인의 거주·설립지가 걸리는지를 본다. 명단에 이름이 없어도 관할만으로 차단될 수 있으며, 허용 관할이어도 명단에 있으면 A-01이 차단한다. 두 부품은 같은 거래에 병렬로 작동하며 서로를 대체하지 아니한다.

### 3.3 U.S. person의 판정

증권법 lane을 무엇으로 가르는지가 문제된다. Regulation S의 U.S. person 정의(17 C.F.R. § 230.902(k))가 그 기준이다. 매수인이 미국인이면 국내 lane(Reg D), 미국인이 아니면 역외 lane(Reg S)을 탄다. 거주·국적의 사실 판단은 본 부품이 직접 하지 아니하고 Trusted Issuer(Sumsub)가 KYC 과정에서 확인하여 claim으로 발급하며, 본 부품은 그 값을 허용집합·금지집합과 대조하는 결정론적 판정만 한다.

### 3.4 Phase 1 스코프와 두 실패 코드

현 단계에서 어느 관할을 여는지가 문제된다. Phase 1은 미국 적격투자자만을 대상으로 하고 역외(Reg S) lane은 유보한다. 따라서 증권법 축의 판정은 미국인이면 통과, 아니면 유보 차단으로 단순화된다. 이 유보는 자격 미달이 아니라 lane 미개방이므로 제재 차단과 구별되는 별도 코드로 표시하여, 후일 Reg S를 열 때 자연스럽게 확장되도록 한다. 제재 축은 lane과 무관하게 항상 켜지며, 포괄제재 관할이면 절대 차단한다.

### 3.5 거주 판정의 하류 소비 — D-01

본 부품의 거주 판정이 다른 부품에 어떻게 쓰이는지가 문제된다. 대상 발행인이 외국 사모발행인으로 취급되는 경우, 부품 D-01은 §12(g)/Rule 12g3-2(a)의 미국 거주 명의 보유자 300인 미만 경계를 계산하는데, 그 미국 거주 여부의 입력을 본 부품이 공급한다(17 C.F.R. § 240.3b-4(c)). 본 부품은 거주 claim의 출처이고 D-01은 그 소비처이다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 두 축 구조와 A-01과의 분업은 위와 같이 확정되었다. 다만 다음은 잔여 항목이다. 첫째, 현재 실장된 컨트랙트는 단일 허용집합 판정으로서 증권법 축과 제재법 축을 분리하지 아니하고 하나의 사유 코드만을 사용한다. 목표 규격은 두 축을 분리하여 자격 lane 미개방과 제재 차단을 각각의 코드로 표시하는 것이다. 둘째, 역외(Reg S) lane과 그 offshore transaction·directed selling efforts 요건은 Phase 1에서 유보되어 있다. 셋째, 포괄제재 금지집합은 시간에 따라 변하는 파라미터로서 운영 계층이 갱신하여야 한다.

---

# 제2부. 구현 명세 (컨트랙트 `Jurisdiction.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-02-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) |
| 검증 패턴 | 기계 판정형 · DETERMINISTIC (입력 거주·국적은 claim 의존, 하이브리드) |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) · REALTIME |
| 상태 | STATELESS |
| 활성 | R1·R2·R3 필수 부착(고재사용). R-XJ 횡단(ADR-002)의 관할 축. |
| 의존 부품 | A-01(SDN 명단, 병렬) · A-04(신원) · A-09(법인 look-through) · A-11(claim 현행성) · D-01(거주 공급) |

## 6. 인터페이스

```solidity
// 판정 (view). user = 매수인
function check(address user, address, address, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);
//   code = jurisdictionOf[user];
//   passed = code != 0 && allowedJurisdiction[code];   // fail-closed

// 운영자 설정 (onlyOperator, Governed)
function setJurisdiction(address investor, bytes32 code) external;      // production = ONCHAINID claim
function setJurisdictionAllowed(bytes32 code, bool allowed) external;   // 허용집합 큐레이션
```

## 7. 현행 구현과 목표 규격의 격차

| 항목 | 현행 `Jurisdiction.sol` | 목표 규격(보경 walkthrough) |
|---|---|---|
| 축 | 단일 허용집합(allowlist) | 축 1(증권법 허용집합) + 축 2(제재 금지집합) 분리 |
| 사유 코드 | 1(허용 아님) 단일 | 자격 lane 미개방 / 제재 차단 분리 |
| 거주 데이터 | 운영자 기재 `jurisdictionOf` | ONCHAINID claim(Sumsub) |
| Reg S | 미개방(Phase 1 유보) | 역외 lane·offshore transaction |
| 금지집합 | 없음(허용집합 밖은 일괄 실패) | Cuba·Iran·North Korea·Crimea/DNR/LNR 동적 파라미터 |

현재는 미국만 허용집합에 두는 Phase 1 단순화로서, 미국인 통과·그 외 실패가 하나의 코드로 처리된다. 목표는 제재 관할을 별도 금지집합·별도 코드로 분리하는 것이다.

## 8. 기능 요구사항

- **REQ-A02-1 (허용집합·fail-closed).** 시스템은 매수인의 관할이 기록되어 있고(0 아님) 허용집합에 속하는 경우에만 통과시켜야 한다. 관할이 없는 매수인은 통과시키지 아니한다.
- **REQ-A02-2 (증권법 축, 목표).** 미국인이면 국내 lane으로 통과, 미국인이 아니면 자격 lane 미개방으로 차단하여야 한다(Reg S 유보).
- **REQ-A02-3 (제재 축, 목표).** 포괄제재 금지집합에 속하는 관할은 lane과 무관하게 절대 차단하여야 하며, 이 차단은 갱신·재심사로 풀리지 아니한다.
- **REQ-A02-4 (코드 분리, 목표).** 자격 lane 미개방과 제재 차단을 서로 다른 사유 코드로 표시하여야 한다.
- **REQ-A02-5 (claim 의존).** 거주·국적의 사실은 Trusted Issuer claim에서 받으며, 시스템은 그 값을 집합과 대조할 뿐 사실을 재판정하지 아니한다.

## 9. reasonCode

| n | Code | 발생 조건 | 상태 |
|---|---|---|---|
| 1 | `FAIL_JURISDICTION_BLOCKED` | 관할 미기록 또는 허용집합 밖 | 현행(단일) |
| (목표) | `FAIL_JURISDICTION_NOT_ALLOWED` | 미국인 아님(Reg S 유보, 확장 가능) | 자격 lane |
| (목표) | `FAIL_SANCTIONED_JURISDICTION` | 포괄제재 관할(hard block) | 제재 축 |

## 10. claim 기반 및 D-01 공급

- **REQ-A02-6 (거주 공급).** 본 부품이 확인한 미국 거주 여부는 D-01의 §12(g)/Rule 12g3-2(a) 미국 거주 명의 보유자 300인 미만 계산의 입력이 된다.
- **REQ-A02-7 (동적 금지집합, 목표).** 포괄제재 금지집합은 운영 계층이 현행 OFAC 프로그램·행정명령에 따라 갱신한다.

## 11. 불변식

1. 관할이 없으면 통과하지 아니한다(fail-closed).
2. 증권법 축의 차단과 제재 축의 차단은 성격이 달라 코드로 구별한다(자격 lane 미개방은 확장 가능, 제재는 절대).
3. A-01(명단)과 병렬로 작동하며 서로를 대체하지 아니한다.
4. 거주·국적의 사실은 claim에서 오며 본 부품은 이를 재판정하지 아니한다.

## 12. 의존성

```
Trusted Issuer(Sumsub) → 거주·국적 claim → A-02
A-01(SDN 명단) → 병렬 AND(관할 아닌 명단 축)
A-09(법인 look-through) → 법인 매수인 설립지
A-11(claim 현행성) → 거주 claim 신선도
A-02(거주 판정) → D-01(FPI 미국 거주 300 카운트 입력)
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 관할 미기록 | FAIL_JURISDICTION_BLOCKED |
| 2 | 허용집합 밖 관할 | FAIL_JURISDICTION_BLOCKED |
| 3 | 미국 관할(허용집합) | PASS |
| 4 (목표) | 비미국인(비제재) | FAIL_JURISDICTION_NOT_ALLOWED(Reg S 유보) |
| 5 (목표) | 이란 거주 | FAIL_SANCTIONED_JURISDICTION(hard block) |
| 6 (목표) | SDN 아님이나 제재 관할 | 관할만으로 차단 |
| 7 | 허용 관할이나 SDN | A-01에서 차단(병렬) |

## 14. Demo 및 Production 범위

| 구분 | Demo (현행) | Production |
|---|---|---|
| 거주 데이터 | 운영자 `setJurisdiction` | Sumsub ONCHAINID claim |
| 축 | 단일 허용집합(미국) | 증권법·제재 두 축 분리 |
| 코드 | 단일 | 자격 lane / 제재 분리 |
| Reg S | 유보 | 역외 lane 개방 |

## 15. 잔여 확정 항목

1. 증권법 축·제재 축 분리와 두 사유 코드(자격 lane 미개방 / 제재 차단).
2. 포괄제재 금지집합의 동적 갱신(운영 계층).
3. Reg S 역외 lane(offshore transaction·directed selling efforts) 개방.
4. ONCHAINID claim 연동(현재 운영자 기재).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5·6·8·9절 (구현) | 실장 | `Jurisdiction.sol` (A-02-v1) |
| 제7·15절 (격차·목표) | 실장·목표 | `Jurisdiction.sol` + 보경 walkthrough |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `A-02_국가거주제한.md` (2026-07-22) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/Jurisdiction.sol`
- 결정: `ADR-002`(R-XJ) · `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 77e·§ 77d(b) · 17 C.F.R. § 230.506(c)·§ 230.901·§ 230.902(k)·(h)·(c)·§ 230.903·904·§ 240.3b-4(c) · 50 U.S.C. § 1702·§ 1705·§ 4305(b) · 31 C.F.R. § 560.204 · E.O. 13685·14065 · Morrison v. National Australia Bank, 561 U.S. 247 (2010)

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 두 축(증권법 Reg S/Reg D·U.S. person 902(k) / 제재법 IEEPA·OFAC 포괄제재), A-01(명단) 분업, Phase 1 미국인 한정·Reg S 유보, 두 실패코드 분리, 거주→D-01 공급. 제2부: 실장 `Jurisdiction.sol`(mock — 단일 allowlist·fail-closed·reason code 1)과 목표(두 축·두 코드·동적 금지집합)의 격차 명시.
