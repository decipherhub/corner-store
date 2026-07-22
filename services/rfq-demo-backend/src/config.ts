import {existsSync, readFileSync} from "fs";
import {dirname, resolve} from "path";
import {HDNodeWallet, Wallet} from "ethers";

import {Address, Hex} from "../../rfq/src";

export const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
export const DEFAULT_CHAIN_ID = 31337;
export const DEFAULT_PORT = 8787;
export const DEFAULT_TTL_SECONDS = 3600;

export interface Artifact {
  deployer: string;
  investor: string;
  maker: string;
  quote: string;
  rfqAdapter: string;
  rfqVenue: string;
  rwaToken: string;
  router: string;
}

export interface DemoBackendConfig {
  host: string;
  port: number;
  chainId: number;
  rpcUrl: string;
  artifactPath: string;
  artifact: Artifact;
  makerWallet: Wallet | HDNodeWallet;
  defaultTtlSeconds: number;
  priceNumerator: string;
  priceDenominator: string;
  eventsPath?: string;
  demoSettlement: {
    enabled: boolean;
    operatorAccount: number;
    investorAccount: number;
  };
  now?: () => number | Promise<number>;
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): DemoBackendConfig {
  const args = parseArgs(argv);
  const artifactPath = resolveArtifactPath(args.artifact ?? env.RFQ_DEMO_ARTIFACT);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;

  const makerWallet = resolveMakerWallet(args, env);
  const defaultTtlSeconds = parsePositiveInt(args.ttl ?? env.RFQ_DEMO_TTL_SECONDS, DEFAULT_TTL_SECONDS, "ttl");

  return {
    host: args.host ?? env.RFQ_DEMO_HOST ?? "127.0.0.1",
    port: parsePositiveInt(args.port ?? env.RFQ_DEMO_PORT, DEFAULT_PORT, "port"),
    chainId: parsePositiveInt(args.chainId ?? env.RFQ_DEMO_CHAIN_ID, DEFAULT_CHAIN_ID, "chain-id"),
    rpcUrl: args.rpc ?? env.RFQ_DEMO_RPC_URL ?? "http://127.0.0.1:8545",
    artifactPath,
    artifact,
    makerWallet,
    defaultTtlSeconds,
    priceNumerator: parsePositiveBigIntString(args.priceNumerator ?? env.RFQ_DEMO_PRICE_NUMERATOR, "1", "price-numerator"),
    priceDenominator: parsePositiveBigIntString(args.priceDenominator ?? env.RFQ_DEMO_PRICE_DENOMINATOR, "1", "price-denominator"),
    eventsPath: env.CORNER_STORE_EVENTS,
    demoSettlement: {
      enabled: env.RFQ_DEMO_ENABLE_SETTLEMENT === "1",
      operatorAccount: parseAccountIndex(env.RFQ_DEMO_OPERATOR_ACCOUNT ?? "0"),
      investorAccount: parseAccountIndex(env.RFQ_DEMO_INVESTOR_ACCOUNT ?? "1")
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
    "  --chain-id <n>                RFQ EIP-712 chain id (default: 31337)",
    "  --rpc <url>                   chain RPC used for quote expiry time (default: http://127.0.0.1:8545)",
    "  --maker-account <n>           Anvil maker account index (default: 2)",
    "  --maker-key <hex>             explicit maker private key",
    "  --ttl <seconds>               default quote TTL (default: 3600)",
    "  --price-numerator <uint>      fixed-rate amountOut numerator (default: 1)",
    "  --price-denominator <uint>    fixed-rate amountOut denominator (default: 1)",
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

function resolveMakerWallet(args: Record<string, string | undefined>, env: NodeJS.ProcessEnv): Wallet | HDNodeWallet {
  const key = args.makerKey ?? env.RFQ_DEMO_MAKER_KEY;
  if (key) return new Wallet(key.startsWith("0x") ? (key as Hex) : (`0x${key}` as Hex));
  const index = parseAccountIndex(args.makerAccount ?? env.RFQ_DEMO_MAKER_ACCOUNT ?? "2");
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${index}`);
}

function parseAccountIndex(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) throw new Error(`maker-account must be an integer 0-9`);
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
