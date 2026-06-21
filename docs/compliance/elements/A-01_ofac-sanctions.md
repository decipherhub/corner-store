---
type: element-walkthrough
element-id: A-01
element-name: OFAC Sanctions Screening (제재 명단)
parent-recipe: R-XJ (Cross-Jurisdictional, always-on)
internal-id: ELE.A-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "50 USC § 1701 et seq. — IEEPA(국제비상경제권한법): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title50-section1701&num=0&edition=prelim"
  - "31 CFR Chapter V — OFAC 규정(SDN·blocked persons): https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V"
  - "OFAC SDN List(Specially Designated Nationals): https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists"
  - "OFAC 50 Percent Rule — Revised Guidance(2014): https://ofac.treasury.gov/media/8442/download"
created: 2026-06-17
updated: 2026-06-17
tags: [element, A-01, ofac, sanctions, sdn, walkthrough, spec-sheet, R-XJ, pattern-A, always-on]
---

# A-01 OFAC Sanctions Screening — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **거래 당사자가 제재 대상인지 검사하는 부품**(내부 식별자 A-01)을, 미국 제재 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 이 부품은 *모든 거래에 무조건 작동*하는 가장 앞단의 관문이며, 위반 시 책임이 *무과실(strict liability)*이라 — 시스템에서 가장 보수적으로 설계되는 부품이다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료 (v1.1, 2026-06-17 — 1차 자료 대조, 미세인용 스트레스 샘플).** **결과: 오류 0건.** — IEEPA = **50 U.S.C. § 1701 et seq.** ✓ · OFAC 규정 = **31 CFR Chapter V** ✓ · **50% Rule = 2014-08-14 Revised Guidance**(합산·직간접 50%+면 미등재라도 blocked) ✓ · 민사 위반 = **무과실(strict liability)**·형사 = willful ✓. IEEPA 링크는 uscode.house.gov로 교체.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 본 부품은 다른 모든 부품과 *위상이 다르다.* 적격투자자·QP 검사는 *"증권법"*의 영역이지만, 제재(sanctions)는 *"외교·안보"*의 영역에서 온다. 그래서 제재는 ① *증권법과 독립*적으로 작동하고(자격이 완벽해도 제재 대상이면 무조건 차단), ② *무과실 책임(strict liability)*이라 "몰랐다"가 통하지 않으며, ③ *모든 거래*에 예외 없이 적용된다. 본 부품은 이 셋을 코드로 구현한다 — *가장 앞단에서, 가장 보수적으로.*

### 1.1 핵심 개념 — 제재는 "외교의 무기"다

쉽게 말하면, 제재는 *미국이 외교·안보 목적으로 특정 사람·단체·국가와의 거래를 금지*하는 제도다. 테러조직·마약 카르텔·대량살상무기 확산자·특정 정권 관련자 등이 **SDN List(Specially Designated Nationals, 특별지정대상자 명단)**에 오르고, 미국인·미국 시스템은 이들과 *어떤 거래도* 해서는 안 된다 — 그들의 자산은 *동결(blocked)*된다.

증권 거래에서 이게 왜 가장 앞단인가. 제재는 *그 사람이 적격투자자든 QP든 상관없다.* 골드만삭스급 자산가라도 SDN 명단에 오르면 거래 불가다. 그래서 본 부품은 *자격 검사보다 먼저, 모든 거래에서* 작동한다.

### 1.2 어느 법·규칙에서 오는가

| 출처 | 무엇을 요구하나 | Decipher Recipe |
|---|---|---|
| **IEEPA (50 USC §1701~)** | 대통령의 비상경제권한 — 제재의 법적 토대 | R-XJ(always-on) |
| **31 CFR Chapter V (OFAC 규정)** | SDN 명단·blocked persons와의 거래 금지 | R-XJ |
| **OFAC 50 Percent Rule** | SDN이 *50% 이상 소유*한 법인도 *자동 차단*(명단에 없어도) | R-XJ |
| **무과실 책임 원칙** | 위반은 *고의 불요* — 몰라도 책임 | 설계 보수성의 근거 |

이들의 공통 메시지는 — *"제재 대상과는 어떤 거래도 안 된다. 몰랐다는 변명은 통하지 않는다."* 본 부품은 이 절대적 금지를 *예외 없는 게이트*로 구현한다.

