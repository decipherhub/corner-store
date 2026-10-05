import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from "fs";
import {dirname, resolve} from "path";

import {
  RFQIntegrationManifest,
  RFQIntegrationMode,
  defaultIntegrationManifest,
  validateIntegrationManifest
} from "./integration";
import {defaultConfig} from "./config";
import {
  ProjectDescriptor,
  ProjectTemplateId,
  createProjectDescriptor,
  projectTemplate,
  resolveProjectTemplate
} from "./project-templates";

export interface ScaffoldOptions {
  mode?: RFQIntegrationMode;
  template?: ProjectTemplateId;
  dockerCompose?: boolean;
  sdkDependency?: string;
  sdkSourceRoot?: string;
  cliDependency?: string;
  toolkitDependency?: string;
  standalone?: boolean;
  scenario?: string;
  sandboxSourceRoot?: string;
}

export interface ScaffoldResult {
  root: string;
  files: string[];
  manifest: RFQIntegrationManifest;
  project: ProjectDescriptor;
}

export function scaffoldRFQIntegration(target: string, options: ScaffoldOptions): ScaffoldResult {
  const root = resolve(target);
  if (existsSync(root)) throw new Error(`scaffold target already exists: ${root}`);
  const selection = resolveProjectTemplate({
    template: options.template,
    mode: options.mode,
    dockerCompose: options.dockerCompose
  });
  const manifest = validateIntegrationManifest(defaultIntegrationManifest(selection.mode, options.dockerCompose === true));
  const project = createProjectDescriptor(selection, options.dockerCompose === true);
  const sdkDependency = options.sdkDependency ??
    (options.sdkSourceRoot ? "file:vendor/rfq-service" : `^${manifest.sdk.version}`);
  if (!sdkDependency || /\s/.test(sdkDependency)) throw new Error("sdkDependency must be a non-empty npm dependency specifier");
  const cliDependency = options.cliDependency ?? "^0.1.0";
  if (!cliDependency || /\s/.test(cliDependency)) throw new Error("cliDependency must be a non-empty npm dependency specifier");
  const files = generatedFiles(
    manifest,
    sdkDependency,
    cliDependency,
    options.toolkitDependency,
    options.sdkSourceRoot !== undefined,
    options.standalone === true,
    project,
    options.scenario,
    options.sandboxSourceRoot
  );
  if (options.sdkSourceRoot) {
    Object.assign(files, vendoredSdkFiles(options.sdkSourceRoot));
  }
  mkdirSync(dirname(root), {recursive: true});
  try {
    mkdirSync(root);
  } catch (error: any) {
    if (error.code === "EEXIST") throw new Error(`scaffold target already exists: ${root}`);
    throw error;
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const output = resolve(root, relativePath);
    mkdirSync(resolve(output, ".."), {recursive: true});
    writeFileSync(output, content, {flag: "wx"});
  }
  return {root, files: Object.keys(files).sort(), manifest, project};
}

function generatedFiles(
  manifest: RFQIntegrationManifest,
  sdkDependency: string,
  cliDependency: string,
  toolkitDependency: string | undefined,
  vendoredSdk: boolean,
  standalone: boolean,
  project: ProjectDescriptor,
  scenario?: string,
  sandboxSourceRoot?: string
): Record<string, string> {
  const files: Record<string, string> = {
    "corner-store.integration.json": json(manifest),
    "corner-store.project.json": json(project),
    "package.json": json(packageManifest(manifest, project, sdkDependency, cliDependency, toolkitDependency, standalone)),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      },
      include: ["src/**/*.ts"]
    }),
    ".env.example": envExample(manifest),
    ".gitignore": "node_modules/\ndist/\n.env\n.corner-store/runtime/\ndeployments/\n",
    "README.md": readme(manifest, project, toolkitDependency !== undefined),
    "src/index.ts": sourceForMode(manifest.mode),
    "src/module-conformance.ts": moduleConformanceSource()
  };
  if (toolkitDependency) files["src/policy.ts"] = policyFacadeSource();
  if (standalone) {
    files["corner-store.config.json"] = json(defaultConfig());
    files["corner-store.scenario.json"] = scenario ?? json(defaultScenario());
  }
  if (project.template === "sandbox") {
    if (!sandboxSourceRoot) throw new Error("sandbox template requires the bundled reference runtime source");
    files["corner-store.reg-d.config.json"] = json(regDConfig());
    files["Dockerfile"] = sandboxDockerfile();
    files["compose.yaml"] = sandboxCompose();
    files[".dockerignore"] = sandboxDockerignore();
    files["sandbox/scripts/deploy.sh"] = sandboxDeployScript();
    files["sandbox/scripts/operator-api.sh"] = sandboxOperatorApiScript();
    Object.assign(files, vendoredSandboxFiles(sandboxSourceRoot));
  }
  if (project.template === "dex-integration") {
    files["corner-store.venue.json"] = json(venueDescriptor());
    files["foundry.toml"] = dexFoundryConfig();
    files["contracts/CornerStoreVenueAdapter.sol"] = venueAdapterSource();
    files["test/CornerStoreVenueAdapter.t.sol"] = venueAdapterTestSource();
    files["src/venue-client.ts"] = venueClientSource();
  }
  if (manifest.deployment.dockerCompose && project.template !== "sandbox") {
    files["Dockerfile"] = dockerfile(vendoredSdk);
    files["compose.yaml"] = compose();
  }
  return files;
}

