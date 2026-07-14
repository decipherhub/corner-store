import {Address, Hex, UintLike} from "./types";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]*$/;

export function normalizeAddress(value: Address, field: string): Address {
  if (!ADDRESS_RE.test(value)) throw new Error(`${field} must be a 20-byte hex address`);
  return value.toLowerCase() as Address;
}

export function assertHex(value: Hex, field: string): Hex {
  if (!HEX_RE.test(value)) throw new Error(`${field} must be hex`);
  return value;
}

export function normalizeChainId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("chainId must be a positive safe integer");
  return value;
}

export function normalizeTtlSeconds(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("ttlSeconds must be a positive safe integer");
  return value;
}

export function toUintString(value: UintLike, field: string): string {
  const parsed = toBigInt(value, field);
  if (parsed < 0n) throw new Error(`${field} must be non-negative`);
  return parsed.toString();
}

export function toPositiveUintString(value: UintLike, field: string): string {
  const parsed = toBigInt(value, field);
  if (parsed <= 0n) throw new Error(`${field} must be positive`);
  return parsed.toString();
}

export function toBigInt(value: UintLike, field: string): bigint {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${field} number input must be a safe integer; use bigint or decimal string for large values`);
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) throw new Error(`${field} must be a non-negative decimal string`);
    return BigInt(value);
  }

  return value;
}
