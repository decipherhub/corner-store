# Phase 1 구조 결정 — 개발팀 리뷰 (PROPOSED)

## 읽기 전에 — 이게 뭐고, 당신들이 뭘 하면 되나

- **받는 사람 = 개발팀.** 아래는 컴포넌트 스펙·구현에 들어가기 *전에* 합의해야 할 **7개 "골조(아키텍처) 결정"**입니다.
- **왜 지금 정해야 하나:** 이건 *나중에 바꾸면 라우터·스키마·거래 흐름을 통째로 다시 짜야 하는(retrofit)* 골조입니다. 반대로 *구체 부품·임계치 값*은 나중에 가산하면 됩니다(OCP). **이 문서의 목적 = 그 "지금 박을 골조"와 "나중에 가산할 구체물"을 가르는 것.**
- **각 결정의 틀:** ① *어떤 문제인가* → ② *왜 골조인가(naive하게 짜면 나중에 뭐가 깨지나)* → ③ *제안* → ④ *trade-off(대안/안 하면)* → ⑤ *당신들이 정할 것.*
- **증권법 세부는 몰라도 됩니다** — 구조가 *왜 이렇게 생겼는지* 이해할 만큼만 풀어 썼습니다.
- **상태:** PD-1~6은 리걸/PM이 *방향*은 승인. 남은 건 **개발팀의 *구현 합의*(인터페이스·필드셋·파라미터)**. PD-7은 신규.

---

## Part 1. 5분 컨텍스트 — 우리가 뭘 만들고, 왜 구조가 이렇게 생겼나

### 한 문장
증권형 토큰을 사고파는 거래소(DEX) + "이 거래가 적법한가"를 자동 검사하는 컴플라이언스 **SDK**. 타깃 = 미국 사모(Reg D 506(c)) 증권의 *2차 거래(전매)*.

### 4-Layer (코드 관점)
```
Element  = 검사 부품 하나          (예: "적격투자자인가" A-03)        → ElementRegistry
Recipe   = 부품 조합 = 규제 하나   (예: Reg D 506(c) = 부품 묶음)     → RecipeRegistry
Manifest = 자산별 "어느 Recipe 켜나" 선언 (자산 신상카드)             → TokenPolicyRegistry
Operator = 사람 판단·감시·거버넌스 (자동 못 하는 것)                  → OperatorRegistry
```
- ERC-3643 호환. 우리 Element = `IModule`, 발행자가 `addModule`로 토큰에 바인딩.

### 핵심: 모듈은 *판단하지 않고 verify만* 한다
적격투자자 여부·내부자 여부 같은 *사실*은 **off-chain의 Trusted Issuer**(예: Securitize=transfer agent, Sumsub=KYC)가 검증해 **서명 claim**으로 발급하고, 온체인 모듈은 그 **claim이 진짜인지(서명·발급자·만료)만 확인**합니다. → 무거운 판정은 off-chain, 온체인은 가볍게.

### 거래 한 건 (모듈 관점)
> A가 BUIDL을 B에게 되판다:
```
transfer(A→B) 시도
  → Router: 이 자산 Manifest 읽음 → 걸리는 Recipe 집합 식별
  → R-XJ(제재·관할) → R2(재판매 §4a7: B가 적격투자자?) → R3(펀드 §3c7: B가 적격구매자?) → R4(감시)
  → 각 Recipe의 부품 union, 전부 통과(cumulative AND)면 체결, 아니면 revert(사유코드)
  → 체결 후: 무엇에 의지했는지 기록 + 의심거래는 Operator에 flag
```

### 왜 "틀의 유연성"이 핵심인가 (이게 7개 결정의 배경)
지금까지 **BUIDL(펀드) 한 종류만** 실제로 통과시켜봤습니다. 하지만 목표는 *다양한 증권*(펀드 아닌 회사채·Reg A+·Reg S 등)을 다 받는 것. **사고실험으로 회사채·Reg A+를 통과시켜보니, BUIDL만 봤으면 놓쳤을 4가지가 드러났습니다** — 새 발행 Recipe·자유양도(재판매 제한 없는 자산)·투자한도 부품·보고의무 부품. → **구체 부품은 나중에 가산하면 되지만, *그것들을 담을 틀(스키마·라우터)이 닫혀 있으면* 그때 통째로 재작성해야 합니다.** 그래서 *틀의 유연성*을 지금 박는 게 아래 결정들입니다.

---

## Part 2. 7개 골조 결정

### PD-1 (Q8) · Manifest = 닫힌 boolean ❌ → 열린 레지스트리 스키마

