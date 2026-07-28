---
type: system-spec
title: Corner Store — 컴플라이언스 SDK 시스템 스펙 (RWA DEX)
status: v0.1 (2026-07-22) — 현재 구현 스냅샷 + ADR-008 반영. production 상용 규격은 별도.
audience: 외부 개발자(SDK 온보딩)·개발팀·법무팀·외부 consultant
base: architecture/phase1-structural-decisions-proposed.md · compliance/matrices/legal-to-technical-matrix.md · methodology/legal-to-code-general-principles.md · decisions/ADR-001~008
created: 2026-07-22
tags: [system-spec, sdk, erc-3643, compliance-engine, onboarding]
---

# Corner Store — 컴플라이언스 SDK 시스템 스펙

> **이 문서가 뭔가.** 증권형 토큰(RWA)의 2차 거래가 *적법한지*를 거래 직전 코드가 자동 판정하는 **컴플라이언스 SDK**의 시스템 스펙이다. 개별 부품(Element)·규제 묶음(Recipe)·자산 명세(Manifest)는 각각 별도 문서로 상세화돼 있고(§3~5 링크), **이 문서는 그것들을 하나의 시스템으로 조망**한다.
>
> **누가 읽나.** ① 이 SDK 위에 올리려는 **외부 개발자·발행사**(SDK 온보딩) ② **개발팀**(구현 좌표) ③ **법무팀**(법 → 코드 매핑의 근거). 증권법 세부를 몰라도 *구조가 왜 이렇게 생겼는지* 이해되도록 썼다.
>
> **범위.** **현재 구현 스냅샷(Phase 1)** 중심 + **ADR-008(컴플라이언스 seam 결정)** 반영. 실제 상용(production) 규격은 법률검토 반영분이 커서 *별도로 확정*한다 — 본 문서는 그 델타를 §6~7·§10에 표시만 한다.

---

## 0. TL;DR (1분)

- **무엇:** *"누가·이 증권 토큰을·이 경로로 거래해도 적법한가"*를 **거래 직전 자동 판정**하는 준법 표준 + SDK. **ERC-3643 호환**.
- **타깃:** 미국 사모(**Reg D 506(c)**) 증권의 *2차 거래(전매)*. 1차 자산 = BlackRock **BUIDL** · 체인 = **Giwa** · 시장 = 미국.
- **핵심 명제:** **Element**(부품) 1개 = 법률요건 하나의 포섭 · **Recipe**(묶음) 1개 = 법률 하나의 소결론 · **한 거래** = 걸리는 모든 Recipe의 *cumulative AND*. **위반 거래는 체결되지 않는다.**
- **결정론 경계:** 온체인 모듈은 *판단하지 않고 verify만* 한다. *사실*(적격투자자·내부자·취득일)은 off-chain **Trusted Issuer**(Securitize=transfer agent, Sumsub=KYC)가 서명 claim으로 발급하고, 온체인은 그 claim의 진위(서명·발급자·만료)만 확인한다.
- **자산 무관(asset-agnostic):** 부품·Recipe는 BUIDL에 의존하지 않는다. 자산별 사실은 **Manifest**에만 산다(ADR-006).

---

## 1. 아키텍처 개요

### 1.1 4-Layer + Router + off-chain 데이터 레이어

```
Element  = 검사 부품 하나           (예: "적격투자자인가" A-03)         → ElementRegistry      (= ERC-3643 IModule)
Recipe   = 부품 조합 = 규제 하나    (예: Reg D 506(c) = 부품 묶음)      → RecipeRegistry
Manifest = 자산별 "어느 Recipe 켜나" 선언 (자산 신상카드)              → TokenPolicyRegistry
Operator = 사람 판단·감시·거버넌스  (자동 못 하는 것)                   → OperatorRegistry
────────────────────────────────────────────────────────────────────────────
Layer 5  = off-chain 컴플라이언스 데이터 레이어 (ADR-008)              → 취득·집계·거절로깅·감시
```

발행자가 우리 Element(`IModule`)를 `addModule`로 토큰에 바인딩한다. 무거운 *판정*은 off-chain, 온체인은 가볍게 *검증*만.

### 1.2 거래 한 건의 흐름 (모듈 관점)

