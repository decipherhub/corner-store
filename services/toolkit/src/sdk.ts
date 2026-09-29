import {keccak256, toUtf8Bytes} from "ethers";

import {ToolkitConfig, ToolkitSimulation, simulateConfig, validateConfig} from "./config";
import {PreflightCheck, PreflightResult, preflightConfig} from "./preflight";

export interface CornerStoreConnectionOptions {
  config: unknown;
  artifact?: Record<string, unknown>;
  deployedProfile?: string;
}

export interface CompiledPolicy {
  schemaVersion: 1;
  configHash: string;
  profile: ToolkitConfig["asset"]["profile"];
  venues: string[];
  deployment: ToolkitConfig["deployment"];
  policyValues: {
    governance: ToolkitConfig["governance"];
    accounts: ToolkitConfig["accounts"];
  };
}

export interface PolicyExplanation {
  summary: string;
  values: {
    assetProfile: string;
    venues: string[];
    network: string;
    governanceApprovals: number;
  };
  advanced: {
    model: ["Element", "Recipe", "Manifest", "Operator"];
    deploymentArtifact: string;
    boundary: string;
  };
}

export interface ActionableCheck extends PreflightCheck {}

export interface PolicyVerification extends PreflightResult {
  checks: ActionableCheck[];
}

export class CornerStoreSDKError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly expected: string,
    readonly actual: string,
    readonly remediation: string
  ) {
    super(message);
    this.name = "CornerStoreSDKError";
  }

  toJSON(): Record<string, string> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      expected: this.expected,
      actual: this.actual,
      remediation: this.remediation
    };
  }
}

export interface CornerStoreClient {
  config: ToolkitConfig;
  policy: {
    validate(): ToolkitConfig;
    compile(): CompiledPolicy;
    simulate(): ToolkitSimulation;
    explain(): PolicyExplanation;
    verify(): PolicyVerification;
  };
}

export function connectCornerStore(options: CornerStoreConnectionOptions): CornerStoreClient {
  let config: ToolkitConfig;
  try {
    config = freezeConfig(validateConfig(options.config));
  } catch (error: any) {
    throw new CornerStoreSDKError(
      "INVALID_CONFIG",
      "Corner Store config validation failed",
      "Toolkit schema v1 with one supported asset profile and at least one venue",
      String(error?.message ?? "invalid config"),
      "Fix corner-store.config.json, then rerun policy.validate()."
    );
  }

  const compile = (): CompiledPolicy => {
    const venues = enabledVenues(config);
    const payload = {
      schemaVersion: 1 as const,
      profile: config.asset.profile,
      venues,
      deployment: {...config.deployment},
      policyValues: {
        governance: {...config.governance},
        accounts: {...config.accounts}
      }
    };
    return {...payload, configHash: keccak256(toUtf8Bytes(JSON.stringify(config)))};
  };

  const simulate = (): ToolkitSimulation => {
    try {
      return simulateConfig(config, options.deployedProfile);
    } catch (error: any) {
      throw new CornerStoreSDKError(
        "SIMULATION_MISMATCH",
        "Policy simulation does not match the deployed profile",
        config.asset.profile,
        options.deployedProfile ?? String(error?.message ?? "unknown"),
        "Select the deployed asset profile or deploy a matching config before mutation."
      );
    }
  };

  const explain = (): PolicyExplanation => {
    const venues = enabledVenues(config);
    return {
      summary: `${config.asset.profile} policy across ${venues.join(", ")}`,
      values: {
        assetProfile: config.asset.profile,
        venues,
        network: config.deployment.network,
        governanceApprovals: config.governance.requiredApprovals
      },
      advanced: {
        model: ["Element", "Recipe", "Manifest", "Operator"],
        deploymentArtifact: config.deployment.artifact,
        boundary: "Router-mediated settlement only; token and identity systems remain external trust boundaries."
      }
    };
  };

  const verify = (): PolicyVerification => {
    if (!options.artifact) {
      return {
        ready: false,
        checks: [{
          name: "deployment-artifact",
          pass: false,
          detail: "deployment artifact was not supplied",
          expected: config.deployment.artifact,
          actual: "missing",
          remediation: "Run the dry-run/deployment workflow, then load the generated artifact and call policy.verify() again."
        }]
      };
    }
    const result = preflightConfig(config, options.artifact);
    return {
      ready: result.ready,
      checks: result.checks
    };
  };

  return {
    config: copyConfig(config),
    policy: {
      validate: () => copyConfig(config),
      compile,
      simulate,
      explain,
      verify
    }
  };
}

function copyConfig(config: ToolkitConfig): ToolkitConfig {
  return {
    schemaVersion: config.schemaVersion,
    deployment: {...config.deployment},
    asset: {...config.asset},
    venues: {...config.venues},
    accounts: {...config.accounts},
    governance: {...config.governance}
  };
}

function freezeConfig(config: ToolkitConfig): ToolkitConfig {
  const copy = copyConfig(config);
  Object.freeze(copy.deployment);
  Object.freeze(copy.asset);
  Object.freeze(copy.venues);
  Object.freeze(copy.accounts);
  Object.freeze(copy.governance);
  return Object.freeze(copy);
}

function enabledVenues(config: ToolkitConfig): string[] {
  return [
    config.venues.amm ? "amm" : undefined,
    config.venues.rfq ? "rfq" : undefined,
    config.venues.orderBook ? "order-book" : undefined
  ].filter((value): value is string => value !== undefined);
}
