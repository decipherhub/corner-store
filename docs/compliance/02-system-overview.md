# Decipher RWA DEX — 전체 조감 보고서 (공유판)

> 프로젝트 전체 그림을 한 문서로 잡기 위한 보고서입니다. 6월 첫 주의 아키텍처 정밀화 작업 (Recipe 개념 재정의 + Manifest layer 추가)이 반영된 최신판입니다. 함께 공유되는 **「프로젝트 목표 → 설계 원칙 → 구현」** 문서를 먼저 읽고 오시면 이 문서가 더 빨리 읽힙니다.
>
> **지난 버전 (5/27) 대비 변경 핵심 4가지**:
> 1. 거래 측 compliance가 **3-Layer → 4-Layer**로 — Manifest layer가 Recipe와 Operator 사이에 추가되었습니다. layer는 번호가 아니라 **이름**으로 부릅니다 (Element / Recipe / Manifest / Operator)
> 2. Recipe 개념 재정의 — "Reg D Recipe 하나"가 아니라 **한 거래에 최대 7개 Recipe가 동시에 (cumulative)** 작동하는 구조입니다
> 3. Element pool이 **18 → 41**로 확장되었습니다 (외부 변호사 피드백 검토 + 미국증권법 조문 검토 누적 반영)
> 4. 개발팀 아키텍처 (Corner Store)와의 정합 분석 완료 — 변경 필요 사항은 **수정 요청서**로 별도 전달합니다 (수용 여부·구현 방식의 결정 권한은 개발팀에 있습니다)

읽는 순서: §0 요약 → §1 결정 경위 → §2 아키텍처 → §3 Element → §4 작동 시연 → §5 Phase·후속. 시간이 없으시면 §0만 읽어도 그림은 잡힙니다.

---

## 0. Executive Summary — 한 페이지

### 우리가 만드는 것

**Giwa 체인 위에 ERC-3643 호환 RWA DEX (Corner Store)** — 발행 측에서 ERC-3643이 풀어놓은 *token-level compliance* 위에, *거래 측 compliance*를 4개의 layer로 얹는 구조입니다.

### 핵심 한 문장

> **"ERC-3643은 token transfer eligibility를 해결하고, 우리 compliance layer는 market access eligibility를 해결한다."**

ERC-3643은 발행 측에서 "이 토큰을 누가 받을 수 있나"를 풀었습니다. 우리는 거래 측에서 "이 시장에 누가 어떻게 참여할 수 있나"를 풉니다. 두 layer는 겹치지 않고 보완합니다.

### 4-Layer 구조 (이름 기반)

- **Element layer** — 제재·국적·적격투자자 같은 *원자적 검증 단위*. 전체 pool **41개** (Required 19 + 조건부 1 + Optional 18 + 타규제 확장용 3). 특정 Recipe에 종속되지 않는 **공유 라이브러리**입니다.
- **Recipe layer** — 규제 framework별 *Element 조합 + 활성화 logic*. 핵심 인식 전환: 한 거래에 Recipe **하나**가 아니라 **발행·재판매·펀드·행위·주법 5종의 Recipe가 동시에** 작동합니다. 예: BUIDL 매도 한 건에 최대 7개 Recipe.
- **Manifest layer** ⭐ 신규 — *토큰별로 어느 Recipe들이 attach되는지*를 관리하는 binding layer. "이 토큰은 Reg D 506(c)로 발행됐고, §3(c)(7) 펀드이고, RFQ·오더북만 지원한다" 같은 **토큰의 컴플라이언스 신상명세서**입니다. 현재 구현의 TokenRecipeMapping (TRM)이 이것의 원시형입니다.
- **Operator layer** — 유통시장 규제 (Reg ATS·broker-dealer·시장 운영) 영역. 디사이퍼 단계에서는 spec 정의만 하고, Phase 3 운영주체 합류 시 본격 가동됩니다.

### 1차 자산군·라이선스 path (변경 없음)

