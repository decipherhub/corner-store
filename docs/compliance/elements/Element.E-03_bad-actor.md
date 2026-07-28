# ELE.E-03_bad-actor

# E-03 Bad Actor Disqualification(전과자 차단) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 전과자 차단 부품(내부 식별자 E-03)을, 미국 증권 발행 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 PASS/FAIL이 결정되고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서 등 외부 공식 자료만 사용한다.

**출처 기준 (Version 1.0, 2026-07-20).** 본 부품의 미국 증권법 인용은 다음 1차 출처를 기준으로 한다 — 17 CFR §230.501·§230.506은 eCFR 현행본(Title 17, 2026-07-16 기준 표시·최종 개정 2026-06-25 반영), 15 U.S.C. §77d·§77e는 uscode.house.gov 현행본(2026-06-05 시행 법률 반영), Dodd-Frank Act §926은 uscode.house.gov가 §77d 아래 수록한 법령 주석(Pub. L. 111-203, title IX, §926, 124 Stat. 1851)이다. SEC 채택 release(Release No. 33-9414, 78 FR 44730, 2013-07-24)와 스몰비즈니스 컴플라이언스 가이드(2013-09-19, 최종 검토 2013-12-05)는 sec.gov·federalregister.gov다. 전 조문은 2026-07-20 접속·문자 대조했다. 제정법 출처는 uscode.house.gov로 통일했으며, govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다. Cornell LII·Justia 등 2차 DB는 사용하지 않았다.

**테스트 토큰 전제 (중요).** 본 문서는 실제 BlackRock BUIDL의 발행 표준, 발행 참여자 구성, 또는 현재 운영 조건을 단정하지 않는다. 본 프로젝트는 BUIDL-like 자산(Rule 506(c) 발행 + ICA §3(c)(7) 펀드 지분)을 ERC-3643 테스트 토큰으로 모델링하여, 발행 국면의 발행자 측 자격상실 게이팅을 검증하는 것이다. 이하 'BUIDL'·'ERC-3643' 관련 서술은 모두 이 모델링 전제 하의 것이다.

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** 지금까지의 부품 대부분은 *"이 매수인이 살 자격이 있는가"*를 물었다(A-03 적격투자자, A-13 QP 등 — 매수 측). E-03은 물음의 방향이 반대다 — *"이 발행 자체가, 발행자 측 인물의 전력 때문에 오염되어 Rule 506 면제를 잃지 않는가"*를 발행 직전에 판정한다. 매수인이 누구든 상관없다. 발행인 본인, 그 임원·이사, 20% 이상 지분권자, promoter, 보수받는 모집인 — 이 사람들 중 하나라도 증권사기 유죄나 규제 제재 같은 '자격상실 사유(disqualifying event)'에 걸리면, **그 발행의 Rule 506 면제 전체가 무너진다.** 한 사람의 전력이 발행 전체를 감염시키는 구조이므로, 이 부품은 "누가 파는가"가 아니라 "발행 명의 뒤에 누가 서 있는가"를 본다. 그 규범이 조문 어디에서 나오는지, 왜 존재하는지를 먼저 깐다.

### 1.1 발행 규제 지형에서 "발행자가 깨끗한가"의 자리

미국 연방 증권규제의 기본값은 1933년법 §5의 등록의무다 — 등록 없이는 팔지도, 청약하지도 못한다. Decipher에 올라오는 BUIDL-like 자산은 Rule 506(c)로 이 등록의무를 면제받아 발행된다. Rule 506은 §4(a)(2) "사모(private offering)" 면제의 safe harbor이고(Rule 506(a)), 그 위에 두 트랙 — 비일반청약의 506(b)와 일반청약 허용의 506(c) — 이 있다. 두 트랙 모두에 공통으로 얹히는 게이트가 **Rule 506(d) "Bad Actor" disqualification**이다.

| 발행 트랙 | 근거 | 면제의 구조 | 발행자 측에 거는 요건 |
| --- | --- | --- | --- |
| Rule 506(b) | 17 C.F.R. §230.506(b) (§4(a)(2) 의제) | 비공개 발행 의제 — 비일반청약·35인 한도 | **(d) covered person 무결** + (e) pre-2013 사유 공시 |
| Rule 506(c) | 17 C.F.R. §230.506(c) (§4(a)(2) 의제) | 비공개 발행 의제 — 전원 AI·일반청약 허용 | **(d) covered person 무결** + (e) pre-2013 사유 공시 |

핵심은 (d)가 매수인이 아니라 **발행 명의 뒤의 인물 집합(covered persons)**에 요건을 건다는 점이다. 그 집합에 자격상실 사유가 있으면 면제가 성립하지 않고, 사유가 2013-09-23 이전에 발생한 것이면 자격상실 대신 (e)의 서면 공시 의무로 갈린다. E-03은 이 두 갈래 — 자격상실(506(d)) 판정과 공시(506(e)) 판정 — 를 발행 직전 게이트로 원자화한 것이다.

**쉽게 말하면:** 오프라인 세계에서 이 요건은 "전과 있는 사람은 이 면제로 사모를 하지 말라, 예전 일이면 최소한 투자자에게 알려라"라는 발행 적격 규범이었다. DEX에서는 발행(mint) 직전에 "이 발행의 참여자 집단이 깨끗한지 확인된 증서(clearance)가 있는가"라는 게이트로 번역되고, 그 게이트가 E-03이다.

### 1.2 왜 이 규제가 존재하는가 — Dodd-Frank §926과 상습 위반자 차단

Rule 506(d)는 2013년 이전에는 존재하지 않았다. 그 전의 Rule 506에는 bad actor 요건이 아예 없었다. 이 게이트는 2010년 **Dodd-Frank Act §926**이 SEC에 신설을 의무화한 결과다. §926의 설계 목적은 명료하다 — 사기·조작·기만 전력이 있는 자가 가장 널리 쓰이는 사모 면제(Rule 506)의 그늘 뒤에서 다시 자금을 모으는 것을 막는 것이다. Rule 506은 Regulation D 발행의 90~95%를 차지하는 압도적 다수 경로이므로, 여기에 상습 위반자 차단을 붙이는 것이 투자자 보호의 급소였다.

§926은 두 가지를 요구했다: ① 신설 규칙이 Regulation A의 자격상실 조항인 **Rule 262와 substantially similar** 할 것, ② §926이 열거한 추가 사유(특정 주 규제기관의 명령·bar 등)를 포함할 것. SEC는 2013년 이를 Rule 506의 새 (d)·(e)항으로 채택했다(Release 33-9414). 그래서 (d)(1)의 자격상실 사유 목록은 Reg A Rule 262의 계보를 이으면서, §926이 추가한 주 금융규제기관의 final order와 bar를 흡수한 형태다.

이 연혁이 곧 E-03의 사유 지도다. 게이트가 판정하는 것은 발행자 측 인물의 전력 하나하나가 아니라, **"그 전력 전부를 조사(reasonable inquiry)해 문제없음이 확인되었는가"**라는 발행자의 주의의무 이행 여부다. 조사 자체는 오프체인의 법률·실사 판단이고, 게이트는 그 판단이 봉인된 증서의 유효성만 읽는다 — 이 분리가 이 부품의 아키텍처를 결정한다.

### 1.3 disqualification과 disclosure의 이분법 — 2013-09-23이라는 분기선

E-03을 이해하는 가장 중요한 축은 **날짜 하나**다. Rule 506(d)(2)(i)과 (e)가 그은 분기선은 자격상실 사유의 **발생 시점**이 2013-09-23(규칙 발효일) 이후냐 이전이냐다.

- **사유가 2013-09-23 이후 발생** → **(d) 자격상실**. 발행이 Rule 506 면제를 통째로 잃는다(구제·항변 없으면).
- **사유가 2013-09-23 이전 발생** → **(e) 공시 의무**. 발행은 여전히 Rule 506을 쓸 수 있지만, 그 사유를 "자격상실을 유발했을 사항"으로 각 매수인에게 **매도 상당기간 전 서면**으로 알려야 한다. 이 공시는 waiver 대상이 아니다.

주의할 함정 둘. ① 분기 기준은 **사건(유죄판결·명령)의 발생 시점**이지 그 밑에 깔린 행위(underlying conduct)의 시점이 아니다 — 행위는 2013년 전이라도 유죄판결이 2013년 후면 자격상실이다. ② look-back 기간(예: "직전 5년/10년")도 사건 시점부터 세지 행위 시점부터 세지 않는다. 이 두 함정은 §3·§5에서 문언으로 고정한다.

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk

이제 우리 시스템으로 내려오자. E-03의 실패가 어디에 닿는지가 이 부품의 존재 이유다. Rule 506(d)(1)은 "No exemption under this section shall be available for a sale of securities if …"로 시작한다 — 조건을 만족하면 **그 발행(sale)에 면제가 없다**. 면제가 없으면 그 매도는 §5 미등록 판매의 사정권으로 들어간다. §5는 고의·과실을 묻지 않는 무과실 조항이고, 면제의 입증책임은 면제를 주장하는 쪽에 있다.

covered person 오염 → 506(d) 자격상실 → 그 발행의 Rule 506 면제 상실 → 매도가 §5 미등록 판매 사정권 진입 (무과실) → 발행인 rescission 노출·투자자 손해배상 → R1이 매 거래에 부착되어 발행 framework 유지를 확인하는 구조상, 발행이 오염되면 그 토큰의 유통 전 구간이 불안정 → venue가 오염된 발행의 mint·유통을 반복 체결한 기록 = 감독 대응·BD/ATS 성격규명 국면의 최악의 사실관계

