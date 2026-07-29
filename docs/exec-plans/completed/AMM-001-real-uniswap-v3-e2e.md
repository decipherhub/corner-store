# AMM-001 — Canonical Uniswap v3 Pool E2E

## Goal

현재 MockPool 기반 AMM 증명에 canonical Uniswap v3 factory/pool의 실제 CREATE2,
mint callback과 swap callback 경로를 추가한다.

## In Scope

- isolated deploy-v3 dependency의 canonical core artifact 사용
- factory/pool deployment와 CREATE2 address preflight
- ERC-3643 pool identity onboarding, pool initialization과 test liquidity
- Router-protected exact-input buy/sell 및 atomic rejection regression
- callback origin, adapter non-custody와 documentation updates

## Out of Scope

- vendored Uniswap source의 제품 코드 복사 또는 수정
- production LP custody, fee-tier/legal approval와 price/oracle policy
- unified multi-module deployment CLI와 testnet/mainnet deployment
- standard pool direct-call을 막는다는 보장

## Steps

1. canonical artifact를 사용하는 deterministic factory/pool fixture를 만든다.
2. 실제 pool에 ERC-3643 identity와 liquidity를 준비한다.
3. Router/Adapter buy·sell 및 rejection/callback 회귀를 추가한다.
4. dependency bootstrap과 developer/runbook 문서를 정렬한다.
5. targeted tests와 repository-wide check를 통과한다.

## Completion Evidence

- computed CREATE2 pool address equals the deployed address.
- canonical pool mint/swap callbacks move real ERC-3643 and quote balances.
- compliance rejection occurs before pool balances move.
- unregistered callback/pool cannot pull funds.
- Router and Adapter finish swaps without custody balances.
