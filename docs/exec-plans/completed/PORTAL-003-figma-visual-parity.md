# PORTAL-003 — Figma Visual Parity and Stable Demo Identity

## Goal

제공된 Figma PNG와 현재 browser demo의 핵심 화면을 직접 비교해 시각 구조와
항상 연결된 것처럼 보이는 demo identity를 정렬한다.

## In Scope

1. Figma와 동일한 sidebar/account identity hierarchy
2. 투자자 홈·거래·자격·주문·완료 핵심 화면 정렬
3. 발행사 홈·기본 정보·발행 조건·자료·심사·거래 시작 핵심 화면 정렬
4. 기존 sandbox integration facade의 비권한 경계 유지
5. 1440x900 browser render와 critical-flow verification

## Out of Scope

- 실제 wallet/SSO/provider/RPC 연결
- responsive/mobile
- contract, deployment 또는 testnet 변경
- 사용자가 제공한 `figma/` 원본 수정 또는 커밋

## Safety Invariants

- Figma ZIP은 읽기 전용 입력으로 취급하고 임시 디렉터리에서만 추출한다.
- demo identity는 production authority나 실제 연결 증거로 export하지 않는다.
- 기존 미추적 사용자 파일을 수정·삭제·stage하지 않는다.

## Completion Evidence

- `npm test --prefix services/product-portal-demo`: passed
- Chrome 1440x900 visual comparison: investor home/trade/qualification/order/
  completion, issuer home/basic/rules/evidence/review/live
- Chrome 1440x720 reduced-height regression: fixed sidebar account identity remains visible
- Chrome 1440x720 direct-route regression: qualification and legacy provider hashes
  render without a modal; the provider picker is gated by an explicit `인증 받기` action
- Node 24 full `scripts/check.sh`: Foundry 870/870, all service smoke tests,
  deploy-v3 10/10 passed
- `git diff --check`: passed
- protected untracked files, including `figma/`, remained unmodified and unstaged
- Anvil/GIWA E2E not rerun because no contract, deployment, RPC or testnet path changed
