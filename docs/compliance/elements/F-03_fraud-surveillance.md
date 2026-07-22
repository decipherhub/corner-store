---
type: element-walkthrough
element-id: F-03
element-name: Fraud Surveillance (사기 감시·의심거래)
parent-recipe: R4 (시장행위 감시)
internal-id: ELE.F-03
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
stateful: true
related-external-sources:
  - "15 U.S.C. § 78j(b) — §10(b)/Rule 10b-5 반사기: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim"
  - "15 U.S.C. § 77q(a) — Securities Act §17(a) 사기 금지: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77q&num=0&edition=prelim"
created: 2026-06-17
updated: 2026-06-17
tags: [element, F-03, fraud, suspicious-transaction, stateful, walkthrough, spec-sheet, R4, pattern-C]
---

# F-03 Fraud Surveillance — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"의심스러운 사기성 거래를 감시·표시하고 처리 기록을 남기는 부품"**(내부 식별자 F-03)을 풀어 쓴 문서다. F-02(시세조종)가 *가격 조작*에 초점이라면, F-03은 *사기 일반*(허위·기만·이상 자금흐름)에 초점이다. 역시 *고의·기만*이 요건이라 *기계가 단정 못 하므로* — 객관 이상신호를 표시하고 사람이 판단한다(패턴 C, STATEFUL).
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — §10(b)·§17(a)=77q(a) 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** 1차 초안. §10(b)·§17(a) 범위·문언은 검증 패스에서 원문 1대1 확인(현재 "확인 요"). 의심거래 판단 기준·처리 시한은 R-6 리서치 대상.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** 증권 사기(securities fraud)는 *허위·기만으로 투자자를 속이는* 광범위한 행위다(§10(b)·§17(a)). F-02가 *시장가격 조작*에 특화라면, F-03은 *사기 일반·이상 거래*를 본다. 사기도 *기만 의도*가 요건이라 *기계가 단정 못 한다* — 그래서 *의심 신호를 표시·기록*하고 *판단·보고는 사람*이 한다(감시형).

### 1.1 핵심 개념 — "의심거래를 표시하고 기록한다"

쉽게 말하면, 사기성 거래는 다양하다 — *허위 정보 기반 거래, 이상 자금흐름, 계정 탈취 의심, 비정상 패턴* 등. 이들의 공통점은 *기만 의도*가 핵심 요건이고, *기계가 의도를 단정할 수 없다*는 것.

그래서 F-03은:
- *객관적으로 탐지 가능한 이상 신호*를 포착(비정상 패턴·이상 흐름),
- 그것을 *의심거래로 표시(flag)하고 기록*(처리 기록 양식),
- *진짜 사기인지 판단·보고는 사람*(감시팀)이.

이는 *"의심거래보고(SAR)"* 발상과 같다 — *의심을 인지하면 기록·보고하고, 방치하지 않는다.* F-03은 그 *인지·기록*을 시스템화한다.

### 1.2 어디서 오나

| 출처 | 무엇 |
|---|---|
| **§10(b) / Rule 10b-5** | 증권 거래 *기만·사기* 일반 금지 |
| **Securities Act §17(a)** | 증권 *offer·sale*의 사기 금지 |
| (배경) BSA/AML SAR | 의심거래보고 — *인지·기록·보고* 의무의 발상 |

### 1.3 왜 이 부품이 존재하는가

*의심을 인지하고도 방치*하면 — *willful blindness*(A-12 §1.1)로 책임이 커지고, 사기 피해가 확산된다. F-03은 *의심거래를 적시 포착·기록*해 ① 사기 확산을 막고 ② *"우리는 감시·기록했다"*는 방어선을 만든다. (회의 2026-06-17: 의심 판단 기준·처리 기록 양식·시한은 R-6 리서치.)

### 1.4 Decipher에서의 위치 — F-02의 자매, STATEFUL

F-03은 R4(시장행위 감시)에서 F-02의 자매 부품이다 — F-02=시세조종(가격), F-03=사기 일반(기만·이상흐름). 둘 다 *감시형(C)·STATEFUL·post-trade flag·검토 큐·SLA*를 공유한다. *이상 패턴*을 보려면 거래 이력 상태가 필요해 STATEFUL.

### 1.5 한국법 비교 — 부정거래·의심거래보고(STR)

