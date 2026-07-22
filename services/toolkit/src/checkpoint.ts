import {createHash} from "crypto";
import {readFileSync, writeFileSync} from "fs";
import {ToolkitConfig, validateConfig} from "./config";

export interface DeploymentCheckpoint {
  schemaVersion: 1;
  deploymentId: string;
  network: string;
  configHash: string;
  artifactHash: string;
  assetProfile: string;
  state: "preflighted" | "deployed" | "handed-off";
  createdAt: string;
}

export function createCheckpoint(config: ToolkitConfig, artifact: Record<string, unknown>, deploymentId: string): DeploymentCheckpoint {
  const selected = validateConfig(config);
  if (!deploymentId || /[^a-zA-Z0-9_.-]/.test(deploymentId)) throw new Error("deploymentId contains unsupported characters");
  if (artifact.assetProfile !== selected.asset.profile) throw new Error("checkpoint profile does not match artifact");
  return {
    schemaVersion: 1,
    deploymentId,
    network: selected.deployment.network,
    configHash: hash(selected),
    artifactHash: hash(artifact),
    assetProfile: selected.asset.profile,
    state: "preflighted",
    createdAt: new Date().toISOString()
  };
}

export function writeCheckpoint(path: string, checkpoint: DeploymentCheckpoint): void {
  writeFileSync(path, `${JSON.stringify(checkpoint, null, 2)}\n`, {flag: "wx"});
}

export function loadCheckpoint(path: string): DeploymentCheckpoint {
  const value = JSON.parse(readFileSync(path, "utf8")) as DeploymentCheckpoint;
  if (value.schemaVersion !== 1 || value.state !== "preflighted" && value.state !== "deployed" && value.state !== "handed-off") {
    throw new Error("invalid deployment checkpoint");
  }
  return value;
}

function hash(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex")}`;
}
