import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHmac} from "node:crypto";
import {canonicalJson} from "../src/canonical";
import {createKycCommitmentsV2, loadLocalKycCommitmentsV2, validateLei} from "../src/kyc-hmac-v2";
import {KycEvidenceCoordinatorV2, InMemoryKycEvidenceStoreV2, kycEvidenceHashV2, validateKycEvidenceV2} from "../src/kyc-v2";
import {DemoKycProviderAdapterV2} from "../src/kyc-demo-v2";
import {runKycProviderConformanceV2} from "../src/kyc-conformance-v2";
import {HttpKycProviderAdapterV2} from "../examples/http-kyc-provider-adapter-v2";
import {ProviderKycAssessmentV2, ProviderKycRequestV2} from "../src/kyc-spi-v2";
import {Hex} from "../src/types";

const key = "ab".repeat(32);
const commitments = createKycCommitmentsV2(key);
const ref = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const request: ProviderKycRequestV2 = {subject: `0x${"11".repeat(20)}`, identity: commitments.hash("identity", "private-person-ref"), asset: `0x${"22".repeat(20)}`, requestRefHash: commitments.hash("assessment", "request")};
const provenance = {issuerId: ref(2), trustBasisHash: ref(3), issuedAt: 900, expiresAt: 2000, attestationType: "SOURCE_REATTEST" as const};
const demo = () => new DemoKycProviderAdapterV2({commitments, provenance, now: () => 1000, validitySeconds: 900, fixtures: [{subject: request.subject, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}}]});
const options = () => ({mode: "demo" as const, commitments, now: () => 1000, accept: async () => true, audit: async () => undefined});
const assessment = async (): Promise<ProviderKycAssessmentV2> => demo().assess(request);
const provider = (value: ProviderKycAssessmentV2) => ({metadata: demo().metadata, assess: async () => value});

async function success() {
  const result = await new KycEvidenceCoordinatorV2(demo(), new InMemoryKycEvidenceStoreV2(commitments), options()).refresh(request);
  if (!result.eligible) throw new Error(result.reason);
  assert.equal(result.eligible, true);
  return result.materialization;
}

test("v2 HMAC matches SHA-256 vector, canonical order and isolates key/input/domain", () => {
  const value = {b: 2, a: 1};
  const actual = commitments.hash("source", value);
  assert.equal(actual, `0x${createHmac("sha256", Buffer.from(key, "hex")).update(canonicalJson({domain: "corner-store/kyc/source/v2", value})).digest("hex")}`);
  assert.equal(actual, commitments.hash("source", {a: 1, b: 2}));
  assert.notEqual(actual, commitments.hash("assessment", value));
  assert.notEqual(actual, commitments.hash("source", {a: 2, b: 2}));
  assert.notEqual(actual, createKycCommitmentsV2("cd".repeat(32)).hash("source", value));
  assert.throws(() => commitments.hash("unknown" as never, value));
});

test("v2 requires exactly one local env/file key with no fallback or key disclosure", () => {
  for (const value of [undefined, "", "ab", "zz".repeat(32)]) assert.throws(() => createKycCommitmentsV2(value as string));
  assert.throws(() => loadLocalKycCommitmentsV2({env: {}}));
  assert.throws(() => loadLocalKycCommitmentsV2({env: {CORNER_STORE_KYC_HMAC_KEY: key, CORNER_STORE_KYC_HMAC_KEY_FILE: "/missing"}}));
  assert.throws(() => loadLocalKycCommitmentsV2({env: {CORNER_STORE_KYC_HMAC_KEY_FILE: "/missing"}}));
  assert.equal(JSON.stringify(commitments), "{}");
  const directory = mkdtempSync(join(tmpdir(), "kyc-v2-"));
  try {
    const path = join(directory, "key"); writeFileSync(path, `${key}\n`, {mode: 0o600});
    assert.equal(loadLocalKycCommitmentsV2({env: {CORNER_STORE_KYC_HMAC_KEY_FILE: path}}).hash("source", 1), commitments.hash("source", 1));
    assert.equal(loadLocalKycCommitmentsV2({env: {CORNER_STORE_KYC_HMAC_KEY: key}}).hash("source", 1), commitments.hash("source", 1));
  } finally { rmSync(directory, {recursive: true}); }
  assert.throws(() => new KycEvidenceCoordinatorV2(demo(), new InMemoryKycEvidenceStoreV2(commitments), {...options(), commitments: undefined as never}));
});

