---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: C-00
element-name: Resale Path Selector (재판매 경로 선택 / 전매 경로 선택기)
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough."
substance-sot: "보경 walkthrough — C-00_resale-path-selector.md (2026-07-08). 레포 docs 교체 대상."
umbrella: "SPEC.md — 공유 개념(Element/Recipe/Manifest·결정론 경계·존재 vs 충족·R2 라우팅)은 여기에 의한다"
stateful: false
tags: [requirement-spec, C-00, resale-path-selector, rule-144, section-4a7, reg-s, rule-144a, router, stateless, R2]
---

# C-00 Resale Path Selector — 요구사항 명세서

본 문서는 컴플라이언스 부품 C-00(재판매 경로 선택기)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의한다. 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로 제2부는 목표 규격이며, 판정 구조·인터페이스·요구사항·사유코드는 walkthrough가 서술한 라우팅 로직을 구현 언어로 옮긴 목표치이다. 시스템 공유 개념(Element·Recipe·Manifest·온·오프체인 결정론 경계)은 `SPEC.md`에 의한다.

본 부품은 자격을 판정하는 관문이 아니라, 이미 발행된 제한증권(restricted security)의 재판매 거래에 대하여 어떤 등록면제 경로가 열려 있는지를 거래 직전에 열거하고 그중 하나를 결정론적으로 확정하여 하류 부품으로 라우팅하는 선택기이다. 답은 통과/거절이 아니라 경로 이름이다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

C-00은 재판매 Recipe(R2)의 최초 부품으로서, 하나의 재판매 거래에 대하여 미국 증권법상 열려 있는 등록면제 경로 — Rule 144, § 4(a)(7), Rule 144A, Regulation S Rule 904 — 를 존재 수준에서 판정하고, 그중 단일 경로를 확정한 뒤 그 경로가 요구하는 하류 검사 부품으로 라우팅한다. 본 부품의 성격은 다른 신원·자격 부품과 다르다. 적격투자자 판정(A-03)이나 적격구매자 판정(A-13)이 "이 사람이 자격이 있는가"라는 예·아니오 물음에 답하는 데 반하여, 본 부품은 "이 거래에 열린 문이 몇 개이고 그중 어느 문으로 나갈 것인가"라는 물음에 경로 이름으로 답한다. 미국 증권법의 재판매 규제가 단일 관문이 아니라 근거법과 요건이 서로 다른 복수의 독립 면제로 구성되어 있으므로, 어느 경로를 선택하느냐에 따라 뒤이어 작동할 검사 자체가 달라진다. 경로를 고르지 아니하고는 어느 요건을 검사하여야 하는지조차 정할 수 없다. 이것이 본 부품이 재판매 검사 사슬의 첫머리에 서는 이유이다(walkthrough § 1.1·§ 1.3).

본 부품은 판단하지 아니하고 라우팅한다. 각 경로의 요건이 실제로 충족되었는지는 전부 하류 부품에 위임하며(§ 1.6), 본 부품 자체는 상태를 누적하지 아니하는 STATELESS 부품이다. 현재 자산 명세(Manifest)의 활성 경로는 Rule 144 단일 경로이다(`enabledPaths = {RULE144}`). 나머지 세 경로는 명세상 완비되어 있으나, 그 개방이 후술하는 잔여 쟁점의 해소에 종속되어 있어 현재는 비활성이다(§ 2 메타 박스).

## 2. 규범적 근거

본 부품의 규범적 출발점은 1933년 증권법 § 5(15 U.S.C. § 77e(a))이다. 동조는 유효한 등록신고서가 없는 한 "any person"의 증권 매도(sale)를 전면 금지하며, 그 수범자를 발행자에 한정하지 아니한다. 따라서 이미 발행된 증권을 되파는 보유자도 문언상 § 5의 사정권 안에 있고, 그 재판매가 적법하려면 등록 또는 면제가 있어야 한다(walkthrough § 3.1). 재판매 규제의 핵심 개념인 underwriter 정의(§ 2(a)(11); 15 U.S.C. § 77b(a)(11))는 "배포할 목적으로(with a view to distribution) 발행자로부터 매수한 자"를 넓게 포섭하며, 그 목적이 매수인의 내심에 관한 것이어서 온체인에서 직접 확인될 수 없다는 점이 이하 모든 면제 규칙의 존재 이유가 된다.

이 비결정성을 결정론적 대체지표로 치환한 것이 네 개의 재판매 면제이다. 첫째, Rule 144(17 C.F.R. § 230.144)는 보유기간·물량·거래방법 등 구체적 기준을 충족하면 매도인을 "underwriter가 아닌 것으로 간주"하는 안전항으로서, § 4(a)(1)(15 U.S.C. § 77d(a)(1))로 들어가는 문이다. 그 Preliminary Note는 비배타성과 회피계획 배제를, (a)항은 affiliate·restricted securities 정의를, (b)항은 비계열자·계열자 조건 배분을, (c)~(h)항은 여섯 개 조건을, (i)항은 shell 발행자 배제를 각각 규정한다. 둘째, § 4(a)(7)·(d)·(e)(15 U.S.C. § 77d(a)(7)·(d)·(e))는 2015년 FAST Act § 76001(Pub. L. 114-94)이 신설한 제정법 면제로서, 적격투자자 상대 재판매를 여덟 개의 성문 요건으로 규율한다. 셋째, Rule 144A(17 C.F.R. § 230.144A)는 적격기관투자자(QIB) 간 거래를 별도 안전항으로 다룬다. 넷째, Regulation S Rule 904(17 C.F.R. § 230.904)는 Rule 902(§ 230.902)의 정의와 결합하여 역외 재판매를 § 5의 적용 밖으로 두며, Rule 905(§ 230.905)는 그 취득분의 제한증권 지위 유지를 규정한다.

