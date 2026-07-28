---
type: requirement-spec
project: RWA DEX (Giwa) · corner-store
element-id: E-03
element-name: Bad Actor Disqualification (부적격자(bad actor) 배제 / Rule 506(d))
status: "v0.1 (2026-07-28) — 2부 구성. 컨트랙트 미구현(target 명세). 법적 실질은 보경 walkthrough."
substance-sot: "보경 walkthrough — E-03_bad-actor.md (2026-07-21). 레포 docs 교체 대상."
umbrella: "SPEC.md — 공유 개념(4-Layer·결정론 경계·Recipe cumulative AND·off-chain Layer 5·Trusted Issuer)은 여기에 의한다"
stateful: false
tags: [requirement-spec, E-03, bad-actor, rule-506d, reg-d, issuer-side, stateless, R1]
---

# E-03 Bad Actor Disqualification — 요구사항 명세서

본 문서는 컴플라이언스 부품 E-03(부적격자 배제)의 요구사항 명세서이다. **제1부**는 법적 근거와 논증을, **제2부**는 구현 명세를 규정한다. 법적 실질은 보경 변호사가 검토·작성한 walkthrough에 의한다. 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였으므로 제2부는 목표 명세(target specification)이며, 여기 기술되는 판정 구조·인터페이스·요구사항은 구현이 충족하여야 할 요건을 규정하는 것이지 현존 코드를 서술하는 것이 아니다. 시스템 공유 개념(4-Layer 구조, 온·오프체인 결정론 경계, Recipe의 cumulative AND, off-chain 컴플라이언스 데이터 레이어)은 `SPEC.md`에 의한다.

본 부품은 매수인의 자격을 묻는 관문이 아니라, 발행(mint) 직전에 발행 명의 뒤에 서 있는 인물 집단(covered persons)이 Rule 506 자격상실 사유에 걸리지 아니함을 확인된 증서(clearance)로 검증하는 발행자 측 관문이다. 한 사람의 전력이 발행 전체의 면제를 감염시키는 구조이므로, 확인되지 아니한 발행은 열지 아니한다(fail-closed).

---

# 제1부. 법적 근거 및 논증

## 1. 개요

E-03은 Rule 506(c) 발행 국면에서, 발행인·그 임원과 이사·발행 참여 officer·general partner·managing member·의결권 20% 이상 지분권자·promoter·pooled fund의 investment manager·보수받는 모집인 등 이른바 covered person 집단이 증권사기 유죄나 규제 제재와 같은 자격상실 사유(disqualifying event)에 걸리는지를 발행 직전에 판정하는 부품이다. 매수인이 누구인지는 묻지 아니한다. 물음의 방향은 "누가 사는가"가 아니라 "발행 명의 뒤에 누가 서 있는가"이다.

본 부품이 서는 규범적 좌표는 하나의 계보로 수렴한다. 미국 연방 증권규제의 기본값인 1933년법 §5의 등록의무에서 출발하여, §4(a)(2) 사모 면제와 그 safe harbor인 Rule 506으로 내려오고, Dodd-Frank Act §926이 신설을 위임한 Rule 506(d)의 covered person 무결 요건에 이른다. 이 요건은 2013년 9월 23일을 분기선으로 자격상실(506(d))과 서면 공시(506(e))의 두 갈래로 나뉜다. E-03은 이 두 갈래를 발행 직전 게이트로 원자화한 것이다.

## 2. 규범적 근거

등록의무의 기본값은 증권법 §5(15 U.S.C. § 77e(a)·(c))이 정한다. 이 조문은 발행 한 번이 아니라 거래 한 건 한 건에 걸리며 고의·과실을 묻지 아니하는 무과실 규범으로서, 면제가 무너지면 무게가 도착하는 종착점이다. 그 위에 §4(a)(2)(15 U.S.C. § 77d(a)(2))의 사모 면제가 있고, §4(b)(15 U.S.C. § 77d(b))는 506(c)의 일반청약이 있더라도 그 발행이 여전히 공개발행으로 간주되지 아니함을 확인한다. Rule 506(a)(17 C.F.R. § 230.506(a))는 (b) 또는 (c)의 조건을 충족하는 발행을 §4(a)(2) 거래로 의제하며, 그 조건에는 (d)의 covered person 무결이 포함된다.

