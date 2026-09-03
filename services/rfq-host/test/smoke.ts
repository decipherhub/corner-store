import {request as httpRequest} from "http";
import {mkdtempSync, readFileSync} from "fs";
import {tmpdir} from "os";
import {join} from "path";
import assert from "assert";

import {LocalFileQuoteCoordinatorStore, RFQPrice, RFQQuoteCoordinator, RFQRiskDecision, TypedDataSigner} from "@corner-store/rfq-service";

import {
  InMemoryRateLimiter,
  MemoryAuditSink,
  MemoryIncidentSink,
  MemoryMetricsSink,
  ProductionRFQHostConfig,
  startProductionRFQHost,
  StaticBearerAuthenticator
} from "../src";

const MAKER = "0x1000000000000000000000000000000000000001" as const;
const TAKER = "0x2000000000000000000000000000000000000002" as const;
const OTHER_TAKER = "0x2000000000000000000000000000000000000003" as const;
const TOKEN_IN = "0x3000000000000000000000000000000000000003" as const;
const TOKEN_OUT = "0x4000000000000000000000000000000000000004" as const;
const VENUE = "0x5000000000000000000000000000000000000005" as const;
const ADAPTER = "0x6000000000000000000000000000000000000006" as const;
const GOOD_TOKEN = "secret-production-token";
const DUMMY_SIG = `0x${"11".repeat(65)}` as const;

async function main(): Promise<void> {
  await rejectsPublicBindWithoutAcknowledgement();
  await rejects401And403();
  await rejectsMalformedOversizeAndRateLimit();
  await limiterCapacityPreventsPrincipalSpray();
  await rejectsStaleMissingFutureFreshnessBeforeSigning();
  await rejectsFreshRiskDecisionWith422();
  await rejectsBadSignerAndNotifiesIncident();
  await externalSignerThrowUsesStableSignerIncident();
  await failsClosedWhenStrictAuditCannotPersist();
  await strictAuditRetryReturnsSameQuoteWithoutResign();
  await incidentHookFailureDoesNotRecurseOrLeak();
  await issuesQuoteAndReplaysIdempotentlyWithRedactedAuditAndBoundedMetrics();
  console.log("corner-store RFQ production host smoke ok");
}

async function rejectsPublicBindWithoutAcknowledgement(): Promise<void> {
  const config = baseConfig();
  await assert.rejects(() => startProductionRFQHost({...config, host: "0.0.0.0"}), /refuses public bind/);
}

async function rejects401And403(): Promise<void> {
  const ctx = await start(baseConfig());
  try {
    assert.equal((await post(ctx.baseUrl, quoteBody("auth-401-a"))).status, 401);
    assert.equal((await post(ctx.baseUrl, quoteBody("auth-401-b"), "invalid-token")).status, 401);
    assert.equal((await post(ctx.baseUrl, quoteBody("auth-403-a", OTHER_TAKER), GOOD_TOKEN)).status, 403);
    assert.equal(ctx.incident.incidents.filter((event) => event.type === "auth_abuse").length, 3);
  } finally {
    await ctx.close();
  }
}

async function rejectsMalformedOversizeAndRateLimit(): Promise<void> {
  const ctx = await start(baseConfig({maxBodyBytes: 80, rateLimiter: new InMemoryRateLimiter({windowMs: 60_000, maxRequests: 1})}));
  try {
    assert.equal((await rawPost(ctx.baseUrl, "{", GOOD_TOKEN)).status, 400);
    assert.equal((await rawPost(ctx.baseUrl, JSON.stringify({...quoteBody("oversize-a"), padding: "x".repeat(512)}), GOOD_TOKEN)).status, 413);
    assert.equal((await rawPost(ctx.baseUrl, JSON.stringify({...quoteBody("oversize-b"), padding: "x".repeat(512)}), GOOD_TOKEN, {"content-length": "512"})).status, 413);
    assert.equal((await chunkedPost(ctx.baseUrl, [JSON.stringify(quoteBody("chunked-a")), "x".repeat(512)], GOOD_TOKEN)).status, 413);
  } finally {
    await ctx.close();
  }

  const rateCtx = await start(baseConfig({rateLimiter: new InMemoryRateLimiter({windowMs: 60_000, maxRequests: 1})}));
  try {
    assert.equal((await post(rateCtx.baseUrl, quoteBody("rate-a"), GOOD_TOKEN)).status, 200);
    const limited = await post(rateCtx.baseUrl, quoteBody("rate-b"), GOOD_TOKEN);
    assert.equal(limited.status, 429);
    assert(Number(limited.headers["retry-after"]) >= 1);
    assert(rateCtx.incident.incidents.some((event) => event.type === "rate_limited" && event.principalHash?.startsWith("sha256:")));
  } finally {
    await rateCtx.close();
  }
}


