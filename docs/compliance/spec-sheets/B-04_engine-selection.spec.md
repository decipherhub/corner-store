---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: B-04
element-name: Engine Selection (엔진 선택)
status: v1.0 (2026-07-22) — 보경 walkthrough 기반. Part II는 실장 컨트랙트(EngineSelection.sol) 기준.
substance-sot: "보경 walkthrough — Element.B-04_엔진-선택.md (2026-07-08). 레포 docs 교체 대상."
implements: "src/compliance/elements/EngineSelection.sol (ELEMENT_ID B-04-v1)"
reflects-decisions: [ADR-004, ADR-005, ADR-006]
umbrella: "SPEC.md — 공유 개념(Manifest·ComplianceContext·경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, B-04, engine-selection, manner-of-sale, R1, R2]
---

# B-04 Engine Selection — 요구사항 명세서

본 문서는 컴플라이언스 부품 B-04(엔진 선택)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 실장 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의하며, 제2부는 레포에 실장된 컨트랙트 `EngineSelection.sol`(B-04-v1)을 기준으로 한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

B-04는 이 거래가 이 자산에서 법이 허용하는 방식(체결 엔진)으로 체결되는지를 거래 직전에 판정하는 부품이다. 같은 자산·같은 당사자·같은 수량이라도 어떤 체결 기계를 타느냐에 따라 적법과 위법이 갈린다. 무엇을 파는가(자산 카드, B-01·B-03)와 누가 사고파는가(A 계열)만으로는 판정이 완결되지 아니하고, 어떻게 파는가라는 셋째 축이 남으며 그 축이 곧 엔진이다.

## 2. 규범적 근거

증권법 §5의 등록 원칙 아래(15 U.S.C. § 77e), 두 재판매 면제가 매도 방식에 요건을 건다. Rule 144는 계열자의 매도에 대하여 매도 방식(manner of sale)을 세 가지로 제한하며(17 C.F.R. § 230.144(f): 중개인 거래·시장조성자 직접 거래·무위험 본인 거래), 그 시장조성자의 정의는 §3(a)(38)에 의한다(15 U.S.C. § 78c(a)(38)). 비계열자의 매도에는 이 방식 요건이 적용되지 아니한다. §4(a)(7)의 사적 재판매는 매도인의 무권유(no general solicitation)를 요건으로 한다(15 U.S.C. § 77d(d); Rule 502(c)와 같은 문언). 이 요건들은 DEX에서 곧바로 엔진의 속성으로 번역된다.

## 3. 쟁점별 논증

### 3.1 세 엔진의 법적 프로필

세 엔진이 어떤 법적 지위에 서는지가 문제된다. RFQ는 매도인이 특정 상대에게 견적을 요청하는 1-hop 구조로서, 상대방이 시장조성자이면 Rule 144(f)의 시장조성자 직접 거래에 문언 그대로 부합하고, 특정 상대에 대한 표적 요청이라 무권유에도 부합한다. 오더북은 등록 중개인을 전제로 하는 중개인 거래 갈래가 현행 아키텍처에서 닫혀 있고 폐쇄 멤버십 게시의 성격이 미확정이다. AMM은 풀이 상대방으로서 시장조성자 전제가 성립하지 아니하여 어느 매도 방식에도 해당하지 아니하며, 상시 양방향 노출이 표적 요청의 반대극이다.

### 3.2 두 층의 판정

엔진 적법성을 어떻게 판정하는지가 문제된다. 자산 레벨에서 시스템이 열어 둔 엔진 집합을 선언하고, 거래 레벨에서 그 거래의 사실관계(경로·계열 여부)가 그 집합을 추가로 좁힌다. 중요한 것은 overlay가 선언 집합을 좁히기만 할 뿐 선언되지 아니한 엔진을 열지 아니한다는 것이며, 경로 overlay와 계열 overlay가 함께 활성이면 두 요건을 모두 충족(교집합)하여야 한다.

### 3.3 보수적 기본값과 존립 위험

미확정 조합을 어떻게 처리하는지가 문제된다. 계열 매도가 방식 요건 밖의 엔진으로 체결되면 그 거래는 Rule 144의 안전항을 잃고 매도인이 인수인 취급의 사정권으로, 거래가 §5의 사정권으로 들어간다. 거래장의 성격규명(중개업자·대체거래시스템)이 미해결인 국면에서, 계열 분매·권유성 재판매를 엔진 차원에서 구조적으로 차단해 온 기록은 방어의 토대가 된다. 그러므로 법적 부합이 확정된 엔진만 열고 미확정 조합은 막은 채 변호사 확인으로 연다.

