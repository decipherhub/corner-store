# 데모 블로커 답변

PM이 이번 주 데모 시나리오 설계를 위해 확인을 요청한 두 가지 질문에 대한 답변이다.

## Q1. venue 단위 전체 자산 halt가 존재하는가

**결론: 존재한다. 단, 요청한 시나리오("issuer가 조용히 규칙을 바꾸고, 다음 거래부터 전체 자산이 halt된다")는 코드와 3곳이 어긋난다. 코드에 맞는 대안 두 개를 아래에서 고른다.**

### 존재 확인

- `OperatorRegistry.setVenueSuspended(address venue, bool, bytes32 reasonCode)` (`src/registry/OperatorRegistry.sol:88`).
- 강제 지점은 `src/execution/ExecutionRouter.sol:60`: `if (operatorReg.isVenueSuspended(req.context.venue)) revert Errors.VenueSuspended();`
- 이 체크는 `req.context.venue`만 본다. `tokenIn`/`tokenOut`는 보지 않는다. 즉 호출 한 번으로 그 venue의 모든 자산이 halt된다.
- nonce 소비와 컴플라이언스 평가보다 먼저 실행된다 (`ExecutionRouter.sol:55-56` 주석: 닫힌 control plane이 유저의 replay slot을 태우지 않도록 게이트를 먼저 돈다는 취지). 다음 `execute()` 호출부터 즉시 유효하다. timelock 없음.
- 호출자는 `onlyOperator` (operator 또는 owner, `src/auth/Governed.sol:13-16`).
- 형제 레버: `setGlobalPaused` (`OperatorRegistry.sol:28`), `setAssetSuspended` (`OperatorRegistry.sol:58`). 셋 다 `ExecutionRouter.sol:57-60`에서 체크된다.

### 시나리오와 코드가 어긋나는 지점 3가지

1. **actor가 다르다.** 전체 자산을 즉시 halt하는 레버는 issuer가 아니라 operator의 것이다.
2. **조용하지 않다. 설계상 그렇다.** `setVenueSuspended`는 `Events.VenueSuspended(venue, reasonCode)`를 emit하고 `_recordPause`를 통해 `pauseHistoryHash`에 append한다 (`OperatorRegistry.sol:93-95`). 필수 인자인 `bytes32 reasonCode` 때문에 모든 halt는 귀책 추적이 가능하다. `DECISIONS.md` D011이 이를 의도된 설계라고 명시한다.
3. **규칙 변경은 즉시가 아니라 timelock이 걸린다.** 정책 의미를 바꾸는 governance 경로는 `TokenPolicyRegistry.scheduleManifestUpdate` -> `MIN_MANIFEST_DELAY = 1 days` 경과 -> `activateManifestUpdate` (onlyOperator) 순서다. 트랜잭션 2번, 최소 1일 간격. 규칙 수정이 다음 거래부터 조용히 적용되는 경로는 존재하지 않는다. D011의 원칙: 리스크를 줄이는 조치(pause, manifest suspend)는 즉시, 재개와 Manifest 의미 변경은 timelock.
   즉시 실행되는 유일한 정책 레버는 `TokenPolicyRegistry.suspendManifest` (`src/registry/TokenPolicyRegistry.sol:147`)인데, 이건 자산별로 한 번씩 호출해야 해서 "전체 자산"을 한 번에 halt할 수 없다.

### 테스트넷에서 실현 가능한가

- `MIN_UNPAUSE_DELAY` (`OperatorRegistry.sol:10`)와 `MIN_MANIFEST_DELAY` (`TokenPolicyRegistry.sol:28`)는 둘 다 `uint64 public constant = 1 days`이고 배포별로 설정 불가능하다. Anvil에서는 시간을 warp할 수 있지만 GIWA Sepolia에서는 불가능하므로, timelock이 실제로 경과해야 하는 시나리오는 실제 24시간 대기가 필요하다.
- `script/DemoScenarios.s.sol`의 "Scenario 4 - Lifecycle" (205-228행)이 이미 이 문제를 풀어놓았다. `factory.scheduleManifestResume(...)`를 호출한 뒤 `effectiveTime == block.timestamp + policyReg.MIN_MANIFEST_DELAY()`를 assert하는 방식으로, timelock이 경과하기를 기다리지 않고 그 보장을 "보여주는" 패턴이다. 새 시나리오도 이 패턴을 그대로 따라야 한다.
- `setVenueSuspended`나 `setGlobalPaused`를 실행하는 데모 시나리오나 CLI 명령은 현재 없다. CLI는 `manifest <status|suspend|resume|retire>`만 노출한다. 이 시나리오는 새로 만들어야 하는 작업이다.
- `test/integration/EmergencyPause.t.sol`이 세 레버 전부를 테스트하지만 (`test_venueSuspended_blocksSwap` 등), fixture (`test/integration/IntegrationBase.sol`)가 RWA 토큰을 하나만 세팅해서 venue halt의 "여러 자산 동시 halt" 특성은 어떤 테스트로도 증명되지 않는다. 코드 검토로는 사실이지만(체크가 venue만 봄) 테스트 커버리지는 없다.

### 코드에 맞는 시나리오 옵션 두 가지

**Option A ("사고 대응" framing)**: operator가 인시던트를 감지하고 `setVenueSuspended`를 호출한다. 그 venue의 다음 거래부터 모든 자산이 `VenueSuspended`로 revert된다. 이어서 `scheduleVenueUnpause`로 복구도 1일 timelock이 걸려서 아무도 몰래 다시 켤 수 없음을 보여준다. GIWA testnet에서 대기 없이 동작한다. 새 컨트랙트 작업이 필요 없는 가장 강력한 시나리오.

