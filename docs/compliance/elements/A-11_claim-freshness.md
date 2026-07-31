---
type: element-walkthrough
element-id: A-11
element-name: Claim Freshness (증명 유효기간)
parent-recipe: R1 (Reg D 506(c) Issuance)·R2 (§4(a)(7)·Rule 144 Resale)·R3 (ICA §3(c)(7) Fund)
internal-id: ELE.A-11
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "15 USC § 80a-3(c)(7)(A) — 'at the time of acquisition': https://www.law.cornell.edu/uscode/text/15/80a-3"
  - "17 CFR § 230.506(c)(2)(ii)(E) — 직전 검증 5년 신뢰: https://www.law.cornell.edu/cfr/text/17/230.506"
  - "17 CFR § 270.2a51-1(d) — investments 평가 'most recent practicable date': https://www.law.cornell.edu/cfr/text/17/270.2a51-1"
created: 2026-06-17
updated: 2026-06-17
tags: [element, A-11, claim-freshness, expiry, walkthrough, spec-sheet, R1, R2, R3, pattern-A]
---

# A-11 Claim Freshness — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **자격 증명서가 *아직 유효한지(만료되지 않았는지)*를 확인하는 부품**(내부 식별자 A-11)을, 미국 증권·펀드 규제를 처음 보는 사람도 이해할 수 있도록 풀어 쓴 인수인계 문서다. 다른 부품들이 *"이 사람이 자격이 있는가"*를 본다면, 본 부품은 *"그 자격 증명이 *지금 이 거래 시점에도* 살아 있는가"*만 본다. 단순해 보이지만, **"지금 이 거래 시점"이 블록체인에서 정확히 언제인가**라는 질문이 본 부품의 핵심 난점이다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스 — **506(c)(2)(ii)(F)→(E) 정정**, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** "먼저 작성, 인용 검증은 후속 일괄 패스" 전략에 따른 1차 초안이다. 특히 Rule 506(c)(2)(ii)(E)의 5년 신뢰 규정 문언은 검증 패스에서 원문 대조로 재확인한다.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

<<<<<<< HEAD
> **왜 맥락부터 읽어야 하나.** 이 부품은 한 줄로 말하면 *"이미 발급된 자격 증명이, 지금 이 거래의 시점에도 아직 유효한가"를* 거래 직전에 판정한다. 그런데 "유효기간"의 근거는 조문마다 다르고(어떤 건 법규가 정하고, 어떤 건 아예 없어 정책으로 메운다), 그 차이를 모르면 "왜 AI는 5년이고 QP는 1년이냐"를 설명할 수 없다. 그래서 큰 그림(미국 증권법의 구조 → 증명이 "상하는" 문제가 생긴 역사 → 두 갈래의 신선도 논리 → 우리 시스템에서의 존재론적 의미)을 먼저 깐다.

### 1.1 미국 증권법의 4개 기둥(4 Pillar)과 그중 A-11의 자리

미국 연방 증권규제는 한국처럼 하나의 「자본시장법」으로 통합돼 있지 않고, 시대별로 따로 만들어진 4개의 큰 법률이 각자 다른 국면을 맡는다. 한국은 증권 관련 규제가 한 건물 안의 여러 부서라면, 미국은 길 건너 따로 선 4개의 건물이다.

| 기둥(법률) | 맡는 국면 | 핵심 관심사 | 한국법 대응(직관용) |
|-----------|-----------|-------------|---------------------|
| Securities Act of 1933(1933년법) | 증권의 발행(1차 시장) | "팔기 전에 등록·공시했는가" | 자본시장법 증권신고서·공모 규제 |
| Securities Exchange Act of 1934(1934년법) | 증권의 유통·거래소·중개업자(2차 시장) | "거래소·broker-dealer·계속공시" | 자본시장법 유통시장·금융투자업 |
| Investment Company Act of 1940(ICA, 투자회사법) | 집합투자기구(펀드) 자체의 규율 | "펀드 구조가 투자자를 착취하지 않는가" | 자본시장법 집합투자(펀드) 규제 |
| Investment Advisers Act of 1940(투자자문업자법) | 투자자문업자(adviser) | "남의 돈을 굴려주는 자의 신인의무" | 자본시장법 투자자문·일임업 |

A-11은 이 중 *한 기둥에만 속하지 않는다*. A-11은 **자격 게이트의 시간축 보조 부품**이라, 1933년법 축(Reg D 506(c)의 AI 검증)과 투자회사법 축(ICA §3(c)(7)의 QP 요건)에 *둘 다* 얹혀, 각 축이 발급한 자격 증명이 "거래 시점에도 아직 살아 있는가"를 본다. 즉 A-11은 자격의 *실체*(누가 AI인가·누가 QP인가)를 판정하지 않는다 — 그건 A-03(AI)·A-13(QP)의 일이다. A-11이 답하는 질문은 오직 하나다 — "그 증명이 발급된 뒤 너무 오래돼 더는 믿을 수 없게 되지 않았는가."

**쉽게 말하면:** 자격 판정이 "이 사람은 자격이 있다"를 정하는 일이라면, A-11은 "그 판정서에 찍힌 날짜가 아직 유효한가"를 보는 일이다. 판정 자체가 아니라 판정의 *유통기한*을 본다.

### 1.2 왜 이 규제가 존재하는가 — "증명이 상하는" 문제와 506(c)의 역사

자격 증명은 *과거 한 시점의 사실*을 적어 둔 종이다. "2024년에 이 사람의 순자산은 기준을 넘었다." 시간이 지나면 그 사실은 변할 수 있고(소득 감소·자산 하락·지위 변경), 법은 "언제까지 그 종이를 믿어도 되는가"의 경계선을 그어야 한다. 이 경계선이 왜, 어떻게 생겼는지는 506(c)의 역사에서 나온다.

**1단계 — 2012년 JOBS Act가 검증의무를 만들었다.** 원래 사모(Reg D)에서는 *일반청약·광고(general solicitation)*가 금지였다. 광고 없이 아는 사람에게만 파니, 매수인이 적격인지 별도로 "검증"할 필요가 크지 않았다. 그런데 2012년 JOBS Act §201(a)가 Rule 506(c)를 신설해 *일반청약·광고를 허용*하는 대신, 그 대가로 issuer에게 **모든 매수인이 accredited investor임을 검증할 reasonable steps 의무**를 지웠다(§3.2). 광고를 풀어주는 대신 문지기 의무를 새로 얹은 것 — 이 "검증의무"가 A-11이 시간축에서 지키는 대상이다.

**2단계 — 2020년 개정이 "재검증 없이 믿어도 되는 5년"을 만들었다.** 문제는, 검증을 매 거래마다 처음부터 다시 하면 반복 투자자에게 과도한 부담이라는 점이었다. 그래서 SEC는 2020년 사모 면제 체계 현대화(Release No. 33-10884, 86 FR 3496; 2021-03-15 시행)에서 Rule 506(c)(2)(ii)(E)를 신설했다 — 한 번 제대로 검증한 자에 대해, *반대 정보가 없고 거래 시점에 서면진술을 받으면, 검증일로부터 5년간 그 검증을 재사용*할 수 있게 했다(§3.3). **이 5년이 곧 A-11의 AI claim 유효기간 상한의 직접 근거다.** 즉 A-11의 "5년"은 우리가 임의로 고른 숫자가 아니라, 2020년 연방규칙이 명시한 재사용 기간이다.

**3단계 — 투자회사법 축에는 그런 기간이 아예 없다.** QP 쪽은 사정이 다르다. ICA §3(c)(7)은 1996년 NSMIA로 신설됐는데, 펀드 증권이 "*취득 시점*(at the time of acquisition)에 QP인 자"에게만 배타적으로 보유될 것을 요구할 뿐, "QP 증명이 며칠 뒤 만료된다" 같은 재검증·유효기간 조항을 *두지 않았다*(§3.5). §2(a)(51)의 QP 정의도 자산 기준만 정할 뿐 시간 차원이 없다(§3.6). 따라서 QP claim의 유효기간은 *법규에서 도출되는 값이 아니라* Decipher가 위험관리로 정하는 정책값이다.

한 줄로: **AI 5년은 법이 준 기간, QP 1년은 우리가 정한 기간**이다. A-11은 이 둘을 다루되, 코드·발급기준서·문서 어디서든 그 출처(법규 vs 정책)를 정확히 구분한다.

### 1.3 두 갈래의 신선도 논리 — 나란히 작동하는 두 축

AI freshness와 QP freshness가 헷갈리는 뿌리는, 둘이 **서로 다른 두 법에서 나오고 시간을 재는 근거가 다르다**는 데 있다. A-13 §1.3의 "증권 등록(거래마다) vs 펀드 등록(상시 status)" 구분이 그대로 A-11의 시간축에도 투영된다.

| | AI 갈래 (R1·R2) | QP 갈래 (R3) |
|--|-----------------|--------------|
| 근거 법 | 1933년법 Reg D 506(c) | 투자회사법 §3(c)(7) |
| 시간 기준점 | 검증일(`verifiedAt`) | 취득 시점(at the time of acquisition) |
| 유효기간 상한 | **5년 (법규 — (E))** | **1년 (Decipher 정책 — 비법규)** |
| 상한의 성격 | 조문이 준 재사용 기간 | 존재론적 위험 대비 보수적 완충 |
| 만료 시 효과 | 그 한 건의 검증 흠결 | 펀드 전체 면제 붕괴 위험 |

두 축은 "1차=AI, 2차=QP"처럼 단계로 갈리는 게 아니다. 증권법(AI)은 발행이든 재판매든 *거래마다* 걸리고, 투자회사법(QP)의 §3(c)(7) 면제는 펀드 *life-cycle 전반*에 유지돼야 하되 그 자격 판단의 기준시점은 *각 취득(acquisition) 시점*이다(§3.5) — "상시 감시"가 아니라 "각 취득마다 buyer QP gate"다. 그래서 A-11도 두 갈래를 각각 다른 cap으로, 그러나 같은 산술 엔진으로 검사한다.

### 1.4 Decipher 시스템에서 왜 중요한가 — Existential Risk

BlackRock BUIDL이 Decipher DEX에 listing된다고 하자. BUIDL은 §3(c)(7) 면제에 기대어 투자회사 등록을 피하고 있고, 그 면제는 "모든 outstanding securities가 취득 시점에 QP인 자에 의해 *배타적으로*(exclusively) 소유"될 것을 요구한다.

여기서 A-11의 존재 이유가 드러난다 — 다만 그 이유를 정확히 짚어야 한다. §3(c)(7)(A)의 기준은 "취득 시점(at the time of acquisition)에 QP였는가"이지 "지금도 QP인가"가 *아니다*(§3.5). 따라서 QP freshness의 목적은 *기존 보유자가 현재도 QP인지 계속 감시*하는 것이 **아니라**, *새로운 취득·이전 시점에 buyer가 QP였다고 합리적으로 믿을 수 있는 최신 claim을 확보*하는 것이다. 두 가지를 구분해야 한다 — ① 취득 시점에 적법하게 QP였던 자가 이후 자산이 줄어 QP 지위를 잃는 것(이것만으로는 그 보유가 §3(c)(7)을 곧바로 깨지 않는다), ② stale claim으로 *새로운 취득*을 허용하는 것(이것이 A-11이 막으려는 위험이다). A-11이 stale QP claim으로 새 취득을 통과시키면, 그 새 취득 시점의 "QP였다"는 reasonable belief의 근거가 낡아 면제 유지에 필요한 최신성이 무너진다. 결과의 비대칭이 핵심이다:

- §3(c)(7) 펀드(BUIDL 등)는 *단 한 명*의 비-QP 보유자가 생기면 *펀드 전체*의 투자회사 등록 면제가 깨진다 — 존재론적(existential) 결과다. 면제 상실의 실질 후과는(2026년 대법원 *FS Credit Opportunities Corp. v. Saba Capital Master Fund, Ltd.*, 608 U.S. \_\_\_ 이후 §47(b) 사적 소권이 아니라) 미등록 투자회사 운영·SEC enforcement·계약 집행가능성(unenforceability)·상업적 unwind·issuer/sponsor 계약 책임에서 나온다(상세는 A-13 §1.4).
- 반면 AI 신선도가 어긋나면 그 *한 건의 매도*에 대한 506(c) 검증 흠결이 문제될 뿐, 펀드 전체가 붕괴하진 않는다.

그래서 A-11은 결과가 치명적인 쪽(QP)에서 더 좁은 창(1년)으로, 덜 치명적인 쪽(AI)에서 법규가 허용한 최대치(5년)로 막는다. 법규가 허용한 최대치를 QP에 그대로 쓰지 않고 정책으로 더 짧게 잡는 것이 이 부품의 설계 철학이다.

> **쉽게 말하면.** 출입증을 생각하면 된다. 일반 구역 출입증(AI)은 5년마다 갱신해도 되지만, 단 한 사람이라도 무효 출입증으로 들어오면 *건물 전체가 폐쇄*되는 특수 구역(QP)은 1년마다 갱신을 강제한다. 증명서가 멀쩡해 보여도 *그 사이 자격이 사라졌을 위험*을, 사고가 치명적인 문에서 더 자주 닫아 막는 것이다.

### 1.5 한국법 비교 (참고)

"과거 한 시점에 확인한 투자자 자격을 언제까지 신뢰할 것인가"라는 문제의식 자체는 한국 자본시장법에도 있다 — 일반투자자를 전문투자자로 대우하기 위한 확인에는 유효기간 개념이 있고, 자격은 시간이 지나면 재확인이 필요하다는 구조가 그것이다. 다만 미국(AI 5년·법규 / QP 무만료·정책)과 한국의 제도는 근거 조문·기간·대상이 서로 달라 *1:1로 대응하지 않는다.* 본 문서는 직관을 돕는 수준에서만 언급하고, 정밀한 한국법 매핑은 별도 확인 대상으로 둔다(A-11 판정 자체는 전적으로 미국법 기준).

---

