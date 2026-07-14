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
- `DOC-002 — RFQ SDK and MVP Demo Planning`
- `RFQ-SDK-001 — RFQ Backend SDK Interfaces`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton
- router now rejects requests whose `context.venueType` mismatches the registered
  `VenueConfig.venueType` (closes the PR-12 review medium finding)
- RFQ-002: operator-curated maker approval allowlist(`setMakerApproved`,
  `RFQMakerNotApproved`), maker-initiated nonce-scoped idempotent cancellation
  (`cancelQuoteNonce`/`cancelQuoteNonces`, `RFQQuoteCancelled`), venueType binding
  fix, `docs/rfq-threat-model.md` 위협 모델과 D008 결정 기록
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
- `CLI-002 — corner-store CLI v2`(`services/cli/**` + 문서만, 제품 코드/스크립트 변경
  없음): preflight `check`(per-element + engine verdict, asset-side 라벨, rejected면
  exit 1), AMM `sell`, `balances`, 이벤트 tail `watch`, `faucet`, anvil
  `snapshot`/`restore`, `quote-inspect`(서명자 복구/만료/nonce·승인, 실패 시 exit 1).
  reason 디코딩·EIP-712 복구는 기존 lib 재사용. smoke(quote-inspect valid+tampered) +
  full live walkthrough로 검증. `forge test --offline` 238/238 유지.

## Blocked

- 없음

## Next

1. MVP RFQ demo backend milestone/user flow를 별도 문서·feature로 구체화한다.
   기존 live-Anvil E2E/CLI 경로를 재사용한다.
2. pending RFQ/E2E/CLI/BUIDL PR stack(#35)이 머지된 뒤
   roadmap과 feature 상태를 재조정한다.
3. 남은 RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
4. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다
   (C-01 Lockup은 현재 fixture-only mock acquisition source).
5. 실제 Uniswap v3 pool 배포를 demo/E2E에 연결한다(현재 AMM venue는 MockPool;
   `tools/deploy-v3` vendor isolation 유지).
6. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- #30 merge preparation includes `CLI-002` (corner-store CLI v2) on top of current main. src/·script/ 변경 없이 `services/cli`에
  명령 7개(check/sell/balances/watch/faucet/snapshot/restore/quote-inspect)를 더했다.
- 변경한 파일:
  - CLI: `services/cli/src/`(abi/config/rfq/commands/index), `services/cli/test/smoke.ts`,
    `services/cli/README.md`
  - docs/bookkeeping: `docs/demo.md`, `FEATURES.md`(CLI-002), `PROGRESS.md`
- 설계 요점:
  - `check`는 active manifest의 recipe → `requiredElements()` → element `check()`를
    eth_call로 돌려 per-element PASS/FAIL을 만들고 `engine.evaluate`(view)로 verdict를
    낸다. 엔진이 `ctx.buyer`만 스크리닝하므로 subject 무시 원소(B-01/B-02/E-01)를
    `[asset-side]`로 표기. FAIL reason은 recipe-aware code로 디코딩(엔진이 낼 코드와 동일).
  - `sell`은 `SwapFlow.t.sol::test_sell_shaped_success`의 컨텍스트(ctx.buyer=매도자,
    tokenIn=RWA/tokenOut=QUOTE, venueData=zeroForOne=false)를 그대로 미러링.
  - `watch`는 `eth_getLogs`(address+topic0 OR 필터) 폴링. reasonCode는 reason-table →
    recipe-0 monitoring-flag(`encode(0,elementId,1)`, SurveillanceFlag) → bytes32 라벨
    순으로 디코딩; ManifestStatusChanged status·SurveillanceFlag elementId도 사람이 읽게.
  - EIP-712 복구는 services/rfq lib의 `domain`+`RFQ_QUOTE_TYPES`로 `verifyTypedData`
    (타입 문자열 재선언 없음). ABI는 계속 hand-written fragment(out/ 비의존).
- 실행한 명령:
  - `npm run build` / `npm test`(services/cli)
  - `scripts/e2e-anvil.sh --keep` + 전체 CLI v2 walkthrough(account 4)
  - `forge test --offline`
- 통과한 검증:
  - smoke ok: quote-inspect 서명자 복구(valid=maker / tampered≠maker) + reason 회귀.
  - live walkthrough: fresh `check`(A-02/A-03/A-04/C-01 FAIL, exit 1) → setup+kyc →
    `check`(전 PASS) → faucet → buy(+100) → sell 40(RWA-40/QUOTE+40) → balances 전후 →
    snapshot(0x11) → attest ZZ → `check`(A-02 하나 FAIL, exit 1) → restore → `check`(green)
    → watch --from 0(세션 이벤트 디코딩 재생) → rfq-quote → quote-inspect(PASS) → 변조 →
    quote-inspect(signature FAIL, exit 1).
  - `forge test --offline` 238/238 유지(Solidity 변경 없음).
- 남은 리스크:
  - manifest는 데모가 recipe 7(Reg D + Surveillance, 10 원소)로 onboarding한 상태라
    `check`가 10개 원소를 매긴다(recipe 1이면 9개). 재배포 시 recipe에 따라 달라짐.
  - `snapshot`/`restore`는 anvil 전용. 셸에서 id 캡처 시 `snapshot id:` 라인만 파싱할 것
    (도움말의 "snapshot ids" 문구가 느슨한 grep에 걸릴 수 있음).
  - amount는 ether 단위(18 decimals) 가정. 나머지 스택 리스크는 CLI-001/E2E-001과 동일.
