---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: B-03
element-name: Transfer Restriction Metadata (이전제한 메타데이터)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(TransferRestrictionMetadata.sol) 기준.
substance-sot: "보경 walkthrough — Element.B-03_이전제한-메타데이터.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/TransferRestrictionMetadata.sol (ELEMENT_ID B-03-v1)"
reflects-decisions: [ADR-004, ADR-006]
umbrella: "SPEC.md — 공유 개념(Manifest·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, B-03, transfer-restriction, legend, R1, R2]
---

# B-03 Transfer Restriction Metadata — 요구사항 명세서

본 문서는 컴플라이언스 부품 B-03(이전제한 메타데이터)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `TransferRestrictionMetadata.sol`(B-03-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 자산 신상카드(Manifest)에 실린 제한 선언, 즉 디지털 legend가 존재·정합·완비되어 있는지를 판정하며, 개별 거래의 재판매 적법성은 판정하지 아니한다(그것은 C-00·C-01의 소관).

---

# 제1부. 법적 근거 및 논증

## 1. 개요

B-03은 자산의 신상카드에 법이 요구하는 이전제한의 선언이 실려 있고 완비되어 있는지를 거래 직전에 판정하는 부품이다. 종이 시대에 증서 표면에 찍히던 제한 문구(restrictive legend)의 카드 기재판을, 존재·정합·완비·근거의 축으로 검사한다. 이 선언의 값을 부품 C-00(전매경로)과 C-01(보유기간)이 읽어 개별 거래를 판정하므로, 본 부품은 선언과 소비를 분리한다.

## 2. 규범적 근거

증권법 §5의 등록 원칙을 기본값으로 하여(15 U.S.C. § 77e), Rule 144(a)(3)이 제한증권의 지위를 문언으로 정의하고 특히 Reg D Rule 502(d) 취득분을 명시적으로 제한증권으로 지정한다(17 C.F.R. § 230.144(a)(3)(ii)). Rule 502(d)(3)은 그 지위를 증권을 표창하는 문서에 표시(legend)하도록 명령하며(17 C.F.R. § 230.502(d)), §4(e)(1)(C)는 그 지위가 적법한 재판매를 거쳐도 유지됨을 못박는다(15 U.S.C. § 77d). 선언에 담길 값의 법정 기준은 Rule 144(d)(1)의 보유기간(보고 6개월·비보고 1년)과 144(b)(1)의 경로 구조에서 나오며, 제한 해제의 유일한 출구는 Rule 144 Preliminary Note가, 그 기록 요구는 SEC v. Ralston Purina Co.가 뒷받침한다. 제한 해제(legend 제거)는 발행인 동의와 명의개서대리인의 확인으로만 가능하다는 것이 확립된 실무이다.

## 3. 쟁점별 논증

### 3.1 restricted는 선택이 아니라 사실이다

restrictedFlag를 발행자가 임의로 정할 수 있는지가 문제된다. Reg D 506(c) 취득분은 Rule 144(a)(3)(ii)의 문언상 제한증권이므로, 카드의 restrictedFlag가 참인 것은 발행자의 선택이 아니라 사실의 기재이다. 거짓으로 실려 있으면 그 자체가 카드 오류이다.

### 3.2 형제 부품과의 분업

같은 이전제한이라는 말이 세 부품에 걸쳐 혼동을 낳는다. 본 부품은 제한의 선언(카드 기재가 법정 최소 내용을 갖췄는가)을 보고, B-02는 그 선언이 가리키는 집행 기계(ERC-3643 이전제한 컨트랙트)의 실재·작동을 보며, B-01은 선언이 실린 카드 자체의 무결성을 본다. 본 부품은 태그의 값이 법과 정합함을 보증할 뿐 그 태그로 개별 거래를 판정하지 아니한다.

### 3.3 방향 검사와 집합 소속

태그를 어떻게 검사하는지가 문제된다. 지위·기간의 정합은 크기 비교가 아니라 방향 검사와 집합 소속이다. 보유기간은 Rule 144(d)(1)이 정확히 두 값(6·12개월)만을 두므로 집합 소속으로 판정하고, 지위·기간의 모순은 완화 방향만을 차단한다. 즉 요구 지위보다 느슨하게 실린 선언은 차단하고, 더 엄격하게 실린 선언은 통과시킨다.

## 4. 확정 사항 및 잔여 쟁점

제한 선언의 검사 구조와 방향 규칙은 위와 같이 확정되었다. 잔여로는 재판매 경로 태그의 확정값(Q-B1, C-00·변호사 트랙)과 강화 과잉 선언에 대한 검토 큐 처리가 있다.

---

# 제2부. 구현 명세 (컨트랙트 `TransferRestrictionMetadata.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `B-03-v1` |
| 분류 | 자산 속성(ASSET_ATTRIBUTE) — `asset`을 검사 |
| 검증 패턴 | 기계 판정형 · DETERMINISTIC |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) · ONE_TIME |
| 상태 | STATELESS |
| 활성 | R1·R2 필수(제한 지위는 발행 순간 생겨 전 수명 유지). |
| 소비자 | C-00(enabledResalePaths) · C-01(holdingPeriodMonths·reportingStatus) |

## 6. 인터페이스

```solidity
// 판정 (view). asset을 검사(user/counterparty 무시)
function check(address, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setDeclaration(address asset, RestrictionDecl decl) external;
function setRequiresRestricted(bytes32 issuanceFramework, bool required) external;  // 카드 밖 거버넌스 상수
function setValidPathsMask(uint32 mask) external;
function setApprovedUnrestrictBasis(bytes32 basisRef, bool approved) external;
```

