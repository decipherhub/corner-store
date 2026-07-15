// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

// Off-chain recursive equity-owner look-through outcome (doc ELE.A-09 §5),
// consumed on-chain as a settled status. NONE = no look-through recorded for
// the subject — the consumer decides whether that is dormant (A-09 standalone)
// or a missing prerequisite (A-08 when a look-through-typed category is claimed).
enum LookThroughStatus {
    NONE,
    PENDING,
    COMPLETED,
    FAILED
}

/// @dev Minimal read surface the entity-eligibility element (A-08) consumes
///      from the equity-owner look-through element (A-09).
interface ILookThroughSource {
    function statusOf(address subject) external view returns (LookThroughStatus);
}
