# Element Layer — 인터페이스 + 분류틀 (개발팀용)

> **⚠️ 이 문서의 상태 (먼저 읽어주세요)**
> **인터페이스·분류틀은 안정입니다 — 지금 이걸 기준으로 build하셔도 됩니다.** 반면 **개별 Element 목록(어떤 Element가 몇 개)은 잠정입니다.** 현재 Reg D 506(c) + Reg ATS 기준으로 도출한 거라, 진행 중인 유통규제(시장행위)·중개업자 규제 리서치가 합류하면 추가·조정됩니다. 즉 *인터페이스에 build, 인스턴스는 registry로 확장* 구조로 보시면 됩니다. 확정 전수 목록은 아키텍처 freeze 시점에 별도 확정본으로 드리겠습니다.

---

## 0. 한 장 요약 — 무엇이 안정이고 무엇이 잠정인가

| 구분 | 내용 | 상태 |
|------|------|------|
| `IComplianceElement` 인터페이스 | `check()` + `elementMetadata()` + `onTransfer`(예약) | ✅ 안정 (build 대상) |
| `ElementMetadata` + 3-axis enum | Decidability · ObligationTiming · Statefulness | ✅ 안정 |
| `ElementCategory` (A~G) | 7 카테고리 | ✅ 안정 |
| 4단계 연역 / 분류 방법 | 법조문 → 요건 분해 → 원자 검증 → 인터페이스 | ✅ 안정 |
| STATEFUL 처리 모델 | Manifest orchestrate / Element execute / Router commit | ✅ 안정 |
| **개별 Element 전수 목록 (몇 개·무엇)** | 현재 ~41 잠정 | ⚠️ **잠정 — freeze 시 확정** |

---

## 1. Element이란 — 구성요건 사실의 원자 검증 단위

Element는 법조문의 요건을 더 못 쪼개는 *사실 단위*로 분해한 것입니다 — "제재 대상인가", "적격투자자인가", "보유기간을 채웠나". 각 Element는 그 사실 하나를 판정하는 가장 작은 단위(`check() → bool + reasonCode`)입니다.

도출은 **4단계 연역**입니다: `법조문 → 요건 분해 → 원자적 검증 단위(Element) → 인터페이스`. 앞 2단계(법 → 요건)는 법률 쪽에서, 뒤 2단계(원자 단위 → 인터페이스)는 개발 쪽에서 각자 검증할 수 있습니다.

Element는 **보수적으로** 늘립니다(Element Parsimony) — 사실의 어휘는 법체계가 달라도 수렴하므로(제재·거주지·자격·보유기간·금액·신고 여부…), 새 규제가 와도 ① 기존 재사용 → ② parameter 변경 → ③ variant → ④ 신규는 최후 수단 순으로 봅니다. 조합·활성화는 Recipe 책임, per-token binding은 Manifest 책임이고, Element 자체는 *Recipe-agnostic 공유 라이브러리*입니다.

---

## 2. 인터페이스 (안정 — build 대상)

```solidity
interface IComplianceElement {
    function check(
        address user,
        address counterparty,
        address asset,
        uint256 amount,
        bytes calldata context   // tx context + 토큰별 compliance facts 전달
    ) external view returns (bool passed, bytes32 reasonCode);

    function elementMetadata() external view returns (ElementMetadata);

    // STATEFUL Element용 commit hook — 집계·누적 규제(§6).
    // Router가 swap 성사 후 호출해 counter 갱신. 인터페이스 차원 예약, 현 Phase 미구현.
    // function onTransfer(address from, address to, uint256 amount) external;
}

struct ElementMetadata {
    bytes32 elementId;          // versioned 예: "A-03-v2.1"
    ElementCategory category;
    string version;
    DataSource[] dataSources;
    TemporalNature temporal;    // 데이터 신선도: ONE_TIME / PERIODIC / REALTIME / CUMULATIVE

    // ── 판정 차원 3 axis ──
    Decidability     decidability;    // 누가 판정하나
    ObligationTiming timing;          // 언제 작동하나
    Statefulness     statefulness;    // 무엇을 보고 판정하나
}

enum Decidability {
    DETERMINISTIC,     // 온체인 데이터로 기계 판정 (직접 구현)
    ATTESTATION_BASED, // 오프체인 전문가 판정 → 서명 결과만 검증 (claim/oracle)
    MONITORING_BASED   // 사전 판정 불가 → flagging + Operator 판단
}
enum ObligationTiming {
    EX_ANTE_VERIFY,    // 거래 전 이행됐어야 할 의무의 확인
    AT_TRADE_GATE,     // 거래 시점 요건 — 미충족 시 revert
    EX_POST_TRIGGER    // 거래 성사가 의무 발생 — revert 아님, commit hook
}
enum Statefulness {
    STATELESS,         // 거래 인자만으로 판정
    STATEFUL           // 누적 상태 필요 — read + commit 쌍
}
enum ElementCategory {
    INVESTOR_ATTRIBUTE,    // A: 사용자 자격
    ASSET_ATTRIBUTE,       // B: 자산 속성 + Manifest 정합
    RESALE_TRANSACTION,    // C: resale path·거래 제약
    SYSTEM_STATE,          // D: 시스템 누적 상태
    ISSUER_STATUS,         // E: 발행자 상태·신고
    CONDUCT_MONITORING,    // F: 거래 행위·monitoring
    PROCEDURAL             // G: 절차·administrative
}
```

