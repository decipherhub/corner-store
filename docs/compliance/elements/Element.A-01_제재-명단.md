ELE.A-01_sanctions-screening

# A-01 Sanctions Screening (OFAC) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 Sanctions Screening 부품(내부 식별자 A-01)을, 미국 제재법을 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·재무부 OFAC·대통령 행정명령 등 외부 공식 자료만 사용한다.

⚠ **출처·버전 정정 노트.** 본 부품의 미국 제재법 인용은 다음 1차 출처를 기준으로 한다 — IEEPA는 50 U.S.C. §§1701·1702·1705 (uscode.house.gov 현행본), TWEA는 50 U.S.C. §§4301–4341, OFAC 규칙은 17 C.F.R.이 아니라 **31 C.F.R. Chapter V**(Parts 500–599) 및 **31 C.F.R. Part 501**(eCFR 현행본, Title 31), 민사 과태료 상한은 **31 C.F.R. §501** 및 2025-01-15 발효 인플레이션 조정(90 FR 3690), OFAC 50% Rule은 재무부 OFAC 발행 *Revised Guidance*(2014-08-13), 가상자산 가이드는 OFAC *Sanctions Compliance Guidance for the Virtual Currency Industry*(2021-10-15)이다. 읽는 사람이 특히 헷갈리기 쉬운 용어·정정 포인트는 다음과 같다(상세는 부록 C).

- **A-01은 증권법 부품이 아니다.** A-03(적격투자자)·A-13(QP)이 1933년법·1940년법(Title 15·17 C.F.R.) 위에 서 있다면, A-01은 **제재법**(IEEPA·TWEA, Title 50·31 C.F.R. Ch. V) 위에 선다. 법체계·소관 기관(SEC가 아니라 재무부 OFAC)·책임 구조(strict liability)가 모두 다르다.
- **민사 책임은 strict liability다.** IEEPA §1705(b) 민사 과태료는 *고의(scienter)를 요건으로 하지 않는다* — "몰랐다"가 책임을 면하지 못한다. 고의(`willful`)는 §1705(c) 형사 책임의 요건일 뿐이고, 민사에서는 penalty 산정의 한 factor에 불과하다.
- **차단 대상은 "명단에 적힌 사람"만이 아니다.** SDN 직접 등재자 외에, 차단대상이 **합산·직간접 50% 이상** 보유한 법인도 *명단에 없어도* 자동으로 차단대상이다(50% Rule). 이 합산은 *재귀적*이다(중간 법인을 통한 간접 보유 — A-09 look-through와 구조적으로 동형).
- **DEX에서는 지갑 주소도 검사 대상이다.** OFAC은 2018년부터 SDN 등재 항목에 **디지털 자산 지갑 주소**를 식별자로 포함한다. 따라서 A-01은 (i) 당사자의 신원과 (ii) 그 지갑 주소를 둘 다 명단에 대조한다.
- **A-01과 A-02는 다른 축이다.** A-01 = *명단 기반*(특정 사람·법인·지갑이 SDN/차단대상인가). A-02 = *관할 기반*(특정 국가·지역의 투자자인가 — Cuba·Iran·North Korea·Syria·Crimea 등 포괄 제재). 포괄 국가 프로그램에서 겹치는 영역이 있으나 부품은 분리한다(§9).
- **A-01은 한 Recipe의 부품이 아니라 모든 거래의 게이트다.** A-01의 아키텍처상 지위(독립 IEEPA strict-liability 게이트 vs Reg D 레시피 구성요소)는 Open Issue OD-CI-5이며, 본 문서 §10에서 결정적 권고를 제시한다.

**양식 메모.** 이 문서는 A-13/A-03 인수인계 양식(Walkthrough)의 번호·헤더·서술 관습을 따른다. A-13 양식의 일부 섹션 — §8 (α) 증명서 확인형 패턴, §10 (γ) 3-Layer Solution, §11 (δ) Frontend·Off-chain Operator, §13 파일명 규칙 — 은 A-01에 해당 내용이 다르거나 없어 생략하거나 변형했다. 반대로 본 문서는 A-13 양식엔 없는 **§10 아키텍처 노트(OD-CI-5 분류 결정)**를 A-01 고유 절로 추가한다 — A-01의 "전 Recipe 보편 부착" 성격 때문에 분류 결정이 이 부품의 핵심 산출물이기 때문이다. 부록 A~D는 A-13 양식엔 대응 슬롯이 없는 A-01 고유 내용(Authority 표·BUIDL 레퍼런스·표현 가이드·결론 문구)이라 부록으로 보존한다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

A-01은 한 줄로 말하면 다음 질문에 답하는 부품이다.

> 이 거래의 어느 당사자(또는 그 지갑, 또는 그가 50% 이상 보유한 법인)가 OFAC 제재 명단(SDN/차단대상)에 해당하는가?

미국 제재법의 기본 출발점은 **IEEPA**(International Emergency Economic Powers Act, 50 U.S.C. §§1701 이하)다. 대통령이 "미국 밖에 원천을 둔 비상하고 이례적인 위협"에 대해 국가비상사태를 선포하면(§1701), 대통령은 그 위협과 관련된 재산·거래를 *차단(block)·금지(prohibit)*할 권한을 갖는다(§1702). 이 권한을 위임받아 실제로 명단을 만들고 집행하는 기관이 재무부 산하 **OFAC**(Office of Foreign Assets Control)이다. OFAC은 차단 대상을 **SDN List**(Specially Designated Nationals and Blocked Persons List)에 올리고, 미국인(U.S. person) 및 미국 관할에 속하는 재산은 그 대상과 거래하는 것이 *원칙적으로 전면 금지*된다.

증권법(A-03·A-13)과의 결정적 차이가 셋 있다.

1. **법체계가 다르다.** 증권법은 "등록하거나 면제를 찾아라"(Securities Act §5)의 구조다 — 면제 요건을 갖추면 적법하게 팔 수 있다. 제재법은 *면제 요건의 문제가 아니라 금지의 문제*다 — 차단대상과의 거래는 어떤 증권법 면제를 갖추든 무관하게 금지된다. 그래서 A-01은 "Reg D 면제가 성립하는가"라는 질문(R1 Recipe)과 **독립적으로** 작동한다.

2. **책임이 strict liability다.** 증권법 위반은 대체로 고의·과실 등 주관적 요건을 따진다. 그러나 IEEPA 민사 과태료(§1705(b))는 **고의를 요건으로 하지 않는다** — 차단대상인 줄 몰랐어도 거래가 성사되면 위반이 성립한다. 고의(`willful`)는 형사 책임(§1705(c))에서만 요건이 되고, 민사에서는 과태료 *액수*를 정하는 factor일 뿐이다. 이 strict liability가 A-01을 "사전 차단(pre-trade gate)"으로 설계해야 하는 이유다 — 사후에 "몰랐다"로 방어할 수 없으므로 거래 *전에* 막아야 한다.

3. **보편적으로 적용된다.** 증권법 부품은 자산이 증권일 때만 켜진다. 제재법은 *모든 미국 관할 거래*에 적용된다 — 증권이든 아니든, 발행이든 재판매든. 그래서 A-01은 특정 Recipe의 부속이 아니라 **모든 Recipe(R1·R2·R3)에 필수로 부착**되고, 사실상 거래 단위의 전역 게이트다(§10).

A-01이 검사하는 **대상은 거래의 모든 당사자**다 — 매수인만이 아니라 매도인도, 그리고 DEX 맥락에서는 그들의 **지갑 주소**도 함께 본다. 매도인이 차단대상이면 매수인이 깨끗해도 거래는 금지된다. 자전·중개 구조에서는 모든 관여 당사자가 검사 대상이 된다.

---

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고 "본 부품"·"Sanctions Screening 부품" 같은 자연어로 부른다.

| 항목 | 값 | 한 줄 풀이 |
|------|----|----------|
| 부품 이름 | Sanctions Screening | 거래 당사자·지갑이 제재 대상인지 검사하는 차단원 |
| 검사 대상 | OFAC SDN/차단대상 match — IEEPA·OFAC 규정상 blocked person 여부 (직접 등재 + 50% Rule 법인 + 등재 지갑 주소) | "이 사람·법인·지갑과 거래해도 되는가" |
| Internal ID | A-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(A)** — 단 identity-side는 증명서형(B) 하이브리드 | 온체인 지갑 주소는 코드가 직접 대조(결정론), 신원·50% 판단은 off-chain 스크리닝 후 claim 확인 (§3.8·§4 참조) |
| Timing | pre-trade / at time of transaction | 거래 체결 직전 차단. strict liability라 사후 방어 불가 → 반드시 사전 게이트 |
| Stateful 여부 | STATELESS | 거래 시점에 *현행 명단*에 대조한 스냅샷만 판정. 명단 갱신은 데이터 갱신이지 부품 상태 아님 |
| 활성화 Recipe | **(특수) 전 Recipe 보편** — R1·R2·R3 필수, R4 조건부 | 단일 home Recipe가 없음. 아키텍처상 거래 단위 전역 게이트(§10 OD-CI-5) |
| Cascade Element | A-04(Identity / KYC) | 신원-측 스크리닝의 전제 — 지갑을 실세계 신원으로 해소해야 이름 대조 가능 |
| 인접 경계 | A-02(국가·관할 제한) | A-01=명단 축, A-02=관할 축. 포괄 국가 프로그램에서 일부 중첩(§9) |
| 성숙도 | 완료 (claim schema·스크리닝 데이터 소스는 후속 보완 가능) | 데모 필수, 모든 Recipe 공용 |
| 파일·위치 | A-01_제재명단.md · 산출물/elements/ | 산출물 경로 |

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 재무부 OFAC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석·집행)은 OFAC 발행 guidance·FAQ·대통령 행정명령(Executive Order)이 구체적 적용을 정한 것이다. 증권법 부품(A-03)과 달리 A-01의 Layer 2·3은 17 C.F.R.(SEC)이 아니라 **31 C.F.R. Chapter V**(OFAC)와 **대통령 행정명령**으로 구성된다. 본 절은 조문이 작동하는 논리 흐름 순서로 배열돼 있어 §3.1~§3.12 번호를 그대로 유지하며, 각 항목이 어느 Layer인지는 아래 표로 확인하면 된다.

