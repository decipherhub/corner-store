import {execFileSync} from "child_process";
import {createHash} from "crypto";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, rmSync, writeFileSync
} from "fs";
import {homedir, tmpdir} from "os";
import {delimiter, dirname, isAbsolute, join, relative, resolve} from "path";
import {ProductionConfig, productionConfigHash, validateProductionConfig} from "./production";

export const PRODUCTION_EVIDENCE_VERSION = 2;
const ENTRY = "script/DeployProductionCore.s.sol:DeployProductionCore";
const SOURCE_BUNDLE = "production-source.json";
const BUILD_TOOLS = "production-build-tools.json";
const MAX_BUFFER = 128 * 1024 * 1024;

type JsonObject = Record<string, any>;
export interface ProductionManifestEntry {path: string; sha256: string; size: number}
export interface ProductionProvenance {
  state: "clean" | "dirty" | "source-only" | "unavailable";
  head: string | null;
  changesHash: string | null;
  submodulesHash: string | null;
}
export interface ProductionTool {version: string; sha256: string}
export interface ProductionSource {
  schemaVersion: 2;
  manifest: ProductionManifestEntry[];
  sourceHash: string;
  standardJsonInput: JsonObject & {language: string; sources: Record<string, {content: string}>; settings: JsonObject};
  profile: "default";
  compilerVersion: string;
  compilerPaths: {basePath: string; allowPaths: string[]; includePaths: string[]};
  orchestrationTools: {typescript: ProductionTool};
  provenance: ProductionProvenance;
}
export interface ProductionBuild {
  buildHash: string;
  tools: {forge: ProductionTool; solc: ProductionTool; node: ProductionTool; typescript: ProductionTool};
  dependencies: Record<string, string>;
  execution: Record<string, string>;
  standardJsonInput: ProductionSource["standardJsonInput"];
  profile: "default";
  compilerPaths: ProductionSource["compilerPaths"];
  contracts: Record<string, {
    creationHash: string; runtimeHash: string;
    linkReferences: JsonObject; runtimeLinkReferences: JsonObject; immutableReferences: JsonObject;
  }>;
}
export interface ProductionIdentity {
  schemaVersion: 2;
  sourceHash: string;
  buildHash: string;
  provenance: ProductionProvenance;
  configHash: string;
  deploymentId: string;
  chainId: number;
  wiring: {deployer: string; governance: string; operator: string; amm: boolean; rfq: boolean};
  evidenceId: string;
}
export interface ProductionRecord {
  schemaVersion: 2;
  evidenceId: string;
  identity: ProductionIdentity;
  artifact: Record<string, unknown>;
  artifactDigest: string;
  transactions: unknown[];
  receipts: unknown[];
  recordDigest: string;
  source: ProductionSource;
  build: ProductionBuild;
}

export function canonicalProductionJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value) && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalProductionJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalProductionJson((value as JsonObject)[key])}`).join(",")}}`;
  }
  throw new Error("non-canonical production evidence value");
}

export function productionDigest(domain: string, value: unknown): string {
  return `sha256:${createHash("sha256").update(`corner-store/production/${domain}/v2\0`).update(canonicalProductionJson(value)).digest("hex")}`;
}
function bytesHash(bytes: Buffer | string): string { return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }

export function sanitizedProductionEnv(home: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    PATH: inherited.PATH,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local/share"),
    FOUNDRY_HOME: join(home, ".foundry"),
    FOUNDRY_PROFILE: "default",
    FOUNDRY_AUTO_DETECT_REMAPPINGS: "false",
    FOUNDRY_OFFLINE: "true",
    FOUNDRY_FFI: "false",
    LC_ALL: "C",
    NO_COLOR: "1"
  };
}

