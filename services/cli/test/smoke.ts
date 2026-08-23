import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "fs";
import {createServer} from "http";
import {tmpdir} from "os";
import {join} from "path";
import {Wallet, verifyTypedData} from "ethers";

import {
  BUIDL_LIKE_MANIFEST_HASH,
  assetProfileBinding,
  resolveAssetProfile,
  resolveAssetProfileForArtifact
} from "../src/assetProfiles";
import {decodeReason, encodeReason, tableSize} from "../src/reason";
import {
  copyDeploymentArtifact,
  doctor,
  isNodeVersionSupported,
  prepareDeploymentRuntime,
  resolveContractSource
} from "../src/product";
import {
  RFQ_QUOTE_TYPES,
  RFQQuoteService,
  WalletTypedDataSigner,
  encodeVenueData,
  readQuoteFile,
  requestBackendQuote,
  rfqDomain,
  writeQuoteFile
} from "../src/rfq";
import {cmdProductionDeploy, cmdProductionOnboardingPlan, cmdProductionOnboardingVerify, cmdProductionPlan} from "../src/commands";

const CHAIN_ID = 31337;
const RFQ_VERIFYING_CONTRACT = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";

// Mirror of cmdQuoteInspect's signer recovery (reuses the rfq lib domain+types).
function recoverMaker(quote: any, signature: string): {recovered: string; ok: boolean} {
  const dom = rfqDomain(CHAIN_ID, RFQ_VERIFYING_CONTRACT as `0x${string}`);
  try {
    const recovered = verifyTypedData(dom, RFQ_QUOTE_TYPES, quote, signature);
    return {recovered, ok: recovered.toLowerCase() === quote.maker.toLowerCase()};
  } catch {
    return {recovered: "", ok: false};
  }
}

// Ground-truth reason codes computed independently with `cast keccak` against the
// on-chain ReasonCodes.encode / ComplianceEngine encoding.
const A02_RECIPE1 = "0xdf005707ef0d1c9c5675600e45928090b03a3d8ea92af2d691132565e834e7c0";
const POLICY_SUSPENDED = "0x6c918c291dab5574048c8f619004a9721b8ac1b978c93e69f239e614a34d5e4f";
const A01_RECIPE7 = "0x4ec564787cbeb03d100cec07278646352648e18a22c4b6e3a8549fa92f376f46";
// Wave-2b: direct element-level codes (recipeId 0), the reasonCode an
// element's own `check()` actually self-encodes (e.g. Sanctions.sol,
// HolderCount.sol) — ground truth via `cast keccak $(cast abi-encode
// "f(uint16,bytes32,uint32)" 0 $(cast format-bytes32-string "<id>") <code>)`.
const A01_DIRECT_CODE4 = "0x8bb6a77feb777933299995cf60c2f3d5a4804be0f6077feab1f7390c76179f9c";
const D01_DIRECT_CODE3 = "0x944f96138687357570c74d60495e55251602230e456018945bdf8e15bc1241ba";
// Wave-3 (CMP-004): same direct element-level (recipeId 0) ground-truth style.
// F-03 FraudSurveillance is a monitoring element whose codes surface only in the
// operator/audit views (reasonCodeOf) — code 2 == STRUCTURING_EVASION.
const F03_DIRECT_CODE2 = "0x5d92032bfc7789d5259fa504825a7aee201b62bfb2f705423901f179444eb22a";

