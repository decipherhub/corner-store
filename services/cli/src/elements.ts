import {AbiCoder, Contract, encodeBytes32String, keccak256} from "ethers";

// CLI element name -> registered elementId (bytes32 string) in the ElementRegistry.
export const ELEMENT_IDS: Record<string, string> = {
  sanctions: "A-01-v1",
  jurisdiction: "A-02-v1",
  accredited: "A-03-v1",
  identity: "A-04-v1",
  "us-tax": "A-05-v1",
  "asset-class": "B-01-v1",
  erc3643: "B-02-v1",
  "form-d": "E-01-v1",
  qp: "A-13-v1"
};

export const ATTEST_ELEMENTS = Object.keys(ELEMENT_IDS);

const coder = AbiCoder.defaultAbiCoder();

function parseBool(v: string | undefined, dflt: boolean): boolean {
  if (v === undefined) return dflt;
  const s = v.toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  throw new Error(`expected a boolean (true/false), got "${v}"`);
}

// Default deploy-time identity id: keccak256(abi.encode("ID", subject)).
export function defaultIdentityId(subject: string): string {
  return keccak256(coder.encode(["string", "address"], ["ID", subject]));
}

// Apply the element's setter through the operator-bound contract. Returns a
// human-readable description of what was written (for logging) plus the sent tx.
export async function applyAttestation(
  name: string,
  contract: Contract,
  subject: string,
  values: string[]
): Promise<{tx: any; description: string}> {
  switch (name) {
    case "sanctions": {
      const blocked = parseBool(values[0], false);
      return {tx: await contract.setBlocked(subject, blocked), description: `sanctions.setBlocked(${subject}, ${blocked})`};
    }
    case "jurisdiction": {
      const code = values[0] ?? "US";
      return {
        tx: await contract.setJurisdiction(subject, encodeBytes32String(code)),
        description: `jurisdiction.setJurisdiction(${subject}, "${code}")`
      };
    }
    case "accredited": {
      const ok = parseBool(values[0], true);
      return {tx: await contract.setAccredited(subject, ok), description: `accredited.setAccredited(${subject}, ${ok})`};
    }
    case "identity": {
      const id = values[0] ?? defaultIdentityId(subject);
      return {tx: await contract.bindIdentity(subject, id), description: `identity.bindIdentity(${subject}, ${id})`};
    }
    case "us-tax": {
      const resident = parseBool(values[0], true);
      return {
        tx: await contract.setUsTaxResident(subject, resident),
        description: `us-tax.setUsTaxResident(${subject}, ${resident})`
      };
    }
    case "qp": {
      const isQp = parseBool(values[0], true);
      return {tx: await contract.setQp(subject, isQp), description: `qp.setQp(${subject}, ${isQp})`};
    }
    case "asset-class": {
      const cls = values[0] ?? "REG_D";
      return {
        tx: await contract.setClassification(subject, encodeBytes32String(cls)),
        description: `asset-class.setClassification(${subject}, "${cls}")`
      };
    }
    case "erc3643": {
      const native = parseBool(values[0], true);
      return {
        tx: await contract.setErc3643Native(subject, native),
        description: `erc3643.setErc3643Native(${subject}, ${native})`
      };
    }
    case "form-d": {
      const filed = parseBool(values[0], true);
      const ref = values[1] ?? "EDGAR-ACCESSION";
      return {
        tx: await contract.setFormDFiled(subject, filed, encodeBytes32String(ref)),
        description: `form-d.setFormDFiled(${subject}, ${filed}, "${ref}")`
      };
    }
    default:
      throw new Error(`unknown element "${name}". Known: ${ATTEST_ELEMENTS.join(", ")}`);
  }
}