미국 Reg D 506(c) RWA — BlackRock BUIDL·Ondo USDY·Maple류. 라이선스 path는 **Reg D 506(c) + Reg ATS + Covered UI Provider exemption (2026-04-13)** 조합이고, 2025-03 SEC No-Action Letter (적격투자자 검증 단순화)가 결정적 배경입니다.

### 포지셔닝 (5/27 회의 결정)

**SDK 주 product + Demo DEX 시연.** Recipe가 조합 가능한 라이브러리 구조가 되면서 이 포지셔닝이 더 강해졌습니다 — "단일 하드코딩 Recipe가 아니라 조합 가능한 Recipe 라이브러리"가 SDK의 core differentiator입니다.

### 설계 철학 (5 명제)

① 스마트 컨트랙트는 계산기가 아니라 **문지기** ② 무거운 연산·민감 정보·판단은 **오프체인, 온체인은 검증만** ③ 단일 관리자 키 금지 — **multi-sig·직무 분리** ④ 자동화 + 격벽화 + 합의 기반 통제의 **다층 방어선** ⑤ 위반 거래는 실행 단계에서 **즉시 revert (사전 차단)**.

### Protocol Portability — *core differentiation* (2026-06-09 추가)

본 4-Layer architecture의 *unique value proposition*은 **protocol-level invariance + business-level adaptability**입니다. *Element·Recipe·Manifest·Router는 *jurisdiction·entity·custody-model agnostic*. *legal entity (한국 LLC·US Delaware LLC·Foundation·DAO 등)·custody model (Non-Covered Firm·기관용 외부 custody·Hybrid)·mainnet chain·jurisdiction이 *어떻게 결정되어도 *동일 protocol 작동*. 이 분리가 *기존 RWA platforms와의 *근본 차이입니다 — 기존 platforms는 *protocol과 *business structure가 *tightly coupled*하여 *각 jurisdiction·entity마다 *별도 implementation 필요했음*. *Decipher는 *open infrastructure로 *재사용 가능* + *future framework evolution에 *robust*.

---

## 1. 결정 경위 (타임라인)

| 시점 | 결정·작업 |
|------|---------|
| 5/15 | Canton → **Giwa 체인** 전환 (EVM 호환 — ERC-3643 컨트랙트 그대로 deploy 가능) |
| 5/20 회의 | ERC-3643 only + 네이티브 발행만 / MVP = "compliance layer가 돌아간다는 것 시연" / 운영주체는 통과 후 조정 |
| 5/23~29 | 라이선스 path·Element 후보 도출 + 외부 변호사 피드백 (Element 15개 추가 제안) 조문 검토 — 수용 9·부분 3·보류 3·반려 0 |
| 5/27 회의 | **SDK 주 product 포지셔닝 전환** |
| 6/3~8 | **아키텍처 정밀화**: 개발팀 doc 정합성 리뷰 + T-REX 코드 정독 → Recipe 개념 재정의 (Multi-Recipe) → Manifest layer 발견·검증 → Element pool 41 확정 → 본 보고서 갱신 |

6월 정밀화의 핵심 결론 두 가지: ① 개발팀의 현재 설계 (Router + TRM + Element/Recipe 분리)는 **뼈대가 정합**하며, 이번 변경은 *재설계가 아니라 2개 patch* (TRM 확장 + Router orchestration)로 수용 가능합니다. ② 검증·결정이 필요한 사항들은 **수정 요청서**로 정리해 전달합니다 — 수용 여부와 구현 방식은 개발팀이 결정합니다.

### Phase 정의 (Gasok 매핑)

| Phase | 시점 | 작업 |
|-------|------|------|
| Phase 1·2 (디사이퍼) | 5~7월 | Element spec + Manifest v1 + testnet PoC |
| Phase 3 (운영주체 합류) | 8~9월 | private mainnet + audit + Reg ATS 준비 |
| Demoday | 10월 KBW | VC 피칭 |

---

## 2. 통합 Architecture — 4-Layer 작동 흐름

### 2.1 4-Layer 그림

