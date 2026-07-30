import {existsSync, readFileSync} from "fs";
import {dirname, resolve} from "path";
import {HDNodeWallet, Wallet, keccak256, toUtf8Bytes} from "ethers";

import {Address, Hex} from "../../rfq/src";

export const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
export const DEFAULT_CHAIN_ID = 31337;
export const DEFAULT_PORT = 8787;

export interface Artifact {
  assetProfile: "buidl-like" | "reg-d";
  coreDeployment?: string;
  activationMode?: string;
  productionDeployment?: boolean;
  scenarioSchemaVersion: number;
  scenarioHash: string;
  deployer: string;
  investor: string;
  eligibleInvestorB?: string;
  ineligibleInvestor?: string;
  maker: string;
  makerAuthorizer: string;
  quote: string;
  rfqAdapter: string;
  rfqVenue: string;
  rwaToken: string;
  router: string;
  engine?: string;
  policyReg?: string;
  elementReg?: string;
  qualifiedPurchaser?: string;
}

export type DemoArtifactWalletKey = "investor" | "eligibleInvestorB" | "ineligibleInvestor";

export interface DemoScenario {
  schemaVersion: 2;
  deployment: {
    accounts: {
      deployer: number;
      investor: number;
      maker: number;
      unapprovedMaker: number;
      eligibleInvestorB: number;
      ineligibleInvestor: number;
    };
    initialBalancesBaseUnits: {
      investorQuote: string;
      investorRwa: string;
      makerQuote: string;
      makerRwa: string;
      poolRwa: string;
    };
  };
  execution: {
    pricing: {
      provider: "trade-impact-mock";
      numerator: string;
      denominator: string;
      impactBpsPerReferenceAmount: number;
      referenceAmountRwaBaseUnits: string;
      maxImpactBps: number;
    };
    defaultBuyAmountBaseUnits: string;
    defaultSellAmountBaseUnits: string;
    minimumTradeBufferBps: number;
    defaultQuoteTtlSeconds: number;
  };
  asset: {
    name: string;
    symbol: string;
    minimumAmountBaseUnits: string;
    decimals: number;
  };
  quoteAsset: {
    name: string;
    symbol: string;
    decimals: number;
  };
  maker: {label: string};
  wallets: Array<{
    id: string;
    label: string;
    account: number;
    artifactKey: DemoArtifactWalletKey;
    initialQualifiedPurchaser: boolean;
  }>;
  previewQuotes: Array<{maker: string; rate: string}>;
  marketHistory: {
    intervalSeconds: number;
    sampleIntervalSeconds: number;
    indicativeSpreadBps: number;
    oraclePrices: string[];
    indicativeMidPrices: string[];
  };
  temporalEligibility: {
    walletId: string;
    baselineFreshnessSeconds: number;
    freshnessSeconds: number;
    advanceSeconds: number;
    quoteTtlSeconds: number;
  };
}

