# Corner Store 아키텍처 스켈레톤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `MVP-v2` + `docs/compliance/` 책임 경계를 Solidity 골격으로 구현한다 — 인터페이스/타입을 동결하고, 배선은 실제로 동작하며, 법률 판정만 mock인 상태로 `forge build`/`forge test`가 전부 통과한다.

**Architecture:** 인터페이스 우선 + 등록 기반 확장(G3). ExecutionRouter → ComplianceEngine(다중 Recipe 누적 AND) → VenueSelector → Adapter → 실제 ERC-3643(T-REX) transfer. Element는 `IComplianceElement` stable 시그니처, Manifest는 `ManifestCore`, Operator는 hot path 밖 상태 입력.

**Tech Stack:** Foundry, Solidity 0.8.17, OpenZeppelin v4.8.3, ERC-3643 T-REX(`@erc3643org/erc-3643`), OnchainID.

설계 근거: `docs/superpowers/specs/2026-06-13-skeleton-architecture-design.md`.

---

## 파일 구조 (책임 단위)

`src/types/` 와 `src/interfaces/` 는 **동결 대상**이며 Task 0에서 확정한다. 이후 모든
컴포넌트는 이 타입/인터페이스만 import 한다. 컴포넌트는 디렉터리로 분리되어 병렬 작업 시
파일 충돌이 없다.

- `src/types/{ComplianceTypes,ExecutionTypes,VenueTypes}.sol` — enum/struct (로직 없음)
- `src/libraries/{DecisionHashLib,ReasonCodes,Errors,Events}.sol` — 순수 라이브러리
- `src/auth/Governed.sol` — owner + role 분리 + write-gate modifier
- `src/interfaces/compliance/*.sol`, `src/interfaces/execution/**/*.sol` — 계약
- `src/registry/*.sol` — 4 레지스트리 (Task A)
- `src/compliance/**/*.sol` — 엔진 + mock element/recipe (Task B)
- `src/execution/**/*.sol` — router + venue + adapter (Task C)
- `src/factory/*.sol`, `src/logging/*.sol`, `test/fixtures/`, `test/mocks/` (Task D)
- `test/unit/`, `test/integration/` — 테스트

---

## Task 0: Foundation — 의존성, 타입, 인터페이스 동결 (직렬, 선행)

