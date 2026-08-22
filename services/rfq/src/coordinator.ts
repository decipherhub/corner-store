declare function require(name: string): any;

import {verifyTypedData} from "ethers";

import {domain, typedData} from "./eip712";
import {
  Address,
  Hex,
  InventoryRiskCheck,
  PricingProvider,
  RFQPriceRequest,
  RFQQuote,
  RFQQuoteIntent,
  RFQTypedData,
  SignedRFQQuote,
  TypedDataSigner
} from "./types";
import {assertHex, normalizeAddress, normalizeChainId, normalizeTtlSeconds, toPositiveUintString} from "./validation";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_CONFIRMATIONS = 12;

export type QuoteLifecycleState =
  | "RECEIVED"
  | "RESERVED"
  | "SIGNED"
  | "PUBLISHED"
  | "FILL_OBSERVED"
  | "CANCEL_OBSERVED"
  | "FILLED"
  | "CANCELLED"
  | "EXPIRED"
  | "SIGN_FAILED"
  | "REVOKED";

export interface QuoteCoordinatorIntent extends RFQQuoteIntent {
  idempotencyKey: string;
}

export interface QuoteInventoryDelta {
  maker: Address;
  token: Address;
  venue: Address;
  amount: string;
}

export interface QuoteObservation {
  kind: "fill" | "cancel";
  transactionHash: Hex;
  blockNumber: number;
  blockHash: Hex;
}

export interface QuoteReconciliation {
  currentBlockNumber: number;
  canonicalBlockHash?: Hex;
  now?: number;
}

export interface QuoteCoordinatorRecord {
  schemaVersion: 1;
  state: QuoteLifecycleState;
  scope: QuoteNonceScope;
  idempotencyKeyHash: string;
  requestHash: string;
  request: PiiFreeQuoteRequest;
  nonce?: string;
  inventoryLease?: InventoryLease;
  quoteHash?: string;
  signedQuote?: SignedRFQQuote;
  createdAt: number;
  updatedAt: number;
  pricingSnapshotId?: string;
  moduleVersions?: Record<string, string>;
  signerKeyRefHash?: string;
  riskDecision: "passed" | "rejected";
  releaseReason?: "sign-failed" | "expired" | "revoke" | "filled" | "cancelled";
  observed?: QuoteObservation;
  terminalAt?: number;
  stateHistory: Array<{state: QuoteLifecycleState; at: number}>;
}

export interface PiiFreeQuoteRequest {
  taker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  venue: Address;
  ttlSeconds: number;
}

export interface QuoteNonceScope {
  chainId: number;
  adapter: Address;
  maker: Address;
}

export interface InventoryLease extends QuoteInventoryDelta {
  leaseId: string;
  expiresAt: number;
  released: boolean;
  releaseReason?: QuoteCoordinatorRecord["releaseReason"];
}

export interface QuoteCoordinatorStore {
  reserveOrReturnExisting(input: ReserveQuoteInput): Promise<ReserveQuoteResult>;
  markSigned(input: MarkSignedInput): Promise<QuoteCoordinatorRecord>;
  markSignFailed(input: MarkSignFailedInput): Promise<QuoteCoordinatorRecord>;
  markObserved(input: MarkObservedInput): Promise<QuoteCoordinatorRecord>;
  reconcile(input: ReconcileInput): Promise<QuoteCoordinatorRecord>;
  expire(input: ExpireInput): Promise<QuoteCoordinatorRecord>;
  revoke(input: RevokeInput): Promise<QuoteCoordinatorRecord>;
  getByIdempotencyKeyHash(scope: QuoteNonceScope, idempotencyKeyHash: string): Promise<QuoteCoordinatorRecord | undefined>;
}

export interface ReserveQuoteInput {
  scope: QuoteNonceScope;
  idempotencyKeyHash: string;
  requestHash: string;
  request: PiiFreeQuoteRequest;
  inventoryDelta: QuoteInventoryDelta;
  reservationExpiresAt: number;
  createdAt: number;
  pricingSnapshotId?: string;
  moduleVersions?: Record<string, string>;
}

export interface ReserveQuoteResult {
  record: QuoteCoordinatorRecord;
  existing: boolean;
}

