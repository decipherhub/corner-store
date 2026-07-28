# F-04 · 판매 중 매수 금지 (Regulation M 상시 검사)

**부품 ID**: F-04 · **카테고리**: F (행위·운영) · **한 줄 정의**: 발행(distribution)이 진행되는 restricted period 동안, 발행자·매도증권보유자·그 affiliated purchaser·distribution participant가 대상 증권(covered security)을 permissioned DEX에서 매수(bid·purchase·매수유인)하는 것을 사전에 결정론적으로 차단하는 게이트.

**검증 패턴**: Pattern A — 기계 판정형 / 게이트형 (strict, off-chain 판단 불요) · **Recipe 소속**: R1 발행 (●, exclusive) · **Timing**: pre-trade · **Statefulness**: STATELESS · **근거 규범**: Securities Exchange Act §9(a)·§10(b) + Regulation M (17 CFR §242.100~.102·.104) · **형식 기준**: A-13 v1.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가

### 1.1 조작의 문제와 Reg M의 사전 예방 설계

미국 증권규제는 시세조종(manipulation)을 두 층위로 다룬다. 상위층은 제정법의 사후 금지다 — Exchange Act §9(a)(2)는 "일련의 거래로 어떤 증권에 외관상 활발한 거래를 만들거나 그 가격을 올리거나 내려, 타인의 매매를 유인할 목적"의 행위를 위법으로 한다. 그런데 §9(a)(2)는 "목적(for the purpose of ... inducing)"이라는 주관적 요건을 품는다. 조작의 고의를 사후에 입증하기는 어렵고, 특히 증권을 처음 시장에 뿌리는 발행(distribution) 국면에서는 발행자·인수인이 오퍼링 가격을 떠받치려는 유인이 구조적으로 존재한다 — 발행 중에 자기 증권을 시장에서 사들이면 가격이 올라 오퍼링 대금이 커지고, 후속 매수인을 끌어들일 수 있다.

Regulation M은 이 사후 금지를 **사전 예방(prophylactic)** 규칙으로 구체화한 것이다. Reg M 채택 취지문(Rel. No. 34-38067)이 직접 밝히듯, Reg M은 "오퍼링의 결과에 이해관계를 가진 자의 조작적 행위를 사전에 배제(preclude manipulative conduct by persons with an interest in the outcome of an offering)"하기 위한 규칙이다. 핵심 전환은 이렇다 — §9(a)(2)가 요구하는 조작 목적의 입증을 걷어내고, 대신 "누가(발행자·인수인 등) / 언제(restricted period) / 무엇을(covered security 매수)" 하면 그 자체로 위법이라는 밝은 선(bright line)을 긋는다. 목적 심사가 사라졌기 때문에 이 규칙은 기계가 판정할 수 있다. F-04가 Pattern A(기계 판정형·게이트형)인 근본 이유가 여기 있다.

### 1.2 두 개의 금지 조문 — 발행자 갈래와 참가자 갈래

Reg M의 매수 금지는 인적 지위에 따라 두 조문으로 갈린다. **§242.102(Rule 102)** 는 발행자(issuer)·매도증권보유자(selling security holder)와 그 affiliated purchaser를 겨눈다. **§242.101(Rule 101)** 은 distribution participant(인수인·브로커·딜러 등)와 그 affiliated purchaser를 겨눈다. 두 조문의 금지 문언은 사실상 동일하다 — restricted period 동안 covered security를 "bid for, purchase, or attempt to induce any person to bid for or purchase" 하지 말 것. 그리고 Rule 101은 "만약 distribution participant나 affiliated purchaser가 그 증권의 발행자·매도증권보유자이면 §242.102의 적용을 받는다"고 명시해, 겹치는 지위를 발행자 갈래로 흡수한다.

BUIDL 참조 구현에서 F-04의 1차 사정권은 §242.102(발행자 갈래)다 — 우리가 가장 먼저 막아야 할 것은 발행자(BlackRock/발행 vehicle)와 그 계열이 발행 중에 자기 토큰을 DEX에서 사들이는 시나리오이기 때문이다. 다만 F-04는 매수인의 지위를 판별해 두 갈래 모두로 라우팅한다(§5.2 G⑤).

### 1.3 상시 발행(continuous offering)이라는 비틀림 — restricted period가 꺼지지 않는다

일반적인 오퍼링에서 restricted period는 유한하다 — 가격 결정 하루 전(또는 5영업일 전)에 열려서 그 자가 "발행에의 참여를 완료(completion of participation in the distribution)"하면 닫힌다. 그런데 참조 자산 BUIDL은 **매일 상시 발행(continuous offering)** 구조다 — 판매 기간이 끝나지 않는다. 수익 분배도 매월 신규 토큰 지급(신규 발행)으로 이뤄진다. 그렇다면 restricted period는 사실상 상시 열려 있고, F-04의 매수 금지 게이트는 특정 며칠이 아니라 자산의 존속 기간 내내 작동한다. 프로젝트가 BUIDL을 첫 시연 자산으로 고른 이유 중 하나가 이것이다 — "Reg M 상시 검사"가 활성화되는 자산이라 시스템 구성요소의 활성률이 가장 높다.

이 상시성은 F-04를 다른 R1 부품(E-01 Form D, E-03 bad actor)과 구별한다. Form D·bad actor는 발행 프레임 성립의 1회성 확인에 가깝지만, F-04는 거래마다 걸리는 상시 게이트다.

### 1.4 permissioned DEX라는 무대와 "환매 창구 분리"라는 방어선

전통 오퍼링에서 Reg M 위반의 무대는 거래소나 딜러 시장이다. 우리 무대는 KYC로 게이트된 permissioned DEX다 — 발행 중인 토큰이 이 DEX에서 2차로 거래되면서 동시에 1차로 발행된다. 발행자·계열이 이 DEX에서 자기 토큰을 매수하면 가격을 인위적으로 떠받치는 결과가 되고, 이것이 정확히 Rule 102가 막는 행위다. F-04는 이 매수를 체결 전에 차단한다.

동시에 BUIDL은 영업일 USD 환매 + USDC 즉시 환매(Circle 연동) 창구를 별도로 둔다. 이 환매를 DEX 매매와 뒤섞으면 발행자의 토큰 취득이 Rule 102 위반으로 읽힐 위험이 생긴다. 그래서 환매는 DEX 매수 경로가 아니라 **별도 환매 창구(운영자 통제, 거래소·ECN 밖)** 로 라우팅된다 — 이것이 "환매 창구 분리 = Reg M 방어선"의 뜻이다. Rule 102(b)의 NAV 환매 예외들(closed-end·commodity pool·LP)이 하나같이 "그 증권이 거래소·inter-dealer quotation system·ECN에서 거래되지 않을 것"을 조건으로 다는 것과 정확히 맞물린다(§3.10). F-04의 게이트는 이 환매 경로를 건드리지 않으며, 건드리지 않도록 경로를 분리하는 것이 설계의 핵심이다.

### 1.5 F-04가 하는 일과 하지 않는 일

F-04는 "이 매수 주문이 restricted period 중 제한대상자의 매수인가"만 기계로 판정해 차단한다. 조작의 고의가 실제로 있었는지(그것은 §9(a)(2)의 사후 판단이자 F-02 감시의 영역), 어떤 증권이 restricted securities인지(B-02·B-03), 매수인이 Rule 144 의미의 affiliate인지(A-06 — Reg M의 affiliated purchaser와는 정의가 다르다, §9.1), 몇 명째 보유자인지(D-01)는 각기 다른 부품의 일이다. F-04는 Reg M이 그은 밝은 선 하나 — 발행 중 제한대상자의 매수 금지 — 를 체결 전 관문으로 옮긴 부품이다.

---

## §2. 메타 — 부품 한 장 요약

### 2.1 정체성

| 항목 | 값 |
| --- | --- |
| 부품 ID | F-04 |
| 카테고리 | F — 행위·운영 (매수인/발행자 행위 층) |
| 부품 이름 | 판매 중 매수 금지 (no-purchase-during-distribution) |
| 검사 대상 | restricted period 중 제한대상자(발행자·매도증권보유자·affiliated purchaser·distribution participant)의 covered security 매수 |
| 검증 패턴 | Pattern A — 기계 판정형 / 게이트형 (bright-line, off-chain 판단 불요) |
| Decidability | DETERMINISTIC |
| ObligationTiming | AT_TRADE_GATE (pre-trade) |
| Statefulness | STATELESS (레지스트리·상수는 거래 외 경로로만 변경) |
| Recipe 소속 | R1 발행 (● 필수, R1-exclusive) |
| Manifest 위치 | ManifestCore.facts (offeringStatus·regMExceptionProfile) + 자산별 restrictedPersonRegistry + 거버넌스 상수 |

### 2.2 왜 게이트형(Pattern A)인가 — 증명서형이 아닌 이유

F-04는 A-03·A-13 같은 증명서형(Pattern B)이 아니다. 증명서형은 "적격투자자다·QP다" 같은 자격 판단을 검증기관이 오프체인에서 하고 코드는 서명된 claim만 확인한다. F-04에는 그런 오프체인 자격 판단이 없다 — Rule 102는 매수인의 지위(발행자·계열 등)와 시점(restricted period)이라는 객관 사실만으로 위법을 확정하고, 조작 의도를 묻지 않는다(§1.1). 따라서 F-04는 A-01(제재)과 같은 계열의 strict-liability 게이트다. 다만 A-01이 명단 소속(SDN list)으로 판정한다면, F-04는 시간 창(restricted period) × 역할 소속(제한대상 집합)의 곱으로 판정한다. 조작 의도의 사후 판단은 F-02(시장 감시, Pattern C)가 flag로 담당하며 F-04와 상보한다(§9.1).

### 2.3 PASS/FAIL 코드 요약

