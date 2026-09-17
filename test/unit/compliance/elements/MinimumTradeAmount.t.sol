// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {MinimumTradeAmount} from "../../../../src/compliance/elements/MinimumTradeAmount.sol";
import {ReasonCodes} from "../../../../src/libraries/ReasonCodes.sol";

contract MinimumTradeAmountTest is Test {
    MinimumTradeAmount internal element = new MinimumTradeAmount();

    function test_threshold_isManifestOwned_andInclusive() public view {
        bytes memory parameters = abi.encode(uint256(5_000_000 ether));
        (bool below,) = element.check(address(1), address(2), address(3), 5_000_000 ether - 1, "", parameters);
        (bool exact,) = element.check(address(1), address(2), address(3), 5_000_000 ether, "", parameters);
        (bool above,) = element.check(address(1), address(2), address(3), 5_000_000 ether + 1, "", parameters);
        assertFalse(below);
        assertTrue(exact);
        assertTrue(above);
    }

    function test_missing_zero_or_noncanonicalParameter_failsClosed() public view {
        (bool missing, bytes32 missingReason) = element.check(address(1), address(2), address(3), 10, "", "");
        (bool zero, bytes32 zeroReason) =
            element.check(address(1), address(2), address(3), 10, "", abi.encode(uint256(0)));
        (bool trailing, bytes32 trailingReason) =
            element.check(address(1), address(2), address(3), 10, "", bytes.concat(abi.encode(uint256(1)), hex"00"));
        bytes32 expected = ReasonCodes.invalidElementParameters(element.ELEMENT_ID());
        assertFalse(missing);
        assertFalse(zero);
        assertFalse(trailing);
        assertEq(missingReason, expected);
        assertEq(zeroReason, expected);
        assertEq(trailingReason, expected);
    }
}