이에 더하여 본 부품의 발동 근거인 Rule 502(d)(17 C.F.R. § 230.502(d))는 Regulation D 취득 증권의 재판매 제한을, Rule 270.2a51-1(g)(1)(17 C.F.R. § 270.2a51-1(g)(1))은 QIB의 적격구매자 간주를, § 12(a)(1)(15 U.S.C. § 77l(a)(1))은 § 5 위반 시 매수인의 원상회복(rescission) 청구권을 각각 규정한다. 배경 법리로 SEC v. Ralston Purina Co., 346 U.S. 119 (1953)이 공모의 기능적 기준을 제시하며, Reg ATS Rule 300·301(17 C.F.R. § 242.300·.301)은 2차 거래 venue의 등록·운영 전제를 정한다. 이상은 walkthrough § 3.0.2 표 1(Authority 목록)이 1차 출처와 함께 정리한 근거이며, 인용은 uscode.house.gov(제정법)·eCFR(연방규칙)·sec.gov(SEC Release·C&DI)·govinfo.gov(판례·Public Law)의 현행본을 기준으로 한다.

## 3. 쟁점별 논증

### 3.1 발행 단계의 면제가 재판매 단계로 이전되는지

본 자산이 Rule 506(c)로 발행되었다는 사실이 그 재판매까지 면제하는지가 문제된다. Rule 506(c)는 일반청약을 허용하는 발행 면제이므로, "광고가 허용된 발행이니 거래소에서도 자유롭게 유통될 수 있다"는 오해가 발생한다. 그러나 § 4는 "exempted transactions"라는 제목이 보이듯 증권이 아니라 거래를 면제하며, 발행이라는 거래의 면제는 그 뒤에 일어나는 재판매라는 별개의 거래에 아무런 면제도 부여하지 아니한다. Rule 502(d)는 Regulation D로 취득된 증권이 § 4(a)(2) 거래로 취득된 증권과 같은 지위를 가지며 등록 또는 면제 없이는 재판매될 수 없다고 못박는다. 나아가 일반청약 허용은 이전되지 아니한다. § 4(a)(7)(d)(2)의 일반청약 금지는 "seller"에게 걸리는 규범인바, 여기서 seller는 발행자가 아니라 재판매하는 보유자이므로, 발행 단계에서 아무리 광고하였더라도 재판매 단계의 매도인은 다시 침묵하여야 한다. 두 조항은 서로 다른 행위자에게 걸린 서로 다른 규범이어서 상쇄되지 아니한다. 따라서 발행 면제와 재판매 면제는 준별되며, 재판매 시도마다 별도의 면제 경로가 새로 확정되어야 한다. 이 준별이 본 부품이 재판매 거래마다 호출되는 이유이다(walkthrough § 1.4). 이 결론은 공개 호가창이 매도인 측 일반청약으로 읽힐 위험, 곧 § 4(a)(7) 경로의 개방 여부와 직결되므로 후술 § 3.4·§ 3.5와 연결된다.

### 3.2 본 부품이 판정하는 것의 범위 — 존재 수준과 충족 수준

본 부품이 각 경로의 요건 충족까지 판정하여야 하는지가 문제된다. 재판매 면제의 심사는 두 층으로 나뉜다. 존재(existence) 수준은 "이 경로가 이 거래에 대하여 원천적으로 닫혀 있는가"를 거래 시점의 정적 사실만으로 확정하는 조회이고, 충족(satisfaction) 수준은 "그 경로의 요건을 이 거래가 실제로 만족하는가"를 상태·이력·누적으로 판단하는 계산이다. 본 부품은 존재 수준만 본다. 그 이유는 세 가지이다. 첫째, 책임 경계의 관점에서, 본 부품이 보유기간까지 계산하면 C-01과 로직이 이중화되어 같은 법이 두 곳에서 갈라진다. 둘째, 비용의 관점에서, 존재 검사는 조회 몇 번으로 끝나지만 충족 검사는 lot 순회와 rolling window를 요하므로 값싼 검사로 먼저 걸러야 한다. 셋째, 법리의 관점에서, 경로 선택은 "어느 조문 체계로 이 거래를 평가할 것인가"라는 선결 문제로서 요건 충족 판단보다 논리적으로 앞선다. 그러므로 보유기간(C-01)·물량한도(C-08)·적격투자자(A-03)·적격구매자(A-13)·affiliate 실질(A-06)의 판단은 전부 하류에 위임되고, 본 부품은 그 존재만을 스크리닝한다(walkthrough § 1.6·§ 3.9). 이 한정이 제2부 판정 구조와 하류 위임 목록의 설계 원리가 된다.

### 3.3 재판매 경로가 배타적인지 병존하는지

본 부품이 첫 번째로 매치되는 경로에서 멈추어도 되는지가 문제된다. Rule 144 Preliminary Note는 Rule 144가 배타적 안전항이 아니며, 그 조건을 충족하지 못하는 자라도 다른 이용 가능한 면제를 주장할 수 있다고 명시한다. 같은 취지가 Rule 144A Preliminary Note 및 § 4(e)(2)("shall not be the exclusive means")에도 반복되어, 세 조문이 동일한 원리를 진술한다. 이는 경로들이 상호 배타적이지 아니하고 병존한다는 것을 뜻한다 — 하나가 닫혀도 다른 경로가 열려 있을 수 있고, 복수가 동시에 열려 있을 수도 있다. 그 결과 본 부품은 첫 매치에서 멈추어서는 아니 되며, 열린 경로를 전부 후보 집합으로 열거한 뒤 그중 하나를 확정하는 2단 구조를 취하여야 한다. 만약 경로가 배타적이라면 후보 집합도 우선순위도 불필요하겠으나, 비배타성 때문에 열거와 확정이 분리된다(walkthrough § 3.6). 다만 같은 Preliminary Note의 회피계획(plan or scheme to evade) 배제는 "series of transactions"라는 문언이 시사하듯 단일 거래가 아니라 패턴을 대상으로 하므로, 스냅샷만 보는 본 부품이 아니라 사후 감시(R4)의 소관이다.

### 3.4 보수적 기본 경로를 무엇으로 둘 것인지

