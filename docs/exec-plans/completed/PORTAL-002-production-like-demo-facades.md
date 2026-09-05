# PORTAL-002 — Production-like Demo Integration Facades

## Goal

외부 시스템을 실제 호출하지 않는 안전 경계를 유지하면서, 발표와 사용자 검토에서는
wallet, identity provider, RFQ maker/signer와 settlement가 완결된 제품처럼 보이고
직접 확인 가능한 sandbox interaction을 제공한다.

## In Scope

1. 연결·해제·재연결이 가능한 wallet session facade
2. KYC/TA provider review, evidence hash와 credential status facade
3. multi-dealer RFQ matching, best quote와 local signature verification display
4. compliance, submission, confirmations와 transaction receipt settlement display
5. 발행사 일곱 evidence 항목별 입력·업로드·연결 modal
6. browser interaction, visual, targeted와 repository-wide verification

## Out of Scope

- browser wallet provider 호출이나 transaction signature
- PII/file/API credential 전송 또는 persistence
- production provider, dealer, signer, RPC와 block explorer 호출
- product contract, Anvil 또는 GIWA testnet 변경

## Safety Invariants

- sandbox 값은 명확한 environment 표식을 가지되 주요 UX를 방해하지 않는다.
- secret-shaped credential과 실제 endpoint를 source/state에 포함하지 않는다.
- demo result는 production evidence로 export되지 않는다.
- 기존 미추적 사용자 파일을 수정·삭제·stage하지 않는다.

## Execution

1. PORTAL-001과 interaction spec의 mock gap을 점검했다.
2. 상태 모델과 integration facade component를 보강했다.
3. evidence modal과 RFQ/settlement 상태를 구체화했다.
4. browser walkthrough와 visual review로 action hierarchy와 CSS specificity 결함을
   수정했다.
5. docs/feature/progress와 기존 PR을 갱신했다.

## Completion Evidence

- `node --check services/product-portal-demo/app.js`: passed
- `npm test --prefix services/product-portal-demo`: passed
- Chrome CDP investor/issuer full facade walkthrough: 22 assertions passed
- Chrome 1440x900 visual review: quote, wallet, sanctions, investor completion,
  qualification approval and issuer activation passed
- controlled full `scripts/check.sh`: Foundry 870/870, all services and deploy-v3
  10/10 passed; known pre-existing formatting drift was temporarily normalized and
  restored under a shell trap
- `git diff --check`: passed
- Anvil/GIWA E2E not run because this feature changes no contract, deployment, RPC
  or testnet integration
