// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @dev CR-3 seam: the real Rule 144 acquisition-time source is unresolved, so the
///      Lockup element reads acquisition time through this injected interface only.
interface IAcquisitionSource {
    function acquiredAt(address holder, address asset) external view returns (uint64);
}