마지막 줄이 E-03을 "있으면 좋은" 필터가 아니라 존립(existential) 안전장치로 만든다. 발행이 오염되면 잘못되는 것은 첫 mint 하나가 아니다 — 그 토큰 전체의 면제 기반, 그 물량을 받은 하류 보유자의 지위, 그리고 venue의 규제 방어 서사가 함께 흔들린다. 게다가 disqualifying event는 발행 개시 후에도 발생할 수 있어(임원이 발행 도중 제재를 받는 경우), 한 번 통과했다고 영구히 안전하지 않다 — 그래서 clearance 증서에는 신선도(재조사 주기)와 취소(revocation)가 필수로 얹힌다. 이 부품의 설계 철학은 시종 "보수적으로 — 조사·확인이 봉인된 증서가 있고 그것이 신선하며 취소되지 않은 발행만 열고, 확인 불가면 막는다(fail-closed)"이다.

**쉽게 말하면:** E-03이 실수로 오염된 발행을 통과시키면, 그 토큰을 산 모든 투자자가 rescission(원상회복) 위험에 노출되고, 발행인은 미등록 판매 책임을 지며, 플랫폼은 "전과자 발행을 걸러내지 못한 곳"이라는 기록을 남긴다. 반대로 조사가 부실해도 게이트는 증서만 보고 통과시킬 수 있으므로, 증서 발급 기준서(§11)와 발급기관 감사가 이 부품의 실질 방어선이다.

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고, "본 부품"·"전과자 차단 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | 전과자 차단 (Bad Actor Disqualification) | 이 발행의 참여자 집단이 Rule 506 자격상실 사유에 걸리지 않는지 확인 |
| 검사 대상 | ① covered person roster 선언 존재·완전성 ② bad-actor clearance 증서의 존재·서명·범위 ③ 신선도(재조사 주기) ④ 미취소 ⑤ pre-2013 사유 존재 시 506(e) 공시 이행 플래그 | "이 발행이 발행자 측 전력 때문에 면제를 잃지 않음이 확인됐나" |
| Internal ID | E-03 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 기계 판정 (Pattern A) — 증서 존재·서명·범위·신선도·취소 상태의 결정론 검사. 자격상실 사유의 실질 판단(어느 사유·look-back·in-effect)만 off-chain clearance로 위임 | 게이트는 결정론, 사유 판단은 실사·법무 |
| Timing | pre-trade (발행/mint 직전) + 상장 시점 roster·증서 검사 | 발행이 일어나기 전에 막는다 |
| Stateful 여부 | STATELESS (Element 한정) | 게이트는 증서 상수·발행 컨텍스트·취소 flag의 현재 스냅샷만 읽는다. 증서의 신선도·취소·재발급은 A-11 주기·발급기관·거버넌스 경로(거래 외)로만 갱신된다 |
| 주 활성화 Recipe | R1 (Reg D 506(c) Issuance) — 필수 attach | 발행 거래마다 명시 검사 (R2·R3·R4 비부착) |
| Cumulative Recipe | 없음 — 발행자 측 게이트라 재판매(R2)·펀드(R3)·행위(R4)에는 부착되지 않음 | 발행 국면 전용 |
| Cascade Element | A-08·A-09(entity covered person look-through — 20% 지분권자·모집인이 법인일 때) · A-11(증서 만료) · A-06(affiliated issuer의 control 판정) · E-01(Form D — 발행자 측 형제 부품) | roster 구성·증서 신선도에 얹히거나 이어지는 검사들 |
| 성숙도 | 완료 (본 문서로 Spec 확정) | R1 전용, 데모 필수 |
| 파일·위치 | E-03_bad-actor.md · 산출물/elements/ | 산출물 경로 |

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석)은 채택 release·staff 가이드가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표의 **종류** 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1~§3.16 번호를 유지하며, 각 항목이 어느 Layer인지는 표의 종류 칸으로 확인한다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 세 Layer의 조문·규칙이 E-03 판정에서 어떻게 연결되는지를 하나의 큰 흐름으로 정리한 것이다 — §5 등록의무 기본값에서 출발해, §4(a)(2) 사모 면제와 그 safe harbor인 Rule 506으로 내려오고, Dodd-Frank §926이 신설을 위임한 Rule 506(d)의 covered person × 자격상실 사유 판정에 이르며, 2013-09-23을 기준으로 자격상실(506(d))과 공시(506(e))로 갈라진 뒤, reasonable care 항변·waiver·affiliated issuer 예외라는 세 출구가 어떻게 면제를 유지시키는지를 보여준다. 각 조항의 상세는 §3.1~§3.14.

![그림 3.0 — 법조문 관계 흐름: §5 기본값 → §4(a)(2) 사모 → Rule 506 safe harbor → §926 위임 → 506(d) 판정 → 2013 분기 → 항변·waiver 출구](fig30_e03.png)

*그림 3.0 — 법조문 관계 흐름: §5 기본값 → §4(a)(2) 사모 → Rule 506 safe harbor → §926 위임 → 506(d) covered person × 사유 → 2013-09-23 분기(자격상실/공시) → reasonable care·waiver·제휴 예외 출구 (개발자용)*

**범례.**

- 파랑 = 핵심(Direct/Supporting: §4(a)(2), Rule 506(a), §926, 506(d)(1) covered person × event)

- 회색 = 판정·분기 노드(2013-09-23 기준)

- 초록 = PASS·면제 유지 경로(reasonable care 항변, waiver, 공시 이행)

- 빨강 = FAIL(자격상실 → §5 미등록 판매, 공시 불이행)

- 주황 = 조건부·참고(506(e) 공시 갈래, (d)(3) 제휴 예외)

### 3.0.1 실제 BUIDL에 어떻게 적용되나

§3.0이 일반 조문 흐름이라면, 이 절은 BUIDL-like 테스트 토큰에 E-03이 어떻게 걸리는지를 보여준다. **(재확인) 본 서술은 실제 BlackRock BUIDL의 발행 표준·발행 참여자 구성·현재 운영 조건을 단정하지 않는다.**

**현실 선례 — 왜 발행자 측 실사가 표준인가.** 현실의 Rule 506(c) 사모에서 발행인은 발행 전 통상 covered person 전원에 대한 D&O 질문서·배경조사·인수기관 확인을 수행하고, 그 결과를 offering memorandum·발행 기록에 봉인한다. 이는 우연이 아니다: (d)(2)(iv) reasonable care 항변이 "factual inquiry"를 실제로 했을 것을 전제하므로, 발행인은 조사를 문서로 남겨 두어야 항변이 성립하기 때문이다. Decipher의 clearance 증서는 이 현실의 실사 산출물을 온체인 게이트가 읽을 수 있는 형태로 옮긴 것이다.

**Decipher 모델의 카드 기재.** 본 프로젝트의 BUIDL-like 발행은 상장 시점에 covered person roster(발행인·investment manager·이사·임원·20% 이상 지분권자·promoter·모집인 등)를 선언하고, L2 검증기관(실사 counsel·전환대리인)이 factual inquiry를 수행해 bad-actor clearance 증서를 발급한다. 증서는 offeringId에 scope되고, A-11 주기로 갱신되며, 발행 도중 covered person에게 제재가 생기면 취소된다. mint 거래마다 게이트는 이 증서의 존재·서명·범위·신선도·취소 상태를 확인한다.

**김 부장 시나리오와의 관계.** 재판매 국면의 "김 부장(BlackRock 임원 = affiliate) 매도"는 E-03의 소관이 아니다 — E-03은 발행자 측 게이트라 R1(발행)에만 부착되고 R2(재판매)에는 걸리지 않는다. 다만 김 부장이 만약 **발행인 측 covered person**(예: pooled fund의 investment manager 임원)이기도 하다면, 그의 전력은 발행 국면 E-03의 조사 대상이 된다 — "매도인으로서의 김 부장"(R2·A-06 소관)과 "발행 참여자로서의 김 부장"(R1·E-03 소관)은 다른 물음이다.

