import assert from "node:assert/strict";
import {test} from "node:test";
import {resolve} from "node:path";
import {cmdProductionRecover} from "../src/commands";

// Isolate signing and RPC so a deliberately rebroadcasting mutant cannot submit transactions.
test("production recovery without execution evidence never invokes a signing subprocess", async () => {
  const child = require("node:child_process");
  const production = require("../../toolkit/src/production");
  const evidence = require("../../toolkit/src/production-evidence");
  const publication = require("../../toolkit/src/production-publication").ProductionPublication;
  const saved = [child.execFileSync, production.loadProductionConfig, evidence.buildProductionIdentity,
    evidence.assertProductionBroadcastIdentity, production.loadProductionDeploymentEvidence, publication.resume];
  let signingCalls = 0;
  try {
    const original = child.execFileSync;
    child.execFileSync = (command: string, args: string[], ...rest: any[]) => {
      if (command === "forge" || args?.includes("--broadcast")) {
        signingCalls++;
        throw Error("unexpected signing subprocess");
      }
      return original(command, args, ...rest);
    };
    production.loadProductionConfig = () => ({deployment: {artifact: "absent.json", evidence: "unused-review.json"}});
    evidence.buildProductionIdentity = () => ({identity: {evidenceId: "fixture"}});
    evidence.assertProductionBroadcastIdentity = () => {};
    production.loadProductionDeploymentEvidence = () => ({schemaVersion: 2, evidenceId: "fixture"});
    publication.resume = () => ({output: resolve("absent.json"), events: () => []});
    const contracts = resolve(__dirname, "../../../../..");
    await assert.rejects(cmdProductionRecover("unused.json", {contracts, operation: "fixture"}), /no recoverable production execution/);
    assert.equal(signingCalls, 0);
  } finally {
    [child.execFileSync, production.loadProductionConfig, evidence.buildProductionIdentity,
      evidence.assertProductionBroadcastIdentity, production.loadProductionDeploymentEvidence, publication.resume] = saved;
  }
});