| 코드 | 의미 | 성격 |
| --- | --- | --- |
| RESTRICTED_PERIOD_PURCHASE_BLOCKED | restricted period 중 제한대상자의 매수 — 차단 | FAIL (§242.102(a)/§242.101(a)) |
| REG_M_OFFERING_STATUS_MISSING | 자산 카드에 offeringStatus 선언 부재 — 판정 불능 | FAIL (fail-closed) |
| REG_M_RESTRICTED_SET_UNVERIFIED | 제한대상 레지스트리 미해소 red flag 위 판정 시도 | REVIEW |
| (PASS) REG_M_NOT_IN_DISTRIBUTION | 오퍼링 종료·비배포 — Reg M 비적용 | PASS |
| (PASS) REG_M_NON_RESTRICTED_BUYER | 매수인이 제한대상 아님 | PASS |
| (PASS) REG_M_DIRECTION_SELL | 매도·비대상 방향 (F-04 사정권 밖) | PASS |
| (PASS+기록) REG_M_EXCEPTION_APPLIED | 예외 경로 성립(근거 코드·해시 적재) | PASS |

### 2.4 활성화 트리거와 배치

F-04는 R1(발행) Recipe에만 부착된다(부착 매트릭스: R1 ●, R2·R3·R4 —). Router의 cumulative AND 체인에서 F-04는 자산이 "발행 프레임 유지 중(R1 활성)"일 때 매 거래에 걸린다. 판정 순서상 F-04는 매수인 신원(A-04)·자격(A-03/A-11) 확인 이후, 매수 방향·시점 판정 단계에 위치한다(§5.2). 결과는 Router로 반환되어 하나라도 FAIL이면 revert된다.

### 2.5 의존 관계 요약

- **상류(입력 공급)**: A-04(ONCHAINID — 역할 판별 단위) · B-01(offeringStatus·restrictedPersonRegistry의 무결성·변경 통제) · 운영자(제한대상 명단 유지, OD-B1).
- **동렬(상보)**: F-02(사후 wash-trade flag) · F-01(자기거래 제한) · B-04(엔진/venue 라우팅 — 환매 창구 분리 접점).
- **경계 주의**: A-06(Rule 144 affiliate) ↔ Reg M affiliated purchaser는 정의가 다르다(§9.1). E-01(Form D)와 함께 R1-only.

---
## §3. 법적 근거 — 조문별 정밀 분해

이 절은 F-04가 집행하는 규범을 논리 흐름 순서로 배열한다. 아래 표의 "종류" 칸이 그대로 Layer에 대응한다 — Statute = Layer 1, SEC Rule = Layer 2, SEC Release·SEC Staff·Case = Layer 3. Layer 1/2/3 묶음 헤더는 쓰지 않고, 각 조문을 논리 흐름 순서로 독립 번호(§3.1, §3.2, …)로 둔다. 순서는 중요도순이 아니라 "무대(anti-manip 기반) → 방아쇠(distribution) → 대상(covered security) → 시점(restricted period) → 인적 범위(누가) → 금지(무엇을) → 예외 → 상수 근거 → 제정법 앵커 → 취지"의 논리 흐름순이다.

아래 그림이 이 절의 법조문 관계 흐름이다 — 제정법(§9(a)·§10(b))의 사후 조작 금지가 Reg M(Rule 100~102)의 사전 게이트로 구체화되고, 그 게이트가 F-04로 집행되는 경로다.

![F-04 법조문 관계 흐름](F-04_fig30.png)

### 3.0.1 F-04가 판정하는 것의 성격

F-04의 판정 대상은 "이 매수 주문이 Rule 102(a)(또는 Rule 101(a))가 금지하는 행위인가"라는 밝은 선 한 개다. 그 선은 세 좌표의 곱이다 — (i) 시점이 restricted period 안인가, (ii) 방향이 covered security의 매수/bid인가, (iii) 주체가 제한대상(발행자·매도증권보유자·affiliated purchaser·distribution participant)인가. 셋이 모두 참이고 예외가 없으면 위법이며, 이때 F-04는 체결 전 차단(revert)한다. 조작의 목적·효과는 판정하지 않는다 — 그것은 제정법 §9(a)(2)의 사후 요건이고, 사후 flag는 F-02의 일이다. Reg M은 그 목적 요건을 걷어낸 대가로 기계 판정 가능성을 얻었고, F-04는 그 기계 판정을 온체인 관문으로 구현한다.

### 3.0.2 Authority 표

**표 1 — 근거 규범(Authority)**

| 종류 | Authority | 내용 | F-04 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Exchange Act §9(a)(2), 15 U.S.C. §78i(a)(2) | 일련의 거래로 시세를 올리거나 내려 타인의 매매를 유인하는 조작(목적 요건). Dodd-Frank 개정으로 "미등록 증권"도 포섭 | 사후 금지의 원천 — Reg M이 이를 사전 규칙으로 구체화 | Direct | govinfo.gov |
| Statute | Exchange Act §9(a)(1)·(a)(6), 15 U.S.C. §78i(a)(1)·(a)(6) | (1) 위장매매·짝맞춤주문(외관상 활발한 거래), (6) pegging·fixing·stabilizing | 조작 유형의 스펙트럼 — F-02(자전거래)와 stabilizing 경계의 근거 | Supporting | govinfo.gov |
| Statute | Exchange Act §10(b), 15 U.S.C. §78j(b) | 증권 매매와 관련한 조작적·기망적 장치 금지(anti-fraud 기반) | Reg M 병존 anti-fraud 앵커 | Supporting | uscode.house.gov |
| Statute | Securities Act §17(a), 15 U.S.C. §77q(a) | 증권 청약·판매에서의 사기 금지 | Reg M Preliminary Note가 병존 명시 | Background | (Reg M Prelim Note 내 인용) |
| SEC Rule | Reg M Rule 100, 17 CFR §242.100 | Preliminary Note(anti-fraud 병존) + 정의(distribution·restricted period·covered security·distribution participant·affiliated purchaser·selling security holder) | 판정의 모든 좌표 정의 공급 | Direct | ecfr.gov |
| SEC Rule | Reg M Rule 102, 17 CFR §242.102 | ★ 발행자·매도증권보유자·affiliated purchaser의 restricted period 중 매수 금지 + 예외·면제 | F-04 집행 조문(발행자 갈래) | Direct | ecfr.gov |
| SEC Rule | Reg M Rule 101, 17 CFR §242.101 | distribution participant·affiliated purchaser의 동일 금지 + 두 갈래 라우팅 + actively-traded 예외 | F-04 집행 조문(참가자 갈래) | Direct | ecfr.gov |
| SEC Rule | Reg M Rule 104, 17 CFR §242.104 | 안정조작(stabilizing)의 엄격 조건부 허용 | 허용의 경계 — 고정 NAV라 미사용(§3.15) | Conditional | ecfr.gov |
| SEC Release | Anti-manipulation Rules Concerning Securities Offerings, Rel. No. 34-38067, 62 FR 520 (Jan. 3, 1997) | Reg M 채택 취지: 오퍼링 이해관계자의 조작 행위 사전 배제 | 목적·해석의 원천 | Supporting | sec.gov · federalregister.gov |

**표 2 — 순서·중요성**

| 순서(§3.X) | 조문 | 중요성 | F-04가 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | §242.100(a) Preliminary Note | 프레임 | anti-fraud/anti-manip가 Reg M과 무관하게 항상 병존함을 확인 — F-04 통과가 §9·§10(b) 면책이 아님 |
| §3.2 | §242.100(b) "distribution" | 방아쇠 | 이 오퍼링이 Reg M이 적용되는 "distribution"인지 결정(magnitude + special selling efforts) |
| §3.3 | §242.100(b) "covered security"·"reference security" | 대상 | 어느 토큰/클래스가 금지의 대상인지 확정 |
| §3.4 | §242.100(b) "restricted period" | 시점 | 게이트가 언제 열려 있는지 — 상시 발행이면 사실상 상시 |
| §3.5 | §242.100(b) "distribution participant" | 인적(참가자) | 참가자 갈래(§242.101) 대상자 판별 |
| §3.6 | §242.100(b) "issuer"·"selling security holder" | 인적(발행자) | 발행자 갈래(§242.102) 대상자 판별 |
| §3.7 | §242.100(b) "affiliated purchaser" | 인적(확장) | 제한대상 집합의 외연 확장 — 대리·지배·공동지배·재량운용 |
| §3.8 | §242.102(a) | ★ 금지(발행자) | F-04의 차단 판정식(발행자 갈래) |
| §3.9 | §242.101(a) | 금지(참가자)·라우팅 | 차단 판정식(참가자 갈래) + 두 갈래 라우팅 |
| §3.10 | §242.102(b) | 예외(활동) | PASS 경로 — 환매 창구 분리의 조문 근거 |
| §3.11 | §242.102(d) | 예외(증권) | BUIDL이 open-end/UIT·actively-traded 예외에 해당 안 됨을 확정 |
| §3.12 | §242.101(c) | 예외(증권·병렬) | 참가자 갈래의 actively-traded 예외 — 고정 NAV 사모펀드에는 미적용, 게이트 상시화 |
| §3.13 | §9(a)(1)·(2)·(6) | 제정법 앵커 | Reg M이 구체화한 상위 금지 — 목적 요건 제거의 근거 |
| §3.14 | §10(b)·§9(g)·§17(a) | anti-fraud 앵커·경계 | 병존 anti-fraud + exempted security 경계 |
| §3.15 | §242.102(e)·§242.104 | 허용의 경계 | 면제권한 + 안정조작 — 고정 NAV/무-시세받치기 논거의 자리 |
| §3.16 | Rel. No. 34-38067 | 취지 | 규칙 해석의 목적론적 기준 |
| §3.17 | (말미) Sub-요건 분해 매트릭스 + ERC-3643 총정리 | 종합 | 모든 PASS/FAIL 경로 1:1 + 필드 매핑 |

---