## §2. 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|------|----|-----------|
| 부품 ID | A-11 (versioned 예: `A-11-v1.0`) | 내부 식별자 |
| 부품명 | Claim Freshness (증명 유효기간) | — |
| 검사 대상 | "이 자격 증명이 거래 시점 기준으로 아직 유효기간 내에 있는가" | 한 줄 |
| 도메인 / 카테고리 | A — 신원·자격 (보조) | — |
| 검증 패턴 | 기계 판정형 (Pattern A) — 직접계산 | 서명된 timestamp의 결정론적 산술 비교 (§8) |
| Timing | pre-trade | 거래 전 1회 게이트 |
| Stateful | STATELESS | 누적 상태 없이 claim·tx 시점만으로 판정 |
| 주 활성화 Recipe | R1(Reg D 506(c) Issuance) · R2 중 *buyer-AI를 요구하는* resale(§4(a)(7)) — 핵심 attached(●) | AI 측. **Rule 144 resale은 buyer-AI freshness 비대상**(seller-side·C-01/A-06); R3 부착은 §9.6·§12 |
| Cumulative / cascade | A-03(AI)·A-13(QP) 자격 게이트의 보조(cascade) | 자격 판단은 그쪽, 유효기간만 A-11 |
| claim.basis 관계 | basis-agnostic — basis를 발급하지 않고, 이미 부여된 claim의 유효기간만 검사 | 표준 6종 전부에 동일 적용 (§3.9) |
| 분업 경계 | "반대 정보 부지"(no contrary knowledge)=A-12 · 증권 보유기간=C-01(별개 시계) | §9 |
| 성숙도 | 완료 (cap 정책값·취득시점 정의는 §12) | — |
| 파일·위치 | `A-11_claim-freshness.md` · 산출물/elements/ | — |
=======
> **왜 맥락부터 읽어야 하나.** 본 부품은 한 줄로 말하면 *"자격 증명서에 유통기한이 있다"*는 사실을 구현한다. 적격투자자·QP 자격은 *영구적이지 않다* — 사람의 재산은 변하고, 한 번 적격이었다고 평생 적격인 것이 아니다. 그래서 미국법은 자격을 *"취득 시점(at the time of acquisition)"* 기준으로 본다. 본 부품은 이 "취득 시점에 유효해야 한다"는 요건을, *증명서 발급일로부터 너무 오래 지나지 않았는가*로 구현한다.

### 1.1 핵심 개념 — "자격은 스냅샷이다"

쉽게 말하면, 자격은 *사진 한 장*과 같다. 어떤 사람이 작년에 $10M을 가진 적격 투자자였다고 해서, 올해 파산했어도 여전히 적격인 것은 아니다. 그래서 규제는 자격을 *특정 시점의 스냅샷*으로 본다.

특히 펀드 면제(§3(c)(7))는 이 점을 조문에 못 박았다 — 펀드 지분은 **"취득 시점(at the time of acquisition)에 QP인 자"**에게만 갈 수 있다. *작년에 QP였는가*가 아니라 *살 때 QP인가*다. 그래서 시스템은 매 거래마다 "이 증명서가 *지금도* 유효한가"를 확인해야 한다. 이것이 본 부품의 임무다.

### 1.2 어느 법·규칙에서 오는가

| 출처 | 무엇을 요구하나 | Decipher Recipe |
|---|---|---|
| **ICA §3(c)(7)(A)** | 펀드 지분은 *취득 시점에* QP인 자에게만 — *시점 기준 명시* | R3 |
| **Rule 506(c)(2)(ii)(E)** | 직전 검증을 *최대 5년*까지 신뢰 가능(투자자가 "여전히 적격" 서면 표명 시) | R1 |
| **Rule 2a51-1(d)** | investments 평가는 *"최근 실무 가능 시점(most recent practicable date)"* FMV/cost | R3(금액 신선도) |

이들의 공통 메시지는 — *"자격에는 시점이 있다. 너무 오래된 증명은 현재의 자격을 보장하지 않는다."* 본 부품은 이 "시점성"을 *유효기간 cap*으로 구현한다.

### 1.3 왜 이 규제가 존재하는가

자격 요건의 목적은 *"위험을 감당할 능력이 있는 자에게만"*이다(다른 부품 §1 참조). 그런데 능력은 변한다. 만약 *한 번의 자격 확인이 영원히 유효*하다면, 파산한 사람이나 재산이 급감한 사람이 옛 증명서로 계속 거래해 — 규제의 보호 목적이 무력화된다. 그래서 규제는 자격을 *시점 기준*으로 보고, 실무는 *주기적 갱신*을 요구한다. 506(c)의 "5년 신뢰" 규정은 그 균형점이다 — *매 거래마다 재검증*은 과하니 일정 기간 신뢰를 허용하되, *무한정*은 안 되니 상한을 둔다.

### 1.4 Decipher 시스템에서 왜 중요한가 — 그리고 핵심 난점

본 부품은 *기계 판정형(deterministic)*이라 로직 자체는 단순하다 — *"발급일 + 유효기간 < 취득시점이면 만료"*라는 날짜 산수다. 그런데 **블록체인에서 "취득 시점"이 정확히 언제인가**가 어렵다. 전통 금융에서는 *계약서에 서명한 순간*이 명확하지만, DEX 거래에는 시점 후보가 여럿이다 — 주문이 매칭된 순간? mempool에 들어간 순간? 블록에 포함된 순간? 완결성이 확보된 순간? **이 timestamp를 무엇으로 잡느냐가 경계 거래(만료 직전 거래)의 통과/거절을 가른다.** 그래서 본 부품은 *로직은 단순하지만 시점 정의가 핵심 쟁점*인 부품이다(§5.3).

### 1.5 한국법과의 비교 — 전문투자자 확인의 유효기간

한국 인력의 직관을 위해: 한국 자본시장법 실무에서도 **전문투자자 확인서·투자자 정보 확인**에 *유효기간*이 있다(통상 일정 주기로 갱신). "한 번 확인했다고 영원히 유효한 것이 아니라 주기적으로 갱신한다"는 발상이 같다. 다른 점은 미국 506(c)의 *5년 상한*처럼 명문 기간이 규칙에 박혀 있다는 점과, 본 부품은 그 시점 판정을 *블록체인 timestamp*로 해야 한다는 기술적 난점이 더해진다는 것이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Claim Freshness** | 자격 증명서의 유효기간 검사원 |
| 검사 대상 | 자격 claim이 *취득 시점에 만료되지 않았는가* | "이 증명서가 지금도 살아 있나" |
| Internal ID | A-11 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 날짜 산수 | verifiedAt + cap vs 취득 timestamp |
| Timing | **pre-trade** | 거래 직전 |
| Stateful 여부 | **STATELESS** | 거래 시점 스냅샷 비교 |
| 활성화 조건 | 자격 claim을 쓰는 모든 거래(R1·R2·R3 공유 유틸) | 자격 검사가 있으면 함께 |
| 주 활성화 Recipe | **R1·R2·R3 공유**(자격 증명의 신선도 검사) | 여러 Recipe의 공통 유틸 |
| 연계 부품 | **A-03**(적격)·**A-13**(QP) | 이들이 발급받은 claim의 신선도를 본 부품이 검사 |
| 성숙도 | 🟢 로직 확정 — 단 *취득 timestamp 기준*은 Open Issue | 날짜 비교는 확정, 시점 정의는 변호사 확인 |
| 파일·위치 | A-11_claim-freshness.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim·정책에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽은 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 claim/정책이 제공 |
|---|---|
| verifiedAt + cap vs 취득 timestamp *날짜 비교* | 자격 *검증 자체*(off-chain) |
| 5년 절대 상한 · 갱신표명 존재 확인 | "여전히 적격" 표명 *진위* |
| | 취득시점 timestamp *정의*(정책·ADR) |

→ 순수 날짜 산수. *검증이 실제로 됐는지*는 claim, *어느 시점을 취득으로 보나*는 정책.
>>>>>>> 8a8c56fb2fa198184523ac3ed682e3cb027fcfbf

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

<<<<<<< HEAD
**읽는 법.** 법적 근거는 세 겹이다 — Layer 1(조문, 의회 제정법), Layer 2(규칙, SEC 연방규칙), Layer 3(해석, SEC 발행문서·판례). §3.0.2 표 1의 *종류* 칸이 그대로 Layer에 대응한다(Statute=L1, SEC Rule=L2, SEC Release·Case=L3). 본 절은 freshness 논리가 작동하는 흐름 순서로 배열해 §3.1~§3.6의 번호를 유지하며(중요도순이 아니라 흐름순), 각 조문이 어느 Layer인지는 §3.0.2 표로 확인한다. A-11의 *직접* 근거는 Layer 2의 Rule 506(c)(2)(ii)(E)이고, 그 5년의 출처·취지는 Layer 3의 Release 33-10884가 설명한다. QP 측은 Layer 1(ICA §3(c)(7))이 *신선도를 규정하지 않음*을 확인하는 데 의의가 있다.

### 3.0 법조문 관계 플로우차트 (개발자용)

아래 그림은 위 세 Layer의 조문·규칙이 freshness 판정에서 어떻게 맞물리는지를 *논리 관계*로 보여준다(런타임 실행 순서는 §5.0의 그림이 따로 그린다). 핵심은 두 갈래가 서로 다른 근거에서 서로 다른 cap을 얻어 하나의 산술식으로 합류한다는 점이다.

![그림 3.0 — A-11 법조문 관계 흐름: 검증의무(506(c)(2)(i)·(ii))에서 갈래별 cap 근거(AI=(E) 5년 법규 / QP=§3(c)(7) 무만료→1년 정책), effectiveExpiry 합류, T_tx 비교까지 (개발자용)](A-11_fig30.png)

### 3.0.1 실제 BUIDL은 어떻게 적용되나

BUIDL은 발행 단계에서 Rule 506(c)(AI)와 ICA §3(c)(7)(QP)에 *둘 다* 기댄다(A-13 §3.0.1). 따라서 한 보유자의 claim에는 보통 두 자격이 함께 걸린다 — 그리고 A-11은 그 각각의 유효기간을 다르게 본다.

- **AI claim(506(c) 축).** BUIDL 초기 발행에서 Trusted Issuer가 투자자를 AI로 검증하고 `verifiedAt`을 찍는다. 이후 재판매 중 *buyer-AI를 요구하는 경로(§4(a)(7))*에서 A-11은 (E)의 5년 창으로 이 claim이 아직 유효한지 본다 — 5년이 지나면 `FAIL_CLAIM_STALE_AI` → 재검증. (같은 증권이 **Rule 144**로 재판매되면 buyer-AI는 요건이 아니므로 A-11-AI가 자동으로 붙지 않는다; 그 경로는 C-01 보유기간·A-06 affiliate 등 seller-side 검사가 중심이다.)
- **QP claim(§3(c)(7) 축).** BUIDL은 §3(c)(7) 펀드이므로 매 취득 시점에 보유자가 QP여야 한다. A-11은 QP claim에 대해 1년 정책 cap을 적용한다 — BUIDL의 면제 붕괴 위험(§1.4) 때문에 AI보다 좁게. 1년이 지나면 `FAIL_CLAIM_STALE_QP` → 재검증.
- **실무 함의.** 같은 지갑의 같은 거래라도 AI 시계(5년)와 QP 시계(1년)가 따로 흐른다. BUIDL처럼 두 축이 겹치는 자산에서는 *더 짧은 QP 시계가 사실상 먼저 만료*되므로, 프런트의 재검증 알림은 QP 기준으로 잡는 게 안전하다(§11.2).

### 3.0.2 조문 순서·중요성 한눈에 보기 (표 1·표 2)

아래 두 표가 §3의 지도다. **표 1**(Authority)은 각 근거의 종류(=Layer)·내용·A-11 관련성을, **표 2**(순서·중요성)는 §3.1~§3.6의 읽는 순서(흐름)와 중요성(A-11이 실제로 그걸로 판정하는가)을 보여준다.

**표 1 — Authority(근거 목록)**

| 종류 | Authority | 내용 | A-11 관련성 | Direct/Supporting | Official URL |
|------|-----------|------|-------------|-------------------|--------------|
| SEC Rule | Rule 506(c)(2)(i) · 17 C.F.R. §230.506(c)(2)(i) | 모든 purchaser AI 요건 | freshness가 "왜" 필요한지의 배경 | Background | ecfr.gov |
| SEC Rule | Rule 506(c)(2)(ii) · §230.506(c)(2)(ii) | reasonable steps to verify 틀 | 검증의무를 시간축에서 유지 | Supporting | ecfr.gov |
| SEC Rule | Rule 506(c)(2)(ii)(E) · §230.506(c)(2)(ii)(E) | prior-verification 5년 재사용 | AI claim 5년 상한의 직접 근거 | **Direct** | ecfr.gov |
| SEC Rule | Rule 506(c)(2)(ii)(C) · §230.506(c)(2)(ii)(C) | 제3자 확인 "within prior three months" | (C) 발급 시점 신선도 — A-03 영역, A-11 비대상 | Conditional | ecfr.gov |
| Statute | ICA §3(c)(7)(A) · 15 U.S.C. §80a-3(c)(7) | "취득 시점" QP 보유 면제(무만료) | QP 법규상 신선도 없음 → 정책 cap | Supporting | uscode.house.gov |
| Statute | ICA §2(a)(51)(A) · §80a-2(a)(51) | QP 정의(자산 기준, 시간 차원 없음) | QP claim 대상 — 자격 판단은 A-13 | Background | uscode.house.gov |
| Statute | JOBS Act §201(a) · Pub. L. 112-106 | 506(c) 일반청약 허용 + 검증 입법 지시 | 검증의무의 statutory hook(연혁) | Background | govinfo.gov |
| SEC Release | Release No. 33-10884(2020) · 86 FR 3496(본문 3598) | (E) 5년 재사용 신설(2021-03-15 시행) | **AI 5년 상한의 해석 근거** | **Direct** | sec.gov |
| SEC Release | Release No. 33-10824(2020) · 85 FR 64234 | accredited investor *정의* 확대 — (E)의 출처 아님 | AI 카테고리 배경(A-03) | Background | sec.gov |
| SEC Release | Release No. 33-9415(2013) | 506(c) 채택·원칙기반 verify 기준 | 검증 틀 배경 | Background | sec.gov |

> Direct/Supporting 태그: **Direct** = A-11 판정에 직접 들어가는 근거 / Supporting = 판정을 둘러싼 보강 / Conditional = 특정 조건에서만(여기선 A-03로 위임되는 (C)) / Background = 배경·연혁.

**표 2 — 조문 순서·중요성 한눈에 보기**

