# Corner Store 아키텍처 스켈레톤 — 설계 문서

- 날짜: 2026-06-13
- 브랜치: `feat/skeleton-architecture`
- 상태: 설계 확정 대기 (사용자 리뷰)

---

## 1. 목표와 범위

**목표.** `MVP-v2-multi-venue.md`와 `architecture/`가 정의한 책임 경계를, 추후
업데이트·유지보수에 강한 Solidity **골격(skeleton)** 으로 구현한다. 실제 법률·비즈니스
로직은 mock/illustrative로 두되, 컴포넌트 간 **배선(라우팅 → 컴플라이언스 평가 →
venue 실행 → ERC-3643 transfer)은 실제로 동작**하게 만들어 E2E 테스트로 전체 흐름을
증명한다.

**핵심 설계 원칙(유지보수성의 근거).**

| 원칙 | 구조적 표현 |
| --- | --- |
| 인터페이스 우선 | 모든 컴포넌트는 `interfaces/`의 `I*.sol` 계약으로 먼저 정의하고 구현체를 끼운다. 구현 교체가 소비자를 깨뜨리지 않는다. |
| 등록 기반 확장 (G3) | Element/Recipe/Policy/Venue/Operator는 전부 Registry로 관리. 새 규칙 = 새 컨트랙트 배포 + 등록. 기존 코드는 수정에 닫히고 등록에 열린다. |
| immutable 우선 | upgradeability 미도입(Phase 0 blocker). Element 로직은 immutable, 외부 데이터·기준값만 versioned reference. |
| 책임 분리 | Engine은 실행하지 않고, Adapter는 정책을 정의하지 않고, Router는 matching을 하지 않는다. |
| fail-closed | `UNKNOWN`·`SUSPENDED`·미등록은 전부 기본 거부. |
| 구조화된 결정 | `ComplianceDecision` 구조체 + `decisionHash` context binding으로 다른 actor·token·venue·수량에 재사용 불가. |

### 확정된 결정 (브레인스토밍)

1. **범위:** AMM/RFQ/OrderBook 어댑터 **인터페이스는 모두 정의**, **concrete 구현은
   Uniswap v3 AMM 어댑터 하나만**. RFQ/OrderBook은 인터페이스 + 빈(revert) 스텁.
2. **AMM 연결:** 실제 Uniswap v3 wiring은 후속(Phase 3). 스켈레톤 테스트는 `IPool`
   인터페이스 뒤의 **mock pool/callback**으로 E2E 흐름을 검증.
3. **스텁 깊이:** **배선은 동작, 정책은 mock.** 레지스트리는 실제 저장/조회,
   ComplianceEngine은 mock Recipe로 구조화된 `ComplianceDecision` 반환, Router는 실제
   dispatch. 법률 판정만 illustrative.
4. **ERC-3643:** 공식 구현(`@erc3643org/erc-3643`, T-REX)을 **실제 의존성으로
   컴파일**하고, **테스트에서 실제 배포**한다. 자체 최소 인터페이스를 만들지 않는다.

### In scope

- 공통 types/interfaces/errors/events
- Registry 4종: TokenPolicy, Recipe, Element, Operator
- ComplianceEngine + 구조화된 ComplianceDecision + DecisionHash 라이브러리
- ExecutionRouter + VenueRegistry + VenueSelector
- Adapter 경계: `IExecutionAdapter` + AMM(concrete)/RFQ(stub)/OrderBook(stub)
- Factory(CornerStore + UniswapV3VenueFactory) 골격, Logging 2종
- mock Element 4종 + RegD506c mock Recipe (illustrative)
- 실제 T-REX 배포 테스트 fixture (OnchainID identity + claim 포함)
- mock ERC-20(quote), mock AMM pool/callback
- Foundry 빌드/포맷/테스트 + CI 명령

### Out of scope

- 실제 법률 기준값·production Element (법률 승인 전 비활성)
- 실제 Uniswap v3 온체인 wiring, RFQ/OrderBook 동작 구현
- best execution, order splitting, 실제 KYC/sanctions provider, oracle
- Layer 3 운영(라이선스·시장감시·AML·공시), multisig/governance, 보안 감사
- upgradeability/proxy (production 배포 시 별도 결정)

---

## 2. 의존성과 빌드 셋업

