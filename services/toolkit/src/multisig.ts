import {GovernanceProposal} from "./proposal";

export interface SafeTransactionDraft {
  chainId: number;
  to: string;
  value: string;
  data: string;
  operation: 0;
  origin: "corner-store-toolkit";
  proposalId: string;
  expectedArtifactHash: string;
}

export function toSafeTransactionDraft(proposal: GovernanceProposal, chainId: number): SafeTransactionDraft {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("chainId must be positive");
  return {
    chainId,
    to: proposal.target,
    value: proposal.value,
    data: proposal.calldata,
    operation: 0,
    origin: "corner-store-toolkit",
    proposalId: proposal.proposalId,
    expectedArtifactHash: proposal.expectedArtifactHash
  };
}
