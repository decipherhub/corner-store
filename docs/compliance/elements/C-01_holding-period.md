---
type: element-walkthrough
element-id: C-01
element-name: Holding Period (보유기간)
parent-recipe: R2 (§4(a)(7)·Rule 144 Resale) — Rule 144 분기
internal-id: ELE.C-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.144(d) — 보유기간(6개월/1년): https://www.ecfr.gov/current/title-17/section-230.144"
  - "17 CFR § 230.144(d)(3) — tacking(보유기간 합산): https://www.ecfr.gov/current/title-17/section-230.144"
  - "17 CFR § 230.144(c) — current public information(별도 요건): https://www.ecfr.gov/current/title-17/section-230.144"
created: 2026-06-17
updated: 2026-06-17
tags: [element, C-01, holding-period, rule-144, walkthrough, spec-sheet, R2, pattern-A]
---

# C-01 Holding Period — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **"이 증권을 충분히 오래 들고 있었는가"를 확인하는 부품**(내부 식별자 C-01)을 풀어 쓴 인수인계 문서다. 사모로 산 증권(restricted securities)을 Rule 144 경로로 되팔려면 *최소 보유기간*을 채워야 하는데, 본 부품은 그 기간을 *날짜 산수*로 확인한다.
>
> **이 부품의 현재 위치 (ADR-005 이후).** 우리 프로젝트는 BUIDL 전매의 주 경로를 **§4(a)(7)**(보유기간 없음)으로 결정했다(ADR-005). 따라서 **본 부품은 *보조 경로인 Rule 144*의 핵심 게이트**다 — 즉 *1년 이상 보유한 장기 보유자가 Rule 144로 되팔 때* 작동한다. §4(a)(7) 경로 거래에는 본 부품이 작동하지 않는다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — eCFR 검증 대기).** "먼저 작성, 검증 나중" 전략 1차 초안. **미세 locator 주의**: Rule 144(d)의 하위 항 번호((d)(1)(i)/(ii)·(d)(3) tacking)는 검증 패스에서 eCFR 원문 1대1로 확정한다(현재 "확인 요"). 보유기간 *값*(6개월/1년)은 SEC 가이드로 확인됨.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** 본 부품은 한 줄로 *"이 사람이 이 증권을 *충분히 오래* 들고 있었나"*를 본다. 사모로 산 증권은 *그냥 못 되판다*(C-00 §1 참조 — 되팔기엔 별도 면제 필요). 그 면제 중 **Rule 144**는 *"오래 들고 있었으면 우회 유통이 아니라고 본다"*는 *시간 기반* 안전항이고, 본 부품은 그 *시간 조건*을 확인한다.

### 1.1 핵심 개념 — "오래 들고 있었으면 우회가 아니다"

쉽게 말하면, 법은 *되팔기가 "공모 우회"인지*를 걱정한다. 사모로 산 사람이 *즉시* 대중에 되팔면, 그건 사실상 발행자가 우회로 공모한 것과 같다. 그런데 *오래 들고 있다가* 되팔면 — *투자 목적으로 진짜 보유했다*는 정황이 생겨, 우회 유통으로 보기 어려워진다.

그래서 Rule 144는 **최소 보유기간**을 둔다. 그 기간을 채우면 *"이 사람은 배포(distribution) 목적이 아니라 투자 목적으로 보유했다"*고 보아, 되팔기를 underwriter 거래가 아닌 것으로 인정한다. 본 부품은 그 기간 충족 여부를 *거래 직전 날짜 계산*으로 판정한다.

> **비유 (한국 anchor):** 한국의 **보호예수**(IPO 등에서 일정 기간 매도 금지)와 발상이 같다 — "일정 기간 못 팔게 해서 단기 차익·우회 유통을 막는다." 다만 보호예수가 *물리적 잠금*이라면, Rule 144 보유기간은 *면제의 조건*이다(기간을 안 채우면 *이 통로*를 못 쓸 뿐, 다른 면제(§4(a)(7))로는 즉시 가능 — C-00 참조).

