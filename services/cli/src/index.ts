#!/usr/bin/env node
import {Command} from "commander";

import * as cmd from "./commands";
import {ATTEST_ELEMENTS} from "./elements";
import {CliError, decodeRevert} from "./util";

const program = new Command();

program
  .name("corner-store")
  .description("Interactive reference CLI for the Corner Store compliance-gated DEX stack (CLI-001)")
  .version("0.1.0")
  .option("--rpc <url>", "JSON-RPC endpoint", "http://127.0.0.1:8545")
  .option("--artifact <path>", "deployment artifact JSON (defaults to <repo>/deployments/anvil-e2e.json)")
  .option("--config <path>", "versioned Toolkit config JSON")
  .option("--account <n>", "Anvil mnemonic account index 0-9")
  .option("--key <hex>", "explicit private key (overrides --account)");

program
  .command("toolkit-init")
  .description("create a versioned Corner Store Toolkit config")
  .argument("[path]", "output JSON path", "corner-store.config.json")
  .action(run((path) => cmd.cmdToolkitInit(path)));

program
  .command("toolkit-validate")
  .description("validate a versioned Corner Store Toolkit config")
  .argument("[path]", "config JSON path", "corner-store.config.json")
  .action(run((path) => cmd.cmdToolkitValidate(path)));

program
  .command("toolkit-simulate")
  .description("preview Toolkit deployment and venue binding without sending transactions")
  .argument("[path]", "config JSON path", "corner-store.config.json")
  .action(run((path, command) => cmd.cmdToolkitSimulate(path, command.optsWithGlobals().artifact)));

program
  .command("toolkit-preflight")
  .description("verify config/profile/venue addresses before deployment or onboarding")
  .argument("[path]", "config JSON path", "corner-store.config.json")
  .action(run((path, command) => cmd.cmdToolkitPreflight(path, command.optsWithGlobals().artifact)));

program
  .command("toolkit-onboard")
  .description("preflight a Toolkit config, then onboard its selected asset and venues")
  .argument("[path]", "config JSON path", "corner-store.config.json")
  .action(run((path, command) => cmd.cmdToolkitOnboard(path, command.optsWithGlobals())));

program
  .command("toolkit-checkpoint")
  .description("write an immutable, secret-free deployment checkpoint after preflight")
  .argument("[path]", "config JSON path", "corner-store.config.json")
  .option("--output <path>", "checkpoint JSON output", "deployments/checkpoint.json")
  .option("--deployment-id <id>", "stable deployment identifier")
  .action(run((path, opts, command) => cmd.cmdToolkitCheckpoint(path, opts.output, {...command.optsWithGlobals(), deploymentId: opts.deploymentId})));

program
  .command("toolkit-proposal")
  .description("write a draft, secret-free governance proposal for external multisig review")
  .requiredOption("--target <address>")
  .requiredOption("--calldata <hex>")
  .requiredOption("--reason <text>")
  .requiredOption("--artifact-hash <hash>")
  .option("--approvals <n>", "required multisig approvals", "2")
  .option("--output <path>", "proposal JSON output", "proposal.json")
  .action(run((opts) => cmd.cmdToolkitProposal(opts)));

// Wrap an async command so any revert/error prints a decoded, human reason and
// the process exits non-zero.
function run(fn: (...a: any[]) => Promise<void> | void): (...a: any[]) => Promise<void> {
  return async (...a: any[]) => {
    try {
      await fn(...a);
    } catch (err: any) {
      if (err instanceof CliError) {
        console.error(`Error: ${err.message}`);
      } else {
        const decoded = decodeRevert(err);
        console.error(`Error: ${decoded.detail}`);
      }
      process.exit(1);
    }
  };
}

program
  .command("status")
  .description("deployment addresses, RWA manifest, venues, and per-element attestation state")
  .argument("[address]", "subject address (defaults to --account / account 1)")
  .option("--json", "machine-readable output")
  .action(run((address, opts, command) => cmd.cmdStatus(address, command.optsWithGlobals())));

program
  .command("onboard")
  .description("factory one-call onboarding of the RWA token (retires+re-onboards if ACTIVE)")
  .option("--engines <list>", "supported engines, comma-separated (amm,rfq)", "amm,rfq")
  .option("--profile <profile>", "asset profile: buidl-like or reg-d (must match deployment artifact)")
  .action(run((opts, command) => cmd.cmdOnboard(command.optsWithGlobals())));

program
  .command("manifest")
  .description("drive the RWA manifest lifecycle")
  .argument("<action>", "status | suspend | resume | retire")
  .option("--reason <str>", "reason code string (<=31 chars)")
  .action(run((action, opts, command) => cmd.cmdManifest(action, command.optsWithGlobals())));

program
  .command("attest")
  .description(`write an element attestation (element in: ${ATTEST_ELEMENTS.join(", ")})`)
  .argument("<element>")
  .argument("<subject>")
  .argument("[value...]")
  .action(run((element, subject, value, opts, command) => cmd.cmdAttest(element, subject, value, command.optsWithGlobals())));