test("v2 LEI is optional and validates shape plus MOD-97-10", () => {
  validateLei(undefined); validateLei("5493001KJTIIGC8Y1R12");
  for (const lei of ["", "5493001KJTIIGC8Y1R1", "5493001KJTIIGC8Y1R123", "5493001kjtiigc8y1r12", "5493001KJTIIGC8Y1R13", "5493001KJTIIGC8Y1R1!", "5493001KJTIIGC8Y1RAB"]) assert.throws(() => validateLei(lei));
});

test("v2 evidence requires explicit operator acceptance and strict audit before publication", async () => {
  const store = new InMemoryKycEvidenceStoreV2(commitments);
  for (const accept of [undefined, async () => false, async () => {throw new Error("private-detail");}]) {
    const result = await new KycEvidenceCoordinatorV2(demo(), store, {...options(), accept: accept as never}).refresh(request);
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reason, "OPERATOR_NOT_ACCEPTED");
    assert.equal(await store.current({...request, providerId: demo().metadata.providerId}), undefined);
    assert.ok(!JSON.stringify(result).includes("private-detail"));
  }
  const result = await new KycEvidenceCoordinatorV2(demo(), store, {...options(), audit: async () => {throw new Error("audit-secret");}}).refresh(request);
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, "AUDIT_UNAVAILABLE");
  assert.equal(await store.current({...request, providerId: demo().metadata.providerId}), undefined);
});

test("v2 accepted snapshot round trips LEI and its keyed canonical commitment", async () => {
  const value = await assessment(); value.lei = "5493001KJTIIGC8Y1R12";
  const store = new InMemoryKycEvidenceStoreV2(commitments);
  const result = await new KycEvidenceCoordinatorV2(provider(value), store, options()).refresh(request);
  assert.ok(result.eligible);
  if (!result.eligible) return;
  const stored = await store.current({...request, providerId: value.providerId});
  assert.equal(stored?.lei, value.lei);
  assert.deepEqual(JSON.parse(JSON.stringify(stored)), result.materialization);
  assert.notEqual(result.materialization.evidenceHash, (await success()).evidenceHash);
  validateKycEvidenceV2(result.materialization, commitments);
  assert.equal(result.materialization.schemaVersion, 2);
  assert.equal(result.materialization.operatorAccepted, true);
});

test("v2 store replay, conflict, keyed revalidation and monotonic revocation", async () => {
  const store = new InMemoryKycEvidenceStoreV2(commitments);
  const snapshot = await success();
  assert.equal((await store.replaceCurrent(snapshot)).applied, true);
  assert.equal((await store.replaceCurrent(JSON.parse(JSON.stringify(snapshot)))).applied, false);
  const conflict = {...snapshot, lei: "5493001KJTIIGC8Y1R12"};
  conflict.evidenceHash = kycEvidenceHashV2(conflict, commitments);
  await assert.rejects(store.replaceCurrent(conflict));
  await assert.rejects(store.replaceCurrent({...snapshot, evidenceHash: ref(9)}));
  await assert.rejects(new InMemoryKycEvidenceStoreV2(createKycCommitmentsV2("cd".repeat(32))).replaceCurrent(snapshot));
  const revoked = {...snapshot, status: "REVOKED" as const, assessmentRefHash: ref(9), eligible: false, operatorAccepted: false};
  revoked.evidenceHash = kycEvidenceHashV2(revoked, commitments);
  await store.replaceCurrent(revoked);
  await assert.rejects(store.replaceCurrent({...snapshot, assessmentRefHash: ref(10), evidenceHash: kycEvidenceHashV2({...snapshot, assessmentRefHash: ref(10)}, commitments)}));
});

test("v2 coordinator rejects hostile store returns", async () => {
  const snapshot = await success();
  const store = {replaceCurrent: async () => ({stored: {...snapshot, evidenceHash: ref(9)}, applied: true}), current: async () => undefined};
  const result = await new KycEvidenceCoordinatorV2(demo(), store, options()).refresh(request);
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, "STORE_CONFLICT");
});

