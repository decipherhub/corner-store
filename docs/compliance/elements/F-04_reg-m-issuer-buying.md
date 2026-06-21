---
type: element-walkthrough
element-id: F-04
element-name: Reg M — Issuer-Side Buying Restriction (판매 중 발행자 매수 금지)
parent-recipe: R-XJ (Cross-Jurisdictional, always-on)·R1 (Reg D 506(c) Issuance)
internal-id: ELE.F-04
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 242.101 — Reg M Rule 101(distribution participant 매수 제한): https://www.ecfr.gov/current/title-17/section-242.101"
  - "17 CFR § 242.102 — Reg M Rule 102(issuer·affiliated purchaser 매수 제한): https://www.ecfr.gov/current/title-17/section-242.102"
created: 2026-06-17
updated: 2026-06-17
tags: [element, F-04, reg-m, distribution, anti-manipulation, walkthrough, spec-sheet, R-XJ, pattern-A, adr-001]
---

# F-04 Reg M — Issuer-Side Buying Restriction (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"증권을 *판매(distribution)하는 동안*, 발행자·판매 관여자가 *그 증권을 사들이지 못하게* 막는 부품"**(내부 식별자 F-04)을 풀어 쓴 문서다. 발행 중에 파는 쪽이 동시에 사들이면 *가격을 인위적으로 떠받쳐(manipulation)* 매수인을 속일 수 있다. **Reg M**(Rules 101/102)이 이를 금지하며, 본 부품은 그 금지를 거래 직전에 강제한다. (ADR-001로 추가 결정된 부품.)
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — Reg M 101=242.101·102=242.102 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** 1차 초안. Reg M Rules 101/102의 *restricted period·distribution participant·예외(actively traded 등)* 정의는 검증 패스에서 eCFR 원문 1대1 확인(현재 "확인 요").

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** 증권을 *대중에 파는 동안(distribution)*, *파는 쪽(발행자·인수인 등)*이 동시에 *그 증권을 사들이면* — 가격을 인위적으로 떠받쳐 *"잘 팔리는 것처럼" 보이게* 조작할 수 있다. **Reg M**은 *판매 기간 중 발행자·판매 관여자의 자기 증권 매수*를 금지해 이 조작을 막는다. 본 부품은 *발행/판매가 진행 중인 자산*에서 *그 관여자가 매수자로 들어오면 차단*한다.

### 1.1 핵심 개념 — "파는 동안 사들이지 마라"

쉽게 말하면, 신규 증권을 *판매(distribution)하는 기간(restricted period)* 동안:
- **발행자(issuer)와 그 affiliated purchaser**(Rule 102), 그리고
- **distribution participant(인수인·딜러 등)**(Rule 101)
은 *그 증권(및 관련 증권)을 매수·매수유인*하면 안 된다.

이유는 명확하다 — *파는 쪽이 동시에 사들이면* 매수 압력으로 *가격을 인위적으로 부양*해, *"수요가 많다"*는 거짓 신호로 매수인을 속인다(시세 조작). Reg M은 이 *판매 중 자기매수*를 *기간 한정으로 금지*한다.

본 부품은 *distribution이 active한 자산*에서 *매수인이 그 발행/판매 관여자 명단에 있으면* — 매수를 차단한다.

### 1.2 어디서 오나

| 출처 | 무엇 |
|---|---|
| **Reg M Rule 101** (17 CFR §242.101) | *distribution participant*의 매수 제한(restricted period 중) |
| **Reg M Rule 102** (17 CFR §242.102) | *issuer·affiliated purchaser*의 매수 제한 |
| (배경) §9(a)·§10(b) | 시세조종·반사기 일반(Reg M은 그 예방적 구체화) |

### 1.3 왜 이 부품이 존재하는가

distribution 중 자기매수는 *가격 조작의 전형*이라, Reg M은 *사후 적발이 아니라 사전 예방*으로 *기간 중 매수 자체*를 금지한다. *예방적 밝은 선(bright-line) 규칙*이다. 본 부품은 그 선을 *코드로 강제*해, *발행 중인 자산의 가격 무결성*을 지킨다. (ADR-001: F-04를 element pool에 추가하기로 결정 — Reg M을 부품화.)

### 1.4 Decipher에서의 위치 — always-on(R-XJ)

