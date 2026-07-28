---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: A-12
element-name: Willful Blindness Blocker (모름 항변 차단 / Red Flag Knowledge Bar)
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough."
substance-sot: "보경 walkthrough — A-12_모름항변차단.md (2026-07-21). 레포 docs 교체 대상."
umbrella: "SPEC.md — 공유 개념(Element/Recipe·패턴 C 감시형·on/off-chain 경계·off-chain Layer 5)은 여기에 의한다"
stateful: false
tags: [requirement-spec, A-12, red-flag, willful-blindness, resale-safe-harbor, antifraud, stateless, R2, R4]
---

# A-12 Willful Blindness Blocker (모름 항변 차단) — 요구사항 명세서

본 문서는 컴플라이언스 부품 A-12(모름 항변 차단, Red Flag Knowledge Bar)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의한다. 본 부품은 전용 컨트랙트가 아직 구현되지 아니한 법률 전용(legal-only) 부품이므로, **제2부는 목표 규격(target specification)이며 확정된 실장(實裝)이 아니다.** 표시-비차단(flag-not-block) 온체인 패턴은 동일 계열(패턴 C 감시형)인 형제 부품 `SurveillanceFlag.sol`(F-02) 및 F-03을 참조한다. 시스템 공유 개념(Element/Recipe/Manifest·검증 패턴·on/off-chain 경계)은 `SPEC.md`에 의한다.

본 부품은 자격 증명서를 확인하여 거래를 막는 관문이 아니라, 액면상 유효한 증명서로는 가려지지 않는 객관적 적신호(red flag)를 거래 직전에 스크리닝하여 표시하고, 그 표시를 사람의 판단으로 연결하는 감시 부품이다. 산출물은 "차단"이 아니라 "기록된 주의(documented diligence)"이며, 그 기록이 곧 사후의 모름 항변(willful blindness)에 대한 방어가 된다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

A-12는 재판매·시장행위 국면에서 매도인·매수인·플랫폼이 나중에 "몰랐다"고 항변할 수 없게 만드는 객관적 적신호가 존재하는지를 거래 직전(pre-trade)에 스크리닝하는 부품이다. 본 부품은 미국 증권법의 서로 다른 두 축이 하나의 적신호 감시 설계로 수렴하는 지점에 선다. 하나는 등록 면제(재판매 안전항)를 유지하기 위한 매도인의 합리적 주의 축이고, 다른 하나는 발행·매매 전반의 사기·시세조종을 금지하는 반사기 축이다. 두 축의 공통 원리는 하나다 — 면제·안전항·항변이 행위자의 "합리적 신뢰(reasonable belief)" 또는 "알 만한 이유(reason to know)"에 걸려 있을 때, 객관적 적신호를 무시하면 그 신뢰·항변이 깨진다. A-12는 이 원리를 온체인 pre-trade 스크리닝으로 구현하되, 적신호가 잡히면 거래를 차단하지 아니하고 표시(flag)하여 운영자 검토 큐로 라우팅한다.

## 2. 규범적 근거

**재판매 안전항 축(축 A)**은 발행자·underwriter·dealer 아닌 자의 거래 면제를 정한 증권법 §4(a)(1)(15 U.S.C. § 77d(a)(1))과, 적격투자자 전용 재판매 면제 및 그 요건을 정한 §4(a)(7)·§4(d)(15 U.S.C. § 77d(a)(7)·(d))로 구성되고, 그 배경에는 underwriter(유통 도관)의 정의와 지배관계인 확장을 규정한 §2(a)(11)(15 U.S.C. § 77b(a)(11))이 있다. §4(a)(7) 거래를 §2(a)(11)의 distribution이 아닌 것으로 간주하는 안전항은 §4(e)(1)(B)(15 U.S.C. § 77d(e)(1)(B))가, 매수인이 underwriter가 아님을 보증할 reasonable care와 그 예시인 reasonable inquiry는 Reg D Rule 502(d)(17 C.F.R. § 230.502(d))가 정한다. 적격투자자 검증의 "reasonable steps to verify" 패러다임은 JOBS Act §201(a)(Pub. L. 112-106)와 Rule 506(c)(17 C.F.R. § 230.506(c))에서 나오며, SEC Release No. 33-9415(78 FR 44771, 2013-07-24)가 이를 objective facts-and-circumstances 판단으로 해석한다. 지배관계·affiliate의 정의는 Rule 144·Rule 405(17 C.F.R. § 230.144·§ 230.405)를 A-06 검증분에서 재사용한다.

