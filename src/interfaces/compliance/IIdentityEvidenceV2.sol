// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface IIdentityEvidenceV2 {
    struct Evidence {
        bytes32 identityId;
        bytes32 issuerId;
        bytes32 trustBasisHash;
        bytes32 evidenceHash;
        uint64 issuedAt;
        uint64 expiresAt;
        uint8 attestationType;
    }

    event TrustedIssuerSet(bytes32 indexed issuerId, bytes32 trustBasisHash);
    event EvidenceAccepted(
        address indexed wallet, address indexed asset, bytes32 indexed identityId, bytes32 evidenceHash
    );
    event EvidenceRevoked(address indexed wallet, address indexed asset);

    function acceptEvidence(address wallet, address asset, Evidence calldata evidence) external;
    function revokeEvidence(address wallet, address asset) external;
    function evidenceOf(address wallet, address asset) external view returns (Evidence memory);
}
