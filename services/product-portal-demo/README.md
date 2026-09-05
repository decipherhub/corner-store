# Product Portal Demo

Figma의 투자자·발행사 흐름과 `INTERACTION_SPEC.md`를 구현한 desktop reference
demo다. 투자자 자격 신청·RFQ 주문과 발행사 자산 등록·규칙 선택·증빙 준비를 하나의
브라우저 상태로 연결한다.

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
- 지갑 연결, 인증기관 호출, 파일 업로드, 법률 판단, RFQ 서명과 온체인 체결을 하지 않는다.
- 입력한 demo state는 현재 origin의 `localStorage`에만 저장한다.
- UI의 자격·규칙 결과는 production compliance engine의 판정이 아니다.
- 발행사 심사 완료 후 `ABCF`가 투자자 거래 목록에 나타나는 cross-flow만 시뮬레이션한다.
