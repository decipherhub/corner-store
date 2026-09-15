// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceContext} from "../types/ComplianceTypes.sol";

library DecisionHashLib {
    bytes32 internal constant DECISION_HASH_DOMAIN = keccak256("CORNER_STORE_DECISION_V2");

    function compute(
        ComplianceContext memory c,
        bytes32 policyId,
        uint256 maxAmount,
        address maxAmountToken,
        uint256 allowedVenueTypes,
        bytes32 allowedVenuesHash,
        uint64 policyVersion,
        uint64 validUntil
    ) internal pure returns (bytes32) {
        bytes32 tradeHash = keccak256(
            abi.encode(c.initiator, c.buyer, c.seller, c.tokenIn, c.tokenOut, c.amountIn, c.amountOut)
        );
        bytes32 venueHash = keccak256(abi.encode(c.venueType, c.venue, c.flowType));
        bytes32 constraintHash = keccak256(
            abi.encode(
                policyId, maxAmount, maxAmountToken, allowedVenueTypes, allowedVenuesHash, policyVersion, validUntil
            )
        );
        return keccak256(abi.encode(DECISION_HASH_DOMAIN, tradeHash, venueHash, constraintHash));
    }
}
