# ELE.C-00_resale-path-selector

# C-00 Resale Path Selector — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 전매 경로 선택기(내부 식별자 C-00)를, 미국 증권법을 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-07-16).** 본 부품의 미국 증권법 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §77b·§77d·§77e는 uscode.house.gov 현행본(prelim), 17 CFR §230.144·144A·502·902·904·905는 eCFR 현행본(Title 17), SEC Release·C&DI는 sec.gov, Public Law·판례는 govinfo.gov다. 제정법 출처는 uscode.house.gov로 통일했으며, govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다.

**테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, transfer architecture, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링하여, 재판매 시점의 pre-trade transfer restriction을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다.

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"이미 발행된 이 토큰을 지금 되파는 행위에, 어떤 등록면제 경로가 열려 있는가"* 를 거래 직전에 판정한다. 그런데 이 질문은 다른 부품들과 결이 다르다. A-03(Accredited Investor)이나 A-13(Qualified Purchaser)은 "이 사람이 자격이 있는가"를 묻는다. 답은 예/아니오다. C-00은 그런 부품이 아니다. C-00은 **"길이 몇 개 있고, 그중 어느 길로 갈 것인가"** 를 묻는다. 답은 예/아니오가 아니라 **경로 이름**이다.

이 차이가 중요한 이유는, 미국 증권법의 재판매 규제가 단일 관문이 아니라 **서로 독립적인 여러 개의 문**으로 되어 있기 때문이다. 어느 문으로 들어가느냐에 따라 그 뒤에 서 있는 검사원이 완전히 달라진다. 보유기간을 재는 검사원, 물량을 세는 검사원, 매수인 자격을 보는 검사원, 매수인의 소재지를 보는 검사원 — 전부 다른 문 뒤에 있다. 문을 고르지 않고는 어느 검사를 돌려야 하는지조차 알 수 없다. 그래서 C-00은 재판매 Recipe(R2)의 **첫 번째** 부품이다.

### 1.1 §5 — 미국 증권법의 기본값은 "전부 금지"다

미국 1933년법의 출발점은 대단히 단순하고 대단히 넓다. 증권을 팔려면 등록해야 한다. 등록하지 않았으면 파는 것 자체가 불법이다. 조문은 이렇게 되어 있다(15 U.S.C. §77e(a), 본 문서 §3.1에서 원문).

여기서 한국 실무자가 가장 자주 틀리는 지점이 있다. **§5는 "발행"을 규제하는 조문이 아니라 "sale"을 규제하는 조문이다.** 조문 어디에도 "issuer"라는 말이 없다. "any person"이다. 즉 5년 전에 산 토큰을 오늘 친구에게 파는 개인도, 문언상으로는 §5의 사정권 안에 있다. 발행이 끝났다고 규제가 끝나는 게 아니다.

**쉽게 말하면:** 한국 자본시장법은 "모집·매출"이라는 개념으로 공모성 거래를 잡아내고, 그 밖의 사적 거래는 원칙적으로 자유롭다. 미국은 정반대다. 원칙이 "전부 금지"이고, 거기서 하나하나 예외를 파낸 것이 §3(증권 단위 면제)과 §4(거래 단위 면제)다. 그래서 미국 증권 실무는 "이 거래가 규제 대상인가"를 묻지 않고 **"이 거래에 쓸 면제가 무엇인가"** 를 묻는다. C-00은 그 질문을 기계가 대신 던지게 만든 부품이다.

### 1.2 §4(a)(1)과 underwriter — "일반인은 자유롭게 팔 수 있다"는 말의 함정

§5의 전면금지를 풀어주는 가장 기본적인 예외가 §4(a)(1)이다. 문언은 세 단어의 부정으로 되어 있다 — issuer가 아니고, underwriter가 아니고, dealer가 아닌 자의 거래는 §5를 적용하지 않는다.

보통 사람은 issuer도 dealer도 아니다. 그러면 남는 관문은 하나 — **underwriter가 아니어야 한다**. 그런데 §2(a)(11)의 underwriter 정의가 무서울 만큼 넓다. "purchased from an issuer with a view to ... the distribution of any security" — 즉 **"배포할 생각으로 발행자에게서 산 사람"** 이면 누구나 underwriter다. 투자은행일 필요가 없다. 개인도 된다.

문제는 "with a view to"가 **마음속 의도**라는 것이다. 5년 전 토큰을 살 때 무슨 생각을 했는지는 아무도 증명할 수 없다. 그래서 미국 법원과 SEC는 오랫동안 정황 증거 — 얼마나 오래 들고 있었나, 사정 변경이 있었나 — 로 의도를 추정해 왔다. Rule 144의 Preliminary Note가 이 역사를 규칙 본문 안에 직접 적어 두었다(§3.6).

**쉽게 말하면:** 미국법은 "판 사람의 속마음"에 법적 효과를 걸어 두었다. 그런데 속마음은 온체인에서 읽을 수 없다. 블록체인은 timestamp와 주소만 안다. **이 비결정성(속마음)을 결정성(경과 시간·수량·상대방 자격)으로 치환한 장치가 바로 Rule 144를 비롯한 재판매 면제 규칙들이다.** C-00은 그 치환을 코드로 옮기는 첫 단계다.

### 1.3 네 개의 문 — 재판매 면제 경로의 지형

같은 restricted 토큰 한 개를 되파는 데 쓸 수 있는 통로는 실무상 네 개다. 서로 배타적이지 않고, 요건도 근거법도 다르다.

| 경로 | 근거 | 핵심 아이디어 | 매수인에게 요구되는 것 | 매도인에게 요구되는 것 |
| --- | --- | --- | --- | --- |
| Rule 144 | 17 CFR §230.144 (SEC 규칙) | 시간이 지나면 "배포 의도"가 없었다고 본다 | 없음 | 보유기간(+계열자면 물량·방법·통지) |
| §4(a)(7) | 15 U.S.C. §77d(a)(7)·(d) (제정법) | 세련된 매수인끼리면 공시가 불필요하다 | Accredited Investor | 일반청약 금지 · 정보제공 · 8요건 |
| Rule 144A | 17 CFR §230.144A (SEC 규칙) | 초대형 기관끼리면 보호가 불필요하다 | QIB($100M 증권 보유) | 매수인에게 144A 원용 사실 고지 |
| Reg S Rule 904 | 17 CFR §230.904 (SEC 규칙) | 미국 밖 거래에는 §5가 안 미친다 | non-U.S. person | 역외거래 · 미국 내 판촉 금지 |

이 표에서 읽어야 할 것은 **요구 대상이 서로 다르다**는 점이다. Rule 144는 매도인 쪽만 본다(매수인은 아무나 돼도 된다). §4(a)(7)과 144A는 매수인 자격을 본다. Rule 904는 매수인의 **소재지**를 본다. 그래서 "매수인이 AI가 아니라서 막혔다"는 상황에서도 Rule 144 경로는 멀쩡히 열려 있을 수 있다. 반대로 "보유기간이 안 찼다"면 Rule 144는 닫히지만 144A나 904는 영향이 없다.

**이 비배타성이 C-00 존재 이유의 핵심이다.** 경로를 하나로 고정해 버리면, 실제로는 열려 있는 다른 문을 시스템이 스스로 닫는 셈이 된다. 반대로 아무 경로나 되는 대로 쓰면, 그 경로의 요건을 지키지 않은 채 통과시키는 사고가 난다. 그래서 열린 문을 **전부 열거하고**, 그중 **하나를 결정론적으로 확정**하는 장치가 필요하다.

### 1.4 발행 면제와 재판매 면제는 별개다 — 가장 비싼 오해

Decipher에서 BUIDL-like 토큰은 Rule 506(c)로 발행된다(R1). 506(c)는 일반청약(general solicitation)을 허용하는 발행 면제다. 여기서 치명적인 오해가 생긴다 — *"506(c)로 발행했으니 광고해도 되고, 그러니 거래소에서 자유롭게 거래해도 된다."*

**틀렸다.** 이유는 두 겹이다.

**첫째, 면제는 거래 단위로 붙는다.** §4는 "exempted transactions"라는 제목을 달고 있다. 증권이 아니라 **거래**가 면제된다. 발행이라는 거래가 506(c)로 면제됐다는 사실은, 그 다음에 일어나는 재판매라는 **별개의 거래**에 아무 면제도 주지 않는다. Rule 502(d)가 이 점을 못 박는다 — Reg D로 취득한 증권은 §4(a)(2) 거래로 취득한 것과 같은 지위를 가지며, 등록 또는 면제 없이는 재판매할 수 없다(§3.5).

**둘째, 일반청약 허용은 이전(移轉)되지 않는다.** 506(c)의 일반청약 허용은 **issuer의 발행**에 대한 것이다. §4(a)(7)(d)(2)를 보면 *"Neither the seller, nor any person acting on the seller's behalf, offers or sells securities by any form of general solicitation or general advertising"* 라고 되어 있다. 여기서 "seller"는 발행자가 아니라 **재판매하는 보유자**다. 즉 발행 단계에서 아무리 크게 광고했어도, 재판매 단계에서는 매도인이 다시 침묵해야 한다. 두 조항은 서로 다른 행위자에게 걸린 서로 다른 규범이라, 상쇄되지 않는다.

| | Rule 506(c) 발행 | §4(a)(7) 재판매 |
| --- | --- | --- |
| 규제 대상 | issuer | seller(보유자) |
| 일반청약 | 허용(§230.502(c) 적용 배제) | 금지(§77d(d)(2)) |
| 매수인 자격 | 전원 AI + issuer의 reasonable steps to verify | 전원 AI |
| 결과물의 지위 | restricted(§230.502(d)) | 여전히 restricted(§77d(e)(1)(C)) |

**쉽게 말하면:** 발행 때 확성기를 써도 되는 것과, 되팔 때 확성기를 써도 되는 것은 완전히 다른 문제다. 그리고 이 구분은 DEX 설계에 직접 꽂힌다 — 공개 호가창(order book)이 전 세계에 보인다면, 그건 **매도인 측의 일반청약**으로 읽힐 수 있다. 그렇다면 §4(a)(7) 경로는 그 순간 닫힌다. 반면 Rule 144의 비계열자 경로에는 일반청약 금지 조항이 아예 없다(§3.8·§5.3). 이 비대칭이 C-00의 보수적 기본값을 RULE144로 두는 법리적 이유다.

### 1.5 Decipher 시스템에서 왜 중요한가 — 라우팅 실패의 두 방향

C-00이 틀리면 사고는 두 방향으로 난다.

