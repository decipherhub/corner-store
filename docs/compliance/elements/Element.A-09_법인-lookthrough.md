# ELE.A-09_equity-owner-lookthrough

# A-09 지분 소유자 재귀 Look-Through / Equity Owner Look-Through — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 지분 소유자 재귀 look-through 부품(내부 식별자 A-09)을, 미국 펀드·증권 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 개발자·법무팀·외부 자문 변호사·학회원이 각자 작업의 base로 그대로 쓸 수 있도록 --- ① 이 규제가 어디서 왔고 왜 존재하는지, ② 어떤 사실을 입력받아 ③ 어떤 로직으로 판정하고 ④ 실패하면 어떻게 처리하며 ⑤ 어떤 테스트로 검증하는지를, 기술 요소마다 풀이를 함께 붙여 설명한다.
>
> **A-09의 한 줄 정의.** 매수인이 사람이 아니라 **회사·신탁일 때**, 그 법인을 하나의 '블랙박스'로 보지 않고 **그 소유 구조를 추적해**, 요구되는 각 소유자가 자격(R3=QP 또는 R1=AI)을 충족하는지를 거래 직전에 판정하는 **공유 재귀 엔진**이다. 종착점은 *독립적으로 자격이 확인된 owner node* 다 --- 소유자가 자연인이면 A-13/A-03에 위임하고, entity이면 A-08/A-13(A-03)로 **그 entity 자체가 QP/AI인지 먼저 확인**하며, 그 자격이 구성원에 의존하거나 formed-for-purpose 등 look-through trigger가 있을 때에만 A-09가 다시 재귀한다(자연인까지 내려가는 것은 필요한 경우의 보수적 구현). A-08(법인 자격 산정)·A-13(QP)·A-03(AI)이 entity 매수인에 대해 "구성원까지 봐야 한다"고 판단하면 A-09를 호출한다(상호 재귀).
>
> **자체완결 원칙.** 이 문서는 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 미국 연방법·연방규칙·SEC 발행문서 등 외부 공식 자료만 사용한다.

## 출처·버전 노트

- **인용 기준 일자**: 2026-07-01 조회. eCFR Title 17은 2026-06-08 최종 개정, 2026-06-17 기준 현행본 표시.

- **ICA §2(a)(51)·§3(c)(7)·§3(c)(1)** --- 15 U.S.C. §80a-2(a)(51)·§80a-3(c)(7)·§80a-3(c)(1), uscode.house.gov prelim edition. govinfo.gov/link/uscode/15/80a-2 딥링크도 동일 1차 출처.

- **Rule 2a51-1 / 2a51-2 / 2a51-3 / 3c-1** (17 C.F.R. §270.2a51-1·-2·-3·§270.3c-1) --- 1997년 채택본(62 FR 17512·17528, 1997-04-09). ecfr.gov 현행본.

- **Rule 501(a)(8)** (17 C.F.R. §230.501(a)(8) + Note 1) --- ecfr.gov 현행본.

- **SEC Release IC-22597** (62 FR 17512, 1997-04-09) --- sec.gov. Rule 2a51-1·2·3·3c-1·5·6의 adopting release.

- **v1.2 정정 요지** (A-08/A-13 v1 최종본 대조):
(1) **§2(a)(51)(A)(iii) 신탁 원문 정정** --- 종전 판의 신탁 말미 "...are qualified purchasers"를 **현행 uscode 진본 "...is a person described in clause (i), (ii), or (iv)"** 로 교체. 즉 신탁의 수탁자·각 출연자는 **(i)·(ii)·(iv)** 로만 QP 자격을 얻어야 하며 **(iii) 신탁으로는 인정되지 않는다**(신탁 겹치기 차단).
(2) **급조 신탁 = 치유 없는 FAIL** --- Rule 2a51-3의 "전원 QP면 치유"는 **(ii)·(iv) 회사 전용**이다. (iii) 신탁은 "not formed for the specific purpose"가 statute 요건이라 **급조면 (iii) 자체 탈락**이고 회사식 구제가 없다(§3.3·§5.2·§6.2).
(3) **자연인 (i)에는 급조 개념 미적용** --- "형성(formed)"되는 대상이 아니므로 급조 판단 자체가 없다.
(4) **권위 사슬 명시** --- look-through의 "요건 → 세는 법" 사슬은 **① Rule 2a51-3(a)[급조 회사 (ii)(iv) 요건] → ② §3(c)(1)·Rule 3c-1[누구를 beneficial owner로 세나] → ③ Rule 2a51-2[펀드층·간접소유·전환 consent]** 다. **2a51-2는 만능 look-through 근거가 아니라**, 매수인이 그 자체로 펀드(excepted investment company)일 때 연결된다(§3.6·§3.7).
(5) **claim.basis 정합** --- QP 갈래는 QP_FAMILY_COMPANY·QP_TRUST·QP_INSTITUTIONAL(iv)·QP_QIB, AI 갈래는 AI_ALL_EQUITY_OWNERS. "전원 QP/AI 통과"는 별도 basis가 아니라 **하위 카테고리 + lookThroughStatus=COMPLETED** 로 표현(A-08 §3.17과 일관).
(6) **R1+R3 AND는 R1이 그 거래에서 실제 활성일 때만** --- 과거 506(c) 발행 이력만으로 Rule 144 2차 이전에 buyer-AI look-through를 자동 재부과하지 않는다(§5.4·§9.3, A-13 §9.3·§9.4·A-08 §5.4와 정합).
(7) 개발자용 플로우차트 3종(그림 3.0 법조문 관계 / 그림 3.1.1 매수인 유형별 트리거 분기 / 그림 5.0 재귀 판정 로직)을 신탁/회사 구제 비대칭 반영해 재작도.

## §1 규제 맥락 (Context First)

### 1.1 두 개의 축, 그리고 A-09의 자리

미국 증권규제에는 A-09가 걸치는 두 개의 독립된 축이 있다 --- **① 증권 발행의 등록/면제**(Securities Act 1933, Reg D Rule 506(c) --- 매수인 전원 AI)와 **② 펀드의 투자회사 등록/면제**(Investment Company Act 1940 §3(c)(7) --- 보유자 전원 QP). BUIDL-like 토큰은 이 둘을 동시에 탄다. 매수인이 자연인이면 A-03(AI)·A-13(QP)이 그 사람 하나만 보면 끝이다. 그러나 매수인이 **법인·신탁**이면 "이 껍데기 뒤의 소유자들이 자격이 되는가"라는 별개의 질문이 생기고, 소유자 중에 또 법인이 있으면 그것도 뚫어야 하므로 이 질문은 **재귀적**이다.

이 재귀 추적을 A-13·A-03·A-08 본체에서 매번 반복하지 않도록 **하나의 원자적 부품으로 분리**한 것이 A-09다. A-09는 *지분 구조를 타고 내려가며 각 소유자의 자격을 확인하는 엔진*이며(entity 소유자가 자체로 QP/AI이면 그 지점에서 종료, 필요한 경우에만 자연인까지 재귀), 자연인에 닿으면 그 사람의 자격 판정을 다시 A-13(QP)/A-03(AI)에 위임한다. 요컨대 **A-08이 "이 법인을 어느 조항 칸에 넣고 look-through가 필요한가"를 판정(라우팅)하면, A-09가 "그 look-through를 실제로 수행"한다.**

### 1.2 왜 look-through가 필요한가 — anti-circumvention·도관(conduit) 차단

법인은 자격 우회의 통로가 될 수 있다. 무자격자 여럿이 회사·신탁 껍데기를 만들어 그 뒤에 숨거나, 이 거래만을 위해 회사를 *급조*(formed for the specific purpose)해 형식을 맞추는 식이다. 미국법은 이를 두 겹으로 막는다 --- **① 급조 회사·신탁 배제**(취득 목적 설립 주체는 원칙적으로 자격 불인정), **② look-through**(각 소유자가 자격을 갖추는지 확인 --- 필요한 경우 자연인까지 추적). look-through 개념의 뿌리는 ICA §3(c)(1)(A)의 "Look-Through Provision"이고, SEC는 그 목적을 채택 릴리스에서 명시했다.

```text
To prevent circumvention of the 100-investor limit, section 3(c)(1)(A)
(the "Look-Through Provision") requires, in some instances, that a fund
seeking to rely on section 3(c)(1) "look through" certain companies
(e.g., corporations, partnerships and other investors that are not
natural persons) that hold its voting securities and count the company's
security holders as beneficial owners of the fund's securities.
— SEC Release IC-22597, §I.B (62 FR 17512, Apr. 9, 1997)
```

핵심 우려는 **도관(conduit)** 이다 --- 투자자가 "*a conduit that was created to enable a Section 3(c)(1) Fund to have indirectly more than 100 investors*"(IC-22597 n.19)일 수 있다는 것. QP 맥락에서도 같은 논리가 Rule 2a51-3(회사)과 statute §2(a)(51)(A)(iii)(신탁)으로 이식됐다. A-09 설계 부담의 대부분이 이 anti-circumvention 논리에서 나오며, 급조 판정·자연인 종착·전원-충족 AND-gate가 그 구조물이다.

### 1.3 왜 한 부품이 QP(R3)와 AI(R1) look-through를 함께 다루나

QP(적격매수자)와 AI(적격투자자)는 서로 다른 기준이지만(투자자산 $5M·$25M vs 순자산/자산 $1M·$5M), *법인일 때 소유자를 타고 내려가는 절차*는 구조가 같다 --- 소유자 순회 → 자연인이면 개별 위임, 법인이면 한 겹 더 재귀 → 요구되는 소유자 전원이 자격이면 통과. A-09는 이 공통 재귀를 한 엔진으로 구현하고, "이번 거래에서 QP를 볼지 AI를 볼지"는 **활성 Recipe**와 A-08이 넘긴 카테고리에 따라 분기한다. 어느 카테고리 *정의*로 leaf를 판정할지는 A-13/A-03이 제공한다.

다만 **두 축의 급조 처리가 다르다는 점**이 A-09가 반드시 기억해야 할 비대칭이다(§3.3·§5.2에서 상술) --- R3(QP) 쪽 (ii)(iv) 회사는 Rule 2a51-3(a)가 "급조여도 전원 QP면 통과"라는 구제를 조문에 내장하지만, R1(AI) 쪽 직접 자산 path((a)(3)(7)(9)(12))는 조문 자체가 "not formed for the specific purpose"를 요건으로 해 **급조 entity는 그 path로 통과 불가**이고 오직 (a)(8)(전원 지분권자 AI)로만 살아난다. 그리고 R3 신탁(iii)은 급조면 아예 치유가 없다.

### 1.4 A-03·A-13·A-08과의 분업 (왜 A-09가 따로 있나)

A-03(AI)·A-13(QP)은 *"무엇이 자격을 만드는가"* 라는 **카테고리 정의**를, A-08은 *"이 법인을 어느 칸에 넣고 look-through가 필요한가"* 라는 **entity-level 라우팅**을 담당한다. A-09는 그중 look-through가 필요할 때 켜지는 **재귀 실행 엔진**이다.

---------------------------------------------------------------------------------------------------
부품 담당 자연인 매수인 법인·신탁 매수인
----------------- --------------------------- -------------------- --------------------------------
A-03 / A-13 카테고리 *정의* **직접 판정** 카테고리 *기준*만 제공
(claim.basis 메뉴) (leaf 위임 수신)

A-08 entity-level *분류·임계값· 비활성(dormant) **활성 --- 분류·급조 판정 후
급조·라우팅·결합* look-through 필요 시 A-09 호출**

