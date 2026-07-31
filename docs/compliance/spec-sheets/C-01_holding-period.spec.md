---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: C-01
element-name: Holding Period (보유기간)
status: v1.0 (2026-07-22) — 보경 walkthrough 재작성본. Part II는 실장 컨트랙트(Lockup.sol, 현재 skeleton) 기준. v0.1(승준 staging 기반) 대체.
substance-sot: "보경 walkthrough — C-01_보유기간.md (2026-07-21). 레포 docs 교체 대상."
implements: "src/compliance/elements/Lockup.sol (ELEMENT_ID C-01-v1, 현재 skeleton) · interfaces/compliance/IAcquisitionSource.sol"
reflects-decisions: [ADR-005, ADR-006, ADR-008(D-A)]
umbrella: "SPEC.md — 공유 개념(ERC-3643·Element/Recipe/Manifest·경계)은 여기에 의한다"
stateful: false
supersedes: "동 파일 v0.1 (승준 staging walkthrough 기반) — 출처 오류로 폐기"
tags: [requirement-spec, C-01, holding-period, rule-144, R2, rebased-bogyeong]
---

# C-01 Holding Period — 요구사항 명세서

> **재작성 고지.** 종전 버전(승준 staging walkthrough 기반)을 폐기하고 **보경 변호사 검토본(2026-07-21)**을 법적 실질의 출처로 재작성한 것이다. 제2부는 레포에 실장된 컨트랙트 `Lockup.sol`을 기준으로 하되, 현재 이 컨트랙트는 **skeleton**이므로 현행 구현과 목표 규격을 함께 명시한다. ADR-008(D-A)의 취득 출처 결정은 본 부품의 `IAcquisitionSource` seam과 정합한다(제4·10절).

본 문서는 컴플라이언스 부품 C-01(보유기간)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

C-01은 매도 대상 물량을 지금 매도하여도 될 만큼 오래 보유하였는지를 거래 직전에 계산하는 부품이다. 자격도 신원도 물량도 보지 아니하고 오직 시간을 본다. 제한증권을 Rule 144 경로로 재매각하려면 취득 시점부터 소정의 보유기간이 경과하여야 하며, 본 부품은 그 경과 여부를 날짜 계산으로 판정한다.

## 2. 규범적 근거

증권을 파는 행위의 기본값은 금지이다. 1933년 증권법 §5는 등록 없는 매도를 금지한다(15 U.S.C. § 77e). 재판매에서 원용하는 면제는 §4(a)(1), 즉 발행인·인수인·딜러가 아닌 자의 거래이다(15 U.S.C. § 77d(a)(1)). 그런데 §2(a)(11)은 인수인을 "유통을 목적으로(with a view to distribution) 발행인으로부터 취득한 자"까지 넓게 정의하므로(15 U.S.C. § 77b(a)(11)), 유통 목적으로 산 자는 인수인이 되어 §4(a)(1) 면제를 잃고 그 매도는 §5 위반이 된다.

문제는 유통 목적이 사람의 내심이어서 거래 시점에 확인할 수 없다는 데 있다. Rule 144는 내심을 묻는 대신 내심을 대신 증명할 객관적 기준을 정하며, 그 첫째 기준이 보유기간이다(17 C.F.R. § 230.144(d)). 상당한 기간의 보유는 매도인이 유통 의도가 아니라 투자의 경제적 위험을 인수하였음을 나타내는 지표로 기능한다.

## 3. 쟁점별 논증

### 3.1 Rule 144는 면제가 아니라 간주이며 배타적이지 아니하다

Rule 144의 성격이 문제된다. Rule 144는 그 자체로 §5의 면제가 아니라 매도인을 인수인이 아닌 것으로 간주하는 안전항이며, 그 간주에 힘입어 §4(a)(1) 면제를 원용하게 하는 구조이다. 또한 Rule 144는 배타적이지 아니하므로, 보유기간을 충족하지 못하였다고 하여 그 증권을 영영 매도할 수 없는 것이 아니라 §4(a)(7) 등 다른 통로가 열려 있을 수 있다. 그 통로의 선택은 본 부품이 아니라 부품 C-00(전매경로 선택기)이 하며, 본 부품은 C-00이 Rule 144 경로를 확정한 뒤에만 작동한다. 나아가 기술적으로 요건을 충족하더라도 등록 회피 계획의 일부인 거래에는 안전항이 적용되지 아니하므로, 본 부품의 통과는 시간축 조건의 충족일 뿐 안전항의 종국적 확정이 아니다.

