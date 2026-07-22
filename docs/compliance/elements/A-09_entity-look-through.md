---
type: element-walkthrough
element-id: A-09
element-name: Entity Look-Through
parent-recipe: R3 (ICA §3(c)(7) Fund)·R1 (Reg D 506(c) Issuance)
internal-id: ELE.A-09
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 USC § 80a-2(a)(51)(A)(ii)(iii) — Family Company·Trust look-through: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-2&num=0&edition=prelim"
  - "17 CFR § 270.2a51-3 — Certain companies as qualified purchasers(목적형성 회사 look-through): https://www.ecfr.gov/current/title-17/section-270.2a51-3"
  - "17 CFR § 230.501(a)(8) — 모든 equity owner가 accredited인 entity: https://www.ecfr.gov/current/title-17/section-230.501"
  - "17 CFR § 230.501(a)(3) — entity 총자산 $5M·목적형성 아님: https://www.ecfr.gov/current/title-17/section-230.501"
  - "17 CFR § 230.501(a)(7) — trust 총자산 $5M·목적형성 아님·sophisticated 운용: https://www.ecfr.gov/current/title-17/section-230.501"
  - "SEC Release IC-22597, 62 FR 17512 (Apr. 9, 1997) — Privately Offered Investment Companies: https://www.federalregister.gov/"
created: 2026-06-17
updated: 2026-06-17
tags: [element, A-09, look-through, walkthrough, spec-sheet, R3, R1, entity, beneficial-owner]
---

# A-09 Entity Look-Through — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **법인·신탁 매수인의 구성원까지 들여다보는 부품**(내부 식별자 A-09)을, 미국 증권·펀드 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC·판례 등 **외부 공식 자료만** 사용한다. 다만 본 부품은 **Qualified Purchaser 부품(A-13)·법인 자격 산정 부품(A-08)과 한 묶음으로 작동**하므로, 그 둘과의 연결을 §9에서 자세히 다룬다.

> ✅ **인용 검증 완료 (v1.1, 2026-06-17 — eCFR 원문 1대1 대조).**
> 핵심 인용을 **eCFR 원문(ecfr.gov)과 1대1 대조**해 검증했다(Cornell 미사용). **결과: 오류 0건.** — Rule 501(a)(3)·(7)·(8)·(9), Rule 2a51-3(a)(b), §2(a)(51)(A) 모두 원문과 일치. **추가 확인(원문에서 발견)**: ① Rule **501(a)(8)에 *Note 1*** 이 붙어 "자연인까지 look-through 허용"을 *명문화*(§3.2 반영) — 본 부품 재귀 look-through의 직접 텍스트 근거. ② Rule **2a51-3(a)** 는 §2(a)(51)(A)의 ***(ii)·(iv)*** 에 적용(가족회사·기관). 인용 링크는 eCFR/uscode.house.gov로 교체함.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"매수인이 *사람이 아니라 회사·신탁일 때*, 그 회사의 자격을 어떻게 판정하는가"*를 다룬다. 핵심 통찰은 — **법인의 자격은 그 법인의 통장 잔고만 보고 정할 수 없는 경우가 있다**는 것이다. 빈 껍데기 회사(paper company)를 하나 세워서 그 안에 자격 없는 사람들이 숨어 들어오면, 회사 이름만으로는 규제를 통과해 버린다. 그래서 미국법은 일정한 경우 **회사를 *뚫고 들어가(look through)* 그 안의 사람들을 직접 본다.** 이 부품이 바로 그 "뚫고 들어가기"를 수행·검증한다.

### 1.1 한 장면으로 보는 문제 — "빈 회사 우회(empty-box circumvention)"

먼저 *왜 이 부품이 없으면 시스템이 뚫리는지*를 장면으로 보자.

BlackRock BUIDL 같은 펀드 토큰은 **자격 있는 투자자**(뒤에서 설명할 적격투자자·Qualified Purchaser)만 살 수 있다. 그런데 자격이 없는 사람 다섯 명이 모여 이렇게 한다고 하자 —

```
자격 없는 개인 5명
   → "Acme Capital LLC"라는 회사를 하나 세움 (자본금은 5명이 조금씩 출자)
   → 회사 이름으로 BUIDL 매수 시도
   → "회사가 샀으니 개인 자격은 안 봐도 되는 것 아닌가?"
```

만약 시스템이 *회사 이름과 회사 명의 자산*만 본다면 이 우회는 성공한다. 자격 없는 5명이 회사라는 가면을 쓰고 펀드에 들어온 것이다. 미국법은 이 구멍을 정확히 알고 있었고, 그래서 **"이 회사가 *바로 이 증권을 사려고 급조된* 것이라면, 회사가 아니라 그 안의 *각 사람*이 자격을 갖췄는지 본다"**는 규칙을 만들었다. 이것이 **look-through(들여다보기)**다.

쉽게 말하면: 회사는 종이 한 장으로도 만들 수 있으니, 규제가 회사라는 종이에 속지 않도록 *그 종이 뒤의 진짜 사람들*을 보게 한 것이다. 본 부품은 이 "종이 뒤를 보는" 작업을 거래 직전에 수행한다.

### 1.2 이 규제는 어느 법에서 오는가 — 두 갈래의 같은 원리

look-through는 하나의 법에서만 오는 게 아니라, **두 개의 다른 법체계가 *같은 원리*로 각자 규정**한다. 이 점을 처음에 분명히 해야 혼동이 없다. Decipher에서 본 부품은 두 곳에서 호출되기 때문이다.

| 맥락 | 어느 자격을 보나 | 어느 법·규칙 | Decipher Recipe |
|---|---|---|---|
| **발행 면제**(증권을 처음 파는 단계) | **Accredited Investor**(적격투자자) | 1933년법 Reg D — Rule 501(a) | **R1**(Reg D 506(c) Issuance) |
| **펀드 면제**(펀드 지분의 매수 자격) | **Qualified Purchaser**(QP) | ICA 1940 §2(a)(51)·Rule 2a51-3 | **R3**(ICA §3(c)(7) Fund) |

