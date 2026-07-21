---
type: recipe-spec-sheet
recipe-id: R3
recipe-name: ICA §3(c)(7) Fund
internal-id: RCP.R3
legal-effect: "발행자가 ICA상 investment company가 아님(§3(c)(7) 제외) → ICA 등록·실체규제 면제"
status: v1.0 — 조문별 삼단논법 (always-on cumulative: 매 거래 전원 QP 유지)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 U.S.C. § 80a-3(a)(1)(C) — investment company 정의(증권 40% 초과): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-3&num=0&edition=prelim"
  - "15 U.S.C. § 80a-3(c)(7) — §3(c)(7) 제외(전원 QP·비공개): 동 URL §(c)(7)"
  - "15 U.S.C. § 80a-2(a)(51) — qualified purchaser($5M/$25M) 정의: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-2&num=0&edition=prelim"
  - "15 U.S.C. § 78l(g) — Exchange Act §12(g) 등록 트리거(보유자 수): 별건, D-01 근거"
  - "17 CFR § 270.3c-5 — knowledgeable employee 예외: https://www.ecfr.gov/current/title-17/section-270.3c-5"
created: 2026-06-17
updated: 2026-06-17
tags: [recipe, R3, ica, 3c7, qualified-purchaser, investment-company, always-on, cumulative, spec-sheet]
---

# R3 — ICA §3(c)(7) Fund (Recipe 명세 = 조문별 삼단논법, always-on cumulative)

> **이 문서는 무엇인가.** Recipe = *하나의 법률효과를 논증.* R3가 증명할 효과는 **"이 발행자(토큰 펀드/SPV)는 1940년 投資會社法(ICA)상 'investment company'가 *아니다* — §3(c)(7) 제외 — 따라서 ICA 등록·실체규제를 받지 않는다."**
> **R1·R2와 구조가 또 다르다.** R1(발행)=발행 시점 1회 검사, R2(전매)=경로 OR. **R3는 *상시(always-on) 누적 조건***: §3(c)(7)(A)가 *"outstanding securities ... owned exclusively by ... qualified purchasers"* 라고 *현재형·전원*을 요구하므로 — **발행·전매·모든 이전 시점마다 *전 보유자 QP*가 유지**돼야 한다. 그래서 R3는 R1·R2에 *항상 cumulative*로 얹힌다.
> **자산 일반성(ADR-006):** R3는 *§3(c)(7) 구조를 쓰는 모든 자산*에 적용. 펀드 여부·QP 요건은 `Manifest.fundExemption` 값 — BUIDL의 `ICA_3C7`은 *예시*. §3(c)(7) 구조가 아닌 자산엔 R3 미발동.

---

## §1. 법률효과 + 법적 사슬

**효과(소결론): "발행자는 ICA상 investment company가 아니다(§3(c)(7)) → ICA 등록·규제 면제."**

```
문제:  RWA 토큰이 underlying 증권을 담는 SPV/펀드 → §3(a)(1)(C) "investment securities > 총자산 40%"
        → ICA상 "investment company" 해당 → ICA 등록·실체규제 의무 (매우 부담)
   │
§3(c)(7) [15 U.S.C. §80a-3(c)(7)(A)] 제외 — 두 요건 충족 시:
        ㉠ 발행증권 전부를 *취득시점 QP*가 보유 (exclusively, 현재형)
        ㉡ public offering을 하지 않음
   │
효과:  "investment company 아님" → ICA Subchapter I 적용 배제
```
→ R3 과제: **㉠·㉡이 *모든 시점에* 충족됨을 보이면 → 효과 *유지*.** (1회가 아니라 *상시*.)

> **R1과의 미묘한 차이(중요).** 506(c)는 *general solicitation을 허용*(R1 ㈏). 그러나 §3(c)(7)(A) 후단은 *"not ... public offering"* 요구. 충돌 아님 — 506(c) offering은 §4(a)(2)(비공개) 기반으로 *"public offering 아님"으로 취급*되므로 양립. 단 **B-04(폐쇄 풀)이 양쪽 조건을 동시 충족시키는 핵심.**

---

## §2. 📋 메타 + 요약

