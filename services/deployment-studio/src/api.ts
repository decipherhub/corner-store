import {spawn} from "child_process";
import {createHash, randomBytes, timingSafeEqual} from "crypto";
import {EventEmitter} from "events";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync
} from "fs";
import {createServer, IncomingMessage, Server, ServerResponse} from "http";
import {extname, relative, resolve, sep} from "path";

import {
  RFQIntegrationMode,
  ProductionConfig,
  ToolkitConfig,
  loadConfig,
  validateConfig,
  validateIntegrationManifest,
  validateProductionConfig as validateToolkitProductionConfig
} from "@corner-store/toolkit";

export type CommandAction =
  | "create"
  | "doctor"
  | "plan"
  | "deploy"
  | "verify"
  | "production-preflight"
  | "production-plan";

export interface CommandRequest {
  action: CommandAction;
  projectRoot: string;
  rpcUrl?: string;
  mode?: RFQIntegrationMode;
  docker?: boolean;
  productionConfigPath?: string;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface StudioCommandRunner {
  run(input: CommandRequest, onLine?: (line: string) => void): Promise<CommandResult>;
}

export interface StudioServerOptions {
  workspaceRoot: string;
  runner: StudioCommandRunner;
  webRoot: string;
  operationsUrl: string;
  defaultRpcUrl: string;
  broadcastNetwork: string;
  allowedRpcHosts: string[];
  sessionToken?: string;
}

export interface ProjectSummary {
  name: string;
  root: string;
  configured: boolean;
  artifact: boolean;
}

const DEMO_BROADCAST_NETWORKS = new Set(["anvil"]);
const PRODUCTION_CONFIG_FILE = "corner-store.production.json";

interface DeployJob {
  id: string;
  project: string;
  status: "queued" | "running" | "succeeded" | "failed";
  logs: string[];
  result?: unknown;
  error?: string;
  emitter: EventEmitter;
}

interface ProjectEvidence {
  doctorFingerprint?: string;
  plan?: {fingerprint: string; rpcUrl: string};
}

const PROJECT_NAME = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const JSON_LIMIT = 1024 * 1024;
const ACTIVATION_KEYS = [
  "makerApproved",
  "signerAuthorized",
  "inventoryReady",
  "smokeSettlement",
  "governanceHandoff"
] as const;
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

export class NodeCliRunner implements StudioCommandRunner {
  constructor(
    private readonly cliEntry: string,
    private readonly defaultRpcUrl: string
  ) {}