export function readProductionProvenance(root: string): ProductionProvenance {
  const empty = {head: null, changesHash: null, submodulesHash: null};
  if (!existsSync(join(root, ".git"))) return {state: "source-only", ...empty};
  try {
    const env: NodeJS.ProcessEnv = {PATH: process.env.PATH, HOME: homedir(), LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0"};
    const git = (args: string[]) => execFileSync("git", ["-C", root, ...args], {env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: MAX_BUFFER});
    if (realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) !== realpathSync(root)) return {state: "unavailable", ...empty};
    const head = git(["rev-parse", "HEAD"]).trim();
    if (!/^[0-9a-f]{40}$/.test(head)) throw new Error("invalid HEAD");
    const status = git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"]);
    const submodules = git(["submodule", "status", "--recursive"]);
    const dirty = status.length !== 0 || submodules.split("\n").some((line) => line && !line.startsWith(" "));
    const changes = [status, git(["diff", "--binary", "--no-ext-diff", "--no-textconv", "HEAD", "--"])];
    for (const file of git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort()) {
      changes.push(file, bytesHash(readInput(root, file)));
    }
    return {state: dirty ? "dirty" : "clean", head, changesHash: productionDigest("git-changes", changes), submodulesHash: productionDigest("git-submodules", submodules)};
  } catch {
    return {state: "unavailable", ...empty};
  }
}

function inputPath(path: string): string {
  if (!path || isAbsolute(path) || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`production input escapes bundle or has a non-normalized path: ${path}`);
  }
  return path;
}
function readInput(root: string, path: string): Buffer {
  inputPath(path);
  let current = resolve(root);
  for (const segment of path.split("/")) {
    current = join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`production input symlink rejected: ${path}`);
  }
  if (!lstatSync(current).isFile()) throw new Error(`production input is not a file: ${path}`);
  return readFileSync(current);
}
function put(root: string, path: string, bytes: Buffer | string): void {
  const target = join(root, inputPath(path));
  let current = resolve(root);
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("production target symlink rejected");
  for (const segment of inputPath(path).split("/")) {
    current = join(current, segment);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`production target symlink rejected: ${path}`); }
    catch (error: any) { if (error.code !== "ENOENT") throw error; }
  }
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, bytes);
}
function walk(root: string, path: string, accept: (path: string) => boolean, visit: (path: string) => void, ignored = [".git", "node_modules", "out", "cache", "broadcast"]): void {
  const absolute = join(root, inputPath(path));
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error(`production input symlink rejected: ${path}`);
  if (stat.isDirectory()) {
    for (const child of readdirSync(absolute).sort()) {
      if (ignored.includes(child)) continue;
      walk(root, `${path}/${child}`, accept, visit, ignored);
    }
  } else if (stat.isFile() && accept(path)) visit(path);
}
function executable(name: string): string {
  if (isAbsolute(name) && existsSync(name)) return realpathSync(name);
  for (const path of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = resolve(path, name);
    if (existsSync(candidate) && lstatSync(realpathSync(candidate)).isFile()) return realpathSync(candidate);
  }
  throw new Error(`production tool unavailable: ${name}`);
}
function normalizeCompilerInput(input: JsonObject, workspace: string): {input: ProductionSource["standardJsonInput"]; compilerPaths: ProductionSource["compilerPaths"]} {
  const path = (value: string) => {
    const normalized = relative(realpathSync(workspace), resolve(value)).split("\\").join("/");
    if (normalized.startsWith("../") || isAbsolute(normalized)) throw new Error("compiler path escapes captured bundle");
    return normalized || ".";
  };
  if (Object.keys(input).some((key) => !["version", "language", "sources", "settings", "basePath", "allowPaths", "includePaths"].includes(key))) throw new Error("unknown production compiler input");
  return {input: {language: input.language, sources: input.sources, settings: input.settings},
    compilerPaths: {basePath: path(input.basePath), allowPaths: input.allowPaths.map(path), includePaths: input.includePaths.map(path)}};
}
function compilerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {...env, FOUNDRY_SRC: ".production-inputs", FOUNDRY_TEST: ".production-inputs", FOUNDRY_SCRIPT: ".production-inputs"};
}
function run(tool: string, args: string[], root: string, env: NodeJS.ProcessEnv): string {
  return execFileSync(tool, args, {cwd: root, env, encoding: "utf8", maxBuffer: MAX_BUFFER, stdio: ["ignore", "pipe", "pipe"]});
}
function moduleRoot(name: string, from?: string): string {
  const paths = [from ?? __dirname, resolve(__dirname, "../../../cli")];
  let entry: string;
  try { entry = require.resolve(`${name}/package.json`, {paths}); }
  catch { entry = require.resolve(name, {paths}); }
  let path = dirname(entry);
  while (dirname(path) !== path) {
    const manifest = join(path, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === name) return path;
    path = dirname(path);
  }
  throw new Error(`production dependency unavailable: ${name}`);
}
function orchestrationTools(root: string): ProductionSource["orchestrationTools"] {
  if (existsSync(join(root, BUILD_TOOLS))) return JSON.parse(readInput(root, BUILD_TOOLS).toString());
  const ts = moduleRoot("typescript");
  const version = JSON.parse(readFileSync(join(ts, "package.json"), "utf8")).version;
  return {typescript: {version, sha256: productionPackageDigest(ts)}};
}
export function productionPackageDigest(root: string): string {
  const files: ProductionManifestEntry[] = [];
  for (const entry of readdirSync(root).sort()) {
    if (entry === "node_modules") continue;
    walk(root, entry, () => true, (path) => {
      const bytes = readInput(root, path);
      files.push({path, size: bytes.length, sha256: bytesHash(bytes)});
    }, ["node_modules"]);
  }
  return productionDigest("dependency", files);
}
function dependencies(): Record<string, string> {
  const result: Record<string, string> = {};
  const visited = new Set<string>();
  const visit = (name: string, from?: string) => {
    const root = moduleRoot(name, from);
    if (visited.has(root)) return;
    visited.add(root);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const key = `${name}@${pkg.version}`;
    const hash = productionPackageDigest(root);
    if (result[key] && result[key] !== hash) throw new Error(`conflicting production dependency copies: ${key}`);
    result[key] = hash;
    for (const dependency of Object.keys(pkg.dependencies ?? {}).sort()) visit(dependency, root);
    for (const dependency of [...new Set([...Object.keys(pkg.optionalDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})])].sort()) {
      if (pkg.dependencies?.[dependency]) continue;
      try { moduleRoot(dependency, root); }
      catch (error: any) {
        if (error.code === "MODULE_NOT_FOUND" && (pkg.optionalDependencies?.[dependency] || pkg.peerDependenciesMeta?.[dependency]?.optional)) continue;
        throw error;
      }
      visit(dependency, root);
    }
  };
  visit("ethers");
  visit("commander");
  return result;
}

