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

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

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

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

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

---

## §13. 파일명 규칙 (Naming Convention)

```
파일명 규칙: A-XX_부품영문이름.md   (Element)
본 부품: A-11_claim-freshness.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *자격 증명서 유효기간*("at the time of acquisition") 검사 부품 심층 walkthrough 신설. ① 규제 맥락(자격=스냅샷 → §3(c)(7)(A) 시점 기준·506(c) 5년 신뢰·2a51-1(d) → 블록체인 취득 시점 난점 → 한국 전문투자자 확인 유효기간 anchor), ② 법적 근거(§3(c)(7)(A)·506(c)(2)(ii)(E)·2a51-1(d)·SEC C&DIs), ③ 입력(verifiedAt·acquisition_ts·cap), ④ 판정 로직(만료 pseudocode·5년 신뢰 구간·취득 timestamp 4후보·경계 inclusive), ⑤ 테스트 6종(pass·만료·경계·5년신뢰·5년초과·timestamp경계), 패턴 A(날짜 산수, 단 입력 시점은 정책), A-03/A-13/A-09 공유 유틸 coordination, 3-Layer, frontend(만료 임박·경계 조기안내·갱신), Open Issues 5종(취득 timestamp ADR·cap값·경계·QP 5년신뢰·금액vs신원 신선도). **인용 검증은 후속 일괄 패스 대상.** A-13 §5.2와 cap·timestamp 기준 일치 전제. 취득 timestamp는 ADR 고정 필요.
