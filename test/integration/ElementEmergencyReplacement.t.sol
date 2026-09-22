// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

import {ComplianceEngine} from "../../src/compliance/ComplianceEngine.sol";
import {ElementRegistry} from "../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../../src/registry/TokenPolicyRegistry.sol";
import {IComplianceElement} from "../../src/interfaces/compliance/IComplianceElement.sol";
import {IRecipe} from "../../src/interfaces/compliance/IRecipe.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    Decidability,
    ElementCategory,
    ElementMetadata,
    EnforcementAction,
    EvidenceType,
    FlowType,
    ManifestCore,
    ObligationTiming,
    PolicyStatus,
    RecipeBinding,
    RecipeBindingMode,
    Statefulness,
    TemporalNature,
    VenueType
} from "../../src/types/ComplianceTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";

contract IncidentGateElement is IComplianceElement {
    bytes32 internal immutable _elementId;
    address internal immutable _deniedSubject;
    string internal _version;

    constructor(bytes32 elementId_, string memory version_, address deniedSubject_) {
        _elementId = elementId_;
        _version = version_;
        _deniedSubject = deniedSubject_;
    }

    function check(address subject, address, address, uint256, bytes calldata, bytes calldata)
        external
        view
        returns (bool, bytes32)
    {
        return subject == _deniedSubject ? (false, bytes32("INCIDENT_GATE")) : (true, bytes32(0));
    }

    function elementMetadata() external view returns (ElementMetadata memory metadata) {
        metadata.elementId = _elementId;
        metadata.category = ElementCategory.INVESTOR_ATTRIBUTE;
        metadata.version = _version;
        metadata.temporal = TemporalNature.ONE_TIME;
        metadata.decidability = Decidability.DETERMINISTIC;
        metadata.timing = ObligationTiming.AT_TRADE_GATE;
        metadata.statefulness = Statefulness.STATELESS;
        metadata.evidenceType = EvidenceType.TRANSACTION_CONTEXT;
        metadata.defaultEnforcement = EnforcementAction.BLOCK;
    }
}

contract IncidentRecipe is IRecipe {
    uint16 internal immutable _recipeVersion;
    bytes32 internal immutable _elementId;

    constructor(uint16 recipeVersion_, bytes32 elementId_) {
        _recipeVersion = recipeVersion_;
        _elementId = elementId_;
    }

    function recipeId() external pure returns (uint16) {
        return 77;
    }

    function version() external view returns (uint16) {
        return _recipeVersion;
    }

    function isApplicable(bytes calldata) external pure returns (bool) {
        return true;
    }

    function requiredElements() external view returns (bytes32[] memory elements) {
        elements = new bytes32[](1);
        elements[0] = _elementId;
    }
}

