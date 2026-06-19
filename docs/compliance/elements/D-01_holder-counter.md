---
type: element-walkthrough
element-id: D-01
element-name: Holder Counter (보유자 수 카운터)
parent-recipe: R3 (ICA §3(c)(7) Fund) — 2000-holder cap · R1 (506(b) 35-cap, 본 프로젝트는 506(c)라 비활성)
internal-id: ELE.D-01
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
stateful: true
related-external-sources:
  - "15 U.S.C. § 80a-3(c)(1) — 100 beneficial owner: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-3&num=0&edition=prelim"
  - "15 U.S.C. § 78l(g) — §12(g) 등록 트리거(2000/500 holders of record): https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78l&num=0&edition=prelim"
  - "17 CFR § 240.12g5-1 — 'held of record' 정의: https://www.ecfr.gov/current/title-17/section-240.12g5-1"
  - "17 CFR § 270.3c-1 — §3(c)(1) beneficial owner 산정: https://www.ecfr.gov/current/title-17/section-270.3c-1"
created: 2026-06-17
updated: 2026-06-17
tags: [element, D-01, holder-count, stateful, 12g, 3c7, walkthrough, spec-sheet, R3]
---

# D-01 Holder Counter — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher RWA DEX의 컴플라이언스 부품 중 하나인 **"보유자가 몇 명인지 세서 한도를 지키는 부품"**(내부 식별자 D-01)을 풀어 쓴 인수인계 문서다. 미국 펀드 면제는 *투자자 인원 한도*가 있고, 그 한도를 넘으면 면제가 깨지거나 강제 등록 트리거가 작동한다. 본 부품은 *진짜 사람 수*를 세서 그 선을 지킨다.
>
> **이 부품의 특별함 — STATEFUL(상태 보유).** 지금까지의 부품들은 *거래 시점 스냅샷*만 보는 stateless였다. 본 부품은 다르다 — **누적 보유자 수라는 *상태*를 들고 있다가, 거래가 체결될 때마다 갱신**한다. 즉 *거래 직전 확인(이 거래가 한도를 넘기나?)* + *거래 직후 반영(카운터 +1/−1)* 두 박자로 작동한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 eCFR/uscode 일괄 패스·오류 0건, 상세 `_core/인용 검증 리포트`). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17 — 검증 대기).** "먼저 작성, 검증 나중" 1차 초안. **미세 locator 주의**: §12(g)의 정확한 하위 항(78l(g)(1)(A) 등)·트리거 숫자의 현행값(2000인/비-AI 500인)·12g5-1 "held of record" 세부는 검증 패스에서 uscode/eCFR 원문 1대1로 확정한다(현재 "확인 요"). 100인(§3(c)(1))은 statute 명문.

---

## §1. 규제 맥락 — 이 부품이 다루는 규제는 어디서 왔는가 (Context First)

> **왜 맥락부터.** 미국 펀드 면제는 *"소수의 적격 투자자만 상대한다"*는 전제로 작동한다. 그래서 면제마다 *인원 한도*가 붙는다. 한도를 넘으면 → 면제 상실 또는 *강제 공개기업화(등록)* 트리거. 본 부품은 그 인원을 *진짜 사람 단위로* 세서 한도를 지킨다.

### 1.1 핵심 개념 — 면제마다 "인원 한도"가 있다

쉽게 말하면, 사모/펀드 면제는 *"너무 많은 사람에게 팔면 사실상 공모"*라는 발상이라 인원에 상한을 둔다. 우리에게 걸리는 한도는 셋:

| 면제 | 인원 한도 | 단위 |
|---|---|---|
| Reg D **506(b)** | 비적격투자자 **35인** | purchaser(적격투자자 제외 산정) |
| ICA **§3(c)(1)** | beneficial owner **100인** | 실질 소유자 |
| ICA **§3(c)(7)**(BUIDL) | *법상 cap 없음* — 그러나 **§12(g)로 실무상 record holder 2000인** | 등록 보유자 |

