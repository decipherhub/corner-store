# 프로젝트 목표 → 설계 원칙 → 구현 (한 페이지)

> 이 문서 하나로 **왜 만들고 (목표) → 어떤 기준으로 (원칙 6) → 무엇으로 (구현)** 순서로 프로젝트 전체를 잡을 수 있게 정리했습니다. 설계 디테일이 아니라 "왜 이렇게 생겼는가"의 답입니다.

---

## 0. 프로젝트 목표 — 우리는 무엇을 만들고 있는가

### 문제 (왜)

공개형 블록체인 위에서 증권이 *적법하게* 유통될 수 있는 인프라가 아직 없습니다. **발행 측 표준 (ERC-3643 — "이 토큰을 누가 받을 수 있나")은 있지만, 거래 측 표준 ("이 시장에 누가 어떻게 참여할 수 있나")이 시장의 missing piece**입니다. 이 공백이 토큰증권 시장 유동성 병목의 한 축입니다.

### 제품 (무엇) — 주종 순서 주의

| 순위 | 제품 | 내용 |
|------|------|------|
| **주 product** | **DEX-level compliance 표준 + SDK** | Element (검증 단위) · Recipe (규제 조합) · Manifest (토큰별 적용)의 공개 라이브러리 — 어떤 DEX·운영주체든 가져다 쓸 수 있는 표준 (5/27 회의 포지셔닝 결정) |
| Reference 구현 | **Corner Store DEX** | Giwa (OP Stack L2) 위 ERC-3643 호환 RWA DEX — 표준이 실제로 돌아감을 증명하는 데모 |
| 1차 적용 | **미국 Reg D 506(c) RWA의 secondary 유통** | BlackRock BUIDL·Ondo USDY류. 라이선스 path = Reg D 506(c) + Reg ATS + Covered UI Provider exemption |

**정체성 한 문장**: *"ERC-3643이 token transfer eligibility의 표준이듯, 우리는 market access eligibility의 표준이다."*

### 성공 기준 (언제 성공인가)

1. **Phase 2** — testnet에서 "compliance가 돌아간다" 시연 (5/20 합의한 MVP 정의)
2. **Phase 3** — 운영주체 합류 + private mainnet + Reg ATS 준비
3. **장기** — *제3의 DEX·운영주체가 우리 SDK를 채택* (표준임의 증명)

---

## 1. 설계 원칙 6 — 목표를 지키는 기준

> 모든 설계 결정은 이 6개 중 하나 이상으로 소급되어야 하며, 어느 것에도 소급되지 않는 설계는 의심합니다.

### G1. 위반 거래는 체결되지 않는다 — *Compliance by Construction*

규제 위반을 사후에 적발·처벌하는 것이 아니라, **위반 거래 자체가 실행 단계에서 성립하지 않게** 만듭니다. 규제가 약관이 아니라 물리법칙처럼 작동하는 시장. (구현: 거래 시점 cumulative 검사 + 즉시 revert)

### G2. 이미 검증된 *사실*은 다시 검증하지 않는다 — 단, *의무*는 각자의 것 — *Build On, Don't Rebuild*

ERC-3643이 발행 측에서 이미 수행하는 검증 (수신자 자격·토큰 룰)은 **그대로 신뢰하고 위임**합니다. 거래 측은 발행 측이 *구조적으로 볼 수 없는 것* (매도자 측·거래 맥락·시장 행위)만 추가합니다. 같은 사실을 두 번 검사하지 않는다 — 심리스함은 여기서 나옵니다.

다만 한 가지 중요한 구분: 이 원칙은 **사실 (facts)의 중복 검증 제거이지 의무 (duties)의 면제가 아닙니다.** 같은 주제 (예: AML/KYC)라도 법이 각 수범자에게 별도로 부과한 의무 — 운영주체의 CIP·SAR reporting·기록보존 등 — 는 타인의 검증으로 사라지지 않습니다. **사실은 공유하되, 의무의 이행과 그 기록은 각자의 명의로 남깁니다** ("재검증 안 함 ≠ 기록 안 함").

### G3. 새 규제 대응은 코드 수정이 아니라 데이터 등록이다 — *Regulation as Data*

새 국가·새 규제·새 자산군이 와도 **시스템을 재설계하지 않습니다**. 검증 단위 (Element)는 표준으로 안정시키고, 규제 조합 (Recipe)과 토큰별 적용 (Manifest)을 *등록 가능한 데이터*로 둡니다. 법이 바뀌면 버전이 올라가고, 기존 거래는 보호됩니다. (구현: "1개 법률효과 = 1개 Recipe" 단위 기준 + Element 신설 최소주의 + versioning·grandfather)