네 경로가 모두 개방 가능함에도 현재 Rule 144 단일 경로만을 활성화한 것이 정당한지가 문제된다. Rule 144(b)(1)(ii)에 따르면, 비보고 발행자의 증권을 비계열 매도인이 자기 계산으로 매도하는 경우 요구되는 조건은 (d) 보유기간 하나뿐이며, 그 대신 보유기간이 1년으로 연장된다. 곧 "조건 하나, 시간 두 배"의 구조이다. 이 경로의 결정적 특성은 venue 설계에 아무런 제약도 부과하지 아니한다는 점이다. § 4(a)(7)은 매도인 측 일반청약을 금지하여 공개 호가창과 충돌하고, Rule 144A는 매수인에게 144A 원용 사실 고지를 요구하며, Reg S Rule 904는 미국 내 판촉 금지와 매수인 소재지 확인을 요구한다. 이에 반하여 Rule 144 비계열 경로는 — 발행자가 shell만 아니라면 — 오직 시간만을 요구하고, 시간은 온체인이 가장 정확하게 아는 값이다. 따라서 매도인 측 규범의 제약이 가장 적은 Rule 144 비계열 경로를 보수적 기본값으로 두는 것은 법리적으로 정당하다(walkthrough § 1.4·§ 3.8·§ 5.3). 나머지 세 경로의 개방은 각기 별도의 정책·사실 확인을 전제로 하므로 현재 비활성으로 둔다.

### 3.5 Rule 144(i) shell 배제가 기본 경로를 위협하는지, 그리고 § 4(a)(7)이 더 안전한지

Rule 144를 유일 활성 경로로 둔 선택이 Rule 144(i)의 shell 배제로 무너질 위험이 있는지가 문제된다. Rule 144(i)(1)(i)는 (A) 영업이 없거나 명목적이고 (B) 자산이 오로지 현금 및 현금성자산으로 구성되는 발행자의 증권에 대하여 Rule 144 자체를 이용 불가로 만든다. 토큰화 국채·MMF형 펀드의 자산은 회계상 통상 현금성자산으로 분류되므로 (B)가 성립할 소지가 크고, (A)와 (B)는 "and"로 연결된 결합 요건이어서 "운용 활동이 operations에 해당한다"는 점으로 (A)를 부정하여 방어하여야 한다. 그러나 운용 중인 투자펀드에 (i)를 적용한 선례가 알려진 바 없다는 사정은 "적용되지 아니한다"는 확정과 같지 아니하며, (i)(1)(ii)의 "과거 어느 때라도" 조항은 설립 직후 자금 모집 전 기간의 상태를 근거로 영구 배제를 낳을 수 있는데 비보고 사모 펀드에는 § 230.144(i)(2)의 구제 경로가 열려 있지 아니하다. Rule 144가 유일 활성 경로인 이상 이 위험은 부품이 아니라 제품의 위험이 된다. 반면 § 4(a)(7)의 shell 배제(§ 77d(d)(6))는 문언이 다르다 — 기준이 자산·영업의 규모가 아니라 "특정한 사업계획 또는 목적"의 존부이므로, 국채 포트폴리오를 운용하여 수익을 배분한다는 것은 명백히 specific business plan에 해당한다. 즉 § 4(a)(7)이 shell 리스크에서 Rule 144보다 구조적으로 안전하며, 이는 § 4(a)(7) 개방을 지지하는 강한 논거가 된다(walkthrough § 3.10·§ 3.0.1). 이 위험과 대조는 각각 잔여 쟁점 OD-C00-2, OD-C00-1로 표면화된다.

### 3.6 계열자에 대하여 Rule 144 경로가 실질적으로 열려 있는지

계열자 매도인에게도 Rule 144 경로를 후보로 제시하여야 하는지가 문제된다. Rule 144(b)(2)는 계열자 매도에 대하여 "본조의 조건 전부(all of the conditions of this section)"를 요구한다. 여기에는 (c) 현재 공개정보가 포함되고, 비보고 발행자면 (c)(2)에 따라 § 240.15c2-11 수준의 정보가 공개적으로 이용 가능하여야 하는데, 사모 펀드가 그 정보를 공개하는 일은 정의상 드물다. 여기에 (f) 거래방법 제한 — 브로커 거래·마켓메이커·riskless principal 중 하나 — 이 겹치는바, 셋 모두 등록 브로커·딜러를 전제하므로 등록 BD가 없는 venue에서는 어느 채널도 성립하지 아니한다. 이 두 조건은 lot 상태와 무관한 정적 사실이므로 존재 수준에서 판정 가능하고, 그 결과 계열자에게 Rule 144는 사실상 닫혀 있다. 이는 결함이 아니라 계열자의 매도가 구조적으로 distribution을 닮았다는 § 2(a)(11) 후단(지배·피지배·공통지배 포섭)의 귀결이다. 따라서 본 부품은 계열자 플래그(A-06)와 공개정보·거래방법 채널의 존부를 읽어 계열자 Rule 144 후보를 존재 수준에서 제거한다(walkthrough § 3.8·§ 3.9). 등록 BD·ATS 지위가 확정되면 (f)가 열리므로 이 폐쇄는 OD-C00-2와 연동한다.

### 3.7 이른바 "§ 4(a)(1½)"을 기계 라우팅에 포함할 것인지