async function limiterCapacityPreventsPrincipalSpray(): Promise<void> {
  const limiter = new InMemoryRateLimiter({windowMs: 60_000, maxRequests: 5, maxBuckets: 2});
  assert(limiter.check({principalHash: "sha256:a", route: "/rfq/quote", nowMs: 0}).allowed);
  assert(limiter.check({principalHash: "sha256:b", route: "/rfq/quote", nowMs: 0}).allowed);
  const denied = limiter.check({principalHash: "sha256:c", route: "/rfq/quote", nowMs: 0});
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "rate_limiter_capacity");
  assert.equal(limiter.size(), 2);
  assert(limiter.check({principalHash: "sha256:c", route: "/rfq/quote", nowMs: 60_000}).allowed);
  assert.equal(limiter.size(), 1);
}

async function rejectsStaleMissingFutureFreshnessBeforeSigning(): Promise<void> {
  for (const [name, pricingResult, riskDecision] of [
    ["missing", price({snapshotId: ""}), risk()],
    ["stale", price({validUntil: 999}), risk()],
    ["future", price({observedAt: 2_000}), risk()],
    ["risk-unavailable", price(), risk({available: false})]
  ] as const) {
    const config = baseConfig({pricingResult, riskDecision});
    const ctx = await start(config);
    try {
      const response = await post(ctx.baseUrl, quoteBody(`fresh-${name}`), GOOD_TOKEN);
      assert.equal(response.status, 503, name);
      assert.equal(config.signer.signCount, 0, name);
      assert.deepEqual(readRecords(config.storePath), [], name);
      assert(ctx.incident.incidents.some((event) => event.type === "dependency_unavailable" || event.type === "dependency_stale"), name);
    } finally {
      await ctx.close();
    }
  }
}


async function rejectsFreshRiskDecisionWith422(): Promise<void> {
  const config = baseConfig({riskDecision: risk({decision: "rejected", reason: "raw confidential desk reason"})});
  const ctx = await start(config);
  try {
    const response = await post(ctx.baseUrl, quoteBody("risk-422-a"), GOOD_TOKEN);
    assert.equal(response.status, 422);
    assert.equal(response.body.error, "risk_rejected");
    assert.equal(config.signer.signCount, 0);
    assert.deepEqual(readRecords(config.storePath), []);
    assert(!JSON.stringify(ctx.audit.events).includes("raw confidential"), "raw risk reason leaked to audit");
    assert(!ctx.incident.incidents.some((event) => event.module === "risk"), "risk rejection is a normal reject, not an incident");
  } finally {
    await ctx.close();
  }
}

async function rejectsBadSignerAndNotifiesIncident(): Promise<void> {
  const config = baseConfig({verifySignature: () => { throw new Error("signer returned a signature that does not recover the maker"); }});
  const ctx = await start(config);
  try {
    const response = await post(ctx.baseUrl, quoteBody("bad-signer-a"), GOOD_TOKEN);
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "signer_unavailable");
    assert.equal((readRecords(config.storePath)[0] as any).state, "SIGN_FAILED");
    assert(ctx.incident.incidents.some((event) => event.type === "signer_failure"));
  } finally {
    await ctx.close();
  }
}


async function externalSignerThrowUsesStableSignerIncident(): Promise<void> {
  const config = baseConfig({signer: {signTypedData: async () => { throw new Error("KMS timeout"); }}});
  const ctx = await start(config);
  try {
    const response = await post(ctx.baseUrl, quoteBody("kms-timeout-a"), GOOD_TOKEN);
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "signer_unavailable");
    assert(ctx.incident.incidents.some((event) => event.type === "signer_failure" && event.reason === "signer_call_failed"));
  } finally {
    await ctx.close();
  }
}

