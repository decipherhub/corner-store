---
type: element-walkthrough
element-id: A-08
element-name: Entity Eligibility
parent-recipe: R1 (Reg D 506(c) Issuance)·R3 (ICA §3(c)(7) Fund)
internal-id: ELE.A-08
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.501(a)(1)(2)(3)(7)(8)(9) — Accredited Investor entity 분류: https://www.law.cornell.edu/cfr/text/17/230.501"
  - "15 USC § 80a-2(a)(51)(A)(ii)(iv) — Family Company·기관 QP: https://www.law.cornell.edu/uscode/text/15/80a-2"
  - "17 CFR § 270.2a51-3 — 목적형성 회사 look-through 게이트: https://www.law.cornell.edu/cfr/text/17/270.2a51-3"
  - "SEC Release No. 33-10824 (2020) — Accredited Investor 정의 확대(투자 $5M entity·family office 등): https://www.sec.gov/"
created: 2026-06-17
updated: 2026-06-17
tags: [element, A-08, entity-eligibility, walkthrough, spec-sheet, R1, R3, entity]
---

# A-08 Entity Eligibility — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **법인 매수인이 *자기 자격*을 갖췄는지 산정하는 부품**(내부 식별자 A-08)을, 미국 증권·펀드 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다. 다만 본 부품은 **look-through 부품(A-09)의 *선행 게이트***이므로, 그 둘의 분기를 §9에서 자세히 다룬다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** "먼저 작성, 인용 검증은 후속 일괄 패스" 전략에 따른 1차 초안이다. 특히 Reg D Rule 501(a)의 하위 호(號) 번호(per-se 기관·자산 테스트·투자 $5M·family office)는 검증 패스에서 원문 대조로 재확인한다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 본 부품은 한 줄로 말하면 *"매수인이 법인일 때, 그 법인이 *스스로* 자격이 되는가, 아니면 *안의 사람들까지 봐야* 하는가"*를 가른다. 즉 본 부품은 *판정의 갈림길(분기기, selector)*이다. 법인이 자기 자산·종류만으로 충분하면 여기서 통과시키고, 충분치 않으면 look-through 부품(A-09)으로 넘긴다. 이 갈림길을 잘못 놓으면 — 자격 없는 법인을 통과시키거나(과소차단), 적법한 기관을 불필요한 look-through로 괴롭힌다(과잉차단).

### 1.1 두 종류의 법인 — "그 자체로 자격 있는 법인" vs "들여다봐야 하는 법인"

미국 증권·펀드 규제는 법인을 *한 덩어리*로 보지 않는다. 크게 세 부류로 나눈다.

1. **per-se(그 자체로) 자격 있는 기관** — 은행·보험사·등록 투자회사·broker-dealer 같은 *제도권 금융기관*. 이들은 자산을 따질 필요도, 안을 들여다볼 필요도 없다. *기관의 종류 자체*가 자격이다. (이미 다른 규제로 충분히 감독받는 sophisticated 주체이기 때문.)
2. **자산 테스트로 자격 있는 법인** — 일반 사업회사·신탁 등. *자기 자산이 일정 문턱($5M/$25M)을 넘고, 이 증권을 사려고 급조된 게 아니면* 자격이 된다. 안의 사람을 볼 필요 없다.
3. **들여다봐야 하는 법인** — 이 증권을 사려고 *급조된(formed for the specific purpose)* 법인, 또는 자산 테스트를 못 쓰고 *전원 적격* 경로로만 가는 법인. 이들은 안의 사람을 다 본다(look-through). → **A-09로 넘긴다.**

**본 부품(A-08)의 일은 매수 법인이 1·2·3 중 어디에 속하는지 분류하는 것**이다. 1·2면 여기서 통과, 3이면 look-through 부품을 부른다.

### 1.2 이 규제는 어느 법에서 오는가 — A-09와 같은 두 갈래

본 부품도 look-through 부품과 마찬가지로 *두 법체계*에 뿌리가 있다.