두 맥락 모두 원리는 같다 — *"법인이 자기 자산만으로 자격을 주장하려면 *목적형성 회사(formed for the specific purpose)*가 아니어야 하고, 목적형성 회사라면 *구성원 전원*이 자격을 갖춰야 한다."* 다만 **보는 자격이 다르다**(발행 면제에서는 accredited, 펀드 면제에서는 QP). 그래서 본 부품은 *어느 Recipe가 부르는가*에 따라 **"각 구성원이 accredited인가"** 또는 **"각 구성원이 QP인가"**를 확인한다. 이 분기를 §5 판정 로직에서 정확히 다룬다.

### 1.3 왜 이 규제가 존재하는가 — 입법 동기

두 법 모두 같은 두려움에서 look-through를 만들었다.

**(가) 발행 면제 쪽(Reg D).** 1933년법은 *공모(public offering)*에 등록·공시를 강제하되, *세련된 투자자(sophisticated investor)*만 상대하는 사모(private placement)는 면제한다. 그런데 "세련된 투자자"의 자격 문턱을 *법인 단위*로만 보면, 자격 없는 다수가 법인 뒤에 숨어 사실상 공모를 사모로 위장할 수 있다. 그래서 Reg D는 **"증권 취득 목적으로 급조된 법인은 자산 테스트를 못 쓰고, 대신 *모든 지분 소유자가 각자 적격투자자*여야 인정"**(Rule 501(a)(8))이라는 안전장치를 둔다.

**(나) 펀드 면제 쪽(ICA §3(c)(7)).** ICA 1940은 펀드 지분이 *취득 시점에 QP인 자에게 배타적으로(exclusively)* 소유될 때만 등록을 면제한다(§1.2의 R3). 여기서도 똑같은 우회가 가능하다 — non-QP 다수가 회사를 세워 그 회사로 펀드에 들어오는 것. 그래서 ICA는 **Rule 2a51-3**(목적형성 회사 look-through)과 **§2(a)(51)(A)(ii)·(iii)**(가족회사·신탁의 구성원 판정)으로 같은 구멍을 막는다.

쉽게 말하면: 두 법 모두 *"자격 요건을 법인이라는 우회로로 무력화하지 못하게"* 하려는 같은 목적을 가졌고, look-through는 그 목적을 달성하는 *공통의 기술*이다. 본 부품이 두 Recipe에서 공유되는 이유가 여기 있다.

### 1.4 Decipher 시스템에서 왜 중요한가 — 조건부지만 치명적

본 부품은 모든 거래에서 작동하지는 않는다. **매수인이 *법인·신탁*일 때만** 켜진다(개인 매수인이면 A-13·A-03이 직접 판정하고 끝). 그래서 분류상 *조건부 부품(conditional element)*이다. 하지만 켜지는 순간엔 *치명적*이다 — A-13 문서에서 본 것처럼, **단 한 명의 자격 없는 구성원**이 법인 뒤에 숨어 통과하면, 그 펀드(BUIDL)는 §3(c)(7) "exclusively QP" 조건을 깨뜨리고 면제 자체를 잃을 수 있기 때문이다(존립 위험, existential risk).

즉 본 부품은 *빈도는 낮지만 한 번의 실수 비용이 매우 큰* 부품이다. 그래서 설계 철학은 A-13과 동일하다 — **"보수적으로, 구성원 한 명이라도 확인이 안 되면 통과시키지 않는다."** 다만 차이가 하나 있다: 구성원이 여럿이라 *일부만 확인된 중간 상태*가 생긴다. 이 부품은 그 중간 상태를 **거절(reject)이 아니라 대기(suspend)**로 처리한다(§6). 적법한 법인이 구성원 KYC를 마저 끝낼 시간을 주기 위해서다.

### 1.5 한국법과의 비교 — 실제소유자(beneficial owner) 확인

한국 변호사·개발팀이 직관을 잡도록 한국 제도와 나란히 놓자. (직관용 비유이며 법적 등가가 아니다.)

한국 자본시장법의 **전문투자자** 판정에는 미국식 look-through가 *그대로*는 없다. 그러나 직관의 anchor로 가장 가까운 것은 **「특정 금융거래정보의 보고 및 이용 등에 관한 법률」(특금법)·자금세탁방지 체계의 *실제소유자(beneficial owner) 확인*** 의무다. 금융회사는 법인 고객을 받을 때 그 법인 *명의*만 보지 않고, **그 법인을 실질적으로 지배하는 자연인**(보통 지분 25% 이상 등)을 끝까지 확인해야 한다. "회사라는 가면 뒤의 진짜 사람을 본다"는 발상이 같다.

차이는 **목적**이다 — 한국의 실제소유자 확인은 *자금세탁·테러자금 차단*이 목적이고, 미국의 look-through는 *투자자 자격(자산 문턱) 판정*이 목적이다. 그래서 보는 대상도 다르다(한국: 지배하는 자연인 / 미국: 모든 지분 소유자가 각자 자격 충족하는지). Decipher는 두 발상을 *대응*시켜 이해하되 *동일시*하지 않는다. (참고로 제재·자금세탁 쪽 실제소유자 확인은 본 부품이 아니라 제재 명단 부품 A-01·신원 부품이 별도로 맡는다.)

---

## §2. 📋 메타 정보 (Internal Identifier Box)

