import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {canonicalJson} from "./canonical";
import {Hex} from "./types";

export type KycCommitmentDomainV2 = "identity" | "source" | "assessment" | "evidence";
export interface KycCommitmentsV2 {
  hash(domain: KycCommitmentDomainV2, value: unknown): Hex;
}

export function createKycCommitmentsV2(keyHex: string): KycCommitmentsV2 {
  if (typeof keyHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error("KYC v2 requires a 32-byte hex local key");
  const key = Buffer.from(keyHex, "hex");
  return Object.freeze({
    hash(domain: KycCommitmentDomainV2, value: unknown): Hex {
      if (!["identity", "source", "assessment", "evidence"].includes(domain)) throw new Error("unsupported KYC v2 commitment domain");
      return `0x${createHmac("sha256", key).update(canonicalJson({domain: `corner-store/kyc/${domain}/v2`, value})).digest("hex")}`;
    }
  });
}

export function loadLocalKycCommitmentsV2(options: {env?: NodeJS.ProcessEnv} = {}): KycCommitmentsV2 {
  const env = options.env ?? process.env;
  const inline = env.CORNER_STORE_KYC_HMAC_KEY;
  const file = env.CORNER_STORE_KYC_HMAC_KEY_FILE;
  if ((inline !== undefined) === (file !== undefined)) throw new Error("configure exactly one KYC v2 local key source");
  let value: string;
  try {
    value = inline ?? readFileSync(file!, "utf8").trim();
  } catch {
    throw new Error("KYC v2 local key is unreadable");
  }
  return createKycCommitmentsV2(value);
}

export function validateLei(lei: unknown): void {
  if (lei === undefined) return;
  if (typeof lei !== "string" || !/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) throw new Error("LEI must have the ISO 17442 shape");
  let remainder = 0;
  for (const character of lei) {
    const digits = character >= "A" && character <= "Z" ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  if (remainder !== 1) throw new Error("LEI checksum is invalid");
}
