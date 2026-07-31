# ELE.C-01_holding-period

# C-01 Holding Period — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 Holding Period 부품(내부 식별자 C-01)을, 미국 증권법을 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**한 줄로 말하면.** C-01은 **이 물량을 지금 팔아도 될 만큼 오래 갖고 있었는가**를 거래 직전에 계산한다. 자격도 신원도 물량도 보지 않는다. 오직 **시간** 하나다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-07-18).** 본 부품의 모든 인용은 아래 1차 출처를 조회일 **2026-07-18**에 직접 대조하여 확정했다.

| 출처 | 판(edition)·현행성 표기 | 조회처 |
| --- | --- | --- |
| 17 CFR §230.144 (Rule 144 전문) | "up to date as of 7/14/2026" · Title 17 최근 개정 2026-06-25 · 원출처 [37 FR 596, Jan. 14, 1972] | ecfr.gov |
| 15 U.S.C. §77b·§77d·§77e·§77l | prelim 현행본 · §77d 표기 "Text contains those laws in effect on June 5, 2026" | uscode.house.gov |
| SEC Release No. 33-8869 | **72 FR 71546** (면수 71546–71573, 28면) · File No. S7-11-07 · RIN 3235-AH13 · 2007-12-17 게재 · 2008-02-15 시행 | federalregister.gov · 공식 PDF는 govinfo.gov (FR-2007-12-17/07-6013) |
| Corporation Finance Interpretations — Securities Act Rules §128~§138 | 페이지 표기 "June 7, 2021 / Last Update: March 6, 2026" | sec.gov |

ecfr.gov · uscode.house.gov · sec.gov · govinfo.gov · federalregister.gov 외의 출처는 인용하지 않는다. 영문 원문은 한 글자도 변형하지 않고 보존했다.

**⚠ 초기 원고 대비 정정 2건**(상세는 §14 변경 로그). ① 33-8869의 시작면을 **71545 → 71546**으로 정정 — federalregister.gov의 Document Citation 및 면수 표기(71546–71573)가 근거다. ② §77d의 prelim 현행성 표기를 **June 13, 2026 → June 5, 2026**으로 정정 — 2026-07-18 조회 표기가 근거다.

**⚠ 용어·범위 정정 노트 (읽기 전에).**

- **C-01(보유기간) ≠ A-11(증명 유효기간).** 둘 다 "시간"을 재지만 **대상도 기산점도 다른 별개의 시계**다. C-01의 대상은 *증권 그 자체*이고 시계는 *취득 시점*부터 흐른다(Rule 144(d)). A-11의 대상은 *자격 증명*(AI claim·QP claim)이고 시계는 *증명이 검증된 시점*(verifiedAt)부터 흐른다. C-01이 보는 것은 매도인, A-11이 보는 것은 (통상) 매수인이다. 한 문장으로 — **A-11은 증명서가 상했나, C-01은 증권을 묵혔나**를 본다.

- **보유기간은 계열/비계열을 가리지 않는다.** 흔한 오해가 "계열(affiliate)이면 더 오래 갖고 있어야 한다"는 것인데, Rule 144(d)의 기간은 **양쪽이 동일**하다(6개월 또는 1년). 계열에게 더해지는 것은 기간이 아니라 *조건의 개수*다 — (c) 공시·(e) 물량·(f)(g) 방식·(h) Form 144가 병행으로 붙는다(각각 E-05·C-08·C-09·E-06 소관).

- **BUIDL-like 토큰의 기본값은 6개월이 아니라 1년**이다. 6개월은 Exchange Act 보고회사의 증권에만 적용되고(Rule 144(d)(1)(i)), 비보고 발행자는 1년이다(동 (d)(1)(ii)). §3.8·§5.3에서 상술한다.

- **"헤지하면 시계가 멈춘다"는 규정은 현행 Rule 144에 없다.** SEC는 2007년에 tolling(정지) 조항을 제안했다가 **채택하지 않았다**(Release 33-8869, §3.16). 코드에 tolling 로직을 넣으면 법과 어긋난다.

**테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, transfer architecture, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링하여, Rule 144(d) 기반 pre-trade transfer restriction을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다.

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** "6개월 혹은 1년을 기다려라"는 요건은 그 자체로는 자의적으로 보인다. 왜 하필 시간인가? 왜 하필 6개월인가? 이 질문에 답하지 않으면 구현은 숫자 비교 한 줄로 오그라들고, 정작 중요한 판단 — 시계를 *언제부터* 세는가, *누구의* 시계를 물려받는가, *어느 시점의* 사실로 기간 길이를 정하는가 — 이 전부 빠진다. 실제로 C-01의 난이도는 부등호가 아니라 **기산점**에 있다. 그래서 조문 넉 줄이 사다리처럼 이어지는 구조부터 깐다.

### 1.1 네 조문이 만든 하나의 사다리 — §5 → §4(a)(1) → §2(a)(11) → Rule 144

미국 증권법에서 증권을 파는 행위의 **기본값은 금지**다. 1933년 증권법 §5(15 U.S.C. §77e)가 등록 없는 매도를 막는다. 팔려면 등록하거나, 면제를 찾아야 한다.

재판매(2차 거래)에서 쓰는 면제가 §4(a)(1)이다. 조문은 짧다 — "**transactions by any person other than an issuer, underwriter, or dealer**"(발행자·인수인·딜러가 아닌 자의 거래). 일반 투자자가 자기 주식을 파는 건 이 면제로 커버된다. 문제는 가운데 단어, **underwriter**다.

§2(a)(11)이 underwriter를 정의하는데, 그 범위가 직관보다 훨씬 넓다 — "any person who has purchased from an issuer **with a view to** ... the distribution of any security". 투자은행만이 아니라, "발행자한테서 **유통시킬 생각으로** 샀다"면 개인 투자자도 underwriter다. underwriter면 §4(a)(1) 면제가 사라지고, 등록 없이 판 그 거래는 §5 위반이 된다.

여기서 실무가 무너진다. **"유통시킬 생각"은 사람의 머릿속**이다. 거래 시점에 확인할 방법이 없다. 그래서 Rule 144 채택 전에는 사후 정황 — 얼마나 오래 갖고 있었나, 사정 변경이 있었나 — 으로 되짚었고, 그 결과는 예측 불가능이었다. SEC의 서술을 그대로 옮기면 이렇다.

> "Since it is difficult to ascertain the mental state of the purchaser at the time of an acquisition of securities, prior to and since the adoption of Rule 144, subsequent acts and circumstances have been considered to determine whether the purchaser took the securities 'with a view to distribution' at the time of the acquisition. Emphasis has been placed on factors such as the length of time the person held the securities and whether there has been an unforeseeable change in circumstances of the holder. Experience has shown, however, that reliance upon such factors alone has led to uncertainty in the application of the registration provisions of the Act." (17 CFR §230.144, Preliminary Note)

SEC가 1972년에 내놓은 해법이 Rule 144이다 — **내심을 묻는 대신, 내심을 대신 증명해 줄 객관적 사실을 정해두는 것**. 그 객관적 사실 중 첫째가 보유기간이다.

**쉽게 말하면:** 법은 "너 팔 생각으로 샀지?"를 묻고 싶은데 물어봐야 답을 검증할 수 없다. 그래서 질문을 바꿨다 — "그럼 1년 갖고 있어 봐. 1년을 버텼으면 팔 생각으로 산 게 아니었다고 쳐줄게." C-01은 그 "1년을 버텼는가"를 세는 부품이다.

| 사다리 | 조문 | 하는 일 | Decipher |
| --- | --- | --- | --- |
| ① 기본값 | §5 · 15 U.S.C. §77e | 등록 없는 매도 금지 | 모든 재판매의 출발 전제 |
| ② 면제 | §4(a)(1) · §77d(a)(1) | issuer·underwriter·dealer가 아니면 면제 | R2 Recipe의 근거 |
| ③ 함정 | §2(a)(11) · §77b(a)(11) | "with a view to distribution"이면 underwriter | 면제를 되돌리는 조항 |
| ④ 사다리 | Rule 144 · 17 CFR §230.144 | 객관 기준 충족 시 underwriter 아님으로 간주 | C-00이 경로 선택, C-01이 (d) 담당 |

### 1.2 Rule 144는 "면제"가 아니라 "간주"다 — 그리고 배타적이지 않다

정확히 해두어야 할 성격이 둘 있다.

**첫째, Rule 144는 그 자체가 면제가 아니다.** Rule 144는 "당신은 underwriter가 아니라고 **간주**한다"고 말할 뿐이고, 그 간주 덕분에 §4(a)(1) 면제를 쓸 수 있게 되는 구조다. 그래서 Rule 144를 통과했다는 말은 "§5를 면제받았다"가 아니라 "§4(a)(1)을 쓸 자격의 안전항(safe harbor)에 들어갔다"는 뜻이다.

**둘째, Rule 144는 배타적이지 않다.** Preliminary Note는 "Rule 144 is not an exclusive safe harbor. A person who does not meet all of the applicable conditions of Rule 144 still may claim any other available exemption under the Act for the sale of the securities."라고 명시한다. 보유기간을 못 채웠다고 해서 그 증권을 **영영 못 파는 게 아니다** — §4(a)(7)이나 Rule 144A 같은 다른 통로가 열려 있을 수 있고, 그 통로 선택은 C-01이 아니라 **C-00(전매 경로 선택기)** 소관이다. C-01은 C-00이 이미 `RULE144` 경로를 확정한 뒤에만 켜진다.

