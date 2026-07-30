# SDK-001 — Modular Integration and Deployment Toolkit

## Goal

Corner Store를 채택하는 팀이 reference demo server나 저장소 구조 전체를 복사하지
않고도 RFQ quote/signing/settlement 계약을 자기 backend에 연결할 수 있게 한다.

## In Scope

1. RFQ module capability와 config의 versioned contract
2. pricing, risk, signer, nonce persistence 교체 경계
3. reference service와 existing-backend integration scaffold
4. 선택형 Docker Compose export
5. reference/custom implementation 공통 conformance suite
6. core SDK, optional module, reference app 경계 문서화

## Out of Scope

- hosted production dealer, custody 또는 matching service
- production pricing, inventory 또는 secret manager
- Kubernetes template와 visual deployment builder
- Solidity execution/compliance semantics 변경

## Execution

1. 기존 RFQ SDK 공개 계약을 유지하며 module descriptor와 conformance API를 추가한다.
2. Toolkit에 integration manifest validator와 dependency-free project generator를
   추가한다.
3. CLI에 scaffold 명령을 노출하고 generated output에 secret-free environment
   contract, reference/existing-backend 예제와 optional Compose를 포함한다.
4. generated output과 custom fixtures를 공통 conformance suite로 검증한다.
5. architecture, decision, roadmap, feature와 progress 문서를 같은 변경에 맞춘다.

## Completion Evidence

- RFQ, Toolkit, CLI와 demo backend targeted tests 통과
- generated reference/existing-backend scaffold clean install/build 통과
- generated reference service의 실제 HTTP quote smoke 통과
- pinned Foundry v1.7.1 기준 repository-wide `scripts/check.sh` 통과
  (Forge 643/643 포함)
- BUIDL-like RFQ live Anvil E2E 통과
- independent code review에서 portable scaffold blocker 수정 후 재검토 통과
- optional Compose config, generated Docker image build와 container 내부
  signed quote HTTP runtime 통과
