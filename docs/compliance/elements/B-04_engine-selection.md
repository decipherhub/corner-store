---
type: element-walkthrough
element-id: B-04
element-name: Engine Selection (체결 엔진 선택)
parent-recipe: R1·R2 공유 (자산별 허용 체결 방식)
internal-id: ELE.B-04
status: v1.0 — 공유 산출물 form (자체완결·규제맥락 우선·인용 검증 대기)
audience: 개발팀·법무팀·외부 consultant·학회원
related-external-sources:
  - "(법적 배경) §4(a)(7) general solicitation 금지·Reg D 공모 금지 — 체결 방식이 이를 침해 않아야"
  - "ERC-3643 / Decipher 4-Layer — Layer 2 라우팅·체결 엔진(AMM·RFQ·오더북)"
created: 2026-06-17
updated: 2026-06-17
tags: [element, B-04, engine, amm-rfq, walkthrough, spec-sheet, pattern-A]
---

# B-04 Engine Selection — 부품 심층 인수인계 문서 (Walkthrough)

> **이 문서는 무엇인가.** Decipher 컴플라이언스 부품 중 **"이 자산이 *어떤 체결 방식(엔진)*으로 거래되도 되는지 확인하는 부품"**(내부 식별자 B-04)을 풀어 쓴 문서다. 같은 증권이라도 *공개 AMM(자동시장조성)*으로 풀어놓는 것과 *whitelist RFQ(호가요청)*로만 체결하는 것은 *규제적 의미가 다르다.* B-04는 자산의 *허용 체결 엔진*을 확인해, 부적합한 방식으로 거래되지 않게 한다.
>
> **자체완결 원칙.** 다른 내부 문서를 열지 않아도 단독으로 이해되도록 작성했다. 인용은 외부 공식 자료만 사용한다.

> ✅ **인용 검증 완료** (2026-06-17 — §4(a)(7) general solicitation 연결 확인). 작성 시 메모 ↓ — **인용 검증 상태 (v1.0, 2026-06-17).** B-04는 *체결 방식 정책* 부품이라 법령 직접 인용보다 *§4(a)(7) general solicitation·Reg D 공모 금지와의 연결*이 핵심(아래). 정밀 인용은 검증 패스.

---

## §1. 규제 맥락 — 이 부품이 왜 필요한가 (Context First)

> **왜 맥락부터.** 증권의 *체결 방식*은 규제와 직결된다. *공개적으로 아무나 즉시 매수*하는 AMM 풀은 *general solicitation·공모*로 보일 수 있고, *사전 선별된 참여자 간 RFQ*는 그렇지 않다. ADR-005(§4(a)(7) 주 경로)의 *유일한 blocker가 general solicitation*이었던 것을 기억하라 — *체결 방식이 그 요건을 좌우*한다. B-04는 자산이 *허용된 체결 엔진*으로만 거래되게 한다.

### 1.1 핵심 개념 — "어떻게 체결하느냐가 규제를 바꾼다"

쉽게 말하면, DEX엔 여러 체결 방식(엔진)이 있다:
- **AMM**(자동시장조성·유동성 풀) — *누구나 풀에 대고 즉시 스왑*. 공개·무차별.
- **RFQ**(호가요청) — *사전 선별된 참여자 간* 견적·매칭.
- **오더북** — 주문 매칭.

증권형 자산엔 *체결 방식이 규제 의미*를 갖는다. *공개 AMM에 restricted 증권을 풀어놓으면* — *general solicitation(불특정 다수 권유)·공모*로 평가될 위험이 크다(§4(a)(7)·Reg D 506(c)의 전제 위반). 반면 *whitelist RFQ*는 *폐쇄 풀 내 매칭*이라 그 위험이 작다.

그래서 **자산마다 *허용 체결 엔진*을 Manifest에 선언**(예: BUIDL = {RFQ}만, AMM 불가)하고, B-04는 *이번 거래의 엔진이 그 허용 집합에 있는지* 확인한다. 부적합 엔진이면 차단.

### 1.2 법적 연결

| 출처 | 무엇 |
|---|---|
| **§4(a)(7) general solicitation 금지** | 공개 AMM은 광고성 권유로 평가 위험 → 허용 엔진 제한 필요(ADR-005 blocker) |
| **Reg D 506(c) / 공모 경계** | 체결 방식이 *사모성·폐쇄성*을 유지해야 |
| **Decipher 4-Layer** | Layer 2 라우팅이 엔진을 고르고, B-04가 자산 허용과 대조 |

### 1.3 왜 이 부품이 존재하는가

