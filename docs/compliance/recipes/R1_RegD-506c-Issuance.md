---
type: recipe-spec-sheet
recipe-id: R1
recipe-name: Reg D 506(c) Issuance
internal-id: RCP.R1
legal-effect: "Securities Act §5 등록 면제 성립 (Reg D 506(c) 사모)"
status: v1.2 — 조문별 삼단논법 논증 (요건 하나하나 대전제→소전제(부품)→소결론)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.506 — 506(c) 면제 요건·506(d)(e) bad actor: https://www.ecfr.gov/current/title-17/section-230.506"
  - "17 CFR § 230.501 — accredited investor 정의: https://www.ecfr.gov/current/title-17/section-230.501"
  - "17 CFR § 230.502 — 통합(a)·이전제한(d): https://www.ecfr.gov/current/title-17/section-230.502"
  - "17 CFR § 230.503 — Form D 제출(15일): https://www.ecfr.gov/current/title-17/section-230.503"
  - "15 U.S.C. § 77d(a)(2) — §4(a)(2) private placement: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim"
created: 2026-06-17
updated: 2026-06-17
tags: [recipe, R1, reg-d, 506c, issuance, syllogism, legal-argument, spec-sheet]
---

# R1 — Reg D 506(c) Issuance (Recipe 명세 = 조문별 삼단논법)

> **이 문서는 무엇인가.** Recipe = *하나의 법률효과가 성립함을 *논증*하는 것*(법률검토보고서의 소결론). R1은 **"이 발행이 Rule 506(c)로 §5 등록을 면제받는다"** 를, **506(c)가 요구하는 *조문 하나하나*에 대해 삼단논법**으로 증명한다 — 각 요건마다 *[조문 원문 → 대전제(법이 요구) → 소전제(부품이 충족) → 소결론(요건 성립)]*. 모든 요건의 소결론이 참이면 → *종합결론: 면제 성립*.
>
> **양식:** [[Recipe 명세 양식 (연역적 정의·요건↔부품 논증·코드전환)]] 의 §4(조문별 삼단논법)이 척추.

---

## §1. 법률효과 + 법적 사슬

**법률효과(종합 소결론): "이 발행은 §5 등록 없이 적법하다 — Reg D Rule 506(c) 사모 면제 성립."**

```
§5 (등록 의무)  →  예외 §4(a)(2)[15 U.S.C. §77d(a)(2)] "public offering 아닌 issuer 거래"
                     →  safe harbor: Rule 506(c) [17 CFR §230.506(c)]
```
→ R1이 증명할 것: **"506(c)의 *전 조건* 충족 → §4(a)(2) public offering 아님 → §5 면제."** (그 조건 = §4 ㉠~㉨.)

---

## §2. 📋 메타 + 요약

| 항목 | 값 |
|---|---|
| Recipe / ID | Reg D 506(c) Issuance / **R1** |
| ① 법률효과 | **§5 등록 면제 성립** |
| ② 논증 | **조문별 삼단논법(§4)** — 핵심 요건 A-03·E-03·E-01 |
| ③ Activation | `Manifest.issuanceFramework=RegD506c` |
| ④ Composition | 전 요건 소결론 AND ⟺ 면제 성립 |
| ⑤ 거절 | `RECIPE_R1_REGD_ISSUANCE_FAIL` + 미충족 요건·부품 |
| ⑥ Conflict | R3 cumulative · R2 orthogonal · R-XJ always-on · Reg A conflict |

---

## §3. ① 법률효과

**"Rule 506(c) 사모 면제 성립 → §5 등록 의무 면제."** 단일 효과. *전 요건 충족 시에만* 성립.

---

## §4. ② 법률 논증 — 조문별 삼단논법 (척추)

> **읽는 법.** 506(c) 면제를 *조문 하나하나*에 대해 논증한다. 각 요건: **[조문 원문] → 대전제(법이 요구) → 소전제(부품이 충족·어떻게) → 소결론(요건 성립).** §4.7에서 소결론들을 결합해 종합결론을 낸다.

### §4.0 효과 부여 조문 (논증의 출발)

> **17 CFR §230.506(a)**: *"Offers and sales of securities by an issuer that satisfy the conditions in paragraph (b) or (c) of this section shall be deemed to be transactions not involving any public offering within the meaning of section 4(a)(2) of the Act."*

→ *"506(c)의 조건을 충족하면 §4(a)(2) public offering 아님으로 *간주*"*. 그러므로 R1의 과제는 *그 "조건"(㉠~㉨)이 전부 충족됨을 보이는 것.* 아래가 그 조건들의 조문별 논증이다.

