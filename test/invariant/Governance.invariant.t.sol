// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {GovernanceHandler} from "./handlers/GovernanceHandler.sol";

contract GovernanceInvariantTest is Test {
    GovernanceHandler internal handler;

    function setUp() public {
        handler = new GovernanceHandler();
        // Exercise cancellation, re-pause invalidation, both authorities and the exact delay.
        for (uint8 scope; scope < 7; ++scope) {
            handler.control(scope, 0, 1);
            handler.probe(false, scope % 3);
            handler.control(scope, 1, 0);
            handler.control(scope, 3, 0);
            handler.control(scope, 2, 0);
            handler.control(scope, 3, 0);
            handler.control(scope, 1, 0);
            if (scope != 6) {
                handler.control(scope, 0, 1);
                handler.control(scope, 3, 0);
                handler.control(scope, 1, 0);
            }
            handler.advance(1 days);
            handler.control(scope, 3, scope == 6 ? 1 : 0);
        }
        handler.registerVersion(3);
        handler.update(0, 1);
        handler.update(2, 0);
        handler.advance(1 days);
        handler.update(2, 0);
        handler.probe(true, 2);
        handler.control(6, 0, 1);
        handler.control(6, 1, 0);
        handler.lifecycle(0, 1);
        handler.probe(false, 0);
        handler.control(6, 3, 0);
        handler.lifecycle(1, 0);
        handler.probe(false, 0);
        handler.lifecycle(2, 1);
        handler.control(6, 3, 0);
        handler.probe(false, 0);
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = handler.control.selector;
        selectors[1] = handler.advance.selector;
        selectors[2] = handler.probe.selector;
        selectors[3] = handler.setRole.selector;
        selectors[4] = handler.registerVersion.selector;
        selectors[5] = handler.update.selector;
        selectors[6] = handler.lifecycle.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_pauseResumeAuthorization() public view {
        handler.assertGovernance();
        assertGt(handler.controls(), 0);
        assertGt(handler.blockedTrades(), 0);
        assertGt(handler.successes(), 0);
    }

    function invariant_exactVersionBinding() public view {
        handler.assertGovernance();
        assertGt(handler.activations(), 0);
        assertGt(handler.registrationsChecked(), 0);
    }

    function test_updateWhileSuspendedBindsOnResume() public {
        handler.control(6, 0, 1);
        handler.update(0, 1);
        handler.advance(1 days);
        handler.update(2, 0);
        handler.control(6, 1, 0);
        handler.advance(1 days);
        handler.control(6, 3, 1);
        handler.probe(false, 2);
    }

    function testFuzz_delayBoundary(uint32 rawDelay) public {
        uint32 delay = uint32(bound(rawDelay, 0, 1 days + 1));
        handler.control(0, 0, 1);
        handler.control(0, 1, 0);
        handler.advance(delay);
        handler.control(0, 3, 0);
        handler.probe(false, 0);
    }

    function testFuzz_exactRegistrationVersion(uint16 version_) public {
        handler.registerVersion(version_);
        handler.registerVersion(version_);
        handler.assertGovernance();
    }
}