export interface MarkSignedInput {
  scope: QuoteNonceScope;
  idempotencyKeyHash: string;
  requestHash: string;
  signedQuote: SignedRFQQuote;
  quoteHash: string;
  signerKeyRefHash?: string;
  now: number;
}

export interface MarkSignFailedInput {
  scope: QuoteNonceScope;
  idempotencyKeyHash: string;
  requestHash: string;
  now: number;
  errorRef?: string;
}

export interface MarkObservedInput {
  scope: QuoteNonceScope;
  nonce: string;
  observation: QuoteObservation;
  now: number;
}

export interface ReconcileInput {
  scope: QuoteNonceScope;
  nonce: string;
  currentBlockNumber: number;
  canonicalBlockHash?: Hex;
  now: number;
}

export interface ExpireInput {
  scope: QuoteNonceScope;
  nonce: string;
  now: number;
}

export interface RevokeInput {
  scope: QuoteNonceScope;
  nonce: string;
  now: number;
}

export interface QuoteCoordinatorConfig {
  chainId: number;
  verifyingContract: Address;
  maker: Address;
  signer: TypedDataSigner;
  pricing: PricingProvider;
  riskCheck: InventoryRiskCheck;
  store: QuoteCoordinatorStore;
  defaultTtlSeconds?: number;
  now?: () => number | Promise<number>;
  signerKeyRef?: string;
  moduleVersions?: Record<string, string>;
  confirmationDepth?: number;
  verifySignature?: (typedData: RFQTypedData, signature: Hex, maker: Address) => Promise<void> | void;
}

export class RFQQuoteCoordinator {
  private readonly chainId: number;
  private readonly verifyingContract: Address;
  private readonly maker: Address;
  private readonly defaultTtlSeconds: number;
  private readonly now: () => number | Promise<number>;
  private readonly confirmationDepth: number;

  constructor(private readonly config: QuoteCoordinatorConfig) {
    this.chainId = normalizeChainId(config.chainId);
    this.verifyingContract = normalizeAddress(config.verifyingContract, "verifyingContract");
    this.maker = normalizeAddress(config.maker, "maker");
    this.defaultTtlSeconds = normalizeTtlSeconds(config.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS);
    this.now = config.now ?? (() => Math.floor(Date.now() / 1000));
    this.confirmationDepth = normalizeConfirmations(config.confirmationDepth ?? DEFAULT_CONFIRMATIONS);
  }

  async quote(intent: QuoteCoordinatorIntent): Promise<SignedRFQQuote> {
    const normalized = this.normalizeIntent(intent);
    const now = await this.timestamp();
    const requestHash = hashCanonical(normalized);
    const idempotencyKeyHash = hashSecret(intent.idempotencyKey, "idempotencyKey");
    const scope = this.scope();
    const existing = await this.config.store.getByIdempotencyKeyHash(scope, idempotencyKeyHash);
    if (existing) return this.responseOrResumeExisting(existing, requestHash);

    const priceRequest: RFQPriceRequest = {
      maker: this.maker,
      taker: normalized.taker,
      tokenIn: normalized.tokenIn,
      tokenOut: normalized.tokenOut,
      amountIn: normalized.amountIn,
      venue: normalized.venue
    };
    const priced = await this.config.pricing.price(priceRequest);
    const amountOut = toPositiveUintString(priced.amountOut, "amountOut");
    await this.config.riskCheck.check(priceRequest, {amountOut});

    const reserve = await this.config.store.reserveOrReturnExisting({
      scope,
      idempotencyKeyHash,
      requestHash,
      request: normalized,
      inventoryDelta: {
        maker: this.maker,
        token: normalized.tokenOut,
        venue: normalized.venue,
        amount: amountOut
      },
      reservationExpiresAt: now + normalized.ttlSeconds,
      createdAt: now,
      pricingSnapshotId: pricingSnapshotId(priced),
      moduleVersions: this.config.moduleVersions
    });
    if (reserve.existing) return this.responseOrResumeExisting(reserve.record, requestHash);
    return this.signReservedRecord(reserve.record, requestHash, idempotencyKeyHash);
  }

  async observeSettlement(nonce: string, observation: QuoteObservation): Promise<QuoteCoordinatorRecord> {
    return this.config.store.markObserved({
      scope: this.scope(),
      nonce,
      observation: {
        kind: observation.kind,
        transactionHash: assertBytes32Hex(observation.transactionHash, "transactionHash"),
        blockNumber: normalizeBlockNumber(observation.blockNumber),
        blockHash: assertBytes32Hex(observation.blockHash, "blockHash")
      },
      now: await this.timestamp()
    });
  }