```
┌────────────────────────────────────────────────────┐
│ Operator layer — DEX 운영주체 영역                    │
│ • 시장 운영 의무 (모니터링·보고·기록)                  │
│ • Reg ATS 등록·공시                                  │
│ • Listing·Element·Recipe·Manifest 승인 (multi-sig)   │
│ • Phase 3 운영주체 합류 시 본격 가동                  │
└────────────────────────────────────────────────────┘
            ▼ 운영 결정을 manifest에 기록
┌────────────────────────────────────────────────────┐
│ Manifest layer ⭐ NEW                                │
│ • 토큰별 Recipe binding: "이 토큰에 어느 Recipes?"     │
│ • 토큰 compliance facts (발행 framework·펀드 여부·    │
│   지원 engine·관할 범위)                              │
│ • version 정책 (고정·자동승급·기존거래 보호)           │
│ • 현 구현 TokenRecipeMapping(TRM)의 확장형            │
└────────────────────────────────────────────────────┘
            ▼ "어느 Recipes가 활성화되는가?"
┌────────────────────────────────────────────────────┐
│ Recipe layer — 복수 Recipe 동시 작동                  │
│ • 내부 분류 5종: 발행·재판매·펀드·행위·주법            │
│ • 한 거래에 multiple Recipes (최대 7)                 │
│ • 각 Recipe = Element 조합 + 활성화 logic             │
└────────────────────────────────────────────────────┘
            ▼ "어느 Elements를 check하는가?"
┌────────────────────────────────────────────────────┐
│ Element layer — 원자적 검증 단위 (pool 41개)          │
│ • check() 표준 인터페이스                             │
│ • Recipe 비종속 공유 라이브러리                        │
└────────────────────────────────────────────────────┘
            ▼ on-chain identity 조회
┌────────────────────────────────────────────────────┐
│ ERC-3643 Identity Layer (발행 측 — 그대로 reuse)      │
│ • ONCHAINID + Identity Registry + Claim Issuer        │
└────────────────────────────────────────────────────┘
```

위로 갈수록 운영주체 책임이 커지고, 아래는 자동·표준 영역입니다. **Manifest layer가 새로 들어온 이유**: 기존에는 "이 토큰에 어떤 Recipe가 적용되는가"라는 정보의 관리 주체가 명시되지 않았습니다 (TRM이 1:1 매핑으로 일부만 담당). 복수 Recipe 구조에서는 토큰마다 Recipe 조합·버전·정책이 달라지므로, 이를 묶는 binding layer가 필수가 됩니다.

### 2.2 Layer별 책임 분배

| Layer | 책임 주체 | Phase별 역할 |
|-------|--------|-----------|
| ERC-3643 Identity | 발행자 + ONCHAINID 생태계 | 우리 작업 X (그대로 활용) |
| Element | 발행자/제3자 제안 + DEX 승인 | 디사이퍼 spec·구현 |
| Recipe | 발행자 제안 + DEX 승인 | 디사이퍼 spec·구현 |
| **Manifest** | **발행자 선언 + DEX 검증·승인 (양측)** | **디사이퍼 spec + 개발팀 수정 요청** |
| Operator | DEX 운영주체 단독 | Phase 3 합류 시 본격 |

### 2.3 swap 시점 작동 sequence

사용자가 "BUIDL을 USDC로 swap"을 요청한다고 가정합니다.

```
[User] ──swap(BUIDL, USDC, amt)──▶ [ComplianceRouter (유일 진입점)]
                                        │
                                        │ 1. Manifest 조회 (구 TRM 조회의 확장)
                                        ▼
                              [Manifest: BUIDL의 신상명세서]
                              발행 = Reg D 506(c) · 펀드 = §3(c)(7)
                              지원 engine = {RFQ, 오더북}
                              허용 재판매 path = {Rule 144}
                                        │
                                        │ 2. 적용 Recipes 식별
                                        │    (manifest facts × 거래 상황)
                                        ▼
                              [Recipe 동시 실행 — cumulative]
                              ├─ 발행: Reg D 506(c) Recipe
                              ├─ 재판매: Rule 144 Recipe
                              │    └─ (매도자가 affiliate면 추가 요건 자동 활성화)
                              ├─ 펀드: §3(c)(7) Recipe → 적격매수자 검증
                              ├─ 행위: engine 적합성 검증
                              └─ 주법: (Phase 3)
                                        │
                                        │ 3. 활성화된 Element 전부 합집합
                                        │    → 모두 통과해야 (AND) 실행
                                        ▼
                              [모두 통과 → Pool.swap 실행]
                              [하나라도 실패 → 사유 코드와 함께 거부]
                                        │
                                        ▼
                              [ERC-3643 transfer 시 발행 측 2차 검증 자동 발동]
```