  run(input: CommandRequest, onLine?: (line: string) => void): Promise<CommandResult> {
    if (!existsSync(this.cliEntry)) {
      return Promise.resolve({
        code: 1,
        stdout: "",
        stderr: `Corner Store CLI build not found: ${this.cliEntry}`
      });
    }
    const args = this.args(input);
    return new Promise((done) => {
      const child = spawn(process.execPath, [this.cliEntry, ...args], {
        cwd: input.action === "create" ? resolve(input.projectRoot, "..") : input.projectRoot,
        env: {...process.env},
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      const collect = (kind: "stdout" | "stderr", chunk: Buffer) => {
        const text = chunk.toString();
        if (kind === "stdout") stdout += text;
        else stderr += text;
        for (const line of text.split(/\r?\n/).filter(Boolean)) onLine?.(line);
      };
      child.stdout.on("data", (chunk) => collect("stdout", chunk));
      child.stderr.on("data", (chunk) => collect("stderr", chunk));
      child.on("error", (error) => done({code: 1, stdout, stderr: `${stderr}${error.message}`}));
      child.on("close", (code) => done({code: code ?? 1, stdout, stderr}));
    });
  }

  private args(input: CommandRequest): string[] {
    if (input.action === "create") {
      const args = ["create", input.projectRoot, "--mode", input.mode ?? "library-only"];
      if (input.docker) args.push("--docker");
      return args;
    }
    if (input.action === "doctor") return ["doctor"];
    if (input.action === "verify") return ["verify"];
    if (input.action === "production-preflight") {
      return ["production-preflight", input.productionConfigPath ?? PRODUCTION_CONFIG_FILE];
    }
    if (input.action === "production-plan") {
      return ["production-plan", input.productionConfigPath ?? PRODUCTION_CONFIG_FILE];
    }
    const args = ["--rpc", input.rpcUrl ?? this.defaultRpcUrl, "deploy"];
    if (input.action === "deploy") args.push("--broadcast");
    return args;
  }
}

class ProjectStore {
  readonly workspaceRoot: string;
  private readonly workspaceRealRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = resolve(workspaceRoot);
    mkdirSync(this.workspaceRoot, {recursive: true});
    if (lstatSync(this.workspaceRoot).isSymbolicLink()) {
      throw new StudioError(400, "path_symlink", "Studio workspace cannot be a symbolic link.");
    }
    this.workspaceRealRoot = realpathSync(this.workspaceRoot);
  }

  list(): ProjectSummary[] {
    return readdirSync(this.workspaceRoot)
      .filter((name) => PROJECT_NAME.test(name))
      .filter((name) => {
        const target = resolve(this.workspaceRoot, name);
        return !lstatSync(target).isSymbolicLink() && statSync(target).isDirectory();
      })
      .map((name) => this.summary(name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  summary(name: string): ProjectSummary {
    const root = this.root(name);
    const configPath = resolve(root, "corner-store.config.json");
    let artifact = false;
    if (existsSync(configPath)) {
      try {
        artifact = existsSync(this.artifactPath(name));
      } catch {
        artifact = false;
      }
    }
    return {name, root, configured: existsSync(configPath), artifact};
  }

  root(name: string): string {
    if (!PROJECT_NAME.test(name)) throw new StudioError(400, "invalid_project_name", "Use 2-64 lowercase letters, numbers, dot, dash or underscore.");
    const target = resolve(this.workspaceRoot, name);
    this.assertSafePath(this.workspaceRoot, target);
    return target;
  }

  snapshot(name: string): Record<string, unknown> {
    const root = this.root(name);
    if (!existsSync(root)) throw new StudioError(404, "project_not_found", `Project ${name} does not exist.`);
    return {
      project: this.summary(name),
      config: this.readJson(root, resolve(root, "corner-store.config.json")),
      integration: this.readJson(root, resolve(root, "corner-store.integration.json")),
      scenario: this.readJson(root, resolve(root, "corner-store.scenario.json")),
      production: this.readJson(root, resolve(root, PRODUCTION_CONFIG_FILE)),
      activation: this.activation(name)
    };
  }

  config(name: string): ToolkitConfig {
    const root = this.root(name);
    const target = resolve(root, "corner-store.config.json");
    this.assertSafePath(root, target);
    return loadConfig(target);
  }

  saveConfig(name: string, value: unknown): ToolkitConfig {
    let config: ToolkitConfig;
    try {
      config = validateConfig(value);
    } catch (error: any) {
      throw new StudioError(400, "invalid_config", error.message);
    }
    const root = this.root(name);
    this.writeJson(root, resolve(root, "corner-store.config.json"), config);
    return config;
  }

  saveIntegration(name: string, value: unknown): unknown {
    let integration: unknown;
    try {
      integration = validateIntegrationManifest(value);
    } catch (error: any) {
      throw new StudioError(400, "invalid_integration", error.message);
    }
    const root = this.root(name);
    this.writeJson(root, resolve(root, "corner-store.integration.json"), integration);
    return integration;
  }

  saveScenario(name: string, value: unknown): unknown {
    if (!value || typeof value !== "object" || (value as {schemaVersion?: unknown}).schemaVersion !== 2) {
      throw new StudioError(400, "invalid_scenario", "Demo scenario schemaVersion must be 2.");
    }
    if (containsSensitiveKey(value)) {
      throw new StudioError(400, "sensitive_scenario_key", "Demo scenario cannot contain secret or private-key fields.");
    }
    const root = this.root(name);
    this.writeJson(root, resolve(root, "corner-store.scenario.json"), value);
    return value;
  }

  productionConfigPath(name: string): string {
    const root = this.root(name);
    const target = resolve(root, PRODUCTION_CONFIG_FILE);
    this.assertSafePath(root, target);
    return target;
  }

  productionConfig(name: string): ProductionConfig {
    const root = this.root(name);
    const target = this.productionConfigPath(name);
    if (!existsSync(target)) {
      throw new StudioError(404, "production_config_missing", "Save the production core config before running preflight.");
    }
    try {
      return validateToolkitProductionConfig(this.readJson(root, target));
    } catch (error: any) {
      throw new StudioError(400, "invalid_production_config", error.message);
    }
  }

  saveProductionConfig(name: string, value: unknown): ProductionConfig {
    let config: ProductionConfig;
    try {
      config = validateToolkitProductionConfig(value);
    } catch (error: any) {
      throw new StudioError(400, "invalid_production_config", error.message);
    }
    const root = this.root(name);
    this.writeJson(root, this.productionConfigPath(name), config);
    return config;
  }

  productionFingerprint(name: string): string {
    const root = this.root(name);
    return this.hashFiles(root, [this.productionConfigPath(name)]);
  }

  artifactPath(name: string): string {
    const root = this.root(name);
    const target = resolve(root, this.config(name).deployment.artifact);
    this.assertSafePath(root, target);
    return target;
  }

  artifact(name: string): unknown {
    const root = this.root(name);
    const target = this.artifactPath(name);
    if (!existsSync(target)) throw new StudioError(404, "artifact_not_found", "Deploy the reference stack before opening its artifact.");
    return this.readJson(root, target);
  }

  activation(name: string, verified = false): Record<string, boolean> {
    const root = this.root(name);
    const target = resolve(root, ".corner-store/activation.json");
    const current = existsSync(target) ? this.readJson(root, target) as Record<string, unknown> : {};
    let artifactVerified = verified;
    if (!artifactVerified && current.artifactVerified === true && typeof current.verificationHash === "string") {
      try {
        artifactVerified = current.verificationHash === this.verificationFingerprint(name);
      } catch {
        artifactVerified = false;
      }
    }
    return {
      artifactVerified,
      makerApproved: current.makerApproved === true,
      signerAuthorized: current.signerAuthorized === true,
      inventoryReady: current.inventoryReady === true,
      smokeSettlement: current.smokeSettlement === true,
      governanceHandoff: current.governanceHandoff === true
    };
  }

  saveActivation(name: string, value: unknown, verified: boolean): Record<string, boolean> {
    if (!value || typeof value !== "object") throw new StudioError(400, "invalid_activation", "Activation state must be an object.");
    const input = value as Record<string, unknown>;
    const output: Record<string, boolean | string> = {artifactVerified: verified};
    for (const key of ACTIVATION_KEYS) output[key] = input[key] === true;
    if (verified) output.verificationHash = this.verificationFingerprint(name);
    const root = this.root(name);
    this.writeJson(root, resolve(root, ".corner-store/activation.json"), output);
    return this.activation(name);
  }

  projectFingerprint(name: string): string {
    const root = this.root(name);
    return this.hashFiles(root, [
      resolve(root, "corner-store.config.json"),
      resolve(root, "corner-store.integration.json"),
      resolve(root, "corner-store.scenario.json")
    ]);
  }

  verificationFingerprint(name: string): string {
    const root = this.root(name);
    return this.hashFiles(root, [
      resolve(root, "corner-store.config.json"),
      resolve(root, "corner-store.integration.json"),
      resolve(root, "corner-store.scenario.json"),
      this.artifactPath(name)
    ]);
  }

  private readJson(root: string, path: string): unknown {
    this.assertSafePath(root, path);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (error: any) {
      throw new StudioError(500, "invalid_project_file", `${path}: ${error.message}`);
    }
  }

  private writeJson(root: string, path: string, value: unknown): void {
    this.assertSafePath(root, path);
    const parent = resolve(path, "..");
    mkdirSync(parent, {recursive: true});
    this.assertSafePath(root, parent);
    this.assertSafePath(root, path);
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  private hashFiles(root: string, paths: string[]): string {
    const digest = createHash("sha256");
    for (const path of paths) {
      this.assertSafePath(root, path);
      if (!existsSync(path) || !statSync(path).isFile()) {
        throw new StudioError(404, "project_file_missing", `Required project file is missing: ${path}`);
      }
      digest.update(path);
      digest.update("\0");
      digest.update(readFileSync(path));
      digest.update("\0");
    }
    return digest.digest("hex");
  }

  private assertWithin(parent: string, child: string): void {
    const base = resolve(parent);
    const target = resolve(child);
    if (target !== base && !target.startsWith(`${base}${sep}`)) {
      throw new StudioError(400, "path_escape", "Project files must stay inside the configured Studio workspace.");
    }
  }

  private assertSafePath(parent: string, child: string): void {
    const base = resolve(parent);
    const target = resolve(child);
    this.assertWithin(base, target);
    if (!existsSync(base)) {
      throw new StudioError(404, "project_not_found", "Project root does not exist.");
    }
    if (lstatSync(base).isSymbolicLink()) {
      throw new StudioError(400, "path_symlink", "Symbolic links are not allowed in Studio project paths.");
    }
    const realBase = realpathSync(base);
    this.assertWithin(this.workspaceRealRoot, realBase);
    let cursor = base;
    for (const segment of relative(base, target).split(sep).filter(Boolean)) {
      cursor = resolve(cursor, segment);
      let metadata;
      try {
        metadata = lstatSync(cursor);
      } catch (error: any) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      if (metadata.isSymbolicLink()) {
        throw new StudioError(400, "path_symlink", "Symbolic links are not allowed in Studio project paths.");
      }
      this.assertWithin(realBase, realpathSync(cursor));
    }
  }
}

class StudioError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function createStudioServer(options: StudioServerOptions): Server {
  const store = new ProjectStore(options.workspaceRoot);
  const jobs = new Map<string, DeployJob>();
  const evidence = new Map<string, ProjectEvidence>();
  const sessionToken = options.sessionToken ?? randomBytes(32).toString("hex");
  let nextJob = 1;

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://studio.invalid");
      const path = url.pathname;
      if (path.startsWith("/api/v1/") && (req.method === "POST" || req.method === "PUT")) {
        assertMutationRequest(req, sessionToken);
      }
      if (req.method === "GET" && path === "/api/v1/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "corner-store-deployment-studio",
          boundary: "local-demo-only",
          workspaceRoot: store.workspaceRoot,
          runtime: {
            defaultRpcUrl: options.defaultRpcUrl,
            broadcastNetwork: options.broadcastNetwork,
            allowedRpcHosts: options.allowedRpcHosts,
            operationsUrl: options.operationsUrl
          }
        });
      }
      if (req.method === "GET" && path === "/api/v1/projects") {
        return sendJson(res, 200, {projects: store.list()});
      }
      if (req.method === "POST" && path === "/api/v1/projects") {
        const body = await readBody(req);
        const name = String(body.name ?? "");
        const mode = parseMode(body.mode);
        const docker = body.docker === true;
        if (docker && mode !== "reference-service") {
          throw new StudioError(400, "docker_mode", "Docker export is available only for reference-service mode.");
        }
        const projectRoot = store.root(name);
        if (existsSync(projectRoot)) throw new StudioError(409, "project_exists", `Project ${name} already exists.`);
        const result = await options.runner.run({action: "create", projectRoot, mode, docker});
        assertCommand(result, "Project creation failed");
        return sendJson(res, 201, store.snapshot(name));
      }

      const project = matchProject(path);
      if (project) {
        const {name, action} = project;
        if (req.method === "GET" && action === "") return sendJson(res, 200, store.snapshot(name));
        if (req.method === "PUT" && action === "config") {
          const output = store.saveConfig(name, await readBody(req));
          invalidateVerification(store, name);
          evidence.delete(name);
          return sendJson(res, 200, output);
        }
        if (req.method === "PUT" && action === "integration") {
          const output = store.saveIntegration(name, await readBody(req));
          invalidateVerification(store, name);
          evidence.delete(name);
          return sendJson(res, 200, output);
        }
        if (req.method === "PUT" && action === "scenario") {
          const output = store.saveScenario(name, await readBody(req));
          invalidateVerification(store, name);
          evidence.delete(name);
          return sendJson(res, 200, output);
        }
        if (req.method === "PUT" && action === "production-config") {
          const output = store.saveProductionConfig(name, await readBody(req));
          evidence.delete(`production:${name}`);
          return sendJson(res, 200, output);
        }
        if (req.method === "POST" && action === "production-preflight") {
          const config = store.productionConfig(name);
          const result = await options.runner.run({
            action: "production-preflight",
            projectRoot: store.root(name),
            productionConfigPath: PRODUCTION_CONFIG_FILE
          });
          assertCommand(result, "Production preflight failed");
          const output = asObject(parseOutput(result.stdout));
          if (output.ready !== true) {
            evidence.delete(`production:${name}`);
            throw new StudioError(
              409,
              "production_preflight_failed",
              "Production preflight did not return ready=true."
            );
          }
          evidence.set(`production:${name}`, {doctorFingerprint: store.productionFingerprint(name)});
          return sendJson(res, 200, {
            ...output,
            ready: true,
            config,
            boundary: productionBoundary()
          });
        }
        if (req.method === "POST" && action === "production-plan") {
          const fingerprint = store.productionFingerprint(name);
          const current = evidence.get(`production:${name}`);
          if (current?.doctorFingerprint !== fingerprint) {
            throw new StudioError(409, "production_preflight_required", "Run production preflight against the current production config before generating a plan.");
          }
          const config = store.productionConfig(name);
          const result = await options.runner.run({
            action: "production-plan",
            projectRoot: store.root(name),
            productionConfigPath: PRODUCTION_CONFIG_FILE
          });
          assertCommand(result, "Production plan failed");
          return sendJson(res, 200, {
            ...asObject(parseOutput(result.stdout)),
            config,
            boundary: productionBoundary(),
            exportName: `${name}-production-plan.json`
          });
        }
        if (req.method === "GET" && action === "artifact") return sendJson(res, 200, store.artifact(name));
        if (req.method === "GET" && action === "activation") return sendJson(res, 200, store.activation(name));
        if (req.method === "PUT" && action === "activation") {
          const activation = store.activation(name);
          return sendJson(res, 200, store.saveActivation(name, await readBody(req), activation.artifactVerified));
        }
        if (req.method === "POST" && action === "doctor") {
          const result = await options.runner.run({action: "doctor", projectRoot: store.root(name)});
          const output = parseStructuredResult(result);
          if (output && typeof output.ready === "boolean") {
            const current = evidence.get(name) ?? {};
            if (output.ready === true) current.doctorFingerprint = store.projectFingerprint(name);
            else {
              delete current.doctorFingerprint;
              delete current.plan;
            }
            evidence.set(name, current);
            return sendJson(res, 200, output);
          }
          assertCommand(result, "Doctor failed");
          return sendJson(res, 200, output ?? {});
        }
        if (req.method === "POST" && action === "deploy/plan") {
          const body = await readBody(req);
          const rpcUrl = parseRpc(body.rpcUrl);
          const fingerprint = store.projectFingerprint(name);
          const current = evidence.get(name);
          if (current?.doctorFingerprint !== fingerprint) {
            throw new StudioError(409, "doctor_required", "Run a passing doctor check against the current project files before generating a deployment plan.");
          }
          const result = await options.runner.run({action: "plan", projectRoot: store.root(name), rpcUrl});
          assertCommand(result, "Deployment dry-run failed");
          current.plan = {fingerprint, rpcUrl};
          evidence.set(name, current);
          return sendJson(res, 200, {
            ...asObject(parseOutput(result.stdout)),
            config: store.config(name),
            artifactPath: store.config(name).deployment.artifact
          });
        }
        if (req.method === "POST" && action === "deploy") {
          const body = await readBody(req);
          const rpcUrl = parseRpc(body.rpcUrl);
          const config = store.config(name);
          if (
            !DEMO_BROADCAST_NETWORKS.has(options.broadcastNetwork) ||
            config.deployment.network !== options.broadcastNetwork ||
            !isAllowedRpc(rpcUrl, options.allowedRpcHosts)
          ) {
            throw new StudioError(
              403,
              "demo_broadcast_only",
              "Direct browser broadcast is restricted to the Anvil demo profile and an operator-allowed RPC host. Export a plan for every other target."
            );
          }
          const fingerprint = store.projectFingerprint(name);
          const current = evidence.get(name);
          if (
            current?.doctorFingerprint !== fingerprint ||
            current.plan?.fingerprint !== fingerprint ||
            current.plan.rpcUrl !== rpcUrl
          ) {
            throw new StudioError(
              409,
              "deployment_precondition",
              "Run doctor and review a dry-run for the current project files and exact RPC before broadcast."
            );
          }
          const id = `deploy-${Date.now()}-${nextJob++}`;
          const job: DeployJob = {id, project: name, status: "queued", logs: [], emitter: new EventEmitter()};
          jobs.set(id, job);
          queueMicrotask(async () => {
            job.status = "running";
            emitJob(job, "Preparing local reference deployment");
            const result = await options.runner.run(
              {action: "deploy", projectRoot: store.root(name), rpcUrl},
              (line) => emitJob(job, line)
            );
            if (result.code === 0) {
              job.status = "succeeded";
              job.result = parseOutput(result.stdout);
              emitJob(job, "Reference deployment completed");
            } else {
              job.status = "failed";
              job.error = result.stderr || result.stdout || "deployment failed";
              emitJob(job, job.error);
            }
            job.emitter.emit("done");
          });
          return sendJson(res, 202, {jobId: id, status: job.status});
        }
        if (req.method === "POST" && action === "verify") {
          const result = await options.runner.run({action: "verify", projectRoot: store.root(name)});
          assertCommand(result, "Artifact verification failed");
          const output = asObject(parseOutput(result.stdout));
          if (output.ready !== true) throw new StudioError(422, "verify_failed", "Artifact checks did not pass.");
          store.saveActivation(name, store.activation(name), true);
          return sendJson(res, 200, output);
        }
        if (req.method === "GET" && action === "handoff") {
          const activation = store.activation(name);
          return sendJson(res, 200, {
            enabled: activation.artifactVerified,
            url: options.operationsUrl,
            reason: activation.artifactVerified ? "artifact verified" : "verify the deployment artifact first"
          });
        }
      }

      const jobMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)(?:\/(events))?$/);
      if (req.method === "GET" && jobMatch) {
        const job = jobs.get(jobMatch[1]);
        if (!job) throw new StudioError(404, "job_not_found", "Deployment job not found.");
        if (jobMatch[2] === "events") return streamJob(req, res, job);
        return sendJson(res, 200, publicJob(job));
      }

      if (req.method === "GET") return serveAsset(res, options.webRoot, path, path === "/" ? sessionToken : undefined);
      return sendJson(res, 404, {error: "not_found"});
    } catch (error: any) {
      if (res.headersSent) return res.destroy(error);
      const known = error instanceof StudioError
        ? error
        : new StudioError(500, "studio_error", error.message ?? "Unknown Studio error");
      return sendJson(res, known.status, {error: known.code, message: known.message});
    }
  });
}

