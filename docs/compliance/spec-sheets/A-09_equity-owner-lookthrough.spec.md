---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-09
element-name: Equity Owner Look-Through (지분 소유자 재귀 look-through)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(EquityOwnerLookThrough.sol) 기준.
substance-sot: "보경 walkthrough — Element.A-09_법인-lookthrough.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/EquityOwnerLookThrough.sol (ELEMENT_ID A-09-v1) · interfaces/compliance/ILookThroughSource.sol"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Trusted Issuer·claim·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-09, look-through, qp, ai, recursion]
---

# A-09 Equity Owner Look-Through — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-09(지분 소유자 재귀 look-through)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `EquityOwnerLookThrough.sol`(A-09-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-09는 매수인이 사람이 아니라 회사·신탁일 때, 그 법인을 블랙박스로 보지 아니하고 소유 구조를 추적하여 요구되는 각 소유자가 자격을 충족하는지를 판정하는 공유 재귀 엔진이다. 소유자가 자연인이면 A-13·A-03에 자격 판정을 위임하고, 소유자가 다시 법인이면 그 법인이 자체로 자격을 갖는지 확인하되 그 자격이 구성원에 의존하거나 급조 등의 사유가 있으면 다시 재귀한다. 부품 A-08이 법인을 분류하고 look-through가 필요한지를 판정(라우팅)하면, 본 부품이 그 look-through를 실제로 수행한다.

## 2. 규범적 근거

look-through의 뿌리는 투자회사법 §3(c)(1)(A)의 look-through 조항으로서, 100인 한도의 우회를 방지하기 위하여 의결권 증권을 보유하는 회사 등을 투시하여 그 구성원을 펀드 증권의 실질 소유자로 세도록 한다(15 U.S.C. § 80a-3(c)(1)). SEC는 이 목적을 도관(conduit)의 방지로 명시하였다(Release IC-22597). 적격구매자 맥락에서 같은 논리가 회사에 대하여는 Rule 2a51-3(17 C.F.R. § 270.2a51-3), 신탁에 대하여는 §2(a)(51)(A)(iii)로 이식되었으며, 실질 소유자의 산정은 §3(c)(1)·Rule 3c-1과 Rule 2a51-2에 의한다. 온체인이 모든 사실을 절대적으로 보장하는 것이 아니라, 합리적 신뢰 안전항(Rule 2a51-1(h)) 아래에서 Trusted Issuer의 서명된 소유 그래프가 그 합리적 믿음의 구조적 근거가 된다.

## 3. 쟁점별 논증

### 3.1 왜 별도의 재귀 부품인가

재귀 추적을 왜 분리하는지가 문제된다. 소유자 중에 또 법인이 있으면 그것도 투시하여야 하므로 이 판정은 재귀적이다. 이 재귀를 A-03·A-13·A-08 본체에서 매번 반복하지 아니하도록 하나의 원자적 엔진으로 분리한 것이 본 부품이다. 종착점은 독립적으로 자격이 확인된 소유자 노드이며, 자연인에 닿으면 그 자격 판정을 A-13·A-03에 위임한다.

### 3.2 두 축의 급조 처리 비대칭

적격투자자와 적격구매자의 look-through가 어떻게 다른지가 문제된다. 절차 구조는 같으나 급조 회사의 처리가 다르다. 적격구매자의 가족회사·기관 회사는 Rule 2a51-3이 급조라도 구성원 전원이 적격구매자이면 통과하도록 구제하나, 적격투자자의 직접 자산 경로는 조문 자체가 취득 목적 설립 아님을 요건으로 하여 급조 법인이 그 경로로 통과할 수 없고 오직 전원 적격투자자 경로((a)(8))로만 살아난다. 적격구매자 신탁은 급조이면 치유가 없다.

### 3.3 존립 위험과 합리적 신뢰