### 3.2 6개월과 1년의 분기 — 공시 격차

보유기간이 왜 둘로 갈리는지가 문제된다. 그 기준은 매도인이 아니라 발행인이 증권거래법상 보고회사인지이다. 보고회사의 증권은 6개월이고(Rule 144(d)(1)(i)), 비보고회사의 증권은 1년이다(동 (d)(1)(ii)). SEC는 그 논거로, 보고회사는 감사받은 재무정보를 포함한 정기보고서를 EDGAR에 공개할 의무가 있어 6개월이면 투자의 경제적 위험 인수를 나타내기에 충분한 반면, 비보고회사의 공개 정보는 그 범위가 제한적이어서 1년의 보유가 투자자 보호에 부합한다고 밝혔다(SEC Release 33-8869, II.B.1). 대상 자산은 비보고 사모 펀드이므로 기본값은 1년이다.

### 3.3 계열과 비계열 — 기간은 같고 조건의 개수가 다르다

계열자에게 더 긴 보유기간이 요구되는지가 문제된다. Rule 144(d)의 보유기간은 계열 여부와 무관하게 동일하다. 계열자에게 더해지는 것은 기간이 아니라 조건의 개수로서, 현재 공시정보(c)·물량 한도(e)·매도 방법(f)·(g)·Form 144(h)가 병행하여 요구되며 이들은 각각 다른 부품의 소관이다. 특히 비보고회사의 비계열 매도인에게는 Rule 144의 조건이 (d) 하나뿐이다(Rule 144(b)(1)(ii)의 단수 "condition of paragraph (d)"). 따라서 대상 자산의 일반 보유자에게 Rule 144 재매각이란 사실상 본 부품 하나를 통과하는 것이며, 여기에서 R2 Recipe 내 본 부품의 무게가 나온다.

### 3.4 시계는 정지하지 아니한다

보유기간의 시계가 헤지 등으로 정지하는지가 문제된다. SEC는 2007년 개정에서 정지(tolling) 조항을 제안하였으나 이를 채택하지 아니하였다(Release 33-8869). 따라서 현행 Rule 144에는 tolling이 없으며, 구현에 정지 로직을 넣으면 법과 어긋난다. 시계는 취득 시점부터 중단 없이 흐른다.

### 3.5 존립 위험 — 명시적 사적 소권

본 부품의 오작동이 어떠한 결과를 낳는지가 문제된다. 기간 미달 물량이 Rule 144 경로로 매도되면 안전항이 적용되지 아니하여 매도인이 인수인으로 남을 수 있고, 이는 §4(a)(1) 면제 상실과 §5 위반으로 이어진다. 여기에서 증권법 축의 강제력이 투자회사법 축과 결정적으로 다르다. 투자회사법 §47(b)의 사적 소권은 2026년 *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*로 부정되었으나(A-13 참조), 증권법 §12(a)(1)은 판례가 읽어낸 묵시적 소권이 아니라 의회가 조문에 직접 새긴 명시적 소권이다(15 U.S.C. § 77l(a)(1)). 매수인은 지급한 대가와 이자의 반환을 직접 청구할 수 있다. 즉 재판매 경로에서 시간축을 틀리면 그 손해를 청구할 상대방이 조문상 이미 정해져 있으며, DEX에서는 그 매수인이 익명의 다수이다. 그러므로 본 부품의 기본 자세는 의심스러우면 차단이고, 판정 불가 시의 기본값은 더 긴 쪽(1년)이다.

### 3.6 활성화와 상태 의존