한국 자본시장법 §178(부정거래행위 금지)·특금법 *의심거래보고(STR)*가 발상의 짝이다. "의심을 인지하면 보고·기록한다"가 같다. F-03은 그 인지·기록을 *온체인 이상신호 탐지 + 사람 판단·보고*로 구현(단 F-03은 자금세탁이 아니라 *증권 사기*에 초점 — AML/KYC는 별도 트랙).

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Fraud Surveillance** | 의심거래·사기 감시·기록원 |
| 검사 대상 | 거래에 *사기·기만 의심 신호*가 있는가 | "사기 의심이 보이나" |
| Internal ID | F-03 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **감시형(패턴 C)** — 탐지·표시·기록, 판단은 사람 | flag + SAR식 기록 |
| Timing | **post-trade flag** | 사후 표시 |
| Stateful 여부 | **STATEFUL** ⭐ | 이상 패턴·이력 추적 |
| 주 활성화 Recipe | **R4**(시장행위 감시) | 시장 무결성·반사기 |
| 연계 부품 | **F-02**(시세조종)·**A-12**(red flag)·**A-04**(신원) | |
| 성숙도 | 🟡 정밀화 — 의심 기준·기록 양식·시한(R-6) | |
| 파일·위치 | F-03_fraud-surveillance.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 코드가 하는 일 / 사람이 판단하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*(객관 이상신호 탐지·기록). *사기 여부·보고*는 *사람(감시)*이 — 코드가 단정하지 않는다.

| ✅ 코드가 확인/구현 (결정론적 탐지) | 🔵 사람(감시)이 판단 |
|---|---|
| 이상 패턴·흐름 신호 탐지(비정상 빈도·경로·금액) | 그 신호가 *진짜 사기인지*(기만 의도) |
| 의심거래 표시·*처리 기록 양식* 생성·이력 누적 | 의심 *판단 기준* 정의(R-6) |
| 검토 큐 적재·SLA 추적 | 보고(SAR식)·계정 조치 결정 |

→ 코드는 *"이상하다·기록했다"*까지. *"이게 사기다·보고한다"*는 사람. (기만 의도가 요건이라 자동 단정 불가.)

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **§10(b) / Rule 10b-5 (15 U.S.C. §78j(b))** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim)]
>
> **요지**: 증권 거래의 *기만적·사기적* 행위 금지. F-03 사기 감시의 포괄 근거.

> **Securities Act §17(a) (15 U.S.C. §77q(a))** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77q&num=0&edition=prelim)]
>
> **요지**: 증권의 *offer·sale*에서 사기·허위·기만 금지. 발행·판매 단계 사기의 근거.

### 3.2 Layer 2/3 — 의심거래 기록·집행

> SEC 집행례·시장감시 관행 + (발상의 짝) BSA SAR(의심거래보고). F-03의 *탐지 기준·기록 양식*은 집행례·관행에서 추출(R-6).

### 3.3 Sub-요건 분해

| 신호 | 객관 탐지(개념) | 근거 |
|---|---|---|
| 이상 흐름 | 비정상 금액·빈도·경로 | §10(b) |
| 허위 정황 | claim·정보 불일치 패턴(A-12 연계) | §17(a) |
| 계정 이상 | 탈취 의심 패턴 | §10(b) |
| (의도) | *기계 불가 → 사람* | (요건) |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `txPatternState` | struct(상태) | 온체인 이력 | 누적 거래·흐름 패턴(STATEFUL) |
| `anomalySignals` | enum[] | 탐지 엔진 | 이상 신호(빈도·금액·경로) |
| `redFlagLink` | ref | A-12 | red flag 연계 신호 |
| `fraudRules` | ruleset | 운영(R-6) | 의심 판단 기준 |
| `caseRecord` | struct(상태) | 운영 | 의심거래 처리 기록(SAR식) |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function surveil_F_03(trade, asset):           # post-trade
    signals = detect_anomalies(trade, TxPatternState[asset], fraudRules)
    TxPatternState[asset].update(trade)        # STATEFUL 갱신
    if signals:
        record = open_case(trade, signals)     # 처리 기록 양식(SAR식) 생성
        log_review(record)                     # 검토 큐(사람 판단)
        return FLAGGED_SUSPICIOUS
    return CLEAR
