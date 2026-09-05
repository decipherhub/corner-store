# Product Portal Demo

Figma의 투자자·발행사 흐름과 `INTERACTION_SPEC.md`를 구현한 desktop reference
demo다. 투자자 자격 신청·RFQ 주문과 발행사 자산 등록·규칙 선택·증빙 준비를 하나의
브라우저 상태로 연결한다. 실제 외부 권한을 사용하지 않지만 wallet session,
KYC/TA evidence, multi-dealer quote, signer verification과 settlement receipt를
제품 수준의 sandbox facade로 시연할 수 있다.

## Run

```bash
npm start --prefix services/product-portal-demo
```

- 투자자: `http://127.0.0.1:4180/#/investor/home`
- 발행사: `http://127.0.0.1:4180/#/issuer/home`
- 중지 주문 상태: `http://127.0.0.1:4180/#/investor/paused`

## Verify

```bash
npm test --prefix services/product-portal-demo
```

## Boundary

- 1440px desktop 시연용이며 responsive/mobile product가 아니다.
- 지갑 연결·인증기관·파일 처리·RFQ 서명·온체인 체결은 상호작용 가능한 sandbox
  facade로 재현하지만 실제 provider, signer, RPC 또는 transaction을 호출하지 않는다.
- 입력한 demo state는 현재 origin의 `localStorage`에만 저장한다.
- UI의 자격·규칙 결과는 production compliance engine의 판정이 아니다.
- 발행사 심사 완료 후 `ABCF`가 투자자 거래 목록에 나타나며, activation evidence와
  투자자 quote/settlement evidence도 같은 demo state에서 확인할 수 있다.