| 맥락 | 보는 자격 | 어느 법·규칙 | Decipher Recipe |
|---|---|---|---|
| **발행 면제** | Accredited Investor | 1933년법 Reg D — Rule 501(a)(1)~(12) | **R1** |
| **펀드 면제** | Qualified Purchaser | ICA §2(a)(51)·Rule 2a51-3 | **R3** |

차이는 *문턱과 종류 목록*이다. 발행 면제(accredited)는 per-se 기관 목록이 넓고 자산 문턱이 낮으며($5M total assets), 펀드 면제(QP)는 문턱이 높다(기관 $25M investments). 본 부품은 *호출 Recipe가 요구하는 자격*에 맞는 분류표를 적용한다.

### 1.3 왜 이 규제가 존재하는가 — 효율과 남용방지의 균형

look-through(A-09)가 *남용방지*를 위한 것이라면, 본 부품의 분류는 *효율과 남용방지의 균형*을 위한 것이다.

- **효율 쪽**: 골드만삭스나 대형 연기금에게 "당신 회사 안의 모든 사람이 자격이 있는지 증명하라"고 요구하는 것은 난센스다. 이미 충분히 감독받는 제도권 기관은 *종류만으로* 통과시켜 불필요한 마찰을 없앤다(per-se).
- **남용방지 쪽**: 반대로 아무 법인에게나 "회사니까 통과"를 주면 §1.1의 빈 회사 우회가 뚫린다. 그래서 *목적형성 여부*라는 안전장치로, 자산 테스트의 혜택을 *진짜 사업실질이 있는 법인*에만 준다.

쉽게 말하면: 본 부품은 *"믿을 만한 큰 기관은 빠르게, 의심스러운 껍데기 회사는 끝까지"*라는 차등을 코드로 구현한 갈림길이다.

### 1.4 Decipher 시스템에서 왜 중요한가

본 부품도 **매수인이 법인일 때만** 켜지는 조건부 부품이다. 그러나 그 역할은 *교통정리*라 시스템 정확성에 핵심이다 — 본 부품이 분류를 틀리면 그 오류가 A-09로 전파된다. 특히 **목적형성 여부 판정**이 결정적이다. 이걸 "아니다(목적형성 아님)"로 잘못 판정하면, 들여다봐야 할 껍데기 회사를 자산 테스트로 통과시켜 버린다(펀드 면제 존립 위험으로 직결). 그래서 본 부품의 설계 철학도 **"의심스러우면 look-through로 보낸다(보수적 분기)"**이다.

### 1.5 한국법과의 비교 — 전문투자자의 법인 분류

한국 자본시장법의 **전문투자자**에도 비슷한 *법인 차등*이 있어 직관 anchor로 좋다. (직관용 비유.)

한국법은 ① 국가·한국은행·금융기관·예금보험공사 등은 *그 자체로* 전문투자자(per-se에 대응)이고, ② 주권상장법인·일정 규모 이상의 법인이나 ③ 일정 금융투자상품 잔고·전문성 요건을 갖춘 법인은 *요건 충족 시* 전문투자자로 본다. "어떤 법인은 종류만으로, 어떤 법인은 자산·요건으로"라는 이층 구조가 미국과 닮았다.

