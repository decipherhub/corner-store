// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IVenueSelector} from "../interfaces/execution/IVenueSelector.sol";
import {ComplianceDecision, VenueType} from "../types/ComplianceTypes.sol";

/// @title VenueSelector
/// @notice Pure policy-binding check between a ComplianceDecision and a concrete venue.
///
/// A venue is valid iff ALL of the following hold:
///   1. decision.allowed                                  — the decision itself permits trading.
///   2. allowedVenueTypes bit for `vtype` is set          — the venue's type is in the permitted set.
///      The mask is a bitfield indexed by `uint256(VenueType)` (AMM=0, ORDER_BOOK=1, RFQ=2).
///   3. allowedVenuesHash binding:
///        - bytes32(0)  => "any registered venue of an allowed type" (no per-venue binding).
///        - otherwise   => must equal keccak256(abi.encode(venue)), binding this exact venue.
contract VenueSelector is IVenueSelector {
    function validate(address venue, VenueType vtype, ComplianceDecision calldata d) external pure returns (bool) {
        return d.allowed && (d.allowedVenueTypes & (1 << uint256(vtype))) != 0
            && (d.allowedVenuesHash == bytes32(0) || d.allowedVenuesHash == keccak256(abi.encode(venue)));
    }
}
