# ELE.A-04_identity-dedup

# A-04 신원중복 (Identity Deduplication) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 신원중복 부품(내부 식별자 A-04)을, 미국 증권법·AML 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**한 줄 정의.** A-04는 *"이 지갑 뒤에 있는 사람이 누구이고, 그 사람이 우리 시스템 안에서 단 하나의 신원으로만 존재하는가"* 를 거래 직전에 확인하는 부품이다. 지갑(wallet)은 익명의 키쌍일 뿐이고, 법이 요건을 거는 단위는 언제나 사람(person)이다. 한 사람이 지갑을 여러 개 만들어 별개의 사람인 척하면 — 보유자 수 상한(D-01), 내부자 거래량 한도(C-08), 제재 스크리닝(A-01), 자격 검증(A-03·A-13) — 이 시스템의 거의 모든 검사가 동시에 무력화된다. A-04는 그 위장을 막는 신원의 기반층이다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC·Treasury(FinCEN) 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-07-15).** 본 부품의 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §77d·§78l(g)(5)·§80a-3(c)(7)과 31 U.S.C. §5318(l)은 uscode.house.gov 현행본, 17 CFR §230.144·§230.501·§230.506·§240.12g5-1과 31 CFR §1023.220·§1010.230은 eCFR 현행본(2026-07 기준, Title 17은 2026-06-25 개정분, Title 31은 2026-06-25 개정분까지 반영), CIP 공동 채택 release(2003)는 sec.gov, IA AML Rule 시행 연기 최종규칙(2025-12-31 서명, 2026-01-02 관보 게재)과 CDD 예외구제 명령(2026-02)은 fincen.gov·federalregister.gov(govinfo 연동)다.

**테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, transfer architecture, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링하여, 신원 기반 pre-trade transfer restriction을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다. 또한 본 문서의 BSA(은행비밀법) 관련 서술은 "누가 그 의무의 주체인가"를 엄밀히 구분한다 — CIP·SAR 같은 BSA 의무는 등록된 운영주체(broker-dealer 등)의 의무이지 스마트 컨트랙트의 의무가 아니며, A-04는 그 의무 이행이 산출한 *확정 신원이라는 사실* 을 온체인에서 소비 가능한 형태로 유지·판정하는 부품이다(§10).

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** 다른 부품들(A-03 적격투자자, A-13 QP, C-01 보유기간)은 각자 하나의 조문에서 태어났다. A-04는 다르다 — "한 사람은 한 사람으로 세어야 한다"는 문장을 그대로 적어 둔 단일 조문은 없다. 대신 증권법의 거의 모든 요건이 지갑·계좌·주소가 아니라 **사람(person)** 을 단위로 걸려 있고, 그 단위를 쪼개는 행위를 막는 조각 규범들이 여러 법에 흩어져 있다. A-04는 그 흩어진 규범들의 공통 전제 — "지갑 뒤의 사람을 알고, 같은 사람은 하나로 취급한다" — 를 하나의 부품으로 모은 것이다. 그래서 이 부품의 법적 근거(§3)는 한 조문의 해부가 아니라, 세 갈래 규범군의 수렴을 보여주는 구조가 된다.

### 1.1 미국 증권법의 4개 기둥과 그 곁의 다섯 번째 축 — BSA

미국 연방 증권규제는 시대별로 따로 만들어진 4개의 큰 법률이 각자 다른 국면을 맡는다 — 1933년법(발행·공시), 1934년법(유통·거래소·중개업자), ICA 1940(펀드), Advisers Act 1940(자문업자). 이 네 기둥 이야기는 A-13 문서 §1.1에서 상세히 다뤘다.

A-04에서 중요한 것은 이 네 기둥 **곁에 서 있는 다섯 번째 축** 이다 — **BSA(Bank Secrecy Act, 은행비밀법, 31 U.S.C. §5311 이하)**. BSA는 증권법이 아니다. 자금세탁·테러자금 차단을 위한 국가안보·금융범죄 법제이고, 증권 거래든 은행 송금이든 카지노 칩 교환이든 "금융기관을 통과하는 돈"이라면 어디에나 걸린다. 한국법 감각으로는 자본시장법 옆에 따로 서 있는 **특정금융정보법(특금법)** 에 해당한다. 프로젝트의 법률 지도(07 자료 §IV.1)에서 제재(A-01)·AML/KYC(A-04)·관할(A-02)을 증권법 4겹과 구분해 **횡단 규제(cross-cutting)** 로 분류한 이유가 이것이다 — Recipe(증권법 면제 요건 묶음)가 무엇이든, 이 축은 독립적으로 적용된다.

| 축 | 법률 | 묻는 질문 | Decipher 부품 |
| --- | --- | --- | --- |
| 증권법 4기둥 | 1933·1934·ICA·Advisers | "이 발행·거래·펀드·자문이 적법한가" | Recipe R1~R4의 각 부품 |
| 제재 | IEEPA·OFAC 규정 | "이 사람과 거래 자체가 금지인가" | A-01 (strict liability) |
| **AML/KYC** | **BSA (31 U.S.C. §5318)** | **"이 고객이 진짜 누구인지 아는가"** | **A-04 (본 부품)** |
| 관할 | 각국 증권법·역외 법리 | "이 사람 소재지에서 팔아도 되나" | A-02 |

여기서 A-04의 이중적 성격이 나온다. BSA 축에서 A-04는 "고객의 진짜 신원(true identity)을 확인하라"는 의무의 사실 공급자다. 그런데 그 확정된 신원은 곧바로 증권법 4기둥 쪽에서도 소비된다 — 506(c)의 "모든 purchaser"(§3.1), §4(a)(7)의 "each purchaser"(§3.3), Rule 144의 "person"(§3.4), §12(g)의 "held of record ... by each person"(§3.10~§3.12)이 전부 사람 단위이기 때문이다. 즉 A-04는 횡단 규제(BSA)에서 태어나 증권법 부품 전체에 카운팅·귀속 단위를 공급하는, 두 세계에 걸친 부품이다.

### 1.2 왜 이 규제가 존재하는가 — 명부의 시대에서 익명 키쌍의 시대로

**종이 명부 시대의 전제.** 1934년법 §12(g)가 "record holder 수"로 등록 의무를 트리거하고, Reg D가 "매수인 수"를 세고, Rule 144가 "그 사람 계정의 매도"를 합산할 때, 입법자는 한 가지를 당연하게 전제했다 — 명부의 이름 하나는 대체로 사람 하나라는 것. 그런데 그 전제조차 완전하지 않아서, 규범들은 일찍부터 보정 장치를 달았다. 남편 이름·부인 이름·부부 공동명의로 세 줄에 등재된 같은 집을 1인으로 세는 규칙(Rule 12g5-1(a)(4)·(a)(6)), 브로커 명의(street name) 뒤에 실소유자가 숨는 문제, 그리고 결정적으로 — **보유 형태 자체를 등록 회피 목적으로 설계하면 명부를 무시하고 실소유자를 센다** 는 회피 방지 규칙(Rule 12g5-1(b)(3))이 그것이다. 의회는 아예 §12(g)(5)에서 SEC에게 "이 조항의 회피를 방지하기 위해(to prevent circumvention)" 카운팅 용어를 정의할 권한을 명시적으로 위임했다(§3.10).

**9·11과 CIP.** 2001년 USA PATRIOT Act §326은 다른 방향에서 같은 지점을 때렸다 — 금융기관은 계좌를 열어 주기 전에 "그 사람이 누구인지" 확인할 최소 절차를 갖추라(31 U.S.C. §5318(l), §3.6). 이를 구체화한 CIP 규칙(broker-dealer는 31 CFR §1023.220, §3.7)의 핵심 문구는 이것이다 — 절차는 기관이 *"각 고객의 진짜 신원을 안다는 합리적 믿음(reasonable belief that it knows the true identity of each customer)"* 을 형성할 수 있어야 한다. 증권법 쪽 규범이 "같은 사람을 하나로 세라"고 말한다면, BSA 쪽 규범은 그 전제인 "애초에 누가 같은 사람인지 알아내라"를 명령하는 것이다.

**익명 키쌍의 시대.** 블록체인은 종이 명부의 문제를 극단으로 키운다. 지갑 주소는 이름조차 없는 키쌍이고, 만드는 비용은 0이며, 한 사람이 1초에 수백 개를 만들 수 있다. 종이 시대의 "부인 명의 계좌 하나 더"가 온체인에선 "지갑 500개"가 된다. 허가형 토큰(ERC-3643)이 이 문제에 내놓은 답이 **ONCHAINID** — 지갑이 아니라 사람에 대응하는 온체인 신원 컨테이너 — 이고, A-04는 그 답이 실제로 법이 요구하는 성질(존재·진위·유일성)을 갖추는지 검사하는 부품이다.

### 1.3 두 방향의 위협 모델 — 위장 분산과 위장 차용

A-04가 막는 위협은 방향이 둘이다.

**① 위장 분산(1인 → N신원).** 한 사람이 여러 지갑을 별개 신원인 것처럼 등록해 머릿수·한도를 쪼갠다. 무엇이 깨지나 — D-01의 보유자 수 카운트(§12(g) 2,000인 관리가 허수로 오염), C-08의 내부자 거래량 합산(affiliate가 지갑 5개로 분산 매도하면 각 지갑은 한도 이내), 506(b) 분기의 35인 매수인 산정(Rule 501(e)), 그리고 검증 회피(A-03/A-13에서 탈락한 사람이 새 신원으로 재시도). Rule 12g5-1(b)(3)이 정확히 이 행위를 겨냥한 규범이다 — 보유 형태가 주로 회피 목적이면 명부가 아니라 실소유자를 센다(§3.12).

**② 위장 차용(제재·부적격자 → 깨끗한 신원 뒤에 숨기).** 제재 대상자·비적격자가 타인의 검증된 지갑이나 위조 서류로 만든 신원 뒤에서 거래한다. 무엇이 깨지나 — A-01의 제재 스크리닝(이름·생년월일 등 신원 속성에 대해 수행되므로, 신원이 가짜면 스크리닝 자체가 헛돈다), 506(c)의 "모든 purchaser AI"(검증은 특정 사람에게 귀속되는데 그 사람이 실물과 다르면 검증이 무효), §3(c)(7)의 "전원 QP". CIP의 "true identity" 요구(§3.7)가 이 방향의 counter-norm이다.

두 방향 모두에서 공통 해법은 같다 — **지갑과 사람의 매핑을 검증 가능하게 만들고, 사람당 신원을 하나로 유지한다.** 다지갑 자체는 위법이 아니라는 점이 중요하다(운영 지갑·콜드월렛 분리는 정상 관행). 금지되는 것은 "여러 지갑"이 아니라 "여러 신원"이다. 그래서 A-04의 규칙은 "지갑 N개 = 허용, 단 전부 같은 ONCHAINID에 바인딩"이고, 하류 부품들은 지갑이 아니라 ONCHAINID 단위로 세고 합산한다.

### 1.4 Decipher 시스템에서 왜 중요한가 — 모든 검사의 공통 전제

BUIDL 같은 토큰의 거래 하나에는 검사 부품 20여 개가 겹겹이 걸린다. 그 전부가 다음 형태의 전제를 깔고 있다 — "매수인/매도인 X에 대해 …를 확인한다." 이 X가 지갑이면 전 시스템이 모래 위에 선다.

수직적으로 보면 이렇다. A-04가 무너지는 순간의 연쇄:

    동일인이 별개 신원 2개로 등록 (A-04 실패)
      → A-01: 제재 대상자가 2번째 신원으로 스크리닝 통과 — IEEPA/OFAC strict liability 위반 (모르고 해도 위반)
      → A-03/A-13: 자격 탈락자가 재시도로 통과 — 506(c) 검증 실패 · §3(c)(7) "전원 QP" 훼손
      → D-01: 보유자 수 이중 계상 또는 과소 계상 — §12(g) 2,000인 관리 오염, 최악의 경우 원치 않는 등록 트리거
      → C-08: affiliate 분산 매도 미탐 — Rule 144(e) 거래량 한도 잠탈, §2(a)(11) underwriter 리스크 부활
      → F-01: 자기거래(wash trade) 미탐 — 같은 사람의 양방향 체결이 정상 거래로 보임

거꾸로 A-04가 서 있으면, 각 부품은 자기 조문만 보면 된다 — "사람이 누구인가"는 이미 풀린 문제이므로. 이것이 A-04를 R1(발행)·R2(재판매)에 필수(●)로 부착하고, R3의 D-01이 강한 의존(hard dependency)으로 소비하며, R4의 F-01이 탐지 기반으로 쓰는 이유다. A-13의 표현을 빌리면, A-13이 "관문의 검사원"이라면 A-04는 **검사원에게 신분증이 진짜인지, 같은 사람이 줄을 두 번 서지 않았는지 알려주는 신원 대장(臺帳)** 이다.

**쉽게 말하면:** 다른 부품의 실패는 그 요건 하나의 실패다. A-04의 실패는 "누구"라는 변수 자체의 오염이라, 그 사람이 지나가는 모든 검사의 동시 실패다. 그래서 이 부품의 설계 철학은 시종 "온보딩에서 무겁게 확정하고, 거래 시점엔 결정적으로 빠르게, 의심스러우면 사람에게 넘긴다"이다.


## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"신원중복 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | 신원중복 (Identity Deduplication) | 지갑 뒤의 사람을 확정하고, 같은 사람은 하나로 유지 |
| 검사 대상 | 지갑↔사람(ONCHAINID) 매핑의 ① 존재(등록) ② 진위(KYC claim 유효) ③ 유일성(1인 1신원) ④ 상태(동결·취소 아님) | "이 지갑이 검증된 유일 신원에 묶여 있나" |
| Internal ID | A-04 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 기계 판정형(Pattern A) — 등록형 신원 기반. 온보딩 단계의 실사·중복 스크리닝은 off-chain(증명서형 성격), 런타임 check()는 registry 조회의 결정론 판정 | 애매한 판단은 온보딩에서 끝내고, 거래 시점엔 결정적 값만 읽는다 |
| Timing | pre-trade (거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | STATELESS (Element 한정) | check()는 registry의 현재 스냅샷만 읽는다. 신원 대장 자체(등록·바인딩·red-flag)는 온보딩·운영 이벤트로 갱신되는 상태이나, 그 갱신은 거래 commit이 아니라 Operator·Trusted Issuer 경로다 |
| 주 활성화 Recipe | R1 (Reg D 506(c) Issuance) · R2 (Resale) — 필수(●) | 발행·재판매의 buyer/seller 신원 게이트 |
| 인프라 소비자 | R3의 D-01 (강한 의존 — 카운팅 단위 공급) · R4의 F-01 (자기거래 탐지 기반) · A-01 (스크리닝 대상 신원 속성 공급) | 부착 매트릭스상 R3·R4에 게이트로 걸리지 않아도, 기반 데이터는 상시 공급된다 (§9.2) |
| Cascade Element | A-11 (claim 신선도) · A-08/A-09 (entity 신원 그래프) · A-12 (red-flag) | 본 부품이 위임·연동하는 검사 |
| 성숙도 | 완료 (리서치 종결 — Spec Sheet 압축만 잔여) | 08 자료 그룹 1 소속 |
| 파일·위치 | A-04_identity-dedup.md · 산출물/elements/ | 산출물 경로 |

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — **Layer 1**(조문)은 의회가 만든 법률 텍스트(statute), **Layer 2**(규칙)는 행정기관(SEC·Treasury/FinCEN)이 그것을 실무 수준으로 구체화한 연방규칙(rule), **Layer 3**(해석)은 채택 release·행정명령·해석지침이 모호한 부분을 메운 층이다. 아래 §3.0.2 표의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule·Treasury Rule(BSA) = Layer 2, SEC Release·FinCEN Order/Release = Layer 3. A-04는 SEC 단독 부품이 아니라 BSA 축이 절반이라, Layer 2에 Treasury 규칙(31 CFR)이 함께 선다 — 법적 성격은 SEC Rule과 동일한 행정입법이다. 본 절은 조문이 작동하는 **논리 흐름 순서로** 배열돼 §3.1~§3.17 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

**A-04 특유의 구조 주의.** §1.1에서 본 대로 "한 사람 = 하나"를 직접 명한 단일 조문은 없다. 대신 세 규범군이 수렴한다 — ① 요건의 단위가 사람임을 정하는 조문들(§3.1~§3.5), ② 그 사람의 신원 확인을 명하는 BSA 축(§3.6~§3.9), ③ 사람 단위를 쪼개는 행위를 막는 회피 방지 규범(§3.10~§3.14). A-04의 판정 규칙(1인 1 ONCHAINID, 지갑은 바인딩)은 이 세 군의 교집합을 온체인에 옮긴 것이다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 위 세 규범군이 A-04 판정에서 어떻게 연결되는지를 하나의 큰 흐름으로 정리한 것이다 — 거래 발생 → ① 요건의 단위(R1: 506(c)(2)(i)·(ii) / R2: §4(d)(1)·Rule 144(a)(2) / 배경 R3: §3(c)(7)(A)) → ② 신원확인 의무(§5318(l) → 1023.220 BD CIP → entity면 1010.230 CDD) → ③ 쪼개기 방지(§12(g)(5) → 12g5-1(a)(6)·(b)(3), dormant 501(e)·144(e)(3)(vi)) → A-04 판정 → 소비자 부품 공급. 각 조항의 상세는 §3.1~§3.15.

![A-04 법조문 관계 흐름](A-04_fig30.png)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

BUIDL-like 토큰 한 건의 거래에서 A-04의 자리는 이렇다.

- **발행(R1 506(c) + R3 §3(c)(7) 동시).** 매수인은 Securitize의 온보딩을 통과해야 한다 — KYC(신원 확인)와 자격 검증(AI·QP)이 한 파이프라인에서 이뤄지고, 통과하면 투자자의 지갑이 화이트리스트(Identity Registry 대응물)에 등록된다. A-04가 모델링하는 것이 바로 이 "화이트리스트 등록 = 검증된 유일 신원" 단계다. 자격(AI/QP)의 실체 판정은 A-03·A-13의 몫이고, A-04는 그 자격이 *어느 사람에게* 귀속되는지의 기반만 책임진다.

- **재판매(R2 + R3).** Rule 144 경로든 §4(a)(7) 경로든, 매도인·매수인 모두 등록된 신원이어야 거래가 성립한다. 특히 매도인 측 — Rule 144의 보유기간(C-01)·거래량(C-08)·affiliate 판정(A-06)은 전부 "그 사람"의 속성이라, 매도인이 지갑을 갈아타도 같은 사람으로 추적돼야 한다.

- **보유자 수 관리(R3의 D-01).** BUIDL의 실무 제약인 §12(g) 보유자 수 관리에서, D-01은 지갑이 아니라 사람(ONCHAINID)을 센다. 같은 기관이 운용 지갑·수탁 지갑 2개를 등록해도 카운트는 1이다 — 이 dedup이 A-04가 D-01에 공급하는 것이다.

- **주의 — 실제 BUIDL 단정 금지.** 실제 Securitize 인프라가 내부적으로 어떤 dedup 알고리즘·신원 모델을 쓰는지는 공개 자료로 단정할 수 없다. 본 문서는 "허가형 토큰의 화이트리스트는 지갑이 아니라 검증된 투자자 단위"라는 ERC-3643 표준 구조(Identity Registry가 지갑을 투자자 신원에 매핑)를 전제로 한 모델링이다.

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

**표 1 — Authority.** 본 부품이 인용하는 모든 근거의 목록이다. Direct/Supporting 태그는 Direct(판정에 직접 반영) / Conditional(특정 갈래·조건에서 반영) / Supporting(판정을 뒷받침) / Background(맥락)다.

| 종류 | Authority | 내용 | A-04 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| SEC Rule | Rule 506(c)(2)(i), 17 C.F.R. §230.506(c)(2)(i) | 모든 purchaser가 AI여야 | 요건의 단위 = purchaser(사람) — R1 | Direct | ecfr.gov |
| SEC Rule | Rule 506(c)(2)(ii), 17 C.F.R. §230.506(c)(2)(ii) | reasonable steps to verify | 검증이 귀속될 신원의 확정 필요 — R1 | Direct | ecfr.gov |
| Statute | Securities Act §4(a)(7)·§4(d)(1), 15 U.S.C. §77d(a)(7)·(d)(1) | 재판매 면제 — each purchaser AI | 요건의 단위 = purchaser — R2 §4(a)(7) 경로 | Direct | uscode.house.gov |
| SEC Rule | Rule 144(a)(2), 17 C.F.R. §230.144(a)(2) | 매도 계정의 'person' 확장 정의 | 재판매 합산 단위의 사람 뭉치기 — R2 Rule 144 경로 | Direct | ecfr.gov |
| Statute | ICA §3(c)(7)(A), 15 U.S.C. §80a-3(c)(7)(A) | persons가 배타적 소유 + 취득 시점 QP | 사람-단위 수요의 펀드 축 (R3 동거) | Background | uscode.house.gov |
| Statute | BSA §5318(l), 31 U.S.C. §5318(l) | CIP 제정법 위임 (PATRIOT Act §326) | 신원확인 의무의 제정법 뿌리 | Direct | uscode.house.gov |
| Treasury Rule (BSA) | 31 C.F.R. §1023.220 | broker-dealer CIP — true identity에 대한 reasonable belief | 신원 확정의 실무 기준 (운영주체 의무) | Direct | ecfr.gov |
| Treasury Rule (BSA) | 31 C.F.R. §1010.230 | CDD — 법인 고객의 수익적 소유자 (25% 이상 + control) | entity 매수인의 신원 그래프 뿌리 | Conditional | ecfr.gov |
| Treasury Rule (BSA) | 31 C.F.R. §1032.210(c) (개정 후) | IA AML Rule — 시행 2028-01-01로 연기 | 펀드 자문사 측 AML 의무의 현황 (시행 전) | Background | ecfr.gov·federalregister.gov |
| Statute | Exchange Act §12(g)(5), 15 U.S.C. §78l(g)(5) | "prevent circumvention" 정의 위임 | 쪼개기 방지 규범의 상위 근거 | Supporting | uscode.house.gov |
| SEC Rule | Rule 12g5-1(a)(6), 17 C.F.R. §240.12g5-1(a)(6) | 유사 명의 + 동일인 근거 → 1인 | 신원 클러스터링(dedup)의 법적 원형 | Direct | ecfr.gov |
| SEC Rule | Rule 12g5-1(b)(3), 17 C.F.R. §240.12g5-1(b)(3) | 회피 목적 보유형태 → 실소유자 간주 | 다지갑 위장의 정확한 counter-norm | Direct | ecfr.gov |
| SEC Rule | Rule 501(e), 17 C.F.R. §230.501(e) | 매수인 수 산정 — 동거 친족·과반 entity 뭉치기 | 506(b) 분기 전용 (BUIDL 506(c)에선 dormant) | Conditional | ecfr.gov |
| SEC Rule | Rule 144(e)(3)(vi)·예비주해, 17 C.F.R. §230.144 | concert 합산 + 기술적 준수의 회피설계 배제 | C-08 합산의 사람 전제 · 일반 회피 배제 | Supporting | ecfr.gov |
| SEC Release | CIP 공동 채택 release (Treasury/FinCEN·SEC, 2003-05-09) | customer = 명의 accountholder, CIP는 look-through 불요 | CIP 신원 확정과 증권법 자격 look-through의 경계 | Supporting | sec.gov |
| FinCEN (Layer 3) | IA AML Rule 시행 연기 최종규칙 (2025-12-31, FR 2026-01-02) + 예외구제 명령 (2025-08-05) | 시행일 2026-01-01 → 2028-01-01 | IA 측 AML 의무 현황 확정 | Background | fincen.gov·federalregister.gov |
| FinCEN (Layer 3) | CDD 예외구제 명령 (2026-02) | 수익적 소유자 확인을 최초 계좌 개설 시 등으로 한정 | entity 신원 그래프 갱신 주기의 완화 | Background | fincen.gov |
| SEC Release | Release No. 33-9415 (2013) | 506(c) 검증 = 객관적·사실관계 판단 | 검증 프레임 배경 (A-03 상세) | Background | sec.gov |

**표 2 — 순서·중요성.** 아래 순서는 중요도순이 아니라 **논리 흐름순** 이다 — 요건의 단위를 먼저 확인하고(§3.1~§3.5), 그 단위인 사람의 신원 확인 의무를 보고(§3.6~§3.9), 단위를 쪼개는 행위를 막는 규범(§3.10~§3.14)과 해석(§3.15)으로 닫는다.

| 순서 (§3.X) | 조문 | 중요성 | A-04가 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | Rule 506(c)(2)(i) | 높음 | R1의 요건 단위가 지갑이 아니라 purchaser(사람)임을 고정 |
| §3.2 | Rule 506(c)(2)(ii) | 높음 | 검증의 귀속 대상인 신원이 먼저 확정돼야 함을 도출 |
| §3.3 | §4(a)(7)·§4(d)(1) | 높음 | R2 §4(a)(7) 경로의 buyer 단위 고정 |
| §3.4 | Rule 144(a)(2) | 높음 | R2 Rule 144 경로의 seller 합산 단위('person' 그룹) 공급 근거 |
| §3.5 | ICA §3(c)(7)(A) | 중간 (배경) | R3 동거 시 사람-단위 수요의 확인 (게이트는 A-13·D-01) |
| §3.6 | 31 U.S.C. §5318(l) | 높음 | 신원확인 의무의 제정법 뿌리 — "누구인가"를 확인하라는 명령 |
| §3.7 | 31 C.F.R. §1023.220 | 매우 높음 | true identity 기준 — 온보딩 신원 확정의 실무 표준 |
| §3.8 | 31 C.F.R. §1010.230 | 중간 (조건부) | entity 매수인의 수익적 소유자 신원 그래프 (A-08/A-09 연계) |
| §3.9 | 31 C.F.R. §1032.210(c) | 낮음 (배경) | IA 측 AML 의무의 시행 전 상태 확인 (2028 연기) |
| §3.10 | Exchange Act §12(g)(5) | 중간 | 회피 방지 규범군의 상위 위임 근거 |
| §3.11 | Rule 12g5-1(a)(6) | 매우 높음 | dedup 판단("동일인이라 믿을 근거")의 법적 원형 |
| §3.12 | Rule 12g5-1(b)(3) | 매우 높음 | 다지갑 위장 시 실소유자 관통 — 강제 정정의 근거 |
| §3.13 | Rule 501(e) | 낮음 (dormant) | 506(b) 분기의 매수인 뭉치기 규칙 보존 |
| §3.14 | Rule 144(e)(3)(vi)·예비주해 | 중간 | concert 합산의 사람 전제 · 회피설계 일반 배제 |
| §3.15 | Layer 3 묶음 (CIP release·FinCEN 명령들·33-9415) | 중간 | CIP 경계 해석 + BSA 규제 지형의 현황 고정 |


### 3.1 Rule 506(c)(2)(i) — 모든 purchaser가 AI일 것 [출처: ecfr.gov]

**조항:** 17 C.F.R. §230.506(c)(2)(i)

**핵심 원문:** "(i) Nature of purchasers. All purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors."

**한국어:** (i) 매수인의 성격. 본 조 paragraph (c)에 따른 offering에서 판매되는 증권의 모든 purchaser는 accredited investor여야 한다.

**쉬운 설명:** R1(506(c) 발행)의 자격 요건이 걸리는 단위를 보라 — "all purchasers", 즉 사람이다. 지갑도, 주소도, 계좌도 아니다. 이 한 단어가 A-04의 존재 이유 절반이다. 지갑 A로 검증에 탈락한 사람이 지갑 B를 새로 만들어 오면, 지갑 B는 "새 매수인"이 아니다 — 같은 purchaser의 두 번째 손일 뿐이고, 그 사람이 AI가 아니면 이 요건은 여전히 미충족이다. 자격의 실체 판정(AI인가)은 A-03의 일이고, A-04는 "그 판정이 어느 사람에 대해 이뤄졌고, 이 지갑이 그 사람의 것인가"라는 귀속의 기반을 책임진다.

**PASS/FAIL 반영:** 직접 ○ — R1에서 A-04의 활성화 근거. purchaser 단위 요건이 성립하려면 지갑→사람 매핑이 선행돼야 하며, 매핑 불능(미등록)·매핑 위조(claim 무효)·매핑 중복(같은 사람의 별개 신원)이면 FAIL.

**ERC-3643 변환:** transfer 전 IdentityRegistry.isVerified(buyer) — 매수인 지갑이 검증된 ONCHAINID에 바인딩되어 있어야 통과. A-03의 AI claim은 지갑이 아니라 그 ONCHAINID에 발급된다.

### 3.2 Rule 506(c)(2)(ii) — 합리적 검증 조치 [출처: ecfr.gov]

**조항:** 17 C.F.R. §230.506(c)(2)(ii) (chapeau)

**핵심 원문:** "(ii) Verification of accredited investor status. The issuer shall take reasonable steps to verify that purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors. The issuer shall be deemed to take reasonable steps to verify if the issuer uses, at its option, one of the following non-exclusive and non-mandatory methods of verifying that a natural person who purchases securities in such offering is an accredited investor; provided, however, that the issuer does not have knowledge that such person is not an accredited investor:"

**한국어:** (ii) accredited investor 지위의 검증. issuer는 본 조 paragraph (c)에 따른 offering에서 판매되는 증권의 purchaser들이 accredited investor임을 검증하기 위한 합리적 조치(reasonable steps)를 취하여야 한다. issuer가 해당 offering에서 증권을 매수하는 자연인이 accredited investor임을 검증하는 다음의 비배타적·비강제적 방법 중 하나를 선택하여 사용하는 경우 합리적 조치를 취한 것으로 본다. 다만, issuer가 그 자가 accredited investor가 아니라는 것을 알고 있는 경우에는 그러하지 아니하다.

**쉬운 설명:** 검증 방법론((A)~(E) 세부)은 A-03·A-11의 영역이다. A-04가 이 조문에서 읽는 것은 구조다 — 검증은 허공이 아니라 **특정한 사람에게 귀속** 된다. 소득 서류(A)·순자산 자료(B)·제3자 확인(C)은 전부 "누구의" 서류·확인인지가 정해져야 의미가 있고, (E)의 5년 재사용도 "과거에 검증된 그 사람"과 "지금 매수하는 이 사람"이 동일인이어야 성립한다. 즉 신원의 확정과 유일성은 506(c) 검증 체계의 숨은 전제조건이다. 신원이 위조·중복이면, 형식상 완벽한 검증도 엉뚱한 사람에 대한 검증이 된다. 마지막 단서("알고 있는 경우에는 그러하지 아니하다")도 주목 — issuer가 그 지갑 뒤의 사람이 검증 탈락자임을 알면서 통과시키면 안전항이 닫힌다. A-04의 중복 적발 기록은 정확히 이 "knowledge"를 구성할 수 있는 사실이라, 적발 후 방치는 검증 체계 전체를 위태롭게 한다.

**PASS/FAIL 반영:** 직접 ○ — 검증의 귀속 전제. A-04 PASS(확정·유일 신원)가 있어야 A-03의 검증 PASS가 그 사람에게 유효하게 붙는다. A-04 FAIL이면 A-03 판정 이전에 거래가 막힌다.

**ERC-3643 변환:** claim은 지갑이 아니라 ONCHAINID에 발급 (ERC-735 claim on identity). verifiedAt·expiry(A-11)와 basis(A-03)가 사람 단위로 저장되므로 지갑 교체·추가에도 검증 이력이 승계된다.

### 3.3 Securities Act §4(a)(7)·§4(d)(1) — 재판매 면제의 buyer 단위 [출처: uscode.house.gov]

**조항:** 15 U.S.C. §77d(a)(7)·(d)(1)

**핵심 원문:** "(7) transactions meeting the requirements of subsection (d)." / (d) "The transactions referred to in subsection (a)(7) are transactions meeting the following requirements: (1) Accredited investor requirement.—Each purchaser is an accredited investor, as that term is defined in section 230.501(a) of title 17, Code of Federal Regulations (or any successor regulation)."

**한국어:** (7) subsection (d)의 요건을 충족하는 거래. / (d) subsection (a)(7)에서 말하는 거래는 다음 요건을 충족하는 거래다: (1) accredited investor 요건 — 각 purchaser가, 17 CFR §230.501(a)(또는 그 승계 규정)에 정의된 accredited investor여야 한다.

**쉬운 설명:** R2(재판매)의 §4(a)(7) 경로에서도 단위는 같다 — "each purchaser". 발행(§3.1)과 재판매(본 조)가 같은 문법을 쓰므로, A-04의 신원 기반은 1차·2차를 관통하는 공통 인프라가 된다. 한 가지 실무적 함의 — §4(a)(7)은 매도인 측 일반청약 금지((d)(2))도 걸기 때문에, "매도인이 누구인가"도 확정돼야 한다(광고 행위의 귀속). 즉 이 경로에선 buyer·seller 양쪽 신원이 모두 A-04를 지난다. 경로 선택 자체(§4(a)(7)을 열 것인가 — Q-B1)는 C-00의 미결 사항이며, 열리는 경우 본 조가 A-04의 R2 직접 근거가 된다.

**PASS/FAIL 반영:** 직접 ○ (경로 활성 시) — §4(a)(7) 거래에서 buyer 신원 미확정·중복이면 "each purchaser is an accredited investor"의 판정 자체가 불가능 → FAIL.

**ERC-3643 변환:** R2 Manifest의 §4(a)(7) 경로에서 buyer·seller 모두 IdentityRegistry.isVerified() 요구. buyer의 AI claim(A-03)은 ONCHAINID 단위로 확인.

### 3.4 Rule 144(a)(2) — 재판매 합산 단위로서의 'person' [출처: ecfr.gov]

**조항:** 17 C.F.R. §230.144(a)(2)

**핵심 원문:** "(2) The term person when used with reference to a person for whose account securities are to be sold in reliance upon this section includes, in addition to such person, all of the following persons: (i) Any relative or spouse of such person, or any relative of such spouse, any one of whom has the same home as such person; (ii) Any trust or estate in which such person or any of the persons specified in paragraph (a)(2)(i) of this section collectively own 10 percent or more of the total beneficial interest or of which any of such persons serve as trustee, executor or in any similar capacity; and (iii) Any corporation or other organization (other than the issuer) in which such person or any of the persons specified in paragraph (a)(2)(i) of this section are the beneficial owners collectively of 10 percent or more of any class of equity securities or 10 percent or more of the equity interest."

**한국어:** (2) 본 조에 의거하여 증권이 매도되는 계산의 주체인 자와 관련하여 사용될 때 person이라는 용어는, 그 자에 더하여 다음의 자들을 모두 포함한다: (i) 그 자의 친족 또는 배우자, 또는 그 배우자의 친족으로서, 그 자와 같은 집(the same home)을 쓰는 모든 자; (ii) 그 자 또는 (a)(2)(i)에 명시된 자들이 합산하여 전체 수익적 지분의 10% 이상(10 percent or more)을 보유하거나, 그들 중 누군가가 수탁자·유언집행자 또는 이와 유사한 지위로 일하는 신탁 또는 유산(estate); 그리고 (iii) 그 자 또는 (a)(2)(i)에 명시된 자들이 합산하여 어느 종류(class)의 지분증권의 10% 이상 또는 지분(equity interest)의 10% 이상의 수익적 소유자인 (issuer 이외의) 법인 또는 그 밖의 조직.

**쉬운 설명:** Rule 144에서 매도량·조건을 따질 때의 "사람"은 개인 하나보다 넓다 — 같은 집의 배우자·친족, 그들이 10% 이상 가진 신탁·법인까지 한 덩어리로 본다. 남편이 자기 한도만큼 팔고 부인 명의로 또 팔면, 규칙은 처음부터 그 둘을 한 사람으로 읽는다. 부등호에 주의 — "10 percent or more"는 이상(≥)이라 정확히 10%도 포함된다. 온체인 함의는 두 겹이다. 첫째, 개인 수준 dedup(본 부품의 핵심)이 무너지면 이 확장 정의는 논할 것도 없이 무너진다 — 확장 그룹의 중심에 있는 "such person"부터가 흔들리므로. 둘째, 확장 그룹(동거 친족·10% 신탁/법인) 자체의 식별은 off-chain KYC 실사 사실(주소·가족관계·지분 구조)에서 나오고, A-04는 그 결과를 사람 클러스터 참조(personGroupRef)로 저장해 C-08(거래량 합산)·A-06(affiliate)에 공급한다. 합산의 실행은 C-08의 일이다 — A-04는 "누가 한 덩어리인가"까지만 답한다.

**PASS/FAIL 반영:** 조건부 △ — Rule 144 매도(affiliate·restricted) 시, 매도인 개인 신원 확정은 직접 요건이고, (a)(2) 그룹 구성은 C-08·A-06으로 넘기는 데이터 공급 의무다. 그룹 정보 미비 자체는 A-04 FAIL이 아니라 C-08 판정 불능(보수적 차단) 사유다.

**ERC-3643 변환:** ONCHAINID metadata에 personGroupRef(같은 (a)(2) 그룹 해시) 저장 — 그룹 구성원의 매도는 C-08의 aggregation window에서 합산. 그룹 산정의 진위는 off-chain 실사(Trusted Issuer) 몫.


### 3.5 ICA §3(c)(7)(A) — "persons"가 배타적으로 소유 (R3 동거 — 배경) [출처: uscode.house.gov]

**조항:** 15 U.S.C. §80a-3(c)(7)(A)

**핵심 원문:** "Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities. Securities that are owned by persons who received the securities from a qualified purchaser as a gift or bequest, or in a case in which the transfer was caused by legal separation, divorce, death, or other involuntary event, shall be deemed to be owned by a qualified purchaser, subject to such rules, regulations, and orders as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors."

**한국어:** 그 발행 증권이, 해당 증권의 취득 시점에 qualified purchaser인 자들(persons)에 의하여 배타적으로 소유되고, 그 시점에 해당 증권의 public offering을 하고 있지 아니하며 또한 그때 이를 하려고 제안하지도 아니하는 모든 issuer. qualified purchaser로부터 증여나 유증으로, 또는 법적 별거·이혼·사망 그 밖의 비자발적 사건에 의하여 이전이 이루어진 경우에 그 증권을 받은 자들이 소유하는 증권은, SEC가 공익 또는 투자자 보호에 필요·적절하다고 정하는 규칙·규정·명령에 따라, qualified purchaser가 소유한 것으로 본다.

**쉬운 설명:** 펀드 축에서도 소유의 단위는 "persons"다. "전원 QP"의 판정(A-13)도, "그 persons가 몇 명인가"의 카운트(D-01)도, persons의 식별이 먼저다. 부착 매트릭스상 A-04는 R3에 게이트로 걸리지 않지만(—), 이 조문은 R3가 왜 A-04의 기반을 하드하게 소비하는지(D-01의 카운팅 단위, A-13 claim의 귀속처)를 보여준다. BUIDL 거래에서는 R1 또는 R2가 항상 함께 켜지므로 A-04 게이트도 사실상 상시 작동한다(§9.2의 부착 뉘앙스).

**PASS/FAIL 반영:** 간접 ✕ — A-04의 직접 판정 근거가 아니라, R3 부품들(A-13·D-01)이 소비하는 사람-단위 수요의 배경. 본 조 자체의 게이트는 A-13(자격)·D-01(카운트)이 담당.

**ERC-3643 변환:** QP claim의 귀속처 = ONCHAINID(A-13). 비자발적 이전은 forcedTransfer()/recovery() 예외 경로 — 이때도 수취인의 신원 등록(A-04)은 선행되어야 한다(신원 없는 지갑으로의 강제 이전은 불가, §11.4).

### 3.6 31 U.S.C. §5318(l) — 계좌 개설자 신원의 확인·검증 (CIP 제정법 위임) [출처: uscode.house.gov]

**조항:** 31 U.S.C. §5318(l)(1)·(2) (USA PATRIOT Act §326으로 신설)

**핵심 원문:** "(1) In general.—Subject to the requirements of this subsection, the Secretary of the Treasury shall prescribe regulations setting forth the minimum standards for financial institutions and their customers regarding the identity of the customer that shall apply in connection with the opening of an account at a financial institution. (2) Minimum requirements.—The regulations shall, at a minimum, require financial institutions to implement, and customers (after being given adequate notice) to comply with, reasonable procedures for— (A) verifying the identity of any person seeking to open an account to the extent reasonable and practicable; (B) maintaining records of the information used to verify a person's identity, including name, address, and other identifying information; and (C) consulting lists of known or suspected terrorists or terrorist organizations provided to the financial institution by any government agency to determine whether a person seeking to open an account appears on any such list."

**한국어:** (1) 일반 — 본 subsection의 요건에 따라, 재무부 장관은 금융기관에서의 계좌 개설과 관련하여 적용되는, 고객의 신원(identity of the customer)에 관한 금융기관과 그 고객에 대한 최소 기준을 정하는 규정을 제정하여야 한다. (2) 최소 요건 — 그 규정은 최소한, 금융기관이 다음의 합리적 절차를 시행하고 고객이 (적절한 고지를 받은 후) 이에 따르도록 요구하여야 한다 — (A) 계좌 개설을 하려는 모든 자의 신원을 합리적이고 실행 가능한 범위에서(to the extent reasonable and practicable) 검증할 것; (B) 자의 신원 검증에 사용된 정보(이름·주소·그 밖의 식별 정보 포함)의 기록을 유지할 것; 그리고 (C) 계좌 개설을 하려는 자가 정부기관이 금융기관에 제공한 알려진 또는 의심되는 테러리스트·테러조직 명단에 올라 있는지 판단하기 위하여 그 명단을 조회할 것.

**쉬운 설명:** 증권법 조문들(§3.1~§3.5)이 "요건은 사람에게 건다"고 말한다면, 이 조문은 "그 사람이 누구인지 확인하라"를 법으로 명한 뿌리다. 세 요소가 A-04 설계에 그대로 대응한다 — (A) 신원 검증 = 온보딩 KYC, (B) 기록 유지 = off-chain 신원 원장 + 온체인 해시 참조, (C) 명단 조회 = A-01(제재 스크리닝)이 신원 속성에 대해 수행. (C)가 특히 중요하다 — 스크리닝은 지갑 주소가 아니라 이름·생년월일 같은 신원 속성으로 하므로, A-04가 확정한 신원이 가짜면 A-01은 헛돈다. 주의: 이 의무의 수범자는 "financial institutions"(금융기관) — 즉 등록된 운영주체다. 스마트 컨트랙트나 프로토콜 자체가 아니다(§10 책임 분배).

**PASS/FAIL 반영:** 직접 ○ (기반 의무) — A-04가 요구하는 "검증된 신원의 존재"의 법적 원천. 온보딩 미완(신원 미검증) 상태의 지갑은 등록 자체가 없어 FAIL_IDENTITY_NOT_REGISTERED.

**ERC-3643 변환:** 온보딩 파이프라인의 법적 사양 — KYC 검증 완료 시에만 ONCHAINID 발급·IdentityRegistry 등록. (B)의 기록은 off-chain 보관, 온체인에는 claim(해시·서명)만.

### 3.7 31 C.F.R. §1023.220 — Broker-Dealer CIP: "진짜 신원을 안다는 합리적 믿음" [출처: ecfr.gov]

**조항:** 31 C.F.R. §1023.220(a)(1)·(a)(2)

**핵심 원문:** "(1) In general. A broker-dealer must establish, document, and maintain a written Customer Identification Program ("CIP") appropriate for its size and business that, at a minimum, includes each of the requirements of paragraphs (a)(1) through (a)(5) of this section. The CIP must be a part of the broker-dealer's anti-money laundering compliance program required under 31 U.S.C. 5318(h). (2) Identity verification procedures. The CIP must include risk-based procedures for verifying the identity of each customer to the extent reasonable and practicable. The procedures must enable the broker-dealer to form a reasonable belief that it knows the true identity of each customer."

**한국어:** (1) 일반 — broker-dealer는 그 규모와 사업에 적합한 서면 고객확인프로그램("CIP")을 수립·문서화·유지하여야 하며, 이는 최소한 본 조 (a)(1)~(a)(5)의 각 요건을 포함하여야 한다. CIP는 31 U.S.C. 5318(h)에 따라 요구되는 broker-dealer의 자금세탁방지 컴플라이언스 프로그램의 일부여야 한다. (2) 신원 검증 절차 — CIP는 각 고객의 신원을 합리적이고 실행 가능한 범위에서 검증하기 위한 위험기반 절차를 포함하여야 한다. 그 절차는 broker-dealer가 **각 고객의 진짜 신원을 안다는 합리적 믿음(a reasonable belief that it knows the true identity of each customer)** 을 형성할 수 있게 하는 것이어야 한다.

**쉬운 설명:** A-04의 실무 기준이 되는 문장이 (2)의 둘째 문장이다. 기준은 완전한 확실성이 아니라 "true identity에 대한 reasonable belief" — 위험기반으로, 문서적 방법(정부 발급 사진 신분증 등)과 비문서적 방법을 조합해 형성한다((a)(2)(ii)). 같은 규칙의 다른 항들도 A-04 운영에 직결된다 — (a)(2)(iii) 검증 불능 시의 대응(계좌 미개설·제한 거래·폐쇄·SAR 검토)은 §6의 REVIEW·FREEZE 경로의 원형이고, (a)(3) 기록 유지(계좌 폐쇄 후 5년)는 신원 원장의 보존 사양이며, (a)(4) 정부 명단 대조는 A-01 연동, (a)(6) 타 금융기관 의존(reliance)은 Decipher가 Securitize·Sumsub의 CIP 수행에 기대는 구조의 규범적 원형이다. 다시 강조 — 이 의무의 수범자는 broker-dealer다. Decipher가 BD/ATS로 등록하기 전까지 이 조문은 Decipher 자신의 직접 의무가 아니라, ① 참여 BD(모델상 Securitize Markets)의 의무이자 ② Decipher가 자발적으로 채택하는 설계 표준이다(07 자료: "사실은 검사 부품이 공급 + 의무는 Operator plane, BD 등록 후").

**PASS/FAIL 반영:** 직접 ○ (설계 표준) — 온보딩의 신원 확정 품질 기준. "true identity에 대한 reasonable belief"가 형성되지 않은 신원은 등록 보류(REVIEW) 또는 거절이며, 등록된 신원의 사후 의심은 FREEZE 사유.

**ERC-3643 변환:** Trusted Issuer(KYC 검증기관)의 claim 발급 조건 = CIP 수준의 신원 검증 완료. claim.topic = KYC_IDENTITY. 검증 불능·의심 시 identityStatus = FROZEN (토큰 계층에선 Identity Registry 등록 보류/agent 동결로 구현).

### 3.8 31 C.F.R. §1010.230 — CDD: 법인 고객의 수익적 소유자 [출처: ecfr.gov]

**조항:** 31 C.F.R. §1010.230(d)(1)·(2)

**핵심 원문:** "For purposes of this section, beneficial owner means each of the following: (1) Each individual, if any, who, directly or indirectly, through any contract, arrangement, understanding, relationship or otherwise, owns 25 percent or more of the equity interests of a legal entity customer; and (2) A single individual with significant responsibility to control, manage, or direct a legal entity customer, including: (i) An executive officer or senior manager (e.g., a Chief Executive Officer, Chief Financial Officer, Chief Operating Officer, Managing Member, General Partner, President, Vice President, or Treasurer); or (ii) Any other individual who regularly performs similar functions."

**한국어:** 본 조의 목적상 beneficial owner란 다음의 각자를 뜻한다: (1) 직접 또는 간접으로, 계약·약정·양해·관계 그 밖의 방법을 통하여, 법인 고객(legal entity customer)의 지분의 25% 이상(25 percent or more)을 소유하는 각 개인(있는 경우); 그리고 (2) 법인 고객을 지배·관리·지휘할 중대한 책임을 가진 단일 개인 — (i) 임원 또는 고위 관리자(예: CEO·CFO·COO·Managing Member·General Partner·President·Vice President·Treasurer), 또는 (ii) 이와 유사한 기능을 통상적으로 수행하는 그 밖의 개인.

**쉬운 설명:** 매수인이 법인이면 신원 확인은 한 겹 더 들어간다 — 법인 그 자체의 실재 확인에 더해, 25% 이상 지분 소유자(소유 prong, 최대 4인)와 지배 개인 1인(control prong)의 신원까지. 부등호 주의 — "25 percent or more"는 이상(≥)이라 정확히 25%도 포함이다. A-04 관점에서 이 조문이 주는 것은 entity의 신원 그래프 최소 사양이다 — entity ONCHAINID 뒤에 어떤 자연인들이 확인되어 있어야 하는가. 경계도 분명히 하자 — 이 CDD 수익적 소유자 확인(AML 목적, 25%·control 기준)과 증권법 자격판정의 look-through(A-08/A-09 — QP·AI 판정 목적, 전원 또는 별도 기준)는 목적·기준·깊이가 다른 별개 절차다. 둘을 혼동해 "CDD 했으니 look-through 끝"으로 처리하면 안 된다(§9.1). 참고로 2026-02 FinCEN 예외구제 명령이 이 확인의 반복 부담(계좌 개설 시마다)을 최초 개설 시 등으로 완화했다(§3.15).

**PASS/FAIL 반영:** 조건부 △ — entity 매수인 한정. entity 신원 등록의 전제조건(BO 신원 확인 완료 = beneficialOwnersVerified)으로 반영. 미완이면 entity 온보딩 자체가 보류(REVIEW).

**ERC-3643 변환:** entity ONCHAINID의 claim에 beneficialOwnersVerified = true (Trusted Issuer 확인). BO 각자의 신원 참조(개인 ONCHAINID 또는 off-chain 신원 레코드 해시)는 A-08/A-09의 equityOwners[]와 별도 필드로 관리 — 목적이 다르므로 섞지 않는다.

### 3.9 31 C.F.R. §1032.210(c) — IA AML Rule: 시행 연기 (2028-01-01) [출처: federalregister.gov·ecfr.gov]

**조항:** 31 C.F.R. §1032.210(c) (2025-12-31 최종규칙으로 개정)

**핵심 원문:** "(c) Effective date. An investment adviser must develop and implement an AML/CFT program that complies with the requirements of this section on or before January 1, 2028."

**한국어:** (c) 시행일 — investment adviser는 2028년 1월 1일까지(on or before) 본 조의 요건을 충족하는 AML/CFT 프로그램을 수립·시행하여야 한다.

**쉬운 설명:** 펀드 쪽(자문사) AML 의무의 현황 조항이다. 연혁 — 2024-09-04 최종규칙(89 FR 72156)이 RIA·ERA를 BSA상 "financial institution"에 편입해 AML 프로그램·SAR 의무를 부과했고(원 시행일 2026-01-01), 2025-07 Treasury가 연기·재검토 방침을 발표, 2025-08-05 예외구제 명령으로 우선 면제, 2025-09-22 연기 NPRM, 2025-12-31 최종규칙(관보 2026-01-02)으로 시행일이 2028-01-01로 확정 연기됐다. 같은 발표에서 FinCEN은 SEC와 공동 제안했던 IA용 CIP 규칙(2024-05 제안)도 재검토하겠다고 밝혔다 — 즉 **자문사 측 CIP는 아직 확정 규범이 아니다.** A-04 함의: 현재 규제 지형에서 확립된 CIP 기준은 BD 측(§3.7)이고, 자문사 측은 2028 전후로 바뀔 수 있는 유동 지형이다. Decipher의 온보딩 표준을 BD CIP 수준으로 잡아 두면 IA 측 규범이 어떻게 확정되든 하위 호환된다.

**PASS/FAIL 반영:** 간접 ✕ — 판정 규칙이 아니라 의무 지형의 현황. 시행 전(2028-01-01 이전)이므로 자문사 측 CIP·AML을 근거로 한 판정 요건은 세우지 않고, 추적 항목(OD-A04-5)으로 관리.

**ERC-3643 변환:** 온체인 반영 없음 — Operator plane의 규제 추적 항목. 온보딩 표준은 §3.7(BD CIP) 기준으로 고정.


### 3.10 Exchange Act §12(g)(5) — "회피 방지" 정의 위임 [출처: uscode.house.gov]

**조항:** Securities Exchange Act §12(g)(5), 15 U.S.C. §78l(g)(5)

**핵심 원문:** "(5) For the purposes of this subsection the term "class" shall include all securities of an issuer which are of substantially similar character and the holders of which enjoy substantially similar rights and privileges. The Commission may for the purpose of this subsection define by rules and regulations the terms "total assets" and "held of record" as it deems necessary or appropriate in the public interest or for the protection of investors, in order to prevent circumvention of the provisions of this subsection. For purposes of determining whether an issuer is required to register a security with the Commission pursuant to paragraph (1), the definition of "held of record" shall not include securities held by persons who received the securities pursuant to an employee compensation plan in transactions exempted from the registration requirements of section 5 of the Securities Act of 1933."

**한국어:** (5) 본 subsection의 목적상 "class"는 실질적으로 유사한 성격을 가지고 그 보유자들이 실질적으로 유사한 권리·특권을 누리는 issuer의 모든 증권을 포함한다. SEC는 본 subsection의 목적상, **그 규정의 회피를 방지하기 위하여(in order to prevent circumvention)**, 공익 또는 투자자 보호에 필요·적절하다고 판단하는 바에 따라 규칙·규정으로 "total assets"와 "held of record"를 정의할 수 있다. 제1항에 따른 등록의무 판단 목적상 "held of record"의 정의는, 종업원보상플랜에 따라 §5(1933년 증권법) 등록의무가 면제된 거래로 증권을 취득한 자가 보유한 증권을 포함하지 않는다.

**쉬운 설명:** 의회가 카운팅 용어의 정의권을 SEC에 넘기면서 목적을 명시한 조문이다 — "회피를 방지하기 위하여". 이 문언이 아래 §3.11~§3.12의 카운팅·관통 규칙, 나아가 "머릿수를 쪼개는 보유 형태는 인정하지 않는다"는 규범 전체의 상위 근거다. 온체인 번역: "지갑을 쪼개 사람 수를 위장하는 것"은 §12(g)(5)가 막으라고 명시한 바로 그 circumvention의 디지털 형태이며, A-04의 사람 단위 강제는 이 위임 목적의 구현이다. (D-01 문서 §3.6이 같은 조문을 카운팅 관점에서 다룬다 — 본 부품은 그중 회피 방지 문언을 신원 관점에서 받는다.)

**PASS/FAIL 반영:** 보조 ✕ — 직접 판정 규칙이 아니라 §3.11~§3.12의 상위 위임 근거.

**ERC-3643 변환:** 직접 매핑 없음 — dedup 설계(ONCHAINID 단위 카운팅·(b)(3) 관통)의 규범적 뿌리.

### 3.11 Rule 12g5-1(a)(6) — 유사 명의의 동일인 합산 (dedup의 법적 원형) [출처: ecfr.gov]

**조항:** 17 C.F.R. §240.12g5-1(a) chapeau·(a)(6)

**핵심 원문:** "(a) For the purpose of determining whether an issuer is subject to the provisions of sections 12(g) and 15(d) of the Act, securities shall be deemed to be "held of record" by each person who is identified as the owner of such securities on records of security holders maintained by or on behalf of the issuer, subject to the following: … (6) Securities registered in substantially similar names where the issuer has reason to believe because of the address or other indications that such names represent the same person, may be included as held of record by one person."

**한국어:** (a) issuer가 1934년법 §12(g)·§15(d)의 적용을 받는지 판단하는 목적상, 증권은 issuer가 또는 issuer를 위하여 유지되는 증권 보유자 기록(records of security holders)에 그 소유자로 식별되는 각 자(each person)가 "held of record"하는 것으로 본다. 다만 다음에 따른다: … (6) 실질적으로 유사한 명의로 등록된 증권으로서, issuer가 주소 또는 그 밖의 표지(indications) 때문에 그 명의들이 동일인을 나타낸다고 믿을 이유(reason to believe)가 있는 경우, 1인이 보유하는 것으로 포함할 수 있다(may be included).

**쉬운 설명:** 온체인 dedup의 종이 시대 원형이 이 조문이다. 세 요소를 뜯어 보자. ① 판단 재료 — "주소 또는 그 밖의 표지". 오늘의 번역: 주소·생년월일·신분증 번호·이메일·전화·기기 지문·생체 정보. ② 판단 기준 — "reason to believe"(믿을 이유). 확증이 아니라 합리적 근거 수준이다 — A-04의 SUSPECTED(의심) 단계가 정확히 이 문턱에 대응하고, 확정(CONFIRMED)은 그 위의 조사 결과다. ③ 법적 성격 — "may"(할 수 있다), 즉 **허용 규범** 이다. 같은 사람으로 합쳐 세는 것이 허용되지 이 조항만으로 강제되진 않는다(강제는 다음 §3.12의 몫). Decipher의 설계 선택: 허용을 항상 실행한다 — 온보딩에서 유사 신원을 적극 탐지·통합하는 것이 보수적(카운트를 부풀리지 않고, 자격·한도 잠탈을 막는) 방향이기 때문이다. 두 가지 경계 규칙도 (a)에서 나온다 — 법인·조합·신탁은 그 자체로 1인((a)(2): "shall be included as so held by one person"), 공동소유는 1인((a)(4)). 즉 법인과 그 대표 개인은 **별개의 person** 이고(중복이 아님), 부부 공동명의 지갑은 1인이다.

**PASS/FAIL 반영:** 직접 ○ — dedup 판정의 법적 원형. "동일인이라 믿을 이유"가 성립하는 유사 신원 → SUSPECTED(REVIEW), 조사로 확정 → CONFIRMED_DUPLICATE(FAIL·통합 정정).

**ERC-3643 변환:** dedupBasis ∈ {DOC_MATCH(신분증 동일), BIOMETRIC_MATCH(생체 동일), ATTRIBUTE_CLUSTER(주소·생년월일 등 복합 표지)} — (a)(6)의 "address or other indications"의 구현. dedupStatus = SUSPECTED_DUPLICATE → 운영자 조사 큐.

### 3.12 Rule 12g5-1(b)(3) — 회피 목적 보유형태의 관통 (다지갑 위장의 counter-norm) [출처: ecfr.gov]

**조항:** 17 C.F.R. §240.12g5-1(b)(3)

**핵심 원문:** "(3) If the issuer knows or has reason to know that the form of holding securities of record is used primarily to circumvent the provisions of section 12(g) or 15(d) of the Act, the beneficial owners of such securities shall be deemed to be the record owners thereof."

**한국어:** (3) issuer가, record상 증권 보유의 형태가 1934년법 §12(g) 또는 §15(d) 규정을 회피하기 위하여 주로(primarily) 사용되고 있음을 알거나 알 이유가 있는 경우, 그 증권의 수익적 소유자들(beneficial owners)이 그 record 소유자로 간주된다(shall be deemed).

**쉬운 설명:** §3.11이 "합쳐 셀 수 있다"(may)라면, 이 조항은 "회피 목적이면 명부를 무시하고 실소유자를 센다"(shall)는 **강제 규범** 이다. 요건 두 개 — ① 주관: issuer가 알거나 알 이유가 있을 것(knows or has reason to know), ② 객관: 보유 형태가 주로(primarily) 회피 목적일 것. 온체인의 전형례가 정확히 이 조항의 사정거리다 — 한 사람이 §12(g) 2,000인 관리·Rule 144 한도·자격 게이트를 피하려고 지갑(또는 명의)을 쪼개는 것. 효과는 간주(deemed)라서, 명부(지갑 명의)가 무엇이든 법은 실소유자 기준으로 다시 센다. A-04의 두 동작이 여기서 나온다 — (사전) 그런 형태가 만들어지지 못하게 온보딩에서 중복 신원을 차단하고, (사후) 적발되면 카운트를 실소유자 기준으로 정정하고 forcedTransfer/recovery로 보유를 통합하며 red-flag를 남긴다(D-01 문서의 dedup·회피 정정 항과 동일 규범). 한 가지 균형 — "primarily"라는 한정어 때문에, 정당한 목적의 다지갑(보안상 콜드월렛 분리 등)은 이 조항의 관통 대상이 아니다. 그래서 A-04는 다지갑 자체가 아니라 *별개 신원으로의 위장* 을 금지선으로 삼는다.

**PASS/FAIL 반영:** 직접 ○ — 확정 중복(별개 신원 위장)의 FAIL 근거이자 강제 정정(통합·forcedTransfer)의 법적 정당화. "알거나 알 이유"의 온체인 대응 = dedup 스크리닝·클러스터 신호의 존재.

**ERC-3643 변환:** dedupStatus = CONFIRMED_DUPLICATE → 거래 차단 + 운영 정정: 중복 ONCHAINID 폐합(canonical 신원으로 통합), 잔액은 forcedTransfer()/recovery()로 canonical 신원의 지갑에 재귀속, D-01 카운터 보정, A-12 red-flag 기록.

### 3.13 Rule 501(e) — 매수인 수 산정의 사람 뭉치기 (506(b) 분기 — dormant) [출처: ecfr.gov]

**조항:** 17 C.F.R. §230.501(e)

**핵심 원문:** "(e) Calculation of number of purchasers. For purposes of calculating the number of purchasers under §230.506(b) only, the following shall apply: (1) The following purchasers shall be excluded: (i) Any relative, spouse or relative of the spouse of a purchaser who has the same primary residence as the purchaser; (ii) Any trust or estate in which a purchaser and any of the persons related to him as specified in paragraph (e)(1)(i) or (e)(1)(iii) of this section collectively have more than 50 percent of the beneficial interest (excluding contingent interests); (iii) Any corporation or other organization of which a purchaser and any of the persons related to him as specified in paragraph (e)(1)(i) or (e)(1)(ii) of this section collectively are beneficial owners of more than 50 percent of the equity securities (excluding directors' qualifying shares) or equity interests; and (iv) Any accredited investor. (2) A corporation, partnership or other entity shall be counted as one purchaser. If, however, that entity is organized for the specific purpose of acquiring the securities offered and is not an accredited investor under paragraph (a)(8) of this section, then each beneficial owner of equity securities or equity interests in the entity shall count as a separate purchaser for all provisions of Regulation D (§§230.501-230.508), except to the extent provided in paragraph (e)(1) of this section."

**한국어:** (e) 매수인 수의 산정 — §230.506(b)에 따른 매수인 수 산정의 목적상에만(only), 다음이 적용된다: (1) 다음의 매수인은 제외된다: (i) 매수인과 같은 주된 거주지(the same primary residence)를 쓰는, 매수인의 친족·배우자 또는 배우자의 친족; (ii) 매수인과 (e)(1)(i) 또는 (e)(1)(iii)에 명시된 그의 관계자들이 합산하여 수익적 지분의 50% 초과(more than 50 percent)를 (조건부 지분 제외) 보유하는 신탁 또는 유산; (iii) 매수인과 (e)(1)(i) 또는 (e)(1)(ii)에 명시된 그의 관계자들이 합산하여 지분증권(이사 자격주 제외) 또는 지분의 50% 초과의 수익적 소유자인 법인 또는 그 밖의 조직; 그리고 (iv) 모든 accredited investor. (2) 법인·조합 그 밖의 entity는 1인의 매수인으로 센다. 다만 그 entity가 제공되는 증권의 취득이라는 특정 목적으로 조직되었고 (a)(8)상의 accredited investor가 아닌 경우, 그 entity의 지분증권 또는 지분의 각 수익적 소유자가 Regulation D(§§230.501-230.508)의 모든 규정의 목적상 별개의 매수인으로 센다. 다만 (e)(1)에 규정된 범위에서는 그러하지 아니하다.

**쉬운 설명:** 발행 쪽의 사람 뭉치기 규칙이다 — 같은 집 가족은 제외(사실상 매수인과 한 덩어리), 과반(> 50%, 초과) 지배 신탁·법인도 제외, entity는 1인이되 급조 비-AI entity는 관통해 구성원을 각각 센다. 부등호에 주의 — (e)(1)(ii)·(iii)은 "more than 50 percent"라 정확히 50%는 미달이다(Rule 144(a)(2)의 "10 percent or more"(이상)와 방향이 다르다 — 이 둘을 섞으면 산정 오류). 활성 범위도 명확하다 — 문언상 "§230.506(b) ... only". BUIDL은 506(c)이고 506(c)엔 매수인 수 상한이 없으므로 본 조는 **dormant** 다. 게다가 (iv)가 AI 전원을 제외하므로, 506(b) 분기가 켜져도 전원 AI면 셀 사람이 0이다(D-01의 506(b) 35인 분기와 정합). A-04가 이 조문을 보존하는 이유 — 만약 향후 자산이 506(b) 경로를 쓰면, 35인 산정의 단위가 또다시 "확정된 사람 + 그 뭉치"이기 때문이다.

**PASS/FAIL 반영:** 조건부 △ (dormant) — 506(b) 분기 활성 시에만 D-01의 35인 산정에 사람 뭉치 데이터를 공급. BUIDL 기본 경로에선 판정 미반영.

**ERC-3643 변환:** 506(b) Manifest 분기에서 purchaserGroupRef(같은 거주지 가족·과반 entity 뭉치)를 D-01의 506(b) 카운터에 공급. AI claim 보유자는 산정 제외 플래그.

### 3.14 Rule 144(e)(3)(vi)·예비주해 — concert 합산과 회피설계의 일반 배제 [출처: ecfr.gov]

**조항:** 17 C.F.R. §230.144(e)(3)(vi) 및 §230.144 Preliminary Note (말미)

**핵심 원문:** "(vi) When two or more affiliates or other persons agree to act in concert for the purpose of selling securities of an issuer, all securities of the same class sold for the account of all such persons during any three-month period shall be aggregated for the purpose of determining the limitation on the amount of securities sold;" / (예비주해 말미) "The Rule 144 safe harbor is not available to any person with respect to any transaction or series of transactions that, although in technical compliance with Rule 144, is part of a plan or scheme to evade the registration requirements of the Act."

**한국어:** (vi) 둘 이상의 affiliate 또는 그 밖의 자들이 issuer의 증권을 매도할 목적으로 공동으로 행동하기로(to act in concert) 합의한 때에는, 어느 3개월 기간 중 그 모든 자들의 계산으로 매도된 같은 class의 모든 증권을, 매도량 제한의 판단 목적상 합산한다. / Rule 144 safe harbor는, Rule 144를 기술적으로는 준수하더라도 1933년법 등록 요건을 회피하기 위한 계획 또는 책략(plan or scheme)의 일부인 거래 또는 일련의 거래에 관하여는, 어느 누구에게도 이용될 수 없다.

**쉬운 설명:** 재판매 쪽의 두 안전핀이다. (vi)은 별개의 사람들이라도 팔기로 짬짜미하면 합산한다 — 합산 실행은 C-08의 영역이지만, "그 자들"이 각각 누구인지, 그리고 애초에 한 사람이 여러 지갑으로 '여러 자들'인 척한 것은 아닌지가 전제라서 A-04가 깔려야 (vi)이 작동한다. 예비주해는 더 일반적이다 — 조문을 글자대로 지켜도 회피 설계면 safe harbor가 닫힌다. 지갑 쪼개기로 각 지갑을 한도 이내로 맞추는 것은 "technical compliance + plan or scheme to evade"의 교과서적 형태이고, 이 문장이 그런 설계 전체를 무효화한다.

**PASS/FAIL 반영:** 보조 ✕ — A-04 자체의 판정 규칙이 아니라, C-08 합산의 사람 전제 + 회피 설계에 대한 일반적 법적 배제. 중복 적발 시 관련 매도를 소급 재평가할 근거.

**ERC-3643 변환:** 온체인 직접 매핑 없음 — C-08의 aggregation 입력(ONCHAINID·personGroupRef·concert 플래그)의 규범적 배경. concert 합의의 탐지는 F-02(시장감시)·운영 조사 영역.

### 3.15 발행문서·행정명령 (Layer 3) — CIP의 경계와 BSA 지형의 현황 [출처: sec.gov·fincen.gov·federalregister.gov]

Layer 3는 판례 대신 채택 release와 FinCEN 행정문서가 채운다. A-04에 실질적 의미가 있는 것은 넷이다.

- **CIP 공동 채택 release (Treasury/FinCEN·SEC, 2003-05-09).** broker-dealer CIP 규칙(§3.7)을 채택하며 "customer"의 경계를 그었다 — customer는 **명의상 계좌 보유자(named accountholder)** 이고, CIP 목적상 broker-dealer는 신탁을 그 수익자까지, 옴니버스 계좌를 그 배후 실소유자까지 들여다볼 필요가 없다고 밝혔다(release 원문: "a broker-dealer is not required to look through a trust, or similar account to its beneficiaries, and is required only to verify the identity of the named accountholder"). A-04 함의 — **CIP의 신원 확정(accountholder 단위)과 증권법 자격판정의 look-through(A-08/A-09 — 구성원 단위)는 깊이가 다른 별개 요구** 다. CDD 규칙(§3.8, 2016)이 법인 고객에 한해 BO 확인을 추가했지만, 그래도 자격판정 look-through를 대체하지 않는다. 이 경계를 §9.1의 책임 분배에 그대로 새긴다.

- **IA AML Rule 시행 연기 (2025-07 발표 → 2025-08-05 예외구제 명령 → 2025-09-22 NPRM → 2025-12-31 최종규칙, 관보 2026-01-02).** §3.9에서 본 대로 자문사 측 AML 의무는 2028-01-01로 연기됐고, FinCEN은 그 사이 규칙 실체와 SEC 공동 CIP 제안을 재검토한다고 밝혔다. 현황의 고정점: **2026-07 현재 자문사 측 CIP·AML은 시행 전.**

- **CDD 예외구제 명령 (FinCEN, 2026-02).** 법인 고객의 BO 확인·검증(§3.8)을 계좌 개설 시마다 반복하는 대신 — ① 최초 계좌 개설 시, ② 기존 정보의 신뢰성을 의심할 사실을 알게 된 때, ③ 위험기반 필요 시 — 로 한정하는 예외를 부여했다. A-04 함의: entity 신원 그래프의 갱신 주기를 "매 거래"가 아니라 "온보딩 + 이벤트 기반"으로 설계하는 것이 현행 규제 실무와 정합한다.

- **Release No. 33-9415 (2013).** 506(c) 검증은 특정 방법의 강제가 아니라 사실관계에 따른 객관적 판단이라는 프레임(상세는 A-03 문서). A-04에는 배경 — 어떤 검증 방법을 쓰든 그 방법이 겨누는 대상(사람)의 신원이 먼저라는 구조는 불변이다.

**PASS/FAIL 반영:** 보조 ✕ — 판정 규칙이 아니라 경계 해석(CIP vs look-through)과 규제 지형의 현황 고정.

**ERC-3643 변환:** entity claim의 갱신 정책(이벤트 기반 재확인)과 §9.1 책임 경계표의 근거. 온체인 필드 신설 없음.


### 3.16 Sub-요건 분해 매트릭스

위 조문·규칙을 실무 판정 path로 분해하면 아래와 같다. 각 행은 §5.2의 분기와 1:1로 대응하며, 소리 내 읽어도 문장이 되도록 풀어 썼다.

| 판정 path | 충족/발동 조건 (풀어 읽기) | 근거 | 결과 (§5.2·§6.2) | Decipher 복잡도 |
| --- | --- | --- | --- | --- |
| P1 등록·유일 신원 | 이 지갑은 IdentityRegistry에 등록되어 있고, 그 ONCHAINID의 KYC claim이 유효하며, 상태가 ACTIVE이고, 중복 판정이 UNIQUE다 | §5318(l)·1023.220 + 12g5-1(a) | PASS | 낮음 — registry 조회 |
| P2 동일인의 추가 지갑 | 이미 검증된 사람이 새 지갑을 자기 ONCHAINID에 추가 바인딩했다 — 새 신원이 아니므로 정상 | 12g5-1(b)(3)의 반대해석 ("primarily to circumvent" 아님) + (a)(4) 공동소유 1인 | PASS (지갑 N개 = 사람 1) | 낮음 — 바인딩 확인 |
| F1 미등록 | 지갑이 어떤 ONCHAINID에도 매핑되어 있지 않다 | §5318(l)(2)(A)·1023.220(a)(2) — 신원 미검증 | FAIL_IDENTITY_NOT_REGISTERED | 낮음 |
| F2 claim 부재/위조/비신뢰 발급 | ONCHAINID는 있으나 KYC claim이 없거나, 서명이 무효거나, 발급자가 Trusted Issuers Registry에 없다 | 1023.220(a)(2) "reasonable belief ... true identity" 미형성 | FAIL_KYC_CLAIM_MISSING / _INVALID_SIG / FAIL_UNTRUSTED_KYC_ISSUER | 낮음 — 암호 검증 |
| F3 claim 만료 | KYC claim의 유효기간이 지났다 (시간 산술·상한은 A-11) | 1023.220의 지속적 신뢰 유지 + Decipher 정책 | FAIL_KYC_CLAIM_EXPIRED (A-11 공유) | 낮음 |
| F4 신원 동결/취소 | 신원이 red-flag·조사·법집행 사유로 FROZEN이거나 REVOKED다 | 1023.220(a)(2)(iii) 검증 불능 대응·(a)(4) 명단 대조 | FAIL_IDENTITY_FROZEN / _REVOKED | 낮음 |
| F5 확정 중복 | 같은 자연인(또는 같은 법인)이 별개의 ONCHAINID 2개 이상으로 존재함이 확정됐다 | 12g5-1(b)(3) (shall be deemed — 강제 관통) + (a)(6) | FAIL_DUPLICATE_IDENTITY + 운영 정정(폐합·재귀속) | 중간 — 정정 절차 수반 |
| R1 중복 의심 | 주소·생년월일·문서·생체 등 표지로 동일인이라 믿을 이유(reason to believe)는 있으나 확정 전이다 | 12g5-1(a)(6) 문턱 | REVIEW_IDENTITY_DUPLICATE_SUSPECTED → 조사 큐 | 중간 — 사람 판단 |
| C1 entity BO 미확인 (조건부) | 매수인이 법인인데 수익적 소유자(≥ 25% + control 1인)의 신원 확인이 미완이다 | 1010.230(d) | 온보딩 보류 (REVIEW — 거래 이전 단계) | 중간 |
| D1 사람 뭉치 공급 (조건부) | Rule 144 매도 시 (a)(2) 그룹, 506(b) 분기 시 501(e) 뭉치를 구성해 하류에 공급한다 | 144(a)(2)·501(e) | A-04 판정 아님 — C-08·D-01 입력 | 중간 — off-chain 실사 |

**해설:** P1·F1~F4는 registry 스냅샷의 결정론 판정(싸고 빠름)이고, F5·R1은 온보딩·운영 단계에서 확정된 dedup 상태를 읽는 판정이다 — 즉 비싼 판단(유사도·조사)은 거래 경로 밖에서 끝나고, 거래 시점의 check()는 전 경로가 O(1) 조회다. P2가 이 부품의 정체성을 요약한다 — **금지되는 것은 다지갑이 아니라 다신원** 이다. C1·D1은 A-04가 게이트가 아니라 데이터 공급자로 일하는 조건부 경로다.

### 3.17 ERC-3643 변환 총정리 — Identity Registry 매핑 (claim.basis 갈래 없음)

A-04는 A-13류의 자격 갈래(claim.basis enum)를 쓰지 않는다 — 자격의 "종류"를 판정하는 부품이 아니라 신원의 "존재·유일성"을 판정하는 부품이기 때문이다. 대신 ERC-3643/T-REX의 신원 계층(ONCHAINID + Identity Registry + Trusted Issuers Registry) 그 자체에 매핑되며, KYC claim 하나(topic 고정)와 신원 상태 필드들로 변환된다. 핵심 원칙 — 유사도 계산·문서 대조·생체 매칭 같은 비결정적 판단은 전부 off-chain(Trusted Issuer·운영)에서 확정하고, 온체인에는 그 결과인 결정적 상태값만 올린다.

**표 1 — 조항 → ERC-3643 변환**

| 조항 | ERC-3643 변환 | 간략 설명 |
| --- | --- | --- |
| Rule 506(c)(2)(i)·§4(d)(1) purchaser 단위 | IdentityRegistry.isVerified(buyer) 선행 게이트 | 매수인 지갑이 검증된 ONCHAINID에 바인딩돼야 어떤 자격 판정도 시작 |
| Rule 506(c)(2)(ii) 검증의 귀속 | claim은 지갑이 아니라 ONCHAINID에 발급 (ERC-735) | 지갑 교체·추가에도 검증 이력이 사람 단위로 승계 |
| Rule 144(a)(2) person 확장 | ONCHAINID metadata의 personGroupRef | C-08 합산·A-06 판정의 그룹 단위 공급 |
| §5318(l)·1023.220 CIP | 온보딩 파이프라인 사양: KYC 완료 → claim 발급 → registry 등록 | "true identity에 대한 reasonable belief" = claim 발급 조건 |
| 1023.220(a)(2)(iii) 검증 불능 대응 | identityStatus = FROZEN + 거래 차단 + 조사 큐 | 계좌 미개설·제한·폐쇄·SAR 검토의 온체인 대응물 |
| 1010.230 CDD (entity) | entity claim의 beneficialOwnersVerified 플래그 | ≥ 25% 소유자 + control 1인 신원 확인 완료 표시 |
| §12(g)(5)·12g5-1(a)(6) dedup | off-chain dedup 스크리닝 → dedupStatus 확정값 | "reason to believe" 문턱 = SUSPECTED, 조사 확정 = CONFIRMED |
| 12g5-1(b)(3) 관통·정정 | 중복 폐합 + forcedTransfer()/recovery() + D-01 카운터 보정 | "shall be deemed" — 실소유자 기준의 강제 재귀속 |
| 12g5-1(a)(2)·(a)(4) 경계 | 법인 ONCHAINID = 개인과 별개 1인 · 공동명의 지갑 = 1 ONCHAINID | 중복 오탐 방지의 경계 규칙 |
| Rule 501(e) (dormant) | 506(b) Manifest 분기의 purchaserGroupRef | 35인 산정용 뭉치 — BUIDL 기본 경로 미사용 |
| §3(c)(7)(A) 비자발적 이전 | recovery/forcedTransfer 수취인도 신원 등록 선행 | 신원 없는 지갑으로의 강제 이전 금지 (§11.4) |

**표 2 — 필드·플래그 총정리**

| 항목 | 필드/값 | 간략 설명 |
| --- | --- | --- |
| KYC claim | claim.topic = KYC_IDENTITY | Trusted Issuer 서명, ONCHAINID에 부착 |
| claim 메타 | claim.issuer · claim.signature · claim.verifiedAt · claim.expiry | 진위(F2)·신선도(F3, A-11) 판정 재료 |
| 지갑 매핑 | identityRegistry.identity(wallet) → ONCHAINID | 존재(F1) 판정 — 사람 단위의 축 |
| 다지갑 | linkedWallets[] (같은 ONCHAINID에 N개 바인딩) | P2 — 다지갑 허용, 다신원 금지 |
| 사람 유형 | personType ∈ {NATURAL, ENTITY} | 12g5-1(a)(2) 경계 — 법인은 별개 1인 |
| 중복 상태 | dedupStatus ∈ {UNIQUE, SUSPECTED_DUPLICATE, CONFIRMED_DUPLICATE} | (a)(6) 문턱·(b)(3) 확정의 결정적 표현 |
| 중복 근거 | dedupBasis ∈ {DOC_MATCH, BIOMETRIC_MATCH, ATTRIBUTE_CLUSTER, CHAIN_HEURISTIC} | 조사 기록용 (off-chain 상세, 온체인 enum) |
| 신원 상태 | identityStatus ∈ {ACTIVE, FROZEN, REVOKED} | 1023.220(a)(2)(iii) 대응 — F4 |
| canonical 참조 | canonicalIdentity (CONFIRMED_DUPLICATE 시) | 폐합된 중복 신원이 가리키는 정본 신원 |
| 그룹 참조 | personGroupRef (144(a)(2)) · purchaserGroupRef (501(e), dormant) | C-08·D-01 공급용 |
| entity 확인 | beneficialOwnersVerified = true/false | 1010.230 BO 확인 완료 (entity 한정) |
| 국가 | investorCountry (Identity Registry 표준 필드) | A-02 소비 — A-04는 저장 경로만 공유 |
| 판정 함수 | check_A_04(wallet) → PASS/FAIL/REVIEW + reasonCode | §5.2 — 전 경로 O(1) 조회 |


## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

지갑 하나를 판정하려면 네 묶음의 사실이 필요하다 — ① 이 지갑이 **어느 사람(ONCHAINID)** 의 것인가(매핑), ② 그 사람의 신원이 **검증되어 있는가**(KYC claim의 존재·서명·발급자·유효기간), ③ 그 사람이 시스템 안에서 **유일한가**(dedup 상태 — 유사 신원 스크리닝의 확정 결과), ④ 그 신원이 지금 **정상 상태인가**(동결·취소 아님). 법인 매수인이면 ⑤ 수익적 소유자 신원 확인 완료 여부가 추가된다. ①~④는 매 거래의 판정 재료이고, 그 재료를 만들어 내는 실사(문서 대조·생체 매칭·주소 클러스터링)는 전부 온보딩·운영 단계의 off-chain 작업이다 — §5.5의 결정성 원칙.

### 4.2 Data field — DEX가 실제로 읽는 항목

| 필드 | 타입 | 의미 | 출처 |
| --- | --- | --- | --- |
| wallet | address | 판정 대상 지갑 (from/to 각각) | 거래 파라미터 |
| onchainId | address | identityRegistry.identity(wallet) — 지갑이 바인딩된 신원 | Identity Registry (on-chain) |
| linkedWallets[] | address[] | 같은 onchainId에 바인딩된 지갑 목록 | Identity Registry Storage |
| personType | enum | NATURAL / ENTITY | KYC claim (검증기관) |
| kycClaim.topic | uint | KYC_IDENTITY (고정) | Trusted Issuer |
| kycClaim.issuer | address | 발급 검증기관 — Trusted Issuers Registry 등재 여부 확인 | Trusted Issuer |
| kycClaim.signature | bytes | 서명 — 위조 여부의 암호학적 판정 재료 | Trusted Issuer |
| kycClaim.verifiedAt / expiry | uint | 검증 시점·만료 — 신선도(A-11 위임) | Trusted Issuer |
| identityStatus | enum | ACTIVE / FROZEN / REVOKED | 운영(agent) 이벤트 |
| dedupStatus | enum | UNIQUE / SUSPECTED_DUPLICATE / CONFIRMED_DUPLICATE | 온보딩 dedup + 운영 조사 확정 |
| dedupBasis | enum | DOC_MATCH / BIOMETRIC_MATCH / ATTRIBUTE_CLUSTER / CHAIN_HEURISTIC | dedup 스크리닝 (off-chain) |
| canonicalIdentity | address | CONFIRMED_DUPLICATE 시 정본 신원 참조 | 운영 정정 |
| personGroupRef | bytes32 | Rule 144(a)(2) 사람 뭉치 해시 (동거 친족·≥ 10% 신탁/법인) | KYC 실사 → C-08·A-06 공급 |
| purchaserGroupRef | bytes32 | Rule 501(e) 뭉치 (506(b) dormant) | KYC 실사 → D-01 공급 |
| beneficialOwnersVerified | bool | 1010.230 BO(≥ 25% + control 1인) 신원 확인 완료 (entity 한정) | Trusted Issuer 실사 |
| investorCountry | uint16 | 신원의 국가 — A-02 소비 | Identity Registry 표준 필드 |

온체인에 개인정보(이름·생년월일·신분증 번호·생체 원본)는 올라가지 않는다 — 그런 원자료는 off-chain 신원 원장(검증기관·운영주체 보관, 1023.220(a)(3)의 5년 보존)에 남고, 온체인에는 서명된 claim과 위 상태값만 존재한다. dedup 스크리닝이 쓰는 원자료(문서 이미지·생체 템플릿·주소)도 마찬가지다 — 온체인 dedupStatus는 그 스크리닝의 **결과** 만 담는다.

### 4.3 수집 경로 — 5단계 흐름

- **① 신청 (frontend).** 매수 희망자가 지갑을 연결하고 온보딩을 신청한다 — 자연인/법인 선택, 기본 정보 입력. 이 단계의 자기신고는 경로 안내용이지 증거가 아니다.

- **② KYC 실사 (Sumsub 모델).** 정부 발급 사진 신분증 + liveness(실물 대면성) 확인 + 문서 진위 검사 — 1023.220(a)(2)(ii)의 문서적·비문서적 방법 조합. 법인이면 설립 문서·실재 확인 + 1010.230의 BO(≥ 25% 소유자, control 1인) 신원 확인.

- **③ dedup 스크리닝 (핵심).** 신규 신청 신원을 기존 신원 전체와 대조한다 — 신분증 번호·문서 해시의 정확 일치(DOC_MATCH), 생체 템플릿 유사도(BIOMETRIC_MATCH), 이름·생년월일·주소·연락처·기기 지문의 복합 표지(ATTRIBUTE_CLUSTER). 12g5-1(a)(6)의 "address or other indications ... reason to believe"의 구현이다. 결과 — 일치 없음 → 신규 등록 진행 / 확정 일치 → 신규 등록 거절 + 기존 신원으로 안내(지갑 추가 바인딩 경로) / 애매한 유사 → SUSPECTED로 운영 조사 큐.

- **④ claim 발급 + 신원 생성/바인딩 (Trusted Issuer).** 실사·스크리닝 통과 시 — 신규면 ONCHAINID 배포 + KYC_IDENTITY claim 서명 발급, 기존인의 추가 지갑이면 **새 신원을 만들지 않고** 기존 ONCHAINID에 지갑을 바인딩(P2 경로). 이 갈림길이 A-04의 심장이다.

- **⑤ Identity Registry 등록 (on-chain).** 지갑↔ONCHAINID 매핑과 investorCountry를 registry에 기록. 이때부터 check_A_04가 O(1)로 읽을 수 있는 상태가 된다.

### 4.4 갈래별 필수 확인 항목 (전체 표)

"예시"가 아니라 갈래별로 반드시 확인해야 하는 항목 전체다. 공통 행은 모든 갈래에 적용된다.

| 갈래 | 필수 확인 항목 (전부 충족) | 근거 |
| --- | --- | --- |
| 공통 (모든 갈래) | ① 정부 발급 신원 문서의 진위 ② liveness/실재 확인 ③ dedup 스크리닝 수행·결과 기록 ④ Trusted Issuer의 claim 서명 ⑤ claim 유효기간 설정(A-11 연동) ⑥ 제재 명단 스크리닝 통과(A-01 — 신원 속성 기반) | §5318(l)(2)·1023.220(a)(2)(4)·12g5-1(a)(6) |
| 자연인 신규 | ① 사진 신분증 + 생체 대조 ② 이름·생년월일·주소·식별번호 확보(1023.220(a)(2)(i) 최소 항목) ③ 기존 신원 전체와의 dedup 무일치 | 1023.220(a)(2)(i)·(ii) |
| 법인(entity) 신규 | ① 설립 문서·법인 실재 확인 ② BO 소유 prong(≥ 25% 각자)·control prong(1인)의 자연인 신원 확인 ③ 법인 자체의 dedup(설립번호·명칭·주소) ④ personType = ENTITY 기록 — 대표 개인의 신원과 별개 유지(12g5-1(a)(2)) | 1010.230(d)·12g5-1(a)(2) |
| 추가 지갑 바인딩 (기존인) | ① 기존 ONCHAINID 보유자 본인 확인(재인증) ② 새 지갑의 소유 증명(서명 챌린지) ③ **신규 신원 생성 금지** — 바인딩만 ④ linkedWallets 갱신 | 12g5-1(b)(3) 반대해석·(a)(4) |
| 공동명의/공유 지갑 | ① 공동 보유자 전원의 개별 KYC ② 지갑은 대표 1 ONCHAINID(공동체)로 등록하되 구성 개인 참조 유지 — 카운트 1인(12g5-1(a)(4)) | 12g5-1(a)(4) |
| Rule 144 매도 예정자 (R2) | ① (a)(2) 그룹 실사 — 동거 친족, ≥ 10% 신탁/법인 ② personGroupRef 구성·서명 ③ affiliate 여부는 A-06로 인계 | 144(a)(2) |
| 키 분실 recovery | ① 본인 재인증(원 KYC 자료 대조 — 새 KYC가 아니라 동일인 확인) ② 새 지갑을 **같은 ONCHAINID** 에 바인딩 ③ recovery()로 잔액 이관 ④ 재온보딩(새 신원) 절대 금지 | 12g5-1(b)(3)·(a)(6) |


## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.0 판정 흐름 플로우차트

아래 그림은 §5.2의 check_A_04 pseudocode를 흐름으로 옮긴 것이다 — 지갑 입력부터 존재(등록) → 진위(claim·발급자) → 신선도(A-11) → 상태(동결) → 중복(dedup) 판정, 그리고 PASS·각 FAIL code·REVIEW 반환까지. 점선의 온보딩 박스는 이 흐름이 읽는 상태를 사전에 확정해 두는 off-chain 파이프라인이다.

**범례.** 파랑 = 입력 · 회색 다이아몬드 = 분기 노드 · 초록 = PASS · 빨강 = FAIL code · 주황 = 수동 검토(REVIEW) · 보라 = 온보딩 파이프라인(off-chain).

![A-04 런타임 검증 흐름](A-04_fig50.png)

### 5.1 전체 흐름 (사람 말로)

거래 요청이 오면, 온체인 코드는 from·to 각 지갑에 대해 다음 순서로 확인한다 — ① 이 지갑이 등록된 사람의 것인가 → ② 그 사람의 신원 증명(KYC claim)이 진짜이고 신뢰기관 발급인가 → ③ 유효기간이 지나지 않았는가 → ④ 신원이 동결·취소 상태가 아닌가 → ⑤ 그 사람이 시스템 안에서 유일한가(중복 아님) → ⑥ PASS 또는 구체적 FAIL code/REVIEW 반환. 여기서 판단다운 판단(유사도·조사)은 하나도 없다 — 전부 온보딩·운영이 미리 확정해 둔 값을 읽을 뿐이다.

### 5.2 Pseudocode + 단계별 해설

**검사 순서 한눈에 보기 — 왜 이 순서인가**

| 순서 | 검사 | 무엇을 확인 | 실패 코드 | 비용 | 왜 이 위치인가 |
| --- | --- | --- | --- | --- | --- |
| 1 | 존재 | 지갑→ONCHAINID 매핑이 있나 | FAIL_IDENTITY_NOT_REGISTERED | 매우 낮음 | 매핑이 없으면 판정할 사람 자체가 없음 — 최전방 fail-fast |
| 2 | 진위 | KYC claim 존재 + 서명 유효 + 발급자가 Trusted Issuers Registry 등재 | FAIL_KYC_CLAIM_MISSING / _INVALID_SIG / FAIL_UNTRUSTED_KYC_ISSUER | 낮음 (암호 검증) | 위조 신원이면 이후 모든 필드(status·dedup)를 신뢰 불가 — 진위가 하류 검사의 전제 |
| 3 | 신선도 | claim 유효기간 내인가 (산술은 A-11) | FAIL_KYC_CLAIM_EXPIRED | 낮음 (timestamp 비교) | 싸고 탈락 잘 되는 게이트 — 상태·중복 확인 전에 거른다 |
| 4 | 상태 | identityStatus = ACTIVE인가 | FAIL_IDENTITY_FROZEN / _REVOKED | 낮음 | 동결 신원은 중복 여부와 무관하게 차단 — 조사 중 거래 방지 |
| 5 | 중복 | dedupStatus 판독 (온보딩 확정값) | FAIL_DUPLICATE_IDENTITY / REVIEW_..._SUSPECTED | 낮음 (enum 판독) | 가장 무거운 판단(스크리닝·조사)의 결과만 읽는다 — 판단 자체는 거래 경로 밖 |

두 그림이 같은 순서를 다르게 그릴 뿐임을 보이는 대조표:

| 검사 | §5.2 pseudocode | §5.0 흐름도(fig50) |
| --- | --- | --- |
| 1 존재 · 2 진위 | 1·2단계로 명시 | ①·② 다이아몬드 |
| 3 신선도 | 3단계 (A-11 호출) | ③ 다이아몬드 |
| 4 상태 · 5 중복 | 4·5단계 | ④·⑤ 다이아몬드 |
| 온보딩 파이프라인 | 코드 밖 전제 (주석) | 보라 박스 (점선 "사전 공급") |

→ 두 표현 모두 **싼 전제(존재·진위·신선도)로 fail-fast한 뒤, 무거운 판단은 아예 거래 경로 밖** — 동일 구조다.

    function check_A_04(wallet, block):
        # 1단계: 존재 — 지갑→사람 매핑
        oid = IdentityRegistry.identity(wallet)
        if oid == null:
            return FAIL_IDENTITY_NOT_REGISTERED

        # 2단계: 진위 — KYC claim·발급자
        claim = ONCHAINID(oid).getClaim(Topic.KYC_IDENTITY)
        if claim == null:
            return FAIL_KYC_CLAIM_MISSING
        if not Cryptography.verify(claim.signature, claim.issuer):
            return FAIL_KYC_CLAIM_INVALID_SIG
        if not TrustedIssuersRegistry.contains(claim.issuer, Topic.KYC_IDENTITY):
            return FAIL_UNTRUSTED_KYC_ISSUER

        # 3단계: 신선도 — 시간 산술은 A-11에 위임 (같은 시계·같은 규율)
        if not check_A_11(claim, block):
            return FAIL_KYC_CLAIM_EXPIRED

        # 4단계: 상태 — 동결/취소
        st = IdentityRegistry.identityStatus(oid)
        if st == FROZEN:  return FAIL_IDENTITY_FROZEN
        if st == REVOKED: return FAIL_IDENTITY_REVOKED

        # 5단계: 중복 — 온보딩·운영이 확정해 둔 결정적 값 판독
        dd = IdentityRegistry.dedupStatus(oid)
        if dd == CONFIRMED_DUPLICATE:
            return FAIL_DUPLICATE_IDENTITY      # 12g5-1(b)(3) — 정정 절차 병행 (§6.5)
        if dd == SUSPECTED_DUPLICATE:
            return REVIEW_IDENTITY_DUPLICATE_SUSPECTED   # 12g5-1(a)(6) 문턱 — 조사 큐 (§6.3)

        return PASS    # 등록·진위·유효·정상·유일 — 이 지갑 = 검증된 유일 신원

    # 거래 게이트에서의 호출: from·to 각각 — 어느 한쪽 실패면 거래 불성립
    function gate(from, to, block):
        r1 = check_A_04(from, block); if r1 != PASS: return r1
        r2 = check_A_04(to, block);   if r2 != PASS: return r2
        return PASS

**단계별 해설.**

- **1단계 (존재).** ERC-3643 토큰의 표준 동작 자체가 이 단계를 내장한다 — transfer는 수취인이 Identity Registry에서 검증된 상태(isVerified)여야 성립한다. check_A_04는 그 표준 동작을 부품 인터페이스(reasonCode 반환)로 감싼 것이다. 미등록 지갑은 "새 매수인"이 아니라 "아직 사람이 아님"이다.

- **2단계 (진위).** 서명 검증은 위조 claim을, Trusted Issuers Registry 대조는 "서명은 유효하나 발급 권한이 없는 자"를 거른다. 발급기관이 사후에 신뢰 목록에서 제거되면 그 기관 발급 claim 전체가 이 단계에서 걸린다 — 검증기관 사고에 대한 시스템 차원의 차단기다.

- **3단계 (신선도).** 시간 산술을 A-11에 위임하는 이유는 규율 통일이다 — AI claim 5년(Rule 506(c)(2)(ii)(E))·QP claim 1년(정책)과 같은 방식으로, KYC claim의 유효기간도 하나의 시계·하나의 만료 로직으로 관리한다. KYC claim의 상한값 자체는 정책 사항이다(OD-A04-2가 아니라 A-11 정책표의 항목).

- **4단계 (상태).** FROZEN은 조사·red-flag·법집행 협조 중의 일시 차단(해제 가능), REVOKED는 신원 취소(위조 확정 등 — 재온보딩 외 해제 불가)다. 1023.220(a)(2)(iii)가 요구하는 "검증 불능 시의 대응 절차"의 온체인 표현이다.

- **5단계 (중복).** 이 단계가 읽는 dedupStatus는 3값 enum일 뿐이다 — 유사도 점수도, 매칭 알고리즘도 체인에 없다. CONFIRMED는 차단 + 정정(§6.5), SUSPECTED는 차단이 아니라 REVIEW다 — 동명이인 같은 위양성이 존재하므로, 확정 전 차단은 정당한 이용자를 해친다(§7의 T5).

### 5.3 판정 기준 매트릭스 (경계 규율)

A-04에는 금액 임계값이 없다 — 대신 카운팅 단위의 등식 규율이 있다.

| 항목 | 규칙 | 근거 | 위반 시 |
| --- | --- | --- | --- |
| 사람당 신원 수 | 자연인/법인 1 = ONCHAINID 정확히 1 | 12g5-1(a)(6)·(b)(3) | 2개 이상 = CONFIRMED_DUPLICATE |
| 신원당 지갑 수 | 제한 없음 (N ≥ 1 허용) — 전부 같은 ONCHAINID에 바인딩 | (b)(3) "primarily to circumvent" 아님 | 바인딩 없는 별도 신원화 = 중복 |
| 법인 vs 그 소유자 | 별개 person 각 1 (합쳐 세지 않음) | 12g5-1(a)(2) | 단, 회피 목적 구조면 (b)(3) 관통 |
| 공동명의 | 지갑 1 = 공동체 ONCHAINID 1 (구성 개인 참조 유지) | 12g5-1(a)(4) | — |
| 144(a)(2) 그룹 | 그룹 ≠ 신원 통합 — 신원은 각자, 합산만 그룹 | 144(a)(2) | 그룹 누락 시 C-08 판정 불능 |
| 하류 카운팅 단위 | D-01·C-08·F-01은 지갑이 아니라 ONCHAINID | 12g5-1(a)·(b)(3) | 지갑 단위 집계 = 회피 창구 |

### 5.4 두 개의 시점 — 온보딩 시점과 거래 시점

A-04의 판단은 시점이 둘로 갈린다. **온보딩 시점** 에는 무거운 판단이 일어난다 — 문서 진위, 생체 매칭, 유사 신원 스크리닝, entity BO 확인. 여기의 산출물이 registry 상태다. **거래 시점** 에는 판단이 없다 — check_A_04는 그 상태의 스냅샷 판독이고, 결과는 같은 블록의 같은 상태에 대해 항상 같다(결정론). 이 분리 덕에 A-04는 STATELESS Element로 남는다 — 거래가 A-04의 상태를 바꾸지 않는다(카운터를 갱신하는 D-01과 대비). 상태를 바꾸는 것은 온보딩·운영 이벤트(등록·바인딩·동결·확정·폐합)뿐이고, 그 이벤트들은 거래 commit 경로 밖의 agent·Trusted Issuer 권한으로 일어난다. 한 가지 시간 경계 — 거래 시점에 SUSPECTED로 REVIEW에 간 거래는, 조사 확정(UNIQUE 복귀 또는 CONFIRMED) *후의 새 거래 시도* 로만 재개된다. 보류 중 상태 변경을 소급 적용해 이미 거절된 거래를 살리지 않는다(판정의 시점 고정 — A-13 §5.4의 취득 시점 스냅샷 원칙과 같은 규율).

### 5.5 비결정성을 결정성으로 — 본 부품 구현의 본질

"이 두 신원이 같은 사람인가"는 본질적으로 확률적 판단이다 — 생체 유사도는 점수이고, 주소 일치는 정황이며, 동명이인은 실재한다. 이 비결정성을 체인에 올리면 같은 입력에 노드마다 다른 답이 나올 수 있고, 게이트가 오락가락한다. A-04의 해법은 A-13(자격의 실체 판단을 off-chain claim으로)·C-01(날짜 산술의 보수적 규약화)과 같은 계보다 — **비결정적 판단을 신뢰 주체가 off-chain에서 확정하고, 체인은 그 확정값(3값 enum)만 결정론적으로 읽는다.** 문턱은 법이 준다: "reason to believe"(12g5-1(a)(6)) 수준의 신호 = SUSPECTED, 조사로 확정 = CONFIRMED. 유사도 점수를 어느 값에서 SUSPECTED로 넘길지는 법이 정하지 않은 운영 파라미터라 §12(OD-A04-2)의 결정 사항으로 남긴다.


## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

A-04의 실패는 성격이 셋으로 갈린다. ① **서류로 고칠 수 있는 실패**(미등록·claim 만료) — 온보딩/재검증이라는 명확한 cure가 있다. ② **조사가 필요한 상태**(중복 의심·동결) — 차단이 아니라 보류이고, 사람이 판단해 풀거나 확정한다. ③ **구조적 실패**(확정 중복·신원 취소) — 개별 서류로 못 풀고, 정정 절차(폐합·재귀속)나 재온보딩이 필요하다. 어느 경우든 절대 규칙 하나 — **cure는 언제나 기존 신원 쪽으로 수렴한다.** "새 신원을 만들어 다시 시도"는 cure가 아니라 위반의 반복이다.

### 6.2 Failure codes

| reasonCode | 발동 조건 | 근거 | cure |
| --- | --- | --- | --- |
| FAIL_IDENTITY_NOT_REGISTERED | 지갑→ONCHAINID 매핑 없음 | §5318(l)·1023.220 | 온보딩 완주 (§4.3) 또는 기존인의 지갑 바인딩 |
| FAIL_KYC_CLAIM_MISSING | 신원은 있으나 KYC claim 부재 | 1023.220(a)(2) | Trusted Issuer 재발급 |
| FAIL_KYC_CLAIM_INVALID_SIG | claim 서명 무효 (위조 의심) | 1023.220(a)(2) | 재발급 + 위조 경위 조사 (A-12 red-flag) |
| FAIL_UNTRUSTED_KYC_ISSUER | 발급자가 Trusted Issuers Registry 비등재 | ERC-3643 신뢰 모델 | 등재 기관 재검증 |
| FAIL_KYC_CLAIM_EXPIRED | claim 유효기간 경과 (A-11 판정) | A-11 정책 | 재검증 (새 verifiedAt) — 운영자 임의 연장 불가 |
| FAIL_IDENTITY_FROZEN | 조사·red-flag·법집행 사유 동결 | 1023.220(a)(2)(iii) | 조사 종결 후 운영 해제 (§6.3) |
| FAIL_IDENTITY_REVOKED | 신원 취소 (위조 확정 등) | 1023.220(a)(2)(iii) | 없음 — 진정한 본인이라면 신규 온보딩부터 |
| FAIL_DUPLICATE_IDENTITY | dedupStatus = CONFIRMED_DUPLICATE | 12g5-1(b)(3) | 없음(거래 측) — 운영 정정(§6.5)으로 canonical 신원에 통합 후 그 신원으로 거래 |
| REVIEW_IDENTITY_DUPLICATE_SUSPECTED | dedupStatus = SUSPECTED_DUPLICATE | 12g5-1(a)(6) | 조사 확정 — UNIQUE 복귀 또는 CONFIRMED 전환 |

### 6.3 Manual Review Path (REVIEW_IDENTITY_DUPLICATE_SUSPECTED 처리)

- **진입.** 온보딩 스크리닝 또는 사후 클러스터 신호(주소·기기·행위 패턴)가 12g5-1(a)(6)의 "동일인이라 믿을 이유" 문턱을 넘되 확정에 못 미치면 SUSPECTED로 세팅되고, 해당 신원의 거래는 REVIEW로 보류된다.

- **조사.** 운영팀 + Trusted Issuer가 원자료를 대조한다 — 신분증 원본 재확인, 생체 재대면(liveness 재수행), 추가 서류 요청. 목표는 이지선다의 확정 — 같은 사람인가(→ CONFIRMED, §6.5 정정), 다른 사람인가(→ UNIQUE 복귀, 위양성 해소).

- **SLA·보수성.** 확정 전까지 거래는 열리지 않는다 — "의심 상태로 통과"는 없다. 다만 조사 지연이 정당한 이용자를 장기간 묶는 것도 해악이므로, 목표 처리 시한(예: 영업일 기준 상한)을 운영 정책으로 두고 §11의 대시보드에서 추적한다. 시한 초과는 자동 통과가 아니라 escalation(상급 검토) 사유다.

- **기록.** 조사 경위·근거·결론은 off-chain 신원 원장에 남기고(1023.220(a)(3)의 기록 규율 준용), 온체인엔 상태 전이만 남는다. 이 기록이 §3.2에서 본 "knowledge" 방어의 재료다 — 의심을 인지하고 절차대로 처리했음의 증적.

### 6.4 Error message — 매수인 노출용 vs 내부 기록용 분리

| reasonCode | 매수인 노출 문구 (예) | 내부 기록 |
| --- | --- | --- |
| FAIL_IDENTITY_NOT_REGISTERED | "거래 전 본인확인(KYC) 등록이 필요합니다. 온보딩을 완료해 주세요." | wallet, 시각 |
| FAIL_KYC_CLAIM_EXPIRED | "본인확인 유효기간이 만료되었습니다. 재인증을 진행해 주세요." | oid, verifiedAt, 만료 경과 |
| FAIL_IDENTITY_FROZEN | "계정 확인 절차가 진행 중입니다. 지원팀에 문의해 주세요." | 동결 사유 코드, 담당 |
| REVIEW_..._SUSPECTED | "추가 본인확인이 필요합니다. 안내에 따라 인증을 완료해 주세요." | 매칭 신호·점수 대역, 조사 티켓 |
| FAIL_DUPLICATE_IDENTITY | "이미 등록된 계정이 확인되었습니다. 기존 계정으로 이용해 주세요." | canonical oid, 확정 근거 |

원칙 — 노출 문구는 **탐지 메커니즘을 가르쳐 주지 않는다.** "귀하의 생체정보가 계정 X와 87% 일치"류의 상세는 회피 학습 자료가 된다. 내부 기록은 반대로 구체적으로 — 감사·법적 방어의 재료이므로.

### 6.5 확정 중복의 정정 절차 (구조적 cure)

CONFIRMED_DUPLICATE는 거래 측 cure가 없다 — 12g5-1(b)(3)의 "shall be deemed"(실소유자 간주)를 상태로 구현해야 한다. 절차:

- **canonical 선정.** 중복 신원 중 정본 하나를 정한다 (통상 최초 등록·검증 이력이 온전한 쪽).

- **폐합.** 나머지 신원의 dedupStatus = CONFIRMED_DUPLICATE, canonicalIdentity = 정본 참조. 그 신원 명의의 지갑들은 정본 ONCHAINID로 재바인딩하거나, 재바인딩 불능 시 잔액을 forcedTransfer()/recovery()로 정본 신원의 지갑에 재귀속.

- **하류 보정.** D-01 카운터 재계산(2인 → 1인), C-08 합산 소급 재평가(분산 매도가 있었다면 합산 위반 여부 재판정 — §3.14 예비주해의 소급 배제 근거), A-06/A-13/A-03 claim의 정본 귀속 확인.

- **기록.** A-12 red-flag + off-chain 조사 파일. 고의성 정황이면 운영 정책상 제재(계정 제한 등)와 별도 검토 — 단, 고의 판정 자체는 부품이 아니라 사람·법무의 일이다.

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

### 7.1 Test 1 — Pass (명백한 통과)

- **설정:** 김QP는 온보딩 완료 — ONCHAINID 발급, KYC claim 유효(서명·발급자·기간 정상), identityStatus = ACTIVE, dedupStatus = UNIQUE. 지갑 W1으로 매수 시도.

- **기대:** check_A_04(W1) = PASS. 이후 A-03/A-13 등 자격 판정으로 진행.

- **확인 포인트:** 5단계 전부 O(1) 판독으로 통과 — 게이트 지연이 registry 조회 수준인지(성능 회귀 감시).

### 7.2 Test 2 — Fail (명백한 거절)

- **설정:** 익명 지갑 W9 — 어떤 ONCHAINID에도 미바인딩 — 이 매수 시도.

- **기대:** FAIL_IDENTITY_NOT_REGISTERED. 자격 판정(A-03 등)은 시작조차 되지 않는다.

- **확인 포인트:** ERC-3643 표준 계층(isVerified)과 부품 계층(check_A_04)의 이중 차단이 정합 — 표준이 먼저 거절해도 reasonCode가 부품 코드로 관측될 것.

### 7.3 Test 3 — Boundary (같은 사람의 두 번째 지갑: 두 갈래)

- **설정 A (정당 경로):** 김QP가 콜드월렛 W2를 추가하려 한다 — 재인증 후 W2를 기존 ONCHAINID에 바인딩.

- **기대 A:** 바인딩 성공, check_A_04(W2) = PASS. linkedWallets = [W1, W2]. D-01 카운트 불변(1인).

- **설정 B (위장 시도):** 김QP가 새 이메일·같은 신분증으로 "신규" 온보딩을 시도해 별개 ONCHAINID를 받으려 한다.

- **기대 B:** 온보딩 dedup에서 DOC_MATCH → 신규 등록 거절 + 기존 계정 안내. 만약 스크리닝을 뚫고 등록됐다가 사후 적발되면 CONFIRMED_DUPLICATE → FAIL_DUPLICATE_IDENTITY + §6.5 정정.

- **확인 포인트:** 같은 사실관계(한 사람, 두 지갑)가 경로에 따라 PASS(바인딩)와 FAIL(별개 신원)로 갈리는 것 — "다지갑 허용, 다신원 금지"의 경계가 코드에 정확히 새겨졌는가.

### 7.4 Test 4 — 회귀 (dedup 실패가 하류를 오염시키는 시나리오)

- **설정:** 결함 주입 — 이affiliate가 신원 2개(OID-A, OID-B)로 등록된 상태를 만든다. OID-A 지갑으로 한도 근접 매도, OID-B 지갑으로 추가 매도. 동시에 D-01 카운트도 2인으로 계상된 상태.

- **기대 (결함 존재 시):** C-08은 각 신원별 합산이라 한도 위반을 놓치고, D-01은 1인을 2인으로 센다 — 이것이 탐지되어야 할 회귀다.

- **기대 (정정 후):** CONFIRMED 확정 → §6.5 절차 → C-08 소급 재평가에서 합산 초과 검출(초과 시 위반 플래그), D-01 카운터 −1 보정.

- **확인 포인트:** 정정 절차가 하류 부품의 상태(카운터·합산창)까지 실제로 보정하는가 — A-04 단독이 아니라 배선의 회귀 테스트.

### 7.5 Test 5 — 위양성 (동명이인 REVIEW)

- **설정:** "김민준(1990-03-15)" 두 명 — 실제 다른 사람 — 이 각자 온보딩. 이름·생년월일 일치, 주소 상이, 신분증 번호 상이, 생체 불일치.

- **기대:** ATTRIBUTE_CLUSTER 신호로 SUSPECTED → 두 번째 신원 거래는 REVIEW 보류 → 조사(생체·신분증 대조)에서 별인 확정 → UNIQUE 복귀, 거래 재개.

- **확인 포인트:** ① SUSPECTED가 FAIL이 아니라 REVIEW로 가는가(위양성 보호), ② 12g5-1(a)(6)의 "reason to believe"가 이름 일치만으로 발동되지 않고 복합 표지로 발동되는가(과잉 보류 방지), ③ UNIQUE 복귀 후 소급이 아니라 새 거래로 재개되는가(§5.4).

### 7.6 Test 6 — 법인과 그 대표 개인 (별개 person)

- **설정:** 박대표가 개인 신원(OID-P)으로도, 자기 1인 법인 리걸테크(주)의 entity 신원(OID-E, beneficialOwnersVerified = true, BO = 박대표)으로도 등록. 각자 보유·거래.

- **기대:** 중복 아님 — personType이 다르고 12g5-1(a)(2)가 법인을 별개 1인으로 명시. D-01 카운트 2인. 단, 법인이 오로지 카운트·한도 쪼개기용 껍데기라는 정황(자산·활동 부재 + 게이트 회피 패턴)이 확인되면 (b)(3) 관통 검토 → 운영 조사(F-02 연계).

- **확인 포인트:** 개인·법인 자동 병합이 일어나지 않는 것(오탐 방지)과, 회피 정황 시 관통 경로가 별도로 열려 있는 것 — (a)(2)의 원칙과 (b)(3)의 예외가 둘 다 살아 있는가.

### 7.7 Test 7 — 키 분실 recovery (재온보딩 금지)

- **설정:** 최QP가 지갑 W1 키를 분실. 잔액은 W1에 잠김.

- **기대:** 본인 재인증(원 KYC 자료 대조) → 새 지갑 W2를 **같은 ONCHAINID** 에 바인딩 → agent가 recovery()로 W1 잔액을 W2로 이관. D-01 카운트 불변. 새 신원 생성 경로는 dedup(DOC_MATCH)이 차단.

- **확인 포인트:** 분실 대응의 유일 경로가 recovery이고, "새로 가입"이 시스템적으로 막혀 있는가 — 키 분실이 중복 신원의 최빈 발생 경로이기 때문이다(§11.4).


## §8. (α) 기계 판정형·등록 기반 패턴 — 왜 이 방식인가

### 8.1 Decipher의 검증 방식 3패턴 중 A-04의 자리

| 패턴 | 설명 | A-04 |
| --- | --- | --- |
| A. 기계 판정형 | 온체인 상태·산술만으로 결정론 판정 | **해당 (런타임)** — check()는 registry 스냅샷의 O(1) 판독 |
| B. 증명서 확인형 | off-chain 실사 결과를 서명 claim으로 신뢰 | 부분 (온보딩) — KYC claim 발급·신뢰 구조는 B의 문법 |
| C. 감시·운영 개입형 | flag 적재 + 사람 판단 | 부분 (사후) — SUSPECTED 조사·(b)(3) 관통 검토 |

부착 매트릭스가 A-04를 패턴 A로 분류하는 이유는 **거래 시점의 판정이 완전한 결정론** 이기 때문이다 — 임계값 비교조차 없는 enum 판독이라, 기간 산술이 있는 C-01보다도 단순하다. 다만 그 결정론은 공짜가 아니다 — 비결정적 판단(동일인 여부)을 온보딩·운영 단계가 미리 소화해 준 대가다. 그래서 A-04를 온전히 이해하려면 세 시점을 함께 봐야 한다: 온보딩(패턴 B의 문법 — Trusted Issuer의 실사와 서명), 런타임(패턴 A — 본 부품의 check), 사후(패턴 C의 문법 — 클러스터 신호와 조사).

### 8.2 왜 등록형(registry-backed)이 유일한 선택인가

대안을 소거해 보자. ① **순수 온체인 판정** — 체인 데이터만으로 "이 두 지갑이 같은 사람인가"를 알아낼 수 없다. 온체인 휴리스틱(자금 흐름·가스 지불 패턴)은 정황일 뿐 신원이 아니고, 프라이버시 도구로 쉽게 끊긴다. ② **거래 시점 KYC** — 매 거래마다 문서·생체를 검증하는 것은 성능·비용·프라이버시 모두 불가능하다. ③ **자기신고** — 회피자가 정확히 거짓말할 항목이다. 남는 답이 등록형이다 — 무거운 확인을 입구(온보딩)에서 한 번 치르고, 그 결과를 registry에 상태로 새겨, 이후 모든 거래가 그 상태를 싸게 읽는다. ERC-3643이 Identity Registry를 표준의 중심에 둔 것, 그리고 허가형 증권 토큰 실무(Securitize류)가 화이트리스트 방식으로 수렴한 것이 같은 논리의 산물이다.

### 8.3 법적 토대 — 왜 이 구조가 규범과 맞물리는가 (세 축)

- **BSA 축 — 1023.220의 "reasonable belief ... true identity".** 법이 요구하는 것은 무오류가 아니라 위험기반 절차로 형성한 합리적 믿음이다(§3.7). 등록형 구조에서 그 믿음의 형성 시점이 온보딩이고, claim 서명이 그 형성의 증표이며, (a)(2)(iii)의 검증 불능 대응이 FROZEN·REVIEW로 구현된다. 즉 A-04의 상태 기계는 CIP 규칙의 절차 요건을 온체인 어휘로 옮긴 것이다.

- **카운팅 축 — 12g5-1의 명부 문법.** (a) chapeau의 "records of security holders ... by each person"이 말하듯, 법적 카운팅의 재료는 명부이고 단위는 사람이다. Identity Registry는 그 명부의 온체인 대응물이며 — D-01 문서가 강조했듯 법적 명부(transfer agent 원장)의 **mirror** 다. (a)(6)의 허용적 합산과 (b)(3)의 강제 관통이 dedupStatus의 두 전이(SUSPECTED→조사, CONFIRMED→정정)로 대응한다.

- **검증 귀속 축 — 506(c)·§4(d)(1)의 purchaser 문법.** 자격 검증(A-03·A-13)이 법적으로 유효하려면 특정 사람에게 귀속돼야 하고(§3.1~§3.3), ONCHAINID가 그 귀속의 앵커다. claim을 지갑이 아니라 신원에 발급하는 ERC-735 구조가 이 귀속을 기술적으로 보증한다.

### 8.4 D-01(상태추적형)과의 대비 — 같은 신원, 다른 시제

D-01과 A-04는 같은 ONCHAINID를 다루지만 시제가 다르다. D-01은 **집계량** 을 다룬다 — 매 거래가 카운터를 바꾸므로 pre-trade 게이트 + post-trade commit의 STATEFUL 2단 구조가 필요하고, 원자성·경쟁조건이 핵심 리스크다. A-04는 **속성** 을 다룬다 — 거래는 신원 상태를 바꾸지 않으므로 commit이 없고(STATELESS), 리스크는 경쟁조건이 아니라 온보딩 스크리닝의 정확도(위양성·위음성)다. 한 줄 대비: D-01의 적은 "동시에 두 거래", A-04의 적은 "같은 얼굴의 두 서류".

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

### 9.1 본 부품의 책임 경계

A-04가 하는 것 — 지갑↔사람 매핑의 존재·진위·유일성·상태 판정, 사람 뭉치 참조(144(a)(2)·501(e))의 공급, 중복 확정 시 정정의 트리거. **넘기는 것** — 제재 명단 대조 실행은 A-01(A-04는 스크리닝의 대상인 신원 속성을 공급), 관할 판정은 A-02(investorCountry 저장 경로만 공유), 자격의 실체(AI/QP)는 A-03·A-13, affiliate 실체 판단은 A-06, entity의 자격 산정·구성원 재귀는 A-08·A-09(CDD의 BO 확인과 자격 look-through는 별개 — §3.15), claim 만료 산술은 A-11, red-flag의 축적·평가는 A-12, 거래량 합산 실행은 C-08, 머릿수 집계는 D-01, 자기거래 패턴 탐지는 F-01(A-04는 "양쪽이 같은 사람"임을 알아볼 단위를 공급), Manifest 정합은 B-01.

### 9.2 Element Cascade Map — 그리고 부착의 뉘앙스

                          ┌── A-01 제재 (신원 속성으로 스크리닝) ── 소비
        [모든 거래 참가자] │
              A-04 ───────┼── A-03/A-13 자격 (claim의 귀속처 = ONCHAINID) ── 소비
        (신원 기반 공급)   │
                          ├── A-06 affiliate · C-08 거래량 합산 (personGroupRef) ── 소비
                          ├── D-01 보유자 수 (카운팅 단위 — 강한 의존) ── 소비
                          ├── F-01 자기거래 (from·to 동일인 식별) ── 소비
                          └── A-11 신선도 (KYC claim 만료) · A-12 red-flag ── 위임/연동
        [entity 매수인] ── A-08/A-09 (자격 look-through — CDD BO 확인과 별개 축)

**부착의 뉘앙스 (매트릭스 정합 노트).** 부착 매트릭스에서 A-04는 R1·R2에 필수(●), R3·R4에 무관(—)이다. 그런데 D-01(R3 전속)은 A-04를 "강한 의존"으로 선언한다 — 모순이 아니라 층위의 차이다. **게이트로서의 A-04**(중복·상태 판정을 거래 성립 요건으로 거는 것)는 R1·R2에 부착된다. **기반으로서의 신원 계층**(지갑↔ONCHAINID 매핑, isVerified)은 ERC-3643 토큰 표준 자체에 내장되어 Recipe와 무관하게 모든 이전에 상시 작동하고, R3의 D-01·R4의 F-01은 이 기반을 데이터로 소비한다. BUIDL 실거래에선 R1 또는 R2가 항상 함께 켜지므로 게이트도 사실상 상시다. 남는 정리 문제 — 07 자료의 구조 노트가 제재(A-01)·관할(A-02)을 always-on으로 재분류하는 안(OD-CI-5)을 걸어 두었고 같은 횡단 규제 표에 신원(A-04)이 나란히 있으므로, A-04도 그 재분류에 합류할지가 pool freeze 전 결정 사항이다(OD-A04-3).

### 9.3 부품별 협응 표

| 상대 부품 | 관계 | 협응 내용 |
| --- | --- | --- |
| A-01 제재 | 강한 상호의존 | 스크리닝은 신원 속성(이름·생년월일 등)에 대해 수행 — A-04의 신원이 가짜면 A-01이 헛돈다. 역으로 §5318(l)(2)(C)·1023.220(a)(4)의 명단 대조는 온보딩의 필수 항목(§4.4 공통 행). 제재 적중 시 identityStatus 동결은 A-01 주도, A-04는 상태 반영 |
| A-02 관할 | 데이터 동거 | investorCountry는 Identity Registry의 표준 필드 — A-04가 저장 경로, A-02가 판정 |
| A-03 / A-13 자격 | 귀속 기반 공급 | AI·QP claim은 ONCHAINID에 발급 — 검증 탈락자의 신원 갈아타기 재시도를 A-04 dedup이 차단 (§3.1~§3.2) |
| A-06 affiliate | 데이터 공급 | affiliate는 사람 속성 — 다지갑에도 동일인 추적 유지. 144(a)(2) 그룹의 affiliate 파급은 A-06 판단 |
| A-08 / A-09 entity | 경계 분리 | CDD BO 확인(1010.230, AML 목적, ≥ 25%·control)은 A-04의 entity 온보딩 항목; 자격 look-through(전원 QP/AI 등)는 A-08/A-09 — 서로 대체 불가 (§3.15) |
| A-11 신선도 | 위임 | KYC claim 만료 산술을 A-11이 판정 — AI 5년·QP 1년과 같은 시계·같은 cure(재검증) 규율 |
| A-12 red-flag | 연동 | 중복 확정·위조 claim·회피 정황을 red-flag로 기록 — "모름 항변"의 차단 재료 |
| C-08 거래량 | 강한 의존(하류) | 합산 단위 = ONCHAINID + personGroupRef. 중복 정정 시 합산 소급 재평가 (§6.5) |
| D-01 보유자 수 | 강한 의존(하류) | 카운팅 단위 공급 — "지갑이 아니라 사람". 중복 정정 시 카운터 보정. D-01 문서의 dedup·회피 정정 항과 동일 규범 |
| F-01 자기거래 | 탐지 기반 공급 | from·to가 같은 ONCHAINID(또는 같은 person 클러스터)인 체결의 식별 단위 |
| B-01 manifest 정합 | 설정 공급 | Trusted Issuers Registry 구성·dedup 정책 파라미터의 Manifest 선언 정합 |

### 9.4 Recipe orchestration과 충돌 해소

- **R1 (506(c) 발행).** A-04 PASS → A-01 → A-03(+ R3 동시면 A-13) 순의 cumulative AND. A-04는 최전방 — 사람이 확정돼야 나머지가 의미를 갖는다.

- **R2 (재판매).** 매도인·매수인 양쪽 A-04. 매도인 쪽은 C-00 경로 선택과 무관하게 공통(어느 경로든 seller가 누구인지는 필요), 매수인 쪽은 경로 따라 강도가 다르다(§4(a)(7)이면 buyer AI까지, Rule 144면 buyer 자격은 R3의 QP만).

- **충돌 해소 규칙.** ① A-04 FAIL은 다른 부품 PASS로 구제되지 않는다 — 신원은 자격의 전제라 우선순위가 앞선다. ② SUSPECTED(REVIEW)는 FAIL이 아니므로 다른 부품 판정을 무효화하지 않되, 거래 성립은 보류한다 — 확정 후 그 시점 상태로 새 판정. ③ 부품 간 신원 참조 불일치(예: A-03 claim의 귀속 oid ≠ registry의 oid)는 데이터 무결성 사고로 즉시 FROZEN + 조사 — 어느 쪽이 옳은지 부품이 자체 판단하지 않는다.

### 9.5 Manifest 무결성과의 조율

A-04가 읽는 신뢰 구성(Trusted Issuers Registry의 KYC 발급 권한, dedup 정책 버전, REVIEW SLA 파라미터)은 Manifest 선언 사항이고, B-01이 선언과 실제 설정의 일치를 보증한다. 특히 검증기관 교체·추가는 Manifest 변경 절차(승인·time-lock)를 타야 하며, registry에만 몰래 추가된 발급자는 B-01 불일치로 검출되어야 한다 — 위조 신원의 지름길이 "가짜 검증기관 등재"이기 때문이다.


## §10. (γ) 3-Layer Solution — Element / Recipe / Manifest / Operator 매핑과 신뢰의 세 겹

### 10.1 법 계층 → 아키텍처 계층

- **법 계층 (Layer 1→2→3):** Layer 1 = §5318(l)(신원확인 위임) · §12(g)(5)(회피 방지 위임) · §4(d)(1)·§3(c)(7)(A)(사람 단위 요건); Layer 2 = 1023.220(CIP)·1010.230(CDD)·12g5-1(a)(6)/(b)(3)(합산·관통)·506(c)(2)·144(a)(2)·501(e); Layer 3 = CIP 채택 release(2003, customer 경계)·FinCEN 연기 최종규칙(2025-12-31)·CDD 예외구제(2026-02).

- **Element (A-04):** 지갑↔사람 매핑의 존재·진위·유일성·상태를 pre-trade에 판정. "이 지갑이 검증된 유일 신원인가"만 답한다.

- **Recipe:** R1·R2가 A-04를 필수 부착. R3·R4는 부착 없이 기반을 소비(§9.2). Manifest의 always-on 재분류 여부는 OD-A04-3.

- **Manifest:** 그 자산에 대해 신뢰 구성(Trusted Issuers Registry의 KYC 발급 권한자), dedup 정책 버전, REVIEW SLA, entity CDD 요구 수준을 선언. B-01이 정합 보증.

- **Operator:** 온보딩 운영, 조사 큐, 동결/해제, 정정(폐합·recovery), 명부 대사, 기록 보존 — §11.

### 10.2 신뢰의 세 겹 — 그리고 책임 분배

증거 신뢰는 세 겹으로 쌓인다. **L1 실사 주체**(Sumsub 모델의 KYC 벤더) — 문서·생체·dedup 스크리닝의 실행. **L2 서명 주체**(Trusted Issuer — 모델상 Securitize) — 실사 결과를 심사해 claim에 서명, "true identity에 대한 reasonable belief"의 법적 형성 주체. **L3 온체인 계층** — 서명·등재·상태의 결정론 확인. escalation은 아래로 — L3의 이상 신호(서명 불일치·발급자 비등재)는 L2 검증으로, L2의 의심은 L1 재실사로 내려간다.

**위조 신분증으로 중복/차명 신원이 만들어져 사고가 난 경우의 책임 스케치** (확정 배분은 변호사 사안 — OD-A04-1):

- **운영주체(BD 모델).** CIP는 무오류 보증이 아니라 절차 의무다 — 위험기반 절차를 성실히 수행했고 기록이 온전하면(1023.220(a)(2)·(3)), 개별 위조의 통과 자체가 곧 위반은 아니다. 반대로 절차 결손(스크리닝 미수행, 알면서 방치 — §3.2의 "knowledge")이 있으면 방어가 무너진다.

- **검증기관(Trusted Issuer).** 서명은 실사 수행의 표명 — 계약상 실사 기준 미달이면 구상 대상. Decipher-검증기관 계약에 실사 수준·dedup 방법론·책임 한도를 명시할 것.

- **Decipher(인프라).** 부품·배선의 설계 결함(예: dedup 결과를 게이트가 안 읽음)은 Decipher 몫, 개별 실사의 품질은 위 두 주체 몫 — 이 경계를 계약과 기술 문서(본 문서 포함)로 선명히 남기는 것이 방어의 절반이다.

- **행위자 본인.** 위조·차명은 그 자체로 연방 형사·증권법 위반의 영역 — 시스템 기록(온체인 상태 전이 + off-chain 조사 파일)이 집행 협조 재료가 된다.

### 10.3 의무 귀속의 시간축 — "BD 등록 후"

07 자료의 배선을 다시 새긴다 — BSA 의무(CIP·SAR·기록)는 **운영주체의 의무이고, Decipher 자신에게는 BD/ATS 등록 시점부터** 직접 귀속된다. 그 전까지 Decipher의 지위는 ① 등록 주체(모델상 Securitize Markets)의 CIP 이행에 기술적으로 의존(1023.220(a)(6)의 reliance 문법)하면서 ② 같은 수준을 자발적 설계 표준으로 채택하는 것이다. 이 구분이 무너지면 두 방향의 오류가 생긴다 — "우리는 BD가 아니니 KYC가 필요 없다"(사실 공급 자체가 무너져 증권법 부품 전체가 좌초)와 "우리가 CIP 의무자다"(등록 전 법적 지위의 과대 표명). 정확한 문장은 이것이다: *의무는 운영주체의 것, 사실은 시스템의 것, A-04는 그 사실의 문지기.*

## §11. (δ) Frontend·Off-chain Operator Layer — 4-Layer로는 안 끝난다

### 11.1 왜 운영 층이 필요한가

A-04의 결정론(§5)은 온보딩·운영이 상태를 정확히 유지해 준다는 전제 위에 선다. 그 유지가 운영 층의 일이다 — 스크리닝 파라미터 조정, 조사, 정정, 대사, 보존. 순수 온체인만으로는 "같은 사람인가"라는 질문 자체를 던질 수 없다.

### 11.2 Frontend 온보딩·지갑 관리 Flow

- **신규 온보딩:** §4.3의 5단계. UX 원칙 — dedup 거절 시 "이미 등록된 계정이 있습니다" + 기존 계정 복구/지갑 추가 경로로 안내(신규 재시도 유도 금지).

- **지갑 추가:** 로그인·재인증 → 새 지갑 서명 챌린지 → 바인딩. "새 지갑 = 새 계정"이라는 통념을 UI가 적극 교정한다.

- **재검증(만료):** A-11 만료 임박 알림 → 간이 재KYC(변경 사항 확인) → verifiedAt 갱신.

- **키 분실:** recovery 전용 플로우(§7.7) — 신규 가입 버튼이 아니라 "지갑 접근을 잃으셨나요" 경로.

### 11.3 Off-chain Operator 운영 항목

- **조사 큐:** SUSPECTED 건의 접수·배정·SLA 추적·확정 처리(§6.3). 대시보드 — 미결 건수·평균 처리 시간·확정 비율(위양성률 관측).

- **클러스터 감시:** 온보딩 이후의 신호(주소·기기·행위 패턴, CHAIN_HEURISTIC)를 주기 배치로 스캔 — 신호는 SUSPECTED 세팅 사유이지 자동 FAIL 사유가 아니다. F-02(시장감시)와 신호 공유.

- **동결/해제:** FROZEN 세팅·해제의 권한 분리(agent 다중 서명)와 사유 코드 기록.

- **정정 집행:** §6.5의 폐합·재바인딩·recovery/forcedTransfer·하류 보정을 체크리스트로 표준화 — 수작업 누락(D-01 보정 빠뜨림 등)이 최빈 실수 지점.

- **명부 대사:** Identity Registry(온체인)와 transfer agent 법적 명부(off-chain)의 정기 reconciliation — 불일치 시 법적 명부 우선(D-01 문서 OD-D01-1과 같은 규율). 신원 차원에선 특히 "명부의 1인 = registry의 1 ONCHAINID" 대응을 점검.

- **기록 보존:** 신원 확인·조사·정정 기록을 1023.220(a)(3) 준용 수준(계좌 폐쇄 후 5년 등)으로 off-chain 보존. 온체인 해시 참조로 무결성 앵커.

- **SAR 관련 경계(중요):** 의심거래 보고는 등록 운영주체(BD)의 의무다 — Decipher 시스템은 그 판단 재료(중복 확정·회피 정황·red-flag)를 공급할 뿐, "SAR을 대신 판단·제출"하지 않는다. 재료의 전달 경로와 책임자를 운영 절차서에 명시.

### 11.4 Recovery·강제 이전과 신원의 관계

recovery()·forcedTransfer()는 신원 게이트의 우회로가 아니다 — 수취 지갑도 등록된 신원(바인딩)이어야 하고, 비자발적 이전(§3(c)(7)(A) 단서의 상속·이혼 등)의 수취인도 먼저 온보딩(신원 등록)을 거친다. 자격(QP) 없는 수취는 간주 조항이 구제하지만, 신원 없는 수취를 구제하는 조항은 없다 — 신원은 자격보다 아래층의 전제다.

### 11.5 아키텍처 함의

운영 층까지 놓고 보면 A-04는 "부품 하나"라기보다 신원 서브시스템의 게이트 표면이다 — 아래에 온보딩 파이프라인(L1·L2), 옆에 조사·정정 절차(패턴 C), 위에 소비자 부품들(§9.2). 이 문서가 §8에서 세 시점을 함께 그린 이유이고, Spec Sheet 압축 시에도 "게이트 + 파이프라인 + 정정"의 3면을 모두 남겨야 하는 이유다.


## §12. 미해결 이슈 (Open Issues) — 변호사·운영 결정 대기 항목

본 부품의 법리·설계 골격은 확정이나, 아래 7건은 외부 판단(변호사 자문·운영 정책 결정·규제 추적)이 필요해 명시적으로 남긴다. Priority는 즉시(pool freeze 전 결정 필수) / 높음(운영 개시 전) / 중간(추적·후속)이다.

| # | 질문 | 왜 필요한가 | Priority | 해소 경로 |
| --- | --- | --- | --- | --- |
| OD-A04-1 | BD 등록 전 구간의 CIP 의무 귀속과 계약 분배 — Securitize Markets(BD)의 CIP에 대한 reliance(1023.220(a)(6)) 구조로 충분한가? reliance 계약의 필수 조항(연차 인증·감사 협조)과 위조 통과 사고 시 책임 분배(§10.2)는? | §10.3의 "의무는 운영주체, 사실은 시스템" 구도가 법적으로 서려면 reliance의 형식 요건((a)(6)(i)~(iii): 합리성·연방 규제기관 감독·연차 인증 계약)이 실제 계약에 박혀야 한다 | 즉시 | 외부 변호사 — BD/ATS 자문 패키지(법률 검토 의뢰서의 reliance 항목)와 병합 |
| OD-A04-2 | dedup 스크리닝의 SUSPECTED 문턱 파라미터 — 12g5-1(a)(6) "reason to believe"를 어떤 신호 조합·유사도 대역에서 발동시킬 것인가 (예: 생체 유사도 상·하한, 속성 일치 개수) | 법은 문턱의 존재만 주고 수치는 주지 않는다(§5.5). 너무 낮으면 위양성 폭증(T5), 너무 높으면 위음성(회피 통과) — 벤더(Sumsub 모델) 기본값 검토 + 운영 데이터 기반 보정 필요 | 높음 | 운영 정책 결정 + 검증기관 계약의 방법론 조항. 초기값은 벤더 보수 설정, 분기별 위양성률 리뷰 |
| OD-A04-3 | A-04의 always-on 재분류 — A-01·A-02 재분류안(OD-CI-5)에 신원(A-04)도 합류시켜 "R1·R2 부착"이 아니라 "전 Recipe 공통 게이트"로 옮길 것인가 | §9.2의 층위 구분(게이트 vs 기반)으로 현행 매트릭스와 D-01 의존 선언의 표면 모순은 해소되나, 문서·매트릭스 표기의 단일화가 남는다 — 07 자료의 횡단 규제 분류와 표기를 맞추는 것이 유지보수에 유리 | 높음 | 내부 아키텍처 결정 (OD-CI-5와 함께 pool freeze 전) — 결정 시 부착 매트릭스·본 문서 §2 개정 |
| OD-A04-4 | 1인 법인 경계의 판단 기준선 — T6의 "(b)(3) 관통 검토" 발동 정황(자산·활동 부재 + 회피 패턴)을 어떤 체크리스트로 표준화할 것인가 | 12g5-1(a)(2)(법인=별개 1인)와 (b)(3)(회피 관통)의 경계는 사실판단이라 운영 재량이 크다 — 재량 남용(과잉 병합)과 방치(회피 방치) 양쪽을 막을 내부 기준 필요 | 중간 | 운영 절차서 + 변호사 검토 (facts-and-circumstances 기준의 문서화 — A-06의 affiliate 판단 기준선 작업과 병행) |
| OD-A04-5 | FinCEN 지형 추적 — IA AML(2028-01-01 시행)·IA CIP 재검토(SEC 공동)·CDD 예외구제의 후속·CTA 정합 개정이 확정될 때 온보딩 표준·entity 그래프 사양에 미치는 영향 | §3.9·§3.15의 현황은 2026-07 스냅샷이다 — 자문사 측 CIP가 확정되면 R3(펀드) 축 온보딩의 의무 주체·수준이 바뀔 수 있다 | 중간 | 규제 추적 (반기별) — 확정 시 §3.9·§3.15·§10.3 개정 |
| OD-A04-6 | PII·개인정보 보관 경계 — off-chain 신원 원장의 보존(1023.220(a)(3) 5년)과 한국 개인정보보호법·GDPR류 삭제권의 충돌 조정, 생체 템플릿의 보관 근거 | §4.2의 "온체인 무PII" 원칙만으론 부족 — off-chain 원장 자체의 준거법·보존·파기 정책이 필요하고, 이는 미국 BSA 요구와 투자자 소재지 개인정보법의 교차 문제 | 중간 | 외부 변호사 (개인정보 전문) + 검증기관 DPA 계약 검토 |
| OD-A04-7 | recovery vs 재온보딩의 법적 지위 — 키 분실 시 recovery만 허용(§7.7)하는 정책의 근거 문서화와, 본인 확인 불능(원 KYC 자료 소실 등) 시의 예외 절차 | "재온보딩 절대 금지"는 dedup 보전에 필수지만, 정당한 이용자가 재인증 불능이 된 극단 사례(개명·국적 변경·문서 전면 갱신)의 구제 경로가 없으면 자산 동결 분쟁 리스크 | 중간 | 운영 정책 + 변호사 검토 (transfer agent의 lost holder 실무 준용 가능성) |

**즉시 항목 요약.** OD-A04-1(reliance 계약 구조)이 유일한 P0 성격이다 — BD/ATS 자문 패키지에 이미 포함된 논점(TA attestation reliance·BD 지위)과 한 묶음으로 의뢰하면 된다. 나머지는 운영 개시 전(높음) 또는 추적(중간) 리듬이다.

## §13. 파일명 규칙과 카테고리

본 문서의 파일명은 `A-04_identity-dedup.md` — 접두 `A`는 신원·자격(Identity & Eligibility) 카테고리, `04`는 부품 일련번호, 접미는 영문 슬러그다. 참고로 Decipher 부품 카테고리 체계는 다음과 같다.

| 접두 | 카테고리 | 예 |
| --- | --- | --- |
| A | 신원·자격 (Identity & Eligibility) | A-01 제재, A-03 AI, A-04 신원중복(본 문서), A-13 QP |
| B | 구조·표준 (Structure & Standards) | B-01 manifest 정합, B-02 토큰 표준 |
| C | 재판매·거래 조건 (Resale & Trading) | C-00 경로 선택, C-01 보유기간, C-08 거래량 |
| D | 집계·상한 (Aggregation & Caps) | D-01 보유자 수 |
| E | 발행 절차 (Issuance Process) | E-01 Form D 등 |
| F | 시장 행위 (Market Conduct) | F-01 자기거래 등 |

산출 경로는 `산출물/elements/A-04_identity-dedup.md`(+ 동명 `.docx`)이며, 후속 Spec Sheet 압축 시 `spec-sheets/elements/A-04.md`로 요약본이 파생된다.

## 부록 A. Authority Verification Table — 인용 정확성 검증표

본 문서의 모든 실질 인용에 대해, 쟁점 → 올바른 근거 → 문서 반영 위치 → 공식 URL을 대조한다. (A-11 문서의 검증표 형식을 따른다. 전 항목 1차 출처에서 verbatim 대조 완료 — 2026-07-15.)

| # | Issue (쟁점) | Correct Authority | Direct/Supporting | A-04 반영 | Official URL |
| --- | --- | --- | --- | --- | --- |
| 1 | R1 요건의 단위 = purchaser | 17 C.F.R. §230.506(c)(2)(i) — "All purchasers ... are accredited investors" | Direct | §3.1 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.506 |
| 2 | 검증의 사람 귀속 + knowledge 단서 | 17 C.F.R. §230.506(c)(2)(ii) chapeau — "reasonable steps to verify ... does not have knowledge" | Direct | §3.2 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.506 |
| 3 | R2 §4(a)(7) buyer 단위 | 15 U.S.C. §77d(a)(7)·(d)(1) — "Each purchaser is an accredited investor, as that term is defined in section 230.501(a) of title 17" | Direct | §3.3 | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim |
| 4 | Rule 144 매도 person 확장 (동거 친족·≥ 10% 신탁/법인) | 17 C.F.R. §230.144(a)(2)(i)~(iii) — "10 percent or more" (이상) | Direct | §3.4 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.144 |
| 5 | 펀드 축 사람 단위 + 비자발적 이전 간주 | 15 U.S.C. §80a-3(c)(7)(A) — "owned exclusively by persons who, at the time of acquisition ..." | Background | §3.5·§11.4 | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-3&num=0&edition=prelim |
| 6 | CIP 제정법 위임 (검증·기록·명단) | 31 U.S.C. §5318(l)(1)·(2)(A)(B)(C) (PATRIOT Act §326) | Direct | §3.6 | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title31-section5318&num=0&edition=prelim |
| 7 | BD CIP — true identity 기준·불능 대응·5년 보존·명단·reliance | 31 C.F.R. §1023.220(a)(1)·(2)·(3)·(4)·(6) — "reasonable belief that it knows the true identity of each customer" | Direct | §3.7·§6·§11.3 | https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1023/section-1023.220 |
| 8 | CDD 수익적 소유자 정의 (≥ 25% + control 1인) | 31 C.F.R. §1010.230(d)(1)·(2) — "25 percent or more" (이상) | Conditional | §3.8 | https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/section-1010.230 |
| 9 | IA AML 시행 연기 (2028-01-01) | 31 C.F.R. §1032.210(c) 개정 — "on or before January 1, 2028" (FinCEN 최종규칙 2025-12-31 서명, 91 FR 관보 2026-01-02; 원규칙 89 FR 72156, 2024-09-04; 예외구제 명령 2025-08-05) | Background | §3.9·§3.15 | https://www.federalregister.gov/documents/2026/01/02 · https://www.fincen.gov |
| 10 | 회피 방지 정의 위임 | 15 U.S.C. §78l(g)(5) — "in order to prevent circumvention" | Supporting | §3.10 | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78l&num=0&edition=prelim |
| 11 | 유사 명의 동일인 합산 (허용 규범) + 법인·공동소유 경계 | 17 C.F.R. §240.12g5-1(a) chapeau·(a)(2)·(a)(4)·(a)(6) — "reason to believe ... may be included" | Direct | §3.11·§5.3 | https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.12g5-1 |
| 12 | 회피 목적 보유형태의 실소유자 관통 (강제 규범) | 17 C.F.R. §240.12g5-1(b)(3) — "knows or has reason to know ... primarily to circumvent ... shall be deemed" | Direct | §3.12·§6.5 | https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.12g5-1 |
| 13 | 506(b) 매수인 수 산정 뭉치기 (> 50% 초과) — dormant | 17 C.F.R. §230.501(e) — "under §230.506(b) only ... more than 50 percent" | Conditional | §3.13 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.501 |
| 14 | concert 합산 + 회피설계 일반 배제 | 17 C.F.R. §230.144(e)(3)(vi)·Preliminary Note — "act in concert ... shall be aggregated" / "plan or scheme to evade" | Supporting | §3.14 | https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.144 |
| 15 | CIP customer 경계 — named accountholder, look-through 불요 | Treasury/FinCEN·SEC 공동 채택 release, Customer Identification Programs for Broker-Dealers (2003-05-09) | Supporting | §3.15·§9.1 | https://www.sec.gov/rules/other/joint050903.htm |
| 16 | CDD BO 확인 주기 완화 | FinCEN 예외구제 명령 (2026-02) — 최초 계좌 개설 시 등으로 한정 | Background | §3.15 | https://www.fincen.gov |
| 17 | 506(c) 검증 프레임 (객관적·사실관계) | SEC Release No. 33-9415 (2013-07-10) | Background | §3.15 | https://www.sec.gov/rules/final/2013/33-9415.pdf |

## 부록 B. 안전한 표현 vs 위험한 표현

법적으로 정확한 문장과 사고를 부르는 문장의 대조표다. 문서·코드 주석·대외 커뮤니케이션 전반에 적용한다.

| ✕ 위험한 표현 | ○ 안전한 표현 | 왜 |
| --- | --- | --- |
| "A-04는 다지갑을 금지한다" | "A-04는 다신원을 금지한다 — 지갑은 몇 개든 같은 ONCHAINID에 바인딩되면 된다" | 12g5-1(b)(3)의 관통은 "primarily to circumvent"인 형태에 한정 — 정당한 다지갑(콜드월렛 분리)은 합법 관행 (§3.12·§5.3) |
| "우리 시스템이 CIP·SAR 의무를 수행한다" | "CIP·SAR 의무는 등록 운영주체(BD)의 것이고, 시스템은 그 판단·이행의 재료(확정 신원·red-flag)를 공급한다" | BSA 수범자는 금융기관 — 등록 전 Decipher의 의무 과대 표명은 지위 오인 리스크 (§10.3·§11.3) |
| "CDD로 수익적 소유자를 확인했으니 look-through는 끝났다" | "CDD BO 확인(AML, ≥ 25%·control)과 자격 look-through(A-08/A-09)는 목적·기준이 다른 별개 절차다" | CIP release가 명시한 경계 — CIP/CDD는 자격판정 look-through를 대체하지 않는다 (§3.8·§3.15) |
| "Rule 501(e)로 매수인을 뭉쳐 센다" | "501(e)는 문언상 506(b) 산정 전용(only)이라 506(c)인 BUIDL에선 dormant — 뭉치기 데이터만 보존한다" | "§230.506(b) only" 문언 — 506(c)에 적용하면 근거 없는 규칙 창설 (§3.13) |
| "동거 가족 지분이 50%면 501(e)로 제외된다" | "501(e)(1)(ii)·(iii)은 '초과(more than 50%)'라 정확히 50%는 미달이고, 144(a)(2)는 '이상(10% or more)'이라 정확히 10%가 포함된다" | 부등호 혼동은 산정 오류의 최빈 원인 — 두 규칙의 방향이 다르다 (§3.4·§3.13) |
| "중복 의심이면 즉시 계정을 차단한다" | "의심(SUSPECTED)은 거래 보류 + 조사(REVIEW)이고, 차단·정정은 확정(CONFIRMED) 후다" | (a)(6)의 "reason to believe"는 조사 개시 문턱이지 유죄 확정이 아니다 — 동명이인 위양성 보호 (§5.5·T5) |
| "12g5-1(a)(6)이 동일인 합산을 강제한다" | "(a)(6)은 허용(may) 규범이고, 강제(shall)는 회피 목적 요건이 붙은 (b)(3)이다 — Decipher는 (a)(6)의 허용을 정책으로 상시 실행한다" | may/shall 구분 — 법이 강제하는 범위와 설계 선택을 섞어 말하면 근거가 흐려진다 (§3.11·§3.12) |
| "법인 계정과 대표 개인 계정은 같은 사람이니 병합한다" | "법인은 12g5-1(a)(2)상 별개 1인 — 병합하지 않는다. 단 회피 목적 껍데기 정황이면 (b)(3) 관통을 별도 검토한다" | 자동 병합은 오탐 — 원칙(별개)과 예외(관통)의 요건이 다르다 (§3.11·T6) |
| "A-04가 그 사람이 AI/QP인지 판정한다" | "A-04는 '누구이고 유일한가'까지만 — 자격의 실체는 A-03·A-13이 판정한다" | 신원과 자격의 층위 분리 — 섞으면 책임 경계·cascade가 무너진다 (§9.1) |
| "지갑 주소를 제재 명단과 대조했으니 스크리닝 완료" | "제재 스크리닝은 신원 속성(이름·생년월일 등)에 대해 수행한다 — 지갑 주소 대조는 보조 신호일 뿐이다" | §5318(l)(2)(C)·1023.220(a)(4)의 대조 대상은 사람 — 주소만 보면 차명·신규 지갑에 무력 (§3.6·§9.3) |
| "키를 잃으면 새로 가입하면 된다" | "키 분실의 유일 경로는 recovery — 같은 ONCHAINID에 새 지갑을 바인딩하고 잔액을 이관한다. 재온보딩은 금지" | 재온보딩 허용은 중복 신원의 합법 창구가 된다 (§7.7·§11.4) |
| "IA AML 규칙이 시행 중이니 자문사 CIP도 적용된다" | "IA AML은 2028-01-01로 연기됐고 IA CIP는 제안 재검토 중 — 2026-07 현재 확립된 CIP 기준은 BD 측(1023.220)이다" | 시행 전 규범을 현행 의무로 서술하면 지형 오인 (§3.9·§3.15) |

## 부록 C. 결론

A-04는 조문 하나의 번역이 아니라, 세 규범군의 교집합을 온체인 신원 계층에 새긴 부품이다 — 요건의 단위는 사람이라는 증권법의 문법(506(c)·§4(d)(1)·144(a)(2)·§3(c)(7)), 그 사람의 진짜 신원을 확인하라는 BSA의 명령(§5318(l)·1023.220·1010.230), 그리고 사람 단위를 쪼개는 형태를 인정하지 않는다는 회피 방지 규범(§12(g)(5)·12g5-1(a)(6)/(b)(3)·144 예비주해). 판정 규칙은 한 문장으로 줄어든다 — **1인 = 1 ONCHAINID, 지갑은 바인딩, 의심은 조사로, 확정은 정정으로.**

설계의 축은 셋이다. 첫째, 비결정성의 하역 — "같은 사람인가"라는 확률적 판단을 온보딩·운영(off-chain)에서 확정하고, 거래 시점의 check()는 3값 enum의 O(1) 판독으로 남긴다. 둘째, 법이 준 문턱의 보존 — (a)(6)의 "reason to believe"는 SUSPECTED(보류·조사)로, (b)(3)의 "shall be deemed"는 CONFIRMED(차단·폐합·재귀속·하류 보정)로, 허용 규범과 강제 규범의 결이 상태 기계에 그대로 살아 있다. 셋째, 경계의 규율 — 다지갑과 다신원, 법인과 그 소유자, CDD와 자격 look-through, 의무(운영주체)와 사실(시스템)을 혼동 없이 가른다.

이 부품이 서 있어야 나머지가 선다 — A-01의 스크리닝이 진짜 사람을 겨누고, A-03·A-13의 검증이 올바른 사람에게 귀속되고, D-01의 카운트와 C-08의 합산이 허수 없이 돌아간다. 남은 것은 §12의 7건 — 특히 reliance 계약 구조(OD-A04-1)의 변호사 확인 — 뿐이며, 그 확인이 오기 전까지 본 문서의 보수적 기본값(BD CIP 수준 온보딩·SUSPECTED 보류·recovery 단일 경로)이 운영 기준이다.

---

**변경 이력**

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v1.0 | 2026-07-15 | 최초 작성 — 법적 근거 17건 verbatim 검증(부록 A), 판정 로직·테스트 7종·Open Issues 7건 확정 |

