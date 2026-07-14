// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @title MockSecuritizeTA
/// @notice Test-only transfer-agent style source of investor eligibility facts.
///
/// The real Securitize/BUIDL integration is intentionally out of scope for the
/// demo. This fixture models the boundary we need for product testing: an
/// external TA-like system decides whether an investor is KYC verified,
/// accredited, QP, sanctioned, and current; the integration harness then syncs
/// those facts into the local ERC-3643/T-REX + Corner Store test stack.
contract MockSecuritizeTA {
    struct InvestorProfile {
        bool kycVerified;
        bool accreditedInvestor;
        bool qualifiedPurchaser;
        bool sanctioned;
        uint16 country;
        uint64 expiresAt;
        bytes32 sourceRef;
    }

    mapping(address => InvestorProfile) public profileOf;

    event InvestorProfileSet(
        address indexed investor,
        bool kycVerified,
        bool accreditedInvestor,
        bool qualifiedPurchaser,
        bool sanctioned,
        uint16 country,
        uint64 expiresAt,
        bytes32 sourceRef
    );

    function setInvestorProfile(address investor, InvestorProfile calldata profile) external {
        profileOf[investor] = profile;
        emit InvestorProfileSet(
            investor,
            profile.kycVerified,
            profile.accreditedInvestor,
            profile.qualifiedPurchaser,
            profile.sanctioned,
            profile.country,
            profile.expiresAt,
            profile.sourceRef
        );
    }

    function isCurrent(address investor) external view returns (bool) {
        InvestorProfile memory profile = profileOf[investor];
        return profile.expiresAt == 0 || profile.expiresAt >= block.timestamp;
    }
}
