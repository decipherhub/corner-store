# ELE.F-01_operator-self-dealing

# F-01 Operator Self-Dealing Restriction — 부품 심층 인수인계 문서 (Walkthrough)

> 이 문서는 Decipher RWA DEX의 F-01 부품(운영자 자기거래 제한)을 A-13 v1 형식으로 정리한 심층 인수인계 자료다. F-01은 거래 당사자 중 어느 한쪽이라도 플랫폼 운영자 측(Decipher 법인·계열·임직원)이면 체결 직전에 그 거래를 막는 게이트다. 핵심 논지 하나 — F-01은 어떤 단일 조문의 직접 전사가 아니라, 운영자 자기거래가 성립시킬 반사기 책임의 사실적 전제 자체를 pre-trade에서 제거하는 예방적 게이트다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

### 1.1 미국 증권법의 4개 기둥과 그중 반사기 축의 자리

미국 연방 증권규제는 네 기둥으로 서 있다 — Securities Act of 1933(발행·공시), Securities Exchange Act of 1934(유통시장·중개업자·시장조작 금지·반사기), Investment Company Act of 1940(펀드), Investment Advisers Act of 1940(투자자문). 앞선 부품들이 주로 1933법(발행 면제: A-03·E-01·E-03·F-04)과 1940법(펀드 자격: A-13·D-01)에 뿌리를 둔 데 반해, 본 부품은 1934법의 반사기·시장조작 축과 그 하위 규칙인 Regulation ATS에 뿌리를 둔다.

이 축이 규율하는 것은 "누가 증권을 살 자격이 있는가"(자격)가 아니라 "시장을 운영하는 자가 그 시장에서 고객을 상대로 부정하게 거래하지 않을 것"이라는 유통시장 무결성이다. 발행이 적법하고(1933법) 매수인이 적격이고(1940법) 명부가 정합적이어도(B-01), 그 위에서 운영자가 고객의 미체결 주문을 보고 반대편에서 거래하면 별개의 위반이 성립한다. F-01은 바로 그 별개의 위반을 다룬다.

### 1.2 왜 이 규제가 존재하는가 — 운영자의 정보우위와 다크풀 스캔들

거래장(venue)을 운영하는 자는 나머지 시장이 모르는 것을 본다 — 미체결 주문흐름(order flow)이다. 어떤 매수·매도가 얼마에 대기 중인지를 운영자만 안다. 이 정보로 운영자 자신이나 그 임직원·계열이 고객 반대편에서 거래하거나(자기거래) 고객 주문에 앞질러 거래하면(front-running), 이는 정보 비대칭을 악용한 기망적 행위다. 시장은 상대가 중립적 매칭 엔진이라 믿고 주문을 냈는데, 실제로는 그 정보를 가진 운영자가 상대편에 서 있었던 것이기 때문이다.

이 우려는 추상적이지 않다. 1998년 SEC가 Regulation ATS를 채택하면서 ATS 운영자에게 두 가지를 명시적으로 요구한 이유가 이것이다 — subscriber의 기밀 주문정보에 접근할 수 있는 자를 "시스템을 운영하거나 컴플라이언스를 담당하는 직원"으로 한정할 것(Rule 301(b)(10)(i)(A)), 그리고 ATS 직원이 자기 계좌로 거래하는 것을 통제하는 기준을 둘 것(Rule 301(b)(10)(i)(B)). 이후 2010년대 미국의 여러 다크풀 집행 사건 — 운영자의 관계사 거래 데스크가 subscriber 반대편에서 거래하거나, 풀 안에 누가 있는지를 허위로 설명한 사례 — 은 이 우려가 현실임을 실증했다.

### 1.3 두 개의 축 — 운영자 지위(BD/ATS)는 미결, 반사기는 지위와 무관

Decipher 운영자의 법적 지위는 아직 확정되지 않았다. 본 프로젝트의 BD/ATS 법률의견서(Question 1)는 다음과 같이 정리한다 — 가정상 Decipher의 스마트컨트랙트가 이전을 매칭·체결·결제하고 운영자가 거래당 수수료를 받으므로, 운영자는 "타인의 계산으로 거래를 성사(effecting transactions for the account of others)"시키는 broker에 해당할 소지가 크고, 나아가 ATS일 수 있다. 다만 이 지위는 미결이며 외부 전문 자문과 SEC Crypto Task Force 관여가 필요한 사항이다.

F-01의 설계는 이 미결에 의존하지 않는다. 반사기 규정(§10(b)/Rule 10b-5, §17(a))은 "any person(모든 자)"에게 적용되므로 운영자가 broker로 등록됐든 아니든 무조건 걸린다. 지위가 broker/ATS로 확정되면 그때 Reg ATS Rule 301(b)(10)과 Exchange Act §15(c)(1)이 조건부로 추가되어 근거가 두꺼워질 뿐이다. 그래서 본 부품의 법적 뿌리는 두 겹이다 — 무조건적 1차 뿌리는 반사기, 조건부 보강은 Reg ATS·§15(c). F-01은 지위 확정 이전에도 이미 정당화된다.

### 1.4 Decipher 시스템에서 왜 중요한가

반사기 책임은 발행 면제(506(c))나 펀드 면제(§3(c)(7))의 성립 여부와 독립적이다. 즉 R1·R2·R3의 모든 게이트를 통과한 완벽히 적법한 거래라도, 그 상대가 운영자였다면 반사기 위반이 성립할 수 있고, 이는 플랫폼 전체의 신뢰와 집행 리스크로 번진다. 운영자 자기거래는 "한 건"이 문제가 아니라 "운영자가 자기 시장에서 거래한다"는 사실 자체가 시장의 중립성 신뢰를 무너뜨린다.

F-01은 그 사실적 전제를 체결 직전에 원천 제거한다. "운영자는 자기 시장에서 거래하지 않는다"를 사람의 준법의지가 아니라 코드로 강제한다. 이것이 A-01(제재)과 같은 계열의 하드 게이트인 이유이며, 동시에 본 부품이 R4(시장행위 감시)의 다른 부품들(F-02·F-03의 사후 감시 flag)과 성격이 다른 이유이기도 하다(§9.3).

---

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고 "본 부품"·"운영자 자기거래 제한 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | Operator Self-Dealing Restriction | 운영자·계열·임직원의 자기 플랫폼 거래 차단기 |
| 검사 대상 | 거래 당사자(from/to) 중 어느 한쪽이라도 제한대상 집합에 속하는지 — Decipher 법인 + affiliate(Rule 405 control 기준) + 임원·이사·직원(associated person) + 이들이 지배하는 계좌 | "이 거래에 운영자 측이 끼어 있나" |
| Internal ID | F-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 게이트형 — negative screen(온체인 제한대상 레지스트리 대조 후 strict block). 증명서형(Pattern B) 아님 | A-01 제재와 같은 계열; 서명 증명서가 아니라 명부 대조 |
| Timing | pre-trade(거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | STATELESS (Element 한정) | 거래는 제한대상 명부를 읽기만 한다. 명부 자체의 등록·갱신은 거래 외 운영 트랜잭션 경로로만 변한다(§8.4 개념은 A-04와 동일) |
| 주 활성화 Recipe | R4(시장행위 감시) | PM 규약상 소속 레시피 |
| Cumulative Recipe | R1·R2·R3 (실질상 모든 거래에 pre-trade 병렬 적용 권장 — 글로벌 게이트 성격, §9.3·§12) | 함께 켜지는 레시피 |
| Cascade Element | A-04(신원 확정)·A-06(affiliate 판정 로직 공유) | 본 부품이 결과를 소비하는 검사 부품 |
| 성숙도 | △ 미착수 → 본 문서로 착수 | 데모 대상, 본 walkthrough가 첫 산출물 |
| 파일·위치 | F-01_operator-self-dealing.md · 산출물/elements/ | 산출물 경로 |

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석)은 SEC 발행문서·집행선이 취지를 메운 해석이다. 아래 §3.0.2 표의 종류 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff·Case = Layer 3. 본 절은 조문이 작동하는 논리 흐름 순서로 배열돼 §3.1~§3.12 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

본 부품의 §3은 A-13과 한 가지 근본에서 다르다. A-13은 하나의 자격 정의(§2(a)(51))를 중심으로 하위 규칙이 방사형으로 붙는 구조였다. F-01은 그렇지 않다 — 어떤 조문도 "운영자는 자기 시장에서 거래하지 마라"라고 직접 명령하지 않는다. 대신 운영자 자기거래가 위반이 되는 경로(반사기)와, 그 위반의 사실적 전제를 통제하도록 요구하는 경로(Reg ATS)가 여러 조문에 흩어져 있고, F-01은 그것들이 겨누는 위반을 pre-trade 게이트로 원천 봉쇄한다. 그래서 §3은 "F-01이 직접 판정하는 요건 목록"이 아니라 "F-01이 예방하는 위반의 근거 지도"다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 운영자 자기거래라는 하나의 우려가 어떤 조문·규칙에 걸리는지, 그리고 F-01의 게이트가 그것을 어떻게 봉쇄하는지를 하나의 흐름으로 정리한 것이다 — 우려(주문흐름 MNPI 이용) → Layer 1 반사기 4조문(§10(b)·§17(a)·§9(a)(1)·§15(c) 조건부) → Layer 2 규칙(Rule 10b-5·10b-3·Reg ATS 301(b)(10) 조건부) → 제한대상 범위 정의(Rule 405) → 제한대상 집합 → F-01 예방적 게이트. 오른쪽 점선 박스는 ICA §17 오귀속 주의(negative finding).

![법조문 관계 플로우차트](fig30.png)

**범례.**

- 파랑 = 무조건적 핵심(Direct: §10(b)·Rule 10b-5·§17(a))

- 노랑 = 조건부 최핵심(Reg ATS 301(b)(10) — ATS 해당 시 F-01의 직접 법정 대응물)

- 점선 파랑 = 조건부(§15(c)·Rule 10b-3 — broker 해당 시)

- 회색 점선 note = negative finding(ICA §17 부적용)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

§3.0이 일반 법조문 흐름이라면, 이 절은 BUIDL-like 토큰의 2차 거래에 F-01이 어떻게 걸리는지를 보여준다. (재확인) 본 서술은 실제 BlackRock BUIDL의 운영 조건을 단정하지 않는다 — BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링한 것이다.

Decipher가 BUIDL-like 토큰의 whitelist 참여자 간 2차 거래(RFQ/P2P)를 매칭·체결한다고 하자. 이때 F-01이 겨누는 시나리오는 이런 것들이다 — (a) Decipher 법인 자신이 자기 계정으로 그 토큰을 매수·매도하는 경우, (b) Decipher의 임직원이 미체결 주문을 보고 자기 계좌로 앞질러 거래하는 경우, (c) Decipher를 지배하거나 Decipher와 공통지배 관계에 있는 계열사(예: 같은 지주 아래 거래 데스크)가 subscriber 반대편에서 거래하는 경우. 세 경우 모두 운영자가 가진 주문흐름 정보우위를 전제로 하며, F-01은 거래 당사자 주소가 제한대상 명부에 있는지만 보고 이 세 경우를 동일하게 차단한다.