| 순서 | 조문 | 중요성 | A-11이 그걸로 하는 일 |
|------|------|--------|------------------------|
| §3.1 | Rule 506(c)(2)(i) — 모든 purchaser AI | 보조 | 안 함 — freshness가 필요한 배경(전원 AI) |
| §3.2 | Rule 506(c)(2)(ii) — 검증의무 | 중간 | 검증의무를 시간축에서 유지하는 근거 |
| §3.3 | Rule 506(c)(2)(ii)(E) — 5년 재사용 | **핵심** | AI claim의 5년 cap을 직접 설정 |
| §3.4 | Rule 506(c)(2)(ii)(C) — 3개월 | 구분 | A-11이 *하지 않는* 3개월(발급 시점) 검사 경계 |
| §3.5 | ICA §3(c)(7)(A) — 취득 시점 | **핵심** | QP에 법규상 신선도 부재 확정 → 정책 cap 정당화 |
| §3.6 | ICA §2(a)(51) — QP 정의 | 보조 | 안 함 — QP 정의에 시간 차원 없음 확인 |
| §3.7 | 판례·발행문서(Layer 3) | 보조 | 안 함 — (E) 5년의 해석 근거(Release) |
| §3.8 | Sub-요건 분해 매트릭스 | — | 요건을 원자적 검증 단위로 분해(§5.2와 1:1) |
| §3.9 | ERC-3643·claim.basis 총정리 | — | claim 매핑을 두 표로 |

**경계 — 이 부품이 다루지 않는 것.** 아래는 같은 거래에 작동하지만 A-11이 아니라 다른 부품·레이어가 책임진다 — 누락이 아니라 소관 분리다.

- **자격 실체(누가 AI/QP인가)** — Rule 501(a)/ICA §2(a)(51) 실체 판정. **A-03**(AI)·**A-13**(QP) 소관.
- **"반대 정보 부지"(no contrary knowledge, (E) 단서)** — 적신호(red flag) 목록 적용. **A-12** 소관.
- **증권 보유기간(Rule 144(d) 6개월/12개월)** — 대상=증권, 기산점=증권 취득. **C-01** 소관(A-11과 별개 시계).
- **claim 발급 적정성((C)의 3개월 등 `verificationBasis`)** — 발급 1회의 신선도. **A-03** 소관.
- **`T_tx`의 데이터 소스(어느 on-chain 사건이 "취득"인가)** — acquisition registry(CR-3). §5.4·§12의 공동 설계 대상.

### 3.1 Rule 506(c)(2)(i) — 모든 purchaser는 AI여야 한다 \[출처: ecfr.gov\]

**핵심 원문:** (i) Nature of purchasers. All purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors.

**한국어:** (i) 매수인의 성격. 본 조 (c)항에 따른 모든 offering에서 매도되는 증권의 모든 purchaser는 accredited investor이다.

**쉬운 설명:** 506(c) 공모에서는 사는 사람 전원이 적격투자자여야 한다. "전원·자격"이라는 이 요건이 있기 때문에, 그 자격이 거래 시점에 아직 유효한지(=freshness)를 따질 실익이 생긴다 — 자격이 필요 없다면 그 유효기간도 무의미할 테니.

**PASS/FAIL 반영:** ✕ 간접 — A-11은 자격 *실체*(실제로 AI인가)를 보지 않는다. 이 조문은 freshness가 왜 필요한지의 배경일 뿐이고, 실체 판정은 A-03 소관이다.

**ERC-3643 변환:** 이 요건의 충족 자체는 A-03가 `claim.basis`/`verificationBasis`로 기록한다. A-11은 그 claim의 유효기간만 검사하므로 basis 종류와 무관하게(basis-agnostic) 동작한다(§3.9).

### 3.2 Rule 506(c)(2)(ii) 도입부 — 검증의무(reasonable steps) \[출처: ecfr.gov\]

**핵심 원문:** (ii) Verification of accredited investor status. The issuer shall take reasonable steps to verify that purchasers of securities sold in any offering under paragraph (c) of this section are accredited investors. The issuer shall be deemed to take reasonable steps to verify if the issuer uses, at its option, one of the following non-exclusive and non-mandatory methods of verifying that a natural person who purchases securities in such offering is an accredited investor; provided, however, that the issuer does not have knowledge that such person is not an accredited investor:

**한국어:** (ii) 적격투자자 지위의 검증. issuer는 본 조 (c)항에 따른 offering에서 증권을 매수하는 purchaser가 accredited investor임을 검증할 reasonable steps를 취해야 한다. issuer가 그 선택에 따라 아래의 비배타적·비강제적 방법 중 하나를 사용하면 reasonable steps를 취한 것으로 본다 — 다만 issuer가 그 자가 accredited investor가 아니라는 점을 알지 못할 것.

**쉬운 설명:** issuer는 매수인이 적격투자자임을 "합리적으로 확인"할 의무가 있고, 그 방법으로 (A)~(E)가 예시된다. freshness는 이 확인 의무를 시간축에서 지키는 일이다 — (E)가 없으면 issuer는 매 거래마다 (A)~(D)로 새로 확인해야 하고, (E)의 5년 재사용이 곧 AI claim의 상한이 된다.

**PASS/FAIL 반영:** ✕ 간접 — 검증의무의 *틀*을 정하는 조문. A-11은 이 의무가 시간이 지나도 유지되는지를 (E)의 재사용 창으로 본다.

**ERC-3643 변환:** 어느 검증 method를 썼는지는 `claim.verificationBasis`(발급 책임 A-03)에 기록된다 — INCOME / NET_WORTH / THIRD_PARTY / PRIOR_VERIFICATION / HIGH_MINIMUM 등. A-11은 그 method가 (E) 재사용일 때 5년 창을 적용한다.

### 3.3 Rule 506(c)(2)(ii)(E) — prior-verification 5년 재사용 (A-11의 직접 근거) \[출처: ecfr.gov\]

**핵심 원문:** (E) In regard to any person that the issuer previously took reasonable steps to verify as an accredited investor in accordance with this paragraph (c)(2)(ii), so long as the issuer is not aware of information to the contrary, obtaining a written representation from such person at the time of sale that he or she qualifies as an accredited investor. A written representation under this method of verification will satisfy the issuer's obligation to verify the person's accredited investor status for a period of five years from the date the person was previously verified as an accredited investor.

**한국어:** (E) 이 (c)(2)(ii)항에 따라 issuer가 이전에 적격투자자로 검증하기 위한 reasonable steps를 취한 적이 있는 자에 대하여, issuer가 반대되는 정보를 알지 못하는 한, 매도 시점에 그 자가 적격투자자에 해당한다는 서면진술을 받는 것. 이 검증 방법에 따른 서면진술은, 그 자가 이전에 적격투자자로 검증된 날로부터 5년의 기간 동안, 그 자의 적격투자자 지위를 검증할 issuer의 의무를 충족한다.

**쉬운 설명:** 처음 한 번은 제대로 검증해야 한다(소득·자산·제3자 확인 등 (A)~(D)). 그 뒤에는 — 반대 정보가 없고, 거래 때 "나는 아직 자격이 있다"는 서면진술을 받으면 — 검증일로부터 5년 동안은 다시 처음부터 검증하지 않아도 된다. 즉 5년은 "재검증 없이 기존 검증을 믿어도 되는 기간"이고, 이것이 A-11의 AI claim 상한이다.

**PASS/FAIL 반영:** ○ 직접 — AI claim의 cap = 5년을 직접 설정한다. `T_tx − verifiedAt > 5년`이면 `FAIL_CLAIM_STALE_AI`(§5.2·§6.2). 근거는 조문의 "for a period of five years from the date the person was previously verified".

**ERC-3643 변환:** `claim.verifiedAt` + 5년 = AI claim의 freshness 상한. 조문이 기간을 "from the date the person was previously verified"라고 *검증일*에 못박으므로 A-11의 시계는 `claim.verifiedAt`에서 출발한다. "at the time of sale"의 서면진술 = `verificationBasis = PRIOR_VERIFICATION`(발급 책임 A-03). "not aware of information to the contrary" 단서 = A-12(red flag)가 담당. A-11은 시간 창만 본다.

**적용 범위 (중요 — 좁게 읽을 것):** (E)의 5년은 "AI claim은 5년짜리"라는 일반 유효기간이 *아니다*. 정확히는 — *prior verification method*를 쓰는 경우, 거래 시점 written representation + 반대정보 부지 조건 하에, 이전 검증을 최대 5년 재사용할 수 있다는 뜻이다. 따라서 **A-11의 AI 5년 PASS는 (E)의 *시간 요건*만 충족한다는 뜻이지, Rule 506(c) verification safe harbor 전체가 PASS라는 뜻이 아니다.** 해당 거래에서 실제로 (E) method를 쓰려면 A-03이 sale 시점 written representation을, A-12가 issuer의 contrary information 부재를 함께 확인해야 한다. 또한 (E)는 문언상 "the issuer previously took reasonable steps"로 *issuer-specific*이라, Decipher 공통 Trusted Issuer claim의 cross-issuer 재사용은 별도 구조가 필요하다(§8.3·§12). 마지막으로 (E)를 포함한 (c)(2)(ii)의 열거 방법은 chapeau가 "a natural person who purchases securities"로, Instruction 1이 "natural persons who are purchasers"로 *자연인* 검증에 한정한다 — 따라서 **entity(법인) AI claim**에 5년을 그대로 법규 safe harbor로 볼 수 있는지는 별도 확인 대상이고, 법인은 5년을 내부 freshness policy 또는 principles-based reasonable steps의 보조 기준으로 취급하며 issuer/on-behalf-of 검증기록을 별도 보존한다(§12).

### 3.4 Rule 506(c)(2)(ii)(C) — "within the prior three months" (A-11이 *하지 않는* 검사) \[출처: ecfr.gov\]

**핵심 원문 (발췌):** (C) Obtaining a written confirmation from one of the following persons or entities that such person or entity has taken reasonable steps to verify that the purchaser is an accredited investor within the prior three months and has determined that such purchaser is an accredited investor: (1) A registered broker-dealer; (2) An investment adviser registered with the Securities and Exchange Commission; (3) A licensed attorney who is in good standing under the laws of the jurisdictions in which he or she is admitted to practice law; or (4) A certified public accountant who is duly registered and in good standing under the laws of the place of his or her residence or principal office;

**한국어:** (C) 아래의 자 또는 기관 중 하나로부터, 그 자 또는 기관이 직전 3개월 내에 purchaser가 accredited investor임을 검증하기 위한 reasonable steps를 취했고 그 purchaser가 accredited investor라고 판단했다는 서면확인을 받는 것 — (1) 등록 broker-dealer; (2) SEC에 등록된 investment adviser; (3) 자신이 변호사 자격을 인정받은 관할의 법에 따라 good standing인 면허 변호사; 또는 (4) 자신의 거주지 또는 주 사무소 소재지의 법에 따라 적정하게 등록되고 good standing인 공인회계사.

**쉬운 설명:** 제3자(BD·RIA·변호사·CPA)가 확인서를 줄 때, 그 확인이 직전 3개월 내 검증에 근거해야 한다는 뜻이다. 이건 확인서 *발급의 적정성* 문제이지, 발급된 claim을 *나중에 재사용*하는 기간 문제가 아니다. (3개월 = 발급 1회의 신선도 / 5년 = 재사용의 신선도 — 층위가 다르다.)

**PASS/FAIL 반영:** ✕ 간접(경계) — A-11은 (C)의 3개월을 거래마다 강제하지 *않는다*. 3개월은 발급 시점 요건(A-03의 `verificationBasis` 검사 영역)이고, 재사용 상한은 (E)의 5년이다. 이 블록의 목적은 두 기간을 혼동하지 않게 경계 짓는 것이다.

**ERC-3643 변환:** (C) 충족은 claim 발급 시 A-03가 `verificationBasis = THIRD_PARTY`로 검사한다(A-11 비대상).

### 3.5 ICA §3(c)(7)(A) — "at the time of acquisition" (QP에 법규상 신선도 없음) \[출처: uscode.house.gov\]

**핵심 원문 (발췌):** (7)(A) Any issuer, the outstanding securities of which are owned exclusively by persons who, at the time of acquisition of such securities, are qualified purchasers, and which is not making and does not at that time propose to make a public offering of such securities.

**한국어:** (7)(A) 그 발행 증권 전부가, 해당 증권의 취득 시점에 qualified purchaser인 자들에 의해서만(exclusively) 보유되고, 그 시점에 그 증권의 public offering을 하고 있지도 하려고 하지도 않는 모든 issuer.

**쉬운 설명:** §3(c)(7) 펀드 면제는 증권을 "취득하는 그 시점에 QP인 사람"에게만 보유시키라고 요구한다. 중요한 건 조문에 "QP 증명이 며칠 뒤 만료된다" 같은 재검증·유효기간 문구가 *전혀 없다*는 점이다 — 시간 기준점은 오직 "취득 시점" 하나다. 그래서 QP claim의 유효기간 상한은 법이 준 값이 아니라 우리가 위험관리로 정하는 값이 된다.

**PASS/FAIL 반영:** ○ 직접(QP 갈래의 시간 기준점) + 부재 확인 — 비교식의 한쪽 끝(`T_tx`)이 법적 *취득 시점*이어야 함을 이 조문이 정한다. 동시에 만료 조항의 *부재*가 "QP cap은 법규가 아니라 정책"이라는 §5.3·§12의 근거가 된다.

**ERC-3643 변환:** `T_tx` = 취득 시점(어느 on-chain 사건인지는 §5.4 미결). QP claim의 cap = 1년은 *정책값*이므로 코드 주석·발급기준서에 "비법규"임을 명시한다. 자격 실체 위반 시 `forcedTransfer()`/`recovery` 대상이 되는 것은 A-13 영역이며, A-11은 시간 창만 본다.

### 3.6 ICA §2(a)(51)(A) — QP 정의 (시간 차원 없음) \[출처: uscode.house.gov\]

