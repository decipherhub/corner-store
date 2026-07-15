# ELE.A-13_qualified-purchaser

# A-13 Qualified Purchaser — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 Qualified Purchaser 부품(내부 식별자 A-13)을, 미국 펀드 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC·판례 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-06-22).** 본 부품의 미국 증권법 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §80a-2(a)(51)·§80a-3(c)(7)은 uscode.house.gov 현행본, 17 CFR §270.2a51-1·2a51-2·2a51-3·3c-1·3c-5·3c-6은 eCFR 현행본(Title 17), JOBS Act §201(b)(2)(Pub. L. 112-106)와 판례는 govinfo.gov(U.S. Reports / U.S. Courts Opinions / Public Laws), SEC Release IC-22597(62 FR 17512, 1997-04-09)·관련 No-Action Letter·C&DI는 sec.gov다. 제정법 출처는 uscode.house.gov로 통일했으며, govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다.

> **테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, transfer architecture, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링하여, QP-based pre-trade transfer restriction을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"이 매수인이 BlackRock BUIDL 같은 펀드 토큰을 살 자격이 있는가"를* 거래 직전에 판정한다. 그런데 "자격"의 기준인 Qualified Purchaser(QP)는 미국 펀드 규제의 깊은 곳에서 나온 개념이라, 조문만 들이밀면 왜 이런 기준이 있는지 알 수 없다. 그래서 큰 그림(미국 증권법의 구조 → 이 규제가 생긴 역사 → 우리 시스템에서의 의미 → 한국법과의 비교)을 먼저 깐다.

### 1.1 미국 증권법의 4개 기둥(4 Pillar)과 그중 ICA 1940의 자리

미국 연방 증권규제는 한국처럼 하나의 「자본시장법」으로 통합돼 있지 않고, 시대별로 따로 만들어진 4개의 큰 법률이 각자 다른 국면을 맡는다. 쉽게 말하면 한국은 증권 관련 규제가 한 건물 안의 여러 부서라면, 미국은 길 건너 따로 선 4개의 건물이다.

| 기둥(법률) | 맡는 국면 | 핵심 관심사 | 한국법 대응(직관용) |
|---|---|---|---|
| Securities Act of 1933(1933년법) | 증권의 발행(1차 시장) | "팔기 전에 등록·공시했는가" | 자본시장법 증권신고서·공모 규제 |
| Securities Exchange Act of 1934(1934년법) | 증권의 유통·거래소·중개업자(2차 시장) | "거래소·broker-dealer·계속공시" | 자본시장법 유통시장·금융투자업·거래소 규정 |
| Investment Company Act of 1940(ICA, 투자회사법) | 집합투자기구(펀드) 자체의 규율 | "펀드 구조가 투자자를 착취하지 않는가" | 자본시장법 집합투자(펀드) 규제 |
| Investment Advisers Act of 1940(투자자문업자법) | 투자자문업자(adviser) | "남의 돈을 굴려주는 자의 신인의무" | 자본시장법 투자자문·일임업 |

본 부품(Qualified Purchaser 부품)은 세 번째 기둥, 즉 ICA 1940의 영역에서 나온다. 이 점이 중요하다. A-13은 "증권을 발행할 때 등록했는가"(1933년법)나 "거래소·중개업자 등록을 했는가"(1934년법)를 보는 부품이 아니다. 그것들은 완전히 별개의 법체계(legal regime)이고, Decipher에서는 다른 Recipe·다른 부품이 맡는다. A-13이 답하는 질문은 오직 하나다 — "이 펀드의 지분을 사려는 사람이, ICA가 요구하는 투자자 자격을 갖췄는가."

**쉽게 말하면:** 같은 토큰 한 건의 거래라도 미국법은 세 군데의 다른 관문을 통과시킨다. (1) 발행이 적법했나(1933년법), (2) 거래 경로·중개가 적법한가(1934년법), (3) 그리고 — 그 토큰이 펀드 지분이라면 — 펀드가 등록 면제를 유지할 수 있는 투자자에게만 가는가(ICA 1940). A-13은 세 번째 관문의 핵심 검사원이다.

### 1.2 왜 이 규제가 존재하는가 — 대공황과 investment trust 스캔들

ICA 1940은 진공에서 태어난 법이 아니다. 1929년 대공황의 직접적 산물이다.

쉽게 말하면 이렇다. 1920년대 미국에는 investment trust(오늘날의 펀드 조상)가 우후죽순 생겼다. 일반 대중의 돈을 모아 주식·채권에 굴리는 구조였는데, 당시엔 규제가 거의 없었다. 그 결과 1929년 붕괴 전후로 전형적인 병폐가 드러났다 — 운용자가 자기 잇속을 챙기는 self-dealing(자기거래), 빚으로 빚을 쌓아 위험을 키우는 excessive leverage·pyramiding(과도한 차입·피라미드 구조), 운용자와 투자자 이익이 부딪히는 conflicts of interest(이해상충), 투자자가 펀드 안을 들여다볼 수 없는 **opaque governance(불투명한 지배구조)가** 그것이다.

의회(Congress)의 결론은 *"펀드라는 구조 그 자체가 일반 투자자에게 독특한 위험(unique risk)을 안긴다"는* 것이었다. 그래서 ICA 1940은 등록 펀드에 대단히 엄격한 규율을 건다 — SEC 등록, 자산의 분리보관(custody), 독립이사 중심 governance, 차입(leverage) 한도, 이해관계자 거래(affiliate transaction) 제한 등.

여기서 면제(exemption)의 필요가 생긴다. hedge fund·venture capital·private equity처럼 세련된 투자자(sophisticated investor)만 상대하는 펀드에까지 이 엄격한 규율을 강제하는 것은 과잉이다. 그래서 ICA §3(c)에 여러 면제 통로가 마련됐다. 그중 두 개가 핵심이다.

| 면제 통로 | 투자자 수 제한 | 투자자 자격 조건 |
|---|---|---|
| §3(c)(1)(1940년 제정) | beneficial owner 100인 이하 | 특별한 자격 요건 없음 |
| §3(c)(7)(1996년 NSMIA 신설) | 인원수 cap 없음(실무상 후술) | 모두 Qualified Purchaser |

§3(c)(7)은 1996년 NSMIA(National Securities Markets Improvement Act, 전국증권시장개선법)로 신설됐다. 핵심 거래(trade-off)는 이렇다 — "투자자 머릿수 100인 cap을 풀어주는 대신, 한 명 한 명이 모두 QP여야 한다." 즉 양(머릿수)을 풀고 질(자격)을 높인 것이다. (다만 펀드가 실제로 투자자 수를 무한정 늘리지는 못한다. 1934년법 §12(g)의 등록 트리거 — 통상 record holder 2,000인(JOBS Act가 종전 500인에서 상향) — 때문에, §3(c)(7) 펀드도 실무상 2,000인 미만으로 관리한다. 이건 ICA가 아니라 1934년법에서 오는 별개의 제약이다.)

**두 개의 다른 축 — 증권법(AI)과 투자회사법(QP).** BUIDL 같은 토큰은 서로 다른 두 법의 자격을 *둘 다* 통과해야 한다. **① 증권법 축 = Accredited Investor(AI).** 1933년법 Reg D Rule 506(c)는 *issuer의 발행(offering·sale)* 면제 구조로, 이를 쓰면 모든 purchaser가 AI여야 하고 issuer가 reasonable steps to verify를 취해야 한다(그 자체는 2차 재판매 통로가 아니며, 재판매는 §4(a)(7)·Rule 144 등 별도 resale exemption 소관 — §1.3). **② 투자회사법 축 = Qualified Purchaser(QP).** §3(c)(7) 펀드 면제를 유지하려면 보유하는 모든 사람이 취득 시점에 QP여야 한다. 주의 — 이 둘은 "1차=AI, 2차=QP"처럼 단계로 갈리는 게 아니다. 증권법(AI)은 발행이든 재판매든 거래마다, 투자회사법(QP)은 거래 시점과 무관하게 항상 걸린다(두 법이 무엇을 등록시키는지가 달라서다 — §1.3에서 상술). QP는 AI보다 훨씬 높은 문턱이라 AI를 통과했다고 QP가 되는 게 아니다(역도 성립 안 함).

| 자격 | 근거 법 | 대략의 기준 | 쓰이는 곳 | Decipher 부품 |
|---|---|---|---|---|
| Accredited Investor (AI) | 1933년법 506(c)(발행)·§4(a)(7)(재판매) | 순자산 $1M(주거주택 제외) 또는 소득 $200K/$300K | 발행 면제(506(c)) · §4(a)(7) 재판매 면제 | A-03 |
| Qualified Purchaser (QP) | ICA §3(c)(7) | 투자자산(investments) $5M / $25M | 펀드 등록 면제(1940법, 상시) | A-13(본 부품) |

기준 자체도 다르다 — AI는 **순자산·소득**(net worth/income)으로 보고, QP는 **투자자산**(investments)으로 본다. 그래서 A-03(AI 검사)과 A-13(QP 검사)은 다른 데이터로 다른 문턱을 따지는 별개의 부품이고, 둘을 혼동해 "A-03을 통과했으니 A-13도 통과"로 처리하면 치명적 오작동이 된다.

오늘날 토큰화된 RWA 펀드(BlackRock BUIDL, Ondo, Securitize 발행물 등) 대부분이 바로 이 §3(c)(7) 통로를 쓴다. 그래서 A-13은 학술적 부품이 아니라, 이런 토큰(본 프로젝트에선 BUIDL-like §3(c)(7) 테스트 토큰)을 거래소에 올리는 순간 작동해야 하는 부품이다.

### 1.3 증권 등록 vs 펀드 등록 — 나란히 작동하는 두 축

AI와 QP가 헷갈리는 뿌리는, 둘이 **서로 다른 두 법이고 등록시키는 "대상"이 다르다**는 데 있다. 하나는 거래(행위)를 등록시키고, 하나는 회사(주체)를 등록시킨다.

**증권 등록(1933 증권법).** 등록 대상은 **증권을 파는 행위**(offering·sale)다. "이 증권을 공시(prospectus) 없이 팔아도 되나?"를 묻는다. 보호 방식은 사는 사람에게 정보를 주는 것이고, 거래마다 따진다(발행 한 번, 재판매 한 번). 공모면 등록(증권신고서), 사모면 면제 — Rule 506(c)는 매수인이 전부 AI면 일반청약하며 팔아도 된다고 면제해 준다(AI는 스스로 보호할 수 있어 공시가 덜 필요).

**발행 면제와 2차 재판매의 구분 (중요).** Rule 506(c)는 *issuer의 offering·sale* 면제(§4(a)(2) safe harbor)일 뿐, 일반적인 2차 재판매 통로가 아니다. 2차 재판매는 어떤 resale exemption을 쓰느냐에 따라 buyer-side AI 요건의 무게가 달라진다 — **§4(a)(7)**을 쓰면 buyer가 AI인지가 직접 요건이지만, **Rule 144**를 쓰면 핵심은 seller-side 요건(restricted securities holding period 6개월/1년, affiliate 여부, manner of sale, volume)이다. A-13은 이 Securities Act 축과 **별개로**, ICA §3(c)(7) fund status 유지를 위해 *buyer가 QP인지*를 본다.

**펀드 등록(1940 투자회사법).** 등록 대상은 **펀드라는 회사**(투자회사) 그 자체다. "이 펀드가 뮤추얼펀드처럼 SEC에 등록해 ICA 운영 규제(자산 보관·지배구조·레버리지·수수료 제한)를 받아야 하나?"를 묻는다. 보호 방식은 펀드 운영 전반을 감독하는 것이고, 거래가 아니라 기구의 상시 status다(계속 유지돼야 함). §3(c)(7)은 투자자가 전부 QP면 이 등록·규제를 면제해 준다(QP는 부유·정교해 그 보호가 불필요).

| | 증권 등록(1933법) | 펀드 등록(1940법) |
|---|---|---|
| 등록 대상 | 증권의 offering·sale = 거래·행위 | 펀드 = 투자회사 = 회사·주체 |
| 묻는 질문 | "공시 없이 팔아도 되나?" | "투자회사로 등록·감독받아야 하나?" |
| 보호 방식 | 매수인에게 공시(prospectus) | 펀드 운영 전반 SEC 감독 |
| 단위 | 발행·재판매 매 거래마다 | 기구의 상시 status(계속) |
| 면제 통로 | §4(a)(2) · 506(c) | §3(c)(1) · §3(c)(7) |
| 면제 투자자 요건 | Accredited Investor (AI) | Qualified Purchaser (QP) |
| 언제 작동 | 1차 발행 + 2차 재판매(거래마다) | 발행·보유·2차 내내 항상 |

**BUIDL이 둘 다 걸리는 이유.** BUIDL은 (a) *팔리는 증권*이면서 동시에 (b) *자산을 굴리는 펀드*다. 그러니 증권법(파는 행위)과 투자회사법(펀드라는 회사)이 둘 다 적용되고, 증권법 면제엔 AI·펀드 면제엔 QP라는 서로 다른 두 자격을 둘 다 통과해야 한다. "1차=증권법, 2차=투자회사법"이 아니라 나란히 작동하는 다른 축이다 — 증권법은 거래라서 1차에도 2차 재판매에도 매번 면제(AI)가 필요하고, 투자회사법은 회사 status라서 거래 시점과 무관하게 항상 유지돼야 한다(QP). QP가 1·2차 내내 끊기면 안 되는 것도, "QP판 Rule 144"가 없는 것도 이 때문이다 — Rule 144는 거래(재판매) 면제일 뿐 회사 status 요건을 풀어주지 않는다.

**파는 건 회사인데 왜 요건이 매수인에게 걸리나.** 두 법의 보호 대상은 **투자자**(사는 사람)이지 파는 회사가 아니다. "이 거래에서 등록·공시라는 보호장치를 빼줘도 되나?"를 판단하려면, 사는 사람이 그 보호 없이도 스스로를 지킬 수 있는 부류인지를 봐야 한다 — 그래서 요건이 매수인에게 걸린다. 일반 개인에게 팔면 정보·협상력이 부족해 면제 불가, AI/QP에게만 팔면 스스로 실사·협상이 가능해 면제 가능. 즉 "누가 파느냐"가 아니라 "누가 사느냐"가 위험을 결정한다.

다만 요건의 *대상*은 매수인이어도, 그걸 지키고 증명할 *책임*은 파는 회사(와 그 대리인)에게 있다. 506(c)의 "reasonable steps to verify", §3(c)(7)의 reasonable belief가 그것이다 — 비적격자에게 팔면 면제가 깨지고 회사가 책임진다. 그래서 Decipher에서는 **Trusted Issuer가 매수인 자격을 오프체인에서 검증**하고 claim에 서명한다. 한 줄로: 요건은 "사는 사람의 자질"에 걸리지만, 그 자질을 확인할 책임은 "파는 회사"가 진다. (투자회사법 §3(c)(7)은 한 겹 더 무겁다 — 펀드 회사의 면제 status가 "보유자 전원 QP"에 묶여 있어 한 명이라도 비-QP가 들어오면 회사 전체 면제가 깨진다. 그래서 매수인 자격이 1회성 발행 심사로 끝나지 않고 2차 거래까지 상시 유지돼야 한다.)

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk

이제 우리 시스템으로 내려오자. BlackRock BUIDL이 Decipher DEX에 listing된다고 하자. BUIDL은 §3(c)(7) 면제에 기대어 투자회사 등록을 피하고 있다. §3(c)(7)의 핵심 요건을 다시 보면 — 펀드의 **모든 outstanding securities(발행된 전체 지분)가**, 취득 시점(at the time of acquisition)에 Qualified Purchaser인 자에 의해 배타적으로(exclusively) 소유되어야 한다.

여기서 "exclusively"가 핵심이다. **QP claim 없이 non-QP가 취득하거나, 펀드(또는 그 대리인)가 reasonable belief를 뒷받침할 검증 없이 이전을 허용하면**, 그 펀드는 "QP에게만 배타적으로 소유된다"는 조건이 훼손될 중대한 위험에 놓인다. (Rule 2a51-1(h)의 reasonable belief 안전항 — Relying Person이 검증에 근거해 합리적으로 QP라 믿었다면 사후에 실제로는 비-QP였음이 드러나도 곧바로 자동 붕괴하지는 않는다 — 이 완충을 제공한다. 그러나 그 검증 없이 비-QP가 유입되면 아래 경로가 현실이 된다.) 검증 실패 시 최악의 경로는 단계적이다.

```
검증(reasonable belief) 없이 non-QP가 BUIDL 매수
  → §3(c)(7) "exclusively QP" 조건 위반
  → BUIDL의 §3(c)(7) 면제 status 상실
  → BUIDL이 "미등록 투자회사(unregistered investment company)"로 전락
  → ICA 위반 상태에서 운영 → 등록 의무(수개월·막대한 비용) 또는 거래 정지·강제 unwind
  → SEC enforcement · 계약 집행가능성(unenforceability) · 상업적 unwind · issuer/sponsor 계약 책임
```

위 마지막 줄들이 이 위험에 실질적 강제력을 부여한다 — 다만 그 강제력의 **경로는 2026년에 바뀌었다.** 과거 *Oxford Univ. Bank v. Lansuppe Feeder*, 933 F.3d 99 (2d Cir. 2019)에서 제2연방항소법원은 ICA §47(b)가 묵시적 사적 소권(implied private right of action)을 만들어 위반 계약 당사자가 rescission을 청구할 수 있다고 보았다. 그러나 **2026년 연방대법원의 *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*, 608 U.S. ___ (No. 24-345, 2026-06-11, 6-3, Barrett 집필)는 이를 번복**했다 — §47(b)는 private parties에게 독립적 rescission 소송권을 **부여하지 않으며**, 그 'at the instance of any party' 문구는 이미 법원 앞에 온 사건에서 법원의 remedial authority를 지시하는 것일 뿐이고 ICA는 SEC를 primary enforcer로 둔다(1980년 개정이 TAMA가 의존한 'shall be void' 문구를 삭제한 점이 근거). **따라서 '투자자가 §47(b)만으로 직접 rescission 소송을 제기할 수 있다'고 설명하면 현재 법리에 맞지 않는다.** non-QP 유입 리스크는 여전히 중대하지만, 그 실질 강제력은 §47(b) 사적 소권이 아니라 **미등록 투자회사 운영·SEC enforcement·계약 집행가능성(unenforceability)·상업적 unwind·issuer/fund sponsor의 계약상 책임**에서 나온다. (FS Credit은 §3(c)(7) 자체를 다툰 사건은 아니나, §47(b) 사적 소권을 부정한 지배적 선례로 인용한다.)

그래서 DEX의 거래 직전 관문(pre-trade gate)에서 모든 prospective buyer의 QP 자격을 확인하는 일은 "있으면 좋은" 기능이 아니라 BUIDL listing의 존립을 좌우하는(existential) 안전장치다. 업계 선례(Securitize·tZERO·INX)에서도 엄격한 pre-trade QP gating이 사실상 industry standard로 자리잡았다. A-13은 그 관문의 매수인 측 핵심 검사원이다.

