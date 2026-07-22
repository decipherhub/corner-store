#!/usr/bin/env node
import {loadConfig, usage} from "./config";
import {startDemoServer} from "./server";

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const config = loadConfig();
  const running = await startDemoServer(config);
  console.log(`Corner Store RFQ demo backend listening at ${running.baseUrl}`);
  console.log(`  artifact=${config.artifactPath}`);
  console.log(`  maker=${await config.makerWallet.getAddress()}`);
  console.log(`  POST ${running.baseUrl}/rfq/quote`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
