---
type: element-walkthrough
element-id: A-13
element-name: Qualified Purchaser
parent-recipe: R3 (ICA §3(c)(7) Fund)
internal-id: ELE.A-13
status: v2.1 — 공유 산출물 form (citation 검증 정정 반영·자체완결·규제맥락 우선)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 USC § 80a-2(a)(51) — Qualified Purchaser 정의: https://www.law.cornell.edu/uscode/text/15/80a-2"
  - "15 USC § 80a-3(c)(7) — ICA §3(c)(7) 면제: https://www.law.cornell.edu/uscode/text/15/80a-3"
  - "17 CFR § 270.2a51-1 — Investments 정의·valuation·reasonable belief(h): https://www.law.cornell.edu/cfr/text/17/270.2a51-1"
  - "17 CFR § 270.2a51-3 — Certain companies as qualified purchasers(목적형성 회사 look-through): https://www.law.cornell.edu/cfr/text/17/270.2a51-3"
  - "17 CFR § 270.3c-5 — Knowledgeable Employee 제외: https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.3c-5"
  - "SEC v. Ralston Purina Co., 346 U.S. 119 (1953): https://supreme.justia.com/cases/federal/us/346/119/"
  - "SEC v. W.J. Howey Co., 328 U.S. 293 (1946): https://supreme.justia.com/cases/federal/us/328/293/"
  - "Oxford Univ. Bank v. Lansuppe Feeder, 933 F.3d 99 (2d Cir. 2019): https://law.justia.com/cases/federal/appellate-courts/ca2/16-4061/16-4061-2019-08-05.html"
  - "SEC Release IC-22597, 62 FR 17512 (Apr. 9, 1997) — Privately Offered Investment Companies(adopting release): https://www.federalregister.gov/"
created: 2026-06-13
updated: 2026-06-14
tags: [element, A-13, qualified-purchaser, walkthrough, spec-sheet, R3, ICA-§3c7]
---

# A-13 Qualified Purchaser — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **Qualified Purchaser 부품**(내부 식별자 A-13)을, 미국 펀드 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC·판례 등 **외부 공식 자료만** 사용한다.

> ⚠️ **출처 검증 정정 노트 (v2.1, 2026-06-14).**
> 본 부품의 1차 리서치 및 v1.0·v2.0 초안에는 아래 인용 오류가 있었고, v2.1에서 연방규칙 원문(eCFR·Cornell LII)을 대조해 정정했다. 읽는 사람은 아래를 정확한 것으로 보면 된다.
> - **Knowledgeable Employee(펀드 임직원) 규칙은 Rule 2a51-3이 아니라 Rule 3c-5**(17 CFR § 270.3c-5)다. 또한 정확한 메커니즘은 "KE를 QP로 *간주*"가 아니라, **KE 보유분을 'exclusively QP' 판정에서 *제외***(Rule 3c-5(b))하는 것이다.
> - **Rule 2a51-3은 "목적형성 회사(formed for the specific purpose)" look-through 규칙**이다. (KE 규칙이 아님 — 둘이 뒤바뀌어 있었음)
> - **Reasonable Belief(합리적 신뢰) 안전항은 Rule 2a51-1(h)**다. ((g)가 아님. (g)는 QIB·합산투자 등 특칙) 또한 종전 인용문의 "reasonable care" 문구는 본 규칙 텍스트에 **존재하지 않는다** — 실제 (h)는 "Relying Person이 합리적으로 QP라고 믿으면 충분하다"는 더 단순한 문장이다.
> - **투자 취득용 차입금(Outstanding Indebtedness) 차감은 Rule 2a51-1(e)·(f)**, **주거·사업용 부동산 제외는 Rule 2a51-1(c)**다. ((d)는 평가 방법 — FMV 또는 cost — 규정)
> - **Oxford Univ. Bank 판결의 holding은 ICA §47(b)의 묵시적 사적 소권(rescission)**이다. "§3(c)(7) 자체에 관한 직접 판시"가 아니라, 펀드가 면제를 잃을 때 투자자가 매수계약 *해제*를 청구할 수 있는 *경로*를 확인해 준 판결이다.
> - **SEC Release IC-22597은 1997년 adopting release**(62 FR 17512, 1997-04-09)다. (종전 "1996" 표기는 부정확)

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"이 매수인이 BlackRock BUIDL 같은 펀드 토큰을 살 자격이 있는가"*를 거래 직전에 판정한다. 그런데 "자격"의 기준인 **Qualified Purchaser**(QP)는 미국 펀드 규제의 깊은 곳에서 나온 개념이라, 조문만 들이밀면 *왜* 이런 기준이 있는지 알 수 없다. 그래서 큰 그림(미국 증권법의 구조 → 이 규제가 생긴 역사 → 우리 시스템에서의 의미 → 한국법과의 비교)을 먼저 깐다.

### 1.1 미국 증권법의 4개 기둥(4 Pillar)과 그중 ICA 1940의 자리

미국 연방 증권규제는 한국처럼 하나의 「자본시장법」으로 통합돼 있지 않고, **시대별로 따로 만들어진 4개의 큰 법률**이 각자 다른 국면을 맡는다. 쉽게 말하면 한국은 증권 관련 규제가 *한 건물 안의 여러 부서*라면, 미국은 *길 건너 따로 선 4개의 건물*이다.

| 기둥(법률) | 맡는 국면 | 핵심 관심사 | 한국법 대응(직관용) |
|---|---|---|---|
| **Securities Act of 1933**(1933년법) | 증권의 **발행**(1차 시장) | "팔기 전에 등록·공시했는가" | 자본시장법 증권신고서·공모 규제 |
| **Securities Exchange Act of 1934**(1934년법) | 증권의 **유통·거래소·중개업자**(2차 시장) | "거래소·broker-dealer·계속공시" | 자본시장법 유통시장·금융투자업·거래소 규정 |
| **Investment Company Act of 1940**(ICA, 투자회사법) | **집합투자기구(펀드)** 자체의 규율 | "펀드 구조가 투자자를 착취하지 않는가" | 자본시장법 집합투자(펀드) 규제 |
| **Investment Advisers Act of 1940**(투자자문업자법) | **투자자문업자**(adviser) | "남의 돈을 굴려주는 자의 신인의무" | 자본시장법 투자자문·일임업 |

**본 부품(Qualified Purchaser 부품)은 세 번째 기둥, 즉 ICA 1940의 영역에서 나온다.** 이 점이 중요하다. A-13은 *"증권을 발행할 때 등록했는가"*(1933년법)나 *"거래소·중개업자 등록을 했는가"*(1934년법)를 보는 부품이 아니다. 그것들은 완전히 별개의 법체계(legal regime)이고, Decipher에서는 다른 Recipe·다른 부품이 맡는다. A-13이 답하는 질문은 오직 하나다 — **"이 펀드의 지분을 사려는 사람이, ICA가 요구하는 *투자자 자격*을 갖췄는가."**

쉽게 말하면: 같은 토큰 한 건의 거래라도 미국법은 *세 군데의 다른 관문*을 통과시킨다. (1) 발행이 적법했나(1933년법), (2) 거래 경로·중개가 적법한가(1934년법), (3) 그리고 — 그 토큰이 *펀드 지분*이라면 — 펀드가 등록 면제를 유지할 수 있는 투자자에게만 가는가(ICA 1940). A-13은 세 번째 관문의 핵심 검사원이다.

### 1.2 왜 이 규제가 존재하는가 — 대공황과 investment trust 스캔들

ICA 1940은 진공에서 태어난 법이 아니다. **1929년 대공황**의 직접적 산물이다.

쉽게 말하면 이렇다. 1920년대 미국에는 **investment trust**(오늘날의 펀드 조상)가 우후죽순 생겼다. 일반 대중의 돈을 모아 주식·채권에 굴리는 구조였는데, 당시엔 규제가 거의 없었다. 그 결과 1929년 붕괴 전후로 전형적인 병폐가 드러났다 — 운용자가 자기 잇속을 챙기는 **self-dealing(자기거래)**, 빚으로 빚을 쌓아 위험을 키우는 **excessive leverage·pyramiding(과도한 차입·피라미드 구조)**, 운용자와 투자자 이익이 부딪히는 **conflicts of interest(이해상충)**, 투자자가 펀드 안을 들여다볼 수 없는 **opaque governance(불투명한 지배구조)**가 그것이다.

의회(Congress)의 결론은 *"펀드라는 구조 그 자체가 일반 투자자에게 독특한 위험(unique risk)을 안긴다"*는 것이었다. 그래서 ICA 1940은 **등록 펀드에 대단히 엄격한 규율**을 건다 — SEC 등록, 자산의 분리보관(custody), 독립이사 중심 governance, 차입(leverage) 한도, 이해관계자 거래(affiliate transaction) 제한 등.

여기서 면제(exemption)의 필요가 생긴다. hedge fund·venture capital·private equity처럼 **세련된 투자자(sophisticated investor)만 상대하는 펀드**에까지 이 엄격한 규율을 강제하는 것은 과잉이다. 그래서 ICA §3(c)에 여러 면제 통로가 마련됐다. 그중 두 개가 핵심이다.

| 면제 통로 | 투자자 수 제한 | 투자자 자격 조건 |
|---|---|---|
| **§3(c)(1)**(1940년 제정) | beneficial owner **100인 이하** | 특별한 자격 요건 없음 |
| **§3(c)(7)**(1996년 NSMIA 신설) | 인원수 cap 없음(실무상 후술) | **모두 Qualified Purchaser** |

§3(c)(7)은 **1996년 NSMIA**(National Securities Markets Improvement Act, 전국증권시장개선법)로 신설됐다. 핵심 거래(trade-off)는 이렇다 — "투자자 머릿수 100인 cap을 풀어주는 대신, 한 명 한 명이 모두 QP여야 한다." 즉 *양(머릿수)을 풀고 질(자격)을 높인* 것이다. (다만 펀드가 실제로 투자자 수를 무한정 늘리지는 못한다. 1934년법 §12(g)의 등록 트리거 — 통상 record holder 2,000인 — 때문에, §3(c)(7) 펀드도 실무상 2,000인 미만으로 관리한다. 이건 ICA가 아니라 1934년법에서 오는 *별개의* 제약이다.)

**오늘날 토큰화된 RWA 펀드(BlackRock BUIDL, Ondo, Securitize 발행물 등) 대부분이 바로 이 §3(c)(7) 통로를 쓴다.** 그래서 A-13은 학술적 부품이 아니라, 실제 BUIDL을 거래소에 올리는 순간 작동해야 하는 부품이다.

### 1.3 Decipher 시스템에서 왜 중요한가 — Existential Risk

이제 우리 시스템으로 내려오자. BlackRock BUIDL이 Decipher DEX에 listing된다고 하자. BUIDL은 **§3(c)(7) 면제에 기대어** 투자회사 등록을 피하고 있다. §3(c)(7)의 핵심 요건을 다시 보면 — 펀드의 **모든 outstanding securities(발행된 전체 지분)**가, **취득 시점(at the time of acquisition)에 Qualified Purchaser인 자**에 의해 **배타적으로(exclusively)** 소유되어야 한다.

