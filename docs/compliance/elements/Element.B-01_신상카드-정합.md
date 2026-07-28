# B-01 신상카드 정합 (Manifest Integrity) — 부품 심층 인수인계 문서 (Walkthrough)

**이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 신상카드 정합 부품(내부 식별자 B-01)을, 미국 증권법을 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 — (1) 이 부품이 지키는 규제 원리가 어디서 왔고 왜 존재하는지, (2) 어떤 사실을 입력받아 (3) 어떤 로직으로 판정하고 (4) 실패하면 어떻게 처리하며 (5) 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.

**자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서·판례 등 외부 공식 자료만 사용한다.

**⚠ 출처·정정 노트 (읽기 전 필독).** 본 부품의 인용은 다음 1차 출처를 기준으로 한다 — 15 U.S.C. §77e(1933년 증권법 §5)·§77*l*(a)(1)(§12(a)(1))·§77q(a)(§17(a))·§80a-3(c)(7)(투자회사법)·§78q(a)(1)(1934년 증권거래소법 §17(a)(1))은 uscode.house.gov 현행본, 17 C.F.R. §240.17a-4(브로커-딜러 기록 보존)·§240.10b-5·§242.301·§242.302·§242.303(Regulation ATS)은 eCFR 현행본(Title 17, 2026-07-01 기준), SEC Release No. 34-96034(2022 전자기록 개정, 87 FR 66412)는 sec.gov, SEC v. Ralston Purina Co., 346 U.S. 119 (1953)는 govinfo.gov(U.S. Reports)다. 특히 헷갈리기 쉬운 정정 포인트는 다음과 같다(상세는 부록 C).

- **B-01은 어느 한 조문의 요건을 판정하는 부품이 아니다.** A-13이 §2(a)(51)를, D-01이 §12(g)를 직접 구현하는 것과 달리, B-01이 지키는 것은 조문 하나가 아니라 **모든 조문 판정의 공통 전제** — "판정에 쓰이는 사실이 승인된 진본이고, 자기모순이 없고, 최신인가"다. 미국 증권법의 모든 면제는 사실(fact)에 달려 있고(§3.1~§3.4), 그 사실을 잘못 기록한 채 도는 컴플라이언스 시스템은 '준수처럼 보이는 위반'을 양산한다. B-01의 법적 근거는 그래서 요건 조문이 아니라 ① 사실 오류의 무과실 책임 구조(§5·§12(a)(1)·Ralston Purina), ② 기록의 규제 지위(§17(a)(1)·17a-4·Reg ATS 302/303), ③ 변경 규율의 규제 원형(Rule 301(b)(2)), ④ 허위 사실의 책임(§17(a)·10b-5)의 네 다발이다.

- **정합(consistency)과 진실(truth)은 다르다.** B-01이 판정하는 것은 "신상카드가 승인된 버전이고, 온·오프체인이 일치하고, 카드 안에 모순이 없고, 만료성 사실이 신선한가"(정합)이지, "카드에 적힌 내용이 세상의 진실인가"(진실)가 아니다. 진실성은 온보딩 심사(Operator)와 발행자의 사실 진실성 보증, 그리고 반대정보 채널(A-12)이 맡는다. 이 구분을 지우면 B-01에 불가능한 책임(오프체인 세계의 진위 판정)이 얹힌다.

- **부착은 Recipe, 실행은 최우선.** 부착 매트릭스상 B-01은 R1(발행)·R2(재판매)·R3(펀드) 세 자산 Recipe 모두에 필수(●) 부착되는 유일한 자산 메타 부품이다. 그러나 실행 의미론상 B-01의 검사 대상(Manifest)은 곧 Recipe 해석의 입력이므로, Router가 만드는 Element union에서 B-01은 항상 포함되고 **가장 먼저** 실행되어야 한다 — 카드가 오염된 채 다른 부품이 돌면 그 판정 전부가 오염된 사실 위에 선다(§5.2·§8.4).

- **A-01·A-02 같은 글로벌 게이트는 아니다.** A-01(OFAC)·A-02(국가)는 거래 상대방의 속성을 보는 transaction-level 글로벌 게이트로 Recipe 해석 전에 돈다. B-01은 자산의 속성(신상카드)을 보는 Recipe 부착 부품이다 — 다만 위 항목대로 union 내 실행 순서가 최우선일 뿐이다.

- **per-tx 게이트와 hash 대사는 다른 채널이다.** 온체인 hot path는 ManifestCore struct의 SLOAD로 끝나야 하므로(온오프체인 하이브리드 원칙), off-chain 전문(full manifest)의 해시 재계산을 매 거래마다 온체인에서 돌리지 않는다. B-01은 2채널로 작동한다 — 채널 1(per-tx 게이트)은 존재·상태·버전·불변식·신선도를 결정론적으로 검사하고, 채널 2(상시 대사 watcher)는 hot path 밖에서 온체인 앵커(fullManifestHash)와 off-chain 전문을 대사해 불일치 시 자산을 SUSPENDED로 전환한다. 채널 2의 결과는 채널 1이 ②단계(상태)에서 읽는다(§5·§8.3).

- **신선도 부등호.** 만료성 사실은 now − asOf **≤** maxAge이면 유효(이하 허용), **>** maxAge이면 FAIL(초과 탈락)이다. time-lock은 now **≥** approvedAt + delay이면 발효(이상)다. 두 부등호의 방향이 다르므로 경계값 테스트를 분리한다(§5.3·§7).

- **A-13 §9.5 표현과의 관계.** A-13 문서 §9.5는 B-01을 "체결 직후(post-trade) R3 부품 결과의 모순을 재검증"하는 것으로 서술한다. 전체 부착 매트릭스와 본 문서의 확정 분류는 pre-trade STATELESS 기계 판정이며, A-13이 말한 사후 교차검증은 Element 본체가 아니라 동일 규칙집합을 소비하는 Operator 감사 채널(채널 2의 확장)로 정리한다. 두 서술은 모순이 아니라 시점이 다른 두 소비처다 — 문서 간 표현 통일은 OD-B01-3.

**양식 메모.** 이 문서는 A-13 v1 인수인계 양식의 번호·헤더·서술 관습을 따른다. 다만 A-13이 증명서 확인형(Pattern B) 부품인 데 반해 B-01은 기계 판정형(Pattern A) 부품이다 — off-chain 판단의 서명 증명서를 확인하는 것이 아니라, 해시·서명·버전·불변식이라는 결정론적 성질을 계산으로 확인한다. 그래서 §8은 증명서 패턴이 아니라 기계 판정 패턴(+2채널 구조)을, ERC-3643 변환은 claim topic이 아니라 Router·ManifestCore·거버넌스 컨트랙트를 다룬다(claim.basis enum은 B-01에 해당 없음 — 상세 §8·§3.20).

## §1. 규제 맥락 — 이 부품이 지키는 원리는 어디서 왔는가 (Context First)

**왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 "**이 자산의 신상카드(Manifest)가 진본이고, 승인됐고, 자기모순이 없고, 최신인가**"를 거래 직전에 판정한다. 얼핏 순수 기술 검사처럼 보이지만, 이 검사가 없으면 나머지 26개 부품의 법적 판정 전부가 모래 위에 선다. 그 이유는 미국 증권법의 구조 자체에 있다 — 등록의무가 기본값이고 면제는 전부 사실에 달려 있으며, 그 사실을 주장하는 쪽이 입증책임을 진다. 이 절은 그 구조를 먼저 깐다.

### 1.1 미국 증권규제의 기본 문법 — "등록이 원칙, 면제는 사실"

미국 연방 증권규제의 출발점은 1933년 증권법 §5다. 등록신고서 없이 증권을 팔면 그 자체로 위법이고, 고의·과실을 묻지 않는다(무과실, §3.1). 여기서 벗어나는 길은 면제(exemption)뿐인데, 모든 면제는 조건부다 — Reg D 506(c)는 "매수인 전원이 accredited investor일 것", ICA §3(c)(7)은 "보유자 전원이 취득 시점에 qualified purchaser일 것 + 공모하지 않을 것", Rule 144는 "보유기간·물량·방식 조건을 전부 충족할 것"을 요구한다. 조건은 전부 **사실 명제**다: "이 자산은 §3(c)(7) 펀드다", "이 발행은 506(c)다", "지금 판매 중이다", "발행주식총수는 N이다".

그리고 그 사실이 틀렸을 때 벌어지는 일이 이 부품의 존재 이유다. 사실이 하나라도 틀리면 면제 조건 판정 자체가 잘못된 대상을 향하고, 면제가 성립하지 않으면 기본값인 §5 위반으로 되돌아간다. §12(a)(1)은 그 위반에 대해 매수인에게 무조건 해제권(rescission)을 준다 — 파는 쪽의 선의·주의는 항변이 되지 않는다(§3.2). 게다가 SEC v. Ralston Purina(1953)가 확립했듯, 면제를 주장하는 쪽이 그 성립을 입증해야 한다(§3.3). 요컨대 이 시장에서 "사실"은 (a) 틀리면 무과실로 책임지고, (b) 맞다는 것을 스스로 증명해야 하는 대상이다.

**쉽게 말하면:** 한국 상장 심사에서 상장 신청 서류의 기재가 틀리면 심사 통과 자체가 무효가 되는 것과 같은 구조가, 미국 사모 시장에서는 거래 한 건 한 건에 걸려 있다. 서류(사실)가 곧 적법성의 토대이고, 서류가 틀리면 그 위의 모든 절차가 무너진다.

### 1.2 Decipher에서 그 "사실"은 어디에 사는가 — Manifest(신상카드)

Decipher의 4-Layer 아키텍처(Element / Recipe / Manifest / Operator)에서 위 사실 명제들이 사는 곳이 Manifest, 곧 자산별 신상카드다. 신상카드는 상장 심사 서류의 코드판이다 — fundForm: ICA-3c7(이 선언이 QP 검사 A-13과 보유자 수 카운터 D-01을 자동으로 켠다), issuanceExemption: RegD-506c(발행 Recipe R1 연결), distributionStatus(판매 중 여부 — F-04 발행자 매수 금지 검사용), restrictedParties(매수 금지 명단), 12gThresholds(보유자 수 경보 기준), enabledResalePaths(허용 재판매 경로 — C-00 분기), supportedEngines(B-04) 같은 값이 담긴다.

구현상 신상카드는 온오프체인 하이브리드다. 온체인에는 경량 core(ManifestCore struct — Recipe ID들·facts 비트필드·**fullManifestHash**)만 두어 hot path가 SLOAD 몇 번으로 끝나게 하고, 무거운 전문(override 근거·법률 문서·거버넌스 설정)은 off-chain에 두되 그 해시를 온체인에 앵커한다. 매 거래에서 Router는 이 core를 읽어 "어느 Recipe들이 붙는가"를 해석하고, 활성화된 Recipe들의 Element를 합쳐(cumulative AND) 일괄 검사한다.

