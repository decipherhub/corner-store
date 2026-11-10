// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {BaseElement} from "./BaseElement.sol";
import {IdentityPolicy} from "../libraries/IdentityPolicy.sol";
import {
    ElementMetadata,
    ElementCategory,
    TemporalNature,
    Decidability,
    ObligationTiming,
    Statefulness,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev Opt-in A-04-v2 topology gate. Evidence acceptance is added in DATA-004 step 2;
///      until then valid DIRECT policies still fail with KYC_CLAIM_MISSING.
contract IdentityUniquenessV2 is BaseElement {
    bytes32 internal constant ELEMENT_ID = "A-04-v2";
    bytes32 public constant PARAMETER_SCHEMA_ID = IdentityPolicy.SCHEMA_ID;

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.INVESTOR_ATTRIBUTE,
                version: "A-04-v2",
                temporal: TemporalNature.PERIODIC,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.PROVIDER_ATTESTATION,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: PARAMETER_SCHEMA_ID,
                parameterSchemaVersion: 1,
                maxParameterBytes: 64,
                parametersRequired: true
            }))
    {}

    function _check(address, address, address, uint256, bytes calldata, bytes calldata parameters)
        internal
        pure
        override
        returns (bool passed, bytes32 reasonCode)
    {
        if (!IdentityPolicy.valid(parameters)) return (false, ReasonCodes.invalidElementParameters(ELEMENT_ID));
        return (false, ReasonCodes.encode(0, ELEMENT_ID, 2));
    }
}
