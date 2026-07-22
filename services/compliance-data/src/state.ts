import {assertTimestamp, assertUintString, hash} from "./canonical";
import {Hex, HolderCounts, HolderUpdate, VolumeCommit} from "./types";

interface VolumePoint {
  groupId: string;
  timestamp: number;
  amount: bigint;
}

export class PersonGroupLedger {
  private readonly commits = new Map<Hex, Hex>();
  private readonly volumes: VolumePoint[] = [];
  private readonly holders = new Map<string, HolderUpdate>();

  commit(input: VolumeCommit): {applied: boolean; commitHash: Hex} {
    validateCommit(input);
    const commitHash = hash(input);
    const previous = this.commits.get(input.executionId);
    if (previous) {
      if (previous !== commitHash) throw new Error(`conflicting commit replay: ${input.executionId}`);
      return {applied: false, commitHash};
    }

    this.commits.set(input.executionId, commitHash);
    this.volumes.push({groupId: input.sellerGroupId, timestamp: input.timestamp, amount: BigInt(input.amount)});
    for (const update of input.holderUpdates ?? []) this.holders.set(update.groupId, {...update});
    return {applied: true, commitHash};
  }

  rollingThreeCalendarMonthVolume(groupId: string, asOf: number): bigint {
    assertTimestamp(asOf, "asOf");
    const start = threeCalendarMonthsBefore(asOf);
    return this.volumes
      .filter((point) => point.groupId === groupId && point.timestamp >= start && point.timestamp <= asOf)
      .reduce((sum, point) => sum + point.amount, 0n);
  }

  holderCounts(): HolderCounts {
    const active = [...this.holders.values()].filter((holder) => holder.isHolder);
    return {
      total: active.length,
      nonAccredited: active.filter((holder) => !holder.isAccredited).length,
      usResident: active.filter((holder) => holder.isUsResident).length
    };
  }
}

function validateCommit(input: VolumeCommit): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.executionId)) throw new Error("executionId must be bytes32 hex");
  if (!input.sellerGroupId.trim()) throw new Error("sellerGroupId is required");
  assertTimestamp(input.timestamp, "timestamp");
  assertUintString(input.amount, "amount");
  const groups = new Set<string>();
  for (const update of input.holderUpdates ?? []) {
    if (!update.groupId.trim() || groups.has(update.groupId)) throw new Error("holderUpdates require unique groupId values");
    groups.add(update.groupId);
  }
}

function threeCalendarMonthsBefore(timestamp: number): number {
  const date = new Date(timestamp * 1_000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 3);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return Math.floor(date.getTime() / 1_000);
}