> 아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. **본문에서는 이 코드들을 단독으로 쓰지 않고**, "본 부품"·"look-through 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Entity Look-Through** | 법인·신탁 뒤의 구성원 자격 검사원 |
| 검사 대상 | 법인·신탁 매수인의 *구성원 전원 자격*(Reg D Rule 501(a)(8) / ICA Rule 2a51-3·§2(a)(51)(A)(ii)(iii)) | "이 회사 뒤의 사람들이 다 자격이 있나" |
| Internal ID | A-09 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **증명서형**(off-chain 구성원 실사 + on-chain lookThroughChain 확인) | 기계가 구성원을 직접 판단하지 않고, 신뢰기관이 부호화한 구성원 자격 사슬을 확인 |
| Timing | **pre-trade**(거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | **STATELESS** | 매수 시점의 구성원 스냅샷만 보고 판정 |
| 활성화 조건 | **매수인이 법인·신탁일 때만**(conditional) | 개인 매수인이면 작동 안 함 |
| 주 활성화 Recipe | **R3**(QP look-through)·**R1**(accredited look-through) | 두 Recipe가 *서로 다른 자격*으로 본 부품을 부른다 |
| 선행 부품 | **A-08**(법인 자격 산정) | A-08이 "자체 자격으로 충분한가, look-through가 필요한가"를 먼저 가른다 |
| 상위 호출 부품 | **A-13**(QP)·**A-03**(Accredited) | 매수인이 법인일 때 이들이 본 부품을 cascade 호출 |
| 성숙도 | 🟡 정밀화 필요(재귀 depth·partial 처리 확정 중) | reasonCode·경계는 본 문서에서 확정, depth는 Open Issue |
| 파일·위치 | A-09_entity-look-through.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽(법적·사실 판단)은 claim으로 들어온다 — 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 오프체인 claim이 제공 (사람 판단) |
|---|---|
| lookThroughChain `chainComplete` 확인 | *누가* beneficial owner인지(명단 확정) |
| 각 고리 자격 claim 유효성(서명·발급자·만료) | 각 구성원이 *QP/AI인지 실체 판단* |
| 재귀 깊이 ≤ 한계 · 요구자격(QP/AI) 분기 | *목적형성* 여부 · 명단 *완전성* 보증 |

→ 온체인은 *사슬이 완전하고 각 고리가 유효한 claim을 가리키는지*만 본다. *누가 소유자인지·자격이 있는지*는 claim(off-chain 판단).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

> **읽는 법.** 법적 근거는 세 겹이다. **Layer 1(조문)**은 의회가 만든 법률 텍스트, **Layer 2(규칙)**는 SEC가 구체화한 연방규칙, **Layer 3(해석)**은 SEC 발행문서·No-Action Letter가 회색지대를 메운 해석이다. look-through는 §1.2에서 본 대로 *두 법체계*에 각각 뿌리가 있으므로, 아래도 **(A) 펀드 면제(QP) 쪽**과 **(B) 발행 면제(Accredited) 쪽**으로 나눠 제시한다.

### 3.1 Layer 1 — Statutory base (조문 원문)

#### (A) 펀드 면제 쪽 — ICA §2(a)(51)(A)(ii)·(iii)

> **§ 2(a)(51)(A)(ii)·(iii) — Family Company·Trust** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-2&num=0&edition=prelim)]
>
> **Original**(요지):
> "(ii) any company that owns not less than $5,000,000 in investments and that is owned ... by ... 2 or more natural persons who are related as siblings or spouse ... or direct lineal descendants ...; (iii) any trust ... not formed for the specific purpose of acquiring the securities offered, as to which the trustee ... and each settlor ... is a person described in clause (i), (ii), or (iv) ..."
>
> **한글 해석**: QP 정의의 (ii)·(iii)은 *법인·신탁 자체*를 다루며, **그 안의 사람을 따져야** 자격이 정해진다 — (ii) 가족회사는 *가족관계로 묶인 2인 이상이 소유*해야 하고, (iii) 신탁은 *특정 증권 취득 목적으로 만든 게 아니어야 하며, 수탁자와 모든 위탁자가 각각 QP(또는 가족회사·기관)*여야 한다.

해설: 여기서 "*수탁자와 각 위탁자가 각각* QP여야 한다"는 문언이 곧 look-through의 statutory 근거다. 신탁이라는 그릇 자체가 아니라 *그 그릇을 만든·운용하는 사람들*을 본다.

#### (B) 발행 면제 쪽 — Reg D의 entity 정의(아래 Layer 2에서 상술)

발행 면제 쪽의 look-through는 statute(1933년법 §4(a)(2)의 "private offering")보다는 **SEC 규칙(Reg D Rule 501(a))**에 구체화돼 있다. 그래서 Layer 2에서 본다. statute 차원에서는 *"sophisticated investor만 상대하는 사모는 면제"*라는 Ralston Purina(1953) 원리(아래 Layer 3)가 뿌리다.

### 3.2 Layer 2 — Regulatory specification (연방규칙 원문)

#### (A) 펀드 면제 쪽 — Rule 2a51-3 (목적형성 회사 look-through)

> **17 CFR § 270.2a51-3 — Certain companies as qualified purchasers** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-270.2a51-3)]
>
> **Original**(요지):
> "(a) ... a company shall not be deemed to be a qualified purchaser if it was formed for the specific purpose of acquiring the securities offered by a [§3(c)(7)] company ... unless each beneficial owner of the company's securities is a qualified purchaser. (b) ... a company may be deemed to be a qualified purchaser ... if each beneficial owner of the company's securities is a qualified purchaser."
>
> **한글 해석**: 이 펀드 지분을 사려고 *급조된 회사*(formed for the specific purpose)는, **그 회사의 *모든 beneficial owner가 각자 QP*일 때만** QP로 인정된다. 반대로 말하면 — 목적형성 회사가 아니면 회사 자체의 $5M/$25M 자산으로 판정하지만(A-08 영역), 목적형성 회사라면 *전원 look-through*가 강제된다(본 부품 영역).

#### (B) 발행 면제 쪽 — Rule 501(a)의 entity 분기

