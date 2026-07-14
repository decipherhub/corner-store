# BUIDL-like ERC-3643 Demo Profile

## Status

Current demo profile; not real BlackRock/Securitize BUIDL integration.

## Purpose

This profile lets the Giwa MVP demonstrate how a BUIDL-like regulated fund asset can trade through Corner Store's protected Router path using the existing ERC-3643/T-REX fixture and the Corner Store Manifest/Recipe/Element model.

The goal is to prove the product flow, not to claim production compatibility with the real BUIDL token.

## Current implementation

- Demo profile: `src/demo/BuidlLikeDemoAsset.sol`
- Integration fixture: `test/integration/BUIDLLikeFlow.t.sol`
- ERC-3643/T-REX harness: `test/fixtures/TREXSuite.sol`

The demo deploys a standard ERC-3643/T-REX token with BUIDL-like metadata:

- token name: `BUIDL-like ERC-3643 Demo Asset`
- token symbol: `bBUIDL`
- issuance recipe: Reg D 506(c)
- fund recipe: ICA 3(c)(7)
- fund applicability: `factsPacked` bit 0
- supported execution engine: AMM in the current fixture

## Compliance model

The current profile intentionally keeps BUIDL-specific behavior out of token override code.

```text
BUIDL-like asset facts
  -> ManifestCore
  -> Recipe binding
  -> Element checks
  -> Router-protected execution
  -> ERC-3643 transfer-time verification
```

Current demo checks:

- KYC/identity verification through the ERC-3643/T-REX fixture
- sanctions clear through `A-01-v1`
- accredited investor through `A-03-v1`
- qualified purchaser through `A-13-v1`
- ERC-3643 recipient verification at token transfer time

## DS Protocol / Securitize mapping

Public Securitize DS Protocol material describes a Compliance Service style boundary around token operations, including validation / pre-transfer checks. Corner Store should not replace its ERC-3643 identity model with DS-specific internals. The integration boundary should be an adapter.

| DS / TA concept | Corner Store demo equivalent |
| --- | --- |
| DSToken / permissioned token | ERC-3643/T-REX token fixture |
| Compliance Service | Corner Store `ComplianceEngine` + ERC-3643 transfer-time checks |
| pre-transfer validation | Router `evaluate()` before adapter execution + token `canTransfer` during settlement |
| Wallet / whitelist manager | ERC-3643 `IdentityRegistry` + ONCHAINID claims |
| TA / trusted verification source | ERC-3643 `TrustedIssuersRegistry` / TrustedIssuer fixture |
| investor eligibility facts | claim topics consumed by Elements |
| audit / reliance context | decision hash, reason code, events, future reliance log |

## Claim topics

The demo follows the PD-4 direction: use ERC-3643-compatible claim topics and a TrustedIssuer-style pipeline rather than inventing a separate identity model.

Initial project-level topics used by the profile:

- `KYC = keccak256("CORNER_STORE.KYC")` in the T-REX fixture
- `ACCREDITED_INVESTOR = 1001`
- `QUALIFIED_PURCHASER = 1002`

The current AI/QP Elements still use settable test flags. Production refinement should replace those flags with ONCHAINID claims carrying issuer, topic, issuedAt, expiresAt, and revocation/freshness semantics.

## Demo acceptance cases

The BUIDL-like profile should demonstrate:

1. metadata and Manifest binding are correct
2. QP buyer can buy through the protected Router
3. accredited but non-QP buyer is rejected before token movement
4. sanctioned QP buyer is rejected before token movement
5. QP/accredited but ERC-3643-unverified recipient rolls back during token settlement

## Non-goals

- real BlackRock BUIDL deployment compatibility
- real Securitize issuer address / topic mapping
- production claim expiry and revocation integration
- NAV oracle integration
- redemption rail implementation
- monthly distribution rail implementation
- production transfer-agent agreement or legal reliance opinion

## Follow-up work

- Implement ONCHAINID-backed AI/QP claim fixtures.
- Add claim expiry/freshness tests.
- Add Securitize/DS adapter research issue once official/current integration details are available.
- Split primary distribution, secondary DEX execution, redemption, and monthly distribution rails.
- Promote BUIDL-like profile data into the future Manifest compiler/onboarding flow.

## References

- Securitize DS Protocol Compliance Service article: https://medium.com/securitize/ds-protocol-the-compliance-service-b6fe472d625d
- User-provided verified/source browser reference for BUIDL-like DSToken inspection: https://vscode.blockscan.com/ethereum/0x603bb6909be14f83282e03632280d91be7fb83b2