§ 4(a)(2) 유추로 형성된 이른바 "§ 4(a)(1½)" 경로를 본 부품의 경로 집합에 포함하여야 하는지가 문제된다. § 4(a)(2)는 문언상 그 주체가 발행자이므로 재판매하는 보유자가 직접 원용할 수 없고, 실무는 "발행자가 사모로 팔 수 있다면 보유자도 같은 조건이면 사모로 되팔 수 있어야 한다"는 유추를 판례·SEC 실무·의견서로 쌓아 왔을 뿐이다. 이 경로를 기계 라우팅에서 제외하는 이유는 세 가지이다. 첫째, Rule 144나 § 4(a)(7)과 달리 요건이 성문으로 열거되어 있지 아니하여 코드로 옮길 목록이 없다. 둘째, 매수인의 sophistication·정보 접근·매수 목적을 종합하여 사후에 전체적으로 평가하는 판단이어서 pre-trade 게이트가 답을 낼 형태가 아니다. 셋째, 2015년 FAST Act가 § 4(a)(7)을 신설한 입법 취지가 바로 이 "1½"의 불확실성을 성문 요건으로 대체하는 것이었으므로, 그 수요는 § 4(a)(7)이 이미 흡수한다. 다만 이 제외가 곧 "1½ 경로가 존재하지 아니한다"는 뜻은 아니다. § 4(e)(2)와 Rule 144 Preliminary Note가 명시하듯 면제는 비배타적이므로, 어떤 거래가 본 부품에서 기계 판정 가능한 경로를 얻지 못하더라도(후술 `FAIL_NO_ELIGIBLE_PATH`) 그 거래가 위법하다는 결론이 도출되는 것은 아니며, off-chain 변호사 의견으로 "1½"을 원용하는 것은 별개의 문제이다. 이 구분은 사용자 노출 메시지와 수동 검토 큐 설계에 반드시 반영되어야 한다(walkthrough § 3.4). 재검토 시점은 OD-C00-6으로 유보한다.

### 3.8 Reg S Rule 904 경로가 역외 매수인에게 온전히 열리는지

Reg S Rule 904를 역외 재판매 경로로 두는 경우 그 요건이 온전히 충족될 수 있는지가 문제된다. 두 가지 제약이 있다. 첫째, Rule 902(h)의 offshore transaction 요건은 (A)와 (B) 중 택일을 허용하나, Rule 904용 (B)(2)는 거래가 "designated offshore securities market"에서 체결될 것을 요구하는데, Rule 902(b)의 열거 목록은 전통 거래소에 한정되고 Giwa 체인은 여기에 없으며 SEC의 별도 지정도 없다. 따라서 (B)(2)는 원천적으로 불가능하고, "매수 주문 시점에 매수인이 미국 밖에 있을 것"이라는 (A) 갈래만 남는다. 이는 KYC 데이터의 소재지 필드에 법적 무게가 실린다는 것을 의미한다. 둘째, Rule 904는 1933년법 § 5의 문제만을 해결하며, 본 자산이 § 3(c)(7) 펀드인 이상 투자회사법상 적격구매자(QP) 요건은 그대로 잔존한다. § 3(c)(7)(A)는 취득 시점에 보유자 전원이 QP일 것을 요구할 뿐 미국인·외국인을 구별하지 아니하므로, 역외 매수인도 QP여야 한다. 그러므로 REGS_904 경로로 라우팅되더라도 R3(§ 3(c)(7))의 QP 검사가 함께 걸리며, 본 부품은 소재지 (A)갈래의 존재만 확인하고 자격·QP 판정은 하류에 위임한다(walkthrough § 3.17·§ 3.0.1). 소재지 필드의 법적 취급은 OD-C00-4로 유보한다.

### 3.9 라우팅 오류의 두 방향과 그 법적 결과

본 부품의 오작동이 어떤 법적 결과를 낳는지가 문제된다. 오류는 두 방향으로 발생한다. 과소차단(false pass)은 열려 있지 아니한 경로를 열렸다고 판정하여 하류가 엉뚱한 검사를 돌리게 하는 것이다. 예컨대 실제로는 § 4(a)(7) 경로인 거래를 Rule 144로 라우팅하면 시스템은 보유기간만 재고 통과시키는데, § 4(a)(7)은 보유기간 요건이 없는 대신 매수인 적격투자자 요건이 있으므로, 결국 적격투자자가 아닌 자에게 미등록 증권이 매도되어 § 5 위반이 성립하고 매수인에게 § 12(a)(1)의 원상회복 청구권이 발생한다. 과잉차단(false fail)은 열려 있는 경로를 찾지 못하여 정당한 거래를 막는 것으로, 법적 사고는 아니나 제품을 죽인다. 그러므로 본 부품의 설계 목표는 많이 통과시키는 것도 많이 막는 것도 아니라, 열린 문을 빠짐없이 세고 그중 하나를 재현 가능하게 고르는 것이다. 이 양방향 실패 구조가 본 부품이 존재하는 이유이자, 경로가 하나도 없을 때 거래를 막는 fail-closed 기본 태도(§ 5의 화이트리스트 구조)의 정당화 근거이다(walkthrough § 1.5·§ 3.1).

## 4. 확정 사항 및 잔여 쟁점

본 부품의 성격과 경계는 다음과 같이 확정되었다. 첫째, 본 부품은 자격을 판정하지 아니하고 경로를 확정하는 결정론적 라우터(패턴 A)이며, 존재 수준만 보고 충족 수준은 전부 하류에 위임한다. 둘째, 경로는 비배타적으로 병존하므로 후보 열거와 우선순위 확정의 2단 구조를 취한다. 셋째, 보수적 기본 경로는 venue 설계에 제약을 부과하지 아니하는 Rule 144 비계열 경로이며, 현재 활성 경로는 이것 하나이다(`enabledPaths = {RULE144}`). 넷째, § 4(a)(7)·Rule 144A·Reg S Rule 904는 명세상 완비되어 있으나 비활성이다.

다만 다음은 확정 또는 후속을 요한다. 첫째, § 4(a)(7)의 개방 여부는 공개 호가창이 매도인 측 일반청약에 해당하는지에 대한 변호사 판단(general solicitation 판정)에 종속되며, § 4(a)(7)이 shell 리스크에서 더 안전하다는 논거가 개방을 지지한다(OD-C00-1). 둘째, Rule 144(i) shell 배제 위험은 유일 활성 경로를 위협하는 최대 위험이고, 이는 계열자 (f) 거래방법 채널의 가용성을 좌우하는 등록 브로커·딜러·ATS 지위 문제와 함께 해소되어야 한다(OD-C00-2). 셋째, Reg S Rule 904가 (A) 갈래로만 가능하므로 KYC 소재지 필드의 법적 취급이 확정되어야 한다(OD-C00-4). 넷째, 기계 라우팅에서 제외한 "§ 4(a)(1½)"의 재검토 시점을 정하여야 한다(OD-C00-6). 다섯째, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다.

