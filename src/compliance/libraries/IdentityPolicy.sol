// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

library IdentityPolicy {
    bytes32 internal constant ELEMENT_ID = "A-04-v2";
    bytes32 internal constant SCHEMA_ID = keccak256("corner-store.element.identity-policy.v1");

    function valid(bytes memory parameters) internal pure returns (bool result) {
        assembly {
            let trackValue := mload(add(parameters, 32))
            result := and(eq(mload(parameters), 64), and(lt(sub(trackValue, 1), 2), eq(mload(add(parameters, 64)), 1)))
        }
    }

    function track(bytes memory parameters) internal pure returns (uint256 result) {
        assembly {
            result := mload(add(parameters, 32))
        }
    }
}
