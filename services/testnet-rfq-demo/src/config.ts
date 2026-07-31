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
  governance: string;
  operator: string;
  maker: string;
  investor: string;
  eligibleInvestorB: string;
  ineligibleInvestor: string;
  rwaToken: string;
  quote: string;
  rfqVenue: string;
  router: string;
  engine: string;
  policyReg: string;
  rfqAdapter: string;
  makerAuthorizer: string;
  qualifiedPurchaser: string;
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
}

export function loadConfig(env = process.env): TestnetDemoConfig {
  const artifactPath = resolve(env.CORNER_STORE_TESTNET_ARTIFACT ?? "");
  if (!env.CORNER_STORE_TESTNET_ARTIFACT || !existsSync(artifactPath)) {
    throw new Error("CORNER_STORE_TESTNET_ARTIFACT must point to a verified deployments/public artifact");
  }
  const artifact = validateArtifact(JSON.parse(readFileSync(artifactPath, "utf8")));
  const makerKey = env.CORNER_STORE_TESTNET_MAKER_KEY;
  if (!makerKey) throw new Error("CORNER_STORE_TESTNET_MAKER_KEY is required for the disposable testnet maker");
  const makerWallet = new Wallet(makerKey);
  if (makerWallet.address.toLowerCase() !== artifact.maker.toLowerCase()) {
    throw new Error(`maker key ${makerWallet.address} does not match artifact maker ${artifact.maker}`);
  }

  return {
    host: env.CORNER_STORE_TESTNET_DEMO_HOST ?? "127.0.0.1",
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
    priceDenominator: positiveBigInt(env.CORNER_STORE_TESTNET_PRICE_DENOMINATOR, 1n, "price denominator")
  };
}

function validateArtifact(value: unknown): PublicDeploymentArtifact {
  if (!isRecord(value)) throw new Error("deployment artifact must be a JSON object");
  if (value.activationMode !== "public-testnet-reference-fixture" || value.productionDeployment !== false) {
    throw new Error("artifact is not a Corner Store public-testnet reference fixture");
  }
  const numberFields = ["schemaVersion", "chainId", "createdAt"] as const;
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
    "rwaToken", "quote", "rfqVenue", "router", "engine", "policyReg", "rfqAdapter",
    "makerAuthorizer", "qualifiedPurchaser"
  ] as const;
  const normalized: Record<string, unknown> = {...value};
  for (const field of addressFields) {
    if (typeof value[field] !== "string") throw new Error(`artifact ${field} is required`);
    normalized[field] = getAddress(value[field]);
  }
  return normalized as unknown as PublicDeploymentArtifact;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
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
