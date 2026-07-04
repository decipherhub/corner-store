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

/// @dev E-01-v1 Form D filing duty (mock). Securities Act §4(a)(2) / Reg D requires
///      the ISSUER to have filed Form D for the offering; keyed by ASSET because the
///      filing attaches to the offering, not to any individual investor. Production
///      source is an EDGAR oracle or a hash-anchored Listing Agreement attestation —
///      an operator-settable per-asset flag + reference hash stand in here.
contract FormDFiling is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "E-01-v1";

    /// @dev asset => whether Form D has been filed for the offering in that asset.
    mapping(address => bool) public formDFiled;
    /// @dev asset => filing reference hash (e.g. hash of the EDGAR accession number
    ///      or of the Listing Agreement attestation document). Cleared on revocation.
    mapping(address => bytes32) public filingRef;

    event FormDFilingSet(address indexed asset, bool filed, bytes32 ref);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.ISSUER_STATUS,
                version: "E-01-v1",
                temporal: TemporalNature.ONE_TIME,
                decidability: Decidability.ATTESTATION_BASED,
                timing: ObligationTiming.EX_ANTE_VERIFY,
                statefulness: Statefulness.STATELESS
            }))
    {}

    /// @dev Sets the filing status and reference for `asset`. Revocation is
    ///      expressed as `setFormDFiled(asset, false, bytes32(0))`.
    function setFormDFiled(address asset, bool filed, bytes32 ref) external onlyOperator {
        formDFiled[asset] = filed;
        filingRef[asset] = ref;
        emit FormDFilingSet(asset, filed, ref);
    }

    /// @dev Issuer-side obligation evaluated per asset: passes iff Form D has been
    ///      filed for the offering in `asset`. Unattested/unset fails closed.
    function check(address, address, address asset, uint256, bytes calldata)
        external
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        passed = formDFiled[asset];
        reasonCode = passed ? bytes32(0) : ReasonCodes.encode(0, ELEMENT_ID, 1);
    }
}
