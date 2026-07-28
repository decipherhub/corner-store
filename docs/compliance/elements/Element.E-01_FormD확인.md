# E-01 Form D 확인 (Notice of Exempt Offering) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 Form D 확인 부품(내부 식별자 E-01)을, 미국 증권법을 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — (1) 이 규제가 어디서 왔고 왜 존재하는지, (2) 어떤 사실을 입력받아 (3) 어떤 로직으로 판정하고 (4) 실패하면 어떻게 처리하며 (5) 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서 등 외부 공식 자료만 사용한다.

**⚠ 출처·정정 노트 (읽기 전 필독).** 본 부품의 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §77d(제5조 적용제외 거래, uscode.house.gov, 2026-06-05 현재), 15 U.S.C. §77r(제18조 주법 선점, uscode.house.gov, 2026-05-27 현재), 17 C.F.R. §230.500·§230.503·§230.506·§230.507·§230.508(Regulation D, eCFR 현행본; Title 17 최종개정 2026-06-25, 조회 2026-07-15), 17 C.F.R. §239.500(Form D), Form D 서식 원본(SEC1972 (5/17), OMB 3235-0076), SEC Release No. 33-11347(*In the Matter of Pipe Technologies Inc.*, 2024-12-20, Commission order), SEC Division of Corporation Finance, *Frequently Asked Questions and Answers on Form D*(2026-01-22 게시, 2026-03-17 최종 갱신). 특히 헷갈리기 쉬운 정정 포인트는 다음과 같다(상세는 부록 C).

- **Form D 제출은 Rule 506(c) 면제의 조건이 아니다(가장 중요).** Rule 506(c)(1)의 일반조건은 “§§ 230.501 and 230.502(a) and (d)”만 열거하고 **§ 230.503(Form D 제출)을 열거하지 않는다**. 조문 구조 자체가 답이다. SEC도 같은 입장을 명시한다 — Form D FAQ 답변 5, 그리고 Commission order(Release 33-11347 ¶6)의 “While a failure to provide such notice does not result in a loss of the exemption from Section 5”. **따라서 E-01이 FAIL을 내도 §5 면제가 깨지는 것이 아니다.**

- **그러나 “면제 유지”와 “위법 아님”은 전혀 다른 말이다.** 같은 문장의 후단이 결정적이다 — “the failure to comply with the requirements of Rule 503 itself is a violation of the Securities Act and rules promulgated thereunder.” 2024-12-20 SEC는 Form D 미제출**만**을 이유로 3개 발행자에게 §8A cease-and-desist와 $60,000~$195,000의 민사제재금을 부과했다. 면제는 살아 있고 발행자는 처벌받는다 — 이 두 명제가 동시에 참이다.

- **Rule 507은 자동 실격 조항이 아니다.** Rule 507(a)는 “Rule 503을 위반하면 면제 박탈”이 아니라 “Rule 503 위반을 이유로 **법원의 유지명령(injunction)을 받은 적이 있으면**” 이후 504·506 면제가 불가하다고 정한다. 즉 미제출 → 위반 → (법원 명령) → 실격의 **3단 구조**이며, 507(b)의 good cause 예외까지 있다. “Form D 안 내면 Rule 507로 면제가 날아간다”는 흔한 압축은 조문을 한 단계 건너뛴 오독이다.

- **부등호.** Rule 503(a)(1)은 “no later than 15 calendar days after the first sale”이다. 경과일수 ≤ 15면 적법, **> 15면 지각**이다(15일째 당일 제출은 적법). 마감일이 토·일·공휴일이면 “the due date would be the first business day following”으로 **연장**된다 — 즉 15일 경과가 곧바로 위반이 아니다. 연차 수정은 “on or before the first anniversary”(1주년 당일 포함, ≤ 1주년)다.

- **“최초 매도일”은 결제일도 토큰 발행일도 아니다.** SEC FAQ 답변 1: “the date of first sale is the date on which the first investor is irrevocably contractually committed to invest.” 온체인 mint 시점이 아니라 **투자자가 철회 불가능하게 계약상 구속된 날**이 기산점이다. 온체인 이벤트를 기산점으로 삼으면 마감을 놓친다(§5.3·OD-E01-2).

- **주(州) 차원의 결과는 연방과 다르다(중요).** Rule 506 증권은 §18(b)(4)(F)에 따라 covered security로 주 등록이 선점되지만, 같은 조항의 **단서**가 주의 notice filing 요구권을 명시적으로 보존한다. 그리고 §18(c)(3)은 “failure to submit any filing or fee”를 이유로 주가 **그 주 안에서의 offer·sale을 정지**시킬 수 있게 한다. **연방 면제는 유지되는데 특정 주에서 거래가 멈출 수 있다** — E-01이 실무적으로 방어하는 위험의 상당 부분이 여기 있다.

- **§18(b)(4) 항 번호가 바뀌었다.** 2013년 SEC 발행문서들은 Rule 506 covered security 근거로 §18(b)(4)**(D)**를 인용하지만, 2015년 FAST Act(Pub. L. 114-94 §76001(b))의 재지정으로 현행은 §18(b)(4)**(F)**다. 옛 자료를 그대로 옮기면 틀린 조항을 인용하게 된다.

- **2013년 제안(Release 33-9416)은 채택되지 않았다.** SEC는 506(c) 도입과 동시에 general solicitation 개시 **전** Form D 사전제출, 종료 후 closing amendment, 그리고 Form D 미준수 시 **1년간 Rule 506 사용 금지**를 제안했으나, 현행 Rule 503·507에 그 내용이 없다. 제안 텍스트를 현행법으로 착각하지 않는다(§3.15).

- **E-01은 매수인을 보는 부품이 아니다.** A-계열(A-01·A-03·A-13 등)이 “이 사람이 자격이 있는가”를 묻는다면, E-01은 “이 자산의 발행이 규제 준수 상태인가”를 묻는다. 그래서 FAIL의 의미가 다르다 — 매수인 교체로 치유되지 않고, **자산 단위로 차단**된다(§8.4).

**양식 메모.** 이 문서는 A-13 v1 인수인계 양식의 번호·헤더·서술 관습을 따른다. 다만 A-13이 증명서 확인형(Pattern B) 부품인 데 반해 E-01은 **기계 판정형(Pattern A)**이다 — 사람의 자격을 판단하는 것이 아니라 공적 등록부(EDGAR)에 존재하는 사실을 결정론적으로 대조한다. 그래서 §8은 증명서 패턴이 아니라 공적 데이터 확인 패턴을 다루고, ERC-3643 변환은 claim topic이 아니라 Compliance Module + Manifest 필드를 다룬다(claim.basis enum은 E-01에 해당 없음 — 상세 §8·§3.20).

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

E-01은 한 줄로 말하면 다음 질문에 답하는 부품이다.

이 자산의 발행자는, 이 발행에 대해, SEC에 Form D를 제대로 내 두었는가?

**(1) 왜 사모 발행자가 SEC에 무언가를 내야 하나.** Regulation D의 거래는 정의상 §5의 **등록을 면제받는** 거래다. 등록을 안 하는 것이 요점인데 SEC에 서류를 낸다는 것은 언뜻 모순처럼 보인다. 그러나 Form D는 등록서류가 아니라 **통지(notice)**다. 정식 명칭이 “Notice of Exempt Offering of Securities” — 즉 “우리는 이 면제에 기대어 이만큼 팔았습니다”라는 사후 신고다. 심사도 승인도 없고 연방 수수료도 없다.

**(2) 그럼 왜 존재하나.** Commission이 직접 답한 적이 있다. Release 33-11347 ¶3은 Form D 미제출의 폐해를 세 가지로 든다 — 첫째, Regulation D 시장의 규모를 SEC가 파악할 수 없게 되어 “투자자 보호와 자본형성의 균형”을 평가할 근거가 사라진다. 둘째, SEC·주 규제기관·자율규제기구의 감시·집행 능력이 손상된다. 셋째, 투자자와 시장참가자가 “이 회사가 연방증권법을 지키며 발행하고 있는가”를 확인할 수단을 잃는다. **Form D는 사모 시장의 유일한 공개 창(窓)이다.** 그 창을 닫는 것 자체가 규제 대상이다.

**(3) 그런데 이상한 구조가 하나 있다.** Form D 제출은 **면제의 조건이 아니다**. Rule 506(c)(1)이 조건으로 열거하는 것은 §230.501(정의)과 §230.502(a)·(d)(통합·전매제한)뿐이고 §230.503은 빠져 있다. 그래서 Form D를 안 내도 그 발행은 여전히 §5 면제를 받는다 — 투자자에게 매도한 증권이 소급해서 위법한 미등록 증권이 되지는 않는다. 이 구조는 의도된 것이다. 통지 불이행이라는 **절차적 흠**을 이유로 이미 종결된 **실체적 거래**를 뒤집으면, 정작 보호받아야 할 투자자가 발행자와 함께 무너지기 때문이다.

**(4) 대신 별도의 제재 라인이 붙어 있다.** 면제를 건드리지 않는 대신, 법은 세 갈래로 발행자를 압박한다.

- **연방 집행**: Rule 503 위반은 그 자체로 위법이다. Commission은 §8A에 따라 cease-and-desist를 명하고 민사제재금을 부과할 수 있다. 오랫동안 “면제가 안 깨지니 실익 없는 위반”으로 여겨졌으나, **2024-12-20 SEC가 Form D 미제출만을 이유로 3건을 제재하면서 그 인식이 깨졌다**(§3.13).
- **Rule 507 실격**: 위반을 이유로 법원 유지명령을 받으면, 그 후의 504·506 발행이 **전부** 막힌다. 한 번의 절차 위반이 미래의 자본조달 능력을 끊는 구조다.
- **주 정지권**: 아래 (5).

**(5) 실무에서 가장 먼저 터지는 것은 주(州)다.** NSMIA(1996)는 Rule 506 증권을 covered security로 만들어 주의 등록·심사를 선점했다. 그러나 §18(b)(4)(F)의 단서가 주의 **notice filing** 요구권을 남겼고, §18(c)(2)(A)가 이를 재확인하며, §18(c)(3)이 “filing 또는 fee 미제출”을 이유로 주가 **그 주 안에서의 offer·sale을 정지**할 수 있게 한다. 주 신고는 실무상 Form D 사본을 기초로 이루어지므로, **Form D를 안 내면 주 신고 자체가 성립하지 않는다.** 연방 면제는 멀쩡한데 특정 주에서 판매가 멈추는 상황 — 이것이 Form D 불이행의 가장 현실적인 귀결이다.