**핵심 원문 (발췌):** (51)(A) "Qualified purchaser" means— (i) any natural person (including any person who holds a joint, community property, or other similar shared ownership interest in an issuer that is excepted under section 80a-3(c)(7) of this title with that person's qualified purchaser spouse) who owns not less than $5,000,000 in investments, as defined by the Commission;

**한국어:** (51)(A) "Qualified purchaser"란 다음을 말한다 — (i) Commission이 정의하는 investments를 $5,000,000 이상 보유한 모든 자연인(§80a-3(c)(7)로 예외되는 issuer에 대해 그 자의 qualified purchaser인 배우자와 joint·community property·기타 유사 공유 지분을 보유한 자를 포함).

**쉬운 설명:** QP 정의는 자산 기준($5,000,000 이상 등)의 *충족 여부*만 정한다. (i) 자연인 외에 (ii) 가족회사, (iii) 신탁, (iv) $25,000,000 재량운용 보유자 등의 갈래가 있으나, *어느 갈래에도 "며칠 안에 만료된다" 같은 시간 차원이 없다*. 자격 갈래 판단 자체는 A-13 소관이다.

**PASS/FAIL 반영:** ✕ 간접 — 자격 *실체*(어느 QP 갈래인가)는 A-13이 판단한다. A-11은 그 판단 결과 claim의 유효기간만 본다. 시간 차원의 *부재*가 §3.5와 함께 정책 cap의 근거다.

**ERC-3643 변환:** QP 갈래는 `claim.basis`의 표준 6종(§3.9) 중 하나로 A-13이 기록한다. A-11은 그 값과 무관하게(basis-agnostic) `claimType = QP`이면 cap = 1년(정책)을 적용한다. ($25M (A)(iv) 경로는 조문이 "institution"이라 쓰지 않으므로 본 문서는 "기관"으로 라벨하지 않는다.)

### 3.7 판례·발행문서 (Layer 3)

조문·규칙이 모호한 부분은 SEC 발행문서·판례가 메운다. A-11에 가장 중요한 것은 (E) 5년 재사용의 *출처*를 담은 채택 release다.

**SEC Release No. 33-10884 (2020) — 사모 면제 체계 현대화 (adopting release)** \[출처: sec.gov\]

2020년 SEC가 사모·소액 면제 체계를 정비하며 채택한 final rule 묶음이다(2020-11-02 채택; 86 FR 3496, 본문 3598; 2021-03-15 시행; File No. S7-05-20). (accredited investor *정의* 확대는 별건인 Release No. 33-10824(85 FR 64234, 2020-10-09)로, (E)의 출처가 아니다 — 두 release를 혼동하지 말 것.) A-11의 관점에서 핵심은 **Rule 506(c)(2)(ii)(E)의 신설** — 반복 투자자에 대한 검증 부담을 줄이기 위해, 이미 검증한 자를 서면진술·반대정보 부지 전제로 *검증일부터 5년간* 재사용할 수 있게 한 것이다. 즉 A-11의 "5년"이 임의 숫자가 아니라 이 release가 명시한 기간임을 확인하는 1차 근거다. 직접 PASS/FAIL 규칙은 §3.3의 조문이 담지만, "왜 5년인가·기산점이 왜 검증일인가"의 취지 해석은 이 release에서 나온다.

**SEC Release No. 33-9415 (2013) — Rule 506(c) 채택.** JOBS Act §201(a)를 시행해 일반청약 허용 506(c)와 그 대가인 "reasonable steps to verify" 원칙기반 기준을 채택한 release다. A-11이 시간축에서 지키는 "검증의무" 자체의 배경이다.

**§3(c)(7) 측에는 해석상 신선도 자료가 없다.** QP 쪽은 조문(§3(c)(7)·§2(a)(51))에 유효기간이 없고, 이를 "며칠"로 좁히는 SEC 해석·판례도 없다. 따라서 QP cap(1년)은 *해석의 산물이 아니라 Decipher 정책*이며, 그 사실을 §12에 명시적 open issue로 둔다.

### 3.8 Sub-요건 분해 매트릭스 ("claim is fresh" — §5.2 분기와 1:1)

"증명이 신선하다"를 더 못 쪼개는 검증 단계로 분해하면, 각 단계가 §5.2 pseudocode 분기와 1:1로 대응한다. 각 행은 소리 내 읽어도 문장이 되도록 풀어 썼다.

| 단계 | 원자 조건(풀어 읽기) | 근거 | §5.2 분기(실패 코드) | Decipher 복잡도 |
|------|----------------------|------|----------------------|-----------------|
| S1 존재 | claim이 존재하고 `verifiedAt`을 보유한다 | 산술 전제 | `verifiedAt == 0` → `FAIL_NO_VERIFIED_AT` | 낮음 — 필드 유무 |
| S2 진위 | `claim.issuer`·서명이 유효하다(=`verifiedAt`을 신뢰할 근거) | Rule 2a51-1(h)·§8·§10 L2 | 전제(위조 시 A-03/A-13 소관) | 낮음 — 서명 검증 |
| S2.5 유형 | `claimType`이 AI 또는 QP로 식별된다 | cap 선택 전제 | `claimType ∉ {AI,QP}` → `FAIL_UNKNOWN_CLAIM_TYPE` (fail-closed) | 낮음 — enum 확인 |
| S3 신선도 | `T_tx − verifiedAt`가 cap(type) 이내다 | (E) 5년 / 정책 1년 | `T_tx > effectiveExpiry` → `FAIL_CLAIM_STALE_AI/_QP` | 중간 — timestamp 산술 |
| S4 갈래(만료 우선) | issuer-set `claim.expiry`가 더 짧으면 그것이 먼저 만료다 | 발급자 자율 | `effectiveExpiry == claim.expiry` → `FAIL_CLAIM_EXPIRED` | 낮음 — min 비교 |
| (밖) | "반대 정보 부지"(no contrary knowledge)를 확인한다 | (E) 단서 | — | → **A-12** |
| (밖) | 자격 *실체*(실제 AI/QP인가)를 판정한다 | Rule 501(a)/§2(a)(51) | — | → **A-03 / A-13** |

**해설:** A-11은 S1·S3·S4를 책임진다. S2는 전제로 신뢰하되 1차 검증은 자격 부품이 하고, "반대 정보 부지"와 자격 실체는 형제 부품에 위임한다. A-13/A-08과 달리 look-through·수동검토 단계가 없어 복잡도가 전반적으로 낮다 — 순수 시간 산술이기 때문이다. 이 네 단계가 §4(어떤 증거가 필요한가)와 §5(어떻게 판정하는가)의 토대다.

### 3.9 ERC-3643 변환·claim.basis 총정리

A-11의 법조문이 실제 ERC-3643/T-REX 토큰에서 어떻게 구현되는지를 두 표로 정리한다. 핵심 원칙 하나 — A-11은 자격 basis를 *발급하지 않는다*. 이미 A-03/A-13이 부여한 claim의 유효기간만 검사하므로, 아래 첫 표는 "시간 필드가 온체인 어디에 대응하는가", 둘째 표는 "A-11이 claim.basis 표준 6종 전부에 basis-agnostic으로 적용된다"를 보여준다.

**표 1 — 조항 → ERC-3643 변환**

| 조항 | ERC-3643 변환 | 간략 설명 |
|------|----------------|-----------|
| Rule 506(c)(2)(ii)(E) 5년 | AI claim 유효창 = `verifiedAt` + 5년 | 시계 시작점은 `claim.verifiedAt`(발급=A-03) |
| ICA §3(c)(7)(A) 취득 시점 | 비교 기준 시점 = `T_tx` | 어느 on-chain 사건인지 §5.4 미결 |
| §3(c)(7) 만료 조항 부재 | QP claim 유효창 = `verifiedAt` + 1년(정책) | 코드 주석에 "비법규" 명시 |
| issuer-set 만료 | `claim.expiry`(더 짧으면 우선) | `effectiveExpiry = min(verifiedAt+cap, claim.expiry)` |
| freshness 통과 | 거래 진행(누적 AND의 한 항) | A-11 자체는 `forcedTransfer()`·`recovery` 미호출 |
| freshness 실패 | `FAIL_CLAIM_STALE_*`/`_EXPIRED` → 재검증 전 차단 | 새 `verifiedAt`·서명 발급 시 시계 재시작 |

**표 2 — claim.basis(표준 6종) → A-11 적용 (basis-agnostic)**

| claim.basis (표준 6종) | 발급 부품 | claimType | A-11 cap | A-11이 보는 필드 |
|------------------------|-----------|-----------|----------|------------------|
| `QP_NATURAL` | A-13 | QP | 1년 (정책) | `verifiedAt`, `claim.expiry` |
| `QP_FAMILY_COMPANY` | A-13 (+A-09 look-through) | QP | 1년 (정책) | 동일 |
| `QP_TRUST` | A-13 (+A-09) | QP | 1년 (정책) | 동일 |
| `QP_INSTITUTIONAL` | A-13 | QP | 1년 (정책) | 동일 |
| `QP_QIB` | A-13 (Rule 2a51-1(g)(1) deemed-QP) | QP | 1년 (정책) | 동일 |
| `KNOWLEDGEABLE_EMPLOYEE_EXCLUSION` | A-13 (Rule 3c-5 제외 갈래) | QP | 1년 (정책) | 동일 |
| (AI 측) `verificationBasis` = INCOME/NET_WORTH/THIRD_PARTY/PRIOR_VERIFICATION/HIGH_MINIMUM | A-03 | AI | 5년 (법규 (E)) | `verifiedAt`, `claim.expiry` |

핵심: A-11은 basis 값을 *읽어 cap을 고르는 게 아니라*, `claimType`(AI/QP)만으로 cap을 고른다. basis는 A-03/A-13이 정하고, A-11은 그 결과가 어느 basis든 동일 산술을 돌린다.
=======
### 3.1 Layer 1 — Statutory base

> **§ 3(c)(7)(A) — "at the time of acquisition"** [🔗 [Cornell LII](https://www.law.cornell.edu/uscode/text/15/80a-3)]
>
> **Original**(요지): "... the outstanding securities of which are owned exclusively by persons who, **at the time of acquisition** of such securities, are qualified purchasers ..."
>
> **한글 해석**: 펀드 지분은 *취득 시점에* QP인 자에게 배타적으로 소유되어야 한다. **자격 판정의 기준 시점이 "취득 시점"으로 못 박혀 있다** — 이것이 본 부품의 가장 직접적 근거다.

해설: "at the time of acquisition"은 본 부품에 두 가지를 명령한다 — ① 자격은 *그 시점*에 유효해야 하고, ② 따라서 시스템은 *그 시점이 언제인지*를 정해야 한다. ①은 유효기간 검사로, ②는 timestamp 기준 선택으로 구현된다(§5).

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.506(c)(2)(ii)(E) — 직전 검증의 5년 신뢰** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/230.506)]
>
> **한글 해석**(요지): 발행자가 어떤 매수인을 *적격투자자로 이미 검증*한 적이 있으면, 그 매수인이 *"여전히 적격투자자"라는 서면 표명*을 제공하는 한, **그 검증을 최대 5년까지 신뢰**할 수 있다. (이 기간이 지나면 재검증 필요.)
>
> 해설: 이 규칙이 본 부품의 *유효기간 상한*의 근거다. 즉 *법이 인정하는 최장 신뢰기간 = 5년*. Decipher는 보수적으로 더 짧은 cap(예: 1년)을 기본값으로 쓰되, 5년을 절대 상한으로 둔다.

> **17 CFR § 270.2a51-1(d) — investments 평가 시점** [🔗 [Cornell LII](https://www.law.cornell.edu/cfr/text/17/270.2a51-1)]
>
> **한글 해석**(요지): QP 판정의 investments 금액은 *"최근 실무 가능 시점(most recent practicable date)"*의 FMV 또는 cost로 평가한다. → 금액 자체도 *오래된 평가*면 신뢰성이 떨어지므로, claim 신선도가 금액 신뢰성과도 연결된다.

### 3.3 Layer 3 — Interpretive guidance

> **SEC C&DIs — 506(c) 검증의 시점·갱신**(해석 지침)
>
> **성격**: SEC는 506(c) 검증이 *거래 시점에 합리적이어야* 하며, 사정 변경이 의심되면 재검증이 요구된다는 취지를 밝혀 왔다. 본 부품의 cap·갱신 정책은 이 지침에 정렬한다. (구체 인용은 §12 변호사 트랙.)

### 3.4 Sub-요건 분해

| 판정 요소 | 충족 조건 | 근거 |
|---|---|---|
| 신선도 cap | verifiedAt + cap ≥ 취득 timestamp | §3(c)(7)(A)·506(c)(2)(ii)(E) |
| 절대 상한 | cap ≤ 5년 | 506(c)(2)(ii)(E) |
| 취득 시점 정의 | 어느 block timestamp가 "acquisition"인가 | (Open Issue·변호사) |
| 금액 신선도(보조) | investments 평가가 최근인가 | 2a51-1(d) |
>>>>>>> 8a8c56fb2fa198184523ac3ed682e3cb027fcfbf

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

<<<<<<< HEAD
### 4.1 본 부품이 판정하려면 어떤 증거가 필요한가

A-11이 "이 증명은 아직 유효하다"고 말하려면 네 질문의 답이 증거로 모여 있어야 한다.

1. **claim이 존재하는가?** (없으면 판정 대상 자체가 없음 — A-03/A-13의 `NO_CLAIM` 소관)
2. **그 claim에 `verifiedAt`이 있는가?** (없으면 산술 불가)
3. **어느 유형인가?** (AI vs QP — cap 선택)
4. **취득 시점(`T_tx`)은 언제인가?** (비교의 기준 시점 — 어느 on-chain 사건인지 §5.4)

A-11은 *새로 검증하지 않는다* — 위 증거를 읽어 산술 비교만 한다.

### 4.2 Data field — DEX가 실제로 읽는 항목

| 필드 | 유형 | 의미 | 출처 |
|------|------|------|------|
| `claim.verifiedAt` | timestamp | 검증 시점(freshness 기산점) | Trusted Issuer 서명 claim |
| `claim.expiry` | timestamp (opt) | 발급자 지정 만료 — 있고 더 짧으면 우선 | claim |
| `claim.claimType` / `topic` | enum | AI vs QP (cap 선택) | claim topic (ACCREDITED_INVESTOR / QP) |
| `claim.verificationBasis` | enum | INCOME / NET_WORTH / THIRD_PARTY / PRIOR_VERIFICATION / HIGH_MINIMUM 등 | claim (A-03 발급정책) |
| `claim.issuer` / `claim.signature` | address / bytes | 신뢰기관·서명 — `verifiedAt`을 신뢰하는 근거 | claim |
| `T_tx` (이 이전의 sale/acquisition 시점) | timestamp | freshness 비교 기준 시점 — AI=sale, QP=acquisition; DEX는 동일 settlement block(§5.4) | tx context |

### 4.3 수집 경로 (5단계 흐름)

1. **매수인이 Trusted Issuer에서 자격 검증을 받는다** — 소득·자산·제3자 확인 또는 (E) 서면진술.
2. **Trusted Issuer가 `verifiedAt`을 찍고 claim에 서명한다** — 이때의 timestamp가 freshness 기산점이 된다(임의 미래/과거 날짜 금지, §10 L2).
3. **claim이 매수인 ONCHAINID에 anchor된다** — 서명된 off-chain 검증 결과의 on-chain 표지.
4. **거래 시점에 DEX가 claim과 `T_tx`를 읽는다** — 추가 조회·외부 oracle 없이 온체인 데이터만.
5. **A-11이 산술 판정한다** — `T_tx` vs `verifiedAt + cap`(및 `claim.expiry`).

### 4.4 갈래별 증거 — 필수 확인 항목 전체

아래는 "예시"가 아니라 A-11이 판정 전에 *반드시* 확인하는 항목의 전체 표다. 공통 행은 모든 거래에서, ①②③은 갈래별로 요구된다.

| 구분 | 필수 확인 항목 | 근거 | 없으면 |
|------|----------------|------|--------|
| **공통** | claim 존재 (ONCHAINID anchor) | §4.2 | A-03/A-13 `NO_CLAIM` (A-11 밖) |
| **공통** | `claim.issuer`·서명 유효 (신뢰기관) | §3.8 S2 · §10 L2 | 서명오류 = 자격 부품 소관 |
| **공통** | `claim.verifiedAt` 필드 존재 | §3.8 S1 | `FAIL_NO_VERIFIED_AT` |
| **공통** | `claimType` 식별 가능 (AI/QP) | §4.1·§5.2 | `FAIL_UNKNOWN_CLAIM_TYPE` (cap 선택 불가 → fail-closed, AI 기본 처리 금지) |
| **AI 갈래 ①** | `verifiedAt` timestamp 값 | §3.3 (E) | `FAIL_NO_VERIFIED_AT` |
| **AI 갈래 ②** | `verificationBasis` (어느 (A)~(E) method) | §3.2 | (E) 재사용 가정 — A-03 발급정책 확인 |
| **AI 갈래 ③** | (E) 경로면 거래 시점 서면진술 존재 (발급=A-03) | §3.3 (E) | 발급 흠결 = A-03 |
| **QP 갈래 ①** | `verifiedAt` timestamp 값 | §3.5·§3.6 | `FAIL_NO_VERIFIED_AT` |
| **QP 갈래 ②** | `claim.expiry` (있으면 더 짧은 쪽 우선) | §5.2 | 없으면 정책 cap 1년 적용 |
| **QP 갈래 ③** | 자격 실체 (어느 QP 갈래) — A-13 결과 참조 | §3.6·§3.9 | 실체 FAIL = A-13 (A-11 밖) |

---

## §5. ③ 판정 로직 — 어떻게 PASS/FAIL이 결정되는가

### 5.0 판정 흐름 플로우차트

아래 그림은 §5.2의 `check_A11` pseudocode를 *런타임 실행 순서*로 옮긴 것이다(§3.0의 그림이 법조문 *논리 관계*를 그린 것과 짝을 이룬다).

![그림 5.0 — A-11 판정 로직 흐름: verifiedAt 존재 → cap(type) → 더 짧은 expiry → T_tx 비교 → PASS/FAIL (개발자용)](A-11_flow.png)

### 5.1 전체 흐름 (사람 말로)

1. **claim 존재 전제.** A-11은 자격 claim이 있다는 전제 하의 보조 검사다. claim 자체 부재는 A-03/A-13의 `NO_CLAIM` 소관 — A-11 사유가 아니다.
2. **`verifiedAt` 있는가?** 없으면 산술 불가 → `FAIL_NO_VERIFIED_AT`.
3. **cap 선택.** `claimType`으로: AI → 5년, QP → 1년(정책). `claimType`이 AI/QP가 아니면 `FAIL_UNKNOWN_CLAIM_TYPE` — AI로 기본 처리하지 않는다(fail-closed).
4. **더 짧은 만료 우선.** `claim.expiry`가 있고 `verifiedAt + cap`보다 이르면 → `effectiveExpiry = claim.expiry`, 아니면 `verifiedAt + cap`.
5. **비교.** `T_tx ≤ effectiveExpiry`이면 PASS, *초과*하면 FAIL(stale 또는 expired).

### 5.2 Pseudocode + 단계별 해설

**검사 순서 한눈에 보기 — 왜 이 순서인가**

| 순서 | 검사 | 무엇을 확인 | 실패 코드 | 비용 | 왜 이 위치인가 |
|------|------|-------------|-----------|------|----------------|
| 1 존재 | `verifiedAt` 있나 | 산술 기산점 유무 | `FAIL_NO_VERIFIED_AT` | 매우 낮음 | 기산점 없으면 판정 대상 자체가 없음 |
| 2 진위 | 서명·issuer 신뢰 | `verifiedAt`을 믿을 근거 | (위임) A-03/A-13 | 낮음(암호 검증) | 위조면 `verifiedAt`을 신뢰 불가 → 모든 하류의 전제 |
| 3 유형·신선도 | claimType으로 cap 선택 후 `T_tx − verifiedAt` ≤ cap | 유형 식별(미식별 시 fail-closed) → 유효창 내인가 | `FAIL_UNKNOWN_CLAIM_TYPE` · `FAIL_CLAIM_STALE_AI/_QP` | 낮음(enum+timestamp) | 싸고 탈락 잘 되는 게이트 |
| 4 갈래(만료 우선) | `claim.expiry` 더 짧은가 | 발급자 만료 우선 | `FAIL_CLAIM_EXPIRED` | 매우 낮음(min) | 마지막 min 비교 |

**fig50 ↔ pseudocode 대조 (같은 순서를 다르게 그릴 뿐)**

| 검사 | §5.2 pseudocode | §5.0 흐름도(fig50) |
|------|-----------------|---------------------|
| 1 존재 | `if verifiedAt == 0` | 입력 직후 첫 diamond |
| 2 진위 | 전제(자격 부품) | "claim 보유"에 묶어 표현 |
| 3 신선도 | cap·effectiveExpiry 계산 | cap 분기 + 비교 노드 |
| 4 만료 우선 | `min` 분기 | 더 짧은 expiry diamond |

```
function check_A11(claim, T_tx):
    # 1단계: 존재 — 기산점 유무
    if claim.verifiedAt == 0:
        return (false, FAIL_NO_VERIFIED_AT)

    # 2단계: 진위 — 서명·issuer는 전제(자격 부품이 1차 검증, §8·§10 L2)

    # 3·4단계: claimType 확정 → 신선도 + 갈래(만료 우선)
    # CAP_AI = 5년 (법규: Rule 506(c)(2)(ii)(E) — "time of sale")
    # CAP_QP = 1년 (정책: 비법규 — §3(c)(7)은 "time of acquisition"·무만료)
    if claim.claimType not in {AI, QP}:        # fail-closed: AI로 기본 처리 금지
        return (false, FAIL_UNKNOWN_CLAIM_TYPE)
    cap = (claim.claimType == QP) ? CAP_QP : CAP_AI
    regulatoryExpiry = claim.verifiedAt + cap

    effectiveExpiry = (claim.expiry != 0 && claim.expiry < regulatoryExpiry)
                      ? claim.expiry
                      : regulatoryExpiry

    if T_tx > effectiveExpiry:                 # strict 초과(>)만 stale
        if effectiveExpiry == claim.expiry:
            return (false, FAIL_CLAIM_EXPIRED)
        return (false, (claim.claimType == QP) ? FAIL_CLAIM_STALE_QP
                                               : FAIL_CLAIM_STALE_AI)
    return (true, OK)
```

- **1단계 해설:** claim에 `verifiedAt`이 없으면 유효기간을 계산할 기준점이 없다 → `FAIL_NO_VERIFIED_AT`. 대개 claim 스키마 결함이므로 발급자에게 누락을 보고한다.
- **2단계 해설:** A-11은 `verifiedAt`을 *신뢰*해 산술한다. 그 신뢰의 근거는 `claim.issuer` 서명이다. 서명 위조·미신뢰 발급기관 문제는 자격 부품(A-03/A-13)이 1차로 걸러내므로 A-11은 이를 전제로 둔다(§8·§10 L2).
- **3단계 해설:** 여기서 (E)의 "from the date ... verified"와 §3(c)(7)의 "at the time of acquisition"을 함께 본다. `claimType`으로 cap을 고르고(AI 5년/QP 1년), `T_tx`가 유효창을 *초과*하면 stale이다. QP는 존재론적 위험 때문에 더 좁은 1년을 쓴다. **단 AI 5년 PASS는 (E)의 시간 요건 충족일 뿐**이며, 그 거래가 (E) safe harbor를 실제로 쓰려면 written representation(A-03)·contrary-information 부재(A-12)가 함께 충족돼야 하고, cross-issuer 재사용이면 issuer agency 구조가 필요하다(§3.3·§8.3).
- **4단계 해설:** 발급자가 claim에 더 짧은 `claim.expiry`를 지정했으면 그것이 규제·정책 상한보다 먼저 만료다 → `FAIL_CLAIM_EXPIRED`. 즉 "규제/정책 상한"과 "발급자 자율 만료" 중 더 이른 쪽이 이긴다.

### 5.3 Threshold 매트릭스 (포함성·strict 초과 명시 — 경계 사양의 핵심)

| 항목 | 값 | 근거 |
|------|----|------|
| AI claim cap | 5년 (inclusive — 정확히 5년 시점은 유효) | Rule 506(c)(2)(ii)(E) "for a period of five years" |
| QP claim cap | 1년 (inclusive) | Decipher 정책(§1.4)·비법규 — §3(c)(7) 취득시점·무만료 |
| issuer-set 만료 | `claim.expiry`가 더 짧으면 그것 우선 | 발급자 자율 |
| stale 판정 | `(T_tx − verifiedAt) > cap` 일 때만 (strict 초과) | 아래 reasoning |

**strict 초과(>) 해석 reasoning:** "for a period of five years from the date"는 검증일 기준 5년 *기간 내*가 유효라는 뜻이다. 따라서 정확히 5년 시점은 기간에 *포함*(PASS)이고, 그를 *초과*할 때만 stale(FAIL)이다 — 한국어로 `>`. 조문의 "not less than"류가 `≥`(이상, inclusive)으로 읽히는 것과 같은 결로, 여기서는 유효창의 끝을 inclusive로 잡고 그 *초과*만 FAIL 처리한다. §7 경계 테스트에서 명시 확인한다.

**단 granularity는 구현 사양 + open issue.** 법문은 "for a period of five years from the **date**"로 *날짜* 기준이고 eCFR도 초 단위 granularity를 정하지 않는다. 따라서 "정확히 5년 시점 PASS / 5년+1초 FAIL"은 *초 단위 timestamp를 쓰는 구현에서의 경계 사양*으로 이해한다(정확히 cap 종료 시점까지 PASS, 초과 시 FAIL) — strict 초과(`>`) 원칙 자체는 유지하되, "date" 기준 법문과 블록 timestamp 초 단위 구현 사이의 granularity는 §12 Open Issue(#5)로 둔다(법규가 초 단위를 확정했다는 뜻이 아니다).

> **결정적 권고.** `CAP_AI = 5년`은 법규 상한을 그대로 채택한다. `CAP_QP`는 1년을 채택한다 — §3(c)(7)의 존재론적 위험(비-QP 1인 = 펀드 면제 붕괴) 대비 보수적 완충이다. 다만 이 1년은 *법규가 아니라 정책*임을 코드 주석·발급기준서·§12에 반드시 명시한다. 정책값을 법규처럼 보이게 두는 것은 본 프로젝트의 인용 정확성 원칙에 어긋난다.

### 5.4 거래 시점(`T_tx`) — 블록체인의 어느 시점을 "매도/취득"으로 보나 (미결 · 최우선)

(E)는 5년을 "from the date ... verified"로 재고, 비교 시점은 "at the time of sale"의 거래다. §3(c)(7)도 "at the time of acquisition". 즉 비교식의 한쪽 끝(`T_tx`)은 법적 매도·취득 시점이어야 한다.

**변수명 주의 — AI는 sale, QP는 acquisition.** (E)의 AI 재사용 창은 문언상 "at the time of *sale*" 기준이고, §3(c)(7)의 QP 요건은 "at the time of *acquisition*" 기준이다. 두 시점은 법 개념상 이름이 다르지만, DEX의 이전(transfer)은 매도와 취득이 같은 정산에서 일어나므로 *동일한 settlement block timestamp*로 구현할 수 있다. 그래서 본 문서·pseudocode는 이 하나의 값을 `T_tx`(이 이전의 법적 sale/acquisition 시점)로 부른다 — `T_acq`가 아니라 `T_tx`로 둔 것은 AI 쪽을 "취득"으로만 부르는 어색함을 피하기 위함이다. 전통 금융에서는 계약 체결 시점이 명확하지만, 블록체인 DEX에는 후보가 여럿이다 — 주문서에 사인한 순간과 등기가 찍힌 순간 중 무엇을 "취득"으로 볼 것인가의 문제다.

| 시점 후보 | "취득 시점" 부합도 | 운영 리스크 |
|-----------|--------------------|-------------|
| Trade matching(오프체인 주문 체결) | 불일치 — 정산 미확정 | 높음(정산 실패 가능) |
| mempool 진입(proposed) | 불일치 — 포함 보장 없음 | 높음(re-org·교체) |
| 블록 포함·확정(confirmed) | **최적** — 법적 execution에 가장 부합 | 낮음(단일 블록 확정) |
| 완결성(finalized) | 보수적 부합 — 필요 이상 늦음 | 가장 낮음 |

**Decipher 권고:** swap 체결(정산) 블록의 `block.timestamp`를 `T_tx`로 사용한다. 경계 거래(예: 만료 30초 전 매칭 → 30초 후 confirmation)에서는 이 기준상 `FAIL_CLAIM_STALE_*`가 날 수 있으므로 프런트에서 조기 안내·재발급을 유도한다(§11.2). 정확히 어느 timestamp가 법적 "acquisition time"인지는 acquisition registry(CR-3) 설계·변호사 확인 대상이며, **A-08 OD-1·A-13 §12 OD-1과 동일한 공동 설계 쟁점**이다(§12).

### 5.5 비결정성 → 결정성 — 본 부품 구현의 본질 (A-13과의 차이)

A-13의 QP 판정은 사람의 판단(가족관계·목적·평가)을 내포해 "비결정적 법 판단을 결정적 증명서 확인으로 캡슐화"하는 구조다. **A-11은 그 반대편에 서 있다 — A-11 자체는 처음부터 순수 결정론이다.** timestamp 두 개(현재 블록 시간, `verifiedAt`)의 차이를 cap과 비교하는 산술뿐이라, 같은 입력이면 언제나 같은 결과다. look-through도, 경계의 법적 판단도, 수동검토도 없다.

그러나 결정적인 통찰이 하나 있다 — **A-11의 결정성은 그 입력(`verifiedAt`)의 신뢰를 빌려온다.** `verifiedAt`이 "실제 검증 완료일"을 정확히 담고 있다는 보장은 A-11의 산술이 아니라 Trusted Issuer의 서명(그리고 그 서명을 뒷받침하는 Rule 2a51-1(h)의 reasonable belief)에서 온다. 즉 A-11은 *결정적 게이트*이되, 그 게이트가 재는 눈금(`verifiedAt`)의 진실성은 *비결정적 판단*(누가 언제 검증했는지에 대한 발급자의 실사)에 뿌리를 둔다.

> **쉽게 말하면(비유):** A-11은 서명된 문서에 찍힌 *유효기간 도장*을 확인하는 일이다. "오늘이 도장 날짜 + 5년을 넘었는가"는 기계가 명확히 답할 수 있는 결정적 계산이다 — 하지만 그 도장 날짜가 진짜인지(위조·오기입이 아닌지)는 도장을 찍은 사람(Trusted Issuer)을 믿기 때문에 성립한다. 기계는 날짜 계산만, 날짜의 진실성은 사람이 보증한다.

---

## §6. ④ 거절·예외 처리 — 검사에 실패하면 어떻게 되는가

### 6.1 전체 흐름 (사람 말로)

A-11의 실패는 전부 "증명이 오래돼 더는 못 믿는다"는 한 종류의 문제로 수렴한다. 그래서 처리도 단순하다 — 거래를 차단하고, 매수인에게 *재검증*을 안내한다. A-13처럼 "대기(suspend) 후 사람이 판단"하는 경계 케이스가 없다(§6.3). 아래 표는 코드가 아니라 시나리오 풀이로 읽으면 된다.

### 6.2 Failure codes 5종

| Code | 언제 뜨나 | 무엇이 문제인가 | 매수인이 할 일 | Decipher 측 조치 |
|------|-----------|-----------------|----------------|-------------------|
| `FAIL_NO_VERIFIED_AT` | `verifiedAt` 없음 | 증명에 검증일이 없어 유효기간 산정 불가 | Trusted Issuer에서 재검증 | claim 스키마 결함 — 발급자에 누락 보고 |
| `FAIL_CLAIM_STALE_AI` | AI claim, `T_tx > verifiedAt+5y` | AI 증명이 5년 경과로 만료 | Trusted Issuer에 갱신 요청 | frontend에 갱신 안내 |
| `FAIL_CLAIM_STALE_QP` | QP claim, `T_tx > verifiedAt+1y` | QP 증명이 1년(정책) 경과로 만료 | Trusted Issuer에 갱신 요청 | 갱신 안내(비법규 cap 명시 로그) |
| `FAIL_CLAIM_EXPIRED` | issuer-set `claim.expiry` 경과 | 발급자 지정 기한 경과 | Trusted Issuer에 갱신 요청 | 발급자 정책 만료 로그 |
| `FAIL_UNKNOWN_CLAIM_TYPE` | `claimType`이 AI/QP 아님(빈 값·오류) | 유형 미식별로 cap 선택 불가 | Trusted Issuer에 claim 유형 정정 요청 | 스키마/발급 오류 — fail-closed(AI 기본 처리 금지) 로그 |

**해설:** 시간 만료 계열(`STALE_AI`/`STALE_QP`/`EXPIRED`/`NO_VERIFIED_AT`)의 cure는 하나뿐이다 — *재검증*(Trusted Issuer가 다시 검증 → 새 `verifiedAt`·서명). 자격 실체가 살아 있으면 재검증 후 같은 거래가 통과된다. `FAIL_UNKNOWN_CLAIM_TYPE`은 시간 문제가 아니라 유형 미식별이며, cure는 Trusted Issuer의 claim 유형 정정이다 — A-11은 `claimType`이 AI/QP가 아니면 *AI(더 관대한 5년)로 기본 처리하지 않고* fail-closed로 막는다(관대한 쪽으로의 오처리 방지). 자격 실체 자체의 문제(비-AI·비-QP)는 A-03/A-13의 실패 코드이지 A-11이 아니다.

### 6.3 왜 A-11에는 Manual Review Path가 없는가

A-13/A-08에는 자동 판정이 불가능한 경계 케이스를 사람이 처리하는 `REVIEW_*_UNCERTAIN` 경로가 있다(look-through 회색지대 등). **A-11에는 이 경로가 없다** — 시간 산술에는 "애매해서 사람이 판단할" 여지가 없기 때문이다. `T_tx`와 `verifiedAt`이 주어지면 결과는 유일하게 결정된다. 따라서:

- **manual override 금지.** 운영자가 만료를 임의로 연장할 수 없다 — 연장하면 그 자체가 법적 검증 흠결이 된다.
- **유일한 cure는 재검증.** 사람의 개입은 "판정을 뒤집는 것"이 아니라 "새 검증으로 새 `verifiedAt`을 만드는 것"뿐이다(§11.3).
- **경계 거래의 처리는 UX로.** 만료 임박 거래의 실패는 프런트의 조기 재검증 안내로 예방한다(§11.2), 사후 수동검토로 구제하지 않는다.

(유일하게 사람이 개입할 지점은 `T_tx`의 *정의* 자체 — 어느 on-chain 사건을 취득으로 볼지 — 이며, 이는 판정이 아니라 설계 결정이라 §5.4·§12의 open issue다.)

### 6.4 Error message — 매수인 노출용 vs 내부 기록용 분리

매수인에게는 일반적이고 행동 가능한 메시지만, 구체적 실패 사유는 내부 audit log에만 남긴다.

| Code | 매수인 노출(frontend) | 내부 기록(audit) |
|------|------------------------|-------------------|
| `FAIL_NO_VERIFIED_AT` | "자격 증명에 검증일이 없어 확인할 수 없습니다. 재검증이 필요합니다." | claim 스키마 결함 + 매수인 주소 |
| `FAIL_CLAIM_STALE_AI` | "적격투자자 증명의 유효기간(5년)이 지났습니다. 재검증 후 다시 시도하세요." | 506(c)(2)(ii)(E) 5년 경과 + `verifiedAt` + 경과일 |
| `FAIL_CLAIM_STALE_QP` | "적격매수자 증명의 유효기간(1년)이 지났습니다. 재검증이 필요합니다." | 정책 cap(비법규) 경과 + `verifiedAt` + 경과일 |
| `FAIL_CLAIM_EXPIRED` | "자격 증명이 발급자 지정 기한을 지나 만료됐습니다." | `claim.expiry` < 상한, 발급자 만료 |
| `FAIL_UNKNOWN_CLAIM_TYPE` | "자격 증명의 유형을 확인할 수 없습니다. 발급기관에 문의해 주세요." | claimType 미식별(빈 값/오류) + fail-closed 처리 |

**이유:** 매수인에겐 "무엇을 하면 되는지"(재검증)만 노출하고, 내부 로그엔 *어느 cap·어느 근거*(법규 5년 / 정책 1년 / 발급자 만료)로 막혔는지를 남겨 운영 진단·감사에 쓴다.

---

## §7. ⑤ 테스트 케이스 — 스펙이 제대로 작동하는지 검증

### 7.1 Test 1 — Pass-AI (명백한 통과)

AI claim, `verifiedAt` = 2년 전, `T_tx` = 지금. cap = 5년(법규), `T_tx − verifiedAt = 2년 ≤ 5년`. → **PASS.** 반복 투자자가 (E) 서면진술로 검증을 재사용하는 전형적 정상 경로다.

### 7.2 Test 2 — Pass-QP (명백한 통과)

QP claim, `verifiedAt` = 10개월 전. cap = 1년(정책), `10개월 ≤ 1년`. → **PASS.** BUIDL 같은 §3(c)(7) 자산에서 QP는 더 좁은 1년 창으로 관리되지만 아직 유효.

### 7.3 Test 3 — Fail-AI-stale (5년 경과)

AI claim, `verifiedAt` = 6년 전. `6년 > 5년`. → `FAIL_CLAIM_STALE_AI`. (E)의 5년 재사용 창이 끝났으므로 재검증(새 `verifiedAt`) 전까지 차단.

### 7.4 Test 4 — Fail-QP-stale (정책 1년 경과)

QP claim, `verifiedAt` = 14개월 전. `14개월 > 1년`. → `FAIL_CLAIM_STALE_QP`. 주의 — 이건 *정책* cap 경과이지 법규 위반이 아니다. 내부 로그에 "비법규 cap"임을 남긴다.

### 7.5 Test 5 — Boundary (정확히 상한 / 1초 초과)

AI claim, `T_tx − verifiedAt`가 정확히 5년(초 단위 동일)이면 → **PASS**(기간 *포함*). 5년 + 1초면 → `FAIL_CLAIM_STALE_AI`. QP도 동일 논리(정확히 1년 PASS / 초과 FAIL). 이는 *초 단위 timestamp 구현에서의 경계 사양*이며, strict 초과(`>`)만 stale이라는 §5.3 원칙을 명시 확인한다 — 다만 "date" 기준 법문 대비 초 단위 granularity 자체는 §12 Open Issue(#5)다(법규가 초 단위를 확정한 것은 아님).

### 7.6 Test 6 — Issuer-expiry 우선

AI claim, `claim.expiry` = 발급 + 1년(규제 상한 5년보다 짧음), `T_tx` = 13개월. `effectiveExpiry = min(verifiedAt+5y, claim.expiry) = claim.expiry`. `13개월 > 1년`. → `FAIL_CLAIM_EXPIRED`(더 짧은 발급자 만료가 이김). "규제 상한이 5년이니 통과"로 처리하면 오작동.

### 7.7 Test 7 — No-verifiedAt (스키마 결함)

`verifiedAt` = 0. → `FAIL_NO_VERIFIED_AT`. 판정 대상 시점이 없으므로 산술 이전에 탈락. 발급자에 스키마 누락 보고.

### 7.8 Test 8 — Cascade 독립성 (A-11은 시간만)

**8a (독립):** AI claim은 fresh인데 A-03 실체 판정이 FAIL(미지원 카테고리). → A-11 자체는 **PASS**(시간은 유효), 거래는 A-03에서 FAIL. A-11이 자격 실체를 대신 판단하지 않음을 확인.

**8b (역):** claim이 stale인데 A-03 실체는 PASS. → A-11 **FAIL** → 거래 차단. 누적 AND이므로 시간·실체 둘 다 통과해야 진행. A-11의 시간 게이트가 실체 통과를 뒤집지는 않지만, 자기 항에서 막는다.

---

## §8. (α) 증명서 확인형 패턴 — A-11은 "직접계산"형

### 8.1 검증 3패턴 중 A-11의 자리

Decipher의 검증 방식은 세 패턴이다 — (A) 직접계산(코드가 스스로 산술·비교), (B) 증명서 확인(판단은 밖, 코드는 서명된 claim 확인), (C) oracle(외부 데이터 주입). A-11은 **(A) 직접계산**형이다.

### 8.2 왜 A-11이 직접계산인가

A-03/A-13이 "증명서형(B)"인 것은 자격 실체 판단(소득·자산·look-through)이 온체인 산술로 재현 불가하기 때문이다. A-11이 다루는 것은 그런 판단이 아니라 *timestamp 두 개의 차이*다 — 현재 블록 시간과 `verifiedAt`. 이건 온체인에서 결정론적으로 완결되므로 외부 판단(증명서)이나 외부 데이터(oracle)가 필요 없다. A-11은 A-03/A-13이 만든 증명서의 *시간 필드 하나*를 계산하는 보조 모듈이다.

### 8.3 법적 토대 — 왜 `verifiedAt` 신뢰가 정당한가

A-11이 산술하는 `verifiedAt`은 Trusted Issuer가 서명한 값이다. 그 신뢰의 법적 토대는 두 겹이다 — ① Rule 2a51-1(h)/506(c)의 reasonable belief·reasonable steps 구조가 "발급자가 검증하고 그 결과를 신뢰"하는 모델을 뒷받침하고, ② (E)의 "written representation at the time of sale"이 재사용 기간(5년)의 근거를 준다. 즉 A-11의 결정론적 계산은 이 신뢰 모델 위에서만 의미를 갖는다(§5.5·§10).

**두 가지 좁힘 (제출 방어 포인트).** (가) *AI 5년의 성격.* A-11의 AI 5년 PASS는 (E)의 *시간 요건*만 충족한다 — (E) method 전체 성립은 sale 시점 written representation(A-03)과 contrary-information 부재(A-12)를 함께 요구하므로, A-11 단독 PASS를 "506(c) 검증 safe harbor 전체 PASS"로 읽으면 안 된다. (나) *issuer-specificity / cross-issuer 재사용.* (E)는 "**the issuer** previously took reasonable steps"로 원칙상 *그 issuer*가 이전에 검증한 자에 관한 조항이다. Decipher는 Trusted Issuer가 여러 issuer를 대신해 claim을 발급하므로, 그 claim을 다른 issuer가 (E) safe harbor로 *재사용*하려면 — ① Trusted Issuer가 해당 issuer의 agent/on-behalf-of로 검증했거나, ② 새 issuer가 그 verification package를 자기 reasonable steps로 채택했다는 *운영 기록*이 있어야 한다. 이 구조가 없으면 A-11의 5년 cap은 *법규상 safe harbor가 아니라 Decipher 내부 freshness policy*로만 기능한다(§12 OD).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — 혼자 움직이지 않는다

### 9.1 책임 경계 (A-11이 하는 것 / 넘기는 것)

**A-11이 직접 책임지는 것:** claim에 `verifiedAt`이 있는지 / `(T_tx − verifiedAt)`가 cap(type) 이내인지 / issuer-set `claim.expiry`가 더 짧으면 그것으로 막는지.

**A-11 밖의 문제:** 자격 실체(A-03·A-13) · "반대 정보 부지"(A-12) · 증권 보유기간(C-01, 별개 시계) · claim 발급 적정성((C) 3개월, A-03) · `T_tx` 데이터 소스(acquisition registry, CR-3).

### 9.2 Element Cascade Map

```
자격 게이트 (A-03 AI / A-13 QP)
   └── (보조 cascade) ──▶ A-11 (claim 유효기간)
                              │  전제: A-04(신원 중복)·B-01(manifest 정합)
                              └─ 위임: A-12(반대정보) · C-01(증권 보유기간, 별개)
```

A-11은 자격 게이트의 하위 보조로 호출된다. A-08 §9.2의 cascade 목록도 A-11을 "증명 만료"로 명시한다 — A-11은 여러 자격·라우팅 경로에서 공통으로 얹히는 시간 검사다.

### 9.3 Recipe Orchestration (거래 맥락 활성)

- **R1(발행) · R2 중 §4(a)(7) resale:** A-03(AI)에 붙어 AI claim 5년 창을 검사(현 매트릭스 ●). **Rule 144 resale**은 buyer-AI가 요건이 아니라 A-11-AI가 자동 부착되지 않는다 — 그 경로는 C-01(보유기간)·A-06(affiliate) 등 seller-side 검사가 담당한다.
- **R3(펀드):** A-13(QP)에 붙어 QP claim 1년 창을 검사(부착은 §9.6 audit·§12 대상).
- 모든 경로에서 A-11은 누적 AND의 한 항으로 동작하며, 다른 부품 뒤·앞 어디에 두어도 결과가 같다(STATELESS).

### 9.4 Conflict Resolution — A-11은 상충하지 않는다

A-11은 다른 부품의 PASS를 뒤집거나 막지 않는다 — 시간 게이트는 누적 AND의 독립 항이다. 자격 실체가 PASS여도 시간이 stale이면 A-11이 자기 항에서 FAIL을 낼 뿐, 이는 충돌이 아니라 정상적 AND 결합이다(§7.8b).

### 9.5 Manifest 무결성 (B-01)

A-11이 쓰는 cap(AI 5년·QP 1년)과 자산의 Manifest(펀드 면제 통로·claim 스키마)는 정합해야 한다. B-01이 Manifest hash·facts 정합을 검사하며, cap 정책값(특히 QP 1년)이 발급기준서·Manifest와 어긋나면 시간 검사의 전제가 흔들린다.

### 9.6 \[해설\] A-11의 R3(QP-freshness) 부착과 매트릭스 갭, 그리고 공유 T_tx

부착 매트릭스(08 자료 §2.5.4)는 A-11을 R1·R2에만(●) 표기한다. 그러나 A-11의 freshness 로직은 QP claim(R3 / A-13)에도 적용되며(본 문서 §1.3·§3.5·§5.3의 1년 cap), A-13 claim 스키마도 "claim이 아직 유효한지"를 전제한다. 따라서 (가) A-11이 R3의 QP-freshness까지 *공유 라이브러리*로 담당하도록 매트릭스를 보강하거나, (나) A-13이 QP-freshness를 *내장*하도록 명시하거나 — 둘 중 하나로 정리해야 한다. **권고: (가)** — Element는 Recipe-agnostic 공유 라이브러리이고, 같은 시간 검사를 두 곳에 복제하면 cap 갱신이 분기될 위험이 있다.

또 하나 — `T_tx`(어느 on-chain 사건이 법적 취득·매도인가)는 A-11만의 문제가 아니다. **A-08 OD-1·A-13 §12 OD-1이 동일 쟁점을 공유**하며(entity 임계값 freshness·activeRecipes 기준 시점도 같은 시점 정의에 걸린다), acquisition registry(CR-3)로 *공동 설계*해야 한다(§12).

---

## §10. (γ) 3-Layer Solution — 증거 신뢰를 세 겹으로

### 10.1 왜 3겹 구조인가

A-11의 결정론적 산술은 `verifiedAt`이라는 눈금의 신뢰 위에서만 성립한다(§5.5). 그 신뢰를 세 겹으로 나눈다 — 진술·발급·점검.

### 10.2 각 층의 법적 토대

- **Layer 1 · Self-Attest(자기진술).** (E)의 "written representation at the time of sale" — 투자자가 지금도 자격을 갖췄다고 서면진술. A-11은 이 진술의 진위를 판단하지 않는다; 진술의 존재는 `verificationBasis`로 A-03이 기록하고, A-11은 시간 창만 본다.
- **Layer 2 · Trusted Issuer(신뢰 발급).** `verifiedAt`은 Trusted Issuer가 검증 시점에 찍고 서명한다. A-11의 산술은 이 서명된 timestamp를 신뢰하는 데서 성립한다(Rule 2a51-1(h) reasonable belief). 발급기준서는 `verifiedAt`을 *실제 검증 완료일*로 정확히 기록하도록 규정해야 한다(임의 미래/과거 날짜 금지). 나아가 AI 쪽에서 (E) safe harbor를 쓰려면 발급기준서가 Trusted Issuer의 issuer agency/on-behalf-of 관계 또는 새 issuer의 verification 채택을 문서화해야 한다 — 그렇지 않으면 5년은 내부 정책일 뿐 법규상 재사용이 아니다(§8.3·§12).
- **Layer 3 · Spot-Check(주기 점검).** cap 만료 전 재검증 트리거(§11). 만료 임박 claim을 사전 갱신해 freshness를 유지한다.

### 10.3 층 간 escalation 규칙

만료가 임박하면(예: cap의 90% 경과) 프런트가 재검증을 안내(L3→L1·L2로 순환)한다. 이미 만료됐으면 거래 차단 후 재검증만이 회복 경로다 — 층을 건너뛰는 override는 없다(§6.3).

### 10.4 Liability(책임) 분배 — `verifiedAt` 오기입으로 만료를 오판한 경우

Trusted Issuer가 `verifiedAt`을 실제보다 늦은 날짜로 잘못 찍어(또는 위조), 실제로는 만료된 증명이 A-11 산술상 유효로 나온 경우 — 책임은 A-11(코드)이 아니라 그 눈금을 보증한 Trusted Issuer(발급)와, 진술이 허위였다면 self-attest(투자자)에 있다. A-11의 책임 범위는 "주어진 `verifiedAt`으로 정확히 산술했는가"에 한정된다. 요약: 발급 정확성 = Trusted Issuer / 시간 산술 = A-11(코드) / 재검증 유도 = 운영층 / 진술 진위·반대정보 = 투자자·A-12.

---

## §11. (δ) Frontend·Off-chain Operator Layer — 4-Layer로는 안 끝난다

### 11.1 왜 별도 레이어가 필요한가

A-11의 온체인 판정은 "만료됐는가"만 답한다. "만료 전에 미리 갱신하게 하는" 일은 온체인 밖 프런트·운영의 몫이다 — 그래야 경계 거래의 실패를 사전 예방한다.

### 11.2 Frontend — 만료 임박 알림

claim이 cap의 일정 시점(예: 만료 30일 전)에 들면 프런트가 보유자에게 재검증을 안내한다. QP(1년)는 AI(5년)보다 갱신 주기가 짧으므로 알림 빈도를 다르게 잡고, BUIDL처럼 두 축이 겹치는 자산은 *더 짧은 QP 시계* 기준으로 안내한다(§3.0.1).

### 11.3 Off-chain Operator — 재검증 플로우

보유자 → Trusted Issuer 재검증(소득·자산·전문가 확인 또는 (E) 서면진술) → 새 `verifiedAt`·서명 → claim 갱신. 갱신 즉시 freshness 시계가 재시작한다.

### 11.4 (수동검토 큐 없음 — 자동 갱신으로 대체)

A-13/A-08과 달리 A-11에는 수동검토 큐가 없다(§6.3). 사람의 개입은 "판정 재량"이 아니라 "재검증으로 새 눈금 생성"뿐이므로, 운영은 만료 임박 claim의 *자동 갱신 유도*에 집중한다 — 큐에 쌓아 사람이 판단하는 구조가 아니다.

### 11.5 아키텍처 함의

A-11은 온체인에서 가볍고(산술만) 결정적이지만, 그 가벼움은 오프체인의 정확한 발급·성실한 갱신 운영을 전제한다. 즉 "가벼운 온체인 게이트 + 무거운 오프체인 신뢰·운영"이라는 Decipher 아키텍처의 전형을 A-11이 가장 순수하게 보여준다.

---

## §12. Open Issues — 변호사·설계 follow-up

| # | 질문(무엇을 결정해야 하나) | 왜 필요한가 | Priority | 해소 경로(권고) |
|---|---------------------------|-------------|----------|-----------------|
| 1 | QP cap = 1년은 정책(비법규) — §3(c)(7)은 취득시점·무만료. 1년이 적정 완충인가 | 정책값을 법규처럼 두면 안 됨; 발급기준서·코드 주석에 "정책" 명시 필요 | 높음 | Decipher 정책 결정 + 변호사 confirm |
| 2 | `T_tx` = 어느 on-chain 사건(§5.4) — mint / 풀 예치 / swap / 정산 중 법적 "매도·취득" | 비교식의 한쪽 끝; **A-08 OD-1·A-13 §12 OD-1과 동일 쟁점**, acquisition registry(CR-3) 직결 | ⚠ 즉시 | 변호사 + 개발 공동(CR-3) |
| 3 | A-11의 R3(QP-freshness) 부착(§9.6) — 매트릭스는 R1·R2만 표기 | 같은 시간검사 중복/cap 분기 위험; 공유 라이브러리 원칙과 충돌 | 높음 | 매트릭스 보강 (Recipe 명세 시) |
| 3b | **AI (E) 5년의 cross-issuer 재사용** — 공통 Trusted Issuer claim을 여러 issuer가 (E) safe harbor로 재사용할 수 있는가(§8.3) | (E)는 "the issuer previously"로 issuer-specific; agency/채택 구조 없으면 5년은 법규 safe harbor가 아니라 내부 정책 | 높음 | Trusted Issuer를 각 issuer의 agent로 지정 또는 verification 채택 운영기록 설계 + 변호사 confirm |
| 3c | **entity AI claim에 (E) 5년 적용** — 법인 AI claim에 (E)의 5년 재사용을 그대로 법규 safe harbor로 볼 수 있는가(§3.3) | (c)(2)(ii) 열거 방법·Instruction 1은 "natural persons who are purchasers" 검증용((E) 포함); 법인 AI는 원칙기반 reasonable steps 소관이라 5년을 법규 safe harbor로 단정하면 공격 여지 | 높음 | entity AI claim은 5년을 내부 freshness policy / principles-based reasonable steps 보조 기준으로 취급 + issuer/on-behalf-of 검증기록 보존 + 변호사 confirm |
| 4 | 고액최소투자 경로 freshness — 이 경로는 **SEC Staff Position**(2025 CorpFin no-action letter + C&DI)이지 binding rule이 아니며, Rule 506(c)(2)(ii)(E)의 5년 safe harbor 기간을 *자동으로 갖지 않는다*(재사용 기간 미규정) | (E) 5년이 지배하는지, 더 짧은 정책인지(A-03 미결 #2·#4와 조율) | 중간 | Decipher + A-03(staff position임을 명시) |
| 5 | cap 경계 granularity(§5.3·§7.5) — 5년/1년 경계를 초/일 중 무엇으로 | 조문은 "for a period of five years from the **date**"만, 초 단위 미명시 → §5.3·§7.5의 "정확히 5년 PASS/초과 FAIL"은 초 단위 구현 사양 | 중간 | Decipher 구현 결정 |
=======
### 4.1 어떤 데이터가 필요한가

본 부품은 *새 증거를 모으지 않는다.* 이미 발급된 claim의 *날짜 필드*와 *거래 시점*만 비교한다.

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `claim.verifiedAt` | timestamp | Trusted Issuer claim | 자격이 *언제* 검증됐나 |
| `claim.expiresAt`(선택) | timestamp | Trusted Issuer claim | 발급기관이 명시한 만료일(있으면 우선) |
| `freshnessCap` | duration | Decipher 정책 | 신선도 상한(기본 1년·절대 5년) |
| `acquisitionTimestamp` | timestamp | blockchain | "취득 시점"으로 채택된 block timestamp |
| `renewalRepresentation`(선택) | claim | 매수인 | "여전히 적격"이라는 서면 표명(5년 신뢰용) |

### 4.2 데이터의 단순성과 그 함정

본 부품의 입력은 *날짜 두 개*가 사실상 전부다 — 발급일(verifiedAt)과 취득 시점(acquisitionTimestamp). 함정은 *두 번째*다. `acquisitionTimestamp`를 *무엇으로 잡느냐*가 시스템 설계 결정이고(§5.3), 이 결정이 경계 거래의 운명을 가른다.

---

## §5. ③ 판정 로직

### 5.1 전체 흐름 (사람 말로)

① 발급기관이 만료일을 명시했으면 그걸 본다 → ② 없으면 *발급일 + 신선도 cap*을 만료일로 계산 → ③ 취득 시점이 만료일을 넘었으면 만료(FAIL) → ④ 5년 신뢰 구간이면 갱신 표명이 있는지 확인 → ⑤ 유효면 PASS.

### 5.2 Pseudocode + 해설

```
function check_A_11(claim, acquisition_ts, policy):

    # 1단계: 발급기관 명시 만료일 우선
    expiry = claim.expiresAt
    if expiry == null:
        expiry = claim.verifiedAt + policy.freshnessCap   # 기본 1년

    # 2단계: 절대 상한(법정 5년) 적용
    hard_cap = claim.verifiedAt + 5_years
    if expiry > hard_cap:
        expiry = hard_cap

    # 3단계: 5년 신뢰 구간이면 갱신 표명 요구
    if (acquisition_ts > claim.verifiedAt + policy.freshnessCap)
       and (acquisition_ts <= hard_cap):
        if not claim.renewalRepresentation:
            return FAIL_CLAIM_EXPIRED      # 기본 cap 초과 + 갱신표명 없음
    # 4단계: 만료 판정
    if acquisition_ts > expiry:
        return FAIL_CLAIM_EXPIRED
    return PASS
```

- **1단계 해설**: 발급기관이 만료일(expiresAt)을 직접 적었으면 그것을 존중한다(발급기관이 사안별로 더 짧게 줄 수 있음).
- **2단계 해설**: 어떤 경우에도 발급일+5년을 넘는 신뢰는 법이 허용하지 않으므로 상한을 씌운다(506(c)(2)(ii)(E)).
- **3단계 해설**: 기본 cap(1년)은 지났지만 5년 안이면, *매수인의 "여전히 적격" 서면 표명*이 있어야 신뢰를 연장한다 — 이것이 506(c) 5년 규정의 조건이다.
- **4단계 해설**: 최종적으로 취득 시점이 만료일을 넘으면 `FAIL_CLAIM_EXPIRED`. 단순 날짜 비교다.

### 5.3 핵심 쟁점 — 블록체인의 어느 시점이 "취득"인가

본 부품의 *유일한 진짜 난점*이다(A-13 §5.4와 공유). "at the time of acquisition"의 timestamp 후보:

| 시점 후보 | "취득 시점" 부합도 | 운영 리스크 |
|---|---|---|
| Trade matching(오프체인 주문 체결) | 불일치 — 정산 미확정 | 높음 |
| Tx proposed(mempool 진입) | 불일치 — 포함 보장 없음 | 높음(re-org·교체) |
| **Tx confirmed(블록 포함)** | **최적 — 법적 "execution"에 가장 근접** | 낮음 |
| Tx finalized(완결성) | 보수적 — 필요 이상 늦음 | 가장 낮음 |

**Decipher 권고: block confirmation timestamp(`block.timestamp`).** 거래가 블록에 포함되어 확정된 시점을 "취득"으로 본다. 경계 거래(예: 만료 30초 전 매칭 → 30초 후 confirmation)에서는 이 기준상 만료(FAIL)가 날 수 있으므로, frontend에서 *매칭 직전 조기 안내·갱신 유도*를 권고한다(§11). *법적으로 정확히 어느 timestamp가 "acquisition time"인지*는 변호사 확인 대상이다(§12).

### 5.4 경계 처리 — inclusive/exclusive

만료일 *정확히 그 시점*의 거래는 통과인가 거절인가? 본 부품은 **만료일 *포함까지 유효*(acquisition_ts ≤ expiry면 통과)**를 기본값으로 한다 — 즉 만료일 당일까지 유효, 그 *다음*부터 만료. (이 경계는 §7 T3에서 명시 검증하며, 법적 확정은 §12.)

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 매수인이 할 일 | Decipher 측 조치 |
|---|---|---|---|---|
| `FAIL_CLAIM_EXPIRED` | 취득 시점 > 만료일 | 증명서가 만료됨 | Trusted Issuer에 *갱신* 요청 | frontend 갱신 안내 + 재거래 유도 |
| (5년 구간) `FAIL_CLAIM_EXPIRED` | 기본 cap 초과 + 갱신 표명 없음 | "여전히 적격" 표명 미제출 | 갱신 표명 제출 또는 재검증 | 표명 제출 UI 안내 |

해설: 본 부품의 실패는 *부적격이 아니라 만료*다. 자격이 없어진 게 아니라 *증명이 오래된 것*일 수 있으므로, 처리는 "거절 후 갱신 유도"다 — 매수인이 갱신만 하면 곧바로 다시 거래할 수 있다. (이 점에서 자격 미달 거절과 UX가 다르다.)

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 결과 |
|---|---|---|---|
| T1 (Pass) | 발급 3개월 전, cap 1년 | verifiedAt=-3m | **PASS** |
| T2 (Fail) | 발급 14개월 전, 갱신표명 없음 | -14m, no renewal | **FAIL_CLAIM_EXPIRED** |
| T3 (Boundary) | 만료일 *정확히 그 시점* 거래 | acquisition_ts == expiry | **PASS**(포함까지 유효, §5.4) |
| T4 (5년 신뢰) | 발급 2년 전 + "여전히 적격" 표명 | -2y, renewal=true | **PASS**(5년 구간 + 표명) |
| T5 (5년 초과) | 발급 6년 전 | -6y | **FAIL_CLAIM_EXPIRED**(절대 상한) |
| T6 (경계 timestamp) | 만료 30초 전 매칭 → 30초 후 confirm | confirm 기준 만료 | **FAIL_CLAIM_EXPIRED**(confirmation 기준·§5.3) |

T6은 §5.3의 *취득 timestamp 기준*이 경계 거래에 미치는 영향을 검증한다.

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A(기계 판정형)**다. 판정이 *순수한 날짜 산수*(발급일 + cap vs 취득 시점)라 결정론적으로 계산된다. 사람의 판단이 개입할 여지가 없다 — 어느 날짜가 더 큰가의 비교일 뿐이다.

**단, 입력 timestamp는 신뢰 의존**: 로직은 결정론적이지만, `verifiedAt`은 Trusted Issuer가 부호화한 값(증명서형 부품들의 산물)이고, `acquisition_ts`는 *시스템이 어느 block timestamp를 채택하느냐*의 설계 결정이다. 즉 *계산은 기계가, 입력 시점의 정의는 정책이* 정한다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination — 공유 유틸리티

본 부품은 *여러 부품이 호출하는 공유 유틸리티*다.

```
A-03(적격)·A-13(QP) ── 자격 claim 발급 ──▶ A-11: 그 claim의 신선도 검사
A-09(look-through) ── 구성원 claim ──▶ A-11: 각 구성원 claim 신선도도 검사
모든 자격 Recipe(R1·R2·R3) ── 자격 검사 시 ──▶ A-11 호출
```

- **A-03/A-13과의 관계**: 이들이 "자격 있음"을 판정하면, 본 부품이 "그 판정 증명이 *지금도 유효한가*"를 덧붙인다. 즉 *자격 판정의 시간 차원*을 담당한다.
- **A-09(look-through)와의 관계**: look-through에서 각 구성원의 claim도 신선도 검사가 필요하므로, A-09가 구성원별로 본 부품을 호출한다.
- **A-13 §5.2 일관성**: A-13 pseudocode의 3단계(freshness_cap 비교)가 *본 부품의 로직*이다. 두 문서의 cap 값·timestamp 기준은 일치해야 한다.
- **Recipe**: 자격을 쓰는 모든 Recipe(R1·R2·R3)의 공통 유틸. 자격 부품이 켜지면 본 부품도 함께 켜진다.

---

## §10. (γ) 3-Layer Solution — 책임 분배

| Layer | 누가 | 무엇을 | 한계 |
|---|---|---|---|
| **1. Self-Attestation** | 매수인 | "여전히 적격" 갱신 표명(5년 구간) | 허위 표명 가능 → 재검증 권고 |
| **2. Trusted Issuer** | 신뢰기관 | verifiedAt·expiresAt 부호화, 갱신 재발급 | 발급 시점 정확성 의존 |
| **3. System Policy** | Decipher | freshnessCap·취득 timestamp 기준 결정 | 정책 보수성이 경계 안전 좌우 |

**escalation**: 만료는 자동 거절 + 갱신 유도(사람 개입 불요, 결정론적). 단 *취득 timestamp 기준*은 정책 결정이라 ADR로 고정.

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇이 일어나나 |
|---|---|---|
| 만료 임박 알림 | Frontend | 거래 전 "증명서가 N일 후 만료" 사전 경고 |
| 경계 거래 조기 안내 | Frontend | 매칭 직전 만료 임박 시 *갱신 먼저* 유도(§5.3 경계 FAIL 예방) |
| 갱신 표명 입력 | Frontend | 5년 구간 거래 시 "여전히 적격" 표명 UI |
| 갱신 재발급 | Off-chain | Trusted Issuer가 재검증 후 새 claim 발급 |

**UX 핵심**: 만료는 *거절이지만 회복 가능*하다. 사용자가 "왜 막혔는지(만료)"와 "어떻게 푸는지(갱신)"를 즉시 알게 해, 적법 사용자의 이탈을 막는다. 특히 경계 거래는 *매칭 전 조기 안내*로 FAIL을 예방한다.

---

## §12. Open Issues — 변호사·ADR 확인 대상

1. **취득 시점(time-of-acquisition) timestamp 정의** 🔴 — 블록체인의 어느 시점(matching·proposed·confirmed·finalized)이 법적 "acquisition"인가. A-13 §12와 공유 쟁점. **ADR로 고정 필요**(권고: block confirmation). 경계 거래 운명을 좌우.
2. **기본 freshnessCap 값** 🟡 — 1년 권고 vs 더 짧게/길게. 자산·자격 종류별 차등 여부. (절대 상한 5년은 506(c) 명문.)
3. **만료 경계 inclusive/exclusive** 🟡 — 만료일 당일 거래의 통과 여부(§5.4). 변호사 확인.
4. **QP의 5년 신뢰 적용 여부** 🟡 — 506(c)(2)(ii)(E)의 5년 신뢰는 *accredited 검증* 규정이다. QP(§3(c)(7)) 맥락에 동일 5년 신뢰가 적용되는지, 아니면 더 보수적이어야 하는지 변호사 확인.
5. **금액 신선도 vs 신원 신선도 분리** 🟡 — investments 평가(2a51-1(d)) 신선도와 자격 검증 신선도를 별도 cap으로 둘지.
>>>>>>> 8a8c56fb2fa198184523ac3ed682e3cb027fcfbf

---

## §13. 파일명 규칙 (Naming Convention)

<<<<<<< HEAD
- Element: `A-11_claim-freshness.md` · 위치 `산출물/elements/`
- 빌드 산출: 동명 `.docx`(pandoc + CJK 패치). 도표 2종 임베드 — `A-11_fig30.png`(§3.0 법조문 관계 흐름) · `A-11_flow.png`(§5.0 판정 로직 흐름).

---

— 이하 부록 A·B는 A-13 양식엔 대응 슬롯이 없는 A-11 고유 내용으로 보존한다. —

## 부록 A. Authority Verification Table — Official URLs Only

| Issue | Correct Authority | Direct/Supporting | A-11 반영 | Official URL |
|-------|-------------------|-------------------|-----------|--------------|
| 506(c) 일반광고·검증의무 입법 지시 | JOBS Act §201(a), Pub. L. 112-106 | Background | 검증의무 statutory hook(연혁) | govinfo.gov |
| 모든 purchaser AI 요건 | Rule 506(c)(2)(i), 17 C.F.R. §230.506(c)(2)(i) | Background | freshness 필요성 | ecfr.gov |
| reasonable steps to verify 틀 | Rule 506(c)(2)(ii), 17 C.F.R. §230.506(c)(2)(ii) | Supporting | 검증 틀 | ecfr.gov |
| prior-verification 5년 재사용 | Rule 506(c)(2)(ii)(E), 17 C.F.R. §230.506(c)(2)(ii)(E) | **Direct** | AI claim 5년 상한 | ecfr.gov |
| 제3자 확인 "within prior three months" | Rule 506(c)(2)(ii)(C), 17 C.F.R. §230.506(c)(2)(ii)(C) | Conditional | (C) 발급 시점 신선도 (A-03) | ecfr.gov |
| qualified purchaser 정의 | ICA §2(a)(51), 15 U.S.C. §80a-2(a)(51) | Background | QP claim 대상(자격=A-13) | uscode.house.gov |
| "취득 시점" QP 보유 면제 (무만료) | ICA §3(c)(7), 15 U.S.C. §80a-3(c)(7) | Supporting | QP 법규상 신선도 없음 → 정책 | uscode.house.gov |
| (E) 5년 재사용 신설(2021-03-15 시행) | Release No. 33-10884(2020), 86 FR 3496(본문 3598) | **Direct** | AI 5년 상한 해석 근거 | sec.gov |
| accredited investor 정의 확대(2020) — (E) 출처 아님 | Release No. 33-10824(2020), 85 FR 64234 | Background | AI 카테고리 배경(A-03) | sec.gov |
| 506(c) 채택·원칙기반 verify | Release No. 33-9415(2013) | Background | 검증 틀 배경 | sec.gov |

## 부록 B. 안전한 표현 / 위험한 표현 (데모 가이드)

**써도 되는 표현**

- A-11은 이미 발급된 자격 증명이 거래 시점에 유효기간 내인지 확인하는 기계적 pre-trade gate입니다.
- AI 증명의 5년 상한은 Rule 506(c)(2)(ii)(E)에 근거합니다(거래 시점 서면진술·반대정보 부지 전제).
- QP 증명의 1년 상한은 Decipher 정책이며, ICA §3(c)(7)은 취득 시점 기준일 뿐 법규상 만료 조항이 없습니다.
- A-11은 자격을 판단하지 않습니다 — 자격 실체는 A-03/A-13이, 시간만 A-11이 봅니다.
- 만료된 증명의 유일한 cure는 재검증(새 `verifiedAt`)이며, 운영자가 만료를 임의 연장할 수 없습니다.

**위험한 표현 (피하기)**

- ✕ "QP 증명은 법적으로 1년마다 만료된다" — 1년은 정책이지 법규가 아닙니다.
- ✕ "A-11이 보유기간을 검사한다" — 그건 C-01(Rule 144)입니다. A-11은 증명 유효기간입니다(다른 시계·다른 조문).
- ✕ "검증 한 번이면 영구 유효" — AI는 5년, QP는 1년(정책), 그 후 재검증이 필요합니다.
- ✕ "(C)의 3개월이 A-11의 상한이다" — 3개월은 발급 시점 요건(A-03)이고, A-11의 재사용 상한은 (E)의 5년입니다.
- ✕ "A-11이 애매한 경우 사람이 판단한다" — 시간 산술은 결정적이라 수동검토가 없습니다; 유일한 개입은 재검증입니다.

문서 끝.
=======
```
파일명 규칙: A-XX_부품영문이름.md   (Element)
본 부품: A-11_claim-freshness.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *자격 증명서 유효기간*("at the time of acquisition") 검사 부품 심층 walkthrough 신설. ① 규제 맥락(자격=스냅샷 → §3(c)(7)(A) 시점 기준·506(c) 5년 신뢰·2a51-1(d) → 블록체인 취득 시점 난점 → 한국 전문투자자 확인 유효기간 anchor), ② 법적 근거(§3(c)(7)(A)·506(c)(2)(ii)(E)·2a51-1(d)·SEC C&DIs), ③ 입력(verifiedAt·acquisition_ts·cap), ④ 판정 로직(만료 pseudocode·5년 신뢰 구간·취득 timestamp 4후보·경계 inclusive), ⑤ 테스트 6종(pass·만료·경계·5년신뢰·5년초과·timestamp경계), 패턴 A(날짜 산수, 단 입력 시점은 정책), A-03/A-13/A-09 공유 유틸 coordination, 3-Layer, frontend(만료 임박·경계 조기안내·갱신), Open Issues 5종(취득 timestamp ADR·cap값·경계·QP 5년신뢰·금액vs신원 신선도). **인용 검증은 후속 일괄 패스 대상.** A-13 §5.2와 cap·timestamp 기준 일치 전제. 취득 timestamp는 ADR 고정 필요.
>>>>>>> 8a8c56fb2fa198184523ac3ed682e3cb027fcfbf
