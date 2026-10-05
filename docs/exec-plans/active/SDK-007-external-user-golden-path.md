# SDK-007 — External User Golden Path Acceptance

## Outcome

소스 저장소 checkout이 없는 외부 사용자가 packed CLI/Toolkit/RFQ package만으로
목적별 프로젝트를 만들고, 같은 명령 체계로 정책을 검증·시뮬레이션·진단하며,
배포 artifact 오류를 스스로 복구할 수 있게 한다.

## In Scope

- `sandbox`와 `dex-integration` clean-project package install/build/conformance
- 생성 프로젝트의 `validate`, `simulate`, `doctor`, `deploy`, `verify` 명령 계약
- sandbox Docker 필수 진단과 library-only Docker 선택 진단
- stale/wrong-profile artifact의 actionable failure와 repair 후 verification
- 정책 값 변경이 compiled commitment와 사용자 설명에 반영되는 acceptance gate
- quickstart, recovery와 testing 문서

## Out of Scope

- production Docker/provider credential 또는 live network submission
- 외부 venue settlement 구현·감사
- 기존 chain/address/code-hash production onboarding 검증 로직의 재구현

## Stop Condition

packed package로 만든 clean sandbox와 DEX integration이 source checkout 없이 동일한
validation contract를 통과하고, Docker/artifact 문제는 remediation을 반환하며,
복구 후 verification과 정책 값 변경 propagation이 자동 acceptance test로 고정되면
완료한다.
