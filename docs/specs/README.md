# Specs

Versioned product specification drafts that are not yet accepted architecture.

A document here describes a proposed format or protocol while it is still being
reviewed. Accepted decisions live in `DECISIONS.md`, and settled architecture
lives under `docs/architecture/`.

## Conventions

- One file per spec, named `<topic>-v<major>.<minor>.md`.
- Keep the filename stable within a major/minor; revisions to the same draft
  edit the file in place and record the change in a revision log inside it.
- A spec moves out of this directory once it is accepted; leave a pointer
  behind rather than a copy.

## Current drafts

- `decision-receipts-v0.1.md` — receipts binding each gated decision to its
  rule version, the evidence it relied on and the outcome. Tracks issue #139.
  Scoped to the hackathon branch; not part of the supported product surface.
