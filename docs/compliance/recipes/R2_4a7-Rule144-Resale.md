---
type: recipe-spec-sheet
recipe-id: R2
recipe-name: §4(a)(7)·Rule 144 Resale
internal-id: RCP.R2
legal-effect: "§2(a)(11) underwriter 비해당 — 2차 거래(전매)가 §5 면제로 적법"
status: v1.0 — 조문별 삼단논법 (경로 OR: §4(a)(7) 주 / Rule 144 보조 · ADR-005)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 U.S.C. § 77d(a)(7)·(d)·(e) — §4(a)(7) 전매 면제 8요건·효과: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim"
  - "15 U.S.C. § 77b(a)(11) — underwriter 정의: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77b&num=0&edition=prelim"
  - "17 CFR § 230.144 — Rule 144 전매 safe harbor(보유기간·공시·물량): https://www.ecfr.gov/current/title-17/section-230.144"
created: 2026-06-17
updated: 2026-06-17
tags: [recipe, R2, resale, 4a7, rule-144, underwriter, path-or, spec-sheet, adr-005]
---

# R2 — §4(a)(7)·Rule 144 Resale (Recipe 명세 = 조문별 삼단논법, 경로 OR)

> **이 문서는 무엇인가.** Recipe = *하나의 법률효과를 논증.* R2가 증명할 효과는 **"이 2차 거래(전매)에서 매도인은 §2(a)(11) underwriter가 *아니다* — 따라서 전매가 §5 면제로 적법하다."** R1(발행)과 *구조가 다르다*: 전매는 **두 경로(§4(a)(7) *또는* Rule 144) 중 *하나*로 면제**되므로, R2는 **경로 OR(둘 중 하나) + 경로 내 요건 AND** 구조다.
> **결정 반영(ADR-005):** §4(a)(7) = *주 경로*, Rule 144 = *보조*(1년 이상 보유 비-내부자). 경로 선택은 **C-00이 `Manifest.resaleFramework`로** 한다.
> **자산 일반성(ADR-006):** R2는 *모든 restricted 자산*에 적용. `resaleFramework`는 Manifest 값 — BUIDL의 `SEC_4A7`은 *예시*.

---

## §1. 법률효과 + 법적 사슬

**효과(소결론): "이 전매에서 매도인은 underwriter가 아니다(§2(a)(11) 비해당) → 전매가 §5 등록 없이 적법."**

```
문제:  사모로 산 증권 = restricted → 되팔면 매도인이 §2(a)(11) underwriter 위험 → §5 위반
   │
경로A §4(a)(7) [15 U.S.C. §77d(a)(7)]  — (d)(1)~(8) 충족 시
        └ 효과: §77d(e)(1)(B) "거래는 §2(a)(11) distribution이 *아닌 것으로 간주*" (= underwriter 아님)
   │
경로B Rule 144 [17 CFR §230.144]       — 보유기간 등 충족 시
        └ 효과: 제목 그대로 "매도인은 distribution에 종사하지 않아 *underwriter가 아님*"
```
→ R2 과제: **둘 중 *한 경로*의 요건이 *전부 충족*됨을 보이면 → 효과 성립.** (OR.)

---

## §2. 📋 메타 + 요약

| 항목 | 값 |
|---|---|
| Recipe / ID | §4(a)(7)·Rule 144 Resale / **R2** |
| ① 법률효과 | **§2(a)(11) underwriter 비해당 → 전매 적법** |
| ② 논증 | 경로별 조문 삼단논법(§4) — 경로A §4(d)(1)~(8) / 경로B Rule 144(d)(c)(e)(f)(h) |
| ③ Activation | restricted 자산의 *2차 거래* + `Manifest.resaleFramework` |
| ④ Composition | **경로 OR** (선택 경로의 요건 AND) |
| ⑤ 거절 | `RECIPE_R2_RESALE_FAIL` + 경로·미충족 요건·부품 |
| ⑥ Conflict | R3 cumulative(§3(c)(7) QP 항상)·R1 orthogonal·R-XJ always-on |

---

## §3. ① 법률효과

**"전매에서 매도인 underwriter 비해당 → §5 면제."** 단, *경로(§4(a)(7) or Rule 144)에 따라 요건이 다름.*

---

## §4. ② 법률 논증 — 조문별 삼단논법 (경로 OR)

> **읽는 법.** §4.0에서 *문제*(왜 전매에 면제가 필요한가)를 세우고, §4.A(§4(a)(7))·§4.B(Rule 144) *각 경로*를 조문별 삼단논법으로, §4.C에서 *경로 선택(OR)*을, §4.D에서 gap을 처리한다.

