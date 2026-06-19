---
type: element-walkthrough
element-id: F-02
element-name: Market Surveillance (시장행위 감시)
parent-recipe: R4 (시장행위 감시)
internal-id: ELE.F-02
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
stateful: true
related-external-sources:
  - "15 U.S.C. § 78i(a) — Exchange Act §9(a) 시세조종(wash sale·matched order): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78i&num=0&edition=prelim"
  - "15 U.S.C. § 78j(b) — §10(b)/Rule 10b-5 반사기·조작: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim"
created: 2026-06-17
updated: 2026-06-17
tags: [element, F-02, market-surveillance, wash-trade, spoofing, stateful, walkthrough, spec-sheet, R4, pattern-C]
---

# F-02 Market Surveillance — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"시세조종(wash trade·spoofing·layering 등) 패턴을 감시·표시하는 부품"**(내부 식별자 F-02)을 풀어 쓴 문서다. 시세조종은 *고의·목적*이 요건이라 *기계가 위반을 단정할 수 없다* — 그래서 F-02는 *객관적 패턴을 탐지해 표시(flag)*하고, *위반 판단은 사람*이 한다(패턴 C). 거래 이력을 누적 추적하는 **STATEFUL** 부품이다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — §9(a)=78i(a)·§10(b) 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** 1차 초안. §9(a)(wash sale·matched order)·§10(b)·anti-spoofing 근거의 정확 인용·범위는 검증 패스에서 원문 1대1 확인(현재 "확인 요"). 탐지 패턴 기준은 R-6 리서치 대상.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** 시세조종(market manipulation)은 *시장 가격을 인위적으로 왜곡*하는 행위다 — 자전거래(wash trade)·허수주문(spoofing)·물량쌓기(layering) 등. 그런데 이들은 *"속이려는 의도"*가 핵심 요건이라 *기계가 의도를 단정할 수 없다.* 그래서 F-02는 *의심스러운 객관 패턴을 탐지해 표시*하고, *진짜 조작인지 판단은 사람*에게 넘긴다(차단형이 아니라 감시형).

### 1.1 핵심 개념 — "패턴은 기계가, 조작 판단은 사람이"

쉽게 말하면, 시세조종 유형:
- **Wash trade(자전거래)** — *같은 실소유자가 양쪽*(매수·매도)에 서서 *거래량을 가짜로* 부풀림.
- **Spoofing(허수주문)** — *체결 의사 없는 대량 주문*을 냈다 취소해 가격을 유인.
- **Layering(물량쌓기)** — 여러 호가에 허수 물량을 쌓아 가격 인상.

이들은 모두 *"기만 의도"*가 법적 요건이다. *기계는 의도를 못 본다* — 자전거래처럼 보여도 정당한 사정이 있을 수 있다. 그래서 F-02는 *객관적으로 탐지 가능한 신호*(예: 매수·매도가 같은 실소유 클러스터)를 *표시(flag)*하고, *조작 여부는 운영자·감독이 판단*한다. **사전 차단이 아니라 사후 표시 + 사람 판단**(패턴 C)이 핵심.

### 1.2 어디서 오나

| 출처 | 무엇 |
|---|---|
| **Exchange Act §9(a)** | 시세조종 — wash sale·matched order·시세 조작 금지 |
| **§10(b) / Rule 10b-5** | 반사기·조작 일반조항 |
| (배경) anti-spoofing | Dodd-Frank가 도입한 spoofing 금지(상품·증권 시장) |

### 1.3 왜 이 부품이 존재하는가

시장 무결성·투자자 보호의 핵심이 *조작 방지*다. *"감시가 작동한다"*는 것 자체가 §9(a)·§10(b) 준수의 방어선이고, *감시 없는 시장*은 규제·신뢰를 잃는다. F-02는 *조작 패턴을 포착·기록*해 — 운영자가 *"외면하지 않고 감시했다"*는 증거를 남기고, 실제 조작을 *적시 차단·보고*하게 한다. (회의 2026-06-17: 탐지 기준·처리 시한은 R-6 리서치 대상.)

### 1.4 Decipher에서의 위치 — STATEFUL 감시

F-02는 R4(시장행위 감시)의 중심. *STATEFUL* — 단일 거래가 아니라 *거래 *패턴*(시간에 걸친 흐름)*을 봐야 wash/spoofing을 잡으므로, *거래 이력 상태*를 누적 추적한다. **post-trade flag**(체결은 막지 않고 사후 표시)가 기본 — 사전 차단은 정당 거래를 막을 위험이라 *감시형(C)*. F-01(운영자 자기거래)·F-03(사기)과 R4를 구성.

### 1.5 한국법 비교 — 자본시장법 시세조종 금지(§176)

