// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {AssuranceFixture} from "./AssuranceFixture.sol";
import {ExecutionRouterBase} from "../../../src/execution/ExecutionRouterBase.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {RFQAdapter} from "../../../src/execution/adapters/rfq/RFQAdapter.sol";
import {RFQAdapterV3} from "../../../src/execution/adapters/rfq/RFQAdapterV3.sol";
import {RFQQuote} from "../../../src/execution/adapters/rfq/RFQTypes.sol";
import {RFQQuoteV3} from "../../../src/execution/adapters/rfq/RFQV3Types.sol";
import {ManifestCore, FlowType, ElementEnforcementOverride} from "../../../src/types/ComplianceTypes.sol";
import {VenueConfig, CustodyModel} from "../../../src/types/VenueTypes.sol";
import {VenueType} from "../../../src/types/ComplianceTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract ContextHandler is AssuranceFixture {
    struct Saved {
        ExecutionRequest request;
        uint256 nonce;
        uint256 policyEpoch;
        uint256 senderEpoch;
        address sender;
        bool consumed;
        bool exists;
    }
    Saved[2] internal saved;
    uint256 internal policyEpoch;
    mapping(address => uint256) internal claimEpoch;
    mapping(address => uint256) internal claimTime;
    bool internal pinned = true;
    uint256 public bindingChecks;
    uint256 public staleChecks;
    uint256 public orderingChecks;

    constructor() {
        _deployAssurance();
        for (uint256 i; i < 4; ++i) {
            claimTime[actors[i]] = block.timestamp;
        }
    }

    function save(uint8 rawKind, bool sell, bool actor, bool makerIndex, uint96 amount) public {
        _refreshExpiredClaims();
        uint8 kind = 1 + rawKind % 2;
        uint256 nonce = ++serial;
        ExecutionRequest memory req =
            _request(kind, actor ? 1 : 0, makerIndex ? 1 : 0, sell, bound(amount, 1, 100 ether), nonce, nonce);
        address sender = sell ? req.context.buyer : req.context.seller;
        saved[kind - 1] = Saved(req, nonce, policyEpoch, claimEpoch[sender], sender, false, true);
    }

    function fillSaved(uint8 rawKind) public {
        uint8 kind = 1 + rawKind % 2;
        Saved storage s = saved[kind - 1];
        if (!s.exists) return;
        bytes4 expected;
        if (block.timestamp > s.request.deadline) {
            expected = Errors.DeadlineExpired.selector;
        } else if (s.consumed) {
            expected = Errors.NonceUsed.selector;
        } else if (kind == 2 && !pinned) {
            expected = Errors.InvalidContextEvidence.selector;
        } else if (kind == 2 && block.timestamp > claimTime[s.sender] + 90 days) {
            expected = Errors.InvalidAffiliateEvidence.selector;
        } else if (kind == 2 && s.senderEpoch != claimEpoch[s.sender]) {
            expected = Errors.RFQQuoteMismatch.selector;
        } else if (s.policyEpoch != policyEpoch) {
            expected = Errors.RFQQuoteMismatch.selector;
        }
        if (expected == bytes4(0)) {
            _fill(kind, s.request, s.nonce);
            s.consumed = true;
        } else {
            _reject(kind, s.request, expected);
            ++staleChecks;
        }
    }

    function refresh(uint8 who) public {
        address sender = actors[who % 4];
        vm.warp(block.timestamp + 1);
        _claim(sender);
        ++claimEpoch[sender];
        claimTime[sender] = block.timestamp;
        assertState();
    }

    function venueEvidence(bool restore) public {
        if (restore) {
            _pinV3();
        } else {
            venueReg.registerVenue(
                VENUE_V3, VenueConfig(VenueType.RFQ, address(rfqV3), address(0), address(0), CustodyModel.NONE, true)
            );
        }
        pinned = restore;
        assertState();
    }

    function policyUpdate() public {
        ManifestCore memory m = policyReg.manifestOf(address(rwaToken));
        m.fullManifestHash = keccak256(abi.encode("context-policy", ++policyEpoch));
        policyReg.scheduleManifestUpdate(
            address(rwaToken), m, _assuranceBindings(2), new ElementEnforcementOverride[](0), _config(1), "assurance"
        );
        vm.warp(block.timestamp + 1 days);
        policyReg.activateManifestUpdate(address(rwaToken));
        assertState();
    }

    function advance(uint32 delta) public {
        vm.warp(block.timestamp + bound(delta, 0, 2 days));
        assertState();
    }

    function foreignVerifier(uint8 rawKind, bool sell) public {
        _refreshExpiredClaims();
        uint8 kind = 1 + rawKind % 2;
        if (!pinned) {
            _pinV3();
            pinned = true;
        }
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, 1 ether, nonce, nonce);
        if (kind == 1) {
            RFQAdapter foreign = new RFQAdapter(rfqV2.makerAuthorizer());
            (RFQQuote memory q,) = abi.decode(req.venueData, (RFQQuote, bytes));
            (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(MAKER_KEY, foreign.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, sigS, v));
        } else {
            RFQAdapterV3 foreign = new RFQAdapterV3(rfqV3.makerAuthorizer(), venueReg, policyReg, address(affiliate));
            (RFQQuoteV3 memory q,) = abi.decode(req.venueData, (RFQQuoteV3, bytes));
            (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(MAKER_KEY, foreign.hashQuote(q));
            req.venueData = abi.encode(q, abi.encodePacked(r, sigS, v));
        }
        _reject(kind, req, Errors.RFQInvalidSignature.selector);
        ++bindingChecks;
    }

    function malformed(uint8 rawKind, uint8 rawLength) public {
        _refreshExpiredClaims();
        uint8 kind = 1 + rawKind % 2;
        if (!pinned) {
            _pinV3();
            pinned = true;
        }
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, false, 1 ether, nonce, nonce);
        req.venueData = new bytes(rawLength % 32);
        _rejectMalformed(kind, req);
    }

    function mutate(uint8 rawKind, uint8 field, bool sell, uint96 amount) public {
        _refreshExpiredClaims();
        uint8 kind = 1 + rawKind % 2;
        // Keep configuration valid to isolate the intended binding rejection.
        if (!pinned) {
            _pinV3();
            pinned = true;
        }
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, bound(amount, 1, 100 ether), nonce, nonce);
        field %= 13;
        bytes4 expected = Errors.RFQQuoteMismatch.selector;
        if (field == 0) req.context.buyer = actors[1];
        if (field == 1) req.context.seller = actors[3];
        if (field == 2) ++req.context.amountIn;
        if (field == 3) ++req.context.amountOut;
        if (field == 4) {
            address token = req.context.tokenIn;
            req.context.tokenIn = req.context.tokenOut;
            req.context.tokenOut = token;
        }
        if (field == 5) {
            req.context.venue = address(0xBAD);
            expected = Errors.AdapterNotRegistered.selector;
        }
        if (field == 6) {
            if (kind == 2) req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
            else req.context.initiator = actors[1];
        }
        if (field == 7) {
            if (kind == 2) {
                req.context.sellerIsAffiliate = true;
                expected = Errors.InvalidExecutionContext.selector;
            } else {
                req.context.seller = actors[3];
            }
        }
        if (field == 8) req.venueData = _wrongPolicy(kind, req.venueData);
        if (field == 9) {
            uint256 originalChain = block.chainid;
            vm.chainId(originalChain + 1);
            _reject(kind, req, Errors.RFQInvalidSignature.selector);
            vm.chainId(originalChain);
        } else if (field == 10) {
            // The other signed format must fail ABI decoding, never be interpreted as this version.
            req.venueData = _request(kind == 1 ? 2 : 1, 0, 0, sell, req.context.amountIn, nonce, nonce).venueData;
            _rejectMalformed(kind, req);
        } else if (field == 11) {
            req.venueData = hex"010203";
            _rejectMalformed(kind, req);
        } else if (field == 12) {
            if (kind == 2) {
                sanctions.setBlocked(alice, true);
                req.context.flowType = FlowType.PRIMARY_DISTRIBUTION;
                _reject(kind, req, Errors.RFQQuoteMismatch.selector);
                sanctions.setBlocked(alice, false);
                ++orderingChecks;
            } else {
                // A foreign verifying-contract digest must not authorize this adapter.
                (RFQQuote memory q,) = abi.decode(req.venueData, (RFQQuote, bytes));
                (uint8 v, bytes32 r, bytes32 s) =
                    vm.sign(MAKER_KEY, keccak256(abi.encode("foreign-adapter", rfqV2.hashQuote(q))));
                req.venueData = abi.encode(q, abi.encodePacked(r, s, v));
                _reject(kind, req, Errors.RFQInvalidSignature.selector);
            }
        } else {
            _reject(kind, req, expected);
        }
        assertFalse(kind == 1 ? rfqV2.usedQuoteNonce(actors[2], nonce) : rfqV3.usedQuoteNonce(actors[2], nonce));
        ++bindingChecks;
        assertState();
    }

    function _refreshExpiredClaims() internal {
        for (uint256 i; i < 4; ++i) {
            address who = actors[i];
            if (block.timestamp > claimTime[who] + 90 days) {
                _claim(who);
                claimTime[who] = block.timestamp;
                ++claimEpoch[who];
            }
        }
    }

    function _wrongPolicy(uint8 kind, bytes memory data) internal view returns (bytes memory) {
        if (kind == 1) {
            (RFQQuote memory q,) = abi.decode(data, (RFQQuote, bytes));
            q.policyId = keccak256("wrong-policy");
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(MAKER_KEY, rfqV2.hashQuote(q));
            return abi.encode(q, abi.encodePacked(r, s, v));
        }
        (RFQQuoteV3 memory q3,) = abi.decode(data, (RFQQuoteV3, bytes));
        q3.policyId = keccak256("wrong-policy");
        (uint8 v3, bytes32 r3, bytes32 s3) = vm.sign(MAKER_KEY, rfqV3.hashQuote(q3));
        return abi.encode(q3, abi.encodePacked(r3, s3, v3));
    }

    function _rejectMalformed(uint8 kind, ExecutionRequest memory req) internal {
        engine.setRouter(address(_router(kind)));
        bytes32 beforeState = _stateDigest();
        vm.prank(alice);
        (bool ok, bytes memory reason) = address(_router(kind)).call(abi.encodeCall(ExecutionRouterBase.execute, (req)));
        assertFalse(ok, "malformed format accepted");
        assertEq(reason.length, 0, "expected ABI decoder rejection");
        assertEq(_stateDigest(), beforeState);
        assertFalse(_router(kind).usedNonce(alice, req.nonce));
        ++rejections;
        assertState();
    }
}
