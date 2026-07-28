---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: F-04
element-name: No Purchase During Distribution (판매 중 매수 금지 / Regulation M)
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough."
substance-sot: "보경 walkthrough — F-04_no-purchase-during-distribution.md (2026-07-21). 레포 docs 교체 대상."
umbrella: "SPEC.md — 공유 개념(경계·예방/탐지·Recipe·Manifest·on/off-chain 경계)은 여기에 의한다"
stateful: false
tags: [requirement-spec, F-04, reg-m, market-manipulation, distribution, stateless, R1, R-XJ]
---

# F-04 No Purchase During Distribution (Regulation M) — 요구사항 명세서

본 문서는 컴플라이언스 부품 F-04(판매 중 매수 금지, Regulation M)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough(`F-04_no-purchase-during-distribution.md`, 2026-07-21)에 의하며, 본 명세의 제1부 각 주장은 그 walkthrough로 소급 추적된다.

본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다. 따라서 **제2부는 목표 규격(target specification)** 이며, 인터페이스·판정 구조·기능 요구사항은 구현이 충족하여야 할 요구 동작을 규정할 뿐 현존 코드를 기술하지 아니한다. ERC-3643 배선의 실제 형상(`moduleCheck` 시그니처·필드명)은 walkthrough의 "ERC-3643 변환" 주석을 목표로 삼되, 구현 시점에 개발팀 합의로 확정한다. 시스템 공유 개념(Element/Recipe/Manifest·on-chain/off-chain 경계·예방/탐지 층위)은 `SPEC.md`에 의한다.

본 부품은 감시·표시형(F-02·F-03)이 아니라 **체결 전 차단형 게이트**이다. 발행(distribution)이 진행되는 restricted period 동안, 발행자·매도증권보유자·그 affiliated purchaser·distribution participant가 대상 증권(covered security)을 permissioned DEX에서 매수하는 것을 결정론적으로 차단한다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

F-04는 미국 증권규제의 시세조종 방지 체계 가운데 발행 국면(distribution)에 특유한 사전 예방 규칙인 Regulation M을 permissioned DEX의 체결 전 관문으로 옮긴 부품이다. 규율 대상은 하나의 밝은 선(bright line)이다 — restricted period 동안, 발행에 이해관계를 가진 제한대상자(발행자·매도증권보유자·affiliated purchaser·distribution participant)가 covered security를 매수 호가(bid)·매수(purchase)하거나 타인에게 그 매수를 유인(attempt to induce)하는 것은 그 자체로 위법이다. F-04는 이 한 선을 시점·방향·주체의 세 좌표의 곱으로 기계 판정하여, 위반 매수를 체결 전에 되돌린다(revert).

본 부품이 기계 판정형(SPEC.md §2.1의 패턴 A)인 근거는 규범의 구조 자체에 있다. 상위 제정법인 증권거래법 §9(a)(2)의 조작 금지는 "타인의 매매를 유인할 목적"이라는 주관적 요건을 품지만, Regulation M은 그 목적 심사를 걷어내고 지위·시점이라는 객관 사실만으로 위법을 확정한다. 목적 요건이 사라졌기 때문에 코드가 판정할 수 있고, 그 결과 F-04는 제재명단 대조(A-01)와 같은 계열의 strict-liability 게이트가 된다. 다만 A-01이 명단 소속으로 판정한다면, F-04는 시간 창(restricted period) × 역할 소속(제한대상 집합)의 곱으로 판정한다.

F-04는 조작의 고의가 실제로 있었는지는 판정하지 아니한다. 그 사후 판단은 §9(a)(2)의 영역이자 시장감시 부품 F-02(패턴 C, 사후 flag)의 일이며, 두 부품은 사전 차단과 사후 탐지로 상보한다. 마찬가지로 어떤 증권이 restricted securities인지(B-02·B-03), 매수인이 Rule 144 의미의 affiliate인지(A-06), 몇 번째 보유자인지(D-01)는 각기 다른 부품의 소관이다. F-04는 "발행 중 제한대상자의 매수 금지"라는 Reg M의 밝은 선 하나만을 담당한다.

## 2. 규범적 근거

F-04가 집행하는 규범은 두 층으로 이루어진다. 상위층은 제정법의 사후 조작·사기 금지이고, 하위층은 그 사후 금지를 발행 국면에서 사전 규칙으로 구체화한 SEC 규정 Regulation M이다.

제정법 앵커는 증권거래법 §9(a)(1)·(2)·(6)(15 U.S.C. § 78i(a))이다. 그 가운데 §9(a)(2)는 "일련의 거래로 증권에 실제 또는 외관상 활발한 거래를 만들거나 그 가격을 올리거나 내려 타인의 매매를 유인할 목적"의 조작을 금지하는 핵심 조항으로, F-04가 막는 발행 중 자기증권 매수의 위험 유형을 정면으로 겨눈다. 2010년 도드-프랭크 개정은 이 조항의 적용 대상을 "국법상 거래소에 등록된 증권"에서 "그렇게 등록되지 아니한 증권(any security not so registered)"까지 명시적으로 확장하였으므로, BUIDL과 같은 미등록 사모 토큰 증권도 §9(a)(2)의 사정권에 있다. 이와 병존하는 anti-fraud 앵커로 증권거래법 §10(b)(15 U.S.C. § 78j(b))와 증권법 §17(a)(15 U.S.C. § 77q(a))가 있다.

하위층은 Regulation M이다. Rule 100(17 C.F.R. § 242.100)이 판정의 모든 좌표(distribution·restricted period·covered security·distribution participant·affiliated purchaser·selling security holder)를 정의하고, 금지 조문은 인적 지위에 따라 둘로 갈린다. Rule 102(17 C.F.R. § 242.102)는 발행자·매도증권보유자와 그 affiliated purchaser를, Rule 101(17 C.F.R. § 242.101)은 distribution participant와 그 affiliated purchaser를 각각 겨눈다. Rule 104(17 C.F.R. § 242.104)는 안정조작(stabilizing)의 엄격 조건부 허용을 규정하나, 고정 NAV 상품인 BUIDL에서는 사용되지 아니한다. 규칙의 목적론적 기준은 채택 취지문(Anti-manipulation Rules Concerning Securities Offerings, Rel. No. 34-38067, 62 FR 520 (Jan. 3, 1997))이 밝힌 "오퍼링의 결과에 이해관계를 가진 자의 조작적 행위를 사전에 배제(preclude)"에서 온다.

