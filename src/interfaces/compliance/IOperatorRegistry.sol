// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IOperatorRegistry {
    function MIN_UNPAUSE_DELAY() external view returns (uint64);

    function setGlobalPaused(bool paused, bytes32 reasonCode) external;

    function scheduleGlobalUnpause(bytes32 reasonCode) external;

    function cancelGlobalUnpause() external;

    function executeGlobalUnpause() external;

    function setAssetSuspended(address token, bool suspended, bytes32 reasonCode) external;

    function scheduleAssetUnpause(address token, bytes32 reasonCode) external;

    function cancelAssetUnpause(address token) external;

    function executeAssetUnpause(address token) external;

    function setVenueSuspended(address venue, bool suspended, bytes32 reasonCode) external;

    function scheduleVenueUnpause(address venue, bytes32 reasonCode) external;

    function cancelVenueUnpause(address venue) external;

    function executeVenueUnpause(address venue) external;

    function isGlobalPaused() external view returns (bool);

    function isAssetSuspended(address token) external view returns (bool);

    function isVenueSuspended(address venue) external view returns (bool);
}
