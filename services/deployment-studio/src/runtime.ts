import {ChildProcess, spawn} from "child_process";
import {closeSync, existsSync, mkdirSync, openSync, readFileSync} from "fs";
import {get} from "http";
import {createServer as createTcpServer} from "net";
import {resolve} from "path";

export interface DexRuntimeRequest {
  project: string;
  projectRoot: string;
  artifactPath: string;
  configPath: string;
  scenarioPath: string;
  rpcUrl: string;
}

export interface DexRuntimeStatus {
  state: "stopped" | "starting" | "running" | "failed";
  project?: string;
  dashboardUrl: string;
  rfqBackendUrl: string;
  operatorApiUrl: string;
  artifactPath?: string;
  rpcUrl?: string;
  error?: string;
}

export interface DexRuntimeManager {
  start(input: DexRuntimeRequest): Promise<DexRuntimeStatus>;
  stop(project?: string): Promise<DexRuntimeStatus>;
  status(): DexRuntimeStatus;
}

export interface NodeDexRuntimeOptions {
  repoRoot: string;
  bindHost: string;
  publicHost: string;
  chainId: number;
  rfqBackendPort: number;
  operatorApiPort: number;
  dashboardPort: number;
}

export class NodeDexRuntimeManager implements DexRuntimeManager {
  private children: ChildProcess[] = [];
  private current: DexRuntimeStatus;

  constructor(private readonly options: NodeDexRuntimeOptions) {
    validateRuntimeOptions(options);
    this.current = this.baseStatus("stopped");
  }

  status(): DexRuntimeStatus {
    if (this.current.state === "running" && this.children.some((child) => child.exitCode !== null)) {
      this.current = {
        ...this.current,
        state: "failed",
        error: "A DEX demo service exited unexpectedly. Stop and restart the handoff."
      };
    }
    return {...this.current};
  }

  async start(input: DexRuntimeRequest): Promise<DexRuntimeStatus> {
    const existing = this.status();
    if (existing.state === "running") {
      if (existing.project === input.project && existing.artifactPath === input.artifactPath) return existing;
      throw new Error(`DEX demo is already running for ${existing.project ?? "another project"}.`);
    }
    await this.stop();
    for (const port of [this.options.rfqBackendPort, this.options.operatorApiPort, this.options.dashboardPort]) {
      await assertPortAvailable(this.options.bindHost, port);
    }
    for (const path of [input.artifactPath, input.configPath, input.scenarioPath]) {
      if (!existsSync(path)) throw new Error(`DEX handoff input is missing: ${path}`);
    }

    this.current = {
      ...this.baseStatus("starting"),
      project: input.project,
      artifactPath: input.artifactPath,
      rpcUrl: input.rpcUrl
    };
    const runtimeDir = resolve(input.projectRoot, ".corner-store/runtime");
    mkdirSync(runtimeDir, {recursive: true});
    const eventsPath = resolve(runtimeDir, "dex-events.json");
    const manifestPath = resolve(input.projectRoot, "deployments/operator-manifest.json");

    try {
      this.children = [
        this.spawnService(
          "rfq-backend",
          resolve(this.options.repoRoot, "services/rfq-demo-backend/dist/rfq-demo-backend/src/index.js"),
          runtimeDir,
          {
            RFQ_DEMO_HOST: this.options.bindHost,
            RFQ_DEMO_PORT: String(this.options.rfqBackendPort),
            RFQ_DEMO_CHAIN_ID: String(this.options.chainId),
            RFQ_DEMO_RPC_URL: input.rpcUrl,
            RFQ_DEMO_ARTIFACT: input.artifactPath,
            RFQ_DEMO_SCENARIO: input.scenarioPath,
            RFQ_DEMO_ENABLE_SETTLEMENT: "1",
            CORNER_STORE_EVENTS: eventsPath
          }
        ),
        this.spawnService(
          "operator-api",
          resolve(this.options.repoRoot, "services/operator-api/dist/src/index.js"),
          runtimeDir,
          {
            HOST: this.options.bindHost,
            PORT: String(this.options.operatorApiPort),
            CORNER_STORE_CONFIG: input.configPath,
            CORNER_STORE_ARTIFACT: input.artifactPath,
            CORNER_STORE_EVENTS: eventsPath,
            ...(existsSync(manifestPath) ? {CORNER_STORE_MANIFEST: manifestPath} : {})
          }
        ),
        this.spawnService(
          "dashboard",
          resolve(this.options.repoRoot, "services/operator-dashboard/server.js"),
          runtimeDir,
          {
            HOST: this.options.bindHost,
            PORT: String(this.options.dashboardPort),
            CORNER_STORE_OPERATOR_API: this.baseStatus("stopped").operatorApiUrl,
            CORNER_STORE_RFQ_BACKEND: this.baseStatus("stopped").rfqBackendUrl
          }
        )
      ];

      await Promise.all([
        waitForHttp(`${this.baseStatus("stopped").rfqBackendUrl}/health`),
        waitForHttp(`${this.baseStatus("stopped").operatorApiUrl}/api/v1/health`),
        waitForHttp(`${this.baseStatus("stopped").dashboardUrl}/health`)
      ]);
      const artifact = JSON.parse(readFileSync(input.artifactPath, "utf8")) as {router?: unknown};
      const liveState = await readJson(`${this.baseStatus("stopped").rfqBackendUrl}/demo/state`) as {
        ready?: unknown;
        deployment?: {router?: unknown};
      };
      if (
        liveState.ready !== true ||
        typeof artifact.router !== "string" ||
        typeof liveState.deployment?.router !== "string" ||
        artifact.router.toLowerCase() !== liveState.deployment.router.toLowerCase()
      ) {
        throw new Error("RFQ backend did not bind to the verified deployment on the current RPC.");
      }
      this.current = {...this.current, state: "running", error: undefined};
      return this.status();
    } catch (error: any) {
      await this.terminateChildren();
      this.current = {...this.current, state: "failed", error: error.message ?? String(error)};
      throw error;
    }
  }

