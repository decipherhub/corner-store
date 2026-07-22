import {assertAddress, assertTimestamp, assertUintString, hash} from "./canonical";
import {
  AcquisitionLot,
  Address,
  CompiledAcquisitionSnapshot,
  TransferAgentProvider
} from "./types";

const LINEAGE_REQUIRED = new Set(["DIVIDEND", "CONVERSION", "PLEDGE", "GIFT", "TRUST", "ESTATE"]);

export class AcquisitionResolver {
  constructor(private readonly provider: TransferAgentProvider, private readonly snapshotTtlSeconds = 86_400) {
    if (!Number.isSafeInteger(snapshotTtlSeconds) || snapshotTtlSeconds <= 0) {
      throw new Error("snapshotTtlSeconds must be a positive safe integer");
    }
  }

  async compile(holder: Address, asset: Address, observedAt: number): Promise<CompiledAcquisitionSnapshot> {
    assertTimestamp(observedAt, "observedAt");
    assertAddress(holder, "holder");
    assertAddress(asset, "asset");
    const lots = await this.provider.lots(holder, asset);
    if (lots.length === 0) return this.snapshot(holder, asset, observedAt, 0, "MISSING", []);

    const byId = new Map<string, AcquisitionLot>();
    for (const lot of lots) {
      validateLot(lot, holder, asset, observedAt);
      if (byId.has(lot.lotId)) throw new Error(`duplicate lotId: ${lot.lotId}`);
      byId.set(lot.lotId, lot);
    }

    const clocks: number[] = [];
    for (const lot of lots) {
      const clock = resolveClock(lot, byId, new Set());
      if (clock === undefined) return this.snapshot(holder, asset, observedAt, 0, "LINEAGE_BROKEN", lots);
      clocks.push(clock);
    }

    // A single holder×asset snapshot cannot safely express lot selection. Use
    // the latest current-lot clock so every represented lot must have matured.
    return this.snapshot(holder, asset, observedAt, Math.max(...clocks), "VALID", lots);
  }

  private snapshot(
    holder: Address,
    asset: Address,
    observedAt: number,
    clockStart: number,
    status: CompiledAcquisitionSnapshot["status"],
    lots: AcquisitionLot[]
  ): CompiledAcquisitionSnapshot {
    return {
      holder,
      asset,
      clockStart,
      observedAt,
      expiresAt: safeExpiry(observedAt, this.snapshotTtlSeconds),
      sourceRef: hash(lots),
      status
    };
  }
}

function validateLot(lot: AcquisitionLot, holder: Address, asset: Address, observedAt: number): void {
  if (!lot.lotId.trim()) throw new Error("lotId is required");
  if (lot.holder.toLowerCase() !== holder.toLowerCase() || lot.asset.toLowerCase() !== asset.toLowerCase()) {
    throw new Error(`lot ${lot.lotId} does not match requested holder/asset`);
  }
  assertUintString(lot.quantity, `lot ${lot.lotId} quantity`);
  assertTimestamp(lot.acquisitionDate, `lot ${lot.lotId} acquisitionDate`);
  assertTimestamp(lot.paymentCompleteAt, `lot ${lot.lotId} paymentCompleteAt`);
  if (lot.acquisitionDate > observedAt || lot.paymentCompleteAt > observedAt) {
    throw new Error(`lot ${lot.lotId} contains a future acquisition/payment timestamp`);
  }
  if (!new Set(["PRIMARY", "SECONDARY", "DIVIDEND", "CONVERSION", "PLEDGE", "GIFT", "TRUST", "ESTATE"]).has(lot.sourceType)) {
    throw new Error(`lot ${lot.lotId} has unsupported sourceType`);
  }
  if (lot.lineageRef && !LINEAGE_REQUIRED.has(lot.sourceType)) {
    throw new Error(`${lot.sourceType.toLowerCase()} lot ${lot.lotId} cannot inherit lineage`);
  }
}

function safeExpiry(observedAt: number, ttl: number): number {
  const expiresAt = observedAt + ttl;
  if (!Number.isSafeInteger(expiresAt)) throw new Error("snapshot expiry exceeds safe integer range");
  return expiresAt;
}

function resolveClock(
  lot: AcquisitionLot,
  byId: Map<string, AcquisitionLot>,
  visiting: Set<string>
): number | undefined {
  if (visiting.has(lot.lotId)) return undefined;
  const requiresLineage = LINEAGE_REQUIRED.has(lot.sourceType);
  if (!lot.lineageRef) return requiresLineage ? undefined : Math.max(lot.acquisitionDate, lot.paymentCompleteAt);
  const parent = byId.get(lot.lineageRef);
  if (!parent) return undefined;
  visiting.add(lot.lotId);
  const clock = resolveClock(parent, byId, visiting);
  visiting.delete(lot.lotId);
  return clock;
}