| 종류 | Authority | 내용 | A-01 관련성 | Direct/Supporting | Official URL |
|------|-----------|------|-------------|-------------------|--------------|
| Statute | IEEPA §202, 50 U.S.C. §1701 | 국가비상사태 선포 전제(비상·이례적 위협) | 차단 권한의 발동 근거(배경) | Supporting | uscode.house.gov |
| Statute | IEEPA §203, 50 U.S.C. §1702 | 차단대상 재산·거래 block·prohibit 권한 (§1702(a)(1)(B)) | A-01이 막는 행위의 직접 근거 | **Direct** | uscode.house.gov |
| Statute | IEEPA §206, 50 U.S.C. §1705 | 위반 시 민사(strict liability)·형사 벌칙 | 사전 차단의 당위(결과의 무게) | **Direct** | uscode.house.gov |
| Statute | TWEA, 50 U.S.C. §§4301–4341 (벌칙 §4315) | IEEPA 전신·병렬 권한(Cuba 등 legacy) | 일부 프로그램의 대체 근거(배경) | Supporting | uscode.house.gov |
| OFAC Rule | 31 C.F.R. Chapter V (Parts 500–599) | 프로그램별 금지거래(§xxx.201)·벌칙(§xxx.701) | 차단의 규칙 차원 프레임워크 | **Direct** | ecfr.gov |
| OFAC Rule | SDN List (appendix A to 31 C.F.R. Ch. V) | 차단대상 명단(연방관보 공시·규칙 편입) | A-01이 대조하는 명단 본체 | **Direct** | ecfr.gov / ofac.treasury.gov |
| OFAC Rule | 31 C.F.R. Part 501 (RPPR) | 기록보존·차단/거절 보고·차단해제 절차 | 차단 후 운영·오탐 해제 근거 | Supporting | ecfr.gov |
| OFAC Guidance | Revised 50% Rule Guidance (2014-08-13) + FAQ 398–402 | 차단대상이 합산 50%+ 보유 법인의 자동 차단 | 법인 매수인 look-through 근거 | **Direct** | ofac.treasury.gov |
| OFAC Guidance | VC Compliance Guidance (2021-10-15) + FAQ 559·560·563·646 | SDN 등재 지갑 주소·온체인 스크리닝 | DEX의 지갑-측 검사 근거 | **Direct** | ofac.treasury.gov |
| OFAC Guidance | Economic Sanctions Enforcement Guidelines (31 C.F.R. Part 501, App. A) | strict liability·자발적 자진신고(VSD) 감경 | penalty 산정·자진신고 설계 | Supporting | ecfr.gov / ofac.treasury.gov |
| Executive | E.O. 13224 (2001-09-24) 등 IEEPA 발 행정명령 | 프로그램별 지정(SDGT 등) 권한 선언 | 지정 메커니즘의 예시 | Supporting | govinfo.gov |

### 3.0 법조문 관계 플로우차트 (개발자용)

위 표의 권한들이 A-01 판정에서 어떻게 연결되는지 — 거래의 어느 당사자·지갑이 어느 단계에서 어느 권한에 의해 차단되는지를 흐름으로 정리한 것이다. 각 조항 상세는 §3.1~§3.12.

![A-01 제재 스크리닝 법조문 관계·판정 흐름](img/a01_flow.png)

### 3.0.2 조문 순서·중요성 한눈에 보기

아래는 §3.1~§3.12 소단원의 읽는 순서(법이 작동하는 논리 흐름)와 중요성(A-01이 실제로 그걸로 차단하는가)을 한 장으로 요약한 것이다. 순서는 중요도순이 아니라 논리 흐름순이다 — 권한의 뿌리(§1701)에서 시작해 차단 권한(§1702)·명단(SDN·50%·지갑)·결과(§1705)·운영(Part 501)으로 내려간다.

| 순서 | 조문/근거 | 중요성 | A-01이 그걸로 하는 일 |
|------|----------|--------|----------------------|
| §3.1 | IEEPA §202 (§1701) | 보조 | 안 함 — "왜 차단 권한이 생기나"의 전제 |
| §3.2 | IEEPA §203 (§1702) | **핵심** | 차단대상과의 거래를 *금지*하는 직접 근거 |
| §3.3 | IEEPA §206 (§1705) | **핵심** | 사전 차단의 당위 — strict liability·벌칙 |
| §3.4 | TWEA (§§4301–4341) | 보조 | 안 함 — 일부 legacy 프로그램의 대체 뿌리 |
| §3.5 | 31 C.F.R. Ch. V (§xxx.201) | **핵심** | 프로그램별 금지거래의 규칙 차원 |
| §3.6 | SDN List (App. A) | **핵심** | 신원·지갑을 직접 대조하는 명단 |
| §3.7 | 50% Rule (2014-08-13) | **핵심** | 법인 매수인의 차단 여부를 합산·재귀로 판정 |
| §3.8 | VC Guidance (2021-10-15) | **핵심** | 지갑 주소를 SDN 등재 주소에 대조 |
| §3.9 | 31 C.F.R. Part 501 | 보조 | 차단 후 보고·기록·오탐 해제 |
| §3.10 | Executive Orders | 보조 | 안 함 — 지정이 어떻게 이뤄지는가의 메커니즘 |
| §3.11 | BUIDL Manifest | 노트 | 위를 실제 BUIDL 사례에 적용 |
| §3.12 | ERC-3643 변환 | 총정리 | §3.1~§3.10의 claim·check 매핑을 한 표로 |

### 3.1 IEEPA §202 — 국가비상사태 선포 전제

- **조항:** International Emergency Economic Powers Act §202, 50 U.S.C. §1701
- **핵심 원문:** Any authority granted to the President by section 1702 of this title may be exercised to deal with any unusual and extraordinary threat, which has its source in whole or substantial part outside the United States, to the national security, foreign policy, or economy of the United States, if the President declares a national emergency with respect to such threat.
- **한국어:** §1702의 권한은, 미국의 국가안보·외교·경제에 대한 *비상하고 이례적인 위협으로서 그 원천이 전부 또는 상당 부분 미국 밖에 있는* 것에 대처하기 위해, 대통령이 그 위협에 관해 국가비상사태를 선포한 경우에 한해 행사될 수 있다.
- **쉬운 설명:** 제재의 출발 스위치. OFAC의 차단 권한은 무에서 나오지 않고 *대통령의 비상사태 선포*에 근거한다. 프로그램마다 그 뿌리가 되는 비상사태(와 그것을 구체화한 행정명령·§3.10)가 있다. A-01은 이 전제를 직접 검사하지 않는다 — 이미 선포된 프로그램들이 만들어 둔 명단(SDN)을 대조할 뿐이다.
- **A-01 PASS/FAIL 반영:** 직접 반영 ✕ (배경 — 권한의 발동 근거)
- **ERC-3643 변환:** 없음 (전제 조항)

### 3.2 IEEPA §203 — 차단대상 재산·거래의 block·prohibit 권한

- **조항:** IEEPA §203, 50 U.S.C. §1702 (특히 §1702(a)(1)(B))
- **핵심 원문:** [The President may] investigate, block during the pendency of an investigation, regulate, direct and compel, nullify, void, prevent or prohibit, any acquisition, holding, withholding, use, transfer, withdrawal, transportation, importation or exportation of, or dealing in, or exercising any right, power, or privilege with respect to, or transaction involving, any property in which any foreign country or a national thereof has any interest by any person, or with respect to any property, subject to the jurisdiction of the United States.
- **한국어:** [대통령은] 미국 관할에 속하는 자 또는 재산에 의한, 외국 또는 그 국민이 어떤 형태로든 이해관계를 갖는 재산에 관한 *취득·보유·사용·이전·인출·거래 등 일체*를 조사·(조사 중)차단·규제·무효화·방지·금지할 수 있다. (USA PATRIOT Act 개정으로 "조사 진행 중 차단(block during the pendency of an investigation)" 권한이 추가됨.)
- **쉬운 설명:** A-01이 막는 행위의 직접 근거. 차단대상이 *어떤 형태의 이해관계라도* 갖는 재산은 동결 대상이고, 미국인은 그와의 *거래(transaction involving)*가 금지된다. 핵심 포인트 둘 — ① 금지는 "직접·간접(directly or indirectly)" 모두에 미친다(→ 50% Rule·§3.7의 법적 뿌리), ② 대상은 "재산(property)"이며 OFAC은 이를 광의로 해석해 *디지털 자산도 포함*한다(→ 지갑 주소·§3.8).
- **A-01 PASS/FAIL 반영:** **직접 반영 ○** — 거래 당사자(또는 그 지갑, 또는 그가 50%+ 보유한 법인)가 차단대상이면 이 조항에 따라 거래가 금지되므로 FAIL.
- **ERC-3643 변환:** Recipe·context와 무관하게 모든 transfer에 대해 sanctions gate(A-01)를 *전역 적용*. `transaction.parties = {buyer, seller}`, `transaction.wallets = {buyerWallet, sellerWallet}` 전부 스크리닝.

