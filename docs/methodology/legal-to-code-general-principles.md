---
type: core-methodology
title: 법률 코드화 일반원리 (Legal-to-Code Mapping — General Principles)
status: v1.0 — core 자료
audience: 개발팀·법무팀·외부 consultant·업계 publication 후보
created: 2026-06-14
related-external-sources:
  - "ERC-3643 (T-REX) Standard: https://eips.ethereum.org/EIPS/eip-3643"
  - "ONCHAINID: https://www.onchainid.com/"
  - "DAML Documentation: https://docs.daml.com/"
  - "Canton Network: https://www.canton.network/"
  - "Securities Act of 1933: https://www.law.cornell.edu/uscode/text/15/chapter-2A"
  - "Securities Exchange Act of 1934: https://www.law.cornell.edu/uscode/text/15/chapter-2B"
  - "Investment Company Act of 1940: https://www.law.cornell.edu/uscode/text/15/chapter-2D/subchapter-I"
  - "Reg D Rule 506(c): https://www.law.cornell.edu/cfr/text/17/230.506"
  - "Reg D Rule 501(a) (Accredited Investor): https://www.law.cornell.edu/cfr/text/17/230.501"
  - "Rule 144: https://www.law.cornell.edu/cfr/text/17/230.144"
  - "Rule 405 (control): https://www.law.cornell.edu/cfr/text/17/230.405"
  - "Rule 2a51-1: https://www.law.cornell.edu/cfr/text/17/270.2a51-1"
  - "Rule 2a51-3: https://www.law.cornell.edu/cfr/text/17/270.2a51-3"
  - "Rule 3c-5 (Knowledgeable Employee): https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.3c-5"
tags: [core-methodology, legal-tech-mapping, decipher-architecture, blockchain-compliance, RWA, ERC-3643]
---

# 법률 코드화 일반원리 (Legal-to-Code Mapping — General Principles)

> **이 문서는 무엇인가.** Decipher RWA DEX의 가장 근본적인 지적 자산이다. 미국·EU·한국 등의 **법률 조문·규칙·판례를 blockchain compliance code(Solidity·TypeScript·ERC-3643·ONCHAINID)로 변환하는 일반 원리·패턴·의사결정 프레임워크**를 정리한다. 개별 부품(Element)·레시피(Recipe) walkthrough를 쓸 때의 *이론적 토대*이자, 신규 부품을 설계할 때의 *체크리스트*이며, 외부 자문·변호사·업계에 공유하는 Decipher의 *방법론(methodology)*이다.
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 읽히도록 작성했다. 개별 부품을 예시로 들 때는 그 내용을 이 문서 안에 요약해 넣는다. 인용은 미국 연방법·연방규칙·판례·업계 표준(ERC-3643·DAML 등) 등 **외부 공식 자료만** 사용한다.
>
> **읽는 법 — Pattern + Example.** 모든 원리는 두 부분으로 제시된다. **Part A(추상 패턴)**는 일반 원리·의사결정 규칙이고, **Part B(구체 예시)**는 그 패턴이 실제 부품(Qualified Purchaser·Accredited Investor·Affiliate 등)에서 어떻게 적용되는지를 단계별로 보여준다. 추상만으로는 와닿지 않고, 예시만으로는 일반화가 안 되므로 둘을 항상 붙인다.

> ✅ **인용 정확성 노트.** 본 문서의 법령 인용은 연방규칙 원문(eCFR·Cornell LII)으로 대조했다. 특히 자주 혼동되는 항목을 못 박아 둔다 — Knowledgeable Employee 규칙은 **Rule 3c-5**(Rule 2a51-3 아님), Qualified Purchaser의 reasonable belief는 **Rule 2a51-1(h)**, Reg D 적격투자자의 제3자 검증방법은 **Rule 506(c)(2)(ii)(C)**다.

---

## §1. 프로젝트 맥락 — Decipher는 무엇을 푸는가 (Context First)

### 1.1 Decipher RWA DEX가 풀려는 core problem

**RWA**(Real-World Asset, 실물·전통자산) tokenization은 펀드 지분·채권·부동산·주식 같은 전통 금융자산을 blockchain token으로 표현(representation)하고 거래(trading)하는 패러다임이다. 그런데 blockchain은 본래 **open, permissionless**(누구나·허가 없이 참여)한 성격인 반면, 전통 증권법은 **strict compliance**(KYC, 투자자 자격, 전매 제한, 이해관계자 규제 등)를 요구한다. 이 둘은 근본적으로 충돌한다.

쉽게 말하면 — blockchain은 "아무나 들어와서 자유롭게 거래"가 기본값인데, 증권법은 "자격을 확인하고, 안 되는 사람은 막아라"가 기본값이다. **Decipher는 이 충돌을 해소하는 DEX(decentralized exchange) compliance protocol**이다. blockchain의 개방성·효율성은 유지하면서, 법이 요구하는 strict requirement를 *코드로 자동화*한 인프라다.

이 구현의 핵심 난제는 한 문장으로 압축된다 — **"법률 조문·규칙·판례를 blockchain code로 *정확히* 매핑하는 것."** 조문이 모호하면 코드도 모호한 결과를 낸다. 조문을 오해석하면 곧 법 위반이다. 그래서 이 매핑은 *기술의 문제인 동시에 법학의 문제*이고, 바로 그 교차점이 Decipher의 core value proposition이다.

### 1.2 왜 이 법-기술 매핑이 어려운가

다섯 가지 어려움이 겹친다. 각각이 뒤(§2~§9)에서 다룰 패턴의 *존재 이유*다.

**(a) 비결정성(Non-Determinism).** 법률 조문의 상당 부분이 사람의 판단(human judgment)을 요구한다. 예: "reasonable belief(합리적 신뢰)", "power to direct(지배·지시 권한)", "family relationship(가족관계)", "intent to acquire(취득 의도)", "sophisticated person(세련된 투자자)". blockchain의 **deterministic computation**(같은 입력에 항상 같은 출력 — 결정론적 계산)은 이런 판단을 재현할 수 없다. → 패턴 B(§2.2)·원리 5(§3.5)의 이유.

**(b) Cross-jurisdiction(다관할).** 미국·EU·한국·일본 등 관할마다 법체계가 다르다. 같은 자산이 국경을 넘어 거래되면 다관할 compliance가 동시에 필요하다. → §9의 이유.

**(c) On-chain 한계.** gas cost(연산 수수료), throughput(처리량), data availability(데이터 가용성), immutability(불변성), upgrade 난이도. 모든 compliance 로직을 on-chain에 올릴 수는 없다. → 패턴 B·C(§2)와 4-Layer 분리(§4)의 이유.

**(d) Operational Integration(운영 통합).** KYC 기관·broker-dealer(증권 중개업자)·transfer agent(명의개서대행 — 한국의 명의개서대행회사에 해당)·audit firm 등 off-chain operator와의 통합, 그리고 그들 사이의 법적 책임 분배가 필요하다. → Layer 4·4.5(§4.2)와 책임 분배(§5.3)의 이유.

**(e) Temporal Dynamics(시간 동학).** 법령 개정·판례 형성·규제 가이던스 변화에 따라 스펙이 진화한다. 코드는 한 번 배포하면 바꾸기 어려운데, 법은 계속 변한다. → 원리 8(§3.8)과 버전 관리·결론(§11)의 이유.

### 1.3 본 자료의 역할

이 문서는 다섯 가지로 쓰인다 — ① 개별 부품·레시피 walkthrough를 쓸 때의 이론적 토대, ② 신규 부품을 설계할 때 "이 패턴들 중 어디에 해당하는가"를 짚는 체크리스트, ③ 외부 자문·변호사에게 Decipher 방법론을 설명하는 공유 자료, ④ Sprint 결정 세션·아키텍처 재검토의 근거, ⑤ 더 크게는 *법-기술 매핑을 업계 수준에서 체계화*하려는 시도(향후 publication 후보).

### 1.4 Industry Parallel — 우리만 이 문제를 푸는 게 아니다

같은 문제를 다른 각도에서 푸는 업계 시도들이 있다. Decipher의 위치를 잡으려면 이들과의 동형·차이를 알아야 한다(상세는 §8).

**DAML**(Digital Asset Modeling Language — 디지털자산 모델링 언어)은 Canton Network의 smart contract 언어로, *기계가 검증할 수 있는 법적 계약 모델링*을 목표한다. 권리·의무 보유자를 Signatory·Observer·Controller로 명시하는 방식이 Decipher의 Manifest(자산별 권리상태 선언)와 동형이다.

**Canton Network**는 privacy-preserving(거래 비밀 보존) DLT로, 거래의 부분 비밀성과 다관할 자산 통합을 강점으로 한다. RWA tokenization 업계의 선두 중 하나다.

**ERC-3643(T-REX)**은 security token compliance 표준으로, **ONCHAINID**(온체인 신원·claim 관리)와 결합해 작동한다. **Decipher의 primary technical stack**이다 — identity·compliance module·token registry·claim 관리를 표준화한다.

**R3 Corda·Hyperledger Fabric**은 permissioned DLT(허가형)로 법적 compliance를 실험해 왔다.

Decipher의 차별점은 *protocol portability*(어느 규제환경에서도 작동하는 프로토콜 불변성)와 *Element/Recipe 모듈식 프레임워크*에 있다(§8.4).

---

## §2. 법령 → 코드 변환의 3 기본 패턴

Decipher는 모든 부품의 구현을 세 패턴 중 하나(또는 조합)로 분류한다. 어떤 부품을 설계할 때 가장 먼저 던지는 질문이 *"이건 A·B·C 중 무엇인가"*다.

### 2.1 패턴 A — 직접 계산형 (Deterministic Direct Computation)

**정의**: 조문이 명확한 **quantitative threshold**(수치 기준)와 **deterministic comparison**(결정론적 비교)만 요구하는 경우. 온체인 코드가 직접 계산한다.

#### Part A — 추상 패턴

적용 조건은 셋이다 — ① 기준이 수치로 조문에 명시(6개월·$5M·100명 등), ② 비교 대상이 결정론적으로 수집 가능(보유기간·토큰 잔고·제재명부 일치 여부), ③ judgment-based 요소가 없음. 이 셋이 모두 참이면 패턴 A다.

쉽게 말하면 — *"기계가 자·계산기만으로 잴 수 있는가?"*가 판별 질문이다. 잴 수 있으면 A다.

#### Part B — 구체 예시

- **Sanctions(제재) 검사**: OFAC SDN(제재대상) 명부와의 직접 일치 — 명부 자체가 결정론적 데이터다.
- **Country Restriction(국가 제한)**: 허용 관할(jurisdiction whitelist) 일치 검사.
- **Holding Period(보유기간)**: Rule 144(d)의 6개월(보고회사)/1년(비보고회사) — block timestamp 비교로 끝난다.
- **Claim Freshness(증명서 신선도)**: 발급 시점(verifiedAt) timestamp 비교.

