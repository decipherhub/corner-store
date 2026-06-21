---
type: element-walkthrough
element-id: A-02
element-name: Jurisdiction Restriction (국가·관할 제한)
parent-recipe: R-XJ (Cross-Jurisdictional)·R1 (Reg D 506(c) Issuance)·R2 (§4(a)(7) Resale)·R3 (ICA §3(c)(7) Fund)
internal-id: ELE.A-02
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.901–905 — Regulation S(역외 거래 safe harbor·US person 정의): https://www.ecfr.gov/current/title-17/section-230.901"
  - "17 CFR § 230.902(k) — 'U.S. person' 정의: https://www.ecfr.gov/current/title-17/section-230.902"
  - "Morrison v. National Australia Bank, 561 U.S. 247 (2010) — 역외적용 transactional test: https://supreme.justia.com/cases/federal/us/561/247/"
  - "OFAC 포괄 제재 관할(31 CFR Chapter V — embargoed jurisdictions): https://ofac.treasury.gov/sanctions-programs-and-country-information"
created: 2026-06-17
updated: 2026-06-17
tags: [element, A-02, jurisdiction, reg-s, walkthrough, spec-sheet, R-XJ, pattern-A]
---

# A-02 Jurisdiction Restriction — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **매수인이 *어느 나라(관할)*의 사람인지를 보고 허용 여부를 판정하는 부품**(내부 식별자 A-02)을, 미국 증권 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 같은 토큰이라도 *어느 나라 사람이 사느냐*에 따라 적법성이 달라진다 — 미국 증권법(Reg S), 상대국 증권법, 포괄 제재 국가 여부가 모두 걸린다. 본 부품은 이 *관할 차원*을 거래 직전에 검사한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료 (v1.1, 2026-06-17 — eCFR 원문 1대1 대조).** 핵심 인용을 eCFR 원문·판례와 1대1 대조. **결과: 오류 0건.** — Reg S = §230.901–905 ✓ · **US person 정의 = Rule 902(k)** ✓(eCFR 확인) · offshore transaction = 902(h) · directed selling efforts = 902(c) ✓ · Morrison 561 U.S. 247 (2010) §10(b) transactional test("미국 거래소 상장 증권 거래 + 미국 내 거래"만 적용) ✓. 링크는 eCFR/uscode.house.gov로 교체(Reg S는 part-230이 아니라 시작 section **230.901**로 링크 — Cornell `part-230` 그대로 치환 시 깨지는 함정 회피).

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 본 부품은 *"증권 규제에는 국경이 있다(그리고 없다)"*는 이중성을 다룬다. 한편으로 미국 증권법은 *미국 안의 거래*를 규율하고 *역외(offshore) 거래*는 별도 안전항(Reg S)으로 다룬다 — 즉 *어디서·누구에게 파느냐*가 적법성을 가른다. 다른 한편 제재(특히 포괄 제재 국가)는 *국경을 넘어* 미국인·미국 시스템에 따라붙는다. 본 부품은 이 두 가지를 *매수인의 관할(jurisdiction)* 하나로 검사한다 — *"이 나라 사람에게 이 토큰을 팔아도 되는가."*

### 1.1 핵심 개념 — 같은 토큰, 다른 적법성

쉽게 말하면, 증권의 적법성은 *토큰 자체*만으로 정해지지 않는다. *누가 사느냐*, 특히 *어느 나라 사람이 사느냐*가 결정적이다. 세 가지 층이 겹친다 —

1. **미국 쪽(Reg S)**: 미국 발행 면제(Reg D)는 *미국 투자자*를 전제로 설계됐다. 미국 밖 투자자(non-US person)에게 파는 *역외 거래*는 **Regulation S**라는 별도 안전항을 따라야 한다. 즉 *미국인이냐 비미국인이냐*에 따라 적용 규제가 갈린다.
2. **상대국 쪽**: 매수인의 나라에도 *그 나라 증권법*이 있다. 어떤 나라는 외국 증권의 청약을 엄격히 제한한다. 그래서 플랫폼은 *판매가 허용된 관할*만 허용목록(allowlist)에 둔다.
3. **제재 쪽**: 포괄 제재 국가(예: 특정 금수 조치 대상국·지역)의 사람·주소는 *전면 차단*된다 — 이건 자격과 무관하게 무조건이다.