### 3.3 IEEPA §206 — 위반 시 벌칙 (strict liability)

- **조항:** IEEPA §206, 50 U.S.C. §1705
- **핵심 원문 (a) 위법행위:** It shall be unlawful for a person to violate, attempt to violate, conspire to violate, or cause a violation of any license, order, regulation, or prohibition issued under this chapter.
- **핵심 원문 (b) 민사:** A civil penalty may be imposed on any person who commits an unlawful act described in subsection (a) in an amount not to exceed the greater of— (1) [$250,000, 인플레이션 조정 후 $377,700]; or (2) an amount that is twice the amount of the transaction that is the basis of the violation with respect to which the penalty is imposed.
- **핵심 원문 (c) 형사:** A person who willfully commits, willfully attempts to commit, or willfully conspires to commit, or aids or abets in the commission of, an unlawful act described in subsection (a) shall, upon conviction, be fined not more than $1,000,000, or if a natural person, may be imprisoned for not more than 20 years, or both.
- **한국어:** (a) 본 장의 license·order·규정·금지를 위반·위반시도·공모하거나 *위반을 야기*하는 것은 위법이다. (b) 위 위법행위를 한 자에게는 *$377,700(현행 인플레이션 조정액; 법정 기준 $250,000)과 해당 거래액의 2배 중 큰 금액*을 상한으로 민사 과태료를 부과할 수 있다. (c) *고의로(willfully)* 위반·시도·공모하거나 방조한 자는 유죄 시 $1,000,000 이하의 벌금, 자연인은 20년 이하의 징역에 처한다.
- **쉬운 설명:** A-01을 *사전 차단*으로 설계해야 하는 이유. 결정적 비대칭 둘. ① **민사는 strict liability** — (b)에는 `willfully`가 없다. 차단대상인 줄 *몰랐어도* 거래가 성사되면 위반이 성립하고 과태료가 부과될 수 있다. 고의는 (c) 형사에서만 요건이며, 민사에선 과태료 *액수*를 좌우하는 factor일 뿐이다(자진신고·강한 컴플라이언스는 감경 — §3.9·App. A). ② **거래액당 부과** — 상한이 *거래당* $377,700 또는 2배라 거래가 많으면 합산된다. 따라서 "한 번 통과시킨 위법 거래"의 비용이 매우 크고, 사후에 "몰랐다"로 막을 수 없다 → 거래 *전에* 기계가 차단해야 한다.
- **A-01 PASS/FAIL 반영:** 직접 반영 △ (벌칙 자체는 판정식이 아니나, *이 결과의 무게가 A-01의 fail-closed 설계·보수적 기본값을 정당화*한다 — §5·§6).
- **ERC-3643 변환:** A-01은 `fail-closed`로 구현(검사 결과가 불확실하면 통과가 아니라 *차단/보류*가 기본). penalty 비대칭이 그 근거.

> **strict liability의 설계 함의 (한 칸 요약).** A-03(증권)은 "자격 증명서가 *있으면* 통과" — 적극 요건의 확인. A-01(제재)은 "차단대상이 *아니어야* 통과" — 소극 요건의 배제. 그리고 그 배제는 *고의 불문*이라 한 건의 누락도 위반이 된다. 그래서 A-01은 의심 시 *보류/차단*을 기본으로 하고, 오탐은 사후 해제 절차(§3.9·§6)로 푼다.

### 3.4 TWEA — IEEPA의 전신·병렬 권한

- **조항:** Trading with the Enemy Act, 50 U.S.C. §§4301–4341 (벌칙 §4315)
- **핵심 원문(취지):** TWEA grants the President authority to regulate or prohibit transactions with designated foreign countries or nationals during time of war or declared emergency; it remains the statutory basis for certain legacy programs (notably the Cuban Assets Control Regulations).
- **한국어:** TWEA는 전시 또는 선포된 비상 상황에서 지정된 외국·국민과의 거래를 규제·금지할 대통령 권한을 부여하며, 일부 *legacy 프로그램*(대표적으로 Cuba 자산통제규정)의 법적 근거로 남아 있다. IEEPA(1977)는 TWEA의 평시 적용을 떼어내 만든 후신이며, 현대의 대다수 프로그램은 IEEPA 근거다.
- **쉬운 설명:** A-01에는 직접 호출되지 않는 배경 조항. 대부분의 SDN 차단은 IEEPA 근거이고, TWEA는 Cuba 등 소수 프로그램의 뿌리다. 다만 A-01은 *근거 조문과 무관하게* OFAC이 차단한 자 전체를 명단으로 대조하므로, TWEA 근거든 IEEPA 근거든 검사 결과는 같다(차단대상이면 FAIL).
- **A-01 PASS/FAIL 반영:** 직접 반영 ✕ (배경 — 일부 프로그램의 대체 근거)
- **ERC-3643 변환:** 없음. 단 거절 사유 코드에 근거 프로그램(IEEPA/TWEA)을 메타로 기록할 수 있음(보고·§3.9용).

### 3.5 31 C.F.R. Chapter V — 프로그램별 금지거래·벌칙

- **조항:** 31 C.F.R. Chapter V, Parts 500–599 (각 프로그램의 §xxx.201 *Prohibited transactions*·§xxx.701 *Penalties*)
- **핵심 원문(구조):** Each OFAC program part sets out, at §_.201, the transactions prohibited with respect to blocked persons ("all property and interests in property … are blocked and may not be transferred, paid, exported, withdrawn, or otherwise dealt in"), and at §_.701, the applicable IEEPA/TWEA civil and criminal penalties.
- **한국어:** OFAC의 각 프로그램(Part)은 §xxx.201에서 차단대상에 관한 *금지거래*(모든 재산·재산상 이익을 차단하며 이전·지급·인출·기타 거래 일체 금지)를, §xxx.701에서 적용 벌칙(IEEPA/TWEA)을 규정한다. 회피·우회·공모(evade, avoid, cause a violation, conspiracy)도 동일하게 금지된다.
- **쉬운 설명:** 조문(§1702)이 추상적 권한이라면, 그것을 프로그램별로 구체화한 규칙 차원이 31 C.F.R. Ch. V다. A-01은 특정 Part를 하드코딩하지 않는다 — 차단대상이 *어느 프로그램으로* 차단됐든 결과는 동일(거래 금지)하기 때문이다. 핵심은 §xxx.201이 "직접·간접 일체"를 금지하고 "회피·우회"까지 막는다는 점(→ 단일인 다지갑 우회는 A-04, 50% 우회는 §3.7).
- **A-01 PASS/FAIL 반영:** **직접 반영 ○** — 차단대상과의 거래(직접·간접·회피 포함)는 §xxx.201 위반이므로 FAIL.
- **ERC-3643 변환:** `blockedStatus = SDN_MATCH | FIFTY_PCT_RULE | WALLET_MATCH` 중 하나라도 true → 거래 금지. 프로그램 식별자는 메타(`programTag`)로 보존.

### 3.6 SDN List — A-01이 대조하는 명단 본체

- **조항:** Specially Designated Nationals and Blocked Persons List — appendix A to 31 C.F.R. Chapter V; 연방관보 공시 + 각 프로그램 Part 편입
- **핵심 원문(취지):** OFAC publishes the names (and identifiers, including aliases, dates of birth, passport numbers, and — since 2018 — digital currency addresses) of blocked persons on the SDN List; the broader Consolidated Sanctions List adds non-SDN lists (e.g., the Sectoral Sanctions Identifications List). Both are available on OFAC's website and searchable via Sanctions List Search.
- **한국어:** OFAC은 차단대상의 이름과 식별자(별칭·생년월일·여권번호, 그리고 2018년부터 *디지털 자산 지갑 주소*)를 SDN List에 공시한다. 더 넓은 Consolidated Sanctions List는 비-SDN 명단(예: SSI List)을 더한다. 둘 다 OFAC 웹사이트에 공개되고 Sanctions List Search로 검색된다.
- **쉬운 설명:** A-01이 *대조하는 대상* 그 자체. 검사는 두 갈래 — (i) 당사자의 *신원*(A-04가 지갑→실세계 신원으로 해소한 이름·생년월일·여권 등)을 SDN 등재 식별자에 대조, (ii) 당사자의 *지갑 주소*를 SDN 등재 지갑 주소에 대조(§3.8). 이름 대조는 표기 변형 때문에 *fuzzy match*가 필요하고(오탐 발생 → §6 해제), 지갑 대조는 *exact match*라 결정론적이다.
- **A-01 PASS/FAIL 반영:** **직접 반영 ○** — 신원 또는 지갑이 명단에 match하면 FAIL.
- **ERC-3643 변환:** `identityMatch = screen(resolvedIdentity, SDN_identifiers)` (off-chain, fuzzy), `walletMatch = (walletAddress ∈ SDN_wallet_addresses)` (on-chain, exact). 둘 중 하나라도 true → FAIL.

