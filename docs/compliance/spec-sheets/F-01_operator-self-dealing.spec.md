---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: F-01
element-name: Operator Self-Dealing Restriction (운영자 자기거래 제한)
status: v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough.
substance-sot: "보경 walkthrough — F-01_operator-self-dealing.md (2026-07-21). 레포 docs 교체 대상."
umbrella: "SPEC.md — 공유 개념(게이트형 negative screen·on/off-chain 경계·Recipe cumulative AND·글로벌 게이트)은 여기에 의한다"
stateful: false
tags: [requirement-spec, F-01, operator-self-dealing, anti-fraud, reg-ats, stateless, R4]
---

# F-01 Operator Self-Dealing Restriction — 요구사항 명세서

본 문서는 컴플라이언스 부품 F-01(운영자 자기거래 제한)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의한다. 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로 제2부는 목표 규격(target specification)이며, 게이트형 negative screen 온체인 패턴은 형제 부품 A-01(제재 명단 대조)을 참조한다. 시스템 공유 개념은 `SPEC.md`에 의한다.

본 부품은 거래 당사자(from·to) 중 어느 한쪽이라도 플랫폼 운영자 측(Decipher 법인·계열·임직원 및 이들이 지배하는 계좌)에 속하면 체결 직전에 그 거래를 차단하는 사전 관문이다. 어떤 단일 조문이 "운영자는 자기 시장에서 거래하지 말라"고 직접 명령하지는 아니한다. 본 부품은 운영자 자기거래가 성립시킬 반사기(anti-fraud) 책임의 사실적 전제 자체를 거래 이전에 제거하는 예방적 게이트이다.

---

# 제1부. 법적 근거 및 논증

## 1. 개요

F-01은 2차 유통 단계에서 운영자 측이 자발적으로 거래 당사자가 되는 것을 사전에 차단하는 부품이다. 본 부품의 법적 뿌리는 두 겹이다. 무조건적 1차 뿌리는 증권거래법과 증권법의 반사기 규범이고, 조건부 보강은 대체거래시스템 규칙(Regulation ATS)과 중개업자 반사기 조문이다. 무조건적 뿌리는 운영자의 법적 지위(broker·ATS 해당 여부)가 확정되기 전에도 F-01을 정당화하며, 조건부 보강은 그 지위가 확정될 때 근거를 두껍게 할 뿐이다. 본 부품은 매수인의 자격·자산을 계산하지 아니하고, 오직 거래 당사자가 운영자 측인지만 확인하여 결정론적으로 차단한다는 점에서, 제재 명단을 대조하여 즉시 차단하는 A-01과 같은 계열의 사전 하드 게이트이다.

## 2. 규범적 근거

반사기 축은 증권 매매 전반의 조작·기망을 금지하는 증권거래법 §10(b) 및 그 실행규칙 Rule 10b-5(15 U.S.C. § 78j(b); 17 C.F.R. § 240.10b-5)와, 증권의 청약·매도상 사기를 금지하는 증권법 §17(a)(15 U.S.C. § 77q(a))로 구성된다. 이 조문들은 주체를 "모든 자(any person)"로 하므로 운영자의 등록 여부와 무관하게 적용된다. 조건부 보강 축은 ATS의 broker-dealer 등록 의무를 정한 Reg ATS Rule 301(b)(1)과 subscriber 주문정보의 기밀 취급 및 임직원 자기계좌 거래 통제를 요구하는 Rule 301(b)(10)(17 C.F.R. § 242.301(b)(1)·(b)(10)), 그리고 중개업자 반사기를 정한 증권거래법 §15(c)(1) 및 Rule 10b-3(15 U.S.C. § 78o(c)(1); 17 C.F.R. § 240.10b-3)으로 구성된다. 제한대상 집합의 범위는 affiliate·control을 정의하는 Rule 405(17 C.F.R. § 230.405)와 중개업자의 associated person을 정의하는 증권거래법 §3(a)(18)(15 U.S.C. § 78c(a)(18))로 확정된다. 운영자 자기거래가 초래하는 가장매매(wash sale·matched order) 우려는 증권거래법 §9(a)(1)(15 U.S.C. § 78i(a)(1))이 보조적으로 뒷받침한다. 끝으로 본 부품은 투자회사법(ICA) §17(a)에서 나오지 아니하며, 그 부적용은 ICA §3(c)(7)·§2(a)(3)(15 U.S.C. § 80a-17(a)·§ 80a-3(c)(7)·§ 80a-2(a)(3))으로 확정되는 별도의 소극적 결론(negative finding)이다.

## 3. 쟁점별 논증

### 3.1 F-01의 법적 성격 — 조문의 전사가 아니라 반사기 예방 게이트

