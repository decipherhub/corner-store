import assert from "node:assert/strict";
import {test} from "node:test";
import {Interface} from "ethers";
import {encodeAcceptIdentityEvidenceV2, decodeAcceptIdentityEvidenceV2, IDENTITY_EVIDENCE_V2_ABI} from "../src/identity-evidence";

const hex = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const wallet = `0x${"11".repeat(20)}`;
const asset = `0x${"22".repeat(20)}`;
const evidence = {identityId: hex(1), issuerId: hex(2), trustBasisHash: hex(3), evidenceHash: hex(4), issuedAt: 900, expiresAt: 2000, attestationType: "SOURCE_REATTEST" as const};

test("v2 acceptance codec round trips compact enforcement fields only", () => {
  const data = encodeAcceptIdentityEvidenceV2({wallet, asset, evidence});
  assert.deepEqual(decodeAcceptIdentityEvidenceV2(data), {wallet, asset, evidence});
  const parsed = new Interface(IDENTITY_EVIDENCE_V2_ABI).parseTransaction({data})!;
  assert.equal(parsed.name, "acceptEvidence");
  assert.equal(parsed.args[2][6], 2n);
  assert.equal((data.length - 2) / 2, 4 + 9 * 32);
});

test("v2 codec rejects missing/zero commitments, invalid windows/types and private fields", () => {
  for (const patch of [{evidenceHash: hex(0)}, {identityId: hex(0)}, {issuerId: hex(0)}, {trustBasisHash: hex(0)}, {issuedAt: 0}, {issuedAt: 2000}, {expiresAt: 899}, {attestationType: "UNKNOWN"}, {lei: "5493001KJTIIGC8Y1R12"}, {key: "secret"}]) {
    assert.throws(() => encodeAcceptIdentityEvidenceV2({wallet, asset, evidence: {...evidence, ...patch} as never}));
  }
  assert.throws(() => encodeAcceptIdentityEvidenceV2({wallet: `0x${"00".repeat(20)}`, asset, evidence}));
  assert.throws(() => decodeAcceptIdentityEvidenceV2(`${encodeAcceptIdentityEvidenceV2({wallet, asset, evidence})}00`));
});

test("v2 codec uses a separate acceptance ABI from legacy KycClaim", () => {
  const legacy = new Interface(["function setKycClaim(bytes32,(bool,bool,bool,uint64,uint64))"]);
  assert.throws(() => decodeAcceptIdentityEvidenceV2(legacy.encodeFunctionData("setKycClaim", [hex(1), [true, true, true, 900, 0]])));
  for (const attestationType of ["PUBLIC_LOOKUP", "SOURCE_REATTEST", "SELECTIVE_DISCLOSURE"] as const) {
    const input = {wallet, asset, evidence: {...evidence, attestationType}};
    assert.deepEqual(decodeAcceptIdentityEvidenceV2(encodeAcceptIdentityEvidenceV2(input)), input);
  }
});