여기서 "exclusively"가 무섭다. **단 한 명의 non-QP가 BUIDL을 취득하는 순간**, 그 펀드는 "QP에게만 배타적으로 소유된다"는 조건을 깨뜨린다. 결과는 단계적으로 파국이다.

```
non-QP 1명이 BUIDL 매수
   → §3(c)(7) "exclusively QP" 조건 위반
   → BUIDL의 §3(c)(7) 면제 status 상실
   → BUIDL이 "미등록 투자회사(unregistered investment company)"로 전락
   → ICA 위반 상태에서 운영 → 등록 의무(수개월·막대한 비용) 또는 거래 정지·강제 unwind
   → (그리고 결정적으로) 투자자가 §47(b)로 매수계약 rescission(해제) 청구 가능
```

마지막 줄이 이 위험에 *법적 이빨*을 준다. **Oxford Univ. Bank v. Lansuppe Feeder, 933 F.3d 99 (2d Cir. 2019)** 판결에서 제2연방항소법원은 **ICA §47(b)가 묵시적 사적 소권(implied private right of action)을 만들어, ICA를 위반하는 계약의 당사자가 *해제(rescission)*를 청구할 수 있다**고 판시했다. 쉽게 말하면 — 펀드가 면제를 잃어 ICA 위반 상태가 되면, 그 손해를 본 투자자가 직접 법원에 가서 "내 매수계약을 무효로 돌려달라"고 할 수 있다는 뜻이다. 펀드(그리고 그 인프라)에게는 집단소송·환매청구가 현실이 된다. (이 판결은 §3(c)(7) 그 자체를 다룬 사건은 아니지만, 면제 상실이 *어떤 경로로* 구체적 손해배상·계약해제로 이어지는지를 보여주는 근거로 쓰인다.)

그래서 **DEX의 거래 직전 관문(pre-trade gate)에서 모든 prospective buyer의 QP 자격을 확인하는 일은 "있으면 좋은" 기능이 아니라 BUIDL listing의 존립을 좌우하는(existential) 안전장치**다. 업계 선례(Securitize·tZERO·INX)에서도 엄격한 pre-trade QP gating이 사실상 industry standard로 자리잡았다. A-13은 그 관문의 매수인 측 핵심 검사원이다.

쉽게 말하면: A-13이 실수로 non-QP를 한 명 통과시키면, 잘못되는 것은 그 거래 하나가 아니라 *펀드 전체*다. 그래서 이 부품의 설계 철학은 시종 "보수적으로, 의심스러우면 막거나 사람에게 넘긴다"이다.

### 1.4 한국 자본시장법과의 비교 — 전문투자자 vs Qualified Purchaser

한국 변호사·개발팀이 직관을 잡도록, 한국 자본시장법과 나란히 놓아 보자. (아래는 *직관을 위한 비유*이며 법적 등가가 아니다 — 두 제도의 기준·효과는 다르다.)

**구조의 차이.** 한국은 모든 집합투자기구를 「자본시장법」 하나에서 통합 규제하고, 공모(public offering)와 사모(private)를 **청약 권유 50인 기준**으로 가른다. 미국은 앞서 본 대로 4개 법률로 쪼개져 있고, 펀드 면제는 ICA §3(c) 안에서 별도 통로로 작동한다.

**투자자 자격 개념의 차이 — 이게 핵심이다.** 한국 자본시장법에는 크게 **전문투자자**(금융기관·국가·상장법인 + 일정 자산·전문성 요건을 갖춘 개인)와 **일반투자자**의 *이층 구조*가 있다. 그런데 미국은 세련된 투자자를 **두 단계(two tiers)**로 더 잘게 나눈다.

| 자격 | 근거 법 | 대략의 기준 | 쓰이는 곳 | Decipher 부품 |
|---|---|---|---|---|
| **Accredited Investor**(적격투자자) | 1933년법 / Reg D | 순자산 $1M(주거주택 제외) 또는 소득 $200K/$300K | 발행 면제(Reg D 506) | A-03 |
| **Qualified Purchaser**(QP) | ICA §3(c)(7) | **투자자산(investments) $5M / $25M** | 펀드 등록 면제(§3(c)(7)) | **A-13(본 부품)** |

쉽게 말하면: 한국의 "전문투자자"가 미국에 가면 *대략* accredited investor + qualified purchaser를 합쳐 놓은 자리쯤에 선다. 하지만 미국은 이 둘을 **다른 법, 다른 기준, 다른 목적으로 엄격히 구분**한다. accredited investor는 *발행* 단계의 문턱(상대적으로 낮음)이고, qualified purchaser는 *펀드 면제* 단계의 문턱(훨씬 높음)이다. 기준 자체도 다르다 — accredited는 **순자산·소득(net worth/income)**으로 보고, QP는 **투자자산(investments)**으로 본다. (이 차이는 §3에서 자세히 다룬다. 둘을 혼동하면 "A-03을 통과했으니 A-13도 통과"라는 치명적 오작동이 생긴다.)

**Decipher에 주는 함의.** Decipher는 cross-border RWA tokenization을 다루므로, 한국 측 인력이 미국 QP 개념을 한국 전문투자자와 *대응*시켜 이해하되 *동일시*하지 않도록 하는 것이 중요하다. 그래서 본 문서는 미국 도메인 용어(qualified purchaser, investments, look-through 등)를 번역하지 않고 그대로 쓰되, 처음 나올 때 한국법 anchor를 붙인다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

> 아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. **본문에서는 이 코드들을 단독으로 쓰지 않고**, "본 부품"·"Qualified Purchaser 부품" 같은 자연어로 부른다. 코드는 시스템 추적용으로만 여기 둔다.

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Qualified Purchaser** | 펀드 매수 자격 검사원 |
| 검사 대상 | ICA §3(c)(7) fund 매수 자격(§2(a)(51) 4 categories + Rule 3c-5 Knowledgeable Employee 제외) | "이 사람이 펀드를 살 자격이 있나" |
| Internal ID | A-13 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **증명서형**(off-chain due diligence + on-chain claim 확인) | 기계가 직접 계산하지 않고, 신뢰기관의 서명 증명서를 확인 |
| Timing | **pre-trade**(거래 체결 직전) | 거래가 일어나기 전에 막는다 |
| Stateful 여부 | **STATELESS** | 매수 시점의 스냅샷만 보고 판정, 과거 상태를 누적하지 않음 |
| 주 활성화 Recipe | **R3**(ICA §3(c)(7) Fund) | 이 레시피가 본 부품을 부른다 |
| Cumulative Recipe | **R1**(Reg D 506(c) Issuance)·**R2**(§4(a)(7) Resale) | 함께 켜질 수 있는 레시피 |
| Cascade Element | **A-09**(Look-Through)·**A-08**(Affiliate)·**A-11**(Claim Freshness) | 본 부품이 추가로 호출하는 검사 부품 |
| 성숙도 | 🟡 R-1 단계(🔴 데모 핵심) | 데모에 필수, 후속 보완 진행 중 |
| 파일·위치 | A-13_qualified-purchaser.md · 산출물/elements/ | 산출물 경로 |

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

> **읽는 법.** 법적 근거는 세 겹이다. **Layer 1(조문)**은 의회가 만든 법률 텍스트(statute), **Layer 2(규칙)**는 SEC가 그 텍스트를 실무 수준으로 구체화한 연방규칙(rule), **Layer 3(해석)**은 판례·SEC 발행문서·No-Action Letter가 모호한 부분을 메운 해석이다. 아래로 갈수록 추상적인 법률이 구체적인 운영 기준으로 내려온다.

### 3.1 Layer 1 — Statutory base (조문 원문)

> **§ 2(a)(51)(A) — Qualified Purchaser 정의** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-2)]
>
> **Original**:
> "Qualified purchaser" means—
>   (i) any natural person ... who owns not less than $5,000,000 in investments, as defined by the Commission;
>   (ii) any company that owns not less than $5,000,000 in investments and that is owned directly or indirectly by or for 2 or more natural persons who are related as siblings or spouse (including former spouses), or direct lineal descendants by birth or adoption, spouses of such persons, the estates of such persons, or foundations, charitable organizations, or trusts established by or for the benefit of such persons;
>   (iii) any trust that is not covered by clause (ii) and that was not formed for the specific purpose of acquiring the securities offered, as to which the trustee or other person authorized to make decisions with respect to the trust, and each settlor or other person who has contributed assets to the trust, is a person described in clause (i), (ii), or (iv); or
>   (iv) any person, acting for its own account or the accounts of other qualified purchasers, who in the aggregate owns and invests on a discretionary basis, not less than $25,000,000 in investments.
>
> **한글 해석**: "Qualified Purchaser"는 네 갈래다 —
>   (i) **$5,000,000 이상의 investments(투자성 자산)를 보유한 자연인**,
>   (ii) **$5,000,000 이상의 investments를 보유하고, 형제·배우자·직계존비속 등 *가족관계로 묶인 2인 이상*이 직간접 소유한 회사**("Family Company"),
>   (iii) **특정 증권 취득을 위해 만들어진 것이 아니고, *수탁자(trustee)와 각 위탁자(settlor)가 모두* (i)·(ii)·(iv) 중 하나에 해당하는 trust**,
>   (iv) **$25,000,000 이상의 investments를, 자기 계산 또는 다른 QP들의 계산으로, *재량(discretionary)으로* 보유·운용하는 자**(주로 기관·운용사).

해설: (i)은 개인, (ii)는 가족회사, (iii)은 신탁, (iv)는 기관이라고 보면 된다. **자연인·가족회사는 $5M, 기관은 $25M**이라는 두 문턱이 핵심이다. 그리고 (ii)·(iii)은 *그 안의 사람들*까지 따져야 자격이 정해진다 — 이것이 뒤(§5·§7)에서 다룰 **look-through(들여다보기)**의 법적 뿌리다.

> **§ 3(c)(7)(A) — ICA 등록 면제 조건** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-3)]
>
> **Original**:
> "Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities. Securities ... received ... as a gift or bequest, or [by] ... legal separation, divorce, death, or other involuntary event, shall be deemed to be owned by a qualified purchaser ..."
>
> **한글 해석**: 펀드의 모든 outstanding securities가 **취득 시점에 QP인 자**에 의해 **배타적으로(exclusively) 소유**되고, 그 시점에 **public offering(공모)을 하지 않으며** 향후 할 의도도 없는 issuer는 투자회사 등록이 면제된다. (단, 증여·상속·이혼·사망 등 *비자발적 사유*로 QP에게서 넘겨받은 지분은 QP가 소유한 것으로 간주한다.)

해설: §3(c)(7) 면제에는 **두 개의 조건**이 있다 — ① "모든 지분이 *취득 시점에* QP에게 배타적으로 소유"(Condition 1), ② "public offering을 하지 않음"(Condition 2). **본 부품(A-13)이 책임지는 것은 Condition 1**이다. Condition 2(공모 금지)는 부품 하나로 끝나지 않고 DEX 거래환경 전체에 걸리는 Recipe-level 문제이며, 이 문서 §9·§12에서 별도로 다룬다.

