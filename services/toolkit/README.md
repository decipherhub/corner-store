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

## Policy audit artifacts

The Toolkit exports a strict canonical `PolicyAuditArtifact`, deterministic
domain-separated SHA-256 commitments, a `PolicyAuditStore` port and a local
content-addressed reference adapter. Production onboarding schema v4 requires a
reviewed artifact to be stored and re-read before unsigned activation drafts can
be rendered. It cross-checks policy, Element/Recipe and deployment commitments;
the artifact digest becomes `ManifestCore.fullManifestHash`.

`LocalPolicyAuditStore` is not a hosted service or production WORM guarantee.
Operators must provide durable retention, replication, access control and recovery
for production. See `docs/policy-audit.md` in the repository.