본 부품이 어떤 법적 성격의 검사인지가 문제된다. 앞선 발행·자격 부품들은 하나의 요건 정의(예: 적격구매자 정의)를 중심으로 하위 규칙이 방사형으로 붙는 구조였다. 그러나 운영자 자기거래를 정면으로 금지하는 단일 조문은 존재하지 아니한다. 운영자가 미체결 주문흐름의 정보우위를 이용하여 고객 반대편에서 거래하거나 고객 주문에 앞질러 거래하는 것은 증권거래법 §10(b)와 Rule 10b-5가 금지하는 "기망적 장치·계획"(10b-5(a))이자 "누구에 대하여든 사기로 작용하는 업무과정"(10b-5(c))에 해당하며, 명시적 부실표시가 없더라도 (a)·(c)만으로 위반이 성립한다. 이때 미공개 주문흐름을 이용한 거래는 정보 유용(misappropriation) 이론으로 §10(b)/10b-5 위반이 될 수 있다. 즉 반사기 조문은 운영자 자기거래를 사후에 위법으로 규정하는 책임 규범이다. F-01은 그 위반이 성립하기 위한 사실적 전제, 곧 "운영자가 거래의 당사자가 된다"는 사실 자체를 거래 이전에 제거한다. 그러므로 본 부품은 조문을 직접 판정하는 검사가 아니라, 반사기 위반의 전제를 원천 봉쇄하는 예방적(prophylactic) 게이트로서 정당화된다.

### 3.2 운영자 지위 미결과 무관하게 정당화되는 이유

본 부품의 정당성이 운영자의 broker·ATS 지위 확정에 의존하는지가 문제된다. Decipher의 스마트컨트랙트가 이전을 매칭·체결·결제하고 운영자가 거래당 수수료를 수취하므로, 운영자는 "타인의 계산으로 거래를 성사시키는(effecting transactions for the account of others)" broker에 해당할 소지가 크고 나아가 ATS일 수 있으나, 이 지위는 아직 미결이며 외부 전문 자문과 SEC Crypto Task Force의 관여를 요한다. 그러나 §10(b)/Rule 10b-5와 §17(a)는 주체를 "모든 자(any person)"로 정하고, §10(b)는 대상을 "등록된 증권이든 그렇게 등록되지 아니한 증권이든"으로 정하여 비상장 펀드지분도 포섭한다. 따라서 운영자가 broker로 등록되었든 아니든 반사기 규범은 무조건 적용된다. 본 부품의 무조건적 뿌리가 반사기인 이유가 여기에 있다. 지위가 broker·ATS로 확정되면 후술하는 Reg ATS Rule 301(b)(10)과 §15(c)(1)이 조건부로 추가되어 근거가 두꺼워질 뿐, F-01의 게이트 로직 자체는 지위 확정 이전에도 이미 정당화된다.

### 3.3 사전 하드 게이트가 유일하게 부합하는 이유

본 부품이 왜 사후 감시나 증명서 확인이 아니라 사전 차단이어야 하는지가 문제된다. 증명서형 검사는 신뢰기관이 "이 사람이 어떤 자격을 갖췄음"을 서명하여 확인하는 구조인데, F-01이 확인하려는 것은 자격의 유무가 아니라 "이 사람이 운영자 측인가"라는 부정 사실이며, 이는 제3자가 증명할 대상이 아니라 Decipher 자신이 가장 잘 아는 정보이다. 또한 감시형 검사는 체결된 거래를 사후에 표시할 뿐이어서, 반사기 위반의 전제를 사전에 제거해야 하는 본 부품의 목적에 부합하지 아니한다. 운영자 자기거래는 한 건의 문제가 아니라 "운영자가 자기 시장에서 거래한다"는 사실 자체가 시장 중립성에 대한 신뢰를 무너뜨리는 것이므로, 그 사실적 전제를 체결 직전에 원천 제거하는 하드 게이트가 유일하게 들어맞는다. 나아가 명부를 읽지 못하거나 판정이 불확실한 경우에는 통과가 아니라 차단을 기본값으로 하는 fail-safe 원리가 적용된다. 투자자 보호를 목적으로 하는 반사기 예방 부품에서 불확실성은 보수적으로 차단하는 방향으로 해소하는 것이 옳기 때문이다.

### 3.4 ATS·broker 지위 확정 시의 조건부 보강

