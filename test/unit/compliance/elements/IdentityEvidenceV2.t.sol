// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {IdentityUniquenessV2} from "../../../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IIdentityEvidenceV2} from "../../../../src/interfaces/compliance/IIdentityEvidenceV2.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract IdentityEvidenceV2Test is Test {
    IdentityUniquenessV2 internal element;
    address internal constant WALLET = address(0x123);
    address internal constant ASSET = address(0x456);
    bytes32 internal constant ID = bytes32(uint256(1));
    bytes32 internal constant ISSUER = bytes32(uint256(2));
    bytes32 internal constant BASIS = bytes32(uint256(3));

    event TrustedIssuerSet(bytes32 indexed issuerId, bytes32 trustBasisHash);
    event EvidenceAccepted(
        address indexed wallet, address indexed asset, bytes32 indexed identityId, bytes32 evidenceHash
    );
    event EvidenceRevoked(address indexed wallet, address indexed asset);

    function setUp() public {
        vm.warp(1000);
        element = new IdentityUniquenessV2();
        element.bindIdentity(WALLET, ID);
        element.setTrustedIssuer(ISSUER, BASIS);
    }

    function evidence() internal pure returns (IIdentityEvidenceV2.Evidence memory) {
        return IIdentityEvidenceV2.Evidence(ID, ISSUER, BASIS, bytes32(uint256(4)), 900, 2000, 1);
    }

    function accept() internal {
        element.acceptEvidence(WALLET, ASSET, evidence());
    }

    function check(address wallet, address asset) internal view returns (bool passed) {
        (passed,) = element.check(wallet, address(0x789), asset, 1, "", abi.encode(uint8(1), uint8(1)));
    }

    function test_bindingDoesNotManufactureEvidence() public view {
        assertEq(element.identityOf(WALLET), ID);
        assertFalse(check(WALLET, ASSET));
        assertEq(element.evidenceOf(WALLET, ASSET).evidenceHash, bytes32(0));
    }

    function test_operatorOnlyAllEvidenceAndIdentityMutations() public {
        bytes[] memory calls = new bytes[](9);
        calls[0] = abi.encodeCall(element.bindIdentity, (address(9), bytes32(uint256(9))));
        calls[1] = abi.encodeCall(element.unbindIdentity, (WALLET));
        calls[2] = abi.encodeCall(element.setTrustedIssuer, (ISSUER, BASIS));
        calls[3] = abi.encodeCall(element.acceptEvidence, (WALLET, ASSET, evidence()));
        calls[4] = abi.encodeCall(element.revokeEvidence, (WALLET, ASSET));
        calls[5] = abi.encodeCall(element.setIdentityStatus, (ID, IdentityUniquenessV2.IdentityStatus.FROZEN));
        calls[6] = abi.encodeCall(element.setDedupStatus, (ID, IdentityUniquenessV2.DedupStatus.CONFIRMED_DUPLICATE));
        calls[7] = abi.encodeCall(element.setEnforceCounterparty, (true));
        calls[8] = abi.encodeCall(element.setOperator, (address(9), true));
        for (uint256 i; i < calls.length; i++) {
            vm.prank(address(8));
            (bool ok, bytes memory result) = address(element).call(calls[i]);
            assertFalse(ok);
            if (i < 8) assertEq(result, abi.encodeWithSelector(Errors.NotAuthorized.selector));
        }
        element.setOperator(address(8), true);
        vm.prank(address(8));
        element.acceptEvidence(WALLET, ASSET, evidence());
        assertTrue(check(WALLET, ASSET));
    }

    function test_trustedIssuerAndAcceptanceEventsContainOnlyCommitments() public {
        vm.expectEmit(true, false, false, true);
        emit TrustedIssuerSet(ISSUER, BASIS);
        element.setTrustedIssuer(ISSUER, BASIS);
        vm.expectEmit(true, true, true, true);
        emit EvidenceAccepted(WALLET, ASSET, ID, evidence().evidenceHash);
        accept();
        assertTrue(check(WALLET, ASSET));
        assertEq(element.evidenceOf(WALLET, ASSET).trustBasisHash, BASIS);
        vm.expectEmit(true, true, false, true);
        emit EvidenceRevoked(WALLET, ASSET);
        element.revokeEvidence(WALLET, ASSET);
        assertFalse(check(WALLET, ASSET));
    }

    function test_currentIssuerRemovalAndBasisChangeInvalidateAcceptedEvidence() public {
        accept();
        element.setTrustedIssuer(ISSUER, bytes32(0));
        assertFalse(check(WALLET, ASSET));
        element.setTrustedIssuer(ISSUER, bytes32(uint256(5)));
        assertFalse(check(WALLET, ASSET));
        element.setTrustedIssuer(ISSUER, BASIS);
        assertTrue(check(WALLET, ASSET));
    }

    function test_identityWalletAssetBindingAndRebindingCannotReplayEvidence() public {
        accept();
        assertFalse(check(WALLET, address(9)));
        assertFalse(check(address(9), ASSET));
        element.bindIdentity(WALLET, ID);
        assertTrue(check(WALLET, ASSET));
        element.unbindIdentity(WALLET);
        assertFalse(check(WALLET, ASSET));
        element.bindIdentity(WALLET, ID);
        assertFalse(check(WALLET, ASSET));
        assertEq(element.evidenceOf(WALLET, ASSET).evidenceHash, bytes32(0));
        accept();
        element.unbindIdentity(WALLET);
        element.bindIdentity(address(9), ID);
        assertFalse(check(address(9), ASSET));
    }

    function test_bindingRejectsZeroAndConflictingPairs() public {
        vm.expectRevert();
        element.bindIdentity(address(0), ID);
        vm.expectRevert();
        element.bindIdentity(address(9), bytes32(0));
        vm.expectRevert();
        element.bindIdentity(WALLET, bytes32(uint256(9)));
        vm.expectRevert();
        element.bindIdentity(address(9), ID);
    }

    function test_rejectsUnknownIssuerBasisTypesWindowsAndUnboundEvidence() public {
        IIdentityEvidenceV2.Evidence memory e = evidence();
        e.issuerId = bytes32(uint256(9));
        reject(e);
        e = evidence();
        e.trustBasisHash = bytes32(uint256(9));
        reject(e);
        e = evidence();
        e.evidenceHash = bytes32(0);
        reject(e);
        e = evidence();
        e.identityId = bytes32(uint256(9));
        reject(e);
        e = evidence();
        e.issuedAt = 0;
        reject(e);
        e = evidence();
        e.issuedAt = 1001;
        reject(e);
        e = evidence();
        e.expiresAt = 1000;
        reject(e);
        e = evidence();
        e.expiresAt = 899;
        reject(e);
        e = evidence();
        e.attestationType = 0;
        reject(e);
        e = evidence();
        e.attestationType = 4;
        reject(e);
        vm.expectRevert();
        element.acceptEvidence(address(9), ASSET, evidence());
        vm.expectRevert();
        element.acceptEvidence(WALLET, address(0), evidence());
        vm.expectRevert();
        element.setTrustedIssuer(bytes32(0), BASIS);
    }

    function reject(IIdentityEvidenceV2.Evidence memory e) internal {
        vm.expectRevert();
        element.acceptEvidence(WALLET, ASSET, e);
    }

    function test_allSupportedTypesAndExpiryBoundary() public {
        for (uint8 t = 1; t <= 3; t++) {
            IIdentityEvidenceV2.Evidence memory e = evidence();
            e.attestationType = t;
            element.acceptEvidence(WALLET, ASSET, e);
            assertTrue(check(WALLET, ASSET));
        }
        vm.warp(1999);
        assertTrue(check(WALLET, ASSET));
        vm.warp(2000);
        assertFalse(check(WALLET, ASSET));
        vm.warp(899);
        assertFalse(check(WALLET, ASSET));
    }

    function test_identityAndDedupRevocationAndCounterpartyGate() public {
        accept();
        element.setIdentityStatus(ID, IdentityUniquenessV2.IdentityStatus.FROZEN);
        assertFalse(check(WALLET, ASSET));
        element.setIdentityStatus(ID, IdentityUniquenessV2.IdentityStatus.REVOKED);
        assertFalse(check(WALLET, ASSET));
        element.setIdentityStatus(ID, IdentityUniquenessV2.IdentityStatus.ACTIVE);
        element.setDedupStatus(ID, IdentityUniquenessV2.DedupStatus.SUSPECTED_DUPLICATE);
        assertFalse(check(WALLET, ASSET));
        element.setDedupStatus(ID, IdentityUniquenessV2.DedupStatus.CONFIRMED_DUPLICATE);
        assertFalse(check(WALLET, ASSET));
        element.setDedupStatus(ID, IdentityUniquenessV2.DedupStatus.UNIQUE);
        assertTrue(check(WALLET, ASSET));
        element.setEnforceCounterparty(true);
        assertFalse(check(WALLET, ASSET));
        element.bindIdentity(address(0x789), bytes32(uint256(9)));
        IIdentityEvidenceV2.Evidence memory e = evidence();
        e.identityId = bytes32(uint256(9));
        element.acceptEvidence(address(0x789), ASSET, e);
        assertTrue(check(WALLET, ASSET));
    }

    function test_gasMeasureAcceptanceAndTradeCheck() public {
        uint256 start = gasleft();
        accept();
        emit log_named_uint("A-04-v2 acceptance harness gas", start - gasleft());
        start = gasleft();
        assertTrue(check(WALLET, ASSET));
        emit log_named_uint("A-04-v2 subsequent check harness gas", start - gasleft());
    }
}
