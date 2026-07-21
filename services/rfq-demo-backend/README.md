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
maker, chain id 31337, a 1:1 fixed rate and one-hour quote expiry.

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

The easiest end-user flow is:

```sh
node services/cli/dist/cli/src/index.js rfq-quote \
  --backend http://127.0.0.1:8787 --amount-in 5000000 --out quote.json
node services/cli/dist/cli/src/index.js buy 0 --venue rfq --quote quote.json
```

`rfq-quote` verifies the returned taker, pair, venue, chain, RFQ adapter and maker
signature before writing the quote file.

## Configuration

Command flags have matching `RFQ_DEMO_*` environment variables:

- `--host`, `--port`, `--artifact`, `--chain-id`
- `--maker-account` or `--maker-key`
- `--ttl`
- `--price-numerator`, `--price-denominator`

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
the maker signature and monotonic nonce, and rejects numeric on-chain amounts.
The repository live runner additionally proves backend quote → CLI → protected
Router fill and revoked-maker rejection against the selected asset profile.