차이는 **look-through의 유무**다. 한국은 일반적으로 법인 *구성원 전원*까지 자격을 따지지는 않는다(미국 Rule 501(a)(8)·2a51-3 같은 전원 look-through가 약함). 그래서 미국 쪽은 *목적형성·전원확인*이라는 추가 층이 있다는 점을 한국 인력이 특히 유념해야 한다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Entity Eligibility** | 법인 매수인의 자기 자격·분기 판정원 |
| 검사 대상 | 법인 매수인의 자격 종류(per-se / 자산테스트 / look-through 필요) | "이 회사가 스스로 자격 되나, 안을 봐야 하나" |
| Internal ID | A-08 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **증명서형**(off-chain 법인 실사 + on-chain entityClaim 확인) | 신뢰기관이 법인 종류·자산·목적형성을 판정해 claim에 부호화 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 매수 시점 스냅샷 |
| 활성화 조건 | **매수인이 법인일 때만**(conditional) | 개인 매수인이면 작동 안 함 |
| 주 활성화 Recipe | **R1**(accredited entity)·**R3**(QP entity) | 호출 Recipe가 요구 자격 결정 |
| 후행 부품 | **A-09**(look-through) | "들여다봐야 함"으로 분류되면 A-09 호출 |
| 상위 호출 부품 | **A-13**(QP)·**A-03**(Accredited) | 매수인이 법인일 때 이들이 본 부품을 cascade 호출 |
| 성숙도 | 🟡 정밀화 필요(목적형성 판정 기준·entity 분류표 확정 중) | reasonCode·경계는 본 문서에서 확정 |
| 파일·위치 | A-08_entity-eligibility.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽(법적·사실 판단)은 claim으로 들어온다 — 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 오프체인 claim이 제공 (사람 판단) |
|---|---|
| entityClaim `qualRoute` 분기(per-se/자산/QP/look-through) | 법인 *종류 판정* |
| `formedForPurpose` 플래그 · 임계 충족 플래그 확인 | 자산 *평가* · *목적형성* 판정 |
| look-through 위임 여부 결정 | (구성원 자격은 A-09/claim) |

→ 온체인은 *분류 결과(qualRoute)에 따라 분기*만. *법인이 급조됐는지·자산이 얼마인지*는 claim(off-chain 판단).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

> look-through(A-09)와 뿌리를 공유하므로 일부 조문이 겹친다. 본 부품은 그중 *법인을 어떻게 분류하는가*에 초점을 둔다.

### 3.1 Layer 1 — Statutory base

> **§ 2(a)(51)(A)(ii)·(iv) — Family Company·기관 QP** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-2)]
>
> **한글 해석**(요지): (ii) 가족관계 2인 이상이 소유한 **투자자산 $5M 이상 회사**(Family Company), (iv) 자기/타 QP 계산으로 **재량 운용 $25M 이상**인 자(주로 기관). → 펀드 면제 맥락에서 법인은 *가족회사($5M)* 또는 *기관($25M)* 경로로 자격을 얻는다.

### 3.2 Layer 2 — Regulatory specification

#### (A) 발행 면제 쪽 — Rule 501(a)의 법인 분류

> **17 CFR § 230.501(a)(1)·(2) — per-se 기관** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.501)]
>
> **한글 해석**(요지): 은행·S&L·broker-dealer·보험회사·등록 투자회사(RIC)·BDC·SBIC·일정 plan 등 *제도권 기관*은 **자산·구성원 무관 그 자체로** 적격투자자다.

> **17 CFR § 230.501(a)(3)·(7)·(9) — 자산 테스트 + 목적형성 단서** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.501)]
>
> **한글 해석**(요지): (3) 회사·파트너십·LLC·501(c)(3) 단체·business trust로 **총자산 $5M 초과**, *목적형성 아님*; (7) **총자산 $5M 초과** 신탁, *목적형성 아님*, sophisticated person이 매수 지시; (9) **투자자산(investments) $5M 초과** entity, *목적형성 아님*(2020년 확대). → 이들은 *자기 자산*으로 자격을 얻되 **목적형성이 아니어야** 한다.

> **17 CFR § 230.501(a)(8) — 전원 적격 경로** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.501)]
>
> **한글 해석**: 모든 equity owner가 각자 적격이면 그 법인도 적격. → 본 부품이 이 경로로 분류하면 **A-09 look-through로 넘긴다.**

#### (B) 펀드 면제 쪽 — Rule 2a51-3 게이트

> **17 CFR § 270.2a51-3 — 목적형성 회사** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-3)]
>
> **한글 해석**: 목적형성 회사는 자기 자산으로 QP가 *될 수 없고*, 모든 beneficial owner가 QP일 때만 인정. → 본 부품의 *목적형성 판정*이 자산 경로(여기서 통과)와 look-through 경로(A-09)를 가른다.

