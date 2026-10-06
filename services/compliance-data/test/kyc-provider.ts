import {readdirSync, readFileSync} from "fs";
import {builtinModules} from "module";
import {join} from "path";
import {preProcessFile} from "typescript";
import {HttpKycProviderAdapter, HttpKycProviderDeps} from "../examples/http-kyc-provider-adapter";
import {
  InMemoryKycEvidenceStore,
  isKycProviderError,
  KYC_PROVIDER_ID_RE,
  KYC_PROVIDER_SCHEMA_VERSION_RE,
  KYC_PROVIDER_SPI_VERSION,
  KycAuditRecord,
  KycEvidenceCoordinator,
  KycProviderEnvironment,
  KycProviderError,
  KycProviderMetadata,
  ProviderKycAdapter,
  ProviderKycAdapterContext,
  ProviderKycAssessment,
  ProviderKycRequest,
  validateKycProviderMetadata
} from "../src";
import {runKycProviderConformance} from "../src/kyc-conformance";
import {DEMO_KYC_PROVIDER_ID, DEMO_KYC_PROVIDER_SCHEMA_VERSION, DemoKycFixture, DemoKycProviderAdapter} from "../src/kyc-demo";

const subject = "0x00000000000000000000000000000000000000a1" as const;
const sanctionedSubject = "0x00000000000000000000000000000000000000a2" as const;
const revokedSubject = "0x00000000000000000000000000000000000000a3" as const;
const unknownSubject = "0x00000000000000000000000000000000000000a4" as const;
const identity = "0x00000000000000000000000000000000000000d1" as const;
const asset = "0x00000000000000000000000000000000000000b1" as const;
const requestRefHash = `0x${"a".repeat(64)}` as const;
const piiSentinel = "alice@example.test";
const credentialSentinel = "credential-sentinel-5f2c";
const fullNameSentinel = "Alice Sentinel Holder";
const caseSentinel = "vendor-case-sentinel";
const endpoint = "https://kyc.vendor.example/v3/assessments";
const allCapabilities = ["kyc", "sanctions", "accreditedInvestor", "qualifiedPurchaser", "jurisdiction"] as const;
const productionMetadata = {
  spiVersion: KYC_PROVIDER_SPI_VERSION,
  providerId: "provider-a",
  providerSchemaVersions: ["v1"],
  capabilities: allCapabilities,
  environment: "production"
} as const;
const now = () => 10_000;

function request(forSubject: `0x${string}` = subject): ProviderKycRequest {
  return {subject: forSubject, identity, asset, requestRefHash};
}

function assessmentFor(input: ProviderKycRequest, overrides: Partial<ProviderKycAssessment> = {}): ProviderKycAssessment {
  return {
    providerId: "provider-a",
    providerSchemaVersion: "v1",
    assessmentRefHash: `0x${"c".repeat(64)}`,
    sourceEvidenceHash: `0x${"b".repeat(64)}`,
    subject: input.subject,
    identity: input.identity,
    asset: input.asset,
    facts: {kyc: "VERIFIED", sanctions: "CLEAR"},
    observedAt: 9_950,
    validUntil: 10_500,
    status: "ACTIVE",
    ...overrides
  };
}

function staticAdapter(
  result: (input: ProviderKycRequest, context?: ProviderKycAdapterContext) => ProviderKycAssessment | Promise<ProviderKycAssessment>,
  metadata: unknown = productionMetadata
): ProviderKycAdapter {
  return {metadata: metadata as KycProviderMetadata, async assess(input, context) {
    if (context?.signal?.aborted) throw new KycProviderError("UNAVAILABLE");
    return result(input, context);
  }};
}

async function refresh(adapter: ProviderKycAdapter, options: {mode?: KycProviderEnvironment; request?: ProviderKycRequest; providerTimeoutMs?: number} = {}) {
  const store = new InMemoryKycEvidenceStore();
  const audit: KycAuditRecord[] = [];
  const incidents: unknown[] = [];
  const coordinator = new KycEvidenceCoordinator(adapter, store, {
    mode: options.mode ?? "production",
    now,
    providerTimeoutMs: options.providerTimeoutMs,
    audit: (record) => { audit.push(record); },
    incident: (record) => { incidents.push(record); }
  });
  const result = await coordinator.refresh(options.request ?? request());
  return {result, store, audit, serialized: JSON.stringify({result, audit, incidents})};
}