### §4.0 문제 설정 — §2(a)(11) underwriter

> **15 U.S.C. §77b(a)(11)**(요지): "underwriter"는 *발행자로부터 배포 목적으로 취득해 유통시키는 자* 등. → 사모 restricted 증권을 *되파는 자*는 underwriter로 취급될 위험 → §5 등록 의무.

→ 그래서 *전매가 underwriter 거래가 *아님*을 증명하는 면제*가 필요하다. 그 면제가 §4(a)(7) 또는 Rule 144.

---

### §4.A 경로 A — §4(a)(7) (주 경로, ADR-005)

> §4(a)(7) = §77d(a)(7): *"transactions meeting the requirements of subsection (d)."* → §4(d)의 **8개 요건(d)(1)~(8)**을 *전부* 충족하면, §77d(e)(1)(B)에 의해 *"distribution 아님(underwriter 아님)"으로 간주*. 아래 8요건을 조문별 논증한다.

**㈎ (d)(1) Accredited investor** — *"Each purchaser is an accredited investor (§230.501(a))."*
- 대전제: *각 매수인이 AI*여야.
- 소전제: **A-03**이 매수인 AI claim 확인(법인이면 A-08·A-09). *(ADR-005로 §4(a)(7)서 A-03 active.)*
- 소결론: ∴ A-03 PASS ⟹ (d)(1) 충족.

**㈏ (d)(2) No general solicitation** — *"Neither the seller, nor any person acting on the seller's behalf, offers or sells ... by any form of general solicitation or general advertising."*
- 대전제: *매도인이 공개 권유·광고로 팔지 않을 것.* ★ ADR-005의 *유일한 blocker*.
- 소전제: **B-04**(엔진 — RFQ/whitelist 폐쇄 풀로 강제, 공개 AMM 차단) + **A-12**(권유 행태 red flag). *공개 DEX 구조가 general solicitation 아닌지의 *법적 판단*은 보경 변호사 확인 대기(ADR-005).*
- 소결론: ∴ B-04(RFQ 강제) ∧ A-12 ⟹ (d)(2) 충족 *(general solicitation 판정 확정 조건부)*.

**㈐ (d)(3) Information requirement** — *"In the case of [a non-reporting issuer] ... the seller ... makes available to a prospective purchaser, the following information [(A)~(K): 발행자명·주소·증권 종류·발행주식수·transfer agent·사업 내용·임원·재무제표 등]."*
- 대전제: *비보고 발행자*면 매도인이 발행자로부터 받아 *지정 정보(A~K)를 매수인에 제공.*
- 소전제: ***부품 없음*** — 발행자 정보 제공은 *발행자측 사실* → **gap (a)** (§4.D → 발행자 attestation).
- 소결론: ㈐는 *부품 미커버* → gap.

**㈑ (d)(4) Seller ≠ issuer** — *"The transaction is not for the sale of a security where the seller is an issuer or a subsidiary ... of the issuer."*
- 대전제: *매도인이 발행자(또는 자회사)가 아닐 것.*
- 소전제: 매도인 신원 vs 발행자 *결정론 대조* — 현재 *전용 부품 없음* → **gap (c) 소형 검사**(§4.D, C-00/F-01 확장 또는 thin check).
- 소결론: ㈑는 *소형 결정론 검사 필요*.

**㈒ (d)(5) Bad actor** — *"Neither the seller, nor any [paid participant] ... is subject to [Rule 506(d)(1) disqualifying event or §3(a)(39) statutory disqualification]."*
- 대전제: *매도인·유료 참여자에 결격 부재.*
- 소전제: **E-03**(bad actor) — 단 *대상이 발행자측이 아니라 *매도인측*으로 확장* 필요(§4.D 주).
- 소결론: ∴ E-03(매도인 확장) ⟹ (d)(5) 충족.

**㈓ (d)(6) Business requirement** — *"The issuer is engaged in business, is not in the organizational stage or in bankruptcy ..., and is not a blank check, blind pool, or shell company ..."*
- 대전제: *발행자가 실제 영업 중·shell 아님.*
- 소전제: *발행자측 사실* → **gap (a)** (발행자 attestation, ㈐와 묶음).
- 소결론: ㈓는 *부품 미커버* → gap(a).

**㈔ (d)(7) Underwriter prohibition** — *"... not ... an unsold allotment to, or a subscription or participation by, a broker or dealer as an underwriter ..."*
- 대전제: *인수인의 미판매 배정분이 아닐 것.*
- 소전제: *결정론 메타 검사*(증권 출처) — *전용 부품 없음* → **gap (c) 소형 검사**.
- 소결론: ㈔는 *소형 검사 필요*.