일반 ERC-20 (manifest 미등록) 토큰은 1번 조회에서 곧바로 빠져나가 검사 없이 Pool로 갑니다 (early exit — 기존 구현 유지). 발행 측 2차 검증은 우리가 호출하지 않아도 ERC-3643 토큰이 자기 transfer 안에서 스스로 수행합니다 — 거래 측 사전 검사와 발행 측 검증의 *이중 안전망*입니다.

**단, 이중 안전망이 "같은 것을 두 번 검사한다"는 뜻은 아닙니다.** 발행 측이 이미 검증하는 사실 (수신자 자격 claim 등)은 거래 측이 재검사하지 않고 그대로 신뢰하며, 거래 측은 발행 측이 *구조적으로 볼 수 없는 것* — 매도자 측 (발행 측 검증은 수신자만 봅니다)·거래 맥락 (재판매 path·engine·금액 요건)·시장 행위 — 만 추가합니다. manifest에 발행 측 검증의 커버 범위를 기록해 두면 Router는 빠진 부분만 검사합니다. 결과적으로 "이중 검사"가 아니라 **분담 검사**가 되고, gas 비용과 심리스한 거래 경험 모두 여기서 확보됩니다.

**판단이 필요한 영역의 처리 방식**도 같은 맥락입니다 — 시세조종 의심처럼 코드가 판정할 수 없는 것은 시스템이 패턴을 *표시 (flag)*만 하고, 컴플라이언스 담당자가 오프체인에서 조사·판단합니다. 그 결론 (예: 특정 주소 동결)은 두 지점만 통제하면 안전하게 시스템에 들어옵니다: ① *누가 동결 목록에 올릴 수 있나* (권한 있는 multi-sig만 — 아무나 경쟁자를 동결시키는 공격 차단) ② *거래 때 목록을 확인* (저비용 단순 조회). 은행으로 치면 본점 심사부가 블랙리스트를 관리하고 창구는 조회만 하는 구조 — 그리고 이건 새 장치가 아니라 **ERC-3643이 화이트리스트에 이미 쓰는 패턴** (KYC 업체만 등재 + transfer 때 확인)을 거래 측에 재사용하는 것입니다.

### 2.4 온오프체인 하이브리드 — 이 구조가 비결정론·고성능을 동시에 수용하는 이유

4-Layer가 *확장*을 담당한다면 (새 규제 = Recipe 등록), **온오프체인 하이브리드는 그 확장이 실제로 작동하게 하는 직교 축**입니다. 온체인에 두면 안 되는 것이 두 종류이기 때문입니다 — ① 코드가 *판정할 수 없는 것* (시세조종 판단·법률 해석 = 비결정론), ② 온체인에 *부적합한 것* (대량 연산·민감 정보·고성능 처리). 둘 다 오프체인에서 처리하고, **온체인은 결과를 검증·게이팅·집행만** 합니다.

| 무엇을 | 어디서 | 온체인의 역할 |
|--------|--------|-------------|
| 결정론적 검증 (제재·자격·보유기간·금액) | 온체인 | 직접 판정·즉시 차단 |
| 판단 (시세조종·법률 해석) | 오프체인 (담당자·전문가) | 결론(동결·승인 등 상태)만 받아 게이팅 |
| 대량 연산·민감 정보·고성능 | 오프체인 (고성능 시스템) | 결과·해시만 받아 무결성 검증 |

