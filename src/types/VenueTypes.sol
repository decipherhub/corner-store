// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {VenueType} from "./ComplianceTypes.sol";

enum CustodyModel {
    NONE,
    POOL,
    ESCROW,
    OPERATOR
}

struct VenueConfig {
    VenueType venueType;
    address adapter;
    address target; // pool / market / settlement
    address operator;
    CustodyModel custody;
    bool active;
}
