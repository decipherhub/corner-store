# Corner Store RFQ TypeScript SDK

`services/rfq` provides TypeScript helpers for building an RFQ quote backend that is compatible with Corner Store's on-chain `RFQAdapter`.

It is **not** a production RFQ server and Corner Store does not operate a hosted RFQ backend. Operators are responsible for hosting, pricing, signer custody, persistent nonces, inventory/risk controls and any optional off-chain prechecks.

## What the SDK does

- Builds the RFQ quote shape expected by `RFQAdapter`.
- Builds the EIP-712 typed data with the correct domain and field order.
- Binds quotes to `chainId`, `verifyingContract`, maker, taker, token pair, venue, nonce and expiry.
- Rejects unsafe JavaScript `number` inputs for on-chain integer fields.
- Provides high-level quote flow hooks for pricing, nonce and risk components.
- Provides local reference components for tests and demos.

## What the SDK does not do

- No hosted backend.
- No production market-making strategy.
- No production signer/key custody.
- No custody or inventory management.
- No final compliance decision in the backend.
- No dashboard or websocket/order discovery.

Final compliance remains at fill time in `ExecutionRouter` and `ComplianceEngine`.

## Quick start

```ts
import {
  createRFQService,
  FixedRatePricingProvider,
  InMemoryNonceStore,
  NoopInventoryRiskCheck,
  TypedDataSigner,
} from "@corner-store/rfq-service";

const signer: TypedDataSigner = {
  async signTypedData(typedData) {
    // Replace this with KMS/HSM/wallet-service signing in production.
    return mySigner.signTypedData(typedData);
  },
};

const rfq = createRFQService({
  chainId: 31337,
  verifyingContract: "0x6000000000000000000000000000000000000006",
  maker: "0x1000000000000000000000000000000000000001",
  signer,
  pricing: new FixedRatePricingProvider({ numerator: 99n, denominator: 100n }),
  nonceStore: new InMemoryNonceStore(),
  riskCheck: new NoopInventoryRiskCheck(),
});

const signedQuote = await rfq.quote({
  taker: "0x2000000000000000000000000000000000000002",
  tokenIn: "0x3000000000000000000000000000000000000003",
  tokenOut: "0x4000000000000000000000000000000000000004",
  amountIn: "1000000000000000000",
  venue: "0x5000000000000000000000000000000000000005",
});
```

The returned `signedQuote` contains:

- `quote`: adapter-compatible quote fields.
- `signature`: maker signature.
- `typedData`: exact EIP-712 payload that was signed.

## Replace for production

The reference components are intentionally local/demo-only:

| Component | Purpose | Production replacement |
| --- | --- | --- |
| `InMemoryNonceStore` | local maker-scoped monotonic nonce assignment matching `RFQAdapter.usedQuoteNonce[maker][nonce]` | DB/Redis-backed persistent nonce store |
| `FixedRatePricingProvider` | deterministic demo price | operator pricing engine |
| `NoopInventoryRiskCheck` | no-op demo risk gate | inventory, exposure and maker risk checks |
| custom `TypedDataSigner` | signing seam | KMS/HSM/custody signer |

## Low-level API

Advanced callers can still use `RFQQuoteService.createSignedQuote()` when they already know `maker`, `amountOut`, `nonce` and expiry policy. This preserves the original reference-service behavior.

## Test

```sh
cd services/rfq
npm test
```