여기서 구조적 급소가 드러난다. **Manifest는 다른 모든 부품의 입력이면서, 동시에 어느 부품이 돌지를 결정하는 해석 기준 자체다.** 카드의 fundForm이 조작되거나 누락되면 A-13·D-01이 아예 부착되지 않은 채 거래가 통과할 수 있다 — "검사가 틀리는" 것이 아니라 "검사가 안 도는" 실패다. 카드의 outstandingUnits가 낡은 값이면 C-08의 1% cap 분모가 틀어진다. 카드가 승인 절차를 우회해 수정됐다면 그 뒤의 모든 PASS 기록은 규제 방어 자산이 아니라 오염된 기록이다. B-01은 이 급소를 지키는 부품이다.

### 1.3 왜 별도 부품인가 — 기록·변경·책임의 세 갈래 규제

"카드가 맞는지 확인한다"를 굳이 법률 부품으로 승격하는 이유는, 미국 규제가 이 확인 행위 자체를 세 갈래로 규율하기 때문이다.

첫째, **기록 갈래.** 거래 venue(브로커-딜러·ATS)는 자기 영업에 관한 기록을 만들고 정확히 보존할 제정법상 의무를 진다(Exchange Act §17(a)(1), §3.5). 신상카드는 "이 자산이 이 venue에서 어떤 법적 전제로 거래되는가"를 정의하는 문서이므로 그 의무의 정중앙에 있다. 특히 Rule 17a-4(e)(7)은 compliance manual을 **updates·modifications·revisions까지 포함해** 사용 종료 후 3년까지 보존하라고 명령하는데(§3.6), Manifest + Recipe 레지스트리는 정확히 "기계가독 compliance manual"이다 — 버전 이력 보존은 선택이 아니라 규칙 문언이다. 전자기록이라면 Rule 17a-4(f)가 무결성 방식까지 지정한다: WORM(다시 쓸 수 없는 매체) 또는 **audit-trail**(모든 수정·삭제를 time-stamp와 행위자와 함께 남겨 원본 재구성이 가능한 시스템, 2022년 신설, §3.7~§3.8). 온체인 hash 앵커 + 서명된 버전 이력은 이 audit-trail 요건의 자연스러운 구현이다.

둘째, **변경 갈래.** Reg ATS Rule 301(b)(2)는 ATS 운영 방식의 중대 변경(material change)을 시행 최소 20일 전에 Form ATS amendment로 신고하고, 기재가 부정확해지면 정정 amendment를 내도록 강제하며, 그 신고를 Exchange Act상 "report"로 지위 부여해 허위 기재에 형사 책임까지 연결한다(§3.9). "규칙 문서를 아무 때나 조용히 바꿀 수 없고, 사전에·기록을 남기며·정정 의무와 함께 바꿔야 한다"는 규제 문법 — Decipher의 Manifest 버전 규율(다중서명 + time-lock + 강화 방향 override만 허용 + 정정 버전)은 이 문법의 시스템 내재화다.

셋째, **책임 갈래.** venue가 참가자들에게 사실상 표시하는 자산 정보(신상카드가 선언하는 면제 구조·거래 조건)가 허위이면, 증권의 offer·sale에서의 중대 사실 허위 진술(Securities Act §17(a), §3.11)과 시장 사기 일반 조항(Rule 10b-5, §3.12)의 사정권에 들어간다. §17(a)(2)·(3)은 고의(scienter) 없이 과실만으로도 SEC 집행이 가능하다는 점에서, "몰랐다"는 방어가 아니다 — 틀린 카드로 시스템을 돌리는 것 자체가 위험이다.

이 세 갈래가 합쳐지면 결론은 하나다: 신상카드의 무결성 확인은 사람이 가끔 하는 점검이 아니라, **거래마다 기계가 강제하고 그 이력이 규제 양식으로 남는 상시 게이트**여야 한다. 그것이 B-01이다.

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk의 증폭기 차단

개별 부품의 실패는 국지적이다 — A-13이 오작동하면 무자격자 한 명이 들어온다. B-01의 실패는 전역적이다 — 카드가 오염되면 그 자산의 **모든 거래에서 모든 부품이** 잘못된 전제로 돈다. §3(c)(7) 선언이 빠진 카드는 QP 검사 없는 펀드 거래를, 낡은 분모는 내부자 물량 초과를, 우회 수정된 restrictedParties는 Reg M 위반 매수를 조용히 통과시킨다. 더 나쁜 것은 기록이다: 시스템은 매 거래에서 "검사 통과"를 남기므로, 오염된 카드 위의 통과 기록은 사후 조사에서 "체계적으로 잘못 운영된 증거"가 된다 — Ralston Purina의 입증책임 구조에서, 증명 자산이 오히려 부인 증거로 뒤집히는 최악의 시나리오다.

역으로 B-01이 제대로 서 있으면, Decipher의 핵심 명제인 "Regulation as Data"(자산이 바뀌어도 코드는 그대로, 데이터만 바뀐다)가 법적으로도 성립한다 — 데이터가 곧 규제 준수의 실체라면, 그 데이터의 무결성 보증이 곧 준수의 보증이기 때문이다. B-01은 시스템 전체의 신뢰 루트(root of trust)를 지키는 부품이다.

## §2. 메타 정보 (Internal Identifier Box)

아래는 Decipher 내부 PM 규약상의 식별자·분류값을 한곳에 모은 박스다. 본문에서는 이 코드들을 단독으로 쓰지 않고 "본 부품"·"신상카드 정합 부품" 같은 자연어로 부른다.

| 항목 | 값 | 한 줄 풀이 |
| --- | --- | --- |
| 부품 이름 | 신상카드 정합 (Manifest Integrity) | 모든 검사의 입력 사실을 지키는 무결성 검사원 |
| 검사 대상 | 자산 Manifest의 존재·활성 상태·버전 승인(다중서명 + time-lock)·내부 불변식(cross-field 정합)·만료성 사실 신선도 + 온체인 hash 앵커와 off-chain 전문의 일치(상시 대사) | "이 거래가 딛고 선 신상카드가 진본·승인·최신·무모순인가" |
| Internal ID | B-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | 기계 판정형(Pattern A) — 해시·서명·버전·불변식의 결정론적 확인 | 판단 0, 계산 100 — reasonable belief가 낄 자리가 없다 |
| Timing | pre-trade (Element union 내 실행 순서 최우선) | 다른 부품이 사실을 소비하기 전에 사실부터 검사 |
| Stateful 여부 | STATELESS (Element 한정) | per-tx 판정은 현재 유효 버전의 정적 스냅샷 검사. 검사 대상인 Manifest 자체는 거버넌스 평면에서 버전 관리되는 상태이나, 판정이 과거 거래의 누적에 의존하지 않는다 |
| 주 활성화 Recipe | R1(Reg D 506(c) 발행)·R2(재판매)·R3(ICA §3(c)(7) 펀드) 전부 필수 | 세 자산 Recipe 모두에 ● 부착되는 유일한 부품군(A-01·A-02와 함께)이자 유일한 자산 메타 필수 부품 |
| Cumulative Recipe | 해당 없음 (R4 행위감시에는 미부착) | R4는 자산 사실이 아니라 행위 패턴을 본다 |
| Cascade Element | 없음 — B-01은 다른 부품을 호출하지 않는다 | 반대로 사실 소비 부품 전원(A-03·A-13·C-00·C-08·D-01·F-04·B-04 등)이 B-01의 보증을 전제한다 — cascade의 역방향(공급자) |
| 성숙도 | 완료(재정의 done) → 본 문서로 기준서 확정 | ManifestCore + hash anchor 재정의 반영분 |
| 파일·위치 | B-01_manifest-integrity.md · 산출물/elements/ | 산출물 경로 |

## §3. 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문)은 의회가 만든 법률 텍스트(statute), Layer 2(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), Layer 3(해석)은 판례·SEC 발행문서가 모호한 부분을 메운 해석이다. 아래 §3.0.2 표 1의 "종류" 칸이 그대로 Layer에 대응한다 — Statute = Layer 1(§5·§12(a)(1)·§17(a)·§3(c)(7)·Exchange Act §17(a)(1)), SEC Rule = Layer 2(17a-4·Reg ATS 301/302/303·10b-5), Case·SEC Release = Layer 3(Ralston Purina·Release 34-96034). 본 절은 조문이 작동하는 논리 흐름 순서로 배열돼 §3.1~§3.12 번호를 그대로 유지하며, 각 항목이 어느 Layer인지는 이 표로 확인하면 된다.

B-01의 §3이 다른 부품과 다른 점 하나를 미리 밝힌다. A-13·D-01의 §3은 "요건 조문 → 요건 분해"의 구조지만, B-01이 지키는 것은 요건이 아니라 **요건 판정의 전제**이므로, 본 절의 조문들은 "B-01이 그 조문을 판정한다"가 아니라 "그 조문이 B-01이라는 설계를 명령한다"는 관계로 읽어야 한다. 흐름은 네 다발이다 — ① 왜 사실인가(§3.1~§3.3: 무과실 책임 + 입증책임), ② 무슨 사실인가(§3.4: 사실 의존 면제의 대표례), ③ 그 사실 기록의 규제 지위(§3.5~§3.10: 기록 작성·보존·전자기록 무결성·변경 규율), ④ 허위 사실의 책임(§3.11~§3.12).

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 위 네 다발이 B-01 설계로 수렴하는 흐름을 정리한 것이다 — §5 무과실 기본값 → §12(a)(1) rescission → Ralston Purina 입증책임(사실은 증명 가능해야 한다) → §3(c)(7) 같은 사실 의존 면제(Manifest가 그 사실의 기계가독 선언) → 사실은 규제 '기록'(§17(a)(1) → 17a-4(e)(7) compliance manual 버전 보존 → 17a-4(f) 전자기록 audit-trail/WORM) → 변경 규율의 원형(Reg ATS 301(b)(2)) → 허위 사실의 책임(§17(a)·10b-5) → B-01의 판정 구조(존재 → 상태 → 버전 → 불변식 → 신선도 + hash 상시 대사). 각 조항 상세는 §3.1~§3.12.

**범례.**

- 파랑 = 제정법(Layer 1)
- 초록 = SEC 규칙(Layer 2)
- 주황 = 판례·Release(Layer 3)
- 빨강 = 책임 조항(허위 사실의 귀결)
- 보라 = B-01 판정 구조(수렴점)

![그림 3.0](figures/B-01_fig30.png)

*그림 3.0 — 법조문 관계 흐름: 무과실 책임·입증책임 → 사실 의존 면제 → 기록·변경 규율 → B-01 (개발자용)*

### 3.0.1 실제 BUIDL-like 자산에 어떻게 적용되나

**(재확인) 본 서술은 실제 BlackRock BUIDL의 발행 표준·transfer architecture·현재 운영 조건을 단정하지 않는다 — BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링한 것이다.**

BUIDL-like 자산의 신상카드에는 최소 다음이 담긴다: fundForm = ICA-3c7(→ R3·A-13·D-01 활성), issuanceExemption = RegD-506c(→ R1·A-03 활성), reportingStatus = non-reporting, nmsStatus = non-NMS, distributionStatus = { active: true, basis: CONSERVATIVE_DEFAULT }(→ F-04 상시 활성), restrictedParties(발행자·계열·판매 참여 entity), 12gThresholds = { recordHolders: 2000, nonAccredited: 500 }(→ D-01 상한), enabledResalePaths(→ C-00), supportedEngines(→ B-04), legalClassId(D-01 class 분리), fullManifestHash(off-chain 전문 앵커).