async function failsClosedWhenStrictAuditCannotPersist(): Promise<void> {
  const config = baseConfig({audit: {record: () => { throw new Error("worm down with sensitive internals"); }}});
  const ctx = await start(config);
  try {
    const response = await post(ctx.baseUrl, quoteBody("audit-fail-a"), GOOD_TOKEN);
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "audit_unavailable");
    assert(ctx.incident.incidents.some((event) => event.type === "audit_failure"));
  } finally {
    await ctx.close();
  }
}

async function strictAuditRetryReturnsSameQuoteWithoutResign(): Promise<void> {
  let fail = true;
  const audit = new MemoryAuditSink();
  const config = baseConfig({audit: {record: (event) => {
    if (fail && event.outcome === "success") {
      fail = false;
      throw new Error("strict audit unavailable");
    }
    audit.record(event);
  }}});
  const ctx = await start(config);
  try {
    const failed = await post(ctx.baseUrl, quoteBody("audit-retry-a"), GOOD_TOKEN);
    assert.equal(failed.status, 503);
    assert.equal(config.signer.signCount, 1);
    const replay = await post(ctx.baseUrl, quoteBody("audit-retry-a"), GOOD_TOKEN);
    assert.equal(replay.status, 200);
    assert.equal(config.signer.signCount, 1);
    assert(audit.events.some((event) => event.outcome === "success" && event.replayed === true), "audit retry records replayed quote evidence");
  } finally {
    await ctx.close();
  }
}


async function incidentHookFailureDoesNotRecurseOrLeak(): Promise<void> {
  const config = baseConfig({
    verifySignature: () => { throw new Error("signer returned a signature that does not recover the maker"); },
    incident: {notify: () => { throw new Error(`webhook failed ${GOOD_TOKEN}`); }}
  });
  const ctx = await start(config);
  try {
    const response = await post(ctx.baseUrl, quoteBody("incident-fail-a"), GOOD_TOKEN);
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "signer_unavailable");
    const auditText = JSON.stringify(ctx.audit.events);
    assert(!auditText.includes(GOOD_TOKEN), "incident hook failure leaked secret into audit");
  } finally {
    await ctx.close();
  }
}

async function issuesQuoteAndReplaysIdempotentlyWithRedactedAuditAndBoundedMetrics(): Promise<void> {
  const config = baseConfig();
  const ctx = await start(config);
  try {
    const first = await post(ctx.baseUrl, quoteBody("success-a"), GOOD_TOKEN);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const replay = await post(ctx.baseUrl, quoteBody("success-a"), GOOD_TOKEN);
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, first.body);
    assert.equal(config.signer.signCount, 1);

    const conflict = await post(ctx.baseUrl, {...quoteBody("success-a"), amountIn: "11"}, GOOD_TOKEN);
    assert.equal(conflict.status, 409);

    const auditText = JSON.stringify(ctx.audit.events);
    assert(!auditText.includes(GOOD_TOKEN), "raw bearer token leaked to audit");
    assert(!auditText.includes("success-a"), "raw idempotency key leaked to audit");
    assert(ctx.audit.events.some((event) => event.outcome === "success" && event.idempotencyKeyHash?.startsWith("sha256:") && event.pricingSnapshotId === "pricing-1"));
    assert(ctx.metrics.increments.every((entry) => !JSON.stringify(entry.labels).includes(TAKER.slice(2, 12))));
    assert.equal((await get(`${ctx.baseUrl}/health`)).body.service, "corner-store-rfq-host");
  } finally {
    await ctx.close();
  }
}