**본 부품의 일은 매수인의 관할을 이 세 층에 비추어, *허용/차단*을 거래 직전에 판정하는 것**이다.

### 1.2 어느 법·규칙에서 오는가

| 출처 | 무엇을 요구하나 | Decipher Recipe |
|---|---|---|
| **Regulation S (Rule 901–905)** | 역외 거래는 별도 안전항 — *US person/non-US person* 구분, directed selling efforts 금지 | R1·R2(역외 분기) |
| **Morrison v. NAB (2010)** | 미국 증권법의 *역외적용 한계*(거래 기반 transactional test) | 적용범위 판단 |
| **상대국 증권법** | 각국의 외국 증권 청약 제한 | allowlist 정책 |
| **OFAC 포괄 제재 관할** | 금수 국가·지역 전면 차단 | R-XJ(always-on) |

이들의 공통 메시지는 — *"매수인의 나라가 적법성을 바꾼다. 어느 관할인지 모르면 팔 수 없다."* 본 부품은 이 "어느 관할인가"를 확인한다.

### 1.3 왜 이 규제가 존재하는가

증권 규제는 *각국이 자국 투자자를 보호*하기 위해 만든 것이라, 본질적으로 *관할적(territorial)*이다. 미국은 미국 투자자를, 한국은 한국 투자자를 보호한다. 그래서 *국경을 넘는 판매*에는 충돌·공백이 생긴다 — 미국 규제를 우회해 미국인에게 팔거나, 상대국 규제를 어기고 외국인에게 파는 일. Reg S는 *미국 규제와 역외 거래의 경계*를 그어 이 충돌을 정리한 것이고(미국 밖 진짜 역외 거래는 미국 등록 면제), 포괄 제재는 *외교·안보 목적의 국가 단위 차단*이다. 본 부품은 이 관할 경계들을 *코드의 허용목록*으로 구현한다.

### 1.4 Decipher 시스템에서 왜 중요한가

본 부품은 *기계 판정형(deterministic)*이고 **거의 모든 거래에서 작동**한다(제재 부품 A-01과 함께 R-XJ의 always-on 멤버). 이유는 — 자격(QP·적격)이 아무리 완벽해도, *팔면 안 되는 관할*의 사람이면 거래 자체가 위법이기 때문이다. 특히 포괄 제재 관할은 *자격·금액과 무관하게 무조건 차단*이라, 본 부품은 다른 모든 자격 검사보다 *앞단의 관문* 성격을 가진다. 동시에 본 부품은 *Manifest(자산 신상카드)가 선언한 허용 관할*에 의존한다 — 같은 DEX라도 토큰마다 허용 관할이 다를 수 있어서다(§4).

### 1.5 한국법과의 비교 — 외국환거래법·역외적용, 그리고 selling restrictions

한국 인력의 직관을 위해: 한국 자본시장법도 *역외적용* 조항을 두어 *국외 행위가 국내에 영향을 미치면* 적용될 수 있고, **외국환거래법**은 국경 간 자본 이동을 규율한다. 또 실무에서 사모 발행 문서에는 *"selling restrictions(판매 제한)"* 조항이 들어가 *"이 나라들에는 청약·판매 불가"*를 명시한다. 본 부품의 관할 허용목록은 이 *selling restrictions를 코드화*한 것에 가깝다. 차이는 — 전통 금융에서는 인수인(underwriter)이 문서로 관리하던 것을, 본 부품은 *거래 직전 자동 게이트*로 강제한다는 점이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Jurisdiction Restriction** | 매수인 관할의 허용 여부 검사원 |
| 검사 대상 | 매수인의 *관할(국가·지역)*이 허용 범위인가 | "이 나라 사람에게 팔아도 되나" |
| Internal ID | A-02 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 허용목록 대조 | 관할 코드 vs Manifest allowlist |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 거래 시점 관할 확인 |
| 활성화 조건 | 거의 모든 거래(always-on) | 관할은 모든 거래에 걸림 |
| 주 활성화 Recipe | **R-XJ**(always-on, A-01과 함께)·R1·R2·R3 | 제재·역외의 횡단 게이트 |
| 연계 부품 | **A-01**(제재 명단)·**B-01**(Manifest 정합) | 제재·신상카드 허용관할 연계 |
| 성숙도 | 🟢 로직 확정 — allowlist 정책·역외 분기 정밀화 | 기계 판정, 정책값은 Manifest |
| 파일·위치 | A-02_jurisdiction-restriction.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim·정책에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽은 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 claim/정책이 제공 |
|---|---|
| 관할 vs 허용목록/제재관할 *집합 비교* | 매수인 *관할 확정*(거주·국적·설립지) |
| US/non-US 경로 분기(표지 반환) | *US person 판정*(Rule 902(k)) |
| | 거래지·역외성 *기준*(정책·ADR) |

