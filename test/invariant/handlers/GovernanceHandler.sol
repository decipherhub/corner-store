// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {AssuranceFixture, AssuranceRecipe} from "./AssuranceFixture.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {
    ManifestCore,
    ManifestPolicyConfig,
    PolicyStatus,
    RecipeBinding,
    ElementEnforcementOverride
} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract GovernanceHandler is AssuranceFixture {
    address internal constant OPERATOR = address(0x0F);
    address internal constant STRANGER = address(0xBAD);
    bool internal operatorEnabled = true;
    bool[6] internal closed;
    uint64[7] internal ready;
    PolicyStatus internal status = PolicyStatus.ACTIVE;
    uint64 internal versionModel;
    bytes32 internal manifestModel;
    bytes32 internal planModel;
    bytes32 internal configModel;
    bytes32 internal historyModel;
    bytes32 internal policyModel;
    bytes32 internal pendingManifest;
    bytes32 internal pendingPlan;
    bytes32 internal pendingConfig;
    uint64 internal updateReady;
    uint8 internal activeTrack = 1;
    uint8 internal pendingTrack;
    uint16 internal activeRecipe = 2;
    uint16 internal pendingRecipe;
    uint16 internal latestRecipe = 2;
    mapping(uint16 => address) internal registrations;
    uint256 public controls;
    uint256 public activations;
    uint256 public registrationsChecked;
    uint256 public blockedTrades;

    constructor() {
        _deployAssurance();
        operatorReg.setOperator(OPERATOR, true);
        policyReg.setOperator(OPERATOR, true);
        versionModel = policyReg.manifestVersionOf(address(rwaToken));
        manifestModel = policyReg.manifestOf(address(rwaToken)).fullManifestHash;
        planModel = policyReg.compiledPlanHashOf(address(rwaToken));
        configModel = policyReg.policyConfigHashOf(address(rwaToken));
        historyModel = policyReg.manifestHistoryHashOf(address(rwaToken));
        policyModel = engine.evaluate(_request(0, 0, 0, false, 1, 0, 0).context).policyId;
        registrations[2] = recipeReg.recipeOf(recipeReg.recipeKeyOf(8), 2);
    }

    function setRole(bool enabled) public {
        operatorReg.setOperator(OPERATOR, enabled);
        policyReg.setOperator(OPERATOR, enabled);
        operatorEnabled = enabled;
        assertGovernance();
    }

    // scopes: global, cash, RWA, AMM, RFQ v2, RFQ v3, Manifest.
    // operations: pause, schedule, cancel, reopen; roles: owner, operator, stranger.
    function control(uint8 scope, uint8 operation, uint8 role) public {
        scope %= 7;
        operation %= 4;
        role %= 3;
        bytes memory expected = _expectedControl(scope, operation, role);
        address caller = role == 0 ? address(this) : role == 1 ? OPERATOR : STRANGER;
        (address target, bytes memory data) = _controlCall(scope, operation);
        bytes32 beforeDigest = _governanceDigest();
        vm.prank(caller);
        (bool ok, bytes memory reason) = target.call(data);
        assertEq(ok, expected.length == 0, "control authorization/transition");
        if (expected.length != 0) {
            assertEq(reason, expected, "exact control rejection");
            assertEq(_governanceDigest(), beforeDigest, "rejected control changed state");
        } else {
            _applyControl(scope, operation, caller);
            ++controls;
        }
        assertGovernance();
    }

    function _expectedControl(uint8 scope, uint8 operation, uint8 role) internal view returns (bytes memory expected) {
        bool privileged = operation == 0 || (scope == 6 && operation == 3);
        bool authorized = role == 0 || (privileged && role == 1 && operatorEnabled);
        if (!authorized) {
            expected = privileged ? abi.encodeWithSelector(Errors.NotAuthorized.selector) : _ownerError();
        } else if (scope == 6 && operation == 0 && status != PolicyStatus.ACTIVE) {
            expected = abi.encodeWithSelector(Errors.InvalidManifestTransition.selector);
        } else if (operation == 1 && !(scope == 6 ? status == PolicyStatus.SUSPENDED : closed[scope])) {
            expected = abi.encodeWithSelector(Errors.InvalidManifestTransition.selector);
        } else if (operation == 1 && ready[scope] != 0) {
            expected = abi.encodeWithSelector(Errors.PendingActionExists.selector);
        } else if (scope == 6 && operation == 3 && status != PolicyStatus.SUSPENDED) {
            expected = abi.encodeWithSelector(Errors.InvalidManifestTransition.selector);
        } else if (operation >= 2 && ready[scope] == 0) {
            expected = abi.encodeWithSelector(Errors.PendingActionNotFound.selector);
        } else if (operation == 3 && block.timestamp < ready[scope]) {
            expected = abi.encodeWithSelector(Errors.TimelockNotReady.selector, uint256(ready[scope]));
        }
    }

    function _applyControl(uint8 scope, uint8 operation, address caller) internal {
        if (operation == 0 || operation == 3) {
            if (scope == 6) {
                PolicyStatus next = operation == 0 ? PolicyStatus.SUSPENDED : PolicyStatus.ACTIVE;
                _history(
                    status,
                    next,
                    manifestModel,
                    manifestModel,
                    versionModel,
                    caller,
                    "assurance",
                    planModel,
                    operation == 0 ? uint64(block.timestamp) : ready[scope]
                );
                status = next;
            } else {
                closed[scope] = operation == 0;
            }
            ready[scope] = 0;
        } else if (operation == 1) {
            ready[scope] = uint64(block.timestamp + 1 days);
        } else {
            ready[scope] = 0;
        }
    }

    function advance(uint32 delta) public {
        vm.warp(block.timestamp + bound(delta, 0, 2 days));
        _refreshAffiliateFixture();
        assertGovernance();
    }

    function probe(bool sell, uint8 rawKind) public {
        // AMM is used for non-ACTIVE Manifest states because RouterV2 preflight rejects them earlier.
        uint8 kind = status == PolicyStatus.ACTIVE ? rawKind % 3 : 0;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, 1 ether, nonce, nonce);
        bytes4 expected;
        if (closed[0]) expected = Errors.GlobalPaused.selector;
        else if (closed[sell ? 2 : 1]) expected = Errors.TokenInPaused.selector;
        else if (closed[sell ? 1 : 2]) expected = Errors.TokenOutPaused.selector;
        else if (closed[3 + kind]) expected = Errors.VenueSuspended.selector;
        else if (status != PolicyStatus.ACTIVE) expected = Errors.ComplianceRejected.selector;
        if (expected == bytes4(0)) {
            _fill(kind, req, nonce);
        } else {
            _reject(kind, req, expected);
            ++blockedTrades;
        }
        assertGovernance();
    }

    function registerVersion(uint16 rawVersion) public {
        uint16 v = uint16(bound(rawVersion, 2, 12));
        bytes32 key = recipeReg.recipeKeyOf(8);
        if (registrations[v] != address(0)) {
            AssuranceRecipe replacement = new AssuranceRecipe(v);
            vm.expectRevert(abi.encodeWithSelector(Errors.RecipeAlreadyRegistered.selector, key, v));
            recipeReg.registerRecipe(8, v, address(replacement));
        } else {
            AssuranceRecipe recipe = new AssuranceRecipe(v);
            recipeReg.registerRecipe(8, v, address(recipe));
            registrations[v] = address(recipe);
            if (v > latestRecipe) latestRecipe = v;
        }
        vm.expectRevert(abi.encodeWithSelector(Errors.ElementAlreadyRegistered.selector, bytes32("A-04-v2")));
        elementReg.registerElement("A-04-v2", address(evidence));
        ++registrationsChecked;
        assertGovernance();
    }

    function update(uint8 operation, uint8 track) public {
        operation %= 3;
        if (status != PolicyStatus.ACTIVE && status != PolicyStatus.SUSPENDED) return;
        if (operation == 0) {
            if (updateReady != 0) return;
            ManifestCore memory m = policyReg.manifestOf(address(rwaToken));
            pendingManifest = keccak256(abi.encode("next", ++serial));
            m.fullManifestHash = pendingManifest;
            pendingRecipe = latestRecipe;
            pendingTrack = 1 + track % 2;
            policyReg.scheduleManifestUpdate(
                address(rwaToken),
                m,
                _assuranceBindings(pendingRecipe),
                new ElementEnforcementOverride[](0),
                _config(1 + track % 2),
                "assurance"
            );
            updateReady = uint64(block.timestamp + 1 days);
            // Capture compiler commitments, then verify isolation until atomic activation.
            pendingPlan = policyReg.pendingCompiledPlanHashOf(address(rwaToken));
            pendingConfig = _configHash(1 + track % 2);
        } else if (operation == 1) {
            if (updateReady == 0) {
                vm.expectRevert(Errors.PendingActionNotFound.selector);
                policyReg.cancelManifestUpdate(address(rwaToken));
            } else {
                policyReg.cancelManifestUpdate(address(rwaToken));
                updateReady = 0;
            }
        } else if (updateReady == 0 || block.timestamp < updateReady) {
            vm.expectRevert(
                updateReady == 0
                    ? abi.encodeWithSelector(Errors.PendingActionNotFound.selector)
                    : abi.encodeWithSelector(Errors.TimelockNotReady.selector, uint256(updateReady))
            );
            policyReg.activateManifestUpdate(address(rwaToken));
        } else {
            policyReg.activateManifestUpdate(address(rwaToken));
            _history(
                status,
                status,
                manifestModel,
                pendingManifest,
                versionModel + 1,
                address(this),
                "assurance",
                pendingPlan,
                updateReady
            );
            ++versionModel;
            manifestModel = pendingManifest;
            planModel = pendingPlan;
            configModel = pendingConfig;
            activeRecipe = pendingRecipe;
            activeTrack = pendingTrack;
            updateReady = 0;
            ++activations;
            bytes32 nextPolicy = _policyIdentity();
            assertNotEq(nextPolicy, policyModel, "semantic activation changes policy identity");
            policyModel = nextPolicy;
        }
        assertGovernance();
    }

    function lifecycle(uint8 operation, uint8 role) public {
        operation %= 3;
        role %= 3;
        address caller = role == 0 ? address(this) : role == 1 ? OPERATOR : STRANGER;
        bool authorized = role == 0 || (operation != 1 && role == 1 && operatorEnabled);
        bool valid = operation == 0
            ? (status == PolicyStatus.ACTIVE || status == PolicyStatus.SUSPENDED)
            : operation == 1 ? status == PolicyStatus.RETIRED : status == PolicyStatus.PROPOSED;
        if (!authorized || !valid) {
            bytes memory expected = !authorized
                ? (operation == 1 ? _ownerError() : abi.encodeWithSelector(Errors.NotAuthorized.selector))
                : abi.encodeWithSelector(Errors.InvalidManifestTransition.selector);
            bytes32 beforeDigest = _governanceDigest();
            _lifecycleCall(operation, caller, expected);
            assertEq(_governanceDigest(), beforeDigest);
        } else {
            _lifecycleCall(operation, caller, "");
            PolicyStatus next =
                operation == 0 ? PolicyStatus.RETIRED : operation == 1 ? PolicyStatus.PROPOSED : PolicyStatus.ACTIVE;
            if (operation == 1) ++versionModel;
            _history(
                status,
                next,
                manifestModel,
                manifestModel,
                versionModel,
                caller,
                operation == 0 ? bytes32("assurance") : bytes32(0),
                planModel,
                uint64(block.timestamp)
            );
            status = next;
            if (operation == 0) {
                ready[6] = 0;
                updateReady = 0;
            }
            ++controls;
        }
        assertGovernance();
    }

    function _lifecycleCall(uint8 operation, address caller, bytes memory expected) internal {
        // Prepare argument reads before prank/expectation is consumed by the target call.
        ManifestCore memory m;
        if (operation == 1) {
            m.status = PolicyStatus.PROPOSED;
            m.supportedEngines = 5;
            m.fullManifestHash = manifestModel;
        }
        ManifestPolicyConfig memory config = _config(activeTrack);
        if (expected.length != 0) vm.expectRevert(expected);
        vm.prank(caller);
        if (operation == 0) {
            policyReg.retireManifest(address(rwaToken), "assurance");
        } else if (operation == 1) {
            policyReg.registerManifest(
                address(rwaToken), m, _assuranceBindings(activeRecipe), new ElementEnforcementOverride[](0), config
            );
        } else {
            policyReg.approveManifest(address(rwaToken));
        }
    }

    function _policyIdentity() internal view returns (bytes32) {
        (,, bytes32 tokenPolicy) = engine.policyHashesOf(address(rwaToken));
        return tokenPolicy;
    }

    function _configHash(uint8 track) internal view returns (bytes32) {
        return keccak256(abi.encode(keccak256("CORNER_STORE_MANIFEST_POLICY_CONFIG_V1"), _config(track)));
    }

    function _history(
        PolicyStatus oldStatus,
        PolicyStatus newStatus,
        bytes32 oldHash,
        bytes32 newHash,
        uint64 version_,
        address caller,
        bytes32 reason,
        bytes32 plan,
        uint64 time
    ) internal {
        historyModel = keccak256(
            abi.encode(
                address(policyReg),
                address(rwaToken),
                historyModel,
                oldStatus,
                newStatus,
                oldHash,
                newHash,
                version_,
                caller,
                reason,
                plan,
                time
            )
        );
    }

    function _ownerError() internal pure returns (bytes memory) {
        return abi.encodeWithSignature("Error(string)", "Ownable: caller is not the owner");
    }

    function _controlCall(uint8 scope, uint8 op) internal view returns (address target, bytes memory data) {
        target = scope == 6 ? address(policyReg) : address(operatorReg);
        if (scope == 6) {
            if (op == 0) data = abi.encodeCall(policyReg.suspendManifest, (address(rwaToken), bytes32("assurance")));
            if (op == 1) {
                data = abi.encodeCall(policyReg.scheduleManifestResume, (address(rwaToken), bytes32("assurance")));
            }
            if (op == 2) data = abi.encodeCall(policyReg.cancelManifestResume, (address(rwaToken)));
            if (op == 3) data = abi.encodeCall(policyReg.resumeManifest, (address(rwaToken)));
        } else if (scope == 0) {
            if (op == 0) data = abi.encodeCall(operatorReg.setGlobalPaused, (true, bytes32("assurance")));
            if (op == 1) data = abi.encodeCall(operatorReg.scheduleGlobalUnpause, (bytes32("assurance")));
            if (op == 2) data = abi.encodeCall(operatorReg.cancelGlobalUnpause, ());
            if (op == 3) data = abi.encodeCall(operatorReg.executeGlobalUnpause, ());
        } else if (scope < 3) {
            address token = scope == 1 ? address(quote) : address(rwaToken);
            if (op == 0) data = abi.encodeCall(operatorReg.setAssetSuspended, (token, true, bytes32("assurance")));
            if (op == 1) data = abi.encodeCall(operatorReg.scheduleAssetUnpause, (token, bytes32("assurance")));
            if (op == 2) data = abi.encodeCall(operatorReg.cancelAssetUnpause, (token));
            if (op == 3) data = abi.encodeCall(operatorReg.executeAssetUnpause, (token));
        } else {
            address venue = scope == 3 ? address(pool) : scope == 4 ? VENUE_V2 : VENUE_V3;
            if (op == 0) data = abi.encodeCall(operatorReg.setVenueSuspended, (venue, true, bytes32("assurance")));
            if (op == 1) data = abi.encodeCall(operatorReg.scheduleVenueUnpause, (venue, bytes32("assurance")));
            if (op == 2) data = abi.encodeCall(operatorReg.cancelVenueUnpause, (venue));
            if (op == 3) data = abi.encodeCall(operatorReg.executeVenueUnpause, (venue));
        }
    }

    function _governanceDigest() internal view returns (bytes32) {
        (uint64 time, bytes32 reason) = policyReg.pendingManifestResumeOf(address(rwaToken));
        return keccak256(
            abi.encode(operatorReg.pauseHistoryHash(), policyReg.manifestHistoryHashOf(address(rwaToken)), time, reason)
        );
    }

    function assertGovernance() public view {
        assertState();
        assertEq(operatorReg.isGlobalPaused(), closed[0]);
        assertEq(operatorReg.isAssetSuspended(address(quote)), closed[1]);
        assertEq(operatorReg.isAssetSuspended(address(rwaToken)), closed[2]);
        assertEq(operatorReg.isVenueSuspended(address(pool)), closed[3]);
        assertEq(operatorReg.isVenueSuspended(VENUE_V2), closed[4]);
        assertEq(operatorReg.isVenueSuspended(VENUE_V3), closed[5]);
        assertEq(uint256(policyReg.statusOf(address(rwaToken))), uint256(status));
        (uint64 resumeReady,) = policyReg.pendingManifestResumeOf(address(rwaToken));
        assertEq(resumeReady, ready[6]);
        assertEq(policyReg.manifestVersionOf(address(rwaToken)), versionModel);
        assertEq(policyReg.manifestHistoryHashOf(address(rwaToken)), historyModel);
        assertEq(policyReg.manifestOf(address(rwaToken)).fullManifestHash, manifestModel);
        assertEq(policyReg.compiledPlanHashOf(address(rwaToken)), planModel);
        assertEq(policyReg.policyConfigHashOf(address(rwaToken)), configModel);
        RecipeBinding[] memory bindings = policyReg.recipeBindingsOf(address(rwaToken));
        assertEq(bindings[0].recipeVersion, activeRecipe);
        if (status == PolicyStatus.ACTIVE) {
            assertEq(engine.evaluate(_request(0, 0, 0, false, 1, 0, 0).context).policyId, policyModel);
        }
        bytes32 key = recipeReg.recipeKeyOf(8);
        assertEq(recipeReg.latestRegisteredVersionOf(key), latestRecipe);
        for (uint16 v = 2; v <= 12; ++v) {
            assertEq(recipeReg.recipeOf(key, v), registrations[v], "immutable exact recipe");
            if (registrations[v] != address(0)) {
                assertEq(recipeReg.runtimeCodeHashOf(key, v), registrations[v].codehash);
            }
        }
        assertEq(elementReg.elementOf("A-04-v2"), address(evidence));
        assertEq(elementReg.runtimeCodeHashOf("A-04-v2"), address(evidence).codehash);
    }
}
