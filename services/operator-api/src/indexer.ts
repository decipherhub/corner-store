import {existsSync, readFileSync, writeFileSync} from "fs";
import {EventStore, IndexedEvent} from "./api";

export interface ChainReader {
  head(): Promise<number>;
  blockHash(blockNumber: number): Promise<string>;
  events(fromBlock: number, toBlock: number): Promise<IndexedEvent[]>;
}

interface Cursor {
  schemaVersion: 1;
  lastFinalizedBlock: number;
  lastFinalizedHash: string;
}

export class FinalityAwareIndexer {
  private cursor: Cursor;

  constructor(private readonly reader: ChainReader, private readonly store: EventStore, private readonly cursorPath: string, private readonly confirmations = 12) {
    if (!Number.isSafeInteger(confirmations) || confirmations < 0) throw new Error("confirmations must be non-negative");
    this.cursor = existsSync(cursorPath)
      ? JSON.parse(readFileSync(cursorPath, "utf8"))
      : {schemaVersion: 1, lastFinalizedBlock: -1, lastFinalizedHash: ""};
  }

  async sync(): Promise<{fromBlock: number; toBlock: number; added: number}> {
    const head = await this.reader.head();
    const target = head - this.confirmations;
    if (target < 0 || target <= this.cursor.lastFinalizedBlock) return {fromBlock: target + 1, toBlock: target, added: 0};
    if (this.cursor.lastFinalizedBlock >= 0) {
      const currentHash = await this.reader.blockHash(this.cursor.lastFinalizedBlock);
      if (currentHash !== this.cursor.lastFinalizedHash) {
        throw new Error(`chain reorg detected at finalized block ${this.cursor.lastFinalizedBlock}; manual rewind required`);
      }
    }
    const fromBlock = this.cursor.lastFinalizedBlock + 1;
    const events = await this.reader.events(fromBlock, target);
    for (const event of events) this.store.add(event);
    this.cursor = {schemaVersion: 1, lastFinalizedBlock: target, lastFinalizedHash: await this.reader.blockHash(target)};
    writeFileSync(this.cursorPath, `${JSON.stringify(this.cursor, null, 2)}\n`, {flag: "w"});
    return {fromBlock, toBlock: target, added: events.length};
  }
}
