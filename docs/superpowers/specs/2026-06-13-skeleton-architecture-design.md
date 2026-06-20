# Corner Store 아키텍처 스켈레톤 — 설계 문서 (v2)

- 날짜: 2026-06-13
- 브랜치: `feat/skeleton-architecture`
- 상태: 설계 확정 (compliance/ 문서 리뷰 반영)

> v2 변경: `docs/compliance/` 9개 문서를 골격 spec과 대조 리뷰한 결과를 반영했다.
> 아키텍처 철학(인터페이스 우선·등록 기반·immutable·fail-closed·구조화된 결정)은
> compliance 변경요청서 헤더가 "뼈대는 정합"이라 확인했고, **Element/Recipe 인터페이스
> 모양·Manifest 레이어·다중 Recipe 누적 AND**를 compliance 문서 기준으로 정정했다.
> `04-element-interface.md`는 "stable/build target"이므로 그 인터페이스를 그대로 채택한다.

---

## 1. 목표와 범위

**목표.** 책임 경계를 추후 업데이트·유지보수에 강한 Solidity **골격(skeleton)** 으로
구현한다. 실제 법률·비즈니스 로직은 mock/illustrative로 두되, 컴포넌트 간 **배선(라우팅
→ 컴플라이언스 평가 → venue 실행 → ERC-3643 transfer)은 실제로 동작**하게 만들어 E2E
테스트로 전체 흐름을 증명한다. **인터페이스 모양은 지금 못 박는다** — 동결 후 변경 비용이
가장 크고, 골격이 책임지는 핵심이기 때문이다.

### 설계 원칙

| 원칙 | 구조적 표현 |
| --- | --- |
| 인터페이스 우선 | 모든 컴포넌트는 `interfaces/`의 `I*.sol` 계약으로 먼저 정의. 구현 교체가 소비자를 깨뜨리지 않는다. |
| 등록 기반 확장 (G3) | Element/Recipe/Manifest/Venue/Operator는 전부 Registry로 관리. 새 규칙 = 새 컨트랙트 배포 + 등록. 코드는 수정에 닫히고 등록에 열린다. |
| immutable 우선 | upgradeability 미도입. Element 로직은 immutable, 외부 데이터·기준값만 versioned reference. |
| 책임 분리 | Engine은 실행 안 함 / Adapter는 정책 정의 안 함 / Router는 matching 안 함 / Operator는 hot path에 없음(상태 입력만). |
| fail-closed | `UNKNOWN`·`SUSPENDED`·미등록은 기본 거부. empty manifest는 명시적 passThrough만. |
| 구조화된 결정 | `ComplianceDecision` + `decisionHash` context binding으로 재사용 불가. |
| build-on, don't rebuild (G2) | 발행 측(ERC-3643)이 이미 검증한 것은 `coverageScope`로 skip — 거래 측은 빈 부분만 검사. |
| 경계는 기록으로 (G5) | Manifest에 declaredBy/approvedBy, decision에 의존한 claim/issuer를 기록. |

### 확정된 결정

1. **범위:** AMM/RFQ/OrderBook 어댑터 **인터페이스 모두 정의**, **concrete 구현은 AMM
   하나만**. RFQ/OrderBook은 인터페이스 + 빈(revert) 스텁.
2. **AMM 연결:** 실제 Uniswap v3 wiring은 후속. 스켈레톤은 `IPool` 뒤의 **mock
   pool/callback**으로 E2E 검증.
3. **스텁 깊이:** **배선은 동작, 정책은 mock.** 레지스트리 실제 저장/조회, 엔진은 mock
   Recipe로 구조화된 decision 반환, Router는 실제 dispatch. 법률 판정만 illustrative.
4. **ERC-3643 = 실제 T-REX** (`@erc3643org/erc-3643`) 컴파일 + 테스트에서 실제 배포.
5. **Element 인터페이스명 = `IComplianceElement`** (stable 문서 우선; appendix의 `IElement`는
   별칭으로 문서에만 표기).
6. **Manifest 저장소 = `TokenPolicyRegistry`** 이름 유지, **`ManifestCore` 구조체** 저장
   (MVP-v2 명칭과 compliance의 Manifest 개념 양립).

### In scope