**사기·시세조종 축(축 B)**은 증권의 발행·매도에서의 사기를 금지하는 §17(a)(15 U.S.C. § 77q(a)), 매매 전반의 기망·부실표시·사기를 금지하는 §10(b) 및 그 실행규칙 Rule 10b-5(15 U.S.C. § 78j(b); 17 C.F.R. § 240.10b-5), 그리고 wash sale·matched order 등 시세조종을 금지하는 §9(a)(15 U.S.C. § 78i(a))로 구성된다. Rule 10b-5 책임에는 고의(scienter)가 요구되나, 미국 순회법원들은 이 scienter에 recklessness(명백한 위험에 대한 고의적 외면, willful blindness)를 포함시켜 왔다. 반면 §17(a)(2)·(3)은 판례상 고의 없이 과실만으로도 성립할 수 있다고 해석되어 왔다. 두 축은 목적·시점·위반의 효과가 다르나, 모두 "객관적 적신호를 무시하면 몰랐다가 통하지 않는다"는 하나의 실행 형태로 수렴한다.

## 3. 쟁점별 논증

### 3.1 두 법적 축이 하나의 적신호 감시 부품으로 수렴하는 이유

성격이 다른 재판매 안전항 축과 사기금지 축이 어떻게 하나의 부품이 되는지가 문제된다. 재판매 안전항 축은 등록 면제의 유지를 위해 매도인이 도관(underwriter)이 아닐 것을 요구하고, 사기금지 축은 매매가 사기·시세조종이 아닐 것을 요구한다. 전자는 면제의 성립 요건을 정의하는 규범이고 후자는 매매행위 자체를 규율하는 책임 규범이므로, 근거 조문도 걸리는 시점도 위반의 효과도 다르다. 그러나 두 축은 실행 메커니즘이 동일하다. 둘 다 특정 임계를 넘으면 자동으로 위법이 확정되는 구조가 아니라, 객관적 적신호를 탐지한 뒤 그 신호가 위법을 뜻하는지의 판단을 사람에게 넘기는 구조를 취한다. 이 동일한 실행 형태 때문에 두 축의 적신호는 하나의 감시 파이프라인(패턴 C)으로 관리되며, A-12는 이 둘을 단일 taxonomy로 정의하여 pre-trade에서 스크리닝한다. 다만 여러 거래에 걸친 시계열·누적 패턴의 추적은 A-12의 소관이 아니며, 상태추적형 부품 F-02·F-03가 담당한다.

### 3.2 모름 항변이 봉쇄되는 이유 — willful blindness와 recklessness

자동화된 거래 인프라에서 "코드가 몰랐다"는 항변이 왜 방패가 되지 못하는지가 문제된다. 등록 면제는 공짜가 아니어서, 사모로 취득한 증권을 대중에게 되파는 도관이 개입하면 결국 등록 없는 공모가 완성된다. 그래서 재판매 면제(§4(a)(1)·§4(a)(7))는 매도인이 §2(a)(11)의 underwriter가 아닐 것을 조건으로 하고, §2(a)(11)의 "issuer"에는 지배관계인(affiliate)이 포함되므로 affiliate의 재판매는 특히 도관 리스크에 노출된다. 한편 사기금지 축에서 Rule 10b-5의 scienter는 recklessness를 포함하는 것으로 해석되어 왔으므로, 명백한 적신호를 감지·처리할 능력이 있었음에도 이를 기계적으로 통과시킨 설계는 그 무지 자체가 reckless로 평가될 여지가 있다. 요컨대 면제·안전항·항변은 행위자가 무엇을 알았거나 알 만했는가라는 상태에 걸려 있고, 법은 그 상태를 판단할 때 객관적 적신호를 외면한 자에게 "몰랐다"를 허용하지 아니한다. 따라서 컴플라이언스 시스템은 자격 서류의 확인만으로 그칠 수 없고, 서류로 가려지지 않는 적신호를 별도로 감시하여야 한다.

### 3.3 차단이 아니라 표시인 이유 — scienter의 비결정성

본 부품이 왜 사전 차단이 아니라 사후 표시에 그치는지가 문제된다. 적신호가 가리키는 위법(underwriter 도관·사기·시세조종)의 성립은 고의·목적·정황·reasonable grounds·reason to know 같은 사람의 판단을 요하는 요소에 걸려 있다. 양측이 같은 실소유 클러스터라는 사실이 실제 위법 자전거래인지, 방금 취득한 물량을 즉시 되판다는 사실이 실제 도관인지, 임계 바로 아래로 주문이 쪼개졌다는 사실이 실제 회피 의도인지는 온체인 코드가 결정론적으로 확정할 수 없다. 코드가 이를 자동으로 위법으로 확정하여 차단하면 두 방향으로 틀린다. 정당한 거래를 막아 별도의 거래방해 책임을 지고, 코드가 할 수 없는 법적 판단을 하는 척하게 된다. 그러므로 본 부품의 올바른 형태는 사전 관문이 아니라 사후 표시이며, 객관적으로 판정 가능한 신호만 기계가 탐지하고 그 신호가 위법을 뜻하는지의 판단은 사람에게 넘긴다. 이 분리가 A-12를 자격 게이트와 근본적으로 다른 종류의 부품으로 만든다.