B-01 관점에서 BUIDL 카드의 급소 세 곳: ① **fundForm ↔ fundRecipeId 정합** — fundForm이 ICA-3c7인데 fundRecipeId = 0(펀드 Recipe 미연결)이면 QP 검사가 아예 부착되지 않는 구조적 구멍이므로 불변식 위반으로 즉시 차단한다(§7 T4, 가장 흔한 오구현 지점). ② **distributionStatus의 CONSERVATIVE_DEFAULT** — 상시 발행 펀드는 active = true가 기본값이고, 이 값을 완화(false)하는 변경은 비조치의견서 같은 법적 근거가 등록된 정정 버전으로만 가능하다 — 근거 없는 완화 시도는 거버넌스에서 반려되고, 우회 수정은 버전 승인 검사에서 잡힌다. ③ **12g 사실의 신선도** — 총자산·발행주식총수처럼 D-01·C-08이 소비하는 수치는 basisAsOf가 붙는 만료성 사실이며, maxAge를 넘기면 그 수치를 쓰는 거래가 멈춘다(사실이 낡은 채 상한 판정을 하지 않는다).

### 3.0.2 조문 근거표 (Authority) + 순서·중요성

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 B-01에 어떻게 닿는지를, **표 2**(순서·중요성)는 아래 §3.1~§3.12 소단원의 읽는 순서(논리 흐름)와 중요성을 보여준다. 제정법 출처는 uscode.house.gov로 통일했으며 govinfo.gov/link/uscode/... 딥링크도 동일한 1차 출처다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | B-01 관련성 | Direct/Supporting | Official URL |
| --- | --- | --- | --- | --- | --- |
| Statute | Securities Act §5 · 15 U.S.C. §77e(a)·(c) | 미등록 offer·sale 금지(무과실 기본값) | 사실 오류의 종착점 — 정합 실패 = 면제 붕괴 = §5 회귀 | Background | uscode.house.gov |
| Statute | Securities Act §12(a)(1) · 15 U.S.C. §77l(a)(1) | §5 위반 매도인에 대한 무조건 rescission | 선의 항변 없음 → 기계 강제 설계 명령 | Background | uscode.house.gov |
| Case | SEC v. Ralston Purina Co. · 346 U.S. 119, 126 (1953) | 면제 주장자가 입증책임 부담 | 사실은 증명 가능해야 — B-01 판정·대사 기록이 그 증명 자산 | Direct(설계 원리) | govinfo.gov |
| Statute | ICA §3(c)(7)(A) · 15 U.S.C. §80a-3(c)(7)(A) | 전원 QP + no public offering의 사실 의존 면제 | fundForm 선언의 무결성 = A-13·D-01 활성화 트리거의 무결성 | Direct(활성화 정합) | uscode.house.gov |
| Statute | Exchange Act §17(a)(1) · 15 U.S.C. §78q(a)(1) | 브로커-딜러 등 기록 작성·보존의 제정법 수권 | Manifest = "records ... as the Commission ... prescribes"의 대상 기록 | Direct | uscode.house.gov |
| SEC Rule | Rule 17a-4(e)(7) · 17 C.F.R. §240.17a-4(e)(7) | compliance·supervisory·procedures manual을 updates·modifications·revisions 포함 보존 | Manifest + Recipe 레지스트리 = 기계가독 compliance manual → 버전 이력 보존 의무 | Direct | ecfr.gov |
| SEC Rule | Rule 17a-4(f)(1)(ii)·(f)(2) · 17 C.F.R. §240.17a-4(f) | 전자기록: audit-trail 대안((f)(2)(i)(A)) 또는 WORM((B)) | hash 앵커·서명 버전 이력 = audit-trail 요건의 온체인 구현 | Direct | ecfr.gov |
| SEC Release | Release No. 34-96034 · 87 FR 66412 (2022-11-03) | 2022 전자기록 개정 — audit-trail alternative 채택 | "수정·삭제 시 원본 재구성 가능"이 규제가 인정한 무결성 방식임을 확인 | Supporting | sec.gov |
| SEC Rule | Reg ATS Rule 301(b)(2) · 17 C.F.R. §242.301(b)(2) | Form ATS 초기 신고·중대변경 20일 전 amendment·부정확 정정·report 지위 | Manifest 버전 규율(사전 time-lock·정정 버전·기록)의 규제 원형 | Conditional(ATS 등록 시) | ecfr.gov |
| SEC Rule | Reg ATS Rule 301(b)(8)·302·303 · 17 C.F.R. §242.301(b)(8)·§242.302·§242.303 | ATS 기록 작성·보존 — 303(a)(2)(ii) Form ATS 사본 기업 존속기간 보존 | venue 기록 규율 — manifest 버전 이력의 보존 기간·형식 근거 | Conditional(ATS 등록 시) | ecfr.gov |
| Statute | Securities Act §17(a) · 15 U.S.C. §77q(a) | offer·sale에서의 사기·중대 허위 진술 금지 | 허위 카드로 운영되는 venue의 책임 노출 — (a)(2)·(3)은 과실로 족함 | Supporting | uscode.house.gov |
| SEC Rule | Rule 10b-5 · 17 C.F.R. §240.10b-5 | 매매 관련 사기·허위 진술 일반 금지 | 동일 노출의 1934년법 축 | Supporting | ecfr.gov |

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | B-01이 그걸로 하는 일 |
| --- | --- | --- | --- |
| §3.1 | Securities Act §5 — 등록의무 기본값 | 배경(핵심 전제) | 안 함 — 정합 실패의 종착점을 정의 |
| §3.2 | §12(a)(1) — 무조건 rescission | 배경(핵심 전제) | 안 함 — "선의 항변 없음"이 기계 강제를 명령 |
| §3.3 | Ralston Purina — 입증책임 | 핵심(설계 원리) | 판정·대사 이력을 증명 자산으로 남기는 근거 |
| §3.4 | ICA §3(c)(7)(A) — 사실 의존 면제 | 핵심(활성화 정합) | fundForm ↔ fundRecipeId 불변식의 법적 무게 |
| §3.5 | Exchange Act §17(a)(1) — 기록 수권 | 핵심 | Manifest를 규제 기록으로 자리매김 |
| §3.6 | Rule 17a-4(e)(7) — manual 보존 | 핵심 | 버전·수정 이력 보존을 판정 전제로 |
| §3.7 | Rule 17a-4(f) — 전자기록 무결성 | 핵심 | hash 앵커·audit-trail 채널(채널 2)의 규제 문법 |
| §3.8 | Release 34-96034 — 2022 개정 | 보조 | 안 함 — (f)(2)(i)(A)의 채택 취지 확인 |
| §3.9 | Reg ATS 301(b)(2) — 변경 규율 | 조건부(핵심 원형) | 버전 수명주기(사전 대기·정정·기록)의 원형 |
| §3.10 | Reg ATS 301(b)(8)·302·303 — 기록 | 조건부 | 보존 기간·형식(3년/존속기간)의 근거 |
| §3.11 | Securities Act §17(a) — 허위 진술 | 보조(책임) | 안 함 — 오염 카드 운영의 책임 노출 정의 |
| §3.12 | Rule 10b-5 — 시장 사기 일반 | 보조(책임) | 안 함 — 동일 노출의 1934년법 축 |
| §3.19 | Sub-요건 분해 매트릭스 | — | 위 원리를 원자적 검증 단위로 분해 |
| §3.20 | ERC-3643 변환 총정리 | — | §3.1~§3.12의 시스템 매핑을 한 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래는 같은 자산·같은 카드 필드에 작동하지만 B-01이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리이며, B-01 안에 끌어다 구현하지 않는다.

- **카드에 담긴 개별 사실의 법적 판정** — fundForm이 켠 QP 요건은 A-13, 12gThresholds의 상한 집계는 D-01, distributionStatus가 켠 매수 금지는 F-04, enabledResalePaths의 경로 분기는 C-00 소관. B-01은 그 사실이 진본·승인·최신·무모순임만 보증한다.
- **카드 내용의 진실성** — 발행자가 신고한 사실이 세상의 진실인가는 온보딩 6단계 심사(Operator)·발행자의 사실 진실성 보증·반대정보 채널(A-12) 소관(§4.2).
- **토큰 컨트랙트 자체의 표준 준수** — ERC-3643 인터페이스 구현 여부는 B-02, restrictedFlag 메타데이터는 B-03 소관. B-01은 "카드의 tokenStandard 기재와 실제 설정의 지시 관계"까지만 본다.
- **Form ATS 신고 행위 자체** — 규제기관 제출은 Operator의 법적 이행 행위. B-01은 그 규율을 내부 버전 규율의 원형으로 삼고(§3.9), 이중 트랙 정렬은 OD-B01-5로 남긴다.

### 3.1 Securities Act §5 — 등록의무 기본값 (무과실) [uscode.house.gov]

- **조항**: Securities Act of 1933 §5(a)·(c), 15 U.S.C. §77e(a)·(c) — uscode.house.gov

- **핵심 원문**: (a) Unless a registration statement is in effect as to a security, it shall be unlawful for any person, directly or indirectly— (1) to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to sell such security through the use or medium of any prospectus or otherwise; or (2) to carry or cause to be carried through the mails or in interstate commerce, by any means or instruments of transportation, any such security for the purpose of sale or for delivery after sale. … (c) It shall be unlawful for any person, directly or indirectly, to make use of any means or instruments of transportation or communication in interstate commerce or of the mails to offer to sell or offer to buy through the use or medium of any prospectus or otherwise any security, unless a registration statement has been filed as to such security, or while the registration statement is the subject of a refusal order or stop order or (prior to the effective date of the registration statement) any public proceeding or examination under section 77h of this title.

- **한국어**: (a) 어느 증권에 관하여 등록신고서가 효력을 갖고 있지 아니하는 한, 누구든지 직접 또는 간접으로 — (1) 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권을 판매하는 것; 또는 (2) 판매 목적으로 또는 판매 후 인도를 위하여 그 증권을 우편 또는 주간통상으로 운반하거나 운반하게 하는 것은 위법이다. … (c) 어느 증권에 관하여 등록신고서가 제출되어 있지 아니하는 한(또는 그 등록신고서가 거부명령·정지명령의 대상이거나 효력 발생 전의 공개 절차·심사 대상인 동안), 누구든지 직접 또는 간접으로 주간통상의 운송·통신 수단 또는 우편을 이용하여 prospectus 그 밖의 수단으로 그 증권의 매도 청약 또는 매수 청약을 하는 것은 위법이다.

- **쉬운 설명**: 미국 증권규제의 기본값이다 — 등록 없이는 팔지도(a), 청약하지도(c) 못한다. 조문 어디에도 "고의로"·"과실로"가 없다. 위법의 성립에 마음 상태를 묻지 않는 무과실 구조이며, 여기서 벗어나는 유일한 길이 면제다. 그리고 §1.1에서 본 대로 면제는 전부 사실 조건이다. 그래서 이 조문은 B-01에게 이렇게 읽힌다: **신상카드의 사실이 틀리는 순간 도착하는 곳이 바로 여기다.** 정합 실패는 기술 버그가 아니라 §5 위반으로 가는 문이다.