- **solc 고정:** `0.8.17` (T-REX가 `pragma solidity 0.8.17;` 고정). 우리 코드도 동일.
- **OpenZeppelin v4.8.3** (T-REX가 `^4.8.3` 요구; v5 아님). 우리 코드도 v4.8.3 사용해
  remapping을 단일화.
- 설치(forge install, git tag 기준):
  - `OpenZeppelin/openzeppelin-contracts@v4.8.3`
  - `OpenZeppelin/openzeppelin-contracts-upgradeable@v4.8.3`
  - `onchain-id/solidity` (OnchainID, `@onchain-id/solidity` ^2.0.0 대응 태그)
  - `ERC-3643/ERC-3643` (T-REX)
- **remappings.txt** (T-REX 내부 import 경로와 일치해야 함):
  ```
  @openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
  @openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
  @onchain-id/solidity/=lib/solidity/
  @erc3643/=lib/ERC-3643/contracts/
  forge-std/=lib/forge-std/src/
  ```
  (OnchainID 설치 디렉터리명이 `lib/solidity`가 아닐 경우 실제 경로에 맞춰 조정.)
- T-REX import는 `@openzeppelin/contracts/...`, `@onchain-id/solidity/contracts/...`,
  내부 상대경로를 쓴다. 우리 코드는 T-REX를 `@erc3643/...`로 import.
- `foundry.toml`에 `solc = "0.8.17"`, `optimizer = true`, `via_ir`는 컴파일 성공 후
  필요 시에만 켠다(T-REX + 우리 코드 스택 크기 대응).

---

## 3. 디렉터리 구조

```
src/
├── interfaces/
│   ├── compliance/  (IElement, IRecipe, IComplianceEngine,
│   │                 IElementRegistry, IRecipeRegistry,
│   │                 ITokenPolicyRegistry, IOperatorRegistry)
│   ├── execution/   (IExecutionRouter, IVenueRegistry, IVenueSelector,
│   │                 IExecutionAdapter)
│   └── execution/adapters/ (IAMMAdapter, IRFQAdapter, IOrderBookAdapter, IPool)
├── types/
│   ├── ComplianceTypes.sol   (ComplianceContext, ComplianceDecision, PolicyStatus)
│   ├── ExecutionTypes.sol     (ExecutionRequest, ExecutionResult)
│   └── VenueTypes.sol         (VenueType enum, VenueConfig, CustodyModel)
├── libraries/
│   ├── DecisionHashLib.sol    (decisionHash 순수 계산)
│   ├── Errors.sol             (커스텀 에러 모음)
│   └── Events.sol             (공통 이벤트 시그니처)
├── auth/
│   └── Governed.sol           (Ownable 기반 + admin/execution 권한 분리 경계)
├── compliance/
│   ├── ComplianceEngine.sol
│   ├── elements/ (BaseElement, Sanctions/Jurisdiction/AccreditedInvestor/Lockup — mock)
│   └── recipes/  (BaseRecipe, RegD506cRecipe — mock 조합)
├── registry/
│   ├── ElementRegistry.sol
│   ├── RecipeRegistry.sol
│   ├── TokenPolicyRegistry.sol
│   └── OperatorRegistry.sol
├── execution/
│   ├── ExecutionRouter.sol
│   ├── VenueRegistry.sol
│   ├── VenueSelector.sol
│   └── adapters/
│       ├── amm/  (UniswapV3Adapter — concrete, mock pool 대상)
│       ├── rfq/  (RFQAdapter — 빈 스텁)
│       └── orderbook/ (OrderBookAdapter — 빈 스텁)
├── factory/
│   ├── CornerStoreFactory.sol
│   └── UniswapV3VenueFactory.sol
└── logging/
    ├── ComplianceLogger.sol
    └── ExecutionLogger.sol

test/
├── fixtures/  (TREXSuite.sol — 실제 T-REX + OnchainID 배포·claim 셋업)
├── mocks/     (MockERC20, MockPool, MockAMMCallbackTarget, helpers)
├── unit/      (레지스트리·엔진·라우터·어댑터·decisionHash·권한)
└── integration/ (E2E 허용/거부 시나리오)
```

`test/Counter.t.sol`, `src/Counter.sol`, `script/Counter.s.sol` 템플릿은 제거한다.

---

## 4. 핵심 타입