→ **BUIDL은 §3(c)(7) 펀드**라 ICA 자체엔 인원 cap이 없다. 하지만 **1934년법 §12(g)**가 *record holder가 일정 수(통상 2000인, 비-적격은 500인)*를 넘으면 *Exchange Act 등록 의무*를 트리거한다. 등록되면 사모 펀드의 비공개성이 깨지므로, §3(c)(7) 펀드도 *실무상 2000인 미만*으로 관리한다. **이 2000인 선을 지키는 것이 BUIDL 맥락에서 본 부품의 핵심 임무다.**

(주의: 506(b)의 35인은 *우리 프로젝트가 506(c)를 쓰므로* 사실상 비활성이다 — 506(c)는 전원 적격이라 35인 비적격 cap이 적용되지 않는다. 본 부품엔 두되 BUIDL에선 2000인이 binding.)

### 1.2 왜 *진짜 사람*을 세야 하나 — A-04와의 연결

이 한도들은 전부 *"지갑 수"가 아니라 "진짜 사람(beneficial owner / holder of record) 수"*다. 한 사람이 지갑 10개로 들어오면 *10명*으로 세어 한도가 가짜로 차거나, 거꾸로 우회된다. 그래서 본 부품은 **A-04(신원 중복)가 *같은 사람*으로 묶어준 결과를 받아** 진짜 사람 단위로 센다. (A-04 = "누가 같은 사람인가", D-01 = "그래서 사람이 몇 명인가" — 역할 분리.)

### 1.3 왜 STATEFUL인가 — 누적이라서

인원 한도는 *이 거래 하나*만 봐선 알 수 없다. *지금까지 누적된 보유자 수*에 *이번 거래로 늘어날 사람*을 더해야 한다. 그래서 본 부품은 **누적 카운터라는 상태를 유지**하고, 거래마다:
- **거래 직전(pre-trade)**: "이번 매수인이 *새 보유자*라면, 카운터+1이 한도를 넘나?" 확인.
- **거래 직후(post-trade commit)**: 실제 체결되면 카운터를 갱신(신규 보유자 +1, 전량 매도로 보유자 0 되면 −1).

이 *상태 관리*가 stateless 부품과의 결정적 차이다(§5).

### 1.4 Decipher에서의 위치

본 부품은 R3(§3(c)(7) Fund)의 *2000인 cap 게이트*다. 다른 자격 부품(A-13 QP 등)이 *개별 매수인 자격*을 본다면, 본 부품은 *집합(전체 보유자 수)*을 본다 — 유일하게 *"이 거래 자체는 적법해도, 누적 결과가 한도를 넘으면 막아야 하는"* 부품이다. STATEFUL이라 *동시성·원자성*(여러 거래가 동시에 카운터를 건드릴 때) 설계가 추가로 필요하다(§12).

### 1.5 한국법과의 비교 — 사모 49인/50인 기준