> **17 CFR § 230.501(a)(8) — 모든 equity owner가 accredited인 entity** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.501)]
>
> **Original**(요지):
> "Accredited investor shall mean ... (8) Any entity in which all of the equity owners are accredited investors."
>
> **한글 해석**: **모든 지분 소유자(equity owner)가 각자 적격투자자인 법인**은, 그 법인 자체의 자산과 무관하게 적격투자자로 인정된다. 이것이 발행 면제 쪽의 *전원 look-through* 경로다.
>
> **⭐ Note 1 to (a)(8) (eCFR 원문 확인)**: 규칙은 *"entity의 적격 여부 판정 시 여러 지분 형태를 *자연인까지 look through* 하는 것이 허용된다 — 그 자연인들이 모두 적격이고 다른 모든 지분 소유자도 적격이면 (a)(8)을 쓸 수 있다"*고 **명문으로 적시**한다. → 본 부품의 *재귀 look-through*(구성원이 또 법인이면 자연인 층까지 내려감)의 *직접 텍스트 근거*다.

> **17 CFR § 230.501(a)(3) / (a)(7) — 자산 테스트의 "목적형성 아님" 단서** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.501)]
>
> **Original**(요지):
> "(3) Any organization described in section 501(c)(3) ..., corporation, ... partnership, or limited liability company, not formed for the specific purpose of acquiring the securities offered, with total assets in excess of $5,000,000; (7) Any trust, with total assets in excess of $5,000,000, not formed for the specific purpose of acquiring the securities offered, whose purchase is directed by a sophisticated person ..."
>
> **한글 해석**: 법인·신탁이 *자기 자산 $5M*만으로 적격을 주장하려면 반드시 **"특정 증권 취득 목적으로 형성된 게 아닐 것"**이라는 단서를 충족해야 한다. 목적형성이면 이 자산 경로가 막히고, 위 (a)(8)의 *전원 적격* 경로로만 갈 수 있다 — 즉 **목적형성 여부가 A-08(자산 경로)과 A-09(look-through 경로)의 분기점**이다.

해설: (A)와 (B)를 한 문장으로 합치면 — **"목적형성 법인이면 구성원 전원이 *해당 자격*(QP면 QP, 발행이면 accredited)을 갖춰야 한다."** 본 부품은 이 "구성원 전원" 확인을 수행한다.

### 3.3 Layer 3 — Interpretive guidance

> **SEC v. Ralston Purina Co.**, 346 U.S. 119 (1953) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/346/119/)]
>
> **Holding 핵심**: 사모 면제의 본질은 "스스로를 지킬 수 있는(able to fend for themselves) 자에 대한 청약"이다.

**Decipher 관련성**: look-through의 *철학적* 근거다. 법인을 뚫고 들어가 구성원을 보는 이유는 결국 "*실제로 위험을 감당할 능력이 있는 사람들*에게만 갔는가"를 확인하기 위해서다. 빈 회사 우회는 바로 이 능력 검증을 무력화하므로 막는다.

> **1997 Sullivan & Cromwell No-Action Letter**(Family Company look-through 깊이) — *변호사 확인 대상*
>
> **성격**: §2(a)(51)(A)(ii) 가족회사의 *"directly or indirectly" 소유*를 어디까지 따라 들어가는지(look-through depth)에 관한 실무 해석 자료. No-Action Letter는 사실관계 한정적이고 SEC를 구속하지 않으므로, 본 문서는 *그 존재와 쟁점*만 적고 구체적 depth 결론은 **§12 Open Issue로 보내 변호사가 원문을 직접 확인**하도록 한다.

> **SEC Release IC-22597, 62 FR 17512 (Apr. 9, 1997)** — *Privately Offered Investment Companies* (adopting release)
>
> **성격**: Rule 2a51-3을 채택한 1997년 SEC adopting release. 목적형성 회사 look-through의 입법 취지·해석 근거로 쓴다.

### 3.4 Sub-요건 분해 매트릭스

본 부품이 작동할 때 따지는 판정 path를 분해하면 다음과 같다. (각 행을 소리 내 읽으면 문장이 된다.)

| 판정 path | 충족 조건(풀어 읽기) | 근거 | 복잡도 |
|---|---|---|---|
| 목적형성 여부 | 이 법인이 *바로 이 증권을 사려고 만들어진 것*인가 (= A-08이 판정해 넘김) | Rule 2a51-3(a)·501(a)(3) 단서 | 🟡 중간 |
| (QP 맥락) 전원 QP | 목적형성 회사이면, *모든 beneficial owner가 각자 QP*인가 | Rule 2a51-3(b) | 🔴 높음 — 재귀 |
| (가족회사) 가족+전원 | 가족관계 2인 이상이 소유하고, 구성원이 자격을 갖췄는가 | §2(a)(51)(A)(ii) | 🔴 높음 |
| (신탁) 수탁자+위탁자 | 수탁자와 *각* 위탁자가 각각 QP인가, 목적형성 아닌가 | §2(a)(51)(A)(iii) | 🔴 높음 |
| (Accredited 맥락) 전원 적격 | *모든 equity owner가 각자 accredited*인가 | Rule 501(a)(8) | 🔴 높음 — 재귀 |
| 재귀 처리 | 구성원이 *또 법인*이면 한 겹 더 들어가는가 (depth) | (Open Issue) | 🔴 높음 |

해설: 핵심은 **"전원(each / all)"**이라는 단어다. 한 명의 예외도 허용하지 않는다. 그리고 구성원이 또 법인이면 *한 겹 더* 들어가야 하는데, 어디까지 들어갈지(depth)가 본 부품의 핵심 미결 쟁점이다(§12).

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

쉽게 말하면, 본 부품이 "이 법인은 구성원 전원이 자격을 갖췄다"고 말하려면 세 가지가 증거로 모여 있어야 한다.

1. **이 법인의 구성원(beneficial owner)이 누구누구인가?** — 빠짐없는 명단.
2. **각 구성원이 *요구되는 자격*(맥락에 따라 QP 또는 accredited)을 갖췄는가?** — 구성원마다 유효한 자격 증명.
3. **그 명단과 각 증명을 신뢰기관이 검증·서명했는가?** — Trusted Issuer의 보증.