### 3.4 재판매 축의 적신호가 무엇을 깨뜨리는가

재판매 국면에서 어떤 사실이 안전항을 위태롭게 하는지가 문제된다. Rule 502(d)(1)은 발행자에게, 매수인이 그 증권을 자기를 위하여 취득하는지 아니면 타인을 위하여 취득하는지를 판단하기 위한 reasonable inquiry를 요구한다. 방금 발행받은 물량을 즉시 되파는 매도인이나 사자마자 되팔 정황이 있는 매수인은 이 "타인을 위한 취득"의 적신호이며, 이 신호를 무시하면 규칙이 요구하는 reasonable care가 깨진다. 나아가 §4(d)(3)(K)는 매도인이 control person(affiliate)인 한도에서, 발행자가 증권법령을 위반하고 있다고 믿을 reasonable grounds가 없다는 인증을 요구한다. 이는 교과서적 모름 항변 차단 조항으로서, 적신호가 존재하면 매도인은 위반을 의심할 근거가 생기므로 이 인증을 진정으로 할 수 없다. 또한 §4(d)(1)이 각 매수인의 적격투자자 지위를 요구하고 §4(d)(7)이 그 거래가 underwriter의 재유통이 아닐 것을 요구하므로, 매수인 자격 claim과 모순되는 사실이나 도관 신호는 각각 이 요건들을 위태롭게 한다. 어느 신호도 이 요건을 자동으로 위반으로 만들지는 아니하며, 인증과 안전항이 진정으로 성립하는지를 사람이 확인하라는 표시로 이어진다.

### 3.5 사기·시세조종 축의 적신호가 어떤 규범에서 나오는가

시장행위 국면의 적신호가 어떤 조문에 근거하는지가 문제된다. §17(a)(3)은 매수인에 대하여 사기 또는 기만으로 작용하거나 작용할 수 있는 transaction·practice·course of business를 금지하는데, 이 문언은 매우 넓어서 거래량을 부풀리는 자전거래, 임계를 회피하려는 주문 분할, NAV와 동떨어진 조작적 가격을 포섭한다. Rule 10b-5(c) 역시 매매와 관련하여 사기·기만으로 작용하는 act·practice·course of business를 금지하여 같은 국면을 포괄하고, §9(a)는 wash sale·matched order 등 시세조종을 직접 금지한다. 특히 §17(a)(2)·(3)이 과실만으로도 성립할 수 있다고 해석되어 온 점은, 적신호를 감지·처리할 능력을 갖추고도 방치한 플랫폼의 책임 위험을 키운다. 다만 이 신호들 역시 위법의 확정이 아니라, 사기·기만으로 작용할 수 있는지를 사람이 판단하여야 할 표시일 뿐이며, 임계 수치·패턴은 오직 표시와 REVIEW 라우팅의 입력으로만 쓰이고 위법 확정에는 쓰이지 아니한다.

### 3.6 적신호 감지가 오히려 책임을 키우지 않는가 — audit trail의 방어 기능

적신호를 감지하는 체계를 갖추는 것이 도리어 "알고도 방치했다"는 책임을 부르지 않는지가 문제된다. 결론은 반대이다. 재판매 축의 §4(d)(3)(K)·Rule 502(d)가 요구하는 것은 결과의 보증이 아니라 reasonable grounds·reasonable care·reasonable inquiry라는 합리적 주의의 과정이며, 사기금지 축의 scienter가 recklessness를 포함한다는 것은 곧 적신호를 감지·검토하는 절차 자체가 recklessness를 부정하는 방어가 된다는 뜻이다. A-12가 적신호를 표시하고 운영자 검토로 라우팅하며 그 근거를 기록하는 일련의 절차는 바로 이 합리적 주의의 과정을 구현한다. 따라서 A-12의 진정한 산출물은 "이 거래는 적법하다"는 확정이 아니라 "우리는 위험을 감지했고, 사람이 검토했으며, 그 근거를 남겼다"는 과정의 증거, 곧 reasonable inquiry의 audit trail이다. 오탐이 나오더라도 이 표시는 잘못이 아니다 — 표시의 목적은 위법의 확정이 아니라 사람이 확인하였다는 기록을 남기는 데 있기 때문이다. 위험한 방향은 오탐을 줄이려다 적신호를 아예 보지 않게 되는 것이며, 그것이야말로 willful blindness이다.

