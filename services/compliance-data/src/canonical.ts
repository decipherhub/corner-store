import {createHash} from "crypto";
import {Hex} from "./types";

export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export function hash(value: unknown): Hex {
  return `0x${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function assertTimestamp(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
}

export function assertUintString(value: string, name: string, allowZero = false): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${name} must be a canonical unsigned integer string`);
  const parsed = BigInt(value);
  if (!allowZero && parsed === 0n) throw new Error(`${name} must be positive`);
  return parsed;
}

export function assertAddress(value: string, name: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name} must be a 20-byte hex address`);
}

export function assertBytes32(value: string, name: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be bytes32 hex`);
}