- 공통 types/interfaces/errors/events + `DecisionHashLib` + `auth/Governed`
- Registry 4종: Element / Recipe / TokenPolicy(=Manifest store) / Operator
- ComplianceEngine — **다중 Recipe 누적 AND + element union/dedup + 조건부 활성화 +
  coverageScope skip + post-trade commit hook**
- ExecutionRouter(nonReentrant, nonce/deadline) + VenueRegistry + VenueSelector
- Adapter 경계: `IExecutionAdapter` + AMM(concrete)/RFQ(stub)/OrderBook(stub)
- mock Element 5종(아래 §5.4) + mock Recipe 2종(issuance + fund) — illustrative
- 실제 T-REX 배포 테스트 fixture (OnchainID identity + claim)
- mock ERC-20(quote), mock AMM pool/callback
- Operator state-input gate + 감시(surveillance) 이벤트 hook + 긴급정지 setter
- Foundry 빌드/포맷/테스트 + CI

### Out of scope (그러나 pluggable하게 자리는 남긴다)

- 실제 법률 기준값·production Element (법률 승인 전 비활성)
- 실제 Uniswap v3 온체인 wiring, RFQ/OrderBook 동작 구현
- **취득시점 acquisition registry**(CR-3, priority 1 blocking) — 주입형 source로 자리만
- **primary/distribution·redemption rail** 실제 구현 — FlowType discriminator + revert 스텁
- reject-audit 영속화 메커니즘(CR-5) — open decision으로 문서화
- best execution, order splitting, 실제 KYC/sanctions provider, oracle
- Layer 3 운영, multisig/governance, 보안 감사, upgradeability/proxy

---

## 2. 의존성과 빌드 셋업

- **solc 고정 `0.8.17`** (T-REX 고정), **OpenZeppelin v4.8.3** (v5 아님; remapping 단일화).
- forge install (git tag): `OpenZeppelin/openzeppelin-contracts@v4.8.3`,
  `OpenZeppelin/openzeppelin-contracts-upgradeable@v4.8.3`, `onchain-id/solidity`,
  `ERC-3643/ERC-3643`.
- **remappings.txt** (T-REX 내부 import 경로와 일치):
  ```
  @openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
  @openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
  @onchain-id/solidity/=lib/solidity/
  @erc3643/=lib/ERC-3643/contracts/
  forge-std/=lib/forge-std/src/
  ```
  (OnchainID 실제 설치 디렉터리명에 맞춰 `@onchain-id/solidity/` 우변 조정.)
- `foundry.toml`: `solc = "0.8.17"`, `optimizer = true`. 스택 한도 시 `via_ir`/runs 조정.

---

## 3. 디렉터리 구조

```
src/
├── interfaces/
│   ├── compliance/  (IComplianceElement, IStatefulElement, IRecipe,
│   │                 IComplianceEngine, IElementRegistry, IRecipeRegistry,
│   │                 ITokenPolicyRegistry, IOperatorRegistry)
│   └── execution/   (IExecutionRouter, IVenueRegistry, IVenueSelector,
│                     IExecutionAdapter, adapters/{IAMMAdapter,IRFQAdapter,
│                     IOrderBookAdapter,IPool})
├── types/
│   ├── ComplianceTypes.sol  (enums, ElementMetadata, ComplianceContext,
│   │                         ComplianceDecision, ManifestCore)
│   ├── ExecutionTypes.sol   (ExecutionRequest, ExecutionResult)
│   └── VenueTypes.sol       (VenueType, VenueConfig, CustodyModel)
├── libraries/  (DecisionHashLib, ReasonCodes, Errors, Events)
├── auth/       (Governed — owner + role 분리 + write-gate modifier)
├── compliance/
│   ├── ComplianceEngine.sol
│   ├── elements/ (BaseElement, BaseStatefulElement,
│   │             Sanctions, AccreditedInvestor, QualifiedPurchaser,
│   │             Lockup, SurveillanceFlag — 전부 mock)
│   └── recipes/  (BaseRecipe, RegD506cRecipe, Fund3c7Recipe — mock)
├── registry/   (ElementRegistry, RecipeRegistry, TokenPolicyRegistry, OperatorRegistry)
├── execution/
│   ├── ExecutionRouter.sol, VenueRegistry.sol, VenueSelector.sol
│   └── adapters/ amm/UniswapV3Adapter.sol(concrete),
│                 rfq/RFQAdapter.sol(stub), orderbook/OrderBookAdapter.sol(stub)
├── factory/    (CornerStoreFactory, UniswapV3VenueFactory — 골격)
└── logging/    (ComplianceLogger, ExecutionLogger)

test/
├── fixtures/ (TREXSuite.sol — 실제 T-REX + OnchainID 배포·claim)
├── mocks/    (MockERC20, MockPool, MockAMMCallbackTarget, helpers)
├── unit/     (레지스트리·엔진·라우터·어댑터·decisionHash·권한·metadata)
└── integration/ (E2E 허용/거부/다중recipe/조건부/post-trade/긴급정지)
```