### 1.3 왜 이 규제가 존재하는가 — 그리고 왜 무과실인가

제재는 *국가 안보·외교 정책의 집행 수단*이라, 일반 규제보다 훨씬 엄격하다. 만약 "몰랐다"가 통하면, 제재 대상은 *복잡한 구조 뒤에 숨어* 얼마든지 우회한다. 그래서 OFAC 위반은 *무과실 책임(strict liability)*이다 — 고의가 없어도, *제재 대상과 거래했다는 사실 자체*가 위반이다. 이 무과실성이 본 부품의 설계를 지배한다: **의심스러우면 일단 막고, 오탐은 사람이 사후에 푼다.** 정당한 거래를 잠깐 막는 비용보다, 제재 대상을 한 번 통과시키는 비용이 *비교할 수 없이* 크기 때문이다.

또 하나 — **50% Rule**. SDN이 직접 명단에 없어도, *SDN들이 합산 50% 이상 소유한 법인*은 자동으로 차단된다(명단에 *없어도*). 이건 "법인 뒤에 숨기" 우회를 막는 장치다. 그래서 본 부품은 *개인 명단 대조*만이 아니라 *법인의 소유구조 look-through*까지 본다.

### 1.4 Decipher 시스템에서 왜 중요한가 — always-on·가장 보수적

본 부품은 **R-XJ(다국적 관할 공통 규제 세트)의 always-on 멤버**다(관할 부품 A-02·발행자 매수금지 F-04와 함께). 즉 *증권법 Recipe와 독립적으로, 모든 거래·모든 자산에 무조건* 작동한다. 그리고 무과실 책임 때문에 *가장 보수적으로* 설계된다 — fuzzy match(이름 유사)도 일단 보류하고 사람이 확인한다. 본 부품을 한 번 잘못 통과시키면 *프로젝트 전체가 OFAC 집행 대상*이 될 수 있어, 존립 위험(existential)이 자격 부품보다 더 직접적이다.

### 1.5 한국법과의 비교 — 테러자금금지법·UN 제재

한국 인력의 직관을 위해: 한국에는 **「공중 등 협박목적 및 대량살상무기확산을 위한 자금조달행위의 금지에 관한 법률」(테러자금금지법)**과 **UN 안보리 제재 이행** 체계가 있다. 금융회사는 *금융제재 대상자 명단*과 거래를 대조·차단해야 한다. "지정된 대상과의 거래 금지 + 명단 대조"라는 구조가 미국 OFAC과 같다. 차이는 — 미국 OFAC은 *역외적용(미국 달러·미국 시스템을 거치면 전 세계 적용)*이 광범위하고 *무과실 책임*이 엄격하며, *50% Rule* 같은 소유구조 look-through가 명문화돼 있다는 점이다. cross-border RWA를 다루는 Decipher는 *양쪽 명단(OFAC + UN/국내)*을 함께 봐야 한다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **OFAC Sanctions Screening** | 거래 당사자 제재 대상 검사원 |
| 검사 대상 | 매수·매도인(및 50% 소유 법인)이 제재 대상인가 | "이 사람·이 회사가 제재 명단인가" |
| Internal ID | A-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** + fuzzy match 보류 | 명단 대조·50% 소유 look-through |
| Timing | **pre-trade** | 거래 직전(가장 앞단) |
| Stateful 여부 | **STATELESS**(판정) — 단 명단은 운영상 수시 갱신 | 거래 시점 명단 대조 |
| 활성화 조건 | **모든 거래·모든 자산(always-on)** | 예외 없음 |
| 주 활성화 Recipe | **R-XJ**(always-on, A-02·F-04와 함께) | 증권법과 독립 횡단 게이트 |
| 연계 부품 | **A-02**(관할 제재)·**A-04**(신원 우회)·**A-08/09**(50% 소유 look-through) | 제재 우회 차단 협력 |
| 성숙도 | 🟢 로직 확정 — 50% 규칙·fuzzy 매칭·해제절차 정밀화(R-2) | 명단 대조 확정, 세부는 R-2 |
| 책임 성격 | **무과실(strict liability)** — 가장 보수적 설계 | 몰라도 책임 |
| 파일·위치 | A-01_ofac-sanctions.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 사람·claim에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. fuzzy 동일인 판단·소유구조 데이터는 사람/claim.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 사람/claim이 제공 |
|---|---|
| SDN 명단 *exact 대조* | fuzzy match *동일인 판단*(해제 결정) |
| 50% 소유 *합산 연산*(입력=소유트리) | 소유구조 *데이터*(누가 소유 — KYC) |
| fuzzy *탐지*→보류 | 확정 시 동결·OFAC 보고 결정 |

