import {AbiCoder, encodeBytes32String, keccak256} from "ethers";

// Element id (bytes32 string) -> human label — 23 labeled elements. The first
// 11 (A-01, A-02, A-03, A-04, A-05, B-01, B-02, C-01, E-01, A-13, F-02) are the
// original illustrative elements — six of which (A-01, A-03, A-04, A-13, B-01,
// B-02) were upgraded in place to the walkthrough-doc failure-code taxonomy
// (wave-2b, see ELEMENT_CODE_NAMES below); the next 6 (A-08, A-09, A-11, B-03,
// B-04, D-01) are the wave-2 illustrative elements (CMP-003); the last 6 (A-06,
// A-12, E-03, F-01, F-03, F-04) are the wave-3 illustrative elements (CMP-004).
// These are NOT all DeployStack-registered: script/DeployStack.s.sol's
// _deployAndRegisterElements registers only 12 — the 11 originals labeled here
// PLUS BUIDL-MIN-v1 (which is itself NOT labeled here). The wave-2 (CMP-003)
// and wave-3 (CMP-004) sets are registered opt-in via tools/deploy-wave2 and
// tools/deploy-wave3 respectively — not by DeployStack, and not wired into any
// recipe's `requiredElements`.
export const ELEMENT_LABELS: Record<string, string> = {
  "A-01-v1": "Sanctions",
  "A-02-v1": "Jurisdiction",
  "A-03-v1": "Accredited Investor",
  "A-04-v1": "Identity Uniqueness",
  "A-05-v1": "US Tax Resident",
  "B-01-v1": "Asset Classification",
  "B-02-v1": "ERC-3643 Native",
  "C-01-v1": "Lockup (Rule 144)",
  "E-01-v1": "Form D Filing",
  "A-13-v1": "Qualified Purchaser",
  "F-02-v1": "Surveillance Flag",
  "A-08-v1": "Entity Eligibility",
  "A-09-v1": "Equity Owner Look-Through",
  "A-11-v1": "Claim Freshness",
  "B-03-v1": "Transfer Restriction Metadata",
  "B-04-v1": "Engine Selection",
  "D-01-v1": "Holder Count",
  "A-06-v1": "Affiliate",
  "A-12-v1": "Red Flag Knowledge Bar",
  "E-03-v1": "Bad Actor Disqualification",
  "F-01-v1": "Operator Self-Dealing",
  "F-03-v1": "Fraud Surveillance",
  "F-04-v1": "Reg M Issuer Buying"
};

// Recipe id -> human label. Recipes registered by DeployStack.
export const RECIPE_LABELS: Record<number, string> = {
  1: "Reg D 506(c)",
  2: "3(c)(7) Fund",
  7: "Reg D + Surveillance"
};

// PolicyStatus enum (src/types/ComplianceTypes.sol). STORAGE ORDER, not lifecycle.
export const POLICY_STATUS: Record<number, string> = {
  0: "UNKNOWN",
  1: "UNREGULATED",
  2: "ACTIVE",
  3: "SUSPENDED",
  4: "PROPOSED",
  5: "RETIRED"
};

