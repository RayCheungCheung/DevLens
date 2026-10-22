export default [
  {
    file: 'README_zh-CN.md',
    intro: 'DevLens 是一款面向工作流的原生开发者浏览器。',
    introDetail: '它可以在移动端和桌面端两个视口中同时预览同一个网址，并提供实时控制台与网络流、HTTP 拦截与重放、实时设计修改、侦察报告、AI 助手，以及一键跳转到编辑器的能力。',
    features: [
      '沉浸式工作区主题：Tab 列、导航栏与侧边栏融入当前主题色。',
      '双视口预览：同一页面同时在 Mobile 与 Desktop 框架中呈现，支持滚动同步。',
      'Tab Groups：按名称与颜色整理分页，支持拖拽、右键菜单、折叠与恢复。',
      'Split View：把两个已有分页并排或上下显示，无需重新加载页面。',
      'WImH 极端防护：内容保护、剪贴板清洗、威胁覆盖层与异常输入检测。',
      'DevTools 集成：Elements、Console、Network、Application 与侦察报告。',
      '智能 Omnibox：地址、搜索、命令、历史/书签/流量建议与内联补全。',
      'Workspace 与 Profile 隔离：独立 Electron partition、存储、历史和分页。'
    ],
    stack: [
      'Electron 44',
      'Vite 7',
      'React 19',
      'TypeScript（strict 模式）',
      'Tailwind CSS 4'
    ],
    gettingStarted: '从 `outputs/devlens` 目录运行以下命令：',
    scripts: [['npm install', '安装依赖'], ['npm run dev', '启动 Vite dev server 与 Electron 并启用 HMR'], ['npm run build', '先执行类型检查，再构建 out/'], ['npm run start', '运行已构建的 out/ 应用'], ['npm run typecheck', '对 main、preload 和 renderer 执行 tsc --noEmit']],
    headings: { features: '核心功能', techStack: '技术栈', gettingStarted: '快速开始', shortcuts: '快捷键', license: '许可证', contributing: '参与贡献' },
    tableHeaders: { script: '脚本', description: '说明', action: '操作', shortcut: '快捷键' },
    shortcuts: [['新建分页', 'Ctrl+T'], ['关闭分页', 'Ctrl+W'], ['重新加载页面', 'Ctrl+R'], ['页面内查找', 'Ctrl+F'], ['打开设置', 'Ctrl+,'], ['新建私密分页', 'Ctrl+Shift+P'], ['打开 Shell DevTools', 'F12'], ['打开 Elements 面板', 'Ctrl+Shift+I'], ['打开 Console 面板', 'Ctrl+Shift+J'], ['打开 Network 面板', 'Ctrl+Shift+E'], ['切换侧边栏', 'Ctrl+Shift+B'], ['切换 Ghost 模式', 'Ctrl+Shift+G'], ['切换 WImH 防护', 'Ctrl+Shift+H'], ['切换到最近使用的分页', 'Ctrl+Tab']],
    license: '本项目基于 [MIT License](../../LICENSE) 发布。',
    contributing: '欢迎提交 issue 与 pull request。请保持 TypeScript strict 模式，并在提交前运行 `npm run typecheck` 与相关的验证脚本。'
  },
  {
    file: 'README_zh-TW.md',
    intro: 'DevLens 是一款以工作流為中心的原生開發者瀏覽器。',
    introDetail: '它能在行動版與桌面版兩個視口中同時預覽同一個網址，並提供即時 Console 與網路流、HTTP 攔截與重放、即時設計修改、偵察報告、AI 助理，以及一鍵移交到編輯器的功能。',
    features: [
      '沉浸式工作區主題：Tab 列、導覽列與側邊欄融入目前主題色。',
      '雙視口預覽：同一頁面同時顯示在 Mobile 與 Desktop 框架中，支援捲動同步。',
      'Tab Groups：以名稱與顏色整理分頁，支援拖曳、右鍵選單、摺疊與還原。',
      'Split View：將兩個既有分頁左右或上下並列顯示，不需重新載入頁面。',
      'WImH 極端防護：內容保護、剪貼簿清洗、威脅覆蓋層與異常輸入偵測。',
      'DevTools 整合：Elements、Console、Network、Application 與偵察報告。',
      '智慧 Omnibox：網址、搜尋、指令、歷史/書籤/流量建議與內聯補全。',
      'Workspace 與 Profile 隔離：獨立 Electron partition、儲存空間、歷史與分頁。'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript（strict 模式）', 'Tailwind CSS 4'],
    gettingStarted: '請在 `outputs/devlens` 目錄執行下列指令：',
    scripts: [['npm install', '安裝相依套件'], ['npm run dev', '啟動 Vite dev server、Electron 與 HMR'], ['npm run build', '先執行型別檢查，再建置 out/'], ['npm run start', '執行已建置的 out/ 應用'], ['npm run typecheck', '對 main、preload 與 renderer 執行 tsc --noEmit']],
    headings: { features: '核心功能', techStack: '技術堆疊', gettingStarted: '快速開始', shortcuts: '鍵盤快捷鍵', license: '授權條款', contributing: '參與貢獻' },
    tableHeaders: { script: '指令', description: '說明', action: '操作', shortcut: '快捷鍵' },
    shortcuts: [['新增分頁', 'Ctrl+T'], ['關閉分頁', 'Ctrl+W'], ['重新載入頁面', 'Ctrl+R'], ['頁面內搜尋', 'Ctrl+F'], ['開啟設定', 'Ctrl+,'], ['新增私密分頁', 'Ctrl+Shift+P'], ['開啟 Shell DevTools', 'F12'], ['開啟 Elements 面板', 'Ctrl+Shift+I'], ['開啟 Console 面板', 'Ctrl+Shift+J'], ['開啟 Network 面板', 'Ctrl+Shift+E'], ['切換側邊欄', 'Ctrl+Shift+B'], ['切換 Ghost 模式', 'Ctrl+Shift+G'], ['切換 WImH 防護', 'Ctrl+Shift+H'], ['切換到最近使用的分頁', 'Ctrl+Tab']],
    license: '本專案採用 [MIT License](../../LICENSE) 授權。',
    contributing: '歡迎提交 issue 與 pull request。請維持 TypeScript strict 模式，並在提交前執行 `npm run typecheck` 與相關驗證腳本。'
  },
  {
    file: 'README_ko.md',
    intro: 'DevLens는 워크플로 중심의 개발자 브라우저입니다.',
    introDetail: '하나의 URL을 모바일과 데스크톱 프레임에서 동시에 미리 보고, 실시간 콘솔/네트워크 스트림, HTTP 인터셉터와 리피터, 라이브 디자인 편집, 리콘 리포트, AI 어시스턴트, 편집기로의 한 번 클릭 전환을 제공합니다.',
    features: ['몰입형 워크스페이스 테마: 탭 표시줄, 내비게이션 바, 사이드바가 테마 색과 어우러집니다.', '듀얼 뷰포트 미리 보기: 동일 페이지를 모바일 및 데스크톱 프레임에서 동시에 표시하고 스크롤을 동기화합니다.', 'Tab Groups: 이름과 색상으로 탭을 정리하고 드래그, 컨텍스트 메뉴, 접기/펼치기를 지원합니다.', 'Split View: 기존 탭 두 개를 새로 고치지 않고 좌우 또는 상하로 배치합니다.', 'WImH 극한 보호: 콘텐츠 보호, 클립보드 정리, 위협 오버레이, 비정상 입력 감지.', 'DevTools 통합: Elements, Console, Network, Application 및 리콘 리포트.', '스마트 Omnibox: 주소, 검색, 명령, 기록/북마크/트래픽 제안과 인라인 완성.', '워크스페이스 및 프로필 격리: 별도 Electron 파티션, 저장소, 기록, 탭 세션.'],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript(strict 모드)', 'Tailwind CSS 4'],
    gettingStarted: '`outputs/devlens` 디렉터리에서 다음 명령을 실행하세요.',
    scripts: [['npm install', '의존성 설치'], ['npm run dev', 'Vite 개발 서버, Electron, HMR 시작'], ['npm run build', '타입 검사 후 out/ 빌드'], ['npm run start', '빌드된 out/ 앱 실행'], ['npm run typecheck', 'main, preload, renderer에 대해 tsc --noEmit 실행']],
    headings: { features: '주요 기능', techStack: '기술 스택', gettingStarted: '시작하기', shortcuts: '키보드 단축키', license: '라이선스', contributing: '기여하기' },
    tableHeaders: { script: '명령', description: '설명', action: '동작', shortcut: '단축키' },
    shortcuts: [['새 탭', 'Ctrl+T'], ['탭 닫기', 'Ctrl+W'], ['페이지 새로 고침', 'Ctrl+R'], ['페이지 내 찾기', 'Ctrl+F'], ['설정 열기', 'Ctrl+,'], ['새 비공개 탭', 'Ctrl+Shift+P'], ['Shell DevTools 열기', 'F12'], ['Elements 패널 열기', 'Ctrl+Shift+I'], ['Console 패널 열기', 'Ctrl+Shift+J'], ['Network 패널 열기', 'Ctrl+Shift+E'], ['사이드바 전환', 'Ctrl+Shift+B'], ['Ghost 모드 전환', 'Ctrl+Shift+G'], ['WImH 보호 전환', 'Ctrl+Shift+H'], ['최근 사용한 탭으로 전환', 'Ctrl+Tab']],
    license: '이 프로젝트는 [MIT 라이선스](../../LICENSE)로 배포됩니다.',
    contributing: '이슈와 풀 리퀘스트를 환영합니다. TypeScript strict 모드를 유지하고 커밋 전에 `npm run typecheck`와 관련 검증 스크립트를 실행해 주세요.'
  },
  {
    file: 'README_de.md',
    intro: 'DevLens ist ein workflow-orientierter Entwickler-Browser.',
    introDetail: 'Er zeigt dieselbe URL gleichzeitig in einem mobilen und einem Desktop-Rahmen an und bietet eine Live-Konsole und Netzwerkansicht, HTTP-Interceptor und Repeater, Live-Design-Änderungen, Recon-Berichte, einen KI-Assistenten sowie einen Klick-Übergang zum Editor.',
    features: ['Immersive Workspace-Themes: Tab-Leiste, Navigationsleiste und Sidebar nehmen die Akzentfarbe der Workspace-Themes auf.', 'Dual-Viewport-Vorschau: Dieselbe Seite gleichzeitig in Mobile- und Desktop-Rahmen mit Scroll-Synchronisierung.', 'Tab Groups: Tabs nach Namen und Farbe sortieren, per Drag-and-Drop oder Kontextmenü zuordnen, falten und wiederherstellen.', 'Split View: Zwei vorhandene Tabs nebeneinander oder übereinander anzeigen, ohne die Seiten neu zu laden.', 'WImH-Schutz: Content-Protection, Clipboard-Scrubbing, Warn-Overlay und Erkennung ungewöhnlicher Eingaben.', 'DevTools-Integration: Elements, Console, Network, Application und Recon-Berichte.', 'Smarte Omnibox: Adressen, Suchen, Befehle, Verlauf/Lesezeichen/Traffic-Vorschläge und Inline-Vervollständigung.', 'Workspace- und Profil-Isolation: getrennte Electron-Partitions, Speicher, Verlauf und Tabs.'],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (Strict Mode)', 'Tailwind CSS 4'],
    gettingStarted: 'Führen Sie die folgenden Befehle im Verzeichnis `outputs/devlens` aus:',
    scripts: [['npm install', 'Abhängigkeiten installieren'], ['npm run dev', 'Vite-Dev-Server, Electron und HMR starten'], ['npm run build', 'Typen prüfen und out/ bauen'], ['npm run start', 'Die gebaute App in out/ ausführen'], ['npm run typecheck', 'tsc --noEmit für main, preload und renderer ausführen']],
    headings: { features: 'Funktionen', techStack: 'Technologie-Stack', gettingStarted: 'Erste Schritte', shortcuts: 'Tastenkürzel', license: 'Lizenz', contributing: 'Mitwirken' },
    tableHeaders: { script: 'Skript', description: 'Beschreibung', action: 'Aktion', shortcut: 'Tastenkürzel' },
    shortcuts: [['Neuer Tab', 'Ctrl+T'], ['Tab schließen', 'Ctrl+W'], ['Seite neu laden', 'Ctrl+R'], ['Auf der Seite suchen', 'Ctrl+F'], ['Einstellungen öffnen', 'Ctrl+,'], ['Neuer privater Tab', 'Ctrl+Shift+P'], ['Shell-DevTools öffnen', 'F12'], ['Elements-Panel öffnen', 'Ctrl+Shift+I'], ['Console-Panel öffnen', 'Ctrl+Shift+J'], ['Network-Panel öffnen', 'Ctrl+Shift+E'], ['Sidebar umschalten', 'Ctrl+Shift+B'], ['Ghost-Modus umschalten', 'Ctrl+Shift+G'], ['WImH-Schutz umschalten', 'Ctrl+Shift+H'], ['Zuletzt verwendeten Tab aktivieren', 'Ctrl+Tab']],
    license: 'Dieses Projekt steht unter der [MIT-Lizenz](../../LICENSE).',
    contributing: 'Issues und Pull Requests sind willkommen. Bitte bewahren Sie den TypeScript-Strict-Modus und führen Sie vor dem Einreichen `npm run typecheck` und die relevanten Verifikationsskripte aus.'
  }
]