### 3.7 본 부품의 책임 경계 — 인접 부품과의 구분

A-12가 인접 자격·감시 부품과 개념이 겹쳐 보여, 어디까지가 본 부품의 소관인지가 문제된다. 붙잡을 원칙은 하나다 — A-12는 판정하지 아니하고, 다른 부품이 만든 판정·사실 사이의 모순·이상을 표시할 뿐이다. 누가 affiliate인가의 질적 판정은 A-06의 소관이며, A-12는 그 결과를 소비하거나 그 결과와 어긋나는 지배관계 징표만 표시하여 A-06 재검토를 트리거한다. 지분율을 A-12의 판정 기준으로 코딩하면 A-06의 bright-line 금지 원칙을 위반한다. 매수인의 적격투자자·적격구매자 자격 검증은 A-03·A-13의 소관이며, A-12는 그 claim을 유효한 것으로 전제하되 거래시점 사실과 모순될 때(reason to question) 표시하여 재확인을 부른다. 실소유 클러스터의 확정은 A-04가, 물량·보유자 임계의 초과(>) 판정은 C-08·D-01이 담당하며, A-12는 임계의 근접과 분할 정황만 표시한다. 시계열·누적 패턴의 STATEFUL 추적은 F-02·F-03의 소관이고, A-12는 이번 한 거래에서 pre-trade로 판정 가능한 정황만 STATELESS로 표시한다. 요컨대 A-12는 여러 부품의 산출을 교차 대조하는 감시 부품이지, 스스로 판정하는 게이트가 아니다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 감시형(flag-not-block) 성격, pre-trade·STATELESS 작동, 두 축을 단일 red-flag taxonomy로 묶는 설계, 그리고 표시·검토·기록이 reasonable inquiry의 audit trail을 형성한다는 목적은 위와 같이 확정되었다. 반면 다음은 확정 또는 후속을 요한다. **첫째**, recklessness의 기준선, 즉 무엇이 reckless인가는 사실관계별 판단이므로 운영 기준으로 고정될 수 없으며 변호사 follow-up 대상이다(walkthrough §12 Open Issue). **둘째**, RF_RESALE_INTENT의 "즉시 전매(immediate flip)" 경계일은 C-01의 보유기간 기준과 조율되어야 하며, 임의로 정하면 경계 거래를 오분류한다(§12 Open Issue). **셋째**, RF_PRICE_ANOMALY의 NAV 괴리 임계와 RF_STRUCTURING의 임계 근접 판단은 자동 차단 규칙이 아니라 REVIEW 라우팅 입력일 뿐이며, 그 운영 기준은 미정이다. **넷째**, DEX 2차 거래 환경이 사실상 공모(public offering)를 유발하는지는 SEC v. Ralston Purina Co., 346 U.S. 119 (1953)의 기능적 기준과 관련된 Recipe-level 쟁점으로서 A-13·Recipe 논의와 연계된다. **다섯째**, 운영자 검토 층과 변호사 escalation 절차의 상세는 walkthrough가 forward-reference(§11·§12)만 두고 본문을 완결하지 아니하였으므로 후속 확정을 요한다. **여섯째**, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였고, 성숙도는 부분(R-3 클러스터에 A-06·F-01과 통합)이다.

---

# 제2부. 구현 명세 (목표 — 전용 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `A-12-v1` (미구현) |
| 분류 | 신원·자격(도메인 A) · 적신호 감시(RED_FLAG_SCREENING) |
| 검증 패턴 | 감시형(패턴 C, MONITORING_BASED) — 표시, 차단 안 함 |
| 판정 시점 | pre-trade (거래 직전 스냅샷 스크리닝) |
| 상태 | STATELESS (거래시점 판정 가능분만; 시계열 누적은 F-02·F-03) |
| 활성 | R2 — 매도인이 affiliate(A-06)일 때 조건부 / R4 — 항상 |
| 의존 부품 | A-06(affiliate)·A-03·A-13·A-11(자격 claim)·A-04(클러스터)·C-01(보유기간)·C-08·D-01(임계)·F-02·F-03(시계열·SAR)·B-01(정합) + 오라클 NAV |