### 3.0.2 조문 순서·중요성 한눈에 보기 (법 리스트)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 E-03에 어떻게 닿는지를, **표 2**(순서·중요성)는 아래 §3.1~§3.16 소단원의 읽는 순서(논리 흐름)와 중요성(E-03이 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이다. 제정법 출처는 uscode.house.gov로 통일했다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | E-03 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Securities Act §5 · 15 U.S.C. §77e(a)·(c) | 등록의무 기본값(무과실) | 자격상실이 도착하는 종착점 — fail-closed 설계 근거 | Background | uscode.house.gov |
| Statute | Securities Act §4(a)(2) · 15 U.S.C. §77d(a)(2) | 사모(비공개 발행) 면제 | Rule 506이 구체화하는 제정법 면제 — 면제의 뿌리 | Supporting | uscode.house.gov |
| Statute | Securities Act §4(b) · 15 U.S.C. §77d(b) | 506 일반청약도 공개발행 아님 | 506(c) 트랙이 §4(a)(2) 면제로 남는 근거 | Background | uscode.house.gov |
| Statute | Dodd-Frank Act §926 · Pub. L. 111-203 §926 (124 Stat. 1851) | bad actor 규칙 신설 위임(Rule 262 substantially similar + 주 규제 사유) | 506(d) 존재 이유·사유 목록의 origin | Supporting | uscode.house.gov (§77d note) |
| SEC Rule | Rule 506(a) · 17 C.F.R. §230.506(a) | 506 발행 = §4(a)(2) 거래 의제 | 면제 성립의 규칙 좌표 | Supporting | ecfr.gov |
| SEC Rule | Rule 506(d)(1) · §230.506(d)(1) | covered person 집합 + 자격상실 사유 (i)~(viii) | **판정 본체** — 무엇이 발행을 오염시키나 | Direct | ecfr.gov |
| SEC Rule | Rule 506(d)(2) · §230.506(d)(2) | 예외 — pre-2013·good cause waiver·발령기관 advice·reasonable care | 자격상실의 출구·항변 | Direct | ecfr.gov |
| SEC Rule | Rule 506(d)(3) · §230.506(d)(3) | affiliated issuer 시점 예외 | 제휴 성립 전 사건의 조건부 배제 | Conditional | ecfr.gov |
| SEC Rule | Rule 506(e) · §230.506(e) | pre-2013 사유의 서면 공시 의무 | 자격상실 대신 공시로 가는 갈래 | Direct | ecfr.gov |
| SEC Rule | Rule 501(f) · §230.501(f) | executive officer 정의 | covered person 범위의 문언 고정 | Supporting | ecfr.gov |
| SEC Rule | Rule 501(g) · §230.501(g) | final order 정의 | (d)(1)(iii) 사유의 문언 고정 | Supporting | ecfr.gov |
| SEC Rule | Rule 405 · §230.405 | promoter·officer 정의 | covered person 범위(promoter·participating officer) | Supporting | ecfr.gov |
| SEC Release | Release No. 33-9414 (2013-07-24) · 78 FR 44730 | 채택 release — reasonable care·voting power·participating officer·look-back 기산 | (d)·(e) 현행 구조의 취지·해석 확정 | Supporting | sec.gov |
| SEC Staff | Small Entity Compliance Guide (2013-09-19) | covered person·disqualifying event·in-effect·bar 존속·공시 실무 해설 | 문언의 실무 적용 기준 | Supporting | sec.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | E-03이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | Securities Act §5 — 등록의무 기본값 | 배경 | 안 함 — fail-closed 설계의 종착점 |
| §3.2 | §4(a)(2) — 사모 면제 | 보조 | 안 함 — 면제의 제정법 뿌리 |
| §3.3 | §4(b) — 506 일반청약도 공개발행 아님 | 배경 | 안 함 — 506(c) 트랙의 좌표 |
| §3.4 | Dodd-Frank §926 — 신설 위임 | 보조 | 안 함 — 506(d) 존재 이유·사유 origin |
| §3.5 | Rule 506(a) — §4(a)(2) 의제 | 보조 | 발행 면제 성립의 규칙 확인 |
| §3.6 | Rule 506(d)(1) — covered person × 사유 | 핵심 | 오염 여부의 판정 본체(증서가 봉인) |
| §3.7 | Rule 506(d)(2) — 예외·항변 | 핵심 | 자격상실의 출구(pre-2013·waiver·reasonable care) |
| §3.8 | Rule 506(d)(3) — 제휴 시점 예외 | 핵심(조건부) | affiliated issuer 사건의 조건부 배제 |
| §3.9 | Rule 506(e) — pre-2013 공시 | 핵심 | 공시 갈래의 게이트(506(e) 플래그) |
| §3.10 | Rule 501(f) — executive officer | 보조 | covered person 범위 문언 고정 |
| §3.11 | Rule 501(g) — final order | 보조 | (d)(1)(iii) 사유 문언 고정 |
| §3.12 | Rule 405 — promoter·officer | 보조 | covered person 범위(promoter·participating officer) |
| §3.13 | Release 33-8869 계열 아님 — Release 33-9414 (Layer 3) | 보조 | 안 함 — reasonable care·voting power 해석 |
| §3.14 | Compliance Guide 2013-09-19 (Layer 3) | 배경 | 안 함 — in-effect·bar 존속·공시 실무 |
| §3.15 | Sub-요건 분해 매트릭스 | — | 위 요건을 원자적 검증 단위로 분해 |
| §3.16 | ERC-3643 변환·clearance 필드 총정리 | — | §3.1~§3.14의 필드 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래 조문·쟁점은 같은 발행에 작동하지만 E-03이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리이며, E-03 안에 끌어다 구현하지 않는다.

- **매수인 자격** (Rule 501(a) accredited investor, ICA §2(a)(51) QP) — A-03·A-13 소관. E-03은 매수 측을 보지 않는다.

- **Form D 신고** (Rule 503·Reg D notice) — E-01 소관. E-03은 신고가 아니라 발행자 측 인물의 전력을 본다.

- **affiliate/control 판정 자체** (Rule 144(a)(1)·Rule 405 control) — A-06 소관. E-03은 affiliated issuer의 control 여부를 A-06 산출로 소비한다((d)(3) 판단).

- **entity covered person의 구성원 자격 look-through** (20% 지분권자·모집인이 법인일 때 depth 3) — A-08·A-09 소관. E-03은 roster에 그 산출 결과를 담을 뿐이다.

- **증서 만료·재검증 주기** — A-11의 보편 규율에 편승. E-03은 자체 만료 로직을 갖지 않는다.

- **자격상실 사유의 실질 판단** (어느 (i)~(viii)인가, look-back 계산, in-effect 여부, waiver 성립) — L2 검증기관·법무 소관(clearance 증서에 봉인). E-03은 증서의 유효성 층위 판정까지만 한다.

### 3.1 Securities Act §5 — 등록의무 기본값 (무과실) [uscode.house.gov]

- **조항**: Securities Act of 1933 §5(a)·(c), 15 U.S.C. §77e(a)·(c) — uscode.house.gov

- **핵심 원문**: (a) Unless a registration statement is in effect as to a security, it shall be unlawful for any person, directly or indirectly— (1) to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to sell such security through the use or medium of any prospectus or otherwise; or (2) to carry or cause to be carried through the mails or in interstate commerce, by any means or instruments of transportation, any such security for the purpose of sale or for delivery after sale. [...] (c) It shall be unlawful for any person, directly or indirectly, to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to offer to sell or offer to buy through the use or medium of any prospectus or otherwise any security, unless a registration statement has been filed as to such security [...].

- **한국어**: (a) 어느 증권에 관하여 등록신고서가 효력을 갖고 있지 아니하는 한, 누구든지 직접 또는 간접으로 — (1) 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권을 판매하는 것; 또는 (2) 판매 목적으로 또는 판매 후 인도를 위하여 그 증권을 우편 또는 주간통상으로 운반하거나 운반하게 하는 것은 위법이다. [...] (c) 어느 증권에 관하여 등록신고서가 제출되어 있지 아니하는 한, 누구든지 직접 또는 간접으로 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권의 매도 청약 또는 매수 청약을 하는 것은 위법이다.

- **쉬운 설명**: 발행자 측 자격상실이 실패했을 때 무게가 도착하는 곳이 이 조문이다. §5는 발행 한 번이 아니라 거래 한 건 한 건에 걸리고, 고의·과실을 묻지 않는다. covered person 오염으로 Rule 506 면제가 무너지면, 그 발행의 매도들은 등록 없이 이뤄진 판매가 되어 이 조문의 사정권으로 들어간다 — 면제의 입증책임은 면제를 주장하는 쪽에 있다. E-03에게 이 조문은 이렇게 읽힌다: **자격상실 판정의 실패가 도착하는 곳이 바로 여기이며, 확인 불가면 발행 차단(fail-closed)이 유일한 안전 방향이다.**

- **PASS/FAIL 반영**: 간접 ✕ — E-03이 §5를 판정하지 않는다. 자격상실의 법적 종착점으로서 fail-closed 설계 원칙의 근거가 된다.

- **ERC-3643 변환**: 직접 매핑 없음. Router의 cumulative AND(하나라도 FAIL이면 revert)와 발행 게이트의 pre-trade 배치가 이 조문의 "기본값 = 금지" 구조를 코드에 옮긴 것이다.

### 3.2 Securities Act §4(a)(2) — 사모 면제: E-03이 지키려는 면제의 뿌리 [uscode.house.gov]

- **조항**: Securities Act §4(a)(2), 15 U.S.C. §77d(a)(2) — uscode.house.gov

- **핵심 원문**: The provisions of section 77e of this title shall not apply to— [...] (2) transactions by an issuer not involving any public offering.

- **한국어**: 이 편 §77e(=§5)의 규정은 다음에 적용되지 아니한다 — [...] (2) 발행인의 거래로서 어떠한 공개발행(public offering)도 수반하지 아니하는 것.

- **쉬운 설명**: Rule 506이 딛고 선 제정법 면제다. §5의 등록의무는 "공개발행이 아닌 발행인 거래"에는 적용되지 않는데, 무엇이 "공개발행 아님"인지는 문언만으로는 불확실하다. SEC는 Rule 506을 그 판단의 safe harbor로 만들었다(§3.5). E-03이 지키려는 것이 바로 이 면제다 — covered person이 오염되면 Rule 506 safe harbor를 잃고, 발행인은 §4(a)(2)의 불확실한 사실판단으로 되던져지거나(입증책임 부담) 아예 면제 밖으로 나간다. **E-03은 이 safe harbor의 발행자 측 진입 조건을 지키는 게이트**다.

- **PASS/FAIL 반영**: 간접 ✕ — E-03이 §4(a)(2) 요건(공개발행 여부)을 판정하지 않는다. 면제의 제정법 뿌리로서 자격상실의 의미(무엇을 잃는가)를 규정한다.

- **ERC-3643 변환**: 직접 필드 없음. clearance 증서의 존재가 "이 발행이 506 safe harbor 진입 자격을 갖췄다"는 발행자 측 조건 충족의 증거다.

### 3.3 Securities Act §4(b) — 506 일반청약도 공개발행이 아니다 [uscode.house.gov]

- **조항**: Securities Act §4(b), 15 U.S.C. §77d(b) — uscode.house.gov

