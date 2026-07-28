---
type: recipe-requirement-spec
recipe-id: R-XJ
recipe-name: Cross-Jurisdictional Always-On (제재·관할·Reg M 횡단 전제)
project: RWA DEX (Giwa) · corner-store
status: v2.0 (2026-07-28) — 2부 구성(제1부 법률논증 산문 + 제2부 목표 규격). 전용 Recipe 컨트랙트 미구현(target spec).
substance-sot: "승준 recipe walkthrough — R-XJ_Cross-Jurisdictional-Always-On.md v1.0 (2026-06-17, baseline 전제층·fail-closed). 보경 recipe 검토본 없음 — 법률 검토 필요."
implements: "전용 컨트랙트 미구현 — 목표 규격. 구성 요소(A-01·A-02·F-04)는 개별 Element로 스펙됨."
reflects-decisions: [ADR-001, ADR-002, ADR-006]
umbrella: "SPEC.md — 공유 개념(Element/Recipe/Manifest·Router·fail-closed)은 여기에 의한다"
legal-effect: "거래가 제재(OFAC)·관할(Reg S)·시장행위(Reg M) 횡단 금지에 저촉되지 않음 — 모든 거래의 진입 전제(면제 아님)"
review-required: legal
tags: [recipe-requirement-spec, R-XJ, cross-jurisdictional, ofac, sanctions, reg-s, reg-m, always-on, baseline, fail-closed, target-spec]
---

# R-XJ Cross-Jurisdictional Always-On — 요구사항 명세서 (Recipe)

> **저술 지위 고지.** 본 Recipe의 법적 논증은 승준 recipe walkthrough(2026-06-17)를 산문 2부 형식으로 재구성한 것이며, 대응 보경 recipe 검토본은 없다 — 법률 검토 전(제4절). R-XJ 전용 Recipe 컨트랙트는 미구현이므로 제2부는 목표 규격이다. 구성 요소(A-01·A-02·F-04)는 각각 개별 Element로 스펙되어 있다.

> **정체성 유의.** R-XJ는 면제 Recipe가 아니다. R1~R3은 자격으로 면제를 성립시키고 R4는 행태를 감시하나, R-XJ는 그 아래에 깔리는 전제층(baseline)이다 — 어떤 거래든, 어떤 경로든 가장 먼저 통과해야 하는 횡단 관문이다. 비유하자면 R1~R3이 비자, R4가 기내 행동수칙이라면 R-XJ는 입국심사이다. 비자가 있어도 입국심사를 넘지 못하면 들어갈 수 없다.

본 문서는 컴플라이언스 **Recipe** R-XJ(횡단 전제층)의 요구사항 명세서이다. **제1부**는 R-XJ가 검문하는 세 횡단 금지의 근거와 조문별 도출을, **제2부**는 그 목표 구현 규격을 규정한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

R-XJ는 모든 거래가 자격·행태 규범에 앞서 통과해야 하는 세 가지 횡단 금지 — 제재(OFAC), 관할(Regulation S), 판매 중 매수 제한(Regulation M) — 에의 미저촉을 검문하는 전제층 Recipe이다. 이 세 규범은 면제 성립 여부와 무관하게 모든 거래에 무조건 적용되며, 특히 제재는 무과실 책임이어서 R-XJ 전체가 fail-closed(불확실하면 차단) 원칙으로 작동한다. R-XJ가 차단하면 어떤 면제가 충족되어도 거래는 성립하지 아니한다.

## 2. 규범적 근거

첫째, 제재이다. 국제비상경제권한법(IEEPA)과 그에 근거한 OFAC 규정은 특별지정국민(SDN)·차단대상자, 그리고 그들이 50% 이상 소유한 자(50% Rule)와의 거래를 금지하며, 그 위반은 무과실 책임이어서 알지 못하였더라도 책임을 진다(50 U.S.C. § 1701 이하; 31 C.F.R. Chapter V). 둘째, 관할이다. 미국 증권법은 미국인(U.S. person, Rule 902(k)) 대상 거래에 등록을 요구하고, Regulation S는 역외 거래에 대한 안전항을 제공하며(17 C.F.R. §§ 230.901–905), 역외적용의 범위는 거래 기준으로 판단된다(Morrison v. National Australia Bank, 561 U.S. 247 (2010)). 또한 포괄제재국(embargoed) 거주자와의 거래는 국가 단위 제재로 금지된다. 셋째, Regulation M은 배포 제한기간 중 발행자·관여자의 대상증권 매수를 금지한다(17 C.F.R. § 242.101·102). 이 세 규범은 다국적 관할에 동시에 걸리는 성격을 가지며, 그래서 횡단(cross-jurisdictional)이다.

## 3. 쟁점별 논증

### 3.1 제재 — 무과실·최우선 (fail-closed)