### 3.7 OFAC 50% Rule — 법인 매수인의 차단 여부 (합산·재귀)

- **조항:** OFAC, *Revised Guidance on Entities Owned by Persons Whose Property and Interests in Property Are Blocked* (2014-08-13); 보충 FAQ 398–402
- **핵심 원문:** Any entity owned in the aggregate, directly or indirectly, 50 percent or more by one or more blocked persons is itself considered to be a blocked person. The property and interests in property of such an entity are blocked regardless of whether the entity itself is listed … on OFAC's list of Specially Designated Nationals. … For the purpose of calculating aggregate ownership, the ownership interests of persons blocked under different OFAC sanctions programs are aggregated.
- **한국어:** 차단대상 1인 이상이 *합산하여, 직접 또는 간접으로 50% 이상* 보유한 법인은 — *그 법인이 SDN List에 없더라도* — 그 자체로 차단대상으로 본다. 합산 시 *서로 다른 프로그램으로 차단된 자들의 지분도 합산*한다. "간접"은 중간 법인(역시 50%+ 보유된)을 통한 보유를 뜻한다. (50% Rule은 *소유*에만 적용되고 *지배(control)*에는 적용되지 않는다 — 50% 미만이라도 지배하는 경우는 자동 차단이 아니되 주의 대상이며, OFAC이 별도 지정할 수 있다.)
- **쉬운 설명:** 법인 매수인을 만났을 때 "어디까지 뚫고 들어가나"의 답. A-09(법인 look-through)와 *구조적으로 동형*이다 — 자연인 차단대상에 도달할 때까지 재귀적으로 지분을 따라 내려가되, 각 단계에서 *합산 50%*가 기준이다.
- 예 1: 차단대상 X가 법인 A의 50%, A가 법인 B의 50% 보유 → A도 B도 차단대상(X가 B를 간접 50% 보유).
- 예 2: 차단대상 X가 25%, 차단대상 Y가 30% 보유(서로 다른 프로그램) → 합산 55% → 그 법인은 차단대상.

이 판단은 지분 데이터·실소유자 정보가 필요해 *off-chain*에서 이뤄지고, 결과가 claim으로 들어온다(A-01은 그 claim과 지갑 직접 대조를 함께 본다).
- **A-01 PASS/FAIL 반영:** **직접 반영 ○** — 법인 매수인이 50% Rule상 차단대상이면 FAIL. 50% 미만 지배(control)만 있는 경우는 자동 FAIL은 아니나 red-flag로 보류 가능(§6).
- **ERC-3643 변환:** `entityOwnership.lookThroughStatus = COMPLETED | PENDING | FAILED`; `aggregateBlockedOwnership ≥ 50% → blocked=true`. look-through 미완(PENDING)이면 fail-closed로 보류. (A-09와 hook 공유.)

### 3.8 OFAC 가상자산 가이드 — 지갑 주소의 스크리닝

- **조항:** OFAC, *Sanctions Compliance Guidance for the Virtual Currency Industry* (2021-10-15); FAQ 559(정의)·560(의무 동일)·563(SDN상 지갑 주소 구조)·646(차단 방법)
- **핵심 원문(취지):** OFAC's sanctions compliance obligations apply equally to transactions involving virtual currency and fiat currency. Since 2018, OFAC has included specific digital currency addresses as identifiers on SDN List entries for blocked persons. Virtual currency industry participants are expected to screen wallet addresses (and IP addresses), to use blockchain analytics, and to consider a historical lookback when OFAC adds a new address.
- **한국어:** OFAC 컴플라이언스 의무는 가상자산 거래에도 *법정화폐와 동일하게* 적용된다. OFAC은 2018년부터 SDN 등재 항목에 *특정 디지털 자산 지갑 주소*를 식별자로 포함한다. 가상자산 업계 참여자는 지갑 주소(및 IP)를 스크리닝하고, 블록체인 분석을 활용하며, 새 주소 등재 시 과거 거래 *소급 점검(historical lookback)*을 고려할 것이 기대된다.
- **쉬운 설명:** DEX 맥락에서 A-01의 *온체인 검사*의 직접 근거. 지갑 주소는 SDN 등재 주소와 *정확히 일치(exact match)*하는지로 보므로 결정론적이고, 이 부분이 A-01을 "기계 판정형(A)"으로 분류하게 하는 핵심이다. 신원-측 이름 대조(§3.6·fuzzy)는 off-chain claim으로 들어오는 반면, 지갑-측 대조는 코드가 직접 한다 — 그래서 A-01은 *하이브리드*다(§2·§4). 가이드는 또한 "등재 주소와 같은 지갑을 공유한 주소"로 연관 주소를 식별하라고 권하나, 그 *연관 분석*은 결정론을 넘는 휴리스틱이므로 A-01의 자동 차단이 아니라 red-flag(감시)로 다룬다(F-02·A-12와 경계).
- **A-01 PASS/FAIL 반영:** **직접 반영 ○** — 거래 지갑 주소가 SDN 등재 주소면 FAIL. 연관 주소(공유 지갑 등)는 자동 FAIL 아님 → flag.
- **ERC-3643 변환:** `walletMatch = (txWallet ∈ SDN_wallet_set)` (on-chain, O(1) set membership); SDN 주소 set은 oracle/주기 갱신으로 온체인 또는 검증 모듈에 공급.

### 3.9 31 C.F.R. Part 501 (RPPR) — 기록·보고·차단해제

- **조항:** Reporting, Procedures and Penalties Regulations, 31 C.F.R. Part 501 — §501.601(기록보존)·§501.603(차단재산 보고)·§501.604(거절거래 보고)·§501.806(오인 해제)·§501.807(delisting)·§501.801/.808(라이선스)·App. A(집행 가이드라인)
- **핵심 원문(취지):** §501.601 requires retention of records relating to blocked/rejected transactions for 5 years; §501.603 requires initial and annual reports of blocked property; §501.604 requires reports of rejected transactions within 10 business days; §501.806 provides a "Compliance Release" for property blocked in error due to mistaken identity or typographical error; §501.807 governs administrative reconsideration (delisting) petitions.
- **한국어:** 차단·거절 거래 관련 기록은 *5년 보존*(§501.601). 차단재산은 *초기 보고 + 연례 보고*(§501.603). 거절 거래는 *10영업일 내 보고*(§501.604; 2019-06-21 개정으로 비-금융기관 포함 모든 미국인에 확대). 오인·오타로 *잘못 차단*한 재산은 §501.806 "Compliance Release"로 해제(차단한 당사자만 신청 가능). 실제 지정자의 명단 제거는 §501.807 *행정재심 청원*으로.
- **쉬운 설명:** A-01이 *차단한 뒤* 운영 차원에서 무엇을 해야 하는지의 근거. 셋을 구분해야 한다. (a) **오탐(mistaken identity)** — 애초에 차단대상이 아니었는데 이름 유사 등으로 잘못 막힌 경우 → §501.806 Compliance Release(빠른 해제). (b) **실제 지정자의 이의** — 진짜 명단에 있으나 지정 자체가 부당하다는 주장 → §501.807 delisting(행정재심, ad hoc). (c) **정당 사유 거래** — 정확히 차단대상이지만 인가받을 사유가 있는 거래 → specific license(§501.801). A-01의 거절 사유 코드는 이 세 해제 경로 중 어디로 보낼지를 운영자에게 알려야 한다(§6).
- **A-01 PASS/FAIL 반영:** 직접 반영 ✕ (사후 운영·해제 — 단 거절 코드 설계와 직결).
- **ERC-3643 변환:** 차단 시 `report = {blockedAt, programTag, txParties, value}` 생성(§501.603/.604 대응); 거절 코드에 해제 경로 힌트(`COMPLIANCE_RELEASE | DELISTING | SPECIFIC_LICENSE`) 부착.

### 3.10 Executive Orders — 지정 메커니즘 (예: E.O. 13224)

- **조항:** IEEPA 발 대통령 행정명령 — 예시: Executive Order 13224 (2001-09-24, 테러리즘 관련 SDGT 지정)
- **핵심 원문(취지):** E.O. 13224, issued under IEEPA following the September 11 attacks, declared a national emergency and authorized the Secretary of the Treasury to designate "Specially Designated Global Terrorists" and to block all property and interests in property subject to U.S. jurisdiction; its prohibitions extend to making or receiving any contribution of funds, goods, or services to or for the benefit of designated persons.
- **한국어:** E.O. 13224는 9·11 이후 IEEPA에 근거해 국가비상사태를 선포하고, 재무장관에게 *SDGT(특별지정 글로벌 테러리스트)* 지정 및 미국 관할 재산의 전면 차단 권한을 부여했다. 금지는 지정자에 대한·지정자를 위한 자금·물품·용역의 제공·수령까지 미친다.
- **쉬운 설명:** "명단에 어떻게 오르나"의 메커니즘 예시. 행정명령이 프로그램(과 비상사태)을 만들고 → OFAC이 그 기준으로 개별 지정을 하고 → SDN List에 오른다. A-01은 이 메커니즘을 검사하지 않는다 — 결과물인 명단을 대조할 뿐이다. 다만 거절 사유의 근거 프로그램을 기록할 때 어떤 E.O./Part가 근거인지 메타로 남기면 보고·해제에 유용하다.
- **A-01 PASS/FAIL 반영:** 직접 반영 ✕ (배경 — 지정의 발생 경로)
- **ERC-3643 변환:** 없음. 근거 E.O./Part는 `programTag` 메타로 보존 가능.

