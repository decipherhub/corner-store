// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {OrderBookAdapter} from "../../../src/execution/adapters/orderbook/OrderBookAdapter.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract AdapterStubsTest is Test {
    RFQAdapter internal rfq;
    OrderBookAdapter internal ob;

    function setUp() public {
        rfq = new RFQAdapter();
        ob = new OrderBookAdapter();
    }

    function _req() internal pure returns (ExecutionRequest memory req) {
        // zero-valued request is sufficient; the stubs revert before reading.
        req.deadline = 0;
    }

    function test_rfq_notImplemented() public {
        ComplianceDecision memory d;
        vm.expectRevert("RFQ: not implemented");
        rfq.execute(_req(), d);
    }

    function test_orderbook_notImplemented() public {
        ComplianceDecision memory d;
        vm.expectRevert("OrderBook: not implemented");
        ob.execute(_req(), d);
    }
}