한국 인력의 직관: 한국 자본시장법도 *사모(私募)*를 *청약 권유 대상 50인 미만(49인 이하)* 기준으로 가른다(50인 이상이면 모집=공모 규제). "인원이 일정 수를 넘으면 공모로 본다"는 발상이 미국 §3(c)(1) 100인·§12(g) 2000인과 같다. 차이는 — 미국은 *면제 종류마다 다른 숫자*(35/100/2000)가 있고, *record holder/beneficial owner 산정 규칙*이 정교하며, 본 부품은 그걸 *실시간 누적 카운터*로 구현한다는 점이다.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Holder Counter** | 보유자 수 한도 검사·집계원 |
| 검사 대상 | 전체 보유자 수가 *한도* 내인가(§3(c)(7)→§12(g) 2000·§3(c)(1) 100·506(b) 35) | "사람이 몇 명까지 됐나" |
| Internal ID | D-01 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — 카운트·비교 | 누적 수 vs 한도 |
| Timing | **pre-trade 확인 + post-trade commit 갱신** | 직전 점검 + 직후 반영 |
| Stateful 여부 | **STATEFUL** ⭐ | 누적 보유자 수 *상태* 유지 |
| 주 활성화 Recipe | **R3**(§3(c)(7) — 2000 cap) | BUIDL의 binding cap |
| 연계 부품 | **A-04**(dedup → 진짜 사람)·**A-13**(QP)·Manifest(12gThresholds) | |
| 성숙도 | 🟡 정밀화 — record holder 산정 규칙·동시성 | |
| 파일·위치 | D-01_holder-counter.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / claim·규칙에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. 오른쪽(누가 한 명인지의 *산정 규칙*)은 claim/규칙으로 들어온다 — 코딩하지 않는다.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 오프체인 claim/규칙이 제공 (판단) |
|---|---|
| 누적 카운터 *유지*(commit 시 +1/−1) | *누가 한 명인지* 산정 규칙(record holder/beneficial owner) |
| 신규 보유자 여부 = A-04 dedup 결과 사용 | A-04의 *같은 사람* 판정(KYC) |
| count + 신규 vs 한도 *비교* | 법인 *look-through 산정*(§3(c)(1) 3c-1·501(e)) |
| Manifest 한도값(2000/100/35) 적용 | §12(g) 트리거 *해석*(어떤 보유자가 카운트되나) |

→ 온체인은 *세고 비교하고 갱신*만. *누가 1명으로 세어지는가의 규칙*(look-through·제외·held of record)은 claim/규칙(off-chain 판단).

---

## §3. ① 법적 근거 (Layer 1 → 2 → 3)

### 3.1 Layer 1 — Statutory base

> **ICA § 3(c)(1) — 100 beneficial owner** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section80a-3&num=0&edition=prelim)]
>
> **요지**: §3(c)(1) 면제 펀드는 지분이 **100인 이하의 beneficial owner(실질 소유자)**에게 소유되어야 한다. *지갑이 아니라 실질 소유자* 기준.

> **1934년법 § 12(g) — 등록 트리거** [🔗 [U.S. Code](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section78l&num=0&edition=prelim)] *(하위 항·현행 숫자 확인 요)*
>
> **요지**: 일정 자산 규모 이상 발행자의 한 종류 증권이 **holders of record가 일정 수(통상 2000인, 비-적격투자자는 500인)**를 넘으면 *Exchange Act 등록·계속공시 의무*가 트리거된다. → §3(c)(7) 펀드는 ICA상 인원 cap이 없어도 *이 §12(g) 때문에* record holder를 *2000인 미만*으로 관리한다.

해설: BUIDL의 2000인 cap은 *ICA(§3(c)(7))가 아니라 1934년법(§12(g))*에서 온다 — *다른 법체계의 제약*이 펀드 운영에 걸린다는 점이 핵심(A-13 §1.2와 일관).

### 3.2 Layer 2 — Regulatory specification

> **17 CFR § 240.12g5-1 — "held of record" 정의** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-240.12g5-1)]
>
> **요지**(확인 요): §12(g)의 *"holders of record"*를 누구로 세는지 규정(명의 기준·일정 look-through·합산 규칙). → 본 부품의 *"한 명"의 정의*가 여기서 온다.

> **17 CFR § 270.3c-1 — §3(c)(1) 100인 산정** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-270.3c-1)]
>
> **요지**(확인 요): §3(c)(1) 100인을 셀 때 *법인 투자자를 언제 look-through*해 그 구성원을 합산하는지(integration) 등. → 법인 보유자의 *산정 단위*.

