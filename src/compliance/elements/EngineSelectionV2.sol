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
    Statefulness,
    ComplianceContext,
    VenueType,
    EvidenceType,
    EnforcementAction
} from "../../types/ComplianceTypes.sol";
import {AssetFlow} from "../libraries/AssetFlow.sol";
import {ReasonCodes} from "../../libraries/ReasonCodes.sol";

/// @dev B-04-v2 resolves the security recipient per asset before checking the MM claim.
///      Registration and Manifest binding are opt-in; v1 remains unchanged.
contract EngineSelectionV2 is BaseElement, Governed {
    bytes32 internal constant ELEMENT_ID = "B-04-v2";

    uint8 internal constant VALID_ENGINES = 0x07;

    uint8 internal constant RFQ_BIT = uint8(1) << uint8(VenueType.RFQ);

    uint256 internal constant CTX_ENCODED_LEN = 352;

    mapping(address => uint8) public supportedEnginesOf;

    mapping(address => bool) public sec4a7PathOf;

    mapping(address => bool) public isDebtSecurityOf;

    /// @notice Security recipient => operator-attested market-maker claim.
    mapping(address => bool) public mmClaimOf;

    uint8 public noGsEngineSet;

    uint8 public affiliateEngineSet;

    event SupportedEnginesSet(address indexed asset, uint8 engines);
    event Sec4a7PathSet(address indexed asset, bool active);
    event DebtSecuritySet(address indexed asset, bool isDebt);
    event MarketMakerClaimSet(address indexed recipient, bool hasClaim);
    event NoGsEngineSetUpdated(uint8 engineSet);
    event AffiliateEngineSetUpdated(uint8 engineSet);

    constructor()
        BaseElement(ElementMetadata({
                elementId: ELEMENT_ID,
                category: ElementCategory.RESALE_TRANSACTION,
                version: "B-04-v2",
                temporal: TemporalNature.REALTIME,
                decidability: Decidability.DETERMINISTIC,
                timing: ObligationTiming.AT_TRADE_GATE,
                statefulness: Statefulness.STATELESS,
                evidenceType: EvidenceType.COMPOSITE,
                defaultEnforcement: EnforcementAction.BLOCK,
                parameterSchemaId: bytes32(0),
                parameterSchemaVersion: 0,
                maxParameterBytes: 0,
                parametersRequired: false
            }))
    {
        noGsEngineSet = RFQ_BIT;
        affiliateEngineSet = RFQ_BIT;
    }

    function setSupportedEngines(address asset, uint8 engines) external onlyOperator {
        supportedEnginesOf[asset] = engines;
        emit SupportedEnginesSet(asset, engines);
    }

    function setSec4a7Path(address asset, bool active) external onlyOperator {
        sec4a7PathOf[asset] = active;
        emit Sec4a7PathSet(asset, active);
    }

    function setDebtSecurity(address asset, bool isDebt) external onlyOperator {
        isDebtSecurityOf[asset] = isDebt;
        emit DebtSecuritySet(asset, isDebt);
    }

    function setMarketMakerClaim(address recipient, bool hasClaim) external onlyOperator {
        mmClaimOf[recipient] = hasClaim;
        emit MarketMakerClaimSet(recipient, hasClaim);
    }

    function setNoGsEngineSet(uint8 engineSet) external onlyOperator {
        noGsEngineSet = engineSet;
        emit NoGsEngineSetUpdated(engineSet);
    }

    function setAffiliateEngineSet(uint8 engineSet) external onlyOperator {
        affiliateEngineSet = engineSet;
        emit AffiliateEngineSetUpdated(engineSet);
    }

    function validateEngineDeclaration(address asset) external view returns (bool ok, bytes32 reasonCode) {
        uint8 se = supportedEnginesOf[asset];
        if (se == 0) return (false, _code(1));
        if ((se & ~VALID_ENGINES) != 0) return (false, _code(2));
        return (true, bytes32(0));
    }

    function _check(address, address, address asset, uint256, bytes calldata context, bytes calldata)
        internal
        view
        override
        returns (bool passed, bytes32 reasonCode)
    {
        uint8 se = supportedEnginesOf[asset];
        if (se == 0) return (false, _code(1));
        if ((se & ~VALID_ENGINES) != 0) return (false, _code(2));

        if (context.length < CTX_ENCODED_LEN) return (false, _code(3));

        ComplianceContext memory ctx = abi.decode(context, (ComplianceContext));
        uint8 engineBit = uint8(1) << uint8(ctx.venueType);

        if ((engineBit & se) == 0) return (false, _code(4));

        if (sec4a7PathOf[asset] && (engineBit & noGsEngineSet) == 0) {
            return (false, _code(5));
        }

        (, address recipient) = AssetFlow.resolve(asset, context);
        if (ctx.sellerIsAffiliate && !isDebtSecurityOf[asset]) {
            if ((engineBit & affiliateEngineSet) == 0) {
                return (false, _code(6));
            }

            if (ctx.venueType == VenueType.RFQ && !mmClaimOf[recipient]) {
                return (false, _code(7));
            }
        }

        return (true, bytes32(0));
    }

    function _code(uint32 n) private pure returns (bytes32) {
        return ReasonCodes.encode(0, ELEMENT_ID, n);
    }
}
