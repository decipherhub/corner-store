# Security Guide

## Trust Boundaries

- ERC-3643 / ONCHAINID의 identity와 token transfer enforcement는 외부 발행자
  시스템의 책임이다.
- Corner Store는 외부 판정을 임의로 완화하거나 우회하지 않는다.
- Corner Store의 DEX-level compliance 보장은 `ExecutionRouter`를 통한 실행
  경로에 한정한다. Router 밖에서 발생하는 ERC-3643 직접 전송, 직접 venue 호출,
  wrapper/vault/custodian을 통한 경제적 소유권 이전은 별도 제한, token-level
  enforcement 위임 또는 명시적 out-of-scope 처리가 필요하다.
- `tools/deploy-v3`는 vendored Uniswap v3 인프라이며 제품 compliance 보장을
  제공하지 않는다.

세부 제품 경계는 `docs/architecture/`를 기준으로 한다.

## Compliance Enforcement Boundary

지원되는 enforcement 경로:

```text
ExecutionRouter
  → ComplianceEngine.evaluate()
  → Adapter
  → Venue/Pool/RFQ
  → ComplianceEngine.commit()
```

이 경로에서는 Router가 최신 Manifest와 applicable Recipe를 평가하고, 허용된
venue/adapter에만 실행을 위임하며, 성공 후 stateful compliance `commit()`을
호출한다.

지원 경로 밖에서는 Corner Store의 4-Layer compliance가 자동으로 실행되지 않는다.
특히 다음 경로는 production-ready 보장으로 간주하지 않는다.

- ERC-3643 token의 직접 `transfer` / `transferFrom`
- 사용자가 AMM pool 또는 외부 venue를 직접 호출하는 swap
- Router를 거치지 않는 RFQ 또는 Order Book settlement
- wrapper, vault, custodian 또는 omnibus account를 통한 경제적 소유권 이전
- offchain ledger에서의 beneficial ownership 이전

이런 경로가 열려 있으면 다음 Corner Store 검사가 생략될 수 있다.

- investor qualification Recipe
- amount cap과 offering/fund cap
- venue allowlist와 operator pause
- nonce/replay control
- `ComplianceEngine.commit()` 기반 surveillance/stateful Element update
- future lockup, affiliate, jurisdiction-specific rule

현재 skeleton의 기본 보안 모델은 제한된 범위 모델이다.

> Corner Store는 router-mediated trade에 대해 DEX-level compliance를 강제한다.
> Router 밖의 RWA 이동 또는 경제적 노출 이전은 발행자 token-level enforcement에
> 위임되거나, 별도 controlled venue로 제한되거나, 제품 범위 밖으로 명시되어야 한다.

더 강한 production 보장이 필요하면 다음 중 하나를 별도 설계 결정으로 확정해야 한다.

- Router-exclusive model: end user가 직접 호출할 수 없는 controlled venue/settlement만
  지원한다.
- Token-level enforcement model: 핵심 제한을 ERC-3643 compliance module이 Router
  밖에서도 강제한다.
- Limited-scope model: Corner Store 보장을 router-mediated trade로 한정하고,
  non-router path는 문서와 제품 설명에서 out-of-scope로 명시한다.

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
- Router 실행 요청의 caller는 `context.initiator`와 일치해야 한다.
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
- Adapter와 settlement contract는 Router-only authorization 또는 동등한 호출자
  제한을 가져야 한다.
- 실패한 실행은 nonce, fill accounting과 token balance를 원자적으로 되돌려야 한다.
- ERC-3643 transfer 실패를 성공으로 취급하거나 swallow하지 않는다.

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

제품 컨트랙트 구현 시 최소한 다음을 추가한다.

- 권한 경계 test
- replay와 expiry test
- callback spoof test
- balance invariant
- direct venue bypass boundary test
- Manifest lifecycle과 cumulative multi-Recipe test
- `UNKNOWN`, explicit `UNREGULATED`와 regulated path 구분 test
- unregulated-regulated와 regulated-regulated pair의 양쪽 Manifest 적용 test