전용 컨트랙트가 없으므로, 표시-비차단 온체인 패턴은 `SurveillanceFlag.sol`(F-02)을 모델로 한다. 실제 스크리닝·판정·검토·기록은 off-chain 컴플라이언스 데이터 레이어(Layer 5)와 운영자 층에서 수행하며, 온체인에는 자격 claim 게이트(Identity Registry의 `isVerified()`)와 별개 layer로서 red-flag 표시(flag event)만 앵커로 남긴다.

## 6. 목표 판정 구조

A-12의 판정은 활성 여부를 먼저 가른 뒤 두 축의 카테고리를 대조하고 disposition을 종합하는 순서로 진행된다. 어떤 경로에서도 BLOCK을 반환하지 아니한다는 점이 자격 게이트와의 결정적 차이다. 아래는 walkthrough §5.2의 스크리닝 로직을 목표 규격으로 옮긴 것이다.

```
function screen_A12(tx, ctx) -> Disposition:
  # 1. 활성 여부 (비활성이면 스크리닝 없음 — fail-fast)
  active_resale = ctx.recipe.R2 and A06.isAffiliate(tx.seller)   # affiliate 매도일 때만
  active_market = ctx.recipe.R4                                   # R4에서 항상
  if not (active_resale or active_market):
    return { disposition: CLEAR, flags: [], note: "A-12 비활성" }

  flags = []

  # 2. 재판매 축 (RESALE) — 다른 부품 결과값의 대조 (임계 비교 아님)
  if active_resale:
    if tx.buyer.acquisitionPurpose in {FOR_OTHERS, UNKNOWN}
       or is_immediate_flip(tx.seller.acquiredAt, now):     # 502(d)(1)·§2(a)(11)·§4(d)(7)
      flags += FLAG_RESALE_INTENT
    if tx.seller.controlPersonCert in {ABSENT, CONTRADICTED}
       or mismatch(A06.result(tx.seller), tx.seller.controlPersonCert):   # §4(d)(3)(K)
      flags += FLAG_CONTROL_UNDISCLOSED
    if reason_to_question(tx.buyer.claim, ctx.trade_time_facts):          # §4(d)(1)·506(c)
      flags += FLAG_AI_INCONSISTENT

  # 3. 시장행위 축 (MARKET_CONDUCT) — R4에서 항상
  if active_market:
    if same_owner_cluster(A04.cluster(tx.buyer), A04.cluster(tx.seller)): # §17(a)(3)·10b-5(c)·§9(a)
      flags += FLAG_WASH_CLUSTER
    if near_threshold(ctx.C08, ctx.D01) and split_pattern(tx.order):      # §17(a)(3)·10b-5(c)
      flags += FLAG_STRUCTURING
    if price_deviates(tx.price, oracle.nav()):                            # §17(a)·10b-5·§9(a)
      flags += FLAG_PRICE_ANOMALY
    if other_objective_flag(tx, ctx):                                     # §17(a)(3)·10b-5(c)
      flags += FLAG_SUSPICIOUS_PATTERN

  # 4. 종합·라우팅 (차단 없음)
  if flags == []:               return { disposition: CLEAR }
  if ambiguous(flags):          return { disposition: REVIEW, code: REVIEW_REDFLAG_UNCERTAIN, flags }
  return { disposition: REVIEW, flags }        # FLAG 기록 + 운영자 큐 (BLOCK 아님)
```

`is_immediate_flip`·`reason_to_question`·`mismatch`는 임계 비교가 아니라 정황 대조이며, 실제 위법 여부(실제 도관인가, 실제 모순인가)의 판단은 사람이 한다. 스크리닝 시점 스냅샷은 `screenedAt = block.timestamp`로 기록한다.

## 7. 목표 인터페이스 (flag-not-block)

```solidity
// ERC-3643 IModule 훅 (pre-trade). 감시형이므로 항상 통과.
function moduleCheck(address from, address to, uint256 value, address compliance)
    external view returns (bool);          // 항상 true — A-12는 거래를 차단하지 아니한다

// A-12 스크리닝 (target). 온체인은 표시만, 판단은 off-chain 운영자.
enum Disposition { CLEAR, FLAG, REVIEW }   // BLOCK 없음
enum Axis        { RESALE, MARKET_CONDUCT }

function screen(TradeContext calldata ctx)
    external returns (Disposition disp, bytes32[] memory reasonCodes);

// 표시는 off-chain 검토 큐로 라우팅되는 앵커 이벤트로만 온체인에 남는다.
event RedFlagRaised(
    bytes32 indexed txRef,
    bytes32 reasonCode,     // 아래 §9 reasonCode 집합
    Axis    axis,           // RESALE | MARKET_CONDUCT
    uint256 screenedAt      // block.timestamp 스냅샷
);
```