한국 자본시장법 §176은 *통정·가장매매(wash trade)·시세조종·허수주문*을 금지하고, 거래소·금융당국이 *시장감시*를 한다. 발상이 §9(a)와 같다. F-02는 그 시장감시를 *온체인 패턴 탐지 + 사람 판단*으로 구현.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Market Surveillance** | 시세조종 패턴 감시·표시원 |
| 검사 대상 | 거래 패턴에 *조작 의심 신호*(wash·spoofing·layering)가 있는가 | "조작 패턴이 보이나" |
| Internal ID | F-02 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **감시형(패턴 C)** — 탐지·표시, 판단은 사람 | flag + review queue |
| Timing | **post-trade flag**(+ 일부 pre-trade 신호) | 사후 표시 |
| Stateful 여부 | **STATEFUL** ⭐ | 거래 이력·패턴 상태 추적 |
| 주 활성화 Recipe | **R4**(시장행위 감시) | 시장 무결성 |
| 연계 부품 | **A-04**(실소유 클러스터)·**F-01**(운영자)·**F-03**(사기) | |
| 성숙도 | 🟡 정밀화 — 탐지 패턴·시한(R-6) | |
| 파일·위치 | F-02_market-surveillance.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 코드가 하는 일 / 사람이 판단하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*(객관 패턴 탐지). *조작 의도·위반 여부*는 *사람(감시)*이 — 코드가 단정하지 않는다.

| ✅ 코드가 확인/구현 (결정론적 탐지) | 🔵 사람(감시)이 판단 |
|---|---|
| 매수·매도 *같은 실소유 클러스터*(A-04) = wash 신호 | 그 패턴이 *진짜 조작인지*(의도) |
| 주문 생성-취소 비율·패턴 = spoofing 신호 | 탐지 임계·패턴 기준 *정의*(R-6) |
| 호가 적층 패턴 = layering 신호 | 처리·차단·보고 결정 |
| 신호 표시·검토 큐 적재·이력 누적(STATEFUL) | |

→ 코드는 *"이 패턴이 보인다"*까지. *"이게 조작이다"*는 사람. (의도가 요건이라 자동 단정 불가.)

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **Exchange Act §9(a) (15 U.S.C. §78i(a))** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78i&num=0&edition=prelim)]
>
> **요지**: *wash sale*(같은 자가 양쪽), *matched order*, 시세를 인위 조작하는 거래 금지. → wash trade 탐지의 직접 근거.

> **§10(b) / Rule 10b-5 (15 U.S.C. §78j(b))** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim)]
>
> **요지**: 기만적·조작적 행위 일반 금지. spoofing·layering 등 *§9(a)에 안 잡히는 조작*의 포괄 근거.

### 3.2 Layer 2/3 — anti-spoofing·집행례

> Dodd-Frank anti-spoofing(체결 의사 없는 주문)·SEC/CFTC 집행례가 *객관적 탐지 기준*의 출처. F-02 탐지 패턴은 이 집행례에서 추출(R-6 리서치).

### 3.3 Sub-요건 분해 (탐지 신호)

| 신호 | 객관 탐지 기준(개념) | 근거 |
|---|---|---|
| wash trade | 매수·매도 같은 실소유 클러스터(A-04) | §9(a) |
| spoofing | 주문 생성-즉시취소 고빈도 | §10(b)·anti-spoofing |
| layering | 다수 호가 허수 적층 | §10(b) |
| (의도) | *기계 판정 불가 → 사람* | (요건) |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `tradeHistoryState` | struct(상태) | 온체인 이력 | 누적 거래·주문 패턴(STATEFUL) |
| `buyer.cluster` / `seller.cluster` | id | A-04 | 실소유 클러스터(wash 탐지) |
| `orderEvents` | events | 온체인 | 주문 생성·취소(spoofing/layering) |
| `surveillanceRules` | ruleset | 운영(R-6) | 탐지 패턴·임계 |
| `flagQueue` | queue(상태) | 운영 | 표시된 의심 거래 |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function surveil_F_02(trade, asset):           # post-trade(체결은 이미 됨)
    flags = []
    if trade.buyer.cluster == trade.seller.cluster:
        flags.append(WASH_TRADE_SIGNAL)         # 같은 실소유 양쪽
    if spoofing_pattern(asset.orderEvents, TradeHistoryState[asset]):
        flags.append(SPOOFING_SIGNAL)
    if layering_pattern(asset.orderEvents):
        flags.append(LAYERING_SIGNAL)

    TradeHistoryState[asset].update(trade)      # STATEFUL 갱신
    if flags:
        log_review(trade, flags)                # 검토 큐(사람 판단)
        return FLAGGED_FOR_REVIEW
    return CLEAR
