# OPS-002 — Repository-wide CI Parity

## Objective

Pull request CI가 local repository check와 동일한 Foundry 및 developer/operator
service 검증을 실행하도록 한다.

## In scope

- GitHub Actions에서 `scripts/check.sh` 실행
- 모든 npm lockfile을 setup-node cache key에 포함
- clean checkout에서 vendored deploy-v3 dependency 설치
- testing, feature, progress와 quality 문서 정합화

## Out of scope

- live Anvil E2E의 매-PR 실행
- production deployment credentials
- vendored deploy-v3 코드 또는 dependency 변경

## Acceptance

- clean GitHub Actions runner에서 repository-wide check가 통과한다.
- local `scripts/check.sh`가 통과한다.
- `tools/deploy-v3` 격리 경계가 유지된다.

## Result

- GitHub Actions가 `scripts/check.sh`를 단일 repository-wide gate로 실행한다.
- local full check에서 Foundry 582/582, 모든 서비스 smoke와 deploy-v3 10/10이
  통과했다.
- npm과 deploy-v3 dependency는 각 lockfile과 기존 package boundary를 사용한다.