### 1.2 어느 법·규칙에서 오나 + 기간

| 출처 | 무엇 | 값 |
|---|---|---|
| **Rule 144(d)** | 제한증권 재매각 전 최소 보유기간 | 보고 발행자 **6개월** / 비보고 발행자 **1년** |
| **Rule 144(d)(3)** | tacking — 일정 전수 시 *이전 보유자 기간 합산* | (조건부) |
| Rule 144(c) | current public information(별도 요건) | (본 부품 아님 — Recipe 차원) |

→ **BUIDL은 사모 §3(c)(7) 펀드(비보고) → 보유기간 = 1년.** (이 1년 lockup이 ADR-005에서 Rule 144를 *주 경로에서 제외*하고 §4(a)(7)을 택한 이유다.)

### 1.3 왜 이 규제가 존재하는가

§4(a)(1)의 일반 거래 면제는 *underwriter가 아닌 자*의 거래에만 적용된다. 사모 증권을 *배포 목적으로* 산 뒤 즉시 되파는 자는 underwriter로 취급될 위험이 있다(§2(a)(11)). Rule 144는 *"무엇을 지키면 underwriter가 아닌 것으로 봐주는가"*를 명확히 한 안전항이고, **보유기간은 그 핵심** — *시간이 배포 의도 부재의 증거*가 된다는 논리다.

### 1.4 Decipher에서의 위치

본 부품은 **Rule 144 경로의 진입 게이트**다. C-00(전매 경로 선택기)이 Rule 144로 라우팅하면 본 부품이 보유기간을 검사한다. ADR-005로 §4(a)(7)이 주 경로가 됐으므로, 본 부품은 *§4(a)(7)이 어떤 이유로 막히거나(예: general solicitation 쟁점) 1년 이상 보유한 비-내부자가 144로 가는* 보조 시나리오에서 작동한다. *기계 판정형(날짜 산수)*이라 로직은 단순하지만, **"보유 시작 시점"을 블록체인에서 어떻게 잡느냐**가 핵심 난점이다(A-11과 공유 — §5.3).

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Holding Period** | Rule 144 보유기간 검사원 |
| 검사 대상 | 매도인이 *최소 보유기간*을 채웠는가(Rule 144(d)) | "충분히 오래 들고 있었나" |
| Internal ID | C-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 날짜 산수 | 취득 시점 + 기간 vs 현재 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 취득 시점 1개와 비교 |
| 활성화 조건 | **Rule 144 경로일 때만**(C-00이 라우팅) | §4(a)(7) 경로엔 미작동 |
| 주 활성화 Recipe | **R2**(Resale) — Rule 144 분기 | ADR-005 후 *보조 경로* |
| 연계 부품 | **C-00**(경로 선택)·**A-06**(affiliate 추가 제약)·**A-11**(취득시점 공유) | |
| 성숙도 | 🟢 로직 확정 — 취득시점 기준·tacking은 Open Issue | |
| 파일·위치 | C-01_holding-period.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim·정책에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽은 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 claim/정책이 제공 |
|---|---|
| 취득시점 + 보유기간 vs 현재 *날짜 비교* | 취득시점 timestamp *정의*(정책·ADR, A-11 공유) |
| tacking 합산(입력=적격·이전보유 시점) | tacking *적격 판정*(어떤 전수가 합산되나) |
| 보고/비보고로 기간(6m/1y) 선택 | 144(c) 공시정보(Recipe 차원) |

→ 순수 날짜 산수. *어느 시점이 취득인지·tacking 되는지*는 정책/claim.

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base (배경)