  async stop(project?: string): Promise<DexRuntimeStatus> {
    if (project && this.current.project && project !== this.current.project) {
      throw new Error(`DEX demo belongs to ${this.current.project}, not ${project}.`);
    }
    await this.terminateChildren();
    this.current = this.baseStatus("stopped");
    return this.status();
  }

  private baseStatus(state: DexRuntimeStatus["state"]): DexRuntimeStatus {
    return {
      state,
      dashboardUrl: `http://${this.options.publicHost}:${this.options.dashboardPort}`,
      rfqBackendUrl: `http://${this.options.publicHost}:${this.options.rfqBackendPort}`,
      operatorApiUrl: `http://${this.options.publicHost}:${this.options.operatorApiPort}`
    };
  }

  private spawnService(name: string, entry: string, runtimeDir: string, env: NodeJS.ProcessEnv): ChildProcess {
    if (!existsSync(entry)) throw new Error(`${name} build is missing: ${entry}`);
    const logPath = resolve(runtimeDir, `${name}.log`);
    const logFd = openSync(logPath, "a");
    const child = spawn(process.execPath, [entry], {
      cwd: this.options.repoRoot,
      env: {...process.env, ...env},
      stdio: ["ignore", logFd, logFd]
    });
    closeSync(logFd);
    child.on("error", (error) => {
      this.current = {...this.current, state: "failed", error: `${name}: ${error.message}`};
    });
    return child;
  }

  private async terminateChildren(): Promise<void> {
    const children = this.children;
    this.children = [];
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
    await Promise.all(children.map((child) => waitForExit(child)));
  }
}

function validateRuntimeOptions(options: NodeDexRuntimeOptions): void {
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!loopback.has(options.bindHost) || !loopback.has(options.publicHost)) {
    throw new Error("The unauthenticated Studio DEX runtime must use loopback hosts.");
  }
  const ports = [options.rfqBackendPort, options.operatorApiPort, options.dashboardPort];
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error("DEX runtime ports must be integers from 1024 to 65535.");
    }
  }
  if (new Set(ports).size !== ports.length) throw new Error("DEX runtime ports must be unique.");
  if (!Number.isSafeInteger(options.chainId) || options.chainId < 1) throw new Error("DEX runtime chainId must be positive.");
}

function assertPortAvailable(host: string, port: number): Promise<void> {
  return new Promise((done, reject) => {
    const server = createTcpServer();
    server.once("error", () => reject(new Error(`DEX runtime port ${port} is already in use.`)));
    server.listen(port, host, () => server.close(() => done()));
  });
}

function waitForHttp(url: string, attempts = 50): Promise<void> {
  return new Promise((done, reject) => {
    const tryRequest = (remaining: number) => {
      const request = get(url, (response) => {
        response.resume();
        if ((response.statusCode ?? 500) < 400) return done();
        retry(remaining, `HTTP ${response.statusCode}`);
      });
      request.setTimeout(500, () => request.destroy(new Error("timeout")));
      request.on("error", (error) => retry(remaining, error.message));
    };
    const retry = (remaining: number, detail: string) => {
      if (remaining <= 1) return reject(new Error(`DEX service did not become ready at ${url}: ${detail}`));
      setTimeout(() => tryRequest(remaining - 1), 100);
    };
    tryRequest(attempts);
  });
}

function readJson(url: string): Promise<unknown> {
  return new Promise((done, reject) => {
    const request = get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) return reject(new Error(`HTTP ${response.statusCode} from ${url}`));
        try {
          done(JSON.parse(body));
        } catch (error: any) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    request.setTimeout(2000, () => request.destroy(new Error(`timeout from ${url}`)));
    request.on("error", reject);
  });
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      done();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timeout);
      done();
    });
  });
}