**Option B ("발행인 규칙 변경" framing, issuer를 actor로 유지)**: issuer가 manifest update를 스케줄링하고, 시나리오의 포인트를 "이 변경은 즉시 적용될 수 없다"로 바꾼다. 1일 timelock과 append-only history가 눈에 보이는 결과가 된다. "issuer가 조용히 거래를 죽일 수 있다"는 비트를 "issuer는 아무것도 조용히 바꿀 수 없다"로 뒤집는 것이며, 컴플라이언스 제품으로서는 오히려 더 나은 스토리일 수 있다.

권장: "한 번에 전부 멈춘다"는 비주얼이 목적이면 A, issuer를 actor로 유지하고 싶으면 B. issuer + silent + instant + all-asset을 전부 결합한 시나리오는 코드상 정직하게 만들 수 없다는 점을 분명히 밝혀야 한다 (위 3가지 어긋남 참고).

Option A의 전제 조건: "전체 자산"을 시각적으로 증명하려면 같은 venue에 두 번째 RWA 자산이 데모 스택에 있어야 한다. 그렇지 않으면 자산 하나가 halt되는 장면만 보이고 "전체"라는 부분은 내레이션으로만 남는다.

## Q2. GIWA testnet의 결제/정산 자산은 무엇인가

**결론: 이미 존재하고 배포되어 있다. 기존 18-decimal mock `tqUSD`를 그대로 쓸 것을 권장한다.**

### 확인된 사실

- `script/DeployTestnetRFQ.s.sol:226`: `quoteToken = new MockERC20("Testnet Quote USD", "tqUSD");`
- `MockERC20` (`test/mocks/MockERC20.sol`)은 `decimals()`를 override하지 않으므로 OpenZeppelin 기본값인 18 decimals다.
- `script/DeployTestnetRFQ.s.sol:232`: `policyReg.setUnregulated(address(quoteToken))`. 이 호출은 load-bearing이다: `PolicyStatus`는 기본값이 `UNKNOWN`이고, `ComplianceEngine.evaluate`는 등록되지 않은 토큰에 대해 fail-closed한다 (`src/compliance/ComplianceEngine.sol:83-87`; `_isPermitted`는 `:93-95`에서 `UNREGULATED`와 `ACTIVE`만 허용). 결제 토큰을 교체한다면 반드시 이 호출을 같이 넣어야 하며, 빠지면 모든 거래가 revert된다.
- 결제 leg는 ERC-3643일 필요가 없다: RFQ 정산은 양쪽 leg 모두 plain `SafeERC20.safeTransferFrom`이다 (`src/execution/adapters/rfq/RFQAdapter.sol:76-77`).
- GIWA 배포는 RFQ-only다 (`docs/testnet-deployment.md`), 따라서 AMM pool 유동성은 이 결정과 무관하다.
- 외부 조사: GIWA Sepolia는 Circle의 공식 USDC 주소 목록에 없다. 공식 GIWA testnet stablecoin도 확인되지 않았다. WETH9는 표준 OP-Stack predeploy 주소 `0x4200000000000000000000000000000000000006`에 존재한다. GIWA 파우셋은 test ETH만 지급한다.

### 권장: 기존 18-decimal mock `tqUSD` 유지

이유:

- GIWA Sepolia에 canonical bridged USDC가 없다. 실제 Sepolia USDC를 브릿지하면 참가자마다 파우셋+브릿지 마찰이 추가되는데, 그렇게 해도 아무것도 백업되지 않은 토큰인 건 동일하다.
- 엔진은 결제 leg를 어차피 `UNREGULATED`로 취급하므로, "진짜" 자산을 쓴다고 엔지니어링 fidelity가 올라가지 않는다.
- 6-decimal로 마이그레이션하는 건 데모 주간에 불필요한 리스크다. 배포 스크립트의 잔고 상수 (`script/DeployTestnetRFQ.s.sol:164,166`)는 `1e18` 스케일 리터럴이고, `services/cli/src/commands.ts:1381,1426,1700`는 `parseEther` (18 decimals)를 하드코딩한다. 브라우저 UI는 `decimals()`를 런타임에 읽어서 (`services/testnet-rfq-demo/src/runtime.ts:333-336`) 6 decimals도 견디지만, CLI는 조용히 가격을 잘못 계산하게 된다.
- 이름 "Testnet Quote USD"/"tqUSD"는 이미 명백히 가짜 자산임을 드러낸다. 이걸로 충분한지만 확인하면 되고, rename 작업을 새로 만들 필요는 없다.

### 대안 비교

| 대안 | 채택하지 않은 이유 |
| --- | --- |
| predeploy WETH9 (`0x4200...0006`)를 bridge | 결제 자산 성격과 안 맞음 (native가 아닌 WETH를 결제 단위로 쓰는 건 부자연스러움), decimals는 18이라 이점 없음 |
| Sepolia 실제 USDC를 수동 브릿지 | GIWA에 공식 브릿지/USDC 배포가 확인되지 않음, 참가자별 파우셋+브릿지 마찰 추가, 브릿지된 것도 진짜 담보 자산은 아님 |
| 6-decimal mock으로 재배포 | CLI(`services/cli/src/commands.ts:1381,1426,1700`)의 `parseEther` 하드코딩과 배포 스크립트의 `1e18` 잔고 상수(`script/DeployTestnetRFQ.s.sol:164,166`) 수정이 필요, 데모 주간에 감당할 리스크 대비 얻는 이득(cosmetic realism)이 작음 |

PM이 위 트레이드오프를 보고 override할 수 있도록 표로 남긴다.