**Files:**
- Modify: `foundry.toml`, create `remappings.txt`
- Delete: `src/Counter.sol`, `test/Counter.t.sol`, `script/Counter.s.sol`
- Create: `src/types/ComplianceTypes.sol`, `src/types/ExecutionTypes.sol`, `src/types/VenueTypes.sol`
- Create: `src/libraries/{DecisionHashLib,ReasonCodes,Errors,Events}.sol`
- Create: `src/auth/Governed.sol`
- Create: all `src/interfaces/**/*.sol`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/heiji/Develop/Decipher/corner-store
forge install OpenZeppelin/openzeppelin-contracts@v4.8.3 --no-git
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v4.8.3 --no-git
forge install onchain-id/solidity --no-git
forge install ERC-3643/ERC-3643 --no-git
ls lib
```
Expected: `lib/` contains `openzeppelin-contracts`, `openzeppelin-contracts-upgradeable`, `solidity` (OnchainID), `ERC-3643`, `forge-std`. (`--no-git` because lib/ tracked directly; if the repo uses submodules, drop the flag. Confirm OnchainID dir name and adjust remapping.)

- [ ] **Step 2: Write `remappings.txt`**

```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
@onchain-id/solidity/=lib/solidity/
@erc3643/=lib/ERC-3643/contracts/
forge-std/=lib/forge-std/src/
```

- [ ] **Step 3: Set `foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.17"
optimizer = true
optimizer_runs = 200
fs_permissions = [{ access = "read", path = "./"}]
```

- [ ] **Step 4: Delete template files**

```bash
rm src/Counter.sol test/Counter.t.sol script/Counter.s.sol
```

- [ ] **Step 5: Verify ERC-3643 + OZ compile together**

```bash
forge build
```
Expected: PASS (compiles the installed libs even with no `src/` product code yet). If solc/remapping errors appear, fix before proceeding — this is the freeze gate. If stack-too-deep in T-REX, add `via_ir = true` to `foundry.toml`.

- [ ] **Step 6: Write `src/types/ComplianceTypes.sol`** (exact — frozen)

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

enum PolicyStatus { UNKNOWN, UNREGULATED, ACTIVE, SUSPENDED } // 0 = UNKNOWN, fail-closed
enum VenueType    { AMM, ORDER_BOOK, RFQ }
enum FlowType     { SECONDARY_TRADE, PRIMARY_DISTRIBUTION, REDEMPTION }

// 04-element-interface.md §2-3 (stable, verbatim)
enum ElementCategory { INVESTOR_ATTRIBUTE, ASSET_ATTRIBUTE, RESALE_TRANSACTION,
                       SYSTEM_STATE, ISSUER_STATUS, CONDUCT_MONITORING, PROCEDURAL }
enum Decidability    { DETERMINISTIC, ATTESTATION_BASED, MONITORING_BASED }
enum ObligationTiming{ EX_ANTE_VERIFY, AT_TRADE_GATE, EX_POST_TRIGGER }
enum Statefulness    { STATELESS, STATEFUL }
enum TemporalNature  { ONE_TIME, PERIODIC, REALTIME, CUMULATIVE }

struct ElementMetadata {
    bytes32 elementId;
    ElementCategory category;
    string  version;
    TemporalNature  temporal;
    Decidability    decidability;
    ObligationTiming timing;
    Statefulness    statefulness;
}

struct ManifestCore {
    PolicyStatus status;
    uint16 issuanceRecipeId;  uint16 issuanceRecipeVersion;
    uint16 fundRecipeId;
    uint32 enabledResalePaths;
    uint8  supportedEngines;
    uint16 stateScopeId;
    uint256 factsPacked;
    uint256 coverageScope;
    bytes32 fullManifestHash;
    address declaredBy;
    address approvedBy;
}

struct ComplianceContext {
    address initiator; address buyer; address seller;
    address tokenIn; address tokenOut;
    uint256 amountIn; uint256 amountOut;
    VenueType venueType; address venue;
    FlowType  flowType;
    bool      sellerIsAffiliate;
}

struct ComplianceDecision {
    bool allowed;
    bytes32 policyId; uint64 policyVersion; uint64 validUntil;
    uint256 maxAmount;
    uint256 allowedVenueTypes;
    bytes32 allowedVenuesHash;
    bytes32 reasonCode;
    bytes32 reliedClaims;
    bytes32 decisionHash;
}
```

- [ ] **Step 7: Write `src/types/ExecutionTypes.sol` and `src/types/VenueTypes.sol`**

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { ComplianceContext } from "./ComplianceTypes.sol";

struct ExecutionRequest {
    ComplianceContext context;
    uint256 amountOutMin;
    uint64  deadline;
    uint256 nonce;
    bytes   venueData;
}

struct ExecutionResult { uint256 amountOut; bytes32 executionId; }
```

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { VenueType } from "./ComplianceTypes.sol";

enum CustodyModel { NONE, POOL, ESCROW, OPERATOR }

struct VenueConfig {
    VenueType venueType;
    address   adapter;
    address   target;     // pool / market / settlement
    address   operator;
    CustodyModel custody;
    bool      active;
}
```

- [ ] **Step 8: Write `src/libraries/{Errors,Events,ReasonCodes,DecisionHashLib}.sol`**

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

library Errors {
    error NotAuthorized();
    error PolicyNotActive();        // UNKNOWN/SUSPENDED
    error ComplianceRejected(bytes32 reasonCode);
    error VenueNotAllowed();
    error VenueSuspended();
    error AdapterNotRegistered();
    error DeadlineExpired();
    error NonceUsed();
    error DecisionExpired();
    error DecisionMismatch();       // decisionHash != recomputed
    error MaxAmountExceeded();
    error ElementNotRegistered(bytes32 elementId);
    error LooseningForbidden();     // strengthen-only override
}

