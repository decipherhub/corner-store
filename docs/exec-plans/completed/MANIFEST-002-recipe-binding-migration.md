# MANIFEST-002 — RecipeBinding Manifest Migration

## Goal

ADR-007의 multi-Recipe 결정을 실제 registry/engine ABI로 옮기고 고정된
`issuanceRecipeId + fundRecipeId` 한계를 제거한다.

## In Scope

- bounded `RecipeBinding[]` 저장, 조회와 lifecycle update
- REQUIRED AND, path-group OR/그룹 간 AND, FLAG_ONLY non-blocking finding
- deterministic blocking reason selection과 binding-index flag bitmap
- Factory, demo, CLI, Toolkit ABI/config와 tests migration
- pair evaluation와 stateful commit 보존

## Out of Scope

- canonical `bytes32 recipeKey` alias registry
- per-element default action/override compiler
- pending operator-review settlement
- production legal Recipe 승인

## Steps

1. 기존 two-recipe 동작과 새 binding truth table을 regression test로 고정한다.
2. core type, registry lifecycle와 Factory ABI를 migration한다.
3. engine evaluation/commit을 bounded binding plan으로 교체한다.
4. CLI/demo/config/docs를 새 ABI에 맞춘다.
5. targeted/full tests와 두 live profile E2E를 통과한다.

## Completion Evidence

- required failure blocks and all required pass.
- each path group requires one passing applicable option.
- flag-only failure sets a stable bit without blocking.
- flag-only stateful hooks cannot enter the trade-critical commit path.
- invalid/oversized/duplicate bindings and version mismatch fail closed.
- delayed binding update changes version/history only after activation.
- existing BUIDL-like and Reg D AMM/RFQ flows remain green.
