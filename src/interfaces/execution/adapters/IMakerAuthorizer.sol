// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IMakerAuthorizer {
    function authorizerVersion() external pure returns (uint64);

    function isAuthorizedSigner(address maker, bytes32 quoteHash, bytes calldata signature) external view returns (bool);
}