운영자 지위가 확정될 경우 근거가 어떻게 달라지는지가 문제된다. 어떤 플랫폼이 ATS에 해당하면 Reg ATS Rule 301(b)(1)에 따라 자동으로 §15상 broker-dealer 등록 의무를 지고, 그 결과 반사기·기록·감독 체계가 함께 결속된다. 그중 Rule 301(b)(10)은 ATS로 하여금 subscriber의 기밀 거래정보에 대한 접근을 시스템 운영·컴플라이언스 담당 직원으로 한정하고((i)(A)), 직원이 자기 계좌로 거래하는 것을 통제하는 기준을 시행하며((i)(B)), 그 준수를 위한 감독 절차를 채택·시행할 것((ii))을 요구한다. 이 조항이 겨누는 위험은 정확히 F-01의 표적과 같다. 전통적 ATS는 이 의무를 사내 정보장벽·거래 사전승인·감시 같은 서면 절차로 이행하나, F-01은 운영자·임직원·계열의 온체인 거래를 결정론적으로 전면 차단함으로써 (i)(B)가 요구하는 통제 기준의 최강 이행을 코드로 구현한다. 규칙이 요구하는 최소치는 "통제 기준을 둘 것"이고 F-01은 그보다 강한 "완전 차단"을 택한 것이다. 또한 운영자가 broker에 해당하면 §15(c)(1) 및 Rule 10b-3의 중개업자 반사기 조문이 운영자 자기거래에 직접 적용되어 봉쇄 근거를 강화한다. 다만 이 조항들은 지위가 확정될 때 반사기 근거 위에 한 겹 더 얹히는 조건부 보강이며, ATS·broker가 아니더라도 F-01은 §10(b)/§17(a)로 이미 정당화된다.

### 3.5 제한대상 집합의 범위 — Rule 405의 기능적 control

누구까지를 운영자 측으로 보아 제한대상 명부에 올릴지가 문제된다. 제한대상은 세 층으로 구성된다. 첫째 Decipher 법인 자체, 둘째 Decipher의 affiliate, 셋째 Decipher의 임원·이사·직원 및 이들이 지배하는 계좌이다. 둘째 층의 affiliate는 Rule 405의 control 기준으로 확정되는데, control은 "의결권 증권의 소유·계약 또는 그 밖의 방법을 통하든, 어떤 자의 경영과 정책의 방향을 지시하거나 지시하도록 할 수 있는 권한의 보유"를 의미한다. 즉 control은 지분율 같은 밝은 선(bright line)이 아니라 기능적 개념이므로, Decipher를 지배하거나 Decipher에 지배되거나 Decipher와 공통지배 관계에 있는 자(예: 같은 지주 아래 거래 데스크)가 모두 포함된다. 이는 내부자 판정(A-06)이 지분 문턱 대신 기능적 control을 적용하는 것과 같은 규율이며, 그래서 F-01의 계열 판정은 A-06의 판정 결과를 공유한다. 셋째 층의 임직원은, 운영자가 broker에 해당하는 경우 증권거래법 §3(a)(18)의 "associated person of a broker or dealer"(파트너·임원·이사·직원 및 control 관계자를 포함) 개념으로도 포착되어 세 층을 하나의 법정 정의로 묶을 수 있다. 다만 control의 실체 판정 자체는 본 부품의 소관이 아니라 A-06의 소관이며, F-01은 그 결과를 명부 구성에 소비할 뿐이다.

### 3.6 ICA §17(a) 부적용 — 소극적 결론(negative finding)

자기거래를 다루는 본 부품이 투자회사법 §17(a)에서 나오는지가 문제된다. §17(a)는 등록 투자회사의 affiliated person이 그 회사와 자기거래하는 것을 금지하는 미국 펀드법의 자기거래 금지 총본산이므로, 얼핏 본 부품의 근거로 보이기 쉽다. 그러나 F-01은 §17(a)에서 나오지 아니한다. 두 겹의 이유가 있다. 첫째, §17(a)의 주어는 "등록 투자회사(registered investment company)의 affiliated person"인데, BUIDL-like 펀드는 §3(c)(7)에 따라 애초에 투자회사 정의에서 제외되어 미등록이므로 §17이라는 실체규정 자체가 닿지 아니한다. 둘째, 그 문턱을 논외로 하더라도 거래장을 운영한다는 사실만으로 Decipher가 §2(a)(3) 의미의 그 펀드 affiliated person이 되지는 아니한다. §2(a)(3)의 affiliated person은 투자자문사, 의결권 5% 이상 소유자, 펀드가 5% 이상 소유한 자, 펀드를 지배·피지배·공통지배하는 자 등인데, 2차 시장을 운영한다는 사실은 이 중 어디에도 해당하지 아니하기 때문이다. 따라서 본 부품을 "펀드 관계자 자기거래" 프레임으로 재구성하면 근거 조문도 적용 요건도 어긋난다. 본 절의 역할은 오히려 "ICA §17이 F-01의 근거가 아님"을 확정하는 데 있으며, 펀드 지위(§3(c)(7)) 자체는 A-13·D-01의 소관으로 F-01과 무관하다.