export function captureProductionSource(root: string): ProductionSource {
  const workspace = mkdtempSync(join(tmpdir(), "corner-production-capture-"));
  try {
    const env = sanitizedProductionEnv(join(workspace, ".home"));
    const forge = executable("forge");
    for (const path of ["foundry.toml", "remappings.txt"]) put(workspace, path, readInput(root, path));
    for (const path of ["src", "script", "lib"]) {
      if (existsSync(join(root, path))) walk(root, path, (p) => p.endsWith(".sol"), (p) => put(workspace, p, readInput(root, p)));
    }
    const config = JSON.parse(run(forge, ["config", "--root", workspace, "--json"], workspace, env));
    if (!/^\d+\.\d+\.\d+$/.test(config.solc)) throw new Error("production build requires an exact solc version");
    if (config.src !== "src" || config.script !== "script" || config.allow_paths.length || config.include_paths.length || config.additional_compiler_profiles.length || config.compilation_restrictions.length) {
      throw new Error("unsupported production compiler paths or profiles");
    }
    for (const mapping of config.remappings) {
      const target = mapping.slice(mapping.indexOf("=") + 1);
      if (isAbsolute(target) || target.split("/").includes("..") || target.includes("\\")) throw new Error("production remapping escapes captured bundle");
    }
    run(forge, ["build", ENTRY.split(":")[0], "--root", workspace, "--offline", "--ast", "--use", solcExecutable(config.solc),
      "--build-info", "--build-info-path", "build-info"], workspace, compilerEnv(env));
    const infos = readdirSync(join(workspace, "build-info")).filter((path) => path.endsWith(".json"));
    if (infos.length !== 1) throw new Error("production capture requires one compiler input");
    const info = JSON.parse(readFileSync(join(workspace, "build-info", infos[0]), "utf8"));
    if (info.solcVersion !== config.solc || info.input.version !== config.solc) throw new Error("production compiler version mismatch");
    const {input, compilerPaths} = normalizeCompilerInput(info.input, workspace);
    const paths = new Set(["foundry.toml", "remappings.txt"]);
    for (const [path, source] of Object.entries(input.sources)) {
      const bytes = readInput(root, path);
      if (typeof source.content !== "string" || !bytes.equals(Buffer.from(source.content))) throw new Error(`compiler input mismatch: ${path}`);
      paths.add(path);
    }
    if (!paths.has(ENTRY.split(":")[0]) || !paths.has("script/ProductionCoreDeployer.sol")) throw new Error("production compiler input missing deployer");
    for (const service of ["cli", "toolkit", "rfq"]) {
      const base = `services/${service}`;
      for (const path of ["package.json", "package-lock.json", "tsconfig.json"]) { readInput(root, `${base}/${path}`); paths.add(`${base}/${path}`); }
      walk(root, `${base}/src`, () => true, (p) => paths.add(p));
    }
    paths.add("services/cli/scripts/prepare-package.mjs");
    const manifest = [...paths].sort().map((path) => { const bytes = readInput(root, path); return {path, size: bytes.length, sha256: bytesHash(bytes)}; });
    const selected = {schemaVersion: 2 as const, manifest, standardJsonInput: input, profile: "default" as const, compilerVersion: config.solc, compilerPaths, orchestrationTools: orchestrationTools(root)};
    const source: ProductionSource = {...selected, sourceHash: productionDigest("source", selected), provenance: readProductionProvenance(root)};
    if (existsSync(join(root, SOURCE_BUNDLE))) {
      const saved = JSON.parse(readInput(root, SOURCE_BUNDLE).toString()) as ProductionSource;
      verifyProductionManifest(root, saved);
      if (saved.sourceHash !== source.sourceHash) throw new Error("captured production bundle input mismatch");
    }
    return source;
  } finally { rmSync(workspace, {recursive: true, force: true}); }
}

