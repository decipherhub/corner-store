// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

library IdentityPolicy {
    bytes32 internal constant ELEMENT_ID = "A-04-v2";
    bytes32 internal constant SCHEMA_ID = keccak256("corner-store.element.identity-policy.v1");

    function valid(bytes memory parameters) internal pure returns (bool) {
        if (parameters.length != 64) return false;
        uint256 track;
        uint256 topology;
        assembly {
            track := mload(add(parameters, 32))
            topology := mload(add(parameters, 64))
        }
        return (track == 1 || track == 2) && topology == 1;
    }
}