```
transfer(A→B) 시도
  → Router: 이 자산 Manifest 읽음 → 걸리는 Recipe 집합 식별
  → R-XJ(제재·관할 always-on) → R2(재판매 §4(a)(7)) → R3(펀드 §3(c)(7)) → R4(감시)
  → 각 Recipe의 부품 union, 전부 통과(cumulative AND)면 체결, 아니면 revert(사유코드)
  → 체결 후: 무엇에 의지했는지 기록(reliance-log) + 의심거래는 Operator에 flag + Layer 5 상태 갱신
```

### 1.3 on-chain vs off-chain 경계 (핵심 원칙)

| 온체인이 하는 일 (결정론) | off-chain이 하는 일 (판단) |
|---|---|
| claim의 진위 확인(서명·발급자·만료) | *사실* 자체의 판정(적격투자자·내부자·취득일) |
| 세고·비교하고·갱신(카운터) | *누가 한 명인지*의 산정 규칙(held-of-record·look-through) |
| Manifest 값 적용·Recipe 라우팅 | 시장감시·사기탐지·SAR (통계·사후) |
| 성공 거래 이벤트 | 거절 거래 로깅(revert는 온체인 이벤트를 롤백하므로) |

> 상세 원리: `methodology/legal-to-code-general-principles.md`.

---

## 2. 핵심 개념

### 2.1 Element (부품)
법률요건 하나를 포섭하는 최소 검사 단위. ERC-3643 `IModule`로 구현. **공유 라이브러리** — 여러 Recipe가 재사용하며, update governance는 Element 단위(§9). 검증 패턴 3종:

- **패턴 A (기계 직접판정):** 코드가 결정론적으로 판정 (예: A-01 제재명단 대조, C-01 보유기간 계산).
- **패턴 B (증명서 확인):** Trusted Issuer의 서명 claim을 verify (예: A-03 적격투자자, A-13 QP).
- **패턴 C (감시·flag):** 막지 않고 의심거래에 깃발 → Operator 판단 (예: F-02 시장감시).

### 2.2 timing — 언제 검사하나
- **pre-trade gate:** 거래 직전 스냅샷 검사(대부분). 실패 → revert.
- **post-trade commit:** 체결 후 상태 갱신(B-01 정합·D-01/C-08 카운터).
- **post-trade flag:** 체결 후 감시 깃발(F-02·F-03) — *차단기 아님*.

### 2.3 STATELESS vs STATEFUL
대부분 부품은 *거래 시점 스냅샷*만 보는 STATELESS. **STATEFUL**(상태 누적) 부품은 **D-01(보유자 수)·F-02·F-03(감시 패턴)·C-08(물량, 신규)** — 상태 키는 지갑이 아니라 **person-group**이다(§6.3).

### 2.4 Recipe (묶음)
법률 하나의 소결론을 만드는 부품 조합. 예: R1 = Reg D 506(c) 발행요건 = {A-01·A-02·A-03·…} 묶음.

### 2.5 Manifest (자산 명세)
자산이 *어느 면제로 발행됐나·어느 경로로 팔리나·펀드인가·어느 엔진·관할·보유상한*을 선언. 모든 부품·Router가 이걸 읽어 "내가 켜질지"를 정한다. 자산별 사실은 오직 여기에만(ADR-006 asset-agnostic 불변식) — 부품/Recipe 코드에 상수 하드코딩 금지(법령 상수 예외).

### 2.6 Engine (거래 mechanism)
AMM·OrderBook·RFQ. Manifest의 `supportedEngines` bitset이 자산별 허용 엔진을 선언, B-04가 검사.

---

## 3. Element 카탈로그 (요약 — 상세는 per-element 문서)

> Freeze v1(ADR-004) 기준 23종 + F-05(추가). 각 부품 상세 = `compliance/elements/<ID>_*.md`, 법→코드 배선 전체 = `compliance/matrices/legal-to-technical-matrix.md`.

