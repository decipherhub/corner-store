// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

// reasonCode = keccak256(abi.encode(recipeId, elementId, code)). elementId가 full bytes32라
// 한 word에 bit-packing할 수 없어 collision-resistant digest를 쓴다. 따라서 reasonCode는
// 온체인에서 decode 불가 — off-chain audit(17a-3/4)는 알려진 (recipeId, elementId, code)
// 조합을 재계산해 매칭한다(M4 propagation).
library ReasonCodes {
    bytes32 internal constant OK = bytes32(0);

    function encode(uint16 recipeId, bytes32 elementId, uint32 code) internal pure returns (bytes32) {
        return keccak256(abi.encode(recipeId, elementId, code));
    }
}