- **핵심 원문**: Offers and sales exempt under section 230.506 of title 17, Code of Federal Regulations (as revised pursuant to section 201 of the Jumpstart Our Business Startups Act) shall not be deemed public offerings under the Federal securities laws as a result of general advertising or general solicitation.

- **한국어**: (JOBS Act §201에 따라 개정된) 17 C.F.R. §230.506에 의하여 면제되는 청약·판매는, general advertising 또는 general solicitation을 이유로 연방증권법상 공개발행으로 간주되지 아니한다.

- **쉬운 설명**: 506(c) 트랙(일반청약 허용)이 여전히 §4(a)(2) "사모"로 남는 근거다. JOBS Act가 506(c)에서 일반청약을 열어 줬지만, 그렇게 시끄럽게 청약해도 이 조문 덕분에 "공개발행"이 되지 않는다 — 즉 §4(a)(2) 면제를 유지한다. E-03에게 이 조문은 배경 좌표다: BUIDL-like 506(c) 발행이 일반청약을 쓰더라도 면제 구조는 §4(a)(2)이고, 그 면제에 걸린 (d)·(e) 발행자 측 요건은 그대로 적용된다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 불사용. 506(c) 트랙이 §4(a)(2) 면제로 남는다는 좌표.

- **ERC-3643 변환**: 직접 필드 없음.

### 3.4 Dodd-Frank Act §926 — bad actor 규칙 신설 위임 [uscode.house.gov (§77d note)]

- **조항**: Dodd-Frank Wall Street Reform and Consumer Protection Act §926, Pub. L. 111-203, title IX, §926, July 21, 2010, 124 Stat. 1851 — uscode.house.gov(15 U.S.C. §77d 아래 "Disqualifying Felons and Other 'Bad Actors' From Regulation D Offerings" 주석)

- **핵심 원문**: Not later than 1 year after the date of enactment of this Act, the Commission shall issue rules for the disqualification of offerings and sales of securities made under section 230.506 of title 17, Code of Federal Regulations, that— (1) are substantially similar to the provisions of section 230.262 of title 17, Code of Federal Regulations, or any successor thereto; and (2) disqualify any offering or sale of securities by a person that— (A) is subject to a final order of a State securities commission (or an agency or officer of a State performing like functions), a State authority that supervises or examines banks, savings associations, or credit unions, a State insurance commission (or an agency or officer of a State performing like functions), an appropriate Federal banking agency, or the National Credit Union Administration, that— (i) bars the person from— (I) association with an entity regulated by such commission, authority, agency, or officer; (II) engaging in the business of securities, insurance, or banking; or (III) engaging in savings association or credit union activities; or (ii) constitutes a final order based on a violation of any law or regulation that prohibits fraudulent, manipulative, or deceptive conduct within the 10-year period ending on the date of the filing of the offer or sale; or (B) has been convicted of any felony or misdemeanor in connection with the purchase or sale of any security or involving the making of any false filing with the Commission.

- **한국어**: 이 법 제정일부터 1년 이내에, Commission은 17 C.F.R. §230.506에 따라 이뤄지는 증권의 청약·판매의 자격상실에 관한 규칙을 발한다 — (1) 17 C.F.R. §230.262(또는 그 승계 규정)의 규정과 substantially similar 할 것; 그리고 (2) 다음에 해당하는 자에 의한 증권의 청약·판매를 자격상실시킬 것 — (A) 주 증권위원회(또는 이에 준하는 주의 기관·공무원), 은행·저축조합·신용조합을 감독·검사하는 주 당국, 주 보험위원회(또는 이에 준하는 기관·공무원), 적절한 연방 은행감독기관, 또는 National Credit Union Administration의 final order로서, (i) 그 자를 — (I) 그 위원회·당국·기관·공무원이 규제하는 entity와의 association으로부터; (II) 증권·보험·은행업 영위로부터; 또는 (III) 저축조합·신용조합 활동으로부터 bar하거나; (ii) 청약·판매 신청일로 끝나는 10년 기간 내에 발령된, 사기적·조작적·기만적 행위를 금지하는 법·규정 위반에 근거한 final order를 구성하는 경우; 또는 (B) 증권의 매수·매도와 관련하여 또는 Commission에의 허위 신고와 관련하여 felony 또는 misdemeanor로 유죄판결을 받은 경우.

- **쉬운 설명**: Rule 506(d)의 출생증명서다. 2013년 이전 Rule 506에는 bad actor 조항이 없었고, 이 §926이 SEC에 신설을 명령했다. 두 요구가 오늘의 (d)(1) 목록을 만들었다 — ① Reg A의 자격상실 조항(Rule 262)과 "substantially similar"할 것, ② 주 금융규제기관의 final order·bar를 포함할 것. 그래서 (d)(1)의 사유 목록은 Reg A 계보(유죄·injunction·SEC 명령·SRO 제재·stop order·우편사기)에 §926이 추가한 주 규제기관 사유(iii)를 얹은 형태다. E-03이 §926을 직접 판정하지는 않지만, "왜 이 사유들인가"의 답이 여기 있다.

- **PASS/FAIL 반영**: 간접 ✕ — E-03이 §926을 판정하지 않는다. (d)(1) 사유 목록의 origin·목적 규범.

- **ERC-3643 변환**: 직접 필드 없음. clearance 증서가 조사하는 사유 목록의 법적 근거.

### 3.5 Rule 506(a) — 506 발행은 §4(a)(2) 거래로 의제된다 [ecfr.gov]

- **조항**: 17 C.F.R. §230.506(a) — ecfr.gov (Title 17, 2026-07-16 기준 현행)

- **핵심 원문**: Offers and sales of securities by an issuer that satisfy the conditions in paragraph (b) or (c) of this section shall be deemed to be transactions not involving any public offering within the meaning of section 4(a)(2) of the Act.

- **한국어**: 본 조 (b) 또는 (c)의 조건을 충족하는 발행인의 증권 청약·판매는, 이 법 §4(a)(2)의 의미에서 어떠한 공개발행도 수반하지 아니하는 거래로 **의제된다(deemed)**.

- **쉬운 설명**: 면제 성립의 규칙 좌표다. 발행이 (b) 또는 (c)의 조건을 다 채우면 §4(a)(2) 사모로 "의제"되어 §5 등록의무를 면한다. 핵심 단어는 "conditions in paragraph (b) or (c)"인데, 이 조건에는 (d) bad actor 무결이 포함된다 — (b)(1)·(c)(1)이 §230.501·§230.502를 걸고, (d)는 (b)·(c) 양쪽에 독립적으로 얹히는 별도 disqualifier다. 즉 covered person이 오염되면 "conditions"가 충족되지 않아 의제가 성립하지 않는다. E-03은 이 의제의 발행자 측 조건 하나를 지킨다.

- **PASS/FAIL 반영**: 간접 ✕ — E-03이 (a)의 의제 성립 전체를 판정하지 않는다. 면제 성립의 규칙 프레임으로서, (d) 충족이 의제의 필요조건임을 확정한다.

- **ERC-3643 변환**: 직접 필드 없음. clearance PASS가 "(d) 조건 충족"이라는 의제 요소 하나의 확인.

### 3.6 Rule 506(d)(1) — covered person 집합 × 자격상실 사유: 판정 본체 [ecfr.gov]

- **조항**: 17 C.F.R. §230.506(d)(1) — ecfr.gov (Title 17, 2026-07-16 기준 현행, 최종 개정 2026-06-25)

- **핵심 원문 (covered person 집합)**: No exemption under this section shall be available for a sale of securities if the issuer; any predecessor of the issuer; any affiliated issuer; any director, executive officer, other officer participating in the offering, general partner or managing member of the issuer; any beneficial owner of 20% or more of the issuer's outstanding voting equity securities, calculated on the basis of voting power; any promoter connected with the issuer in any capacity at the time of such sale; any investment manager of an issuer that is a pooled investment fund; any person that has been or will be paid (directly or indirectly) remuneration for solicitation of purchasers in connection with such sale of securities; any general partner or managing member of any such investment manager or solicitor; or any director, executive officer or other officer participating in the offering of any such investment manager or solicitor or general partner or managing member of such investment manager or solicitor:

- **핵심 원문 (자격상실 사유 (i)~(viii), 발췌·요지 유지)**: (i) Has been convicted, within ten years before such sale (or five years, in the case of issuers, their predecessors and affiliated issuers), of any felony or misdemeanor: (A) In connection with the purchase or sale of any security; (B) Involving the making of any false filing with the Commission; or (C) Arising out of the conduct of the business of an underwriter, broker, dealer, municipal securities dealer, investment adviser or paid solicitor of purchasers of securities; (ii) Is subject to any order, judgment or decree of any court of competent jurisdiction, entered within five years before such sale, that, at the time of such sale, restrains or enjoins such person from engaging or continuing to engage in any conduct or practice: [(A)~(C) 증권 매매·허위신고·금융중개업 영위 관련]; (iii) Is subject to a final order of a state securities commission [...]; an appropriate federal banking agency; the U.S. Commodity Futures Trading Commission; or the National Credit Union Administration that: (A) At the time of such sale, bars the person from [...]; or (B) Constitutes a final order based on a violation of any law or regulation that prohibits fraudulent, manipulative, or deceptive conduct entered within ten years before such sale; (iv) Is subject to an order of the Commission entered pursuant to section 15(b) or 15B(c) of the Securities Exchange Act of 1934 or section 203(e) or (f) of the Investment Advisers Act of 1940 that, at the time of such sale: (A) Suspends or revokes such person's registration [...]; (B) Places limitations on the activities [...]; or (C) Bars such person from being associated with any entity or from participating in the offering of any penny stock; (v) Is subject to any order of the Commission entered within five years before such sale that, at the time of such sale, orders the person to cease and desist from committing or causing a violation or future violation of: (A) Any scienter-based anti-fraud provision of the federal securities laws [...]; or (B) Section 5 of the Securities Act of 1933; (vi) Is suspended or expelled from membership in, or suspended or barred from association with a member of, a registered national securities exchange or a registered national or affiliated securities association for any act or omission to act constituting conduct inconsistent with just and equitable principles of trade; (vii) Has filed (as a registrant or issuer), or was or was named as an underwriter in, any registration statement or Regulation A offering statement filed with the Commission that, within five years before such sale, was the subject of a refusal order, stop order, or order suspending the Regulation A exemption, or is, at the time of such sale, the subject of an investigation or proceeding to determine whether a stop order or suspension order should be issued; or (viii) Is subject to a United States Postal Service false representation order entered within five years before such sale [...].