| ID | 부품 | 도메인 | 패턴 | timing | 성숙도 |
|----|------|--------|------|--------|--------|
| A-01 | 제재명단(OFAC) | 신원·자격 | A | pre | ✅ |
| A-02 | 국가제한(jurisdiction) | 신원·자격 | A | pre | ✅ |
| A-03 | 적격투자자(accredited) | 신원·자격 | B | pre | ✅ |
| A-04 | 신원중복(dedup) | 신원·자격 | A | pre | ✅ |
| A-06 | 내부자(affiliate) | 신원·자격 | B+C | pre | ✅ |
| A-08 | 법인자격(entity) | 신원·자격 | B | pre | 🟡 |
| A-09 | look-through | 신원·자격 | B | pre | 🟡 |
| A-11 | 증명유효기간 | 신원·자격 | A | pre | ✅ |
| A-12 | 모름항변 차단 | 신원·자격 | C | pre | 🟡 |
| A-13 | 적격구매자(QP) | 신원·자격 | B | pre | ✅ |
| B-01 | Manifest 정합 | 자산·기술 | A | post-commit | ✅ |
| B-02 | 토큰표준(ERC-3643) | 자산·기술 | A | pre | ✅ |
| B-03 | 이전제한 메타 | 자산·기술 | A | pre | ✅ |
| B-04 | 엔진선택 | 자산·기술 | A | pre | ✅ |
| C-00 | 전매경로 선택기 | 경로·시점 | A | pre | 🟡 |
| C-01 | 보유기간(Rule 144) | 경로·시점 | A | pre | ✅ |
| **C-08** | **물량 한도(Rule 144(e))** | 경로·시점 | A+**STATEFUL** | post-commit | ⬜ **신규(ADR-008, 등재 대기)** |
| D-01 | 보유자 수 카운터 | 집계·누적 | A+**STATEFUL** | pre+post-commit | 🟡→✅(ADR-008) |
| E-01 | Form D 확인 | 발행자 측 | A | pre | 🟡 |
| E-03 | bad actor | 발행자 측 | A | pre | ✅ |
| F-01 | 자기거래 제한 | 행위·운영 | A | pre | 🟡 |
| F-02 | 시장감시 | 행위·운영 | C+**STATEFUL** | post-flag | 🟡 |
| F-03 | 사기감시(SAR) | 행위·운영 | C+**STATEFUL** | post-flag | 🟡 |
| F-04 | 판매중 매수금지(Reg M) | 행위·운영 | A | pre | ✅ |
| F-05 | 공매도(Reg SHO) | 행위·운영 | A | pre | (추가) |

> **C-08 주의:** Freeze v1 pool에 없던 신규 element. ADR-008 D-B가 규격을 정의하나 walkthrough는 미작성 → pool 등재(freeze 변경, governance)가 선행돼야 한다. §4(a)(7) 주경로엔 물량한도가 없어 **Rule 144 fallback·production용**(데모 비핵심).

---

## 4. Recipe 카탈로그

| Recipe | 법률효과(소결론) | 핵심 부품 | 조건부 |
|--------|-----------------|-----------|--------|
| **R1** Reg D 506(c) Issuance | §5 등록 면제 성립 | A-01·A-02·A-03·A-04·A-11·E-01·E-03·F-04·B-01·B-02·B-03 | A-08·A-09 |
| **R2** §4(a)(7)·Rule 144 Resale | §2(a)(11) underwriter 비해당 safe harbor | A-01·A-02·A-03·A-04·C-00·C-01·B-01·B-02·B-03 | A-06·A-12 (+ C-08: Rule 144 경로 시) |
| **R3** ICA §3(c)(7) Fund | 투자회사 등록 면제 | **A-13(QP)**·D-01·B-01 | A-08·A-09 |
| **R4** 시장행위 감시 | anti-fraud·시세조종 부재 추정(사후) | F-02·F-03·F-01·A-12 | A-06 |
| **R-XJ** Cross-Jurisdictional | 제재·관할·Reg M — 증권법과 독립·**always-on**(ADR-002) | A-01·A-02·F-04 | — |

### 4.1 결합 논리 (Router가 처리하는 5종 — PD-2)
1. **cumulative AND:** 걸리는 모든 Recipe의 부품 union, 전부 통과해야 체결.
2. **경로 OR:** R2 = §4(a)(7) *또는* Rule 144, 매도인이 하나 선택.
3. **역방향 flag:** R4는 막지 않고 의심거래에 깃발(별도 출력).
4. **fail-closed prefactor:** R-XJ는 맨 앞·불확실하면 차단.
5. **no-R2:** 재판매 제한 없는 자산(Reg A+ 자유양도)은 R2를 *안 붙임*.