  async reconcile(nonce: string, input: QuoteReconciliation): Promise<QuoteCoordinatorRecord> {
    return this.config.store.reconcile({
      scope: this.scope(),
      nonce,
      currentBlockNumber: normalizeBlockNumber(input.currentBlockNumber),
      canonicalBlockHash: input.canonicalBlockHash ? assertBytes32Hex(input.canonicalBlockHash, "canonicalBlockHash") : undefined,
      now: input.now ?? await this.timestamp()
    });
  }

  async expire(nonce: string): Promise<QuoteCoordinatorRecord> {
    return this.config.store.expire({scope: this.scope(), nonce, now: await this.timestamp()});
  }

  async revoke(nonce: string): Promise<QuoteCoordinatorRecord> {
    return this.config.store.revoke({scope: this.scope(), nonce, now: await this.timestamp()});
  }

  getFinalityDepth(): number {
    return this.confirmationDepth;
  }

  private normalizeIntent(intent: QuoteCoordinatorIntent): PiiFreeQuoteRequest {
    if (!intent.idempotencyKey || intent.idempotencyKey.length > 256) {
      throw new Error("idempotencyKey is required and must be at most 256 characters");
    }
    return {
      taker: normalizeAddress(intent.taker, "taker"),
      tokenIn: normalizeAddress(intent.tokenIn, "tokenIn"),
      tokenOut: normalizeAddress(intent.tokenOut, "tokenOut"),
      amountIn: toPositiveUintString(intent.amountIn, "amountIn"),
      venue: normalizeAddress(intent.venue, "venue"),
      ttlSeconds: normalizeTtlSeconds(intent.ttlSeconds ?? this.defaultTtlSeconds)
    };
  }

  private async responseOrResumeExisting(record: QuoteCoordinatorRecord, requestHash: string): Promise<SignedRFQQuote> {
    if (record.requestHash !== requestHash) throw new Error("idempotency key conflict: request hash differs");
    if (record.signedQuote) return record.signedQuote;
    if (record.state === "RESERVED") {
      const now = await this.timestamp();
      if (!record.inventoryLease || record.inventoryLease.released || record.inventoryLease.expiresAt <= now) {
        if (record.nonce) await this.config.store.expire({scope: this.scope(), nonce: record.nonce, now});
        throw new Error("idempotent quote reservation is expired or released");
      }
      return this.signReservedRecord(record, requestHash, record.idempotencyKeyHash);
    }
    if (record.state === "SIGN_FAILED") throw new Error("idempotent quote attempt previously failed during signing");
    throw new Error(`idempotent quote is not publishable in state ${record.state}`);
  }

  private async signReservedRecord(
    record: QuoteCoordinatorRecord,
    requestHash: string,
    idempotencyKeyHash: string
  ): Promise<SignedRFQQuote> {
    if (record.requestHash !== requestHash) throw new Error("idempotency key conflict: request hash differs");
    if (record.state !== "RESERVED" || !record.nonce || !record.inventoryLease || record.inventoryLease.released) {
      throw new Error(`quote reservation is not signable in state ${record.state}`);
    }
    const now = await this.timestamp();
    if (record.inventoryLease.expiresAt <= now) {
      await this.config.store.expire({scope: this.scope(), nonce: record.nonce, now});
      throw new Error("quote reservation expired before signing");
    }
    const quote: RFQQuote = {
      maker: this.maker,
      taker: record.request.taker,
      tokenIn: record.request.tokenIn,
      tokenOut: record.request.tokenOut,
      amountIn: record.request.amountIn,
      amountOut: record.inventoryLease.amount,
      venue: record.request.venue,
      nonce: record.nonce,
      expiry: record.inventoryLease.expiresAt
    };
    const data = typedData(domain(this.chainId, this.verifyingContract), quote);
    try {
      const signature = assertHex(await this.config.signer.signTypedData(data), "signature");
      await this.verifySignature(data, signature);
      const signedQuote = {quote, signature, typedData: data};
      const quoteHash = hashCanonical({quote, domain: data.domain});
      const signedRecord = await this.config.store.markSigned({
        scope: this.scope(),
        idempotencyKeyHash,
        requestHash,
        signedQuote,
        quoteHash,
        signerKeyRefHash: this.config.signerKeyRef ? hashSecret(this.config.signerKeyRef, "signerKeyRef") : undefined,
        now: await this.timestamp()
      });
      if (signedRecord.state !== "PUBLISHED" || signedRecord.quoteHash !== quoteHash || !signedRecord.signedQuote) {
        throw new Error(`quote publish failed from state ${signedRecord.state}`);
      }
      return signedRecord.signedQuote;
    } catch (error: any) {
      await this.config.store.markSignFailed({
        scope: this.scope(),
        idempotencyKeyHash,
        requestHash,
        now: await this.timestamp(),
        errorRef: error?.message ? hashSecret(error.message, "signError") : undefined
      });
      throw error;
    }
  }