**A-09** **지분 *재귀 look-through 종착(자격 확인된 노드 → **활성 --- 소유자 그래프를
실행 엔진*** A-13/A-03 위임) 필요 시 자연인까지 재귀 추적·AND 집계**

A-06 발행자 *affiliate/control* (별개 축) (별개 축 --- look-through 중
판정 발견돼도 A-09 아님, A-06)
---------------------------------------------------------------------------------------------------

**쉽게 말하면.** A-03/A-13이 "법전의 자격 조항"이고 A-08이 "매수인이 회사일 때 어느 칸에 넣고 주주를 더 봐야 하는지 결정하는 분류 창구"라면, A-09는 **그 주주를 실제로 타고 내려가는 재귀 엔진**이다. 양파(법인) 안에 또 양파(법인)가 있으면 계속 까고, 진짜 알맹이(사람)가 나오면 A-13/A-03에게 "이 사람 자격 돼?"라고 묻는다. look-through 중에 발견되는 *발행자 지배관계인(affiliate)* 판정은 A-06 소관이지 A-09가 아니다(별개 축).

### 1.5 Existential Risk — 왜 한 껍데기 안의 한 명이 펀드 전체를 무너뜨리나

§3(c)(7) 펀드는 **모든** 보유자가 취득 시점에 QP여야 면제가 성립한다(15 U.S.C. §80a-3(c)(7)(A)). 법인 매수인 하나가 잘못 통과하면 --- 예컨대 3겹 신탁·회사 뒤에 숨은 비-QP 한 명을 놓치면 --- 펀드 전체의 투자회사 등록 면제가 무너진다(fund-level existential consequence). 그래서 A-09의 재귀는 *요구되는 각 소유자가 독립적으로 자격이 확인될 때까지* 내려가야 하며(entity가 자체 자격이면 그 노드에서 종료, 필요한 경우 자연인까지), 전원-충족이 요구되는 구조에서는 **한 명이라도 비자격이면 전체를 차단**한다. 이 "한 명이 전체를 무너뜨린다"는 성질이 A-09를 자격형 부품 중에서도 특히 조심스럽게 만든다. 다만 이 위험을 *절대적 객관 보장 의무*로 오해하면 안 된다 --- Rule 2a51-1(h)는 §3(c)(7)상 QP에 Relying Person(펀드·그 대리인 = Trusted Issuer)이 *합리적으로 QP라고 믿는* 자까지 포함하므로, A-09의 법적 목적은 모든 사실을 온체인에서 절대 보장하는 것이 아니라 Trusted Issuer의 서명된 `ownershipGraph`·leaf claim으로 그 *합리적 믿음의 구조적 근거*를 남기는 데 있다(§8.3). 반대로 자격 있는 정상 구조를 데이터 미비만으로 오차단하면 정당한 유동성을 잃으므로, A-09는 *판단 불가*(미식별·깊이 초과)를 자동 FAIL이 아니라 **사람 검토(REVIEW)** 로 보낸다(§6.2).

### 1.6 한국법 비교 (참고)

한국법에도 껍데기를 뚫는 발상은 있다 --- 자금세탁방지 맥락의 **실질소유자(beneficial owner) 확인** 의무가 대표적으로, 법인 고객의 25% 이상 지분 보유 자연인을 끝까지 식별하도록 한다(특정금융정보법·시행령). 다만 이는 *KYC·제재* 목적의 관통이고, 미국식 look-through는 *투자자 자격(QP/AI) 판정* 목적이라는 점에서 결이 다르다 --- 특히 미국의 **"취득 목적 설립 금지(anti-circumvention)"** 와 **자격 임계값까지 결합한 재귀 look-through**처럼 지분 구조를 (필요한 경우 자연인까지) 추적해 *자격형 게이트*를 세우는 장치는 한국 자본시장법 전문투자자 체계에 아직 정립되어 있지 않다. A-09 설계 부담 대부분은 이 미국 특유의 anti-circumvention 논리에서 나온다(자세한 매핑은 별도 과제).

## §2 메타 정보 (Internal Identifier Box)

-----------------------------------------------------------------------
항목 값
----------------------------------- -----------------------------------
**부품 ID** A-09

**부품 이름** 지분 소유자 재귀 Look-Through /
Equity Owner Look-Through

**카테고리** A --- 신원·자격 (매수인 측, 공유
재귀 엔진)

**검사 대상(한 줄)** "법인·신탁 매수인의 지분 구조를
각 소유자 자격 확인(필요 시 자연인까지)해, *요구되는
소유자 전원*이 그 거래에서 요구되는
자격(R3=QP · R1=AI)을 충족하는가"

**활성 Recipe** **R3 (ICA §3(c)(7) Fund)** ---
조건부(법인·신탁 매수인 +
look-through 필요) · **R1 (Reg D
506(c) Issuance)** ---
조건부(법인 매수인 + (a)(8) 전원-AI
경로 + R1 실제 활성). **R1·R3 동시
실제 활성 시 각 track look-through를
AND** (§5.4·§9.3)

**활성 조건** A-08/A-13/A-03이 **entity 매수인**에
대해 look-through가 필요하다고 판정해
호출할 때만(자연인 매수인 시
dormant). R1 track은 그 거래가
실제로 buyer-AI를 요구할 때만 ---
과거 발행 이력으로 자동 소환
아님(§5.4)

**Cascade Element** **A-13 / A-03**(자연인 leaf 개별
자격 위임 --- 상호 재귀) ·
**A-08**(소유자 중 중첩 entity의
재분류) · **A-06**(look-through 중
발행자 affiliate 발견 시, 별개 축) ·
A-04(신원 중복, 분리 카운트 연동) ·
A-11(claim 만료) · B-01(manifest
정합)

**Timing / Stateful** pre-trade / 판정 로직 STATELESS
(같은 입력이면 같은 결과;
ownershipGraph 자체는 off-chain
상태로 Trusted Issuer가 관리)

**검증 패턴** \(B\) 증명서 확인형 --- A-09는 새
oracle을 더하지 않고, *서명된 지분
구조 claim* + *자연인 leaf 위임
claim*을 재귀적으로 조합(AND)한다.
법적 토대 = Rule 2a51-1(h)
reasonable belief(QP) · Rule
506(c)(2)(ii) reasonable
steps(AI) (§8)

**핵심 훅** lookThroughStatus = COMPLETED \|
PENDING \| FAILED --- A-08·A-13·A-03의
PASS 게이트가 entity 매수인에 한해
이 값을 AND 조건으로 건다

**성숙도** 🟡 재귀 깊이(MAX_DEPTH)·partial
ownership 처리 미확정(§12) ---
법조문·판정 골격은 확정. A-13 Open
Issue(look-through depth)와 직결

**파일·위치** A-09_equity-owner-lookthrough.md ·
산출물/elements/
-----------------------------------------------------------------------

> **쉽게 말하면.** A-09는 "혼자 판단하는 부품"이 아니라 **A-08·A-13·A-03의 보조 재귀 엔진**이다. A-13이 "이 매수인이 QP인가?"를 묻다가 매수인이 가족회사·신탁이면 A-08이 "그럼 그 뒤 사람들을 봐야 한다"고 A-09를 부른다. A-09는 껍데기를 한 겹씩 벗겨 자연인에 닿을 때까지 내려가고, 닿으면 다시 A-13/A-03에 "이 사람 자격 돼?"를 묻는다. 그 결과를 모아 **전원 통과면 `COMPLETED`**, 한 명이라도 막히면 **`FAILED`**, 데이터가 모자라면 **`PENDING`**(사람 검토)을 돌려준다.

## §3 ① 법적 근거 (Layer 1 → 2 → 3)

**읽는 법.** 법적 근거는 세 겹이다 --- **Layer 1**(조문)은 의회가 만든 법률 텍스트(statute), **Layer 2**(규칙)는 SEC가 그것을 실무 수준으로 구체화한 연방규칙(rule), **Layer 3**(해석)은 SEC 발행문서·No-Action Letter·판례가 모호한 부분을 메운 해석이다. 아래 **§3.0.2 표 1의 종류 칸이 그대로 Layer에 대응**한다 --- Statute = Layer 1, SEC Rule = Layer 2, SEC Release·Case = Layer 3. 본 절은 조문이 작동하는 **논리 흐름 순서**로 배열돼 §3.1\~§3.11 번호를 유지하며(중요도순 아님), 각 항목이 어느 Layer인지는 표 1로 확인한다. 각 조문 블록은 6-필드(조항 → 핵심 원문 → 한국어 → 쉬운 설명 → PASS/FAIL 반영 → ERC-3643 변환)로 푼다. **원문의 금액은 법전 그대로(`$5,000,000`)**, 본문 prose는 `$5M`으로 약칭한다. "not less than"은 `≥`, "in excess of"는 `>`로 옮긴다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 entity 매수인이 들어왔을 때 A-09가 타는 전체 흐름을 하나로 정리한 것이다 --- 거래에 켜진 게이트(R3=QP·R1=AI) → 매수 주체 분류(개인·회사·신탁) → **회사면 급조?(Rule 2a51-3 (ii)(iv)) / 신탁이면 급조?(statute (iii))** 로 갈리는 트리거 분기 → 누구를 세나(§3(c)(1)·3c-1, 펀드층은 2a51-2) → 소유자 재귀 → 자연인 도달 시 A-13/A-03 위임 → 요구되는 소유자 전원 자격 → `lookThroughStatus` COMPLETED/FAILED. **핵심은 회사(급조→전원 QP 구제 내장)와 신탁(급조→치유 없는 탈락)의 비대칭**을 노드로 명시한 점이다. 각 조항 상세는 §3.1\~§3.11(특히 유형별 트리거는 §3.2.1, 2a51-3 vs 2a51-2 분담은 §3.6.1).

![그림 3.0 --- look-through 법조문 관계 흐름: 게이트에서 유형 분기, 급조 처리(회사/신탁 비대칭), 재귀·위임, COMPLETED/FAILED까지 (개발자용)](fig30.png)

**범례.**

- **파랑** = 핵심 조문·규칙(Direct) --- 유형별 자격 근거·급조 look-through·카운팅

- **회색** = 분기·판정 노드

- **초록** = 통과(PASS)·카브아웃(개인=look-through 불필요, `COMPLETED`)

- **빨강** = 탈락(FAIL) --- 비자격 소유자·급조 신탁 (iii) 탈락

- **주황** = 재귀 고리(A-09 self-call, depth cap)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

§3.0이 일반 법조문 흐름이라면, 이 절은 BUIDL-*like* §3(c)(7) 펀드 지분에 A-09가 어떻게 걸리는지를 보여준다. **(재확인) 본 서술은 실제 BlackRock BUIDL의 발행 표준·transfer architecture를 단정하지 않는다 --- BUIDL-like §3(c)(7) private fund interest를 ERC-3643 테스트 토큰으로 모델링한 것이다.** BUIDL은 발행 Rule 506(c)·펀드 구조 ICA §3(c)(7)·최소 청약 $5M이고, ERC-3643(T-REX) 가정 하에서 Securitize가 자격 claim의 Trusted Issuer가 된다.