> **§ 3(c)(7)(B) — 기존 §3(c)(1) 펀드의 전환 경과조항(transition)** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-3)]
>
> **Original**(요지):
> "Notwithstanding subparagraph (A), an issuer is within the exception ... if (i) in addition to qualified purchasers, outstanding securities ... are beneficially owned by not more than 100 persons who are not qualified purchasers ... [who] acquired ... on or before September 1, 1996 ... [and] at the time ... the issuer was excepted by paragraph (1) ..."
>
> **한글 해석**: §3(c)(7)(B)는 **1996년 9월 1일 이전부터 §3(c)(1)(100인 이하 펀드)로 운영되던 기존 펀드가 §3(c)(7)로 전환할 때**, 그 시점에 이미 들어와 있던 *non-QP 100인 이하*를 일정 요건(공시·환매 기회 제공 등) 하에 그대로 둘 수 있게 해 주는 **경과조항(grandfathering)**이다.

해설(⚠️ 정정 포인트): §3(c)(7)(B)는 **Knowledgeable Employee(펀드 임직원) 조항이 *아니다*.** 종전 초안은 여기에 KE를 잘못 붙였다. KE는 아래 §3.2의 **Rule 3c-5**에서 별도로 다룬다. 또한 이 경과조항은 *신규로 토큰을 발행·거래*하는 BUIDL 같은 펀드에는 거의 의미가 없다(1996년 이전 §3(c)(1) 이력이 없으므로). Decipher에서는 사실상 적용 여지가 없는 조항이지만, "§3(c)(7)(B)=KE"라는 오해를 막기 위해 명시해 둔다.

### 3.2 Layer 2 — Regulatory specification (연방규칙 원문)

조문이 *법률 텍스트*를 준다면, 연방규칙(Rule)은 그 텍스트를 *실무에서 계산 가능한 수준*으로 구체화한다. 본 부품에 필요한 규칙은 두 갈래다 — **"investments가 무엇이고 얼마로 치는가"(Rule 2a51-1)**, 그리고 **"회사·신탁·임직원은 어떻게 보는가"(Rule 2a51-3, Rule 3c-5)**.

> **17 CFR § 270.2a51-1(b) — "Investments"의 정의(무엇을 자산으로 치는가)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**(요지):
> "Investments" means: (1) Securities (other than securities of an issuer that controls, is controlled by, or is under common control with the prospective qualified purchaser, with limited exceptions); (2) Real estate held for investment purposes; (3) Commodity Interests held for investment purposes; (4) Physical Commodities held for investment purposes; (5) ... financial contracts entered into for investment purposes; (6) [§3(c)(7) Company 매수자인 경우] firm commitments to contribute capital; and (7) Cash and cash equivalents held for investment purposes.
>
> **한글 해석**: investments는 7가지다 — (1) 증권(단, 매수인이 *지배·피지배·공동지배* 관계에 있는 issuer의 증권은 원칙 제외), (2) 투자 목적 부동산, (3) 상품파생(commodity interests), (4) 실물상품(금·은 등), (5) 투자 목적 금융계약(스왑 등), (6) §3(c)(7) 펀드 매수자인 경우의 약정 출자분, (7) 투자 목적 현금·현금성 자산(예금·CD·MMF·국채 등).

> **17 CFR § 270.2a51-1(c) — "Investment Purposes"(주거·사업용 부동산 제외)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**(요지):
> "Real estate shall not be considered to be held for investment purposes ... if it is used ... for personal purposes or as a place of business ... [of] the Prospective Qualified Purchaser or a Related Person ..."
>
> **한글 해석**(⚠️ 정정 포인트): 부동산이라도 **본인이나 가족이 살거나(personal) 사업장으로 쓰는(place of business)** 것은 investments로 *치지 않는다*. 즉 "주거·사업용 제외" 규정은 (b)(2)가 아니라 **(c)**에 있다. (부동산 투자업자가 사업상 보유하는 부동산은 예외적으로 인정 등 단서가 있음.)

> **17 CFR § 270.2a51-1(d) — Valuation(얼마로 평가하는가)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**(요지):
> "... the aggregate amount of Investments ... shall be the Investments' fair market value on the most recent practicable date or their cost ..."
>
> **한글 해석**: investments 금액은 **최근 실무적으로 가능한 시점의 fair market value(공정시장가치, FMV) 또는 취득원가(cost)**로 잰다. (FMV로 평가하면 시세의 손익이 이미 반영되므로, 손실 종목의 net 처리는 자동으로 된다.)

> **17 CFR § 270.2a51-1(e)·(f) — Deductions(차입금 차감)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**(요지):
> "(e) ... there shall be deducted ... the amount of any outstanding indebtedness incurred to acquire or for the purpose of acquiring the Investments ... (f) [Family Company의 경우 소유자가 그 투자를 취득하기 위해 진 차입금도 차감]"
>
> **한글 해석**(⚠️ 정정 포인트): **투자를 취득하기 위해 진 차입금(outstanding indebtedness)**은 investments에서 차감한다. 이 차감 규정은 (d)가 아니라 **(e)**(개인)·**(f)**(Family Company)에 있다. 핵심은 *투자 취득 목적* 차입만 차감된다는 점이다 — 일반 주택담보대출이나 사업자금 대출은 차감 대상이 아니다.

> **17 CFR § 270.2a51-1(h) — Reasonable Belief(합리적 신뢰 안전항)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **Original**:
> "The term 'qualified purchaser' ... means any person that meets the definition of qualified purchaser in section 2(a)(51)(A) of the Act and the rules thereunder, or that a **Relying Person reasonably believes** meets such definition."
> (여기서 "Relying Person"은 §3(c)(7) Company 또는 그를 대신해 행위하는 자를 말한다.)
>
> **한글 해석**(⚠️ 정정 포인트): QP에는 *실제로 정의를 충족하는 자* 외에, **펀드(또는 그 대리인)가 합리적으로 QP라고 믿는 자**도 포함된다. 즉 사후에 매수인이 실은 QP가 아니었음이 드러나도, 펀드가 **reasonable belief(합리적 신뢰)**를 가지고 있었다면 면제가 곧바로 깨지지 않는다. 이 한 줄이 본 부품의 "증명서형" 설계 전체를 떠받치는 법적 토대다(§8). **주의**: 이 규칙은 (g)가 아니라 **(h)**이고, 종전 인용문에 있던 *"reasonable care를 행사한 경우에 한한다"*는 문구는 본 규칙 텍스트에 **존재하지 않는다**. ((g)는 QIB·부부합산·자회사 합산 등 별도 특칙이다.) "합리적 신뢰를 위해 상당한 주의를 다해야 한다"는 *취지*는 실무·집행상 당연히 요구되지만, 규칙 (h)의 문언 자체에 못 박혀 있지는 않다.

> **17 CFR § 270.3c-5 — Knowledgeable Employee(펀드 임직원의 제외)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.3c-5)]
>
> **Original**(요지):
> "(a)(4) The term 'Knowledgeable Employee' ... means any natural person who is: (i) an Executive Officer, director, trustee, general partner, advisory board member, or person serving in a similar capacity, of the Covered Company or an Affiliated Management Person ...; or (ii) an employee ... (other than ... clerical, secretarial or administrative functions) who, in connection with his or her regular functions or duties, participates in the investment activities ... provided that such employee has been performing such functions ... for at least 12 months.
> (b) For purposes of ... whether the outstanding securities of a Section 3(c)(7) Company are owned exclusively by qualified purchasers, there shall be excluded securities beneficially owned by: (1) a Knowledgeable Employee ...; (2) a company owned exclusively by Knowledgeable Employees ..."
>
> **한글 해석**(⚠️ 핵심 정정): **펀드 임직원(Knowledgeable Employee) 규칙은 Rule 3c-5다.** "Knowledgeable Employee"란 (i) Covered Company(= §3(c)(1) 또는 §3(c)(7) 펀드)나 그 운용 관계사의 **임원(Executive Officer)·이사·수탁자·무한책임사원·자문위원 등**이거나, (ii) **펀드 투자활동에 정규 업무로 관여해 온(12개월 이상)** 직원을 말한다. 그리고 Rule 3c-5(b)의 메커니즘은 — KE를 "QP로 간주"하는 것이 아니라, **"펀드 지분이 QP에게 배타적으로 소유되는가"를 따질 때 KE 보유분을 *계산에서 제외***하는 것이다. 결과적으로 KE는 $5M 자산이 없어도 자기 펀드에 투자할 수 있지만, *법 문언상의 경로는 "제외(exclusion)"*라는 점을 정확히 알아야 한다.

> **17 CFR § 270.2a51-3 — Certain companies as qualified purchasers(목적형성 회사의 look-through)** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-3)]
>
> **Original**(요지):
> "(a) ... a company shall not be deemed to be a qualified purchaser if it was formed for the specific purpose of acquiring the securities offered by a [§3(c)(7)] company ... unless each beneficial owner of the company's securities is a qualified purchaser. (b) ... a company may be deemed to be a qualified purchaser if each beneficial owner of the company's securities is a qualified purchaser."
>
> **한글 해석**(⚠️ 정정 포인트): Rule 2a51-3은 **KE 규칙이 아니라**, "이 펀드 지분을 사려고 *급조된 회사*"의 남용을 막는 규칙이다. 즉 특정 증권 취득 목적으로 만들어진 회사는, **그 회사의 *모든 beneficial owner가 각자 QP*일 때만** QP로 인정된다. 이것이 회사·신탁을 *들여다보는(look-through)* 또 하나의 법적 근거다.

### 3.3 Layer 3 — Interpretive guidance (판례·발행문서·No-Action Letter)

조문·규칙이 모호한 부분은 판례·SEC 발행문서·No-Action Letter가 메운다. Decipher에 가장 중요한 자료들이다.

> **SEC v. Ralston Purina Co.**, 346 U.S. 119 (1953) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/346/119/)]
>
> **Holding 핵심**: "An offering to those who are shown to be able to fend for themselves is a transaction 'not involving any public offering.'"(스스로를 지킬 수 있음이 입증된 자들에 대한 청약은 '공모에 해당하지 않는' 거래다.)

연방대법원이 "public offering(공모)"의 의미를 처음 명확히 한 foundational case다. 핵심은 **"투자자가 스스로를 보호할 수 있는가(able to fend for themselves)"**라는 기능적 기준이고, 실무는 여기서 4-factor test를 끌어낸다 — ① 청약 받은 사람 수(offerees), ② 그들의 sophistication, ③ 발행자 정보에 대한 접근성(access to information), ④ 매수 목적(투자용인가 전매용인가). **Decipher 관련성**: §3(c)(7)의 Condition 2("no public offering")도 이 4-factor가 출발점이다. DEX의 secondary trading이 "public offering"으로 해석되는지가 §3(c)(7) 유지의 핵심 질문이며, §9·§12에서 다룬다.