  private scope(): QuoteNonceScope {
    return {chainId: this.chainId, adapter: this.verifyingContract, maker: this.maker};
  }

  private async verifySignature(data: RFQTypedData, signature: Hex): Promise<void> {
    if (this.config.verifySignature) return this.config.verifySignature(data, signature, this.maker);
    const recovered = verifyTypedData(data.domain, data.types, data.message, signature).toLowerCase();
    if (recovered !== this.maker) throw new Error("signer returned a signature that does not recover the maker");
  }

  private async timestamp(): Promise<number> {
    const value = await this.now();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("time source must return a non-negative safe integer");
    return value;
  }
}

export interface LocalFileQuoteCoordinatorStoreConfig {
  filePath: string;
  inventory: Array<{ maker: Address; token: Address; venue: Address; available: string }>;
  lockTimeoutMs?: number;
  confirmationDepth?: number;
  staleLockMs?: number;
}

interface StoreState {
  schemaVersion: 1;
  records: QuoteCoordinatorRecord[];
  lastNonceByScope: Record<string, string>;
  inventoryByScope: Record<string, {available: string; reserved: string}>;
}

export class LocalFileQuoteCoordinatorStore implements QuoteCoordinatorStore {
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly lockTimeoutMs: number;
  private readonly confirmationDepth: number;
  private readonly staleLockMs: number;

  constructor(config: LocalFileQuoteCoordinatorStoreConfig) {
    this.filePath = config.filePath;
    this.lockPath = `${config.filePath}.lock`;
    this.lockTimeoutMs = config.lockTimeoutMs ?? 5_000;
    this.confirmationDepth = normalizeConfirmations(config.confirmationDepth ?? DEFAULT_CONFIRMATIONS);
    this.staleLockMs = normalizePositiveMs(config.staleLockMs ?? Math.max(this.lockTimeoutMs * 2, 1_000), "staleLockMs");
    this.ensureInitialState(config.inventory);
  }

  async reserveOrReturnExisting(input: ReserveQuoteInput): Promise<ReserveQuoteResult> {
    return this.withLock(async (state) => {
      const existing = findByKey(state, input.scope, input.idempotencyKeyHash);
      if (existing) {
        if (existing.requestHash !== input.requestHash) throw new Error("idempotency key conflict: request hash differs");
        return {record: clone(existing), existing: true};
      }
      const scopeKey = nonceScopeKey(input.scope);
      const inventoryKeyValue = inventoryKey(input.inventoryDelta);
      const bucket = state.inventoryByScope[inventoryKeyValue];
      if (!bucket) throw new Error("inventory is not configured for maker/token/venue");
      releaseExpiredLeases(state, input.createdAt);
      if (BigInt(bucket.available) - BigInt(bucket.reserved) < BigInt(input.inventoryDelta.amount)) {
        throw new Error("insufficient unreserved inventory");
      }
      const nonce = ((BigInt(state.lastNonceByScope[scopeKey] ?? "0") + 1n)).toString();
      state.lastNonceByScope[scopeKey] = nonce;
      bucket.reserved = (BigInt(bucket.reserved) + BigInt(input.inventoryDelta.amount)).toString();
      const record: QuoteCoordinatorRecord = {
        schemaVersion: 1,
        state: "RESERVED",
        scope: input.scope,
        idempotencyKeyHash: input.idempotencyKeyHash,
        requestHash: input.requestHash,
        request: input.request,
        nonce,
        inventoryLease: {
          ...input.inventoryDelta,
          leaseId: hashCanonical({scope: input.scope, nonce, inventory: input.inventoryDelta}),
          expiresAt: input.reservationExpiresAt,
          released: false
        },
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        pricingSnapshotId: input.pricingSnapshotId,
        moduleVersions: input.moduleVersions,
        riskDecision: "passed",
        stateHistory: [
          {state: "RECEIVED", at: input.createdAt},
          {state: "RESERVED", at: input.createdAt}
        ]
      };
      state.records.push(record);
      return {record: clone(record), existing: false};
    });
  }