- **PASS/FAIL 반영**: 간접 ✕ — B-01이 §5를 판정하지 않는다. 정합 실패의 법적 종착점으로서 fail-closed(모호하면 차단) 설계 원칙의 근거가 된다.

- **ERC-3643 변환**: 직접 매핑 없음. Router의 cumulative AND 구조(하나라도 FAIL이면 revert)와 B-01의 union 내 최우선 실행이 이 조문의 "기본값 = 금지" 구조를 코드에 옮긴 것이다.

### 3.2 Securities Act §12(a)(1) — §5 위반의 무조건 rescission [uscode.house.gov]

- **조항**: Securities Act §12(a)(1), 15 U.S.C. §77l(a)(1) — uscode.house.gov

- **핵심 원문**: (a) In general. Any person who— (1) offers or sells a security in violation of section 77e of this title, or … shall be liable, subject to subsection (b), to the person purchasing such security from him, who may sue either at law or in equity in any court of competent jurisdiction, to recover the consideration paid for such security with interest thereon, less the amount of any income received thereon, upon the tender of such security, or for damages if he no longer owns the security.

- **한국어**: (a) 일반 원칙. 다음에 해당하는 자는 — (1) §77e(§5)를 위반하여 증권을 청약하거나 판매한 자는 … subsection (b)를 조건으로, 그로부터 그 증권을 매수한 자에 대하여 책임을 지며, 매수인은 관할 법원에서 보통법상 또는 형평법상 소를 제기하여, 그 증권을 반환하면서 지급한 대금에 이자를 더한 금액(그로부터 수취한 수익은 공제)을 회수하거나, 더 이상 그 증권을 보유하지 아니하는 경우 손해배상을 청구할 수 있다.

- **쉬운 설명**: §5 위반의 민사적 귀결이다. 매수인은 이유를 묻지 않고 "물러달라"고 할 수 있다 — 매도인의 고의·과실도, 매수인의 신뢰(reliance)도, 손해의 인과도 요건이 아니다(같은 조 (a)(2)의 허위 진술 책임에는 reasonable care 항변이 있지만, (a)(1)의 §5 위반 책임에는 그런 항변 문구 자체가 없다). B-01에게 이 조문이 명령하는 것은 검증의 **방식**이다: 선의가 항변이 되지 않는 책임 구조 아래에서, 사실 무결성을 사람의 성실성이나 사후 점검에 맡길 수 없다 — 거래마다 기계가 결정론적으로 강제해야 하고, "그때는 몰랐다"는 상태 자체가 발생하지 않게 해야 한다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 대상이 아니라 판정 방식(기계 강제·fail-closed)의 근거.

- **ERC-3643 변환**: 직접 매핑 없음. B-01의 모든 FAIL 코드가 사람 개입 없는 revert로 구현되는 이유가 이 조문이다 — 예외 승인 경로(§6.2)조차 거버넌스 평면의 서명·기록으로만 존재한다.

### 3.3 SEC v. Ralston Purina Co. — 면제 주장자의 입증책임 [govinfo.gov]

- **조항**: SEC v. Ralston Purina Co., 346 U.S. 119, 126 (1953) — govinfo.gov (U.S. Reports)

- **핵심 원문**: Keeping in mind the broadly remedial purposes of federal securities legislation, imposition of the burden of proof on an issuer who would plead the exemption seems to us fair and reasonable.

- **한국어**: 연방 증권 입법의 광범위한 구제적 목적을 염두에 둘 때, 면제를 주장하고자 하는 issuer에게 입증책임을 지우는 것이 우리에게는 공정하고 합리적으로 보인다.

- **쉬운 설명**: 사모 면제 법리의 뿌리 판결이다(비공모 여부는 offeree가 등록이 줄 정보 없이도 스스로를 지킬 수 있는가라는 기능적 기준으로 판단 — A-13 §3.18이 상술). B-01에게 중요한 것은 그중 입증책임 문장이다: 면제가 성립한다는 사실은 **주장하는 쪽이 증명해야** 한다. Decipher가 매 거래에서 남기는 판정 로그·카드 버전 이력·hash 대사 기록은 바로 이 증명의 원료다. 뒤집어 말하면, 카드가 오염된 채 쌓인 "통과" 기록은 증명 자산이 아니라 반대 증거가 된다(§1.4). 그래서 B-01은 판정만 하지 않고 판정의 전제(카드 무결성)와 그 확인 이력 자체를 기록으로 남긴다 — 증명 가능성이 곧 설계 요건이다.

- **PASS/FAIL 반영**: 직접 ○(설계 원리) — 개별 거래의 PASS/FAIL 분기 조건은 아니나, "판정 + 판정 근거의 보존"이라는 B-01의 이중 산출(게이트 결과 + audit trail)을 직접 명령한다.

- **ERC-3643 변환**: 판정 이벤트(elementId = B-01, reasonCode, manifestVersion, timestamp)를 불변 로그로 emit; 대사 채널의 확인 이력을 Operator 보존 양식으로 export(§11). 기록이 없으면 증명이 없다.

### 3.4 ICA §3(c)(7)(A) — 사실 의존 면제의 대표례 (fundForm 트리거) [uscode.house.gov]

- **조항**: Investment Company Act §3(c)(7)(A), 15 U.S.C. §80a-3(c)(7)(A) — uscode.house.gov

- **핵심 원문**: Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities. Securities that are owned by persons who received the securities from a qualified purchaser as a gift or bequest, or in a case in which the transfer was caused by legal separation, divorce, death, or other involuntary event, shall be deemed to be owned by a qualified purchaser, subject to such rules, regulations, and orders as the Commission may prescribe as necessary or appropriate in the public interest or for the protection of investors.

- **한국어**: 그 발행 증권이, 해당 증권의 취득 시점에 qualified purchaser인 자들에 의하여 배타적으로(exclusively) 소유되고, 그 시점에 해당 증권의 public offering(공모)을 하고 있지 아니하며 또한 그때 이를 하려고 제안하지도 아니하는 모든 issuer. qualified purchaser로부터 증여(gift) 또는 유증(bequest)으로 증권을 받은 자, 또는 법적 별거·이혼·사망 그 밖의 비자발적 사건으로 이전이 발생한 경우의 그 증권은, Commission이 공익 또는 투자자 보호를 위하여 필요·적절하다고 정하는 규칙·규정·명령을 조건으로, qualified purchaser가 소유한 것으로 본다.

- **쉬운 설명**: 사실 의존 면제의 대표례로서 인용한다(요건의 실체 — QP 정의·전원 QP 판정 — 는 A-13 문서가 전담하며 여기서 재론하지 않는다). B-01의 관점은 이 조문의 첫 두 단어에 있다: "Any issuer, the outstanding securities of which are owned exclusively by …" — 면제의 주어는 issuer이고, 성립 여부는 그 issuer의 **속성 사실**이다. Decipher에서 그 속성 사실을 선언하는 곳이 신상카드의 fundForm = ICA-3c7이고, 이 한 필드가 A-13(전원 QP)과 D-01(보유자 수)의 부착을 켠다. 즉 이 조문의 준수 여부 판정이 시작되기도 전에, **선언 자체의 무결성**이라는 선행 문제가 있다 — 필드가 조작·누락되면 검사가 틀리는 게 아니라 검사가 안 돈다. §3.19의 불변식 B01-INV-1(fundForm ↔ fundRecipeId)이 이 선행 문제의 원자 단위다.

- **PASS/FAIL 반영**: 직접 ○(활성화 정합 한정) — B-01은 이 조문의 요건(전원 QP·no public offering)을 판정하지 않고, 이 조문을 켜는 선언의 정합(fundForm과 fundRecipeId·부착 부품 집합의 상호 일치)만 판정한다.

- **ERC-3643 변환**: ManifestCore.factsPacked의 fundForm 비트 ↔ ManifestCore.fundRecipeId ≠ 0 ↔ Recipe R3의 elementSubset ⊇ {A-13, D-01} — 세 층의 일치를 불변식으로 검사. 불일치 시 FAIL_FACTS_INCONSISTENT.

### 3.5 Exchange Act §17(a)(1) — 기록 작성·보존의 제정법 수권 [uscode.house.gov]

- **조항**: Securities Exchange Act of 1934 §17(a)(1), 15 U.S.C. §78q(a)(1) — uscode.house.gov

- **핵심 원문**: (1) Every national securities exchange, member thereof, broker or dealer who transacts a business in securities through the medium of any such member, registered securities association, registered broker or dealer, registered municipal securities dealer municipal advisor,, registered securities information processor, registered transfer agent, nationally recognized statistical rating organization, and registered clearing agency and the Municipal Securities Rulemaking Board shall make and keep for prescribed periods such records, furnish such copies thereof, and make and disseminate such reports as the Commission, by rule, prescribes as necessary or appropriate in the public interest, for the protection of investors, or otherwise in furtherance of the purposes of this chapter.

- **한국어**: (1) 모든 national securities exchange와 그 회원, 그러한 회원을 매개로 증권업을 영위하는 broker 또는 dealer, 등록 증권협회, 등록 broker 또는 dealer, 등록 municipal securities dealer·municipal advisor, 등록 증권정보처리기관, 등록 transfer agent, 국가공인 신용평가기관, 등록 clearing agency 및 MSRB는, Commission이 공익·투자자 보호 또는 본 장의 목적 달성을 위하여 필요·적절하다고 규칙으로 정하는 바에 따라, 소정 기간 동안 기록을 작성·보존하고, 그 사본을 제공하며, 보고서를 작성·배포하여야 한다. (원문의 "municipal securities dealer municipal advisor,,"의 중복 쉼표는 법전 원문 그대로다 — 편집 오류 주석 "So in original.")

- **쉬운 설명**: 미국 시장 인프라 전체에 걸리는 기록 의무의 제정법 뿌리다. 구체적으로 무엇을 어떻게 보존할지는 SEC 규칙(17a-3·17a-4, ATS라면 Reg ATS 302·303)에 위임되지만, "기록을 만들고 보존하라"는 명령 자체는 의회가 직접 걸었다. Decipher의 거래 venue 주체(브로커-딜러 등록 예정, Reg ATS 경로)는 이 수권 아래의 규칙들을 그대로 받는다. B-01에게 이 조문은 신상카드의 법적 신분을 정한다: 카드는 내부 편의 데이터가 아니라, 이 수권 체계가 말하는 "records" — 만들 의무, 정확할 의무, 보존할 의무, 제출할 의무가 붙는 규제 기록이다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 조건이 아니라 판정 대상(Manifest)의 규제 지위를 정의.

- **ERC-3643 변환**: 직접 매핑 없음. Manifest 버전 이력·B-01 판정 로그·대사 이력을 "규제 보존 양식으로 내보내는" Operator export 경로(§11)가 이 수권의 이행 통로다.

### 3.6 Rule 17a-4(e)(7) — compliance manual의 버전 포함 보존 [ecfr.gov]

