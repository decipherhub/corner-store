// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {IdentityUniquenessV2} from "../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IIdentityEvidenceV2} from "../../src/interfaces/compliance/IIdentityEvidenceV2.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../src/libraries/ReasonCodes.sol";
import {IRecipe} from "../../src/interfaces/compliance/IRecipe.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    ElementPolicyParameter,
    ElementEnforcementOverride,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode
} from "../../src/types/ComplianceTypes.sol";
import {PairedAssetRestriction} from "../../src/demo/tsv/PairedAssetRestriction.sol";
import {VenueVolumeLimit} from "../../src/demo/tsv/VenueVolumeLimit.sol";
import {TsvStyleReferenceRecipe} from "../../src/demo/tsv/TsvStyleReferenceRecipe.sol";

/// @notice Demo scenario: a venue customer operates a permissioned pool for a
///         tokenized listed stock under an illustrative TSV-style rule set.
/// @dev Nothing here states that a venue qualifies for, or operates under, an
///      exemption. Identity evidence and paired-asset classification are
///      operator inputs committed through the versioned Manifest policy.
contract TsvStylePoolScenarioTest is IntegrationBase {
    PairedAssetRestriction internal pairRule;
    VenueVolumeLimit internal volumeLimit;
    IdentityUniquenessV2 internal identityEvidence;

    address internal venueOperator = address(0x7E57);
    address internal bob = address(0xB0B);

    uint16 internal constant TSV_STYLE_RECIPE_ID = 40;
    uint256 internal constant PERIOD_LIMIT = 250 ether; // illustrative demo value
    bytes32 internal constant VOLUME_SCHEMA_ID = keccak256("corner-store.demo.tsv-style.volume-limit.v1");
    bytes32 internal constant IDENTITY_ISSUER = keccak256("demo-tsv-identity-issuer");
    bytes32 internal constant IDENTITY_BASIS = keccak256("demo-tsv-identity-delegation");

    function _registerScenarioPolicy() internal override {
        pairRule = new PairedAssetRestriction();
        volumeLimit = new VenueVolumeLimit();
        identityEvidence = new IdentityUniquenessV2();
        volumeLimit.setEngine(address(engine));
        identityEvidence.setTrustedIssuer(IDENTITY_ISSUER, IDENTITY_BASIS);
        elementReg.registerElement("A-04-v2", address(identityEvidence));
        elementReg.registerElement("TSV-PAIR-v1", address(pairRule));
        elementReg.registerElement("TSV-VOL-v1", address(volumeLimit));

        TsvStyleReferenceRecipe recipe = new TsvStyleReferenceRecipe();
        bytes32 aliasHash = recipe.ALIAS_HASH();
        recipeReg.registerRecipe(
            aliasHash,
            recipeReg.deriveRecipeKey(aliasHash),
            recipe.RECIPE_ID(),
            recipe.RECIPE_VERSION(),
            address(recipe)
        );
    }

    function _configureScenarioPolicy(ManifestPolicyConfig memory)
        internal
        view
        override
        returns (ManifestPolicyConfig memory)
    {
        return _tsvPolicyConfig(2, address(quote));
    }

    function setUp() public {
        ManifestCore memory manifest;
        manifest.status = PolicyStatus.ACTIVE;
        manifest.supportedEngines = ENGINES_AMM;

        ManifestPolicyConfig memory config;
        config.schemaVersion = 3;
        deployStackWithManifestAndConfig("Orrin Systems common stock (demo)", "tORRN", manifest, _tsvBindings(), config);

        policyReg.setOperator(venueOperator, true);
        fundPoolRWA(1_000 ether);
    }

    function _tsvBindings() internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(TSV_STYLE_RECIPE_ID, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    function _tsvPolicyConfig(uint8 identityTrack, address pairedAsset)
        internal
        view
        returns (ManifestPolicyConfig memory config)
    {
        config.schemaVersion = 3;
        config.elementParameters = new ElementPolicyParameter[](3);
        config.elementParameters[0] = ElementPolicyParameter({
            bindingIndex: 0,
            elementId: "A-04-v2",
            schemaId: identityEvidence.PARAMETER_SCHEMA_ID(),
            schemaVersion: 1,
            parameters: abi.encode(identityTrack, uint8(1))
        });
        config.elementParameters[1] = ElementPolicyParameter({
            bindingIndex: 0,
            elementId: "TSV-PAIR-v1",
            schemaId: pairRule.PARAMETER_SCHEMA_ID(),
            schemaVersion: 1,
            parameters: abi.encode(
                pairedAsset, uint8(PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET)
            )
        });
        config.elementParameters[2] = ElementPolicyParameter({
            bindingIndex: 0,
            elementId: "TSV-VOL-v1",
            schemaId: VOLUME_SCHEMA_ID,
            schemaVersion: 1,
            parameters: abi.encode(PERIOD_LIMIT)
        });
    }

    // --- helpers ----------------------------------------------------------

    /// @dev Venue admission only: real T-REX verification plus operator-accepted,
    ///      asset-specific evidence. No accredited-investor claim is added.
    function _admitParticipant(address who, uint64 expiresAt) internal {
        verifyInvestor(who);
        bytes32 identityId = keccak256(abi.encode("demo-tsv-participant", who));
        identityEvidence.bindIdentity(who, identityId);
        identityEvidence.acceptEvidence(
            who,
            address(rwaToken),
            IIdentityEvidenceV2.Evidence({
                identityId: identityId,
                issuerId: IDENTITY_ISSUER,
                trustBasisHash: IDENTITY_BASIS,
                evidenceHash: keccak256(abi.encode("demo-tsv-evidence", who, expiresAt)),
                issuedAt: uint64(block.timestamp),
                expiresAt: expiresAt,
                attestationType: 3
            })
        );
    }

    function _admitParticipant(address who) internal {
        _admitParticipant(who, uint64(block.timestamp + 1 days));
    }

    function _buyReq(address buyer, uint256 amount) internal returns (ExecutionRequest memory) {
        fundBuyerQuote(buyer, 1_000 ether);
        return buildBuyRequest(buyer, amount, amount);
    }

    function _expectRejected(ExecutionRequest memory req, bytes32 reason) internal {
        vm.prank(req.context.buyer);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, reason));
        router.execute(req);
    }

    // --- rule set shape ---------------------------------------------------

    function test_ruleSet_hasNoHoldingPeriodElement_andUsesTsvIdentity() public {
        bytes32[] memory elements = IRecipe(address(new TsvStyleReferenceRecipe())).requiredElements();
        assertEq(elements.length, 5);
        assertEq(elements[1], bytes32("A-04-v2"));
        for (uint256 i = 0; i < elements.length; i++) {
            assertTrue(bytes5(elements[i]) != bytes5("C-01-"), "no C-01 family element");
        }
    }

    function test_manifestCommitsTsvDirectIdentityAndPairedAsset() public view {
        bytes[] memory parameters = policyReg.compiledParametersOf(address(rwaToken), 0);
        assertEq(parameters[1], abi.encode(uint8(2), uint8(1)), "TSV/DIRECT identity policy");
        assertEq(
            parameters[3],
            abi.encode(address(quote), uint8(PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET)),
            "paired asset committed in compiled policy"
        );
    }

    function test_wrongTrackManifestUpdateIsRejected() public {
        ManifestCore memory next = policyReg.manifestOf(address(rwaToken));
        next.fullManifestHash = keccak256("wrong-track-update");
        RecipeBinding[] memory bindings = _tsvBindings();
        ManifestPolicyConfig memory wrongTrack = _tsvPolicyConfig(1, address(quote));
        vm.expectRevert(Errors.InvalidPolicyConfig.selector);
        policyReg.scheduleManifestUpdate(
            address(rwaToken), next, bindings, new ElementEnforcementOverride[](0), wrongTrack, bytes32("WRONG-TRACK")
        );
    }

    function test_pairedAssetChangeUsesManifestUpdateAndChangesPolicyIdentity() public {
        bytes32 beforePlan = policyReg.compiledPlanHashOf(address(rwaToken));
        (,, bytes32 beforePolicyId) = engine.policyHashesOf(address(rwaToken));
        ManifestCore memory next = policyReg.manifestOf(address(rwaToken));
        next.fullManifestHash = keccak256("paired-asset-update");
        policyReg.scheduleManifestUpdate(
            address(rwaToken),
            next,
            _tsvBindings(),
            new ElementEnforcementOverride[](0),
            _tsvPolicyConfig(2, address(0xCA55)),
            bytes32("PAIR-UPDATE")
        );
        (,, uint64 readyAt,) = policyReg.pendingManifestUpdateOf(address(rwaToken));
        vm.warp(readyAt);
        policyReg.activateManifestUpdate(address(rwaToken));

        assertNotEq(policyReg.compiledPlanHashOf(address(rwaToken)), beforePlan);
        (,, bytes32 afterPolicyId) = engine.policyHashesOf(address(rwaToken));
        assertNotEq(afterPolicyId, beforePolicyId);
        bytes[] memory parameters = policyReg.compiledParametersOf(address(rwaToken), 0);
        assertEq(
            parameters[3],
            abi.encode(address(0xCA55), uint8(PairedAssetRestriction.PairedAssetCategory.NON_SECURITY_CRYPTO_ASSET))
        );
    }

    // --- pool trade settles for an admitted participant ------------------

    function test_admittedParticipant_buysInPool_withoutAccreditation() public {
        _admitParticipant(alice);
        assertFalse(accredited.accredited(alice), "participant is not an accredited investor");

        doBuy(_buyReq(alice, 100 ether));

        assertEq(rwaToken.balanceOf(alice), 100 ether, "stock delivered from the pool");
        assertEq(volumeLimit.currentPeriodVolume(), 100 ether, "trade counted toward the period volume");
    }

    function test_reject_walletWithoutAcceptedIdentityEvidence() public {
        verifyInvestor(bob);
        ExecutionRequest memory req = _buyReq(bob, 100 ether);
        _expectRejected(req, ReasonCodes.encode(0, "A-04-v2", 2));
        assertEq(rwaToken.balanceOf(bob), 0);
    }

    function test_reject_expiredIdentityEvidence() public {
        uint64 expiresAt = uint64(block.timestamp + 60);
        _admitParticipant(alice, expiresAt);
        vm.warp(expiresAt);
        ExecutionRequest memory req = _buyReq(alice, 100 ether);
        _expectRejected(req, ReasonCodes.encode(0, "A-04-v2", 5));
    }

    function test_reject_sanctionsListedWallet() public {
        _admitParticipant(alice);
        sanctions.setBlocked(alice, true);
        ExecutionRequest memory req = _buyReq(alice, 100 ether);
        _expectRejected(req, ReasonCodes.encode(0, "A-01-v1", 1));
    }

    // --- paired asset -----------------------------------------------------

    function test_reject_pairedAssetNotPermitted() public {
        ManifestCore memory next = policyReg.manifestOf(address(rwaToken));
        next.fullManifestHash = keccak256("other-pair");
        policyReg.scheduleManifestUpdate(
            address(rwaToken),
            next,
            _tsvBindings(),
            new ElementEnforcementOverride[](0),
            _tsvPolicyConfig(2, address(0xCA55)),
            bytes32("OTHER-PAIR")
        );
        (,, uint64 readyAt,) = policyReg.pendingManifestUpdateOf(address(rwaToken));
        vm.warp(readyAt);
        policyReg.activateManifestUpdate(address(rwaToken));

        _admitParticipant(alice);
        ExecutionRequest memory req = _buyReq(alice, 100 ether);
        _expectRejected(req, ReasonCodes.encode(0, "TSV-PAIR-v1", 1));
    }

    // --- volume limit -----------------------------------------------------

    function test_volumeLimit_blocksPastLimit_thenNewPeriodTrades() public {
        _admitParticipant(alice, uint64(block.timestamp + 3 days));

        doBuy(_buyReq(alice, 100 ether));
        doBuy(_buyReq(alice, 100 ether));
        assertEq(volumeLimit.currentPeriodVolume(), 200 ether);

        ExecutionRequest memory over = _buyReq(alice, 100 ether);
        _expectRejected(over, ReasonCodes.encode(0, "TSV-VOL-v1", 1));
        assertEq(rwaToken.balanceOf(alice), 200 ether);
        assertEq(volumeLimit.currentPeriodVolume(), 200 ether);

        doBuy(_buyReq(alice, 50 ether));
        assertEq(volumeLimit.currentPeriodVolume(), PERIOD_LIMIT);

        vm.warp(block.timestamp + 1 days);
        assertEq(volumeLimit.currentPeriodVolume(), 0);
        doBuy(_buyReq(alice, 100 ether));
        assertEq(rwaToken.balanceOf(alice), 350 ether);
    }

    function test_volumeCounter_onlyEngineWrites() public {
        vm.prank(venueOperator);
        vm.expectRevert(Errors.NotAuthorized.selector);
        volumeLimit.onTransfer(address(pool), alice, 1 ether);
    }

    // --- halt by the venue operator --------------------------------------

    function test_venueOperatorHalt_blocksPoolTrades_andResumeWaits() public {
        _admitParticipant(alice, uint64(block.timestamp + 3 days));
        doBuy(_buyReq(alice, 10 ether));

        vm.prank(venueOperator);
        policyReg.suspendManifest(address(rwaToken), bytes32("PRIMARY-LISTING-HALT"));
        assertEq(uint8(policyReg.statusOf(address(rwaToken))), uint8(PolicyStatus.SUSPENDED));

        ExecutionRequest memory req = _buyReq(alice, 10 ether);
        _expectRejected(req, ReasonCodes.encode(0, "POLICY", uint32(uint8(PolicyStatus.SUSPENDED))));
        assertEq(rwaToken.balanceOf(alice), 10 ether, "no delivery while halted");

        policyReg.scheduleManifestResume(address(rwaToken), bytes32("HALT-CLEARED"));
        (uint64 readyAt,) = policyReg.pendingManifestResumeOf(address(rwaToken));
        vm.prank(venueOperator);
        vm.expectRevert(abi.encodeWithSelector(Errors.TimelockNotReady.selector, uint256(readyAt)));
        policyReg.resumeManifest(address(rwaToken));
        assertEq(uint8(policyReg.statusOf(address(rwaToken))), uint8(PolicyStatus.SUSPENDED));
    }
}

/// @notice Contrast case: a holding-period policy remains pool-incompatible
///         under D020 even when the investor otherwise satisfies the Recipe.
contract HoldingPeriodAssetPoolRefusalTest is IntegrationBase {
    function setUp() public {
        deployStackWithManifest("Halden Robotics Class A (demo)", "HRA", _activeManifest(0, 0), _regDBindings(0));
        fundPoolRWA(1_000 ether);
    }

    function test_holdingPeriodAsset_cannotTradeInPool() public {
        setupBuyer(alice);
        fundBuyerQuote(alice, 1_000 ether);
        ExecutionRequest memory req = buildBuyRequest(alice, 100 ether, 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.ComplianceRejected.selector, ReasonCodes.unsupportedVenue(1, bytes32("C-01-v2"))
            )
        );
        router.execute(req);
        assertEq(rwaToken.balanceOf(alice), 0);
    }
}
