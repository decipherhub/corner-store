// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IVenueRegistry} from "../interfaces/execution/IVenueRegistry.sol";
import {VenueConfig, VenueContextEvidence} from "../types/VenueTypes.sol";
import {ContextEvidence} from "./ContextEvidence.sol";
import {Errors} from "../libraries/Errors.sol";
import {Events} from "../libraries/Events.sol";

/// @title VenueRegistry
/// @notice owner-curated registry of execution venues (pool/market/settlement targets).
/// Unregistered venues read back as a zero-config (active == false), which the router
/// treats as AdapterNotRegistered.
contract VenueRegistry is IVenueRegistry, Governed {
    mapping(address => VenueConfig) internal _venues;

    mapping(address => VenueContextEvidence) internal _contextEvidence;
    mapping(bytes32 => bool) internal _contextImplementations;

    event ContextImplementationSet(
        bytes32 indexed runtimeCodeHash, uint16 adapterVersion, uint16 contextVersion, bool approved
    );
    event VenueContextEvidenceSet(address indexed venue, bytes32 evidenceHash);

    function registerVenue(address venue, VenueConfig calldata cfg) external onlyOwner {
        _venues[venue] = cfg;
        delete _contextEvidence[venue];
        emit Events.VenueRegistered(venue, cfg.venueType, cfg.adapter);
    }

    function venueOf(address venue) external view returns (VenueConfig memory) {
        return _venues[venue];
    }

    /// @dev Governance attests that this exact runtime/version was reviewed as an
    /// immutable implementation. A runtime hash cannot prove proxy immutability.
    function setContextImplementation(
        bytes32 runtimeCodeHash,
        uint16 adapterVersion,
        uint16 contextVersion,
        bool approved
    ) external onlyOwner {
        _contextImplementations[keccak256(abi.encode(runtimeCodeHash, adapterVersion, contextVersion))] = approved;
        emit ContextImplementationSet(runtimeCodeHash, adapterVersion, contextVersion, approved);
    }

    function isContextImplementationApproved(bytes32 runtimeCodeHash, uint16 adapterVersion, uint16 contextVersion)
        public
        view
        returns (bool)
    {
        return _contextImplementations[keccak256(abi.encode(runtimeCodeHash, adapterVersion, contextVersion))];
    }

    function setVenueContextEvidence(address venue, VenueContextEvidence calldata evidence) external onlyOwner {
        if (!isContextImplementationApproved(
                evidence.adapterCodeHash, evidence.adapterVersion, evidence.contextVersion
            )) {
            revert Errors.ContextImplementationNotApproved();
        }
        ContextEvidence.validateBinding(_venues[venue], evidence);
        _contextEvidence[venue] = evidence;
        emit VenueContextEvidenceSet(venue, keccak256(abi.encode(evidence)));
    }

    function contextEvidenceOf(address venue) external view returns (VenueContextEvidence memory) {
        return _contextEvidence[venue];
    }
}