**셋째, 기술적 충족이 끝이 아니다.** 같은 Preliminary Note의 마지막 문장 — "The Rule 144 safe harbor is not available to any person with respect to any transaction or series of transactions that, although in technical compliance with Rule 144, is part of a plan or scheme to evade the registration requirements of the Act." 계산이 맞아도 회피 계획의 일부면 안전항이 사라진다. **C-01의 PASS는 "시간축 조건 충족"이지 "safe harbor 종국 확정"이 아니다.** 이 겸손은 문서 전체에서 반복된다(§6.3·§8.2).

### 1.3 왜 6개월과 1년으로 갈리나 — 공시 격차가 시계 길이를 정한다

Rule 144(d)는 하나의 기간을 두지 않고 둘로 갈린다. 갈림의 기준은 매도인이 아니라 **발행자가 Exchange Act 보고회사인가**이다.

SEC가 2007년 개정(Release 33-8869)에서 밝힌 논거는 두 문장으로 요약된다. 하나는 기간의 **목적**이고, 하나는 차등의 **이유**다.

> "The purpose of Rule 144 is to provide objective criteria for determining that the person selling securities to the public has not acquired the securities from the issuer for distribution. A holding period is one criterion established to demonstrate that the selling security holder did not acquire the securities to be sold under Rule 144 with distributive intent. ... we believe that a six-month holding period for securities of reporting issuers provides a reasonable indication that an investor has assumed the economic risk of investment in the securities to be resold under Rule 144." (Release 33-8869, II.B.1)

> "We believe that different holding periods for reporting and non-reporting issuers are appropriate given that reporting issuers have an obligation to file periodic reports with updated financial information (including audited financial information in annual filings) that are publicly available on EDGAR, the Commission's electronic filing system. Although non-reporting issuers must make some information publicly available before resales can be made under Rule 144, this information typically is much more limited in scope than information included in Exchange Act reports, is not required to include audited financial information, and is not publicly available via EDGAR. For these reasons, we believe that continuing to require security holders of non-reporting issuers to hold their securities for one year is not unduly burdensome and is consistent with investor protection." (Release 33-8869, II.B.1)

여기서 C-01 설계 전체를 지배하는 개념이 나온다 — **경제적 위험의 인수(assumption of economic risk)**. 보유기간은 날짜 세기가 아니라, "이 사람이 진짜로 이 증권의 위험을 짊어졌는가"를 시간으로 근사(proxy)한 것이다. 이 개념이 왜 중요하냐면, Rule 144(d)의 **거의 모든 예외·승계 규칙이 이 기준 하나로 설명**되기 때문이다. 위험이 그대로 이어지면 시계도 이어지고(tacking), 위험이 새로 생기면 시계도 새로 선다. §5.6에서 이 원리를 로직으로 되돌린다.

**쉽게 말하면(비유):** 중고차를 되팔 때 "몇 달 탔느냐"를 묻는 이유는 주행거리가 궁금해서가 아니라, **전매업자인지 실사용자인지**를 가리기 위해서다. 그리고 차량 정비이력이 공개된 차(보고회사)는 6개월이면 판단이 서지만, 이력이 깜깜한 차(비보고회사)는 1년은 타 봐야 한다는 것이 SEC의 논리다.

| | 보고 발행자 | 비보고 발행자 |
| --- | --- | --- |
| 근거 | Rule 144(d)(1)(i) | Rule 144(d)(1)(ii) |
| 기간 | 6개월 | **1년** |
| 조건 | 발행자가 매도 직전 **90일 이상 계속** §13·§15(d) 보고 대상 | 그 밖의 전부 |
| 공시 | EDGAR 정기보고서(감사받은 재무제표 포함) | Exchange Act Rule 15c2-11 수준의 제한적 정보 |
| BUIDL-like | 해당 없음 | **⭐ 해당 — 기본값 1년** |

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk

보유기간 계산이 틀리면 무슨 일이 벌어지는가. 두 방향의 오류는 무게가 전혀 다르다.

**과잉 차단(false FAIL)** — 팔 수 있는 물량을 막는다. 사용자 불만·유동성 저하가 생기지만 법적 사고는 없다. 시간이 지나면 저절로 풀린다.

**과소 차단(false PASS)** — 기간 미달 물량이 Rule 144 경로로 나간다. 이 경우의 경로는 단계적이다.

보유기간 미달 물량이 Rule 144 경로로 매도됨
→ Rule 144의 applicable conditions 미충족 → safe harbor 부적용
→ 매도인은 §2(a)(11) underwriter로 남을 수 있음 → §4(a)(1) 면제 상실
→ 등록 없는 매도 = §5 위반
→ §12(a)(1) 매수인의 취소·손해배상 소권 + SEC enforcement
→ 그 매도가 발행 자체와 통합(integration)돼 R1 발행 면제까지 문제 삼힐 위험

마지막에서 둘째 줄이 결정적이다. 1933년법 §12(a)(1)(15 U.S.C. §77l(a)(1))은 이렇게 쓴다.

> "Any person who— (1) offers or sells a security in violation of section 77e of this title, ... shall be liable, subject to subsection (b), to the person purchasing such security from him, who may sue either at law or in equity in any court of competent jurisdiction, to recover the consideration paid for such security with interest thereon, less the amount of any income received thereon, upon the tender of such security, or for damages if he no longer owns the security."

**여기서 A-13(QP 부품)과의 결정적 대비를 짚어야 한다.** A-13의 §1.4는 투자회사법(ICA) 축의 존립 위험을 다루면서, ICA §47(b)의 **묵시적** 사적 소권이 *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*(608 U.S. \_\_\_, No. 24-345, 2026-06-11)로 **부정**되었음을 밝혔다. 그래서 ICA 축의 강제력은 SEC enforcement·계약 집행가능성·상업적 unwind로 옮겨 갔다.

**증권법 축은 다르다.** §12(a)(1)은 판례가 읽어낸 묵시적 소권이 아니라 **의회가 조문에 직접 새긴 명시적 소권**이다. 매수인이 "consideration paid ... with interest"의 반환을 청구할 수 있다고 조문이 문언으로 말한다. FS Credit의 논리(묵시적 소권 부정)는 여기에 닿지 않는다. 즉 —

- **ICA 축(A-13):** 사적 소권 ✕ → 강제력은 규제·계약·상업적 경로
- **증권법 축(C-01·R2):** 사적 소권 ⭐ **명시적으로 존재** → 매수인이 직접 취소를 구할 수 있음

이 대비가 R2 Recipe의 설계 온도를 정한다. **재판매 경로에서 시간축을 틀리면, 그 손해를 청구할 사람이 조문상 이미 정해져 있다 — 바로 상대방 매수인이다.** DEX에서는 그 매수인이 익명의 다수이며, 같은 오작동이 반복되면 동일 결함을 공유하는 거래가 무더기로 쌓인다.

**쉽게 말하면:** A-13이 실수하면 펀드가 위태로워지고, C-01이 실수하면 **거래 상대방 한 명 한 명이 각자 물릴 수 있는 소권을 손에 쥔다**. 그래서 C-01의 기본 자세는 "의심스러우면 막는다"이고, 판정 불가 시의 기본값은 언제나 더 긴 쪽(1년)이다.

### 1.5 [경계] 이 시스템에는 시계가 여러 개다 — 어느 것이 C-01인가

Decipher의 부품 중 "시간"을 다루는 것이 넷이다. 서로 다른 법·다른 대상·다른 기산점이므로 하나로 합치면 반드시 오작동한다.

| 부품 | 무엇을 재나 | 기산점 | 길이 | 근거 |
| --- | --- | --- | --- | --- |
| **C-01 (본 부품)** | 증권 lot의 보유기간 | 발행자·계열로부터의 취득(+완납) | 6개월 / 1년 | Rule 144(d) |
| A-11 | 자격 증명의 유효기간 | claim.verifiedAt | AI 5년(법정) / QP 1년(정책) | Rule 506(c)(2)(ii)(E) 등 |
| A-06 | 계열 지위의 잔존기간 | 계열 종료 시점 | (b)(1) 3개월 / (b)(2) 90일 | Rule 144(b)(1)·(b)(2) |
| C-08 | 매도 물량의 합산 창 | 매도 시점 소급 | 직전 3개월(달력월) | Rule 144(e)(1) |

**혼동 주의 3종.**

