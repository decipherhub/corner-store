// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {Governed} from "../../auth/Governed.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev A-02-v1 Jurisdiction screen (mock). Reg S §902 + Reg D §230.506 —
///      the investor's jurisdiction must be in the operator-curated allowed
///      set. Production data source is an ONCHAINID claim; operator-settable
///      mappings stand in for it here. Fail-closed: an investor with no
///      jurisdiction recorded (bytes32(0)) never passes, even if bytes32(0)
///      were ever marked "allowed".
contract Jurisdiction is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "A-02-v1";

    mapping(address => bytes32) public jurisdictionOf;
    mapping(bytes32 => bool) public allowedJurisdiction;

    event JurisdictionSet(address indexed investor, bytes32 code);
    event JurisdictionAllowedSet(bytes32 indexed code, bool allowed);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-02-v1",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS
            }))
    {}

    function setJurisdiction(address investor, bytes32 code) external onlyOperator {
        jurisdictionOf[investor] = code;
        emit JurisdictionSet(investor, code);
    }

    function setJurisdictionAllowed(bytes32 code, bool allowed) external onlyOperator {
        allowedJurisdiction[code] = allowed;
        emit JurisdictionAllowedSet(code, allowed);
    }

    function check(address user, address, address, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        bytes32 code = jurisdictionOf[user];
        passed = code != bytes32(0) && allowedJurisdiction[code];
        // recipeId 0 is a placeholder; the engine re-encodes with the real recipeId.
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