- **문제:** 자산마다 *어느 면제로 발행됐나·어느 경로로 팔리나·펀드인가·어느 엔진·어느 관할·보유상한*이 다릅니다. 이걸 자산에 *선언*해야 모든 부품·라우터가 읽고 "내가 켜질지"를 정합니다.
- **왜 골조:** Manifest를 `isCompliant: bool` 한 칸으로 짜면 BUIDL은 통과하지만, *회사채(펀드 아님)·Reg A+(자유양도)*가 오면 표현 불가(boolean blindness). 닫힌 `enum`으로 짜도 새 framework(Reg A) 추가 = 타입 변경 + **전체 재배포.**
- **제안:** framework를 `bytes32` ID로 두고 ID→모듈 매핑(동적 dispatch). 새 framework = *모듈 배포+등록*, Manifest·라우터 **무수정**(ERC-3643 compliance-modules 패턴).
```solidity
struct HolderCap { uint256 value; bytes32 basis; }   // basis==0 → no cap
struct Manifest {
    bytes32 issuanceFramework;  // keccak256("REG_D_506C")
    bytes32 fundExemption;      // 0x0 = None
    bytes32 resaleFramework;    // keccak256("FREELY_TRADABLE") 포함
    uint256 supportedEngines;   // bitset {AMM, OrderBook, RFQ}
    bytes32 jurisdictionScope;
    HolderCap holderCap;
}
mapping(bytes32 => IRecipeModule) public recipeModule;  // ← 확장 지점
```
- **trade-off:** 사고실험에서 Reg A+는 *새 발행 framework + 자유양도*를 요구. boolean/닫힌 enum이면 *지금 라우터·스키마를 다시* 짜야 함.
- **당신들이 정할 것:** 필드셋 범위(위 6필드가 맞나, 더/덜?) · 레지스트리 키 컨벤션.

### PD-2 (Q9) · 라우터 = 단일 AND ❌ → 다중-Recipe + 열린 Recipe 레지스트리

- **문제:** 한 거래에 *여러 규제가 동시에* 걸립니다. 예: BUIDL 재판매 1건 = 제재검사(R-XJ) + 재판매면제(R2) + 펀드자격(R3) + 시장감시(R4)가 *동시*. 게다가 결합방식이 제각각.
- **왜 골조:** 라우터를 "이 자산 Recipe 하나 불러서 다 통과면 OK"(단일 AND)로 짜면 아래를 못 담아 *통째 재작성*:
  - R2 = *경로 OR*(§4(a)(7) 또는 144, 매도인이 하나 선택)
  - R4 = *역방향*(막지 않고 의심거래에 깃발) → 별도 출력 필요
  - R-XJ = *맨 앞 fail-closed*(불확실하면 차단) → 우선순위·실패방향
  - **no-R2** = *재판매 제한 없는 자산*(Reg A+ 자유양도)은 R2를 *안 붙임* (우리 설계는 restricted 전제였음)
- **제안:** 다중-Recipe 파이프라인(걸리는 Recipe 집합 → 부품 union → cumulative AND) + *5종 결합논리 일반 처리* + *no-R2 수용* + **Recipe 집합도 열린 레지스트리**(새 framework=모듈 등록). ※ 다중-Recipe cumulative 자체는 *이미 Recipe v4로 확정* — 신규는 *no-R2 + 레지스트리화*.
- **trade-off:** Reg A+(자유양도) 자산이 오면 R2가 안 붙는데, restricted 전제 라우터는 *"재판매 Recipe 없는 자산"을 처리 못 함*.
- **당신들이 정할 것:** 라우터 평가 엔진 인터페이스 · 결합논리 표현 방식.

### PD-3 (Q10·Q10-a) · 상태 = 관문만 ❌ → 두 경로 + cross-venue 진리원천

- **문제:** 대부분 검사는 *거래 전 관문*(스냅샷)이지만, 일부 — 보유자 수(D-01)·시장감시(F-02/03)·취득기록·신뢰기록(reliance-log) — 는 *체결 후 상태를 누적*해야 합니다. 또 거래는 *우리 DEX 밖*(타 DEX·P2P·크로스체인)에서도 일어납니다.
- **왜 골조:** *체결 전 관문만* 깔면 누적 부품을 나중에 못 끼웁니다(거래 흐름 통째 뜯기 = **가장 비싼 retrofit**).
- **제안:** ① 두 경로 — *체결 전 관문* + *체결 후 commit/flag* ② 상태 관리 모델 — 상태별 *on-chain/off-chain 분담·append-only/mutable·멱등(idempotent)*, 취득기록은 *토큰 transfer 훅(venue 무관)*에서 write ③ **cross-venue 진리원천 = TA attestation anchor**(전 venue·크로스체인 합산), 토큰 레벨 ERC-3643=실시간 보강, 우리 DEX 관찰=우리 거래만. *외부 온체인 추적 ❌.*
- **trade-off:** 관문만 깔았다가 나중에 "보유자 수 상한"·"감시 기록" 같은 누적 부품이 필요해지면, 거래 라이프사이클을 다시 설계.
- **당신들이 정할 것:** 멱등 보장 방식 · on/off-chain 분담 · commit hook 배치.

