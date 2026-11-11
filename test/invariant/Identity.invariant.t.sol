// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {IdentityHandler} from "./handlers/IdentityHandler.sol";

contract IdentityInvariantTest is Test {
    IdentityHandler internal handler;

    function setUp() public {
        handler = new IdentityHandler();
        handler.settle(0, false, false, false);
        handler.binding(0, 0);
        handler.binding(0, 1);
        handler.settle(1, false, false, false);
        handler.accept(0, false, 1 days);
        handler.setTrust(0);
        handler.settle(2, true, false, false);
        handler.setTrust(2);
        handler.settle(2, true, false, false);
        for (uint8 i; i < 9; ++i) {
            handler.unauthorized(i, 0);
        }
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = handler.binding.selector;
        selectors[1] = handler.accept.selector;
        selectors[2] = handler.revoke.selector;
        selectors[3] = handler.setTrust.selector;
        selectors[4] = handler.status.selector;
        selectors[5] = handler.advance.selector;
        selectors[6] = handler.unauthorized.selector;
        selectors[7] = handler.settle.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariant_identityEvidenceLifecycle() public view {
        handler.assertLifecycle();
        assertGt(handler.acceptances(), 0);
        assertGt(handler.rebindings(), 0);
        assertGe(handler.unauthorizedChecks(), 9);
        assertGt(handler.successes(), 0);
        assertGt(handler.rejections(), 0);
    }

    function testFuzz_evidenceExpiry(uint32 rawTtl) public {
        uint32 ttl = uint32(bound(rawTtl, 1, 2 days));
        handler.accept(0, false, ttl);
        handler.advance(ttl - 1);
        handler.settle(1, false, false, false);
        handler.advance(1);
        handler.settle(1, false, false, false);
        handler.assertLifecycle();
    }
}
