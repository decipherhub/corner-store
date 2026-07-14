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
- `DOC-002 — RFQ SDK and MVP Demo Planning`
- `RFQ-SDK-001 — RFQ Backend SDK Interfaces`
- multi-venue 아키텍처와 책임 문서 작성
- Corner Store용 Uniswap v3 최소 배포 profile 분리와 테스트
- ExecutionRouter/VenueRegistry/VenueSelector와 AMM reference adapter skeleton

## Blocked

- 없음

## Next

1. MVP RFQ demo backend milestone/user flow를 별도 문서·feature로 구체화한다.
   PR #29/#30이 머지되면 기존 live-Anvil E2E/CLI 경로를 재사용한다.
2. pending RFQ/E2E/CLI/BUIDL PR stack(#24/#28/#29/#30/#35)이 머지된 뒤
   roadmap과 feature 상태를 재조정한다.
3. 남은 RFQ production policy를 별도 feature로 분리한다: custody, partial fill,
   production dealer/operator 책임.
4. production Asset Compliance Manifest lifecycle/schema와 operator approval flow를
   구현한다.
5. acquisition/lot data source와 holding-period Recipe 활성화 조건을 결정한다.
6. Order Book은 matching/custody/surveillance 모델 결정 후 구현한다.

## Last Session Summary

- 변경한 파일:
  - `services/rfq/src/types.ts`
  - `services/rfq/src/quoteService.ts`
  - `services/rfq/src/reference.ts`
  - `services/rfq/src/validation.ts`
  - `services/rfq/src/index.ts`
  - `services/rfq/test/smoke.ts`
  - `services/rfq/README.md`
  - `services/rfq/package.json`
  - `README.md`
  - `docs/architecture/venues/README.md`
  - `docs/product-specs/rfq-backend-sdk-and-demo.md`
  - `docs/product-specs/index.md`
  - `docs/testing.md`
  - `FEATURES.md`
  - `PROGRESS.md`
- 완료한 작업:
  - low-level `RFQQuoteService.createSignedQuote` 호환성을 유지하면서 high-level `createRFQService(...).quote(...)` API 추가
  - signer, nonce store, pricing provider, inventory/risk check interface 추가
  - local/demo reference component(`InMemoryNonceStore`, `FixedRatePricingProvider`, `NoopInventoryRiskCheck`) 추가
  - address, chainId, TTL, on-chain integer validation helper 분리
  - SDK quick start와 production responsibility boundary 문서화
  - smoke test를 SDK quote flow, nonce uniqueness, unsafe number, invalid request, risk reject-before-signing까지 확장
- 실행한 검증:
  - `cd services/rfq && npm test`
  - `scripts/check.sh`
- 남은 리스크:
  - 아직 MVP HTTP/CLI backend는 구현하지 않았다.
  - production signer custody, persistent nonce store, pricing, inventory/risk는 integrator/operator 책임이다.
  - pending PR #24/#28/#29/#30/#35 merge 이후 roadmap/feature 상태 재조정이 필요하다.
