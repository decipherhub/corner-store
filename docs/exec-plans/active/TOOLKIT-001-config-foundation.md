# TOOLKIT-001 — Versioned Config Foundation

## Objective

사용자가 자산 profile과 실행 venue를 고르고, 동일한 설정을 CLI·배포 도구·후속
dashboard가 재사용할 수 있는 첫 Toolkit 경계를 만든다.

## In scope

- schema version이 있는 JSON config 계약
- profile(`buidl-like`/`reg-d`), venue, deployment artifact와 role reference
- 공통 fail-closed validator
- CLI `toolkit-init` / `toolkit-validate`
- read-only `toolkit-simulate`와 profile mismatch 검증
- artifact address/profile/venue를 확인하는 `toolkit-preflight`
- Element/Recipe/Adapter/provider template metadata와 required-input 검증
- package와 CLI smoke test 및 repository check 연결

## Out of scope

- private key 보관·서명·multisig
- 실제 배포 orchestration과 chain mutation
- simulation 결과 계산
- hosted API, indexer와 dashboard
- 법률 정책의 임의 생성 또는 profile별 컨트랙트 fork

## Acceptance

- 잘못된 schema/profile/venue/account 설정은 on-chain transaction 전에 거부된다.
- 배포 artifact와 선택 profile이 다르면 기존 RFQ CLI의 fail-closed binding 규칙을
  유지한다.
- Toolkit과 CLI smoke, `scripts/check.sh`가 통과한다.
- 다음 단계가 이 config를 읽어 validation → simulation → deployment → operation으로
  확장할 수 있도록 문서와 public boundary가 존재한다.

## Next handoff

다음 단계는 이 config를 읽는 deployment preflight와 checkpoint writer를 추가한다.
그 뒤 deploy checkpoint와 operator API가 동일한 artifact/config hash를 사용하도록
연결한다.