두 층의 관계는 병존이다. Regulation M의 밝은 선을 통과하였다는 사실이 §9·§10(b)의 사후 책임을 면제하지 아니한다(Rule 100(a) Preliminary Note). 따라서 F-04의 PASS는 "Reg M 매수 금지에 걸리지 아니함"이라는 좁은 의미이지, 적법 보증이 아니다.

## 3. 쟁점별 논증

### 3.1 왜 사전 게이트이며 왜 기계 판정이 가능한가

F-04가 사후 책임이 아니라 사전 차단의 형태를 취하고, 나아가 사람의 판단 없이 코드가 판정할 수 있는 근거가 무엇인지가 문제된다. 증권거래법 §9(a)(2)는 조작을 사후에 위법으로 규정하되 "타인의 매매를 유인할 목적"이라는 주관적 요건을 요구한다. 발행 국면에서는 발행자·인수인이 오퍼링 가격을 떠받치려는 유인이 구조적으로 존재하지만, 그 목적을 개별 거래마다 사후에 입증하기는 어렵다. Regulation M은 이 난점을 사전 예방(prophylactic) 설계로 해소한다. 채택 취지문(Rel. No. 34-38067)이 밝히듯 Reg M은 오퍼링에 이해관계를 가진 자의 조작적 행위를 사전에 배제하기 위하여, 목적 심사를 제거하고 "누가(제한대상자)·언제(restricted period)·무엇을(covered security 매수)"이라는 객관 사실만으로 위법을 확정하는 밝은 선을 긋는다. 목적 요건이 제거된 결과 판정은 사실의 대조로 환원되고, 이것이 F-04를 strict-liability 게이트(SPEC.md 패턴 A)로 만든다. 그러므로 F-04는 조작 목적을 심사하지 아니하며, restricted period · covered security · 제한대상 주체의 세 요건이 모두 충족되고 예외가 없으면 체결 전에 차단한다.

### 3.2 두 갈래의 금지 조문과 라우팅

Reg M의 매수 금지가 어느 조문으로 집행되는지, 그리고 지위가 겹치는 자를 어떻게 처리하는지가 문제된다. 금지는 인적 지위에 따라 두 조문으로 갈린다. Rule 102(a)(17 C.F.R. § 242.102(a))는 발행자·매도증권보유자와 그 affiliated purchaser에게, Rule 101(a)(17 C.F.R. § 242.101(a))는 distribution participant와 그 affiliated purchaser에게, 각각 restricted period 동안 covered security를 "bid for, purchase, or attempt to induce any person to bid for or purchase" 하지 말 것을 명한다. 두 조문의 금지 문언은 사실상 동일하며 결과(차단)도 같다. 다만 두 조문은 서로를 향한 라우팅 단서를 둔다. Rule 102(a)의 "Except That" 단서는 affiliated purchaser가 동시에 distribution participant이면 Rule 101을 따를 수 있게 하고, Rule 101(a)의 "Provided, however" 단서는 participant가 동시에 발행자·매도증권보유자이면 Rule 102를 따르게 한다. 참조 구현에서 F-04의 1차 사정권은 Rule 102(발행자 갈래)다 — 가장 먼저 막아야 할 것은 발행자(발행 vehicle)와 그 계열이 발행 중 자기 토큰을 DEX에서 사들이는 시나리오이기 때문이다. 그러므로 F-04는 매수인의 역할을 판별하여, 발행자·매도증권보유자이면 Rule 102 근거로, 순수 participant이면 Rule 101 근거로 라우팅하되, 어느 조문 근거로 차단하였는지를 이벤트에 남겨 감독 검사 시 재구성 가능하게 한다.

### 3.3 restricted period가 닫히지 않는 문제 — 상시 발행

F-04 게이트가 언제 열려 있는지, 특히 판매가 끝나지 않는 자산에서 게이트가 얼마나 오래 작동하는지가 문제된다. Rule 100(b)의 "restricted period" 정의(17 C.F.R. § 242.100(b))는 창의 양끝을 "오퍼링 가격 결정"(그 시점의 1영업일 전 또는 5영업일 전)과 "그 자의 distribution 참여 완료(completion of participation in the distribution)"로 잡는다. 어느 창에 속하는지는 유동성·시가총액으로 갈리는데, BUIDL 토큰은 발행 vehicle의 보통주 public float가 없는 사모펀드 지분이므로 큰 유동성 요건($100,000 ADTV, 보통주 public float $2,500만)을 충족하지 못하여 5영업일 창(그 밖의 모든 증권)에 떨어진다. 그러나 결정적 비틀림은 참조 자산 BUIDL이 매일 상시 발행(continuous offering)되고 수익 분배도 매월 신규 토큰 지급으로 이루어진다는 데 있다. 가격 결정이 매일 반복되고 "참여 완료"가 오지 않으므로 restricted period가 사실상 열린 채로 유지되고, 그 결과 F-04의 게이트는 특정 며칠이 아니라 자산의 존속 기간 내내 작동한다. 그러므로 시스템은 보수적으로, 배포 상태 선언이 상시 발행(offeringStatus = ONGOING_CONTINUOUS)인 동안 restricted period를 상시 활성으로 취급한다. 다만 이 상시성의 법적 정밀화 — 각 tranche가 자기 5영업일 창을 갖는지, 아니면 전체가 하나의 열린 창인지 — 는 사실관계 심사로서 변호사 확인 대상이다(OD-F04-6).

### 3.4 covered security의 범위와 대상 식별

