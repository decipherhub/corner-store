# Corner Store Architecture

## System Architecture

Corner Store는 규제 자산의 compliance 판단과 실행 venue를 분리하는 Solidity
기반 시스템이다. 현재 공식 구조는 `docs/MVP-v2-multi-venue.md`와
`docs/architecture/`에 정의되어 있다.

이 루트 문서는 새 세션을 위한 아키텍처 라우터다. 세부 구조를 중복 정의하지
않는다.

## Directory Map

| 경로 | 역할 |
| --- | --- |
| `src/` | 제품 Solidity 컨트랙트. 현재 Counter scaffold 상태 |
| `test/` | Foundry 단위·통합 테스트 |
| `script/` | Foundry 배포·운영 스크립트 |
| `docs/` | 제품 명세, 아키텍처, 로드맵과 Harness 문서 |
| `tools/deploy-v3/` | 독립적으로 유지하는 vendored Uniswap v3 배포 도구 |
| `lib/` | Foundry 의존성 |
| `scripts/` | 저장소 setup, 검증과 정리 명령 |

## Domain Boundaries

- ERC-3643과 ONCHAINID는 외부 token/identity trust boundary다.
- compliance policy는 venue 실행과 분리한다.
- execution routing은 법률 규칙이나 matching 로직을 직접 소유하지 않는다.
- venue adapter는 정책을 정의하지 않는다.
- `tools/deploy-v3`는 Corner Store 제품 코드와 분리된 vendored 인프라다.

현재 세부 경계:

- [`docs/architecture/README.md`](./docs/architecture/README.md)
- [`docs/architecture/token-and-identity.md`](./docs/architecture/token-and-identity.md)
- [`docs/architecture/compliance-policy.md`](./docs/architecture/compliance-policy.md)
- [`docs/architecture/execution-routing.md`](./docs/architecture/execution-routing.md)
- [`docs/architecture/venues/README.md`](./docs/architecture/venues/README.md)
- [`docs/architecture/deployment-operations.md`](./docs/architecture/deployment-operations.md)

## Data Flow

현재 제품 흐름은 다음 문서에서 관리한다.

- 전체 실행 흐름: [`docs/MVP-v2-multi-venue.md`](./docs/MVP-v2-multi-venue.md)
- phase별 구현 흐름: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

새 아키텍처 입력 자료를 반영하는 작업이 다음 active feature다. 반영이 끝나기
전에는 이 문서에 미래 구조를 확정된 사실로 중복 작성하지 않는다.

## External Dependencies

- Foundry / forge-std
- ERC-3643 / ONCHAINID interfaces and deployed systems
- Uniswap v3 contracts and the vendored `tools/deploy-v3`

## Forbidden Dependencies

- 제품 컨트랙트가 vendored `tools/deploy-v3` 소스에 의존하지 않는다.
- Adapter가 compliance policy를 하드코딩하지 않는다.
- Router가 venue-specific matching 로직을 소유하지 않는다.
- 외부 identity 또는 legal 판단을 Corner Store가 임의로 완화하지 않는다.

## Layering Rules

- 더 구체적인 책임 문서가 상위 제품 문서보다 우선한다.
- 아키텍처 변경은 관련 product spec, decision과 roadmap을 함께 갱신한다.
- 문서에 없는 새 경계를 구현 전에 추측하지 않는다.

## Where to Add New Code

제품 디렉터리 구조는 active 아키텍처 feature에서 확정한다. 확정 전에는 기존
Counter scaffold를 제품 구조로 간주하거나 임의의 새 레이어를 만들지 않는다.
