# Corner Store 레이어 개요 (이해용)

> 이 문서는 신규 합류자가 5개 레이어의 책임과 거부 시점을 빠르게 잡기 위한
> 개인·팀용 정리본이다. 정식 책임 정의는 [`architecture/`](./architecture/README.md),
> 제품 범위는 [`MVP-v2-multi-venue.md`](./MVP-v2-multi-venue.md), 구현 순서는
> [`ROADMAP.md`](./ROADMAP.md)를 우선한다. 이 문서와 충돌하면 그쪽이 정답.

## 한 줄로

Corner Store는 RWA 토큰의 거래 진입점(Router)을 자기 자신으로 두고, 거래마다
정책(Compliance)을 평가하고 venue로 dispatch하는 실행 시스템이다. 외부 DEX에
끼워 쓰는 SDK가 아니다.

## 5개 레이어

| # | 레이어 | 핵심 질문 | 거부 시점 | 거부 사유 예시 | 주요 컴포넌트 |
|---|---|---|---|---|---|
| 1 | **Token & Identity** | 이 주소가 이 토큰을 보유·수신할 자격이 있는가? | 토큰의 `transfer()` 실행 순간 | 수신자 미등록(`isVerified=false`), 보유 한도 초과, 차단 국가 | ERC-3643 Token, IdentityRegistry, Compliance Modules *(외부, 발행자 소유)* |
| 2 | **Compliance Policy** | 이 **거래**(맥락 포함)가 지금 허용되는가? | `ComplianceDecision` 생성 시점 + fill 직전 재평가 | lockup 미충족, maxAmount 초과, 허용 venue type 위반, 정책 SUSPENDED/UNKNOWN | ComplianceEngine, TokenPolicy/Recipe/Element/Operator Registry |
| 3 | **Execution & Routing** | 사용자의 **요청**이 답안지와 일치하는가? 어느 Adapter로 보낼까? | Router 진입 직후 (Engine 호출 후, Adapter 호출 전) | 요청 venue ≠ 답안지 venue, nonce 재사용, deadline 초과, decision-context 불일치 | ExecutionRouter, VenueRegistry, VenueSelector |
| 4 | **Venue (Adapter)** | venue 고유 프로토콜·결제가 안전한가? | Adapter 실행 중 (콜백/서명/order 검증 시) | 콜백 origin이 미등록 Pool, EIP-712 서명 위조, 가짜 maker, settlement 잔액 불일치 | UniswapV3Adapter / RFQAdapter / OrderBookAdapter |
| 5 | **Deployment & Operations** | 어떤 코드·설정·권한이 현재 활성인가? 재배포·복구 가능한가? | 배포·활성화·중단·권한 이전 시 (런타임과 다른 축) | 미preflight venue 활성화, deployer 권한 미회수, manifest-체인 불일치, suspended venue 신규 실행 | deploy-v3, Foundry script, Orchestrator, Manifest, OperatorRegistry(권한 측면) |

## 두 레이어가 헷갈릴 때

### Token & Identity vs Compliance Policy
- **Token & Identity**: 송/수신자의 **보유·전송 자격**. 토큰 컨트랙트가 안다.
  `from, to, amount`와 내부 state로 판단 가능한 것.
- **Compliance Policy**: 이 거래의 **맥락**(venue, program, direction, 금액 한도,
  정책 버전, operator)이 지금 허용되는가. 토큰 컨트랙트는 모르는 정보.

같은 `Alice → Pool, 10만$` transfer라도 ERC-3643 입장에선 OK일 수 있지만,
"AMM 매도는 lockup 중 금지" 같은 거래 측 규칙은 Compliance Policy가 본다.

### Compliance Policy vs Execution & Routing
- **Engine은 답안지를 생산한다**: "AMM이면 OK, maxAmount 100k, 23:59까지".
- **Router는 답안지 ↔ 요청을 대조한다**: "사용자가 RFQ 요청했는데 답안지는
  AMM만 허용? 거부."
- 분리한 이유: 정책 평가는 비싸고 캐시·preview될 수 있지만, 실행은 매 트랜잭션마다
  최신 평가를 받아야 한다. 같은 한 컴포넌트가 둘 다 하면 v1의 `ComplianceRouter`로
  돌아간다.

### Execution & Routing vs Venue (Adapter)
- **Router는 venue type 수준까지만** 안다 (AMM / RFQ / Order Book).
- **Adapter만이 venue 내부 프로토콜**을 안다. Uniswap v3의 콜백 origin 검증,
  RFQ의 EIP-712 서명 검증, Order Book의 nonce/cancel/partial fill 회계는
  Router가 모른다.
- 그래서 Engine·Router가 통과시켜도 Adapter 단계에서 venue 고유의 안전성
  검사를 한 번 더 거쳐야 한다.

## 실행 흐름 한 줄

```
User
  → [3 Routing] 요청 진입 + Adapter 선택
        → [2 Policy] 답안지(ComplianceDecision) 생성 — Engine 평가
        ← decision
  → [3 Routing] 답안지 vs 요청 대조 (venue, amount, deadline, nonce…)
        → [4 Venue/Adapter] venue 고유 검증 + Pool.swap / quote settle / order fill
              ↓
              [1 Token] transfer 시 발행자 측 검증 (isVerified, canTransfer)
                ↓ revert면 전체 롤백
   [5 Ops]는 위 모든 컴포넌트의 주소·권한·버전·상태를 manifest로 관리하는 수직 축
```

## 거부 시점 두 종류 (시나리오 짤 때 축으로 쓴다)

- **사전 거부**: 1·2·3에서 막히면 자산 이동 없이 가스만 소비.
- **실행 중 거부**: 4·1에서 막히면 트랜잭션 전체 롤백. 부분 이동 절대 없음.

같은 "거부 시나리오"라도 어디서 막혔는지에 따라 테스트가 봐야 할 것이 다르다.

## 콜백 패턴이 왜 Adapter의 책임을 만드는가 (참고)

Uniswap v3 swap은 콜백 구조다.

```
Adapter → Pool.swap(params)
          Pool → Adapter.uniswapV3SwapCallback(amounts)
                 Adapter → tokenIn.transferFrom(user → pool)
          Pool → tokenOut.transfer(pool → user)
```

Adapter는 user의 `tokenIn`에 대해 approve를 받아둔 상태다. 만약 누군가
`FakePool`을 배포해서 Adapter의 `uniswapV3SwapCallback`을 직접 호출하면,
Adapter가 콜백 호출자를 검증하지 않을 경우 user 토큰이 `FakePool`로 빠져나간다.

따라서 Adapter는 **콜백 호출자가 등록된 진짜 Pool인지** 검증해야 한다. 이
검사는 Engine·Router가 할 수 없는 venue 고유 책임이다.

## 다음 단계

이 문서는 **레이어와 책임**만 정리한다. 실제 시나리오(허용/거부 경로, 롤백,
suspension, 배포 실패 복구 등)는 후속 문서에서 레이어별로 작성한다.