F-04는 **R-XJ(다국적 관할 공통 규제 세트, always-on)**의 멤버다(A-01 제재·A-02 관할과 함께, ADR-002). 즉 *증권법 Recipe와 독립적으로, distribution이 active한 모든 거래*에 작동한다. *순수 기계 판정*(distribution active 플래그 + 매수인 ∈ 관여자 명단). distribution이 끝나면 자동 비활성.

### 1.5 한국법 비교 — 안정조작·시세조종, 모집 중 자기주식 취득 제한

한국 자본시장법도 *모집·매출 기간 중 안정조작·시세조종*을 규율하고, *자기주식 취득 제한*을 둔다. "파는 동안 인위적 가격 부양 금지"라는 발상이 Reg M과 같다. F-04는 그 금지를 *distribution active + 관여자 명단 대조*로 구현.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Reg M Issuer-Side Buying Restriction** | 판매 중 발행자·관여자 매수 차단원 |
| 검사 대상 | distribution 기간 중 *발행자/관여자가 매수자*인가 | "파는 동안 사들이나" |
| Internal ID | F-04 (Decipher PM 규약·ADR-001) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — active 플래그 + 명단 대조 | |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS**(단 distribution active 상태는 자산 속성) | 거래 시점 확인 |
| 주 활성화 Recipe | **R-XJ**(always-on, A-01·A-02와 함께)·R1 | distribution 가격 무결성 |
| 연계 부품 | **A-01**(제재)·**A-02**(관할)·**F-01**(운영자)·**B-01**(distribution 상태) | |
| 성숙도 | 🟢 완료(이번 주·ADR-001) | |
| 파일·위치 | F-04_reg-m-issuer-buying.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 명단·기간 판단에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. *누가 distribution participant인지·restricted period가 언제인지*는 정책/판단 — 명단·기간은 거버넌스/오라클이 설정.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 정책/판단이 정함 |
|---|---|
| `distributionActive` 플래그 확인 | restricted period *시작·종료* 판정(언제 distribution인가) |
| 매수인 ∈ distributionParticipants 명단 | *누가* issuer·affiliated purchaser·participant인가 |
| 명단·기간 기반 차단 | Reg M *예외*(actively traded securities 등) 판단 |

→ 온체인은 *"distribution 중인가 + 매수인이 관여자 명단인가"*만. *기간·명단·예외*는 정책/판단(off-chain).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base (배경)

> **§9(a)·§10(b)** — 시세조종·반사기 일반. Reg M은 SEC가 이 조작 위험을 *distribution 국면에서 예방적으로 구체화*한 규칙.

### 3.2 Layer 2 — Regulatory specification

> **Reg M Rule 101 (17 CFR §242.101)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-242.101)]
>
> **요지**(범위·기간·예외 확인 요): *distribution participant*(인수인·예정 인수인·브로커딜러 등)는 *restricted period* 동안 *대상 증권(및 관련 증권)을 매수·매수유인·시도*하면 안 된다. 일정 예외(actively traded securities·odd-lot 등) 있음.

> **Reg M Rule 102 (17 CFR §242.102)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-242.102)]
>
> **요지**(확인 요): *issuer·selling security holder·affiliated purchaser*는 restricted period 중 *대상 증권 매수 제한*. → F-04의 직접 근거(발행자 측 매수 금지).

### 3.3 Layer 3 — Interpretive guidance

> **SEC Reg M 해석·집행례**: restricted period 산정(distribution 규모·유동성 따라 1일/5일 등)·distribution participant 범위·예외 적용. F-04의 *기간·명단·예외*는 이 해석에서 구체화(§12).

### 3.4 Sub-요건 분해

| 요소 | 충족(차단) 조건 | 근거 |
|---|---|---|
| distribution active | restricted period 중인가 | Reg M |
| 관여자 매수 | 매수인 ∈ issuer/affiliated/participant | Rule 101·102 |
| 예외 부재 | actively traded 등 예외 아님 | Reg M 예외 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `asset.distributionActive` | bool | Manifest/오라클 | distribution(restricted period) 진행 중 |
| `asset.distributionParticipants` | set | 거버넌스/발행자 | issuer·affiliated·participant 명단 |
| `buyer.personId` | id | A-04/신원 | 매수인 신원 |
| `asset.regMExemption` | enum(선택) | 정책 | actively traded 등 예외 적용 |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_F_04(buyer, asset):
    if not asset.distributionActive:
        return PASS                              # distribution 끝나면 비활성
    if asset.regMExemption.applies():
        return PASS                              # Reg M 예외(예: actively traded)
    if buyer.personId in asset.distributionParticipants:
        return FAIL_REG_M_ISSUER_SIDE_BUYING     # 판매 중 관여자 매수 → 차단
    return PASS
