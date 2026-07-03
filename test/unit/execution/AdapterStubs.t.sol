// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {OrderBookAdapter} from "../../../src/execution/adapters/orderbook/OrderBookAdapter.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract AdapterStubsTest is Test {
    OrderBookAdapter internal ob;

    address internal constant ROUTER = address(0xA17E);

    function setUp() public {
        ob = new OrderBookAdapter();
        ob.setRouter(ROUTER);
    }

    function _req() internal pure returns (ExecutionRequest memory req) {
        // zero-valued request is sufficient; the stub reverts before reading.
        req.deadline = 0;
    }

    function test_orderbook_notImplemented() public {
        ComplianceDecision memory d;
        vm.prank(ROUTER);
        vm.expectRevert("OrderBook: not implemented");
        ob.execute(_req(), d);
    }

    function test_orderbook_revertsDirectCaller() public {
        ComplianceDecision memory d;
        vm.expectRevert(Errors.NotAuthorized.selector);
        ob.execute(_req(), d);
    }
}