자격상실 규범 자체는 Dodd-Frank Act §926(Pub. L. 111-203, title IX, § 926, 124 Stat. 1851)이 SEC에 신설을 명한 결과로서, SEC가 2013년 이를 Rule 506의 (d)·(e)항으로 채택하였다(Release No. 33-9414, 78 FR 44730). 판정의 본체는 Rule 506(d)(1)(17 C.F.R. § 230.506(d)(1))로서 covered person 집합과 자격상실 사유 (i)부터 (viii)까지의 곱으로 구성된다. 이에 대한 출구는 Rule 506(d)(2)(§ 230.506(d)(2))가 pre-2013 사건·good cause waiver·발령기관의 서면 advice·reasonable care 항변의 네 갈래로 규정하고, Rule 506(d)(3)(§ 230.506(d)(3))이 affiliated issuer의 제휴 성립 전 사건에 관한 시점 예외를 둔다. 사유가 2013년 9월 23일 이전에 발생한 경우의 서면 공시 의무는 Rule 506(e)(§ 230.506(e))가 규율한다. covered person과 사유의 범위는 정의 조항으로 고정된다 — executive officer는 Rule 501(f)(§ 230.501(f)), final order는 Rule 501(g)(§ 230.501(g)), promoter와 officer는 Rule 405(§ 230.405)가 정의한다. 문언 뒤의 해석은 채택 release(Release No. 33-9414)와 SEC Small Entity Compliance Guide(2013-09-19)가 메운다.

## 3. 쟁점별 논증

### 3.1 발행자 측 게이트라는 성격

E-03이 왜 매수인이 아니라 발행 참여자를 보는지가 문제된다. Rule 506(d)(1)은 "No exemption under this section shall be available for a sale of securities if …"로 시작하여, 열거된 covered person 중 하나라도 자격상실 사유에 해당하면 그 매도에 면제가 성립하지 아니한다고 규정한다. 이 열거는 발행인 자신부터 그 임원·이사·발행 참여 officer·general partner·managing member, 의결권 기준 20% 이상 지분권자, promoter, pooled fund의 investment manager와 그 임원들, 그리고 보수받는 모집인과 그 임원들에 이르며, 매수인은 그 어디에도 없다. 따라서 본 부품은 매수 측 자격을 검사하는 A-03(적격투자자)·A-13(적격구매자) 계열과 물음의 방향이 반대이고, 매수인 자격은 본 부품의 소관이 아니다. 이 성격상 본 부품은 발행 Recipe(R1)에만 부착되고 재판매(R2)·펀드(R3)·행위 감시(R4)에는 부착되지 아니한다.

### 3.2 covered person과 자격상실 사유의 이중 구조

무엇이 발행을 오염시키는가가 문제된다. Rule 506(d)(1)은 두 축의 곱으로 읽힌다. 축 하나는 오염원이 될 수 있는 인물 집합(covered persons)이고, 다른 하나는 오염을 구성하는 사유(disqualifying events) 여덟 범주이다. 사유 범주는 각기 다른 look-back 기간과 효력 요건을 가진다. 예컨대 증권 매매·허위신고 관련 유죄판결은 비발행인 10년·발행인 5년의 소급을 가지고, injunction과 cease-and-desist, stop order, 우편사기 명령은 5년, 주 규제기관 등의 사기 근거 final order는 10년의 소급을 가지며, 명령·bar 유형은 "at the time of such sale", 즉 매도 시점에 효력이 살아 있을 것을 요건으로 한다. 이 여덟 범주의 조사는 게이트가 직접 수행하지 아니하고 L2 검증기관의 factual inquiry로 위임되나, 그 문언 자체가 곧 발급 기준서의 조사 항목표를 이루므로 문언의 정확한 이식이 본 부품 정확도의 뿌리가 된다. 경계값에 유의하여야 한다. 20% 지분권자 기준은 이상(≥)이지 초과(>)가 아니므로, 정확히 20%의 의결권을 가진 자도 covered person이다. 이를 초과로 구현하면 정확히 20% 지분권자를 roster에서 누락하는 과소포섭 오류가 된다.

### 3.3 2013년 9월 23일 분기 — 자격상실과 공시의 갈림

같은 사유라도 결과가 왜 갈리는지가 문제된다. Rule 506(d)(2)(i)과 (e)가 그은 분기선은 자격상실 사유의 발생 시점이 규칙 발효일인 2013년 9월 23일 이후냐 이전이냐이다. 사유가 그 이후에 발생하면 (d)의 자격상실이 적용되어 발행이 Rule 506 면제를 통째로 잃고(구제·항변이 없는 한), 사유가 그 이전에 발생하면 자격상실을 면하는 대신 (e)의 서면 공시 의무로 전환된다. 이 공시는 발행인이 각 매수인에게 매도 상당기간 전에 그 사유를 "자격상실을 유발하였을 사항"으로 서면 제공하여야 하는 것으로서, waiver의 대상이 아니다. 여기에 두 함정이 있다. 분기 기준은 사건(유죄판결·명령)의 발생 시점이지 그 밑에 깔린 행위(underlying conduct)의 시점이 아니며, look-back 기간 또한 사건 시점부터 세지 행위 시점부터 세지 아니한다. SEC Small Entity Compliance Guide가 이 두 함정을 명시적으로 확인한다.

### 3.4 reasonable care 항변과 clearance 증서

