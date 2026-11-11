// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {SettlementHandler} from "./handlers/SettlementHandler.sol";

contract SettlementInvariantTest is Test {
    SettlementHandler internal handler;

    function setUp() public {
        handler = new SettlementHandler();
        // Deterministic witnesses keep every venue and both directions non-vacuous.
        for (uint8 kind; kind < 3; ++kind) {
            handler.trade(kind, false, false, false, 1 ether);
            handler.trade(kind, true, true, true, 1 ether);
            handler.rejectThenRetry(kind, false, 1 ether);
            // Missing witnesses fail the atomic invariant's counters, keeping mutation failures mapped to that property.
            try handler.commitFailureThenRetry(kind, false, 1 ether) {} catch {}
            try handler.commitFailureThenRetry(kind, true, 1 ether) {} catch {}
        }
        handler.lateTokenFailure(0, 1 ether);
        handler.lateTokenFailure(1, 1 ether);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.trade.selector;
        selectors[1] = handler.rejectThenRetry.selector;
        selectors[2] = handler.lateTokenFailure.selector;
        selectors[3] = handler.donate.selector;
        selectors[4] = handler.mintOrBurn.selector;
        selectors[5] = handler.commitFailureThenRetry.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_valueConserved() public view {
        handler.assertState();
    }

    function invariant_zeroCustody() public view {
        handler.assertState();
    }

    function invariant_atomicSettlementCommit() public view {
        handler.assertState();
        assertGe(handler.successes(), 17);
        assertGe(handler.rejections(), 11);
        for (uint256 i; i < 3; ++i) {
            assertGe(handler.fills(i), 5);
            assertGe(handler.commitFailureRejections(i), 2);
        }
    }

    function testFuzz_exactAmountsAndRollback(uint96 amount, uint8 kind, bool sell) public {
        handler.trade(kind, false, false, sell, amount);
        handler.rejectThenRetry(kind, sell, amount);
        handler.commitFailureThenRetry(kind, sell, amount);
        handler.assertState();
    }
}