export interface DemoBackendConfig {
  host: string;
  port: number;
  chainId: number;
  rpcUrl: string;
  artifactPath: string;
  artifact: Artifact;
  scenarioPath: string;
  scenario: DemoScenario;
  makerWallet: Wallet | HDNodeWallet;
  defaultTtlSeconds: number;
  priceNumerator: string;
  priceDenominator: string;
  eventsPath?: string;
  demoSettlement: {
    enabled: boolean;
    operatorAccount: number;
  };
  now?: () => number | Promise<number>;
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): DemoBackendConfig {
  const args = parseArgs(argv);
  const artifactPath = resolveArtifactPath(args.artifact ?? env.RFQ_DEMO_ARTIFACT);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
  const scenarioPath = resolveScenarioPath(args.scenario ?? env.RFQ_DEMO_SCENARIO);
  const scenarioJson = readFileSync(scenarioPath, "utf8");
  const scenario = validateScenario(JSON.parse(scenarioJson), artifact.assetProfile);
  if (artifact.scenarioSchemaVersion !== scenario.schemaVersion) {
    throw new Error("demo scenario schema version does not match the deployment artifact");
  }
  if (artifact.scenarioHash?.toLowerCase() !== keccak256(toUtf8Bytes(scenarioJson)).toLowerCase()) {
    throw new Error("demo scenario does not match the data used to deploy the stack");
  }
  if (
    args.ttl !== undefined || env.RFQ_DEMO_TTL_SECONDS !== undefined ||
    args.priceNumerator !== undefined || env.RFQ_DEMO_PRICE_NUMERATOR !== undefined ||
    args.priceDenominator !== undefined || env.RFQ_DEMO_PRICE_DENOMINATOR !== undefined
  ) {
    throw new Error("quote TTL and fixed-rate pricing are deployment-bound; change the scenario and redeploy");
  }

  const makerWallet = resolveMakerWallet(args, env, scenario.deployment.accounts.maker);

  return {
    host: args.host ?? env.RFQ_DEMO_HOST ?? "127.0.0.1",
    port: parsePositiveInt(args.port ?? env.RFQ_DEMO_PORT, DEFAULT_PORT, "port"),
    chainId: parsePositiveInt(args.chainId ?? env.RFQ_DEMO_CHAIN_ID, DEFAULT_CHAIN_ID, "chain-id"),
    rpcUrl: args.rpc ?? env.RFQ_DEMO_RPC_URL ?? "http://127.0.0.1:8545",
    artifactPath,
    artifact,
    scenarioPath,
    scenario,
    makerWallet,
    defaultTtlSeconds: scenario.execution.defaultQuoteTtlSeconds,
    priceNumerator: scenario.execution.pricing.numerator,
    priceDenominator: scenario.execution.pricing.denominator,
    eventsPath: env.CORNER_STORE_EVENTS,
    demoSettlement: {
      enabled: env.RFQ_DEMO_ENABLE_SETTLEMENT === "1",
      operatorAccount: parseAccountIndex(
        env.RFQ_DEMO_OPERATOR_ACCOUNT ?? String(scenario.deployment.accounts.deployer),
        "operator-account"
      )
    }
  };
}

export function usage(): string {
  return [
    "Usage: npm start -- [options]",
    "",
    "Options:",
    "  --host <host>                 bind host (default: 127.0.0.1)",
    "  --port <port>                 bind port (default: 8787)",
    "  --artifact <path>             deployment artifact (default: deployments/anvil-e2e.json)",
    "  --scenario <path>             injected demo data (default: services/rfq-demo-backend/config/demo-scenario.json)",
    "  --chain-id <n>                RFQ EIP-712 chain id (default: 31337)",
    "  --rpc <url>                   chain RPC used for quote expiry time (default: http://127.0.0.1:8545)",
    "  --maker-account <n>           Anvil maker account index (default: injected scenario)",
    "  --maker-key <hex>             explicit maker private key",
    "  --help                        print this help"
  ].join("\n");
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === "--help" || raw === "-h") {
      out.help = "true";
      continue;
    }
    if (!raw.startsWith("--")) throw new Error(`unknown argument ${raw}`);
    const eq = raw.indexOf("=");
    if (eq >= 0) {
      out[toCamel(raw.slice(2, eq))] = raw.slice(eq + 1);
      continue;
    }
    const key = toCamel(raw.slice(2));
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`${raw} requires a value`);
    out[key] = value;
    i++;
  }
  return out;
}

function toCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function findRepoRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, "foundry.toml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function resolveArtifactPath(opt?: string): string {
  const candidates: string[] = [];
  if (opt) candidates.push(resolve(process.cwd(), opt));
  const root = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (root) candidates.push(resolve(root, "deployments/anvil-e2e.json"));
  candidates.push(resolve(process.cwd(), "deployments/anvil-e2e.json"));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`deployment artifact not found; pass --artifact <path> or run scripts/e2e-anvil.sh --keep first`);
}