- **한국어 (covered person 집합)**: 본 조의 면제는, 다음 중 어느 하나가 아래 (i)~(viii)에 해당하면 증권의 매도에 대하여 이용될 수 없다 — 발행인; 발행인의 predecessor; affiliated issuer; 발행인의 이사·executive officer·발행에 참여하는 그 밖의 officer·general partner 또는 managing member; 의결권 기준으로 산정한 발행인의 outstanding voting equity securities의 20% 이상(20% or more) beneficial owner; 매도 시점에 어떤 자격으로든 발행인과 연결된 promoter; pooled investment fund인 발행인의 investment manager; 그 매도와 관련하여 매수인 모집의 대가로 (직·간접) 보수를 받았거나 받을 자; 그러한 investment manager·모집인의 general partner 또는 managing member; 또는 그러한 investment manager·모집인·general partner·managing member의 이사·executive officer·발행에 참여하는 그 밖의 officer.

- **한국어 (사유 요지)**: (i) 매도 직전 10년(발행인·predecessor·affiliated issuer는 5년) 내에 증권 매매·Commission 허위신고·금융중개업 영위와 관련한 felony/misdemeanor 유죄판결; (ii) 매도 직전 5년 내에 발령되어 매도 시점에 증권 매매 등 특정 행위를 restrain·enjoin하는 법원 명령·판결·decree의 대상; (iii) 주 증권·은행·보험·신용조합 규제기관, 연방 은행감독기관, CFTC, NCUA의 final order로서 매도 시점에 특정 bar를 하거나 매도 직전 10년 내 발령된 사기금지법 위반 근거의 final order; (iv) Exchange Act §15(b)/15B(c) 또는 Advisers Act §203(e)/(f)에 따른 Commission 명령으로서 매도 시점에 등록 정지·취소, 활동 제한, 또는 association·penny stock 발행참여 bar; (v) 매도 직전 5년 내 발령되어 매도 시점에 scienter 기반 사기금지 조항 또는 Securities Act §5 위반의 cease-and-desist를 명하는 Commission 명령; (vi) 등록 national securities exchange·association에서의 회원 정지·제명 또는 회원과의 association 정지·bar(공정·형평 원칙에 반하는 행위); (vii) registrant/issuer로 제출했거나 underwriter로 지명된 registration statement·Reg A offering statement가 매도 직전 5년 내 refusal/stop order 대상이었거나 매도 시점에 그 발령 여부 조사·절차 중; (viii) 매도 직전 5년 내 발령된 미국 우편청 false representation order 등의 대상.

- **쉬운 설명**: 이 조문이 판정 본체다. 두 축의 곱(集合 × 事由)으로 읽는다. **축 1 — covered person(누가 오염원이 될 수 있나)**: 발행인 자신부터, 이사·임원·발행 참여 officer·GP·managing member, **20% 이상 의결권 지분권자**, promoter, pooled fund의 investment manager와 그 임원들, 그리고 보수받는 모집인과 그 임원들까지. 매수인은 여기 없다 — 철저히 발행 명의 뒤의 인물 집단이다. **축 2 — disqualifying event(무엇이 오염인가)**: 8개 범주. 각 범주마다 look-back(예: 유죄는 비발행인 10년·발행인 5년; injunction·C&D·stop·우편사기는 5년; final order 사기근거는 10년)과 "at the time of such sale"(명령·bar는 매도 시점에 효력이 있어야 함) 요건이 다르다. E-03의 게이트는 이 8×N 조사를 직접 하지 않는다 — L2 검증기관이 factual inquiry로 수행해 "전부 clear"를 증서에 봉인하고, 게이트는 그 증서의 유효성만 읽는다. 다만 이 문언이 곧 발급 기준서의 조사 항목표이므로(§11.3), 문언을 정확히 옮기는 것이 이 부품 정확도의 뿌리다. **경계값 주의 — "20% or more"는 이상(≥)이지 초과(>)가 아니다.** 정확히 20%도 covered person이다(§5.3).

- **PASS/FAIL 반영**: 직접 ○ (판정 본체, 증서 경유) — covered person 집합에 (i)~(viii) 사유가 하나라도 있고 사유가 2013-09-23 이후 발생 & 구제·항변 부재면 발행 자격상실. 게이트는 이 결론이 봉인된 clearance 증서의 "noDisqualifyingEvent = true"를 소비한다.

- **ERC-3643 변환**: clearance claim data에 coveredPersonRosterHash(축 1의 봉인) + inquiryScope(축 2의 8범주 조사 커버리지) + noDisqualifyingEvent(bool) + waiverRefs(있으면). 게이트는 claim 존재·서명·범위·신선도·미취소만 검사(§3.16).

### 3.7 Rule 506(d)(2) — 예외: pre-2013·waiver·발령기관 advice·reasonable care [ecfr.gov]

- **조항**: 17 C.F.R. §230.506(d)(2) + Instruction to (d)(2)(iv) — ecfr.gov

- **핵심 원문**: (2) Paragraph (d)(1) of this section shall not apply: (i) With respect to any conviction, order, judgment, decree, suspension, expulsion or bar that occurred or was issued before September 23, 2013; (ii) Upon a showing of good cause and without prejudice to any other action by the Commission, if the Commission determines that it is not necessary under the circumstances that an exemption be denied; (iii) If, before the relevant sale, the court or regulatory authority that entered the relevant order, judgment or decree advises in writing (whether contained in the relevant judgment, order or decree or separately to the Commission or its staff) that disqualification under paragraph (d)(1) of this section should not arise as a consequence of such order, judgment or decree; or (iv) If the issuer establishes that it did not know and, in the exercise of reasonable care, could not have known that a disqualification existed under paragraph (d)(1) of this section. *Instruction to paragraph (d)(2)(iv).* An issuer will not be able to establish that it has exercised reasonable care unless it has made, in light of the circumstances, factual inquiry into whether any disqualifications exist. The nature and scope of the factual inquiry will vary based on the facts and circumstances concerning, among other things, the issuer and the other offering participants.

- **한국어**: (2) 본 조 (d)(1)은 다음에는 적용되지 아니한다: (i) 2013-09-23 이전에 발생하거나 발령된 유죄판결·명령·판결·decree·정지·제명·bar에 관하여; (ii) good cause의 소명이 있고 Commission의 다른 조치를 방해하지 않는 한, Commission이 해당 상황에서 면제를 부인할 필요가 없다고 판단하는 경우; (iii) 관련 매도 이전에, 관련 명령·판결·decree를 발령한 법원 또는 규제당국이 (그 판결·명령·decree에 포함되든 Commission·그 staff에 별도로든) (d)(1)의 자격상실이 그 명령·판결·decree의 결과로 발생하지 아니한다고 서면으로 advise하는 경우; 또는 (iv) 발행인이 (d)(1)의 자격상실이 존재함을 알지 못했고 reasonable care를 다하였음에도 알 수 없었음을 입증하는 경우. *(d)(2)(iv)에 대한 지시:* 발행인은, 상황에 비추어, 자격상실이 존재하는지에 대한 factual inquiry를 하지 아니하는 한 reasonable care를 다하였음을 입증할 수 없다. factual inquiry의 성격과 범위는 발행인·다른 발행 참여자 등에 관한 사실·정황에 따라 달라진다.

- **쉬운 설명**: 자격상실의 네 출구다. **(i) 2013-09-23 이전 사건** — 자격상실이 적용되지 않는다(대신 (e) 공시로 감). 이것이 §1.3의 분기선이다. **(ii) good cause waiver** — SEC가 재량으로 면제를 부인할 필요 없다고 판단하면 자격상실이 풀린다(신청·심사 필요). **(iii) 발령기관 advice** — 명령을 낸 법원·규제기관이 "이 명령으로 506 자격상실이 생기지 않는다"고 서면으로 밝히면 풀린다. **(iv) reasonable care 항변** — 발행인이 몰랐고 **factual inquiry를 다했어도** 알 수 없었음을 입증하면 자격상실을 면한다. 지시문이 못을 박는다: factual inquiry 없이는 reasonable care가 성립하지 않는다. 이것이 E-03 아키텍처의 심장이다 — clearance 증서는 곧 "factual inquiry를 했다"의 온체인 증거이고, 발급 기준서(§11.3)의 조사 항목이 이 항변의 실질을 이룬다. 게이트는 (i)·(iii)·(iv)를 재판정하지 않는다: L2가 증서에 결론을 봉인하고((i) pre-2013은 (e) 갈래로, (ii)·(iii) waiver는 waiverRef로, (iv) 조사 이행은 inquiry 기록으로), 게이트는 그 봉인을 읽는다.