### G4. 무거운 것·못 푸는 것은 오프체인, 온체인은 검증·집행만 — *Hybrid by Design*

온체인에 두면 안 되는 것이 두 종류 있습니다 — ① 코드가 *판정할 수 없는 것* (시세조종 판단·법률 해석 = 비결정론), ② 온체인에 *부적합한 것* (대량 연산·민감 정보·고성능 처리). 둘 다 오프체인에서 처리하고, **온체인은 그 결과를 검증·게이팅·집행만** 합니다. 누가 그 결과를 입력할 수 있는지는 권한으로 통제하고 (multi-sig·직무 분리), 어떤 단일 주체도 시스템을 마음대로 바꿀 수 없습니다. (구현: 입력 게이트 + 참조 게이트의 이중 modifier — ERC-3643의 `onlyIdentityManager` + `isVerified` 패턴과 같은 구조)

### G5. 각자의 의무는 각자에게, 경계는 기록으로 — *Self-Responsibility by Design*

**발행인은 토큰이 적법하게 존재할 책임, DEX는 시장이 적법하게 작동할 책임**을 집니다. 서로의 영역을 대신 검증하지 않으며 (책임 전가·비용 중복 방지), 누가 무엇을 선언·검증·승인했는지가 온체인에 남아 분쟁 시 책임 귀속이 기록으로 증명됩니다. (구현: Manifest = 발행인 선언 + DEX 검증·승인 + 커버 범위 기록)

### G6. n번째 참여자는 첫 번째보다 싸야 한다 — *Declining Cost of Compliance*

표준은 **채택되어야 표준**입니다. 첫 발행자의 등록 비용은 불가피하게 높아도, 두 번째부터는 검증된 Recipe·manifest 템플릿 재사용으로 급감해야 하고, 사용자는 KYC 한 번으로 시장 전체에 접근해야 합니다. 비용이 채택을 죽이는 순간 규제 준수도 함께 죽습니다. (구현: 표준 Recipe 재사용 시 심사 생략 + onboarding 일괄 등록 중개)

---

## 2. 구현 — 원칙이 어디에 박혀 있는가

```
[목표]  market access eligibility의 표준 (SDK) + reference DEX
   │
[원칙]  G1~G6 — 목표를 지키는 6개 기준
   │
[구현]  4-Layer compliance stack (ERC-3643 위에)
   │
   ├─ Element layer   — 원자적 검증 단위 (표준 라이브러리)        ← G2·G3
   ├─ Recipe layer    — 규제 조합 (한 거래에 복수 Recipe 동시 작동) ← G1·G3
   ├─ Manifest layer  — 토큰별 적용·선언·커버 범위 기록            ← G3·G5
   ├─ Operator layer  — 판단·승인·감시 (제한적 중개인)             ← G4·G5
   └─ 거버넌스        — 등록 심사·multi-sig·versioning             ← G4·G3

   ※ 위 stack은 ERC-3643 위에 얹히고, 그 전체가
     [온체인 = 검증·게이팅] ↔ [오프체인 = 판단·대량 연산]의
     하이브리드 구조로 동작 — 진입점(modifier)으로만 연결 (§4)
```

## 3. 공학적으로는 — "확장에 열리고, 수정에 닫힌다" (OCP)

이 설계가 도달하려는 상태는: **규제·자산·국가가 변해도 시스템 코드는 수정하지 않고, 등록으로 확장**하는 것입니다.

| 변경 유형 | 대응 (확장점) |
|----------|-------------|
| 새 규제·새 국가 | Recipe 신설 + manifest 등록 |
| 새 토큰 listing | Manifest 등록 |
| 새 검증 단위가 필요한 새로운 사실 유형 | Element 신설 (단, 기존 재사용 우선 — 신설은 최후 수단) |
| 법 개정 | Version (기존 listing은 grandfather 보호 가능) |
| 코드가 판정 못 하는 사례 | 운영주체 판단 → 권한 통제된 온체인 상태 입력 |
| **Router 로직·Element 인터페이스·4-Layer 구조 자체** | **닫힘 — 수정 불요** |

한 가지 특수성: 일반 소프트웨어의 확장은 개발자가 하지만, 여기서는 **확장 (새 Element·Recipe 등록) 자체가 규제 관련 행위라서 심사 절차를 거칩니다**. "확장에 열려 있되, 열린 문에 문지기가 있다" — 이것이 규제 인프라에서의 OCP입니다.

