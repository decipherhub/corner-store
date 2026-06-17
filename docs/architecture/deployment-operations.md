# Deployment & Operations Layer

## Responsibility

이 레이어는 Uniswap v3 인프라와 Corner Store 컨트랙트를 반복 가능하게 배포하고,
주소·설정·권한·Asset Compliance Manifest snapshot hash를 검증 가능한 **deployment manifest**로 관리한다.
이 문서의 deployment manifest는 Asset Compliance Manifest와 다른 배포 산출물이다.

핵심 질문은 다음과 같다.

> 어떤 코드와 설정을 누가 배포했고, 현재 어떤 주소와 권한이 활성 상태인가?

## Owned Components

- vendored `tools/deploy-v3`
- Corner Store Foundry deployment scripts
- 상위 deployment orchestrator
- network별 versioned manifest
- preflight와 post-deploy verification
- ownership/role handoff
- source verification
- indexer, monitoring, incident runbook

## Tool Boundaries

- `tools/deploy-v3`: Uniswap v3 AMM 인프라
- Foundry scripts: Registry, Engine, Router, Adapter, venue onboarding
- Orchestrator: 두 결과 결합, 검증, checkpoint, 권한 이전

Corner Store 프로필 호출 API는 실제 AMM 통합 배포 소비자가 생길 때 추가한다.
기존 upstream CLI 동작은 유지하고 상위 코드가 내부 migration 파일을 직접 조합하지
않도록 최소 public boundary를 제공한다.

## Deployment Sequence

1. network, chain ID, signer, dependency, final owner preflight
2. Uniswap v3 Corner Store profile 배포 또는 기존 checkpoint 검증
3. Corner Store core와 Adapter 배포
4. venue 주소 계산 및 IdentityRegistry 등록 preflight
5. venue 생성과 Registry 등록
6. policy 및 Adapter 활성화
7. bytecode, getter, role, E2E smoke test
8. final owner/multisig로 ownership과 role 이전
9. immutable manifest 확정

owner-only 설정과 검증이 끝나기 전에 ownership을 이전하지 않는다.

## Deployment Manifest Requirements

manifest에는 최소한 다음 정보가 있어야 한다.

- schema version과 deployment ID
- chain ID와 network
- source commit과 배포 시각
- deployer와 final owner
- Uniswap v3 profile과 주소
- Corner Store core, Adapter, venue 주소
- implementation code hash와 transaction hash
- role assignment
- Asset Compliance Manifest registry 주소와 snapshot hash

비밀키, mnemonic, API key는 기록하지 않는다.

```text
deployments/
└── <chain-id>/
    ├── latest.json
    └── <deployment-id>.json
```

deployment ID 파일은 immutable하게 보존한다.

## Invariants

- 재실행 시 저장된 주소의 bytecode와 config를 검증한 뒤 단계를 건너뛴다.
- 부분 실패 후 마지막 검증된 checkpoint에서 재개할 수 있어야 한다.
- manifest와 on-chain owner/role/config가 일치해야 한다.
- deployer의 임시 권한은 handoff 후 제거한다.
- production manifest를 덮어쓰지 않는다.
- 배포 대상과 제외 기능은 Corner Store deployment profile과 일치해야 한다.

## Current Decisions

- Uniswap v3는 vendored `deploy-v3`의 최소 Corner Store profile로 배포한다.
- `SwapRouter02`, Migrator, Staker, 1bp fee tier는 현재 기본 범위가 아니다.
- Corner Store 제품 컨트랙트는 Foundry로 관리한다.
- 통합 manifest가 모든 도구의 결과를 연결한다.

## Open Decisions

- manifest JSON schema와 validation 도구
- orchestrator 구현 언어와 signer interface
- production chain과 confirmation 정책
- multisig, governance, emergency role
- upgradeability
- source verification과 indexer 운영 방식

## References

- [`CORNER_STORE_PROFILE.md`](../../tools/deploy-v3/CORNER_STORE_PROFILE.md)
- [`UPSTREAM.md`](../../tools/deploy-v3/UPSTREAM.md)
- [`ROADMAP.md` - Deployment and Operations](../ROADMAP.md#phase-5--deployment-and-operations)
