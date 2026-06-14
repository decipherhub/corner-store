// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceDecision, VenueType} from "../../types/ComplianceTypes.sol";

interface IVenueSelector {
    function validate(address venue, VenueType vtype, ComplianceDecision calldata d) external view returns (bool);
}
