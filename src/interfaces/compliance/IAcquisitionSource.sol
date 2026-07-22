// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Provider-neutral on-chain snapshot consumed by the Rule 144 Lockup.
/// @dev The Transfer Agent/provider remains off-chain. An approved adapter must
///      compile per-lot records and attest only the conservative clock snapshot.
interface IAcquisitionSource {
    enum AcquisitionStatus {
        MISSING,
        VALID,
        LINEAGE_BROKEN
    }

    struct AcquisitionSnapshot {
        uint64 clockStart;
        uint64 observedAt;
        uint64 expiresAt;
        bytes32 sourceRef;
        AcquisitionStatus status;
    }

    function acquisitionOf(address holder, address asset) external view returns (AcquisitionSnapshot memory);
}