> **§ 4(a)(1) + § 2(a)(11) — 왜 보유기간이 필요한가** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim)]
>
> **요지**: §4(a)(1)은 *underwriter가 아닌 자*의 거래를 면제한다. 사모 증권을 *배포 목적*으로 산 자는 §2(a)(11) underwriter가 될 수 있다. Rule 144는 *"보유기간 등을 지키면 underwriter가 아니다"*를 명확히 한 안전항이다. → 보유기간의 *법적 뿌리*는 "배포 의도 부재"의 입증이다.

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.144(d) — 보유기간** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.144)]
>
> **요지**(미세 항번호 확인 요): 제한증권은 *취득 후* — **발행자가 Exchange Act 보고회사면 6개월, 비보고회사면 1년** — 을 보유한 뒤에야 Rule 144로 재매각할 수 있다. 보유기간은 *완납(full payment) 취득 시점*부터 기산한다.
>
> 해설: **BUIDL = 비보고 사모 펀드 → 1년.** 이 1년이 DEX 유동성과 충돌해 ADR-005에서 §4(a)(7)을 주 경로로 택한 결정적 사실이다.

> **17 CFR § 230.144(d)(3) — Tacking(보유기간 합산)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.144)]
>
> **요지**(확인 요): 일정한 전수(예: 증여·신탁·일부 무상이전 등)에서는 *이전 보유자의 보유기간을 합산(tacking)*할 수 있다. → 새 보유자가 0부터 다시 세지 않아도 되는 경우가 있다. (구체 적용 케이스는 변호사 확인 — §12.)

> **17 CFR § 230.144(c) — Current Public Information (별도 요건)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.144)]
>
> **요지**: Rule 144는 보유기간 외에 *발행자에 대한 현재 공시정보*도 요구한다(비보고 발행자는 일정 정보가 공개돼 있어야). → **본 부품의 책임이 아니라 Rule 144 Recipe 차원의 별도 검사**다(§9). 비보고 사모 펀드(BUIDL)에서 이 요건 충족 방식은 Open Issue(§12).

### 3.3 Layer 3 — Interpretive guidance

> **SEC, Rule 144 Small Entity Compliance Guide** [🔗 [SEC](https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/revisions-rules-144-145)]
>
> **요지**: 비-affiliate가 보유기간(비보고 1년)을 채우면 *대체로 자유 재매각* 가능. affiliate는 보유기간 + current public info + 물량 한도 + 매도 방법 + Form 144까지. → 본 부품은 *보유기간*만, affiliate 추가 제약은 A-06이 담당(§9).

### 3.4 Sub-요건 분해

| 판정 요소 | 충족 조건 | 근거 |
|---|---|---|
| 보유기간 | 현재 − 취득시점 ≥ (보고 6m / 비보고 1y) | 144(d) |
| tacking | 합산 가능 전수면 이전 보유자 기간 가산 | 144(d)(3) |
| 취득시점 기산 | *완납 취득 시점*부터(블록체인 timestamp 정의) | 144(d)·(Open Issue) |
| (별도) 공시정보 | Rule 144(c) — Recipe 차원 | 144(c) |
| (별도) affiliate 제약 | 물량·방법·Form 144 | A-06 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `acquisitionTimestamp` | timestamp | 온체인 취득 기록 | 보유 시작 시점(완납 취득) |
| `asset.issuerReporting` | bool | Manifest | 보고회사(6m) / 비보고(1y) 구분 |
| `tacking.priorHolderSince` | timestamp(선택) | Trusted Issuer/이전 보유 증빙 | 합산 가능 시 이전 보유 시작 |
| `tacking.eligible` | bool | Trusted Issuer | 이 전수가 tacking 대상인가 |
| `block.timestamp` | timestamp | blockchain | 현재(거래) 시점 |

해설: 본 부품의 입력은 사실상 *날짜 두 개*(취득 시점·현재)와 *발행자 보고 여부*다. tacking이 있으면 취득 시점이 *이전 보유자 시점*으로 당겨진다.

---

## §5. ③ 판정 로직

### 5.1 전체 흐름

