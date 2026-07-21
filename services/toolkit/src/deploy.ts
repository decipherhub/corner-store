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
