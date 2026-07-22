---
type: element-walkthrough
element-id: C-00
element-name: Resale Path Selector (전매 경로 선택기)
parent-recipe: R2 (§4(a)(7)·Rule 144 Resale)
internal-id: ELE.C-00
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 U.S.C. § 77d(a)(1) — §4(a)(1) 거래 면제(issuer·underwriter·dealer 제외): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim"
  - "15 U.S.C. § 77d(a)(7) — §4(a)(7) 적격투자자 간 전매(FAST Act 2015): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim"
  - "15 U.S.C. § 77b(a)(11) — 'underwriter' 정의: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77b&num=0&edition=prelim"
  - "17 CFR § 230.144 — Rule 144 전매 safe harbor: https://www.ecfr.gov/current/title-17/section-230.144"
created: 2026-06-17
updated: 2026-06-17
tags: [element, C-00, resale, selector, router, walkthrough, spec-sheet, R2, pattern-A, open-decision]
---

# C-00 Resale Path Selector — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **2차 거래(전매)의 *면제 경로*를 고르는 부품**(내부 식별자 C-00)을, 미국 증권 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 다른 자격 부품들이 *"이 사람이 자격이 있나"*를 본다면, 본 부품은 *"이 *되팔기*가 어느 면제 통로를 타야 적법한가"*를 **고르는 분기기(selector/router)**다. 스스로 자격을 판정하기보다, *어느 경로로 보낼지*를 정하고 그 경로의 실제 요건은 다른 부품(보유기간 C-01·적격투자자 A-03·내부자 A-06·합리적조사 A-12)에 넘긴다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — eCFR/uscode 검증 대기).** "먼저 작성, 검증 나중" 전략의 1차 초안. **미세 locator 주의 표시**: §4(a)(7)의 *하위 조건 글자(A)~(?)·FAST Act 2015 신설 연도*, Rule 144의 *하위 항 번호*는 검증 패스에서 uscode/eCFR 원문 1대1 대조로 확정한다(현재는 "확인 요" 표시).

> 🟡 **이 부품에는 *팀 결정 대기* 항목이 있다 (회의 2026-06-17).** BUIDL의 2차 거래 면제 경로(§4(a)(7) vs Rule 144)가 *미정*이다. 본 문서는 *두 경로를 모두 제시*하고, 선택은 §12 Open Issue로 남긴다 — 본 부품의 분기 로직은 *어느 쪽으로 결정되든* 동작하도록 설계했다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터 읽어야 하나.** 본 부품을 이해하려면 먼저 *"왜 되팔기가 어렵나"*를 알아야 한다. 사모(private placement)로 발행된 증권(BUIDL 같은)은 *제한증권(restricted securities)*이라, 산 사람이 *마음대로 되팔 수 없다*. 되팔려면 *그 되팔기 자체*가 등록 면제를 받아야 하는데, 면제 통로가 여럿이고 각각 조건이 다르다. 본 부품은 거래 직전에 *"이 되팔기는 어느 통로를 타야 하나"*를 판정해, 잘못된 통로로 가서 *미등록 증권 거래(=위법)*가 되는 걸 막는다.

### 1.1 핵심 문제 — "산 건 쉬운데 파는 게 어렵다"

쉽게 말하면, 사모 증권은 *살 때*보다 *되팔 때* 규제가 더 까다롭다. 왜냐하면 —

발행자가 사모로 증권을 팔 때는 *발행 면제*(Reg D 506 등)를 받는다. 그런데 그 증권을 산 사람이 다시 남에게 팔면, 그 *되팔기*는 발행자의 발행 면제와 무관한 *별개의 거래*다. 이 되팔기에 면제가 없으면, **되파는 사람이 §2(a)(11)의 "underwriter(인수인)"로 취급**되어 — 등록 없이 증권을 유통시킨 책임을 진다. 즉 *"나는 그냥 내 거 판 건데"*가 통하지 않고, *되팔기 자체의 면제 근거*가 필요하다.

**본 부품의 일은 그 되팔기가 *어느 면제 통로*를 타야 적법한지 고르는 것**이다. 통로를 잘못 고르면, 적법한 자격자끼리의 거래도 *미등록 유통*으로 위법이 된다.

