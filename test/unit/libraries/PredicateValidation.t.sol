// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {PredicateValidation} from "../../../src/libraries/PredicateValidation.sol";

contract PredicateValidationHarness {
    function boolClaim(bytes calldata encoded) external pure returns (bool, bool) {
        return PredicateValidation.boolClaim(encoded);
    }

    function boundedUint(bytes calldata encoded, uint256 minimum, uint256 maximum)
        external
        pure
        returns (bool, uint256)
    {
        return PredicateValidation.boundedUint(encoded, minimum, maximum);
    }

    function timestampWindow(bytes calldata encoded, uint64 observedAt)
        external
        pure
        returns (bool, bool, uint64, uint64)
    {
        return PredicateValidation.timestampWindow(encoded, observedAt);
    }

    function setMembership(bytes calldata encoded, bytes32 candidate, uint16 maximumEntries)
        external
        pure
        returns (bool, bool)
    {
        return PredicateValidation.setMembership(encoded, candidate, maximumEntries);
    }
}

contract PredicateValidationTest is Test {
    PredicateValidationHarness internal harness = new PredicateValidationHarness();

    function test_boolClaim_acceptsOnlyCanonicalAbiWords() public view {
        (bool validFalse, bool falseValue) = harness.boolClaim(abi.encode(false));
        (bool validTrue, bool trueValue) = harness.boolClaim(abi.encode(true));
        (bool invalidWord,) = harness.boolClaim(abi.encode(uint256(2)));
        (bool invalidLength,) = harness.boolClaim(hex"01");
        assertTrue(validFalse && !falseValue);
        assertTrue(validTrue && trueValue);
        assertFalse(invalidWord);
        assertFalse(invalidLength);
    }

    function test_boundedUint_enforcesExactLengthAndInclusiveRange() public view {
        (bool atMin, uint256 minValue) = harness.boundedUint(abi.encode(uint256(10)), 10, 20);
        (bool atMax, uint256 maxValue) = harness.boundedUint(abi.encode(uint256(20)), 10, 20);
        (bool below,) = harness.boundedUint(abi.encode(uint256(9)), 10, 20);
        (bool reversed,) = harness.boundedUint(abi.encode(uint256(15)), 20, 10);
        (bool trailing,) = harness.boundedUint(bytes.concat(abi.encode(uint256(15)), hex"00"), 10, 20);
        assertTrue(atMin && minValue == 10);
        assertTrue(atMax && maxValue == 20);
        assertFalse(below);
        assertFalse(reversed);
        assertFalse(trailing);
    }

    function test_timestampWindow_isInclusiveAndRejectsMalformedBounds() public view {
        (bool valid, bool active, uint64 from, uint64 until) =
            harness.timestampWindow(abi.encode(uint64(10), uint64(20)), 20);
        (bool outside, bool outsideActive,,) = harness.timestampWindow(abi.encode(uint64(10), uint64(20)), 21);
        (bool reversed,,,) = harness.timestampWindow(abi.encode(uint64(20), uint64(10)), 15);
        (bool oversized,,,) = harness.timestampWindow(abi.encode(uint256(type(uint64).max) + 1, uint256(30)), 15);
        assertTrue(valid && active && from == 10 && until == 20);
        assertTrue(outside && !outsideActive);
        assertFalse(reversed);
        assertFalse(oversized);
    }

    function test_setMembership_isBoundedCanonicalAndDuplicateFree() public view {
        bytes32 a = keccak256("a");
        bytes32 b = keccak256("b");
        bytes memory set = bytes.concat(a, b);
        (bool valid, bool member) = harness.setMembership(set, b, 2);
        (bool absentValid, bool absent) = harness.setMembership(set, keccak256("c"), 2);
        (bool tooMany,) = harness.setMembership(set, b, 1);
        (bool duplicate,) = harness.setMembership(bytes.concat(a, a), a, 2);
        (bool malformed,) = harness.setMembership(hex"01", a, 2);
        assertTrue(valid && member);
        assertTrue(absentValid && !absent);
        assertFalse(tooMany);
        assertFalse(duplicate);
        assertFalse(malformed);
    }
}