**A-09 관점 --- 언제 켜지나.** BUIDL의 전형적 매수인은 운용사·기관·SPV 등 **법인**이다. 이들이 QP가 되는 실제 경로는 **(g)(1) QIB 간주**(A-08 §3.10)나 **(iv) $25M 재량운용**이 많은데, 이 두 경로는 *법인 자체*가 자격을 얻으므로 **A-09 look-through가 불필요**하다(A-08이 직접 PASS). A-09가 실제로 켜지는 것은 매수인이 **가족회사(ii)·신탁(iii)** 이거나, **급조된 SPV**((ii)(iv) 회사)로서 2a51-3(a)가 전원 QP를 요구할 때, 또는 발행(R1) 단계에서 그 법인이 **(a)(8) 전원-AI entity**로 제출될 때다. 즉 A-09는 "*자격을 구성원에게서 빌려 오는*" 매수인에 한해 켜지는 조건부 엔진이다.

**같은 $5M, 다른 개념 주의.** BUIDL 청약 최소액 $5M은 발행자가 정한 조건(변경 가능)이고, 가족회사(ii)의 investments $5M은 법정 요건이며 서로 다르다. 그리고 **신탁(iii)에는 자체 $5M 문턱이 아예 없다** --- (iii)의 요건은 "급조 아님 + 수탁자·각 출연자가 (i)(ii)(iv) QP"이지 신탁 자산 규모가 아니다(종전 판의 "$5M+ 신탁" 표현은 오류였다 --- §3.3).

**검증은 누가 --- Securitize = Trusted Issuer, A-09는 구조 claim을 재귀 조합.** ERC-3643 가정 하에서 Securitize가 off-chain에서 지분 구조(누가 실소유자인가, 친족·위탁자 관계가 사실인가)를 실사·서명하고, 자연인 leaf마다 QP/AI claim을 발급한다(Rule 2a51-1(h)·506(c)(2)(ii)). 온체인 A-09는 그 구조를 다시 조사하지 않고, 서명된 지분 구조 위에서 재귀 순회·전원-충족 AND·자연인 위임만 수행해 `lookThroughStatus`를 확정한다(§8).

![그림 3.0.1 --- BUIDL 적용: QIB·$25M 직접 자격은 A-09 불요, 가족회사·신탁·급조 SPV·(a)(8) entity에서만 look-through 발동](fig31.png)

### 3.0.2 조문 순서·중요성 한눈에 보기 (표 1·표 2)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거가 어떤 종류(=Layer)이고 무슨 내용이며 A-09에 어떻게 닿는지를, **표 2**(순서·중요성)는 §3.1\~§3.11 소단원의 읽는 순서(논리 흐름)와 중요성(A-09가 실제로 그걸로 판정하는가)을 보여준다. 순서는 중요도순이 아니라 흐름순이다. 제정법 출처는 uscode.house.gov로 통일했으며 govinfo.gov/link/uscode/… 딥링크도 동일한 1차 출처다.

**표 1 --- Authority(근거 목록)**

--------------------------------------------------------------------------------------------------------------------------------
종류 Authority 내용 A-09 관련성 Direct/Supporting Official URL
----------- -------------------------------------------- --------------------------------------------- ------------------------------- ------------------- -----------------
Statute ICA §3(c)(7)(A) · 15 U.S.C. §80a-3(c)(7)(A) 보유자 전원 QP + 공모 금지 look-through 결과가 걸리는 곳 Supporting uscode.house.gov
(Condition 1·2) (전원 QP 데이터 요구)

Statute ICA §3(c)(1)(A) · 15 U.S.C. §80a-3(c)(1)(A) Look-Through Provision --- 회사 보유 시 **재귀의 뿌리**(왜 뚫나) Supporting uscode.house.gov
그 회사의 holder를 count + 카운팅 기준

Statute ICA §2(a)(51)(A)(i)\~(iv) · 15 U.S.C. QP 4갈래(개인 $5M·가족회사 $5M·신탁· **look-through 대상 분기** Direct uscode.house.gov
§80a-2(a)(51)(A) $25M 재량) (유형→트리거)

Statute ICA §2(a)(51)(A)(iii) · 동 신탁 QP --- 급조 아님 + 수탁자·각 출연자가 **신탁 look-through** Direct uscode.house.gov
(i)(ii)(iv) (급조=탈락·치유 없음)

Statute ICA §2(a)(51)(A)(iv) · 동 $25M 재량운용 any person QP 급조 (iv)면 2a51-3(a) 적용; Conditional uscode.house.gov
자체 자격 시 look-through 불요

SEC Rule 17 C.F.R. §270.2a51-3(a)·(b) 목적형성 회사 look-through ((ii)(iv) 한정) **급조 회사 전원-QP 트리거** Direct ecfr.gov
--- (a) 강제 / (b) 전원 QP 구제 (구제 내장)

Statute· ICA §3(c)(1) · 17 C.F.R. §270.3c-1 누구를 beneficial owner로 세나(1차 기준) **카운팅 기준** Direct ecfr.gov
Rule (그 '전원'이 누구)

SEC Rule 17 C.F.R. §270.2a51-2(a) excepted investment company의 BO 산정 · 펀드·전환 매수인일 때 Conditional ecfr.gov
간접소유 · 전환 consent 간접소유 추적

Statute ICA §2(a)(51)(C) · 15 U.S.C. excepted investment company(fund-of-funds) 매수인이 그 자체로 펀드일 때 Background uscode.house.gov
§80a-2(a)(51)(C) --- pre-1996 보유자 consent (신규 §3(c)(7)엔 대개 N/A)

SEC Rule 17 C.F.R. §230.501(a)(8) + Note 1 전원 지분권자 AI인 entity · **Track B(R1) 전원-AI** Direct (Track B) ecfr.gov
자연인까지 look-through 허용 look-through

SEC Release SEC Release IC-22597, 62 FR 17512 (1997) look-through = 우회 방지, 표적은 도관(conduit) 두 track look-through 정책 출처 Supporting sec.gov

Case SEC v. Ralston Purina Co., 346 U.S. 119 "사정에 밝은(able to fend for themselves)" 도관 아닌 정상 구조 취지 Background govinfo.gov
(1953) 투자자 → 등록 불요의 원리 (operating company 제외)
--------------------------------------------------------------------------------------------------------------------------------

> 인용 원칙 --- 영문 원문은 위 1차 출처에서 verbatim 확보. `uscode.house.gov`는 본문 fetch가 불안정해 동일 텍스트를 `govinfo.gov`(USCODE 패키지)로 교차 검증했고, SEC IC-22597 각주(n.8·n.19)로 다시 대조했다. aggregator(law.cornell·Justia)는 본문 인용에 쓰지 않았다.

**표 2 --- 순서·중요성(논리 흐름순)**

----------------------------------------------------------------------------------------------------------------
순서 조문 중요성 A-09가 그걸로 하는 일
-------- --------------------------------------- -------- --------------------------------------------------------
§3.1 §3(c)(7)(A) + §3(c)(1)(A) ★★ "왜 뚫나" --- 전원 QP 요구와 conduit 차단의 근거

§3.2 §2(a)(51)(A)(i)\~(iv) ★★★ 매수 주체를 개인·가족회사·신탁·$25M로 분류 → 트리거 결정

§3.3 §2(a)(51)(A)(iii) 신탁 ★★★ 신탁이면 급조=탈락 검사 + 수탁자·각 출연자 (i)(ii)(iv) 추적

§3.4 Rule 2a51-3 (ii)(iv) 회사 ★★★ 급조 회사면 전원 QP 강제(구제 내장); 비급조 (b) 구제

§3.5 §3(c)(1)·Rule 3c-1 ★★★ "그 전원"을 누구로/몇으로 세는지 1차 기준

§3.6 Rule 2a51-2 ★★ 매수인이 펀드·전환이면 간접소유·펀드층 산정

§3.7 §2(a)(51)(C) ★ 매수인이 fund-of-funds면 pre-1996 consent 인지(대개 N/A)

§3.8 Rule 501(a)(8) + Note 1 ★★★ Track B(발행)에서 전원-AI entity look-through

§3.9 판례·발행문서(IC-22597·Ralston) ★★ 급조/도관 판단과 정상회사 제외의 정책 근거

§3.10 Sub-요건 분해 매트릭스 --- 조문을 원자 검증 단위로 분해(입력 필드 매핑)

§3.11 ERC-3643·claim.basis 총정리 --- 카테고리별 claim.basis·lookThroughStatus 총람
----------------------------------------------------------------------------------------------------------------

### 3.1 ICA § 3(c)(7)(A) — 보유자 전원 QP·공모 금지 (look-through를 요구하는 근원) \[🔗 uscode.house.gov\]

- **조항**: 15 U.S.C. §80a-3(c)(7)(A) --- uscode.house.gov

- **핵심 원문** (15 U.S.C. §80a-3(c)(7)(A)):

```text
Any issuer, the outstanding securities of which are owned exclusively by
persons who, at the time of acquisition of such securities, are qualified
purchasers, and which is not making and does not at that time propose to
make a public offering of such securities. Securities that are owned by
persons who received the securities from a qualified purchaser as a gift
or bequest, or in a case in which the transfer was caused by legal
separation, divorce, death, or other involuntary event, shall be deemed
to be owned by a qualified purchaser, subject to such rules, regulations,
and orders as the Commission may prescribe ...
```

- **한국어.** 그 발행 증권이, 해당 증권의 취득 시점에 qualified purchaser인 자들에 의하여 **배타적으로(exclusively)** 소유되고, 그 시점에 해당 증권의 public offering(공모)을 하고 있지 아니하며 또한 그때 이를 하려고 제안하지도 아니하는 모든 issuer. 증여(gift)·유증(bequest)으로, 또는 법적 별거·이혼·사망·그 밖의 비자발적 사건(involuntary event)에 의하여 받은 증권은 qualified purchaser가 소유한 것으로 본다 ...

- **쉽게 말하면.** §3(c)(7) 면제에는 두 조건이 있다 --- ① "모든 지분이 취득 시점에 QP에게 배타적으로 소유"(Condition 1), ② "공모를 하지 않음"(Condition 2). A-09는 Condition 1의 **"모든 보유자 QP"** 를 *매수인이 법인일 때* 실질적으로 보장하는 장치다 --- 법인 껍데기를 세워 그 뒤에 비-QP를 숨기면 이 "전원 QP"가 형식만 충족되고 실질이 깨지므로, 껍데기를 뚫어 진짜 소유자를 본다. 이 "뚫어 센다"의 개념적 뿌리가 ICA **§3(c)(1)(A)의 Look-Through Provision**(회사가 펀드 지분을 보유하면 그 회사의 holder를 펀드의 beneficial owner로 count)이며, SEC는 그 목적을 "*to prevent circumvention*"(IC-22597 §I.B)이라 밝혔다(§3.9). Condition 2(공모 금지)는 부품 하나로 끝나지 않고 DEX 거래환경 전체에 걸리는 Recipe-level 문제로 §9·§12에서 별도로 다룬다.

- **PASS/FAIL 반영.** 간접(Supporting) --- A-09가 직접 이 조문을 PASS/FAIL로 코딩하지는 않는다. 대신 A-09의 출력(`lookThroughStatus`)이 *이 "전원 QP" 요건을 법인 매수인에 대해 충족시키는 증거*가 된다. A-13의 Condition 1 PASS 게이트가 entity 매수인에 대해 `lookThroughStatus=COMPLETED`를 AND로 건다.

- **ERC-3643 변환.** transfer 시 A-13의 `Compliance.canTransfer()`가 entity 매수인에 대해 `lookThroughStatus==COMPLETED`를 필수 조건으로 요구 → 미완료·실패면 이전 거부. 비자발적 이전 = `forcedTransfer()`/`recovery()` 예외(Rule 3c-6, A-13 소관).

### 3.2 ICA § 2(a)(51)(A)(i)\~(iv) — QP 4갈래 (look-through 대상 분기) \[🔗 uscode.house.gov\]

