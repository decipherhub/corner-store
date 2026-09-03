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

See `docs/sdk-integration.md` and `docs/sdk-versioning.md` in the Corner Store
repository for integration, compatibility and migration policy.
