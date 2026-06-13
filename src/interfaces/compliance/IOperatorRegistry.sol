// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IOperatorRegistry {
    function setVenueSuspended(address venue, bool suspended, bytes32 reasonCode) external;

    function isVenueSuspended(address venue) external view returns (bool);
}
