// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {AssuranceFixture} from "./AssuranceFixture.sol";
import {ExecutionRequest} from "../../../src/types/ExecutionTypes.sol";
import {Errors} from "../../../src/libraries/Errors.sol";

contract SettlementHandler is AssuranceFixture {
    uint256[3] public commitFailureRejections;

    constructor() {
        _deployAssurance();
    }

    function trade(uint8 kind, bool actor, bool makerIndex, bool sell, uint96 rawAmount) public {
        kind %= 3;
        uint256 amount = bound(rawAmount, 1, 100 ether);
        uint256 nonce = ++serial;
        _fill(kind, _request(kind, actor ? 1 : 0, makerIndex ? 1 : 0, sell, amount, nonce, nonce), nonce);
    }

    function rejectThenRetry(uint8 kind, bool sell, uint96 rawAmount) public {
        kind %= 3;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, bound(rawAmount, 1, 100 ether), nonce, nonce);
        req.amountOutMin += 1;
        _reject(kind, req, Errors.SlippageExceeded.selector);
        if (kind == 1) assertFalse(rfqV2.usedQuoteNonce(actors[2], nonce), "failed quote reusable");
        if (kind == 2) assertFalse(rfqV3.usedQuoteNonce(actors[2], nonce), "failed quote reusable");
        req.amountOutMin -= 1;
        _fill(kind, req, nonce);
    }

    function lateTokenFailure(uint8 rawKind, uint96 rawAmount) public {
        uint8 kind = 1 + rawKind % 2;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, false, bound(rawAmount, 1, 100 ether), nonce, nonce);
        address spender = kind == 1 ? address(rfqV2) : address(rfqV3);
        vm.prank(actors[2]);
        rwaToken.approve(spender, 0);
        // T-REX underflows its allowance after the cash leg was transferred.
        _reject(kind, req, bytes4(keccak256("Panic(uint256)")));
        assertFalse(kind == 1 ? rfqV2.usedQuoteNonce(actors[2], nonce) : rfqV3.usedQuoteNonce(actors[2], nonce));
        vm.prank(actors[2]);
        rwaToken.approve(spender, type(uint256).max);
        _fill(kind, req, nonce);
    }

    function commitFailureThenRetry(uint8 kind, bool sell, uint96 rawAmount) public {
        kind %= 3;
        uint256 nonce = ++serial;
        ExecutionRequest memory req = _request(kind, 0, 0, sell, bound(rawAmount, 1, 100 ether), nonce, nonce);
        // Evaluation still passes; only the post-settlement onTransfer hook rejects.
        surveillance.setEngine(address(0));
        _reject(kind, req, Errors.NotAuthorized.selector);
        ++commitFailureRejections[kind];
        surveillance.setEngine(address(engine));
        _fill(kind, req, nonce);
    }

    function donate(uint8 target, uint64 rawAmount) public {
        address recipient = holders[5 + target % 5];
        uint256 amount = bound(rawAmount, 1, 1 ether);
        vm.prank(alice);
        quote.transfer(recipient, amount);
        cashModel[alice] -= amount;
        cashModel[recipient] += amount;
        donations[recipient] += amount;
        assertState();
    }

    function mintOrBurn(bool burn_, bool actor, uint64 rawAmount) public {
        address who = actors[actor ? 1 : 0];
        uint256 amount = bound(rawAmount, 1, 1 ether);
        if (burn_) {
            rwaToken.burn(who, amount);
            rwaModel[who] -= amount;
            burned += amount;
        } else {
            mint(who, amount);
            rwaModel[who] += amount;
            minted += amount;
        }
        assertState();
    }
}