중요한 것은 F-01이 BUIDL의 발행 적법성(506(c))이나 펀드 지위(§3(c)(7))를 건드리지 않는다는 점이다. F-01은 그 위층에서, "누가 이 시장을 운영하는가"와 "누가 이 거래의 당사자인가"가 겹치지 않도록만 강제한다. 그리고 뒤(§3.9)에서 보듯 이 강제의 근거는 ICA §17(펀드 관계자 자기거래)이 아니다 — BUIDL은 §3(c)(7)로 투자회사 정의에서 빠져 있어 ICA 실체규정이 닿지 않고, Decipher는 애초에 그 펀드의 관계자도 아니기 때문이다.

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. 표 1(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 F-01에 어떻게 닿는지를, 표 2(순서·중요성)는 §3.1~§3.12 소단원의 읽는 순서(논리 흐름)와 중요성(F-01이 실제로 그걸로 봉쇄하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이다. 제정법 출처는 uscode.house.gov·govinfo.gov로, 연방규칙은 ecfr.gov로 통일했다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | F-01 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Exchange Act §10(b) · 15 U.S.C. 78j(b) | 증권 매매 관련 기망·조작 장치 금지(any person) | 운영자 자기거래·프론트런이 위반이 되는 근본 조문 | Direct | uscode.house.gov |
| SEC Rule | Rule 10b-5 · 17 CFR 240.10b-5 | §10(b) 실행규칙 — 사기 계획(a)·부실표시(b)·사기 행위(c) | 미공개 자기거래 = (a)·(c) 해당 | Direct | ecfr.gov |
| Statute | Securities Act §17(a) · 15 U.S.C. 77q(a) | 증권 청약·매도상 사기 금지 | 발행측·병행 근거; (a)(3) 광범위 | Direct | uscode.house.gov |
| SEC Rule | Reg ATS Rule 301(b)(1) · 17 CFR 242.301(b)(1) | ATS는 §15상 broker-dealer 등록 의무 | ATS 해당 시 Reg ATS 전 체계가 운영자에 결속 | Conditional | ecfr.gov |
| SEC Rule | Reg ATS Rule 301(b)(10) · 17 CFR 242.301(b)(10) | subscriber 주문정보 접근제한(i)(A)·임직원 자기계좌 거래 통제(i)(B) | ATS 해당 시 F-01의 직접 법정 대응물 | Conditional | ecfr.gov |
| Statute | Exchange Act §15(c)(1) · 15 U.S.C. 78o(c)(1) | broker-dealer의 기망·조작 장치 금지 | broker 해당 시 운영자에 직접 적용 | Conditional | uscode.house.gov |
| SEC Rule | Rule 10b-3 · 17 CFR 240.10b-3 | §15(c)(1) 실행규칙(BD 반사기) | broker 해당 시 §15(c)의 하위 규칙 | Conditional | ecfr.gov |
| SEC Rule | Rule 405 · 17 CFR 230.405 | affiliate·control 정의 | 제한대상 집합의 범위(누가 계열인가) 확정 | Supporting | ecfr.gov |
| Statute | Exchange Act §9(a)(1) · 15 U.S.C. 78i(a)(1) | wash sale·matched order 금지 | 운영자 자기거래가 만드는 가장매매 우려(F-02와 중첩) | Supporting | uscode.house.gov |
| Statute | ICA §17(a) · 15 U.S.C. 80a-17(a) | 등록 투자회사 관계자의 자기거래 금지 | 부적용 근거(negative finding) — F-01은 여기서 나오지 않음 | Background | uscode.house.gov |
| Statute | ICA §3(c)(7)·§2(a)(3) · 15 U.S.C. 80a-3(c)(7)·80a-2(a)(3) | 투자회사 정의 제외 · affiliated person 정의 | §17 부적용의 두 축(펀드 미등록·운영자 비관계자) | Background | uscode.house.gov |
| SEC Release | Reg ATS 채택 · 63 FR 70921 (Dec. 22, 1998) | 301(b)(10) 기밀·자기계좌 통제 취지 | Layer 3 해석(설계 취지) | Supporting | federalregister.gov |
| Case | 다크풀·ATS 운영자 자기거래 집행선(Pipeline 등) | 운영자 관계사의 subscriber 반대편 거래·주문정보 오용 제재 | 배경·리스크(구체 인용은 §12 외부자문) | Background | sec.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | F-01이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | Exchange Act §10(b) — 반사기 근본 | 핵심 | 운영자 자기거래를 위반으로 성립시키는 근거 — 그 전제를 게이트로 제거 |
| §3.2 | Rule 10b-5 — §10(b) 실행 | 핵심 | (a)·(c)에 미공개 자기거래 포섭; 예방 대상 특정 |
| §3.3 | Securities Act §17(a) — 청약·매도 사기 | 핵심 | 발행측·병행 반사기; (a)(3) 폭넓은 사기 행위 |
| §3.4 | Reg ATS 301(b)(1) — BD 등록 | 조건부 | ATS 해당 시 Reg ATS 체계 결속의 관문 |
| §3.5 | Reg ATS 301(b)(10) — 기밀·자기계좌 통제 | 조건부(핵심) | ATS 해당 시 F-01이 이행하는 직접 법정 요구 |
| §3.6 | §15(c)(1) · Rule 10b-3 — BD 반사기 | 조건부 | broker 해당 시 운영자에 직접 적용 |
| §3.7 | Rule 405 — affiliate·control | 보조 | 제한대상 집합의 계열 범위 확정 |
| §3.8 | §9(a)(1) — wash/matched | 보조 | 운영자 자기거래발 가장매매 차단(F-02 연계) |
| §3.9 | ICA §17(a)·§3(c)(7)·§2(a)(3) — 부적용 | 배경 | F-01이 ICA §17에서 나오지 않음을 확정(negative finding) |
| §3.10 | Layer 3(채택 release·집행선) | 보조 | 안 함 — 설계 취지·리스크 해석 |
| §3.11 | Sub-요건 분해 매트릭스 | — | 위 근거를 원자적 검증 단위로 분해 |
| §3.12 | ERC-3643 변환 총정리 | — | §3.1~§3.9의 게이트 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래는 같은 거래에 작동하지만 F-01이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리다.

- **사후 시장행위 패턴 탐지(wash trade·spoofing·layering의 실제 탐지)** — F-02 소관. F-01은 사전 당사자 차단만 한다. §9(a)(1)은 F-01에서는 "왜 운영자 자기거래를 막나"의 보조 근거로만 인용하고, 패턴 탐지 자체는 F-02가 STATEFUL하게 수행한다.

- **의심거래 보고(SAR 유사)** — F-03 소관. 제한대상 위장·우회 시도가 탐지되면 F-03의 보고 신호가 된다(§9.2).

- **매수인 자격·신원(누가 살 자격이 있나)** — A-03·A-13·A-04 소관. F-01은 당사자가 "운영자 측인가"만 보지 "적격인가"는 보지 않는다.

- affiliate 판정 로직 자체는 — A-06 소관. F-01은 A-06이 산출한 계열 판정 결과를 제한대상 명부 구성에 소비할 뿐, 계열 여부의 실체 판정은 A-06이 한다(§9.2).

### 3.1 Exchange Act §10(b) — 기망·조작 장치 금지 [출처: uscode.house.gov]

**핵심 원문:** It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce or of the mails, or of any facility of any national securities exchange— ... (b) To use or employ, in connection with the purchase or sale of any security registered on a national securities exchange or any security not so registered, or any securities-based swap agreement any manipulative or deceptive device or contrivance in contravention of such rules and regulations as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors.

**한국어:** 모든 자(any person)가 직접 또는 간접으로, 주간통상 또는 우편의 수단·설비, 또는 전국증권거래소의 설비를 사용하여 다음을 행하는 것은 위법이다 — (b) 전국증권거래소에 등록된 증권이든 그렇게 등록되지 아니한 증권이든 그 매수 또는 매도와 관련하여(in connection with the purchase or sale), Commission이 공익 또는 투자자 보호를 위하여 필요·적절하다고 규정하는 규칙에 위반하여, 조작적 또는 기망적 장치나 술책(manipulative or deceptive device or contrivance)을 사용·이용하는 것.

**쉬운 설명:** 미국 반사기 규제의 근본 조문이다. 세 가지가 F-01에 결정적이다. 첫째, 주체가 "any person"이라 운영자가 broker로 등록됐든 아니든 걸린다 — 지위 미결과 무관하다는 §1.3의 뿌리가 여기 있다. 둘째, 대상 증권이 "등록된 증권이든 그렇게 등록되지 아니한 증권이든"이라, BUIDL-like 비상장 펀드지분도 정면으로 포섭된다. 셋째, "매수 또는 매도와 관련하여"라는 연결고리 — 운영자가 미체결 주문정보를 이용해 반대편에서 거래하는 것은 바로 그 매매와 관련된 기망적 장치의 전형이다. 다만 §10(b) 자체는 "규칙에 위반하여"라는 위임 구조라, 실제 금지의 윤곽은 Rule 10b-5(§3.2)가 그린다.

**PASS/FAIL 반영:** 직접 ○ — 운영자 자기거래를 위법으로 성립시키는 근본 근거. F-01은 이 위법의 사실적 전제(운영자가 당사자가 됨)를 pre-trade에서 제거해 위반 자체가 발생하지 않게 한다. 조문이 "제한대상이면 FAIL"이라고 명령하는 것이 아니라, F-01의 FAIL 규칙이 이 조문의 위반을 예방하는 관계다.

**ERC-3643 변환:** 게이트 근거 — compliance module `RestrictedOperatorModule.canTransfer(from,to)`가 false를 반환(revert)하는 정당화 근거. claim이 아니라 module-level negative screen(A-01 sanctions와 동형).

### 3.2 Rule 10b-5 — §10(b) 실행규칙 [출처: ecfr.gov]

**핵심 원문:** It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce, or of the mails or of any facility of any national securities exchange, (a) To employ any device, scheme, or artifice to defraud, (b) To make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading, or (c) To engage in any act, practice, or course of business which operates or would operate as a fraud or deceit upon any person, in connection with the purchase or sale of any security.

**한국어:** 모든 자가 직접 또는 간접으로 주간통상·우편·전국증권거래소 설비를 사용하여, 증권의 매수 또는 매도와 관련하여 다음을 행하는 것은 위법이다 — (a) 사기하기 위한 장치·계획·술책을 사용하는 것, (b) 중요한 사실에 관한 부실표시를 하거나, 표시된 내용이 그 정황에 비추어 오해를 일으키지 아니하도록 하기 위하여 필요한 중요한 사실의 진술을 누락하는 것, 또는 (c) 누구에 대하여든 사기 또는 기망으로 작용하거나 작용할 수 있는 행위·관행·업무과정에 관여하는 것.

**쉬운 설명:** §10(b)의 추상적 금지를 세 갈래로 구체화한다. 운영자 자기거래는 이 중 (a)와 (c)에 걸린다. 운영자가 자신이 상대편이라는 사실을 숨긴 채 중립적 매칭인 것처럼 시장을 운영하며 고객 주문정보로 거래하면, 이는 "사기하기 위한 장치·계획"(a)이자 "누구에 대하여든 사기로 작용하는 업무과정"(c)이다. (b)의 부실표시가 없어도 — 즉 명시적 거짓말을 하지 않아도 — (a)·(c)의 기망적 행위·업무과정만으로 위반이 성립한다는 점이 핵심이다. 미공개 주문흐름을 이용한 거래는 미국 판례상 misappropriation(정보 유용) 이론으로 §10(b)/10b-5 위반이 될 수 있다.

**PASS/FAIL 반영:** 직접 ○ — F-01이 예방하는 위반을 정확히 특정하는 규칙. (a)·(c)의 "미공개 자기거래·정보 유용"이 F-01 게이트의 봉쇄 표적이다. F-01의 FAIL(제한대상이 당사자)은 (a)·(c)의 성립 전제를 제거한다.

**ERC-3643 변환:** 게이트 근거 — module reason 태그의 법적 서술로 `OP_SELF_DEALING_BLOCKED`가 겨누는 위반 유형(10b-5(a)·(c)). claim.basis가 아니라 negative screen 사유.

### 3.3 Securities Act §17(a) — 증권 청약·매도상 사기 금지 [출처: uscode.house.gov]

**핵심 원문:** It shall be unlawful for any person in the offer or sale of any securities (including security-based swaps) or any security-based swap agreement (as defined in section 78c(a)(78) of this title) by the use of any means or instruments of transportation or communication in interstate commerce or by use of the mails, directly or indirectly— (1) to employ any device, scheme, or artifice to defraud, or (2) to obtain money or property by means of any untrue statement of a material fact or any omission to state a material fact necessary in order to make the statements made, in light of the circumstances under which they were made, not misleading; or (3) to engage in any transaction, practice, or course of business which operates or would operate as a fraud or deceit upon the purchaser.

**한국어:** 모든 자가 증권(security-based swap 포함) 또는 security-based swap agreement의 청약 또는 매도(in the offer or sale)에 있어, 주간통상의 운송·통신 수단이나 우편을 사용하여 직접 또는 간접으로 다음을 행하는 것은 위법이다 — (1) 사기하기 위한 장치·계획·술책을 사용하는 것, 또는 (2) 중요한 사실에 관한 부실표시 또는 그러한 표시가 오해를 일으키지 아니하도록 하기 위하여 필요한 중요한 사실의 누락을 수단으로 금전 또는 재산을 취득하는 것, 또는 (3) 매수인에 대하여 사기 또는 기망으로 작용하거나 작용할 수 있는 거래·관행·업무과정에 관여하는 것.

**쉬운 설명:** 1933법의 반사기 조문으로, §10(b)/10b-5와 짝을 이룬다. 문언상 "청약 또는 매도(offer or sale)"에 걸려 발행측에 더 직접적이지만, (a)(3)의 "매수인에 대하여 사기로 작용하는 거래·관행·업무과정"은 매우 넓어 2차 시장의 운영자 행위에도 닿는다. 실제로 미국의 다크풀·거래장 운영자 자기거래 집행 사건들은 §17(a)(2)·(3)을 자주 근거로 삼았다 — 풀 안에 누가 있는지, 운영자가 거래하는지를 제대로 알리지 않은 채 시장을 운영한 것을 "매수인에 대한 사기적 업무과정"으로 본 것이다. 다만 2차 매매 그 자체는 §10(b)가 더 정면이고, §17(a)는 발행 연속선·병행 근거로 인용한다.

**PASS/FAIL 반영:** 직접 ○(병행) — §10(b)/10b-5와 병행하는 반사기 근거. 발행(R1)과 2차(R2) 양쪽에서 운영자 자기거래를 위법으로 성립시키며, F-01은 그 전제를 제거한다. 단독 판정 근거라기보다 §10(b)와 함께 F-01의 예방 대상을 두껍게 하는 역할.

**ERC-3643 변환:** 게이트 근거(병행) — §10(b)와 동일한 module 봉쇄를 정당화. 발행 배포 예외(§6.3 ①)의 경계를 판단할 때 "offer or sale" 문언이 참조된다.

### 3.4 Reg ATS Rule 301(b)(1) — ATS의 broker-dealer 등록 의무 [출처: ecfr.gov]

**핵심 원문:** *Broker-dealer registration.* The alternative trading system shall register as a broker-dealer under section 15 of the Act, (15 U.S.C. 78o).

**한국어:** (broker-dealer 등록.) 대체거래시스템(ATS)은 Act 제15조(15 U.S.C. 78o)에 따라 broker-dealer로 등록하여야 한다.

**쉬운 설명:** Reg ATS의 관문 조항이다. 어떤 플랫폼이 ATS에 해당하면 그것은 자동으로 §15상 broker-dealer 등록 의무를 지고, 그 결과 broker-dealer에 적용되는 반사기·기록·감독 체계(§15(c), Rule 17a-3/17a-4, 그리고 아래 301(b)(10))가 전부 함께 결속된다. Decipher가 ATS인지는 미결이지만(§1.3), 만약 ATS로 판정되면 이 조항을 통해 301(b)(10)의 자기계좌 거래 통제 의무가 발동한다. 주의할 것은 Reg ATS 301(a)의 면제 목록 중 (a)(4)(정부증권·repo·정부증권 옵션·CP만 취급하는 BD/은행)이 있으나, BUIDL-like 토큰은 정부증권이 아니라 펀드지분(증권)이므로 이 면제에 해당하지 않는다는 점이다.

**PASS/FAIL 반영:** 조건부 — F-01 게이트가 직접 이 조문으로 PASS/FAIL을 내는 것은 아니다. 이 조문은 "Decipher = ATS"가 확정될 때 301(b)(10)(§3.5)을 발동시키는 스위치이며, 그때 F-01은 301(b)(10)(i)(B)의 이행 수단이 된다.

**ERC-3643 변환:** 조건부 결속 — Manifest의 `venueStatus = ATS`(외부자문으로 확정 시) 플래그가 참일 때 F-01의 법적 근거에 301(b)(10)이 추가됨을 표시. 게이트 로직 자체는 불변.

### 3.5 Reg ATS Rule 301(b)(10) — 주문정보 기밀·임직원 자기계좌 거래 통제 [출처: ecfr.gov]

**핵심 원문:** *Written procedures to ensure the confidential treatment of trading information.* (i) The alternative trading system shall establish adequate written safeguards and written procedures to protect subscribers' confidential trading information. Such written safeguards and written procedures shall include: (A) Limiting access to the confidential trading information of subscribers to those employees of the alternative trading system who are operating the system or responsible for its compliance with these or any other applicable rules; (B) Implementing standards controlling employees of the alternative trading system trading for their own accounts; and (ii) The alternative trading system shall adopt and implement adequate written oversight procedures to ensure that the written safeguards and procedures established pursuant to paragraph (b)(10)(i) of this section are followed.

**한국어:** (거래정보의 기밀 취급을 보장하기 위한 서면 절차.) (i) ATS는 subscriber의 기밀 거래정보를 보호하기 위한 적정한 서면 안전장치와 서면 절차를 수립하여야 한다. 그러한 서면 안전장치와 서면 절차는 다음을 포함하여야 한다 — (A) subscriber의 기밀 거래정보에 대한 접근을, 그 시스템을 운영하거나 이 규칙 또는 기타 적용 규칙의 준수를 담당하는 ATS 직원으로 한정할 것; (B) ATS 직원이 자기 계좌로 거래하는 것을 통제하는 기준을 시행할 것; 그리고 (ii) ATS는 (b)(10)(i)에 따라 수립된 서면 안전장치와 절차가 준수되도록 하기 위한 적정한 서면 감독 절차를 채택·시행하여야 한다.

**쉬운 설명:** ATS 해당 시 F-01의 직접 법정 대응물이다. 이 조항이 겨누는 위험이 정확히 F-01의 표적과 같다 — (A)는 "주문흐름 정보를 아무나 보지 못하게 하라", (B)는 "그 정보에 접근하는 직원이 자기 계좌로 거래하는 것을 통제하라"이다. 전통적 ATS는 이 의무를 사내 정보장벽(information barrier)·거래 사전승인·감시 같은 서면 절차로 이행한다. Decipher의 F-01은 그 의무의 최강 형태를 코드로 이행한다 — "통제(controlling)"를 넘어 운영자·임직원·계열의 온체인 거래를 아예 전면 차단(canTransfer=false)함으로써, (B)가 요구하는 통제 기준을 사람의 재량 없이 결정론적으로 강제한다. 규칙이 요구하는 최소치는 "통제 기준을 둘 것"이고 F-01은 그보다 강한 "완전 차단"을 택한 셈이다.

**PASS/FAIL 반영:** 조건부(핵심) — Decipher가 ATS면 이 조항이 F-01의 직접 근거가 되고, F-01의 FAIL(제한대상 당사자 차단)은 (i)(B)의 이행 그 자체다. ATS가 아니어도 F-01은 §10(b)/§17(a)로 이미 정당화되므로, 이 조항은 "있으면 F-01이 규칙 준수의 최강 이행이 되고, 없어도 F-01은 반사기 예방으로 유효"한 관계다.

**ERC-3643 변환:** claim이 아닌 module 이행 — `RestrictedOperatorModule`가 (i)(B)의 "controlling employees trading for their own accounts"를 온체인으로 구현. off-chain 감독 절차((ii))는 §11 Operator Layer(명부 등록·감사)가 담당.

### 3.6 Exchange Act §15(c)(1) · Rule 10b-3 — broker-dealer 반사기 [출처: uscode.house.gov · ecfr.gov]

**핵심 원문 (§15(c)(1)(A)):** No broker or dealer shall make use of the mails or any means or instrumentality of interstate commerce to effect any transaction in, or to induce or attempt to induce the purchase or sale of, any security (other than commercial paper, bankers' acceptances, or commercial bills), or any security-based swap agreement by means of any manipulative, deceptive, or other fraudulent device or contrivance.

**핵심 원문 (Rule 10b-3(a) 발췌):** It shall be unlawful for any broker or dealer ... to use or employ, in connection with the purchase or sale of any security otherwise than on a national securities exchange, any act, practice, or course of business defined by the Commission to be included within the term "manipulative, deceptive, or other fraudulent device or contrivance", as such term is used in section 15(c)(1) of the act.

**한국어 (§15(c)(1)(A)):** 어떠한 broker 또는 dealer도, 우편이나 주간통상의 수단·설비를 사용하여, 증권(commercial paper·bankers' acceptances·commercial bills 제외) 또는 security-based swap agreement의 매매를 성사시키거나 그 매수·매도를 유인 또는 유인하려 시도함에 있어, 조작적·기망적 또는 그 밖의 사기적 장치나 술책(manipulative, deceptive, or other fraudulent device or contrivance)을 수단으로 하여서는 아니 된다.

**쉬운 설명:** broker-dealer에 특화된 반사기 조문이다. §10(b)가 "any person"이라면 §15(c)(1)은 broker/dealer를 직접 겨눈다. 현행판(Dodd-Frank 이후)은 과거의 "전국증권거래소 회원으로서의 거래 외에서(otherwise than on a national securities exchange)"라는 한정이 (c)(1)(A)에서 삭제되어, broker/dealer의 사실상 모든 거래에 적용된다. BD/ATS 의견서의 결론대로 Decipher가 broker에 해당하면, 운영자의 자기거래는 §15(c)(1)에 정면으로 걸린다. Rule 10b-3은 그 실행규칙이다. 이 근거는 broker 지위가 확정될 때 §10(b)/10b-5 위에 한 겹 더 얹히는 관계다.

**PASS/FAIL 반영:** 조건부 — Decipher가 broker면 운영자 자기거래에 직접 적용되어 F-01의 봉쇄 근거를 강화한다. broker가 아니어도 §10(b)로 이미 커버되므로, §15(c)는 지위 확정 시의 조건부 보강이다.

**ERC-3643 변환:** 조건부 결속 — `venueStatus ∈ {BROKER, ATS}`일 때 F-01 근거에 §15(c)(1)·Rule 10b-3 추가. 게이트 로직 불변, 근거 두께만 증가.

### 3.7 Rule 405 — affiliate·control 정의 (제한대상 범위) [출처: ecfr.gov]

**핵심 원문 (Affiliate):** An affiliate of, or person affiliated with, a specified person, is a person that directly, or indirectly through one or more intermediaries, controls or is controlled by, or is under common control with, the person specified.

**핵심 원문 (Control):** The term control (including the terms controlling, controlled by and under common control with) means the possession, direct or indirect, of the power to direct or cause the direction of the management and policies of a person, whether through the ownership of voting securities, by contract, or otherwise.

**한국어 (Affiliate):** 특정인의 affiliate(또는 특정인과 affiliated된 자)란, 직접 또는 하나 이상의 매개체를 통하여 간접으로, 그 특정인을 지배하거나(controls), 그 특정인에 의하여 지배되거나(is controlled by), 그 특정인과 공통의 지배 아래 있는(is under common control with) 자를 말한다.

**한국어 (Control):** control(controlling·controlled by·under common control with 포함)이란, 의결권 증권의 소유, 계약, 또는 그 밖의 방법을 통하든, 어떤 자의 경영과 정책의 방향을 지시하거나 지시하도록 할 수 있는 직접 또는 간접의 권한(power)의 보유를 말한다.

**쉬운 설명:** F-01의 제한대상 집합에서 "계열(affiliate)"이 무엇인지를 확정하는 정의다. 제한대상은 세 층이다 — (1) Decipher 법인 자체, (2) Decipher의 affiliate(Rule 405 control 기준: Decipher를 지배하거나, Decipher에 지배되거나, Decipher와 공통지배 관계인 자 — 예: 같은 지주 아래 거래 데스크), (3) Decipher의 임원·이사·직원(그리고 이들이 지배하는 계좌). 핵심은 control이 지분율 같은 밝은 선(bright line)이 아니라 "경영·정책 방향을 지시할 권한"이라는 기능적 개념이라는 점이다 — 이는 A-06(내부자 판정)이 지분 문턱을 금지하고 기능적 control을 쓰는 것과 같은 규율이며, 그래서 F-01의 계열 판정은 A-06의 결과를 공유한다. 참고로 Exchange Act Rule 12b-2(17 CFR 240.12b-2)의 affiliate·control 정의도 실질적으로 동일하다. Decipher가 broker면, 임직원 층은 Exchange Act §3(a)(18)의 "associated person of a broker or dealer"(partner·officer·director·employee 및 control 관계자를 포함) 개념으로도 포착되어, 세 층을 하나의 법정 정의로 묶을 수 있다.

**PASS/FAIL 반영:** 보조 — F-01 게이트의 봉쇄 조건 자체는 "당사자가 제한대상 명부에 있는가"이고, 이 조문은 그 명부에 누구를 올릴지(계열 범위)를 결정한다. 판정 규칙이 아니라 판정 대상 집합의 정의.

**ERC-3643 변환:** 명부 구성 근거 — `restrictedOperatorSet`의 원소 태그를 정의: `OPERATOR_ENTITY`(Decipher 법인), `OPERATOR_AFFILIATE`(Rule 405 control), `OPERATOR_ASSOCIATED_PERSON`(임원·이사·직원, §3(a)(18)), `OPERATOR_CONTROLLED_ACCOUNT`(이들이 지배하는 계좌). control 판정 자체는 off-chain(A-06 공유), 결과만 온체인 명부에 반영.

### 3.8 Exchange Act §9(a)(1) — wash sale·matched order 금지 [출처: uscode.house.gov]

**핵심 원문:** It shall be unlawful for any person, directly or indirectly, by the use of the mails or any means or instrumentality of interstate commerce, or of any facility of any national securities exchange, or for any member of a national securities exchange— (1) For the purpose of creating a false or misleading appearance of active trading in any security other than a government security, or a false or misleading appearance with respect to the market for any such security, (A) to effect any transaction in such security which involves no change in the beneficial ownership thereof, or (B) to enter an order or orders for the purchase of such security with the knowledge that an order or orders of substantially the same size, at substantially the same time, and at substantially the same price, for the sale of any such security, has been or will be entered by or for the same or different parties, or (C) to enter any order or orders for the sale of any such security with the knowledge that an order or orders of substantially the same size, at substantially the same time, and at substantially the same price, for the purchase of such security, has been or will be entered by or for the same or different parties.

**한국어:** 모든 자가 직접·간접으로 우편·주간통상 수단·전국증권거래소 설비를 사용하여, 또는 전국증권거래소 회원이 다음을 행하는 것은 위법이다 — (1) 정부증권이 아닌 어떤 증권의 활발한 거래에 관한 허위 또는 오해를 일으키는 외관, 또는 그 증권의 시장에 관한 허위·오해 외관을 만들 목적으로, (A) 그 증권에서 실질적 소유권의 변동을 수반하지 아니하는 거래를 성사시키거나, (B) 동일 또는 상이한 당사자에 의하여/위하여 실질적으로 같은 규모·같은 시점·같은 가격의 매도 주문이 이미 제출되었거나 제출될 것임을 알면서 그 증권의 매수 주문을 제출하거나, (C) 반대로 같은 조건의 매수 주문이 제출되었거나 제출될 것임을 알면서 매도 주문을 제출하는 것.

**쉬운 설명:** 시세조작 금지 조문 중 wash sale(A: 실질 소유권 변동 없는 거래)과 matched order(B·C: 짜고 치는 대칭 주문)를 다룬다. 운영자 자기거래는 여기에도 닿는다 — 운영자가 자기 통제 계좌들 사이에서 거래하면 실질 소유권 변동 없는 가장매매가 되어 활발한 거래라는 허위 외관을 만들 수 있고, 이는 시장에 잘못된 신호를 준다. 다만 이 패턴의 실제 탐지는 F-02(시장행위 감시)의 STATEFUL 소관이다. F-01에서 §9(a)(1)은 "왜 운영자가 자기 시장에서 거래하면 안 되는가"의 보조 근거로만 인용한다 — 운영자 차단은 가장매매의 한 원천을 사전에 없앤다. 참고로 §9(g)는 "subsection (a)는 면제증권에 적용되지 않는다"고 하는데, BUIDL-like 토큰은 면제증권이 아니므로 §9(a)가 적용된다.

**PASS/FAIL 반영:** 보조 — F-01의 봉쇄 대상(운영자 자기거래)이 만들 수 있는 부작용(가장매매)의 근거. 단독 판정 근거는 아니며, F-01↔F-02 연계(§9.2)의 법적 접점.

**ERC-3643 변환:** 연계 근거 — F-01이 사전 차단한 운영자 거래가 만들 수 있는 wash/matched 패턴을 F-02가 사후 감시. F-01 게이트 통과분에 대해 F-02 flag 로직이 §9(a)(1)을 적용.

### 3.9 ICA §17(a) · §3(c)(7) · §2(a)(3) — 부적용(Negative Finding) [출처: uscode.house.gov]

**핵심 원문 (§17(a) chapeau·(1)·(2) 발췌):** It shall be unlawful for any affiliated person or promoter of or principal underwriter for a registered investment company (other than a company of the character described in section 80a-12(d)(3)(A) and (B) of this title), or any affiliated person of such a person, promoter, or principal underwriter, acting as principal— (1) knowingly to sell any security or other property to such registered company or to any company controlled by such registered company, unless such sale involves solely (A) securities of which the buyer is the issuer, (B) securities of which the seller is the issuer and which are part of a general offering to the holders of a class of its securities, or (C) securities deposited with the trustee of a unit investment trust or periodic payment plan by the depositor thereof; (2) knowingly to purchase from such registered company, or from any company controlled by such registered company, any security or other property (except securities of which the seller is the issuer)...

**핵심 원문 (§3(c) chapeau):** Notwithstanding subsection (a), none of the following persons is an investment company within the meaning of this subchapter: ... (§3(c)(7))

**한국어 (§17(a)):** 등록 투자회사(registered investment company)의 affiliated person·발기인·principal underwriter, 또는 그러한 자의 affiliated person이 본인(principal)으로서 다음을 행하는 것은 위법이다 — (1) 알면서 그 등록회사(또는 그 지배회사)에 증권·재산을 매도하는 것(일정 예외 제외), (2) 알면서 그 등록회사(또는 그 지배회사)로부터 증권·재산을 매수하는 것(매도인이 발행자인 증권 제외) 등.

**한국어 (§3(c) chapeau):** subsection (a)에도 불구하고, 다음의 자 중 누구도 이 subchapter의 의미상 투자회사(investment company)에 해당하지 아니한다 — (§3(c)(7): 발행증권을 전원 qualified purchaser가 취득하고 public offering을 하지 않는 회사).

**쉬운 설명:** 이것이 본 부품의 잠금 결론(locked finding)이다. 자기거래를 다룬다고 하면 얼핏 ICA §17(등록 투자회사 관계자의 자기거래 금지)을 떠올리기 쉽다 — §17이야말로 미국 펀드법의 자기거래 금지 총본산이기 때문이다. 그러나 F-01은 §17에서 나오지 않는다. 두 겹의 이유가 있다. 첫째, §17(a)의 주어는 "registered investment company의 affiliated person"인데, BUIDL-like 펀드는 §3(c)(7)에 따라 애초에 "투자회사에 해당하지 아니한다(§3(c) chapeau)" — 즉 등록 투자회사가 아니므로 §17이라는 실체규정 자체가 닿지 않는다. 둘째, 설령 그 문턱을 논외로 해도, Decipher(거래장 운영자)는 §2(a)(3) 의미의 그 펀드 affiliated person이 아니다 — §2(a)(3)의 affiliated person은 투자자문사, 의결권 5% 이상 소유자, 펀드가 5% 이상 소유한 자, 펀드를 지배·피지배·공통지배하는 자 등인데, 2차 시장을 운영한다는 사실만으로는 이 중 어디에도 해당하지 않는다. 따라서 F-01의 법적 뿌리는 반사기(§10(b)/10b-5·§17(a) Securities Act)와 Reg ATS이지, ICA §17이 아니다. 이 구분을 흐리면 "펀드 관계자 자기거래" 프레임으로 오귀속되어, 근거 조문도 적용 요건도 어긋난다.

**PASS/FAIL 반영:** 배경(부적용) — F-01은 이 조문으로 판정하지 않는다. 오히려 "이 조문이 F-01의 근거가 아님"을 확정하는 것이 본 절의 역할이다. 향후 세션·문서에서 F-01을 ICA §17로 재프레임하지 말 것.

**ERC-3643 변환:** 해당 없음(근거 배제 표시) — F-01의 module reason·claim.basis 어디에도 ICA_17 태그를 쓰지 않는다. 펀드 지위(§3(c)(7))는 A-13/D-01 소관이며 F-01과 무관.

### 3.10 Layer 3 — 채택 취지·집행선 (해석 자료)

**Reg ATS 채택.** Regulation ATS는 63 FR 70921(1998-12-22)로 채택되었다(eCFR source note로 확인). 채택 취지문서(Rel. No. 34-40760)는 301(b)(10)의 기밀·자기계좌 통제 요건이 "ATS 운영자가 subscriber의 주문정보를 이용해 부당한 이익을 얻지 못하도록" 설계되었음을 밝힌다 — F-01의 예방 설계와 직접 맞닿는 취지다.

**다크풀·거래장 운영자 집행선.** 2010년대 미국 SEC는 여러 다크풀·ATS 운영자에 대해, (a) 운영자의 관계 거래 데스크가 subscriber 반대편에서 거래한 점, (b) 풀 안에 누가 참여하는지·운영자가 거래하는지를 제대로 알리지 않은 점을 §17(a)·§10(b)/10b-5·Reg ATS 위반으로 제재해 왔다. 이 집행선은 F-01이 겨누는 위험이 이론이 아니라 실제 집행 대상임을 보여준다. 다만 개별 사건의 정확한 release 번호·인용은 본 문서에서 확정하지 않고 외부 전문 자문(§12)으로 넘긴다 — 1차 출처(sec.gov) 검증을 거친 pinpoint 인용만 최종본에 넣는다는 프로젝트 원칙 때문이다.

**PASS/FAIL 반영:** 보조 — 판정에 쓰지 않는다. 설계 취지·리스크의 해석 자료.

**ERC-3643 변환:** 해당 없음.

### 3.11 Sub-요건 분해 매트릭스

위 근거들이 겨누는 하나의 금지("운영자 측은 자기 시장에서 거래하지 않는다")를 더 못 쪼개는 원자적 검증 단위로 분해하면 아래와 같다. 각 행은 §5.2 pseudocode의 분기와 1:1로 대응한다. F-01은 게이트형이므로 단위 대부분이 명부 대조(boolean)이며, 확률적·재량적 판단은 없다(그 판단은 off-chain A-06에서 끝나고 결과만 명부로 온다).

| 검증단위 | 무엇을 보나 | 통과조건(다음 단계로) | 불통과시 | §5.2 분기 |
| --- | --- | --- | --- | --- |
| U1 당사자 존재 | from·to가 유효한 거래 주소·ONCHAINID로 해석되는가 | 둘 다 유효 | REVERT(무효 당사자, 상류 A-04 소관) | step 1 |
| U2 명부 로드 | restrictedOperatorSet 레지스트리를 읽을 수 있는가 | 로드 성공 | FAIL-SAFE(로드 실패 시 보수적으로 차단) | step 2 |
| U3 from 제한대상 | from의 ONCHAINID가 제한대상 명부에 있는가 | 없음 → U5로 | 있음 → U4(예외판정)로 | step 3 |
| U4 to 제한대상 | to의 ONCHAINID가 제한대상 명부에 있는가 | 없음이고 U3도 없음 → PASS | 있음 → U6(예외판정)로 | step 4 |
| U5 정상 통과 | U3·U4 모두 제한대상 아님 | — | — | step 5 → PASS |
| U6 예외 판정 | 제한대상이 낀 거래가 허용 예외인가 — ① 발행자 1차 배포(primary distribution) ② forcedTransfer/recovery(강제·회수) | 예외 성립 → PASS(예외) | 예외 아님 → FAIL | step 6 |

**세 가지 경계 판단(개발자 필수 확정).**

- **양쪽 다 제한대상인 경우.** from·to가 모두 운영자 측이면(예: 운영자 내부 이동) 예외(발행·강제이전)에 해당하지 않는 한 FAIL이다. F-01은 "한쪽만 제한대상"과 "양쪽 제한대상"을 구분하지 않고, 예외 경로가 아닌 한 모두 차단한다.

- **발행자 1차 배포 예외의 범위.** Decipher 운영자가 발행자(issuer) 또는 그 transfer agent 역할까지 겸하는 구조인지에 따라 예외 경계가 달라진다. 최초 발행 배포(issuer → 최초 투자자)는 2차 시장 매칭이 아니므로 F-01의 자기거래 우려 밖일 수 있으나, 이 예외는 Manifest에 명시된 primary-distribution 경로에 한정하고 보수적으로 좁게 잡는다(§6.3 ①·§12).

- **강제이전·회수 예외.** forcedTransfer/recovery(분실 지갑 복구·규제 명령 이행 등)는 운영자가 기술적 주체가 되지만 자발적 자기거래가 아니다. 이 경로는 별도 권한·기록으로 통제하며 F-01 차단에서 제외한다(§6.3 ②).

### 3.12 ERC-3643 변환·명부 태그 총정리

F-01은 증명서형(claim)이 아니라 negative screen(module)이므로, A-13식 claim.basis 6종 체계를 쓰지 않는다. 대신 A-01(제재)과 동형으로 compliance module + 제한대상 레지스트리로 구현한다. 아래가 §3.1~§3.9의 근거를 ERC-3643/T-REX 필드로 옮긴 총정리다.

| 근거(§3.X) | ERC-3643/T-REX 구현 | 구체 값·필드 |
| --- | --- | --- |
| §3.1 §10(b) / §3.2 10b-5 / §3.3 §17(a) | compliance module 게이트(무조건) | `RestrictedOperatorModule.canTransfer(from,to)` → false 시 revert |
| §3.5 Reg ATS 301(b)(10) (조건부) | 동 module이 (i)(B) "임직원 자기계좌 거래 통제"를 온체인 이행 | `venueStatus=ATS`일 때 근거 태그 추가; 로직 불변 |
| §3.6 §15(c)(1)·10b-3 (조건부) | 동 module 근거 강화 | `venueStatus∈{BROKER,ATS}`일 때 태그 추가 |
| §3.7 Rule 405 affiliate·control | 제한대상 명부 원소 태그 정의 | `restrictedOperatorSet` 원소: `OPERATOR_ENTITY`·`OPERATOR_AFFILIATE`·`OPERATOR_ASSOCIATED_PERSON`·`OPERATOR_CONTROLLED_ACCOUNT` |
| §3.8 §9(a)(1) wash/matched | F-02 연계 flag 근거 | F-01 통과분에 대한 F-02의 사후 패턴 감시 |
| §3.9 ICA §17 (부적용) | 태그 없음(배제 명시) | `ICA_17` 태그 사용 금지 |
| 신원 단위 | ONCHAINID 기준 판정 | 지갑이 아니라 사람(ONCHAINID) 단위; 다지갑 위장은 A-04가 차단 |
| 예외 | forcedTransfer/recovery·primary는 별도 경로 | `OP_EXEMPT_PRIMARY`·`OP_EXEMPT_INVOLUNTARY` reason으로 PASS |
| 감시 방식 | pre-trade STATELESS 게이트 | 거래는 명부 읽기만; 명부 쓰기는 운영 트랜잭션(§11) |

**module vs claim 요약.** F-01은 매수인에게 "너는 적격이다"라는 긍정 claim을 요구하지 않는다. 대신 "너는 운영자 측이 아니다"를 명부 대조로 확인하는 부정 스크린이다. 그래서 Trusted Issuer의 서명 증명서(A-13·A-03의 패턴 B)가 아니라, Decipher 거버넌스가 관리하는 제한대상 레지스트리와 그것을 읽는 compliance module로 구현된다 — 구조적으로 A-01(제재 명단)과 같은 계열이다.

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

F-01은 매수인의 자산·자격을 계산하지 않는다. 오직 두 가지만 필요하다 — (1) 이 거래의 당사자가 누구인지(from·to의 ONCHAINID), (2) 그 당사자가 제한대상 명부에 있는지. 자격 증명서도, 신선도도, 금액도 보지 않는다. 그래서 입력은 A-13보다 훨씬 얇지만, 대신 제한대상 명부 자체의 정확성·최신성이 판정의 전부를 좌우한다 — 명부에 빠진 계열이 있으면 게이트가 뚫리고, 잘못 올라간 정상 참여자가 있으면 정당한 거래가 막힌다. 따라서 F-01의 "증거 품질"은 명부 거버넌스(§11)에 달려 있다.

### 4.2 Data field — DEX가 실제로 읽는 항목

| 필드 | 출처 | 용도 |
| --- | --- | --- |
| `transfer.from` / `transfer.to` | 거래 요청(ERC-3643 transfer) | 당사자 지갑 주소 |
| `onchainId(from)` / `onchainId(to)` | Identity Registry(A-04) | 지갑 → 사람(ONCHAINID) 매핑; 다지갑 위장 방지 |
| `restrictedOperatorSet` | 제한대상 레지스트리(Decipher 거버넌스) | ONCHAINID → 제한대상 여부·태그 |
| `operatorRole` | 제한대상 레지스트리 원소 태그 | ENTITY·AFFILIATE·ASSOCIATED_PERSON·CONTROLLED_ACCOUNT |
| `transferType` | Manifest·거래 컨텍스트 | primary(1차 배포)·secondary(2차)·involuntary(강제·회수) 구분 |
| `venueStatus` | Manifest(외부자문 확정 시) | 근거 태그(반사기만 / +Reg ATS / +§15(c)) 결정 — 로직 불변 |

### 4.3 수집 경로 — 3단계 흐름

1. **당사자 해석.** 거래 요청의 from·to 지갑을 Identity Registry(A-04)로 조회해 각각의 ONCHAINID를 얻는다. 지갑이 ONCHAINID에 연결돼 있지 않으면 상류(A-04)에서 이미 걸러진다.
2. **제한대상 대조.** 두 ONCHAINID를 restrictedOperatorSet에 대조한다. 이 명부는 Decipher 거버넌스가 off-chain에서 확정한 제한대상(법인·계열·임직원)을 온체인 레지스트리에 반영한 것이다(§11).
3. **거래유형 확인.** 제한대상이 낀 경우에 한해, transferType으로 예외(primary·involuntary)인지 확인한다. 예외가 아니면 차단한다.

### 4.4 필수 확인 항목 전체 표

아래는 F-01 판정에서 반드시 확인하는 항목의 전체 목록이다(예시가 아니라 필수 항목). 공통 항목은 모든 거래에, 조건부 항목은 제한대상이 낀 경우에만 확인한다.

| 구분 | 확인 항목 | 필수/조건부 | 실패시 |
| --- | --- | --- | --- |
| 공통 | from·to의 ONCHAINID 해석 성공 | 필수 | REVERT(A-04 상류) |
| 공통 | restrictedOperatorSet 로드 성공 | 필수 | FAIL-SAFE(보수적 차단) |
| 공통 | from ∈ 제한대상 여부 | 필수 | 해당시 예외판정으로 |
| 공통 | to ∈ 제한대상 여부 | 필수 | 해당시 예외판정으로 |
| 조건부 | transferType = primary(발행자 1차 배포)인가 | 제한대상 낀 경우 | 아니면 다음 예외 확인 |
| 조건부 | transferType = involuntary(forcedTransfer/recovery)인가 | 제한대상 낀 경우 | 아니면 FAIL |
| 조건부(근거) | venueStatus(ATS·BROKER) — 근거 태그용 | 확정 시 | 로직 불변, 태그만 |

---

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.0 판정 흐름 플로우차트

아래 그림은 F-01의 런타임 판정 흐름이다 — 거래 요청 → 명부 로드 → from 제한대상? → to 제한대상? → (제한대상이 끼면) 예외 경로? → PASS / PASS(예외) / FAIL.

![런타임 판정 흐름](fig50.png)

### 5.1 전체 흐름 (사람 말로)

거래 하나가 들어오면 F-01은 이렇게 판단한다. 먼저 매도인(from)과 매수인(to)이 각각 누구인지를 ONCHAINID로 확정한다. 그다음 두 사람을 제한대상 명부에 대조한다. 둘 다 명부에 없으면 — 즉 운영자 측이 낀 거래가 아니면 — 그냥 통과시킨다. 둘 중 하나라도 명부에 있으면, 그 거래가 허용된 예외인지 본다. 예외는 딱 둘이다: 발행자가 최초 투자자에게 배포하는 1차 배포거나, 분실 복구·규제 명령 같은 강제·회수 이전이거나. 이 둘 중 하나면 통과(예외)시키고, 그것도 아니면 막는다(revert). 자격도 금액도 보지 않는다 — 오직 "운영자 측이 자발적으로 2차 거래의 당사자가 되려 하는가"만 본다.

### 5.2 Pseudocode + 단계별 해설

```
function F01_check(transfer):
# step 1 — 당사자 존재·해석
idFrom = IdentityRegistry.onchainId(transfer.from) # A-04
idTo = IdentityRegistry.onchainId(transfer.to)
if idFrom == NULL or idTo == NULL:
REVERT("IDENTITY_UNRESOLVED") # 상류(A-04) 소관

# step 2 — 명부 로드 (fail-safe)
reg = load(restrictedOperatorSet)
if reg == UNAVAILABLE:
return FAIL("OP_REGISTRY_UNAVAILABLE") # 보수적 차단

# step 3~4 — 제한대상 대조
fromRestricted = reg.contains(idFrom)
toRestricted = reg.contains(idTo)

# step 5 — 정상 통과
if not fromRestricted and not toRestricted:
return PASS("OP_CLEAR")

# step 6 — 예외 판정 (제한대상이 낀 경우)
if transfer.transferType == PRIMARY_DISTRIBUTION and Manifest.allowsPrimary(idFrom, idTo):
return PASS("OP_EXEMPT_PRIMARY")
if transfer.transferType == INVOLUNTARY: # forcedTransfer/recovery
return PASS("OP_EXEMPT_INVOLUNTARY")

# 예외 아님 → 차단
return FAIL("OP_SELF_DEALING_BLOCKED")
```

**해설.**

- **step 1.** 판정 단위는 지갑이 아니라 ONCHAINID다. 운영자가 새 지갑을 만들어 우회하려 해도 그 지갑이 운영자의 ONCHAINID에 묶이면 명부에 걸린다 — 이 "지갑↔사람" 확정은 A-04가 담당하고 F-01은 그 결과를 소비한다. 지갑이 어떤 ONCHAINID에도 안 묶여 있으면 애초에 A-04가 거래를 막는다.

- **step 2.** 명부를 읽지 못하면 통과가 아니라 차단이다(fail-safe). 반사기 예방이 목적이므로, 불확실할 때는 보수적으로 막는 게 옳다 — A-01(제재)의 fail-closed 원칙과 같다.

- **step 3~5.** 제한대상 대조는 boolean이다. 확률적 판단이 없다 — control 여부 같은 재량 판단은 off-chain(A-06)에서 이미 끝나 명부에 반영돼 있고, 온체인은 "명부에 있나 없나"만 본다. 둘 다 없으면 즉시 통과.

- **step 6.** 제한대상이 낀 경우에만 예외를 본다. 예외는 화이트리스트로 좁게 잡는다 — primary는 Manifest가 명시한 발행 배포 경로에 한정하고, involuntary는 강제이전·회수라는 비자발적 경로에 한정한다. 둘 다 아니면 차단이 기본값이다.

### 5.3 판정 매트릭스

| from 제한대상 | to 제한대상 | transferType | 결과 | reasonCode |
| --- | --- | --- | --- | --- |
| ✕ | ✕ | 무관 | PASS | OP_CLEAR |
| ○ | ✕ | secondary | FAIL | OP_SELF_DEALING_BLOCKED |
| ✕ | ○ | secondary | FAIL | OP_SELF_DEALING_BLOCKED |
| ○ | ○ | secondary | FAIL | OP_SELF_DEALING_BLOCKED |
| ○ 또는 ○ | (한쪽 이상) | primary(Manifest 허용) | PASS | OP_EXEMPT_PRIMARY |
| ○ 또는 ○ | (한쪽 이상) | involuntary | PASS | OP_EXEMPT_INVOLUNTARY |
| 명부 로드 실패 | — | 무관 | FAIL | OP_REGISTRY_UNAVAILABLE |

주의: 실패 부등식은 존재 여부의 boolean이라 초과/이상 문제가 없다. "제한대상 명부에 있으면(∈) 차단"이 기본이고, 예외 경로만이 그 차단을 해제한다.

### 5.4 Time-of-check — 어느 시점의 명부를 보나

F-01은 pre-trade 게이트이므로 "거래 체결 직전"의 restrictedOperatorSet 스냅샷을 본다. 명부에 방금 추가된 제한대상은 그 시점 이후 거래부터 차단되고, 방금 제거된 자는 이후 거래부터 허용된다. 명부 변경(추가·제거)은 거래가 아니라 운영 트랜잭션이므로 별도 권한·기록으로 통제된다(§11). 여기서 중요한 설계 원칙 하나 — 명부 갱신과 거래 판정 사이의 시차를 줄이려면 명부 변경이 즉시 온체인에 반영돼야 하며, off-chain에서 계열로 판정된 자가 아직 온체인 명부에 반영되지 않은 창(window)이 F-01의 유일한 구조적 취약점이다(§12).

### 5.5 게이트형의 본질 — 비결정성을 결정성으로

F-01의 본질은 "운영자 자기거래인가"라는 규범적·맥락적 질문을 "당사자가 명부에 있는가"라는 결정론적 boolean으로 환원한 데 있다. 규범적 부분(누가 계열인가, control이 있는가)은 off-chain에서 A-06이 판단해 명부에 반영하고, 온체인 F-01은 그 명부를 기계적으로 대조만 한다. 이 분리가 두 가지를 가능하게 한다 — (1) 온체인 판정이 가스·재량 없이 결정론적이고, (2) 규범 판단의 갱신(새 계열 추가 등)이 코드 재배포 없이 명부 갱신만으로 반영된다. 이는 A-01(제재: SDN 명단 대조)·A-04(신원: 레지스트리 대조)와 같은 게이트형 설계 철학이며, 증명서형(A-13·A-03)과 근본적으로 다른 계열이다.

---

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

F-01이 차단하면 거래는 체결되지 않고 revert된다. 매수인·매도인에게는 "이 거래는 진행할 수 없다"는 최소한의 사유만 노출하고, 왜(어느 당사자가 어떤 이유로 제한대상인지)는 내부 기록으로만 남긴다 — 제한대상 명부의 상세를 외부에 노출하면 우회에 악용될 수 있기 때문이다. 예외(발행 배포·강제이전)에 해당하면 차단 대신 예외 사유로 통과시키되, 그 예외 사용도 전부 기록한다.

### 6.2 Failure codes

| reasonCode | 언제 | 처리 | 노출 수준 |
| --- | --- | --- | --- |
| `OP_SELF_DEALING_BLOCKED` | 제한대상이 낀 2차 거래(예외 아님) | revert | 매수인엔 일반 사유만 |
| `OP_REGISTRY_UNAVAILABLE` | 제한대상 명부 로드 실패 | revert(fail-safe) | 매수인엔 일시 오류 |
| `IDENTITY_UNRESOLVED` | from·to의 ONCHAINID 미해석 | revert(A-04 상류) | A-04 메시지 |
| `OP_EXEMPT_PRIMARY` | 발행자 1차 배포(Manifest 허용) | PASS(예외) | 정상 처리, 내부 기록 |
| `OP_EXEMPT_INVOLUNTARY` | forcedTransfer/recovery | PASS(예외) | 정상 처리, 내부 기록 |

### 6.3 예외 처리 경로

F-01의 예외는 딱 두 가지이며, 둘 다 좁게·명시적으로 통제한다.

- **① 발행자 1차 배포(primary distribution).** 발행자(또는 Manifest가 지정한 primary 경로)가 최초 투자자에게 토큰을 배포하는 것은 2차 시장 매칭이 아니므로 운영자 자기거래 우려 밖일 수 있다. 다만 Decipher 운영자가 발행자·transfer agent 역할을 겸하는 구조라면 이 예외의 경계가 미묘해진다 — 그래서 예외는 Manifest에 명시된 primary-distribution 경로(발행자 주소 → whitelist 투자자)로만 한정하고, 그 밖의 운영자 관여 거래에는 열어주지 않는다. 이 예외의 범위 확정은 발행 아키텍처 확정 후 재검토 대상이다(§12).

- **② 강제이전·회수(involuntary — forcedTransfer/recovery).** 분실 지갑 복구, 사망·상속 이전, 규제 명령 이행 등 비자발적 이전에서는 운영자가 기술적 주체가 되지만 이는 자발적 자기거래가 아니다. 이 경로는 별도의 상위 권한(멀티시그·time-lock)과 사유·서명·타임스탬프 기록으로 통제하며, F-01 차단에서 제외한다. A-04·B-03이 규율하는 forcedTransfer/recovery 권한 체계와 정합해야 한다.

### 6.4 Error message — 매수인 노출용 vs 내부 기록용 분리

| 상황 | 매수인 노출 메시지 | 내부 기록(감사) |
| --- | --- | --- |
| 제한대상 차단 | "이 거래는 현재 진행할 수 없습니다." | 어느 당사자(ONCHAINID)가 어떤 태그(ENTITY/AFFILIATE/…)로 차단됐는지, 명부 버전, 타임스탬프 |
| 명부 로드 실패 | "일시적 오류로 거래를 처리할 수 없습니다. 잠시 후 다시 시도하세요." | 로드 실패 원인, fail-safe 발동 기록 |
| 예외 통과 | (정상 처리) | 예외 유형(primary/involuntary), 승인 권한자, 사유, 타임스탬프 |

원칙 — 제한대상 명부의 구성(누가 운영자 계열인지)은 우회 악용을 막기 위해 매수인에게 노출하지 않는다. 동시에 모든 차단·예외는 내부적으로 완전히 기록해, 사후에 "왜 이 거래가 막혔나/허용됐나"를 재구성할 수 있게 한다. 이 기록은 BD/ATS 해당 시 Reg ATS 301(b)(10)(ii)의 감독 절차·기록 요구와도 연결된다.

---

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

### 7.1 Test 1 — Pass (정상 통과)

- **상황:** whitelist 투자자 A(매도) → whitelist 투자자 B(매수). 둘 다 제한대상 명부에 없음. 2차 거래.
- **입력:** onchainId(A), onchainId(B) 모두 restrictedOperatorSet에 부재.
- **기대:** PASS(OP_CLEAR). from·to 모두 제한대상 아님 → step 5에서 통과.

### 7.2 Test 2 — Fail (운영자 법인이 당사자)

- **상황:** Decipher 법인 계정이 자기 계정으로 BUIDL-like 토큰을 매수. 2차 거래.
- **입력:** onchainId(Decipher법인)에 태그 OPERATOR_ENTITY, restrictedOperatorSet에 존재.
- **기대:** FAIL(OP_SELF_DEALING_BLOCKED). to가 제한대상 → step 6 예외판정 → primary·involuntary 아님 → 차단. 매수인 노출은 일반 사유, 내부엔 ENTITY 태그 기록.

### 7.3 Test 3 — Fail (계열사가 반대편)

- **상황:** Decipher와 공통지배 관계인 거래 데스크(자매회사)가 subscriber 주문 반대편에서 매도. A-06이 control 관계를 확인해 명부에 반영해 둠.
- **입력:** onchainId(자매회사)에 태그 OPERATOR_AFFILIATE(Rule 405 control), 명부에 존재.
- **기대:** FAIL(OP_SELF_DEALING_BLOCKED). from이 제한대상 → 예외 아님 → 차단. 계열 판정은 off-chain(A-06)에서 이미 끝났고 온체인은 명부 대조만 함.

### 7.4 Test 4 — Boundary (예외: 발행자 1차 배포)

- **상황:** 발행자 주소가 Manifest 지정 primary 경로로 whitelist 최초 투자자에게 배포. 발행자가 운영자 계열과 겹쳐 명부에 있는 경우.
- **입력:** transferType=PRIMARY_DISTRIBUTION, Manifest.allowsPrimary(발행자, 투자자)=true.
- **기대:** PASS(OP_EXEMPT_PRIMARY). 제한대상이 끼었지만 primary 예외 성립 → 통과. 예외 사용은 내부 기록. (경계 주의: 같은 발행자가 2차 매칭에 당사자로 들어오면 예외 아님 → 차단.)

### 7.5 Test 5 — 우회 시도 (운영자의 새 지갑)

- **상황:** 운영자 임직원이 명부에 없는 새 지갑을 만들어 거래 시도. 그러나 그 지갑은 KYC상 임직원의 ONCHAINID에 연결됨.
- **입력:** 새 지갑 → onchainId(임직원)로 해석(A-04), 그 ONCHAINID에 태그 OPERATOR_ASSOCIATED_PERSON, 명부에 존재.
- **기대:** FAIL(OP_SELF_DEALING_BLOCKED). 판정 단위가 지갑이 아니라 ONCHAINID이므로 새 지갑 우회가 무력화됨. (만약 임직원이 KYC 없는 익명 지갑을 쓰면 A-04가 상류에서 차단 — F-01 이전에 걸림.)

---

## §8. (α) 게이트형(negative screen) 패턴 — 왜 이 방식인가

### 8.1 Decipher의 검증 방식 3패턴

Decipher는 부품을 세 패턴으로 구현한다 — (A) 기계 판정형(결정론적 계산·명단 대조), (B) 증명서형(off-chain 실사 + 서명 claim 확인, 예: A-13·A-03), (C) 감시형(사후 flag + 운영 판단, 예: F-02·F-03). F-01은 (A) 중에서도 negative screen 게이트로, A-01(제재)과 같은 계열이다.

### 8.2 F-01에 게이트형이 유일한 선택인 이유

F-01에 증명서형(B)은 맞지 않는다. B는 "이 사람이 어떤 자격을 갖췄음"을 신뢰기관이 서명해 확인하는 구조인데, F-01이 확인하려는 것은 자격의 유무가 아니라 "이 사람이 운영자 측인가"라는 부정 사실이다. 운영자 측 여부는 Decipher 자신이 가장 잘 아는 정보이지 제3자 Trusted Issuer가 증명할 대상이 아니다. 또 감시형(C)도 부적절하다 — 운영자 자기거래는 사후에 flag만 달고 넘어갈 성질이 아니라, 반사기 위반의 전제를 사전에 원천 차단해야 하는 hard block이기 때문이다. 따라서 "Decipher가 관리하는 제한대상 명부를 pre-trade에 대조해 즉시 차단"하는 게이트형이 유일하게 들어맞는다. 이는 제재(A-01)가 SDN 명단을 대조해 즉시 차단하는 것과 구조가 동일하다.

### 8.3 게이트형의 법적 토대 — 반사기 예방 + fail-safe

게이트형의 정당성은 두 가지에서 나온다. 첫째, 예방 원리 — F-01은 위반을 사후 적발하는 게 아니라 위반의 사실적 전제(운영자가 당사자가 됨)를 사전에 없앤다. 반사기(§10(b)/10b-5·§17(a))는 위반이 성립한 뒤의 제재이지만, F-01은 그 성립 자체를 막는 prophylactic 설계다. Reg ATS 301(b)(10)(i)(B)가 요구하는 "임직원 자기계좌 거래 통제"의 최강 이행이 바로 이 사전 차단이다. 둘째, fail-safe 원리 — 명부를 읽지 못하거나 불확실하면 통과가 아니라 차단이 기본값이다. 투자자 보호가 목적인 반사기 예방 부품에서, 불확실성은 보수적으로 차단하는 쪽으로 해소하는 것이 옳다. 이 두 원리가 게이트형(strict-liability 성격의 즉시 차단)을 F-01의 정당한 형태로 만든다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

### 9.1 본 부품의 책임 경계

F-01은 "이 거래의 당사자 중 운영자 측이 있는가, 있다면 허용 예외인가"까지만 판단한다. 그 사람이 적격인지는 A-03·A-13, 제재 대상인지는 A-01, 계열인지의 실체 판정은 A-06, 지갑 뒤 사람이 누구인지는 A-04, 그 거래가 가장매매 패턴인지는 F-02, 신고 대상인지는 F-03이 본다. F-01은 오직 운영자 측의 자발적 2차 거래 참여만 사전 차단한다.

### 9.2 Element 관계 표

| 부품 | 관계 | 구체적 연결 |
| --- | --- | --- |
| A-04 (신원) | 판정 단위 공급 | from·to 지갑 → ONCHAINID 매핑; 새 지갑 우회를 A-04가 무력화(§7.5) |
| A-06 (affiliate) | 계열 실체 판정 공유 | control 여부는 A-06이 off-chain 판정 → F-01 명부에 반영. F-01은 판정 규칙이 아니라 결과를 소비 |
| A-01 (제재) | 동형 게이트 | 둘 다 negative screen·fail-safe·즉시 차단; 병렬 배치 |
| F-02 (시장감시) | 사전 차단 ↔ 사후 감시 | F-01이 못 막은 우회·예외 통과분을 F-02가 wash/matched 패턴(§9(a)(1))으로 사후 감시 |
| F-03 (SAR) | 위장 시도 신호 | 제한대상 우회 시도(새 지갑·명의 위장)는 F-03 보고 신호 |
| B-03 (이전제한 메타) | forcedTransfer/recovery 권한 정합 | 예외 ②(강제·회수)의 권한 체계가 B-03과 일치해야 함 |
| B-01 (Manifest 무결성) | primary 예외·명부 참조 무결성 | Manifest의 primary 경로·restrictedOperatorSet 참조 구성의 무결성을 B-01이 검증 |

### 9.3 Recipe orchestration — R4 소속이나 글로벌 게이트 성격 (설계 관찰)

PM 규약상 F-01은 R4(시장행위 감시)에 속한다. 그러나 F-01은 R4의 다른 부품들과 성격이 근본적으로 다르다 — F-02·F-03은 post-trade STATEFUL 감시(flag)인 데 반해, F-01은 pre-trade STATELESS hard gate다. 기능적으로 F-01은 A-01·A-02(제재·국가 제한) 같은 transaction-level 글로벌 게이트에 더 가깝다: 운영자 자기거래는 R1(발행)·R2(재판매)·R3(펀드) 어느 레시피의 거래든 가리지 않고 걸려야 하기 때문이다.

이로부터 두 가지 설계 함의가 나온다. (1) F-01은 R4의 "감시" 묶음에 조직상 소속되지만, 실행상으로는 모든 거래에 병렬로 걸리는 글로벌 게이트로 배치하는 것이 옳다 — 즉 manifest.globalGates에 두어 A-01과 나란히 pre-trade에 평가하는 편이 R4 감시 파이프라인에만 얹는 것보다 안전하다. (2) 이 이중성(조직상 R4 / 실행상 글로벌)은 매니페스트 설계에서 명시적으로 다뤄야 하며, F-01을 R4 사후 감시에만 매달면 pre-trade 봉쇄가 누락될 위험이 있다. 이 배치 문제는 §12의 Open Issue로 남긴다.

### 9.4 Conflict resolution rule

- **예외와 차단이 겹칠 때.** 제한대상이 낀 거래가 동시에 예외(primary/involuntary)에도 해당하면, 예외가 차단에 우선한다 — 단 예외는 화이트리스트로 좁게 정의된 경우에만 성립하고, 애매하면 차단이 기본값이다.
- **F-01 통과 ↔ 다른 게이트 차단.** F-01이 통과시켜도 A-01(제재)·A-03(자격) 등 다른 게이트가 독립적으로 차단할 수 있다. F-01의 PASS는 "운영자 측 문제 없음"만 의미하며 다른 요건의 통과를 보장하지 않는다(cumulative AND).
- **명부 불확실.** 명부 로드 실패·미반영 창은 fail-safe(차단)로 해소한다(§5.4·§8.3).

### 9.5 Manifest 무결성과의 조율

토큰별 Manifest가 F-01 관련으로 고정하는 값 — restrictedOperatorSet 레지스트리 주소, primary-distribution 허용 경로, forcedTransfer/recovery 권한 구성, 그리고 (확정 시) venueStatus. 이 값들의 무결성·변경 통제는 B-01 소관이며, Element 단위 거버넌스(2-of-3 멀티시그·time-lock)로 갱신한다.

---

## §10. (γ) 3-Layer Solution — 제한대상 명부의 신뢰를 세 겹으로

### 10.1 왜 3겹 구조인가

F-01의 판정은 오직 제한대상 명부의 정확성에 달렸다. 명부에 빠진 계열이 있으면 게이트가 뚫리고, 잘못 올라간 정상 참여자가 있으면 정당한 거래가 막힌다. 그래서 명부 자체를 세 겹으로 신뢰 보증한다 — 증명서형(A-13)이 "매수인 자격"을 세 겹으로 보증했다면, F-01은 "누가 운영자 측인지"라는 명부를 세 겹으로 보증한다.

### 10.2 각 층의 법적 토대

- **Layer 1 — 운영자 자기신고·거버넌스 등록.** Decipher 자신이 자기 법인·계열·임직원을 가장 잘 안다. 임직원 온보딩·계열 관계 변동 시 거버넌스가 제한대상 명부에 등록한다. 이는 Reg ATS 301(b)(10)(ii)가 요구하는 "서면 감독 절차"의 온체인 대응이다.
- **Layer 2 — A-06 control 판정 연동.** 계열(affiliate) 여부는 Rule 405 control 기준으로 A-06이 off-chain 판정하고, 그 결과를 명부에 반영한다. 지분 밝은 선이 아니라 기능적 control 판정이므로(§3.7), 경계 사례는 A-06의 판단 기록으로 뒷받침된다.
- **Layer 3 — 주기적 대사·감사.** 명부와 실제 인사·계열 현황(HR·법인 등기·지배구조)을 주기적으로 대사(reconciliation)해 누락·오류를 잡는다. 이 감사 기록이 사후 방어의 중심이다.

### 10.3 층 간 escalation 규칙

- 자기신고(Layer 1)로 등록되지 않았으나 A-06(Layer 2)이 control을 확인하면 명부에 추가하고 REVIEW 큐에 기록한다.
- 대사(Layer 3)에서 명부에 없어야 할(관계 종료) 자가 발견되면 제거하되, 제거 시점 이후 거래부터 허용된다(§5.4).
- 어느 층에서든 우회 시도(명의 위장·새 지갑)가 포착되면 F-03(SAR 신호)로 에스컬레이션한다.

### 10.4 Liability(책임) 분배 — 명부 누락으로 운영자 거래가 통과된 경우

명부에 빠진 계열이 거래를 통과시켜 반사기 문제가 발생한 경우, 설계 관점의 책임 분배는 이렇다. ① 자기신고·A-06 연동·대사라는 3겹 절차를 지켰는데도 갱신 창(§5.4) 안에서 통과된 경우 — 절차 준수 기록이 방어의 중심이고, 시스템은 탐지 즉시 명부 반영·F-02 사후 감시·F-03 보고로 손해 확산을 차단한 기록을 남긴다. ② 자기신고·연동·대사 절차를 게을리해 뚫린 경우 — 거버넌스의 절차 위반 문제로 전개된다. 즉 F-01의 방어력은 온체인 게이트가 아니라 off-chain 명부 거버넌스(§11)의 성실성에 달렸다.

---

## §11. (δ) Frontend·Off-chain Operator Layer — 4-Layer로는 안 끝난다

### 11.1 4-Layer 밖의 층이 필요한 이유

F-01의 온체인 로직은 단순하다(명부 대조). 복잡성은 전부 off-chain에 있다 — 누구를 제한대상으로 볼지(계열 판정), 언제 명부에 넣고 뺄지(인사·지배구조 변동 추적), 어떻게 우회를 잡을지(대사·감시). 이 층이 부실하면 온체인 게이트는 빈 껍데기다.

### 11.2 제한대상 명부 등록·갱신 절차

- **등록 트리거.** (a) 임직원 온보딩/오프보딩, (b) 계열 관계 성립/종료(M&A·지분변동·지배구조 변경, A-06 연동), (c) 운영자 지배 계좌 신설.
- **권한·기록.** 명부 추가·제거는 거버넌스 멀티시그(예: 2-of-3)와 time-lock으로만 가능하며, 모든 변경에 서명·사유·타임스탬프를 남긴다. 이는 거래가 아니라 운영 트랜잭션이다(§5.4의 STATELESS 근거).
- **온체인 반영 지연 최소화.** off-chain 판정과 온체인 명부 반영 사이의 창을 줄이는 것이 F-01 방어의 핵심이다(§12).

### 11.3 감사·대사 (reconciliation)

명부 ↔ 실제 현황(HR 인사·법인 등기·지배구조 도표)을 주기적으로 대사한다. BD/ATS 해당 시 이 기록은 Reg ATS 301(b)(10)(ii) 감독 절차 및 Rule 17a-4 기록보존과 연결된다(BD/ATS 의견서 §3 audit trail 참조).

### 11.4 아키텍처 함의

F-01은 "온체인 3줄, off-chain 대부분"인 부품이다. 온체인은 명부를 읽어 즉시 차단하는 결정론적 게이트일 뿐이고, 실질 방어는 명부를 정확·최신으로 유지하는 거버넌스에 있다. 그래서 F-01의 감사·검증은 코드 리뷰가 아니라 명부 거버넌스 절차의 리뷰로 이뤄져야 한다.

---

## §12. Open Issues — 변호사·아키텍트 follow-up 대상

| 우선순위 | 이슈 | 내용 | 넘길 곳 |
| --- | --- | --- | --- |
| P0 | 명부 반영 지연 창 | off-chain에서 계열로 판정된 자가 아직 온체인 restrictedOperatorSet에 반영되지 않은 창(window)이 F-01의 유일한 구조적 취약점(§5.4). 반영 지연 최소화 SLA·즉시 반영 메커니즘 설계 필요 | 아키텍트(거버넌스·오라클) |
| P0 | 매니페스트 배치(R4 vs 글로벌 게이트) | F-01은 조직상 R4이나 실행상 모든 거래에 걸려야 하는 글로벌 게이트 성격(§9.3). manifest.globalGates에 A-01과 나란히 둘지, R4 파이프라인에 둘지 확정. R4 사후 감시에만 매달면 pre-trade 봉쇄 누락 위험 | 아키텍트(Manifest 설계) |
| P1 | BD/ATS 지위 미결의 파급 | Decipher가 broker/ATS인지 확정되면 §3.5(301(b)(10))·§3.6(§15(c))이 F-01의 조건부 근거로 확정된다. 미결 상태에서는 반사기(§3.1~§3.3)만으로 이미 정당화되나, 지위 확정이 근거 두께와 감독·기록 의무를 바꾼다(BD/ATS 의견서 Q1) | 외부 전문 자문·SEC Crypto Task Force |
| P1 | 발행자 1차 배포 예외의 범위 | Decipher 운영자가 발행자·transfer agent 역할을 겸하는 구조라면 primary 예외(§6.3 ①)의 경계가 미묘. 어디까지가 "발행 배포"이고 어디부터가 "운영자 자기거래"인지, 발행 아키텍처 확정 후 재검토 | 발행 구조 확정 후 법률 검토 |
| P2 | 다크풀 집행 사례 pinpoint 인용 | §3.10의 운영자 자기거래 집행선(Pipeline 등)의 정확한 SEC release 번호·인용을 1차 출처(sec.gov)로 확정해 최종본에 반영 | 외부 자문·리서치 |
| P2 | 계열(control) 판정의 off-chain 경계 | control은 지분 밝은 선이 아니라 기능적 판단(§3.7)이므로 경계 사례(계약상 지배·간접 지배)의 판정 기준을 A-06과 공유·정합. 명부 등록 기준의 명문화 | A-06 연동·법률 검토 |
| P2 | fail-safe 발동 시 UX | 명부 로드 실패로 정당한 거래가 일시 차단될 때의 사용자 경험·재시도 정책. 가용성 vs 보수적 차단의 균형 | 아키텍트·프로덕트 |

---

## §13. 파일명 규칙

- 본문 소스: `F-01_operator-self-dealing.md`
- 빌드 산출물: `F-01_operator-self-dealing.docx` (pandoc + Noto Sans CJK KR 패치)
- 도표: `fig30.png`(법조문 관계 흐름), `fig50.png`(런타임 판정 흐름)
- 출력 위치: `/mnt/user-data/outputs/`
- 스펙시트(후속): `spec-sheets/elements/F-01.md`

---

*본 문서는 F-01(운영자 자기거래 제한) 부품의 심층 인수인계 자료다. 핵심 잠금 결론 — (1) F-01의 무조건적 법적 뿌리는 반사기(§10(b)/10b-5·§17(a))이며 운영자 지위 확정과 무관하다. (2) ATS/broker 확정 시 Reg ATS 301(b)(10)(i)(B)·§15(c)(1)이 조건부로 보강되며, F-01은 301(b)(10)(i)(B)의 최강 이행이다. (3) F-01은 ICA §17에서 나오지 않는다 — BUIDL은 §3(c)(7)로 투자회사 정의에서 제외되어 미등록이고, Decipher는 §2(a)(3) 의미의 펀드 관계자도 아니다. (4) F-01은 조직상 R4이나 실행상 글로벌 게이트로 배치하는 것이 옳다. 모든 영문 원문은 1차 출처(uscode.house.gov·ecfr.gov·govinfo.gov)에서 verbatim 확인했다.*

Tab Context:
- Executed on tabId: 437007785
- Available tabs:
  • tabId 437007716: "(1) 7/15 | Notion" (https://app.notion.com/p/deciphersnu/7-15-3a0dff004c8980fe857bd4158b970eab)
  • tabId 437007775: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_보유기간.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_보유기간.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md)
  • tabId 437007778: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_국가거주제한.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_국가거주제한.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md)
  • tabId 437007781: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_법리검증기준서_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_법리검증기준서_v1+%281%29.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1+%281%29.md)
  • tabId 437007782: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_모름항변차단.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_모름항변차단.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md)
  • tabId 437007783: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD확인.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD확인.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md)
  • tabId 437007784: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md)
  • tabId 437007785: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md)
  • tabId 437007786: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md)
  • tabId 437007787: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md)
  • tabId 437007788: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5353e81e-96a2-4d4b-a965-fb4cafccc156/F-04_no-purchase-during-distribution.md?table=block&id=3a4dff00-4c89-80f8-af9f-cc7028cb641d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=J2D6J2JjovGrC18Rlg9blfXeyYYrthiwuJqBAzGUkBM&downloadName=F-04_no-purchase-during-distribution.md" (