test("v2 rejects malformed provenance, PII, windows, unknown types and binding mismatch", async () => {
  const value = await assessment();
  for (const patch of [{issuerId: ref(0)}, {trustBasisHash: ref(0)}, {issuedAt: 1001}, {expiresAt: 999}, {attestationType: "UNKNOWN"}]) {
    const input = {...value, provenance: {...value.provenance, ...patch}} as ProviderKycAssessmentV2;
    const result = await new KycEvidenceCoordinatorV2(provider(input), new InMemoryKycEvidenceStoreV2(commitments), options()).refresh(request);
    assert.equal(result.eligible, false);
  }
  for (const patch of [{fullName: "secret-name"}, {lei: "bad"}, {identity: ref(0)}, {identity: ref(9)}, {observedAt: 1}, {validUntil: 1000}, {provenance: {...provenance, rawPayload: "secret"}}]) {
    const input = {...value, ...patch};
    const result = await new KycEvidenceCoordinatorV2(provider(input), new InMemoryKycEvidenceStoreV2(commitments), options()).refresh(request);
    assert.equal(result.eligible, false);
  }
});

test("v2 timeout abort, typed failures, revoked and sanctions evidence fail closed", async () => {
  let aborted = false;
  const hanging = {metadata: demo().metadata, assess: async (_: unknown, context?: {signal: AbortSignal}): Promise<ProviderKycAssessmentV2> => new Promise(() => {context?.signal.addEventListener("abort", () => {aborted = true;});})};
  const timeout = await new KycEvidenceCoordinatorV2(hanging, new InMemoryKycEvidenceStoreV2(commitments), {...options(), providerTimeoutMs: 5}).refresh(request);
  assert.equal(timeout.eligible, false); if (!timeout.eligible) assert.equal(timeout.reason, "PROVIDER_TIMEOUT");
  assert.equal(aborted, true);
  const value = await assessment();
  for (const input of [{...value, status: "REVOKED" as const}, {...value, facts: {...value.facts, sanctions: "HIT" as const}}, {...value, status: "INELIGIBLE" as const}, {...value, facts: {...value.facts, kyc: "NOT_VERIFIED" as const}}]) {
    const store = new InMemoryKycEvidenceStoreV2(commitments);
    const result = await new KycEvidenceCoordinatorV2(provider(input), store, options()).refresh(request);
    assert.equal(result.eligible, false);
    assert.equal((await store.current({...request, providerId: value.providerId}))?.eligible, false);
  }
});

test("v2 acceptance callback cannot mutate the assessed evidence", async () => {
  const result = await new KycEvidenceCoordinatorV2(demo(), new InMemoryKycEvidenceStoreV2(commitments), {...options(), accept: async (value: ProviderKycAssessmentV2) => {value.facts.kyc = "NOT_VERIFIED"; return true;}}).refresh(request);
  assert.ok(result.eligible);
  if (result.eligible) assert.equal(result.materialization.facts.kyc, "VERIFIED");
});

test("v2 demo conformance and v1/environment isolation", async () => {
  const fixture = {eligibleRequest: request, ineligibleRequest: {...request, subject: `0x${"33".repeat(20)}` as const}, commitments, provenance, now: () => 1000};
  const report = await runKycProviderConformanceV2(demo(), fixture);
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.throws(() => new KycEvidenceCoordinatorV2(demo(), new InMemoryKycEvidenceStoreV2(commitments), {...options(), mode: "production"}));
  assert.throws(() => new KycEvidenceCoordinatorV2({...demo(), metadata: {...demo().metadata, spiVersion: "1.0.0"}, assess: demo().assess.bind(demo())}, new InMemoryKycEvidenceStoreV2(commitments), options()));
});

test("v2 HTTP adapter commits source/assessment refs and omits raw evidence, LEI and key from audit", async () => {
  const body = {caseId: "private-case-123", reviewedAt: 1000, expiresAt: 1900, decision: "approved" as const, checks: {identity: "pass" as const, sanctions: "clear" as const}, wallet: request.subject, identityId: request.identity, asset: request.asset, fullName: "private-full-name", lei: "5493001KJTIIGC8Y1R12"};
  const http = new HttpKycProviderAdapterV2({providerId: "http-example", providerSchemaVersion: "example.v2", endpoint: "https://example.invalid/kyc", provenance}, {commitments, credential: async () => "private-credential", transport: async () => ({status: 200, json: async () => body})});
  const records: unknown[] = [];
  const result = await new KycEvidenceCoordinatorV2(http, new InMemoryKycEvidenceStoreV2(commitments), {...options(), mode: "production", audit: (event) => {records.push(event);}}).refresh(request);
  assert.ok(result.eligible);
  if (!result.eligible) return;
  const publicData = JSON.stringify({records, audit: result.audit, commitments});
  for (const secret of [key, body.caseId, body.fullName, body.lei, "private-credential"]) assert.ok(!publicData.includes(secret));
  assert.equal(result.materialization.lei, body.lei);
  assert.ok(!JSON.stringify(result.materialization).includes(body.caseId));
  const other = new HttpKycProviderAdapterV2({providerId: "http-example", providerSchemaVersion: "example.v2", endpoint: "https://example.invalid/kyc", provenance}, {commitments: createKycCommitmentsV2("cd".repeat(32)), credential: async () => "", transport: async () => ({status: 200, json: async () => body})});
  assert.notEqual((await http.assess(request)).sourceEvidenceHash, (await other.assess(request)).sourceEvidenceHash);
  assert.notEqual((await http.assess(request)).assessmentRefHash, (await other.assess(request)).assessmentRefHash);
});

