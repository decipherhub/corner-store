import {Interface, getAddress} from "ethers";

export type RequirementStatus = "PASS" | "FAIL" | "UNDETERMINED" | "NOT_APPLICABLE";
export type ReportBindingMode = "REQUIRED_BLOCKING" | "PATH_OPTION" | "FLAG_ONLY";
export type ReportEnforcementAction = "FLAG_ONLY" | "OPERATOR_REVIEW" | "BLOCK";

export interface ComplianceReportContext {
  initiator: string;
  buyer: string;
  seller: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  venueType: 0 | 1 | 2;
  venue: string;
  flowType: 0 | 1 | 2;
  sellerIsAffiliate: boolean;
}

export interface ReportEngineDecision {
  allowed: boolean;
  policyId: string;
  policyVersion: bigint;
  validUntil: bigint;
  maxAmount: bigint;
  maxAmountToken: string;
  allowedVenueTypes: bigint;
  allowedVenuesHash: string;
  reasonCode: string;
  reliedClaims: string;
  flagsBitmap: bigint;
  decisionHash: string;
}

export interface ReportRequirement {
  token: string;
  bindingIndex: number;
  recipeId: number;
  recipeVersion: number;
  mode: ReportBindingMode;
  pathGroupId: number;
  elementId: string;
  action: ReportEnforcementAction;
  status: RequirementStatus;
  reasonCode: string;
}

export interface ComplianceRequirementReport {
  version: 1;
  blockNumber: bigint;
  timestamp: bigint;
  complete: boolean;
  status: RequirementStatus;
  engineStatus: RequirementStatus;
  decision: ReportEngineDecision;
  decisionRedacted: boolean;
  restrictedStatus: RequirementStatus;
  requirements: ReportRequirement[];
}

export interface ComplianceReportReader {
  call(transaction: {to: string; data: string; blockTag: number | string}): Promise<string>;
}

const CONTEXT = "(address initiator,address buyer,address seller,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint8 venueType,address venue,uint8 flowType,bool sellerIsAffiliate)";
const DECISION = "(bool allowed,bytes32 policyId,uint64 policyVersion,uint64 validUntil,uint256 maxAmount,address maxAmountToken,uint256 allowedVenueTypes,bytes32 allowedVenuesHash,bytes32 reasonCode,bytes32 reliedClaims,uint256 flagsBitmap,bytes32 decisionHash)";
const REQUIREMENT = "(address token,uint8 bindingIndex,uint16 recipeId,uint16 recipeVersion,uint8 mode,uint16 pathGroupId,bytes32 elementId,uint8 action,uint8 status,bytes32 reasonCode)";
export const complianceReporterInterface = new Interface([
  `function report(${CONTEXT} ctx) view returns ((uint16 version,uint256 blockNumber,uint256 timestamp,bool complete,uint8 status,uint8 engineStatus,${DECISION} decision,bool decisionRedacted,uint8 restrictedStatus,${REQUIREMENT}[] requirements))`
]);

const STATUSES: RequirementStatus[] = ["PASS", "FAIL", "UNDETERMINED", "NOT_APPLICABLE"];
const MODES: ReportBindingMode[] = ["REQUIRED_BLOCKING", "PATH_OPTION", "FLAG_ONLY"];
const ACTIONS: ReportEnforcementAction[] = ["FLAG_ONLY", "OPERATOR_REVIEW", "BLOCK"];

function enumValue<T>(values: T[], index: bigint): T {
  const value = values[Number(index)];
  if (value === undefined) throw new Error("Invalid compliance report enum");
  return value;
}

/** Public diagnostics at an explicit block. Never use a report to authorize settlement. */
export async function readComplianceReport(
  reader: ComplianceReportReader,
  reporter: string,
  context: ComplianceReportContext,
  blockTag: number | string
): Promise<ComplianceRequirementReport> {
  if (typeof blockTag === "number" ? !Number.isSafeInteger(blockTag) || blockTag < 0 : !/^0x[0-9a-fA-F]+$/.test(blockTag)) {
    throw new Error("Compliance report requires an explicit block number or hash");
  }
  const to = getAddress(reporter);
  const data = complianceReporterInterface.encodeFunctionData("report", [context]);
  let encoded: string;
  try {
    encoded = await reader.call({to, data, blockTag});
  } catch {
    throw new Error("Compliance reporter read failed");
  }
  let decoded;
  try {
    decoded = complianceReporterInterface.decodeFunctionResult("report", encoded);
    decoded.toArray(true);
  } catch {
    throw new Error("Invalid compliance report response");
  }
  const r = decoded[0];
  if (r.version !== 1n) throw new Error("Unsupported compliance report version");
  return {
    version: 1,
    blockNumber: r.blockNumber,
    timestamp: r.timestamp,
    complete: r.complete,
    status: enumValue(STATUSES, r.status),
    engineStatus: enumValue(STATUSES, r.engineStatus),
    decision: {
      allowed: r.decision.allowed,
      policyId: r.decision.policyId,
      policyVersion: r.decision.policyVersion,
      validUntil: r.decision.validUntil,
      maxAmount: r.decision.maxAmount,
      maxAmountToken: r.decision.maxAmountToken,
      allowedVenueTypes: r.decision.allowedVenueTypes,
      allowedVenuesHash: r.decision.allowedVenuesHash,
      reasonCode: r.decision.reasonCode,
      reliedClaims: r.decision.reliedClaims,
      flagsBitmap: r.decision.flagsBitmap,
      decisionHash: r.decision.decisionHash
    },
    decisionRedacted: r.decisionRedacted,
    restrictedStatus: enumValue(STATUSES, r.restrictedStatus),
    requirements: Array.from(r.requirements, (item: any) => ({
      token: item.token,
      bindingIndex: Number(item.bindingIndex),
      recipeId: Number(item.recipeId),
      recipeVersion: Number(item.recipeVersion),
      mode: enumValue(MODES, item.mode),
      pathGroupId: Number(item.pathGroupId),
      elementId: item.elementId,
      action: enumValue(ACTIONS, item.action),
      status: enumValue(STATUSES, item.status),
      reasonCode: item.reasonCode
    }))
  };
}
