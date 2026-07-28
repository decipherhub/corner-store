# ELE.B-04_engine-selection

# B-04 Engine Selection(엔진 선택) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 엔진 선택 부품(내부 식별자 B-04)을, 미국 증권 재판매 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 PASS/FAIL이 결정되고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-07-08).** 본 부품의 미국 증권법 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §77d·§77e·§78c는 uscode.house.gov 현행본(각 페이지 표기 기준 2026-05-29~06-14 시행 법률 반영), 17 CFR §230.144·§230.501·§230.502·§230.506·§242.300은 eCFR 현행본(Title 17, 2026-07-01/07-06 기준 표시·최종 개정 2026-06-25 반영), SEC 채택 release(Release No. 33-8869, 2007-12-06)·staff statement는 sec.gov다. 전 조문은 2026-07-08 접속·문자 대조했다. 제정법 출처는 uscode.house.gov로 통일했으며, govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다.

**테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, transfer architecture, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like 자산(Rule 506(c) 발행 + ICA §3(c)(7) 펀드 지분)을 ERC-3643 테스트 토큰으로 모델링하여, 체결 엔진 게이팅을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다.

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"이 거래가 이 자산에서, 이 매도인이, 법이 허용하는 방식(엔진)으로 체결되는가"*를 거래 직전에 판정한다. 같은 자산·같은 당사자·같은 수량이라도 **어떤 체결 기계를 타느냐**에 따라 적법과 위법이 갈린다 — affiliate의 매도가 RFQ로 market maker에게 가면 Rule 144가 명시적으로 허용하는 방식이고, 같은 매도가 AMM pool로 흘러가면 어느 법정 방식에도 해당하지 않는다. "무엇을 파는가"(자산 카드, B-01·B-03)와 "누가 사고 파는가"(A계열)만으로는 판정이 완결되지 않고, "**어떻게 파는가**"라는 세 번째 축이 남는 것이다. 이 축이 조문 어디에서 나오는지, 왜 존재하는지를 먼저 깐다.

### 1.1 재판매 규제 지형에서 "어떻게 파는가"의 자리

미국 연방 증권규제의 기본값은 1933년법 §5의 등록의무다 — 등록 없이는 팔지도, 청약하지도 못하며, 이 금지는 발행 한 번이 아니라 **거래 한 건 한 건**에 걸린다. Decipher에 올라오는 BUIDL-like 자산은 Rule 506(c)로 적법하게 발행됐지만, 그 매수인의 2차 재판매는 자기만의 면제가 따로 필요하다. 본 시스템이 쓰는 재판매 면제는 크게 두 갈래다.

| 재판매 갈래 | 근거 | 면제의 구조 | "어떻게 파는가"에 거는 요건 |
| --- | --- | --- | --- |
| Rule 144 safe harbor | 17 C.F.R. §230.144 (§4(a)(1) 연동) | 매도인이 underwriter가 아님을 의제 | **(f) Manner of sale** — 계열(affiliate) 매도는 ① brokers' transactions ② market maker 직접 거래 ③ riskless principal 세 방식 중 하나여야 한다. 비계열 매도에는 부적용 |
| §4(a)(7) 사적 재판매 | 15 U.S.C. §77d(a)(7)·(d) | 요건 충족 거래 자체를 면제 | **(d)(2) 무권유** — 매도인(과 그 대리인)은 어떤 형태의 general solicitation·general advertising으로도 청약·판매할 수 없다 |

두 갈래 모두 매도의 **방식**에 요건을 건다는 점이 B-04의 출발점이다. Rule 144 쪽 요건은 사람 축(계열 여부)에 조건부고, §4(a)(7) 쪽 요건은 경로 축(그 경로를 탔는가)에 조건부다. 그리고 두 요건 모두, DEX 위에서는 곧바로 **엔진의 속성**으로 번역된다 — 상대방을 특정해 견적을 받는 RFQ인가, 전체 멤버십에 주문을 게시하는 오더북인가, 불특정 상대(pool)에 상시 노출되는 AMM인가.

**쉽게 말하면:** 오프라인 세계에서 이 요건들은 "브로커 창구로 팔아라 / 마켓메이커에게 직접 팔아라 / 광고하며 팔지 마라"라는 절차 규범이었다. DEX에서는 브로커 창구도 광고 매체도 없는 대신 체결 엔진이 그 자리를 차지한다. 그래서 매도 방식 요건은 코드 세계에서 "**이 자산·이 거래에 어떤 엔진이 허용되는가**"라는 집합 판정으로 원자화되고, 그 판정기가 B-04다.

### 1.2 왜 이 규제가 존재하는가 — underwriter 사슬 책임과 분매(distribution) 통제

매도 방식 요건은 진공에서 나온 절차 취향이 아니다. 1933년법의 뼈대인 **§2(a)(11) underwriter 정의**에서 연역된다. 등록 없는 공개 분매를 막으려는 의회의 설계는 "발행인 → 중간자 → 대중"으로 흐르는 사슬의 **모든 고리**를 underwriter로 포섭하는 것이었고, 개인 투자자라도 그 사슬의 고리로 행동하면 underwriter가 된다. 문제는 취득 시점의 "분매 의도"라는 심리 상태를 외부에서 판별할 수 없다는 것 — 그래서 SEC는 1972년 Rule 144를 채택해 객관적 기준(보유기간·물량·공시·방식·신고)을 충족한 매도를 underwriter 비해당으로 의제하는 safe harbor를 만들었다.

그중 매도 방식 요건(f)·(g)의 논리는 이렇다: **계열의 매도는 구조상 발행인의 분매와 가장 닮았으므로, 분매가 아니라는 외형을 방식 자체로 담보하라.** 구체적으로 ① 매도인이 스스로 매수 주문을 끌어모으지 못하게 하고(무권유), ② 거래를 시장 전문 중개자 — 매수자를 "찾아 나서지 않는" broker, 또는 상시 호가로 이미 시장에 서 있는 market maker — 의 손을 거치게 한다. SEC는 2007년 개정 채택문(Release 33-8869)에서 이 구조의 존재 이유를 직접 말한다 — 브로커는 "as financial intermediaries, brokers serve an important function as gatekeepers for promoting compliance with Rule 144"이며, 지분증권에서 이 요건을 없애면 "would lead to abuse"라고.

이 요건의 연혁이 곧 B-04의 세 갈래 지도다. 1972년 원형은 brokers' transactions 한 방식이었고, **1978년 개정(Release 33-5979)이 market maker 직접 거래 갈래를 신설**했으며, **2007년 개정(Release 33-8869)이 riskless principal 갈래를 추가**하고 broker의 ATS 호가 게시를 무권유의 예외로 편입했다((g)(3)(iv)). 같은 2007년 개정은 **비계열 매도에서 방식 요건을 전면 폐지**했다 — "most abuses in sales of unregistered securities involve affiliates of issuers"라는 판단에서다. 요컨대 매도 방식 규제는 시대의 체결 인프라(브로커 창구 → 마켓메이커 → ATS)를 따라 갱신되어 온, "계열 분매 차단"이라는 단일 목적의 장치다.

§4(a)(7) 쪽 무권유 요건은 계보가 다르다. 2015년 FAST Act가 신설한 이 재판매 면제는 이른바 "§4(a)(1½)" 관행을 성문화한 것으로, 매수인 전원 AI + 매도인 측 무권유 + 정보 제공을 조건으로 사적 재판매를 열어 준다. 여기서 무권유는 브로커 경유를 요구하지 않는 대신 **판매의 사적 성격 자체**를 지키는 장치다 — 발행 국면의 Rule 502(c)와 같은 문법("any form of general solicitation or general advertising")을 쓴다. 발행 쪽에서는 2012년 JOBS Act가 Rule 506(c)로 일반청약을 열어 주었지만(§77d(b)), **재판매 쪽 §4(a)(7)은 그 완화를 물려받지 않았다** — 발행은 시끄럽게 해도 되지만 재판매는 조용해야 하는 비대칭이 조문 구조에 박혀 있다.

### 1.3 세 엔진의 법적 프로필 — RFQ · 오더북 · AMM

Decipher의 체결 계층은 세 엔진으로 구성된다(Manifest의 supportedEngines bitset이 이 셋을 원소로 갖는다). 각 엔진이 위 두 요건 지도에서 어디에 서는지를 먼저 정성적으로 잡아 둔다 — 조문 단위 정밀 판정은 §3, 판정식은 §5.

| 엔진 | 체결 구조 | Rule 144(f) 계열 매도방식 축 | §4(d)(2) 무권유 축 | 구조 특이점 |
| --- | --- | --- | --- | --- |
| RFQ (Request-for-Quote) | 매도인이 특정 상대(들)에게 견적 요청 → 양자 직접 결제(1-hop) | 상대방이 §3(a)(38) market maker면 (f)(1)(ii) "transactions directly with a market maker"에 문언 그대로 부합 | 특정·사전검증 상대에 대한 표적 요청 — 일반권유 아님(법률의견서 Q4 결론과 정합) | 상대방 자격(MM claim)이 판정 입력이 됨 |
| 오더북 (OB) | 주문을 멤버십 전체에 게시 → 매칭 엔진이 교차(1-hop) | (f)(1)(i) brokers' transactions는 등록 broker의 실행을 전제 — 현행 아키텍처에 broker가 없어 갈래 자체가 닫혀 있고, (g)(3)(iv)의 ATS 호가 안전항도 주체가 broker다. 매도인 본인의 게시는 (f)(2)(i) 무권유와 긴장 | 폐쇄 멤버십(전원 사전검증 AI) 내부 게시의 성격 미확정 — 보수 기본값은 §4(a)(7) 경로에서 배제 | 계열 매도 보수 차단의 중심 사례 |
| AMM (pool) | 매도인 → pool → 매수인의 2-hop; pool이 상대방 | pool은 사람도 dealer도 아니므로 §3(a)(38) market maker 전제 자체가 성립 불가 — 세 방식 어디에도 해당 없음 | pool의 상시 양방향 노출은 표적 요청의 반대극 | 매수인 식별 문제(§3(c)(7) 자산에서 취득자가 누구인가) — 자산 레벨 선언 단계에서 걸러짐 |