발행자 측의 조사를 게이트가 왜 증서로 위임하는지가 문제된다. Rule 506(d)(2)(iv)는 발행인이 자격상실의 존재를 알지 못하였고 reasonable care를 다하였음에도 알 수 없었음을 입증하면 자격상실을 면한다고 규정하며, 그 지시문은 발행인이 "상황에 비추어 자격상실이 존재하는지에 대한 factual inquiry를 하지 아니하는 한 reasonable care를 입증할 수 없다"고 못을 박는다. 즉 이 항변의 실질은 문서화된 사실조사의 존재이다. 현실의 Rule 506(c) 사모에서 발행인이 covered person 전원에 대한 D&O 질문서·배경조사·인수기관 확인을 수행하고 그 결과를 발행 기록에 봉인하는 것도 이 때문이다. 본 부품의 clearance 증서는 이 현실의 실사 산출물을 온체인 게이트가 읽을 수 있는 형태로 옮긴 것으로서, 곧 "factual inquiry를 하였다"의 온체인 증거이다. 그러므로 조사의 실질을 규율하는 발급 기준서와 발급기관 감사가 본 부품의 실질적 방어선이 되며, 게이트는 그 증서의 유효성만 확인한다.

### 3.5 결정론 경계 — 게이트가 사유 실질을 재판정하지 아니하는 이유

게이트가 어디까지 판정하고 어디부터 위임하는지가 문제된다. 자격상실 사유의 실질 판단, 즉 어느 사유 범주에 해당하는지, look-back 계산과 매도 시점 효력(in-effect) 여부, waiver의 성립 여부는 모두 사실판단과 법률판단이 얽힌 영역으로서 결정론적 코드가 감당할 수 없다. 그러므로 이 실질은 전부 L2 검증기관이 factual inquiry로 수행하여 그 결론을 증서에 봉인하고(핵심 결론 필드 noDisqualifyingEvent), 게이트는 그 증서가 존재하는지, 인가된 발급기관의 유효한 서명이 있는지, 발행 범위에 결속되어 있는지, 신선한지, 취소되지 아니하였는지의 유효성 층위만 결정론적으로 판정한다. 게이트가 사유를 재판정하지 아니하는 것이 본 부품의 결정성의 원천이며, 이는 온체인은 검증만 하고 판단은 off-chain이 한다는 시스템 전반의 경계 원칙(`SPEC.md` §1.3)과 정합한다. 우회 경로(deemed-PASS 등)는 존재하지 아니한다.

### 3.6 신선도와 취소 — 한 번의 통과가 영구 안전이 아닌 이유

발행 개시 시점의 무결이 왜 발행 전 구간의 무결을 보증하지 못하는지가 문제된다. 자격상실 사유는 발행 개시 후에도 발생할 수 있다. 임원이 발행 도중 제재를 받는 경우가 그러하다. SEC Small Entity Compliance Guide는 발행 도중 사유가 생기면 그 전의 매도는 영향을 받지 아니하고 이후의 매도만 자격상실에 걸린다는 전환 규칙을 확인한다. 이 규범이 곧 증서에 신선도(재조사 주기)와 취소(revocation)를 필수로 얹는 근거이다. 게이트는 매 발행 거래마다 증서가 재조사 주기 내에 있고(신선도, A-11 주기에 위임) 취소되지 아니하였는지를 확인하며, 증서가 만료되었거나 취소되었으면 발행을 차단한다. 본 부품의 설계 철학은 시종 보수적이다 — 조사·확인이 봉인된 증서가 있고 그것이 신선하며 취소되지 아니한 발행만 열고, 확인이 불가능하면 막는다.

### 3.7 affiliated issuer 시점 예외

발행인이 남의 과거를 어디까지 뒤집어쓰는지가 문제된다. Rule 506(d)(3)은 affiliated issuer에 관련된 사건으로서 제휴 성립 전에 발생한 것은, 그 affiliated entity가 발행인을 control하지도 아니하고 그 사건 당시 affiliated entity를 지배하던 제3자에 의하여 발행인과 common control 하에 있지도 아니하면 자격상실 사유로 보지 아니한다고 규정한다. 즉 나중에 제휴한 남의 과거까지 발행인이 소급하여 부담하지는 아니하되, 지배관계로 얽힌 경우에는 예외 없이 소급한다. 이 control 판정 자체는 A-06의 산출을 소비하는 것으로서 본 부품이 직접 수행하지 아니하며, L2가 이 시점·control 판정의 결과를 증서의 noDisqualifyingEvent 산정에 반영한다.

## 4. 확정 사항 및 잔여 쟁점