function baseConfig(overrides: Partial<ProductionRFQHostConfig> & {
  verifySignature?: ProductionRFQHostConfig["coordinator"] extends never ? never : (data: unknown, signature: unknown, maker: unknown) => void;
  pricingResult?: RFQPrice;
  riskDecision?: RFQRiskDecision;
  signer?: TypedDataSigner;
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "corner-store-rfq-host-"));
  const storePath = join(dir, "quotes.json");
  const signer = overrides.signer ?? new CountingSigner();
  const store = new LocalFileQuoteCoordinatorStore({
    filePath: storePath,
    inventory: [{maker: MAKER, token: TOKEN_OUT, venue: VENUE, available: "1000000"}],
    confirmationDepth: 2
  });
  const coordinator = new RFQQuoteCoordinator({
    chainId: 31337,
    verifyingContract: ADAPTER,
    maker: MAKER,
    signer,
    pricing: {price: () => overrides.pricingResult ?? price()},
    riskCheck: {check: () => overrides.riskDecision ?? risk()},
    store,
    now: () => 1_000,
    verifySignature: overrides.verifySignature ?? (() => undefined),
    moduleVersions: {pricing: "prod-price-v1", risk: "prod-risk-v1"}
  });
  const audit = overrides.audit ?? new MemoryAuditSink();
  const incident = overrides.incident ?? new MemoryIncidentSink();
  const metrics = new MemoryMetricsSink();
  return {
    host: "127.0.0.1",
    coordinator,
    authenticator: new StaticBearerAuthenticator([{token: GOOD_TOKEN, taker: TAKER}]),
    rateLimiter: overrides.rateLimiter,
    audit,
    metrics,
    incident,
    maxBodyBytes: overrides.maxBodyBytes,
    now: () => 1_000,
    strictAudit: overrides.strictAudit,
    storePath,
    signer: signer as CountingSigner
  };
}

async function start(config: ReturnType<typeof baseConfig>) {
  const host = await startProductionRFQHost(config);
  return {...host, audit: config.audit as MemoryAuditSink, incident: config.incident as MemoryIncidentSink, metrics: config.metrics};
}

class CountingSigner implements TypedDataSigner {
  signCount = 0;
  async signTypedData(): Promise<typeof DUMMY_SIG> {
    this.signCount += 1;
    return DUMMY_SIG;
  }
}

function price(overrides: Partial<RFQPrice> = {}): RFQPrice {
  return {amountOut: "20", snapshotId: "pricing-1", version: "price-v1", observedAt: 995, validUntil: 1_060, available: true, ...overrides};
}

function risk(overrides: Partial<RFQRiskDecision> = {}): RFQRiskDecision {
  return {decision: "passed", snapshotId: "risk-1", version: "risk-v1", observedAt: 995, validUntil: 1_060, available: true, ...overrides};
}

function quoteBody(idempotencyKey: string, taker: string = TAKER) {
  return {idempotencyKey, taker, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT, amountIn: "10", venue: VENUE, ttlSeconds: 30};
}

function readRecords(storePath: string): unknown[] {
  return (JSON.parse(readFileSync(storePath, "utf8")) as {records: unknown[]}).records;
}

async function post(baseUrl: string, body: unknown, token?: string) {
  return rawPost(baseUrl, JSON.stringify(body), token);
}

async function rawPost(baseUrl: string, raw: string, token?: string, extraHeaders?: Record<string, string>): Promise<{status: number; body: any; headers: Record<string, string | string[] | undefined>}> {
  return httpJson(`${baseUrl}/rfq/quote`, "POST", raw, token, extraHeaders);
}


async function chunkedPost(baseUrl: string, chunks: string[], token?: string): Promise<{status: number; body: any; headers: Record<string, string | string[] | undefined>}> {
  const parsed = new URL(`${baseUrl}/rfq/quote`);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      method: "POST",
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        "content-type": "application/json",
        ...(token ? {authorization: `Bearer ${token}`} : {})
      }
    }, (res) => {
      const received: Buffer[] = [];
      res.on("data", (chunk) => received.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const text = Buffer.concat(received).toString("utf8");
        resolve({status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined, headers: res.headers});
      });
    });
    req.on("error", reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}

async function get(url: string): Promise<{status: number; body: any; headers: Record<string, string | string[] | undefined>}> {
  return httpJson(url, "GET");
}

async function httpJson(url: string, method: "GET" | "POST", raw?: string, token?: string, extraHeaders?: Record<string, string>): Promise<{status: number; body: any; headers: Record<string, string | string[] | undefined>}> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        ...(raw !== undefined ? {"content-type": "application/json", "content-length": Buffer.byteLength(raw)} : {}),
        ...(token ? {authorization: `Bearer ${token}`} : {}),
        ...(extraHeaders ?? {})
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined, headers: res.headers});
      });
    });
    req.on("error", reject);
    if (raw !== undefined) req.write(raw);
    req.end();
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
