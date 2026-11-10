import {Interface, getAddress} from "ethers";

export const IDENTITY_EVIDENCE_V2_ABI = ["function acceptEvidence(address wallet,address asset,(bytes32 identityId,bytes32 issuerId,bytes32 trustBasisHash,bytes32 evidenceHash,uint64 issuedAt,uint64 expiresAt,uint8 attestationType) evidence)"] as const;
export const ATTESTATION_TYPE_V2 = {PUBLIC_LOOKUP: 1, SOURCE_REATTEST: 2, SELECTIVE_DISCLOSURE: 3} as const;

export interface IdentityEvidenceV2 {
  identityId: string;
  issuerId: string;
  trustBasisHash: string;
  evidenceHash: string;
  issuedAt: number;
  expiresAt: number;
  attestationType: keyof typeof ATTESTATION_TYPE_V2;
}

export interface IdentityEvidenceAcceptanceV2 {
  wallet: string;
  asset: string;
  evidence: IdentityEvidenceV2;
}

const codec = new Interface(IDENTITY_EVIDENCE_V2_ABI);

export function encodeAcceptIdentityEvidenceV2(input: IdentityEvidenceAcceptanceV2): string {
  exactKeys(input, ["wallet", "asset", "evidence"]);
  exactKeys(input.evidence, ["identityId", "issuerId", "trustBasisHash", "evidenceHash", "issuedAt", "expiresAt", "attestationType"]);
  const {evidence} = input;
  for (const address of [input.wallet, input.asset]) {
    if (getAddress(address) === "0x0000000000000000000000000000000000000000") throw new Error("evidence binding must not be zero");
  }
  for (const field of ["identityId", "issuerId", "trustBasisHash", "evidenceHash"] as const) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(evidence[field]) || /^0x0{64}$/i.test(evidence[field])) throw new Error("evidence requires nonzero commitments");
  }
  if (!Number.isSafeInteger(evidence.issuedAt) || evidence.issuedAt <= 0 || !Number.isSafeInteger(evidence.expiresAt) || evidence.expiresAt <= evidence.issuedAt) throw new Error("invalid evidence window");
  if (!Object.prototype.hasOwnProperty.call(ATTESTATION_TYPE_V2, evidence.attestationType)) throw new Error("unknown attestation type");
  return codec.encodeFunctionData("acceptEvidence", [input.wallet, input.asset, [evidence.identityId, evidence.issuerId, evidence.trustBasisHash, evidence.evidenceHash, evidence.issuedAt, evidence.expiresAt, ATTESTATION_TYPE_V2[evidence.attestationType]]]);
}

export function decodeAcceptIdentityEvidenceV2(data: string): IdentityEvidenceAcceptanceV2 {
  if (!/^0x[0-9a-fA-F]{584}$/.test(data)) throw new Error("invalid evidence calldata length");
  const decoded = codec.decodeFunctionData("acceptEvidence", data);
  const e = decoded[2];
  const attestationType = (Object.keys(ATTESTATION_TYPE_V2) as IdentityEvidenceV2["attestationType"][]).find((type) => BigInt(ATTESTATION_TYPE_V2[type]) === e[6]);
  if (!attestationType) throw new Error("unknown attestation type");
  const input = {wallet: decoded[0].toLowerCase(), asset: decoded[1].toLowerCase(), evidence: {identityId: e[0], issuerId: e[1], trustBasisHash: e[2], evidenceHash: e[3], issuedAt: Number(e[4]), expiresAt: Number(e[5]), attestationType}};
  if (encodeAcceptIdentityEvidenceV2(input).toLowerCase() !== data.toLowerCase()) throw new Error("noncanonical evidence calldata");
  return input;
}

function exactKeys(value: unknown, keys: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) throw new Error("unsupported evidence fields");
}
