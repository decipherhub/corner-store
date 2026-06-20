// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {TREXSuite} from "../fixtures/TREXSuite.sol";

/// @notice De-risk test: proves the TREXSuite deploys a REAL ERC-3643 token
/// whose compliance is genuinely enforced — not mocked.
contract TREXFixtureTest is TREXSuite {
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        deployTREX();
    }

    function test_verifyInvestor_makesVerified() public {
        assertFalse(idRegistry.isVerified(alice), "alice unverified before");
        verifyInvestor(alice);
        assertTrue(idRegistry.isVerified(alice), "alice verified after");
    }

    function test_unverifiedInvestor_isNotVerified() public {
        assertFalse(idRegistry.isVerified(bob), "bob never verified");
    }

    function test_mint_requiresVerifiedHolder() public {
        // minting to an unverified holder reverts (real enforcement)
        vm.expectRevert(bytes("Identity is not verified."));
        mint(bob, 1_000e18);

        verifyInvestor(alice);
        mint(alice, 1_000e18);
        assertEq(rwaToken.balanceOf(alice), 1_000e18);
    }

    function test_transfer_revertsToUnverifiedRecipient() public {
        verifyInvestor(alice);
        mint(alice, 1_000e18);

        // bob is NOT verified -> transfer must revert
        vm.prank(alice);
        vm.expectRevert(bytes("Transfer not possible"));
        rwaToken.transfer(bob, 100e18);
    }

    function test_transfer_succeedsBetweenVerifiedHolders() public {
        verifyInvestor(alice);
        verifyInvestor(bob);
        mint(alice, 1_000e18);

        vm.prank(alice);
        bool ok = rwaToken.transfer(bob, 100e18);
        assertTrue(ok, "verified->verified transfer");
        assertEq(rwaToken.balanceOf(bob), 100e18);
        assertEq(rwaToken.balanceOf(alice), 900e18);
    }

    function test_registerVenueIdentity_enablesPoolHolding() public {
        verifyInvestor(alice);
        address pool = address(0x9001);
        registerVenueIdentity(pool);
        mint(alice, 1_000e18);

        vm.prank(alice);
        rwaToken.transfer(pool, 250e18);
        assertEq(rwaToken.balanceOf(pool), 250e18);
    }
}
