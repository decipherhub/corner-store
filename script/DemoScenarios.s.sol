// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {CornerStoreFactory} from "../src/factory/CornerStoreFactory.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {Jurisdiction} from "../src/compliance/elements/Jurisdiction.sol";
import {SurveillanceFlag} from "../src/compliance/elements/SurveillanceFlag.sol";
import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {UniswapV3Adapter} from "../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQQuote} from "../src/execution/adapters/rfq/RFQTypes.sol";

import {ExecutionRequest} from "../src/types/ExecutionTypes.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    ManifestCore,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode,
    VenueType,
    FlowType
} from "../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../src/types/VenueTypes.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {ReasonCodes} from "../src/libraries/ReasonCodes.sol";
import {DemoConstants} from "./DemoConstants.sol";
import {BuidlLikeDemoAsset} from "../src/demo/BuidlLikeDemoAsset.sol";

/// @title DemoScenarios
/// @notice The live-Anvil E2E scenario runner + stakeholder DEMO (deliverable 2).
///         Reads the {DeployStack} artifact and drives the 7-scenario suite
///         against the live node, printing a one-line narrative + observable
///         evidence + PASS/FAIL per scenario. Any FAIL reverts the script → the
///         shell runner exits non-zero.
///
/// @dev Two execution modes are used deliberately:
///   - `vm.broadcast(pk)` for state-changing steps that must PERSIST on-chain and
///     must originate from a specific account (onboarding as deployer/operator,
///     compliant trades as the investor).
///   - `vm.prank(addr)` + `try/catch` for steps that are EXPECTED TO REVERT
///     (compliance / policy / authz rejections). A reverting call is never
///     broadcast; pranking sets `msg.sender` so the router reaches the real gate
///     instead of the caller-binding check.
contract DemoScenarios is Script, DemoConstants {
    // --- resolved from the artifact --------------------------------------
    address internal deployer;
    address internal investor;
    address internal maker;
    address internal unapprovedMaker;

    uint256 internal deployerPk;
    uint256 internal investorPk;
    uint256 internal makerPk;
    uint256 internal unapprovedMakerPk;

    IERC20 internal rwa;
    IERC20 internal quote;
    address internal pool;

    CornerStoreFactory internal factory;
    TokenPolicyRegistry internal policyReg;
    Jurisdiction internal jurisdiction;
    SurveillanceFlag internal surveillance;
    ExecutionRouter internal router;
    UniswapV3Adapter internal ammAdapter;
    RFQAdapter internal rfqAdapter;
    bool internal useBuidlLikeProfile;
    uint256 internal tradeAmount;
    uint256 internal rfqBuyAmountOut;
    uint256 internal sellTradeAmount;
    uint256 internal rfqSellAmountOut;
    uint64 internal quoteTtlSeconds;

    // per-initiator router nonce sequence for the investor.
    uint256 internal nonceSeq = 1;

    // scenario bookkeeping.
    uint256 internal constant N = 7;
    bool[N + 1] internal passed; // 1-indexed
    string[N + 1] internal titles;

    function run() external {
        _load();

        _scenario1_onboarding();
        _scenario2_compliantTrade();
        _scenario3_elementRejection();
        _scenario5_rfq();
        _scenario6_surveillance();
        _scenario7_bypass();
        // Keep the asset suspended with a pending recovery at the end of this
        // broadcast. scripts/e2e-anvil.sh advances the real Anvil clock, then
        // executes the delayed resume and proves settlement through the CLI.
        _scenario4_lifecycle();

        _summary();
    }

    // ---------------------------------------------------------------------
    // Scenario 1 — Onboarding
    // ---------------------------------------------------------------------
    function _scenario1_onboarding() internal {
        _title(
            1,
            useBuidlLikeProfile
                ? "Onboarding: factory one-call onboards the BUIDL-like ERC-3643 asset"
                : "Onboarding: factory one-call onboards the Reg D ERC-3643 asset"
        );

        ManifestCore memory m = _baseManifest();
        RecipeBinding[] memory bindings = _baseBindings();

        VenueConfig memory ammCfg = VenueConfig({
            venueType: VenueType.AMM,
            adapter: address(ammAdapter),
            target: pool,
            operator: address(0),
            custody: CustodyModel.POOL,
            active: true
        });

        vm.broadcast(deployerPk);
        factory.registerRWAToken(address(rwa), m, bindings, pool, ammCfg);

        ManifestCore memory stored = policyReg.manifestOf(address(rwa));
        ManifestCore memory expected = _baseManifest();
        RecipeBinding[] memory storedBindings = policyReg.recipeBindingsOf(address(rwa));
        bool profileOk = keccak256(abi.encode(storedBindings)) == keccak256(abi.encode(bindings))
            && stored.factsPacked == expected.factsPacked && stored.fullManifestHash == expected.fullManifestHash;
        bool ok = stored.status == PolicyStatus.ACTIVE && stored.declaredBy == address(factory)
            && stored.approvedBy == address(factory) && profileOk;
        _writeManifestSnapshot(stored, storedBindings);
        console2.log("    evidence: ACTIVE selected asset profile, approved by factory");
        console2.log("      status(2=ACTIVE) :", uint256(stored.status));
        _record(1, ok);
    }

    function _writeManifestSnapshot(ManifestCore memory manifest, RecipeBinding[] memory bindings) internal {
        string memory k = "corner-store-manifest";
        vm.serializeAddress(k, "token", address(rwa));
        vm.serializeUint(k, "status", uint8(manifest.status));
        vm.serializeUint(k, "version", policyReg.manifestVersionOf(address(rwa)));
        vm.serializeBytes32(k, "fullManifestHash", manifest.fullManifestHash);
        vm.serializeBytes32(k, "historyHash", policyReg.manifestHistoryHashOf(address(rwa)));
        vm.serializeUint(k, "recipeBindingCount", bindings.length);
        string memory json = vm.serializeUint(k, "supportedEngines", manifest.supportedEngines);
        vm.writeJson(json, MANIFEST_SNAPSHOT_PATH);
    }

    // ---------------------------------------------------------------------
    // Scenario 2 — Compliant trade succeeds
    // ---------------------------------------------------------------------
    function _scenario2_compliantTrade() internal {
        _title(
            2,
            useBuidlLikeProfile
                ? "Compliant trade: qualified purchaser buys BUIDL-like RWA via router -> AMM"
                : "Compliant trade: accredited investor buys Reg D RWA via router -> AMM"
        );

        uint256 before = rwa.balanceOf(investor);
        ExecutionRequest memory req = _buyRequest(tradeAmount);

        vm.broadcast(investorPk);
        router.execute(req);

        uint256 delta = rwa.balanceOf(investor) - before;
        console2.log("    evidence: Executed; investor RWA balance delta (wei):", delta);
        _record(2, delta == tradeAmount);
    }

    // ---------------------------------------------------------------------
    // Scenario 3 — Element rejection, live
    // ---------------------------------------------------------------------
    function _scenario3_elementRejection() internal {
        _title(3, "Element rejection: operator flips jurisdiction (A-02) -> same trade is rejected");

        // flip ONE attestation: investor jurisdiction -> disallowed code.
        vm.broadcast(deployerPk);
        jurisdiction.setJurisdiction(investor, bytes32("ZZ"));

        ExecutionRequest memory req = _buyRequest(tradeAmount);
        bytes32 expected = ReasonCodes.encode(0, bytes32("A-02-v1"), uint32(1));

        (bool reverted, bytes32 reason) = _tryExecuteExpectComplianceReject(req);
        bool ok = reverted && reason == expected;
        console2.log("    evidence: ComplianceRejected; reason matches encode(0, A-02-v1, 1) ->", ok);
        if (ok) console2.log("      rejected by A-02 Jurisdiction");

        // restore the attestation so later scenarios see a compliant investor.
        vm.broadcast(deployerPk);
        jurisdiction.setJurisdiction(investor, ALLOWED_JURISDICTION);

        _record(3, ok);
    }

    // ---------------------------------------------------------------------
    // Scenario 4 — Lifecycle (suspend blocks, resume settles)
    // ---------------------------------------------------------------------
    function _scenario4_lifecycle() internal {
        _title(4, "Lifecycle: suspension blocks trading and governance schedules delayed recovery");

        vm.broadcast(deployerPk);
        policyReg.suspendManifest(address(rwa), bytes32("DEMO-SUSPEND"));

        ExecutionRequest memory blockedReq = _buyRequest(tradeAmount);
        // the helper decodes `reason` ONLY for ComplianceRejected, so a nonzero
        // reason proves the block came from the compliance gate specifically,
        // not from an unrelated revert.
        (bool reverted, bytes32 blockedReason) = _tryExecuteExpectComplianceReject(blockedReq);
        bool blockedOk = reverted && blockedReason != bytes32(0);
        console2.log("    evidence: while SUSPENDED, trade reverts ComplianceRejected ->", blockedOk);

        vm.broadcast(deployerPk);
        factory.scheduleManifestResume(address(rwa), bytes32("DEMO-RECOVERED"));
        (uint64 effectiveTime,) = policyReg.pendingManifestResumeOf(address(rwa));
        bool recoveryScheduled = effectiveTime == block.timestamp + policyReg.MIN_MANIFEST_DELAY();
        console2.log("    evidence: governance scheduled delayed recovery ->", recoveryScheduled);

        _record(4, blockedOk && recoveryScheduled);
    }

    // ---------------------------------------------------------------------
    // Scenario 5 — RFQ venue
    // ---------------------------------------------------------------------
    function _scenario5_rfq() internal {
        _title(5, "RFQ venue: maker signs an EIP-712 quote off-chain; taker settles through the router");

        // (a) approved maker buy fill.
        uint256 invBefore = rwa.balanceOf(investor);
        uint256 makerBefore = rwa.balanceOf(maker);
        (, ExecutionRequest memory req) = _rfqRequest(maker, makerPk, 1);

        vm.broadcast(investorPk);
        router.execute(req);

        uint256 invDelta = rwa.balanceOf(investor) - invBefore;
        uint256 makerOut = makerBefore - rwa.balanceOf(maker);
        bool buyOk = invDelta == rfqBuyAmountOut && makerOut == rfqBuyAmountOut && quote.balanceOf(maker) >= tradeAmount;
        console2.log("    evidence: RFQFilled; taker RWA delta (wei):", invDelta);

        // (b) approved maker sell fill uses the independently injected sell amount.
        uint256 quoteBefore = quote.balanceOf(investor);
        uint256 investorRwaBefore = rwa.balanceOf(investor);
        (, ExecutionRequest memory sellReq) = _rfqSellRequest(maker, makerPk, 2);

        vm.broadcast(investorPk);
        router.execute(sellReq);

        uint256 quoteDelta = quote.balanceOf(investor) - quoteBefore;
        uint256 investorRwaOut = investorRwaBefore - rwa.balanceOf(investor);
        bool sellOk = quoteDelta == rfqSellAmountOut && investorRwaOut == sellTradeAmount;
        console2.log("    evidence: RFQFilled sell; taker QUOTE delta (wei):", quoteDelta);

        // (c) unapproved maker is rejected before any settlement.
        (, ExecutionRequest memory badReq) = _rfqRequest(unapprovedMaker, unapprovedMakerPk, 1);
        (bool rejected, bytes4 sel) = _tryExecuteExpectSelector(badReq);
        bool unapprovedOk = rejected && sel == Errors.RFQMakerNotApproved.selector;
        console2.log("    evidence: unapproved maker quote rejected (RFQMakerNotApproved) ->", unapprovedOk);

        _record(5, buyOk && sellOk && unapprovedOk);
    }

    // ---------------------------------------------------------------------
    // Scenario 6 — Surveillance (stateful layer)
    // ---------------------------------------------------------------------
    function _scenario6_surveillance() internal {
        _title(6, "Surveillance: repeated trades past the threshold emit a SurveillanceFlag");

        // Re-onboard the RWA under a surveillance-enabled recipe (id 7 = RegD +
        // F-02). retire (operator) -> factory re-register+approve (owner).
        vm.broadcast(deployerPk);
        policyReg.retireManifest(address(rwa), bytes32("ADD-SURVEILLANCE"));

        ManifestCore memory m = _baseManifest();
        RecipeBinding[] memory bindings = _surveillanceBindings();
        VenueConfig memory ammCfg = VenueConfig({
            venueType: VenueType.AMM,
            adapter: address(ammAdapter),
            target: pool,
            operator: address(0),
            custody: CustodyModel.POOL,
            active: true
        });
        vm.broadcast(deployerPk);
        factory.registerRWAToken(address(rwa), m, bindings, pool, ammCfg);

        uint256 threshold = 2;
        vm.broadcast(deployerPk);
        surveillance.setThreshold(threshold);

        uint256 startCount = surveillance.transferCount();

        vm.recordLogs();
        for (uint256 i = 0; i < 3; i++) {
            ExecutionRequest memory req = _buyRequest(tradeAmount);
            vm.broadcast(investorPk);
            router.execute(req);
        }
        bool flagLogged = _sawSurveillanceFlag();

        uint256 endCount = surveillance.transferCount();
        // The flag is emitted inside onTransfer whenever transferCount > threshold,
        // so crossing the threshold is a definitive on-chain witness of the flag.
        bool crossed = endCount > threshold && endCount == startCount + 3;
        console2.log("    evidence: transferCount crossed threshold; count:", endCount);
        console2.log("      SurveillanceFlag log observed ->", flagLogged);
        _record(6, crossed && flagLogged);
    }

    // ---------------------------------------------------------------------
    // Scenario 7 — Bypass attempt
    // ---------------------------------------------------------------------
    function _scenario7_bypass() internal {
        _title(7, "Bypass attempt: direct adapter.execute (around the router) reverts NotAuthorized");

        ExecutionRequest memory req = _buyRequest(tradeAmount);
        ComplianceDecision memory d; // unused: onlyRouter reverts first

        bool reverted;
        bytes4 sel;
        try ammAdapter.execute(req, d) {
            reverted = false;
        } catch (bytes memory err) {
            reverted = true;
            sel = _selector(err);
        }
        bool ok = reverted && sel == Errors.NotAuthorized.selector;
        console2.log("    evidence: compliance cannot be skipped by going around the router ->", ok);
        _record(7, ok);
    }

    // ---------------------------------------------------------------------
    // Request builders
    // ---------------------------------------------------------------------
    function _buyRequest(uint256 amount) internal returns (ExecutionRequest memory req) {
        ComplianceContext memory ctx;
        ctx.initiator = investor;
        ctx.buyer = investor;
        ctx.seller = pool;
        ctx.tokenIn = address(quote);
        ctx.tokenOut = address(rwa);
        ctx.amountIn = amount;
        ctx.amountOut = amount; // 1:1 MockPool
        ctx.venueType = VenueType.AMM;
        ctx.venue = pool;
        ctx.flowType = FlowType.SECONDARY_TRADE;

        req.context = ctx;
        req.amountOutMin = 0;
        req.deadline = uint64(block.timestamp + 1 hours);
        req.nonce = nonceSeq++;
        req.venueData = ""; // default zeroForOne=true: token0(QUOTE) in, token1(RWA) out
    }

    function _rfqRequest(address mk, uint256 mkPk, uint256 quoteNonce)
        internal
        returns (RFQQuote memory q, ExecutionRequest memory req)
    {
        q.maker = mk;
        q.taker = investor;
        q.tokenIn = address(quote);
        q.tokenOut = address(rwa);
        q.amountIn = tradeAmount;
        q.amountOut = rfqBuyAmountOut;
        q.venue = RFQ_VENUE;
        q.nonce = quoteNonce;
        q.expiry = uint64(block.timestamp) + quoteTtlSeconds;

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mkPk, rfqAdapter.hashQuote(q));
        bytes memory sig = abi.encodePacked(r, s, v);

        ComplianceContext memory ctx;
        ctx.initiator = investor;
        ctx.buyer = investor;
        ctx.seller = mk;
        ctx.tokenIn = address(quote);
        ctx.tokenOut = address(rwa);
        ctx.amountIn = tradeAmount;
        ctx.amountOut = rfqBuyAmountOut;
        ctx.venueType = VenueType.RFQ;
        ctx.venue = RFQ_VENUE;
        ctx.flowType = FlowType.SECONDARY_TRADE;

        req.context = ctx;
        req.amountOutMin = rfqBuyAmountOut;
        req.deadline = uint64(block.timestamp) + quoteTtlSeconds;
        req.nonce = nonceSeq++;
        req.venueData = abi.encode(q, sig);
    }

    function _rfqSellRequest(address mk, uint256 mkPk, uint256 quoteNonce)
        internal
        returns (RFQQuote memory q, ExecutionRequest memory req)
    {
        q.maker = mk;
        q.taker = investor;
        q.tokenIn = address(rwa);
        q.tokenOut = address(quote);
        q.amountIn = sellTradeAmount;
        q.amountOut = rfqSellAmountOut;
        q.venue = RFQ_VENUE;
        q.nonce = quoteNonce;
        q.expiry = uint64(block.timestamp) + quoteTtlSeconds;

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mkPk, rfqAdapter.hashQuote(q));
        bytes memory sig = abi.encodePacked(r, s, v);

        ComplianceContext memory ctx;
        ctx.initiator = investor;
        // The reference engine screens the RFQ taker as its compliance subject
        // for both directions. Token direction still drives post-trade
        // accounting and the adapter's actual settlement legs.
        ctx.buyer = investor;
        ctx.seller = mk;
        ctx.tokenIn = address(rwa);
        ctx.tokenOut = address(quote);
        ctx.amountIn = sellTradeAmount;
        ctx.amountOut = rfqSellAmountOut;
        ctx.venueType = VenueType.RFQ;
        ctx.venue = RFQ_VENUE;
        ctx.flowType = FlowType.SECONDARY_TRADE;

        req.context = ctx;
        req.amountOutMin = rfqSellAmountOut;
        req.deadline = uint64(block.timestamp) + quoteTtlSeconds;
        req.nonce = nonceSeq++;
        req.venueData = abi.encode(q, sig);
    }

    // ---------------------------------------------------------------------
    // Revert helpers (simulation-only; pranked, never broadcast)
    // ---------------------------------------------------------------------
    function _tryExecuteExpectComplianceReject(ExecutionRequest memory req)
        internal
        returns (bool reverted, bytes32 reason)
    {
        vm.prank(investor);
        try router.execute(req) {
            reverted = false;
        } catch (bytes memory err) {
            reverted = true;
            if (_selector(err) == Errors.ComplianceRejected.selector && err.length >= 36) {
                assembly {
                    reason := mload(add(err, 0x24))
                }
            }
        }
    }

    function _tryExecuteExpectSelector(ExecutionRequest memory req) internal returns (bool reverted, bytes4 sel) {
        vm.prank(investor);
        try router.execute(req) {
            reverted = false;
        } catch (bytes memory err) {
            reverted = true;
            sel = _selector(err);
        }
    }

    function _selector(bytes memory err) internal pure returns (bytes4 sel) {
        if (err.length >= 4) {
            assembly {
                sel := mload(add(err, 0x20))
            }
        }
    }

    function _sawSurveillanceFlag() internal returns (bool) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("SurveillanceFlag(bytes32,address,bytes32)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == sig) return true;
        }
        return false;
    }

    // ---------------------------------------------------------------------
    // Reporting
    // ---------------------------------------------------------------------
    function _title(uint256 idx, string memory t) internal {
        titles[idx] = t;
        console2.log("");
        console2.log(string.concat("[", vm.toString(idx), "] ", t));
    }

    function _record(uint256 idx, bool ok) internal {
        passed[idx] = ok;
        console2.log(ok ? "    -> PASS" : "    -> FAIL");
    }

    function _summary() internal view {
        uint256 ok;
        console2.log("");
        console2.log("=====================================================");
        console2.log("  Corner Store  -  DEMO SCENARIO RESULTS");
        console2.log("=====================================================");
        for (uint256 i = 1; i <= N; i++) {
            console2.log(string.concat("  [", vm.toString(i), "] ", passed[i] ? "PASS  " : "FAIL  ", titles[i]));
            if (passed[i]) ok++;
        }
        console2.log("-----------------------------------------------------");
        console2.log(string.concat("  ", vm.toString(ok), " / ", vm.toString(N), " scenarios passed"));
        console2.log("=====================================================");
        require(ok == N, "DEMO FAILED: one or more scenarios did not pass");
    }

    // ---------------------------------------------------------------------
    // Artifact loading
    // ---------------------------------------------------------------------
    function _load() internal {
        string memory json = vm.readFile(ARTIFACT_PATH);
        string memory scenario = vm.readFile(SCENARIO_RUNTIME_PATH);
        require(vm.parseJsonUint(json, ".scenarioSchemaVersion") == 2, "artifact scenario schemaVersion invalid");
        require(vm.parseJsonUint(scenario, ".schemaVersion") == 2, "runtime scenario schemaVersion invalid");
        bytes32 artifactScenarioHash = abi.decode(vm.parseJson(json, ".scenarioHash"), (bytes32));
        require(artifactScenarioHash == keccak256(bytes(scenario)), "runtime scenario does not match deployment");

        bytes32 profileHash = keccak256(bytes(vm.parseJsonString(json, ".assetProfile")));
        useBuidlLikeProfile = profileHash == keccak256("buidl-like");
        require(useBuidlLikeProfile || profileHash == keccak256("reg-d"), "artifact assetProfile invalid");

        deployer = vm.parseJsonAddress(json, ".deployer");
        investor = vm.parseJsonAddress(json, ".investor");
        maker = vm.parseJsonAddress(json, ".maker");
        unapprovedMaker = vm.parseJsonAddress(json, ".unapprovedMaker");

        uint256[6] memory accounts;
        accounts[0] = vm.parseJsonUint(scenario, ".deployment.accounts.deployer");
        accounts[1] = vm.parseJsonUint(scenario, ".deployment.accounts.investor");
        accounts[2] = vm.parseJsonUint(scenario, ".deployment.accounts.maker");
        accounts[3] = vm.parseJsonUint(scenario, ".deployment.accounts.unapprovedMaker");
        accounts[4] = vm.parseJsonUint(scenario, ".deployment.accounts.eligibleInvestorB");
        accounts[5] = vm.parseJsonUint(scenario, ".deployment.accounts.ineligibleInvestor");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] <= 9, "runtime scenario account must be in range 0-9");
            for (uint256 j = i + 1; j < accounts.length; j++) {
                require(accounts[i] != accounts[j], "runtime scenario accounts must be unique");
            }
        }

        deployerPk = vm.deriveKey(MNEMONIC, uint32(accounts[0]));
        investorPk = vm.deriveKey(MNEMONIC, uint32(accounts[1]));
        makerPk = vm.deriveKey(MNEMONIC, uint32(accounts[2]));
        unapprovedMakerPk = vm.deriveKey(MNEMONIC, uint32(accounts[3]));
        require(vm.addr(deployerPk) == deployer, "runtime deployer does not match deployment");
        require(vm.addr(investorPk) == investor, "runtime investor does not match deployment");
        require(vm.addr(makerPk) == maker, "runtime maker does not match deployment");
        require(vm.addr(unapprovedMakerPk) == unapprovedMaker, "runtime unapproved maker does not match deployment");

        tradeAmount = vm.parseUint(vm.parseJsonString(scenario, ".execution.defaultBuyAmountBaseUnits"));
        sellTradeAmount = vm.parseUint(vm.parseJsonString(scenario, ".execution.defaultSellAmountBaseUnits"));
        uint256 pricingNumerator = vm.parseUint(vm.parseJsonString(scenario, ".execution.pricing.numerator"));
        uint256 pricingDenominator = vm.parseUint(vm.parseJsonString(scenario, ".execution.pricing.denominator"));
        uint256 assetDecimals = vm.parseJsonUint(scenario, ".asset.decimals");
        uint256 quoteDecimals = vm.parseJsonUint(scenario, ".quoteAsset.decimals");
        uint256 ttl = vm.parseJsonUint(scenario, ".execution.defaultQuoteTtlSeconds");
        require(
            tradeAmount > 0 && sellTradeAmount > 0 && pricingNumerator > 0 && pricingDenominator > 0,
            "runtime scenario execution values must be positive"
        );
        require(assetDecimals <= 36 && quoteDecimals <= 36, "runtime scenario decimals invalid");
        require(ttl > 0 && ttl <= type(uint64).max - block.timestamp, "runtime scenario quote TTL invalid");
        uint256 assetScale = 10 ** assetDecimals;
        uint256 quoteScale = 10 ** quoteDecimals;
        require(
            pricingDenominator <= type(uint256).max / assetScale && pricingNumerator <= type(uint256).max / quoteScale,
            "runtime scenario price scale overflow"
        );
        // Scenario price is QUOTE per RWA. Buying therefore inverts the price,
        // while selling applies it in the forward direction.
        rfqBuyAmountOut = Math.mulDiv(tradeAmount, pricingDenominator * assetScale, pricingNumerator * quoteScale);
        rfqSellAmountOut = Math.mulDiv(sellTradeAmount, pricingNumerator * quoteScale, pricingDenominator * assetScale);
        require(rfqBuyAmountOut > 0 && rfqSellAmountOut > 0, "runtime scenario pricing returned zero");
        quoteTtlSeconds = uint64(ttl);

        rwa = IERC20(vm.parseJsonAddress(json, ".rwaToken"));
        quote = IERC20(vm.parseJsonAddress(json, ".quote"));
        pool = vm.parseJsonAddress(json, ".pool");

        factory = CornerStoreFactory(vm.parseJsonAddress(json, ".factory"));
        policyReg = TokenPolicyRegistry(vm.parseJsonAddress(json, ".policyReg"));
        jurisdiction = Jurisdiction(vm.parseJsonAddress(json, ".jurisdiction"));
        surveillance = SurveillanceFlag(vm.parseJsonAddress(json, ".surveillance"));
        router = ExecutionRouter(vm.parseJsonAddress(json, ".router"));
        ammAdapter = UniswapV3Adapter(vm.parseJsonAddress(json, ".ammAdapter"));
        rfqAdapter = RFQAdapter(vm.parseJsonAddress(json, ".rfqAdapter"));
    }

    function _baseManifest() internal view returns (ManifestCore memory m) {
        if (useBuidlLikeProfile) return BuidlLikeDemoAsset.manifest(ENGINES_AMM | ENGINES_RFQ);
        m.supportedEngines = ENGINES_AMM | ENGINES_RFQ;
    }

    function _baseBindings() internal view returns (RecipeBinding[] memory bindings) {
        if (useBuidlLikeProfile) return BuidlLikeDemoAsset.recipeBindings();
        bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(1, 2, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    function _surveillanceBindings() internal view returns (RecipeBinding[] memory bindings) {
        uint256 count = useBuidlLikeProfile ? 2 : 1;
        bindings = new RecipeBinding[](count);
        bindings[0] = RecipeBinding(SURVEIL_RECIPE_ID, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
        if (useBuidlLikeProfile) {
            bindings[1] = RecipeBinding(
                BuidlLikeDemoAsset.FUND_RECIPE_ID,
                BuidlLikeDemoAsset.FUND_RECIPE_VERSION,
                RecipeBindingMode.REQUIRED_BLOCKING,
                0,
                90
            );
        }
    }
}
