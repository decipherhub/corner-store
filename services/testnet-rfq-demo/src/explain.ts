import {AbiCoder, encodeBytes32String, keccak256} from "ethers";

export interface FailedCheck {
  name: string;
  pass: boolean;
  reasonCode?: string;
}

export interface BlockTiming {
  kind: "automatic" | "operator-action" | "user-action" | "unknown";
  availableAt?: number;
  evidenceExpiredAt?: number;
  note: string;
}

export interface BlockExplanation {
  code: string;
  technicalLabel: string;
  title: string;
  detail: string;
  action: string;
  timing: BlockTiming;
}

const ZERO_REASON = `0x${"00".repeat(32)}`;
const coder = AbiCoder.defaultAbiCoder();
const REASON_NAMES = buildReasonNames();

export function encodeReasonCode(recipeId: number, elementId: string, code: number): string {
  return keccak256(coder.encode(["uint16", "bytes32", "uint32"], [recipeId, encodeBytes32String(elementId), code]));
}

export function reasonName(reasonCode: string): string | undefined {
  if (!reasonCode || reasonCode.toLowerCase() === ZERO_REASON) return undefined;
  return REASON_NAMES.get(reasonCode.toLowerCase());
}

function buildReasonNames(): Map<string, string> {
  const entries = new Map<string, string>();
  const add = (elementId: string, codes: Record<number, string>) => {
    for (const [code, name] of Object.entries(codes)) {
      entries.set(encodeReasonCode(0, elementId, Number(code)).toLowerCase(), name);
    }
  };

  add("A-13-v1", {
    1: "FAIL_NOT_QP",
    2: "FAIL_QP_CLAIM_EXPIRED",
    3: "FAIL_UNTRUSTED_QP_CLAIM_ISSUER",
    4: "FAIL_QP_LOOKTHROUGH_REQUIRED",
    5: "FAIL_QP_LOOKTHROUGH_NOT_COMPLETED",
    6: "FAIL_TRUST_DISQUALIFIED",
    7: "FAIL_FAMILY_CO_NOT_QP",
    8: "FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED",
    9: "REVIEW_QP_UNCERTAIN"
  });
  add("C-01-v2", {
    1: "ACQUISITION_RECORD_MISSING",
    2: "ACQUISITION_LINEAGE_BROKEN",
    3: "ACQUISITION_RECORD_EXPIRED",
    4: "HOLDING_PERIOD_NOT_ELAPSED"
  });
  add("MIN-AMOUNT-v1", {1: "BELOW_MINIMUM_TRADE_AMOUNT"});
  add("B-02-v2", {
    1: "TOKEN_STANDARD_MISMATCH",
    2: "TOKEN_WIRING_DRIFT",
    3: "TOKEN_PAUSED",
    4: "TOKEN_FROZEN_PARTY",
    5: "TOKEN_INSUFFICIENT_UNFROZEN",
    6: "TOKEN_TRANSFER_INELIGIBLE"
  });
  add("A-04-v1", {
    1: "IDENTITY_NOT_REGISTERED",
    2: "KYC_CLAIM_MISSING",
    3: "KYC_CLAIM_INVALID_SIG",
    4: "UNTRUSTED_KYC_ISSUER",
    5: "KYC_CLAIM_EXPIRED",
    6: "IDENTITY_FROZEN",
    7: "IDENTITY_REVOKED",
    8: "DUPLICATE_IDENTITY",
    9: "REVIEW_IDENTITY_DUPLICATE_SUSPECTED"
  });
  entries.set(encodeReasonCode(0, "POLICY", 3).toLowerCase(), "MANIFEST_SUSPENDED");
  return entries;
}

export function explainBlockedTrade(
  reasonCode: string,
  checks: FailedCheck[],
  timingEvidence?: Partial<BlockTiming>
): BlockExplanation {
  const failed = checks.filter((check) => !check.pass);
  const policy = failed.find((check) => check.name === "latest compliance policy");
  if (!policy) {
    const operational = failed.find((check) => check.name !== "latest compliance policy");
    if (operational) return explainOperational(operational.name, reasonCode);
  }

  const name = reasonName(reasonCode);
  const explanation = explainPolicy(name);
  const timing = {...explanation.timing, ...timingEvidence};
  if (name === "HOLDING_PERIOD_NOT_ELAPSED" && timing.availableAt === undefined) {
    return {
      code: reasonCode,
      technicalLabel: name,
      ...explanation,
      action: "Refresh to retrieve the onchain availability time, or ask the test operator to inspect the acquisition evidence.",
      timing: {
        kind: "unknown",
        note: "No reliable availability time could be derived from the current chain evidence."
      }
    };
  }
  return {
    code: reasonCode,
    technicalLabel: name ?? "UNKNOWN_POLICY_REASON",
    ...explanation,
    timing
  };
}

