import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {after, test} from "node:test";
import {ProductionPublication, publishProductionBytes} from "../src/production-publication";

const root = mkdtempSync(join(tmpdir(), "corner-publication-test-"));
after(() => rmSync(root, {recursive: true, force: true}));
let counter = 0;
function target(): string { return join(root, `${counter++}.json`); }
const bytes = Buffer.from('{"signed":"exact bytes"}\n');
const validate = (value: Buffer) => assert.deepEqual(value, bytes);

test("exclusive publisher preserves exact imported bytes and refuses existing files and symlinks", () => {
  const output = target();
  publishProductionBytes(output, bytes, validate);
  assert.deepEqual(readFileSync(output), bytes);
  assert.throws(() => publishProductionBytes(output, Buffer.from("replacement"), () => {}), /occupied|exist/i);
  assert.deepEqual(readFileSync(output), bytes);
  for (const destination of [output, join(root, "missing")]) {
    const link = target(); symlinkSync(destination, link);
    assert.throws(() => ProductionPublication.reserve(link), /occupied|symlink|exist/i);
  }
  const folder = join(root, "real"); mkdirSync(folder);
  const link = join(root, "linked"); symlinkSync(folder, link);
  assert.throws(() => ProductionPublication.reserve(join(link, "file.json")), /symlink/);
});

test("destination is reserved before generation and a competing process cannot reserve it", () => {
  const output = target(); const operation = ProductionPublication.reserve(output);
  const module = resolve(__dirname, "../src/production-publication.js");
  const result = spawnSync(process.execPath, ["-e", `require(process.argv[1]).ProductionPublication.reserve(process.argv[2])`, module, output]);
  assert.notEqual(result.status, 0);
  assert(!existsSync(output));
  operation.prepare(bytes, validate); operation.publish(validate);
  assert.deepEqual(readFileSync(output), bytes);
});

test("validation and injected write, file fsync, link and directory fsync failures leave no partial final", () => {
  const invalid = target(); const op = ProductionPublication.reserve(invalid);
  assert.throws(() => op.prepare(bytes, () => { throw Error("verification failed"); }), /verification/);
  assert(!existsSync(invalid));
  for (const boundary of ["write", "file-sync", "before-link", "after-link", "directory-sync"]) {
    const output = target();
    const operation = ProductionPublication.reserve(output, (phase) => { if (phase === boundary) throw Error(`injected ${phase}`); });
    assert.throws(() => { operation.prepare(bytes, validate); operation.publish(validate); }, /injected/);
    if (existsSync(output)) assert.deepEqual(readFileSync(output), bytes);
    else assert(!existsSync(output));
  }
});

test("recovery revalidates before and after linking, rejects a changed final and never replaces it", () => {
  for (const linked of [false, true]) {
    const output = target();
    const operation = ProductionPublication.reserve(output, (phase) => { if (phase === (linked ? "after-link" : "before-link")) throw Error("interrupt"); });
    operation.prepare(bytes, validate);
    assert.throws(() => operation.publish(validate), /interrupt/);
    const recovered = ProductionPublication.resume(operation.directory);
    assert.throws(() => recovered.publish(() => { throw Error("revalidation failed"); }), /revalidation/);
    assert.equal(existsSync(output), linked);
    recovered.publish(validate);
    assert.deepEqual(readFileSync(output), bytes);
    ProductionPublication.resume(operation.directory).publish(validate);
    assert.deepEqual(readFileSync(output), bytes);
  }
  const output = target(); const op = ProductionPublication.reserve(output);
  op.prepare(bytes, validate); writeFileSync(output, "occupied");
  assert.throws(() => op.publish(validate), /occupied|digest|exist/i);
  assert.equal(readFileSync(output, "utf8"), "occupied");
});

