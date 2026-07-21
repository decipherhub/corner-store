import {readFileSync, writeFileSync} from "fs";

export const TOOLKIT_SCHEMA_VERSION = 1;
export type AssetProfile = "buidl-like" | "reg-d";

export interface ToolkitConfig {
  schemaVersion: number;
  deployment: {artifact: string; network: string};
  asset: {profile: AssetProfile; token?: string};
  venues: {amm: boolean; rfq: boolean; orderBook: boolean};
  accounts: {operator: string; investor: string; maker: string};
}

export interface ToolkitSimulation {
  profile: AssetProfile;
  venues: string[];
  steps: string[];
  warnings: string[];
}

export function defaultConfig(): ToolkitConfig {
  return {
    schemaVersion: TOOLKIT_SCHEMA_VERSION,
    deployment: {artifact: "deployments/anvil-e2e.json", network: "anvil"},
    asset: {profile: "buidl-like"},
    venues: {amm: true, rfq: true, orderBook: false},
    accounts: {operator: "operator", investor: "investor", maker: "maker"}
  };
}

export function validateConfig(value: unknown): ToolkitConfig {
  if (!value || typeof value !== "object") throw new Error("config must be an object");
  const c = value as Partial<ToolkitConfig>;
  if (c.schemaVersion !== TOOLKIT_SCHEMA_VERSION) throw new Error(`schemaVersion must be ${TOOLKIT_SCHEMA_VERSION}`);
  if (!c.deployment || typeof c.deployment.artifact !== "string" || typeof c.deployment.network !== "string") {
    throw new Error("deployment.artifact and deployment.network are required strings");
  }
  if (!c.asset || (c.asset.profile !== "buidl-like" && c.asset.profile !== "reg-d")) {
    throw new Error('asset.profile must be "buidl-like" or "reg-d"');
  }
  if (!c.venues || typeof c.venues.amm !== "boolean" || typeof c.venues.rfq !== "boolean" || typeof c.venues.orderBook !== "boolean") {
    throw new Error("venues.amm, venues.rfq, and venues.orderBook must be booleans");
  }
  if (!c.venues.amm && !c.venues.rfq && !c.venues.orderBook) throw new Error("at least one venue must be enabled");
  if (!c.accounts || ![c.accounts.operator, c.accounts.investor, c.accounts.maker].every((x) => typeof x === "string" && x.length > 0)) {
    throw new Error("accounts.operator, accounts.investor, and accounts.maker are required");
  }
  return c as ToolkitConfig;
}

export function loadConfig(path: string): ToolkitConfig {
  try {
    return validateConfig(JSON.parse(readFileSync(path, "utf8")));
  } catch (err: any) {
    throw new Error(`invalid toolkit config ${path}: ${err.message}`);
  }
}

export function writeDefaultConfig(path: string): void {
  writeFileSync(path, `${JSON.stringify(defaultConfig(), null, 2)}\n`, {flag: "wx"});
}

export function simulateConfig(config: ToolkitConfig, deployedProfile?: string): ToolkitSimulation {
  const selected = validateConfig(config);
  if (deployedProfile !== undefined && deployedProfile !== selected.asset.profile) {
    throw new Error(`asset profile ${selected.asset.profile} conflicts with deployed profile ${deployedProfile}`);
  }
  const venues = [
    selected.venues.amm ? "amm" : undefined,
    selected.venues.rfq ? "rfq" : undefined,
    selected.venues.orderBook ? "order-book" : undefined
  ].filter((v): v is string => v !== undefined);
  return {
    profile: selected.asset.profile,
    venues,
    steps: [
      "load versioned Toolkit config",
      `bind ${selected.asset.profile} asset profile`,
      `prepare ${venues.join(", ")} venue configuration`,
      "verify deployment artifact and on-chain state before mutation",
      "handoff final ownership only after post-deploy checks"
    ],
    warnings: [
      "simulation is read-only; it does not deploy contracts or submit transactions",
      "private keys and signer custody are not part of the Toolkit config"
    ]
  };
}