세 경우 모두 온체인으로 들어오는 통로는 **진입점 통제 (modifier = 관문)** 하나로 통일됩니다 — 권한 있는 주체의 서명만 통과시키고, 거래 시점에 그 결과를 참조합니다. swap이 거치는 hot path에는 가벼운 조회·검증만 남기고, 무거운 정보 (심사 근거·법률 문서)는 오프체인 보관 + 해시로 무결성만 온체인에 고정합니다 (앞서 manifest의 full 정보를 오프체인에 두고 해시만 온체인에 anchor하는 것이 이 사례입니다).

결과적으로 감독·감사도 코드 전체가 아니라 *이 진입점*만 보면 됩니다. 그리고 이 구조 덕분에 — 새 규제에 시세조종 판단 같은 비결정론적 요소나 무거운 연산이 섞여 있어도, 그 부분을 오프체인으로 빼고 결과만 받으면 되므로 *시스템 재설계 없이* 수용됩니다. (구체적으로 어떤 오라클·어떤 오프체인 인프라를 쓸지는 구현 단계의 문제이고, 여기서는 구조적 원리만 고정합니다.)

---

## 3. Element Pool 41개 — 한눈에

### 구성

| 구분 | 수 | 내용 |
|------|---|------|
| **Required 19** (Phase 2 MVP) | 19 | 투자자 자격 (제재·국적·적격투자자·affiliate 여부·법인 검증·자격 유효기간 등) + 자산 (manifest 정합·토큰 표준·양도제한 표시·engine 선택) + 재판매 (면제 path 선택·보유기간) + 발행자 (Form D 신고·결격사유·공시) |
| **조건부 1** | 1 | 적격매수자 (Qualified Purchaser) — §3(c)(7) 펀드 자산 (BUIDL류) 거래 시에만 활성화. *manifest의 펀드 여부 fact가 trigger* |
| **Optional 18** | 18 | Reg S·144A·affiliate 세부 의무·공시·시장감시·공매도 등 — 대부분 Phase 3 활성화 |
| **타규제 확장용 3** | 3 | holder 수 상한·발행총액 상한·주별 신고 추적 — 다른 규제·Phase 3용 |

### 핵심 포인트 둘

① **affiliate 여부가 gating의 첫 분기점**입니다 — 매도자가 affiliate (임원·10%+ 주주 등)면 Rule 144의 추가 의무 4종이 연쇄 활성화됩니다. ② Element는 법조문에서 *4단계 연역* (법조문 → 요건 분해 → 원자적 검증 단위 → 인터페이스)으로 도출되므로, 변호사는 앞 2단계를, 개발자는 뒤 2단계를 각자 검증할 수 있습니다. Element별 상세 spec은 별도 자료로 관리 중입니다 (요청 시 공유).

---

## 4. 작동 시연 — 한 거래에 복수 Recipe가 동시에 작동한다는 것

### 4.1 왜 "Recipe 하나"가 아닌가

하나의 증권이 거래될 때 여러 규제가 *동시에* 적용되기 때문입니다 — 그 자산이 *어떻게 발행*되었는가 (발행 규제), 이 거래가 *재판매로서 적법*한가 (재판매 면제), 자산이 *펀드 형태*인가 (투자회사 규제), *어떤 엔진·행위 규제*가 걸리는가, *어느 주의 의무*가 있는가. 어느 하나만 통과해서는 적법하지 않습니다.

### 4.2 시나리오 — "김 부장의 BUIDL 매도" (가상 사례)

BlackRock 임원인 가상 인물 "김 부장"이 BUIDL $100K어치를 RFQ로 기관 마켓메이커에게 매도합니다.

```
거래 1건: 김 부장 (BlackRock 임원 = affiliate) → 기관 MM (적격매수자)
          BUIDL $100K · RFQ 엔진 · 보유 6개월

[Manifest 조회] BUIDL = Reg D 506(c) 발행 + §3(c)(7) 펀드 + RFQ·오더북 지원

활성화되는 Recipes (7):
 ① 발행: Reg D 506(c)            ← manifest fact
 ② 재판매: Rule 144              ← 거래 상황 (secondary)
 ③ 재판매-추가: Affiliate 요건    ← 거래 상황 (매도자 = 임원) ⭐
 ④ 펀드: §3(c)(7) → 적격매수자    ← manifest fact (상대방 검증)
 ⑤ 행위: engine 적합성            ← affiliate 매도라 AMM 차단,
     RFQ는 Rule 144가 허용하는 "market maker 직접 매도"와 정확히 부합
 ⑥ 행위: 시장감시                 ← Phase 3
 ⑦ 주법: 주별 신고                ← Phase 3

→ 활성 Element 23개 합집합 → 전부 통과 (AND) 시에만 체결
```