**(6) 506(c)에는 탈출구가 없다(핵심).** Rule 500(c)는 “Regulation D 준수 시도는 배타적 선택이 아니다”라며, 506(b)를 못 맞춰도 §4(a)(2)를 따로 주장할 수 있다고 한다. 그러나 이 탈출구는 **general solicitation을 하는 순간 닫힌다.** Commission의 논리는 명확하다(Release 33-11347 ¶8) — 일반청약권유를 했으면 그 발행은 §4(a)(2)의 “public offering이 아닌 거래”일 수 없고, 따라서 **Rule 504나 506(c)에 의존하는 것 외에 길이 없으며, 그 결과 Form D 제출 의무가 확정된다.** 일반청약권유를 전제로 설계된 506(c) 자산에서 Form D는 선택이 아니다.

**요약하면**, E-01은 “Form D가 없으면 면제가 깨진다”를 구현하는 부품이 **아니다**. 면제는 깨지지 않는다. E-01은 “면제는 살아 있지만 발행자가 제재·실격·주 정지 위험에 노출된 자산을, 우리 거래소가 계속 유통시킬 것인가”라는 **운영상의 물음**에 답하는 보수적 게이트다. 이 성격 규정이 §5·§6·§8 전체를 지배한다.

**한국법 비교(참고).** 한국 자본시장법의 사모 체계도 유사한 통지 구조를 갖는다 — 증권신고서 면제 사모라도 일정 요건에서 사후 보고·전매제한 조치가 요구되고, 그 불이행은 발행의 사법(私法)적 효력이 아니라 **행정 제재**로 다뤄지는 것이 일반적이다. “통지 불이행 ≠ 거래 무효, 그러나 제재 대상”이라는 이원 구조는 양국이 공통된다. 다만 미국은 여기에 **주(州) 층위의 정지권**이 하나 더 얹혀 있다는 점이 결정적으로 다르다.

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고 “본 부품”·“Form D 확인 부품” 같은 자연어로 부른다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | Form D 확인 (Notice of Exempt Offering) | 발행자가 SEC에 사모 통지를 냈는지 확인하는 문지기 |
| 검사 대상 | 이 자산의 발행에 대해 Rule 503이 요구하는 Form D가 EDGAR에 제출되어 있고, 그 기재가 Manifest의 면제 주장과 일치하며, 요구되는 수정이 지연되지 않았는가 | “발행자가 신고를 해 뒀는가” |
| Internal ID | E-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 기계 판정형 (Pattern A) — 공적 등록부(EDGAR) 사실의 결정론적 대조 | 사람의 자격 판단이 아니라 공적 데이터 존부·일치 확인 |
| Timing | pre-trade 게이트 | 거래 직전 1회 확인, 사후 갱신 없음 |
| Stateful 여부 | STATELESS | 과거 거래 누적에 판정이 의존하지 않음 (자산 상태에만 의존) |
| 주 활성화 Recipe | R1 (Reg D 506(c) Issuance) | R1 전용 — R2·R3·R4에는 부착되지 않음 |
| Cumulative Recipe | 없음 (R1 exclusive) | E-03·F-04와 같은 R1 전용 3인방 |
| Cascade Element | B-01(manifest 정합) · E-03(bad actor) · A-01/A-02(글로벌 게이트, 선행) | 설정 정합·서명 certification 연계 |
| 판정 대상 주체 | **발행자·자산** (매수인 아님) | A-계열과의 근본적 차이 — 실패 시 자산 단위 차단 |
| 성숙도 | 정밀화 필요 → 본 문서로 확정 (R-5 “공적 데이터 확인 방법” 응답분) | Form D 조회 경로 + 법적 성격 규정 완료 |
| 파일·위치 | E-01_FormD확인.md · 산출물/elements/ | 산출물 경로 |

## §3. 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석)은 SEC 발행문서·Commission order·staff 해석이다. 아래 §3.0.2 표 1의 “종류” 칸이 그대로 Layer에 대응한다 — Statute = Layer 1(§5·§4(a)(2)·§4(b)·§18), SEC Rule = Layer 2(Rule 503·506·507·508·500·Form D), SEC Release·Order·Staff = Layer 3(33-11347·FAQ·33-9416). 본 절은 조문이 작동하는 논리 흐름 순서로 배열돼 §3.1~§3.15 번호를 그대로 유지하며, 각 항목이 어느 Layer인지는 이 표로 확인하면 된다.

### 3.0 법조문 관계 플로우차트 (개발자용)

위 조문들이 E-01 판정에서 어떻게 연결되는지 — §5 등록 원칙에서 출발해 §4(a)(2) 면제 → Rule 506(a) 간주 → 506(c)(1) 일반조건에 이르렀을 때 **그 조건 목록에 §230.503이 없다**는 사실(그림 가운데 별표)이 확인되고, 그 결과 Rule 503이 면제 라인에서 떨어져 나와 **독립 의무**로 서며, 그 위반이 면제를 건드리지 않은 채 집행·Rule 507·주(州) 정지의 세 갈래로만 흐르는 구조 — 를 정리한 것이다. 오른쪽 아래 경고 상자는 Rule 500(c)의 비배타적 선택이라는 탈출구가 general solicitation 앞에서 닫힌다는 점을 표시한다. 각 조항 상세는 §3.1~§3.15.

![그림 3.0 — 법조문 관계 흐름: §5 → §4(a)(2) → 506(c)(1) 조건 목록의 §230.503 부재 → Rule 503 독립 의무 → 3갈래 제재 (개발자용)](fig30.png)

*그림 3.0 — 법조문 관계 흐름: §5 → §4(a)(2) → 506(c)(1) 조건 목록의 §230.503 부재 → Rule 503 독립 의무 → 3갈래 제재 (개발자용)*

### 3.0.1 실제 BUIDL에 어떻게 적용되나

BUIDL(BlackRock USD Institutional Digital Liquidity Fund Ltd.)은 본 부품에 관한 한 **추정이 필요 없는 드문 경우**다. Form D가 EDGAR에 실재하고 공개되어 있기 때문이다. 확인된 사실은 다음과 같다(SEC EDGAR, Filing Detail).

| 항목 | 값 | E-01 관점의 의미 |
| --- | --- | --- |
| Filer | BlackRock USD Institutional Digital Liquidity Fund Ltd. | 발행자 = 펀드 자신 (Rule 500(d): Reg D는 발행자만 이용 가능) |
| CIK | 0002013810 | E-01의 `issuerCIK` 대조 키 |
| SEC Accession No. | 0002014390-24-000001 | 제출 건 고유 식별자 — `formDAccession` |
| Form Type | D (Act: 33) | 신규 통지 |
| Filing Date / Accepted | 2024-03-18 / 2024-03-18 10:07:05 | `filingDate` |
| File No. | 021-507840 | — |
| State of Incorp. | D8 (영국령 버진아일랜드) | 역외 발행자도 Rule 503 의무를 진다 — 아래 해설 |
| **Item 06c** | **Rule 506(c)** | Manifest `issuanceFramework=RegD506c`와 정합 (G4) |
| **Item 3C.7** | **Investment Company Act Section 3(c)(7)** | R3(§3(c)(7) 펀드)와 정합 — R1+R3 동시 성립의 공적 증거 |
| 후속 | Form D/A(수정) 제출 이력 존재 (2025-07-18 수신분 등) | 계속 발행 → 연차 수정 라인 가동 중(G5) |

**해설 1 — 이것이 왜 결정적인가.** 본 프로젝트는 “BUIDL-like 자산 = Rule 506(c) + ICA §3(c)(7)”을 전제로 R1과 R3를 동시 부착한다. 그 전제는 추측이 아니라 **발행자 자신이 SEC에 체크한 항목**으로 확인된다 — Form D Item 6은 “Federal Exemptions and Exclusions Claimed (Select all that apply)”이고, BUIDL은 거기서 Rule 506(c)와 Section 3(c)(7)을 **함께** 선택했다. E-01의 G4(정합) 게이트가 대조하는 값이 바로 이 두 체크박스다.

**해설 2 — 역외 펀드도 Rule 503을 진다.** BUIDL은 BVI 법인이다(State of Incorp. D8). D-01 문서에서 다룬 것처럼 §12(g) 적용 여부는 FPI 검토가 선행되지만, **Rule 503은 그와 무관하다.** Rule 503(a)(1)의 수범자는 “An issuer offering or selling securities in reliance on § 230.504 or § 230.506”이며 국적·설립지 제한이 없다. 미국에서 506(c)에 기대어 파는 이상 역외 발행자도 Form D를 낸다 — BUIDL의 실제 제출이 그 실증이다. **E-01에는 D-01의 FPI 분기 같은 선행 판단이 없다**(이 점이 D-01과 E-01의 중요한 비대칭이다).

**해설 3 — Decipher 데모에서의 위치.** 데모의 BUIDL-like 테스트 토큰은 실제 BUIDL을 모델링한 것이므로, Manifest에 `issuerCIK=0002013810`류의 값이 아니라 **테스트 발행자의 CIK 또는 “발행 미개시” 상태**가 들어간다. E-01은 이 경우 두 갈래로 갈린다 — (a) 실제 발행이 없는 순수 데모 자산이면 Manifest의 `issuanceFramework`가 `RegD506c`가 아니므로 G0에서 미부착(P0), (b) 506(c) 발행을 모사하는 자산이면 테스트 Form D 사실을 Manifest에 주입해 G1~G6을 태운다. **실제 BUIDL의 Form D 데이터를 테스트 fixture로 그대로 쓰는 것이 가장 현실적인 L4 테스트 벡터**다(§7 T12).

### 3.0.2 조문 근거표 (Authority) + 순서·중요성

**표 1 — Authority (근거 원천 일람).** “종류” = Layer, 태그 = Direct(직접 판정 근거)·Conditional(사실관계 따라 활성)·Supporting(보조)·Background(배경).