> **Oxford Univ. Bank v. Lansuppe Feeder**, 933 F.3d 99 (2d Cir. 2019) [🔗 [Justia](https://law.justia.com/cases/federal/appellate-courts/ca2/16-4061/16-4061-2019-08-05.html)]
>
> **Holding 요약**(⚠️ 정정 포인트): 제2연방항소법원은 **ICA §47(b)가 묵시적 사적 소권(implied private right of action)을 만들어, ICA를 위반하는 계약의 당사자가 *rescission(계약 해제)*을 청구할 수 있다**고 판시했다.

**Decipher 관련성**: 이 판결은 §3(c)(7) 그 자체를 직접 다룬 사건이 아니다. 하지만 §1.3에서 본 existential risk에 *구체적 경로*를 준다 — 펀드가 면제를 잃어 ICA 위반 상태(미등록 투자회사)가 되면, §47(b)를 통해 **투자자가 매수계약의 해제를 청구**할 수 있다는 것. 즉 "면제 상실"이 추상적 위험에 그치지 않고 *현실의 소송·환매로 전환되는 다리*가 이 판결로 확인된다. (이 판결을 "§3(c)(7) 위반의 효과를 판시한 판례"로 인용하면 부정확하므로, 위와 같이 §47(b) rescission 경로로 정확히 인용해야 한다.)

> **SEC v. W.J. Howey Co.**, 328 U.S. 293 (1946) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/328/293/)]
>
> **Holding 핵심**: "investment contract"(투자계약 = 증권)의 4-factor — ① 금전 투자, ② 공동 사업, ③ 이익 기대, ④ 타인의 노력에서 비롯되는 이익.

**Decipher 관련성**: ICA가 적용되려면 우선 그 토큰이 "security"여야 한다. BUIDL은 펀드 지분이므로 Howey test를 명확히 충족하고, 따라서 ICA §3(c)(7) 분석 대상이 된다. (Reves v. Ernst & Young, 494 U.S. 56 (1990)의 note 분류 테스트는 채권형 자산에서 보충적으로 쓰이나, BUIDL 같은 펀드 지분에는 Howey가 직접 적용된다.)

> **SEC Release IC-22597, 62 FR 17512 (Apr. 9, 1997)** — *Privately Offered Investment Companies* (adopting release)
>
> **성격**(⚠️ 정정 포인트): 위 Rule 2a51-1·2a51-3·3c-5를 **채택한 1997년 SEC adopting release**다. (종전 "1996" 표기는 부정확 — 제안은 1996년이었으나 채택·시행은 1997년 4월이며, 규칙 말미의 게재정보도 "62 FR …, Apr. 9, 1997"로 일치한다.) §2(a)(51)·§3(c)(7) 신설의 입법 취지와 규칙 해석의 근거 자료로 쓴다.

> **No-Action Letters(실무 해석 — 변호사 확인 대상).** 1차 리서치는 Family Company의 look-through 깊이에 관한 *1997 Sullivan & Cromwell* letter, Trust의 trustee+settlor 결합 처리에 관한 *1999 ABA Subcommittee* letter를 인용했다. 이들은 조문의 회색지대(예: "directly or indirectly" 소유의 범위, trust 결합 판정)에 관한 **실무 해석 자료**다. 다만 No-Action Letter는 사실관계 한정적이고 SEC를 구속하지 않으므로, 본 문서는 그 *존재와 다루는 쟁점*만 적고, 구체적 보유depth·결합 판정 결론은 **§12 Open Issues로 보내 변호사가 원문을 직접 확인**하도록 한다.

### 3.4 Sub-요건 분해 매트릭스

위 조문·규칙을 실무 판정 path로 분해하면 다섯 갈래가 된다. 각 행은 *소리 내 읽어도 문장이 되도록* 풀어 썼다.

| 판정 path | 충족 조건(풀어 읽기) | 근거 | Decipher 복잡도 |
|---|---|---|---|
| (i) 자연인 | 자연인이고, 투자자산이 $5M 이상이다 | §2(a)(51)(A)(i) | 🟢 낮음 — 단일 증명 |
| (ii) Family Company | 회사이고, 투자자산 $5M 이상이며, 가족관계로 묶인 2인 이상이 직간접 소유한다 | §2(a)(51)(A)(ii) | 🟡 중간 — look-through 필요 |
| (iii) Trust | 신탁이고, 특정 증권 취득 목적으로 만든 게 아니며, 수탁자와 모든 위탁자가 각각 (i)·(ii)·(iv)에 해당한다 | §2(a)(51)(A)(iii) | 🔴 높음 — 복합 판정 |
| (iv) 기관·기타 | $25M 이상을 자기/타 QP 계산으로 재량 운용한다 | §2(a)(51)(A)(iv) | 🟡 중간 — 기관 검증 |
| (목적형성 회사) | 이 펀드 매수 목적으로 만든 회사라면, 모든 beneficial owner가 각각 QP여야 한다 | Rule 2a51-3 | 🔴 높음 — 전원 look-through |
| (KE 제외) | 펀드 임직원이면 자산요건 없이 *exclusively-QP 판정에서 제외*된다 | Rule 3c-5 | 🟡 중간 — 고용·관여 증명 |

해설: 위에서 (i)·(iv)는 비교적 단순(자산 금액 한 번 확인)하지만, (ii)·(iii)·목적형성 회사는 *그 안의 사람들*을 따라 들어가야 한다(look-through). KE는 자격을 *부여*하는 게 아니라 판정에서 *빼주는* 경로라는 점에서 결이 다르다. 이 다섯 갈래가 §4(어떤 증거가 필요한가)와 §5(어떻게 판정하는가)의 토대다.

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

쉽게 말하면, 본 부품이 "이 사람이 펀드를 살 자격이 있다"고 말하려면 네 가지 질문에 대한 답이 *증거(evidence)*로 모여 있어야 한다.

1. **이 매수인은 어느 갈래인가?** (자연인·Family Company·Trust·기관·Knowledgeable Employee 중 무엇인가)
2. **그 갈래의 문턱을 넘는가?** (자연인·가족회사 $5M, 기관 $25M, 또는 KE의 직위·근속 요건)
3. **그 증거를 신뢰할 수 있는 기관이 검증·서명했는가?** (Trusted Issuer가 확인했는가)
4. **그 증거가 지금도 유효한가?** (취득 시점 기준으로 너무 오래되지 않았는가)

이 네 답을 모으는 주체는 **Trusted Issuer**(KYC·due diligence를 수행하는 신뢰기관)이고, 모은 결과는 **on-chain claim**(블록체인에 기록된 서명 증명서) 형태로 발행되어 DEX가 조회할 수 있게 된다. 전체 정보 흐름은 *frontend 자기신고 → Trusted Issuer 실사 → on-chain claim 발급 → DEX가 거래 직전 조회*다.

### 4.2 Data field — DEX가 실제로 읽는 항목

> 아래 필드 이름·ONCHAINID Topic 번호 등은 Decipher의 ERC-3643 호환 구현을 전제한 *예시 스펙*이다(구현 시 확정). 각 행에 "이 필드가 왜 필요한가"를 함께 적었다.

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `claim.basis` | enum | Trusted Issuer claim | 매수인이 어느 갈래인지(QP_NATURAL·QP_FAMILY·QP_TRUST·QP_OTHER·KNOWLEDGEABLE_EMPLOYEE) |
| `claim.verifiedAt` | timestamp | Trusted Issuer claim | claim이 언제 발급됐는지(유효기간 판정용) |
| `claim.issuer` | address | Trusted Issuer claim | 어느 Trusted Issuer가 발급했는지(신뢰성 확인용) |
| `claim.coveredCompany` | string | Trusted Issuer claim(KE 전용) | KE가 어느 펀드 소속인지 명시 |
| `claim.signature` | bytes | Trusted Issuer claim | 위·변조 방지용 서명 |
| `claim.investmentsValue` | uint256(선택) | Trusted Issuer claim | 문턱 충족 여부(금액 자체는 Trusted Issuer가 사전 판정, DEX는 "문턱 이상" 신뢰) |
| `lookThroughChain[]` | array | Trusted Issuer claim(가족·신탁 전용) | 하위 소유자들의 QP 증명 참조(look-through cascade용) |
| `block.timestamp` | timestamp | blockchain | 거래 확정 시점(취득 시점 스냅샷) |

쉽게 말하면: DEX는 매수인의 자산 명세서를 직접 들여다보지 않는다. 대신 **"신뢰기관이 *이미 확인했다*고 서명한 증명서"**를 본다. 그 증명서에 "어느 갈래(basis)인지, 언제 확인했는지(verifiedAt), 누가 보증하는지(issuer)"가 담긴다.

### 4.3 수집 경로 — 5단계 흐름

```
1단계  Frontend 자기신고      매수인이 DEX에서 KYC 시작 + 자기 갈래 선택
   ↓
2단계  증거 제출              매수인 → Trusted Issuer에 증빙 제출
                            (예: brokerage statement·부동산 감정서·고용증명·trust deed)
   ↓
3단계  Off-chain 실사         Trusted Issuer가 Rule 2a51-1·3c-5에 따라 법적 판단 +
                            reasonable belief(합리적 신뢰) 형성
   ↓
4단계  On-chain claim 발급    Trusted Issuer가 서명한 claim을 블록체인에 기록
   ↓
5단계  DEX 거래 직전 검사      DEX가 claim 조회 → 본 부품 판정 → PASS 또는 FAIL code
```

각 단계 누가·무엇을·결과: **1단계**(매수인이, 자기 갈래를 고르고, 어떤 증거를 낼지 분기가 정해진다) → **2단계**(매수인이, 증빙 서류를 제출하고, Trusted Issuer 손에 자료가 모인다) → **3단계**(Trusted Issuer가, 법적 판단을 하고, 합리적 신뢰가 형성된다) → **4단계**(Trusted Issuer가, 서명 claim을 올리고, 온체인에 조회 가능한 증명서가 생긴다) → **5단계**(DEX가, claim을 확인하고, 통과/거절이 결정된다).

**핵심**: DEX는 5단계에서 *결정론적 확인*만 한다. 가족관계의 적법성, trust 설립목적의 남용 여부, KE의 실질 관여 같은 *판단*은 모두 3단계에서 Trusted Issuer가 off-chain으로 하고, 그 결과를 claim에 *부호화(encode)*한다. 이 분리가 왜 불가피한지는 §5.5와 §8에서 설명한다.

### 4.4 갈래별 증거 예시

| 갈래 | 필요한 증거(예시) | 왜 이게 증거가 되나 |
|---|---|---|
| 자연인 | brokerage statement·부동산 감정서·예금잔고·상품계좌 명세 | investments $5M 이상을 FMV로 입증 |
| Family Company | 위 + 지분구조도·가족관계 증빙 + 하위 소유자 look-through 자료 | 회사 자산 $5M + 가족관계 + 구성원 QP 여부 확인 |
| Trust | trust deed·수탁자/위탁자 신원 + 각자의 QP 증빙 + 설립일(남용 방지) | 결합요건과 "특정목적 형성 아님"을 입증 |
| 기관·기타 | 법인 등록·재량운용 권한 증빙·$25M investments 증빙 | $25M + 재량운용 요건 입증 |
| Knowledgeable Employee | 고용계약·직무기술서·근속 증빙·투자활동 관여 자기진술 + 신뢰기관 검증 | Rule 3c-5 직위(i) 또는 관여+12개월(ii) 충족 입증 |

---

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.1 전체 흐름 (사람 말로)

