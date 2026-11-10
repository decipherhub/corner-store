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

// Separate evidence preserves the existing VenueConfig ABI and legacy registration.
struct VenueContextEvidence {
    uint16 adapterVersion;
    uint16 contextVersion;
    bytes32 adapterCodeHash;
    address affiliateSource;
    bytes32 affiliateSourceCodeHash;
    address policyRegistry;
    bytes32 policyRegistryCodeHash;
    bytes32 configurationHash;
}
