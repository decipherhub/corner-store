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
- `DEMO-001 — BUIDL-like ERC-3643 Demo Asset`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton

## Blocked

- 없음

## Next

1. RFQ production hardening은 별도 feature로 분리한다: dealer/operator approval,
   custody, quote cancellation, partial fill 정책.
2. production Asset Compliance Manifest lifecycle/schema와 operator approval flow를
   구현한다.
3. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다.
4. live Anvil deployment/E2E와 security threat model을 추가한다.
5. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- 변경한 파일:
  - `test/fixtures/MockSecuritizeTA.sol`
  - `test/integration/IntegrationBase.sol`
  - `test/integration/BUIDLLikeFlow.t.sol`
  - `docs/product-specs/buidl-like-demo-profile.md`
  - `FEATURES.md`
  - `PROGRESS.md`
- 완료한 작업:
  - 실제 Securitize/TA 연결 없이 `MockSecuritizeTA` fixture로 investor facts를 주입하는 경계 추가
  - BUIDL-like flow test가 AI/QP/sanctions/KYC setup을 직접 Element에 쓰지 않고 mock TA profile sync를 통해 설정하도록 변경
  - TA profile expiry가 지난 경우 current eligibility로 sync하지 않고 token movement 전에 reject되는 테스트 추가
  - unverified recipient rollback 테스트도 TA-derived engine flags는 통과하지만 ERC-3643 registry verification이 빠진 경우로 명확화
  - profile spec에 real BUIDL/Securitize integration이 아니라 mock TA 기반 compliance validation fixture임을 명시
- 실행한 명령:
  - `forge fmt src/demo/BuidlLikeDemoAsset.sol test/fixtures/MockSecuritizeTA.sol test/integration/IntegrationBase.sol test/integration/BUIDLLikeFlow.t.sol docs/product-specs/buidl-like-demo-profile.md FEATURES.md PROGRESS.md`
  - `forge fmt --check src/demo/BuidlLikeDemoAsset.sol test/fixtures/TREXSuite.sol test/fixtures/MockSecuritizeTA.sol test/integration/IntegrationBase.sol test/integration/BUIDLLikeFlow.t.sol src/compliance/elements/BuidlMinimumInvestment.sol src/compliance/recipes/BuidlLikeFundRecipe.sol test/unit/compliance/BuidlLikeFundRecipe.t.sol`
  - `forge test --offline --match-path test/integration/BUIDLLikeFlow.t.sol -vv`
  - `forge test --offline --match-path test/unit/compliance/BuidlLikeFundRecipe.t.sol -vv`
  - `forge test --offline`
- 통과한 검증:
  - BUIDL-like profile metadata/Manifest/profile hash 확인
  - mock TA 기반 QP buyer protected-router trade 성공
  - non-QP, sanctioned, minimum investment 미만, expired TA profile, ERC-3643-unverified recipient reject/rollback 검증
  - 전체 Foundry 테스트 133개 통과
- 남은 리스크:
  - 실제 BlackRock BUIDL/Securitize/TA 연결은 구현 범위가 아니다.
  - AI/QP는 아직 production ONCHAINID claim이 아니라 mock TA에서 sync되는 test flag다.
  - NAV, redemption rail, monthly distribution, production claim issuer 연동은 별도 feature다.
## Previous Session Summary

- 변경한 파일:
  - RFQAdapter, RFQQuote type, RFQ-specific errors
  - RFQAdapter Foundry tests
  - `services/rfq` 최소 TypeScript quote signer reference
  - RFQ v1 scope/non-goals 문서
- 실행한 명령:
  - `forge build`
  - `forge test --offline --match-path test/unit/execution/RFQAdapter.t.sol -vv`
  - `cd services/rfq && npm test`
  - `git diff --check`
  - `scripts/check.sh`
- 통과한 검증:
  - RFQAdapter compile
  - valid signed quote settlement
  - invalid signature, expired quote, replay, wrong taker, mismatch, direct bypass,
    compliance rejection 거부
  - RFQ service typed-data/smoke check
  - 전체 repo check 통과
- 남은 리스크:
  - production dealer approval, custody, quote cancellation, partial fill은 RFQ v1
    범위 밖이다.
  - production Manifest lifecycle과 acquisition/lot source는 아직 결정·구현 전이다.
  - live deployment/E2E와 static analysis는 아직 부족하다.
  - production Element와 engine 허용 조건은 법률 승인 전 활성화할 수 없다.