`Counter.sol`/`Counter.t.sol`/`Counter.s.sol` 템플릿 제거.

---

## 4. 핵심 타입 (계약의 중심 — 동결 대상)

```solidity
// ── 상태/경로 ──────────────────────────────
enum PolicyStatus { UNKNOWN, UNREGULATED, ACTIVE, SUSPENDED } // 0=UNKNOWN → fail-closed
enum VenueType    { AMM, ORDER_BOOK, RFQ }
enum FlowType     { SECONDARY_TRADE, PRIMARY_DISTRIBUTION, REDEMPTION } // rail 분리

// ── Element 분류 (04-element-interface.md §2-3, stable, verbatim) ──
enum ElementCategory { INVESTOR_ATTRIBUTE, ASSET_ATTRIBUTE, RESALE_TRANSACTION,
                       SYSTEM_STATE, ISSUER_STATUS, CONDUCT_MONITORING, PROCEDURAL } // A~G
enum Decidability    { DETERMINISTIC, ATTESTATION_BASED, MONITORING_BASED }
enum ObligationTiming{ EX_ANTE_VERIFY, AT_TRADE_GATE, EX_POST_TRIGGER }
enum Statefulness    { STATELESS, STATEFUL }
enum TemporalNature  { ONE_TIME, PERIODIC, REALTIME, CUMULATIVE }

struct ElementMetadata {
    bytes32 elementId;        // 예: "A-01-v1"
    ElementCategory category;
    string  version;
    TemporalNature  temporal;
    Decidability    decidability;
    ObligationTiming timing;
    Statefulness    statefulness;
}

// ── Manifest (CR-1; TokenPolicyRegistry가 저장) ──
struct ManifestCore {
    PolicyStatus status;
    uint16 issuanceRecipeId;  uint16 issuanceRecipeVersion;
    uint16 fundRecipeId;      // 0 = none (조건부)
    uint32 enabledResalePaths;// bitset
    uint8  supportedEngines;  // bitset {AMM, ORDER_BOOK, RFQ}
    uint16 stateScopeId;
    uint256 factsPacked;      // 조건부 활성화 facts (fund flag, distribution active, …)
    uint256 coverageScope;    // 발행 측이 이미 검증하는 element set (skip)
    bytes32 fullManifestHash; // off-chain anchor
    address declaredBy;       // 발행인 선언
    address approvedBy;       // DEX 승인 (G5)
}

// ── 거래 context / 결정 ──
struct ComplianceContext {
    address initiator; address buyer; address seller;
    address tokenIn; address tokenOut;
    uint256 amountIn; uint256 amountOut;
    VenueType venueType; address venue;
    FlowType  flowType;          // rail discriminator
    bool      sellerIsAffiliate; // 조건부 활성화 fact
}

struct ComplianceDecision {
    bool allowed;
    bytes32 policyId; uint64 policyVersion; uint64 validUntil;
    uint256 maxAmount;
    uint256 allowedVenueTypes;  // VenueType 비트마스크
    bytes32 allowedVenuesHash;  // 정확한 venue 집합 바인딩
    bytes32 reasonCode;         // 실패 시 recipeId+elementId 인코딩 (ReasonCodes)
    bytes32 reliedClaims;       // provenance: 신뢰한 claim/issuer 해시 (G5, N-3)
    bytes32 decisionHash;       // context 전체 바인딩 → 재사용 불가
}
```

`DecisionHashLib.compute`는 buyer/seller/initiator·tokenIn/tokenOut·방향·maxAmount·
offering/order id·허용 venue·policyVersion·validUntil·flowType을 해시한다.

---

## 5. 컴파일런스 코어 인터페이스 (04-element-interface.md 기준)