### 3.7 보조 근거와 경계 — §9(a)(1) 가장매매 및 예외의 범위

운영자 자기거래가 만드는 부작용과 그 소관 경계가 문제된다. 운영자가 자기 통제 계좌들 사이에서 거래하면 실질 소유권 변동이 없는 가장매매가 되어 "활발한 거래에 관한 허위 외관"을 만들 수 있고, 이는 증권거래법 §9(a)(1)의 wash sale(A) 및 matched order(B·C) 금지에 닿는다. 다만 이 조문은 본 부품에서 "왜 운영자가 자기 시장에서 거래하면 안 되는가"의 보조 근거로만 인용된다. 가장매매 패턴의 실제 탐지는 시장행위 감시(F-02)가 상태를 누적하여 사후에 수행하며, F-01은 그 원천의 하나를 사전에 제거할 뿐이다. 한편 제한대상이 낀 거래라도 예외로 허용되는 경우가 문제되는데, 예외는 두 가지로 좁게 한정된다. 첫째, 발행자(또는 Manifest가 지정한 primary 경로)가 최초 투자자에게 배포하는 1차 배포는 2차 시장 매칭이 아니므로 자기거래 우려 밖일 수 있으나, 운영자가 발행자·transfer agent 역할을 겸하는 구조에서는 그 경계가 미묘해지므로 예외는 Manifest에 명시된 배포 경로로만 한정하고 보수적으로 좁게 잡는다. 둘째, 분실 지갑 복구·상속 이전·규제 명령 이행 같은 강제·회수(involuntary) 이전은 운영자가 기술적 주체가 되더라도 자발적 자기거래가 아니므로, 별도의 상위 권한과 사유·서명·타임스탬프 기록으로 통제하여 차단에서 제외한다. 두 예외에 모두 해당하지 아니하는 한 차단이 기본값이며, 예외가 차단에 우선하되 예외는 화이트리스트로 좁게 정의된 경우에만 성립한다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 사전 하드 게이트 성격과 무조건적 반사기 뿌리, 그리고 ICA §17 부적용은 위와 같이 확정되었다. 무조건적 근거는 §10(b)/Rule 10b-5·§17(a)이고, ATS·broker 지위 확정 시 Rule 301(b)(10)(i)(B)와 §15(c)(1)·Rule 10b-3이 조건부로 보강되며, F-01은 301(b)(10)(i)(B)의 최강 이행이다. 다만 다음은 확정 또는 후속을 요한다. 첫째, off-chain에서 계열로 판정된 자가 아직 온체인 명부에 반영되지 아니한 갱신 지연 창(window)이 본 부품의 유일한 구조적 취약점이며, 반영 지연을 최소화하는 SLA·즉시 반영 메커니즘의 설계가 필요하다. 둘째, 본 부품은 조직상 R4(시장행위 감시)에 속하나 실행상으로는 모든 Recipe의 거래에 걸려야 하는 글로벌 게이트 성격을 가지므로, 이를 제재(A-01)와 나란히 사전 평가되는 전역 관문으로 배치할지 R4 감시 파이프라인에 둘지를 매니페스트 설계에서 명시적으로 확정하여야 한다. 셋째, Decipher의 broker·ATS 분류 여부와 그에 따른 조건부 근거·감독 기록 의무의 활성화가 미결이다. 넷째, 발행자·transfer agent 겸직 구조에서 1차 배포 예외의 경계가 후속 검토 대상이다. 다섯째, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다.

---

# 제2부. 구현 명세 (목표 — 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `F-01-v1` (미구현) |
| 분류 | 행위·운영(CONDUCT_OPERATION) · 조직상 R4 소속, 실행상 글로벌 게이트 |
| 검증 패턴 | 게이트형 negative screen(패턴 A) — 제한대상 명부 대조 후 strict block. 증명서형(패턴 B) 아님 |
| 판정 시점 | pre-trade gate(거래 체결 직전) |
| 상태 | STATELESS — 거래는 명부를 읽기만 한다. 명부의 등록·갱신은 거래 외 운영 트랜잭션 경로로만 변한다 |
| 활성 | R4(조직 소속). 단, 운영자 자기거래는 R1·R2·R3 어느 경로의 거래에도 걸려야 하므로 모든 거래에 pre-trade 병렬 적용을 권장한다 |
| 의존 부품 | A-04(신원·ONCHAINID) · A-06(계열 control 판정) · A-01(동형 게이트, 병렬 배치) · F-02(사후 감시 경계) · F-03(우회 시도 신호) · B-01·B-03(Manifest·권한 정합) |

