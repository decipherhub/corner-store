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

The defaults use `deployments/anvil-e2e.json`,
`config/demo-scenario.json`, Anvil account 2 as the approved maker, chain id
31337, `http://127.0.0.1:8545` for the current chain timestamp, a 1:1 fixed rate
and one-hour quote expiry.

## API

Health and configured pair:

```sh
curl http://127.0.0.1:8787/health
```

Request a quote using base units:

```sh
curl -X POST http://127.0.0.1:8787/rfq/quote \
  -H 'content-type: application/json' \
  -d '{"taker":"0x...","amountIn":"5000000000000000000000000","side":"buy","ttlSeconds":3600}'
```

`side` defaults to `buy`. Buy binds `tokenIn=QUOTE, tokenOut=RWA`; sell binds
`tokenIn=RWA, tokenOut=QUOTE`. The backend fixes both supported directions, RFQ
venue and verifying contract to the deployment artifact. The response is the
existing `{quote, signature, typedData}` format consumed by the CLI and
`RFQAdapter`.

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
- `GET /demo/market-history`: read injected NAV/indicative series and actual
  Router fill points without merging their data provenance.
- `POST /demo/setup`: prepare the reusable demo state and return its status.
- `POST /demo/restore`: explicitly re-approve the demo maker.
- `POST /demo/precheck`: evaluate current QP, maker and asset policy for a wallet
  and a `buy | sell` side.
- `POST /demo/quote`: issue a direction-aware, taker-bound signed quote for a
  configured demo wallet.
- `POST /demo/trade`: settle or run maker/compliance final-enforcement proofs.
- `POST /demo/admin/claim`: record the wallet's QP basis, signature validity,
  trusted-issuer status, look-through result and fund binding. The A-13 Element
  derives eligibility from those facts; the API cannot directly set an
  eligible/ineligible result.
- `POST /demo/admin/maker`: set the live maker approval.
- `POST /demo/admin/temporal/prepare`: inject the short freshness cap and refresh
  the configured target wallet's QP claim.
- `POST /demo/admin/temporal/advance`: advance local Anvil time so the QP claim
  expires while the configured quote TTL remains live.

The state/setup/restore/trade controls are disabled unless
`RFQ_DEMO_ENABLE_SETTLEMENT=1` is set by the local runner. `/demo/quote` remains
a quote-only convenience alias and cannot execute a transaction. These are
reference-demo controls, not a production operator API.

## Configuration

Command flags have matching `RFQ_DEMO_*` environment variables:

- `--host`, `--port`, `--artifact`, `--scenario`, `--chain-id`, `--rpc`
- `--maker-account` or `--maker-key`
- `RFQ_DEMO_OPERATOR_ACCOUNT`

`--scenario` or `RFQ_DEMO_SCENARIO` selects a validated schema-v2 JSON fixture.
The file owns:

- Anvil account bindings for deployer, investors and makers;
- initial investor, maker and pool balances in base units;
- an initial mock price, per-fill price impact, buy/sell defaults and quote TTL;
- mock NAV/oracle and indicative-mid history, interval and spread;
- RWA and settlement-asset presentation data and minimum base units;
- wallet persona mapping and initial QP status;
- preview quotes and temporal-expiry parameters.

The runner copies the selected file to the deployment runtime input before
`DeployStack` runs. Those values therefore drive real Anvil account derivation,
minting and settlement rather than only changing dashboard labels. The deployment
artifact binds the exact scenario schema version and content hash; the backend
refuses to start with a different file. Quote TTL and mock-market pricing cannot
be overridden independently; change the scenario and redeploy so the executable
configuration remains reproducible.

`execution.pricing.numerator / denominator` is the initial settlement-asset price of
one whole RWA (`qUSD per RWA`). Buy quotes invert that price to calculate RWA
output, while sell quotes apply it directly. After a successful fill,
`impactBpsPerFill` moves the in-memory demo market up for a buy and down for a
sell. The next quote and dashboard reference price use that updated value.
Rejected trades do not move it, and `/demo/setup` restores the injected initial
price. There is no separate display-only price.

`minimumTradeBufferBps` controls the safety margin used by
`suggestedTradeAmounts`. The backend recalculates these suggested buy/sell inputs
from the current price and the asset minimum after every fill, while manually
entered smaller amounts still exercise the real minimum-investment rejection.

`GET /demo/market-history` returns the injected NAV/oracle and indicative-mid
series plus actual Router fills recorded by the current backend process. Fixture
series and live fills remain separate fields so the dashboard does not present
sparse RFQ trading as continuous exchange candles.

`marketHistory.intervalSeconds` is the spacing between injected price anchors.
`sampleIntervalSeconds` deterministically interpolates those anchors for the
dashboard's visible windows. The default keeps hourly anchors and emits one-minute
samples, making the 1-minute, 5-minute, 1-hour and full-history controls materially
different without embedding display-only prices in the frontend.

The tracked default is:

```text
services/rfq-demo-backend/config/demo-scenario.json
```

To inject another test set, copy that file, change its values, and run:

```sh
scripts/demo.sh --profile buidl-like --scenario /path/to/scenario.json
```

Wallets are not arbitrary browser-only addresses. Each scenario wallet maps an
Anvil account to a named address in the fresh deployment artifact. The backend
verifies that mapping before signing or sending a transaction. Scenario policy
amounts must also remain consistent with the deployed contract policy. Validation
rejects duplicate/out-of-range accounts, unsafe base-unit values, default trades
that cannot be funded by the injected inventory, and BUIDL-like defaults below
the configured RWA minimum.

`RFQ_DEMO_ENABLE_SETTLEMENT=1` additionally enables the click-through settlement
endpoint. It is set by `scripts/e2e-anvil.sh` only after it has started local
Anvil. Do not enable or expose this endpoint for a hosted service.

Run `npm start -- --help` for defaults. Never commit a maker key.

## Production boundary

The included trade-impact mock pricing, deterministic Anvil keys, scenario fixtures,
in-memory nonce and no-op inventory check are demo components. A production
operator supplies actual balances through chain/indexer reads and replaces the
RFQ SDK pricing, signer custody,
persistent nonce storage, inventory/risk controls, authentication, rate limiting,
monitoring and hosting. The backend cannot approve a trade: final compliance is
evaluated at fill time by `ExecutionRouter` and `ComplianceEngine`.

## Test

```sh
npm test
```

The smoke test loads an injected scenario, starts an ephemeral local server,
requests two quotes, verifies the maker signature and monotonic nonce, rejects
numeric on-chain amounts, and confirms demo controls remain disabled outside
the local runner. The live runner additionally proves setup → protected Router
fill → persistent revoke state → explicit restore, role-aware pre-check,
ineligible final rejection, Admin QP round-trip, quote-time eligibility expiring
before Router settlement, and a reverse sell whose RWA decreases while the
settlement-asset balance increases.
