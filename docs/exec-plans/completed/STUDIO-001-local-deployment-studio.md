# STUDIO-001 — Local Deployment Studio

## Goal

Corner Store의 실제 JSON config, CLI, reference DeployStack와 deployment artifact
흐름을 로컬/demo 전용 guided UI로 제공하고 검증된 배포를 기존 Operations
Dashboard로 handoff한다.

## In Scope

1. workspace-confined Local Control API
2. project mode 생성과 config/integration/demo scenario 편집
3. doctor, dry-run, Anvil-only broadcast와 verify command bridge
4. deployment job progress, artifact viewer와 activation checklist
5. 기존 Operations Dashboard handoff
6. API/UI smoke, local Anvil walkthrough와 repository check

## Out of Scope

- production ERC-3643 token onboarding orchestrator
- mainnet/testnet direct broadcast
- browser private key, secret manager 또는 HSM custody
- production Element/Recipe/Manifest mutation editor
- durable RFQ coordinator와 WORM/indexer

## Safety Invariants

- 선택 project는 configured workspace root 밖으로 나갈 수 없다.
- mainnet/testnet broadcast 요청은 server에서 fail-closed한다.
- UI와 persisted JSON은 private key나 secret 값을 받지 않는다.
- `corner-store.scenario.json`은 demo fixture로만 표시한다.
- artifact가 없으면 pre-deploy doctor는 통과할 수 있지만 verify는 통과할 수 없다.
- Operations handoff는 verify 성공 이후에만 활성화한다.

## Execution

1. API path/command guard와 state transition을 smoke test로 고정한다.
2. Local Control API와 project store를 구현한다.
3. guided Studio UI와 artifact/activation 화면을 연결한다.
4. CLI build와 API command bridge를 연결한다.
5. visual review, service smoke와 full repository check를 수행한다.

## Completion Evidence

- temp workspace에서 project create/config save/path escape rejection 통과
- fake runner로 doctor/dry-run/broadcast guard/verify API 통과
- Node 20 built CLI를 사용한 local project doctor와 dry-run 통과
- 별도 Anvil `18545`와 Studio `18991`에서 reference deployment, artifact,
  verify와 Operations handoff walkthrough 통과
- actual Chrome project/doctor/dry-run interaction smoke 통과
- desktop visual verdict `91/100` 통과, mobile viewport overflow 진단 통과
- Node 20 + Foundry v1.7.1 `scripts/check.sh` 통과(Forge `665/665`,
  deploy-v3 `10/10`, 모든 service smoke)
- `git diff --check` 통과