- **조항**: 15 U.S.C. §80a-2(a)(51)(A) --- uscode.house.gov

- **핵심 원문** (15 U.S.C. §80a-2(a)(51)(A)):

```text
"Qualified purchaser" means— (i) any natural person (including any person
who holds a joint, community property, or other similar shared ownership
interest in an issuer that is excepted under section 80a-3(c)(7) of this
title with that person's qualified purchaser spouse) who owns not less
than $5,000,000 in investments, as defined by the Commission; (ii) any
company that owns not less than $5,000,000 in investments and that is
owned directly or indirectly by or for 2 or more natural persons who are
related as siblings or spouse (including former spouses), or direct
lineal descendants by birth or adoption, spouses of such persons, the
estates of such persons, or foundations, charitable organizations, or
trusts established by or for the benefit of such persons; (iii) any trust
that is not covered by clause (ii) and that was not formed for the
specific purpose of acquiring the securities offered, as to which the
trustee or other person authorized to make decisions with respect to the
trust, and each settlor or other person who has contributed assets to the
trust, is a person described in clause (i), (ii), or (iv); or (iv) any
person, acting for its own account or the accounts of other qualified
purchasers, who in the aggregate owns and invests on a discretionary
basis, not less than $25,000,000 in investments.
```

- **한국어.** "Qualified purchaser"란 --- (i) Commission이 정하는 investments를 `≥ $5,000,000` 보유한 모든 자연인(§3(c)(7) 면제 issuer에서 QP인 배우자와 공유지분을 보유하는 자 포함); (ii) investments를 `≥ $5,000,000` 보유하고, 형제·배우자(전 배우자 포함)·직계비속(출생/입양)·그 배우자·그 유산·또는 그들을 위해 설립된 재단·자선단체·신탁에 의하여 직접·간접으로 소유되는 모든 회사; (iii) clause (ii)에 포섭되지 않고, 제공되는 증권 취득을 특정 목적으로 형성되지 않은 신탁으로서, 결정 권한 있는 수탁자와 자산을 출연한 각 위탁자가 **clause (i)·(ii) 또는 (iv)에 기술된 자**인 신탁; 또는 (iv) 자기 또는 다른 QP들의 계산으로, 총계로 재량적 기준으로 investments를 `≥ $25,000,000` 소유·투자하는 모든 자(any person).

- **쉽게 말하면.** (i)은 개인, (ii)는 가족회사, (iii)은 신탁, (iv)는 $25M 재량운용자다. 문턱은 개인·가족회사 `$5M`, (iv) `$25M`이며 모두 `≥`(not less than, 포함)이다. **(iv)는 흔히 "기관"으로 줄여 부르면 안 된다** --- 조문 문언은 "기관"이 아니라 *자기 또는 다른 QP들의 계산으로 재량으로 $25M 이상을 운용하는 모든 자*, 즉 any person이다(운용사·기관이 전형적일 뿐). A-09에 중요한 것은 **(ii)와 (iii)은 그 안의 사람들까지 따져야 자격이 정해진다**는 점 --- 이것이 look-through의 대상 분기다. (i) 개인은 그 사람만 보면 되고 "형성"되는 대상이 아니라 급조 판단 자체가 없다.

- **PASS/FAIL 반영.** 직접 ○ --- 매수 주체가 어느 clause에 해당하는지가 A-09의 **트리거·모드**를 결정한다((ii) 가족회사=구성 확인 또는 급조 시 전원 QP / (iii) 신탁=급조 검사 + 전원 QP / (iv)=자체 자격 또는 급조 시 전원 QP / (i)=look-through 없음).

- **ERC-3643 변환.** claim.basis ∈ {QP_NATURAL, QP_FAMILY_COMPANY, QP_TRUST, QP_INSTITUTIONAL}. entity 갈래((ii)(iii)(iv))는 `lookThroughStatus`를 동반 필드로 싣고, A-09가 이를 COMPLETED로 채운다.

### 3.2.1 매수인 유형별 look-through 트리거 분기 — 개인 vs 회사 vs 신탁

매수인의 유형이 **look-through를 켤지, 그리고 어떤 근거로 켤지**를 가르는 스위치다. 세 갈래가 서로 다른 조문에 걸린다는 점이 A-09 로직의 핵심이며, 이를 그림 3.0.1이 한 장으로 보여준다.

**① 개인 (i).** 그 사람만 QP/AI인지 보면 끝이다. look-through 불필요. "형성"되는 대상이 아니므로 급조(formed for the specific purpose) 판단도 적용되지 않는다.

**② 회사 (ii)·(iv) --- Rule 2a51-3.** 회사가 매수인이면 **급조 여부**가 경로를 가른다. 급조 회사(§3.4 (a))는 각 beneficial owner가 **전원 QP** 여야 인정된다(look-through 강제, 구제 내장 --- 전원 QP면 통과). 비급조 회사는 자체 자산으로 (ii)/(iv)를 충족하거나 Rule 2a51-3(b)의 "전원 QP면 인정"을 쓴다. **적용 대상은 (ii)·(iv) 회사 두 갈래뿐이다.**

**③ 신탁 (iii) --- statute 자체.** 신탁의 look-through는 Rule 2a51-3이 아니라 **statute §2(a)(51)(A)(iii)** 가 규정한다. 요건은 두 가지 --- ⓐ **급조가 아닐 것**(not formed for the specific purpose), ⓑ 수탁자와 **각 위탁자·출연자가 (i)·(ii)·(iv)에 기술된 QP** 일 것. 여기서 회사와 결정적으로 다른 두 가지: **급조 신탁은 (iii) 자체가 탈락**이라 회사가 받는 "전원 QP면 치유"가 **없고**, 출연자는 (i)(ii)(iv)로만 QP가 될 수 있어 **(iii) 신탁을 또 끼워 넣는 겹치기가 차단**된다.

> **왜 이 분기가 핵심인가.** "급조인데 전원이 자격이면?"에 대한 답이 유형마다 다르다 --- **회사는 통과(구제 내장), 신탁은 탈락(구제 없음), 개인은 질문 자체가 성립 안 함.** A-09가 이 셋을 하나로 뭉뚱그리면 급조 신탁을 잘못 통과시켜 펀드 면제를 위태롭게 한다.

### 3.3 ICA § 2(a)(51)(A)(iii) — 신탁 look-through (급조=치유 없는 탈락) \[🔗 uscode.house.gov\]

- **조항**: 15 U.S.C. §80a-2(a)(51)(A)(iii) --- uscode.house.gov

- **핵심 원문** (15 U.S.C. §80a-2(a)(51)(A)(iii)):

```text
any trust that is not covered by clause (ii) and that was not formed for
the specific purpose of acquiring the securities offered, as to which the
trustee or other person authorized to make decisions with respect to the
trust, and each settlor or other person who has contributed assets to the
trust, is a person described in clause (i), (ii), or (iv);
```

- **한국어.** clause (ii)에 포섭되지 아니하고, **제공되는 증권을 취득할 특정 목적으로 형성되지 아니한** 신탁으로서, 그 신탁에 관하여 결정을 내릴 권한이 있는 수탁자 또는 그 밖의 자, 그리고 그 신탁에 자산을 출연한 각 위탁자 또는 그 밖의 자가 **clause (i)·(ii) 또는 (iv)에 기술된 자**인 신탁.

- **쉽게 말하면.** 신탁이 QP가 되려면 두 가지가 동시에 필요하다 --- ① **급조가 아닐 것**, ② 수탁자와 **각 위탁자·출연자가 전원 (i)(ii)(iv) QP** 일 것. 두 가지 함정 주의: **(가)** 종전 판이 신탁 말미를 "are qualified purchasers"로 적고 "$5M+ 신탁"이라 풀었던 것은 오류다 --- 현행 진본은 "**is a person described in clause (i), (ii), or (iv)**"이고, 신탁에는 **자체 $5M 문턱이 없다**(출연자 전원 QP가 요건이지 신탁 자산 규모가 아님). **(나)** 출연자는 (i)(ii)(iv)로만 QP가 될 수 있어 **(iii) 신탁을 또 출연자로 끼워 넣는 겹치기는 불인정**된다. 그리고 **급조 신탁은 (iii) 자체가 탈락**이라, 회사가 Rule 2a51-3(b)에서 받는 "전원 QP면 인정"이라는 구제가 신탁에는 **없다**.

- **PASS/FAIL 반영.** 직접 ○ --- 신탁 분기의 PASS/FAIL·모드를 statute가 직접 정한다. `formedForSpecificPurpose=true`인 신탁은 A-09가 **즉시 FAIL**(치유 없음). 비급조 신탁은 *수익자(beneficialOwners)가 아니라* **수탁자·의사결정권자와 각 위탁자·출연자**를 대상으로, 각자가 **(i)·(ii)·(iv)** 중 하나로 자격을 갖는지 확인한다(수탁자·출연자가 다시 (iii) 신탁으로 연쇄 주장하는 경로는 차단). 대상 인물이 자연인이면 A-13 직접 판정, entity((ii)가족회사·(iv)$25M)이면 그 자격을 확인한다.

- **ERC-3643 변환.** `claim.basis = QP_TRUST`, `trust.formedForSpecificPurpose`, `trust.trustee`, `trust.settlors[]`. A-09: `if formedForSpecificPurpose → FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP`(치유 경로 없음); else 수탁자·각 출연자 → A-13 위임(각자 (i)(ii)(iv) QP), 전원 통과 시 `lookThroughStatus=COMPLETED`.

### 3.4 17 C.F.R. § 270.2a51-3 — 목적형성 회사 look-through ((ii)·(iv) 한정) \[🔗 ecfr.gov\]

- **조항**: 17 C.F.R. §270.2a51-3(a)·(b) --- ecfr.gov

- **핵심 원문** (17 C.F.R. §270.2a51-3):

```text
(a) For purposes of section 2(a)(51)(A) (ii) and (iv) of the Act, a
company shall not be deemed to be a qualified purchaser if it was formed
for the specific purpose of acquiring the securities offered by a company
excluded from the definition of investment company by section 3(c)(7) of
the Act unless each beneficial owner of the company's securities is a
qualified purchaser. (b) For purposes of section 2(a)(51) of the Act, a
company may be deemed to be a qualified purchaser if each beneficial owner
of the company's securities is a qualified purchaser.
```

- **한국어.** (a) 법 제2(a)(51)(A)(ii) 및 (iv)조의 목적상, 어느 회사가 §3(c)(7)로 투자회사 정의에서 제외되는 회사가 매도하는 증권의 취득을 **특정 목적으로 하여 설립된** 경우, 그 회사의 **각 beneficial owner가 적격매수자가 아닌 한** 그 회사를 적격매수자로 보지 아니한다. (b) 법 제2(a)(51)조의 목적상, 어느 회사의 **각 beneficial owner가 적격매수자인 경우** 그 회사를 적격매수자로 볼 수 있다(may be deemed).

- **쉽게 말하면.** R3 측 anti-circumvention 집행이다. **적용 대상은 (ii)·(iv) 회사 두 갈래뿐** --- (a)는 급조 회사에 대한 *제한*(전원 QP 아니면 불가)이자 동시에 *구제*(전원 QP면 통과)이고, (b)는 비급조 회사가 자체 자산이 부족해도 "전원 QP면 인정"이라는 추가 선택지다. 어느 쪽이든 **"구성원 전원 QP"라는 안전판이 열려 있다**는 점이 회사의 특징이다. 이것이 신탁(iii)과의 결정적 차이 --- **신탁은 급조면 치유 없이 탈락**하지만, 회사는 급조여도 전원 QP면 (a)로 통과한다(§3.2.1·§3.3). "급조" 개념의 뿌리는 statute (iii)의 신탁 요건을 Rule 2a51-3이 회사에까지 확장한 것이다.