- **PASS/FAIL 반영**: 직접 ○ (출구) — (i)은 (e) 갈래로 전환(자격상실 아님, 단 공시 게이트 활성); (ii)·(iii)은 waiverRef 존재로 해당 사유를 clear 처리; (iv)는 factual inquiry 이행이 증서 발급의 전제. 게이트 층에서는 이 출구들이 이미 증서 상태(noDisqualifyingEvent·waiverRefs·disclosure506eRequired)에 반영된 결과만 소비된다.

- **ERC-3643 변환**: claim data.waiverRefs[](good cause·발령기관 advice) · claim data.disclosure506eRequired(pre-2013 사유 존재 시 true) · claim data.inquiryRecordHash(factual inquiry 이행 증거). 게이트는 disclosure506eRequired = true면 G6(공시 이행) 활성.

### 3.8 Rule 506(d)(3) — affiliated issuer 시점 예외 [ecfr.gov]

- **조항**: 17 C.F.R. §230.506(d)(3) — ecfr.gov

- **핵심 원문**: (3) For purposes of paragraph (d)(1) of this section, events relating to any affiliated issuer that occurred before the affiliation arose will be not considered disqualifying if the affiliated entity is not: (i) In control of the issuer; or (ii) Under common control with the issuer by a third party that was in control of the affiliated entity at the time of such events.

- **한국어**: (3) 본 조 (d)(1)의 목적상, affiliated issuer에 관련된 사건으로서 제휴(affiliation)가 성립하기 전에 발생한 것은, 그 affiliated entity가 다음에 해당하지 아니하면 자격상실 사유로 보지 아니한다: (i) 발행인을 control하고 있거나; 또는 (ii) 그 사건 당시 affiliated entity를 control하던 제3자에 의하여 발행인과 common control 하에 있는 경우.

- **쉬운 설명**: affiliated issuer의 과거를 어디까지 소급하나의 경계다. affiliated issuer(공통·상하 지배 관계의 발행 참여 entity)에 자격상실 사유가 있어도, 그 사유가 **제휴 성립 전**에 생겼고 그 entity가 발행인을 지배하지도(control), 같은 제3자 지배 하에 있지도 않으면 자격상실로 치지 않는다. 즉 "나중에 제휴한 남의 과거"까지 발행인이 뒤집어쓰지는 않되, 지배관계로 얽힌 경우는 예외 없이 소급한다. E-03에서는 affiliated issuer가 roster에 있을 때 L2가 이 시점·control 판정을 수행하고(control 판정 자체는 A-06 산출 소비), 결과를 증서에 반영한다.

- **PASS/FAIL 반영**: 조건부 — affiliated issuer 사건의 disqualifying 여부를 좁히는 예외. 게이트가 직접 판정하지 않고, 증서 발급 단계에서 반영된 결과(해당 사건이 noDisqualifyingEvent 산정에서 제외됐는지)를 소비.

- **ERC-3643 변환**: roster entry에 affiliatedIssuerFlag + affiliationDate + controlStatus(A-06 산출). L2가 (3) 판정에 사용하며, 게이트는 최종 noDisqualifyingEvent만 읽는다.

### 3.9 Rule 506(e) — pre-2013 사유의 서면 공시 의무 [ecfr.gov]

- **조항**: 17 C.F.R. §230.506(e) + Instruction to (e) — ecfr.gov

- **핵심 원문**: (e) Disclosure of prior "bad actor" events. The issuer shall furnish to each purchaser, a reasonable time prior to sale, a description in writing of any matters that would have triggered disqualification under paragraph (d)(1) of this section but occurred before September 23, 2013. The failure to furnish such information timely shall not prevent an issuer from relying on this section if the issuer establishes that it did not know and, in the exercise of reasonable care, could not have known of the existence of the undisclosed matter or matters. *Instruction to paragraph (e).* An issuer will not be able to establish that it has exercised reasonable care unless it has made, in light of the circumstances, factual inquiry into whether any disqualifications exist.

- **한국어**: (e) 종전 "bad actor" 사건의 공시. 발행인은 각 매수인에게, 매도 상당기간 전에, (d)(1)의 자격상실을 유발했을 것이나 2013-09-23 이전에 발생한 사항에 관한 서면 설명을 제공하여야 한다. 그러한 정보를 적시에 제공하지 못한 것은, 발행인이 미공시 사항의 존재를 알지 못했고 reasonable care를 다하였음에도 알 수 없었음을 입증하는 경우, 발행인이 본 조에 의존하는 것을 방해하지 아니한다. *(e)에 대한 지시:* 발행인은, 상황에 비추어, 자격상실이 존재하는지에 대한 factual inquiry를 하지 아니하는 한 reasonable care를 다하였음을 입증할 수 없다.

- **쉬운 설명**: 자격상실의 반대 갈래다. 사유가 2013-09-23 이전에 생겼으면 발행은 자격상실을 면하지만(§3.7 (d)(2)(i)), 공짜는 아니다 — 그 사유를 "자격상실을 유발했을 사항"으로 각 매수인에게 **매도 상당기간 전 서면**으로 알려야 한다. 이 공시는 waiver가 없다(면제·경감 불가). 다만 몰랐고 조사해도 알 수 없었으면 미공시가 발행 의존을 막지 않는다는 reasonable care 안전판이 여기에도 있다. E-03에서 이 갈래는 별도 게이트(G6)로 구현된다: 증서가 "pre-2013 disqualifying matters 존재(disclosure506eRequired = true)"를 표시하면, "각 매수인에게 서면 공시 이행(disclosureFurnished = true)"이 참이어야 발행이 통과한다.

- **PASS/FAIL 반영**: 직접 ○ (공시 게이트) — disclosure506eRequired = true ⇒ disclosureFurnished = true 이어야 PASS. false면 FAIL_BADACTOR_506E_DISCLOSURE_MISSING. pre-2013 사유가 없으면 이 게이트는 비활성(자동 통과).

- **ERC-3643 변환**: claim data.disclosure506eRequired(bool) · claim data.disclosureFurnished(bool) · claim data.disclosedMattersHash(공시 문서 해시). G6가 이 셋을 검사. (e) 공시는 buyer별 furnish이므로 발행 UX/기록 계층이 매수인 수령을 보증하고 증서가 그 이행을 확인.

### 3.10 Rule 501(f) — executive officer 정의 [ecfr.gov]

- **조항**: 17 C.F.R. §230.501(f) — ecfr.gov

- **핵심 원문**: Executive officer shall mean the president, any vice president in charge of a principal business unit, division or function (such as sales, administration or finance), any other officer who performs a policy making function, or any other person who performs similar policy making functions for the issuer. Executive officers of subsidiaries may be deemed executive officers of the issuer if they perform such policy making functions for the issuer.

- **한국어**: executive officer란 president, 주요 사업단위·부문·기능(예: 영업·관리·재무)을 담당하는 vice president, policy making 기능을 수행하는 그 밖의 officer, 또는 발행인을 위하여 유사한 policy making 기능을 수행하는 그 밖의 자를 말한다. 자회사의 executive officer도 발행인을 위하여 그러한 policy making 기능을 수행하면 발행인의 executive officer로 볼 수 있다.

- **쉬운 설명**: covered person 축의 "executive officer"가 누구까지인지의 문언이다. 직함이 아니라 **기능**(정책결정)이 기준이다 — president·핵심부문 담당 VP는 물론, 정책결정을 하는 그 밖의 임원, 심지어 발행인을 위해 정책결정 기능을 하는 자회사 임원까지 포섭된다. (d)(1)이 "executive officer"와 별도로 "other officer participating in the offering"을 열거하므로, executive officer는 발행 참여 여부와 무관하게 covered person이고(§3.12의 participating officer는 발행 참여가 조건), roster 구성 시 이 구분을 지켜야 한다.

- **PASS/FAIL 반영**: 간접 ✕ — 정의 조항. roster 완전성 심사(V채널)와 발급 기준서의 covered person 식별 기준.

- **ERC-3643 변환**: roster entry.role ∈ {EXECUTIVE_OFFICER, ...} 분류의 문언 근거. 게이트 미사용, L2·상장 심사용.

### 3.11 Rule 501(g) — final order 정의 [ecfr.gov]

- **조항**: 17 C.F.R. §230.501(g) — ecfr.gov

- **핵심 원문**: Final order shall mean a written directive or declaratory statement issued by a federal or state agency described in § 230.506(d)(1)(iii) under applicable statutory authority that provides for notice and an opportunity for hearing, which constitutes a final disposition or action by that federal or state agency.

- **한국어**: final order란 §230.506(d)(1)(iii)에 기술된 연방·주 기관이 통지 및 청문 기회를 규정한 해당 법적 권한 하에 발한 서면 지시 또는 declaratory statement로서, 그 연방·주 기관에 의한 final disposition 또는 조치를 구성하는 것을 말한다.

- **쉬운 설명**: (d)(1)(iii) 사유의 핵심어 "final order"의 문언이다. 세 요소 — ① 서면, ② 통지·청문 기회가 법적으로 규정된 권한 하 발령, ③ final disposition. Compliance Guide가 보태는 실무 요점(§3.14): final order는 항소 가능해도 final일 수 있고(비항소성 불요), 청문이 실제 열릴 필요는 없으며(settlement도 "opportunity for hearing 이후"로 봄), 그 근거가 사기·조작·기만 금지 규정 위반이면 (iii)(B)의 10년 look-back에 걸린다. L2는 이 정의로 주 규제기관 명령이 자격상실 사유인지 판정한다.

- **PASS/FAIL 반영**: 간접 ✕ — 정의 조항. (d)(1)(iii) 사유 조사의 문언 기준(clearance 발급 단계).