`check()`는 순수 view 함수입니다(상태 mutation X, 외부 의존성은 읽기 전용). 상태가 필요한 누적 규제만 `onTransfer` commit hook을 별도로 씁니다(§6).

---

## 3. 3-axis 분류틀 (안정) — 임의 규제를 어디에·어떻게 구현할지 결정

각 Element(=규제 요건)에 3개 질문을 던지면 구현 위치·메커니즘이 결정론적으로 산출됩니다.

| 축 | 질문 | 값 | 결정되는 것 |
|----|------|----|-----------|
| **Decidability** | 누가 판정하나 | DETERMINISTIC / ATTESTATION_BASED / MONITORING_BASED | 온체인 직접 vs claim 검증 vs flag+Operator |
| **ObligationTiming** | 언제 작동하나 | EX_ANTE_VERIFY / AT_TRADE_GATE / EX_POST_TRIGGER | 사전 확인 vs 거래 revert vs 사후 commit |
| **Statefulness** | 무엇을 보고 판정 | STATELESS / STATEFUL | 인자만 vs counter read+commit |

이 3 좌표가 곧 인터페이스의 `ElementMetadata` 3 필드입니다. 새 규제가 들어와도 이 좌표만 찍으면 구현 형태가 나옵니다.

---

## 4. 대표 Element 예시 (⚠️ 전수 목록 아님 — 잠정)

전체 목록 대신 **3-axis 공간을 대표하는 4개**만 — 인터페이스가 왜 이렇게 설계됐는지 보이기 위함입니다.

| ID | Element | Decidability | Timing | Statefulness | 구현 형태 |
|----|---------|-------------|--------|-------------|----------|
| A-01 | OFAC 제재 스크리닝 | DETERMINISTIC | AT_TRADE_GATE | STATELESS | 온체인 즉시 차단 (revert) |
| A-03 | 적격투자자 검증 | ATTESTATION_BASED | AT_TRADE_GATE | STATELESS | KYC claim / oracle 결과 검증 |
| C-08 | Rule 144 affiliate 거래량 한도 | DETERMINISTIC | EX_POST_TRIGGER | STATEFUL | counter read + `onTransfer` commit |
| F-02 | 시장행위 패턴 탐지 | MONITORING_BASED | EX_POST_TRIGGER | STATEFUL | flag 적재 + Operator 판단 (차단기 아님) |

> 다시 강조: 이 4개는 *축을 보여주는 예시*입니다. 현재 잠정 pool은 ~41개(Required/Optional/확장용)이고, 유통규제·중개업자 리서치로 추가·조정 예정입니다.

---

## 5. affiliate gating — "첫 분기점" 예시

매도자가 affiliate(임원·10%+ 주주 등)인지가 gating의 첫 분기점입니다. affiliate면 Rule 144의 추가 의무가 연쇄 활성화됩니다:

```
A-06 (Affiliate / Control Person) = true
   → Affiliate Sub-Recipe activate
      + E-05  Current Public Information (Rule 144(c))
      + C-08  Affiliate Volume Limit          (STATEFUL)
      + C-09  Manner of Sale (Rule 144(f)·(g))
      + E-06  Form 144 Filing Trigger
```

즉 A-06 한 Element의 결과가 4개 의무 Element를 켜는 **trigger**입니다. 이 trigger 관계는 Element 간 직접 호출이 아니라 *Recipe 차원의 활성화 logic*으로 표현됩니다(Element는 서로 호출하지 않음).

---

## 6. STATEFUL 처리 모델 (안정) — 집계·누적 규제

holder 수·거래량 한도처럼 *누적 상태*로 판정하는 규제는 **별도 layer 없이** 세 주체 협력으로 처리합니다:

- **Manifest** — 범위(granularity)·임계값(cap)·binding을 *지휘*. ⚠️ counter를 직접 write하지 않음 (governance plane 보호).
- **STATEFUL Element** — counter 저장·read·judge·commit을 *실행*. `onTransfer` hook(§2 예약)이 여기 쓰임.
- **Router** — swap 성사 후 commit 호출.

ERC-3643 `MaxBalanceModule`이 발행 측의 동일 패턴 선례입니다.

---

## 7. 무엇이 아직 움직이나 (잠정)

전수 Element 목록을 지금 확정본으로 드리지 않는 이유:

- 현재 pool은 **Reg D 506(c) + Reg ATS 기준**으로 도출됐습니다.
- 진행 중인 **유통규제(시장행위 — 사기·시세조종·내부자거래 → F-02·F-03 계열)** 와 **중개업자·거래소 규제(entity-level 경계)** 리서치가 합류하면, 새 Element 카테고리·entity 층이 들어와 목록이 *구조적으로* 바뀔 수 있습니다.
- 따라서 지금 build는 **인터페이스 + 3-axis 분류틀**에 하시고, 개별 Element는 *registry에 등록으로 확장*하는 걸 권합니다(OCP). 확정 전수 목록은 freeze 시점에 별도로 드리겠습니다.

---

*문의: 승준. 확정 Element 전수 spec은 유통규제·중개업자 규제 리서치 마무리(아키텍처 freeze) 후 별도 공유.*