- **PASS/FAIL 반영.** 직접 ○ --- `formedForSpecificPurpose=true`이고 cat ∈ {QP_FAMILY_COMPANY, QP_INSTITUTIONAL}이면 A-09가 **전원-충족 모드**로 전환해 각 beneficial owner가 QP인지 확인한다(각 owner가 자체 자격이면 그 노드에서 종료 --- 자연인까지 강제 아님). 1인이라도 비-QP면 `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP`. (b) 경로도 전원 QP 확인 시 통과이나 별도 basis가 아니라 하위 카테고리 + `lookThroughStatus=COMPLETED`로 표현한다.

- **ERC-3643 변환.** `if entityType==COMPANY && claim.basis∈{QP_FAMILY_COMPANY,QP_INSTITUTIONAL} && formedForSpecificPurpose → requireAllOwnersQP=true → A-09 재귀`. 전원 QP면 `lookThroughStatus=COMPLETED`, 아니면 `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP`. (b) 비급조·자산부족 경로도 `lookThroughStatus=COMPLETED`로 귀속.

### 3.5 ICA § 3(c)(1)(A) · 17 C.F.R. § 270.3c-1 — "그 전원"을 누구로/몇으로 세나 (카운팅 1차 기준) [🔗 uscode.house.gov]

- **조항**: 15 U.S.C. §80a-3(c)(1)(A)(Look-Through Provision) · 17 C.F.R. §270.3c-1(구현 규칙) --- uscode.house.gov / ecfr.gov

- **핵심 원문** (15 U.S.C. §80a-3(c)(1) 및 (A)):

```text
(1) Any issuer whose outstanding securities (other than short-term paper)
are beneficially owned by not more than one hundred persons (or, in the
case of a qualifying venture capital fund, 250 persons) and which is not
making and does not presently propose to make a public offering of its
securities. ...
(A) Beneficial ownership by a company shall be deemed to be beneficial
ownership by one person, except that, if the company owns 10 per centum
or more of the outstanding voting securities of the issuer, and is or,
but for the exception provided for in this paragraph or paragraph (7),
would be an investment company, the beneficial ownership shall be deemed
to be that of the holders of such company's outstanding securities
(other than short-term paper).
— 15 U.S.C. §80a-3(c)(1) 및 §80a-3(c)(1)(A)
```

- **한국어.** (1) 미등록증권(단기증권 제외)의 보유자가 100인(적격 벤처캐피탈 펀드는 250인) 이하이고 공모를 하지 않는(그리고 현재 공모 계획도 없는) 발행자는 투자회사 정의에서 제외된다. (A) **회사에 의한 실질소유는 1인의 실질소유로 본다.** 다만 그 회사가 발행자의 의결권 있는 증권의 `10%` 이상을 보유하고, (이 항 또는 (7)항의 예외가 없었더라면) 투자회사에 해당했을 경우에는, 그 실질소유를 **그 회사의 발행 증권 보유자들의 소유**로 본다.

- **쉽게 말하면.** look-through라는 발상의 **뿌리**다. 원칙은 "회사 하나 = 사람 하나(1인)". 그런데 예외가 붙는다 --- 그 회사가 펀드 지분을 `10%` 이상 쥐고 있고 그 자체가 (사모펀드 예외가 없었다면) 투자회사였을 법인이라면, 그 회사를 **꿰뚫어 그 뒤 보유자들을 센다.** 즉 "펀드가 펀드를 통해 인원 제한을 우회"하는 것을 막는 장치가 여기서 처음 명문화됐고, SEC가 이를 "Look-Through Provision"이라 부른다(§1.2 IC-22597 §I.B). **단, 이 `10%`·100인 규칙은 §3(c)(1)(100인 펀드)의 카운팅 기준이다.** 우리 프로젝트가 기대는 §3(c)(7)(QP 펀드, R3)에는 **숫자 상한이 없고**("QP 전원 소유"만), QP 펀드에서의 실제 look-through 트리거는 §3.4 Rule 2a51-3(급조 회사)·§3.3 statute (iii)(신탁)·§3.8 Rule 501(a)(8)(AI entity)이다. §3(c)(1)(A)는 A-09 재귀가 **개념적으로 상속받은 "회사를 뚫어 보유자를 센다"의 원형**이자, "그 전원"을 독립적으로 자격이 확인된 owner node까지 전개한다(필요한 경우 자연인까지 내려간다)는 카운팅 논리의 근거다. 구현 규칙 17 C.F.R. §270.3c-1은 이 §3(c)(1)(A)의 `10%` 관통을 규칙 층위에서 운영화하며(§3(c)(1)·§3(c)(7) 상호 보유 시 단일 발행자 취급 방지 등), 본 프로젝트 신규 발행에서는 §3(c)(1) 자체가 적용되지 않으므로 3c-1의 세부 절차는 트리거되지 않는다.

- **PASS/FAIL 반영.** 간접(Supporting) --- 직접 PASS/FAIL을 내리지 않는다. A-09가 **왜 재귀하는가**(회사를 뚫어 그 보유자를 본다)와 **무엇을 세는가**(궁극적으로 자격이 확인된 보유자 노드)의 개념적 근거를 제공한다. 실제 재귀 트리거·전원-충족 강제는 2a51-3·(iii)·501(a)(8)에서 나온다.

- **ERC-3643 변환.** (직접 필드 없음) `ownershipGraph`를 자격 확인 노드까지(보수적으로는 자연인까지) 전개한다는 A-09 재귀의 설계 원리로만 작용. `entity.type == FUND_3C1`(매수인이 그 자체로 사모펀드)일 때만 §3.6 Rule 2a51-2의 산정 규칙과 연결되고, 신규 §3(c)(7) 발행 manifest에서는 비활성.

---

### 3.6 17 C.F.R. § 270.2a51-2 — 매수인이 펀드·전환 구조일 때의 간접소유 산정 [🔗 ecfr.gov]

- **조항**: 17 C.F.R. §270.2a51-2(a) --- ecfr.gov(/current/title-17/chapter-II/part-270/section-270.2a51-2). 인용 기준 2025 개정본.

- **핵심 원문** (17 C.F.R. §270.2a51-2(a)):

```text
(a) Beneficial ownership: General. Except as set forth in this section,
for purposes of sections 2(a)(51)(C) and 3(c)(7)(B)(ii) of the Act
[15 U.S.C. 80a-2(a)(51)(C) and -3(c)(7)(B)(ii)], the beneficial owners of
securities of an excepted investment company (as defined in section
2(a)(51)(C) of the Act [15 U.S.C. 80a-2(a)(51)(C)]) shall be determined in
accordance with section 3(c)(1) of the Act [15 U.S.C. 80a-3(c)(1)].
— 17 C.F.R. §270.2a51-2(a)
```

- **한국어.** beneficial owner는 원칙적으로 ICA §3(c)(1)에 따라 산정한다. (이 규칙의 (b)~(e)는 §3(c)(7)(B)(ii)·§2(a)(51)(C)를 위한 **1996-10-11 기준 grandfather·control·consent 산정 특칙**으로, 어느 owning company의 증권을 1인 소유로 볼지 여부를 그 회사가 투자회사·excepted investment company인지, 발행자를 지배/피지배/공통지배하는지, 1996-10-11 당시 §3(c)(1)(A)로 그 보유자들의 소유로 간주됐는지에 따라 가른다.)

- **쉽게 말하면.** "매수 주체 자체가 또 다른 펀드(excepted investment company)일 때 그 펀드의 소유자를 **어떻게 세느냐**"의 산정 규칙이다. 핵심은 §3.5의 §3(c)(1) 산정 방식을 빌려 온다는 것 --- **그러면 그 펀드의 보유자들이 다시 세어지므로**(간접소유 전개) A-09 재귀가 한 층 더 내려간다. 다만 이 규칙의 본체(특히 (b)~(e))는 **1996-10-11이라는 고정 기준일**을 축으로 한 전환·grandfather 처리라, 2024년 이후 **신규 §3(c)(7) 토큰 발행에는 대부분 적용되지 않는다.** A-09는 매수인이 `FUND_3C1`(그 자체로 사모펀드)로 식별될 때에 한해 이 산정 규칙을 켜고, 일반 운용사·SPV·가족회사·신탁 매수인에는 §3(c)(1)의 자연인 환원 원리만 쓴다.

- **PASS/FAIL 반영.** 간접(조건부) --- 직접 자격을 판정하지 않고 *어떻게 세고 어디까지 뚫나*의 traversal 규칙을 제공한다. 따라서 PASS/FAIL은 위임 결과로 결정되며, 소유 그래프가 불완전해 산정 자체가 불가하면 `REVIEW_OWNERSHIP_GRAPH_INCOMPLETE`로 사람 검토에 보낸다.

- **ERC-3643 변환.** `ownershipGraph` 전개 규칙 --- 각 노드가 entity면(그 entity가 자체 자격이 아니라면) 그 자식(beneficial owners)을 다시 노드로 펼쳐 자격 확인 노드까지 전개. `entity.type == FUND_3C1`이면 이 산정 규칙(1996-10-11 grandfather 포함)을 별도 플래그로 검토하되, 신규 발행 manifest에서는 비활성. A-09의 `evaluateLookThrough(...)` 재귀가 이 그래프를 탄다.

---

### 3.6.1 Rule 2a51-3 vs Rule 2a51-2 — 두 규칙이 답하는 질문이 다르다 (혼동 주의)

같은 "2a51"이라 붙어 있어 헷갈리기 쉽지만, 두 규칙은 **다른 질문**에 답한다. A-09 구현에서 둘을 섞으면 판정이 틀어진다.

| 구분 | Rule 2a51-3 (§3.4) | Rule 2a51-2 (§3.6) |
| --- | --- | --- |
| 답하는 질문 | "이 **회사가** QP인가?" (자격 판정) | "이 excepted investment company의 **보유자를 어떻게 세나**?" (산정 방법) |
| 적용 대상 | §2(a)(51)(A)**(ii)·(iv) 회사** | **excepted investment company**(fund-of-funds, §2(a)(51)(C)) |
| 트리거 | `formedForSpecificPurpose`(급조) 또는 전원-QP 구제 경로 | 매수인이 그 자체로 사모펀드(`FUND_3C1`)일 때 |
| A-09에서의 역할 | **전원-충족 모드 스위치**(급조 회사) | **간접소유 전개 방법**(펀드층 카운팅) |
| 시점 성격 | 상시(신규 발행에 유효) | 대부분 1996-10-11 grandfather(신규엔 대개 N/A) |

**요지.** 급조 SPV가 BUIDL-like 펀드를 사려 하면 → **2a51-3(a)** 가 켜져 "전원 QP 아니면 불가". 매수 주체가 또 다른 사모펀드라면 → **2a51-2** 가 켜져 "그 펀드 보유자를 §3(c)(1) 방식으로 다시 센다". 전자는 *모드*(얼마나 엄격히), 후자는 *방법*(어떻게 세어 내려가나)을 정한다. 대다수 신규 발행에서 실제로 작동하는 것은 2a51-3이고, 2a51-2는 fund-of-funds라는 특수 매수인에서만 켜진다.

---

### 3.7 ICA § 2(a)(51)(C) — 매수인이 fund-of-funds일 때 pre-1996 보유자 consent (대개 N/A) [🔗 uscode.house.gov]