---

# 제2부. 구현 명세 (목표 — 컨트랙트 미구현)

본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로, 이하는 walkthrough가 서술한 라우팅 로직을 구현 언어로 옮긴 목표 규격이다. 실제 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다.

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `C-00-v1` (미구현) |
| 분류 | 경로 선택(PATH_SELECTION) · 라우터/디스패처 |
| 검증 패턴 | 직접 계산형(패턴 A) — 결정론적 라우터. claim을 발급하지 아니하고 조회·비교만 한다 |
| 판정 시점 | pre-trade gate. R2(Resale)의 **최초** 부품(다른 재판매 검사보다 먼저 돈다) |
| 상태 | STATELESS (Element 한정 — 경로 선택은 스냅샷 판정. lot 계보는 CR-3, 누적 물량은 C-08이 각각 stateful 관리) |
| 활성 | R2. 현재 `manifest.enabledPaths = {RULE144}` — Rule 144 단일 경로만 활성, 나머지 세 경로는 비활성(§ 4) |
| 의존 부품 | (트리거) B-03·CR-3(`lot.restricted`·계보) · (cascade) A-06(계열)·A-11(claim 유효기간) · (하류 위임) C-01(보유기간)·C-08(물량)·A-03(AI)·A-13(QP)·B-04(엔진) |

전용 컨트랙트가 없으므로, 온체인 앵커의 화이트리스트·fail-closed 패턴은 시스템 공유 규약(`SPEC.md` § 1.3 결정론 경계)을 모델로 한다. 실제 정책값·법률 판단 스냅샷은 Manifest에 실리고, 취득 계보 등 사실은 off-chain 데이터 레이어(Layer 5)와 CR-3가 공급한다.

## 6. 목표 판정 구조 (게이트 흐름)

본 부품은 존재 수준 게이트를 순차 통과하며 후보 경로를 열거하고 단일 경로를 확정한다. 게이트 식별자는 walkthrough 서술을 따른다.

- **G1 — 재판매 트리거.** `lot.restricted == false`이면 라우팅이 불필요하므로 즉시 통과(`PASS_UNRESTRICTED`). true이면 다음 게이트로. (Rule 502(d), walkthrough § 3.5)
- **G2 — 정책 필터.** `manifest.enabledPaths`에 선언된 경로만 후보 대상으로 삼는다. `enabledPaths`가 공집합이면 `FAIL_NO_PATH_ENABLED`. 현재는 `{RULE144}`만 통과. (§ 2 메타 박스, § 3.10)
- **G3 — 후보 존재 열거.** 정책상 열린 각 경로에 대하여 존재 수준 요건을 검사하여 열린 경로를 전부 `candidates[]`에 적재한다(첫 매치에서 멈추지 아니한다). 경로별 존재 게이트는 § 7 인터페이스 및 § 8 요구사항에 따른다. RULE144 후보는 shell 게이트·계열자 게이트를 통과하여야 한다. (Preliminary Note 비배타성, walkthrough § 3.6~§ 3.11)
- **G4 — fail-closed.** `candidates[]`가 공집합이면 `FAIL_NO_ELIGIBLE_PATH`. 단 이는 위법 단정이 아니라 "기계 판정 가능한 경로 없음"이며, 수동 검토 큐로 라우팅한다. (§ 4(e)(2)·§ 3.4)
- **G5 — 우선순위 확정.** `candidates[]`가 복수이면 보수적 경로(Rule 144 비계열) 우선 규칙으로 단일 `selectedPath`를 확정하고, 그 경로가 요구하는 `downstreamChecks[]`를 반환한다. (walkthrough § 5.3)

## 7. 목표 인터페이스 (참조 시그니처)

```solidity
// 온체인 앵커(참조): 결정론적 라우터. pre-trade, R2 최초 부품.
// claim을 발급하지 아니하고, 정책값·사실 필드를 조회·비교하여 경로만 반환한다.

// 경로 상수
bytes32 constant RULE144   = keccak256("RULE144");
bytes32 constant SEC4A7    = keccak256("SEC4A7");
bytes32 constant RULE144A  = keccak256("RULE144A");
bytes32 constant REGS_904  = keccak256("REGS_904");

function check(
    TransferContext calldata ctx,   // lot·seller·buyer·txn 사실 (B-03·CR-3·A-06·KYC가 채움)
    Manifest        calldata mf     // 정책값·법률판단 스냅샷 (enabledPaths 등)
) external view returns (
    bool             eligible,          // 라우팅 성립 여부 (false → revert 사유코드)
    bytes32          selectedPath,      // RULE144 / SEC4A7 / RULE144A / REGS_904
    bytes32[] memory downstreamChecks,  // 선택 경로가 요구하는 하류 부품 목록
    uint32           reasonCode         // 0=정상 route, 그 외=단락/거절(§ 9)
);

// 참조 입력 필드 (walkthrough § 3.5~§ 3.17 ERC-3643 매핑)
//  ctx.lot.restricted            (B-03)          — G1 트리거
//  ctx.lot.sourceType            (CR-3)          — restricted 계보·(d)(7) 미판매배정분 배제
//  ctx.lot.lineageR              (CR-3)          — chain of transactions 계보
//  ctx.sellerIsAffiliate         (A-06)          — Rule 144 (b)(1)/(b)(2) 분기
//  ctx.buyerHasAIClaim           (A-03 존재만)     — SEC4A7 (d)(1)
//  ctx.buyerHasQIBClaim          (A-13/A-03 존재만)— RULE144A (d)(1)
//  ctx.buyerIsNonUSAtOrder       (KYC 소재지)      — REGS_904 (A)갈래
//  mf.enabledPaths               (정책)           — G2
//  mf.issuerReportingStatus      (=NON_REPORTING) — Rule 144 (b) 축
//  mf.issuerShellStatus          (기본 UNDETERMINED)— Rule 144 (i) shell 게이트
//  mf.issuerPublicInfoAvailable  (현재 false)      — Rule 144 (c)(2) 계열자 게이트
//  mf.venueChannels              (현재 ∅)          — Rule 144 (f) 계열자 게이트
//  mf.venueSolicitationProfile   (정책)           — SEC4A7 (d)(2) 일반청약
//  mf.issuerBusinessStatus       (정책)           — SEC4A7 (d)(6) 비shell
//  mf.classAuthorizedAt          (정책)           — SEC4A7 (d)(8) 90일
```