본 부품의 발행자 측 성격, covered person과 자격상실 사유의 이중 구조, 2013년 9월 23일 분기(506(d) 자격상실 / 506(e) 공시), reasonable care 항변을 clearance 증서로 위임하는 결정론 경계, 그리고 신선도·취소의 필요성은 위와 같이 확정되었다. 다만 다음은 확정 또는 후속을 요한다. 첫째, clearance를 발급할 자격이 있는 L2 Trusted Issuer 집합(TRUSTED_BADACTOR_ISSUERS)의 구성과 그 변경 거버넌스. 둘째, 증서 신선도(재조사 주기)의 구체 값 — A-11의 보편 규율에 편승하되 주기 자체는 미확정. 셋째, entity covered person(20% 지분권자·모집인이 법인일 때)의 구성원 자격 look-through(A-08·A-09)를 증서에 연결하는 방식 — 현행은 roster 해시로 포괄. 넷째, good cause waiver와 발령기관 advice를 증서상 waiverRef로 표현·검증하는 절차. 다섯째, 본 부품의 전용 컨트랙트는 아직 구현되지 아니하였다.

---

# 제2부. 구현 명세 (목표 — 컨트랙트 미구현)

## 5. 시스템 내 위치

| 항목 | 값 (목표) |
|---|---|
| ELEMENT_ID | `E-03-v1` (미구현) |
| 분류 | 발행자 측(ISSUER_SIDE) · 단발(NON_CUMULATIVE) |
| 검증 패턴 | 기계 판정(Pattern A) — 증서의 존재·서명·범위·신선도·취소 상태를 결정론 검사. 자격상실 사유의 실질 판단(어느 사유·look-back·in-effect·waiver)만 off-chain clearance에 위임 |
| 판정 시점 | 거래 전 관문(PRE_TRADE) — 발행/mint 직전 + 상장 시점 roster·증서 검사 |
| 상태 | STATELESS — 게이트는 증서 상수·발행 컨텍스트·취소 flag의 현재 스냅샷만 읽는다. 신선도·취소·재발급은 A-11 주기·발급기관·거버넌스 경로(거래 외)로만 갱신 |
| 활성 | R1(Reg D 506(c) Issuance) 필수 attach. R2·R3·R4 비부착 — 발행 국면 전용 |
| 의존 부품 | A-08·A-09(entity covered person look-through) · A-11(증서 만료) · A-06(affiliated issuer control 판정) · E-01(Form D — 발행자 측 형제 부품) |

전용 컨트랙트가 없으므로, 본 절 이하의 판정 구조·인터페이스·요구사항은 구현이 충족하여야 할 목표를 규정한다. 발행자 측 무결의 실질 판정과 사실조사는 off-chain 컴플라이언스 데이터 레이어(Layer 5)와 L2 검증기관에서 수행하고, 온체인 게이트는 그 산출물인 clearance 증서의 유효성만 확인한다.

## 6. 목표 판정 구조

판정은 두 채널로 나뉜다. **상장 시점 검사(V채널)**는 발행 카드와 증서의 초기 정합을 상장 심사에서 확인하고, **거래 시점 게이트(G채널)**는 발행/mint 거래마다 증서의 유효성 층위를 결정론적으로 검사한다. 사유의 실질 조사(L2 평면)와 발급기관 집합 규율(GOV 평면)은 게이트 밖에 있으며 그 결과만 증서·상수로 소비된다. 아래 표는 보경 walkthrough §3.15(Sub-요건 분해 매트릭스)를 그대로 옮긴 것이다.

| 검증 단위 | 채널 | PASS 조건 | 실패 코드 |
|---|---|---|---|
| roster 선언 존재 | V | `coveredPersonRoster ≠ ∅` 이고 `rosterHash` 기재 | `FAIL_BADACTOR_ROSTER_MISSING` |
| roster 완전성 심사 | V | (d)(1) 각 범주(발행인·predecessor·affiliated issuer·이사/EO/참여officer/GP/MM·20%↑ voting owner·promoter·pooled fund IM·모집인) 식별 완료 | `REVIEW_BADACTOR_ROSTER_INCOMPLETE` |
| 증서 초기 유효 | V | clearance 존재 이고 L2 서명 이고 `scope = offeringId` | `FAIL_BADACTOR_CLEARANCE_MISSING` |
| 공시 플래그 정합 | V | `disclosure506eRequired ⇒ disclosedMattersHash` 기재 | `REVIEW_BADACTOR_506E_PENDING` |
| 증서 존재 (per-tx) | G | `clearance(offeringId) ≠ null` | `FAIL_BADACTOR_CLEARANCE_MISSING` |
| 발급자 서명 | G | `issuerOf(clearance) ∈ TRUSTED_BADACTOR_ISSUERS` 이고 서명 유효 | `FAIL_BADACTOR_ISSUER_UNTRUSTED` |
| 범위 정합 | G | `clearance.offeringId = tx.offeringId` | `FAIL_BADACTOR_SCOPE_MISMATCH` |
| 신선도 | G | `now ≤ clearance.expiry` (A-11 소관) | `FAIL_BADACTOR_CLEARANCE_STALE` |
| 미취소 | G | `!revoked(clearance)` | `FAIL_BADACTOR_REVOKED` |
| 공시 이행 | G | `disclosure506eRequired ⇒ disclosureFurnished = true` | `FAIL_BADACTOR_506E_DISCLOSURE_MISSING` |
| 사유 조사 실질 | L2 | 8범주((i)~(viii)) look-back·in-effect 조사 완료·기록 | (게이트 밖 — 부실은 증서 취소·감사) |
| 20% 산정 | L2 | `votingPowerBasis` 기준 20% 이상 지분권자 식별 | (게이트 밖 — roster 반영) |
| 신뢰 발급자 집합 규율 | GOV | `TRUSTED_BADACTOR_ISSUERS` 변경은 다중서명·time-lock + 근거 등록 | (우회 시도는 B-01 버전 검사로 표면화) |