library Events {
    event ManifestRegistered(address indexed token, uint16 issuanceRecipeId, address declaredBy);
    event ManifestStatusChanged(address indexed token, PolicyStatus status, bytes32 reasonCode);
    event ElementRegistered(bytes32 indexed elementId, address element);
    event RecipeRegistered(uint16 indexed recipeId, uint16 version, address recipe);
    event VenueRegistered(address indexed venue, VenueType venueType, address adapter);
    event VenueSuspended(address indexed venue, bytes32 reasonCode);
    event ComplianceEvaluated(bytes32 indexed decisionHash, bool allowed, bytes32 reasonCode);
    event Executed(bytes32 indexed executionId, address indexed venue, uint256 amountOut);
    event SurveillanceFlag(bytes32 indexed elementId, address indexed subject, bytes32 reasonCode);
}
```
(Add `import "../types/ComplianceTypes.sol";` for `PolicyStatus`/`VenueType` in Events.)

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
// reasonCode = bytes32(abi.encodePacked(recipeId(2) | elementId(8) | code(4))) — 단순 packing
library ReasonCodes {
    bytes32 internal constant OK = bytes32(0);
    function encode(uint16 recipeId, bytes32 elementId, uint32 code) internal pure returns (bytes32) {
        return keccak256(abi.encode(recipeId, elementId, code));
    }
}
```

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { ComplianceContext } from "../types/ComplianceTypes.sol";
library DecisionHashLib {
    function compute(ComplianceContext memory c, uint256 maxAmount,
                     uint256 allowedVenueTypes, bytes32 allowedVenuesHash,
                     uint64 policyVersion, uint64 validUntil) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            c.initiator, c.buyer, c.seller, c.tokenIn, c.tokenOut,
            c.amountIn, c.amountOut, c.venueType, c.venue, c.flowType,
            maxAmount, allowedVenueTypes, allowedVenuesHash, policyVersion, validUntil));
    }
}
```

- [ ] **Step 9: Write `src/auth/Governed.sol`**

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Errors } from "../libraries/Errors.sol";

// owner = governance/admin. operators = state-input writers (write-gate).
abstract contract Governed is Ownable {
    mapping(address => bool) public isOperator;
    event OperatorSet(address indexed operator, bool enabled);

    modifier onlyOperator() {
        if (!isOperator[msg.sender] && msg.sender != owner()) revert Errors.NotAuthorized();
        _;
    }
    function setOperator(address op, bool enabled) external onlyOwner {
        isOperator[op] = enabled;
        emit OperatorSet(op, enabled);
    }
}
```

- [ ] **Step 10: Write all interfaces** under `src/interfaces/`

`compliance/IComplianceElement.sol`:
```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { ElementMetadata } from "../../types/ComplianceTypes.sol";
interface IComplianceElement {
    function check(address user, address counterparty, address asset,
                   uint256 amount, bytes calldata context)
        external view returns (bool passed, bytes32 reasonCode);
    function elementMetadata() external view returns (ElementMetadata memory);
}
interface IStatefulElement is IComplianceElement {
    function onTransfer(address from, address to, uint256 amount) external;
}
```

`compliance/IRecipe.sol`:
```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
interface IRecipe {
    function recipeId() external view returns (uint16);
    function version()  external view returns (uint16);
    function isApplicable(bytes calldata context) external view returns (bool);
    function requiredElements() external view returns (bytes32[] memory);
}
```

`compliance/IComplianceEngine.sol`:
```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { ComplianceContext, ComplianceDecision } from "../../types/ComplianceTypes.sol";
interface IComplianceEngine {
    function evaluate(ComplianceContext calldata ctx) external view returns (ComplianceDecision memory);
    function commit(ComplianceContext calldata ctx) external;
}
```

`compliance/IElementRegistry.sol`, `IRecipeRegistry.sol`, `ITokenPolicyRegistry.sol`, `IOperatorRegistry.sol`:
```solidity
// IElementRegistry
import { ElementMetadata } from "../../types/ComplianceTypes.sol";
interface IElementRegistry {
    function registerElement(bytes32 elementId, address element) external;
    function elementOf(bytes32 elementId) external view returns (address);
    function metadataOf(bytes32 elementId) external view returns (ElementMetadata memory);
}
// IRecipeRegistry
interface IRecipeRegistry {
    function registerRecipe(uint16 recipeId, uint16 version, address recipe) external;
    function recipeOf(uint16 recipeId) external view returns (address);
}
// ITokenPolicyRegistry  (Manifest store)
import { ManifestCore, PolicyStatus } from "../../types/ComplianceTypes.sol";
interface ITokenPolicyRegistry {
    function registerManifest(address token, ManifestCore calldata m) external;
    function manifestOf(address token) external view returns (ManifestCore memory);
    function statusOf(address token) external view returns (PolicyStatus);
    function setStatus(address token, PolicyStatus status, bytes32 reasonCode) external; // write-gate
    function setFact(address token, uint256 factsPacked) external;                       // strengthen-only
}
// IOperatorRegistry
interface IOperatorRegistry {
    function setVenueSuspended(address venue, bool suspended, bytes32 reasonCode) external;
    function isVenueSuspended(address venue) external view returns (bool);
}
```

