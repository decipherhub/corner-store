# Product Portal Demo

Figma의 투자자·발행사 흐름과 `INTERACTION_SPEC.md`를 구현한 desktop reference
demo다. 투자자 자격 신청·RFQ 주문과 발행사 자산 등록·규칙 선택·증빙 준비를 하나의
브라우저 상태로 연결한다. 실제 외부 권한을 사용하지 않지만 wallet session,
KYC/TA evidence, multi-dealer quote, signer verification과 settlement receipt를
제품 수준의 sandbox facade로 시연할 수 있다.

체결 완료 시 선택한 자산, 주문 수량과 정산 금액이 idempotent transaction journal에
기록되고 홈, 보유 자산·거래 내역 통합 화면과 발행사 자산 현황이 같은 state를 읽는다. KTB와
MMF의 `거래하기`도 각 자산 주문 화면으로 연결되며, ABCF 자격 승인은 KLM 자격을
해제하지 않는다. 초기 KLM/ABCF는 모두 거래 자격이 없고, 자격 없는 상태로 주문 URL에
직접 진입해도 자산 상세에서 차단된다. 발행사 등록 완료는 ABCF를 catalog에 노출하지만
투자자 자격을 자동 부여하지 않는다. 발행사 홈과 자산 현황의 전체 주문 일시정지·재개는 투자자 거래
목록과 주문 gate에 즉시 반영된다. 완료된 ABCF 체결 또는 기존 ABCF 보유 상태는
발행사 운영 화면에서도 해당 자산을 노출한다.

## Run

```bash
npm start --prefix services/product-portal-demo
```

- 투자자: `http://127.0.0.1:4180/#/investor/home`
- 발행사: `http://127.0.0.1:4180/#/issuer/home`
- 보유 자산: `http://127.0.0.1:4180/#/investor/assets`
- 거래 내역: `http://127.0.0.1:4180/#/investor/transactions`

`investor/transactions`는 Figma의 통합 `내 자산` 화면으로 연결되는 호환 경로다.
기존 schema v5 이하의 browser state는 schema v6으로 읽을 때 KLM/ABCF 자격을 한 번
초기화하므로 이전 테스트에서 남은 자격이 새 초기 시연에 섞이지 않는다.

일시정지는 발행사 **홈 → 주문 접수 관리** 또는 **내 자산 → 주문 접수 관리**에서
실행한다. Figma의 `주문 일시 중지` 상태처럼 자격을 보유한 자산의 버튼이 모두
비활성화되고, 자격이 없는 KLM/ABCF는 기존 자격 상태를 유지한다.

## Verify

```bash
npm test --prefix services/product-portal-demo
```

## Boundary

- 1440px desktop 시연용이며 responsive/mobile product가 아니다.
- 지갑 연결·인증기관·파일 처리·RFQ 서명·온체인 체결은 상호작용 가능한 sandbox
  facade로 재현하지만 실제 provider, signer, RPC 또는 transaction을 호출하지 않는다.
- 입력한 demo state는 현재 origin의 `localStorage`에만 저장한다.
- 체결 journal과 pause/resume 운영 이력은 browser demo용이며 production ledger,
  WORM audit 또는 온체인 event가 아니다.
- UI의 자격·규칙 결과는 production compliance engine의 판정이 아니다.
- `ABCF`는 Figma catalog에 처음부터 표시되며 발행사 심사 완료 후 activation 알림과
  상태가 같은 demo state에 반영된다. 투자자 quote/settlement evidence도 동일한
  browser-only fixture에서 확인할 수 있다.
