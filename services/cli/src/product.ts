import {cpSync, existsSync, mkdirSync, readFileSync, rmSync} from "fs";
import {spawnSync} from "child_process";
import {dirname, resolve} from "path";

import {assertRFQModuleConformance} from "../../rfq/src";
import {loadConfig} from "../../toolkit/src/config";

export interface DoctorCheck {
  name: string;
  pass: boolean;
  required: boolean;
  detail: string;
}

export interface DoctorResult {
  ready: boolean;
  checks: DoctorCheck[];
}

export const MINIMUM_NODE_MAJOR = 18;

export function isNodeVersionSupported(version: string): boolean {
  const major = Number.parseInt(version.replace(/^v/, "").split(".")[0], 10);
  return Number.isInteger(major) && major >= MINIMUM_NODE_MAJOR;
}

export function resolveContractSource(repoRoot?: string, explicit?: string): string | undefined {
  const candidates = [
    explicit,
    process.env.CORNER_STORE_CONTRACTS_ROOT,
    resolve(process.cwd(), ".corner-store/contracts"),
    resolve(__dirname, "../../../bundle/contracts"),
    repoRoot
  ].filter((value): value is string => Boolean(value));
  return candidates.find(isContractSource);
}

export function prepareDeploymentRuntime(
  projectRoot: string,
  contractSource: string,
  scenarioPath = "corner-store.scenario.json"
): string {
  if (!isContractSource(contractSource)) throw new Error(`invalid Corner Store contract source: ${contractSource}`);
  const runtime = resolve(projectRoot, ".corner-store/runtime/contracts");
  rmSync(runtime, {recursive: true, force: true});
  mkdirSync(runtime, {recursive: true});
  copyRequiredContractSources(contractSource, runtime);

  const scenario = resolve(projectRoot, scenarioPath);
  if (existsSync(scenario)) {
    mkdirSync(resolve(runtime, "deployments"), {recursive: true});
    cpSync(scenario, resolve(runtime, "deployments/anvil-e2e-scenario.json"));
  }
  return runtime;
}

export function copyDeploymentArtifact(runtimeRoot: string, projectRoot: string, artifactPath: string): string {
  const source = resolve(runtimeRoot, "deployments/anvil-e2e.json");
  if (!existsSync(source)) throw new Error(`deployment artifact was not produced: ${source}`);
  const output = resolve(projectRoot, artifactPath);
  mkdirSync(dirname(output), {recursive: true});
  cpSync(source, output);
  return output;
}

export function doctor(
  configPath: string,
  artifactPath: string | undefined,
  repoRoot?: string,
  explicitContracts?: string
): DoctorResult {
  const checks: DoctorCheck[] = [];
  let effectiveArtifactPath = artifactPath;
  const nodeVersion = process.versions.node;
  checks.push({
    name: "node",
    required: true,
    pass: isNodeVersionSupported(nodeVersion),
    detail: isNodeVersionSupported(nodeVersion)
      ? `v${nodeVersion}`
      : `v${nodeVersion}; Node.js ${MINIMUM_NODE_MAJOR}+ is required`
  });

  const executable = (name: string, required: boolean) => {
    const result = spawnSync(name, ["--version"], {encoding: "utf8"});
    checks.push({
      name,
      required,
      pass: result.status === 0,
      detail: result.status === 0
        ? String(result.stdout || result.stderr).trim().split("\n")[0]
        : `${name} is not available`
    });
  };
  executable("npm", true);
  executable("forge", true);

  try {
    const config = loadConfig(resolve(process.cwd(), configPath));
    effectiveArtifactPath ??= config.deployment.artifact;
    checks.push({name: "config", required: true, pass: true, detail: `schema v${config.schemaVersion}, profile=${config.asset.profile}`});
  } catch (error: any) {
    checks.push({name: "config", required: true, pass: false, detail: error.message});
  }

  const contracts = resolveContractSource(repoRoot, explicitContracts);
  checks.push({
    name: "contracts",
    required: true,
    pass: contracts !== undefined,
    detail: contracts ?? "no bundled or configured contract source found"
  });

  if (effectiveArtifactPath) {
    const artifactExists = existsSync(resolve(process.cwd(), effectiveArtifactPath));
    checks.push({
      name: "artifact",
      required: false,
      pass: artifactExists,
      detail: artifactExists ? effectiveArtifactPath : `${effectiveArtifactPath} not created yet`
    });
  }

  const docker = spawnSync("docker", ["--version"], {encoding: "utf8"});
  checks.push({
    name: "docker",
    required: false,
    pass: docker.status === 0,
    detail: docker.status === 0 ? String(docker.stdout || docker.stderr).trim() : "optional; not installed"
  });
  return {ready: checks.every((check) => !check.required || check.pass), checks};
}

export async function testModule(modulePath: string): Promise<unknown> {
  const target = resolve(process.cwd(), modulePath);
  if (!existsSync(target)) throw new Error(`module conformance file not found: ${target}`);
  delete require.cache[require.resolve(target)];
  const loaded = require(target);
  if (!loaded.modules || !loaded.fixture) {
    throw new Error("module conformance file must export modules and fixture");
  }
  await assertRFQModuleConformance(loaded.modules, loaded.fixture);
  return {passed: true, modulePath: target};
}

export function readScenario(path: string): string {
  const target = resolve(path);
  const value = JSON.parse(readFileSync(target, "utf8"));
  if (value.schemaVersion !== 2) throw new Error("scenario schemaVersion must be 2");
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isContractSource(path: string): boolean {
  return existsSync(resolve(path, "foundry.toml")) &&
    existsSync(resolve(path, "src")) &&
    existsSync(resolve(path, "script/DeployStack.s.sol"));
}

function copyRequiredContractSources(source: string, target: string): void {
  for (const path of ["src", "script", "test/fixtures", "test/mocks"]) {
    copyRequiredPath(source, target, path);
  }
  for (const path of [
    "lib/openzeppelin-contracts/contracts",
    "lib/openzeppelin-contracts-upgradeable/contracts",
    "lib/solidity/contracts",
    "lib/ERC-3643/contracts",
    "lib/forge-std/src"
  ]) {
    copyRequiredPath(source, target, path);
  }
  for (const path of ["foundry.toml", "remappings.txt"]) {
    copyRequiredPath(source, target, path);
  }
}

function copyRequiredPath(source: string, target: string, path: string): void {
  const input = resolve(source, path);
  if (!existsSync(input)) throw new Error(`Corner Store contract source missing ${path}: ${source}`);
  const output = resolve(target, path);
  mkdirSync(dirname(output), {recursive: true});
  cpSync(input, output, {recursive: true});
}
