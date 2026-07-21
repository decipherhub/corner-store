import {ToolkitConfig, validateConfig} from "./config";

export interface PreflightCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface PreflightResult {
  ready: boolean;
  checks: PreflightCheck[];
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function preflightConfig(config: ToolkitConfig, artifact: Record<string, unknown>): PreflightResult {
  const selected = validateConfig(config);
  const checks: PreflightCheck[] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({name, pass, detail});

  check("artifact-profile", artifact.assetProfile === selected.asset.profile, `config=${selected.asset.profile}, artifact=${String(artifact.assetProfile)}`);
  check("artifact-token", isAddress(artifact.rwaToken), "rwaToken is a non-zero address");
  check("artifact-router", isAddress(artifact.router), "router is a non-zero address");
  if (selected.venues.amm) {
    check("amm-adapter", isAddress(artifact.ammAdapter), "AMM adapter is a non-zero address");
    check("amm-pool", isAddress(artifact.pool), "AMM pool is a non-zero address");
  }
  if (selected.venues.rfq) {
    check("rfq-adapter", isAddress(artifact.rfqAdapter), "RFQ adapter is a non-zero address");
    check("rfq-venue", isAddress(artifact.rfqVenue), "RFQ venue is a non-zero address");
  }
  return {ready: checks.every((item) => item.pass), checks};
}

function isAddress(value: unknown): boolean {
  return typeof value === "string" && ADDRESS.test(value) && !/^0x0{40}$/i.test(value);
}