### 3.3 Layer 3 — Interpretive guidance

> **SEC Release No. 33-10824 (2020)** — *Accredited Investor 정의 확대* (investments $5M entity·family office·"knowledgeable employee" 등 추가)
>
> **Decipher 관련성**: 본 부품의 entity 분류표가 *2020년 확대분*까지 반영해야 함을 알려준다(예: 투자자산 $5M entity = 501(a)(9), family office = 501(a)(12)). 분류표 누락 시 적법 법인을 부당 차단할 수 있다.

### 3.4 Sub-요건 분해 — 분류 결정 트리

| 분류 결과 | 충족 조건(풀어 읽기) | 근거 | 다음 |
|---|---|---|---|
| **per-se 기관** | 은행·보험·broker-dealer·RIC·BDC 등 제도권 기관인가 | 501(a)(1)(2) | 통과(look-through 불요) |
| **자산 테스트(accredited)** | 총자산/투자자산 $5M 초과이고, 목적형성 아님 | 501(a)(3)(7)(9) | 통과 |
| **기관 QP** | 재량 운용 $25M 이상인가 | §2(a)(51)(A)(iv) | 통과 |
| **가족회사 QP** | 가족 2인+, 투자자산 $5M, 구성원 확인 | §2(a)(51)(A)(ii) | **A-09 호출** |
| **전원 적격/목적형성** | 목적형성이거나, 자산 경로 불가 → 전원 확인 | 501(a)(8)·2a51-3 | **A-09 호출** |

해설: 위 트리의 *위 세 줄*은 본 부품에서 통과로 끝나고, *아래 두 줄*은 look-through 부품(A-09)으로 넘어간다. **목적형성 여부**가 자산 경로(통과)와 look-through 경로(넘김)를 가르는 핵심 스위치다.

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 어떤 증거가 필요한가

본 부품이 법인을 분류하려면 네 가지가 증거로 모여야 한다.

1. **법인의 종류** — 제도권 기관인가, 일반 회사·신탁·파트너십인가.
2. **자산 규모** — 총자산/투자자산이 문턱($5M / $25M)을 넘는가(맥락별).
3. **목적형성 여부** — 이 증권을 사려고 급조된 법인인가.
4. **신뢰기관의 검증·서명** — 위 셋을 Trusted Issuer가 확인했는가.

이 답들은 Trusted Issuer가 off-chain 실사로 모아 **entityClaim**에 부호화한다.

### 4.2 Data field

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `entityClaim.entityType` | enum | Trusted Issuer | PER_SE_INSTITUTION·OPERATING_COMPANY·TRUST·PARTNERSHIP·FUND 등 |
| `entityClaim.qualRoute` | enum | Trusted Issuer | PER_SE·ASSET_TEST·INSTITUTIONAL_QP·LOOKTHROUGH (분류 결과) |
| `entityClaim.formedForPurpose` | bool | Trusted Issuer | 목적형성 여부(true면 자산 경로 차단 → look-through) |
| `entityClaim.totalAssets` / `investmentsValue` | uint256 | Trusted Issuer | 문턱 충족 여부(금액 자체는 사전 판정) |
| `entityClaim.issuer` / `signature` | address/bytes | Trusted Issuer | 발급기관·위변조 방지 |
| `requiredQualification` | enum | 호출 Recipe | QP(R3) 또는 ACCREDITED(R1) |

### 4.3 수집 경로

```
1단계  법인 매수 신고     법인이 종류·자산·소유구조 신고
   ↓
2단계  증거 제출         법인 등기·재무제표·소유구조도·설립경위 자료 제출
   ↓
3단계  Off-chain 실사     Trusted Issuer가 종류·자산·목적형성 판정 → qualRoute 결정
   ↓
4단계  entityClaim 발급   분류 결과를 서명해 on-chain 기록
   ↓
5단계  DEX 거래 직전 검사  DEX가 claim 조회 → 분기(통과 or A-09 호출)
```

---

## §5. ③ 판정 로직