### 3.11 BUIDL Manifest 적용 노트 — 본 부품이 BUIDL에 실제로 어떻게 적용되는가

**전제.** §3.1~§3.10은 A-01의 일반(Recipe·자산-agnostic) 근거다. A-01은 *모든 토큰·모든 거래*에 공용으로 적용되는 전역 게이트이므로 BUIDL 고유 협소화가 거의 없다. 이 절은 그 일반 게이트가 BUIDL Manifest 한 토큰에 적용될 때 무엇이 켜지는지를 정리한다.

**(1) BUIDL 규제 사실관계 (1차 출처 확인).** BUIDL(BlackRock USD Institutional Digital Liquidity Fund)은 Rule 506(c) + ICA §3(c)(7)로 발행되는 BVI 역외 펀드로, 투자자는 whitelist된 적격기관(QP+AI 또는 비-US person)이며 transfer agent·tokenization·placement agent가 Securitize다. **제재 스크리닝은 증권 자격과 무관하게 별도로 적용된다** — 비-US person(역외 투자자)이라도 SDN/차단대상일 수 있으므로 A-01은 그대로 켜진다.

**(2) ⚠ 가장 중요 — A-01은 증권 자격과 독립적으로 켜진다.** A-03(AI)·A-13(QP)이 PASS여도, 당사자나 그 지갑이 차단대상이면 A-01에서 FAIL이고 거래는 금지된다. 역으로 A-01 PASS는 증권 적격을 전혀 의미하지 않는다(서로 다른 법체계). BUIDL이 *역외 펀드라 비-US person이 존재*한다는 사실이 A-01을 *면제하지 않는다* — 오히려 국적·관할(A-02)과 제재 명단(A-01)을 둘 다 통과해야 한다.

**(3) BUIDL에서 A-01이 켜지는 국면.**

| 국면 | 활성 Recipe | A-01 | 비고 |
|------|-------------|------|------|
| 발행(issuance) | R1(506(c)) + R3(§3(c)(7)) | **활성** (buyer·seller·지갑 전부) | 증권 자격(A-03/A-13)과 독립 |
| 재판매(resale) | Rule 144 + R3(§3(c)(7)) | **활성** | 매도인이 affiliate든 아니든, 매수인 자격과 무관하게 양 당사자 스크리닝 |

→ A-03은 재판매 경로(Rule 144 vs §4(a)(7))에 따라 dormant가 될 수 있으나, **A-01은 경로·자격과 무관하게 항상 활성**이다. 이것이 A-01의 "전 Recipe 보편" 성격의 BUIDL상 발현이다.

**(4) BUIDL의 스크리닝 실행.** 실제 BUIDL은 Securitize가 onboarding 단계에서 KYC/AML/제재 스크리닝을 수행한다. 본 프로젝트의 ERC-3643 재구성 가정에서는 Securitize가 Trusted Issuer로서 *sanctions-screening claim*을 발급하고, A-01은 (i) 그 claim의 존재·발급자·만료, (ii) 거래 지갑 주소의 SDN 등재 여부, (iii) 법인 매수인의 50% Rule 상태를 함께 확인한다. claim의 freshness(발급 시점이 *현행* 명단 기준인지)는 A-11과 연동된다 — 명단은 자주 갱신되므로 오래된 claim은 거절될 수 있다.

**(5) A-01 밖 — BUIDL 맥락의 인접 경계.**

| 사안 | 담당 | 비고 |
|------|------|------|
| 국적·관할(비-US person, 포괄 국가 제재) | A-02 | 명단 축이 아니라 관할 축 |
| 지갑→신원 해소(KYC) | A-04 | A-01 신원-측 스크리닝의 전제 |
| claim freshness·만료 | A-11 | 명단 갱신 대비 |
| 적격투자자(AI) | A-03 | 증권 자격, A-01과 독립 |
| qualified purchaser(QP) | A-13 | 펀드 자격, A-01과 독립 |
| 시세조종·자전(연관 지갑 휴리스틱) | F-02·A-12 | A-01의 결정론적 차단 너머 감시 영역 |

### 3.12 ERC-3643 변환 총정리 — 근거별 claim·check 매핑 한 표로

§3.1~§3.10에 흩어진 ERC-3643 변환을 한곳에 모은 것이다. A-01은 *하이브리드*다 — 지갑-측은 코드가 직접 대조(온체인·결정론), 신원·50%-측은 off-chain 스크리닝 결과를 claim으로 확인. (표 안 enum 구분자 `·`는 코드 표기 `|`의 '중 택1'을 뜻한다.)

| 근거 | ERC-3643 변환 | 간략 설명 |
|------|---------------|-----------|
| §3.2 §1702 | 모든 transfer에 sanctions gate 전역 적용; `parties`·`wallets` 전부 스크리닝 | 차단대상 거래 금지의 직접 구현 |
| §3.3 §1705 | `fail-closed` — 불확실 시 차단/보류 기본 | strict liability·penalty 비대칭의 구현 |
| §3.5 Ch. V §xxx.201 | `blockedStatus = SDN_MATCH · FIFTY_PCT_RULE · WALLET_MATCH` 중 하나라도 true → 거래 금지 | 프로그램-agnostic 차단 |
| §3.6 SDN List | `identityMatch`(off-chain fuzzy) · `walletMatch`(on-chain exact) | 신원·지갑 이중 대조 |
| §3.7 50% Rule | `lookThroughStatus = COMPLETED·PENDING·FAILED`; `aggregateBlockedOwnership ≥ 50%` | 법인 재귀 합산(A-09 hook 공유) |
| §3.8 VC Guidance | `walletMatch = (txWallet ∈ SDN_wallet_set)`; oracle 갱신 | 온체인 주소 exact match |
| §3.9 Part 501 | 차단 시 `report` 생성; 거절 코드에 해제 경로 힌트 | 보고·기록·오탐 해제 |

claim 본체(신원-측)는 다음 골격을 갖는다 — `claim.topic = NOT_SANCTIONED`, `claim.screenedAgainst`(명단 버전/일자), `claim.screenedAt`, `claim.expiry`, `claim.issuer`(Trusted Issuer), `claim.signature`, `claim.entityLookThroughStatus`. A-01은 이 claim을 *직접 만들지 않고* 검증만 하며, 지갑-측 exact match를 *추가로* 코드가 직접 수행한다.

## §4. ② 입력 사실 — 무엇을 받아 판정하는가

A-01은 거래 직전 다음 입력으로 판정한다. 핵심은 *양 당사자(buyer·seller) 모두* 와 *그 지갑* 을 본다는 점이다 — 자격 부품(A-03/A-13)이 buyer만 보는 것과 다르다.

| 필드 | 유형 | 의미 |
|------|------|------|
| `buyerWallet` | address | 매수인 지갑 주소 (on-chain SDN 집합 대조) |
| `sellerWallet` | address | 매도인 지갑 주소 (on-chain SDN 집합 대조) |
| `buyerIdentity` | bytes32 | A-04가 해소한 매수인 신원 핸들 |
| `sellerIdentity` | bytes32 | A-04가 해소한 매도인 신원 핸들 |
| `sdnWalletSet` | merkle root | 온체인 SDN 지갑 집합 루트 (oracle 갱신) |
| `claim.topic` | enum | `NOT_SANCTIONED` (신원-측 스크리닝 결과 토픽) |
| `claim.screenedAgainst` | bytes32 | 대조한 명단 버전·일자 (현행성 판단) |
| `claim.screenedAt` | timestamp | 스크리닝 수행 시점 |
| `claim.expiry` | timestamp | claim 만료 시점 (A-11 연동) |
| `claim.issuer` | address | 발급 Trusted Issuer (예: Securitize) |
| `claim.signature` | bytes | Trusted Issuer 서명 |
| `claim.entityLookThroughStatus` | enum | 법인 50% Rule 합산 완료 여부 (`COMPLETED·PENDING·FAILED`) |
| `aggregateBlockedOwnership` | uint (bps) | 법인 당사자의 차단지분 합산 비율 (50% Rule) |
| `programTag` | bytes32 | (차단 시) 근거 프로그램·E.O. 메타 — 보고·해제용 |

지갑-측(`buyerWallet`·`sellerWallet`·`sdnWalletSet`)은 코드가 *직접* 대조한다(온체인·결정론). 신원·법인-측(`claim.*`·`aggregateBlockedOwnership`)은 off-chain 스크리닝 결과를 claim으로 *확인만* 한다. 이 이중 입력 구조가 A-01의 하이브리드 성격이다(§8).

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.1 전체 흐름

A-01은 거래 직전 아래 순서로 확인한다. **양 당사자 중 하나라도 매칭되면 거래 전체가 FAIL**이다 (fail-closed).

1. `buyerWallet` 또는 `sellerWallet`이 SDN 지갑 집합에 있는가? (on-chain exact match)
2. buyer·seller 신원에 `NOT_SANCTIONED` claim이 있는가?
3. claim 발급자가 Trusted Issuer인가?
4. claim 서명이 유효한가?
5. claim이 만료되지 않았는가? (A-11 연동)
6. claim의 `screenedAgainst`가 현행 명단 기준인가? (명단 갱신 대비)
7. 법인 당사자라면 50% Rule look-through가 완료됐고(`COMPLETED`) 합산 차단지분이 50% 미만인가?
8. 이름 유사도가 경계(오탐 가능)에 걸리는가? → 그렇다면 `REVIEW`로 보류

