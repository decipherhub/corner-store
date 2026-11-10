import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RFQQuoteCoordinator, RFQQuoteCoordinatorV3, LocalFileQuoteCoordinatorStore, RFQCoordinatorError} from "@corner-store/rfq-service";
import {startProductionRFQHost, StaticBearerAuthenticator, MemoryAuditSink, MemoryMetricsSink, MemoryIncidentSink} from "../src/server";
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`;
const policyId = `0x${"11".repeat(32)}` as const;
const otherPolicy = `0x${"22".repeat(32)}` as const;
const body = {idempotencyKey: "host-authorization", taker: addr(2), tokenIn: addr(3), tokenOut: addr(4), amountIn: "10", venue: addr(5), ttlSeconds: 60};
const product = {maker: addr(1), tokenIn: addr(3), tokenOut: addr(4), venue: addr(5), policyId, flowType: 0 as const};
async function fixture(mode = "ok", auditFails = false) {
  const calls: string[] = [];
  const filePath = join(mkdtempSync(join(tmpdir(), "host-authorization-")), "quotes.json");
  const store = new LocalFileQuoteCoordinatorStore({filePath, inventory: [{maker: addr(1), token: addr(4), venue: addr(5), available: "1000"}]});
  const reserve = store.reserveOrReturnExisting.bind(store);
  store.reserveOrReturnExisting = (input) => {calls.push("reservation"); return reserve(input);};
  let now = 100;
  const freshness = {snapshotId: "fixture", version: "1", observedAt: 100, validUntil: 1000, available: true};
  const config = {chainId: 31337, verifyingContract: addr(6), maker: addr(1), maxTtlSeconds: 120, defaultTtlSeconds: 30, now: () => mode === "unexpected" ? -1 : now, store,
    products: [{...product, capability: "rfq.quote.v2" as const}, {...product, capability: "rfq.quote.v3" as const}],
    pricing: {price: () => {calls.push("pricing"); if (mode === "pricing") throw new Error("private pricing secret"); return {amountOut: "20", ...freshness};}},
    riskCheck: {check: () => {calls.push("risk"); if (mode === "risk") throw new Error("private risk secret"); return {...freshness, decision: "passed" as const};}},
    signer: {signTypedData: async () => {calls.push("signer"); if (mode === "signer") throw new Error("private signer secret"); return "0x11" as const;}}, verifySignature: () => {}};
  let failResolver = false;
  const resolvePolicyId = () => {calls.push("policy"); if (failResolver || mode === "resolver") throw new Error("private resolver secret"); if (mode === "denied") throw new RFQCoordinatorError("PRODUCT_UNAUTHORIZED", "private denial secret"); if (mode === "config") throw new RFQCoordinatorError("CONFIGURATION_INVALID", "private config secret"); return mode === "mismatch" ? otherPolicy : policyId;};
  const audit = new MemoryAuditSink();
  const metrics = new MemoryMetricsSink();
  const incident = new MemoryIncidentSink();
  const host = await startProductionRFQHost({coordinator: new RFQQuoteCoordinator(config), v3: {coordinator: new RFQQuoteCoordinatorV3({...config, context: {resolve: async () => {calls.push("context"); return {contextVersion: 1, configurationHash: policyId, affiliateEvidenceHash: policyId, sellerIsAffiliate: false};}}}), resolvePolicyId},
    resolvePolicyId, authenticator: {authenticate: (request) => {calls.push("authentication"); return new StaticBearerAuthenticator([{token: "fixture-token", taker: addr(2)}]).authenticate(request);}},
    rateLimiter: {check: () => {calls.push("limiter"); return {allowed: mode !== "limited", retryAfterSeconds: 7};}}, readiness: {check: () => {calls.push("readiness"); return {ready: true, components: [{component: "policy", ready: true}]};}}, audit: {record: (event) => {calls.push("audit"); if (auditFails) throw new Error("private audit secret"); audit.record(event);}}, metrics,
    incident: {notify: (event) => {calls.push("incident"); incident.notify(event);}}, now: () => now});
  return {...host, calls, audit, metrics, incident, setNow: (value: number) => {now = value;}, reserveUnsigned: () => {
    const state = JSON.parse(readFileSync(filePath, "utf8"));
    const record = state.records[0]; record.state = "RESERVED"; delete record.signedQuote; delete record.quoteHash;
    writeFileSync(filePath, JSON.stringify(state));
  }, records: () => JSON.parse(readFileSync(filePath, "utf8")).records, failResolver: () => {failResolver = true;}};
}
async function post(url: string, path: string, input: unknown, authenticated = true) {return fetch(`${url}${path}`, {method: "POST", headers: {...(authenticated ? {authorization: "Bearer fixture-token"} : {}), "content-type": "application/json"}, body: JSON.stringify(input)});}
for (const version of [2, 3]) {
  const path = version === 2 ? "/rfq/quote" : "/rfq/v3/quote";
  const input = {...body, ...(version === 3 ? {flowType: 0} : {})};
  test(`v${version} rejects invalid TTL and unauthorized products before costly dependencies`, async () => {
    const f = await fixture();
    try {
      for (const ttlSeconds of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 121, null]) {
        f.calls.length = 0;
        const response = await post(f.baseUrl, path, {...input, ttlSeconds});
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {error: "invalid_request"});
        assert.deepEqual(f.calls, ["authentication", "limiter", "audit"]);
      }
      for (const patch of [{venue: addr(9)}, {tokenIn: addr(9)}, {tokenOut: addr(9)}, ...(version === 3 ? [{flowType: 1}] : [])]) {
        f.calls.length = 0;
        const response = await post(f.baseUrl, path, {...input, ...patch});
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), {error: "product_unauthorized"});
        assert.deepEqual(f.calls, ["authentication", "limiter", "audit"]);
      }
      f.calls.length = 0;
      for (const patch of [{maker: addr(9)}, {policyId: otherPolicy}, {nonce: "8"}, ...(version === 2 ? [{flowType: 1}] : [])]) {
        f.calls.length = 0;
        assert.equal((await post(f.baseUrl, path, {...input, ...patch})).status, 400);
        assert.deepEqual(f.calls, ["audit"]);
      }
      assert.deepEqual(f.records(), []);
      assert.ok(!JSON.stringify([f.audit.events, f.metrics, f.incident.incidents]).includes("fixture-token"));
    } finally {await f.close();}
  });
  test(`v${version} authentication and limiter precede TTL/product rejection with parent audit behavior`, async () => {
    for (const auditFails of [false, true]) {
      for (const [mode, authenticated, status, error, reason] of [
        ["ok", false, 401, "unauthorized", "auth_abuse"],
        ["limited", true, 429, "rate_limited", "rate_limited"],
        ["ok", true, 400, "invalid_request", undefined],
        ["ok", true, 403, "product_unauthorized", undefined]
      ] as const) {
        const f = await fixture(mode, auditFails);
        try {
          const patches = status === 401 || status === 429 ? [{}, {ttlSeconds: 0}, {venue: addr(9)}] : status === 400 ? [{ttlSeconds: 0}] : [{venue: addr(9)}];
          for (const patch of patches) {
            f.calls.length = 0; f.incident.incidents.length = 0; f.audit.events.length = 0;
            const response = await post(f.baseUrl, path, {...input, ...patch}, authenticated);
            assert.equal(response.status, status);
            assert.deepEqual(await response.json(), {error});
            const expected = ["authentication", ...(authenticated ? ["limiter"] : []), ...(reason ? ["incident"] : []), "audit", ...(auditFails ? ["incident"] : [])];
            assert.deepEqual(f.calls, expected);
            assert.deepEqual(f.incident.incidents.map((event) => event.type), [...(reason ? [reason] : []), ...(auditFails ? ["audit_failure"] : [])]);
            if (!auditFails) {
              assert.equal(f.audit.events.length, 1);
              assert.equal(f.audit.events[0].outcome, "reject");
              assert.equal(f.audit.events[0].reason, error);
            }
            if (status === 429) assert.equal(response.headers.get("retry-after"), "7");
            assert.deepEqual(f.records(), []);
            assert.ok(!JSON.stringify([f.audit.events, f.metrics, f.incident.incidents]).includes("private"));
          }
        } finally {await f.close();}
      }
    }
  });
  test(`v${version} terminal SIGN_FAILED retry returns bounded 400 without signing again`, async () => {
    const f = await fixture("signer");
    try {
      const first = await post(f.baseUrl, path, input);
      assert.equal(first.status, 503);
      assert.deepEqual(await first.json(), {error: "signer_unavailable"});
      assert.equal(f.records()[0].state, "SIGN_FAILED");
      f.calls.length = 0;
      const retry = await post(f.baseUrl, path, input);
      assert.equal(retry.status, 400);
      assert.deepEqual(await retry.json(), {error: "invalid_request"});
      assert.deepEqual(f.calls, ["authentication", "limiter", "readiness", "audit"]);
      assert.equal(f.records()[0].state, "SIGN_FAILED");
    } finally {await f.close();}
  });
  test(`v${version} expired unsigned reservation retries return bounded 400 and release inventory`, async () => {
    const f = await fixture();
    try {
      assert.equal((await post(f.baseUrl, path, input)).status, 200);
      f.reserveUnsigned(); f.setNow(160); f.calls.length = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        f.calls.length = 0;
        const retry = await post(f.baseUrl, path, input);
        assert.equal(retry.status, 400);
        assert.deepEqual(await retry.json(), {error: "invalid_request"});
        assert.deepEqual(f.calls, ["authentication", "limiter", "readiness", "audit"]);
        assert.equal(f.records()[0].state, "EXPIRED");
        assert.equal(f.records()[0].inventoryLease.released, true);
      }
    } finally {await f.close();}
  });
  test(`v${version} unexpected coordinator failure retains bounded 500`, async () => {
    const f = await fixture("unexpected");
    try {
      const response = await post(f.baseUrl, path, input);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {error: "internal_error"});
      assert.ok(!f.calls.includes("signer"));
    } finally {await f.close();}
  });
  test(`v${version} max boundary, configured default, replay and conflicts preserve authorization`, async () => {
    const f = await fixture();
    try {
      const firstResponse = await post(f.baseUrl, path, {...input, ttlSeconds: 120});
      assert.equal(firstResponse.status, 200);
      const first: any = await firstResponse.json();
      assert.equal(first.quote.expiry, 220);
      assert.equal(f.records()[0].productAuthorization.policyId, policyId);
      f.failResolver(); f.calls.length = 0;
      const replayResponse = await post(f.baseUrl, path, {...input, ttlSeconds: 120});
      assert.equal(replayResponse.status, 200);
      assert.deepEqual(await replayResponse.json(), first);
      assert.deepEqual(f.calls, ["authentication", "limiter", "readiness", "audit"]);
      assert.equal((await post(f.baseUrl, path, {...input, ttlSeconds: 120, amountIn: "11"})).status, 409);
    } finally {await f.close();}
    const g = await fixture();
    try {
      const {ttlSeconds, ...withoutTtl} = input;
      const response = await post(g.baseUrl, path, withoutTtl);
      assert.equal(response.status, 200);
      assert.equal((await response.json() as any).quote.expiry, 130);
    } finally {await g.close();}
  });
  test(`v${version} taxonomy separates terminal product/configuration failures from outages`, async () => {
    for (const [mode, status, error] of [["mismatch", 403, "product_unauthorized"], ["denied", 403, "product_unauthorized"], ["config", 500, "configuration_invalid"], ["resolver", 503, "dependency_unavailable"], ["pricing", 503, "dependency_unavailable"], ["risk", 503, "dependency_unavailable"]] as const) {
      const f = await fixture(mode);
      try {
        const response = await post(f.baseUrl, path, input);
        assert.equal(response.status, status, mode);
        assert.deepEqual(await response.json(), {error}, mode);
        assert.ok(!f.calls.includes("signer"));
        assert.deepEqual(f.records(), []);
        assert.ok(!JSON.stringify([f.audit.events, f.metrics, f.incident.incidents]).includes("private"));
        if (["mismatch", "denied", "config", "resolver"].includes(mode)) assert.ok(!f.calls.includes("pricing"));
      } finally {await f.close();}
    }
  });
}