export function verifyProductionManifest(root: string, source: ProductionSource): void {
  if (source.schemaVersion !== 2 || source.profile !== "default" || !Array.isArray(source.manifest) || source.manifest.length === 0) throw new Error("invalid production manifest");
  const seen = new Set<string>();
  for (const entry of source.manifest) {
    if (seen.has(inputPath(entry.path))) throw new Error(`duplicate production manifest path: ${entry.path}`);
    seen.add(entry.path);
    const bytes = readInput(root, entry.path);
    if (bytes.length !== entry.size || bytesHash(bytes) !== entry.sha256) throw new Error(`production manifest mismatch: ${entry.path}`);
  }
  const {sourceHash, provenance, ...input} = source;
  if (productionDigest("source", input) !== sourceHash) throw new Error("production manifest commitment mismatch");
  for (const [path, sourceInput] of Object.entries(source.standardJsonInput.sources)) {
    if (!seen.has(path) || !readInput(root, path).equals(Buffer.from(sourceInput.content))) throw new Error(`compiler manifest input mismatch: ${path}`);
  }
}

export function copyProductionSource(root: string, target: string, source = captureProductionSource(root)): void {
  verifyProductionManifest(root, source);
  for (const entry of source.manifest) put(target, entry.path, readInput(root, entry.path));
  put(target, BUILD_TOOLS, canonicalProductionJson(source.orchestrationTools));
  put(target, SOURCE_BUNDLE, canonicalProductionJson(source));
  verifyProductionManifest(target, source);
}

function solcExecutable(version: string): string {
  const homes = [join(homedir(), ".svm"), join(homedir(), ".local/share/svm"), join(homedir(), "Library/Application Support/svm")];
  for (const home of homes) {
    const path = join(home, version, `solc-${version}`);
    if (existsSync(path)) return realpathSync(path);
  }
  const system = executable("solc");
  if (!execFileSync(system, ["--version"], {encoding: "utf8"}).includes(`Version: ${version}+`)) throw new Error(`exact solc ${version} unavailable; install it before production evidence generation`);
  return system;
}
function toolIdentity(path: string, root: string, env: NodeJS.ProcessEnv): ProductionTool {
  return {version: run(path, ["--version"], root, env).trim(), sha256: bytesHash(readFileSync(path))};
}