1~7 모두 통과(매칭 없음)하면 PASS. 하나라도 매칭/불확실이면 차단 또는 보류.

### 5.2 Pseudocode

```solidity
function check_A01(
address buyerWallet,
address sellerWallet,
bytes32 buyerIdentity,
bytes32 sellerIdentity,
bytes calldata context
) external view returns (bool passed, bytes32 reasonCode) {

// (1) 온체인 지갑 exact match — 양 당사자 (VC Guidance / FAQ 563·646)
if (SDNWalletSet.contains(buyerWallet) ||
SDNWalletSet.contains(sellerWallet)) {
return (false, FAIL_SDN_WALLET_MATCH); // §1702 차단
}

// (2)~(6) 신원-측 sanctions-screening claim — 양 당사자
for (bytes32 id : [buyerIdentity, sellerIdentity]) {
Claim memory c = ONCHAINID.getClaim(id, Topic.NOT_SANCTIONED);
if (!c.exists) return (false, FAIL_NO_SANCTIONS_CLAIM);
if (!TrustedIssuerRegistry.contains(c.issuer))
return (false, FAIL_UNTRUSTED_SANCTIONS_ISSUER);
if (!verifySignature(c)) return (false, FAIL_INVALID_SANCTIONS_SIGNATURE);
if (block.timestamp > c.expiry) return (false, FAIL_SANCTIONS_CLAIM_EXPIRED);
if (c.screenedAgainst != currentListVersion())
return (false, FAIL_SANCTIONS_CLAIM_STALE_LIST);

// (3) 신원 fuzzy match 경계 — 오탐 가능 → 보류(차단 아님)
if (c.identityMatchScore >= REVIEW_THRESHOLD &&
c.identityMatchScore < BLOCK_THRESHOLD)
return (false, REVIEW_SANCTIONS_UNCERTAIN);
if (c.identityMatchScore >= BLOCK_THRESHOLD)
return (false, FAIL_SDN_IDENTITY_MATCH);

// (7) 법인 당사자 — 50% Rule look-through (A-09 hook 공유)
if (c.isEntity) {
if (c.entityLookThroughStatus != COMPLETED)
return (false, FAIL_50PCT_LOOKTHROUGH_PENDING);
if (c.aggregateBlockedOwnership >= 5000) // 50.00% in bps
return (false, FAIL_50PCT_RULE);
}
}

return (true, PASS);
}
```

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

차단 사유 코드는 *운영 처리* 와 *해제 경로 힌트* 를 함께 지정해야 한다. §3.9에서 본 세 해제 경로 — Compliance Release(§501.806, 오탐) / delisting(§501.807, 실제 지정자 이의) / specific license(§501.801, 정당 사유) — 중 어디로 보낼지를 운영자에게 알린다.

| Code | 언제 발생하나 | 처리 · 해제 경로 힌트 |
|------|---------------|------------------------|
| `FAIL_SDN_WALLET_MATCH` | 지갑이 SDN 집합에 등재 | 차단 + §501.603 보고 / 오탐이면 `COMPLIANCE_RELEASE` |
| `FAIL_SDN_IDENTITY_MATCH` | 신원이 SDN과 고신뢰 매칭 | 차단 + 보고 / 실제 지정자는 `DELISTING`, 오탐은 `COMPLIANCE_RELEASE` |
| `FAIL_50PCT_RULE` | 차단지분 합산 ≥ 50% | 차단 + 보고 / `COMPLIANCE_RELEASE`(합산 오류 시) |
| `FAIL_NO_SANCTIONS_CLAIM` | 스크리닝 claim 없음 | onboarding / 재스크리닝 안내 |
| `FAIL_UNTRUSTED_SANCTIONS_ISSUER` | 발급기관 미등록 | 운영자 확인 |
| `FAIL_INVALID_SANCTIONS_SIGNATURE` | claim 서명 검증 실패 | 위조 가능성, 차단 |
| `FAIL_SANCTIONS_CLAIM_EXPIRED` | claim 만료 | 재스크리닝 요청 (A-11) |
| `FAIL_SANCTIONS_CLAIM_STALE_LIST` | 구버전 명단 기준 claim | 재스크리닝 (명단 갱신 반영) |
| `FAIL_50PCT_LOOKTHROUGH_PENDING` | 법인 합산 미완료 | pending 처리 (A-09 대기) |
| `REVIEW_SANCTIONS_UNCERTAIN` | 이름 유사도 경계(오탐 가능) | 거래 보류 + manual review (Compliance) |

오탐(mistaken identity)으로 차단된 정상 당사자는 §501.806 Compliance Release로 빠르게 해제하되, **해제는 차단한 당사자만 신청 가능**하다(§3.9). 따라서 거절 코드에 `programTag`와 차단 근거를 함께 기록해야 사후 해제·보고가 가능하다.

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

아래 케이스가 모두 기대대로 동작해야 스펙이 완성이다. 지갑 매칭, 신원 fuzzy 매칭, 50% Rule 합산(프로그램 교차·간접), claim 현행성, 그리고 **제재가 증권 자격과 독립**임을 함께 검증한다.

| 테스트 | 결과 |
|--------|------|
| 매수인 지갑이 SDN 집합에 등재 | `FAIL_SDN_WALLET_MATCH` |
| 매도인 지갑이 SDN 집합에 등재 (매수인 clean) | `FAIL_SDN_WALLET_MATCH` (양 당사자 검사) |
| 매수인 신원이 SDN 이름과 고신뢰 매칭 | `FAIL_SDN_IDENTITY_MATCH` |
| 매수인 신원이 SDN 이름과 부분 유사(경계) | `REVIEW_SANCTIONS_UNCERTAIN` |
| 법인 매수인, 단일 차단대상 60% 보유 | `FAIL_50PCT_RULE` |
| 법인 매수인, 서로 다른 프로그램 차단자 각 30% (합산 60%) | `FAIL_50PCT_RULE` (프로그램 교차 합산) |
| 법인 매수인, 차단대상 40% 보유 | PASS (50% 미만) |
| 법인 매수인, 간접 보유(차단자→중간법인 100%→대상 51%) | `FAIL_50PCT_RULE` (간접 합산) |
| 스크리닝 claim 없음 | `FAIL_NO_SANCTIONS_CLAIM` |
| 스크리닝 claim 만료 | `FAIL_SANCTIONS_CLAIM_EXPIRED` |
| claim의 `screenedAgainst`가 구버전 명단 | `FAIL_SANCTIONS_CLAIM_STALE_LIST` |
| 법인 매수인 look-through 미완료 | `FAIL_50PCT_LOOKTHROUGH_PENDING` |
| BUIDL 비-US person 매수인, QP(A-13) PASS이나 지갑 SDN 매칭 | `FAIL_SDN_WALLET_MATCH` (제재는 증권 자격과 독립) |
| A-03(AI)·A-13(QP) 모두 PASS이나 신원 SDN 매칭 | `FAIL_SDN_IDENTITY_MATCH` (독립 게이트) |
| 오탐으로 차단된 정상 당사자 → 해제 신청 | `FAIL_*` 후 §501.806 Compliance Release 경로 |
| 양 당사자·지갑·법인구조 모두 clean | PASS |

## §8. (α) 검증 패턴 — A-01은 하이브리드다

A-13 양식의 §8 (α) 증명서 패턴 슬롯에 해당한다. A-01은 *단일 패턴이 아니라 두 패턴의 결합* 이라는 점이 특징이다.

- **지갑-측 = Pattern A (결정론적 기계 판정).** `buyerWallet`·`sellerWallet`을 온체인 SDN 지갑 집합과 *직접 exact match* 한다. off-chain 증명서를 거치지 않고 코드가 즉시 판정한다(VC Guidance·FAQ 563/646). OFAC이 2018년부터 디지털 지갑 주소를 SDN 식별자로 포함했기에 가능하다.
- **신원·50%-측 = Pattern B (증명서).** 자연인 이름 대조와 법인 50% Rule 합산은 온체인에서 직접 수행할 수 없다(원자료가 off-chain). Trusted Issuer가 OFAC 명단·법인 소유구조를 off-chain에서 스크리닝하고 *signed claim* 을 발급하면, A-01은 그 claim의 존재·발급자·서명·만료·현행성만 확인한다.

이 이중성의 함의: 지갑 집합은 oracle로 *온체인 동기화* 해야 하고(갱신 지연 = stale risk), 신원 claim은 *freshness 관리*(A-11)가 필요하다 — 명단이 자주 갱신되므로 오래된 claim은 거절될 수 있다. 단순 Pattern A 부품(예: 순수 산술 판정)이나 단순 Pattern B 부품(예: A-03 자격 claim)과 달리, A-01은 두 신뢰 모델을 동시에 운용한다.

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

A-01은 전역 게이트이지만(§10), 그 안에서도 다른 부품에 의존하고 다른 부품과 경계를 나눈다. 아래는 직접 책임지는 것과 넘기는 것의 정리다.

**A-01이 직접 책임지는 것**

- 매수인·매도인 지갑이 SDN 지갑 집합에 있는지 (on-chain exact match)
- 매수인·매도인 신원에 `NOT_SANCTIONED` claim이 있는지
- claim이 신뢰기관 발급·서명 유효·미만료인지
- claim이 *현행* 명단 기준인지 (명단 갱신 대비)
- 법인 당사자의 50% Rule look-through 완료·합산 미만 50%인지
- 차단 시 거절 코드에 보고(§501.603/.604)·해제 경로 힌트 부착