### 3.1 §242.100(a) Preliminary Note — anti-fraud/anti-manip 상시 병존 [ecfr.gov]

- **조항**: Regulation M Rule 100(a) Preliminary Note, 17 C.F.R. §242.100(a) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Any transaction or series of transactions, whether or not effected pursuant to the provisions of Regulation M (§§ 242.100-242.105 of this chapter), remain subject to the antifraud and antimanipulation provisions of the securities laws, including, without limitation, Section 17(a) of the Securities Act of 1933 [15 U.S.C. 77q(a)] and Sections 9, 10(b), and 15(c) of the Securities Exchange Act of 1934 [15 U.S.C. 78i, 78j(b), and 78o(c)].

- **한국어**: 어떠한 거래 또는 일련의 거래도, Regulation M(§§242.100-242.105)의 규정에 따라 이루어졌는지 여부와 무관하게, 증권법의 사기금지·조작금지 조항 — 한정 없이 예시하면 1933년 증권법 §17(a)[15 U.S.C. §77q(a)] 및 1934년 증권거래법 §9·§10(b)·§15(c)[15 U.S.C. §78i·§78j(b)·§78o(c)] — 의 적용을 계속 받는다.

- **쉬운 설명**: F-04 설계의 첫 좌표다. Reg M의 밝은 선을 통과한다고 해서 §9·§10(b)의 사후 조작·사기 책임이 면제되지 않는다. 두 층은 병존한다 — Reg M(사전 게이트, F-04)을 통과한 거래라도 실제 조작 목적이 있었다면 §9(a)(2)로 별도 추궁될 수 있고, 그 사후 탐지는 F-02가 flag로 담당한다. 반대로 Reg M 예외에 해당해 F-04가 PASS를 찍은 매수라도, 그것이 사기·조작의 일부라면 여전히 위법이다. 그래서 F-04의 PASS는 "Reg M 금지에 걸리지 않음"이라는 좁은 의미이지 "적법 보증"이 아니다 — 문서 전체에서 이 한계를 흐리지 말아야 한다.

- **PASS/FAIL 반영**: 간접 ✕ — 이 note 자체는 판정식이 아니다. F-04 PASS의 의미 범위를 좁히는 프레임(§9.1 F-02와의 상보, §12 OD의 근거)이 된다.

- **ERC-3643 변환**: 직접 필드 없음. F-04 게이트가 canTransfer에서 매수를 통과시켜도 F-02의 post-trade 감시 모듈이 별도로 작동하도록 두 모듈을 분리 배치하는 설계의 근거.

### 3.2 §242.100(b) "distribution" 정의 — Reg M의 방아쇠 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "distribution" 정의, 17 C.F.R. §242.100(b) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Distribution means an offering of securities, whether or not subject to registration under the Securities Act, that is distinguished from ordinary trading transactions by the magnitude of the offering and the presence of special selling efforts and selling methods.

- **한국어**: "distribution"이란, 증권법상 등록 대상 여부와 무관하게, 오퍼링의 규모(magnitude) 및 특별한 판매 노력·판매 방법(special selling efforts and selling methods)의 존재에 의하여 통상의 거래(ordinary trading transactions)와 구별되는 증권의 오퍼링을 말한다.

- **쉬운 설명**: F-04가 애초에 걸리는지 여부를 정하는 방아쇠다. 두 가지가 F-04 설계에 결정적이다. 첫째, "등록 대상 여부와 무관하게(whether or not subject to registration)" — Reg D 506(c) 사모발행처럼 등록 면제된 오퍼링도 distribution일 수 있다. 미등록이라는 이유로 Reg M을 피할 수 없다. 둘째, distribution의 두 표지는 규모 + 특별한 판매 노력·방법이다. 506(c)는 일반청약(general solicitation)이 허용·수반되는 발행이므로 "특별한 판매 노력·방법"이라는 표지를 채우기 쉽다 — 광범위한 청약 자체가 통상 거래와 구별되는 판매 방법이다. 따라서 BUIDL 같은 506(c) 상시 토큰 발행은 distribution에 해당할 개연성이 높고, F-04는 이를 기본 전제로 작동한다. 다만 "이 특정 오퍼링이 규모·판매방법 요건을 실제로 충족하는가"의 최종 판단은 사실관계 심사이며, 상시 발행에서 각 tranche가 별개 distribution인지 전체가 하나의 연속 distribution인지의 경계는 변호사 확인 대상이다(§12 OD-F04-1·OD-F04-6).

- **PASS/FAIL 반영**: 조건부 — 자산 카드의 offeringStatus 선언이 이 판단의 코드화된 결과다. offeringStatus = ONGOING_*이면 F-04가 활성, = COMPLETED이면 비활성(REG_M_NOT_IN_DISTRIBUTION PASS). 이 선언의 진위(정말 distribution이 진행 중인가)는 상장 심사·운영자 판단 소관이며 F-04는 선언을 신뢰해 집행한다.

- **ERC-3643 변환**: Manifest.facts.offeringStatus ∈ {ONGOING_CONTINUOUS, ONGOING_TRANCHE, COMPLETED} (근거: distribution 정의 + restricted period 정의). 값의 무결·변경 통제는 B-01(거버넌스 경로·정정 버전).

### 3.3 §242.100(b) "covered security"·"reference security" — 금지의 대상 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "covered security" 및 "reference security" 정의, 17 C.F.R. §242.100(b) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Covered security means any security that is the subject of a distribution, or any reference security. … Reference security means a security into which a security that is the subject of a distribution ("subject security") may be converted, exchanged, or exercised or which, under the terms of the subject security, may in whole or in significant part determine the value of the subject security.

- **한국어**: "covered security"란 distribution의 대상이 되는 증권(subject security), 또는 reference security를 말한다. … "reference security"란 distribution의 대상 증권("subject security")이 전환·교환·행사될 수 있는 대상 증권, 또는 subject security의 조건상 subject security의 가치를 전부 또는 상당 부분 결정할 수 있는 증권을 말한다.

- **쉬운 설명**: 금지의 대상 범위다. F-04에서 covered security는 발행 중인 그 토큰(class) 자체다 — subject security. reference security 축은 그 토큰이 다른 증권으로 전환·교환되거나, 다른 증권이 그 토큰 가치를 결정하는 구조일 때 그 다른 증권까지 금지 대상에 넣는 장치다. BUIDL의 토큰화 국채 지분은 단순 지분형이라 전형적 reference security 확장은 좁지만, 설계상 자산 카드는 이 토큰이 다른 온체인 자산의 가치를 결정하거나 그로 전환되는 구조를 갖는지를 선언해 두어야 한다(대개 없음). F-04의 대상 식별은 legalClassId(D-01·B-03과 공유하는 class 식별자)에 결속된다 — 같은 발행체의 다른 class는 별개의 distribution 상태를 가질 수 있으므로, 금지 판정은 정확한 class를 가리켜야 한다.

- **PASS/FAIL 반영**: 조건부 — F-04는 거래 대상 토큰의 legalClassId가 restricted period 활성 covered security 집합에 속하는지로 대상 여부를 판정한다. reference security 확장은 자산 카드 선언(referenceSecurities)이 비어 있으면 subject security 단일로 좁혀진다.

- **ERC-3643 변환**: Manifest.facts.legalClassId(대상 class) + Manifest.facts.referenceSecurities(선언, 대개 ∅); F-04 판정은 txContext.tokenId → legalClassId 매핑 후 covered security 집합 소속 검사.

### 3.4 §242.100(b) "restricted period" — 게이트가 열리는 시간 창 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "restricted period" 정의, 17 C.F.R. §242.100(b) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Restricted period means: (1) For any security with an ADTV value of $100,000 or more of an issuer whose common equity securities have a public float value of $25 million or more, the period beginning on the later of one business day prior to the determination of the offering price or such time that a person becomes a distribution participant, and ending upon such person's completion of participation in the distribution; and (2) For all other securities, the period beginning on the later of five business days prior to the determination of the offering price or such time that a person becomes a distribution participant, and ending upon such person's completion of participation in the distribution. (3) In the case of a distribution involving a merger, acquisition, or exchange offer, the period beginning on the day proxy solicitation or offering materials are first disseminated to security holders, and ending upon the completion of the distribution.

- **한국어**: "restricted period"란 다음을 말한다: (1) ADTV 가치가 $100,000 이상이고 그 발행인의 보통주 지분증권의 public float 가치가 $2,500만 이상인 증권의 경우, 오퍼링 가격 결정 1영업일 전과 그 자가 distribution participant가 되는 시점 중 나중에 시작하여, 그 자의 distribution 참여 완료 시 종료하는 기간. (2) 그 밖의 모든 증권의 경우, 오퍼링 가격 결정 5영업일 전과 그 자가 distribution participant가 되는 시점 중 나중에 시작하여, 그 자의 distribution 참여 완료 시 종료하는 기간. (3) 합병·인수·교환청약을 수반하는 distribution의 경우, proxy 권유 또는 오퍼링 자료가 증권보유자에게 최초로 배포되는 날에 시작하여 distribution 완료 시 종료하는 기간.

- **쉬운 설명**: F-04 게이트의 시간 좌표다. 두 층으로 읽어야 한다. 첫째, 어느 층에 속하는가 — (1)은 유동성·시가총액이 큰 증권(1영업일 창), (2)는 그 밖의 모든 증권(5영업일 창)이다. BUIDL 토큰은 (1)의 요건(보통주 public float $2,500만 이상 등)을 충족하지 못하는 사모펀드 지분이므로 (2)에 떨어진다 — 5영업일 창이 기본값이다. 둘째, 그런데 이 "창"은 "오퍼링 가격 결정"과 "참여 완료"를 양끝으로 하는데, 상시 발행(continuous offering)에서는 가격 결정이 매일 반복되고 "참여 완료"가 오지 않는다. 그 결과 restricted period가 사실상 열린 채로 유지된다 — F-04가 자산 존속 기간 내내 작동하는 근거가 정확히 이 정의의 양끝이 닫히지 않는다는 데 있다(§1.3). 이 상시성의 법적 정밀화 — "각 tranche가 자기 5영업일 창을 갖는가, 아니면 전체가 하나의 열린 창인가" — 는 변호사 확인 대상이다(§12 OD-F04-6). 시스템은 보수적으로 offeringStatus = ONGOING_CONTINUOUS이면 restricted period 상시 활성으로 취급한다.