function assertMutationRequest(req: IncomingMessage, sessionToken: string): void {
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new StudioError(415, "json_required", "State-changing Studio requests require application/json.");
  }
  const supplied = String(req.headers["x-corner-store-session"] ?? cookieValue(req, "corner_store_studio_session") ?? "");
  if (!safeTokenEqual(supplied, sessionToken)) {
    throw new StudioError(403, "invalid_session", "A valid local Studio session is required.");
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    if (!host) throw new StudioError(403, "origin_rejected", "Request Host is required.");
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new StudioError(403, "origin_rejected", "Request Origin is invalid.");
    }
    if (originHost !== host) throw new StudioError(403, "origin_rejected", "Cross-origin Studio mutations are rejected.");
  }
}

function cookieValue(req: IncomingMessage, name: string): string | undefined {
  const cookies = String(req.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return undefined;
}

function safeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function invalidateVerification(store: ProjectStore, name: string): void {
  store.saveActivation(name, store.activation(name), false);
}

function matchProject(path: string): {name: string; action: string} | undefined {
  const match = path.match(/^\/api\/v1\/projects\/([^/]+)(?:\/(.*))?$/);
  return match ? {name: decodeURIComponent(match[1]), action: match[2] ?? ""} : undefined;
}

function parseMode(value: unknown): RFQIntegrationMode {
  if (value === "library-only" || value === "reference-service" || value === "existing-backend") return value;
  throw new StudioError(400, "invalid_mode", "Select library-only, reference-service or existing-backend.");
}

function parseRpc(value: unknown): string {
  if (typeof value !== "string") throw new StudioError(400, "invalid_rpc", "RPC URL is required.");
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
    return parsed.href.replace(/\/$/, "");
  } catch {
    throw new StudioError(400, "invalid_rpc", "RPC URL must use http or https.");
  }
}