한 소유자가 왜 펀드 전체를 무너뜨리는지가 문제된다. §3(c)(7) 펀드는 모든 보유자가 취득 시점에 적격구매자여야 하므로, 여러 겹의 신탁·회사 뒤에 숨은 비적격 소유자 한 명을 놓치면 펀드 전체의 면제가 무너진다. 따라서 재귀는 요구되는 각 소유자가 독립적으로 자격이 확인될 때까지 내려가고, 전원 충족이 요구되는 구조에서는 한 명이라도 비자격이면 전체를 차단한다. 다만 이 위험을 절대적 보장 의무로 오해하여서는 아니 된다. 판정 불가(미식별·깊이 초과)는 자동 거절이 아니라 사람 검토로 보내며, 정상 구조를 데이터 미비만으로 오차단하지 아니한다.

## 4. 확정 사항 및 잔여 쟁점

재귀 look-through의 구조와 두 축의 비대칭은 위와 같이 확정되었다. 잔여로는 재귀 깊이 한계 정책, 실질 소유자 산정의 세부(Rule 2a51-2·3c-1), 그리고 look-through 중 발견되는 발행인 관계인의 처리(A-06 소관)가 있다.

---

# 제2부. 구현 명세 (컨트랙트 `EquityOwnerLookThrough.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `A-09-v1` |
| 분류 | 투자자 속성(INVESTOR_ATTRIBUTE) · 공유 재귀 엔진 |
| 검증 패턴 | 증명서형(ATTESTATION_BASED) — 재귀는 off-chain, 온체인은 결과 기록 |
| 판정 시점 | 거래 전 검증(EX_ANTE_VERIFY) · ONE_TIME |
| 상태 | STATELESS |
| 활성 | A-08·A-13·A-03이 look-through 필요 판정 시 호출. `ILookThroughSource` 구현. |
| 의존 | Trusted Issuer(소유 그래프 순회·결과 서명) · A-13·A-03(leaf 자격) · A-06(발행인 affiliate, 별개 축) |

## 6. 인터페이스

```solidity
// ILookThroughSource 구현 — 소비 부품(A-08 등)이 읽는 결과
function statusOf(address subject) external view returns (LookThroughStatus);

// 판정 (view). user = 대상 법인
function check(address user, address, address, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed). NONE 설정은 명시적 취소.
function setLookThroughStatus(address subject, LookThroughStatus status) external;
```

`LookThroughStatus`: `NONE(휴면·기록 없음) · PENDING(진행) · COMPLETED(전원 확인) · FAILED(비자격 소유자 발견)`.

## 7. 판정 규칙

온체인 부품은 소유 그래프를 순회하지 아니한다. Trusted Issuer가 off-chain에서 재귀 순회(깊이·그래프 가드, 자연인 종착, 법인 자체 자격 단축, 신탁·가족회사·급조 분기)를 수행하고, 본 부품은 그 확정 결과를 대상별로 기록하고 그에 따라 게이팅한다. NONE과 COMPLETED는 통과하고, PENDING과 FAILED는 차단한다. NONE은 look-through가 요구되었는지를 본 부품이 판단하지 아니함을 뜻하며, 그 요구 여부는 소비 부품(A-08)이 주장 범주에 따라 판단한다.

## 8. 기능 요구사항

- **REQ-A09-1 (결과 기록).** 시스템은 Trusted Issuer의 확정 재귀 결과를 대상별로 기록한다. NONE 설정은 유효한 명시적 취소이다.
- **REQ-A09-2 (게이팅).** NONE 또는 COMPLETED이면 통과, PENDING이면 대기(코드 1), FAILED이면 거절(코드 2)한다.
- **REQ-A09-3 (재귀 위치).** 소유 그래프의 순회는 off-chain에서 수행하며 온체인은 결과만 소비한다.
- **REQ-A09-4 (미판정 = 검토).** 판정 불가(미식별·깊이 초과)는 자동 거절이 아니라 검토(코드 1)로 처리한다.
- **REQ-A09-5 (소비 인터페이스).** `statusOf`로 소비 부품(A-08·A-01·A-03·A-13)에 결과를 공급한다.