체결 방식은 *규제 적법성의 일부*다. 잘못된 엔진(공개 AMM)으로 restricted 증권을 거래하면 — *면제 전제(no general solicitation·사모성)*가 깨진다. B-04는 *자산 정책에 맞는 엔진으로만* 거래되게 해 그 전제를 지킨다. ADR-005에서 §4(a)(7)을 택하면서 *general solicitation 회피*가 핵심이 됐으므로, B-04의 *RFQ/whitelist 강제*가 그 회피의 *기술적 뒷받침*이다.

### 1.4 Decipher에서의 위치

B-04는 *체결 방식 게이트*(B 도메인). Layer 2 라우터가 엔진(AMM/RFQ/오더북)을 정하면, B-04가 *자산의 supportedEngines와 대조*한다. *순수 기계 판정*(bitset 포함 여부). ADR-005의 general solicitation 회피와 직결되는 *정책 강제* 부품.

### 1.5 한국법 비교 — 거래 방식 제한

한국도 비상장·사모 증권의 *거래 방식*(장외·특정 플랫폼·전문가 대상)을 제한한다. "어떻게 거래하느냐가 규제를 가른다"는 발상이 같다. B-04는 그 제한을 *허용 엔진 bitset*으로 구현.

---

## §2. 📋 메타 정보 (Internal Identifier Box)

| 항목 | 값 | 한 줄 풀이 |
|---|---|---|
| 부품 이름 | **Engine Selection** | 자산별 허용 체결 엔진 검사원 |
| 검사 대상 | 이번 거래의 *체결 엔진*이 자산 허용 집합에 있는가 | "이 방식으로 거래해도 되나" |
| Internal ID | B-04 (Decipher PM 규약) | 부품 일련번호 |
| 검증 방식 | **기계 판정형(패턴 A)** — bitset 포함 확인 | engine ∈ supportedEngines |
| Timing | **pre-trade**(라우팅 단계) | 거래 직전 |
| Stateful 여부 | **STATELESS** | 엔진 1회 확인 |
| 주 활성화 Recipe | **R1·R2 공유** | 체결 방식 전제 |
| 연계 부품 | **B-01**(Manifest)·**C-00**(§4(a)(7) general solicitation 연계)·Layer2 Router | |
| 성숙도 | 🟢 확인만(기존 정리 적용) | |
| 파일·위치 | B-04_engine-selection.md · 산출물/elements/ | 산출물 경로 |

---

## §2-A. 📐 결정론 경계 — 온체인이 하는 일 / 정책·법적판단에 위임하는 일

> **개발팀 핵심:** 아래 *왼쪽만 구현*. *어떤 엔진이 general solicitation인지의 법적 판단*은 정책/변호사 — B-04는 *허용 집합 대조*만.

| ✅ 온체인이 확인/구현 (결정론) | 🔵 정책/법적판단이 정함 |
|---|---|
| 거래 엔진 ∈ `manifest.supportedEngines` (bitset) | 어떤 엔진이 *general solicitation/공모 위험*인지 판단 |
| 엔진 표지 일관성 | 자산별 *허용 엔진 정책* 설정(Manifest) |
| | AMM이 §4(a)(7) 요건 침해하는지 *법적 평가* |

→ B-04는 *"이 엔진이 허용 집합에 있나"*만. *왜 그 엔진만 허용인지(법적 판단)*는 정책/변호사(off-chain).

---

## §3. ① 법적·정책 근거

### 3.1 §4(a)(7) general solicitation 금지 (핵심 연결)

> §4(a)(7)은 *seller의 general solicitation 금지*를 요구(ADR-005 §5의 유일 blocker). *공개 AMM 풀*은 불특정 다수 대상 *상시 매수 가능*이라 general solicitation으로 평가될 위험. *whitelist RFQ*는 폐쇄 매칭이라 위험이 작다. → 자산이 *허용 엔진을 RFQ로 제한*하면 §4(a)(7) 요건 회피에 기여. **B-04가 그 제한을 강제.**

### 3.2 Reg D 506(c)·사모성

> Reg D 506(c)는 general solicitation을 *허용*하나(발행 단계), *2차 거래(§4(a)(7))*에선 금지. 체결 방식이 *사모성·폐쇄성*을 유지해야 면제 전제가 산다.

### 3.3 Sub-요건 분해

| 요소 | 충족 조건 |
|---|---|
| 허용 엔진 | 거래 엔진 ∈ supportedEngines |
| general solicitation 회피 | (정책상) restricted 증권은 RFQ/whitelist 위주 |
| 엔진 일관성 | Layer2 라우팅 엔진과 자산 정책 정합 |

---

## §4. ② 입력 사실 — 판정에 필요한 데이터

| 필드 | 유형 | 출처 | 무엇 |
|---|---|---|---|
| `transaction.engine` | enum | Layer2 Router | 이번 거래 체결 엔진(AMM/RFQ/오더북) |
| `manifest.supportedEngines` | bitset | Manifest | 자산 허용 엔진 집합 |
| `manifest.solicitationPolicy` | enum(선택) | Manifest | general solicitation 정책(RFQ-only 등) |