| 종류 | Authority | 내용 | E-01 관련성 | 태그 | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | 1933년 증권법 §5, 15 U.S.C. §77e | 등록이 원칙 | 면제가 필요한 이유 — 상위 배경 | Background | uscode.house.gov |
| Statute | §4(a)(2), 15 U.S.C. §77d(a)(2) | “transactions by an issuer not involving any public offering” | 506(c)가 기대는 상위 면제 | Background | uscode.house.gov |
| Statute | §4(b), 15 U.S.C. §77d(b) | Rule 506 발행은 general solicitation을 이유로 public offering으로 간주되지 않음 | 506(c) 밖의 일반청약권유는 여전히 public offering → Form D 의무 확정의 근거 | Supporting | uscode.house.gov |
| Statute | JOBS Act §201(a)(1) note, Pub. L. 112-106 | 개정 Rule 506은 계속 §4(2) 하의 규칙으로 취급 | §18(b)(4)(F)의 “rules issued under §77d(2)”에 506(c)가 포섭되는 연결고리 | Supporting | uscode.house.gov |
| **SEC Rule** | **Rule 503, 17 C.F.R. §230.503** | **최초 매도 후 15역일 이내 Form D 제출 + 수정 규율 + EDGAR 제출·서명** | **본 부품의 의무 본체 (핵심)** | **Direct** | ecfr.gov |
| **SEC Rule** | **Rule 506(c)(1), 17 C.F.R. §230.506(c)(1)** | **일반조건 = §§230.501 + 230.502(a)·(d)** | **⭐ §230.503 부재 — “조건 아님”의 조문상 근거 (핵심)** | **Direct** | ecfr.gov |
| SEC Rule | Rule 506(a), 17 C.F.R. §230.506(a) | (b)·(c) 충족 시 §4(a)(2) 거래로 간주 | 면제 성립 구조 — E-01이 건드리지 않는 층 | Direct | ecfr.gov |
| SEC Rule | Rule 507, 17 C.F.R. §230.507 | Rule 503 위반 관련 법원 유지명령 시 504·506 면제 불가 (good cause 예외) | 미제출의 최악 경로 — 단 injunction 요건 | Direct | ecfr.gov |
| SEC Rule | Rule 508, 17 C.F.R. §230.508 | 경미한 일탈 구제 + “Reg D 전 조항 준수 의무” + Commission 제소 가능 | 503이 508(a)(2) 중대 열거에 없음 / 508(b) 후단이 제재 근거 | Supporting | ecfr.gov |
| SEC Rule | Rule 500(b)·(c)·(d), 17 C.F.R. §230.500 | 주법 준수 상기 / 비배타적 선택 / 발행자 전용 | 주 notice filing 경고 + §4(a)(2) 탈출구와 그 한계 | Supporting | ecfr.gov |
| SEC Rule | Form D, 17 C.F.R. §239.500 + 서식 원본 | Item 1~16 + Terms of Submission | E-01이 읽는 필드 정의 + Rule 506(d) certification (E-03 연계) | Direct | ecfr.gov · sec.gov |
| **Statute** | **§18(b)(4)(F), 15 U.S.C. §77r(b)(4)(F)** | **506 증권은 covered security — 단, 주의 notice filing 요구권 보존** | **주 신고 라인의 근거 (중요)** | **Direct** | uscode.house.gov |
| Statute | §18(c)(2)(A), 15 U.S.C. §77r(c)(2)(A) | 주는 SEC 제출 서류·판매자료·송달동의·수수료를 통지 목적으로 요구 가능 | 주 신고가 Form D 사본 기반인 이유 | Direct | uscode.house.gov |
| **Statute** | **§18(c)(3), 15 U.S.C. §77r(c)(3)** | **filing·fee 미제출 시 주는 그 주 내 offer·sale 정지 가능** | **연방 면제 유지 ≠ 거래 계속 — 실무상 최대 위험** | **Direct** | uscode.house.gov |
| Statute | §8A, 15 U.S.C. §77h-1 | cease-and-desist 절차 | 2024년 제재의 근거 조문 | Supporting | uscode.house.gov |
| **SEC Order** | **Release No. 33-11347 (2024-12-20)** | ***In re Pipe Technologies Inc.* — Rule 503 위반, C&D + $195,000** | **⭐ Commission 자신의 “면제 유지 ∧ 위법 성립” 이중 명제 (핵심 Layer 3)** | **Direct** | sec.gov |
| SEC Release | Press Release 2024-210 (2024-12-20) | 3건 동시 제재 ($60,000 / $195,000 / $175,000) | 집행 위험의 실증 규모 | Supporting | sec.gov |
| SEC Staff | Form D FAQ 답변 1·5 (2026-03-17 갱신) | first sale 정의 / “not a condition” / 지각 시 선의 제출 권고 | 기산점 + 치유 경로의 staff 근거 (비구속) | Supporting | sec.gov |
| SEC Staff | Securities Act Rules CFI 257.02–257.08 | Rule 503 해석 | FAQ가 인용하는 staff 해석군 (비구속) | Background | sec.gov |
| SEC Release | Release No. 33-9416 (2013-07-10, 제안) | 사전 Form D·closing amendment·1년 실격 제안 | **미채택** — 현행법과 혼동 금지 | Background | sec.gov |
| SEC Release | Release No. 33-8891 (2008-02-06) | Form D 전자제출·서식 전면개정 채택 | EDGAR 제출 체계의 연혁 + Item별 지침 | Background | sec.gov |
| SEC Data | EDGAR Submissions API | `https://data.sec.gov/submissions/CIK##########.json` | 기계 조회 경로 (인증 불필요) | Supporting | sec.gov |

**표 2 — 순서·중요성 한눈에 보기.** 순서는 중요도순이 아니라 법이 작동하는 논리 흐름순이다.

| 순서 | 조문 | 중요성 | E-01이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | §5 (15 U.S.C. §77e) | 배경 | 등록이 원칙임을 확인 — 면제가 필요한 이유 |
| §3.2 | §4(a)(2) (§77d(a)(2)) | 배경 | 506(c)가 기대는 상위 면제 |
| §3.3 | §4(b) + JOBS Act §201(a)(1) | 보조 | 506 안에서만 general solicitation이 면책됨 → 밖이면 public offering |
| §3.4 | Rule 506(a) | 직접 | 면제 성립 구조 — E-01이 건드리지 않는 층임을 확정 |
| §3.5 | **Rule 506(c)(1)** | **핵심** | **조건 목록에 §230.503 부재 → “Form D는 조건 아님”의 근거** |
| §3.6 | **Rule 503(a)(1)** | **핵심** | **의무 본체: 15역일 · 기산점 · 주말·공휴일 연장 (G1·G6)** |
| §3.7 | Rule 503(a)(2)~(4) | 핵심 | 수정 의무: 오류정정·변경반영·연차 (G5) + 수정 시 전면 갱신 |
| §3.8 | Rule 503(b) | 직접 | EDGAR 전자제출 + 권한 있는 자의 서명 (G2) |
| §3.9 | Rule 507 | 직접 | 미제출의 최악 경로 — injunction 요건·good cause 예외 |
| §3.10 | Rule 508 | 보조 | 503이 중대 일탈 열거에 없음 / 508(b) 후단 = 제재 근거 |
| §3.11 | Rule 500(b)·(c)·(d) | 보조 | 주법 경고 · 비배타적 선택과 그 한계 · 발행자 전용 |
| §3.12 | Form D (§239.500) + Terms of Submission | 직접 | 읽을 필드 정의 (G3·G4) + Rule 506(d) certification (E-03 연계) |
| §3.13 | **§18(b)(4)(F) · (c)(2)(A) · (c)(3)** | **핵심** | **주 notice filing 근거 + 주 정지권 — 실무상 최대 위험** |
| §3.14 | **Release 33-11347** | **핵심** | **“면제 유지 ∧ Rule 503 위반 성립” 이중 명제 + 506(c) 탈출구 봉쇄 논리** |
| §3.15 | FAQ 답변 1·5 / Release 33-9416 | 보조 | 기산점·치유 경로 / 미채택 제안과의 경계 |

### 3.1 증권법 §5 — 등록이 원칙 (배경)

- **조항**: Securities Act of 1933 §5, 15 U.S.C. §77e — uscode.house.gov

- **핵심 원문**: (해당 조는 등록신고서 없는 매도·인도를 금지하는 일반 원칙 조항이며, 본 부품은 그 예외 라인 위에서만 작동하므로 원문 전재 대신 §4(a)(2)의 “The provisions of section 77e of this title shall not apply to—”라는 연결 문언으로 대신한다. §77d(a) 본문 참조.)

- **한국어**: 제77e조(제5조)의 규정은 다음 각 호에는 적용되지 아니한다 — (§77d(a) 본문)

- **쉬운 설명**: 미국에서 증권을 팔려면 원칙적으로 SEC에 등록해야 한다. 이 원칙이 있기 때문에 “면제”라는 개념이 성립하고, 면제에 기대는 발행자에게 “당신이 어느 면제를 쓰는지 알려 달라”고 요구할 근거(Form D)가 생긴다. E-01은 이 원칙 자체를 판정하지 않는다 — 원칙의 예외 위에 서 있는 자산의 통지 상태만 본다.

- **PASS/FAIL 반영**: 간접 ✕ — E-01은 §5 위반 여부를 판정하지 않는다. 오히려 **E-01이 FAIL이어도 §5 면제는 유지된다**는 것이 본 부품의 출발점이다(§3.5·§3.14).

- **ERC-3643 변환**: 없음 (배경 조문). Manifest `issuanceFramework`가 면제 라인을 지정하는 것으로 대체된다.

### 3.2 증권법 §4(a)(2) — 공모가 아닌 발행자 거래 (배경)

- **조항**: Securities Act of 1933 §4(a)(2), 15 U.S.C. §77d(a)(2) — uscode.house.gov (2026-06-05 현재)

- **핵심 원문**: The provisions of section 77e of this title shall not apply to— … (2) transactions by an issuer not involving any public offering.

- **한국어**: 제77e조의 규정은 다음에 적용되지 아니한다 — … (2) public offering을 수반하지 않는 발행자의 거래.

- **쉬운 설명**: 사모의 뿌리 조문이다. 단 열두 단어뿐이고 “public offering”이 무엇인지는 정의하지 않는다. 그 공백을 메우려고 SEC가 만든 것이 Rule 506이라는 safe harbor다. E-01의 맥락에서 이 조문이 중요한 이유는 하나다 — **Rule 506(c)를 못 쓰게 되면 발행자가 되돌아갈 곳이 여기이고(Rule 500(c)), general solicitation을 한 순간 여기로 되돌아갈 수 없다**(§3.3·§3.14). 그것이 506(c) 자산에서 Form D 의무가 확정되는 이유다.

- **PASS/FAIL 반영**: 간접 ✕ — E-01은 §4(a)(2) 해당성을 판정하지 않는다. 다만 §12의 Open Issue(OD-E01-6)에서 “Form D 미제출 자산이 §4(a)(2)로 후퇴 가능한가”를 검토할 때의 기준 조문이다.

- **ERC-3643 변환**: 없음 (배경 조문).

### 3.3 증권법 §4(b) + JOBS Act §201(a)(1) — 506 안에서만 열리는 일반청약권유 (보조)

- **조항**: Securities Act of 1933 §4(b), 15 U.S.C. §77d(b); Jumpstart Our Business Startups Act §201(a)(1), Pub. L. 112-106, 126 Stat. 313 (note) — uscode.house.gov

- **핵심 원문**: **§4(b)** — Offers and sales exempt under section 230.506 of title 17, Code of Federal Regulations (as revised pursuant to section 201 of the Jumpstart Our Business Startups Act) shall not be deemed public offerings under the Federal securities laws as a result of general advertising or general solicitation. / **JOBS Act §201(a)(1) 후단** — Section 230.506 of title 17, Code of Federal Regulations, as revised pursuant to this section, shall continue to be treated as a regulation issued under section 4(2) of the Securities Act of 1933 ([now] 15 U.S.C. 77d[(a)](2)).