- **조항**: 17 C.F.R. §240.17a-4(e)(7) — ecfr.gov (Title 17 현행본)

- **핵심 원문**: (e) Every member, broker or dealer subject to §240.17a-3 must maintain and preserve in an easily accessible place: … (7) Each compliance, supervisory, and procedures manual, including any updates, modifications, and revisions to the manual, describing the policies and practices of the member, broker or dealer with respect to compliance with applicable laws and rules, and supervision of the activities of each natural person associated with the member, broker or dealer until three years after the termination of the use of the manual.

- **한국어**: (e) §240.17a-3의 적용을 받는 모든 member·broker·dealer는 접근이 용이한 장소에 다음을 유지·보존하여야 한다: … (7) 적용 법령·규칙의 준수와 관련한 그 member·broker·dealer의 정책·관행, 그리고 소속 자연인 각각의 활동에 대한 감독을 기술하는 각 compliance·supervisory·procedures manual — **그 manual에 대한 모든 update·modification·revision을 포함하여** — 을, 그 manual의 사용 종료 후 3년이 될 때까지.

- **쉬운 설명**: 이 규칙의 급소는 "including any updates, modifications, and revisions"다. 준수 매뉴얼은 최신본만 보관하면 되는 문서가 아니라, **모든 중간 버전이 보존 대상**이다 — 감독기관이 "그 시점에 어떤 규칙으로 운영했나"를 재구성할 수 있어야 하기 때문이다. Decipher에서 "적용 법령 준수의 정책·관행을 기술하는 문서"의 기계가독판이 바로 Manifest(자산별)와 Recipe/Element 레지스트리(규칙 본체)다. 따라서 이 규칙은 B-01 설계에 두 가지를 직결한다: ① 카드의 과거 버전은 삭제 불가·전량 보존 대상이고(사용 종료 후에도 3년 이상), ② B-01의 버전 검사(§5.2 ③)는 "현재 버전이 승인 이력 사슬 위에 있는가"를 볼 수 있는 이력 구조를 전제한다 — 이력 없는 카드는 그 자체로 보존 의무 위반 상태다.

- **PASS/FAIL 반영**: 직접 ○(전제 구조) — 개별 거래에서 (e)(7) 위반을 판정하지는 않으나, ③버전 검사가 딛는 이력 구조(승인 집합·버전 사슬)의 법적 근거이며, 이력 파손이 감지되면 REVIEW_MANIFEST_DRIFT로 운영 검토에 올린다.

- **ERC-3643 변환**: ManifestRegistry가 버전별 (coreHash, fullManifestHash, approvedAt, signers[]) 튜플을 append-only로 축적; 폐기(retire)는 삭제가 아니라 상태 전환. "사용 종료 후 3년" 카운트는 Operator 보존 정책 필드(retiredAt + 3y)로 관리.

### 3.7 Rule 17a-4(f) — 전자기록의 무결성 방식: audit-trail 또는 WORM [ecfr.gov]

- **조항**: 17 C.F.R. §240.17a-4(f)(1)(ii)·(f)(2)(i) — ecfr.gov (Title 17 현행본, 2022 개정 반영)

- **핵심 원문**: (f) Subject to the conditions set forth in this paragraph (f), the records required to be maintained and preserved pursuant to §240.17a-3 and this section may be immediately produced or reproduced by means of an electronic recordkeeping system or by means of micrographic media and be maintained and preserved for the required time in that form. (1) For purposes of this paragraph (f): … (ii) The term electronic recordkeeping system means a system that preserves records in a digital format in a manner that permits the records to be viewed and downloaded; … (2) An electronic recordkeeping system must: (i)(A) Preserve a record for the duration of its applicable retention period in a manner that maintains a complete time-stamped audit trail that includes: (1) All modifications to and deletions of the record or any part thereof; (2) The date and time of actions that create, modify, or delete the record; (3) If applicable, the identity of the individual creating, modifying, or deleting the record; and (4) Any other information needed to maintain an audit trail of the record in a way that maintains security, signatures, and data to ensure the authenticity and reliability of the record and will permit re-creation of the original record if it is modified or deleted; or (B) Preserve the records exclusively in a non-rewriteable, non-erasable format;

- **한국어**: (f) 본 항의 조건을 충족하는 한, §240.17a-3 및 본 조에 따라 유지·보존이 요구되는 기록은 전자기록시스템 또는 마이크로그래픽 매체로 즉시 생산·재생산되고 그 형태로 소정 기간 유지·보존될 수 있다. (1) 본 항에서: … (ii) "전자기록시스템"이란 기록을 열람·다운로드할 수 있는 방식으로 디지털 형식으로 보존하는 시스템을 말한다; … (2) 전자기록시스템은 다음을 하여야 한다: (i)(A) 기록을 그 보존기간 동안, 다음을 포함하는 완전한 time-stamp 부착 audit trail을 유지하는 방식으로 보존할 것: (1) 그 기록 또는 그 일부에 대한 모든 수정과 삭제; (2) 기록을 생성·수정·삭제하는 행위의 일시; (3) 해당되는 경우, 생성·수정·삭제하는 개인의 신원; (4) 보안·서명·데이터를 유지하여 기록의 진정성과 신뢰성을 보장하고, 기록이 수정 또는 삭제된 경우 **원본의 재구성을 가능하게 하는** 방식으로 audit trail을 유지하는 데 필요한 그 밖의 정보; 또는 (B) 기록을 오로지 재기록 불가·삭제 불가 형식으로 보존할 것;

- **쉬운 설명**: 규제가 인정하는 전자기록 무결성 방식은 두 갈래다 — (B) WORM(애초에 못 고치게) 또는 (A) audit-trail(고치더라도 누가·언제·무엇을 고쳤는지 전부 남겨 원본을 언제든 재구성). 2022년 개정 전에는 WORM만 허용됐고, (A)는 분산원장 같은 기술을 수용하기 위해 신설됐다(§3.8). Decipher의 신상카드 관리가 정확히 (A)의 구현이다: 온체인 fullManifestHash 앵커(변조 시 hash 불일치로 즉시 노출), 버전별 다중서명 기록(행위자 신원), 블록 timestamp(일시), append-only 버전 사슬(원본 재구성). B-01의 채널 2(상시 대사)는 이 audit-trail이 실제로 살아 있는지 — 앵커와 전문이 일치하는지 — 를 지키는 감시자다.

- **PASS/FAIL 반영**: 직접 ○(채널 2 한정) — per-tx 게이트(채널 1)의 분기 조건은 아니고, hash 대사 채널의 규제 문법이다. 대사 불일치는 SUSPENDED 전환을 거쳐 채널 1의 ②단계에서 FAIL로 나타난다.

- **ERC-3643 변환**: fullManifestHash = keccak256(canonicalize(fullManifest)); watcher가 주기 재계산·대사(OD-B01-2); 불일치 시 서명 입력으로 ManifestCore.status = SUSPENDED. 버전 이력 = (f)(2)(i)(A)의 (1)~(4) 필드에 1:1 대응하는 이벤트 스키마.

### 3.8 Release No. 34-96034 — 2022 전자기록 개정 (audit-trail alternative 채택) [sec.gov]

- **조항**: Electronic Recordkeeping Requirements for Broker-Dealers, Security-Based Swap Dealers, and Major Security-Based Swap Participants, Release No. 34-96034 (2022-10-12), 87 FR 66412 (2022-11-03) — sec.gov (발효 2023-01-03, 브로커-딜러 준수기한 2023-05-03)

- **핵심 원문**: The amendments to Rule 17a-4 add an audit-trail alternative to the WORM requirement. Under the audit-trail alternative, a broker-dealer will need to use an electronic recordkeeping system that maintains and preserves electronic records in a manner that permits the recreation of an original record if it is modified or deleted.

- **한국어**: Rule 17a-4 개정은 WORM 요건에 audit-trail 대안을 추가한다. audit-trail 대안 하에서 broker-dealer는, 전자기록이 수정 또는 삭제된 경우 원본 기록의 재구성을 가능하게 하는 방식으로 전자기록을 유지·보존하는 전자기록시스템을 사용하여야 한다.

- **쉬운 설명**: §3.7 규칙 문언의 채택 배경이다. 개정 취지는 기술 중립화 — "기록을 물리적으로 못 고치게 하는" WORM 하나만 인정하던 체계를, "고침이 전부 추적되고 원본이 재구성되는" 시스템도 동등하게 인정하는 체계로 넓혔다. 이것이 B-01 설계에 주는 확신은, 온체인 앵커 + 서명 버전 이력이라는 접근이 규제 문법 밖의 창작이 아니라 규제가 명시적으로 승인한 두 방식 중 하나의 구현이라는 점이다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 조건 아님. §3.7 채택 취지의 확인 자료.

- **ERC-3643 변환**: 직접 매핑 없음(§3.7의 구현이 곧 대응).

### 3.9 Reg ATS Rule 301(b)(2) — Form ATS 사전 신고·중대변경 amendment·정정 의무 [ecfr.gov]

- **조항**: 17 C.F.R. §242.301(b)(2)(i)~(vi) — ecfr.gov (Title 17 현행본)

- **핵심 원문**: (2) Notice. (i) The alternative trading system shall file an initial operation report on Form ATS, §249.637 of this chapter, in accordance with the instructions therein, at least 20 days prior to commencing operation as an alternative trading system. (ii) The alternative trading system shall file an amendment on Form ATS at least 20 calendar days prior to implementing a material change to the operation of the alternative trading system. (iii) If any information contained in the initial operation report filed under paragraph (b)(2)(i) of this section becomes inaccurate for any reason and has not been previously reported to the Commission as an amendment on Form ATS, the alternative trading system shall file an amendment on Form ATS correcting such information within 30 calendar days after the end of each calendar quarter in which the alternative trading system has operated. (iv) The alternative trading system shall promptly file an amendment on Form ATS correcting information previously reported on Form ATS after discovery that any information filed under paragraphs (b)(2)(i), (ii) or (iii) of this section was inaccurate when filed. (v) The alternative trading system shall promptly file a cessation of operations report on Form ATS in accordance with the instructions therein upon ceasing to operate as an alternative trading system. (vi) Every notice or amendment filed pursuant to this paragraph (b)(2) shall constitute a "report" within the meaning of sections 11A, 17(a), 18(a), and 32(a), (15 U.S.C. 78k-1, 78q(a), 78r(a), and 78ff(a)), and any other applicable provisions of the Act.

- **한국어**: (2) 신고. (i) ATS는 운영 개시 최소 20일 전에 Form ATS 최초 운영 보고서를 제출하여야 한다. (ii) ATS는 운영에 대한 중대한 변경(material change)을 시행하기 **최소 20역일 전에** Form ATS amendment를 제출하여야 한다. (iii) (i)에 따라 제출된 최초 보고서의 정보가 어떤 이유로든 부정확해지고 아직 amendment로 보고되지 아니한 경우, 운영한 각 분기 종료 후 30역일 내에 이를 정정하는 amendment를 제출하여야 한다. (iv) (i)~(iii)에 따라 제출된 정보가 **제출 당시에 부정확하였음을 발견한** 후에는 지체 없이 이를 정정하는 amendment를 제출하여야 한다. (v) 운영을 중단하면 지체 없이 운영 중단 보고서를 제출하여야 한다. (vi) 본 (b)(2)에 따라 제출된 모든 신고·amendment는 1934년법 §11A·§17(a)·§18(a)·§32(a) 및 그 밖의 적용 조항에서 말하는 "report"를 구성한다.

