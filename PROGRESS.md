# Progress

## Current Status

저장소는 SDK/reference DEX 아키텍처·개발 계획 문서, Foundry product scaffold,
reference execution contracts와 vendored Uniswap v3 배포 도구를 포함한다.

공식 문서는 DEX-level compliance SDK, Corner Store reference DEX,
Element/Recipe/Manifest/Operator 4-Layer와 cumulative multi-Recipe 모델을
source of truth로 사용한다.

## Active Feature

- 없음

## Completed

- `HE-001 — Harness Baseline`
- `DOC-001 — Imported Architecture Alignment`
- `FND-001 — Foundry Product Foundation`
- `RFQ-001 — Reference RFQ Settlement`
- `RFQ-002 — RFQ v2 Hardening`
- `CMP-001 — Reg D 506(c) 9-element Recipe`(illustrative element library + recipe
  9-element 확장, version 2)
- `CMP-002 — Manifest Lifecycle & Operator Approval Flow`(validated state machine,
  setStatus 제거, engine positive-allowlist default-deny, clearUnregulated,
  factory register→approve)
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D007 결정 기록
- legacy mock element(Sanctions A-01, AccreditedInvestor A-03, QualifiedPurchaser
  A-13)의 attestation setter를 `Governed`/`onlyOperator` + 이벤트로 정렬해 CMP-001
  이후 hardening divergence를 닫았다(Lockup C-01은 settable mutator가 없어 변경 없음).
- RFQ integration: RFQ 벤처를 protected router path(`ExecutionRouter → ComplianceEngine
  → RFQAdapter`)로 real ERC-3643 스택 위에서 end-to-end 커버(`test/integration/RFQFlow.t.sol`,
  fill/maker-unapproved/cancel/non-compliant/direct-call bypass 5 시나리오) — RFQ-002 deferred follow-up 완료.
- `E2E-001 — Live Anvil E2E & Demo Runner`(`scripts/e2e-anvil.sh` +
  `script/DeployStack.s.sol` + `script/DemoScenarios.s.sol`): fresh Anvil에 전체 스택
  배포 후 7-scenario demo suite 구동, scenario별 PASS/FAIL. T-REX 배포 코어를
  `test/fixtures/TREXCore.sol`로 추출해 fixture/script 공유. src/ 변경 없음. runbook은
  `docs/demo.md`.
- `CLI-001 — corner-store Reference CLI`(`services/cli/` + `script/KycInvestor.s.sol`):
  live 노드 대상 인터랙티브 CLI(status/onboard/manifest/attest/investor-setup/kyc/
  buy/rfq-quote/rfq-cancel/maker/reason). ethers 기반, services/rfq EIP-712 서명
  라이브러리 재사용, reason-table 자동 디코딩. src/ 변경 없음(신규 Solidity는 KYC
  forge 스크립트 하나). smoke + fresh-account live walkthrough로 검증. README는
  `services/cli/README.md`.

## Blocked

- 없음

## Next

1. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
2. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
3. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.
4. CI hardening(static analysis 등)을 강화한다.

## Last Session Summary

- `CLI-001` (corner-store Reference CLI)을 landing했다. src/ 제품 코드 변경 없이
  `services/cli/` TypeScript CLI + `script/KycInvestor.s.sol` 하나로 live 노드
  인터랙티브 클라이언트를 구현했다.
- 변경한 파일:
  - CLI: `services/cli/`(package.json/tsconfig, `src/`: index/config/abi/reason/
    elements/rfq/util/commands, `test/smoke.ts`, README.md)
  - script: `script/KycInvestor.s.sol`(이미 배포된 ERC-3643 스택에 re-bind해 신규
    투자자 identity+KYC claim, shared `TREXCore` 재사용)
  - config: `.gitignore`(`services/cli/dist`,`node_modules`)
  - docs/bookkeeping: `docs/demo.md`("CLI로 직접 해보기"), `FEATURES.md`(CLI-001),
    `PROGRESS.md`
- 설계 요점:
  - chain 상호작용은 ethers(services/rfq에는 web3 라이브러리가 없어 CLI가 유일 도입).
    EIP-712 quote는 services/rfq `RFQQuoteService`를 ethers wallet TypedDataSigner로
    감싸 재사용. ABI는 `src/abi.ts` hand-written fragment(out/ 비의존).
  - reason 디코딩 테이블은 `(recipe∈{1,2,7})×(11 element)×code1` + `encode(0,"POLICY",
    status)`를 오프라인 사전계산; `cast keccak` ground-truth로 smoke에서 대조.
  - admin 명령은 operator(account 0), buy는 buyer로 signer 기본값을 분기. 동일 명령
    내 연속 tx는 ethers `NonceManager`로 RPC pending-nonce 레이스 방지.
  - `kyc`는 forge cwd를 repo root로 설정하고 artifact를 root-상대 경로로 전달해
    fs_permissions/스크립트 경로를 만족. `investor-setup`은 C-01 acquisition source를
    t=1로 seed(recipe 1이 C-01 요구).
- 실행한 명령:
  - `npm run build` / `npm test`(services/cli)
  - `forge test --offline`
  - `anvil` + `forge script DeployStack` + 전체 CLI walkthrough(account 4)
- 통과한 검증:
  - `services/cli` smoke ok(reason ground-truth 대조 + quote round-trip).
  - live walkthrough: onboard→investor-setup→kyc→buy PASS(+100), jurisdiction ZZ→
    buy FAIL(A-02 decoded), suspend→buy FAIL(POLICY SUSPENDED), resume→buy PASS,
    rfq-quote→rfq buy PASS(+200), maker revoke→rfq buy FAIL(RFQMakerNotApproved).
    전 실패 경로 non-zero 종료.
  - `forge test --offline` 238/238 유지(KycInvestor 추가 후에도 green).
- 남은 리스크:
  - `kyc`는 repo root 실행 전제(문서화). anvil 외 chainId/네트워크는 미검증(31337 고정).
  - buy amount는 ether 단위 파싱(18 decimals) 가정; 비-18-decimals 토큰은 미지원.
  - 나머지 스택 리스크는 E2E-001 세션의 것과 동일(MockPool AMM, C-01 mock source 등).
