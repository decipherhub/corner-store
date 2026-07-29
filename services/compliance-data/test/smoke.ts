import {mkdtempSync, readFileSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {
  AcquisitionLot,
  AcquisitionResolver,
  HashChainAuditLog,
  PersonGroupLedger,
  RejectionRecord,
  TransferAgentProvider,
  TransferSurveillance
} from "../src";

const holder = "0x00000000000000000000000000000000000000a1" as const;
const asset = "0x00000000000000000000000000000000000000b1" as const;
const other = "0x00000000000000000000000000000000000000c1" as const;
const tx1 = `0x${"1".repeat(64)}` as const;
const tx2 = `0x${"2".repeat(64)}` as const;
const tx3 = `0x${"3".repeat(64)}` as const;
const tx4 = `0x${"4".repeat(64)}` as const;

async function main(): Promise<void> {
  const lots: AcquisitionLot[] = [
    {lotId: "primary", holder, asset, quantity: "100", acquisitionDate: 100, paymentCompleteAt: 120, sourceType: "PRIMARY"},
    {lotId: "dividend", holder, asset, quantity: "1", acquisitionDate: 200, paymentCompleteAt: 200, sourceType: "DIVIDEND", lineageRef: "primary"},
    {lotId: "new", holder, asset, quantity: "5", acquisitionDate: 300, paymentCompleteAt: 320, sourceType: "SECONDARY"}
  ];
  const provider: TransferAgentProvider = {async lots() { return lots; }};
  const snapshot = await new AcquisitionResolver(provider, 60).compile(holder, asset, 1_000);
  if (snapshot.status !== "VALID" || snapshot.clockStart !== 320 || snapshot.expiresAt !== 1_060) {
    throw new Error("conservative acquisition snapshot regression");
  }

  const brokenProvider: TransferAgentProvider = {async lots() { return [{...lots[1], lineageRef: "missing"}]; }};
  const broken = await new AcquisitionResolver(brokenProvider).compile(holder, asset, 1_000);
  if (broken.status !== "LINEAGE_BROKEN") throw new Error("broken lineage must fail closed");

  const cyclicProvider: TransferAgentProvider = {
    async lots() {
      return [
        {...lots[1], lotId: "gift-a", sourceType: "GIFT", lineageRef: "trust-b"},
        {...lots[1], lotId: "trust-b", sourceType: "TRUST", lineageRef: "gift-a"}
      ];
    }
  };
  const cyclic = await new AcquisitionResolver(cyclicProvider).compile(holder, asset, 1_000);
  if (cyclic.status !== "LINEAGE_BROKEN" || cyclic.clockStart !== 0) {
    throw new Error("cyclic lineage must fail closed");
  }

  const secondaryWithLineage: TransferAgentProvider = {
    async lots() {
      return [lots[0], {...lots[2], lineageRef: "primary"}];
    }
  };
  try {
    await new AcquisitionResolver(secondaryWithLineage).compile(holder, asset, 1_000);
    throw new Error("secondary acquisition inherited an older lineage clock");
  } catch (error: any) {
    if (!error.message.includes("secondary lot new cannot inherit lineage")) throw error;
  }

  const dir = mkdtempSync(join(tmpdir(), "corner-store-compliance-data-"));
  const auditPath = join(dir, "audit.jsonl");
  const audit = new HashChainAuditLog(auditPath);
  const rejection: RejectionRecord = {
    kind: "REJECTION",
    timestamp: 1_000,
    attemptTxRef: "simulation:1",
    from: holder,
    to: other,
    tokenIn: other,
    tokenOut: asset,
    amount: "10",
    direction: "BUY",
    failedElement: "C-01-v1",
    reasonCode: tx1,
    attestedFactRefs: [],
    reliedExemption: "RULE_144",
    riskTier: "LOW"
  };
  audit.append(rejection);
  const surveillance = new TransferSurveillance(audit);
  surveillance.observe({timestamp: 1_001, transactionHash: tx2, token: asset, from: holder, to: other, amount: "1", route: "DIRECT_TRANSFER"});
  surveillance.observe({timestamp: 1_002, transactionHash: tx1, token: asset, from: holder, to: other, amount: "1", route: "APPROVED_ROUTER"});
  if (new HashChainAuditLog(auditPath).list().length !== 2) throw new Error("audit persistence regression");

  const tampered = readFileSync(auditPath, "utf8").replace('"amount":"10"', '"amount":"11"');
  writeFileSync(auditPath, tampered);
  try {
    new HashChainAuditLog(auditPath);
    throw new Error("tampered audit chain accepted");
  } catch (error: any) {
    if (!error.message.includes("hash chain invalid")) throw error;
  }

  const ledger = new PersonGroupLedger();
  const first = ledger.commit({
    executionId: tx1,
    sellerGroupId: "group-a",
    timestamp: Date.UTC(2026, 3, 30) / 1_000,
    amount: "25",
    holderUpdates: [{groupId: "group-b", isHolder: true, isAccredited: false, isUsResident: true}]
  });
  if (!first.applied) throw new Error("first ledger commit not applied");
  const replay = ledger.commit({
    executionId: tx1,
    sellerGroupId: "group-a",
    timestamp: Date.UTC(2026, 3, 30) / 1_000,
    amount: "25",
    holderUpdates: [{groupId: "group-b", isHolder: true, isAccredited: false, isUsResident: true}]
  });
  if (replay.applied) throw new Error("idempotent replay applied twice");
  try {
    ledger.commit({executionId: tx1, sellerGroupId: "group-a", timestamp: Date.UTC(2026, 3, 30) / 1_000, amount: "26"});
    throw new Error("conflicting replay accepted");
  } catch (error: any) {
    if (!error.message.includes("conflicting commit replay")) throw error;
  }
  if (ledger.rollingThreeCalendarMonthVolume("group-a", Date.UTC(2026, 6, 30) / 1_000) !== 25n) {
    throw new Error("rolling volume regression");
  }
  const counts = ledger.holderCounts();
  if (counts.total !== 1 || counts.nonAccredited !== 1 || counts.usResident !== 1) {
    throw new Error("holder counts regression");
  }
  ledger.commit({
    executionId: tx3,
    sellerGroupId: "group-a",
    timestamp: Date.UTC(2026, 4, 1) / 1_000,
    amount: "1",
    holderUpdates: [{groupId: "group-b", isHolder: true, isAccredited: true, isUsResident: false}]
  });
  const updatedCounts = ledger.holderCounts();
  if (updatedCounts.total !== 1 || updatedCounts.nonAccredited !== 0 || updatedCounts.usResident !== 0) {
    throw new Error("holder attribute update regression");
  }
  ledger.commit({
    executionId: tx4,
    sellerGroupId: "group-a",
    timestamp: Date.UTC(2026, 4, 2) / 1_000,
    amount: "1",
    holderUpdates: [{groupId: "group-b", isHolder: false, isAccredited: true, isUsResident: false}]
  });
  if (ledger.holderCounts().total !== 0) throw new Error("holder deactivation regression");
  console.log("corner-store compliance data smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