세 프로필의 요점은 이것이다 — **엔진 선택은 UX 취향이 아니라 법률 요건의 기계 번역**이며, 같은 자산 안에서도 거래 유형(계열 여부·경로)에 따라 허용 집합이 달라진다. 그래서 B-04는 두 층으로 설계된다: 자산 레벨의 선언(이 자산이 시스템에서 열어 둔 엔진 집합)과 거래 레벨의 overlay(이 거래의 사실관계가 그 집합을 추가로 좁히는가).

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk

이제 우리 시스템으로 내려오자. "김 부장 시나리오"가 이 부품의 존재 이유를 압축한다 — BlackRock 임원(= affiliate)인 김 부장이 BUIDL-like $100K를 매도한다. 이 한 건에 발행 유지(R1)·재판매(R2)·펀드(R3)·행위(R4)의 Recipe들이 누적 활성화되고, 그 R2 축 안에서 **엔진 적합성 검증**이 돈다: affiliate 매도이므로 AMM은 차단되고, RFQ는 Rule 144가 허용하는 "market maker 직접 매도"와 정확히 부합한다. 엔진 선택 자체가 법적 판단인 것이다.

이 판정이 실패하면 어디에 닿는가. Rule 144는 "all of the conditions"의 누적 충족을 요구한다((b)(2)) — 계열 매도가 (f) 밖의 방식으로 체결되면 그 거래는 safe harbor를 잃고, 매도인은 §2(a)(11) underwriter 취급의 사정권으로, 거래는 §5의 사정권으로 들어간다. §5는 고의·과실을 묻지 않는 무과실 조항이고, 면제의 입증책임은 면제를 주장하는 쪽에 있다. §4(a)(7) 경로도 마찬가지다 — 무권유 요건이 깨지면 그 거래의 면제가 통째로 깨진다.

엔진 오선택 → 방식 요건 위반 → 해당 재판매의 면제 상실
→ 그 매도 거래가 §5 미등록 판매 사정권 진입 (무과실)
→ 매도인 rescission 노출 · 사슬 오염(하류 재판매의 지위 불안)
→ venue가 위반 거래를 반복 체결한 기록 = 감독 대응·BD/ATS 성격규명 국면에서의 최악의 사실관계

마지막 줄이 B-04를 "있으면 좋은" 필터가 아니라 존립(existential) 안전장치로 만든다. Decipher의 venue 층 성격규명(BD/ATS)은 현재 SEC rulemaking이 진행 중인 미해결 영역인데, 그 국면에서 "이 플랫폼은 계열 분매·권유성 재판매를 엔진 차원에서 구조적으로 차단해 왔다"는 기록과 "차단 장치 없이 반복 체결해 왔다"는 기록은 방어 논거의 무게가 다르다. 또한 R1이 매 거래에 부착되어 발행 framework 유지를 확인하는 구조상, 엔진 게이트는 발행 자산의 유통 전 구간에서 "조용한 사적 유통"이라는 전제를 지키는 상설 장치다.

**쉽게 말하면:** B-04가 실수로 계열 매도를 AMM에 태우면, 잘못되는 것은 그 거래 하나가 아니다. 그 매도인의 면제, 그 물량을 받은 하류의 지위, 그리고 venue의 규제 방어 서사가 함께 흔들린다. 그래서 이 부품의 설계 철학은 시종 "보수적으로 — 법적 부합이 확정된 엔진만 열고, 미확정 조합은 막은 채 변호사 확인으로 연다"이다.

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"엔진 선택 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | 엔진 선택 (Engine Selection) | 이 거래가 허용된 체결 방식으로 도는지 확인 |
| 검사 대상 | ① 자산 카드의 supportedEngines 선언(비영·유효집합 소속·구조 전제) ② 거래의 엔진 식별 ③ 선언 집합 소속 ④ 경로 overlay(§4(a)(7) ⇒ 무권유 부합 엔진) ⑤ 계열 overlay(affiliate ⇒ 144(f) 부합 엔진 + 상대방 MM claim) | "이 자산에서, 이 거래가, 이 엔진을 타도 되나" |
| Internal ID | B-04 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 기계 판정 (Pattern A) — 집합 소속·함의 검사. 상대방 MM 자격의 실질 판단만 off-chain claim으로 국소 위임 | 게이트는 결정론, 자격 판단은 검증기관 |
| Timing | pre-trade (거래 체결 직전) + 상장 시점 카드 검사 | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | STATELESS (Element 한정) | 게이트는 카드 상수·거래 컨텍스트·flag의 현재 스냅샷만 읽는다. 선언·상수의 갱신은 정정 버전·거버넌스 경로(거래 외)로만 일어난다 |
| 주 활성화 Recipe | R1 (Reg D 506(c) Issuance) · R2 (§4(a)(7)·Rule 144 Resale) — 필수 attach | 발행·재판매 거래마다 명시 검사 |
| Cumulative Recipe | R3·R4는 매트릭스상 비부착 — 펀드 자산의 거래도 R1·R2 경유로 B-04에 도달(중복 부착 불요, §8.4) | 자산 메타 계열의 공통 부착 원칙 |
| Cascade Element | A-06(affiliate flag 공급) · C-00(재판매 경로 공급) · A-11(MM claim 만료) · C-09(매도방식 실체 — forward) · B-02(엔진별 프로브 위상) | 엔진 판정에 얹히거나 이어지는 검사들 |
| 성숙도 | 완료 (본 문서로 Spec 확정 — "확인만" 단계의 기존 정리를 조문 대조로 승격) | R1·R2 공통, 데모 필수 |
| 파일·위치 | B-04_engine-selection.md · 산출물/elements/ | 산출물 경로 |

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석)은 채택 release·staff statement가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1~§3.16 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 세 Layer의 조문·규칙이 B-04 판정에서 어떻게 연결되는지를 하나의 큰 흐름으로 정리한 것이다 — §5 등록의무 기본값에서 출발해, 발행 국면(506(c) 일반청약 허용)과 재판매 국면(Rule 144 / §4(a)(7) 두 갈래)으로 갈라지고, 각 갈래가 매도 방식에 거는 요건 — 계열이면 (f)(1)의 3방식, §4(a)(7)이면 (d)(2)의 무권유 — 이 세 엔진(RFQ·오더북·AMM)에 어떻게 대응되는지를 보여준다. 각 조항의 상세는 §3.1~§3.14.

![](B-04_fig30.png)

*그림 3.0 — 법조문 관계 흐름: §5 기본값 → 재판매 두 갈래의 방식 요건 → 엔진 매핑 (개발자용)*

**범례.**

- 파랑 = 핵심(Direct: 144(b)(2)·(f)(1) 3방식, §3(a)(38) market maker, §4(d)(2) 무권유, 144(g))

- 회색 = 판정·분기 노드

- 초록 = PASS·부합 경로(비계열의 방식 자유, RFQ-to-MM, 폐쇄 RFQ의 무권유 부합, 506(c) 발행측 카브아웃)

- 빨강 = FAIL(계열 AMM, pool의 §3(a)(38) 전제 탈락, 미선언 엔진)

- 주황 = 조건부·참고·미확정(오더북의 (g)(3)(iv) 조건부 편입, 폐쇄 멤버십 게시의 §4(d)(2) 성격, §77d(c) 플랫폼 조항, Reg ATS·CUI 성명)

### 3.0.1 실제 BUIDL에 어떻게 적용되나

§3.0이 일반 조문 흐름이라면, 이 절은 BUIDL-like 테스트 토큰에 B-04가 어떻게 걸리는지를 보여준다. **(재확인) 본 서술은 실제 BlackRock BUIDL의 발행 표준·transfer architecture·현재 운영 조건을 단정하지 않는다.**

**현실 선례 — RFQ가 왜 기본 엔진인가.** 현실의 BUIDL 2차 유통은 whitelist된 참여자 간 P2P 및 Securitize 계열이 관여하는 RFQ형 메커니즘으로 공개돼 있다 — 익명 불특정 다수에 대한 상시 자동 체결(AMM)이 아니라, 검증된 상대방과의 견적 기반 직접 거래다. 이 선택은 우연이 아니다: §3(c)(7) 펀드 지분의 "조용한 사적 유통" 요구(무권유·매수인 전원 자격 확인)와 계열 매도의 방식 요건이, 상대방을 특정하고 자격을 확인한 뒤 체결하는 RFQ 구조와 정확히 맞물리기 때문이다.

**Decipher 모델의 카드 기재.** 본 프로젝트의 BUIDL-like 카드는 supportedEngines = {RFQ, OB}로 선언한다(AMM 미선언). 미선언의 이유는 두 겹이다 — ① 취득자 식별: §3(c)(7) 자산은 모든 취득자가 취득 시점에 QP여야 하는데, pool 매도에서 "취득자"가 누구인지(pool 자체인지, LP 집합인지)의 법적 정리가 미확정이다. ② 계열·경로 overlay와의 상호작용 이전에, 자산 성격 자체가 상시 양방향 노출 구조와 긴장한다. 오더북은 선언에는 포함하되, 계열 매도(§3.4)와 §4(a)(7) 경로(§3.8)에서는 거래 레벨 overlay가 보수적으로 차단한다 — "선언된 엔진"과 "이 거래에 허용된 엔진"은 다른 물음이다.