→ exact·집합 연산은 기계, *이름 유사가 진짜 동일인인지·소유트리 구성*은 사람/claim. (무과실이라 fuzzy는 보수적 보류.)

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **IEEPA (50 USC § 1701 et seq.)** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title50-section1701&num=0&edition=prelim)]
>
> **한글 해석**(요지): 대통령은 국가 비상사태에 대응해 *외국과의 거래·재산을 규제·동결*할 권한을 가진다. 이 권한에 근거해 재무부 OFAC이 제재 프로그램을 운영하고 SDN 명단을 관리한다. → 제재의 *법률적 뿌리*.

### 3.2 Layer 2 — Regulatory specification

> **31 CFR Chapter V — OFAC 규정** [🔗 [eCFR](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V)]
>
> **한글 해석**(요지): OFAC 규정은 *blocked persons(동결 대상)*과의 거래를 금지하고, 그 자산을 *동결*하도록 한다. 미국인·미국 금융시스템을 거치는 거래에 광범위하게 적용된다(역외적용). 위반 시 *민·형사 제재* — 다수가 *무과실(strict liability)* 기반.

> **OFAC 50 Percent Rule (Revised Guidance, 2014)** [🔗 [OFAC](https://ofac.treasury.gov/media/8442/download)]
>
> **한글 해석**(요지): *하나 이상의 blocked person이 합산 50% 이상 소유한 법인*은, **그 법인이 SDN 명단에 *없더라도* 자동으로 blocked**된다. 소유는 *직간접 합산*으로 본다(소유의 소유까지). → "법인 뒤에 숨기" 우회를 막는 핵심 규칙. 본 부품의 *소유구조 look-through*가 여기서 나온다.

해설: 50% Rule이 본 부품을 단순 "명단 대조"보다 복잡하게 만든다. 매수 법인의 *소유자*가 SDN인지, 그 소유 지분이 *합산 50%*를 넘는지 — 즉 *소유구조를 들여다봐야* 한다(자격 look-through A-08/A-09와 구조는 닮았으나 *목적이 제재*라는 점이 다름).

### 3.3 Layer 3 — Interpretive guidance

> **OFAC 무과실 책임·집행 관행**(Enforcement Guidelines)
>
> **성격**: OFAC 위반은 다수가 *무과실(strict liability)* 기반이라, *고의·인식 없이도* 책임이 성립한다(과실·자진신고·compliance program은 *제재 감경* 요소). 이 원칙이 본 부품의 *극도로 보수적인 설계*(fuzzy match도 보류)를 정당화한다.

> **OFAC SDN List + 이름 매칭 가이던스**
>
> **성격**: SDN 명단은 *별칭(aka)·음역·철자 변형*이 많아 *fuzzy matching*이 필요하다. OFAC은 매칭 시 *합리적 주의*를 권고하며, 오탐(false positive) 시 *추가 식별정보로 해제*하는 절차를 안내한다. 본 부품의 "보류 → 사람 해제"가 여기에 정렬한다.

### 3.4 Sub-요건 분해

| 판정 요소 | 충족(차단) 조건 | 근거 |
|---|---|---|
| 직접 명단 대조 | 당사자가 SDN 명단과 일치 | 31 CFR·SDN List |
| 50% 소유 법인 | SDN들이 합산 50%+ 소유한 법인 | 50 Percent Rule |
| 간접 소유 | 소유의 소유까지 합산 | 50% Rule(직간접) |
| fuzzy match 보류 | 이름 유사(별칭·음역) — 확정 전 보류 | 매칭 가이던스 |
| 무과실 | 고의 불요 — 일치 자체가 차단 사유 | strict liability |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 어떤 데이터가 필요한가

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `party.identityRef` | id | Trusted Issuer KYC | 당사자 신원(이름·생년·국적·식별자) |
| `party.ownershipTree[]` | array | KYC/A-08·A-09 | 법인 소유구조(50% Rule look-through용) |
| `sdnList` | dataset | OFAC(수시 갱신) | SDN 명단(별칭·식별자 포함) |
| `sdnMatchScore` | float | 매칭 엔진 | 명단과의 유사도(fuzzy) |
| `clearanceRecord`(선택) | ref | 운영 | 과거 오탐 해제 기록(재차단 방지) |

### 4.2 데이터의 핵심 — 명단의 신선도와 소유구조

본 부품의 입력에서 두 가지가 핵심이다 —
- **명단 신선도**: SDN 명단은 *수시로 갱신*된다(새 지정·해제). 본 부품은 *최신 명단*을 봐야 한다 — 어제 깨끗했어도 오늘 지정될 수 있다. (always-on + 무중단 갱신이 필수.)
- **소유구조**: 50% Rule을 적용하려면 *법인의 소유자·지분*을 알아야 한다. 이 데이터는 KYC와 법인 부품(A-08/A-09)의 소유구조 자료를 공유한다(목적은 다르지만 데이터는 겹침).

---

## §5. ③ 판정 로직

### 5.1 전체 흐름 (사람 말로)

① 당사자(매수·매도 양쪽)를 최신 SDN 명단과 대조 → ② 직접 일치면 차단 → ③ 법인이면 소유구조를 들여다봐 SDN 합산 지분 50% 이상인지 확인 → ④ 이름 유사(fuzzy)면 *보류 후 사람 확인* → ⑤ 깨끗하면 통과.

### 5.2 Pseudocode + 해설

```
function check_A_01(buyer, seller, asset):
    for party in [buyer, seller]:                 # 양쪽 모두 검사
        # 1단계: 직접 명단 대조(최신 명단)
        match = SDN.match(party.identity, list=OFAC.latest())
        if match.score >= EXACT_THRESHOLD:
            return FAIL_SANCTIONED                 # 직접 일치 → 차단

        # 2단계: 50% Rule — 소유구조 look-through
        if party.isEntity:
            sdn_ownership = aggregate_sdn_ownership(party.ownershipTree)
            if sdn_ownership >= 0.50:
                return FAIL_SANCTIONED_50PCT       # SDN 50%+ 소유 법인 → 차단

        # 3단계: fuzzy match — 보류(무과실이라 보수적)
        if FUZZY_THRESHOLD <= match.score < EXACT_THRESHOLD:
            if not cleared_before(party, match):
                return REVIEW_SANCTIONS_POSSIBLE_MATCH   # 보류 + 사람 확인

    return PASS
```

- **1단계 해설**: 양쪽 당사자를 *최신* 명단과 대조. exact 일치면 즉시 차단 — 무과실이라 다른 사정을 보지 않는다.
- **2단계 해설**: 법인이면 소유구조를 들여다본다. *SDN들의 합산 지분*이 50% 이상이면, 그 법인이 명단에 없어도 차단(50% Rule). 간접 소유(소유의 소유)까지 합산한다.
- **3단계 해설**: 이름이 *유사하지만 확정 아님*(별칭·음역)이면 — *보류*하고 사람이 추가 식별정보로 확인한다. 무과실 책임이라 *"아마 다른 사람일 것"으로 통과시키지 않는다.* 과거에 같은 매칭이 오탐으로 *해제된 기록*이 있으면 재보류하지 않는다(반복 방지).

### 5.3 보수성의 원칙 — 왜 보류가 통과보다 안전한가

본 부품은 의도적으로 *과잉차단(over-block) 쪽으로 기운다.* 이유는 비용 비대칭이다 — *정당한 사람을 잠깐 보류*하는 비용은 *불편*이지만, *제재 대상을 한 번 통과*시키는 비용은 *프로젝트 존립*이다(무과실 책임). 그래서 fuzzy match는 통과가 아니라 *보류*가 기본값이다. 단, 보류가 *영구 차단*이 되지 않도록 *신속한 사람 해제 절차*(추가 식별정보 대조)를 둔다(§6).

### 5.4 비결정성 요소 — fuzzy match와 소유구조

로직의 *대조*는 결정론적이지만, 두 가지가 판단을 요한다 — ① *fuzzy match가 진짜 동일인인가*(추가 식별정보로 사람이 확인), ② *소유구조 자료의 정확성*(KYC·법인 실사 의존). 그래서 본 부품은 *기계 대조 + 사람 해제*의 결합이다.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_SANCTIONED` | 직접 명단 일치 | 제재 대상 본인 | (회복 불가) | 차단 + 자산 동결 고려 + OFAC 보고 검토 |
| `FAIL_SANCTIONED_50PCT` | SDN 50%+ 소유 법인 | 제재 대상 소유 법인 | (회복 불가) | 차단 + 기록 |
| `REVIEW_SANCTIONS_POSSIBLE_MATCH` | 이름 유사(fuzzy) | 오탐 가능 | 추가 식별정보(생년·여권) 제출 | 보류 + *신속* 사람 확인 → 해제/차단 |
| `PASS` | 명단 무관 | 정상 | (없음) | — |

해설: 직접 일치·50% 일치는 *회복 불가*(자격으로 못 풀고, 자산 동결·보고 의무까지 연결될 수 있음). fuzzy 보류는 *오탐이면 신속 해제* — 여기서 처리 속도가 UX와 컴플라이언스의 균형점이다. (제재 대상으로 *확정*되면 자산 동결·OFAC 보고 등 *증권법 밖의 별도 의무*가 발생할 수 있어 변호사·컴플라이언스 연계가 필요하다 — §12.)

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass) | 명단 무관 당사자 | match.score 낮음 | **PASS** |
| T2 (Fail·직접) | SDN 본인 | exact match | **FAIL_SANCTIONED** |
| T3 (Fail·50%) | SDN 2인이 합산 60% 소유한 LLC | sdn_ownership=0.60 | **FAIL_SANCTIONED_50PCT** |
| T4 (Review·fuzzy) | 흔한 이름이 SDN과 유사 | fuzzy score | **REVIEW_SANCTIONS_POSSIBLE_MATCH** |
| T5 (해제) | T4가 추가 식별정보로 오탐 확인 | clearance | **PASS**(해제 기록) |
| T6 (경계·간접소유) | SDN이 중간 법인 통해 간접 합산 50% | 간접 합산 | **FAIL_SANCTIONED_50PCT**(직간접 합산) |
| T7 (명단 갱신) | 어제 깨끗했으나 오늘 지정 | 최신 명단 일치 | **FAIL_SANCTIONED**(무중단 갱신) |

T6·T7은 *50% 간접소유 합산*과 *명단 무중단 갱신*이라는 본 부품의 핵심 난점을 검증한다.

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) + 보수적 보류

본 부품은 **패턴 A(기계 판정형)**가 본체이되, *fuzzy match는 감시형(C)처럼 사람 보류*를 결합한다. 명단 대조·소유 합산은 결정론적이지만, *이름 유사 판단*은 사람 확인이 필요하기 때문이다.

**왜 보수적 보류인가**: 무과실 책임 때문에 *오탐 통과의 비용 > 오탐 보류의 비용*이다. 그래서 다른 부품과 달리 *의심이면 일단 막는다.* 다만 적법 사용자를 영구 차단하지 않도록 *신속 해제 절차*로 균형을 잡는다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

```
A-01(제재 명단·사람/법인) ── always-on ──▶ R-XJ (A-02 관할·F-04 매수금지와 함께)
A-01 ──소유구조 look-through(50%)──▶ A-08/A-09 데이터 공유(목적은 제재)
A-01 ──신원 우회 의심──▶ A-04(dedup): 제재 대상의 신규 신원 차단
A-02(관할 제재) ── 나라 단위 ──▶ A-01 사람 단위와 상보
```

- **A-02(관할)와의 관계**: A-02는 *제재 관할(나라)*, 본 부품은 *제재 대상(사람·법인)*. 둘이 R-XJ always-on 제재 게이트를 함께 이룬다 — A-02=나라, A-01=사람.
- **A-08/A-09와의 관계**: 50% Rule의 *소유구조 look-through*는 자격 look-through(A-08/A-09)와 *데이터를 공유*한다(소유 트리). 단 본 부품은 *제재 소유*를, A-08/09는 *자격*을 본다(목적 분리).
- **A-04(dedup)와의 관계**: 제재 대상이 *새 신원·새 지갑*으로 우회하는 것을 A-04가 1차로 잡아 본 부품에 연계.
- **Recipe**: R-XJ always-on — *증권법 Recipe(R1·R2·R3)와 독립적으로* 모든 거래에 무조건 작동(ADR-002).

---

## §10. (γ) 3-Layer Solution — 책임 분배

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. 자동 명단 대조** | 본 부품(코드) | 최신 SDN 대조·50% 소유 합산·fuzzy 탐지 | 이름 유사·소유 은닉은 사람 확인 |
| **2. Trusted Issuer KYC** | 신뢰기관 | 신원·소유구조 확정(대조 입력 품질) | 위조·은닉 한계 |
| **3. 컴플라이언스 검토** | Decipher 컴플라이언스 | fuzzy 해제·확정 시 동결·OFAC 보고 | 속도·전문성 요구 |

**escalation**: exact/50%는 자동 차단, fuzzy는 신속 사람 해제. *확정 제재 대상*은 자산 동결·보고 등 *증권법 밖 의무*로 escalate(변호사·컴플라이언스). 명단은 *무중단 갱신*이 전제.

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 보류 안내 | Frontend | "추가 본인확인이 필요합니다"(fuzzy 보류 — 거절 단정 회피) |
| 추가 식별정보 제출 | Frontend | 생년·여권 등으로 오탐 해제 자료 제출 |
| 명단 무중단 갱신 | Off-chain(운영) | OFAC 명단 변경을 *지연 없이* 반영(always-on의 생명) |
| 해제·동결 결정 | Off-chain(컴플라이언스) | fuzzy 해제 또는 확정 시 동결·보고 |

**UX 핵심**: fuzzy 보류는 *"제재 대상으로 단정"하지 않고* "추가 확인 필요"로 안내해야 한다(명예·법적 위험). 동시에 *exact/50% 차단*은 명확히 막고 기록한다. 명단 갱신 지연은 *치명적*이라 무중단 파이프라인이 필수.

---

## §12. Open Issues — 변호사·컴플라이언스·R-2 확인 대상

1. **50% Rule 소유구조 산정** 🔴 — 직간접 합산·중간 법인 처리의 정밀 규칙(R-2 리서치). 소유 데이터 출처·신뢰도. A-08/A-09 데이터와의 공유 범위.
2. **fuzzy 매칭 임계치·해제 절차** 🔴 — EXACT/FUZZY 임계, 별칭·음역 처리, 오탐 해제 SLA(R-2). 과잉차단 vs 통과 위험 균형.
3. **명단 무중단 갱신 아키텍처** 🟡 — OFAC(+UN/국내) 명단을 *지연 없이* 반영하는 파이프라인. 갱신 지연 시 책임.
4. **확정 시 동결·보고 의무** 🟡 — 제재 대상 확정 시 자산 동결·OFAC 보고 등 *증권법 밖 의무*의 절차·책임 주체(컴플라이언스·변호사).
5. **다중 명단 통합** 🟡 — OFAC SDN + UN 안보리 + 한국 등 *복수 제재 명단*을 cross-border 거래에서 어떻게 통합 적용할지(A-02 관할과 연계).
6. **무과실 책임 하의 운영자 책임 범위** 🟡 — DEX 운영 주체·SDK 사용자의 OFAC 책임 분배(ADR·운영 규약 연계).

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX_부품영문이름.md   (Element)
본 부품: A-01_ofac-sanctions.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *제재 대상(OFAC SDN) 검사* 부품 심층 walkthrough 신설. ① 규제 맥락(제재=외교·안보 무기·증권법과 독립·무과실 → IEEPA·OFAC·50% Rule·strict liability → always-on·가장 보수적 → 한국 테러자금금지법·UN 제재 anchor), ② 법적 근거(IEEPA·31 CFR Ch.V·SDN List·50% Rule 2014 가이던스·무과실 집행), ③ 입력(identity·ownershipTree·최신 명단·fuzzy score·해제기록·명단 신선도), ④ 판정 로직(양쪽 대조·50% 소유 look-through·fuzzy 보류 pseudocode·보수성 원칙), ⑤ 테스트 7종(pass·직접·50%·fuzzy·해제·간접소유·명단갱신), 패턴 A+보수적 보류(무과실 비용 비대칭), A-02/A-08/A-09/A-04 coordination(A-01=사람·A-02=나라·50%는 소유 look-through), 3-Layer, frontend(보류 안내·무중단 갱신), Open Issues 6종(50% 산정·fuzzy 임계·갱신 아키텍처·동결보고·다중명단·운영자 책임). **인용 검증은 후속 일괄 패스 대상(R-2 연동).** R-XJ always-on, A-02·F-04와 횡단 게이트. 무과실 책임 = 과잉차단 쪽 보수 설계.
