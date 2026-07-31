import {appendFileSync, existsSync, readFileSync} from "fs";
import {assertAddress, assertBytes32, assertUintString, canonicalJson, hash} from "./canonical";
import {AuditEntry, ComplianceAuditRecord, Hex, SurveillanceRecord} from "./types";

const ZERO_HASH = `0x${"0".repeat(64)}` as Hex;

export class HashChainAuditLog {
  private readonly entries: AuditEntry[];

  constructor(private readonly path?: string) {
    this.entries = path && existsSync(path)
      ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as AuditEntry)
      : [];
    this.assertValid();
  }

  append(record: ComplianceAuditRecord): AuditEntry {
    validateRecord(record);
    const previousHash = this.entries.at(-1)?.recordHash ?? ZERO_HASH;
    const sequence = this.entries.length + 1;
    const recordHash = hash({sequence, previousHash, record});
    const entry = {sequence, previousHash, recordHash, record};
    this.entries.push(entry);
    if (this.path) appendFileSync(this.path, `${canonicalJson(entry)}\n`, {encoding: "utf8", flag: "a"});
    return entry;
  }

  list(): AuditEntry[] {
    // Audit records are JSON-safe by construction. Round-tripping keeps callers
    // from mutating the in-memory chain without requiring Node's newer
    // structuredClone global.
    return JSON.parse(JSON.stringify(this.entries)) as AuditEntry[];
  }

  assertValid(): void {
    let previousHash = ZERO_HASH;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      const expectedSequence = index + 1;
      const expectedHash = hash({sequence: expectedSequence, previousHash, record: entry.record});
      if (entry.sequence !== expectedSequence || entry.previousHash !== previousHash || entry.recordHash !== expectedHash) {
        throw new Error(`audit hash chain invalid at sequence ${expectedSequence}`);
      }
      previousHash = entry.recordHash;
    }
  }
}

export class TransferSurveillance {
  constructor(private readonly audit: HashChainAuditLog) {}

  observe(record: Omit<SurveillanceRecord, "kind" | "finding" | "riskTier">): AuditEntry | undefined {
    if (record.route === "APPROVED_ROUTER") return undefined;
    return this.audit.append({
      ...record,
      kind: "SURVEILLANCE",
      finding: "TRANSFER_OUTSIDE_APPROVED_ROUTER",
      riskTier: record.route === "UNKNOWN" ? "HIGH" : "MEDIUM"
    });
  }
}

function validateRecord(record: ComplianceAuditRecord): void {
  if (!Number.isSafeInteger(record.timestamp) || record.timestamp <= 0) throw new Error("invalid audit timestamp");
  assertAddress(record.from, "record from");
  assertAddress(record.to, "record to");
  assertUintString(record.amount, "record amount", true);
  if (record.kind === "REJECTION") {
    if (!record.failedElement) throw new Error("failedElement is required");
    assertAddress(record.tokenIn, "record tokenIn");
    assertAddress(record.tokenOut, "record tokenOut");
    assertBytes32(record.reasonCode, "record reasonCode");
    for (const ref of record.attestedFactRefs) assertBytes32(ref, "attestedFactRef");
  } else {
    if (!record.finding) throw new Error("surveillance finding is required");
    assertAddress(record.token, "record token");
    assertBytes32(record.transactionHash, "record transactionHash");
  }
}
