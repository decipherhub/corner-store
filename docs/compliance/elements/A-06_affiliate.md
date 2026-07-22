---
type: element-walkthrough
element-id: A-06
element-name: Affiliate
parent-recipe: R2 (§4(a)(7) Resale)·R1 (Reg D 506(c) Issuance·cumulative)
status: v2.1 — 공유 산출물 form (citation 검증 정정 반영·자체완결·규제맥락 우선)
audience: 개발팀·법무팀·외부 consultant·변호사
created: 2026-06-13
updated: 2026-06-14
related-external-sources:
  - "15 USC § 77b(a)(11) — Securities Act § 2(a)(11) "Underwriter": https://www.law.cornell.edu/uscode/text/15/77b"
  - "15 USC § 77d(a)(1) — Securities Act § 4(a)(1) "ordinary investor exemption": https://www.law.cornell.edu/uscode/text/15/77d"
  - "15 USC § 77e — Securities Act § 5 Registration: https://www.law.cornell.edu/uscode/text/15/77e"
  - "17 CFR § 230.144 — Rule 144 Resale safe harbor (현행 본문): https://www.ecfr.gov/current/title-17/section-230.144"
  - "17 CFR § 230.144(a)(1) — Rule 144 "Affiliate" 정의: https://www.ecfr.gov/current/title-17/section-230.144"
  - "17 CFR § 230.144(b)(1)(i) — non-affiliate path 진입 조건 (3-month decay 명시): https://www.ecfr.gov/current/title-17/section-230.144"
  - "17 CFR § 230.405 — Securities Act Rule 405 "Affiliate"·"Control" 통합 정의: https://www.ecfr.gov/current/title-17/section-230.405"
  - "SEC v. Ralston Purina Co., 346 U.S. 119 (1953): https://supreme.justia.com/cases/federal/us/346/119/"
  - "United States v. Wolfson, 405 F.2d 779 (2d Cir. 1968) — criminal conviction case (확인 필요): https://www.courtlistener.com/opinion/281943/united-states-v-louis-e-wolfson/"
  - "SEC v. Wolfson — civil enforcement·*United States v. Wolfson과 *별개 사건일 가능성 (변호사 확인 대상)"
tags: [element, A-06, affiliate, walkthrough, shared-deliverable, rule-144, rule-405]
---

# A-06 Affiliate — Element Walkthrough

> 본 문서는 *Decipher RWA DEX의 *공식 인수인계 문서*. *개발팀·*법무팀·*외부 consultant가 *읽고 *작업의 *base로 *활용*. *미국 증권법에 *익숙하지 *않은 *팀원도 *순서대로 *읽으면 *이해 가능 *수준으로 *작성*.

> ⚠️ **출처 검증 정정 노트 (v2.1, 2026-06-14).**
> v1.0·v2.0 초안의 citation을 eCFR 원문 (17 CFR 230.144·230.405)에 대조하여 정정·*불확실 부분 명시*. 읽는 사람은 아래를 정확한 것으로 보면 된다.
> 
> - **Rule 405 "Affiliate"·"Control" 정의는 *eCFR 원문 검증 완료**·*v2.0 인용은 *정확하다 — *"directly, or indirectly through one or more intermediaries, controls or is controlled by, or is under common control with"·*"possession, direct or indirect, of the power to direct or cause the direction of the management and policies of a person, whether through the ownership of voting securities, by contract, or otherwise".
> - **Rule 144(a)(1) "Affiliate" 정의도 *Rule 405와 *동일 표현·*Rule 144 내부의 *조작적 *별도 정의가 *Rule 144(a)(1)·*Rule 405는 *Securities Act 전반 통합 정의.
> - **Affiliate decay 3개월 (90일)의 *legal basis는 *Rule 144(b)(1)(i)** — *non-affiliate path 진입 조건이 "*if such person is not, and has not been for at least *three months*, an affiliate of the issuer". v2.0의 *"90일 decay"는 *3 calendar months의 *Decipher 운영 *해석·*조문 자체는 *"three months"로 *명시.
> - **Rule 144 5 제약의 *정확한 *subsection**:
>   - ***§ 230.144(c)*** Current public information
>   - ***§ 230.144(d)*** Holding period (6 months reporting / 1 year non-reporting)
>   - ***§ 230.144(e)*** Volume of securities sold (1% of outstanding OR 4-week average trading volume — *whichever greater)
>   - ***§ 230.144(f)*** Manner of sale (broker transaction·*market maker·*riskless principal)
>   - ***§ 230.144(h)*** Notice of proposed sale (Form 144 filing — *≥ 5,000 shares OR ≥ $50,000 in any *3-month period)
> - **Wolfson citation은 *변호사 *확인 대상으로 *유지*** — *v2.0에서 *"SEC v. Wolfson / United States v. Wolfson, 405 F.2d 779 (2d Cir. 1968)"로 *동일 citation을 *2 case에 *부여한 것은 *부정확 가능성*. *United States v. Wolfson은 *criminal *case (Louis E. Wolfson의 *§5 violation conviction)·*405 F.2d 779 (2d Cir. 1968)·*Friendly J. 판결. *SEC v. Wolfson은 *civil *enforcement이며 *별도 *citation·*proceeding일 *가능성. *정확한 *citation·*각 case의 *holdings 분리는 *변호사 follow-up 대상.
> - **§ 4(a)(1) Ordinary Investor Exemption*** 인용 (§3.1)·*조문 표기는 *"§ 4(a)(1)" 또는 *"15 USC § 77d(a)(1)" — *Securities Act 1933의 *Section 4 sub-paragraph (a)(1)·*v2.0 표기 정확.
> - **§ 2(a)(11) Underwriter 정의의 *마지막 문장 (issuer 정의에 *control person 포함)이 *Affiliate doctrine의 *legislative origin** — *v2.0의 *historical articulation 정확.

---

## §1. *규제 맥락 — *이 부품이 *왜 *필요한가*

### 1.1 *미국 증권법의 *큰 그림 — *4 Pillar*

미국 증권법은 *1929 Great Depression 이후 *investor protection을 *목적으로 *4 *주요 *법령 (Pillar)이 *제정되었다. *각 pillar는 *서로 다른 *영역을 *규율한다:

| Pillar | 시기 | 규제 대상 | 핵심 *관심사 |
|---|---|---|---|
| **Securities Act 1933** | 1933 | ***발행 (issuance)·*resale*** | *공시·*fraud 방지·*발행 + 후속 *유통 시점 |
| Securities Exchange Act 1934 | 1934 | *유통·*거래소·*broker-dealer | *지속 공시·*market structure |
| Investment Company Act 1940 (ICA) | 1940 | *집합투자기구 (fund) 자체 | *fund 구조의 *unique risk |
| Investment Advisers Act 1940 | 1940 | *자문업자 (advisers) | *advisers의 *fiduciary duty |