**김 부장 시나리오의 좌표.** 임원(affiliate)의 $100K 매도가 RFQ로 기관 market maker에게 가면: 선언 집합 소속(RFQ ∈ {RFQ, OB}) 통과 + 계열 overlay(RFQ ∈ AFFILIATE_ENGINE_SET) 통과 + 상대방 MM claim 확인 통과 → B-04 PASS. 같은 매도가 오더북 게시로 가면 계열 overlay에서 차단, AMM으로 가면 선언 소속에서 이미 차단된다. 매도방식의 실체 충족(브로커 개입·수수료 성격 등 §3.4의 남는 축)은 C-09가 이어받는다.

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 B-04에 어떻게 닿는지를, **표 2**(순서·중요성)는 아래 §3.1~§3.16 소단원의 읽는 순서(논리 흐름)와 중요성(B-04가 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이다. 제정법 출처는 uscode.house.gov로 통일했다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | B-04 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Securities Act §5 · 15 U.S.C. §77e(a)·(c) | 등록의무 기본값(무과실) | 방식 요건 위반이 도착하는 종착점 — fail-closed 설계 근거 | Background | uscode.house.gov |
| Statute | Securities Act §2(a)(11) · 15 U.S.C. §77b(a)(11) | underwriter 정의(사슬 책임, issuer에 affiliate 포함) | 방식 요건의 존재 이유 — 계열 분매 차단 | Supporting | uscode.house.gov (Rule 144 Prelim. Note 경유 인용) |
| SEC Rule | Rule 144(b)(1)·(b)(2) · 17 C.F.R. §230.144(b) | 비계열/계열 트랙 — (f)의 인적 적용범위 | overlay 활성 조건(계열이면 "all of the conditions") | Direct | ecfr.gov |
| SEC Rule | Rule 144(f) · §230.144(f) | 매도방식 3갈래 + 매도인 금지행위 + 적용 제외 | 계열 overlay의 판정 본체 | Direct | ecfr.gov |
| Statute | Securities Act §4(a)(4) · 15 U.S.C. §77d(a)(4) | brokers' transactions 면제 | (f)(1)(i) 갈래의 제정법 고리 — broker 부재 시 갈래 폐쇄 | Direct | uscode.house.gov |
| Statute | Exchange Act §3(a)(38)·(a)(5) · 15 U.S.C. §78c(a)(38)·(a)(5) | market maker·dealer 정의 | (f)(1)(ii) 갈래의 상대방 요건 → MM claim; AMM pool 배제 논거 | Direct | uscode.house.gov |
| SEC Rule | Rule 144(g) · §230.144(g) | brokers' transactions의 요건화(무권유 + 호가 게시 예외 + reasonable inquiry) | (f)(1)(i) 갈래의 내용; (g)(3)(iv)가 오더북 편입의 유일 통로 | Direct(조건부) | ecfr.gov |
| Statute | Securities Act §4(a)(7)·§4(d)·§4(e) · 15 U.S.C. §77d(a)(7)·(d)·(e) | 사적 재판매 면제 — AI 요건·무권유·정보요건·restricted 의제 | 경로 overlay의 판정 본체((d)(2)) | Direct | uscode.house.gov |
| SEC Rule | Rule 502(c) · §230.502(c) | general solicitation의 예시적 정의 | (d)(2) 무권유 요건의 내용을 채우는 기준 | Supporting | ecfr.gov |
| SEC Rule | Rule 506(c) · §230.506(c) + Statute §77d(b) | 발행 국면 일반청약 허용 | R1 국면에서 엔진의 권유 성격이 발행면제를 깨지 않는 이유 | Supporting | ecfr.gov · uscode.house.gov |
| Statute | Securities Act §4(c) · 15 U.S.C. §77d(c) | 506 증권 플랫폼의 BD 비등록 조건(무보수 등) | venue 층 경계의 제정법 좌표 — 수수료 venue 비적용 | Background | uscode.house.gov |
| SEC Rule | Reg ATS Rule 300(a)·(e) · 17 C.F.R. §242.300 | ATS·Order 정의 | (g)(3)(iv)의 참조어; "주문 게시"의 규제 문법 | Supporting | ecfr.gov |
| SEC Release | Release No. 33-8869 (2007-12-06) · 72 FR 71546 | 2007 개정 채택문 — gatekeeper 논거·riskless principal·ATS 호가·비계열 폐지 | (f)·(g) 현행 구조의 취지·주체 확정(호가 게시의 주어 = broker) | Supporting | sec.gov |
| SEC Staff | Staff Statement, File No. 4-894 (2026-04-13) | 비수탁 인터페이스의 §15 비등록 견해 — 체결·결제 venue 배제 | venue 층 경계(B-04 밖) — 엔진 층과 venue 층의 분리 근거 | Background | sec.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | B-04가 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | Securities Act §5 — 등록의무 기본값 | 배경 | 안 함 — fail-closed 설계의 종착점 |
| §3.2 | §2(a)(11) — underwriter 사슬 책임 | 보조 | 안 함 — 방식 요건의 존재 이유 |
| §3.3 | Rule 144(b)(1)·(b)(2) — 인적 적용범위 | 핵심 | 계열 overlay의 활성 조건 판독 |
| §3.4 | Rule 144(f) — 매도방식 3갈래 | 핵심 | 계열 매도의 허용 엔진 집합 도출 |
| §3.5 | §4(a)(4) — brokers' transactions 면제 | 핵심(조건부) | (f)(1)(i) 갈래의 개폐 판독(broker 부재 = 폐쇄) |
| §3.6 | §3(a)(38)·(a)(5) — market maker·dealer | 핵심 | RFQ 상대방 요건(MM claim)·AMM pool 배제 |
| §3.7 | Rule 144(g) — 무권유·호가 게시·조사 | 핵심(조건부) | 오더북 편입 조건의 문언 고정((g)(3)(iv)) |
| §3.8 | §4(a)(7)·(d)·(e) — 사적 재판매 | 핵심 | 경로 overlay(무권유 부합 엔진 집합) |
| §3.9 | Rule 502(c) — 일반권유 정의 | 보조 | 무권유 요건의 내용 기준 |
| §3.10 | Rule 506(c) + §77d(b) — 발행측 허용 | 보조 | R1 국면의 비제약 확인 |
| §3.11 | §77d(c) — 506 플랫폼 조항 | 배경 | 안 함 — venue 경계 좌표 |
| §3.12 | Reg ATS Rule 300(a)·(e) | 보조 | (g)(3)(iv) 참조어·주문 문법 |
| §3.13 | Release 33-8869 (Layer 3) | 보조 | 안 함 — 취지·주체 해석 |
| §3.14 | Staff Statement 2026-04-13 (Layer 3) | 배경 | 안 함 — venue 층 분리 |
| §3.15 | Sub-요건 분해 매트릭스 | — | 위 요건을 원자적 검증 단위로 분해 |
| §3.16 | ERC-3643 변환·엔진 선언 필드 총정리 | — | §3.1~§3.14의 필드 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래 조문·쟁점은 같은 거래에 작동하지만 B-04가 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리이며, B-04 안에 끌어다 구현하지 않는다.

- **affiliate 판정 자체** (Rule 144(a)(1)·Rule 405 control) — A-06 소관. B-04는 A-06의 산출 flag만 소비한다.

- **재판매 경로의 성립** (Rule 144 조건 충족·§4(a)(7) 요건 전반) — C-00 소관. B-04는 C-00이 확정한 경로 태그만 소비한다.

- **매도방식의 실체 충족** ((f)(2) 금지행위의 사실 판단, (g)(1)·(2)·(4)의 broker 행위·수수료·reasonable inquiry, riskless principal의 SRO 보고 요건) — C-09 소관(forward-reference). B-04는 엔진 층위의 집합 판정까지만 한다.

- **물량 한도·Form 144** (144(e)·(h)) — C-08·E-06 소관. 단 (e)(1)(ii)·(h)(3)의 문언이 방식(broker 주문·MM 직접 체결)을 시점 앵커로 쓰므로 §9에서 접점을 고정한다.

- **venue의 BD/ATS 지위** (Exchange Act §3(a)(1)·(a)(4)·Rule 3b-16·Reg ATS 등록) — Operator·법률의견서(BD-ATS reliance memo Q1) 소관. B-04는 엔진 층과 venue 층을 분리하고, 그 경계의 좌표만 §3.11·§3.14에 둔다.

### 3.1 Securities Act §5 — 등록의무 기본값 (무과실) [uscode.house.gov]

- **조항**: Securities Act of 1933 §5(a)·(c), 15 U.S.C. §77e(a)·(c) — uscode.house.gov

- **핵심 원문**: (a) Unless a registration statement is in effect as to a security, it shall be unlawful for any person, directly or indirectly— (1) to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to sell such security through the use or medium of any prospectus or otherwise; or (2) to carry or cause to be carried through the mails or in interstate commerce, by any means or instruments of transportation, any such security for the purpose of sale or for delivery after sale. [...] (c) It shall be unlawful for any person, directly or indirectly, to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to offer to sell or offer to buy through the use or medium of any prospectus or otherwise any security, unless a registration statement has been filed as to such security, or while the registration statement is the subject of a refusal order or stop order or (prior to the effective date of the registration statement) any public proceeding or examination under section 77h of this title.

- **한국어**: (a) 어느 증권에 관하여 등록신고서가 효력을 갖고 있지 아니하는 한, 누구든지 직접 또는 간접으로 — (1) 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권을 판매하는 것; 또는 (2) 판매 목적으로 또는 판매 후 인도를 위하여 그 증권을 우편 또는 주간통상으로 운반하거나 운반하게 하는 것은 위법이다. [...] (c) 어느 증권에 관하여 등록신고서가 제출되어 있지 아니하는 한(또는 그 등록신고서가 거부명령·정지명령의 대상이거나 효력 발생 전의 공개 절차·심사 대상인 동안), 누구든지 직접 또는 간접으로 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권의 매도 청약 또는 매수 청약을 하는 것은 위법이다.

- **쉬운 설명**: 모든 방식 요건의 무게는 이 조문에서 나온다. §5는 발행 한 번이 아니라 거래 한 건 한 건에 걸리고, 고의·과실을 묻지 않는다. 계열 매도가 (f) 밖의 방식으로, 또는 §4(a)(7) 매도가 권유를 수반해 체결되면, 그 재판매의 면제가 무너지고 거래는 이 조문의 사정권으로 들어간다 — 면제의 입증책임은 면제를 주장하는 쪽에 있다. B-04에게 이 조문은 이렇게 읽힌다: **엔진 판정의 실패가 도착하는 곳이 바로 여기이며, 확인 불가면 차단(fail-closed)이 유일한 안전 방향이다.**

- **PASS/FAIL 반영**: 간접 ✕ — B-04가 §5를 판정하지 않는다. 방식 요건 위반의 법적 종착점으로서 fail-closed 설계 원칙의 근거가 된다.

- **ERC-3643 변환**: 직접 매핑 없음. Router의 cumulative AND(하나라도 FAIL이면 revert)와 엔진 게이트의 pre-trade 배치가 이 조문의 "기본값 = 금지" 구조를 코드에 옮긴 것이다.

### 3.2 Securities Act §2(a)(11) — underwriter 사슬 책임: 방식 요건의 존재 이유 [uscode.house.gov · ecfr.gov]

- **조항**: Securities Act §2(a)(11), 15 U.S.C. §77b(a)(11) — uscode.house.gov. 본 블록의 원문 인용은 Rule 144 Preliminary Note(17 C.F.R. §230.144, ecfr.gov)의 조문 전재와 Release 33-8869 n.10의 후단 전재를 사용한다(두 인용 모두 1차 출처의 자체 전재).

- **핵심 원문**: The term "underwriter" is broadly defined in Section 2(a)(11) of the Securities Act to mean any person who has purchased from an issuer with a view to, or offers or sells for an issuer in connection with, the distribution of any security, or participates, or has a direct or indirect participation in any such undertaking, or participates or has a participation in the direct or indirect underwriting of any such undertaking. [Rule 144 Preliminary Note] / Section 2(a)(11) states that the term "issuer" shall include, in addition to an issuer, any person directly or indirectly controlling or controlled by the issuer, or any person under direct or indirect common control with the issuer. [Release 33-8869 n.10]

- **한국어**: "underwriter"란 이 법에서 넓게 정의되어 — 발행인으로부터 distribution을 목적으로(with a view to) 매수한 자, 발행인을 위하여 distribution과 관련하여 청약·판매하는 자, 또는 그러한 undertaking에 직접·간접으로 참여하거나 그 직접·간접 인수(underwriting)에 참여하는 모든 자를 뜻한다. / §2(a)(11)은 이 조항에서 "issuer"에 발행인 외에도 발행인을 직접·간접으로 지배하거나 발행인에 의하여 지배되거나 발행인과 공통 지배 하에 있는 모든 자가 포함된다고 규정한다.

- **쉬운 설명**: 방식 요건이 왜 계열에게만 걸리는지의 뿌리다. 후단 문장 때문에 계열(affiliate)의 매도는 구조상 "issuer의 판매"와 같은 취급 위험을 지고, 계열 물량을 받아 파는 자·계열을 위해 파는 자까지 underwriter 사슬에 포섭될 수 있다. Rule 144는 이 정의에서 빠져나오는 객관 기준을 제공하는 safe harbor이고, 그중 (f)·(g)는 "분매처럼 보이지 않는 방식"을 외형으로 담보하는 축이다 — 매도인이 매수자를 끌어모으지 않고, 시장 전문 중개자의 손을 거치게 한다. 엔진 게이트는 이 외형 담보를 코드로 옮긴 것이다.

- **PASS/FAIL 반영**: 간접 ✕ — B-04가 underwriter 여부를 판정하지 않는다. 계열 overlay(§3.4)의 목적 규범.

- **ERC-3643 변환**: 직접 매핑 없음. sellerIsAffiliate flag(A-06 산출)가 이 조문의 "issuer에 affiliate 포함" 구조를 거래 컨텍스트로 옮긴 값이다.

### 3.3 Rule 144(b)(1)·(b)(2) — 비계열/계열 트랙: (f)의 인적 적용범위 [ecfr.gov]

- **조항**: 17 C.F.R. §230.144(b)(1)·(b)(2) — ecfr.gov (Title 17, 2026-07-01 기준 현행)

- **핵심 원문**: (b) Conditions to be met. Subject to paragraph (i) of this section, the following conditions must be met: (1) Non-affiliates. (i) If the issuer of the securities is, and has been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Securities Exchange Act of 1934 (the Exchange Act), any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Securities Act if all of the conditions of paragraphs (c)(1) and (d) of this section are met. [...] (ii) If the issuer of the securities is not, or has not been for a period of at least 90 days immediately before the sale, subject to the reporting requirements of section 13 or 15(d) of the Exchange Act, any person who is not an affiliate of the issuer at the time of the sale, and has not been an affiliate during the preceding three months, who sells restricted securities of the issuer for his or her own account shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Securities Act if the condition of paragraph (d) of this section is met. (2) Affiliates or persons selling on behalf of affiliates. Any affiliate of the issuer, or any person who was an affiliate at any time during the 90 days immediately before the sale, who sells restricted securities, or any person who sells restricted or any other securities for the account of an affiliate of the issuer of such securities, or any person who sells restricted or any other securities for the account of a person who was an affiliate at any time during the 90 days immediately before the sale, shall be deemed not to be an underwriter of those securities within the meaning of section 2(a)(11) of the Securities Act if all of the conditions of this section are met.

- **한국어**: (b) 충족할 조건. 본 조 (i)항을 조건으로, 다음 조건이 충족되어야 한다: (1) 비계열자. (i) 발행인이 매도 직전 90일 이상 계속하여 Exchange Act §13/15(d) 보고 의무 대상인 경우 — 매도 시점에 발행인의 affiliate가 아니고 직전 3개월간 affiliate가 아니었던 자가 자기 계산으로 그 발행인의 restricted securities를 매도하는 때에는, (c)(1)[현행 공시]과 (d)[보유기간]의 조건이 모두 충족되면 §2(a)(11)의 underwriter가 아닌 것으로 본다. [...] (ii) 발행인이 그 보고 의무 대상이 아니거나 매도 직전 90일 이상 대상이 아니었던 경우 — 같은 비계열 요건의 매도인은 (d)의 조건만 충족되면 underwriter가 아닌 것으로 본다. (2) 계열자 또는 계열자를 위하여 매도하는 자. 발행인의 affiliate, 매도 직전 90일 중 어느 때라도 affiliate였던 자로서 restricted securities를 매도하는 자, 또는 그러한 자의 계정을 위하여 restricted 또는 그 밖의 증권을 매도하는 모든 자는, **본 section의 모든 조건이 충족되는 경우** §2(a)(11)의 underwriter가 아닌 것으로 본다.

- **쉬운 설명**: (f)가 누구에게 걸리는지를 정하는 스위치 조문이다. 비계열 트랙(1)의 조건 목록에는 (f)가 **없다** — 비보고 발행자 자산이면 (d) 하나뿐이다(2007년 개정이 비계열 방식 요건을 폐지한 결과, §3.13). 계열 트랙(2)은 "all of the conditions of this section" — (c)·(d)·(e)·(f)·(h) 전부다. 그래서 B-04의 계열 overlay는 A-06의 flag 하나로 켜지고 꺼진다. 유의점 둘. ① (2)의 인적 범위가 넓다 — 현재 계열뿐 아니라 **직전 90일 내 계열이었던 자**, 그리고 그들의 계정을 위해 파는 자까지다. A-06가 이 tail을 flag에 반영하므로 B-04는 flag만 읽으면 되지만, "지금은 사임했으니 자유 매도"라는 구현이 tail을 놓치는 대표 오류임을 회귀로 고정한다(§7 T8). ② (1)·(2)의 구분 기준일 단위가 다르다 — 비계열 자격은 "preceding three months"(직전 3역월), 계열 tail은 "90 days"(직전 90일). 두 창의 판정은 A-06 소관이고, B-04는 그 결과 flag의 소비자다.

- **PASS/FAIL 반영**: 직접 ○ (활성 조건) — sellerIsAffiliate = true ⇒ 계열 overlay(G⑤) 활성. false ⇒ (f) 축 비적용(G⑤ 스킵). 판정식 자체는 §3.4가 채운다.

- **ERC-3643 변환**: 입력: txContext.sellerIsAffiliate (A-06 산출, 90일 tail 포함) · txContext.sellsForAffiliateAccount (대리 매도 케이스, A-06/운영 등록). overlay 활성식: affiliateOverlayActive = sellerIsAffiliate ∨ sellsForAffiliateAccount.

### 3.4 Rule 144(f) — 매도방식 3갈래 + 매도인 금지행위 + 적용 제외 [ecfr.gov]

- **조항**: 17 C.F.R. §230.144(f)(1)~(3) — ecfr.gov (Title 17, 2026-07-01 기준 현행)

- **핵심 원문**: (f) Manner of sale. (1) The securities shall be sold in one of the following manners: (i) Brokers' transactions within the meaning of section 4(4) of the Act; (ii) Transactions directly with a market maker, as that term is defined in section 3(a)(38) of the Exchange Act; or (iii) Riskless principal transactions where: (A) The offsetting trades must be executed at the same price (exclusive of an explicitly disclosed markup or markdown, commission equivalent or other fee); (B) The transaction is permitted to be reported as riskless under the rules of a self-regulatory organization; and (C) The requirements of paragraphs (g)(2)(applicable to any markup or markdown, commission equivalent or other fee), (g)(3), and (g)(4) of this section are met. Note to § 230.144(f)(1): A riskless principal transaction means a principal transaction where, after having received from a customer an order to buy, a broker or dealer purchases the security as principal in the market to satisfy the order to buy or, after having received from a customer an order to sell, sells the security as principal to the market to satisfy the order to sell. (2) The person selling the securities shall not: (i) Solicit or arrange for the solicitation of orders to buy the securities in anticipation of or in connection with the transaction; or (ii) Make any payment in connection with the offering or sale of the securities to any person other than the broker or dealer who executes the order to sell the securities. (3) Paragraph (f) of this section shall not apply to: (i) Securities sold for the account of the estate of a deceased person or for the account of a beneficiary of such estate provided the estate or estate beneficiary is not an affiliate of the issuer; or (ii) Debt securities.

- **한국어**: (f) 매도방식. (1) 증권은 다음 방식 중 하나로 판매되어야 한다: (i) 이 법 section 4(4)의 의미에서의 brokers' transactions; (ii) Exchange Act §3(a)(38)에 정의된 market maker와의 직접 거래; 또는 (iii) 다음 요건의 riskless principal transactions — (A) 상쇄 거래들이 동일 가격으로 체결될 것(명시적으로 공시된 markup·markdown·commission equivalent 그 밖의 fee 제외); (B) 그 거래가 자율규제기구(SRO)의 규칙상 riskless로 보고될 수 있을 것; (C) (g)(2)(markup 등에 적용)·(g)(3)·(g)(4)의 요건이 충족될 것. [(f)(1)에 대한 주: riskless principal transaction이란 broker 또는 dealer가 고객으로부터 매수 주문을 받은 후 그 주문을 충족하기 위하여 시장에서 자기계산으로 그 증권을 매수하거나, 고객으로부터 매도 주문을 받은 후 그 주문을 충족하기 위하여 시장에 자기계산으로 그 증권을 매도하는 principal 거래를 말한다.] (2) 증권을 매도하는 자는 다음을 하여서는 아니 된다: (i) 그 거래를 예상하여 또는 그 거래와 관련하여 그 증권의 매수 주문을 권유하거나 권유를 주선하는 것; (ii) 그 증권의 청약·판매와 관련하여 매도 주문을 실행하는 broker 또는 dealer 외의 자에게 어떠한 지급을 하는 것. (3) 본 (f)항은 다음에는 적용되지 아니한다: (i) 비-affiliate인 사망자 유산 또는 그 수익자의 계정으로 판매되는 증권; (ii) 채무증권.

- **쉬운 설명**: 계열 overlay의 판정 본체다. 세 갈래를 Decipher 아키텍처에 대입하면 개폐가 갈린다. **(i) brokers' transactions** — 정의상 "broker에 의한(by a broker)" 거래이므로(§3.7), 등록 broker-dealer가 실행 주체로 통합되기 전에는 갈래 자체가 닫혀 있다. **(ii) market maker 직접 거래** — 유일하게 현행 아키텍처에서 열리는 갈래다. RFQ의 상대방이 §3(a)(38) market maker이기만 하면 문언 그대로 부합하며, 중간 broker를 요구하지 않는다(1978년 개정이 broker 경유의 대안으로 신설한 갈래 — §3.13). **(iii) riskless principal** — (B)의 SRO 보고 가능성 요건이 등록 BD·SRO 회원 체계를 전제하므로 역시 닫혀 있다. 결론: 현 단계 계열 허용 엔진 집합은 {RFQ}이며, 그 RFQ도 **상대방이 market maker인 경우**로 한정된다 — 이것이 G⑤의 두 원자(엔진 소속 + 상대방 MM claim)다. (2)는 매도인 본인의 행위 규범이다: (i) 매수 주문 권유 금지 — market maker에게 견적을 청하는 것은 (ii) 갈래가 예정한 방식 그 자체이지 금지되는 권유가 아니지만, MM 아닌 멤버십 일반에 요청을 뿌리는 것은 권유와의 경계에 선다. 그래서 계열 RFQ의 **요청 수신 대상 자체를 MM claim 보유자로 한정**하는 것이 엔진 설정의 보수 규범이다(§5.4·§11). (2)(ii) 지급 금지는 플랫폼 수수료의 성격 문제를 낳는다 — venue가 "the broker or dealer who executes the order"인가라는 물음으로, C-09·변호사 확인 대상이다(OD-B04-5). (3)의 두 예외(비계열 유산·채무증권)는 지분형 BUIDL-like 자산에는 해당 없음이 기본값이다 — 자산이 debt로 분류되면 (f) 축 전체가 꺼지므로, 그 분류는 카드 사실(B-01·B-03의 legalClassId)에서 온다.

- **PASS/FAIL 반영**: 직접 ○ (계열 overlay 본체) — affiliateOverlayActive ⇒ txEngine ∈ AFFILIATE_ENGINE_SET(현행 {RFQ}) ∧ 상대방 MARKET_MAKER claim 존재. (iii)·(i) 갈래는 거버넌스 상수 갱신으로만 열린다(BD 통합 시 — OD-B04-1).

- **ERC-3643 변환**: 거버넌스 상수: AFFILIATE_ENGINE_SET = {RFQ} (다중서명·time-lock 관리, §11); 판정: affiliateOverlayActive ⇒ (txEngine ∈ AFFILIATE_ENGINE_SET) ∧ hasValidClaim(buyer.ONCHAINID, topic = MARKET_MAKER_STATUS); (f)(2) 서약: 매도 주문 제출 시 noSolicitationAttestation·noSidePaymentAttestation 기록(게이트 아닌 기록 항목 — 실질은 C-09·F-02); (3)(ii) 예외: facts.securityType = DEBT ⇒ overlay 비활성(카드 사실 소비).

### 3.5 Securities Act §4(a)(4) — brokers' transactions 면제: (f)(1)(i)의 제정법 고리 [uscode.house.gov]

- **조항**: Securities Act §4(a)(4), 15 U.S.C. §77d(a)(4) — uscode.house.gov (2026-06-05 시행 법률 기준). Rule 144(f)(1)(i)·(g)의 "section 4(4)" 표기는 2012년 JOBS Act 재편 전 조문 번호로, 현행 §4(a)(4)를 가리킨다.

- **핵심 원문**: The provisions of section 77e of this title shall not apply to— [...] (4) brokers' transactions executed upon customers' orders on any exchange or in the over-the-counter market but not the solicitation of such orders;

- **한국어**: 이 법 §5[77e]의 규정은 다음에 적용되지 아니한다 — [...] (4) 거래소 또는 장외시장에서 고객의 주문에 따라 실행되는 brokers' transactions. 다만 그러한 주문의 권유(solicitation)에는 적용되지 아니한다[= 면제되지 아니한다];

- **쉬운 설명**: (f)(1)(i) 갈래가 딛는 제정법이다. 두 가지가 B-04에 직결된다. ① 이 면제는 **broker의 부분(part)만** 덮는다 — 고객(매도인)은 별도 면제(Rule 144 또는 §4(a)(7))가 필요하고, 그래서 (f)(1)(i)는 "broker가 §4(a)(4)로 면제되는 방식의 거래"라는 뜻이지 매도인 면제의 대체가 아니다. ② 문언 자체가 "but not the solicitation of such orders"로 권유를 면제 밖에 둔다 — 무권유가 이 방식의 정의적 속성이며, Rule 144(g)(3)이 그 속성을 요건화한 것이다. 현행 Decipher 아키텍처에는 주문을 "실행하는" 등록 broker가 없으므로 이 갈래는 구조적으로 닫혀 있고, 열리는 조건(등록 BD/ATS 통합)은 venue 층의 미해결 쟁점과 한 몸이다(§3.14·OD-B04-1).

- **PASS/FAIL 반영**: 조건부 — 현행 폐쇄. brokerIntegrated = true(거버넌스 사실)로 전환되고 (g) 요건 충족 체계가 갖춰진 뒤에야 AFFILIATE_ENGINE_SET에 해당 방식이 편입될 수 있다.

- **ERC-3643 변환**: 거버넌스 사실: platform.brokerIntegrated = false (현행); 편입 조건식(미래): brokerIntegrated ∧ (g)충족체계 ⇒ AFFILIATE_ENGINE_SET에 OB_BROKER 추가 가능(정정·time-lock 경로만).

### 3.6 Exchange Act §3(a)(38)·(a)(5) — market maker·dealer 정의: RFQ 상대방 요건과 AMM 배제 [uscode.house.gov]

- **조항**: Securities Exchange Act of 1934 §3(a)(38)·(a)(5), 15 U.S.C. §78c(a)(38)·(a)(5) — uscode.house.gov (2026-05-29 시행 법률 기준)

- **핵심 원문**: (38) The term "market maker" means any specialist permitted to act as a dealer, any dealer acting in the capacity of block positioner, and any dealer who, with respect to a security, holds himself out (by entering quotations in an inter-dealer communications system or otherwise) as being willing to buy and sell such security for his own account on a regular or continuous basis. / (5)(A) In general.—The term "dealer" means any person engaged in the business of buying and selling securities (not including security-based swaps, other than security-based swaps with or for persons that are not eligible contract participants) for such person's own account through a broker or otherwise. (B) Exception for person not engaged in the business of dealing.—The term "dealer" does not include a person that buys or sells securities (not including security-based swaps, other than security-based swaps with or for persons that are not eligible contract participants) for such person's own account, either individually or in a fiduciary capacity, but not as a part of a regular business.

- **한국어**: (38) "market maker"란 dealer로 행위하도록 허용된 specialist, block positioner의 자격으로 행위하는 dealer, 그리고 어느 증권에 관하여(with respect to a security) 자기계산으로 그 증권을 정기적 또는 계속적 기준으로(on a regular or continuous basis) 매수·매도할 의사가 있음을 (inter-dealer 통신 시스템에 호가를 입력하는 방법 그 밖의 방법으로) 표방하는(holds himself out) dealer를 뜻한다. / (5)(A) 일반. — "dealer"란 broker를 통하여 또는 그 밖의 방법으로 자기계산으로 증권을 매매하는 영업에 종사하는 모든 자를 뜻한다. (B) 딜링 영업에 종사하지 아니하는 자의 예외. — 개인적으로든 수탁자 자격으로든 자기계산으로 증권을 매매하되 정규 영업의 일부로서 하지 아니하는 자는 "dealer"에 포함되지 아니한다.

- **쉬운 설명**: (f)(1)(ii) 갈래의 상대방 요건을 채우는 정의이자, AMM 배제의 문언 논거다. 세 가지를 원자화한다. ① market maker는 **dealer의 부분집합**이다 — 세 유형 모두 "dealer"를 전제어로 쓴다. 따라서 상대방이 (ii) 갈래를 성립시키려면 먼저 dealer(정규 영업으로 자기계산 매매하는 자)여야 하고, 실무상 이는 등록 broker-dealer 확인으로 수렴한다. ② 표방(holds himself out)은 **증권 단위**다 — "with respect to a security". 어느 회사가 일반적으로 마켓메이킹업을 한다는 사실만으로 부족하고, **이 토큰에 관하여** 정기적·계속적 양방향 호가로 서 있어야 한다. 플랫폼의 RFQ·호가 로그가 이 규칙성의 증빙 원천이 될 수 있다(§10·§11, 정량 기준은 OD-B04-2). ③ AMM pool은 이 정의의 어느 문에도 들어오지 못한다 — pool은 스마트컨트랙트이지 "person engaged in the business"가 아니고, 등록 dealer는 더더욱 아니다. 상시 양방향 노출이라는 **행태**는 market maker와 닮았지만, 정의의 전제어(dealer)가 탈락하므로 (ii) 갈래는 성립 불가다. 오히려 그 닮음은 반대 방향의 질문 — pool·LP·운영자가 dealer 지위를 표방하는 것 아닌가 — 을 낳으며, 이는 venue 층 미해결 쟁점으로 격리한다(OD-B04-6).

- **PASS/FAIL 반영**: 직접 ○ (상대방 요건) — 계열 RFQ에서 buyer의 MARKET_MAKER_STATUS claim 존재를 검사(G⑤ 두 번째 원자). claim의 실질(등록 dealer + 이 토큰 호가 규칙성)은 off-chain 검증기관·C-09 소관.

- **ERC-3643 변환**: claim.topic = MARKET_MAKER_STATUS; claim.data = {bdRegistrationRef(CRD/SEC 등록 확인), securityScope = tokenId(증권 단위 표방), quotingEvidenceRef(플랫폼 호가 로그 기간 해시)}; 발급: Trusted Issuer(§10 L2); 만료·재검증: A-11 주기 규율에 편승.

### 3.7 Rule 144(g) — brokers' transactions의 요건화: 무권유 원칙과 호가 게시 안전항 [ecfr.gov]

- **조항**: 17 C.F.R. §230.144(g) — ecfr.gov (Title 17, 2026-07-01 기준 현행)

- **핵심 원문**: (g) Brokers' transactions. The term brokers' transactions in section 4(4) of the Act shall for the purposes of this section be deemed to include transactions by a broker in which such broker: (1) Does no more than execute the order or orders to sell the securities as agent for the person for whose account the securities are sold; (2) Receives no more than the usual and customary broker's commission; (3) Neither solicits nor arranges for the solicitation of customers' orders to buy the securities in anticipation of or in connection with the transaction; provided, that the foregoing shall not preclude (i) inquiries by the broker of other brokers or dealers who have indicated an interest in the securities within the preceding 60 days; (ii) inquiries by the broker of his customers who have indicated an unsolicited bona fide interest in the securities in writing within the preceding 10 business days; (iii) the publication by the broker of bid and ask quotations for the security in an inter-dealer quotation system provided that such quotations are incident to the maintenance of a bona fide inter-dealer market for the security for the broker's own account and that the broker has published bona fide bid and ask quotations for the security in an inter-dealer quotation system on each of at least twelve days within the preceding thirty calendar days with no more than four business days in succession without such two-way quotations; or (iv) the publication by the broker of bid and ask quotations for the security in an alternative trading system, as defined in § 242.300 of this chapter, provided that the broker has published bona fide bid and ask quotations for the security in the alternative trading system on each of the last twelve business days; and (4) After reasonable inquiry is not aware of circumstances indicating that the person for whose account the securities are sold is an underwriter with respect to the securities or that the transaction is a part of a distribution of securities of the issuer. [Notes (i)·(ii)의 조사 항목 (a)~(g) 생략 — C-09 소관]

- **한국어**: (g) Brokers' transactions. 이 법 section 4(4)의 brokers' transactions라는 용어는 본 section의 목적상 다음과 같은 broker에 의한 거래를 포함하는 것으로 본다: (1) 그 계정을 위하여 증권이 판매되는 자의 대리인으로서 매도 주문의 실행 이상을 하지 아니할 것; (2) 통상적·관례적 broker 수수료를 초과하여 받지 아니할 것; (3) 그 거래를 예상하여 또는 그 거래와 관련하여 고객의 매수 주문을 권유하거나 권유를 주선하지 아니할 것. 다만 다음은 이에 저촉되지 아니한다 — (i) 직전 60일 내에 그 증권에 관심을 표시한 다른 broker·dealer에 대한 broker의 문의; (ii) 직전 10영업일 내에 서면으로 자발적·선의의(unsolicited bona fide) 관심을 표시한 자기 고객에 대한 broker의 문의; (iii) inter-dealer quotation system에의 양방향 호가 게시 — 그 호가가 broker 자기계산의 선의의 inter-dealer 시장 유지에 부수하고, 직전 30역일 중 **적어도 12일 각각**(연속 4영업일을 초과하는 양방향 호가 공백 없이) 게시했을 것을 조건으로; 또는 (iv) §242.300에 정의된 alternative trading system에의 양방향 호가 게시 — broker가 그 ATS에 **직전 12영업일 각각** 선의의 양방향 호가를 게시했을 것을 조건으로; 그리고 (4) 합리적 조사(reasonable inquiry) 후에도, 그 계정을 위하여 증권이 판매되는 자가 그 증권의 underwriter라거나 그 거래가 발행인 증권의 distribution의 일부라는 사정을 알지 못할 것.

- **쉬운 설명**: (f)(1)(i) 갈래의 내용을 채우는 조문이자, **오더북이 계열 매도에 편입될 수 있는 유일한 문언 통로**다. 판독의 축은 주어다 — (1)~(4)의 행위 주체, 특히 (iii)·(iv)의 호가 게시 주체는 전부 **the broker**다. 2007년 채택문도 이 조항을 "broker가 ATS에 호가를 게시하는 것"으로 설명한다(§3.13). 따라서 ① 매도인 본인이 오더북에 주문을 게시하는 현행 구조는 (g)(3)(iv)의 사정 밖이고(주어 불일치), ② broker 자체가 없는 아키텍처에서는 (g) 전체의 전제가 성립하지 않는다. 오더북 편입의 문언 조건을 미리 고정해 두면: 등록 broker가 실행 주체로 서고 + 그 broker가 이 토큰에 대해 ATS에서 **직전 12영업일 각각** 양방향 호가를 게시했어야 한다((iv)) — (iii)의 "30역일 중 12일 이상 + 공백 ≤ 4영업일 연속"과 달리 (iv)는 **연속 12영업일 전부**를 요구하는 더 촘촘한 창이다(부등호·기간 규율: (iii) ≥ 12일/직전 30역일 ∧ 공백 연속 ≤ 4영업일, (iv) = 직전 12영업일 전일). (4)의 reasonable inquiry는 broker의 실질 조사 의무로서 C-09의 본체다 — "brokers rely on third-parties at their own peril"(World Trade Financial, 739 F.3d 1243)의 규율이 여기 얹힌다.

- **PASS/FAIL 반영**: 조건부 — 현행 아키텍처에서 (f)(1)(i) 갈래 폐쇄의 문언 근거(주어 = broker). 편입 시 (iv)의 12영업일 게시 조건은 플랫폼 호가 로그로 기계 판정 가능한 항목으로 예약해 둔다.

- **ERC-3643 변환**: 편입 조건 예약 필드(미래): obBrokerPath = {brokerId, atsQuoteLog: 직전 12영업일 양방향 호가 존재 비트맵, twoSidedOnEachDay: bool}; 현행: 미구현 — AFFILIATE_ENGINE_SET에 OB 부재로 표현. (g)(4) 조사·기록은 C-09 인터페이스로 forward.

### 3.8 Securities Act §4(a)(7)·§4(d)·§4(e) — 사적 재판매 면제: 경로 overlay의 판정 본체 [uscode.house.gov]

- **조항**: Securities Act §4(a)(7)·(d)·(e), 15 U.S.C. §77d(a)(7)·(d)·(e) — uscode.house.gov (2026-06-05 시행 법률 기준)

- **핵심 원문**: (a) The provisions of section 77e of this title shall not apply to— [...] (7) transactions meeting the requirements of subsection (d). [...] (d) Certain accredited investor transactions.—The transactions referred to in subsection (a)(7) are transactions meeting the following requirements: (1) Accredited investor requirement.—Each purchaser is an accredited investor, as that term is defined in section 230.501(a) of title 17, Code of Federal Regulations (or any successor regulation). (2) Prohibition on general solicitation or advertising.—Neither the seller, nor any person acting on the seller's behalf, offers or sells securities by any form of general solicitation or general advertising. [(3) 정보요건, (4) 발행인 요건, (5) bad actor 금지, (6)~(8) 기타 요건 — 각 소관 부품(C-00·A-03·E계열) 인용 생략] (e) Additional requirements.—(1) In general.—With respect to an exempted transaction described under subsection (a)(7): (A) Securities acquired in such transaction shall be deemed to have been acquired in a transaction not involving any public offering. (B) Such transaction shall be deemed not to be a distribution for purposes of section 77b(a)(11) of this title. (C) Securities involved in such transaction shall be deemed to be restricted securities within the meaning of Rule 144 (17 CFR 230.144). (2) Rule of construction.—The exemption provided by subsection (a)(7) shall not be the exclusive means for establishing an exemption from the registration requirements of section 77e of this title.

- **한국어**: (a) 이 법 §5[77e]의 규정은 다음에 적용되지 아니한다 — [...] (7) subsection (d)의 요건을 충족하는 거래. [...] (d) 일정한 적격투자자 거래. — (a)(7)에서 말하는 거래란 다음 요건을 충족하는 거래를 말한다: (1) 적격투자자 요건. — 각 매수인이 17 C.F.R. §230.501(a)에 정의된 accredited investor일 것. (2) **일반권유·광고 금지. — 매도인도, 매도인을 위하여 행위하는 어느 누구도, 어떤 형태의 general solicitation 또는 general advertising으로도 증권을 청약하거나 판매하지 아니할 것.** [...] (e) 추가 요건. — (1) 일반. — (a)(7)의 면제 거래에 관하여: (A) 그 거래에서 취득된 증권은 공모를 수반하지 아니하는 거래에서 취득된 것으로 본다. (B) 그 거래는 §2(a)(11)[77b(a)(11)]의 목적상 distribution이 아닌 것으로 본다. (C) 그 거래에 관계된 증권은 Rule 144의 의미에서 restricted securities로 본다. (2) 해석 규칙. — (a)(7)의 면제는 §5 등록의무 면제를 확립하는 배타적 수단이 아니다.

- **쉬운 설명**: 경로 overlay(G④)의 판정 본체다. (d)(2)의 문언 구조를 원자화하면 — 주체는 "매도인 + 매도인을 위해 행위하는 모든 자"(venue·프런트엔드가 매도인을 위해 행위하는 것으로 평가될 여지까지 포함해 보수적으로 읽는다), 금지 대상은 "어떤 형태의(any form of)" 일반권유·일반광고, 시제는 청약·판매 전 과정이다. 엔진에 대입하면: 특정 상대에 대한 표적 견적 요청(RFQ)은 "general"의 반대극이고, 폐쇄 멤버십 전체에 대한 주문 게시(오더북)는 수신자가 전원 사전검증 AI라는 점에서 공개 광고와 다르지만 "불특정 다수에 대한 일반적 노출"이라는 평가 가능성이 남는다 — 이 성격규명은 본 시스템의 선행 법률의견서가 "폐쇄 whitelist·RFQ 구조는 (d)(2)와 양립"으로 정리하며 RFQ까지만 확정한 지점이라, 오더북의 편입은 미확정 항목으로 남긴다(OD-B04-3). 그래서 경로 overlay의 보수 기본값은 NO_GS_ENGINE_SET = {RFQ}다. (e)(1)의 세 의제는 이 경로의 하류 지도다 — 특히 (C) 때문에 §4(a)(7)로 넘어간 물량도 매수인 손에서 restricted로 남는다(B-03의 flag 유지·C-01의 기간 재기산과 정합). 한 가지 대칭 유의: Rule 144 **비계열** 경로에는 무권유 요건이 없다 — (b)(1)의 조건 목록에 방식·권유 축이 아예 없으므로, 비계열 Rule 144 매도의 오더북 체결은 이 축에서 자유다(§7 T6의 쌍).

- **PASS/FAIL 반영**: 직접 ○ (경로 overlay 본체) — resalePath = SEC4A7 ⇒ txEngine ∈ NO_GS_ENGINE_SET(현행 {RFQ}). 경로 자체의 성립((d)(1)·(3)~(8))은 C-00·A-03 소관.

- **ERC-3643 변환**: 거버넌스 상수: NO_GS_ENGINE_SET = {RFQ}; 입력: txContext.resalePath (C-00 산출, ∈ {RULE144, SEC4A7, ...}); 판정: resalePath = SEC4A7 ⇒ txEngine ∈ NO_GS_ENGINE_SET.

### 3.9 Rule 502(c) — general solicitation의 예시적 정의 [ecfr.gov]

- **조항**: 17 C.F.R. §230.502(c) — ecfr.gov (Title 17, 2026-07-01 기준 현행)

- **핵심 원문**: (c) Limitation on manner of offering. Except as provided in § 230.504(b)(1) or § 230.506(c), neither the issuer nor any person acting on its behalf shall offer or sell the securities by any form of general solicitation or general advertising, including, but not limited to, the following: (1) Any advertisement, article, notice or other communication published in any newspaper, magazine, or similar media or broadcast over television or radio; and (2) Any seminar or meeting whose attendees have been invited by any general solicitation or general advertising; [Form D 신고·역외 언론 접근에 관한 두 단서(Provided, however / Provided further) 생략]

- **한국어**: (c) 청약 방식의 제한. §230.504(b)(1) 또는 §230.506(c)에 규정된 경우를 제외하고, 발행인도 발행인을 위하여 행위하는 어느 누구도 어떤 형태의 general solicitation 또는 general advertising으로도 증권을 청약하거나 판매하여서는 아니 된다. 여기에는 다음이 포함되나 이에 한정되지 아니한다: (1) 신문·잡지 그 밖의 유사 매체에 게재되거나 텔레비전·라디오로 방송되는 광고·기사·공지 그 밖의 커뮤니케이션; (2) 참석자가 general solicitation 또는 general advertising으로 초청된 세미나·모임; [...]

- **쉬운 설명**: §4(d)(2)의 "general solicitation or general advertising"이라는 용어에 내용을 대 주는 기준 조문이다(발행 국면 조문이지만 같은 용어의 해석 원천으로 기능한다). 두 가지 판독. ① 정의가 아니라 **예시 목록**이다 — "including, but not limited to". 그래서 새로운 매체(온체인 오더북·프런트 위젯)가 목록에 없다는 사실은 안전을 주지 않는다. 판단 축은 실무·해석상 "수신자와의 기존 실질 관계(pre-existing substantive relationship) 유무"로 수렴해 왔다 — 무차별 노출이면 general, 관계로 좁혀진 표적 커뮤니케이션이면 아님. Decipher의 멤버십은 전원 KYC·자격 검증을 거친 집합이지만, 검증 절차의 존재가 곧 "실질 관계"로 평가되는지는 확립된 결론이 아니다(체크박스 자기인증만으로 실질 관계가 성립하지 않는다는 선행 정리 — Citizen VC 계열 — 와 같은 결의 문제). ② 주체 문언("any person acting on its behalf")이 §4(d)(2)와 동형이다 — 엔진·프런트가 매도인을 위한 노출 장치로 평가될 가능성을 설계 단계에서 봉쇄하는 것(표적 요청만 허용)이 보수 규범이다.

- **PASS/FAIL 반영**: 간접 ✕ — B-04가 502(c)를 직접 판정하지 않는다. G④ 경로 overlay의 해석 기준이자, NO_GS_ENGINE_SET 보수 기본값(오더북 제외)의 근거.

- **ERC-3643 변환**: 직접 필드 없음. 오더북의 NO_GS_ENGINE_SET 편입 심사 시 확인 항목(수신자 집합의 관계 성격 정리)으로만 소비 — 편입은 정정·time-lock 경로(§11).

### 3.10 Rule 506(c) + §77d(b) — 발행 국면의 일반청약 허용: R1에서 엔진 축이 가벼운 이유 [ecfr.gov · uscode.house.gov]

- **조항**: 17 C.F.R. §230.506(c) — ecfr.gov; Securities Act §4(b), 15 U.S.C. §77d(b) — uscode.house.gov

- **핵심 원문**: (c) Conditions to be met in offerings not subject to limitation on manner of offering—(1) General conditions. To qualify for exemption under this section, sales must satisfy all the terms and conditions of §§ 230.501 and 230.502(a) and (d). (2) Specific conditions—(i) Nature of purchasers. All purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors. (ii) Verification of accredited investor status. The issuer shall take reasonable steps to verify that purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors. [검증 방법 목록 생략 — A-03 소관] / (b) Offers and sales exempt under section 230.506 of title 17, Code of Federal Regulations (as revised pursuant to section 201 of the Jumpstart Our Business Startups Act) shall not be deemed public offerings under the Federal securities laws as a result of general advertising or general solicitation.

- **한국어**: (c) 청약 방식 제한이 없는 offering의 충족 조건 — (1) 일반 조건. 본 조 면제를 받으려면 판매가 §§230.501·230.502(a)·(d)의 모든 조건을 충족하여야 한다[= 502(c) 무권유 제한은 목록에서 빠져 있다]. (2) 특별 조건 — (i) 매수인의 성격. 본 (c)항 offering에서 판매되는 증권의 모든 매수인은 accredited investor일 것. (ii) 적격투자자 지위의 검증. 발행인은 매수인이 accredited investor임을 검증하기 위한 합리적 조치를 취하여야 한다. / (b) [JOBS Act §201에 따라 개정된] 17 C.F.R. §230.506에 의하여 면제되는 청약·판매는 general advertising 또는 general solicitation을 이유로 연방증권법상 공모로 보지 아니한다.

- **쉬운 설명**: R1(발행 유지) 국면에서 엔진의 권유 성격이 왜 발행 면제를 위협하지 않는지의 근거다. 506(c)는 (1)의 조건 목록에서 502(c)를 의도적으로 뺐고 — 발행인은 일반청약하며 팔 수 있다 — §77d(b)는 그 일반청약이 "public offering" 평가로 번지는 길까지 제정법 차원에서 끊었다(§3(c)(7)의 no-public-offering 조건과의 접점은 A-13 문서 소관). 따라서 발행 국면 자체에는 B-04가 부과할 무권유 overlay가 없다. 그럼에도 R1에 B-04가 필수 부착(●)인 이유는 두 가지다 — ① 기초 게이트: 발행 자산의 모든 거래는 카드가 선언한 엔진 집합 안에서만 돌아야 한다는 선언 집행은 발행 framework 유지 확인의 일부다. ② 비대칭의 관리: 발행은 시끄러워도 되지만 그 물량의 재판매는 §4(d)(2)·144(f)의 조용함을 요구한다 — 같은 자산에서 국면별로 다른 엔진 규율이 걸린다는 사실 자체가, 엔진을 자산 상수 하나로 접지 않고 거래 overlay로 이원화한 설계의 근거다.

- **PASS/FAIL 반영**: 간접 ✕ — 발행 국면 무권유 overlay 부재의 확인(G④가 발행 거래에 활성화되지 않는 근거). 기초 게이트(G①~③)는 R1에서도 동일 작동.

- **ERC-3643 변환**: facts.issuanceFramework = RegD506c (카드 사실, B-01 관리) — G④의 활성식이 issuance 국면이 아닌 resalePath 태그에만 반응하도록 배선.

### 3.11 Securities Act §4(c) — 506 증권 플랫폼의 BD 비등록 조건: venue 경계의 제정법 좌표 [uscode.house.gov]

- **조항**: Securities Act §4(c), 15 U.S.C. §77d(c) — uscode.house.gov (FAST Act 이전 2012 JOBS Act §201(c) 신설 조항)

- **핵심 원문**: (c)(1) With respect to securities offered and sold in compliance with Rule 506 of Regulation D under this Act, no person who meets the conditions set forth in paragraph (2) shall be subject to registration as a broker or dealer pursuant to section 78o(a)(1) of this title, solely because— (A) that person maintains a platform or mechanism that permits the offer, sale, purchase, or negotiation of or with respect to securities, or permits general solicitations, general advertisements, or similar or related activities by issuers of such securities, whether online, in person, or through any other means; (B) that person or any person associated with that person co-invests in such securities; or (C) that person or any person associated with that person provides ancillary services with respect to such securities. (2) Exemption.—The exemption provided in paragraph (1) applies to any person described in such paragraph if— (A) such person and each person associated with that person receives no compensation in connection with the purchase or sale of such security; (B) such person and each person associated with that person does not have possession of customer funds or securities in connection with the purchase or sale of such security; and (C) such person is not subject to a statutory disqualification as defined in section 78c(a)(39) of this title and does not have any person associated with that person subject to such a statutory disqualification.

- **한국어**: (c)(1) 이 법상 Regulation D Rule 506에 부합하여 청약·판매되는 증권에 관하여, (2)의 조건을 충족하는 자는 다음 사유만으로는(solely because) §15(a)(1)[78o(a)(1)]에 따른 broker 또는 dealer 등록 대상이 되지 아니한다 — (A) 그 자가 증권의 청약·판매·매수·협상을 가능하게 하는 platform 또는 mechanism을 유지하는 것(온라인·대면 그 밖의 수단 불문), 또는 발행인의 일반권유·일반광고 등을 가능하게 하는 것; (B) 공동투자; (C) 부수 서비스 제공. (2) 면제. — (1)의 면제는 다음의 경우에 적용된다 — (A) 그 자와 그 관계자가 **그 증권의 매매와 관련하여 어떠한 보수도 받지 아니할 것**; (B) 그 자와 그 관계자가 그 매매와 관련하여 고객의 자금 또는 증권을 보유하지 아니할 것; (C) statutory disqualification에 해당하지 아니할 것.

- **쉬운 설명**: 의회가 "506 증권 플랫폼"이라는 개념을 제정법에 새긴 유일한 자리이며, 엔진 층과 venue 층의 경계를 그어 주는 좌표다. 문언상 매력적으로 보이지만 — (2)(A)의 **무보수 조건** 때문에 거래 수수료를 받는 venue에는 적용되지 않고, (2)(B)의 무보유 조건도 결제 구조에 따라 문제된다. 즉 이 조항은 "수수료 없는 게시판"을 위한 것이지 매칭·체결·과금하는 거래소를 위한 것이 아니다. B-04의 관점에서 이 조문이 하는 일은 하나다: **엔진 게이팅(거래 층)과 venue 지위(운영 층)는 별개의 법 문제**임을 제정법 차원에서 확인해 준다 — B-04가 아무리 정확히 돌아도 venue 층의 BD/ATS 성격규명은 남으며, 그 쟁점은 본 부품 밖(법률의견서 Q1·전문 counsel)이다.

- **PASS/FAIL 반영**: 간접 ✕ — B-04 판정에 불사용. venue 경계의 Background 좌표.

- **ERC-3643 변환**: 직접 필드 없음.

### 3.12 Reg ATS Rule 300(a)·(e) — ATS·Order 정의: (g)(3)(iv)의 참조어와 주문의 규제 문법 [ecfr.gov]

- **조항**: 17 C.F.R. §242.300(a)·(e) — ecfr.gov (Title 17, 2026-07-06 기준 현행)

- **핵심 원문**: (a) Alternative trading system means any organization, association, person, group of persons, or system: (1) That constitutes, maintains, or provides a market place or facilities for bringing together purchasers and sellers of securities or for otherwise performing with respect to securities the functions commonly performed by a stock exchange within the meaning of § 240.3b-16 of this chapter; and (2) That does not: (i) Set rules governing the conduct of subscribers other than the conduct of such subscribers' trading on such organization, association, person, group of persons, or system; or (ii) Discipline subscribers other than by exclusion from trading. [...] (e) Order means any firm indication of a willingness to buy or sell a security, as either principal or agent, including any bid or offer quotation, market order, limit order, or other priced order.

- **한국어**: (a) alternative trading system이란 다음의 모든 조직·단체·자·집단·시스템을 뜻한다: (1) 증권의 매수인과 매도인을 한데 모으는 시장 또는 설비를 구성·유지·제공하거나, 그 밖에 증권에 관하여 §240.3b-16의 의미에서 증권거래소가 통상 수행하는 기능을 수행하는 것; 그리고 (2) 다음을 하지 아니하는 것: (i) 가입자의 그 시스템 내 거래 행위 외의 행위를 규율하는 규칙 제정; (ii) 거래 배제 외의 방법으로 가입자를 징계. [...] (e) order란 principal로서든 agent로서든 증권을 매수 또는 매도할 의사의 확정적 표시(firm indication)를 뜻하며, bid·offer 호가, 시장가 주문, 지정가 주문 그 밖의 가격 지정 주문을 포함한다.

- **쉬운 설명**: 두 용어가 B-04의 문법을 고정한다. ① (a)는 (g)(3)(iv)가 참조하는 "alternative trading system"의 정의 — 매수인·매도인을 한데 모으는 시스템이라는 기능 기준이라, 오더북형 온체인 venue가 이 기능 기술에 정면으로 들어온다는 사실 자체가 venue 층 쟁점(등록 축)의 출발점이다. B-04는 이 정의를 판정에 쓰지 않고, (g)(3)(iv) 편입 조건의 참조어로만 고정해 둔다. ② (e)는 "주문"의 규제상 의미 — **확정적 매매 의사 표시**. 오더북 게시가 규제 문법에서 단순 정보가 아니라 firm indication으로 읽힌다는 것, 그래서 게시 행위의 권유성 평가(§3.8·§3.9)와 venue의 기능 평가(§3.14)가 모두 이 지점에서 출발한다는 것을 개발·운영이 공유해야 한다.

- **PASS/FAIL 반영**: 간접 ✕ — 정의 조문. (g)(3)(iv) 편입 조건과 오더북 성격 논의의 용어 기반.

- **ERC-3643 변환**: 직접 필드 없음. 오더북 주문 객체의 로그 스키마(firm indication으로서의 게시 시각·양방향 여부)가 §3.7 예약 필드의 데이터 원천.

### 3.13 SEC Release No. 33-8869 (2007-12-06) — 현행 (f)·(g) 구조의 취지와 주체 (Layer 3) [sec.gov]

- **조항**: Revisions to Rules 144 and 145, Release No. 33-8869 (2007-12-06), 72 FR 71546 — sec.gov (sec.gov/files/rules/final/2007/33-8869.pdf)

- **핵심 원문**: [gatekeeper 논거] we agree that, as financial intermediaries, brokers serve an important function as gatekeepers for promoting compliance with Rule 144 [...] we are concerned that eliminating the manner of sale requirements for equity securities would lead to abuse. [riskless principal 신설] We believe that these riskless principal transactions are equivalent to agency trades. [ATS 호가 안전항 — 주체] This new provision permits a broker to insert bid and ask quotations for the security in an alternative trading system, as defined in Rule 300 of Regulation ATS [...] provided that the broker has published bona fide bid and ask quotations for the security in the alternative trading system on each of the last 12 business days. [1978년 market maker 갈래의 연혁] the Commission amended Rule 144(f) to permit sales under the rule to be made directly to a market maker in lieu of selling through a broker [n. citing Release No. 33-5979 (Sept. 19, 1978)]


[output truncated at 50000 of 86185 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007865
- Available tabs:
  • tabId 437007716: "(1) 7/8 | Notion" (https://app.notion.com/p/deciphersnu/7-8-398dff004c898098b1defb8a486ffa72)
  • tabId 437007865: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/04fc44e8-c61b-4105-bd9c-3c00978b074b/Element.B-04_엔진-선택.md?table=block&id=39edff00-4c89-80c1-8d79-de9a7419301e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=RiUqq1SnVeD2ASSYNtcy9mv7534Ay83CtVaKuwmrTXg&downloadName=Element.B-04_엔진-선택.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/04fc44e8-c61b-4105-bd9c-3c00978b074b/Element.B-04_%E1%84%8B%E1%85%A6%E1%86%AB%E1%84%8C%E1%85%B5%E1%86%AB-%E1%84%89%E1%85%A5%E1%86%AB%E1%84%90%E1%85%A2%E1%86%A8.md?table=block&id=39edff00-4c89-80c1-8d79-de9a7419301e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=RiUqq1SnVeD2ASSYNtcy9mv7534Ay83CtVaKuwmrTXg&downloadName=Element.B-04_%E1%84%8B%E1%85%A6%E1%86%AB%E1%84%8C%E1%85%B5%E1%86%AB-%E1%84%89%E1%85%A5%E1%86%AB%E1%84%90%E1%85%A2%E1%86%A8.md)
  • tabId 437007866: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/89c220ee-b89c-43e6-b667-e611a389f432/C-00_resale-path-selector.md?table=block&id=39fdff00-4c89-80e2-81e5-c5ad6255b224&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=caSVWlN7iZZuzQMF-aGrK7Nb0sobDN-vWpWUPPE8HmU&downloadName=C-00_resale-path-selector.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/89c220ee-b89c-43e6-b667-e611a389f432/C-00_resale-path-selector.md?table=block&id=39fdff00-4c89-80e2-81e5-c5ad6255b224&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=caSVWlN7iZZuzQMF-aGrK7Nb0sobDN-vWpWUPPE8HmU&downloadName=C-00_resale-path-selector.md)
  • tabId 437007867: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/d4595b45-121b-4546-851e-4de3ab05ce7b/Element.D-01_보유자-수-카운터.md?table=block&id=39edff00-4c89-807f-aa04-c016b72d5575&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=BSbO33EdGZEmvEqzE2iuf1NaeRjmPG95ZRm3hUeNd7w&downloadName=Element.D-01_보유자-수-카운터.md" (