contract ElementEmergencyReplacementTest is Test {
    bytes32 internal constant ELEMENT_V1 = bytes32("INCIDENT-ELEMENT-v1");
    bytes32 internal constant ELEMENT_V2 = bytes32("INCIDENT-ELEMENT-v2");
    address internal constant TOKEN_A = address(0xA551);
    address internal constant TOKEN_B = address(0xB551);
    address internal constant QUOTE = address(0xCA51);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant SELLER = address(0x5E11E2);
    address internal constant OPERATOR = address(0x0BEE);
    address internal constant STRANGER = address(0xDEAD);

    ElementRegistry internal elementRegistry;
    RecipeRegistry internal recipeRegistry;
    TokenPolicyRegistry internal policyRegistry;
    ComplianceEngine internal engine;
    IncidentGateElement internal elementV1;
    IncidentRecipe internal recipeV1;

    function setUp() public {
        elementRegistry = new ElementRegistry();
        recipeRegistry = new RecipeRegistry();
        policyRegistry = new TokenPolicyRegistry(recipeRegistry, elementRegistry);
        engine = new ComplianceEngine(policyRegistry, elementRegistry, recipeRegistry);
        policyRegistry.setOperator(OPERATOR, true);

        elementV1 = new IncidentGateElement(ELEMENT_V1, "1.0.0", ALICE);
        recipeV1 = new IncidentRecipe(1, ELEMENT_V1);
        elementRegistry.registerElement(ELEMENT_V1, address(elementV1));
        recipeRegistry.registerRecipe(77, 1, address(recipeV1));

        _activate(TOKEN_A, keccak256("token-a-artifact-v1"));
        _activate(TOKEN_B, keccak256("token-b-artifact-v1"));
        policyRegistry.setUnregulated(QUOTE);
    }

    function test_incidentReplacement_isImmutableDelayedScopedAndAudited() public {
        assertFalse(_evaluate(TOKEN_A, ALICE).allowed, "v1 defect is reproducible for impacted subject");
        assertTrue(_evaluate(TOKEN_B, BOB).allowed, "unaffected subject baseline");
        (,, bytes32 tokenBPolicyBefore) = engine.policyHashesOf(TOKEN_B);
        bytes32 tokenBHistoryBefore = policyRegistry.manifestHistoryHashOf(TOKEN_B);
        bytes32 tokenACheckpointBefore = engine.recordPolicyAuditCheckpoint(TOKEN_A);

        vm.prank(OPERATOR);
        policyRegistry.suspendManifest(TOKEN_A, bytes32("ELEMENT_INCIDENT"));
        assertEq(uint256(policyRegistry.statusOf(TOKEN_A)), uint256(PolicyStatus.SUSPENDED));
        assertEq(uint256(policyRegistry.statusOf(TOKEN_B)), uint256(PolicyStatus.ACTIVE));

        IncidentGateElement duplicateElement = new IncidentGateElement(ELEMENT_V1, "1.0.1", address(0));
        vm.expectRevert(abi.encodeWithSelector(Errors.ElementAlreadyRegistered.selector, ELEMENT_V1));
        elementRegistry.registerElement(ELEMENT_V1, address(duplicateElement));
        IncidentRecipe duplicateRecipe = new IncidentRecipe(1, ELEMENT_V1);
        vm.expectRevert(
            abi.encodeWithSelector(Errors.RecipeAlreadyRegistered.selector, recipeRegistry.recipeKeyOf(77), uint16(1))
        );
        recipeRegistry.registerRecipe(77, 1, address(duplicateRecipe));

        IncidentGateElement elementV2 = new IncidentGateElement(ELEMENT_V2, "2.0.0", address(0));
        elementRegistry.registerElement(ELEMENT_V2, address(elementV2));
        recipeRegistry.registerRecipe(77, 2, address(new IncidentRecipe(2, ELEMENT_V2)));

        ManifestCore memory replacement = policyRegistry.manifestOf(TOKEN_A);
        replacement.issuanceRecipeVersion = 2;
        replacement.fullManifestHash = keccak256("token-a-artifact-v2");
        RecipeBinding[] memory replacementBindings = _bindings(2);

        vm.prank(STRANGER);
        vm.expectRevert("Ownable: caller is not the owner");
        policyRegistry.scheduleManifestUpdate(TOKEN_A, replacement, replacementBindings, bytes32("ELEMENT_REPLACEMENT"));
        policyRegistry.scheduleManifestUpdate(TOKEN_A, replacement, replacementBindings, bytes32("ELEMENT_REPLACEMENT"));

        (,, uint64 updateReadyAt,) = policyRegistry.pendingManifestUpdateOf(TOKEN_A);
        vm.prank(OPERATOR);
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        policyRegistry.activateManifestUpdate(TOKEN_A);
        assertEq(policyRegistry.recipeBindingsOf(TOKEN_A)[0].recipeVersion, 1, "active binding is unchanged early");

        vm.warp(updateReadyAt);
        vm.prank(OPERATOR);
        policyRegistry.activateManifestUpdate(TOKEN_A);
        assertEq(uint256(policyRegistry.statusOf(TOKEN_A)), uint256(PolicyStatus.SUSPENDED));
        assertEq(policyRegistry.manifestVersionOf(TOKEN_A), 2);
        assertEq(policyRegistry.recipeBindingsOf(TOKEN_A)[0].recipeVersion, 2);
        bytes32 tokenACheckpointAfter = engine.recordPolicyAuditCheckpoint(TOKEN_A);
        assertNotEq(tokenACheckpointAfter, tokenACheckpointBefore, "replacement has a distinct audit checkpoint");

        (,, bytes32 tokenBPolicyAfter) = engine.policyHashesOf(TOKEN_B);
        assertEq(tokenBPolicyAfter, tokenBPolicyBefore, "unaffected asset policyId must not change");
        assertEq(policyRegistry.manifestVersionOf(TOKEN_B), 1);
        assertEq(policyRegistry.recipeBindingsOf(TOKEN_B)[0].recipeVersion, 1);
        assertEq(policyRegistry.manifestHistoryHashOf(TOKEN_B), tokenBHistoryBefore);

        policyRegistry.scheduleManifestResume(TOKEN_A, bytes32("REPLACEMENT_VERIFIED"));
        vm.prank(OPERATOR);
        vm.expectPartialRevert(Errors.TimelockNotReady.selector);
        policyRegistry.resumeManifest(TOKEN_A);
        (uint64 resumeReadyAt,) = policyRegistry.pendingManifestResumeOf(TOKEN_A);
        vm.warp(resumeReadyAt);
        vm.prank(OPERATOR);
        policyRegistry.resumeManifest(TOKEN_A);

        assertTrue(_evaluate(TOKEN_A, ALICE).allowed, "impacted asset uses reviewed v2 after delayed resume");
        assertFalse(_evaluate(TOKEN_B, ALICE).allowed, "other asset still uses immutable v1 behavior");
        assertTrue(_evaluate(TOKEN_B, BOB).allowed, "other asset baseline behavior remains available");
    }

    function _activate(address token, bytes32 artifactHash) internal {
        ManifestCore memory manifest;
        manifest.status = PolicyStatus.ACTIVE;
        manifest.issuanceRecipeId = 77;
        manifest.issuanceRecipeVersion = 1;
        manifest.supportedEngines = 1;
        manifest.fullManifestHash = artifactHash;
        policyRegistry.registerManifest(token, manifest, _bindings(1));
        vm.prank(OPERATOR);
        policyRegistry.approveManifest(token);
    }

    function _bindings(uint16 version) internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(77, version, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    function _evaluate(address token, address buyer) internal view returns (ComplianceDecision memory) {
        ComplianceContext memory context;
        context.initiator = buyer;
        context.buyer = buyer;
        context.seller = SELLER;
        context.tokenIn = QUOTE;
        context.tokenOut = token;
        context.amountIn = 1 ether;
        context.amountOut = 1 ether;
        context.venueType = VenueType.AMM;
        context.venue = address(0xA11);
        context.flowType = FlowType.SECONDARY_TRADE;
        return engine.evaluate(context);
    }
}
