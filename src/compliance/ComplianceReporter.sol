// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {ComplianceEngine} from "./ComplianceEngine.sol";
import {IComplianceReporter} from "../interfaces/compliance/IComplianceReporter.sol";
import {ITokenPolicyRegistry} from "../interfaces/compliance/ITokenPolicyRegistry.sol";
import {IElementRegistry} from "../interfaces/compliance/IElementRegistry.sol";
import {IRecipeRegistry} from "../interfaces/compliance/IRecipeRegistry.sol";
import {IRecipe} from "../interfaces/compliance/IRecipe.sol";
import {IComplianceElement} from "../interfaces/compliance/IComplianceElement.sol";
import {
    ComplianceContext,
    ComplianceDecision,
    PolicyStatus,
    RecipeBinding,
    CompiledElementRule
} from "../types/ComplianceTypes.sol";
import {ComplianceReport, RequirementResult, RequirementStatus} from "../types/ComplianceReportTypes.sol";
import {ReasonCodes} from "../libraries/ReasonCodes.sol";

/// @notice Opt-in public diagnostics over the Engine's active compiled policy.
/// @dev No commit, authorization or persisted verdict. Restricted checks share one opaque outcome.
contract ComplianceReporter is IComplianceReporter {
    ComplianceEngine public immutable engine;
    ITokenPolicyRegistry public immutable policyReg;
    IElementRegistry public immutable elementReg;
    IRecipeRegistry public immutable recipeReg;

    struct Results {
        RequirementResult[] rows;
        uint256 count;
        bool complete;
        bool restricted;
        RequirementStatus restrictedStatus;
    }

    constructor(ComplianceEngine engine_) {
        engine = engine_;
        policyReg = engine_.policyReg();
        elementReg = engine_.elementReg();
        recipeReg = engine_.recipeReg();
    }

    function report(ComplianceContext calldata ctx) external view override returns (ComplianceReport memory r) {
        r.version = 1;
        r.blockNumber = block.number;
        r.timestamp = block.timestamp;
        r.engineStatus = RequirementStatus.UNDETERMINED;
        Results memory results;
        results.rows = new RequirementResult[](2 * 8 * 32);
        results.complete = true;
        results.restrictedStatus = RequirementStatus.NOT_APPLICABLE;
        try engine.evaluate(ctx) returns (ComplianceDecision memory decision) {
            r.decision = decision;
            r.engineStatus = decision.allowed ? RequirementStatus.PASS : RequirementStatus.FAIL;
        } catch {
            results.complete = false;
        }

        _reportToken(ctx, ctx.tokenIn, results);
        _reportToken(ctx, ctx.tokenOut, results);
        r.complete = results.complete;
        r.restrictedStatus = results.restrictedStatus;
        r.decisionRedacted = results.restricted;
        if (results.restricted) {
            r.decision.reasonCode = bytes32(0);
            r.decision.flagsBitmap = 0;
            r.decision.reliedClaims = bytes32(0);
        }
        r.requirements = new RequirementResult[](results.count);
        r.status = _merge(r.engineStatus, results.restrictedStatus);
        for (uint256 i = 0; i < results.count; i++) {
            r.requirements[i] = results.rows[i];
            r.status = _merge(r.status, results.rows[i].status);
        }
        if (!r.complete) r.status = _merge(r.status, RequirementStatus.UNDETERMINED);
    }

    function _reportToken(ComplianceContext calldata ctx, address token, Results memory results) private view {
        if (policyReg.statusOf(token) != PolicyStatus.ACTIVE) return;
        RecipeBinding[] memory bindings = policyReg.recipeBindingsOf(token);
        if (bindings.length == 0 || bindings.length > 8) {
            results.complete = false;
            return;
        }
        bytes memory recipeContext = abi.encode(policyReg.manifestOf(token).factsPacked, ctx);
        for (uint256 i = 0; i < bindings.length; i++) {
            _reportBinding(ctx, token, bindings[i], uint8(i), recipeContext, results);
        }
    }

    function _reportBinding(
        ComplianceContext calldata ctx,
        address token,
        RecipeBinding memory binding,
        uint8 index,
        bytes memory recipeContext,
        Results memory results
    ) private view {
        CompiledElementRule[] memory rules = policyReg.compiledRulesOf(token, index);
        bytes[] memory parameters = policyReg.compiledParametersOf(token, index);
        if (rules.length == 0 || rules.length > 32 || rules.length != parameters.length) {
            results.complete = false;
            return;
        }
        RequirementStatus applicability = _applicability(binding, recipeContext);
        if (applicability == RequirementStatus.UNDETERMINED) results.complete = false;
        for (uint256 i = 0; i < rules.length; i++) {
            RequirementStatus status = applicability;
            bytes32 reason;
            if (applicability == RequirementStatus.PASS) {
                (status, reason) = _check(ctx, token, rules[i].elementId, parameters[i]);
                if (status == RequirementStatus.UNDETERMINED) results.complete = false;
                if (status == RequirementStatus.FAIL && reason == bytes32(0)) {
                    reason = ReasonCodes.encode(binding.recipeId, rules[i].elementId, 1);
                }
            }
            if (_restricted(rules[i].elementId)) {
                results.restricted = true;
                results.restrictedStatus = _merge(results.restrictedStatus, status);
            } else {
                results.rows[results.count++] = RequirementResult({
                    token: token,
                    bindingIndex: index,
                    recipeId: binding.recipeId,
                    recipeVersion: binding.recipeVersion,
                    mode: binding.mode,
                    pathGroupId: binding.pathGroupId,
                    elementId: rules[i].elementId,
                    action: rules[i].action,
                    status: status,
                    reasonCode: reason
                });
            }
        }
    }

    function _applicability(RecipeBinding memory binding, bytes memory context)
        private
        view
        returns (RequirementStatus)
    {
        bytes32 key = recipeReg.recipeKeyOf(binding.recipeId);
        address recipe = recipeReg.recipeOf(key, binding.recipeVersion);
        if (recipe == address(0) || recipe.codehash != recipeReg.runtimeCodeHashOf(key, binding.recipeVersion)) {
            return RequirementStatus.UNDETERMINED;
        }
        try IRecipe(recipe).version() returns (uint16 version) {
            if (version != binding.recipeVersion) return RequirementStatus.UNDETERMINED;
        } catch {
            return RequirementStatus.UNDETERMINED;
        }
        try IRecipe(recipe).isApplicable(context) returns (bool applicable) {
            return applicable ? RequirementStatus.PASS : RequirementStatus.NOT_APPLICABLE;
        } catch {
            return RequirementStatus.UNDETERMINED;
        }
    }

    function _check(ComplianceContext calldata ctx, address token, bytes32 id, bytes memory parameters)
        private
        view
        returns (RequirementStatus, bytes32)
    {
        address element = elementReg.elementOf(id);
        if (element == address(0) || element.codehash != elementReg.runtimeCodeHashOf(id)) {
            return (RequirementStatus.UNDETERMINED, bytes32(0));
        }
        uint256 amount = token == ctx.tokenOut ? ctx.amountOut : ctx.amountIn;
        try IComplianceElement(element)
            .check(ctx.buyer, ctx.seller, token, amount, abi.encode(ctx), parameters) returns (
            bool passed, bytes32 reason
        ) {
            return (passed ? RequirementStatus.PASS : RequirementStatus.FAIL, passed ? bytes32(0) : reason);
        } catch {
            return (RequirementStatus.UNDETERMINED, bytes32(0));
        }
    }

    function _restricted(bytes32 id) private pure returns (bool) {
        return bytes5(id) == bytes5("A-01-") || bytes5(id) == bytes5("A-12-") || bytes2(id) == bytes2("F-");
    }

    function _merge(RequirementStatus a, RequirementStatus b) private pure returns (RequirementStatus) {
        if (a == RequirementStatus.FAIL || b == RequirementStatus.FAIL) return RequirementStatus.FAIL;
        if (a == RequirementStatus.UNDETERMINED || b == RequirementStatus.UNDETERMINED) {
            return RequirementStatus.UNDETERMINED;
        }
        if (a == RequirementStatus.PASS || b == RequirementStatus.PASS) return RequirementStatus.PASS;
        return RequirementStatus.NOT_APPLICABLE;
    }
}
