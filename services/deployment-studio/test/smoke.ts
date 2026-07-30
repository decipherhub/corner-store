import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "fs";
import {request} from "http";
import {tmpdir} from "os";
import {join, resolve} from "path";

import {
  CommandRequest,
  CommandResult,
  StudioCommandRunner,
  createStudioServer
} from "../src/api";

class FakeRunner implements StudioCommandRunner {
  readonly calls: CommandRequest[] = [];
  doctorReady = true;

  async run(input: CommandRequest, onLine?: (line: string) => void): Promise<CommandResult> {
    this.calls.push(input);
    onLine?.(`running ${input.action}`);
    if (input.action === "create") {
      mkdirSync(input.projectRoot, {recursive: true});
      writeFileSync(join(input.projectRoot, "corner-store.config.json"), JSON.stringify(baseConfig("anvil")));
      writeFileSync(join(input.projectRoot, "corner-store.integration.json"), JSON.stringify(baseIntegration(input.mode ?? "library-only")));
      writeFileSync(join(input.projectRoot, "corner-store.scenario.json"), JSON.stringify({schemaVersion: 2, note: "demo"}));
      return {code: 0, stdout: JSON.stringify({root: input.projectRoot}), stderr: ""};
    }
    if (input.action === "doctor") {
      return {
        code: this.doctorReady ? 0 : 1,
        stdout: JSON.stringify({
          ready: this.doctorReady,
          checks: [{name: "node", required: true, pass: this.doctorReady, detail: "test"}]
        }),
        stderr: ""
      };
    }
    if (input.action === "plan") {
      return {code: 0, stdout: JSON.stringify({profile: "buidl-like", rpcUrl: input.rpcUrl, broadcast: false, command: "forge script", warnings: []}), stderr: ""};
    }
    if (input.action === "deploy") {
      const artifact = {
        assetProfile: "buidl-like",
        rwaToken: "0x1111111111111111111111111111111111111111",
        router: "0x2222222222222222222222222222222222222222",
        rfqAdapter: "0x3333333333333333333333333333333333333333",
        makerAuthorizer: "0x4444444444444444444444444444444444444444",
        rfqVenue: "0x5555555555555555555555555555555555555555"
      };
      mkdirSync(join(input.projectRoot, "deployments"), {recursive: true});
      writeFileSync(join(input.projectRoot, "deployments/anvil-e2e.json"), JSON.stringify(artifact));
      onLine?.("deployment artifact written");
      return {code: 0, stdout: JSON.stringify({broadcast: true}), stderr: ""};
    }
    if (input.action === "verify") {
      return {code: 0, stdout: JSON.stringify({ready: true, checks: [{name: "artifact-router", pass: true, detail: "ok"}]}), stderr: ""};
    }
    return {code: 1, stdout: "", stderr: "unsupported"};
  }
}