증거(claim)가 모인 뒤, 온체인 코드는 다음 순서로 확인한다 — ① claim이 존재하는가 → ② 위조 아닌가·신뢰기관이 발급했는가 → ③ 유효기간이 지나지 않았는가 → ④ 어느 갈래인가에 따라 갈래별 추가 확인 → ⑤ PASS 또는 구체적 FAIL code 반환.

### 5.2 Pseudocode + 단계별 해설

```
function check_A_13(prospective_buyer, asset, block):

    # 1단계: claim 조회
    claim = ONCHAINID.getClaim(prospective_buyer, Topic.QP)
    if claim == null:
        return FAIL_NOT_QP

    # 2단계: 서명·발급기관 신뢰 확인
    if not Cryptography.verify(claim.signature, claim.issuer):
        return FAIL_NOT_QP                       # 위조 의심
    if not TrustedIssuerRegistry.contains(claim.issuer):
        return FAIL_UNTRUSTED_QP_CLAIM_ISSUER

    # 3단계: 유효기간(취득 시점 스냅샷)
    freshness_cap = 1 year                        # Decipher 권고(5년 보수 옵션 가능)
    if claim.verifiedAt < block.timestamp - freshness_cap:
        return FAIL_QP_CLAIM_EXPIRED

    # 4단계: 갈래(basis) 분기
    if claim.basis == QP_NATURAL:                 # $5M은 Trusted Issuer가 사전 판정
        return PASS
    elif claim.basis == QP_FAMILY:                # 가족회사 → look-through
        if not check_A_09(claim.lookThroughChain):
            return FAIL_QP_LOOKTHROUGH_NOT_COMPLETED if A09.in_progress
                   else FAIL_FAMILY_CO_NOT_QP
        return PASS
    elif claim.basis == QP_TRUST:                 # 수탁자+모든 위탁자 QP여야
        if not check_trust_qp(claim.lookThroughChain):
            return FAIL_TRUST_DISQUALIFIED
        return PASS
    elif claim.basis == QP_OTHER:                 # $25M·재량운용은 사전 판정
        return PASS
    elif claim.basis == KNOWLEDGEABLE_EMPLOYEE:   # 소속 펀드 일치 확인
        if claim.coveredCompany != asset.fund_identifier:
            return FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED
        return PASS
    else:
        return REVIEW_QP_UNCERTAIN
```

- **1단계 해설**: 매수인 주소에 연결된 QP claim을 찾는다. 아직 Trusted Issuer에게 claim을 받지 않았다면 여기서 `FAIL_NOT_QP`. 매수인은 frontend가 안내하는 대로 Trusted Issuer로 가서 KYC를 시작하면 된다.
- **2단계 해설**: 서명을 검증하고, 발급기관이 Decipher가 신뢰하는 명부(Trusted Issuer Registry)에 있는지 본다. 서명이 깨졌으면 위조 의심으로 `FAIL_NOT_QP`, 서명은 멀쩡한데 발급기관이 명부에 없으면 `FAIL_UNTRUSTED_QP_CLAIM_ISSUER`(대개 명부 갱신 지연 같은 운영 이슈라 관리자에게 알림).
- **3단계 해설**: 여기서 §3(c)(7)(A)의 **"at the time of acquisition"**(취득 시점) 요건을 본다. claim 발급 후 1년이 지났으면 `FAIL_QP_CLAIM_EXPIRED`. 취득 시점에 유효한 KYC가 있어야 한다는 요건을 1년 cap으로 구현한 것이다(어느 블록 timestamp를 기준으로 잡을지는 §5.4).
- **4단계 해설**: claim의 갈래에 따라 분기한다. 자연인·기관은 금액 판정을 Trusted Issuer가 이미 했으므로 통과. 가족회사·신탁은 *그 안의 사람들*을 확인하는 cascade가 돈다. KE는 *소속 펀드(coveredCompany)가 지금 사려는 펀드와 같은지*를 확인해, 남의 펀드에 KE 자격을 끌어다 쓰지 못하게 막는다.

### 5.3 Threshold 매트릭스

| 항목 | 값 | 근거 |
|---|---|---|
| 자연인 investments | **≥ $5M (inclusive — 정확히 $5M이면 통과)** | §2(a)(51)(A)(i) "not less than" |
| Family Company investments | **≥ $5M (inclusive)** | §2(a)(51)(A)(ii) "not less than" |
| 기관·기타 investments | **≥ $25M (inclusive)** | §2(a)(51)(A)(iv) "not less than" |
| Knowledgeable Employee 근속 | **≥ 12개월**(직위형 KE는 근속요건 없음) | Rule 3c-5(a)(4)(ii) |
| Claim 유효기간 cap | **1년**(권고)·5년(보수 옵션) | 취득시점 요건 + Claim Freshness 부품(A-11) 조율 |

**inclusive 해석 reasoning**: 조문이 *"not less than $5,000,000"*(5백만 달러보다 적지 않은)으로 쓰였다. 영어 법조문에서 "not less than"은 **≥(이상, inclusive)**으로 읽는다. 따라서 *정확히 $5M*인 경우는 통과다. §7.3 경계 테스트에서 명시적으로 확인한다.

### 5.4 Time-of-acquisition — 블록체인의 어느 시점을 "취득"으로 보나

§3(c)(7)(A)는 판정 기준 시점을 "at the time of acquisition"으로 못 박는다. 전통 금융에서는 계약 체결 시점이 명확하지만, 블록체인 DEX에는 시점 후보가 여럿이다. 비유하면 — *주문서에 사인한 순간*과 *등기소에 등기가 찍힌 순간* 중 어느 것을 "취득"으로 볼 것인가의 문제다.

| 시점 후보 | "취득 시점" 부합도 | 운영 리스크 |
|---|---|---|
| Trade matching time(오프체인 주문 체결) | 불일치 — 아직 정산 미확정 | 높음(정산 실패 가능) |
| Transaction proposed time(mempool 진입) | 불일치 — 포함 보장 없음 | 높음(re-org·교체 가능) |
| **Transaction confirmed time(블록 포함)** | **최적 — 법적 "execution"에 가장 부합** | 낮음(단일 블록 확정) |
| Transaction finalized time(완결성 확보) | 보수적 부합 — 필요 이상 늦음 | 가장 낮음 |

**Decipher 권고: block confirmation timestamp 기준.** 거래가 블록에 포함되어 확정된 시점의 `block.timestamp`를 취득 시점으로 본다. 경계 거래(예: claim 만료 30초 전 매칭 → 30초 후 confirmation)에서는 이 기준상 `FAIL_QP_CLAIM_EXPIRED`가 날 수 있으므로, frontend에서 매칭 직전 조기 안내·재발급 유도를 권고한다(UX, §11). *정확히 어느 timestamp가 법적 "acquisition time"인지는 변호사 확인 대상이다*(§12).

### 5.5 비결정성을 결정성으로 — 본 부품 구현의 본질

여기에 결정적인 법-기술 통찰이 있다. **QP 판정은 순수한 결정론적 계산이 아니라, 사람의 판단(judgment)을 내포한다.** 조문 곳곳이 판단을 요구한다 — §2(a)(51)(A)(ii)의 "가족관계로 묶였는가"는 *사실관계 판단*, (iii)의 "특정 증권 취득 목적으로 만든 게 아닌가"는 *의도 판단*, Rule 2a51-1(b)(1)의 "지배·공동지배 관계인가"는 *지배구조 판단*, (d)의 "최근 FMV는 얼마인가"는 *평가 판단*이다.

이 판단들은 온체인 코드로 재현할 수 없다. 그래서 **Rule 2a51-1(h)의 reasonable belief 안전항**에 기대어, Trusted Issuer가 off-chain에서 실사·판단을 하고 그 결과를 claim으로 부호화하는 구조가 불가피하다. 즉 **본 부품의 구현 본질은 "비결정적 법적 판단을 결정적 증명서 확인으로 캡슐화하는 것"**이다. 온체인 로직은 "claim이 있는가·서명이 유효한가·발급기관을 믿는가·기간이 지났는가"라는 결정론적 확인만 하지만, 그 claim 뒤에는 Trusted Issuer의 비결정론적 판단이 담겨 있다.

쉽게 말하면(비유): 판사가 판결문에 서명한다. 서명된 판결문 *자체*는 명확하고 결정적인 문서다 — 하지만 그 판결에 이르는 과정은 판사의 복잡한 판단·형량의 결과다. 본 부품도 똑같다. Trusted Issuer의 서명된 claim은 기계가 명확히 확인할 수 있는 결정적 문서지만, 그 발급 과정은 사람의 법적 판단이다. **기계는 판결문의 위·변조만 확인하고, 판결 자체는 사람(Trusted Issuer)이 한다.**

---

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

검사가 실패하면 거래가 그 자리에서 차단되거나(reject), 일부 경우엔 대기 상태로 전환된다(suspend). 어떤 종류의 실패인지에 따라 ① 매수인에게 보이는 메시지, ② 매수인이 해야 할 다음 행동, ③ Decipher 측 조치가 달라진다. 아래 표는 "기술 코드"가 아니라 *시나리오 풀이*로 읽으면 된다.

### 6.2 Failure codes 9종

