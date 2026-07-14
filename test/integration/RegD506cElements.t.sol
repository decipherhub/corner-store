// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IntegrationBase} from "./IntegrationBase.sol";
import {ExecutionRequest} from "../../src/types/ExecutionTypes.sol";
import {Errors} from "../../src/libraries/Errors.sol";
import {ReasonCodes} from "../../src/libraries/ReasonCodes.sol";

/// @notice Full router-path coverage of the 9-element Reg D 506(c) recipe
///         (RegD506cRecipe v2) against the REAL ERC-3643 stack. A fully-attested
///         buyer + fully-attested asset settles; breaking exactly one element
///         family rejects with THAT element's reasonCode.
///
/// Because {setupBuyer} + {deployStack} make every one of the nine elements pass,
/// disabling a single attestation makes it the FIRST (and only) failing check, so
/// the engine's cumulative-AND returns that element's reasonCode. The engine
/// re-encodes failures as `ReasonCodes.encode(contributingRecipe, elementId, 1)`
/// with contributingRecipe = the RWA manifest's issuance recipe id (1).
contract RegD506cElementsTest is IntegrationBase {
    function setUp() public {
        deployStack(); // RegD506c (9 elements), no fund recipe
        fundPoolRWA(1_000 ether);
    }

    /// @dev The reasonCode the engine emits for a failed check of `elementId`
    ///      under the RegD506c issuance recipe (id 1, failure code 1).
    function _rejectCode(bytes32 elementId) internal pure returns (bytes32) {
        return ReasonCodes.encode(1, elementId, 1);
    }

    function _expectRejected(bytes32 elementId, ExecutionRequest memory req) internal {
        vm.prank(req.context.buyer);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, _rejectCode(elementId)));
        router.execute(req);
    }

    function _buyReq(address buyer) internal returns (ExecutionRequest memory) {
        fundBuyerQuote(buyer, 1_000 ether);
        return buildBuyRequest(buyer, 100 ether, 100 ether);
    }

    // --- happy path: fully-attested buyer + asset settles through all 9 -----

    function test_happyPath_nineElements_buySucceeds() public {
        setupBuyer(alice);
        ExecutionRequest memory req = _buyReq(alice);
        doBuy(req);
        assertEq(rwaToken.balanceOf(alice), 100 ether, "buyer received RWA through the 9-element recipe");
    }

    // --- A-02 jurisdiction: disallowed code → reject ------------------------

    function test_reject_jurisdictionDisallowed() public {
        setupBuyer(alice);
        jurisdiction.setJurisdiction(alice, bytes32("KP")); // not in the allowed set
        ExecutionRequest memory req = _buyReq(alice);
        _expectRejected(bytes32("A-02-v1"), req);
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA to a disallowed-jurisdiction buyer");
    }

    // --- A-02 jurisdiction: unset (bytes32(0)) → reject (fail-closed) --------

    function test_reject_jurisdictionUnset() public {
        setupBuyer(alice);
        jurisdiction.setJurisdiction(alice, bytes32(0)); // clear → fail-closed
        ExecutionRequest memory req = _buyReq(alice);
        _expectRejected(bytes32("A-02-v1"), req);
    }

    // --- A-04 identity: unbound → reject ------------------------------------

    function test_reject_identityUnbound() public {
        setupBuyer(alice);
        identity.unbindIdentity(alice); // clear the 1:1 binding
        ExecutionRequest memory req = _buyReq(alice);
        _expectRejected(bytes32("A-04-v1"), req);
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA to an unbound-identity buyer");
    }

    // --- A-05 US-tax residency: flagged resident → reject -------------------

    function test_reject_usTaxResidentFlagged() public {
        setupBuyer(alice);
        usTax.setUsTaxResident(alice, true);
        ExecutionRequest memory req = _buyReq(alice);
        _expectRejected(bytes32("A-05-v1"), req);
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA to a US-tax-resident buyer");
    }

    // --- B-01 asset classification: RWA not REG_D → reject ------------------
    // (Asset-side scenario chosen as B-01 over E-01 Form D; the same fail-closed
    //  shape applies to E-01 if Form D were cleared.)

    function test_reject_assetNotClassifiedRegD() public {
        setupBuyer(alice);
        assetClass.setClassification(address(rwaToken), bytes32(0)); // unclassify the asset
        ExecutionRequest memory req = _buyReq(alice);
        _expectRejected(bytes32("B-01-v1"), req);
        assertEq(rwaToken.balanceOf(alice), 0, "no RWA when the asset lacks REG_D classification");
    }
}