제재 대상과의 거래는 예외나 최소기준(de minimis) 없이 절대적으로 금지되며, 위반이 무과실이라는 점에서 다른 어떤 규범보다 보수적으로 다루어져야 한다. Element A-01이 거래 당사자를 SDN·제재 명단과 대조하여 일치하거나 의심되는 경우 차단한다. 명단 대조 자체는 결정론이나(패턴 A), 당사자의 실제 신원은 off-chain KYC claim에 의존하므로, claim이 의심스러우면 통과가 아니라 차단으로 귀결한다(fail-closed). 어떤 면제가 충족되어도 A-01의 차단은 거래를 불가능하게 하며, 이것이 시스템에서 가장 보수적인 지점이다.

### 3.2 관할 — Reg S와 역외적용

매수인의 관할(거주·국적)에 따라 적용 법이 달라진다. 미국인 대상 거래에는 미국 증권법이 전면 적용되고, 허용 관할 외 또는 금수국 거주자와의 거래는 제한·금지된다. Element A-02가 매수인의 관할을 `Manifest.allowedJurisdictions`·금수국 목록과 대조하여 비허용·금수 관할을 차단한다. 미국인 판정은 Rule 902(k) 기준에 의한다. 관할 코드 대조는 결정론이나(패턴 A), 거주지·국적이라는 입력은 claim이다.

### 3.3 Reg M — 분배기간 중 발행자측 매수 (시간조건부)

판매 진행 중에는 발행자·관여자·계열 매수자가 그 증권을 매수할 수 없다(가격 조작 방지). Element F-04가 제한기간(R1 발행 상태에서 도출)과 매수자 신원으로 결정론 차단한다. F-04는 시장행위(R4)이자 분배기간 횡단 전제(R-XJ)로 이중 소속이며, 분배기간에만 활성이라는 점에서 R-XJ 중 유일한 시간조건부 항목이다.

### 3.4 전제층의 위상 — 곱셈의 맨 앞 인수

R-XJ는 모든 Recipe의 앞에 곱해지는 보편 prefactor이다. 어떤 거래도 R-XJ 없이 성립하지 아니하며(R-XJ = 0이면 전체 = 0), R-XJ가 실패하면 이후 자격·행태 Recipe의 평가는 무의미해지므로 진입 자체를 차단한다(short-circuit). 다른 모든 Recipe가 "R-XJ cumulative always-on"이라 적는 것의 정의가 여기에 있다.

## 4. 확정 사항 및 잔여 쟁점

세 횡단 금지의 구조와 fail-closed 원칙은 위와 같이 확정되었다. 잔여 쟁점은 다음과 같다. 첫째, OFAC 제재 명단의 실시간 갱신 피드의 신뢰성이 관건이며 갱신 지연은 곧 위험이다. 둘째, A-01·A-02가 받는 신원·거주 claim의 스키마와 신뢰사슬(Trusted Issuer)이 정의되어야 한다. 셋째, SDN 50% 간접소유의 자동 탐지는 off-chain 조사 영역으로 코드는 조사 결과 claim을 수용하며 그 한계를 명시하여야 한다. 넷째, OFAC 라이선스(특별허가)는 법무 재량으로 코드 자동화 대상이 아니며 예외는 수동·off-chain으로 처리한다. 다섯째, F-04 분배기간 산정 규칙(분배 시작·종료 정의)이 확정되어야 한다. 여섯째, 본 Recipe의 법적 논증은 보경 검토 전이다.

---

# 제2부. 목표 규격 (전용 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 |
|---|---|
| Recipe | R-XJ(횡단 전제층) |
| 컨트랙트 | **미구현** — 목표 규격. 구성 요소는 개별 Element(A-01·A-02·F-04) |
| 법률효과 | 제재·관할·Reg M 미저촉 → 거래 진입 전제 충족(면제 아님) |
| 활성화 | 모든 거래·항상, 가장 먼저(baseline) |
| 원칙 | fail-closed(제재는 불확실 시 차단) + short-circuit |

## 6. 활성화 (Activation)

- **REQ-RXJ-1 (최우선·상시).** 시스템은 모든 거래에 대하여 R-XJ를 가장 먼저 평가하여야 한다. A-01·A-02는 무조건, F-04는 R1 분배기간에만 활성이다.
- **REQ-RXJ-2 (short-circuit).** R-XJ가 실패하면 이후 Recipe(R1~R4) 평가 없이 거래를 차단하여야 한다.

## 7. 구성 (Composition) — fail-closed 전제 AND

- **REQ-RXJ-3 (제재).** A-01(SDN·50% 미일치)이 통과하여야 하며, 의심 매칭은 차단 쪽으로 처리한다(fail-closed).
- **REQ-RXJ-4 (관할).** A-02(허용 관할·비금수국)가 통과하여야 한다.
- **REQ-RXJ-5 (Reg M).** R1 분배기간인 경우 F-04(관여자 매수 아님)가 통과하여야 한다.
- **REQ-RXJ-6 (곱셈 전제).** 전체 거래 적법 = R-XJ ∧ (해당 면제 R1|R2) ∧ (펀드면 R3) ∧ R4. R-XJ는 맨 앞 인수이다.

## 8. 거절 (reasonCode)