이 세 답은 **Trusted Issuer**가 off-chain 실사로 모으고, 그 결과를 **lookThroughChain[]**(구성원 자격 증명의 사슬)이라는 형태로 부호화해 on-chain에 올린다. DEX는 그 사슬이 *완전한지(빠진 구성원이 없는지)*와 *각 고리가 유효한 자격 claim을 가리키는지*만 결정론적으로 확인한다.

### 4.2 Data field — DEX가 실제로 읽는 항목

> 아래 필드 이름·구조는 Decipher의 ERC-3643/ONCHAINID 호환 구현을 전제한 *예시 스펙*이다(구현 시 확정).

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `entityClaim.basis` | enum | Trusted Issuer claim | 법인이 어느 갈래인지(ENTITY_ASSET_TEST·ENTITY_LOOKTHROUGH·FAMILY_COMPANY·TRUST) — A-08이 설정 |
| `entityClaim.formedForPurpose` | bool | Trusted Issuer claim | 목적형성 회사인가(true면 본 부품 강제) |
| `lookThroughChain[]` | array | Trusted Issuer claim | 구성원 목록 + 각 구성원의 자격 claim 참조 |
| `lookThroughChain[i].owner` | address/id | Trusted Issuer claim | i번째 구성원의 신원 |
| `lookThroughChain[i].claimRef` | ref | Trusted Issuer claim | 그 구성원의 자격 증명(QP claim 또는 Accredited claim) 참조 |
| `lookThroughChain[i].isEntity` | bool | Trusted Issuer claim | 이 구성원이 *또 법인*인가(재귀 트리거) |
| `lookThroughChain[i].depth` | uint | Trusted Issuer claim | 재귀 깊이(루트=0) |
| `requiredQualification` | enum | 호출 Recipe | 이 거래에서 요구되는 자격(QP or ACCREDITED) — R3면 QP, R1이면 ACCREDITED |
| `chainComplete` | bool | Trusted Issuer claim | 신뢰기관이 "구성원 명단이 완전하다"고 보증 |

쉽게 말하면: DEX는 법인의 주주명부를 직접 뒤지지 않는다. 대신 **"신뢰기관이 *이미 구성원을 다 확인했고 각자 자격이 있다*고 서명한 사슬"**을 본다. 그 사슬에 *빠진 고리*가 있거나 *유효하지 않은 고리*가 있으면 통과시키지 않는다.

### 4.3 수집 경로 — 5단계 흐름

```
1단계  법인 매수 신고        법인 매수인이 DEX에서 KYC 시작 + 자기 구성원 구조 신고
   ↓
2단계  구성원 증거 제출       각 구성원 → Trusted Issuer에 자격 증빙 제출
                          (개인이면 자산 증빙, 또 법인이면 그 법인의 구성원 자료)
   ↓
3단계  Off-chain 실사·look-through  Trusted Issuer가 목적형성 여부 판정 +
                          구성원 전원의 자격 확인 + 재귀(법인 구성원은 한 겹 더) 수행
   ↓
4단계  lookThroughChain 발급  Trusted Issuer가 서명한 구성원 자격 사슬을 on-chain 기록
   ↓
5단계  DEX 거래 직전 검사     DEX가 사슬 조회 → 완전성·각 고리 유효성 확인 → PASS/FAIL
```

**핵심**: 누가 구성원인지, 목적형성인지, 어디까지 재귀할지 같은 *판단*은 모두 3단계에서 Trusted Issuer가 off-chain으로 하고, 그 결과를 사슬로 부호화한다. DEX는 5단계에서 *사슬이 완전하고 각 고리가 유효한지*만 결정론적으로 본다(이유는 §8).

---

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.1 전체 흐름 (사람 말로)

구성원 사슬이 모인 뒤, 온체인 코드는 다음 순서로 확인한다 — ① 이 거래가 어떤 자격을 요구하는가(QP인가 accredited인가) → ② 목적형성 회사라 look-through가 강제되는가 → ③ 구성원 명단이 완전한가 → ④ *각 구성원*이 요구 자격의 유효한 claim을 갖췄는가 → ⑤ 구성원이 또 법인이면 한 겹 더 → ⑥ 전원 통과면 PASS, 하나라도 미충족이면 구체적 FAIL, 일부만 미완료면 SUSPEND.

### 5.2 Pseudocode + 단계별 해설

```
function check_A_09(entity_buyer, asset, required_qual, block, depth=0):

    # 0단계: 재귀 깊이 한계(순환·과도한 stacking 방지)
    if depth > MAX_LOOKTHROUGH_DEPTH:            # Decipher 권고 3 (Open Issue)
        return REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED

    chain = entity_buyer.lookThroughChain
    if chain == null or chain.length == 0:
        return FAIL_LOOKTHROUGH_REQUIRED          # 구성원 자료 없음

    # 1단계: 명단 완전성(신뢰기관 보증)
    if not chain.chainComplete:
        return FAIL_LOOKTHROUGH_REQUIRED          # 구성원 일부 누락

    # 2단계: 구성원 전원 순회
    pending = false
    for member in chain:
        member_claim = resolve(member.claimRef)

        if member_claim == null:
            pending = true                        # 이 구성원 KYC 미완료 → 대기 후보
            continue

        if member.isEntity:
            # 재귀: 구성원이 또 법인이면 한 겹 더 들어간다
            sub = check_A_09(member, asset, required_qual, block, depth+1)
            if sub == PASS: continue
            elif sub in (SUSPEND set): pending = true; continue
            else: return FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED
        else:
            # 개인 구성원: 요구 자격에 맞는 claim인지 확인
            if required_qual == QP:
                ok = check_A_13_claim(member_claim, asset, block)   # QP claim 유효성
            else: # ACCREDITED
                ok = check_A_03_claim(member_claim, asset, block)   # Accredited claim 유효성
            if not ok:
                return FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED

    # 3단계: 일부 미완료면 거절이 아니라 대기
    if pending:
        return FAIL_LOOKTHROUGH_NOT_COMPLETED     # suspend (적법 법인에 시간 부여)

    return PASS
```

