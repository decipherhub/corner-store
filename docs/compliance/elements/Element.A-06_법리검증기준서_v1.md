# A-06 내부자판정 — 법리 검증 기준서 (원문 대조용)

**v1.0 · 기준일 2026-07-06 · Decipher RWA DEX / Element A-06 (Affiliate / Control Person)**

---

## §0. 경위와 용도

업로드된 `A-06_내부자판정.docx`가 작업 컨테이너에 동기화되지 않아(uploads mount 비어 있음, 약 5분 폴링 후에도 미도착) 본문 라인 대조는 아직 수행하지 못했다. 대신 검증 작업의 파일-독립적 절반 — **A-06이 딛고 서야 하는 모든 근거 조문의 2026-07-06 현재 원문 확정** — 을 먼저 완료해 이 기준서로 고정한다. 파일이 다시 도착하면 §5의 절차대로 이 기준서와 문서를 축조 대조한다.

모든 원문은 ecfr.gov·uscode.house.gov·sec.gov에서 오늘 직접 수집했다. eCFR Title 17은 **2026-07-01 기준 현행**(최종 개정 2026-06-25 반영)이고, uscode.house.gov는 **2026-07-01 시행 법률** 기준임을 각 페이지가 명시한다. §230.144의 개정 이력상 마지막 실질 개정은 **2022년 6·7월(Form 144 전자제출화)**이며 그 이후 무변경, §230.405의 *control* 정의도 무변경이다 — "반드시 최신" 요건은 이 스탬프로 충족된다.

---

## §1. 검증 완료 원문 (Layer 1 — 이 자구와 다르면 문서가 틀린 것)

### 1.1 17 CFR §230.144(a)(1) — affiliate 정의 [ecfr.gov]

> An *affiliate* of an issuer is a person that directly, or indirectly through one or more intermediaries, controls, or is controlled by, or is under common control with, such issuer.

**한국어 요지:** 발행자를 직접 또는 하나 이상의 중간자를 통해 간접으로 지배하거나, 발행자에 의해 지배되거나, 발행자와 공동의 지배 아래 있는 자.

**자구 주의 ⚠:** 144(a)(1)은 "controls**,** or is controlled by"로 *controls 뒤에 콤마가 있다.* Rule 405의 별도 *Affiliate* 정의("… controls or is controlled by, or is under common control with, the person specified")에는 그 콤마가 없고 주어도 다르다("of an issuer" vs "of … a specified person"). 두 정의를 한 블록에 섞어 쓰면 verbatim 실패다 — A-06의 §3 원문 블록은 반드시 144(a)(1) 자구만 담아야 한다.

### 1.2 17 CFR §230.405 — *Control* 정의 [ecfr.gov]

> *Control.* The term *control* (including the terms *controlling, controlled by* and *under common control with*) means the possession, direct or indirect, of the power to direct or cause the direction of the management and policies of a person, whether through the ownership of voting securities, by contract, or otherwise.

**한국어 요지:** 의결권증권 소유·계약·그 밖의 방법 여하를 불문하고, 직접·간접으로 어떤 자의 경영과 정책의 방향을 지시하거나 지시를 야기할 수 있는 힘의 보유. **정량 기준이 전혀 없다** — 이것이 A-06의 "bright-line 절대 금지" 원칙의 조문상 뿌리다.

**인용 방식 주의 ⚠:** Rule 144은 *control*을 자체 정의하지 않는다. Rule 405 서두는 그 정의들의 적용 범위를 문언상 "all terms used in §§ 230.400 to 230.494, inclusive, or in the forms for registration"으로 열고 있으므로, §230.144에 대한 적용은 *직접 편입이 아니라 확립된 해석 기준*이다. SEC 스스로 Rule 144 안내에서 이 정식을 그대로 쓴다(§1.10) — 따라서 A-06의 authority 분류는 "Rule 405 (Layer 1 정의 조문) + SEC 간행물(Layer 2 적용 확인)"의 2단 구성이 정확하고, "144(a)(1)이 405를 정의로 지정한다"는 식의 단문 서술은 부정확하다. Exchange Act Rule 12b-2에 동일 문구의 병행 정의가 있다(참조 표기용, 본 기준서에서 원문 대조는 하지 않음).