async function main(): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), "corner-store-studio-"));
  const runner = new FakeRunner();
  const webRoot = resolve(__dirname, "../../web");
  const sessionToken = "studio-smoke-session-token";
  const server = createStudioServer({
    workspaceRoot: workspace,
    runner,
    webRoot,
    operationsUrl: "http://operations.test",
    defaultRpcUrl: "http://127.0.0.1:18545",
    broadcastNetwork: "anvil",
    allowedRpcHosts: ["127.0.0.1"],
    sessionToken
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("studio API did not bind");
  const call = (method: string, path: string, body?: unknown) =>
    http(address.port, method, path, body, sessionToken);

  const escape = await call("POST", "/api/v1/projects", {name: "../escape", mode: "library-only"});
  if (escape.status !== 400) throw new Error("project path escape was not rejected");
  const unauthorized = await http(address.port, "POST", "/api/v1/projects", {
    name: "unauthorized-project",
    mode: "library-only"
  });
  if (unauthorized.status !== 403) throw new Error("unauthenticated mutation was not rejected");
  const wrongContentType = await http(
    address.port,
    "POST",
    "/api/v1/projects",
    {name: "wrong-content-type", mode: "library-only"},
    sessionToken,
    "text/plain"
  );
  if (wrongContentType.status !== 415) throw new Error("non-JSON mutation was not rejected");
  const externalProject = mkdtempSync(join(tmpdir(), "corner-store-studio-external-"));
  symlinkSync(externalProject, join(workspace, "linked-project"), "dir");
  const linkedProject = await call("GET", "/api/v1/projects/linked-project");
  if (linkedProject.status !== 400 || linkedProject.body.error !== "path_symlink") {
    throw new Error("symlinked project root was not rejected");
  }

  const created = await call("POST", "/api/v1/projects", {name: "treasury-dex", mode: "reference-service", docker: false});
  if (created.status !== 201 || created.body.project.name !== "treasury-dex") throw new Error("project create regression");
  const linkedFileProject = await call("POST", "/api/v1/projects", {
    name: "linked-file-project",
    mode: "library-only"
  });
  if (linkedFileProject.status !== 201) throw new Error("linked-file test project create regression");
  const linkedConfig = join(workspace, "linked-file-project/corner-store.config.json");
  const outsideConfig = join(externalProject, "outside-config.json");
  unlinkSync(linkedConfig);
  symlinkSync(outsideConfig, linkedConfig, "file");
  const linkedFileWrite = await call(
    "PUT",
    "/api/v1/projects/linked-file-project/config",
    baseConfig("anvil")
  );
  if (linkedFileWrite.status !== 400 || linkedFileWrite.body.error !== "path_symlink" || existsSync(outsideConfig)) {
    throw new Error("broken file symlink write escape was not rejected");
  }

  const invalid = await call("PUT", "/api/v1/projects/treasury-dex/config", {
    ...baseConfig("anvil"),
    venues: {amm: false, rfq: false, orderBook: false}
  });
  if (invalid.status !== 400) throw new Error("invalid config was persisted");

  const mainnet = await call("PUT", "/api/v1/projects/treasury-dex/config", baseConfig("mainnet"));
  if (mainnet.status !== 200) throw new Error("mainnet config save regression");
  const forbidden = await call("POST", "/api/v1/projects/treasury-dex/deploy", {rpcUrl: "https://rpc.example"});
  if (forbidden.status !== 403) throw new Error("non-Anvil broadcast was not rejected");

  await call("PUT", "/api/v1/projects/treasury-dex/config", baseConfig("anvil"));
  const prematureDeploy = await call("POST", "/api/v1/projects/treasury-dex/deploy", {rpcUrl: "http://127.0.0.1:8545"});
  if (prematureDeploy.status !== 409) throw new Error("deploy bypassed doctor/dry-run evidence");
  runner.doctorReady = false;
  const blockedDoctor = await call("POST", "/api/v1/projects/treasury-dex/doctor");
  if (blockedDoctor.status !== 200 || blockedDoctor.body.ready !== false) {
    throw new Error("structured doctor failure was not returned to the UI");
  }
  runner.doctorReady = true;
  const doctor = await call("POST", "/api/v1/projects/treasury-dex/doctor");
  if (doctor.status !== 200 || !doctor.body.ready) throw new Error("doctor result regression");
  const plan = await call("POST", "/api/v1/projects/treasury-dex/deploy/plan", {rpcUrl: "http://127.0.0.1:8545"});
  if (plan.status !== 200 || plan.body.broadcast !== false) throw new Error("dry-run result regression");

  const deployment = await call("POST", "/api/v1/projects/treasury-dex/deploy", {rpcUrl: "http://127.0.0.1:8545"});
  if (deployment.status !== 202 || !deployment.body.jobId) throw new Error("deploy job regression");
  let job: any;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await call("GET", `/api/v1/jobs/${deployment.body.jobId}`);
    job = response.body;
    if (job.status !== "running" && job.status !== "queued") break;
    await new Promise((done) => setTimeout(done, 10));
  }
  if (job.status !== "succeeded" || !job.logs.some((line: string) => line.includes("artifact"))) {
    throw new Error("deploy progress regression");
  }

  const artifact = await call("GET", "/api/v1/projects/treasury-dex/artifact");
  if (artifact.status !== 200 || !artifact.body.router) throw new Error("artifact viewer regression");
  const verify = await call("POST", "/api/v1/projects/treasury-dex/verify");
  if (verify.status !== 200 || !verify.body.ready) throw new Error("verify regression");

  const activation = await call("PUT", "/api/v1/projects/treasury-dex/activation", {
    makerApproved: true,
    signerAuthorized: true,
    inventoryReady: true,
    smokeSettlement: true,
    governanceHandoff: false
  });
  if (activation.status !== 200 || !activation.body.artifactVerified) throw new Error("activation state regression");
  const handoff = await call("GET", "/api/v1/projects/treasury-dex/handoff");
  if (handoff.status !== 200 || !handoff.body.enabled || handoff.body.url !== "http://operations.test") {
    throw new Error("operations handoff regression");
  }
  server.close();
  await new Promise<void>((done) => server.once("close", done));

  await assertPlanOnlyRuntimeCannotBroadcast(workspace, runner, webRoot, sessionToken);

  const restarted = createStudioServer({
    workspaceRoot: workspace,
    runner,
    webRoot,
    operationsUrl: "http://operations.test",
    defaultRpcUrl: "http://rpc.test",
    broadcastNetwork: "anvil",
    allowedRpcHosts: ["rpc.test"],
    sessionToken
  });
  await new Promise<void>((done) => restarted.listen(0, "127.0.0.1", done));
  const restartedAddress = restarted.address();
  if (!restartedAddress || typeof restartedAddress === "string") throw new Error("restarted studio API did not bind");
  const restartedCall = (method: string, path: string, body?: unknown) =>
    http(restartedAddress.port, method, path, body, sessionToken);
  const persistedHandoff = await restartedCall("GET", "/api/v1/projects/treasury-dex/handoff");
  if (!persistedHandoff.body.enabled) throw new Error("verified handoff did not survive a service restart");
  writeFileSync(
    join(workspace, "treasury-dex/deployments/anvil-e2e.json"),
    JSON.stringify({router: "0x9999999999999999999999999999999999999999"})
  );
  const externallyInvalidated = await restartedCall("GET", "/api/v1/projects/treasury-dex/handoff");
  if (externallyInvalidated.body.enabled) throw new Error("external artifact mutation did not invalidate verification");
  const reverified = await restartedCall("POST", "/api/v1/projects/treasury-dex/verify");
  if (reverified.status !== 200) throw new Error("artifact re-verification regression");
  const changedConfig = await restartedCall("PUT", "/api/v1/projects/treasury-dex/config", {
    ...baseConfig("anvil"),
    accounts: {operator: "operator-2", investor: "investor", maker: "maker"}
  });
  if (changedConfig.status !== 200) throw new Error("config mutation regression");
  const invalidatedHandoff = await restartedCall("GET", "/api/v1/projects/treasury-dex/handoff");
  if (invalidatedHandoff.body.enabled) throw new Error("config mutation did not invalidate artifact verification");

  const page = await restartedCall("GET", "/");
  if (page.status !== 200 || !String(page.body).includes("Deployment Studio")) throw new Error("studio page regression");
  restarted.close();

  const html = readFileSync(resolve(webRoot, "index.html"), "utf8");
  const app = readFileSync(resolve(webRoot, "app.js"), "utf8");
  const css = readFileSync(resolve(webRoot, "styles.css"), "utf8");
  new Function(app);
  for (const marker of [
    'id="projectMode"', 'id="network"', 'id="assetProfile"', 'id="venueRfq"',
    'id="runDoctor"', 'id="reviewPlan"', 'id="deployDemo"', 'id="verifyArtifact"',
    'id="artifactViewer"', 'id="activationChecklist"', 'id="openOperations"',
    'id="networkPreset"', 'id="contextDialog"', 'id="pricingModuleCustom"',
    "Runtime constraints", "Demo fixtures", "Manual evidence checklist",
    "Arbitrum One · production plan only", "GIWA / organization EVM · plan only"
  ]) {
    if (!html.includes(marker)) throw new Error(`studio UI marker missing: ${marker}`);
  }
  for (const marker of [
    "/api/v1/projects", "saveConfig", "runDoctor", "reviewPlan", "deployDemo",
    "verifyArtifact", "renderArtifact", "refreshHandoff", "EventSource",
    "HELP_CONTENT", "DEMO_BROADCAST_NETWORKS", "selectedNetwork", "selectedModule",
    "openContextHelp"
  ]) {
    if (!app.includes(marker)) throw new Error(`studio UI wiring missing: ${marker}`);
  }
  for (const marker of [
    "--ink:", "--signal:", ".studio-shell", ".rail", ".workflow-map", ".status-led",
    ".artifact-grid", ".boundary-banner", ".help-trigger", ".context-dialog",
    "@media (max-width: 820px)"
  ]) {
    if (!css.includes(marker)) throw new Error(`studio visual token missing: ${marker}`);
  }
  if (/private.?key/i.test(html)) throw new Error("studio must not render a private-key field");
  console.log("corner-store deployment studio smoke ok");
}

