# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens는 워크플로 중심의 개발자 브라우저입니다.

하나의 URL을 모바일과 데스크톱 프레임에서 동시에 미리 보고, 실시간 콘솔/네트워크 스트림, HTTP 인터셉터와 리피터, 라이브 디자인 편집, 리콘 리포트, AI 어시스턴트, 편집기로의 한 번 클릭 전환을 제공합니다.

## 주요 기능

- 몰입형 워크스페이스 테마: 탭 표시줄, 내비게이션 바, 사이드바가 테마 색과 어우러집니다.
- 듀얼 뷰포트 미리 보기: 동일 페이지를 모바일 및 데스크톱 프레임에서 동시에 표시하고 스크롤을 동기화합니다.
- Tab Groups: 이름과 색상으로 탭을 정리하고 드래그, 컨텍스트 메뉴, 접기/펼치기를 지원합니다.
- Split View: 기존 탭 두 개를 새로 고치지 않고 좌우 또는 상하로 배치합니다.
- WImH 극한 보호: 콘텐츠 보호, 클립보드 정리, 위협 오버레이, 비정상 입력 감지.
- DevTools 통합: Elements, Console, Network, Application 및 리콘 리포트.
- 스마트 Omnibox: 주소, 검색, 명령, 기록/북마크/트래픽 제안과 인라인 완성.
- 워크스페이스 및 프로필 격리: 별도 Electron 파티션, 저장소, 기록, 탭 세션.

## 기술 스택

- Electron 44
- Vite 7
- React 19
- TypeScript(strict 모드)
- Tailwind CSS 4

## 시작하기

`outputs/devlens` 디렉터리에서 다음 명령을 실행하세요.

| 명령 | 설명 |
| --- | --- |
| `npm install` | 의존성 설치 |
| `npm run dev` | Vite 개발 서버, Electron, HMR 시작 |
| `npm run build` | 타입 검사 후 out/ 빌드 |
| `npm run start` | 빌드된 out/ 앱 실행 |
| `npm run typecheck` | main, preload, renderer에 대해 tsc --noEmit 실행 |

## 키보드 단축키

| 동작 | 단축키 |
| --- | --- |
| 새 탭 | `Ctrl+T` |
| 탭 닫기 | `Ctrl+W` |
| 페이지 새로 고침 | `Ctrl+R` |
| 페이지 내 찾기 | `Ctrl+F` |
| 설정 열기 | `Ctrl+,` |
| 새 비공개 탭 | `Ctrl+Shift+P` |
| Shell DevTools 열기 | `F12` |
| Elements 패널 열기 | `Ctrl+Shift+I` |
| Console 패널 열기 | `Ctrl+Shift+J` |
| Network 패널 열기 | `Ctrl+Shift+E` |
| 사이드바 전환 | `Ctrl+Shift+B` |
| Ghost 모드 전환 | `Ctrl+Shift+G` |
| WImH 보호 전환 | `Ctrl+Shift+H` |
| 최근 사용한 탭으로 전환 | `Ctrl+Tab` |

## 라이선스

이 프로젝트는 [MIT 라이선스](../../LICENSE)로 배포됩니다.

## 기여하기

이슈와 풀 리퀘스트를 환영합니다. TypeScript strict 모드를 유지하고 커밋 전에 `npm run typecheck`와 관련 검증 스크립트를 실행해 주세요.

