# Identity P2 delivery schedule

Issue #159 decisions 24, 26, 27 and 29 are scheduled as four separate PRs in
the November plan, after DATA-004's P1 delivery. These are local planned PR
slots, not opened PRs or implemented features. No external publication or
deployment is implied. Calendar dates and assignees remain for team confirmation.

| Order / planned PR | Issue wording | Scope and dependency | Required acceptance evidence |
| --- | --- | --- | --- |
| November 1: Member identity topology | Decision 24: "KYC topology - P2" | Full MEMBER institution approval, wallet membership and member attestation that it verified the end investor. Builds on D031's explicit per-recipe declaration. RFQ has no default; TSV stays DIRECT. | Missing/unapproved/revoked membership or attestation fails closed; wallet-level sanctions run in DIRECT and MEMBER; registration, updates and mixed bindings cannot bypass the identity gate. |
| November 2: Venue identity pseudonyms | Decision 26: "P2, needed before any TSV launch" | Venue-specific pseudonymous identity IDs with wallet-to-identity mapping held off-chain by the operator. Builds on D033's keyed commitments; must land before any TSV launch. | Same identity resolves consistently inside one venue, differs across venues, cannot trade against itself and cannot leak the private mapping through calldata, events, artifacts, logs or API responses. |
| November 3: Settlement-asset cards | Decision 27: "P1 (check), P2 (cards)" | Add issuer, AML-owner label (issuer / VASP), and issuer freeze scope (send only / send and receive) to separately reviewed settlement-asset metadata and presentation. D034's existing Router binding remains the P1 baseline. | Versioned card round trips and validation for every label/freeze scope; missing/unknown values cannot imply verified coverage; RFQ v2/v3 and AMM settlement-binding regressions remain passing. |
| November 4: Jurisdictional sanctions bundles | Decision 29: "Jurisdictional sanctions lists - P2" | Separately deployed opt-in A-01-v2 with recipe-selected list bundles and `(listId, version)` entries. D036 fixes TSV's mandatory OFAC membership. A local SDN-file import is sufficient; oracle/vendor integration is optional. | Updating one list independently invalidates only its stale claims; missing required-list claims fail closed; TSV bundle creation and updates reject omitted/removed OFAC. Preserve A-01-v1 and existing recipes. |

The quoted issue labels use a hyphen in place of the issue's punctuation.
Each row requires its own reviewed spec, tests and PR. These slots do not make
four additional features active alongside DATA-004. MEMBER stays rejected until
its implementation lands; schema 7's TSV track label alone does not establish
TSV launch readiness. Key management, key rotation, KMS/HSM, multisig, custody,
production providers and a full Decision Receipts implementation remain deferred.

The sanctions design must commit the selected list identities and versions
through versioned policy parameters, retain wallet screening in both topologies,
and preserve per-list stale-claim failure semantics. OFAC cannot be disabled by
an empty bundle, an update or an alternative recipe on the TSV track. Detailed
ABI/storage choices belong to that PR; DATA-004 changes no sanctions contract.