판독 규칙 둘을 명시한다. 첫째, 게이트(G채널)는 증서의 유효성 층위만 본다. 어느 사유인지, look-back·in-effect·waiver 성립 여부의 실질 판단은 전부 증서에 봉인된 L2 결론이며, 게이트는 이를 재판정하지 아니한다. 둘째, 20% 이상은 이상(≥)이다. 정확히 20% 의결권도 covered person이므로 초과(>)로 구현하지 아니한다.

## 7. 목표 인터페이스 (plausible check signature)

E-03은 매수인 자격 게이트가 아니므로 buyer ONCHAINID의 claim을 읽지 아니한다. 대신 발행(offering)에 결속된 clearance claim을 소비한다. Pattern A 차단형이므로 F-03의 표시-비차단(flag-not-block)과 달리 실패 시 revert하며 사유 코드를 반환한다. 아래는 목표 인터페이스의 예시 시그니처이다(현행 코드 아님).

```
// 온체인 게이트(목표 — 미구현): 발행/mint 직전 결정론 검사. 실패 시 차단(revert).
// E-03은 offering-level clearance claim을 읽는다 (매수인 claim 아님).
function check(bytes32 offeringId, address from, address to, uint256 amount)
    external view returns (bool ok, uint256 reasonCode);

// 판정(의사코드) — 순서 고정, 하나라도 실패면 즉시 반환:
//   c = clearanceOf(offeringId)                                  // offering claim 조회
//   if c == null                          -> (false, FAIL_BADACTOR_CLEARANCE_MISSING)   // G1
//   if issuerOf(c) ∉ TRUSTED_BADACTOR_ISSUERS || !validSig(c)
//                                         -> (false, FAIL_BADACTOR_ISSUER_UNTRUSTED)    // G2
//   if c.offeringId != offeringId         -> (false, FAIL_BADACTOR_SCOPE_MISMATCH)      // G3
//   if now > c.expiry                     -> (false, FAIL_BADACTOR_CLEARANCE_STALE)     // G4 (A-11)
//   if revoked(c.id)                      -> (false, FAIL_BADACTOR_REVOKED)             // G5
//   if c.disclosure506eRequired && !c.disclosureFurnished
//                                         -> (false, FAIL_BADACTOR_506E_DISCLOSURE_MISSING) // G6
//   // c.noDisqualifyingEvent(post-2013 사유 부재 · waiver 반영 · 제휴 예외 반영)는
//   // L2가 봉인한 결론이며 게이트는 재판정하지 아니한다.
//   else                                  -> (true, 0)

// clearance claim.data 구조(§3.16):
//   { coveredPersonRosterHash, inquiryScope(8범주 bitset), inquiryRecordHash,
//     noDisqualifyingEvent(bool), waiverRefs[], disclosure506eRequired(bool),
//     disclosureFurnished(bool), disclosedMattersHash }
//   claim.meta: { inquiryDate, expiry, votingPowerBasis }

// 감사 이벤트:
//   emit E03Check(offeringId, rosterHash, clearanceId, disclosureResult, issuerSigHash, decidedAt)
```

`roster 선언 존재`·`roster 완전성`·`증서 초기 유효`·`공시 플래그 정합`(V채널)은 per-tx 게이트가 아니라 상장 심사에서 확인되며, 그 결과가 발행 카드(rosterHash·offeringId)와 증서에 봉인되어 G채널이 이를 대조한다.

## 8. 기능 요구사항 (목표)