  async markSigned(input: MarkSignedInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByKey(state, input.scope, input.idempotencyKeyHash, input.requestHash);
      if (record.state !== "RESERVED" || !record.inventoryLease || record.inventoryLease.released) return clone(record);
      if (record.inventoryLease.expiresAt <= input.now) {
        record.state = "EXPIRED";
        record.stateHistory.push({state: "EXPIRED", at: input.now});
        record.updatedAt = input.now;
        record.terminalAt = input.now;
        releaseLease(state, record, "expired");
        return clone(record);
      }
      if (input.signedQuote.quote.nonce !== record.nonce || input.signedQuote.quote.expiry !== record.inventoryLease.expiresAt) {
        throw new Error("signed quote does not match reserved nonce or expiry");
      }
      record.stateHistory.push({state: "SIGNED", at: input.now});
      record.state = "PUBLISHED";
      record.stateHistory.push({state: "PUBLISHED", at: input.now});
      record.signedQuote = input.signedQuote;
      record.quoteHash = input.quoteHash;
      record.signerKeyRefHash = input.signerKeyRefHash;
      record.updatedAt = input.now;
      return clone(record);
    });
  }

  async markSignFailed(input: MarkSignFailedInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByKey(state, input.scope, input.idempotencyKeyHash, input.requestHash);
      if (record.state === "SIGN_FAILED" || isTerminal(record.state) || record.state !== "RESERVED") return clone(record);
      record.state = "SIGN_FAILED";
      record.stateHistory.push({state: "SIGN_FAILED", at: input.now});
      record.updatedAt = input.now;
      record.terminalAt = input.now;
      releaseLease(state, record, "sign-failed");
      return clone(record);
    });
  }

  async markObserved(input: MarkObservedInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByNonce(state, input.scope, input.nonce);
      if (isTerminal(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") {
        if (sameObservation(record.observed, input.observation)) return clone(record);
        throw new Error("conflicting settlement observation for quote nonce");
      }
      if (record.state !== "PUBLISHED") {
        throw new Error(`cannot observe settlement from state ${record.state}`);
      }
      record.state = input.observation.kind === "fill" ? "FILL_OBSERVED" : "CANCEL_OBSERVED";
      record.stateHistory.push({state: record.state, at: input.now});
      record.observed = input.observation;
      record.updatedAt = input.now;
      return clone(record);
    });
  }

  async reconcile(input: ReconcileInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByNonce(state, input.scope, input.nonce);
      releaseExpiredLeases(state, input.now);
      if (record.state !== "FILL_OBSERVED" && record.state !== "CANCEL_OBSERVED") return clone(record);
      if (!record.observed) throw new Error("observed record is missing observation data");
      if (!input.canonicalBlockHash) return clone(record);
      if (input.canonicalBlockHash.toLowerCase() !== record.observed.blockHash.toLowerCase()) {
        record.state = "PUBLISHED";
        record.stateHistory.push({state: "PUBLISHED", at: input.now});
        record.observed = undefined;
        record.updatedAt = input.now;
        return clone(record);
      }
      if (input.currentBlockNumber - record.observed.blockNumber + 1 >= this.confirmationDepth) {
        const finalState = record.state === "FILL_OBSERVED" ? "FILLED" : "CANCELLED";
        record.state = finalState;
        record.stateHistory.push({state: finalState, at: input.now});
        record.updatedAt = input.now;
        record.terminalAt = input.now;
        releaseLease(state, record, finalState === "FILLED" ? "filled" : "cancelled");
      }
      return clone(record);
    });
  }

  async expire(input: ExpireInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByNonce(state, input.scope, input.nonce);
      if (isTerminal(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") {
        throw new Error("observed quote cannot expire before reconciliation");
      }
      if (record.signedQuote && input.now < record.signedQuote.quote.expiry) throw new Error("quote has not expired");
      record.state = "EXPIRED";
      record.stateHistory.push({state: "EXPIRED", at: input.now});
      record.updatedAt = input.now;
      record.terminalAt = input.now;
      releaseLease(state, record, "expired");
      return clone(record);
    });
  }

  async revoke(input: RevokeInput): Promise<QuoteCoordinatorRecord> {
    return this.withLock(async (state) => {
      const record = requireRecordByNonce(state, input.scope, input.nonce);
      if (isTerminal(record.state)) return clone(record);
      if (record.state === "FILL_OBSERVED" || record.state === "CANCEL_OBSERVED") {
        throw new Error("observed quote cannot be revoked before reconciliation");
      }
      record.state = "REVOKED";
      record.stateHistory.push({state: "REVOKED", at: input.now});
      record.updatedAt = input.now;
      record.terminalAt = input.now;
      releaseLease(state, record, "revoke");
      return clone(record);
    });
  }

  async getByIdempotencyKeyHash(scope: QuoteNonceScope, idempotencyKeyHash: string): Promise<QuoteCoordinatorRecord | undefined> {
    return this.withLock(async (state) => clone(findByKey(state, scope, idempotencyKeyHash)));
  }

  private ensureInitialState(inventory: LocalFileQuoteCoordinatorStoreConfig["inventory"]): void {
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    const expectedInventoryByScope: StoreState["inventoryByScope"] = {};
    for (const item of inventory) {
      const key = inventoryKey({
        maker: normalizeAddress(item.maker, "inventory maker"),
        token: normalizeAddress(item.token, "inventory token"),
        venue: normalizeAddress(item.venue, "inventory venue")
      });
      expectedInventoryByScope[key] = {available: toPositiveUintString(item.available, "inventory available"), reserved: "0"};
    }
    if (!fs.existsSync(this.filePath)) {
      const state: StoreState = {schemaVersion: 1, records: [], lastNonceByScope: {}, inventoryByScope: expectedInventoryByScope};
      try {
        fs.writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, {flag: "wx"});
      } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    this.assertInitialStateReadable(expectedInventoryByScope);
  }

  private assertInitialStateReadable(expectedInventoryByScope: StoreState["inventoryByScope"]): void {
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as StoreState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.records) || !parsed.lastNonceByScope || !parsed.inventoryByScope) {
      throw new Error("quote coordinator store initial state is unreadable");
    }
    for (const [key, expected] of Object.entries(expectedInventoryByScope)) {
      const actual = parsed.inventoryByScope[key];
      if (!actual || actual.available !== expected.available) {
        throw new Error("quote coordinator store initial inventory does not match configuration");
      }
    }
  }

  private async withLock<T>(fn: (state: StoreState) => Promise<T> | T): Promise<T> {
    const started = Date.now();
    for (;;) {
      try {
        await fsp.mkdir(this.lockPath);
        break;
      } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        const stale = await this.isStaleLock();
        if (stale) {
          await fsp.rm(this.lockPath, {recursive: true, force: true});
          continue;
        }
        if (Date.now() - started > this.lockTimeoutMs) throw new Error("quote coordinator store lock timeout");
        await sleep(5);
      }
    }

    try {
      const state = await this.readState();
      const result = await fn(state);
      await this.writeState(state);
      return result;
    } finally {
      await fsp.rm(this.lockPath, {recursive: true, force: true});
    }
  }

  private async isStaleLock(): Promise<boolean> {
    try {
      const stat = await fsp.stat(this.lockPath);
      return Date.now() - stat.mtimeMs > this.staleLockMs;
    } catch (error: any) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }

  private async readState(): Promise<StoreState> {
    try {
      const raw = await fsp.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoreState;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) throw new Error("invalid schema");
      return parsed;
    } catch (error: any) {
      throw new Error(`quote coordinator store unavailable: ${error.message}`);
    }
  }

  private async writeState(state: StoreState): Promise<void> {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await fsp.rename(tmp, this.filePath);
  }
}

