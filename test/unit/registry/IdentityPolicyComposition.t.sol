// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {TokenPolicyRegistryElementMock, TokenPolicyRegistryRecipeMock} from "./TokenPolicyRegistry.t.sol";
import {
    ElementMetadata,
    ManifestCore,
    RecipeBinding,
    RecipeBindingMode,
    ElementPolicyParameter,
    ManifestPolicyConfig,
    ElementEnforcementOverride,
    EnforcementOverrideMode
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";
import {Test} from "forge-std/Test.sol";
import {TokenPolicyRegistry} from "../../../src/registry/TokenPolicyRegistry.sol";
import {ElementRegistry} from "../../../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../../../src/registry/RecipeRegistry.sol";

contract IdentityPolicyElementMock is TokenPolicyRegistryElementMock {
    constructor() TokenPolicyRegistryElementMock("A-04-v2") {}

    function elementMetadata() public view override returns (ElementMetadata memory m) {
        m = super.elementMetadata();
        m.parameterSchemaId = keccak256("corner-store.element.identity-policy.v1");
        m.parameterSchemaVersion = 1;
        m.maxParameterBytes = 64;
        m.parametersRequired = true;
    }
}

contract IdentityPolicyCompositionTest is Test {
    TokenPolicyRegistry internal reg;
    ElementRegistry internal elementReg;
    RecipeRegistry internal recipeReg;
    address internal token = address(0x7000);
    bytes32 internal constant IDENTITY_ID = "A-04-v2";
    bytes32 internal constant IDENTITY_SCHEMA = keccak256("corner-store.element.identity-policy.v1");

    function setUp() public {
        elementReg = new ElementRegistry();
        recipeReg = new RecipeRegistry();
        reg = new TokenPolicyRegistry(recipeReg, elementReg);
        elementReg.registerElement("LEGACY", address(new TokenPolicyRegistryElementMock("LEGACY")));
        recipeReg.registerRecipe(7, 1, address(new TokenPolicyRegistryRecipeMock(7, 1, "LEGACY")));
        elementReg.registerElement(IDENTITY_ID, address(new IdentityPolicyElementMock()));
        recipeReg.registerRecipe(20, 1, address(new TokenPolicyRegistryRecipeMock(20, 1, IDENTITY_ID)));
    }

    function test_topology_registerRejectsMissingParameters() public {
        ManifestPolicyConfig memory config = _identityConfig(abi.encode(uint8(1), uint8(1)));
        config.elementParameters = new ElementPolicyParameter[](0);
        _expectInvalid();
        reg.registerManifest(token, _manifest(), _identityBindings(), _emptyOverrides(), config);
    }

    function test_topology_registerRejectsMemberUnsetUnknownAndMalformed() public {
        bytes[] memory invalid = _invalidParameters();
        for (uint256 i; i < invalid.length; i++) {
            _expectInvalid();
            reg.registerManifest(
                token, _manifest(), _identityBindings(), _emptyOverrides(), _identityConfig(invalid[i])
            );
        }
    }

    function test_topology_rejectsFlagOnlyAlongsideLegacyBlockingRecipe() public {
        RecipeBinding[] memory bindings = _mixedBindings(RecipeBindingMode.FLAG_ONLY);
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.registerManifest(
            token, _manifest(), bindings, _emptyOverrides(), _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
    }

    function test_topology_rejectsOptionalPathAlongsideLegacyAlternative() public {
        RecipeBinding[] memory bindings = _mixedBindings(RecipeBindingMode.PATH_OPTION);
        bindings[1].mode = RecipeBindingMode.PATH_OPTION;
        bindings[1].pathGroupId = 1;
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.registerManifest(
            token, _manifest(), bindings, _emptyOverrides(), _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
    }

    function test_topology_mixedBindingRejectsInvalidEvenWithOtherBlockingRecipe() public {
        _expectInvalid();
        reg.registerManifest(
            token,
            _manifest(),
            _mixedBindings(RecipeBindingMode.REQUIRED_BLOCKING),
            _emptyOverrides(),
            _identityConfig(abi.encode(uint8(1), uint8(2)))
        );
    }

    function test_topology_rejectsInvalidParametersInSecondIdentityBinding() public {
        recipeReg.registerRecipe(21, 1, address(new TokenPolicyRegistryRecipeMock(21, 1, IDENTITY_ID)));
        RecipeBinding[] memory bindings = _mixedBindings(RecipeBindingMode.REQUIRED_BLOCKING);
        bindings[1].recipeId = 21;
        ManifestPolicyConfig memory config;
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](2);
        config.elementParameters[0] =
            ElementPolicyParameter(0, IDENTITY_ID, IDENTITY_SCHEMA, 1, abi.encode(uint8(1), uint8(1)));
        config.elementParameters[1] =
            ElementPolicyParameter(1, IDENTITY_ID, IDENTITY_SCHEMA, 1, abi.encode(uint8(1), uint8(2)));
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidPolicyParameter.selector, uint256(1), IDENTITY_ID));
        reg.registerManifest(token, _manifest(), bindings, _emptyOverrides(), config);
    }

    function test_topology_registerCommitsRfqAndTsvDirectWithoutChangingLegacyBindings() public {
        reg.registerManifest(
            token,
            _manifest(),
            _mixedBindings(RecipeBindingMode.REQUIRED_BLOCKING),
            _emptyOverrides(),
            _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
        assertEq(reg.compiledParametersOf(token, 0)[0], abi.encode(uint8(1), uint8(1)));
        assertEq(reg.compiledParametersOf(token, 1)[0], bytes(""));
        bytes32 rfqHash = reg.compiledPlanHashOf(token);
        reg.registerManifest(
            address(0x7001),
            _manifest(),
            _mixedBindings(RecipeBindingMode.REQUIRED_BLOCKING),
            _emptyOverrides(),
            _identityConfig(abi.encode(uint8(2), uint8(1)))
        );
        assertNotEq(rfqHash, reg.compiledPlanHashOf(address(0x7001)));
    }

    function test_topology_updateRejectsInvalidWithoutChangingActiveOrPendingPlan() public {
        ManifestCore memory initial = _manifest();
        initial.fullManifestHash = keccak256("initial");
        reg.registerManifest(
            token, initial, _identityBindings(), _emptyOverrides(), _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
        reg.approveManifest(token);
        bytes32 beforeHash = reg.compiledPlanHashOf(token);
        ManifestCore memory next = initial;
        next.fullManifestHash = keccak256("next");
        bytes[] memory invalid = _invalidParameters();
        for (uint256 i; i < invalid.length; i++) {
            _expectInvalid();
            reg.scheduleManifestUpdate(
                token, next, _identityBindings(), _emptyOverrides(), _identityConfig(invalid[i]), "TOPOLOGY"
            );
            assertEq(reg.compiledPlanHashOf(token), beforeHash);
            (,, uint64 effectiveTime,) = reg.pendingManifestUpdateOf(token);
            assertEq(effectiveTime, 0);
        }
    }

    function test_topology_updateRejectsBindingDowngrade() public {
        reg.registerManifest(
            token, _manifest(), _identityBindings(), _emptyOverrides(), _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
        reg.approveManifest(token);
        ManifestCore memory next = _manifest();
        next.fullManifestHash = keccak256("next");
        vm.expectRevert(Errors.InvalidRecipeBinding.selector);
        reg.scheduleManifestUpdate(
            token,
            next,
            _mixedBindings(RecipeBindingMode.FLAG_ONLY),
            _emptyOverrides(),
            _identityConfig(abi.encode(uint8(1), uint8(1))),
            "DOWNGRADE"
        );
    }

    function test_topology_rejectsEnforcementOverrideDowngrades() public {
        ElementEnforcementOverride[] memory overrides_ = new ElementEnforcementOverride[](1);
        overrides_[0] = ElementEnforcementOverride(0, IDENTITY_ID, EnforcementOverrideMode.FORCE_FLAG_ONLY);
        vm.expectRevert(Errors.LooseningForbidden.selector);
        reg.registerManifest(
            token, _manifest(), _identityBindings(), overrides_, _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
        overrides_[0].mode = EnforcementOverrideMode.ESCALATE_TO_OPERATOR_REVIEW;
        vm.expectRevert(Errors.LooseningForbidden.selector);
        reg.registerManifest(
            token, _manifest(), _identityBindings(), overrides_, _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
    }

    function test_topology_directTrackUpdateActivatesParametersAtomically() public {
        reg.registerManifest(
            token, _manifest(), _identityBindings(), _emptyOverrides(), _identityConfig(abi.encode(uint8(1), uint8(1)))
        );
        reg.approveManifest(token);
        bytes32 beforeHash = reg.compiledPlanHashOf(token);
        ManifestCore memory next = _manifest();
        next.fullManifestHash = keccak256("next");
        reg.scheduleManifestUpdate(
            token,
            next,
            _identityBindings(),
            _emptyOverrides(),
            _identityConfig(abi.encode(uint8(2), uint8(1))),
            "TRACK"
        );
        assertEq(reg.compiledPlanHashOf(token), beforeHash);
        assertEq(reg.compiledParametersOf(token, 0)[0], abi.encode(uint8(1), uint8(1)));
        (,, uint64 effectiveTime,) = reg.pendingManifestUpdateOf(token);
        vm.warp(effectiveTime);
        reg.activateManifestUpdate(token);
        assertEq(reg.compiledParametersOf(token, 0)[0], abi.encode(uint8(2), uint8(1)));
        assertNotEq(reg.compiledPlanHashOf(token), beforeHash);
    }

    function _manifest() internal pure returns (ManifestCore memory m) {
        m.issuanceRecipeId = 20;
        m.issuanceRecipeVersion = 1;
    }

    function _emptyOverrides() internal pure returns (ElementEnforcementOverride[] memory) {
        return new ElementEnforcementOverride[](0);
    }

    function _invalidParameters() internal pure returns (bytes[] memory values) {
        values = new bytes[](12);
        values[0] = abi.encode(uint8(1), uint8(2));
        values[1] = abi.encode(uint8(2), uint8(2));
        values[2] = abi.encode(uint8(1), uint8(0));
        values[3] = abi.encode(uint8(1), uint8(3));
        values[4] = abi.encode(uint8(0), uint8(1));
        values[5] = abi.encode(uint8(3), uint8(1));
        values[6] = abi.encode(uint8(1));
        values[7] = abi.encode(uint256(257), uint8(1));
        values[8] = hex"01";
        values[9] = bytes("");
        values[10] = abi.encode(uint8(1), uint256(257));
        values[11] = abi.encode(uint8(1), uint8(1), uint8(0));
    }

    function _identityBindings() internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](1);
        bindings[0] = RecipeBinding(20, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 100);
    }

    function _mixedBindings(RecipeBindingMode mode) internal pure returns (RecipeBinding[] memory bindings) {
        bindings = new RecipeBinding[](2);
        bindings[0] = RecipeBinding(20, 1, mode, mode == RecipeBindingMode.PATH_OPTION ? 1 : 0, 100);
        bindings[1] = RecipeBinding(7, 1, RecipeBindingMode.REQUIRED_BLOCKING, 0, 50);
    }

    function _identityConfig(bytes memory parameters) internal pure returns (ManifestPolicyConfig memory config) {
        config.schemaVersion = 1;
        config.elementParameters = new ElementPolicyParameter[](1);
        config.elementParameters[0] = ElementPolicyParameter(0, IDENTITY_ID, IDENTITY_SCHEMA, 1, parameters);
    }

    function _expectInvalid() internal {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidPolicyParameter.selector, uint256(0), IDENTITY_ID));
    }
}
