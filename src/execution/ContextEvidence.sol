// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IExecutionContextVerifier} from "../interfaces/execution/IExecutionContextVerifier.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {Affiliate} from "../compliance/elements/Affiliate.sol";
import {ComplianceContext, PolicyStatus} from "../types/ComplianceTypes.sol";
import {VenueConfig, VenueContextEvidence} from "../types/VenueTypes.sol";
import {Errors} from "../libraries/Errors.sol";

library ContextEvidence {
    uint16 internal constant CONTEXT_VERSION = 1;
    bytes32 internal constant AFFILIATE_DOMAIN = keccak256("corner-store.affiliate-evidence.v1");
    bytes32 internal constant CONFIG_DOMAIN = keccak256("corner-store.venue-context-config.v1");

    function configurationHash(VenueConfig memory cfg) internal view returns (bytes32) {
        return keccak256(abi.encode(CONFIG_DOMAIN, cfg, IExecutionContextVerifier(cfg.adapter).contextConfigHash()));
    }

    function validateBinding(VenueConfig memory cfg, VenueContextEvidence memory evidence) internal view {
        if (!cfg.active || cfg.adapter == address(0)) revert Errors.AdapterNotRegistered();
        if (
            evidence.contextVersion != CONTEXT_VERSION || evidence.adapterVersion == 0
                || !_matchesCode(cfg.adapter, evidence.adapterCodeHash)
                || !_matchesCode(evidence.affiliateSource, evidence.affiliateSourceCodeHash)
                || !_matchesCode(evidence.policyRegistry, evidence.policyRegistryCodeHash)
        ) revert Errors.InvalidContextEvidence();
        IExecutionContextVerifier verifier = IExecutionContextVerifier(cfg.adapter);
        if (
            verifier.adapterVersion() != evidence.adapterVersion || verifier.contextVersion() != evidence.contextVersion
                || configurationHash(cfg) != evidence.configurationHash
        ) revert Errors.InvalidContextEvidence();
    }

    /// @dev A-06 remains an operator-attested source. The actual security sender
    /// is buyer on tokenIn and seller on tokenOut, independently of the bool's name.
    function affiliateEvidenceHash(ComplianceContext memory ctx, ITokenPolicyRegistry policyRegistry, address source)
        internal
        view
        returns (bytes32)
    {
        if (ctx.tokenIn == ctx.tokenOut || ctx.tokenIn == address(0) || ctx.tokenOut == address(0)) {
            revert Errors.InvalidExecutionContext();
        }
        (bytes32 inputLeg, Affiliate.EffectiveStatus inputStatus) =
            _affiliateLeg(ctx.tokenIn, ctx.buyer, policyRegistry, source);
        (bytes32 outputLeg, Affiliate.EffectiveStatus outputStatus) =
            _affiliateLeg(ctx.tokenOut, ctx.seller, policyRegistry, source);
        bool inputRegulated = inputLeg != bytes32(0);
        bool outputRegulated = outputLeg != bytes32(0);
        if (inputRegulated && outputRegulated && inputStatus != outputStatus) {
            revert Errors.ConflictingAffiliateStatus();
        }
        bool isAffiliate = inputRegulated
            ? inputStatus == Affiliate.EffectiveStatus.AFFILIATE
            : outputRegulated && outputStatus == Affiliate.EffectiveStatus.AFFILIATE;
        if (ctx.sellerIsAffiliate != isAffiliate) revert Errors.InvalidExecutionContext();
        return keccak256(abi.encode(AFFILIATE_DOMAIN, inputLeg, outputLeg));
    }

    function _affiliateLeg(address asset, address sender, ITokenPolicyRegistry registry, address source)
        private
        view
        returns (bytes32 leg, Affiliate.EffectiveStatus status)
    {
        PolicyStatus policyStatus = registry.statusOf(asset);
        if (policyStatus == PolicyStatus.UNREGULATED) return (bytes32(0), Affiliate.EffectiveStatus.UNKNOWN);
        if (policyStatus != PolicyStatus.ACTIVE) revert Errors.PolicyNotActive();
        if (sender == address(0) || source.code.length == 0) revert Errors.InvalidAffiliateEvidence();
        Affiliate affiliate = Affiliate(source);
        status = affiliate.effectiveStatus(sender, asset);
        if (status != Affiliate.EffectiveStatus.AFFILIATE && status != Affiliate.EffectiveStatus.NON_AFFILIATE) {
            revert Errors.InvalidAffiliateEvidence();
        }
        (
            Affiliate.AffiliateBasis basis,
            Affiliate.DeterminationSource determinationSource,
            address claimIssuer,
            uint64 verifiedAt,
            uint64 decayStartedAt
        ) = affiliate.claimOf(sender, asset);
        if (
            basis == Affiliate.AffiliateBasis.UNSET || determinationSource == Affiliate.DeterminationSource.UNSPECIFIED
                || claimIssuer == address(0) || verifiedAt == 0 || verifiedAt > block.timestamp
        ) revert Errors.InvalidAffiliateEvidence();
        if (
            basis == Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY
                && (decayStartedAt == 0 || decayStartedAt > block.timestamp)
        ) revert Errors.InvalidAffiliateEvidence();
        leg = keccak256(
            abi.encode(
                asset,
                sender,
                source,
                basis,
                determinationSource,
                claimIssuer,
                verifiedAt,
                decayStartedAt,
                uint8(status)
            )
        );
    }

    function _matchesCode(address subject, bytes32 expected) private view returns (bool) {
        return subject.code.length != 0 && expected != bytes32(0) && subject.codehash == expected;
    }
}
