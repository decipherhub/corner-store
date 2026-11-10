// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ContextEvidence} from "../../../src/execution/ContextEvidence.sol";
import {Affiliate} from "../../../src/compliance/elements/Affiliate.sol";
import {ITokenPolicyRegistry} from "../../../src/interfaces/compliance/ITokenPolicyRegistry.sol";
import {ComplianceContext, PolicyStatus} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract ContextPolicyRegistry {
    mapping(address => PolicyStatus) public statusOf;

    function setStatus(address asset, PolicyStatus status) external {
        statusOf[asset] = status;
    }
}

contract ContextEvidenceHarness {
    function affiliateHash(ComplianceContext calldata ctx, address registry, address source)
        external
        view
        returns (bytes32)
    {
        return ContextEvidence.affiliateEvidenceHash(ctx, ITokenPolicyRegistry(registry), source);
    }
}

contract ContextEvidenceTest is Test {
    ContextPolicyRegistry internal policy;
    ContextEvidenceHarness internal harness;
    Affiliate internal affiliate;
    ComplianceContext internal ctx;
    address internal constant ISSUER = address(0x155);

    function setUp() public {
        vm.warp(200 days);
        policy = new ContextPolicyRegistry();
        harness = new ContextEvidenceHarness();
        affiliate = new Affiliate();
        affiliate.setTrustedClaimIssuer(ISSUER, true);
        ctx.buyer = address(0xB0B);
        ctx.seller = address(0xCAFE);
        ctx.tokenIn = address(0x111);
        ctx.tokenOut = address(0x222);
        policy.setStatus(ctx.tokenIn, PolicyStatus.UNREGULATED);
        policy.setStatus(ctx.tokenOut, PolicyStatus.ACTIVE);
        _claim(ctx.seller, ctx.tokenOut, Affiliate.AffiliateBasis.NOT_AFFILIATE);
    }

    function _claim(address sender, address asset, Affiliate.AffiliateBasis basis) internal {
        affiliate.setClaim(
            sender, asset, basis, Affiliate.DeterminationSource.ISSUER_REGISTRY, ISSUER, uint64(block.timestamp), 0
        );
    }

    function _hash() internal view returns (bytes32) {
        return harness.affiliateHash(ctx, address(policy), address(affiliate));
    }

    function _leg(address asset, address sender, Affiliate.EffectiveStatus status) internal view returns (bytes32) {
        (
            Affiliate.AffiliateBasis basis,
            Affiliate.DeterminationSource source,
            address issuer,
            uint64 verifiedAt,
            uint64 decayStartedAt
        ) = affiliate.claimOf(sender, asset);
        return keccak256(
            abi.encode(
                asset, sender, address(affiliate), basis, source, issuer, verifiedAt, decayStartedAt, uint8(status)
            )
        );
    }

    function test_buyCommitmentUsesSellerAndExactDomain() public view {
        bytes32 leg = _leg(ctx.tokenOut, ctx.seller, Affiliate.EffectiveStatus.NON_AFFILIATE);
        assertEq(_hash(), keccak256(abi.encode(keccak256("corner-store.affiliate-evidence.v1"), bytes32(0), leg)));
    }

    function test_sellCommitmentUsesBuyer() public {
        policy.setStatus(ctx.tokenIn, PolicyStatus.ACTIVE);
        policy.setStatus(ctx.tokenOut, PolicyStatus.UNREGULATED);
        _claim(ctx.buyer, ctx.tokenIn, Affiliate.AffiliateBasis.OFFICER_DIRECTOR);
        ctx.sellerIsAffiliate = true;
        bytes32 leg = _leg(ctx.tokenIn, ctx.buyer, Affiliate.EffectiveStatus.AFFILIATE);
        assertEq(_hash(), keccak256(abi.encode(keccak256("corner-store.affiliate-evidence.v1"), leg, bytes32(0))));
    }

    function test_dualRegulatedMatchingStatuses() public {
        policy.setStatus(ctx.tokenIn, PolicyStatus.ACTIVE);
        _claim(ctx.buyer, ctx.tokenIn, Affiliate.AffiliateBasis.NOT_AFFILIATE);
        assertEq(
            _hash(),
            keccak256(
                abi.encode(
                    keccak256("corner-store.affiliate-evidence.v1"),
                    _leg(ctx.tokenIn, ctx.buyer, Affiliate.EffectiveStatus.NON_AFFILIATE),
                    _leg(ctx.tokenOut, ctx.seller, Affiliate.EffectiveStatus.NON_AFFILIATE)
                )
            )
        );
    }

    function test_conflictingStatusesReject() public {
        policy.setStatus(ctx.tokenIn, PolicyStatus.ACTIVE);
        _claim(ctx.buyer, ctx.tokenIn, Affiliate.AffiliateBasis.OFFICER_DIRECTOR);
        vm.expectRevert(Errors.ConflictingAffiliateStatus.selector);
        _hash();
    }

    function test_forgedBooleanRejects() public {
        ctx.sellerIsAffiliate = true;
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _hash();
    }

    function test_unregulatedLegsUseZeroAndRequireFalseBoolean() public {
        policy.setStatus(ctx.tokenOut, PolicyStatus.UNREGULATED);
        assertEq(
            _hash(), keccak256(abi.encode(keccak256("corner-store.affiliate-evidence.v1"), bytes32(0), bytes32(0)))
        );
        ctx.sellerIsAffiliate = true;
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _hash();
    }

    function test_missingEvidenceRejectsEvenIfOtherActorHasClaim() public {
        ctx.seller = address(0xBAD);
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_uncertainEvidenceRejects() public {
        _claim(ctx.seller, ctx.tokenOut, Affiliate.AffiliateBasis.UNCERTAIN_AFFILIATE);
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_revokedIssuerRejectsImmediately() public {
        affiliate.setTrustedClaimIssuer(ISSUER, false);
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_expiredEvidenceRejects() public {
        vm.warp(block.timestamp + 90 days + 1);
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_freshnessBoundaryInclusive() public {
        bytes32 beforeHash = _hash();
        vm.warp(block.timestamp + 90 days);
        assertEq(_hash(), beforeHash);
    }

    function test_evidenceChangeInvalidatesCommitmentWithoutStatusChange() public {
        bytes32 previous = _hash();
        vm.warp(block.timestamp + 1);
        _claim(ctx.seller, ctx.tokenOut, Affiliate.AffiliateBasis.NOT_AFFILIATE);
        assertNotEq(_hash(), previous);
    }

    function test_decayChangesStatusAndCommitment() public {
        affiliate.setClaim(
            ctx.seller,
            ctx.tokenOut,
            Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            uint64(block.timestamp - 91 days)
        );
        ctx.sellerIsAffiliate = true;
        bytes32 previous = _hash();
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _hash();
        ctx.sellerIsAffiliate = false;
        assertNotEq(_hash(), previous);
    }

    function test_futureClaimRejects() public {
        affiliate.setClaim(
            ctx.seller,
            ctx.tokenOut,
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp + 1),
            0
        );
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_malformedDecayClaimRejects() public {
        affiliate.setClaim(
            ctx.seller,
            ctx.tokenOut,
            Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            0
        );
        ctx.sellerIsAffiliate = true;
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_futureDecayStartRejects() public {
        affiliate.setClaim(
            ctx.seller,
            ctx.tokenOut,
            Affiliate.AffiliateBasis.FORMER_AFFILIATE_DECAY,
            Affiliate.DeterminationSource.ISSUER_REGISTRY,
            ISSUER,
            uint64(block.timestamp),
            uint64(block.timestamp + 1)
        );
        ctx.sellerIsAffiliate = true;
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_unspecifiedClaimSourceRejects() public {
        affiliate.setClaim(
            ctx.seller,
            ctx.tokenOut,
            Affiliate.AffiliateBasis.NOT_AFFILIATE,
            Affiliate.DeterminationSource.UNSPECIFIED,
            ISSUER,
            uint64(block.timestamp),
            0
        );
        vm.expectRevert(Errors.InvalidAffiliateEvidence.selector);
        _hash();
    }

    function test_unavailableSourceRejects() public {
        vm.mockCallRevert(
            address(affiliate),
            abi.encodeWithSelector(Affiliate.effectiveStatus.selector, ctx.seller, ctx.tokenOut),
            "offline"
        );
        vm.expectRevert();
        _hash();
    }

    function test_malformedStatusRejects() public {
        vm.mockCall(
            address(affiliate),
            abi.encodeWithSelector(Affiliate.effectiveStatus.selector, ctx.seller, ctx.tokenOut),
            abi.encode(uint256(99))
        );
        vm.expectRevert();
        _hash();
    }

    function test_malformedClaimRejects() public {
        vm.mockCall(
            address(affiliate),
            abi.encodeWithSelector(bytes4(keccak256("claimOf(address,address)")), ctx.seller, ctx.tokenOut),
            hex"01"
        );
        vm.expectRevert();
        _hash();
    }

    function test_inactiveClassificationsReject() public {
        PolicyStatus[4] memory statuses =
            [PolicyStatus.UNKNOWN, PolicyStatus.PROPOSED, PolicyStatus.SUSPENDED, PolicyStatus.RETIRED];
        for (uint256 i; i < statuses.length; i++) {
            policy.setStatus(ctx.tokenOut, statuses[i]);
            vm.expectRevert(Errors.PolicyNotActive.selector);
            _hash();
        }
    }

    function test_identicalTokensReject() public {
        ctx.tokenIn = ctx.tokenOut;
        vm.expectRevert(Errors.InvalidExecutionContext.selector);
        _hash();
    }
}
