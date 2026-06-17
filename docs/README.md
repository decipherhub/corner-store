# Corner Store Documentation

이 디렉터리는 제품 범위, 아키텍처 책임, 개발 순서를 서로 다른 문서로 관리한다.
같은 내용을 여러 문서에서 다시 정의하지 않고 아래 우선순위를 따른다.

## Start Here

| 문서                                                 | 역할                          | 상태       |
| ---------------------------------------------------- | ----------------------------- | ---------- |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md)           | 루트 아키텍처 라우터          | Current    |
| [`product-specs/index.md`](./product-specs/index.md)  | 제품 명세 인덱스              | Current    |
| [`MVP-v2-multi-venue.md`](./MVP-v2-multi-venue.md)   | SDK 제품 범위와 전체 설계     | Current    |
| [`architecture/README.md`](./architecture/README.md) | 책임 레이어와 경계 인덱스     | Current    |
| [`ROADMAP.md`](./ROADMAP.md)                         | 구현 순서, 완료 조건, blocker | Current    |
| [`testing.md`](./testing.md)                         | 테스트와 완료 기준            | Current    |
| [`security.md`](./security.md)                       | 보안 규칙                     | Current    |
| [`MVP.md`](./MVP.md)                                 | 초기 AMM 중심 설계 기록       | Superseded |

Uniswap v3 배포 도구의 실제 포함 범위와 의존성은
[`tools/deploy-v3/CORNER_STORE_PROFILE.md`](../tools/deploy-v3/CORNER_STORE_PROFILE.md)를
참조한다.

## Source Of Truth

- 제품 범위와 전체 상호작용: `MVP-v2-multi-venue.md`
- 컴포넌트 책임, trust boundary, 불변성: `architecture/`
- 구현 순서와 완료 판단: `ROADMAP.md`
- vendored 배포 도구의 구성: `tools/deploy-v3/CORNER_STORE_PROFILE.md`
- feature 상태와 세션 진행: `FEATURES.md`, `PROGRESS.md`
- 결정 이유와 품질 상태: `DECISIONS.md`, `QUALITY.md`

문서 간 내용이 충돌하면 더 구체적인 책임 문서를 우선하고, 충돌 자체를 방치하지
않는다. 아키텍처를 바꾸면 제품 baseline과 해당 책임 문서를 함께 갱신하고, 구현
순서가 달라지면 `ROADMAP.md`를 갱신한다. 회의·연구 입력보다 current source of
truth 문서가 우선한다.

## Historical Documents

`MVP.md`는 삭제하지 않는다. AMM 중심 v1에서 multi-venue v2로 변경된 이유와
과거 가정을 추적하기 위한 설계 기록이다.
