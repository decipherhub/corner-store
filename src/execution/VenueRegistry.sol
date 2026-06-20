// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {VenueConfig} from "../types/VenueTypes.sol";
import {Events} from "../libraries/Events.sol";

/// @title VenueRegistry
/// @notice owner-curated registry of execution venues (pool/market/settlement targets).
/// Unregistered venues read back as a zero-config (active == false), which the router
/// treats as AdapterNotRegistered.
contract VenueRegistry is IVenueRegistry, Governed {
    mapping(address => VenueConfig) internal _venues;

    function registerVenue(address venue, VenueConfig calldata cfg) external onlyOwner {
        _venues[venue] = cfg;
        emit Events.VenueRegistered(venue, cfg.venueType, cfg.adapter);
    }

    function venueOf(address venue) external view returns (VenueConfig memory) {
        return _venues[venue];
    }
}
