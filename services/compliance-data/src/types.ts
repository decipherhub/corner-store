export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type AcquisitionSourceType =
  | "PRIMARY"
  | "SECONDARY"
  | "DIVIDEND"
  | "CONVERSION"
  | "PLEDGE"
  | "GIFT"
  | "TRUST"
  | "ESTATE";

export interface AcquisitionLot {
  lotId: string;
  holder: Address;
  asset: Address;
  quantity: string;
  acquisitionDate: number;
  paymentCompleteAt: number;
  sourceType: AcquisitionSourceType;
  lineageRef?: string;
}

export interface TransferAgentProvider {
  lots(holder: Address, asset: Address): Promise<AcquisitionLot[]>;
}

export type AcquisitionSnapshotStatus = "MISSING" | "VALID" | "LINEAGE_BROKEN";

export interface CompiledAcquisitionSnapshot {
  holder: Address;
  asset: Address;
  clockStart: number;
  observedAt: number;
  expiresAt: number;
  sourceRef: Hex;
  status: AcquisitionSnapshotStatus;
}

export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

export interface RejectionRecord {
  kind: "REJECTION";
  timestamp: number;
  attemptTxRef: string;
  from: Address;
  to: Address;
  tokenIn: Address;
  tokenOut: Address;
  amount: string;
  direction: "BUY" | "SELL" | "TRANSFER";
  failedElement: string;
  reasonCode: Hex;
  attestedFactRefs: Hex[];
  reliedExemption: string;
  riskTier: RiskTier;
}

export interface SurveillanceRecord {
  kind: "SURVEILLANCE";
  timestamp: number;
  transactionHash: Hex;
  token: Address;
  from: Address;
  to: Address;
  amount: string;
  route: "APPROVED_ROUTER" | "DIRECT_TRANSFER" | "DIRECT_VENUE" | "UNKNOWN";
  finding: string;
  riskTier: RiskTier;
}

export type ComplianceAuditRecord = RejectionRecord | SurveillanceRecord;

export interface AuditEntry {
  sequence: number;
  previousHash: Hex;
  recordHash: Hex;
  record: ComplianceAuditRecord;
}

export interface VolumeCommit {
  executionId: Hex;
  sellerGroupId: string;
  timestamp: number;
  amount: string;
  holderUpdates?: HolderUpdate[];
}

export interface HolderUpdate {
  groupId: string;
  isHolder: boolean;
  isAccredited: boolean;
  isUsResident: boolean;
}

export interface HolderCounts {
  total: number;
  nonAccredited: number;
  usResident: number;
}