→ 온체인은 *집합 포함 여부·경로 분기*만. *어느 관할인가·US person인가*는 claim(off-chain 판단).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **Securities Act §5 + 역외적용 원리** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77e&num=0&edition=prelim)]
>
> **한글 해석**(요지): §5는 *미국 내* 증권의 발행·판매에 등록을 요구한다. 그 *역외적용 범위*는 판례(Morrison)와 안전항(Reg S)으로 정해진다 — 즉 "어디서·누구에게"의 거래 성격이 §5 적용 여부를 가른다.

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.901–905 — Regulation S(역외 거래 safe harbor)** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.901)]
>
> **한글 해석**(요지): Reg S는 *미국 밖에서 이루어지는 진짜 역외 거래*에 §5 등록을 면제하는 안전항이다. 두 요건이 핵심 — ① *offshore transaction*(매수인이 미국 밖에 있음), ② *directed selling efforts 부재*(미국을 겨냥한 판매 노력 금지). 즉 *비미국인에게 미국 밖에서* 파는 것은 Reg S로, *미국인에게* 파는 것은 Reg D로 — 경로가 갈린다.

> **17 CFR § 230.902(k) — "U.S. person" 정의** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.902)]
>
> **한글 해석**(요지): Reg S는 *누가 "미국인(U.S. person)"인가*를 정밀히 정의한다 — 미국 거주 자연인, 미국 법률로 설립된 법인, 미국 소재 신탁·계좌 등. 이 정의가 *Reg D 경로냐 Reg S 경로냐*를 가르는 분기점이다.

해설: 본 부품의 핵심 분기가 여기 있다 — 매수인이 *US person이면 Reg D 자격 검사*로, *non-US person이면 Reg S 요건*으로 간다. 단순 "국가 코드"가 아니라 *Reg S의 US person 정의*에 따른 판정이라는 점이 중요하다.

> **OFAC 포괄 제재 관할(31 CFR Chapter V)** [🔗 [OFAC](https://ofac.treasury.gov/sanctions-programs-and-country-information)]
>
> **한글 해석**(요지): 특정 국가·지역에 대한 *포괄 제재(comprehensive sanctions)*는 그 관할의 사람·자산을 *전면 차단*한다(자격·금액 무관). 이는 SDN 개인 명단(A-01)과 별개로 *관할 단위* 차단이다.

### 3.3 Layer 3 — Interpretive guidance

> **Morrison v. National Australia Bank**, 561 U.S. 247 (2010) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/561/247/)]
>
> **Holding 핵심**: 미국 증권법(§10(b))의 역외적용은 *"미국 내 거래 또는 미국 거래소 상장 증권의 거래"*에만 미친다(transactional test). 행위지가 아니라 *거래지* 기준.
>
> **Decipher 관련성**: DEX 거래가 *어디서 일어난 것으로 보느냐*가 미국법 적용 범위를 좌우한다. 블록체인 거래의 "거래지" 판단은 회색지대라(매수인 소재·체인·운영 주체) 변호사 확인 대상이다(§12).

### 3.4 Sub-요건 분해