### §4.1 ㉠ 506(c)(1) — 501·502(a)·(d) 충족

> **§230.506(c)(1)**: *"To qualify for exemption under this section, sales must satisfy all the terms and conditions of §§ 230.501 and 230.502(a) and (d)."*

- **대전제(법):** 506(c) 면제는 *§501(정의)·§502(a)(통합)·§502(d)(이전제한)*을 충족할 것을 요구한다. *(주의: §502(c)(general solicitation 금지)는 *불포함* — 506(c)는 그걸 허용하는 게 핵심. 502(c)는 506(b) 전용.)*
- **소전제(부품):** §501은 **A-03**이 AI 정의(501(a))를 claim.basis로 적용해 충족. §502(d)(restricted)는 **B-03**(restricted 표식)+**A-12**(underwriter 방지 reasonable care)가 충족. §502(a)(통합)은 ***부품 없음*** → §4.9 gap.
- **소결론:** §501·§502(d) = 충족 / **§502(a) 통합은 미커버**(gap) → ㉠은 *부분 충족*(통합은 Recipe/Manifest 차원 보강 필요).

### §4.2 ㉡ 506(c)(2)(i) — 전원 적격투자자

> **§230.506(c)(2)(i)**: *"All purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors."*

- **대전제(법):** 면제 성립은 *이 offering의 **모든** 매수인이 accredited investor*일 것을 요구.
- **소전제(부품):** **A-03**이 매수인의 AI claim(존재·서명·발급자·만료·basis)을 확인해 PASS를 낸다 → 매수인이 AI임이 *확립*. 매수인이 *법인*이면 **A-08**(자격 분류)→필요 시 **A-09**(구성원 look-through)로 *전원 AI*를 확립. (실제 AI *판단*은 Trusted Issuer가 off-chain에서 하고 claim에 부호화 — A-03 §2-A.)
- **소결론:** ∴ A-03 [∧ entity면 A-08 ∧ A-09] PASS ⟹ **"모든 매수인 AI" 요건 충족.**

### §4.3 ㉢ 506(c)(2)(ii) — 합리적 검증(reasonable steps to verify)

> **§230.506(c)(2)(ii)**: *"The issuer shall take reasonable steps to verify that purchasers ... are accredited investors. The issuer shall be deemed to take reasonable steps to verify if the issuer uses ... one of the following **non-exclusive and non-mandatory** methods ..."* (방법 (A)소득·(B)순자산·(C)제3자·(D)기존506(b)·(E)5년 재사용)

- **대전제(법):** issuer가 AI 지위를 *합리적으로 검증*했어야 한다(단순 자기신고 체크박스로는 불충분). (A)~(E)는 *의무가 아니라 안전항 예시* — 다른 합리적 방법도 가능(facts-and-circumstances, SEC Release 33-9415).
- **소전제(부품):** **A-03**이 claim의 `verificationBasis`(어떤 합리적 방법으로 검증됐는지 — 예: `HIGH_MINIMUM_INVESTMENT`, C&DI 256.36)가 *Trusted Issuer 정책상 인정*되는지 확인 + **A-12**가 *모순 red flag*를 잡아 *willful blindness 방지*(합리적 주의의 증거화). 검증의 *합리성 판단 자체*는 발급 단계(off-chain)에서 결정(보경 변호사 506(c) 해설).
- **소결론:** ∴ A-03 verificationBasis 인정 ∧ A-12 red flag 무 ⟹ **"합리적 검증" 요건 충족.**

### §4.4 ㉣ 506(d) — bad actor 결격 부재

> **§230.506(d)(1)**: *"No exemption under this section shall be available for a sale of securities if the issuer; ... any director, executive officer, other officer participating in the offering, general partner or managing member ...; any beneficial owner of 20% or more of the issuer's outstanding voting equity securities ...; any promoter ...; any ... paid ... for solicitation ...: (i) Has been convicted, within ten years before such sale (or five years, in the case of issuers ...) of any felony or misdemeanor [in connection with the purchase/sale of any security; false SEC filing; underwriter/broker/dealer/adviser business] ..."* (그 외 (ii)~(viii) 금지·정지·제재 명령 등)

- **대전제(법):** covered persons(발행자·임원·20%+ 주주·promoter·주관사 등)에 *결격 사유(유죄·제재명령 등, 이벤트별 5/10년 look-back)*가 있으면 *면제 자체가 박탈*.
- **소전제(부품):** **E-03**이 "covered persons 중 결격자 부재"를 *off-chain 배경조사 결과 claim*으로 확인(reasonable care 506(d)(2)(iv)).
- **소결론:** ∴ E-03 PASS ⟹ **"bad actor 부재" 요건 충족.**