**방향 A — 과소차단(false pass).** 열려 있지도 않은 경로를 열렸다고 판정하면, 하류 부품들이 **엉뚱한 검사**를 돌린다. 예를 들어 실제로는 §4(a)(7) 경로인데 RULE144로 라우팅하면, 시스템은 보유기간만 재고 통과시킨다. 그런데 §4(a)(7)은 보유기간 요건이 없는 대신 매수인 AI 요건이 있다. 결과 — AI 아닌 자에게 미등록 증권이 팔린다. **§5 위반**이고, 매수인에게 §12(a)(1) rescission(원상회복) 청구권이 생긴다.

**방향 B — 과잉차단(false fail).** 열려 있는 경로를 못 찾으면 정당한 거래가 막힌다. 이건 법적 사고는 아니지만 제품이 죽는다. 특히 Rule 144의 1년 보유기간이 안 찬 lot이라도 144A나 904 경로는 열려 있을 수 있는데, C-00이 RULE144만 보면 전부 거절한다.

**그래서 C-00의 설계 목표는 "많이 통과시키기"도 "많이 막기"도 아니다. 열린 문을 빠짐없이 세고, 그중 하나를 재현 가능하게 고르는 것이다.** 이 부품은 판단하지 않는다. 라우팅한다.

### 1.6 이 부품이 판단하지 않는 것 — 존재 수준과 충족 수준의 분리

C-00 설계의 척추가 되는 구분이 하나 있다. **존재(existence) 수준**과 **충족(satisfaction) 수준**이다.

- **존재 수준:** "이 경로가 이 거래에 대해 원천적으로 닫혀 있는가." 거래 시점의 정적 사실만으로 확정된다. 예 — 발행자가 shell이면 Rule 144는 아예 없다(§230.144(i)). 매수인이 QIB claim을 아예 안 가졌으면 144A는 없다. 이건 계산이 아니라 **조회**다.
- **충족 수준:** "그 경로의 요건을 이 거래가 실제로 만족하는가." 상태·이력·누적을 봐야 한다. 예 — 보유기간이 1년을 넘었나(C-01), 3개월 누적 물량이 한도를 넘었나(C-08), 이 매수인이 AI인가(A-03).

**C-00은 존재 수준만 본다.** 충족 수준은 전부 하류 부품에 위임한다. 이유는 세 가지다.

1. **책임 경계.** C-00이 보유기간까지 계산하면 C-01과 로직이 이중화된다. 두 곳에서 같은 법을 구현하면 반드시 갈라진다.
2. **비용.** 존재 검사는 조회 몇 번이면 끝난다. 충족 검사는 lot 순회·rolling window·cascade가 필요하다. 싼 검사로 먼저 걸러야 한다.
3. **법리.** 경로 선택은 "어느 조문 체계로 이 거래를 평가할 것인가"라는 **선결 문제**다. 요건 충족 판단보다 논리적으로 앞선다. 순서를 뒤집으면 어느 요건을 봐야 하는지도 모르는 채 요건을 보게 된다.

**쉽게 말하면:** C-00은 병원 접수처다. 어느 과로 갈지 정해 준다. 진단은 각 과의 의사가 한다. 접수처가 진단까지 하려 들면 오진이 난다.

## §2. ▣ 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"전매 경로 선택기" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | Resale Path Selector (전매 경로 선택기) | 재판매 면제 경로 라우터 |
| 검사 대상 | 재판매 거래에 열려 있는 등록면제 경로의 **존재** 판정 및 **단일 경로 확정** — Rule 144 · §4(a)(7) · Rule 144A · Reg S Rule 904 | "이 거래는 어느 문으로 나가나" |
| Internal ID | C-00 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **직접 계산형(패턴 A)** — 결정론적 라우터/디스패처. claim을 발급하지 않고 조회·비교만 한다 | 기계가 직접 열거·비교해 경로를 확정 |
| Timing | pre-trade(거래 체결 직전), R2의 **최초** 부품 | 다른 재판매 검사보다 먼저 돈다 |
| Stateful 여부 | STATELESS (Element 한정) | 경로 선택 자체는 스냅샷 판정. lot 계보(lineage)는 Acquisition Registry(CR-3)가, 누적 물량은 C-08이 각각 stateful하게 관리한다 |
| 주 활성화 Recipe | R2(Resale) | 이 레시피가 본 부품을 부른다 |
| Cumulative Recipe | R3(ICA §3(c)(7) Fund) · R4(Market Conduct) | 함께 켜질 수 있는 레시피 |
| Cascade Element | A-06(Affiliate) · A-11(Claim Freshness) — 존재 판정에 필요한 최소 호출만 | 본 부품이 추가로 호출하는 검사 부품 |
| 하류 위임 대상 | C-01(보유기간) · C-08(물량한도) · A-03(AI) · A-13(QP) · B-04(엔진 선택) | 충족 수준 판단을 넘기는 곳 |
| 출력 | `selectedPath ∈ {RULE144, SEC4A7, RULE144A, REGS_904}` + `downstreamChecks[]` | 판정이 아니라 **경로 이름**을 돌려준다 |
| 성숙도 | ◐ R-1 단계 (● 데모 핵심) | 데모에 필수, 후속 보완 진행 중 |
| 파일·위치 | C-00_resale-path-selector.md · 산출물/elements/ | 산출물 경로 |

**⚠ 현재 활성 경로 (v1.0 기준).** `manifest.enabledPaths = {RULE144}`. 즉 **RULE144 단일 경로만 활성**이다. 나머지 세 경로는 스펙상 완비되어 있으나 manifest에서 비활성이다. 이유는 §4(a)(7) 개방 여부(Q-B1)가 변호사 확인 전이고(§12 OD-C00-1), 144A·904는 그에 종속된 venue 정책 결정을 기다리기 때문이다. 이 보수적 기본값의 법리적 근거는 §5.3에서 다룬다 — 요약하면, **Rule 144의 비계열자 경로가 네 경로 중 유일하게 매도인 측 일반청약 금지와 거래방법 제한을 받지 않기 때문**이다.

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — **Layer 1**(조문)은 의회가 만든 법률 텍스트(statute), **Layer 2**(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), **Layer 3**(해석)은 판례·SEC 발행문서·No-Action Letter가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff·Case = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1~§3.20 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 §5의 전면금지에서 출발해 네 경로가 어떻게 갈라지는지를 조문 단위로 그린 것이다. 핵심은 **모든 화살표가 하나의 질문으로 수렴한다**는 점이다 — "이 매도인은 underwriter인가." 네 경로는 그 질문에 각기 다른 방식으로 "아니오"를 만들어 내는 장치들이다. Rule 144·144A는 *"deemed not to be an underwriter"* 라는 간주 규정으로, §4(a)(7)은 독립한 제정법 면제로, Rule 904는 아예 *"deemed to occur outside the United States"* 로 §5의 적용 자체를 비껴가는 방식으로.

![C-00 fig30 — 조문·논리 흐름](fig/C00_fig30_statute.png)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

BUIDL-like §3(c)(7) 펀드 토큰이라는 구체적 대상에 위 조문 지형을 얹으면, 일반론과 다른 몇 가지 특징이 즉시 드러난다. 이 특징들이 C-00 구현의 실제 모양을 결정하므로 먼저 짚는다.

**① 발행자가 Exchange Act 보고회사가 아니다.** 사모 펀드이므로 §13·§15(d) 보고 의무가 없다. 이 사실 하나가 Rule 144의 모양을 바꾼다. §230.144(b)(1)(ii)에 따르면 **비보고 발행자 + 비계열 매도인** 조합에서는 요구되는 조건이 **(d) 보유기간 하나뿐**이다. (c) 현재 공개정보도, (e) 물량한도도, (f) 거래방법도, (h) Form 144 통지도 전혀 걸리지 않는다. 대신 (d)(1)(ii)에 따라 보유기간이 6개월이 아니라 **1년**으로 늘어난다. 즉 비보고 발행자 구조는 **"조건 개수를 하나로 줄이고 시간을 두 배로 늘린" 거래**다.

**② 계열자(affiliate)에게는 그 반대가 일어난다.** §230.144(b)(2)는 계열자 매도에 대해 *"if all of the conditions of this section are met"* — 이 조문의 **모든** 조건을 요구한다. 여기에 (c)가 포함되고, 비보고 발행자면 (c)(2)가 적용되어 **§240.15c2-11(b)(5)(i)(A)~(N)·(P)의 정보가 publicly available해야** 한다. 사모 펀드가 그 정보를 공개하는 일은 정의상 드물다. 여기에 (f) 거래방법 제한(브로커 거래·마켓메이커·riskless principal 중 하나)까지 겹친다. **결론 — 계열자에게 Rule 144는 사실상 닫혀 있다.** 이건 버그가 아니라 법이 그렇게 생겼다. C-00은 이 사실을 존재 수준에서 읽어 낸다(§5.2 G3).

**③ Rule 144(i) shell 배제가 예상 밖의 위험을 만든다.** §230.144(i)(1)(i)는 (A) *"No or nominal operations"* 이고 (B) 자산이 *"Assets consisting solely of cash and cash equivalents"* 등에 해당하는 발행자의 증권에 대해 Rule 144 자체를 **이용 불가**로 만든다. 그런데 토큰화 국채 펀드의 자산은 문언상 정확히 cash equivalents다. (A)와 (B)가 **AND**이므로 "operations이 있다"는 점으로 방어해야 하는데, 운용 활동이 operations인지에 관한 bright line이 없다. **이 위험은 크다 — Rule 144가 우리의 보수적 기본 경로이기 때문이다.** 기본 경로가 무너지면 대체가 없다. §12 OD-C00-2로 올린다.

**④ 그런데 §4(a)(7)의 shell 배제는 문언이 다르다.** §77d(d)(6)은 *"is not a blank check, blind pool, or shell company that has no specific business plan or purpose"* 라고 되어 있다. 기준이 **자산·영업이 아니라 사업계획의 특정성**이다. 국채 포트폴리오를 운용한다는 것은 specific business plan이다. 즉 **§4(a)(7)이 Rule 144보다 shell 리스크에서 오히려 안전하다.** 두 경로가 같은 취지의 배제 조항을 갖고 있으나 문언이 달라 결과가 갈리는 사례이며, Q-B1(§4(a)(7) 개방 여부)을 검토할 때 개방 쪽으로 기우는 논거가 된다(§12 OD-C00-1).

**⑤ Rule 144A의 등록 IC 배제는 우리를 막지 않는다.** §230.144A(d)(3)(ii)는 *"is or is required to be registered under section 8 of the Investment Company Act"* 인 펀드의 지분을 배제한다. §3(c)(7) 펀드는 ICA상 investment company 정의에서 **제외**되므로 §8 등록이 요구되지 않는다. 따라서 (d)(3)(ii)는 충족된다. 경제적 실질이 open-end에 가깝더라도, 조문의 연결점은 **등록 요구 여부**이지 경제적 성격이 아니다.

