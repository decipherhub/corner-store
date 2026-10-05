import {mkdtempSync, writeFileSync} from "fs";
import {createServer, request} from "http";
import {tmpdir} from "os";
import {join} from "path";
import {createOperatorApi, EventIndex, FileEventIndex} from "../src/api";
import {ChainReader, FinalityAwareIndexer} from "../src/indexer";
import {
  PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION,
  ProductionOperatorRuntimeError,
  loadProductionOperatorRuntimeConfig,
  startProductionOperatorRuntime
} from "../src/production-runtime";
import {defaultConfig} from "@corner-store/toolkit";

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "corner-store-operator-"));
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(defaultConfig()));
  const manifestPath = join(dir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({configured: true, status: 2, version: 1, recipeBindingCount: 2}));
  const index = new EventIndex();
  index.add({blockNumber: 2, transactionHash: "0xabc", name: "ManifestActivated", args: {token: "0x1"}});
  const server = createOperatorApi({configPath, manifestPath, index, authToken: "test-token"});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("operator API did not bind");
  const get = (path: string, token?: string) => new Promise<{status: number; body: any}>((resolve, reject) => {
    const req = request({host: "127.0.0.1", port: address.port, path, method: "GET", headers: token ? {authorization: `Bearer ${token}`} : undefined}, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve({status: res.statusCode ?? 0, body: JSON.parse(body)}); }
        catch { resolve({status: res.statusCode ?? 0, body}); }
      });
    });
    req.on("error", reject);
    req.end();
  });
  const health = await get("/api/v1/health");
  if (health.status !== 200 || !health.body.readOnly) throw new Error("health endpoint regression");
  const ready = await get("/api/v1/ready");
  if (ready.status !== 200 || !ready.body.ok) throw new Error("readiness endpoint regression");
  const unauthorized = await get("/api/v1/events");
  if (unauthorized.status !== 401) throw new Error("operator API auth regression");
  const events = await get("/api/v1/events", "test-token");
  if (events.body.events.length !== 1) throw new Error("event index regression");
  const manifest = await get("/api/v1/manifest", "test-token");
  if (manifest.body.status !== 2 || manifest.body.recipeBindingCount !== 2) throw new Error("manifest snapshot regression");
  const metrics = await get("/metrics", "test-token");
  if (metrics.status !== 200 || !String(metrics.body).includes("corner_store_operator_requests_total")) throw new Error("metrics regression");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const eventPath = join(dir, "events.json");
  const persistent = new FileEventIndex(eventPath);
  persistent.add({blockNumber: 3, transactionHash: "0xdef", name: "ManifestSuspended", args: {token: "0x1"}});
  if (new FileEventIndex(eventPath).list().length !== 1) throw new Error("persistent event index regression");
  let reorg = false;
  let currentHead = 14;
  const reader: ChainReader = {
    async head() { return currentHead; },
    async blockHash(block) { return reorg && block === 11 ? "0xreorg" : `0x${block}`; },
    async events(from, to) { return from <= to ? [{blockNumber: to, transactionHash: "0xidx", name: "Executed", args: {}}] : []; }
  };
  const cursorPath = join(dir, "cursor.json");
  const indexer = new FinalityAwareIndexer(reader, persistent, cursorPath, 3);
  if ((await indexer.sync()).added !== 1) throw new Error("finality indexer sync regression");
  reorg = true;
  currentHead = 15;
  try { await indexer.sync(); throw new Error("reorg was not detected"); } catch (err: any) {
    if (!err.message.includes("reorg")) throw err;
  }
  await productionRuntimeSmoke(dir, configPath, manifestPath);
  console.log("corner-store operator API smoke ok");
}