async function assertPlanOnlyRuntimeCannotBroadcast(
  workspace: string,
  runner: StudioCommandRunner,
  webRoot: string,
  sessionToken: string
): Promise<void> {
  const server = createStudioServer({
    workspaceRoot: workspace,
    runner,
    webRoot,
    operationsUrl: "http://operations.test",
    defaultRpcUrl: "http://rpc.test",
    broadcastNetwork: "arbitrum-one",
    allowedRpcHosts: ["rpc.test"],
    sessionToken
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("plan-only regression server did not bind");
  const call = (method: string, path: string, body?: unknown) =>
    http(address.port, method, path, body, sessionToken);
  const created = await call("POST", "/api/v1/projects", {
    name: "plan-only-project",
    mode: "library-only"
  });
  if (created.status !== 201) throw new Error("plan-only regression project create failed");
  const saved = await call("PUT", "/api/v1/projects/plan-only-project/config", baseConfig("arbitrum-one"));
  if (saved.status !== 200) throw new Error("plan-only network config save regression");
  const blocked = await call("POST", "/api/v1/projects/plan-only-project/deploy", {
    rpcUrl: "http://rpc.test"
  });
  if (blocked.status !== 403 || blocked.body.error !== "demo_broadcast_only") {
    throw new Error("runtime configuration enabled a plan-only network broadcast");
  }
  server.close();
  await new Promise<void>((done) => server.once("close", done));
}

function baseConfig(network: string): any {
  return {
    schemaVersion: 1,
    deployment: {artifact: "deployments/anvil-e2e.json", network},
    asset: {profile: "buidl-like"},
    venues: {amm: false, rfq: true, orderBook: false},
    accounts: {operator: "operator", investor: "investor", maker: "maker"},
    governance: {multisig: "governance-multisig", requiredApprovals: 2}
  };
}

function baseIntegration(mode: string): any {
  const capability: Record<string, string> = {
    pricing: "rfq.price.v1",
    risk: "rfq.risk.pre-sign.v1",
    signer: "rfq.sign.eip712.v1",
    nonce: "rfq.nonce.maker-scoped.v1"
  };
  return {
    schemaVersion: 1,
    mode,
    sdk: {package: "@corner-store/rfq-service", version: "0.1.0"},
    modules: Object.fromEntries(Object.entries(capability).map(([kind, value]) => [kind, {
      moduleId: `test.${kind}`,
      moduleVersion: "1.0.0",
      capabilities: [value],
      env: []
    }])),
    deployment: {dockerCompose: false}
  };
}

function http(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  sessionToken?: string,
  contentType = "application/json"
): Promise<{status: number; body: any}> {
  return new Promise((resolvePromise, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        ...(method === "POST" || method === "PUT" ? {"content-type": contentType} : {}),
        ...(payload ? {"content-length": Buffer.byteLength(payload)} : {}),
        ...(sessionToken ? {"x-corner-store-session": sessionToken} : {})
      }
    }, (res) => {
      let content = "";
      res.on("data", (chunk) => (content += chunk));
      res.on("end", () => {
        const type = String(res.headers["content-type"] ?? "");
        resolvePromise({
          status: res.statusCode ?? 0,
          body: type.includes("application/json") ? JSON.parse(content || "{}") : content
        });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