export function createProductionIdentity(source: ProductionSource, build: ProductionBuild, config: ProductionConfig): ProductionIdentity {
  const c = validateProductionConfig(config);
  if (c.release.contractsHash !== source.sourceHash || (source.provenance.head !== null && c.release.sourceCommit !== source.provenance.head)) throw new Error("production source/config release mismatch");
  const value = {schemaVersion: 2 as const, sourceHash: source.sourceHash, buildHash: build.buildHash, provenance: source.provenance,
    configHash: productionConfigHash(c), deploymentId: c.deploymentId, chainId: c.network.chainId,
    wiring: {deployer: c.deployer, governance: c.safe.address, operator: c.operator, amm: c.venues.amm, rfq: c.venues.rfq}};
  return {...value, evidenceId: productionDigest("identity", value)};
}

export function validateProductionIdentity(identity: ProductionIdentity, config?: ProductionConfig): void {
  const hash = /^sha256:[0-9a-f]{64}$/;
  if (!identity || typeof identity !== "object" || !identity.provenance ||
    ![identity.sourceHash, identity.buildHash, identity.configHash, identity.evidenceId].every((value) => typeof value === "string" && hash.test(value)) ||
    !["clean", "dirty", "source-only", "unavailable"].includes(identity.provenance.state)) throw new Error("invalid production identity");
  const gitBacked = identity.provenance.state === "clean" || identity.provenance.state === "dirty";
  if (gitBacked ? !/^[0-9a-f]{40}$/.test(identity.provenance.head ?? "") ||
    !hash.test(identity.provenance.changesHash ?? "") || !hash.test(identity.provenance.submodulesHash ?? "") :
    identity.provenance.head !== null || identity.provenance.changesHash !== null || identity.provenance.submodulesHash !== null) throw new Error("invalid production Git provenance");
  const {evidenceId, ...value} = identity;
  if (identity.schemaVersion !== 2 || evidenceId !== productionDigest("identity", value)) throw new Error("production evidence identity mismatch");
  if (config) {
    const c = validateProductionConfig(config);
    if (identity.configHash !== productionConfigHash(c) || identity.sourceHash !== c.release.contractsHash ||
      identity.chainId !== c.network.chainId || identity.deploymentId !== c.deploymentId ||
      (identity.provenance.head !== null && identity.provenance.head !== c.release.sourceCommit) ||
      canonicalProductionJson(identity.wiring) !== canonicalProductionJson({deployer: c.deployer, governance: c.safe.address, operator: c.operator, amm: c.venues.amm, rfq: c.venues.rfq})) throw new Error("production evidence config identity mismatch");
  }
}

export function assertProductionBroadcastIdentity(identity: ProductionIdentity, config: ProductionConfig): void {
  validateProductionIdentity(identity, config);
  if (identity.provenance.state !== "clean" || identity.provenance.head !== config.release.sourceCommit) throw new Error("production broadcast requires clean Git provenance at the reviewed commit");
}

function executionInputs(): Record<string, string> {
  const result: Record<string, string> = {};
  const cli = existsSync(resolve(__dirname, "../../cli/src/commands.js"))
    ? resolve(__dirname, "../../cli/src") : resolve(__dirname, "../../../cli/dist/cli/src");
  const rfq = existsSync(resolve(__dirname, "../../rfq/src/index.js"))
    ? resolve(__dirname, "../../rfq/src") : resolve(__dirname, "../../../cli/dist/rfq/src");
  for (const [name, root] of [["toolkit", __dirname], ["cli", cli], ["rfq", rfq]]) {
    if (!existsSync(root)) continue;
    for (const child of readdirSync(root).sort()) {
      walk(root, child, (path) => path.endsWith(".js"), (path) => { result[`${name}/${path}`] = bytesHash(readInput(root, path)); });
    }
  }
  return result;
}