export function hashCanonical(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function hashSecret(value: string, field: string): string {
  if (!value) throw new Error(`${field} must not be empty`);
  return hashCanonical({value});
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function pricingSnapshotId(priced: unknown): string | undefined {
  if (priced && typeof priced === "object" && "snapshotId" in priced && typeof (priced as {snapshotId?: unknown}).snapshotId === "string") {
    return (priced as {snapshotId: string}).snapshotId;
  }
  return undefined;
}

function nonceScopeKey(scope: QuoteNonceScope): string {
  return `${scope.chainId}:${scope.adapter}:${scope.maker}`;
}

function inventoryKey(delta: Pick<QuoteInventoryDelta, "maker" | "token" | "venue">): string {
  return `${delta.maker}:${delta.token}:${delta.venue}`;
}

function findByKey(state: StoreState, scope: QuoteNonceScope, idempotencyKeyHash: string): QuoteCoordinatorRecord | undefined {
  const scopeKey = nonceScopeKey(scope);
  return state.records.find((record) => nonceScopeKey(record.scope) === scopeKey && record.idempotencyKeyHash === idempotencyKeyHash);
}

function requireRecordByKey(state: StoreState, scope: QuoteNonceScope, idempotencyKeyHash: string, requestHash: string): QuoteCoordinatorRecord {
  const record = findByKey(state, scope, idempotencyKeyHash);
  if (!record) throw new Error("quote record not found");
  if (record.requestHash !== requestHash) throw new Error("idempotency key conflict: request hash differs");
  return record;
}

function requireRecordByNonce(state: StoreState, scope: QuoteNonceScope, nonce: string): QuoteCoordinatorRecord {
  const scopeKey = nonceScopeKey(scope);
  const record = state.records.find((candidate) => nonceScopeKey(candidate.scope) === scopeKey && candidate.nonce === nonce);
  if (!record) throw new Error("quote record not found");
  return record;
}

function releaseExpiredLeases(state: StoreState, now: number): void {
  for (const record of state.records) {
    if (!record.inventoryLease || record.inventoryLease.released || record.inventoryLease.expiresAt > now || isObservedOrTerminal(record.state)) continue;
    record.state = "EXPIRED";
    record.stateHistory.push({state: "EXPIRED", at: now});
    record.updatedAt = now;
    record.terminalAt = now;
    releaseLease(state, record, "expired");
  }
}

function releaseLease(state: StoreState, record: QuoteCoordinatorRecord, reason: NonNullable<QuoteCoordinatorRecord["releaseReason"]>): void {
  if (!record.inventoryLease || record.inventoryLease.released) return;
  const bucket = state.inventoryByScope[inventoryKey(record.inventoryLease)];
  if (!bucket) throw new Error("inventory bucket missing during lease release");
  bucket.reserved = (BigInt(bucket.reserved) - BigInt(record.inventoryLease.amount)).toString();
  if (BigInt(bucket.reserved) < 0n) throw new Error("inventory reservation underflow");
  record.inventoryLease.released = true;
  record.inventoryLease.releaseReason = reason;
  record.releaseReason = reason;
}

function sameObservation(a: QuoteObservation | undefined, b: QuoteObservation): boolean {
  return !!a &&
    a.kind === b.kind &&
    a.transactionHash.toLowerCase() === b.transactionHash.toLowerCase() &&
    a.blockNumber === b.blockNumber &&
    a.blockHash.toLowerCase() === b.blockHash.toLowerCase();
}

function isObservedOrTerminal(state: QuoteLifecycleState): boolean {
  return state === "FILL_OBSERVED" || state === "CANCEL_OBSERVED" || isTerminal(state);
}

function isTerminal(state: QuoteLifecycleState): boolean {
  return state === "FILLED" || state === "CANCELLED" || state === "EXPIRED" || state === "SIGN_FAILED" || state === "REVOKED";
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeConfirmations(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("confirmationDepth must be a positive safe integer");
  return value;
}

function normalizeBlockNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("blockNumber must be a non-negative safe integer");
  return value;
}

function normalizePositiveMs(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer`);
  return value;
}

function assertBytes32Hex(value: Hex, field: string): Hex {
  const hex = assertHex(value, field);
  if (!/^0x[a-fA-F0-9]{64}$/.test(hex)) throw new Error(`${field} must be 32-byte hex`);
  return hex;
}