function packageManifest(
  manifest: RFQIntegrationManifest,
  project: ProjectDescriptor,
  sdkDependency: string,
  cliDependency: string,
  toolkitDependency: string | undefined,
  standalone: boolean
) {
  const dependencies: Record<string, string> = {
    [manifest.sdk.package]: sdkDependency,
    ethers: "^6.13.5"
  };
  if (toolkitDependency) dependencies["@corner-store/toolkit"] = toolkitDependency;
  return {
    name: `corner-store-${project.template}`,
    version: "0.1.0",
    private: true,
    scripts: {
      build: "tsc -p tsconfig.json",
      ...(manifest.mode === "reference-service" ? {start: "node dist/index.js"} : {}),
      test: project.template === "dex-integration"
        ? "npm run build && npm run test:module && npm run test:adapter"
        : "npm run build && npm run test:module",
      "test:module": "corner-store test-module dist/module-conformance.js",
      ...(project.template === "dex-integration" ? {"test:adapter": "forge test --offline"} : {}),
      ...(standalone ? {
        validate: "corner-store toolkit-validate",
        simulate: "corner-store toolkit-simulate",
        doctor: "corner-store doctor",
        deploy: "corner-store deploy",
        verify: "corner-store verify",
        ...(project.template === "sandbox" ? {
          dev: "docker compose up --build -d",
          status: "docker compose ps -a",
          clean: "docker compose down --volumes --remove-orphans"
        } : {}),
        ...(toolkitDependency ? {"policy:explain": "node dist/policy.js"} : {})
      } : {})
    },
    dependencies,
    devDependencies: {
      "@corner-store/cli": cliDependency,
      "@types/node": "^22.20.1",
      typescript: "^5.7.3"
    }
  };
}

function envExample(manifest: RFQIntegrationManifest): string {
  const common = [
    "RFQ_CHAIN_ID=31337",
    "RFQ_ADAPTER_ADDRESS=",
    "RFQ_MAKER_ADDRESS=",
    "RFQ_SIGNER_PRIVATE_KEY=",
    "RFQ_PRICE_NUMERATOR=1",
    "RFQ_PRICE_DENOMINATOR=1",
    "PORT=8787"
  ];
  if (manifest.mode === "existing-backend") {
    common.push("# Map these names to your existing config/secret provider; do not commit .env.");
  }
  return `${common.join("\n")}\n`;
}

function referenceServiceSource(): string {
  return `import {createServer} from "http";
import {Wallet} from "ethers";
import {
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  createRFQServiceFromModules,
  nonceModule,
  pricingModule,
  riskModule,
  signerModule
} from "@corner-store/rfq-service";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`missing \${name}\`);
  return value;
}

const wallet = new Wallet(required("RFQ_SIGNER_PRIVATE_KEY"));
const maker = required("RFQ_MAKER_ADDRESS") as \`0x\${string}\`;
if (wallet.address.toLowerCase() !== maker.toLowerCase()) {
  throw new Error("RFQ_SIGNER_PRIVATE_KEY does not match RFQ_MAKER_ADDRESS");
}
const signer = {signTypedData: async (data: any) =>
  wallet.signTypedData(data.domain, {RFQQuote: data.types.RFQQuote}, data.message) as Promise<\`0x\${string}\`>};
const service = createRFQServiceFromModules({
  chainId: Number(required("RFQ_CHAIN_ID")),
  verifyingContract: required("RFQ_ADAPTER_ADDRESS") as \`0x\${string}\`,
  maker,
  modules: {
    pricing: pricingModule("corner-store.fixed-rate", new FixedRatePricingProvider({
      numerator: required("RFQ_PRICE_NUMERATOR"),
      denominator: required("RFQ_PRICE_DENOMINATOR")
    }), {maturity: "reference"}),
    risk: riskModule("corner-store.noop-risk", new NoopInventoryRiskCheck(), {maturity: "reference"}),
    signer: signerModule("integrator.signer", signer, {
      configKeys: ["RFQ_SIGNER_PRIVATE_KEY"],
      secretConfigKeys: ["RFQ_SIGNER_PRIVATE_KEY"]
    }),
    nonce: nonceModule("corner-store.in-memory-nonce", new InMemoryNonceStore(), {maturity: "reference"})
  }
});

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/rfq/quote") {
    res.writeHead(404).end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const quote = await service.quote(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(200, {"content-type": "application/json"}).end(JSON.stringify(quote));
  } catch (error: any) {
    res.writeHead(400, {"content-type": "application/json"}).end(JSON.stringify({error: error.message}));
  }
}).listen(Number(process.env.PORT ?? "8787"), "0.0.0.0");
`;
}

