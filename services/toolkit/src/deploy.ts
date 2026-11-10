import {AssetProfile, ToolkitConfig, validateConfig} from "./config";

export interface DeploymentPlan {
  profile: AssetProfile;
  rpcUrl: string;
  command: string;
  broadcast: boolean;
  warnings: string[];
}

export function createDeploymentPlan(config: ToolkitConfig, rpcUrl: string, broadcast = false): DeploymentPlan {
  const selected = validateConfig(config);
  if (!/^https?:\/\//.test(rpcUrl)) throw new Error("rpcUrl must use http(s)");
  const args = [
    "forge", "script", "script/DeployStack.s.sol:DeployStack",
    "--rpc-url", rpcUrl,
    "--offline"
  ];
  if (broadcast) args.push("--broadcast");
  return {
    profile: selected.asset.profile,
    rpcUrl,
    command: `ASSET_PROFILE=${selected.asset.profile} ${args.map(shellQuote).join(" ")}`,
    broadcast,
    warnings: [
      "DeployStack is the existing reference deployment path; it does not replace production orchestrator policy.",
      broadcast ? "broadcast enabled: verify RPC, signer and checkpoint destination before running" : "dry-run only: no transaction will be submitted"
    ]
  };
}

function shellQuote(value: string): string {
  return /^[a-zA-Z0-9_./:-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

export interface ContextDeploymentInput {
  chainId: number;
  engine: string;
  venueRegistry: string;
  selector: string;
  operatorRegistry: string;
  policyRegistry: string;
  makerAuthorizer: string;
  affiliateSource: string;
  amm?: boolean;
}

export function createContextDeploymentPlan(input: ContextDeploymentInput): {
  chainId: number;
  broadcast: false;
  quoteDomainVersion: "3";
  deployments: Array<{contract: string; source: string; constructorArguments: string[]}>;
} {
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error("chainId must be a positive safe integer");
  for (const key of ["engine", "venueRegistry", "selector", "operatorRegistry", "policyRegistry", "makerAuthorizer", "affiliateSource"] as const) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(input[key]) || /^0x0{40}$/i.test(input[key])) throw new Error(`${key} must be a nonzero address`);
  }
  const deployments = [
    {contract: "ExecutionRouterV2", source: "src/execution/ExecutionRouterV2.sol", constructorArguments: [input.engine, input.venueRegistry, input.selector, input.operatorRegistry]},
    {contract: "RFQAdapterV3", source: "src/execution/adapters/rfq/RFQAdapterV3.sol", constructorArguments: [input.makerAuthorizer, input.venueRegistry, input.policyRegistry, input.affiliateSource]}
  ];
  if (input.amm) deployments.push({contract: "UniswapV3Adapter", source: "src/execution/adapters/amm/UniswapV3Adapter.sol", constructorArguments: []});
  return {chainId: input.chainId, broadcast: false, quoteDomainVersion: "3", deployments};
}