### §4.5 ㉤ 506(e) — 시행 전 사유 공시

> **§230.506(e)**: *"The issuer shall furnish to each purchaser, a reasonable time prior to sale, a description in writing of any matters that would have triggered disqualification under paragraph (d)(1) ... but occurred before September 23, 2013."*

- **대전제(법):** 2013-09-23 *이전* 발생 사유는 *결격은 아니나, 매수인에게 서면 공시*해야 한다.
- **소전제(부품):** **E-03**이 pre-existing event 공시 완료(`preExistingDisclosed`)를 확인.
- **소결론:** ∴ E-03(공시 확인) ⟹ **"시행 전 사유 공시" 요건 충족.**

### §4.6 ㉨ Rule 503 — Form D 제출 (위생요건)

> **§230.503(a)**: *"...file with the Commission a notice of sales containing the information required by Form D ... no later than 15 calendar days after the first sale ..."* (단, *면제의 *조건*은 아님* — 미제출이 자동 면제상실 아님.)

- **대전제(법):** Reg D 발행자는 *최초 매도 15일 내 Form D 제출* 의무(위생요건 — 면제의 직접 조건은 아님).
- **소전제(부품):** **E-01**이 EDGAR Form D 제출 사실을 *오라클 claim*으로 확인.
- **소결론:** ∴ E-01 PASS ⟹ **"Form D" 위생요건 충족**(미제출 시 보수 처리, 면제 자동 상실 아님 — §4.9).

### §4.7 종합 결론 (소결론들의 결합)

㉠(부분)·㉡·㉢·㉣·㉤·㉨ 의 소결론이 *모두 참* →
> *"Rule 506(c)의 전 조건이 충족됐다 → §4(a)(2) public offering 아님으로 간주(506(a)) → §5 등록 면제 성립."*

(단 ㉠의 *통합(502(a))*은 부품 미커버 = 논증의 구멍 → §4.9. 코드 결합은 §6.)

### §4.8 횡단·기술 전제 (506(c) 밖이나 거래 적법성에 필요)

506(c) *자체 요건은 아니나*, 같은 거래가 적법하려면 별도 법체계·시스템도 충족돼야:

| 전제 | 부품 | 출처 |
|---|---|---|
| 제재 대상 아님 | **A-01** | OFAC(R-XJ always-on) |
| 허용 관할·US/non-US | **A-02** | Reg S·제재 관할(R-XJ) |
| 판매 중 발행자측 매수 금지 | **F-04** | Reg M Rule 102(R-XJ, distribution 중) |
| claim 유효·진짜 사람·무결성·규격 | **A-11·A-04·B-01·B-02** | 취득시점·dedup·Manifest·ERC-3643 |

### §4.9 Gap 분석 + 처리 (gap을 4분류로 라우팅)

> **gap 처리 원리:** gap = "법은 요구하나 부품 없는 칸". *왜* 없는지로 4분류해 라우팅한다 — **(a)** 거래단위 사실 아님→*Manifest/발행자 attestation* · **(b)** 비결정 판단→*off-chain claim·review(패턴 B/C)* · **(c)** 진짜 누락→*신규 부품* · **(d)** 다른 요건에 흡수→*불요*.

| 요건 | 왜 gap인가 | 분류 | 처리 |
|---|---|---|---|
| ㉠ **통합(502(a))** | *offering 구조* 사실(이 발행이 다른 발행과 부당 합산되나) — 거래마다 보는 게 아님 | **(a)** | **발행자 attestation claim** → **`E-02`(통합 적합) 신설 제안**(E-01·E-03 형제). 통합 *판단*은 발행 시점 counsel(off-chain), E-02는 attestation 존재 확인 |
| ㉠ §502(d) underwriter 비해당 *판단* | "매도인이 underwriter인가"는 사람 판단 | **(b)** | 이미 B-03(전제)+A-12(reasonable care)+R2(전매 통제)로 off-chain 위임 — *hole 아님* |
| §4(a)(2) "public offering 아님" manner | 506(c)는 general solicitation 허용 | **(d)** | 전원 적격 검증(㉡㉢)이 대체 — *불요* |

→ **결론: R1엔 *진짜 누락(c) 없음.* 통합만 발행자 attestation(E-02)으로 채우면 506(c) 논증 완결.** (E-02 = element pool 추가 → ADR/등록 필요, ADR-004 freeze 변경. 현재 *제안 상태*.)

---

## §5. ③ Activation Logic

- `Manifest.issuanceFramework=RegD506c` → 해당 자산 *모든 거래*에 R1 base activate.
- 매수인 *법인* → A-08(분류) → 필요 시 A-09(look-through) AND 합류.
- BUIDL: 항상 활성 + R3 cumulative(§8).

