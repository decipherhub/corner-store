import {createHash} from "crypto";

export interface GovernanceProposal {
  schemaVersion: 1;
  proposalId: string;
  target: string;
  value: string;
  calldata: string;
  reason: string;
  expectedArtifactHash: string;
  requiredApprovals: number;
  state: "draft";
}

export function createGovernanceProposal(input: Omit<GovernanceProposal, "schemaVersion" | "proposalId" | "state">): GovernanceProposal {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.target) || /^0x0{40}$/i.test(input.target)) throw new Error("proposal target must be a non-zero address");
  if (!/^0x[0-9a-fA-F]*$/.test(input.calldata) || input.calldata.length % 2 !== 0) throw new Error("proposal calldata must be even-length hex");
  if (!Number.isSafeInteger(input.requiredApprovals) || input.requiredApprovals < 1) throw new Error("requiredApprovals must be positive");
  if (!input.reason || !input.expectedArtifactHash) throw new Error("proposal reason and artifact hash are required");
  const proposalId = `proposal-${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16)}`;
  return {schemaVersion: 1, proposalId, state: "draft", ...input};
}
