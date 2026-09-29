import {ToolkitConfig, validateConfig} from "./config";

export interface PreflightCheck {
  name: string;
  pass: boolean;
  detail: string;
  expected: string;
  actual: string;
  remediation: string;
}

export interface PreflightResult {
  ready: boolean;
  checks: PreflightCheck[];
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function preflightConfig(config: ToolkitConfig, artifact: Record<string, unknown>): PreflightResult {
  const selected = validateConfig(config);
  const checks: PreflightCheck[] = [];
  const check = (name: string, pass: boolean, expected: string, actual: unknown, remediation: string) => {
    const actualText = String(actual);
    checks.push({
      name,
      pass,
      detail: `expected=${expected}, actual=${actualText}`,
      expected,
      actual: actualText,
      remediation: pass ? "No action required." : remediation
    });
  };

  check(
    "artifact-profile",
    artifact.assetProfile === selected.asset.profile,
    selected.asset.profile,
    artifact.assetProfile,
    "Deploy or select an artifact created from the same asset profile."
  );
  check("artifact-token", isAddress(artifact.rwaToken), "non-zero deployed address", artifact.rwaToken, "Regenerate the deployment artifact with rwaToken.");
  check("artifact-router", isAddress(artifact.router), "non-zero deployed address", artifact.router, "Regenerate the deployment artifact with router.");
  if (selected.venues.amm) {
    check("amm-adapter", isAddress(artifact.ammAdapter), "non-zero deployed address", artifact.ammAdapter, "Deploy the configured AMM adapter and regenerate the artifact.");
    check("amm-pool", isAddress(artifact.pool), "non-zero deployed address", artifact.pool, "Deploy or bind the configured AMM pool and regenerate the artifact.");
  }
  if (selected.venues.rfq) {
    check("rfq-adapter", isAddress(artifact.rfqAdapter), "non-zero deployed address", artifact.rfqAdapter, "Deploy the configured RFQ adapter and regenerate the artifact.");
    check("maker-authorizer", isAddress(artifact.makerAuthorizer), "non-zero deployed address", artifact.makerAuthorizer, "Deploy the maker authorizer and regenerate the artifact.");
    check("rfq-venue", isAddress(artifact.rfqVenue), "non-zero deployed address", artifact.rfqVenue, "Register the RFQ venue and regenerate the artifact.");
  }
  return {ready: checks.every((item) => item.pass), checks};
}

function isAddress(value: unknown): boolean {
  return typeof value === "string" && ADDRESS.test(value) && !/^0x0{40}$/i.test(value);
}
