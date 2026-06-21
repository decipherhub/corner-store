---
type: element-walkthrough
element-id: F-01
element-name: Operator Self-Dealing Restriction (운영자 자기거래 제한)
parent-recipe: R4 (시장행위 감시)
internal-id: ELE.F-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 U.S.C. § 78j(b) — Exchange Act §10(b) 반사기(이해상충·자기거래 남용): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim"
  - "15 U.S.C. § 80a-17 — ICA §17 affiliate transaction 제한(펀드): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-17&num=0&edition=prelim"
created: 2026-06-17
updated: 2026-06-17
tags: [element, F-01, self-dealing, operator, conflict, walkthrough, spec-sheet, R4, pattern-A]
---

# F-01 Operator Self-Dealing Restriction — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"운영 주체(Decipher 및 그 임직원·계열)가 *자기 시장에서 자기거래·이해상충 거래*를 하지 못하게 막는 부품"**(내부 식별자 F-01)을 풀어 쓴 문서다. 매수인 자격이 아니라 **운영자 측 행위**를 본다 — DEX 운영자가 *자기가 운영하는 시장에서* 이용자와 맞붙어 거래하거나 front-running 하는 *이해상충*을 차단한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — §10(b)=78j(b)·ICA §17=80a-17 매핑 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** 1차 초안. §10(b)·ICA §17의 적용 범위·문언은 검증 패스에서 원문 1대1 확인(현재 "확인 요"). F-01은 인적 경계(누가 운영자측인가) 정의가 R-3 리서치 대상.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가 (Context First)

> **왜 맥락부터.** 시장을 *운영하는 자*가 *그 시장에서 자기 잇속으로 거래*하면 이해상충이다 — 이용자보다 유리한 정보·위치로 *자기거래(self-dealing)·front-running*을 할 수 있다. 미국법은 이를 *반사기(§10(b))·펀드 affiliate 거래 제한(ICA §17)*으로 규율한다. F-01은 *운영자 측이 자기 시장에서 부적절히 거래하지 못하게* 막는다.

### 1.1 핵심 개념 — "심판이 선수로 뛰면 안 된다"

쉽게 말하면, Decipher(DEX 운영 주체)와 *그 임직원·계열사*가 *자기가 운영하는 시장에서* 거래하면 — 이용자 주문을 미리 보고 *front-running*하거나, *자기에게 유리한 체결*을 만드는 *이해상충*이 생긴다. *심판이 선수로 뛰는* 격이다.

미국법은 이런 *운영자 이해상충·자기거래*를 직접 금지하거나(펀드: ICA §17 affiliate transaction), *반사기 일반조항(§10(b)/Rule 10b-5)*으로 규율한다. F-01은 *운영자 측 인물(Decipher entity·임직원·계열)*이 거래 당사자인지 확인해, 부적절한 자기거래를 *차단하거나 표시*한다.

### 1.2 어디서 오나

| 출처 | 무엇 |
|---|---|
| **§10(b) / Rule 10b-5** | 반사기 — 이해상충·기만적 자기거래 일반 금지 |
| **ICA §17**(펀드) | affiliate transaction 제한(펀드와 그 관계자 간 거래 규율) |
| (배경) broker-dealer 이해상충·Reg BI | 중개자의 고객 이익 우선 의무 |

### 1.3 왜 이 부품이 존재하는가

DEX가 *신뢰받는 시장*이려면, *운영자가 이용자와 맞붙어 잇속을 챙기지 않는다*는 보장이 필요하다. 자기거래·front-running은 *시장 무결성·반사기*의 핵심 위험이다. F-01은 *운영자 측의 거래 참여를 통제*해 그 위험을 막고, *"운영자는 심판일 뿐 선수가 아니다"*를 코드로 강제한다. (회의 2026-06-17: F-01의 *인적 경계*(본인·임직원·계열)가 R-3 리서치 대상.)

### 1.4 Decipher에서의 위치

F-01은 *시장행위 감시(R4)*의 운영자 측 부품(F 도메인). F-02(시장조작 감시)·F-03(사기 감시)와 묶이되, F-01은 *운영자 자기거래*에 특화. *대체로 기계 판정*(거래 당사자가 운영자 측 명단에 있는가) — 단 *경계 사례(간접 계열·일상 hedging)*는 판단이 섞여 review로 갈 수 있다.