`moduleCheck`는 감시형 원칙상 항상 `true`를 반환하여 거래를 되돌리지 아니한다. 실제 red-flag 대조는 off-chain(Layer 5)에서 다른 부품의 결과값을 입력받아 수행하며, 온체인에는 `RedFlagRaised` 앵커만 남긴다. 당사자 노출 메시지와 내부 기록은 엄격히 분리한다(§10, non-tipping).

## 8. 기능 요구사항 (목표)

- **REQ-A12-1 (비차단).** 온체인 판정은 항상 통과한다. 본 부품은 거래를 되돌리지 아니하며, disposition은 `{CLEAR, FLAG, REVIEW}`에 한하고 BLOCK을 반환하지 아니한다.
- **REQ-A12-2 (활성 조건).** R2에서 매도인이 affiliate(A-06 결과)일 때 재판매 축을 활성화하고, R4에서 시장행위 축을 항상 활성화한다. 둘 다 비활성이면 CLEAR로 종료한다.
- **REQ-A12-3 (재판매 축 스크리닝).** RF_RESALE_INTENT(§2(a)(11)·§4(d)(7)·Rule 502(d)(1))·RF_CONTROL_UNDISCLOSED(§4(d)(3)(K))·RF_AI_INCONSISTENT(§4(d)(1)·506(c))를 다른 부품의 결과값 대조로 평가한다.
- **REQ-A12-4 (시장행위 축 스크리닝).** RF_WASH_CLUSTER(§17(a)(3)·10b-5(c)·§9(a))·RF_STRUCTURING·RF_PRICE_ANOMALY·RF_SUSPICIOUS_PATTERN(§17(a)·10b-5)을 거래시점 판정 가능분에 한하여 평가한다.
- **REQ-A12-5 (임계 비확정성).** 어떤 임계 수치·패턴도 자동 PASS/FAIL 규칙으로 쓰지 아니한다. 수치·패턴은 오직 표시와 REVIEW 라우팅의 입력이며, 위법의 확정에 쓰지 아니한다.
- **REQ-A12-6 (결과값 소비, 재실사 금지).** 본 부품은 새로운 실사를 수행하지 아니하고, A-06·A-03·A-13·A-11·A-04·C-08·D-01의 산출과 오라클 NAV·off-chain attestation을 대조하여 모순·이상만 포착한다. affiliate·자격을 스스로 판정하지 아니한다(A-06 bright-line 금지 준수).
- **REQ-A12-7 (audit trail).** FLAG·REVIEW 시 `RedFlagRaised` 앵커와 대조 근거를 기록하여 reasonable inquiry의 audit trail을 형성한다. FLAG가 표시되었는데 운영자 검토 기록 없이 거래가 완결되면 B-01이 audit alert를 발생시킨다.
- **REQ-A12-8 (라우팅, 비결정).** FLAG·REVIEW는 Decipher Trust Operations 검토 큐로 라우팅한다. 거래의 진행 또는 suspend는 Recipe 정책과 운영자가 결정하며, A-12는 신호와 기록만 제공한다.
- **REQ-A12-9 (메시지 분리 · non-tipping).** 당사자에게는 중립적 문구("추가 검토 중")만 노출하고, 어떤 적신호가 어떤 근거로 잡혔는지는 노출하지 아니한다. 카테고리·근거·대조 데이터·운영자 판단은 내부 기록에만 상세히 남긴다.
- **REQ-A12-10 (STATELESS · 비권위).** 이번 한 거래의 스냅샷만 판정하며, 여러 거래에 걸친 시계열 패턴은 F-02·F-03로 연계한다. A-12의 표시는 다른 부품의 gating 근거가 되는 권위 상태를 형성하지 아니한다.
- **REQ-A12-11 (경계 준수).** A-06의 affiliate 판정과 A-03·A-13의 자격 판정을 뒤집지 아니하고, 모순 시 재검토 트리거만 발생시킨다.

## 9. 표시(flag) reasonCode

walkthrough §6.2 표시 코드 표를 목표 규격으로 옮긴다. 모든 코드는 disposition을 FLAG 또는 REVIEW로 만들 뿐 BLOCK을 만들지 아니한다.