> **17 CFR § 230.144(d) — 보유기간** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.144)]
>
> **Original**(요지): restricted securities는 reporting company의 경우 최소 **6개월**, non-reporting company의 경우 최소 **1년**의 holding period를 충족해야 Rule 144 전매 안전항을 쓸 수 있다.
>
> **한글 해석**: 거래소 공시의무가 있는 회사(reporting)면 6개월, 아니면 1년을 보유해야 한다. 둘 다 "며칠 지났나"라는 순수 시간 계산이다.

```solidity
// 패턴 A 예시: 순수 결정론적 비교
function checkSanctions(address buyer) view returns (bool) {
    return !sanctionsRegistry.isSanctioned(buyer);
}

function checkHoldingPeriod(uint256 acquiredAt, bool isReportingCompany) view returns (bool) {
    uint256 minPeriod = isReportingCompany ? 180 days : 365 days;
    return block.timestamp >= acquiredAt + minPeriod;
}
```

해설: 위 코드에는 *판단*이 한 점도 없다. "제재명부에 있나/없나", "며칠 지났나"만 본다. 그래서 온체인에 통째로 올려도 안전하고 싸다.

**한계**: judgment-based 요건(지배관계·가족관계·의도 등)은 패턴 A로 처리할 수 없다. 그때 패턴 B로 간다.

### 2.2 패턴 B — 증명서 확인형 (Off-chain Delegation via Signed Claim)

**정의**: 조문이 사람의 판단을 요구하는 경우. **off-chain trusted entity**(신뢰받는 오프체인 주체 = Trusted Issuer)가 판단을 수행하고 **signed claim**(서명된 증명서)을 발급하면, 온체인 코드는 그 claim의 *결정론적 확인*만 한다.

#### Part A — 추상 패턴

적용 조건 — ① judgment-based 요소 포함(control·relationship·intent·sophistication 등), ② "reasonable belief(합리적 신뢰)" 같은 **safe harbor**(면책 안전항)가 법적 토대를 제공, ③ Trusted Issuer 같은 off-chain 주체가 실사(due diligence)와 attestation(확인)을 수행할 수 있음.

패턴 구조는 항상 같다 — 오프체인에서 *판단하고 서명*, 온체인에서 *확인*.

```
[Off-chain]
1. 매수인이 Trusted Issuer에 증거 제출
2. Trusted Issuer가 실사 + 법적 판단 수행
3. reasonable belief 형성 (safe harbor 작동)
4. Trusted Issuer가 판단 결과를 부호화해 claim에 서명
[On-chain]
5. DEX가 ONCHAINID에서 claim 조회
6. DEX가 서명·발급기관 신뢰·유효기간·basis enum 확인
7. claim 내용에 따른 결정론적 PASS/FAIL
```

#### Part B — 구체 예시

- **Accredited Investor(적격투자자) 검사**: Reg D Rule 506(c)의 제3자 검증 + Rule 501(a)의 judgment-based 범주.
- **Qualified Purchaser(QP) 검사**: Rule 2a51-1(h) reasonable belief + Rule 2a51-3 목적형성 회사 + Rule 3c-5 Knowledgeable Employee.
- **Affiliate(이해관계자) 검사**: Rule 144(a)(1)·Rule 405의 "power to direct" 판단.

> **17 CFR § 270.2a51-1(h) — Reasonable Belief** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**: "The term 'qualified purchaser' ... means any person that meets the definition of qualified purchaser ... or that a **Relying Person reasonably believes** meets such definition."
>
> **한글 해석**: QP에는 *실제로* 정의를 충족하는 자뿐 아니라, 펀드(또는 그 대리인 = Relying Person)가 *합리적으로 QP라고 믿는 자*도 포함된다. 사후에 아니었음이 드러나도 면제가 곧바로 깨지지 않는다. (주의: 이 안전항은 (g)가 아니라 **(h)**이며, 흔히 인용되는 "reasonable care" 문구는 규칙 *문언*에는 없다 — 실무상 상당한 주의가 요구된다는 *취지*와 구분.)

```solidity
// 패턴 B 예시: 증명서 확인 (판단은 오프체인, 확인만 온체인)
struct QPClaim {
    bytes32 claimId;
    address subject;
    address issuer;
    uint8   basis;          // enum: 자연인/가족회사/신탁/기관/KE
    uint256 verifiedAt;
    bytes32 documentHash;   // 오프체인 증거의 해시
    bytes   signature;
}

function checkQP(address buyer, address asset) view returns (CheckResult) {
    QPClaim memory claim = onchainID.getClaim(buyer, TOPIC_QP);

    if (claim.claimId == 0)                      return CheckResult.FAIL_NOT_QP;
    if (!verifySignature(claim))                 return CheckResult.FAIL_NOT_QP;       // 위조
    if (!trustedIssuerRegistry.isApproved(claim.issuer))
                                                 return CheckResult.FAIL_UNTRUSTED_CLAIM_ISSUER;
    if (block.timestamp > claim.verifiedAt + freshnessCap)
                                                 return CheckResult.FAIL_CLAIM_EXPIRED;
    // basis enum 분기 (가족회사면 look-through cascade 등)
    return CheckResult.PASS;
}
```

해설: 온체인 코드 어디에도 "이 사람이 $5M을 가졌나"를 *계산*하는 부분이 없다. 그 판단은 Trusted Issuer가 오프체인에서 끝냈고, 코드는 *"믿을 만한 기관이 서명했고, 기간이 안 지났는가"*만 본다. 비유하면 — 기계는 판사의 *판결문 위조 여부*만 확인하고, 판결 자체는 사람(Trusted Issuer)이 한다.

오프체인(Layer 4.5) 쪽에서 claim을 발급하는 코드는 대략 이렇다:

```typescript
// 패턴 B의 오프체인 측: Trusted Issuer가 판단 후 서명 claim 발급
async function issueQPClaim(buyer: Address, evidence: EvidencePackage): Promise<SignedClaim> {
  const basis = await reviewAndClassify(evidence);        // 사람/규칙 기반 법적 판단(비결정)
  if (basis === null) throw new Error("QP 미충족 — claim 미발급");
  const claim = {
    subject: buyer,
    topic: TOPIC_QP,
    basis,                                                 // 판단 결과를 enum으로 부호화
    verifiedAt: now(),
    documentHash: keccak256(evidence.documents),           // 증거 원본은 오프체인, 해시만 온체인
  };
  return signWithIssuerKey(claim);                          // 서명 = "내가 reasonable belief로 판단했다"
}
```

해설: 비결정적 판단(`reviewAndClassify`)은 전부 오프체인에 있고, 온체인에는 그 *결과(enum)와 증거 해시*만 올라간다. 증거 원본(자산명세서 등)은 프라이버시상 온체인에 올리지 않고 해시만 anchor한다.

**Legal foundation**: 이 패턴은 reasonable belief safe harbor(Rule 2a51-1(h), Reg D Rule 506(c)(2)(ii)(C)의 제3자 검증 등)가 없으면 성립하지 않는다. 안전항이 없으면 Trusted Issuer가 strict liability(무과실 책임)를 지게 되어 패턴 B를 쓸 수 없다.

### 2.3 패턴 C — 외부 Oracle형 (External Deterministic Data Feed)

**정의**: 외부의 결정론적 데이터를 **oracle**(외부 데이터를 온체인에 전달하는 장치)을 통해 가져온다. 주로 가격·NAV(순자산가치)·환율.

#### Part A — 추상 패턴

적용 조건 — ① 외부 데이터가 결정론적(가격·NAV 등), ② 판단 요소 없음, ③ oracle 인프라를 신뢰할 수 있음. 패턴 C는 "사실(fact)을 전달"할 뿐 "판단(judgment)"은 하지 못한다는 점이 핵심이다.

#### Part B — 구체 예시

- 펀드 토큰의 **NAV feed**(순자산가치 피드) — 예: 일·월 단위로 갱신되는 BUIDL 기준가.
- 전매 가치 계산을 위한 **price feed**.
- 다통화 compliance를 위한 **FX rate**(환율).

```solidity
// 패턴 C 예시: 외부 NAV를 oracle로 받아 거래 한도/가격 검증에 사용
interface IPriceOracle {
    function latestNAV(address asset) external view returns (uint256 nav, uint256 updatedAt);
}

function checkNavFreshness(address asset) view returns (bool) {
    (, uint256 updatedAt) = priceOracle.latestNAV(asset);
    // oracle 데이터 자체가 stale하면 거래 보류 (판단이 아니라 '신선도' 확인)
    return block.timestamp <= updatedAt + NAV_STALENESS_CAP;
}
```

해설: oracle 코드도 *판단*은 하지 않는다 — NAV라는 *사실*을 받아오고, 그 사실이 너무 오래됐는지(신선도)만 확인한다. 이 점이 결정적이다. "이 사람이 QP인가"는 사실 전달이 아니라 법적 판단이므로 oracle로 풀 수 없다 — 그래서 QP는 패턴 C가 아니라 B다. 패턴 C는 *객관적 수치가 외부에 이미 존재할 때*만 쓴다.

### 2.4 3 패턴 비교 매트릭스

| 패턴 | 입력 유형 | 판단 처리 | 온체인 비용 | 법적 토대 |
|---|---|---|---|---|
| **A** 직접 계산형 | 수치·결정론적 | 없음 | 낮음 | 조문의 직접 준수 |
| **B** 증명서 확인형 | judgment-based | 오프체인 위임 | 낮음(claim 확인만) | reasonable belief safe harbor |
| **C** 외부 oracle형 | 외부 결정론적 | 없음 | 중간(oracle gas) | 피드 계약 |

판별 순서(권고): ① 자·계산기로 잴 수 있나? → A. ② 사람의 판단이 필요한가? → B. ③ 외부의 객관적 수치가 필요한가? → C.

### 2.5 Hybrid Patterns — 실제 부품은 섞인다

복잡한 부품은 둘 이상의 패턴을 결합한다.

- **Affiliate 부품**: 패턴 B(Trusted Issuer claim) + 운영형(시간에 따른 decay 모니터링).
- **Qualified Purchaser 부품**: 패턴 B 위주이되, $5M·$25M threshold *비교* 자체는 패턴 A 요소(다만 그 금액을 *판정*하는 것은 오프체인 B).

해설: 그래서 패턴 분류는 "이 부품은 100% A"가 아니라 "*주(主)는 B, 종(從)으로 A 요소*"처럼 읽어야 한다. 부품 설계 문서에는 주 패턴과 종 요소를 함께 적는다.