금지의 대상이 어느 토큰·클래스인지가 문제된다. Rule 100(b)의 "covered security" 정의(17 C.F.R. § 242.100(b))는 distribution의 대상 증권(subject security)과 reference security를 대상으로 삼는다. F-04에서 covered security는 발행 중인 그 토큰 클래스 자체다. reference security 축은 그 토큰이 다른 증권으로 전환·교환되거나 다른 증권이 그 토큰의 가치를 결정하는 구조일 때 그 다른 증권까지 금지에 넣는 장치인데, BUIDL의 토큰화 국채 지분은 단순 지분형이라 그 확장이 좁다(대개 없음). 그러므로 F-04의 대상 식별은 클래스 식별자(legalClassId, D-01·B-03과 공유)에 결속되며, 같은 발행체의 다른 클래스가 별개의 배포 상태를 가질 수 있으므로 판정은 정확한 클래스를 가리켜야 한다. 자산 카드에 reference security 선언이 비어 있으면 대상은 subject security 단일로 좁혀진다.

### 3.5 affiliated purchaser의 외연과 A-06과의 경계

제한대상 집합에 누구까지 들어가는지, 특히 발행자의 계열·거래 부문이 어디까지 포섭되는지가 문제된다. Rule 100(b)의 "affiliated purchaser" 정의(17 C.F.R. § 242.100(b))는 세 갈래로 외연을 넓힌다. (1) 발행자 등과 covered security의 취득·배포에 관하여 직접·간접으로 공동으로(in concert) 행위하는 자, (2) 그러한 자의 covered security 매수를 지배·피지배·공동지배하는 affiliate, (3) 자기·타인 계산으로 정기적으로 증권을 매수하거나 투자재량을 행사하는 affiliate이다. 다만 (3)은 정보차단벽·연간 독립평가·임직원 비공유·restricted period 중 시장조성 및 권유거래 부작위라는 안전항 4요건을 모두 충족하면 적용에서 빠진다.

여기서 두 가지가 F-04 설계에 결정적이다. 첫째, Reg M의 "affiliated purchaser"는 Rule 144·§405의 "affiliate"와 정의가 다르다. Rule 144 affiliate는 발행인을 지배하는 자(control)를 중심으로 하지만, Reg M affiliated purchaser는 매수의 공동행위·지배 및 재량운용을 중심으로 한다. 그러므로 Rule 144 affiliate를 판정하는 A-06의 산출을 그대로 F-04에 재사용할 수 없으며, F-04는 별도의 제한대상 레지스트리로 판별한다. 둘째, (3)의 안전항 충족 여부는 순수한 기계 판정이 아니라 정책·절차의 실재 확인을 요한다. 그러므로 F-04는 안전항 충족을 자산·계열 레벨 사실(regMInfoBarrierCertified, 연간 갱신·만료 시 신선도 필요)로 상장·운영 시점에 확정해 두고, 런타임은 그 확정값을 읽어 등재/비등재를 정한다. 다만 누가 affiliated purchaser이며 누가 distribution participant인지의 확정 자체는 계약 구조·계열 관계 검토를 요하므로 변호사 확인 대상이다(OD-F04-3).

### 3.6 예외 증권의 배제 — 왜 BUIDL은 자동 면제되지 않는가

발행 중이라는 이유만으로 언제나 F-04가 걸리는지, 아니면 어떤 증권은 Reg M 자체에서 빠지는지가 문제된다. Rule 102(d)(17 C.F.R. § 242.102(d))와 그 참가자 갈래 대응인 Rule 101(c)(17 C.F.R. § 242.101(c))는 예외 증권을 열거한다. 각 항을 BUIDL에 대조하면 어디에도 해당하지 아니한다. (1) actively-traded reference security(발행인의 보통주 public float $1억 5천만 이상 + ADTV $100만 이상)는 사모펀드로 공개 보통주가 없는 BUIDL 발행 vehicle에 미해당이며, 나아가 그 단서가 자기 증권을 예외에서 배제한다. (2) 비전환·자산유동화 증권 예외는 투자등급 채권 등에 한하여 사모 펀드 지분에 미해당이다. (3) exempted securities(증권거래법 § 3(a)(12), 15 U.S.C. § 78c(a)(12))는 국채·지방채 등 법정 면제증권을 말하는데, BUIDL은 국채를 담더라도 그 자체는 사모펀드 지분이지 § 3(a)(12) 면제증권이 아니다. (4) 개방형 관리투자회사(open-end management investment company)·단위투자신탁이 발행한 상환가능 증권 예외가 가장 중요하다 — 만약 BUIDL이 등록 개방형 뮤추얼펀드였다면 이 항으로 Reg M 전체를 피하였을 것이다. 그러나 BUIDL은 투자회사법 § 3(c)(7)에 의지하는 비등록 사모펀드이므로 (4)의 "open-end management investment company"에 해당하지 아니한다. 그러므로 등록 뮤추얼펀드에는 자동 면제가 열려 있으나 사모펀드에는 열려 있지 아니하며, 바로 이 (4)의 미해당이 F-04의 존재 이유를 정확히 만든다. 참가자 갈래의 병렬 예외(Rule 101(c))도 동일 논리로 미해당이므로, 발행자 갈래와 참가자 갈래 모두에서 게이트는 상시 활성으로 유지된다.

### 3.7 환매 창구 분리 — Reg M 방어선

