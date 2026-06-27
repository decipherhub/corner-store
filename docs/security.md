# Security Guide

## Trust Boundaries

- ERC-3643 / ONCHAINID의 identity와 token transfer enforcement는 외부 발행자
  시스템의 책임이다.
- Corner Store는 외부 판정을 임의로 완화하거나 우회하지 않는다.
- `tools/deploy-v3`는 vendored Uniswap v3 인프라이며 제품 compliance 보장을
  제공하지 않는다.

세부 제품 경계는 `docs/architecture/`를 기준으로 한다.

## Secrets

- private key, RPC credential과 API token을 코드나 문서에 커밋하지 않는다.
- 로컬 비밀값은 환경 변수로 전달한다.
- 예시가 필요하면 실제 값이 없는 `.env.example`만 사용한다.
- deployment state에 민감한 계정 정보가 포함되지 않는지 확인한다.

## Authorization

- Element/Recipe 등록, Manifest proposal/approval, venue/operator와 emergency 상태
  변경은 실행 권한과 분리한다.
- privileged action은 명시적인 owner/role 검사를 가져야 한다.
- production multisig와 governance는 외부 운영 결정 전 임의로 확정하지 않는다.

## Input Validation

- 외부 주소, amount, deadline, nonce, manifest version과 venue context를 검증한다.
- 명시적 `UNREGULATED` public path와 `ACTIVE` Manifest regulated path를 명시적으로
  구분한다.
- `ACTIVE` Manifest의 invalid Recipe/reference, unsupported engine와 version
  mismatch는 fail-closed로 처리한다.
- Manifest와 `UNREGULATED` 분류가 모두 없는 자산은 `UNKNOWN`으로 거부한다.
- `tokenIn`과 `tokenOut` 양쪽을 분류하며, 양쪽 모두 명시적 `UNREGULATED`인
  경우에만 regulated evaluation을 생략한다.
- 외부 callback과 pool identity는 계산된 주소 또는 registry로 검증한다.

## Asset Safety

- Router와 Adapter는 의도하지 않은 자산을 보관하지 않는 구조를 우선한다.
- 실패한 실행은 nonce, fill accounting과 token balance를 원자적으로 되돌려야 한다.
- ERC-3643 transfer 실패를 성공으로 취급하거나 swallow하지 않는다.

## RFQ Safety

- RFQ settlement는 Router-only 진입점이어야 하며 direct adapter call로 compliance
  evaluation을 우회할 수 없어야 한다.
- signed quote는 chainId, verifyingContract, maker, taker, tokenIn, tokenOut,
  amountIn, amountOut, venue, nonce와 expiry에 바인딩한다.
- quote 생성 backend는 compliance 판단을 하지 않는다. fill 시점의 최신
  `ComplianceEngine.evaluate()`가 최종 gate다.
- JavaScript service에서 온체인 정수는 unsafe `number`를 거부하고 `bigint` 또는
  decimal string을 사용한다.
- 기본 nonce 생성은 같은 millisecond 내 quote 충돌을 만들지 않는 단조 증가 fallback을
  가져야 한다.
- production dealer approval, signer custody, quote cancellation, partial fill과
  inventory risk는 별도 threat model과 feature spec 전까지 활성화하지 않는다.

## Logging

- 민감한 identity 자료와 법률 문서를 온체인 event나 일반 로그에 기록하지 않는다.
- audit event에는 필요한 식별자와 상태 변경만 남긴다.
- 성공한 regulated evaluation은 Manifest version과 applied Recipe set을 추적할 수
  있어야 한다.
- revert 시 event가 사라지는 특성을 고려한 reject logging 정책은 별도 설계
  결정으로 관리한다.

## Dependency Policy

- 새 의존성은 명시적인 제품 요구가 있을 때만 추가한다.
- 공식 upstream, license, pinned version과 유지보수 상태를 확인한다.
- vendored `tools/deploy-v3`의 upstream provenance와 독립 경계를 유지한다.

## Security Verification

현재 기본 검증:

```sh
scripts/check.sh
```

현재 구현은 권한, replay/expiry, callback spoof, balance invariant, direct adapter
bypass, Manifest/Recipe evaluation과 RFQ quote mismatch path를 Foundry tests로
검증한다. production 전 최소한 다음을 계속 유지·확장한다.

- 권한 경계 test
- replay와 expiry test
- callback spoof test
- balance invariant
- direct venue bypass boundary test
- Manifest lifecycle과 cumulative multi-Recipe test
- `UNKNOWN`, explicit `UNREGULATED`와 regulated path 구분 test
- unregulated-regulated와 regulated-regulated pair의 양쪽 Manifest 적용 test