### 1.2 면제 통로 4갈래 — 무엇이 있나

2차 거래(전매)의 면제 통로는 크게 넷이다. (각각의 *조건*은 §3에서, *선택 로직*은 §5에서.)

| 통로 | 한 줄 성격 | 주로 누가 | Decipher 연계 부품 |
|---|---|---|---|
| **§4(a)(1)** | issuer·underwriter·dealer가 *아닌* 자의 일반 거래 면제 | 비-내부자 일반 보유자 | (underwriter 비해당 판정) |
| **§4(a)(1½)** | 사모 재매각 — §4(a)(1)에 §4(a)(2) 원리를 *결합*한 *판례·실무상* 통로(조문 아님) | 주로 affiliate가 sophisticated 매수인에게 | A-06·A-03 |
| **§4(a)(7)** | *적격투자자 간* 전매의 *성문(codified) safe harbor* (FAST Act 2015 신설) | 자격자 간 거래 | A-03·A-12 |
| **Rule 144** | 보유기간·공시·수량 등 충족 시 *제한 해제* safe harbor | 보유기간 충족 보유자(특히 비-affiliate) | C-01·A-06 |

쉽게 말하면: §4(a)(1)은 "나는 인수인이 아니다"라는 *기본 통로*, §4(a)(1½)은 그 변형(사모 재매각), §4(a)(7)·Rule 144는 *조건을 명확히 한 안전항(safe harbor)*이다. 안전항은 *조건만 맞추면 확실히 면제*라 실무에서 선호된다.

### 1.3 왜 이 규제가 존재하는가

1933년법의 핵심은 *"공모 전에 등록·공시하라"*다. 만약 사모로 산 증권을 *아무 제한 없이* 되팔 수 있다면, 발행자가 *사모로 소수에게 판 뒤 그들이 즉시 대중에 되파는* 방식으로 *공모 등록을 우회*할 수 있다. 그래서 법은 *되팔기에도 면제 근거를 요구*하고, "underwriter" 개념으로 *우회적 유통*을 막는다. 안전항(§4(a)(7)·Rule 144)은 *"이 조건들을 지키면 우회가 아니라 적법한 재매각으로 본다"*는 명확한 선을 그어준 것이다. 본 부품은 그 선을 *거래 직전 자동 판정*으로 구현한다.

### 1.4 Decipher 시스템에서 왜 중요한가 — 그리고 팀 결정 대기

본 부품은 2차 거래(R2 Resale Recipe)의 *진입 분기*다. DEX는 본질적으로 *2차 유통시장*이므로, **BUIDL을 DEX에서 거래하는 거의 모든 행위가 "전매"**다. 따라서 어느 통로를 타느냐가 *DEX 거래 전체의 적법 근거*를 정한다.

**그런데 BUIDL의 전매 경로가 아직 *미정*이다(회의 2026-06-17).** 리서치 결과 BUIDL 측 자료는 *"whitelist에서 빼서 쓴다"*고만 하고 §4(a)(7) 같은 통로를 명시하지 않는다. 그래서 팀이 *§4(a)(7)로 갈지(→적격투자자 확인 A-03 재활용) Rule 144로 갈지(→보유기간 C-01 중심, A-03 불요)*를 결정해야 한다. **본 부품은 어느 쪽이든 동작하도록 *분기 구조*로 설계**하고, 결정은 Manifest 정책값으로 주입받는다(§5·§12).

### 1.5 한국법과의 비교 — 전매제한과 전매기준

