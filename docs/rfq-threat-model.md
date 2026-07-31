# RFQ Threat Model

이 문서는 RFQ venue(`RFQAdapter` + offchain signer)의 위협 모델이다. 보안
규칙 일반은 `docs/security.md`, router 경로 경계는 D006을 기준으로 하고, 여기서는
RFQ settlement에 한정한 actor, asset, trust boundary와 threat/mitigation을 정리한다.

## Scope

- 대상 venue는 `RFQAdapter`(`src/execution/adapters/rfq/RFQAdapter.sol`)와 offchain
  quote signer(`services/rfq`)다.
- 보장 범위는 protected path에 한정한다:
  `ExecutionRouter → ComplianceEngine → RFQAdapter → ComplianceEngine.commit()`.
- direct adapter call, 비-router settlement, wrapper/custodian을 통한 이전은
  본 모델의 보장 범위 밖이다. 이는 D006(Corner Store compliance 보장은 Router
  경로에 한정)의 RFQ 구체화이며, 별도 예외를 만들지 않는다.
- production 책임과 migration 기준은 ADR-009와
  `docs/product-specs/production-rfq-policy.md`에서 정한다. maker authorizer와
  regulated-quantity cap binding은 구현됐고, durable nonce, production
  pricing/risk와 endpoint hardening은 후속 범위다.
- partial fill은 현 Adapter 범위 밖이며 새 quote/adapter version 전까지 허용하지
  않는다.

## Actors

- **Operator**: maker approval과 venue suspension을 관장한다. adapter 자체의
  `Governed` operator 권한으로 `setMakerApproved`를 호출하고, incident 시에는
  `OperatorRegistry`를 통해 venue를 정지한다.
- **Maker (approved dealer)**: operator가 승인한 inventory/settlement account다.
  직접 ECDSA 또는 현재 `MakerAuthorizer`가 승인한 delegate/ERC-1271 경로로
  quote authority를 증명하며, 자신의 nonce namespace를 취소할 수 있다.
- **Taker (request initiator)**: 거래를 개시하는 사용자. Router 요청의
  `context.initiator`이자 `context.buyer`여야 한다.
- **Router (gate-sequence owner)**: compliance evaluation, initiator/nonce 검증,
  venue dispatch와 post-trade `commit()`을 소유한다. `RFQAdapter`의 유일한
  정당 호출자다.

## Assets At Risk

- taker의 `tokenIn` allowance(adapter가 `safeTransferFrom`으로 인출).
- maker의 `tokenOut` allowance(adapter가 `safeTransferFrom`으로 인출).
- quote signature authority(maker 직접 서명 또는 governed delegate/ERC-1271 권한).
- nonce namespace(`usedQuoteNonce[maker][nonce]`, fill과 cancel이 공유).
- venue reputation과 compliance 보장(잘못된 maker/quote는 venue 신뢰를 훼손).

## Trust Boundaries

- **EIP-712 signature boundary**: offchain quote가 onchain settlement로 넘어오는
  경계. typed hashing(`RFQ_QUOTE_TYPEHASH`) 후 immutable `MakerAuthorizer`가
  direct ECDSA, current delegate 또는 ERC-1271을 검증한다.
- **`onlyRouter` boundary**: adapter 진입점. router 외 호출은 `NotAuthorized`로
  거부하여 compliance gate 우회를 막는다.
- **ERC-20 allowance boundary**: 양 leg 모두 adapter를 approve한다. adapter는
  quote가 검증된 뒤에만, 서명된 정확한 amount로만 인출한다.
- **Operator governance boundary**: maker allowlist와 venue suspension은 실행
  권한과 분리된 operator 권한이다.

## Threat Table