function existingBackendSource(): string {
  return `import {
  InventoryRiskCheck,
  NonceStore,
  PricingProvider,
  TypedDataSigner,
  createRFQServiceFromModules,
  nonceModule,
  pricingModule,
  riskModule,
  signerModule
} from "@corner-store/rfq-service";

export interface ExistingBackendModules {
  pricing: PricingProvider;
  risk: InventoryRiskCheck;
  signer: TypedDataSigner;
  nonce: NonceStore;
}

export function createCornerStoreRFQ(config: {
  chainId: number;
  verifyingContract: \`0x\${string}\`;
  maker: \`0x\${string}\`;
  modules: ExistingBackendModules;
}) {
  return createRFQServiceFromModules({
    chainId: config.chainId,
    verifyingContract: config.verifyingContract,
    maker: config.maker,
    modules: {
      pricing: pricingModule("integrator.pricing", config.modules.pricing),
      risk: riskModule("integrator.risk", config.modules.risk),
      signer: signerModule("integrator.signer", config.modules.signer),
      nonce: nonceModule("integrator.nonce", config.modules.nonce)
    }
  });
}

// Mount createCornerStoreRFQ(...).quote(request) inside your existing HTTP,
// queue or RPC handler. Final compliance remains on-chain at Router fill time.
`;
}

function libraryOnlySource(): string {
  return `export * from "@corner-store/rfq-service";
`;
}

function sourceForMode(mode: RFQIntegrationMode): string {
  if (mode === "reference-service") return referenceServiceSource();
  if (mode === "existing-backend") return existingBackendSource();
  return libraryOnlySource();
}

function moduleConformanceSource(): string {
  return `import {Wallet} from "ethers";
import {
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  nonceModule,
  pricingModule,
  riskModule,
  signerModule
} from "@corner-store/rfq-service";

// Conformance needs a real EIP-712 signer, but generated projects must not
// contain secret-shaped fixture material. This wallet is ephemeral and is
// created only when the conformance command runs.
const wallet = Wallet.createRandom();
const maker = wallet.address as \`0x\${string}\`;

export const modules = {
  pricing: pricingModule("example.pricing", new FixedRatePricingProvider({numerator: 1n, denominator: 1n})),
  risk: riskModule("example.risk", new NoopInventoryRiskCheck()),
  signer: signerModule("example.signer", {
    signTypedData: async (typedData) =>
      wallet.signTypedData(typedData.domain, typedData.types, typedData.message) as Promise<\`0x\${string}\`>
  }),
  nonce: nonceModule("example.nonce", new InMemoryNonceStore())
};

export const fixture = {
  chainId: 31337,
  verifyingContract: "0x2222222222222222222222222222222222222222" as const,
  maker,
  taker: "0x3333333333333333333333333333333333333333" as const,
  otherTaker: "0x7777777777777777777777777777777777777777" as const,
  tokenIn: "0x4444444444444444444444444444444444444444" as const,
  tokenOut: "0x5555555555555555555555555555555555555555" as const,
  amountIn: "1000000",
  venue: "0x6666666666666666666666666666666666666666" as const,
  policyId: "0x8888888888888888888888888888888888888888888888888888888888888888" as const,
  now: 1_800_000_000,
  ttlSeconds: 300
};
`;
}

function policyFacadeSource(): string {
  return `import {readFileSync} from "fs";
import {connectCornerStore} from "@corner-store/toolkit";

const config = JSON.parse(readFileSync("corner-store.config.json", "utf8"));
const client = connectCornerStore({config});

console.log(JSON.stringify({
  compiled: client.policy.compile(),
  simulation: client.policy.simulate(),
  explanation: client.policy.explain(),
  verification: client.policy.verify()
}, null, 2));
`;
}