program
  .command("investor-setup")
  .description("apply the selected asset profile's investor attestations + QUOTE funding")
  .argument("<address>")
  .option("--profile <profile>", "asset profile: buidl-like or reg-d (must match deployment artifact)")
  .option("--fund <amount>", "QUOTE to mint to the investor (ether units; profile default when omitted)")
  .action(run((address, opts, command) => cmd.cmdInvestorSetup(address, command.optsWithGlobals())));

program
  .command("kyc")
  .description("deploy an ERC-3643 identity + KYC claim via forge script (run from repo root)")
  .argument("<address>")
  .action(run((address, opts, command) => cmd.cmdKyc(address, command.optsWithGlobals())));

program
  .command("buy")
  .description("execute a buy through the router (AMM default; RFQ requires --quote)")
  .argument("<amountIn>", "input amount in ether units (ignored for --venue rfq; taken from the quote)")
  .option("--venue <venue>", "amm | rfq", "amm")
  .option("--min <amountOut>", "minimum acceptable output (ether units)")
  .option("--quote <file>", "signed RFQ quote JSON (required for --venue rfq)")
  .action(run((amountIn, opts, command) => cmd.cmdBuy(amountIn, command.optsWithGlobals())));

program
  .command("rfq-quote")
  .description("request a demo-backend quote or sign one locally, then write it to a file")
  .option("--backend <url>", "RFQ demo backend base URL")
  .option("--maker-account <n>", "local-signing maker/dealer Anvil account index")
  .requiredOption("--amount-in <x>", "taker QUOTE in (ether units)")
  .option("--amount-out <y>", "local-signing maker RWA out (ether units)")
  .option("--taker <addr>", "taker address (defaults to the artifact investor)")
  .option("--expiry <sec>", "quote TTL in seconds", "3600")
  .option("--out <file>", "output path", "quote.json")
  .action(run((opts, command) => cmd.cmdRfqQuote(command.optsWithGlobals())));

program
  .command("rfq-cancel")
  .description("cancel a maker quote nonce")
  .argument("<nonce>")
  .requiredOption("--maker-account <n>", "maker Anvil account index")
  .action(run((nonce, opts, command) => cmd.cmdRfqCancel(nonce, command.optsWithGlobals())));

program
  .command("maker")
  .description("manage the RFQ maker allowlist")
  .argument("<action>", "approve | revoke")
  .argument("<address>")
  .action(run((action, address, opts, command) => cmd.cmdMaker(action, address, command.optsWithGlobals())));

program
  .command("reason")
  .description("decode a ComplianceRejected reason code (bytes32)")
  .argument("<bytes32>")
  .option("--json", "machine-readable output")
  .action(run((code, opts, command) => cmd.cmdReason(code, command.optsWithGlobals())));

program
  .command("check")
  .description("per-element compliance preflight for a buyer WITHOUT trading (+ overall engine verdict)")
  .argument("<buyer>", "address to screen (engine screens ctx.buyer; asset-side elements ignore it)")
  .option("--venue <venue>", "amm | rfq", "amm")
  .option("--amount <n>", "trade amount in ether units", "1")
  .option("--json", "machine-readable output")
  .action(run((buyer, opts, command) => cmd.cmdCheck(buyer, command.optsWithGlobals())));

program
  .command("sell")
  .description("execute an AMM sell (tokenIn=RWA, tokenOut=QUOTE); defaults to the investor account 1")
  .argument("<amountIn>", "RWA input amount in ether units")
  .option("--min <amountOut>", "minimum acceptable QUOTE output (ether units)")
  .action(run((amountIn, opts, command) => cmd.cmdSell(amountIn, command.optsWithGlobals())));

program
  .command("balances")
  .description("RWA + QUOTE balances and adapter allowances (defaults to the 5 well-known roles)")
  .argument("[addr...]", "addresses to report (default: accounts 0-4)")
  .option("--json", "machine-readable output")
  .action(run((addr, opts, command) => cmd.cmdBalances(addr, command.optsWithGlobals())));

program
  .command("watch")
  .description("live event tail (polls eth_getLogs ~2s; Ctrl-C to stop)")
  .option("--from <block>", "replay history from this block first")
  .action(run((opts, command) => cmd.cmdWatch(command.optsWithGlobals())));

program
  .command("faucet")
  .description("mint QUOTE to an address (MockERC20.mint is permissionless — demo-only convenience)")
  .argument("<addr>")
  .argument("<amount>", "QUOTE to mint in ether units")
  .action(run((addr, amount, opts, command) => cmd.cmdFaucet(addr, amount, command.optsWithGlobals())));

program
  .command("snapshot")
  .description("take an anvil evm_snapshot and print its id (anvil-only)")
  .action(run((opts, command) => cmd.cmdSnapshot(command.optsWithGlobals())));

program
  .command("restore")
  .description("revert to an anvil snapshot via evm_revert (invalidates later snapshots; anvil-only)")
  .argument("<id>", "snapshot id from `snapshot`")
  .action(run((id, opts, command) => cmd.cmdRestore(id, command.optsWithGlobals())));

program
  .command("quote-inspect")
  .description("inspect a signed RFQ quote JSON: recover signer, expiry, on-chain nonce/approval state")
  .argument("<file>", "signed quote JSON (from rfq-quote)")
  .option("--json", "machine-readable output")
  .action(run((file, opts, command) => cmd.cmdQuoteInspect(file, command.optsWithGlobals())));

program.parseAsync(process.argv);