test("v2 translator revalidates keyed evidence and emits only compact unsigned calldata", async () => {
  const snapshot = await success(); snapshot.lei = "5493001KJTIIGC8Y1R12";
  snapshot.evidenceHash = kycEvidenceHashV2(snapshot, commitments);
  const {identityEvidenceAcceptanceV2} = await import("../src/kyc-calldata-v2");
  const call = identityEvidenceAcceptanceV2(snapshot, commitments, 1000);
  assert.equal(call.functionName, "acceptEvidence");
  assert.equal(call.calldata.slice(0, 10), "0x9b3e5df6");
  assert.equal((call.calldata.length - 2) / 2, 292);
  assert.equal(call.evidence.identityId, request.identity);
  assert.equal(call.evidence.expiresAt, 1900);
  for (const privateValue of [key, snapshot.lei, "private-person-ref", "private-case-123"]) {
    assert.ok(!JSON.stringify(call).includes(privateValue));
    assert.ok(!call.calldata.includes(Buffer.from(privateValue).toString("hex")));
  }
  for (const invalid of [{...snapshot, evidenceHash: ref(9)}, {...snapshot, schemaVersion: 1}, {...snapshot, eligible: false}, {...snapshot, operatorAccepted: false}]) {
    assert.throws(() => identityEvidenceAcceptanceV2(invalid as never, commitments, 1000));
  }
  assert.throws(() => identityEvidenceAcceptanceV2(snapshot, commitments, 1900));
  assert.throws(() => identityEvidenceAcceptanceV2(snapshot, createKycCommitmentsV2("cd".repeat(32)), 1000));
});

test("v2 expiration during operator acceptance or audit never publishes eligible evidence", async () => {
  for (const stage of ["accept", "audit"] as const) {
    let now = 1000;
    const store = new InMemoryKycEvidenceStoreV2(commitments);
    const opts = {...options(), now: () => now, [stage]: async () => {now = 2001; return true;}};
    const result = await new KycEvidenceCoordinatorV2(demo(), store, opts).refresh(request);
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reason, "STALE_OR_FUTURE_ASSESSMENT");
    assert.equal(await store.current({...request, providerId: demo().metadata.providerId}), undefined);
  }
});

test("v2 strict audit cannot be disabled for accepted evidence", () => {
  assert.throws(() => new KycEvidenceCoordinatorV2(demo(), new InMemoryKycEvidenceStoreV2(commitments), {...options(), strictAudit: false}));
});

test("v2 public entry points are explicit and keep v1 exports and records separate", async () => {
  const root = require("@corner-store/compliance-data");
  const v2 = require("@corner-store/compliance-data/v2");
  const spi = require("@corner-store/compliance-data/spi");
  const spi2 = require("@corner-store/compliance-data/spi-v2");
  assert.equal(spi.KYC_PROVIDER_SPI_VERSION, "1.0.0");
  assert.equal(spi2.KYC_PROVIDER_SPI_VERSION_V2, "2.0.0");
  assert.equal(root.KycEvidenceCoordinatorV2, v2.KycEvidenceCoordinatorV2);
  assert.equal(root.KycEvidenceCoordinator === v2.KycEvidenceCoordinatorV2, false);
  assert.equal(root.DemoKycProviderAdapterV2, undefined);
  assert.equal(typeof require("@corner-store/compliance-data/demo-v2").DemoKycProviderAdapterV2, "function");
  assert.equal(typeof require("@corner-store/compliance-data/conformance-v2").runKycProviderConformanceV2, "function");
  const legacy = new root.InMemoryKycEvidenceStore();
  await assert.rejects(legacy.replaceCurrent(await success()));
  const v1 = {...await assessment(), identity: `0x${"44".repeat(20)}`};
  delete (v1 as Partial<ProviderKycAssessmentV2>).provenance;
  await assert.rejects(new InMemoryKycEvidenceStoreV2(commitments).replaceCurrent(v1 as never));
});

