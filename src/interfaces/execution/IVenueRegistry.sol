// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {VenueConfig} from "../../types/VenueTypes.sol";

interface IVenueRegistry {
    function registerVenue(address venue, VenueConfig calldata cfg) external;

    function venueOf(address venue) external view returns (VenueConfig memory);
}