- **0단계 해설**: 구성원이 또 법인이고 그 법인의 구성원이 또 법인이고… 무한히 쌓이면 시스템이 멈추고, 악용하면 자격 희석 우회가 된다. 그래서 깊이 한계를 둔다. 권고는 3단계지만, *법적으로 몇 겹까지 봐야 충분한지*는 변호사 확인 대상이다(§12).
- **1단계 해설**: 신뢰기관이 "구성원 명단이 완전하다(chainComplete)"고 보증하지 않으면, 누가 숨어 있을지 모르므로 `FAIL_LOOKTHROUGH_REQUIRED`. 명단의 *완전성*은 기계가 알 수 없어 신뢰기관 보증에 의존한다.
- **2단계 해설**: 구성원을 한 명씩 본다. 개인이면 요구 자격(QP 또는 accredited)에 맞는 유효 claim인지 확인하고, 또 법인이면 *재귀 호출*로 그 안을 다시 본다. **한 명이라도 명백히 미충족이면 즉시 `FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED`** — "전원" 요건이라 예외가 없다.
- **3단계 해설**: 미충족이 아니라 *아직 확인 안 됨*(claim 미발급)인 구성원이 있으면, 거절하지 않고 `FAIL_LOOKTHROUGH_NOT_COMPLETED`로 **대기(suspend)**시킨다. 적법한 법인이 구성원 KYC를 마저 끝낼 수 있게 하는 배려다.

### 5.3 핵심 분기 — required_qual은 어디서 오는가

본 부품의 가장 헷갈리는 점은 **"무슨 자격을 보는가"가 거래마다 다르다**는 것이다. 같은 법인이라도 —

- **R3(펀드 면제)가 부르면** → 구성원 전원이 **QP**인지 본다(Rule 2a51-3).
- **R1(발행 면제)가 부르면** → 구성원 전원이 **accredited**인지 본다(Rule 501(a)(8)).
- **두 Recipe가 동시에 켜지면**(BUIDL은 R1·R3 누적) → **둘 다** 통과해야 한다(더 엄격한 QP가 사실상 결정).

그래서 `required_qual`은 본 부품이 스스로 정하지 않고, **호출하는 Recipe가 인자로 넘긴다.** 이 분기를 놓치면 "accredited인데 QP는 아닌 구성원"을 펀드 거래에서 잘못 통과시키는 치명적 오작동이 생긴다.

### 5.4 Threshold·기준 매트릭스

| 항목 | 값 | 근거 |
|---|---|---|
| 구성원 자격 요건 | **전원(each/all) — 1명의 예외도 불허** | Rule 2a51-3(b)·501(a)(8)·§2(a)(51)(A)(ii)(iii) |
| 목적형성 회사 시 | 자산 테스트 불가 → **전원 look-through 강제** | Rule 2a51-3(a)·501(a)(3)(7) 단서 |
| 재귀 깊이 한계 | **권고 3**(Open Issue — 법적 충분 깊이 미확정) | (변호사 확인) |
| 일부 미완료 처리 | **SUSPEND**(거절 아님) | Decipher 설계(적법 법인 보호) |
| 요구 자격 분기 | **호출 Recipe가 결정**(R3→QP, R1→accredited) | §1.2 두 맥락 |

### 5.5 비결정성을 결정성으로 — 본 부품 구현의 본질

A-13과 같은 통찰이 여기서 더 강하게 적용된다. **"누가 beneficial owner인가", "이 회사가 목적형성인가", "명단이 완전한가"는 모두 사람의 판단**이다. 주주명부의 실질, 차명·SPV 구조, 설립 동기 같은 것은 온체인 코드가 알 수 없다.

그래서 본 부품도 **Trusted Issuer가 off-chain에서 구성원을 확정·실사하고, 그 결과를 *사슬(chain)*로 부호화**한다. 온체인 로직은 "사슬이 완전하다고 보증됐는가·각 고리가 유효한 자격 claim을 가리키는가·재귀가 한계 내인가"라는 결정론적 확인만 한다. 즉 **본 부품의 구현 본질은 "법인 구조에 대한 비결정적 실사를, 결정적인 자격 증명 사슬의 확인으로 캡슐화하는 것"**이다.

쉽게 말하면(비유): 본 부품은 *가계도(족보)를 직접 그리지 않는다.* 신뢰기관이 그린 가계도에 *빈칸이 없는지, 각 칸의 사람이 자격증을 가졌는지*만 확인한다. 족보를 그리는 일(누가 가족인지, 누가 숨었는지 판단)은 사람이 한다.

---

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

본 부품의 실패는 *두 종류*로 갈린다는 점이 특징이다 — **(가) 확정적 부적격**(구성원 중 누군가가 명백히 자격 미달)과 **(나) 미완료**(아직 확인이 안 끝남). (가)는 거래를 막고(reject), (나)는 거래를 대기시킨다(suspend). 이 구분이 적법한 법인 매수인을 부당하게 차단하지 않으면서도 우회는 막는 균형점이다.

### 6.2 Failure codes

