// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {AssetEnforcementV3} from "../../../../src/compliance/elements/AssetEnforcementV3.sol";
import {Erc3643NativeV2} from "../../../../src/compliance/elements/Erc3643NativeV2.sol";
import {Erc3643AssetEnforcement} from "../../../../src/compliance/asset/Erc3643AssetEnforcement.sol";
import {
    ReferenceAllowlistAssetEnforcement
} from "../../../../src/compliance/asset/ReferenceAllowlistAssetEnforcement.sol";
import {
    IAssetEnforcement,
    AssetEnforcementRequest,
    AssetEnforcementResult,
    AssetEnforcementFailure
} from "../../../../src/interfaces/asset/IAssetEnforcement.sol";
import {ComplianceContext, VenueType, FlowType} from "../../../../src/types/ComplianceTypes.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract MockAssetEnforcement is IAssetEnforcement {
    uint16 public version = 1;
    bytes32 public digest = keccak256("binding");
    AssetEnforcementFailure public failure;
    bool public allowed = true;
    bool public badRequestDigest;
    bool public badResultBinding;
    bool public revertVersion;
    bool public revertBinding;
    bool public revertDecision;
    address public expectedAsset;
    address public expectedFrom;
    address public expectedTo;
    uint256 public expectedAmount;

    function configureExpectation(address asset, address from, address to, uint256 amount) external {
        expectedAsset = asset;
        expectedFrom = from;
        expectedTo = to;
        expectedAmount = amount;
    }

    function configureResult(bool allowed_, AssetEnforcementFailure failure_) external {
        allowed = allowed_;
        failure = failure_;
    }

    function configureMalformed(bool badRequestDigest_, bool badResultBinding_) external {
        badRequestDigest = badRequestDigest_;
        badResultBinding = badResultBinding_;
    }

    function configureReverts(bool version_, bool binding_, bool decision_) external {
        revertVersion = version_;
        revertBinding = binding_;
        revertDecision = decision_;
    }

    function setVersion(uint16 version_) external {
        version = version_;
    }

    function setDigest(bytes32 digest_) external {
        digest = digest_;
    }

    function enforcementVersion() external view returns (uint16) {
        if (revertVersion) revert("version unavailable");
        return version;
    }

    function bindingDigest(address) external view returns (bytes32) {
        if (revertBinding) revert("binding unavailable");
        return digest;
    }

    function willAllow(AssetEnforcementRequest calldata request)
        external
        view
        returns (AssetEnforcementResult memory result)
    {
        if (revertDecision) revert("decision unavailable");
        bool matches = request.asset == expectedAsset && request.from == expectedFrom && request.to == expectedTo
            && request.amount == expectedAmount && request.contextHash != bytes32(0);
        AssetEnforcementFailure selectedFailure = matches ? failure : AssetEnforcementFailure.MALFORMED;
        bool selectedAllowed = matches && allowed;
        return AssetEnforcementResult({
            allowed: selectedAllowed,
            failure: selectedFailure,
            requestDigest: badRequestDigest ? bytes32(uint256(1)) : keccak256(abi.encode(request)),
            bindingDigest: badResultBinding ? bytes32(uint256(2)) : digest
        });
    }
}