- **쉬운 설명**: 거래 시스템의 "자기 서술 문서"가 어떻게 관리되어야 하는지에 대한 규제의 표준 답안이다 — ① 바꾸기 전에 신고한다(중대변경은 최소 20역일 전, ≥ 20일 사전 대기), ② 부정확해지면 정정한다(사후 변화는 분기 정정, 애초 오류는 즉시 정정 — 두 트랙이 다르다), ③ 그 문서는 법적 "report"라서 허위 기재가 §32(a) 형사 책임까지 연결된다. Decipher의 Manifest 버전 규율이 이 문법의 내재화다: time-lock(사전 대기)은 (ii)의, 정정 버전 절차는 (iii)·(iv)의, 서명·기록 의무는 (vi)의 시스템 대응물이다. 주의할 것 두 가지 — 첫째, 이는 유추이지 동일성이 아니다. Form ATS는 규제기관 제출 문서이고 Manifest는 내부 운영 기록이므로, 어떤 카드 변경이 Form ATS상 "material change to the operation"에 해당해 실제 신고를 요하는지는 별도 판단이다(OD-B01-5). 둘째, (vi)의 report 지위는 이 유추에 무게를 싣는다 — 카드 사실이 Form ATS 기재의 원료가 되는 구조라면, 카드 오류는 신고 서류 오류로 전이된다.

- **PASS/FAIL 반영**: 조건부 — Reg ATS 등록 시 직접 무게가 실린다. per-tx 게이트에서는 ③버전 검사(time-lock 경과·승인 사슬)가 이 규율의 런타임 대응물이다.

- **ERC-3643 변환**: 거버넌스 컨트랙트의 (proposedAt, approvedAt, effectiveAt = approvedAt + delay) 수명주기; 정정 버전은 correctionOf(priorVersion) 참조 필드로 사슬화; Form ATS 연동 필드(atsAmendmentRef)는 Operator 기록(OD-B01-5).

### 3.10 Reg ATS Rule 301(b)(8)·302·303 — venue 기록의 작성·보존 [ecfr.gov]

- **조항**: 17 C.F.R. §242.301(b)(8), §242.302, §242.303 — ecfr.gov (Title 17 현행본)

- **핵심 원문**: §242.301(b)(8) Recordkeeping. The alternative trading system shall: (i) Make and keep current the records specified in §242.302; and (ii) Preserve the records specified in §242.303. — §242.302 To comply with the condition set forth in paragraph (b)(8) of §242.301, an alternative trading system shall make and keep current the following records: … — §242.303(a) To comply with the condition set forth in paragraph (b)(8) of §242.301, an alternative trading system shall preserve the following records: (1) For a period of not less than three years, the first two years in an easily accessible place, an alternative trading system shall preserve: (i) All records required to be made pursuant to §242.302; (ii) All notices provided by such alternative trading system to subscribers generally, whether written or communicated through automated means, including, but not limited to, notices addressing hours of system operations, system malfunctions, changes to system procedures, maintenance of hardware and software, instructions pertaining to access to the market and denials of, or limitations on, access to the alternative trading system; … (2) During the life of the enterprise and of any successor enterprise, an alternative trading system shall preserve: (i) All partnership articles or, in the case of a corporation, all articles of incorporation or charter, minute books and stock certificate books; and (ii) Copies of reports filed pursuant to paragraph (b)(2) of §242.301 or §242.304 of this chapter and records made pursuant to paragraph (b)(5) of §242.301 of this chapter.

- **한국어**: §242.301(b)(8) 기록. ATS는 (i) §242.302에 명시된 기록을 작성하고 최신으로 유지하며, (ii) §242.303에 명시된 기록을 보존하여야 한다. — §242.302 … ATS는 다음 기록을 작성·최신 유지하여야 한다: … — §242.303(a) … ATS는 다음 기록을 보존하여야 한다: (1) **3년 이상**(not less than three years), 최초 2년은 접근이 용이한 장소에: (i) §242.302에 따라 작성이 요구되는 모든 기록; (ii) 구독자 일반에게 제공된 모든 통지 — 서면이든 자동화 수단이든 — 시스템 운영시간·시스템 장애·**시스템 절차의 변경**·하드웨어·소프트웨어 유지보수·시장 접근 지침·접근 거부 또는 제한에 관한 통지를 포함하되 이에 한정되지 아니함; … (2) **기업 및 승계 기업의 존속기간 동안**: (i) 조합계약서 또는 법인의 경우 정관·의사록·주권대장 전부; 및 (ii) §242.301(b)(2) 또는 §242.304에 따라 제출된 보고서의 사본과 §242.301(b)(5)에 따라 작성된 기록.

- **쉬운 설명**: ATS 기록 의무의 3층 구조다 — (b)(8)이 의무를 걸고, 302가 "무엇을 만들 것"을, 303이 "얼마나 보존할 것"을 정한다. B-01에 닿는 지점 세 곳: ① 303(a)(1)(ii)의 "changes to system procedures" 통지 보존 — 신상카드 변경으로 특정 자산의 거래 조건이 달라지면 그 변경 통지 자체가 3년 이상 보존 대상이다. ② 303(a)(2)(ii) — Form ATS 사본은 3년이 아니라 **기업 존속기간 전체** 보존이다. 시스템 자기 서술 문서의 버전 이력은 사실상 영구 보존 대상이라는 신호이고, Manifest 버전 사슬의 append-only 설계(§3.6)와 정확히 공명한다. ③ 302의 "keep current"(최신 유지) — 기록은 만들어두는 것이 아니라 **현재와 일치하게 유지**하는 것이다. B-01의 신선도 검사(⑤)와 상시 대사(채널 2)가 이 "current" 의무의 자산 사실 판이다.

- **PASS/FAIL 반영**: 조건부 — Reg ATS 등록 시. ⑤신선도 검사와 채널 2 대사의 규제 근거이며, 보존 기간(3년/존속기간)은 Operator 보존 정책(§11)에 직결.

- **ERC-3643 변환**: Operator export 파이프라인: B-01 판정 로그·대사 이력·버전 사슬 → 302/303 대응 보존 양식. 보존 기간 필드: elementLog ≥ 3y(최초 2y 즉시 접근), manifestVersionChain = 존속기간.

### 3.11 Securities Act §17(a) — offer·sale에서의 사기·중대 허위 진술 [uscode.house.gov]

- **조항**: Securities Act §17(a), 15 U.S.C. §77q(a) — uscode.house.gov

- **핵심 원문**: (a) It shall be unlawful for any person in the offer or sale of any securities (including security-based swaps) or any security-based swap agreement (as defined in section 78c(a)(78) of this title) by the use of any means or instruments of transportation or communication in interstate commerce or by use of the mails, directly or indirectly— (1) to employ any device, scheme, or artifice to defraud, or (2) to obtain money or property by means of any untrue statement of a material fact or any omission to state a material fact necessary in order to make the statements made, in light of the circumstances under which they were made, not misleading; or (3) to engage in any transaction, practice, or course of business which operates or would operate as a fraud or deceit upon the purchaser.

- **한국어**: (a) 누구든지 증권(security-based swap 포함) 또는 security-based swap agreement의 offer 또는 sale에서, 주간통상의 운송·통신 수단 또는 우편을 이용하여 직접 또는 간접으로 — (1) 사기를 위한 장치·계략·술책을 사용하는 것, 또는 (2) 중대한 사실에 관한 허위 진술, 또는 진술이 이루어진 상황에 비추어 그 진술을 오도적이지 않게 하기 위하여 필요한 중대한 사실의 누락에 의하여 금전 또는 재산을 취득하는 것; 또는 (3) 매수인에 대한 사기 또는 기망으로 작동하거나 작동할 거래·관행·영업 방식에 관여하는 것은 위법이다.

- **쉬운 설명**: 발행·매도 국면의 사기 일반 조항이다. B-01에 닿는 경로는 이렇다 — 신상카드가 선언하는 사실(면제 구조·거래 조건·매수 금지 명단)은 venue가 참가자들에게 사실상 표시하는 정보의 뼈대다. 카드가 허위인 채 거래가 체결되면, 그 표시 위에서 이루어진 offer·sale은 (2)의 "중대 사실 허위 진술에 의한" 거래 사정권에 들어간다. 특히 유의할 것: Aaron v. SEC, 446 U.S. 680 (1980)에 따라 (a)(1)은 scienter(고의)를 요하지만 **(a)(2)·(a)(3)은 과실만으로 SEC 집행이 가능**하다. "몰랐다"·"실수였다"가 방어가 아니라는 뜻이고, 이는 §3.2와 같은 방향에서 기계 강제 설계를 명령한다 — 허위 카드가 살아 있는 상태 자체를 만들지 않아야 한다.

- **PASS/FAIL 반영**: 간접 ✕ — 판정 조건이 아니라 오염 카드 운영의 책임 노출을 정의. fail-closed·즉시 SUSPENDED 설계의 근거.

- **ERC-3643 변환**: 직접 매핑 없음. 채널 2 불일치 → SUSPENDED 즉시 전환(허위 표시 상태의 지속 시간 최소화)이 이 조문 대응의 핵심 파라미터다.

### 3.12 Rule 10b-5 — 매매 관련 사기·허위 진술의 일반 금지 [ecfr.gov]

- **조항**: 17 C.F.R. §240.10b-5 — ecfr.gov (Title 17 현행본; 수권: Exchange Act §10(b), 15 U.S.C. §78j(b))

- **핵심 원문**: It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce, or of the mails or of any facility of any national securities exchange, (a) To employ any device, scheme, or artifice to defraud, (b) To make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading, or (c) To engage in any act, practice, or course of business which operates or would operate as a fraud or deceit upon any person, in connection with the purchase or sale of any security.

- **한국어**: 누구든지 직접 또는 간접으로, 주간통상의 수단·도구, 우편, 또는 national securities exchange의 시설을 이용하여, 증권의 매수 또는 매도와 관련하여(in connection with) — (a) 사기를 위한 장치·계략·술책을 사용하는 것, (b) 중대한 사실에 관한 허위 진술을 하거나, 진술이 이루어진 상황에 비추어 그 진술을 오도적이지 않게 하기 위하여 필요한 중대한 사실의 진술을 누락하는 것, 또는 (c) 어느 누구에 대한 사기 또는 기망으로 작동하거나 작동할 행위·관행·영업 방식에 관여하는 것은 위법이다.

- **쉬운 설명**: §3.11이 1933년법의 발행·매도 축이라면, 10b-5는 1934년법의 매매 전반 축이다 — "in connection with the purchase or sale"이라 2차 시장 거래 전체를 덮는다(10b-5 책임에는 scienter가 요구된다는 점이 §17(a)(2)·(3)과의 차이다 — Aaron). B-01 문맥에서의 의미는 §3.11과 같은 방향의 확장이다: 오염된 신상카드 위에서 도는 2차 거래는 발행 국면이 끝난 뒤에도 이 조항의 사정권에 남는다. 정합 게이트가 발행 시 1회 검사가 아니라 **매 거래 상시 게이트**여야 하는 이유가 여기서 완성된다.