| 코드 | 축 | 뜻 | 후속 |
|---|---|---|---|
| `FLAG_RESALE_INTENT` | RESALE | 도관·재유통 정황 (§2(a)(11)·§4(d)(7)·Rule 502(d)(1)) | Rule 502(d) reasonable inquiry 수행·기록 |
| `FLAG_CONTROL_UNDISCLOSED` | RESALE | §4(d)(3)(K) 인증 부재·모순 | 인증 진정성 확인, 필요 시 A-06 재검토 |
| `FLAG_AI_INCONSISTENT` | RESALE | 자격 claim과 거래시점 사실의 모순 (§4(d)(1)·506(c)) | A-03·A-13 재확인 트리거 |
| `FLAG_WASH_CLUSTER` | MARKET_CONDUCT | 양측 동일 실소유 클러스터 (자전거래 정황) | F-02 시계열 검토 연계 |
| `FLAG_STRUCTURING` | MARKET_CONDUCT | 임계 회피 쪼개기 정황 | C-08·D-01 맥락에서 의도 검토 |
| `FLAG_PRICE_ANOMALY` | MARKET_CONDUCT | NAV 대비 가격 이탈 | 괴리 사유 확인 |
| `FLAG_SUSPICIOUS_PATTERN` | MARKET_CONDUCT | 기타 위험 패턴 | F-03 SAR 판단 연계 |
| `REVIEW_REDFLAG_UNCERTAIN` | 공통 | 자동 분류 애매 | 운영자 큐 직행, 근거 기록 |

## 10. 불변식

1. 본 부품은 거래를 차단하지 아니한다(disposition에 BLOCK 없음).
2. 코드는 객관 신호를 표시할 뿐, 위법(도관·사기·시세조종)을 확정하지 아니한다.
3. 어떤 임계 수치도 자동 PASS/FAIL 규칙이 아니라 REVIEW 라우팅 입력이다.
4. A-12는 affiliate·자격·클러스터·임계 초과를 스스로 판정하지 아니하고, 각 소관 부품의 결과를 소비·대조한다.
5. 당사자에게 적신호의 내용·근거를 노출하지 아니한다(non-tipping).
6. FLAG가 있는데 검토 기록이 없는 것은 그 자체가 willful blindness 리스크이므로 audit alert 대상이다.

## 11. 의존성

```
A-06(affiliate 판정)     → R2 활성 판단 · RF_CONTROL_UNDISCLOSED 재검토 트리거
A-03·A-13·A-11(자격 claim) → RF_AI_INCONSISTENT 재확인 트리거
A-04(신원 dedup 클러스터)  → RF_WASH_CLUSTER → F-02(시계열)
C-01(보유기간)            → RF_RESALE_INTENT "즉시 전매" 경계 조율
C-08·D-01(임계)          → RF_STRUCTURING 맥락(넘김 판정은 저들 소관)
오라클 NAV               → RF_PRICE_ANOMALY 대조 기준가
F-02·F-03(시장감시)       → 시계열 확장 · SAR 판단 연계
B-01(Manifest 정합)      → FLAG인데 검토기록 없으면 audit alert
Operator(Trust Operations) → FLAG·REVIEW 검토 큐 · reasonable inquiry 기록
```

## 12. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 비-affiliate 매도 + R4 무신호(자기계산 매수·클러스터 상이·NAV 근처·임계 원거리) | CLEAR, flags=[], 온체인 통과 |
| 2 | affiliate 매도 + 3일 전 취득 + 매수목적 FOR_OTHERS | FLAG_RESALE_INTENT → REVIEW (차단 없음) |
| 3 | 임계 바로 아래 반복 분할(개별 게이트는 PASS) | FLAG_STRUCTURING → REVIEW ("넘김" 판정 아님) |
| 4 | 양측 동일 실소유 클러스터 | FLAG_WASH_CLUSTER → REVIEW, F-02 연계 |
| 5 | Test 4가 실은 동일인 hot→cold 자기이전(오탐) | 표시 유지, 운영자 CLEAR + 근거 기록 |
| 6 | (d)(3)(K) 인증 부재 또는 A-06과 불일치 | FLAG_CONTROL_UNDISCLOSED → REVIEW, A-06 재검토 |
| 7 | 매수인 claim과 거래시점 사실 모순 | FLAG_AI_INCONSISTENT → REVIEW, A-03·A-13 재확인 |
| 8 | FLAG인데 운영자 검토 기록 없이 체결 | B-01 audit alert (willful blindness 리스크) |
| 9 | 어떤 적신호든 발생 | 온체인 BLOCK 미발생(불변식 1) |

## 13. Demo 및 Production 범위

| 구분 | Demo | Production |
|---|---|---|
| 스크리닝 | 두 축·7 카테고리 개념 시연 | 결과값 대조 로직 + off-chain Layer 5 통합 |
| 임계·경계 | 고정 데모 값 | "즉시 전매" 경계일(C-01 조율)·NAV 괴리·구조화 근접 운영 기준 |
| 표시·기록 | off-chain 데모 로그 | flag event 앵커 + reasonable inquiry audit trail(WORM) |
| 검토 | 개념 시연 | Trust Operations 큐 + 변호사 escalation 절차 |
| 기밀 | 온체인 비노출 원칙 | non-tipping 운영 절차(당사자/내부 메시지 분리) |