`R-XJ_BLOCK_SANCTION`(A-01)은 최우선·예외 없이 SDN·50% 의심 시 즉시 차단하며 면제를 불문한다. `R-XJ_BLOCK_JURISDICTION`(A-02)은 비허용 관할·금수국을 차단한다. `R-XJ_BLOCK_REGM`(F-04)은 분배기간 중 발행자측 매수를 차단한다. 예외 메커니즘은 최소화하며, 특히 제재는 재량 예외가 없다(OFAC 라이선스는 별도 법무 영역).

## 9. Conflict·Interaction

| 상대 | 패턴 | 설명 |
|---|---|---|
| R1·R2·R3·R4 전부 | Cumulative(곱·always-on) | R-XJ는 모든 Recipe 앞에 곱해지는 전제. 어느 것도 R-XJ 없이 성립 못 함 |
| 면제 Recipe 일반 | 상위 전제(우선) | R-XJ 실패면 면제 충족 여부 무의미(short-circuit) |
| R4(행태) | 층 구분 | R-XJ=진입 전제(제재·관할), R4=행태(조작·사기). F-04(Reg M)만 양쪽 공유 |

## 10. 목표 구현 요건 (컨트랙트 미구현)

R-XJ는 자체 Recipe 컨트랙트보다는 Router가 모든 거래에 대하여 A-01·A-02(및 분배기간 F-04)를 최우선·short-circuit으로 평가하는 배선으로 실현되는 성격이 강하다. A-01의 fail-closed는 다른 요소가 "애매하면 통과"이더라도 A-01만은 "애매하면 차단"으로 동작하여야 함을 뜻한다. 제재 명단 최신성은 off-chain 피드에, 신원·거주·소유구조 입력은 KYC claim에 의존하며, 코드는 claim 위에서 결정론으로 판정한다. 전용 Recipe 컨트랙트를 둘 경우 `isApplicable`은 상시 참이되 평가 순서상 최선행이 보장되어야 한다.

## 11. 인수 기준

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 당사자 SDN 일치/의심 | R-XJ_BLOCK_SANCTION(최우선, 면제 불문) |
| 2 | 비허용 관할·금수국 매수인 | R-XJ_BLOCK_JURISDICTION |
| 3 | 분배기간 중 발행자측 매수 | R-XJ_BLOCK_REGM |
| 4 | 셋 다 미저촉 | R-XJ PASS → 하위 Recipe 평가 진행 |
| 5 | R-XJ 실패 | short-circuit(하위 Recipe 미평가) |

## 12. 잔여 확정 항목

1. OFAC 명단 실시간 갱신 피드 신뢰성.
2. A-01/A-02 KYC claim 스키마·신뢰사슬.
3. SDN 50% 간접소유 off-chain 조사 claim 수용·한계 명시.
4. OFAC 라이선스 예외의 수동·off-chain 처리.
5. F-04 분배기간 산정 규칙.
6. R-XJ 전용 Recipe 컨트랙트 실장 여부(또는 Router 배선 유지).
7. 본 Recipe 법적 논증의 보경 검토(review-required: legal).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4절 (법적 근거·논증) | 파생(승준 walkthrough 재구성, 보경 미검토) | 승준 recipe walkthrough R-XJ v1.0 (2026-06-17) §4 |
| 제5~12절 (목표 규격) | 목표(컨트랙트 미구현) | 본 명세 + A-01·A-02·F-04 Element 스펙 참조 |

## B. 근거 문헌

- 원 출처(substance): 승준 recipe walkthrough `R-XJ_Cross-Jurisdictional-Always-On.md` v1.0 (2026-06-17). 보경 recipe 검토본 없음.
- 구현: 전용 컨트랙트 미구현. 구성 요소 = Element `A-01`·`A-02`·`F-04`. Router 최선행·short-circuit 배선.
- 결정: `ADR-001`(F-04 Reg M) · `ADR-002`(cross-jurisdictional recipe) · `ADR-006`(asset-agnostic)
- 공유 개념: `SPEC.md`
- 1차 출처: 50 U.S.C. § 1701 이하(IEEPA) · 31 C.F.R. Chapter V(OFAC) · 17 C.F.R. §§ 230.901–905 · § 230.902(k) · Morrison v. National Australia Bank, 561 U.S. 247 (2010) · 17 C.F.R. § 242.101·102

## C. 변경 로그

- [2026-07-28] v2.0 — element spec과 동일한 2부 형식(제1부 법률논증 산문 + 제2부 목표 규격)으로 재작성. 기존 v1.0(2026-06-17, baseline 전제층 단일부)을 대체. 제1부는 세 횡단 금지(제재 IEEPA/OFAC·관할 Reg S/Morrison·Reg M)와 fail-closed·short-circuit·곱셈 전제를 산문화. 제2부는 전용 컨트랙트 미구현이라 목표 규격(REQ-RXJ-1~6). 제재 무과실·최우선·예외 없음 명시. review-required: legal.
- [2026-06-17] v1.0 — (구) baseline 전제층 walkthrough(fail-closed).
