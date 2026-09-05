# Investor and Issuer Product Portal Demo

## Purpose

`services/product-portal-demo`는 Corner Store의 제품 상호작용을 이해하고 발표하기 위한
browser-only reference UI다. source design은 Figma의 `[디자인] 투자자 흐름`과
`[디자인] 발행인 흐름`이며, 상태 전이는 `INTERACTION_SPEC.md`를 따른다.

## Journeys

### Investor

1. 홈과 거래 목록에서 자산별 자격 상태를 확인한다.
2. 부족한 고액 투자자 인증의 기관을 선택하고 로컬 파일 선택을 시뮬레이션한다.
3. 자격 검토 후 최소 50개 수량을 충족해 ABCF 견적을 요청한다.
4. 견적 수신, 체결 중, 체결 완료 후 홈과 내 자산 상태가 갱신된다.
5. `#/investor/paused`는 주문 중지 상태를 별도로 시연한다.
6. 계정 chip에서 항상 연결된 demo wallet identity, network와 EIP-712 상태를
   확인하고 MetaMask/WalletConnect/Safe 표시를 전환한다.
7. RFQ 단계에서 세 딜러 비교와 signer/taker/inventory 검증 요약, Router
   settlement confirmation/receipt를 확인한다.

### Issuer

1. 자산 기본 정보 여섯 항목을 확인한다.
2. 다섯 발행 조건에 답하고 계산된 rule badge와 준비 자료 수를 확인한다.
3. 일곱 증빙 항목을 upload/connect modal로 준비한다.
4. 심사 상태를 거쳐 거래를 시작하고 자산 지표와 최근 체결을 확인한다.
5. ABCF는 Figma의 초기 catalog처럼 항상 표시되며, activation 이후 같은 origin의
   투자자 화면에 신규 자산 알림과 활성 상태가 반영된다.
6. 일곱 evidence popup은 issuer schema, TA provider, file processing, sanctions
   freshness와 distribution window에 맞는 서로 다른 sandbox connector를 제공한다.

## Run and Test

```shell
npm start --prefix services/product-portal-demo
npm test --prefix services/product-portal-demo
```

- Investor: `http://127.0.0.1:4180/#/investor/home`
- Issuer: `http://127.0.0.1:4180/#/issuer/home`

## Trust Boundary

- 모든 결과는 reference/mock이다. UI에서는 wallet/KYC/TA/RFQ/signer/settlement의
  완결된 제품 상태와 증거를 재현하지만 production compliance decision, legal
  opinion, quote, signature 또는 settlement evidence가 아니다.
- 선택한 파일의 이름만 browser state에 보관하며 내용은 읽거나 전송하지 않는다.
- provider endpoint, API credential, wallet 또는 private key를 실제로 연결하거나
  저장하지 않는다. credential 입력란은 빈 sandbox field로만 제공한다.
- cross-flow state는 `localStorage`에만 저장되며 production service state와 연결되지
  않는다.
- ERC-3643/ONCHAINID, production onboarding과 durable RFQ의 실제 검증 경계는 기존
  Toolkit, RFQ host와 deployment runbook에 남는다.