## 14. 잔여 확정 항목

1. 전용 컨트랙트·스크리닝 로직 구현(현재 미구현, 성숙도 부분 — R-3 클러스터 통합).
2. RF_RESALE_INTENT의 "즉시 전매" 경계일 기준 — C-01 보유기간과 조율(walkthrough §12 Open Issue).
3. recklessness 기준선(무엇이 reckless인가)과 RF_PRICE_ANOMALY·RF_STRUCTURING 라우팅 임계의 운영 기준.
4. DEX 2차 거래의 공모 유발 여부(SEC v. Ralston Purina Co. 기능적 기준, A-13·Recipe-level 연계).
5. 운영자 검토 층과 변호사 escalation 절차의 상세(walkthrough §11·§12 forward-reference 미완).
6. 데이터 필드·ONCHAINID 구조 확정(현재 예시 스펙 — 구현 시 확정).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~2절 (개요·규범적 근거) | 파생 | 보경 walkthrough §1·§2·§3.0~§3.11 |
| 제3.1~3.7절 (쟁점별 논증) | 파생 | 보경 §1.2~§1.4·§3.1~§3.8·§5.5·§8.2~§8.3·§9.1·§9.6 |
| 제4절 (확정·잔여 쟁점) | 파생 | 보경 §3.9·§5.4·§12(forward-ref) + SPEC.md 성숙도 |
| 제5·6·7절 (시스템 위치·판정 구조·인터페이스) | 목표 | 보경 §2·§4·§5.2 + SPEC.md 패턴 C·§2 + F-02 패턴 |
| 제8절 (기능 요구사항) | 목표 | 보경 §5·§6·§9 논증의 요구사항화 |
| 제9절 (reasonCode) | 파생 | 보경 §6.2 표시 코드 표 |
| 제10~13절 (불변식·의존성·인수기준·범위) | 목표 | 보경 §7·§9.2 + SPEC.md §10 |

전용 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `A-12_모름항변차단.md` (2026-07-21) — 레포 `docs/compliance/elements/` 교체 대상.
- 패턴 참조: 패턴 C(감시형, flag-not-block) — `SurveillanceFlag.sol`(F-02)·F-03 스펙.
- 공유 개념: `SPEC.md` §1·§2·§6·§7 (Element/Recipe/Manifest·검증 패턴 A/B/C·on/off-chain 경계·off-chain Layer 5).
- 1차 출처(재판매 안전항 축): 15 U.S.C. § 77b(a)(11) · § 77d(a)(1)·(a)(7)·(d)·(e)(1)(B) · 17 C.F.R. § 230.502(d) · § 230.506(c) · § 230.144 · § 230.405 · JOBS Act § 201(a) (Pub. L. 112-106) · SEC Release No. 33-9415 (78 FR 44771, 2013-07-24).
- 1차 출처(사기·시세조종 축): 15 U.S.C. § 77q(a) · § 78i(a) · § 78j(b) · 17 C.F.R. § 240.10b-5.
- 판례: SEC v. Ralston Purina Co., 346 U.S. 119 (1953) (public offering 기능적 기준) · recklessness를 10b-5 scienter로 인정해 온 미국 순회법원 판례군(willful blindness — 정확한 기준선은 사실관계별 판단).

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 검토본(2026-07-21) 기반. 제1부: 두 축(재판매 안전항 §2(a)(11)·§4(a)(1)·§4(a)(7)+§4(d)·§4(e)(1)(B)·Rule 502(d) + 사기금지 §17(a)·§10(b)/Rule 10b-5·§9(a)) 수렴 · willful blindness(recklessness=scienter, §17(a)(2)·(3) 과실 성립) · 차단 아닌 표시(scienter 비결정성) · reasonable inquiry audit trail = 방어 · 인접 부품(A-06·A-03/A-13·A-04·C-08/D-01·F-02/F-03) 경계. 제2부: 전용 컨트랙트 미구현 → 목표 규격(disposition CLEAR/FLAG/REVIEW·BLOCK 없음 · 8종 reasonCode · pre-trade STATELESS · 패턴 C · moduleCheck 항상 통과 · RedFlagRaised 앵커 · non-tipping). Open issue: "즉시 전매" 경계일(C-01 조율) · recklessness 기준선 · 공모 유발(Ralston Purina) · 운영자/변호사 층(§11·§12 미완).