### 5.1 IComplianceElement (stable, verbatim)

```solidity
interface IComplianceElement {
    function check(
        address user, address counterparty, address asset,
        uint256 amount, bytes calldata context   // tx context + per-token facts
    ) external view returns (bool passed, bytes32 reasonCode);

    function elementMetadata() external view returns (ElementMetadata memory);
}

// post-trade STATEFUL Element 전용 (CR-4 예약 훅을 별도 인터페이스로 분리)
interface IStatefulElement is IComplianceElement {
    function onTransfer(address from, address to, uint256 amount) external; // commit hook
}
```

- Element 반환은 **`(bool, bytes32)`** — `ComplianceDecision`이 아님(엔진 레벨과 분리).
- Element는 서로 호출하지 않는다. 활성화/trigger 관계는 Recipe/엔진 레벨 책임.
- `BaseElement`는 check+metadata만, `BaseStatefulElement`는 `onTransfer` 추가.

### 5.2 IRecipe (조합·활성화 — 누적은 엔진이 수행)

```solidity
interface IRecipe {
    function recipeId() external view returns (uint16);
    function version()  external view returns (uint16);
    function isApplicable(bytes calldata context) external view returns (bool); // 조건부 활성화
    function requiredElements() external view returns (bytes32[] memory);        // elementId subset
}
```

### 5.3 IComplianceEngine (다중 Recipe 누적 AND)

```solidity
interface IComplianceEngine {
    function evaluate(ComplianceContext calldata ctx)
        external view returns (ComplianceDecision memory);
    function commit(ComplianceContext calldata ctx) external; // post-trade: STATEFUL onTransfer
}
```

엔진 `evaluate` 알고리즘 (CR-2):
1. TokenPolicyRegistry에서 `ManifestCore` 조회 → 상태 분기.
   `UNKNOWN/SUSPENDED` → 거부, `UNREGULATED`(양쪽) → passThrough, `ACTIVE` → 평가.
2. manifest의 candidate recipe들(issuance + fund(있으면) + resale path별) 수집.
3. 각 recipe `isApplicable(ctx-facts)` → 적용 recipe 집합 확정.
4. 적용 recipe들의 `requiredElements()` **union + dedup** → coverageScope 차감(G2).
5. 각 element를 ElementRegistry로 resolve → `check()` 호출. **전부 통과해야 함(AND)**.
   하나라도 실패 → `reasonCode = ReasonCodes.encode(recipeId, elementId, code)`.
6. `ComplianceDecision` 구성(decisionHash, reliedClaims 포함).

`commit`은 settlement 직후 Router가 호출 → 적용 element 중 STATEFUL인 것만 `onTransfer`
(카운터 갱신/감시 flag). flag형(MONITORING_BASED)은 차단하지 않고 이벤트만 emit.

### 5.4 mock Element 5종 (3축을 모두 시연)

| mock | id 예 | category | decidability | timing | stateful | 시연 |
| --- | --- | --- | --- | --- | --- | --- |
| Sanctions | A-01 | INVESTOR_ATTRIBUTE | DETERMINISTIC | AT_TRADE_GATE | STATELESS | 즉시 게이트 거부 |
| AccreditedInvestor | A-03 | INVESTOR_ATTRIBUTE | ATTESTATION_BASED | EX_ANTE_VERIFY | STATELESS | claim 존재+issuer+만료 (Pattern B) |
| QualifiedPurchaser | A-13 | INVESTOR_ATTRIBUTE | ATTESTATION_BASED | EX_ANTE_VERIFY | STATELESS | fund flag로 **조건부 활성화** |
| Lockup | C-01 | RESALE_TRANSACTION | DETERMINISTIC | AT_TRADE_GATE | STATELESS | **주입형 acquisition source**(CR-3 자리) |
| SurveillanceFlag | F-02 | CONDUCT_MONITORING | MONITORING_BASED | EX_POST_TRIGGER | STATEFUL | **post-trade flag-not-block** |

---

## 6. 컴포넌트별 책임