이 시나리오가 보여주는 것: ⑤에서 **엔진 선택 자체가 법적 판단**입니다. affiliate 매도는 AMM에서 곧바로 규제 위반 위험이 있지만, RFQ는 법이 허용하는 경로와 정확히 부합합니다. 이런 Recipe 간 조정이 복수 Recipe 구조의 실전 가치입니다.

### 4.3 확장 — "새 규제 = 새 등록"

EU·한국 등 다른 규제 대응 시 기존 Element를 재사용하고 신규 2~3개만 더해 *새 Recipe 하나를 등록*하면 됩니다. 신규 자산 listing은 *manifest 등록*으로 단일화됩니다. 코드 변경 없이 데이터 등록만으로 확장된다 — 이것이 SDK 포지셔닝의 기술적 근거입니다.

---

## 5. Phase별 운영 + 후속 작업

### 5.1 개발팀 수정 요청 예정 (요약 — 상세는 수정 요청서)

결정 권한은 개발팀에 있으며, 아래는 compliance 측 요구사항 + 근거입니다:

| # | 항목 | 한 줄 내용 |
|---|------|----------|
| 1 | TRM → Manifest 확장 | `토큰 → recipe 주소 1개` 매핑을 `토큰 → manifest 구조체` (발행·펀드·재판매 path·engine·버전)로 |
| 2 | Router 복수 Recipe 실행 | 단일 recipe 호출 → 적용 Recipes 식별 + 합집합 검사 loop |
| 3 | 취득시점 기록 장치 (공동 설계) | Rule 144 보유기간의 데이터 출처가 ERC-3643에 없음 — 별도 기록 설계 필요 |
| 4 | Element 인터페이스에 기록용 hook 자리 예약 | 향후 누적 추적형 Element (거래량 한도 등) 대비 |
| 5 | 거부 기록 정책 | revert 시 audit trail이 사라지는 문제 — 거부 기록 보존 방식 결정 |

### 5.2 변호사 검토 (진행 예정)

복수 Recipe 구조의 법적 유효성, manifest 선언·검증의 책임 구조, affiliate 엔진 분기, KYC 의존 구조의 AML 적합성 등 핵심 질의를 미국 변호사 검토로 위임 예정입니다. 한국법 영역 (운영주체가 한국 법인일 경우 등)은 승준이 직접 검토합니다.

### 5.3 운영 워크플로우

Listing 신청·승인 / 사용자 onboarding / swap / 자격 변경 / Element 등록 / 자산 정지·상장폐지 / 분쟁 / 규제 변경 대응 — 8개 워크플로우의 단계별 상세 자료가 별도로 있습니다 (요청 시 공유). Phase 1·2에서 실제 가동되는 것은 Listing과 swap (testnet 수준)이고, 나머지는 spec 정의 후 Phase 3 이관입니다.

---

## 6. 열려 있는 결정 항목

| # | 항목 |
|---|------|
| 1 | 첫 자산군 시연 대상 (BUIDL 모방 / USDY / 가상 자산) |
| 2 | AMM vs 온체인 오더북 우선순위 (affiliate 매도는 AMM 불가가 법적으로 확인됨 — 순수 AMM 단독 노선은 사실상 배제) |
| 3 | KYC vendor 선정 |
| 4 | Manifest 적용 단위 (토큰 단위 vs 토큰×venue 단위) |
| 5 | Manifest 공개 범위 |
| 6 | 운영주체 path |

---

*문의·이의: 승준 — 설계 상세 자료 (Element 목록·Recipe spec·거버넌스 절차·워크플로우)는 요청 시 공유합니다.*