한국 인력의 직관을 위해: 한국 자본시장법도 사모로 발행된 증권에 **전매제한**을 둔다 — 사모 발행이 *간주모집(전매가능성)*으로 공모 규제에 걸리지 않으려면, *전매를 제한하는 조치*(예: 일정 기간 보호예수, 권면분할 금지, 예탁결제원 보호예수 등)를 해야 한다. "사모로 산 걸 함부로 되팔면 공모 우회가 되니 제한한다"는 발상이 미국과 같다. 차이는 — 미국은 *되팔기마다 면제 통로(§4(a)(1)/(7)·Rule 144)를 선택*하는 *거래 단위* 구조이고, 본 부품은 그 선택을 *거래 직전 자동화*한다는 점이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Resale Path Selector** | 전매의 면제 통로 선택 분기기 |
| 검사 대상 | 2차 거래가 *어느 면제 통로*(§4(a)(1)/(1½)/(7)·Rule 144)에 해당하는가 | "이 되팔기는 어느 길로 가야 적법한가" |
| Internal ID | C-00 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 사실 기반 경로 라우팅(조건 자체는 타 부품) | 사실 → 통로 분기 |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 거래 시점 사실로 경로 결정 |
| 활성화 조건 | 2차 거래(전매) 전반 | 발행이 아닌 재매각 |
| 주 활성화 Recipe | **R2**(§4(a)(7)·Rule 144 Resale) | 2차 거래 면제 묶음의 진입 분기 |
| 후행/연계 부품 | **C-01**(보유기간)·**A-03**(적격)·**A-06**(내부자)·**A-12**(합리적 조사) | 선택된 통로의 *실제 요건*을 이들이 검사 |
| 성숙도 | 🟡 정밀화 필요 — **BUIDL 경로 미정(팀 결정)** + 변호사 위임 | 분기 구조는 확정, 정책값·경로는 미정 |
| 파일·위치 | C-00_resale-path-selector.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 위임하는 일

> **개발팀 핵심:** 본 부품은 *라우팅*만. 각 경로 요건은 *다른 부품*이, underwriter 판단은 *사람*이.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 위임 (타 부품/오프체인) |
|---|---|
| resaleFramework 정책값 + 진입 사실로 *경로 라우팅* | 경로 *요건 검사* → C-01·A-03·A-06·A-12 |
| 우선순위 선택(보수 안전항 우선) | underwriter 비해당 *판단*(§4(a)(1)/1½) |

→ 본 부품은 *교통정리*. 보유기간·적격·내부자·공시 같은 *요건*은 직접 안 보고 위임.

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

> ⚠️ 아래 *하위 조건 글자·신설 연도·하위 항 번호*는 검증 패스에서 uscode/eCFR 원문으로 확정(현재 "확인 요").

### 3.1 Layer 1 — Statutory base

> **§ 4(a)(1) — 일반 거래 면제** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim)]
>
> **한글 해석**(요지): §5 등록 요건은 **issuer(발행자)·underwriter(인수인)·dealer(딜러)가 아닌 자의 거래**에는 적용되지 않는다. → 일반 보유자의 재매각은 *그가 underwriter가 아니면* 면제. 핵심은 "underwriter 비해당".

> **§ 2(a)(11) — "underwriter" 정의** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77b&num=0&edition=prelim)]
>
> **한글 해석**(요지): "underwriter"는 *발행자로부터 *배포 목적*으로 증권을 취득해 유통시키는 자* 등을 포함한다. → 사모로 산 증권을 *대중에 되파는* 자는 underwriter로 취급될 수 있어 §4(a)(1) 면제를 잃는다. 안전항(§4(a)(7)·Rule 144)은 *"이 조건이면 underwriter가 아니다"*를 명확히 해준다.

> **§ 4(a)(7) — 적격투자자 간 전매 safe harbor** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section77d&num=0&edition=prelim)] *(FAST Act 2015 신설 — 연도 확인 요)*
>
> **한글 해석**(요지): 매수인이 *모두 적격투자자*이고, *일반청약(general solicitation) 없음*, 발행자가 일정 *정보 제공*, 매도인이 *발행자·그 자회사가 아님* 등의 조건을 충족하면, 그 전매는 §2(a)(11) underwriter에 해당하지 않는 *성문 safe harbor*로 면제된다. *조건의 하위 글자((A)~(?))는 검증 패스에서 확정.*