**A-01 밖의 문제**

- 국적·관할 (비-US person, 포괄 국가 제재) → **A-02** (명단 축이 아니라 *관할 축*)
- 지갑 → 신원 해소 (KYC) → **A-04** (A-01 신원-측 스크리닝의 전제)
- claim freshness·만료 정책 → **A-11** (명단은 증권 credential보다 자주 갱신)
- 법인 재귀 look-through 엔진 → **A-09** (50% Rule이 A-09 재귀 hook 공유 — 단 명단이 다름)
- 적격투자자 (AI) → **A-03** (증권 자격, A-01과 독립)
- qualified purchaser (QP) → **A-13** (펀드 자격, A-01과 독립)
- 시세조종·자전 (연관 지갑 휴리스틱) → **F-02·A-12** (A-01의 결정론적 차단 *너머* 감시 영역)
- 이 토큰이 securities인지, Form D·bad actor 등 → 증권 Element들 (별개 법체계)

**두 경계가 특히 중요하다.**

- **A-01 ↔ A-02 (명단 축 vs 관할 축).** A-01은 *특정인이 명단에 있는가* 를 본다. A-02는 *거래 상대가 포괄 제재 관할(예: 특정 국가)에 속하는가* 를 본다. 비-US person이 A-02에서 걸리지 않아도 A-01에서 SDN일 수 있고, 그 역도 성립한다. 둘은 보완적이며 **둘 다 통과해야 한다**.
- **A-01 ↔ A-09 (재귀 메커니즘 공유, 명단은 별개).** 50% Rule 합산은 A-09의 재귀 look-through 엔진을 *공유* 한다. 그러나 A-09(증권)는 equity owner의 *적격성* 을 재귀 평가하고, A-01은 owner의 *차단 여부* 를 재귀 합산한다 — 같은 엔진, 다른 명단·다른 판정. 구현 시 엔진은 재사용하되 판정 대상(적격 vs 차단)을 분리한다.

## §10. ⭐ 아키텍처 노트 — OD-CI-5: A-01의 분류 결정

> **결정: A-01은 독립적 거래-수준 strict-liability 게이트다. Reg D recipe의 구성요소가 아니다.**

### 쟁점 (OD-CI-5)

A-01을 (a) Reg D 발행 recipe(R1)의 한 Element로 부착할 것인가, 아니면 (b) 모든 recipe 위에서 독립적으로 작동하는 *전역 게이트* 로 둘 것인가. 본 문서는 **(b)** 를 권고한다.

### 근거

**① 법체계가 다르다.** 제재법은 IEEPA(Title 50, 50 U.S.C. §§1701–1708)와 OFAC 규정(Title 31 CFR Chapter V)이다. 증권법(Title 15, 17 C.F.R.)과 *완전히 다른 축* 이다. A-01을 Reg D recipe에 편입하면 두 법체계를 혼동하는 범주 오류가 된다. Reg D 면제가 충족돼도 제재 의무는 독립적으로 살아 있고, Reg D를 *쓰지 않는* 거래에서도 제재 게이트는 그대로 적용된다.

**② Strict liability + 보편 적용.** §1705(b) 민사책임은 *고의 불요*(strict liability)다. 그리고 미국 관할의 *모든* 거래에 증권 프레임워크와 무관하게 적용된다. 발행(R1·506(c))뿐 아니라 재판매(R2·Rule 144), 역외(Reg S), 심지어 recipe를 거치지 않는 직접 transfer에서도 제재 게이트는 켜져야 한다. 따라서 특정 recipe에 종속시키는 설계는 *법적으로 부정확* 하다.

**③ 결과 비대칭.** 단일 증권 요건 미충족은 해당 거래·토큰 차원의 문제다. 그러나 제재 위반은 운영자·프로토콜 *전체* 의 형사·민사 책임으로 번진다 — §1705 민사 최대 $377,700 또는 거래가치의 2배 중 큰 금액(2025년 기준), 형사 최대 $1M·20년. 이 systemic risk가 fail-closed 설계를 강제하며, 게이트의 위상도 그에 맞춰 *최상위* 여야 한다.

**④ 아키텍처 청결성.** A-01을 Operator/Router가 recipe 해소 *이전에* 실행하는 전역 게이트로 두면, 모든 거래가 recipe와 무관하게 동일한 제재 차단을 통과한다. recipe마다 중복 부착하는 것보다 *단일 강제 지점* 이 깔끔하고, recipe 정의 누락이 곧 제재 게이트 누락으로 이어지는 치명적 취약점을 원천 차단한다.

### 구현 함의

- **Manifest.** A-01을 recipe별 Element 목록에 넣지 않는다. 전역 pre-flight gate로 선언한다 — 예: `manifest.globalGates = [A-01, A-02]`.
- **Operator/Router.** 거래 인입 → 전역 게이트(A-01·A-02) 평가 → 통과 시에만 recipe 해소(R1/R2/R3…) 진입. 게이트 실패 시 recipe는 평가되지 않는다.
- **Recipe 표 표기.** R1●·R2●·R3● 표에는 A-01을 *부착(attach)* 이 아니라 *전제(precondition)* 로 명시한다 — "모든 recipe에 A-01이 항상 선행 적용됨".

### 대안과 그 단점 ((b)를 택하지 않았다면)

A-01을 각 recipe에 ● 필수로 *중복 부착* 하는 방식. 단점: (i) recipe 정의에서 누락되면 제재 게이트가 통째로 빠지는 치명적 취약점; (ii) recipe를 거치지 않는 거래 경로(직접 transfer 등)가 미보호; (iii) 동일 로직이 여러 recipe에 흩어져 갱신(명단·임계)이 비일관해질 위험. → 이 셋이 **(b) 독립 게이트** 분류를 결정적으로 지지한다.

## §12. Open Issues — 변호사·엔지니어 follow-up 대상

본 부품의 스펙이 완전해지려면 풀어야 할 질문들이다.

| # | 질문 (무엇을 결정해야 하나) | 왜 필요한가 | Priority | 해소 경로 (권고) |
|---|------------------------------|--------------|----------|------------------|
| 1 | SDN 지갑 집합의 온체인 동기화 모델 — oracle 신뢰·갱신 주기·정족수 | 지갑 exact match의 정확성·적시성 직결. stale 집합 = 누락 차단 위험 | 즉시 | Decipher + oracle 설계 (§8) |
| 2 | 이름 fuzzy match 임계·오탐 정책 — `REVIEW`/`BLOCK` 경계, false positive 처리 SLA | 과소 차단(법적 위험)과 과다 차단(UX·정당거래 방해)의 균형 | 즉시 | 변호사 + Compliance 정책 (§5·§6) |
| 3 | 50% Rule look-through 재귀 깊이 — A-09 엔진 공유 시 몇 단계, partial·프로그램 교차 합산 | 미정 시 미작동/무한 복잡도. 간접·합산 케이스 처리 직결 | 높음 | 변호사 + A-09 (§3.7·§9) |
| 4 | sanctions claim freshness 윈도 — 명단 갱신 주기 대비 만료 기간 | 명단은 증권 credential보다 *자주* 갱신 → 짧은 윈도 필요. A-11 조율 | 높음 | Decipher + A-11 (§3.12·§8) |
| 5 | on-chain vs off-chain SDN 데이터 분할 — 지갑은 온체인, 이름·법인구조는 off-chain | 하이브리드 경계의 운영 정의. oracle 지연·claim 신뢰 모델 | 높음 | Decipher + Trusted Issuer (§8) |
| 6 | 차단 거래의 온체인 처리 방식 — revert vs hold-and-report | §501.603/.604 보고 자동화와 직결. 블록 후 보고 vs 즉시 revert | 중간 | Decipher + 변호사 (§3.9·§6) |

---

— 이하 부록 A~D는 A-01 고유 내용으로, A-13 양식엔 대응 슬롯이 없어 보존한다. —

## 부록 A. Authority Verification Table — Official URLs Only

| Issue | Correct Authority | Direct/Supporting | A-01 반영 | Official URL |
|-------|-------------------|-------------------|-----------|--------------|
| 국가비상사태 선포 권한 | IEEPA §202, 50 U.S.C. §1701 | Supporting | 차단 권한의 전제 | uscode.house.gov |
| 차단·거래금지 권한 | IEEPA §203, 50 U.S.C. §1702 | Direct | 거래 차단의 직접 근거 | uscode.house.gov |
| 민사 strict liability·형사 벌칙 | IEEPA §206, 50 U.S.C. §1705 | Direct | fail-closed 설계 근거 | uscode.house.gov |
| TWEA (legacy·Cuba) | 50 U.S.C. §§4301–4341 (벌칙 §4315) | Supporting | IEEPA 전신, 일부 프로그램 | uscode.house.gov |
| OFAC 프로그램 금지·벌칙 | 31 C.F.R. Ch. V Parts 500–599 (§xxx.201, §xxx.701) | Direct | 프로그램-agnostic 차단 | ecfr.gov |
| SDN List | Appendix A to 31 C.F.R. Ch. V | Direct | identity·wallet 대조 | ecfr.gov (목록 본체: treasury.gov/sdn) |
| 50% Rule | OFAC Revised Guidance (2014-08-13); FAQ 398–402 | Direct | aggregateBlockedOwnership | ofac.treasury.gov |
| 가상자산 가이드 | OFAC Sanctions Compliance Guidance for the Virtual Currency Industry (2021-10-15); FAQ 559/560/563/646 | Direct | walletMatch on-chain exact | ofac.treasury.gov |
| 기록·보고·차단해제 | 31 C.F.R. Part 501 (§501.601/.603/.604/.806/.807/.801) | Direct/Supporting | report 생성·해제 경로 | ecfr.gov |
| Enforcement Guidelines | 31 C.F.R. Part 501 App. A (2008-09-08) | Supporting | strict-liability·VSD 완화 | ecfr.gov |
| 지정 메커니즘 (예) | E.O. 13224 (2001-09-24) | Supporting | programTag 메타 | govinfo.gov |
| 민사 벌칙 금액 갱신 | 90 FR 3690 (2025-01-15); 31 C.F.R. §501 | Supporting | $377,700 (2025) | govinfo.gov / ecfr.gov |

