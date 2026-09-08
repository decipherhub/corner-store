# @corner-store/toolkit

Versioned configuration, production onboarding planning, Safe proposal export and
post-deployment verification helpers for Corner Store integrations.

```ts
import {defaultConfig, simulateConfig, validateConfig} from "@corner-store/toolkit";

const config = validateConfig(defaultConfig());
const simulation = simulateConfig(config);
```

The Toolkit prepares and verifies operator-owned deployment inputs. It never owns
signer custody, submits Safe transactions, or treats ERC-3643/ONCHAINID evidence as
trusted without the configured production checks.

Production onboarding schema v2 may include bounded `elementParameters` entries
with an immutable `elementId` and public ABI-encoded `value`. The Toolkit rejects
unused, duplicate, empty or oversized values, commits them into the compiled plan,
exports parameter-aware Manifest calldata and compares every compiled value during
post-deployment verification. These values are public on-chain policy inputs, not
PII or signer secrets.

See `docs/sdk-integration.md` and `docs/sdk-versioning.md` in the Corner Store
repository for integration, compatibility and migration policy.