| 항목 | 값 |
|---|---|
| Recipe / ID | ICA §3(c)(7) Fund / **R3** |
| ① 법률효과 | **발행자 ≠ investment company → ICA 면제** |
| ② 논증 | §3(c)(7)(A) 조문 삼단논법 — ㉠ 전원 QP / ㉡ 비공개 + QP 정의 §2(a)(51) |
| ③ Activation | `Manifest.fundExemption == ICA_3C7` (§3(c)(7) 구조 자산) — **모든 거래** |
| ④ Composition | ㉠ A-13(전원·상시) ∧ ㉡ B-04∧A-12 ∧ [§12(g) 별건 cumulative: D-01] |
| ⑤ 거절 | `RECIPE_R3_3C7_FAIL` + 미충족 요건·부품 |
| ⑥ Conflict | **R1·R2에 항상 cumulative** (상시 전원 QP)·R-XJ always-on |

---

## §3. ① 법률효과

**"발행자가 ICA investment company가 아님 → ICA 등록·실체규제 면제."** 단, *전원 QP·비공개를 매 거래 유지*해야(상시).

---

## §4. ② 법률 논증 — 조문별 삼단논법

> **읽는 법.** §4.0에서 *문제*(왜 SPV가 investment company인가)를 세우고, §4.1~§4.2에서 §3(c)(7)(A) *두 요건*을 조문 삼단논법으로, §4.3에서 QP 정의(§2(a)(51))를, §4.4에서 *별건이지만 함께 가는* §12(g) 보유자 cap을, §4.5에서 gap을 처리한다.

### §4.0 문제 설정 — §3(a)(1)(C) investment company

> **15 U.S.C. §80a-3(a)(1)(C)**: investment company = *"engaged ... in ... investing ... in securities, and owns ... investment securities having a value exceeding 40 per centum of ... total assets ..."*

→ RWA 토큰이 *underlying 증권을 담는 SPV*면 증권이 자산의 40% 초과 → investment company 해당 → ICA 등록·규제. 이를 피할 제외가 §3(c)(7).

---

### §4.1 ㉠ §3(c)(7)(A) 전단 — 전원 QP (exclusively, 취득시점·현재형)

> **§80a-3(c)(7)(A)**: *"Any issuer, the outstanding securities of which are **owned exclusively by persons who, at the time of acquisition** of such securities, **are qualified purchasers** ..."*

- **대전제:** 발행증권 *전부*를 *각 취득시점에 QP인 자*가 보유해야. (*exclusively* = 한 명이라도 비-QP면 제외 상실.)
- **소전제(부품):** **A-13**(QP claim 확인 — $5M/$25M). 매수인이 법인이면 **A-08**(entity 판정)→(투자목적 설립 등 look-through 필요 시) **A-09**(소유자 분해). **모든 이전(transfer)마다** 매수인 A-13 PASS 강제(상시).
- **소결론:** ∴ ∀holder A-13 PASS(상시) ⟹ ㉠ 충족. *한 거래라도 비-QP 유입 → ㉠ 붕괴 → §3(c)(7) 상실.*

> **gift/bequest/involuntary 예외:** §3(c)(7)(A) 2문 — 증여·유증·이혼·사망 등 *비자발 이전*으로 QP에게서 받은 자는 *QP로 간주.* → off-chain claim(B류)·예외 플래그(§4.5).

### §4.2 ㉡ §3(c)(7)(A) 후단 — public offering 아님

> **§80a-3(c)(7)(A)**: *"... and which **is not making and does not at that time propose to make a public offering** of such securities."*

- **대전제:** 발행자가 *공개모집(public offering)을 하지 않을 것.*
- **소전제(부품):** **B-04**(엔진 — RFQ/whitelist 폐쇄 풀로 공개모집 차단) + **A-12**(권유 행태 red flag). *(§1 주: 506(c) general solicitation과 양립 — 506(c)는 §4(a)(2) 비공개 취급.)*
- **소결론:** ∴ B-04(폐쇄 풀) ∧ A-12 ⟹ ㉡ 충족.

### §4.3 QP 정의 — §2(a)(51) ($5M / $25M)

> **15 U.S.C. §80a-2(a)(51)(A)**(요지): QP = (i) ≥$5M 투자자산 보유 *자연인* / (ii) ≥$5M *family company* / (iii) 일정 *trust* / (iv) 재량으로 *≥$25M* 투자자산 운용 *기관*.

- **역할:** ㉠의 "qualified purchaser"를 *정의*. **A-13**이 이 임계($5M/$25M)로 판정. **임계값은 *법령 상수* → 자산 무관**(ADR-006 §2 불변식①의 예외적 상수 허용).
- **소결론:** A-13.threshold = §2(a)(51) 상수 ⟹ ㉠의 QP 판정 기준 확정.