- **PASS/FAIL 반영**: 직접 ○(시점 축) — G①(restricted period 활성 여부)가 이 정의의 코드화다. offeringStatus = ONGOING_*이면 활성(true), = COMPLETED이면 비활성(false → REG_M_NOT_IN_DISTRIBUTION PASS). ADTV/public float에 의한 층 구분은 예외 판정(§3.11·§3.12)의 입력이지 활성 판정 자체는 아니다.

- **ERC-3643 변환**: G① = (Manifest.facts.offeringStatus ≠ COMPLETED); 상시 발행 자산은 offeringStatus = ONGOING_CONTINUOUS로 봉인되어 게이트 상시 true. tranche형이면 restrictedWindowEnd 타임스탬프를 두어 now 비교(단 BUIDL은 상시형).

### 3.5 §242.100(b) "distribution participant" — 참가자 갈래 대상자 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "distribution participant" 및 "underwriter" 정의, 17 C.F.R. §242.100(b) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Distribution participant means an underwriter, prospective underwriter, broker, dealer, or other person who has agreed to participate or is participating in a distribution. … Underwriter means a person who has agreed with an issuer or selling security holder: (1) To purchase securities for distribution; or (2) To distribute securities for or on behalf of such issuer or selling security holder; or (3) To manage or supervise a distribution of securities for or on behalf of such issuer or selling security holder.

- **한국어**: "distribution participant"란 underwriter, prospective underwriter, broker, dealer, 또는 distribution에 참여하기로 합의하였거나 참여하고 있는 그 밖의 자를 말한다. … "underwriter"란 발행인 또는 매도증권보유자와 다음을 합의한 자를 말한다: (1) distribution을 위하여 증권을 매수하기로 한 자; 또는 (2) 그 발행인·매도증권보유자를 위하여 또는 그를 대신하여 증권을 배포하기로 한 자; 또는 (3) 그 발행인·매도증권보유자를 위하여 또는 그를 대신하여 증권의 distribution을 관리·감독하기로 한 자.

- **쉬운 설명**: §242.101(참가자 갈래)의 대상자를 정의한다. F-04에서 이 축은 인수인·브로커·딜러·배포 참여자를 제한대상 집합에 넣는 근거다. 참조 구현에서 배포 참여 구조(예: Securitize의 역할, 프런트 배포 파트너)가 여기 해당할 수 있는지가 사실관계 문제다 — "distribution에 참여하기로 합의"의 범위가 넓다. 시스템은 이들을 restrictedPersonRegistry에 role = DISTRIBUTION_PARTICIPANT로 등재하고, 매수 시 F-04가 §242.101 갈래로 라우팅한다(§3.9). 누가 participant인지의 확정은 계약 구조 검토가 필요해 변호사 확인 대상이다(§12 OD-F04-3).

- **PASS/FAIL 반영**: 직접 ○(인적 축, 참가자) — G③의 제한대상 집합 원소 중 DISTRIBUTION_PARTICIPANT 판별의 근거. 소속 시 G⑤에서 §242.101 갈래로 라우팅.

- **ERC-3643 변환**: restrictedPersonRegistry[tokenId][ONCHAINID] = DISTRIBUTION_PARTICIPANT; 등재·해제는 운영자 서명 트랜잭션(거래 외 경로), 무결성은 B-01.

### 3.6 §242.100(b) "issuer"·"selling security holder" — 발행자 갈래 대상자 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "selling security holder" 정의 + Rule 102(a)의 "issuer" 지칭, 17 C.F.R. §242.100(b)·§242.102(a) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Selling security holder means any person on whose behalf a distribution is made, other than an issuer. [§242.102(a):] In connection with a distribution of securities effected by or on behalf of an issuer or selling security holder, it shall be unlawful for such person …

- **한국어**: "selling security holder"란, 발행인(issuer)을 제외하고, 그를 위하여(on whose behalf) distribution이 이루어지는 모든 자를 말한다. [§242.102(a):] 발행인 또는 매도증권보유자에 의하여 또는 그를 위하여 이루어지는 증권의 distribution과 관련하여, 그러한 자가 … 하는 것은 위법이다.

- **쉬운 설명**: §242.102(발행자 갈래)의 두 핵심 주체를 정의한다. issuer는 증권을 발행하는 자(BUIDL 발행 vehicle)이고, selling security holder는 발행자가 아니면서 자기를 위해 distribution이 이뤄지는 자 — 예컨대 대량 보유분을 발행 프레임으로 되파는 기존 보유자다. F-04에서 이 축은 가장 우선적으로 막아야 할 대상 — 발행자와 매도증권보유자 자신의 매수 — 를 확정한다. restrictedPersonRegistry에 발행 vehicle 주소를 role = ISSUER로, 매도증권보유자를 SELLING_SECURITY_HOLDER로 등재한다.

- **PASS/FAIL 반영**: 직접 ○(인적 축, 발행자) — G③의 원소 ISSUER·SELLING_SECURITY_HOLDER 판별 근거. 소속 시 G⑤에서 §242.102 갈래로 라우팅(1차 사정권).

- **ERC-3643 변환**: restrictedPersonRegistry[tokenId][ONCHAINID] ∈ {ISSUER, SELLING_SECURITY_HOLDER}; ISSUER 주소는 발행 프레임(Manifest.facts.issuerIdentity)과 교차검증.

### 3.7 §242.100(b) "affiliated purchaser" — 제한대상의 외연 [ecfr.gov]

- **조항**: Regulation M Rule 100(b), "affiliated purchaser" 정의, 17 C.F.R. §242.100(b) — ecfr.gov (2026-07-15 현행)

- **핵심 원문**: Affiliated purchaser means: (1) A person acting, directly or indirectly, in concert with a distribution participant, issuer, or selling security holder in connection with the acquisition or distribution of any covered security; or (2) An affiliate, which may be a separately identifiable department or division of a distribution participant, issuer, or selling security holder, that, directly or indirectly, controls the purchases of any covered security by a distribution participant, issuer, or selling security holder, whose purchases are controlled by any such person, or whose purchases are under common control with any such person; or (3) An affiliate … that regularly purchases securities for its own account or for the account of others, or that recommends or exercises investment discretion with respect to the purchase or sale of securities; Provided, however, That this paragraph (3) shall not apply to such affiliate if the following conditions are satisfied: (i) The distribution participant, issuer, or selling security holder: (A) Maintains and enforces written policies and procedures reasonably designed to prevent the flow of information to or from the affiliate that might result in a violation of §§ 242.101, 242.102, and 242.104; and (B) Obtains an annual, independent assessment of the operation of such policies and procedures; and (ii) The affiliate has no officers … or employees … in common with the distribution participant, issuer, or selling security holder that direct, effect, or recommend transactions in securities; and (iii) The affiliate does not, during the applicable restricted period, act as a market maker …, or engage, as a broker or a dealer, in solicited transactions or proprietary trading, in covered securities.

- **한국어**: "affiliated purchaser"란 다음을 말한다: (1) covered security의 취득 또는 distribution과 관련하여, distribution participant·발행인·매도증권보유자와 직접 또는 간접으로 공동으로(in concert) 행위하는 자; 또는 (2) distribution participant·발행인·매도증권보유자의 별도로 식별 가능한 부서·부문일 수 있는 affiliate로서, 직접 또는 간접으로 그러한 자의 covered security 매수를 지배하거나, 그러한 자에 의해 매수가 지배되거나, 그러한 자와 공동지배(common control) 하에 매수가 이루어지는 affiliate; 또는 (3) 자기 계산 또는 타인 계산으로 정기적으로 증권을 매수하거나, 증권 매매에 관하여 추천하거나 투자재량을 행사하는 affiliate — 단, 다음 조건이 충족되면 이 (3)은 그 affiliate에 적용되지 아니한다: (i) distribution participant·발행인·매도증권보유자가 (A) §§242.101·242.102·242.104 위반을 초래할 수 있는 그 affiliate와의 정보 흐름을 차단하도록 합리적으로 설계된 서면 정책·절차를 유지·집행하고, (B) 그 정책·절차 운영에 관한 연간 독립 평가를 받으며, (ii) 그 affiliate가 증권거래를 지시·실행·추천하는 임원·직원을 그 자와 공유하지 아니하고, (iii) 그 affiliate가 해당 restricted period 동안 market maker로 행위하거나 broker·dealer로서 권유 거래·자기매매를 covered security에 대하여 하지 아니할 것.

- **쉬운 설명**: 제한대상 집합의 외연을 넓히는 조문이자, F-04에서 가장 판정이 어려운 축이다. 세 갈래다. (1) 공동행위 — 발행자 등과 "in concert"로 covered security를 취득·배포하는 자. (2) 매수 지배·피지배·공동지배 관계의 affiliate. (3) 정기적으로 증권을 매수하거나 재량운용하는 affiliate — 단, 정보차단벽(information barrier)·연간 독립평가·임직원 비공유·restricted period 중 MM·권유거래 부작위라는 안전항 4요건을 모두 충족하면 (3)에서 빠진다. 여기서 두 가지가 중요하다. 첫째, 이 "affiliated purchaser"는 Rule 144·§405의 "affiliate"와 정의가 다르다 — Rule 144 affiliate는 발행인을 지배하는 자(control) 중심이지만, Reg M affiliated purchaser는 매수의 공동행위·지배 및 재량운용 중심이다. 그래서 A-06(Rule 144 affiliate 판정)의 산출을 그대로 F-04에 쓸 수 없다(§9.1). 둘째, (3)의 안전항은 information barrier가 갖춰진 계열 트레이딩 부문을 제한대상에서 빼주는 장치인데, 이 판단은 순수 기계 판정이 아니라 정책·절차의 실재 확인이 필요하다 — 그래서 F-04는 (3) 안전항 충족 여부를 자산·계열 레벨 사실(regMInfoBarrierCertified)로 상장·운영 시점에 확정해 두고, 런타임은 그 확정값을 읽는다. 누가 affiliated purchaser인지의 확정 자체는 변호사 확인 대상이다(§12 OD-F04-3).