```solidity
enum PolicyStatus { UNKNOWN, UNREGULATED, ACTIVE, SUSPENDED } // UNKNOWN=0 → fail-closed
enum VenueType   { AMM, ORDER_BOOK, RFQ }

struct ComplianceContext {
    address initiator; address buyer; address seller;
    address tokenIn; address tokenOut;
    uint256 amountIn; uint256 amountOut;
    VenueType venueType; address venue;
}

struct ComplianceDecision {
    bool allowed;
    bytes32 policyId; uint64 policyVersion; uint64 validUntil;
    uint256 maxAmount;
    uint256 allowedVenueTypes;   // VenueType 비트마스크
    bytes32 allowedVenuesHash;   // 정확한 venue 집합 바인딩
    bytes32 reasonCode;
    bytes32 decisionHash;        // context 전체 바인딩 → 재사용 불가
}

struct ExecutionRequest {
    ComplianceContext context;
    uint256 amountOutMin; uint64 deadline; uint256 nonce;
    bytes venueData;             // venue별 파라미터(opaque)
}
```

`DecisionHashLib.compute(...)`는 buyer/seller/initiator·tokenIn/tokenOut·방향·maxAmount·
offering/program id·order/quote id·허용 venue(type 또는 정확 주소)·policyVersion·
validUntil을 해시한다. 다른 사용자·수량·토큰·venue·버전에 재사용 불가를 테스트로 증명.

---

## 5. 컴포넌트별 책임

| 컨트랙트 | 책임 | 책임 아님 |
| --- | --- | --- |
| ExecutionRouter | decision 검증, nonce/deadline/replay, adapter dispatch | 법률 규칙, matching |
| ComplianceEngine | context 평가, Recipe 실행, decision 생성 | venue 실행 |
| TokenPolicyRegistry | token/program별 정책·상태·버전 | Recipe 실행 |
| RecipeRegistry | Recipe 컨트랙트·버전 관리 | Element 실행 |
| ElementRegistry | Element 컨트랙트·버전 관리 | 검증 수행 |
| OperatorRegistry | operator 권한·상태·venue 연결 | 라이선스 판정 |
| VenueRegistry | venue/adapter/operator/custody metadata | 가격 선택 |
| VenueSelector | 허용 venue 검증·결정적 선택 | 법률 판단 |
| Elements | 단일 규칙 검증 (mock) | 다른 규칙, execution |
| Recipes | Element 조합·집계 (mock) | matching engine |
| UniswapV3Adapter | swap, callback origin, pool·decision 바인딩 | RFQ/OrderBook, 정책 |
| RFQAdapter / OrderBookAdapter | (스텁) 인터페이스 충족 | — |
| CornerStoreFactory / UniswapV3VenueFactory | onboarding 오케스트레이션 골격 | compliance 검증 |
| ComplianceLogger / ExecutionLogger | audit/execution 이벤트 | 판단·상태 관리 |

---

## 6. 데이터 흐름 (무엇이 동작하고 무엇이 mock인가)

```
User → ExecutionRouter.execute(request)
        │  [동작] nonce/deadline/decision 검증
        ▼
     ComplianceEngine.evaluate(context)
        │  [동작] TokenPolicyRegistry 조회 → 상태 분기(fail-closed)
        │  [동작] Recipe 실행 → ElementRegistry 통해 Element 순회
        │  [mock] Element 법률 판정은 illustrative(설정값/항상 통과)
        │  [동작] DecisionHashLib로 decisionHash 계산 → ComplianceDecision 반환
        ▼
     VenueSelector  [동작] decision에 바인딩된 venue/type만 허용
        ▼
     UniswapV3Adapter.execute(request, decision)
        │  [동작] pool/callback origin 검증, decision-param 바인딩
        ▼
     MockPool.swap → (콜백) Adapter.transferFrom(user→pool)
                   → ERC-3643 Token.transfer(pool→user)
                       [동작] 실제 T-REX isVerified/canTransfer 검사
```

"파이프(배관)는 진짜로 흐르고, 법률 판단만 mock"이다.

---

## 7. ERC-3643 통합과 테스트 fixture

- 우리 컨트랙트는 T-REX의 **실제 인터페이스**(`@erc3643/token/IToken.sol`,
  `@erc3643/registry/interface/IIdentityRegistry.sol`,
  `@erc3643/compliance/modular/IModularCompliance.sol`)를 통합 경계 타입으로 import.