`RestrictionDecl`: `declared(3-상태 존재 플래그) · restrictedFlag · issuanceFramework · enabledResalePaths(비트마스크) · holdingPeriodMonths({6,12}) · reportingStatus · currentInfoRequired · legendRef · classRef · legalClassId · unrestrictBasisRef`. 지위 도출·유효 경로·승인 해제근거는 자기참조 방지를 위해 카드 밖 거버넌스 상수로 둔다.

## 7. 기능 요구사항 (게이트 ①~⑤)

- **REQ-B03-1 (① 존재).** 선언 블록이 기재되지 아니하면 차단한다(코드 1). 미기재는 거짓과 다른 별개의 실패이다.
- **REQ-B03-2 (② 지위 정합).** 발행 프레임워크가 제한을 요구하는데 restrictedFlag가 거짓이면 차단한다(코드 2, 완화 방향만). 요구가 없는데 참인 강화 선언은 통과한다.
- **REQ-B03-3 (③ 태그 완비·유효).** restrictedFlag가 참인 경우, 경로가 비었으면(코드 3), 유효 마스크 밖 값이면(코드 4), 보유기간이 {6,12} 밖이면(코드 4), reportingStatus가 UNSET이면(코드 3), classRef≠legalClassId이면(코드 3), legendRef가 없으면(코드 3) 차단한다.
- **REQ-B03-4 (④ 내적 정합).** 비보고인데 6개월(완화)이면 차단하고(코드 5), 보고-90일인데 현재정보요구가 거짓이면 차단한다(코드 5). 비보고인데 현재정보요구가 참인 강화 과잉 선언은 차단하지 아니하고 검토로 넘긴다(view 제약으로 이벤트는 생략, 비차단 동작은 보존).
- **REQ-B03-5 (⑤ 해제 근거).** restrictedFlag가 거짓인 경우, 해제 근거가 없거나 승인 사슬에 없으면 차단한다(코드 6).

## 8. reasonCode

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `RESTRICTION_DECL_MISSING` | 선언 블록 부재 |
| 2 | `RESTRICTION_STATUS_CONFLICT` | 요구=참·flag=거짓(완화) |
| 3 | `RESTRICTION_TAGS_INCOMPLETE` | 필수 태그 비었음/불일치 |
| 4 | `RESTRICTION_TAG_INVALID` | 태그 값이 법정 집합 밖 |
| 5 | `RESTRICTION_TAG_CONFLICT` | 태그 간 완화 방향 모순 |
| 6 | `UNRESTRICT_BASIS_MISSING` | 해제 근거 없음/미승인 |

## 9. 불변식

1. restrictedFlag=참은 사실 기재이며, 미기재는 거짓과 별개 실패이다.
2. 지위·기간의 검사는 완화 방향만 차단하고 강화는 통과한다.
3. 보유기간은 집합 소속({6,12})으로 판정하며 크기 비교가 아니다.
4. 지위 도출·유효 경로·해제 근거는 카드 밖 거버넌스 상수이다(자기참조 방지).
5. 본 부품은 태그를 보증할 뿐 개별 거래를 판정하지 아니한다(C-00·C-01 소비).

## 10. 의존성

```
Manifest → RestrictionDecl → B-03
거버넌스 상수 → requiresRestricted·validPathsMask·approvedUnrestrictBasis → B-03
B-03(검증된 태그) → C-00(경로)·C-01(기간) 소비
B-01(카드 무결성) 직후 → B-03(카드의 제한 기재)
```

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 선언 미기재 | RESTRICTION_DECL_MISSING(1) |
| 2 | 요구=참, flag=거짓 | RESTRICTION_STATUS_CONFLICT(2) |
| 3 | 경로 비었음 | RESTRICTION_TAGS_INCOMPLETE(3) |
| 4 | 보유기간 9 | RESTRICTION_TAG_INVALID(4) |
| 5 | 비보고 + 6개월 | RESTRICTION_TAG_CONFLICT(5) |
| 6 | 비보고 + 현재정보요구=참(강화) | PASS(검토, 비차단) |
| 7 | flag=거짓 + 미승인 해제근거 | UNRESTRICT_BASIS_MISSING(6) |
| 8 | 완비·정합 선언 | PASS |

## 12. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 선언 | 운영자 `setDeclaration` | Manifest 카드 |
| 거버넌스 상수 | 운영자 설정 | 거버넌스 |
| 검토 큐 이벤트 | view 제약으로 생략 | 이벤트/큐 인프라 |
| 경로 확정 | Q-B1 미결 | C-00·변호사 확정값 |

## 13. 잔여 확정 항목

1. 재판매 경로 확정값(Q-B1, C-00·변호사).
2. 강화 과잉 선언 검토 큐 처리(view 제약).
3. 해제 근거 승인 사슬 운영.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~11절 (구현) | 실장 | `TransferRestrictionMetadata.sol` (B-03-v1) |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.B-03_이전제한-메타데이터.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/TransferRestrictionMetadata.sol`
- 결정: `ADR-004` · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 77e·§ 77d(a)(7)·(d)·(e) · 17 C.F.R. § 230.144(a)(3)·§ 230.502(d)(3)·§ 230.144(d)(1)·§ 230.144(b)(1) · SEC v. Ralston Purina Co., 346 U.S. 119 (1953) · SEC, "Rule 144: Selling Restricted and Control Securities"

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 디지털 legend(Rule 502(d)(3))·restricted=사실(144(a)(3)(ii))·B-02/B-01 분업·방향검사(완화 FAIL/강화 PASS)·집합소속({6,12})·C-00/C-01 공급. 제2부: 실장 `TransferRestrictionMetadata.sol`(RestrictionDecl·게이트 ①~⑤·거버넌스 상수 off-card·REQ-B03-1~5·6 reason code·view 제약 이벤트 생략). B-03은 보경 기반 실구현이라 제2부는 현행 계약.
