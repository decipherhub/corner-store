# SDK-004 — Purpose-driven SDK Entry Point

## Goal

외부 사용자가 내부 RFQ mode나 Element/Recipe/Manifest 구조를 먼저 학습하지 않고
목적에 맞는 프로젝트를 만들고 하나의 TypeScript facade에서 정책을 검증, 컴파일,
시뮬레이션, 설명 및 artifact 대조할 수 있게 한다.

## In Scope

1. sandbox, dex-integration, asset-onboarding, rfq-service project templates
2. legacy `--mode` compatibility mapping
3. versioned project descriptor and purpose-specific generated guidance
4. `connectCornerStore()` policy facade with actionable verification output
5. packed clean-project install/build/conformance and facade smoke

## Out of Scope

- #114 full multi-service Docker Compose sandbox
- #115 production OCI/container hardening
- #116 Solidity VenueAdapter starter and venue conformance
- hosted signing, pricing, custody or KYC providers
- registry publishing credentials

## Execution

1. Existing scaffold and package behavior를 regression tests로 고정한다.
2. Purpose template schema and compatibility resolver를 Toolkit에 추가한다.
3. Unified policy facade와 generated project integration을 구현한다.
4. CLI create option, docs and package smoke를 갱신한다.
5. Targeted package tests, clean consumer and repository checks를 실행한다.

## Completion Evidence

- Four purpose templates resolve deterministically without changing legacy mode output.
- Generated projects install and build without repository-relative runtime imports.
- Facade methods share one validated config and deployment artifact source.
- Verification failures include expected, actual and remediation fields.
- Existing local demo, production commands and RFQ module conformance remain passing.