async function productionRuntimeSmoke(dir: string, configPath: string, manifestPath: string): Promise<void> {
  const artifactPath = join(dir, "artifact.json");
  const eventsPath = join(dir, "production-events.json");
  const tokenPath = join(dir, "operator-token");
  const secret = "operator-secret-token-that-is-long-enough";
  writeFileSync(artifactPath, JSON.stringify({chainId: 31337, router: "0x1"}));
  writeFileSync(eventsPath, JSON.stringify({schemaVersion: 1, events: []}));
  writeFileSync(tokenPath, secret);
  const port = await freePort();
  const env = {
    CORNER_STORE_OPERATOR_CONFIG_VERSION: PRODUCTION_OPERATOR_RUNTIME_CONFIG_VERSION,
    CORNER_STORE_OPERATOR_HOST: "127.0.0.1",
    CORNER_STORE_OPERATOR_PORT: String(port),
    CORNER_STORE_OPERATOR_CONFIG_FILE: configPath,
    CORNER_STORE_OPERATOR_ARTIFACT_FILE: artifactPath,
    CORNER_STORE_OPERATOR_MANIFEST_FILE: manifestPath,
    CORNER_STORE_OPERATOR_EVENTS_FILE: eventsPath,
    CORNER_STORE_OPERATOR_AUTH_TOKEN_FILE: tokenPath
  };
  assertRuntimeConfigRejectsSecretShapedUnknown(env, secret);
  const logs: unknown[] = [];
  const runtime = await startProductionOperatorRuntime({
    env,
    logger: {info: (event) => logs.push(event), error: (event) => logs.push(event)}
  });
  const call = (path: string, token?: string) => httpGet(runtime.baseUrl, path, token);
  if ((await call("/api/v1/health")).status !== 200) throw new Error("production liveness regression");
  if ((await call("/api/v1/ready")).status !== 200) throw new Error("production readiness regression");
  if ((await call("/api/v1/deployment")).status !== 401) throw new Error("production auth regression");
  if ((await call("/api/v1/deployment", secret)).status !== 200) throw new Error("production authenticated read regression");
  writeFileSync(artifactPath, "{");
  if ((await call("/api/v1/ready")).status !== 503) throw new Error("production dependency fail-closed regression");
  if (JSON.stringify(logs).includes(secret)) throw new Error("production runtime log leaked token");
  await Promise.all([runtime.shutdown("SIGTERM"), runtime.shutdown("SIGTERM")]);
}

function assertRuntimeConfigRejectsSecretShapedUnknown(env: NodeJS.ProcessEnv, secret: string): void {
  try {
    loadProductionOperatorRuntimeConfig({...env, CORNER_STORE_OPERATOR_PRIVATE_KEY: secret});
    throw new Error("unknown production environment key was accepted");
  } catch (error) {
    if (!(error instanceof ProductionOperatorRuntimeError) || error.code !== "RUNTIME_CONFIG_INVALID") throw error;
    if (JSON.stringify(error).includes(secret)) throw new Error("runtime config error leaked secret");
  }
  try {
    loadProductionOperatorRuntimeConfig({...env, CORNER_STORE_OPERATOR_HOST: "0.0.0.0"});
    throw new Error("public bind without acknowledgement was accepted");
  } catch (error) {
    if (!(error instanceof ProductionOperatorRuntimeError) || error.code !== "RUNTIME_CONFIG_INVALID") throw error;
  }
  try {
    loadProductionOperatorRuntimeConfig({...env, CORNER_STORE_OPERATOR_SHUTDOWN_TIMEOUT_MS: "60001"});
    throw new Error("unbounded production shutdown timeout was accepted");
  } catch (error) {
    if (!(error instanceof ProductionOperatorRuntimeError) || error.code !== "RUNTIME_CONFIG_INVALID") throw error;
  }
}

async function httpGet(baseUrl: string, path: string, token?: string): Promise<{status: number; body: any}> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "GET",
      headers: token ? {authorization: `Bearer ${token}`} : undefined
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve({status: res.statusCode ?? 0, body: JSON.parse(body)}); }
        catch { resolve({status: res.statusCode ?? 0, body}); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to reserve test port");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