***본 부품은 *Securities Act 1933 영역의 *Affiliate doctrine을 *구현한다***. *구체적으로 *§2(a)(11)의 *"underwriter" 정의 + Rule 144(a)(1)의 *"affiliate" + Rule 405의 *"affiliate"·*"control" 정의 base*. *이 *doctrine은 *1933년에 *시작되어 *1968년 *Wolfson 판례를 *거쳐 *오늘날까지 *73년 *간 *발전한 *control person doctrine이다*.

### 1.2 *왜 *이 규제가 *존재하는가 — *Affiliate Doctrine의 *73년 *역사*

#### *Step 1 — *1933년 *Securities Act §5 *registration requirement*

Securities Act §5는 *증권의 *모든 *판매에 *대해 *SEC registration을 *원칙으로 *부과한다*. *registration이 *없는 *판매는 *불법이다*. *그러나 *모든 *판매가 *registered되는 것은 *비현실적이다 — *예: *내가 *오래 *보유한 *주식을 *친구에게 *판매한 *경우·*매번 *registration할 *필요는 *없다*.

#### *Step 2 — *§4(a)(1) ordinary investor exemption + §2(a)(11) "underwriter" 정의*

§4(a)(1)은 *"transactions by *any person *other than *an issuer, *underwriter, or *dealer"를 *registration 면제한다*. *즉, *일반 *투자자 *간의 *거래는 *자유롭다*. *그러나 *"underwriter"는 *issuer로부터 *증권을 *받아 *공중에 *분배하는 *역할이므로 *registration 의무를 *부담한다*.

§2(a)(11)이 *"underwriter"를 *정의한다*:

> **§ 2(a)(11) — *Underwriter 정의** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/77b)]
> 
> **Original**:
> "The term 'underwriter' means *any person who has purchased from an issuer with a view to, or offers or sells for an issuer in connection with, the distribution of any security*, or participates or has a direct or indirect participation in any such undertaking ... The term 'issuer' shall include, in addition to an issuer, *any person directly or indirectly controlling or controlled by the issuer, or any person under direct or indirect common control with the issuer*."
> 
> **한글 해석**:
> "Underwriter"란 — *issuer로부터 *distribution 목적으로 *증권을 *취득·*또는 *issuer를 *위해 *distribution과 *연관하여 *offer/sell하는 *person·*또는 *이런 *undertaking에 *직간접 *참여하는 *person*. *§2(a)(11)의 *"issuer"는 *issuer 자체 외에 ***issuer를 *직간접 *control하거나·*issuer에 의해 *직간접 *controlled되거나·*issuer와 *직간접 *common control하의 *person***도 *포함한다.

***결정적 *마지막 문장***: ***issuer 정의에 *control person을 *포함*시킴***. *즉, *issuer의 *control person이 *증권을 *팔면 *그 *control person도 *"issuer"로 *간주되어·*그로부터 *받은 *증권을 *분배하면 *underwriter가 *된다*. ***이 *조항이 *Affiliate doctrine의 *legislative origin이다***.

#### *Step 3 — *Wolfson 1968 — *Control Person Doctrine의 *foundational case*

> **United States v. Wolfson**, 405 F.2d 779 (2d Cir. 1968) [🔗 [CourtListener](https://www.courtlistener.com/opinion/281943/united-states-v-louis-e-wolfson/)] — *Louis E. Wolfson의 *criminal *conviction case·*Friendly J. 판결·*Securities Act § 5 violation
> 
> ⚠️ ***Citation 주의 (변호사 *확인 대상)***: *SEC v. Wolfson (civil enforcement)과 *United States v. Wolfson (criminal)은 *별개 *proceeding일 *가능성이 *높다*. *위 인용은 *criminal *case이며·*civil *case의 *정확한 *citation·*holdings 분리는 *변호사가 *원문 직접 *확인 *필요. *본 문서에서 *"Wolfson"이라 *부르는 *것은 *주로 *criminal *case의 *holdings를 *지칭한다.

Louis E. Wolfson은 *Continental Enterprises의 *largest shareholder (직간접 *총 40% 보유). *officer·*director는 *아니었다*. *그는 *2년에 걸쳐 *공개 *시장에서 *405만 주를 *판매했다 — *registration 없이*. *2nd Circuit (Friendly J.)은 *Wolfson을 *유죄로 *판결했다 — *그가 ***"controlling person"***이며 *§ 2(a)(11) 마지막 문장의 *"issuer"로 *간주되므로·*등록 없는 *판매가 *§5 violation이다*.

***Wolfson 판례의 *3 *핵심 holdings***:

1. ***Control은 *direct ownership만이 *아니라 *indirect ownership·*influence를 *포함한다*** — *Wolfson은 *공식 *직책이 *없었지만 *지분과 *family relationships로 *de facto control 행사
2. ***"Distribution"은 *single large sale도 *해당 가능*** — *반드시 *복수의 *거래가 *필요한 *것이 *아님
3. ***Control person의 *판매는 *항상 *issuer 판매로 *간주된다*** — *따라서 *registration 또는 *exemption이 *필수

#### *Step 4 — *Rule 144 (1972) — *Practice safe harbor*

Wolfson 이후 *SEC는 *control person의 *resale에 *대한 *bright-line rule이 *필요했다*. *1972년 *Rule 144를 *제정 — *"affiliate가 *다음 *조건을 *충족하면 *§4(a)(1) exemption이 *적용된다"는 *safe harbor*.

> **Rule 144(a)(1) — *Affiliate 정의** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.144)]
> 
> **Original**:
> "An *affiliate* of an issuer is a person that *directly, or indirectly through one or more intermediaries, controls, or is controlled by, or is under common control with, such issuer*."
> 
> **한글 해석**:
> issuer의 *"affiliate"란 — *issuer를 ***직간접적으로 (하나 이상의 intermediary 통해) *control하거나·*controlled되거나·*common control 하에 있는 *person***.

#### *Step 5 — *Rule 405 (1982) — *통합 정의*

Rule 405는 *Securities Act 전반에 *적용되는 *통합 *definition framework다*.

> **Rule 405 — *Affiliate·*Control 정의** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.405)]
> 
> **Original** (요약):
> "*Affiliate*. An *affiliate* of, or person *affiliated* with, a specified person, is a person that *directly, or indirectly through one or more intermediaries, controls, or is controlled by, or is under common control with*, the person specified.
> 
> *Control*. The term *control* (including the terms 'controlling,' 'controlled by' and 'under common control with') means the *possession, direct or indirect, of the power to direct or cause the direction of the management and policies of a person*, whether through the ownership of voting securities, by contract, or otherwise."
> 
> **한글 해석**:
> "Affiliate"란 — *directly 또는 *indirectly (intermediary 통해) ***controlling·*controlled by·*under common control with***인 *person*.
> "Control"이란 — *voting securities 소유·*contract·*기타 방법을 *통하여 ***management·*policies의 *direction을 *결정하거나·*결정할 *power의 *direct 또는 *indirect 소유***.

#### *73년 *doctrinal lineage 요약*