본 부품이 언제 작동하고 어디에 의존하는지가 문제된다. 본 부품은 C-00이 확정한 경로가 Rule 144인 경우에만 작동한다. §4(a)(7)·Rule 144A·Reg S 경로에서는 각 경로의 요건이 다르므로 작동하지 아니한다. 또한 본 부품은 자체 누적 상태를 보유하지 아니하는 무상태 부품이나, 취득 사실을 외부 취득 원장(Acquisition Registry, CR-3)에서 읽는 데 그 정확성 전체를 의존한다. 상태를 갖지 아니하되 상태에 기댄다.

### 3.7 기산점과 승계

시계를 언제부터 세는지가 문제된다. 보유기간은 발행인 또는 계열자로부터 대금을 완납하여 취득한 시점부터 기산한다(Rule 144(d)(1)). 약속어음 등으로 취득한 경우의 특칙(d)(2)과, 일정한 승계 취득에서 이전 보유자의 기간을 합산하는 tacking(d)(3)이 기산점을 조정한다. 이 조정은 모두 경제적 위험 인수의 원리로 설명된다. 위험이 이어지면 시계도 이어지고, 위험이 새로 생기면 시계도 새로 선다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 지위(Rule 144 보조 경로·C-00 하류)와 취득 데이터의 외부 원장 의존은 위와 같이 확정되었다. 취득 출처에 관하여 ADR-008(D-A)은 이 외부 원장(CR-3)을 발행인의 명의개서대리인(Securitize)이 공급하는 오프체인 인터페이스 `IAcquisitionSource`로 구체화하였으며, 이는 본 부품의 seam과 정합한다. 다만 다음은 잔여 항목이다. 첫째, 현재 실장된 `IAcquisitionSource`는 취득 시각 하나만을 제공하는 최소 인터페이스로서, ADR-008 D-A가 규정한 보유분별 취득일·완납일·취득 유형·승계 참조를 아직 제공하지 아니한다. 둘째, 현재 컨트랙트는 보고/비보고 6개월·1년 분기, tacking, 완납 시점(취득일과 완납일 중 나중), shell(Rule 144(i)) 봉쇄, C-00 활성 연동을 구현하지 아니한다. 셋째, 취득 시점의 기준 시각 정의는 부품 A-11과 공유하는 ADR로 고정하여야 한다.

---

# 제2부. 구현 명세 (컨트랙트 `Lockup.sol` — 현재 skeleton)

## 5. 시스템 내 위치

| 항목 | 값 (컨트랙트 메타) |
|---|---|
| ELEMENT_ID | `C-01-v1` |
| 분류 | 재판매 거래(RESALE_TRANSACTION) · PERIODIC |
| 검증 패턴 | 직접 계산형 · DETERMINISTIC |
| 판정 시점 | 거래 전 관문(AT_TRADE_GATE) |
| 상태 | STATELESS (단, 외부 취득 원장에 의존) |
| 활성 | R2 전용. C-00이 Rule 144 경로를 확정한 경우에만(현재 컨트랙트는 이 활성 연동을 아직 담지 아니함). |
| 의존 | `IAcquisitionSource`(CR-3·주입) · C-00(경로, 상류) · A-06(계열 분기, 기간 무영향) · B-03(restricted, 상류) |

## 6. 인터페이스 (현행)

```solidity
// 생성자: 취득 출처 주입 + 고정 lockup
constructor(address acquisitionSource_, uint64 lockupSeconds_);

// 판정 (view). user = 매도인
function check(address user, address, address asset, uint256, bytes)
    external view returns (bool passed, bytes32 reasonCode);
//   acquired = acquisitionSource.acquiredAt(user, asset);
//   passed = acquired != 0 && block.timestamp >= acquired + lockupSeconds;
//   실패 시 reasonCode = encode(recipeId, "C-01-v1", 1)
```

현행 컨트랙트는 주입된 `IAcquisitionSource.acquiredAt(user, asset)`에서 취득 시각 하나를 읽어, 현재 시각이 그 시각에 `lockupSeconds`를 더한 값 이상인지를 판정한다. 취득 원장 자체는 이 컨트랙트가 유지하지 아니한다(CR-3 seam).

## 7. 현행 구현과 목표 규격의 격차