### 5.1 전체 흐름 (사람 말로)

① 호출 Recipe가 요구하는 자격(QP/accredited) 확인 → ② entityClaim의 분류(qualRoute) 확인 → ③ per-se·자산테스트·기관QP면 통과 → ④ 목적형성이거나 전원-적격 경로면 look-through 부품(A-09) 호출 → ⑤ 결과 반환.

### 5.2 Pseudocode + 해설

```
function check_A_08(entity_buyer, asset, required_qual, block):

    claim = entity_buyer.entityClaim
    if claim == null or not verified(claim):
        return FAIL_ENTITY_NOT_ELIGIBLE          # 법인 자격 claim 없음/위조

    # 1단계: per-se 기관 — 종류만으로 통과
    if claim.qualRoute == PER_SE:
        if required_qual == ACCREDITED:
            return PASS                           # 발행 면제: per-se 기관 OK
        else: # QP 맥락에서는 per-se 기관도 $25M/재량 요건 필요
            return check_institutional_qp(claim)

    # 2단계: 자산 테스트 — 목적형성 아니어야
    if claim.qualRoute == ASSET_TEST:
        if claim.formedForPurpose:
            return delegate_to_A_09(entity_buyer, asset, required_qual, block)  # 자산경로 차단
        if not threshold_met(claim, required_qual):   # $5M(accred)/$25M(QP)
            return FAIL_ENTITY_NOT_ELIGIBLE
        return PASS

    # 3단계: 기관 QP — $25M 재량
    if claim.qualRoute == INSTITUTIONAL_QP:
        return check_institutional_qp(claim)

    # 4단계: 전원-적격/목적형성 → look-through로
    if claim.qualRoute == LOOKTHROUGH or claim.formedForPurpose:
        return delegate_to_A_09(entity_buyer, asset, required_qual, block)

    return REVIEW_ENTITY_UNCERTAIN
```

- **1단계 해설**: 제도권 기관은 발행 면제(accredited)에선 종류만으로 통과. 단 *펀드 면제(QP)*에선 per-se 기관도 $25M 재량 요건(기관 QP)을 별도로 본다 — accredited per-se ≠ QP라는 점이 핵심.
- **2단계 해설**: 자산 테스트는 *목적형성이 아니어야* 쓸 수 있다. 목적형성이면 자산경로를 막고 A-09로 넘긴다(껍데기 회사 차단).
- **4단계 해설**: 전원-적격 경로(501(a)(8))나 목적형성 회사는 본 부품에서 끝내지 않고 look-through 부품을 호출한다.

### 5.3 Threshold 매트릭스

| 항목 | 값 | 근거 |
|---|---|---|
| 일반 법인 자산(accredited) | **총자산 > $5M** (initial; 검증 패스에서 inclusive/exclusive 재확인) | 501(a)(3) |
| 투자자산 entity(accredited) | **investments > $5M** | 501(a)(9) |
| 기관 QP | **재량 운용 ≥ $25M** | §2(a)(51)(A)(iv) "not less than" |
| 가족회사 QP | **투자자산 ≥ $5M + 가족 2인+** | §2(a)(51)(A)(ii) |
| 목적형성 시 | **자산 경로 차단 → look-through 강제** | Rule 2a51-3·501(a)(3) 단서 |

> ⚠️ 501(a)(3)는 "in excess of $5,000,000"(초과, exclusive)이고 §2(a)(51)은 "not less than"(이상, inclusive)이라 *경계 처리가 조문마다 다르다.* 검증 패스에서 각 조문 문언을 재확인해 경계 테스트에 반영한다(§7).

### 5.4 비결정성을 결정성으로

본 부품의 핵심 판단 — *법인의 실질 종류, 자산 평가, 특히 "목적형성 여부"* — 는 사람의 실사 판단이다. 설립 동기·자본 출처·사업실질 같은 것은 온체인 코드가 알 수 없다. 그래서 Trusted Issuer가 off-chain에서 분류(qualRoute)를 확정해 claim에 부호화하고, 온체인 코드는 *그 분류에 따라 분기*만 결정론적으로 수행한다. 즉 본 부품의 구현 본질은 **"법인 분류라는 비결정적 실사를, 결정적 분기 스위치(qualRoute)로 캡슐화하는 것"**이다.