**㈕ (d)(8) Outstanding ≥90 days** — *"... a class that has been authorized and outstanding for at least 90 days prior to the date of the transaction."*
- 대전제: *증권 클래스가 거래 90일 전부터 존재.*
- 소전제: *발행일 vs 현재 날짜 결정론 비교*(C-01류) — *전용 부품 없음* → **gap (c) 소형 검사**(날짜 산수, A-11/C-01 패턴).
- 소결론: ㈕는 *소형 날짜 검사 필요*.

> **§4(e) 효과 확인**: (d)(1)~(8) 충족 시 §77d(e)(1)(B) — *"거래는 §2(a)(11) distribution이 아닌 것으로 간주"* + (e)(1)(C) *증권은 여전히 restricted(Rule 144상)*. → **경로 A 효과 성립.**

### §4.B 경로 B — Rule 144 (보조: 1년 이상 보유 비-내부자)

> Rule 144(17 CFR §230.144) = *"매도인이 distribution에 종사하지 않아 underwriter가 아님"* safe harbor. 요건:

**㉮ 144(d) 보유기간** — 보고 6개월/비보고 1년. → **C-01.** (소전제: C-01 PASS ⟹ 보유기간 충족.)
**㉯ 144(c) Current public information** — 발행자 현재 공시정보 존재. → *발행자측 사실* **gap (a)**(㈐㈓와 동일 "발행자 정보 가용" 묶음).
**㉰ (affiliate) 144(e)물량·(f)매도방법·(h)Form 144** — 매도인이 affiliate면. → **A-06.** (비-affiliate·기간충족이면 자유.)

> **효과:** 위 충족 시 매도인 *underwriter 비해당* → 전매 적법.

### §4.C 경로 선택 (OR) — C-00

> **§230.502(d)** 등으로 자산이 restricted이면 *재판매 경로가 필요*. **C-00**이 `Manifest.resaleFramework`(SEC_4A7 / RULE_144 / EITHER)로 *어느 경로*인지 라우팅하고, R2는 *그 경로의 요건*을 본다.
- `SEC_4A7` → 경로 A(§4.A) 평가.
- `RULE_144` → 경로 B(§4.B) 평가.
- `EITHER` → 진입 가능한 경로(보유기간 충족 시 144 / 적격 매수인 시 4a7) 중 *보수 우선*.

### §4.D Gap 분석 + 처리 (4분류 라우팅)

| 요건 | 분류 | 처리 |
|---|---|---|
| (d)(3) 정보제공 · (d)(6) business · 144(c) 공시정보 | **(a)** | *발행자 attestation*(발행자측 사실) → **E-02류 "발행자 정보·지위 attestation"** 으로 묶어 처리(E-01·E-03 패밀리). Manifest claim. |
| (d)(2) general solicitation *판정* | **(b)** | 공개 DEX가 general solicitation인지 = *법적 판단* → 보경 변호사(ADR-005 blocker). 코드는 B-04(RFQ 강제)로 *조건 충족 유도*. |
| (d)(4) seller≠issuer · (d)(7) unsold allotment · (d)(8) 90일 outstanding | **(c)** | *결정론 소형 검사*(신원 대조·메타·날짜) — *전용 부품 없음.* → **신규 소형 부품 또는 C-00/A-06 확장**(pool 추가 = ADR). |
| (d)(5) bad actor *매도인측* | **(b/확장)** | E-03을 *매도인+유료참여자*로 확장(현재 발행자측). |

→ **결론: 경로 A(§4(a)(7))는 *부품으로 대부분 커버*되나, (c) 소형 결정론 검사 3개((d)(4)(7)(8))와 (a) 발행자 attestation((d)(3)(6))가 *미완*.** R2 완결엔 *E-02류 attestation + 소형 검사 3종* 보강 필요(§11).

---

## §5. ③ Activation Logic

- 자산이 **restricted**(B-03=true) AND 거래가 **2차(전매)** → R2 activate.
- C-00이 `Manifest.resaleFramework`로 경로 선택(§4.C).
- §3(c)(7) 펀드면 R3(A-13 QP) *항상 cumulative*(경로 무관 — §8).

---

## §6. ④ Composition — 경로 OR + 경로 내 AND