전용 컨트랙트가 없으므로, 명부 대조 후 strict block하는 온체인 패턴은 A-01(제재 명단 negative screen)을 모델로 한다. 계열 실체 판정과 명부 등록·갱신·대사는 off-chain Operator Layer에서 수행한다.

## 6. 목표 판정 구조 (게이트 — 상태기계 아님)

본 부품은 상태를 누적하지 아니하는 사전 게이트이므로, F-02·F-03과 같은 flag 상태기계를 갖지 아니한다. 판정은 거래 체결 직전의 명부 스냅샷을 대조하는 결정론적 분기이며, 결과는 `PASS(OP_CLEAR)` · `PASS(예외)` · `FAIL` 셋 중 하나이다.

판정 매트릭스(목표):

| from 제한대상 | to 제한대상 | transferType | 결과 | reasonCode |
|---|---|---|---|---|
| 아니오 | 아니오 | 무관 | PASS | `OP_CLEAR` |
| 예 | 아니오 | secondary | FAIL | `OP_SELF_DEALING_BLOCKED` |
| 아니오 | 예 | secondary | FAIL | `OP_SELF_DEALING_BLOCKED` |
| 예 | 예 | secondary | FAIL | `OP_SELF_DEALING_BLOCKED` |
| 한쪽 이상 예 | — | primary(Manifest 허용) | PASS(예외) | `OP_EXEMPT_PRIMARY` |
| 한쪽 이상 예 | — | involuntary | PASS(예외) | `OP_EXEMPT_INVOLUNTARY` |
| 명부 로드 실패 | — | 무관 | FAIL(fail-safe) | `OP_REGISTRY_UNAVAILABLE` |

판정 단위는 지갑이 아니라 ONCHAINID이다. 운영자가 새 지갑으로 우회하더라도 그 지갑이 운영자의 ONCHAINID에 묶이면 명부에 걸리며, 어떤 ONCHAINID에도 묶이지 않은 지갑은 상류 A-04가 먼저 차단한다. 제한대상 대조는 존재 여부의 boolean이므로 초과·이상 같은 경계 부등식 문제가 없다.

## 7. 목표 인터페이스 (negative screen 게이트)

```
// 온체인 (ERC-3643 compliance module · negative screen 게이트):
//   Transfer 시 Router/Token이 moduleCheck를 호출, false면 transfer 전체가 revert된다.
moduleCheck(from, to, value, compliance) -> bool      // 제한대상·예외 아님 → false
canTransfer(from, to)                  -> (ok, reasonCode)   // ok=false 시 revert 사유코드 반환

// 온체인 레지스트리 (Decipher 거버넌스 관리 — §11 Operator Layer):
restrictedOperatorSet[onchainId]       -> RoleTag     // 0=none · ENTITY · AFFILIATE · ASSOCIATED_PERSON · CONTROLLED_ACCOUNT
Manifest.allowsPrimary(from, to)       -> bool        // Manifest가 명시한 1차 배포 경로인가

// off-chain 판정 소비 (게이트는 결과만 읽는다):
IdentityRegistry.onchainId(wallet)     -> onchainId   // A-04: 지갑 → 사람
A06.classifyControl(person)            -> RoleTag     // A-06: Rule 405 control → 명부 반영
```

`check`는 항상 통과시키는 감시형(F-03)과 달리, 제한대상이 낀 2차 거래에서 `ok=false`를 반환하여 거래를 revert시키는 차단형이다. 명부 쓰기(등록·제거)는 `check` 경로가 아니라 별도의 거버넌스 운영 트랜잭션으로만 이루어진다.

## 8. 기능 요구사항 (목표)

