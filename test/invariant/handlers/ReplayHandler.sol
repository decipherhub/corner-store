// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {SettlementHandler} from "./SettlementHandler.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract ReplayHandler is SettlementHandler {
    uint256 public cancellations;
    uint256 public replayChecks;

    function replay(uint8 rawKind, bool sell) public {
        uint8 kind = 1 + rawKind % 2;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, 1 ether, nonce, nonce);
        _fill(kind, req, nonce);
        _reject(kind, req, Errors.NonceUsed.selector);
        req.nonce = ++serial;
        _reject(kind, req, Errors.RFQQuoteUsed.selector);
        assertFalse(_router(kind).usedNonce(alice, req.nonce), "quote replay cannot consume fresh router nonce");
        // The other taker's Router slot and other maker's quote slot are independent.
        req = _request(kind, 1, 1, sell, 1 ether, nonce, nonce);
        _fill(kind, req, nonce);
        ++replayChecks;
    }

    function sharedRouters(bool sell) public {
        uint256 nonce = ++serial;
        _fill(0, _request(0, 0, 0, sell, 1 ether, nonce, nonce), nonce);
        _reject(1, _request(1, 0, 0, sell, 1 ether, nonce, nonce), Errors.NonceUsed.selector);
        assertFalse(rfqV2.usedQuoteNonce(actors[2], nonce));
        _fill(2, _request(2, 0, 0, sell, 1 ether, nonce, nonce), nonce);
        _fill(1, _request(1, 1, 0, sell, 1 ether, nonce, nonce), nonce);
        ++replayChecks;
        assertState();
    }

    function cancel(uint8 rawKind, bool makerIndex, bool sell) public {
        uint8 kind = 1 + rawKind % 2;
        uint8 maker_ = makerIndex ? 1 : 0;
        uint256 nonce = ++serial;
        address who = actors[2 + maker_];
        vm.prank(who);
        if (kind == 1) rfqV2.cancelQuoteNonce(nonce);
        else rfqV3.cancelQuoteNonce(nonce);
        quoteSlots.push(NonceSlot(kind, who, nonce, true));
        ExecutionRequest memory req = _request(kind, 0, maker_, sell, 1 ether, nonce, nonce);
        _reject(kind, req, Errors.RFQQuoteUsed.selector);
        assertFalse(_router(kind).usedNonce(alice, nonce));
        // Cancellation cannot spill into another adapter's maker namespace.
        uint8 otherKind = kind == 1 ? 2 : 1;
        _fill(otherKind, _request(otherKind, 0, maker_, sell, 1 ether, nonce, nonce), nonce);
        // Or into a different maker on the cancelled adapter.
        _fill(kind, _request(kind, 1, 1 - maker_, sell, 1 ether, nonce, nonce), nonce);
        ++cancellations;
        assertState();
    }
}
