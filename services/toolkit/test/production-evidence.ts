import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {after, test} from "node:test";
import {
  assertProductionBroadcastIdentity, buildProductionIdentity, canonicalProductionJson, createProductionIdentity,
  captureProductionSource, copyProductionSource, productionDigest, readProductionProvenance,
  sanitizedProductionEnv, productionPackageDigest, verifyProductionManifest, bindProductionRecord, verifyProductionRecord
} from "../src/production-evidence";
import {createProductionDeploymentPlan, validateProductionDeploymentEvidence} from "../src/production";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, {recursive: true, force: true})));
function temp(): string {
  const root = mkdtempSync(join(tmpdir(), "corner-evidence-test-"));
  roots.push(root);
  return root;
}
function put(root: string, path: string, value: string): void {
  mkdirSync(dirname(join(root, path)), {recursive: true});
  writeFileSync(join(root, path), value);
}
const repo = resolve(__dirname, "../../../..");
function fixture(): string {
  const root = temp();
  put(root, "foundry.toml", '[profile.default]\nsolc = "0.8.17"\noptimizer = true\noptimizer_runs = 200\n');
  put(root, "remappings.txt", "fixture/=src/\n");
  put(root, "script/DeployProductionCore.s.sol", 'pragma solidity 0.8.17;\nimport {ProductionCoreDeployer} from "./ProductionCoreDeployer.sol";\ncontract DeployProductionCore is ProductionCoreDeployer {}\n');
  put(root, "script/ProductionCoreDeployer.sol", 'pragma solidity 0.8.17;\nimport {Core} from "fixture/Core.sol";\ncontract ProductionCoreDeployer { function deploy() external returns (Core) { return new Core(); } }\n');
  put(root, "src/Core.sol", 'pragma solidity 0.8.17; contract Core { uint public immutable value = 1; }\n');
  for (const service of ["cli", "toolkit", "rfq"]) {
    for (const path of ["package.json", "package-lock.json", "tsconfig.json"]) {
      cpSync(join(repo, "services", service, path), join(mkdir(root, `services/${service}`), path));
    }
    put(root, `services/${service}/src/index.ts`, 'export const wiring = "original";\n');
  }
  put(root, "services/cli/scripts/prepare-package.mjs", "// package orchestration\n");
  return root;
}
function mkdir(root: string, path: string): string { const p = join(root, path); mkdirSync(p, {recursive: true}); return p; }
const config = JSON.parse(readFileSync(join(repo, "services/toolkit/examples/corner-store.production.json"), "utf8"));
function configured(source: ReturnType<typeof captureProductionSource>) {
  return {...config, release: {sourceCommit: source.provenance.head ?? "a".repeat(40), contractsHash: source.sourceHash}};
}
function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", env: {...process.env, GIT_CONFIG_NOSYSTEM: "1"}}).trim();
}

test("canonical commitments sort keys, preserve bytes and separate domains", () => {
  assert.equal(canonicalProductionJson({b: 1, a: [2, 3]}), '{"a":[2,3],"b":1}');
  assert.equal(productionDigest("a", {b: 1, a: 2}), productionDigest("a", {a: 2, b: 1}));
  assert.notEqual(productionDigest("a", "x"), productionDigest("b", "x"));
  assert.throws(() => canonicalProductionJson({bad: undefined}));
});

test("manifest derives every compiler source and binds every orchestration input", () => {
  const root = fixture();
  const source = captureProductionSource(root);
  assert(source.manifest.some((entry) => entry.path === "script/ProductionCoreDeployer.sol"));
  assert.deepEqual(Object.keys(source.standardJsonInput.sources).sort(), ["script/DeployProductionCore.s.sol", "script/ProductionCoreDeployer.sol", "src/Core.sol"]);
  for (const entry of source.manifest) {
    const original = readFileSync(join(root, entry.path));
    writeFileSync(join(root, entry.path), Buffer.concat([original, Buffer.from("\n")]));
    assert.throws(() => verifyProductionManifest(root, source), /manifest|input|mismatch/);
    writeFileSync(join(root, entry.path), original);
  }
  put(root, "script/ProductionCoreDeployer.sol", readFileSync(join(root, "script/ProductionCoreDeployer.sol"), "utf8") + "\n// changed deployer\n");
  assert.notEqual(captureProductionSource(root).sourceHash, source.sourceHash);
});

