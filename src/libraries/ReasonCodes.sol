// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

// reasonCode = bytes32(abi.encodePacked(recipeId(2) | elementId(8) | code(4))) — 단순 packing
library ReasonCodes {
    bytes32 internal constant OK = bytes32(0);

    function encode(uint16 recipeId, bytes32 elementId, uint32 code) internal pure returns (bytes32) {
        return keccak256(abi.encode(recipeId, elementId, code));
    }
}