### §4.4 (별건·cumulative) 보유자 2000 cap — Exchange Act §12(g)

> ⚠️ **정확성 주의:** §3(c)(7) *자체엔 보유자 수 제한이 없다*(§3(c)(1)의 "100인"과 *다름*). 토큰이 2000명(또는 비적격 500명)을 넘으면 **Exchange Act §12(g)**[15 U.S.C. §78l(g)]·Rule 12g-1로 *Exchange Act 등록*이 트리거 — *ICA가 아니라 다른 법.*

- **대전제:** §12(g) 등록을 피하려면 보유자 수 ≤ 임계(2000/500).
- **소전제(부품):** **D-01**(보유자 카운트 cap). *§3(c)(7)이 아니라 §12(g) 근거*임을 명시.
- **소결론:** D-01 PASS ⟹ §12(g) 등록 회피(R3 효과의 *실무적 보완*, 엄밀히는 별 recipe 성격이나 *함께 always-on*).

### §4.5 Gap 분석 + 처리 (4분류 라우팅)

| 요건/이슈 | 분류 | 처리 |
|---|---|---|
| QP 판정 ($5M/$25M 실재성) | **(b)** | 자산 실재 = *판단·증빙* → A-13은 claim 확인(off-chain attestation·Trusted Issuer). 결정론 아님 |
| knowledgeable employee 예외(Rule 3c-5) | **(b)** | 일부 임직원은 비-QP라도 보유 허용 → *예외 플래그*(claim). A-13에 예외 입력 |
| gift/bequest/involuntary 이전 = QP 간주 | **(c/b)** | *비자발 이전* 시 QP 검사 우회 → 예외 경로(off-chain 사유 claim + 플래그). 소형 분기 |
| §3(c)(7)(E) §3(c)(1)/(7) 비통합 | **(d)** | 단일 발행자 판정 문제 — 본 토큰 단위에선 포섭, 별 부품 불요 |
| 보유자 2000 cap | **(a/별건)** | D-01(§12(g)) — 위 §4.4 |

→ **결론: §3(c)(7)(A) 본체는 A-13·B-04·A-12로 *결정론 커버*.** gap은 주로 *QP 실재성(claim)·예외 케이스(knowledgeable employee·비자발 이전)* → off-chain claim/예외 플래그. **신규 부품 불요**(예외 플래그를 A-13 입력으로 흡수).

---

## §5. ③ Activation Logic

- `Manifest.fundExemption == ICA_3C7` → R3 activate. **그리고 *모든 거래*(발행·전매·이전)마다 평가**(상시 — ㉠ exclusively가 현재형이므로).
- §3(c)(7) 구조가 아닌 자산(`fundExemption == NONE` 등) → R3 미발동.

---

## §6. ④ Composition — 전원·상시 AND

```
R3_PASS(@매 거래) ⟺  [㉠ ∀holder: A-13 ∧ (entity → A-08 ∧ (lookthrough → A-09))]   # 전원 QP, 상시
                  ∧  [㉡ B-04 ∧ A-12]                                            # 비공개
                  ∧  [§12(g) 별건 cumulative: D-01]                              # 보유자 cap
                  ∧  [횡단 A-01 ∧ A-02 (R-XJ)]                                   # 제재·관할
```
- **R1·R2와 차이:** R1=발행 1회, R2=경로 OR. **R3=*상시 전원* AND** — 신규 매수인이 비-QP면 *그 거래가 §3(c)(7)을 깨므로* 차단. ⟹ R3는 R1·R2의 *모든 PASS에 곱해진다*(§8).
- `exclusively`의 코드 표현: *모든 이전 전(pre-transfer) 매수인 A-13 검사* + *기존 보유자 집합 불변식*(비-QP 0).

---

## §7. ⑤ 거절·예외 처리

- R3 FAIL → **`RECIPE_R3_3C7_FAIL`** + 미충족 요건·부품.
  - 예: A-13 FAIL → "매수인 QP 아님 → §3(c)(7) 전원 요건 붕괴 → 거래 차단"(전원 요건이라 *예외 없이 hard block*).
  - D-01 FAIL → "보유자 2000 초과 → §12(g) 등록 트리거 위험"(별건 경고).