test("adding and removing imports changes the source commitment; missing or escaping imports reject", () => {
  const root = fixture();
  const initial = captureProductionSource(root);
  const path = "script/DeployProductionCore.s.sol";
  const original = readFileSync(join(root, path), "utf8");
  put(root, "src/Extra.sol", "pragma solidity 0.8.17; contract Extra {}\n");
  put(root, path, original + 'import "../src/Extra.sol";\n');
  const added = captureProductionSource(root);
  assert.notEqual(added.sourceHash, initial.sourceHash);
  assert(added.manifest.some((entry) => entry.path === "src/Extra.sol"));
  put(root, path, original);
  assert.equal(captureProductionSource(root).sourceHash, initial.sourceHash);
  put(root, path, original + 'import "../src/Missing.sol";\n');
  assert.throws(() => captureProductionSource(root));
  const outside = temp(); put(outside, "Outside.sol", "pragma solidity 0.8.17; contract Outside {}\n");
  put(root, path, original + `import "${outside}/Outside.sol";\n`);
  assert.throws(() => captureProductionSource(root));
});

test("manifest rejects symlinks, duplicate paths and missing inputs", () => {
  const root = fixture();
  const source = captureProductionSource(root);
  const original = readFileSync(join(root, "src/Core.sol"));
  const outside = temp(); put(outside, "Core.sol", original.toString());
  rmSync(join(root, "src/Core.sol")); symlinkSync(join(outside, "Core.sol"), join(root, "src/Core.sol"));
  assert.throws(() => captureProductionSource(root), /symlink/);
  assert.throws(() => verifyProductionManifest(root, {...source, manifest: [source.manifest[0], ...source.manifest]}), /duplicate|manifest/);
  rmSync(join(root, "src/Core.sol")); put(root, "src/Core.sol", original.toString());
  rmSync(join(root, "remappings.txt"));
  assert.throws(() => captureProductionSource(root));
});