// Per-element reason-code name tables: code `n` (in
// `ReasonCodes.encode(recipeId, elementId, n)`) -> the exact doc-name string
// from that element contract's header comment table. Elements NOT listed
// here (A-02, A-05, C-01, E-01, F-02 — still single-code mocks) fall back to
// code 1 -> the element's human label, exactly the file's original behavior
// (see buildTable below).
export const ELEMENT_CODE_NAMES: Record<string, Record<number, string>> = {
  // A-01-v1 Sanctions (src/compliance/elements/Sanctions.sol header table).
  "A-01-v1": {
    1: "FAIL_SDN_WALLET_MATCH",
    2: "FAIL_SDN_IDENTITY_MATCH",
    3: "FAIL_50PCT_RULE",
    4: "FAIL_NO_SANCTIONS_CLAIM",
    5: "FAIL_UNTRUSTED_SANCTIONS_ISSUER",
    6: "FAIL_INVALID_SANCTIONS_SIGNATURE",
    7: "FAIL_SANCTIONS_CLAIM_EXPIRED",
    8: "FAIL_SANCTIONS_CLAIM_STALE_LIST",
    9: "FAIL_50PCT_LOOKTHROUGH_PENDING",
    10: "REVIEW_SANCTIONS_UNCERTAIN"
  },
  // A-03-v1 AccreditedInvestor.
  "A-03-v1": {
    1: "NO_AI_CLAIM",
    2: "UNTRUSTED_AI_CLAIM_ISSUER",
    3: "INVALID_AI_CLAIM_SIGNATURE",
    4: "AI_CLAIM_EXPIRED",
    5: "506C_VERIFICATION_NOT_ESTABLISHED",
    6: "4A7_PURCHASER_NOT_AI",
    7: "AI_LOOKTHROUGH_PENDING",
    8: "AI_CATEGORY_UNSUPPORTED",
    9: "REVIEW_AI_UNCERTAIN"
  },
  // A-04-v1 IdentityUniqueness.
  "A-04-v1": {
    1: "IDENTITY_NOT_REGISTERED",
    2: "KYC_CLAIM_MISSING",
    3: "KYC_CLAIM_INVALID_SIG",
    4: "UNTRUSTED_KYC_ISSUER",
    5: "KYC_CLAIM_EXPIRED",
    6: "IDENTITY_FROZEN",
    7: "IDENTITY_REVOKED",
    8: "DUPLICATE_IDENTITY",
    9: "REVIEW_IDENTITY_DUPLICATE_SUSPECTED"
  },
  // A-13-v1 QualifiedPurchaser.
  "A-13-v1": {
    1: "FAIL_NOT_QP",
    2: "FAIL_QP_CLAIM_EXPIRED",
    3: "FAIL_UNTRUSTED_QP_CLAIM_ISSUER",
    4: "FAIL_QP_LOOKTHROUGH_REQUIRED",
    5: "FAIL_QP_LOOKTHROUGH_NOT_COMPLETED",
    6: "FAIL_TRUST_DISQUALIFIED",
    7: "FAIL_FAMILY_CO_NOT_QP",
    8: "FAIL_KNOWLEDGEABLE_EMP_NOT_QUALIFIED",
    9: "REVIEW_QP_UNCERTAIN"
  },
  // B-01-v1 AssetClassification.
  "B-01-v1": {
    1: "MANIFEST_MISSING",
    2: "MANIFEST_SUSPENDED",
    3: "VERSION_UNAPPROVED",
    4: "VERSION_PENDING",
    5: "FACTS_INCONSISTENT",
    6: "FACT_STALE"
  },
  // B-02-v1 Erc3643Native.
  "B-02-v1": {
    1: "TOKEN_STANDARD_MISMATCH",
    2: "TOKEN_WIRING_DRIFT",
    3: "TOKEN_PAUSED",
    4: "TOKEN_FROZEN_PARTY",
    5: "TOKEN_INSUFFICIENT_UNFROZEN",
    6: "TOKEN_TRANSFER_INELIGIBLE"
  },
  // A-08-v1 EntityEligibility (wave-2, CMP-003).
  "A-08-v1": {
    1: "ENTITY_CATEGORY_MISMATCH",
    2: "ENTITY_THRESHOLD_NOT_MET",
    3: "ENTITY_QIB_UNCONFIRMED",
    4: "ENTITY_FORMED_FOR_PURPOSE",
    5: "ENTITY_LOOKTHROUGH_REQUIRED",
    6: "ENTITY_LOOKTHROUGH_FAILED",
    7: "ENTITY_DIRECT_REQ_MISSING",
    8: "ENTITY_AND_GATE_FAIL"
  },
  // A-09-v1 EquityOwnerLookThrough (wave-2). The contract collapses the doc
  // §6.2 REVIEW_*/FAIL_* families into two on-chain outcomes; one
  // representative doc-name each (see EquityOwnerLookThrough.sol header).
  "A-09-v1": {
    1: "REVIEW_OWNERSHIP_GRAPH_INCOMPLETE", // + REVIEW_LOOKTHROUGH_DEPTH_EXCEEDED, REVIEW_FAMILY_OWNERSHIP_ATTRIBUTION, REVIEW_AI_LOOKTHROUGH_PENDING, REVIEW_TRUST_QP_IV_INDEPENDENT, PARTIAL_REVIEW
    2: "FAIL_LOOKTHROUGH_OWNER_NOT_QUALIFIED" // + FAIL_AI_OWNER_NOT_ACCREDITED, FAIL_FORMED_FOR_SPECIFIC_PURPOSE_NON_QP, FAIL_FAMILY_COMPOSITION_NOT_MET
  },
  // A-11-v1 ClaimFreshness (wave-2).
  "A-11-v1": {
    1: "FAIL_NO_VERIFIED_AT",
    2: "FAIL_CLAIM_STALE_AI",
    3: "FAIL_CLAIM_STALE_QP",
    4: "FAIL_CLAIM_EXPIRED",
    5: "FAIL_UNKNOWN_CLAIM_TYPE"
  },
  // B-03-v1 TransferRestrictionMetadata (wave-2).
  "B-03-v1": {
    1: "RESTRICTION_DECL_MISSING",
    2: "RESTRICTION_STATUS_CONFLICT",
    3: "RESTRICTION_TAGS_INCOMPLETE",
    4: "RESTRICTION_TAG_INVALID",
    5: "RESTRICTION_TAG_CONFLICT",
    6: "UNRESTRICT_BASIS_MISSING"
  },
  // B-04-v1 EngineSelection (wave-2).
  "B-04-v1": {
    1: "FAIL_ENGINE_DECL_MISSING",
    2: "FAIL_ENGINE_DECL_INVALID",
    3: "FAIL_ENGINE_UNKNOWN",
    4: "FAIL_ENGINE_NOT_SUPPORTED",
    5: "FAIL_ENGINE_PATH_INCOMPATIBLE",
    6: "FAIL_ENGINE_AFFILIATE_INCOMPATIBLE",
    7: "FAIL_ENGINE_MM_CLAIM_MISSING"
  },
  // D-01-v1 HolderCount (wave-2, STATEFUL).
  "D-01-v1": {
    1: "HOLDER_CAP_12G_TOTAL",
    2: "HOLDER_CAP_12G_NONAI",
    3: "HOLDER_CAP_3C1_100",
    4: "HOLDER_CAP_506B_35"
  },
  // A-06-v1 Affiliate (wave-3, CMP-004).
  "A-06-v1": {
    1: "FAIL_AFFILIATE_STATUS_UNKNOWN",
    2: "FAIL_UNTRUSTED_AFFILIATE_CLAIM_ISSUER",
    3: "FAIL_AFFILIATE_CLAIM_EXPIRED",
    4: "REVIEW_AFFILIATE_UNCERTAIN"
  },
  // A-12-v1 RedFlagKnowledgeBar (wave-3). MONITORING element: `check()` never
  // rejects (always returns passed=true, bytes32(0)) — every code below is a
  // MARK, surfaced out-of-band via the SurveillanceFlag events / screen()
  // operator+audit surfaces, never leaked in a party-facing reason code. Codes
  // 1-7 are the seven RedFlag categories (bit i == RedFlag(i) == code i+1); 8
  // is the REVIEW_REDFLAG_UNCERTAIN disposition marker. Same treatment as F-02
  // SurveillanceFlag / F-03 below.
  "A-12-v1": {
    1: "FLAG_RESALE_INTENT",
    2: "FLAG_CONTROL_UNDISCLOSED",
    3: "FLAG_AI_INCONSISTENT",
    4: "FLAG_WASH_CLUSTER",
    5: "FLAG_STRUCTURING",
    6: "FLAG_PRICE_ANOMALY",
    7: "FLAG_SUSPICIOUS_PATTERN",
    8: "REVIEW_REDFLAG_UNCERTAIN"
  },
  // E-03-v1 BadActorDisqualification (wave-3).
  "E-03-v1": {
    1: "FAIL_BADACTOR_ROSTER_MISSING",
    2: "REVIEW_BADACTOR_ROSTER_INCOMPLETE",
    3: "FAIL_BADACTOR_CLEARANCE_MISSING",
    4: "REVIEW_BADACTOR_506E_PENDING",
    5: "FAIL_BADACTOR_ISSUER_UNTRUSTED",
    6: "FAIL_BADACTOR_SCOPE_MISMATCH",
    7: "FAIL_BADACTOR_CLEARANCE_STALE",
    8: "FAIL_BADACTOR_REVOKED",
    9: "FAIL_BADACTOR_506E_DISCLOSURE_MISSING"
  },
  // F-01-v1 OperatorSelfDealing (wave-3).
  "F-01-v1": {
    1: "IDENTITY_UNRESOLVED",
    2: "OP_REGISTRY_UNAVAILABLE",
    3: "OP_SELF_DEALING_BLOCKED"
  },
  // F-03-v1 FraudSurveillance (wave-3, STATEFUL). MONITORING element: `check()`
  // never rejects (it is `pure`, structurally unable to read flag state — the
  // no-tipping-off guarantee). `n` numbers the 31 CFR §1023.320(a)(2) suspicion
  // category that OPENED the flag; these codes surface only via the onlyOperator
  // audit views (reasonCodeOf) and subject-opaque FlagLifecycle events, never as
  // a party-facing rejection (same monitoring treatment as A-12 / F-02).
  "F-03-v1": {
    1: "ILLICIT_FUNDS",
    2: "STRUCTURING_EVASION",
    3: "NO_LAWFUL_PURPOSE",
    4: "CRIME_FACILITATION"
  },
  // F-04-v1 RegMIssuerBuying (wave-3).
  "F-04-v1": {
    1: "REVIEW_REGM_EXCEPTION_CONFLICT",
    2: "REG_M_OFFERING_STATUS_MISSING",
    3: "REG_M_RESTRICTED_SET_UNVERIFIED",
    4: "RESTRICTED_PERIOD_PURCHASE_BLOCKED_ISSUER",
    5: "RESTRICTED_PERIOD_PURCHASE_BLOCKED_PARTICIPANT"
  }
};