`execution/IExecutionAdapter.sol`, `IExecutionRouter.sol`, `IVenueRegistry.sol`, `IVenueSelector.sol`, `adapters/{IAMMAdapter,IRFQAdapter,IOrderBookAdapter,IPool}.sol`:
```solidity
// IExecutionAdapter
import { ExecutionRequest, ExecutionResult } from "../../types/ExecutionTypes.sol";
import { ComplianceDecision } from "../../types/ComplianceTypes.sol";
interface IExecutionAdapter {
    function execute(ExecutionRequest calldata req, ComplianceDecision calldata decision)
        external returns (ExecutionResult memory);
}
interface IAMMAdapter is IExecutionAdapter {}
interface IRFQAdapter is IExecutionAdapter {}
interface IOrderBookAdapter is IExecutionAdapter {}
// IPool — minimal mock-pool callback surface (uniswap v3 콜백 모방)
interface IPool {
    function swap(address recipient, bool zeroForOne, int256 amountSpecified,
                  uint160 sqrtPriceLimitX96, bytes calldata data)
        external returns (int256 amount0, int256 amount1);
}
// IExecutionRouter
import { ExecutionRequest, ExecutionResult } from "../../types/ExecutionTypes.sol";
interface IExecutionRouter {
    function execute(ExecutionRequest calldata req) external returns (ExecutionResult memory);
}
// IVenueRegistry / IVenueSelector
import { VenueConfig } from "../../types/VenueTypes.sol";
import { ComplianceDecision, VenueType } from "../../types/ComplianceTypes.sol";
interface IVenueRegistry {
    function registerVenue(address venue, VenueConfig calldata cfg) external;
    function venueOf(address venue) external view returns (VenueConfig memory);
}
interface IVenueSelector {
    function validate(address venue, VenueType vtype, ComplianceDecision calldata d) external view returns (bool);
}
```

- [ ] **Step 11: Compile the freeze**

Run: `forge build`
Expected: PASS — interfaces/types/libs/auth compile (no implementations yet).

- [ ] **Step 12: Commit the freeze**

```bash
git add foundry.toml remappings.txt src/types src/libraries src/auth src/interfaces .gitmodules lib
git commit -m "feat(foundation): freeze types, interfaces, libs, auth + ERC-3643 deps"
```

---

## Task A: Registries (병렬 A)

**Files:** Create `src/registry/{ElementRegistry,RecipeRegistry,TokenPolicyRegistry,OperatorRegistry}.sol`; Test `test/unit/registry/*.t.sol`

각 레지스트리는 `Governed` 상속, 매핑 저장 + 이벤트 emit. 인터페이스는 Task 0 그대로 구현.

- [ ] **Step 1: Write failing test** `test/unit/registry/TokenPolicyRegistry.t.sol`

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { Test } from "forge-std/Test.sol";
import { TokenPolicyRegistry } from "../../../src/registry/TokenPolicyRegistry.sol";
import { ManifestCore, PolicyStatus } from "../../../src/types/ComplianceTypes.sol";