- **한국어**: **§4(b)** — (JOBS Act 제201조에 따라 개정된) 17 C.F.R. §230.506에 따라 면제되는 offers and sales는, general advertising 또는 general solicitation을 했다는 이유로 연방증권법상 public offering으로 간주되지 아니한다. / **§201(a)(1) 후단** — 본조에 따라 개정된 17 C.F.R. §230.506은 1933년 증권법 제4(2)조(현 15 U.S.C. §77d(a)(2)) 하에서 발령된 규칙으로 계속 취급된다.

- **쉬운 설명**: 두 문장이 각각 다른 일을 한다. **§4(b)**는 “506에 따른 발행이라면 광고를 해도 공모로 안 본다”고 한다 — 뒤집으면 **506의 울타리 밖에서 광고하면 그대로 공모**라는 뜻이다. 이것이 §1(6)에서 말한 “탈출구 봉쇄”의 조문상 뿌리다. **§201(a)(1) 후단**은 다른 일을 한다 — 506(c)가 일반청약권유를 허용하게 되었어도 여전히 “§4(2) 하의 규칙”임을 못 박는다. 이 한 문장이 없었다면 506(c) 증권은 §18(b)(4)(F)의 “Commission rules or regulations issued under section 77d(2)”에 해당하지 않아 covered security 지위를 잃고 50개 주의 등록심사를 받았을 것이다. **즉 §201(a)(1) 후단은 §3.13의 주법 선점 라인 전체를 지탱하는 연결고리다.**

- **PASS/FAIL 반영**: 간접 ✕ — 직접 게이트는 아니다. 그러나 §5.1의 “왜 506(c) 자산에서 Form D는 선택이 아닌가”와 §3.13의 covered security 논증이 이 두 문장에 의존한다.

- **ERC-3643 변환**: Manifest `generalSolicitationUsed: bool`. true이면 §4(a)(2)로의 후퇴가 불가하므로 E-01의 FAIL을 완화할 여지가 없다(§6.3·OD-E01-6).

### 3.4 Rule 506(a) — 면제 성립의 구조 (직접)

- **조항**: 17 C.F.R. §230.506(a) — eCFR 현행본 (Title 17 최종개정 2026-06-25, 조회 2026-07-15)

- **핵심 원문**: *Exemption.* Offers and sales of securities by an issuer that satisfy the conditions in paragraph (b) or (c) of this section shall be deemed to be transactions not involving any public offering within the meaning of section 4(a)(2) of the Act.

- **한국어**: *면제.* 본조 (b) 또는 (c)의 조건을 충족하는 발행자의 offers and sales는, 법 제4(a)(2)조의 의미 내에서 public offering을 수반하지 않는 거래로 **간주된다**.

- **쉬운 설명**: “deemed(간주된다)”가 핵심 동사다. 506의 조건을 맞추면 §4(a)(2) 해당 여부를 개별 심사받지 않고 **자동으로** 사모로 인정된다 — 이것이 safe harbor의 의미다. 그리고 여기서 결정적인 것은 **간주의 방아쇠가 “paragraph (b) or (c)의 conditions”라는 점**이다. 면제 성립 여부는 (b)/(c)가 열거한 조건만으로 판정되고, Regulation D의 다른 조항(예: §230.503)은 이 문장에 등장하지 않는다. 다음 §3.5가 그 (c)의 조건 목록을 실제로 열어본다.

- **PASS/FAIL 반영**: 간접 ✕ — E-01이 관여하지 않는 층이다. 이 조문은 오히려 **E-01의 FAIL이 면제 성립에 닿지 않음을 구조적으로 보증**한다. 면제 판정은 A-03(전원 AI)·B-03 등 (c)(2) 라인의 부품이 담당한다.

- **ERC-3643 변환**: Manifest `issuanceFramework = RegD506c`. 이 값이 R1 Recipe 활성화와 E-01의 G0(관련성) 게이트를 동시에 결정한다.

### 3.5 Rule 506(c)(1) — 일반조건: §230.503이 없다 ⭐ (핵심)

- **조항**: 17 C.F.R. §230.506(c)(1) — eCFR 현행본 (2013-07-24 채택분, 78 FR 44771; Title 17 최종개정 2026-06-25, 조회 2026-07-15)

- **핵심 원문**: *Conditions to be met in offerings not subject to limitation on manner of offering* — (1) *General conditions.* To qualify for exemption under this section, sales must satisfy all the terms and conditions of §§ 230.501 and 230.502(a) and (d).

- **한국어**: *청약 방법의 제한을 받지 않는 발행에서 충족되어야 할 조건* — (1) *일반조건.* 본조의 면제를 받으려면, sales는 §§ 230.501 및 230.502(a)와 (d)의 모든 terms and conditions를 충족해야 한다.

- **쉬운 설명**: **이 문서에서 가장 중요한 한 문장이다.** 506(c) 면제의 조건 목록은 정확히 세 개뿐이다 — §230.501(정의), §230.502(a)(통합), §230.502(d)(전매제한). 여기에 **§230.503(Form D 제출)은 없다.** 비교하면 더 분명하다: 같은 규칙의 506(b)(1)도 “all the terms and conditions of §§ 230.501 and 230.502”만 인용하며 역시 §230.503을 부르지 않는다. 그리고 §230.502(c)(일반청약권유 금지)가 (c)(1)에서 빠진 것이 506(c)의 존재 이유인 것처럼, **§230.503이 애초에 어디에도 없는 것은 입법 설계**다.

“쉽게 말하면” — 면제의 문은 세 개의 열쇠(501·502(a)·502(d))로 열린다. Form D는 그 문의 열쇠가 아니라, 문을 열고 들어간 뒤 관리사무소에 내야 하는 **입주 신고서**다. 신고서를 안 내면 관리규약 위반으로 과태료를 물지만, 이미 열린 문이 다시 잠기지는 않는다.

- **PASS/FAIL 반영**: 직접 ⭐ — **E-01의 성격을 규정하는 조문이다.** E-01의 모든 FAIL 코드는 “면제 불성립”을 뜻하지 않는다. 따라서 E-01은 법문이 요구해서 세우는 게이트가 아니라, 제재·실격·주 정지 위험을 예방하려고 **우리가 스스로 세우는 보수적 운영 게이트**다(§6.3). 이 구분을 문서·테스트·거절 메시지 전반에서 유지한다.

- **ERC-3643 변환**: `E01.legalNature = OPERATIONAL_GATE` (≠ `EXEMPTION_CONDITION`). 이 상수는 §6.2의 거절 메시지 문안과 §11의 예외승인 권한 설계를 좌우한다 — 면제 조건이 아니므로 Operator의 한시적 예외승인이 **법적으로는** 가능하다(다만 §6.3의 정책 판단이 별도로 요구된다).

### 3.6 Rule 503(a)(1) — 제출 의무 본체: 15역일 (핵심)

- **조항**: 17 C.F.R. §230.503(a)(1) — eCFR 현행본 (73 FR 10615, 2008-02-27; 81 FR 83553, 2016-11-21 개정)

- **핵심 원문**: *When notice of sales on Form D is required and permitted to be filed.* (1) An issuer offering or selling securities in reliance on § 230.504 or § 230.506 must file with the Commission a notice of sales containing the information required by Form D (17 CFR 239.500) for each new offering of securities no later than 15 calendar days after the first sale of securities in the offering, unless the end of that period falls on a Saturday, Sunday or holiday, in which case the due date would be the first business day following.

- **한국어**: *Form D에 의한 notice of sales가 요구되고 제출이 허용되는 시점.* (1) § 230.504 또는 § 230.506에 기대어 증권을 offering 또는 selling하는 issuer는, **각 새로운 발행(each new offering)마다**, 그 발행에서의 **최초 매도 후 15역일(15 calendar days)을 넘기지 않고** Form D(17 CFR 239.500)가 요구하는 정보를 담은 notice of sales를 Commission에 제출해야 한다. 다만 그 기간의 말일이 토요일·일요일 또는 공휴일에 해당하면, 마감일은 **그 다음 최초의 영업일**이 된다.

- **쉬운 설명**: 네 개의 부품으로 뜯어 읽는다. **① 수범자** — “issuer … in reliance on § 230.504 or § 230.506”. 국적 제한이 없다(BUIDL 같은 BVI 펀드도 낸다, §3.0.1). Rule 500(d)에 따라 Reg D는 발행자 전용이므로 매도인·중개인은 수범자가 아니다. **② 단위** — “for each new offering”. 발행 건별이다. 한 발행자가 여러 발행을 하면 각각 Form D를 낸다(무엇이 “new offering”인지는 Rule 152 통합 규율의 문제 — §9·OD-E01-4). **③ 기산점** — “after the first sale”. 이것이 §3.15에서 다룰 함정이다. **④ 마감** — 15 calendar days(영업일이 아니라 **역일**). 다만 말일이 토·일·공휴일이면 다음 영업일로 밀린다.

**부등호 규율(중요)**: “no later than 15 calendar days after”는 **경과일수 ≤ 15**가 적법이라는 뜻이다. 15일째 당일 제출은 **적법**이고, 16일째부터 지각이다(경과 > 15). 그리고 이 15일 계산은 주말·공휴일 연장 규칙과 결합해야만 완성된다 — **“> 15면 곧 위반”이 아니라 “> 조정된 마감일이면 위반”**이다. 이 조정을 빠뜨리면 적법한 발행에 지각 flag를 잘못 붙인다(§5.3).

- **PASS/FAIL 반영**: 직접 ⭐ — G1(존재)과 G6(적시성)의 근거. 미제출 → `FORMD_NOT_FILED`(차단). 지각이지만 제출됨 → `FORMD_LATE_FILED`(**차단하지 않고 flag** — 면제가 유지되고 SEC 스스로 사후 제출을 권고하므로, §3.15·§6.2).

- **ERC-3643 변환**: Manifest·오라클 필드 — `formDFiled: bool`, `filingDate: date`, `dateOfFirstSale: date`, `formDDueDate: date`(주말·공휴일 조정 후 확정값, off-chain 계산). 온체인 모듈은 `filingDate <= formDDueDate`만 비교한다(달력 연산을 온체인에서 하지 않는다 — §5.3 해설).

### 3.7 Rule 503(a)(2)~(4) — 수정 제출: 오류·변경·연차 (핵심)

- **조항**: 17 C.F.R. §230.503(a)(2), (a)(3), (a)(4) — eCFR 현행본

- **핵심 원문**: (2) An issuer may file an amendment to a previously filed notice of sales on Form D at any time. (3) An issuer must file an amendment to a previously filed notice of sales on Form D for an offering: (i) To correct a material mistake of fact or error in the previously filed notice of sales on Form D, as soon as practicable after discovery of the mistake or error; (ii) To reflect a change in the information provided in the previously filed notice of sales on Form D, as soon as practicable after the change, except that no amendment is required to reflect a change that occurs after the offering terminates or a change that occurs solely in the following information: … (G) The number of non-accredited investors who have invested in the offering, as long as the change does not increase the number to more than 35; (H) The total number of investors who have invested in the offering; … and (iii) Annually, on or before the first anniversary of the filing of the notice of sales on Form D or the filing of the most recent amendment to the notice of sales on Form D, if the offering is continuing at that time. (4) An issuer that files an amendment to a previously filed notice of sales on Form D must provide current information in response to all requirements of the notice of sales on Form D regardless of why the amendment is filed.

