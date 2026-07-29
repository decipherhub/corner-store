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
현재 reference wiring은 `TokenPolicyRegistry`와 `VenueRegistry` ownership을
`CornerStoreFactory`로 이전하고, Factory owner를 외부 governance 경계로 사용한다.
따라서 Manifest resume/update 예약은 Factory forwarding API를 통해야 하며,
operator는 timelock 뒤 registry에서 실행만 담당한다.

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
- Toolkit 설정은 사람이 주소와 policy binding을 직접 조합하는 대신 versioned JSON으로
  입력하고, CLI와 이후 orchestrator가 동일한 validator를 재사용한다. 자산 profile은
  `buidl-like` 또는 `reg-d`처럼 명시적으로 선택하며 배포 artifact와 충돌하면
  fail-closed한다. 설정에는 governance multisig alias와 required approval 수를 기록하지만
  private key나 signer material은 기록하지 않는다. alias는 배포 환경의 실제
  Safe/multisig 주소로 별도 검증·handoff되어야 한다.

첫 public workflow는 `toolkit-init`으로 기본 설정을 만들고 `toolkit-validate`로
배포 전에 schema/profile/venue/account 설정을 검증하는 것이다. `toolkit-preflight`는
선택된 venue에 필요한 artifact 주소와 profile binding까지 검사한다. 실제 deploy,
simulation, handoff와 dashboard는 이 설정을 읽는 후속 단계이며, CLI가 임의로
on-chain 주소나 compliance policy를 새로 결정하지 않는다.

운영 조회는 `services/operator-api`의 read-only API 경계를 사용한다. API는 private
key나 transaction endpoint를 제공하지 않고, config/deployment snapshot과
normalized event cursor만 노출한다. 온체인 상태가 source of truth이며, 현재
in-memory index는 local/demo용이고 production indexer로 교체할 seam이다.

`services/operator-dashboard`는 이 API를 표시하는 read-only 화면이다. UI는 key를
받거나 transaction을 전송하지 않으며, governance 변경은 별도 multisig proposal로
검토·승인한다. production authentication, CSRF와 multisig provider 연동은 배포
환경의 책임으로 남긴다.

배포 환경에서는 `CORNER_STORE_API_TOKEN`을 설정해 health 이외의 API를 Bearer
token으로 보호한다. token은 config/artifact/event 응답에 포함하지 않으며, 실제
운영에서는 TLS와 외부 identity-aware proxy도 함께 적용해야 한다.
`/metrics`는 Prometheus 형식의 비민감 운영 counters만 제공하며, production scrape
경로도 인증·네트워크 정책 안에 둬야 한다.

배포 전 `toolkit-checkpoint`는 validated config와 deployment artifact의 SHA-256
hash를 immutable checkpoint로 남긴다. checkpoint는 주소·상태 검증을 위한 기록일
뿐이며 secret이나 signer material을 포함하지 않는다. Operator API의 file-backed
event index는 local persistence와 마지막 block cursor를 제공하고, production에서는
재조직(reorg)·finality 정책을 가진 chain indexer로 교체해야 한다.

현재 `FinalityAwareIndexer`는 그 경계의 reference 구현이다. confirmation depth만큼
기다린 block을 저장하고, 이미 finalized로 기록한 block hash가 바뀌면 자동으로
새 이벤트를 덧붙이지 않고 중단한다. rewind/replay 정책은 chain별 운영 설정으로
명시해야 한다.

`toolkit-proposal`은 이 checkpoint hash와 governance calldata를 비교 가능한
draft JSON으로 만들 뿐이다. 서명·제출·승인 상태 변경은 외부 multisig provider의
책임이며, dashboard와 Operator API는 이를 직접 수행하지 않는다.
Toolkit의 Safe transaction draft adapter도 같은 원칙으로 payload만 export하며,
Safe Transaction Service나 wallet provider에 네트워크 요청을 보내지 않는다.

`toolkit-deploy`는 기존 `script/DeployStack.s.sol`을 재사용하는 reference/demo
orchestrator다. 기본 실행은 dry-run이며 `--broadcast`가 없으면 RPC mutation을
하지 않는다. 이 경계는 production signer custody, confirmation/finality 정책과
ownership handoff를 reference demo와 분리한다.

Wave-2 illustrative elements는 기본 demo 배포의 컴파일 그래프와 실행 범위를
불필요하게 키우지 않도록 `tools/deploy-wave2/DeployWave2Elements.s.sol`에서 opt-in으로 배포한다.
이 script는 `ELEMENT_REGISTRY`, `COMPLIANCE_ENGINE`, `IDENTITY_ELEMENT`,
`ACCREDITED_ELEMENT`, `DEPLOYER_PRIVATE_KEY`를 외부 환경에서 받아 요소를 등록하며,
활성 Recipe에 자동으로 추가하지 않는다.

## Open Decisions

- production chain과 confirmation 정책
- 실제 multisig provider, signer custody와 emergency role assignment
- upgradeability
- production source verification, indexer rewind/replay와 disaster recovery

## References

- [`CORNER_STORE_PROFILE.md`](../../tools/deploy-v3/CORNER_STORE_PROFILE.md)
- [`UPSTREAM.md`](../../tools/deploy-v3/UPSTREAM.md)
- [`ROADMAP.md` - Deployment and Operations](../ROADMAP.md#phase-5--deployment-and-operations)
- [`Incident Response Runbook`](../operations/incident-response.md)