| 항목 | 현행 `Lockup.sol` | 목표 규격(보경 walkthrough) |
|---|---|---|
| 기간 | 생성자 고정 `lockupSeconds` 단일값 | 보고 6개월 / 비보고 1년 분기(Manifest.issuerReporting) |
| 취득 데이터 | `acquiredAt(user, asset)` 단일 | 보유분별 {취득일, 완납일, 취득유형, 승계참조}(ADR-008 D-A) |
| 기산점 | 취득 시각 직접 | `max(취득일, 완납일)` · 약속어음 특칙(d)(2) |
| 승계 | 없음 | tacking(d)(3) — 이전 보유자 기간 합산 |
| shell | 없음 | Rule 144(i) 경로 봉쇄 |
| 활성 | 무조건 | C-00 == RULE144일 때만 |
| reasonCode | 1(미달) 단일 | 미달·승계결손·shell 등 세분 |

## 8. 기능 요구사항

- **REQ-C01-1 (현행 판정).** 시스템은 취득 시각이 존재하고(0 아님) 현재 시각이 취득 시각에 lockup을 더한 값 이상인 경우 통과하고, 그러하지 아니하면 차단하여야 한다.
- **REQ-C01-2 (기간 분기, 목표).** 시스템은 발행인이 보고회사이면 6개월, 비보고회사이면 1년을 적용하여야 한다(Manifest.issuerReporting).
- **REQ-C01-3 (기산점, 목표).** 시스템은 기산점을 취득일과 완납일 중 나중의 것으로 산정하여야 한다.
- **REQ-C01-4 (승계, 목표).** 승계 취득이 tacking 적격인 경우 기산점을 이전 보유자의 기산점으로 승계하여야 한다.
- **REQ-C01-5 (활성, 목표).** 시스템은 C-00이 Rule 144 경로를 확정한 경우에만 작동하여야 한다.
- **REQ-C01-6 (tolling 금지).** 시스템은 보유기간에 정지(tolling) 로직을 두어서는 아니 된다.
- **REQ-C01-7 (경계).** 경계는 포함이며, 요구기간에 정확히 도달한 경우 통과한다.

## 9. reasonCode

| n | Code | 발생 조건 | 상태 |
|---|---|---|---|
| 1 | `FAIL_HOLDING_PERIOD` | 취득 시각 없음 또는 lockup 미경과 | 현행 |
| (목표) | `REVIEW_TACKING_UNCERTAIN` / `HP_LINEAGE_BROKEN` | 승계 적격 불명·승계 참조 결손 | ADR-008 D-A |

## 10. IAcquisitionSource Seam (CR-3 · ADR-008 D-A)

- **REQ-C01-8 (외부 취득 원장).** 취득 데이터는 이 컨트랙트가 아니라 주입된 `IAcquisitionSource`에서 읽는다. 이는 보경 walkthrough의 CR-3(Acquisition Registry) seam이며, ADR-008 D-A가 이를 발행인 명의개서대리인(Securitize)의 오프체인 인터페이스로 구체화하였다.
- **REQ-C01-9 (인터페이스 확장, 목표).** 현행 `IAcquisitionSource.acquiredAt(user, asset)`은 취득 시각 하나만을 제공한다. ADR-008 D-A의 규격(보유분별 취득일·완납일·취득유형·승계참조)을 지원하도록 확장하여야 한다. 대상 자산이 배당 토큰을 지급하는 경우 각 배당 보유분의 승계가 제공되어야 한다.

## 11. 불변식

1. 본 부품은 취득 원장을 유지하지 아니한다. 취득 사실의 진실성은 `IAcquisitionSource`에 의존한다.
2. 보유기간은 계열 여부와 무관하게 동일하다(계열에는 다른 부품의 병행 조건이 더해진다).
3. 시계에 정지(tolling)를 두지 아니한다.
4. 판정 불가 시 기본값은 더 긴 쪽(1년)이다.

## 12. 의존성

```
C-00(경로 선택) → Rule 144 확정 시에만 → C-01 활성(목표)
IAcquisitionSource(CR-3·Securitize) → 취득 데이터 → C-01
A-06(계열) → (c)(e)(f)(g)(h) 병행 조건 분기(기간 무영향)
B-03(restricted 메타) → 제한증권 여부(상류)
A-11 → 취득 시점 기준 시각 정의 공유
```