```

- **해설**: 객관 신호만 탐지·표시(flag). *조작 여부 판단은 사람*(검토 큐). 거래는 *이미 체결*(post-trade) — 사전 차단 아님(정당 거래 보호). 이력 상태를 누적(STATEFUL).

### 5.2 STATEFUL — 패턴은 흐름에서 나온다

wash·spoofing은 *단일 거래*가 아니라 *시간에 걸친 패턴*에서 보인다. 그래서 거래 이력 상태를 누적하고, *패턴 함수*가 그 위에서 신호를 판정. (D-01과 함께 STATEFUL — 상태 정합·원자성 고려.)

### 5.3 처리 시한(SLA) — "작동하는 감시"

표시(flag)는 *시한 내 처리*돼야 "작동하는 감시"다(A-12 §1.4와 동일 논리). 시한·심각도 기준은 R-6 리서치(§12).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FLAGGED_FOR_REVIEW` | 조작 의심 신호 탐지 | 검토 큐 적재(체결은 유지) + 시한 내 사람 판단 |
| `CLEAR` | 신호 없음 | 통과 |
| (검토 후) `CONFIRMED_MANIPULATION` | 사람이 조작 확정 | 차단·계정 조치·보고 |
| (검토 후) `CLEARED` | 오탐 | 통과 + 기록 |

해설: F-02는 *사후 표시*라 *체결을 막지 않는다*(의도 판단 불가). 단 *반복·심각* 신호는 *사전 차단(pre-trade)* 신호로 승격할 수 있다(정책).

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | 정상 거래(다른 실소유) | **CLEAR** |
| T2 | 매수·매도 같은 클러스터(A-04) | **FLAGGED_FOR_REVIEW**(wash 신호) |
| T3 | 주문 생성-즉시취소 고빈도 | **FLAGGED**(spoofing) |
| T4 | 다수 호가 허수 적층 | **FLAGGED**(layering) |
| T5 | flag 시한 내 미처리 | escalate(SLA·§5.3) |
| T6 (STATEFUL) | 단발론 정상, 누적 패턴에서 wash | 이력 기반 **FLAGGED** |

---

## §8. (α) 코드 변환 패턴 선택 — 감시형(C) + STATEFUL

본 부품은 **패턴 C**(탐지·표시, 판단은 사람) + **STATEFUL**(이력 누적). 시세조종은 *의도가 요건*이라 기계가 단정하면 *정당 거래를 오차단*한다. 그래서 *객관 신호만 탐지*하고 *판단은 사람*. (A-12와 같은 C 철학, 단 F-02는 시장 *패턴*이라 STATEFUL.)

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **A-04(실소유 클러스터)**: wash trade 탐지의 핵심 — *같은 사람이 양쪽인지*를 A-04 dedup이 준다.
- **F-01(운영자 자기거래)**: 운영자 self-dealing은 종종 wash·front-running과 겹침 — F-01·F-02 연계.
- **F-03(사기 감시)**: F-02(시세조종)·F-03(사기)가 감시형 묶음. 둘 다 검토 큐·SLA 공유.
- **A-12(red flag)**: A-12의 행위 신호와 F-02의 조작 신호가 검토 큐에서 만남.
- **Recipe**: R4 시장행위 감시 — post-trade flag 중심.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 자동 탐지 | 코드 | 객관 패턴 탐지·표시·이력 누적 | 의도 판단 불가 |
| 2. 사람 감시 | Decipher 감시팀 | 조작 여부 판단·조치·보고 | 시한 준수 필요 |
| 3. 운영·보고 | 컴플라이언스 | 확정 시 계정 조치·당국 보고 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 감시 대시보드 | Off-chain(감시) | 표시된 의심 패턴·심각도·시한 |
| 사용자 안내 | Frontend | (확정 시) "이상거래 감지 — 검토 중/제한" |
| 보고 | Off-chain | 확정 조작 당국 보고 |

---

## §12. Open Issues

1. **탐지 패턴·임계(R-6)** 🔴 — wash·spoofing·layering의 *객관 탐지 기준*을 미국 집행례에서 추출. 회의 2026-06-17 R-6 리서치.
2. **처리 시한(SLA)** 🟡 — 심각도별 시한(A-12와 공유). "작동하는 감시"의 조건.
3. **STATEFUL 이력·성능** 🟡 — 이력 누적·패턴 함수의 온체인/오프체인 분담(off-chain operator 지원 — 4-Layer 뒤단).
4. **사전 차단 승격 기준** 🟡 — 반복·심각 신호를 pre-trade 차단으로 올리는 정책.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: F-02_market-surveillance.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *시세조종 감시(STATEFUL)* walkthrough 신설. 규제 맥락(조작=의도 요건→기계 단정 불가·wash/spoofing/layering·§9(a)·§10(b)·한국 §176 anchor), §2-A 경계(패턴 탐지=코드·조작 판단=사람), 근거(§9(a)·§10(b)·anti-spoofing), 로직(탐지·표시 pseudocode·STATEFUL 이력·SLA), 테스트 6종, 패턴 C+STATEFUL, A-04/F-01/F-03/A-12 coordination, Open Issues 4종(탐지패턴 R-6·SLA·STATEFUL 성능·사전차단 승격). **인용 검증 대기.** 탐지 기준은 R-6 의존. off-chain operator 뒤단 지원 필요.