function isAllowedRpc(value: string, allowedHosts: string[]): boolean {
  const host = new URL(value).hostname;
  return allowedHosts.includes(host);
}

function assertCommand(result: CommandResult, label: string): void {
  if (result.code !== 0) throw new StudioError(422, "command_failed", `${label}: ${result.stderr || result.stdout}`.trim());
}

function parseStructuredResult(result: CommandResult): Record<string, unknown> | undefined {
  if (!result.stdout.trim()) return undefined;
  try {
    return asObject(parseOutput(result.stdout));
  } catch {
    return undefined;
  }
}

function parseOutput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return {output: trimmed};
  }
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {output: value};
}

function productionBoundary(): Record<string, unknown> {
  return {
    browserBroadcast: false,
    browserSigning: false,
    privateKeyFields: false,
    commands: ["production-preflight", "production-plan"]
  };
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /private.?key|secret|mnemonic/i.test(key) || containsSensitiveKey(child)
  );
}

function emitJob(job: DeployJob, line: string): void {
  job.logs.push(line);
  if (job.logs.length > 500) job.logs.shift();
  job.emitter.emit("line", line);
}

function publicJob(job: DeployJob): Record<string, unknown> {
  return {
    id: job.id,
    project: job.project,
    status: job.status,
    logs: [...job.logs],
    result: job.result,
    error: job.error
  };
}