## 4. 확정 사항 및 잔여 쟁점

엔진 = 매도 방식의 대응과 두 층 판정은 위와 같이 확정되었다. 잔여로는 중개인 거래·무위험 본인 거래 갈래의 개방(등록 중개인·SRO 보고 경로 필요), 오더북의 폐쇄 멤버십 게시 성격, 거래장 성격규명(BD/ATS)이 있다.

---

# 제2부. 구현 명세 (컨트랙트 `EngineSelection.sol` 기준)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `B-04-v1` |
| 분류 | 재판매 거래(RESALE_TRANSACTION) · REALTIME |
| 검증 패턴 | 기계 판정형 · DETERMINISTIC (집합 소속). 상대방 시장조성자 자격만 off-chain claim |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) + 상장 시점 선언 검사 |
| 상태 | STATELESS |
| 활성 | R1·R2 필수. `ComplianceContext`를 디코드하는 유일한 부품. |
| 의존 | A-06(계열 flag) · C-00(경로) · A-11(MM claim 만료) · B-02(엔진 프로브) |

엔진 비트마스크는 `VenueType`을 따른다: AMM=bit0(0x01), ORDER_BOOK=bit1(0x02), RFQ=bit2(0x04). `ComplianceContext`에서 `venueType`(엔진)·`sellerIsAffiliate`·`buyer`(MM claim 대상)를 읽는다.

## 6. 인터페이스

```solidity
// 판정 (view). context = abi.encode(ComplianceContext)
function check(address, address, address asset, uint256, bytes context)
    external view returns (bool passed, bytes32 reasonCode);
// 상장 시점 선언 검사(V1/V2)
function validateEngineDeclaration(address asset) external view returns (bool ok, bytes32 reasonCode);

// 운영자 설정 (onlyOperator, Governed)
function setSupportedEngines(address asset, uint8 engines) external;   // 카드 선언
function setSec4a7Path(address asset, bool active) external;           // C-00 경로(mock)
function setDebtSecurity(address asset, bool isDebt) external;         // 144(f)(3)(ii) carve-out
function setMarketMakerClaim(address buyer, bool hasClaim) external;   // MM claim(mock)
function setNoGsEngineSet(uint8 engineSet) external;                   // §4(a)(7) 무권유 집합(거버넌스)
function setAffiliateEngineSet(uint8 engineSet) external;              // 144(f) 계열 집합(거버넌스)
```

거버넌스 집합(`noGsEngineSet`·`affiliateEngineSet`)은 현재 {RFQ}로 초기화되며, 중개인·무위험 본인 갈래는 등록 중개인·SRO 경로가 생길 때까지 닫혀 있다.

## 7. 기능 요구사항 (게이트 G①~G⑤)

- **REQ-B04-1 (G① 선언 재검사).** 선언 엔진 집합이 비었으면 차단하고(코드 1), 유효 집합 밖 비트가 있으면 차단한다(코드 2). 상장 시점과 거래 시점 사이의 드리프트를 잡기 위해 거래 시점에 재검사한다.
- **REQ-B04-2 (G② 엔진 식별).** 컨텍스트가 디코드 불가 길이이면 엔진을 식별할 수 없으므로 차단한다(코드 3, fail-closed).
- **REQ-B04-3 (G③ 선언 소속).** 거래 엔진이 카드 선언 집합에 없으면 차단한다(코드 4).
- **REQ-B04-4 (G④ 경로 overlay).** §4(a)(7) 경로이면 엔진이 무권유 집합에 없을 때 차단한다(코드 5). Rule 144 비계열 경로는 방식·권유 축이 없다(비대칭).
- **REQ-B04-5 (G⑤ 계열 overlay).** 매도인이 계열자이고 채무증권이 아니면, 엔진이 계열 방식 집합에 없을 때 차단하고(코드 6), RFQ이면 상대방의 시장조성자 claim이 없을 때 차단한다(코드 7). 채무증권은 144(f)(3)(ii)로 전면 면제된다.
- **REQ-B04-6 (교집합).** overlay는 선언 집합을 좁히기만 하며, 경로·계열 overlay가 함께 활성이면 엔진은 두 요건을 모두 충족(교집합)하여야 한다.

## 8. reasonCode