| Threat | Mitigation | Status |
| ------ | ---------- | ------ |
| Forged/altered quote | EIP-712 typed hashing + current maker-authorizer + `req.context` 전체 필드 대조(`RFQQuoteMismatch`) | mitigated |
| Quote replay | per-maker `usedQuoteNonce`(`RFQQuoteUsed`) | mitigated |
| Stale/expired quote | `expiry` 검사(`RFQQuoteExpired`); ops 권고: 짧은 expiry | mitigated |
| Settlement outside compliance path | `onlyRouter` + router initiator/nonce/compliance gate | mitigated |
| Venue-type misreporting | router venue-type binding 검사(`VenueTypeMismatch`) | mitigated |
| Rogue/unvetted maker | operator `approvedMaker` allowlist(`RFQMakerNotApproved`) | mitigated |
| Maker needs to pull a live quote | `cancelQuoteNonce`(`RFQQuoteCancelled`); cancel-vs-fill race는 first-lander로 해소, cancel은 확정 전까지 best-effort | mitigated (documented residual) |
| Malicious/re-entrant token contract | `SafeERC20` + router `nonReentrant` + regulated asset는 upstream manifest로 gating | partially mitigated |
| Operator key compromise | D011 governance separation + ADR-009 immediate tightening; vendor key custody는 operator 책임 | residual |
| Quote signer compromise/rotation | delayed delegate addition + fill-time current authorization + immediate revoke | mitigated |
| Multi-instance nonce collision | ADR-009는 maker-scoped atomic durable allocation과 idempotency를 요구 | specified, not implemented |
| Stale pricing/inventory dependency | production module은 signer 호출 전에 fail-closed해야 함 | specified, not implemented |
| Partial-fill accounting/replay ambiguity | v1은 exact full-fill만 허용; 새 adapter version 전까지 비활성 | mitigated by scope |

각 mitigation의 구현 위치:

- signature/mismatch/expiry/replay/maker 검사는 `_validateQuote`에서 순서대로
  수행한다: expiry → nonce(replay) → maker approval → current authorizer →
  필드 대조.
- venue-type binding은 `ExecutionRouter.execute`가 `VenueConfig.venueType`와
  `req.context.venueType` 불일치를 거부한다.
- cancel은 `usedQuoteNonce`를 fill guard와 공유하여 idempotent하게 처리한다
  (이미 used면 no-op, event 미발행).

## Residual Risks & Ops Guidance

- **Cancel-vs-fill race**: cancel과 fill이 같은 nonce를 두고 경쟁하면 먼저 채굴된
  transaction이 결정한다. cancel은 확정될 때까지 best-effort이며, 이미 fill된
  nonce는 un-fill할 수 없다. maker는 quote 만료를 짧게 유지해 노출을 줄인다.
- **Exotic ERC-20 behavior**: unregulated 측 token이 fee-on-transfer, rebasing,
  reentrant hook 등 비표준 동작을 하면 `SafeERC20`와 `nonReentrant`로 완화되나
  잔여 위험이 남는다. regulated 측은 upstream manifest gating으로 제한한다.
- **Operator/signer key compromise**: signer 추가는 지연되고 revoke는 즉시
  적용되지만 governance와 signer custody vendor는 여전히 operator 책임이다.
  incident 시 venue pause 후 signer/maker revoke와 nonce cancellation을 수행한다.
- **Allowance hygiene**: maker는 필요한 `tokenOut` allowance만 유지하고, 승인
  해제(off-boarding) 시 잔여 allowance를 회수한다. taker도 마찬가지로 `tokenIn`
  allowance를 최소화한다.
- **Monitoring**: `RFQFilled`, `RFQQuoteCancelled`, `MakerApprovalSet` event를
  감시하여 예상치 못한 fill, 대량 cancel, 승인 변경을 탐지한다.
- **Cancellation gas**: `cancelQuoteNonces`의 배열 길이는 무제한이지만 caller가
  gas를 지불하므로 third-party DoS surface가 아니다. maker가 자신의 배치 크기를
  통제한다.
- **Incident response**: 이상 징후 시 operator가 `OperatorRegistry`를 통해 venue를
  정지하고 필요한 maker approval을 취소한다.
