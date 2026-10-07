import {existsSync, readFileSync} from "fs";
import {resolve} from "path";
import {Wallet, getAddress} from "ethers";

export interface PublicDeploymentArtifact {
  schemaVersion: number;
  deploymentId: string;
  sourceCommit: string;
  chainId: number;
  createdAt: number;
  assetProfile: string;
  activationMode: string;
  productionDeployment: boolean;
  participantApprovalsRequired: boolean;
  eligibleInvestorBScenario?: "eligible" | "holding-period-pending";
  governance: string;
  operator: string;
  maker: string;
  investor: string;
  eligibleInvestorB: string;
  ineligibleInvestor: string;
  expiredInvestor?: string;
  rwaToken: string;
  quote: string;
  rfqVenue: string;
  elementReg: string;
  recipeReg: string;
  router: string;
  engine: string;
  policyReg: string;
  operatorReg: string;
  venueReg: string;
  selector: string;
  rfqAdapter: string;
  makerAuthorizer: string;
  qualifiedPurchaser: string;
  acquisitionSource: string;
  lockup: string;
  identityRegistry: string;
  identityRegistryStorage: string;
  trustedIssuersRegistry: string;
  claimTopicsRegistry: string;
  claimIssuer: string;
  makerIdentity: string;
  investorIdentity: string;
  eligibleInvestorBIdentity: string;
  ineligibleInvestorIdentity: string;
  expiredInvestorIdentity?: string;
  transactionCount?: number;
}

export interface TestnetDemoConfig {
  host: string;
  port: number;
  rpcUrl: string;
  explorerUrl?: string;
  artifactPath: string;
  artifact: PublicDeploymentArtifact;
  makerWallet: Wallet;
  quoteTtlSeconds: number;
  priceNumerator: bigint;
  priceDenominator: bigint;
  apiRequestsPerMinute: number;
  quoteRequestsPerMinute: number;
  rpcRequestsPerSecond: number;
}

export function loadConfig(env = process.env): TestnetDemoConfig {
  const artifactPath = resolve(env.CORNER_STORE_TESTNET_ARTIFACT ?? "");
  if (!env.CORNER_STORE_TESTNET_ARTIFACT || !existsSync(artifactPath)) {
    throw new Error("CORNER_STORE_TESTNET_ARTIFACT must point to a verified deployments/public artifact");
  }
  const artifact = validateArtifact(JSON.parse(readFileSync(artifactPath, "utf8")));
  const makerKey = loadMakerKey(env);
  const makerWallet = new Wallet(makerKey);
  if (makerWallet.address.toLowerCase() !== artifact.maker.toLowerCase()) {
    throw new Error(`maker key ${makerWallet.address} does not match artifact maker ${artifact.maker}`);
  }
  const host = env.CORNER_STORE_TESTNET_DEMO_HOST ?? "127.0.0.1";
  if (!isLoopbackHost(host) && env.CORNER_STORE_TESTNET_PUBLIC_ACKNOWLEDGEMENT !== "hackathon-testnet-only") {
    throw new Error(
      "non-loopback demo host requires CORNER_STORE_TESTNET_PUBLIC_ACKNOWLEDGEMENT=hackathon-testnet-only"
    );
  }

  return {
    host,
    port: positiveInteger(env.CORNER_STORE_TESTNET_DEMO_PORT, 8791, "demo port"),
    rpcUrl: required(env.CORNER_STORE_TESTNET_RPC_URL, "CORNER_STORE_TESTNET_RPC_URL"),
    ...(env.CORNER_STORE_TESTNET_EXPLORER_URL
      ? {explorerUrl: httpUrl(env.CORNER_STORE_TESTNET_EXPLORER_URL, "explorer URL").replace(/\/+$/, "")}
      : {}),
    artifactPath,
    artifact,
    makerWallet,
    quoteTtlSeconds: positiveInteger(env.CORNER_STORE_TESTNET_QUOTE_TTL_SECONDS, 300, "quote TTL"),
    priceNumerator: positiveBigInt(env.CORNER_STORE_TESTNET_PRICE_NUMERATOR, 1n, "price numerator"),
    priceDenominator: positiveBigInt(env.CORNER_STORE_TESTNET_PRICE_DENOMINATOR, 1n, "price denominator"),
    apiRequestsPerMinute: boundedPositiveInteger(
      env.CORNER_STORE_TESTNET_API_REQUESTS_PER_MINUTE,
      240,
      10_000,
      "API requests per minute"
    ),
    quoteRequestsPerMinute: boundedPositiveInteger(
      env.CORNER_STORE_TESTNET_QUOTE_REQUESTS_PER_MINUTE,
      20,
      1_000,
      "quote requests per minute"
    ),
    rpcRequestsPerSecond: boundedPositiveInteger(
      env.CORNER_STORE_TESTNET_RPC_REQUESTS_PER_SECOND,
      10,
      1_000,
      "RPC requests per second"
    )
  };
}