| Code | 언제 뜨나 | 무엇이 문제인가 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_NOT_QP` | claim 없음·갈래 불일치·서명 위조 | 아직 QP 증명서가 없거나 증명서가 위조됨 | Trusted Issuer에서 KYC 시작/재시도 | frontend에 재안내 링크 |
| `FAIL_QP_CLAIM_EXPIRED` | verifiedAt < (block.timestamp − 유효기간) | 증명서가 오래되어 만료(1년 경과) | Trusted Issuer에 갱신 요청 | frontend에 갱신 안내 |
| `FAIL_UNTRUSTED_QP_CLAIM_ISSUER` | 발급기관이 신뢰 명부에 없음 | Decipher가 신뢰하지 않는 기관이 발급 | 다른 Trusted Issuer에서 재발급 | 관리자 알림·명부 갱신 검토 |
| `FAIL_QP_LOOKTHROUGH_REQUIRED` | 가족회사·신탁인데 하위 소유자 정보 없음 | 들여다볼 구성원 자료가 비어 있음 | 추가 KYC 자료 제출 | Trusted Issuer가 look-through 자료 보강 |
| `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED` | look-through 진행 중(일부 구성원 미완료) | 구성원 일부의 KYC가 아직 안 끝남 | 기다리거나 해당 구성원 재촉 | 거래 **suspend**(거절이 아닌 대기) |
| `FAIL_TRUST_DISQUALIFIED` | 수탁자·위탁자 중 QP 미충족자 있음 | 신탁 결합요건을 못 맞춤 | 신탁 자격·구조 재검토 | 신탁 측에 상세 안내 |
| `FAIL_FAMILY_CO_NOT_QP` | 가족회사 구성원 중 QP 미충족자 있음 | 한 명이라도 자격 미달이면 전체 탈락 | 해당 소유자 추가 KYC 또는 출자 조정 | 가족회사 측에 상세 안내 |
| `FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED` | 소속펀드 불일치·근속/관여 미충족 | KE 요건을 못 맞춤 | KE 자격 재검증 또는 다른 경로 시도 | HR 측 증빙 보강 |
| `REVIEW_QP_UNCERTAIN` | 자동 판정 불가(경계 케이스·명부 갱신 중 등) | 기계가 결정할 수 없는 복잡 케이스 | 수동 검토 결과 대기 | Trust Operations 큐로 라우팅 |

해설: 대부분의 실패는 *되돌릴 수 있는* 상태다. `FAIL_NOT_QP`나 `FAIL_QP_CLAIM_EXPIRED`는 매수인이 KYC를 시작·갱신하면 풀린다. 반면 `FAIL_FAMILY_CO_NOT_QP`·`FAIL_TRUST_DISQUALIFIED`는 *구조 자체*의 문제라 구성원 보강이나 구조 변경이 필요하다. `FAIL_QP_LOOKTHROUGH_NOT_COMPLETED`만 유독 *거절이 아닌 대기(suspend)*인데, 이는 "자격이 없다"가 아니라 "아직 확인 중"이기 때문이다 — 시간이 지나 구성원 KYC가 끝나면 같은 거래가 통과될 수 있다.

### 6.3 Manual Review Path (REVIEW_QP_UNCERTAIN 처리)

자동 판정이 불가능한 경계 케이스는 사람이 처리한다. 흐름은 이렇다.

1. 거래가 **suspend**(거절이 아닌 대기) 상태로 전환된다.
2. `REVIEW_QP_UNCERTAIN`이 수동 검토 큐에 쌓인다.
3. **Decipher Trust Operations team**이 큐에서 집어 든다(목표 응답시간 SLA 24~72시간 — 운영 정책으로 확정 대상).
4. 팀이 추가 증거를 요청하거나, 경계의 법적 판단을 하거나, 필요하면 변호사 자문으로 escalate한다.
5. 최종 결정(통과 또는 명시적 FAIL code)을 내리고, 통과면 별도 claim 발급으로 반영한다.
6. 모든 결정과 근거(reasoning)를 Compliance Log에 남긴다(off-chain audit trail).

누가 결정하나: 최종 판단 권한은 **추가 실사를 한 Trusted Issuer 또는 Decipher Trust Operations**에 있고, 그 결정은 *새 claim*으로 온체인에 반영되어 다음 거래부터 자동 판정된다.

### 6.4 Error message — 매수인 노출용 vs 내부 기록용 분리

개인정보 보호와 운영 진단을 분리한다. 매수인에게는 *일반적이고 행동 가능한* 메시지만 보여주고, 구체적 실패 사유는 내부 audit log에만 남긴다.

| Code | 매수인 노출(frontend) | 내부 기록(audit) |
|---|---|---|
| FAIL_NOT_QP | "QP 자격 확인이 필요합니다. KYC를 진행해 주세요." | claim 부재 timestamp + 매수인 주소 |
| FAIL_QP_CLAIM_EXPIRED | "KYC 인증이 만료되었습니다. 갱신해 주세요." | claim.verifiedAt + 경과 일수 |
| FAIL_QP_LOOKTHROUGH_NOT_COMPLETED | "추가 정보 확인 중입니다. 잠시 후 다시 시도해 주세요." | 미완료 구성원 목록 |
| FAIL_TRUST_DISQUALIFIED | "Trust 구조 검토가 필요합니다. KYC팀에 문의해 주세요." | 미충족 수탁자/위탁자 목록 |

이유: 매수인에게 "당신 신탁의 위탁자 중 X가 자격 미달"이라고 노출하면 다른 사람의 자산정보가 새 나갈 수 있다. 그래서 노출 메시지는 *무엇을 하라*만, 내부 로그는 *왜 막혔나*를 담는다.

---

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

다섯 가지 극단 시나리오로 검증한다. 다섯 케이스가 모두 기대대로 동작해야 스펙이 완성(complete)이다.

### 7.1 Test 1 — Pass (명백한 통과)

**시나리오**: 미국 거주 45세 자연인. 주식·채권 portfolio가 FMV $7M(brokerage statement로 입증). Trusted Issuer Y가 2026-05-01에 QP claim 발급. 2026-06-13에 BUIDL 매수 시도.

**기대 결과**: PASS

**단계별 trace**: 1단계 claim 발견 ✅ → 2단계 Trusted Issuer Y는 명부 등록·서명 유효 ✅ → 3단계 1.5개월 경과(< 1년 cap) ✅ → 4단계 basis=QP_NATURAL → 추가 cascade 없이 PASS.

**해설**: 가장 전형적인 통과다. Trusted Issuer가 brokerage statement를 받아 FMV로 평가하고, 투자 취득용 차입금(있다면)을 Rule 2a51-1(e)로 차감한 뒤 $7M > $5M으로 판정해 claim을 발급했다. DEX는 그 claim의 진위·신뢰성·유효기간·갈래만 확인하고 통과시킨다. *금액 계산은 DEX가 하지 않는다.*

### 7.2 Test 2 — Fail (명백한 거절)

**시나리오**: 미국 거주 자연인. investments $4.9M(같은 항목이되 $0.1M 부족). Trusted Issuer가 문턱 미달로 판정해 **claim 발급을 거부**.

**기대 결과**: FAIL_NOT_QP

**trace**: 1단계 claim 없음 → FAIL_NOT_QP.

**해설**: 문턱을 못 넘으면 Trusted Issuer가 애초에 claim을 발급하지 않는다. 그래서 DEX 입장에서는 "claim이 없다"는 사실만으로 `FAIL_NOT_QP`가 난다. 매수인은 frontend에서 "QP 자격 확인이 필요합니다"를 받고, 추가 증빙을 내거나 투자자산을 늘린 뒤 재시도하거나 다른 경로를 고려해야 한다. (여기서 "왜 막혔는지" 구체 금액은 매수인 화면에 노출하지 않는다 — §6.4.)

### 7.3 Test 3 — Boundary (정확히 $5M)

**시나리오**: 미국 거주 자연인. Rule 2a51-1 평가·차감을 거친 investments가 *정확히 $5,000,000*.

**기대 결과**: PASS (inclusive 해석)

**경계 sub-질문 해소**:

| 질문 | 결정 | 법적 reasoning |
|---|---|---|
| $5M은 inclusive(≥)인가 exclusive(>)인가 | **inclusive (≥)** | §2(a)(51)(A)(i)이 "not less than"으로 명시 → 영어 법조문상 "≥". 정확히 $5M이면 통과 |
| 주거·사업용 부동산 포함 여부 | **제외** | Rule 2a51-1**(c)**: 본인·가족 거주나 사업장으로 쓰는 부동산은 "investment purposes"가 아님 |
| 차입금 차감 범위 | **투자 취득용 차입만 차감** | Rule 2a51-1**(e)**: "incurred to acquire ... the Investments". 일반 주택담보·사업자금 대출은 차감하지 않음 |
| 손실 종목 net 처리 | **FMV 기준이라 자동 반영** | Rule 2a51-1(d): "fair market value as of a recent date" — 최근 시가에 손실이 이미 반영됨 |

**해설**: 경계에서 법률가가 명확히 정해 주지 않으면 개발자가 임의로 결정하게 되고, 그 임의 결정이 곧 *부당한 차단*(정당한 매수인을 막음)이나 *부당한 통과*(자격 미달자를 통과)로 이어진다. 위 네 질문의 reasoning이 테스트 케이스에 명시돼야 스펙이 완성된다. (특히 주거용 부동산 제외 근거가 (b)(2)가 아니라 (c)라는 점은 v2.1에서 정정한 항목이다.)

### 7.4 Test 4 — Cascade (3단 가족회사 look-through)

**시나리오**: 다층 가족회사 구조.

```
Layer 0  Family LLC A (매수 주체)
  ├─ Layer 1  Member 1 = Family LLC B (파트너 4명)
  │     ├─ Layer 2  파트너 1: 개인 investments $4M → NOT QP ❌
  │     ├─ Layer 2  파트너 2: 개인 investments $7M → QP ✅
  │     ├─ Layer 2  파트너 3: 개인 investments $6M → QP ✅
  │     └─ Layer 2  파트너 4: 개인 investments $8M → QP ✅
  └─ Layer 1  Member 2 = 개인 $9M → QP ✅
