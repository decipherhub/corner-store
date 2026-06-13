# 4-Layer Compliance Stack

## Responsibility

이 경계는 transaction context와 Asset Manifest를 해석해 적용 Recipe를 식별하고,
활성 Element를 cumulative AND로 평가해 구조화된 decision을 만든다.

핵심 질문:

> 이 자산과 거래 context에 어떤 규제 효과가 동시에 적용되며, 어떤 실행 조건을
> 모두 만족해야 하는가?

swap, quote fill, order matching 또는 settlement 자체는 수행하지 않는다.

## Owned Components

- `ComplianceEngine`
- `ElementRegistry`와 Elements
- `RecipeRegistry`와 Recipes
- `ManifestRegistry` 또는 동등한 Manifest resolver
- 최소 operator state/reference 경계
- compliance context, result, reason code와 audit events

## Element

Element는 하나의 구성요건 사실만 판정한다. 특정 Recipe나 venue에 종속되지 않는다.

Element 추가 기준:

1. 기존 Element로 같은 사실을 표현할 수 없는가?
2. 판정 주체가 온체인 코드, 승인된 attestation 또는 Operator 중 누구인가?
3. 거래 전, 거래 시점, 거래 후 중 언제 작동하는가?
4. 현재 거래만 보는가, 누적 상태를 보는가?

stateful Element의 commit hook은 열린 interface 결정이다. 읽기 검사와 상태 갱신을
분리해야 하며 실패한 settlement가 누적 상태를 남겨서는 안 된다.

## Recipe

Recipe는 하나의 법률효과를 표현하는 Element 집합과 활성화 logic이다. 한 거래에는
발행, 재판매, 펀드, 행위와 관할 관련 Recipe가 동시에 적용될 수 있다.

평가 규칙:

- Manifest와 transaction context로 applicable Recipe를 식별한다.
- 모든 applicable Recipe의 Element reference를 합집합으로 만든다.
- 동일 context의 중복 Element는 한 번만 실행할 수 있다.
- 활성화된 모든 Element를 통과해야 한다.
- 어떤 Recipe 또는 Element가 실패했는지 구조화된 reason으로 반환한다.

Recipe 하나를 골라 나머지를 무시하거나 first-success 방식으로 평가하지 않는다.

## Manifest Integration

Manifest는 자산별 Recipe reference, version, resale path, engine, facts와 발행 측
coverage를 제공한다. 세부 lifecycle과 불변성은
[`asset-manifest.md`](./asset-manifest.md)를 따른다.

`tokenIn`과 `tokenOut`을 각각 resolve한다. 양쪽이 모두 명시적 `UNREGULATED`인
경우에만 public pass-through를 허용하며 이 경로에는 4-Layer 보장이 없다. 한쪽이라도
`UNKNOWN`이면 거부한다. 한쪽 이상이 regulated이면 양쪽에서 확인된 모든 regulated
Manifest를 거래 context에 함께 적용한다.

`ACTIVE` Manifest가 존재하면 누락된 Recipe, invalid version, 지원하지 않는 engine
또는 불완전 reference는 허용 기본값으로 처리하지 않는다.

## Inputs and Outputs

입력 context:

- initiator, buyer, seller
- tokenIn, tokenOut, amount와 direction
- order/quote/market identifier
- requested engine, venue와 operator
- nonce, evaluation time와 settlement deadline

출력 예시:

```solidity
struct ComplianceDecision {
    bool allowed;
    bytes32 manifestId;
    uint64 manifestVersion;
    bytes32 appliedRecipesHash;
    uint64 validUntil;
    uint256 maxAmount;
    uint256 allowedVenueTypes;
    bytes32 allowedVenuesHash;
    bytes32 reasonCode;
    bytes32 decisionHash;
}
```

정확한 ABI는 Foundation feature에서 확정한다.

## Trust Boundaries

- 법률 해석과 production 기준의 정확성은 승인된 Recipe/Manifest와 운영주체에
  의존한다.
- external claim, oracle와 attestation의 진실성은 승인된 provider 경계 밖이다.
- 발행 측 coverage는 Manifest에 기록된 범위만 신뢰하며 임의로 확대하지 않는다.
- policy/Manifest 변경 권한과 execution 권한은 분리한다.
- off-chain 판단 결과 입력은 권한과 scope, expiry를 검증한다.

## Invariants

- applicable Recipe는 cumulative AND로 평가한다.
- `tokenIn`과 `tokenOut` 양쪽의 classification과 Manifest를 평가한다.
- 양쪽 모두 명시적 `UNREGULATED`일 때만 public pass-through를 허용한다.
- 하나 이상의 regulated 자산이 있으면 모든 regulated Manifest의 applicable
  Recipe를 합쳐 평가한다.
- `ACTIVE` Manifest의 invalid reference나 unsupported engine은 거부한다.
- decision은 actor, token, amount, venue, Manifest version, nonce와 expiry에
  바인딩된다.
- preview decision을 settlement 권한으로 사용하지 않는다.
- settlement 직전에 최신 Manifest와 actor/operator 상태를 평가한다.
- ERC-3643 transfer 실패를 성공으로 변환하지 않는다.
- 민감 정보와 full legal document는 온체인에 저장하지 않는다.

## Current Decisions

- Element/Recipe/Manifest/Operator 이름 기반 4-Layer를 사용한다.
- Recipe는 법률효과 하나를 표현한다.
- applicable Recipe는 cumulative AND로 평가한다.
- Asset Manifest가 기존 single Recipe mapping/Token Policy 역할을 확장한다.
- 온체인은 검증·게이팅·집행, 오프체인은 재량 판단·민감 정보·대량 연산을 맡는다.
- 발행 측 사실은 coverage delta 방식으로 재사용한다.

## Open Decisions

- acquisition/lot data source
- stateful Element commit hook
- Manifest/Recipe set encoding과 duplicate Element key
- issuer coverage encoding
- reject audit trail
- production Element/Recipe 목록과 법률 승인

## References

- [`MVP-v2-multi-venue.md` - Named 4-Layer](../MVP-v2-multi-venue.md#5-named-4-layer-compliance-stack)
- [`MVP-v2-multi-venue.md` - Multi-Recipe Evaluation](../MVP-v2-multi-venue.md#6-multi-recipe-evaluation)
- [`asset-manifest.md`](./asset-manifest.md)
