import {AbiCoder, encodeBytes32String, keccak256} from "ethers";

// Element id (bytes32 string) -> human label. These are the 11 elements the
// DeployStack registers; see script/DeployStack.s.sol:_deployAndRegisterElements.
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
  "F-02-v1": "Surveillance Flag"
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

// Precompute every known reason code: (recipeId in {1,2,7}) x (11 elementIds) x
// (code 1), plus the engine's policy-status rejections
// (ComplianceEngine._rejectPolicy: encode(0, "POLICY", uint32(status))).
function buildTable(): Map<string, TableEntry> {
  const table = new Map<string, TableEntry>();
  const recipeIds = [1, 2, 7];
  for (const recipeId of recipeIds) {
    for (const elementId of Object.keys(ELEMENT_LABELS)) {
      const code = encodeReason(recipeId, elementId, 1);
      const recipeLabel = RECIPE_LABELS[recipeId] ?? `recipe ${recipeId}`;
      table.set(code, {
        label: `recipe ${recipeId} (${recipeLabel}) / ${elementId} / code 1 -> ${ELEMENT_LABELS[elementId]}`
      });
    }
  }
  // Policy-status rejections carry recipeId 0 and the sentinel element "POLICY".
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
