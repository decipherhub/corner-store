import {mkdtempSync, readFileSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import {
  AcquisitionLot,
  AcquisitionResolver,
  HashChainAuditLog,
  InMemoryKycEvidenceStore,
  KycEvidenceCoordinator,
  kycEvidenceHash,
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

  const identity = "0x00000000000000000000000000000000000000d1" as const;
  const requestRefHash = `0x${"a".repeat(64)}` as const;
  const sourceEvidenceHash = `0x${"b".repeat(64)}` as const;
  const assessmentRefHash = `0x${"c".repeat(64)}` as const;
  const assessmentRefHash2 = `0x${"d".repeat(64)}` as const;
  const piiSentinel = "alice@example.test";
  const baseRequest = {subject: holder, identity, asset, requestRefHash};
  const baseAssessment = {
    providerId: "provider-a",
    providerSchemaVersion: "v1",
    assessmentRefHash,
    sourceEvidenceHash,
    subject: holder,
    identity,
    asset,
    facts: {kyc: "VERIFIED", sanctions: "CLEAR", accreditedInvestor: "VERIFIED", qualifiedPurchaser: "VERIFIED", jurisdiction: "US"},
    observedAt: 9_950,
    validUntil: 10_500,
    status: "ACTIVE"
  } as const;

  async function refreshWith(assessmentOrError: any, options: any = {}) {
    const store = options.store ?? new InMemoryKycEvidenceStore();
    const auditRecords: any[] = [];
    const incidentRecords: any[] = [];
    const provider = {
      async assess(_request: any, context?: {signal: AbortSignal}) {
        if (options.captureSignal) options.captureSignal(context?.signal);
        if (assessmentOrError instanceof Error) throw assessmentOrError;
        return typeof assessmentOrError === "function" ? assessmentOrError(context) : assessmentOrError;
      }
    };
    const coordinator = new KycEvidenceCoordinator(provider, store, {
      now: () => 10_000,
      audit: options.audit === undefined && options.noAudit ? undefined : options.audit ?? ((record: any) => { auditRecords.push(record); }),
      incident: options.incident ?? ((record: any) => { incidentRecords.push(record); }),
      freshnessSeconds: options.freshnessSeconds,
      providerTimeoutMs: options.providerTimeoutMs
    });
    const result = await coordinator.refresh(options.request ?? baseRequest);
    return {result, store, auditRecords, incidentRecords};
  }

  const ok = await refreshWith(baseAssessment);
  if (!ok.result.eligible || ok.result.materialization.providerId !== "provider-a") throw new Error("eligible provider-neutral KYC materialization rejected");
  if (ok.auditRecords.length !== 1 || ok.incidentRecords.length !== 0) throw new Error("eligible refresh audit/incident regression");
  const providerB = await refreshWith({...baseAssessment, providerId: "provider-b", assessmentRefHash: assessmentRefHash2});
  if (!providerB.result.eligible || providerB.result.materialization.providerId !== "provider-b") throw new Error("second provider ID was not neutral");

  const deterministicA = kycEvidenceHash(baseAssessment);
  const deterministicB = kycEvidenceHash({...baseAssessment});
  const deterministicChanged = kycEvidenceHash({...baseAssessment, facts: {...baseAssessment.facts, sanctions: "HIT"}} as any);
  if (deterministicA !== deterministicB || deterministicA === deterministicChanged) throw new Error("evidence hash determinism/change regression");

  const mismatch = await refreshWith({...baseAssessment, subject: other});
  if (mismatch.result.eligible || mismatch.result.reason !== "BINDING_MISMATCH") throw new Error("binding mismatch did not fail closed");
  const outage = await refreshWith(new Error(`provider outage for ${piiSentinel}`));
  if (outage.result.eligible || outage.result.reason !== "PROVIDER_UNAVAILABLE") throw new Error("provider outage did not fail closed");
  const malformed = await refreshWith({...baseAssessment, providerId: "Bad Provider"});
  if (malformed.result.eligible || malformed.result.reason !== "MALFORMED_PROVIDER_RESULT") throw new Error("malformed provider result did not fail closed");
  const missing = await refreshWith({...baseAssessment, facts: undefined} as any);
  if (missing.result.eligible || missing.result.reason !== "MALFORMED_PROVIDER_RESULT") throw new Error("missing provider facts did not fail closed");
  const stale = await refreshWith({...baseAssessment, observedAt: 9_000, validUntil: 20_000}, {freshnessSeconds: 100});
  if (stale.result.eligible || stale.result.reason !== "STALE_OR_FUTURE_ASSESSMENT") throw new Error("stale assessment did not fail closed");
  const future = await refreshWith({...baseAssessment, observedAt: 20_000, validUntil: 21_000});
  if (future.result.eligible || future.result.reason !== "STALE_OR_FUTURE_ASSESSMENT") throw new Error("future assessment did not fail closed");
  const revoked = await refreshWith({...baseAssessment, status: "REVOKED"});
  if (revoked.result.eligible || revoked.result.reason !== "REVOKED") throw new Error("revoked assessment did not fail closed");
  const ineligible = await refreshWith({...baseAssessment, status: "INELIGIBLE"});
  if (ineligible.result.eligible || ineligible.result.reason !== "INELIGIBLE") throw new Error("ineligible assessment did not fail closed");
  const sanctioned = await refreshWith({...baseAssessment, facts: {...baseAssessment.facts, sanctions: "HIT"}} as any);
  if (sanctioned.result.eligible || sanctioned.result.reason !== "SANCTIONS_HIT") throw new Error("sanctions hit did not fail closed");

  const replayStore = new InMemoryKycEvidenceStore();
  const replay1 = await refreshWith(baseAssessment, {store: replayStore});
  const replay2 = await refreshWith(baseAssessment, {store: replayStore});
  if (!replay1.result.eligible || !replay2.result.eligible || replay1.result.materialization.evidenceHash !== replay2.result.materialization.evidenceHash) {
    throw new Error("same evidence replay is not idempotent");
  }
  const conflict = await refreshWith({...baseAssessment, sourceEvidenceHash: `0x${"e".repeat(64)}` as const}, {store: replayStore});
  if (conflict.result.eligible || conflict.result.reason !== "STORE_CONFLICT") throw new Error("same assessmentRefHash with changed evidence did not conflict");

  const monotonicStore = new InMemoryKycEvidenceStore();
  await refreshWith({...baseAssessment, observedAt: 10_000, validUntil: 11_000, status: "REVOKED"}, {store: monotonicStore});
  const olderActive = await refreshWith({...baseAssessment, assessmentRefHash: assessmentRefHash2, observedAt: 9_999, validUntil: 11_000, status: "ACTIVE"}, {store: monotonicStore});
  if (olderActive.result.eligible || olderActive.result.reason !== "STORE_CONFLICT") throw new Error("older active overwrote revoked/newer evidence");
  const currentRevoked = await monotonicStore.current({providerId: "provider-a", subject: holder, identity, asset});
  if (!currentRevoked || currentRevoked.status !== "REVOKED") throw new Error("revoked snapshot was not retained as current");

  const piiResult = await refreshWith({...baseAssessment, email: piiSentinel} as any);
  const piiSerialized = JSON.stringify({result: piiResult.result, audit: piiResult.auditRecords, incidents: piiResult.incidentRecords});
  if (piiSerialized.includes(piiSentinel) || piiSerialized.includes("email")) throw new Error("raw PII leaked through KYC failure path");


  const strictNoAudit = await refreshWith(baseAssessment, {noAudit: true});
  if (strictNoAudit.result.eligible || strictNoAudit.result.reason !== "AUDIT_UNAVAILABLE") throw new Error("missing strict audit sink did not fail closed");
  if (await strictNoAudit.store.current({providerId: "provider-a", subject: holder, identity, asset})) throw new Error("strict audit unavailable published eligible snapshot");

  const auditFailStore = new InMemoryKycEvidenceStore();
  const auditFail = await refreshWith(baseAssessment, {store: auditFailStore, audit: () => { throw new Error(`audit down ${piiSentinel}`); }});
  if (auditFail.result.eligible || auditFail.result.reason !== "AUDIT_UNAVAILABLE") throw new Error("strict audit failure did not fail closed");
  if (await auditFailStore.current({providerId: "provider-a", subject: holder, identity, asset})) throw new Error("strict audit failure published eligible snapshot");

  const invalidRequest = await refreshWith(baseAssessment, {request: {...baseRequest, subject: "not-address", email: piiSentinel} as any});
  const invalidSerialized = JSON.stringify({result: invalidRequest.result, audit: invalidRequest.auditRecords, incidents: invalidRequest.incidentRecords});
  if (invalidRequest.result.eligible || invalidRequest.result.reason !== "MALFORMED_PROVIDER_RESULT" || invalidSerialized.includes("not-address") || invalidSerialized.includes(piiSentinel) || invalidSerialized.includes("email")) {
    throw new Error("invalid/PII-bearing request did not fail closed safely");
  }

  let aborted = false;
  const timeout = await refreshWith(() => new Promise(() => undefined), {
    providerTimeoutMs: 25,
    captureSignal(signal: AbortSignal | undefined) { if (signal) signal.addEventListener("abort", () => { aborted = true; }); }
  });
  if (timeout.result.eligible || timeout.result.reason !== "PROVIDER_UNAVAILABLE" || !aborted) throw new Error("provider timeout did not fail closed and abort");

  const extraTop = await refreshWith({...baseAssessment, extra: "ignored?"} as any);
  if (extraTop.result.eligible || extraTop.result.reason !== "MALFORMED_PROVIDER_RESULT") throw new Error("unknown top-level assessment key was accepted");
  const nestedPii = await refreshWith({...baseAssessment, facts: {...baseAssessment.facts, rawPayload: {email: piiSentinel}}} as any);
  const nestedSerialized = JSON.stringify({result: nestedPii.result, audit: nestedPii.auditRecords, incidents: nestedPii.incidentRecords});
  if (nestedPii.result.eligible || nestedPii.result.reason !== "MALFORMED_PROVIDER_RESULT" || nestedSerialized.includes(piiSentinel)) throw new Error("nested PII was accepted or leaked");
  const unknownNested = await refreshWith({...baseAssessment, facts: {...baseAssessment.facts, nested: {ok: true}}} as any);
  if (unknownNested.result.eligible || unknownNested.result.reason !== "MALFORMED_PROVIDER_RESULT") throw new Error("unknown nested object was accepted");

  const mismatchingStore = {
    async replaceCurrent(snapshot: any) {
      return {stored: {...snapshot, providerSchemaVersion: "v2"}, applied: true};
    },
    async current() { return undefined; }
  };
  const storeMismatch = await refreshWith(baseAssessment, {store: mismatchingStore});
  if (storeMismatch.result.eligible || storeMismatch.result.reason !== "STORE_CONFLICT") throw new Error("coordinator accepted mismatching production store return");

  const equalRankDifferentStore = new InMemoryKycEvidenceStore();
  await refreshWith(baseAssessment, {store: equalRankDifferentStore});
  const sameRankDifferent = await refreshWith({...baseAssessment, assessmentRefHash: assessmentRefHash2, sourceEvidenceHash: `0x${"f".repeat(64)}` as const}, {store: equalRankDifferentStore});
  if (sameRankDifferent.result.eligible || sameRankDifferent.result.reason !== "STORE_CONFLICT") throw new Error("same observedAt/rank different evidence replaced current snapshot");

  const incidentFail = await refreshWith(new Error("provider down"), {incident: () => { throw new Error("incident down"); }});
  if (incidentFail.result.eligible || incidentFail.result.reason !== "PROVIDER_UNAVAILABLE") throw new Error("incident hook failure was not bounded");

  const noCacheStore = new InMemoryKycEvidenceStore();
  const cachedSuccess = await refreshWith(baseAssessment, {store: noCacheStore});
  const outageAfterSuccess = await refreshWith(new Error("provider down"), {store: noCacheStore});
  if (!cachedSuccess.result.eligible || outageAfterSuccess.result.eligible || outageAfterSuccess.result.reason !== "PROVIDER_UNAVAILABLE") {
    throw new Error("cached last-good evidence hid provider outage");
  }

  console.log("corner-store compliance data smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