Rule 102가 발행자의 매수를 금지한다면, BUIDL이 운영하는 발행자 측 환매(USD·USDC 환매)는 어떻게 위반을 피하는지가 문제된다. Rule 102(b)(17 C.F.R. § 242.102(b))는 금지에서 제외되는 활동을 열거하는데, 그 가운데 폐쇄형 투자회사의 NAV tender offer(b)(2)(ii)와 commodity pool·limited partnership의 NAV 환매(b)(3)는 하나같이 "그 증권이 증권거래소·inter-dealer quotation system·ECN에서 거래되지 아니할 것"이라는 단서를 단다. 또한 비권유 매수 예외(b)(6)도 broker·dealer·거래소·ECN을 통하지 아니하는 매수에 한한다. 이 단서들이 결정적이다 — permissioned DEX에서의 매수는 거래소·ECN에 준하는 venue를 통한 매수이므로, 발행자의 토큰 취득을 이 예외들에 얹으려면 그것이 DEX 매수 경로를 통해서는 안 된다. 그러므로 환매는 DEX 매수 경로가 아니라 별도의 환매 창구(운영자 통제, off-venue)로 라우팅되어야 하며, 이 구조적 분리가 곧 "환매 창구 분리 = Reg M 방어선"의 실질이다. F-04의 게이트는 이 환매 경로를 건드리지 아니하며(구조적으로 canTransfer 매수 경로를 타지 않음), 매도 방향의 청약·권유는 Rule 102(b)(5)에 따라 애초에 금지되지 아니하므로 F-04가 매수 방향만 게이트하는 근거가 된다. 다만 이 예외들의 온체인 적용 가능성, 특히 permissioned DEX가 거래소·ECN에 해당하는지의 판단은 본 거래장의 BD/ATS 성격규명과 얽혀 변호사 확인 대상이며(OD-F04-2), 환매를 (6) 비권유 매수가 아니라 (2)(ii)/(3)의 off-venue NAV 환매 구조로 설계하여야 한다는 점 또한 확정이 필요하다(OD-F04-5).

### 3.8 anti-fraud의 병존 — F-04 PASS의 의미 한계

F-04를 통과한 매수가 그로써 적법이 보증되는지가 문제된다. Rule 100(a) Preliminary Note(17 C.F.R. § 242.100(a))는 어떠한 거래도 Reg M 준수 여부와 무관하게 증권법 § 17(a) 및 증권거래법 § 9·§ 10(b)·§ 15(c)의 사기금지·조작금지 조항의 적용을 계속 받는다고 명시한다. § 10(b)(15 U.S.C. § 78j(b))는 등록·미등록 증권을 불문하고 매매와 관련한 조작적·기망적 장치를 금지하는 포괄 조항(Rule 10b-5의 근거)이므로, F-04의 밝은 선을 지켰더라도 매수가 기망·조작 스킴의 일부였다면 별도 책임이 성립한다. 그러므로 F-04의 PASS는 "Reg M 매수 금지에 걸리지 아니함"이라는 좁은 의미이며, 적법의 보증이 아니다. 이 한계 때문에 사전 게이트(F-04)와 사후 감시(F-02)는 서로 다른 모듈로 분리 배치되어, 하나가 통과시킨 거래라도 다른 하나가 사후에 탐지·flag할 수 있게 한다. 아울러 § 9(g)(15 U.S.C. § 78i(g))가 § 9(a)를 exempted security에 적용하지 아니한다고 정하지만, BUIDL은 § 3(a)(12) 면제증권이 아니므로 그 면제를 받지 못하여 F-04 적용이 유지된다.

### 3.9 무-시세받치기 논거의 지위와 한계

BUIDL이 NAV $1 고정을 목표로 하여 가격을 조작할 경제적 동기가 낮다는 사정이 F-04를 완화하거나 무력화하는지가 문제된다. Rule 104(17 C.F.R. § 242.104)와 Rule 100(b)의 "stabilize" 정의에 따르면 안정조작은 가격을 pegging·fixing·유지할 목적의 매수로서 엄격한 조건 하에서만 허용되는데, 고정 NAV 상품인 BUIDL은 가격을 떠받칠 유인 자체가 구조적으로 없어 안정조작을 사용하지 아니한다. 이 "무-시세받치기" 사정은 조작 위험이 구조적으로 작다는 강한 분석적 논거이지만, 그 자체로 Rule 102의 밝은 선을 무효화하지 아니한다. §3.6에서 확인하였듯 Rule 102에는 고정 NAV 사모펀드를 위한 자동 예외가 없기 때문이다. Rule 102(e)(17 C.F.R. § 242.102(e))는 SEC가 서면 신청 또는 직권으로 면제를 부여할 수 있게 하나, 면제나 no-action 입장이 확인되기 전까지 시스템은 그 논거를 게이트 완화의 근거로 쓰지 아니한다. "면제가 있으므로 통과"와 같은 역방향 완화 경로는 존재하지 아니하며, 시스템의 보수 기본값은 면제가 확인될 때까지 발행자 갈래 온-DEX 매수를 전량 차단하는 것이다. 다만 이 무-시세받치기 논거를 실제 SEC 면제·no-action으로 승격시킬지, 아니면 환매 창구 분리(§3.7)만으로 충분한지는 변호사 위임 사항이다(OD-F04-4).

## 4. 확정 사항 및 잔여 쟁점

다음은 walkthrough에 의하여 확정되었다. 첫째, F-04는 목적 요건이 제거된 strict-liability 게이트로서 restricted period · covered security · 제한대상 주체의 곱을 체결 전에 기계 판정하여 차단한다(§3.1). 둘째, 금지는 Rule 102(발행자 갈래)와 Rule 101(참가자 갈래)의 두 조문으로 집행되며 두 갈래 사이의 라우팅 단서로 지위 중복을 처리한다(§3.2). 셋째, BUIDL은 상시 발행 구조라 restricted period가 사실상 상시 활성이다(§3.3). 넷째, BUIDL은 Rule 102(d)·Rule 101(c)의 예외 증권 어디에도 해당하지 아니하여 게이트가 상시 유지된다(§3.6). 다섯째, 발행자 측 환매는 F-04 게이트 밖의 별도 창구로 분리되어야 한다(§3.7). 여섯째, F-04의 PASS는 적법 보증이 아니며 anti-fraud와 병존한다(§3.8).

다음은 확정 또는 후속을 요한다.

