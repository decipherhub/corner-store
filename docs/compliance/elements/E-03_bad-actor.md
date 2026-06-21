---
type: element-walkthrough
element-id: E-03
element-name: Bad Actor Disqualification (전과자 차단)
parent-recipe: R1 (Reg D 506(c) Issuance)
internal-id: ELE.E-03
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "17 CFR § 230.506(d) — bad actor disqualifying events: https://www.ecfr.gov/current/title-17/section-230.506"
  - "17 CFR § 230.506(e) — pre-existing event 공시: https://www.ecfr.gov/current/title-17/section-230.506"
created: 2026-06-17
updated: 2026-06-17
tags: [element, E-03, bad-actor, 506d, walkthrough, spec-sheet, R1, pattern-A, issuer-side]
---

# E-03 Bad Actor Disqualification — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"발행에 관여한 사람 중에 *전과자(bad actor)*가 있으면 Reg D 면제를 막는 부품"**(내부 식별자 E-03)을 풀어 쓴 문서다. 매수인이 아니라 **발행자 측 사람들**(발행자·임원·20% 이상 주주·주관사 등)에게 *특정 전력*이 있으면 Reg D 506을 못 쓰게 되는데, 본 부품은 그 결격 사유 부재를 확인한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** "먼저 작성, 검증 나중" 1차 초안. **미세 locator 주의**: Rule 506(d)의 covered person 범위·disqualifying event 목록·look-back 기간·506(e) 공시 예외는 검증 패스에서 eCFR 원문 1대1로 확정(현재 "확인 요").

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** Reg D 면제는 *발행자를 믿고* 등록을 면해준다. 그런데 *과거에 증권 사기 등으로 처벌받은 사람*이 발행에 끼어 있으면 그 신뢰가 깨진다. 그래서 *"나쁜 전력자(bad actor)가 관여하면 Reg D를 못 쓴다"*는 결격(disqualification) 규칙이 있다(Dodd-Frank가 도입). 본 부품은 그 결격 사유 부재를 확인한다.

### 1.1 핵심 개념 — "나쁜 전력자가 끼면 면제 박탈"

쉽게 말하면, Reg D 506 발행에 관여하는 **"covered persons"**(발행자·이사·executive officer·일반 파트너·20% 이상 의결 지분 보유자·promoter·placement agent 등) 중 누구라도 **"disqualifying event"**(증권 관련 유죄판결·법원/규제기관 금지명령·SEC 제재·우편사기 유죄 등 *특정 전력*)가 있으면 — 그 발행은 **Reg D 506을 쓸 수 없다**(면제 박탈). "전과자 차단"이라는 별칭이 그래서 붙었다.

다만 *look-back 기간*(예: 유죄판결은 과거 5년/10년 이내 등 이벤트별)과 *예외*(이미 공시한 pre-existing event는 결격 아님 — 506(e))가 있어, *언제·무슨* 전력인지가 중요하다.

본 부품은 *covered persons 중 결격 사유자가 없음*을 확인해, *결격 발행자의 토큰*이 우리 DEX에서 Reg D를 가장해 유통되지 않게 한다.

### 1.2 어느 법·규칙에서 오나

| 출처 | 무엇 |
|---|---|
| **Rule 506(d)** | bad actor disqualification — covered persons·disqualifying events 정의 |
| **Rule 506(e)** | *과거(규칙 시행 전) 발생 이벤트*는 *공시*하면 결격 아님(예외) |
| (배경) Dodd-Frank §926 | bad actor 규칙 도입 위임 |

### 1.3 왜 이 규제가 존재하는가

면제 발행은 *공시·심사가 약한* 만큼, *발행 주체의 청렴성*에 의존한다. 사기 전력자가 면제 발행에 끼면 투자자 피해 위험이 크다. 그래서 *면제의 혜택을 청렴한 발행자에게만* 주려고 결격 규칙을 둔다. *발행 단계의 신뢰 게이트*다.

### 1.4 Decipher에서의 위치

본 부품은 R1(Reg D 506(c))의 *발행자 측 청렴성 게이트*다. E-01(Form D)과 함께 *발행자 측 사실* 묶음을 이룬다. **기술적 성격**: covered persons의 전력 조회·판단은 *off-chain 배경조사(KYC/B2B due diligence)*라, 온체인은 *"결격자 없음" claim*을 확인한다(§2-A). 매수인과 무관(buyer 측 A-03 등과 직교).

### 1.5 한국법과의 비교 — 임원 결격사유