test("provenance detects clean, staged, unstaged, untracked, submodule, source-only and unavailable states", () => {
  const root = temp(); put(root, "tracked", "one");
  assert.equal(readProductionProvenance(root).state, "source-only");
  git(root, "init", "-q"); git(root, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "add", ".");
  git(root, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-qm", "fixture");
  assert.equal(readProductionProvenance(root).state, "clean");
  put(root, "tracked", "two"); assert.equal(readProductionProvenance(root).state, "dirty");
  git(root, "add", "tracked"); assert.equal(readProductionProvenance(root).state, "dirty");
  git(root, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-qm", "two");
  put(root, "new", "untracked"); assert.equal(readProductionProvenance(root).state, "dirty"); rmSync(join(root, "new"));
  const sub = temp(); put(sub, "tracked", "sub"); git(sub, "init", "-q"); git(sub, "add", ".");
  git(sub, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-qm", "sub");
  git(root, "-c", "protocol.file.allow=always", "submodule", "add", "-q", sub, "sub");
  git(root, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-qam", "submodule");
  assert.equal(readProductionProvenance(root).state, "clean");
  put(root, "sub/untracked", "change"); assert.equal(readProductionProvenance(root).state, "dirty");
  const broken = temp(); put(broken, ".git", "gitdir: missing\n");
  assert.equal(readProductionProvenance(broken).state, "unavailable");
  const nested = mkdir(root, "source-only-bundle");
  assert.equal(readProductionProvenance(nested).state, "source-only");
});

test("sanitized environment excludes inherited build and Git overrides", () => {
  const env = sanitizedProductionEnv(temp(), {PATH: process.env.PATH, FOUNDRY_PROFILE: "evil", FOUNDRY_OPTIMIZER: "false", DAPP_LIBRARIES: "evil", SOLC: "evil", NODE_OPTIONS: "evil", GIT_DIR: "evil"});
  assert.equal(env.FOUNDRY_PROFILE, "default");
  for (const key of ["FOUNDRY_OPTIMIZER", "DAPP_LIBRARIES", "SOLC", "NODE_OPTIONS", "GIT_DIR"]) assert.equal(env[key], undefined);
});

test("isolated builds bind tools, compiler settings, bytecode and immutable references", () => {
  const root = fixture(); const source = captureProductionSource(root); const c = configured(source);
  const built = buildProductionIdentity(root, c);
  assert.equal(built.source.sourceHash, source.sourceHash);
  assert(built.build.tools.forge.version.includes("1.7.1"));
  assert(built.build.tools.solc.version.includes("0.8.17"));
  assert(built.build.tools.node.version.startsWith("v20."));
  assert(built.build.tools.typescript.version);
  assert.deepEqual(Object.keys(built.build.standardJsonInput).sort(), ["language", "settings", "sources"]);
  assert.throws(() => createProductionDeploymentPlan(c, {kind: "ledger"}, true, built.identity), /clean Git/);
  assert(Object.keys(built.build.contracts["src/Core.sol:Core"].immutableReferences).length > 0);
  assert.equal(createProductionDeploymentPlan(c, {kind: "none"}, false, built.identity).evidenceId, built.identity.evidenceId);
  const changed = {...c, deploymentId: `${c.deploymentId}-other`};
  assert.notEqual(buildProductionIdentity(root, changed).identity.evidenceId, built.identity.evidenceId);
  put(root, "foundry.toml", readFileSync(join(root, "foundry.toml"), "utf8").replace("200", "201"));
  const next = captureProductionSource(root);
  const rebuilt = buildProductionIdentity(root, configured(next));
  assert.notEqual(rebuilt.build.buildHash, built.build.buildHash);
  assert.throws(() => assertProductionBroadcastIdentity(built.identity, c), /clean/);
});

test("copied source-only package and runtime retain source and build commitments", () => {
  const root = fixture(); const source = captureProductionSource(root); const c = configured(source);
  const original = buildProductionIdentity(root, c);
  const pkg = temp(); copyProductionSource(root, pkg, source);
  const runtime = temp(); copyProductionSource(pkg, runtime, captureProductionSource(pkg));
  for (const target of [pkg, runtime]) {
    const built = buildProductionIdentity(target, c);
    assert.equal(built.source.sourceHash, original.source.sourceHash);
    assert.equal(built.build.buildHash, original.build.buildHash);
    assert.equal(built.identity.evidenceId, original.identity.evidenceId);
    assert.equal(built.source.provenance.state, "source-only");
  }
  put(pkg, "src/Core.sol", "tampered");
  assert.throws(() => copyProductionSource(pkg, temp(), source), /manifest|mismatch/);
});

test("versioned review evidence and records bind identity without circular hashes; legacy readers remain", () => {
  const root = fixture(); const source = captureProductionSource(root); const c = configured(source);
  const built = buildProductionIdentity(root, c);
  const review = {schemaVersion: 2, configHash: built.identity.configHash, sourceCommit: c.release.sourceCommit,
    contractsHash: c.release.contractsHash, identity: built.identity, evidenceId: built.identity.evidenceId,
    dryRun: {passed: true, chainId: c.network.chainId}, forkSimulation: {passed: true, chainId: c.network.chainId, blockNumber: 1}, reviewedAt: "2026-11-11T00:00:00Z"};
  assert.equal(validateProductionDeploymentEvidence(review, c).evidenceId, built.identity.evidenceId);
  assert.throws(() => validateProductionDeploymentEvidence({...review, evidenceId: productionDigest("wrong", 1)}, c));
  assert.equal(validateProductionDeploymentEvidence({...review, schemaVersion: 1}, c).schemaVersion, 1);
  const record = bindProductionRecord(built.identity, {router: "address"}, [{input: "0x1234"}], [{status: "0x1"}], {source: built.source, build: built.build});
  verifyProductionRecord(record, built.identity.evidenceId);
  for (const key of ["artifact", "transactions", "receipts"]) {
    assert.throws(() => verifyProductionRecord({...record, [key]: {}}, built.identity.evidenceId));
  }
});


test("compiler version, optimizer, IR, EVM, metadata, remappings and libraries change commitments or reject", () => {
  const root = fixture();
  const initial = captureProductionSource(root);
  const toml = readFileSync(join(root, "foundry.toml"), "utf8");
  for (const change of [
    toml.replace('0.8.17', '0.8.35'), toml.replace('optimizer = true', 'optimizer = false'),
    toml.replace('200', '201'), `${toml}via_ir = true\n`, `${toml}evm_version = "berlin"\n`,
    `${toml}bytecode_hash = "none"\n`, `${toml}cbor_metadata = false\n`,
    `${toml}libraries = ["src/Core.sol:Core:0x1111111111111111111111111111111111111111"]\n`
  ]) {
    put(root, "foundry.toml", change);
    let captured;
    try { captured = captureProductionSource(root); } catch { continue; }
    assert.notEqual(captured.sourceHash, initial.sourceHash);
  }
  put(root, "foundry.toml", toml);
  put(root, "remappings.txt", "fixture/=src/\nunused/=src/\n");
  assert.notEqual(captureProductionSource(root).sourceHash, initial.sourceHash);
});

test("all tool, dependency and bytecode commitments affect build identity; all wiring affects evidence identity", () => {
  const root = fixture(); const source = captureProductionSource(root); const c = configured(source);
  const built = buildProductionIdentity(root, c);
  const {buildHash, ...value} = built.build;
  for (const name of ["forge", "solc", "node", "typescript"] as const) {
    for (const field of ["version", "sha256"] as const) {
      const changed = {...value, tools: {...value.tools, [name]: {...value.tools[name], [field]: "changed"}}};
      assert.notEqual(productionDigest("build", changed), buildHash);
    }
  }
  for (const dependency of Object.keys(value.dependencies)) {
    assert.notEqual(productionDigest("build", {...value, dependencies: {...value.dependencies, [dependency]: "changed"}}), buildHash);
  }
  for (const contract of Object.keys(value.contracts)) {
    for (const field of ["creationHash", "runtimeHash", "linkReferences", "runtimeLinkReferences", "immutableReferences"]) {
      assert.notEqual(productionDigest("build", {...value, contracts: {...value.contracts, [contract]: {...value.contracts[contract], [field]: "changed"}}}), buildHash);
    }
  }
  const address = "0x1234567890123456789012345678901234567890";
  for (const changed of [
    {...c, network: {...c.network, chainId: c.network.chainId + 1}},
    {...c, deploymentId: "other"}, {...c, deployer: address}, {...c, operator: address},
    {...c, safe: {...c.safe, address}}, {...c, venues: {amm: !c.venues.amm, rfq: true}}
  ]) assert.notEqual(createProductionIdentity(source, built.build, changed).evidenceId, built.identity.evidenceId);
  assert.throws(() => createProductionDeploymentPlan(c, {kind: "ledger"}, true), /version 2/);
});

test("inherited environment and local dotenv overrides cannot change the captured build", () => {
  const root = fixture(); const source = captureProductionSource(root); const c = configured(source);
  const before = buildProductionIdentity(root, c);
  const previous = process.env.FOUNDRY_OPTIMIZER;
  try {
    process.env.FOUNDRY_OPTIMIZER = "false";
    put(root, ".env", 'FOUNDRY_OPTIMIZER=false\nFOUNDRY_PROFILE=evil\n');
    const after = buildProductionIdentity(root, c);
    assert.equal(after.source.sourceHash, source.sourceHash);
    assert.equal(after.build.buildHash, before.build.buildHash);
  } finally { if (previous === undefined) delete process.env.FOUNDRY_OPTIMIZER; else process.env.FOUNDRY_OPTIMIZER = previous; }
});

test("copying rejects a symlink destination before touching its target", () => {
  const root = fixture(); const source = captureProductionSource(root);
  const target = temp(); const outside = temp(); put(outside, "Core.sol", "original");
  mkdirSync(join(target, "src")); symlinkSync(join(outside, "Core.sol"), join(target, "src/Core.sol"));
  assert.throws(() => copyProductionSource(root, target, source), /symlink/);
  assert.equal(readFileSync(join(outside, "Core.sol"), "utf8"), "original");
});


test("a clean Git fixture can create the versioned broadcast plan without executing it", () => {
  const root = fixture();
  git(root, "init", "-q"); git(root, "add", ".");
  git(root, "-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-qm", "fixture");
  const source = captureProductionSource(root); const c = configured(source);
  const built = buildProductionIdentity(root, c);
  assert.equal(built.identity.provenance.state, "clean");
  assertProductionBroadcastIdentity(built.identity, c);
  const plan = createProductionDeploymentPlan(c, {kind: "account", name: "fixture"}, true, built.identity);
  assert.equal(plan.evidenceId, built.identity.evidenceId);
  assert(plan.command.includes("--broadcast"));
  assert(plan.command.includes(`CORNER_STORE_EVIDENCE_ID=${built.identity.evidenceId}`));
});


test("compiler package identity includes the delegated compiler and runtime dependencies include generated output", () => {
  const root = temp();
  put(root, "package.json", '{"name":"compiler","version":"1.0.0"}');
  put(root, "lib/tsc.js", 'require("./_tsc.js");');
  put(root, "lib/_tsc.js", "compiler implementation one");
  put(root, "out/runtime.js", "runtime one");
  const initial = productionPackageDigest(root);
  put(root, "lib/_tsc.js", "compiler implementation two");
  assert.notEqual(productionPackageDigest(root), initial);
  put(root, "lib/_tsc.js", "compiler implementation one");
  put(root, "out/runtime.js", "runtime two");
  assert.notEqual(productionPackageDigest(root), initial);
});
