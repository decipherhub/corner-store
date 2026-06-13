// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

library Errors {
    error NotAuthorized();
    error PolicyNotActive(); // UNKNOWN/SUSPENDED
    error ComplianceRejected(bytes32 reasonCode);
    error VenueNotAllowed();
    error VenueSuspended();
    error AdapterNotRegistered();
    error DeadlineExpired();
    error NonceUsed();
    error DecisionExpired();
    error DecisionMismatch(); // decisionHash != recomputed
    error MaxAmountExceeded();
    error SlippageExceeded();
    error ElementNotRegistered(bytes32 elementId);
    error LooseningForbidden(); // strengthen-only override
}