## 9. reasonCode

컨트랙트는 doc §6.2의 REVIEW_*/FAIL_* 코드군을 온체인 두 결과로 collapse한다.

| n | 온체인 결과 | collapse된 doc §6.2 코드 |
|---|---|---|
| 1 | 검토·대기 | REVIEW_OWNERSHIP_GRAPH_INCOMPLETE · REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED · REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION · REVIEW_AI_LOOKTHROUGH_PENDING · REVIEW_TRUST_QP_IV_INDEPENDENT · PARTIAL_REVIEW |
| 2 | 거절 | FAIL_LOOKTHROUGH_OWNER_NOT_QUALIFIED · FAIL_AI_OWNER_NOT_ACCREDITED · FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP · FAIL_FAMILY_COMPOSITION_NOT_MET |

세분 내부 사유는 off-chain 기록에 남고, 온체인은 검토(1)와 거절(2) 두 결과로 요약한다.

## 10. 불변식

1. 본 부품은 소유 그래프를 순회하지 아니한다(결과 기록·게이팅).
2. NONE은 휴면이며, look-through 요구 여부는 소비 부품이 판단한다.
3. 판정 불가는 자동 거절이 아니라 검토이다.
4. COMPLETED만이 전원 확인을 뜻한다.

## 11. 의존성

```
Trusted Issuer(재귀 순회) → LookThroughStatus → A-09
A-13·A-03 → leaf(자연인) 자격
A-09(statusOf) → A-08·A-01·A-03·A-13(소비)
A-06 → 발행인 affiliate(look-through 중 발견 시, 별개 축)
```

## 12. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | NONE(휴면) | PASS |
| 2 | COMPLETED(전원 확인) | PASS |
| 3 | PENDING(진행) | 검토(1) |
| 4 | FAILED(비자격 소유자) | 거절(2) |
| 5 | 그래프 미완/깊이 초과 | 검토(1) — 자동 거절 아님 |
| 6 | 소비 부품(A-08)이 statusOf 조회 | 결과 공급 |

## 13. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 재귀 순회 | 운영자 `setLookThroughStatus`(결과 기재) | Trusted Issuer 소유 그래프 순회 |
| 세분 사유 | 두 결과로 collapse | off-chain 상세 기록 |
| 깊이·가드 | — | 재귀 깊이 한계 정책 |

## 14. 잔여 확정 항목

1. 재귀 깊이 한계 정책.
2. 실질 소유자 산정 세부(Rule 2a51-2·3c-1).
3. look-through 중 발행인 관계인 처리(A-06).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~12절 (구현) | 실장 | `EquityOwnerLookThrough.sol` (A-09-v1) |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.A-09_법인-lookthrough.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/EquityOwnerLookThrough.sol` · `interfaces/compliance/ILookThroughSource.sol`
- 결정: `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 80a-2(a)(51)(A)(iii)·§ 80a-3(c)(7)·§ 80a-3(c)(1) · 17 C.F.R. § 270.2a51-1(h)·§ 270.2a51-2·§ 270.2a51-3·§ 270.3c-1·§ 230.501(a)(8) · SEC Release IC-22597

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 재귀 look-through 엔진(§3(c)(1)(A) conduit 차단·IC-22597·2a51-3)·자연인 종착 위임·AI/QP 급조처리 비대칭·존립위험·합리적 신뢰(미판정→검토). 제2부: 실장 `EquityOwnerLookThrough.sol`(`ILookThroughSource`·LookThroughStatus enum·재귀는 off-chain·온체인 결과 기록·REQ-A09-1~5·코드군 2결과 collapse). A-09는 보경 기반 실구현이라 제2부는 현행 계약.
