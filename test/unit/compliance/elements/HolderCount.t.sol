// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {HolderCount, IIdentityView, IAiView} from "../../../../src/compliance/elements/HolderCount.sol";
import {IdentityUniqueness} from "../../../../src/compliance/elements/IdentityUniqueness.sol";
import {AccreditedInvestor} from "../../../../src/compliance/elements/AccreditedInvestor.sol";
import {Errors} from "../../../../src/libraries/Errors.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../../../src/types/ComplianceTypes.sol";

contract HolderCountTest is Test {
    // Re-declared to match HolderCount's own events for vm.expectEmit — Solidity
    // 0.8.17 cannot `emit` an event declared on another contract by qualified name.
    event HolderCountChanged(
        bytes32 indexed identityId, address indexed wallet, bool entered, uint256 holderCount, uint256 nonAiCount
    );

    // REAL A-04 / A-03 fixtures (not mocks), per the plan.
    IdentityUniqueness internal ident;
    AccreditedInvestor internal air;
    HolderCount internal hc;

    address internal engine = address(0xE);
    address internal operator = address(0x0733);
    address internal stranger = address(0xBAD);

    function setUp() public {
        ident = new IdentityUniqueness();
        air = new AccreditedInvestor();
        // Default mode TWELVE_G; individual tests re-set via setCapMode.
        hc = new HolderCount(HolderCount.CapMode.TWELVE_G, IIdentityView(address(ident)), IAiView(address(air)));
        hc.setEngine(engine); // owner-gated (test contract is owner)
        hc.setOperator(operator, true);
    }

    // reasonCode recompute per plan: keccak256(abi.encode(uint16(0), id, uint32(n))).
    function _code(uint32 n) internal pure returns (bytes32) {
        return keccak256(abi.encode(uint16(0), bytes32("D-01-v1"), n));
    }

    function _wallet(uint256 i) internal pure returns (address) {
        return address(uint160(0x100000 + i));
    }

    // Mint one unit to `to` as the engine (new holder entry when to is fresh).
    function _mint(address to) internal {
        vm.prank(engine);
        hc.onTransfer(address(0), to, 1);
    }

    // -------------------------------------------------------------------------
    // metadata
    // -------------------------------------------------------------------------

    function test_metadata_fields() public view {
        ElementMetadata memory m = hc.elementMetadata();
        assertEq(m.elementId, bytes32("D-01-v1"));
        assertEq(uint256(m.category), uint256(ElementCategory.SYSTEM_STATE));
        assertEq(uint256(m.temporal), uint256(TemporalNature.CUMULATIVE));
        assertEq(uint256(m.decidability), uint256(Decidability.DETERMINISTIC));
        assertEq(uint256(m.timing), uint256(ObligationTiming.AT_TRADE_GATE));
        assertEq(uint256(m.statefulness), uint256(Statefulness.STATEFUL));
    }

    function test_constructor_revertsOnZeroIdentity() public {
        vm.expectRevert(HolderCount.ZeroDependency.selector);
        new HolderCount(HolderCount.CapMode.NONE, IIdentityView(address(0)), IAiView(address(air)));
    }

    function test_constructor_revertsOnZeroAi() public {
        vm.expectRevert(HolderCount.ZeroDependency.selector);
        new HolderCount(HolderCount.CapMode.NONE, IIdentityView(address(ident)), IAiView(address(0)));
    }

    // -------------------------------------------------------------------------
    // auth
    // -------------------------------------------------------------------------

    function test_onTransfer_revertsForNonEngine() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        hc.onTransfer(address(0), _wallet(1), 1);
    }

    function test_setCapMode_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        hc.setCapMode(HolderCount.CapMode.THREE_C_1);
    }

    function test_setAssetGateMet_revertsForNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        hc.setAssetGateMet(true);
    }

    function test_setOperator_revertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.NotAuthorized.selector);
        hc.setOperator(stranger, true);
    }

    function test_operator_canSetCapMode() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.THREE_C_1);
        assertEq(uint256(hc.capMode()), uint256(HolderCount.CapMode.THREE_C_1));
    }

    // -------------------------------------------------------------------------
    // check: cheap paths
    // -------------------------------------------------------------------------

    function test_check_amountZero_passes() public {
        // Even in a mode with the asset gate on, a zero-amount trade never counts.
        vm.prank(operator);
        hc.setAssetGateMet(true);
        (bool passed, bytes32 rc) = hc.check(_wallet(1), address(0), address(0), 0, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));
    }

    function test_check_capModeNone_passesEverything() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.NONE);
        (bool passed,) = hc.check(_wallet(1), address(0), address(0), 1, "");
        assertTrue(passed);
    }

    function test_twelveG_assetGateFalse_passesEverything() public {
        // assetGateMet defaults false => Rule 12g-1(a) exemption => always PASS,
        // and commit never reverts, even past the total cap.
        assertFalse(hc.assetGateMet());
        for (uint256 i = 0; i < 5; i++) {
            (bool passed,) = hc.check(_wallet(i), address(0), address(0), 1, "");
            assertTrue(passed);
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 5);
    }

    // -------------------------------------------------------------------------
    // P1: existing holder passes without count effect
    // -------------------------------------------------------------------------

    function test_existingHolder_passesWithoutCountEffect() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.FIVE_06_B);
        // Fill to exactly the cap (35 holders).
        for (uint256 i = 0; i < 35; i++) {
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 35);

        // A transfer to an already-counted holder passes even at the cap...
        (bool passed, bytes32 rc) = hc.check(_wallet(0), address(0), address(0), 1, "");
        assertTrue(passed);
        assertEq(rc, bytes32(0));

        // ...and committing it does not change the count.
        vm.prank(engine);
        hc.onTransfer(address(0), _wallet(0), 5);
        assertEq(hc.holderCount(), 35);
    }

    // -------------------------------------------------------------------------
    // dedup via REAL IdentityUniqueness
    // -------------------------------------------------------------------------

    function test_dedup_boundWallet_countsUnderIdentityNotAddress() public {
        // NOTE: the real A-04 IdentityUniqueness mock enforces a STRICT 1:1
        // wallet<->identity binding (walletOf[id] holds a single wallet), so two
        // distinct wallets sharing one identity is not constructible with the real
        // fixture (see deviation note). What IS observable, and is the core dedup
        // property D-01 relies on, is that counting is keyed by the A-04 identity
        // id, NOT the raw wallet address.
        bytes32 idP = keccak256("person-P");
        address wP = _wallet(10);
        ident.bindIdentity(wP, idP); // test contract is IdentityUniqueness owner
        _mint(wP);
        assertEq(hc.holderCount(), 1);
        assertEq(hc.balanceOfIdentity(idP), 1); // counted under the identity id
        assertEq(hc.balanceOfIdentity(bytes32(uint256(uint160(wP)))), 0); // NOT the address

        // A second unit to the same bound wallet: same identity already holds =>
        // P1 pass, no new holder.
        (bool passed,) = hc.check(wP, address(0), address(0), 1, "");
        assertTrue(passed);
        vm.prank(engine);
        hc.onTransfer(address(0), wP, 1);
        assertEq(hc.holderCount(), 1);
    }

    function test_unboundWallet_countsAsItself() public {
        // No binding: identity falls back to bytes32(uint160(wallet)).
        address w = _wallet(7);
        _mint(w);
        assertEq(hc.holderCount(), 1);
        assertEq(hc.balanceOfIdentity(bytes32(uint256(uint160(w)))), 1);

        address w2 = _wallet(8);
        _mint(w2);
        assertEq(hc.holderCount(), 2);
    }

    // -------------------------------------------------------------------------
    // THREE_C_1 boundary (100): 100th PASS / 101st FAIL(3)
    // -------------------------------------------------------------------------

    function test_threeC1_boundary_100pass_101fail() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.THREE_C_1);

        // Enter 99 holders; the 100th entrant is still within <= 100.
        for (uint256 i = 0; i < 99; i++) {
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 99);

        // 100th new person: resulting 100, 100 > 100 is false => PASS.
        (bool pass100, bytes32 rc100) = hc.check(_wallet(99), address(0), address(0), 1, "");
        assertTrue(pass100);
        assertEq(rc100, bytes32(0));
        _mint(_wallet(99));
        assertEq(hc.holderCount(), 100);

        // 101st new person: resulting 101 > 100 => FAIL code 3.
        (bool pass101, bytes32 rc101) = hc.check(_wallet(100), address(0), address(0), 1, "");
        assertFalse(pass101);
        assertEq(rc101, _code(3));
    }

    // -------------------------------------------------------------------------
    // FIVE_06_B boundary (35): 35th PASS / 36th FAIL(4)
    // -------------------------------------------------------------------------

    function test_fiveOhSixB_boundary_35pass_36fail() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.FIVE_06_B);

        for (uint256 i = 0; i < 34; i++) {
            _mint(_wallet(i));
        }
        (bool pass35,) = hc.check(_wallet(34), address(0), address(0), 1, "");
        assertTrue(pass35);
        _mint(_wallet(34));
        assertEq(hc.holderCount(), 35);

        (bool pass36, bytes32 rc36) = hc.check(_wallet(35), address(0), address(0), 1, "");
        assertFalse(pass36);
        assertEq(rc36, _code(4));
    }

    // -------------------------------------------------------------------------
    // TWELVE_G non-AI 500 cap (code 2) + AI buyers don't consume the non-AI budget
    // -------------------------------------------------------------------------

    function test_twelveG_nonAiCap_500_andAiDoesNotConsumeBudget() public {
        vm.prank(operator);
        hc.setAssetGateMet(true); // TWELVE_G already set in setUp

        // 499 non-accredited holders (accredited defaults false).
        for (uint256 i = 0; i < 499; i++) {
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 499);
        assertEq(hc.nonAiCount(), 499);

        // An AI buyer passes (total 500 < 2000) and does NOT touch the non-AI budget.
        address aiBuyer = _wallet(1000);
        air.setAccredited(aiBuyer, true);
        (bool passAi,) = hc.check(aiBuyer, address(0), address(0), 1, "");
        assertTrue(passAi);
        _mint(aiBuyer);
        assertEq(hc.holderCount(), 500);
        assertEq(hc.nonAiCount(), 499); // unchanged

        // A further non-AI buyer: nonAi 499 + 1 == 500 >= 500 => FAIL code 2,
        // even though total (501) is far below 2000.
        (bool passNon, bytes32 rc) = hc.check(_wallet(2000), address(0), address(0), 1, "");
        assertFalse(passNon);
        assertEq(rc, _code(2));
    }

    // -------------------------------------------------------------------------
    // TWELVE_G total cap (code 1): 1999th PASS / 2000th FAIL(1)
    // -------------------------------------------------------------------------

    function test_twelveG_totalCap_2000_boundary() public {
        vm.prank(operator);
        hc.setAssetGateMet(true);

        // Enter 1999 AI holders (so the non-AI budget never trips first).
        for (uint256 i = 0; i < 1999; i++) {
            address w = _wallet(i);
            air.setAccredited(w, true);
            _mint(w);
        }
        assertEq(hc.holderCount(), 1999);

        // 1999 holders is still < 2000 (the 1999th entry above passed at commit).
        // The 2000th new person: resulting 2000 >= 2000 => FAIL code 1.
        address next = _wallet(5000);
        air.setAccredited(next, true);
        (bool passed, bytes32 rc) = hc.check(next, address(0), address(0), 1, "");
        assertFalse(passed);
        assertEq(rc, _code(1));
    }

    // -------------------------------------------------------------------------
    // commit-time re-validation: engine drives a past-cap entry directly => revert
    // -------------------------------------------------------------------------

    function test_commit_reValidates_revertsComplianceRejected() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.FIVE_06_B);
        for (uint256 i = 0; i < 35; i++) {
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 35);

        // Even though check would reject, exercise onTransfer directly (gate bypass
        // / gate-to-commit race): the commit re-validates and reverts.
        vm.prank(engine);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, _code(4)));
        hc.onTransfer(address(0), _wallet(100), 1);
    }

    // -------------------------------------------------------------------------
    // exit decrement frees a slot
    // -------------------------------------------------------------------------

    function test_exit_freesSlot_forNewEntrant() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.FIVE_06_B);
        for (uint256 i = 0; i < 35; i++) {
            _mint(_wallet(i));
        }
        assertEq(hc.holderCount(), 35);

        // 36th new entrant is blocked.
        (bool blocked,) = hc.check(_wallet(100), address(0), address(0), 1, "");
        assertFalse(blocked);

        // Holder 0 sells out to an EXISTING holder (1): no new entry, holder 0 exits.
        vm.prank(engine);
        hc.onTransfer(_wallet(0), _wallet(1), 1);
        assertEq(hc.holderCount(), 34);

        // Now the previously-blocked entrant passes and can commit.
        (bool nowOk,) = hc.check(_wallet(100), address(0), address(0), 1, "");
        assertTrue(nowOk);
        _mint(_wallet(100));
        assertEq(hc.holderCount(), 35);
    }

    // -------------------------------------------------------------------------
    // AI-snapshot invariant: a post-entry accredited flip must not desync the
    // non-AI decrement on exit.
    // -------------------------------------------------------------------------

    function test_aiSnapshot_invariant_flipAfterEntry_exitStillDecrements() public {
        vm.prank(operator);
        hc.setAssetGateMet(true); // TWELVE_G

        address w = _wallet(1);
        // Enter as NON-accredited => counted in the non-AI budget.
        _mint(w);
        assertEq(hc.holderCount(), 1);
        assertEq(hc.nonAiCount(), 1);
        assertTrue(hc.countedNonAi(bytes32(uint256(uint160(w)))));

        // Flip to accredited AFTER entry. A live read on exit would (wrongly) skip
        // the non-AI decrement; the snapshot must win.
        air.setAccredited(w, true);

        // Burn (sell out): exit decrements holderCount and, via the snapshot,
        // nonAiCount back to 0.
        vm.prank(engine);
        hc.onTransfer(w, address(0), 1);
        assertEq(hc.holderCount(), 0);
        assertEq(hc.nonAiCount(), 0);
        assertFalse(hc.countedNonAi(bytes32(uint256(uint160(w)))));
    }

    // -------------------------------------------------------------------------
    // event emission on entry / exit
    // -------------------------------------------------------------------------

    function test_holderCountChanged_events() public {
        vm.prank(operator);
        hc.setCapMode(HolderCount.CapMode.NONE);
        address w = _wallet(1);
        bytes32 id = bytes32(uint256(uint160(w)));

        vm.expectEmit(true, true, false, true);
        emit HolderCountChanged(id, w, true, 1, 1);
        vm.prank(engine);
        hc.onTransfer(address(0), w, 1);

        vm.expectEmit(true, true, false, true);
        emit HolderCountChanged(id, w, false, 0, 0);
        vm.prank(engine);
        hc.onTransfer(w, address(0), 1);
    }
}
