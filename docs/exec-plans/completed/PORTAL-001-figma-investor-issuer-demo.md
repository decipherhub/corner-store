# PORTAL-001 — Figma Investor and Issuer Product Demo

## Goal

`INTERACTION_SPEC.md`와 Figma의 투자자·발행인 디자인을 기존 production 서비스와
분리된 interactive desktop reference demo로 구현한다.

## In Scope

1. 투자자 홈, 거래 목록, 자격 신청, 인증 제출, RFQ 견적·체결, 자산·인증 화면
2. 발행사 홈, 기본 정보, 발행 조건, 증빙, 심사, 거래 시작과 자산 현황 화면
3. 발행사 activation 후 투자자 거래 목록에 신규 자산이 표시되는 cross-flow
4. Figma token·asset 기반 desktop styling, 키보드 focus와 reduced-motion 처리
5. 모델·정적 서버 smoke, representative browser walkthrough와 repository check

## Out of Scope

- wallet connect, 계정 전환과 real transaction signing
- KYC/TA provider 호출, PII 또는 파일 저장
- 법률 판단, production Element/Recipe/Manifest compiler
- dealer matching, durable RFQ, orderbook와 on-chain settlement
- responsive/mobile과 국제화

## Safety Invariants

- demo는 브라우저 밖으로 자격·파일·주문 데이터를 전송하지 않는다.
- reference 상태를 production compliance 또는 settlement 결과로 표현하지 않는다.
- 기존 Anvil, GIWA testnet과 production onboarding service를 수정하지 않는다.
- 기존 미추적 파일을 삭제, 덮어쓰기 또는 stage하지 않는다.

## Execution

1. Figma design context와 기존 frontend/server 패턴을 확인했다.
2. 순수 상태 모델과 investor/issuer route를 구현했다.
3. Figma token, exact exported assets와 상호작용을 적용했다.
4. smoke와 브라우저 walkthrough를 수행하고 승인 상태 및 slider 결함을 수정했다.
5. 문서, feature/progress 상태와 repository check를 갱신했다.

## Completion Evidence

- `npm test --prefix services/product-portal-demo`: passed
- JavaScript syntax and `git diff --check`: passed
- Chrome 1440x900 investor home/issuer rules/investor order renders reviewed
- Chrome CDP full investor/issuer interaction walkthrough: 11 assertions passed
- controlled full `scripts/check.sh`: Foundry 870/870, all services and deploy-v3
  10/10 passed; known pre-existing formatting drift was temporarily normalized and
  restored under a shell trap
- direct current-tree check remains blocked only by those two pre-existing formatting
  differences; neither file is changed by PORTAL-001
- Anvil/GIWA E2E not run because the feature has no contract, deployment, RPC or
  testnet integration
