import {resolve} from "path";

import {NodeCliRunner, createStudioServer} from "./api";

const host = process.env.CORNER_STORE_STUDIO_HOST ?? process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.CORNER_STORE_STUDIO_PORT ?? process.env.PORT ?? 8791);
const repoRoot = resolve(__dirname, "../../..");
const workspaceRoot = resolve(process.env.CORNER_STORE_STUDIO_ROOT ?? resolve(repoRoot, ".corner-store/studio-projects"));
const cliEntry = resolve(process.env.CORNER_STORE_CLI_ENTRY ?? resolve(repoRoot, "services/cli/dist/cli/src/index.js"));
const webRoot = resolve(__dirname, "../../web");
const operationsUrl = process.env.CORNER_STORE_OPERATIONS_URL ?? "http://127.0.0.1:8790";
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

const server = createStudioServer({
  workspaceRoot,
  runner: new NodeCliRunner(cliEntry, defaultRpcUrl),
  webRoot,
  operationsUrl,
  defaultRpcUrl,
  broadcastNetwork,
  allowedRpcHosts
});

server.listen(port, host, () => {
  console.log(`Corner Store Deployment Studio listening at http://${host}:${port}`);
  console.log(`Workspace: ${workspaceRoot}`);
});
