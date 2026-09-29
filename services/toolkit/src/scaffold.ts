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
    options.scenario
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
  scenario?: string
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
  if (manifest.deployment.dockerCompose) {
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
      test: "npm run build && npm run test:module",
      "test:module": "corner-store test-module dist/module-conformance.js",
      ...(standalone ? {
        doctor: "corner-store doctor",
        deploy: "corner-store deploy",
        verify: "corner-store verify",
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
  return `# Corner Store ${project.template}

Purpose: ${purpose.summary}

Template maturity: \`${project.maturity}\`; compatibility mode: \`${manifest.mode}\`.

The user-facing policy values live in \`corner-store.config.json\`. The generated
\`corner-store.project.json\` binds this template, config and deployment artifact;
do not copy contract addresses into source files.

${hasPolicyFacade
  ? "Run `npm run policy:explain` to see profile and venue values first. The Element/Recipe/Manifest/Operator model remains available as advanced detail."
  : "Install `@corner-store/toolkit` to use the optional `connectCornerStore()` policy facade."}

This scaffold is an integration starting point, not a hosted dealer or production
pricing/risk/custody system. Replace every module marked \`reference\` before
production and run the SDK conformance suite against the resulting module set.

1. Copy \`.env.example\` to a local secret-managed environment. Never commit it.
2. Install dependencies and run \`npm test\`.
3. ${manifest.mode === "reference-service"
  ? "Start the minimal reference HTTP service with `npm start`."
  : manifest.mode === "existing-backend"
    ? "Import `createCornerStoreRFQ` into the existing backend request handler."
    : "Import the RFQ SDK exports from `src/index.ts` in your application."}
4. Submit the signed quote through Corner Store's Router; backend prechecks never
   replace fill-time compliance.
${manifest.deployment.dockerCompose ? "\n`docker compose up --build` is an optional reference deployment path.\n" : ""}
`;
}

function defaultScenario(): unknown {
  return {
    schemaVersion: 2,
    note: "Replace with an operator-reviewed deployment scenario before broadcast."
  };
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

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
