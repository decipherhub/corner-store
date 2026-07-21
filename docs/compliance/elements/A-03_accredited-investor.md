---
type: element-walkthrough
element-id: A-03
element-name: Accredited Investor
parent-recipe: R1 (Reg D 506(c) Issuance)
status: v2.1 — 공유 산출물 form (citation 검증 정정 반영·자체완결·규제맥락 우선)
audience: 개발팀·법무팀·외부 consultant·변호사
created: 2026-06-13
updated: 2026-06-14
related-external-sources:
  - "15 USC § 77d (Securities Act § 4 exemptions): https://www.law.cornell.edu/uscode/text/15/77d"
  - "17 CFR § 230.501 — Definitions and terms used in Regulation D (현행 본문은 13 categories, (a)(1)~(a)(13)): https://www.ecfr.gov/current/title-17/section-230.501"
  - "17 CFR § 230.506(c) — General Solicitation 허용 safe harbor: https://www.ecfr.gov/current/title-17/section-230.506"
  - "17 CFR § 230.506(c)(2)(ii) — Reasonable Steps to Verify safe harbor methods (A)~(E) 5종: https://www.ecfr.gov/current/title-17/section-230.506"
  - "17 CFR § 270.3c-5 — Knowledgeable Employee (Rule 501(a)(11) cross-reference 출처): https://www.ecfr.gov/current/title-17/section-270.3c-5"
  - "17 CFR § 275.202(a)(11)(G)-1 — Family Office (Rule 501(a)(12) cross-reference 출처): https://www.ecfr.gov/current/title-17/section-275.202(a)(11)(G)-1"
  - "SEC Release 33-9415 (2013·506(c) general solicitation): https://www.sec.gov/rules/final/2013/33-9415.pdf"
  - "SEC Release 33-10884 (2020·Investor Definition Amendments): https://www.sec.gov/rules/final/2020/33-10884.pdf"
  - "SEC v. Ralston Purina Co., 346 U.S. 119 (1953): https://supreme.justia.com/cases/federal/us/346/119/"
tags: [element, A-03, accredited-investor, walkthrough, shared-deliverable, reg-d-506c]
---

# A-03 Accredited Investor — Element Walkthrough

> 본 문서는 *Decipher RWA DEX의 *공식 인수인계 문서*. *개발팀·*법무팀·*외부 consultant가 *읽고 *작업의 *base로 *활용*. *미국 증권법에 *익숙하지 않은 *팀원도 *순서대로 *읽으면 *이해 가능 *수준으로 *작성*.

> ⚠️ **출처 검증 정정 노트 (v2.1, 2026-06-14).**
> v1.0·v2.0 초안의 인용 오류를 eCFR 원문 (17 CFR 230.501·230.506)에 대조하여 정정했다. 읽는 사람은 아래를 정확한 것으로 보면 된다.
> 
> - **현행 Rule 501(a)는 *8 categories가 *아니라 *13 categories ((a)(1)~(a)(13))**다. v2.0에서 "8 + 2020 신설 3 (11·12·13)"으로 *분류한 것은 *legislative history 기반·*조문 자체는 *통합 13 categories.
> - **Knowledgeable Employee는 *Rule 501(a)(11)** (v2.0 (a)(12) 잘못). *조문 본문은 *Rule 3c-5(a)(4) cross-reference로 *KE 정의 *위임.
> - **Family Office는 *Rule 501(a)(12)** (v2.0 (a)(11) 잘못). *Rule 202(a)(11)(G)-1 cross-reference·*$5M+ AUM·*specific purpose 형성 X·*sophisticated direction.
> - **Family Client는 *Rule 501(a)(13)** — *(a)(12) Family Office가 *direct하는 *investment.
> - **Professional Credentials는 *Rule 501(a)(10)** (v2.0 (a)(11) 잘못). *조문 *literal text는 *"professional certifications or designations or credentials from an accredited educational institution that the Commission has designated". Series 7·65·82는 *Commission이 *현재 *posted한 *current designations·*조문 자체는 *broader.
> - **Entity-based AI는 *4 categories*** — *(a)(3) 일반 *organization·*corporation·*partnership·*LLC·*(a)(7) trust·*(a)(8) all-AI entity·***(a)(9) investments-based entity*** (Any entity not listed in (1)·(2)·(3)·(7)·(8)·*investments in excess of $5M·*Rule 2a51-1(b) reference). v2.0에는 *(a)(9) 누락.
> - **Spousal equivalent는 *별도 *category가 *아니다***. *§ 230.501(j)의 *정의이며·*(a)(5) net worth·*(a)(6) income의 *joint calculation에 *포함된다. v2.0에서 *(a)(13)을 *spousal equivalent로 *잘못 표기.
> - **Rule 506(c)(2)(ii) safe harbor methods는 *(A)~(E) 5 종**(v2.0의 *3 종 (i)·(ii)·(iii) 잘못): *(A) Income (IRS forms)·*(B) Net Worth (bank/brokerage statements + 부채 보고서·*"prior three months" 권고)·*(C) Third-party written confirmation (registered broker-dealer·*registered investment adviser·*licensed attorney·*CPA·*"prior three months")·*(D) Prior 506(b) AI continuing investor self-certification·*(E) Previously verified investor self-representation (*5 years from previous verification).
> - **Rule 501(a)(5) "exceeds $1,000,000"** — *literal로 *> exclusive이지만 *practice는 *대체로 *≥ inclusive 처리. *Decipher는 *practice 채택. *조문에는 *주거 부동산 자산 *제외 + 60일 lookback 부채 조정 + negative equity 차감 등 *상세 *valuation spec이 *Rule 501(a)(5)(i)(A)·(B)·(C)에 *있음.
> - **Rule 501(a)(6) "in excess of $200,000"** — *동일하게 *literal exclusive이나 *practice ≥ inclusive.

---

## §1. *규제 맥락 — *이 부품이 *왜 *필요한가*

### 1.1 *미국 증권법의 *큰 그림 — *4 Pillar*

미국 증권법은 *1929 Great Depression 이후 *investor protection을 *목적으로 *4 *주요 *법령 (Pillar)이 *제정되었다. *각 pillar는 *서로 다른 *영역을 *규율한다:

| Pillar | 시기 | 규제 대상 | 핵심 *관심사 |
|---|---|---|---|
| **Securities Act 1933** | 1933 | ***발행 (issuance)*** | ***공시·*fraud 방지·*1차 발행 시점*** |
| Securities Exchange Act 1934 | 1934 | *유통·*거래소·*broker-dealer | *지속 공시·*market structure·*거래 규율 |
| Investment Company Act 1940 (ICA) | 1940 | *집합투자기구 (fund) 자체 | *fund 구조의 *unique risk 방지·*self-dealing·*custody 규율 |
| Investment Advisers Act 1940 | 1940 | *자문업자 (advisers) | *advisers의 *fiduciary duty·*conflicts of interest |

***본 부품은 *Securities Act 1933 영역의 *규제를 *구현한다***. *구체적으로 *§4(a)(2) private placement exemption + Rule 506 (Reg D safe harbor) base*. *이는 *fund 규제 (ICA 1940)와는 *다른 *영역의 *규제이며·*Decipher 팀이 *흔히 *비교하는 *Qualified Purchaser (ICA §3(c)(7))와는 *다른 *standard·*다른 *법령 *영역에서 *온 *concept이다 — *§3.4에서 *상세 비교한다*.