| n | Code | 발생 조건 |
|---|---|---|
| 1 | `FAIL_ENGINE_DECL_MISSING` | 선언 집합 비었음 |
| 2 | `FAIL_ENGINE_DECL_INVALID` | 유효 집합 밖 비트 |
| 3 | `FAIL_ENGINE_UNKNOWN` | 엔진 식별 불가(fail-closed) |
| 4 | `FAIL_ENGINE_NOT_SUPPORTED` | 카드 선언 집합 밖 |
| 5 | `FAIL_ENGINE_PATH_INCOMPATIBLE` | §4(a)(7) 무권유 집합 밖 |
| 6 | `FAIL_ENGINE_AFFILIATE_INCOMPATIBLE` | 계열 방식 집합 밖 |
| 7 | `FAIL_ENGINE_MM_CLAIM_MISSING` | RFQ 상대방 시장조성자 claim 없음 |

## 9. 불변식

1. 엔진(호출 경로)이 곧 법적 매도 방식이다.
2. overlay는 좁히기만 하며 선언되지 아니한 엔진을 열지 아니한다(교집합).
3. 비계열 Rule 144 경로에는 방식·권유 축이 없다(비대칭).
4. 채무증권은 계열 방식 요건에서 면제된다.
5. 법적 부합이 확정된 엔진 집합만 열려 있다(현재 {RFQ}).

## 10. 의존성

```
ComplianceContext → venueType·sellerIsAffiliate·buyer → B-04
A-06 → sellerIsAffiliate
C-00 → sec4a7Path
A-11 → MM claim 만료
Manifest → supportedEngines
거버넌스 → noGsEngineSet·affiliateEngineSet
```

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 선언 비었음 | FAIL_ENGINE_DECL_MISSING(1) |
| 2 | 컨텍스트 짧음 | FAIL_ENGINE_UNKNOWN(3) |
| 3 | 엔진이 선언 밖 | FAIL_ENGINE_NOT_SUPPORTED(4) |
| 4 | §4(a)(7) + AMM | FAIL_ENGINE_PATH_INCOMPATIBLE(5) |
| 5 | 계열 + AMM | FAIL_ENGINE_AFFILIATE_INCOMPATIBLE(6) |
| 6 | 계열 + RFQ + MM claim 없음 | FAIL_ENGINE_MM_CLAIM_MISSING(7) |
| 7 | 계열 + RFQ + MM claim 있음 | PASS |
| 8 | 계열 채무증권 + AMM | PASS(144(f)(3)(ii) 면제) |
| 9 | 비계열 + 선언된 엔진 | PASS(방식 축 없음) |

## 12. Demo 및 Production 범위

| 구분 | Demo (현재) | Production |
|---|---|---|
| 선언·경로·MM | 운영자 setter | Manifest·C-00·A-11 |
| 방식 집합 | {RFQ} 고정 | 등록 중개인·SRO 경로 시 확장 |
| 검사 이벤트 | view 제약으로 생략 | 감사 이벤트 인프라 |

## 13. 잔여 확정 항목

1. 중개인 거래·무위험 본인 갈래 개방(등록 중개인·SRO).
2. 오더북 폐쇄 멤버십 게시 성격.
3. 거래장 성격규명(BD/ATS).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제5~11절 (구현) | 실장 | `EngineSelection.sol` (B-04-v1) |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `Element.B-04_엔진-선택.md` (2026-07-08) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/EngineSelection.sol`
- 결정: `ADR-004` · `ADR-005`(§4(a)(7)) · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2절
- 1차 출처: 15 U.S.C. § 77e·§ 77d(a)(7)·(d)·§ 78c(a)(38) · 17 C.F.R. § 230.144(b)(1)·(2)·(f)·(g)·§ 230.502(c) · SEC Release 33-8869

## C. 변경 로그

- [2026-07-22] v1.0 — 보경 검토본 기반. 제1부: 엔진 = 매도 방식(Rule 144(f)/§4(a)(7)(d)(2))·세 엔진 프로필(RFQ/OB/AMM)·두 층(자산선언+거래 overlay)·보수적 기본값. 제2부: 실장 `EngineSelection.sol`(VenueType bitmask·ComplianceContext 디코드·게이트 G①~G⑤·overlay 교집합·거버넌스 set {RFQ}·debt carve-out·REQ-B04-1~6·7 reason code). B-04는 보경 기반 실구현이라 제2부는 현행 계약.
