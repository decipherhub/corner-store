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

### Issuer

1. 자산 기본 정보 여섯 항목을 확인한다.
2. 다섯 발행 조건에 답하고 계산된 rule badge와 준비 자료 수를 확인한다.
3. 일곱 증빙 항목을 upload/connect modal로 준비한다.
4. 심사 상태를 거쳐 거래를 시작하고 자산 지표와 최근 체결을 확인한다.
5. activation 이후 같은 origin의 투자자 거래 목록에 ABCF가 표시된다.

## Run and Test

```shell
npm start --prefix services/product-portal-demo
npm test --prefix services/product-portal-demo
```

- Investor: `http://127.0.0.1:4180/#/investor/home`
- Issuer: `http://127.0.0.1:4180/#/issuer/home`

## Trust Boundary

- 모든 결과는 reference/mock이다. production compliance decision, legal opinion,
  quote, signature 또는 settlement evidence가 아니다.
- 선택한 파일의 이름만 browser state에 보관하며 내용은 읽거나 전송하지 않는다.
- provider endpoint, API credential, wallet 또는 private key를 받지 않는다.
- cross-flow state는 `localStorage`에만 저장되며 production service state와 연결되지
  않는다.
- ERC-3643/ONCHAINID, production onboarding과 durable RFQ의 실제 검증 경계는 기존
  Toolkit, RFQ host와 deployment runbook에 남는다.