test("process termination at publication boundaries yields absent or complete finals and recoverable journals", () => {
  const module = resolve(__dirname, "../src/production-publication.js");
  for (const boundary of ["prepared", "before-link", "after-link", "directory-sync", "cleanup"]) {
    const output = target(); const pointer = `${output}.operation-path`;
    const script = `const fs=require('fs');const {ProductionPublication}=require(process.argv[1]);const op=ProductionPublication.reserve(process.argv[2],p=>{if(p===process.argv[4])process.kill(process.pid,'SIGKILL')});fs.writeFileSync(process.argv[3],op.directory);op.prepare(Buffer.from(process.argv[5]),()=>{});op.publish(()=>{});`;
    const result = spawnSync(process.execPath, ["-e", script, module, output, pointer, boundary, bytes.toString()]);
    assert.equal(result.signal, "SIGKILL");
    if (existsSync(output)) assert.deepEqual(readFileSync(output), bytes);
    const recovered = ProductionPublication.resume(readFileSync(pointer, "utf8"));
    recovered.publish(validate);
    assert.deepEqual(readFileSync(output), bytes);
  }
});

test("simultaneous publishers produce exactly one complete envelope", () => {
  const output = target(); const module = resolve(__dirname, "../src/production-publication.js");
  const script = `const {spawn}=require('child_process');const code="try{require(process.argv[1]).publishProductionBytes(process.argv[2],Buffer.from(process.argv[3]),()=>{});process.exit(0)}catch{process.exit(2)}";Promise.all(Array.from({length:8},(_,i)=>new Promise(r=>{const c=spawn(process.execPath,['-e',code,process.argv[1],process.argv[2],JSON.stringify({publisher:i})]);c.on('exit',r)}))).then(s=>console.log(JSON.stringify(s)))`;
  const statuses = JSON.parse(execFileSync(process.execPath, ["-e", script, module, output], {encoding: "utf8"}));
  assert.equal(statuses.filter((status: number) => status === 0).length, 1);
  const final = JSON.parse(readFileSync(output, "utf8"));
  assert(Number.isInteger(final.publisher));
});

test("real filesystem errors fail closed, including unsupported hard links and ENOSPC after a partial write", () => {
  const fs = require("node:fs");
  for (const kind of ["disk", "file-sync", "directory-sync", "link"]) {
    const output = target(); const operation = ProductionPublication.reserve(output);
    const originalWrite = fs.writeFileSync; const originalSync = fs.fsyncSync; const originalLink = fs.linkSync;
    try {
      if (kind === "disk") fs.writeFileSync = (fd: number, value: Buffer) => { originalWrite(fd, value.subarray(0, 4)); throw Object.assign(Error("disk full"), {code: "ENOSPC"}); };
      if (kind.includes("sync")) fs.fsyncSync = (fd: number) => {
        if (fs.fstatSync(fd).isDirectory() === (kind === "directory-sync")) throw Object.assign(Error("fsync unavailable"), {code: "EIO"});
        return originalSync(fd);
      };
      if (kind === "link") fs.linkSync = () => { throw Object.assign(Error("hard links unsupported"), {code: "ENOTSUP"}); };
      assert.throws(() => { operation.prepare(bytes, validate); operation.publish(validate); });
      assert(!existsSync(output));
    } finally { fs.writeFileSync = originalWrite; fs.fsyncSync = originalSync; fs.linkSync = originalLink; }
  }
  const output = target(); const original = fs.linkSync;
  try {
    fs.linkSync = () => { throw Object.assign(Error("hard links unsupported"), {code: "ENOTSUP"}); };
    assert.throws(() => ProductionPublication.reserve(output), /unsupported/);
    assert(!existsSync(output));
  } finally { fs.linkSync = original; }
});

test("an asynchronous validator cannot silently bypass publication validation", () => {
  const output = target();
  assert.throws(() => publishProductionBytes(output, bytes, async () => {}), /synchronous/);
  assert(!existsSync(output));
  const second = target(); const operation = ProductionPublication.reserve(second);
  operation.prepare(bytes, validate);
  assert.throws(() => operation.publish(async () => {}), /synchronous/);
  assert(!existsSync(second));
});