- **REQ-F01-1 (사전 차단 게이트).** 제한대상이 자발적으로 2차 거래의 당사자가 되는 거래를 pre-trade에 revert한다. 예외(§REQ-F01-6·7)에 해당하지 아니하는 한 차단이 기본값이다.
- **REQ-F01-2 (판정 단위 = ONCHAINID).** 판정은 지갑이 아니라 ONCHAINID를 기준으로 한다(A-04 소비). 새 지갑을 이용한 우회는 동일 ONCHAINID로 해석되어 무력화된다.
- **REQ-F01-3 (결정론적 명부 대조).** restrictedOperatorSet 대조는 재량 없는 boolean 판정이며, control 여부 등 규범적 판단은 온체인에서 수행하지 아니한다.
- **REQ-F01-4 (제한대상 집합의 범위).** 명부는 `OPERATOR_ENTITY`(법인)·`OPERATOR_AFFILIATE`(Rule 405 control)·`OPERATOR_ASSOCIATED_PERSON`(임원·이사·직원, §3(a)(18))·`OPERATOR_CONTROLLED_ACCOUNT`(이들이 지배하는 계좌) 네 태그를 포함한다. control 실체 판정은 off-chain A-06가 수행하고 결과만 명부에 반영한다.
- **REQ-F01-5 (fail-safe).** 명부 로드에 실패하면 통과가 아니라 차단한다(`OP_REGISTRY_UNAVAILABLE`). 반사기 예방이 목적이므로 불확실성은 보수적으로 차단하는 방향으로 해소한다.
- **REQ-F01-6 (예외 — 1차 배포).** Manifest가 명시한 primary-distribution 경로(발행자 주소 → whitelist 투자자)는 차단에서 제외한다(`OP_EXEMPT_PRIMARY`). 예외는 좁게 한정하며, 같은 발행자가 2차 매칭에 당사자로 들어오면 예외가 아니다.
- **REQ-F01-7 (예외 — 강제·회수).** forcedTransfer/recovery 등 비자발적 이전은 차단에서 제외한다(`OP_EXEMPT_INVOLUNTARY`). 이 경로는 상위 권한(멀티시그·time-lock)과 사유·서명·타임스탬프 기록으로 통제하며 B-03의 권한 체계와 정합하여야 한다.
- **REQ-F01-8 (노출 최소화).** 매수인에게는 일반 사유("이 거래는 현재 진행할 수 없습니다")만 노출하고, 어느 당사자가 어떤 태그로 차단되었는지 등 명부의 상세는 노출하지 아니한다. 명부 구성의 노출은 우회 악용을 초래할 수 있기 때문이다.
- **REQ-F01-9 (감사 기록).** 모든 차단·예외를 내부에 완전히 기록한다(대상 ONCHAINID·태그·명부 버전·타임스탬프, 예외 유형·승인 권한자·사유). BD·ATS 해당 시 이 기록은 Reg ATS Rule 301(b)(10)(ii) 감독 절차 및 Rule 17a-4 기록보존과 연결된다.
- **REQ-F01-10 (글로벌 게이트 배치).** 본 부품은 조직상 R4에 속하나 실행상 모든 Recipe 거래에 걸려야 하므로, 제재(A-01)와 나란히 전역 관문(예: `manifest.globalGates`)으로 pre-trade에 병렬 평가하는 것을 권장한다. R4 사후 감시 파이프라인에만 매달면 pre-trade 봉쇄가 누락될 위험이 있다.
- **REQ-F01-11 (명부 갱신 = 운영 트랜잭션).** 제한대상 명부의 추가·제거는 거래가 아니라 거버넌스 멀티시그·time-lock 운영 트랜잭션으로만 수행한다. off-chain 판정과 온체인 반영 사이의 지연 창을 최소화한다.
- **REQ-F01-12 (조건부 근거 태그).** `venueStatus`가 ATS·BROKER로 확정되면 근거 태그에 Reg ATS Rule 301(b)(10) 및 §15(c)(1)·Rule 10b-3을 추가한다. 게이트 로직 자체는 불변이며 근거 두께만 증가한다.

## 9. reasonCode

보경 walkthrough §6(거절·예외 처리)의 사유코드에 정상 통과 코드(§5 판정 로직)를 더한 전체 목록이다.

| reasonCode | 결과 | 언제 | 처리 · 노출 |
|---|---|---|---|
| `OP_CLEAR` | PASS | from·to 모두 제한대상 아님 | 정상 체결 |
| `OP_SELF_DEALING_BLOCKED` | FAIL | 제한대상이 낀 2차 거래(예외 아님) | revert · 매수인엔 일반 사유만 |
| `OP_REGISTRY_UNAVAILABLE` | FAIL | 제한대상 명부 로드 실패 | revert(fail-safe) · 매수인엔 일시 오류 |
| `IDENTITY_UNRESOLVED` | REVERT | from·to의 ONCHAINID 미해석 | revert(A-04 상류) · A-04 메시지 |
| `OP_EXEMPT_PRIMARY` | PASS(예외) | 발행자 1차 배포(Manifest 허용) | 정상 처리 · 내부 기록 |
| `OP_EXEMPT_INVOLUNTARY` | PASS(예외) | forcedTransfer/recovery | 정상 처리 · 내부 기록 |

## 10. 불변식