| 컨트랙트 | 책임 | 책임 아님 |
| --- | --- | --- |
| ExecutionRouter | decision 검증, nonce/deadline/replay, **nonReentrant**, adapter dispatch, post-trade `commit` 호출 | 법률 규칙, matching |
| ComplianceEngine | manifest 조회, 다중 recipe 누적 AND, decision 생성, commit | venue 실행 |
| TokenPolicyRegistry | token별 `ManifestCore`·상태·버전, **write-gated 사실 갱신**(restrictedParties, distributionActive 등) | Recipe 실행 |
| RecipeRegistry | Recipe 컨트랙트·버전 | Element 실행 |
| ElementRegistry | Element 컨트랙트·버전(elementId→주소) | 검증 수행 |
| OperatorRegistry | operator 권한·상태·venue 연결, **긴급정지 setter + 감시 이벤트 hook** | 라이선스 판정, hot path 진입 |
| VenueRegistry | venue/adapter/operator/custody metadata, suspend 상태 | 가격 선택 |
| VenueSelector | 허용 venue 검증·결정적 선택 | 법률 판단 |
| Elements/Recipes | 단일 규칙 / 조합 (mock) | 다른 규칙·matching |
| UniswapV3Adapter | swap, callback origin, pool·decision 바인딩 | RFQ/OB, 정책 |
| RFQ/OrderBookAdapter | (스텁) 인터페이스 충족 | — |
| Factory 2종 | onboarding 오케스트레이션 골격 | compliance 검증 |
| Compliance/ExecutionLogger | audit/execution/**surveillance** 이벤트 | 판단·상태 |

**Operator 모델(05):** hot path에 호출 없음. (a) governance-plane 등록, (b) **write-gate**로
상태 입력(자격 flag, 예외 해제, restricted-party 명단, 긴급정지) → 엔진은 **read-gate**로
읽기만. override는 **강화 방향만**(loosening 차단, 타입 레벨 의도). 카운터 등 runtime 수치는
operator가 직접 못 씀(엔진 commit만 기록).

---

## 7. 데이터 흐름

```
User → ExecutionRouter.execute(request)            [동작] nonce/deadline/decision, nonReentrant
        ▼
     ComplianceEngine.evaluate(ctx)
        │ [동작] TokenPolicyRegistry → ManifestCore → 상태 분기(fail-closed/passThrough)
        │ [동작] 적용 recipe 집합 → element union/dedup → coverageScope 차감
        │ [mock] 각 element.check() 법률 판정은 illustrative
        │ [동작] AND 집계 + DecisionHashLib → ComplianceDecision
        ▼
     VenueSelector  [동작] decision 바인딩 venue/type만 허용 (suspended 거부)
        ▼
     UniswapV3Adapter.execute(req, decision)        [동작] pool/callback origin, decision 바인딩
        ▼
     MockPool.swap → (콜백) transferFrom(user→pool) → ERC-3643.transfer(pool→user)
                                                     [동작] 실제 T-REX isVerified/canTransfer
        ▼
     ExecutionRouter → ComplianceEngine.commit(ctx)  [동작] STATEFUL element onTransfer(카운터/flag)
```

"배관은 진짜로 흐르고, 법률 판단만 mock."

---

## 8. ERC-3643 통합과 테스트 fixture

- 우리 코드는 T-REX 실제 인터페이스(`@erc3643/token/IToken.sol`,
  `@erc3643/registry/interface/IIdentityRegistry.sol`,
  `@erc3643/compliance/modular/IModularCompliance.sol`)를 통합 경계 타입으로 import.
- `test/fixtures/TREXSuite.sol` — Token이 생성자에서 `_disableInitializers()`를 호출하지
  않으므로 구현체 직접 배포 + `init()` 순서 호출(프록시 불필요):
  ClaimTopicsRegistry → TrustedIssuersRegistry → IdentityRegistryStorage →
  IdentityRegistry(+IRS bind) → ModularCompliance → Token. OnchainID로 토큰·투자자·pool
  Identity 배포, trusted issuer 서명 claim 추가 → `isVerified` 통과. Pool 주소를
  IdentityRegistry에 venue로 등록(custodian).

---

## 9. 테스트 전략

- **Unit:** policy 상태/버전, **ElementMetadata 정확성**, decisionHash 파라미터 바인딩,
  allowed venue type/주소, venue/operator suspension, AMM callback origin, `UNREGULATED`
  명시 처리, admin/execution 권한 분리, **strengthen-only override**, reasonCode 인코딩.
- **Integration(E2E):** 허용 매수/매도 성공 · 금지 방향 거부 · 미검증 수신자 거부 ·
  Layer2 policy 거부 · `canTransfer` 거부 시 전체 롤백 · suspended venue 거부 · decision
  재사용 거부 · **다중 recipe 누적 AND(issuance+fund 동시)** · **QP 조건부 활성화** ·
  **post-trade SurveillanceFlag(차단 안 함, 이벤트 emit)** · **operator 긴급정지 후 거부**.
- **Invariant:** 미등록 adapter 실행 불가 · maxAmount 초과 불가 · decision 재사용 불가 ·
  Router/Adapter 잔액 0 · suspended venue 신규 실행 불가 · transfer/Layer1~2 거부 시 잔액
  불변 · operator가 카운터 직접 못 씀.
- 완료선: `forge fmt --check`, `forge build`, `forge test` 전부 통과 + CI.

---

## 10. 구현 순서 (에이전트 병렬 분담)

인터페이스·타입을 **먼저 한 에이전트가 확정(계약 동결)** 한 뒤 병렬화.

1. **기반(직렬, 선행):** 의존성 설치 + remappings + foundry.toml + Counter 제거 +
   `types/`(enums·ElementMetadata·ManifestCore·context·decision) + `interfaces/`(전부) +
   `libraries/`(DecisionHashLib·ReasonCodes·Errors·Events) + `auth/Governed`.
   → 컴파일 통과(빈 구현 허용) = 동결 기준선.
2. **병렬 A — Registry:** Element/Recipe/TokenPolicy(ManifestCore)/Operator + 단위 테스트.
3. **병렬 B — Compliance:** BaseElement/BaseStatefulElement + mock Element 5종 + BaseRecipe
   + RegD506c/Fund3c7 + ComplianceEngine(다중 recipe·commit) + 단위 테스트.
4. **병렬 C — Execution:** ExecutionRouter(nonReentrant) + VenueRegistry + VenueSelector +
   UniswapV3Adapter + RFQ/OrderBook 스텁 + mock pool + 단위 테스트.
5. **병렬 D — Fixture/Infra:** TREXSuite + MockERC20 + Factory/Logging 골격.
6. **통합(직렬, 마지막):** integration E2E + invariant + CI + `forge fmt/build/test` 전체 통과.

---

## 11. 완료 기준

- 템플릿 코드 없이 `forge build` 성공(solc 0.8.17, T-REX 포함).
- 모든 unit/integration/invariant 테스트 통과 + `forge fmt --check` + CI.
- 미확정 정책은 permissive placeholder로 활성화하지 않음(mock·비활성).
- 사용자 이해용 문서: 각 레이어 동작/mock 경계 + 흐름.

---

## 12. 열린 결정 (하드코딩 금지, pluggable 유지)

| 결정 | 출처 | 골격 처리 |
| --- | --- | --- |
| 취득시점 acquisition 출처(Rule 144) | CR-3 (priority 1) | Lockup element는 주입형 source 인터페이스로, 실제 registry 미구현 |
| reject audit 영속화(revert vs (success,reason) vs off-chain) | CR-5 | decision에 reasonCode 보유, 영속화는 off-chain indexer 가정 + 문서화 |
| 긴급정지 규칙(unit/sig-threshold/auto-release) | 05 §6 | setter+event 파라미터화, 규칙은 미구현 |
| 월 분배 = new-mint vs rebase | 07 V-1 | PRIMARY_DISTRIBUTION rail discriminator + revert 스텁 |
| restricted-party 명단 갱신 주체 | OD-B1 | write-gated 사실로 저장, updater 권한은 pluggable |
| Element category 재분류(always-on 등) | OD-CI-5 | element는 다중 recipe에 attach 가능(registry), enum-lock 금지 |

---

## 13. 위험과 대응

- **T-REX 컴파일 충돌:** OZ v4.8.3 / solc 0.8.17 단일화. 스택 한도 시 `via_ir`/runs.
- **OnchainID claim fixture 복잡도:** trusted issuer 서명 → claim → `isVerified`까지 fixture
  helper로 캡슐화·재사용.
- **다중 recipe 엔진 복잡도:** union/dedup/coverageScope는 골격에서 정확히 구현하되 element
  판정만 mock. 엔진 arity는 지금 확정(후속 refactor 방지).
- **범위 팽창:** RFQ/OrderBook·rail·acquisition registry는 스텁/주입형 이상 구현 금지.
