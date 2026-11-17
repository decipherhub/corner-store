// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {VenueConfig, VenueContextEvidence} from "../../types/VenueTypes.sol";

interface IVenueRegistry {
    function registerVenue(address venue, VenueConfig calldata cfg) external;

    function venueOf(address venue) external view returns (VenueConfig memory);

    function setContextImplementation(
        bytes32 runtimeCodeHash,
        uint16 adapterVersion,
        uint16 contextVersion,
        bool approved
    ) external;

    function isContextImplementationApproved(bytes32 runtimeCodeHash, uint16 adapterVersion, uint16 contextVersion)
        external
        view
        returns (bool);

    function setVenueContextEvidence(address venue, VenueContextEvidence calldata evidence) external;

    function contextEvidenceOf(address venue) external view returns (VenueContextEvidence memory);
}
