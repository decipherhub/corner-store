import {assertTimestamp} from "./canonical";
import {KycCommitmentsV2} from "./kyc-hmac-v2";
import {ProviderNeutralKycEvidenceV2, validateKycEvidenceV2} from "./kyc-v2";
import {Hex} from "./types";

const TYPES = {PUBLIC_LOOKUP: 1, SOURCE_REATTEST: 2, SELECTIVE_DISCLOSURE: 3} as const;
// acceptEvidence(address,address,(bytes32,bytes32,bytes32,bytes32,uint64,uint64,uint8))
const ACCEPT_SELECTOR = "0x9b3e5df6";

export function identityEvidenceAcceptanceV2(snapshot: ProviderNeutralKycEvidenceV2, commitments: KycCommitmentsV2, now: number) {
  validateKycEvidenceV2(snapshot, commitments);
  assertTimestamp(now, "now");
  if (!snapshot.eligible || !snapshot.operatorAccepted || snapshot.observedAt > now || snapshot.materializedAt > now || snapshot.validUntil <= now || snapshot.provenance.issuedAt > now) throw new Error("current operator-accepted evidence is required");
  const evidence = {
    identityId: snapshot.identity,
    issuerId: snapshot.provenance.issuerId,
    trustBasisHash: snapshot.provenance.trustBasisHash,
    evidenceHash: snapshot.evidenceHash,
    issuedAt: snapshot.provenance.issuedAt,
    expiresAt: Math.min(snapshot.validUntil, snapshot.provenance.expiresAt),
    attestationType: snapshot.provenance.attestationType
  };
  if (/^0x0{40}$/i.test(snapshot.subject) || /^0x0{40}$/i.test(snapshot.asset)) throw new Error("evidence binding must not be zero");
  const words = [snapshot.subject.slice(2), snapshot.asset.slice(2), evidence.identityId.slice(2), evidence.issuerId.slice(2), evidence.trustBasisHash.slice(2), evidence.evidenceHash.slice(2), evidence.issuedAt.toString(16), evidence.expiresAt.toString(16), TYPES[evidence.attestationType].toString(16)];
  const calldata = `${ACCEPT_SELECTOR}${words.map((word) => word.padStart(64, "0")).join("")}` as Hex;
  return {functionName: "acceptEvidence" as const, wallet: snapshot.subject, asset: snapshot.asset, evidence, calldata};
}