- **OD-F04-1.** 이 오퍼링이 Reg M상 "distribution"에 실제로 해당하는지, 그리고 상시 발행에서 각 tranche가 별개의 distribution인지 전체가 하나의 연속 distribution인지의 경계(§3.3·§242.100(b) distribution 정의).
- **OD-F04-2.** Rule 102(b)/101 예외들의 온체인 적용 가능성, 특히 permissioned DEX가 증권거래소·ECN에 해당하는지 — 본 거래장의 BD/ATS 성격규명과 결합된 문제(§3.7).
- **OD-F04-3.** 누가 distribution participant이며 누가 affiliated purchaser인지의 확정. 계약 구조·계열 관계 검토와 (3) 안전항(정보차단벽·독립평가 등)의 실재 확인을 요함(§3.5).
- **OD-F04-4.** 무-시세받치기 논거를 SEC 면제·no-action으로 승격시킬지, 아니면 환매 창구 분리만으로 충분한지의 결정(§3.9·§242.102(e)).
- **OD-F04-5.** 발행자 측 환매를 (6) 비권유 매수가 아니라 (2)(ii)/(3)의 off-venue NAV 환매 구조로 설계·확정(§3.7).
- **OD-F04-6.** 상시 발행에서 restricted period 상시성의 법적 정밀화 — tranche별 5영업일 창인지 전체 열린 창인지(§3.3).
- **OD-F04-7.** 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다(제2부는 목표 규격).

---

# 제2부. 구현 명세 (목표 — 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `F-04-v1` (미구현) |
| 분류 | 행위·운영(CONDUCT/OPERATION) · 게이트(GATE) — strict bright-line |
| 검증 패턴 | 기계 판정형(MACHINE_DECIDABLE, SPEC.md 패턴 A) — 차단(revert), 표시 아님 |
| 판정 시점 | 거래 전 게이트(PRE_TRADE_GATE) |
| 상태 | STATELESS. 단, 활성 여부는 Manifest의 **배포 상태 사실 `offeringStatus`(distributionStatus, active/completed)** 를 읽어 결정한다. 제한대상 레지스트리·ADTV·인증 플래그 등 입력은 거래 외 경로(운영자·거버넌스)로만 변경되며, 게이트 자체는 거래마다 상태를 누적하지 아니한다(de minimis 누적 카운터는 예외 판정 한정, STATEFUL 아님). |
| 활성 | R1(발행) ● exclusive + R-XJ(제재·관할·Reg M always-on prefactor, ADR-002). `offeringStatus ≠ COMPLETED`인 동안 매 거래에 걸린다. |
| 의존 | A-04(ONCHAINID 역할판별) · B-01(Manifest·레지스트리 무결성·변경 통제) · A-06(controllerCluster 공급, "indirectly" 확장 — 단 Reg M affiliated purchaser ≠ Rule 144 affiliate) · Operator(제한대상 명단 유지, OD-B1) · F-02(사후 wash-trade 상보) · B-04(엔진/venue 라우팅 — 환매 창구 분리 접점) |

전용 컨트랙트가 없으므로, 차단형 게이트의 온체인 형상은 ERC-3643 `IModule` 규약(발행자가 `addModule`로 토큰에 바인딩, Router의 cumulative AND 체인에서 호출)을 모델로 한다. 판정에 필요한 자산별 사실은 Manifest에만 존재하며(ADR-006 asset-agnostic 불변식), 부품 코드에 자산 상수를 하드코딩하지 아니한다.

## 6. 목표 판정 구조 (게이트 체인)

판정은 다섯 개의 원자 게이트의 결합으로 구성된다. 상장 시점 카드 검사(채널 V)가 전제를 세우고, 거래 전 게이트(채널 G)가 매 거래를 판정한다. deemed-PASS·역방향 완화 경로는 존재하지 아니한다.

- **V1 — 배포 상태 선언 존재.** `offeringStatus`가 `{ONGOING_CONTINUOUS, ONGOING_TRANCHE, COMPLETED}` 중 하나로 선언되어 있어야 한다. 부재 시 판정 불능 → **`REG_M_OFFERING_STATUS_MISSING`** (FAIL, fail-closed).
- **V2 — 예외증권 선언 정합.** `regMExceptionProfile`이 선언되어 있어야 한다. BUIDL = `NONE`(사모펀드 → 예외 미해당). 개방형·exempted 등으로 오선언 시 → **`REVIEW_REGM_EXCEPTION_CONFLICT`** (REVIEW).
- **G① — restricted period 활성.** `offeringStatus ≠ COMPLETED`이면 활성(true). `COMPLETED`이면 비활성 → **`REG_M_NOT_IN_DISTRIBUTION`** (PASS). 상시 발행 자산은 `ONGOING_CONTINUOUS`로 봉인되어 게이트 상시 true.
- **G② — 매수 방향.** 거래가 covered security의 매수/bid인 경우에만 검사 대상. 매도·비대상 방향이면 → **`REG_M_DIRECTION_SELL`** (PASS, F-04 사정권 밖).
- **G③ — 제한대상 주체.** 매수인이 제한대상 집합 `{ISSUER, SELLING_SECURITY_HOLDER, AFFILIATED_PURCHASER, DISTRIBUTION_PARTICIPANT}`에 속하는지 검사한다. "directly or indirectly"를 반영하여, 매수인 ONCHAINID뿐 아니라 그 지갑이 제한대상의 지배·공동행위 하(controllerCluster, A-04·A-06 공급)에 있는지까지 확장한다. 미해당이면 → **`REG_M_NON_RESTRICTED_BUYER`** (PASS).
- **G⑤ — 조문 라우팅.** 매수인 역할이 `{ISSUER, SELLING_SECURITY_HOLDER}`이면 `basis = RULE_102`, `DISTRIBUTION_PARTICIPANT`이면 `basis = RULE_101`. 감사 재구성을 위하여 basis를 이벤트에 기록한다.
- **G④ — 예외 성립(참가자 갈래 한정).** `basis = RULE_101`이고 누적 매수가 대상 증권 ADTV의 2% 미만이며 정책·절차 인증(`regMPoliciesCertified`)이 있으면 de minimis 예외 성립 → **`REG_M_EXCEPTION_APPLIED`** (PASS, 근거 적재). 발행자 갈래(`basis = RULE_102`)에는 de minimis 경로가 없다. 온-DEX 매수 맥락에서 Rule 102(b)의 (2)(ii)·(3)·(6) 예외는 "거래소·ECN 밖" 단서 때문에 대개 불성립하므로 온-DEX 예외 후보는 기본적으로 공집합(`regMExceptionProfile`의 온-venue 프로파일 = `NONE_ON_VENUE`)이다.