> Element × Recipe 부착 매트릭스 전체 = `matrices/legal-to-technical-matrix.md §4`.

---

## 5. Manifest 스키마 (PD-1 — PROPOSED)

framework를 닫힌 enum이 아니라 **`bytes32` ID + ID→모듈 동적 dispatch**로 둔다. 새 framework 추가 = *모듈 배포+등록*, Manifest·Router **무수정**(ERC-3643 compliance-modules 패턴). → 회사채·Reg A+ 등 신규 자산을 골조 재작성 없이 수용.

```solidity
struct HolderCap { uint256 value; bytes32 basis; }   // basis==0 → no cap
struct Manifest {
    bytes32 issuanceFramework;  // keccak256("REG_D_506C")
    bytes32 fundExemption;      // 0x0 = None
    bytes32 resaleFramework;    // "FREELY_TRADABLE" 포함
    uint256 supportedEngines;   // bitset {AMM, OrderBook, RFQ}
    bytes32 jurisdictionScope;
    HolderCap holderCap;        // 예: {2000, keccak256("SEC_12G")}
}
mapping(bytes32 => IRecipeModule) public recipeModule;  // ← 확장 지점
```

> 상태: PD-1은 리걸/PM *방향* 비준, **개발팀 구현 합의(필드셋·키 컨벤션) 대기**. 상세 = `architecture/phase1-structural-decisions-proposed.md`.

---

## 6. off-chain 컴플라이언스 데이터 레이어 (Layer 5) — ADR-008

ADR-008이 확정한 4개 seam이 **하나의 off-chain 레이어 + Securitize(TA) 어댑터**로 수렴한다.

```
[Securitize TA] ──(취득/attestation)──▶ [Layer 5 · off-chain 컴플라이언스 데이터]
                                           ├─ 성공거래 + 거절 기록 (WORM/audit-trail)
                                           ├─ stateful 상태 (C-08 물량·D-01 보유자수, person-group 키)
                                           ├─ chain-wide transfer 감시 (out-of-router 탐지)
                                           └─ SAR/알림 생성, Operator 대시보드
[온체인]  발행측 whitelist/module (예방·baseline) + Router(venue 강제, 성공만 온체인)
```

### 6.1 취득 출처 — `IAcquisitionSource` (D-A)
Rule 144 보유기간(C-01)의 취득 데이터는 **온체인이 아니라 Securitize(발행사 TA)에서** 받는다. BUIDL은 whitelist형 ERC-20이라 *취득일이 온체인에 없다*. 어댑터(PD-4 경계)가 per-lot으로 요청:

| 필드 | 의미 | 근거 |
|------|------|------|
| `acquisitionDate` | issuer·affiliate 취득일 | Rule 144(d)(1) |
| `paymentCompleteAt` | 대금 완납일 | Rule 144(d)(1) full payment |
| `sourceType` | 취득 유형(PRIMARY/DIVIDEND/…) | Rule 144(d)(3) tacking 10종 |
| `lineageRef` | 승계형 원본 lot 참조 | Rule 144(d)(3) |

`clockStart = max(acquisitionDate, paymentCompleteAt)`; 승계형이면 lineage 승계. **⭐ BUIDL은 이자를 매일 새 배당토큰으로 지급** → 각 배당 lot의 tacking lineage가 취득 데이터 중 가장 까다로움. 어댑터는 **asset-agnostic 경계 뒤 per-TA 구현**(ADR-006) — Securitize는 BUIDL용 인스턴스.

### 6.2 stateful 카운터 (D-B)
- **C-08 (Rule 144(e) 물량):** 직전 3개월 rolling, 상한 = `max(발행량 1%, 4주 평균 주간거래량)`. **무거래 RWA → 1% outstanding**. 상한 *도달(=)*은 적법, *초과(>)*만 위반.
- **D-01 (보유자 수):** 상한 = held-of-record **< 2,000**(비-AI < 500), **FPI면 < 300**. **look-through 안 함, 법인=1**(§12(g) held-of-record — 자격판정과 반대 방향). → D-01의 최대 open issue(산정 규칙)를 ADR-008이 확정.
- **상태 키 = person-group:** Rule 144(a)(2) 기준 본인 + 동거친족 + 합산 10% 신탁/법인. 카운터는 지갑/personId가 아니라 **person-group** 단위 → 앞단에 A-06(control)·A-04(신원) identity graph 필수.