### 1.3 17 CFR §230.144(b)(1) — 비계열(non-affiliate) 요건 [ecfr.gov]

> (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Securities Exchange Act of 1934 (the Exchange Act), any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of paragraphs (c)(1) and (d) of this section are met. The requirements of paragraph (c)(1) of this section shall not apply to restricted securities sold for the account of a person who is not an affiliate of the issuer at the time of the sale and has not been an affiliate during the preceding three months, provided a period of one year has elapsed since the later of the date the securities were acquired from the issuer or from an affiliate of the issuer.
>
> (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if the condition of paragraph (d) of this section is met.

**한국어 요지:** 비계열 자격은 두 요건의 AND — ① 매도 시점에 affiliate가 아닐 것, ② **직전 3개월(preceding three months)** 동안 affiliate였던 적이 없을 것. 보고회사 발행분은 (c)(1)+(d) 조건부이되 취득 후 1년 경과 시 (c)(1) 면제, 비보고회사 발행분은 (d)(1년 보유)만.

**Decipher 적용 주의 ⚠:** §3(c)(7) 사모펀드(BUIDL형)는 §13/15(d) 보고의무가 없으므로 실제 살아 있는 갈래는 **(b)(1)(ii)**다. 문서가 (i)의 "6–12개월 구간 (c)(1) 잔존 / 1년 후 전면 해제" 구조를 서술한다면 그 자체는 정확하지만(원문 그대로), 그것을 Decipher 토큰에 *적용*하는 서술이면 발행자 보고 지위 전제부터 틀린 것이다. (보유기간 세부는 C-01, 현행정보는 E-05 소관 — A-06은 원문 블록의 자구 정확성만 책임진다.)

### 1.4 17 CFR §230.144(b)(2) — 계열 tail (90일) [ecfr.gov]

> Any affiliate of the issuer, or any person who was an affiliate at any time during the 90 days immediately before the sale, who sells restricted securities, or any person who sells restricted or any other securities for the account of an affiliate of the issuer of such securities, or any person who sells restricted or any other securities for the account of a person who was an affiliate at any time during the 90 days immediately before the sale, shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of this section are met.

**한국어 요지:** ① 현재 affiliate, ② **매도 직전 90일(90 days immediately before the sale)** 내 어느 시점이든 affiliate였던 자, ③ 그 둘의 계산으로 파는 자 — 전부에 대해 이 조의 *모든* 조건이 붙는다. 그리고 대상 증권은 "restricted **or any other** securities" — 취득 경로를 불문한다(control securities 개념의 문언 근거).

**이중 look-back의 핵심 ⚠:** (b)(1)은 "**preceding three months**"(역월), (b)(2)는 "**90 days**"(일수)로 조문이 *의도적으로 다른 단위*를 쓴다. 역월 3개월은 89–92일로 변동한다. 하나의 "90일 tail" 숫자로 뭉개 쓰면 자구 오류이고, 온체인 게이트 구현은 두 기간을 각각 평가하거나 보수적으로 `max(직전 3역월, 90일)` 무-affiliate를 요구해야 한다. NON_AFFILIATE 판정에 이 tail sub-check가 빠지는 것이 A-06 최다 오구현 지점이라는 기존 결론은 현행 원문으로 재확인된다.

### 1.5 17 CFR §230.144(a)(2) — *person* 합산 정의 [ecfr.gov]

> The term *person* when used with reference to a person for whose account securities are to be sold in reliance upon this section includes, in addition to such person, all of the following persons:
>
> (i) Any relative or spouse of such person, or any relative of such spouse, any one of whom has the same home as such person;
>
> (ii) Any trust or estate in which such person or any of the persons specified in paragraph (a)(2)(i) of this section collectively own 10 percent or more of the total beneficial interest or of which any of such persons serve as trustee, executor or in any similar capacity; and
>
> (iii) Any corporation or other organization (other than the issuer) in which such person or any of the persons specified in paragraph (a)(2)(i) of this section are the beneficial owners collectively of 10 percent or more of any class of equity securities or 10 percent or more of the equity interest.

**한국어 요지:** 매도 계산 주체를 확장한다 — 동거 친족·배우자(및 그 배우자의 동거 친족), 그들이 합산 **10% 이상(≥)** 수익지분을 갖거나 수탁자·유언집행자 등으로 있는 신탁·유산, 그들이 합산 **10% 이상(≥)** 지분을 가진 법인·단체.

**용도 구분 ⚠:** 이 10%는 *affiliate 판정 기준이 아니다.* "누구의 매도로 세는가"라는 합산 범위 정의로, C-08(물량 합산)·(h)(Form 144 임계 계산)의 입력이자 A-06의 판정 대상 확장(affiliate 본인 외에 (a)(2) person까지 게이트에 태울지) 인터페이스다. 이 10%를 지배 기준으로 승격시키면 §3.C3 위반이다. 자구도 현행 텍스트는 "trustee, executor **or in any** similar capacity"다(구판 표기 "or similar capacity" 아님).

### 1.6 15 U.S.C. §77b(a)(11) — underwriter와 지배관계인 확장 [uscode.house.gov]

> The term "underwriter" means any person who has purchased from an issuer with a view to, or offers or sells for an issuer in connection with, the distribution of any security, or participates or has a direct or indirect participation in any such undertaking, or participates or has a participation in the direct or indirect underwriting of any such undertaking; but such term shall not include a person whose interest is limited to a commission from an underwriter or dealer not in excess of the usual and customary distributors' or sellers' commission. As used in this paragraph the term "issuer" shall include, in addition to an issuer, any person directly or indirectly controlling or controlled by the issuer, or any person under direct or indirect common control with the issuer.

**한국어 요지:** 마지막 문장이 A-06 전체의 법정법(statute) 뿌리다 — §2(a)(11) 목적상 "issuer"에는 지배관계인이 포함되므로, **affiliate로부터** 유통 목적으로 매수하거나 **affiliate를 위해** 파는 자도 underwriter가 될 수 있다. Rule 144은 이 리스크에 대한 safe harbor이고, (b)(2)가 affiliate 매도에 전 조건을 붙이는 이유가 여기서 나온다.

### 1.7 [대조축 1] ICA §2(a)(3) — "affiliated person" (15 U.S.C. §80a-2(a)(3)) [uscode.house.gov]

> "Affiliated person" of another person means (A) any person directly or indirectly owning, controlling, or holding with power to vote, 5 per centum or more of the outstanding voting securities of such other person; (B) any person 5 per centum or more of whose outstanding voting securities are directly or indirectly owned, controlled, or held with power to vote, by such other person; (C) any person directly or indirectly controlling, controlled by, or under common control with, such other person; (D) any officer, director, partner, copartner, or employee of such other person; (E) if such other person is an investment company, any investment adviser thereof or any member of an advisory board thereof; and (F) if such other person is an unincorporated investment company not having a board of directors, the depositor thereof.

**왜 여기 있는가:** R3(§3(c)(7)) 동거 프로젝트라 이 정의가 A-06으로 새어 들어올 위험이 실재한다. ICA 축은 (A)(B) **≥5% 자동**, (D) **임원·이사·파트너·직원 자동**, (E) 투자자문사·자문위원 자동 — Rule 144/405 축과 정반대의 bright-line 체계다. 특히 (D): ICA에서는 직함만으로 affiliated person이 되지만, **Rule 144에서는 이사·임원이라는 사실만으로 affiliate가 되지 않는다**(사실·정황 판단; SEC 간행물도 "such as"의 예시로만 든다 — §1.10). 두 축의 교차 오염이 A-06 문서의 제1 실질 위험이다.

### 1.8 [대조축 2] ICA §2(a)(9) — 25% 지배 추정 (15 U.S.C. §80a-2(a)(9), 발췌) [uscode.house.gov]

> Any person who owns beneficially, either directly or through one or more controlled companies, more than 25 per centum of the voting securities of a company shall be presumed to control such company. Any person who does not so own more than 25 per centum of the voting securities of any company shall be presumed not to control such company. A natural person shall be presumed not to be a controlled person within the meaning of this subchapter. Any such presumption may be rebutted by evidence, but except as hereinafter provided, shall continue until a determination to the contrary made by the Commission by order either on its own motion or on application by an interested person.

**왜 여기 있는가:** ICA의 control은 "**25% 초과(>)** 추정 / 25% 이하 부추정 / 반증 가능"의 정량 추정 구조를 조문에 내장한다(같은 항의 정의부는 "controlling influence" 기준). Securities Act Rule 405에는 이런 추정이 **없다**. A-06 문서가 "25% 추정"을 Rule 144 축의 규칙으로 서술하면 오류, ICA와의 대조 해설로 서술하면 정확 — 어느 쪽인지가 대조 포인트다.

### 1.9 [대조축 3] Exchange Act §16(a)(1) — >10% insider와 dormancy (15 U.S.C. §78p(a)(1), 발췌) [uscode.house.gov]

> Every person who is directly or indirectly the beneficial owner of more than 10 percent of any class of any equity security (other than an exempted security) which is registered pursuant to section 78l of this title, or who is a director or an officer of the issuer of such security …, shall file the statements required by this subsection with the Commission.

**왜 여기 있는가:** "내부자(insider)"라는 A-06의 한국어 표제가 §16 개념과 섞이기 쉽다. 두 가지를 고정한다 — ① §16의 지분선은 "**more than 10 percent**"(**초과**, ≥ 아님)이고, ② §16은 **Exchange Act §12 등록 클래스**에만 걸린다. Decipher/BUIDL형 토큰은 §12 미등록(D-01이 2,000명 미만을 지키는 이유가 바로 §12(g) 회피)이므로 **§16은 이 자산군에 dormant**다. 문서가 §16 지위·Form 3/4/5 의무를 이 토큰의 살아 있는 규제처럼 서술하면 오류이고, >10%를 *운영 스크리닝 휴리스틱*(REVIEW 큐 입력)으로만 쓰면 정합이다.

### 1.10 SEC 공식 안내 — control의 질적 정식과 예시 구조 (Layer 2) [sec.gov]

SEC 간행물 *Rule 144: Selling Restricted and Control Securities*:

> An affiliate is a person, such as an executive officer, a director or large shareholder, in a relationship of control with the issuer. Control means the power to direct the management and policies of the company in question, whether through the ownership of voting securities, by contract, or otherwise.

**의미:** SEC 스스로 Rule 144 맥락에서 Rule 405의 control 정식을 그대로 쓰고, 임원·이사·대주주를 **"such as"의 예시**로만 든다 — 자동 카테고리도, 지분율 기준도 아니다. A-06의 "추정은 운영, 판정은 사실·정황" 구조의 Layer 2 근거로 이 간행물을 인용하는 것이 정확하다. 특정 C&DI 번호를 이 명제의 근거로 다는 것은 본 기준서에서 검증하지 못했으므로, 업로드 문서에 C&DI 번호 인용이 있으면 그 번호 자체를 별도 검증 대상으로 올린다(§5).

### 1.11 Cascade 참조 스팟 — A-06=true가 켜는 조항들의 임계 자구 [ecfr.gov]

**(e)(1) 물량 한도 chapeau (→ C-08):**

> … the amount of securities sold, together with all sales of securities of the same class sold for the account of such person within the preceding three months, shall not exceed the greatest of:

(i)은 "One percent of the shares or other units of the class outstanding as shown by the most recent report or statement published by the issuer", (ii)는 national securities exchange 및 registered securities association 자동호가시스템 보고 거래량, (iii)은 §242.600상 *effective transaction reporting plan*·*effective national market system plan* 보고 거래량 — Giwa 체인 DEX는 (ii)(iii) 정의상 0이므로 상한이 (i) 1%로 수렴한다는 C-08 결론이 현행 자구로 재확인된다. "shall not exceed"이므로 **위반 부등식은 초과(>)**, 상한 도달(=)은 적법.

**(h)(1) Form 144 (→ E-06):**

> If the issuer is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act and the amount of securities to be sold in reliance upon this rule during any period of three months exceeds 5,000 shares or other units or has an aggregate sale price in excess of $50,000, a notice on Form 144 (§ 239.144 of this chapter) shall be filed electronically with the Commission.

임계는 "**exceeds** 5,000" · "**in excess of** $50,000" — 둘 다 **초과(>)**. 전자제출("filed electronically")은 2022년 개정 반영 자구다. (h)(2) 비보고 발행자 갈래는 종이 3부 제출로 남아 있다 — Decipher 자산군(비보고 발행자)에는 문언상 (h)(2)가 대응하므로, 문서가 "전자제출 의무"를 이 자산군에 그대로 얹었다면 갈래 오귀속이다.

**(c)·(f)·(g) (→ E-05·C-09):** (c)(2) 비보고 발행자의 현행정보는 §240.15c2-11(b)(5)(i)(A)–(N)·(P) 정보의 공중 이용가능성으로 충족한다(E-05의 난제). (f)(1)은 brokers' transactions·market maker 직접거래·riskless principal 3방식, (g)(3)(iv)는 ATS 호가 게시 요건 — C-09 소관이므로 여기서는 존재와 위치만 고정한다.

---

## §2. 연산자·기간 판정표 (회귀 테스트 소스)

| 조항 | 임계 문언 (verbatim 핵심) | 연산자·단위 | 비고 |
| --- | --- | --- | --- |
| 144(a)(2)(ii)·(iii) | "10 percent or more" | **≥ 10%** | 합산 person 정의(지배 기준 아님) |
| 144(b)(1)(i)·(ii) | "has not been an affiliate during the preceding three months" | **직전 3역월** | 비계열 자격의 look-back |
| 144(b)(2) | "at any time during the 90 days immediately before the sale" | **직전 90일** | 계열 tail — (b)(1)과 단위 상이 |
| 144(b)(1)(i) 후단 | "provided a period of one year has elapsed" | **1년 경과 시 (c)(1) 면제** | 보고회사 갈래 한정 |
| 144(e)(1) | "shall not exceed the greatest of" | **위반 = 초과(>)** | 도달(=)은 적법 |
| 144(h)(1)·(2) | "exceeds 5,000 shares" / "in excess of $50,000" | **> 5,000주 / > $50,000** | 3개월 합산 기준 |
| Rule 405 *Control* | "power to direct or cause the direction …" | **정량 기준 없음** | bright-line 부재의 근거 |
| ICA §2(a)(3)(A)·(B) | "5 per centum or more" | **≥ 5%** | ICA 축 — 자동 affiliated person |
| ICA §2(a)(3)(D) | "any officer, director, partner, copartner, or employee" | **직함 자동** | Rule 144 축으로 이식 금지 |
| ICA §2(a)(9) | "more than 25 per centum … shall be presumed" | **> 25% 추정(반증 가능)** | Rule 144 축에 추정 없음 |
| Exchange Act §16(a)(1) | "more than 10 percent … registered pursuant to section 78l" | **> 10% + §12 등록 전제** | Decipher 토큰엔 dormant |

---

## §3. A-06 문서 대조 체크리스트 (C1–C14)

**C1 — (a)(1) 자구.** §3 원문 블록이 §1.1과 문자 단위 일치하는가. 특히 "controls**,** or is controlled by"의 콤마와 "such issuer" 종결. Rule 405 *Affiliate* 정의와의 혼입 여부(§1.1 자구 주의).

**C2 — control 출처 서술.** "144은 control 무정의 → Rule 405 정의(Layer 1) + SEC 간행물의 144 맥락 적용(Layer 2)"의 2단 구조인가. Rule 405 서두의 적용범위 문언(§§230.400–494)을 무시한 단정 서술이 없는가.

**C3 — bright-line 금지.** 어떤 지분율(5%·10%·25% 등)도 Rule 144 축의 PASS/FAIL 규칙으로 코딩되어 있지 않은가. 수치는 오직 스크리닝·REVIEW 라우팅 입력으로만 등장하는가.

**C4 — 이사·임원 처리.** Rule 144 축에서 "자동 affiliate" 서술이 없는가. 실무상 추정(운영 정책)과 법적 판정(사실·정황)의 분리가 명시돼 있는가. ICA §2(a)(3)(D)의 직함 자동 규정과의 축 분리 해설이 있는가.

**C5 — 이중 look-back.** (b)(1) "preceding three months"와 (b)(2) "90 days"가 *별개 자구·별개 단위*로 정확히 인용되고, 게이트 구현이 두 기간을 모두 만족하도록(또는 max로) 설계돼 있는가. 단일 "90일"로의 통합 서술이 없는가.

**C6 — NON_AFFILIATE tail sub-check.** 비계열 판정 로직에 "매도 시점 비-affiliate" AND "look-back 무-affiliate"의 두 원자 검증이 모두 있는가(최다 오구현 지점). 상태 전이(affiliate → 비계열) 시 tail 만료 전 R2 비계열 경로 차단이 걸리는가.

**C7 — (a)(2) 인터페이스.** person 합산이 ① A-06 판정 대상 확장, ② C-08 물량 합산, ③ (h) 임계 계산의 세 용처로 구분 명기돼 있는가. ≥10% 연산자와 "or in any similar capacity" 자구.

**C8 — control securities.** affiliate 보유분은 restricted 여부와 무관하게 144 조건 대상이라는 (b)(2) "restricted or any other securities" 문언이 반영돼 있는가. (Decipher 전 토큰이 어차피 restricted라는 사실이 이 법리를 생략할 이유가 되지 않는다 — 문서의 일반 규칙 서술 정확성 문제.)

**C9 — §2(a)(11) 말미 문장.** 원문 블록이 §1.6과 일치하고, "affiliate를 위한 매도인·중개인의 underwriter 리스크"라는 인과가 이 문장에서 도출돼 있는가.

**C10 — §16 dormancy.** §16·Form 3/4/5가 언급된다면 ① ">10%"(초과) 연산자, ② §12 등록 전제, ③ Decipher 자산군 dormant 처리가 모두 있는가.

**C11 — ICA 오염 검사.** 5%·25%·직함 자동 등 ICA §2(a)(3)·(a)(9) 요소가 Rule 144 판정식에 스며든 곳이 없는가. R3 문서군(A-13·A-09·D-01)과의 cross-reference에서 "affiliate"라는 단어가 두 법의 어느 쪽 개념인지 매 등장마다 특정되는가.

**C12 — Cascade 목록.** A-06=true → E-05(144(c)) + C-08(144(e)) + C-09(144(f)·(g)) + E-06(144(h))의 4연쇄가 정확하고, (h)는 보고/비보고 갈래(전자/종이)가 구분돼 있는가. C-08 참조에서 (e)(1)(ii)(iii) 0-수렴 논거가 §1.11 자구와 일치하는가.

**C13 — 소스 규율.** 인용 URL이 전부 승인 소스(uscode.house.gov·ecfr.gov·sec.gov·govinfo.gov 등)인가. Cornell LII·Justia 링크가 하나도 없는가.

**C14 — 현행성 스탬프.** 문서의 기준일·개정 이력 서술이 "§230.144 최종 개정 2022-06/07(전자 Form 144), 이후 무변경, 2026-07-01 현행 확인"과 모순되지 않는가. 2020년 제안(시장연동증권 보유기간)을 살아 있는 개정처럼 쓴 곳이 없는가.

---

## §4. 우선 확인 오류 패턴 (대조 시 가장 먼저 볼 곳)

**패턴 1 — 두 look-back의 융합.** 실무 문헌 대부분이 "90-day tail" 한 단어로 쓰지만 조문은 (b)(1) 역월 3개월 / (b)(2) 90일의 이원 구조다. 문서가 하나의 숫자로 통합했다면 §3 원문 블록은 자구 오류, §5 판정식은 경계일(89–92일 차이) 오판정 리스크다. 수정 방향: 원문 이원 인용 + 구현은 두 조건 동시 충족.

**패턴 2 — 예시의 규칙 승격.** "임원·이사·10% 주주 = affiliate"는 SEC 간행물의 *예시*("such as")와 실무 추정을 법 규칙으로 승격시킨 오류다. 수정 방향: 예시·추정은 운영 스크리닝(§6/§11 레이어)으로 내리고, 판정은 Rule 405 질적 기준 + 증명서형(Pattern B) claim + 경계 REVIEW로.

**패턴 3 — 축 교차 오염.** 같은 프로젝트 안에 ICA의 ≥5%/직함 자동/>25% 추정 체계가 살아 있으므로(R3), A-06에 그 수치가 "참고"를 넘어 판정식으로 들어오기 쉽다. 수정 방향: §1.7–1.9 대조표를 문서에 명시적 "이식 금지" 절로 반영.

**패턴 4 — dormant 규제의 활성 서술.** §16 의무(단기매매차익 반환·Form 3/4/5)나 (h)(1) 전자제출을 §12 미등록·비보고 발행자군에 살아 있는 의무처럼 쓰는 것. 수정 방향: 각 조항의 전제(§12 등록 / §13·15(d) 보고 지위)를 판정식의 선결 게이트로 명기.

---

## §5. 재개 절차 — 파일 재업로드 후

1. **Verbatim diff:** 문서 §3의 각 "핵심 원문" 블록을 §1의 확정 원문과 문자 단위 대조(콤마·단복수·괄호 포함). 불일치는 전부 원문 쪽으로 교정.
2. **연산자 감사:** §2 표의 11행을 문서 전체(판정식·테스트케이스·figure 라벨 포함)에 대해 grep 수준으로 대조 — 특히 ≥10%(a)(2) vs >10%(§16) vs ≥5%/>25%(ICA)의 상호 오기.
3. **체크리스트 C1–C14 순차 판정,** 각 항 PASS/FAIL/N-A 기록.
4. **인용 검증:** 문서 내 모든 URL·release·C&DI 번호를 승인 소스에서 개별 확인(특히 C&DI 번호는 본 기준서 미검증 항목).
5. **Cascade·테스트 정합:** C-08(§3 zero-ADTV·> cap)·D-01(§12(g) 전제)·A-12(red flag 연동) 기존 문서와의 상호참조 일치 확인, 오구현 회귀 테스트(tail sub-check 누락 케이스) 존재 확인.
6. 수정본을 `.md` 정본 + pandoc 빌드 `.docx` 쌍으로 `/mnt/user-data/outputs/`에 산출.

---

## §6. 출처 (전부 2026-07-06 접속·승인 소스)

| 자료 | URL | 현행성 표시 |
| --- | --- | --- |
| 17 CFR §230.144 전문 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.144 | Title 17 current as of 2026-07-01 · 최종 개정 반영 2026-06-25 · §144 자체 최종 개정 2022-06/07 |
| 17 CFR §230.405 (*Control*·*Affiliate* 등) | https://www.ecfr.gov/current/title-17/section-230.405 | 동일 · *Control* 정의 무변경 |
| 15 U.S.C. §77b(a)(11) | https://uscode.house.gov/view.xhtml?req=(title:15 section:77b edition:prelim) | prelim, 2026-07 시행 기준 |
| 15 U.S.C. §80a-2(a)(3)·(a)(9) | https://uscode.house.gov/view.xhtml?req=(title:15 section:80a-2 edition:prelim) | "laws in effect on July 1, 2026" 명시 |
| 15 U.S.C. §78p(a)(1) | https://uscode.house.gov/view.xhtml?req=(title:15 section:78p edition:prelim) | prelim 현행 |
| SEC, *Rule 144: Selling Restricted and Control Securities* | https://www.sec.gov/reports/rule-144-selling-restricted-control-securities | SEC 공식 간행물 (Layer 2) |

*작성: Decipher 리걸 파트 검증 파이프라인 · 본 기준서는 A-06 본문이 아니라 그 대조 표준이다.*