function streamJob(req: IncomingMessage, res: ServerResponse, job: DeployJob): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive"
  });
  for (const line of job.logs) res.write(`data: ${JSON.stringify({line})}\n\n`);
  const onLine = (line: string) => res.write(`data: ${JSON.stringify({line})}\n\n`);
  const onDone = () => {
    res.write(`event: done\ndata: ${JSON.stringify(publicJob(job))}\n\n`);
    res.end();
  };
  job.emitter.on("line", onLine);
  job.emitter.once("done", onDone);
  req.on("close", () => {
    job.emitter.off("line", onLine);
    job.emitter.off("done", onDone);
  });
  if (job.status === "succeeded" || job.status === "failed") onDone();
}

async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > JSON_LIMIT) throw new StudioError(413, "body_too_large", "Request body exceeds 1 MiB.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value;
  } catch {
    throw new StudioError(400, "invalid_json", "Request body must be a JSON object.");
  }
}

function serveAsset(res: ServerResponse, webRoot: string, path: string, sessionToken?: string): void {
  const relative = path === "/" ? "index.html" : path.replace(/^\//, "");
  const root = resolve(webRoot);
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new StudioError(400, "asset_path", "Invalid asset path.");
  if (!existsSync(target) || !statSync(target).isFile()) throw new StudioError(404, "not_found", "Not found.");
  const headers: Record<string, string> = {
    "content-type": MIME[extname(target)] ?? "application/octet-stream",
    "cache-control": "no-store"
  };
  if (sessionToken) {
    headers["set-cookie"] = `corner_store_studio_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/`;
  }
  res.writeHead(200, headers);
  res.end(readFileSync(target));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"});
  res.end(`${JSON.stringify(body)}\n`);
}