---

## §3. 법-기술 매핑의 9대 핵심 원리

3 패턴(§2)이 *큰 분류*라면, 9대 원리는 *조문을 실제로 코드로 옮길 때 반복되는 변환 규칙*이다. 각 원리는 Part A(추상)와 Part B(실제 부품 예시)로 제시한다.

### 3.1 원리 1 — 조문 → if-then-else 변환

#### Part A — 추상 패턴
법률 조문은 대체로 *조건(if) → 효과(then)* 구조로 분해된다. 변환 절차는 다섯 단계다 — ① 조문에서 조건(if part) 식별, ② 효과(then part) 식별, ③ 조건을 sub-clause로 분해(AND/OR/NOT), ④ 각 sub-clause에 evidence type 매핑, ⑤ 각 evidence type에 수집·검증 경로 정의.

#### Part B — §3(c)(7)(A) → Qualified Purchaser 부품
> **§ 3(c)(7)(A)** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-3)]
>
> **Original**: "Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities."

분해하면:
```
IF  (모든 outstanding securities가 취득 시점에 QP 소유)   ← 조건 1 (Condition 1)
AND (public offering을 하지 않음)                       ← 조건 2 (Condition 2)
THEN ICA 투자회사 등록 면제
```
- 조건 1 → 매수인 측 *Qualified Purchaser 부품*이 담당(매 거래의 매수인이 QP인지).
- 조건 2 → 부품 하나로 끝나지 않는 Recipe-level 문제(DEX 거래환경 전체가 "공모"를 유발하는지).
- 각 sub-clause에 evidence(QP claim, 발행 방식)와 검증 경로(Trusted Issuer 실사)를 매핑한다.

5단계 분해를 표로 끝까지 밀면:

| 단계 | 산출물 | §3(c)(7)(A) 적용 |
|---|---|---|
| ① 조건 식별 | if part | "취득 시점에 QP 배타적 소유" + "공모 아님" |
| ② 효과 식별 | then part | 투자회사 등록 면제 |
| ③ sub-clause 분해 | AND/OR/NOT 트리 | (모든 보유자 QP) AND (NOT 공모) |
| ④ evidence 매핑 | 각 절의 증거 | QP claim(매수인) / 발행 방식·청약 범위(자산) |
| ⑤ 검증 경로 | 수집·확인 주체 | Trusted Issuer 실사 → 서명 claim → 온체인 확인 |

해설: 한 조문이 *한 부품*에 곧장 대응하지 않을 수 있다는 게 중요하다. §3(c)(7)(A)는 조건 1만 부품으로 떨어지고, 조건 2는 레시피·운영 차원으로 올라간다. 분해를 건너뛰면 이 경계를 놓친다.

### 3.2 원리 2 — Sub-요건 AND/OR 결합 + Boolean Algebra

#### Part A — 추상 패턴
조문의 AND·OR·NOT 결합은 **boolean algebra**(불 대수 — 참/거짓 논리 연산)로 부호화한다. 드모르간 법칙(De Morgan: NOT(A AND B) = (NOT A) OR (NOT B))으로 거절 로직을 단순화할 수 있다. 핵심은 *결합자(AND/OR)를 조문에서 정확히 읽어내는 것* — "and"가 실제 누적요건인지, 예시 나열인지 구분해야 한다.

#### Part B — Rule 501(a)(5) → Accredited Investor 부품(자연인 순자산)
> **17 CFR § 230.501(a)(5)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.501)]
>
> **Original**(요지): a natural person whose individual net worth, or joint net worth with spouse, exceeds **$1,000,000**, *excluding the value of the primary residence*.
>
> **한글 해석**: 주거주택 가치를 *제외한* 순자산이 $1M을 초과하는 자연인.

부호화:
```
isAccredited_netWorth = (자연인) AND ((총자산 - 주거주택 - 부채) > $1,000,000)
```

**드모르간 적용(거절 로직 단순화)**: "통과 = A AND B"이면 "거절 = NOT(A AND B) = (NOT A) OR (NOT B)"다. 위 식의 거절 조건은:
```
거절 = (자연인 아님) OR (순자산 ≤ $1,000,000)
```
즉 거절 사유를 *각각 독립된 코드*로 떼어낼 수 있다(원리 7의 enum 분기와 연결) — "법인이라 이 경로 부적용"과 "순자산 미달"은 서로 다른 거절 코드·다른 안내 메시지가 된다. AND를 OR로 뒤집는 이 변환이 §6의 granular failure code 설계의 수학적 근거다.

해설: 여기서 "주거주택 제외"가 *NOT* 항으로 들어간다. 이걸 놓치면 주택부자를 모두 적격투자자로 통과시키는 오작동이 난다. 조문의 단서절("excluding ...")이 boolean 식의 한 항이 된다는 점을 보여주는 예다.

### 3.3 원리 3 — Threshold Inclusive/Exclusive 결정

#### Part A — 추상 패턴
조문의 *언어*가 경계값 포함 여부(≥ vs >)를 결정한다. 영어 법조문 관용:
- "not less than X" → **≥ (inclusive)**
- "at least X" → **≥ (inclusive)**
- "more than X" → **> (exclusive)**
- "in excess of X" → 원칙 **>**, 단 실무상 ≥로 운영해 경계 불일치를 피하기도 함

**경계값(exact X) 처리**가 핵심이다. 정확히 X인 경우의 PASS/FAIL을 조문 언어에 따라 결정하고, 코드와 테스트에 *명시*한다.

#### Part B — QP $5M 경계
QP 자연인 기준은 §2(a)(51)(A)(i)에서 "not less than $5,000,000"이다. 따라서 **정확히 $5M이면 통과**(inclusive). 이를 테스트 케이스로 못 박아 두지 않으면, 개발자가 `>`로 짜서 정확히 $5M인 정당한 매수인을 부당하게 차단할 수 있다.

해설: 경계값은 사소해 보여도 *법률가가 정해주지 않으면 개발자가 임의로 결정*하게 되는 대표적 지점이다. inclusive/exclusive를 조문 언어로 확정하는 것이 원리 3의 전부다.

### 3.4 원리 4 — Time-of-Acquisition·시간 기준점 처리

#### Part A — 추상 패턴
법령이 "at the time of X", "as of date Y", "within Z period"를 명시할 때, blockchain의 *어느 timestamp*를 그 시점으로 볼지가 문제다. 후보는 넷 — ① Trade matching(체결) time, ② Transaction proposed(mempool 진입) time, ③ Transaction confirmed(블록 포함) time, ④ Transaction finalized(완결) time. 각 옵션의 법적 부합도·운영 리스크를 따져 best fit을 고르고 변호사 검증을 받는다.

#### Part B — §3(c)(7) "at the time of acquisition" → QP 부품
QP 부품은 취득 시점에 매수인이 QP여야 한다는 요건을 가진다. 네 후보를 같은 기준으로 비교하면:

| timestamp 후보 | 법적 "취득 시점" 부합 | 운영 리스크 |
|---|---|---|
| Trade matching(체결) | 불일치 — 아직 정산 미확정 | 높음(정산 실패 가능) |
| Transaction proposed(mempool) | 불일치 — 포함 보장 없음 | 높음(re-org·교체 가능) |
| **Transaction confirmed(블록 포함)** | **최적 — 법적 execution에 가장 부합** | 낮음(단일 블록 확정) |
| Transaction finalized(완결) | 보수적 부합 — 필요 이상 늦음 | 가장 낮음 |

**Decipher 권고: Transaction confirmed time**(블록 포함 시점의 block.timestamp). confirmed가 법적 "execution"에 가장 부합하면서 운영 리스크가 낮다. (정확히 어느 timestamp가 법적 취득 시점인지는 최종적으로 변호사 확인 대상이다.)

해설: 비유하면 — *주문서 사인 시점*(matching)과 *등기 완료 시점*(confirmed) 중 무엇을 "취득"으로 보느냐의 문제다. 경계 거래(claim 만료 직전 체결 → 직후 confirmation)에서 결과가 갈리므로, frontend에서 만료 임박 시 조기 안내하는 UX 보완이 필요하다.

### 3.5 원리 5 — Reasonable Belief → Off-chain Delegation

#### Part A — 추상 패턴
비결정성을 결정성으로 *캡슐화(encapsulate)*하는 원리다. judgment-based 조문은 reasonable belief 안전항을 토대로 off-chain Trusted Issuer에 위임하고, 온체인은 그 서명 결과만 확인한다(패턴 B의 법적 엔진). 상세는 §5에서 심층 전개한다.

#### Part B — 세 부품 공통
Accredited Investor(Rule 506(c)(2)), Qualified Purchaser(Rule 2a51-1(h)), Affiliate(Rule 144 reasonable belief) 모두 이 원리 위에 선다. 안전항 조문이 부품마다 다를 뿐 구조는 같다 — *판단은 밖에서, 확인은 안에서*.

### 3.6 원리 6 — Recursive Look-Through·Bounded Recursion

#### Part A — 추상 패턴
조문이 "directly or indirectly", "through one or more intermediaries", "beneficial owner" 같은 *재귀적 개념*을 포함할 때. 의사결정 프레임워크 — ① 최대 재귀 깊이(max depth)를 법 실무 기반으로 결정, ② 각 layer에서 어떤 부품이 cascade로 발동하는지, ③ 부분 충족(partial completion)을 FAIL로 볼지 SUSPEND(대기)로 볼지, ④ gas cost 고려. **bounded recursion**(상한이 있는 재귀)이 핵심 — 무한 들여다보기는 비용·복잡도가 폭발한다.

#### Part B — Family Company → Look-Through cascade
> **§ 2(a)(51)(A)(ii)** + **17 CFR § 270.2a51-3** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-3)]
>
> **Original**(2a51-3 요지): 목적형성 회사(formed for the specific purpose)는 *각 beneficial owner가 모두 QP*일 때만 QP로 인정된다.

가족회사가 QP가 되려면 그 안의 구성원을 따라 들어가야 한다(look-through). 3단 구조라면:
```
Family LLC A → 구성원 → (그중 Family LLC B) → 그 파트너들 → ...
```
한 명이라도 QP 미충족이면 사슬 전체가 끊긴다(strict — 원리 9). Decipher는 이를 Look-Through 부품 cascade로 구현하되, 네 가지 설계 결정을 명시한다:

| 결정 | 선택지 | Decipher 처리 |
|---|---|---|
| 최대 깊이(max depth) | 즉시 소유자만 / N단 / 무제한 | 법 실무 기준 깊이로 상한(변호사 확인) — 무제한 금지 |
| 부분 충족(partial) | 미완료를 FAIL로 / SUSPEND로 | 구성원 KYC *진행 중* → SUSPEND, *미충족 확정* → FAIL |
| 발동 위치 | 매 단계 cascade | 가족회사·신탁 갈래에서만 발동(자연인·기관은 미발동) |
| gas 비용 | 온체인 재귀 / 오프체인 선계산 후 결과만 | 깊은 재귀는 오프체인에서 선계산, 온체인은 결과 확인(패턴 B) |

해설: 여기서 *목적형성 회사 규칙은 Rule 2a51-3*이고, *펀드 임직원 제외 규칙은 Rule 3c-5*다(자주 혼동되므로 재차 명시). 둘은 다른 규칙이다.

### 3.7 원리 7 — Statutory Exception → Enum Branch

#### Part A — 추상 패턴
조문이 예외·carve-out을 두면, 그것을 별도 **enum branch**(열거형 분기)로 부호화한다. 예외를 일반 로직에 녹이지 말고 *독립 분기*로 두어야, 예외의 발동 조건과 처리를 명확히 추적·감사할 수 있다.

#### Part B — Knowledgeable Employee 제외
> **17 CFR § 270.3c-5(b)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.3c-5)]
>
> **Original**(요지): §3(c)(7) 펀드 지분이 QP에게 배타적으로 소유되는지를 판정할 때, **Knowledgeable Employee**(임원·이사·또는 투자활동에 12개월 이상 관여한 직원)가 보유한 지분은 *계산에서 제외*한다.

QP 부품의 basis enum에 `KNOWLEDGEABLE_EMPLOYEE` 분기를 두고, 이 분기는 $5M threshold를 적용하지 않는 대신 *소속 펀드 일치*를 확인한다. 정확히는 "QP로 간주"가 아니라 "exclusively-QP 판정에서 *제외*"하는 메커니즘이다(Rule 3c-5(b)).

해설: 같은 Rule 3c-5(a)(4)의 Knowledgeable Employee 정의가 *Reg D 적격투자자 2020 개정*에서도 쓰인다 — private fund의 KE는 그 펀드 증권에 대해 적격투자자로도 인정된다. 하나의 예외 정의가 두 제도(적격투자자·QP)에 걸치는 사례다.

### 3.8 원리 8 — Decay·Time-Decaying Constraint

#### Part A — 추상 패턴
법령이 시간에 따라 *변하거나 소멸하는* 제약을 둘 때(예: 일정 기간 경과 후 지위 소멸, 증명서 만료). timestamp + window로 부호화한다.

#### Part B — Affiliate decay + Claim freshness
Affiliate(이해관계자) 지위는 그 지위를 벗어난 뒤에도 Rule 144상 일정 기간(약 3개월) 잔존 효과가 따라붙는다 — 시간에 따라 *decay(감쇠)*한다. 또 QP claim은 1년(권고) 만료로 *freshness*가 감쇠한다. 둘 다 "지금 시점 − 기준 시점"을 보는 window 비교로 구현한다.

해설: Affiliate 부품의 freshness(약 90일)가 다른 부품(1년)보다 짧은 이유가 이 원리다 — 지위 변동이 잦고 법적 민감도가 높은 요건일수록 window를 짧게 잡는다.

### 3.9 원리 9 — Strict vs Substantial Compliance

#### Part A — 추상 패턴
조문이 "exclusively", "all", "only"를 쓰면 **strict compliance**(엄격 준수) — 단 한 건의 위반도 전체를 FAIL시킨다. "substantial", "material"이면 부분 허용(tolerance)이 있다. Decipher 기본값은 **strict + 보수적 처리**다: 경계에서 통과로 미는 것보다 *더 엄격한 결과 또는 REVIEW로* 보낸다(false negative보다 false positive가 위험하다는 비대칭 — 자격 미달자를 통과시키는 쪽이 자격자를 막는 쪽보다 법적으로 치명적).

#### Part B — §3(c)(7) "exclusively"
§3(c)(7)(A)의 "owned **exclusively** by ... qualified purchasers"가 전형적 strict 요건이다. 단 한 명의 non-QP 취득이 펀드 전체의 면제를 깨뜨린다(§5.1의 existential risk). 그래서 QP 부품은 의심스러우면 통과가 아니라 거절 또는 수동검토(REVIEW_QP_UNCERTAIN)로 보낸다.

해설: Affiliate 부품에서도 같은 비대칭이 적용된다 — 경계에서 "비-affiliate로 통과"보다 "affiliate로 처리 또는 REVIEW"가 보수적이다. 원리 9는 *어느 방향으로 틀릴 것인가*를 정하는 메타 규칙이다.

---

## §4. Decipher 6-Layer Architecture — *On-chain (Layer 1~4) + Off-chain (Layer 0·Layer 5)*

### 4.1 *6-Layer 통합 구조 (On-chain vs Off-chain 분류)*

패턴(§2)과 원리(§3)가 *변환의 문법*이라면, 6-Layer는 *변환 결과를 담는 그릇*이다. ***Layer 1~4는 on-chain 위주·*Layer 0·5는 off-chain 위주***로 *명확히 *분리된다.

| 분류 | Layer | 역할 | 법적 대응 |
|---|---|---|---|
| **Off-chain (User-side)** | **Layer 0 — User Interaction** | frontend 자기신고·*KYC onboarding·*경로 선택 | 매수인 의도 *진입점 |
| ***On-chain*** | **Layer 1 — Element** | atomic check 부품(원자적 검사 단위) | 법령 sub-요건 1개 |
|  | **Layer 2 — Recipe** | orchestration·*conflict resolution (조합·*충돌 해소) | 법률별 누적 요건 |
|  | **Layer 3 — Manifest** | 자산별 compliance 상태 | 문서 추적·*감사 기반 |
|  | **Layer 4 — Operator Interface** | off-chain 주체와의 *온체인 *통합 인터페이스 (Trusted Issuer Registry·*claim schema 등) | 신뢰기관 *온체인 등록 |
| **Off-chain (Operator-side)** | **Layer 5 — Off-chain Operator Operations** | Trusted Issuer 팀의 *실사 작업·*수동 검토 큐·*audit trail·*claim 발급 process | 실제 *법적 판단 + due diligence 수행 |

쉽게 말하면 — Element는 *단어*, Recipe는 *문장*, Manifest는 *그 자산의 신상카드*, Operator (Layer 4)는 *판단·집행하는 사람들과의 인터페이스*, **Layer 0·5는 그 사람들이 실제 *말하고 일하는 영역*** — *온체인 *4 layer가 *볼 수 없는 *영역이다.

### 4.2 *Layer 0·Layer 5 — *Off-chain 영역의 *명시 *필요성*

부품 walkthrough를 쓰다 보면 반복해서 드러나는 통찰: ***4 on-chain layer만으로는 production system이 완결되지 않는다.*** 2 off-chain layer를 *명시적으로 *설계해야 한다.

- **Layer 0 — User Interaction (Off-chain user-side)**: frontend 자기신고(self-identification)·*KYC onboarding·*경로 선택. 예컨대 Knowledgeable Employee 예외는 매수인이 "나는 펀드 직원"이라고 *frontend에서 선언*해야 비로소 그 경로의 실사가 시작된다. 자기신고가 없으면 표준 경로에서 막혀 예외가 작동하지 못한다. ***이 층의 *입력이 *Layer 5 실사의 *trigger*이며·*Layer 1~4 *온체인 흐름의 *시작점*이다***.
- **Layer 5 — Off-chain Operator Operations (Off-chain operator-side)**: Trusted Issuer 팀의 실사 작업·*수동 검토 큐·*reasonable belief 형성·*claim 발급·*audit trail. ***이 층이 *Decipher 시스템 *품질의 *결정적 *변수*** — *Layer 1~4 코드가 *완벽해도 *Layer 5 *Trusted Issuer의 *법적 판단 *역량이 *부족하면 *전체 *시스템이 *무너진다.

> ⚠️ **명명 변경 (v1.1·2026-06-14)**: v1.0의 "Layer 4.5"는 *Layer 4와의 *명확한 *분리를 *위해 ***"Layer 5"***로 *renumber. *Layer 4 (on-chain Operator 통합 인터페이스)와 *Layer 5 (off-chain Operator 실제 운영)는 *서로 다른 *책임 영역.

해설: 이 확장은 패턴 B(§2.2)의 직접 귀결이다 — 판단을 오프체인에 위임하는 순간, 그 판단을 *시작시키는 입력(Layer 0)*과 *수행하는 운영(Layer 5)*이 시스템의 일부가 된다. 그래서 **Decipher 설계 문서에는 *6-Layer 모두를 *명시 articulation해야 *production-ready***. 4-Layer만 그리면 *시스템 일부가 *invisible해진다.

### 4.3 각 Layer의 책임 분리

| Layer | 결정 권한 | 책임 주체 | On-chain / Off-chain |
|---|---|---|---|
| Layer 0 | 사용자 자기신고 | 매수인(허위표시 시 직접 책임) | Off-chain (user-side) |
| Layer 5 | 오프체인 법적 판단·*claim 발급 | Trusted Issuer(reasonable care 의무) | Off-chain (operator-side) |
| Layer 1 | 원자적 검사 실행 | Decipher 프로토콜 코드 | On-chain |
| Layer 2 | 조합·*충돌 해소 | Decipher 프로토콜 코드 | On-chain |
| Layer 3 | 상태 보존 | Decipher 코드 + Issuer | On-chain |
| Layer 4 | Operator 통합 인터페이스 | 각 operator + Decipher | On-chain (인터페이스 정의) |

이 표가 *책임 분배(liability allocation)*의 출발점이다(§5.3에서 cascade로 전개).

### 4.4 Element의 meta-structure — 부품은 작은 레시피다

중요한 통찰: Element는 단순 boolean 검사 하나가 아니라 *내부에 분기·판정 구조를 가진 sub-architecture(mini-Recipe)*인 경우가 많다. Qualified Purchaser 부품의 5개 basis 갈래, Affiliate 부품의 9개 enum이 그 예다. **Element 내부의 reasoning depth(판단 깊이)가 곧 Trusted Issuer 측에 요구되는 역량을 결정한다.**

해설: 그래서 "이 부품은 패턴 B"라고 분류하는 것만으로 끝이 아니라, *그 부품 안에 몇 갈래의 판단이 있고, 각 갈래가 Trusted Issuer에게 무엇을 요구하는지*까지 설계해야 한다.

### 4.5 Cross-Element Cascade Patterns

| 패턴 | 예시 | 구현 |
|---|---|---|
| Direct cascade(직접 연쇄) | QP → Look-Through | 조건부 호출 |
| Cumulative trigger(누적 발동) | QP ↔ Claim Freshness | 항상 호출 + 결과 결합 |
| Conflict resolution(충돌 해소) | Accredited Investor vs QP(이중 구조) | AND 결합 |
| Recipe-level recursion | Recipe가 Element 집합을 재귀 | recipe orchestration |