- **REQ-E03-1 (차단형·fail-closed).** 발행/mint 직전에 결정론 게이트로 판정하며, 유효한 clearance 증서가 확인되지 아니하면 발행을 차단한다. 확인 불가는 통과가 아니라 차단이다.
- **REQ-E03-2 (발행자 측 한정).** covered person 집합만을 대상으로 하며 매수인 자격은 검사하지 아니한다. R1에만 부착되고 R2·R3·R4에는 부착되지 아니한다.
- **REQ-E03-3 (roster 봉인·완전성).** 상장 시점에 covered person roster의 선언 존재와 (d)(1) 각 범주의 커버를 심사하고 `rosterHash`로 봉인한다. 미선언은 차단(`FAIL_BADACTOR_ROSTER_MISSING`), 범주 미충족은 상장 심사 보류(`REVIEW_BADACTOR_ROSTER_INCOMPLETE`)로 처리한다.
- **REQ-E03-4 (증서 존재·서명·범위).** clearance 증서의 존재, 인가된 L2 Trusted Issuer의 유효 서명, `offeringId` 범위 일치를 검사한다. 각 실패에 대응하는 사유 코드를 반환한다.
- **REQ-E03-5 (신선도).** `now ≤ clearance.expiry`를 검사한다. 재조사 주기 규율은 A-11에 위임하며, 만료 시 `FAIL_BADACTOR_CLEARANCE_STALE`로 차단한다.
- **REQ-E03-6 (미취소).** 증서가 취소되지 아니하였어야 통과한다. 발행 도중 covered person에게 사유가 생겨 발급기관·Operator가 증서를 취소하면 이후 발행은 `FAIL_BADACTOR_REVOKED`로 차단한다.
- **REQ-E03-7 (506(e) 공시 게이트).** `disclosure506eRequired = true`이면 `disclosureFurnished = true`이어야 통과한다. pre-2013 사유가 존재하는 발행은 각 매수인에 대한 서면 공시 이행 없이는 통과하지 못한다(`FAIL_BADACTOR_506E_DISCLOSURE_MISSING`). pre-2013 사유가 없으면 이 게이트는 비활성으로 자동 통과한다.
- **REQ-E03-8 (사유 실질 위임).** 자격상실 사유의 실질(어느 (i)~(viii) 범주인지, look-back·in-effect·waiver 성립)은 게이트가 재판정하지 아니하고 L2 clearance의 `noDisqualifyingEvent`에 봉인된 결론을 소비한다. 게이트의 판정은 순수 결정론으로 유지한다.
- **REQ-E03-9 (STATELESS).** 게이트는 상태를 누적하지 아니하고 증서 상수·발행 컨텍스트·취소 flag의 현재 스냅샷만 읽는다. 신선도·취소·재발급은 거래 밖 경로(A-11·발급기관·거버넌스)로만 갱신한다.
- **REQ-E03-10 (20% 경계 ≥).** covered person의 20% 의결권 지분권자 기준은 이상(≥)으로 구현한다. 정확히 20%도 포함하며 초과(>) 구현은 과소포섭 오류로서 금지한다.
- **REQ-E03-11 (보존·재구성).** `E03Check` 이벤트로 어느 roster·어느 증서로 판정되었는지를 바이트 단위로 재구성 가능하게 기록한다. 감독 검사 시 발행별 판정 근거를 복원할 수 있어야 한다.
- **REQ-E03-12 (신뢰 발급자 거버넌스).** `TRUSTED_BADACTOR_ISSUERS` 집합의 변경은 다중서명과 time-lock을 거치고 근거를 등록한다. 우회 시도는 B-01 버전 검사로 표면화한다.

## 9. 거절 사유 코드 (reasonCode)

아래 사유 코드는 보경 walkthrough의 §3.15(Sub-요건 분해 매트릭스)에서 확정된 것이다(캡처된 walkthrough 사본이 §4.3에서 종료되어, walkthrough가 §6.1로 예정한 사유 코드표의 실질은 §3.15에서 취한다 — 부록 A·C 참조). `REVIEW_*`는 상장 심사 단계의 보류 사유이고, `FAIL_*`는 거래 시점 게이트의 차단(revert) 사유이다.

| reasonCode | 채널 | 발생 조건 | 근거 |
|---|---|---|---|
| `FAIL_BADACTOR_ROSTER_MISSING` | V | covered person roster 미선언(`rosterHash` 부재) | §5 fail-closed(§3.1) · (d)(1) 집합(§3.6) |
| `REVIEW_BADACTOR_ROSTER_INCOMPLETE` | V | (d)(1) 범주 중 미식별 존재(예: promoter 누락) | (d)(1) covered person 열거(§3.6·§3.10·§3.12) |
| `FAIL_BADACTOR_CLEARANCE_MISSING` | V·G | clearance 증서 부재 또는 초기 서명·범위 미충족 | Pattern B 위임(§3.7 (d)(2)(iv)) · 결정론 방어층 |
| `REVIEW_BADACTOR_506E_PENDING` | V | pre-2013 사유 플래그가 있으나 `disclosedMattersHash` 미기재 | (d)(2)(i)(§3.7) · (e)(§3.9) |
| `FAIL_BADACTOR_ISSUER_UNTRUSTED` | G | 발급자가 `TRUSTED_BADACTOR_ISSUERS` 밖 또는 서명 무효 | (d)(2)(iv) 조사 주체 신뢰(§3.7) |
| `FAIL_BADACTOR_SCOPE_MISMATCH` | G | 증서 `offeringId`가 거래 `offeringId`와 불일치 | 증서 scope 규율 |
| `FAIL_BADACTOR_CLEARANCE_STALE` | G | `now > clearance.expiry`(재조사 주기 경과) | mid-offering 사건(§3.14) · A-11 |
| `FAIL_BADACTOR_REVOKED` | G | 증서가 취소됨(mid-offering revocation) | mid-offering 취소(§3.14) |
| `FAIL_BADACTOR_506E_DISCLOSURE_MISSING` | G | pre-2013 사유 존재인데 서면 공시 미이행 | (e) 서면 공시(§3.9) |