① 발행자 보고 여부로 요구 기간(6m/1y) 결정 → ② tacking 가능하면 보유 시작을 이전 보유자 시점으로 → ③ 현재 − 보유시작 ≥ 요구기간이면 통과.

### 5.2 Pseudocode + 해설

```
function check_C_01(seller, asset, block):
    required = asset.issuerReporting ? 6_months : 12_months   # BUIDL=비보고 → 12m

    holding_start = seller.acquisitionTimestamp
    if seller.tacking.eligible:
        holding_start = min(holding_start, seller.tacking.priorHolderSince)  # 합산

    if (block.timestamp - holding_start) >= required:
        return PASS
    else:
        return FAIL_HOLDING_PERIOD
```

- **해설**: 순수 날짜 비교다. 발행자가 비보고(BUIDL)면 1년, tacking 대상이면 보유 시작을 앞당긴다. 기간을 못 채우면 `FAIL_HOLDING_PERIOD` — *재매각 불가(아직)*.

### 5.3 핵심 난점 — "보유 시작 시점"을 블록체인에서 어떻게 잡나 (A-11과 공유)

A-11(증명 유효기간)과 *동일한 쟁점*이다. 보유기간 기산점인 "완납 취득 시점"을 블록체인의 어느 timestamp로 볼 것인가 — 주문 매칭·mempool·블록 확정·완결성 중. **Decipher 권고: block confirmation timestamp**(A-11과 일관). 이 기준은 **ADR로 고정**해 A-11·C-01이 같은 정의를 쓰게 한다(§12).

### 5.4 경계 처리