**주 판정식(FAIL).** `G① ∧ G② ∧ G③ ∧ ¬G④`이면 위법으로 확정하고 체결 전 차단한다 → **`RESTRICTED_PERIOD_PURCHASE_BLOCKED`** (revert). `basis`는 G⑤가 정한 조문(RULE_102/RULE_101)이다. 제한대상 레지스트리에 미해소 red flag가 있는 상태에서 판정을 시도하면 차단 대신 → **`REG_M_RESTRICTED_SET_UNVERIFIED`** (REVIEW)로 사람 판단에 넘긴다.

## 7. 목표 인터페이스

온체인 앵커는 ERC-3643 `IModule` 규약을 따르는 차단형 게이트로 상정한다. 하우스 규약(`check`)과 ERC-3643 모듈 진입점(`moduleCheck`)을 병기한다. F-03(감시형, 항상 통과)과 달리 F-04는 FAIL 시 `false`를 반환하여 거래를 revert시킨다.

```solidity
// 하우스 규약: 차단형 게이트. FAIL 시 (false, reasonCode).
// ok=false이면 Router가 사유코드와 함께 revert한다.
function check(bytes32 tokenId, address from, address to, uint256 amount)
    external view returns (bool ok, bytes32 reasonCode);

// ERC-3643 IModule 진입점 (canTransfer 경로에서 호출):
//   [offeringStatus != COMPLETED] ∧ [to ∈ restrictedPersonRegistry(해당 갈래)]
//   ∧ [예외 미충족]  → false 반환 → 거래 revert
function moduleCheck(address from, address to, uint256 amount, address token)
    external view returns (bool);

// 감사 앵커(이벤트): 어느 조문 근거로 판정했는지 재구성 가능하게 기록.
event F04Check(bytes32 tokenId, address to, bytes32 basis /* RULE_102 | RULE_101 */,
               bytes32 reasonCode);
```

판정 입력(Manifest.facts 및 레지스트리):

| 필드 | 의미 | 근거 |
|---|---|---|
| `offeringStatus` | 배포 상태(distributionStatus) `{ONGOING_CONTINUOUS, ONGOING_TRANCHE, COMPLETED}` | § 242.100(b) distribution·restricted period |
| `regMExceptionProfile` | 예외증권 프로파일. BUIDL = `NONE` | § 242.102(d)·§ 242.101(c) |
| `legalClassId` · `referenceSecurities` | covered security 클래스 식별·확장(대개 ∅) | § 242.100(b) covered/reference security |
| `restrictedPersonRegistry[tokenId][ONCHAINID]` | 역할 `{ISSUER, SELLING_SECURITY_HOLDER, AFFILIATED_PURCHASER, DISTRIBUTION_PARTICIPANT}` | § 242.100(b)·§ 242.102(a)·§ 242.101(a) |
| `regMInfoBarrierCertified` | affiliated purchaser (3) 안전항(계열 레벨, 연간 갱신) | § 242.100(b)(3) 안전항 |
| `regMPoliciesCertified` · `ADTV` | 참가자 de minimis 예외 조건 | § 242.101(b)(7) |
| `redemptionChannelRef` | 환매 창구 참조(별도 경로, F-04 미관여) | § 242.102(b)(2)(ii)·(3) |
| `stabilizingEnabled` · `regMExemptionRef` | 안정조작·SEC 면제 근거(현행 각각 `false`·∅) | § 242.104·§ 242.102(e) |

## 8. 기능 요구사항 (목표)

- **REQ-F04-1 (차단 게이트).** restricted period 중 제한대상자의 covered security 매수는 체결 전 차단(revert)한다. 본 부품은 표시형이 아니라 관문이다.
- **REQ-F04-2 (활성 — 배포 상태 의존).** `offeringStatus ≠ COMPLETED`(distributionStatus active)인 동안에만 활성이다. `COMPLETED`이면 PASS(`REG_M_NOT_IN_DISTRIBUTION`).
- **REQ-F04-3 (fail-closed).** `offeringStatus` 선언이 부재하면 판정 불능으로 보아 FAIL(`REG_M_OFFERING_STATUS_MISSING`)로 닫는다.
- **REQ-F04-4 (방향 게이트).** covered security의 매수/bid만 검사한다. 매도·비대상 방향은 PASS(`REG_M_DIRECTION_SELL`).
- **REQ-F04-5 (제한대상 판별).** 매수인이 제한대상 집합에 속하지 아니하면 PASS(`REG_M_NON_RESTRICTED_BUYER`).
- **REQ-F04-6 (indirectly 확장).** 매수인 ONCHAINID뿐 아니라 그 지갑이 제한대상의 지배·공동행위 하(controllerCluster, A-04·A-06 공급)에 있는지까지 검사하여 우회 매수를 포착한다.
- **REQ-F04-7 (두 갈래 라우팅).** 매수인 역할이 발행자·매도증권보유자이면 `basis = RULE_102`, distribution participant이면 `basis = RULE_101`로 판정하고, basis를 `F04Check` 이벤트에 기록한다.
- **REQ-F04-8 (예외 — 참가자 de minimis 한정).** `basis = RULE_101` ∧ 누적 매수 < 2% ADTV ∧ `regMPoliciesCertified`일 때만 PASS(`REG_M_EXCEPTION_APPLIED`, 근거 적재)한다. 발행자 갈래(`RULE_102`)에는 de minimis 예외를 적용하지 아니한다.
- **REQ-F04-9 ((3) 안전항).** `regMInfoBarrierCertified = true`인 계열 ONCHAINID는 affiliated purchaser 제한대상에서 제외(미등재)한다. 인증은 연간 갱신하며 만료 시 신선도를 요구한다.
- **REQ-F04-10 (예외증권 정합).** `regMExceptionProfile`이 BUIDL의 실제 법적 성격과 어긋나게(개방형·exempted 등) 선언되면 REVIEW(`REVIEW_REGM_EXCEPTION_CONFLICT`).
- **REQ-F04-11 (레지스트리 미해소).** 제한대상 레지스트리에 미해소 red flag가 있는 상태의 판정 시도는 차단 대신 REVIEW(`REG_M_RESTRICTED_SET_UNVERIFIED`)로 사람 판단에 넘긴다.
- **REQ-F04-12 (환매 경로 분리).** 발행자 측 환매는 F-04 게이트를 타지 아니하는 별도 `redemptionChannel`(agent-role burn/mint, off-venue)로 라우팅한다(B-04 접점, § 242.102(b) 방어선).
- **REQ-F04-13 (역방향 완화 금지).** deemed-PASS 및 면제 존재를 이유로 한 게이트 완화 경로는 없다. 완화 방향 변경은 거버넌스 경로와 법적 근거(`regMExemptionRef`) 등록을 필수로 한다.
- **REQ-F04-14 (anti-fraud 병존).** F-04의 PASS는 Reg M 매수 금지 미해당을 뜻할 뿐 적법 보증이 아니다. 사후 조작·사기 탐지는 별도 모듈(F-02)이 담당하도록 분리 배치한다.