### 1.5 한국법 비교 — 자기계약·이해상충 금지

한국 자본시장법도 *금융투자업자의 자기거래·이해상충 관리* 의무, *임직원 자기매매 제한*을 둔다. "운영자·임직원이 자기 시장에서 부당 거래 못 하게"라는 발상이 같다. F-01은 그 제한을 *운영자측 명단 대조*로 구현.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Operator Self-Dealing Restriction** | 운영자측 자기거래·이해상충 차단원 |
| 검사 대상 | 거래 당사자가 *Decipher entity·임직원·계열*인가 | "심판이 선수로 뛰나" |
| Internal ID | F-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 운영자측 명단 대조 | + 경계는 review |
| Timing | **pre-trade**(+ 사후 감시 연계) | 거래 직전 |
| Stateful 여부 | **STATELESS** | 당사자 명단 확인 |
| 주 활성화 Recipe | **R4**(시장행위 감시) | 운영 무결성 |
| 연계 부품 | **F-02/F-03**(시장조작·사기 감시)·**A-04**(신원) | |
| 성숙도 | 🟡 정밀화 — 인적 경계 정의(R-3) | |
| 파일·위치 | F-01_operator-self-dealing.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 정책·판단에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. *누가 운영자측인가의 경계*(간접 계열 등)는 정책/판단 — 명단은 거버넌스가 관리.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 정책/판단이 정함 |
|---|---|
| 거래 당사자 ∈ 운영자측 명단(restricted list) | *누가* 운영자측인가(본인·임직원·계열 경계) |
| 명단 기반 차단/표시 | 간접 계열·일상 hedging 등 *경계 판단* |
| | 허용되는 운영 거래(유동성 공급 등)의 정책 |

→ 온체인은 *명단 대조*만. *명단에 누구를 넣을지(인적 경계 판단)*는 정책/거버넌스(off-chain).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **Exchange Act §10(b) (15 U.S.C. §78j(b))** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78j&num=0&edition=prelim)]
>
> **요지**: 증권 거래에 관한 *기만적·조작적 행위* 일반 금지(Rule 10b-5). 운영자의 *기만적 자기거래·front-running*이 여기 걸린다.

> **ICA §17 (15 U.S.C. §80a-17)** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-17&num=0&edition=prelim)] *(펀드 맥락)*
>
> **요지**: 등록 투자회사와 *affiliated person* 간의 *self-dealing 거래*를 제한·금지. → 펀드(BUIDL) 맥락에서 운영자·관계자 자기거래의 직접 근거(다만 BUIDL은 §3(c)(7) 면제 펀드라 §17 적용 범위는 변호사 확인 — §12).

### 3.2 Layer 2/3 — 중개자 이해상충

> broker-dealer 이해상충·Reg BI(고객 이익 우선)·시장 무결성 일반. DEX 운영자의 *심판-선수 분리* 원칙의 배경.

### 3.3 Sub-요건 분해

| 요소 | 충족(차단) 조건 |
|---|---|
| 직접 운영자 | 당사자 = Decipher entity | 차단 |
| 임직원 | 당사자 = 운영 임직원 | 차단/표시 |
| 계열 | 당사자 = 계열사(직간접) | 경계 → review |
| 허용 운영거래 | 정책상 허용(예: 명시적 유동성 공급) | 통과 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `party.personId` | id | A-04/신원 | 거래 당사자 신원 |
| `operatorRestrictedList` | set | 거버넌스(운영) | 운영자측 명단(entity·임직원·계열) |
| `party.affiliationFlag` | enum | claim/명단 | 직접/임직원/계열/무관 |
| `policy.allowedOperatorTrades` | enum | 정책 | 허용되는 운영 거래 유형 |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_F_01(buyer, seller, asset):
    for party in [buyer, seller]:
        flag = operatorAffiliation(party.personId)   # 명단 기반
        if flag == OPERATOR_ENTITY or flag == OPERATOR_EMPLOYEE:
            if not policy.allowedOperatorTrades.permits(party, asset):
                return FAIL_OPERATOR_SELF_DEALING       # 운영자측 부적절 거래 차단
        elif flag == OPERATOR_AFFILIATE:
            return REVIEW_OPERATOR_AFFILIATE             # 계열 경계 → 사람 검토
    return PASS
