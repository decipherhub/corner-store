// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockERC1271Maker is IERC1271 {
    address public signer;

    constructor(address signer_) {
        signer = signer_;
    }

    function approveToken(IERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(hash, signature);
        if (error == ECDSA.RecoverError.NoError && recovered == signer) return IERC1271.isValidSignature.selector;
        return bytes4(0xffffffff);
    }
}