function validateArtifact(value: unknown): PublicDeploymentArtifact {
  if (!isRecord(value)) throw new Error("deployment artifact must be a JSON object");
  if (value.activationMode !== "public-testnet-reference-fixture" || value.productionDeployment !== false) {
    throw new Error("artifact is not a Corner Store public-testnet reference fixture");
  }
  if (value.schemaVersion !== 1) throw new Error("artifact schemaVersion must be 1");
  const numberFields = ["chainId", "createdAt"] as const;
  for (const field of numberFields) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) <= 0) {
      throw new Error(`artifact ${field} must be a positive integer`);
    }
  }
  const textFields = ["deploymentId", "sourceCommit", "assetProfile", "activationMode"] as const;
  for (const field of textFields) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new Error(`artifact ${field} is required`);
    }
  }
  const addressFields = [
    "governance", "operator", "maker", "investor", "eligibleInvestorB", "ineligibleInvestor",
    "rwaToken", "quote", "rfqVenue", "elementReg", "recipeReg", "router", "engine", "policyReg",
    "operatorReg", "venueReg", "selector", "rfqAdapter", "makerAuthorizer", "qualifiedPurchaser",
    "acquisitionSource", "lockup", "identityRegistry", "identityRegistryStorage", "trustedIssuersRegistry",
    "claimTopicsRegistry", "claimIssuer", "makerIdentity", "investorIdentity", "eligibleInvestorBIdentity",
    "ineligibleInvestorIdentity"
  ] as const;
  const normalized: Record<string, unknown> = {...value};
  if (
    value.eligibleInvestorBScenario !== undefined
      && value.eligibleInvestorBScenario !== "eligible"
      && value.eligibleInvestorBScenario !== "holding-period-pending"
  ) {
    throw new Error("artifact eligibleInvestorBScenario is invalid");
  }
  for (const field of addressFields) {
    if (typeof value[field] !== "string") throw new Error(`artifact ${field} is required`);
    normalized[field] = getAddress(value[field]);
  }
  if (value.expiredInvestor !== undefined) {
    if (typeof value.expiredInvestor !== "string") throw new Error("artifact expiredInvestor is invalid");
    normalized.expiredInvestor = getAddress(value.expiredInvestor);
  }
  if (value.expiredInvestorIdentity !== undefined) {
    if (typeof value.expiredInvestorIdentity !== "string") {
      throw new Error("artifact expiredInvestorIdentity is invalid");
    }
    normalized.expiredInvestorIdentity = getAddress(value.expiredInvestorIdentity);
  }
  if (
    normalized.expiredInvestor
      && normalized.expiredInvestor !== "0x0000000000000000000000000000000000000000"
      && (!normalized.expiredInvestorIdentity
        || normalized.expiredInvestorIdentity === "0x0000000000000000000000000000000000000000")
  ) {
    throw new Error("artifact expiredInvestorIdentity is required for the expired investor");
  }
  return normalized as unknown as PublicDeploymentArtifact;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadMakerKey(env: NodeJS.ProcessEnv): string {
  const direct = env.CORNER_STORE_TESTNET_MAKER_KEY;
  const file = env.CORNER_STORE_TESTNET_MAKER_KEY_FILE;
  if (direct && file) {
    throw new Error("set only one of CORNER_STORE_TESTNET_MAKER_KEY or CORNER_STORE_TESTNET_MAKER_KEY_FILE");
  }
  if (file) {
    const path = resolve(file);
    if (!existsSync(path)) throw new Error("CORNER_STORE_TESTNET_MAKER_KEY_FILE does not exist");
    const value = readFileSync(path, "utf8").trim();
    if (!value) throw new Error("CORNER_STORE_TESTNET_MAKER_KEY_FILE is empty");
    return value;
  }
  if (!direct) {
    throw new Error(
      "CORNER_STORE_TESTNET_MAKER_KEY or CORNER_STORE_TESTNET_MAKER_KEY_FILE is required for the disposable testnet maker"
    );
  }
  return direct;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function boundedPositiveInteger(value: string | undefined, fallback: number, maximum: number, name: string): number {
  const parsed = positiveInteger(value, fallback, name);
  if (parsed > maximum) throw new Error(`${name} must be at most ${maximum}`);
  return parsed;
}

function positiveBigInt(value: string | undefined, fallback: bigint, name: string): bigint {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`${name} must be a positive uint`);
  return BigInt(value);
}

function httpUrl(value: string, name: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http or https`);
  }
  return parsed.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}