- **한국어**: (2) issuer는 이미 제출한 Form D notice of sales에 대한 수정을 **언제든지** 제출할 수 있다. (3) issuer는 어느 발행에 관하여 다음의 경우 이미 제출한 Form D notice of sales의 수정을 제출**해야 한다**: (i) 이미 제출한 Form D notice of sales의 중요한 사실의 착오 또는 오류를 정정하기 위하여, 그 착오·오류를 발견한 후 **실행 가능한 한 신속히**; (ii) 이미 제출한 Form D notice of sales에 제공된 정보의 변경을 반영하기 위하여, 그 변경 후 실행 가능한 한 신속히. 다만 **발행이 종료된 후 발생한 변경** 또는 다음 정보에만 발생한 변경에 대하여는 수정이 요구되지 아니한다: … (G) 그 발행에 투자한 비적격투자자의 수(다만 그 변경으로 인해 그 수가 35명을 초과하게 되지 않는 한); (H) 그 발행에 투자한 투자자의 총수; … 그리고 (iii) **매년, 그 Form D notice of sales의 제출일 또는 가장 최근 수정의 제출일로부터 1주년이 되는 날 또는 그 이전에**, 그 시점에 발행이 계속되고 있는 경우. (4) 이미 제출한 Form D notice of sales의 수정을 제출하는 issuer는, 그 수정을 제출하는 이유가 무엇이든 관계없이, Form D notice of sales의 **모든 요구사항에 대하여 현재의 정보**를 제공해야 한다.

- **쉬운 설명**: 세 종류의 수정 의무가 있는데 성질이 전혀 다르다. **(i)·(ii)는 사건 구동형**이다 — “as soon as practicable”이라는 기준은 날짜로 환산되지 않으므로 **기계가 판정할 수 없다**. **(iii)만이 날짜 구동형**이다 — “on or before the first anniversary”이므로 기계가 판정할 수 있다. 그래서 E-01은 (iii)만 게이트로 삼고 (i)·(ii)는 Operator 층으로 넘긴다(§11). 이 분리가 Pattern A 부품의 기율이다 — **판정 불가능한 것을 판정하는 척하지 않는다.**

**(3)(ii)의 예외 목록이 중요한 이유**: 총 투자자 수(H)나 판매량(F)이 변해도 수정이 필요 없다. 즉 **거래가 일어날 때마다 Form D를 고칠 의무는 없다.** 이것은 E-01이 STATELESS인 이유 중 하나다 — 매 거래가 Form D 상태를 바꾸지 않는다. 다만 비적격투자자 수(G)는 **35명 초과로 넘어가는 순간** 예외에서 빠져 수정 의무가 생긴다(506(c)는 전원 AI이므로 이 분기는 데모에서 잠자지만, 라이브러리 완결성상 보존한다).

**(4)는 함정이다**: 연차 수정 하나를 내려 해도 Form D **전체**를 현재 정보로 다시 채워야 한다. 즉 연차 수정은 “날짜만 갱신하는 형식적 절차”가 아니라 Item 1~16 전면 재작성이다. 운영 부담을 과소평가하면 마감을 놓친다(§11).

**부등호 규율**: “on or before the first anniversary” → **≤ 1주년**이 적법. 1주년 당일 제출은 적법하고, 그 다음날부터 지연이다.

- **PASS/FAIL 반영**: 직접 — G5(신선도)의 근거. `offeringOngoing == true`이고 `now > amendmentDueAt`이면 `FORMD_AMENDMENT_OVERDUE`(차단). (i)·(ii)는 게이트가 아니라 Operator flag(§11).

- **ERC-3643 변환**: `offeringOngoing: bool`, `lastFilingOrAmendmentDate: date`, `amendmentDueAt: date`(= lastFilingOrAmendmentDate + 1년, 주말·공휴일 조정 반영). A-11(claim freshness)의 일반 규율과 **구조는 같고 근거가 다르다** — A-11의 유효기간은 정책 proxy이나, 여기의 1년은 **법정 수치**다(§6.3).

### 3.8 Rule 503(b) — EDGAR 전자제출과 서명 (직접)

- **조항**: 17 C.F.R. §230.503(b) — eCFR 현행본

- **핵심 원문**: *How notice of sales on Form D must be filed and signed.* (1) A notice of sales on Form D must be filed with the Commission in electronic format by means of the Commission's Electronic Data Gathering, Analysis, and Retrieval System (EDGAR) in accordance with EDGAR rules set forth in Regulation S-T (17 CFR Part 232). (2) Every notice of sales on Form D must be signed by a person duly authorized by the issuer.

- **한국어**: *Form D notice of sales의 제출 방법과 서명.* (1) Form D notice of sales는, Regulation S-T(17 CFR Part 232)가 정하는 EDGAR 규칙에 따라, Commission의 EDGAR 시스템을 통해 **전자적 형식으로** Commission에 제출되어야 한다. (2) 모든 Form D notice of sales는 **issuer가 정당하게 권한을 부여한 자**에 의해 서명되어야 한다.

- **쉬운 설명**: E-01에게 이 조문은 선물이다. **제출처가 EDGAR 하나로 고정**되어 있고, 종이 제출이 아예 받아들여지지 않으며(FAQ 답변 1), 결과물이 **기계가 읽을 수 있는 공개 데이터**로 남는다. 그래서 E-01은 A-계열처럼 사인(私人)의 증명서를 신뢰할 필요가 없다 — **연방정부가 운영하는 공적 등록부를 대조하면 된다.** 이것이 E-01을 Pattern B(증명서형)가 아니라 Pattern A(기계 판정형)로 분류하는 근거다(§8.1).

다만 실무적 유보가 하나 있다. 온체인 컨트랙트는 EDGAR를 직접 조회할 수 없다. 따라서 “공적 데이터”가 온체인에 도달하는 마지막 한 구간(oracle 또는 Manifest 주입)에서는 **신뢰 가정이 재도입된다.** E-01의 신뢰 구조는 “발행자의 자기주장”이 아니라 “**공적 사실의 온체인 전달 경로**”에 걸려 있다 — 성질이 다른 위험이며, 대응도 다르다(§8.2·§10·OD-E01-1).

(2)의 서명 요건은 §3.12의 Terms of Submission과 결합할 때 의미가 커진다 — 그 서명은 단순 확인이 아니라 **Rule 506(d) 미해당 certification**을 포함한다.

- **PASS/FAIL 반영**: 직접 — G2(진위)의 근거. 다만 E-01이 검증하는 “서명”은 Form D 자체의 서명이 아니라 **EDGAR 사실을 온체인에 전달한 attestation의 서명**이다(§4.2 책임경계). Form D 서명자의 권한 유무는 EDGAR 접수로 갈음하고 재검증하지 않는다.

- **ERC-3643 변환**: `formDAttestation { accessionNumber, cik, filingDate, dateOfFirstSale, items[], signer, sig, observedAt }`. `signer ∈ trustedFormDOracles`(Manifest 지정)이며, `accessionNumber`가 EDGAR 원본으로의 역추적 키다.

### 3.9 Rule 507 — 실격은 자동이 아니다: injunction 요건 (직접)

- **조항**: 17 C.F.R. §230.507 — eCFR 현행본 (54 FR 11374, 1989-03-20; 81 FR 83553, 2016-11-21 개정)

- **핵심 원문**: *Disqualifying provision relating to exemptions under §§ 230.504 and 230.506.* (a) No exemption under § 230.504 or § 230.506 shall be available for an issuer if such issuer, any of its predecessors or affiliates have been subject to any order, judgment, or decree of any court of competent jurisdiction temporarily, preliminary or permanently enjoining such person for failure to comply with § 230.503. (b) Paragraph (a) of this section shall not apply if the Commission determines, upon a showing of good cause, that it is not necessary under the circumstances that the exemption be denied.

- **한국어**: *§§ 230.504 및 230.506의 면제에 관한 실격 조항.* (a) issuer, 그 predecessors 또는 affiliates 중 어느 하나가 **§ 230.503의 불이행을 이유로** 관할권 있는 법원의 **잠정적·예비적 또는 영구적 유지명령(enjoining)**에 해당하는 order, judgment 또는 decree의 적용을 받은 적이 있는 경우, 그 issuer에게는 § 230.504 또는 § 230.506의 어떠한 면제도 available하지 아니한다. (b) Commission이 **good cause의 소명**에 따라 그 상황에서 면제를 부인할 필요가 없다고 판단하는 경우, 본조 (a)는 적용되지 아니한다.

- **쉬운 설명**: 이 조문은 널리 오독된다. **“Form D를 안 내면 Rule 507로 면제가 박탈된다”는 말은 틀렸다.** 조문의 방아쇠는 “Rule 503 불이행”이 아니라 “Rule 503 불이행을 이유로 **법원의 유지명령을 받았을 것**”이다. 즉 세 단계가 필요하다 — ① Rule 503 위반 → ② SEC가 법원에 제소하여 injunction 획득 → ③ 그 이후의 504·506 발행이 실격. 2024년 제재 3건은 모두 **행정절차(§8A cease-and-desist)**였고 법원 injunction이 아니었으므로, 그 자체로는 Rule 507을 발동시키지 않는다(§3.14 해설 3).

두 가지 더 짚는다. **첫째, 실격의 시간 방향이 미래다.** “No exemption … shall be available”은 이미 끝난 발행을 소급해 무너뜨리는 것이 아니라 **앞으로의** 발행을 막는다. **둘째, 전염된다.** 대상이 issuer뿐 아니라 “any of its predecessors or affiliates”다 — 계열사 하나의 injunction이 그룹 전체의 사모 조달을 끊을 수 있다. 그리고 (b)의 good cause 예외는 **Commission의 재량**이지 권리가 아니다.

“쉽게 말하면” — Rule 507은 즉시 발동하는 지뢰가 아니라, 법원 명령이라는 **신관(信管)이 꽂혀야** 터지는 폭탄이다. 확률은 낮지만 터지면 회사의 자본조달 능력 자체가 끊긴다. E-01이 방어하는 것은 이 낮은 확률의 치명적 결과다.

- **PASS/FAIL 반영**: 간접 △ — E-01은 Rule 507 해당성을 직접 판정하지 않는다(법원 명령의 존부는 E-03의 bad actor 조회 인프라와 같은 계열의 문제다 — §9). E-01은 **507의 전제인 Rule 503 위반이 발생·누적되지 않도록** 상류에서 막는다. 다만 발행자에게 이미 §230.503 관련 injunction이 있는 경우의 처리는 E-03과의 경계 문제로 남긴다(OD-E01-5).