- knowledgeable employee·비자발 이전 = §4.5 예외 플래그로 *우회 허용*(claim 입력 시).

---

## §8. ⑥ Conflict·Interaction — R3는 "always-on cumulative"

| 상대 | 패턴 | 설명 |
|---|---|---|
| **R1**(발행) | **Cumulative(항상)** | 발행 자산이 §3(c)(7) 펀드면 R1(506(c) AI)+R3(§3(c)(7) QP) 동시. **QP ⊂ AI**(QP가 더 엄격) → A-13 PASS면 A-03도 사실상 충족 |
| **R2**(전매) | **Cumulative(항상)** | 전매 매수인도 *QP여야*(전원·상시). R2(전매 면제)+R3(QP) 동시 PASS 필요 |
| **R-XJ** | **Cumulative(always-on)** | A-01·A-02 항상 |
| **§3(c)(1)**(100인) | (대체 경로) | QP 불요·100인 제한 — 본 시스템은 §3(c)(7) 채택(무제한 QP). C-00/Manifest로 분기 |

> **핵심:** R3는 *독립 실행되지 않는다.* 발행이면 R1×R3, 전매면 R2×R3로 **항상 곱해진다.** §3(c)(7)이 *"한 명이라도 비-QP면 전체 상실"*인 *전원·현재형* 조건이기 때문 — 매 거래가 §3(c)(7) 유지의 *검문소*다.

---

## §9. 📐 결정론 경계

| ✅ 온체인 | 🔵 claim/off-chain |
|---|---|
| 전원 A-13 PASS 강제(매 이전)·기존 보유자 비-QP=0 불변식·D-01 카운트·㉡ 폐쇄 풀 강제·미충족 차단 | QP 실재성($5M/$25M 자산 — claim) / knowledgeable employee 예외(claim) / 비자발 이전 사유(claim) / public offering 법적 판정 |

---

## §10. 자산 적용 (BUIDL = 예시)

- BUIDL `fundExemption=ICA_3C7` → R3 발동. 매수인 *전원 QP*(A-13) + 폐쇄 풀(B-04). **발행(R1)·전매(R2) 모든 거래에 R3 곱.**
- QP ⊂ AI이므로 BUIDL은 *A-13만 PASS하면 A-03도 충족* → 발행에서 R1×R3가 사실상 A-13로 수렴.
- *§3(c)(7) 아닌 자산*(직접 증권 등)은 `fundExemption=NONE` → R3 미발동, 코드 동일(ADR-006).

---

## §11. Open Issues

1. **`exclusively` 불변식 코드화** 🟡 — "기존 보유자 집합에 비-QP 0" 상태 불변식을 컨트랙트로(매 transfer pre-check + holder set 검증). D-01 카운터와 통합 설계.
2. **knowledgeable employee 예외(Rule 3c-5)** 🟡 — A-13 입력 스키마에 예외 플래그·증빙 claim 필드.
3. **비자발 이전(gift/bequest/death) 경로** 🟡 — QP 우회 분기 + 사유 attestation. 소형 분기 또는 A-13 모드.
4. **§12(g) cap vs §3(c)(7)** 🟢(정리됨) — D-01은 §12(g) 근거(별건)임을 문서·코드 주석에 명시. *§3(c)(7)에 100/2000 cap 있다고 오기 금지.*
5. **QP 실재성 claim 출처** 🔵 — Trusted Issuer/off-chain attestation 체계(A-13 §-claim).

---

## §12. 변경 로그

- [2026-06-17] v1.0 작성(태스크 #33). **§80a-3 원문 기준 조문별 삼단논법.** §3(c)(7)(A) 두 요건(㉠ 전원 QP 취득시점·현재형 → A-13/A-08/A-09 / ㉡ 비공개 → B-04+A-12) + QP 정의 §2(a)(51)($5M/$25M, 법령 상수 asset-agnostic). **정확성 핵심: §3(c)(7) 자체엔 보유자 수 제한 없음 — 2000 cap은 별건 §12(g)(D-01)** 임을 §4.4·Open#4에 명시(오기 방지). **R3 = always-on cumulative** — R1·R2에 항상 곱(§8), `exclusively`가 전원·현재형이라 매 거래가 검문소. gap 4분류(QP 실재성·knowledgeable employee·비자발 이전 = claim/예외 플래그, 신규 부품 불요). ADR-006 명시. uscode 원문 인용.
