import {AbiCoder, keccak256, toUtf8Bytes, ZeroHash} from "ethers";
import {Address, Hex} from "./types";
import {normalizeAddress} from "./validation";

export interface AffiliateLegEvidence {
  asset: Address;
  sender: Address;
  affiliateSource: Address;
  basis: number;
  source: number;
  claimIssuer: Address;
  verifiedAt: number;
  decayStartedAt: number;
  effectiveStatus: number;
}

export function affiliateEvidenceCommitment(input: AffiliateLegEvidence | undefined, output: AffiliateLegEvidence | undefined, now: number): {affiliateEvidenceHash: Hex; sellerIsAffiliate: boolean} {
  function legHash(leg?: AffiliateLegEvidence): string {
    if (!leg) return ZeroHash;
    if (![3, 4].includes(leg.effectiveStatus) || !Number.isInteger(leg.basis) || leg.basis < 1 || leg.basis > 9 || !Number.isInteger(leg.source) || leg.source < 1 || leg.source > 7 || !Number.isSafeInteger(leg.verifiedAt) || leg.verifiedAt <= 0 || leg.verifiedAt > now || !Number.isSafeInteger(leg.decayStartedAt) || leg.decayStartedAt < 0 || (leg.basis === 7 && (leg.decayStartedAt === 0 || leg.decayStartedAt > now))) throw new Error("invalid affiliate evidence");
    return keccak256(AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address", "uint8", "uint8", "address", "uint64", "uint64", "uint8"],
      [normalizeAddress(leg.asset, "asset"), normalizeAddress(leg.sender, "sender"), normalizeAddress(leg.affiliateSource, "affiliateSource"), leg.basis, leg.source, normalizeAddress(leg.claimIssuer, "claimIssuer"), leg.verifiedAt, leg.decayStartedAt, leg.effectiveStatus]
    ));
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid evidence timestamp");
  if (input && output && input.effectiveStatus !== output.effectiveStatus) throw new Error("conflicting affiliate status");
  return {affiliateEvidenceHash: keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32", "bytes32"], [keccak256(toUtf8Bytes("corner-store.affiliate-evidence.v1")), legHash(input), legHash(output)])) as Hex, sellerIsAffiliate: (input ?? output)?.effectiveStatus === 4};
}
