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
  constructor(readonly code: RFQCoordinatorErrorCode, message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RFQCoordinatorError";
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