```

**기대 결과**: FAIL_FAMILY_CO_NOT_QP

**trace**: A-13 활성화 + basis=QP_FAMILY → look-through 부품(A-09) cascade → 재귀적으로 구성원 확인 → Layer 2 파트너 1이 $4M으로 QP 미충족 발견 → Family LLC B 전체 탈락 → Family LLC A(Layer 0) 전체 탈락 → 최종 FAIL_FAMILY_CO_NOT_QP.

**해설**: 왜 파트너 1의 $4M이 *전체*를 무너뜨리나? §2(a)(51)(A)(ii)의 "directly or indirectly"(직간접 소유)와 Rule 2a51-3(목적형성 회사는 *모든* beneficial owner가 각자 QP여야 함)이 근거다. 쉽게 말하면 — 가족회사가 QP가 되려면 *그 안의 모든 사람*이 자격을 갖춰야 하므로, 단 한 명의 미달자가 사슬 전체를 끊는다. Decipher의 cascade는 이 strict 요건을 그대로 구현한다. (정확한 재귀 *깊이*의 한계는 §12 Open Issue.)

### 7.5 Test 5 — Knowledgeable Employee 예외

**시나리오**: BlackRock의 BUIDL Portfolio Manager. 개인 investments $3M(자연인 문턱 $5M 미달). 그러나 BlackRock Investment Management에서 36개월 근속, BUIDL 펀드의 executive officer 역할.

**claim**: basis=KNOWLEDGEABLE_EMPLOYEE / coveredCompany="BlackRock BUIDL Fund LLC" / 매수 대상 asset.fund_identifier="BlackRock BUIDL Fund LLC".

**기대 결과**: PASS

**trace**: 1~3단계 통과 → 4단계 basis=KNOWLEDGEABLE_EMPLOYEE → coveredCompany == asset.fund_identifier ✅ → $5M 문턱과 무관하게 PASS.

**해설**: Rule 3c-5(a)(4)(i)의 "Executive Officer"에 해당하는 Portfolio Manager는 *직위만으로* Knowledgeable Employee가 된다(근속 12개월 요건은 (a)(4)(ii) 일반 직원에만 적용). 펀드 운영 내부자는 펀드 위험을 충분히 이해한다는 입법 판단이다. 정확히는 — Rule 3c-5(b)에 따라 이 사람의 보유분이 "exclusively QP" 판정에서 *제외*되므로, $5M이 없어도 자기 펀드에 투자할 수 있다. 본 부품은 여기에 *소속 펀드 일치 확인*을 더해, KE 자격을 *남의 펀드* 매수에 끌어다 쓰는 것을 막는다. (이것이 KE를 Rule 2a51-3이 아니라 Rule 3c-5로 다뤄야 하는 이유다 — v2.1 정정 항목.)

---

## §8. (α) 증명서 확인형 패턴 — 왜 이 방식인가

### 8.1 Decipher의 검증 방식 3패턴

Decipher는 법적 판정을 온체인 코드로 옮기는 방식을 세 가지로 나눈다.

| 패턴 | 이름 | 작동 방식 | 예시 |
|---|---|---|---|
| **A** | 직접 계산형 | 온체인 코드가 직접 비교·계산 | 나이 ≥ 18, 보유기간 ≥ 6개월, 제재명부 매칭 |
| **B** | 증명서 확인형 | off-chain 신뢰기관이 판단 → 서명 claim 발급 → DEX는 claim만 확인 | KYC·QP·Accredited Investor·Affiliate 판정 |
| **C** | 외부 oracle형 | 외부의 결정론적 데이터를 가져옴 | NAV·토큰 가격·환율 |

### 8.2 QP 판정에 패턴 B가 유일한 선택인 이유

**패턴 A는 불가능하다.** §5.5에서 본 비결정성 때문이다. 가족관계 판단(§2(a)(51)(A)(ii)), 지배관계 판단(Rule 2a51-1(b)(1)), 평가 판단(Rule 2a51-1(d)), KE의 실질 관여 판단(Rule 3c-5(a)(4)(ii))은 모두 *사람의 판단(judgment)*이라 온체인 코드가 재현할 수 없다.

**패턴 C도 불가능하다.** Oracle은 가격 피드처럼 *외부의 사실(fact)*을 전달하는 수단이다. "이 사람이 QP인가"는 사실 전달이 아니라 *법적 판단*이라, oracle이 줄 수 없다. 법적 판단을 제공하는 oracle은 존재하지 않는다.

**그래서 패턴 B만 남는다.** Trusted Issuer가 off-chain에서 실사·판단을 하고 결과를 서명 claim으로 전달하면, DEX는 그 claim의 결정론적 확인(서명·발급기관·기간·갈래)만 한다.

### 8.3 패턴 B의 법적 토대 — Rule 2a51-1(h) Reasonable Belief

이 방식이 법적으로 성립하는 근거가 **Rule 2a51-1(h)의 reasonable belief 안전항**(§3.2)이다. 펀드(또는 그를 대신하는 Relying Person)가 매수인을 *합리적으로 QP라고 믿었다면*, 사후에 실은 아니었음이 드러나도 면제가 곧바로 깨지지 않는다. Trusted Issuer가 그 "합리적 신뢰"를 형성·문서화하는 주체가 되고, 그 효과가 펀드(BlackRock)와 인프라(Decipher)로 어떻게 미치는지(cascade)는 §10.4 책임 분배에서 다룬다. (다시 강조: 이 안전항은 (g)가 아니라 (h)이며, "reasonable care" 문구는 규칙 문언에 없다 — 실무상 상당한 주의가 요구된다는 *취지*와 규칙 *문언*을 구분해야 한다.)

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

### 9.1 본 부품의 책임 경계

본 부품은 §3(c)(7)의 **Condition 1("취득 시점에 QP가 배타적으로 소유")**만 책임진다. **Condition 2("no public offering")**는 부품 하나로 끝나지 않는다 — Ralston Purina 4-factor(§3.3)가 DEX 거래환경 *전체*에 걸리는 Recipe-level 문제이며, "DEX의 secondary trading이 공모를 유발하는가"라는 질문은 Decipher의 No-Action Letter 신청 핵심 쟁점이다(§12).

또한 본 부품의 결과는 다른 부품·레시피와 *누적적으로(cumulative)* 작동한다. 가족회사 매수인은 look-through·affiliate·claim freshness 부품과 cascade되고, §3(c)(7) 레시피(R3) 외에 발행(R1)·재판매(R2) 레시피와도 함께 켜질 수 있다.

### 9.2 Element cascade map

```
A-13 (QP) ──┬─ (basis가 QP_FAMILY 또는 QP_TRUST) ──► A-09 (Equity Owner Look-Through)
            │                                          │
            │                                          └─ (소유자가 affiliate) ──► A-08 (Affiliate)
            │
            └─ (모든 경우) ──► A-11 (Claim Freshness · 취득시점 스냅샷)
```

| cascade 트리거 | 호출되는 부품 | 발동 조건 |
|---|---|---|
| basis가 가족회사 또는 신탁 | A-09 (Look-Through) | 항상(들여다보기 의무) |
| look-through 결과에 affiliate 포함 | A-08 (Affiliate) | 소유자 중 affiliate가 있을 때 |
| 모든 거래 | A-11 (Claim Freshness) | block.timestamp와 claim.verifiedAt 비교 |

해설: 가족회사·신탁 매수인이면 본 부품이 끝나는 게 아니라 *그 안의 사람들*을 보는 look-through 부품(A-09)을 부르고, 그 사람들 중 펀드 관계자(affiliate)가 있으면 또 affiliate 부품(A-08)이 붙는다. claim 신선도(A-11)는 모든 거래에 공통으로 붙는다.

### 9.3 Recipe orchestration

| Recipe | 본 부품 발동 조건 | 본 부품의 역할 |
|---|---|---|
| R3 (ICA §3(c)(7) Fund) | 항상(R3의 주 검사) | Condition 1(QP 배타적 소유) 판정 |
| R1 (Reg D 506(c) Issuance) | cumulative(발행+유통 동시 검증) | 발행 측 부품(A-03)과 *나란히* 검사 — 둘 다 통과해야 |
| R2 (Resale via §4(a)(7)) | cumulative | 재판매 경로 진입 시 QP 자격 확인 |

### 9.4 Conflict resolution rule — 3가지 경우

**경우 1 — A-13 통과인데 A-03 탈락(또는 그 반대).** 적격투자자(A-03)는 *순자산($1M)* 기준, QP(A-13)는 *투자자산($5M)* 기준이라, 같은 사람이라도 한쪽만 통과할 수 있다(예: 부동산 부자는 A-03 통과·A-13 탈락 가능). R1+R3가 동시에 켜지면 *둘 다 통과*해야 거래가 허용된다(AND 결합). R3만 켜진 경우엔 A-13만 본다.

**경우 2 — A-13은 통과인데 look-through(A-09)에서 구성원 일부 탈락.** 가족회사는 *모든 구성원*이 QP여야 자격이 생긴다(§2(a)(51)(A)(ii) + Rule 2a51-3). 한 명이라도 탈락하면 전체가 탈락하므로, A-13의 통과 판정이 번복되어 `FAIL_FAMILY_CO_NOT_QP`가 반환된다.

**경우 3 — R3 탈락인데 R2 통과(§3(c)(7) 상실인데 재판매 안전항은 유효).** R3 탈락은 펀드의 근본 위기다(§1.3). 재판매 안전항(R2)만으로 §3(c)(7) status를 되살릴 수는 없다. Decipher 운영 정책: R3 탈락 시 해당 자산 *전체* 거래를 suspend하고 Trust Operations가 사후 검토한다. (이 결합 처리의 정확한 규칙은 §12 Open Issue.)

### 9.5 Manifest 무결성과의 조율

본 부품의 결과(통과·FAIL code)는 자산의 컴플라이언스 상태를 담는 **Asset Compliance Manifest**에 누적 기록된다. 거래 체결 직후(post-trade commit) **Manifest 무결성 부품(B-01)**이 R3의 각 부품 결과가 서로 모순되지 않는지 재검증한다(회계 감사의 *재확인*에 비유). 불일치가 발견되면 audit alert이 뜬다.

---

## §10. (γ) 3-Layer Solution — 증거 신뢰를 세 겹으로

### 10.1 왜 3겹 구조인가

판정에 필요한 증거는 여러 곳에서 온다. 각 출처는 위험·비용·커버리지의 trade-off가 다르다. Decipher는 이를 세 겹으로 나눠 각 층의 역할·책임·법적 토대를 분리한다.

| 층 | 무엇 | 커버리지 | 비용 | reasonable belief 형성 |
|---|---|---|---|---|
| **Layer 1 — Self-Attestation** | 매수인 자기신고(frontend) | 1차 의도 수집·증거 갈래 결정 | 낮음 | 낮음(단독으론 불충분) |
| **Layer 2 — Trusted Issuer** | KYC 기관의 off-chain 실사 + claim 발급 | 핵심 증거 + 법적 판단 | 중–상 | **주(主)** — Rule 2a51-1(h) 안전항 직접 적용 |
| **Layer 3 — External Spot-Check** | 무작위 audit·Layer 2 품질 보증 | 안전망(체계적 실패 검출) | 상(표본) | 컴플라이언스 강화 |

### 10.2 각 층의 법적 토대

**Layer 1 — Self-Attestation**: 매수인이 frontend에서 자기 갈래를 선언한다("나는 자연인이고 $5M 이상 보유"). 자기신고 *자체*는 §2(a)(51)·Rule 2a51-1 판정 근거가 못 된다(증거 불충분). 하지만 Layer 2의 진입·범위를 정하는 역할을 한다(예: KE 경로로 갈지 결정).

**Layer 2 — Trusted Issuer**: 여기서 **Rule 2a51-1(h)의 reasonable belief**가 직접 적용된다. Trusted Issuer(KYC 기관·등록 투자자문업자·broker-dealer 등)가 증거를 수집·검증하고 Rule 2a51-1에 따른 법적 판단을 한다. 충실한 실사로 합리적 신뢰가 형성되면 안전항이 작동한다.

**Layer 3 — External Spot-Check**: Layer 2가 *체계적으로 느슨한* 실사를 하고 있지는 않은지 무작위로 점검하는 meta-control이다. Layer 2 자체에 대한 품질 보증·audit으로, 펀드 측 운영위험 관리와 안전항의 robustness를 강화한다.

### 10.3 층 간 escalation 규칙

```
Layer 1 (자기신고) 단독: 항상 불충분
   ↓ (모든 경우 escalate)
Layer 2 (Trusted Issuer): 주 경로 · 요건 충족 시 통과
   ↓ (REVIEW_QP_UNCERTAIN 또는 Layer 2 체계적 위험 발견 시)