```

- **해설**: 이상 신호 탐지 → *의심거래 기록(case) 생성* → 검토 큐. *사기 여부·보고는 사람*. 기록 생성 자체가 *"인지·기록했다"*는 방어선(willful blindness 회피). 거래는 *이미 체결*(post-trade).

### 5.2 기록의 의미 — "인지하고 기록했다"

F-03의 핵심 산출은 *판정*이 아니라 *기록(case record)*이다. 의심을 *인지하고 기록·검토*했다는 사실이 — A-12·SAR 발상처럼 *방어선*이다. *기록 양식*(무엇을·언제·어떻게 처리)이 R-6 산출물.

### 5.3 처리 시한(SLA)

F-02와 동일 — 표시는 *시한 내 처리*돼야 "작동하는 감시". 심각도별 시한은 R-6.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FLAGGED_SUSPICIOUS` | 사기 의심 신호 | 의심거래 기록 생성 + 검토 큐 + 시한 내 판단 |
| `CLEAR` | 신호 없음 | 통과 |
| (검토 후) `CONFIRMED_FRAUD` | 사람이 사기 확정 | 차단·계정 조치·보고 |
| (검토 후) `CLEARED` | 오탐 | 통과 + 기록 |

해설: F-03도 *사후 표시*(체결 안 막음). 단 *명백·심각* 신호(계정 탈취 등)는 *사전 차단·즉시 동결*로 승격 가능(정책).

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | 정상 거래 | **CLEAR** |
| T2 | 비정상 금액·빈도·경로 | **FLAGGED_SUSPICIOUS** + 기록 |
| T3 | A-12 red flag 연계 신호 | **FLAGGED**(연계) |
| T4 | 계정 탈취 의심 패턴 | **FLAGGED**(+심각 시 동결 승격) |
| T5 | flag 시한 내 미처리 | escalate(SLA) |
| T6 (STATEFUL) | 단발 정상, 누적 이상 패턴 | 이력 기반 **FLAGGED** |

---

## §8. (α) 코드 변환 패턴 선택 — 감시형(C) + STATEFUL

본 부품은 **패턴 C**(탐지·기록, 판단은 사람) + **STATEFUL**(이력 누적). 사기는 *기만 의도*가 요건이라 기계 단정 시 정당 거래 오차단. F-02와 같은 C 철학·STATEFUL, 단 *초점이 가격 조작이 아니라 사기 일반*.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **F-02(시세조종)**: F-02·F-03 = 감시형 자매. 검토 큐·SLA·STATEFUL 인프라 공유(가격 조작 vs 사기 일반).
- **A-12(red flag)**: A-12의 행위·출처 신호가 F-03 의심 신호로 흘러듦(허위 정황 등).
- **A-04(신원)**: 이상 흐름·계정 이상 판단에 신원 클러스터 활용.
- **Recipe**: R4 시장행위 감시 — post-trade flag·기록.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 자동 탐지 | 코드 | 이상 신호 탐지·기록 생성·이력 누적 | 사기 의도 판단 불가 |
| 2. 사람 감시 | Decipher 감시팀 | 사기 여부 판단·조치 | 시한 준수 |
| 3. 보고·조치 | 컴플라이언스 | 확정 시 보고·계정 조치 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 의심거래 큐 | Off-chain(감시) | 표시된 의심거래·기록·시한 |
| 사용자 안내 | Frontend | (확정/심각 시) "이상거래 — 검토/제한" |
| 보고 | Off-chain | 확정 사기 보고·기록 보존 |

---

## §12. Open Issues

1. **의심 판단 기준·기록 양식(R-6)** 🔴 — 무엇을 의심거래로 보고 어떻게 기록하나(SAR식 양식). 회의 2026-06-17 R-6.
2. **처리 시한(SLA)** 🟡 — 심각도별(F-02 공유).
3. **STATEFUL 이력·off-chain 지원** 🟡 — 이상 패턴 탐지의 온/오프체인 분담(4-Layer 뒤단).
4. **AML/KYC와의 경계** 🟡 — F-03(증권 사기) vs AML SAR(자금세탁) 트랙 분리(회의: AML은 별도 통합 대상).

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: F-03_fraud-surveillance.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *사기·의심거래 감시(STATEFUL)* walkthrough 신설. 규제 맥락(사기=기만 의도→기계 단정 불가·§10(b)·§17(a)·SAR 발상·한국 §178·STR anchor), §2-A 경계(이상신호 탐지·기록=코드·사기 판단=사람), 근거(§10(b)·§17(a)·SAR), 로직(탐지·기록·검토 pseudocode·"인지·기록" 방어선·STATEFUL·SLA), 테스트 6종, 패턴 C+STATEFUL, F-02/A-12/A-04 coordination, Open Issues 4종(판단기준·기록양식 R-6·SLA·STATEFUL·AML 경계). **인용 검증 대기.** F-02의 자매(가격조작 vs 사기일반). AML과는 별도 트랙.
