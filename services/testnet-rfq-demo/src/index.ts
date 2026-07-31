import {loadConfig} from "./config";
import {TestnetRfqRuntime} from "./runtime";
import {startServer} from "./server";

async function main() {
  const runtime = await TestnetRfqRuntime.create(loadConfig());
  await startServer(runtime);
  console.log(`Corner Store public-testnet RFQ demo: http://${runtime.config.host}:${runtime.config.port}`);
  console.log(`chain=${runtime.config.artifact.chainId} deployment=${runtime.config.artifact.deploymentId}`);
  console.log("The browser wallet signs approvals and Router settlements; the server signs maker quotes only.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