contract AssetEnforcementV3Test is Test {
    AssetEnforcementV3 internal element;
    MockAssetEnforcement internal adapter;
    bytes internal parameters;

    address internal asset = address(0xA551);
    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11);

    function setUp() public {
        element = new AssetEnforcementV3();
        adapter = new MockAssetEnforcement();
        adapter.configureExpectation(asset, seller, buyer, 100);
        parameters = _parameters(address(adapter), 1, address(adapter).codehash, adapter.digest());
    }

    function _code(uint32 n) internal pure returns (bytes32) {
        return ReasonCodes.encode(0, bytes32("B-02-v3"), n);
    }

    function _parameters(address selected, uint16 version, bytes32 codehash, bytes32 digest)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(selected, version, codehash, digest);
    }

    function _context(bool assetIsOut, uint256 amount) internal view returns (bytes memory) {
        return abi.encode(
            ComplianceContext({
                initiator: buyer,
                buyer: buyer,
                seller: seller,
                tokenIn: assetIsOut ? address(0xCA5) : asset,
                tokenOut: assetIsOut ? asset : address(0xCA5),
                amountIn: assetIsOut ? 1 : amount,
                amountOut: assetIsOut ? amount : 1,
                venueType: VenueType.RFQ,
                venue: address(0xFEE),
                flowType: FlowType.SECONDARY_TRADE,
                sellerIsAffiliate: false
            })
        );
    }

    function _check(uint256 amount, bytes memory context) internal view returns (bool, bytes32) {
        return element.check(buyer, seller, asset, amount, context, parameters);
    }

    function test_tokenOut_uses_authoritative_seller_to_buyer_and_amount() public view {
        (bool passed, bytes32 reason) = _check(100, _context(true, 100));
        assertTrue(passed);
        assertEq(reason, bytes32(0));
    }

    function test_tokenIn_reverses_direction() public {
        adapter.configureExpectation(asset, buyer, seller, 75);
        (bool passed,) = _check(75, _context(false, 75));
        assertTrue(passed);
    }

    function test_amount_mismatch_fails_closed_as_malformed() public view {
        (bool passed, bytes32 reason) = _check(99, _context(true, 99));
        assertFalse(passed);
        assertEq(reason, _code(1));
    }

    function test_unbound_and_unsupported_fail_closed() public view {
        bytes memory unsupported = _parameters(address(0), 0, bytes32(0), bytes32(0));
        (bool passed, bytes32 reason) = element.check(buyer, seller, asset, 100, _context(true, 100), unsupported);
        assertFalse(passed);
        assertEq(reason, _code(3));
    }

    function test_binding_and_version_drift_fail_closed() public {
        adapter.setDigest(keccak256("changed"));
        (bool passedDigest, bytes32 digestReason) = _check(100, _context(true, 100));
        assertFalse(passedDigest);
        assertEq(digestReason, _code(2));

        adapter.setDigest(keccak256("binding"));
        adapter.setVersion(2);
        (bool passedVersion, bytes32 versionReason) = _check(100, _context(true, 100));
        assertFalse(passedVersion);
        assertEq(versionReason, _code(2));
    }

    function test_unavailable_and_malformed_responses_fail_closed() public {
        adapter.configureReverts(false, false, true);
        (bool passedUnavailable, bytes32 unavailableReason) = _check(100, _context(true, 100));
        assertFalse(passedUnavailable);
        assertEq(unavailableReason, _code(1));

        adapter.configureReverts(false, false, false);
        adapter.configureMalformed(true, false);
        (bool passedMalformed, bytes32 malformedReason) = _check(100, _context(true, 100));
        assertFalse(passedMalformed);
        assertEq(malformedReason, _code(1));
    }

    function test_token_rejection_is_coarse_and_blocking() public {
        adapter.configureResult(false, AssetEnforcementFailure.TOKEN_REJECTED);
        (bool passed, bytes32 reason) = _check(100, _context(true, 100));
        assertFalse(passed);
        assertEq(reason, _code(4));
    }

    function test_policy_bytes_bind_version_digest_and_codehash() public view {
        bytes32 adapterDigest = adapter.digest();
        bytes32 adapterCodehash = address(adapter).codehash;
        for (uint256 i = 0; i < 3; i++) {
            bytes memory drifted = i == 0
                ? _parameters(address(adapter), 2, adapterCodehash, adapterDigest)
                : i == 1
                    ? _parameters(address(adapter), 1, adapterCodehash, keccak256("wrong"))
                    : _parameters(address(adapter), 1, keccak256("wrong code"), adapterDigest);
            (bool passed, bytes32 reason) = element.check(buyer, seller, asset, 100, _context(true, 100), drifted);
            assertFalse(passed);
            assertEq(reason, _code(2));
        }
    }

    function test_reference_allowlist_adapter_uses_same_boundary() public {
        ReferenceAllowlistAssetEnforcement allowlist = new ReferenceAllowlistAssetEnforcement();
        allowlist.setAllowed(asset, seller, buyer, true);
        bytes memory allowlistParameters =
            _parameters(address(allowlist), 1, address(allowlist).codehash, allowlist.bindingDigest(asset));

        (bool passed,) = element.check(buyer, seller, asset, 100, _context(true, 100), allowlistParameters);
        assertTrue(passed);

        allowlist.setAllowed(asset, seller, buyer, false);
        (bool drifted, bytes32 driftReason) =
            element.check(buyer, seller, asset, 100, _context(true, 100), allowlistParameters);
        assertFalse(drifted);
        assertEq(driftReason, _code(2));
    }

    function test_erc3643_wrapper_preserves_existing_b02_v2_decision() public {
        Erc3643NativeV2 legacy = new Erc3643NativeV2();
        legacy.setErc3643Native(asset, true);
        Erc3643AssetEnforcement erc3643 = new Erc3643AssetEnforcement(address(legacy));
        bytes memory erc3643Parameters =
            _parameters(address(erc3643), 1, address(erc3643).codehash, erc3643.bindingDigest(asset));

        (bool passed,) = element.check(buyer, seller, asset, 100, _context(true, 100), erc3643Parameters);
        assertTrue(passed);

        legacy.setErc3643Native(asset, false);
        (bool drifted, bytes32 driftReason) =
            element.check(buyer, seller, asset, 100, _context(true, 100), erc3643Parameters);
        assertFalse(drifted);
        assertEq(driftReason, _code(2));

        erc3643Parameters = _parameters(address(erc3643), 1, address(erc3643).codehash, erc3643.bindingDigest(asset));
        (bool rejected, bytes32 rejectionReason) =
            element.check(buyer, seller, asset, 100, _context(true, 100), erc3643Parameters);
        assertFalse(rejected);
        assertEq(rejectionReason, _code(4));
    }
}
