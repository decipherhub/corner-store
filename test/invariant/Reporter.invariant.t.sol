// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ReporterHandler} from "./handlers/ReporterHandler.sol";

contract ReporterInvariantTest is Test {
    ReporterHandler internal handler;

    function setUp() public {
        handler = new ReporterHandler();
        handler.probe();
        for (uint8 i; i < 3; ++i) {
            handler.setRestricted(i, 1);
            handler.setRestricted(i, 2);
            handler.setRestricted(i, 0);
        }
        handler.setPublic(1);
        handler.setPublic(2);
        handler.setPublic(0);

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.setRestricted.selector;
        selectors[1] = handler.setPublic.selector;
        selectors[2] = handler.probe.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_reporterRedactsRestrictedFamilies() public view {
        handler.assertState();
        assertGe(handler.probes(), 13);
    }

    function testFuzz_reporterIsObservational(uint8 index, uint8 restrictedOutcome, uint8 publicOutcome) public {
        handler.setRestricted(index, restrictedOutcome);
        handler.setPublic(publicOutcome);
        handler.assertState();
    }
}