## 10. 불변식

1. 존재·서명·범위·신선도·미취소가 확인된 clearance 증서가 없으면 발행은 열리지 아니한다(fail-closed).
2. 게이트는 증서의 유효성 층위만 판정하고 자격상실 사유의 실질은 재판정하지 아니한다. 이것이 본 부품 결정성의 원천이다.
3. E-03은 발행자 측 게이트이며 매수인 자격을 보지 아니한다.
4. 20% 의결권 지분권자 경계는 이상(≥)이다.
5. pre-2013 사유가 존재하면 506(e) 서면 공시 이행 없이는 발행이 통과하지 못한다. 이 공시는 waiver의 대상이 아니다.
6. 신선도·취소·재발급은 거래 밖 경로로만 변경되며, 거래 자체는 상태를 남기지 아니한다(STATELESS).

## 11. 의존성

```
발행 카드(offeringId·coveredPersonRosterHash·regDTrack) → V채널·G채널 (대조 앵커)
L2 Trusted Issuer(factual inquiry) → BADACTOR_CLEARANCE 증서 발급 → G①~G⑥
TRUSTED_BADACTOR_ISSUERS(거버넌스 상수) → G② 발급자 인가
A-11(증서 만료·재검증 주기) → G④ 신선도
A-06(affiliated issuer control 판정) → (d)(3) 제휴 시점 예외 → 증서 noDisqualifyingEvent 산정(L2)
A-08·A-09(entity covered person look-through) → roster 구성원 자격 → rosterHash(현행 포괄)
E-01(Form D — 발행자 측 형제 부품) → 발행 국면 병렬 관문(별도 소관)
발급기관·Operator → revoked(clearanceId) → G⑤ 취소
Router(now = block timestamp) → G④ 신선도 비교
```

의존의 방향에 유의한다. A-06·A-08·A-09의 산출은 게이트가 직접 소비하지 아니하고 L2가 증서를 발급할 때 반영하며, 게이트는 그 결과인 `noDisqualifyingEvent`와 `rosterHash`만 대조한다. A-11만이 게이트가 직접 소비하는 신선도 규율이다.

## 12. 인수 기준 (목표)

| # | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | roster 선언·완전, 증서 유효(`noDisqualifyingEvent = true`, pre-2013 사유 없음) | 발행 통과 |
| 2 | roster 미선언 | 차단 `FAIL_BADACTOR_ROSTER_MISSING` |
| 3 | roster 범주 누락(예: promoter 미식별) | 상장 보류 `REVIEW_BADACTOR_ROSTER_INCOMPLETE` |
| 4 | clearance 증서 부재 | 차단 `FAIL_BADACTOR_CLEARANCE_MISSING` |
| 5 | 미인가 발급자 서명 또는 서명 무효 | 차단 `FAIL_BADACTOR_ISSUER_UNTRUSTED` |
| 6 | 다른 offering에 결속된 증서 | 차단 `FAIL_BADACTOR_SCOPE_MISMATCH` |
| 7 | 증서 만료(재조사 주기 경과) | 차단 `FAIL_BADACTOR_CLEARANCE_STALE` |
| 8 | 발행 도중 취소된 증서 | 차단 `FAIL_BADACTOR_REVOKED` |
| 9 | pre-2013 사유 존재 + 공시 미이행 | 차단 `FAIL_BADACTOR_506E_DISCLOSURE_MISSING` |
| 10 | pre-2013 사유 존재 + 공시 이행(`disclosureFurnished = true`) | 발행 통과 |
| 11 | 정확히 20% 의결권 지분권자 존재 | roster에 포함(과소포섭 없음) — 경계값 검사 |
| 12 | post-2013 사유 + waiver(good cause·발령기관 advice) 반영 증서 | `noDisqualifyingEvent = true`이면 발행 통과 |

## 13. 잔여 확정 항목

1. 전용 컨트랙트·발급 파이프라인 구현(현재 미구현, 본 문서는 target 명세).
2. `TRUSTED_BADACTOR_ISSUERS` 발급기관 집합의 구성과 변경 거버넌스(다중서명·time-lock·근거 등록).
3. clearance 신선도(재조사 주기) 값 — A-11 주기 규율에 편승하되 구체 주기 미확정.
4. entity covered person look-through(A-08·A-09)의 증서 연결 — 현행 `rosterHash`로 포괄, `rosterAttestationChain` 예약 필드는 미구현.
5. revocation 트리거·경로(발급기관·Operator)와 그 온체인 반영의 구현.
6. 506(e) 공시의 매수인별 수령 보증(발행 UX·기록 계층)과 `disclosedMattersHash` 검증 절차.
7. good cause waiver·발령기관 advice의 `waiverRef` 표현·검증 방식.
8. 완본 walkthrough(§5~§11) 입수 시 판정 로직·테스트·Operator 계층의 원문 대조 재검증.

