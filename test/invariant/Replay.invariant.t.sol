// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ReplayHandler} from "./handlers/ReplayHandler.sol";

contract ReplayInvariantTest is Test {
    ReplayHandler internal handler;

    function setUp() public {
        handler = new ReplayHandler();
        handler.replay(0, false);
        handler.replay(1, true);
        handler.cancel(0, false, false);
        handler.cancel(1, true, true);
        handler.sharedRouters(false);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.replay.selector;
        selectors[1] = handler.cancel.selector;
        selectors[2] = handler.trade.selector;
        selectors[3] = handler.rejectThenRetry.selector;
        selectors[4] = handler.sharedRouters.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_nonceNamespaces() public view {
        handler.assertState();
        assertGe(handler.replayChecks(), 2);
        assertGe(handler.cancellations(), 2);
    }
}