export function buildProductionIdentity(root: string, config: ProductionConfig, options: {keepWorkspace?: boolean; workspaceParent?: string} = {}) {
  const source = captureProductionSource(root);
  const workspace = mkdtempSync(join(options.workspaceParent ?? tmpdir(), "corner-production-build-"));
  const dispose = () => rmSync(workspace, {recursive: true, force: true});
  try {
    copyProductionSource(root, workspace, source);
    const env = sanitizedProductionEnv(join(workspace, ".home"));
    const forgePath = executable("forge");
    const solcPath = solcExecutable(source.compilerVersion);
    const tools = {forge: toolIdentity(forgePath, workspace, env), solc: toolIdentity(solcPath, workspace, env),
      node: {version: process.version, sha256: bytesHash(readFileSync(process.execPath))}, typescript: source.orchestrationTools.typescript};
    const runtimeDependencies = dependencies();
    run(forgePath, ["build", ENTRY.split(":")[0], "--root", workspace, "--offline", "--ast", "--use", solcPath, "--build-info", "--build-info-path", "build-info"], workspace, compilerEnv(env));
    const infos = readdirSync(join(workspace, "build-info")).filter((path) => path.endsWith(".json"));
    if (infos.length !== 1) throw new Error("production build requires one compiler input");
    const info = JSON.parse(readFileSync(join(workspace, "build-info", infos[0]), "utf8"));
    if (info.input.version !== source.compilerVersion) throw new Error("production compiler version mismatch");
    const normalized = normalizeCompilerInput(info.input, workspace);
    info.input = normalized.input;
    if (info.solcVersion !== source.compilerVersion || canonicalProductionJson(normalized.compilerPaths) !== canonicalProductionJson(source.compilerPaths) ||
      canonicalProductionJson(info.input) !== canonicalProductionJson(source.standardJsonInput)) throw new Error("isolated compiler Standard JSON input mismatch");
    const contracts: ProductionBuild["contracts"] = {};
    for (const file of Object.keys(info.output.contracts).sort()) {
      for (const name of Object.keys(info.output.contracts[file]).sort()) {
        const evm = info.output.contracts[file][name].evm;
        contracts[`${file}:${name}`] = {creationHash: bytesHash(evm.bytecode.object), runtimeHash: bytesHash(evm.deployedBytecode.object),
          linkReferences: evm.bytecode.linkReferences, runtimeLinkReferences: evm.deployedBytecode.linkReferences, immutableReferences: evm.deployedBytecode.immutableReferences ?? {}};
      }
    }
    const value = {tools, dependencies: runtimeDependencies, execution: executionInputs(), standardJsonInput: info.input, profile: source.profile, compilerPaths: normalized.compilerPaths, contracts};
    const build: ProductionBuild = {...value, buildHash: productionDigest("build", value)};
    const identity = createProductionIdentity(source, build, config);
    verifyProductionManifest(workspace, source);
    verifyProductionManifest(root, source);
    if (canonicalProductionJson(readProductionProvenance(root)) !== canonicalProductionJson(source.provenance)) throw new Error("production Git provenance changed during build");
    const result = {source, build, identity, compilerOutput: info.output as JsonObject, workspace, forgePath, solcPath, env: compilerEnv(env), dispose};
    if (!options.keepWorkspace) dispose();
    return result;
  } catch (error) { dispose(); throw error; }
}

export function bindProductionRecord(identity: ProductionIdentity, artifact: Record<string, unknown>, transactions: unknown[], receipts: unknown[], commitments: {source: ProductionSource; build: ProductionBuild}): ProductionRecord {
  validateProductionIdentity(identity);
  const value = {schemaVersion: 2 as const, evidenceId: identity.evidenceId, identity, artifact, artifactDigest: productionDigest("artifact", artifact), transactions, receipts, ...commitments};
  const record = {...value, recordDigest: productionDigest("record", value)};
  verifyProductionRecord(record, identity.evidenceId);
  return record;
}
export function verifyProductionRecord(record: ProductionRecord, expectedEvidenceId: string): void {
  validateProductionIdentity(record.identity);
  if (!record.source || !record.build) throw new Error("production record source and build commitments are required");
  if (record.source.sourceHash !== record.identity.sourceHash ||
    productionDigest("source", (({sourceHash, provenance, ...value}) => value)(record.source)) !== record.source.sourceHash || canonicalProductionJson(record.source.provenance) !== canonicalProductionJson(record.identity.provenance)) throw new Error("production record source commitment mismatch");
  if (record.build.buildHash !== record.identity.buildHash ||
    productionDigest("build", (({buildHash, ...value}) => value)(record.build)) !== record.build.buildHash) throw new Error("production record build commitment mismatch");
  const {recordDigest, ...value} = record;
  if (record.schemaVersion !== 2 || record.evidenceId !== expectedEvidenceId || record.identity.evidenceId !== expectedEvidenceId ||
    record.artifactDigest !== productionDigest("artifact", record.artifact) || recordDigest !== productionDigest("record", value) ||
    !Array.isArray(record.transactions) || !Array.isArray(record.receipts)) throw new Error("production record commitment mismatch");
}
