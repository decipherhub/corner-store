import assert from "node:assert/strict";
import {execFileSync, spawn, ChildProcess} from "node:child_process";
import {createHash} from "node:crypto";
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";

const repo = resolve(__dirname, "../../../../..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "corner-production-packed-")));
const env: NodeJS.ProcessEnv = {...process.env, npm_config_cache: join(root, "npm-cache")};
const run = (cmd: string, args: string[], cwd = root) => execFileSync(cmd, args, {cwd, env, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]}).trim();
async function main(): Promise<void> {
try {
  const pack = join(root, "packages"); mkdirSync(pack);
  const cliPackage = run("npm", ["pack", "./services/cli", "--pack-destination", pack, "--silent"], repo).split("\n").pop()!;
  const toolkitPackage = run("npm", ["pack", "./services/toolkit", "--pack-destination", pack, "--silent"], repo).split("\n").pop()!;
  writeFileSync(join(root, "package.json"), JSON.stringify({private: true, dependencies: {"@corner-store/cli": `file:${join(pack, cliPackage)}`, "@corner-store/toolkit": `file:${join(pack, toolkitPackage)}`}}));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
  const localCli = join(repo, "services/cli/dist/cli/src/index.js");
  const packedCli = join(root, "node_modules/@corner-store/cli/dist/cli/src/index.js");
  const bundled = join(root, "node_modules/@corner-store/cli/bundle/contracts");
  const source = JSON.parse(run(process.execPath, [localCli, "production-source-hash", "--contracts", repo]));
  const packed = JSON.parse(run(process.execPath, [packedCli, "production-source-hash"]));
  assert.equal(source.contractsHash, packed.contractsHash);
  assert.equal(packed.provenance.state, "source-only");
  const config = JSON.parse(readFileSync(join(repo, "services/toolkit/examples/corner-store.production.json"), "utf8"));
  config.release = {sourceCommit: source.sourceCommit, contractsHash: source.contractsHash};
  const configPath = join(root, "production.json"); writeFileSync(configPath, JSON.stringify(config));
  const original = JSON.parse(run(process.execPath, [localCli, "production-plan", configPath, "--contracts", repo]));
  const packaged = JSON.parse(run(process.execPath, [packedCli, "production-plan", configPath]));
  assert.equal(original.build.buildHash, packaged.build.buildHash);
  assert.equal(original.identity.sourceHash, packaged.identity.sourceHash);
  assert.equal(packaged.identity.provenance.state, "source-only");
  assert.notEqual(original.evidenceId, packaged.evidenceId);
  const toolkit = require(join(root, "node_modules/@corner-store/toolkit"));
  const product = require(join(root, "node_modules/@corner-store/cli/dist/cli/src/product.js"));
  const runtime = product.prepareDeploymentRuntime(root, bundled);
  const copied = toolkit.buildProductionIdentity(runtime, config);
  assert.equal(copied.build.buildHash, packaged.build.buildHash);
  assert.equal(copied.identity.evidenceId, packaged.evidenceId);
  assert.equal(copied.source.sourceHash, source.contractsHash);
  assert.throws(() => toolkit.assertProductionBroadcastIdentity(copied.identity, config), /clean Git/);
  console.log("Packed production evidence: 10 commitment assertions passed.");
  await productionConsumer(root, packedCli, bundled, toolkit);
} finally {
  if (process.env.CORNER_STORE_KEEP_PRODUCTION_FIXTURE) console.log(`Retained local production fixture: ${root}`);
  else rmSync(root, {recursive: true, force: true});
}
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

async function productionConsumer(root: string, cli: string, bundled: string, toolkit: any): Promise<void> {
  const {ContractFactory, JsonRpcProvider, NonceManager, Wallet, keccak256} = require("ethers");
  const {createServer} = require("node:net");
  const nodes: ChildProcess[] = [];
  let assertions = 0;
  const check = (pass: boolean, message: string) => { assert(pass, message); assertions++; };
  async function node(extra: string[] = []): Promise<{url: string; provider: any}> {
    const server = createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port; await new Promise<void>((r) => server.close(r));
    const child = spawn("anvil", ["--silent", "--host", "127.0.0.1", "--port", String(port), "--chain-id", "31337", ...extra], {stdio: "ignore"});
    nodes.push(child);
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try {
        const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "eth_chainId", params: []})});
        if (response.ok) return {url, provider: new JsonRpcProvider(url, undefined, {staticNetwork: true})};
      }
      catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    throw Error("isolated Anvil failed to start");
  }
  const consumer = join(root, "production-consumer"); mkdirSync(consumer);
  const contracts = join(root, "clean-contracts"); cpSync(bundled, contracts, {recursive: true});
  const git = (...args: string[]) => run("git", ["-C", contracts, ...args]);
  git("init", "-q"); git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "isolated production source fixture");
  const localHome = join(root, "signer-home");
  let solc: string;
  if (env.FOUNDRY_SOLC !== undefined) {
    assert(env.FOUNDRY_SOLC && existsSync(env.FOUNDRY_SOLC), "FOUNDRY_SOLC must point to an executable solc 0.8.17");
    solc = realpathSync(env.FOUNDRY_SOLC);
    assert.equal(run(solc, ["--version"]).match(/^Version: (\d+\.\d+\.\d+)\+/m)?.[1], "0.8.17", "FOUNDRY_SOLC must report exactly solc 0.8.17");
  } else {
    solc = join(localHome, ".svm/0.8.17/solc-0.8.17"); mkdirSync(dirname(solc), {recursive: true});
    const existingHome = require("node:os").homedir();
    const candidates = [join(existingHome, ".svm/0.8.17/solc-0.8.17"), join(existingHome, ".local/share/svm/0.8.17/solc-0.8.17"), join(existingHome, "Library/Application Support/svm/0.8.17/solc-0.8.17")];
    const installedSolc = candidates.find(existsSync); assert(installedSolc, "pinned Solc is required"); cpSync(installedSolc, solc);
  }
  const testEnv = {...env, HOME: localHome};
  const command = (args: string[], cwd = consumer) => execFileSync(process.execPath, [cli, ...args, "--contracts", contracts], {cwd, env: testEnv, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]});
  const fails = (args: string[], pattern: RegExp, cwd = consumer) => {
    let rejected = false; let diagnostic = "command unexpectedly succeeded";
    try { command(args, cwd); } catch (error: any) { diagnostic = String(error.stderr ?? error.message).slice(-2500); rejected = pattern.test(`${error.stdout ?? ""}\n${error.stderr ?? ""}`); }
    check(rejected, `command must fail: ${args[0]} ${pattern}: ${diagnostic}`);
  };
  const wallet = Wallet.createRandom();
  const keystore = join(localHome, ".foundry/keystores/fixture"); mkdirSync(dirname(keystore), {recursive: true});
  const passwordFile = join(localHome, "password");
  writeFileSync(passwordFile, "isolated-fixture-password", {mode: 0o600});
  const encrypted = JSON.parse(await wallet.encrypt("isolated-fixture-password"));
  encrypted.crypto = encrypted.Crypto; delete encrypted.Crypto;
  writeFileSync(keystore, JSON.stringify(encrypted), {mode: 0o600});
  let provider: any; let forkProvider: any;
  try {
    const live = await node(); provider = live.provider;
    await provider.send("anvil_setBalance", [wallet.address, "0x3635c9adc5dea00000"]);
    const safeRoot = join(root, "safe-fixture"); mkdirSync(join(safeRoot, "src"), {recursive: true});
    writeFileSync(join(safeRoot, "foundry.toml"), '[profile.default]\nsolc="0.8.17"\n');
    writeFileSync(join(safeRoot, "src/Safe.sol"), `pragma solidity 0.8.17;
contract Singleton {}
contract Safe {
  address public immutable masterCopy;
  address private immutable owner;
  constructor(address singleton, address owner_) { masterCopy = singleton; owner = owner_; }
  function getOwners() external view returns(address[] memory result) { result = new address[](1); result[0] = owner; }
  function getThreshold() external pure returns(uint256) { return 1; }
}`);
    run("forge", ["build", "--root", safeRoot, "--offline", "--use", solc]);
    const signer = new NonceManager(wallet.connect(provider));
    const deploy = async (name: string, args: any[]) => {
      const file = JSON.parse(readFileSync(join(safeRoot, `out/Safe.sol/${name}.json`), "utf8"));
      const contract = await new ContractFactory(file.abi, file.bytecode.object, signer).deploy(...args);
      await contract.waitForDeployment(); return contract.getAddress();
    };
    const singleton = await deploy("Singleton", []); const safe = await deploy("Safe", [singleton, wallet.address]);
    const source = JSON.parse(command(["production-source-hash"]));
    check(source.provenance.state === "clean", "explicit Git fixture must be clean");
    const config = JSON.parse(readFileSync(join(repo, "services/toolkit/examples/corner-store.production.json"), "utf8"));
    config.release = {sourceCommit: source.sourceCommit, contractsHash: source.contractsHash};
    config.deployer = wallet.address; config.operator = wallet.address;
    config.network = {name: "isolated-production-test", chainId: 31337, rpcUrl: live.url, approvedRpcHosts: ["127.0.0.1"]};
    config.safe = {address: safe, expectedOwners: [wallet.address], threshold: 1, expectedSingleton: singleton, proxyCodeHash: keccak256(await provider.getCode(safe))};
    config.venues = {amm: true, rfq: true}; delete config.erc3643;
    const path = join(consumer, "production.json"); const save = () => writeFileSync(path, JSON.stringify(config)); save();
    console.log("Packed production consumer: clean Git source and Safe fixture prepared.");
    const plan = JSON.parse(command(["production-plan", path]));
    command(["production-plan", path, "--out", "unsigned.json"]);
    const exported = JSON.parse(readFileSync(join(consumer, "unsigned.json"), "utf8"));
    check(plan.evidenceId === exported.evidenceId, "plan and export identities must match");
    fails(["production-plan", path, "--out", "unsigned.json"], /occupied|exist/i);
    const captured = toolkit.buildProductionIdentity(contracts, config, {keepWorkspace: true});
    try {
      check(captured.build.tools.solc.sha256 === `sha256:${createHash("sha256").update(readFileSync(solc)).digest("hex")}`, "production evidence must commit the selected Solc bytes");
      check(captured.identity.evidenceId === plan.evidenceId, "packed CLI and Toolkit identities must match");
      const blockNumber = Number(await provider.send("eth_blockNumber", []));
      const fork = await node(["--fork-url", live.url, "--fork-block-number", String(blockNumber)]); forkProvider = fork.provider;
      for (const url of [live.url, fork.url]) {
        execFileSync(captured.forgePath, ["script", "script/DeployProductionCore.s.sol:DeployProductionCore", "--root", captured.workspace, "--offline", "--ast", "--use", captured.solcPath, "--rpc-url", url, "--sender", wallet.address], {
          cwd: captured.workspace, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
          env: {...captured.env, CORNER_STORE_DEPLOYER: wallet.address, CORNER_STORE_GOVERNANCE: safe, CORNER_STORE_OPERATOR: wallet.address,
            CORNER_STORE_ENABLE_AMM: "true", CORNER_STORE_ENABLE_RFQ: "true", CORNER_STORE_DEPLOYMENT_ID: config.deploymentId,
            CORNER_STORE_SOURCE_COMMIT: config.release.sourceCommit, CORNER_STORE_CONTRACTS_HASH: config.release.contractsHash}
        });
        check(!existsSync(join(consumer, config.deployment.artifact)), "dry-run/fork must not publish");
      }
      console.log("Packed production consumer: real production-script dry-run and fork passed.");
      mkdirSync(dirname(join(consumer, config.deployment.evidence)), {recursive: true});
      const review = {schemaVersion: 2, configHash: plan.configHash, sourceCommit: config.release.sourceCommit, contractsHash: config.release.contractsHash,
        identity: plan.identity, evidenceId: plan.evidenceId, dryRun: {passed: true, chainId: 31337}, forkSimulation: {passed: true, chainId: 31337, blockNumber}, reviewedAt: new Date().toISOString()};
      writeFileSync(join(consumer, config.deployment.evidence), JSON.stringify(review));
      // A wrong keystore password exercises an actual Forge failure before submission.
      const wrongPassword = join(localHome, "wrong-password"); writeFileSync(wrongPassword, "incorrect", {mode: 0o600});
      const failedConsumer = join(root, "failed-consumer"); cpSync(consumer, failedConsumer, {recursive: true});
      const before = await provider.send("eth_getTransactionCount", [wallet.address, "latest"]);
      fails(["production-deploy", "production.json", "--account", "fixture", "--password-file", wrongPassword, "--confirm", "production-deploy"], /recover without rebroadcasting/, failedConsumer);
      check(!existsSync(join(failedConsumer, config.deployment.artifact)), "failed Forge must not publish");
      check(await provider.send("eth_getTransactionCount", [wallet.address, "latest"]) === before, "failed Forge must not submit transactions");
      const failedReservation = JSON.parse(readFileSync(join(failedConsumer, `${config.deployment.artifact}.reservation/operation.json`), "utf8"));
      fails(["production-recover", "production.json", "--operation", failedReservation.directory], /ENOENT|incomplete|receipts/, failedConsumer);
      check(await provider.send("eth_getTransactionCount", [wallet.address, "latest"]) === before, "recovery of failed Forge must not rebroadcast");
      command(["production-deploy", path, "--account", "fixture", "--password-file", passwordFile, "--confirm", "production-deploy"]);
      console.log("Packed production consumer: broadcast completed and verified before publication.");
      const finalPath = join(consumer, config.deployment.artifact); const original = readFileSync(finalPath);
      const record = JSON.parse(original.toString());
      check(record.evidenceId === plan.evidenceId, "deploy must preserve the reviewed identity");
      check(record.transactions.length === 28 && record.receipts.length === 28, "production must bind all 28 transactions and receipts");
      const result = JSON.parse(command(["production-verify", path, "--expected-record-digest", record.recordDigest]));
      check(result.ready === true && result.evidenceId === plan.evidenceId, "live verification must preserve identity");
      fails(["production-deploy", path, "--account", "fixture", "--password-file", passwordFile, "--confirm", "production-deploy"], /occupied|exist/i);
      check(readFileSync(finalPath).equals(original), "occupied artifact bytes must remain unchanged");
      fails(["production-verify", path, "--expected-record-digest", `sha256:${"0".repeat(64)}`], /expected.*digest/i);
      for (const field of ["source", "build", "identity", "artifact", "transactions", "receipts"]) {
        const tampered = structuredClone(record);
        if (field === "artifact") tampered.artifact.router = safe;
        else if (field === "source") tampered.source.sourceHash = `sha256:${"0".repeat(64)}`;
        else if (field === "build") tampered.build.tools.forge.sha256 = `sha256:${"0".repeat(64)}`;
        else if (field === "identity") tampered.identity.chainId++;
        else tampered[field] = [];
        const file = join(consumer, `tampered-${field}.json`); writeFileSync(file, JSON.stringify(tampered));
        fails(["production-verify", path, "--artifact", file, "--expected-record-digest", record.recordDigest], /mismatch|commitment|identity/i);
      }
      // Even recomputed self-consistent records must match trusted receipts and compiler output.
      for (const mutate of [
        (r: any) => { r.artifact.router = safe; },
        (r: any) => { r.artifact.chainId++; },
        (r: any) => { r.receipts[0].status = "0x0"; },
        (r: any) => { r.transactions[0].transaction.input = "0x1234"; }
      ]) {
        const changed = structuredClone(record); mutate(changed);
        const rebound = toolkit.bindProductionRecord(changed.identity, changed.artifact, changed.transactions, changed.receipts, {source: changed.source, build: changed.build});
        const file = join(consumer, "rebound.json"); writeFileSync(file, JSON.stringify(rebound));
        fails(["production-verify", path, "--artifact", file, "--expected-record-digest", rebound.recordDigest], /mismatch|failed/i);
      }
      const afterDeploy = await provider.send("eth_getTransactionCount", [wallet.address, "latest"]);
      for (const linked of [false, true]) {
        const recoveryConsumer = join(root, `recovery-${linked}`); mkdirSync(recoveryConsumer);
        writeFileSync(join(recoveryConsumer, "production.json"), JSON.stringify(config));
        mkdirSync(dirname(join(recoveryConsumer, config.deployment.evidence)), {recursive: true});
        writeFileSync(join(recoveryConsumer, config.deployment.evidence), JSON.stringify(review));
        const output = join(recoveryConsumer, config.deployment.artifact);
        const operation = toolkit.ProductionPublication.reserve(output, (phase: string) => { if (linked && phase === "after-link") throw Error("interruption"); });
        operation.prepare(original, () => {});
        if (linked) assert.throws(() => operation.publish(() => {}), /interruption/);
        const snapshot = await provider.send("evm_snapshot", []);
        await provider.send("anvil_setCode", [record.artifact.router, "0x00"]);
        fails(["production-recover", "production.json", "--operation", operation.directory], /bytecode mismatch/, recoveryConsumer);
        check(existsSync(output) === linked, "failed recovery must preserve publication state");
        await provider.send("evm_revert", [snapshot]);
        const recovered = JSON.parse(command(["production-recover", "production.json", "--operation", operation.directory], recoveryConsumer));
        check(recovered.recovered === true && recovered.evidenceId === plan.evidenceId, "recovery identity must match");
        check(readFileSync(output).equals(original), "recovery must retain exact envelope bytes");
        check(await provider.send("eth_getTransactionCount", [wallet.address, "latest"]) === afterDeploy, "recovery must never rebroadcast");
      }
      const receiptConsumer = join(root, "recovery-receipts"); mkdirSync(receiptConsumer);
      writeFileSync(join(receiptConsumer, "production.json"), JSON.stringify(config));
      mkdirSync(dirname(join(receiptConsumer, config.deployment.evidence)), {recursive: true});
      writeFileSync(join(receiptConsumer, config.deployment.evidence), JSON.stringify(review));
      const receiptOperation = toolkit.ProductionPublication.reserve(join(receiptConsumer, config.deployment.artifact));
      const workspace = join(receiptOperation.directory, "corner-production-build-receipts");
      mkdirSync(join(workspace, "deployments"), {recursive: true});
      writeFileSync(join(workspace, "deployments/production-core.candidate.json"), JSON.stringify(record.artifact));
      const broadcastDirectory = join(workspace, "broadcast/DeployProductionCore.s.sol/31337"); mkdirSync(broadcastDirectory, {recursive: true});
      writeFileSync(join(broadcastDirectory, "run-latest.json"), JSON.stringify({transactions: record.transactions, receipts: []}));
      receiptOperation.journal("executing", {workspace: "corner-production-build-receipts", evidenceId: plan.evidenceId});
      const recoveredReceipts = JSON.parse(command(["production-recover", "production.json", "--operation", receiptOperation.directory], receiptConsumer));
      check(recoveredReceipts.recovered === true && recoveredReceipts.evidenceId === plan.evidenceId, "recovery must retrieve missing receipt snapshots from the chain");
      check(await provider.send("eth_getTransactionCount", [wallet.address, "latest"]) === afterDeploy, "receipt recovery must never rebroadcast");
      check(toolkit.readProductionProvenance(contracts).state === "clean", "explicit source fixture remains clean");
      console.log(`Packed production consumer: ${assertions} assertions passed (real dry-run/fork, export, 28-transaction deploy, verify, tampering and recovery).`);
    } finally { captured.dispose(); }
  } finally {
    provider?.destroy(); forkProvider?.destroy();
    await Promise.all(nodes.map((child) => new Promise<void>((r) => { if (child.exitCode !== null) r(); else { child.once("exit", () => r()); child.kill("SIGTERM"); } })));
  }
}