> **17 CFR § 230.501(e) — 506(b) 35인 산정** [🔗 [eCFR](https://www.ecfr.gov/current/title-17/section-230.501)]
>
> **요지**: 506(b) 35인을 셀 때 *적격투자자 제외·친족 합산·법인 1인 산정* 등. (506(c) 쓰는 본 프로젝트엔 비활성이나, 산정 규칙의 참조.)

### 3.3 Layer 3 — Interpretive guidance

> **§12(g) 실무 — 토큰화 펀드의 holder 관리**
>
> **요지**: 토큰화 증권은 *지갑 분산*으로 record holder 수가 부풀 위험이 있어, 업계는 *실질 보유자 단위 집계 + whitelist 한도 관리*로 §12(g) 트리거를 피한다. 본 부품은 그 집계를 *온체인 카운터*로 구현한다. (구체 산정·트리거 해석은 변호사 확인 — §12.)

### 3.4 Sub-요건 분해

| 한도 | 단위·산정 | 근거 | BUIDL |
|---|---|---|---|
| 100인(§3(c)(1)) | beneficial owner(법인 look-through) | §3(c)(1)·3c-1 | 비적용(BUIDL=§3(c)(7)) |
| 2000인(§12(g)) | holders of record | §12(g)·12g5-1 | **binding** |
| 35인(506(b)) | 비적격 purchaser(제외·합산) | 501(e) | 비활성(506(c)) |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇을 말해주나 |
|---|---|---|---|
| `holderCountState` | uint(상태) | 온체인 카운터 | *현재까지* 누적 보유자 수 |
| `buyer.isNewHolder` | bool | A-04 dedup | 이 매수인이 *기존 보유자가 아닌 새 사람*인가 |
| `buyer.personId` | id | A-04/ONCHAINID | 진짜 사람 식별(중복 합산 방지) |
| `manifest.holderCap` | uint | Manifest(12gThresholds) | 적용 한도(예: 2000) |
| `seller.becomesZero` | bool | 보유 잔량 | 매도인이 *전량 매도로 보유자에서 빠지는가*(−1) |
| `holderType` | enum | claim | 개인/법인(법인이면 산정 규칙 적용) |

해설: 핵심 입력은 *현재 카운터*와 *"이 매수인이 새 사람인가"*(A-04 결과)다. 매도인이 전량 팔아 0이 되면 카운터 −1도 본다.

---

## §5. ③ 판정 로직 — STATEFUL 두 박자

### 5.1 전체 흐름 (사람 말로)

**거래 직전:** 이 매수인이 새 보유자면, *카운터+1이 한도를 넘는지* 확인 → 넘으면 차단. **거래 직후(commit):** 실제 체결되면 *카운터를 실제로 갱신*(신규 +1, 전량 매도자 −1).

### 5.2 Pseudocode + 해설

```
# --- 거래 직전(pre-trade) ---
function check_D_01_pretrade(buyer, asset):
    cap = asset.manifest.holderCap            # 예: 2000 (§12(g))
    count = HolderCountState[asset]            # 현재 누적(상태)
    if buyer.isNewHolder:                      # A-04 dedup 결과
        if count + 1 > cap:
            return FAIL_HOLDER_CAP_EXCEEDED    # 새 사람이라 한도 초과 → 차단
    return PASS                                # 기존 보유자거나 여유 있음

# --- 거래 직후(post-trade commit) ---
function commit_D_01(buyer, seller, asset):
    if buyer.isNewHolder:
        HolderCountState[asset] += 1           # 신규 보유자 등재
    if seller.becomesZero:                     # 전량 매도로 보유 0
        HolderCountState[asset] -= 1           # 보유자에서 제거
```

- **pre-trade 해설**: *기존 보유자가 추가 매수*하면 사람 수는 안 늘므로 통과(count 불변). *새 사람*일 때만 +1이 한도를 넘는지 본다.
- **commit 해설**: 실제 체결돼야 카운터를 바꾼다. 신규 진입 +1, 전량 매도(보유자에서 이탈) −1. → *상태가 거래 결과로만 변한다*(원자성 중요 — §12).
- **A-04 의존**: `isNewHolder`·`personId`는 A-04 dedup이 준다. A-04가 *같은 사람*을 못 묶으면 카운트가 부정확해진다(§9).

### 5.3 핵심 — "한 명"을 누가 정의하나 (경계)

카운트 *연산*은 결정론이지만, **"누구를 한 명으로 세나"**는 *법적 산정 규칙*이다 — 법인을 look-through해 구성원을 합산할지(§3(c)(1) 3c-1), held of record를 어떻게 셀지(12g5-1), 친족·적격투자자 제외(501(e)). **이 산정 규칙은 claim/규칙으로 들어오고, 온체인은 그 결과(+1/−1·isNewHolder)만 누적**한다(§2-A 경계).

### 5.4 동시성·원자성 (STATEFUL의 함정)

여러 거래가 *동시에* 같은 자산의 카운터를 건드리면 — 둘 다 "한도 직전"을 통과하고 *둘 다 commit*되어 *한도를 초과*할 수 있다(race condition). 그래서 카운터 갱신은 *원자적(atomic)*이어야 하고, pre-trade 확인과 commit 사이의 *정합성*이 보장돼야 한다. 이건 stateless 부품엔 없던 *구현 난점*이다(§12).

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 무엇 | 처리 |
|---|---|---|---|
| `FAIL_HOLDER_CAP_EXCEEDED` | 새 보유자 +1이 한도 초과 | 보유자 한도 도달 | reject — 신규 진입 차단(기존 보유자 거래는 가능) |
| `PASS` | 기존 보유자거나 여유 있음 | OK | (commit에서 카운터 갱신) |
| `REVIEW_HOLDER_COUNT_RULE` | 산정 규칙 불명확(법인 look-through 등) | "한 명" 판정 모호 | manual review |

해설: 한도 초과는 *신규 보유자만* 막는다 — *기존 보유자끼리의 거래*(사람 수 불변)는 통과한다. 즉 한도가 찬 펀드도 *내부 유통은 계속*되되 *새 사람만 못 들어온다.*

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 입력 | 기대 |
|---|---|---|---|
| T1 (Pass·여유) | count=1500, 새 매수인, cap=2000 | new, +1=1501 | **PASS** + commit +1 |
| T2 (Fail·초과) | count=2000, 새 매수인 | new, +1=2001 | **FAIL_HOLDER_CAP_EXCEEDED** |
| T3 (기존 보유자) | count=2000(만석), *기존* 보유자 추가 매수 | not new | **PASS**(사람 수 불변) |
| T4 (dedup 효과) | 같은 사람의 2번째 지갑 매수 | A-04: not new | **PASS** + 카운터 불변 |
| T5 (−1 감소) | 매도인이 전량 매도 | becomesZero | commit −1 |
| T6 (동시성) | count=1999, 두 신규 매수 동시 | race | *원자 처리* — 하나만 +1, 다른 하나 FAIL(§5.4) |

T6은 STATEFUL의 핵심 — *동시 거래의 원자성*을 검증한다.

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A) + STATEFUL

본 부품은 **패턴 A**(세고 비교)이되, 다른 A 부품과 달리 **상태(누적 카운터)를 유지**한다. 카운트·비교는 결정론이지만, *"한 명"의 산정 규칙*은 claim/규칙(§5.3), *상태 갱신의 원자성*은 구현 과제(§5.4)다. → "결정론적 집계 + 비결정적 산정규칙(claim) + 상태 원자성"의 결합.

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

```
A-04(dedup) ──isNewHolder·personId──▶ D-01: 진짜 사람 단위 카운트
A-08/A-09(법인 look-through) ──구성원 산정──▶ D-01: 법인 보유자 산정 규칙
Manifest(12gThresholds 2000/500/100) ──한도값──▶ D-01
Router(거래 체결) ──commit──▶ D-01: 카운터 +1/−1 (post-trade)
```

- **A-04와의 관계 — 핵심**: D-01의 정확성은 *A-04 dedup 품질*에 직결된다. A-04가 같은 사람을 못 묶으면 카운트가 부풀어 *한도를 가짜로 채운다*. (A-04=누가 같은 사람, D-01=몇 명.)
- **법인 보유자(A-08/A-09)**: §3(c)(1) 맥락에선 법인을 look-through해 구성원을 합산할 수 있다(3c-1) → 산정 규칙이 A-08/A-09 데이터와 연계.
- **Router(post-trade commit)**: D-01은 *체결 후* 카운터를 갱신하므로, Router가 commit 이벤트로 D-01을 호출한다(다른 부품은 pre-trade 1회로 끝남 — D-01만 post-trade 단계가 있음).
- **Recipe**: R3(§3(c)(7))의 2000 cap 게이트. (506(b) 35-cap은 506(c) 프로젝트라 비활성.)

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| **1. 온체인 카운터** | 코드 | 누적 집계·비교·원자 갱신 | "한 명" 산정 규칙은 입력 의존 |
| **2. Trusted Issuer/규칙** | 신뢰기관 | record holder 산정·법인 look-through·dedup(A-04) | 산정 판단 |
| **3. 운영 모니터링** | Decipher 운영 | §12(g) 트리거 근접 경보·실보유자 감사 | 사후·확률적 |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 한도 근접 경보 | Off-chain(운영) | "보유자 1950/2000 — §12(g) 근접" 운영 알림 |
| 신규 차단 안내 | Frontend | "이 펀드는 보유자 한도에 도달 — 신규 진입 불가(기존 보유자 거래는 가능)" |
| 산정 규칙 검토 | Off-chain | 법인 look-through·record holder 산정 manual review |

---

## §12. Open Issues

1. **record holder 산정 규칙** 🔴 — §12(g)/12g5-1의 "held of record"를 토큰·지갑·신원에 어떻게 매핑하나(법인 look-through 포함). A-04·A-08/09와 연계. 변호사 확인.
2. **§12(g) 트리거 숫자·현행값** 🟡 — 2000/500(비-AI)의 현행 정확값·자산 규모 조건을 uscode 원문으로 확정.
3. **동시성·원자성 구현** 🔴 — 동시 거래 race condition 방지(원자적 카운터·pre/commit 정합성). 개발팀 설계 핵심.
4. **−1 처리(보유자 이탈) 기준** 🟡 — 전량 매도·dust 잔량·일시적 0 등 "보유자에서 빠지는" 정확한 기준.
5. **§3(c)(1) vs §3(c)(7) 카운트 전환** 🟢 — BUIDL은 §3(c)(7)(2000)이나, 자산이 §3(c)(1) 구조면 100인 — Manifest로 분기.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: D-01_holder-counter.md · 산출물/elements/
```

---

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *보유자 수 한도 카운터(STATEFUL)* walkthrough 신설. ① 규제 맥락(면제별 인원 한도 35/100/2000·BUIDL 2000=§12(g)에서 옴·진짜 사람 단위(A-04)·STATEFUL 이유·한국 49/50인 anchor), ② 법적 근거(§3(c)(1)·§12(g)·12g5-1·3c-1·501(e)), §2-A 경계 박스(카운트는 온체인·산정규칙은 claim), ③ 입력(카운터 상태·isNewHolder·한도값), ④ 로직(**pre-trade 확인 + post-trade commit 두 박자**·동시성/원자성), ⑤ 테스트 6종(여유·초과·기존보유자·dedup·−1·동시성), 패턴 A+STATEFUL, A-04/A-08·09/Manifest/Router coordination, Open Issues 5종(record holder 산정·§12(g) 숫자·동시성·−1 기준·3c1/3c7 전환). **인용 검증 대기**(미세 locator 확인 요·100인은 명문). 첫 STATEFUL 부품 — 상태 원자성이 구현 핵심.