- **ERC-3643 변환**: `issuerRule507Disqualified: bool`(Manifest, E-03 조회 결과와 병합). true이면 R1 Recipe 자체가 불성립이므로 E-01 이전에 차단된다.

### 3.10 Rule 508 — 경미한 일탈 구제와 “전 조항 준수” 의무 (보조)

- **조항**: 17 C.F.R. §230.508 — eCFR 현행본 (54 FR 11374, 1989-03-20; 57 FR 36473, 1992-08-13; 81 FR 83553, 2016-11-21 개정; 조회 2026-07-01 기준 본문)

- **핵심 원문**: *Insignificant deviations from a term, condition or requirement of Regulation D.* (a) A failure to comply with a term, condition or requirement of § 230.504 or § 230.506 will not result in the loss of the exemption from the requirements of section 5 of the Act for any offer or sale to a particular individual or entity, if the person relying on the exemption shows: (1) The failure to comply did not pertain to a term, condition or requirement directly intended to protect that particular individual or entity; and (2) The failure to comply was insignificant with respect to the offering as a whole, provided that any failure to comply with paragraph (c) of § 230.502, paragraph (b)(2) of § 230.504 and paragraph (b)(2)(i) of § 230.506 shall be deemed to be significant to the offering as a whole; and (3) A good faith and reasonable attempt was made to comply with all applicable terms, conditions and requirements of § 230.504 or § 230.506. (b) A transaction made in reliance on § 230.504 or § 230.506 shall comply with all applicable terms, conditions and requirements of Regulation D. Where an exemption is established only through reliance upon paragraph (a) of this section, the failure to comply shall nonetheless be actionable by the Commission under section 20 of the Act.

- **한국어**: *Regulation D의 term, condition 또는 requirement로부터의 경미한 일탈.* (a) § 230.504 또는 § 230.506의 term, condition 또는 requirement의 불이행은, 면제에 기대는 자가 다음을 소명하는 경우, 특정 개인 또는 법인에 대한 어떠한 offer or sale에 관하여도 법 제5조 요건으로부터의 면제 상실을 초래하지 아니한다: (1) 그 불이행이 **그 특정 개인 또는 법인을 직접 보호하기 위한** term, condition 또는 requirement에 관한 것이 아니었을 것; 그리고 (2) 그 불이행이 발행 전체에 비추어 **경미**하였을 것. 다만 § 230.502(c), § 230.504(b)(2) 및 **§ 230.506(b)(2)(i)**의 불이행은 발행 전체에 비추어 중대한 것으로 **간주**된다; 그리고 (3) § 230.504 또는 § 230.506의 모든 적용되는 terms, conditions and requirements를 준수하려는 **선의의 합리적 시도**가 있었을 것. (b) § 230.504 또는 § 230.506에 기대어 이루어진 거래는 Regulation D의 모든 적용되는 terms, conditions and requirements를 **준수해야 한다**. 면제가 오직 본조 (a)에 대한 의존을 통해서만 성립하는 경우, 그 불이행은 그럼에도 불구하고 법 **제20조**에 따라 Commission에 의해 **actionable**하다.

- **쉬운 설명**: 이 조문은 E-01에 두 가지를 알려주는데, 둘 다 “언뜻 이럴 것 같다”와 반대다.

**첫째, Rule 508(a)는 E-01의 근거가 아니다.** 508(a)는 “§ 230.504 또는 § 230.506의 term, condition or requirement”의 불이행을 다룬다. 그런데 §3.5에서 봤듯 Rule 503은 **애초에 506의 조건이 아니다.** 조건이 아닌 것을 어겼으니 508(a)의 구제를 논할 필요조차 없다 — Form D 미제출은 “경미한 일탈로 봐줘야 하는 흠”이 아니라 **면제 판정의 사정권 밖**이다. 실무 문헌이 종종 Form D 미제출을 508(a)의 “insignificant deviation” 틀로 설명하는데, 조문 경로가 어긋난 설명이다.

**둘째, 508(b) 전단이 오히려 E-01의 근거에 가깝다.** “A transaction … shall comply with **all applicable terms, conditions and requirements of Regulation D**” — 여기서 범위가 “§230.504 or §230.506”이 아니라 **“Regulation D”** 전체로 넓어진다. §230.503은 Regulation D의 일부이므로 이 문장의 사정권 안이다. 즉 508(b) 전단은 “면제 성립과 무관하게 Reg D 전 조항을 지켜야 한다”는 독립 의무를 선언하고, 508(b) 후단은 그 위반이 **§20에 따라 Commission이 제소할 수 있는 사안**임을 확인한다. §3.14의 Commission order가 말하는 “the failure to comply with the requirements of Rule 503 itself is a violation”이 조문상 어디에 앉는지가 여기서 보인다.

**참고 — 흔한 인용 오류**: 508(a)(2)의 중대 간주 목록을 “506(b)(2)(i) and (ii)”로 쓰는 문헌이 많으나, **현행 조문은 (b)(2)(i)만** 열거한다. 그리고 508(b) 후단의 제소 근거는 §8A가 아니라 **§20**이다. 두 지점 모두 verbatim 확인이 필요하다.

- **PASS/FAIL 반영**: 간접 △ — E-01의 게이트 조건이 아니다. 508(a)는 경로가 다르고, 508(b)는 “왜 Rule 503 위반이 독립 위법인가”의 조문상 뒷받침이다.

- **ERC-3643 변환**: 없음. §6.2의 “치유되지 않는 것과 치유되는 것”의 경계 서술에 반영된다.

### 3.11 Rule 500(b)·(c)·(d) — 주법 경고, 비배타적 선택, 발행자 전용 (보조)

- **조항**: 17 C.F.R. §230.500(b), (c), (d) — eCFR 현행본 (77 FR 18684, 2012-03-28; 78 FR 44804, 2013-07-24; 86 FR 3597, 2021-01-14 개정)

- **핵심 원문**: (b) Nothing in Regulation D obviates the need to comply with any applicable state law relating to the offer and sale of securities. Regulation D is intended to be a basic element in a uniform system of federal-state limited offering exemptions consistent with the provisions of sections 18 and 19(c) of the Act (15 U.S.C. 77r and 77(s)(c)). In those states that have adopted Regulation D, or any version of Regulation D, special attention should be directed to the applicable state laws and regulations, including those relating to registration of persons who receive remuneration in connection with the offer and sale of securities, to disqualification of issuers and other persons associated with offerings based on state administrative orders or judgments, and to **requirements for filings of notices of sales**. (c) Attempted compliance with any rule in Regulation D does not act as an exclusive election; the issuer can also claim the availability of any other applicable exemption. For instance, an issuer's failure to satisfy all the terms and conditions of rule 506(b) (§ 230.506(b)) shall not raise any presumption that the exemption provided by section 4(a)(2) of the Act (15 U.S.C. 77d(2)) is not available. (d) Regulation D is available only to the issuer of the securities and not to any affiliate of that issuer or to any other person for resales of the issuer's securities. …

- **한국어**: (b) Regulation D의 어떤 규정도 증권의 offer and sale에 관한 적용 가능한 **주법 준수의 필요를 배제하지 아니한다**. Regulation D는 법 제18조 및 제19(c)조와 부합하는 연방-주 통합 소액발행 면제 체계의 기본 요소로 의도된 것이다. Regulation D 또는 그 어떤 버전을 채택한 주에서는, 적용되는 주법·규정 — 증권의 offer and sale과 관련하여 보수를 받는 자의 등록, 주 행정명령·판결에 근거한 issuer 및 발행 관련자의 실격, 그리고 **notices of sales의 제출 요건**에 관한 것을 포함하여 — 에 특별한 주의를 기울여야 한다. (c) Regulation D의 어떤 규칙에 대한 준수 시도도 **배타적 선택으로 작용하지 아니한다**; issuer는 다른 적용 가능한 어떠한 면제의 availability도 주장할 수 있다. 예컨대 issuer가 rule 506(b)의 모든 terms and conditions를 충족하지 못했다는 사실은, 법 제4(a)(2)조의 면제가 available하지 않다는 어떠한 추정도 일으키지 아니한다. (d) Regulation D는 그 증권의 **issuer에게만** available하며, 그 issuer의 affiliate나 그 issuer 증권의 resales를 하는 다른 어떤 자에게도 available하지 아니하다. …

- **쉬운 설명**: 세 항이 각각 E-01의 다른 면에 닿는다.

**(b)** — SEC가 규칙 본문에서 직접 “**notices of sales의 제출 요건**”에 주의하라고 경고한다. 이것이 §3.13의 주(州) 라인이 이론이 아니라 실무임을 보여준다. 연방 Form D를 안 내면 주 신고의 기초 서류가 없어진다.

**(c)** — 탈출구 조항이다. 그러나 예시가 **506(b)**로 되어 있다는 점을 놓치면 안 된다. 506(b)는 일반청약권유 금지가 조건이므로, 506(b)에 실패한 발행은 여전히 §4(a)(2)의 “public offering 아님”을 주장할 여지가 남는다. **506(c)는 다르다.** 506(c)는 일반청약권유를 **전제**하는 경로이므로, 그 발행이 506(c)에서 이탈하면 §4(b)의 보호막(§3.3)도 함께 벗겨져 그냥 public offering이 된다. Commission이 Release 33-11347 ¶8에서 정확히 그렇게 논증했다(§3.14). **즉 (c)의 탈출구는 506(b)에는 열려 있고 506(c)에는 사실상 닫혀 있다.** Decipher의 자산은 506(c)이므로 닫힌 쪽이다.

**(d)** — 수범자 확인. Reg D는 발행자 전용이므로 Rule 503의 의무자도 발행자다. **E-01이 매도인(seller)을 보지 않는 이유**가 여기 있다 — 2차 거래의 매도인은 Reg D에 기대지 않으며(그쪽은 R2·C-00의 영역), Form D 의무도 없다.

- **PASS/FAIL 반영**: 간접 △ — 게이트 조건은 아니다. (c)는 §6.3의 “왜 이 게이트를 완화할 수 없는가”의 논거, (d)는 §8.4의 부착 범위(R1 발행 라인 한정) 논거다.

- **ERC-3643 변환**: `generalSolicitationUsed`(§3.3) + `stateNoticeFilings[]`(주별 신고 상태, Operator 대시보드 — §11).

### 3.12 Form D (17 C.F.R. §239.500) + Terms of Submission — E-01이 읽는 필드 (직접)

- **조항**: 17 C.F.R. §239.500 (Form D, notice of sales of securities under Regulation D and section 4(a)(5) of the Securities Act of 1933); Form D 서식 원본 SEC1972 (5/17), OMB Number 3235-0076 — ecfr.gov · sec.gov