```
1933  Securities Act §5 registration + §4(a)(1) ordinary investor exemption
       └─ §2(a)(11) "underwriter" + issuer 정의에 control person 포함
                ↓
1968   Wolfson 2nd Cir — control person doctrine 확립
                ↓
1972   Rule 144 — affiliate resale safe harbor (operational bright-line)
                ↓
1982   Rule 405 — Securities Act 전반의 affiliate·control 통합 정의
                ↓
2026   Decipher RWA DEX — A-06 Element로 doctrine implementation
```

### 1.3 *Decipher에서 *왜 *이 부품이 *중요한가*

본 부품은 *2 *맥락에서 *발동된다*:

**맥락 1 — *Rule 144 Resale safe harbor***: *restricted securities (Reg D 506(c)·*§4(a)(2) 등 *private placement로 *취득한 *증권)의 *resale 시·*매도인이 *affiliate인지가 *Rule 144 *holding period·*volume limit·*manner of sale·*current information 요건에 *영향을 *준다*. *Affiliate는 *non-affiliate보다 *훨씬 *strict한 *제약을 *받는다*.

**맥락 2 — *§4(a)(1½)·*§4(a)(7) Resale exemption***: *affiliate가 *resell할 *때 *어떤 *path를 *사용할 수 *있는지가 *제한된다*. *Decipher Recipe R2 (Resale)의 *primary check가 *본 부품이다*.

***본 부품이 *오작동하면***:
- *Affiliate를 *non-affiliate로 *판정 → *strict 요건 *우회 → *§5 violation
- *Non-affiliate를 *affiliate로 *판정 → *정당한 *거래 *차단·*operational friction
- *Manifest integrity 위반 → *post-trade audit 시 *issuer·Decipher *liability

### 1.4 *Affiliate 식별의 *근본적 *어려움*

A-13 (QP)·*A-03 (AI) 같은 *부품은 *Buyer의 *재정 *수치만 *검증하면 *되지만·***A-06 Affiliate는 *판정이 *훨씬 *어렵다***:

1. ***Affiliate 자격은 *issuer-dependent***: *동일 *지갑이 *issuer X에 *대해 *affiliate이지만 *issuer Y에 *대해 *non-affiliate일 수 있다·*Trusted Issuer가 *각 *asset별로 *check해야 함
2. ***"Control"은 *judgment-based 정의***: *Rule 405가 *"power to direct"라는 *broad term을 *사용·*exact threshold (10%·*20%·*25%)가 *조문에 *없음·*practice는 *대체로 *10% guideline이나 *case-by-case
3. ***Indirect control chain이 *깊을 수 있음***: *family LLC → trust → individual chain에서 *어디까지 *look-through할 *것인가
4. ***Family relationship + control***: *Wolfson에서 *family relationship이 *control evidence로 *사용됨·*개인 *지갑이 *family member로 *연결되면 *집합적 *control 판단 가능
5. ***Affiliate status는 *시간에 *따라 *변한다*** — *오늘 *affiliate가 *6개월 후 *non-affiliate일 수 있음·*"decay period" 처리 필요

***이 5 *fundamental difficulty가 *Affiliate 부품의 *implementation 복잡도를 *높인다***.

### 1.5 *한국 자본시장법과의 *비교*

| 측면 | 한국 *자본시장법 (특수관계인·*계열사) | 미국 Rule 144·Rule 405 *Affiliate |
|---|---|---|
| 정의 출처 | 자본시장법·*공정거래법·*상법 등 *분산 | Rule 144(a)(1)·*Rule 405 통합 |
| 자연인 기준 | 친족 관계 (8촌·4촌 등)·*임원·*주요주주 | family relationships가 *Wolfson에서 *evidence·*그러나 *조문에 *명시 *threshold 없음 |
| 법인 기준 | 30% 출자·*임원 겸임 등 *구체적 *수치 | "power to direct" — *judgment-based·*practice 10% guideline |
| 적용 *맥락 | 공시 의무·*거래 제한·*과세 등 *광범위 | resale 제한 (Rule 144·*§5)·*registration |

***한국법은 *구체적 *수치 기준 (30%·*8촌 등)이 *조문에 *명시·*미국법은 *judgment-based "control" 정의***. *한국 *법무팀이 *미국 affiliate doctrine을 *이해할 때 *이 *접근 *방식 *차이를 *유념해야 *한다*.

---

## §2. 📋 *메타 정보*

| 항목 | 값 |
|---|---|
| 부품 이름 | Affiliate (내부자 판정) |
| 검사 대상 | Rule 144(a)(1)·*Rule 405 affiliate 자격 |
| Internal ID (Decipher PM 규약) | A-06 |
| 검증 방식 | 증명서 확인형 + 운영형 (off-chain due diligence + on-chain claim + monitoring) |
| 활성화 시점 (Timing) | pre-trade |
| 상태 (Stateful) | STATELESS (각 거래 시점 snapshot)·*그러나 affiliate decay 모니터링 *별도 |
| 주 활성화 *Recipe | R2 (§4(a)(7) Resale)·R-3 (Rule 144 Resale path) |
| Cumulative *Recipe | R1 (Reg D 506(c) Issuance·*affiliate가 *issuer 측이면) |
| Cascade Element | A-09 (Look-Through for entity affiliate)·*A-11 (Claim Freshness) |
| 파일명 | A-06_affiliate.md |
| 위치 | 산출물/elements/ |

---

## §3. ① *법적 근거*

### 3.1 *Statutory base*

§2(a)(11) underwriter 정의가 *Affiliate doctrine의 *statutory origin이다 — *§1.2에서 *이미 *원문 박스 제시*. *§5 registration requirement는 *모든 *증권 *판매의 *기본 의무이며·*§4(a)(1)이 *ordinary investor exemption을 *제공한다*:

> **§ 4(a)(1) — *Ordinary Investor Exemption** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/77d)]
> 
> **Original**:
> "The provisions of section 5 shall not apply to ... transactions by any person *other than an issuer, underwriter, or dealer*."
> 
> **한글 해석**:
> 등록 요건 (§5)은 ***issuer·*underwriter·*dealer가 *아닌 *person의 *거래***에는 *적용되지 *않는다.

§4(a)(1)·§2(a)(11) 결합 결과: ***affiliate가 *판매하면 *그는 *"issuer"로 *간주되어·*그로부터 *받은 *증권을 *분배하는 *자는 *"underwriter"가 된다*** — *따라서 *registration 또는 *exemption이 *필수.

### 3.2 *Regulatory specification*

Rule 144(a)(1)·*Rule 405 *원문은 *§1.2에서 *이미 *제시*. *추가로 *Rule 144의 *affiliate 제약*:

> **Rule 144 — *Affiliate-specific 5 제약 (정확한 *subsection)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.144)]
> 
> **Original** (sub-section별 *요지):
> Resale of restricted securities by *affiliates*는 *다음 *5 *조건을 *모두 *충족해야 한다:
>   ***§ 230.144(c) Current public information***: issuer가 *Exchange Act §13·*§15(d) reporting requirement를 *충족하며 *최근 12개월 *report가 *available해야. *비-reporting issuer는 *별도 *factual information requirement.
>   ***§ 230.144(d) Holding period***: restricted securities는 *acquisition 이후 *최소 *6 months (reporting company) 또는 *1 year (non-reporting company)·*holding 의무.
>   ***§ 230.144(e) Volume limitation***: *3-month period 동안 *판매량 cap — *(1) outstanding의 *1% 또는 *(2) 4-week average trading volume (NYSE·*NASDAQ·*OTC 거래) 중 *whichever is greater. Notice of proposed sale filing (Form 144) 후 *next 3 calendar month 기준.
>   ***§ 230.144(f) Manner of sale***: equity securities의 *경우 *broker transactions·*market maker와의 *거래·*riskless principal transactions 중 *하나로만. *solicitation·*special compensation 등 *금지.
>   ***§ 230.144(h) Notice of proposed sale***: ≥ 5,000 shares OR ≥ $50,000 aggregate sale price in any *3-month period 시 *Form 144 filing 의무.
> 
> Resale by *non-affiliates* (1 year+ holding·*Rule 144(b)(1)(i) "*not, and has not been for at least three months, an affiliate*" 조건 충족):
>   - 위 *5 제약 *모두 *면제 (free resale·*reporting company 6 months 보유 시 *§ 230.144(c) current information만 *적용)
> 
> **한글 해석**:
> Affiliate의 *restricted securities resale은 ***5 *strict 제약*** (정확한 *subsection 명시):
>   (c) ***Current public information*** — issuer 공시 정보가 *유효해야
>   (d) ***Holding period*** — 보고회사 6개월·*비보고회사 1년
>   (e) ***Volume limitation*** — 3-month period·*outstanding의 1% OR 4-week average trading volume 중 *큰 값
>   (f) ***Manner of sale*** — broker transaction·*market maker·*riskless principal만
>   (h) ***Form 144 filing*** — ≥ 5,000 주 OR ≥ $50,000 시
> 
> Non-affiliate는 *§ 230.144(b)(1)(i)의 *"3-month decay" 조건 (과거 3개월 *affiliate가 *아니었음) + 1년 이상 *holding 충족 시 *위 *5 제약 *모두 *면제*. ***이 "3-month decay"가 *Decipher AffiliateBasis.FORMER_AFFILIATE_DECAY enum의 *legal basis다 — *조문 *literal text가 *"three months"·*Decipher는 *operational 측면에서 *90 calendar days로 *encoding***.

### 3.3 *Interpretive guidance*

#### *Wolfson — *Foundational case (citation 변호사 확인 대상)*

§1.2 Step 3에서 *상세 *제시. ⚠️ *주의: *United States v. Wolfson, 405 F.2d 779 (2d Cir. 1968) (criminal·*Friendly J.)이 *foundational citation·*SEC v. Wolfson (civil)은 *별개 *proceeding일 *가능성. *주요 holdings (criminal case 기준):
1. Indirect control + family relationships도 *control evidence
2. Single large sale도 *"distribution" 해당 가능
3. Control person의 *판매는 *항상 *issuer 판매로 *간주

#### *Rule 144·*Rule 405 Adopting Releases*

Rule 144는 *1972년 *SEC Release 33-5223 (adopting release)에서 *제정되었다*. *Rule 405는 *1982년 *통합 *definition framework로 *정착되었다*. *각 release의 *legislative intent + practice clarification이 *각 조문의 *해석 base다*.

#### *Practice — *10% guideline*

조문에 *명시 *threshold가 *없지만·*practice는 *대체로 *10% beneficial ownership을 *affiliate guideline으로 *사용한다 (Schedule 13D·*Section 16의 *10% threshold와도 *parallel)*. *그러나 *Wolfson 같은 *family relationship·*officer/director role도 *별도 *evidence가 된다*.

### 3.4 *Sub-요건 분해 — *AffiliateBasis 9 enum*

본 부품의 *판정 결과를 *9 *enum으로 *세분화한다 — *각 *enum은 *서로 다른 *affiliate evidence 유형을 *나타낸다*:

| AffiliateBasis enum | 의미 | 근거 |
|---|---|---|
| `OFFICER_DIRECTOR` | issuer의 *executive officer·*director | Wolfson + Rule 405 "power to direct" |
| `GENERAL_PARTNER` | issuer의 *general partner | Rule 405 |
| `BENEFICIAL_OWNER_10PLUS` | issuer의 *10%+ beneficial ownership | Practice 10% guideline |
| `FAMILY_OF_AFFILIATE` | 위 affiliate의 *family member (Wolfson 추론) | Wolfson |
| `INDIRECT_CONTROL` | intermediary 통한 *control (family LLC·*trust 등) | Rule 144(a)(1) "directly, or indirectly through one or more intermediaries" |
| `COMMON_CONTROL` | issuer와 *common control 하의 *별도 entity | Rule 405 "under common control with" |
| `FORMER_AFFILIATE_DECAY` | 최근 affiliate였으나 *decay period (3개월) 중 | Rule 144 practice — *affiliate 신분 *변경 후 *3개월간 *affiliate 제약 *지속 |
| `NOT_AFFILIATE` | 위 *모든 *category에 *해당하지 *않음 | Default state |
| `UNCERTAIN_AFFILIATE` | 판정 불가·*manual review | Edge case |

### 3.5 *DeterminationSource 7 enum — *Evidence source*

Affiliate 판정의 *evidence source도 *enum화한다*:

| DeterminationSource enum | 의미 |
|---|---|
| `ISSUER_REGISTRY` | Issuer가 *직접 *제공하는 *affiliate registry (가장 *강한 *evidence) |
| `13D_13G_FILING` | SEC EDGAR Schedule 13D·13G filing (10%+ public disclosure) |
| `SECTION_16_FILING` | Section 16 insider filing (officer·director·10% holder) |
| `KYC_BENEFICIAL_OWNERSHIP` | Trusted Issuer가 *수집한 *beneficial ownership *증빙 |
| `CORPORATE_DOCUMENT` | Corporate filing (Board minutes·*operating agreement 등) |
| `SELF_ATTESTATION` | Buyer 자가 진술 (weakest·*Layer 1 only) |
| `EXTERNAL_SPOT_CHECK` | 랜덤 audit·*third-party verification |

---

## §4. ② *입력 사실 — *판정에 *필요한 *데이터*

### 4.1 *어떤 *증거가 *필요한가*

본 부품 판정의 *4 *질문*:

1. *Buyer가 *issuer의 *officer/director/general partner인가?
2. *Buyer가 *issuer의 *10%+ beneficial owner인가?
3. *Buyer가 *위 *affiliate의 *family member 또는 *indirect chain (LLC·trust)을 *통한 *control person인가?
4. *Buyer가 *former affiliate decay period (3개월) 중인가?

### 4.2 *Data field*