function resolveScenarioPath(opt?: string): string {
  if (opt) {
    const explicit = resolve(process.cwd(), opt);
    if (!existsSync(explicit)) throw new Error(`demo scenario not found: ${explicit}`);
    return explicit;
  }
  const candidates: string[] = [];
  const root = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (root) candidates.push(resolve(root, "services/rfq-demo-backend/config/demo-scenario.json"));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("demo scenario not found; pass --scenario <path> or set RFQ_DEMO_SCENARIO");
}

function validateScenario(value: unknown, assetProfile: Artifact["assetProfile"]): DemoScenario {
  if (!isRecord(value) || value.schemaVersion !== 2) throw new Error("demo scenario schemaVersion must be 2");
  const deployment = value.deployment;
  const execution = value.execution;
  const asset = value.asset;
  const quoteAsset = value.quoteAsset;
  const maker = value.maker;
  const wallets = value.wallets;
  const previewQuotes = value.previewQuotes;
  const marketHistory = value.marketHistory;
  const temporal = value.temporalEligibility;
  if (
    !isRecord(deployment) || !isRecord(deployment.accounts) ||
    !isRecord(deployment.initialBalancesBaseUnits) ||
    !isRecord(execution) || !isRecord(execution.pricing) ||
    !isRecord(asset) || !isRecord(quoteAsset) || !isRecord(maker) ||
    !Array.isArray(wallets) || !Array.isArray(previewQuotes) ||
    !isRecord(marketHistory) || !isRecord(temporal)
  ) {
    throw new Error("demo scenario is missing required sections");
  }
  const accounts = deployment.accounts;
  const balances = deployment.initialBalancesBaseUnits;
  const accountKeys = [
    "deployer", "investor", "maker", "unapprovedMaker", "eligibleInvestorB", "ineligibleInvestor"
  ] as const;
  const normalizedAccounts = Object.fromEntries(accountKeys.map((key) => {
    const account = accounts[key];
    if (!Number.isInteger(account) || Number(account) < 0 || Number(account) > 9) {
      throw new Error(`demo scenario deployment account ${key} must be an integer 0-9`);
    }
    return [key, Number(account)];
  })) as DemoScenario["deployment"]["accounts"];
  if (new Set(Object.values(normalizedAccounts)).size !== accountKeys.length) {
    throw new Error("demo scenario deployment accounts must be unique");
  }
  const balanceKeys = ["investorQuote", "investorRwa", "makerQuote", "makerRwa", "poolRwa"] as const;
  const normalizedBalances = Object.fromEntries(balanceKeys.map((key) => {
    const amount = balances[key];
    if (typeof amount !== "string" || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
      throw new Error(`demo scenario initial balance ${key} must be a positive base-unit uint string`);
    }
    return [key, amount];
  })) as DemoScenario["deployment"]["initialBalancesBaseUnits"];
  if (
    execution.pricing.provider !== "trade-impact-mock" ||
    typeof execution.pricing.numerator !== "string" ||
    typeof execution.pricing.denominator !== "string" ||
    !isPositiveSafeInteger(execution.pricing.impactBpsPerReferenceAmount) ||
    !isPositiveSafeInteger(execution.pricing.maxImpactBps) ||
    Number(execution.pricing.maxImpactBps) >= 10_000 ||
    Number(execution.pricing.impactBpsPerReferenceAmount) > Number(execution.pricing.maxImpactBps) ||
    typeof execution.pricing.referenceAmountRwaBaseUnits !== "string" ||
    !/^\d+$/.test(execution.pricing.referenceAmountRwaBaseUnits) ||
    BigInt(execution.pricing.referenceAmountRwaBaseUnits) <= 0n
  ) throw new Error("demo scenario execution pricing provider is invalid");
  const pricingNumerator = parsePositiveBigIntString(execution.pricing.numerator, "1", "scenario price numerator");
  const pricingDenominator = parsePositiveBigIntString(execution.pricing.denominator, "1", "scenario price denominator");
  if (
    typeof execution.defaultBuyAmountBaseUnits !== "string" ||
    !/^\d+$/.test(execution.defaultBuyAmountBaseUnits) ||
    BigInt(execution.defaultBuyAmountBaseUnits) <= 0n ||
    typeof execution.defaultSellAmountBaseUnits !== "string" ||
    !/^\d+$/.test(execution.defaultSellAmountBaseUnits) ||
    BigInt(execution.defaultSellAmountBaseUnits) <= 0n ||
    !isPositiveSafeInteger(execution.minimumTradeBufferBps) ||
    Number(execution.minimumTradeBufferBps) >= 10_000 ||
    !isPositiveSafeInteger(execution.defaultQuoteTtlSeconds)
  ) throw new Error("demo scenario execution defaults are invalid");
  const defaultBuyAmount = BigInt(execution.defaultBuyAmountBaseUnits);
  const defaultSellAmount = BigInt(execution.defaultSellAmountBaseUnits);
  if (
    typeof asset.name !== "string" || asset.name.trim() === "" ||
    typeof asset.symbol !== "string" || asset.symbol.trim() === "" ||
    typeof asset.minimumAmountBaseUnits !== "string" || !/^\d+$/.test(asset.minimumAmountBaseUnits) ||
    BigInt(asset.minimumAmountBaseUnits) <= 0n ||
    !Number.isInteger(asset.decimals) || Number(asset.decimals) < 0 || Number(asset.decimals) > 36 ||
    typeof quoteAsset.name !== "string" || quoteAsset.name.trim() === "" ||
    typeof quoteAsset.symbol !== "string" || quoteAsset.symbol.trim() === "" ||
    !Number.isInteger(quoteAsset.decimals) || Number(quoteAsset.decimals) < 0 || Number(quoteAsset.decimals) > 36 ||
    typeof maker.label !== "string" || maker.label.trim() === ""
  ) throw new Error("demo scenario asset or maker is invalid");
  const assetScale = 10n ** BigInt(Number(asset.decimals));
  const quoteScale = 10n ** BigInt(Number(quoteAsset.decimals));
  const buyAmountOut =
    defaultBuyAmount * BigInt(pricingDenominator) * assetScale /
    (BigInt(pricingNumerator) * quoteScale);
  const sellAmountOut =
    defaultSellAmount * BigInt(pricingNumerator) * quoteScale /
    (BigInt(pricingDenominator) * assetScale);
  if (buyAmountOut <= 0n || sellAmountOut <= 0n) {
    throw new Error("demo scenario pricing must return positive output for both default trades");
  }
  if (
    BigInt(normalizedBalances.investorQuote) < defaultBuyAmount ||
    BigInt(normalizedBalances.investorRwa) < defaultSellAmount ||
    BigInt(normalizedBalances.makerRwa) < buyAmountOut ||
    BigInt(normalizedBalances.makerQuote) < sellAmountOut
  ) {
    throw new Error("demo scenario initial balances cannot fund the configured default buy and sell");
  }
  const normalizedWallets = wallets.map((wallet) => {
    if (!isRecord(wallet) || typeof wallet.id !== "string" || !/^[a-z0-9-]+$/.test(wallet.id) ||
      typeof wallet.label !== "string" || !Number.isInteger(wallet.account) || Number(wallet.account) < 0 ||
      Number(wallet.account) > 9 || typeof wallet.initialQualifiedPurchaser !== "boolean" ||
      !isArtifactWalletKey(wallet.artifactKey)) throw new Error("demo scenario wallet is invalid");
    return {
      id: wallet.id,
      label: wallet.label,
      account: Number(wallet.account),
      artifactKey: wallet.artifactKey,
      initialQualifiedPurchaser: wallet.initialQualifiedPurchaser
    };
  });
  if (normalizedWallets.length === 0 || new Set(normalizedWallets.map((wallet) => wallet.id)).size !== normalizedWallets.length) {
    throw new Error("demo scenario wallets must have unique ids");
  }
  if (
    new Set(normalizedWallets.map((wallet) => wallet.account)).size !== normalizedWallets.length ||
    new Set(normalizedWallets.map((wallet) => wallet.artifactKey)).size !== normalizedWallets.length
  ) {
    throw new Error("demo scenario wallets must map to unique Anvil accounts and artifact keys");
  }
  if (!normalizedWallets.some((wallet) => wallet.artifactKey === "investor")) {
    throw new Error("demo scenario must include the deployment investor wallet");
  }
  const accountByArtifactKey: Record<DemoArtifactWalletKey, number> = {
    investor: normalizedAccounts.investor,
    eligibleInvestorB: normalizedAccounts.eligibleInvestorB,
    ineligibleInvestor: normalizedAccounts.ineligibleInvestor
  };
  if (normalizedWallets.some((wallet) => wallet.account !== accountByArtifactKey[wallet.artifactKey])) {
    throw new Error("demo scenario wallet accounts must match deployment account bindings");
  }
  if (
    assetProfile === "buidl-like" &&
    (!normalizedWallets.some((wallet) => wallet.initialQualifiedPurchaser) ||
      !normalizedWallets.some((wallet) => !wallet.initialQualifiedPurchaser))
  ) {
    throw new Error("buidl-like demo scenario requires initially eligible and ineligible wallets");
  }
  if (
    assetProfile === "buidl-like" &&
    (buyAmountOut < BigInt(asset.minimumAmountBaseUnits as string) ||
      defaultSellAmount < BigInt(asset.minimumAmountBaseUnits as string))
  ) {
    throw new Error("buidl-like default buy and sell must satisfy the injected minimum RWA amount");
  }
  const normalizedPreviews = previewQuotes.map((quote) => {
    if (
      !isRecord(quote) || typeof quote.maker !== "string" || quote.maker.trim() === "" ||
      typeof quote.rate !== "string" || !/^\d+(\.\d+)?$/.test(quote.rate)
    ) {
      throw new Error("demo scenario preview quote is invalid");
    }
    return {maker: quote.maker, rate: quote.rate};
  });
  const normalizePriceSeries = (value: unknown, label: string): string[] => {
    if (!Array.isArray(value) || value.length < 4 || value.length > 96) {
      throw new Error(`demo scenario ${label} must contain 4-96 prices`);
    }
    return value.map((price) => {
      if (typeof price !== "string" || !/^\d+(\.\d{1,8})?$/.test(price) || Number(price) <= 0) {
        throw new Error(`demo scenario ${label} price is invalid`);
      }
      return price;
    });
  };
  const oraclePrices = normalizePriceSeries(marketHistory.oraclePrices, "oraclePrices");
  const indicativeMidPrices = normalizePriceSeries(marketHistory.indicativeMidPrices, "indicativeMidPrices");
  const generatedSampleCount = isPositiveSafeInteger(marketHistory.intervalSeconds) &&
    isPositiveSafeInteger(marketHistory.sampleIntervalSeconds)
    ? (oraclePrices.length - 1) *
      (Number(marketHistory.intervalSeconds) / Number(marketHistory.sampleIntervalSeconds)) + 1
    : 0;
  if (
    oraclePrices.length !== indicativeMidPrices.length ||
    !isPositiveSafeInteger(marketHistory.intervalSeconds) ||
    !isPositiveSafeInteger(marketHistory.sampleIntervalSeconds) ||
    Number(marketHistory.sampleIntervalSeconds) > Number(marketHistory.intervalSeconds) ||
    Number(marketHistory.intervalSeconds) % Number(marketHistory.sampleIntervalSeconds) !== 0 ||
    !Number.isInteger(generatedSampleCount) ||
    generatedSampleCount > 4096 ||
    !isPositiveSafeInteger(marketHistory.indicativeSpreadBps) ||
    Number(marketHistory.indicativeSpreadBps) >= 10_000
  ) throw new Error("demo scenario marketHistory is invalid");
  if (
    typeof temporal.walletId !== "string" || !normalizedWallets.some((wallet) => wallet.id === temporal.walletId) ||
    !isPositiveSafeInteger(temporal.baselineFreshnessSeconds) ||
    !isPositiveSafeInteger(temporal.freshnessSeconds) || !isPositiveSafeInteger(temporal.advanceSeconds) ||
    !isPositiveSafeInteger(temporal.quoteTtlSeconds) ||
    Number(temporal.advanceSeconds) <= Number(temporal.freshnessSeconds) ||
    Number(temporal.quoteTtlSeconds) <= Number(temporal.advanceSeconds)
  ) throw new Error("demo scenario temporalEligibility is invalid");
  return {
    schemaVersion: 2,
    deployment: {
      accounts: normalizedAccounts,
      initialBalancesBaseUnits: normalizedBalances
    },
    execution: {
      pricing: {
        provider: "trade-impact-mock",
        numerator: pricingNumerator,
        denominator: pricingDenominator,
        impactBpsPerReferenceAmount: Number(execution.pricing.impactBpsPerReferenceAmount),
        referenceAmountRwaBaseUnits: execution.pricing.referenceAmountRwaBaseUnits,
        maxImpactBps: Number(execution.pricing.maxImpactBps)
      },
      defaultBuyAmountBaseUnits: execution.defaultBuyAmountBaseUnits,
      defaultSellAmountBaseUnits: execution.defaultSellAmountBaseUnits,
      minimumTradeBufferBps: Number(execution.minimumTradeBufferBps),
      defaultQuoteTtlSeconds: Number(execution.defaultQuoteTtlSeconds)
    },
    asset: {
      name: asset.name,
      symbol: asset.symbol,
      minimumAmountBaseUnits: asset.minimumAmountBaseUnits,
      decimals: Number(asset.decimals)
    },
    quoteAsset: {
      name: quoteAsset.name,
      symbol: quoteAsset.symbol,
      decimals: Number(quoteAsset.decimals)
    },
    maker: {label: maker.label},
    wallets: normalizedWallets,
    previewQuotes: normalizedPreviews,
    marketHistory: {
      intervalSeconds: Number(marketHistory.intervalSeconds),
      sampleIntervalSeconds: Number(marketHistory.sampleIntervalSeconds),
      indicativeSpreadBps: Number(marketHistory.indicativeSpreadBps),
      oraclePrices,
      indicativeMidPrices
    },
    temporalEligibility: {
      walletId: temporal.walletId,
      baselineFreshnessSeconds: Number(temporal.baselineFreshnessSeconds),
      freshnessSeconds: Number(temporal.freshnessSeconds),
      advanceSeconds: Number(temporal.advanceSeconds),
      quoteTtlSeconds: Number(temporal.quoteTtlSeconds)
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArtifactWalletKey(value: unknown): value is DemoArtifactWalletKey {
  return value === "investor" || value === "eligibleInvestorB" || value === "ineligibleInvestor";
}

function isPositiveSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function resolveMakerWallet(
  args: Record<string, string | undefined>,
  env: NodeJS.ProcessEnv,
  defaultAccount: number
): Wallet | HDNodeWallet {
  const key = args.makerKey ?? env.RFQ_DEMO_MAKER_KEY;
  if (key) return new Wallet(key.startsWith("0x") ? (key as Hex) : (`0x${key}` as Hex));
  const index = parseAccountIndex(
    args.makerAccount ?? env.RFQ_DEMO_MAKER_ACCOUNT ?? String(defaultAccount),
    "maker-account"
  );
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${index}`);
}

function parseAccountIndex(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) throw new Error(`${label} must be an integer 0-9`);
  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  const raw = value ?? String(fallback);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parsePositiveBigIntString(value: string | undefined, fallback: string, label: string): string {
  const raw = value ?? fallback;
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) throw new Error(`${label} must be a positive uint string`);
  return raw;
}

export function asAddress(value: string, field: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`${field} must be a 20-byte hex address`);
  return value as Address;
}