- **핵심 원문(서식 표지·Item 6·7·Terms of Submission 발췌)**: Intentional misstatements or omissions of fact constitute federal criminal violations. See 18 U.S.C. 1001. / **Item 6. Federal Exemptions and Exclusions Claimed (Select all that apply)** … Rule 506(b) … Rule 506(c) … Securities Act Section 4(a)(5) … Section 3(c)(1) … Section 3(c)(7) … / **Item 7. Type of Filing** — New Notice OR Amendment; Date of First Sale in this Offering: OR First Sale Yet to Occur / **Terms of Submission.** In Submitting this notice, each issuer named above is: Notifying the SEC and/or each State in which this notice is filed of the offering of securities described and undertaking to furnish them, upon written request, in accordance with applicable law, the information furnished to offerees. Irrevocably appointing each of the Secretary of the SEC and the Securities Administrator or other legally designated officer of the State in which the issuer maintains its principal place of business and any State in which this notice is filed, as its agents for service of process … **Certifying that, if the issuer is claiming a Regulation D exemption for the offering, the issuer is not disqualified from relying on Rule 504 or Rule 506 for one of the reasons stated in Rule 504(b)(3) or Rule 506(d).**

- **한국어(발췌)**: 사실의 **고의적 허위기재 또는 누락은 연방 형사범죄**를 구성한다. 18 U.S.C. 1001 참조. / **Item 6. 주장하는 연방 면제 및 적용제외 (해당되는 것을 모두 선택)** … Rule 506(b) … Rule 506(c) … 증권법 제4(a)(5)조 … 제3(c)(1)조 … **제3(c)(7)조** … / **Item 7. 제출 유형** — 신규 통지 또는 수정; 이 발행에서의 **최초 매도일**: 또는 최초 매도 미발생 / **제출의 조건.** 이 통지를 제출함으로써 위에 기재된 각 issuer는: 기재된 증권 발행에 관하여 SEC 및/또는 이 통지가 제출되는 각 주에 통지하고, 적용 법률에 따라 서면 요청이 있는 경우 offerees에게 제공된 정보를 그들에게 제공할 것을 약속하며; SEC 사무국장과 issuer가 주된 영업소를 두는 주 및 이 통지가 제출되는 각 주의 증권감독관 또는 기타 법정 지정 공무원 각각을 **철회 불가능하게 송달대리인으로 선임**하며; **issuer가 그 발행에 관하여 Regulation D 면제를 주장하는 경우, 그 issuer는 Rule 504(b)(3) 또는 Rule 506(d)에 규정된 사유 중 어느 하나로 인하여 Rule 504 또는 Rule 506에 기대는 것이 실격되지 아니함을 확인(certifying)**한다.

- **쉬운 설명**: Form D는 16개 Item으로 이루어지며, 그중 E-01이 실제로 읽는 것은 소수다.

| Item | 내용 | E-01의 사용 |
| --- | --- | --- |
| 1 | Issuer's Identity (명칭·설립지·유형) | 발행자 동일성 보조 (CIK가 주 키) |
| 4 | Industry Group (Pooled Investment Fund → Other Investment Fund + 등록투자회사 여부) | R3 정합 보조 |
| **6** | **Federal Exemptions and Exclusions Claimed** | **G4 정합 게이트의 대조 대상 (핵심)** |
| **7** | **Type of Filing + Date of First Sale** | **G6 적시성의 기산점 (핵심)** |
| 8 | Duration of Offering (1년 초과 의도?) | 연차 수정 필요성 예측 (G5 보조) |
| 9 | Type(s) of Securities Offered (Pooled Investment Fund Interests 등) | B-02·B-03 정합 보조 |
| 12 | Sales Compensation + **States of Solicitation** | 주 신고 대상 주 목록 (§11 Operator) |
| 13 | Offering and Sales Amounts (Indefinite 가능) | 참고 |
| 14 | Investors (비적격투자자 수 / 총 투자자 수) | A-03·D-01과 대조 가능 (참고, 게이트 아님) |

**Item 6이 왜 게이트인가**: “Select all that apply”이므로 발행자는 여러 면제를 동시에 주장할 수 있다. BUIDL이 Rule 506(c)와 Section 3(c)(7)을 함께 체크한 것이 그 예다(§3.0.1). Manifest가 `issuanceFramework=RegD506c`이고 R3가 활성인데 Form D의 Item 6에 506(c)나 3(c)(7)이 없다면, **우리 시스템의 법적 자기서술과 발행자의 공적 신고가 어긋난 것**이다. 이 불일치는 B-01(manifest 정합)이 아니라 E-01이 잡는다 — B-01은 Manifest ↔ 온체인 설정의 일치를 보증하고, E-01은 Manifest ↔ **공적 신고**의 일치를 본다(§9).

**Terms of Submission의 세 번째 항이 결정적이다**: Form D 서명은 단순 제출 행위가 아니라 **Rule 506(d)(bad actor) 미해당의 적극적 확인**이다. 그리고 표지의 18 U.S.C. 1001 경고가 그 확인에 형사책임을 붙인다. **즉 유효한 Form D의 존재는 그 자체로 E-03(bad actor 차단)에 대한 발행자의 서명된 진술이 존재한다는 뜻이다.** E-01과 E-03이 같은 R1 전용 부품이면서 서로 다른 층에서 만나는 지점이다(§9).

두 번째 항(송달대리인 철회불가 선임)도 실무상 중요하다 — Form D 제출은 주 감독관에게 **관할권을 부여하는 행위**를 포함한다. 이것이 §3.13의 주 정지권이 작동할 수 있는 절차적 기반이다.

- **PASS/FAIL 반영**: 직접 ⭐ — G3(동일성: `cik`)와 G4(정합: `items[]`)의 근거. Item 6 불일치 → `FORMD_EXEMPTION_MISMATCH`(차단).

- **ERC-3643 변환**: `formDAttestation.items: bytes32[]` — enum `{RULE_504B1, RULE_504B1_I, RULE_504B1_II, RULE_504B1_III, RULE_506B, RULE_506C, SEC_4A5, SEC_3C1, …, SEC_3C7, …}`. G4 판정: `items ∋ RULE_506C` ∧ (R3 활성 → `items ∋ SEC_3C7`).

### 3.13 증권법 §18(b)(4)(F)·(c)(2)(A)·(c)(3) — 주(州) 통지신고와 정지권 (핵심)

- **조항**: Securities Act of 1933 §18, 15 U.S.C. §77r(b)(4)(F), (c)(2)(A), (c)(3) — uscode.house.gov (2026-05-27 현재). 1996년 NSMIA(Pub. L. 104-290 §102(a)) 신설, 2015년 FAST Act(Pub. L. 114-94 §76001(b))로 (b)(4) 항 재지정.

- **핵심 원문**: **(b)(4)** *Exemption in connection with certain exempt offerings.* A security is a covered security with respect to a transaction that is exempt from registration under this subchapter pursuant to— … **(F) Commission rules or regulations issued under section 77d(2) of this title, except that this subparagraph does not prohibit a State from imposing notice filing requirements that are substantially similar to those required by rule or regulation under section 77d(2) of this title that are in effect on September 1, 1996; or** … / **(c)(2)(A)** *Notice filings permitted.* Nothing in this section prohibits the securities commission (or any agency or office performing like functions) of any State from requiring the filing of any document filed with the Commission pursuant to this subchapter, together with annual or periodic reports of the value of securities sold or offered to be sold to persons located in the State (if such sales data is not included in documents filed with the Commission), solely for notice purposes and the assessment of any fee, together with a consent to service of process and any required fee. / **(c)(3)** *Enforcement of requirements.* Nothing in this section shall prohibit the securities commission (or any agency or office performing like functions) of any State from suspending the offer or sale of securities within such State as a result of the failure to submit any filing or fee required under law and permitted under this section.

- **한국어**: **(b)(4)** *특정 면제발행 관련 적용제외.* 어느 증권은 본 편에 따라 등록이 면제되는 거래에 관하여 다음에 의할 때 covered security에 해당한다 — … **(F) 제77d(2)조[§4(a)(2)] 하에서 발령된 Commission의 rules or regulations. 다만 본 호는, 1996년 9월 1일 시점에 시행 중인 제77d(2)조 하의 rule or regulation이 요구하는 것과 실질적으로 유사한(substantially similar) notice filing 요건을 주가 부과하는 것을 금지하지 아니한다;** … / **(c)(2)(A)** *통지신고 허용.* 본조의 어떤 규정도, 주의 증권감독위원회가 — 오직 **통지 목적 및 수수료 부과를 위하여** — 본 편에 따라 Commission에 제출된 문서의 제출을, 그 주에 소재한 자에게 매도되었거나 매도될 증권 가액의 연차 또는 정기 보고서(그 판매 자료가 Commission에 제출된 문서에 포함되지 않은 경우)와 함께, 송달동의 및 요구되는 수수료와 함께 요구하는 것을 금지하지 아니한다. / **(c)(3)** *요건의 집행.* 본조의 어떤 규정도, 주의 증권감독위원회가 **법이 요구하고 본조가 허용하는 어떠한 filing 또는 fee의 미제출을 이유로** 그 주 내에서의 증권의 **offer or sale을 정지하는 것을 금지하지 아니한다**.

- **쉬운 설명**: 이 세 조문이 함께 만드는 구조가 E-01의 실무적 존재 이유다.

**① 선점**: (b)(4)(F)에 의해 Rule 506 증권은 covered security가 되고, 주는 등록·심사를 요구할 수 없다. 여기서 “Commission rules or regulations issued under section 77d(2)”라는 문언이 중요하다 — 506(c)가 일반청약권유를 허용함에도 여전히 §4(2) 하의 규칙으로 남는 이유는 JOBS Act §201(a)(1) 후단이 그렇게 못 박았기 때문이다(§3.3). **그 한 문장이 없었으면 506(c) 증권은 covered security가 아니었다.**

**② 그러나 단서가 통지신고를 남겼다**: (b)(4)(F)의 “except that this subparagraph does not prohibit a State from imposing notice filing requirements that are substantially similar to those required by rule or regulation under section 77d(2) … in effect on September 1, 1996.” 1996년 9월 1일 시점의 §4(2) 하 규칙이 요구하던 notice filing — 그것이 바로 **당시의 Rule 503(Form D 제출)**이다. 즉 이 단서는 **주가 “Form D와 실질적으로 유사한 것”을 요구할 권한을 명문으로 보존**한다. (c)(2)(A)가 이를 재확인한다 — 주는 “SEC에 제출된 문서”를 통지 목적으로 요구할 수 있고, 실무상 그 문서가 Form D 사본이다.

**③ 그리고 (c)(3)이 이빨을 준다**: 주는 filing이나 fee의 미제출을 이유로 **그 주 안에서의 offer or sale을 정지**할 수 있다. 주의하라 — 이것은 “등록을 요구한다”가 아니라 “**거래를 멈춘다**”이다. NSMIA가 주에서 빼앗은 것은 심사권이지 집행권이 아니다.