---

## §5. ③ 판정 로직

### 5.1 Pseudocode + 해설

```
function check_B_04(transaction, asset):
    if (asset.manifest.supportedEngines & bit(transaction.engine)) == 0:
        return FAIL_ENGINE_NOT_SUPPORTED          # 허용 집합 밖 엔진
    return PASS
```

- **해설**: bitset 포함 여부 한 줄. *왜 그 엔진만 허용인지(general solicitation 회피 등)*는 정책(Manifest)이 미리 결정(§2-A). 가장 단순한 기계 판정.

---

## §6. ④ 거절·예외 처리

| Code | 언제 | 처리 |
|---|---|---|
| `FAIL_ENGINE_NOT_SUPPORTED` | 허용 집합 밖 엔진(예: RFQ-only 자산을 AMM으로) | 거래 차단 + 허용 엔진 안내 |
| `PASS` | 허용 엔진 | 통과 |

---

## §7. ⑤ 테스트 케이스

| # | 시나리오 | 기대 |
|---|---|---|
| T1 | BUIDL(RFQ-only), RFQ 체결 | **PASS** |
| T2 | BUIDL(RFQ-only)를 공개 AMM으로 | **FAIL_ENGINE_NOT_SUPPORTED** |
| T3 | 다중 엔진 허용 자산, 허용 엔진 중 하나 | **PASS** |
| T4 | supportedEngines에 없는 신규 엔진 | **FAIL_ENGINE_NOT_SUPPORTED** |

---

## §8. (α) 코드 변환 패턴 선택 — 기계 판정형(A)

본 부품은 **패턴 A**(bitset 포함 이분). 사람 판단 0. *허용 엔진 정책 결정(general solicitation 법적 평가)*만 off-chain(정책/변호사).

---

## §9. (β) Cross-Element·Cross-Recipe Coordination

- **C-00 / ADR-005(§4(a)(7))**: §4(a)(7) general solicitation 회피의 *기술적 뒷받침* — B-04가 *공개 AMM을 막고 RFQ/whitelist를 강제*하면 그 법적 쟁점(§5 blocker) 완화에 기여.
- **B-01(Manifest)**: supportedEngines는 Manifest 선언, B-01이 무결성 보증, B-04가 대조.
- **Layer 2 Router**: 라우터가 엔진을 고르고, B-04가 자산 허용과 대조(라우팅 정합).
- **Recipe**: R1·R2 공유 체결 전제.

---

## §10. (γ) 3-Layer Solution

| Layer | 누가 | 무엇 | 한계 |
|---|---|---|---|
| 1. 온체인 bitset | 코드 | 엔진 ∈ 허용 집합 확인 | 정책 결정은 밖 |
| 2. 정책/변호사 | Decipher·법무 | 어떤 엔진이 적법한지(general solicitation 평가) | 법적 판단 |
| 3. Layer2 Router | 라우터 | 엔진 선택·라우팅 | 정합 |

---

## §11. (δ) Frontend·Off-chain Operator Layer

| 단계 | 위치 | 무엇 |
|---|---|---|
| 엔진 제한 안내 | Frontend | "이 자산은 RFQ로만 거래 가능(공개 AMM 불가)" |
| 정책 설정 | Off-chain | 자산별 허용 엔진 정책(general solicitation 평가 반영) |

---

## §12. Open Issues

1. **엔진별 general solicitation 평가** 🔴 — 공개 AMM이 §4(a)(7) general solicitation에 해당하는지(ADR-005 blocker와 동일 쟁점). 변호사 확인 → 허용 엔진 정책 확정.
2. **RFQ/whitelist의 폐쇄성 기준** 🟡 — 어느 정도 폐쇄여야 general solicitation 회피인지.
3. **엔진 집합·확장** 🟢 — 지원 엔진 enum·신규 엔진 추가 거버넌스.

---

## §13. 파일명 규칙 (Naming Convention)

```
본 부품: B-04_engine-selection.md · 산출물/elements/
```

## §14. 변경 로그

- [2026-06-17] v1.0 작성. *자산별 허용 체결 엔진* walkthrough 신설. 규제 맥락(체결 방식이 규제 의미 좌우·공개 AMM=general solicitation 위험·RFQ/whitelist=폐쇄·ADR-005 §4(a)(7) blocker 직결·한국 거래방식 제한 anchor), §2-A 경계(허용집합 대조=온체인·법적 평가=정책), 근거(§4(a)(7) solicitation·506(c)·4-Layer), 로직(bitset pseudocode), 테스트 4종, 패턴 A, ADR-005/B-01/Layer2 coordination, Open Issues 3종(엔진별 solicitation 평가·폐쇄성 기준·엔진 집합). 정책 강제 부품 — ADR-005 general solicitation 회피의 기술적 뒷받침.
