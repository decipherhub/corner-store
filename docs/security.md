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

- 정책, venue, operator와 emergency 상태 변경은 실행 권한과 분리한다.
- privileged action은 명시적인 owner/role 검사를 가져야 한다.
- production multisig와 governance는 외부 운영 결정 전 임의로 확정하지 않는다.

## Input Validation

- 외부 주소, amount, deadline, nonce, policy version과 venue context를 검증한다.
- 미등록 또는 불완전한 규제 상태는 현재 공식 정책에 따라 처리하며, 정책 변경은
  source-of-truth 문서와 테스트를 함께 갱신한다.
- 외부 callback과 pool identity는 계산된 주소 또는 registry로 검증한다.

## Asset Safety

- Router와 Adapter는 의도하지 않은 자산을 보관하지 않는 구조를 우선한다.
- 실패한 실행은 nonce, fill accounting과 token balance를 원자적으로 되돌려야 한다.
- ERC-3643 transfer 실패를 성공으로 취급하거나 swallow하지 않는다.

## Logging

- 민감한 identity 자료와 법률 문서를 온체인 event나 일반 로그에 기록하지 않는다.
- audit event에는 필요한 식별자와 상태 변경만 남긴다.
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