---

# 부록. 출처 및 연혁

## A. 절별 출처

| 절 | 성격 | 출처 |
|---|---|---|
| 제1~4장 (법적 근거·논증·확정·잔여) | 파생 | 보경 walkthrough §1·§2·§3(§3.1~§3.16) |
| 제5장 (시스템 내 위치) | 파생 | 보경 walkthrough §2(메타 정보) · SPEC.md §3·§4 |
| 제6장 (목표 판정 구조) | 목표 | 보경 walkthrough §3.15(Sub-요건 분해 매트릭스) |
| 제7장 (목표 인터페이스) | 목표 | 보경 walkthrough §3.16(clearance 필드)·§4.2 + Pattern A 차단형(SPEC.md §2.1) |
| 제8장 (기능 요구사항) | 목표 | 보경 walkthrough §3.6·§3.7·§3.9·§3.14·§3.15 |
| 제9장 (reasonCode) | 목표 | 보경 walkthrough §3.15 — walkthrough가 §6.1로 예정한 사유 코드표의 실질(캡처 사본이 §4.3에서 종료) |
| 제10~13장 (불변식·의존성·인수·잔여) | 목표 | 보경 walkthrough §2·§3.7·§3.8·§3.15·§3.16 |

주: 참조된 보경 walkthrough의 캡처 사본은 §4.3에서 종료되며 §5(판정 로직)·§6(거절·예외 처리, 예정 §6.1 사유 코드표)·§7(테스트)·§11(Operator 계층)의 원문은 사본에 포함되지 아니한다. 다만 이 사본은 §3.15에 원자적 검증 단위별 PASS 조건과 FAIL 코드를 완결적으로 담고 있고, §3.16에 clearance 필드 구조를 담고 있으므로, 제2부의 실질은 결손 없이 그로부터 유도되었다. 완본 입수 시 제5~13장을 원문 대조로 재검증한다.

## B. 근거 문헌

- 원 출처(substance): 보경 walkthrough `E-03_bad-actor.md` (2026-07-21, 본문 출처 기준 Version 1.0 · 2026-07-20) — 레포 `docs/compliance/elements/` 교체 대상(현행 승준 사본 대체).
- 패턴 참조: 기계 판정형(Pattern A) 차단형 pre-trade 게이트 — `SPEC.md` §2.1·§2.2.
- 공유 개념: `SPEC.md` §1(4-Layer·온오프체인 경계)·§2(Element·Recipe·STATELESS)·§3(Element 카탈로그 E-03)·§4(Recipe R1)·§6(off-chain Layer 5).
- 연계 부품: A-06(affiliate control) · A-08·A-09(entity look-through) · A-11(증서 유효기간) · E-01(Form D).
- 1차 출처(walkthrough 인용): 15 U.S.C. § 77e(a)·(c) · § 77d(a)(2)·(b) · Dodd-Frank Wall Street Reform and Consumer Protection Act § 926 (Pub. L. 111-203, title IX, § 926, 124 Stat. 1851) · 17 C.F.R. § 230.506(a)·(d)(1)·(d)(2)·(d)(3)·(e) · § 230.501(f)·(g) · § 230.405 · SEC Release No. 33-9414 (78 FR 44730, 2013-07-24) · SEC Small Entity Compliance Guide "Disqualification of Felons and Other 'Bad Actors' from Rule 506 Offerings and Related Disclosure Requirements" (2013-09-19).

## C. 변경 로그

- [2026-07-28] v0.1 — 보경 walkthrough(2026-07-21) 기반 2부 구성 신설. 제1부: Rule 506(d) 부적격자 자격상실 게이트 — 발행자 측 covered person과 자격상실 사유 (i)~(viii)의 이중 구조(§3.2), 2013-09-23 분기(506(d) 자격상실 / 506(e) 서면 공시, 공시는 waiver 불가)(§3.3), reasonable care·factual inquiry 항변을 clearance 증서로 위임하는 결정론 경계(§3.4·§3.5), 신선도·취소(§3.6), affiliated issuer 시점 예외 (d)(3)(§3.7), existential risk(§1.4·§3.1). 제2부: 전용 컨트랙트 미구현 → 목표 명세(V채널 상장검사·G채널 per-tx 게이트 G1~G6·L2 발급기관 평면·GOV 거버넌스, clearance claim 구조, reasonCode 9종, 기능 요구사항 REQ-E03-1~12). 주: 캡처된 walkthrough 사본이 §4.3에서 종료되어 reasonCode·판정 구조는 §6.1이 아닌 §3.15 Sub-요건 분해 매트릭스에서 확정하였고, §5·§6·§7·§11 원문 대조는 완본 입수 후 재검증 예정(제13장 8·부록 A 주 참조). implements 필드 없음(컨트랙트 미구현).