contract TokenPolicyRegistryTest is Test {
    TokenPolicyRegistry reg;
    address token = address(0xT0);
    function setUp() public { reg = new TokenPolicyRegistry(); }

    function test_unregistered_is_UNKNOWN() public {
        assertEq(uint8(reg.statusOf(token)), uint8(PolicyStatus.UNKNOWN));
    }
    function test_register_and_read() public {
        ManifestCore memory m;
        m.status = PolicyStatus.ACTIVE; m.issuanceRecipeId = 1; m.declaredBy = address(this);
        reg.registerManifest(token, m);
        assertEq(uint8(reg.statusOf(token)), uint8(PolicyStatus.ACTIVE));
        assertEq(reg.manifestOf(token).issuanceRecipeId, 1);
    }
    function test_setStatus_suspend_gated() public {
        ManifestCore memory m; m.status = PolicyStatus.ACTIVE; reg.registerManifest(token, m);
        reg.setStatus(token, PolicyStatus.SUSPENDED, bytes32("halt"));
        assertEq(uint8(reg.statusOf(token)), uint8(PolicyStatus.SUSPENDED));
    }
    function test_setStatus_reverts_for_non_operator() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        reg.setStatus(token, PolicyStatus.SUSPENDED, bytes32("x"));
    }
}
```

- [ ] **Step 2: Run → FAIL** (`forge test --match-contract TokenPolicyRegistryTest` → 컴파일 에러: 컨트랙트 없음)

- [ ] **Step 3: Implement `TokenPolicyRegistry`**

`ManifestCore` 매핑 저장, `statusOf`는 미등록 시 `UNKNOWN`(enum 0) 자동. `setStatus`/`setFact`는 `onlyOperator`. `setFact`는 strengthen-only: 새 `factsPacked`가 기존 비트의 superset이 아니면 `Errors.LooseningForbidden`(간단히 `new & old == old` 검사). `registerManifest`는 `onlyOwner`, `Events.ManifestRegistered` emit.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Repeat Steps 1-4 for `ElementRegistry`, `RecipeRegistry`, `OperatorRegistry`**

ElementRegistry: `registerElement(elementId, addr)` 저장, `metadataOf`는 해당 element의 `elementMetadata()` 호출 위임. 미등록 `elementOf` → `address(0)`. RecipeRegistry: `recipeId→addr`. OperatorRegistry: `setVenueSuspended` (`onlyOperator`) + `isVenueSuspended`. 각각 미등록/권한 거부 테스트 포함.

- [ ] **Step 6: Commit**

```bash
git add src/registry test/unit/registry
git commit -m "feat(registry): Element/Recipe/TokenPolicy/Operator registries"
```

---

## Task B: Compliance — mock Elements, Recipes, Engine (병렬 B)

**Files:** Create `src/compliance/elements/{BaseElement,BaseStatefulElement,Sanctions,AccreditedInvestor,QualifiedPurchaser,Lockup,SurveillanceFlag}.sol`, `src/compliance/recipes/{BaseRecipe,RegD506cRecipe,Fund3c7Recipe}.sol`, `src/compliance/ComplianceEngine.sol`; Test `test/unit/compliance/*.t.sol`

mock element는 config 가능한 bool로 판정한다(법률 로직 없음). `elementMetadata()`는 §5.4 표의 값.

- [ ] **Step 1: Write failing test** `test/unit/compliance/Elements.t.sol`

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { Test } from "forge-std/Test.sol";
import { SanctionsElement } from "../../../src/compliance/elements/Sanctions.sol";
import { ElementMetadata, Decidability } from "../../../src/types/ComplianceTypes.sol";

contract ElementsTest is Test {
    SanctionsElement el;
    function setUp() public { el = new SanctionsElement(); }
    function test_metadata_id() public {
        ElementMetadata memory m = el.elementMetadata();
        assertEq(m.elementId, bytes32("A-01-v1"));
        assertEq(uint8(m.decidability), uint8(Decidability.DETERMINISTIC));
    }
    function test_blocked_address_fails() public {
        el.setBlocked(address(0xBAD), true);
        (bool ok,) = el.check(address(0xBAD), address(0), address(0), 0, "");
        assertFalse(ok);
    }
    function test_clean_address_passes() public {
        (bool ok,) = el.check(address(0x111), address(0), address(0), 0, "");
        assertTrue(ok);
    }
}
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement `BaseElement`** (metadata 보관 + 추상 check) and `SanctionsElement`

```solidity
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;
import { IComplianceElement } from "../../interfaces/compliance/IComplianceElement.sol";
import { ElementMetadata } from "../../types/ComplianceTypes.sol";
abstract contract BaseElement is IComplianceElement {
    ElementMetadata internal _meta;
    function elementMetadata() external view returns (ElementMetadata memory) { return _meta; }
    function check(address,address,address,uint256,bytes calldata)
        external view virtual returns (bool, bytes32);
}
```
`SanctionsElement`: `mapping(address=>bool) blocked; setBlocked(...)`. `check` returns `(!blocked[user], blocked[user] ? bytes32("SANCTIONED") : 0)`. constructor sets `_meta = ElementMetadata("A-01-v1", INVESTOR_ATTRIBUTE, "1", REALTIME, DETERMINISTIC, AT_TRADE_GATE, STATELESS)`.

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Implement remaining mock elements** (each with test for pass/fail + metadata)

- `AccreditedInvestor` (A-03, ATTESTATION_BASED, EX_ANTE_VERIFY): `mapping(address=>bool) accredited`; check on `user`.
- `QualifiedPurchaser` (A-13, ATTESTATION_BASED): `mapping(address=>bool) qp`; check on `user`. (조건부 활성화는 Recipe가 관장.)
- `Lockup` (C-01): inject `acquisitionSource` address + interface `IAcquisitionSource { function acquiredAt(address holder, address asset) external view returns (uint64); }`; check `block.timestamp >= acquiredAt + lockupSeconds`. mock source in test/mocks. (CR-3 자리.)
- `SurveillanceFlag` (F-02, MONITORING_BASED, EX_POST_TRIGGER, STATEFUL) extends `BaseStatefulElement implements IStatefulElement`: `check` always returns `(true, 0)` (차단 안 함). `onTransfer` increments a counter and emits `Events.SurveillanceFlag` when over a threshold.

`BaseStatefulElement` = `BaseElement` + `function onTransfer(address,address,uint256) external virtual {}`.

- [ ] **Step 6: Write failing test** `test/unit/compliance/Engine.t.sol` (multi-recipe AND)

```solidity
// 핵심 케이스만 (full setUp in implementation):
// - manifest ACTIVE + issuanceRecipe(RegD506c: Sanctions+Accredited) → buyer accredited & clean → allowed=true
// - buyer not accredited → allowed=false, reasonCode != 0
// - manifest fundRecipeId set (Fund3c7: +QP) → buyer not QP → allowed=false  (조건부 활성화 증명)
// - manifest UNKNOWN → allowed=false (fail-closed)
// - both tokens UNREGULATED → allowed=true (passThrough)
// - decisionHash != 0 and differs when amount changes
```

- [ ] **Step 7: Implement `BaseRecipe`, `RegD506cRecipe`, `Fund3c7Recipe`**

`BaseRecipe`: stores `recipeId/version`, `bytes32[] elements`, `isApplicable` default true. `RegD506cRecipe.requiredElements() = ["A-01-v1","A-03-v1"]`. `Fund3c7Recipe.requiredElements() = ["A-13-v1"]`, `isApplicable` parses `factsPacked` bit0 (fund flag) from context.

- [ ] **Step 8: Implement `ComplianceEngine`** (spec §5.3 algorithm)

constructor injects `ITokenPolicyRegistry`, `IElementRegistry`, `IRecipeRegistry`. `evaluate`:
1. `m = policyReg.manifestOf(tokenRWA)`; status 분기 (UNKNOWN/SUSPENDED → allowed=false; UNREGULATED both → passThrough allowed=true).
2. candidate recipes = [issuanceRecipeId] + (fundRecipeId!=0 ? [fundRecipeId] : []).
3. for each → resolve via recipeReg, `isApplicable(abi.encode(m.factsPacked, ctx))` → collect `requiredElements()`.
4. union/dedup (bytes32 set via memory array + seen check). coverageScope 차감(`if coverage bit set skip` — 간단히 elementId index 매핑은 mock에선 생략 가능, 주석으로 표기).
5. for each elementId → `elementReg.elementOf` → `IComplianceElement.check(buyer, seller, tokenRWA, amount, ctx)` → AND. fail → `reasonCode = ReasonCodes.encode(recipeId, elementId, 1)`, break.
6. build `ComplianceDecision` (decisionHash via DecisionHashLib, allowedVenueTypes from supportedEngines, validUntil = block.timestamp + 1 days, reliedClaims = 0 mock). emit `ComplianceEvaluated`.

`commit`: re-resolve applied elements, for STATEFUL (metadata.statefulness==STATEFUL) call `IStatefulElement.onTransfer`. (try/catch or interface cast.)

- [ ] **Step 9: Run → PASS** all Task B tests

- [ ] **Step 10: Commit**

```bash
git add src/compliance test/unit/compliance
git commit -m "feat(compliance): mock elements/recipes + multi-recipe engine"
```

---

## Task C: Execution — Router, Venue, Adapters (병렬 C)

**Files:** Create `src/execution/{ExecutionRouter,VenueRegistry,VenueSelector}.sol`, `src/execution/adapters/amm/UniswapV3Adapter.sol`, `src/execution/adapters/rfq/RFQAdapter.sol`, `src/execution/adapters/orderbook/OrderBookAdapter.sol`; Test `test/unit/execution/*.t.sol`

- [ ] **Step 1: Write failing test** `test/unit/execution/Router.t.sol`

```solidity
// 핵심 케이스:
// - execute() with stubbed engine returning allowed=true → adapter.execute called, returns amountOut
// - engine returns allowed=false → revert ComplianceRejected(reasonCode)
// - expired deadline → revert DeadlineExpired
// - reused nonce → revert NonceUsed
// - suspended venue (operatorReg) → revert VenueSuspended
// 테스트는 MockEngine, MockAdapter(test/mocks)로 격리
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement `VenueRegistry`, `VenueSelector`**

VenueRegistry: `Governed`, `mapping(address=>VenueConfig)` + register(`onlyOwner`)/read. VenueSelector: `validate(venue, vtype, decision)` = decision.allowed && (decision.allowedVenueTypes & (1<<uint(vtype))) != 0 && venue ∈ decision.allowedVenuesHash (mock: allowedVenuesHash==0 means any).

- [ ] **Step 4: Implement `ExecutionRouter`**

`Governed` + `ReentrancyGuard` (OZ). constructor injects `IComplianceEngine`, `IVenueRegistry`, `IVenueSelector`, `IOperatorRegistry`. `execute(req) nonReentrant`:
1. `require(block.timestamp <= req.deadline)` else `DeadlineExpired`.
2. nonce: `mapping(address=>mapping(uint256=>bool)) used`; revert `NonceUsed` if set, else set.
3. `decision = engine.evaluate(req.context)`; if `!decision.allowed` revert `ComplianceRejected(decision.reasonCode)`.
4. venue suspended check via operatorReg → `VenueSuspended`.
5. `venueSelector.validate(...)` else `VenueNotAllowed`.
6. `cfg = venueReg.venueOf(req.context.venue)`; `require(cfg.active && cfg.adapter != address(0))` else `AdapterNotRegistered`.
7. `result = IExecutionAdapter(cfg.adapter).execute(req, decision)`.
8. `engine.commit(req.context)` (post-trade hook).
9. emit `Executed`; return result.

- [ ] **Step 5: Run → PASS** (router unit with mocks)

- [ ] **Step 6: Implement `UniswapV3Adapter` + mock pool wiring**

Adapter holds `factory`/registered pool set; `execute` validates `req.context.venue` is a registered pool, calls `IPool.swap(...)`, and in the callback (`uniswapV3SwapCallback` style — for mock pool use a simple callback) does `transferFrom(buyer→pool)`. For the skeleton the MockPool calls back into the adapter; adapter pulls tokenIn from buyer and the pool sends tokenOut. Keep callback-origin check: `require(msg.sender == registeredPool)`. Return `ExecutionResult`.

- [ ] **Step 7: Implement `RFQAdapter`, `OrderBookAdapter` stubs**

```solidity
function execute(ExecutionRequest calldata, ComplianceDecision calldata)
    external pure returns (ExecutionResult memory) { revert("RFQ: not implemented"); }
```
Add a unit test asserting they revert.

- [ ] **Step 8: Run → PASS; Commit**

```bash
git add src/execution test/unit/execution
git commit -m "feat(execution): router, venue registry/selector, AMM adapter + RFQ/OB stubs"
```

---

## Task D: Fixtures, Mocks, Factory, Logging (병렬 D)

**Files:** Create `test/fixtures/TREXSuite.sol`, `test/mocks/{MockERC20,MockPool,MockEngine,MockAdapter,MockAcquisitionSource}.sol`, `src/factory/{CornerStoreFactory,UniswapV3VenueFactory}.sol`, `src/logging/{ComplianceLogger,ExecutionLogger}.sol`

- [ ] **Step 1: Implement `test/mocks/*`** — `MockERC20` (OZ ERC20), `MockPool` (callback into adapter, swaps fixed ratio), `MockEngine` (returns configurable decision), `MockAdapter` (records call, returns amountOut), `MockAcquisitionSource` (settable acquiredAt).

- [ ] **Step 2: Implement `test/fixtures/TREXSuite.sol`** (spec §8 order)

Solidity helper contract that deploys real T-REX impls and calls `init()` in order: ClaimTopicsRegistry, TrustedIssuersRegistry, IdentityRegistryStorage, IdentityRegistry (+ `bindIdentityRegistry`), ModularCompliance, Token. Deploy OnchainID `Identity` for token + investors, add a trusted issuer + claim topic, sign a claim so `identityRegistry.isVerified(investor)` is true. Expose helpers: `deployToken()`, `verifyInvestor(addr)`, `registerVenue(poolAddr)`.

- [ ] **Step 3: Write a fixture sanity test** `test/integration/TREXFixture.t.sol`

```solidity
// - deploy suite, verifyInvestor(alice) → token.identityRegistry().isVerified(alice) == true
// - unverified bob → isVerified(bob) == false
// - token.transfer to unverified reverts (canTransfer/isVerified)
```
Run → PASS. This de-risks the hardest part early.

- [ ] **Step 4: Implement `ComplianceLogger`, `ExecutionLogger`** — thin event emitters (`logEvaluation`, `logExecution`, `logSurveillanceFlag`). Unit test asserts events.

- [ ] **Step 5: Implement `CornerStoreFactory`, `UniswapV3VenueFactory` skeleton** — orchestration funcs that call registries in sequence (`computePoolAddress` stub returning deterministic addr, `registerRWAToken` calling policyReg+venueReg). Unit test asserts registration side-effects.

- [ ] **Step 6: Commit**

```bash
git add test/fixtures test/mocks src/factory src/logging test/integration/TREXFixture.t.sol
git commit -m "test(fixtures): TREX suite + mocks; feat: factory/logging skeleton"
```

---

## Task E: Integration E2E + Invariants (직렬, 마지막)

**Files:** Create `test/integration/{SwapFlow,MultiRecipe,Surveillance,EmergencyPause,Invariants}.t.sol`

- [ ] **Step 1: Write E2E `SwapFlow.t.sol`** — full wiring: deploy registries, register Sanctions+Accredited elements, RegD506c recipe, manifest ACTIVE for the T-REX token, register mock pool venue + UniswapV3Adapter, verify alice via TREXSuite. Cases:
  - buy direction (tokenOut=RWA), alice verified+accredited → success, balances move.
  - sell direction (tokenIn=RWA) → success.
  - forbidden direction (manifest disables) → `ComplianceRejected`.
  - unverified receiver → ERC-3643 transfer reverts → whole swap rolls back (balances unchanged).
  - Layer2 reject (not accredited) → revert before pool.

- [ ] **Step 2: Write `MultiRecipe.t.sol`** — manifest with fundRecipeId set; buyer accredited but not QP → rejected (조건부 활성화 AND 증명). buyer QP → success.

- [ ] **Step 3: Write `Surveillance.t.sol`** — SurveillanceFlag element registered & in recipe; swap succeeds (not blocked) and `engine.commit` emits `SurveillanceFlag` after threshold.

- [ ] **Step 4: Write `EmergencyPause.t.sol`** — operator suspends venue (operatorReg) → next execute reverts `VenueSuspended`. Also policyReg setStatus SUSPENDED → `ComplianceRejected`/PolicyNotActive.

- [ ] **Step 5: Write `Invariants.t.sol`** — assertions: unregistered adapter reverts; amount > decision.maxAmount reverts `MaxAmountExceeded`; reusing a decision (different ctx) fails `DecisionMismatch`; router/adapter token balance == 0 after swap; suspended venue blocks.

- [ ] **Step 6: Run full suite + format**

```bash
forge fmt
forge build
forge test -vv
```
Expected: ALL PASS, fmt clean.

- [ ] **Step 7: Add CI** `.github/workflows/ci.yml` (forge fmt --check, build, test). Commit.

```bash
git add test/integration .github/workflows/ci.yml
git commit -m "test(e2e): integration flows + invariants + CI"
```

---

## Self-Review notes (spec coverage)

- IComplianceElement/IStatefulElement/ElementMetadata/5 enums → Task 0 Step 6, 10; Task B.
- ManifestCore + TokenPolicyRegistry → Task 0, Task A.
- 다중 recipe 누적 AND + 조건부 활성화 + commit → Task B Step 8; Task E Step 2.
- Operator state-input + 긴급정지 + surveillance event → Task A (OperatorRegistry), Task E Step 4, Task D logging.
- FlowType rail discriminator → in ComplianceContext (Task 0); rail 실제 구현은 out of scope (revert stub via VenueType set only).
- ERC-3643 실제 배포 fixture → Task D Step 2-3.
- decisionHash 재사용 불가, maxAmount, 잔액 0 invariants → Task E Step 5.
- fail-closed (UNKNOWN/SUSPENDED), UNREGULATED passThrough → Task B Step 8; Task A tests.
- 열린 결정(acquisition source 주입, reject audit off-chain) → Lockup inject (Task B Step 5), 문서화.
