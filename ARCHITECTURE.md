# Corner Store Architecture

## System Architecture

Corner Store는 DEX-level compliance를 제공하는 Solidity SDK와 이를 검증하는
reference multi-venue execution system이다. 현재 공식 구조는
`docs/MVP-v2-multi-venue.md`와 `docs/architecture/`에 정의되어 있다.

SDK는 정책을 등록·교체하는 Compliance Core와 실행 venue를 Adapter로 등록·교체하는
Execution Integration Kit로 구성한다. Corner Store reference DEX는 이 공통 SDK에
구체 Adapter와 배포 구성을 결합한다.

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
- Element, Recipe, Manifest, Operator의 이름 기반 4-Layer compliance model을
  사용한다.
- applicable Recipe는 cumulative AND로 평가한다.
- `tokenIn`과 `tokenOut` 양쪽의 classification과 Manifest를 평가한다.
- Asset Compliance Manifest는 자산별 Recipe, engine, version과 발행 측 coverage를
  binding한다.
- compliance evaluation은 venue 실행과 분리한다.
- execution routing은 법률 규칙이나 matching 로직을 직접 소유하지 않는다.
- venue adapter는 정책을 정의하지 않는다.
- Corner Store의 DEX-level compliance 보장은 `ExecutionRouter`가 실행한
  router-mediated trade에 한정한다.
- ERC-3643 직접 전송, 직접 pool/venue 호출, wrapper/vault/custodian을 통한 경제적
  소유권 이전은 자동으로 Corner Store 4-Layer evaluation과 `commit()`을 거치지
  않는다.
- Router 밖 경로는 발행자 token-level enforcement에 위임하거나, controlled
  venue/settlement로 제한하거나, 명시적으로 제품 범위 밖으로 선언해야 한다.
- 무거운 자료와 재량 판단은 오프체인, 검증·게이팅·집행은 온체인에 둔다.
- `tools/deploy-v3`는 Corner Store 제품 코드와 분리된 vendored 인프라다.

현재 세부 경계:

- [`docs/architecture/README.md`](./docs/architecture/README.md)
- [`docs/architecture/token-and-identity.md`](./docs/architecture/token-and-identity.md)
- [`docs/architecture/compliance-policy.md`](./docs/architecture/compliance-policy.md)
- [`docs/architecture/asset-manifest.md`](./docs/architecture/asset-manifest.md)
- [`docs/architecture/execution-routing.md`](./docs/architecture/execution-routing.md)
- [`docs/architecture/venues/README.md`](./docs/architecture/venues/README.md)
- [`docs/architecture/deployment-operations.md`](./docs/architecture/deployment-operations.md)

## Data Flow

현재 제품 흐름은 다음 문서에서 관리한다.

- 전체 실행 흐름: [`docs/MVP-v2-multi-venue.md`](./docs/MVP-v2-multi-venue.md)
- phase별 구현 흐름: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

SDK와 reference DEX의 전체 실행 흐름은 제품 명세에, 세부 책임과 불변성은
`docs/architecture/`에 둔다.

보호되는 execution 경로:

```text
ExecutionRouter
  → ComplianceEngine.evaluate()
  → Adapter
  → Venue/Pool/RFQ
  → ComplianceEngine.commit()
```

보호되지 않는 경로 예시는 다음과 같다.

- ERC-3643 token 직접 `transfer` / `transferFrom`
- 사용자의 직접 AMM pool 또는 외부 venue 호출
- Router를 통하지 않는 RFQ/Order Book settlement
- wrapper, vault, custodian, omnibus account 또는 offchain ledger를 통한 RWA
  economic exposure 이전

이 경계는 제품 보증 문구에도 반영해야 한다. Corner Store는 모든 가능한 RWA 이동을
전역적으로 통제한다고 주장하지 않고, router-mediated trade에 대해 DEX-level
compliance를 강제한다고 설명한다.

## External Dependencies

- Foundry / forge-std
- ERC-3643 / ONCHAINID interfaces and deployed systems
- Uniswap v3 contracts and the vendored `tools/deploy-v3`

## Forbidden Dependencies

- 제품 컨트랙트가 vendored `tools/deploy-v3` 소스에 의존하지 않는다.
- Adapter가 compliance policy를 하드코딩하지 않는다.
- Router가 venue-specific matching 로직을 소유하지 않는다.
- Recipe가 특정 자산이나 venue 주소를 하드코딩하지 않는다.
- Manifest가 Element의 실제 검증 로직을 소유하지 않는다.
- 외부 identity 또는 legal 판단을 Corner Store가 임의로 완화하지 않는다.

## Layering Rules

- 더 구체적인 책임 문서가 상위 제품 문서보다 우선한다.
- 아키텍처 변경은 관련 product spec, decision과 roadmap을 함께 갱신한다.
- 문서에 없는 새 경계를 구현 전에 추측하지 않는다.

## Where to Add New Code

제품 코드는 Compliance Core, Execution Integration Kit와 Corner Store reference
Adapter/configuration의 의존 방향이 드러나게 구성한다. 정확한 Solidity 디렉터리는
Foundation feature에서 확정하며, 기존 Counter scaffold를 제품 구조로 간주하지
않는다.
