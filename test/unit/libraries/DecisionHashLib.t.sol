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

        bytes32 actual =
            DecisionHashLib.compute(context, bytes32(uint256(11)), 300, address(10), 5, bytes32(uint256(7)), 8, 9);

        assertEq(actual, 0xa78d923d9dd34020e42c2b9a91ead62482bbd4def295d15a418b8da515dcd654);
    }

    function test_compute_bindsPolicyId() public pure {
        ComplianceContext memory context;
        context.initiator = address(1);
        bytes32 first = DecisionHashLib.compute(context, bytes32(uint256(1)), 2, address(3), 4, bytes32(0), 5, 6);
        bytes32 second = DecisionHashLib.compute(context, bytes32(uint256(2)), 2, address(3), 4, bytes32(0), 5, 6);
        assertTrue(first != second);
    }
}