### 6.3 거절 로깅 (D-C)
거절 거래는 **off-chain indexer에 기록**(온체인 강제 이벤트는 OFAC 등 고위험만 선택적). revert가 온체인 이벤트를 롤백하므로 off-chain이 사유를 포착. **WORM/audit-trail(17a-4(f))**, SAR 생성 가능. 기록 필드: `timestamp·attemptTxRef·from/to·tokenIn/Out·amount·failedElement·reasonCode·attestedFacts·reliedExemption·riskTier`.

### 6.4 ⚠️ 권위 상태 vs 탐지 — 반드시 구분 (D-D ∩ PD-3)
- **권위 상태(authoritative) = TA attestation anchor.** 보유자수·물량 등 *gating에 쓰는 상태*의 진리원천. 외부 온체인을 스크래핑해 만들지 않는다(PD-3 "외부 온체인 추적 ❌").
- **탐지(detection) = chain-wide off-chain surveillance.** 토큰의 *chain-wide 모든 transfer*를 인덱싱해 우회·이상 패턴을 *탐지*(비권위) → Operator flag.
- **경계:** 감시는 chain-wide로 하되, 그 결과를 *권위 상태 source로는 쓰지 않는다*. (탐지 ≠ 예방, 탐지 ≠ gating.)

---

## 7. on-chain 예방 vs off-chain 탐지 / token-level vs venue-level (D-D)

router 밖 경로(직접 ERC-3643 transfer·직접 pool call)는 **두 층**으로 다룬다.

| 분류 | 어디서 강제 | 성격 | 해당 |
|------|-----------|------|------|
| **token-level** (모든 transfer 성립 조건) | 발행측 ERC-3643 module / whitelist | 예방·온체인·chain-wide baseline | OFAC(A-01)·KYC(발행측)·jurisdiction(A-02) |
| **venue-level** (거래소 맥락) | 우리 Router(router-path 강제) + off-chain 탐지 | 예방(venue 내)+탐지(venue 밖) | Rule 144 물량(C-08)·보유자수(D-01)·보유기간(C-01)·감시(F-02/F-03) |

- **예방(prevent) = 온체인, 발행측/venue.** BUIDL 등 whitelist 토큰은 Securitize가 *모든* transfer에서 whitelist 강제 → 비화이트리스트 우회 baseline 봉쇄. + **controlled venue**(§4(a)(7) 폐쇄 whitelist)면 직접우회 원천봉쇄.
- **탐지(detect) = off-chain, 우리 surveillance.** 우리 venue-level 강제는 router 밖에선 못 미침 → off-chain 감시가 chain-wide로 탐지·조치(suspend·SAR·발행자 통보).

> **설계 인사이트:** "중개 측에서 다 강제하려다 무거워졌다, 발행 측이 상위호환" (7/8 회의)을 구조화한 것 — token-level은 발행측 baseline이 chain-wide 강제, venue-level은 우리 router + off-chain 탐지.

---

## 8. 거래 생애주기 훅 (PD-7 — PROPOSED)

법개정·상장·상장폐지·incident가 작동하려면 4개 훅을 지금 박는다: ① 모듈 **version 필드** ② 변경 **append-only 연혁**(감사·소급) ③ **halt/freeze 능력** ④ **record 보존(불변·17a-4)** — 폐지돼도 기록 의무 survive. *우리 DEX 리스팅 폐지 ≠ 토큰 소멸*(타 venue 존속).

## 9. 거버넌스 (PD-6 — PROPOSED)

3층(모듈/Manifest/Trusted Issuer)을 *바꾸는 행위*는 **multisig(예: 2-of-3) + timelock(예: 24h)**. Element update governance도 Element 단위 동일.

---

## 10. Demo(mock) vs Production 범위 (ADR-008)

