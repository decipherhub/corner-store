import {createHash, randomUUID} from "crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync
} from "fs";
import type {Stats} from "fs";
import {basename, dirname, join, parse, resolve} from "path";

export type PublicationBoundary = "write" | "file-sync" | "prepared" | "before-link" | "after-link" | "directory-sync" | "cleanup";
type Validator = (bytes: Buffer) => void;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function validateBytes(validate: Validator, bytes: Buffer): void {
  const result: unknown = validate(bytes);
  if (result !== undefined) {
    if (result && typeof (result as any).then === "function") void Promise.resolve(result).catch(() => {});
    throw new Error("publication validator must be synchronous and return void");
  }
}


function present(path: string): boolean {
  try { lstatSync(path); return true; } catch (error: any) { if (error.code === "ENOENT") return false; throw error; }
}
function safePath(path: string): void {
  let current = parse(path).root;
  for (const part of path.slice(current.length).split("/").filter(Boolean)) {
    current = join(current, part);
    if (process.platform === "darwin" && ["/var", "/tmp"].includes(current) && realpathSync(current) === `/private${current}`) continue;
    if (present(current) && lstatSync(current).isSymbolicLink()) throw new Error(`publication symlink rejected: ${current}`);
  }
}
function syncDirectory(path: string): void {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function privateDirectory(path: string): Stats {
  safePath(path);
  const stat = lstatSync(path);
  if (!stat.isDirectory() || !process.getuid || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0) {
    throw new Error("publication staging directory must be private and owned by the current uid");
  }
  return stat;
}
function sameInode(a: Stats, b: Stats): boolean { return a.dev === b.dev && a.ino === b.ino; }
function durableFile(path: string, bytes: Buffer | string, boundary?: (phase: PublicationBoundary) => void): void {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    boundary?.("write");
    writeFileSync(fd, bytes);
    boundary?.("file-sync");
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

export class ProductionPublication {
  private readonly directoryIdentity: Stats;
  private constructor(
    readonly output: string,
    readonly directory: string,
    private readonly reservation: string,
    private readonly boundary?: (phase: PublicationBoundary) => void
  ) { this.directoryIdentity = privateDirectory(directory); }

  static assertVacant(output: string): void {
    output = resolve(output);
    safePath(output);
    if (present(output)) throw new Error(`production destination occupied: ${output}`);
    if (present(`${output}.reservation`)) throw new Error(`production destination reserved; recover the operation: ${output}`);
  }

  static reserve(output: string, boundary?: (phase: PublicationBoundary) => void): ProductionPublication {
    output = resolve(output);
    ProductionPublication.assertVacant(output);
    mkdirSync(dirname(output), {recursive: true});
    safePath(output);
    const reservation = `${output}.reservation`;
    mkdirSync(reservation, {mode: 0o700});
    const directory = mkdtempSync(join(dirname(output), `.${basename(output)}.stage-`));
    const operation = new ProductionPublication(output, directory, reservation, boundary);
    durableFile(join(directory, "operation.json"), JSON.stringify({schemaVersion: 1, output, directory, reservation}));
    durableFile(join(reservation, "operation.json"), JSON.stringify({directory}));
    // Probe required filesystem semantics before any signing or broadcast.
    const probe = join(directory, "probe");
    durableFile(probe, "probe");
    linkSync(probe, join(directory, "probe-link"));
    syncDirectory(directory);
    unlinkSync(join(directory, "probe-link")); unlinkSync(probe);
    syncDirectory(directory); syncDirectory(reservation); syncDirectory(dirname(output));
    ProductionPublication.assertNoFinal(output);
    return operation;
  }

  static resume(directory: string): ProductionPublication {
    directory = resolve(directory); privateDirectory(directory);
    const saved = JSON.parse(readFileSync(join(directory, "operation.json"), "utf8"));
    if (saved.schemaVersion !== 1 || saved.directory !== directory || resolve(saved.output) !== saved.output ||
      dirname(directory) !== dirname(saved.output) || saved.reservation !== `${saved.output}.reservation`) throw new Error("invalid publication operation");
    safePath(saved.output); safePath(saved.reservation);
    const operation = new ProductionPublication(saved.output, directory, saved.reservation);
    if (!operation.events().some((event) => event.phase === "complete")) operation.assertReservation();
    return operation;
  }

  static assertNoFinal(output: string): void {
    if (present(output)) throw new Error(`production destination occupied: ${output}`);
  }

  private assertReservation(): void {
    this.assertDirectory();
    safePath(this.reservation);
    const saved = JSON.parse(readFileSync(join(this.reservation, "operation.json"), "utf8"));
    if (saved.directory !== this.directory) throw new Error("publication reservation mismatch");
  }

  private assertDirectory(): void {
    if (!sameInode(privateDirectory(this.directory), this.directoryIdentity)) throw new Error("publication staging directory identity changed");
  }

  events(): Array<{phase: string; data: any}> {
    this.assertDirectory();
    return readdirSync(this.directory).filter((name) => /^\d{6}\.json$/.test(name)).sort()
      .map((name) => JSON.parse(readFileSync(join(this.directory, name), "utf8")));
  }

  journal(phase: string, data: unknown = null): void {
    this.assertDirectory();
    const names = readdirSync(this.directory).filter((name) => /^\d{6}\.json$/.test(name)).sort();
    const next = names.length ? Number(names[names.length - 1].slice(0, 6)) + 1 : 0;
    const name = `${String(next).padStart(6, "0")}.json`;
    const pending = join(this.directory, `${name}.${randomUUID()}.pending`);
    durableFile(pending, JSON.stringify({phase, data}));
    linkSync(pending, join(this.directory, name));
    syncDirectory(this.directory); unlinkSync(pending); syncDirectory(this.directory);
  }

  prepare(bytes: Buffer, validate: Validator): void {
    this.assertReservation();
    ProductionPublication.assertNoFinal(this.output);
    validateBytes(validate, bytes);
    const file = `envelope-${randomUUID()}`;
    durableFile(join(this.directory, file), bytes, this.boundary);
    syncDirectory(this.directory);
    this.journal("prepared", {sha256: digest(bytes), file});
    this.boundary?.("prepared");
  }

  preparedBytes(): Buffer {
    const prepared = this.events().find((event) => event.phase === "prepared");
    if (!prepared || !/^envelope-[a-f0-9-]+$/.test(prepared.data.file)) throw new Error("no prepared production envelope");
    const path = join(this.directory, prepared.data.file); safePath(path); safePath(this.output);
    const fd = openSync(present(path) ? path : this.output, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!fstatSync(fd).isFile()) throw new Error("publication envelope must be a regular file");
      const bytes = readFileSync(fd);
      if (digest(bytes) !== prepared.data.sha256) throw new Error("publication envelope digest mismatch");
      return bytes;
    } finally { closeSync(fd); }
  }

  publish(validate: Validator): void {
    const events = this.events();
    const prepared = events.find((event) => event.phase === "prepared");
    if (!prepared) throw new Error("publication has no complete prepared envelope");
    safePath(this.output);
    if (!/^envelope-[a-f0-9-]+$/.test(prepared.data.file)) throw new Error("invalid staged envelope path");
    const staged = join(this.directory, prepared.data.file); safePath(staged);
    const complete = events.some((event) => event.phase === "complete");
    if (!present(staged) && !complete) throw new Error("publication staged envelope missing before completion; recover the original staging directory");
    const fd = openSync(present(staged) ? staged : this.output, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const validated = fstatSync(fd);
      if (!validated.isFile()) throw new Error("publication envelope must be a regular file");
      const bytes = readFileSync(fd);
      if (bytes.length !== validated.size || digest(bytes) !== prepared.data.sha256) throw new Error("publication envelope digest mismatch");
      validateBytes(validate, bytes);
      if (!complete) this.assertReservation();
      if (present(this.output)) {
        const final = lstatSync(this.output);
        // An identical foreign file is still occupied; only our linked inode is recoverable.
        if (!final.isFile() || !sameInode(validated, final) || final.size !== validated.size) throw new Error("production destination occupied by another publisher");
      } else {
        this.assertReservation();
        this.boundary?.("before-link");
        this.assertDirectory(); safePath(this.output);
        linkSync(staged, this.output);
        const created = lstatSync(this.output);
        try {
          if (!created.isFile() || !sameInode(validated, created) || created.size !== validated.size) throw new Error("publication final inode or size mismatch");
          this.assertDirectory(); safePath(this.output);
        } catch (error) {
          // Remove only the entry observed after our successful no-replace link.
          if (present(this.output) && sameInode(created, lstatSync(this.output))) unlinkSync(this.output);
          syncDirectory(dirname(this.output));
          throw error;
        }
        this.boundary?.("after-link");
      }
      this.boundary?.("directory-sync");
      syncDirectory(dirname(this.output));
      if (!complete) this.journal("complete", prepared.data);
      this.boundary?.("cleanup");
      this.assertDirectory();
      if (present(staged)) {
        if (!sameInode(validated, lstatSync(staged))) throw new Error("publication staged inode changed before cleanup");
        unlinkSync(staged);
      }
      syncDirectory(this.directory);
      if (present(this.reservation)) {
        const pointer = join(this.reservation, "operation.json");
        if (present(pointer)) { this.assertReservation(); unlinkSync(pointer); }
        rmdirSync(this.reservation);
      }
      syncDirectory(dirname(this.output));
    } finally { closeSync(fd); }
  }

  cancel(): void {
    if (this.events().some((event) => ["executing", "prepared", "complete"].includes(event.phase))) throw new Error("operation must be recovered without rebroadcasting");
    this.assertReservation();
    this.journal("cancelled");
    unlinkSync(join(this.reservation, "operation.json")); rmdirSync(this.reservation);
    syncDirectory(dirname(this.output));
  }
}

export function publishProductionBytes(output: string, bytes: Buffer, validate: Validator): void {
  const operation = ProductionPublication.reserve(output);
  operation.prepare(bytes, validate);
  operation.publish(validate);
}