- **PASS/FAIL 반영**: 직접 ○(인적 축, 확장) — G③의 원소 AFFILIATED_PURCHASER 판별 근거. (3) 안전항 충족 계열은 제한대상에서 제외(regMInfoBarrierCertified = true인 계열 ONCHAINID는 미등재).

- **ERC-3643 변환**: restrictedPersonRegistry[tokenId][ONCHAINID] = AFFILIATED_PURCHASER; (3) 안전항 = 계열 레벨 사실 regMInfoBarrierCertified(연간 갱신, 만료 시 A-11 규율과 유사한 신선도 필요)로 등재/비등재 결정; "in concert" 판단은 off-chain 운영자 판단 후 등재.

### 3.8 §242.102(a) — 발행자 갈래 매수 금지 (★ 핵심 집행 조문) [ecfr.gov]

- **조항**: Regulation M Rule 102(a) "Unlawful Activity", 17 C.F.R. §242.102(a) — ecfr.gov (2026-07-13 현행)

- **핵심 원문**: (a) Unlawful Activity. In connection with a distribution of securities effected by or on behalf of an issuer or selling security holder, it shall be unlawful for such person, or any affiliated purchaser of such person, directly or indirectly, to bid for, purchase, or attempt to induce any person to bid for or purchase, a covered security during the applicable restricted period; Except That if an affiliated purchaser is a distribution participant, such affiliated purchaser may comply with § 242.101, rather than this section.

- **한국어**: (a) 위법 행위. 발행인 또는 매도증권보유자에 의하여 또는 그를 위하여 이루어지는 증권의 distribution과 관련하여, 그러한 자 또는 그 자의 affiliated purchaser가, 직접 또는 간접으로, 해당 restricted period 동안 covered security를 매수 호가(bid for)하거나, 매수(purchase)하거나, 타인으로 하여금 매수 호가·매수하도록 유인(attempt to induce)하는 것은 위법이다. 다만 affiliated purchaser가 distribution participant인 경우, 그 affiliated purchaser는 본 조가 아니라 §242.101을 준수할 수 있다.

- **쉬운 설명**: F-04의 심장이다. 이 한 문장이 세 좌표의 곱으로 위법을 확정한다. (i) 시점 = "during the applicable restricted period"(§3.4에서 코드화한 G①), (ii) 대상 = "a covered security"(§3.3의 G 대상 검사), (iii) 주체 = "issuer or selling security holder, or any affiliated purchaser of such person"(§3.6·§3.7의 G③). 그리고 금지되는 행위 유형은 셋 — bid for(매수 호가), purchase(매수), attempt to induce(매수 유인). permissioned DEX에서 이 셋은 각각 매수 주문 제출(bid), 체결(purchase), 그리고 다른 지갑을 통한 우회 매수 유도(attempt to induce, indirectly 포함)에 대응한다. "directly or indirectly"가 있어 발행자가 제3자 지갑을 내세워 사들이는 우회도 잡힌다 — 그래서 F-04는 매수인 ONCHAINID뿐 아니라 그 지갑이 제한대상의 지배·공동행위 하에 있는지(affiliated purchaser (1)·(2))까지 본다. 마지막 "Except That" 단서는 겹치는 지위의 라우팅 규칙이다 — affiliated purchaser가 동시에 distribution participant이면 §242.101을 따를 수 있다. 이 조문에는 고의·목적 요건이 없다. "매수 목적이 조작이었는지"를 묻지 않는다 — restricted period × covered security × 제한대상 주체이면 그 자체로 위법이다. 이 무-고의성이 F-04를 strict-liability 게이트로 만든다.

- **PASS/FAIL 반영**: 직접 ○(★ 주 판정식) — G①(restricted period) ∧ G②(매수/bid 방향) ∧ G③(주체가 발행자 갈래 제한대상) ∧ ¬G④(예외 없음)이면 FAIL(RESTRICTED_PERIOD_PURCHASE_BLOCKED). "attempt to induce"·"indirectly"의 온체인 대응은 §5.4에서 상술.

- **ERC-3643 변환**: Compliance 모듈 RegMDistributionModule.moduleCheck(from, to, amount, token)가 canTransfer 경로에서 호출되어 [offeringStatus ≠ COMPLETED] ∧ [to ∈ restrictedPersonRegistry(발행자 갈래)] ∧ [예외 미충족]이면 false 반환 → 거래 revert. "indirectly"는 to의 controllerCluster(A-04·A-06 공급) 소속 검사로 확장; FAIL 코드 RESTRICTED_PERIOD_PURCHASE_BLOCKED.

### 3.9 §242.101(a) — 참가자 갈래 매수 금지 + 두 갈래 라우팅 [ecfr.gov]

- **조항**: Regulation M Rule 101(a) "Unlawful Activity", 17 C.F.R. §242.101(a) — ecfr.gov (2026-07-01 현행)

- **핵심 원문**: (a) Unlawful Activity. In connection with a distribution of securities, it shall be unlawful for a distribution participant or an affiliated purchaser of such person, directly or indirectly, to bid for, purchase, or attempt to induce any person to bid for or purchase, a covered security during the applicable restricted period; Provided, however, That if a distribution participant or affiliated purchaser is the issuer or selling security holder of the securities subject to the distribution, such person shall be subject to the provisions of § 242.102, rather than this section.

- **한국어**: (a) 위법 행위. 증권의 distribution과 관련하여, distribution participant 또는 그 자의 affiliated purchaser가, 직접 또는 간접으로, 해당 restricted period 동안 covered security를 매수 호가·매수하거나 타인으로 하여금 매수 호가·매수하도록 유인하는 것은 위법이다. 다만 distribution participant 또는 affiliated purchaser가 그 distribution 대상 증권의 발행인 또는 매도증권보유자인 경우, 그러한 자는 본 조가 아니라 §242.102의 적용을 받는다.

- **쉬운 설명**: §242.102와 쌍을 이루는 참가자 갈래 금지다. 금지 문언은 §242.102(a)와 사실상 동일하다 — restricted period 중 covered security의 bid·purchase·매수유인 금지. 차이는 주체가 distribution participant(인수인·브로커·딜러·배포참여자)와 그 affiliated purchaser라는 것이다. 그리고 마지막 "Provided, however" 단서가 §242.102(a)의 "Except That" 단서와 거울처럼 맞물려 두 갈래의 라우팅을 완성한다 — participant/affiliated purchaser가 동시에 발행자·매도증권보유자이면 §242.102로, 반대로 §242.102의 affiliated purchaser가 동시에 participant이면 §242.101로 갈 수 있다. F-04는 이 라우팅을 G⑤로 구현한다 — 매수인이 발행자/매도증권보유자이면 §242.102 근거로, 순수 participant이면 §242.101 근거로 판정한다. 결과(차단)는 동일하지만, 어느 조문 근거로 차단했는지를 이벤트에 남겨 감독 검사 시 재구성 가능하게 한다.

- **PASS/FAIL 반영**: 직접 ○(주 판정식, 참가자 갈래) — G③의 주체가 DISTRIBUTION_PARTICIPANT(및 그 affiliated purchaser)이면 이 조문 근거로 동일 차단. G⑤가 §242.102/§242.101 근거를 라우팅.

- **ERC-3643 변환**: 동일 RegMDistributionModule 내 분기 — buyerRole ∈ {ISSUER, SELLING_SECURITY_HOLDER}이면 basis = RULE_102, buyerRole = DISTRIBUTION_PARTICIPANT이면 basis = RULE_101; F04Check 이벤트에 basis 기록. 참가자 갈래 전용 예외(de minimis 2% 등, §3.12)는 basis = RULE_101일 때만 평가.

### 3.10 §242.102(b) — 예외 활동: 환매 창구 분리의 조문 근거 [ecfr.gov]

- **조항**: Regulation M Rule 102(b) "Excepted Activity", 17 C.F.R. §242.102(b) — ecfr.gov (2026-07-13 현행)

- **핵심 원문**: (b) Excepted Activity. The following activities shall not be prohibited by paragraph (a) of this section: (1) Odd-lot transactions. … (2) Transactions by closed-end investment companies. (i) Transactions complying with § 270.23c-3 of this chapter; or (ii) Periodic tender offers of securities, at net asset value, conducted pursuant to § 240.13e-4 of this chapter by a closed-end investment company that engages in a continuous offering of its securities pursuant to § 230.415 of this chapter; Provided, however, That such securities are not traded on a securities exchange or through an inter-dealer quotation system or electronic communications network; or (3) Redemptions by commodity pools or limited partnerships. Redemptions by commodity pools or limited partnerships, at a price based on net asset value, which are effected in accordance with the terms and conditions of the instruments governing the securities; Provided, however, That such securities are not traded on a securities exchange, or through an inter-dealer quotation system or electronic communications network; or (4) Exercises of securities. … (5) Offers to sell or the solicitation of offers to buy. Offers to sell or the solicitation of offers to buy the securities being distributed; or (6) Unsolicited purchases. Unsolicited purchases that are not effected from or through a broker or dealer, on a securities exchange, or through an inter-dealer quotation system or electronic communications network; or (7) Transactions in Rule 144A securities. …

