# TOOLKIT-003 — Parameter-aware Production Safe Export

## Outcome

ManifestPolicyConfig가 있는 production 정책을 exact artifact와 결합해 unsigned Safe
REGISTER/UPDATE plan으로 만들고, delay 전후 상태를 fail-closed 검증한다.

## In Scope

- schema v5 lifecycle, Element parameter capability와 bounded config validation
- full config registration/update calldata와 Safe/operator lane export
- pending plan pre-activation 및 live post-activation verification
- parameter/calldata metrics, migration guide와 clean package regression

## Out of Scope

- Safe service submission, signing, custody 또는 production broadcast
- GIWA 실거래 fee 예측과 실제 상품 parameter 승인
- BUIDL-like profile migration(#109)

## Stop Condition

schema mismatch나 artifact drift가 calldata export 전에 거부되고, valid REGISTER/UPDATE
plan의 exact parameter bytes·timelock·checkpoint ordering을 재현하며, 기존 config와
두 Anvil profile이 통과하면 완료한다.