- **테스트 fixture(`test/fixtures/TREXSuite.sol`)** 는 실제 T-REX를 배포한다. Token이
  생성자에서 `_disableInitializers()`를 호출하지 않으므로, 테스트는 구현체를 직접
  배포하고 `init()`을 순서대로 호출한다(프록시 불필요):
  1. ClaimTopicsRegistry.init()
  2. TrustedIssuersRegistry.init()
  3. IdentityRegistryStorage.init()
  4. IdentityRegistry.init(ctr, tir, irs) + IRS bind
  5. ModularCompliance.init()
  6. Token.init(ir, mc, name, symbol, decimals, onchainID)
  7. OnchainID: 토큰·투자자·pool용 Identity 배포, trusted issuer가 서명한 claim 추가,
     IdentityRegistry에 agent로 등록 → `isVerified` 통과
- Pool은 ERC-3643 토큰을 보유하는 custodian이므로 IdentityRegistry에 venue로 등록
  (mock pool 주소를 fixture에서 등록).

---

## 8. 테스트 전략 (MVP-v2 §16 ↔ ROADMAP Phase 1~3에 매핑)

- **Unit:** policy 상태/버전, decisionHash 파라미터 바인딩, allowed venue type/주소
  검증, venue/operator suspension, AMM callback origin, `UNREGULATED` 명시 처리,
  admin/execution 권한 분리.
- **Integration(E2E):** illustrative policy 허용 매수 방향 성공 · 매도 방향 성공 ·
  금지 방향 거부 · 미검증 수신자 거부 · Layer2 policy 거부 · `canTransfer` 거부 시
  전체 롤백 · suspended venue 거부 · decision 재사용 거부.
- **Invariant:** 미등록 adapter 실행 불가 · maxAmount 초과 불가 · 다른
  actor/token/venue에 decision 재사용 불가 · Router/Adapter 잔액 0 · suspended venue
  신규 실행 불가.
- 완료선: `forge fmt --check`, `forge build`, `forge test` 전부 통과 + CI 워크플로.

---

## 9. 구현 순서 (에이전트 병렬 분담)

인터페이스·타입을 **먼저 한 에이전트가 확정**(계약 동결)한 뒤, 나머지가 그 위에서
병렬로 작업한다.

1. **기반(직렬, 선행):** 의존성 설치 + remappings + foundry.toml + Counter 제거 +
   `types/`·`interfaces/`·`libraries/Errors,Events`·`auth/Governed` + `DecisionHashLib`.
2. **병렬 A — Registry:** Element/Recipe/TokenPolicy/Operator Registry + 단위 테스트.
3. **병렬 B — Compliance:** BaseElement + mock Element 4종 + BaseRecipe + RegD506c +
   ComplianceEngine + 단위 테스트.
4. **병렬 C — Execution:** ExecutionRouter + VenueRegistry + VenueSelector +
   UniswapV3Adapter + RFQ/OrderBook 스텁 + mock pool + 단위 테스트.
5. **병렬 D — Fixture/Infra:** TREXSuite fixture + MockERC20 + Factory/Logging 골격.
6. **통합(직렬, 마지막):** integration E2E 테스트 + invariant + CI + `forge fmt/build/test`
   전체 통과 확인.

---

## 10. 완료 기준

- 템플릿 코드 없이 `forge build` 성공 (solc 0.8.17, T-REX 포함 컴파일).
- 모든 unit/integration/invariant 테스트 통과.
- `forge fmt --check` 통과 + CI(GitHub Actions) 통과.
- 미확정 정책은 permissive placeholder로 활성화하지 않음(mock·비활성 유지).
- 문서: 각 레이어가 어떻게 동작/mock 되는지, 사용자가 어떻게 이해해야 하는지 정리.

---

## 11. 위험과 대응

- **T-REX 컴파일 충돌:** OZ v4.8.3 / solc 0.8.17 단일화로 완화. 스택 한도 시
  `via_ir` 또는 optimizer runs 조정.
- **OnchainID claim fixture 복잡도:** 가장 까다로운 부분. trusted issuer 키 서명 →
  claim → `isVerified` 통과까지 fixture로 캡슐화하고 helper로 재사용.
- **범위 팽창:** RFQ/OrderBook은 스텁 이상 구현하지 않음. 실제 v3 wiring 금지(mock).
