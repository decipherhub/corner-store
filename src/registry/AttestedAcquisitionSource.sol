// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Governed} from "../auth/Governed.sol";
import {IAcquisitionSource} from "../interfaces/compliance/IAcquisitionSource.sol";
import {Errors} from "../libraries/Errors.sol";

/// @notice On-chain cache for provider/TA-compiled acquisition snapshots.
/// @dev It does not fetch or verify a specific provider API. Governance chooses
///      operators; those operators attest a PII-free source reference and expiry.
contract AttestedAcquisitionSource is IAcquisitionSource, Governed {
    mapping(bytes32 => AcquisitionSnapshot) internal _snapshots;

    event AcquisitionSnapshotSet(
        address indexed holder,
        address indexed asset,
        uint64 clockStart,
        uint64 observedAt,
        uint64 expiresAt,
        bytes32 sourceRef,
        AcquisitionStatus status
    );
    event AcquisitionSnapshotCleared(address indexed holder, address indexed asset);

    function setSnapshot(
        address holder,
        address asset,
        uint64 clockStart,
        uint64 expiresAt,
        bytes32 sourceRef,
        AcquisitionStatus status
    ) external onlyOperator {
        if (holder == address(0) || asset == address(0)) revert Errors.ZeroAddress();
        if (status == AcquisitionStatus.MISSING) revert Errors.InvalidAcquisitionSnapshot();
        if (expiresAt <= block.timestamp || sourceRef == bytes32(0)) revert Errors.InvalidAcquisitionSnapshot();
        if (status == AcquisitionStatus.VALID && (clockStart == 0 || clockStart > block.timestamp)) {
            revert Errors.InvalidAcquisitionSnapshot();
        }
        if (status == AcquisitionStatus.LINEAGE_BROKEN && clockStart != 0) {
            revert Errors.InvalidAcquisitionSnapshot();
        }

        uint64 observedAt = uint64(block.timestamp);
        _snapshots[_key(holder, asset)] = AcquisitionSnapshot(clockStart, observedAt, expiresAt, sourceRef, status);
        emit AcquisitionSnapshotSet(holder, asset, clockStart, observedAt, expiresAt, sourceRef, status);
    }

    function clearSnapshot(address holder, address asset) external onlyOperator {
        delete _snapshots[_key(holder, asset)];
        emit AcquisitionSnapshotCleared(holder, asset);
    }

    function acquisitionOf(address holder, address asset) external view returns (AcquisitionSnapshot memory) {
        return _snapshots[_key(holder, asset)];
    }

    function _key(address holder, address asset) internal pure returns (bytes32) {
        return keccak256(abi.encode(holder, asset));
    }
}
