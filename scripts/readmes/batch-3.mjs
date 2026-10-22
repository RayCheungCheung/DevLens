export default [
  {
    file: 'README_da.md',
    intro: 'DevLens er en workflow-orienteret udviklerbrowser.',
    introDetail: 'Den viser samme URL i mobil- og desktoprammer med live console/netværk, HTTP-interceptor og repeater, live designredigering, rekognosceringsrapporter, AI-assistent og direkte overgang til editoren.',
    features: [
      'Immersive workspace-temaer til faner, navigation og sidebjælke.',
      'Dobbelt viewport-preview med synkroniseret rulning.',
      'Tab Groups med navne, farver, træk og slip, kontekstmenu og sammenfoldning.',
      'Split View viser to eksisterende faner uden at genindlæse dem.',
      'WImH-beskyttelse med indholdsbeskyttelse og trusselsoverlay.',
      'Integreret DevTools: Elements, Console, Network og Application.',
      'Smart omnibox med historik, bogmærker, trafik og completion.',
      'Workspace- og profilisolering med separate Electron-partitions.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Kør disse kommandoer fra `outputs/devlens`:',
    scripts: [['npm install', 'Installér afhængigheder'], ['npm run dev', 'Start Vite og Electron med HMR'], ['npm run build', 'Tjek typer og byg out/'], ['npm run start', 'Kør den byggede app'], ['npm run typecheck', 'Kør tsc --noEmit']],
    headings: { features: 'Nøglefunktioner', techStack: 'Teknologistack', gettingStarted: 'Kom i gang', shortcuts: 'Tastaturgenveje', license: 'Licens', contributing: 'Bidrag' },
    tableHeaders: { script: 'Script', description: 'Beskrivelse', action: 'Handling', shortcut: 'Genvej' },
    shortcuts: [['Ny fane', 'Ctrl+T'], ['Luk fane', 'Ctrl+W'], ['Genindlæs side', 'Ctrl+R'], ['Søg på siden', 'Ctrl+F'], ['Åbn indstillinger', 'Ctrl+,'], ['Ny privat fane', 'Ctrl+Shift+P'], ['Shell-DevTools', 'F12'], ['Elements-panel', 'Ctrl+Shift+I'], ['Console-panel', 'Ctrl+Shift+J'], ['Network-panel', 'Ctrl+Shift+E'], ['Sidebjælke', 'Ctrl+Shift+B'], ['Ghost-tilstand', 'Ctrl+Shift+G'], ['WImH-beskyttelse', 'Ctrl+Shift+H'], ['Senest brugte fane', 'Ctrl+Tab']],
    license: 'Udgivet under [MIT-licensen](../../LICENSE).',
    contributing: 'Issues og pull requests er velkomne. Kør `npm run typecheck`, inden du sender ændringer.'
  },
  {
    file: 'README_ja.md',
    intro: 'DevLens は、ワークフロー中心の開発者向けブラウザです。',
    introDetail: '同じ URL をモバイルとデスクトップのフレームで同時にプレビューし、リアルタイムのコンソール/ネットワーク、HTTP インターセプターとリピーター、ライブデザイン編集、リコレポート、AI アシスタント、エディター連携を提供します。',
    features: [
      '没入型ワークスペーステーマ: タブバー、ナビゲーションバー、サイドバーがテーマ色に調和します。',
      'デュアルビューポートプレビューとスクロール同期。',
      'Tab Groups: 名前と色で整理し、ドラッグ、右クリックメニュー、折りたたみに対応します。',
      'Split View: 既存の 2 つのタブを再読み込みなしで並べて表示します。',
      'WImH 保護: コンテンツ保護、クリップボード消去、脅威オーバーレイ。',
      'DevTools 統合: Elements、Console、Network、Application。',
      'スマート Omnibox: 履歴、ブックマーク、トラフィック候補とインライン補完。',
      'ワークスペースとプロファイルの分離: Electron パーティションを独立管理します。'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript（strict）', 'Tailwind CSS 4'],
    gettingStarted: '`outputs/devlens` で次のコマンドを実行します。',
    scripts: [['npm install', '依存関係をインストール'], ['npm run dev', 'Vite と Electron を HMR 付きで起動'], ['npm run build', '型チェック後に out/ をビルド'], ['npm run start', 'ビルド済みアプリを実行'], ['npm run typecheck', 'tsc --noEmit を実行']],
    headings: { features: '主な機能', techStack: '技術スタック', gettingStarted: 'はじめに', shortcuts: 'ショートカット', license: 'ライセンス', contributing: 'コントリビューション' },
    tableHeaders: { script: 'スクリプト', description: '説明', action: '操作', shortcut: 'ショートカット' },
    shortcuts: [['新しいタブ', 'Ctrl+T'], ['タブを閉じる', 'Ctrl+W'], ['再読み込み', 'Ctrl+R'], ['ページ内検索', 'Ctrl+F'], ['設定を開く', 'Ctrl+,'], ['プライベートタブ', 'Ctrl+Shift+P'], ['Shell DevTools', 'F12'], ['Elements', 'Ctrl+Shift+I'], ['Console', 'Ctrl+Shift+J'], ['Network', 'Ctrl+Shift+E'], ['サイドバー', 'Ctrl+Shift+B'], ['Ghost モード', 'Ctrl+Shift+G'], ['WImH 保護', 'Ctrl+Shift+H'], ['最近使ったタブ', 'Ctrl+Tab']],
    license: '[MIT ライセンス](../../LICENSE)で公開されています。',
    contributing: 'Issue と Pull Request を歓迎します。変更前に `npm run typecheck` を実行してください。'
  },
  {
    file: 'README_pl.md',
    intro: 'DevLens to przeglądarka dla programistów skoncentrowana na przepływie pracy.',
    introDetail: 'Wyświetla ten sam adres URL jednocześnie w ramkach mobilnej i desktopowej, oferuje konsolę i sieć w czasie rzeczywistym, interceptor i repeater HTTP, edycję wyglądu, raporty rozpoznania, asystenta AI i bezpośrednie przekazanie do edytora.',
    features: [
      'Immersyjne motywy workspace na pasku kart, nawigacji i panelu bocznym.',
      'Podgląd w dwóch viewportach z synchronizacją przewijania.',
      'Tab Groups z nazwami, kolorami, przeciąganiem, menu kontekstowym i zwijaniem.',
      'Split View pokazuje dwie istniejące karty bez ich ponownego ładowania.',
      'Ochrona WImH z ochroną zawartości i nakładką zagrożeń.',
      'Zintegrowane DevTools: Elements, Console, Network i Application.',
      'Inteligentny omnibox z historią, zakładkami, ruchem i uzupełnianiem.',
      'Izolacja workspace i profilu za pomocą partycji Electron.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Uruchom te polecenia w katalogu `outputs/devlens`:',
    scripts: [['npm install', 'Instalacja zależności'], ['npm run dev', 'Start Vite i Electron z HMR'], ['npm run build', 'Sprawdzenie typów i budowanie out/'], ['npm run start', 'Uruchomienie zbudowanej aplikacji'], ['npm run typecheck', 'Uruchomienie tsc --noEmit']],
    headings: { features: 'Kluczowe funkcje', techStack: 'Stack technologiczny', gettingStarted: 'Szybki start', shortcuts: 'Skróty klawiszowe', license: 'Licencja', contributing: 'Wkład' },
    tableHeaders: { script: 'Skrypt', description: 'Opis', action: 'Akcja', shortcut: 'Skrót' },
    shortcuts: [['Nowa karta', 'Ctrl+T'], ['Zamknij kartę', 'Ctrl+W'], ['Odśwież stronę', 'Ctrl+R'], ['Znajdź na stronie', 'Ctrl+F'], ['Otwórz ustawienia', 'Ctrl+,'], ['Nowa karta prywatna', 'Ctrl+Shift+P'], ['DevTools powłoki', 'F12'], ['Panel Elements', 'Ctrl+Shift+I'], ['Panel Console', 'Ctrl+Shift+J'], ['Panel Network', 'Ctrl+Shift+E'], ['Panel boczny', 'Ctrl+Shift+B'], ['Tryb Ghost', 'Ctrl+Shift+G'], ['Ochrona WImH', 'Ctrl+Shift+H'], ['Ostatnio użyta karta', 'Ctrl+Tab']],
    license: 'Projekt wydano na [licencji MIT](../../LICENSE).',
    contributing: 'Zgłoszenia i pull requesty są mile widziane. Przed wysłaniem zmian uruchom `npm run typecheck`.'
  },
  {
    file: 'README_ru.md',
    intro: 'DevLens — браузер для разработчиков, ориентированный на рабочий процесс.',
    introDetail: 'Он показывает один URL одновременно в мобильном и десктопном кадре, предоставляет консоль и сеть в реальном времени, HTTP-перехватчик и повторитель, живое редактирование дизайна, отчеты разведки, AI-ассистента и быстрый переход в редактор.',
    features: [
      'Иммерсивные темы workspace в панели вкладок, навигации и боковой панели.',
      'Двойной просмотр viewport с синхронизацией прокрутки.',
      'Tab Groups с названиями, цветами, перетаскиванием, контекстным меню и свертыванием.',
      'Split View показывает две существующие вкладки без их перезагрузки.',
      'Защита WImH с защитой содержимого и предупреждениями об угрозах.',
      'Интеграция DevTools: Elements, Console, Network и Application.',
      'Умный omnibox с историей, закладками, трафиком и подсказками.',
      'Изоляция workspace и профиля через отдельные partitions Electron.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Выполните эти команды из каталога `outputs/devlens`:',
    scripts: [['npm install', 'Установить зависимости'], ['npm run dev', 'Запустить Vite и Electron с HMR'], ['npm run build', 'Проверить типы и собрать out/'], ['npm run start', 'Запустить собранное приложение'], ['npm run typecheck', 'Выполнить tsc --noEmit']],
    headings: { features: 'Ключевые возможности', techStack: 'Технологический стек', gettingStarted: 'Быстрый старт', shortcuts: 'Сочетания клавиш', license: 'Лицензия', contributing: 'Участие' },
    tableHeaders: { script: 'Скрипт', description: 'Описание', action: 'Действие', shortcut: 'Сочетание' },
    shortcuts: [['Новая вкладка', 'Ctrl+T'], ['Закрыть вкладку', 'Ctrl+W'], ['Обновить страницу', 'Ctrl+R'], ['Найти на странице', 'Ctrl+F'], ['Открыть настройки', 'Ctrl+,'], ['Новая приватная вкладка', 'Ctrl+Shift+P'], ['DevTools оболочки', 'F12'], ['Панель Elements', 'Ctrl+Shift+I'], ['Панель Console', 'Ctrl+Shift+J'], ['Панель Network', 'Ctrl+Shift+E'], ['Боковая панель', 'Ctrl+Shift+B'], ['Режим Ghost', 'Ctrl+Shift+G'], ['Защита WImH', 'Ctrl+Shift+H'], ['Последняя вкладка', 'Ctrl+Tab']],
    license: 'Проект распространяется по [лицензии MIT](../../LICENSE).',
    contributing: 'Вопросы и pull request приветствуются. Перед отправкой изменений запустите `npm run typecheck`.'
  },
  {
    file: 'README_bs.md',
    intro: 'DevLens je preglednik za programere usmjeren na radni tok.',
    introDetail: 'Prikazuje isti URL istovremeno u mobilnom i desktop okviru, nudi konzolu i mrežu u stvarnom vremenu, HTTP presretač i repeater, izmjenu dizajna, izvještaje o prepoznavanju, AI pomoćnika i direktan prelaz u editor.',
    features: [
      'Imersivne workspace teme na traci kartica, navigaciji i bočnoj traci.',
      'Pregled s dva viewporta uz sinhronizaciju pomjeranja.',
      'Tab Groups s imenima, bojama, povlačenjem, kontekstnim menijem i sažimanjem.',
      'Split View prikazuje dvije postojeće kartice bez ponovnog učitavanja.',
      'WImH zaštita sa zaštitom sadržaja i upozorenjima o prijetnjama.',
      'Integrirani DevTools: Elements, Console, Network i Application.',
      'Pametni omnibox s historijom, markama, prometom i dopunjavanjem.',
      'Izolacija workspacea i profila putem Electron particija.'
    ],
    stack: ['Electron 44', 'Vite 7', 'React 19', 'TypeScript (strict)', 'Tailwind CSS 4'],
    gettingStarted: 'Pokrenite ove naredbe iz direktorija `outputs/devlens`:',
    scripts: [['npm install', 'Instalacija zavisnosti'], ['npm run dev', 'Pokretanje Vite i Electron s HMR'], ['npm run build', 'Provjera tipova i build out/'], ['npm run start', 'Pokretanje izgrađene aplikacije'], ['npm run typecheck', 'Pokretanje tsc --noEmit']],
    headings: { features: 'Ključne funkcije', techStack: 'Tehnološki stack', gettingStarted: 'Brzi početak', shortcuts: 'Prečice', license: 'Licenca', contributing: 'Doprinos' },
    tableHeaders: { script: 'Skripta', description: 'Opis', action: 'Radnja', shortcut: 'Prečica' },
    shortcuts: [['Nova kartica', 'Ctrl+T'], ['Zatvori karticu', 'Ctrl+W'], ['Ponovno učitaj', 'Ctrl+R'], ['Traži na stranici', 'Ctrl+F'], ['Otvori postavke', 'Ctrl+,'], ['Nova privatna kartica', 'Ctrl+Shift+P'], ['Shell DevTools', 'F12'], ['Elements panel', 'Ctrl+Shift+I'], ['Console panel', 'Ctrl+Shift+J'], ['Network panel', 'Ctrl+Shift+E'], ['Bočna traka', 'Ctrl+Shift+B'], ['Ghost režim', 'Ctrl+Shift+G'], ['WImH zaštita', 'Ctrl+Shift+H'], ['Nedavna kartica', 'Ctrl+Tab']],
    license: 'Objavljeno pod [MIT licencom](../../LICENSE).',
    contributing: 'Pitanja i pull requesti su dobrodošli. Prije slanja izmjena pokrenite `npm run typecheck`.'
  }
]