한국법에도 금융회사·상장사 *임원 결격사유*(특정 범죄·제재 이력자는 임원 불가)가 있고, *발기인·주요주주 적격성 심사*가 있다. "나쁜 전력자가 관여하면 막는다"는 발상이 같다. 차이는 — 미국 Rule 506(d)는 *면제 발행 자체를 박탈*하는 강한 효과이고, 본 부품은 그 결격 부재를 *발행 토큰 단위 claim*으로 확인한다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Bad Actor Disqualification** | 발행 관여자 전과 결격 차단원 |
| 검사 대상 | covered persons 중 *disqualifying event 보유자*가 있는가 | "발행에 나쁜 전력자가 끼었나" |
| Internal ID | E-03 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 단, 전력 조회·판단은 off-chain | "결격자 없음" claim 확인 |
| Timing | **pre-trade** | 거래 직전(발행 framework 유지) |
| Stateful 여부 | **STATELESS** | claim 1회 확인 |
| 주 활성화 Recipe | **R1**(Reg D 506(c) Issuance) | 발행 청렴성 게이트 |
| 연계 부품 | **E-01**(Form D)·**A-01**(제재, 인적 결격 인접) | 발행자 측 사실 |
| 성숙도 | 🟢 완료(claim 확인) — 전력 조회 정책 보완 | |
| 파일·위치 | E-03_bad-actor.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim·배경조사에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 누가 covered person이고 무슨 전력이 결격인지는 off-chain 배경조사/claim — 온체인은 결과만 확인.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 오프체인 claim/배경조사가 제공 |
|---|---|
| "covered persons 중 결격자 없음" claim 존재·서명·발급자 | *누가* covered person인가(범위 판정) |
| claim 신선도(배경조사 시점) | 각자의 *전력 조회*(유죄·제재·명령) |
| | disqualifying event 해당·look-back·506(e) 예외 *판단* |

→ 온체인은 *"결격자 없음"이라는 서명된 사실*만 확인. *전력을 조회하고 결격인지 판단*하는 건 off-chain.

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base (배경)

> **Dodd-Frank §926** — 의회가 SEC에 *Reg D bad actor 결격 규칙 제정*을 위임. statute 차원의 뿌리. (구체 요건은 Rule 506(d).)

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 230.506(d) — Bad Actor Disqualification** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.506)]
>
> **요지**(범위·이벤트·기간 확인 요): Rule 506 발행은, **covered person**(발행자·predecessor·이사·executive officer·일반 파트너·관리 멤버·20% 이상 의결지분 보유자·promoter·investment manager·compensated solicitor 등)에게 **disqualifying event**(증권 관련 felony/misdemeanor 유죄, SEC·규제기관·법원의 금지·정지·제재 명령, 우편·통신 사기, USPS 허위표시 명령 등 — 각 이벤트별 *look-back* 기간 있음)가 있으면 *사용할 수 없다*.

> **17 CFR § 230.506(e) — Pre-existing Events 공시 예외** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.506)]
>
> **요지**: Rule 506(d) *시행일(2013-09-23) 이전*에 발생한 이벤트는 *결격은 아니되, 투자자에게 *공시*해야 한다.* → "과거 이벤트=무조건 결격"이 아니라 *시점·공시*가 갈린다.

### 3.3 Layer 3 — Interpretive guidance

> **SEC C&DIs — Rule 506(d)/(e)** : covered person 범위(20% 지분 산정·간접 보유)·"reasonable care" 항변(발행자가 합리적 주의로 결격자 부재를 확인했으면 면책 가능) 등 해석. → 본 부품은 *"합리적 주의로 확인한 결과 claim"*에 의존(reasonable care 구조는 A-12와 결이 같음).

### 3.4 Sub-요건 분해

| 요소 | 충족 조건 | 근거 |
|---|---|---|
| covered persons 식별 | 발행자·임원·20%+·주관사 등 범위 확정 | 506(d) |
| 결격 이벤트 부재 | 각자 disqualifying event 없음(look-back 내) | 506(d) |
| pre-existing 공시 | 시행 전 이벤트는 공시됨 | 506(e) |
| reasonable care | 발행자가 합리적 주의로 확인 | C&DI |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `badActorClaim.clear` | bool | off-chain 배경조사/Trusted Issuer | covered persons 중 결격자 없음 |
| `badActorClaim.checkedAt` | date | claim | 배경조사 시점(신선도) |
| `badActorClaim.coveredScope` | enum/hash | claim | 어느 범위까지 조사했는지 |
| `badActorClaim.issuer/signature` | address/bytes | claim | 발급자·서명 |
| `preExistingDisclosed` | bool(선택) | claim | 506(e) 공시 완료 |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_E_03(asset):
    claim = asset.badActorClaim
    if claim == null or not verified(claim) or not trusted(claim.issuer):
        return REVIEW_BAD_ACTOR_UNVERIFIED      # 배경조사 결과 미확인 → 검토
    if not claim.clear:
        return FAIL_BAD_ACTOR_DISQUALIFIED       # 결격자 존재 → 차단(면제 박탈)
    # (신선도·범위 확인)
    return PASS
