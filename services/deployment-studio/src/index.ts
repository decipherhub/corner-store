import {resolve} from "path";

import {NodeCliRunner, createStudioServer} from "./api";
import {NodeDexRuntimeManager} from "./runtime";

const host = process.env.CORNER_STORE_STUDIO_HOST ?? process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.CORNER_STORE_STUDIO_PORT ?? process.env.PORT ?? 8791);
const repoRoot = resolve(__dirname, "../../../..");
const workspaceRoot = resolve(process.env.CORNER_STORE_STUDIO_ROOT ?? resolve(repoRoot, ".corner-store/studio-projects"));
const cliEntry = resolve(process.env.CORNER_STORE_CLI_ENTRY ?? resolve(repoRoot, "services/cli/dist/cli/src/index.js"));
const webRoot = resolve(__dirname, "../../web");
const operationsUrl = process.env.CORNER_STORE_OPERATIONS_URL ?? "http://127.0.0.1:8790";
const operationsTarget = new URL(operationsUrl);
const dexBindHost = process.env.CORNER_STORE_DEX_BIND_HOST ?? "127.0.0.1";
const dexPublicHost = process.env.CORNER_STORE_DEX_PUBLIC_HOST ?? operationsTarget.hostname;
const rfqBackendPort = Number(process.env.CORNER_STORE_RFQ_BACKEND_PORT ?? 8787);
const operatorApiPort = Number(process.env.CORNER_STORE_OPERATOR_API_PORT ?? 8788);
const dashboardPort = Number((process.env.CORNER_STORE_DASHBOARD_PORT ?? operationsTarget.port) || 8790);
const dexChainId = Number(process.env.CORNER_STORE_DEX_CHAIN_ID ?? 31337);
const defaultRpcUrl = process.env.CORNER_STORE_DEFAULT_RPC ?? "http://127.0.0.1:8545";
const broadcastNetwork = process.env.CORNER_STORE_BROADCAST_NETWORK ?? "anvil";
const allowedRpcHosts = (process.env.CORNER_STORE_ALLOWED_RPC_HOSTS ?? "127.0.0.1,localhost,::1")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("CORNER_STORE_STUDIO_PORT/PORT must be an integer from 1 to 65535.");
}
if (allowedRpcHosts.length === 0) {
  throw new Error("CORNER_STORE_ALLOWED_RPC_HOSTS must contain at least one hostname.");
}

const runtimeManager = new NodeDexRuntimeManager({
  repoRoot,
  bindHost: dexBindHost,
  publicHost: dexPublicHost,
  chainId: dexChainId,
  rfqBackendPort,
  operatorApiPort,
  dashboardPort
});

const server = createStudioServer({
  workspaceRoot,
  runner: new NodeCliRunner(cliEntry, defaultRpcUrl),
  webRoot,
  operationsUrl,
  defaultRpcUrl,
  broadcastNetwork,
  allowedRpcHosts,
  runtimeManager
});

server.listen(port, host, () => {
  console.log(`Corner Store Deployment Studio listening at http://${host}:${port}`);
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`DEX handoff: ${operationsUrl} (artifact-bound, local only)`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await runtimeManager.stop();
    server.close(() => process.exit(0));
  });
}