해설: 부품은 혼자 움직이지 않는다. 가족회사 매수인이면 QP 부품이 Look-Through 부품을 부르고, 그 결과에 펀드 관계자가 있으면 Affiliate 부품이 또 붙는다. 이 cascade를 설계도로 그려두지 않으면 누락·*중복이 생긴다.

### 4.5.1 *Exhaustive Coverage Principle — *하나의 부품 = *모든 *논리적 *경우의 수의 *집합*

***중요한 *설계 *원칙***: ***하나의 *component (Element·*Recipe)당 *그 *component가 *처리해야 *하는 *모든 *논리적 *경우의 *수가 *exhaustive하게 *프로그래밍되어야 *한다***.

쉽게 말하면 — *Element가 *"부분 *판정"·*"일부 *경우만 *처리"여서는 *안 된다. *해당 *법령 *조문이 *분기하는 *모든 *path를 *Element 안에서 *exhaustively *cover하거나·*명시적 *cascade로 *외부 *Element에게 *위임해야 *한다.

***Decipher 적용 의미***:
- *각 *Element의 *failure enum이 *exhaustive — *판정 *불가 case는 *반드시 *REVIEW_*_UNCERTAIN로 *routing (§6.5 boundary case 패턴)·*"무응답" 또는 *"undefined behavior" 발생 *금지
- *Recipe orchestration도 *마찬가지 — *모든 *Element 결과 *조합에 *대해 *명시적 *처리 path 존재
- *Conflict case도 *§4.5의 *4 패턴·*§7.3의 *3 case에 *exhaustively cover

***구현 측면***:
- *Solidity의 *enum exhaustive *match·*default branch에 *REVIEW 또는 *revert·*undefined behavior 회피
- *Test coverage 측면에서 *모든 *branch 통과 보장
- *Sprint 1 결정 세션에서 *각 Element의 *모든 *branch가 *enumerate되었는지 *checklist 검증

***왜 *exhaustive인가***: *법률은 *deterministic answer를 *요구한다 (적법 또는 *위법)·*"undefined"가 *없다. *코드가 *판정 path를 *exhaustive하게 *covering하지 *못하면·*그 *gap이 *runtime에서 *법적 *오작동으로 *현시*된다.

### 4.6 Manifest Integrity Pattern

거래 체결 직후(post-trade commit), Manifest 무결성 검사 부품이 해당 레시피의 *모든 부품 결과가 서로 모순되지 않는지*를 재검증한다(회계 감사의 재확인에 해당). 불일치 시 audit alert이 뜬다. 이는 *런타임 검사(거래 직전)*와 별개의 *사후 정합성 검사*층이다.

---

## §5. 비결정성 → 결정성의 Encapsulation Pattern

### 5.1 Core insight — "판사의 서명된 판결문"

패턴 B(§2.2)와 원리 5(§3.5)의 심층이다. 핵심 비유는 **판사의 판결문**이다. 판결문 *자체*는 명확하고 결정적인 문서다 — 하지만 그 판결에 이르는 과정은 판사의 복잡한 판단·형량의 산물이다. 기계는 판결문의 *위·변조 여부*만 확인하고, 판결 자체는 사람이 한다.

법-코드 매핑에서 이 통찰이 결정적인 이유 — 비결정적 법적 판단(가족관계·지배관계·의도·sophistication)을 온체인 코드가 재현하려 하면 실패한다. 대신 그 판단을 오프체인에서 끝내 *서명된 증명서*로 만들고, 온체인은 그 증명서의 결정론적 확인만 한다. 이것이 *비결정성을 결정성으로 캡슐화*하는 것이다.

### 5.2 Trusted Issuer의 Legal Judgment Process

오프체인에서 일어나는 일을 6단계로 풀면:
```
1. 증거 수집(Evidence collection) — 매수인이 brokerage statement·고용증명·trust deed 등 제출
2. 규칙 적용(Rule application) — Rule 2a51-1·501(a)·144 등 해당 규칙으로 판정
3. reasonable belief 형성 — 충실한 실사로 "합리적 신뢰" 확보(safe harbor 작동)
4. 문서화(Documentation) — 판단 근거를 audit trail로 보존
5. claim 서명(Signature) — 판단 결과를 enum 등으로 부호화해 서명
6. 온체인 발행(Publication) — ONCHAINID에 claim 게시
```
이 과정의 품질이 시스템 전체의 법적 안전성을 좌우한다. Trusted Issuer는 단순 KYC 대행이 아니라 *법적 추론 능력을 갖춘 주체*여야 한다.

### 5.3 Safe Harbor의 Cascading Logic + 책임 분배

reasonable belief 안전항(Rule 2a51-1(h), Reg D Rule 506(c)(2)(ii)(C) 등)은 Trusted Issuer → 펀드(Issuer) → DEX로 *연쇄(cascade)*한다.

| 행위자 | reasonable belief 적용 | 책임 상한 |
|---|---|---|
| **매수인(Buyer)** | 해당 없음 | 허위표시 시 직접(사기) 책임 |
| **Trusted Issuer** | 직접 적용(반드시 reasonable care) | reasonable care 위반 시 과실 책임 |
| **펀드(Issuer)** | cascade(Trusted Issuer가 형성) | safe harbor 보호 |
| **DEX(인프라 제공자)** | cascade(Trusted Issuer 의존) | 명확한 case law 미정 — open question |

해설: 가장 불확실한 칸이 마지막 줄이다. Decipher 같은 *인프라 전용(infrastructure-only)* 제공자가 어디까지 면책되는지는 확립된 판례가 없다. "거래를 중개한 게 아니라 코드만 제공했다"는 항변이 통하는지는 변호사 follow-up 대상이다.

### 5.4 *Privacy Implications — *Off-chain Claim Model의 *Side Effect와 *ZK Proof Evolution*

증명서 확인형 (패턴 B)의 *off-chain delegation 구조는 *법적 *비결정성 *해결의 *primary purpose 외에 ***중요한 *side effect — *privacy preservation***을 *제공한다. *blockchain의 *public ledger 특성과 *증권법의 *KYC·*compliance 요구 사이의 *충돌을 *완화하는 *layered 구조다.

#### *Layer 1 — *Off-chain Claim Model이 *해결하는 *부분*

- ***Raw evidence (자산명세서·*고용 계약서·*KYC document 등)는 *off-chain***·*Trusted Issuer 측 *DB에만 *저장
- *On-chain에는 *서명된 *claim의 *enum·*timestamp·*signature·*document hash만 *기록·*raw 데이터 *노출 없음
- *Buyer-facing message도 *generic + actionable만 (§6.2)·*제3자 evidence 노출 없음

***구체 예시 (QP claim case)***: 매수인 Y의 *$7M brokerage statement는 *Trusted Issuer X의 *off-chain DB에만 *존재. *블록체인에는 *`{basis: QP_NATURAL, verifiedAt: ..., issuer: ..., signature: ..., documentHash: ...}` 형태의 *claim만 *기록. *제3자 (DEX·*observer·*blockchain analytics)는 *Y의 *자산 *내역을 *볼 수 *없으며·*"QP 자격 보유 사실"만 *알 수 *있다.

#### *Layer 2 — *Off-chain Claim Model이 *해결하지 *못하는 *부분*

- ***Block confirmation 시점·*매수인 address·*asset 매수 자체는 *public*** → *blockchain analytics·*chain analysis로 *trading pattern·*buyer behavior 추적 가능
- ***Claim의 *basis enum이 *enumerated되면 *그 자체로 *buyer category 노출*** — *예: *"매수인 X가 *KE claim 보유 for BUIDL" → *"X는 *BlackRock 직원"으로 *추론 가능
- ***Trusted Issuer 측 *DB 보안*** → *off-chain leak risk·*Decipher *통제 *밖

#### *Layer 3 — *Future — *ZK Proof Evolution*

Zero-Knowledge proof와의 *결합으로 *완전 *privacy-preserving compliance 가능:

| ZK proof 적용 | 현재 (off-chain claim) | ZK proof 적용 후 |
|---|---|---|
| $5M 이상 *증명 | claim.basis = QP_NATURAL 공개 ($5M *금액은 *비공개) | claim 발급 없이·*"≥ $5M" *증명·*aspect 자체도 *비공개 가능 |
| KE 자격 *증명 | claim.coveredCompany 공개 (KE 신분 노출) | ZK proof로 *"this person is *some fund의 *KE"·*어느 fund인지 *비공개 가능 |
| Affiliate 자격 | basis enum 공개 (officer/director 노출) | ZK proof로 *"non-affiliate" 증명·*affiliate인지 여부 *외 *비공개 |

#### *현재 *Decipher 권고 — *Layer 1+2 trade-off 수용*

ZK proof 인프라가 *RWA tokenization에 *production-ready 단계가 *아직 *아니므로 (gas cost·*proof generation time·*verification cost·*Trusted Issuer 측 ZK circuit 설계 부담 등), *현재는 *off-chain claim model이 *primary layer. *Layer 2의 *residual privacy 우려는 *trade-off로 *수용·*operational reasonability 확보.

***Future direction (§10.2 ZK proof 항목과 *direct cumulative)***: ZK proof 인프라 성숙 시 *Decipher의 *Trusted Issuer가 *claim 대신 *ZK proof 발급·*on-chain verifier 검증·*evolution layer 추가.

#### *Decipher 맥락의 *Reality Check — *Immediate Privacy *우려는 *제한적*

위 *3-Layer 분석은 *technical *worst-case 시나리오. *그러나 *Decipher가 *대상으로 *하는 *RWA DEX의 *실제 *시장 *맥락에서는 ***immediate privacy 우려가 *생각보다 *제한적***이다 — *3 *factor가 *우려를 *완화한다.

**Factor 1 — *DEX의 *장외거래 (OTC) 성격*

Decipher가 *지원하는 *§3(c)(7) fund·*Reg D 506(c) 증권은 *전통 증권법상 *qualified investor only marketplace로·***public stock exchange (NYSE·*NASDAQ) 같은 *공개시장이 *아니라 *사실상 *장외거래 (over-the-counter)에 *해당***. 장외거래는 *historically *privacy 요구 *수준이 *공개시장 *trading보다 *낮다 (실시간 *호가·*거래 volume *공개 의무 *최소·*거래 *상세도 *participants 외 *공개 안 됨). Securitize·*tZERO·*INX의 *secondary trading platform도 *유사한 *qualified investor only 성격이며·*그들의 *operational *경험에서 *privacy가 *primary concern으로 *부각된 *사례는 *드물다.