### 1.2 *왜 *이 규제가 *존재하는가 — *Securities Act 1933의 *기본 *접근법*

1933년 *Securities Act는 *증권 *발행 시 ***SEC 등록 + 공시 의무***를 *기본 원칙으로 *제시했다*. *Issuer가 *증권을 *공중에게 *판매하려면 *상세한 *registration statement (사업·*재무·*risk factor 등)를 *SEC에 *제출·*공개해야 *한다*. *이 *registration 절차는 *수개월·*수백만 달러의 *비용을 *수반한다*.

그러나 *모든 *발행을 *registration 의무로 *부과하면 *startup·*small business·*hedge fund 등의 *자금 조달이 *비현실적으로 *어려워진다*. *그래서 *Securities Act는 *§3·§4에서 *등록 면제 path*를 *제공한다*. *대표적인 *2 path*:

| Exemption | 출처 | 핵심 |
|---|---|---|
| **§3(a)** | Securities Act §3 | *증권 type 자체에 *대한 면제 (예: 정부 채권·*은행 발행 채권·*특정 자선 단체 등) |
| **§4(a)(2)** | Securities Act §4 | ***private placement (공모가 *아닌 *발행) 면제*** |

§4(a)(2)가 *Decipher 본 부품의 *직접 *base다*. *그러나 *§4(a)(2)의 *조문 자체는 *"any transaction not involving any public offering"이라는 *짧은 *문구만 *제공한다*. *"public offering"의 *경계는 *Ralston Purina (1953 SCOTUS)의 *4-factor test로 *해석되었지만·*case-by-case judgment의 *불확실성이 *높았다*.

SEC는 *이 *불확실성을 *해소하기 *위해 ***Regulation D (Reg D)***라는 ***safe harbor***를 *제정했다 (1982년 *최초 제정·*이후 *여러 *차례 *개정). *Reg D는 *"이 *조건들을 *충족하면 *§4(a)(2)의 *private placement로 *간주한다"는 *bright-line rule을 *제공한다*.

Reg D의 *핵심 *조항이 *Rule 506이며·*그 안에 *두 *sub-rule이 있다*:

| Rule | General Solicitation 허용? | Investor 자격 |
|---|---|---|
| **Rule 506(b)** | 금지 | ***최대 35명의 *non-accredited investor***까지 허용 (단·*sophistication test 필요·*disclosure 의무) + 무제한의 *accredited investor |
| **Rule 506(c)** (2013 JOBS Act 신설) | ***허용*** | ***모든 *purchaser가 *Accredited Investor***여야 함·*Issuer가 *"reasonable steps to verify" 의무 부담 |

***본 부품은 *Rule 506(c)의 *Accredited Investor 자격을 *판정한다***. *2013 JOBS Act 이후 *general solicitation이 *허용되면서 *RWA tokenization·*blockchain-based fundraising 등의 *현대적 *사용 case가 *급증했고·*Rule 506(c)가 *그 *primary path가 되었다*.

### 1.3 *Decipher에서 *왜 *이 부품이 *중요한가*

Decipher가 *지원하는 *RWA tokenization은 *대체로 *2 *path를 *거친다*:

**Path 1 — *§3(c)(7) ICA fund (예: BlackRock BUIDL)***: *Qualified Purchaser only·*ICA 1940 영역·*A-13 부품 (Qualified Purchaser)이 *primary check.

**Path 2 — *Reg D 506(c) issuance·*resale 토큰***: *Accredited Investor only·*Securities Act 1933 영역·*본 A-03 부품이 *primary check.

많은 *RWA token (Ondo·*Securitize 발행 일부 token·*tokenized debt·*tokenized equity 등)이 *Path 2를 *사용한다*. *Decipher DEX가 *이런 *token의 *secondary trading을 *지원하려면 *pre-trade gate에서 *모든 *prospective buyer의 *Accredited Investor 자격을 *확인해야 *Reg D 506(c)의 *post-issuance compliance가 *유지된다*.

***본 부품이 *오작동하면***: *non-AI buyer의 *매수가 *허용되어 *Reg D 506(c) safe harbor가 *상실될 *수 있다*. *그러면 *issuer가 *§4(a)(2) base 자체에 *의존해야 *하는데·*Ralston Purina 4-factor의 *case-by-case 불확실성이 *enforcement risk를 *높인다*. *SEC enforcement action·*rescission right (investor가 *invested capital 회수 요청 가능)·*civil penalty 등이 *발생할 수 *있다*.

또한 *본 부품은 *Recipe R1 (Reg D 506(c) Issuance)의 *primary check다·*그러나 *§3(c)(7) fund의 *secondary trading 맥락에서도 *cumulative 발동될 *수 있다 (예: BUIDL이 *§3(c)(7) + Reg D 506(c) dual structure·*A-13와 *A-03 둘 다 *check 필요)*.

### 1.4 *한국 자본시장법과의 *비교*

한국 *자본시장법은 *공모와 *사모를 *50명 기준 또는 *전문투자자 기준으로 *구분한다*. *미국 *Rule 506(c)의 *Accredited Investor와 *한국의 *전문투자자는 *둘 다 *"sophisticated investor에 *대해서는 *protection을 *완화하자"는 *legislative 철학을 *공유하지만·*기준이 *다르다*:

| 측면 | 한국 자본시장법 *적격투자자/*전문투자자 | 미국 Reg D Accredited Investor |
|---|---|---|
| 출처 *법령 | 자본시장법 §9 + 시행령 | Securities Act 1933 + 17 CFR § 230.501(a) |
| 자연인 기준 | (전문투자자 전환) 금융투자상품 잔고·*경력·*소득 조건 | net worth $1M+ (주거 제외) OR income $200K (개인) / $300K (joint) |
| 법인 기준 | 정의된 *전문 기관 + 일정 자산 충족 *법인 | $5M+ assets (entity) OR 8 categories of *qualified entities |
| 전문 *credential 기반 | 일부 (투자상담사 등) | 2020 modernization으로 *Series 7·*65·*82 holders 추가 |

***두 *jurisdiction의 *concept mapping은 *Decipher cross-border 운영에 *필수다***. *한국 *법무팀·*개발팀이 *Reg D AI 개념을 *한국 전문투자자와 *비교하여 *이해할 수 있도록 *cross-reference를 *유지해야 *한다*.

---

## §2. 📋 *메타 정보*

| 항목 | 값 |
|---|---|
| 부품 이름 | Accredited Investor |
| 검사 대상 | Reg D 506(c) issuance·resale 매수 자격 |
| Internal ID (Decipher PM 규약) | A-03 |
| 검증 방식 | 증명서 확인형 (off-chain due diligence + on-chain claim 검증) |
| 활성화 시점 (Timing) | pre-trade |
| 상태 (Stateful) | STATELESS (snapshot 판정) |
| 주 활성화 *Recipe | R1 (Reg D 506(c) Issuance) |
| Cumulative *Recipe | R2 (§4(a)(7) Resale)·*R3 (ICA §3(c)(7) dual structure 시) |
| Cascade Element | A-09 (Look-Through for entity AI)·*A-08 (Affiliate)·*A-11 (Claim Freshness) |
| 파일명 | A-03_accredited-investor.md |
| 위치 | 산출물/elements/ |

---

## §3. ① *법적 근거*

### 3.1 *Statutory base*

> **§ 4(a)(2) — *Private Placement Exemption** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/77d)]
> 
> **Original**:
> "The provisions of section 5 [registration requirements] shall not apply to ... transactions by an issuer *not involving any public offering*."
> 
> **한글 해석**:
> 등록 요건 (§5)은 *issuer의 ***public offering이 *아닌 *거래***에는 *적용되지 *않는다.

이 조문이 *Reg D 전체의 *statutory base다*. *Reg D Rule 506(b)·(c)는 *§4(a)(2)의 *"public offering이 *아닌 *거래"를 *Bright-line rule로 *spec한 *safe harbor다*.

### 3.2 *Regulatory specification — *Rule 506·*Rule 501*

> **17 CFR § 230.506(c) — *Reg D 506(c) Safe Harbor (general solicitation 허용)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.506)]
> 
> **Original** (요약):
> "Offers and sales of securities ... shall be deemed to be transactions not involving any public offering ... provided that:
>   (1) All purchasers of securities sold ... are *accredited investors*;
>   (2) The issuer shall *take reasonable steps to verify* that purchasers of securities ... are accredited investors;
>   (3) [Form D filing and other procedural requirements] ..."
> 
> **한글 해석**:
> ...다음 *조건을 *충족하면 *증권 *판매·*offering은 *public offering이 *아닌 *거래로 *간주된다 — 
>   (1) ***모든 *purchaser가 *Accredited Investor 자격*** 보유·
>   (2) Issuer가 *purchaser의 *AI 자격을 ***reasonable steps to verify*** 의무 이행·
>   (3) Form D 제출 등 *절차적 요건 충족.

> **17 CFR § 230.501(a) — *Accredited Investor 정의 (현행 13 categories)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.501)]
> 
> **Original** (요지·*(a)(1)~(a)(13)):
> "Accredited investor" shall mean any person who comes within any of the following categories, or who *the issuer reasonably believes* comes within any of the following categories, at the time of the sale of the securities to that person:
>   (1) Banks·*savings and loan associations·*broker-dealers (Securities Exchange Act §15)·*investment advisers (registered or relying on §203(l)/(m))·*insurance companies·*registered investment companies·*business development companies·*Small Business Investment Companies·*Rural Business Investment Companies·*state·*federal employee benefit plans (>$5M)·*plan fiduciary가 *bank·*S&L·*insurance·*registered IA가 *decision하는 *ERISA plans 등 *기관형 AI;
>   (2) Private business development company (Advisers Act §202(a)(22));
>   (3) IRC §501(c)(3) organizations·*corporations·*Massachusetts business trusts·*partnerships·*LLCs·*not formed for the specific purpose·*assets in excess of $5,000,000;
>   (4) Director·*executive officer·*general partner of the issuer (or of a general partner of the issuer);
>   (5) Natural person whose *individual net worth*, or *joint net worth with that person's spouse or spousal equivalent*, *exceeds $1,000,000* — *primary residence는 *asset에서 *제외·*거주지에 *연결된 *부채 처리 spec은 *(a)(5)(i)(A)·(B)·(C)에 *상세;
>   (6) Natural person who had *individual income in excess of $200,000* in each of the two most recent years OR *joint income with spouse or spousal equivalent in excess of $300,000* + *reasonable expectation* of reaching the same income level in the current year;
>   (7) Trust·*$5M+ assets·*not formed for the specific purpose·*purchase directed by *sophisticated person (§ 230.506(b)(2)(ii));
>   (8) Entity in which *all of the equity owners are accredited investors* (look-through to natural persons 가능 — Note 1);
>   (9) **Any entity, of a type not listed in (1)·(2)·(3)·(7)·(8)·*not formed for the specific purpose·*owning *investments in excess of $5,000,000***. (Note: "investments" = Rule 2a51-1(b) under Investment Company Act of 1940 reference.)
>   (10) **Natural person holding in good standing one or more *professional certifications or designations or credentials from an accredited educational institution that the Commission has designated***. (현행 Commission 지정 list에는 *Series 7·*65·*82가 *posted.)
>   (11) **Natural person who is a "knowledgeable employee," as defined in Rule 3c-5(a)(4) under the Investment Company Act of 1940**, of the issuer of the securities being offered or sold where the issuer would be an investment company *but for §3(c)(1) or §3(c)(7) exclusion*.
>   (12) **"Family office," as defined in Rule 202(a)(11)(G)-1 under the Investment Advisers Act of 1940**·*assets under management in excess of $5,000,000·*not formed for the specific purpose·*sophisticated direction.
>   (13) **"Family client," as defined in Rule 202(a)(11)(G)-1**·*of a family office meeting (a)(12) requirements·*prospective investment directed by such family office.
> 
> **한글 해석**: 
> Accredited Investor란 *13 categories 중 *하나에 *해당하는 *자 — 또는 *issuer가 *reasonably believes 하는 *자 (sale 시점 기준):
>   (1) 기관형 AI (은행·*S&L·*broker-dealer·*IA·*보험·*investment company·*BDC·*SBIC·*state/federal employee plans 등)
>   (2) Private business development company
>   (3) ***$5M+ assets의 *501(c)(3)·*corporation·*business trust·*partnership·*LLC*** (specific purpose 형성 X)
>   (4) Issuer (또는 그 GP)의 *director·*executive officer·*general partner
>   (5) ***net worth $1M+*** (주거 부동산 제외·*joint net worth 가능 — *§ 230.501(j) spousal equivalent 포함)
>   (6) ***개인 income $200K+ 최근 2년 OR joint income $300K+*** + 당해 *reasonable expectation
>   (7) ***$5M+ assets의 *trust*** (specific purpose 형성 X·*sophisticated person 지휘)
>   (8) 모든 *equity owner가 *AI인 *entity (자연인까지 *look-through 허용)
>   (9) ***(1)·(2)·(3)·(7)·(8)에 *해당하지 *않는 *모든 *entity·*specific purpose 형성 X·*$5M+ *investments (Rule 2a51-1(b) reference)*** ← Decipher A-13와 *parallel 개념
>   (10) ***Commission이 *지정한 *professional credentials 보유 자연인*** (현행 Series 7·65·82 posted)
>   (11) ***§3(c)(1)·§3(c)(7) fund의 *Knowledgeable Employee (Rule 3c-5(a)(4) cross-reference)***
>   (12) ***Family Office (Rule 202(a)(11)(G)-1·*$5M+ AUM)***
>   (13) ***Family Client (위 (12) Family Office의 *direct)***

해설: (a)(1)·(2)는 *기관형 (각종 *registered entity)·*(a)(3)·(7)·(8)·(9)는 *entity-based ($5M+ assets·*trust·*all-AI entity·*investments-based)·*(a)(4)·(10)는 *position·*credential 기반·*(a)(5)·(6)는 *natural person *재정 기반·*(a)(11)·(12)·(13)는 *2020 modernization으로 *추가된 *KE·*family office·*family client 경로다. **§ 230.501(j) *spousal equivalent**는 *별도 category가 *아니라 *§ 230.501(j)의 *정의로·*(a)(5) joint net worth·*(a)(6) joint income 계산에서 *spouse와 *동등 처리된다 ("cohabitant occupying a relationship generally equivalent to that of a spouse").

> **17 CFR § 230.506(c)(2)(ii) — *Reasonable Steps to Verify Safe Harbor Methods (5 종)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.506)]
> 
> **Original** (요지·*natural person purchaser 한정·*non-exclusive·*non-mandatory):
> "The issuer shall be deemed to take reasonable steps to verify if the issuer uses, at its option, *one of the following* non-exclusive and non-mandatory methods ...:
>   (A) *Income*-based: reviewing any IRS form that reports the purchaser's income for the *two most recent years* (W-2·1099·Schedule K-1 to Form 1065·Form 1040 등) + obtaining a *written representation* of reasonable expectation for current year;
>   (B) *Net Worth*-based: reviewing one or more types of documentation *dated within the prior three months* + obtaining a *written representation* that all liabilities for net worth determination have been disclosed.
>     (*1*) Assets: bank statements·*brokerage statements·*securities holdings statements·*CDs·*tax assessments·*independent third-party appraisal reports;
>     (*2*) Liabilities: consumer report from at least one nationwide consumer reporting agency.
>   (C) *Third-party written confirmation* from one of the following persons or entities (also *prior three months*):
>     (*1*) Registered broker-dealer;
>     (*2*) SEC-registered investment adviser;
>     (*3*) Licensed attorney in good standing;
>     (*4*) Certified public accountant duly registered and in good standing.
>   (D) For *pre-September 23, 2013 Rule 506(b) AI* continuing to hold same issuer's securities·*Rule 506(c) offering 진입 시·*self-certification at the time of sale.
>   (E) For *previously verified investor*·*so long as the issuer is not aware of contrary information·*written representation at the time of sale·*satisfies for *5 years from previous verification date.
> 
> **한글 해석**:
> Issuer가 *natural person purchaser의 *AI 자격을 *"reasonable steps to verify"한 *것으로 *간주되는 *5 *non-exclusive methods (issuer가 *자기 *재량으로 *그 중 *하나 *사용):
>   (A) ***Income path***: 최근 2년의 *IRS form (W-2·1099·K-1·1040) 검토 + 당해 reasonable expectation 서면 진술
>   (B) ***Net Worth path***: ***prior three months 이내*** 자료 + 부채 *서면 진술
>      ━ 자산: bank/brokerage statements·*CDs·*tax assessments·*independent third-party 감정서
>      ━ 부채: nationwide consumer reporting agency (Equifax·*Experian·*TransUnion 등)의 *consumer report
>   (C) ***Third-party written confirmation*** (prior three months): ***등록 *broker-dealer·*SEC-등록 IA·*변호사·*공인회계사*** 중 *하나
>   (D) ***Pre-2013-09-23 Rule 506(b) AI***가 *동일 issuer 506(c) 진입 시 *self-certification
>   (E) ***이전 *verified investor***의 *self-representation·*5 years grace period

해설: *(C) Third-party verification path가 *Decipher의 *Trusted Issuer model에 *direct fit이다 — *Trusted Issuer가 *registered broker-dealer·*SEC-registered investment adviser·*licensed attorney·*CPA 자격을 *보유한 *기관이면 *Rule 506(c)(2)(ii)(C)의 *safe harbor가 *직접 적용된다*. *(B)·(C)의 *"prior three months" 요건이 *결정적이다 — *Rule 506(c) compliance가 *requires *fresh verification·*Decipher의 *1년 freshness cap과 *gap이 *있다 (§5.3 *§12 Open Issue 참조).

### 3.3 *Interpretive guidance*

#### *SEC Release 33-9415 (2013 JOBS Act 506(c) Adopting Release)*

> [🔗 [SEC.gov](https://www.sec.gov/rules/final/2013/33-9415.pdf)]

Rule 506(c)를 *처음 *신설한 *2013 *adopting release. *general solicitation 허용의 *legislative intent·*"reasonable steps to verify"의 *flexibility·*Issuer의 *책임 범위가 *명시되었다*. *Decipher의 *Trusted Issuer model의 *legal foundation이다*.

#### *SEC Release 33-10884 (2020 Investor Definition Amendments)*

> [🔗 [SEC.gov](https://www.sec.gov/rules/final/2020/33-10884.pdf)]

Rule 501(a)에 *3 categories 추가 — *(11) Professional credentials (Series 7·65·82)·*(12) Knowledgeable Employees·*(13) Spousal equivalents. *AI 정의의 *modernization으로·*전통적 *재정 기준 외의 *sophistication path를 *명시했다*. *Decipher의 *KE claim path 처리·*credential-based AI claim의 *base다*.

#### *SEC v. Ralston Purina Co.* — *§4(a)(2) base*

> Citation: 346 U.S. 119 (1953) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/346/119/)]

Reg D의 *legal foundation인 *§4(a)(2)의 *"public offering" 정의를 *처음 *명시한 *foundational case*. *4-factor test (number of offerees·*sophistication·*access to information·*purchaser characteristics)가 *오늘날 *Reg D의 *enforcement boundary를 *결정한다*.

### 3.4 *Sub-요건 분해 매트릭스 + A-13와의 *결정적 차이*

| 판정 path | 충족 조건 | A-13 (QP)와의 *차이 |
|---|---|---|
| (5) Natural Person *Net Worth | (자연인) AND (net worth ≥ $1M·*주거 제외) | A-13: *investments ≥ $5M (별개 standard) |
| (6) Natural Person *Income | (자연인) AND (income ≥ $200K 개인 / $300K joint·*최근 2년) | A-13에 *없음 |
| (1)~(4)·(7) Entity-based | 정의된 *전문 기관·*$5M+ 자산 entity·*$5M+ 자산 trust 등 | A-13: *별도 *Family Company·*Trust path·*$25M Other Entity |
| (8) All-AI Entity | 모든 *equity owner가 *AI | A-13: *Family Company의 *family relationship 요건 (AI는 *no family requirement) |
| (11) Professional Credentials | Series 7·65·82 holders (2020 신설) | A-13에 *parallel 없음 (entirely different sophistication path) |
| (12) Knowledgeable Employee | Private fund 직원 | A-13 (Rule 2a51-3)와 *parallel concept·*그러나 *legal text·*coverage가 *다름 |

***A-03 (AI)와 *A-13 (QP)의 *결정적 *3 차이***:

1. ***Standard 차이***: A-03는 *net worth ($1M·*주거 제외) OR *income standard·*A-13는 *investments standard ($5M)
2. ***Threshold 차이***: A-03 자연인 *$1M·*A-13 자연인 *$5M (5배 차이)
3. ***Asset 정의 차이***: A-03 net worth는 *모든 *자산-부채·*A-13 investments는 *투자성 자산만 (사업체·*personal residence 제외)

***구체 *비교 예시***: $2M house + $1.5M mortgage + 주식·채권 $1.5M인 *개인:
- *A-03 net worth: *($2M + $1.5M) - $1.5M - 주거 *제외 = $1.5M (주식·채권만) → **AI ✅** ($1M 초과)
- *A-03 다른 방식: *$2M house - 주거 제외 + $1.5M - $1.5M mortgage [그러나 mortgage가 *주거에 *연결이면 *제외 부분과 동일하게 처리] + $1.5M 주식 → *$1.5M → **AI ✅**
- *A-13 investments: *house 제외·*주식·채권 *$1.5M → **NOT QP ❌** ($5M 미달)

***즉·*같은 사람이 *A-03 통과·*A-13 미통과인 *case가 *흔하다***. *두 부품이 *독립적으로 *평가되어야 *하는 *이유다*.

---

## §4. ② *입력 사실 — *판정에 *필요한 *데이터*

### 4.1 *어떤 *증거가 *필요한가*

본 부품 판정에 *필요한 *증거는 *Rule 501(a)의 *어느 *category로 *AI qualifying하는지에 *따라 *다르다*. *대표적 *3 경로*:

- **Income path (501(a)(6))**: 최근 2년의 *세무 자료 (IRS form W-2·*1040·*K-1 등)
- **Net worth path (501(a)(5))**: 자산 증빙 (brokerage statement·*real estate appraisal 등) + 부채 증빙 (mortgage statement 등) + 주거 부동산 *제외 처리
- **Professional credentials path (501(a)(11))**: FINRA 자격증 *번호 + 유효성 검증
- **Entity path (501(a)(3)·(7)·(8))**: entity registration·*총 자산 증빙·*all-AI owner 증빙

### 4.2 *Data field — *DEX가 *check하는 *항목*

| 필드 이름 | 데이터 *유형 | 출처 | 무엇을 *말해주는가 |
|---|---|---|---|
| `claim.basis` | enum | Trusted Issuer claim | 어느 *AI category인지 (AI_NATURAL_NET_WORTH·AI_NATURAL_INCOME·AI_NATURAL_CREDENTIALS·AI_ENTITY_5M·AI_ALL_AI_ENTITY·AI_TRUST_5M·AI_KNOWLEDGEABLE_EMPLOYEE 등) |
| `claim.verifiedAt` | timestamp | Trusted Issuer claim | 발급 시점 (freshness 확인용·*Rule 506(c)는 *권고 90일·*Decipher 1년 *cap) |
| `claim.issuer` | address | Trusted Issuer claim | 발급 기관 (Trusted Issuer Registry 등록 verification) |
| `claim.signature` | bytes | Trusted Issuer claim | 위변조 *방지 |
| `claim.netWorth` 또는 `claim.income` (optional) | uint256 | Trusted Issuer claim | threshold 검증 (Trusted Issuer 측 *사전 *판정·*DEX는 *≥ threshold 여부만 *신뢰) |
| `claim.credentialNumber` (optional·credentials path) | string | Trusted Issuer claim | Series 7·65·82 *FINRA 자격증 번호 |
| `block.timestamp` | timestamp | blockchain | 거래 *확정 *시점 |

### 4.3 *수집 path — *5 step flow*

```
Step 1: Frontend self-identification
  ↓ Buyer가 *DEX 진입 + KYC 시작
  ↓ Buyer가 *AI 자격 *경로 *선택:
    ☐ Net Worth path ($1M·*주거 제외)
    ☐ Income path ($200K/$300K)
    ☐ Professional Credentials path (Series 7/65/82)
    ☐ Entity path
    ☐ Knowledgeable Employee path

Step 2: Evidence submission
  ↓ 선택한 *path에 *따른 *evidence 제출

Step 3: Off-chain verification (Trusted Issuer)
  ↓ Rule 506(c)(2) "reasonable steps to verify" 적용
  ↓ method (i) Income·(ii) Net Worth·(iii) Third-party 중 *선택
  ↓ 또는 *FINRA registry·*KE evidence 검증

Step 4: On-chain claim publication
  ↓ Trusted Issuer가 *signed claim publication

Step 5: DEX pre-trade check
  ↓ DEX가 *claim 조회·*본 부품 (A-03) 판정 실행
  ↓ PASS 또는 FAIL code 반환
```

### 4.4 *Category별 evidence 예시*

| Category | 필요 evidence |
|---|---|
| AI_NATURAL_NET_WORTH | bank/brokerage statement + property appraisal + mortgage statement + 주거 부동산 분리 |
| AI_NATURAL_INCOME | IRS form W-2·1040·K-1 (최근 2년) + 당해 *expectation 자료 |
| AI_NATURAL_CREDENTIALS | FINRA registry lookup (Series 7/65/82 자격증 유효 확인) |
| AI_ENTITY_5M | entity registration·*감사 보고서·*총 자산 증빙 |
| AI_ALL_AI_ENTITY | 모든 owner의 *AI claim *cross-reference (A-09 cascade) |
| AI_TRUST_5M | trust deed + trust 자산 증빙 + sophisticated person 지휘 증빙 |
| AI_KNOWLEDGEABLE_EMPLOYEE | 고용 계약서·*role description·*tenure (12개월+) + 회사가 *private fund 검증 |

---

## §5. ③ *판정 로직 — *어떻게 *PASS/FAIL이 *결정되는가*

### 5.1 *전체 흐름*

본 부품의 *check 순서:

1. claim 존재 확인
2. signature·issuer 신뢰 확인
3. claim freshness 확인 (Decipher 권고 1년·*Reg D 506(c)는 *대체로 90일 권고하나·*Decipher는 *operational 측면에서 *1년 cap)
4. category 분기 → category별 추가 조건 확인
5. 결과 반환 (PASS 또는 FAIL code)

### 5.2 *Pseudocode + step별 해설*

```
function check_A_03(prospective_buyer, asset, block):
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Step 1: claim 조회
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    claim = ONCHAINID.getClaim(prospective_buyer, Topic.AI)
    
    if claim == null:
        return FAIL_NOT_AI
```

***Step 1 해설***: *Buyer의 *blockchain address에 *연결된 *AI claim을 *조회한다*. *claim이 *없으면 *FAIL_NOT_AI가 *반환되며·*Buyer는 *Frontend에서 *KYC 시작 *redirect를 *받는다*.

```
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Step 2: signature·issuer trust 확인
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if not Cryptography.verify(claim.signature, claim.issuer):
        return FAIL_NOT_AI   # 위조 claim
    if not TrustedIssuerRegistry.contains(claim.issuer):
        return FAIL_UNTRUSTED_AI_CLAIM_ISSUER
```

***Step 2 해설***: *claim의 *서명을 *검증·*발급기관이 *Decipher 신뢰 *Registry에 *등록되었는지 *확인한다*. *Rule 506(c)(2)(iii) third-party verification safe harbor가 *적용되려면 *발급기관이 *registered broker-dealer·*investment adviser·*변호사·*공인회계사 자격을 *보유해야 *한다 — *이 *자격이 *Registry 등록 조건이다*.

```
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Step 3: claim freshness
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    freshness_cap = 1 year   # Decipher 권고
    if claim.verifiedAt < block.timestamp - freshness_cap:
        return FAIL_AI_CLAIM_EXPIRED
```

***Step 3 해설***: *Rule 506(c) compliance는 *대체로 *issuer가 *각 매수 시점에 *fresh verification을 *요구한다 (90일·*최근 *공시 기간 등). *그러나 *secondary market·*DEX에서는 *각 거래마다 *full 재발급은 *operational cost가 *너무 *높다*. *Decipher는 *claim freshness cap을 *1년으로 *권고한다 (Rule 506(c) practice의 *대체로 *수용 가능한 *상한). *만료 시 *FAIL_AI_CLAIM_EXPIRED 반환*.

```
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Step 4: basis enum 분기
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if claim.basis IN {AI_NATURAL_NET_WORTH, AI_NATURAL_INCOME, 
                       AI_NATURAL_CREDENTIALS}:
        # threshold·*credentials는 *Trusted Issuer 사전 검증
        return PASS
    
    elif claim.basis == AI_ENTITY_5M:
        # entity 자산·*"specific purpose" 검증은 *Trusted Issuer 측
        return PASS
    
    elif claim.basis == AI_ALL_AI_ENTITY:
        # Cascade: A-09 (Look-Through) — 모든 owner가 AI여야
        if not check_A_09(claim.lookThroughChain):
            if A09.in_progress:
                return FAIL_AI_LOOKTHROUGH_NOT_COMPLETED
            else:
                return FAIL_ENTITY_OWNERS_NOT_ALL_AI
        return PASS
    
    elif claim.basis == AI_TRUST_5M:
        # trust 자산·*sophisticated person·*"specific purpose" 검증
        if not check_trust_ai(claim):
            return FAIL_TRUST_NOT_AI
        return PASS
    
    elif claim.basis == AI_KNOWLEDGEABLE_EMPLOYEE:
        # coveredCompany 일치 확인
        if claim.coveredCompany != asset.fund_identifier:
            return FAIL_AI_KE_NOT_QUALIFIED
        return PASS
    
    else:
        return REVIEW_AI_UNCERTAIN
```

***Step 4 해설***:

- **AI_NATURAL_NET_WORTH·*INCOME·*CREDENTIALS**: $1M·$200K 등 *threshold는 *Trusted Issuer가 *Rule 506(c)(2) safe harbor methods를 *적용하여 *사전 *판정한다*. *DEX는 *claim의 *basis가 *맞다는 *사실만 *신뢰. → PASS.
- **AI_ENTITY_5M (Rule 501(a)(3)·(7))**: $5M+ 자산·*"not formed for the specific purpose" 검증은 *Trusted Issuer 측에서 *수행. → PASS.
- **AI_ALL_AI_ENTITY (Rule 501(a)(8))**: 모든 *equity owner가 *AI여야 *entity가 *AI qualify된다*. *A-09 (Look-Through) cascade가 *발동되고·*각 owner의 *AI claim이 *cross-reference된다*. *일부 owner가 *AI 미충족이면 *전체 entity FAIL.
- **AI_TRUST_5M (Rule 501(a)(7))**: $5M+ 자산·*"sophisticated person이 *purchase 지휘"·*"not formed for the specific purpose" 등 *복합 조건 검증.
- **AI_KNOWLEDGEABLE_EMPLOYEE (Rule 501(a)(12))**: 2020 신설. *KE는 *해당 *fund의 *AI로 *deemed. *coveredCompany가 *asset의 *fund identifier와 *일치해야 *함.

### 5.3 *Threshold 매트릭스*

| 항목 | 값 | 근거 *조문 |
|---|---|---|
| Natural Person *Net Worth | ***≥ $1M (inclusive·*주거 제외)*** | Rule 501(a)(5) "exceeds $1,000,000" — *exceeds는 *> (exclusive)이나·*practice는 *≥ inclusive |
| Natural Person *Income | ***≥ $200K (개인·*2년·*당해 expectation) OR ≥ $300K (joint)*** | Rule 501(a)(6) "in excess of $200,000" |
| Entity *Assets | ***≥ $5M*** | Rule 501(a)(3)·(7) "in excess of $5,000,000" |
| Claim freshness cap | ***1년*** (Decipher 권고) | Rule 506(c) practice + Decipher 운영 결정 |
| Professional Credentials | Series 7·*65·*82 *유효 (FINRA 등록·*good standing) | Rule 501(a)(11) (2020 신설) |
| Knowledgeable Employee tenure | ≥ 12개월·*active investment activities 참여 | Rule 501(a)(12) (2020·*ICA Rule 2a51-3과 *parallel) |

### 5.4 *조문 *"exceeds" vs "not less than" 해석 — *주의*

조문이 *"exceeds $1,000,000"으로 *명시된 *경우·*literal interpretation은 *> exclusive ($1M 정확이면 *AI 아님). *그러나 *practice에서는 *대체로 *≥ inclusive로 *처리된다 (operational mismatch 회피 차원)*. *Decipher는 *practice convention을 *따라 *≥ inclusive로 *처리한다 — *§7.3 boundary test case에서 *명시 확인.

### 5.5 *Time-of-acquisition*

본 부품도 *time-of-acquisition snapshot이 *필요하다*. *Decipher는 *block confirmation timestamp 기준으로 *acquisition 시점을 *결정한다 (A-13 §5.4와 *동일 spec).

### 5.6 *비결정성 → 결정성 framing*

A-03도 *Rule 501(a)의 *여러 *부분이 *judgment를 *요구한다 — *예: *"sophisticated person" (trust path)·*"not formed for the specific purpose" (entity·trust path)·*"reasonable expectation" (income path)*. *이런 *judgment는 *온체인 코드가 *재현 *불가능하다*. *Trusted Issuer가 *off-chain에서 *Rule 506(c)(2) safe harbor methods를 *적용하여 *legal judgment를 *수행하고·*그 *결과를 *서명된 *claim 형식으로 *encode한다*.

***본 부품의 *implementation 본질도 *비결정성을 *결정성으로 *encapsulate하는 *pattern이다*** (A-13과 *동일).

---

## §6. ④ *거절·예외 처리*

### 6.1 *Failure codes 9종*

| Code | 언제 trigger되나 | 무엇이 *문제인가 | Buyer는 *무엇을 *해야 *하나 |
|---|---|---|---|
| `FAIL_NOT_AI` | claim 미존재·*basis enum mismatch·*signature 위조 | AI claim이 *없거나·*위조 | Trusted Issuer에 *KYC 시작 |
| `FAIL_AI_CLAIM_EXPIRED` | claim freshness cap (1년) 초과 | claim 만료 | Trusted Issuer에 *renewal 요청 |
| `FAIL_UNTRUSTED_AI_CLAIM_ISSUER` | issuer ∉ Registry | 발급기관이 *Registry 없음 | 다른 *Trusted Issuer 사용 |
| `FAIL_AI_LOOKTHROUGH_REQUIRED` | AI_ALL_AI_ENTITY·*look-through 정보 *부재 | entity인데 *owner *정보 *부족 | owner 정보 *보강 |
| `FAIL_AI_LOOKTHROUGH_NOT_COMPLETED` | look-through 진행 중 | 일부 owner KYC 진행 중 | 기다림 또는 *재촉 |
| `FAIL_ENTITY_OWNERS_NOT_ALL_AI` | 일부 owner가 *AI 미충족 | Rule 501(a)(8) 조건 위배 | entity 구조 *재검토 |
| `FAIL_TRUST_NOT_AI` | trust path 조건 미충족 (자산·*sophisticated person·*specific purpose) | Rule 501(a)(7) 조건 위배 | trust 자격 *재검토 |
| `FAIL_AI_KE_NOT_QUALIFIED` | KE coveredCompany mismatch·*tenure 미충족 | KE 자격 *불일치 | 다른 path 시도·*HR evidence 보강 |
| `REVIEW_AI_UNCERTAIN` | system *판정 불가 | 복잡 case | manual review 대기 |

### 6.2 *Manual Review Path*

A-13 §6.3과 *동일 pattern. *Decipher Trust Operations team에서 *24~72시간 *이내 *처리·*audit trail 기록.

### 6.3 *Error message 분리*

A-13 §6.4와 *동일 — Buyer-facing은 *generic + actionable·*Internal log는 *상세 reason.

---

## §7. ⑤ *테스트 케이스*

### 7.1 *Test 1 — *Pass (Net Worth path)*

***시나리오***: 미국 거주 *55세 *자연인. *자산: 주거 부동산 *$2.5M (mortgage $1M)·*brokerage account $1.5M·*bank account $200K. *부채: *주거 mortgage $1M (이미 자산에서 분리·*Rule 501(a)(5)(i) 주거 제외 적용).

***Net Worth 계산***:
- 자산: $2.5M (주거·*제외) + $1.5M + $0.2M = $1.7M (주거 제외 후)
- 부채: $0 (주거 mortgage는 *주거와 함께 *제외 처리·*기타 부채 *없음)
- ***Net worth: $1.7M*** > $1M → AI qualifying

***Trace***:
- Step 1: claim 발견 (AI_NATURAL_NET_WORTH)
- Step 2: signature·issuer trust ✅
- Step 3: freshness 1.5 month < 1 year ✅
- Step 4: basis = AI_NATURAL_NET_WORTH → PASS

***해설***: *Rule 501(a)(5)의 *주거 *제외 처리가 *결정적 *역할이다*. *2010 Dodd-Frank 이후 *주거 부동산은 *AI net worth 계산에서 *제외된다 (subprime crisis 이후 *부동산 *과대평가 *우려 차원). *Trusted Issuer는 *주거 부분을 *명확히 *분리하여 *valuation을 *수행한다*.

### 7.2 *Test 2 — *Fail (Net Worth path)*

***시나리오***: 미국 거주 *자연인. *자산: 주거 부동산 *$1.5M·*brokerage account $800K. *부채: *주거 mortgage $500K. *Income: $150K/년 (AI threshold 미달).

***Net Worth***: $800K (주거 제외 후) < $1M → AI 미충족

***Income***: $150K < $200K → AI 미충족

***예상 결과***: FAIL_NOT_AI

***해설***: 부동산 부자이나 *주거 *제외 후 *net worth가 *$1M 미만이고·*income도 *$200K 미만이다*. *Buyer는 *Frontend에서 *"AI 자격이 확인되지 않습니다"라는 *메시지를 *받고·*다른 path (Professional Credentials·*Entity 등) 가능성을 *고려해야 *한다*.

### 7.3 *Test 3 — *Boundary (정확 $1M)*

***시나리오***: Net worth = exactly $1,000,000 (주거 제외 후).

***예상 결과***: PASS (practice convention·*inclusive interpretation)

***Boundary sub-questions resolution***:

| 질문 | 결정 | 법적 reasoning |
|---|---|---|
| $1M는 *"exceeds"·*literal로 *> exclusive·*practice는 *≥? | **≥ inclusive (practice convention)** | Rule 501(a)(5)의 *"exceeds"는 *literal로 *exclusive이나·*operational practice는 *대체로 *≥. *Decipher는 *practice 채택 |
| 주거 부동산 *equity는? | **제외** | Rule 501(a)(5)(i) "primary residence shall not be included as an asset" |
| 부채 처리는? | **net 차감** | Rule 501(a)(5) "individual net worth" — *부채 차감 |
| 주거 mortgage가 *주거 value를 *초과하면? | **negative equity 차감** | 2010 Dodd-Frank: *negative equity는 *net worth에서 *차감 (주거 자체는 *제외이나·*초과 부채는 *반영) |

### 7.4 *Test 4 — *Income path*

***시나리오***: 자연인. *최근 *2년 income $250K·$220K. *당해 *expectation $230K. *Net worth는 *별도 *test 안 함.

***예상 결과***: PASS (Income path)

- Trusted Issuer가 *IRS form W-2·*1040 검증
- 최근 2년 *>= $200K ✅
- 당해 *expectation 충족 ✅
- claim.basis = AI_NATURAL_INCOME → PASS

### 7.5 *Test 5 — *Professional Credentials path*

***시나리오***: 자연인. *Series 65 *Investment Adviser Representative 자격 *보유·*FINRA 등록 *good standing.

***예상 결과***: PASS (2020 modernization path)

- Trusted Issuer가 *FINRA registry lookup으로 *credential 유효성 확인
- claim.basis = AI_NATURAL_CREDENTIALS
- claim.credentialNumber 검증
- → PASS

***해설***: *2020 *modernization은 *전통적 *재정 기준 외의 *sophistication 경로를 *명시했다*. *Investment professional은 *재정 *threshold 미충족이라도 *AI qualify 가능하다*. *Decipher 시스템은 *FINRA registry와 *직접 *integration할지·*Trusted Issuer가 *off-chain 검증할지 *operational 결정 사항이다*.

---

## §8. (α) *증명서 확인형 패턴 적용 — *Reasoning*

### 8.1 *패턴 B 선택 reasoning*

A-13와 *동일한 *reasoning이 *적용된다*. *Rule 501(a)의 *여러 *조건이 *judgment-based이고·*Rule 506(c)(2)의 *"reasonable steps to verify"가 *off-chain due diligence를 *전제한다*. *온체인 코드가 *재현 *불가·*패턴 B (증명서 확인형)가 *유일 옵션이다*.

### 8.2 *Rule 506(c)(2)(iii) Third-party verification이 *direct fit*

특히 *Rule 506(c)(2)(iii)이 *Decipher의 *Trusted Issuer model에 *direct fit이다*. *registered broker-dealer·*investment adviser·*변호사·*공인회계사가 *발급한 *written confirmation이 *Rule 506(c)의 *safe harbor에 *직접 *해당한다*. *Decipher의 *Trusted Issuer Registry는 *이런 *자격 *보유 기관만 *등록하도록 *운영된다 (operational gate).

---

## §9. (β) *Cross-Element·Cross-Recipe Coordination*

### 9.1 *Element cascade map*

```
A-03 (AI) ──┬─ (basis == AI_ALL_AI_ENTITY) ──► A-09 (Equity Owner Look-Through)
             │                                  │
             │                                  └─ (owner ∈ Affiliates) ──► A-08 (Affiliate)
             │
             └─ (모든 case) ──► A-11 (Claim Freshness)
```

### 9.2 *Recipe orchestration*

| Recipe | A-03 활성화 *조건 | 본 부품의 *역할 |
|---|---|---|
| R1 (Reg D 506(c) Issuance) | 항상 (R1 primary check) | AI 자격 판정 |
| R2 (§4(a)(7) Resale) | cumulative | resale path에서도 *AI 자격 *확인 |
| R3 (ICA §3(c)(7) Fund) | cumulative (BUIDL dual structure 시) | A-13와 *parallel check (다른 standard) |

### 9.3 *Conflict resolution — *A-03 vs A-13 동시 활성화*

***Case: BUIDL이 *§3(c)(7) + Reg D 506(c) dual structure를 *사용하는 *경우***:
- R1 (Reg D 506(c)) + R3 (ICA §3(c)(7))이 *동시 *activation
- A-03 (AI) + A-13 (QP) 둘 다 *evaluation
- ***결론: AND 결합 — *둘 다 *PASS여야 *trade 허용***
- 부동산 부자가 *A-03 PASS·*A-13 FAIL이면 *최종 FAIL
- 반대로 *KE가 *A-03 KE path·*A-13 KE path 둘 다 *qualifying하면 *둘 다 PASS

### 9.4 *Manifest integrity와의 *coordination*

post-trade commit 시점에 *Manifest Integrity Check (B-01)가 *Recipe R1·R3의 *각 Element 결과의 *consistency를 *재검증한다 (A-13 §9.5와 동일 pattern).

---

## §10. (γ) *3-Layer Solution Articulation*

A-13 §10과 *동일 framework가 *적용된다*:

| Layer | 무엇 | Coverage | Reasonable belief 형성 |
|---|---|---|---|
| Layer 1 — Self-Attestation | Buyer 자가 진술 | 1차 *intent 수집 | Low (단독 불충분) |
| Layer 2 — Trusted Issuer | Rule 506(c)(2) safe harbor methods 적용 | ***Primary*** (third-party verification safe harbor 직접 적용) | Primary |
| Layer 3 — External Spot-Check | 랜덤 audit | Safety net | Enhanced |

### 10.1 *A-03 특수성 — *Rule 506(c)(2)(iii) Third-party Verification*

Rule 506(c)(2)(iii)이 *Decipher Trusted Issuer model에 *direct 적용되어·*A-13의 *Rule 2a51-1(g) general reasonable belief보다 *더 *concrete한 *safe harbor를 *제공한다*. *Trusted Issuer가 *registered BD·*IA·*변호사·*CPA 자격을 *유지하면 *safe harbor가 *strong하다*.

### 10.2 *Liability 분배*

A-13 §10.4와 *parallel structure. *Trusted Issuer의 *Rule 506(c)(2) safe harbor methods 준수 여부가 *결정적이다*. *Issuer (RWA token 발행자)·*Decipher의 *liability cascade는 *§12 Open Issues 참조*.

---

## §11. (δ) *Frontend · Off-chain Operator Layer*

A-13 §11과 *동일 architecture. *Frontend self-id (path 선택)·*Trusted Issuer off-chain due diligence·*Manual review path 모두 *적용된다*.

### 11.1 *A-03 특수 *Frontend Flow — *Path 선택*

A-03는 *AI category가 *다양하므로 (Net Worth·*Income·*Credentials·*Entity·*KE) Frontend에서 *Buyer가 *자기 *path를 *명시 선택해야 *Trusted Issuer가 *적절한 *due diligence method를 *적용할 수 *있다*. *Path별 *required evidence가 *완전히 *다르다 (예: Income path는 *IRS form·*Credentials path는 *FINRA lookup만).

---

## §12. *Open Issues*

| # | 내용 | Priority |
|---|---|---|
| 1 | Claim freshness cap — *Rule 506(c) practice의 *90일과 *Decipher 1년의 *gap 분석·*safe harbor 유지 가능 여부 | 🔴 immediate |
| 2 | 2020 Knowledgeable Employee (Rule 501(a)(12))의 *§3(c)(1) vs §3(c)(7) coverage scope·*Decipher 적용 | 🟡 high |
| 3 | Issuer / Trusted Issuer / DEX 책임 분배 (A-13 Open Issue 3과 *parallel) | 🔴 immediate |
| 4 | "Exceeds" vs "not less than" practice convention의 *legal robustness 확인 | 🟢 medium |
| 5 | Spousal equivalent (Rule 501(a)(13)·2020 신설)의 *joint calculation spec | 🟡 high |
| 6 | Professional Credentials path의 *FINRA registry direct integration vs *Trusted Issuer off-chain 처리 | 🟡 high |
| 7 | All-AI Entity (Rule 501(a)(8)) cascade max depth — *A-09 coordination | 🟡 high |

---

## §13. *파일명 규칙 (Naming Convention)*

```
파일명 규칙 (Decipher Element/Recipe 산출물):

Element: A-XX_부품이름.md  (예: A-03_accredited-investor.md)
Recipe:  R-XX_Recipe이름.md  (예: R1_RegD-506c-Issuance.md)

Element 부품 ID 체계:
- A: 신원·자격 (매수인 측)
- B: 자산·기술 메타
- C: 거래 경로·시점
- D: 집계·누적
- E: 발행자 측
- F: 기타

본 부품: A-03 = "신원·자격 카테고리의 *3번째 부품"

물리적 위치: 산출물/elements/
```

---

## §14. *변경 로그*

- [2026-06-14] (canton-rwa) v2.1 patch. *citation 검증 정정 반영* (⚠️ 정정 노트로 *명시·*v1.0·v2.0의 *6 주요 *citation 오류 정정 — *Rule 501(a) 13 categories·*KE = (a)(11)·*Family Office = (a)(12)·*Family Client = (a)(13)·*Professional Credentials = (a)(10)·*Entity-based AI 4 categories ((a)(3)·(7)·(8)·(9) — *특히 (a)(9) investments-based entity 추가)·*Spousal equivalent는 *§ 230.501(j) 정의·*별도 category가 *아님·*Rule 506(c)(2)(ii) safe harbor methods는 *(A)·(B)·(C)·(D)·(E) 5종이며 *"prior three months" 요건이 *Rule 506(c) compliance의 *결정적 *시간 제약·*Decipher 1년 cap과 *gap articulation. *§3.2 §3(c)(2)(ii) safe harbor methods 전면 재작성·*frontmatter related-external-sources 정확 URL update·*eCFR 직접 인용으로 *전환).
- [2026-06-13] (canton-rwa) v2.0 작성. *Accredited Investor walkthrough — *공유 산출물 form. *self-contained·*규제 맥락 우선·*친절한 해설·*Internal ID 분리·*법령 조문 인용 form 적용·*외부 공식 자료만. **§1 규제 맥락** (Securities Act 1933 4 Pillar 위치·*registration vs Reg D safe harbor·*Decipher RWA token 발행/유통 relevance·*한국 자본시장법 비교) + **§2 메타 정보** + **§3 ① 법적 근거** (§4(a)(2)·*Rule 506(c)·*Rule 501(a) 8 categories·*2020 modernization 3 categories·*Rule 506(c)(2) reasonable steps to verify safe harbor methods·*Ralston Purina·*Sub-요건 매트릭스 + A-13와의 결정적 3 차이 *상세 비교) + **§4 ② 입력 사실** + **§5 ③ 판정 로직** (5 step flow·*pseudocode 6 category branches·*"exceeds" vs "not less than" practice 결정·*비결정성 framing) + **§6 ④ 거절·예외 처리** (9 failure codes) + **§7 ⑤ 테스트 케이스** (Net Worth Pass·Net Worth Fail·Boundary $1M·Income path·Credentials path 5 cases·*주거 부동산 분리·*negative equity 처리) + **§8 (α) 패턴 B + Rule 506(c)(2)(iii) third-party verification direct fit** + **§9 (β) Cross coordination·*A-03 vs A-13 dual structure conflict resolution** + **§10 (γ) 3-Layer Solution + Rule 506(c)(2) safe harbor methods** + **§11 (δ) Frontend path 선택의 *A-03 특수성** + **§12 Open Issues 7건** + **§13 파일명 규칙**.
