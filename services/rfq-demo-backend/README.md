# Corner Store RFQ Demo Backend

This package is a local-only RFQ quote API built on `services/rfq`. It exists to
show how an application uses the reusable SDK; Corner Store does not operate a
hosted production RFQ backend.

## Run

From the repository root, run the complete demo and keep both Anvil and this
backend running:

```sh
scripts/e2e-anvil.sh --profile buidl-like --keep
```

The runner builds and starts this package automatically. To run the backend
manually against an already deployed stack instead:

```sh
cd services/rfq-demo-backend
npm ci
npm start
```

The defaults use `deployments/anvil-e2e.json`, Anvil account 2 as the approved
maker, chain id 31337, `http://127.0.0.1:8545` for the current chain timestamp,
a 1:1 fixed rate and one-hour quote expiry.

## API

Health and configured pair:

```sh
curl http://127.0.0.1:8787/health
```

Request a quote using base units:

```sh
curl -X POST http://127.0.0.1:8787/rfq/quote \
  -H 'content-type: application/json' \
  -d '{"taker":"0x...","amountIn":"5000000000000000000000000","ttlSeconds":3600}'
```

The backend fixes `tokenIn`, `tokenOut`, RFQ venue and verifying contract to the
deployment artifact. The response is the existing `{quote, signature,
typedData}` format consumed by the CLI and `RFQAdapter`.

For the click-through local demo, run:

```sh
scripts/e2e-anvil.sh --profile buidl-like --mode rfq --keep
npm run start --prefix services/operator-dashboard
```

Open `http://127.0.0.1:8790`. **Check & prepare demo** verifies the deployment
and restores the on-chain demo maker if a previous security run left it revoked.
In **Trader · RFQ**, request, review and execute the exact signed quote through
`ExecutionRouter`. In **Security demo**, create a quote while the maker is
approved, revoke the maker, observe the Router rejection, then explicitly
restore the maker. The private keys remain in the local backend.

The local-only dashboard control endpoints are:

- `GET /demo/state`: read maker approval and the three demo wallet/QP states.
- `POST /demo/setup`: prepare the reusable demo state and return its status.
- `POST /demo/restore`: explicitly re-approve the demo maker.
- `POST /demo/precheck`: evaluate current QP, maker and asset policy for a wallet.
- `POST /demo/quote`: issue a taker-bound signed quote for a configured demo wallet.
- `POST /demo/trade`: settle or run maker/compliance final-enforcement proofs.
- `POST /demo/admin/user`: set a demo wallet's live QP fixture.
- `POST /demo/admin/maker`: set the live maker approval.

The state/setup/restore/trade controls are disabled unless
`RFQ_DEMO_ENABLE_SETTLEMENT=1` is set by the local runner. `/demo/quote` remains
a quote-only convenience alias and cannot execute a transaction. These are
reference-demo controls, not a production operator API.

## Configuration

Command flags have matching `RFQ_DEMO_*` environment variables:

- `--host`, `--port`, `--artifact`, `--chain-id`, `--rpc`
- `--maker-account` or `--maker-key`
- `--ttl`
- `--price-numerator`, `--price-denominator`
- `RFQ_DEMO_OPERATOR_ACCOUNT`, `RFQ_DEMO_INVESTOR_ACCOUNT` (local Anvil
  account indexes used only when demo settlement is explicitly enabled)
- `RFQ_DEMO_ELIGIBLE_B_ACCOUNT`, `RFQ_DEMO_INELIGIBLE_ACCOUNT`

`RFQ_DEMO_ENABLE_SETTLEMENT=1` additionally enables the click-through settlement
endpoint. It is set by `scripts/e2e-anvil.sh` only after it has started local
Anvil. Do not enable or expose this endpoint for a hosted service.

Run `npm start -- --help` for defaults. Never commit a maker key.

## Production boundary

The included fixed pricing, Anvil key, in-memory nonce and no-op inventory check
are demo fixtures. A production operator must replace pricing, signer custody,
persistent nonce storage, inventory/risk controls, authentication, rate limiting,
monitoring and hosting. The backend cannot approve a trade: final compliance is
evaluated at fill time by `ExecutionRouter` and `ComplianceEngine`.

## Test

```sh
npm test
```

The smoke test starts an ephemeral local server, requests two quotes, verifies
the maker signature and monotonic nonce, rejects numeric on-chain amounts, and
confirms demo controls remain disabled outside the local runner. The live runner
additionally proves setup → protected Router fill → persistent revoke state →
explicit restore, role-aware pre-check, ineligible final rejection and Admin QP
round-trip against the selected asset profile.
