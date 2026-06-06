# Corner Store

Corner Store is a compliance-aware multi-venue execution system for tokenized
assets. It separates token/identity enforcement, versioned compliance policy,
execution routing, and venue-specific settlement across AMM, RFQ, and future
Order Book adapters.

The repository currently contains the architecture and development plan, a
vendored Uniswap v3 deployment tool, and the initial Foundry project scaffold.
Product Solidity contracts are not implemented yet.

## Documentation

- [`docs/README.md`](./docs/README.md): documentation map and source-of-truth rules
- [`docs/MVP-v2-multi-venue.md`](./docs/MVP-v2-multi-venue.md): current product scope
- [`docs/architecture/README.md`](./docs/architecture/README.md): responsibility boundaries
- [`docs/ROADMAP.md`](./docs/ROADMAP.md): implementation phases and completion criteria
- [`tools/deploy-v3/UPSTREAM.md`](./tools/deploy-v3/UPSTREAM.md): vendored upstream provenance

## Development

The product contracts use Foundry. The template `Counter` files remain only
until Roadmap Phase 0 replaces them with the product structure and fixtures.

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Format

```shell
forge fmt
```

### Local Node

```shell
anvil
```

The vendored Uniswap deployment tool has its own commands and scope:

```shell
cd tools/deploy-v3
yarn test
```

Read
[`tools/deploy-v3/CORNER_STORE_PROFILE.md`](./tools/deploy-v3/CORNER_STORE_PROFILE.md)
before changing the deployment profile.