**결론이 반직관적이다**: Form D 미제출은 **연방 면제를 깨지 않는다**(§3.5). 그런데 **주는 그 주 안에서 판매를 정지시킬 수 있다.** “면제는 살아 있는데 거래가 멈춘다” — 발행자에게는 실질적으로 같은 결과다. 그리고 우리 시스템처럼 **국경 없이 유통되는 온체인 자산**에서 “특정 주에서만 정지”는 기술적으로 매우 다루기 어려운 상태다(A-02의 관할 필터와 결합해야 한다 — §9·OD-E01-3).

“쉽게 말하면” — 연방은 “문은 안 잠근다, 대신 벌금을 물린다”이고, 주는 “우리 동네에서는 아예 못 팔게 하겠다”다. 후자가 더 즉각적이다.

- **PASS/FAIL 반영**: 직접 ⭐ — E-01 게이트의 **정당화 근거**다. §3.5가 “법이 요구하는 게이트가 아님”을 확정했다면, §3.13은 “그럼에도 게이트를 세워야 하는 이유”를 준다. 다만 주별 정지 상태 자체의 판정은 E-01의 범위 밖이며(Operator 대시보드 + A-02 연계), E-01은 그 선행 원인인 Form D 미제출을 막는다.

- **ERC-3643 변환**: `stateNoticeFilings[state] = { filed: bool, feePaid: bool, suspended: bool }` (Manifest/Operator). `suspended == true`인 주가 있으면 A-02의 `allowedJurisdictions`에서 해당 주를 제외하는 것이 정합적 처리다(OD-E01-3).

### 3.14 Release No. 33-11347 (2024-12-20) — Commission의 이중 명제 (핵심 Layer 3)

- **조항**: *In the Matter of Pipe Technologies Inc.*, Securities Act of 1933 Release No. 11347, Administrative Proceeding File No. 3-22377 (Dec. 20, 2024) — Order Instituting Cease-and-Desist Proceedings, Pursuant to Section 8A of the Securities Act of 1933, Making Findings, and Imposing a Cease-and-Desist Order — sec.gov. 동일자 관련: SEC Press Release 2024-210 (3건 동시 제재).

- **핵심 원문**: **¶6** — Under Rule 503 of Regulation D, an issuer offering or selling securities in reliance on Rule 504 or 506 must file a notice of sales on Form D with the Commission for each new offering of securities no later than 15 calendar days after the first sale of securities in the offering. **While a failure to provide such notice does not result in a loss of the exemption from Section 5, the failure to comply with the requirements of Rule 503 itself is a violation of the Securities Act and rules promulgated thereunder.** / **¶8** — Because Respondent engaged in general solicitation, the offerings could not have been conducted as exempt offerings under Section 4(a)(2) of the Securities Act and therefore could not have been conducted without reliance on Rule 504 or Rule 506(c) of Regulation D. Accordingly, Respondent needed to file a Form D for each offering, but Respondent failed to timely file Forms D for all of these offerings. / **¶3(발췌)** — When an issuer does not follow the requirements to file a Form D (or amend its existing Form D filing) it has multiple negative effects. … / **IV.A** — Pursuant to Section 8A of the Securities Act, Respondent cease and desist from committing or causing any violations and any future violations of Rule 503 of Regulation D of the Securities Act.

- **한국어**: **¶6** — Regulation D의 Rule 503에 따라, Rule 504 또는 506에 기대어 증권을 offering 또는 selling하는 issuer는 각 새로운 발행마다 그 발행에서의 최초 매도 후 15역일을 넘기지 않고 Form D에 의한 notice of sales를 Commission에 제출해야 한다. **그러한 통지의 불이행이 제5조로부터의 면제 상실을 초래하지는 않지만, Rule 503의 요건 불이행 그 자체는 증권법 및 그에 따라 제정된 규칙들의 위반이다.** / **¶8** — Respondent가 general solicitation에 관여했기 때문에, 그 발행들은 증권법 제4(a)(2)조에 따른 면제발행으로 이루어질 수 없었고 따라서 Regulation D의 Rule 504 또는 Rule 506(c)에 대한 의존 없이는 이루어질 수 없었다. 따라서 Respondent는 각 발행에 대해 Form D를 제출해야 했으나, 이 모든 발행에 대해 Forms D를 적시에 제출하지 못했다. / **IV.A** — 증권법 제8A조에 따라, Respondent는 증권법 Regulation D의 Rule 503의 어떠한 위반 및 장래의 어떠한 위반도 범하거나 야기하는 것을 중지하고 삼갈 것을 명한다.

- **쉬운 설명**: 이 문서 전체에서 가장 무거운 인용이다. 이유가 셋이다.

**해설 1 — Commission 자신의 진술이다.** SEC의 해석은 여러 층위로 나온다. staff의 C&DI나 FAQ는 “Division의 견해이며 법적 효력이 없다”는 면책이 붙는다(§3.15). 그러나 이것은 **Commission이 발한 order**다 — 위원회 자신이 의결한 문서이고, 면책 문구가 없다. “면제는 유지된다 **∧** Rule 503 위반은 성립한다”는 이중 명제가 이보다 강한 권위로 확인된 예는 없다.

**해설 2 — ¶8이 506(c)의 탈출구를 봉쇄한다.** Commission의 논증 순서를 그대로 따라가 보면: 일반청약권유를 했다 → 그러므로 §4(a)(2)로는 애초에 불가능했다 → 그러므로 Rule 504나 506(c)에 의존할 수밖에 없었다 → **그러므로 Form D 의무가 발생했다.** 이 사슬은 Rule 500(c)의 “비배타적 선택”이 506(c) 발행에서 작동하지 않음을 Commission이 실제 사건에서 적용한 것이다(§3.11 해설). **Decipher의 자산은 설계상 일반청약권유를 전제하므로, 이 사슬이 그대로 적용된다.**


[output truncated at 50000 of 98592 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007783
- Available tabs:
  • tabId 437007716: "(1) 7/15 | Notion" (https://app.notion.com/p/deciphersnu/7-15-3a0dff004c8980fe857bd4158b970eab)
  • tabId 437007775: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_보유기간.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_보유기간.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/9a48abef-135b-4c26-9a93-f37cde6e95eb/C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md?table=block&id=3a4dff00-4c89-80e2-8ec4-cc568055656c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=AY0lG0OyMgQQfhbNQfv8j3rKgvDSFIxAbewipoAcOc0&downloadName=C-01_%E1%84%87%E1%85%A9%E1%84%8B%E1%85%B2%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md)
  • tabId 437007778: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_국가거주제한.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_국가거주제한.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/44cb0c3e-0ae2-4086-9692-f376fa1e412d/A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80af-bcc4-f13938fe02d1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=QJagHK9XceJG2PMkC3rmR6bEmsmmoT5j4Dw_aBXuVQw&downloadName=A-02_%E1%84%80%E1%85%AE%E1%86%A8%E1%84%80%E1%85%A1%E1%84%80%E1%85%A5%E1%84%8C%E1%85%AE%E1%84%8C%E1%85%A6%E1%84%92%E1%85%A1%E1%86%AB.md)
  • tabId 437007781: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_법리검증기준서_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_법리검증기준서_v1+%281%29.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/33c64232-39cc-488d-83d7-a39ad9feefce/A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1_(1).md?table=block&id=3a4dff00-4c89-804e-84e6-da3984af99c8&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=b4tRdFbb7DLorz2-eG0X6MTX76nHZ6_lIuiLGt21Amc&downloadName=A-06_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%85%E1%85%B5%E1%84%80%E1%85%A5%E1%86%B7%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%80%E1%85%B5%E1%84%8C%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5_v1+%281%29.md)
  • tabId 437007782: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_모름항변차단.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_모름항변차단.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ade38c9a-ce84-4b84-aa27-91edc237a754/A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md?table=block&id=3a5dff00-4c89-80e8-8524-da603109dd58&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=u1nHuNkhQ5QmWJ5nUdDJ0CVvE5wciLF1s3CS92vBu_8&downloadName=A-12_%E1%84%86%E1%85%A9%E1%84%85%E1%85%B3%E1%86%B7%E1%84%92%E1%85%A1%E1%86%BC%E1%84%87%E1%85%A7%E1%86%AB%E1%84%8E%E1%85%A1%E1%84%83%E1%85%A1%E1%86%AB.md)
  • tabId 437007783: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD확인.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD확인.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/21ccdd0a-9027-44bd-a8c7-829673cffd3f/E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md?table=block&id=3a4dff00-4c89-80c1-9d9f-fe0d327ed295&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=SALjKL_3ScNyMgrW3R0IMonDmV2BM0KeSzndBWu-2SY&downloadName=E-01_FormD%E1%84%92%E1%85%AA%E1%86%A8%E1%84%8B%E1%85%B5%E1%86%AB.md)
  • tabId 437007784: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/544d2676-445b-4bdb-a452-20c1681d8299/E-03_bad-actor.md?table=block&id=3a4dff00-4c89-80f9-961f-f7cb3d76a74e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Epf-VGxVflPxdrQZkyg0qEYN7wPkNrov3Nq-U8_wdyg&downloadName=E-03_bad-actor.md)
  • tabId 437007785: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5c92bb6a-033a-43ec-90c1-a16ff623b600/F-01_operator-self-dealing.md?table=block&id=3a4dff00-4c89-80dd-9ecf-fef84b68b207&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=9UqQL7XXnpoiB1FVdChUEiu1kSw0Y-zLNs8hZCExy8g&downloadName=F-01_operator-self-dealing.md)
  • tabId 437007786: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/143e6081-9365-43ea-9e5c-717b58f76ca5/F-02_market-surveillance.md?table=block&id=3a4dff00-4c89-80ac-a2ab-e569f170fcb1&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=l0FsVhtHxOVI3fAepvGKpDQGg7Z05wvshiuT11XjR9I&downloadName=F-02_market-surveillance.md)
  • tabId 437007787: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/304d28b0-4a62-4bed-a878-7ef9c5c27d42/F-03_suspicious-activity-monitoring.md?table=block&id=3a4dff00-4c89-802b-bcb9-e5d3ca2a5252&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=Z_OvMDEYu9El18YazUH25PaqMNO9pMuFfVldKrBtZRc&downloadName=F-03_suspicious-activity-monitoring.md)
  • tabId 437007788: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/5353e81e-96a2-4d4b-a965-fb4cafccc156/F-04_no-purchase-during-distribution.md?table=block&id=3a4dff00-4c89-80f8-af9f-cc7028cb641d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=J2D6J2JjovGrC18Rlg9blfXeyYYrthiwuJqBAzGUkBM&downloadName=F-04_no-purchase-during-distribution.md" (
