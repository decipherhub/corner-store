# Corner Store Documentation

이 디렉터리는 제품 범위, 아키텍처 책임, 개발 순서를 서로 다른 문서로 관리한다.
같은 내용을 여러 문서에서 다시 정의하지 않고 아래 우선순위를 따른다.

## Start Here

| 문서 | 역할 | 상태 |
| ---------------------------------------------------- | ----------------------------- | ---------- |
| [`MVP-v2-multi-venue.md`](./MVP-v2-multi-venue.md) | 현재 제품 범위와 전체 설계 | Current |
| [`architecture/README.md`](./architecture/README.md) | 책임 레이어와 경계 인덱스 | Current |
| [`ROADMAP.md`](./ROADMAP.md) | 구현 순서, 완료 조건, blocker | Current |
| [`pm/README.md`](./pm/README.md) | 프로젝트 큰 흐름·현재 위치·병목, PM 운영 규약 | Current |
| [`compliance/README.md`](./compliance/README.md) | 규제 요구사항의 법적 근거와 Element/Recipe 사양 (Legal-to-Technical) | Current |
| [`methodology/legal-to-code-general-principles.md`](./methodology/legal-to-code-general-principles.md) | 법령을 코드 사양으로 변환하는 일반 원리 | Current |
| [`MVP.md`](./MVP.md) | 초기 AMM 중심 설계 기록 | Superseded |

Uniswap v3 배포 도구의 실제 포함 범위와 의존성은
[`tools/deploy-v3/CORNER_STORE_PROFILE.md`](../tools/deploy-v3/CORNER_STORE_PROFILE.md)를
참조한다. `compliance/`의 원자료 배경 노트는 [`context/`](./context)에 보존한다.

## For Developers

처음 구현에 들어가는 개발자는 다음 순서로 읽으면 빠르다.

1. [`pm/00-project-chronicle.md`](./pm/00-project-chronicle.md) — 무엇을 왜 만드는지, 지금 위치와 병목
2. [`architecture/README.md`](./architecture/README.md) — 책임 레이어와 trust boundary
3. [`methodology/legal-to-code-general-principles.md`](./methodology/legal-to-code-general-principles.md) — 법 → 코드 변환 패턴·원리
4. [`compliance/04-element-interface.md`](./compliance/04-element-interface.md) → [`compliance/elements/A-13_qualified-purchaser.md`](./compliance/elements/A-13_qualified-purchaser.md) — Element 인터페이스와 실제 변환 예시
5. [`ROADMAP.md`](./ROADMAP.md) — 어느 Phase부터 구현하는지와 완료 조건

## Source Of Truth

- 제품 범위와 전체 상호작용: `MVP-v2-multi-venue.md`
- 컴포넌트 책임, trust boundary, 불변성: `architecture/`
- 구현 순서와 완료 판단: `ROADMAP.md`
- 프로젝트 큰 흐름·현재 위치·운영 방식: `pm/`
- 규제 요구사항의 법적 근거와 Element/Recipe 사양: `compliance/`
- 법 → 코드 변환 방법론: `methodology/`
- vendored 배포 도구의 구성: `tools/deploy-v3/CORNER_STORE_PROFILE.md`

문서 간 내용이 충돌하면 더 구체적인 책임 문서를 우선하고, 충돌 자체를 방치하지
않는다. 아키텍처를 바꾸면 `MVP-v2`와 해당 레이어 문서를 함께 갱신하고, 구현
순서가 달라지면 `ROADMAP.md`를 갱신한다. 규제 요구사항이나 Element/Recipe 정의가
바뀌면 `compliance/`와 `architecture/compliance-policy.md`를 함께 갱신한다.

## Historical Documents

`MVP.md`는 삭제하지 않는다. AMM 중심 v1에서 multi-venue v2로 변경된 이유와
과거 가정을 추적하기 위한 설계 기록이다.