- **PASS/FAIL 반영**: 간접 ✕ — §3.11과 동일한 성격(책임 노출 정의).

- **ERC-3643 변환**: 직접 매핑 없음. B-01이 R1(발행)만이 아니라 R2(재판매)·R3(펀드 상시)에도 필수 부착되는 구조가 "in connection with the purchase or sale"의 시간적 범위에 대응한다.

### 3.19 Sub-요건 분해 매트릭스

위 §3.1~§3.12의 원리를, B-01이 실제로 판정하는 원자적 검증 단위로 분해한다. 각 행은 §5.2의 판정 분기와 1:1 대응한다(채널 표기: G = per-tx 게이트, W = 상시 대사, GOV = 거버넌스 평면 전제).

| Sub-ID | 원자 검증 단위 | 근거 원리 | 채널 | PASS 조건 | FAIL 코드 |
| --- | --- | --- | --- | --- | --- |
| B01-S1 | Manifest 존재 — 상장 자산에 ACM 엔트리가 있다 | §5·§12(a)(1) (fail-closed) | G① | ACM[asset] ≠ empty | FAIL_MANIFEST_MISSING |
| B01-S2 | 활성 상태 — status = ACTIVE | §17(a)·10b-5 (허위 표시 상태 차단) + 채널 2 결과 소비 | G② | status = ACTIVE (SUSPENDED·RETIRED 아님) | FAIL_MANIFEST_SUSPENDED |
| B01-S3a | 버전 승인 — 참조 버전이 승인 사슬 위에 있다 | 301(b)(2)(vi) report 지위·17a-4(e)(7) 이력 | G③ | version ∈ approvedSet ∧ 미폐기 | FAIL_VERSION_UNAPPROVED |
| B01-S3b | time-lock 경과 — 발효 전 버전 참조 금지 | 301(b)(2)(ii) 사전 대기(≥ 20일)의 내부 대응 | G③ | now ≥ approvedAt + delay | FAIL_VERSION_PENDING |
| B01-INV-1 | fundForm ↔ fundRecipeId ↔ 부착 집합 일치 | §3(c)(7)(A) 활성화 정합 | G④ | fundForm = ICA-3c7 ⇒ fundRecipeId ≠ 0 ∧ R3 ⊇ {A-13, D-01}; fundForm = none ⇒ fundRecipeId = 0 | FAIL_FACTS_INCONSISTENT |
| B01-INV-2 | issuanceExemption ↔ issuanceRecipeId 일치 | 동일 원리(R1 축) | G④ | RegD-506c ⇒ issuanceRecipeId = R1 (등가 상호) | FAIL_FACTS_INCONSISTENT |
| B01-INV-3 | enabledResalePaths ⊆ framework 허용집합 | C-00 분기 전제의 정합 | G④ | 비트셋 포함 관계 성립 | FAIL_FACTS_INCONSISTENT |
| B01-INV-4 | distributionStatus.active = true ⇒ restrictedParties ≠ ∅ | Reg M 검사(F-04) 전제의 정합 | G④ | 함의 성립 | FAIL_FACTS_INCONSISTENT |
| B01-INV-5 | supportedEngines ≠ 0 ∧ legalClassId 지정 ∧ 12gThresholds 존재(fundForm 활성 시) | B-04·D-01 소비 필드의 존재성 | G④ | 필수 필드 non-null | FAIL_FACTS_INCONSISTENT |
| B01-INV-6 | override 방향 — 강화 방향만 (완화 시도 차단) | Operator 규칙 §3-2의 런타임 대응 | G④/GOV | overrideDelta가 제약을 좁히는 방향 | FAIL_FACTS_INCONSISTENT |
| B01-S5 | 만료성 사실 신선도 | 302 "keep current" | G⑤ | 대상 필드마다 now − asOf ≤ maxAge (초과 즉 > 이면 FAIL) | FAIL_FACT_STALE |
| B01-W1 | hash 앵커 대사 — 온체인 fullManifestHash = H(off-chain 전문) | 17a-4(f)(2)(i)(A) audit-trail | W | 일치 (불일치 → SUSPENDED 전환 → B01-S2에서 차단) | (게이트 표면상) FAIL_MANIFEST_SUSPENDED |
| B01-W2 | 버전 사슬 무결 — append-only·서명 완전성 | 17a-4(e)(7)·303(a)(2)(ii) | W | 사슬 파손·서명 결손 없음 (파손 → 운영 검토) | REVIEW_MANIFEST_DRIFT |
| B01-GOV | 승인 절차 — m-of-n 다중서명·심사 이력 | 301(b)(2)·Operator §4.3 | GOV | 게이트가 아닌 전제 — approvedSet 형성의 조건 | (해당 없음 — 미충족이면 S3a로 표면화) |

모든 PASS/FAIL 경로가 이 표에 있다 — 게이트 5단(①~⑤)의 각 FAIL, 대사 채널의 2종(하드 불일치 → SUSPENDED 경유 차단, 소프트 드리프트 → REVIEW), 그리고 거버넌스 전제 1종. deemed-PASS 같은 우회 경로는 존재하지 않는다(§6.2 — 증명서 cure 없음).

### 3.20 ERC-3643 변환 총정리 — Router·ManifestCore·거버넌스 매핑 (claim.basis 해당 없음)

B-01은 사람 자격 부품이 아니므로 ONCHAINID claim topic·claim.basis enum을 쓰지 않는다. 매핑 대상은 Router가 읽는 자산 메타 계층이다.

| 법적 원리 (§3.X) | 시스템 대응물 | 구체 필드·동작 |
| --- | --- | --- |
| §5·§12(a)(1) fail-closed (§3.1~§3.2) | Router cumulative AND + B-01 최우선 실행 | union 첫 원소 고정; 어느 단계든 FAIL 즉시 revert(reasonCode) |
| Ralston 입증책임 (§3.3) | 판정·대사 이벤트의 불변 로그 | emit B01Check(asset, manifestVersion, reasonCode, ts); Operator export |
| §3(c)(7)(A) 활성화 정합 (§3.4) | factsPacked ↔ RecipeId 상호 불변식 | B01-INV-1 검사; 위반 시 FAIL_FACTS_INCONSISTENT |
| §17(a)(1) 기록 수권 (§3.5) | Manifest = 규제 기록 지위 | 보존 양식 export 경로(§11) 상시 유지 |
| 17a-4(e)(7) 버전 보존 (§3.6) | ManifestRegistry append-only 사슬 | (coreHash, fullManifestHash, approvedAt, signers[], correctionOf) 튜플; retire = 상태 전환(삭제 아님) |
| 17a-4(f) audit-trail (§3.7~§3.8) | 온체인 hash 앵커 + watcher 대사 | fullManifestHash = keccak256(canonical(fullManifest)); 불일치 → status = SUSPENDED (서명 입력) |
| 301(b)(2) 변경 규율 (§3.9) | 다중서명 + time-lock 수명주기 | effectiveAt = approvedAt + delay; now ≥ effectiveAt에서 발효(이상); 정정 버전 correctionOf 사슬 |
| 302/303 작성·보존 (§3.10) | 신선도 필드 + 보존 정책 | (value, asOf, maxAge) 트리플; 로그 ≥ 3y, 버전 사슬 = 존속기간 |
| §17(a)·10b-5 책임 (§3.11~§3.12) | SUSPENDED 즉시 전환·상시 게이트 | R1·R2·R3 전 Recipe 필수 부착; 표시 오염 지속시간 최소화 |

**자기참조 차단 (설계 불변식).** B-01의 판정 파라미터(만료성 사실 목록·maxAge·delay 등)는 검사 대상인 Manifest 안이 아니라 별도의 거버넌스 상수(Element 레지스트리 설정)에 둔다 — 카드가 자기 검사의 기준을 스스로 정하는 순환(자기 인증)을 구조적으로 끊기 위해서다. 자산별 차등이 필요한 경우의 처리 방식은 OD-B01-6.

## §4. 입력 사실 (Input Facts)

### 4.1 판정에 필요한 데이터

| 입력 | 의미 | 출처 |
| --- | --- | --- |
| manifestEntry | ACM[asset]의 ManifestCore struct (존재 여부 포함) | Router 저장소 (on-chain, SLOAD) |
| status | ACTIVE / SUSPENDED / RETIRED | ManifestCore (채널 2·거버넌스가 서명 입력으로 전환) |
| coreVersion | 현재 참조 중인 카드 버전 식별자 | ManifestCore |
| approvedSet·approvedAt·delay | 승인된 버전 집합·승인 시각·time-lock 지연 | ManifestRegistry(거버넌스 컨트랙트) |
| factsPacked·RecipeId들 | fundForm·distributionStatus·restrictedFlag 등 + issuanceRecipeId·fundRecipeId·enabledResalePaths·supportedEngines | ManifestCore |
| freshness 필드들 | 만료성 사실의 (value, asOf) — outstandingUnits·totalAssetsUSD·NAV·distributionStatus 등 | ManifestCore / off-chain 전문(앵커 경유) |
| maxAge·만료성 목록·delay 값 | B-01 판정 파라미터 | 거버넌스 상수 (Element 레지스트리 — Manifest 밖, §3.20 자기참조 차단) |
| fullManifestHash | off-chain 전문의 온체인 앵커 | ManifestCore |
| offChainManifest | 전문(override 근거·법률 문서·governance config 포함) | Operator 보관소 (17a-4(f) 전자기록) — 채널 2만 접근 |
| governanceRecord | 버전별 m-of-n 서명·심사 이력·correctionOf 사슬 | ManifestRegistry + Operator 기록 |

### 4.2 데이터 출처와 책임경계

- **온체인 core가 판정의 유일한 hot-path 입력이다.** 채널 1(per-tx 게이트)은 ManifestCore·ManifestRegistry의 SLOAD와 순수 계산만으로 끝난다 — off-chain 조회·해시 재계산·외부 호출이 없다(온오프체인 하이브리드 원칙: hot path 경량 유지).

- **off-chain 전문은 채널 2의 관할이다.** 전문 접근·canonical 직렬화·해시 재계산·대사는 watcher가 hot path 밖에서 수행하고, 그 결론(불일치)만이 서명된 상태 입력(status = SUSPENDED)으로 온체인에 반영된다 — "판단은 상태가 되어야 효력이 있다"는 Operator 규칙의 B-01 판이다.

- **진실 ≠ 정합 (책임경계의 핵심).** 카드에 적힌 사실이 세상의 진실인가 — 예컨대 발행주식총수가 실제로 그 수인가, 펀드가 실제로 §3(c)(7) 구조로 조직됐는가 — 는 B-01의 판정 대상이 아니다. 진실성 확보의 소관: ① 온보딩 6단계 심사에서 Operator가 발행자 제출 초안을 검증·조정하고, ② 발행자가 사실 진실성을 보증하며(온보딩 통제 수단), ③ 운영 중의 반대정보는 A-12 채널이 flag한다. B-01은 그렇게 확립된 기록이 **승인 절차대로, 변조 없이, 자기모순 없이, 낡지 않게** 시스템에 반영되어 있는가만 본다. 이 경계를 지켜야 B-01이 결정론적 기계 판정으로 남는다(§8.2).

