export type RFQCoordinatorErrorCode =
  | "INVALID_REQUEST"
  | "PRODUCT_UNAUTHORIZED"
  | "CONFIGURATION_INVALID"
  | "DEPENDENCY_UNAVAILABLE"
  | "CONTEXT_EVIDENCE_INVALID"
  | "IDEMPOTENCY_CONFLICT"
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
