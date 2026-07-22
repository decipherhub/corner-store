// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {DecisionHashLib} from "../../../src/libraries/DecisionHashLib.sol";
import {ComplianceContext, VenueType, FlowType} from "../../../src/types/ComplianceTypes.sol";

contract DecisionHashLibTest is Test {
    function test_compute_preservesCanonicalEncoding() public pure {
        ComplianceContext memory context;
        context.initiator = address(1);
        context.buyer = address(2);
        context.seller = address(3);
        context.tokenIn = address(4);
        context.tokenOut = address(5);
        context.amountIn = 100;
        context.amountOut = 200;
        context.venueType = VenueType.RFQ;
        context.venue = address(6);
        context.flowType = FlowType.PRIMARY_DISTRIBUTION;

        bytes32 actual = DecisionHashLib.compute(context, 300, 5, bytes32(uint256(7)), 8, 9);

        assertEq(actual, 0xde197a82d876e515a314630ada3ce30fa0bd21f156b23e377889430d1aad8cbd);
    }
}