1. 본 부품은 STATELESS이다. 거래는 제한대상 명부를 읽기만 하며, 명부 쓰기는 거래가 아니라 운영 트랜잭션이다.
2. 판정 단위는 지갑이 아니라 ONCHAINID이다.
3. 명부를 읽지 못하거나 판정이 불확실하면 통과가 아니라 차단한다(fail-safe).
4. 예외(primary·involuntary)는 화이트리스트로 좁게 정의된 경우에만 성립하며, 애매하면 차단이 기본값이다.
5. 본 부품의 근거 태그에 `ICA_17`을 사용하지 아니한다(§3.6 negative finding).
6. F-01의 PASS는 "운영자 측 문제 없음"만을 의미하며, A-01·A-03 등 다른 게이트의 통과를 보장하지 아니한다(cumulative AND).

## 11. 의존성

```
A-04(신원)        → 지갑 → ONCHAINID 매핑        → F-01 (판정 단위 공급)
A-06(affiliate)   → Rule 405 control 판정        → restrictedOperatorSet (명부 구성)
A-01(제재)         ∥ F-01                        → 동형 negative screen·fail-safe (병렬 글로벌 게이트)
F-01(사전 차단)     → 통과·예외 통과분             → F-02 (wash/matched 사후 감시, §9(a)(1))
제한대상 우회 시도(새 지갑·명의 위장)             → F-03 (SAR 신호)
B-03(이전제한 메타) → forcedTransfer/recovery 권한 → 예외 ②(강제·회수) 정합
B-01(Manifest 무결성) → primary 경로·명부 참조 무결성
Operator Layer(§11 walkthrough) → 명부 등록·갱신·대사 → restrictedOperatorSet
```

## 12. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | whitelist A(매도) → whitelist B(매수), 둘 다 비제한 | PASS(`OP_CLEAR`) |
| 2 | Decipher 법인이 자기 계정으로 매수 | FAIL(`OP_SELF_DEALING_BLOCKED`) |
| 3 | 공통지배 계열 거래 데스크가 반대편 매도(A-06 반영) | FAIL(`OP_SELF_DEALING_BLOCKED`) |
| 4 | 발행자 1차 배포(Manifest 허용, 발행자가 명부에 있음) | PASS(`OP_EXEMPT_PRIMARY`) |
| 5 | 강제이전·회수(involuntary) | PASS(`OP_EXEMPT_INVOLUNTARY`) |
| 6 | 운영자 임직원이 명부에 없는 새 지갑으로 시도(ONCHAINID 연결) | FAIL(`OP_SELF_DEALING_BLOCKED`) |
| 7 | 임직원이 KYC 없는 익명 지갑으로 시도 | REVERT(`IDENTITY_UNRESOLVED`, A-04 상류) |
| 8 | 제한대상 명부 로드 실패 | FAIL(`OP_REGISTRY_UNAVAILABLE`, fail-safe) |
| 9 | from·to 양쪽 다 제한대상, 예외 아님(운영자 내부 이동) | FAIL(`OP_SELF_DEALING_BLOCKED`) |

## 13. Demo 및 Production 범위

| 구분 | Demo | Production |
|---|---|---|
| 명부 | 소수 제한대상 mock 레지스트리 | 거버넌스 멀티시그·time-lock 관리 restrictedOperatorSet |
| 판정 | 게이트 3분기 개념 시연 | ONCHAINID 대조 + primary·involuntary 예외 경로 |
| 계열 판정 | 고정 태그 mock | A-06 control 연동 + 주기적 대사(reconciliation) |
| 배치 | R4 파이프라인 내 시연 | 글로벌 게이트(A-01과 병렬 pre-trade) 확정 |
| 근거 태그 | 반사기 고정 | venueStatus 확정 시 Reg ATS·§15(c) 조건부 태그 |

## 14. 잔여 확정 항목