> **§ 4(a)(1½) — 사모 재매각(판례·실무상 통로)** *(조문 아님)*
>
> **한글 해석**(요지): §4(a)(1½)은 *법 조문이 아니라*, §4(a)(1)(일반 거래 면제)에 §4(a)(2)(사모 발행 면제) 원리를 *결합*한 *판례·실무상* 구성이다. 주로 *affiliate가 sophisticated 매수인에게 사모로 재매각*할 때 쓰인다. 성문 안전항이 아니므로 *사안별 판단*이 필요해 Decipher에서는 보수적으로 다룬다(§12).

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.144 — Rule 144 전매 safe harbor** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.144)]
>
> **한글 해석**(요지): 제한증권·지배증권(control securities)의 재매각이 *underwriter 거래가 아니라고 보는* 안전항. 핵심 조건 — **보유기간**(보고회사 6개월·비보고회사 1년: 본 시스템에선 C-01이 검사), **현재 공시정보(current public information)**, **(affiliate의 경우) 거래량 한도·매도방법·Form 144** 등. *비-affiliate*가 보유기간을 채우면 대체로 자유 재매각 가능. *하위 항((b)·(c)·(d) 등) 번호는 검증 패스에서 확정.*

해설: Rule 144는 *보유기간 중심*이라, BUIDL이 이 경로를 택하면 적격투자자 확인(A-03)보다 *보유기간(C-01)·공시정보·내부자 여부(A-06)*가 핵심이 된다. 반면 §4(a)(7)은 *적격투자자 확인(A-03)*이 핵심이다 — 이 차이가 §1.4의 팀 결정 핵심이다.

### 3.3 Layer 3 — Interpretive guidance