- **분모류 사실의 원천 대사는 소비 부품과 공동 규율이다.** outstandingUnits 같은 값의 "Securitize 명세 ↔ Manifest ↔ totalSupply" 3자 대사는 C-08(OD-C08-2)·D-01(OD-D01-1)과 공유하는 운영 규율이다 — B-01은 asOf·maxAge의 신선도 축을, 각 소비 부품은 자기 판정에서의 사용 축을 맡는다.

### 4.4 갈래별 필수 확인 항목 (전체 표)

공통 행(모든 거래) + 검사 갈래별 항목. "예시"가 아니라 갈래별로 반드시 확인해야 하는 항목 전체다.

| 갈래 | 공통 필수 | 갈래별 필수 |
| --- | --- | --- |
| ① 존재 (G) | asset 식별자 정규화(토큰 컨트랙트 주소) | ACM[asset] ≠ empty — 상장 자산인데 없으면 즉시 FAIL. Router의 passThrough(empty → 무검사 통과)는 비상장·비증권 토큰 전용이며, 상장 처리된 자산에는 적용되지 않는다 |
| ② 상태 (G) | 상동 | status = ACTIVE. SUSPENDED(채널 2 불일치·긴급 정지)·RETIRED(폐기) 모두 차단 |
| ③ 버전 (G) | 상동 | ⓐ coreVersion ∈ approvedSet ⓑ now ≥ approvedAt + delay(이상에서 발효) ⓒ 미폐기·미대체(superseded 아님) |
| ④ 불변식 (G) | 상동 | B01-INV-1~6 전부(§3.19): fundForm↔fundRecipeId·issuanceExemption↔issuanceRecipeId·resalePaths 포함관계·distribution⇒restrictedParties·필수 필드 존재·override 강화 방향 |
| ⑤ 신선도 (G) | 만료성 목록·maxAge를 거버넌스 상수에서 로드 | 대상 필드마다 now − asOf ≤ maxAge. 하나라도 > maxAge면 FAIL_FACT_STALE(어느 필드인지 코드에 병기) |
| 대사 (W) | canonical 직렬화 규칙(OD-B01-1) | ⓐ H(offChainManifest) = fullManifestHash ⓑ 버전 사슬 append-only·서명 완전성 ⓒ 불일치 시 SUSPENDED 서명 입력 + drift 경보 |
| 거버넌스 (GOV) | — | 버전 등록 시 m-of-n 서명·심사 이력·(정정이면) correctionOf 참조 — 미비하면 approvedSet에 진입 자체가 안 된다 |

## §5. 판정 로직 (Decision Logic)

### 5.1 개념 — 기계 판정형 2채널

B-01은 증명서를 확인하는 부품도, 누적 카운터를 갱신하는 부품도 아니다. 결정론적 성질(존재·상태·집합 소속·부등식·논리 함의)을 계산으로 확인하는 기계 판정형이며, 실행은 두 채널로 나뉜다.

- **채널 1 — per-tx 게이트 (moduleCheck, pre-trade)**: 매 거래에서 ①존재 → ②상태 → ③버전 → ④불변식 → ⑤신선도를 순서대로 검사. 순수 read + 계산, 상태 변경 없음(STATELESS).

- **채널 2 — 상시 대사 (watcher, hot path 밖)**: off-chain 전문을 canonical 직렬화해 해시를 재계산하고 온체인 앵커와 대사; 버전 사슬·서명 완전성 점검. 불일치는 게이트가 직접 소비하지 않고, 서명된 상태 입력(SUSPENDED)으로 변환되어 채널 1의 ②단계에서 나타난다.

D-01의 "게이트 + commit" 2단계가 하나의 거래 안에서 시간축으로 나뉜 것이라면, B-01의 "게이트 + 대사"는 실행 주체와 주기가 다른 **2채널 병행**이다 — 게이트는 거래마다, 대사는 상시로 돈다. 이 분리 덕에 hot path는 SLOAD 수 회로 유지되면서도 17a-4(f)(2)(i)(A)의 audit-trail 무결성이 상시 보증된다.

**실행 위치(중요).** Router의 흐름 — manifest 로드 → 적용 Recipe 식별 → Element union → 일괄 검사 — 에서 B-01은 union의 **첫 원소로 고정**된다. 이유는 의존성이다: 다른 모든 부품의 입력(상한값·활성 여부·경로 집합·명단)이 카드에서 오므로, 카드 검사가 뒤에 오면 앞선 부품들이 오염 가능성이 있는 사실로 판정을 마친 뒤가 된다. fail-fast 관점에서도 카드 오염은 그 거래의 다른 어떤 검사보다 먼저 알아야 할 사실이다. 한 가지 정직한 한계 — Recipe 식별 자체가 이미 core의 facts를 읽으므로, "식별 전 검사"는 불가능하다. 이 창은 구조로 닫는다: 식별이 읽는 대상과 B-01이 검사하는 대상이 **동일한 온체인 core**(별도 사본 없음)이고, ④불변식이 "facts가 가리키는 Recipe 집합"과 "실제 부착 집합"의 일치를 검사하므로, 오염된 facts로 잘못 식별된 조합은 union 첫 검사에서 모순으로 잡힌다.

### 5.2 판정 순서 (싸고 탈락 잘 되는 검사·선행조건 먼저)

증명서형(A-13)의 "존재 → 진위 → 신선도 → 갈래"와 구조적으로 상응하되, 대상이 사람의 claim이 아니라 자산의 카드다.

- **① 존재**: ACM[asset]이 비어 있으면 즉시 FAIL_MANIFEST_MISSING — SLOAD 1회, 가장 싸고 가장 치명적인 결손을 가장 먼저.

- **② 상태**: status ≠ ACTIVE면 FAIL_MANIFEST_SUSPENDED. 채널 2의 불일치 판정·Operator 긴급 정지·폐기가 모두 이 한 관문으로 수렴한다 — 게이트는 "왜 정지됐는지"를 몰라도 되고, 정지 사유는 로그·거버넌스 기록에 있다.

- **③ 버전**: coreVersion ∈ approvedSet ∧ now ≥ approvedAt + delay ∧ 미대체. 승인 밖 버전은 거버넌스 우회(단일 키 수정 등) 신호이므로 FAIL_VERSION_UNAPPROVED, 발효 전 버전은 FAIL_VERSION_PENDING으로 구분해 기록한다(사고 조사 시 성격이 다르다).

- **④ 불변식**: B01-INV-1~6의 cross-field 검사 — 비트 연산·널 검사·포함 관계·함의뿐이라 여전히 싸다. 어느 불변식이 깨졌는지 코드에 병기.

- **⑤ 신선도**: 만료성 목록을 순회하며 now − asOf ≤ maxAge. 목록·maxAge는 거버넌스 상수에서 로드(자기참조 차단). 가장 뒤에 두는 이유: 유일하게 필드 수에 비례하는 루프라 상대적으로 무겁고, 앞 단계 FAIL 시 순회 자체가 불필요하다.

- **[병행] 채널 2**: watcher가 주기적으로 H(offChainManifest)를 재계산해 앵커와 대사, 버전 사슬 점검. 하드 불일치(해시 상이) → SUSPENDED 서명 입력, 소프트 드리프트(사슬 메타데이터 결손 등) → REVIEW_MANIFEST_DRIFT 큐.

### 5.3 경계 매트릭스 (부등호 규율)

| 검사 | 법문·규율 문언 | 경계식 | 경계값에서의 결과 |
| --- | --- | --- | --- |
| time-lock 발효 | Reg ATS (b)(2)(ii) "at least 20 calendar days prior"의 내부 대응 | now ≥ approvedAt + delay → 발효 | now = approvedAt + delay 정확히 그 시각 → **발효(이상)**. 1초라도 전이면 FAIL_VERSION_PENDING |
| 신선도 | 302 "keep current"의 파라미터화 | now − asOf ≤ maxAge → 유효 | now − asOf = maxAge 정확히 → **유효(이하)**. 초과(>) 순간부터 FAIL_FACT_STALE |

[output truncated at 50000 of 67431 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007853
- Available tabs:
  • tabId 437007716: "(1) 7/8 | Notion" (https://app.notion.com/p/deciphersnu/7-8-398dff004c898098b1defb8a486ffa72)
  • tabId 437007853: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ce74a7c1-3ec8-449a-9a3a-bf463711e057/Element.B-01_신상카드-정합.md?table=block&id=39edff00-4c89-80a3-a4a9-c5090983d0ed&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=W4MMGrlGkaKIKUu2Xwy0JF6cebDSvr0XzR6Wb7A1XmE&downloadName=Element.B-01_신상카드-정합.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/ce74a7c1-3ec8-449a-9a3a-bf463711e057/Element.B-01_%E1%84%89%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A1%E1%86%BC%E1%84%8F%E1%85%A1%E1%84%83%E1%85%B3-%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%92%E1%85%A1%E1%86%B8.md?table=block&id=39edff00-4c89-80a3-a4a9-c5090983d0ed&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=W4MMGrlGkaKIKUu2Xwy0JF6cebDSvr0XzR6Wb7A1XmE&downloadName=Element.B-01_%E1%84%89%E1%85%B5%E1%86%AB%E1%84%89%E1%85%A1%E1%86%BC%E1%84%8F%E1%85%A1%E1%84%83%E1%85%B3-%E1%84%8C%E1%85%A5%E1%86%BC%E1%84%92%E1%85%A1%E1%86%B8.md)
  • tabId 437007854: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/e0247906-75da-4191-9e72-f003a1caf516/Element.B-02_토큰-표준.md?table=block&id=39edff00-4c89-80ec-9956-c82e78faf88c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=M4BejBlRmJ3Uy3HkzzdVszAiRu524mYsS4-weGXHkGo&downloadName=Element.B-02_토큰-표준.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/e0247906-75da-4191-9e72-f003a1caf516/Element.B-02_%E1%84%90%E1%85%A9%E1%84%8F%E1%85%B3%E1%86%AB-%E1%84%91%E1%85%AD%E1%84%8C%E1%85%AE%E1%86%AB.md?table=block&id=39edff00-4c89-80ec-9956-c82e78faf88c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=M4BejBlRmJ3Uy3HkzzdVszAiRu524mYsS4-weGXHkGo&downloadName=Element.B-02_%E1%84%90%E1%85%A9%E1%84%8F%E1%85%B3%E1%86%AB-%E1%84%91%E1%85%AD%E1%84%8C%E1%85%AE%E1%86%AB.md)
  • tabId 437007855: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/18bdcadc-1a89-416f-9362-eabc023738ab/Element.B-03_이전제한-메타데이터.md?table=block&id=39edff00-4c89-804d-80c8-c94b1202a0f4&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=zbmcKrV8ELMsGAp5lTTb7Ui2xrvvuqv28Tq1AlH6dao&downloadName=Element.B-03_이전제한-메타데이터.md" (