본 시그니처는 목표치이며, `TransferContext`·`Manifest` 구조체의 정확한 필드셋·키 컨벤션은 개발팀 구현 합의(PD-1)에 따른다. 본 부품은 위 필드를 읽기만 하며 어느 필드도 자신이 계산·갱신하지 아니한다.

## 8. 기능 요구사항 (목표)

- **REQ-C00-1 (재판매 트리거).** `lot.restricted == false`이면 라우팅 없이 즉시 통과(`PASS_UNRESTRICTED`)한다. restricted 판정 자체는 B-03이 세팅한 값을 읽는다. (Rule 502(d))
- **REQ-C00-2 (정책 필터).** `manifest.enabledPaths`에 선언되지 아니한 경로는 후보 대상에서 제외한다. `enabledPaths`가 공집합이면 `FAIL_NO_PATH_ENABLED`를 반환한다.
- **REQ-C00-3 (존재 수준 한정).** 각 경로의 원천 개방 여부(존재)만 판정하고, 요건의 실제 충족은 판정하지 아니한다. 보유기간·물량·적격·QP·affiliate 실질은 하류에 위임한다.
- **REQ-C00-4 (다중 후보 열거).** 정책상 열린 경로 중 존재 게이트를 통과한 경로를 전부 `candidates[]`에 열거한다. 첫 매치에서 멈추지 아니한다(경로 비배타성).
- **REQ-C00-5 (RULE144 shell 게이트).** `manifest.issuerShellStatus != NOT_SHELL_COUNSEL_CONFIRMED`이면 RULE144 후보를 제거하고, 이로 인해 후보가 비면 `FAIL_RULE144_SHELL_ISSUER`를 반환한다. 기본값은 닫힘(`UNDETERMINED`)이며 변호사 확인이 있어야 열린다. (Rule 144(i))
- **REQ-C00-6 (RULE144 계열자 게이트).** `sellerIsAffiliate == true`이면 RULE144 후보에 (c)(2)·(f) 존재 게이트를 적용한다 — `issuerPublicInfoAvailable == false` 또는 `venueChannels == ∅`이면 계열자 RULE144 후보를 제거한다. 통과 시 `rule144Branch`를 `B2_AFFILIATE`(하류 검사 `[C-01, C-08, A-06]`)로, 비계열은 `B1_II_NONAFFILIATE`(하류 검사 `[C-01]`)로 세팅한다. (Rule 144(b)(2)·(c)(2)·(f))
- **REQ-C00-7 (SEC4A7 존재 요건).** SEC4A7 후보는 (d)(2) `venueSolicitationProfile`(일반청약 부재)·(d)(4) `seller ∉ {issuer, subsidiaries}`·(d)(6) `issuerBusinessStatus`(비shell)·(d)(7) `sourceType ∉ {SRC_UNSOLD_ALLOTMENT}`·(d)(8) `now − classAuthorizedAt ≥ 90d`의 존재 게이트를 통과하여야 편입된다. (d)(1) AI 자격은 A-03에, (d)(5) bad actor는 A-01/Operator에 위임한다. (§ 4(a)(7)·(d))
- **REQ-C00-8 (RULE144A 존재 요건).** RULE144A 후보는 매수인 QIB claim의 존재를 요구한다. 자격 판정은 A-13/A-03에 위임한다. QIB는 적격구매자로 간주되므로(Rule 270.2a51-1(g)(1)) 이 경로는 R3와 마찰이 가장 적다. (Rule 144A(d)(1))
- **REQ-C00-9 (REGS_904 존재 요건).** REGS_904 후보는 매수 주문 시점 매수인 소재지가 미국 밖일 것((A)갈래)만 인정한다(designated offshore market 부재로 (B)(2)갈래 불가). § 3(c)(7) QP 요건은 잔존하므로 R3 검사가 함께 걸린다. (Rule 902(h)·904)
- **REQ-C00-10 (우선순위 확정).** `candidates[]`가 복수이면 보수적 경로(Rule 144 비계열) 우선 규칙으로 단일 `selectedPath`를 결정론적으로 확정한다. (§ 5.3)
- **REQ-C00-11 (fail-closed·비위법).** `candidates[]`가 공집합이면 `FAIL_NO_ELIGIBLE_PATH`를 반환하되, 이는 위법 단정이 아니라 "기계 판정 경로 없음"이며 off-chain 변호사 의견(§ 4(a)(1½)) 여지를 남기는 수동 검토 큐로 라우팅한다. 사용자 메시지에 이 취지를 반영한다.
- **REQ-C00-12 (하류 위임 목록).** `selectedPath`에 따라 `downstreamChecks[]`를 반환한다: RULE144 비계열 → `[C-01]`; RULE144 계열 → `[C-01, C-08, A-06]`; SEC4A7 → `[A-03, A-12]`; RULE144A → `[A-13/A-03]`; REGS_904 → `[소재지 확인, R3 QP(A-13)]`.
- **REQ-C00-13 (claim 미발급·무상태).** 본 부품은 조회·비교만 하며 claim을 발급하지 아니하고 상태를 누적하지 아니한다(STATELESS). lot 계보(CR-3)·누적 물량(C-08)에 관여하지 아니한다.
- **REQ-C00-14 (감사 추적).** 확정 경로에 대응하는 `exemptionBasis`(RULE144·RULE144A → `SEC_4A1`, SEC4A7 → `SEC_4A7`, REGS_904 → `REGS_904`)를 기록하여, 어느 조문 체계로 나갔는지가 감사 추적에 남도록 한다. (§ 4(a)(1)·§ 3.3)

## 9. 사유코드 (walkthrough § 6.1 대응)