const coder = AbiCoder.defaultAbiCoder();

// ComplianceEngine._runChecks / ReasonCodes.encode:
//   reasonCode = keccak256(abi.encode(uint16 recipeId, bytes32 elementId, uint32 code))
export function encodeReason(recipeId: number, elementId: string, code: number): string {
  return keccak256(coder.encode(["uint16", "bytes32", "uint32"], [recipeId, encodeBytes32String(elementId), code]));
}

export interface DecodedReason {
  code: string;
  label: string; // human-readable one-liner
}

interface TableEntry {
  label: string;
}

// Precompute every known reason code from THREE sources:
//
//  1. Engine-propagated verdicts: (recipeId in {1,2,7}) x (23 elementIds) x
//     (every code in that element's ELEMENT_CODE_NAMES table, or just code 1
//     for elements without one). `ComplianceEngine._runChecks` currently
//     re-encodes every per-element failure as `encode(contributingRecipe,
//     elementId, 1)` (code hardcoded to 1 regardless of the element's actual
//     failure), so code 1 is the only one of these actually reachable via
//     `evaluate()`/`ExecutionRouter`'s `ComplianceRejected` today — codes 2+
//     are precomputed anyway (matching this file's existing precedent of
//     covering known combos ahead of use, per the audit-matching rationale in
//     ReasonCodes.sol) so decoding stays correct if/when richer propagation
//     lands.
//  2. Direct element-level codes: (recipeId 0) x (23 elementIds) x (every
//     code in ELEMENT_CODE_NAMES, or code 1 for elements without one). Every
//     element's own `check()` self-encodes with `ReasonCodes.encode(0,
//     ELEMENT_ID, n)` (see e.g. Sanctions.sol, HolderCount.sol) — this is
//     the reasonCode actually returned by calling an element directly, by
//     stateful elements' own `ComplianceRejected` reverts (e.g. D-01
//     HolderCount.onTransfer), and by monitoring-flag events (e.g.
//     SurveillanceFlag). THIS is where the wave-2b codes 2-10 are genuinely
//     decodable today.
//  3. The engine's policy-status rejections (recipeId 0, sentinel element
//     "POLICY"): `ComplianceEngine._rejectPolicy`: encode(0, "POLICY", uint32(status)).
function buildTable(): Map<string, TableEntry> {
  const table = new Map<string, TableEntry>();

  function addElementEntries(recipeId: number, label: (elementId: string, codeNum: number, name: string) => string) {
    for (const elementId of Object.keys(ELEMENT_LABELS)) {
      const codeNames = ELEMENT_CODE_NAMES[elementId];
      if (codeNames) {
        for (const codeStr of Object.keys(codeNames)) {
          const codeNum = Number(codeStr);
          const code = encodeReason(recipeId, elementId, codeNum);
          table.set(code, {label: label(elementId, codeNum, codeNames[codeNum])});
        }
      } else {
        const code = encodeReason(recipeId, elementId, 1);
        table.set(code, {label: label(elementId, 1, ELEMENT_LABELS[elementId])});
      }
    }
  }

  // 1. Engine-propagated verdicts (recipe-scoped).
  for (const recipeId of [1, 2, 7]) {
    const recipeLabel = RECIPE_LABELS[recipeId] ?? `recipe ${recipeId}`;
    addElementEntries(
      recipeId,
      (elementId, codeNum, name) => `recipe ${recipeId} (${recipeLabel}) / ${elementId} / code ${codeNum} -> ${name}`
    );
  }

  // 2. Direct element-level codes (recipeId 0, real element ids).
  addElementEntries(
    0,
    (elementId, codeNum, name) => `element check (recipeId 0) / ${elementId} / code ${codeNum} -> ${name}`
  );

  // 3. Policy-status rejections carry recipeId 0 and the sentinel element "POLICY".
  for (const status of Object.keys(POLICY_STATUS).map(Number)) {
    const code = encodeReason(0, "POLICY", status);
    table.set(code, {
      label: `policy status / POLICY / ${status} -> manifest not tradable (${POLICY_STATUS[status]})`
    });
  }
  return table;
}

const TABLE = buildTable();

export function decodeReason(code: string): DecodedReason {
  const normalized = code.toLowerCase();
  const entry = TABLE.get(normalized);
  if (entry) return {code: normalized, label: entry.label};
  return {code: normalized, label: "unknown code"};
}

// Number of precomputed entries (used by the smoke test).
export function tableSize(): number {
  return TABLE.size;
}