| 필드 이름 | 데이터 *유형 | 출처 | 무엇을 *말해주는가 |
|---|---|---|---|
| `claim.affiliateBasis` | enum (9 종) | Trusted Issuer claim | AffiliateBasis enum 중 *하나 |
| `claim.determinationSource` | enum (7 종) | Trusted Issuer claim | Evidence source enum |
| `claim.assetIdentifier` | string | Trusted Issuer claim | 어느 *asset (issuer)에 *대한 *affiliate 판정인지 |
| `claim.verifiedAt` | timestamp | Trusted Issuer claim | 발급 시점 (freshness 확인) |
| `claim.issuer` | address | Trusted Issuer claim | 발급 기관 |
| `claim.signature` | bytes | Trusted Issuer claim | 위변조 방지 |
| `claim.decayStartedAt` (optional) | timestamp | Trusted Issuer claim (decay basis only) | Former affiliate decay 시작 시점 |
| `lookThroughChain[]` | array | Trusted Issuer claim (indirect chain) | sub-owner들의 *affiliate evidence chain |

### 4.3 *수집 path — *5 step flow*

```
Step 1: Frontend self-identification
  ↓ Buyer가 *DEX 진입·KYC + asset 선택 (어느 *RWA token 매수)
  ↓ Buyer가 *self-id: "issuer X의 *직원/주요주주 등인가?"
  
Step 2: Issuer Registry cross-check
  ↓ Issuer가 *제공한 *affiliate registry와 *cross-check
  ↓ 등록된 *affiliate면 *direct match
  
Step 3: SEC EDGAR cross-check (옵션)
  ↓ 13D·13G·Section 16 filing 조회
  ↓ 10%+ holder 또는 *officer/director match 확인
  
Step 4: Off-chain KYC due diligence (Trusted Issuer)
  ↓ Beneficial ownership·*family relationships·*indirect chain 검증
  ↓ Reasonable belief 형성
  
Step 5: On-chain claim publication
  ↓ Trusted Issuer가 *signed claim publication
  ↓ AffiliateBasis enum + DeterminationSource enum + assetIdentifier 포함
```

### 4.4 *Asset-specific evidence — *핵심 특성*

***Affiliate 자격은 *asset-dependent다***. *같은 *Buyer가 *asset A (예: *issuer X token)에 *대해서는 *affiliate이고·*asset B (issuer Y token)에 *대해서는 *non-affiliate일 수 있다*. *따라서 *claim은 *반드시 *`assetIdentifier`를 *포함*하며·*매 *trade마다 *해당 asset에 *대한 *affiliate claim을 *조회해야 *한다*.

### 4.5 *4-Step Identification Chain*

```
Step (a): Direct affiliate check
  ↓ Issuer Registry·*13D/13G·*Section 16 filing 등
  ↓ Match 시 → OFFICER_DIRECTOR·*GENERAL_PARTNER·*BENEFICIAL_OWNER_10PLUS
  
Step (b): Family relationship check
  ↓ Step (a)에서 *발견된 *affiliate의 *family member인지 확인
  ↓ Match 시 → FAMILY_OF_AFFILIATE (Wolfson 추론)

Step (c): Indirect chain check
  ↓ Buyer가 *family LLC·*trust·*기타 entity 통해 *issuer를 *간접 *control하는지
  ↓ A-09 (Look-Through) cascade
  ↓ Match 시 → INDIRECT_CONTROL OR COMMON_CONTROL

Step (d): Decay check
  ↓ Buyer가 *과거 *affiliate였으나 *3개월 *이내인지
  ↓ Match 시 → FORMER_AFFILIATE_DECAY (affiliate 제약 *지속)
```

---

## §5. ③ *판정 로직*

### 5.1 *전체 흐름*

```
function check_A_06(prospective_buyer, asset, block):
    # Step 1: claim 조회 (asset-specific)
    claim = ONCHAINID.getClaim(prospective_buyer, Topic.AFFILIATE, asset.id)
    
    if claim == null:
        return FAIL_AFFILIATE_STATUS_UNKNOWN  # affiliate 자격 *판정 안 됨
    
    # Step 2: signature·issuer trust 확인
    if not Cryptography.verify(claim.signature, claim.issuer):
        return FAIL_AFFILIATE_STATUS_UNKNOWN
    if not TrustedIssuerRegistry.contains(claim.issuer):
        return FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER
    
    # Step 3: claim freshness
    freshness_cap = 90 days   # affiliate status는 *변화 frequent → 짧은 cap
    if claim.verifiedAt < block.timestamp - freshness_cap:
        return FAIL_AFFILIATE_CLAIM_EXPIRED
    
    # Step 4: assetIdentifier match
    if claim.assetIdentifier != asset.identifier:
        return FAIL_AFFILIATE_STATUS_UNKNOWN  # 다른 *asset에 *대한 *claim
    
    # Step 5: AffiliateBasis enum 분기 + Recipe 응답
    if claim.affiliateBasis == NOT_AFFILIATE:
        return PASS_NON_AFFILIATE
    
    elif claim.affiliateBasis IN {OFFICER_DIRECTOR, GENERAL_PARTNER, 
                                   BENEFICIAL_OWNER_10PLUS, FAMILY_OF_AFFILIATE,
                                   INDIRECT_CONTROL, COMMON_CONTROL}:
        return PASS_AFFILIATE  # affiliate 신분 *확인·*Recipe가 *strict 제약 적용
    
    elif claim.affiliateBasis == FORMER_AFFILIATE_DECAY:
        decay_remaining = (claim.decayStartedAt + 90 days) - block.timestamp
        if decay_remaining > 0:
            return PASS_AFFILIATE  # decay 기간 *중·*affiliate 제약 지속
        else:
            return PASS_NON_AFFILIATE  # decay 완료
    
    elif claim.affiliateBasis == UNCERTAIN_AFFILIATE:
        return REVIEW_AFFILIATE_UNCERTAIN
    
    else:
        return REVIEW_AFFILIATE_UNCERTAIN
```

### 5.2 *Step별 해설*

***Step 1***: *Buyer의 *blockchain address에 *연결된·*특정 *asset에 *대한 *affiliate claim을 *조회한다*. *Topic.AFFILIATE + asset.id의 *복합 *key가 *필요하다 (A-13·A-03와 *결정적 *차이 — *asset-specific).

***Step 2~3***: signature·*issuer trust·*freshness는 *공통 check pattern. *그러나 *freshness cap이 *90일로 *훨씬 *짧다 — affiliate status는 *직책 변경·*지분 매도/매수로 *frequent하게 *변한다.

***Step 4***: assetIdentifier match. *Buyer가 *asset A에 *대한 *claim을 *가지고 *asset B를 *매수하려 *하면 *FAIL_AFFILIATE_STATUS_UNKNOWN (해당 asset에 *대한 *판정이 *없는 상태).