Layer 3 (External Spot-Check): 최종 검증 · 표본 audit
```

### 10.4 Liability(책임) 분배 — 위조 KYC로 무자격자가 매수해 손해가 난 경우

위조 KYC로 무자격 매수인이 들어왔고, 펀드가 부도나 손해가 발생해 사후에 드러났다고 하자. 누가 책임지는가?

| 행위자 | 책임 측면 |
|---|---|
| **Buyer(매수인)** | misrepresentation(허위표시) 시 직접 사기 책임(민·형사) |
| **Trusted Issuer** | 충실한 주의를 다하지 못했으면 과실 책임 + 안전항 무효화 → 손해배상 대상 |
| **Fund(BlackRock)** | Trusted Issuer가 합리적 신뢰를 형성했으면 Rule 2a51-1(h) 안전항으로 보호, 아니면 §3(c)(7) status 상실 위험 |
| **Decipher(인프라 제공자)** | 인프라 제공자의 책임 경계는 명확한 case law가 아직 없음 — §12 Open Issue |

**이 cascade의 정확한 지도가 변호사 follow-up의 핵심 질문이다.** Securitize·tZERO·INX 선례에서는 각 회사가 §4(a)(7) 안전항·broker-dealer 등록 등 *추가 보호층*을 갖고 있었다. Decipher의 *인프라 전용(infrastructure-only)* 모델에서 유사 보호가 어떻게 적용되는지는 아직 분명하지 않다(§12). 쉽게 말하면 — "우리는 거래를 *중개*한 게 아니라 *판이 깔리는 코드*만 제공했다"는 항변이 통하는지를 변호사가 정리해 줘야 한다.

---

## §11. (δ) Frontend·Off-chain Operator Layer — 4-Layer로는 안 끝난다

### 11.1 4-Layer 밖의 층이 필요한 이유

Decipher의 공식 아키텍처는 4층이다 — Element·Recipe·Manifest·Operator. 그런데 본 부품이 *실제로* 작동하려면 이 4층에 들어가지 않는 층이 필요하다.

구체적 예시: **Knowledgeable Employee 식별은 frontend 자기신고 없이는 작동 불가능하다.** 매수인이 "나는 BlackRock 직원입니다"라고 frontend에서 선언해야 Trusted Issuer가 KE 자격 실사를 시작한다. 자기신고 없이 표준 QP 경로만 타면, $5M 문턱에서 막혀(`FAIL_NOT_QP`) *KE 자격이 있어도* 예외가 작동하지 않는다.

이는 **Decipher 구현이 4-Layer만으로 완결되지 않음**을 의미한다. *Layer 0(User Interaction)*과 *Layer 4.5(Off-chain Operator)*를 명시적으로 모델링할 필요가 있다 — 아키텍처 재검토 대상이다.

### 11.2 Frontend Self-Identification Flow

```
[Frontend / Interface Layer]
1. 매수인이 DEX 진입 + KYC onboarding 시작
2. 자기신고 UI:
   "어떤 자격으로 매수하시겠습니까?"
   ☐ 자연인 (investments $5M+)
   ☐ Family Company (가족관계 + $5M+)
   ☐ Trust (수탁자+위탁자 결합 + 자산)
   ☐ 기관·기타 (investments $25M+)
   ☐ Knowledgeable Employee (펀드 내부자)
3. 선택에 따라 증거 수집 form 분기

[Knowledgeable Employee 선택 시 추가 입력]
   - 소속 운용사 (예: BlackRock)
   - 직위/역할 (예: Portfolio Manager)
   - 근속 (예: 36개월)
   - 투자활동 관여 자기진술
```

해설(UX 관점): 자기신고는 *법적 증거*가 아니라 *경로 안내*다. 잘못 고르면 엉뚱한 증거 form으로 가서 불필요하게 막히므로, frontend는 각 갈래의 뜻을 쉬운 말로 설명해야 한다(특히 QP $5M과 적격투자자 $1M의 차이를 헷갈리지 않게).

### 11.3 Off-chain Operator Layer (Trusted Issuer 운영)

```
[Trusted Issuer Layer — Off-chain]
1. Frontend → Trusted Issuer로 증거 패키지 전달
2. Trusted Issuer 팀이 실사:
   - 신원확인 (eKYC)
   - 증빙 검토: brokerage statement(Rule 2a51-1(b)(1)) /
     부동산 감정서(투자목적 여부는 (c)로 판단) / trust deed / 고용증명(KE)
   - Rule 2a51-1·2a51-3·3c-5 적합성 판정
   - 지배관계 검증(Rule 2a51-1(b)(1) 제외 적용)
   - reasonable belief 형성 + 문서화(audit trail)
3. Trusted Issuer가 서명 claim을 블록체인에 발급
```

### 11.4 Manual Review Path (REVIEW_QP_UNCERTAIN)

```
1. 온체인 부품이 REVIEW_QP_UNCERTAIN 반환
2. 거래 suspend (거절 아닌 대기)
3. Decipher Trust Operations 큐로 라우팅
4. 수동 검토: 추가 증거 요청 → 경계 법적 판단 → (필요 시) 변호사 escalate
5. 결정 + (통과 시) 새 claim 발급 또는 (탈락 시) 명시적 FAIL code
6. 모든 결정·근거를 Compliance Log에 기록(audit trail)
```

### 11.5 아키텍처 함의

**Trusted Issuer의 *법적 추론 능력*이 시스템 성공의 결정적 변수다.** 단순 KYC 기관이 아니라, Rule 2a51-1·2a51-3·3c-5·판례·No-Action Letter를 해석·적용할 수 있는 기관이어야 한다. 따라서 Trusted Issuer의 선정·onboarding·상시 모니터링이 Decipher 운영 설계의 핵심이다. 쉽게 말하면 — 이 시스템의 품질은 *코드*가 아니라 *증명서를 발급하는 사람들*의 법적 역량에 달려 있다.

---

## §12. Open Issues — 변호사 follow-up 대상

본 부품의 스펙이 완전해지려면 풀어야 할 질문들이다. 각 항목은 *완결된 질문 + 왜 필요한지 + 어떻게 해소할지(권고)*로 적었다.

| # | 질문(무엇을 결정해야 하나) | 왜 필요한가 | Priority | 해소 경로(권고) |
|---|---|---|---|---|
| 1 | **§3(c)(7) Condition 2("no public offering")가 DEX의 secondary trading으로 유발되는가?** — Ralston Purina 4-factor가 상시 호가·익명 매칭 환경에 어떻게 적용되나 | 유발된다면 BUIDL listing 자체가 면제 상실 위험. 부품으로 막을 수 없는 Recipe-level 위험 | 🔴 즉시 | 변호사 follow-up + SEC No-Action Letter 신청 검토(Securitize·INX 선례 인용) |
| 2 | **Knowledgeable Employee(Rule 3c-5)의 적용 경계** — "투자활동에 관여하는 직원"의 실무 boundary, "exclusively QP 판정에서 제외" 메커니즘의 온체인 구현 방식 | KE를 잘못 막으면 정당한 매수 차단, 모르고 통과시키면 사후 misclassification 위험 | 🔴 즉시 | 변호사 follow-up(Rule 3c-5 원문 기준 — *Rule 2a51-3 아님*) |
| 3 | **Issuer / Trusted Issuer / DEX 간 책임 분배** — Rule 2a51-1(h) reasonable belief 안전항이 각 행위자에게 cascade되는 정확한 경계, 인프라 제공자의 면책 가능성 | 위조 claim 사고 시 Decipher의 방어 논거 근거가 됨(§10.4) | 🔴 즉시 | 변호사 follow-up + Securitize·tZERO·INX 보호층 비교 |
| 4 | **Time-of-acquisition의 블록체인 적용 스펙** — 어느 timestamp(matching/confirmed/finalized)가 법적 "취득 시점"인가 | 경계 거래의 통과/차단을 가르는 기준. 임의 결정 시 법적 오작동 | 🟡 높음 | 변호사 + Decipher 자체 정리(Claim Freshness 부품 A-11과 조율) |
| 5 | **Look-through 재귀 최대 깊이** — 가족회사·신탁을 몇 단계까지 들여다봐야 하나, 부분 미충족(partial) 처리 | 깊이 미정 시 cascade 미작동 또는 무한 복잡도. A-09 부품 설계 직결 | 🟡 높음 | 변호사 follow-up(1997 S&C·1999 ABA letter 원문 확인) |
| 6 | **추가 boundary·복합 cascade 테스트 케이스** — §7의 5케이스 외 신탁 결합·기관 재량운용·KE 직위형/관여형 경계 | 스펙 완성(DoD)의 ⑤칸. 개발팀 unit test 직결 | 🟡 높음 | Decipher 자체 작성 + 변호사 검증 |
| 7 | **Cross-Recipe 결합 처리** — R3 탈락 + R2 통과의 결합 결과, R1+R3 동시 활성 시 충돌 해소 규칙 | Multi-Recipe Cumulative Model의 토대(§9.4) | 🟢 중간 | Decipher 자체 정리 |

> 참고: 위 1~3번은 BUIDL listing 전 *반드시* 해소되어야 하는 immediate 항목이다. 특히 1번(공모 유발 여부)이 해소되지 않으면 다른 모든 부품이 완벽해도 BUIDL listing이 법적으로 위태롭다.

---

## §13. 파일명 규칙 (Naming Convention)

```
Decipher Element / Recipe 산출물 명명 규칙:

  Element:  A-XX_부품이름.md     (예: A-13_qualified-purchaser.md)
  Recipe:   R-XX_Recipe이름.md   (예: R3_ICA-3c7-fund.md)

Element 부품 ID 체계(앞글자 = 카테고리):
  A: 신원·자격 (매수인 측)        ← 본 부품(A-13)이 여기
  B: 자산·기술 메타
  C: 거래 경로·시점
  D: 집계·누적
  E: 발행자 측
  F: 기타

본 부품: A-13 = "신원·자격 카테고리의 13번째 부품"
물리적 위치:
  산출물/elements/   (모든 Element walkthrough)
  산출물/recipes/    (모든 Recipe walkthrough)
```

---

## §14. 변경 로그

- **[2026-06-14] v2.1 — citation 검증 정정 + 가독성 재작성.** v2.0(공유 산출물 form)의 14개 섹션 구조를 유지하되, 연방규칙 원문(eCFR·Cornell LII) 대조로 인용 오류 6건을 정정하고 문장 중간 강조기호 noise를 제거해 공유 가독성을 높였다. **정정 내역**: ① Knowledgeable Employee 규칙 Rule 2a51-3 → **Rule 3c-5**(메커니즘도 "QP 간주" → "exclusively-QP 판정에서 제외"로 정정) / ② Rule 2a51-3은 **목적형성 회사 look-through 규칙**으로 재배치 / ③ Reasonable Belief Rule 2a51-1(g) → **(h)**, 가공된 "reasonable care" 인용문구 제거 / ④ 차입금 차감 (d) → **(e)·(f)**, 주거·사업용 부동산 제외 (b)(2) → **(c)** / ⑤ Oxford Univ. Bank holding을 **ICA §47(b) rescission 사적 소권**으로 정확화(§3(c)(7) 직접 판시 아님) / ⑥ SEC Release IC-22597 연도 1996 → **1997**(62 FR 17512). §3(c)(7)(B)도 KE 조항이 아니라 **1996.9.1 이전 §3(c)(1) 펀드 전환 경과조항**으로 정정. 외부 공식 자료 링크만 사용(internal wikilink 0건), 자체완결 유지.
- **[2026-06-13] v2.0 — 공유 산출물 form 전면 작성.** self-contained(internal cross-reference 0건)·규제맥락 우선(§1)·친절한 해설(기술 요소마다 prose 동반)·Internal ID 분리(§2 메타 박스)·Form A 조문 인용 박스·외부 공식 자료 링크. 14개 섹션(§1 규제맥락 → §2 메타 → §3 법적근거 → §4 입력사실 → §5 판정로직 → §6 거절처리 → §7 테스트 → §8 증명서 패턴 → §9 cross-element coordination → §10 3-Layer Solution → §11 frontend/operator → §12 open issues → §13 naming → §14 changelog).
- **[2026-06-13] v1.0 — Element walkthrough 최초 작성.** 33 §2 Spec Sheet 표준 + §3(c)(7) deep dive base. (다수 internal wikilink + 일부 citation 오류 포함 — v2.1에서 정정)





