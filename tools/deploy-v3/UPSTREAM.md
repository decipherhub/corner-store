# Upstream

## Source

- Repository: https://github.com/Uniswap/deploy-v3.git
- Commit: `b7aac0f1c5353b36802dc0cf95c426d2ef0c3252`
- Imported: 2026-06-05
- License: GPL-3.0-or-later

## Local Ownership

This directory is vendored into the Corner Store repository.

The nested Git metadata was removed so that all files are tracked by the
Corner Store repository.

## Modification Policy

- Preserve `LICENSE` and upstream attribution.
- Keep upstream deployment behavior unchanged unless Corner Store requires it.
- Document significant deviations from upstream below.
- Compare future upstream updates against the pinned commit before importing.

## Local Changes

- Split the fixed migration list into exported Corner Store and upstream step
  sets while keeping the CLI on the original upstream sequence.
- Added unit coverage for the contents and dependency order of both step sets.
- Documented the Corner Store profile decisions, excluded upstream features,
  reintroduction conditions, compliance limitations, and future integration
  direction in `CORNER_STORE_PROFILE.md`.

## Corner Store Profile Maintenance

- Treat `CORNER_STORE_PROFILE.md` as the decision record for profile scope.
- When importing upstream changes, compare both exported step sets against the
  pinned upstream sequence.
- Do not assume that omitting `SwapRouter02` prevents direct interaction with a
  standard Uniswap v3 pool. Compliance enforcement must also exist in an
  unavoidable token or venue boundary.
- Record the requirement and tests before adding an optional upstream step to
  `CORNER_STORE_MIGRATION_STEPS`.
