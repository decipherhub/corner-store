// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {ContextHandler} from "./handlers/ContextHandler.sol";

contract ContextInvariantTest is Test {
    ContextHandler internal handler;

    function setUp() public {
        handler = new ContextHandler();
        for (uint8 kind; kind < 2; ++kind) {
            for (uint8 field; field < 13; ++field) {
                handler.mutate(kind, field, field % 2 == 0, 1 ether);
            }
            handler.foreignVerifier(kind, false);
            handler.save(kind, false, false, false, 1 ether);
            handler.fillSaved(kind);
            handler.fillSaved(kind);
        }
        handler.save(1, false, false, false, 1 ether);
        handler.refresh(2);
        handler.fillSaved(1);
        handler.save(1, true, true, true, 1 ether);
        handler.fillSaved(1);
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = handler.save.selector;
        selectors[1] = handler.fillSaved.selector;
        selectors[2] = handler.refresh.selector;
        selectors[3] = handler.venueEvidence.selector;
        selectors[4] = handler.policyUpdate.selector;
        selectors[5] = handler.advance.selector;
        selectors[6] = handler.mutate.selector;
        selectors[7] = handler.foreignVerifier.selector;
        selectors[8] = handler.malformed.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_rfqDomainAndContext() public view {
        handler.assertState();
        assertGe(handler.bindingChecks(), 26);
        assertGe(handler.staleChecks(), 3);
        assertGt(handler.orderingChecks(), 0);
        assertGe(handler.successes(), 3);
    }

    function testFuzz_malformedFormat(uint8 kind, uint8 length) public {
        handler.malformed(kind, length);
    }

    function testFuzz_signedContextMutation(uint8 kind, uint8 field, bool sell, uint96 amount) public {
        handler.mutate(kind, field, sell, amount);
    }
}