---

## §6. ④ 거절·예외 처리

| Code | 언제 뜨나 | 무엇이 문제인가 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_ENTITY_NOT_ELIGIBLE` | claim 없음·위조·자산 문턱 미달·분류 불가 | 법인이 어느 경로로도 자격 미달 | 자산 증빙 보강 또는 매수 포기 | frontend 안내 |
| `REVIEW_ENTITY_UNCERTAIN` | 분류가 모호(qualRoute 미상) | 실사로 종류·목적형성 미확정 | 추가 자료 제출 | manual review queue |
| (위임) | `formedForPurpose=true` 또는 전원-적격 경로 | look-through 필요 | A-09 절차 진행 | **A-09 호출**(거절 아님) |

해설: 본 부품의 "실패"는 대개 *자격 미달*(FAIL)이거나 *분류 모호*(REVIEW)다. 목적형성·전원적격은 실패가 아니라 *A-09로의 위임*이라는 점이 중요하다 — 적법한 가족회사·펀드오브펀드가 여기서 거절되지 않는다.

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass·per-se) | 등록 broker-dealer가 발행물 매수 | qualRoute=PER_SE, required=ACCREDITED | **PASS** |
| T2 (분기) | 동일 broker-dealer가 펀드(R3) 매수, 재량 $25M 미달 | required=QP, $20M | **FAIL_ENTITY_NOT_ELIGIBLE** (per-se accredited≠QP) |
| T3 (Pass·자산) | 사업회사 총자산 $8M, 목적형성 아님, R1 | ASSET_TEST, $8M, formed=false | **PASS** |
| T4 (위임) | 동일 회사가 *이 펀드 사려고 급조*됨 | formedForPurpose=true | **→ A-09 호출**(자산경로 차단) |
| T5 (Fail) | 일반 LLC 총자산 $3M, R1 | ASSET_TEST, $3M | **FAIL_ENTITY_NOT_ELIGIBLE** (문턱 미달) |
| T6 (경계) | 회사 총자산 정확히 $5,000,000, R1 | 501(a)(3) "in excess of" | **검증 대상 — exclusive면 FAIL**(§5.3 경계 재확인) |

T6은 §5.3에서 지적한 *조문별 경계(초과 vs 이상)*를 검증한다.

---

## §8. (α) 코드 변환 패턴 선택 — 증명서형(B)

본 부품도 **패턴 B**다. 법인 분류·자산 평가·목적형성 판정이 모두 비결정적 사람의 실사라, Trusted Issuer가 off-chain에서 판정하고 onchain은 분기만 한다(§5.4). 기계 판정형(A)으로 만들면 코드가 "이 회사가 급조됐는지"를 스스로 판단해야 하는데 불가능하다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — A-09의 선행 게이트

본 부품은 **look-through 부품(A-09)의 입구**다. 관계는 §9의 그림으로 요약된다.

```
A-13(QP) / A-03(Accredited) ── 매수인이 법인이면 ▼
        ▼
A-08(본 부품) ── 법인을 분류:
   ├─ per-se 기관 / 자산테스트(목적형성 아님) / 기관 QP → 여기서 통과
   └─ 목적형성 / 전원-적격 경로 → A-09 호출 ▼
        ▼