## 13. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 취득 시각 없음(0) | FAIL_HOLDING_PERIOD |
| 2 | lockup 미경과 | FAIL_HOLDING_PERIOD |
| 3 | lockup 경과 | PASS |
| 4 | 경계(정확히 lockup 경과) | PASS(포함) |
| 5 (목표) | 비보고 자산, 14개월 보유 | PASS(1년) |
| 6 (목표) | 보고 자산, 7개월 보유 | PASS(6개월) |
| 7 (목표) | 완납일이 취득일보다 늦음 | 기산점 = 완납일 |
| 8 (목표) | tacking 적격 승계 | 기산점 승계 |
| 9 (목표) | 승계 참조 결손 | REVIEW/HP_LINEAGE_BROKEN |

## 14. Demo 및 Production 범위

| 구분 | Demo (현행 skeleton) | Production |
|---|---|---|
| 취득 출처 | 주입된 mock `IAcquisitionSource.acquiredAt` | Securitize Connect API(보유분별 필드) |
| 기간 | 고정 lockupSeconds | 보고/비보고 6개월·1년 분기 |
| 승계·shell·C-00 활성 | 미구현 | 구현 |

§4(a)(7)이 주 경로이고 본 부품은 Rule 144 보조 경로의 게이트이므로, 데모 단계에서는 mock 취득원과 고정 lockup으로 충분하다.

## 15. 잔여 확정 항목

1. `IAcquisitionSource` 확장 — 보유분별 취득일·완납일·취득유형·승계참조(ADR-008 D-A, 현재 acquiredAt 단일).
2. 보고/비보고 6개월·1년 분기(Manifest.issuerReporting).
3. tacking(d)(3)·완납(max)·약속어음(d)(2)·shell(i) 구현.
4. C-00 활성 연동(현재 무조건 작동).
5. 취득 시점 기준 시각 정의 — A-11과 공유 ADR.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~3절 (법적 근거·논증) | 파생 | 보경 walkthrough §1·§3 |
| 제3.1절·제4절 (경로 지위·seam) | 결정 | ADR-005 · ADR-008 §1 D-A |
| 제5·6·9절 (현행 구현) | 실장 | `Lockup.sol` (C-01-v1) |
| 제7·10·15절 (격차·seam·목표) | 실장·목표 | `Lockup.sol` + 보경 walkthrough + ADR-008 D-A |

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `C-01_보유기간.md` (2026-07-21) — 레포 `docs/compliance/elements/` 교체 대상.
- 구현: `src/compliance/elements/Lockup.sol` · `interfaces/compliance/IAcquisitionSource.sol`
- 결정: `ADR-005`(§4(a)(7) 주 경로) · `ADR-008-compliance-seam-decisions.md`(§1 D-A) · `ADR-006`
- 공유 개념: `SPEC.md` 제1·2·6절
- 1차 출처: 17 C.F.R. § 230.144(d)(1)(i)·(ii)·(d)(2)·(d)(3)·(b)(1)·(i) · 15 U.S.C. § 77e · § 77d(a)(1) · § 77b(a)(11) · § 77l(a)(1) · SEC Release 33-8869 (72 FR 71546)

## C. 변경 로그

- [2026-07-22] v1.0 — **보경 검토본 기반 전면 재작성(승준 staging 기반 v0.1 폐기).** 제1부: 사다리(§5→§4(a)(1)→§2(a)(11)→Rule 144)·간주 안전항·6개월/1년(비보고=1년)·계열 기간동일·tolling 없음·§12(a)(1) 명시적 사적소권(ICA §47(b) FS Credit 대비)·C-00 활성·CR-3 의존·기산점/tacking. 제2부: 실장 `Lockup.sol`(skeleton — 주입 IAcquisitionSource.acquiredAt + 고정 lockupSeconds + reason code 1)과 목표 규격의 격차 명시. ADR-008 D-A(IAcquisitionSource)가 보경 CR-3 seam과 정합함을 확인하고, 현행 최소 인터페이스 대 ADR-008 리치 필드의 격차를 잔여 항목으로 표시.