**Factor 2 — *Blockchain의 *Pseudonymity가 *제공하는 *기본 layer*

Buyer의 *wallet address ↔ real identity 매핑은 *Trusted Issuer 측 *off-chain DB에만 *존재. *Blockchain observer는 ***pseudonymous address*** (0x... 형태)만 *볼 수 *있을 뿐·*real identity는 *직접 *노출되지 *않는다. 동일 *주체가 *여러 *wallet을 *사용하면 *추가 *분리 가능. *Layer 2 우려 (block timestamp·*claim basis enum 노출 등)도 *real identity와 *직접 *연결되지 *않는 한 *abstract pattern으로만 *남는다.

**Factor 3 — *Trusted Issuer DB 보안이 *real concern의 *집중점*

Layer 2의 *실질적 *privacy 위협은 *대부분 ***Trusted Issuer 측 *off-chain DB의 *breach risk***로 *수렴. *이는 *전통 *KYC 인프라 (broker-dealer·*custodian·*KYC vendor)*가 *수십 년간 *다뤄온 *영역으로·*Decipher *고유의 *문제가 *아니다. *기존 *industry *standard (SOC 2·*ISO 27001·*encryption at rest·*access control 등)으로 *대처 가능.

#### *Implication — *ZK Proof 우선순위 *재평가*

위 *3 factor를 *고려하면·*ZK proof는 ***immediate roadmap의 *critical path가 *아니라 *future *competitive moat***로 *재평가된다:

- *Decipher의 *초기 *value proposition은 *"법률 *판단을 *코드로 *encapsulate"가 *primary·*"complete privacy"는 *secondary
- *Securitize·*tZERO·*INX precedent에서 *증명되었듯·*off-chain claim model + 표준 *KYC 보안만으로 *현재 *industry의 *privacy *기대치 *충족 가능
- *ZK proof는 *Decipher가 *industry-leading position을 *유지하는 *long-term *evolution layer (§10.2)·*immediate implementation 필수 *아님

#### *결론*

> ***Privacy는 *off-chain claim model + DEX의 *장외거래 *성격 + blockchain pseudonymity의 *3중 *layer로 *현실에서 *대체로 *충족·*Layer 2의 *technical worst-case 우려도 *Trusted Issuer DB 보안 *집중점으로 *수렴·*industry standard로 *대처 가능***. *ZK proof는 *완전 해결의 *future evolution layer로·*competitive moat·*long-term direction이며·*immediate roadmap critical path가 *아니다.

이 *Reality Check는 *Decipher의 *resource *우선순위 *결정에 *함의를 *준다 — *primary focus는 *§3.1 *비결정성 → 결정성 *encapsulation의 *법-기술 매핑 *완성도·*ZK proof 결합은 *후순위. *3-Layer Privacy 구조 *자체는 *Decipher가 *blockchain *transparency의 *우려를 *완화하는 *방식이지만·*그 *완화의 *대부분이 *이미 *Layer 1 (off-chain claim)에서 *달성된다.

### 5.5 패턴 B의 한계

- Trusted Issuer 측의 *체계적 실패(systematic failure)* 시 cascade 전체가 무너진다.
- 그래서 Layer 3(External Spot-Check, 무작위 audit)가 meta-control로 필요하다 — Layer 2 자체의 품질을 점검하는 층.
- Trusted Issuer의 선정·onboarding·상시 모니터링이 critical하다.

쉽게 말하면 — 패턴 B는 "신뢰기관이 제대로 판단한다"는 가정 위에 선다. 그 가정이 무너지면 코드가 아무리 완벽해도 결과가 틀린다. 그래서 *신뢰기관을 신뢰할 수 있게 만드는 층(Layer 3)*이 따로 필요하다.

---

## §6. Failure Code 설계 패턴

거절(FAIL)을 어떻게 설계하느냐가 시스템의 *법적 방어력*과 *사용자 경험*을 동시에 좌우한다.

### 6.1 Granularity 원리 — 거절 코드를 얼마나 잘게 나눌까

#### Part A — 추상 패턴
high-level 거절("자격 없음") 하나로 뭉치지 말고, *왜* 실패했는지에 따라 sub-failure로 분류한다. 코드가 잘게 나뉘어야 ① 매수인에게 정확한 다음 행동을 안내할 수 있고, ② 감사 시 원인을 추적할 수 있고, ③ 운영팀이 패턴을 분석할 수 있다.

#### Part B — Qualified Purchaser 부품의 9개 거절 코드
하나의 부품이 9가지로 갈린다. 같은 "거절"이라도 *되돌리는 방법*이 제각각이므로 코드를 나눈다.

| 거절 코드 | 트리거 | 처리(되돌리는 법) |
|---|---|---|
| FAIL_NOT_QP | claim 없음·갈래 불일치·서명 위조 | KYC 시작/재시도 (reject) |
| FAIL_CLAIM_EXPIRED | 유효기간 경과 | 신뢰기관 갱신 (reject) |
| FAIL_UNTRUSTED_CLAIM_ISSUER | 발급기관 미등록 | 다른 신뢰기관 재발급 (reject) |
| FAIL_LOOKTHROUGH_REQUIRED | 가족회사/신탁인데 구성원 자료 부재 | 추가 자료 제출 (reject) |
| FAIL_LOOKTHROUGH_NOT_COMPLETED | 구성원 일부 KYC 진행 중 | 대기 (**suspend**) |
| FAIL_TRUST_DISQUALIFIED | 수탁자·위탁자 결합요건 미충족 | 구조 재검토 (reject) |
| FAIL_FAMILY_CO_NOT_QP | 구성원 중 미충족자 | 구성원 보강 (reject) |
| FAIL_KE_NOT_QUALIFIED | 소속펀드 불일치·관여 미충족 | KE 자격 재검증 (reject) |
| REVIEW_QP_UNCERTAIN | 자동 판정 불가 | 수동검토 큐 (**suspend**) |

해설: 9개 중 2개(LOOKTHROUGH_NOT_COMPLETED·REVIEW_UNCERTAIN)만 suspend(대기)이고 나머지는 reject다. 이 구분이 사용자 경험을 가른다 — "자격 없음"은 명확히 거절하되, "아직 확인 중"은 대기시켜 같은 거래가 나중에 통과되게 한다.

### 6.2 Buyer-Facing vs Internal 분리

#### Part A — 추상 패턴
매수인 화면에는 *일반적이고 행동 가능한* 메시지만, 내부 audit log에는 *구체적 실패 사유*를 남긴다. 개인정보 보호와 운영 진단을 분리하는 것이다.

#### Part B
신탁 매수인에게 "당신 신탁의 위탁자 X가 자격 미달"이라고 노출하면 제3자 자산정보가 샌다. 그래서 화면에는 "Trust 구조 검토가 필요합니다. 담당팀에 문의"만, 내부 로그에는 미충족 위탁자 목록을 남긴다.

### 6.3 Next Action 패턴

각 거절 코드는 *다음 행동*과 짝지어 설계한다 — redirect 경로(KYC 시작·갱신·다른 신뢰기관), 수동검토 큐, 관리자 알림, 그리고 **suspend(대기) vs reject(거절)**의 구분. "자격 없음"은 reject지만 "아직 확인 중"은 suspend다(시간이 지나면 같은 거래가 통과될 수 있으므로).

### 6.4 Audit Trail 요건

모든 결정과 *근거(reasoning)*를 Compliance Log에 남긴다(off-chain). 사후에 "왜 통과/거절했는가"를 재구성할 수 있어야 §5.3의 책임 방어가 가능하다.

### 6.5 Boundary Case → REVIEW 패턴

#### Part A — 추상 패턴
시스템이 자동으로 판정할 수 없는 경계 케이스는 거절도 통과도 아닌 `REVIEW_*_UNCERTAIN`으로 보내, 운영팀이 수동 처리한다(거래는 suspend). 자동화의 *겸손*을 코드에 박는 것이다 — "모르면 사람에게."

#### Part B
QP 부품의 `REVIEW_QP_UNCERTAIN`이 그 예다. 명부 갱신 중이거나 만료 시점이 애매한 경계에서 발동해 Trust Operations 큐로 간다.

### 6.6 False Negative vs False Positive 비대칭

#### Part A — 추상 패턴
원리 9(§3.9)의 운영판이다. 두 오류의 *법적 무게*가 다르다 — *자격 미달자를 통과(false positive)*시키는 것이 *자격자를 막는(false negative)* 것보다 대개 치명적이다(전자는 펀드 면제 상실 같은 파국, 후자는 불편). 그래서 경계에서는 *더 보수적인 쪽*으로 기운다.

#### Part B
Affiliate 부품에서 경계 시 "비-affiliate로 통과"보다 "affiliate로 처리 또는 REVIEW"를 택하는 것이 이 비대칭의 적용이다.

### 6.7 *Legal Reasoning Receipt — *거래 판정의 *법률 논증 자동 기록*

#### Part A — 추상 패턴

본 시스템의 *각 *거래 판정 (적법 *통과 또는 *위법 거절)에는 *그 결론을 *뒷받침하는 *법률 논증이 *항상 *존재한다 — 어떤 *조문·*규칙이 *적용되었는지·*어떤 *부품이 *판단했는지·*어떤 *evidence가 *base였는지. 이 *논증을 ***receipt 형태로 자동 기록***할 수 *있다면·*인간 변호사가 *작성하는 *legal memo로의 *transition이 *효율화된다.

***구상***: 각 *거래 commit 시점에 *Decipher가 *생성하는 *Legal Reasoning Receipt 후보 *fields:

| Field | 내용 | 출처 |
|---|---|---|
| `assetId` | 자산 식별자 | Manifest |
| `recipeActivated[]` | 활성화된 *Recipe (R3·*R1 등) | Recipe orchestration |
| `elementsRun[]` | 실행된 *부품 + 각 부품의 *결과 (PASS/FAIL code) | Element 결과 |
| `claimsConsulted[]` | 조회된 *claim의 *issuer·*basis·*verifiedAt·*signature hash | ONCHAINID |
| `statutoryBasis[]` | 적용된 *조문·*규칙 *citation (예: §3(c)(7)(A)·*Rule 2a51-1(h)) | 부품 *meta data |
| `cascadeChain[]` | cascade 발동 *체인 (A-13 → A-09 → A-08 등) | Recipe orchestration |
| `decisionRationale` | 1-line 결론 ("PASS — QP claim valid·*all cascade complete") | 부품 *failure code + meta |
| `timestamp` | block.timestamp (acquisition 시점 *snapshot) | blockchain |
| `txHash` | 거래 *해시 (audit reference) | blockchain |