function expectThrow(run: () => unknown, label: string, message?: string): Error {
  try {
    run();
  } catch (error: any) {
    if (message !== undefined && error?.message !== message) throw new Error(`${label}: unexpected error ${error?.message}`);
    return error;
  }
  throw new Error(`${label}: expected a throw`);
}

function vendorBody(body: any, overrides: Record<string, unknown> = {}) {
  const sanctioned = body.wallet === sanctionedSubject;
  return {
    caseId: `${caseSentinel}-${body.wallet.slice(-2)}`,
    reviewedAt: 9_990,
    expiresAt: 20_000,
    decision: "approved",
    checks: {identity: "pass", sanctions: sanctioned ? "match" : "clear", accredited: "pass"},
    wallet: body.wallet,
    onchainId: body.onchainId,
    asset: body.asset,
    fullName: fullNameSentinel,
    ...overrides
  };
}

type TransportInit = Parameters<HttpKycProviderDeps["transport"]>[1];

function httpAdapter(respond: (body: any, init: TransportInit) => Promise<{status: number; json(): Promise<unknown>}>, calls: {url: string; init: TransportInit}[] = []) {
  return new HttpKycProviderAdapter(
    {providerId: "vendor-x", providerSchemaVersion: "vendor-x.kyc.v3", endpoint},
    {
      transport: async (url, init) => {
        if (init.signal?.aborted) throw new Error("aborted");
        calls.push({url, init});
        return respond(JSON.parse(init.body), init);
      },
      credential: async () => credentialSentinel
    }
  );
}

function jsonResponse(status: number, body: (request: any) => unknown) {
  return async (request: any) => ({status, async json() { return body(request); }});
}