test("v2 typed failures and raw exceptions produce bounded public diagnostics", async () => {
  const {KycProviderError} = await import("../src/kyc-spi");
  for (const [error, reason] of [[new KycProviderError("TIMEOUT"), "PROVIDER_TIMEOUT"], [new KycProviderError("STALE"), "STALE_OR_FUTURE_ASSESSMENT"], [new KycProviderError("INCOMPATIBLE"), "PROVIDER_INCOMPATIBLE"], [new Error("raw-secret-payload"), "PROVIDER_UNAVAILABLE"]] as const) {
    const bad = {metadata: demo().metadata, assess: async (): Promise<ProviderKycAssessmentV2> => {throw error;}};
    const events: unknown[] = [];
    const result = await new KycEvidenceCoordinatorV2(bad, new InMemoryKycEvidenceStoreV2(commitments), {...options(), audit: (record) => {events.push(record);}, incident: (record) => {events.push(record);}}).refresh(request);
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reason, reason);
    assert.ok(!JSON.stringify({result, events}).includes("raw-secret-payload"));
  }
});

test("v2 HTTP conformance and mapping failures remain fail closed", async () => {
  const config = {providerId: "http-example", providerSchemaVersion: "example.v2", endpoint: "https://example.invalid/kyc", provenance};
  const http = new HttpKycProviderAdapterV2(config, {commitments, credential: async () => "", transport: async (_url, init) => {
    const sent = JSON.parse(init.body);
    return {status: 200, json: async () => ({caseId: "private-case", reviewedAt: 1000, expiresAt: 1900, decision: "approved", checks: {identity: sent.wallet === request.subject ? "pass" : "fail", sanctions: "clear"}, wallet: sent.wallet, identityId: sent.identityId, asset: sent.asset})};
  }});
  const report = await runKycProviderConformanceV2(http, {commitments, eligibleRequest: request, ineligibleRequest: {...request, subject: `0x${"33".repeat(20)}`}, now: () => 1000});
  assert.ok(report.passed, JSON.stringify(report));
  for (const [status, reason] of [[504, "PROVIDER_TIMEOUT"], [409, "PROVIDER_INCOMPATIBLE"], [500, "PROVIDER_UNAVAILABLE"], [200, "PROVIDER_INCOMPATIBLE"]] as const) {
    const bad = new HttpKycProviderAdapterV2(config, {commitments, credential: async () => "", transport: async () => ({status, json: async () => ({fullName: "raw-private"})})});
    const result = await new KycEvidenceCoordinatorV2(bad, new InMemoryKycEvidenceStoreV2(commitments), {...options(), mode: "production"}).refresh(request);
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.reason, reason);
    assert.ok(!JSON.stringify(result).includes("raw-private"));
  }
});

test("v2 same assessment can be refreshed under a new request reference without conflict", async () => {
  const store = new InMemoryKycEvidenceStoreV2(commitments);
  const coordinator = new KycEvidenceCoordinatorV2(demo(), store, options());
  const first = await coordinator.refresh(request);
  const second = await coordinator.refresh({...request, requestRefHash: ref(123)});
  assert.ok(first.eligible);
  assert.ok(second.eligible, JSON.stringify(second));
  if (first.eligible && second.eligible) assert.equal(first.materialization.evidenceHash, second.materialization.evidenceHash);
});

test("v2 metadata rejects inherited declarations", () => {
  const metadata = demo().metadata;
  const inherited = Object.assign(Object.create({privateField: "must-not-escape"}), metadata);
  assert.throws(() => new KycEvidenceCoordinatorV2({metadata: inherited, assess: demo().assess.bind(demo())}, new InMemoryKycEvidenceStoreV2(commitments), options()));
});

test("v2 provenance issued in the future fails even within observation clock skew", async () => {
  const value = await assessment();
  value.observedAt = 1001; value.provenance.issuedAt = 1001;
  const result = await new KycEvidenceCoordinatorV2(provider(value), new InMemoryKycEvidenceStoreV2(commitments), options()).refresh(request);
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, "STALE_OR_FUTURE_ASSESSMENT");
});