```
R2_PASS ⟺  C-00.route == SEC_4A7  ?  (㈎A-03 ∧ ㈏[B-04∧A-12] ∧ ㈐gap ∧ ㈑gap ∧ ㈒E-03' ∧ ㈓gap ∧ ㈔gap ∧ ㈕gap)
         :  C-00.route == RULE_144 ?  (㉮C-01 ∧ ㉯gap ∧ (affiliate→㉰A-06))
         :  (EITHER → 진입 가능 경로 보수 우선)
   ∧  [횡단 A-01 ∧ A-02 (R-XJ)]      # 제재·관할
```
- **R1과 차이:** R1은 *단일 AND*, R2는 ***경로 OR*** (선택 경로의 요건만 AND). 경로 선택은 C-00(Manifest 값).
- gap(㈐㈑㈓㈔㈕·㉯)은 현재 *부품 미커버* → §4.D 처리 전까지 *보수 보류/off-chain*.

---

## §7. ⑤ 거절·예외 처리

- R2 FAIL → **`RECIPE_R2_RESALE_FAIL`** + *경로·미충족 요건·부품.*
  - 예(4a7): A-03 FAIL → "§4(d)(1) 매수인 비적격 → §4(a)(7) 불성립"; B-04 FAIL → "§4(d)(2) general solicitation 위험".
  - 예(144): C-01 FAIL → "Rule 144(d) 보유기간 미충족 → *§4(a)(7) 경로 대안 안내*"(매수인 적격 시).
- 한 경로 FAIL이어도 *다른 경로가 가능하면* C-00이 재라우팅(OR의 장점).

---

## §8. ⑥ Conflict·Interaction

| 상대 | 패턴 | 설명 |
|---|---|---|
| **R3**(§3(c)(7)) | **Cumulative(항상)** | 전매여도 §3(c)(7) 펀드 지위 유지 → *매수인 QP(A-13) 항상* 필요. R2(전매 적법)+R3(QP) 동시 |
| **R1**(발행) | **Orthogonal** | R1=1차, R2=2차. 단 R1의 restricted(502d)가 R2를 *유발* |
| **R-XJ** | **Cumulative(always-on)** | A-01·A-02 항상 |
| 144A(QIB) | (대안 경로) | QIB 전용 — 본 시스템 미채택(C-00 §4) |

> **핵심:** 전매에서도 **A-13(QP)는 R3로 항상 켜진다**(§3(c)(7) 유지). R2는 *전매 면제*를, R3는 *펀드 자격*을 — 둘 다 PASS해야.

---

## §9. 📐 결정론 경계

| ✅ 온체인 | 🔵 claim/off-chain |
|---|---|
| 경로 라우팅(C-00)·경로 요건 부품 AND·날짜/신원 결정 검사·미충족 propagate | AI·bad actor 판단(claim) / general solicitation 법적 판정(보경) / 발행자 정보·지위(attestation) |

---

## §10. 자산 적용 (BUIDL = 예시)

- BUIDL `resaleFramework=SEC_4A7`(ADR-005) → 경로 A. A-03 active + (gap 보강 후) (d)(3)(6) attestation·(d)(4)(7)(8) 소형검사.
- **§3(c)(7) 때문에 A-13(QP) 항상**(R3) — 전매 매수인도 QP여야(§8).
- *다른 restricted 자산*은 자기 `resaleFramework`로 — R2 코드 동일(ADR-006).

---

## §11. Open Issues

1. **(c) 소형 결정론 검사 3종** 🟡 — (d)(4) seller≠issuer·(d)(7) unsold allotment·(d)(8) 90일 outstanding → 신규 소형 부품 or C-00/A-06 확장(pool 추가 ADR).
2. **(a) 발행자 정보·지위 attestation** 🟡 — (d)(3)·(d)(6)·144(c) → E-02류 attestation 묶음(E-01/E-03 패밀리).
3. **(d)(5) bad actor 매도인 확장** 🟡 — E-03을 *매도인+유료참여자*로 확장.
4. **general solicitation 판정** 🔴 — (d)(2)/ADR-005 blocker, 보경 변호사 확인.
5. **EITHER 경로 우선순위** 🟡 — 두 경로 모두 가능 시 선택 정책(C-00 §5.3).

---

## §12. 변경 로그

- [2026-06-17] v1.0 작성(태스크 #32). **§77d 원문 기준 조문별 삼단논법**. 경로 OR 구조(§4(a)(7) 8요건 (d)(1)~(8)+§4(e) 효과 / Rule 144 보유기간·공시·물량). ADR-005(§4(a)(7) 주·A-03 active) 반영. gap 4분류 처리((c) 소형검사 3종·(a) 발행자 attestation·(b) general solicitation 판정·E-03 매도인 확장). ADR-006(자산 일반성) 명시. **R1과 달리 경로 OR** — 전매 면제의 본질(경로 택일) 반영. uscode/eCFR 원문 인용.