### PD-4 (Q11) · TA claim = 단일 파이프라인 (중복 인프라 ❌)

- **문제:** *매도측 사실*(내부자·취득일)과 *cross-venue 상태*(전 venue 합산 보유·물량)는 *둘 다 Securitize(TA)가 권위 있게 아는 off-chain 사실*입니다. 따로 만들면 인프라 중복·불일치.
- **제안:** 하나의 파이프라인 — TA가 계산·서명한 claim → 투자자 ONCHAINID/자산 레지스트리에 발급 → ERC-3643 모듈이 verify(전) + 실시간 보강(후) → 주기적 reconciliation 시 **TA claim 권위**. 모듈은 *판단 안 함*.
- **trade-off:** 두 용도를 따로 구현하면 같은 사실의 두 출처가 어긋남.
- **당신들이 정할 것:** claim topic ↔ Element 매핑 · reconciliation 주기.

### PD-5 (Q12) · 자동/인간 경계 분류 (부품마다) — *컴포넌트 스펙에 직결*

- **문제:** 각 부품이 실패할 때 *거래를 막나(차단)*, *막지 않고 사람에게 넘기나(깃발)*, *사람이 능동 행위하나(Operator)*를 정해야 합니다. 이게 곧 각 부품의 **reasonCode·실패동작** = L3 컴포넌트 스펙의 *직접 입력*입니다.
- **왜 골조:** 깃발이어야 할 걸 *차단*으로 짜면 과잉 차단(정상거래 막음), 차단을 *깃발*로 짜면 누수(위반 통과) → 구조 결함.
- **제안:** 부품마다 셋 중 하나 *명시* — 🚫차단(결정론·strict) / 🚩깃발→review(판단·통계 감시) / 🧑Operator 행위(변경·보고).
- **당신들이 정할 것:** 각 부품의 분류(L3 스펙 작성 시 부품별로).

### PD-6 (Q13) · Operator 거버넌스 = multisig + timelock

- **문제:** 앞 3층을 *바꾸는 행위*(모듈/Manifest 변경·Trusted Issuer 추가제거·Element 업데이트·emergency freeze)가 자동이면, 잘못된 변경 한 번에 컴플라이언스가 붕괴.
- **제안:** 이런 변경은 **multisig(예: 2-of-3) + timelock(예: 24h).**
- **당신들이 정할 것:** multisig 구성 · timelock 기간 · 비상절차.

### PD-7 (Q14) · 생애주기 구조 훅 4종 *(신규)*

- **문제:** 법개정 반영·상장·상장폐지·incident 같은 *프로세스*는 대부분 운영 런북(나중)이지만, 그게 작동하려면 **4개 훅을 지금** 박아야 합니다.
- **제안:** ① 모듈 **version 필드** ② 변경 **append-only 연혁**(언제·뭘·왜 — 감사·소급) ③ **halt/freeze 능력**(상장폐지·incident 공유) ④ **record 보존(불변·17a-4)** — 폐지돼도 기록 의무 survive.
- **주의:** *우리 DEX 리스팅 폐지 ≠ 토큰 소멸*(토큰은 타 venue 존속) — 우리 리스팅만 내림.
- **당신들이 정할 것:** version·연혁 형식 · halt 범위.

---

## Part 3. 무엇을 합의하고, 무엇이 이미 됐나

### 결정 지형 한눈에

| | 결정 | 상태 |
|---|---|---|
| ADR-002 | R-XJ 횡단 always-on prefactor | ✅ Accepted |
| ADR-004 | Element Pool Freeze v1 | ✅ Accepted |
| ADR-005 | §4(a)(7) 주 재판매경로·A-03 active | ✅ (general solicitation 판정만 변호사 잔여) |
| ADR-006 | 부품 asset-agnostic | ✅ Accepted |
| **PD-1~7** | 위 7개 골조 | 🟢 방향비준 · **개발팀 구현 합의 대기** |

### 최소 게이트
**PD-1·2·3·5·7**이 컴포넌트 스펙·생애주기를 여는 *최소 토대*. PD-4·6은 병렬 합의 가능.

### 리뷰 요청
- 각 PD의 *제안에 동의/수정* + ④ trade-off가 납득되나 + ⑤ 구현 디테일(필드셋·인터페이스·파라미터) 확정.
- 합의분 → **ADR-007(Q8)·008(Q9)·009(Q10/Q10-a)·010(Q12)·011(Q13)·012(Q11)·013(Q14)** 승격(`docs/decisions/`).
- 전체 결정 현황: [`docs/decisions/decision-register.md`](../decisions/decision-register.md).

> 법률 의존 항목(reliance 충분성·audit trail·SAR·general solicitation 등)은 *별도 변호사 트랙*이며 이 문서 범위 밖. 구조 freeze는 위 PD(개발팀 합의) + *구조에 걸리는 법률 회신*만 선행.