본 부품은 통과/거절이 아니라 경로를 반환하므로, 사유코드는 단락(short-circuit)·거절·경로 확정의 세 갈래로 구성된다. 후보가 부재하는 두 실패 코드가 각각 "정책상 열린 경로 없음"과 "사실상 요건 미충족으로 열린 경로 없음"을 나타낸다.

| Code | 언제 | 성격 | 하류/조치 | 근거 |
|---|---|---|---|---|
| `PASS_UNRESTRICTED` | `lot.restricted == false` | 단락 통과 | 라우팅 불필요 — R2 진입 없이 통과 | Rule 502(d) · § 3.5 |
| `ROUTE(selectedPath)` | 후보 확정(G5) | 정상 라우팅 | `downstreamChecks[]`로 위임 | Preliminary Note · § 3.6 |
| `FAIL_NO_PATH_ENABLED` | `enabledPaths == ∅` | 거절(정책) | 정책 결정 대기 — 열린 경로 자체 부재 | § 3.10 · OD-C00-1 |
| `FAIL_RULE144_SHELL_ISSUER` | `issuerShellStatus != NOT_SHELL_COUNSEL_CONFIRMED` (RULE144 유일 후보 시) | 거절(존재 게이트) | 변호사 shell 확인 대기 | Rule 144(i) · OD-C00-2 |
| `FAIL_NO_ELIGIBLE_PATH` | 존재 스크리닝 후 `candidates == ∅` | 거절(사실) — 위법 단정 아님 | 수동 검토 큐 · off-chain 변호사 의견(§ 4(a)(1½)) 여지 | § 4(e)(2) · § 3.4 |

보조적으로, 계열자 경로가 (c)(2)·(f) 게이트로 제거되어 후보가 빌 경우에도 최종 반환은 `FAIL_NO_ELIGIBLE_PATH`이며, 제거 사유(공개정보 부재·거래방법 채널 부재)는 감사 로그에 남긴다. 회피계획(plan or scheme to evade) 배제는 본 부품 소관이 아니라 R4 사후 감시로 위임되므로 여기에 코드를 두지 아니한다.

## 10. 의존성

```
B-03(이전제한 메타)·CR-3(취득 레지스트리) → lot.restricted·sourceType·lineageR → C-00  // G1 트리거·계보
A-06(계열) → sellerIsAffiliate ────────────────▶ C-00  // Rule 144 (b) 분기·계열자 게이트
A-11(claim 유효기간) → claim freshness ─────────▶ C-00  // 존재 판정에 필요한 최소 cascade
Manifest(B-01 무결성) → enabledPaths·shell·공시·채널 정책값 ▶ C-00  // G2 정책 필터·존재 게이트
C-00 ──ROUTE(RULE144, 비계열)──▶ C-01
C-00 ──ROUTE(RULE144, 계열)───▶ C-01 · C-08 · A-06
C-00 ──ROUTE(SEC4A7)─────────▶ A-03 · A-12
C-00 ──ROUTE(RULE144A)───────▶ A-13 / A-03
C-00 ──ROUTE(REGS_904)───────▶ 소재지 확인 · R3 QP(A-13)
R2 Recipe = C-00 진입 분기 → 선택 경로 부품들의 cumulative AND
A-01(OFAC 제재) = 모든 거래의 transaction-level 게이트로 C-00보다 먼저 돈다(R-XJ always-on)
```

본 부품은 R2의 진입 분기이며, R2의 법률효과(§ 2(a)(11) underwriter 비해당 safe harbor)는 확정된 경로의 요건이 하류에서 전부 충족될 때 비로소 성립한다. affiliate 실질 판단(A-06)·보유기간 계산(C-01)·물량한도(C-08)·적격/QP 판정(A-03·A-13)은 본 부품이 수행하지 아니한다.

## 11. 인수 기준 (목표)

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| 1 | 비제한 lot | `lot.restricted=false` | `PASS_UNRESTRICTED`(라우팅 없음) |
| 2 | 정책 미개방 | `enabledPaths=∅` | `FAIL_NO_PATH_ENABLED` |
| 3 | 현행 기본값·비계열·shell 확인됨 | `enabledPaths={RULE144}`, `sellerIsAffiliate=false`, `issuerShellStatus=NOT_SHELL_COUNSEL_CONFIRMED` | `ROUTE(RULE144)`, `downstreamChecks=[C-01]` |
| 4 | shell 미확인 | `issuerShellStatus=UNDETERMINED` (RULE144 유일 후보) | `FAIL_RULE144_SHELL_ISSUER` |
| 5 | 계열자·공시 부재·채널 부재 | `sellerIsAffiliate=true`, `issuerPublicInfoAvailable=false`, `venueChannels=∅` | 계열자 RULE144 후보 제거 → `FAIL_NO_ELIGIBLE_PATH` |
| 6 | § 4(a)(7) 개방·존재 요건 충족 | `enabledPaths⊇{SEC4A7}`, (d)(2)·(4)·(6)·(7)·(8) 존재 게이트 통과 | `ROUTE(SEC4A7)`, `downstreamChecks=[A-03, A-12]` |
| 7 | 복수 후보(EITHER) | RULE144·SEC4A7 모두 존재 게이트 통과 | 보수 우선순위로 `ROUTE(RULE144)`(§ 5.3) |
| 8 | 144A·QIB claim 존재 | `enabledPaths⊇{RULE144A}`, `buyerHasQIBClaim=true` | `ROUTE(RULE144A)`, 하류 `[A-13/A-03]` |
| 9 | Reg S·역외 매수인 | `enabledPaths⊇{REGS_904}`, `buyerIsNonUSAtOrder=true` | `ROUTE(REGS_904)`, R3 QP 병존 위임 |
| 10 | 존재 경로 없음 | 모든 경로 존재 게이트 실패 | `FAIL_NO_ELIGIBLE_PATH`(수동 검토 큐, 위법 단정 아님) |

## 12. 잔여 확정 항목