A-09(look-through) ── 구성원 전원 자격 확인(재귀)
```

- **A-08 → A-09 위임 규칙**: `formedForPurpose=true`이거나 `qualRoute=LOOKTHROUGH`이면 본 부품은 판정을 *끝내지 않고* A-09에 위임한다. required_qual(QP/accredited)도 그대로 전달한다.
- **A-13/A-03이 본 부품을 부른다**: 매수인이 개인이면 A-13/A-03이 직접 판정하지만, 법인이면 먼저 본 부품으로 분류한다. 즉 *개인 경로*와 *법인 경로*의 분기점이 본 부품이다.
- **인터페이스 일관성**: 본 부품이 설정하는 `entityClaim.formedForPurpose`·`qualRoute`를 A-09가 그대로 읽는다(두 문서의 필드 정의 일치 필요).
- **fallback 권고**: A-08 분류가 불완전할 때는 *보수적으로 A-09 강제 발동*(과소차단보다 과잉확인이 안전).

---

## §10. (γ) 3-Layer Solution — 책임 분배

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. Self-Attestation** | 법인 매수인 | 종류·자산·설립경위 신고 | 허위 가능 → Layer 2 검증 |
| **2. Trusted Issuer** | 신뢰기관 | 종류·자산·목적형성 판정·qualRoute 확정·서명 | 누락 가능 → Layer 3 점검 |
| **3. External Spot-Check** | Decipher 운영 | 분류 표본 검토·목적형성 이상 패턴 점검 | 전수 아님 → 보수 fallback |

**escalation**: 분류 모호는 REVIEW로 사람에게, 목적형성 의심은 A-09 강제. 자기신고만으로는 통과 불가.

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 법인 종류 선택 UI | Frontend | 매수인이 법인 종류·자산·소유구조 입력 |
| 분류 결과 안내 | Frontend | "기관 자격 통과" 또는 "구성원 확인이 필요합니다(look-through 안내)" |
| 법인 실사 | Off-chain | Trusted Issuer가 종류·자산·목적형성 판정 |
| 위임 트리거 | On-chain | look-through 필요 시 A-09 절차로 자동 연결 |

---

## §12. Open Issues — 변호사·ADR 확인 대상

1. **목적형성(formed for the specific purpose) 판정 기준** 🔴 — 설립일·사업실질·자본출처 중 무엇이 결정적인가. A-09 §12-2와 공유 쟁점. Trusted Issuer 실사 기준서로 구체화 + 변호사 확인.
2. **자산 문턱 경계(초과 vs 이상)** 🟡 — 501(a)(3) "in excess of $5M"와 §2(a)(51) "not less than"의 경계 차이를 코드 경계값에 정확히 반영(§5.3·§7 T6).
3. **per-se 기관의 QP 자격 분리** 🟡 — accredited per-se 기관이 QP 맥락(R3)에서는 $25M 재량 요건을 별도 충족해야 함을 분류표에 명확히(§5.2 T2).
4. **2020년 확대분 반영** 🟡 — investments $5M entity(501(a)(9))·family office(501(a)(12)) 등 최신 분류 누락 없는지 검증.
5. **외국 법인(non-US entity) 처리** 🟡 — 미국 외 법인의 종류 대응(국가 제한 부품 A-02와 연계). 보수 기본값으로 막고 변호사 확인.

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX_부품영문이름.md   (Element)
본 부품: A-08_entity-eligibility.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. 법인 매수인의 *자기 자격 분류*(per-se / 자산테스트 / 기관QP / look-through 위임) 부품 심층 walkthrough 신설. ① 규제 맥락(세 종류 법인 → 두 법체계(Reg D·ICA) → 효율·남용방지 균형 → 한국 전문투자자 법인 분류 anchor), ② 법적 근거(§2(a)(51)(A)(ii)(iv)·Rule 501(a)(1)(2)(3)(7)(8)(9)·Rule 2a51-3·SEC Release 33-10824 2020 확대), ③ 입력(entityClaim·qualRoute·formedForPurpose), ④ 판정 로직(분류 트리·A-09 위임 분기·per-se의 QP 분리), ⑤ 테스트 6종(per-se·분기·자산·위임·경계), 패턴 B, A-13/A-03→A-08→A-09 cascade, 3-Layer, Open Issues 5종(목적형성·경계·per-se QP분리·2020확대·외국법인). **인용 검증은 후속 일괄 패스 대상.** A-09와 entityClaim 필드 정의 일치 전제.