- **조항**: 15 U.S.C. §80a-2(a)(51)(C) --- uscode.house.gov / govinfo.gov(발췌).

- **핵심 원문** (15 U.S.C. §80a-2(a)(51)(C), 발췌):

```text
The term "qualified purchaser" does not include a company that, but for
the exceptions provided for in paragraph (1) or (7) of section 80a-3(c) of
this title, would be an investment company (hereafter in this paragraph
referred to as an "excepted investment company"), unless all beneficial
owners of its outstanding securities (other than short-term paper),
determined in accordance with section 80a-3(c)(1)(A) of this title, that
acquired such securities on or before April 30, 1996 (hereafter in this
paragraph referred to as "pre-amendment beneficial owners"), and all
pre-amendment beneficial owners of the outstanding securities (other than
short-term paper) of any excepted investment company that, directly or
indirectly, owns any outstanding securities of such excepted investment
company, have consented to its treatment as a qualified purchaser.
— 15 U.S.C. §80a-2(a)(51)(C) (발췌)
```

- **한국어.** §3(c)(1)·§3(c)(7) 면제가 아니었다면 투자회사였을 회사("excepted investment company", 즉 다른 사모펀드)는, 1996-04-30 이전에 증권을 취득한 모든 beneficial owner(§3(c)(1)(A)로 산정, "pre-amendment beneficial owners")와 그 회사의 증권을 직간접 보유하는 다른 excepted investment company의 모든 pre-amendment beneficial owner가 **그 회사를 적격매수자로 취급하는 데 동의**하지 않는 한, 적격매수자에 포함되지 않는다.

- **쉬운 설명.** "**펀드가 펀드를 사는**" 경우의 특칙 --- 매수 주체 자체가 또 다른 사모펀드면, *1996년 이전부터 있던 옛 투자자들의 동의*라는 추가 관문이 붙는다. 이는 1996년 NSMIA로 QP 개념이 신설될 때 이미 존재하던 펀드를 어떻게 처리할지 정한 **경과조치**라, 2024년 이후 신규 토큰 발행에는 사실상 적용되지 않는다. (참고로 §2(a)(51)(C) 말미는 (ii)·(iii)의 회사·신탁에 대해 "수탁자·이사·무한책임사원 전원의 만장일치 동의가 본 항의 동의로 간주된다"고 정한다.) A-09는 이 경로를 *인지*하되 기본 판정 흐름에서는 다루지 않는다.

- **PASS/FAIL 반영.** 간접 ✕(배경) --- 신규 발행 전제에서 트리거되지 않으므로 기본 PASS/FAIL에 직접 반영하지 않는다. 다만 매수 주체가 excepted investment company로 식별되면 §12 Open Issue(OD-LT-5)로 라우팅해 A-01 제재 추적 그래프와의 관계를 별도 검토한다.

- **ERC-3643 변환.** (기본 흐름 비적용) `entity.type == FUND_3C1` 식별 시 별도 consent 검증 플래그를 두되, 본 프로젝트 신규 발행 manifest에서는 비활성.

---

### 3.8 17 C.F.R. § 230.501(a)(8) + Note 1 — 전원 지분권자가 AI인 entity (Track B) [🔗 ecfr.gov]

- **조항**: 17 C.F.R. §230.501(a)(8) 및 Note 1 to paragraph (a)(8) --- ecfr.gov(/current/title-17/chapter-II/part-230/section-230.501). 인용 기준 2025 개정본.

- **핵심 원문** (17 C.F.R. §230.501(a)(8) 및 Note 1):

```text
(8) Any entity in which all of the equity owners are accredited investors.

Note 1 to paragraph (a)(8): It is permissible to look through various
forms of equity ownership to natural persons in determining the accredited
investor status of entities under this paragraph (a)(8). If those natural
persons are themselves accredited investors, and if all other equity
owners of the entity seeking accredited investor status are accredited
investors, then this paragraph (a)(8) may be available.
— 17 C.F.R. §230.501(a)(8) 및 Note 1
```

- **한국어.** (8) **모든 지분권자(equity owner)가 적격투자자인 entity.** [Note 1] 이 (a)(8)항에 따라 entity의 적격투자자 지위를 판정할 때 **다양한 형태의 지분 소유를 자연인까지 look-through**하는 것이 허용된다. 그 자연인들이 스스로 AI이고, 적격투자자 지위를 구하는 entity의 다른 모든 지분권자도 AI이면, 이 (a)(8)항을 쓸 수 있다.

- **쉽게 말하면.** **Track B(R1 발행)의 look-through 근거**다. QP 쪽 Rule 2a51-3(b)와 **구조가 같다** --- "지분권자가 전부 AI면 그 entity도 AI". Note 1이 자연인까지 관통을 *permissible하게(허용)* 한다 --- 다만 **강제는 아니다**. equity owner가 이미 다른 AI 항목(은행·투자회사·$5M 초과 법인 등)에 해당하면 그 자체로 AI이므로 더 내려갈 필요가 없다. **한 명이라도 비-AI면 이 경로는 못 쓴다**(완전 look-through). 단, Rule 501(a)는 (a)(1)~(a)(13)에 *기관 자체로 AI가 되는 다른 경로*(은행·투자회사·자산 $5M 초과 법인 등)도 두므로, A-09의 (a)(8) 전원-look-through는 entity가 **그 다른 경로로 AI가 되지 못할 때** 쓰는 fallback이다. 이 차이가 §3.8.1에서 급조 처리의 R1/R3 비대칭으로 이어진다.

- **PASS/FAIL 반영.** 직접 ○(Track B) --- R1 발행에서 (a)(8) entity의 PASS/FAIL을 직접 결정한다. 각 equity owner가 AI인지 확인해 전원 AI면 `lookThroughStatus=COMPLETED`. equity owner가 자연인이면 A-03, entity이면 A-08/A-03로 **그 entity 자체가 AI인지 먼저 판정**하고(은행·보험·투자회사·private BDC·$5M 초과 non-formed 법인 등은 그 자체로 AI → 종료), 그 AI 지위가 다시 소유자에 의존할 때에만 재귀한다. 1인이라도 비-AI면 `FAIL_AI_OWNER_NOT_ACCREDITED`, 자료 미완료면 `REVIEW_AI_LOOKTHROUGH_PENDING`.

- **ERC-3643 변환.** `claim.basis = AI_ALL_EQUITY_OWNERS` → A-09가 각 equity owner가 AI인지 확인(entity owner가 자체 AI이면 그 노드에서 종료, 아니면 재귀). 전원 통과면 `lookThroughStatus=COMPLETED`, 확인된 비-AI면 `FAIL_AI_OWNER_NOT_ACCREDITED`, 자료 미완료면 `REVIEW_AI_LOOKTHROUGH_PENDING`.

---

### 3.8.1 급조(formed for the specific purpose) 처리의 R1/R3 비대칭 — 왜 발행 쪽엔 회사식 구제가 없나 (혼동 주의)

look-through를 두 Track에서 함께 다루다 보면 "급조 entity는 어느 쪽이든 전원 자격이면 통과"라고 뭉뚱그리기 쉽다. 그러나 **R1(AI)과 R3(QP)의 급조 처리는 근거 조문 구조가 달라 비대칭**이며, 이 차이가 실제 PASS/FAIL을 가른다.

| 매수 주체 | R3 (QP) 급조 시 | R1 (AI) 급조 시 |
| --- | --- | --- |
| **회사 (ii)·(iv)** | Rule 2a51-3(a): 급조여도 **전원 QP면 통과**(구제 내장) | (a)(3)·(7)·(9)·(12) 등 *기관 자체* AI 경로는 조문이 "not formed for the specific purpose ..."를 요건으로 두어 **급조 entity는 그 경로 사용 불가**; **오직 (a)(8) 전원-AI로만 구제** |
| **신탁 (iii)** | statute (iii): 급조면 **치유 없이 (iii) 탈락**(회사식 구제 없음) | 신탁도 (a)(8) 전원-AI 경로로만 관통 |
| **자연인 (i)** | "형성" 대상 아님 --- 급조 개념 미적용 | 동일 |

**요지 세 가지.** ① **R3 회사**는 Rule 2a51-3(a)가 "전원 QP면 인정"이라는 구제를 명문으로 내장한다. ② **R3 신탁**은 statute (iii) 자체가 "not formed for the specific purpose"를 요건화하므로, 급조면 (iii)에서 탈락하고 회사식 전원-QP 구제가 **없다.** ③ **R1(AI)** 쪽에서 기관 자체가 AI가 되는 여러 경로((a)(3) $5M 자산 법인 등)는 각기 "특정 목적으로 형성되지 않았을 것"을 요구하는 경우가 있어 급조 entity가 그 경로를 못 쓰고, 결국 **(a)(8) "지분권자 전원 AI"** 만이 급조 entity의 유일한 통과문이다. (참고로 Rule 501(e)의 purchaser 수 계산 규정은 *매수인 수 산정* 보조 규칙이지 급조 entity의 자격 근거가 아니다 --- 혼용 금지.) A-09는 이 비대칭을 모드 결정에서 반영한다 --- R3 회사 급조 → 전원-QP 모드(구제 가능), R3 신탁 급조 → 즉시 `FAIL`(치유 없음), R1 급조 → (a)(8) 전원-AI 모드.

---

### 3.9 판례·발행문서 (Layer 3) — 급조·도관 판단과 정상회사 제외의 정책 근거 [🔗 sec.gov · govinfo.gov]

- **조항**: SEC Release No. IC-22597, *Privately Offered Investment Companies*, 62 FR 17512 (1997-04-09) --- sec.gov(files/rules/final/ic-22597.txt). Rule 2a51-1·2a51-2·2a51-3을 채택한 문서. 보조로 SEC v. Ralston Purina Co., 346 U.S. 119 (1953) --- govinfo.gov.

- **핵심 원문(정책 인용)** --- §1.2·§3.1의 verbatim 블록(IC-22597 §I.B look-through 목적, n.19 conduit)과 동일 출처. 요지 재확인:

```text
To prevent circumvention of the [investor] limit, section 3(c)(1)(A)
(the "Look-Through Provision") requires, in some instances, that a fund
... "look through" certain companies ... that hold its voting securities
and count the company's security holders as beneficial owners ...
— SEC Release IC-22597, §I.B (62 FR 17512)
```

- **한국어·쉬운 설명.** A-09의 두 Track이 공유하는 *정책 논리*는 이 릴리스에서 확인된다. 세 해석 포인트:

1. **목적은 우회 방지.** look-through는 "*to prevent circumvention*"의 장치다(§I.B). 인원·자격 제한을 *간접적으로* 뚫는 것을 막는다.
2. **표적은 도관(conduit).** 규제가 겨냥하는 것은 "*a conduit that was created to enable ... indirectly more than [the limit of] investors*"(n.19) --- 즉 제한 회피만을 위해 만들어진 껍데기다. 이것이 "**급조(formed for the specific purpose)**" 판단의 취지다.
3. **operating company는 관통 대상이 아니다 --- 근거는 statute 자체.** 어느 회사가 펀드 지분을 보유해도, 그 회사가 (이 항 또는 (7)항 예외가 없었다면) **투자회사였을 법인이 아닌 한** §3(c)(1)(A)은 관통을 요구하지 않는다(§3.5 verbatim: "*and is or, but for the exception ... would be an investment company*"). 즉 정상 영업회사는 §3(c)(1)(A) 문언상 1인으로 세고 뚫지 않는다 --- 이는 판례가 아니라 **조문**에서 나온다. A-09도 `formedForSpecificPurpose = false`인 정상 회사엔 완전 look-through를 강제하지 않고 가족회사(ii) *구성 확인*으로 본다.