- **한국어**: (b) 예외 활동. 다음 활동은 본 조 (a)에 의하여 금지되지 아니한다: (1) 단주 거래. … (2) 폐쇄형 투자회사의 거래. (i) §270.23c-3을 준수하는 거래; 또는 (ii) §230.415에 따라 자기 증권을 continuous offering 하는 폐쇄형 투자회사가 §240.13e-4에 따라 순자산가치(NAV)로 실시하는 정기 tender offer — 단, 그 증권이 증권거래소·inter-dealer quotation system·ECN에서 거래되지 아니할 것; 또는 (3) commodity pool·limited partnership의 환매. commodity pool·limited partnership이 증권을 규율하는 문서의 조건에 따라 NAV 기준 가격으로 실시하는 환매 — 단, 그 증권이 증권거래소·inter-dealer quotation system·ECN에서 거래되지 아니할 것; 또는 (4) 증권의 행사. … (5) 매도 청약 또는 매수 청약의 권유. 배포 중인 증권의 매도 청약 또는 매수 청약의 권유; 또는 (6) 비권유 매수. broker·dealer로부터·통하여, 증권거래소에서, 또는 inter-dealer quotation system·ECN을 통하여 이루어지지 아니하는 비권유 매수; 또는 (7) Rule 144A 증권 거래. …

- **쉬운 설명**: PASS 경로들의 집합이자, "환매 창구 분리 = Reg M 방어선"의 조문 근거다. F-04에 닿는 지점 넷. 첫째, (5) 매도 청약 — 배포 중인 증권을 파는 것(청약·권유)은 금지되지 않는다. 당연하다 — Reg M은 매수를 막지 매도를 막지 않는다. F-04가 매수 방향만 게이트하는(G②) 근거다. 둘째, (2)(ii)와 (3) — 폐쇄형 투자회사의 NAV tender offer, commodity pool·LP의 NAV 환매는 예외인데, 둘 다 "그 증권이 거래소·inter-dealer quotation system·ECN에서 거래되지 아니할 것"이라는 단서를 단다. 이것이 결정적이다. BUIDL의 USD/USDC 환매를 이 예외에 얹으려면, 그 환매가 DEX(거래소·ECN에 준하는 venue)를 통해 이뤄지면 안 된다. 그래서 환매는 DEX 매수 경로가 아니라 별도 창구(운영자 통제, off-venue)로 라우팅되어야 하고 — 이것이 정확히 §1.4의 방어선이다. 셋째, (6) 비권유 매수 — broker·dealer·거래소·ECN을 통하지 않는 비권유 매수는 예외다. 그런데 permissioned DEX에서의 매수는 그 venue(거래소·ECN에 준함)를 통한 매수이므로 (6) 예외를 타기 어렵다. 즉 온-DEX 매수는 대개 (6)으로 구제되지 않는다 — F-04가 온-DEX 제한대상 매수를 원칙적으로 차단하는 근거다. 넷째, SEC 스탭이 종전에 취한 입장 — 보유자 선택에 의한 환매(redemption at the option of the holder)라도 발행자가 (6) "unsolicited transactions" 예외에 의존해 실행할 수는 없다는 것 — 은 환매를 (6)이 아니라 (2)(ii)/(3)의 off-venue NAV 환매 구조로 설계해야 함을 강하게 시사한다(§12 OD-F04-5). 이 예외들의 온체인 적용 가능성(특히 DEX = 거래소/ECN인지)은 BD/ATS 성격규명과 얽혀 변호사 확인 대상이다(§12 OD-F04-2).

- **PASS/FAIL 반영**: 직접 ○(예외 경로) — G④(예외 성립)의 후보 집합이 여기서 온다. 다만 온-DEX 매수 맥락에서 (2)(ii)·(3)·(6)은 "거래소·ECN 밖" 단서 때문에 대개 불성립 → 환매는 F-04 경로 밖의 별도 창구로 분리. (5)는 매도 방향이라 G②에서 이미 걸러짐.

- **ERC-3643 변환**: 환매 = 별도 redemptionChannel(agent-role burn/mint 경로)로 라우팅 — DEX canTransfer(매수) 경로를 타지 않으므로 RegMDistributionModule이 관여하지 않음(구조적 분리); Manifest.facts.redemptionChannelRef가 그 경로를 명시. G④의 온-DEX 예외 후보는 대개 ∅(regMExceptionProfile = NONE_ON_VENUE).

### 3.11 §242.102(d) — 예외 증권: BUIDL이 왜 예외에 해당 안 되는가 [ecfr.gov]

- **조항**: Regulation M Rule 102(d) "Excepted Securities", 17 C.F.R. §242.102(d) — ecfr.gov (2026-07-13 현행)

- **핵심 원문**: (d) Excepted Securities. The provisions of this section shall not apply to any of the following securities: (1) Actively-traded reference securities. Reference securities with an ADTV value of at least $1 million that are issued by an issuer whose common equity securities have a public float value of at least $150 million; Provided, however, That such securities are not issued by the issuer, or any affiliate of the issuer, of the security in distribution. (2) Certain nonconvertible and asset-backed securities. … (3) Exempted securities. "Exempted securities" as defined in section 3(a)(12) of the Exchange Act (15 U.S.C. 78c(a)(12)); or (4) Face-amount certificates or securities issued by an open-end management investment company or unit investment trust. Face-amount certificates issued by a face-amount certificate company, or redeemable securities issued by an open-end management investment company or a unit investment trust. Any terms used in this paragraph (d)(4) that are defined in the Investment Company Act of 1940 (15 U.S.C. 80a-1 et seq.) shall have the meanings specified in such Act.

- **한국어**: (d) 예외 증권. 본 조의 규정은 다음 증권에는 적용되지 아니한다: (1) actively-traded reference securities. ADTV 가치 $100만 이상이고 그 발행인의 보통주 지분증권의 public float 가치가 $1억 5천만 이상인 reference securities — 단, 그 증권이 distribution 대상 증권의 발행인 또는 그 발행인의 affiliate에 의하여 발행되지 아니할 것. (2) 일정한 비전환·자산유동화 증권. … (3) exempted securities. Exchange Act §3(a)(12)[15 U.S.C. §78c(a)(12)]에 정의된 "exempted securities"; 또는 (4) 액면증서 또는 개방형 관리투자회사·단위투자신탁이 발행한 증권. face-amount certificate company가 발행한 액면증서, 또는 open-end management investment company·unit investment trust가 발행한 상환가능 증권(redeemable securities). 본 (d)(4)에서 사용되고 1940년 투자회사법[15 U.S.C. §80a-1 이하]에 정의된 용어는 그 법이 정한 의미를 가진다.

- **쉬운 설명**: F-04가 "그럼에도 걸린다"를 확정하는 조문이다 — BUIDL이 이 예외 증권 목록의 어디에도 들어가지 않음을 보여야 게이트 상시화가 정당화된다. 하나씩 배제한다. (1) actively-traded reference security — 발행인의 보통주 public float $1억 5천만 이상 + ADTV $100만 이상. BUIDL 발행 vehicle은 사모펀드로 공개 보통주 public float가 없다 → 미해당. 게다가 단서가 "distribution 대상 증권의 발행인·계열이 발행한 것이 아닐 것"이라, 자기 증권은 애초에 이 예외에서 빠진다. (2) 비전환·자산유동화 증권 예외 — 투자등급 채권 등에 한하며 Form SF-3 shelf 등록 요건이 붙는다 → 사모 펀드 지분에 미해당. (3) exempted securities(§3(a)(12)) — 국채·지방채 등 법정 면제증권. BUIDL은 국채를 담지만 그 자체는 사모펀드 지분이지 §3(a)(12) exempted security가 아니다 → 미해당. (4) 가장 중요 — open-end management investment company·UIT가 발행한 상환가능 증권은 예외다. 만약 BUIDL이 등록 개방형 뮤추얼펀드였다면 이 (d)(4)로 Reg M 전체를 피했을 것이다. 그러나 BUIDL은 ICA §3(c)(7) 사모펀드다 — 등록 투자회사가 아니므로 (d)(4)의 "open-end management investment company"에 해당하지 않는다. 이 미해당이 F-04의 존재 이유를 정확히 만든다: 등록 뮤추얼펀드라면 자동 면제되지만, 사모펀드는 자동 면제가 없어 발행 중 매수를 실제로 막아야 한다. (d)(4)가 열려 있지 않기 때문에 F-04가 필요하다.

- **PASS/FAIL 반영**: 직접 ○(적용 배제의 부정) — 이 조문은 "BUIDL이 예외 증권에 해당하면 F-04 비활성"을 규정하는데, 분석 결과 BUIDL은 (1)~(4) 어디에도 미해당 → F-04 활성 유지. 자산 카드의 regMExceptionProfile = NONE(예외 증권 아님) 선언이 이 결론의 코드화.

- **ERC-3643 변환**: Manifest.facts.regMExceptionProfile ∈ {NONE, ACTIVELY_TRADED, OPEN_END_UIT, EXEMPTED_3A12, ...}; BUIDL = NONE → F-04 활성. 이 선언은 발행 vehicle의 법적 성격(§3(c)(7) 비등록)에서 도출되는 사실이라 발행자 재량 없음(B-03 지위 정합과 같은 성격).

### 3.12 §242.101(c) — 참가자 갈래 예외 증권: 고정 NAV 사모펀드에 미적용 [ecfr.gov]

- **조항**: Regulation M Rule 101(c) "Excepted Securities" 및 (b)(7) "De minimis transactions", 17 C.F.R. §242.101(c)·(b)(7) — ecfr.gov (2026-07-01 현행)

- **핵심 원문**: (c) Excepted Securities. The provisions of this section shall not apply to any of the following securities: (1) Actively-traded securities. Securities that have an ADTV value of at least $1 million and are issued by an issuer whose common equity securities have a public float value of at least $150 million; Provided, however, That such securities are not issued by the distribution participant or an affiliate of the distribution participant; … (4) Face-amount certificates or securities issued by an open-end management investment company or unit investment trust. … [(b)(7):] De minimis transactions. Purchases during the restricted period, other than by a passive market maker, that total less than 2% of the ADTV of the security being purchased, or unaccepted bids; Provided, however, That the person making such bid or purchase has maintained and enforces written policies and procedures reasonably designed to achieve compliance with the other provisions of this section; …