test("a staged symlink swapped inside linkSync fails closed and removes the created final", () => {
  const fs = require("node:fs"); const original = fs.linkSync;
  const output = target(); const operation = ProductionPublication.reserve(output);
  operation.prepare(bytes, validate);
  const foreign = target(); writeFileSync(foreign, "unvalidated");
  try {
    fs.linkSync = (source: string, destination: string) => {
      if (destination === output) { unlinkSync(source); symlinkSync(foreign, source); }
      return original(source, destination);
    };
    assert.throws(() => operation.publish(validate), /publication.*(identity|inode|changed|mismatch)/i);
    assert.throws(() => lstatSync(output), {code: "ENOENT"});
    assert.equal(readFileSync(foreign, "utf8"), "unvalidated");
  } finally { fs.linkSync = original; }
  assert.throws(() => ProductionPublication.resume(operation.directory).publish(validate));
});

test("a staging parent swapped inside linkSync fails closed with no misleading final", () => {
  const fs = require("node:fs"); const original = fs.linkSync;
  const output = target(); const operation = ProductionPublication.reserve(output);
  operation.prepare(bytes, validate);
  const staged = readdirSync(operation.directory).find((name) => name.startsWith("envelope-"))!;
  const moved = `${operation.directory}.original`;
  try {
    fs.linkSync = (source: string, destination: string) => {
      if (destination === output) {
        renameSync(operation.directory, moved); mkdirSync(operation.directory, {mode: 0o700});
        writeFileSync(join(operation.directory, staged), "unvalidated");
      }
      return original(source, destination);
    };
    assert.throws(() => operation.publish(validate), /publication.*(identity|inode|changed|mismatch)/i);
    assert.throws(() => lstatSync(output), {code: "ENOENT"});
    assert.deepEqual(readFileSync(join(moved, staged)), bytes);
  } finally { fs.linkSync = original; }
});

test("publication rejects staging directories with unsafe mode or ownership before linking", () => {
  const fs = require("node:fs"); const original = fs.lstatSync;
  for (const kind of ["mode", "owner"]) {
    const output = target(); const operation = ProductionPublication.reserve(output);
    assert.equal(lstatSync(operation.directory).mode & 0o777, 0o700);
    operation.prepare(bytes, validate);
    try {
      if (kind === "mode") chmodSync(operation.directory, 0o770);
      else fs.lstatSync = (path: string, ...args: any[]) => {
        const stat = original(path, ...args);
        if (path === operation.directory) stat.uid = (process.getuid?.() ?? 0) + 1;
        return stat;
      };
      assert.throws(() => operation.publish(validate), /publication.*(owner|private|permission|mode)/i);
      assert(!existsSync(output));
      assert.throws(() => ProductionPublication.resume(operation.directory), /publication.*(owner|private|permission|mode)/i);
    } finally { fs.lstatSync = original; chmodSync(operation.directory, 0o700); }
  }
});

test("mismatch cleanup preserves a final entry replaced by another writer", () => {
  const fs = require("node:fs"); const originalLink = fs.linkSync; const originalStat = fs.lstatSync;
  const output = target(); const operation = ProductionPublication.reserve(output);
  operation.prepare(bytes, validate);
  const foreign = target(); writeFileSync(foreign, "unvalidated");
  let linked = false; let observations = 0;
  try {
    fs.linkSync = (source: string, destination: string) => {
      if (destination === output) { unlinkSync(source); symlinkSync(foreign, source); }
      originalLink(source, destination);
      if (destination === output) linked = true;
    };
    fs.lstatSync = (path: string, ...args: any[]) => {
      if (path === output && linked && ++observations === 2) {
        unlinkSync(output); writeFileSync(output, "another writer");
      }
      return originalStat(path, ...args);
    };
    assert.throws(() => operation.publish(validate), /publication.*mismatch/i);
    assert.equal(readFileSync(output, "utf8"), "another writer");
  } finally { fs.linkSync = originalLink; fs.lstatSync = originalStat; }
});