- **PASS/FAIL 반영.** 간접(해석) --- 직접 PASS/FAIL을 내리지 않는다. 대신 *모드 선택*(전원-충족 vs 구성 확인)의 정책적 정당화를 제공한다 --- 도관 위험이 큰 구조일수록 깊게 뚫는다는 원칙. No-Action·판례는 SEC 비구속·사실관계 한정이므로 규칙이 아니라 정책 근거로만 쓴다.

- **ERC-3643 변환.** (해석 레이어 --- 직접 필드 없음) `formedForSpecificPurpose` 트리거의 *해석 기준*으로만 작용. 회색지대 판정은 §12 OD-LT-6.

> **해설.** Layer 3을 읽는 실익 --- 조문(Layer 1·2)만 보면 "왜 가족회사는 구성만 보고 신탁·급조회사는 전원을 보나?"가 자의적으로 보인다. IC-22597이 그 답을 준다: **도관 위험이 큰 구조일수록 깊게 뚫는다.** 가족회사는 친족이라는 실체가 있어 도관성이 낮고, 급조 회사는 정의상 도관이며, 신탁은 위탁자–수탁자 분리로 은닉 통로가 되기 쉬워 (i)(ii)(iv) 기준으로 본다. **Ralston Purina는 여기서 배경 원리일 뿐이다** --- Securities Act §4(a)(2) 사모 발행에서 투자자가 스스로 정보를 얻어 방어할 수 있는지("able to fend for themselves")라는 *상위 취지*를 보여줄 뿐, A-09의 구체적 look-through trigger나 operating company 취급의 **직접 근거는 아니다.** A-09의 직접 코딩 근거는 §2(a)(51)·Rule 2a51-3·Rule 501(a)(8)이고, operating company 취급은 §3(c)(1)(A)이다.

---

### 3.10 Sub-요건 분해 매트릭스 — 조문이 묻는 사실 단위

각 조문이 결국 *어떤 사실*을 요구하는지를 원자 단위로 분해한다. A-09는 이 표의 각 칸이 입력 claim(`ownershipGraph` 및 그 플래그)으로 채워졌는지를 확인하고, 각 소유자 노드의 자격 판정(자연인 또는 자체 자격 entity)은 A-13/A-03·A-08에 위임하는 부품이다.

| Sub-요건 | 출처 | 묻는 사실 | 입력 필드 | 미충족 시 코드 |
| --- | --- | --- | --- | --- |
| 매수 주체 유형 | §2(a)(51)(A) | 개인·가족회사·신탁·기타법인 중 무엇인가 | `entity.type` | (분류 → 트리거) |
| 급조 여부 | 2a51-3(a)·(iii) | 이 펀드 취득만을 목적으로 형성됐나 | `entity.formedForSpecificPurpose` | (트리거 → 모드) |
| 가족회사 자산 | §2(a)(51)(A)(ii) | investments `≥ $5M`인가 | `familyCompany.investmentsValue` | `FAIL_FAMILY_COMPOSITION_NOT_MET` |
| 가족회사 구성 | §2(a)(51)(A)(ii) | 친족 자연인 `≥ 2인`인가 | `familyCompany.relatedNaturalPersons` | `FAIL_FAMILY_COMPOSITION_NOT_MET` |
| 가족회사 소유 귀속 | §2(a)(51)(A)(ii) | 직·간접 소유가 가족관계자(+그 estate·foundation·charity·trust)에 귀속되나; 비가족 제3자 소유분 없나 | `familyOwnershipConfirmed`·`nonFamilyOwnerPresent`·`allowedFamilyVehicleConfirmed` | `REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION`(확인 시 FAIL) |
| 신탁 급조 | §2(a)(51)(A)(iii) | 급조 신탁인가 | `trust.formedForSpecificPurpose` | `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP`(치유 없음) |
| 신탁 대상자 (수익자 아님) | §2(a)(51)(A)(iii) | 수탁자·의사결정권자가 (i)(ii)(iv) QP인가 (수익자·일반 BO는 대상 아님) | `trust.trusteeOrDecisionMaker` → A-13 | `FAIL_LOOKTHROUGH_OWNER_NOT_QUALIFIED` |
| 신탁 출연자 자격 | §2(a)(51)(A)(iii) | 각 위탁자·출연자가 (i)(ii)(iv) QP인가; (iii) 신탁 연쇄 주장 불가 | `trust.settlorsAndContributors[]` → A-13 | `FAIL_LOOKTHROUGH_OWNER_NOT_QUALIFIED` |
| 급조 회사 전원 QP | Rule 2a51-3(a) | 모든 beneficial owner가 QP인가 | `beneficialOwners[]` → A-13 | `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP` |
| 간접소유 산정 | Rule 2a51-2·§3(c)(1)(A) | entity 소유자를 자격 확인 노드까지 전개했나 | `ownershipGraph` | `REVIEW_OWNERSHIP_GRAPH_INCOMPLETE` |
| 재귀 깊이 | 운영 방어 | `MAX_DEPTH` 이내인가 | `config.MAX_DEPTH` | `REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED` |
| 전원 AI(발행) | Rule 501(a)(8) | 각 equity owner가 AI인가(entity owner는 자체 AI 여부 우선) | `beneficialOwners[]` → A-03/A-08 | `FAIL_AI_OWNER_NOT_ACCREDITED` / `REVIEW_AI_LOOKTHROUGH_PENDING` |

---

### 3.11 ERC-3643 · claim.basis 총정리

카테고리별 claim.basis와 look-through 모드, 출력을 총람한다. **"전원 통과"는 별도 basis(폐기된 `QP_ALL_BENEFICIAL_OWNERS`)가 아니라, 해당 하위 카테고리 + `lookThroughStatus=COMPLETED`로 표현**한다. (iv) $25M 재량운용 경로의 basis는 `QP_INSTITUTIONAL`이며 "기관"이라는 라벨은 쓰지 않는다.

| 매수인 유형 | recipe | claim.basis | 핵심 필드 | look-through 모드 | 출력 |
| --- | --- | --- | --- | --- | --- |
| 가족회사(급조 아님) | R3 | `QP_FAMILY_COMPANY` | `investmentsValue`, `relatedNaturalPersons`, `familyOwnershipConfirmed`, `nonFamilyOwnerPresent=false`, `formedForSpecificPurpose=false` | 구성 + 소유 귀속 확인 | `COMPLETED` / `REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION` |
| 신탁(급조 아님) | R3 | `QP_TRUST` | `trusteeOrDecisionMaker`, `settlorsAndContributors[]`, `formedForSpecificPurpose=false` | 수탁자·각 출연자 (i)(ii)(iv) 확인 (수익자 아님, (iii)연쇄 불가) | `COMPLETED` / `FAILED` |
| 신탁(급조) | R3 | `QP_TRUST`(탈락) | `trust.formedForSpecificPurpose=true` | 없음 --- 즉시 실패 | `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP` |
| 급조 회사 (ii)/(iv) | R3 | `QP_FAMILY_COMPANY` / `QP_INSTITUTIONAL` + `requireAllOwnersQP` | `formedForSpecificPurpose=true`, `beneficialOwners[]` | 전원-충족(AND) | `COMPLETED`(전원 QP) / `FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP` |
| (iv) $25M / QIB 간주 | R3 | `QP_INSTITUTIONAL` / `QP_QIB`(A-08 직접) | --- | 불요(trivial pass) | `COMPLETED` |
| 전원-AI entity | R1 | `AI_ALL_EQUITY_OWNERS` | `beneficialOwners[]` | 각 owner AI 확인(entity는 자체 AI 우선) | `COMPLETED` / `FAIL_AI_OWNER_NOT_ACCREDITED` / `REVIEW_AI_LOOKTHROUGH_PENDING` |
| fund-of-funds | R3 | (§2(a)(51)(C) 배경) | `entity.type=FUND_3C1` | 신규 발행엔 대개 N/A | (OD-LT-5 검토) |

---

## §4 ② 입력 사실 — DEX가 읽는 데이터

> **무엇을 입력받나.** A-09는 *개별 자격 증명*을 직접 읽지 않는다 --- 그건 A-13(QP)·A-03(AI)이 자연인 단위로 읽는다. A-09가 읽는 것은 **지분 구조 그래프(`ownershipGraph`)와 그 모드 플래그**다. 그래프의 정확성(누가 실소유자인가, 친족·위탁자 관계가 사실인가)은 off-chain KYC·Trusted Issuer(Securitize)의 책임이며, 온체인 A-09는 서명된 그래프를 *다시 조사하지 않고* 그 위에서 재귀·전원-충족 AND·자연인 위임만 수행한다(§8·§10).

### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

A-09가 `lookThroughStatus`를 확정하려면 네 종류의 사실이 필요하다.

1. **매수 주체의 유형** --- 개인인가, 가족회사(ii)인가, 신탁(iii)인가, 기타 법인(iv)인가, 그 자체로 사모펀드(fund-of-funds)인가. 유형이 트리거를 가른다(§3.2.1).
2. **급조 여부** --- 이 펀드 취득만을 목적으로 형성됐는가. 회사면 전원-QP 모드로, 신탁이면 즉시 탈락으로 이어지는 핵심 플래그(§3.4·§3.3·§3.8.1).
3. **지분 구조 그래프** --- 직접 소유자 목록과, 각 소유자가 자연인인지 또 다른 entity인지. entity면 그 자식을 다시 펼친 재귀 그래프.
4. **각 자격 노드의 claim 참조** --- 자연인 또는 자체 자격 entity가 A-13/A-03·A-08이 읽을 QP/AI claim을 갖는지(값 자체는 그쪽이 판정; A-09는 참조만 모은다).

가족회사(ii) 분기에서는 추가로 **investments 총액**과 **친족 자연인 수**가 필요하다(전원 개별 자격 대신 *구성*을 보므로).

### 4.2 Data field — DEX가 실제로 읽는 항목

| 필드 | 타입 | 의미 | 출처 |
| --- | --- | --- | --- |
| `Manifest.fundExemption` | enum | `ICA_3C7`이면 Track A(QP), 아니면 Track B(AI) | Recipe/Manifest |
| `entity.id` | id | 매수 주체(법인·신탁) 식별자 | ONCHAINID |
| `entity.type` | enum | `FAMILY_COMPANY \| TRUST \| OTHER_COMPANY \| FUND_3C1` | KYC claim |
| `entity.formedForSpecificPurpose` | bool | 이 펀드 취득만을 목적으로 급조됐나 → 모드 트리거 | KYC/발행 실사 |
| `entity.claimBasis` | enum | `QP_FAMILY_COMPANY \| QP_TRUST \| QP_INSTITUTIONAL \| QP_QIB \| AI_ALL_EQUITY_OWNERS` | Trusted Issuer |
| `entity.beneficialOwners[]` | node[] | 직접 소유자 목록 --- 각 노드는 자연인 또는 또 다른 entity | KYC ownershipGraph |
| ┗ `owner.kind` | enum | `NATURAL \| ENTITY` | KYC |
| ┗ `owner.ownershipPct` | number | 지분율(간접소유 추적·partial 처리용) | KYC |
| ┗ `owner.qualificationClaim` | claim ref | 자연인이면 A-13/A-03이 읽을 QP/AI claim 참조 | Trusted Issuer |
| `familyCompany.investmentsValue` | money | §2(a)(51)(A)(ii) 자산 $5M 판정용(산정 자체는 Rule 2a51-1 = A-13 소관) | claim |
| `familyCompany.relatedNaturalPersons` | int | 친족 2인 이상 구성 확인용 | KYC |
| `familyCompany.familyOwnershipConfirmed` | bool | 직·간접 소유가 가족관계자(+그 estate·foundation·charity·trust)에 귀속됨 | 실사 |
| `familyCompany.nonFamilyOwnerPresent` | bool | 비가족 제3자 소유분 존재 여부(있으면 경로 파손 위험) | 실사 |
| `familyCompany.allowedFamilyVehicleConfirmed` | bool | 소유 vehicle이 조문 허용형(estate·foundation·charity·trust)인지 | 실사 |
| `trust.trusteeOrDecisionMaker` | node | §2(a)(51)(A)(iii) 수탁자·의사결정권자 (i)(ii)(iv) 대상 (수익자 아님) | KYC |
| `trust.settlorsAndContributors[]` | node[] | 각 위탁자·출연자 (i)(ii)(iv) 대상; (iii) 연쇄 불가 | KYC |
| `config.MAX_DEPTH` | int | 재귀 깊이 상한(순환·과복잡 방어) | 시스템 설정(값 미확정 --- §12 OD-LT-1) |