- **ERC-3643 변환**: 게이트 미사용. inquiryScope의 (iii) 범주 조사 정의.

### 3.12 Rule 405 — promoter·officer 정의 [ecfr.gov · sec.gov]

- **조항**: 17 C.F.R. §230.405("promoter"·"officer" 정의) — ecfr.gov. 본 블록의 promoter 서술은 SEC Small Entity Compliance Guide(sec.gov)의 Rule 405 전재를, officer 정의는 Release 33-9414 n.31의 Rule 405 전재를 사용한다(두 인용 모두 1차 SEC 문서의 자체 전재).

- **핵심 원문 (officer, Release 33-9414 n.31)**: Under Rule 405, the term "officer" is defined as "a president, vice president, secretary, treasurer or principal financial officer, comptroller or principal accounting officer, and any person routinely performing corresponding functions with respect to any organization."

- **핵심 원문 (promoter, Compliance Guide 전재)**: Securities Act Rule 405 defines a promoter as any person—individual or legal entity—that either alone or with others, directly or indirectly takes initiative in founding the business or enterprise of the issuer, or, in connection with such founding or organization, directly or indirectly receives 10% or more of any class of issuer securities or 10% or more of the proceeds from the sale of any class of issuer securities (other than securities received solely as underwriting commissions or solely in exchange for property).

- **한국어**: officer란 president, vice president, secretary, treasurer 또는 principal financial officer, comptroller 또는 principal accounting officer, 그리고 어떤 조직에 대하여 이에 상응하는 기능을 통상적으로 수행하는 모든 자를 말한다. promoter란 개인이든 법인이든, 단독 또는 타인과 함께 직·간접으로 발행인의 사업·기업 창설에 initiative를 취하거나, 그 창설·조직과 관련하여 직·간접으로 발행인 증권의 어느 class의 10% 이상 또는 그 판매대금의 10% 이상을 (인수수수료만으로 또는 재산 교환만으로 받은 것 제외) 받는 자를 말한다.

- **쉬운 설명**: covered person 축의 두 경계를 문언으로 고정한다. **participating officer** — (d)(1)이 "other officer participating in the offering"이라 했으므로, 위 officer 정의에 해당하는 자 중 발행에 참여한 자가 covered person이다. Release 33-9414는 "발행 참여"가 transitory·incidental 관여를 넘어야 하며 due diligence·공시문서 준비·투자자 소통 같은 활동을 포함할 수 있다고 본다(§3.13). **promoter** — 범위가 넓다. 창설 이니셔티브를 취하거나 발행인 증권/대금의 10% 이상을 받은 자(개인·법인 불문)이고, "단독 또는 타인과, 직·간접" 기준이므로 중간에 다른 법인이 끼어도 결과가 바뀌지 않는다. 이 넓은 범위 때문에 roster 구성 시 promoter 식별이 흔한 누락 지점이다.

- **PASS/FAIL 반영**: 간접 ✕ — 정의 조항. covered person roster의 participating officer·promoter 식별 기준(V채널·발급 기준서).

- **ERC-3643 변환**: roster entry.role ∈ {PARTICIPATING_OFFICER, PROMOTER, ...} 분류 근거. promoter가 법인이면 A-08/A-09 look-through로 그 구성원 자격까지 조사(§9). 게이트 미사용.

### 3.13 SEC Release No. 33-9414 (2013-07-24) — 채택 release의 해석 (Layer 3) [sec.gov]

- **조항**: Release No. 33-9414, 78 FR 44730(2013-07-24), "Disqualification of Felons and Other 'Bad Actors' From Rule 506 Offerings" — sec.gov/federalregister.gov

- **핵심 원문 (요지 인용)**: Section 926 requires us to adopt rules that disqualify securities offerings involving certain "felons and other 'bad actors'" from reliance on Rule 506 of Regulation D. The rules must be "substantially similar" to Rule 262 under the Securities Act [...] and must also cover matters enumerated in Section 926 of the Dodd-Frank Act (including certain state regulatory orders and bars).

- **한국어**: §926은 특정 "felons and other 'bad actors'"가 관여한 증권 발행을 Rule 506 의존에서 자격상실시키는 규칙 채택을 요구한다. 그 규칙은 Rule 262와 "substantially similar"해야 하고, §926이 열거한 사항(특정 주 규제 명령·bar 포함)도 포섭해야 한다.

- **쉬운 설명**: 이 채택 release가 문언 뒤의 해석을 메운다. E-03 설계에 직접 영향을 주는 네 해석. ① **reasonable care는 factual inquiry를 요구**하고 그 성격·범위는 발행인·참여자 사정에 따라 달라진다 — 정형 체크리스트가 아니라 상황 비례 조사. ② **20% beneficial owner는 단일 class가 아니라 total voting power 기준** — "voting securities"인지는 이사 선임·해임이나 인수·처분·자금조달 같은 중요 거래 승인 권한 같은 실질 지배·영향력 여부로 판단한다. ③ **participating officer의 "발행 참여"는 transitory·incidental을 넘는 관여** — due diligence·공시문서 준비·투자자 소통 등. ④ **look-back은 사건(유죄·명령) 발생 시점부터** 세지 밑에 깔린 행위 시점부터 세지 않는다. 이 넷이 발급 기준서(§11.3)의 조사 규범이 된다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 불사용. reasonable care·voting power·participating officer·look-back 기산의 해석 좌표(증서 발급 규범).

- **ERC-3643 변환**: 직접 필드 없음. inquiryScope·roster 구성·votingPowerBasis 산정의 해석 근거.

### 3.14 SEC Small Entity Compliance Guide (2013-09-19) — 실무 적용 (Layer 3) [sec.gov]

- **조항**: "Disqualification of Felons and Other 'Bad Actors' from Rule 506 Offerings and Related Disclosure Requirements — A Small Entity Compliance Guide"(2013-09-19, 최종 검토 2013-12-05) — sec.gov

- **핵심 원문 (요지 인용)**: The look-back period is measured from the date of the disqualifying event [...] and not the date of the underlying conduct that led to the disqualifying event. [...] Disqualification only applies for injunctions and restraining orders that are in effect at the time of the proposed sale of securities and were entered within the preceding five years. [...] A bar is disqualifying only for as long as it has continuing effect.

- **한국어**: look-back 기간은 자격상실 사건의 발생일부터 측정하며, 그 사건을 초래한 underlying conduct의 시점부터 측정하지 아니한다. [...] injunction·restraining order는 매도 제안 시점에 효력이 있고 직전 5년 내에 발령된 것에 한하여 자격상실이 적용된다. [...] bar는 계속적 효력이 있는 동안에만 자격상실 사유가 된다.

- **쉬운 설명**: 문언의 실무 적용을 못 박는 SEC staff 해설이다. E-03 발급 규범에 직결되는 세 실무 규칙. ① **"in effect at the time of sale"** — injunction·bar·명령은 매도 시점에 **살아 있어야** 자격상실이다. 5년 내 발령됐어도 매도 전에 해제·소멸했으면 자격상실 아님(예: 4년 전 발령됐다가 발행 전 해제된 injunction). 반대로 bar가 계속 효력이면 5년 창과 무관하게 존속하는 동안 자격상실. ② **look-back은 사건 발생일 기산**(행위 시점 아님). ③ **공시 형식** — pre-2013 사유 공시는 투자자가 얻는 정보 전체(total mix)에서 적정 위치·비중(reasonable prominence)으로 제공. 또한 **전환 규칙**: 발행 도중 사유가 생기면 그 전 매도는 무영향, 이후 매도만 자격상실(reasonable care·waiver 가능) — 이것이 증서 신선도·취소(G4·G5)의 법적 근거다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 불사용. in-effect·bar 존속·공시 prominence·mid-offering 전환의 실무 규범(증서 신선도·취소·공시 게이트 근거).

- **ERC-3643 변환**: 직접 필드 없음. claim 신선도 주기(A-11)·revocation 트리거·disclosureFurnished 판정의 실무 근거.

### 3.15 Sub-요건 분해 매트릭스

위 §3.1~§3.14의 원리를, E-03이 실제로 판정하는 원자적 검증 단위로 분해한다. 각 행은 §5.2의 판정 분기와 1:1 대응한다(채널 표기: V = 상장 시점 카드·증서 검사, G = per-tx 게이트, L2 = 발급기관 실사 평면, GOV = 거버넌스 평면). deemed-PASS 같은 우회 경로는 존재하지 않는다.