| Code | 언제 뜨나 | 무엇이 문제인가 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_LOOKTHROUGH_REQUIRED` | 사슬 없음·명단 미완전(chainComplete=false) | 들여다볼 구성원 자료가 없거나 불완전 | 구성원 전원 KYC 자료 제출 | Trusted Issuer가 look-through 자료 보강 |
| `FAIL_LOOKTHROUGH_NOT_COMPLETED` | 구성원 일부 claim 미발급 | 일부 구성원 KYC가 아직 진행 중 | 미완료 구성원 재촉/대기 | 거래 **suspend**(거절 아님)·완료 시 재개 |
| `FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED` | 구성원 중 1명 이상이 요구 자격 미충족 | 자격 없는 구성원이 법인 뒤에 있음 | 구조 변경 또는 매수 포기 | reject·사유(어느 자격 미달인지) propagate |
| `REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED` | 재귀 깊이가 한계 초과 | 법인이 과도하게 중첩됨(우회 의심) | — | manual review queue(사람 판단) |

### 6.3 reject vs suspend — 왜 나누나

쉽게 말하면: 자격 *없는* 사람이 끼어 있으면(MEMBER_NOT_QUALIFIED) 그 거래는 *영원히 부적격*이므로 막는다. 하지만 자격 있는 구성원의 *서류가 아직 안 끝난 것*(NOT_COMPLETED)은 시간이 지나면 적법해질 수 있으므로 막지 않고 기다린다. 전자를 suspend로 처리하면 우회 회사가 무한정 대기실에 머무를 수 있고, 후자를 reject로 처리하면 적법한 가족회사·펀드오브펀드를 부당하게 쫓아낸다. 그래서 *둘을 정확히 가르는 것*이 본 부품 거절 설계의 핵심이다.

---

## §7. ⑤ 테스트 케이스

> 최소 3개(통과·거절·경계) 권고 5개. 각 케이스에 expected behavior를 명시한다. (값은 검증 패스에서 수치 재확인 대상.)

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass) | 가족회사, 형제 3인 전원 QP claim 유효, 명단 완전 | basis=FAMILY, 구성원 3/3 유효, required=QP | **PASS** |
| T2 (Fail) | 목적형성 LLC, 구성원 5명 중 1명 QP 미충족 | formedForPurpose=true, 4/5 유효 | **FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED** (reject) |
| T3 (Suspend) | 펀드오브펀드, 구성원 10명 중 2명 KYC 진행 중 | 8/10 유효, 2 claim 미발급 | **FAIL_LOOKTHROUGH_NOT_COMPLETED** (suspend) |
| T4 (Boundary·재귀) | 구성원이 또 법인(2겹), 안쪽 전원 적격 | isEntity=true, depth=1, 내부 전원 유효 | **PASS** (재귀 1겹 정상) |
| T5 (Boundary·depth) | 법인이 4겹 중첩(권고 깊이 3 초과) | depth=4 | **REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED** (manual review) |
| T6 (분기) | 동일 법인, 구성원 전원 accredited지만 일부 QP 미달, R3가 호출 | required=QP, accredited만 보유 | **FAIL_LOOKTHROUGH_MEMBER_NOT_QUALIFIED** (accredited≠QP) |

T6이 특히 중요하다 — **"accredited는 되는데 QP는 안 되는" 구성원**을 펀드 거래(R3)에서 통과시키면 안 된다는 것을 검증한다(§5.3 분기 오작동 방지).

---

## §8. (α) 코드 변환 패턴 선택 — 왜 증명서형(B)인가

본 부품은 **패턴 B(증명서형)**다. 이유는 §5.5에서 본 대로, 핵심 판단(누가 구성원인가·목적형성인가·명단이 완전한가)이 *비결정적 사람의 판단*이라 온체인에서 재현 불가능하기 때문이다. 그래서 판단은 Trusted Issuer가 off-chain에서 하고(패턴 B의 "판단은 밖에서"), 온체인 코드는 *서명된 사슬의 완전성·유효성*만 확인한다(패턴 B의 "코드는 증명서만").

**왜 패턴 A(기계 판정형)가 아닌가**: 만약 본 부품을 기계 판정형으로 만들면, 코드가 "이 법인의 진짜 구성원이 누구인지"를 스스로 판단해야 하는데 — 차명·SPV·실질지배 같은 것을 코드는 알 수 없다. 그걸 아는 척하게 만들면 *틀린 통과*가 난다. 그래서 패턴 B가 법적으로도 기술적으로도 불가피하다.

**왜 패턴 C(감시형)도 아닌가**: 감시형은 "일단 통과시키고 사후 표시"인데, look-through 실패는 펀드 면제 *존립*이 걸린 pre-trade 차단 사유라 사후 표시로는 부족하다. 거래 *전에* 막아야 한다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — A-13·A-08과의 사슬

본 부품은 *혼자 작동하지 않는다.* 세 부품이 한 묶음으로 돈다.

```
[법인·신탁 매수인이 BUIDL 매수 시도]
        │
        ▼
A-08(법인 자격 산정) ── "이 법인이 *자기 자산만으로* 자격이 되나?"
        │                  ├─ 예(목적형성 아님 + 자산 충족) → A-09 불필요, 통과
        │                  └─ 아니오(목적형성이거나 전원-적격 경로) ▼
        ▼
A-09(본 부품, look-through) ── "구성원 전원이 요구 자격을 갖췄나?"
        │                       └─ 개인 구성원 → A-13(QP) 또는 A-03(Accredited) claim 확인
        │                       └─ 법인 구성원 → A-09 재귀
        ▼
