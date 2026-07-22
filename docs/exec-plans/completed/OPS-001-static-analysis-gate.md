# OPS-001 — High-severity Solidity Lint Gate

## Objective

Production Solidity에서 Foundry high-severity lint warning이 새로 유입되면 local
check와 CI가 즉시 실패하도록 한다.

## In scope

- production `src` high-severity lint gate
- 현재 발견된 venue bitmask shift 수정
- local check, CI, testing/quality 문서 정합화

## Out of scope

- test fixture의 medium/low warning 일괄 정리
- Slither 등 신규 분석 dependency
- 제품 동작이나 compliance policy 변경

## Acceptance

- `forge lint --severity high --deny warnings src`가 warning 없이 통과한다.
- 전체 Foundry 테스트와 repository check가 통과한다.
- CI가 같은 lint 명령을 실행한다.