```

- **해설**: distribution active일 때만 작동. 매수인이 *발행/판매 관여자 명단*이면 차단. *기간·명단·예외*는 정책/판단(§2-A). distribution 종료 시 자동 비활성.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_REG_M_ISSUER_SIDE_BUYING` | distribution 중 관여자 매수 | 차단 + 기록(Reg M 위반 예방) |
| `PASS` | 비-distribution·예외·무관 매수인 | 통과 |

해설: F-04는 *예방적 bright-line* — distribution 중 관여자 매수를 *기간 한정으로* 막는다. distribution이 끝나면 같은 사람도 매수 가능(영구 차단 아님).

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | distribution 미진행, 누구나 매수 | **PASS** |
| T2 | distribution 중, 발행자가 자기 증권 매수 | **FAIL_REG_M_ISSUER_SIDE_BUYING** |
| T3 | distribution 중, 인수인(participant) 매수 | **FAIL** |
| T4 | distribution 중, 무관한 일반 매수인 | **PASS** |
| T5 | distribution 중이나 actively traded 예외 | **PASS**(예외) |
| T6 | distribution 종료 후, 전 관여자 매수 | **PASS**(기간 종료) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A**(active 플래그 + 명단 대조). 사람 판단 0(차단 로직). *restricted period 산정·participant 명단·예외 판단*만 off-chain 정책/판단. distribution 상태는 자산 속성(STATELESS 판정).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **R-XJ always-on(A-01·A-02)**: F-04는 A-01(제재)·A-02(관할)과 함께 R-XJ always-on. 단 F-04는 *distribution active일 때만* 실질 작동(조건부 always-on).
- **F-01(운영자 자기거래)·F-02(시세조종)**: distribution 중 자기매수는 시세조종(F-02)·운영자 self-dealing(F-01)과 겹칠 수 있음 — 감시 연계.
- **B-01(Manifest)·오라클**: distributionActive 상태·participant 명단은 Manifest/오라클이 제공, B-01이 무결성 보증.
- **A-04(신원)**: 매수인이 관여자인지 식별에 신원 매핑(차명 우회 방지).
- **Recipe**: R-XJ(always-on)·R1(발행). distribution 가격 무결성 게이트.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 | 코드 | active 플래그 + 명단 대조·차단 | 기간·명단·예외는 입력 |
| 2. 정책/오라클 | 발행자·거버넌스 | restricted period 산정·participant 명단·예외 | 판단 |
| 3. 감시 | Decipher | distribution 중 이상매수 사후 감시(F-02 연계) | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| distribution 상태 설정 | Off-chain(오라클/거버넌스) | restricted period 시작·종료·participant 명단 |
| 차단 안내 | Frontend | "판매 기간 중 — 발행/판매 관여자 매수 제한(Reg M)" |
| 예외 판정 | Off-chain | actively traded 등 예외 적용 |

---

## §12. Open Issues

1. **restricted period 산정** 🟡 — distribution 규모·유동성에 따른 1일/5일 등 기간 산정 규칙(Reg M 해석). 변호사 확인.
2. **distribution participant·affiliated purchaser 범위** 🟡 — 누가 명단에 드나(F-01 인적 경계와 연계).
3. **Reg M 예외(actively traded 등)** 🟡 — 어떤 예외가 우리 자산에 적용되나.
4. **distributionActive 오라클** 🟢 — 발행 진행 상태를 누가·어떻게 온체인에 반영하나.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: F-04_reg-m-issuer-buying.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *Reg M 판매 중 발행자·관여자 매수 금지* walkthrough 신설(ADR-001로 추가 결정된 부품). 규제 맥락("파는 동안 사들이지 마라"=가격 조작 예방·Rule 101 participant·102 issuer·§9(a)/§10(b) 배경·한국 안정조작·자기주식 anchor), §2-A 경계(active+명단 대조=온체인·기간/명단/예외=정책), 근거(Reg M 101/102), 로직(active+명단 pseudocode·기간 한정), 테스트 6종, 패턴 A, R-XJ always-on(A-01·A-02와)·F-01/F-02 coordination, Open Issues 4종(restricted period·participant 범위·예외·오라클). **인용 검증 대기.** distribution active일 때만 실질 작동하는 조건부 always-on.