A-13(QP) / A-03(Accredited) ── 개별 구성원의 자격 claim 유효성 판정
```

- **A-08(선행 게이트)**: 법인이 *목적형성이 아니고 자기 자산이 충분*하면 look-through 없이 통과한다. A-08이 "look-through가 필요한가"를 먼저 가르고, 필요할 때만 본 부품을 부른다. (A-08 미완성 시 본 부품도 보수적으로 강제 발동하는 fallback을 권고.)
- **A-13/A-03(하위 호출)**: 본 부품은 개별 구성원을 직접 판정하지 않고, 개인 구성원은 A-13(QP)·A-03(Accredited)의 claim 확인 로직을 *재사용*한다. 즉 본 부품은 *오케스트레이터*이고, 실제 개인 자격 판정은 A-13/A-03이 한다.
- **Recipe 분기**: R3가 부르면 required_qual=QP, R1이 부르면 required_qual=ACCREDITED. BUIDL처럼 R1·R3가 누적되면 둘 다 통과해야 한다(§5.3).
- **A-13 cascade 일관성**: A-13 문서 §5.2의 pseudocode에서 `claim.basis == QP_FAMILY`일 때 `check_A_09(claim.lookThroughChain)`를 호출하는 부분이 *바로 본 부품의 진입점*이다. 두 문서의 인터페이스(lookThroughChain 구조·반환 코드)는 일치해야 한다.

---

## §10. (γ) 3-Layer Solution — 책임 분배

본 부품의 판정 신뢰성은 세 겹의 방어선으로 떠받친다.

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. Self-Attestation** | 법인 매수인 | 자기 구성원 구조·목적형성 여부 신고 | 허위 신고 가능 → Layer 2가 검증 |
| **2. Trusted Issuer** | 신뢰기관(KYC·실사) | 구성원 확정·전원 자격 확인·목적형성 판정·재귀 수행·사슬 서명 | 실사 누락 가능 → Layer 3가 표본 점검 |
| **3. External Spot-Check** | Decipher 운영·외부 감사 | 사슬 표본 추출·구조 검증·이상 패턴(깊이 초과 등) 사람 판단 | 전수 아님 → 보수적 기본값으로 보완 |

**escalation rule**: Layer 2에서 명단 완전성을 보증 못 하면 `FAIL_LOOKTHROUGH_REQUIRED`로 차단(Layer 1만으로는 통과 불가). 재귀 깊이 초과는 Layer 3 manual review로 escalate. 즉 *자기신고만으로는 절대 통과하지 못하고*, 최소 Trusted Issuer 보증이 있어야 한다.

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 구조 신고 UI | Frontend | 법인 매수인이 구성원 구조를 입력(개인/법인 구분, 지분) — 트리 형태 |
| 진행률 표시 | Frontend | "구성원 10명 중 8명 확인 완료" 같은 진행률 + 미완료 구성원 안내(suspend 상태일 때) |
| 구성원 실사 | Off-chain(Trusted Issuer) | 각 구성원 KYC·자격 확인·재귀·목적형성 판정 |
| 사슬 발급·갱신 | Off-chain → On-chain | 구성원이 마저 완료되면 사슬 업데이트 → suspend 거래 자동 재개 |
| Manual review | Off-chain(Decipher 운영) | 깊이 초과·이상 구조 표본 검토 |

**UX 핵심**: suspend(NOT_COMPLETED)는 사용자에게 *"거절"이 아니라 "대기 중, 무엇이 남았는지"*로 보여야 한다. 적법한 펀드오브펀드가 거절당했다고 오해하고 이탈하지 않도록, 미완료 구성원과 다음 행동을 명확히 안내한다.

---

## §12. Open Issues — 변호사·ADR 확인 대상

본 부품에는 *코드 이전에 법적으로 확정해야 할* 회색지대가 있다. 보수적 기본값으로 막아 두되, 아래는 변호사 트랙·ADR로 보낸다.

1. **재귀 깊이(look-through depth)** 🔴 — 구성원이 또 법인일 때 *법적으로 몇 겹까지* 봐야 "전원 확인"이 충족되나? 권고는 depth 3이나, 1997 S&C No-Action Letter의 "directly or indirectly" 해석과 함께 변호사 확인 필요. (코드는 한계 도달 시 manual review로 보수 처리.)
2. **목적형성(formed for the specific purpose) 판정 기준** 🟡 — 어떤 사실이 "이 증권을 사려고 급조됨"의 증거가 되나(설립일·사업실질·자본 출처)? Trusted Issuer 실사 기준서로 구체화 + 변호사 확인.
3. **명단 완전성 보증의 법적 수준** 🟡 — Trusted Issuer가 "구성원 명단이 완전하다"고 보증할 때 요구되는 due diligence 깊이. reasonable belief(Rule 2a51-1(h)) 기준과 연동.
4. **QP·accredited 이중 요구의 누적 처리** 🟡 — R1·R3 동시 발동 시 "더 엄격한 QP만 보면 충분한가, 둘 다 독립 확인해야 하나"의 실무 확정.
5. **신탁(Trust) 결합 판정** 🟡 — §2(a)(51)(A)(iii)의 "수탁자 + 각 위탁자" 결합을, 1999 ABA Subcommittee letter 등 실무 해석과 함께 확인(A-13 §12와 공유 쟁점).

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX_부품영문이름.md   (Element)
            R-XX_Recipe영문이름.md  (Recipe)
본 부품: A-09_entity-look-through.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. 법인·신탁 매수인의 *구성원 look-through* 부품 심층 walkthrough 신설. ① 규제 맥락(빈 회사 우회 문제 → 두 법체계(Reg D·ICA)의 공통 원리 → Decipher 조건부·치명성 → 한국 실제소유자 확인 anchor), ② 법적 근거 3 Layer(§2(a)(51)(A)(ii)(iii)·Rule 2a51-3·Rule 501(a)(8)/(3)/(7)·Ralston Purina·1997 S&C NAL·IC-22597), ③ 입력 사실(lookThroughChain 구조·5단계 수집), ④ 판정 로직(재귀 pseudocode·required_qual 분기·reject vs suspend), ⑤ 테스트 6종(전원·재귀·depth·자격분기), 패턴 B 선택 reasoning, A-08·A-13·A-03 cascade coordination, 3-Layer 책임 분배, frontend/off-chain, Open Issues 5종(재귀 depth·목적형성·명단완전성·이중요구·신탁결합). **인용 검증은 후속 일괄 패스 대상**("먼저 작성, 검증 나중" 전략). A-13 walkthrough와 인터페이스(lookThroughChain·반환 코드) 일치 전제.
