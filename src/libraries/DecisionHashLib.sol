// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext} from "../types/ComplianceTypes.sol";

library DecisionHashLib {
    function compute(
        ComplianceContext memory c,
        uint256 maxAmount,
        uint256 allowedVenueTypes,
        bytes32 allowedVenuesHash,
        uint64 policyVersion,
        uint64 validUntil
    ) internal pure returns (bytes32) {
        bytes memory trade = abi.encode(c.initiator, c.buyer, c.seller, c.tokenIn, c.tokenOut, c.amountIn, c.amountOut);
        bytes memory execution = abi.encode(
            c.venueType, c.venue, c.flowType, maxAmount, allowedVenueTypes, allowedVenuesHash, policyVersion, validUntil
        );
        return keccak256(bytes.concat(trade, execution));
    }
}