function readme(manifest: RFQIntegrationManifest, project: ProjectDescriptor, hasPolicyFacade: boolean): string {
  const purpose = projectTemplate(project.template);
  const setup = project.template === "sandbox"
    ? `The sandbox requires Docker Engine/Desktop with Docker Compose v2. It does
not require an \`.env\` file or production credential. The direct Compose quickstart
does not require a host npm or Foundry installation.`
    : `1. Copy \`.env.example\` to a local secret-managed environment. Never commit it.
2. Install dependencies and run \`npm test\`.
3. ${manifest.mode === "reference-service"
  ? "Start the minimal reference HTTP service with `npm start`."
  : manifest.mode === "existing-backend"
    ? "Import `createCornerStoreRFQ` into the existing backend request handler."
    : "Import the RFQ SDK exports from `src/index.ts` in your application."}
4. Submit the signed quote through Corner Store's Router; backend prechecks never
   replace fill-time compliance.`;
  const optionalDocker = manifest.deployment.dockerCompose && project.template !== "sandbox"
    ? "\n`docker compose up --build` is an optional reference deployment path.\n"
    : "";
  return `# Corner Store ${project.template}

Purpose: ${purpose.summary}

Template maturity: \`${project.maturity}\`; compatibility mode: \`${manifest.mode}\`.

The user-facing policy values live in \`corner-store.config.json\`. The generated
\`corner-store.project.json\` binds this template, config and deployment artifact;
do not copy contract addresses into source files.

${project.template === "sandbox"
  ? "The Compose runtime uses this config for deployment and exposes the resulting live state through the portal."
  : hasPolicyFacade
    ? "Run `npm run policy:explain` to see profile and venue values first. The Element/Recipe/Manifest/Operator model remains available as advanced detail."
    : "Install `@corner-store/toolkit` to use the optional `connectCornerStore()` policy facade."}

This scaffold is an integration starting point, not a hosted dealer or production
pricing/risk/custody system. Replace every module marked \`reference\` before
production and run the SDK conformance suite against the resulting module set.

${setup}
${optionalDocker}
${project.template === "sandbox" ? `
## One-command local sandbox

This template is a demo-only reference environment. It uses the public Anvil
development mnemonic inside the runtime and must never be exposed to a public
network or reused for real assets.

\`\`\`sh
docker compose up --build -d
\`\`\`

This is the third command after \`corner-store create ...\` and \`cd ...\`.
For the diagnostic and lifecycle aliases, run \`npm install\` once, then use
\`npm run doctor\`, \`npm run dev\`, \`npm run status\` and \`npm run clean\`.

Open the demo portal at <http://127.0.0.1:8790> and Deployment Studio at
<http://127.0.0.1:8791>. The RPC is available at <http://127.0.0.1:8545>.
Select the alternative fixture with
\`CORNER_STORE_PROFILE=reg-d docker compose up --build -d\` after removing the
previous demo chain and artifact.

## Recovery

If a previous chain or artifact is still present, run \`npm run clean\` (or
\`docker compose down --volumes --remove-orphans\`) and start again. Compose
does not start the RFQ/API/UI services until the current deployment finishes,
and the RFQ backend independently rejects artifact, scenario or chain drift.
For startup failures, inspect \`docker compose ps -a\` and
\`docker compose logs deployer rfq operator-api\`.
` : ""}
`;
}

function regDConfig(): unknown {
  const config = defaultConfig();
  return {...config, asset: {...config.asset, profile: "reg-d"}};
}

function defaultScenario(): unknown {
  return {
    schemaVersion: 2,
    note: "Replace with an operator-reviewed deployment scenario before broadcast."
  };
}

function venueDescriptor(): unknown {
  return {
    schemaVersion: 1,
    venueType: "AMM",
    adapterSource: "contracts/CornerStoreVenueAdapter.sol",
    conformanceTest: "test/CornerStoreVenueAdapter.t.sol",
    policyBinding: "registry-configured",
    settlementTarget: "external-venue",
    productionResponsibilities: [
      "token transfer safety",
      "callback origin validation when applicable",
      "venue-specific slippage and settlement accounting",
      "independent audit and deployment review"
    ]
  };
}

function dexFoundryConfig(): string {
  return `[profile.default]
src = "contracts"
test = "test"
out = "out"
libs = ["node_modules/@corner-store/cli/bundle/contracts/lib"]
solc = "0.8.17"
optimizer = true
optimizer_runs = 200
via_ir = false
remappings = [
  "corner-store/=node_modules/@corner-store/cli/bundle/contracts/",
  "forge-std/=node_modules/@corner-store/cli/bundle/contracts/lib/forge-std/src/",
  "@openzeppelin/contracts/=node_modules/@corner-store/cli/bundle/contracts/lib/openzeppelin-contracts/contracts/",
  "@openzeppelin/contracts-upgradeable/=node_modules/@corner-store/cli/bundle/contracts/lib/openzeppelin-contracts-upgradeable/contracts/",
  "@onchain-id/solidity/=node_modules/@corner-store/cli/bundle/contracts/lib/solidity/",
  "@erc3643/=node_modules/@corner-store/cli/bundle/contracts/lib/ERC-3643/contracts/"
]
`;
}

function venueAdapterSource(): string {
  return `// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {IExecutionAdapter} from "corner-store/src/interfaces/execution/IExecutionAdapter.sol";
import {ExecutionRequest, ExecutionResult} from "corner-store/src/types/ExecutionTypes.sol";
import {ComplianceDecision} from "corner-store/src/types/ComplianceTypes.sol";