요구기간 *정확히 그 시점* 거래는? 본 부품은 **만료일 도달 시 통과**(≥, inclusive)를 기본값으로 한다(정확히 1년 되는 시점 매각 가능). 법적 확정은 §12.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 매도인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_HOLDING_PERIOD` | 보유기간 미충족 | 아직 충분히 안 들고 있음 | 기간 채우거나 *§4(a)(7) 경로*로(매수인 AI 필요) | frontend에 "잔여 기간" + §4(a)(7) 대안 안내 |
| `PASS` | 보유기간 충족 | OK | (affiliate면 A-06 추가) | — |
| `REVIEW_TACKING_UNCERTAIN` | tacking 적격 불명확 | 합산 가능 여부 판단 필요 | 전수 증빙 제출 | manual review |

해설: 본 부품의 실패는 *회복 가능*하다 — 기다리면 충족되거나, *§4(a)(7) 경로*(매수인이 적격투자자면 보유기간 없이)로 우회할 수 있다(C-00이 안내). 그래서 frontend는 *§4(a)(7) 대안*을 함께 보여주는 게 좋다(ADR-005 주 경로).

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass) | 비보고(BUIDL), 14개월 보유 | -14m | **PASS** |
| T2 (Fail) | 비보고, 8개월 보유 | -8m | **FAIL_HOLDING_PERIOD** |
| T3 (보고 발행자) | 보고회사, 7개월 보유 | reporting, -7m | **PASS**(6m 기준) |
| T4 (경계) | 비보고, 정확히 12개월 | == 12m | **PASS**(inclusive·§5.4) |
| T5 (tacking) | 비보고 9개월 + 증여로 이전 보유자 6개월 합산 | tacking +6m | **PASS**(합산 15m) |
| T6 (취득 timestamp 경계) | 만료 직전 매칭→직후 confirm | confirm 기준 | **기준 timestamp에 따름**(§5.3·A-11 일관) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A**다. 보유기간은 *날짜 뺄셈과 비교*라 완전히 결정론적이다. 단 입력 *취득 시점*은 *어느 block timestamp를 채택하느냐*의 정책 결정이고(§5.3), tacking 적격은 Trusted Issuer 판단이 섞인다(증명서형 요소).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

```
C-00(경로 선택) ──ROUTE_RULE_144──▶ C-01(보유기간) [본 부품]
C-01 ──매도인 affiliate면──▶ A-06(물량 한도·매도 방법·Form 144)
C-01 ◀──취득 timestamp 정의 공유── A-11(증명 유효기간)
Rule 144 Recipe ── 별도 ──▶ current public information(144(c)) 검사
```

- **C-00과의 관계**: C-00이 Rule 144로 라우팅할 때만 본 부품이 켜진다. §4(a)(7) 경로(주 경로)면 본 부품은 미작동.
- **A-06(affiliate)과의 관계**: 매도인이 내부자면 보유기간 외에 *물량·매도방법·Form 144*가 추가된다 — 그건 A-06이 본다. 본 부품은 *보유기간만*.
- **A-11과의 관계**: "취득 시점" timestamp 정의를 *공유*한다. 두 부품이 같은 기준(block confirmation)을 써야 일관된다 → ADR 고정.
- **Rule 144(c) 공시정보**: 본 부품 밖. Recipe 차원의 별도 검사(비보고 BUIDL의 충족 방식은 Open Issue).

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. 온체인 취득 기록** | 블록체인 | 취득 timestamp | 어느 timestamp가 "완납 취득"인지 정책 결정 |
| **2. Trusted Issuer** | 신뢰기관 | tacking 적격·이전 보유 증빙 | 합산 판단 |
| **3. System Policy** | Decipher | 취득시점 기준(ADR)·보유기간 값 | 정책 일관성(A-11 공유) |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 잔여 기간 표시 | Frontend | "보유 N개월 / 1년 필요 — D-day까지 §4(a)(7) 경로 안내" |
| §4(a)(7) 대안 안내 | Frontend | 보유기간 미충족 시 *적격투자자 매수인에게는 즉시 가능*(주 경로) |
| tacking 증빙 | Off-chain | 이전 보유자 기간 합산 자료 |

**UX 핵심**: 보유기간 미충족은 *거절이지만, 같은 거래를 §4(a)(7)로는 지금 할 수 있다*(매수인이 적격이면). 그 대안을 함께 안내해 적법 거래를 막지 않는다.

---

## §12. Open Issues

1. **취득 시점(time-of-acquisition) timestamp 정의** 🔴 — A-11과 *공유 ADR*로 고정(권고 block confirmation). 보유기간 기산점.
2. **tacking 적격 케이스** 🟡 — 어떤 전수(증여·신탁·합병 등)가 144(d)(3) 합산 대상인지 변호사 확인.
3. **비보고 사모 펀드의 current public information(144(c))** 🟡 — BUIDL 같은 §3(c)(7) 펀드가 144(c) 정보 요건을 어떻게 충족하나(Recipe 차원, 본 부품 밖이나 Rule 144 경로 전체에 영향).
4. **보유기간 값·경계 inclusive** 🟢 — 6m/1y 값(확인됨)·경계(≥) 법적 확정.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: C-01_holding-period.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *Rule 144 보유기간* 검사 부품 walkthrough 신설. ① 규제 맥락("오래 보유=우회 아님"·144(d) 6m/1y·BUIDL 1년·한국 보호예수 anchor·ADR-005로 *보조 경로* 위치), ② 법적 근거(144(d)·(d)(3) tacking·(c) 공시정보 별도·§4(a)(1)/§2(a)(11) 배경), ③ 입력(취득 timestamp·보고여부·tacking), ④ 로직(날짜 산수 pseudocode·취득시점 A-11 공유·tacking·경계 inclusive), ⑤ 테스트 6종, 패턴 A, C-00/A-06/A-11/144(c) coordination, 3-Layer, Open Issues 4종(취득시점 ADR·tacking·144(c) 공시·경계). **인용 검증 대기**(미세 항번호 확인 요·보유기간 값은 SEC 가이드 확인). ADR-005로 §4(a)(7) 주 경로 → 본 부품은 Rule 144 보조 경로 게이트.