| seam | Demo (Gasok) | Production |
|------|--------------|-----------|
| 취득 출처 (D-A) | mock `IAcquisitionSource` | Securitize Connect API 통합 |
| 물량 C-08 (D-B) | 불요(§4(a)(7) 주경로) | Rule 144 fallback 시 stateful 구현 |
| 보유자수 D-01 (D-B) | mock/단순 카운터 | person-group 키 + held-of-record 산정 |
| 거절 로깅 (D-C) | off-chain 데모 로그 | WORM/audit-trail + SAR 파이프 |
| out-of-router (D-D) | 개념 시연 | off-chain surveillance 레이어 + controlled venue |

> 데모엔 mock으로 충분. 본 문서·ADR-008 = "정식 법률검토 완료, production 규격 확정"의 증빙.

---

## 11. 결정 참조 (ADR / PD 인덱스)

| ID | 무엇 | 상태 |
|----|------|------|
| ADR-001 | F-04 Reg M 판매중 매수금지 | ✅ Accepted |
| ADR-002 | R-XJ 횡단 always-on prefactor | ✅ Accepted |
| ADR-003 | 프라이버시·ZK-readiness | ✅ Accepted |
| ADR-004 | Element Pool Freeze v1 | ✅ Accepted |
| ADR-005 | §4(a)(7) 주 재판매경로·A-03 active | ✅ (general solicitation 판정만 변호사 잔여) |
| ADR-006 | 부품 asset-agnostic 불변식 | ✅ Accepted |
| ADR-007 | PD 아키텍처 결정(개발팀) | repo 존재 |
| **ADR-008** | **컴플라이언스 seam 4종(취득·카운팅·거절로깅·라우터밖)** | ✅ Accepted(2026-07-22) |
| PD-1~7 | Manifest 스키마·Router·상태·TA 파이프라인·자동/인간 경계·거버넌스·생애주기 훅 | 🟢 방향비준 · 구현합의 대기 |

---

## 12. Open Items (확인 필요)

| # | 항목 | 막는 것 |
|---|------|---------|
| Q1 | Securitize Connect API가 취득일+완납일+sourceType+배당 lineage 노출? | D-A production |
| Q2 | 실제 BUIDL이 FPI(BVI)인가 → holder 상한 < 2,000 vs < 300 | D-B |
| Q3 | BD/ATS 확정 시 Reg ATS Rule 302 미체결 주문 기록 요구? | D-C 의무화 |
| Q4 | controlled-venue(폐쇄 whitelist) 채택? | D-D 예방층 |
| C-08 | 신규 element pool 등재(freeze 변경) + walkthrough 작성 | 물량 한도 구현 |
| D-01 | 동시성·원자성(race condition) 구현 | stateful 정확성 |
| ADR# | ADR-008 번호가 아키텍처의 PD-2→ADR-008 예약과 충돌하는지 확인(dev ADR-007 통합본 확인 후, 겹치면 renumber) | 결정 추적 정합 |

---

## 부록 A. 읽기 경로 (외부 개발자용)

1. **§0 TL;DR + §1 아키텍처** — 시스템이 뭔지·거래 흐름·온오프체인 경계.
2. **§2 핵심 개념** — Element/Recipe/Manifest/Engine·패턴·timing·stateful.
3. `matrices/legal-to-technical-matrix.md` — 법 → 코드 전체 배선도(부품별).
4. **§5 Manifest 스키마** — 내 자산을 어떻게 선언하나(확장 지점).
5. `compliance/elements/<ID>_*.md` — 관심 부품 상세.
6. **§6~7 off-chain 레이어·경계** + `decisions/ADR-008` — 상태·감시·예방/탐지.
7. **§10~12** — demo/production 범위·결정·open items.

---

## 변경 로그
- **[2026-07-22] v0.1 신설.** 현재 구현(매트릭스·23 elements·Recipe 5종·PD 아키텍처) + ADR-008 델타를 하나의 시스템 스펙으로 종합. 델타 반영: C-08 신규 element 표기·D-01 산정규칙 확정·STATEFUL 4종·person-group 키·off-chain Layer 5·권위상태 vs 탐지 경계·token/venue 분류·demo vs production. Open items에 Q1~Q4 + C-08 등재 + ADR 번호 확인 플래그.