```

- **해설**: 당사자가 운영자측 명단에 있으면 차단(직접·임직원) 또는 review(계열 경계). *명단에 누구를 넣는지*는 정책/거버넌스(§2-A). 일상적 *허용 운영거래*(명시적 유동성 공급 등)는 정책으로 예외.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_OPERATOR_SELF_DEALING` | 운영자 본인·임직원의 부적절 거래 | 차단 + 기록(이해상충 로그) |
| `REVIEW_OPERATOR_AFFILIATE` | 계열 경계(간접) | manual review |
| `PASS` | 무관 또는 허용 운영거래 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | 일반 이용자 간 거래 | **PASS** |
| T2 | Decipher 운영 entity가 이용자와 맞거래 | **FAIL_OPERATOR_SELF_DEALING** |
| T3 | 운영 임직원이 자기 시장에서 매수 | **FAIL**(또는 정책상 표시) |
| T4 | 간접 계열사 거래 | **REVIEW_OPERATOR_AFFILIATE** |
| T5 | 정책상 명시 허용된 유동성 공급 | **PASS** |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) + 경계 review

본 부품은 **패턴 A**(명단 대조)이되, *계열 경계*는 판단이 섞여 review(C 요소). *명단에 누구를 넣는지(인적 경계)*는 off-chain 정책. 직접·임직원은 결정론적 차단.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **F-02/F-03(시장조작·사기 감시)**: F-01(운영자 자기거래)·F-02(시장조작)·F-03(사기)가 R4 시장행위 감시를 함께 구성. 운영자 self-dealing은 종종 wash trade(F-02)·front-running과 겹침.
- **A-04(신원)**: 당사자가 운영자측인지 식별에 A-04 신원 매핑 사용(차명 운영자 우회 방지).
- **Recipe**: R4 시장행위 감시 — 운영 무결성 게이트.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 명단 | 코드 | 운영자측 명단 대조·차단 | 명단 정의는 거버넌스 |
| 2. 거버넌스/정책 | Decipher | 인적 경계(임직원·계열) 명단·허용거래 정책 | 경계 판단 |
| 3. 사후 감시 | 운영·감사 | front-running·이해상충 사후 탐지(F-02 연계) | 확률적 |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 명단 관리 | Off-chain(거버넌스) | 운영자측 인적 명단 갱신(임직원·계열) |
| 차단 기록 | Off-chain | 이해상충 차단·검토 로그(반사기 방어) |
| 허용거래 정책 | Off-chain | 명시적 유동성 공급 등 허용 범위 정의 |

---

## §12. Open Issues

1. **인적 경계 정의(R-3)** 🔴 — 본인·임직원·계열(직간접)의 정확한 범위. 회의 2026-06-17 R-3 리서치 대상.
2. **ICA §17 적용 범위** 🟡 — BUIDL=§3(c)(7) 면제 펀드일 때 §17 affiliate 거래 제한이 어디까지 적용되나. 변호사 확인.
3. **허용 운영거래** 🟡 — 유동성 공급 등 *정당한 운영 거래*와 *부당 자기거래*의 경계 정책.
4. **차명 운영자 우회** 🟡 — A-04와 연계해 운영자측의 차명·신규신원 우회 탐지.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: F-01_operator-self-dealing.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *운영자 자기거래·이해상충 제한* walkthrough 신설. 규제 맥락(심판-선수 분리·§10(b) 반사기·ICA §17 펀드 affiliate·한국 자기계약 금지 anchor), §2-A 경계(명단 대조=온체인·인적 경계 판단=정책), 근거(§10(b)·ICA §17·Reg BI), 로직(명단 대조 pseudocode·계열 review), 테스트 5종, 패턴 A+경계 review, F-02/F-03/A-04 coordination, Open Issues 4종(인적경계 R-3·ICA §17 범위·허용거래·차명우회). **인용 검증 대기.** 인적 경계는 R-3 리서치 의존.
