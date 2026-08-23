// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ElementRegistry} from "../src/registry/ElementRegistry.sol";
import {RecipeRegistry} from "../src/registry/RecipeRegistry.sol";
import {TokenPolicyRegistry} from "../src/registry/TokenPolicyRegistry.sol";
import {OperatorRegistry} from "../src/registry/OperatorRegistry.sol";
import {MakerAuthorizer} from "../src/registry/MakerAuthorizer.sol";
import {ComplianceEngine} from "../src/compliance/ComplianceEngine.sol";
import {ExecutionRouter} from "../src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "../src/execution/VenueRegistry.sol";
import {VenueSelector} from "../src/execution/VenueSelector.sol";
import {UniswapV3Adapter} from "../src/execution/adapters/amm/UniswapV3Adapter.sol";
import {RFQAdapter} from "../src/execution/adapters/rfq/RFQAdapter.sol";

/// @notice Shared production-core deployment implementation used by the
///         production script, tests and local showcase script.
/// @dev This contract is inherited by Foundry scripts. It must not be deployed
///      as an on-chain helper.
abstract contract ProductionCoreDeployer {
    error InvalidGovernance();
    error InvalidOperator();
    error NoVenueEnabled();

    struct Deployment {
        address elementReg;
        address recipeReg;
        address policyReg;
        address operatorReg;
        address engine;
        address venueReg;
        address selector;
        address router;
        address ammAdapter;
        address makerAuthorizer;
        address rfqAdapter;
    }

    /// @notice Public deployment seam used by Foundry tests and orchestration.
    ///         It performs the same ownership handoff as the production script.
    function deployCore(address governance, address operator, bool enableAmm, bool enableRfq)
        public
        returns (Deployment memory deployed)
    {
        if (governance == address(0)) revert InvalidGovernance();
        if (operator == address(0)) revert InvalidOperator();
        if (!enableAmm && !enableRfq) revert NoVenueEnabled();

        deployed.elementReg = address(new ElementRegistry());
        deployed.recipeReg = address(new RecipeRegistry());
        deployed.policyReg =
            address(new TokenPolicyRegistry(RecipeRegistry(deployed.recipeReg), ElementRegistry(deployed.elementReg)));
        deployed.operatorReg = address(new OperatorRegistry());
        deployed.engine = address(
            new ComplianceEngine(
                TokenPolicyRegistry(deployed.policyReg),
                ElementRegistry(deployed.elementReg),
                RecipeRegistry(deployed.recipeReg)
            )
        );
        deployed.venueReg = address(new VenueRegistry());
        deployed.selector = address(new VenueSelector());

        if (enableAmm) deployed.ammAdapter = address(new UniswapV3Adapter());
        if (enableRfq) {
            deployed.makerAuthorizer = address(new MakerAuthorizer());
            deployed.rfqAdapter = address(new RFQAdapter(MakerAuthorizer(deployed.makerAuthorizer)));
        }

        deployed.router = address(
            new ExecutionRouter(
                ComplianceEngine(deployed.engine),
                VenueRegistry(deployed.venueReg),
                VenueSelector(deployed.selector),
                OperatorRegistry(deployed.operatorReg)
            )
        );
        _wireRouter(deployed, enableAmm, enableRfq);
        _configureOperators(deployed, operator, enableRfq);
        _handoffOwnership(deployed, governance, enableAmm, enableRfq);
    }

    function _configureOperators(Deployment memory deployed, address operator, bool enableRfq) private {
        TokenPolicyRegistry(deployed.policyReg).setOperator(operator, true);
        OperatorRegistry(deployed.operatorReg).setOperator(operator, true);
        if (enableRfq) {
            MakerAuthorizer(deployed.makerAuthorizer).setOperator(operator, true);
            RFQAdapter(deployed.rfqAdapter).setOperator(operator, true);
        }
    }

    function _wireRouter(Deployment memory deployed, bool enableAmm, bool enableRfq) private {
        ComplianceEngine(deployed.engine).setRouter(deployed.router);
        if (enableAmm) UniswapV3Adapter(deployed.ammAdapter).setRouter(deployed.router);
        if (enableRfq) RFQAdapter(deployed.rfqAdapter).setRouter(deployed.router);
    }

    function _handoffOwnership(Deployment memory deployed, address governance, bool enableAmm, bool enableRfq) private {
        ElementRegistry(deployed.elementReg).transferOwnership(governance);
        RecipeRegistry(deployed.recipeReg).transferOwnership(governance);
        TokenPolicyRegistry(deployed.policyReg).transferOwnership(governance);
        OperatorRegistry(deployed.operatorReg).transferOwnership(governance);
        ComplianceEngine(deployed.engine).transferOwnership(governance);
        VenueRegistry(deployed.venueReg).transferOwnership(governance);
        ExecutionRouter(deployed.router).transferOwnership(governance);
        if (enableAmm) UniswapV3Adapter(deployed.ammAdapter).transferOwnership(governance);
        if (enableRfq) {
            MakerAuthorizer(deployed.makerAuthorizer).transferOwnership(governance);
            RFQAdapter(deployed.rfqAdapter).transferOwnership(governance);
        }
    }
}
