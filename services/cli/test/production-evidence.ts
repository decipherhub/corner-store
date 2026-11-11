import assert from "node:assert/strict";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {after, test} from "node:test";
import {cmdProductionSourceHash, cmdProductionPlan, cmdProductionDeploy, cmdProductionVerify} from "../src/commands";
import {bindProductionRecord, captureProductionSource, copyProductionSource} from "../../toolkit/src/production-evidence";
import {prepareDeploymentRuntime} from "../src/product";

const root = mkdtempSync(join(tmpdir(), "corner-cli-production-"));
const contracts = join(root, "contracts");
const consumer = join(root, "consumer");
const repo = resolve(__dirname, "../../../../..");
after(() => rmSync(root, {recursive: true, force: true}));
function put(path: string, bytes: string): void { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, bytes); }
put(join(contracts, "foundry.toml"), '[profile.default]\nsolc="0.8.17"\noptimizer=true\noptimizer_runs=200\n');
put(join(contracts, "remappings.txt"), "");
put(join(contracts, "src/Core.sol"), "pragma solidity 0.8.17; contract Core {}\n");
put(join(contracts, "script/DeployStack.s.sol"), "pragma solidity 0.8.17; contract DeployStack {}\n");
put(join(contracts, "script/ProductionCoreDeployer.sol"), 'pragma solidity 0.8.17; import "../src/Core.sol"; contract ProductionCoreDeployer {}\n');
put(join(contracts, "script/DeployProductionCore.s.sol"), 'pragma solidity 0.8.17; import "./ProductionCoreDeployer.sol"; contract DeployProductionCore is ProductionCoreDeployer {}\n');
for (const service of ["cli", "toolkit", "rfq"]) {
  const target = join(contracts, "services", service); mkdirSync(target, {recursive: true});
  for (const path of ["package.json", "package-lock.json", "tsconfig.json", "src"]) cpSync(join(repo, "services", service, path), join(target, path), {recursive: true});
}
put(join(contracts, "services/cli/scripts/prepare-package.mjs"), readFileSync(join(repo, "services/cli/scripts/prepare-package.mjs"), "utf8"));
mkdirSync(consumer);
const config = JSON.parse(readFileSync(join(repo, "services/toolkit/examples/corner-store.production.json"), "utf8"));
const source = captureProductionSource(contracts);
config.release = {sourceCommit: "a".repeat(40), contractsHash: source.sourceHash};
put(join(consumer, "production.json"), JSON.stringify(config));
function output(fn: () => void): any {
  const old = console.log; let result = "";
  try { console.log = (value) => { result += String(value); }; fn(); } finally { console.log = old; }
  return JSON.parse(result);
}
function inConsumer<T>(fn: () => T): T {
  const cwd = process.cwd(); process.chdir(consumer);
  try { return fn(); } finally { process.chdir(cwd); }
}

test("CLI source-hash includes versioned manifest and explicit source-only provenance", () => {
  const value = output(() => cmdProductionSourceHash({contracts}));
  assert.equal(value.contractsHash, source.sourceHash);
  assert.equal(value.source.schemaVersion, 2);
  assert.equal(value.provenance.state, "source-only");
  assert(value.source.manifest.some((entry: any) => entry.path === "script/ProductionCoreDeployer.sol"));
  assert.throws(() => cmdProductionSourceHash({contracts: join(root, "missing")}), /not found/);
  const productionOnly = join(root, "production-only");
  copyProductionSource(contracts, productionOnly, source);
  assert.equal(output(() => cmdProductionSourceHash({contracts: productionOnly})).contractsHash, source.sourceHash);
});

test("CLI plan and unsigned export share the rebuilt identity", () => inConsumer(() => {
  const plan = output(() => cmdProductionPlan("production.json", {contracts}));
  const out = join(consumer, "unsigned.json");
  output(() => cmdProductionPlan("production.json", {contracts, out}));
  const exported = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(plan.evidenceId, exported.evidenceId);
  assert.equal(plan.build.buildHash, exported.build.buildHash);
  assert.equal(plan.source.sourceHash, source.sourceHash);
  assert.equal(plan.identity.provenance.state, "source-only");
  assert(!plan.command.includes("--broadcast"));
}));

test("CLI production deploy rejects legacy review evidence and source-only broadcast before RPC", async () => {
  const cwd = process.cwd(); process.chdir(consumer);
  try {
    const plan = output(() => cmdProductionPlan("production.json", {contracts}));
    const review = {schemaVersion: 1, configHash: plan.configHash, sourceCommit: config.release.sourceCommit,
      contractsHash: source.sourceHash, dryRun: {passed: true, chainId: config.network.chainId},
      forkSimulation: {passed: true, chainId: config.network.chainId, blockNumber: 1}, reviewedAt: "2026-11-11T00:00:00Z"};
    put(join(consumer, config.deployment.evidence), JSON.stringify(review));
    const opts = {contracts, account: "fixture", confirm: "production-deploy"};
    await assert.rejects(cmdProductionDeploy("production.json", opts), /version 2|schema.*2/);
    put(join(consumer, config.deployment.evidence), JSON.stringify({...review, schemaVersion: 2, identity: plan.identity, evidenceId: plan.evidenceId}));
    await assert.rejects(cmdProductionDeploy("production.json", opts), /clean Git/);
    assert(!existsSync(join(consumer, config.deployment.artifact)));
  } finally { process.chdir(cwd); }
});

test("CLI verify rejects tampered versioned record before RPC", async () => {
  const cwd = process.cwd(); process.chdir(consumer);
  try {
    const plan = output(() => cmdProductionPlan("production.json", {contracts}));
    const record = bindProductionRecord(plan.identity, {schemaVersion: 1}, [], [], {source: plan.source, build: plan.build});
    put(join(consumer, config.deployment.artifact), JSON.stringify({...record, artifact: {schemaVersion: 99}}));
    await assert.rejects(cmdProductionVerify("production.json", {contracts}), /commitment mismatch/);
  } finally { process.chdir(cwd); }
});

test("runtime copying retains and validates the packaged production manifest", () => {
  const bundle = join(root, "bundle");
  cpSync(contracts, bundle, {recursive: true});
  for (const path of ["test/fixtures", "test/mocks", "lib/openzeppelin-contracts/contracts", "lib/openzeppelin-contracts-upgradeable/contracts", "lib/solidity/contracts", "lib/ERC-3643/contracts", "lib/forge-std/src"]) mkdirSync(join(bundle, path), {recursive: true});
  copyProductionSource(contracts, bundle, source);
  const runtime = prepareDeploymentRuntime(consumer, bundle);
  assert.equal(captureProductionSource(runtime).sourceHash, source.sourceHash);
  put(join(bundle, "script/ProductionCoreDeployer.sol"), "tampered");
  assert.throws(() => prepareDeploymentRuntime(consumer, bundle), /manifest|mismatch|Compiler/);
});