이 *receipt가 *off-chain audit log·*또는 *event emission으로 *기록되면·*사후에 *변호사가 *legal memo로 *transition할 *때 *evidence base가 *완성된다 — *"이 거래가 *왜 *적법한가 / *왜 *차단되었나"의 *논증이 *automatically *재구성 가능*.

#### Part B — *On-chain vs Off-chain *receipt 구현 *trade-off*

***완전 *on-chain *receipt — *가스비 *문제***:
- *모든 *field를 *Solidity *event로 *emit·*block에 *영구 기록 → *완벽한 *audit trail·*그러나 *gas cost ***높음*** (배열 *string·*복잡 struct emit *비싸다)
- *Element 1건당 *수천 *gas·*Recipe orchestration까지 *include 시 *수만 *gas·*전체 거래의 *상당 비율
- *실용성 측면에서 *all-on-chain은 *prohibitive

***완전 *off-chain *receipt — *trust 문제***:
- *Decipher Trust Operations team이 *off-chain DB에 *기록·*on-chain에는 *txHash 만
- *비용 *낮음·*그러나 *off-chain DB의 *integrity는 *Decipher 측 *trust에 *의존
- *audit 시 *off-chain log 위조 가능성·*blockchain의 *immutability *장점 부분 *상실

***Hybrid 권고 — *Receipt Hash Anchor***:
- *Full receipt는 *off-chain JSON으로 *생성·*저장
- *그 *receipt의 *Merkle root 또는 *keccak256 hash만 *on-chain *event로 *emit
- *Off-chain receipt의 *integrity는 *on-chain hash로 *입증 가능 (위조 시 *hash mismatch)
- *Gas cost ***low*** (event 1건 = *수백 gas)·*audit trail의 *integrity 확보
- *Decipher Compliance Log API로 *off-chain receipt 조회·*hash 대조

#### Part C — *§6.2 Buyer-Facing vs Internal 분리와의 *관계*

Buyer-facing *frontend는 *generic + actionable message만 *(§6.2)·*Legal Reasoning Receipt는 ***Internal audit log 영역***. 즉:
- *Buyer는 *receipt 자체를 *직접 *조회하지 *않는다 (privacy reasoning)
- *Audit·*변호사·*regulator만 *receipt 조회 가능
- *Buyer가 *자기 *거래에 *대한 *receipt를 *요청하면 *redacted form (자기 *evidence만)으로 *제공

#### Part D — *Future Direction — *AI-Assisted Legal Memo Generation*

receipt가 *체계적 *기록되면·*다음 *future direction이 *가능*:
- *Receipt → AI (LLM·*specialized legal NLP) → *Legal memo *draft 자동 생성
- *변호사가 *draft를 *review·*수정·*최종 발행
- *Decipher의 *cross-border RWA *cases가 *축적되면·*industry-level *legal precedent database로 *확장 가능

이 방향이 **§11.2 Future Research의 *AI-Assisted Legal Interpretation과 *direct cumulative***. *receipt는 *그 *input data layer다.

---

## §7. Cross-Element·Cross-Recipe Coordination

### 7.1 Element Cascade Patterns

§4.5의 확장이다. 핵심은 *한 부품의 결과가 다른 부품을 발동시키는* 연쇄를 명시적 지도로 그려두는 것이다.

```
Qualified Purchaser ──┬─ (가족회사/신탁) ──► Look-Through ──► (관계자면) Affiliate
                      └─ (모든 경우) ──► Claim Freshness
```
각 화살표에 *발동 조건*과 *결합 방식*을 적는다. 조건부 호출(가족회사일 때만)인지, 항상 호출 후 결과 결합(claim freshness)인지 구분한다.

### 7.2 Recipe Orchestration

여러 레시피가 한 거래에 동시에 걸릴 수 있다(multi-Recipe cumulative model). 예: 발행 레시피 + 펀드 면제 레시피가 함께 활성화되면, 매수인은 *양쪽 부품을 모두 통과*해야 한다. 레시피 간 우선순위·충돌 해소 규칙을 정의한다.

### 7.3 Conflict Resolution Rules — 3가지 전형

- **부품 vs 부품**: Accredited Investor(순자산 $1M)와 Qualified Purchaser(투자자산 $5M)는 기준이 달라 한쪽만 통과할 수 있다. 두 레시피가 동시에 걸리면 AND 결합(둘 다 통과해야).
- **부품 vs 자기 cascade**: QP 부품은 통과했는데 Look-Through에서 구성원 일부가 탈락하면, 상위 판정이 번복된다(가족회사 strict 요건).
- **레시피 vs 레시피**: 한 레시피는 탈락, 다른 레시피는 통과인 경우(예: 펀드 면제 상실인데 전매 안전항은 유효). 보수적으로 해당 자산 전체 거래를 suspend하고 운영팀이 사후 검토한다.

### 7.4 Asset Compliance Manifest Pattern

각 자산의 compliance 상태를 ManifestCore + 여러 Field로 부호화한다 — *이 자산에 어떤 레시피가 걸리는지, 어떤 사실(facts)이 참인지*를 담는 자산별 신상카드다. 부품 결과는 여기에 누적 기록되고, §4.6의 무결성 검사가 사후에 정합성을 확인한다.

해설: Manifest는 *런타임 판정 로직*을 담지 않는다(그건 Recipe의 몫). Manifest는 *사실(facts)과 상태*만 담는다 — "이 자산은 §3(c)(7) 펀드다", "발행 상태는 보수적 기본값이다" 같은. 판정 로직과 사실을 분리하는 것이 이 패턴의 핵심(단일 책임 원칙).

---

## §8. Industry Parallel — DAML·Canton·ERC-3643

법-기술 매핑은 Decipher만의 과제가 아니다. 업계의 주요 시도와 비교하면 Decipher의 위치가 또렷해진다.

### 8.1 DAML (Digital Asset Modeling Language)

**DAML**은 Canton Network의 smart contract 언어로, *기계가 검증할 수 있는 법적 계약 모델링*을 목표한다. 핵심 개념:
- **Choice·Controller·Observer**: 누가 무엇을 할 수 있고(Controller), 누가 볼 수 있는지(Observer)를 계약에 명시.
- Privacy-preserving execution(비밀 보존 실행).
- Multi-party authorization(다자 서명 권한).

Decipher와의 동형: DAML의 Signatory/Controller/Observer 모델은 Decipher의 Manifest(자산별 권리·상태 선언)와 구조가 같다 — *권리·의무 보유자를 명시*한다는 점에서.

### 8.2 Canton Network

privacy-preserving DLT로, 부분 거래 비밀성(sub-transaction confidentiality)과 다관할 자산의 상호운용을 강점으로 한다. RWA tokenization 업계의 선두 중 하나다. Decipher와의 차이: Canton은 *프라이버시·상호운용* 인프라에 무게가 있고, Decipher는 *법-코드 매핑 방법론*(Element/Recipe)에 무게가 있다 — 층위가 다르되 보완적이다.

### 8.3 ERC-3643 (T-REX)

**Decipher의 primary technical stack**이다. security token compliance 표준으로:
- **Identity(ONCHAINID)**: 온체인 신원·claim 관리.
- **Compliance modules**: 전송 가능 여부를 모듈로 검사.
- **Token registry**: 보유자·발행 관리.
- **Claim management**: 신뢰기관 발급 claim의 등록·확인.

§2.2의 패턴 B 코드 예시가 바로 ERC-3643/ONCHAINID 위에서 작동한다 — claim 조회·서명 확인·발급기관 신뢰 확인이 모두 이 스택의 기능이다.

### 8.4 Decipher의 Differential Value Proposition

DAML·Canton·ERC-3643 대비 Decipher의 고유 각도는 셋이다 — ① **protocol portability**(어느 규제환경에서도 작동하는 프로토콜 불변성 — 규제가 바뀌면 Recipe/Manifest 데이터만 갈아끼우고 핵심 프로토콜은 불변), ② **4-Layer architecture**(검사·조합·상태·운영의 명확한 분리), ③ **Element/Recipe 모듈식 프레임워크**(법령을 부품으로 분해하고 레시피로 조합).

쉽게 말하면 — ERC-3643이 *도구상자*라면, Decipher는 그 도구로 *법령을 부품화하고 조합하는 방법론*을 얹은 것이다. 그래서 본 문서(법률 코드화 일반원리)가 Decipher의 핵심 자산인 것이다.

---

## §9. Multi-Jurisdiction Compliance Patterns

§1.2(b)의 cross-jurisdiction 난제를 다루는 패턴이다.

### 9.1 Jurisdiction Boundary Detection

#### Part A — 추상 패턴
한 거래에 *자산의 관할 · 매수인의 관할 · 발행자의 관할*이 결합한다. 어느 관할의 법이 걸리는지를 먼저 판정해야 어떤 레시피를 켤지 정해진다.

#### Part B
미국 발행 펀드(BUIDL)를 한국 거주자가 사면, 미국 증권법(발행·펀드 면제)과 한국 자본시장법·외국환거래법이 동시에 시야에 들어온다. Manifest의 jurisdiction facts가 이 결합을 부호화한다.

### 9.2 Concept Mapping Across Jurisdictions

#### Part A — 추상 패턴
관할마다 "세련된 투자자" 개념의 *이름·기준·효과*가 다르다. 이를 대응표로 정리하되, *동일시하지 않도록* 한다.

#### Part B
| 미국 | 한국 | EU |
|---|---|---|
| Accredited Investor(Reg D, 순자산 $1M/소득 $200K) | 전문투자자(자본시장법) | Professional Client(MiFID II) |
| Qualified Purchaser(ICA §3(c)(7), 투자자산 $5M/$25M) | (직접 대응 없음 — 전문투자자 상위 개념 부재) | Per se / elective professional |

쉽게 말하면 — 한국의 "전문투자자"가 미국에 가면 *대략* Accredited Investor와 Qualified Purchaser를 합친 자리쯤이지만, 미국은 이 둘을 *다른 법·다른 기준·다른 목적*으로 엄격히 나눈다(§9.4).

### 9.3 Stricter Rule Wins Pattern

#### Part A — 추상 패턴
다관할이 동시에 걸리면 *가장 엄격한 규칙*을 적용하는 것이 기본값이다. 한 관할에서 막히면 전체가 막힌다(원리 9의 다관할판).

#### Part B
한국 거주자가 미국 §3(c)(7) 펀드를 살 때, 미국 QP 요건과 한국 측 제한(전문투자자·외국환 신고 등)을 *모두* 통과해야 한다. 레시피는 AND로 결합한다.

### 9.4 Concept Difference vs Concept Equivalence