- **한국어**: (c) 예외 증권. 본 조의 규정은 다음 증권에 적용되지 아니한다: (1) actively-traded securities. ADTV 가치 $100만 이상이고 그 발행인의 보통주 지분증권의 public float 가치가 $1억 5천만 이상인 증권 — 단, 그 증권이 distribution participant 또는 그 participant의 affiliate에 의하여 발행되지 아니할 것; … (4) 개방형 관리투자회사·단위투자신탁이 발행한 증권 등. … [(b)(7):] de minimis 거래. restricted period 동안 passive market maker가 아닌 자에 의한, 매수 대상 증권 ADTV의 2% 미만에 해당하는 매수, 또는 승낙되지 아니한 bid — 단, 그 bid·매수를 하는 자가 본 조의 다른 규정 준수를 위하여 합리적으로 설계된 서면 정책·절차를 유지·집행할 것; …

- **쉬운 설명**: §242.101(참가자 갈래)의 예외 증권·활동이다. §242.102(d)와 병렬로, F-04의 참가자 갈래도 상시 활성인 이유를 확정한다. (1) actively-traded securities — public float $1억 5천만 이상. BUIDL 미해당(§3.11과 동일 논리). (4) open-end/UIT — BUIDL은 사모펀드라 미해당. 추가로 (b)(7) de minimis — restricted period 중 매수 대상 ADTV의 2% 미만 매수는 참가자 갈래에서 예외다(서면 정책·절차 유지 조건). 이 2% de minimis는 participant 갈래에만 있고 issuer 갈래(§242.102)에는 없다는 점이 중요하다 — 발행자·매도증권보유자 자신의 매수는 아무리 소액이어도 이 예외로 구제되지 않는다. F-04는 이 비대칭을 반영해 de minimis 예외를 basis = RULE_101(참가자 갈래)일 때만, 그리고 ADTV 대비 2% 미만 + 정책·절차 요건 충족 시에만 G④에서 인정한다. 발행자 갈래(basis = RULE_102)에는 de minimis 경로가 없다.

- **PASS/FAIL 반영**: 직접 ○(참가자 갈래 예외) — (c)(1)·(4) 미해당으로 참가자 갈래 F-04 활성 유지. (b)(7) de minimis는 basis = RULE_101 ∧ 누적매수 < 2% ADTV ∧ regMPoliciesCertified일 때만 G④ PASS(REG_M_EXCEPTION_APPLIED). 발행자 갈래에는 미적용.

- **ERC-3643 변환**: G④ 참가자 de minimis 분기 = (basis = RULE_101) ∧ (cumulativeRestrictedPurchase[buyer][token] + amount < 0.02 × ADTV[token]) ∧ (regMPoliciesCertified[buyer]); ADTV는 자산 레벨 상수(거버넌스), 누적매수는 이 예외 판정 한정 카운터(STATEFUL 아님 — 예외 경로 밖에서는 미사용). 발행자 갈래는 이 분기 자체 비활성.

### 3.13 Exchange Act §9(a)(1)·(2)·(6) — 제정법 조작 금지: Reg M이 구체화한 상위 규범 [govinfo.gov]

- **조항**: Securities Exchange Act §9(a)(1)·(2)·(6), 15 U.S.C. §78i(a)(1)·(2)·(6) — govinfo.gov (Dodd-Frank 개정 반영 post-2010 본문)

- **핵심 원문**: (a) … It shall be unlawful for any person, directly or indirectly, … (1) For the purpose of creating a false or misleading appearance of active trading in any security other than a government security, or a false or misleading appearance with respect to the market for any such security, (A) to effect any transaction in such security which involves no change in the beneficial ownership thereof, or (B) to enter an order or orders for the purchase of such security with the knowledge that an order or orders of substantially the same size, at substantially the same time, and at substantially the same price, for the sale of any such security, has been or will be entered by or for the same or different parties, or (C) to enter any order or orders for the sale of any such security with the knowledge that an order or orders of substantially the same size, at substantially the same time, and at substantially the same price, for the purchase of such security, has been or will be entered by or for the same or different parties. (2) To effect, alone or with 1 or more other persons, a series of transactions in any security registered on a national securities exchange, any security not so registered, or in connection with any security-based swap or security-based swap agreement with respect to such security creating actual or apparent active trading in such security, or raising or depressing the price of such security, for the purpose of inducing the purchase or sale of such security by others. … (6) To effect either alone or with one or more other persons any series of transactions for the purchase and/or sale of any security other than a government security for the purpose of pegging, fixing, or stabilizing the price of such security in contravention of such rules and regulations as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors.

- **한국어**: (a) … 누구든지, 직접 또는 간접으로, … 하는 것은 위법이다 — (1) 국채 이외의 어떤 증권에 관하여 외관상 활발한 거래의 허위·오도 외관, 또는 그 증권의 시장에 관한 허위·오도 외관을 만들 목적으로, (A) 실질적 소유의 변동을 수반하지 아니하는 그 증권의 거래를 실행하거나(위장매매), (B) 동일·상이 당사자가 실질적으로 같은 규모·시점·가격으로 그 증권을 매도하는 주문을 이미 냈거나 낼 것을 알면서 매수 주문을 내거나, (C) 그 반대로 매수 주문이 있음을 알면서 매도 주문을 내는 것(짝맞춤주문). (2) 단독 또는 1인 이상과 함께, 국법상 거래소에 등록된 증권, 그렇게 등록되지 아니한 증권, 또는 그 증권 관련 security-based swap과 관련하여, 그 증권에 실제 또는 외관상 활발한 거래를 만들거나 그 가격을 올리거나 내려, 타인의 그 증권 매매를 유인할 목적으로 일련의 거래를 실행하는 것. … (6) 단독 또는 1인 이상과 함께, 국채 이외의 어떤 증권을 pegging·fixing·stabilizing할 목적으로, Commission이 공익 또는 투자자 보호를 위하여 필요·적절하다고 정하는 규칙·규정에 위반하여 일련의 매수·매도 거래를 실행하는 것.

- **쉬운 설명**: Reg M(그리고 F-04)이 사전 규칙으로 구체화한 상위 제정법이다. 세 항이 F-04에 각기 닿는다. (a)(2)가 핵심 — "일련의 거래로 가격을 올리거나 내려 타인의 매매를 유인할 목적"의 조작이다. 발행 중에 발행자·계열이 자기 증권을 사들이는 것은 바로 이 (a)(2) 유형의 조작 위험이고, Reg M Rule 102는 그 목적 입증 없이도 이를 사전 차단한다. 여기서 Dodd-Frank 개정이 결정적이다 — 개정 전 (a)(2)는 "국법상 거래소에 등록된 증권"에 한정됐으나, 2010년 개정으로 "그렇게 등록되지 아니한 증권(any security not so registered)"까지 명시 포섭됐다. 즉 BUIDL 같은 미등록 사모 토큰 증권도 §9(a)(2) 조작 금지의 사정권에 있다 — F-04가 미등록 증권에 대해서도 정당하게 작동하는 제정법적 근거다. (a)(1)은 위장매매·짝맞춤주문(실질 소유 변동 없는 거래) — 이는 F-02(자전거래/wash-trade 감시)가 사후 flag로 겨누는 유형과 직결된다(§9.1). (a)(6)은 pegging·fixing·stabilizing를 SEC 규칙 위반 시 금지하는데, 그 "SEC 규칙"이 바로 Reg M Rule 104(안정조작 조건)이다(§3.15) — 안정조작은 원칙 금지이되 Rule 104 조건을 지키면 허용되는 예외 구조임을 보여준다.

- **PASS/FAIL 반영**: 간접 ✕(제정법 앵커) — F-04는 §9(a)를 직접 판정하지 않는다. Reg M의 사전 게이트가 근거하는 상위 규범이자, "목적 요건 제거 → 기계 판정 가능"이라는 F-04 설계 정당성의 원천(§1.1·§3.0.1). (a)(2)의 미등록 증권 포섭이 F-04의 적용 대상 범위를 뒷받침.

- **ERC-3643 변환**: 직접 필드 없음. Reg M 모듈(F-04)과 감시 모듈(F-02)의 분리 배치가 (a)(2) 사전 차단 / (a)(1) 사후 탐지의 역할 분담을 코드에 옮긴 것.

### 3.14 Exchange Act §10(b)·§9(g) + Securities Act §17(a) — anti-fraud 병존과 exempted security 경계 [uscode.house.gov·govinfo.gov]

- **조항**: Exchange Act §10(b), 15 U.S.C. §78j(b) — uscode.house.gov (2026-04-29 효력); Exchange Act §9(g), 15 U.S.C. §78i(g) — govinfo.gov; Securities Act §17(a), 15 U.S.C. §77q(a)(Reg M Prelim Note 인용)

- **핵심 원문**: [§10(b):] It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce or of the mails, or of any facility of any national securities exchange— … (b) To use or employ, in connection with the purchase or sale of any security registered on a national securities exchange or any security not so registered, or any securities-based swap agreement … any manipulative or deceptive device or contrivance in contravention of such rules and regulations as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors. [§9(g):] The provisions of subsection (a) of this section shall not apply to an exempted security.

- **한국어**: [§10(b):] 누구든지, 직접 또는 간접으로, 주간통상·우편의 수단이나 국법상 거래소의 시설을 사용하여 — … (b) 국법상 거래소에 등록된 증권이든 그렇게 등록되지 아니한 증권이든 그 매매와 관련하여, Commission이 공익·투자자 보호를 위하여 필요·적절하다고 정하는 규칙·규정에 위반하여 조작적·기망적 장치나 술책을 사용·이용하는 것은 위법이다. [§9(g):] 본 조 (a)의 규정은 exempted security에는 적용되지 아니한다.