| 판정 요소 | 충족 조건 | 근거 |
|---|---|---|
| 포괄 제재 관할 | 매수인 관할이 금수 국가·지역 *아님* | OFAC 포괄 제재 |
| US person 여부 | US person인가(→Reg D 경로) / non-US(→Reg S 경로) | Rule 902(k) |
| Manifest 허용목록 | 매수인 관할이 *이 토큰의 허용 관할*에 포함 | selling restrictions·Manifest |
| 역외 요건(non-US 시) | offshore transaction·directed selling efforts 부재 | Rule 901–905 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 어떤 데이터가 필요한가

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `identity.jurisdiction` | enum(ISO 국가/지역) | Trusted Issuer KYC | 매수인의 관할(거주·국적·법인 설립지) |
| `identity.isUSPerson` | bool | Trusted Issuer | Rule 902(k) US person 여부(경로 분기) |
| `manifest.allowedJurisdictions[]` | array | Manifest(자산 신상카드) | 이 토큰이 *판매 허용된 관할* 목록 |
| `manifest.regSEligible` | bool | Manifest | 이 토큰이 Reg S 역외 판매를 지원하는가 |
| `sanctionsJurisdictionList` | list | OFAC(운영 갱신) | 포괄 제재 관할 목록 |

### 4.2 데이터의 핵심 — 관할은 "어떻게" 정하나

본 부품의 미묘함은 *"매수인의 관할을 무엇으로 정하느냐"*다 — 거주지? 국적? IP? 법인 설립지? **Reg S의 US person 정의(902(k))**가 기준선을 준다(거주·설립지 중심). 단순 IP 기반은 우회가 쉬워 부족하고, *Trusted Issuer KYC가 확정한 관할*을 신뢰한다. 즉 관할 *판정*은 신뢰기관이 하고(증명서형 요소), 본 부품은 그 결과를 *허용목록과 대조*(기계 판정)한다.

---

## §5. ③ 판정 로직

### 5.1 전체 흐름 (사람 말로)

① 포괄 제재 관할이면 즉시 차단 → ② 매수인 관할이 이 토큰의 허용목록에 있는지 확인 → ③ US person이면 Reg D 경로(다른 자격 부품으로), non-US면 Reg S 경로 가능 여부 확인 → ④ 통과/차단.

### 5.2 Pseudocode + 해설

```
function check_A_02(buyer_identity, asset_manifest):

    juris = buyer_identity.jurisdiction
    if juris == null:
        return FAIL_JURISDICTION_UNKNOWN          # 관할 미확인 → KYC 필요

    # 1단계: 포괄 제재 관할 — 무조건 차단(자격 무관)
    if juris in SanctionedJurisdictions:
        return FAIL_JURISDICTION_SANCTIONED

    # 2단계: 토큰의 허용목록 확인
    if juris not in asset_manifest.allowedJurisdictions:
        return FAIL_JURISDICTION_NOT_ALLOWED

    # 3단계: US/non-US 경로 분기
    if buyer_identity.isUSPerson:
        return PASS_US_PATH                        # Reg D 자격 검사로 진행(A-03/A-13 등)
    else:
        if not asset_manifest.regSEligible:
            return FAIL_REG_S_NOT_SUPPORTED        # 이 토큰은 역외 판매 미지원
        return PASS_REG_S_PATH                     # Reg S 요건으로 진행

```

- **1단계 해설**: 포괄 제재 관할은 *모든 것에 앞서* 차단한다. 자격·금액·토큰 종류와 무관하다.
- **2단계 해설**: 이 토큰이 *판매 허용한 관할*(Manifest 선언)에 매수인 관할이 있어야 한다. 없으면 차단 — selling restrictions의 코드화.
- **3단계 해설**: US person이면 미국 발행 면제(Reg D) 경로로 진행(이후 A-03/A-13가 자격 검사). non-US person이면 *이 토큰이 Reg S 역외 판매를 지원할 때만* Reg S 경로로 진행. 본 부품은 *경로를 결정*하고, 각 경로의 세부 자격은 다른 부품·Recipe가 본다.

### 5.3 핵심 — 본 부품은 "경로 분기기"이기도 하다

