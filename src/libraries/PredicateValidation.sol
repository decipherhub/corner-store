// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/// @notice Canonical bounded decoders for repeated Element parameter shapes.
/// @dev These helpers validate exact byte shapes before reading calldata. They
///      are intentionally primitives, not a policy DSL or composition engine.
library PredicateValidation {
    function boolClaim(bytes calldata encoded) internal pure returns (bool valid, bool value) {
        if (encoded.length != 32) return (false, false);
        uint256 word;
        assembly {
            word := calldataload(encoded.offset)
        }
        if (word > 1) return (false, false);
        return (true, word == 1);
    }

    function boundedUint(bytes calldata encoded, uint256 minimum, uint256 maximum)
        internal
        pure
        returns (bool valid, uint256 value)
    {
        if (encoded.length != 32 || minimum > maximum) return (false, 0);
        assembly {
            value := calldataload(encoded.offset)
        }
        return (value >= minimum && value <= maximum, value);
    }

    function timestampWindow(bytes calldata encoded, uint64 observedAt)
        internal
        pure
        returns (bool valid, bool active, uint64 validFrom, uint64 validUntil)
    {
        if (encoded.length != 64) return (false, false, 0, 0);
        uint256 fromWord;
        uint256 untilWord;
        assembly {
            fromWord := calldataload(encoded.offset)
            untilWord := calldataload(add(encoded.offset, 32))
        }
        if (fromWord > type(uint64).max || untilWord > type(uint64).max || fromWord > untilWord) {
            return (false, false, 0, 0);
        }
        validFrom = uint64(fromWord);
        validUntil = uint64(untilWord);
        active = observedAt >= validFrom && observedAt <= validUntil;
        return (true, active, validFrom, validUntil);
    }

    /// @dev `encoded` is the canonical packed concatenation of bytes32 values.
    ///      Duplicate entries are rejected so one logical set has one encoding.
    function setMembership(bytes calldata encoded, bytes32 candidate, uint16 maximumEntries)
        internal
        pure
        returns (bool valid, bool member)
    {
        if (encoded.length == 0 || encoded.length % 32 != 0) return (false, false);
        uint256 count = encoded.length / 32;
        if (maximumEntries == 0 || count > maximumEntries) return (false, false);

        for (uint256 i; i < count; ++i) {
            bytes32 current;
            assembly {
                current := calldataload(add(encoded.offset, mul(i, 32)))
            }
            if (current == candidate) member = true;
            for (uint256 j; j < i; ++j) {
                bytes32 prior;
                assembly {
                    prior := calldataload(add(encoded.offset, mul(j, 32)))
                }
                if (prior == current) return (false, false);
            }
        }
        return (true, member);
    }
}