- **쉬운 설명**: 두 가지를 확정한다. 첫째(§10(b)), Reg M 통과가 anti-fraud 면책이 아님을 다시 못 박는다 — §10(b)는 "등록·미등록 증권 불문" 매매와 관련한 모든 조작적·기망적 장치를 금지하는 포괄 조항(Rule 10b-5의 근거)이다. F-04의 밝은 선을 지켰어도 매수가 기망·조작 스킴의 일부였다면 §10(b)로 별도 책임이 성립한다 — §3.1 Preliminary Note의 병존을 제정법 층에서 확인한다. 둘째(§9(g)), §9(a)는 exempted security(국채·지방채 등 §3(a)(12))에는 적용되지 않는다. 이는 §3.11 (d)(3)·§3.12의 exempted security 예외와 맞물린다 — BUIDL 토큰은 국채를 담지만 그 자체는 사모펀드 지분이지 exempted security가 아니므로 §9(g) 면제를 받지 못한다(F-04 적용 유지). §17(a)(증권법)는 청약·판매 단계의 사기를 겨누며 Reg M Preliminary Note가 병존을 명시한다 — 발행 단계 전반의 anti-fraud 그물이다.

- **PASS/FAIL 반영**: 간접 ✕(경계·앵커) — §10(b)는 F-04 PASS 의미의 한계(면책 아님)를, §9(g)는 exempted security 미해당(F-04 적용 유지)을 확정한다. 판정식이 아니라 적용 범위·의미 경계.

- **ERC-3643 변환**: 직접 필드 없음. regMExceptionProfile = NONE 판정에 §9(g)/§3(a)(12) 미해당 논거가 포함됨을 카드 주석으로 기록.

### 3.15 §242.102(e)·§242.104 — 면제권한과 안정조작: 고정 NAV·무-시세받치기 논거의 자리 [ecfr.gov]

- **조항**: Regulation M Rule 102(e) "Exemptive Authority", 17 C.F.R. §242.102(e) + Rule 104 "Stabilizing", 17 C.F.R. §242.104 + Rule 100(b) "Stabilize" 정의 — ecfr.gov (2026-07-13 현행)

- **핵심 원문**: [§242.102(e):] Exemptive Authority. Upon written application or upon its own motion, the Commission may grant an exemption from the provisions of this section, either unconditionally or on specified terms and conditions, to any transaction or class of transactions, or to any security or class of securities. [§242.100(b) "Stabilize":] Stabilize or stabilizing means the placing of any bid, or the effecting of any purchase, for the purpose of pegging, fixing, or maintaining the price of a security.

- **한국어**: [§242.102(e):] 면제 권한. 서면 신청에 의하거나 직권으로, Commission은 본 조의 규정으로부터의 면제를, 무조건 또는 특정 조건 하에, 모든 거래 또는 거래의 종류, 또는 모든 증권 또는 증권의 종류에 대하여 부여할 수 있다. [§242.100(b) "Stabilize":] "stabilize" 또는 "stabilizing"이란 증권의 가격을 pegging·fixing·유지할 목적으로 bid를 내거나 매수를 실행하는 것을 말한다.

- **쉬운 설명**: F-04의 두 경계 — 허용의 상한과 면제의 문 — 을 담는다. 첫째, 안정조작(stabilizing)은 §9(a)(6)·Rule 104가 정한 엄격 조건(오퍼링 가격 이하, 독립 bid 우선, 공시, at-the-market 오퍼링 금지 등) 하에서만 허용되는 예외적 매수다. 그런데 BUIDL은 NAV $1 고정을 목표로 하는 구조라 안정조작을 할 유인 자체가 구조적으로 없다 — 가격을 떠받칠 이유가 없다. 이것이 프로젝트의 "무-시세받치기 논거"의 핵심이다: 고정 NAV 상품에서는 발행자가 시장 가격을 조작할 경제적 동기가 낮으므로, Reg M이 겨냥하는 조작 위험이 구조적으로 작다. 둘째(§242.102(e)), 그럼에도 F-04가 발행자·계열의 온-DEX 매수를 원칙 차단하는 이상, 정당한 운영상 매수(예: 특정 환매·재조정)를 열려면 SEC의 면제(exemptive relief)나 no-action 입장이 필요할 수 있다. 여기서 정직해야 한다 — "고정 NAV라 조작 위험이 낮다"는 논거는 강력한 분석적 근거이지, 그 자체로 Rule 102의 밝은 선을 무효화하지 않는다. Rule 102에는 고정 NAV 사모펀드를 위한 자동 예외가 없다(§3.11에서 (d)(4)가 등록 개방형에 한정됨을 확인). 따라서 이 무-시세받치기 논거를 실제 면제·no-action으로 승격시킬지, 아니면 환매 창구 분리(§3.10)만으로 충분한지는 변호사 위임 사항이다(§12 OD-F04-4). 시스템의 보수 기본값은 면제가 확인되기 전까지 발행자 갈래 온-DEX 매수를 전량 차단한다.

- **PASS/FAIL 반영**: 조건부 — Rule 104 안정조작은 BUIDL 미사용(고정 NAV)이라 G④ 예외로 활성화하지 않음(보수). §242.102(e) 면제는 확인 전까지 게이트 완화 근거로 쓰지 않음 — "면제가 있으므로 통과" 같은 역방향 완화는 존재하지 않는다.

- **ERC-3643 변환**: stabilizing 경로 미구현(Manifest.facts.stabilizingEnabled = false, 고정 NAV); 면제 획득 시에만 regMExemptionRef(SEC 면제 근거 해시)를 두어 특정 거래 클래스의 G④ 예외로 편입 — 현행 ∅. 완화 방향 변경은 거버넌스 경로 + 법적 근거 등록 필수(§11).

### 3.16 Rel. No. 34-38067 — Reg M 채택 취지 [sec.gov·federalregister.gov]

- **조항**: Anti-manipulation Rules Concerning Securities Offerings, Securities Exchange Act Release No. 34-38067 (Dec. 20, 1996), 62 FR 520 (Jan. 3, 1997), File No. S7-11-96, RIN 3235-AF54 — sec.gov · federalregister.gov

- **핵심 원문**: The Commission is adopting new Regulation M governing the activities of underwriters, issuers, selling security holders, and others in connection with offerings of securities. Regulation M is intended to preclude manipulative conduct by persons with an interest in the outcome of an offering.

- **한국어**: Commission은 증권 오퍼링과 관련한 인수인·발행인·매도증권보유자 및 그 밖의 자의 행위를 규율하는 새 Regulation M을 채택한다. Regulation M은 오퍼링의 결과에 이해관계를 가진 자의 조작적 행위를 사전에 배제(preclude)함을 목적으로 한다.

- **쉬운 설명**: F-04의 목적론적 해석 기준이다. Reg M의 목적은 "오퍼링 결과에 이해관계를 가진 자(발행자·인수인·매도보유자 등)의 조작적 행위를 사전에 배제"하는 것이다 — 이 한 문장이 F-04의 제한대상 집합(누구를 막는가)과 사전 차단 방식(왜 사후가 아니라 사전 게이트인가)을 동시에 정당화한다. 이해관계자를 restricted period 동안 매수에서 배제한다는 규칙의 취지가, permissioned DEX에서 발행자·계열의 매수를 체결 전 차단하는 F-04의 설계와 정확히 일치한다. 이 release는 또한 Reg M이 종전 Rule 10b-6 등을 대체하며 actively-traded 증권의 인수인 제한을 없애는 등 규제 부담을 완화하는 방향임을 밝히는데 — 그 완화가 BUIDL에는 닿지 않는다(public float 요건 미충족, §3.11)는 점이 F-04 상시화를 다시 확인한다.

- **PASS/FAIL 반영**: 간접 ✕(취지) — 판정식이 아니라, 제한대상 집합 획정·사전 차단 방식의 목적론적 근거. 예외 경계(§3.10~§3.12) 해석 시 "조작 위험이 구조적으로 없는가"를 묻는 기준(§3.15 무-시세받치기 논거의 취지적 뒷받침).

- **ERC-3643 변환**: 직접 필드 없음. F04Check 이벤트에 근거 release를 주석으로 남겨 감독 검사 시 판정의 규범적 출처 재구성.

---

### 3.17 Sub-요건 분해 매트릭스 + ERC-3643 총정리 (§3 말미)

위 §3.1~§3.16의 원리를 F-04가 실제로 판정하는 원자적 검증 단위로 분해한다. 각 행은 §5.2의 판정 분기와 1:1 대응한다(채널: V = 상장 시점 카드 검사, G = per-tx 게이트, GOV = 거버넌스 평면 전제). deemed-PASS·역방향 완화 경로는 존재하지 않는다.

**표 A — Sub-요건 분해 매트릭스**

| Sub-ID | 원자 검증 단위 | 근거 조문 | 채널 | PASS 조건 | FAIL/REVIEW 코드 |
| --- | --- | --- | --- | --- | --- |
| F04-V1 | 선언 존재 — offeringStatus 비어있지 않음 | §242.100(b) distribution·restricted period(§3.2·§3.4) | V | Manifest.facts.offeringStatus ∈ {ONGOING_CONTINUOUS, ONGOING_TRANCHE, COMPLETED} | REG_M_OFFERING_STATUS_MISSING |
| F04-V2 | 예외증권 선언 정합 — regMExceptionProfile | §242.102(d)·§242.101(c)(§3.11·§3.12) | V | regMExceptionProfile 선언됨; BUIDL = NONE(사모펀드 → 미해당) | REVIEW_REGM_EXCEPTION_CONFLICT (개방형/exempted 오선언 시) |

[output truncated at 50000 of 74455 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007788
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