async function main(): Promise<void> {
  if (!Object.isFrozen(KYC_PROVIDER_ID_RE) || !Object.isFrozen(KYC_PROVIDER_SCHEMA_VERSION_RE)) throw new Error("exported SPI validation patterns are mutable");
  const validated = validateKycProviderMetadata(productionMetadata);
  if (!Object.isFrozen(validated) || !Object.isFrozen(validated.providerSchemaVersions) || !Object.isFrozen(validated.capabilities) || (validated as unknown) === productionMetadata) {
    throw new Error("validated metadata is not a frozen copy");
  }
  if (JSON.stringify(validated) !== JSON.stringify(productionMetadata)) throw new Error("validated metadata changed declared values");
  if (validateKycProviderMetadata({...productionMetadata, spiVersion: "1.0.9", capabilities: ["kyc", "sanctions"]}).spiVersion !== "1.0.9") {
    throw new Error("same-major patch SPI version was refused");
  }
  const {environment: _environment, ...missingEnvironment} = productionMetadata;
  const invalidMetadata: [string, unknown][] = [
    ["null", null],
    ["array", []],
    ["inherited prototype", Object.assign(Object.create({inherited: true}), productionMetadata)],
    ["unknown key", {...productionMetadata, extra: piiSentinel}],
    ["missing key", missingEnvironment],
    ["non-string SemVer", {...productionMetadata, spiVersion: 1}],
    ["bad SemVer", {...productionMetadata, spiVersion: "1.0"}],
    ["leading-zero SemVer", {...productionMetadata, spiVersion: "1.00.0"}],
    ["prerelease SemVer", {...productionMetadata, spiVersion: "1.0.0-rc.1"}],
    ["build SemVer", {...productionMetadata, spiVersion: "1.0.0+build.1"}],
    ["other major", {...productionMetadata, spiVersion: "2.0.0"}],
    ["older major", {...productionMetadata, spiVersion: "0.9.0"}],
    ["higher minor", {...productionMetadata, spiVersion: "1.1.0"}],
    ["bad slug", {...productionMetadata, providerId: piiSentinel}],
    ["non-array schema versions", {...productionMetadata, providerSchemaVersions: "v1"}],
    ["empty schema versions", {...productionMetadata, providerSchemaVersions: []}],
    ["duplicate schema versions", {...productionMetadata, providerSchemaVersions: ["v1", "v1"]}],
    ["over-16 schema versions", {...productionMetadata, providerSchemaVersions: Array.from({length: 17}, (_, index) => `v${index}`)}],
    ["bad schema version", {...productionMetadata, providerSchemaVersions: ["v1", piiSentinel]}],
    ["unknown capability", {...productionMetadata, capabilities: [...allCapabilities, "pep"]}],
    ["duplicate capability", {...productionMetadata, capabilities: ["kyc", "sanctions", "kyc"]}],
    ["missing kyc capability", {...productionMetadata, capabilities: ["sanctions", "jurisdiction"]}],
    ["missing sanctions capability", {...productionMetadata, capabilities: ["kyc"]}],
    ["bad environment", {...productionMetadata, environment: "staging"}],
    ["throwing field getter", {...productionMetadata, get providerId(): string { throw new Error(piiSentinel); }}]
  ];
  for (const [label, metadata] of invalidMetadata) {
    const error = expectThrow(() => validateKycProviderMetadata(metadata), `metadata ${label}`);
    if (!(error instanceof Error) || [piiSentinel, "staging", "pep", "rc.1"].some((value) => error.message.includes(value))) {
      throw new Error(`metadata ${label} error echoed input`);
    }
  }

  const demoFixtures: DemoKycFixture[] = [
    {subject, facts: {kyc: "VERIFIED", sanctions: "CLEAR", accreditedInvestor: "VERIFIED", jurisdiction: "US"}},
    {subject: sanctionedSubject, facts: {kyc: "VERIFIED", sanctions: "HIT"}},
    {subject: revokedSubject, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}, status: "REVOKED"}
  ];
  const demo = new DemoKycProviderAdapter({fixtures: demoFixtures, now});
  const production = staticAdapter((input) => assessmentFor(input));
  const startupStore = new InMemoryKycEvidenceStore();
  expectThrow(() => new KycEvidenceCoordinator(demo, startupStore, {mode: "production"}), "production mode with demo adapter", "production mode refuses a non-production KYC provider adapter");
  new KycEvidenceCoordinator(production, startupStore, {mode: "production"});
  new KycEvidenceCoordinator(demo, startupStore, {mode: "demo"});
  new KycEvidenceCoordinator(production, startupStore, {mode: "demo"});
  expectThrow(() => new KycEvidenceCoordinator(production, startupStore, {} as any), "missing mode");
  expectThrow(() => new KycEvidenceCoordinator(production, startupStore, undefined as any), "missing options");
  expectThrow(() => new KycEvidenceCoordinator(production, startupStore, {mode: "staging"} as any), "unknown mode");
  expectThrow(() => new KycEvidenceCoordinator({assess: production.assess} as any, startupStore, {mode: "demo"}), "pre-SPI adapter without metadata");
  expectThrow(() => new KycEvidenceCoordinator(staticAdapter((input) => assessmentFor(input), {...productionMetadata, spiVersion: "2.0.0"}), startupStore, {mode: "demo"}), "other SPI major");
  const getterError = expectThrow(
    () => new KycEvidenceCoordinator({get metadata(): KycProviderMetadata { throw new Error(piiSentinel); }, assess: production.assess}, startupStore, {mode: "demo"}),
    "throwing metadata getter"
  );
  if (getterError.message.includes(piiSentinel)) throw new Error("metadata getter error leaked into startup error");

  const mutableMetadata: any = {...productionMetadata, providerSchemaVersions: ["v1"], capabilities: ["kyc", "sanctions"]};
  let returned: Partial<ProviderKycAssessment> = {};
  const mutableAdapter: any = {metadata: mutableMetadata, async assess(input: ProviderKycRequest) { return assessmentFor(input, returned); }};
  const pinned = new KycEvidenceCoordinator(mutableAdapter, new InMemoryKycEvidenceStore(), {mode: "production", now, audit: () => undefined});
  mutableMetadata.environment = "demo";
  mutableMetadata.providerId = "provider-z";
  mutableMetadata.providerSchemaVersions.push("v2");
  mutableMetadata.capabilities.push("jurisdiction");
  mutableAdapter.metadata = {...productionMetadata, providerId: "provider-z", environment: "demo"};
  const pinnedResult = await pinned.refresh(request());
  if (!pinnedResult.eligible || pinnedResult.materialization.providerId !== "provider-a") throw new Error("metadata mutation changed the coordinator's accepted provider");
  for (const overrides of [{providerId: "provider-z"}, {providerSchemaVersion: "v2"}, {facts: {kyc: "VERIFIED", sanctions: "CLEAR", jurisdiction: "US"}}] as Partial<ProviderKycAssessment>[]) {
    returned = overrides;
    const mutated = await pinned.refresh(request());
    if (mutated.eligible || mutated.reason !== "PROVIDER_INCOMPATIBLE") throw new Error("metadata mutation widened the coordinator's accepted output");
  }

  const typedCases = [
    ["UNAVAILABLE", "PROVIDER_UNAVAILABLE"],
    ["TIMEOUT", "PROVIDER_TIMEOUT"],
    ["STALE", "STALE_OR_FUTURE_ASSESSMENT"],
    ["INCOMPATIBLE", "PROVIDER_INCOMPATIBLE"]
  ] as const;
  for (const [code, reason] of typedCases) {
    const error = new KycProviderError(code);
    if (!(error instanceof Error) || error.name !== "KycProviderError" || error.code !== code || error.message !== code || !isKycProviderError(error)) {
      throw new Error(`KycProviderError ${code} shape regression`);
    }
    const typed = await refresh(staticAdapter(() => { throw error; }));
    if (typed.result.eligible || typed.result.reason !== reason) throw new Error(`KycProviderError ${code} did not map to ${reason}`);
    const lookAlike = Object.assign(new Error(piiSentinel), {name: "KycProviderError", code});
    if (!isKycProviderError(lookAlike) || !isKycProviderError({name: "KycProviderError", code})) throw new Error(`look-alike ${code} error was not recognized`);
    const foreign = await refresh(staticAdapter(() => { throw lookAlike; }));
    if (foreign.result.eligible || foreign.result.reason !== reason || foreign.serialized.includes(piiSentinel)) throw new Error(`look-alike ${code} error did not map safely`);
  }
  const unknownCodeError = expectThrow(() => new KycProviderError(piiSentinel as any), "unknown KycProviderError code");
  if (unknownCodeError.message.includes(piiSentinel)) throw new Error("unknown code rejection echoed input");
  if ((new (KycProviderError as any)("TIMEOUT", piiSentinel) as Error).message !== "TIMEOUT") throw new Error("KycProviderError accepted free text");
  const hostileCode = {name: "KycProviderError", get code(): string { throw new Error(piiSentinel); }};
  for (const value of [{name: "KycProviderError", code: "OTHER"}, new Error("TIMEOUT"), {code: "TIMEOUT"}, null, "TIMEOUT", hostileCode]) {
    if (isKycProviderError(value)) throw new Error("structural KycProviderError check accepted an unknown shape");
  }
  for (const thrown of [{name: "KycProviderError", code: "OTHER"}, hostileCode, new Error(`TIMEOUT ${piiSentinel}`)]) {
    const generic = await refresh(staticAdapter(() => { throw thrown; }));
    if (generic.result.eligible || generic.result.reason !== "PROVIDER_UNAVAILABLE" || generic.serialized.includes(piiSentinel)) throw new Error("untyped provider error did not stay PROVIDER_UNAVAILABLE");
  }
  let aborted = false;
  const timeout = await refresh(staticAdapter((_input, context) => {
    context?.signal.addEventListener("abort", () => { aborted = true; });
    return new Promise<never>(() => undefined);
  }), {providerTimeoutMs: 25});
  if (timeout.result.eligible || timeout.result.reason !== "PROVIDER_TIMEOUT" || !aborted) throw new Error("coordinator timeout did not map to PROVIDER_TIMEOUT and abort");

  const incompatibleCases: [string, Partial<ProviderKycAssessment>, unknown][] = [
    ["wrong providerId", {providerId: "provider-b"}, productionMetadata],
    ["wrong providerId before binding", {providerId: "provider-b", subject: unknownSubject}, productionMetadata],
    ["undeclared schema version", {providerSchemaVersion: "v2"}, productionMetadata],
    ["undeclared accreditedInvestor", {facts: {kyc: "VERIFIED", sanctions: "CLEAR", accreditedInvestor: "VERIFIED"}}, {...productionMetadata, capabilities: ["kyc", "sanctions"]}],
    ["undeclared qualifiedPurchaser", {facts: {kyc: "VERIFIED", sanctions: "CLEAR", qualifiedPurchaser: "NOT_VERIFIED"}}, {...productionMetadata, capabilities: ["kyc", "sanctions", "accreditedInvestor"]}],
    ["undeclared jurisdiction", {facts: {kyc: "VERIFIED", sanctions: "CLEAR", jurisdiction: "US"}}, {...productionMetadata, capabilities: ["kyc", "sanctions", "qualifiedPurchaser"]}]
  ];
  for (const [label, overrides, metadata] of incompatibleCases) {
    const incompatible = await refresh(staticAdapter((input) => assessmentFor(input, overrides), metadata));
    if (incompatible.result.eligible || incompatible.result.reason !== "PROVIDER_INCOMPATIBLE" || incompatible.result.audit.assessmentRefHash === undefined) {
      throw new Error(`${label} was not PROVIDER_INCOMPATIBLE`);
    }
    for (const providerId of ["provider-a", "provider-b"]) {
      if (await incompatible.store.current({providerId, subject, identity, asset})) throw new Error(`${label} published evidence`);
    }
  }
  const undefinedOptional = await refresh(staticAdapter(
    (input) => assessmentFor(input, {facts: {kyc: "VERIFIED", sanctions: "CLEAR", accreditedInvestor: undefined}}),
    {...productionMetadata, capabilities: ["kyc", "sanctions"]}
  ));
  if (!undefinedOptional.result.eligible) throw new Error("undefined optional fact was treated as undeclared output");

  if (demo.metadata.environment !== "demo" || demo.metadata.providerId !== DEMO_KYC_PROVIDER_ID || demo.metadata.spiVersion !== KYC_PROVIDER_SPI_VERSION ||
    demo.metadata.providerSchemaVersions.join() !== DEMO_KYC_PROVIDER_SCHEMA_VERSION || demo.metadata.capabilities.join() !== allCapabilities.join() || !Object.isFrozen(demo.metadata)) {
    throw new Error("demo adapter metadata regression");
  }
  validateKycProviderMetadata(demo.metadata);
  const demoFirst = await refresh(demo, {mode: "demo"});
  const demoSecond = await refresh(new DemoKycProviderAdapter({fixtures: demoFixtures, now}), {mode: "demo"});
  const demoLater = await refresh(new DemoKycProviderAdapter({fixtures: demoFixtures, now: () => 10_001}), {mode: "demo"});
  if (!demoFirst.result.eligible || !demoSecond.result.eligible || !demoLater.result.eligible ||
    demoFirst.result.materialization.evidenceHash !== demoSecond.result.materialization.evidenceHash ||
    demoFirst.result.materialization.evidenceHash === demoLater.result.materialization.evidenceHash) {
    throw new Error("demo adapter is not deterministic for the same clock");
  }
  if (JSON.stringify(await demo.assess(request())) !== JSON.stringify(await demo.assess(request()))) throw new Error("demo assessment is not deterministic");
  const upperSubject = `0x${subject.slice(2).toUpperCase()}` as const;
  if ((await demo.assess(request(upperSubject))).facts.kyc !== "VERIFIED") throw new Error("demo fixture lookup is case-sensitive");
  const demoCases = [[unknownSubject, "KYC_NOT_VERIFIED"], [sanctionedSubject, "SANCTIONS_HIT"], [revokedSubject, "REVOKED"]] as const;
  for (const [demoSubject, reason] of demoCases) {
    const outcome = await refresh(demo, {mode: "demo", request: request(demoSubject)});
    if (outcome.result.eligible || outcome.result.reason !== reason) throw new Error(`demo ${reason} fixture regression`);
  }
  const controller = new AbortController();
  controller.abort();
  try {
    await demo.assess(request(), {signal: controller.signal});
    throw new Error("aborted demo assessment resolved");
  } catch (error) {
    if (!isKycProviderError(error) || error.code !== "UNAVAILABLE") throw error;
  }
  const mutableFixture: DemoKycFixture = {subject, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}};
  const copiedFixtures = new DemoKycProviderAdapter({fixtures: [mutableFixture], now});
  (mutableFixture.facts as any).sanctions = "HIT";
  if ((await copiedFixtures.assess(request())).facts.sanctions !== "CLEAR") throw new Error("demo adapter did not copy fixtures");
  expectThrow(() => new DemoKycProviderAdapter({fixtures: [{subject, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}}, {subject: upperSubject, facts: {kyc: "NOT_VERIFIED", sanctions: "CLEAR"}}]}), "duplicate demo fixture");
  expectThrow(() => new DemoKycProviderAdapter({fixtures: [{subject: "0x1234" as `0x${string}`, facts: {kyc: "VERIFIED", sanctions: "CLEAR"}}]}), "invalid demo fixture address");
  for (const validitySeconds of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expectThrow(() => new DemoKycProviderAdapter({fixtures: [], validitySeconds}), `demo validitySeconds ${validitySeconds}`);
  }

  const checkNames = "metadata-contract,environment-guard,eligible-evidence,fail-closed-evidence,abort-signal";
  const demoReport = await runKycProviderConformance(demo, {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  if (!demoReport.passed || demoReport.schemaVersion !== 1 || demoReport.checks.map((check) => check.name).join() !== checkNames) throw new Error("demo adapter failed conformance");

  const httpCalls: {url: string; init: TransportInit}[] = [];
  const vendor = httpAdapter(jsonResponse(200, (body) => vendorBody(body)), httpCalls);
  const httpReport = await runKycProviderConformance(vendor, {eligibleRequest: request(), ineligibleRequest: request(sanctionedSubject), now});
  if (!httpReport.passed || httpReport.checks.map((check) => check.name).join() !== checkNames) throw new Error("HTTP example adapter failed conformance");
  const httpDirect = await refresh(vendor);
  if (!httpDirect.result.eligible || httpDirect.result.materialization.facts.accreditedInvestor !== "VERIFIED" || httpDirect.result.materialization.providerId !== "vendor-x") {
    throw new Error("HTTP example mapping regression");
  }
  const httpOutput = JSON.stringify({httpReport, demoReport, httpDirect: httpDirect.serialized});
  if ([fullNameSentinel, credentialSentinel, caseSentinel].some((value) => httpOutput.includes(value))) throw new Error("HTTP example leaked vendor PII, ids or credentials");
  const firstCall = httpCalls[0];
  const sentBody = JSON.parse(firstCall.init.body);
  if (firstCall.url !== endpoint || firstCall.init.method !== "POST" || firstCall.init.headers.authorization !== `Bearer ${credentialSentinel}` ||
    !(firstCall.init.signal instanceof AbortSignal) || sentBody.wallet !== subject || sentBody.asset !== asset || firstCall.init.body.includes(credentialSentinel)) {
    throw new Error("HTTP example request shape regression");
  }

  const invalidMetadataReport = await runKycProviderConformance(staticAdapter((input) => assessmentFor(input), {...productionMetadata, spiVersion: "2.0.0"}), {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  if (invalidMetadataReport.passed || invalidMetadataReport.checks.length !== 1 || invalidMetadataReport.checks[0].name !== "metadata-contract" || invalidMetadataReport.checks[0].pass) {
    throw new Error("conformance accepted invalid metadata");
  }
  const unreadableReport = await runKycProviderConformance(
    {get metadata(): KycProviderMetadata { throw new Error(piiSentinel); }, assess: production.assess},
    {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now}
  );
  if (unreadableReport.passed || unreadableReport.checks[0].name !== "metadata-contract" || JSON.stringify(unreadableReport).includes(piiSentinel)) throw new Error("conformance leaked a metadata getter error");
  let metadataReads = 0;
  const unstableReport = await runKycProviderConformance(
    {get metadata(): KycProviderMetadata { metadataReads += 1; return {...productionMetadata, environment: metadataReads === 1 ? "demo" : "production"}; }, assess: production.assess},
    {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now}
  );
  if (unstableReport.passed || unstableReport.checks.find((check) => check.name === "environment-guard")?.pass !== false) throw new Error("conformance accepted unstable environment metadata");
  const failing = (report: {checks: {name: string; pass: boolean}[]}) => report.checks.filter((check) => !check.pass).map((check) => check.name).join();
  const wrongIdReport = await runKycProviderConformance(staticAdapter((input) => assessmentFor(input, {providerId: "provider-b"})), {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  const wrongIdEligible = wrongIdReport.checks.find((check) => check.name === "eligible-evidence");
  if (wrongIdReport.passed || !wrongIdEligible || wrongIdEligible.pass || !wrongIdEligible.detail.includes("PROVIDER_INCOMPATIBLE") || !failing(wrongIdReport).startsWith("eligible-evidence")) {
    throw new Error("conformance accepted a wrong providerId");
  }
  const everyoneEligible = await runKycProviderConformance(staticAdapter((input) => assessmentFor(input)), {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  if (everyoneEligible.passed || failing(everyoneEligible) !== "fail-closed-evidence") throw new Error("conformance accepted an adapter that reports everyone eligible");
  const piiThrowing = await runKycProviderConformance(staticAdapter(() => { throw new Error(piiSentinel); }), {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  if (piiThrowing.passed || failing(piiThrowing) !== "eligible-evidence,fail-closed-evidence" || JSON.stringify(piiThrowing).includes(piiSentinel)) {
    throw new Error("conformance leaked an adapter error message");
  }
  const ignoresAbort: ProviderKycAdapter = {
    metadata: productionMetadata as KycProviderMetadata,
    async assess(input) {
      return input.subject === unknownSubject ? assessmentFor(input, {facts: {kyc: "NOT_VERIFIED", sanctions: "CLEAR"}}) : assessmentFor(input);
    }
  };
  const ignoresAbortReport = await runKycProviderConformance(ignoresAbort, {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now});
  if (ignoresAbortReport.passed || failing(ignoresAbortReport) !== "abort-signal") throw new Error("conformance accepted an adapter that ignores an aborted signal");
  const staleForeverOnAbort: ProviderKycAdapter = {
    metadata: productionMetadata as KycProviderMetadata,
    async assess(input, context) {
      if (context?.signal?.aborted) return new Promise<never>(() => undefined);
      return input.subject === unknownSubject ? assessmentFor(input, {facts: {kyc: "NOT_VERIFIED", sanctions: "CLEAR"}}) : assessmentFor(input);
    }
  };
  const staleForeverReport = await runKycProviderConformance(staleForeverOnAbort, {eligibleRequest: request(), ineligibleRequest: request(unknownSubject), now, providerTimeoutMs: 25});
  if (staleForeverReport.passed || failing(staleForeverReport) !== "abort-signal") throw new Error("conformance accepted an adapter that never settles on an aborted signal");

  const replacements = [[demo, "demo", DEMO_KYC_PROVIDER_ID], [vendor, "production", "vendor-x"]] as const;
  for (const [adapter, mode, providerId] of replacements) {
    const replaced = await refresh(adapter, {mode});
    if (!replaced.result.eligible || replaced.result.materialization.providerId !== providerId || replaced.audit.length !== 1) throw new Error(`provider replacement failed for ${providerId}`);
  }

  const httpCases: [number, string][] = [
    [408, "PROVIDER_TIMEOUT"],
    [504, "PROVIDER_TIMEOUT"],
    [409, "PROVIDER_INCOMPATIBLE"],
    [422, "PROVIDER_INCOMPATIBLE"],
    [503, "PROVIDER_UNAVAILABLE"],
    [500, "PROVIDER_UNAVAILABLE"],
    [302, "PROVIDER_UNAVAILABLE"]
  ];
  const httpFailures: string[] = [];
  for (const [status, reason] of httpCases) {
    const outcome = await refresh(httpAdapter(jsonResponse(status, (body) => vendorBody(body))));
    if (outcome.result.eligible || outcome.result.reason !== reason) throw new Error(`HTTP ${status} did not map to ${reason}`);
    httpFailures.push(outcome.serialized);
  }
  const bodyCases: [string, (body: any) => unknown][] = [
    ["null body", () => null],
    ["unknown decision", (body) => vendorBody(body, {decision: "maybe"})],
    ["missing checks", (body) => vendorBody(body, {checks: undefined})],
    ["non-address wallet", (body) => vendorBody(body, {wallet: fullNameSentinel})],
    ["non-integer reviewedAt", (body) => vendorBody(body, {reviewedAt: "yesterday"})]
  ];
  for (const [label, body] of bodyCases) {
    const outcome = await refresh(httpAdapter(jsonResponse(200, body)));
    if (outcome.result.eligible || outcome.result.reason !== "PROVIDER_INCOMPATIBLE") throw new Error(`HTTP ${label} was not PROVIDER_INCOMPATIBLE`);
    httpFailures.push(outcome.serialized);
  }
  const unparseable = await refresh(httpAdapter(async () => ({status: 200, async json(): Promise<unknown> { throw new SyntaxError(fullNameSentinel); }})));
  if (unparseable.result.eligible || unparseable.result.reason !== "PROVIDER_INCOMPATIBLE") throw new Error("unparseable HTTP body was not PROVIDER_INCOMPATIBLE");
  const networkDown = await refresh(httpAdapter(async () => { throw new Error(`network down ${credentialSentinel}`); }));
  if (networkDown.result.eligible || networkDown.result.reason !== "PROVIDER_UNAVAILABLE") throw new Error("transport failure was not PROVIDER_UNAVAILABLE");
  const credentialDown = await refresh(new HttpKycProviderAdapter(
    {providerId: "vendor-x", providerSchemaVersion: "vendor-x.kyc.v3", endpoint},
    {transport: async () => ({status: 200, async json() { return {}; }}), credential: async () => { throw new Error(credentialSentinel); }}
  ));
  if (credentialDown.result.eligible || credentialDown.result.reason !== "PROVIDER_UNAVAILABLE") throw new Error("credential failure was not PROVIDER_UNAVAILABLE");
  const failureOutput = [...httpFailures, unparseable.serialized, networkDown.serialized, credentialDown.serialized].join("\n");
  if ([fullNameSentinel, credentialSentinel, caseSentinel].some((value) => failureOutput.includes(value))) throw new Error("HTTP failure path leaked vendor PII or credentials");
  const deps: HttpKycProviderDeps = {transport: async () => ({status: 200, async json() { return {}; }}), credential: async () => credentialSentinel};
  for (const badEndpoint of ["http://kyc.vendor.example/v3", "not a url", `ftp://${piiSentinel}/kyc`]) {
    const error = expectThrow(() => new HttpKycProviderAdapter({providerId: "vendor-x", providerSchemaVersion: "vendor-x.kyc.v3", endpoint: badEndpoint}, deps), `endpoint ${badEndpoint}`);
    if (error.message.includes(piiSentinel)) throw new Error("endpoint rejection echoed input");
  }
  expectThrow(() => new HttpKycProviderAdapter({providerId: "Vendor X", providerSchemaVersion: "v3", endpoint}, deps), "HTTP example invalid providerId");
  const fetchTransport: HttpKycProviderDeps["transport"] = fetch;
  if (typeof fetchTransport !== "function") throw new Error("global fetch does not satisfy the example transport");

  const root = require("@corner-store/compliance-data");
  const spi = require("@corner-store/compliance-data/spi");
  const demoModule = require("@corner-store/compliance-data/demo");
  const conformance = require("@corner-store/compliance-data/conformance");
  if ("DemoKycProviderAdapter" in root || "runKycProviderConformance" in root || typeof root.KycEvidenceCoordinator !== "function" || typeof root.validateKycProviderMetadata !== "function") {
    throw new Error("root export boundary regression");
  }
  if (typeof spi.validateKycProviderMetadata !== "function" || spi.KYC_PROVIDER_SPI_VERSION !== KYC_PROVIDER_SPI_VERSION || "KycEvidenceCoordinator" in spi || "DemoKycProviderAdapter" in spi) {
    throw new Error("spi export boundary regression");
  }
  if (typeof demoModule.DemoKycProviderAdapter !== "function" || "KycEvidenceCoordinator" in demoModule) throw new Error("demo export boundary regression");
  if (typeof conformance.runKycProviderConformance !== "function" || "DemoKycProviderAdapter" in conformance) throw new Error("conformance export boundary regression");
  if (spi.KycProviderError !== root.KycProviderError) throw new Error("spi and root disagree on KycProviderError");
  try {
    require("@corner-store/compliance-data/dist/src/kyc-demo.js");
    throw new Error("deep dist path was exported");
  } catch (error: any) {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }

  const packageRoot = join(__dirname, "..", "..");
  const srcDir = join(packageRoot, "src");
  const allowedImports: Record<string, string[]> = {
    "kyc-spi.ts": ["./types"],
    "kyc-demo.ts": ["./kyc-spi", "./canonical", "./types"],
    "kyc-conformance.ts": ["./kyc-spi", "./kyc", "./types"]
  };
  const sources = readdirSync(srcDir).filter((file) => file.endsWith(".ts"));
  if (!["kyc.ts", ...Object.keys(allowedImports)].every((file) => sources.includes(file))) throw new Error("source scan did not find the KYC modules");
  for (const file of sources) {
    const specifiers = preProcessFile(readFileSync(join(srcDir, file), "utf8"), true, true).importedFiles.map((imported) => imported.fileName.replace(/\.js$/, ""));
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".") && !builtinModules.includes(specifier.replace(/^node:/, ""))) throw new Error(`${file} imports non-builtin ${specifier}`);
      if (specifier.startsWith("..") || specifier.includes("examples")) throw new Error(`${file} imports outside src`);
      if (specifier === "./kyc-demo") throw new Error(`${file} imports the demo adapter`);
      if (allowedImports[file] && !allowedImports[file].includes(specifier)) throw new Error(`${file} imports ${specifier}`);
    }
  }
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (manifest.dependencies || manifest.peerDependencies || manifest.optionalDependencies) throw new Error("compliance data SDK gained runtime dependencies");

  console.log("corner-store compliance data kyc provider ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
