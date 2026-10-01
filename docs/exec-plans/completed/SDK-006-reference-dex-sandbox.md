# SDK-006 — Reference DEX Sandbox

## Goal

`corner-store create <target> --template sandbox`가 저장소 checkout 없이 실행 가능한
로컬 reference DEX 프로젝트를 생성하고, 사용자가 `docker compose up --build` 한 번으로
Anvil, demo deployment, RFQ backend, Operator API/dashboard와 Deployment Studio를 실행한다.

## In scope

1. 기존 CLI, Toolkit, RFQ와 UI 서비스 source를 package-safe allowlist로 번들링한다.
2. pinned Node/Foundry multi-stage image, non-root runtime, healthcheck와 종료 정책을 생성한다.
3. Anvil readiness → one-shot deployer success → artifact-bound service readiness 순서를 강제한다.
4. `buidl-like` 기본 fixture와 `reg-d` opt-in fixture를 같은 scaffold에서 선택한다.
5. clean generated project smoke와 Compose config validation을 추가한다.
6. SDK 문서, `FEATURES.md`, `PROGRESS.md`를 현재 동작과 일치시킨다.

## Out of scope

- production credential, hosted RPC, external TA/KYC 또는 custody 연결
- reference 서비스의 production hardening 주장
- existing non-Docker local Anvil/GIWA flow 변경
- Docker/Foundry/Node upstream source의 vendoring

## Verification

- `npm test --prefix services/toolkit`
- `npm test --prefix services/cli`
- generated clean project build and scaffold assertions
- `docker compose config` and sandbox runtime smoke when Docker is available
- `scripts/check.sh`
- `git diff --check`

## Result

- Packed CLI clean-project sandbox generation, build and conformance passed.
- BUIDL-like and Reg D profiles each completed a fresh live Compose deployment.
- Anvil, RFQ, Operator API, portal and Deployment Studio became healthy only after
  the one-shot deployer exited successfully; the RFQ state was bound to the selected
  profile and live Router artifact.
- Full repository checks passed, including Foundry 950/950 and deploy-v3 10/10.