1. 전용 컨트랙트·라우터 로직 구현(현재 미구현). `TransferContext`·`Manifest` 필드셋·키 컨벤션의 개발팀 합의(PD-1).
2. **OD-C00-1** — § 4(a)(7) 개방 여부. 공개 호가창의 매도인 측 일반청약 해당성(general solicitation 판정)에 대한 변호사 확인. § 4(a)(7)이 shell 리스크에서 더 안전하다는 논거가 개방을 지지.
3. **OD-C00-2** — Rule 144(i) shell 배제 위험(유일 활성 경로의 최대 위험) 및 이와 연동된 등록 브로커·딜러·ATS 지위 — 계열자 (f) 거래방법 채널 가용성의 전제.
4. **OD-C00-4** — Reg S Rule 904가 (A) 갈래로만 가능하므로 KYC 소재지 필드의 법적 취급 확정.
5. **OD-C00-6** — 기계 라우팅에서 제외한 § 4(a)(1½)의 재검토 시점.
6. 우선순위 확정(G5)의 세부 규칙(복수 후보 시 tie-break)과 수동 검토 큐 연계·사용자 노출 메시지 문안.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1절 (개요) | 파생 | 보경 walkthrough § 1.1·§ 1.3·§ 1.6·§ 2 |
| 제2절 (규범적 근거) | 파생 | 보경 walkthrough § 3.0.2 표 1(Authority) · § 3.1~§ 3.17 |
| 제3.1절 (발행/재판매 준별) | 파생 | 보경 § 1.4 · § 3.5 |
| 제3.2절 (존재 vs 충족) | 파생 | 보경 § 1.6 · § 3.9 |
| 제3.3절 (비배타성·다중 후보) | 파생 | 보경 § 3.6 |
| 제3.4절 (보수적 기본값) | 파생 | 보경 § 1.4 · § 3.8 · § 5.3(forward-ref) |
| 제3.5절 (Rule 144(i)·§ 4(a)(7) 대조) | 파생 | 보경 § 3.10 · § 3.0.1 ④ |
| 제3.6절 (계열자 폐쇄) | 파생 | 보경 § 3.8 · § 3.9 |
| 제3.7절 (§ 4(a)(1½) 제외) | 파생 | 보경 § 3.4 |
| 제3.8절 (Reg S 904 소재지·QP) | 파생 | 보경 § 3.17 · § 3.0.1 ⑦⑧ |
| 제3.9절 (라우팅 오류·rescission) | 파생 | 보경 § 1.5 · § 3.1 |
| 제5~11절 (목표 구현) | 목표 | 보경 walkthrough(§ 2 메타·§ 3.5~§ 3.17 ERC-3643 매핑) + forward-ref(G1~G5·사유코드) |
| 제9절 (사유코드) | 목표 | 보경 forward-ref(§ 6.1) — `PASS_UNRESTRICTED`·`FAIL_NO_PATH_ENABLED`·`FAIL_RULE144_SHELL_ISSUER`·`FAIL_NO_ELIGIBLE_PATH` |
| 제12절 (잔여 항목) | 목표 | 보경 § 12 forward-ref(OD-C00-1·2·4·6) |

전용 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다. 승준 초안(`docs/compliance/elements/C-00_resale-path-selector.md`, 산출물/elements 사본)은 본 보경 검토본으로 교체 대상이다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `C-00_resale-path-selector.md` (2026-07-08, Version 1.0 인용기준 2026-07-16) — 레포 `docs/compliance/elements/` 교체 대상.
- 공유 개념: `SPEC.md` § 1(아키텍처)·§ 2(핵심 개념)·§ 4(Recipe R2)·§ 6(off-chain Layer 5).
- 결정: `ADR-005`(§ 4(a)(7) 주 재판매경로·A-03 active, general solicitation 판정 잔여) · `ADR-004`(Element Pool Freeze v1) · `ADR-006`(asset-agnostic) · `ADR-008`(C-08·D-01 stateful seam).
- 1차 출처(제정법): 15 U.S.C. § 77e(a)(§ 5) · § 77b(a)(11)(§ 2(a)(11)) · § 77d(a)(1)(§ 4(a)(1)) · § 77d(a)(2)(§ 4(a)(2)) · § 77d(a)(7)·(d)·(e)(§ 4(a)(7)) · § 77l(a)(1)(§ 12(a)(1)) · 15 U.S.C. § 80a-3(c)(7)·§ 80a-2(a)(51)(ICA § 3(c)(7)·QP) · FAST Act § 76001, Pub. L. 114-94 (2015).
- 1차 출처(연방규칙): 17 C.F.R. § 230.144(Preliminary Note·(a)·(b)·(c)~(h)·(i)) · § 230.144A · § 230.502(d) · § 230.506(c) · § 230.902·904·905(Reg S) · § 270.2a51-1(g)(1) · § 242.300·.301(Reg ATS).
- 1차 출처(SEC 발행·판례): SEC Release 33-8869 · 33-6862 · 33-7505 · SEC Corp Fin C&DI(Securities Act Rules) · SEC v. Ralston Purina Co., 346 U.S. 119 (1953).

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 walkthrough(2026-07-08, §1~§3.11) 기반 2부 구성 신설. 제1부: 재판매 규제 지형(§ 5 전면금지·§ 2(a)(11) underwriter·네 경로 병존)과 9개 쟁점 논증(발행/재판매 준별·존재 vs 충족·비배타성·보수적 RULE144 기본값·Rule 144(i) shell 위험 및 § 4(a)(7) 상대 안전성·계열자 폐쇄·§ 4(a)(1½) 제외·Reg S 904 소재지 및 QP 잔존·라우팅 오류 양방향과 § 12(a)(1) rescission). 제2부: 전용 컨트랙트 미구현 → 목표 규격(게이트 흐름 G1~G5·라우터 참조 시그니처·REQ-C00-1~14·사유코드 4종). 잔여 쟁점 OD-C00-1(§ 4(a)(7) 개방)·OD-C00-2(Rule 144(i) shell·BD/ATS)·OD-C00-4(Reg S 소재지)·OD-C00-6(§ 4(a)(1½) 재검토) 유지. 승준 초안 교체 대상 명시.
