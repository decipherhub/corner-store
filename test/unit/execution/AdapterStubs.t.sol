// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {OrderBookAdapter} from "../../../src/execution/adapters/orderbook/OrderBookAdapter.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../src/types/ComplianceTypes.sol";

contract AdapterStubsTest is Test {
    OrderBookAdapter internal ob;

    function setUp() public {
        ob = new OrderBookAdapter();
    }

    function _req() internal pure returns (ExecutionRequest memory req) {
        // zero-valued request is sufficient; the stubs revert before reading.
        req.deadline = 0;
    }

    function test_orderbook_notImplemented() public {
        ComplianceDecision memory d;
        vm.expectRevert("OrderBook: not implemented");
        ob.execute(_req(), d);
    }
}