> **SEC v. Ralston Purina Co.**, 346 U.S. 119 (1953) [🔗 [Justia](https://supreme.justia.com/cases/federal/us/346/119/)]
>
> **성격**: 사모/공모의 경계("스스로를 지킬 수 있는 자")를 세운 foundational case. §4(a)(1½)·§4(a)(7)의 *sophisticated 매수인* 발상의 뿌리. (전매 맥락에서 "공모 우회 여부"의 판단 기준선.)

> **§4(a)(7) 신설 배경 — FAST Act(2015)** *(연도·법명 확인 요)*
>
> **성격**: §4(a)(7)은 *Fixing America's Surface Transportation Act*(FAST Act, 2015년 12월)로 신설된 *성문* 전매 면제로 알려져 있다. 그 이전의 §4(a)(1½) 실무를 *상당 부분 성문화*했다. 정확한 신설 시점·조건 문언은 검증 패스에서 uscode 원문으로 확정.

### 3.4 Sub-요건 분해 — 경로별 핵심 요건(개념)

| 통로 | 핵심 요건(풀어 읽기) | 검사 주체(부품) |
|---|---|---|
| §4(a)(1) | 매도인이 issuer·underwriter·dealer가 아님 | 내부자 여부(A-06)·배포목적 부재 |
| §4(a)(1½) | affiliate가 sophisticated 매수인에게 사모로(성문 아님·보수적) | A-06·A-03·사안판단 |
| §4(a)(7) | 매수인 전원 적격 + 일반청약 없음 + 정보제공 + 매도인≠발행자측 | A-03·A-12 |
| Rule 144 | 보유기간 충족 + 현재 공시정보 (+affiliate면 수량·방법·Form 144) | C-01·A-06 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

### 4.1 어떤 사실이 경로를 가르나

본 부품은 *새 자격을 판정하지 않는다.* 대신 *경로를 가르는 사실*들을 모아 분기한다.

| 필드 | 유형 | 출처 | 무엇을 가르나 |
|---|---|---|---|
| `manifest.resaleFramework` | enum | Manifest(자산 정책) | 이 자산이 허용한 전매 경로(SEC_4A7·RULE_144·EITHER) — *팀 결정값* |
| `seller.isAffiliate` | bool | A-06 | affiliate면 §4(a)(1) 대신 1½/144 + 추가 제약 |
| `seller.holdingPeriodMet` | bool | C-01 | Rule 144 경로 가능 여부 |
| `buyer.isAccredited` | bool | A-03 | §4(a)(7) 경로 가능 여부 |
| `currentPublicInfo` | bool | Manifest/발행자 | Rule 144의 공시정보 요건 |
| `generalSolicitation` | bool | 거래 맥락 | §4(a)(7) 차단 사유 |

### 4.2 데이터의 핵심 — 경로는 "정책 + 사실"의 결합

본 부품의 분기는 두 층이다 — ① **정책층**: Manifest가 *이 자산에 허용된 경로*를 선언(`resaleFramework` = 팀 결정값), ② **사실층**: 그 경로의 요건을 *이 거래의 사실*(affiliate·보유기간·적격 등)이 충족하는가. 정책이 경로를 *열고*, 사실이 그 경로를 *통과*시킨다.

---

## §5. ③ 판정 로직 — 어떻게 경로가 선택되는가

### 5.1 전체 흐름 (사람 말로)

① Manifest가 허용한 전매 경로를 본다 → ② 그 경로(들)의 진입 사실을 확인 → ③ 충족하는 경로로 라우팅(그 경로의 실제 요건 검사는 해당 부품에 위임) → ④ 어느 경로도 안 되면 거절.

### 5.2 Pseudocode + 해설

```
function check_C_00(txn, seller, buyer, asset):
    fw = asset.manifest.resaleFramework        # 팀 결정값: SEC_4A7 / RULE_144 / EITHER

    candidates = []
    if fw in (RULE_144, EITHER):
        if seller.holdingPeriodMet and asset.currentPublicInfo:
            candidates.append(PATH_RULE_144)    # 요건 상세는 C-01·A-06가 검사
    if fw in (SEC_4A7, EITHER):
        if buyer.isAccredited and not txn.generalSolicitation:
            candidates.append(PATH_4A7)         # 요건 상세는 A-03·A-12가 검사

    # §4(a)(1) 기본 통로: 비-affiliate·배포목적 부재 시 (보수적으로 144/4A7 우선)
    if candidates.isEmpty() and not seller.isAffiliate:
        candidates.append(PATH_4A1)             # underwriter 비해당 판정 필요

    if candidates.isEmpty():
        return FAIL_NO_RESALE_EXEMPTION
    route = select_priority(candidates)          # 정책 우선순위(보수적 경로 우선)
    return ROUTE(route)                          # 해당 경로 부품들로 위임
```

- **해설(선택기의 본질)**: 본 부품은 PASS/FAIL을 *직접* 내기보다 *경로(route)*를 반환한다. 선택된 경로의 *실제 요건*(보유기간·적격·내부자·공시)은 C-01·A-03·A-06·A-12가 검사하고, 그 결과가 R2 Recipe에서 누적 AND로 합쳐진다.
- **해설(정책값 의존)**: `resaleFramework`가 *팀 결정값*이라, 그 값이 정해지기 전에는 본 부품이 *EITHER(둘 다 시도)*로 보수 동작하거나 *보류*한다(§12).

### 5.3 경로 우선순위 — 왜 보수적 경로 우선인가

여러 경로가 동시에 가능하면, *조건이 더 명확하고 입증이 강한 안전항*(Rule 144·§4(a)(7))을 §4(a)(1)·1½보다 우선한다. §4(a)(1)·1½은 *사안별 판단(underwriter 비해당)*이 필요해 사후 다툼 여지가 크기 때문이다. 즉 *"확실한 안전항이 있으면 그쪽으로"*가 기본 정책.

### 5.4 비결정성 요소 — 경로 *선택*은 결정론, 경로 *요건*엔 판단이 섞임

본 부품의 *라우팅*은 사실 기반 결정론(패턴 A)이다. 그러나 라우팅이 보내는 경로 중 일부 요건은 비결정적이다 — §4(a)(1)의 "underwriter 비해당"이나 §4(a)(1½)의 "사모성"은 *사안 판단*이라, 그 경로로 가면 결국 off-chain 판단·claim(A-06·A-12)에 의존한다. 그래서 Decipher는 *결정론적 안전항(144·4A7)을 우선*해 비결정성을 최소화한다.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 매도인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_NO_RESALE_EXEMPTION` | 어느 경로도 진입 불가 | 적법한 전매 통로 없음 | 보유기간 충족 대기 또는 적격 매수인 탐색 | 사유(어느 요건 미달) 안내 |
| `ROUTE_RULE_144` | 144 경로 선택 | 보유기간·공시 경로로 진행 | (해당 요건 충족) | C-01·A-06로 위임 |
| `ROUTE_4A7` | §4(a)(7) 경로 선택 | 적격투자자 경로로 진행 | (해당 요건 충족) | A-03·A-12로 위임 |
| `REVIEW_4A1_UNDERWRITER` | §4(a)(1)/1½ 경로 | underwriter 비해당 *판단* 필요 | 추가 자료 | manual review(사안 판단) |
| `SUSPEND_RESALE_FRAMEWORK_UNSET` | `resaleFramework` 미설정 | 팀 경로 결정 전 | (대기) | 정책값 설정 대기(§12) |

해설: 본 부품의 "실패"는 *경로 부재*이고, 정상은 *경로로의 위임*이다. §4(a)(1)/1½ 경로는 *사안 판단*이 필요해 review로 보낸다(보수적). 정책값 미설정은 *대기(suspend)*.

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (144) | fw=RULE_144, 보유기간 충족·공시 있음 | holdingMet=true | **ROUTE_RULE_144** |
| T2 (4A7) | fw=SEC_4A7, 매수인 적격·일반청약 없음 | accredited=true | **ROUTE_4A7** |
| T3 (EITHER) | fw=EITHER, 둘 다 충족 | both ok | **보수 우선순위 경로**(§5.3) |
| T4 (Fail) | fw=RULE_144, 보유기간 미충족 | holdingMet=false | **FAIL_NO_RESALE_EXEMPTION** |
| T5 (4A7 차단) | fw=SEC_4A7, 일반청약 있음 | generalSolicitation=true | **FAIL_NO_RESALE_EXEMPTION** |
| T6 (정책 미정) | resaleFramework 미설정(BUIDL 현 상태) | fw=null | **SUSPEND_RESALE_FRAMEWORK_UNSET** |
| T7 (affiliate) | 매도인 affiliate, 144 경로 | isAffiliate=true | **ROUTE_RULE_144 + A-06 수량·방법 제약** |

T6은 *현재 BUIDL의 미정 상태*를 그대로 반영한다 — 팀 결정 전엔 보류.

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) 라우터

본 부품은 **패턴 A(기계 판정형)**의 *라우터* 형태다. *어느 경로가 열려 있고(정책) 진입 사실을 충족하는가*는 결정론적으로 분기된다. 단, 선택된 경로의 *요건 검사*는 다른 부품(C-01·A-03·A-06·A-12)이 각자의 패턴으로 수행한다 — 본 부품은 *교통정리*만 한다.

**왜 본 부품이 요건을 직접 안 보나**: 보유기간·적격·내부자·공시는 *이미 독립 부품*이 있다. 본 부품이 그걸 다시 판정하면 중복·불일치가 생긴다. 그래서 본 부품은 *경로 결정*에 집중하고 요건은 위임한다(역할 분리).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

```
C-00(경로 선택) ──ROUTE_RULE_144──▶ C-01(보유기간)·A-06(내부자 수량·방법)
C-00 ──ROUTE_4A7──▶ A-03(적격투자자)·A-12(합리적 조사·일반청약)
C-00 ──ROUTE_4A1/1½──▶ A-06 + manual review(underwriter 비해당 판단)
C-00 ◀──resaleFramework── Manifest(B-01 무결성)  // 팀 결정 정책값
R2 Recipe = C-00 진입 분기 → 선택 경로 부품들의 cumulative AND
```

- **R2(Resale Recipe)와의 관계**: 본 부품은 R2의 *진입 분기*다. R2의 법률효과("§2(a)(11) underwriter 비해당 safe harbor")는 *선택된 경로의 요건이 전부 충족*될 때 성립한다.
- **C-01(보유기간)과의 관계**: Rule 144 경로의 핵심 요건. 본 부품이 144로 라우팅하면 C-01이 6m/12m을 검사.
- **A-03(적격)와의 관계**: §4(a)(7) 경로의 핵심. 발행(R1)에서 쓰는 적격 검사를 *2차 거래 맥락*으로 재사용 — 단 발행 맥락과 *기준이 다를 수 있어*(회의 지적) 맥락 구분 필요.
- **A-06(내부자)와의 관계**: 매도인이 affiliate면 §4(a)(1) 기본통로가 막히고 144(수량·방법 제약)·1½로 가며, A-06·A-12가 함께 작동.
- **Manifest와의 관계**: `resaleFramework` 정책값을 Manifest가 선언, B-01이 무결성 검사.

---

## §10. (γ) 3-Layer Solution — 책임 분배

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. 정책 설정** | Decipher/발행자(팀 결정) | `resaleFramework` 경로 정책 설정 | 미설정 시 보류 |
| **2. 사실 수집** | Trusted Issuer·타 부품 | affiliate·보유기간·적격·공시 사실 | 각 부품 신뢰성 의존 |
| **3. 라우팅** | 본 부품(코드) | 정책+사실로 경로 결정·위임 | 요건 판정은 위임(직접 안 함) |

**escalation**: §4(a)(1)/1½ 경로는 *underwriter 비해당 판단*이 필요해 manual review. 정책 미설정은 suspend. 결정론적 안전항(144·4A7) 우선.

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 경로 안내 | Frontend | "이 거래는 [Rule 144 / §4(a)(7)] 경로로 진행됩니다" + 필요한 충족 요건 안내 |
| 정책 미정 안내 | Frontend | (BUIDL 현 상태) "전매 경로 정책 확정 전 — 거래 보류" |
| 경로 판단 자료 | Off-chain | §4(a)(1)/1½ 경로의 underwriter 비해당 판단 자료 |
| 정책 설정 | Off-chain(운영) | 팀 결정 후 Manifest `resaleFramework` 설정 |

---

## §12. Open Issues — 변호사·ADR·팀 결정 대기

1. **✅ 결정됨 (ADR-005, 2026-06-17): §4(a)(7) 주 경로 + Rule 144 보조.** → `resaleFramework=SEC_4A7` 기본값, A-03 재판매 **active**. *유일 잔여 확인 = general solicitation 판정(보경 변호사)* — 미충족 시 Rule 144+Reg S로 후퇴. 상세: 리서치 문서 38 / ADR-005.
2. **§4(a)(7) 조건 문언·하위 글자** 🟡 — (A)~(?) 조건과 FAST Act 2015 신설 시점을 uscode 원문으로 확정(검증 패스).
3. **Rule 144 하위 항·요건** 🟡 — 보유기간·공시·수량·방법·Form 144의 정확한 (b)(c)(d) 구조 확정(C-01과 분담).
4. **발행 vs 2차거래 적격 기준 차이** 🟡 — A-03을 §4(a)(7) 경로에서 재사용할 때 *발행 맥락과 기준이 다를 수 있음*(회의 지적). 맥락별 분리 확정.
5. **§4(a)(1½)의 코드화 범위** 🟡 — 성문 아님(사안 판단)이라 어디까지 자동화하고 어디부터 manual review인지 변호사 확인.

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX/B-XX/C-XX_부품영문이름.md   (Element)
본 부품: C-00_resale-path-selector.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *2차 거래(전매) 면제 경로 선택기(라우터)* 부품 심층 walkthrough 신설. ① 규제 맥락(제한증권 재매각 난점·underwriter 우회 방지 → §4(a)(1)/(1½)/(7)·Rule 144 4통로 → DEX=2차시장이라 핵심·BUIDL 경로 미정 → 한국 전매제한 anchor), ② 법적 근거(§4(a)(1)·§2(a)(11)·§4(a)(7) FAST Act·§4(a)(1½) 비성문·Rule 144·Ralston Purina), ③ 입력(resaleFramework 정책값 + affiliate·보유기간·적격·공시 사실), ④ 판정 로직(정책+사실 라우팅 pseudocode·보수 안전항 우선·경로 위임), ⑤ 테스트 7종(144·4A7·EITHER·실패·일반청약·정책미정·affiliate), 패턴 A 라우터(요건은 위임), C-01/A-03/A-06/A-12/Manifest coordination, 3-Layer, Open Issues 5종(**🔴 BUIDL 경로 팀 결정**·§4(a)(7) 문언·144 하위항·발행vs2차 기준차·1½ 코드화). **인용 검증 대기(uscode/eCFR)**, *미세 locator(하위 글자·연도·항번호) 확인 요* 표시. **팀 결정 대기 부품** — 분기 구조는 어느 경로든 동작하게 설계.