| Sub-ID | 원자 검증 단위 | 근거 원리 | 채널 | PASS 조건 | FAIL 코드 |
| --- | --- | --- | --- | --- | --- |
| E03-V1 | roster 선언 존재 — coveredPersonRoster 비영 | §5 fail-closed(§3.1)·(d)(1) 집합(§3.6) | V | roster ≠ ∅ ∧ rosterHash 기재 | FAIL_BADACTOR_ROSTER_MISSING |
| E03-V2 | roster 완전성 심사 — (d)(1) 범주 커버 | (d)(1) covered person 열거(§3.6·§3.10·§3.12) | V | 발행인·predecessor·affiliated issuer·이사/EO/참여officer/GP/MM·20%↑ voting owner·promoter·pooled fund IM·모집인 각 범주 식별 완료 | REVIEW_BADACTOR_ROSTER_INCOMPLETE |
| E03-V3 | 증서 초기 유효 — clearance attestation 서명·범위 | Pattern B 위임(§3.7 (d)(2)(iv)) | V | clearance 존재 ∧ L2 서명 ∧ scope = offeringId | FAIL_BADACTOR_CLEARANCE_MISSING |
| E03-V4 | 공시 플래그 정합 — pre-2013 사유 ⇒ 506(e) | (d)(2)(i)(§3.7)·(e)(§3.9) | V | disclosure506eRequired ⇒ disclosedMattersHash 기재 | REVIEW_BADACTOR_506E_PENDING |
| E03-G1 | 증서 존재 — 발행 시 clearance 조회 | 결정론 방어층·fail-closed | G① | clearance(offeringId) ≠ null | FAIL_BADACTOR_CLEARANCE_MISSING |
| E03-G2 | 발급자 서명 — 인가 L2 Trusted Issuer | (d)(2)(iv) 조사 주체 신뢰(§3.7) | G② | issuerOf(clearance) ∈ TRUSTED_BADACTOR_ISSUERS ∧ 서명 유효 | FAIL_BADACTOR_ISSUER_UNTRUSTED |
| E03-G3 | 범위 정합 — offering scope 일치 | 증서 scope 규율 | G③ | clearance.offeringId = tx.offeringId | FAIL_BADACTOR_SCOPE_MISMATCH |
| E03-G4 | 신선도 — 미만료·재조사 주기 내 | mid-offering 사건(§3.14)·A-11 | G④ | now ≤ clearance.expiry (A-11 소관) | FAIL_BADACTOR_CLEARANCE_STALE |
| E03-G5 | 미취소 — revocation 부재 | mid-offering 취소(§3.14) | G⑤ | !revoked(clearance) | FAIL_BADACTOR_REVOKED |
| E03-G6 | 공시 이행 — pre-2013 사유 시 furnish | (e) 서면 공시(§3.9) | G⑥ | clearance.disclosure506eRequired ⇒ clearance.disclosureFurnished = true | FAIL_BADACTOR_506E_DISCLOSURE_MISSING |
| E03-L2a | 사유 조사 실질 — factual inquiry 이행 | (d)(2)(iv) 지시(§3.7)·33-9414(§3.13) | L2 | 8범주((i)~(viii)) look-back·in-effect 조사 완료·기록 | (게이트 밖 — 부실은 증서 취소·감사) |
| E03-L2b | 20% 산정 — total voting power | (d)(1) 문언(§3.6)·33-9414(§3.13) | L2 | votingPowerBasis 기준 ≥ 20% 지분권자 식별 | (게이트 밖 — roster 반영) |
| E03-GOV | 신뢰 발급자 집합 규율 | 조사 주체 신뢰 근거 | GOV | TRUSTED_BADACTOR_ISSUERS 변경은 다중서명·time-lock + 근거 등록 | (우회 시도는 B-01 버전 검사로 표면화) |

**두 가지 판독 규칙.** ① 게이트(G①~G⑥)는 **증서의 유효성 층위**만 본다 — 자격상실 사유의 실질 판단(어느 사유·look-back·in-effect·waiver 성립)은 전부 증서에 봉인된 L2 결론이다. 게이트가 사유를 재판정하지 않는 것이 이 부품의 결정성의 원천이다(§5.5). ② **20% or more는 이상(≥)이다** — 정확히 20% voting power도 covered person이다. 이 경계를 초과(>)로 구현하면 정확히 20% 지분권자를 roster에서 누락하는 과소포섭 오류가 된다(§5.3, §7 T5).

### 3.16 ERC-3643 변환·clearance 필드 총정리

§3.1~§3.14에 흩어진 변환을 한곳에 모은 것이다. E-03의 필드는 세 층으로 나뉜다 — 발행 카드 상수(ManifestCore의 발행 메타), 거버넌스 평면 상수(신뢰 발급자 집합), 그리고 사람이 아닌 **발행/offering 레벨 claim**(clearance attestation). E-03은 매수인 자격 게이트가 아니므로 buyer ONCHAINID의 claim.basis(QP_* 계열)를 쓰지 않는다 — 대신 발행 identity(또는 offering)에 결속된 clearance claim을 소비한다.

| 층 | 필드 | 값·형식 | 근거 조문 | 소비·비고 |
| --- | --- | --- | --- | --- |
| 발행 카드 (ManifestCore) | facts.offeringId | bytes32 | 506(a)(§3.5) | G③ scope 앵커; 무결·변경 통제는 B-01 |
| 발행 카드 | facts.coveredPersonRosterHash | bytes32 (roster 봉인) | (d)(1) 집합(§3.6) | V1·V2; roster 원본은 오프체인, 해시만 온체인 |
| 발행 카드 | facts.regDTrack | {R506B, R506C} | 506(b)·(c)(§3.5) | (d)는 양 트랙 공통 — 분기 무관 |
| 거버넌스 상수 | TRUSTED_BADACTOR_ISSUERS | address set (L2 발급기관) | (d)(2)(iv) 조사 주체(§3.7) | G②; 확장은 발급기관 심사 후 다중서명·time-lock |
| offering claim | topic = BADACTOR_CLEARANCE | 아래 data 구조 | 506(d)·(e) 전체 | G①~G⑥의 소비 대상; 발급 L2 Trusted Issuer, 만료 A-11 |
| ┗ claim.data | coveredPersonRosterHash | bytes32 | (d)(1)(§3.6) | V1과 대조 |
| ┗ claim.data | inquiryScope | bitset(8범주 (i)~(viii)) | (d)(1)(§3.6)·33-9414(§3.13) | 조사 커버리지 — L2a |
| ┗ claim.data | inquiryRecordHash | bytes32 (factual inquiry 기록) | (d)(2)(iv) 지시(§3.7) | reasonable care 항변의 온체인 증거 |
| ┗ claim.data | noDisqualifyingEvent | bool | (d)(1)·(d)(3)(§3.6·§3.8) | 핵심 결론(post-2013 사유 부재·waiver 반영·제휴 예외 반영) |
| ┗ claim.data | waiverRefs | ref[] (good cause·발령기관 advice) | (d)(2)(ii)·(iii)(§3.7) | 개별 사유 clear 근거 |
| ┗ claim.data | disclosure506eRequired | bool | (d)(2)(i)·(e)(§3.7·§3.9) | true ⇒ G6 활성 |
| ┗ claim.data | disclosureFurnished · disclosedMattersHash | bool · bytes32 | (e)(§3.9) | G6 검사 대상 |
| ┗ claim.meta | inquiryDate · expiry · votingPowerBasis | date · date · enum | (e)·33-9414(§3.9·§3.13) | 신선도(A-11)·20% 산정 기준 |
| revocation | revoked(clearanceId) | bool | mid-offering 취소(§3.14) | G5; 발급기관·Operator 취소 |
| 이벤트 | E03Check | {offeringId, rosterHash, clearanceId, disclosure 결과, 발급자 서명 해시, 판정 시각} | 보존·재구성 규율 | 감독 검사 시 "그 발행이 어느 roster·어느 증서로 판정됐나"의 바이트 단위 재구성(§11) |
| 예약 필드 (미래) | rosterAttestationChain | ref[] (entity covered person 하위 attestation) | (d)(1)·A-08/A-09(§3.6·§3.12) | 법인 covered person의 look-through 증서 연결 — 현행 roster 해시로 포괄 |

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

E-03의 입력은 세 층에서 온다. ① **발행 카드 상수** — 이 발행의 식별자(offeringId)와 covered person roster의 봉인(coveredPersonRosterHash), 그리고 트랙(506(b)/506(c)). 전부 상장 시점에 봉인되고 정정 버전으로만 바뀐다(B-01 규율). ② **거버넌스 평면 상수** — bad-actor clearance를 발급할 자격이 있는 L2 Trusted Issuer 집합(TRUSTED_BADACTOR_ISSUERS). 자산이 아니라 신뢰 정책의 함수라서 카드 밖에 산다. ③ **clearance attestation(offering claim)** — L2 검증기관이 factual inquiry를 수행해 발급한, 이 발행의 발행자 측 무결 증서. noDisqualifyingEvent·waiverRefs·disclosure506e·inquiryScope·신선도·취소 상태를 담는다. E-03 스스로 만들어내는 사실은 없다 — 매수인도 보지 않고, 사유의 실질도 판정하지 않는다. 전부 L2·발행 카드가 확정한 값의 소비자이며, 그래서 판정이 순수 결정론으로 남는다.

### 4.2 Data field — DEX가 실제로 읽는 항목

| 필드 | 층 | 형식 | 공급자 | 읽는 검사 |
| --- | --- | --- | --- | --- |
| facts.offeringId | 발행 카드 | bytes32 | 발행자 선언 + 상장 심사 | G③ scope 앵커 |
| facts.coveredPersonRosterHash | 발행 카드 | bytes32 | 발행자 선언 + L2 검증 | V1·V2·G(대조) |
| facts.regDTrack | 발행 카드 | enum {R506B, R506C} | 발행자 선언 | (d) 공통 — 분기 무관 |
| TRUSTED_BADACTOR_ISSUERS | 거버넌스 상수 | address set | Operator 거버넌스(§11) | G② |
| clearance claim: BADACTOR_CLEARANCE | offering claim | claim {rosterHash, inquiryScope, inquiryRecordHash, noDisqualifyingEvent, waiverRefs, disclosure506eRequired, disclosureFurnished, disclosedMattersHash, inquiryDate, expiry, votingPowerBasis} | Trusted Issuer (L2) | G①~G⑥ |
| revoked(clearanceId) | 배선 사실 | bool | 발급기관·Operator | G⑤ |
| now (block timestamp) | 체인 컨텍스트 | uint | Router | G④ 신선도 비교(A-11) |

### 4.3 수집 경로 — 5단계 흐름


[output truncated at 50000 of 81490 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007784
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
