import {existsSync, readFileSync} from "fs";
import {dirname, resolve} from "path";
import {Contract, HDNodeWallet, JsonRpcProvider, NonceManager, Signer, Wallet} from "ethers";

import {
  ELEMENT_REGISTRY_ABI,
  ENGINE_ABI,
  ERC20_ABI,
  ERRORS_ABI,
  FACTORY_ABI,
  RECIPE_REGISTRY_ABI,
  RFQ_ADAPTER_ABI,
  ROUTER_ABI,
  TOKEN_POLICY_REGISTRY_ABI,
  VENUE_REGISTRY_ABI
} from "./abi";

// Anvil's well-known development mnemonic (matches script/DemoConstants.sol).
export const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
export const DEFAULT_RPC = "http://127.0.0.1:8545";
export const DEFAULT_CHAIN_ID = 31337;

// The RFQ venue label + the AMM 1:1 fixture facts (script/DemoConstants.sol).
export const ALLOWED_JURISDICTION = "US";

export interface Artifact {
  assetProfile?: "buidl-like" | "reg-d";
  ammAdapter: string;
  deployer: string;
  elementReg: string;
  engine: string;
  factory: string;
  investor: string;
  jurisdiction: string;
  maker: string;
  makerAuthorizer: string;
  operatorReg: string;
  policyReg: string;
  pool: string;
  quote: string;
  recipeReg: string;
  rfqAdapter: string;
  rfqVenue: string;
  router: string;
  rwaToken: string;
  selector: string;
  surveillance: string;
  unapprovedMaker: string;
  venueReg: string;
}

export interface GlobalOpts {
  rpc?: string;
  artifact?: string;
  config?: string;
  account?: string;
  key?: string;
}

// Walk up from `start` looking for a foundry.toml (the repo root marker).
export function findRepoRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, "foundry.toml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function resolveArtifactPath(opt?: string): string {
  const candidates: string[] = [];
  if (opt) candidates.push(resolve(process.cwd(), opt));
  const root = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (root) candidates.push(resolve(root, "deployments/anvil-e2e.json"));
  candidates.push(resolve(process.cwd(), "deployments/anvil-e2e.json"));
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    `deployment artifact not found (looked in: ${candidates.join(", ")}). ` +
      `Run scripts/e2e-anvil.sh --keep first, or pass --artifact <path>.`
  );
}

export function loadArtifact(opt?: string): Artifact {
  const path = resolveArtifactPath(opt);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Artifact;
}

export function makeProvider(opts: GlobalOpts): JsonRpcProvider {
  return new JsonRpcProvider(opts.rpc ?? DEFAULT_RPC);
}

export function walletForAccount(index: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, "", `m/44'/60'/0'/0/${index}`);
}

// Resolve the signing wallet. Priority: --key, then --account, then `fallback`
// (the sensible default for the command: operator=0 for admin actions, 1 for buys).
export function resolveSigner(opts: GlobalOpts, provider: JsonRpcProvider, fallbackAccount: number): Signer {
  let base: Wallet | HDNodeWallet;
  if (opts.key) {
    const key = opts.key.startsWith("0x") ? opts.key : `0x${opts.key}`;
    base = new Wallet(key, provider);
  } else {
    const idx = opts.account !== undefined ? Number(opts.account) : fallbackAccount;
    if (!Number.isInteger(idx) || idx < 0 || idx > 9) {
      throw new Error(`--account must be an integer 0-9 (got ${opts.account})`);
    }
    base = walletForAccount(idx).connect(provider);
  }
  // NonceManager tracks nonces locally so back-to-back sends in one command
  // (e.g. investor-setup) don't race the RPC's pending-count view.
  return new NonceManager(base);
}

// Contract factory helpers. Write-path contracts fold in ERRORS_ABI so ethers
// auto-decodes the named custom errors on a reverted call.
export function router(a: Artifact, runner: any): Contract {
  return new Contract(a.router, [...ROUTER_ABI, ...ERRORS_ABI], runner);
}
export function elementRegistry(a: Artifact, runner: any): Contract {
  return new Contract(a.elementReg, ELEMENT_REGISTRY_ABI, runner);
}
export function recipeRegistry(a: Artifact, runner: any): Contract {
  return new Contract(a.recipeReg, RECIPE_REGISTRY_ABI, runner);
}
export function engine(a: Artifact, runner: any): Contract {
  return new Contract(a.engine, [...ENGINE_ABI, ...ERRORS_ABI], runner);
}
export function policyRegistry(a: Artifact, runner: any): Contract {
  return new Contract(a.policyReg, [...TOKEN_POLICY_REGISTRY_ABI, ...ERRORS_ABI], runner);
}
export function factory(a: Artifact, runner: any): Contract {
  return new Contract(a.factory, [...FACTORY_ABI, ...ERRORS_ABI], runner);
}
export function venueRegistry(a: Artifact, runner: any): Contract {
  return new Contract(a.venueReg, VENUE_REGISTRY_ABI, runner);
}
export function rfqAdapter(a: Artifact, runner: any): Contract {
  return new Contract(a.rfqAdapter, [...RFQ_ADAPTER_ABI, ...ERRORS_ABI], runner);
}
export function erc20(address: string, runner: any): Contract {
  return new Contract(address, ERC20_ABI, runner);
}
