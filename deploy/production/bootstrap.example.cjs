// Bundle this file together with operator-owned implementations and their
// dependencies. This example intentionally does not provide a working fallback:
// production startup must fail until every external dependency is injected.

module.exports = {
  contractVersion: "1.0.0",
  capabilities: {
    durable_coordinator: true,
    external_signer: true,
    fresh_pricing_risk: true,
    incident_monitoring: true,
    live_policy_resolver: true,
    production_authentication: true,
    shared_rate_limit: true,
    strict_audit: true
  },
  async createProductionRFQDependencies(context) {
    if (context.contractVersion !== "1.0.0" || context.runtime !== "production") {
      throw new Error("unsupported Corner Store production RFQ contract");
    }
    // Return operator-owned coordinator, authenticator, policy resolver, shared
    // limiter, WORM audit, bounded metrics, incident hook and readiness probe.
    // See docs/production-containers.md. Never place credentials in this file.
    throw new Error("operator production adapters are not configured");
  }
};