### *Protocol Portability — *OCP의 *third dimension* (2026-06-09 추가)

OCP가 *protocol-level extension의 *원칙이라면, **Protocol Portability는 *protocol-level *invariance + business-level *adaptability의 *boundary*입니다. *Element·Recipe·Manifest·Router 자체는 *jurisdiction·entity·custody-model agnostic*. *Layer 4 (Operator)가 *legal entity·custody model·mainnet chain 등 *business decisions를 *encapsulate하여 *core protocol에 *비침투*. 

| 변경 유형 | OCP 측면 | Protocol Portability 측면 |
|----------|------|------|
| 새 규제·새 국가 | Recipe 신설 + manifest 등록 | *protocol 변경 없음 — *Recipe Layer 5 + Element extension만 |
| 새 entity 형태 | (해당 없음) | *protocol 변경 없음 — *Layer 4 decisions가 *protocol에 *비침투* |
| 새 custody model | (해당 없음) | *protocol 변경 없음 — *ACM Field 3 facts에 *encoded* |
| 새 mainnet chain | Router orchestration configuration | *protocol 변경 없음 — *configuration 차원 |

→ ***Decipher의 *core differentiation*: *Securitize·tZERO·INX는 *protocol과 *business structure가 *tightly coupled하여 *각 jurisdiction·entity·custody마다 *별도 implementation 필요. *Decipher는 *동일 protocol을 *모든 jurisdiction·entity·custody에서 *재사용 가능 — *open infrastructure value proposition***.

## 4. 직교하는 두 번째 축 — 온오프체인 하이브리드 (비결정론·고성능 수용의 근간)

OCP가 "변경을 어떻게 흡수하는가"의 축이라면, **온오프체인 하이브리드는 "무엇을 온체인에 두고 무엇을 빼는가"의 축**입니다. 이 두 축은 직교하며, 두 번째 축이 있어야 OCP로 흡수한 확장이 *실제로 작동*합니다 — 새 규제를 Recipe로 등록해도, 그 규제에 시세조종 판단 같은 비결정론적 요소나 무거운 연산이 섞여 있으면 온체인만으로는 담을 수 없기 때문입니다.

원리는 하나입니다: **온체인은 문지기, 무거운 연산·판단은 오프체인.**

| 무엇을 | 어디서 | 온체인의 역할 |
|--------|--------|-------------|
| 결정론적 검증 (제재·자격·보유기간·금액) | 온체인 | 직접 판정·즉시 차단 |
| 판단 (시세조종·법률 해석 = 비결정론) | 오프체인 (사람·전문가) | 결론(상태)만 받아 게이팅 |
| 대량 연산·민감 정보·고성능 처리 | 오프체인 (고성능 시스템) | 결과·해시만 받아 무결성 검증 |

세 경우 모두 온체인으로 들어오는 통로는 **진입점 통제 (modifier = 관문)** 하나로 통일됩니다 — 권한 있는 주체의 서명만 통과시키고, 그 결과를 거래 시점에 참조합니다. 감독·감사도 코드 전체가 아니라 *이 진입점*만 보면 됩니다 ("프로세스 감사 → 데이터 감사"). manifest의 무거운 정보를 오프체인에 두고 온체인엔 해시만 고정하는 것이 이 원리의 한 사례입니다.

→ 그래서 이 시스템은 OCP(확장) + 하이브리드(분담)의 결합으로 **확장 가능하면서, 비결정론적 규제와 고성능 요구를 동시에 수용**합니다. *구체적 컴포넌트 구현(어떤 오라클·어떤 오프체인 인프라)은 다음 단계의 문제이고, 여기서는 구조적 원리만 고정합니다.*

## 한 문장 압축

> **"규제를 코드의 물리법칙으로 만들되 (G1·G4), 이미 있는 표준 위에 필수만 얹고 (G2), 새 규제는 등록으로 흡수하며 (G3), 책임은 각자에게 기록으로 귀속시키고 (G5), 쓸수록 싸지게 한다 (G6)."**

## 이 문서의 활용

- **설계 논쟁 시**: "이 선택이 어느 G를 희생하는가"가 트레이드오프 판단 기준
- **새 제안 검증**: 6개 중 어느 것에도 소급되지 않으면 재검토 후보
- **외부 설명 (발표·피칭)**: G2 (심리스)·G3 (확장성)·G6 (경제성)이 차별점

---

*문의·이의: 승준 — 설계 상세 자료는 요청 시 공유합니다.*
