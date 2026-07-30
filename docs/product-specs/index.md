# Product Specification Index

제품 범위와 세부 요구사항은 아래 문서를 source of truth로 사용한다.

| 문서 | 역할 | 상태 |
| --- | --- | --- |
| [`../MVP-v2-multi-venue.md`](../MVP-v2-multi-venue.md) | SDK 제품 범위와 실행 모델 | Current |
| [`../architecture/README.md`](../architecture/README.md) | 책임 경계와 세부 아키텍처 인덱스 | Current |
| [`../architecture/asset-manifest.md`](../architecture/asset-manifest.md) | Asset Compliance Manifest 책임과 lifecycle | Current |
| [`../ROADMAP.md`](../ROADMAP.md) | 구현 순서와 완료 조건 | Current |
| [`../MVP.md`](../MVP.md) | 과거 AMM 중심 설계 기록 | Historical |
| [`buidl-like-demo-profile.md`](buidl-like-demo-profile.md) | Giwa MVP용 BUIDL-like ERC-3643 demo asset profile | Current |
| [`rfq-backend-sdk-and-demo.md`](./rfq-backend-sdk-and-demo.md) | RFQ backend SDK와 MVP demo backend 계획 | Current |
| [`production-rfq-policy.md`](./production-rfq-policy.md) | production RFQ dealer/settlement 책임과 구현 계약 | Current |

DOC-001에서 연구·회의 입력을 반영했다. 내용이 다를 경우 위 current 문서를 source
of truth로 사용한다. acquisition/state/reject/surveillance seam은 ADR-008/D012를
따르며, 실제 provider API와 production WORM/hosting은 refinement blocker다.

제품 결정을 변경할 때는 `DECISIONS.md`와 관련 source-of-truth 문서를 함께
갱신한다.
