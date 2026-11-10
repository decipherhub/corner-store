import {readFileSync} from "fs";

import {RFQ_REJECTION_REASON_CODES, RFQRejectionReasonCode} from "@corner-store/rfq-service";

export type RFQDisclosureTier = "detailed" | "action_only" | "generic";

interface DisclosureEntry {
  tier: RFQDisclosureTier;
  message: string;
}

export interface RFQRejectionDisclosure {
  policyVersion: string;
  reasons: Array<DisclosureEntry & {reasonCode?: RFQRejectionReasonCode}>;
}

type Disclosure = (reasonCodes: unknown) => RFQRejectionDisclosure | undefined;

export function createRFQRejectionDisclosure(filePath?: string): Disclosure {
  try {
    if (!filePath) return () => undefined;
    const raw = readFileSync(filePath, "utf8");
    if (Buffer.byteLength(raw) > 16 * 1024) return () => undefined;
    const policy: unknown = JSON.parse(raw);
    if (!isRecord(policy) || !exactKeys(policy, ["schemaVersion", "policyVersion", "reasons"]) || policy.schemaVersion !== 1 ||
      typeof policy.policyVersion !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(policy.policyVersion) || !isRecord(policy.reasons)) {
      return () => undefined;
    }
    const entries = new Map<RFQRejectionReasonCode, DisclosureEntry>();
    for (const [code, entry] of Object.entries(policy.reasons)) {
      if (!isReasonCode(code) || !isRecord(entry) || !exactKeys(entry, ["tier", "message"]) ||
        !["detailed", "action_only", "generic"].includes(entry.tier as string) ||
        typeof entry.message !== "string" || !entry.message.trim() || entry.message.length > 512 || /[\x00-\x1f\x7f]/.test(entry.message)) {
        return () => undefined;
      }
      entries.set(code, {tier: entry.tier as RFQDisclosureTier, message: entry.message});
    }
    const policyVersion = policy.policyVersion;
    return (reasonCodes) => {
      // All-or-nothing validation also suppresses foreign sanctions/AML/surveillance codes.
      if (!Array.isArray(reasonCodes) || reasonCodes.length === 0 || reasonCodes.length > 32 ||
        !reasonCodes.every((code): code is RFQRejectionReasonCode => isReasonCode(code) && entries.has(code))) return undefined;
      return {
        policyVersion,
        reasons: [...new Set<RFQRejectionReasonCode>(reasonCodes)].map((reasonCode) => {
          const entry = entries.get(reasonCode)!;
          return {...entry, ...(entry.tier === "detailed" ? {reasonCode} : {})};
        })
      };
    };
  } catch {
    return () => undefined;
  }
}

function isReasonCode(value: unknown): value is RFQRejectionReasonCode {
  return typeof value === "string" && (RFQ_REJECTION_REASON_CODES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