async function main() {
  assert(isNodeVersionSupported("18.0.0"), "Node 18 is supported");
  assert(isNodeVersionSupported("v24.4.1"), "newer Node releases are supported");
  assert(!isNodeVersionSupported("16.20.1"), "Node 16 is rejected");
  assert(!isNodeVersionSupported("invalid"), "invalid Node versions are rejected");

  const productRoot = mkdtempSync(join(tmpdir(), "corner-store-product-"));
  const contractSource = join(productRoot, "contracts");
  const consumerRoot = join(productRoot, "consumer");
  for (const path of [
    "src",
    "script",
    "test/fixtures",
    "test/mocks",
    "lib/openzeppelin-contracts/contracts",
    "lib/openzeppelin-contracts-upgradeable/contracts",
    "lib/solidity/contracts",
    "lib/ERC-3643/contracts",
    "lib/forge-std/src"
  ]) {
    mkdirSync(join(contractSource, path), {recursive: true});
    writeFileSync(join(contractSource, path, ".fixture"), path);
  }
  writeFileSync(join(contractSource, "foundry.toml"), "[profile.default]\n");
  writeFileSync(join(contractSource, "remappings.txt"), "");
  writeFileSync(join(contractSource, "script/DeployStack.s.sol"), "contract DeployStack {}\n");
  writeFileSync(join(contractSource, "secret.txt"), "must not be copied");
  mkdirSync(consumerRoot);
  writeFileSync(join(consumerRoot, "corner-store.scenario.json"), '{"schemaVersion":2}\n');
  assert(resolveContractSource(undefined, contractSource) === contractSource, "explicit contract source resolves");
  const invalidDoctor = doctor("missing-config.json", undefined, contractSource);
  assert(!invalidDoctor.ready, "doctor fails readiness for a missing config");
  assert(
    invalidDoctor.checks.some((check) => check.name === "node") &&
      invalidDoctor.checks.some((check) => check.name === "config" && !check.pass),
    "doctor reports all prerequisites alongside config failure"
  );
  const runtime = prepareDeploymentRuntime(consumerRoot, contractSource);
  assert(existsSync(join(runtime, "src/.fixture")), "runtime copies required product sources");
  assert(!existsSync(join(runtime, "secret.txt")), "runtime excludes unrelated source-root files");
  assert(
    readFileSync(join(runtime, "deployments/anvil-e2e-scenario.json"), "utf8").includes('"schemaVersion":2'),
    "runtime installs the consumer scenario"
  );
  writeFileSync(join(runtime, "deployments/anvil-e2e.json"), '{"router":"0x1"}\n');
  const copiedArtifact = copyDeploymentArtifact(runtime, consumerRoot, "deployments/result.json");
  assert(existsSync(copiedArtifact), "deployment artifact is copied back to the consumer project");

  const productionConfigPath = join(consumerRoot, "corner-store.production.json");
  writeFileSync(productionConfigPath, `${JSON.stringify({
    schemaVersion: 1,
    network: {
      name: "mainnet",
      chainId: 1,
      rpcUrl: "https://rpc.example",
      approvedRpcHosts: ["rpc.example", "secure-rpc.example"]
    },
    release: {sourceCommit: "a".repeat(40), contractsHash: `sha256:${"b".repeat(64)}`},
    deploymentId: "mainnet-core-1",
    deployer: "0x4444444444444444444444444444444444444444",
    operator: "0x5555555555555555555555555555555555555555",
    venues: {amm: true, rfq: true},
    safe: {
      address: "0x8888888888888888888888888888888888888888",
      expectedOwners: [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222"
      ],
      threshold: 2,
      expectedSingleton: "0x7777777777777777777777777777777777777777",
      proxyCodeHash: `0x${"aa".repeat(32)}`
    },
    deployment: {
      artifact: "deployments/production-core.json",
      evidence: "deployments/production-evidence.json"
    }
  }, null, 2)}\n`);
  const previousCwd = process.cwd();
  process.chdir(consumerRoot);
  try {
    const previousLog = console.log;
    let planOutput = "";
    console.log = (value?: any) => { planOutput += String(value); };
    try {
      cmdProductionPlan("corner-store.production.json", {rpcUrl: "https://secure-rpc.example"});
    } finally {
      console.log = previousLog;
    }
    assert(planOutput.includes("CORNER_STORE_DEPLOYER=0x4444444444444444444444444444444444444444"), "production-plan includes deployer env");
    assert(planOutput.includes("CORNER_STORE_GOVERNANCE=0x8888888888888888888888888888888888888888"), "production-plan includes Safe env");
    assert(planOutput.includes("CORNER_STORE_ENABLE_AMM=1") && planOutput.includes("CORNER_STORE_ENABLE_RFQ=1"), "production-plan includes venue env");
    assert(planOutput.includes("--sender 0x4444444444444444444444444444444444444444"), "production-plan includes explicit sender");
    assert(planOutput.includes("https://secure-rpc.example"), "production-plan supports explicit RPC runtime override");
    assert(!planOutput.includes("--ledger") && !planOutput.includes("--account"), "production-plan is signer-free");
    assertThrows(() => cmdProductionPlan("corner-store.production.json", {key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"}), "production-plan rejects raw key");
    const onboardingPath = join(consumerRoot, "corner-store.production-onboarding.json");
    writeFileSync(onboardingPath, `${JSON.stringify({
      schemaVersion: 1,
      chainId: 1,
      configHash: "sha256:" + "a".repeat(64),
      artifactHash: "sha256:" + "b".repeat(64),
      legalPackageHash: "sha256:" + "c".repeat(64),
      governance: {safe: "0x8888888888888888888888888888888888888888", requiredApprovals: 2, operatorExecutor: "0x5555555555555555555555555555555555555555"},
      addresses: {
        token: "0x1000000000000000000000000000000000000001",
        identityRegistry: "0x1000000000000000000000000000000000000002",
        compliance: "0x1000000000000000000000000000000000000003",
        topicsRegistry: "0x1000000000000000000000000000000000000004",
        issuersRegistry: "0x1000000000000000000000000000000000000005",
        identityStorage: "0x1000000000000000000000000000000000000006",
        elementRegistry: "0x1000000000000000000000000000000000000007",
        recipeRegistry: "0x1000000000000000000000000000000000000008",
        tokenPolicyRegistry: "0x1000000000000000000000000000000000000009",
        operatorRegistry: "0x1000000000000000000000000000000000000010",
        venueRegistry: "0x1000000000000000000000000000000000000011",
        rfqAdapter: "0x1000000000000000000000000000000000000012",
        makerAuthorizer: "0x1000000000000000000000000000000000000013"
      },
      elements: [{elementId: "0x" + "01".repeat(32), implementation: "0x2000000000000000000000000000000000000001"}],
      recipes: [{recipeId: 1, version: 2, implementation: "0x2000000000000000000000000000000000000002"}],
      manifest: {issuanceRecipeId: 1, issuanceRecipeVersion: 2, fundRecipeId: 0, enabledResalePaths: 1, supportedEngines: 5, stateScopeId: 7, factsPacked: "1", coverageScope: "3", fullManifestHash: "0x" + "02".repeat(32)},
      recipeBindings: [{recipeId: 1, recipeVersion: 2, mode: "REQUIRED_BLOCKING", pathGroupId: 0, priority: 100}],
      venues: [{venue: "0x3000000000000000000000000000000000000001", venueType: "RFQ", adapter: "0x1000000000000000000000000000000000000012", target: "0x3000000000000000000000000000000000000002", operator: "0x5555555555555555555555555555555555555555", custody: "NONE", active: true}],
      rfq: {makers: [{maker: "0x4000000000000000000000000000000000000001", approved: true}], signerDelegates: [{maker: "0x4000000000000000000000000000000000000001", delegate: "0x4000000000000000000000000000000000000002", reasonHash: "0x" + "03".repeat(32)}]},
      inventory: [{token: "0x1000000000000000000000000000000000000001", holder: "0x4000000000000000000000000000000000000001", spender: "0x1000000000000000000000000000000000000012", minBalance: "100", minAllowance: "50", riskEvidenceHash: "0x" + "04".repeat(32)}]
    }, null, 2)}
`);
    const onboardingOut = join(consumerRoot, "safe-onboarding.json");
    let onboardingLog = "";
    console.log = (value?: any) => { onboardingLog += String(value); };
    try {
      cmdProductionOnboardingPlan("corner-store.production-onboarding.json", {out: onboardingOut});
    } finally {
      console.log = previousLog;
    }
    const onboardingPlan = JSON.parse(readFileSync(onboardingOut, "utf8"));
    assert(onboardingPlan.schema === "corner-store-production-onboarding", "production-onboarding-plan writes schema");
    assert(onboardingPlan.safeTransactions.length === onboardingPlan.transactions.filter((tx: any) => tx.authority === "safe-owner").length && onboardingPlan.operatorTransactions.length === onboardingPlan.transactions.filter((tx: any) => tx.authority === "operator").length, "production-onboarding-plan partitions Safe and operator drafts by authority");
    assert(onboardingLog.includes("production onboarding plan written"), "production-onboarding-plan logs immutable output path");
    assertThrows(() => cmdProductionOnboardingPlan("corner-store.production-onboarding.json", {out: onboardingOut}), "production-onboarding-plan rejects overwrite");

    const rpc = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const method = parsed.method;
        const result = method === "eth_chainId" ? "0x1" : method === "eth_getCode" ? "0x" : "0x";
        res.writeHead(200, {"content-type": "application/json"});
        res.end(JSON.stringify({jsonrpc: "2.0", id: parsed.id, result}));
      });
    });
    await new Promise<void>((resolve) => rpc.listen(0, "127.0.0.1", resolve));
    const rpcAddress = rpc.address();
    if (!rpcAddress || typeof rpcAddress === "string") throw new Error("onboarding RPC test server did not bind");
    const oldExitCode = process.exitCode;
    process.exitCode = undefined;
    let verifyLog = "";
    console.log = (value?: any) => { verifyLog += String(value); };
    try {
      await cmdProductionOnboardingVerify("corner-store.production-onboarding.json", {rpcUrl: `http://127.0.0.1:${rpcAddress.port}`});
    } finally {
      console.log = previousLog;
      await new Promise<void>((resolve, reject) => rpc.close((err) => (err ? reject(err) : resolve())));
    }
    assert(process.exitCode === 1, "production-onboarding-verify sets nonzero on fail-closed mismatch");
    assert(JSON.parse(verifyLog.slice(verifyLog.indexOf("{"))).ready === false, "production-onboarding-verify prints not-ready result");
    process.exitCode = oldExitCode;
    await assertRejects(
      () => cmdProductionDeploy("corner-store.production.json", {ledger: true, confirm: "wrong"}),
      "production-deploy requires explicit confirmation before RPC preflight"
    );
    await assertRejects(
      () => cmdProductionDeploy("corner-store.production.json", {ledger: true, confirm: "production-deploy"}),
      "production-deploy requires frozen dry-run/fork evidence before RPC preflight"
    );
  } finally {
    process.chdir(previousCwd);
  }

  // --- asset profile selection -------------------------------------------
  assert(resolveAssetProfile() === "buidl-like", "BUIDL-like is the default asset profile");
  assert(resolveAssetProfile("reg-d") === "reg-d", "Reg D asset profile is selectable");
  assertThrows(() => resolveAssetProfile("unknown"), "unknown asset profile is rejected");
  assert(
    resolveAssetProfileForArtifact(undefined, "reg-d") === "reg-d",
    "deployment artifact selects the asset profile"
  );
  assert(
    resolveAssetProfileForArtifact("buidl-like", "buidl-like") === "buidl-like",
    "matching explicit and deployed profiles are accepted"
  );
  assertThrows(
    () => resolveAssetProfileForArtifact("reg-d", "buidl-like"),
    "a deployed BUIDL-like asset cannot be rebound to weaker Reg D policy"
  );
  const buidl = assetProfileBinding("buidl-like");
  assert(
    JSON.stringify(buidl.bindings) === JSON.stringify([[1, 2, 0, 0, 100], [3, 1, 0, 0, 90]]) &&
      buidl.factsPacked === 1n,
    "BUIDL-like RecipeBinding[]/facts binding"
  );
  const regD = assetProfileBinding("reg-d");
  assert(
    JSON.stringify(regD.bindings) === JSON.stringify([[1, 2, 0, 0, 100]]) && regD.factsPacked === 0n,
    "Reg D uses a single RecipeBinding[] without fund mirror behavior"
  );
  assert(
    buidl.fullManifestHash === "0xdcf411c4cfd970828531bfbaa85d4e6f833b6fb731a32add099081e4eea5b7c9",
    "BUIDL-like Manifest hash matches the Solidity profile"
  );
  assert(buidl.fullManifestHash === BUIDL_LIKE_MANIFEST_HASH, "BUIDL-like exported hash matches binding");

  // --- reason table -------------------------------------------------------
  assert(encodeReason(1, "A-02-v1", 1) === A02_RECIPE1, "encode matches cast (A-02 recipe 1)");
  assert(encodeReason(0, "POLICY", 3) === POLICY_SUSPENDED, "encode matches cast (POLICY suspended)");
  assert(encodeReason(7, "A-01-v1", 1) === A01_RECIPE7, "encode matches cast (A-01 recipe 7)");
  assert(encodeReason(0, "A-01-v1", 4) === A01_DIRECT_CODE4, "encode matches cast (A-01 direct code 4)");
  assert(encodeReason(0, "D-01-v1", 3) === D01_DIRECT_CODE3, "encode matches cast (D-01 direct code 3)");
  assert(encodeReason(0, "F-03-v1", 2) === F03_DIRECT_CODE2, "encode matches cast (F-03 direct code 2)");

  // table = (recipe-scoped: 3 recipes x codes-per-element-sum) + (direct
  // element-level: 1 x codes-per-element-sum, recipeId 0 — the reasonCode an
  // element's own `check()` actually self-encodes) + 6 policy statuses.
  // codes-per-element-sum is each of the 23 elements' code count, where an
  // element without a richer ELEMENT_CODE_NAMES table contributes 1.
  // Wave-2b upgraded 6 elements to multi-code taxonomies (A-01:10, A-03:9,
  // A-04:9, A-13:9, B-01:6, B-02:6); the wave-2 illustrative elements
  // (A-08:8, A-09:2, A-11:5, B-03:6, B-04:7, D-01:4) and the wave-3
  // illustrative elements (A-06:4, A-12:8, E-03:9, F-01:3, F-03:4, F-04:5) are
  // also enumerated; the remaining 5 single-code mocks (A-02, A-05, C-01,
  // E-01, F-02) contribute 1 each.
  const CODES_PER_ELEMENT =
    10 + 1 + 9 + 9 + 1 + 6 + 6 + 1 + 1 + 9 + 1 + 8 + 2 + 5 + 6 + 7 + 4 + 4 + 8 + 9 + 3 + 4 + 5; // = 119
  assert(tableSize() === 4 * CODES_PER_ELEMENT + 6, "reason table size");

  const jur = decodeReason(A02_RECIPE1);
  assert(jur.label.includes("Jurisdiction") && jur.label.includes("A-02-v1"), "decodes A-02 to Jurisdiction");
  const pol = decodeReason(POLICY_SUSPENDED);
  assert(pol.label.includes("SUSPENDED"), "decodes policy suspended");
  // case-insensitive input.
  assert(decodeReason(A02_RECIPE1.toUpperCase()).label === jur.label, "upper-case input decodes");
  assert(decodeReason("0x" + "de".repeat(32)).label === "unknown code", "unknown code");

  // Wave-2b: direct element-level (recipeId 0) codes decode to the doc-name
  // from that element's header table — this is the reasonCode actually
  // returned by an element's own `check()` / thrown via `ComplianceRejected`
  // (e.g. D-01 HolderCount.onTransfer). G005 engine/CLI propagation preserves
  // this exact nonzero element reason; code 1 is only the zero-reason fallback.
  const sanctionsClaim = decodeReason(A01_DIRECT_CODE4);
  assert(sanctionsClaim.label.includes("FAIL_NO_SANCTIONS_CLAIM"), "decodes A-01 direct code 4");
  assert(A01_DIRECT_CODE4 !== encodeReason(1, "A-01-v1", 1), "direct element reason is not fabricated recipe-scoped code 1");
  const holderCap = decodeReason(D01_DIRECT_CODE3);
  assert(holderCap.label.includes("HOLDER_CAP_3C1_100"), "decodes D-01 direct code 3");
  // Wave-3: a monitoring element's audit-surface code still decodes to its
  // doc-name even though F-03's `check()` never rejects — the code appears only
  // in operator views / FlagLifecycle events, never as a party-facing reject.
  const fraudFlag = decodeReason(F03_DIRECT_CODE2);
  assert(fraudFlag.label.includes("STRUCTURING_EVASION"), "decodes F-03 direct code 2");
  // Legacy code-1 meaning is preserved across the wave-2b upgrade (doc says
  // code 1 keeps the pre-upgrade "blocked wallet" semantics for A-01).
  assert(decodeReason(encodeReason(0, "A-01-v1", 1)).label.includes("FAIL_SDN_WALLET_MATCH"), "A-01 code 1 preserved");

  // --- quote-file round-trip ---------------------------------------------
  const maker = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const service = new RFQQuoteService(
    {chainId: CHAIN_ID, verifyingContract: RFQ_VERIFYING_CONTRACT as `0x${string}`, defaultTtlSeconds: 3600},
    new WalletTypedDataSigner(maker)
  );
  const signed = await service.createSignedQuote({
    maker: (await maker.getAddress()) as `0x${string}`,
    taker: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    tokenIn: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
    tokenOut: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amountIn: "120000000000000000000",
    amountOut: "200000000000000000000",
    venue: "0x000000000000000000000000000000000000F00D",
    ttlSeconds: 3600
  });
  assert(signed.signature.length === 132, "65-byte signature");

  const dir = mkdtempSync(join(tmpdir(), "corner-store-cli-"));
  const file = join(dir, "quote.json");
  writeQuoteFile(file, signed);
  const round = readQuoteFile(file);
  assert(round.quote.maker === signed.quote.maker, "quote maker round-trips");
  assert(round.quote.amountIn === signed.quote.amountIn, "amountIn round-trips");
  assert(round.signature === signed.signature, "signature round-trips");

  const venueData = encodeVenueData(round.quote, round.signature);
  assert(venueData.startsWith("0x") && venueData.length > 200, "venueData encodes");

  // --- demo-backend request path -----------------------------------------
  const backend = createServer((req, res) => {
    assert(req.method === "POST" && req.url === "/rfq/quote", "CLI calls the backend quote endpoint");
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify(signed));
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const backendAddress = backend.address();
  if (!backendAddress || typeof backendAddress === "string") throw new Error("backend test server did not bind");
  try {
    const remote = await requestBackendQuote(`http://127.0.0.1:${backendAddress.port}`, {
      taker: signed.quote.taker,
      amountIn: signed.quote.amountIn,
      ttlSeconds: 3600
    });
    assert(remote.signature === signed.signature, "backend quote response is returned to the CLI");
  } finally {
    await new Promise<void>((resolve, reject) => backend.close((err) => (err ? reject(err) : resolve())));
  }

  // --- quote-inspect signer recovery (valid + tampered) -------------------
  const valid = recoverMaker(round.quote, round.signature);
  assert(valid.ok, "quote-inspect recovers the maker from a valid signature");
  assert(valid.recovered.toLowerCase() === (await maker.getAddress()).toLowerCase(), "recovered == maker");

  // Flip one hex nibble inside r; recovery yields a different address (or throws).
  const tamperedSig = `${round.signature.slice(0, 10)}${round.signature[10] === "0" ? "1" : "0"}${round.signature.slice(11)}`;
  assert(tamperedSig !== round.signature, "tampered signature differs");
  const tampered = recoverMaker(round.quote, tamperedSig);
  assert(!tampered.ok, "quote-inspect FAILs a tampered signature");

  // --- reason-decode regression: zero element reasons still fall back to the
  //     recipe-aware generic code-1 path, but exact direct codes decode too. ---
  assert(
    decodeReason(encodeReason(1, "A-02-v1", 1)).label.includes("Jurisdiction"),
    "fallback per-element reason decodes (recipe 1 / A-02-v1 -> Jurisdiction)"
  );
  assert(decodeReason(A01_DIRECT_CODE4).label.includes("FAIL_NO_SANCTIONS_CLAIM"), "exact non-1 element reason decodes");

  console.log("corner-store CLI smoke ok");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function assertThrows(fn: () => unknown, msg: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`assertion failed: ${msg}`);
}

async function assertRejects(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(`assertion failed: ${msg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