1. 명부 반영 지연 창(P0) — off-chain 계열 판정과 온체인 명부 반영 사이의 window; 즉시 반영 메커니즘·SLA 설계(아키텍트·거버넌스).
2. 매니페스트 배치(P0) — R4 소속 vs `manifest.globalGates` 전역 배치의 확정; pre-trade 봉쇄 누락 방지(아키텍트·Manifest).
3. BD·ATS 지위 미결(P1) — 확정 시 Rule 301(b)(10)·§15(c)(1)의 조건부 근거 및 감독·기록 의무 활성화(외부 전문 자문·SEC Crypto Task Force).
4. 1차 배포 예외의 범위(P1) — 운영자가 발행자·transfer agent를 겸하는 구조에서의 경계(발행 아키텍처 확정 후 법률 검토).
5. 다크풀·거래장 운영자 자기거래 집행 사례의 pinpoint 인용(P2) — sec.gov 1차 출처 확정(외부 자문·리서치).
6. 계열 control 판정의 off-chain 경계(P2) — 계약상·간접 지배 경계 사례의 판정 기준을 A-06과 공유·명문화.
7. fail-safe 발동 시 UX(P2) — 가용성과 보수적 차단의 균형·재시도 정책(아키텍트·프로덕트).
8. 전용 컨트랙트·off-chain Operator Layer의 구현(현재 미구현).

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~2절 (개요·규범적 근거) | 파생 | 보경 walkthrough §1·§3.0.2(Authority 표) |
| 제3.1~3.3절 (법적 성격·지위 독립·게이트형) | 파생 | 보경 §1.3·§3.1~§3.3·§8.2~§8.3 |
| 제3.4절 (Reg ATS·§15(c) 조건부) | 파생 | 보경 §3.4~§3.6·§3.10 |
| 제3.5절 (제한대상 범위·Rule 405) | 파생 | 보경 §3.7 |
| 제3.6절 (ICA §17 부적용) | 파생 | 보경 §3.9 |
| 제3.7절 (§9(a)(1)·예외 범위) | 파생 | 보경 §3.8·§6.3·§3.11 |
| 제4절 (확정·잔여) | 파생 | 보경 §12 Open Issues·문서 말미 잠금 결론 |
| 제5~13절 (목표 구현) | 목표 | 보경 §2·§5·§6·§9·§11 + A-01(게이트 패턴) + `SPEC.md` §2·§3·§4 |
| 제9절 (reasonCode) | 목표 | 보경 §6.2(Failure codes) + §5.2~§5.3(판정 로직) |
| 제14절 (잔여 확정) | 목표 | 보경 §12 Open Issues |

전용 컨트랙트가 구현되면 제2부를 실장 기준으로 갱신한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `F-01_operator-self-dealing.md` (2026-07-21) — 레포 `docs/compliance/elements/` 교체 대상.
- 패턴 참조: A-01(제재 명단 negative screen 게이트) · A-06(Rule 405 control 판정 연동) · A-04(ONCHAINID 신원)
- 공유 개념: `SPEC.md` 제1·2·3·4·6·7절 (Element/Recipe/Manifest·검증 패턴·on/off-chain 경계·글로벌 게이트)
- 1차 출처(반사기 — 무조건): 15 U.S.C. § 78j(b)(Exchange Act §10(b)) · 17 C.F.R. § 240.10b-5 · 15 U.S.C. § 77q(a)(Securities Act §17(a))
- 1차 출처(Reg ATS·중개업자 반사기 — 조건부): 17 C.F.R. § 242.301(b)(1) · § 242.301(b)(10) · 15 U.S.C. § 78o(c)(1)(Exchange Act §15(c)(1)) · 17 C.F.R. § 240.10b-3
- 1차 출처(제한대상 범위 — 보조): 17 C.F.R. § 230.405(affiliate·control) · 15 U.S.C. § 78c(a)(18)(associated person) · 17 C.F.R. § 240.12b-2(참조, 실질 동일)
- 1차 출처(가장매매 — 보조): 15 U.S.C. § 78i(a)(1)(Exchange Act §9(a)(1))
- 1차 출처(ICA §17 부적용 — 배경): 15 U.S.C. § 80a-17(a) · § 80a-3(c)(7) · § 80a-2(a)(3)
- Layer 3(해석): Reg ATS 채택 · 63 FR 70921 (Dec. 22, 1998) · Rel. No. 34-40760 — 301(b)(10) 기밀·자기계좌 통제 취지
- 배경(리스크): 다크풀·ATS 운영자 자기거래 집행선(pinpoint 인용은 §12 Open Issue P2로 외부 자문 이관, sec.gov 1차 출처 확정 후 반영)

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 검토본(2026-07-21) 기반. 제1부: 반사기(§10(b)/10b-5·§17(a)) 무조건적 뿌리 + Reg ATS 301(b)(10)·§15(c)(1) 조건부 보강의 이중 구조, 운영자 지위 미결과의 독립성, 사전 하드 게이트가 유일하게 부합하는 근거(증명서형·감시형 부적합 + fail-safe), 제한대상 집합의 범위(Rule 405 기능적 control·§3(a)(18) associated person), ICA §17 부적용(negative finding: §3(c)(7) 미등록 + §2(a)(3) 비관계자), §9(a)(1) 가장매매 보조 근거와 예외(1차 배포·강제회수)의 좁은 경계. 제2부: 전용 컨트랙트 미구현 → 목표 규격(게이트 판정 구조·negative screen 인터페이스·REQ-F01-1~12·reasonCode 6종·불변식·의존성·인수 기준). 조직상 R4 / 실행상 글로벌 게이트의 이중성과 명부 반영 지연 창을 P0 잔여 쟁점으로 명시.
