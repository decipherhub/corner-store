// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {AssuranceFixture} from "./AssuranceFixture.sol";
import {IdentityUniquenessV2} from "../../../src/compliance/elements/IdentityUniquenessV2.sol";
import {IIdentityEvidenceV2} from "../../../src/interfaces/compliance/IIdentityEvidenceV2.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract IdentityHandler is AssuranceFixture {
    struct Acceptance {
        bytes32 id;
        uint256 generation;
        bytes32 hash;
        uint64 issuedAt;
        uint64 expiry;
    }
    bool[5] internal boundWallet;
    bytes32[5] internal ids;
    uint256[5] internal generations;
    Acceptance[2][5] internal accepted;
    mapping(bytes32 => uint8) internal identityStates;
    mapping(bytes32 => uint8) internal dedupStates;
    bytes32 internal trust = BASIS;
    bool internal bilateral = true;
    uint256 public acceptances;
    uint256 public unauthorizedChecks;
    uint256 public rebindings;

    constructor() {
        _deployAssurance();
        for (uint256 i; i < 5; ++i) {
            boundWallet[i] = true;
            ids[i] = keccak256(abi.encode("assurance-identity", holders[i]));
            accepted[i][0] = Acceptance(
                ids[i],
                0,
                keccak256(abi.encode("accepted", holders[i], address(rwaToken), block.timestamp)),
                uint64(block.timestamp),
                1e12
            );
        }
    }

    function binding(uint8 who, uint8 operation) public {
        who %= 5;
        operation %= 3;
        address wallet = holders[who];
        if (operation != 1) {
            evidence.unbindIdentity(wallet);
            if (boundWallet[who]) ++generations[who];
            boundWallet[who] = false;
        }
        if (operation != 0) {
            if (operation == 2) ids[who] = keccak256(abi.encode("new-binding", who, generations[who]));
            evidence.bindIdentity(wallet, ids[who]);
            boundWallet[who] = true;
            ++rebindings;
        }
        assertLifecycle();
    }

    function accept(uint8 who, bool cashAsset, uint32 rawTtl) public {
        who %= 5;
        uint256 assetIndex = cashAsset ? 1 : 0;
        address asset = cashAsset ? address(quote) : address(rwaToken);
        uint64 expiry = uint64(block.timestamp + bound(rawTtl, 0, 2 days));
        if (!boundWallet[who] || trust != BASIS || expiry == block.timestamp) {
            vm.expectRevert(IdentityUniquenessV2.InvalidEvidence.selector);
            evidence.acceptEvidence(
                holders[who],
                asset,
                IIdentityEvidenceV2.Evidence(
                    ids[who], ISSUER, BASIS, keccak256("rejected"), uint64(block.timestamp), expiry, 3
                )
            );
        } else {
            _accept(holders[who], asset, expiry);
            accepted[who][assetIndex] = Acceptance(
                ids[who],
                generations[who],
                keccak256(abi.encode("accepted", holders[who], asset, block.timestamp)),
                uint64(block.timestamp),
                expiry
            );
            ++acceptances;
        }
        assertLifecycle();
    }

    function revoke(uint8 who, bool cashAsset) public {
        who %= 5;
        evidence.revokeEvidence(holders[who], cashAsset ? address(quote) : address(rwaToken));
        delete accepted[who][cashAsset ? 1 : 0];
        assertLifecycle();
    }

    function setTrust(uint8 basis) public {
        trust = basis % 3 == 0 ? bytes32(0) : basis % 3 == 1 ? keccak256("changed-basis") : BASIS;
        evidence.setTrustedIssuer(ISSUER, trust);
        assertLifecycle();
    }

    function status(uint8 who, uint8 identityState, uint8 dedupState, bool bilateral_) public {
        who %= 5;
        identityState %= 3;
        dedupState %= 3;
        identityStates[ids[who]] = identityState;
        dedupStates[ids[who]] = dedupState;
        evidence.setIdentityStatus(ids[who], IdentityUniquenessV2.IdentityStatus(identityState));
        evidence.setDedupStatus(ids[who], IdentityUniquenessV2.DedupStatus(dedupState));
        evidence.setEnforceCounterparty(bilateral_);
        bilateral = bilateral_;
        assertLifecycle();
    }

    function advance(uint32 delta) public {
        vm.warp(block.timestamp + bound(delta, 0, 2 days));
        _refreshAffiliateFixture();
        assertLifecycle();
    }

    function unauthorized(uint8 operation, uint8 who) public {
        who %= 5;
        bytes memory data;
        operation %= 9;
        if (operation == 0) data = abi.encodeCall(evidence.bindIdentity, (holders[who], ids[who]));
        if (operation == 1) data = abi.encodeCall(evidence.unbindIdentity, (holders[who]));
        if (operation == 2) data = abi.encodeCall(evidence.setTrustedIssuer, (ISSUER, BASIS));
        if (operation == 3) {
            data = abi.encodeCall(
                evidence.acceptEvidence,
                (
                    holders[who],
                    address(rwaToken),
                    IIdentityEvidenceV2.Evidence(
                        ids[who],
                        ISSUER,
                        BASIS,
                        keccak256("unauthorized"),
                        uint64(block.timestamp),
                        uint64(block.timestamp + 1 days),
                        3
                    )
                )
            );
        }
        if (operation == 4) data = abi.encodeCall(evidence.revokeEvidence, (holders[who], address(rwaToken)));
        if (operation == 5) {
            data = abi.encodeCall(evidence.setIdentityStatus, (ids[who], IdentityUniquenessV2.IdentityStatus.ACTIVE));
        }
        if (operation == 6) {
            data = abi.encodeCall(evidence.setDedupStatus, (ids[who], IdentityUniquenessV2.DedupStatus.UNIQUE));
        }
        if (operation == 7) data = abi.encodeCall(evidence.setEnforceCounterparty, (false));
        if (operation == 8) data = abi.encodeCall(evidence.setOperator, (actors[0], true));
        vm.prank(actors[0]);
        (bool ok, bytes memory reason) = address(evidence).call(data);
        assertFalse(ok);
        assertEq(
            reason,
            operation == 8
                ? abi.encodeWithSignature("Error(string)", "Ownable: caller is not the owner")
                : abi.encodeWithSelector(Errors.NotAuthorized.selector)
        );
        ++unauthorizedChecks;
        assertLifecycle();
    }

    function settle(uint8 rawKind, bool sell, bool actor, bool makerIndex) public {
        uint8 kind = rawKind % 3;
        uint8 who = actor ? 1 : 0;
        uint8 cp = kind == 0 ? 4 : makerIndex ? 3 : 2;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, who, makerIndex ? 1 : 0, sell, 1 ether, nonce, nonce);
        if (_eligible(who, 0) && (!bilateral || _eligible(cp, 0))) {
            _fill(kind, req, nonce);
        } else {
            _reject(kind, req, Errors.ComplianceRejected.selector);
            if (kind != 0) {
                assertFalse(
                    kind == 1 ? rfqV2.usedQuoteNonce(holders[cp], nonce) : rfqV3.usedQuoteNonce(holders[cp], nonce)
                );
            }
        }
        assertLifecycle();
    }

    function _eligible(uint256 who, uint256 asset) internal view returns (bool) {
        Acceptance memory a = accepted[who][asset];
        return boundWallet[who] && a.hash != bytes32(0) && a.id == ids[who] && a.generation == generations[who]
            && trust == BASIS && block.timestamp >= a.issuedAt && block.timestamp < a.expiry
            && identityStates[ids[who]] == 0 && dedupStates[ids[who]] == 0;
    }

    function assertLifecycle() public view {
        assertState();
        assertEq(evidence.trustedIssuerBasis(ISSUER), trust);
        assertEq(evidence.enforceCounterparty(), bilateral);
        for (uint256 i; i < 5; ++i) {
            assertEq(evidence.identityOf(holders[i]), boundWallet[i] ? ids[i] : bytes32(0));
            assertEq(evidence.walletOf(ids[i]), boundWallet[i] ? holders[i] : address(0));
            assertEq(uint256(evidence.identityStatusOf(ids[i])), identityStates[ids[i]]);
            assertEq(uint256(evidence.dedupStatusOf(ids[i])), dedupStates[ids[i]]);
            for (uint256 asset; asset < 2; ++asset) {
                address token = asset == 0 ? address(rwaToken) : address(quote);
                Acceptance memory a = accepted[i][asset];
                bytes32 expectedHash =
                    boundWallet[i] && a.id == ids[i] && a.generation == generations[i] ? a.hash : bytes32(0);
                assertEq(evidence.evidenceOf(holders[i], token).evidenceHash, expectedHash, "generation-bound evidence");
                uint256 cp = (i + 1) % 5;
                (bool allowed,) = evidence.check(holders[i], holders[cp], token, 1, "", abi.encode(uint8(1), uint8(1)));
                assertEq(
                    allowed,
                    _eligible(i, asset) && (!bilateral || _eligible(cp, asset)),
                    "independent bilateral eligibility"
                );
            }
        }
    }
}