## 9. reasonCode 표

walkthrough §2.3(PASS/FAIL 코드 요약)과 §3.17 표 A(Sub-요건 분해)의 코드를 통합한다.

| reasonCode | 의미 | 성격 | 근거 |
|---|---|---|---|
| `RESTRICTED_PERIOD_PURCHASE_BLOCKED` | restricted period 중 제한대상자의 매수 — 차단 | FAIL (revert) | § 242.102(a) / § 242.101(a) |
| `REG_M_OFFERING_STATUS_MISSING` | 자산 카드에 `offeringStatus` 선언 부재 — 판정 불능 | FAIL (fail-closed) | § 242.100(b) distribution·restricted period |
| `REG_M_RESTRICTED_SET_UNVERIFIED` | 제한대상 레지스트리 미해소 red flag 위 판정 시도 | REVIEW | § 242.100(b) 인적 정의 |
| `REVIEW_REGM_EXCEPTION_CONFLICT` | `regMExceptionProfile` 오선언(개방형·exempted) | REVIEW | § 242.102(d)·§ 242.101(c) |
| `REG_M_NOT_IN_DISTRIBUTION` | 오퍼링 종료·비배포 — Reg M 비적용 | PASS | § 242.100(b) restricted period |
| `REG_M_NON_RESTRICTED_BUYER` | 매수인이 제한대상 아님 | PASS | § 242.102(a)·§ 242.101(a) 주체 요건 |
| `REG_M_DIRECTION_SELL` | 매도·비대상 방향 (F-04 사정권 밖) | PASS | § 242.102(b)(5) 매도 청약 허용 |
| `REG_M_EXCEPTION_APPLIED` | 예외 경로 성립(근거 코드·해시 적재) | PASS + 기록 | § 242.101(b)(7) de minimis 등 |

## 10. 의존성

```
A-04(ONCHAINID)           → 매수인 역할 판별 단위            → F-04 G③
A-06(control cluster)     → "indirectly" 우회지갑 확장(단 정의 상이) → F-04 G③
B-01(Manifest 정합)        → offeringStatus·regMExceptionProfile·레지스트리 무결성 → F-04 V1·V2
Operator(OD-B1)           → 제한대상 레지스트리 유지·(3)안전항 인증        → F-04 G③
F-04(pre-trade gate)  ↔  F-02(post-trade flag)  → 사전 차단 / 사후 탐지 상보(§3.8)
B-04(engine/venue)        → 환매 창구 분리 라우팅(redemptionChannel)      → F-04 경로 밖(§3.7)
Router(cumulative AND)    ← F-04 결과(FAIL이면 revert)                  ← R1·R-XJ
```

경계 주의: A-06(Rule 144 affiliate)의 산출은 Reg M affiliated purchaser와 정의가 다르므로 그대로 재사용하지 아니한다(§3.5). E-01(Form D)과 함께 R1-only.

## 11. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | `offeringStatus = COMPLETED`, 임의 매수 | PASS (`REG_M_NOT_IN_DISTRIBUTION`) |
| 2 | `offeringStatus` 미선언 | FAIL (`REG_M_OFFERING_STATUS_MISSING`, fail-closed) |
| 3 | `ONGOING` + 매도 방향 | PASS (`REG_M_DIRECTION_SELL`) |
| 4 | `ONGOING` + 비제한 매수인의 매수 | PASS (`REG_M_NON_RESTRICTED_BUYER`) |
| 5 | `ONGOING` + ISSUER 매수 | FAIL (`RESTRICTED_PERIOD_PURCHASE_BLOCKED`, basis=RULE_102) revert |
| 6 | `ONGOING` + DISTRIBUTION_PARTICIPANT 매수 | FAIL (동, basis=RULE_101) revert |
| 7 | `ONGOING` + affiliated purchaser 우회지갑(controllerCluster) 매수 | FAIL (indirectly 포착) revert |
| 8 | 참가자 누적 매수 < 2% ADTV + `regMPoliciesCertified` | PASS (`REG_M_EXCEPTION_APPLIED`, 근거 적재) |
| 9 | 발행자(ISSUER) 소액(<2%) 매수 | FAIL (발행자 갈래 de minimis 없음) |
| 10 | `regMInfoBarrierCertified` 계열의 매수 | PASS (제한대상 미등재) |
| 11 | `regMExceptionProfile = OPEN_END` 오선언 | REVIEW (`REVIEW_REGM_EXCEPTION_CONFLICT`) |
| 12 | 제한대상 레지스트리 red flag 미해소 상태 판정 | REVIEW (`REG_M_RESTRICTED_SET_UNVERIFIED`) |
| 13 | 발행자 환매(redemptionChannel 경로) | F-04 미관여(구조적 분리, canTransfer 매수 경로 밖) |