**출력(부수효과).** A-09는 판정 후 `lookThroughStatus ∈ {COMPLETED, PENDING, FAILED}`를 세팅한다. A-13·A-03의 PASS 조건은 entity 매수인에 한해 **`lookThroughStatus = COMPLETED`** 를 AND 조건으로 건다.

### 4.3 수집 경로 — 5단계 흐름

1. **매수 주체 식별(ONCHAINID).** 매수인의 `entity.id`와 `entity.type`을 KYC claim에서 읽는다. 자연인이면 A-09를 켜지 않고 A-13/A-03이 직접 판정.
2. **직접 자격 우선 확인.** 유형이 기타 법인(iv)이고 A-08이 (g)(1) QIB 간주·$25M 재량운용으로 *법인 자체* 자격을 확정하면, look-through **불요**(A-09 trivial pass). "자격을 구성원에게서 빌려 오는" 매수인만 다음 단계로.
3. **급조 플래그·유형 분기 확정.** `formedForSpecificPurpose`와 `entity.type`으로 모드를 정한다 --- 회사 급조→전원-QP(구제 가능), 신탁 급조→즉시 실패, 가족회사(급조 아님)→구성 확인, R1→(a)(8) 전원-AI.
4. **지분 구조 그래프 조립.** Trusted Issuer가 off-chain 실사로 `beneficialOwners[]`를 자격 확인 노드까지 전개해 서명한다. 중간 entity가 자체로 QP/AI이면 거기서 종료; 그 자격이 구성원에 의존하는 entity가 남아 있으면 그 자식을 다시 요청(보수적으로는 자연인까지).
5. **자격 노드 claim 참조 수집.** 각 자격 확인 노드(자연인 또는 자체 자격 entity)의 QP/AI claim 참조를 붙인다. 값 판정은 A-13/A-03·A-08에 위임하고, A-09는 그 결과를 모아 전원-충족 AND를 계산한다.

### 4.4 갈래별 증거 예시

- **가족회사(ii).** investments $6M 평가서(산정 근거 = A-13 Rule 2a51-1) + 형제 3인의 친족관계 증빙 + **소유 귀속 확인**(소유가 그 형제/그 estate·foundation·charity·trust에 귀속, 비가족 제3자 지분 없음) + `formedForSpecificPurpose=false` 실사 결론. → *구성+귀속 확인*으로 통과, 개별 QP 불요. (제3자 지분이 섞이면 `REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION`.)
- **신탁(iii).** 신탁계약서(급조 아님 확인) + 수탁자 신원·QP claim + 각 위탁자·출연자 신원·QP claim. → 수탁자·각 출연자가 (i)(ii)(iv) QP면 통과. 급조면 증빙 불문 즉시 탈락.
- **급조 SPV(ii)/(iv).** 설립 목적·시점 실사(급조 확인) + 전체 beneficial owner 명부 + 각자 QP claim. → 전원 QP면 2a51-3(a)로 통과, 1인이라도 비QP면 차단.
- **중첩 구조.** 회사 A를 회사 B가 100% 소유 → B가 자체로 QP/AI이면 거기서 종료; 아니면 B의 소유자 명부·claim까지 재귀로 요청해 각 노드 자격 확인 후 통과.
- **전원-AI entity(R1).** 지분권자 전원 명부 + 각자 AI claim. entity 지분권자가 자체 AI(은행·투자회사·$5M 초과 법인 등)이면 그 노드에서 종료; 아니면 Note 1에 따라(permissible) 관통해 확인.

---

## §5 ③ 판정 로직 — 어떻게 `lookThroughStatus`가 결정되는가

> **핵심은 재귀(recursion)와 종착점(terminus).** A-09가 각 owner를 확인할 때 **재귀의 법적 종착점은 '자연인'이 아니라 '독립적으로 자격이 확인된 owner node'** 다. 자연인은 항상 그런 노드지만(A-03/A-13이 직접 판정), entity도 구성원과 무관하게 그 자체로 QP/AI이면((iv) $25M 재량운용·(g)(1) QIB 간주·은행·투자회사 등) 그 지점에서 종료한다 --- 조문 문언이 요구하는 것은 "각 beneficial owner가 QP/AI일 것"(Rule 2a51-3(a)·(b) "each beneficial owner ... is a qualified purchaser", Rule 501(a)(8) "all of the equity owners are accredited investors")이지 *항상 최종 자연인까지 내려갈 것*이 아니다. 자연인까지 추적하는 것은 **보수적 구현 정책**으로 채택할 수 있으나, 법리 설명에서는 "필요한 경우"로 낮춘다. 그 위에서 A-09는 ① 깊이·그래프를 방어하고 ② 자연인이면 직접 위임, ③ entity가 자체 자격이면 종료, ④ 아니면 유형별 look-through(신탁=수탁자·각 출연자, 가족회사=구성+소유 귀속, 급조회사·(a)(8)=각 owner 재귀)로 판정한다.

### 5.0 판정 흐름 플로우차트

![그림 5.0 --- A-09 재귀 판정 로직: 깊이·그래프 방어 → 급조 신탁 즉시 탈락 → 모드 결정 → 소유자 순회(위임/재귀) → 전원-충족 AND → COMPLETED/FAILED](fig50.png)

### 5.1 전체 흐름 (사람 말로)

entity 매수인이 들어오면 A-09는 각 owner node가 요구 자격을 충족하는지 재귀로 확인한다. 순서는 다음과 같다. **(1) 방어** --- 재귀 깊이가 `MAX_DEPTH`를 넘거나(순환출자·과복잡 의심) 소유 그래프에 미식별 노드가 있으면, 차단이 아니라 **사람 검토(`REVIEW_*`)** 로 보낸다. **(2) 자연인 base case** --- 노드가 자연인이면 그 자격을 A-13(QP)/A-03(AI)에 직접 위임한다(재귀 종료). **(3) entity 독립 자격** --- entity가 *구성원과 무관하게* 그 자체로 QP((iv) $25M·QIB 간주)/AI(은행·보험·투자회사·private BDC·$5M 초과 non-formed 법인 등)이면, 더 내려가지 않고 그 지점에서 `COMPLETED`(look-through 불요). **(4) 유형별 look-through**(자격을 구성원에게서 빌려 오는 경우) --- ⓐ **신탁**은 *수익자(beneficialOwners)가 아니라* **수탁자·의사결정권자 + 각 위탁자·출연자**를 (i)(ii)(iv) 기준으로 확인하고(급조면 즉시 탈락), ⓑ **가족회사(비급조)** 는 자산·친족 구성뿐 아니라 **소유가 가족관계자(또는 그 estate·foundation·charity·trust)에 귀속**되는지 확인하며, ⓒ **급조 회사·(a)(8) entity** 는 각 beneficial owner가 자격인지 재귀로 확인한다(각 owner가 자체 자격이면 그 안에서 종료). **(5) 판정** --- 전원-충족이 필요한 분기에서 전원 자격이면 `COMPLETED`, 첫 비자격에서 즉시 차단(short-circuit); 데이터 미비·소유 귀속 불명은 `REVIEW_*`.

### 5.2 Pseudocode + 단계별 해설

```text
# 재귀의 종착점 = '독립적으로 자격이 확인된 owner node'.
# 자연인은 항상 그런 노드(A-03/A-13 직접 판정)이지만, entity도 자체로 QP/AI이면

[output truncated at 50000 of 83455 characters. Pass a larger max_chars (default 50000) to see more, or use read_page with a ref_id to focus on a smaller section.]

Tab Context:
- Executed on tabId: 437007841
- Available tabs:
  • tabId 437007716: "(1) 7/8 | Notion" (https://app.notion.com/p/deciphersnu/7-8-398dff004c898098b1defb8a486ffa72)
  • tabId 437007841: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/fe57044b-a22c-43c9-b250-23011810aaf3/Element.A-09_법인-lookthrough.md?table=block&id=39edff00-4c89-8052-b502-d88a3b05c87c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=6UzLCh4CCAonbLYy-A_Gg1ILiinPC7SJiPXATRgG1gE&downloadName=Element.A-09_법인-lookthrough.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/fe57044b-a22c-43c9-b250-23011810aaf3/Element.A-09_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%8B%E1%85%B5%E1%86%AB-lookthrough.md?table=block&id=39edff00-4c89-8052-b502-d88a3b05c87c&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=6UzLCh4CCAonbLYy-A_Gg1ILiinPC7SJiPXATRgG1gE&downloadName=Element.A-09_%E1%84%87%E1%85%A5%E1%86%B8%E1%84%8B%E1%85%B5%E1%86%AB-lookthrough.md)
  • tabId 437007842: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/8096c8f5-34c4-408a-94e5-935736ad5343/Element.A-11_증명-유효기간.md?table=block&id=39edff00-4c89-8042-bcd9-e5dca6b9843d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=r20MmF6DjItfge9I-Ge283zgry-ufPWIj-2YnoZ2s3E&downloadName=Element.A-11_증명-유효기간.md" (https://file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/8096c8f5-34c4-408a-94e5-935736ad5343/Element.A-11_%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%86%E1%85%A7%E1%86%BC-%E1%84%8B%E1%85%B2%E1%84%92%E1%85%AD%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md?table=block&id=39edff00-4c89-8042-bcd9-e5dca6b9843d&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=r20MmF6DjItfge9I-Ge283zgry-ufPWIj-2YnoZ2s3E&downloadName=Element.A-11_%E1%84%8C%E1%85%B3%E1%86%BC%E1%84%86%E1%85%A7%E1%86%BC-%E1%84%8B%E1%85%B2%E1%84%92%E1%85%AD%E1%84%80%E1%85%B5%E1%84%80%E1%85%A1%E1%86%AB.md)
  • tabId 437007843: "file.notion.com/f/f/46247d45-d757-4834-8084-c6beac171ffc/bdabd3f4-53d8-4926-8947-8861cbf1cf6c/Element.A-13_Qualified-Purchaser.md?table=block&id=39edff00-4c89-80dc-bd37-c0b94706773e&spaceId=46247d45-d757-4834-8084-c6beac171ffc&expirationTimestamp=1784764800000&signature=j7V7_UDrCw6Y_WFMpVpFPjYbO7K2bSIae_oR55N3XLo&downloadName=Element.A-13_Qualified-Purchaser.md" (