***Step 5***: AffiliateBasis enum 분기:
- `NOT_AFFILIATE` → PASS_NON_AFFILIATE: 자유로운 *resale (Rule 144 1년 보유 후)
- 그 외 *affiliate enum → PASS_AFFILIATE: *Recipe R2가 *Rule 144 5 제약 (holding·info·volume·manner·Form 144) 적용
- `FORMER_AFFILIATE_DECAY` → decay 기간 (3개월) 동안 *affiliate 제약 *지속·*이후 *NOT_AFFILIATE 처리

### 5.3 *주의 — *Recipe-level *처리*

본 부품은 *"affiliate 여부를 *판정"만 *한다·*"affiliate이면 *trade 금지"가 *아니다. *Recipe R2 (Resale)가 *affiliate 결과를 *받아 *Rule 144의 *5 제약 (holding period·*current information·*volume·*manner·*Form 144)을 *추가 *check한다*. *즉, *affiliate라도 *Rule 144 모든 제약을 *충족하면 *trade는 *허용된다*.

### 5.4 *비결정성 → 결정성 framing*

본 부품도 *core *judgment (control·*family relationship·*indirect chain depth·*"power to direct")는 *off-chain Trusted Issuer가 *수행한다*. *Rule 405의 *"power to direct"는 *조문에 *quantitative threshold 없이 *완전히 *judgment-based이다*. *Trusted Issuer가 *13D filing·*beneficial ownership·*family map을 *종합하여 *AffiliateBasis enum을 *결정·*claim 발급한다*.

---

## §6. ④ *거절·예외 처리*

### 6.1 *Failure / Pass codes 종합*

| Code | 의미 | 다음 단계 |
|---|---|---|
| `PASS_NON_AFFILIATE` | non-affiliate 확인·*Rule 144 자유 resale 가능 (1년+ 보유 시) | Recipe R2가 *다른 *조건만 *check |
| `PASS_AFFILIATE` | affiliate 신분·*Rule 144 5 제약 적용 필요 | Recipe R2가 *5 제약 *추가 check |
| `FAIL_AFFILIATE_STATUS_UNKNOWN` | claim 없음·*asset mismatch·*signature 위조 | Trusted Issuer에 *해당 *asset의 *claim 발급 요청 |
| `FAIL_AFFILIATE_CLAIM_EXPIRED` | 90일 cap 초과 | Trusted Issuer에 *renewal 요청 |
| `FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER` | issuer ∉ Registry | 다른 *Trusted Issuer 사용 |
| `REVIEW_AFFILIATE_UNCERTAIN` | 판정 불가 (edge case·*registry update 중) | Manual review queue |

### 6.2 *Affiliate Decay 관리*

Affiliate 신분이 *변하는 *경우·*claim도 *update되어야 *한다*:

- *Buyer가 *officer 사임·*10%+ 지분 매도 → *affiliateBasis가 *FORMER_AFFILIATE_DECAY로 *변경 + decayStartedAt timestamp 기록
- *3개월 *경과 후 → *affiliateBasis가 *NOT_AFFILIATE로 *자동 *변경 (또는 *재발급)

Decay 기간 *동안에는 *Rule 144 제약이 *지속된다 (former affiliate가 *제약을 *우회하기 *위해 *사임 후 *즉시 *resell하는 *것을 *방지).

### 6.3 *Manual Review Path*

REVIEW_AFFILIATE_UNCERTAIN 처리는 *복잡 case가 *많다*. *Decipher Trust Operations team의 *due diligence + 변호사 자문 escalate (필요 시)·*72시간 SLA·*audit trail 기록.

### 6.4 *Buyer-facing message*

| Code | Frontend message |
|---|---|
| FAIL_AFFILIATE_STATUS_UNKNOWN | "이 asset에 대한 affiliate 자격 확인이 필요합니다. KYC 진행해 주세요." |
| FAIL_AFFILIATE_CLAIM_EXPIRED | "Affiliate 자격 인증이 만료되었습니다 (90일). 갱신해 주세요." |
| PASS_AFFILIATE | "Affiliate로 *확인되었습니다. Rule 144 제약이 *적용됩니다." (informational) |

---

## §7. ⑤ *테스트 케이스 — *3 김 부장 *시나리오*

A-06의 *test cases는 *현실적 *fact pattern을 *base로 *3 *시나리오*를 *제시한다 (한국 *맥락에서 *익숙한 *"김 부장"을 *주인공으로).

### 7.1 *Test 1 — *현재 affiliate (Officer)*

***시나리오***: 김 부장 (40세). *RWA token X를 *발행한 *Korean Issuer Co.의 *Chief Operating Officer (현직). *RWA token X 보유량 *3,000 (개인 *지분 *8%). *DEX에서 *2,500 token resell 시도.

***예상 결과***: PASS_AFFILIATE → Recipe R2가 *Rule 144 5 제약 적용

***Trace***:
- claim.affiliateBasis = OFFICER_DIRECTOR (COO)
- claim.determinationSource = ISSUER_REGISTRY (Korean Issuer Co.가 *제공한 *officer registry)
- Step 5 → PASS_AFFILIATE
- Recipe R2가 *추가 check:
  - Holding period (보고회사면 6개월·*비보고회사면 1년) ✅
  - Current information ✅
  - Volume: 3개월간 *판매량이 *outstanding의 *1% 또는 *4주 *평균 *trading volume 중 *큰 값 이내여야
  - Manner of sale: broker transaction·*market maker 통해서만
  - Form 144 filing (≥ 5,000 주 또는 ≥ $50,000 시)

***해설***: 김 부장이 *2,500 토큰을 *팔려면 *Rule 144의 *모든 *제약을 *충족해야 *한다. *이는 *control person이 *내부 정보를 *우회 *활용하여 *market에 *증권을 *flood하는 *것을 *방지하기 *위한 *legislative 의도다*.

### 7.2 *Test 2 — *Decay 진행 중 (사임 후 *60일)*

***시나리오***: 김 부장이 *60일 전 *COO 사임. *지분도 *모두 *매도 (현재 *0 token). *다시 *RWA token Y 매수 시도 (이번에는 *issuer Y의 *직원 *아님).

***예상 결과***:
- Issuer X에 *대한 *claim: FORMER_AFFILIATE_DECAY·*decay 60일 진행 (남은 30일) → PASS_AFFILIATE (still subject to Rule 144 for *issuer X)
- Issuer Y에 *대한 *claim: NOT_AFFILIATE → PASS_NON_AFFILIATE

***해설***: ***Affiliate status는 *issuer-specific하다***. *김 부장은 *issuer X에 *대해서는 *3개월 *decay 기간 *동안 *Rule 144 제약을 *받지만·*issuer Y에 *대해서는 *처음부터 *non-affiliate다*. *이는 *§4.4에서 *명시한 *asset-dependent affiliate 특성의 *concrete example이다*.

### 7.3 *Test 3 — *Decay 종료 후*

***시나리오***: 김 부장 *사임 후 *95일 경과. *모든 *지분 *매도 *완료. *이전 *issuer X의 *token 재매수 시도.