**쉽게 말하면:** A-13이 실수로 non-QP를 한 명 통과시키면, 잘못되는 것은 그 거래 하나가 아니라 펀드 전체다. 그래서 이 부품의 설계 철학은 시종 "보수적으로, 의심스러우면 막거나 사람에게 넘긴다"이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"Qualified Purchaser 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | Qualified Purchaser | 펀드 매수 자격 검사원 |
| 검사 대상 | ICA §3(c)(7) fund 매수 자격 — QP가 되는 5길(§2(a)(51)(A)(i)~(iv) + Rule 2a51-1(g)(1) QIB 간주)과 '안 세는 예외'(Rule 3c-5 KE 제외 · Rule 3c-6 비자발적 이전) | "이 사람이 펀드를 살 자격이 있나" |
| Internal ID | A-13 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 증명서형(off-chain due diligence + on-chain claim 확인) | 기계가 직접 계산하지 않고, 신뢰기관의 서명 증명서를 확인 |
| Timing | pre-trade(거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | STATELESS (Element 한정) | Element 자체는 매수 시점 claim 스냅샷만 본다. 다만 §3(c)(7) status는 holder composition·forced transfer/recovery 예외·Exchange Act §12(g) holder-count 등 stateful 정보에 걸려 있어, Recipe·Manifest·Operator layer가 이를 별도 관리한다 |
| 주 활성화 Recipe | R3(ICA §3(c)(7) Fund) | 이 레시피가 본 부품을 부른다 |
| Cumulative Recipe | R1(Reg D 506(c) Issuance)·R2(§4(a)(7) Resale) | 함께 켜질 수 있는 레시피 |
| Cascade Element | A-09(Look-Through)·A-06(Affiliate)·A-11(Claim Freshness) | 본 부품이 추가로 호출하는 검사 부품 |
| 성숙도 | 🟡 R-1 단계(🔴 데모 핵심) | 데모에 필수, 후속 보완 진행 중 |
| 파일·위치 | A-13_qualified-purchaser.md · 산출물/elements/ | 산출물 경로 |

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

> **읽는 법.** 법적 근거는 세 겹이다 — **Layer 1**(조문)은 의회가 만든 법률 텍스트(statute), **Layer 2**(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), **Layer 3**(해석)은 판례·SEC 발행문서·No-Action Letter가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff·Case = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1~§3.20 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 위 세 Layer의 조문·규칙이 QP/§3(c)(7) 판정에서 어떻게 연결되는지를 하나의 큰 흐름으로 정리한 것이다 — 거래 발생 → 매수인 6갈래 분기((i)~(iv)+QIB, KE 제외) → 회사·신탁이면 급조/비-급조 look-through 분기(요건은 회사 Rule 2a51-3 (a)/(b)·신탁 statute (iii), beneficial owner 산정은 §3(c)(1)·3c-1·2a51-2) → "Investments" 산정 → reasonable belief → 전원 QP 판정 → §3(c)(7) 두 조건의 통과/탈락. 각 조항의 상세는 §3.1~§3.20(특히 6갈래는 §3.1.1, 회사 look-through는 §3.16.1).

![그림 3.0 — QP/§3(c)(7) 법조문 관계 흐름: 거래에서 조항, QP 판정, §3(c)(7) PASS/FAIL까지 (개발자용)](fig/fig30.png)

**범례.**

- 파랑 = 핵심(Direct: §3(c)(7)·§2(a)(51)(A)·Rule 2a51-1 본체·(h) 안전항)
- 회색 = 분기·판정 노드
- 초록 = PASS·예외 카브아웃(KE 제외·비자발적 이전 Rule 3c-6·506(c) 청약 JOBS Act §201(b)(2) 등 판정을 깨지 않는 경로)
- 빨강 = FAIL
- 주황 = 전환·참고(§3(c)(7)(B) grandfather·Exchange Act §12(g) 2000-holder)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

§3.0이 일반 법조문 흐름이라면, 이 절은 BUIDL-*like* §3(c)(7) 펀드 지분에 A-13이 어떻게 걸리는지를 보여준다. **(재확인) 본 서술은 실제 BlackRock BUIDL의 발행 표준·transfer architecture·현재 운영 조건을 단정하지 않는다 — BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링한 것이다.**

**BUIDL이 무엇인가.** BUIDL(BlackRock USD Institutional Digital Liquidity Fund)은 BlackRock이 2024년 3월 출시한 토큰화 머니마켓펀드다 — 현금·미국 단기국채·repo에 투자하고 토큰 1개 = $1 안정가치를 목표로, 배당을 매일 적립해 매월 분배한다(세계 최대급 토큰화 국채 펀드, AUM 약 $2.5B, 다중 체인). 운용은 BlackRock, 수탁·관리는 BNY Mellon, 토큰화·transfer agent·placement는 Securitize가 맡는다. 발행은 Rule 506(c), 펀드 구조는 ICA §3(c)(7), 미국 밖 투자자는 Reg S(BVI 역외 펀드)이며, 최소 청약 $5M, 토큰은 Securitize whitelist 안에서만 이전된다. 현실의 BUIDL은 Securitize 자체 표준(DS Protocol)이지만, 본 프로젝트는 BUIDL이 ERC-3643(T-REX)으로 재구성됐다고 가정한다 — 그 경우 **Securitize가 QP claim의 Trusted Issuer**가 된다.

**QP 관점 — 어느 갈래가 실제 쓰이나.** §3(c)(7) 펀드이므로 보유하는 모든 사람이 취득 시점에 QP여야 하고, 따라서 §3(c)(7)이 적용되는 한 A-13(QP 검사)은 항상 켜진다(R3의 주 검사). 다만 6갈래가 다 같은 빈도로 쓰이는 건 아니다 — BUIDL의 전형적 매수인은 **(iv) $25M any person**(운용사·기관·SPV)과 **QIB 간주**, 그리고 거액 자산가인 **(i) 자연인 $5M**이다. 가족회사(ii)·신탁(iii)·KE 제외(Rule 3c-5)도 구조상 가능하나 BUIDL 맥락에서 전형적이지는 않다.

**같은 $5M, 다른 개념 주의.** BUIDL 청약 최소액 $5M은 BlackRock이 정한 발행 조건(변경 가능)이고, QP 자격의 investments $5M은 법정 요건(§2(a)(51)(A)(i))이다 — 한 투자자에게 둘 다 요구되지만 서로 다른 요건이다. 청약 $5M을 냈다고 QP의 investments $5M(주거주택 등을 제외하는 별도 정의, Rule 2a51-1)이 자동 충족되는 게 아니다.

**검증은 누가 — Securitize = Trusted Issuer, A-13은 claim만 확인.** ERC-3643 가정 하에서 Securitize가 off-chain에서 KYC·QP 실사를 하고 "이 사람 QP 맞음" claim을 서명·발급한다(Rule 2a51-1(h) reasonable belief). 온체인 A-13은 그 계산을 다시 하지 않고 claim의 존재·진위·신선도·갈래만 확인한다(§8). BUIDL 케이스에서 claim의 핵심 필드는 fundExemption = ICA_3C7, coveredCompany = BUIDL fundId, 매수인별 claim.basis(대개 QP_INSTITUTIONAL 또는 QP_QIB)다. 매수인이 법인이면 A-08(법인 자격)·A-09(look-through)가 cascade로 함께 돈다.

![그림 3.0.1 — BUIDL 실제 적용: 발행(QP 게이트 상시 on)은 명확, 2차 거래의 공모 유발 여부는 미결](fig/fig301.png)

**2차 거래는 아직 미결(Condition 2).** BUIDL의 2차 거래는 whitelist된 참여자 간 P2P / Uniswap×Securitize RFQ로 메커니즘만 공개돼 있고, 그 상시 호가가 §3(c)(7)의 "no public offering"(Condition 2)을 깨는지는 정해지지 않았다 — Open Issue(§12), No-Action Letter 후보다. 발행분은 JOBS Act §201(b)(2)로 해소되지만 2차는 별개다(§3.0·§3.6).

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 A-13에 어떻게 닿는지를, **표 2**(순서·중요성)는 아래 §3.1~§3.20 소단원의 읽는 순서(논리 흐름)와 중요성(A-13이 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이라, 가장 중요한 §2(a)(51)(A)·§3(c)(7)(A)가 맨 앞 가까이 온다. 제정법 출처는 `uscode.house.gov`로 통일했으며 `govinfo.gov/link/uscode/...` 딥링크도 동일한 1차 출처다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | A-13 관련성 | Direct/Supporting | Official URL |
|---|---|---|---|---|---|
| Statute | ICA §2(a)(51)(A) · 15 U.S.C. §80a-2(a)(51)(A) | QP 4갈래 정의(개인 $5M·가족회사·신탁·$25M 재량운용) | QP category 판정의 출발점 → claim.basis 결정 | Direct | uscode.house.gov |
| Statute | ICA §2(a)(51)(B) · §80a-2(a)(51)(B) | SEC 규칙제정 권한 | 하위 Rule 2a51-1~3·3c-5의 위임 근거 | Supporting | uscode.house.gov |
| Statute | ICA §2(a)(51)(C) · §80a-2(a)(51)(C) | excepted IC — 1996-04-30 이전 보유자 consent | 전환·fund-of-funds buyer일 때만 발동 | Conditional | uscode.house.gov |
| Statute | ICA §3(c)(7)(A)·(B) · §80a-3(c)(7) | 면제 두 조건(전원 QP · no public offering) | A-13 활성화 트리거(Condition 1) | Direct | uscode.house.gov |
| Statute | JOBS Act §201(b)(2) · Pub. L. 112-106 | 506(c) 일반청약을 §3(c)(7) public offering으로 안 봄 | 발행측 공모우려 해소(§9.6·§12) | Supporting | govinfo.gov |
| SEC Rule | Rule 2a51-1(a)(b) · §270.2a51-1 | investments 정의·자산 7종·용어 | $5M/$25M 산정(off-chain) → investmentsVerified | Direct | ecfr.gov |
| SEC Rule | Rule 2a51-1(c)(d) | 투자목적(주거·사업 제외)·평가(FMV/원가) | threshold 부풀리기 차단 | Direct | ecfr.gov |
| SEC Rule | Rule 2a51-1(e)(f) | 취득용 차입금 차감 | 순 investments로 문턱 판정 | Direct | ecfr.gov |
| SEC Rule | Rule 2a51-1(g) | QIB 간주·배우자 합산·자회사 특칙 | QP_QIB·부부 합산 분기 | Conditional | ecfr.gov |
| SEC Rule | Rule 2a51-1(h) | reasonable belief 안전항 | attestation(claim) 구조의 법적 토대 | Direct | ecfr.gov |
| SEC Rule | Rule 2a51-2 · §270.2a51-2 | beneficial owner·간접소유·전환 펀드 | entity·전환 buyer look-through | Conditional | ecfr.gov |
| SEC Rule | Rule 2a51-3 · §270.2a51-3 | 목적형성 회사 look-through(전원 QP) | entity buyer 요건(lookThroughStatus) | Direct | ecfr.gov |
| SEC Rule | Rule 3c-5 · §270.3c-5 | KE를 exclusively-QP 판정에서 제외 | KE 분기(claim.basis) | Direct | ecfr.gov |
| SEC Rule | Rule 3c-6 · §270.3c-6 | 증여·상속·이혼 등 비자발적 이전 QP 간주 | Condition 1 카브아웃(forcedTransfer) | Conditional | ecfr.gov |
| SEC Rule | Rule 3c-1 · §270.3c-1 | §3(c)(1) beneficial owner 산정 | §2(a)(51)(C)·2a51-2가 참조하는 상위 규칙 | Supporting | ecfr.gov |
| SEC Release | SEC Release IC-22597 · 62 FR 17512 | Rule 6종(2a51-1·2·3·3c-1·5·6) 채택 release | 입법·해석 취지(off-chain 기준 설계) | Supporting | sec.gov |
| SEC Staff | Davis Polk & Wardwell NAL · 1997-04-24, File 132-3 | §3(c)(7) 전환·2a51-1/2a51-2 적용 | staff 해석(manual review·open issue) | Supporting only | sec.gov |
| SEC Staff | ABA Subcommittee NAL · 1999-04-22 | trust·family vehicle QP 판단 | staff 해석(manual review·open issue) | Supporting only | sec.gov |
| Case | SEC v. Ralston Purina · 346 U.S. 119 (1953) | public offering 기능적 기준(4-factor) | Condition 2 기준(Recipe-level·§9·§12) | Supporting | govinfo.gov |
| Case | SEC v. Howey · 328 U.S. 293 (1946) · Oxford(2019)→*FS Credit v. Saba* · 608 U.S. ___ (2026) | security 정의 · §47(b) 사적 소권(FS Credit로 **부정**) | 증권성 전제 · 면제 상실 효과 | Background | govinfo.gov · supremecourt.gov |
| Statute | ICA §3(c)(1)·§7·§47(b) · Exchange Act §12(g) | 100인 비교·미등록 영업·rescission(§47(b) 사적 소권은 FS Credit 2026로 부정)·2000-holder | 배경·리스크(D-01 등) | Background | uscode.house.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | A-13이 그걸로 하는 일 |
|---|---|---|---|
| §3.1 | § 2(a)(51)(A) — QP 정의 | 핵심 | QP 4갈래를 직접 판정(claim.basis 결정) |
| §3.2 | § 2(a)(51)(B) — SEC 규칙제정 권한 | 보조 | 안 함 — 하위 Rule의 위임 근거 |
| §3.3 | § 2(a)(51)(C) — Excepted IC(consent) | 조건부 | 전환·FoF buyer면 1996년 consent 확인 |
| §3.4 | § 3(c)(7)(A) — 면제 두 조건 | 핵심 | A-13 판정 본체(전원 QP + 취득시점) |
| §3.5 | § 3(c)(7)(B) — 전환 경과조항 | — | 안 함 — 신규 BUIDL 해당 없음(N/A) |
| §3.6 | JOBS Act §201(b)(2) | 보조 | 안 함 — 발행측 공모우려 해소 |
| §3.7 | Rule 2a51-1(a) — 용어 정의 | 핵심(보조) | claim 로직의 변수 정의 |
| §3.8 | Rule 2a51-1(b) — investments | 핵심 | $5M/$25M 자산 산정(off-chain) |
| §3.9 | Rule 2a51-1(c) — 투자목적 | 핵심 | 주거·사업 부동산 제외 |
| §3.10 | Rule 2a51-1(d) — 평가 | 핵심 | FMV/원가 평가 |
| §3.11 | Rule 2a51-1(e)(f) — 차감 | 핵심 | 취득용 차입금 차감 |
| §3.12 | Rule 2a51-1(g) — 특칙 | 조건부 | QIB·배우자 합산 분기 |
| §3.13 | Rule 2a51-1(h) — reasonable belief | 핵심 | attestation 구조 법적 토대 |
| §3.14 | Rule 3c-5 — KE 제외 | 핵심(분기) | KE를 전원-QP 판정에서 제외 |
| §3.15 | Rule 3c-6 — 비자발적 이전 | 조건부 | 상속·이혼 이전분을 QP 간주 |
| §3.16 | Rule 2a51-3 — 목적형성 회사 | 조건부 | 법인 buyer look-through |
| §3.17 | Rule 2a51-2 — beneficial owner | 조건부 | 간접소유·전환 buyer 산정 |
| §3.18 | 판례·발행문서·NAL(Layer 3) | 보조 | 안 함 — 해석 자료(Ralston·Howey·Oxford·IC-22597·NAL) |
| §3.19 | Sub-요건 분해 매트릭스 | — | 위 요건을 원자적 검증 단위로 분해 |
| §3.20 | ERC-3643 변환·claim.basis 총정리 | — | §3.1~§3.17의 claim 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래 조문은 같은 BUIDL 토큰에 작동하지만 A-13이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리이며, A-13 안에 끌어다 구현하지 않는다.

- **Securities Act §5 · §4(a)(2) · §4(a)(7)** (15 U.S.C. §77e·§77d(a)(2)·§77d(a)(7)) — 발행·재판매의 상위 근거. A-03(R1 발행 / R2 재판매) 소관.
- **Reg D Rule 506(c) · 502(d)** (17 CFR §230.506(c)·.502(d)) — 일반청약 허용 발행 Recipe와 재판매 제한. A-03(R1/R2) 소관.
- **Reg ATS Rule 300 · 301** (17 CFR §242.300·.301) — 2차 거래 venue 등록·운영. Operator layer 소관(Condition 2의 secondary-trading 쟁점 자체는 §9.6·§12에서 다룬다).

### 3.1 § 2(a)(51)(A) — Qualified Purchaser 정의 [🔗 uscode.house.gov]

**핵심 원문:** "Qualified purchaser" means— (i) any natural person (including any person who holds a joint, community property, or other similar shared ownership interest in an issuer that is excepted under section 80a-3(c)(7) of this title with that person's qualified purchaser spouse) who owns not less than $5,000,000 in investments, as defined by the Commission; (ii) any company that owns not less than $5,000,000 in investments and that is owned directly or indirectly by or for 2 or more natural persons who are related as siblings or spouse (including former spouses), or direct lineal descendants by birth or adoption, spouses of such persons, the estates of such persons, or foundations, charitable organizations, or trusts established by or for the benefit of such persons; (iii) any trust that is not covered by clause (ii) and that was not formed for the specific purpose of acquiring the securities offered, as to which the trustee or other person authorized to make decisions with respect to the trust, and each settlor or other person who has contributed assets to the trust, is a person described in clause (i), (ii), or (iv); or (iv) any person, acting for its own account or the accounts of other qualified purchasers, who in the aggregate owns and invests on a discretionary basis, not less than $25,000,000 in investments.

**한국어:** "Qualified purchaser"란 다음을 뜻한다 — (i) Commission이 정하는 바에 따른 investments를 $5,000,000 이상(not less than) 보유한 모든 자연인(§3(c)(7)로 면제되는 issuer에서 자신의 qualified purchaser인 배우자와 joint·community property 또는 그 밖의 유사한 공유 소유지분을 보유하는 자를 포함); (ii) investments를 $5,000,000 이상 보유하고, 형제 또는 배우자(전 배우자 포함)로서 관계되거나 출생 또는 입양에 의한 직계비속인 2인 이상의 자연인, 그러한 자들의 배우자, 그러한 자들의 유산(estate), 또는 그러한 자들에 의하여 또는 그들의 이익을 위하여 설립된 재단·자선단체·신탁에 의하여 또는 그들을 위하여(by or for) 직접 또는 간접으로 소유되는 모든 회사; (iii) clause (ii)에 포섭되지 아니하고, 제공되는 증권을 취득할 특정 목적으로 형성되지 아니한 신탁으로서, 그 신탁에 관하여 결정을 내릴 권한이 있는 수탁자(trustee) 또는 그 밖의 자, 그리고 그 신탁에 자산을 출연한 각 위탁자(settlor) 또는 그 밖의 자가 clause (i)·(ii) 또는 (iv)에 기술된 자인 신탁; 또는 (iv) 자기 계산으로 또는 다른 qualified purchaser들의 계산으로 행위하면서, 총계로(in the aggregate) investments를 재량적 기준으로(on a discretionary basis) $25,000,000 이상 소유하고 투자하는 모든 자(any person).

**쉬운 설명:** (i)은 개인, (ii)는 가족회사, (iii)은 신탁이다. (iv)는 흔히 "기관"으로 줄여 부르지만 조문 문언은 "기관"이 아니라 **자기 또는 다른 QP들의 계산으로 재량으로 $25M 이상을 운용하는 모든 자**, 즉 any person이다 — 운용사·기관이 전형적일 뿐, 요건만 충족하면 개인·패밀리오피스·SPV도 (iv)로 QP가 될 수 있다. 문턱은 자연인·가족회사 $5M, (iv) $25M이다. 그리고 (ii)·(iii)은 그 안의 사람들까지 따져야 자격이 정해진다 — 이것이 뒤(§5·§7)에서 다룰 **look-through**(들여다보기)의 법적 뿌리다.

**PASS/FAIL 반영:** 직접 ○ — QP 자격 판정의 근본 기준(자연인·가족회사·신탁·$25M 4갈래). 어느 갈래로 통과했는지가 claim.basis를 결정한다.

**ERC-3643 변환:** claim.topic = QP_STATUS, claim.basis ∈ {QP_NATURAL, QP_FAMILY_COMPANY, QP_TRUST, QP_INSTITUTIONAL}, claim.issuer = TrustedIssuer. 자격 판단은 off-chain, 온체인 토큰은 claim 유무만 확인.

### 3.1.1 QP 6갈래 분류 — "QP가 되는 5길" vs "안 세는 예외"

§2(a)(51)(A)의 네 prong에 Rule이 얹은 경로까지 더하면 보유자 자격은 여섯 갈래로 나뉜다. 다만 여섯이 같은 종류가 아니다 — 다섯은 "QP가 되는 길", 여섯째는 "QP가 아니어도 '전원 QP' 계산에서 빠지는 예외"다.

![그림 3.1.1 — QP 6갈래: 'QP가 되는 5길'(파랑) vs '안 세는 예외'(주황)](fig/fig_qp6.png)

**A. QP가 "되는" 길 (5).**

1. **자연인 $5M** — §2(a)(51)(A)(i). **내 돈 $5M 가진 개인** (investments가 $5,000,000 이상인 살아있는 자연인).
2. **가족회사 $5M** — §2(a)(51)(A)(ii). 가족 2인 이상이 직간접 소유하고 investments가 $5,000,000 이상인 회사.
3. **신탁** — §2(a)(51)(A)(iii). 수탁자와 모든 위탁자가 각자 (i)·(ii)·(iv)에 해당하는 자((iii) 신탁 자체는 불인정)인 신탁(특정 증권 취득 목적으로 형성된 것이 아님).
4. **any person $25M 재량운용** — §2(a)(51)(A)(iv). **내 돈 $25M, 또는 QP 고객 돈 $25M을 재량으로(discretionary) 굴리는 자**(개인·법인 무관). 굴리는 대상 계정도 QP여야 하고, 조문은 "기관"이 아니라 any person이다.

1~4는 **statute(§2(a)(51)(A)) QP 정의 그 자체**다. (i)과 (iv)이 가장 헷갈리는데 — **(i) = 내 돈 $5M 가진 개인**, **(iv) = 내 돈 $25M, 또는 QP 고객 돈 $25M을 재량으로 굴리는 자**(개인·법인). (i)은 자연인만, (iv)은 누구나이되 굴리는 대상도 QP여야 한다.

5. **QIB 간주** — Rule 2a51-1(g)(1). Rule 144A상 QIB는 자산 재계산 없이 QP로 간주된다. statute의 다섯째 prong이 아니라 규칙이 따로 얹은 간주 경로다.

**B. QP가 "아니어도" 보유 OK — 계산에서 빠지는 길.**

6. **KE(펀드 임직원)** — Rule 3c-5. KE는 QP로 간주하는 게 아니라, "전원 QP" 판정에서 그 보유분을 **제외**(exclusion)한다. KE는 QP가 아니어도 자기 펀드를 보유할 수 있고, 그 한 명 때문에 면제가 깨지지 않는다.

추가로 **비자발적 이전 수취인** — Rule 3c-6 / §3(c)(7)(A) 단서. 상속·이혼·증여로 QP에게서 넘겨받은 자는 QP가 아니어도 "QP가 소유한 것으로 간주"돼 면제를 깨지 않는다. 별도 claim.basis가 아니라 transfer.involuntary(forcedTransfer/recovery) 예외로 처리한다.

**성격이 다르다.** 1~5는 "자격을 갖춰 QP가 됨", 6(및 비자발적 이전)은 "QP가 아니어도 세지 않음"이다. 그래서 claim.basis도 1~5는 `QP_*`, 6은 `KNOWLEDGEABLE_EMPLOYEE_EXCLUSION`(_EXCLUSION)으로 이름이 다르다.

**경계 두 가지.**

- 이 여섯 갈래는 전부 **Condition 1**("취득 시점에 전원 QP") 안의 이야기다. §3(c)(7) 면제의 다른 한 축인 **Condition 2**("public offering 아님")는 보유자 종류와 무관한 별개 축이다(§9·§12).
- 법인이 매수인이면 **Rule 2a51-3**(목적형성 회사 look-through)이 (ii)·(iv) 위에 한 겹 더 얹힌다 — "이 펀드를 사려고 급조한 회사면 구성원 전원이 QP여야 함." 새 갈래가 아니라 회사 갈래에 붙는 검증 규칙이다(A-09).

### 3.2 § 2(a)(51)(B) — SEC 규칙제정 권한 [🔗 uscode.house.gov]

**핵심 원문:** "The Commission may adopt such rules and regulations applicable to the persons and trusts specified in clauses (i) through (iv) of subparagraph (A) as it determines are necessary or appropriate in the public interest or for the protection of investors."

**한국어:** Commission은, 공익을 위하여 또는 투자자 보호를 위하여 필요하거나 적절하다고 판단하는, subparagraph (A)의 clause (i)부터 (iv)까지에 규정된 자 및 신탁에 적용되는 규칙 및 규정을 채택할 수 있다.

**쉬운 설명:** QP 정의의 세부 규격을 SEC 규칙에 위임한 조항. 실제 검증 기준은 전부 아래 §3.7~§3.17 Rule 절들에서 나온다.

**PASS/FAIL 반영:** 간접 ✕ — 직접 판정엔 안 쓰임. 하위 Rule 2a51-1 등 claim 발급 기준의 위임 근거.

**ERC-3643 변환:** 직접 매핑 없음. 이 위임에서 나온 Rule들이 claim topic의 "내용 규격"(어떤 증빙으로 claim을 발급하는가)을 정의한다.

### 3.3 § 2(a)(51)(C) — Excepted Investment Company(전환 펀드의 보유자 consent) [🔗 uscode.house.gov]

**핵심 원문:** "The term 'qualified purchaser' does not include a company that, but for the exceptions provided for in paragraph (1) or (7) of section 80a-3(c) of this title, would be an investment company (hereafter in this paragraph referred to as an 'excepted investment company'), unless all beneficial owners of its outstanding securities (other than short-term paper), determined in accordance with section 80a-3(c)(1)(A) of this title, that acquired such securities on or before April 30, 1996 (hereafter in this paragraph referred to as 'pre-amendment beneficial owners'), and all pre-amendment beneficial owners of the outstanding securities (other than short-term paper) of any excepted investment company that, directly or indirectly, owns any outstanding securities of such excepted investment company, have consented to its treatment as a qualified purchaser. Unanimous consent of all trustees, directors, or general partners of a company or trust referred to in clause (ii) or (iii) of subparagraph (A) shall constitute consent for purposes of this subparagraph."

**한국어:** "qualified purchaser"라는 용어는, 본 title의 section 80a-3(c)의 paragraph (1) 또는 (7)에 규정된 예외가 없었다면 투자회사에 해당하였을 회사(이하 본 paragraph에서 "excepted investment company"라 한다)를 포함하지 아니한다. 다만, 본 title의 section 80a-3(c)(1)(A)에 따라 산정되는 그 발행 증권(단기증권 제외)의 모든 beneficial owner로서 1996년 4월 30일 이전에 그 증권을 취득한 자(이하 본 paragraph에서 "pre-amendment beneficial owners"라 한다), 그리고 그 excepted investment company의 발행 증권을 직접 또는 간접으로 소유하는 다른 excepted investment company의 발행 증권(단기증권 제외)의 모든 pre-amendment beneficial owner가 그 회사를 qualified purchaser로 취급하는 데 동의(consent)한 경우에는 그러하지 아니하다. subparagraph (A)의 clause (ii) 또는 (iii)에 언급된 회사 또는 신탁의 모든 수탁자·이사·무한책임사원(general partner)의 만장일치 동의는 본 subparagraph의 목적상 consent를 구성한다.

**쉬운 설명:** (B)는 규칙의 근거, (C)는 "펀드가 QP가 될 수 있는가"의 조건이다. BUIDL처럼 신규 발행 펀드에 자연인·법인이 직접 들어오는 구조에서는 (C)의 1996년 consent 요건이 직접 발동될 일은 드물지만, *fund-of-funds*나 전환 펀드가 매수인이 되는 경우 반드시 확인해야 하는 갈래다.

**PASS/FAIL 반영:** 조건부 — 매수인이 펀드·전환펀드일 때만 발동(1996년 보유자 consent 요건).

**ERC-3643 변환:** 전환펀드 한정: preAmendmentConsentVerified = true 확인 후 lookThroughStatus = COMPLETED로 claim 발급. 일반 자연인·법인 매수엔 온체인 영향 없음.

### 3.4 § 3(c)(7)(A) — ICA 등록 면제 조건 [🔗 uscode.house.gov]

**핵심 원문:** "Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities. Securities that are owned by persons who received the securities from a qualified purchaser as a gift or bequest, or in a case in which the transfer was caused by legal separation, divorce, death, or other involuntary event, shall be deemed to be owned by a qualified purchaser, subject to such rules, regulations, and orders as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors."

**한국어:** 그 발행 증권이, 해당 증권의 취득 시점에 qualified purchaser인 자들에 의하여 배타적으로(exclusively) 소유되고, 그 시점에 해당 증권의 public offering(공모)을 하고 있지 아니하며 또한 그때 이를 하려고 제안하지도 아니하는 모든 issuer. … 증여(gift)나 유증(bequest)으로, 또는 … 법적 별거, 이혼, 사망, 그 밖의 비자발적 사건(involuntary event)에 의하여 … 받은 증권은 qualified purchaser가 소유한 것으로 본다 …

**쉬운 설명:** §3(c)(7) 면제에는 두 개의 조건이 있다 — ① "모든 지분이 취득 시점에 QP에게 배타적으로 소유"(Condition 1), ② "public offering을 하지 않음"(Condition 2). 본 부품(A-13)이 책임지는 것은 Condition 1이다. Condition 2(공모 금지)는 부품 하나로 끝나지 않고 DEX 거래환경 전체에 걸리는 Recipe-level 문제이며, 이 문서 §9·§12에서 별도로 다룬다.

**PASS/FAIL 반영:** 직접 ○ — A-13 판정의 본체(Condition 1). 보유자 전원 QP + 취득 시점 충족 시 PASS, 한 명이라도 비-QP면 FAIL(면제 위태).

**ERC-3643 변환:** transfer 시 IdentityRegistry.isVerified(to) && Compliance.canTransfer() → QP claim 없는 지갑 이전 거부("전원 QP" 강제). 비자발적 이전 = forcedTransfer() / recovery() 예외(Rule 3c-6). Condition 2는 토큰 밖(Recipe·Operator, §9·§12).

### 3.5 § 3(c)(7)(B) — 기존 §3(c)(1) 펀드의 §3(c)(7) 전환 경과조항 (N/A)

1996년 이전 §3(c)(1) 이력이 있는 펀드에만 적용되는 grandfathering 조항이라, 신규 발행 BUIDL에는 해당 없음.

### 3.6 JOBS Act §201(b)(2) — 일반청약권유와 "public offering"의 단절 [🔗 govinfo.gov]

**핵심 원문:** "Offers and sales exempt under section 230.506 of title 17, Code of Federal Regulations (as revised pursuant to section 201 of the Jumpstart Our Business Startups Act) shall not be deemed public offerings under the Federal securities laws as a result of general advertising or general solicitation."

**한국어:** 17 Code of Federal Regulations의 section 230.506(Jumpstart Our Business Startups Act의 section 201에 따라 개정된 것)에 따라 면제되는 offer 및 sale은, 일반광고(general advertising) 또는 일반청약권유(general solicitation)의 결과라는 이유로 연방증권법(Federal securities laws)상 public offering으로 보지 아니한다.

**해설(Condition 2의 핵심 다리).** 이 조항이 없으면 BUIDL 구조가 모순처럼 보인다 — 506(c)는 일반청약(광고)을 허용하는데 §3(c)(7)은 "공모를 하지 않을 것"을 요구하기 때문이다. §201(b)(2)가 그 충돌을 푼다: BUIDL이 506(c)로 대놓고 광고하며 QP에게 토큰을 팔아도, 그 **발행 행위 자체는 "공모"로 보지 않는다** → 발행 단계의 Condition 2는 해소된다.

쉽게 말하면, §201(b)(2)는 **펀드가 자기 토큰을 처음 파는 행위**(1차 발행)만 봐준다. 기존 보유자가 DEX에서 자기 토큰을 남에게 되파는 **2차 거래**는 봐주지 않는다. 그래서 아직 답이 안 난 질문은 하나로 좁혀진다 — *"DEX에서 토큰이 상시 호가창에 떠 있고 익명으로 매칭돼 거래되는 환경 자체가 공모처럼 보이는가?"* 이건 §12 Open Issue로 남으며, 공모인지 아닌지를 따지는 Ralston Purina 4-factor도 (발행 광고가 아니라) 바로 이 2차 거래에 적용된다.

중요한 점 하나 — 이 규칙들이 정하는 investments의 정의·투자목적·평가·차입금 차감 등의 "계산"은 모두 **신뢰기관(Trusted Issuer)이 오프체인에서** 수행한다. 온체인 A-13은 그 계산을 다시 하지 않고, 신뢰기관이 서명한 "이 사람 QP 맞음"이라는 claim과 그 근거 플래그만 확인한다(자세한 구조는 §8).

**쉬운 설명:** 506(c)로 광고하며 발행해도 '공모'가 아니라는 법적 보장. 덕분에 발행 단계의 §3(c)(7) 공모 우려가 사라진다(2차 거래는 별개).

**PASS/FAIL 반영:** 간접 ✕ — A-13 판정엔 안 쓰임. 발행 측 공모 우려를 해소하는 법적 전제(§9.6·§12).

**ERC-3643 변환:** 온체인 구현 없음. 발행 UI에서 일반청약·광고 허용의 근거일 뿐, transfer·claim 로직과 무관.

### 3.7 17 CFR § 270.2a51-1(a) — 정의(이 규칙에서 쓰는 용어) [🔗 ecfr.gov]

**핵심 원문(주요 정의):** "(8) The term *Related Person* means a person who is related to a Prospective Qualified Purchaser as a sibling, spouse or former spouse, or is a direct lineal descendant or ancestor by birth or adoption of the Prospective Qualified Purchaser, or is a spouse of such descendant or ancestor, *provided that,* in the case of a Family Company, a Related Person includes any owner of the Family Company and any person who is a Related Person of such owner. (9) The term *Relying Person* means a Section 3(c)(7) Company or a person acting on its behalf. (10) The term *Section 3(c)(7) Company* means a company that would be an investment company but for the exclusion provided by section 3(c)(7) of the Act."

**한국어:** (8) "Related Person"이라는 용어는, Prospective Qualified Purchaser와 형제, 배우자 또는 전 배우자로서 관계되거나, 그의 출생 또는 입양에 의한 직계비속 또는 직계존속이거나, 그러한 비속 또는 존속의 배우자인 자를 뜻한다. 다만, Family Company의 경우 Related Person에는 그 Family Company의 모든 소유자 및 그러한 소유자의 Related Person인 모든 자가 포함된다. (9) "Relying Person"이라는 용어는 Section 3(c)(7) Company 또는 그를 대신하여 행위하는 자를 뜻한다. (10) "Section 3(c)(7) Company"라는 용어는, Act의 section 3(c)(7)이 제공하는 제외(exclusion)가 없었다면 투자회사에 해당하였을 회사를 뜻한다.

**쉬운 설명:** 규칙에서 쓰는 용어 정의. '매수인=Prospective QP, 펀드/대리인=Relying Person'처럼 이후 모든 규칙의 주어를 정한다. Related Person은 (c) 부동산 '개인·사업용 제외' 판정에, Relying Person(=Trusted Issuer)은 (h) reasonable belief 안전항에 대응하며, Section 3(c)(7) Company가 곧 BUIDL이다.

**PASS/FAIL 반영:** 직접(보조) — 판정 자체보다 용어 토대. claim 로직의 변수 정의.

**ERC-3643 변환:** 변수 매핑 — ProspectiveQualifiedPurchaser = 매수인, RelyingPerson = TrustedIssuer(claim 서명 주체), Section3c7Company = BUIDL(fundId).

### 3.8 17 CFR § 270.2a51-1(b) — "Investments"의 정의(무엇을 자산으로 치는가) [🔗 ecfr.gov]

**핵심 원문(요지):** "Investments" means: (1) Securities (other than securities of an issuer that controls, is controlled by, or is under common control with the prospective qualified purchaser, with limited exceptions); (2) Real estate held for investment purposes; (3) Commodity Interests held for investment purposes; (4) Physical Commodities held for investment purposes; (5) ... financial contracts entered into for investment purposes; (6) [§3(c)(7) Company 매수자인 경우] firm commitments to contribute capital; and (7) Cash and cash equivalents held for investment purposes.

**한국어:** "Investments"란 다음을 뜻한다 — (1) 증권(단, prospective qualified purchaser를 지배하거나, 그에 의하여 지배되거나, 그와 공동지배 관계에 있는 issuer의 증권은 제외하되, 제한적 예외가 있다); (2) 투자 목적으로 보유하는 부동산; (3) 투자 목적으로 보유하는 Commodity Interests; (4) 투자 목적으로 보유하는 Physical Commodities; (5) 투자 목적으로 체결한 … 금융계약; (6) [§3(c)(7) Company의 매수인인 경우] 자본을 출연하기로 한 확정 약정(firm commitments); 그리고 (7) 투자 목적으로 보유하는 현금 및 현금성 자산.

**쉬운 설명:** 무엇을 '투자자산(investments)'으로 세는지의 핵심 목록(증권·투자부동산·상품·금융계약·현금성 등 7종). $5M/$25M 문턱이 이 자산들로 계산된다.

**PASS/FAIL 반영:** 직접 ○ — $5M/$25M 문턱 계산의 대상 자산. 충족 시 investmentsVerified=true.

**ERC-3643 변환:** claim.investmentsVerified = true (off-chain 7종 분류·합산 결과). 온체인엔 자산 명세 비공개, 판정 결과만 기록.

### 3.9 17 CFR § 270.2a51-1(c) — "Investment Purposes"(주거·사업용 부동산 제외) [🔗 ecfr.gov]

**핵심 원문(요지):** "Real estate shall not be considered to be held for investment purposes ... if it is used ... for personal purposes or as a place of business ... [of] the Prospective Qualified Purchaser or a Related Person ..."

**한국어:** 부동산은, 그것이 … Prospective Qualified Purchaser 또는 Related Person의 … 개인적 용도로 또는 사업장(place of business)으로 사용되는 경우에는 … 투자 목적으로 보유하는 것으로 보지 아니한다.

**쉬운 설명:** 내가 사는 집·내 사업장은 investments에서 빠진다. 투자 목적 부동산만 자산으로 인정.

**PASS/FAIL 반영:** 직접 — investments 계산 시 주거·사업용 부동산 제외 규칙.

**ERC-3643 변환:** off-chain investments 계산의 제외 규칙(온체인 필드 없음). investmentsVerified 발급 조건에 반영.

### 3.10 17 CFR § 270.2a51-1(d) — Valuation(얼마로 평가하는가) [🔗 ecfr.gov]

**핵심 원문(요지):** "... the aggregate amount of Investments ... shall be the Investments' fair market value on the most recent practicable date or their cost ..."

**한국어:** … Investments의 총액(aggregate amount)은 … 실무상 가능한 가장 최근 일자의 공정시장가치(fair market value) 또는 그 취득원가(cost)로 한다 …

**쉬운 설명:** 자산을 얼마로 칠지 — 공정가치(FMV) 또는 원가(cost)로 평가한다.

**PASS/FAIL 반영:** 직접 — investments 금액을 정하는 평가 방식.

**ERC-3643 변환:** claim.valuationMethod = FMV | COST (off-chain 평가, 감사 추적용 기록). 온체인 계산 없음.

### 3.11 17 CFR § 270.2a51-1(e)·(f) — Deductions(차입금 차감) [🔗 ecfr.gov]

**핵심 원문(요지):** "(e) ... there shall be deducted ... the amount of any outstanding indebtedness incurred to acquire or for the purpose of acquiring the Investments ... (f) [Family Company의 경우 소유자가 그 투자를 취득하기 위해 진 차입금도 차감]"

**한국어:** (e) … Investments를 취득하기 위하여 또는 취득할 목적으로 발생시킨 미상환 채무(outstanding indebtedness)의 금액을 … 차감한다 … (f) [Family Company의 경우, 그 소유자가 해당 투자를 취득하기 위하여 발생시킨 채무도 차감한다.]

**쉬운 설명:** 투자를 사려고 빌린 돈은 자산에서 뺀다(순자산 기준). 단, 일반 주택담보대출·사업자금 대출은 차감 대상이 아니다.

**PASS/FAIL 반영:** 직접 — 취득용 차입금 차감 후 순 investments로 문턱 판정.

**ERC-3643 변환:** claim.debtAdjustmentChecked = true. 차감 후 순 investments ≥ 문턱이어야 claim 발급.

### 3.12 17 CFR § 270.2a51-1(g) — 특정 매수인 특칙(QIB 간주·배우자 합산·자회사 투자) [🔗 ecfr.gov]

**핵심 원문 (g)(1) QIB:** "Any Prospective Qualified Purchaser who is, or who a Relying Person reasonably believes is, a qualified institutional buyer as defined in paragraph (a) of § 230.144A of this chapter, acting for its own account, the account of another qualified institutional buyer, or the account of a qualified purchaser, shall be deemed to be a qualified purchaser ..."

**핵심 원문 (g)(2) 배우자 공동투자:** "… In determining whether spouses who are making a joint investment in a Section 3(c)(7) Company are qualified purchasers, there may be included in the amount of each spouse's Investments any Investments owned by the other spouse (whether or not such Investments are held jointly). In each case, there shall be deducted from the amount of any such Investments the amounts specified in paragraph (e) of this section incurred by each spouse."

**한국어:** (g)(1) 본 chapter의 § 230.144A의 paragraph (a)에 정의된 qualified institutional buyer이거나 Relying Person이 그러하다고 합리적으로 믿는 Prospective Qualified Purchaser로서, 자기 계산, 다른 qualified institutional buyer의 계산, 또는 qualified purchaser의 계산으로 행위하는 자는 qualified purchaser로 본다 … (g)(2) Section 3(c)(7) Company에 공동으로 투자하는 배우자들이 qualified purchaser인지를 판정함에 있어, 각 배우자의 Investments 금액에 다른 배우자가 소유한 Investments(그 Investments가 공동으로 보유되는지 여부를 불문한다)를 포함할 수 있다. 각 경우에, 그러한 Investments 금액에서 각 배우자가 발생시킨 본 section paragraph (e)에 규정된 금액을 차감한다.

**쉬운 설명:** Decipher 관점에서 (g)(1) QIB 경로는 QIB(기관투자자) 매수인을 $25M 자산 입증 없이 통과시키는 별도 갈래이고(claim.basis = QP_QIB), (g)(2) 배우자 합산은 자연인 $5M 문턱을 부부 단위로 볼 수 있게 한다. 둘 다 §4 입력·§5 로직에 반영해야 한다.

**PASS/FAIL 반영:** 조건부 — QIB 매수인·부부 공동투자 등 특정 갈래에서만 발동.

**ERC-3643 변환:** (g)(1) → claim.basis = QP_QIB (자산 입증 생략 발급). (g)(2) → off-chain 자산 합산에 배우자분 포함.

### 3.13 17 CFR § 270.2a51-1(h) — Reasonable Belief(합리적 신뢰 안전항) [🔗 ecfr.gov]

**핵심 원문:** "The term 'qualified purchaser' ... means any person that meets the definition of qualified purchaser in section 2(a)(51)(A) of the Act and the rules thereunder, or that a Relying Person reasonably believes meets such definition." (여기서 "Relying Person"은 §3(c)(7) Company 또는 그를 대신해 행위하는 자를 말한다.)

**한국어:** "qualified purchaser"라는 용어는 … Act의 section 2(a)(51)(A) 및 그에 따른 규칙상 qualified purchaser의 정의를 충족하는 모든 자, 또는 Relying Person이 그러한 정의를 충족한다고 합리적으로 믿는 모든 자를 뜻한다. (여기서 "Relying Person"은 Section 3(c)(7) Company 또는 그를 대신하여 행위하는 자를 말한다.)

**쉬운 설명:** 펀드(또는 대리인)가 합리적으로 QP라 믿었다면, 나중에 자격 흠결이 드러나도 면제가 곧바로 깨지지 않는다. 이게 claim(증명서)에 기대 검증하는 설계의 법적 근거다(§8). (h) 문언은 'Relying Person이 합리적으로 믿으면 충분하다'는 단순한 형태이고, '합리적 신뢰를 위해 상당한 주의를 다해야 한다'는 취지는 실무·집행상 요구될 뿐 (h) 문언 자체에 명시돼 있지는 않다.

**PASS/FAIL 반영:** 직접 ○ — 증명서형(claim) 검증 패턴 전체의 법적 토대(§8).

**ERC-3643 변환:** Trusted Issuer의 claim 서명 = reasonable belief 구현(별도 필드 없음). 사후 흠결에도 면제 즉시 미붕괴. 책임 분배 §10.4·§12(#3).

### 3.14 17 CFR § 270.3c-5 — Knowledgeable Employee(펀드 임직원의 제외) [🔗 ecfr.gov]

**핵심 원문(요지):** "(a)(4) The term 'Knowledgeable Employee' ... means any natural person who is: (i) an Executive Officer, director, trustee, general partner, advisory board member, or person serving in a similar capacity, of the Covered Company or an Affiliated Management Person ...; or (ii) an employee ... (other than ... clerical, secretarial or administrative functions) who, in connection with his or her regular functions or duties, participates in the investment activities ... provided that such employee has been performing such functions ... for at least 12 months. (b) For purposes of ... whether the outstanding securities of a Section 3(c)(7) Company are owned exclusively by qualified purchasers, there shall be excluded securities beneficially owned by: (1) a Knowledgeable Employee ...; (2) a company owned exclusively by Knowledgeable Employees ..."

**한국어:** (a)(4) "Knowledgeable Employee"라는 용어는 … 다음 중 하나인 모든 자연인을 뜻한다 — (i) Covered Company 또는 Affiliated Management Person의 Executive Officer, 이사(director), 수탁자(trustee), 무한책임사원(general partner), 자문위원회 위원(advisory board member), 또는 그와 유사한 지위에서 직무를 수행하는 자; 또는 (ii) 자신의 통상적 기능 또는 직무와 관련하여 … 투자활동에 참여하는 직원(… 사무·비서·관리 기능을 수행하는 자는 제외)으로서, 다만 그러한 직원이 그러한 기능을 … 최소 12개월 동안 수행해 온 경우에 한한다. (b) Section 3(c)(7) Company의 발행 증권이 qualified purchaser에 의하여 배타적으로 소유되는지를 판단할 목적상, 다음에 의하여 beneficial owner로 소유되는 증권은 제외한다 — (1) Knowledgeable Employee …; (2) Knowledgeable Employee들에 의하여 배타적으로 소유되는 회사 …

**쉬운 설명:** 펀드 운용에 정통한 임직원(KE)은 자산 $5M 없이도 자기 펀드에 투자할 수 있다. 단 법 문언상 경로는 'QP로 간주'가 아니라 '전원 QP' 계산에서 KE 보유분을 제외(exclusion)하는 것이다(자기 펀드 매수에 한함).

**PASS/FAIL 반영:** 직접(조건부) — KE는 자산요건 없이 "전원 QP" 판정에서 제외.

**ERC-3643 변환:** claim.basis = KNOWLEDGEABLE_EMPLOYEE_EXCLUSION, claim.coveredCompany = fundId (자기 펀드 매수에만 유효).

### 3.15 17 CFR § 270.3c-6 — 증여·상속·이혼 등 비자발적 이전(transfers) [🔗 ecfr.gov]

**핵심 원문(주요 정의):** "(a)(1) The term *Donee* means a person who acquires a security of a Covered Company (or a security or other interest in a company referred to in paragraph (b)(3) of this section) as a gift or bequest or pursuant to an agreement relating to a legal separation or divorce. ... (4) The term *Transferee* means a Section 3(c)(1) Transferee or a Qualified Purchaser Transferee ..."

**한국어:** (a)(1) "Donee"라는 용어는, Covered Company의 증권(또는 본 section paragraph (b)(3)에 언급된 회사의 증권 또는 그 밖의 지분)을 증여나 유증으로, 또는 법적 별거나 이혼에 관한 합의에 따라 취득하는 자를 뜻한다. … (4) "Transferee"라는 용어는 Section 3(c)(1) Transferee 또는 Qualified Purchaser Transferee를 뜻한다 …

**쉬운 설명:** §3(c)(7)(A) 본문에는 "상속·이혼·증여처럼 본인 의사와 무관하게(involuntary) 넘어간 지분은 QP가 가진 것으로 친다"는 **예외**(carve-out)가 한 줄 들어 있다. Rule 3c-6은 그 예외를 실제로 어떻게 적용할지(누가 Donee·Transferee로 인정되는지)를 정한 규칙이다. 결과적으로 — BUIDL을 들고 있던 QP가 사망해 상속인(비-QP)에게 토큰이 넘어가도, 그 한 명 때문에 펀드의 "전원 QP" 면제가 곧바로 깨지지는 않는다. Decipher에서는 on-chain transfer 제약(ERC-3643 forced-transfer/recovery)을 설계할 때 이 비자발적 이전 예외와 충돌하지 않게 맞춰야 한다.

**PASS/FAIL 반영:** 조건부 — §3(c)(7)(A) Condition 1의 비자발적-이전 카브아웃 구현.

**ERC-3643 변환:** transfer.involuntary = true → agent forcedTransfer() / recovery()로 canTransfer 게이트 우회. 수취인 일시 비-QP여도 면제 미붕괴(정리는 Operator 층).

### 3.16 17 CFR § 270.2a51-3 — Certain companies as qualified purchasers(목적형성 회사의 look-through) [🔗 ecfr.gov]

**핵심 원문:** "(a) For purposes of section 2(a)(51)(A) (ii) and (iv) of the Act, a company shall not be deemed to be a qualified purchaser if it was formed for the specific purpose of acquiring the securities offered by a company excluded from the definition of investment company by section 3(c)(7) of the Act unless each beneficial owner of the company's securities is a qualified purchaser. (b) ... a company may be deemed to be a qualified purchaser if each beneficial owner of the company's securities is a qualified purchaser."

**한국어:** (a) Act의 section 2(a)(51)(A) (ii)·(iv)의 목적상, 회사가 section 3(c)(7)로 투자회사 정의에서 제외되는 회사가 제공하는 증권을 취득할 특정 목적으로 형성된 경우, 그 회사의 증권의 각 beneficial owner가 qualified purchaser가 아닌 한, 그 회사는 qualified purchaser로 보지 아니한다. (b) … 그 회사의 증권의 각 beneficial owner가 qualified purchaser인 경우, 그 회사는 qualified purchaser로 볼 수 있다.

**쉬운 설명:** 이 펀드를 사려고 급조한 회사는 구성원이 전부 QP일 때만 QP로 인정된다(우회 방지). 적용 대상은 §2(a)(51)(A) (ii) 가족회사·(iv) $25M 회사 **두 회사 갈래뿐**이며, (iii) 신탁의 look-through는 Rule 2a51-3이 아니라 statute §2(a)(51)(A)(iii) 자체가 규정한다 — 게다가 신탁은 **급조면 (iii) 탈락**이라 회사가 받는 "전원 QP면 치유"가 없고, 자연인(i)은 "형성"되는 대상이 아니라 급조 판단 자체가 적용되지 않는다(아래 §3.17 참조).

**PASS/FAIL 반영:** 조건부 — 법인 매수인이 목적형성 회사인지 검증(look-through).

**ERC-3643 변환:** 법인 매수인: off-chain look-through(급조 여부 + 구성원 전원 QP) → 통과 시 단일 QP claim, lookThroughStatus = COMPLETED 기록(A-09).

### 3.16.1 급조 회사 vs 비-급조 회사 — 회사 매수인 판정 분기

회사가 매수인일 때, **급조 회사인지**(= 이 펀드 증권을 취득할 특정 목적으로 형성됐는지)가 판정 경로를 가르는 스위치다. Rule 2a51-3은 (a)·(b) 두 항으로 이를 나눈다.

![그림 3.16.1 — Rule 2a51-3: 급조 회사(look-through 강제) vs 비-급조 회사(자체 자산 충족 / (b) 전원 QP)](fig/fig_2a513.png)

**① 급조 회사(특정 목적 형성) — Rule 2a51-3(a).** "제공되는 증권을 취득할 특정 목적으로 형성된" 회사는, 구성원(beneficial owner) **전원이 QP가 아닌 한** QP로 보지 않는다 → look-through 강제. 한 명이라도 비-QP면 탈락이다. (2a51-3(a)는 조문상 §2(a)(51)(A) (ii)·(iv) 회사에만 적용된다 — 신탁은 statute (iii)가 별도로 규정.)

**② 비-급조 회사 — 두 갈래.**

- **자체 자산이 문턱 충족** → §2(a)(51)(A)(iv)(또는 가족회사면 (ii))로 회사 단위로 QP. 안을 들여다볼 필요 없이 통과한다(일반 원칙).
- **자체 자산 부족** → **Rule 2a51-3**(b)가 추가 선택지를 준다 — 각 beneficial owner가 **전원 QP면 QP로 볼 수 있다**(may be deemed).

즉 (a)는 급조 회사에 대한 **제한**(전원 QP 아니면 불가), (b)는 비-급조 회사에 대한 **허용**(전원 QP면 가능)이다. 어느 쪽이든 "구성원 전원 QP"라는 안전판은 열려 있다.

**근거(authority).** 모두 17 CFR § 270.2a51-3 한 조문이다 — (a)는 급조 회사의 look-through 강제, (b)는 전원 QP면 인정 가능. "급조했는지(specific purpose)"라는 개념의 뿌리는 statute §2(a)(51)(A)(iii)로, 신탁에 대해 "특정 증권 취득 목적으로 형성된 것이 아닐 것"을 명시한 것을 Rule 2a51-3이 회사에까지 확장한 것이다.

**주의.** "비-급조 + 자체 자산 $25M"으로 (iv) 통과해도, 그 회사가 *남의 돈*을 굴리는 구조라면 그 계정들도 QP("other qualified purchasers")여야 한다는 (iv) 단서가 따라붙는다.

### 3.17 17 CFR § 270.2a51-2 — Beneficial owner 판정·간접 소유·전환 펀드 [🔗 ecfr.gov]

**핵심 원문 (a):** "Except as set forth in this section, for purposes of sections 2(a)(51)(C) and 3(c)(7)(B)(ii) of the Act, the beneficial owners of securities of an excepted investment company (as defined in section 2(a)(51)(C) of the Act) shall be determined in accordance with section 3(c)(1) of the Act."

**한국어:** 본 section에 정한 경우를 제외하고, Act의 section 2(a)(51)(C) 및 3(c)(7)(B)(ii)의 목적상, excepted investment company(Act의 section 2(a)(51)(C)에 정의된 것)의 증권의 beneficial owner는 Act의 section 3(c)(1)에 따라 결정한다.

**쉬운 설명:** 2a51-2는 "누구를 beneficial owner로 보고 어떻게 세는지"를 정하는 규칙이다 — (1) 매수인이 펀드(excepted investment company)면 그 소유자를 §3(c)(1) 방식으로 세고, (2) 간접소유(여러 겹 지주구조)를 추적하며, (3) §2(a)(51)(C)·§3(c)(7)(B)(ii) 전환 consent(1996-04-30·10-11 grandfathering)와 직접 연결된다.

**2a51-3(a)와 2a51-2의 분담 (혼동 주의).** 둘 다 "look-through"를 말하지만 역할이 다르다 — **2a51-3(a) = 요건**(급조 회사면 *각 beneficial owner가 전원 QP여야* 통과하며, 적용 대상은 §2(a)(51)(A) (ii)·(iv) 회사), **2a51-2 = 세는 방법**(그 "각 beneficial owner"가 누구인지 확정·합산). 3(a)가 "전원 QP인지 보라"고 명령하면 2a51-2가 "그 전원이 누구인지"를 센다. 정확한 권위 사슬은 **2a51-3(a)(요건) → §3(c)(1)·Rule 3c-1(누구를 세나) → 2a51-2(간접소유·펀드층·전환 consent)** 순이다 — 일반 사업회사 구성원 카운팅의 1차 근거는 §3(c)(1)/3c-1이고, 2a51-2는 그 위에 간접소유·펀드층·전환 consent를 더한다. §9 cascade·§12 Open Issue(look-through depth)와 함께 본다.

**매수인 유형별 look-through 적용 — 한눈에:**

- 매수인이 **개인** → 그 사람만 보면 끝 (look-through 불필요)
- 매수인이 **회사** → 급조 여부를 **Rule 2a51-3**으로 판정(요건): 급조면 안의 주인들 전원 QP인지 본다 [§2(a)(51)(A) (ii)·(iv)]
- 매수인이 **신탁** → statute **§2(a)(51)(A)(iii)**: ① 급조(특정목적 형성)가 **아닐 것** + ② 수탁자·각 위탁자가 **(i)·(ii)·(iv)에 해당하는 QP**((iii) 신탁은 불인정 → 신탁 겹치기 차단) — 둘 다 필요(급조 신탁은 (iii) 탈락이며, 회사 같은 "전원 QP면 치유"가 없다)
- 그 "주인들이 누구인지"를 세는 단계 → **§3(c)(1)·Rule 3c-1**이 1차 기준, **여러 겹·펀드층**이면 **Rule 2a51-2**가 간접소유를 끝까지 추적·합산

**§3.0 플로우차트에서 전환펀드에 조문이 3개 나오는 이유 (혼동 주의).** N4(전환펀드) 노드의 **§3(c)(7)(B) · §2(a)(51)(C) · Rule 2a51-2**는 세 개의 독립 요건이 아니라 *조문 2 + 구현 규칙 1*이다 — 모두 "§3(c)(7)이 등장할 때 이미 들어와 있던 옛 보유자를 어떻게 처리하나"라는 한 문제의 다른 조각이다. **§2(a)(51)(C)**(정의 쪽)는 매수인이 *그 자체로 펀드*(excepted investment company)일 때 그 펀드가 QP로 세어지려면 1996-04-30 이전 보유자의 consent가 필요하다는 **fund-of-funds 게이트**다. **§3(c)(7)(B)**(전환 쪽)는 기존 §3(c)(1) 펀드가 §3(c)(7)로 전환하면서 §3(c)(1) 시절 비-QP 보유자를 최대 100명까지 grandfather로 안고 가게 해주는 조항이다. **Rule 2a51-2**(구현 쪽)는 그 둘을 실제로 작동시키는 규칙 — beneficial owner를 §3(c)(1) 방식으로 세고, 여러 겹 간접소유를 추적하며, 1996-04-30·1996-10-11 consent 양식·시기를 정한다(공식 제목이 "beneficial owner for certain purposes under sections 2(a)(51) *and* 3(c)(7)"인 이유 — 두 조문을 동시에 구현하는 **다리**이기 때문). **신규 §3(c)(7) 펀드(BUIDL·Decipher)는 첫날부터 전원 QP라 이 경로 전체가 대개 N/A**이며, 실제 발동은 (a) 기존 §3(c)(1) 펀드가 전환하거나 (b) 매수인이 그 자체로 fund-of-funds일 때뿐이다 — 그래서 플로우차트가 이를 파랑(핵심)이 아닌 **주황**(전환·참고)으로 본류에서 비켜 그렸다.

**PASS/FAIL 반영:** 조건부 — 펀드·전환 매수인의 beneficial owner 산정·간접 소유 판정.

**ERC-3643 변환:** off-chain beneficial owner 산정(§3(c)(1) 방식) + 간접소유 판정 → lookThroughStatus. 전환펀드면 1996 consent 확인 후 claim 발급(A-09).

### 3.18 판례·발행문서·No-Action Letter (Layer 3)

조문·규칙이 모호한 부분은 판례·SEC 발행문서·No-Action Letter가 메운다. Decipher에 가장 중요한 자료들이다.

**SEC v. Ralston Purina Co., 346 U.S. 119 (1953)** [🔗 govinfo.gov]

> **Holding 핵심:** "An offering to those who are shown to be able to fend for themselves is a transaction 'not involving any public offering.'"(스스로를 지킬 수 있음이 입증된 자들에 대한 청약은 '공모에 해당하지 않는' 거래다.)

연방대법원이 "public offering(공모)"의 의미를 처음 명확히 한 foundational case다. 핵심은 **"투자자가 스스로를 보호할 수 있는가(able to fend for themselves)"라는** 기능적 기준이고, 실무는 여기서 4-factor test를 끌어낸다 — ① 청약 받은 사람 수(offerees), ② 그들의 sophistication, ③ 발행자 정보에 대한 접근성(access to information), ④ 매수 목적(투자용인가 전매용인가). **Decipher 관련성:** §3(c)(7)의 Condition 2("no public offering")도 이 4-factor가 출발점이다. 단, 발행 단계의 506(c) 일반청약·광고는 JOBS Act §201(b)(2)에 따라 그 자체로는 public offering이 아니므로(§3.6 참조), 이 4-factor는 issuance 광고가 아니라 **DEX의 secondary trading**에 적용된다 — 상시 호가·익명 매칭이 별도의 public offering을 유발하는지가 §3(c)(7) 유지의 핵심 질문이며 §9·§12에서 다룬다.

**Oxford Univ. Bank v. Lansuppe Feeder, 933 F.3d 99 (2d Cir. 2019) — *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*, 608 U.S. ___ (No. 24-345, 2026-06-11)로 번복됨.** Oxford에서 제2연방항소법원은 ICA §47(b)가 묵시적 사적 소권(implied private right of action)을 인정해 위반 계약 당사자가 rescission을 청구할 수 있다고 보았다. 그러나 2026년 연방대법원은 FS Credit(6-3, Barrett 집필)에서 §47(b)가 **private parties에게 독립적 rescission 소송권을 부여하지 않는다**고 판시해 circuit split을 정리했다 — §47(b)는 court에 대한 mandate(이미 법원 앞에 온 사건의 remedial authority 지시)이지 rights-creating이 아니며, SEC가 primary enforcer라는 것(1980년 개정이 TAMA가 의존한 'shall be void'를 삭제). **§47(b)를 standalone private rescission cause of action으로 설명하면 안 되며**, 면제 상실의 실질 후과는 SEC enforcement·계약 unenforceability·상업적 unwind·issuer/sponsor 계약 책임으로 재구성한다(§1.4).

**SEC v. W.J. Howey Co., 328 U.S. 293 (1946).** "증권(investment contract)" 판단의 4-factor 기준 판례. BUIDL은 펀드 지분이라 증권임이 명백하므로, 본 부품은 증권성을 전제하고 다투지 않는다.

**SEC Release IC-22597, 62 FR 17512 (Apr. 9, 1997) — Privately Offered Investment Companies (adopting release)** [🔗 sec.gov]

**무엇인가.** 1996년 NSMIA가 ICA에 §3(c)(7) 면제와 §2(a)(51) QP 정의를 신설하자, SEC가 그 시행을 위해 채택한 final rule 묶음이다(File No. S7-30-96, 1997-04-03 채택, 1997-06-09 시행, 62 FR 17512).

**무엇을 채택했나.** A-13이 의존하는 핵심 규칙 6종을 한 번에 채택했다 — Rule 2a51-1(무엇을 "investments"로 치고 어떻게 평가·차감하는지), 2a51-2(beneficial owner 산정·간접 소유·전환 펀드), 2a51-3(목적형성 회사의 전원-QP look-through), 3c-1(§3(c)(1) beneficial owner 산정), 3c-5(Knowledgeable Employee 제외), 3c-6(증여·상속·이혼 등 비자발적 이전 처리).

**핵심 판단들.** (a) "investments"를 증권·투자부동산·상품·금융계약·현금성 등으로 정의하고, 주거·사업용 부동산은 제외하며, 취득용 차입금은 차감하도록 했다. (b) QIB(Rule 144A)를 별도 입증 없이 QP로 간주했다. (c) 펀드 운용에 정통한 임직원(KE)은 자산요건 없이 "전원 QP" 판정에서 제외했다. (d) 펀드 지분을 사려고 급조된 회사는 구성원 전원이 QP일 때만 QP로 인정하도록 했다. (e) 기존 §3(c)(1) 펀드의 §3(c)(7) 전환 시 1996년 이전 보유자 처리를 정했다.

**Decipher에서의 쓰임.** 직접 PASS/FAIL 규칙은 아니지만, 위 규칙들이 "왜 이렇게 정해졌는지"(입법·해석 취지)를 담고 있어 off-chain 검증 기준을 설계하거나 §12 Open Issue를 해석할 때 1차 근거로 쓴다.

**No-Action Letters(실무 해석 — 변호사 확인 대상).** §3(c)(7)/QP의 회색지대를 다루는 SEC staff 자료다. No-Action Letter는 특정 사실관계에 한정되고 SEC를 법적으로 구속하지 않으므로, 본 문서는 쟁점만 정리하고 구체 결론은 §12로 보내 변호사가 원문을 직접 확인하도록 한다. 핵심 세 건:

**(1) Davis Polk & Wardwell letter (1997-04-24, File No. 132-3, Ref. No. 97-177-CC).** 위 Rule들의 시행일(1997-06-09) 직전 상황을 다룬 전환기 letter다. 세 가지를 묻고 답했다 — ① 규칙 시행 전이라도 issuer가 §3(c)(7)에 의존해 QP에게 증권을 발행할 수 있는지(전환기 타이밍), ② 기존 §3(c)(1) 펀드를 §3(c)(7)로 전환할 때 어느 보유자가 사전 통지·환매 기회를 받아야 하는 beneficial owner인지, ③ Rule 2a51-1상 지배지분(controlling interest)과 투자자 차입금(investor indebtedness)을 investments 계산에서 어떻게 처리하는지. Decipher에 직접 적용되진 않지만 beneficial owner 산정·investments 차감 실무의 해석 근거다.

**(2) ABA Subcommittee on Private Investment Entities letter (1999-04-22).** 신탁(trust)과 가족 투자기구(family investment vehicle)의 QP 판단을 다룬 staff response다. 핵심은 이들을 들여다볼 때 settlor(위탁자)·trustee(수탁자)·contributor(출연자)·beneficiary(수익자) 중 누구의 QP 자격을 따져야 하는가이다(§2(a)(51)(A)(ii)·(iii) look-through 실무). A-09(look-through) 설계 시 참조하되 결론은 변호사 확인 대상이다.

**(3) Goodwin, Procter & Hoar letter (1997-02-28).** 비-US(역외) 펀드의 §3(c)(7) 적용 맥락을 다룬 letter로, 역외 펀드 구조에서 QP 요건이 어떻게 작동하는지에 대한 보충 자료다. 국경 간 구조를 검토할 때만 참조한다.

### 3.19 Sub-요건 분해 매트릭스

위 조문·규칙을 실무 판정 path로 분해하면 다섯 갈래가 된다. 각 행은 소리 내 읽어도 문장이 되도록 풀어 썼다.

| 판정 path | 충족 조건(풀어 읽기) | 근거 | Decipher 복잡도 |
|---|---|---|---|
| (i) 자연인 | 자연인이고, 투자자산이 $5M 이상이다 | §2(a)(51)(A)(i) | 🟢 낮음 — 단일 증명 |
| (ii) Family Company | 회사이고, 투자자산 $5M 이상이며, 가족관계로 묶인 2인 이상이 직간접 소유한다 | §2(a)(51)(A)(ii) | 🟡 중간 — look-through 필요 |
| (iii) Trust | 신탁이고, 특정 증권 취득 목적으로 만든 게 아니며, 수탁자와 모든 위탁자가 각각 (i)·(ii)·(iv)에 해당한다 | §2(a)(51)(A)(iii) | 🔴 높음 — 복합 판정 |
| (iv) $25M 재량운용 (any person) | $25M 이상을 자기/타 QP 계산으로 재량 운용한다 | §2(a)(51)(A)(iv) | 🟡 중간 — 재량운용 검증 |
| (QIB) | Rule 144A상 QIB(증권 $100M 이상 보유·재량운용하는 기관)이면 별도 자산 입증 없이 QP로 간주된다 | Rule 2a51-1(g)(1) | 🟢 낮음 — QIB 지위만 확인 |
| (목적형성 회사) | 이 펀드 매수 목적으로 만든 회사라면, 모든 beneficial owner가 각각 QP여야 한다 | Rule 2a51-3 | 🔴 높음 — 전원 look-through |
| (KE 제외) | 펀드 임직원이면 자산요건 없이 exclusively-QP 판정에서 제외된다 | Rule 3c-5 | 🟡 중간 — 고용·관여 증명 |

**해설:** 위에서 (i)·(iv)는 비교적 단순(자산 금액 한 번 확인)하지만, (ii)·(iii)·목적형성 회사는 그 안의 사람들을 따라 들어가야 한다(look-through). KE는 자격을 부여하는 게 아니라 판정에서 빼주는 경로라는 점에서 결이 다르다. 이 다섯 갈래가 §4(어떤 증거가 필요한가)와 §5(어떻게 판정하는가)의 토대다.

---

### 3.20 ERC-3643 변환·claim.basis 총정리

A-13의 법조문이 실제 ERC-3643/T-REX 토큰에서 어떻게 구현되는지를 두 표로 정리한다. 첫 표는 각 조항이 ERC-3643의 어느 구성요소(claim topic · Identity Registry · Compliance 모듈 · forced-transfer 등)로 옮겨지는지, 둘째 표는 판정 결과가 어떤 `claim.basis`·플래그 값으로 기록되는지를 보여준다. 핵심 원칙 하나 — investments 계산·평가·차감·look-through 같은 법률 판단은 전부 off-chain에서 Trusted Issuer가 수행하고, 온체인에는 그 결과인 claim(서명된 자격 증명)만 올라간다.

**표 1 — 조항 → ERC-3643 변환**

| 조항 | ERC-3643 변환 | 간략 설명 |
|---|---|---|
| §2(a)(51)(A) QP 정의 | "QP 자격" claim topic을 매수인 ONCHAINID에 발급 | 4갈래(자연인·가족회사·신탁·$25M) 충족을 off-chain 판정 후 Trusted Issuer가 claim 서명 |
| §3(c)(7)(A) Condition 1 (전원 QP) | Identity Registry `isVerified()` + Compliance 모듈 | QP claim 없는 지갑으로의 transfer를 토큰이 거부 → "모든 보유자 QP"가 자동 강제됨 |
| §3(c)(7)(A) 비자발적 이전 예외 | forcedTransfer / recovery 경로 (일반 canTransfer와 분리) | 상속·이혼 등은 agent의 강제 이전으로 처리, 일반 transfer 게이트 우회 |
| Rule 2a51-1(a)(b) investments 정의 | off-chain 계산의 입력 — 온체인엔 결과만 | 자산 7종 분류는 Trusted Issuer가 오프체인에서 수행 |
| Rule 2a51-1(c)(d)(e)(f) 평가·차감 | off-chain valuation·차입금 차감 → claim 발급 조건 | FMV/원가 평가·취득용 차입금 차감도 전부 오프체인, 온체인엔 결과만 |
| Rule 2a51-1(h) reasonable belief | Trusted Issuer의 claim 서명 행위 = "합리적 신뢰"의 구현 | 안전항이 claim 신뢰 모델 전체의 법적 토대(§8·§10) |
| Rule 3c-5 KE 제외 | KE 전용 claim(자산요건 면제) | 펀드 임직원은 자산 입증 없이 QP claim 발급, coveredCompany=fundId 확인 |
| Rule 2a51-2·2a51-3 look-through | claim 발급 전 off-chain beneficial-owner 검증 | 법인·신탁 매수인은 구성원 전원 QP 확인 후에만 claim 발급(A-09) |
| Rule 3c-6 비자발적 이전 | forcedTransfer / recovery 함수와 정합 | 비자발적 이전분은 QP 간주 → 강제 이전 후에도 면제 유지 |
| Exchange Act §12(g) 2,000-holder | Compliance의 holder-count(maxHolders) 모듈 | 보유자 수를 온체인에서 카운팅, 2,000명 임계 추적·차단(부품 D-01) |
| JOBS Act §201(b)(2) | (온체인 구현 없음) — 발행 측 법적 전제 | 506(c) 일반청약이 공모가 아님을 보장, transfer 로직과 무관 |

**표 2 — 조항·항목 → claim.basis / 플래그 값**

| 조항·항목 | claim.basis / 플래그 값 | 간략 설명 |
|---|---|---|
| §2(a)(51)(A)(i) 자연인 | QP_NATURAL | investments ≥ $5M |
| §2(a)(51)(A)(ii) 가족회사 | QP_FAMILY_COMPANY | 가족 2인+ 소유, investments ≥ $5M |
| §2(a)(51)(A)(iii) 신탁 | QP_TRUST | trustee·settlor 전원이 (i)/(ii)/(iv) QP ((iii) 제외) |
| §2(a)(51)(A)(iv) $25M 재량운용 | QP_INSTITUTIONAL | any person, 재량운용 investments ≥ $25M (관용상 "기관"으로 부름) |
| Rule 2a51-1(g)(1) QIB | QP_QIB | QIB(Rule 144A)는 별도 입증 없이 QP 간주 |
| Rule 3c-5 KE | KNOWLEDGEABLE_EMPLOYEE_EXCLUSION | 펀드 임직원, 자산요건 없이 제외(+coveredCompany=fundId) |
| Manifest 펀드 면제 통로 | fundExemption = ICA_3C7 | 이 펀드가 §3(c)(7)로 면제됨을 명시 |
| investments 입증 여부 | investmentsVerified = true | $5M/$25M 자산 입증 완료 |
| Rule 2a51-1(d) 평가 방식 | valuationMethod = FMV / COST | 공정가치 또는 원가 |
| Rule 2a51-1(e)(f) 차입금 차감 | debtAdjustmentChecked = true | 취득용 차입금 차감 확인 |
| look-through 상태 | lookThroughStatus = COMPLETED / PENDING / FAILED | 법인·신탁 beneficial-owner 검증 상태(A-09) |

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

쉽게 말하면, 본 부품이 "이 사람이 펀드를 살 자격이 있다"고 말하려면 네 가지 질문에 대한 답이 *증거(evidence)로* 모여 있어야 한다.

1. **이 매수인은 어느 갈래인가?** (자연인·Family Company·Trust·$25M any person·QIB 중 무엇인가, 또는 Knowledgeable Employee 제외 대상인가)
2. **그 갈래의 문턱을 넘는가?** (자연인·가족회사 $5M, $25M any person, QIB 지위, 또는 KE의 직위·근속 요건)
3. **그 증거를 신뢰할 수 있는 기관이 검증·서명했는가?** (Trusted Issuer가 확인했는가)
4. **그 증거가 지금도 유효한가?** (취득 시점 기준으로 너무 오래되지 않았는가)

이 네 답을 모으는 주체는 **Trusted Issuer**(KYC·due diligence를 수행하는 신뢰기관)이고, 모은 결과는 **on-chain claim**(블록체인에 기록된 서명 증명서) 형태로 발행되어 DEX가 조회할 수 있게 된다. 전체 정보 흐름은 frontend 자기신고 → Trusted Issuer 실사 → on-chain claim 발급 → DEX가 거래 직전 조회다.

### 4.2 Data field — DEX가 실제로 읽는 항목

> 아래 필드 이름·ONCHAINID Topic 번호 등은 Decipher의 ERC-3643 호환 구현을 전제한 예시 스펙이다(구현 시 확정). 각 행에 "이 필드가 왜 필요한가"를 함께 적었다.

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `claim.basis` | enum | Trusted Issuer claim | 매수인이 어느 갈래인지(QP_NATURAL·QP_FAMILY_COMPANY·QP_TRUST·QP_INSTITUTIONAL·KNOWLEDGEABLE_EMPLOYEE_EXCLUSION) |
| `claim.verifiedAt` | timestamp | Trusted Issuer claim | claim이 언제 발급됐는지(유효기간 판정용) |
| `claim.issuer` | address | Trusted Issuer claim | 어느 Trusted Issuer가 발급했는지(신뢰성 확인용) |
| `claim.coveredCompany` | string | Trusted Issuer claim (KE 전용) | KE가 어느 펀드 소속인지 명시 |
| `claim.signature` | bytes | Trusted Issuer claim | 위·변조 방지용 서명 |
| `claim.investmentsValue` | uint256(선택) | Trusted Issuer claim | 문턱 충족 여부(금액 자체는 Trusted Issuer가 사전 판정, DEX는 "문턱 이상" 신뢰) |
| `lookThroughChain[]` | array | Trusted Issuer claim (가족·신탁 전용) | 하위 소유자들의 QP 증명 참조(look-through cascade용) |
| `block.timestamp` | timestamp | blockchain | 거래 확정 시점(취득 시점 스냅샷) |

**쉽게 말하면:** DEX는 매수인의 자산 명세서를 직접 들여다보지 않는다. 대신 **"신뢰기관이 이미 확인했다고 서명한 증명서"를** 본다. 그 증명서에 "어느 갈래(basis)인지, 언제 확인했는지(verifiedAt), 누가 보증하는지(issuer)"가 담긴다.

### 4.3 수집 경로 — 5단계 흐름

```
1단계  Frontend 자기신고      매수인이 DEX에서 KYC 시작 + 자기 갈래 선택
   ↓
2단계  증거 제출              매수인 → Trusted Issuer에 증빙 제출
                            (예: brokerage statement·부동산 감정서·고용증명·trust deed)
   ↓
3단계  Off-chain 실사         Trusted Issuer가 Rule 2a51-1·3c-5에 따라 법적 판단
                            + reasonable belief(합리적 신뢰) 형성
   ↓
4단계  On-chain claim 발급    Trusted Issuer가 서명한 claim을 블록체인에 기록
   ↓
5단계  DEX 거래 직전 검사      DEX가 claim 조회 → 본 부품 판정 → PASS 또는 FAIL code
```

**각 단계 누가·무엇을·결과:** 1단계(매수인이, 자기 갈래를 고르고, 어떤 증거를 낼지 분기가 정해진다) → 2단계(매수인이, 증빙 서류를 제출하고, Trusted Issuer 손에 자료가 모인다) → 3단계(Trusted Issuer가, 법적 판단을 하고, 합리적 신뢰가 형성된다) → 4단계(Trusted Issuer가, 서명 claim을 올리고, 온체인에 조회 가능한 증명서가 생긴다) → 5단계(DEX가, claim을 확인하고, 통과/거절이 결정된다).

**핵심:** DEX는 5단계에서 결정론적 확인만 한다. 가족관계의 적법성, trust 설립목적의 남용 여부, KE의 실질 관여 같은 판단은 모두 3단계에서 Trusted Issuer가 off-chain으로 하고, 그 결과를 claim에 *부호화(encode)한다*. 이 분리가 왜 불가피한지는 §5.5와 §8에서 설명한다.

### 4.4 갈래별 증거 예시

| 갈래 | 필수 확인 항목(전부 필요) | 무엇을 입증하나 |
|---|---|---|
| (공통 — 모든 갈래) | ① 신원확인(KYC) · ② Trusted Issuer가 서명한 QP claim · ③ claim 발급일(freshness, §5.0/A-11) · ④ 발급기관이 Trusted Issuer Registry에 등재 | 모든 갈래의 전제 — 서명·신뢰·신선도 |
| 자연인 (QP_NATURAL) | ① 투자자산 명세(brokerage·예금·상품계좌 등) · ② 각 자산 FMV 평가 · ③ 취득용 차입금 차감 내역 | investments ≥ $5M (차감 후 순액) |
| 가족회사 (QP_FAMILY_COMPANY) | ① 회사 투자자산 명세·FMV · ② 지분구조도 · ③ 가족관계 증빙(2인 이상) · ④ 하위 소유자 look-through 자료 | 회사 자산 $5M + 가족 2인+ 직간접 소유 + 구성원 QP |
| 신탁 (QP_TRUST) | ① trust deed · ② 설립일(특정 증권 취득 목적 형성 아님) · ③ 수탁자 신원·QP 증빙 · ④ 모든 위탁자 신원·QP 증빙 | 결합요건(수탁자+전 위탁자가 (i)/(ii)/(iv) QP) + 비-특정목적 |
| $25M 재량운용 (QP_INSTITUTIONAL) | ① 법인 등록 · ② 재량운용 권한 증빙 · ③ $25M 투자자산·FMV·차감 | any person이 $25M 이상 재량 운용 |
| QIB (QP_QIB) | ① Rule 144A QIB 지위 증빙(보유 증권 $100M 이상 재량운용; 딜러는 $25M 이상 자기계산) | QIB = QP 간주, 자산 재계산 불요 |
| Knowledgeable Employee (KE 제외) | ① 고용계약·직무기술서 · ② 근속·직위 증빙 · ③ 투자활동 관여 자기진술 · ④ 소속 펀드(coveredCompany) 일치 · ⑤ 신뢰기관 검증 | Rule 3c-5 직위(i) 또는 관여+12개월(ii) |

---

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.0 판정 흐름 플로우차트

아래 그림은 §5.2의 `check_A_13` pseudocode를 흐름으로 옮긴 것이다 — claim 신선도 확인부터 basis 갈래 분기(KE·QIB·자연인/$25M·가족회사/신탁), 임계·look-through 판정, (h) reasonable belief, 그리고 PASS·각 FAIL code 반환까지.

![그림 5.0 — A-13 판정 로직 흐름: 입력에서 PASS/FAIL/REVIEW code까지](fig/fig50.png)

**범례.** 파랑 = 핵심 판정 경로 · 회색 = 분기 노드 · 초록 = PASS(또는 KE 제외 통과) · 빨강 = FAIL code · 주황 = 수동 검토(REVIEW).

### 5.1 전체 흐름 (사람 말로)

증거(claim)가 모인 뒤, 온체인 코드는 다음 순서로 확인한다 — ① claim이 존재하는가 → ② 위조 아닌가·신뢰기관이 발급했는가 → ③ 유효기간이 지나지 않았는가 → ④ 어느 갈래인가에 따라 갈래별 추가 확인 → ⑤ PASS 또는 구체적 FAIL code 반환.

### 5.2 Pseudocode + 단계별 해설

**검사 순서 한눈에 보기 — 왜 이 순서인가**

| 순서 | 검사 | 무엇을 확인 | 실패 코드 | 비용 | 왜 이 위치인가 |
|---|---|---|---|---|---|
| 1 | claim 존재 | 매수인 지갑에 QP claim이 있나 | FAIL_NOT_QP | 매우 낮음 | claim이 없으면 판정할 대상 자체가 없음 |
| 2 | 진위(서명·발급기관) | 서명 유효 + 발급기관이 Trusted Issuer Registry 등재 | FAIL_NOT_QP(위조) · FAIL_UNTRUSTED_QP_CLAIM_ISSUER | 낮음 (암호 검증) | 위조면 claim 안의 verifiedAt·basis를 신뢰 불가 → 진위가 모든 하류 검사의 전제 |
| 3 | 신선도(freshness) | block.timestamp − verifiedAt ≤ 상한(1년 권고) | FAIL_QP_CLAIM_EXPIRED | 낮음 (timestamp 비교) | 싸고 탈락 잘 되는 게이트 → 비싼 look-through 전에 fail-fast |
| 4 | 갈래 분기 + look-through | claim.basis별 판정(가족·신탁은 구성원 전원 QP cascade) | FAIL_FAMILY_CO_NOT_QP 등 | 높음 (look-through cascade) | 가장 비싼 단계라 맨 뒤 — 1~3을 통과한 claim에만 수행 |

두 그림이 같은 순서를 다르게 그릴 뿐임을 보이는 대조표:

| 검사 | §5.2 pseudocode | §5.0 흐름도(fig50) |
|---|---|---|
| 1 존재 · 2 진위 | 1·2단계로 명시 | "입력"에 묶어 표현 |
| 3 신선도 | 3단계 | 입력 직후 첫 게이트 |
| 4 갈래·look-through | 4단계 | basis 분기 노드 |

→ 두 표현 모두 **신선도가 갈래보다 앞** = 동일 순서다. fig50은 존재·진위를 "입력"에 합쳐 freshness가 첫 게이트로 보이고, §5.2는 그 둘을 따로 단계로 드러낼 뿐이다. 핵심 원리는 둘 다 같다 — **싼 전제(존재·진위·신선도)로 fail-fast한 뒤, 비싼 look-through는 맨 마지막**.

```
function check_A_13(prospective_buyer, asset, block):
    # 1단계: claim 조회
    claim = ONCHAINID.getClaim(prospective_buyer, Topic.QP)
    if claim == null:
        return FAIL_NOT_QP

    # 2단계: 서명·발급기관 신뢰 확인
    if not Cryptography.verify(claim.signature, claim.issuer):
        return FAIL_NOT_QP   # 위조 의심
    if not TrustedIssuerRegistry.contains(claim.issuer):
        return FAIL_UNTRUSTED_QP_CLAIM_ISSUER

    # 3단계: 유효기간(취득 시점 스냅샷)
    freshness_cap = 1 year   # Decipher 권고(5년 보수 옵션 가능)
    if claim.verifiedAt < block.timestamp - freshness_cap:
        return FAIL_QP_CLAIM_EXPIRED

    # 4단계: 갈래(basis) 분기
    if claim.basis == QP_NATURAL:          # $5M은 Trusted Issuer가 사전 판정
        return PASS
    elif claim.basis == QP_FAMILY_COMPANY:         # 가족회사 → look-through
        if not check_A_09(claim.lookThroughChain):
            return FAIL_QP_LOOKTHROUGH_NOT_COMPLETED if A09.in_progress
                   else FAIL_FAMILY_CO_NOT_QP
        return PASS
    elif claim.basis == QP_TRUST:          # 수탁자+모든 위탁자 QP여야
        if not check_trust_qp(claim.lookThroughChain):
            return FAIL_TRUST_DISQUALIFIED
        return PASS
    elif claim.basis == QP_INSTITUTIONAL:          # (iv) $25M — 법인이면 Trusted Issuer가 급조(2a51-3) 확인 후 발급
        return PASS
    elif claim.basis == QP_QIB:            # Rule 2a51-1(g)(1) — QIB는 QP 간주
        return PASS
    elif claim.basis == KNOWLEDGEABLE_EMPLOYEE_EXCLUSION:   # 소속 펀드 일치 확인
        if claim.coveredCompany != asset.fund_identifier:
            return FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED
        return PASS
    else:
        return REVIEW_QP_UNCERTAIN
```

- **1단계 해설:** 매수인 주소에 연결된 QP claim을 찾는다. 아직 Trusted Issuer에게 claim을 받지 않았다면 여기서 `FAIL_NOT_QP`. 매수인은 frontend가 안내하는 대로 Trusted Issuer로 가서 KYC를 시작하면 된다.
- **2단계 해설:** 서명을 검증하고, 발급기관이 Decipher가 신뢰하는 명부(Trusted Issuer Registry)에 있는지 본다. 서명이 깨졌으면 위조 의심으로 `FAIL_NOT_QP`, 서명은 멀쩡한데 발급기관이 명부에 없으면 `FAIL_UNTRUSTED_QP_CLAIM_ISSUER`(대개 명부 갱신 지연 같은 운영 이슈라 관리자에게 알림).
- **3단계 해설:** 여기서 §3(c)(7)(A)의 "at the time of acquisition"(취득 시점) 요건을 본다. claim 발급 후 1년이 지났으면 `FAIL_QP_CLAIM_EXPIRED`. 취득 시점에 유효한 KYC가 있어야 한다는 요건을 1년 cap으로 구현한 것이다(어느 블록 timestamp를 기준으로 잡을지는 §5.4).
- **4단계 해설:** claim의 갈래에 따라 분기한다. 자연인·$25M(any person)은 금액 판정을 Trusted Issuer가 이미 했고 QIB는 간주이므로 통과. **단 (iv) 매수인이 *법인*이면, 그 사전 판정에 Rule 2a51-3 급조 확인 — formedForSpecificPurpose=false, 또는 beneficial owner 전원 QP — 이 반드시 포함되어야 하며 '법인 $25M → 무조건 PASS'로 끝내면 안 된다(§3.16).** 가족회사·신탁은 그 안의 사람들을 확인하는 cascade가 돈다. KE는 소속 펀드(coveredCompany)가 지금 사려는 펀드와 같은지를 확인해, 남의 펀드에 KE 자격을 끌어다 쓰지 못하게 막는다.

### 5.3 Threshold 매트릭스

| 항목 | 값 | 근거 |
|---|---|---|
| 자연인 | investments ≥ $5M (inclusive — 정확히 $5M이면 통과) | §2(a)(51)(A)(i) "not less than" |
| Family Company investments | ≥ $5M (inclusive) | §2(a)(51)(A)(ii) "not less than" |
| $25M 재량운용 | investments ≥ $25M (inclusive) | §2(a)(51)(A)(iv) "not less than" |
| Knowledgeable Employee 근속 | ≥ 12개월(직위형 KE는 근속요건 없음) | Rule 3c-5(a)(4)(ii) |
| Claim 유효기간 cap | 1년(권고)·5년(보수 옵션) | 취득시점 요건 + Claim Freshness 부품(A-11) 조율 |

**inclusive 해석 reasoning:** 조문이 "not less than $5,000,000"(5백만 달러보다 적지 않은)으로 쓰였다. 영어 법조문에서 "not less than"은 **≥(이상, inclusive)으로** 읽는다. 따라서 정확히 $5M인 경우는 통과다. §7.3 경계 테스트에서 명시적으로 확인한다.

### 5.4 Time-of-acquisition — 블록체인의 어느 시점을 "취득"으로 보나

§3(c)(7)(A)는 판정 기준 시점을 "at the time of acquisition"으로 못 박는다. 전통 금융에서는 계약 체결 시점이 명확하지만, 블록체인 DEX에는 시점 후보가 여럿이다. 비유하면 — 주문서에 사인한 순간과 등기소에 등기가 찍힌 순간 중 어느 것을 "취득"으로 볼 것인가의 문제다.

| 시점 후보 | "취득 시점" 부합도 | 운영 리스크 |
|---|---|---|
| Trade matching time(오프체인 주문 체결) | 불일치 — 아직 정산 미확정 | 높음(정산 실패 가능) |
| Transaction proposed time(mempool 진입) | 불일치 — 포함 보장 없음 | 높음(re-org·교체 가능) |
| Transaction confirmed time(블록 포함) | **최적** — 법적 "execution"에 가장 부합 | 낮음(단일 블록 확정) |
| Transaction finalized time(완결성 확보) | 보수적 부합 — 필요 이상 늦음 | 가장 낮음 |

**Decipher 권고:** block confirmation timestamp 기준. 거래가 블록에 포함되어 확정된 시점의 `block.timestamp`를 취득 시점으로 본다. 경계 거래(예: claim 만료 30초 전 매칭 → 30초 후 confirmation)에서는 이 기준상 `FAIL_QP_CLAIM_EXPIRED`가 날 수 있으므로, frontend에서 매칭 직전 조기 안내·재발급 유도를 권고한다(UX, §11). 정확히 어느 timestamp가 법적 "acquisition time"인지는 변호사 확인 대상이다(§12).

### 5.5 비결정성을 결정성으로 — 본 부품 구현의 본질

여기에 결정적인 법-기술 통찰이 있다. **QP 판정은 순수한 결정론적 계산이 아니라, 사람의 판단(judgment)을 내포한다.** 조문 곳곳이 판단을 요구한다 — §2(a)(51)(A)(ii)의 "가족관계로 묶였는가"는 사실관계 판단, (iii)의 "특정 증권 취득 목적으로 만든 게 아닌가"는 의도 판단, Rule 2a51-1(b)(1)의 "지배·공동지배 관계인가"는 지배구조 판단, (d)의 "최근 FMV는 얼마인가"는 평가 판단이다.

이 판단들은 온체인 코드로 재현할 수 없다. 그래서 Rule 2a51-1(h)의 reasonable belief 안전항에 기대어, Trusted Issuer가 off-chain에서 실사·판단을 하고 그 결과를 claim으로 부호화하는 구조가 불가피하다. 즉 **본 부품의 구현 본질은 "비결정적 법적 판단을 결정적 증명서 확인으로 캡슐화하는 것"이다**. 온체인 로직은 "claim이 있는가·서명이 유효한가·발급기관을 믿는가·기간이 지났는가"라는 결정론적 확인만 하지만, 그 claim 뒤에는 Trusted Issuer의 비결정론적 판단이 담겨 있다.

**쉽게 말하면(비유):** 판사가 판결문에 서명한다. 서명된 판결문 자체는 명확하고 결정적인 문서다 — 하지만 그 판결에 이르는 과정은 판사의 복잡한 판단·형량의 결과다. 본 부품도 똑같다. Trusted Issuer의 서명된 claim은 기계가 명확히 확인할 수 있는 결정적 문서지만, 그 발급 과정은 사람의 법적 판단이다. 기계는 판결문의 위·변조만 확인하고, 판결 자체는 사람(Trusted Issuer)이 한다.

---

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

검사가 실패하면 거래가 그 자리에서 차단되거나(reject), 일부 경우엔 대기 상태로 전환된다(suspend). 어떤 종류의 실패인지에 따라 ① 매수인에게 보이는 메시지, ② 매수인이 해야 할 다음 행동, ③ Decipher 측 조치가 달라진다. 아래 표는 "기술 코드"가 아니라 시나리오 풀이로 읽으면 된다.

### 6.2 Failure codes 9종

| Code | 언제 뜨나 | 무엇이 문제인가 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_NOT_QP` | claim 없음·갈래 불일치·서명 위조 | 아직 QP 증명서가 없거나 증명서가 위조됨 | Trusted Issuer에서 KYC 시작/재시도 | frontend에 재안내 링크 |
| `FAIL_QP_CLAIM_EXPIRED` | verifiedAt < (block.timestamp − 유효기간) | 증명서가 오래되어 만료(1년 경과) | Trusted Issuer에 갱신 요청 | frontend에 갱신 안내 |
| `FAIL_UNTRUSTED_QP_CLAIM_ISSUER` | 발급기관이 신뢰 명부에 없음 | Decipher가 신뢰하지 않는 기관이 발급 | 다른 Trusted Issuer에서 재발급 | 관리자 알림·명부 갱신 검토 |
| `FAIL_QP_LOOKTHROUGH_REQUIRED` | 가족회사·신탁인데 하위 소유자 정보 없음 | 들여다볼 구성원 자료가 비어 있음 | 추가 KYC 자료 제출 | Trusted Issuer가 look-through 자료 보강 |
| `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED` | look-through 진행 중(일부 구성원 미완료) | 구성원 일부의 KYC가 아직 안 끝남 | 기다리거나 해당 구성원 재촉 | 거래 suspend(거절이 아닌 대기) |
| `FAIL_TRUST_DISQUALIFIED` | 수탁자·위탁자 중 QP 미충족자 있음 | 신탁 결합요건을 못 맞춤 | 신탁 자격·구조 재검토 | 신탁 측에 상세 안내 |
| `FAIL_FAMILY_CO_NOT_QP` | 가족회사 구성원 중 QP 미충족자 있음 | 한 명이라도 자격 미달이면 전체 탈락 | 해당 소유자 추가 KYC 또는 출자 조정 | 가족회사 측에 상세 안내 |
| `FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED` | 소속펀드 불일치·근속/관여 미충족 | KE 요건을 못 맞춤 | KE 자격 재검증 또는 다른 경로 시도 | HR 측 증빙 보강 |
| `REVIEW_QP_UNCERTAIN` | 자동 판정 불가(경계 케이스·명부 갱신 중 등) | 기계가 결정할 수 없는 복잡 케이스 | 수동 검토 결과 대기 | Trust Operations 큐로 라우팅 |

**해설:** 대부분의 실패는 되돌릴 수 있는 상태다. `FAIL_NOT_QP`나 `FAIL_QP_CLAIM_EXPIRED`는 매수인이 KYC를 시작·갱신하면 풀린다. 반면 `FAIL_FAMILY_CO_NOT_QP`·`FAIL_TRUST_DISQUALIFIED`는 구조 자체의 문제라 구성원 보강이나 구조 변경이 필요하다. `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED`만 유독 *거절이 아닌 대기(suspend)인데*, 이는 "자격이 없다"가 아니라 "아직 확인 중"이기 때문이다 — 시간이 지나 구성원 KYC가 끝나면 같은 거래가 통과될 수 있다.

### 6.3 Manual Review Path (REVIEW_QP_UNCERTAIN 처리)

자동 판정이 불가능한 경계 케이스는 사람이 처리한다. 흐름은 이렇다.

1. 거래가 suspend(거절이 아닌 대기) 상태로 전환된다.
2. `REVIEW_QP_UNCERTAIN`이 수동 검토 큐에 쌓인다.
3. Decipher Trust Operations team이 큐에서 집어 든다(목표 응답시간 SLA 24~72시간 — 운영 정책으로 확정 대상).
4. 팀이 추가 증거를 요청하거나, 경계의 법적 판단을 하거나, 필요하면 변호사 자문으로 escalate한다.
5. 최종 결정(통과 또는 명시적 FAIL code)을 내리고, 통과면 별도 claim 발급으로 반영한다.
6. 모든 결정과 근거(reasoning)를 Compliance Log에 남긴다(off-chain audit trail).

**누가 결정하나:** 최종 판단 권한은 추가 실사를 한 Trusted Issuer 또는 Decipher Trust Operations에 있고, 그 결정은 새 claim으로 온체인에 반영되어 다음 거래부터 자동 판정된다.

### 6.4 Error message — 매수인 노출용 vs 내부 기록용 분리

개인정보 보호와 운영 진단을 분리한다. 매수인에게는 일반적이고 행동 가능한 메시지만 보여주고, 구체적 실패 사유는 내부 audit log에만 남긴다.

| Code | 매수인 노출(frontend) | 내부 기록(audit) |
|---|---|---|
| `FAIL_NOT_QP` | "QP 자격 확인이 필요합니다. KYC를 진행해 주세요." | claim 부재 timestamp + 매수인 주소 |
| `FAIL_QP_CLAIM_EXPIRED` | "KYC 인증이 만료되었습니다. 갱신해 주세요." | claim.verifiedAt + 경과 일수 |
| `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED` | "추가 정보 확인 중입니다. 잠시 후 다시 시도해 주세요." | 미완료 구성원 목록 |
| `FAIL_TRUST_DISQUALIFIED` | "Trust 구조 검토가 필요합니다. KYC팀에 문의해 주세요." | 미충족 수탁자/위탁자 목록 |

**이유:** 매수인에게 "당신 신탁의 위탁자 중 X가 자격 미달"이라고 노출하면 다른 사람의 자산정보가 새 나갈 수 있다. 그래서 노출 메시지는 **무엇을 하라**만, 내부 로그는 **왜 막혔나**를 담는다.

---

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

다섯 가지 극단 시나리오로 검증한다. 다섯 케이스가 모두 기대대로 동작해야 스펙이 완성(complete)이다.

### 7.1 Test 1 — Pass (명백한 통과)

**시나리오:** 미국 거주 45세 자연인. 주식·채권 portfolio가 FMV $7M(brokerage statement로 입증). Trusted Issuer Y가 2026-05-01에 QP claim 발급. 2026-06-13에 BUIDL 매수 시도.

**기대 결과:** PASS

**단계별 trace:** 1단계 claim 발견 ✅ → 2단계 Trusted Issuer Y는 명부 등록·서명 유효 ✅ → 3단계 1.5개월 경과(< 1년 cap) ✅ → 4단계 basis=QP_NATURAL → 추가 cascade 없이 PASS.

**해설:** 가장 전형적인 통과다. Trusted Issuer가 brokerage statement를 받아 FMV로 평가하고, 투자 취득용 차입금(있다면)을 Rule 2a51-1(e)로 차감한 뒤 $7M > $5M으로 판정해 claim을 발급했다. DEX는 그 claim의 진위·신뢰성·유효기간·갈래만 확인하고 통과시킨다. 금액 계산은 DEX가 하지 않는다.

### 7.2 Test 2 — Fail (명백한 거절)

**시나리오:** 미국 거주 자연인. investments $4.9M(같은 항목이되 $0.1M 부족). Trusted Issuer가 문턱 미달로 판정해 claim 발급을 거부.

**기대 결과:** FAIL_NOT_QP

**trace:** 1단계 claim 없음 → FAIL_NOT_QP.

**해설:** 문턱을 못 넘으면 Trusted Issuer가 애초에 claim을 발급하지 않는다. 그래서 DEX 입장에서는 "claim이 없다"는 사실만으로 FAIL_NOT_QP가 난다. 매수인은 frontend에서 "QP 자격 확인이 필요합니다"를 받고, 추가 증빙을 내거나 투자자산을 늘린 뒤 재시도하거나 다른 경로를 고려해야 한다. (여기서 "왜 막혔는지" 구체 금액은 매수인 화면에 노출하지 않는다 — §6.4.)

### 7.3 Test 3 — Boundary (정확히 $5M)

**시나리오:** 미국 거주 자연인. Rule 2a51-1 평가·차감을 거친 investments가 정확히 $5,000,000.

**기대 결과:** PASS (inclusive 해석)

**경계 sub-질문 해소:**

| 질문 | 결정 | 법적 reasoning |
|---|---|---|
| $5M은 inclusive(≥)인가 exclusive(>)인가 | inclusive (≥) | §2(a)(51)(A)(i)이 "not less than"으로 명시 → 영어 법조문상 "≥". 정확히 $5M이면 통과 |
| 주거·사업용 부동산 포함 여부 | 제외 | Rule 2a51-1**(c)**: 본인·가족 거주나 사업장으로 쓰는 부동산은 "investment purposes"가 아님 |
| 차입금 차감 범위 | 투자 취득용 차입만 차감 | Rule 2a51-1**(e)**: "incurred to acquire ... the Investments". 일반 주택담보·사업자금 대출은 차감하지 않음 |
| 손실 종목 net 처리 | FMV 기준이라 자동 반영 | Rule 2a51-1(d): "fair market value as of a recent date" — 최근 시가에 손실이 이미 반영됨 |

**해설:** 경계에서 법률가가 명확히 정해 주지 않으면 개발자가 임의로 결정하게 되고, 그 임의 결정이 곧 부당한 차단(정당한 매수인을 막음)이나 부당한 통과(자격 미달자를 통과)로 이어진다. 위 네 질문의 reasoning이 테스트 케이스에 명시돼야 스펙이 완성된다.

### 7.4 Test 4 — Cascade (3단 가족회사 look-through)

**시나리오:** **BUIDL 취득을 위해 특정 목적으로 형성된(급조) 다층 회사 구조** (구성원에 가족 LLC가 겹으로 들어간 형태). 급조 회사는 Rule 2a51-3(a)에 따라 구성원(beneficial owner) *전원이 QP*여야 QP로 인정된다 — 자체 $5M 충족 여부와 무관.

```
Layer 0  Family LLC A (매수 주체)
  ├─ Layer 1  Member 1 = Family LLC B (파트너 4명)
  │    ├─ Layer 2  파트너 1: 개인 investments $4M → NOT QP ❌
  │    ├─ Layer 2  파트너 2: 개인 investments $7M → QP ✅
  │    ├─ Layer 2  파트너 3: 개인 investments $6M → QP ✅
  │    └─ Layer 2  파트너 4: 개인 investments $8M → QP ✅
  └─ Layer 1  Member 2 = 개인 $9M → QP ✅
```

**기대 결과:** FAIL_FAMILY_CO_NOT_QP

**trace:** A-13 활성화 + basis=QP_FAMILY_COMPANY → look-through 부품(A-09) cascade → 재귀적으로 구성원 확인 → Layer 2 파트너 1이 $4M으로 QP 미충족 발견 → Family LLC B 전체 탈락 → Family LLC A(Layer 0) 전체 탈락 → 최종 FAIL_FAMILY_CO_NOT_QP.

**해설:** 왜 파트너 1의 $4M이 전체를 무너뜨리나? **Rule 2a51-3(a)** — 펀드 취득 목적으로 *급조된* 회사는 §2(a)(51)(A)(ii)·(iv)의 목적상 *구성원 전원이 QP가 아닌 한* QP로 보지 않는다 — 가 근거다. 급조 회사는 자체 자산 충족과 무관하게 전원-QP가 강제되므로, 단 한 명의 미달자가 사슬 전체를 끊는다. **⚠ 중요 — 진성(급조 아님) 가족회사와 구분:** 급조가 아닌 가족회사가 **자체로** investments $5M 이상을 보유하면 §2(a)(51)(A)(ii)로 *회사 단위*에서 QP이고 구성원 개별 QP는 따지지 않는다(§3.16.1). 따라서 이 all-beneficial-owner-QP cascade는 **급조 회사(2a51-3(a))** 또는 **자체 문턱 미달로 2a51-3(b) 허용경로에 기대는 회사**에만 적용된다. (재귀 깊이 한계는 §12 Open Issue.)

### 7.5 Test 5 — Knowledgeable Employee 예외

**시나리오:** BlackRock의 BUIDL Portfolio Manager. 개인 investments $3M(자연인 문턱 $5M 미달). 그러나 BlackRock Investment Management에서 36개월 근속, BUIDL 펀드의 executive officer 역할.

**claim:** basis=KNOWLEDGEABLE_EMPLOYEE_EXCLUSION / coveredCompany="BlackRock BUIDL Fund LLC" / 매수 대상 asset.fund_identifier="BlackRock BUIDL Fund LLC".

**기대 결과:** PASS

**trace:** 1~3단계 통과 → 4단계 basis=KNOWLEDGEABLE_EMPLOYEE_EXCLUSION → coveredCompany == asset.fund_identifier ✅ → $5M 문턱과 무관하게 PASS.

**해설:** Rule 3c-5(a)(4)(i)의 "Executive Officer"에 해당하는 Portfolio Manager는 직위만으로 Knowledgeable Employee가 된다(근속 12개월 요건은 (a)(4)(ii) 일반 직원에만 적용). 펀드 운영 내부자는 펀드 위험을 충분히 이해한다는 입법 판단이다. 정확히는 — Rule 3c-5(b)에 따라 이 사람의 보유분이 "exclusively QP" 판정에서 제외되므로, $5M이 없어도 자기 펀드에 투자할 수 있다. 본 부품은 여기에 소속 펀드 일치 확인을 더해, KE 자격을 남의 펀드 매수에 끌어다 쓰는 것을 막는다.

---

## §8. (α) 증명서 확인형 패턴 — 왜 이 방식인가

### 8.1 Decipher의 검증 방식 3패턴

Decipher는 법적 판정을 온체인 코드로 옮기는 방식을 세 가지로 나눈다.

| 패턴 | 이름 | 작동 방식 | 예시 |
|---|---|---|---|
| A | 직접 계산형 | 온체인 코드가 직접 비교·계산 | 나이 ≥ 18, 보유기간 ≥ 6개월, 제재명부 매칭 |
| B | 증명서 확인형 | off-chain 신뢰기관이 판단 → 서명 claim 발급 → DEX는 claim만 확인 | KYC·QP·Accredited Investor·Affiliate 판정 |
| C | 외부 oracle형 | 외부의 결정론적 데이터를 가져옴 | NAV·토큰 가격·환율 |

### 8.2 QP 판정에 패턴 B가 유일한 선택인 이유

**패턴 A는 불가능하다.** §5.5에서 본 비결정성 때문이다. 가족관계 판단(§2(a)(51)(A)(ii)), 지배관계 판단(Rule 2a51-1(b)(1)), 평가 판단(Rule 2a51-1(d)), KE의 실질 관여 판단(Rule 3c-5(a)(4)(ii))은 모두 *사람의 판단(judgment)이라* 온체인 코드가 재현할 수 없다.

**패턴 C도 불가능하다.** Oracle은 가격 피드처럼 *외부의 사실(fact)을* 전달하는 수단이다. "이 사람이 QP인가"는 사실 전달이 아니라 법적 판단이라, oracle이 줄 수 없다. 법적 판단을 제공하는 oracle은 존재하지 않는다.

**그래서 패턴 B만 남는다.** Trusted Issuer가 off-chain에서 실사·판단을 하고 결과를 서명 claim으로 전달하면, DEX는 그 claim의 결정론적 확인(서명·발급기관·기간·갈래)만 한다.

### 8.3 패턴 B의 법적 토대 — Rule 2a51-1(h) Reasonable Belief

이 방식이 법적으로 성립하는 근거가 Rule 2a51-1(h)의 reasonable belief 안전항(§3.13)이다. 펀드(또는 그를 대신하는 Relying Person)가 매수인을 합리적으로 QP라고 믿었다면, 사후에 실은 아니었음이 드러나도 면제가 곧바로 깨지지 않는다. Trusted Issuer가 그 "합리적 신뢰"를 형성·문서화하는 주체가 되고, 그 효과가 펀드(BlackRock)와 인프라(Decipher)로 어떻게 미치는지(cascade)는 §10.4 책임 분배에서 다룬다.

> **다시 강조:** 이 안전항은 (g)가 아니라 **(h)이며**, "reasonable care" 문구는 규칙 문언에 없다 — 실무상 상당한 주의가 요구된다는 취지와 규칙 문언을 구분해야 한다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

### 9.1 본 부품의 책임 경계

본 부품은 §3(c)(7)의 **Condition 1("취득 시점에 QP가 배타적으로 소유")만** 책임진다. **Condition 2("no public offering")는** 부품 하나로 끝나지 않는다 — Ralston Purina 4-factor(§3.18)가 DEX 거래환경 전체에 걸리는 Recipe-level 문제이며, "DEX의 secondary trading이 공모를 유발하는가"라는 질문은 Decipher의 No-Action Letter 신청 핵심 쟁점이다(§12).

또한 본 부품의 결과는 다른 부품·레시피와 누적적으로(cumulative) 작동한다. 가족회사 매수인은 look-through·affiliate·claim freshness 부품과 cascade되고, §3(c)(7) 레시피(R3) 외에 발행(R1)·재판매(R2) 레시피와도 함께 켜질 수 있다.

### 9.2 Element cascade map

```
A-13 (QP) ──┬─ (basis가 QP_FAMILY_COMPANY 또는 QP_TRUST) ──► A-09 (Equity Owner Look-Through)
            │        │
            │        └─ (소유자가 affiliate) ──────────► A-06 (Affiliate)
            │
            └─ (모든 경우) ──────────────────────────► A-11 (Claim Freshness · 취득시점 스냅샷)
```

| cascade 트리거 | 호출되는 부품 | 발동 조건 |
|---|---|---|
| basis가 가족회사 또는 신탁 | A-09 (Look-Through) | 항상(들여다보기 의무) |
| look-through 결과에 affiliate 포함 | A-06 (Affiliate) | 소유자 중 affiliate가 있을 때 |
| 모든 거래 | A-11 (Claim Freshness) | block.timestamp와 claim.verifiedAt 비교 |

**해설:** 가족회사·신탁 매수인이면 본 부품이 끝나는 게 아니라 그 안의 사람들을 보는 look-through 부품(A-09)을 부르고, 그 사람들 중 펀드 관계자(affiliate)가 있으면 또 affiliate 부품(A-06)이 붙는다. claim 신선도(A-11)는 모든 거래에 공통으로 붙는다.

### 9.3 Recipe orchestration

| Recipe | 본 부품 발동 조건 | 본 부품의 역할 |
|---|---|---|
| R3 (ICA §3(c)(7) Fund) | 항상(R3의 주 검사) | Condition 1(QP 배타적 소유) 판정 |
| R1 (Reg D 506(c) Issuance) | cumulative(발행+유통 동시 검증) | 발행 측 부품(A-03)과 나란히 검사 — 둘 다 통과해야 |
| R2 (Resale via §4(a)(7)) | cumulative | 재판매 경로 진입 시 QP 자격 확인 |

### 9.4 Conflict resolution rule — 3가지 경우

**경우 1 — A-13 통과인데 A-03 탈락(또는 그 반대).** 적격투자자(A-03)는 순자산($1M) 기준, QP(A-13)는 투자자산($5M) 기준이라, 같은 사람이라도 한쪽만 통과할 수 있다(예: 부동산 부자는 A-03 통과·A-13 탈락 가능). R1+R3가 동시에 켜지면 둘 다 통과해야 거래가 허용된다(AND 결합). R3만 켜진 경우엔 A-13만 본다.

**경우 2 — A-13은 통과인데 look-through(A-09)에서 구성원 일부 탈락.** *급조(목적형성) 회사(Rule 2a51-3(a))이거나, 자체 $5M을 못 채워 2a51-3(b) 허용경로에 기대는* 회사는 모든 구성원이 각자 QP여야 자격이 생긴다. 한 명이라도 탈락하면 전체가 탈락하므로, A-13의 통과 판정이 번복되어 FAIL_FAMILY_CO_NOT_QP가 반환된다. (자체로 $5M을 갖춘 진성 가족회사는 구성원 개별 QP 없이 회사 단위로 통과 — §2(a)(51)(A)(ii)·§3.16.1.)

**경우 3 — R3 탈락인데 R2 통과(§3(c)(7) 상실인데 재판매 안전항은 유효).** R3 탈락은 펀드의 근본 위기다(§1.4). 재판매 안전항(R2)만으로 §3(c)(7) status를 되살릴 수는 없다. Decipher 운영 정책: R3 탈락 시 해당 자산 전체 거래를 suspend하고 Trust Operations가 사후 검토한다. (이 결합 처리의 정확한 규칙은 §12 Open Issue.)

### 9.5 Manifest 무결성과의 조율

본 부품의 결과(통과·FAIL code)는 자산의 컴플라이언스 상태를 담는 Asset Compliance Manifest에 누적 기록된다. 거래 체결 직후(post-trade commit) **Manifest 무결성 부품(B-01)이** R3의 각 부품 결과가 서로 모순되지 않는지 재검증한다(회계 감사의 재확인에 비유). 불일치가 발견되면 audit alert이 뜬다.

---

### 9.6 [해설] 506(c)·Condition 2와 2,000-holder 제한의 관계

§9.1에서 본 부품(A-13)은 Condition 1만 책임지고 Condition 2(no public offering)는 Recipe-level이라고 했다. 이 절은 그 Condition 2가 506(c)/§201(b)(2)로 어디까지 해소되는지, 그리고 별개 축인 2,000-holder 제한(§12(g))과 어떻게 다른지를 한 번에 정리한다. 붙잡을 직관은 두 개 — "발행과 2차 거래는 다르다", 그리고 "두 제한은 서로 다른 법의 서로 다른 축이다".

**한 줄 요약.** 506(c)는 발행(광고) 단계의 공모 걱정만 없애준다(JOBS Act §201(b)(2)). DEX에서의 2차 거래 걱정은 그대로 남는다. 그리고 2,000-holder 제한(Exchange Act §12(g))은 Condition 2와 아무 상관 없는 완전 별개 규제다.

**비유 — 콘서트 티켓.** 티켓이 세상에 나오는 길은 둘이다. 공식 예매처가 처음 파는 것(발행)과 팬이 다른 팬에게 되파는 것(2차 거래)이다. "예매처가 대대적으로 광고해도 되나?"와 "팬끼리 공개 사이트에서 되파는 게 괜찮나?"는 별개 질문이다. 토큰도 같다 — 발행(BUIDL이 QP에게 판매)과 2차 거래(보유자가 DEX에서 재판매)는 다른 단계, 다른 규칙이다.

**질문 1 — 2,000명 제한은 왜 여전히 생기나.** 핵심은 이 둘이 다른 법, 다른 질문이라는 것이다. 식당을 열 때 위생 허가와 주류 면허를 각각 따로 받아야 하는 것과 같아서, 하나를 통과해도 다른 하나가 면제되지 않는다.

| 구분 | Condition 2 (공모 금지) | 2,000-holder 제한 |
|---|---|---|
| 어느 법? | ICA 1940 (투자회사법) | Exchange Act 1934 (증권거래법) |
| 무슨 질문? | 펀드가 **투자회사로 등록**해야 하나? | 펀드가 **공시회사**(reporting company)로 바뀌나? |
| 언제 걸리나? | 펀드가 public offering(공모)을 하면 | record holder 2,000명 초과 + 자산 $10M 초과 |
| 506(c)/§201(b)(2)는? | 발행 광고는 해소(2차 거래는 잔존) | 아무 영향 없음(완전 별개) |
| 누가 담당? | A-13(Condition 1)·Recipe(Condition 2) | 부품 D-01 |

506(c)/§201(b)(2)는 "공모냐 아니냐"라는 질문(Condition 2)에만 답을 준다. "보유자가 몇 명이냐"라는 질문(§12(g))과는 다른 영역이라 손댈 수 없다. 이것이 §3(c)(7)의 함정이다 — §3(c)(7)은 (100명으로 묶이는 §3(c)(1)과 달리) QP를 몇 명이든 받을 수 있지만, 바로 이 §12(g) 때문에 실질적으로 2,000명이 천장이 된다. 토큰이 DEX에서 여러 지갑으로 퍼지면 이 숫자는 금세 늘 수 있어, 별도 부품 D-01이 보유자 수를 STATEFUL하게 세는 이유가 여기 있다.

**질문 2 — "쟁점은 2차 거래로 한정된다"의 뜻.** §201(b)(2)는 "Rule 506(c)에 따른 offer·sale" — 발행자(펀드)가 토큰을 파는 1차 발행만 다룬다. 발행 단계에서 BUIDL이 광고하며 QP에게 토큰을 직접 팔면 §201(b)(2)가 "이건 공모 아님"을 깔아주어 Condition 2를 통과한다. 그러나 기존 보유자가 자기 토큰을 DEX에서 남에게 되파는 2차 거래는 발행자의 판매가 아니므로 그 보호 밖이다(이런 재판매는 §4(a)(1)·Rule 144·§4(a)(7) 등 별도 면제에 기댄다). 그래서 남는 질문은 — DEX에서 토큰이 상시 호가창에 떠 있고 익명으로 끊임없이 매칭돼 거래되는 환경이 그 자체로 "공모"처럼 보이거나 §3(c)(7)의 'not making a public offering'을 깨뜨리는가 — 즉 진짜 걱정은 2차 시장(DEX) 하나로 좁혀진다.

![토큰의 일생 — 발행은 §201(b)(2)로 해소되고, 2차 거래에서 두 개의 별개 위험이 갈라진다](fig/fig_token.png)

이 그림이 두 질문을 한꺼번에 보여준다. 발행 쪽(왼쪽)은 §201(b)(2)로 깔끔히 해소되고(초록), 진짜 일이 생기는 2차 거래 쪽(오른쪽)에서 서로 다른 위험 둘이 동시에 나온다 — 위험 A는 그 거래가 공모로 보이는가(ICA §3(c)(7) Condition 2, Recipe·No-Action Letter 쟁점), 위험 B는 거래로 보유자가 2,000명을 넘는가(Exchange Act §12(g), 부품 D-01)다. 둘 다 2차 시장에서 생기지만 서로 다른 법의 서로 다른 축이라 따로 관리한다.

**정리.** ① 506(c)/§201(b)(2)는 발행 광고가 공모로 취급되지 않게 한다 → Condition 2의 발행 측은 해소된다. ② 하지만 DEX 2차 거래가 공모를 유발하는지는 여전히 미결이다(§201(b)(2) 밖) → 이것이 "2차 거래로 한정된" 쟁점이며 §12에서 다룬다. ③ 2,000-holder 제한(§12(g))은 위 전부와 무관한 별개 규제다 → 506(c)로 가도 그대로이며, 그래서 D-01이 따로 센다.

## §10. (γ) 3-Layer Solution — 증거 신뢰를 세 겹으로

### 10.1 왜 3겹 구조인가

판정에 필요한 증거는 여러 곳에서 온다. 각 출처는 위험·비용·커버리지의 trade-off가 다르다. Decipher는 이를 세 겹으로 나눠 각 층의 역할·책임·법적 토대를 분리한다.

| 층 | 무엇 | 커버리지 | 비용 | reasonable belief 형성 |
|---|---|---|---|---|
| Layer 1 — Self-Attestation | 매수인 자기신고(frontend) | 1차 의도 수집·증거 갈래 결정 | 낮음 | 낮음(단독으론 불충분) |
| Layer 2 — Trusted Issuer | KYC 기관의 off-chain 실사 + claim 발급 | 핵심 증거 + 법적 판단 | 중–상 | 주(主) — Rule 2a51-1(h) 안전항 직접 적용 |
| Layer 3 — External Spot-Check | 무작위 audit · Layer 2 품질 보증 | 안전망(체계적 실패 검출) | 상(표본) | 컴플라이언스 강화 |

### 10.2 각 층의 법적 토대

**Layer 1 — Self-Attestation:** 매수인이 frontend에서 자기 갈래를 선언한다("나는 자연인이고 $5M 이상 보유"). 자기신고 자체는 §2(a)(51)·Rule 2a51-1 판정 근거가 못 된다(증거 불충분). 하지만 Layer 2의 진입·범위를 정하는 역할을 한다(예: KE 경로로 갈지 결정).

**Layer 2 — Trusted Issuer:** 여기서 Rule 2a51-1(h)의 reasonable belief가 직접 적용된다. Trusted Issuer(KYC 기관·등록 투자자문업자·broker-dealer 등)가 증거를 수집·검증하고 Rule 2a51-1에 따른 법적 판단을 한다. 충실한 실사로 합리적 신뢰가 형성되면 안전항이 작동한다.

**Layer 3 — External Spot-Check:** Layer 2가 체계적으로 느슨한 실사를 하고 있지는 않은지 무작위로 점검하는 meta-control이다. Layer 2 자체에 대한 품질 보증·audit으로, 펀드 측 운영위험 관리와 안전항의 robustness를 강화한다.

### 10.3 층 간 escalation 규칙

```
Layer 1 (자기신고) 단독: 항상 불충분
   ↓ (모든 경우 escalate)
Layer 2 (Trusted Issuer): 주 경로 · 요건 충족 시 통과
   ↓ (REVIEW_QP_UNCERTAIN 또는 Layer 2 체계적 위험 발견 시)
Layer 3 (External Spot-Check): 최종 검증 · 표본 audit
```

### 10.4 Liability(책임) 분배 — 위조 KYC로 무자격자가 매수해 손해가 난 경우

위조 KYC로 무자격 매수인이 들어왔고, 펀드가 부도나 손해가 발생해 사후에 드러났다고 하자. 누가 책임지는가?

| 행위자 | 책임 측면 |
|---|---|
| Buyer(매수인) | misrepresentation(허위표시) 시 직접 사기 책임(민·형사) |
| Trusted Issuer | 충실한 주의를 다하지 못했으면 과실 책임 + 안전항 무효화 → 손해배상 대상 |
| Fund(BlackRock) | Trusted Issuer가 합리적 신뢰를 형성했으면 Rule 2a51-1(h) 안전항으로 보호, 아니면 §3(c)(7) status 상실 위험 |
| Decipher(인프라 제공자) | 인프라 제공자의 책임 경계는 명확한 case law가 아직 없음 — §12 Open Issue |

이 cascade의 정확한 지도가 변호사 follow-up의 핵심 질문이다. Securitize·tZERO·INX 선례에서는 각 회사가 §4(a)(7) 안전항·broker-dealer 등록 등 추가 보호층을 갖고 있었다. Decipher의 인프라 전용(infrastructure-only) 모델에서 유사 보호가 어떻게 적용되는지는 아직 분명하지 않다(§12). 쉽게 말하면 — "우리는 거래를 중개한 게 아니라 판이 깔리는 코드만 제공했다"는 항변이 통하는지를 변호사가 정리해 줘야 한다.

---

## §11. (δ) Frontend·Off-chain Operator Layer — 4-Layer로는 안 끝난다

### 11.1 4-Layer 밖의 층이 필요한 이유

Decipher의 공식 아키텍처는 4층이다 — Element·Recipe·Manifest·Operator. 그런데 본 부품이 실제로 작동하려면 이 4층에 들어가지 않는 층이 필요하다.

**구체적 예시:** Knowledgeable Employee 식별은 frontend 자기신고 없이는 작동 불가능하다. 매수인이 "나는 BlackRock 직원입니다"라고 frontend에서 선언해야 Trusted Issuer가 KE 자격 실사를 시작한다. 자기신고 없이 표준 QP 경로만 타면, $5M 문턱에서 막혀(FAIL_NOT_QP) KE 자격이 있어도 예외가 작동하지 않는다.

이는 Decipher 구현이 4-Layer만으로 완결되지 않음을 의미한다. *Layer 0(User Interaction)과* *Layer 4.5(Off-chain Operator)를* 명시적으로 모델링할 필요가 있다 — 아키텍처 재검토 대상이다.

### 11.2 Frontend Self-Identification Flow

```
[Frontend / Interface Layer]
1. 매수인이 DEX 진입 + KYC onboarding 시작
2. 자기신고 UI:
   "어떤 자격으로 매수하시겠습니까?"
     ☐ 자연인 (investments $5M+)
     ☐ Family Company (가족관계 + $5M+)
     ☐ Trust (수탁자+위탁자 결합 + 자산)
     ☐ $25M 재량운용 (any person, investments $25M+)
     ☐ Knowledgeable Employee (펀드 내부자)
3. 선택에 따라 증거 수집 form 분기

[Knowledgeable Employee 선택 시 추가 입력]
   - 소속 운용사 (예: BlackRock)
   - 직위/역할 (예: Portfolio Manager)
   - 근속 (예: 36개월)
   - 투자활동 관여 자기진술
```

**해설(UX 관점):** 자기신고는 법적 증거가 아니라 경로 안내다. 잘못 고르면 엉뚱한 증거 form으로 가서 불필요하게 막히므로, frontend는 각 갈래의 뜻을 쉬운 말로 설명해야 한다(특히 QP $5M과 적격투자자 $1M의 차이를 헷갈리지 않게).

### 11.3 Off-chain Operator Layer (Trusted Issuer 운영)

```
[Trusted Issuer Layer — Off-chain]
1. Frontend → Trusted Issuer로 증거 패키지 전달
2. Trusted Issuer 팀이 실사:
   - 신원확인 (eKYC)
   - 증빙 검토: brokerage statement(Rule 2a51-1(b)(1)) /
     부동산 감정서(투자목적 여부는 (c)로 판단) / trust deed / 고용증명(KE)
   - Rule 2a51-1·2a51-3·3c-5 적합성 판정
   - 지배관계 검증(Rule 2a51-1(b)(1) 제외 적용)
   - reasonable belief 형성 + 문서화(audit trail)
3. Trusted Issuer가 서명 claim을 블록체인에 발급
```

### 11.4 Manual Review Path (REVIEW_QP_UNCERTAIN)

```
1. 온체인 부품이 REVIEW_QP_UNCERTAIN 반환
2. 거래 suspend (거절 아닌 대기)
3. Decipher Trust Operations 큐로 라우팅
4. 수동 검토: 추가 증거 요청 → 경계 법적 판단 → (필요 시) 변호사 escalate
5. 결정 + (통과 시) 새 claim 발급 또는 (탈락 시) 명시적 FAIL code
6. 모든 결정·근거를 Compliance Log에 기록(audit trail)
```

### 11.5 아키텍처 함의

Trusted Issuer의 법적 추론 능력이 시스템 성공의 결정적 변수다. 단순 KYC 기관이 아니라, Rule 2a51-1·2a51-3·3c-5·판례·No-Action Letter를 해석·적용할 수 있는 기관이어야 한다. 따라서 Trusted Issuer의 선정·onboarding·상시 모니터링이 Decipher 운영 설계의 핵심이다. 쉽게 말하면 — 이 시스템의 품질은 코드가 아니라 증명서를 발급하는 사람들의 법적 역량에 달려 있다.

---

## §12. Open Issues — 변호사 follow-up 대상

본 부품의 스펙이 완전해지려면 풀어야 할 질문들이다. 각 항목은 *완결된 질문 + 왜 필요한지 + 어떻게 해소할지(권고)로* 적었다.

| # | 질문(무엇을 결정해야 하나) | 왜 필요한가 | Priority | 해소 경로(권고) |
|---|---|---|---|---|
| 1 | §3(c)(7) Condition 2("no public offering") — 발행 측 광고·일반청약은 JOBS Act §201(b)(2)로 해소되므로, 쟁점은 DEX의 secondary trading(상시 호가·익명 매칭)이 별도 public offering을 유발하는가로 좁혀진다. Ralston Purina 4-factor가 이 환경에 어떻게 적용되나 | 유발된다면 BUIDL listing 자체가 면제 상실 위험. 부품으로 막을 수 없는 Recipe-level 위험 | 🔴 즉시 | 변호사 follow-up + SEC No-Action Letter 신청 검토(Securitize·INX 선례 인용) |
| 2 | Knowledgeable Employee(Rule 3c-5)의 적용 경계 — "투자활동에 관여하는 직원"의 실무 boundary, "exclusively QP 판정에서 제외" 메커니즘의 온체인 구현 방식 | KE를 잘못 막으면 정당한 매수 차단, 모르고 통과시키면 사후 misclassification 위험 | 🔴 즉시 | 변호사 follow-up(Rule 3c-5 원문 기준 — Rule 2a51-3 아님) |
| 3 | Issuer / Trusted Issuer / DEX 간 책임 분배 — Rule 2a51-1(h) reasonable belief 안전항이 각 행위자에게 cascade되는 정확한 경계, 인프라 제공자의 면책 가능성 | 위조 claim 사고 시 Decipher의 방어 논거 근거가 됨(§10.4) | 🔴 즉시 | 변호사 follow-up + Securitize·tZERO·INX 보호층 비교 |
| 4 | Time-of-acquisition의 블록체인 적용 스펙 — 어느 timestamp(matching/confirmed/finalized)가 법적 "취득 시점"인가 | 경계 거래의 통과/차단을 가르는 기준. 임의 결정 시 법적 오작동 | 🟡 높음 | 변호사 + Decipher 자체 정리(Claim Freshness 부품 A-11과 조율) |
| 5 | Look-through 재귀 최대 깊이 — 가족회사·신탁을 몇 단계까지 들여다봐야 하나, 부분 미충족(partial) 처리 | 깊이 미정 시 cascade 미작동 또는 무한 복잡도. A-09 부품 설계 직결 | 🟡 높음 | 변호사 follow-up(Davis Polk 1997·ABA 1999 letter 원문 확인) |
| 6 | 추가 boundary·복합 cascade 테스트 케이스 — §7의 5케이스 외 신탁 결합·$25M 재량운용(any person)·KE 직위형/관여형 경계 | 스펙 완성(DoD)의 ⑤칸. 개발팀 unit test 직결 | 🟡 높음 | Decipher 자체 작성 + 변호사 검증 |
| 7 | Cross-Recipe 결합 처리 — R3 탈락 + R2 통과의 결합 결과, R1+R3 동시 활성 시 충돌 해소 규칙 | Multi-Recipe Cumulative Model의 토대(§9.4) | 🟢 중간 | Decipher 자체 정리 |

> **참고:** 위 1~3번은 BUIDL listing 전 반드시 해소되어야 하는 immediate 항목이다. 특히 1번(공모 유발 여부)이 해소되지 않으면 다른 모든 부품이 완벽해도 BUIDL listing이 법적으로 위태롭다.

---

## §13. 파일명 규칙 (Naming Convention)

Decipher Element / Recipe 산출물 명명 규칙:

- **Element:** `A-XX_부품이름.md` (예: `A-13_qualified-purchaser.md`)
- **Recipe:** `R-XX_Recipe이름.md` (예: `R3_ICA-3c7-fund.md`)

Element 부품 ID 체계(앞글자 = 카테고리):

| 앞글자 | 카테고리 |
|---|---|
| A | 신원·자격 (매수인 측) ← 본 부품(A-13)이 여기 |
| B | 자산·기술 메타 |
| C | 거래 경로·시점 |
| D | 집계·누적 |
| E | 발행자 측 |
| F | 기타 |

본 부품: **A-13 = "신원·자격 카테고리의 13번째 부품"**

물리적 위치: `산출물/elements/` (모든 Element walkthrough)