---

## §6. ④ Composition — "전 요건 소결론 AND ⟺ 면제 성립"

§4의 *조문별 소결론*을 코드로 결합 = cumulative AND:

```
R1_PASS ⟺ [㉡ A-03 ∧ (entity → A-08 ∧ (lookthrough → A-09))]   # 전원 적격
        ∧ [㉢ A-03.verificationBasis ∧ A-12]                     # 합리적 검증
        ∧ [㉣ E-03] ∧ [㉤ E-03.disclosed] ∧ [㉨ E-01]            # bad actor·공시·Form D
        ∧ [㉠ B-03 ∧ A-12]                                       # restricted(502d)
        ∧ [전제 A-11 ∧ A-04 ∧ B-01 ∧ B-02]                       # claim·신원·무결성·규격
        ∧ [횡단 A-01 ∧ A-02 ∧ F-04 (R-XJ)]                       # 제재·관할·Reg M
        ∧ [GAP 502(a) 통합 — off-chain/manual]                    # ⚠ 부품 미커버
```
- 하나라도 FAIL → *그 조문 요건 불충족 → 면제 불성립* → R1 FAIL.
- B-01(무결성) *최선행*. gap(502(a))은 코드 밖(주석/off-chain).

---

## §7. ⑤ 거절·예외 처리

- R1 FAIL → **`RECIPE_R1_REGD_ISSUANCE_FAIL`** + *미충족 조문 요건·원인 부품·reasonCode.*
  - 예: A-03 `FAIL_NOT_ACCREDITED` → *"§230.506(c)(2)(i) 전원 적격 불충족 → 면제 불성립."*
- 부품 suspend/review → R1 *보류* 전파. 면제는 strict(전 요건) — 예외 없음.

---

## §8. ⑥ Conflict·Interaction

| 상대 | 패턴 | 설명 |
|---|---|---|
| **R3**(§3(c)(7)) | **Cumulative** | BUIDL=506(c)+§3(c)(7) 동시. 발행엔 AI(A-03)+QP(A-13) 둘 다(AI floor, QP binding) |
| **R2**(Resale) | **Orthogonal** | R1=1차 발행, R2=2차 재판매(restricted(502d) 때문에 후속 R2) |
| **R-XJ** | **Cumulative(always-on)** | A-01·A-02·F-04 공유 |
| Reg A 발행 | **Conflict** | 발행 framework 단일 — 양립 불가 |

---

## §9. 📐 결정론 경계

> Recipe는 *조문별 소결론(부품 결과)*을 *AND로 결합*만 한다 — 법적 판단은 부품 claim에 캡슐화.

| ✅ 온체인 | 🔵 claim(부품) |
|---|---|
| 요건 부품 AND·조건부 activate·미충족 조문 propagate | 각 조문 요건의 실체 판단(AI·bad actor·검증 합리성) |

---

## §10. BUIDL 적용

- BUIDL=506(c) → R1 활성, **R3 cumulative**. A-03 verificationBasis=`HIGH_MINIMUM_INVESTMENT`($5M).
- R1 PASS(발행 면제) ≠ 매수 가능 — **R3(QP, A-13)까지 PASS**(§8).
- 통합(502(a)) gap은 BUIDL에도 적용 — offering 단위 관리(§11).

---

## §11. Open Issues

1. **통합(502(a)) 부품 부재** 🔴 — 506(c) 요건 ㉠인데 미커버. offering 단위 합산 판정 신규 검토.
2. **underwriter 비해당 판단(502(d))** 🟡 — 전제만 부품, 판단은 R2·off-chain.
3. **Form D 미제출 처리(503)** 🟡 — 면제의 조건 아님 — R1 FAIL vs 경고 정책.
4. **R1∧R3 cumulative 엔진** 🟡 — 공유 부품 1회 평가·결과 공유.

---

## §12. 변경 로그

- [2026-06-17] **v1.2 — 조문별 삼단논법으로 재작성**(사용자 지적: "조문 나열 + 조문단위 논증이 나와야"). §4를 ㉠506(c)(1)·㉡506(c)(2)(i)·㉢506(c)(2)(ii)·㉣506(d)·㉤506(e)·㉨503 *각각* [조문 원문 → 대전제 → 소전제(부품) → 소결론]으로 전개 + §4.0 효과부여조문(506(a)) + §4.7 종합결론 + §4.9 gap. eCFR 원문 인용. **이게 Recipe 명세 양식의 완성 예시.**
- [2026-06-17] v1.1 요건→부품 coverage 표(논증 전개는 부족). v1.0 6칸 초안.