**⑥ Rule 144A와 §3(c)(7)이 서로를 돕는다.** 144A의 매수인은 QIB여야 하는데(§230.144A(d)(1)), QIB는 §270.2a51-1(g)(1)에 따라 **별도 자산 입증 없이 QP로 간주**된다. 즉 144A 경로로 라우팅되는 순간 R3(§3(c)(7))의 QP 요건이 자동으로 만족된다. 네 경로 중 R3와 마찰이 가장 적은 경로다.

**⑦ 반대로 Reg S 904는 R3를 풀어 주지 못한다.** ICA §3(c)(7)(A)는 *"the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers"* 라고 할 뿐, 미국인/외국인을 구별하지 않는다. Rule 904는 1933년법 §5의 문제를 해결할 뿐이고, 1940년법의 QP 요건은 그대로 남는다. **역외 매수인도 QP여야 한다.** 이것이 §9의 Cumulative Recipe 모델이 필요한 이유의 교과서적 사례다.

**⑧ Reg S 904의 offshore transaction 요건은 (A) 갈래로만 갈 수 있다.** §230.902(h)(1)(ii)는 (A)와 (B) 중 **택일**을 허용하는데, 904용 (B)(2)는 거래가 *"designated offshore securities market"* 에서 체결될 것을 요구한다. §230.902(b)(1)의 열거 목록은 런던·도쿄·홍콩 등 전통 거래소이고, Giwa 체인은 여기 없다. (b)(2)의 SEC 지정도 없다. 따라서 **(B)(2)는 원천적으로 불가능**하고, **(A) — 매수 주문 시점에 매수인이 미국 밖에 있을 것 — 만 남는다.** 이는 KYC 데이터의 소재지 필드에 법적 무게를 싣는다는 뜻이다(§12 OD-C00-4).

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 C-00에 어떻게 닿는지를, **표 2**(순서·중요성)는 아래 §3.1~§3.20 소단원의 읽는 순서(논리 흐름)와 중요성(C-00이 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이라, 뿌리인 §5·§2(a)(11)·§4(a)(1)이 맨 앞에 오고 네 경로가 차례로 이어진다. 제정법 출처는 uscode.house.gov로 통일했으며 govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | C-00 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Securities Act §5 · 15 U.S.C. §77e(a) | 미등록 증권의 sale 전면금지 | 라우팅이 필요한 이유 자체 — 면제 없으면 거래 불가 | Direct | uscode.house.gov |
| Statute | Securities Act §2(a)(11) · §77b(a)(11) | underwriter 정의("with a view to ... distribution") | 네 경로가 공통으로 무력화하려는 대상 | Direct | uscode.house.gov |
| Statute | Securities Act §4(a)(1) · §77d(a)(1) | issuer·underwriter·dealer 아닌 자의 거래 면제 | Rule 144·144A가 연결되는 상위 면제 | Direct | uscode.house.gov |
| Statute | Securities Act §4(a)(2) · §77d(a)(2) | issuer의 비공모 발행 면제 | "4(a)(1½)" 유추의 뿌리 — 기계 라우팅에서 제외 | Background | uscode.house.gov |
| SEC Rule | Rule 502(d) · §230.502(d) | Reg D 취득분은 §4(a)(2) 지위 · 재판매 제한 | **본 부품 발동 트리거**(lot.restricted = true) | Direct | ecfr.gov |
| SEC Rule | Rule 144 Preliminary Note · §230.144 | safe harbor 구조 · 비배타성 · 회피계획 배제 | 경로 병존(다중 후보) 설계의 법적 근거 | Direct | ecfr.gov |
| SEC Rule | Rule 144(a)(1)(3) · §230.144(a) | affiliate · restricted securities 정의 | G1 restricted 판정 · A-06 cascade 트리거 | Direct | ecfr.gov |
| SEC Rule | Rule 144(b) · §230.144(b) | 비계열(b)(1)/계열(b)(2) 조건 배분 | RULE144 후보의 하류 검사 목록 결정 | Direct | ecfr.gov |
| SEC Rule | Rule 144(c)(d)(e)(f)(g)(h) | 현재정보·보유기간·물량·방법·브로커·통지 | 존재 수준만 스크리닝, 충족은 C-01·C-08 위임 | Conditional | ecfr.gov |
| SEC Rule | Rule 144(i) · §230.144(i) | shell 발행자 증권에 Rule 144 이용 불가 | RULE144 경로의 원천 배제 게이트(⚠ OD-C00-2) | Direct | ecfr.gov |
| Statute | Securities Act §4(a)(7)·(d) · §77d(a)(7)·(d) | AI 상대 재판매 면제 · 8요건 | SEC4A7 후보의 존재요건 6개 | Direct | uscode.house.gov |
| Statute | Securities Act §4(e) · §77d(e) | 취득분의 restricted 유지 · non-distribution 간주 · 비배타성 | 경로 사용 후 lot 상태 갱신 규칙 | Direct | uscode.house.gov |
| SEC Rule | Rule 144A(a)(1) · §230.144A(a)(1) | QIB 정의($100M 증권 재량운용) | RULE144A 후보의 매수인 요건 | Direct | ecfr.gov |
| SEC Rule | Rule 144A(b)(c) · §230.144A | *"deemed not to be an underwriter"* 간주 | RULE144A의 면제 메커니즘 | Direct | ecfr.gov |
| SEC Rule | Rule 144A(d)(e) · §230.144A | 4개 조건 · 다른 면제 불영향 | 존재요건 3개 + 경로 병존 근거 | Direct | ecfr.gov |
| SEC Rule | Reg S Rule 904 · §230.904 | 역외 재판매 safe harbor | REGS_904 후보의 본체 | Direct | ecfr.gov |
| SEC Rule | Reg S Rule 902(b)(c)(h)(k) · §230.902 | 지정역외시장·판촉·역외거래·미국인 정의 | REGS_904 요건을 실제로 채우는 정의들 | Direct | ecfr.gov |
| SEC Rule | Reg S Rule 905 · §230.905 | 역외 재판매 후에도 restricted 유지 | 904 경유 lot의 상태 갱신(계보 보존) | Conditional | ecfr.gov |
| SEC Rule | Rule 270.2a51-1(g)(1) · §270.2a51-1(g)(1) | QIB를 QP로 간주 | 144A ↔ R3 무마찰 근거(§9.3) | Supporting | ecfr.gov |
| SEC Rule | Rule 506(c) · §230.506(c) | 일반청약 허용 발행 면제 | 발행/재판매 비대칭의 한 축(§1.4) — R1 소관 | Supporting | ecfr.gov |
| SEC Rule | Reg ATS Rule 300·301 · §242.300·.301 | 2차 거래 venue 등록·운영 | 경로 활성화의 전제 조건(⚠ OD-C00-2·§12) | Background | ecfr.gov |
| SEC Release | SEC Release 33-8869 · 72 FR 71546 (2008-02-15 시행) | Rule 144 개정(보유기간 1년→6개월 등) | (d) 보유기간 이원 구조의 취지 | Supporting | sec.gov |
| SEC Release | SEC Release 33-6862 · Rule 144A 채택 | 144A 도입 취지(기관 간 유동성) | (d)(3) 조건의 목적 해석 | Supporting | sec.gov |
| SEC Release | SEC Release 33-7505 · 63 FR 9632 (1998) | Reg S 1998년 개정(distribution compliance period 등) | 904·902 현행 문언의 출처 | Supporting | sec.gov |
| SEC Staff | SEC Division of Corporation Finance C&DI — Securities Act Rules (Sections 128~139, 528~532) | Rule 144·§4(a)(7) 실무 해석 | 해석 자료(경계 사안·수동 검토) | Supporting only | sec.gov |
| Case | SEC v. Ralston Purina Co. · 346 U.S. 119 (1953) | public offering의 기능적 기준 | §4(a)(2)·"4(a)(1½)" 유추의 뿌리 | Background | govinfo.gov |
| Statute | FAST Act §76001 · Pub. L. 114-94 (2015-12-04) | §4(a)(7)·(d)·(e) 신설 | SEC4A7 경로의 입법 연혁 | Supporting | govinfo.gov |
| Statute | Securities Act §12(a)(1) · §77l(a)(1) | §5 위반 시 rescission 청구권 | 라우팅 실패의 법적 결과(§1.5·§10.4) | Background | uscode.house.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | C-00이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | §5 — 미등록 sale 금지 | 핵심(전제) | 안 함 — 라우팅이 필요한 이유를 정의 |
| §3.2 | §2(a)(11) — underwriter 정의 | 핵심(전제) | 안 함 — 네 경로가 무력화할 대상을 정의 |
| §3.3 | §4(a)(1) — 기본 면제 | 핵심 | 144·144A 간주 규정이 걸리는 접점 확인 |
| §3.4 | §4(a)(2)와 "4(a)(1½)" | 배경 | **안 함 — 기계 라우팅에서 의도적으로 제외** |
| §3.5 | Rule 502(d) — 재판매 제한 | 핵심(트리거) | G1 — lot.restricted 판정 근거 |
| §3.6 | Rule 144 Preliminary Note | 핵심(구조) | 다중 후보 허용 · 회피계획 배제 게이트 |
| §3.7 | Rule 144(a)(1)(3) — 정의 | 핵심 | restricted 여부 · affiliate cascade 트리거 |
| §3.8 | Rule 144(b) — 조건 배분 | 핵심(분기) | 비계열/계열에 따라 하류 검사 목록 결정 |
| §3.9 | Rule 144(c)~(h) — 6개 조건 | 조건부 | 존재 수준만 — (c)(2)·(f) 채널 가용성 |
| §3.10 | Rule 144(i) — shell 배제 | 핵심(게이트) | RULE144 후보 원천 배제 |
| §3.11 | §4(a)(7)·§77d(d) — 8요건 | 핵심 | SEC4A7 후보의 존재요건 6개 스크리닝 |
| §3.12 | §77d(e) — 효과 | 핵심(사후) | 경로 사용 후 lot 상태 갱신 규칙 |
| §3.13 | Rule 144A(a)(1) — QIB | 핵심 | 매수인 QIB claim 존재 확인 |
| §3.14 | Rule 144A(b)(c) — 간주 | 핵심(구조) | RULE144A의 면제 메커니즘 확인 |
| §3.15 | Rule 144A(d)(e) — 조건·불영향 | 핵심 | 존재요건 3개 + 경로 병존 근거 |
| §3.16 | Reg S Rule 904 — 역외 재판매 | 핵심 | REGS_904 후보의 매도인·거래 요건 |
| §3.17 | Rule 902(b)(c)(h)(k) — 정의 4종 | 핵심 | 매수인 non-U.S. 판정 · (A)갈래 강제 |
| §3.18 | Rule 905 — 역외 후 restricted 유지 | 조건부 | 904 경유 lot의 계보 보존 |
| §3.19 | Sub-요건 분해 매트릭스 | — | 위 요건을 원자적 검증 단위로 분해 |
| §3.20 | ERC-3643 변환·resale.path 총정리 | — | §3.1~§3.18의 온체인 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래 조문은 같은 재판매 거래에 작동하지만 C-00이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리이며, C-00 안에 끌어다 구현하지 않는다.

- **Rule 144(d) 보유기간 계산** (17 CFR §230.144(d)) — lot별 clock·FIFO·corresponding-date 산정. **C-01** 소관. C-00은 "RULE144 경로가 존재하는가"까지만 보고, 6개월/1년이 실제로 찼는지는 묻지 않는다.

- **Rule 144(e) 물량한도** (§230.144(e)) — 3개월 rolling window 누적·1%·ADTV 산정. **C-08** 소관.

- **Rule 501(a) Accredited Investor 판정** (§230.501(a)) — §4(a)(7)(d)(1)의 매수인 AI 여부. **A-03** 소관. C-00은 AI claim의 **존재**만 보고 자격은 판정하지 않는다.

- **ICA §2(a)(51) Qualified Purchaser 판정** (15 U.S.C. §80a-2(a)(51)) — R3 동시 발동 시의 QP 요건. **A-13** 소관.

- **Rule 144(a)(1) affiliate 판정의 실질** (§230.144(a)(1)) — control의 facts-and-circumstances 판단. **A-06** 소관. C-00은 A-06이 낸 affiliate 플래그를 **읽기만** 한다.

- **IEEPA/OFAC 제재 차단** — 모든 거래에 걸리는 transaction-level 글로벌 게이트. **A-01** 소관이며 C-00보다 **먼저** 돈다(§9.1).

### 3.1 § 5 — 미등록 증권의 sale 전면금지 [15 U.S.C. §77e(a) · uscode.house.gov]

**핵심 원문:** Unless a registration statement is in effect as to a security, it shall be unlawful for any person, directly or indirectly- (1) to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to sell such security through the use or medium of any prospectus or otherwise; or (2) to carry or cause to be carried through the mails or in interstate commerce, by any means or instruments of transportation, any such security for the purpose of sale or for delivery after sale.

**한국어:** 어떤 증권에 관하여 registration statement가 효력을 발생하고 있지 아니한 한, 모든 자(any person)가 직접 또는 간접으로 다음의 행위를 하는 것은 위법하다 — (1) prospectus를 통하여 또는 그 밖의 방법으로 그 증권을 매도하기 위하여 주간통상(interstate commerce)에서의 운송 또는 통신 수단이나 우편을 이용하는 것; 또는 (2) 매도의 목적으로 또는 매도 후의 인도를 위하여 그러한 증권을 우편으로 또는 주간통상에서 운송 수단에 의하여 운반하거나 운반하게 하는 것.

**쉬운 설명:** 이 조문의 주어가 "issuer"가 아니라 **"any person"** 이라는 데 전부가 걸려 있다. 발행자만 규제하는 조문이 아니다. 5년 전에 산 토큰을 오늘 되파는 개인도 문언상 여기 들어온다. 그리고 조문 구조가 "원칙 금지 → 예외 열거"라서, 실무의 질문은 언제나 *"이 거래가 규제 대상인가"* 가 아니라 *"이 거래에 쓸 면제가 무엇인가"* 다. C-00은 그 질문을 기계가 던지게 만든 부품이다. 덧붙여 "interstate commerce"의 문턱은 사실상 없다 — 인터넷·이메일 한 번이면 충족된다는 것이 확립된 실무이고, 퍼블릭 블록체인 노드 간 통신도 예외로 볼 근거가 없다.

**PASS/FAIL 반영:** 간접 ✕ — C-00은 §5 자체를 판정하지 않는다. 그러나 §5가 있기 때문에 **경로가 하나도 없으면 거래를 막아야 한다**는 C-00의 fail-closed 기본 태도가 정당화된다(§5.2 G4 → `FAIL_NO_ELIGIBLE_PATH`).

**ERC-3643 변환:** (직접 구현 없음) — 시스템 전체의 기본 태도로 반영된다. `Compliance.canTransfer()`의 기본 반환값이 **false**이고, 경로가 확정되어야만 true로 뒤집힌다. "허용 목록에 없으면 금지"라는 화이트리스트 구조 자체가 §5의 코드적 번역이다.

### 3.2 § 2(a)(11) — Underwriter 정의 [15 U.S.C. §77b(a)(11) · uscode.house.gov]

**핵심 원문:** The term "underwriter" means any person who has purchased from an issuer with a view to, or offers or sells for an issuer in connection with, the distribution of any security, or participates or has a direct or indirect participation in any such undertaking, or participates or has a participation in the direct or indirect underwriting of any such undertaking; but such term shall not include a person whose interest is limited to a commission from an underwriter or dealer not in excess of the usual and customary distributors' or sellers' commission. As used in this paragraph the term "issuer" shall include, in addition to an issuer, any person directly or indirectly controlling or controlled by the issuer, or any person under direct or indirect common control with the issuer.

**한국어:** "underwriter"란 어느 증권의 distribution을 할 목적으로(with a view to) issuer로부터 매수하였거나, 그와 관련하여 issuer를 위하여 offer 또는 sell하는 모든 자, 또는 그러한 undertaking에 참여하거나 직접·간접의 참여지분을 가지는 자, 또는 그러한 undertaking의 직접·간접의 underwriting에 참여하거나 참여지분을 가지는 자를 뜻한다. 다만 그 이익이 underwriter 또는 dealer로부터 받는, 통상적이고 관례적인 배급자 또는 매도인 수수료를 초과하지 아니하는 수수료에 한정되는 자는 이에 포함되지 아니한다. 본 항에서 "issuer"라는 용어는 issuer 외에, issuer를 직접 또는 간접으로 지배하거나 issuer에 의하여 지배되는 모든 자, 또는 issuer와 직접 또는 간접의 공통지배 하에 있는 모든 자를 포함한다.

**쉬운 설명:** 이 정의가 재판매 규제의 심장이다. 두 가지를 봐야 한다. **첫째, "with a view to"는 마음속 의도다.** 온체인에서 읽을 수 없다. 이 비결정성 때문에 SEC는 결정론적 대체지표(보유기간·물량·상대방 자격·소재지)를 규칙으로 만들어야 했고, 그 결과물이 Rule 144·144A·Reg S다. **둘째, 마지막 문장이 조용히 폭탄이다.** "issuer"에 **지배·피지배·공통지배 관계인 자**를 전부 포함시킨다. 즉 계열자(affiliate)로부터 산 사람도 "issuer로부터 산 사람"으로 취급될 수 있고, 계열자 자신이 파는 것도 사실상 발행자가 파는 것처럼 다뤄진다. 이것이 Rule 144가 계열자에게만 (e) 물량한도·(f) 거래방법·(h) 통지를 추가로 거는 이유다 — 계열자의 매도는 구조적으로 distribution을 닮았기 때문이다.

**PASS/FAIL 반영:** 간접 ✕ — C-00은 underwriter 여부를 직접 판정하지 않는다. 네 경로가 각기 "underwriter가 아니다"를 만들어 내는 서로 다른 장치라는 **구조 이해**의 근거일 뿐이다. 다만 마지막 문장이 A-06(affiliate) cascade를 C-00 안으로 끌어오는 근거가 된다(§5.2 G3).

**ERC-3643 변환:** (직접 구현 없음) — 대신 `transferContext.sellerIsAffiliate` (A-06이 채움)와 `lot.lineageR` (CR-3이 채움) 두 필드가 이 조문의 두 요소(지배관계·취득경로)를 각각 대리한다.

### 3.3 § 4(a)(1) — 기본 면제 [15 U.S.C. §77d(a)(1) · uscode.house.gov]

**핵심 원문:** The provisions of section 77e of this title shall not apply to- (1) transactions by any person other than an issuer, underwriter, or dealer.

**한국어:** 이 편 제77e조(§5)의 규정은 다음에는 적용되지 아니한다 — (1) issuer, underwriter 또는 dealer 이외의 자에 의한 거래.

**쉬운 설명:** 재판매의 기본 통로다. 세 가지 부정형 조건이고, 보통의 보유자는 issuer도 dealer도 아니므로 실질적 관문은 **"underwriter가 아닐 것"** 하나로 좁혀진다. 그런데 §2(a)(11)의 정의가 워낙 넓어서, "나는 underwriter가 아니다"를 스스로 입증하는 일이 실무상 대단히 불확실했다. 그래서 SEC가 **"이 조건들을 지키면 underwriter가 아닌 것으로 간주해 주겠다"** 는 안전항을 만들었다. 그게 Rule 144(§3.6)와 Rule 144A(§3.14)다. 즉 두 규칙은 §4(a)(1)의 **독립적 대체물이 아니라 §4(a)(1)로 들어가는 문**이다. 반면 §4(a)(7)은 성격이 다르다 — §4(a)(1)을 경유하지 않고 §4에 직접 붙은 별개의 제정법 면제다.

**PASS/FAIL 반영:** 직접 ○ — RULE144·RULE144A 두 후보가 최종적으로 기대는 면제 조항. 두 경로의 "deemed not to be an underwriter" 간주가 §4(a)(1)의 세 부정 조건 중 하나를 충족시켜야만 면제가 완성된다.

**ERC-3643 변환:** `transferContext.exemptionBasis = SEC_4A1` (RULE144·RULE144A 경로 선택 시 자동 부여). `SEC4A7` 경로는 `exemptionBasis = SEC_4A7`, `REGS_904` 경로는 `exemptionBasis = REGS_904`로 구분해 기록한다 — 감사 추적에서 어느 조문으로 나갔는지가 남아야 하기 때문이다.

### 3.4 § 4(a)(2)와 이른바 "§4(a)(1½)" — 기계 라우팅에서 제외하는 이유 [15 U.S.C. §77d(a)(2) · uscode.house.gov]

**핵심 원문:** The provisions of section 77e of this title shall not apply to- (2) transactions by an issuer not involving any public offering.

**한국어:** 이 편 제77e조(§5)의 규정은 다음에는 적용되지 아니한다 — (2) 공모(public offering)를 수반하지 아니하는 issuer에 의한 거래.

**쉬운 설명:** 문언을 그대로 읽으면 이 면제의 주체는 **issuer**다. 재판매하는 보유자는 issuer가 아니므로, §4(a)(2)는 문언상 재판매에 쓸 수 없다. 그런데 미국 실무는 오랫동안 이 조문에서 **유추**를 끌어냈다 — "발행자가 사모로 팔 수 있다면, 보유자도 같은 조건이면 사모로 되팔 수 있어야 하지 않나." 이 유추에 §4(a)(1)과 §4(a)(2) 사이라는 뜻으로 **"§4(a)(1½)"** 이라는 별명이 붙었다. 조문에 없는 이름이고, 규칙에도 없다. 판례·SEC 실무·변호사 의견서로 쌓인 **관행**이다.

**왜 C-00에서 빼는가.** 세 가지 이유다.

1. **요건이 열거되어 있지 않다.** Rule 144는 (a)~(i)로, §4(a)(7)은 (d)(1)~(8)로 요건이 명시돼 있다. "4(a)(1½)"은 그런 목록이 없다. 없는 목록은 코드로 옮길 수 없다.
2. **판단이 사후적·전체적이다.** 매수인의 sophistication, 정보 접근, 매수 목적, 후속 재판매 여부를 종합해 사후에 평가한다. pre-trade 게이트가 답을 낼 수 있는 형태가 아니다.
3. **대체 경로가 이미 있다.** 2015년 FAST Act가 §4(a)(7)을 신설한 입법 취지가 정확히 이것 — "1½"의 불확실성을 성문 요건으로 대체하는 것이었다. 우리에게 "1½"이 필요한 상황은 §4(a)(7)이 이미 커버한다.

**⚠ 다만 이것은 "존재하지 않는다"는 뜻이 아니다.** §77d(e)(2)가 명시하듯 §4(a)(7)은 배타적 수단이 아니고, Rule 144 Preliminary Note도 같은 말을 한다. 따라서 어떤 거래가 C-00에서 `FAIL_NO_ELIGIBLE_PATH`를 받아도, **그 거래가 위법이라는 뜻은 아니다.** "기계가 판정할 수 있는 경로가 없다"는 뜻일 뿐이고, off-chain에서 변호사 의견으로 "1½"을 쓰는 것은 별개 문제다. 이 구분은 사용자 노출 메시지에 반드시 반영해야 한다(§6.4).

**PASS/FAIL 반영:** 간접 ✕ — **의도적 제외.** 경로 열거집합 `{RULE144, SEC4A7, RULE144A, REGS_904}`에 포함하지 않는다. §12 OD-C00-6에서 재검토 시점을 정한다.

**ERC-3643 변환:** (구현 없음) — 대신 `FAIL_NO_ELIGIBLE_PATH`의 사용자 메시지에 "온체인 자동 경로 없음 · 개별 법률 검토 가능"이라는 취지를 담고, 수동 검토 큐(§6.3)로 보낼 수 있게 한다.

### 3.5 17 CFR § 230.502(d) — Reg D 취득분의 재판매 제한 [ecfr.gov]

**핵심 원문:** (d) *Limitations on resale.* Except as provided in § 230.504(b)(1), securities acquired in a transaction under Regulation D shall have the status of securities acquired in a transaction under section 4(a)(2) of the Act and cannot be resold without registration under the Act or an exemption therefrom. The issuer shall exercise reasonable care to assure that the purchasers of the securities are not underwriters within the meaning of section 2(a)(11) of the Act, which reasonable care may be demonstrated by the following: (1) Reasonable inquiry to determine if the purchaser is acquiring the securities for himself or for other persons; (2) Written disclosure to each purchaser prior to sale that the securities have not been registered under the Act and, therefore, cannot be resold unless they are registered under the Act or unless an exemption from registration is available; and (3) Placement of a legend on the certificate or other document that evidences the securities stating that the securities have not been registered under the Act and setting forth or referring to the restrictions on transferability and sale of the securities.

**한국어:** (d) *재판매의 제한.* §230.504(b)(1)에 규정된 경우를 제외하고, Regulation D에 따른 거래에서 취득된 증권은 본법 §4(a)(2)에 따른 거래에서 취득된 증권의 지위를 가지며, 본법에 따른 등록 또는 그로부터의 면제 없이는 재판매될 수 없다. issuer는 그 증권의 매수인들이 본법 §2(a)(11)의 의미에서의 underwriter가 아님을 담보하기 위하여 상당한 주의(reasonable care)를 기울여야 하며, 그러한 상당한 주의는 다음에 의하여 증명될 수 있다 — (1) 매수인이 자기를 위하여 취득하는지 타인을 위하여 취득하는지를 판단하기 위한 합리적 조회; (2) 각 매수인에게 매도 전에, 그 증권이 본법에 따라 등록되지 아니하였으며 따라서 본법에 따라 등록되거나 등록으로부터의 면제가 이용가능하지 아니하는 한 재판매될 수 없다는 취지의 서면 고지; 그리고 (3) 그 증권을 표창하는 증서 또는 그 밖의 문서에, 그 증권이 본법에 따라 등록되지 아니하였음을 기재하고 그 증권의 양도 및 매도에 관한 제한을 기술하거나 참조하는 legend의 부착.

**쉬운 설명:** **이 조문이 C-00을 발동시키는 방아쇠다.** 우리 토큰은 Rule 506(c)로 발행되고, 506(c)는 Regulation D의 일부다. 따라서 발행 시점에 (d)가 자동으로 걸려 토큰은 restricted가 된다. 이 지위는 시간이 지나도 저절로 사라지지 않는다 — 등록하거나, 면제 경로 하나를 실제로 통과해야만 벗겨진다. 그래서 재판매 시도 때마다 C-00이 호출된다.

**세 번째 요소(legend)가 온체인에서 특히 중요하다.** 종이 증서 시대에는 증서 앞면에 도장을 찍었다. 토큰에는 앞면이 없다. 그래서 (d)(3)의 legend는 **토큰 메타데이터의 전송제한 필드**로 구현되고, 그 표준화가 B-03(Transfer Restriction Metadata) 부품의 일이다. C-00은 B-03이 세팅한 `lot.restricted`를 읽는 소비자다. 다만 (d)의 **의무 주체는 issuer**임에 주의 — reasonable care를 다할 책임은 발행자에게 있고, DEX는 그 의무를 대신 지지 않는다. DEX는 발행자가 세팅한 제한을 **집행**할 뿐이다(§10.4 책임 분배).

**PASS/FAIL 반영:** 직접 ○ — G1(`lot.restricted == true ?`)의 법적 근거. false면 라우팅 자체가 불필요하므로 `PASS_UNRESTRICTED`로 즉시 통과시킨다.

**ERC-3643 변환:** `lot.restricted = true` (B-03이 발행 시 세팅, CR-3 Acquisition Registry에 lot 단위 기록), `lot.sourceType = SRC_REG_D_506C`. C-00은 이 두 필드를 읽기만 한다.

### 3.6 17 CFR § 230.144 Preliminary Note — safe harbor 구조와 비배타성 [ecfr.gov]

**핵심 원문:** Rule 144 is not an exclusive safe harbor. A person who does not meet all of the applicable conditions of Rule 144 still may claim any other available exemption under the Act for the sale of the securities. The Rule 144 safe harbor is not available to any person with respect to any transaction or series of transactions that, although in technical compliance with Rule 144, is part of a plan or scheme to evade the registration requirements of the Act.

**한국어:** Rule 144는 배타적 safe harbor가 아니다. Rule 144의 적용가능한 조건 전부를 충족하지 못하는 자라도 그 증권의 매도를 위하여 본법에 따라 이용가능한 그 밖의 면제를 주장할 수 있다. Rule 144 safe harbor는, Rule 144에 기술적으로는 부합하더라도 본법의 등록요건을 회피하기 위한 계획 또는 책략(plan or scheme to evade)의 일부인 거래 또는 일련의 거래에 관하여는, 어느 누구에게도 이용가능하지 아니하다.

**⭐ 그리고 이 Preliminary Note에는 위 인용 앞에, 우리 프로젝트 전체의 방법론을 SEC가 직접 진술한 단락이 있다.** 그대로 옮긴다.

> **원문:** Since it is difficult to ascertain the mental state of the purchaser at the time of an acquisition of securities, prior to and since the adoption of Rule 144, subsequent acts and circumstances have been considered to determine whether the purchaser took the securities "with a view to distribution" at the time of the acquisition. Emphasis has been placed on factors such as the length of time the person held the securities and whether there has been an unforeseeable change in circumstances of the holder. Experience has shown, however, that reliance upon such factors alone has led to uncertainty in the application of the registration provisions of the Act. The Commission adopted Rule 144 to establish specific criteria for determining whether a person is not engaged in a distribution.

> **한국어:** 증권 취득 시점에 매수인의 **심리 상태(mental state)를 확인하기가 어렵기 때문에**, Rule 144의 채택 전후를 통하여, 매수인이 취득 시점에 그 증권을 "배포할 목적으로" 취득하였는지를 판단하기 위하여 **후속의 행위와 정황**이 고려되어 왔다. 그 사람이 증권을 보유한 **기간의 길이**, 그리고 보유자의 사정에 **예견할 수 없는 변화**가 있었는지와 같은 요소들에 중점이 놓여 왔다. 그러나 경험이 보여준 바로는, 그러한 요소들에만 의존하는 것은 본법 등록규정의 적용에 **불확실성을 초래**하였다. 위원회는 어떤 자가 distribution에 종사하고 있지 아니한지를 판단하기 위한 **구체적 기준(specific criteria)을 확립하기 위하여** Rule 144를 채택하였다.

**이 단락은 우리 방법론의 원본이다.** 순서를 보라 — ① 심리 상태는 확인 불가 → ② 그래서 정황증거(보유기간·사정변경)로 추정 → ③ 그런데 그것도 불확실 → ④ 그래서 **구체적 기준**을 규칙으로 못박음. 이것이 정확히 Decipher가 하는 일(법조문 → 요건분해 → 원자적 검증단위)의 원형이며, **SEC가 1972년에 이미 같은 문제를 같은 방식으로 풀었다**는 뜻이다. C-00이 온체인에서 하는 라우팅은 그 결과물을 소비하는 것이지, 없던 결정성을 새로 만들어 내는 것이 아니다(§5.5·§8.3).

**쉬운 설명:** 짧은 문단이지만 C-00 설계의 두 기둥이 여기서 나온다.

**첫째 문장 — 비배타성.** Rule 144를 못 맞춰도 다른 면제를 쓸 수 있다. 뒤집으면, **경로들은 병존한다.** 하나가 닫혀도 다른 게 열려 있을 수 있고, 여러 개가 동시에 열려 있을 수도 있다. 이것이 C-00이 `candidates[]`라는 **집합**을 만든 뒤 그중 하나를 고르는 2단 구조(§5.2 G3 → G5)를 쓰는 법적 근거다. 만약 경로가 배타적이라면 첫 번째 매치에서 멈추면 그만이고, 집합도 우선순위도 필요 없다. 같은 취지가 §230.144A Preliminary Note 2("does not act as an exclusive election")와 §77d(e)(2)("shall not be the exclusive means")에도 반복된다 — 세 조문이 같은 말을 하고 있다는 사실 자체가 이 원리의 무게를 보여준다.

**셋째 문장 — 회피계획 배제.** 기술적으로 요건을 다 맞춰도, 그 거래가 등록회피 **계획의 일부**면 safe harbor가 사라진다. 이건 C-00에게 불편한 조항이다. "계획"은 의도이고, 의도는 온체인에서 읽을 수 없다. 다만 **"series of transactions"** 라는 표현이 힌트를 준다 — 개별 거래가 아니라 **패턴**을 본다는 뜻이다. 그래서 우리는 이것을 pre-trade 게이트가 아니라 **post-trade 모니터링**(R4 Market Conduct)의 일로 배치한다. C-00은 단일 거래의 스냅샷만 보므로 계획을 판정할 위치에 있지 않다.

**PASS/FAIL 반영:** 직접 ○(구조) — 다중 후보 열거(G3)와 우선순위 확정(G5)의 2단 구조를 정당화한다. 회피계획 배제는 **간접 ✕** — pre-trade에서 판정하지 않고 R4로 위임한다.

**ERC-3643 변환:** `candidates[]` 집합 구성 로직 자체가 첫 문장의 구현이다. 회피계획 배제는 `manifest.evasionMonitoring = R4_POST_TRADE`로 소관을 명시하고, C-00은 여기에 관여하지 않는다.

### 3.7 17 CFR § 230.144(a)(1)·(a)(3) — affiliate와 restricted securities 정의 [ecfr.gov]

**핵심 원문:** (1) An *affiliate* of an issuer is a person that directly, or indirectly through one or more intermediaries, controls, or is controlled by, or is under common control with, such issuer. ... (3) The term *restricted securities* means: (i) Securities acquired directly or indirectly from the issuer, or from an affiliate of the issuer, in a transaction or chain of transactions not involving any public offering; (ii) Securities acquired from the issuer that are subject to the resale limitations of § 230.502(d) under Regulation D or § 230.701(c); (iii) Securities acquired in a transaction or chain of transactions meeting the requirements of § 230.144A;

**한국어:** (1) issuer의 *affiliate*란 그 issuer를 직접으로 또는 하나 이상의 중간자를 통하여 간접으로 지배하거나(controls), 그에 의하여 지배되거나(is controlled by), 또는 그와 공통지배 하에 있는(is under common control with) 자를 말한다. ... (3) *restricted securities*라는 용어는 다음을 뜻한다 — (i) 공모를 수반하지 아니하는 거래 또는 일련의 거래(chain of transactions)에서 issuer로부터 또는 issuer의 affiliate로부터 직접 또는 간접으로 취득된 증권; (ii) Regulation D상 §230.502(d) 또는 §230.701(c)의 재판매 제한에 걸리는, issuer로부터 취득된 증권; (iii) §230.144A의 요건을 충족하는 거래 또는 일련의 거래에서 취득된 증권;

**쉬운 설명:** 두 정의가 각각 C-00의 다른 부분을 움직인다.

**(a)(1) affiliate — 퍼센트 문턱이 없다.** "controls"에 숫자가 없다. 10%도 20%도 아니다. facts and circumstances로 판단한다. 이것은 온체인 코드가 절대 재현할 수 없는 판단이라, A-06(Affiliate)이 증명서형(패턴 B)으로 처리한다. C-00은 A-06이 낸 플래그를 **읽기만** 한다. ⚠ 여기서 흔한 오류 하나 — §230.144(b)(1)의 *"has not been an affiliate during the preceding three months"* 와 (b)(2)의 *"was an affiliate at any time during the 90 days"* 는 **다른 기간**이다. 앞은 3개월(역월), 뒤는 90일(일수)이다. 둘을 하나의 숫자로 뭉개는 것이 이 조문에서 가장 자주 나오는 구현 오류다.

**(a)(3) restricted securities — "chain of transactions"가 계보를 만든다.** (i)에 *"or chain of transactions"* 가 들어 있다는 것은, 중간에 몇 번 손이 바뀌어도 최초 취득이 사모였으면 restricted 지위가 **따라다닌다**는 뜻이다. 이 계보 개념이 CR-3 Acquisition Registry의 `lot.lineageR` 필드로 구현된다. 그리고 (iii)이 재귀를 만든다 — **144A로 산 것도 restricted**다. 즉 144A 경로로 매수한 사람은 다시 restricted 보유자가 되어, 다음에 팔 때 C-00을 또 부른다. 경로는 소진되지 않고 순환한다.

**⚠ AMM 풀 금기의 뿌리도 여기다.** (i)의 계보 추적이 성립하려면 lot 단위 신원이 유지돼야 한다. AMM 유동성 풀은 토큰을 fungible하게 뒤섞어 lot 계보를 파괴한다. 그래서 restricted lot은 P2P·RFQ 채널로만 돌려야 한다(B-04 소관, §9.2).

**PASS/FAIL 반영:** 직접 ○ — (a)(3)은 G1(restricted 판정)의 정의 근거. (a)(1)은 **조건부 △** — G3에서 RULE144 후보의 하류 검사 목록을 (b)(1)/(b)(2) 중 어느 쪽으로 붙일지 가르는 분기 입력.

**ERC-3643 변환:** `lot.restricted` (B-03 세팅), `lot.lineageR` (CR-3 관리, (i)의 chain 대응), `lot.sourceType ∈ {SRC_REG_D_506C, SRC_RULE_144A, SRC_SEC_4A7, SRC_REGS, ...}` ((a)(3) 각 호 대응), `transferContext.sellerIsAffiliate` (A-06 claim에서 읽음).

### 3.8 17 CFR § 230.144(b) — 조건 배분: 비계열자와 계열자가 갈린다 [ecfr.gov]

**핵심 원문:** (b) *Conditions to be met.* Subject to [paragraph (i)] of this section, the following conditions must be met: (1) *Non-affiliates.* (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Securities Exchange Act of 1934 (the Exchange Act), any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of paragraphs (c)(1) and (d) of this section are met. ... (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if the condition of paragraph (d) of this section is met. (2) *Affiliates or persons selling on behalf of affiliates.* Any affiliate of the issuer, or any person who was an affiliate at any time during the 90 days immediately before the sale, who sells restricted securities, or any person who sells restricted or any other securities for the account of an affiliate of the issuer of such securities, or any person who sells restricted or any other securities for the account of a person who was an affiliate at any time during the 90 days immediately before the sale, shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Act if all of the conditions of this section are met.

**한국어:** (b) *충족되어야 할 조건.* 본조 (i)항의 적용을 받되, 다음의 조건들이 충족되어야 한다 — (1) *비계열자.* (i) 그 증권의 issuer가 매도 직전 **최소 90일 이상의 기간 동안** 1934년 증권거래법 §13 또는 §15(d)의 보고요건의 적용을 받아 왔고 또 받고 있는 경우, 매도 시점에 issuer의 affiliate가 아니고 **직전 3개월 동안** affiliate가 아니었던 자로서 그 issuer의 restricted securities를 자기 계산으로 매도하는 자는, 본조 (c)(1)항 및 (d)항의 조건 전부가 충족되면 본법 §2(a)(11)의 의미에서 그 증권의 underwriter가 아닌 것으로 간주된다. ... (ii) 그 증권의 issuer가 매도 직전 최소 90일 이상의 기간 동안 거래법 §13 또는 §15(d)의 보고요건의 적용을 받지 아니하거나 받아 오지 아니한 경우, 매도 시점에 issuer의 affiliate가 아니고 직전 3개월 동안 affiliate가 아니었던 자로서 그 issuer의 restricted securities를 자기 계산으로 매도하는 자는, 본조 **(d)항의 조건이 충족되면** 본법 §2(a)(11)의 의미에서 그 증권의 underwriter가 아닌 것으로 간주된다. (2) *계열자 또는 계열자를 위하여 매도하는 자.* issuer의 affiliate, 또는 매도 직전 **90일 중 어느 때라도** affiliate였던 자로서 restricted securities를 매도하는 자, 또는 그 증권의 issuer의 affiliate의 계산으로 restricted securities 또는 그 밖의 증권을 매도하는 자, 또는 매도 직전 90일 중 어느 때라도 affiliate였던 자의 계산으로 restricted securities 또는 그 밖의 증권을 매도하는 자는, **본조의 조건 전부**가 충족되면 본법 §2(a)(11)의 의미에서 그 증권의 underwriter가 아닌 것으로 간주된다.

**쉬운 설명:** 이 조문이 Rule 144를 **네 칸짜리 표**로 만든다. 축이 둘 — 발행자가 보고회사인가, 매도인이 계열자인가.

| | 발행자 = 보고회사 | 발행자 = 비보고회사 ← **우리** |
| --- | --- | --- |
| **비계열 매도인** | (b)(1)(i) → (c)(1) + (d) 필요 · 보유 6개월 | **(b)(1)(ii) → (d)만 필요 · 보유 1년** |
| **계열 매도인** | (b)(2) → **전 조건**((c)~(h)) · 보유 6개월 | (b)(2) → **전 조건**((c)~(h)) · 보유 1년 |

우리가 서 있는 칸은 오른쪽 위다. **(b)(1)(ii) — 요구 조건이 (d) 보유기간 하나뿐이다.** (c) 현재 공개정보 없음, (e) 물량한도 없음, (f) 거래방법 제한 없음, (g) 브로커 요건 없음, (h) Form 144 통지 없음. 조문을 몇 번 다시 읽어도 그렇게 되어 있다. 대신 (d)(1)(ii)가 보유기간을 1년으로 늘린다(§3.9). **"조건 하나, 시간 두 배"** 다.

**이 사실의 무게.** 이것이 §2에서 예고한 보수적 기본값(`enabledPaths = {RULE144}`)의 법리적 근거다. 네 경로 중 **RULE144 비계열자 경로만이 venue 설계에 아무 제약도 걸지 않는다.** §4(a)(7)은 매도인 측 일반청약을 금지하고(공개 호가창 위험), Rule 144A는 매수인에게 144A 원용 사실을 고지하게 하며(UI 요구), Reg S 904는 미국 내 판촉 금지와 매수인 소재지 확인을 요구한다. RULE144 비계열 경로는 — 발행자가 shell만 아니라면(§3.10) — **오직 시간만 요구한다.** 시간은 온체인이 가장 정확하게 아는 것이다.

**오른쪽 아래 칸(계열자)은 반대다.** *"all of the conditions of this section"* 이므로 (c)(2)의 공개정보 요건이 살아난다. 사모 펀드가 §240.15c2-11 수준의 정보를 publicly available하게 두는 일은 정의상 드물다. 여기에 (f) 거래방법 제한까지 겹치면 **계열자에게 Rule 144는 사실상 닫혀 있다**(§3.9). C-00은 이를 존재 수준에서 읽어 내 후보에서 뺀다.

**PASS/FAIL 반영:** 직접 ○ — RULE144 후보의 존재 여부와 하류 검사 목록을 동시에 결정한다. 비계열이면 `downstreamChecks = [C-01]`, 계열이면 `downstreamChecks = [C-01, C-08, A-06]` + (c)(2)·(f) 존재 게이트.

**ERC-3643 변환:** `manifest.issuerReportingStatus ∈ {REPORTING, NON_REPORTING}` (우리는 NON_REPORTING), `transferContext.sellerIsAffiliate` (A-06), `transferContext.rule144Branch ∈ {B1_II_NONAFFILIATE, B2_AFFILIATE}` (C-00이 세팅해 하류에 전달).

### 3.9 17 CFR § 230.144(c)~(h) — 여섯 개 조건, 그중 무엇을 C-00이 보는가 [ecfr.gov]

**핵심 원문 (d)(1):** (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, a minimum of six months must elapse between the later of the date of the acquisition of the securities from the issuer, or from an affiliate of the issuer, and any resale of such securities in reliance on this section for the account of either the acquiror or any subsequent holder of those securities. (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, a minimum of one year must elapse between the later of the date of the acquisition of the securities from the issuer, or from an affiliate of the issuer, and any resale of such securities in reliance on this section for the account of either the acquiror or any subsequent holder of those securities.

**한국어:** (i) 그 증권의 issuer가 매도 직전 최소 90일 이상의 기간 동안 거래법 §13 또는 §15(d)의 보고요건의 적용을 받아 왔고 또 받고 있는 경우, issuer로부터 또는 issuer의 affiliate로부터 그 증권을 취득한 날 중 **나중의 날(the later of)** 과, 취득자 또는 그 증권의 후속 보유자의 계산으로 본조에 의존하여 이루어지는 그 증권의 재판매 사이에는 **최소 6개월(a minimum of six months)** 이 경과하여야 한다. (ii) 그 증권의 issuer가 매도 직전 최소 90일 이상의 기간 동안 거래법 §13 또는 §15(d)의 보고요건의 적용을 받지 아니하거나 받아 오지 아니한 경우, ... 사이에는 **최소 1년(a minimum of one year)** 이 경과하여야 한다.

**쉬운 설명:** (c)부터 (h)까지 여섯 조건을 한 표로 정리하고, 그중 C-00이 어디까지 보는지를 명시한다. **핵심 원칙 — C-00은 "그 조건을 만족시킬 수단이 아예 없는가"만 보고, "실제로 만족했는가"는 안 본다.**

| 조건 | 내용 | 우리에게 걸리나 | C-00이 보는 것 (존재 수준) | 충족 판정 주체 |
| --- | --- | --- | --- | --- |
| (c) 현재 공개정보 | 비보고 발행자면 (c)(2) — §240.15c2-11(b)(5)(i)(A)~(N)·(P) 정보가 publicly available | **계열자만** ((b)(1)(ii)는 (c) 불요) | `manifest.issuerPublicInfoAvailable` — false면 계열자 RULE144 후보 **삭제** | (해당 없음 — 존재로 끝) |
| (d) 보유기간 | 비보고 발행자면 **1년**((d)(1)(ii)) | **전원** | lot 존재 여부만 | **C-01** |
| (e) 물량한도 | 직전 3개월 누적이 1%·ADTV 중 최대치 이하 | **계열자만** | (없음 — 항상 만족 가능) | **C-08** |
| (f) 거래방법 | 브로커 거래·마켓메이커·riskless principal 중 하나 | **계열자만** | `manifest.venueChannels` — 셋 중 하나도 없으면 계열자 후보 **삭제** | (해당 없음 — 존재로 끝) |
| (g) 브로커 거래 정의 | (f)(1)(i)의 "brokers' transactions" 구체화 | (f)에 종속 | (f)와 함께 판정 | — |
| (h) 통지(Form 144) | 3개월 중 5,000주 초과 또는 $50,000 초과 시 Form 144 제출 | **계열자만** | (없음 — Operator layer가 대행 가능) | **Operator layer** |

**세 가지를 짚는다.**

**① (d)의 "the later of"가 C-01에게 계보를 강제한다.** 조문은 "취득일과 재판매 사이"가 아니라 **"취득일들 중 나중의 날과 재판매 사이"** 라고 쓴다. 그리고 *"for the account of either the acquiror or any subsequent holder"* — 후속 보유자에게도 같은 시계가 이어진다. 즉 시계는 지갑이 아니라 **lot에 붙어** 다닌다. 이것이 CR-3 lot 스키마의 `clockStart`가 필요한 이유이며, 계산 자체는 C-01의 일이다.

**② "a minimum of"는 ≥ 다.** 정확히 1년이 되는 날은 **통과**한다. 초과일 필요가 없다. C-01의 비교 연산자는 `elapsed ≥ 1 year`이지 `>`가 아니다. (⭐ Decipher 연산자 규율 — Rule 144(e)의 *"shall not exceed"* 는 반대로 `aggregate ≤ cap`이라 정확히 한도면 통과. 두 조문의 부등호 방향이 반대라는 점을 혼동하면 경계 거래가 뒤집힌다.)

**③ (c)(2)와 (f)가 계열자 RULE144를 사실상 죽인다.** (c)(2)는 사모 펀드가 §240.15c2-11 수준의 정보를 **공개**하라고 요구한다. 사모의 정의와 정면으로 충돌한다. (f)는 브로커·마켓메이커·riskless principal을 요구하는데, 셋 다 **등록 broker-dealer**를 전제한다. 우리 venue에 등록 BD가 없으면 셋 다 불가능하다. 이 두 조건은 lot 상태와 무관한 **정적 사실**이므로 존재 수준에서 판정 가능하고, C-00이 후보 단계에서 잘라 낸다. ⚠ 이는 BD/ATS 지위 미해결 문제(§12 OD-C00-2)와 직결된다 — 그 문제가 풀리면 (f)가 열리고, 계열자 RULE144도 (c)(2)만 남는다.

**PASS/FAIL 반영:** 조건부 △ — (c)(2)·(f)는 **직접 ○**(존재 게이트로 후보 삭제), (d)·(e)·(h)는 **간접 ✕**(C-01·C-08·Operator로 위임).

**ERC-3643 변환:** `manifest.issuerPublicInfoAvailable ∈ {true, false}` (현재 false), `manifest.venueChannels ⊆ {BROKER, MARKET_MAKER, RISKLESS_PRINCIPAL}` (현재 ∅), `downstreamChecks[]`에 C-01·C-08 추가. C-00 자신은 (d)의 시간 산술을 **수행하지 않는다**.

### 3.10 17 CFR § 230.144(i) — shell 발행자 배제, 우리 기본 경로의 최대 위험 [ecfr.gov]

**핵심 원문:** (i) *Unavailability to securities of issuers with no or nominal operations and no or nominal non-cash assets.* (1) This section is not available for the resale of securities initially issued by an issuer defined below: (i) An issuer, other than a business combination related shell company, as defined in § 230.405, or an asset-backed issuer, as defined in Item 1101(b) of Regulation AB (§ 229.1101(b) of this chapter), that has: (A) No or nominal operations; and (B) Either: (*1*) No or nominal assets; (*2*) Assets consisting solely of cash and cash equivalents; or (*3*) Assets consisting of any amount of cash and cash equivalents and nominal other assets; or (ii) An issuer that has been at any time previously an issuer described in paragraph (i)(1)(i).

**한국어:** (i) *영업이 없거나 명목적이고 비현금자산이 없거나 명목적인 issuer의 증권에 대한 이용 불가.* (1) 본조는 아래에 정의된 issuer가 최초로 발행한 증권의 재판매에는 이용할 수 없다 — (i) §230.405에 정의된 business combination related shell company 또는 Regulation AB Item 1101(b)(§229.1101(b))에 정의된 asset-backed issuer 이외의 issuer로서 다음에 해당하는 자 — (A) 영업이 없거나 명목적일 것(No or nominal operations); **그리고** (B) 다음 중 어느 하나 — (*1*) 자산이 없거나 명목적일 것; (*2*) 자산이 **오로지 현금 및 현금성자산으로만 구성될 것**(Assets consisting solely of cash and cash equivalents); 또는 (*3*) 자산이 임의 금액의 현금 및 현금성자산과 명목적인 그 밖의 자산으로 구성될 것; 또는 (ii) 과거 어느 때라도 (i)(1)(i)에 기술된 issuer였던 자.

**쉬운 설명:** **이 조문이 C-00의 가장 위험한 지점이다.** 이유를 단계로 보자.

**1단계 — 문언이 우리를 정면으로 겨눈다.** (B)(*2*)는 *"Assets consisting solely of cash and cash equivalents"* 다. 토큰화 국채·MMF형 펀드의 자산이 문언상 정확히 이것이다. 단기 미 국채는 회계상 통상 cash equivalent로 분류된다. (B)는 성립할 소지가 매우 크다.

**2단계 — 그래서 (A)로 방어해야 한다.** (A)와 (B)는 세미콜론 뒤 "and"로 연결된 **AND**다. 따라서 (A) *"No or nominal operations"* 를 부정하면 (i)(1)(i)가 깨진다. 펀드가 운용사를 두고 포트폴리오를 굴리고, 매일 NAV를 산정하고, 환매에 응하고, 관리·감사·수탁을 유지한다면 — 그것이 operations이 아니라고 하기는 어렵다. **이것이 우리의 방어선이다.**

**3단계 — 그런데 bright line이 없다.** (i)는 2008년 Release 33-8869로 blank-check·역합병 shell의 오남용을 막으려 도입됐고, 문언은 그 목적보다 넓게 쓰였다. SEC가 운용 중인 투자펀드에 (i)를 적용한 사례는 알려진 바 없으나, **"적용한 사례가 없다"는 것과 "적용되지 않는다"는 것은 다르다.** 그리고 (i)(1)(ii)의 "과거 어느 때라도" 조항이 특히 고약하다 — 펀드 설립 직후 자금 모집 전 기간(자산=현금, 영업=아직 없음)이 (i)(1)(i)에 걸렸다면, 그 이후로 아무리 잘 굴려도 **영구히** Rule 144를 못 쓴다. §230.144(i)(2)에 구제 조항이 있으나 그것은 Exchange Act 보고회사에게만 열려 있어(*"is subject to the reporting requirements of section 13 or 15(d)"*), **비보고 사모 펀드에게는 구제 경로가 없다.**

**4단계 — 결과의 크기.** RULE144는 우리의 **유일한 활성 경로**다. 여기가 무너지면 대체가 없다. §4(a)(7)·144A·904가 전부 비활성이므로, `enabledPaths`가 공집합이 되어 모든 재판매가 `FAIL_NO_PATH_ENABLED`로 떨어진다. **부품의 문제가 아니라 제품의 문제**가 된다.

**5단계 — 대조되는 조문.** §77d(d)(6)(§4(a)(7)의 shell 배제)은 기준이 다르다 — *"shell company that has no specific business plan or purpose"* 다. 자산 구성도 영업 규모도 안 본다. **사업계획의 특정성**만 본다. 단기 국채 포트폴리오를 운용해 수익을 배분한다는 것은 명백히 specific business plan이다. 즉 **§4(a)(7)이 shell 리스크에서 Rule 144보다 구조적으로 안전하다.** 같은 취지의 배제 조항이 문언 차이로 정반대 결과를 낳는 사례이며, Q-B1을 개방 쪽으로 미는 강한 논거다(§12 OD-C00-1).

**보수적 처리.** C-00은 이 판단을 자체적으로 하지 않는다. `manifest.issuerShellStatus`를 읽고, 값이 `NOT_SHELL_COUNSEL_CONFIRMED`가 아니면 RULE144 후보를 **삭제**한다. 즉 **변호사 확인이 있어야만 열린다.** 기본값은 닫힘이다.

**PASS/FAIL 반영:** 직접 ○ — RULE144 후보의 원천 배제 게이트. `manifest.issuerShellStatus ≠ NOT_SHELL_COUNSEL_CONFIRMED` → RULE144를 `candidates[]`에서 제거.

**ERC-3643 변환:** `manifest.issuerShellStatus ∈ {NOT_SHELL_COUNSEL_CONFIRMED, SHELL, UNDETERMINED}` (기본값 `UNDETERMINED`), 실패 코드 `FAIL_RULE144_SHELL_ISSUER`. 이 필드는 온체인 계산 대상이 아니라 **manifest에 실린 법률 판단의 스냅샷**이며, 갱신은 B-01(Manifest Integrity)의 서명 절차를 따른다.

### 3.11 § 4(a)(7)·§77d(d) — AI 상대 재판매 면제의 8요건 [15 U.S.C. §77d(a)(7)·(d) · uscode.house.gov]

**핵심 원문:** The provisions of section 77e of this title shall not apply to- ... (7) transactions meeting the requirements of subsection (d). ... (d) *Certain accredited investor transactions.* The transactions referred to in subsection (a)(7) are transactions meeting the following requirements: (1) *Accredited investor requirement.*-Each purchaser is an accredited investor, as that term is defined in section 230.501(a) of title 17, Code of Federal Regulations (or any successor regulation). (2) *Prohibition on general solicitation or advertising.*-Neither the seller, nor any person acting on the seller's behalf, offers or sells securities by any form of general solicitation or general advertising. ... (4) *Issuers disqualified.*-The transaction is not for the sale of a security where the seller is an issuer or a subsidiary, either directly or indirectly, of the issuer. ... (6) *Business requirement.*-The issuer is engaged in business, is not in the organizational stage or in bankruptcy or receivership, and is not a blank check, blind pool, or shell company that has no specific business plan or purpose or has indicated that the issuer's primary business plan is to engage in a merger or combination of the business with, or an acquisition of, an unidentified person. (7) *Underwriter prohibition.*-The transaction is not with respect to a security that constitutes the whole or part of an unsold allotment to, or a subscription or participation by, a broker or dealer as an underwriter of the security or a redistribution. (8) *Outstanding class requirement.*-The transaction is with respect to a security of a class that has been authorized and outstanding for at least 90 days prior to the date of the transaction.

**한국어:** 이 편 제77e조(§5)의 규정은 다음에는 적용되지 아니한다 — ... (7) (d)항의 요건을 충족하는 거래. ... (d) *일정한 적격투자자 거래.* (a)(7)항이 말하는 거래란 다음의 요건을 충족하는 거래이다 — (1) *적격투자자 요건.* 각 매수인이 17 CFR §230.501(a)(또는 그 승계 규정)에 정의된 accredited investor일 것. (2) *일반청약 또는 광고의 금지.* 매도인도, 매도인을 위하여 행위하는 자도, 어떠한 형태의 일반청약(general solicitation) 또는 일반광고(general advertising)에 의하여 증권을 offer 또는 sell하지 아니할 것. ... (4) *발행자 결격.* 그 거래가, 매도인이 issuer이거나 issuer의 직접 또는 간접의 자회사인 증권의 매도를 위한 것이 아닐 것. ... (6) *영업 요건.* issuer가 영업 중이고, 조직 단계에 있거나 파산 또는 관재 중이 아니며, 특정한 사업계획 또는 목적이 없는(has no specific business plan or purpose) blank check, blind pool 또는 shell company가 아니고, 그 주된 사업계획이 특정되지 아니한 자와의 사업의 합병·결합 또는 그의 인수를 하는 것이라고 표시한 바 없을 것. (7) *인수인 금지.* 그 거래가, broker 또는 dealer가 그 증권의 underwriter로서 가지는 미판매 배정분(unsold allotment) 또는 subscription·participation의 전부 또는 일부를 구성하는 증권, 또는 redistribution에 관한 것이 아닐 것. (8) *발행 클래스 요건.* 그 거래가, 그 거래일 전 **최소 90일 이상(at least 90 days)** 수권되어 발행되어 있어 온 클래스의 증권에 관한 것일 것.

**쉬운 설명:** 2015년 FAST Act가 신설한 조문이다. 입법 취지는 명확했다 — 조문에도 규칙에도 없이 관행으로만 존재하던 "§4(a)(1½)"의 불확실성을, **8개의 성문 요건**으로 대체하는 것. 그래서 이 조문은 처음부터 **기계가 읽기 좋게** 만들어져 있다. C-00이 §4(a)(7)을 네 경로 중 하나로 취급하는 이유다.

8요건을 존재/충족으로 나누면 이렇게 된다.

| # | 요건 | 성격 | C-00이 보는 것 | 판정 주체 |
| --- | --- | --- | --- | --- |
| (d)(1) | 각 매수인이 AI | 충족 | AI claim의 **존재**만 | **A-03** |
| (d)(2) | 매도인 측 일반청약 금지 | 존재(venue 정책) | `manifest.venueSolicitationProfile` | C-00 |
| (d)(3) | 비보고 발행자면 (A)~(K) 정보 제공 | 존재(정보팩 유무) + 충족(개별 전달) | `manifest.issuerInfoPackage` 존재 | C-00 + Operator |
| (d)(4) | 매도인이 발행자·자회사가 아닐 것 | 존재 | `seller ≠ issuer ∧ seller ∉ issuerSubsidiaries` | C-00 |
| (d)(5) | bad actor 아닐 것 | 충족 | (제재·결격 claim 존재) | A-01 / Operator |
| (d)(6) | 영업 중 · 비shell | 존재 | `manifest.issuerBusinessStatus` | C-00 |
| (d)(7) | 미판매 배정분·redistribution 아닐 것 | 존재 | `lot.sourceType ∉ {SRC_UNSOLD_ALLOTMENT}` | C-00 |
| (d)(8) | 클래스가 90일 이상 발행 유지 | 존재 | `now − manifest.classAuthorizedAt ≥ 90 days` | C-00 |


[output truncated at 50000 of 131141 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007866
- Available tabs:
  • tabId 437007716: "(1) 7/8 | Notion" (https://app.notion.com/p/deciphersnu/7-8-398dff004c898098b1defb8a486ffa72)
  • tabId 437007865: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/04fc44e8-c61b-4105-bd9c-3c00978b074b/Element.B-04_엔진-선택.md?table=block&id=39edff00-4c89-80c1-8d79-de9a7419301e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=RiUqq1SnVeD2ASSYNtcy9mv7534Ay83CtVaKuwmrTXg&downloadName=Element.B-04_엔진-선택.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/04fc44e8-c61b-4105-bd9c-3c00978b074b/Element.B-04_%E1%84%8B%E1%85%A6%E1%86%AB%E1%84%8C%E1%85%B5%E1%86%AB-%E1%84%89%E1%85%A5%E1%86%AB%E1%84%90%E1%85%A2%E1%86%A8.md?table=block&id=39edff00-4c89-80c1-8d79-de9a7419301e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=RiUqq1SnVeD2ASSYNtcy9mv7534Ay83CtVaKuwmrTXg&downloadName=Element.B-04_%E1%84%8B%E1%85%A6%E1%86%AB%E1%84%8C%E1%85%B5%E1%86%AB-%E1%84%89%E1%85%A5%E1%86%AB%E1%84%90%E1%85%A2%E1%86%A8.md)
  • tabId 437007866: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/89c220ee-b89c-43e6-b667-e611a389f432/C-00_resale-path-selector.md?table=block&id=39fdff00-4c89-80e2-81e5-c5ad6255b224&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=caSVWlN7iZZuzQMF-aGrK7Nb0sobDN-vWpWUPPE8HmU&downloadName=C-00_resale-path-selector.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/89c220ee-b89c-43e6-b667-e611a389f432/C-00_resale-path-selector.md?table=block&id=39fdff00-4c89-80e2-81e5-c5ad6255b224&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=caSVWlN7iZZuzQMF-aGrK7Nb0sobDN-vWpWUPPE8HmU&downloadName=C-00_resale-path-selector.md)
  • tabId 437007867: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/d4595b45-121b-4546-851e-4de3ab05ce7b/Element.D-01_보유자-수-카운터.md?table=block&id=39edff00-4c89-807f-aa04-c016b72d5575&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=BSbO33EdGZEmvEqzE2iuf1NaeRjmPG95ZRm3hUeNd7w&downloadName=Element.D-01_보유자-수-카운터.md" (