***예상 결과***: PASS_NON_AFFILIATE
- decay 기간 (90일) *완료
- Trusted Issuer가 *claim *update — *affiliateBasis가 *NOT_AFFILIATE로 *변경
- Step 5 → PASS_NON_AFFILIATE
- Recipe R2: *1년 이상 *보유한 *restricted security면 *자유 resell (Rule 144 모든 제약 *면제)

***해설***: ***Decay 기간 처리가 *결정적이다***. *Affiliate 신분이 *공식적으로 *종료되었더라도·*Rule 144는 *3개월간 *제약을 *지속시킨다 — *전 affiliate가 *내부 *정보 *우위를 *3개월 *이내에 *활용하는 *것을 *방지하기 *위함이다*. *Decipher의 *AffiliateBasis enum과 *decayStartedAt timestamp가 *이 *시간적 *제약을 *encode한다*.

### 7.4 *Test 4 — *Indirect Chain (family LLC)*

***시나리오***: 김 부장의 *동생이 *60% 지분 *보유한 *family LLC. *family LLC가 *issuer X의 *15% beneficial ownership. *이 *family LLC가 *DEX에서 *resell 시도.

***예상 결과***: PASS_AFFILIATE (INDIRECT_CONTROL)
- A-09 (Look-Through) cascade 발동
- family LLC → 김 부장 동생 → 김 부장 (family relationship)
- 김 부장이 *issuer X의 *officer였으므로·*family LLC도 *indirect control 추론
- claim.affiliateBasis = INDIRECT_CONTROL
- PASS_AFFILIATE → Rule 144 5 제약 적용

***해설***: ***Wolfson 1968 판례의 *direct 적용***. *family relationship + indirect ownership chain을 *통해 *control person이 *식별된다*. *Rule 144(a)(1)의 *"directly, or indirectly through one or more intermediaries"가 *legislative base다*.

### 7.5 *Test 5 — *NOT_AFFILIATE Pass*

***시나리오***: 미국 거주 *자연인 (개인 *투자자). *RWA token X 보유량 *50 (개인 *지분 *0.0001%). *issuer X와 *family relationship 없음. *2,000 token 추가 매수 시도.

***예상 결과***: PASS_NON_AFFILIATE
- claim.affiliateBasis = NOT_AFFILIATE
- Step 5 → PASS_NON_AFFILIATE
- Recipe R2: *Rule 144 제약 *면제 (1년+ 보유 시·*또는 *Recipe별 *다른 *조건만 *check)

---

## §8. (α) *증명서 확인형 패턴 적용 — *운영형 *결합*

### 8.1 *패턴 B + 운영형 (Hybrid)*

A-06는 *순수 *증명서형 (패턴 B)에 *그치지 *않고·*운영형 (감시·*decay 모니터링) *요소도 *결합한다*. *이유*:

- *Affiliate status는 *직책 변경·*지분 매도/매수로 *frequent하게 *변한다
- *Decay period (3개월)는 *시간 기반 *감시가 *필요
- *Family relationship·*indirect chain은 *주기적 *재검토가 *필요

따라서 *Trusted Issuer는 *initial claim 발급 외에도 *주기적 *re-attestation 의무를 *진다 (90일 cap이 *이를 *encode).

### 8.2 *Issuer Registry — *strongest evidence source*

DeterminationSource 중 *`ISSUER_REGISTRY`가 *가장 *강한 *evidence다*. *Issuer 자체가 *제공하는 *affiliate registry는 *officer·*director·*10%+ holder list를 *직접 *encode한다*. *Decipher가 *issuer와의 *직접 *integration을 *통해 *이 *registry를 *수신하면 *가장 *높은 *quality의 *affiliate claim이 *발급 가능하다*.

---

## §9. (β) *Cross-Element·Cross-Recipe Coordination*

### 9.1 *Element cascade map*

```
A-06 (Affiliate) ──┬─ (INDIRECT_CONTROL OR FAMILY_OF_AFFILIATE) ──► A-09 (Look-Through)
                    │
                    └─ (모든 case) ──► A-11 (Claim Freshness·*90일 cap)
```

### 9.2 *Recipe orchestration*

| Recipe | A-06 활성화 *조건 | 본 부품의 *역할 |
|---|---|---|
| R2 (§4(a)(7) Resale) | 항상 (Resale primary check) | Affiliate 여부 *판정·*Rule 144 5 제약 적용 base |
| R-3 (Rule 144 Resale path) | 항상 | A-06 결과를 *받아 *5 제약 추가 적용 |
| R1 (Reg D 506(c) Issuance) | cumulative (affiliate가 *issuer 측 직원·*KE인 경우) | Issuance 시점의 *affiliate 식별 |

### 9.3 *Conflict resolution rule*

**Case 1 — *Affiliate + Rule 144 제약 위반***:
- A-06 결과 PASS_AFFILIATE
- Recipe R2가 *holding period·*volume·*manner 등 *5 제약 *check
- 일부 미충족 시 *Recipe R2 FAIL·*trade reject

**Case 2 — *Affiliate decay 경계 시점***:
- Decay startedAt + 90일이 *block timestamp 직전 *경계
- 5.1 pseudocode의 *decay_remaining > 0 check
- decay_remaining이 *정확히 *0이면 *NOT_AFFILIATE로 *전환 — *inclusive boundary

**Case 3 — *Multi-asset affiliate***:
- 김 부장이 *issuer X의 *officer + issuer Y의 *board member
- 각 asset별 *claim이 *별도로 *발급되어야
- DEX는 *매 *trade마다 *해당 asset의 *claim을 *조회

### 9.4 *Manifest integrity*

post-trade commit 시점·*Recipe R2 결과의 *manifest log·*B-01 (Manifest Integrity Check)가 *재검증한다*.

---

## §10. (γ) *3-Layer Solution Articulation*

### 10.1 *각 Layer*

| Layer | A-06 적용 |
|---|---|
| Layer 1 — Self-Attestation | Buyer가 *frontend에서 *"본인은 *issuer X의 *직원·*주요주주인가?" 자가 진술 |
| Layer 2 — Trusted Issuer | Issuer Registry·*13D/13G·*Section 16 filing·*KYC beneficial ownership *due diligence·*claim 발급 |
| Layer 3 — External Spot-Check | 랜덤 audit·*third-party verification·*Decay status 주기적 재검토 |

### 10.2 *A-06 특수성 — *Issuer-side cooperation 필수*

A-13·*A-03는 *Buyer 측 *evidence만으로 *판정 가능하지만·*A-06는 *Issuer 측의 *cooperation이 *필수다 (Issuer Registry의 *strongest evidence source 활용). *Issuer-Decipher integration이 *Decipher operational design의 *추가 *요소다*.

### 10.3 *Liability 분배*

Affiliate 판정 *오류 시:
- *False negative (affiliate를 *non-affiliate로 *판정): *Rule 144 제약 *우회·*§5 violation·*SEC enforcement risk + rescission right
- *False positive (non-affiliate를 *affiliate로 *판정): *정당한 *거래 차단·*operational friction