#### Part A — 추상 패턴
직관적 비유(한국 전문투자자 ≈ Accredited Investor + QP)는 *이해를 돕는 도구*일 뿐 *법적 등가*가 아니다. 매핑표에는 반드시 "이것은 비유이며 등가가 아니다"라는 경계를 명시한다.

#### Part B
미국 Accredited Investor는 *발행* 단계 문턱(상대적으로 낮음)이고, QP는 *펀드 면제* 단계 문턱(훨씬 높음)이다. 기준도 다르다 — Accredited는 순자산·*소득, QP는 투자자산. 한국 전문투자자를 둘 중 하나에 곧장 대응시키면 자격 판정이 틀어진다. 그래서 cross-border 부품은 *각 관할의 개념을 독립적으로 판정*하고 결과를 결합한다(매핑은 직관용, 판정은 독립).

해설: 이 구분이 Decipher처럼 cross-border RWA를 다루는 시스템에서 특히 중요하다 — 한국 인력이 미국 개념을 한국 개념으로 *치환*해 코드를 짜면, 그 치환의 오차가 곧 법적 오작동이 된다.

### 9.5 *Multi-Jurisdiction 구현 *전략 — *Component Bloat 회피*

#### Part A — 추상 패턴

multi-jurisdiction을 *코드에 *반영하는 *2 *주요 *strategy가 *있다*:

| 전략 | 작동 방식 | 장점 | 단점 |
|---|---|---|---|
| **Strategy 1 — *Jurisdiction-fat Element*** | 하나의 *Element 내부에 *모든 *jurisdiction의 *판정 로직 *포함 | 단일 *Element가 *모든 *case 처리·*orchestration 단순 | ***Component bloat — *Element 크기·*복잡도 *exponential 증가·*maintenance 어려움·*one jurisdiction 변경이 *whole element 영향 |
| **Strategy 2 — *Jurisdiction-Swap (권고)*** | jurisdiction별 *별도 Element/Recipe·*Manifest의 *jurisdiction facts에 *따라 *Recipe orchestration이 *적절 *swap | Element 단순·*maintenance 격리·*one jurisdiction 변경이 *해당 element만 *영향 | Element 개수 *증가·*Recipe orchestration 복잡 |

**권고: *Strategy 2 (Jurisdiction-Swap)*** — *Single Responsibility Principle (SRP)·*Open-Closed Principle (OCP)에 *부합. *각 *Element는 *single jurisdiction의 *single 법령 sub-요건만 *처리·*Recipe가 *jurisdiction routing 담당.

#### Part B — *Concrete Implementation*

***예시 — *Accredited Investor 다관할 처리***:
```
A-03-US (미국 Reg D Rule 501(a))  ─┐
A-03-KR (한국 전문투자자)         ─┼─► R-Issuance가 *Manifest.jurisdiction에 *따라 *swap
A-03-EU (EU MiFID II Professional)─┘
```

- Manifest에 *`buyer.jurisdiction = US/KR/EU` field
- Recipe orchestration: *if (buyer.jurisdiction == US) → A-03-US activate·*if (KR) → A-03-KR·*if (EU) → A-03-EU
- 각 *Element는 *단일 *jurisdiction의 *조문만 *encode·*"slim element"

***Hybrid case — *동시 다관할 활성화***:
- 한국 거주자가 *미국 *§3(c)(7) 펀드 *매수: *A-13-US + A-03-KR-cross-border 둘 다 *activate
- Recipe가 *AND 결합·*"stricter rule wins" (§9.3) 적용
- 단·*이 *combine 자체도 *별도 *Recipe (R-CrossBorder-US-KR)으로 *encapsulate

#### Part C — *Element 비대화 우려에 *대한 *answer*

승준님 우려: "*하나의 element에 *각국 내용 *다 *포함시키면 *component가 *엄청 비대해지지 *않을까?"

***Answer: *YES — *그래서 *Strategy 1 (Jurisdiction-fat)이 *anti-pattern·*Strategy 2 (Jurisdiction-Swap)가 *권고***. *Element는 *single jurisdiction·*single sub-요건의 *atomic check 단위를 *유지·*Recipe가 *jurisdiction routing·*combine을 *담당.

***Trade-off***: Element 개수가 *jurisdiction 수 *× 부품 수로 *증가하지만, *각 *Element의 *복잡도가 *낮아져 *전체 *유지 비용이 *낮아진다 — *분리의 *경제학 (divide and conquer).

***Naming convention 권고***:
- *Single jurisdiction: `A-03-US`·*`A-03-KR`·*`A-13-US`
- *Cross-border combined: `R-CrossBorder-US-KR`·*`R-CrossBorder-US-EU`
- *Manifest의 *jurisdiction routing field가 *Element selection의 *single source of truth

---

## §10. 결론 + 향후 방향성

### 10.1 본 자료의 Static 부분 vs Dynamic 부분

이 문서를 유지보수할 때의 지침이다.
- **Static(장기 안정)**: 3 패턴(§2), 9대 원리(§3), 4-Layer 아키텍처(§4), 캡슐화 패턴(§5). 이들은 특정 법령이 바뀌어도 거의 불변이다 — 법-코드 매핑의 *문법*이기 때문.
- **Dynamic(Sprint별 진화)**: 개별 부품 예시(Qualified Purchaser·Accredited Investor 등)의 구체 인용·해석. 법령 개정·판례·규제 가이던스에 따라 갱신된다.

쉽게 말하면 — *문법은 고정하고, 단어는 갱신한다*. 이 문서를 고칠 때 Static 부분을 함부로 흔들지 말고, Dynamic 부분(예시)만 최신 법령으로 맞춘다.

### 10.2 향후 연구 방향

- **ZK proof와의 결합**: 영지식 증명으로 *프라이버시를 지키면서* compliance를 증명(예: "$5M 이상임"을 금액 노출 없이 증명).
- **AI-assisted legal interpretation**: Trusted Issuer의 법적 판단 역량을 AI로 보강(패턴 B의 품질이 시스템 품질을 좌우하므로).
- **Cross-chain compliance coordination**: 여러 체인에 걸친 자산의 compliance 상태 동기화.
- **RegTech 통합**: 규제기관 보고·감독 기술과의 인터페이스.

### 10.3 Decipher의 Industry Position

본 문서는 Decipher를 업계 평행선(DAML·Canton·ERC-3643) 가운데 *고유한 자리*에 놓는다 — 기존 시도들이 *인프라(프라이버시·표준·언어)*에 집중한다면, Decipher는 그 인프라 위에서 **법령을 부품으로 분해하고 레시피로 조합하는 방법론**을 제공한다. 그 방법론의 핵심 차별점이 *protocol portability*(규제가 바뀌어도 핵심 프로토콜은 불변, 데이터만 교체)다.

따라서 이 "법률 코드화 일반원리" 문서 자체가 Decipher의 core differential value proposition을 담은 자산이며, 외부 자문·투자·파트너십·업계 publication에서 Decipher의 지적 우위를 보이는 근거가 된다.

---

## §11. 변경 로그 + 파일명 규칙

> **PM 규약·*Element/Recipe ID Namespace**는 *Decipher 내부 *식별 체계로·*별도 *전용 자료에 *분리되어 *있다 (SRP). *본 *core methodology 자료에는 *식별 체계 *자체를 *포함하지 *않는다 — *Decipher 내부 *조회는 *_PM 폴더의 *전용 자료를 *참조한다.

```
파일명: 법률-코드화-일반원리.md
위치:   산출물/_core/
규칙:   _core 폴더 = Decipher의 core methodology document
        (개별 부품은 산출물/elements/, 레시피는 산출물/recipes/)
```

### 변경 로그

- **[2026-06-14] v1.1 — *사용자 인사이트 *반영 patch (insight 4·5·6·7·8)***. **§4 Layer 명명·*구조 update**: "4-Layer + Layer 0·Layer 4.5"를 ***"6-Layer Architecture — On-chain (Layer 1~4) + Off-chain (Layer 0·Layer 5)"***로 *재구성·*Layer 4.5 → Layer 5 *rename·*on-chain/off-chain 명시 분리. **§4.5.1 *Exhaustive Coverage Principle 신설**: "하나의 *component = *모든 *논리적 경우의 수의 *집합·*REVIEW로 *exhaustive routing·*undefined behavior 금지"·*Solidity enum exhaustive *match 강제. **§6.7 *Legal Reasoning Receipt 신설**: 거래 판정의 *법률 논증 자동 기록·*Receipt fields spec·*on-chain vs off-chain 구현 *trade-off·*Hybrid Receipt Hash Anchor 권고 (off-chain JSON + on-chain hash event·*gas cost low + integrity 확보)·*§6.2 Buyer-Facing/Internal 분리와의 관계·*Future: AI-Assisted Legal Memo Generation. **§9.5 *Multi-Jurisdiction 구현 전략 신설**: Strategy 1 (Jurisdiction-fat Element·*anti-pattern) vs Strategy 2 (Jurisdiction-Swap·*권고·*SRP·OCP 부합)·*Element 비대화 우려 *answer·*Naming convention (A-03-US·*A-03-KR·*R-CrossBorder-US-KR). **§10 PM 규약 *분리**: 이전 §10 (Decipher PM 규약·*ID Namespace)·*SRP 위배라 *별도 *전용 자료로 *분리·*본 §10·§11 → renumber (이전 §11 결론 → §10·*이전 §12 변경 로그 → §11)·*§11 head에 *cross-reference 표기.

- **[2026-06-14] v1.0 — 신설.** Decipher 법-기술 매핑 방법론 core 자료 최초 작성. 12개 섹션 — §1 프로젝트 맥락(core problem·5대 난제·역할·industry parallel) → §2 3 기본 패턴(직접 계산형 A·증명서 확인형 B·외부 oracle형 C + 비교·hybrid) → §3 9대 핵심 원리(if-then-else·boolean·threshold·time-of-acquisition·reasonable belief·bounded recursion·exception enum·decay·strict vs substantial) → §4 4-Layer + Layer 0/4.5 → §5 비결정성 캡슐화 → §6 failure code 설계 → §7 cross-element/recipe coordination → §8 industry parallel(DAML·Canton·ERC-3643) → §9 multi-jurisdiction → §10 PM 규약·ID → §11 결론·향후 → §12 변경 로그. **Pattern + Example 결합**(각 원리에 추상 패턴 + Qualified Purchaser·Accredited Investor·Affiliate 실제 예시), 자체완결(internal wikilink 0건), 외부 공식 자료만 인용. **인용 정확성**: A-13 v2.1 정정 반영(KE=Rule 3c-5·reasonable belief=Rule 2a51-1(h)) + 신규 인용 검증(Reg D 제3자 검증=Rule 506(c)(2)(ii)(C)·Reg D 2020 개정 categories·Rule 144 보유기간). status: v1.0 core 자료.