interface IExternalVenue {
    function execute(ExecutionRequest calldata request) external returns (ExecutionResult memory);
}

/// @notice Minimal integration boundary. The external venue owns settlement;
/// this adapter owns only Router authorization and exact target binding.
contract CornerStoreVenueAdapter is IExecutionAdapter {
    error NotOwner();
    error NotRouter();
    error InvalidAddress();
    error VenueMismatch();

    address public immutable owner;
    IExternalVenue public immutable target;
    address public router;

    constructor(IExternalVenue target_) {
        if (address(target_) == address(0)) revert InvalidAddress();
        owner = msg.sender;
        target = target_;
    }

    function setRouter(address router_) external {
        if (msg.sender != owner) revert NotOwner();
        if (router_ == address(0)) revert InvalidAddress();
        router = router_;
    }

    function execute(ExecutionRequest calldata request, ComplianceDecision calldata)
        external
        returns (ExecutionResult memory)
    {
        if (msg.sender != router) revert NotRouter();
        if (request.context.venue != address(target)) revert VenueMismatch();
        return target.execute(request);
    }
}
`;
}

function venueAdapterTestSource(): string {
  return `// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";
import {CornerStoreVenueAdapter, IExternalVenue} from "../contracts/CornerStoreVenueAdapter.sol";
import {ExecutionRouter} from "corner-store/src/execution/ExecutionRouter.sol";
import {VenueRegistry} from "corner-store/src/execution/VenueRegistry.sol";
import {VenueSelector} from "corner-store/src/execution/VenueSelector.sol";
import {OperatorRegistry} from "corner-store/src/registry/OperatorRegistry.sol";
import {MockComplianceEngine} from "corner-store/test/mocks/MockComplianceEngine.sol";
import {ExecutionRequest, ExecutionResult} from "corner-store/src/types/ExecutionTypes.sol";
import {ComplianceContext, ComplianceDecision, FlowType, VenueType} from "corner-store/src/types/ComplianceTypes.sol";
import {CustodyModel, VenueConfig} from "corner-store/src/types/VenueTypes.sol";
import {Errors} from "corner-store/src/libraries/Errors.sol";

contract ExampleExternalVenue is IExternalVenue {
    MockComplianceEngine public immutable engine;
    bool public failExecution;
    bool public committedDuringExecute;
    uint256 public callCount;

    constructor(MockComplianceEngine engine_) { engine = engine_; }
    function setFailExecution(bool value) external { failExecution = value; }
    function execute(ExecutionRequest calldata request) external returns (ExecutionResult memory) {
        if (failExecution) revert("venue failure");
        committedDuringExecute = engine.committed();
        callCount++;
        return ExecutionResult({amountOut: request.context.amountOut, executionId: keccak256(abi.encode(request.nonce))});
    }
}

contract CornerStoreVenueAdapterConformanceTest is Test {
    address internal constant USER = address(0xB0B);
    MockComplianceEngine internal engine;
    ExampleExternalVenue internal venue;
    CornerStoreVenueAdapter internal adapter;
    ExecutionRouter internal router;

    function setUp() public {
        engine = new MockComplianceEngine();
        venue = new ExampleExternalVenue(engine);
        adapter = new CornerStoreVenueAdapter(venue);
        VenueRegistry registry = new VenueRegistry();
        VenueSelector selector = new VenueSelector();
        OperatorRegistry operators = new OperatorRegistry();
        router = new ExecutionRouter(engine, registry, selector, operators);
        adapter.setRouter(address(router));
        registry.registerVenue(address(venue), VenueConfig({
            venueType: VenueType.AMM,
            adapter: address(adapter),
            target: address(venue),
            operator: address(this),
            custody: CustodyModel.NONE,
            active: true
        }));
        engine.setDecision(_decision(true));
    }

    function test_allowed_flow_executes_then_commits() public {
        vm.prank(USER);
        ExecutionResult memory result = router.execute(_request(1));
        assertEq(result.amountOut, 90);
        assertEq(venue.callCount(), 1);
        assertFalse(venue.committedDuringExecute(), "commit must happen after venue execution");
        assertTrue(engine.committed(), "successful venue execution must commit compliance state");
    }

    function test_compliance_rejection_never_reaches_venue() public {
        engine.setDecision(_decision(false));
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(Errors.ComplianceRejected.selector, bytes32("REJECTED")));
        router.execute(_request(2));
        assertEq(venue.callCount(), 0);
        assertFalse(engine.committed());
    }

    function test_direct_adapter_call_cannot_bypass_router() public {
        ComplianceDecision memory decision = _decision(true);
        vm.prank(USER);
        vm.expectRevert(CornerStoreVenueAdapter.NotRouter.selector);
        adapter.execute(_request(3), decision);
    }

    function test_venue_failure_rolls_back_nonce_and_commit() public {
        venue.setFailExecution(true);
        vm.prank(USER);
        vm.expectRevert("venue failure");
        router.execute(_request(4));
        assertFalse(router.usedNonce(USER, 4));
        assertFalse(engine.committed());
        assertEq(venue.callCount(), 0);
    }

    function _request(uint256 nonce) internal view returns (ExecutionRequest memory request) {
        request.context = ComplianceContext({
            initiator: USER,
            buyer: USER,
            seller: address(0xCAFE),
            tokenIn: address(0x1111),
            tokenOut: address(0x2222),
            amountIn: 100,
            amountOut: 90,
            venueType: VenueType.AMM,
            venue: address(venue),
            flowType: FlowType.SECONDARY_TRADE,
            sellerIsAffiliate: false
        });
        request.amountOutMin = 90;
        request.deadline = uint64(block.timestamp + 1 hours);
        request.nonce = nonce;
    }

    function _decision(bool allowed) internal pure returns (ComplianceDecision memory decision) {
        decision.allowed = allowed;
        decision.reasonCode = allowed ? bytes32(0) : bytes32("REJECTED");
        decision.maxAmount = type(uint256).max;
        decision.allowedVenueTypes = uint256(1) << uint256(VenueType.AMM);
    }
}
`;
}

function venueClientSource(): string {
  return `export interface VenueOrder {
  initiator: string;
  buyer: string;
  seller: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  venue: string;
  deadline: number;
  nonce: string;
  venueData?: string;
}