function explainOperational(name: string, reasonCode: string): BlockExplanation {
  const common = {
    code: reasonCode,
    technicalLabel: name.toUpperCase().replace(/ /g, "_")
  };
  if (name === "maker approval") {
    return {
      ...common,
      title: "The market maker is temporarily unavailable",
      detail: "This venue currently refuses quotes from the configured market maker.",
      action: "Wait for the test operator to restore the maker approval, then run the pre-check again.",
      timing: operatorTiming("There is no automatic unlock time; the test operator must restore approval.")
    };
  }
  if (name === "maker inventory") {
    return {
      ...common,
      title: "The requested inventory is not available",
      detail: "The market maker does not hold enough output tokens for this trade size.",
      action: "Reduce the amount or wait for the test operator to replenish inventory.",
      timing: operatorTiming("Availability depends on inventory replenishment, not a fixed timer.")
    };
  }
  if (name === "maker allowance") {
    return {
      ...common,
      title: "The market maker allowance is not ready",
      detail: "The RFQ adapter cannot move the market maker's output tokens yet.",
      action: "Wait for the test operator to restore the testnet allowance, then retry.",
      timing: operatorTiming("There is no automatic unlock time; an operator transaction is required.")
    };
  }
  return {
    ...common,
    title: "The venue is not ready for this trade",
    detail: `The ${name} readiness check did not pass.`,
    action: "Refresh the page after the test operator restores the deployment state.",
    timing: operatorTiming("The venue must be restored before this trade can continue.")
  };
}

function explainPolicy(name?: string): Omit<BlockExplanation, "code" | "technicalLabel"> {
  switch (name) {
    case "FAIL_NOT_QP":
      return {
        title: "This wallet is not qualified for the mock restricted stock",
        detail: "The current test identity does not have the qualified-purchaser claim required by this policy.",
        action: "Use the eligible test wallet or ask the test operator to issue a fresh demo qualification.",
        timing: operatorTiming("Qualification does not unlock automatically at a scheduled time.")
      };
    case "FAIL_QP_CLAIM_EXPIRED":
      return {
        title: "The wallet qualification has expired",
        detail: "The wallet had a test qualification, but its permitted freshness period has ended.",
        action: "Ask the test operator to refresh the demo qualification, then run the pre-check again.",
        timing: operatorTiming("An expired claim stays blocked until the operator refreshes it.")
      };
    case "HOLDING_PERIOD_NOT_ELAPSED":
      return {
        title: "The holding period has not finished",
        detail: "The wallet sending the mock restricted stock acquired it too recently for this resale policy.",
        action: "Wait until the displayed availability time, then run the pre-check again.",
        timing: {
          kind: "automatic",
          note: "The trade becomes eligible automatically when the onchain holding-period clock reaches the required time."
        }
      };
    case "ACQUISITION_RECORD_MISSING":
      return {
        title: "The acquisition record is missing",
        detail: "The policy cannot establish when the sending wallet acquired the mock restricted stock.",
        action: "Ask the test operator to publish a fresh acquisition snapshot for this wallet.",
        timing: operatorTiming("There is no automatic unlock time without an acquisition snapshot.")
      };
    case "ACQUISITION_LINEAGE_BROKEN":
      return {
        title: "The acquisition history cannot be verified",
        detail: "The test acquisition record is marked as having incomplete or inconsistent lineage.",
        action: "Ask the test operator to correct and republish the acquisition evidence.",
        timing: operatorTiming("The trade remains blocked until replacement evidence is published.")
      };
    case "ACQUISITION_RECORD_EXPIRED":
      return {
        title: "The acquisition evidence is stale",
        detail: "The recorded holding-period evidence has passed its refresh deadline.",
        action: "Ask the test operator to refresh the acquisition snapshot.",
        timing: operatorTiming("Stale evidence does not become valid again automatically.")
      };
    case "BELOW_MINIMUM_TRADE_AMOUNT":
      return {
        title: "The trade amount is below the policy minimum",
        detail: "This mock asset only accepts trades at or above its configured minimum size.",
        action: "Increase the amount and run the pre-check again.",
        timing: userTiming("This can be retried immediately with a larger amount.")
      };
    case "TOKEN_TRANSFER_INELIGIBLE":
    case "IDENTITY_NOT_REGISTERED":
    case "KYC_CLAIM_MISSING":
    case "KYC_CLAIM_EXPIRED":
      return {
        title: "The wallet cannot receive or send this mock asset",
        detail: "The ERC-3643 identity or transfer-eligibility check did not pass for the current wallet.",
        action: "Use an eligible test wallet or ask the test operator to refresh its demo identity claim.",
        timing: operatorTiming("Identity eligibility changes only after the test operator updates the fixture.")
      };
    case "MANIFEST_SUSPENDED":
      return {
        title: "Trading for this mock asset is paused",
        detail: "The active policy is currently suspended, so no settlement can proceed.",
        action: "Wait for the operator's delayed resume process to complete, then refresh the page.",
        timing: operatorTiming("The exact resume time is shown only when a pending resume is available.")
      };
    default:
      return {
        title: "The current policy blocks this trade",
        detail: "A required policy check did not pass. The technical reason remains available below for review.",
        action: "Try the eligible test wallet or ask the test operator to review the displayed reason code.",
        timing: {kind: "unknown", note: "No reliable automatic unlock time is available for this reason."}
      };
  }
}

function operatorTiming(note: string): BlockTiming {
  return {kind: "operator-action", note};
}

function userTiming(note: string): BlockTiming {
  return {kind: "user-action", note};
}