- ✕ "C-01의 1년과 A-11의 AI 5년은 같은 축이다" — 다른 법(1933년법 재판매 vs 506(c) 발행 검증), 다른 대상(증권 vs 증명서).
- ✕ "C-08의 3개월과 A-06의 3개월은 같은 것이다" — C-08은 *물량 합산 창*, A-06은 *계열 지위 look-back*. 우연히 숫자가 같을 뿐이며, C-08 문서가 이 혼동을 최대 오구현 위험으로 지목한다.
- ✕ "보유기간을 채우면 자유롭게 거래된다" — 아니다. Rule 144(d)를 채워도 §3(c)(7) 펀드의 QP 게이트(A-13)는 그대로 살아 있다. 증권법 축과 투자회사법 축은 나란히 작동하는 별개 축이다(A-13 §1.3).

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"보유기간 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | Holding Period (보유기간) | 제한증권 물량의 "묵힌 시간"을 재는 계량기 |
| 검사 대상 | 매도 대상 lot이 제한증권이면, 발행자·계열로부터의 취득(및 완납) 시점부터 매도 시점까지 **6개월(보고 발행자) 또는 1년(비보고 발행자)이 경과했는가** — 승계(tacking) 사유가 있으면 승계된 기산점 기준 | "이 물량을 지금 팔 만큼 오래 갖고 있었나" |
| Internal ID | C-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **직접 계산형(패턴 A)** — 온체인 코드가 timestamp를 직접 비교 | 증명서를 확인하는 게 아니라 날짜를 계산한다. 단 *입력*(취득 사실)의 진실성은 3층 attestation에 의존(§8·§10) |
| Timing | pre-trade(거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | **STATELESS** (Element 한정) | 자체 누적 상태·commit hook 없음. 다만 판정은 **Acquisition Registry(CR-3)** 라는 외부 원장을 read-only로 읽는 데 전적으로 의존한다 — "상태를 갖지 않되 상태에 기댄다"(§8.3) |
| 활성화 조건 | C-00의 확정 경로 == `RULE144` | §4(a)(7)·Rule 144A·Reg S 904 경로에서는 C-01이 켜지지 않는다(각 경로의 요건이 다름) |
| 주 활성화 Recipe | R2 (§4(a)(1)·Rule 144 Resale) | R2 전용 부품 — R1 발행·R3 펀드·R4 시장행위엔 붙지 않는다 |
| Cumulative Recipe | 없음 (R2 exclusive) | 다만 같은 거래에 R3(A-13 QP 게이트)가 병렬로 켜질 수 있다 — 다른 축이므로 AND 결합 |
| Cascade Element | C-00(경로 확정 · 상류) · A-06(계열 판정 → (b)(1)/(b)(2) 분기, **기간 길이엔 무영향**) · B-03(restricted 메타 · 상류) · B-01(manifest 정합) · E-05·C-08·C-09·E-06(병행 조건 · 소관 분리) | 입력을 공급하거나 병행 조건을 나눠 갖는 부품 |
| Pool·Phase | Required 19 / Phase 2 | CR-3(Acquisition Registry) 설계 결정이 blocking — 공동 설계 지점 |
| 성숙도 | ⭐ R2 핵심 (조문 요건 분해 완료 → 본 문서로 확정) | 미결은 §12 표 |
| 파일·위치 | C-01_보유기간.md · 산출물/elements/ | 산출물 경로 |

**메타 박스에서 가장 중요한 두 줄.**

- **"활성화 조건 = C-00이 `RULE144`를 확정했을 때"** — C-01은 전매 경로를 고르지 않는다. 경로가 정해진 다음에야 켜지는 하류 부품이다. 이 순서를 뒤집으면(C-01이 먼저 FAIL을 내고 거래를 죽이면), 보유기간을 못 채웠어도 §4(a)(7)로 팔 수 있었을 물량까지 잘못 막힌다(§1.2 "배타적이지 않다").
- **"STATELESS인데 외부 원장 의존"** — C-08은 자기 원장을 세고 갱신하므로 STATEFUL이지만, C-01은 남이 관리하는 원장을 읽기만 하므로 STATELESS다. 이 구분이 인터페이스를 가른다 — C-01은 `onTransfer` commit hook이 필요 없고, 대신 Registry의 무결성에 자기 정확성 전체를 건다.

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — **Layer 1**(조문)은 의회가 만든 법률 텍스트(statute), **Layer 2**(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), **Layer 3**(해석)은 SEC 발행문서·Corporation Finance Interpretations가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표 1의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1~§3.19 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 세 Layer의 조문·규칙이 C-01 판정에서 어떻게 연결되는지를 하나의 흐름으로 정리한 것이다 — §5의 등록 기본값에서 출발해 §4(a)(1) 면제가 §2(a)(11)의 "with a view to distribution" 때문에 불확실해지고(내심 확인 불가), Rule 144가 그 내심을 객관 기준으로 대체하며, 그 기준 중 (d)가 시간축을 걸고, 발행자의 보고 여부에 따라 6개월/1년으로 갈리며, (d)(1)(iii) 완납·(d)(2) 어음·(d)(3) tacking이 기산점을 조정하고, (i) shell이 경로 자체를 봉쇄하는 구조다. 각 조항의 상세는 §3.1~§3.19.

**범례.**

- 파랑 = 핵심(Direct: §4(a)(1)·§2(a)(11)·Rule 144(d) 본체·(d)(1)(ii))

- 회색 = 분기·판정 노드 · 점선 상자 = Layer 구분

- 초록 = PASS

- 빨강 = FAIL·경로 봉쇄(Rule 144(i)·§12(a)(1) 위험)

- 주황 노트 = 문제 제기(내심 확인 불가)

![C-01 fig30 — 법조문 관계 흐름](C-01_fig30.png)

### 3.0.1 실제 BUIDL-like 토큰은 어떻게 적용되나

위 그림을 우리 자산 하나에 대입하면 경로가 매우 짧아진다. BUIDL-like §3(c)(7) 펀드 토큰의 사실관계를 대입해 보자.

| 사실 | 값 | 귀결 |
| --- | --- | --- |
| 발행 경로 | Reg D Rule 506(c) 사모 (R1) | Rule 144(a)(3)(ii) → **restricted securities** — 시계가 걸린다 |
| 발행자의 Exchange Act 보고 지위 | **비보고**(§13·§15(d) 대상 아님) | Rule 144(d)(1)(ii) → **1년** |
| 통상 매도인 | 기관 QP, 비계열 | Rule 144(b)(1)(ii) → **(d) 단독**이 유일 조건 |
| 계열 매도인 | 운용사 계열·임원 등 (A-06) | Rule 144(b)(2) → (c)(2)·(d)·(e)·(f)(g)·(h) 전부 |
| shell 여부 | 선언상 NON_SHELL (⚠ §3.14·§12) | Rule 144(i) 미해당 전제 |

**여기서 나오는 결론 하나가 R2 전체를 규정한다.** 비보고 발행자의 **비계열** 매도인에게는, Rule 144의 조건이 **(d) 하나뿐**이다. Rule 144(b)(1)(ii)의 문언이 그렇게 쓰여 있다 — "shall be deemed not to be an underwriter ... if **the condition of paragraph (d)** of this section is met"(단수형 *condition*). 공시도, 물량도, 매도방식도, Form 144도 없다.

즉 **BUIDL-like 토큰의 일반 보유자에게 Rule 144 재판매란 사실상 C-01 하나를 통과하는 것**이다. R2 Recipe에서 이 부품의 무게가 여기서 나온다. (계열 매도인이면 이야기가 완전히 달라져 다섯 부품이 동시에 붙는다 — §9.3.)

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 C-01에 어떻게 닿는지를, **표 2**(순서·중요성)는 §3.1~§3.19 소단원의 읽는 순서(논리 흐름)와 중요성(C-01이 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이라, 가장 중요한 Rule 144(d)(1)이 중간에 온다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | C-01 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Securities Act §5 · 15 U.S.C. §77e | 등록 없는 매도 금지(기본값) | 재판매 규제의 출발 전제 | Background | uscode.house.gov |
| Statute | Securities Act §4(a)(1) · §77d(a)(1) | issuer·underwriter·dealer 아닌 자의 거래 면제 | Rule 144가 여는 목적지 면제 | Supporting | uscode.house.gov |
| Statute | Securities Act §2(a)(11) · §77b(a)(11) | underwriter 정의("with a view to ... distribution") | 보유기간 요건이 존재하는 이유 | Supporting | uscode.house.gov |
| Statute | Securities Act §12(a)(1) · §77l(a)(1) | §5 위반 시 매수인의 명시적 취소·손배 소권 | 과소 차단의 결과(§1.4) | Background | uscode.house.gov |
| Statute | Securities Act §4(a)(7)·§4(e)(1)(C) · §77d | AI 재판매 면제 + 취득분 restricted 의제 | SRC_SEC4A7 기산 분기 | **Conditional** | uscode.house.gov |
| SEC Rule | Rule 144 Preliminary Note · 17 CFR §230.144 | safe harbor 성격·비배타성·evasion 단서 | PASS의 의미 한계 설정 | Supporting | ecfr.gov |
| SEC Rule | Rule 144(a)(1)·(a)(2) | affiliate·person(합산 단위) 정의 | (b) 분기의 입력 — A-06·A-04 소관 | Supporting | ecfr.gov |
| SEC Rule | Rule 144(a)(3) | restricted securities 정의 (i)~(viii) | **시계가 걸리는 대상**을 정함 → G1 | **Direct** | ecfr.gov |
| SEC Rule | Rule 144(b)(1)(i)·(ii) | 비계열 매도인의 조건 (보고/비보고) | 비보고 → (d) 단독 → C-01 단일 관문 | **Direct** | ecfr.gov |
| SEC Rule | Rule 144(b)(2) | 계열 매도인 — "all of the conditions" | 병행 조건 배선(Recipe 몫) | Supporting | ecfr.gov |
| SEC Rule | **Rule 144(d)(1)(i)** | 6개월 — 보고 발행자 | required 산출 갈래 A | **Direct** | ecfr.gov |
| SEC Rule | **Rule 144(d)(1)(ii)** | 1년 — 비보고 발행자 | ⭐ BUIDL-like 기본값 | **Direct** | ecfr.gov |
| SEC Rule | **Rule 144(d)(1)(iii)** | 완납 전 시계 미개시 | clockStart 하한 | **Direct** | ecfr.gov |
| SEC Rule | Rule 144(d)(2)(i)~(iii) | 어음·할부는 완납 아님(3요건 예외) | HP_NOTE_TERMS_UNVERIFIED | Conditional | ecfr.gov |
| SEC Rule | Rule 144(d)(3)(i)~(x) | tacking 10종 | 승계형 sourceType 5종의 근거 | **Direct** | ecfr.gov |
| SEC Rule | Rule 144(i)(1)~(3) | shell company 배제·해제 조건 | 경로 자체 봉쇄 → G2 | **Conditional** | ecfr.gov |
| SEC Rule | Rule 144(c)·(e)·(f)·(g)·(h) | 공시·물량·방식·신고 | 병행 조건 — E-05·C-08·C-09·E-06 소관 (forward-ref) | Supporting | ecfr.gov |
| SEC Rule | Rule 502(d) · 17 CFR §230.502(d) | Reg D 재판매 제한 | (a)(3)(ii) 경유 restricted 부여 | Supporting | ecfr.gov |
| SEC Release | **Release No. 33-8869** · 72 FR 71546 (2007-12-17) | 2007 개정 — 6개월 채택·1년 유지·tolling 미채택·staff 해석 성문화 | 기간 논거 + 헤지 tolling **없음** 확인 | **Direct** | sec.gov |
| SEC Staff | CFI Securities Act Rules §132 (144(d)) — Q132.01~132.18 | 기산·tacking staff 해석 | 132.07·132.10·132.14 = 구현 핵심 | **Direct** | sec.gov |
| SEC Staff | CFI Securities Act Rules §128~§131·§133~§137 | 일반·(a)·(b)·(c)·(e)·(f)·(h)·(i) 해석 | 경계·병행 조건 이해 | Supporting | sec.gov |
| SEC Release | Release No. 33-5223 (1972) · Release No. 33-6099 (1979) | Rule 144 원채택·초기 해석 | 연혁(33-8869 인용분으로만 참조) | Background | sec.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | C-01이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | §4(a)(1) — 재판매 면제 | 보조 | 안 함 — Rule 144가 도달하려는 목적지 |
| §3.2 | §2(a)(11) — underwriter 정의 | 보조 | 안 함 — 보유기간이 존재하는 이유 |
| §3.3 | Rule 144 Preliminary Note | 보조 | PASS의 의미 한계 설정(회피 계획 시 무효) |
| §3.4 | Rule 144(a)(3) — restricted 정의 | 핵심 | G1 — 시계가 걸리는 대상인지 판정(입력은 B-03) |
| §3.5 | Rule 144(b)(1)(i)·(ii) — 비계열 | 핵심 | 비보고 → (d) 단독임을 확정 |
| §3.6 | Rule 144(b)(2) — 계열 | 보조 | 안 함 — 병행 조건은 다른 부품 |
| §3.7 | Rule 144(d)(1)(i) — 6개월 | 핵심 | required = 6개월 (보고 발행자) |
| §3.8 | Rule 144(d)(1)(ii) — 1년 | **핵심(기본값)** | required = 1년 ⭐ BUIDL-like |
| §3.9 | Rule 144(d)(1)(iii) — 완납 | 핵심 | clockStart 하한 = paymentCompleteAt |
| §3.10 | Rule 144(d)(2) — 어음·할부 | 조건부 | 완납 판정의 예외 3요건 |
| §3.11 | Rule 144(d)(3)(i)~(iii) — 배당·전환·조건부 | 핵심(분기) | ⭐ 배당토큰 tacking (BUIDL-like 상시 발생) |
| §3.12 | Rule 144(d)(3)(iv)~(vii) — 질권·증여·신탁·유산 | 조건부 | 승계형 4종 + 유산 카브아웃 |
| §3.13 | Rule 144(d)(3)(viii)~(x) — Rule 145·지주회사·무현금 | — | 안 함 — 현 자산군 해당 없음(N/A) |
| §3.14 | Rule 144(i) — shell 배제 | **조건부(P0)** | G2 — 경로 자체 봉쇄 여부 |
| §3.15 | §4(a)(7)·§4(e)(1)(C) | 조건부 | SRC_SEC4A7 lot의 기산 판단 |
| §3.16 | Release 33-8869 | 핵심(해석) | 기간 논거 + **tolling 미채택** 확인 |
| §3.17 | CFI §128~§137 | 핵심(해석) | 132.07 기산 · 132.10 해당일 · 132.14 시점 |
| §3.18 | Sub-요건 분해 매트릭스 | — | 위 요건을 원자적 검증 단위로 분해 |
| §3.19 | ERC-3643 변환·sourceType 총정리 | — | §3.4~§3.15의 필드 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래는 같은 거래에 작동하지만 C-01이 아니라 다른 부품·레이어가 책임진다. 누락이 아니라 소관 분리이며, C-01 안에 끌어다 구현하지 않는다.

- **Rule 144(c) 공시 · (e) 물량 · (f)(g) 방식 · (h) Form 144** — 계열 매도인에게 병행으로 붙는 조건. 각각 **E-05 · C-08 · C-09 · E-06** 소관. C-01은 (d)만 담당한다.

- **Rule 144(a)(1) affiliate 판정 · (a)(2) 합산 단위** — **A-06 · A-04** 소관. C-01은 결과만 소비하며, 그 결과는 C-01의 *기간 길이를 바꾸지 않는다*(§1 정정 노트).

- **restricted 플래그의 부여·유지** — **B-03**(이전제한 메타) 소관. C-01은 `lot.restricted`를 읽기만 한다.

- **전매 경로 선택({RULE144, SEC4A7, RULE144A, REGS_904})** — **C-00** 소관. C-01은 `RULE144` 확정 후에만 켜진다.

- **ICA §3(c)(7) QP 게이트** — **A-13** 소관. 별개 축이며 보유기간 충족으로 해소되지 않는다.

### 3.1 Securities Act § 4(a)(1) — 재판매 면제의 목적지 [uscode.house.gov]

**핵심 원문:** The provisions of section 77e of this title shall not apply to— (1) transactions by any person other than an issuer, underwriter, or dealer.

**한국어:** 이 편 제77e조의 규정은 다음에 적용되지 아니한다 — (1) 발행자(issuer), 인수인(underwriter) 또는 딜러(dealer) 이외의 자에 의한 거래.

**쉬운 설명:** "발행자·인수인·딜러가 아닌 사람의 거래는 등록 안 해도 된다." 재판매(2차 거래)가 기대는 유일한 일반 면제다. 세 단어 중 앞뒤 둘(issuer·dealer)은 신원으로 판별되지만, 가운데 underwriter만은 §2(a)(11)이 "생각"으로 정의해 놓아 다툼이 생긴다.

**PASS/FAIL 반영:** 간접 ✕ — C-01이 이 조문을 직접 판정하지 않는다. Rule 144가 도달하려는 목적지이며, C-01 FAIL의 궁극적 의미는 "이 면제를 쓸 수 없다"이다.

**ERC-3643 변환:** 온체인 구현 없음 — R2 Recipe의 법적 전제. C-00이 `path = RULE144`를 확정할 때 이 면제를 목표로 삼는다.

### 3.2 Securities Act § 2(a)(11) — underwriter 정의 [uscode.house.gov]

**핵심 원문:** The term "underwriter" means any person who has purchased from an issuer with a view to, or offers or sells for an issuer in connection with, the distribution of any security, or participates or has a direct or indirect participation in any such undertaking, or participates or has a participation in the direct or indirect underwriting of any such undertaking; but such term shall not include a person whose interest is limited to a commission from an underwriter or dealer not in excess of the usual and customary distributors' or sellers' commission. As used in this paragraph the term "issuer" shall include, in addition to an issuer, any person directly or indirectly controlling or controlled by the issuer, or any person under direct or indirect common control with the issuer.

**한국어:** "underwriter"란, 증권의 배포(distribution)를 할 목적으로(with a view to) 발행자로부터 매수한 자, 또는 그러한 배포와 관련하여 발행자를 위하여 청약을 권유하거나 매도하는 자, 또는 그러한 사업에 직접·간접으로 참가하거나 참가지분을 가진 자, 또는 그러한 사업의 직접·간접 인수에 참가하거나 참가지분을 가진 모든 자를 뜻한다. 다만 그 이해관계가 인수인 또는 딜러로부터 받는, 통상적이고 관례적인 배급자 또는 판매자 수수료를 초과하지 아니하는 수수료에 한정되는 자는 이에 포함되지 아니한다. 본 항에서 "issuer"란, 발행자에 더하여, 발행자를 직접 또는 간접으로 지배하거나 발행자에 의하여 직접 또는 간접으로 지배되는 모든 자, 또는 발행자와 직접 또는 간접의 공동지배 하에 있는 모든 자를 포함한다.

**쉬운 설명:** 핵심은 딱 네 단어, **"with a view to"**(~할 목적으로)다. 이건 사람의 내심이라 거래 시점에 확인할 수가 없다. 그리고 마지막 문장이 조용히 무섭다 — 이 항에서 "issuer"에는 발행자의 지배자·피지배자·공동지배자가 **포함**된다. 그래서 "발행자의 계열(affiliate)로부터 산 사람"도 underwriter 판정 대상이 되고, 계열이 파는 물량(control securities)이 제한증권이 아니어도 Rule 144의 조건을 지게 된다.

**PASS/FAIL 반영:** 간접 ✕ — C-01이 판정하지 않는다. 다만 이 조문의 "확인 불가능성"이 보유기간 요건의 존재 이유이고, 마지막 문장의 issuer 확장이 A-06(계열 판정)이 필요한 이유다.

**ERC-3643 변환:** 온체인 구현 없음 — 배경 전제. 계열 확장은 A-06의 `isAffiliate` 판정으로 흡수된다.

### 3.3 Rule 144 Preliminary Note — safe harbor의 성격 [ecfr.gov]

**핵심 원문:** The Commission adopted Rule 144 to establish specific criteria for determining whether a person is not engaged in a distribution. Rule 144 creates a safe harbor from the Section 2(a)(11) definition of "underwriter." A person satisfying the applicable conditions of the Rule 144 safe harbor is deemed not to be engaged in a distribution of the securities and therefore not an underwriter of the securities for purposes of Section 2(a)(11). ... Rule 144 is not an exclusive safe harbor. A person who does not meet all of the applicable conditions of Rule 144 still may claim any other available exemption under the Act for the sale of the securities. The Rule 144 safe harbor is not available to any person with respect to any transaction or series of transactions that, although in technical compliance with Rule 144, is part of a plan or scheme to evade the registration requirements of the Act.

**한국어:** Commission은, 어떤 자가 배포에 종사하고 있지 아니한지를 판단하기 위한 구체적 기준을 정립하기 위하여 Rule 144를 채택하였다. Rule 144는 Section 2(a)(11)의 "underwriter" 정의에 대한 안전항(safe harbor)을 만든다. Rule 144 안전항의 적용 조건들을 충족하는 자는 그 증권의 배포에 종사하지 아니하는 것으로 간주되며, 따라서 Section 2(a)(11)의 목적상 그 증권의 underwriter가 아닌 것으로 간주된다. … Rule 144는 배타적 안전항이 아니다. Rule 144의 적용 조건 전부를 충족하지 못하는 자도 그 증권의 매도에 관하여 이 법상 이용 가능한 다른 면제를 주장할 수 있다. Rule 144 안전항은, Rule 144를 기술적으로 준수하고 있더라도 이 법의 등록 요건을 회피하려는 계획 또는 책략(plan or scheme to evade)의 일부인 거래 또는 일련의 거래에 관하여는 누구에게도 이용될 수 없다.

**쉬운 설명:** 세 문장이 세 가지를 못 박는다. ① Rule 144는 면제가 아니라 **간주**다 — "너는 underwriter가 아니다"라고 쳐 주는 것. ② **배타적이지 않다** — 못 맞춰도 다른 문(§4(a)(7) 등)이 있다. ③ **기술적 준수만으로는 부족하다** — 계산이 맞아도 회피 계획이면 무효. 세 번째 문장이 C-01의 겸손의 근거다.

**PASS/FAIL 반영:** 조건부 — 직접 게이트는 아니지만 **PASS의 의미를 한정**한다. C-01 PASS는 "(d) 충족"이지 "safe harbor 확정"이 아니다. 회피 계획 탐지는 A-12(반대정보)·F-02(시장행위 감시)·운영 검토의 몫이다.

**ERC-3643 변환:** 온체인 구현 없음. Compliance Log의 판정 기록에 `safeHarborScope = "144(d) only"`를 명시해, PASS가 종국 확정으로 오독되지 않게 한다.

### 3.4 Rule 144(a)(3) — restricted securities 정의 (시계가 걸리는 대상) [ecfr.gov]

**핵심 원문:** (3) The term *restricted securities* means: (i) Securities acquired directly or indirectly from the issuer, or from an affiliate of the issuer, in a transaction or chain of transactions not involving any public offering; (ii) Securities acquired from the issuer that are subject to the resale limitations of § 230.502(d) under Regulation D or § 230.701(c); (iii) Securities acquired in a transaction or chain of transactions meeting the requirements of § 230.144A; (iv) Securities acquired from the issuer in a transaction subject to the conditions of Regulation CE (§ 230.1001); (v) Equity securities of domestic issuers acquired in a transaction or chain of transactions subject to the conditions of § 230.901 or § 230.903 under Regulation S (§ 230.901 through § 230.905, and Preliminary Notes); (vi) Securities acquired in a transaction made under § 230.801 to the same extent and proportion that the securities held by the security holder of the class with respect to which the rights offering was made were, as of the record date for the rights offering, "restricted securities" within the meaning of this paragraph (a)(3); (vii) Securities acquired in a transaction made under § 230.802 to the same extent and proportion that the securities that were tendered or exchanged in the exchange offer or business combination were "restricted securities" within the meaning of this paragraph (a)(3); and (viii) Securities acquired from the issuer in a transaction subject to an exemption under section 4(5) (15 U.S.C. 77d(5)) of the Act.

**한국어:** (3) "restricted securities"란 다음을 뜻한다 — (i) 어떠한 공모도 수반하지 아니하는 거래 또는 일련의 거래에서 발행자로부터 또는 발행자의 계열(affiliate)로부터 직접 또는 간접으로 취득한 증권; (ii) Regulation D의 §230.502(d) 또는 §230.701(c)의 재판매 제한을 받는 것으로서 발행자로부터 취득한 증권; (iii) §230.144A의 요건을 충족하는 거래 또는 일련의 거래에서 취득한 증권; (iv) Regulation CE(§230.1001)의 조건을 받는 거래에서 발행자로부터 취득한 증권; (v) Regulation S(§230.901 내지 §230.905 및 Preliminary Notes)의 §230.901 또는 §230.903의 조건을 받는 거래 또는 일련의 거래에서 취득한, 국내 발행자의 지분증권(equity securities); (vi) §230.801에 따라 이루어진 거래에서 취득한 증권으로서, 그 권리공모(rights offering)가 이루어진 class의 증권보유자가 보유하던 증권이 그 권리공모의 기준일(record date) 현재 본 (a)(3)항의 의미상 "restricted securities"였던 것과 동일한 범위 및 비율에 한하는 것; (vii) §230.802에 따라 이루어진 거래에서 취득한 증권으로서, 그 교환공개매수 또는 사업결합에서 제공되거나 교환된 증권이 본 (a)(3)항의 의미상 "restricted securities"였던 것과 동일한 범위 및 비율에 한하는 것; 그리고 (viii) 이 법 section 4(5)(15 U.S.C. 77d(5))의 면제를 받는 거래에서 발행자로부터 취득한 증권.

**쉬운 설명:** 이 정의가 **C-01의 문지방**이다. Rule 144(d)의 첫 줄이 "If the securities sold are restricted securities"로 시작하므로, restricted가 아니면 (d)는 아예 적용되지 않는다. 우리 자산에 실제로 걸리는 것은 **(i)과 (ii)** 둘이다 — 506(c) 사모로 발행됐으니 (ii)(502(d) 재판매 제한), 그리고 공모 없는 취득 사슬이니 (i)이다. (i)의 "**chain of transactions**"(일련의 거래)와 "**indirectly**"(간접)에 주목하라 — 비계열 중간 보유자를 몇 번 거쳐도 원래 발행자로부터 나온 물량이면 restricted 지위가 따라다닌다. 이것이 §3.15에서 §4(a)(7) 재판매를 다룰 때 결정적으로 작동한다.

**PASS/FAIL 반영:** 직접 ○ — G1 게이트. `lot.restricted == false`면 (d) 부적용으로 **조기 PASS**한다. 단 restricted 여부의 *판정*은 B-03 소관이고, C-01은 그 플래그를 소비만 한다.

**ERC-3643 변환:** `lot.restricted` (bool) ← B-03의 transfer-restriction 메타. `lot.sourceType` ∈ 9종(§3.19) — 그중 SRC_ISSUER_PRIVATE = (a)(3)(i), SRC_REGD_506C = (a)(3)(ii), SRC_RULE144A = (a)(3)(iii). (iv)·(vi)·(vii)·(viii)은 현 자산군 해당 없음.

### 3.5 Rule 144(b)(1)(i)·(ii) — 비계열 매도인의 조건 [ecfr.gov]

**핵심 원문:** (b) *Conditions to be met.* Subject to paragraph (i) of this section, the following conditions must be met: (1) *Non-affiliates.* (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Securities Exchange Act of 1934 (the Exchange Act), any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of paragraphs (c)(1) and (d) of this section are met. The requirements of paragraph (c)(1) of this section shall not apply to restricted securities sold for the account of a person who is not an affiliate of the issuer at the time of the sale and has not been an affiliate during the preceding three months, provided a period of one year has elapsed since the later of the date the securities were acquired from the issuer or from an affiliate of the issuer. (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if the condition of paragraph (d) of this section is met.

**한국어:** (b) 충족되어야 할 조건. 본 조 (i)항의 적용을 받되, 다음 조건들이 충족되어야 한다 — (1) 비계열자. (i) 증권의 발행자가 매도 직전 최소 90일의 기간 동안 1934년 증권거래법(Exchange Act) section 13 또는 15(d)의 보고 요건의 적용을 받고 있고 또 받아 왔던 경우, 매도 시점에 발행자의 계열이 아니고 직전 3개월(preceding three months) 동안에도 계열이 아니었던 자로서 그 발행자의 제한증권을 자기 계산으로 매도하는 자는, 본 조 (c)(1)항 및 (d)항의 조건 **전부**가 충족되면 이 법 section 2(a)(11)의 의미상 그 증권의 underwriter가 아닌 것으로 간주된다. 본 조 (c)(1)항의 요건은, 증권이 발행자로부터 또는 발행자의 계열로부터 취득된 날 중 나중의 날로부터 1년의 기간이 경과한 경우, 매도 시점에 발행자의 계열이 아니고 직전 3개월 동안에도 계열이 아니었던 자의 계산으로 매도되는 제한증권에는 적용되지 아니한다. (ii) 증권의 발행자가 매도 직전 최소 90일의 기간 동안 Exchange Act section 13 또는 15(d)의 보고 요건의 적용을 받고 있지 아니하거나 받아 오지 아니한 경우, 매도 시점에 발행자의 계열이 아니고 직전 3개월 동안에도 계열이 아니었던 자로서 그 발행자의 제한증권을 자기 계산으로 매도하는 자는, 본 조 **(d)항의 조건**(the condition)이 충족되면 이 법 section 2(a)(11)의 의미상 그 증권의 underwriter가 아닌 것으로 간주된다.

**쉬운 설명:** (i)과 (ii)의 **문법 차이**를 놓치면 안 된다. (i)은 "all of the conditions of paragraphs (c)(1) and (d)"(복수), (ii)는 "the condition of paragraph (d)"(**단수**)라고 쓴다. 즉 비보고 발행자의 비계열 매도인에게는 **(d) 하나만** 요구된다. 그리고 (i)의 둘째 문장이 보고회사용 "1년 evergreen"이다 — 6개월이 지나면 (c)(1) 공시를 붙여서 팔 수 있고, 1년이 지나면 (c)(1)도 떨어진다. 즉 보고회사에는 **시계가 두 개**(6개월 = 매도 개시, 1년 = 공시 조건 해제)다.

**해설 — BUIDL-like에는 evergreen 시계가 없다.** 우리 발행자는 비보고이므로 (ii)만 탄다. (ii)에는 (c)(1) 자체가 없으니 "1년 후 (c)(1) 해제"라는 두 번째 시계도 없다. 결과적으로 **비보고 + 비계열 = 1년 하나만 세면 끝**이다. 다만 발행자가 장래에 보고회사가 되면 (i)로 갈아타며 두 시계가 생기고, 6개월~1년 구간에서 (c)(1)이 붙어 E-05가 활성화된다(§9.4 경우 3).

**PASS/FAIL 반영:** 직접 ○(간접적으로) — C-01은 (b)를 판정하지 않지만, (b)(1)(ii)의 단수형 문언이 "**C-01이 유일한 관문**"이라는 R2의 구조를 확정한다. Recipe 배선의 근거 조문이다.

**ERC-3643 변환:** `issuer.reportingStatus` ∈ {REPORTING, NON_REPORTING, UNKNOWN} (Manifest) · `seller.isAffiliate` ← A-06. Recipe는 (ii) 경로에서 C-01만 attach하고, (i) 경로에서 C-01 + E-05를 attach한다.

### 3.6 Rule 144(b)(2) — 계열 매도인은 전부 [ecfr.gov]

**핵심 원문:** (2) *Affiliates or persons selling on behalf of affiliates.* Any affiliate of the issuer, or any person who was an affiliate at any time during the 90 days immediately before the sale, who sells restricted securities, or any person who sells restricted or any other securities for the account of an affiliate of the issuer of such securities, or any person who sells restricted or any other securities for the account of a person who was an affiliate at any time during the 90 days immediately before the sale, shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of this section are met.

**한국어:** (2) 계열자 또는 계열자를 위하여 매도하는 자. 발행자의 계열, 또는 매도 직전 90일 중 어느 때라도 계열이었던 자로서 제한증권을 매도하는 자, 또는 그 증권 발행자의 계열의 계산으로 제한증권이나 그 밖의 증권을 매도하는 자, 또는 매도 직전 90일 중 어느 때라도 계열이었던 자의 계산으로 제한증권이나 그 밖의 증권을 매도하는 자는, **본 조의 조건 전부**(all of the conditions of this section)가 충족되면 이 법 section 2(a)(11)의 의미상 그 증권의 underwriter가 아닌 것으로 간주된다.

**쉬운 설명:** 계열이면 "본 조의 조건 전부"다 — (c) 공시, (d) 보유기간, (e) 물량, (f)(g) 방식, (h) Form 144. 여기서 다시 강조 — **(d)의 길이는 (b)(1)과 (b)(2)가 동일하다.** 계열이라고 1년이 2년이 되지 않는다. 계열에게 더해지는 것은 *병행 조건의 개수*이지 *시간*이 아니다.

**해설 — 90일 vs 3개월 비대칭 주의.** (b)(1)은 "preceding three months", (b)(2)는 "90 days immediately before the sale"이라고 다르게 쓴다. 두 표현을 하나의 숫자로 합치는 것이 이 규칙의 흔한 오구현이며, 그 해소는 **A-06** 소관이다(C-08 문서가 같은 지점을 OD로 남겨 두었다). C-01은 이 분기의 결과만 받는다.

**PASS/FAIL 반영:** 간접 ✕ — C-01 소관 아님. Recipe가 A-06 결과로 병행 부품을 붙일 뿐이며, C-01의 required·clockStart·비교식은 그대로다.

**ERC-3643 변환:** C-01 필드 없음. Recipe attach 규칙 — `if A06.isAffiliate → attach {C-01, E-05, C-08, C-09, E-06}` / `else if NON_REPORTING → attach {C-01}`.

### 3.7 Rule 144(d)(1)(i) — 6개월 (보고 발행자) [ecfr.gov]

**핵심 원문:** (d) *Holding period for restricted securities.* If the securities sold are restricted securities, the following provisions apply: (1) *General rule.* (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, a minimum of six months must elapse between the later of the date of the acquisition of the securities from the issuer, or from an affiliate of the issuer, and any resale of such securities in reliance on this section for the account of either the acquiror or any subsequent holder of those securities.

**한국어:** (d) 제한증권의 보유기간. 매도되는 증권이 제한증권인 경우, 다음 규정이 적용된다 — (1) 일반원칙. (i) 증권의 발행자가 매도 직전 최소 90일의 기간 동안 Exchange Act section 13 또는 15(d)의 보고 요건의 적용을 받고 있고 또 받아 왔던 경우, **발행자로부터 또는 발행자의 계열로부터 그 증권을 취득한 날 중 나중의 날**(the later of the date of the acquisition)과, 취득자 또는 그 증권의 후속 보유자 중 어느 쪽의 계산으로든 본 조에 의거하여 이루어지는 그 증권의 재판매 사이에, 최소 6개월이 경과하여야 한다.

**쉬운 설명:** 문장이 길지만 뼈대는 셋이다. ① **두 시점 사이의 간격**을 잰다 — 시작은 취득, 끝은 재판매. ② 시작점은 **발행자로부터 또는 계열로부터**" 취득한 날이다. 이 한정어가 tacking의 뿌리다 — 비계열끼리 주고받은 날짜는 여기 안 걸리므로 시계가 리셋되지 않는다. ③ "either the acquiror **or any subsequent holder**" — 시계는 사람이 아니라 **증권에 붙어 있다**. 물량이 손을 바꿔도(비계열 간) 같은 시계가 계속 돈다.

**해설 — "the later of"의 정확한 의미.** 이 구절은 흔히 "취득일과 완납일 중 나중"으로 오독된다. 아니다. 문언은 "**the later of the date of the acquisition of the securities from the issuer, or from an affiliate of the issuer**" — 즉 *발행자로부터의 취득일*과 *계열로부터의 취득일* 중 나중이다. 발행자 → 계열 → 나로 내려온 물량이면, 내가 계열에게서 받은 날(나중)이 기산점이다. 완납 요건은 별도로 (d)(1)(iii)이 얹는다. 두 규칙을 합치면 —

clockStart = max( 가장 최근의 issuer·affiliate로부터의 취득일 , paymentCompleteAt )

**PASS/FAIL 반영:** 직접 ○ — G5에서 `reportingStatus == REPORTING`이면 `required = 6개월`. 우리 자산군에서는 기본 발동하지 않는 갈래이나, 발행자 지위 변경 시 즉시 활성화된다(CFI 132.14, §3.17).

**ERC-3643 변환:** `required = P6M` · `reportingContinuityDays ≥ 90` 확인 필요. `lot.clockStart` (timestamp).

### 3.8 Rule 144(d)(1)(ii) — 1년 (비보고 발행자) ⭐ BUIDL-like 기본값 [ecfr.gov]

**핵심 원문:** (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, a minimum of one year must elapse between the later of the date of the acquisition of the securities from the issuer, or from an affiliate of the issuer, and any resale of such securities in reliance on this section for the account of either the acquiror or any subsequent holder of those securities.

**한국어:** (ii) 증권의 발행자가 매도 직전 최소 90일의 기간 동안 Exchange Act section 13 또는 15(d)의 보고 요건의 적용을 받고 있지 아니하거나 받아 오지 아니한 경우, 발행자로부터 또는 발행자의 계열로부터 그 증권을 취득한 날 중 나중의 날과, 취득자 또는 그 증권의 후속 보유자 중 어느 쪽의 계산으로든 본 조에 의거하여 이루어지는 그 증권의 재판매 사이에, **최소 1년**(a minimum of one year)이 경과하여야 한다.

**쉬운 설명:** (i)과 문장이 똑같고 두 군데만 다르다 — 앞의 "is, and has been"이 "is not, or has not been"으로, 뒤의 "six months"가 "one year"로. **BUIDL-like 토큰의 발행자는 Exchange Act 보고회사가 아니므로 여기 해당한다. 기본값은 1년이다.**

**해설 — "subject to"의 엄격한 의미 (CFI 132.09).** 발행자가 *자발적으로* Exchange Act 보고서를 제출하더라도 6개월이 되지 않는다. staff의 답은 이렇다 — "A voluntary filer is not 'subject to' Exchange Act Section 13 or 15(d) because it is not obligated to file Exchange Act reports pursuant to either of those provisions. Consequently, the one-year holding period requirement in Rule 144(d)(1)(ii) applies to the restricted securities of a voluntary filer."(CFI 132.09) 즉 **내는가가 아니라 낼 의무가 있는가**가 기준이다. Manifest의 `reportingStatus`는 이 구분을 반영해야 하며, "발행자가 웹사이트에 재무제표를 올린다" 같은 사실은 REPORTING으로 승격시키지 못한다.

**PASS/FAIL 반영:** 직접 ○ — **C-01의 기본 갈래.** G5에서 `reportingStatus == NON_REPORTING`이면 `required = 1년`. `UNKNOWN`이면 보수적으로 1년을 적용하되 REVIEW를 병기한다(§6.2).

**ERC-3643 변환:** `required = P1Y` (기본값) · `asset.reportingStatus = NON_REPORTING` (Manifest 선언, B-01이 정합 검증). Manifest에 `reportingObligationBasis` 필드를 두어 "자발적 제출 ≠ 의무"를 기록한다.

### 3.9 Rule 144(d)(1)(iii) — 완납 전에는 시계가 돌지 않는다 [ecfr.gov]

**핵심 원문:** (iii) If the acquiror takes the securities by purchase, the holding period shall not begin until the full purchase price or other consideration is paid or given by the person acquiring the securities from the issuer or from an affiliate of the issuer.

**한국어:** (iii) 취득자가 매수(purchase)로 그 증권을 취득하는 경우, 보유기간은 발행자로부터 또는 발행자의 계열로부터 그 증권을 취득하는 자에 의하여 **매수대금 전액 또는 그 밖의 대가가 지급되거나 제공될 때까지 개시되지 아니한다**.

**쉬운 설명:** "**shall not begin until**"(~까지 개시되지 아니한다) — 부정형이 중요하다. 이건 clockStart를 *뒤로 미루는* 규칙이지 *새로 세우는* 규칙이 아니다. 그래서 §3.7의 정식화와 결합해 `clockStart = max(취득일, paymentCompleteAt)`이 된다. 논리적 근거는 §1.3의 **경제적 위험**이다 — 돈을 다 내지 않았으면 아직 위험을 온전히 지지 않은 것이고, 그러면 시계를 돌릴 이유가 없다.

**해설 — 토큰 mint 시각을 clockStart로 쓰면 틀린다.** 이 조항과 CFI 132.07이 결합하면 결정적 구현 결론이 나온다. staff의 답 — "The holding period for restricted securities acquired pursuant to a subscription agreement begins at the time the agreement is accepted by the issuer, rather than the date it is signed by the purchaser or the date the shares are issued, assuming that the full purchase price has been paid."(CFI 132.07) 즉 기산점은 **발행자의 청약 승낙 시점**이며, "**the date the shares are issued**"(증권이 발행된 날)가 **아니다**. ERC-3643/T-REX의 `created` hook은 mint 시점만 잡으므로, 그것을 clockStart로 삼으면 법적 기산점보다 **늦게** 잡혀 과잉 차단이 되고(사용자 불이익), 반대로 승낙은 있었으나 완납이 늦은 사례에서는 **이르게** 잡혀 과소 차단이 된다(법적 사고). 이 불일치가 **Acquisition Registry(CR-3)를 별도로 두어야 하는 근본 이유**다(§8.3).

**PASS/FAIL 반영:** 직접 ○ — G4 게이트. `paymentCompleteAt`이 없거나 미래이면 `HP_PAYMENT_INCOMPLETE` (FAIL).

**ERC-3643 변환:** `lot.paymentCompleteAt` (timestamp, TA/Operator attestation) · `lot.acceptedAt` (issuer 승낙 시각) → `clockStart = max(acceptedAt, paymentCompleteAt)`. **`block.timestamp` of mint ≠ clockStart** — 별도 필드로 분리 보관하고 대사(reconciliation) 대상으로 둔다.

### 3.10 Rule 144(d)(2) — 약속어음·할부계약은 완납이 아니다 [ecfr.gov]

**핵심 원문:** (2) *Promissory notes, other obligations or installment contracts.* Giving the issuer or affiliate of the issuer from whom the securities were purchased a promissory note or other obligation to pay the purchase price, or entering into an installment purchase contract with such seller, shall not be deemed full payment of the purchase price unless the promissory note, obligation or contract: (i) Provides for full recourse against the purchaser of the securities; (ii) Is secured by collateral, other than the securities purchased, having a fair market value at least equal to the purchase price of the securities purchased; and (iii) Shall have been discharged by payment in full prior to the sale of the securities.

**한국어:** (2) 약속어음, 그 밖의 채무 또는 할부계약. 증권을 매수한 상대방인 발행자 또는 발행자의 계열에게 매수대금 지급을 위한 약속어음이나 그 밖의 채무를 제공하는 것, 또는 그 매도인과 할부매수계약을 체결하는 것은, 그 약속어음·채무 또는 계약이 다음을 충족하지 아니하는 한 매수대금의 완납으로 간주되지 아니한다 — (i) 증권 매수인에 대한 완전소구(full recourse)를 규정할 것; (ii) 매수한 증권 이외의 담보로서, 매수한 증권의 매수대금 이상의 공정시장가치(fair market value)를 갖는 담보에 의하여 담보될 것; 그리고 (iii) 증권의 매도 전에 전액 지급에 의하여 소멸되었을 것.

**쉬운 설명:** (d)(1)(iii)의 "완납"을 우회하는 전형적 수법 — "돈은 나중에 낼게, 대신 어음 줄게" — 을 막는 조항이다. 세 요건이 **누적**(AND)이며, 특히 (ii)가 날카롭다: 담보는 **매수한 증권 이외의**" 것이어야 한다. 자기가 산 증권을 담보로 잡는 자기금융 구조는 위험을 지지 않은 것과 같아서 인정되지 않는다. (iii)도 결정적이다 — **매도 전까지 전액 상환이 끝나 있어야** 하므로, 미상환 어음이 남은 채로는 아무리 오래 지나도 (d)를 충족할 수 없다.

**해설 — Decipher 범위.** 온체인 토큰의 1차 발행에서 어음·할부는 통상 쓰이지 않는다(BUIDL-like는 현금 결제). 그러나 조건부 완납이 개입한 lot이 존재할 가능성을 배제할 수 없어, `paymentInstrument` 필드로 명시 신고를 받고 `INSTALLMENT`·`NOTE`이면 자동 PASS를 주지 않고 REVIEW로 보낸다. 세 요건은 계약서 검토가 필요한 **비결정적 판단**이라 기계가 확정할 수 없다 — C-01이 순수 패턴 A에서 벗어나는 유일한 지점이다(§8.2).

**PASS/FAIL 반영:** 조건부 — `paymentInstrument ∈ {NOTE, INSTALLMENT}`이고 3요건 attestation이 없으면 `HP_NOTE_TERMS_UNVERIFIED` (REVIEW). 3요건 충족 attestation이 있으면 `paymentCompleteAt = 어음 소멸일`로 확정하고 G4를 통과시킨다.

**ERC-3643 변환:** `lot.paymentInstrument` ∈ {CASH, NOTE, INSTALLMENT} · `lot.noteTermsAttested` (bool, 3요건 AND) · `lot.noteDischargedAt` (timestamp). `noteDischargedAt > 매도 시점`이면 (iii) 위반 → FAIL.

### 3.11 Rule 144(d)(3)(i)~(iii) — 배당·전환·조건부 발행의 승계 [ecfr.gov]

(d)(3)은 "**Determination of holding period**"라는 표제 아래 열 개의 승계·기산 규칙을 둔다. 두문이 범위를 정한다 — "The following provisions shall apply for the purpose of determining the period securities have been held." 즉 (d)(1)이 *얼마나* 를 정하고, (d)(3)이 *언제부터* 를 정한다. 열 갈래를 셋으로 나눠 §3.11~§3.13에 싣는다.

**핵심 원문 (i):** *Stock dividends, splits and recapitalizations.* Securities acquired from the issuer as a dividend or pursuant to a stock split, reverse split or recapitalization shall be deemed to have been acquired at the same time as the securities on which the dividend or, if more than one, the initial dividend was paid, the securities involved in the split or reverse split, or the securities surrendered in connection with the recapitalization.

**한국어 (i):** 주식배당, 분할 및 자본재구성. 발행자로부터 배당으로, 또는 주식분할·역분할이나 자본재구성에 따라 취득한 증권은, 그 배당이 지급된 대상 증권(배당이 둘 이상이면 **최초의 배당**이 지급된 대상 증권), 분할 또는 역분할에 관련된 증권, 또는 자본재구성과 관련하여 제출된 증권과 **동일한 시점에 취득된 것으로 간주된다**.

**핵심 원문 (ii):** *Conversions and exchanges.* If the securities sold were acquired from the issuer solely in exchange for other securities of the same issuer, the newly acquired securities shall be deemed to have been acquired at the same time as the securities surrendered for conversion or exchange, even if the securities surrendered were not convertible or exchangeable by their terms.

**한국어 (ii):** 전환 및 교환. 매도되는 증권이 **오로지(solely)** 동일 발행자의 다른 증권과 교환하여 발행자로부터 취득된 것인 경우, 새로 취득된 증권은, 제출된 증권이 그 조건상 전환 또는 교환이 가능하지 아니하였더라도, 전환 또는 교환을 위하여 제출된 증권과 동일한 시점에 취득된 것으로 간주된다.

**핵심 원문 (iii):** *Contingent issuance of securities.* Securities acquired as a contingent payment of the purchase price of an equity interest in a business, or the assets of a business, sold to the issuer or an affiliate of the issuer shall be deemed to have been acquired at the time of such sale if the issuer or affiliate was then committed to issue the securities subject only to conditions other than the payment of further consideration for such securities. An agreement entered into in connection with any such purchase to remain in the employment of, or not to compete with, the issuer or affiliate or the rendering of services pursuant to such agreement shall not be deemed to be the payment of further consideration for such securities.

**한국어 (iii):** 조건부 증권 발행. 발행자 또는 발행자의 계열에게 매도된 사업의 지분 또는 사업의 자산에 대한 매매대금의 **조건부 지급**으로 취득한 증권은, 그 발행자 또는 계열이 그 당시 **그 증권에 대한 추가 대가의 지급 외의 조건만을 붙여** 그 증권을 발행할 의무를 부담하고 있었던 경우, 그 매도 시점에 취득된 것으로 간주된다. 그러한 매수와 관련하여 체결된, 발행자 또는 계열에 계속 고용되어 있겠다거나 경업하지 아니하겠다는 약정, 또는 그 약정에 따른 용역의 제공은, 그 증권에 대한 추가 대가의 지급으로 간주되지 아니한다.

**쉬운 설명:** 세 조항이 한 원리의 세 얼굴이다 — **경제적 위험이 새로 생기지 않았으면 시계도 새로 서지 않는다**(§1.3). ① 배당·분할로 받은 토큰은 새 돈을 넣은 게 아니라 원래 물량이 쪼개지거나 불어난 것뿐이니, 원본의 시계를 그대로 쓴다. ② 같은 발행자의 증권끼리 **오로지** 맞바꾼 것도 새 투자가 아니라 형태 변경이니 시계가 이어진다 — 조문이 "even if the securities surrendered were not convertible ... by their terms"라고 못 박아, *원래 전환권이 없던 증권을 나중에 합의로 바꾼 경우까지* 포섭한다. ③ 사업 매각 대금을 나중에 주식으로 받기로 한 earn-out은, 매각 시점에 이미 발행 의무가 확정돼 있었다면 매각일로 소급한다.

**해설 — ⭐ 배당 tacking은 BUIDL-like에서 상시 발생한다.** 이 조항이 우리 자산군에서 왜 결정적이냐면, BUIDL-like 국채 MMF 토큰의 수익 분배가 **현금이 아니라 토큰 추가 발행(배당 재투자)** 형태로 이뤄지는 것이 통상이기 때문이다. 매달 배당 토큰이 mint되는데, 그때마다 시계가 리셋된다면 **보유자는 영원히 1년을 채울 수 없다** — 매도 직전 달에 받은 배당분이 항상 미달이기 때문이다. (d)(3)(i)이 그 결과를 막는다. 배당분의 clockStart는 배당일이 아니라 **원본 lot의 clockStart를 승계**한다. 조문의 "if more than one, the initial dividend was paid"에 주의하라 — 배당이 12번 반복돼도 승계 기준은 **최초 배당의 대상 증권**이지, 직전 배당분이 아니다. 즉 승계 사슬은 언제나 **원본 lot 하나로 수렴**하며, 체인처럼 한 단씩 물려 올라가는 구조가 아니다. 구현상 이것이 중요한 이유는, 사슬을 단계별로 따라가면 O(n) 순회가 되지만 원본 직결이면 O(1) 참조이기 때문이다. `lot.lineageRef`는 **직전 부모가 아니라 원본 lot을 가리킨다**(§3.19).

**해설 — (d)(3)(ii) Note와 CFI 132.13의 대칭.** (ii)에는 Note가 달려 있다. "If the surrendered securities originally did not provide for cashless conversion or exchange by their terms and the holder provided consideration, other than solely securities of the same issuer, in connection with the amendment of the surrendered securities to permit cashless conversion or exchange, then the newly acquired securities shall be deemed to have been acquired at the same time as such amendment to the surrendered securities, so long as, in the conversion or exchange, the securities sold were acquired from the issuer solely in exchange for other securities of the same issuer." 즉 **돈을 얹어서 전환권을 새로 사면**, 승계 기준일이 원본이 아니라 **그 개정일**로 밀린다. 대가를 냈다는 것은 새 위험을 졌다는 뜻이고, 새 위험에는 새 시계가 붙는다. staff는 이 원리를 워런트 쪽에서 더 날카롭게 못 박았다 — "The payment of even a de minimis amount of cash upon a warrant exercise would preclude the holder from tacking the holding period of the common stock to the warrant under Rule 144(d)(3)(x)."(CFI 132.13) **단돈 1달러라도 현금이 들어가면 tacking이 끊긴다.** "solely"는 문언 그대로 순수 배타이며, 구현에서 임계값·허용오차를 두면 안 된다.

**PASS/FAIL 반영:** 직접 ○ — G3 분기. `sourceType == SRC_DIVIDEND`이면 `clockStart = lineageRef.clockStart` 승계. 승계가 성립하면 배당 lot은 원본과 **같은 날 취득된 것으로 취급**되어 G6 비교에 들어간다. `lineageRef`가 없거나 원본 lot이 Registry에 없으면 `HP_LINEAGE_BROKEN` (REVIEW).

**ERC-3643 변환:** `lot.sourceType = SRC_DIVIDEND` · `lot.lineageRef` (원본 lotId — 직전 부모 아님) · `lot.considerationPaid` (bool). `considerationPaid == true`이면 승계 차단하고 `clockStart = 자기 취득일`로 재기산한다((d)(3)(ii) Note·CFI 132.13). 배당 mint는 ERC-3643의 `mint` 경로를 타므로 **compliance module bypass 위험 구간**이다 — 배당 mint 시 Acquisition Registry에 `lineageRef`를 함께 기록하지 않으면 그 lot은 영구히 REVIEW로 떨어진다(§12 OD-C01-3).

### 3.12 Rule 144(d)(3)(iv)~(vii) — 질권·증여·신탁·유산 [ecfr.gov]

**핵심 원문 (iv):** *Pledged securities.* Securities which are bona-fide pledged by an affiliate of the issuer when sold by the pledgee, or by a purchaser, after a default in the obligation secured by the pledge, shall be deemed to have been acquired when they were acquired by the pledgor, except that if the securities were pledged without recourse they shall be deemed to have been acquired by the pledgee at the time of the pledge or by the purchaser at the time of purchase.

**한국어 (iv):** 질권 설정 증권. 발행자의 계열이 **진정하게(bona-fide)** 질권을 설정한 증권으로서 질권자에 의하여 또는 매수인에 의하여 그 질권으로 담보된 채무의 불이행(default) 후에 매도되는 것은, **질권설정자(pledgor)가 취득한 때에** 취득된 것으로 간주된다. 다만 그 증권이 **무소구(without recourse)** 로 질권 설정된 경우에는, 질권자가 질권 설정 시점에, 또는 매수인이 매수 시점에 취득한 것으로 간주된다.

**핵심 원문 (v):** *Gifts of securities.* Securities acquired from an affiliate of the issuer by gift shall be deemed to have been acquired by the donee when they were acquired by the donor.

**한국어 (v):** 증권의 증여. 발행자의 계열로부터 증여로 취득한 증권은, **증여자(donor)가 취득한 때에** 수증자(donee)가 취득한 것으로 간주된다.

**핵심 원문 (vi):** *Trusts.* Where a trust settlor is an affiliate of the issuer, securities acquired from the settlor by the trust, or acquired from the trust by the beneficiaries thereof, shall be deemed to have been acquired when such securities were acquired by the settlor.

**한국어 (vi):** 신탁. 신탁의 위탁자(settlor)가 발행자의 계열인 경우, 그 위탁자로부터 신탁이 취득한 증권, 또는 그 신탁으로부터 수익자가 취득한 증권은, **그 위탁자가 그 증권을 취득한 때에** 취득된 것으로 간주된다.

**핵심 원문 (vii):** *Estates.* Where a deceased person was an affiliate of the issuer, securities held by the estate of such person or acquired from such estate by the estate beneficiaries shall be deemed to have been acquired when they were acquired by the deceased person, except that no holding period is required if the estate is not an affiliate of the issuer or if the securities are sold by a beneficiary of the estate who is not such an affiliate.

**한국어 (vii):** 유산. 사망자가 발행자의 계열이었던 경우, 그 자의 유산(estate)이 보유하는 증권 또는 그 유산으로부터 유산 수익자가 취득한 증권은, 그 사망자가 취득한 때에 취득된 것으로 간주된다. **다만 그 유산이 발행자의 계열이 아니거나 그 증권이 그러한 계열이 아닌 유산 수익자에 의하여 매도되는 경우에는 보유기간이 요구되지 아니한다.**

**쉬운 설명:** 네 조항 모두 **계열의 손에서 나온 물량**"을 다룬다 — 조문의 주어가 전부 `an affiliate of the issuer`·`a trust settlor is an affiliate`·`a deceased person was an affiliate`다. 계열이 질권·증여·신탁·상속으로 물량을 넘겨도 시계는 리셋되지 않고 **원래 주인의 시계를 그대로 물려준다**. 이유는 명백하다 — 리셋된다면 계열이 배우자에게 증여하는 것만으로 보유기간이 새로 시작되는 게 아니라 *끝나* 버리는 우회로가 생기기 때문이다. 실은 반대 방향의 우회를 막는 조항이다.


[output truncated at 50000 of 144390 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007775
- Available tabs:
  • tabId 437007716: "(1) 7/15 | Notion" (https://app.notion.com/p/deciphersnu/7-15-3a0dff004c8980fe857bd4158b970eab)
  • tabId 437007775: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_보유기간.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_보유기간.md" (