```

- **해설**: 온체인은 *"결격자 없음"이라는 서명된 배경조사 결과*를 확인. *누가 covered person이고 전력이 결격인지*는 off-chain 판단(§2-A). 결격자 존재 시 *발행 면제 자체가 박탈*되므로 차단.

### 5.2 reasonable care와의 관계

506(d)는 *발행자가 합리적 주의(reasonable care)로 결격자 부재를 확인*했으면, 사후 결격자가 발견돼도 면책될 수 있다(C&DI). 본 부품의 claim은 *그 reasonable care 수행 결과*를 부호화한 것 — A-12(합리적 주의)와 구조가 닮았다(증거화).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_BAD_ACTOR_DISQUALIFIED` | 결격자 존재 확인 | 차단(발행 면제 박탈) + 발행자 통지 |
| `REVIEW_BAD_ACTOR_UNVERIFIED` | 배경조사 결과 미확인 | manual review(배경조사 보강) |
| `PASS` | 결격자 없음 확인 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | 배경조사 clear claim 유효 | **PASS** |
| T2 | 이사 중 증권사기 유죄(look-back 내) | **FAIL_BAD_ACTOR_DISQUALIFIED** |
| T3 | 배경조사 claim 없음 | **REVIEW_BAD_ACTOR_UNVERIFIED** |
| T4 | 시행 전 이벤트 + 506(e) 공시 완료 | **PASS**(공시 예외) |
| T5 | 25% 지분 보유자에 제재 명령 | **FAIL**(covered person 결격) |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) + 배경조사 claim

본 부품은 **패턴 A**(결격/clear 이분)이되, *입력(전력 조회·결격 판단)은 off-chain 배경조사*라 *증명서형(B) 요소*가 강하다. 온체인은 *서명된 결과*만 확인. covered person 범위·look-back·506(e) 판단을 온체인에서 할 수 없어 불가피하다.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **E-01(Form D)**: Rule 507(Form D 위반 이력)도 발행자 결격 — E-03와 인접(둘 다 발행자 측 결격).
- **A-01(제재)**: 인적 결격이라는 점에서 발상이 닮음 — 단 A-01=제재명단(매수·매도 양측), E-03=Reg D 발행 관여자 전력(발행자 측).
- **Recipe**: R1(Reg D 506) 발행 청렴성 게이트. Reg D 발행이 아니면 비활성.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 자기신고 | 발행자 | covered persons 명단·결격 부재 주장 | 배경조사가 검증 |
| 2. 배경조사/Trusted Issuer | 신뢰기관 | 전력 조회·결격 판단·서명 | look-back·범위 판단 |
| 3. 운영·공시 | Decipher | 미검증·결격 처리·506(e) 공시 확인 | |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 배경조사 | Off-chain | covered persons 전력 조회·결격 판단 |
| 결격 안내 | Frontend | "발행 관여자 결격 — 이 자산 거래 불가" |
| 506(e) 공시 | Off-chain | pre-existing event 공시 처리 |

---

## §12. Open Issues

1. **covered person 범위·산정** 🟡 — 20% 지분 산정(간접 포함)·promoter·solicitor 범위. 변호사 확인.
2. **disqualifying event·look-back 목록** 🟡 — 이벤트별 기간·종류 정밀화(eCFR 원문).
3. **배경조사 신선도·범위** 🟢 — claim 갱신 주기·조사 범위 정책.
4. **reasonable care 항변 문서화** 🟡 — A-12와 일관된 합리적 주의 증거화.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: E-03_bad-actor.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *발행 관여자 bad actor 결격 차단* walkthrough 신설. 규제 맥락("나쁜 전력자 끼면 면제 박탈"·Dodd-Frank §926·506(d) covered persons/events·506(e) 공시예외·한국 임원결격 anchor), §2-A 경계(결격 없음 claim은 온체인·전력조회/판단은 off-chain), 입력(badActorClaim), 로직(clear 확인·reasonable care), 테스트 5종, 패턴 A+배경조사, E-01·A-01 coordination, Open Issues 4종(covered person 범위·event 목록·신선도·reasonable care). **인용 검증 대기.**
