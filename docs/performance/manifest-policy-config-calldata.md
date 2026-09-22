# ManifestPolicyConfig calldata measurement

## Scope

이 측정은 schema v5 Toolkit과 Registry가 허용하는 최대 입력의 **calldata 크기**를
재현한다. GIWA Sepolia의 관측 block gas limit은 60,000,000이지만 calldata 비용만으로
transaction 실행 가능성이나 실제 수수료를 보장하지 않는다.

## Worst bounded input

- Recipe binding: 8
- binding당 Element rule: 32
- parameter entry: 256
- total raw parameter bytes: 16,384
- enforcement override: 256
- entry당 parameter bytes: 64

`scheduleManifestUpdate` ABI encoding 결과:

| 항목 | 측정값 |
| --- | ---: |
| calldata | 100,292 bytes |
| calldata gas upper bound | 1,604,672 gas |
| GIWA observed block gas limit 대비 | 약 2.68% |

upper bound는 모든 calldata byte를 non-zero로 계산한 `bytes × 16`이다. storage write,
Registry validation, hashing, Safe overhead와 L1 data fee는 포함하지 않는다.

## Operational gate

- Toolkit plan은 실제 config의 `entryCount`, `totalParameterBytes`, 정확한 Manifest
  calldata bytes와 calldata-only gas upper bound를 출력한다.
- 16,384-byte boundary는 smoke test로 accept하고 1-byte 초과는 export 전에 거부한다.
- production Safe proposal은 target GIWA RPC에서 exact calldata로 `eth_estimateGas`와
  fork simulation을 별도로 통과해야 한다.
- execution estimate가 block gas limit에 접근하거나 RPC가 추정을 거부하면 config를
  여러 transaction으로 임의 분할하지 않는다. Manifest/config 원자성을 유지하고
  정책 구조나 protocol bound를 별도 versioned change로 재검토한다.