본 부품의 출력은 단순 PASS/FAIL이 아니라 **경로 표지(US_PATH / REG_S_PATH)**이기도 하다. 이 표지가 이후 어떤 자격 검사가 작동할지를 정한다 — US_PATH면 Reg D(적격투자자 A-03·QP A-13), REG_S_PATH면 Reg S 요건. 즉 본 부품은 *관할 게이트*이면서 동시에 *규제 경로의 분기점*이다.

### 5.4 비결정성 요소 — "거래지"와 관할 판정

로직은 결정론적이지만, 두 가지가 *사람·정책 판단*에 의존한다 — ① *매수인의 관할 확정*(Trusted Issuer KYC), ② *블록체인 거래의 "거래지"*(Morrison transactional test의 적용·회색지대). 후자는 코드가 못 정하므로 *정책·변호사 판단*으로 고정해 Manifest·정책에 반영한다(§12).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_JURISDICTION_UNKNOWN` | 관할 미확인 | KYC에 관할 정보 없음 | KYC 완료 | frontend 안내 |
| `FAIL_JURISDICTION_SANCTIONED` | 포괄 제재 관할 | 금수 국가·지역 | (회복 불가) | 차단 + 기록(컴플라이언스) |
| `FAIL_JURISDICTION_NOT_ALLOWED` | 허용목록 밖 | 이 토큰 판매 불가 관할 | (해당 토큰 거래 불가) | 안내 |
| `FAIL_REG_S_NOT_SUPPORTED` | non-US인데 토큰이 역외 미지원 | Reg S 경로 없음 | (해당 토큰 거래 불가) | 안내 |
| `PASS_US_PATH` / `PASS_REG_S_PATH` | 통과 + 경로 표지 | 정상 | (없음) | 해당 경로 자격 검사 진행 |

해설: 제재 관할 차단은 *회복 불가*(자격으로 풀 수 없음). 허용목록·역외 미지원은 *그 토큰에 한해* 불가일 뿐 사용자 자체의 결격은 아니다.

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass·US) | 미국 거주 적격투자자 | US person, allowlist에 US | **PASS_US_PATH** |
| T2 (Pass·RegS) | 비미국인, 토큰 역외 지원 | non-US, regSEligible=true | **PASS_REG_S_PATH** |
| T3 (Fail·제재) | 포괄 제재 관할 거주 | juris ∈ sanctioned | **FAIL_JURISDICTION_SANCTIONED** |
| T4 (Fail·허용목록) | 허용목록 없는 관할 | juris ∉ allowed | **FAIL_JURISDICTION_NOT_ALLOWED** |
| T5 (Fail·역외미지원) | 비미국인, 토큰 역외 미지원 | non-US, regSEligible=false | **FAIL_REG_S_NOT_SUPPORTED** |
| T6 (경계·US person 정의) | 해외 거주 미국 시민(902(k) US person) | 거주 해외·국적 US | **US_PATH**(902(k) 정의 우선·§5.4 확인) |

T6은 *US person 정의(902(k))*가 단순 거주지와 다를 수 있음을 검증한다(국적 기반 US person).

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A(기계 판정형)**다. *관할이 허용목록/제재목록에 있는가*는 집합 포함 여부라 결정론적이다.

**단, 입력(관할·US person)은 신뢰기관 판정 의존**: 로직은 결정론적이지만, *매수인의 관할·US person 여부*는 Trusted Issuer KYC가 확정한 값이다(증명서형 요소). 또 *거래지·역외성*은 정책 판단이다. 즉 *대조는 기계가, 관할 확정은 신뢰기관이, 역외성 기준은 정책이* 정한다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

```
A-02 ──"제재 관할"──▶ A-01(SDN 개인 명단)과 함께 R-XJ always-on 차단
A-02 ──"US/non-US 경로 표지"──▶ A-03(적격)·A-13(QP) [US_PATH] / Reg S 요건 [REG_S_PATH]
A-02 ──허용목록 의존──▶ B-01(Manifest 정합): allowedJurisdictions 무결성
```

- **A-01(제재 명단)과의 관계**: A-01은 *개인·법인 SDN 명단*, 본 부품은 *국가·관할 단위*. 둘이 함께 R-XJ의 always-on 제재 게이트를 이룬다 — A-01이 "이 사람", A-02가 "이 나라".
- **A-03/A-13과의 관계**: 본 부품의 *경로 표지*가 이후 자격 검사를 정한다. US_PATH면 Reg D 자격(A-03/A-13)이 작동.
- **B-01(Manifest)과의 관계**: 허용목록(allowedJurisdictions)은 Manifest가 선언하고 B-01이 무결성을 검사한다. 본 부품은 그 목록을 *신뢰해 대조*한다.
- **Recipe**: R-XJ always-on(제재 관할) + R1·R2·R3의 관할 게이트.

---

## §10. (γ) 3-Layer Solution — 책임 분배

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. Self-Attestation** | 매수인 | 관할 신고 | 허위 가능 → Layer 2 검증 |
| **2. Trusted Issuer** | 신뢰기관 | 관할·US person 확정(902(k)), KYC | IP 우회·다중 거주 회색지대 |
| **3. System Policy** | Decipher | 제재 관할 목록·허용목록·역외성 기준 | 정책 최신성·"거래지" 판단 의존 |

**escalation**: 관할 미확인은 KYC로, 제재 관할은 무조건 차단. 제재 관할 목록은 *운영상 즉시 갱신*(A-01 명단 갱신과 동일 리듬).

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 관할 확인 | Off-chain(Trusted Issuer) | KYC에서 거주·국적·법인지로 관할·US person 확정 |
| 차단 안내 | Frontend | "귀하 관할에서는 이 토큰을 거래할 수 없습니다"(사유별) |
| 경로 안내 | Frontend | US/Reg S 경로에 따른 후속 자격 절차 안내 |
| 제재 관할 갱신 | Off-chain(운영) | OFAC 포괄 제재 변경 시 목록 즉시 반영 |

---

## §12. Open Issues — 변호사·ADR 확인 대상

1. **블록체인 거래의 "거래지" 판정** 🔴 — Morrison transactional test를 DEX 거래에 어떻게 적용하나(매수인 소재·체인·운영 주체 중 무엇이 거래지인가). 미국법 적용범위를 좌우. ADR·변호사 확인.
2. **US person 판정 기준의 코드화** 🟡 — Rule 902(k)의 US person 정의(거주·국적·법인지·신탁)를 KYC 데이터로 정확히 매핑.
3. **Reg S 요건의 부품화 범위** 🟡 — offshore transaction·directed selling efforts 부재를 어디까지 본 부품/별도 부품으로 검사할지(현재는 경로 표지까지). 별도 Reg S 부품 신설 여부.
4. **허용목록(allowedJurisdictions) 거버넌스** 🟡 — 토큰별 허용 관할을 누가·어떤 근거로 Manifest에 설정·갱신하나(상대국 법률 자문 기반).
5. **포괄 제재 지역(국가 하위 지역)** 🟡 — 특정 지역(국가 일부) 제재의 관할 코드 매핑 정밀화(A-01 제재 부품과 일관).

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX_부품영문이름.md   (Element)
본 부품: A-02_jurisdiction-restriction.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *매수인 관할(국가·지역) 제한* 부품 심층 walkthrough 신설. ① 규제 맥락(증권 규제의 관할성·Reg S 역외 → §5·Reg S·상대국법·포괄제재 3층 → always-on·Manifest 의존 → 한국 외국환거래법·selling restrictions anchor), ② 법적 근거(§5·Reg S 901–905·US person 902(k)·Morrison·OFAC 포괄제재), ③ 입력(jurisdiction·isUSPerson·allowedJurisdictions·제재관할목록), ④ 판정 로직(제재→허용목록→US/RegS 경로분기 pseudocode·경로 표지), ⑤ 테스트 6종(US·RegS·제재·허용목록·역외미지원·US person 정의경계), 패턴 A(단 관할확정은 신뢰기관·거래지는 정책), A-01/A-03/A-13/B-01 coordination(A-01=사람·A-02=나라), 3-Layer, frontend, Open Issues 5종(거래지 판정·US person 코드화·Reg S 부품화·허용목록 거버넌스·지역제재). **인용 검증은 후속 일괄 패스 대상.** A-01과 함께 R-XJ always-on 제재 게이트 구성. 본 부품은 게이트이자 규제 경로 분기점.