export function buildVenueExecutionRequest(order: VenueOrder) {
  for (const [name, value] of Object.entries(order)) {
    if (typeof value === "string" && name !== "venueData" && value.length === 0) throw new Error(\`missing \${name}\`);
  }
  if (!Number.isSafeInteger(order.deadline) || order.deadline <= 0) throw new Error("deadline must be a positive safe integer");
  return {
    context: {
      initiator: order.initiator,
      buyer: order.buyer,
      seller: order.seller,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amountIn: order.amountIn,
      amountOut: order.amountOut,
      venueType: 0,
      venue: order.venue,
      flowType: 0,
      sellerIsAffiliate: false
    },
    amountOutMin: order.amountOut,
    deadline: order.deadline,
    nonce: order.nonce,
    venueData: order.venueData ?? "0x"
  };
}
`;
}

function dockerfile(vendoredSdk: boolean): string {
  return `FROM node:22-alpine
WORKDIR /app
${vendoredSdk ? "COPY vendor ./vendor\n" : ""}COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
USER node
CMD ["npm", "start"]
`;
}

function vendoredSdkFiles(sourceRoot: string): Record<string, string> {
  const root = resolve(sourceRoot);
  for (const required of ["package.json", "tsconfig.json", "src"]) {
    if (!existsSync(resolve(root, required))) throw new Error(`RFQ SDK source missing ${required}: ${root}`);
  }
  const files: Record<string, string> = {
    "vendor/rfq-service/package.json": readFileSync(resolve(root, "package.json"), "utf8"),
    "vendor/rfq-service/tsconfig.json": readFileSync(resolve(root, "tsconfig.json"), "utf8")
  };
  collectSourceFiles(resolve(root, "src"), "vendor/rfq-service/src", files);
  return files;
}

function collectSourceFiles(directory: string, outputPrefix: string, files: Record<string, string>): void {
  for (const name of readdirSync(directory).sort()) {
    const source = resolve(directory, name);
    const output = `${outputPrefix}/${name}`;
    if (statSync(source).isDirectory()) {
      collectSourceFiles(source, output, files);
    } else if (name.endsWith(".ts")) {
      files[output] = readFileSync(source, "utf8");
    }
  }
}

function compose(): string {
  return `services:
  rfq:
    build: .
    env_file:
      - .env
    ports:
      - "\${PORT:-8787}:\${PORT:-8787}"
    restart: unless-stopped
`;
}

function sandboxDockerfile(): string {
  return `FROM ghcr.io/foundry-rs/foundry:v1.7.1 AS foundry

FROM foundry AS contract-toolchain
WORKDIR /home/foundry/contracts
COPY --chown=foundry:foundry sandbox/contracts ./
RUN forge build --jobs 1 script/DeployStack.s.sol

FROM node:22.14.0-bookworm-slim AS build
WORKDIR /workspace
COPY sandbox ./sandbox
RUN npm ci --prefix sandbox/services/toolkit --ignore-scripts \\
 && npm run build --prefix sandbox/services/toolkit \\
 && npm ci --prefix sandbox/services/rfq --ignore-scripts \\
 && npm run build --prefix sandbox/services/rfq \\
 && npm ci --prefix sandbox/services/cli --ignore-scripts \\
 && npm run build --prefix sandbox/services/cli \\
 && npm ci --prefix sandbox/services/rfq-demo-backend --ignore-scripts \\
 && npm run build --prefix sandbox/services/rfq-demo-backend \\
 && npm ci --prefix sandbox/services/operator-api --ignore-scripts \\
 && npm run build --prefix sandbox/services/operator-api \\
 && npm ci --prefix sandbox/services/deployment-studio --ignore-scripts \\
 && npm run build --prefix sandbox/services/deployment-studio

FROM node:22.14.0-bookworm-slim AS runtime
RUN apt-get update \\
 && apt-get install -y --no-install-recommends ca-certificates \\
 && rm -rf /var/lib/apt/lists/*
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil
COPY --from=foundry /usr/local/bin/cast /usr/local/bin/cast
COPY --from=foundry /usr/local/bin/forge /usr/local/bin/forge
COPY --from=contract-toolchain --chown=node:node /home/foundry/.svm /home/node/.svm
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace/sandbox ./sandbox
COPY --chown=node:node corner-store.config.json corner-store.reg-d.config.json corner-store.scenario.json ./project/
RUN mkdir -p /workspace/project/deployments /workspace/project/.corner-store /workspace/studio-projects \\
 && chown -R node:node /workspace/project /workspace/studio-projects \\
 && chmod 0755 /workspace/sandbox/scripts/*.sh
ENV CORNER_STORE_CONTRACTS_ROOT=/workspace/sandbox/contracts
USER node
`;
}

function sandboxCompose(): string {
  return `name: corner-store-sandbox

x-runtime: &runtime
  build:
    context: .
    target: runtime
  image: corner-store-sandbox:local
  init: true
  stop_grace_period: 10s

services:
  anvil:
    <<: *runtime
    command: ["anvil", "--host", "0.0.0.0", "--chain-id", "31337"]
    ports:
      - "\${CORNER_STORE_RPC_PORT:-8545}:8545"
    healthcheck:
      test: ["CMD-SHELL", "cast chain-id --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1"]
      interval: 2s
      timeout: 3s
      retries: 30

  deployer:
    <<: *runtime
    command: ["/workspace/sandbox/scripts/deploy.sh"]
    environment:
      CORNER_STORE_PROFILE: "\${CORNER_STORE_PROFILE:-buidl-like}"
      CORNER_STORE_RPC_URL: http://anvil:8545
    volumes:
      - deployment-artifacts:/workspace/project/deployments
    depends_on:
      anvil:
        condition: service_healthy
    restart: "no"

  rfq:
    <<: *runtime
    command: ["node", "/workspace/sandbox/services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js"]
    environment:
      RFQ_DEMO_HOST: 0.0.0.0
      RFQ_DEMO_PORT: "8787"
      RFQ_DEMO_CHAIN_ID: "31337"
      RFQ_DEMO_RPC_URL: http://anvil:8545
      RFQ_DEMO_ARTIFACT: /workspace/project/deployments/anvil-e2e.json
      RFQ_DEMO_SCENARIO: /workspace/project/corner-store.scenario.json
      RFQ_DEMO_ENABLE_SETTLEMENT: "1"
      CORNER_STORE_EVENTS: /workspace/project/deployments/dex-events.json
    volumes:
      - deployment-artifacts:/workspace/project/deployments
    depends_on:
      deployer:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 3s
      timeout: 3s
      retries: 30
    restart: unless-stopped

  operator-api:
    <<: *runtime
    command: ["/workspace/sandbox/scripts/operator-api.sh"]
    environment:
      CORNER_STORE_PROFILE: "\${CORNER_STORE_PROFILE:-buidl-like}"
      HOST: 0.0.0.0
      PORT: "8788"
      CORNER_STORE_ARTIFACT: /workspace/project/deployments/anvil-e2e.json
      CORNER_STORE_EVENTS: /workspace/project/deployments/dex-events.json
    volumes:
      - deployment-artifacts:/workspace/project/deployments
    depends_on:
      deployer:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8788/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 3s
      timeout: 3s
      retries: 30
    restart: unless-stopped

  portal:
    <<: *runtime
    command: ["node", "/workspace/sandbox/services/operator-dashboard/server.js"]
    environment:
      HOST: 0.0.0.0
      PORT: "8790"
      CORNER_STORE_OPERATOR_API: http://operator-api:8788
      CORNER_STORE_RFQ_BACKEND: http://rfq:8787
    ports:
      - "\${CORNER_STORE_PORTAL_PORT:-8790}:8790"
    depends_on:
      rfq:
        condition: service_healthy
      operator-api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8790/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 3s
      timeout: 3s
      retries: 30
    restart: unless-stopped

  studio:
    <<: *runtime
    command: ["node", "/workspace/sandbox/services/deployment-studio/dist/src/index.js"]
    environment:
      CORNER_STORE_STUDIO_HOST: 0.0.0.0
      CORNER_STORE_STUDIO_PORT: "8791"
      CORNER_STORE_STUDIO_ROOT: /workspace/studio-projects
      CORNER_STORE_CLI_ENTRY: /workspace/sandbox/services/cli/dist/cli/src/index.js
      CORNER_STORE_OPERATIONS_URL: http://127.0.0.1:\${CORNER_STORE_PORTAL_PORT:-8790}
      CORNER_STORE_DEFAULT_RPC: http://anvil:8545
      CORNER_STORE_ALLOWED_RPC_HOSTS: anvil,127.0.0.1,localhost,::1
      CORNER_STORE_STUDIO_MANAGED_DEX_RUNTIME: "0"
    ports:
      - "\${CORNER_STORE_STUDIO_PORT:-8791}:8791"
    volumes:
      - studio-projects:/workspace/studio-projects
    depends_on:
      portal:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8791/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 3s
      timeout: 3s
      retries: 30
    restart: unless-stopped

volumes:
  deployment-artifacts:
  studio-projects:
`;
}

function sandboxDockerignore(): string {
  return `.git
.env
.env.*
node_modules
dist
.corner-store
deployments
vendor
*.log
`;
}

function sandboxDeployScript(): string {
  return `#!/bin/sh
set -eu

cd /workspace/project

profile="\${CORNER_STORE_PROFILE:-buidl-like}"
case "$profile" in
  buidl-like) config=corner-store.config.json ;;
  reg-d) config=corner-store.reg-d.config.json ;;
  *) echo "unsupported CORNER_STORE_PROFILE: $profile (expected buidl-like or reg-d)" >&2; exit 64 ;;
esac

cli=/workspace/sandbox/services/cli/dist/cli/src/index.js
artifact=deployments/anvil-e2e.json
rpc="\${CORNER_STORE_RPC_URL:-http://anvil:8545}"
node "$cli" --rpc "$rpc" --artifact "$artifact" deploy "$config" --broadcast
node "$cli" --rpc "$rpc" --artifact "$artifact" verify "$config"
`;
}

function sandboxOperatorApiScript(): string {
  return `#!/bin/sh
set -eu

case "\${CORNER_STORE_PROFILE:-buidl-like}" in
  buidl-like) export CORNER_STORE_CONFIG=/workspace/project/corner-store.config.json ;;
  reg-d) export CORNER_STORE_CONFIG=/workspace/project/corner-store.reg-d.config.json ;;
  *) echo "unsupported CORNER_STORE_PROFILE" >&2; exit 64 ;;
esac
exec node /workspace/sandbox/services/operator-api/dist/src/index.js
`;
}

function vendoredSandboxFiles(sourceRoot: string): Record<string, string> {
  const root = resolve(sourceRoot);
  const contractsRoot = existsSync(resolve(root, "contracts/foundry.toml")) ? resolve(root, "contracts") : root;
  const servicesRoot = resolve(root, "services");
  const files: Record<string, string> = {};
  const serviceInputs: Record<string, string[]> = {
    toolkit: ["package.json", "package-lock.json", "tsconfig.json", "src"],
    rfq: ["package.json", "package-lock.json", "tsconfig.json", "src"],
    cli: ["package.json", "package-lock.json", "tsconfig.json", "src"],
    "rfq-demo-backend": ["package.json", "package-lock.json", "tsconfig.json", "src"],
    "operator-api": ["package.json", "package-lock.json", "tsconfig.json", "src"],
    "operator-dashboard": ["package.json", "server.js", "index.html", "styles.css", "app.js"],
    "deployment-studio": ["package.json", "package-lock.json", "tsconfig.json", "src", "web"]
  };
  for (const [service, inputs] of Object.entries(serviceInputs)) {
    for (const input of inputs) {
      collectTextPath(
        resolve(servicesRoot, service, input),
        `sandbox/services/${service}/${input}`,
        files
      );
    }
  }
  for (const input of [
    "src",
    "script",
    "test/fixtures",
    "test/mocks",
    "lib/openzeppelin-contracts/contracts",
    "lib/openzeppelin-contracts-upgradeable/contracts",
    "lib/solidity/contracts",
    "lib/ERC-3643/contracts",
    "lib/forge-std/src",
    "foundry.toml",
    "remappings.txt"
  ]) {
    collectTextPath(resolve(contractsRoot, input), `sandbox/contracts/${input}`, files);
  }
  return files;
}

function collectTextPath(source: string, output: string, files: Record<string, string>): void {
  if (!existsSync(source)) throw new Error(`sandbox runtime source missing: ${source}`);
  if (statSync(source).isDirectory()) {
    for (const name of readdirSync(source).sort()) {
      collectTextPath(resolve(source, name), `${output}/${name}`, files);
    }
    return;
  }
  files[output] = readFileSync(source, "utf8");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