***두 *오류의 *legal weight는 *비대칭이다***. *False negative이 *훨씬 *심각하다 — *enforcement risk + criminal exposure (Wolfson 판례에서 *criminal conviction). *Decipher의 *default policy는 *boundary case에서 *PASS_AFFILIATE로 *처리 (제약을 *강하게 *적용)·*manual review escalate.

---

## §11. (δ) *Frontend · Off-chain Operator Layer*

### 11.1 *Frontend self-id flow*

```
[Frontend / Interface Layer]
1. Buyer가 *DEX 진입 + asset 선택
2. Self-identification UI:
   "이 asset의 *issuer와 *어떤 *관계입니까?"
   ☐ Officer / Director / General Partner
   ☐ 10%+ Shareholder
   ☐ 위 *affiliate의 *family member
   ☐ Entity (family LLC / trust) 통한 *indirect control
   ☐ 최근 *affiliate였으나 *현재 *사임/매도 완료 (decay 신청)
   ☐ 위 *어느 *관계도 *아님
3. 선택에 따른 evidence 수집 form 분기
```

### 11.2 *Off-chain Operator Layer — *주기적 *re-attestation*

90일 freshness cap을 *유지하려면 *Trusted Issuer는 *주기적 *re-attestation을 *수행해야 *한다*. *Operational design*:

- *Initial KYC + affiliate registry cross-check
- *90일 *주기 *re-confirmation (이메일·*chatbot 등을 *통한 *간소 *재확인)
- *Major change events (Issuer-side announcement: officer 사임·*13D filing 변경 등) 즉시 *trigger
- *Decay status가 *3개월 *경과하면 *자동 *NOT_AFFILIATE 전환

### 11.3 *Architecture 함의 — *Decipher Trust Operations team의 *Critical Role*

***A-06는 *Decipher Trust Operations team의 *capability 가장 *시험되는 *부품이다***. *legal reasoning (control·*family relationship·*indirect chain·*"power to direct" 판단)·*operational monitoring (decay·*event-triggered update)·*Issuer cooperation (Registry integration)이 *모두 *필요하다*. *Trusted Issuer 선정 시 *이 *역량을 *명시적으로 *evaluate해야 *한다*.

---

## §12. *Open Issues*

| # | 내용 | Priority |
|---|---|---|
| 1 | "Control" threshold의 *operational definition — *10% guideline의 *legal robustness | 🔴 immediate |
| 2 | Family relationship scope — *step-children·*foster·*spousal equivalent (Reg D 2020 amendment와 *parallel reasoning) | 🔴 immediate |
| 3 | Indirect chain max recursion depth (Decipher 권고 3·*legal practice cross-check) | 🟡 high |
| 4 | Decay period 90일의 *legal basis 명확화·*조문에 *명시 없음·*practice convention | 🔴 immediate |
| 5 | Multi-asset affiliate의 *claim 관리·*data structure spec | 🟡 high |
| 6 | Issuer Registry integration의 *legal contract framework (Trusted Issuer ↔ Issuer ↔ Decipher) | 🟡 high |

---

## §13. *파일명 규칙 (Naming Convention)*

```
파일명 규칙 (Decipher Element/Recipe 산출물):

Element: A-XX_부품이름.md  (예: A-06_affiliate.md)
Recipe:  R-XX_Recipe이름.md

Element 부품 ID 체계:
- A: 신원·자격 (매수인 측)
- B: 자산·기술 메타
- C: 거래 경로·시점
- D: 집계·누적
- E: 발행자 측
- F: 기타

본 부품: A-06 = "신원·자격 카테고리의 *6번째 부품"

물리적 위치: 산출물/elements/
```

---

## §14. *변경 로그*

- [2026-06-14] (canton-rwa) v2.1 patch. *citation 검증 정정 반영* (⚠️ 정정 노트로 *명시·*v1.0·v2.0의 *citation 정정 — *Rule 405 "Affiliate"·"Control" 정의는 *eCFR 원문 검증 *정확·*Rule 144(a)(1) "Affiliate"·*Rule 144(b)(1)(i) "3-month decay"의 *literal text·*Rule 144 5 제약의 *정확한 *subsection 명시 ((c) Current public information·(d) Holding period·(e) Volume limitation·(f) Manner of sale·(h) Form 144 filing)·*Decipher의 *90일 decay는 *조문 "*three months"의 *operational *encoding·*Wolfson citation은 *변호사 확인 대상으로 *명시 — *United States v. Wolfson (criminal·*405 F.2d 779 (2d Cir. 1968)·*Friendly J.)이 *foundational·*SEC v. Wolfson (civil)은 *별개 *proceeding일 *가능성. *§3.2 Rule 144 5 제약 *subsection 전면 재작성·*§3.3 Wolfson 항목 ⚠️ 주의 명시·*§8.1·*frontmatter related-external-sources 정확 *URL update·*eCFR 직접 인용으로 *전환).
- [2026-06-13] (canton-rwa) v2.0 작성. *Affiliate walkthrough — *공유 산출물 form. *self-contained·*규제 맥락 우선·*친절한 해설·*Internal ID 분리·*법령 조문 인용 form 적용. **§1 규제 맥락** (4 Pillar·*73년 doctrinal lineage: 1933 Securities Act §2(a)(11) → 1968 Wolfson → 1972 Rule 144 → 1982 Rule 405·*Decipher relevance·*Affiliate 식별의 *5 fundamental difficulty·*한국법 비교) + **§2 메타 정보** + **§3 ① 법적 근거** (Statutory: §2(a)(11)·§4(a)(1)·§5·*Regulatory: Rule 144(a)(1)·Rule 144 5 제약·Rule 405·*Interpretive: Wolfson·*Practice 10% guideline·*AffiliateBasis 9 enum·*DeterminationSource 7 enum) + **§4 ② 입력 사실** (4 question + 8 data field + 5-step flow + 4-Step Identification Chain + asset-dependent affiliate 특성) + **§5 ③ 판정 로직** (5 step pseudocode·*asset-specific check·*90일 freshness·*AffiliateBasis enum 분기·*decay 처리·*비결정성 framing) + **§6 ④ 거절·예외 처리** (PASS/FAIL codes + Decay 관리·*False negative vs False positive 비대칭) + **§7 ⑤ 테스트 케이스** (3 김 부장 시나리오: 현재 affiliate·*decay 진행 중·*decay 종료 후 + Indirect chain + NOT_AFFILIATE Pass·5 cases·*asset-dependent 특성 강조) + **§8 (α) 패턴 B + 운영형 결합·*Issuer Registry strongest evidence** + **§9 (β) Cross coordination·*Conflict resolution 3 case** + **§10 (γ) 3-Layer + Issuer cooperation 필수·*Liability 비대칭** + **§11 (δ) Frontend self-id·*주기적 re-attestation·*Trust Operations team critical role** + **§12 Open Issues 6건** + **§13 파일명 규칙**.