## 부록 B. BUIDL 레퍼런스 케이스 — 제재 측면·A-01 실행사항

본 프로젝트가 A-01을 설계·검증할 때 기준으로 삼는 실제 토큰은 BlackRock BUIDL이다. A-01은 *모든 거래에 공용* 인 전역 게이트라 BUIDL 고유 협소화가 거의 없으므로(§3.11), 이 절은 제재 측면과 실행 체크리스트만 간결히 정리한다.

**B.1 BUIDL 개요·제재 측면.** BUIDL(BlackRock USD Institutional Digital Liquidity Fund)은 Rule 506(c) + ICA §3(c)(7)로 발행되는 BVI 역외 펀드이며, transfer agent·tokenization·placement agent가 Securitize다. 실제 BUIDL은 Securitize가 onboarding 단계에서 KYC/AML/제재 스크리닝을 수행한다. **핵심: 제재는 증권 자격과 독립적으로 적용된다** — 비-US person(역외 투자자)이라도 SDN/차단대상일 수 있으므로 A-01은 그대로 켜진다.

**B.2 A-01의 BUIDL 실행 체크리스트.**

- **A. claim 스키마** — `sanctions-screening claim`(topic=`NOT_SANCTIONED`, `screenedAgainst`, `screenedAt`, `expiry`, issuer=Securitize, `entityLookThroughStatus`)을 정의한다.
- **B. 전역 게이트** — A-01은 BUIDL recipe(R1/R3)에 *부착하지 않고* 전역 pre-flight gate로 둔다(§10). 발행·재판매·Reg S 모든 경로에서 켜진다.
- **C. 지갑 대조** — SDN 지갑 집합을 oracle로 온체인 동기화하고, 매수인·매도인 *양 당사자* 지갑을 대조한다.
- **D. 50% Rule** — 법인·펀드 매수인의 차단지분 합산 look-through를 확인한다(A-09 엔진 공유).
- **E. 비-US person 주의** — 역외 투자자라도 SDN일 수 있다. A-02(관할)와 A-01(명단)은 별개 축이며, A-01은 면제되지 않는다.
- **F. freshness** — A-11과 연동해 명단 갱신 대비 claim 만료를 강제한다(명단은 증권 credential보다 자주 갱신).

## 부록 C. 안전한 표현 / 위험한 표현 (데모 가이드)

**써도 되는 표현**

- A-01은 거래 양 당사자와 그 지갑을 OFAC SDN/차단 명단에 대조하는 pre-trade 전역 게이트입니다.
- 제재 스크리닝은 증권 자격(AI·QP)과 독립적으로 적용됩니다 — 비-US person이라도 차단대상일 수 있습니다.
- IEEPA §1705 민사책임은 strict liability(고의 불요)이므로 시스템은 fail-closed로 설계됩니다.
- 50% Rule상 차단대상이 합산 50% 이상 소유한 법인은 명단 등재 없이도 차단대상입니다.
- OFAC은 2018년부터 디지털 지갑 주소를 SDN 식별자로 포함하므로 지갑 주소 대조가 가능합니다.
- A-01은 모든 recipe 위에서 작동하는 독립 전역 게이트입니다(OD-CI-5 결정).

**피해야 할 표현**

- A-01을 통과하면 증권 거래도 적법하다. → A-01은 제재만 봅니다. 증권 자격은 A-03(AI)·A-13(QP)이며, *별개 법체계* 입니다.
- 비-US person·역외 투자자는 제재 스크리닝이 면제된다. → 아닙니다. 국적·관할(A-02)과 명단(A-01)은 별개 축이며 비-US person도 SDN일 수 있습니다.
- SDN 명단에 없으면 차단대상이 아니다. → 50% Rule상 명단 미등재 법인도 차단대상일 수 있습니다.
- 제재 위반은 해당 거래만 무효화한다. → strict liability이며 운영자·프로토콜 전체의 형사·민사 책임으로 확대됩니다.
- A-01은 Reg D recipe의 일부다. → 아닙니다. A-01은 모든 recipe 위의 독립 전역 게이트입니다(§10).
- 고의가 없으면 제재 위반 책임이 없다. → 민사책임은 strict liability입니다. 고의는 형사책임·벌칙 산정의 factor일 뿐입니다.
- 이름이 비슷하면 무조건 차단한다. → fuzzy match는 오탐을 낳으므로 경계 사례는 REVIEW로 보내고, 오탐 차단은 §501.806 Compliance Release로 해제합니다.

## 부록 D. 팀 문서 결론 문구

A-01 Sanctions Screening Element는 모든 토큰·모든 거래에 공통으로 적용되는 거래-수준 strict-liability pre-trade 전역 게이트로, 거래 양 당사자(buyer·seller)의 신원과 지갑 주소를 OFAC SDN/차단 명단에 대조하고, 법인 당사자의 경우 50% Rule에 따른 차단지분 합산 look-through를 확인한다. 그 법적 근거는 증권법(Title 15·17 C.F.R.)이 아니라 IEEPA(50 U.S.C. §§1701–1708)와 OFAC 규정(31 C.F.R. Chapter V)이라는 별개의 법체계이며, §1705(b) 민사책임이 strict liability라는 점이 시스템을 fail-closed로 설계하게 한다. A-01은 하이브리드 검증이다 — 지갑 주소는 on-chain에서 SDN 지갑 집합과 직접 exact match(Pattern A, 결정론)하고, 신원·법인구조는 off-chain 스크리닝 결과를 Trusted Issuer 발급 signed claim으로 확인(Pattern B, 증명서)한다. 본 문서는 OD-CI-5 쟁점에 대해 A-01을 Reg D recipe의 구성요소가 아니라 모든 recipe 위에서 독립적으로 작동하는 전역 게이트로 분류할 것을 권고한다(§10): 법체계가 다르고, strict liability·보편 적용·결과 비대칭·아키텍처 청결성이 모두 독립 게이트 분류를 지지하기 때문이다. 따라서 Manifest는 A-01을 recipe별 Element 목록이 아니라 전역 pre-flight gate로 선언하고, Operator/Router가 recipe 해소 이전에 이를 평가하여 어떤 거래 경로(발행·재판매·Reg S·직접 transfer)도 제재 차단을 우회하지 못하게 한다. A-01의 직접 PASS/FAIL 로직은 지갑 SDN 매칭 여부, sanctions-screening claim의 존재·발급자 신뢰성·서명 유효성·만료·현행 명단 기준 여부, 그리고 법인 당사자의 50% Rule look-through 완료·합산 미만 50% 여부에 한정된다.

문서 끝.

Tab Context:
- Executed on tabId: 437007805
- Available tabs:
  • tabId 437007716: "(1) 7/8 | Notion" (https://app.notion.com/p/deciphersnu/7-8-398dff004c898098b1defb8a486ffa72)
  • tabId 437007775: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_보유기간.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_보유기간.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md)
  • tabId 437007778: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_국가거주제한.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_국가거주제한.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md)
  • tabId 437007781: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_법리검증기준서_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_법리검증기준서_v1+%281%29.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1+%281%29.md)
  • tabId 437007782: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_모름항변차단.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_모름항변차단.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md)
  • tabId 437007783: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD확인.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD확인.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md)
  • tabId 437007784: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md)
  • tabId 437007785: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md)
  • tabId 437007786: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md)
  • tabId 437007787: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md)
  • tabId 437007788: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5353e81e-96a2-4d4b-a965-fb4cafccc156/F-04_no-purchase-during-distribution.md?table=block&id=3a4dff00-4c89-80f8-af9f-cc7028cb641d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=J2D6J2JjovGrC18Rlg9blfXeyYYrthiwuJqBAzGUkBM&downloadName=F-04_no-purchase-during-distribution.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5353e81e-96a2-4d4b-a965-fb4cafccc156/F-04_no-purchase-during-distribution.md?table=block&id=3a4dff00-4c89-80f8-af9f-cc7028cb641d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=J2D6J2JjovGrC18Rlg9blfXeyYYrthiwuJqBAzGUkBM&downloadName=F-04_no-purchase-during-distribution.md)
  • tabId 437007805: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/e4da1e06-ce0c-45d7-9087-131a431bbeba/Element.A-01_제재-명단.md?table=block&id=39edff00-4c89-8081-9994-f506335340c3&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=4R08Y0YcsA3j1cf-uBl8dd2zyPvm2B-fBJyfwrl-pFM&downloadName=Element.A-01_제재-명단.md" (
