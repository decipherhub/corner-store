import {RFQ_REJECTION_REASON_CODES, RFQRejectionReasonCode} from "./types";

export type RFQCoordinatorErrorCode =
  | "INVALID_REQUEST"
  | "PRODUCT_UNAUTHORIZED"
  | "CONFIGURATION_INVALID"
  | "DEPENDENCY_UNAVAILABLE"
  | "CONTEXT_EVIDENCE_INVALID"
  | "IDEMPOTENCY_CONFLICT"
  | "INVENTORY_UNAVAILABLE"
  | "TERMINAL_REPLAY"
  | "STRICT_EVIDENCE_REQUIRED"
  | "PRICING_FRESHNESS_INVALID"
  | "RISK_FRESHNESS_INVALID"
  | "RISK_REJECTED"
  | "SIGNER_CALL_FAILED"
  | "SIGNER_SIGNATURE_INVALID";

export class RFQCoordinatorError extends Error {
  readonly reasonCodes?: readonly RFQRejectionReasonCode[];

  constructor(
    readonly code: RFQCoordinatorErrorCode,
    message: string,
    readonly cause?: unknown,
    reasonCodes?: readonly RFQRejectionReasonCode[]
  ) {
    super(message);
    this.name = "RFQCoordinatorError";
    if (
      Array.isArray(reasonCodes) &&
      reasonCodes.length > 0 &&
      reasonCodes.length <= 32 &&
      reasonCodes.every((value) => RFQ_REJECTION_REASON_CODES.includes(value))
    ) {
      this.reasonCodes = Object.freeze([...new Set(reasonCodes)]);
    }
  }
}

export type RFQStoreErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "INVENTORY_UNAVAILABLE"
  | "INVENTORY_NOT_CONFIGURED";

export class RFQStoreError extends Error {
  constructor(readonly code: RFQStoreErrorCode, message: string) {
    super(message);
    this.name = "RFQStoreError";
  }
}