## 12. 잔여 확정 항목

1. 전용 컨트랙트(`RegMDistributionModule`) 및 제한대상 레지스트리·controllerCluster 배선 구현(현재 미구현).
2. `offeringStatus` 상시성의 법적 정밀화 반영(tranche 창 vs 연속 창, OD-F04-6)과 그에 따른 `restrictedWindowEnd` 필요 여부.
3. 예외의 온체인 적용 가능성(permissioned DEX = 거래소·ECN 여부, BD/ATS 성격규명과 결합, OD-F04-2)과 그에 따른 `regMExceptionProfile` 온-venue 프로파일 확정.
4. distribution participant·affiliated purchaser 집합의 확정 및 (3) 안전항 인증 절차(OD-F04-3).
5. 환매 창구 분리 구조의 확정(off-venue NAV 환매, OD-F04-5)과 `redemptionChannelRef` 배선.
6. SEC 면제·no-action 획득 여부에 따른 `regMExemptionRef` 경로(현행 ∅, OD-F04-4).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~2절 (개요·규범적 근거) | 파생 | 보경 walkthrough §1·§2·§3.0 |
| 제3.1절 (사전 게이트·기계 판정) | 파생 | walkthrough §1.1·§3.0.1·§3.8(§242.102(a))·§3.13(§9(a)) |
| 제3.2절 (두 갈래·라우팅) | 파생 | walkthrough §1.2·§3.8(§242.102(a))·§3.9(§242.101(a)) |
| 제3.3절 (상시 발행·restricted period) | 파생 | walkthrough §1.3·§3.4(§242.100(b)) |
| 제3.4절 (covered security) | 파생 | walkthrough §3.3(§242.100(b)) |
| 제3.5절 (affiliated purchaser·A-06 경계) | 파생 | walkthrough §3.5·§3.7(§242.100(b))·§9.1 |
| 제3.6절 (예외 증권 배제) | 파생 | walkthrough §3.11(§242.102(d))·§3.12(§242.101(c)) |
| 제3.7절 (환매 창구 분리) | 파생 | walkthrough §1.4·§3.10(§242.102(b)) |
| 제3.8절 (anti-fraud 병존) | 파생 | walkthrough §3.1(§242.100(a))·§3.14(§10(b)·§9(g)) |
| 제3.9절 (무-시세받치기 한계) | 파생 | walkthrough §3.15(§242.102(e)·§242.104) |
| 제4절 (확정·잔여 쟁점 OD-F04-1~7) | 파생 | walkthrough §3 본문 내 OD-F04 참조 |
| 제5~12절 (목표 구현) | 목표 | walkthrough §2.3·§3.17 표 A + 각 절 "PASS/FAIL 반영"·"ERC-3643 변환" 주석 + `SPEC.md`(패턴 A·Router·Manifest) |

전용 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `F-04_no-purchase-during-distribution.md` (2026-07-21) — 레포 `docs/compliance/elements/` 교체 대상.
- 결정: `ADR-001`(F-04 Reg M 판매중 매수금지, Accepted) · `ADR-002`(R-XJ 횡단 always-on prefactor) · `ADR-006`(부품 asset-agnostic 불변식) — `SPEC.md §11` 인덱스.
- 공유 개념: `SPEC.md` §1(아키텍처)·§2(패턴 A·timing·stateless)·§3(Element 카탈로그 F-04)·§4(R1·R-XJ Recipe).
- 패턴 참조: 차단형 게이트는 ERC-3643 `IModule`(canTransfer 경로) 규약. 표시형 형제 부품(F-02·F-03)과 대조.
- 1차 출처: 15 U.S.C. § 78i(a)(1)·(2)·(6)(Exchange Act § 9(a)) · § 78i(g)(§ 9(g)) · § 78j(b)(§ 10(b)) · § 78c(a)(12)(§ 3(a)(12)) · 15 U.S.C. § 77q(a)(Securities Act § 17(a)) · 17 C.F.R. § 242.100 · § 242.101 · § 242.102 · § 242.104(Regulation M) · Investment Company Act § 3(c)(7) · Anti-manipulation Rules Concerning Securities Offerings, Exchange Act Release No. 34-38067, 62 FR 520 (Jan. 3, 1997).

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 walkthrough(2026-07-21) 기반 초안. 제1부: 사전 예방(prophylactic) 게이트로서 목적 요건 제거(§9(a)(2)→Rule 102)·strict-liability(§3.1) / 두 갈래 금지·라우팅(Rule 102 발행자 / Rule 101 참가자, §3.2) / 상시 발행 restricted period 상시화(§3.3) / covered security 식별(§3.4) / affiliated purchaser 외연과 A-06(Rule 144 affiliate) 정의 상이(§3.5) / 예외 증권 미해당(§3(c)(7) 사모펀드 → Rule 102(d)(4) open-end 미해당, §3.6) / 환매 창구 분리 = Reg M 방어선(Rule 102(b) 거래소·ECN 밖 단서, §3.7) / anti-fraud 병존·PASS 한계(Preliminary Note·§10(b), §3.8) / 무-시세받치기 논거의 분석적 지위와 한계(Rule 102(e)·104, §3.9). 잔여 쟁점 OD-F04-1~7. 제2부: 전용 컨트랙트 미구현 → 목표 규격(게이트 체인 V1·V2·G①~G⑤·주 판정식 / `moduleCheck`·`check` 인터페이스 / REQ-F04-1~14 / reasonCode 8종 / 인수 기준 13). 배포 상태(`offeringStatus`/distributionStatus) 의존·STATELESS 명시.
