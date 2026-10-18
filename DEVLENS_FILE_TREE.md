# DevLens - File Tree & Architecture Map

Every file and directory in the DevLens codebase, what it is responsible for, and what it
exports. Paths are relative to the application root (`outputs/devlens`).

Last updated against the build that ships: tab context menu, favicon fetcher, site protection
panel, the omnibox router with prefix marks and the `%` tab switcher, tab-level maximum
protection ("private tab"), the rebuilt front page with its widget grid, and the bookmarks bar
with drag-and-drop ordering, folders and separators, plus the mode-aware left dock and the
multi-model AI side panel (the provider's own site, with one action of DevLens's), and bookmark
import/export in both the browser formats.

**Scope.** Everything under the application root except `node_modules/` (dependencies),
`out/` (generated bundles) and `package-lock.json`'s contents. The verification harness lives
*outside* the app directory at `work/verify/` and is documented in its own section because it is
the project's test suite.

## At a glance

| Layer | Directory | Runs in | Responsibility |
| --- | --- | --- | --- |
| 1 | `src/main/` | Electron main process (Node) | Window + session management, all network interception, storage, defense, protection, AI, IPC handlers |
| 2 | `src/preload/` | Bridged contexts | Two bridges: `window.devlens` for the shell, and the guest bridge injected into every `<webview>` |
| 3 | `src/shared/` | Bundled into all three | Pure contracts and logic: types, IPC channel names, omnibox grammar/ranking, mode + protection tables, recon/report builders |
| 4 | `src/renderer/` | Chromium (the shell) | React UI: tabs, toolbar, omnibox, sidebar panels, dashboard, overlays |

```
                 +----------------------------------------------------------+
                 |  main process (src/main)                                 |
   IPC  <------> |  window.ts  sessions.ts  interceptor.ts  protection.ts   |
                 |  wimh.ts  profiles.ts  mode.ts  storage.ts  favicon.ts   |
                 +--------------------------+-------------------------------+
                                            | webPreferences.preload
                 +--------------------------v-------------------------------+
                 |  preload (src/preload)                                   |
                 |  index.ts  -> window.devlens      webview.ts -> guest    |
                 +--------------------------+-------------------------------+
                                            | contextBridge
                 +--------------------------v-------------------------------+
                 |  renderer (src/renderer)  App.tsx owns all shell state   |
                 |  Toolbar / TabStrip / Omnibox / Sidebar / ViewportFrame   |
                 +----------------------------------------------------------+
                                            | <webview partition=...>
                 +----------------------------------------------------------+
                 |  target websites (isolated guests, sandboxed preload)    |
                 +----------------------------------------------------------+
```

## Root

| Path | Purpose | Key exports / notes |
| --- | --- | --- |
| `package.json` | Scripts (`dev`, `build`, `start`, `typecheck:node/preload/web`), Electron 44 + Vite 7 + React 19 + Tailwind 4 dependencies | `main: out/main/index.js` |
| `electron.vite.config.ts` | Builds the three targets; aliases `@shared` and `@renderer`; preload emitted as CommonJS (sandboxed renderers cannot load ESM preloads) | `defineConfig` |
| `devlens.config.json` | Runtime configuration: workspace root, home URL, partition, IDE target, AI provider, interceptor limits, ghost/WImH/protection/ntp settings | consumed by `src/main/config.ts` |
| `tsconfig.json` / `tsconfig.node.json` / `tsconfig.preload.json` / `tsconfig.web.json` | One strict config per target so a Node import cannot leak into the renderer | `strict`, path aliases |
| `README.md` | Feature documentation and the design rationale (modes, protection levels, profiles, omnibox, defense, dashboard) | - |
| `.gitignore` | Ignores build output and local state | - |

## `src/main` - main process

Node/Electron side. Owns every privilege: window creation, sessions, the request pipeline, disk,
the clipboard and all IPC handlers.

| File | Responsibility | Key exports / notable deps |
| --- | --- | --- |
| `index.ts` | Boot sequence and the single IPC registration point (95 channels). Creates the window, wires sessions/interceptor/protection/mode/profiles/defense/private tabs, registers every `ipcMain` handler, and flushes debounced stores on `before-quit` | `boot()` internal; imports almost every module below |
| `window.ts` | Shell window: frameless (`titleBarStyle: 'hidden'` + overlay on Windows/Linux, `hiddenInset` on macOS), navigation hardening, `will-attach-webview` policy, and the mode-dependent application menu (the Window role deliberately has no `Close` accelerator, so `Ctrl+W` belongs to the tab strip) | `createShellWindow`, `applyModeMenu`, `isGuestContents` |
| `mode.ts` | Workspace-mode truth: normal vs dev, what each enforces, and the **on-demand inspection lease** the WImH overlay borrows in normal mode | `configureMode`, `setMode`, `capabilities`, `isMonitoringEnabled`, `areRulesEnabled`, `isAiEnabled`, `forcesTrackerBlocking`, `setInspectionLease`, `inspectionStateNow`, `noteLeaseRequest`, `noteLeaseConsole`, `clearLeaseCounters`, `modeStateNow` |
| `protection.ts` | Privacy dial engine: the level table, tracking tiers, header hardening (DNT/GPC, client-hint removal, cross-site referer trimming), per-site exemptions and the counters the menus display. Both decisions take an optional per-session policy, which is how a private tab enforces Level 3 while the window sits on Standard | `configureProtection`, `setProtectionLevel`, `protectionPolicyNow`, `protectionBlocksUrl`, `applyProtectionHeaders`, `siteHostOf`, `isSiteAllowed`, `setSiteAllowed`, `protectionStateNow`, `noteProtectionBlocked/Headers/RefererTrimmed` |
| `sessions.ts` | Session profiles and tracker policy: ghost/sandbox partitions, `persist:` choices, session hardening, origin-scoped clearing, cookie reads/writes for the storage inspector, and the decision helpers the interceptor calls. Both the cookie and the clear calls take the partition, because a private tab's session is per tab | `GHOST_PARTITION`, `SANDBOX_PARTITION`, `shouldBlockTrackers`, `shouldCancelTrackingUrl`, `activeViewportSession`, `clearSiteData`, `clearProfileData`, `listCookies`, `removeCookie`, `enterGhost`, `exitGhost`, `hardenSession`, `openSandboxWindow` |
| `interceptor.ts` | The request pipeline (`onBeforeRequest` / `onBeforeSendHeaders` / `onCompleted` / `onErrorOccurred`): capture with body previews, block/redirect/header rules, hold-resume-drop, the Repeater's outbound request, and the per-level header policy. A session can be instrumented with a fixed policy and a private-tab id, so its blocks are counted on that tab rather than on the window | `configureInterceptor`, `instrumentInterceptor`, `InterceptorSessionOptions`, `interceptorSnapshot`, `setEnabled`, `setPauseAll`, `setRules`, `resumeHeld`, `dropHeld`, `clearCaptures`, `releaseAllHeld`, `sendRepeater`, `matchesPattern` |
| `private-tabs.ts` | **Tab-level maximum protection**: one in-memory `ghost-incognito-<tabId>` partition per private tab, created empty and hardened on open, wiped (storage, cache, auth, DNS) and forgotten on close. Owns the per-tab counters for cancellations, header rewrites and refused history writes; the request pipeline is injected at boot so this module never imports the interceptor | `configurePrivateTabs`, `openPrivateTab`, `closePrivateTab`, `wipePrivateSession`, `privateTabsNow`, `privateTabNow`, `isPrivateTabOpen`, `notePrivateBlocked/Headers/HistoryBlocked` |
| `wimh.ts` | "What If am Hacked" extreme defense: RAM-only session, cookie downgrade, history refusal, secret buffers + zeroing, clipboard sentinel, content protection | `WIMH_PARTITION`, `setWimhEnabled`, `wimhStateNow`, `registerSecret`, `scrubNow`, `guardClipboardWrite`, `classifyClipboard`, `setClipboardTtl`, `enforceRamOnly`, `noteHistoryBlocked`, `notePasteBlocked`, `protectWindow` |
| `profiles.ts` | Profile registry (`profiles.json`): identities, avatars, `askOnStartup`, persistent partitions, `lastUsedAt`, and `markInstrumented` so a switched-to partition gets the request hooks | `configureProfiles`, `listProfiles`, `activeProfile`, `activeProfileId`, `activeProfilePartition`, `createProfile`, `switchProfile`, `deleteProfile`, `askOnStartupNow`, `setAskOnStartup`, `flushProfileRegistry`, `markInstrumented` |
| `storage.ts` | Per-profile data directory: `userData/profiles/<profileId>/`, resolved at call time so a switch redirects the next read/write | `profileDataDir`, `profileFile` |
| `history.ts` | Visited pages, debounced write, hot-swapped on profile change, with the target file frozen at schedule time and a `flushHistory()` for profile switches and quit. `historyAdd` refuses `private` visits itself, so a private tab cannot reach the store even if a caller forgot to look | `historyAdd`, `historyList`, `historyClear`, `flushHistory` |
| `preferences.ts` | **Per-profile preferences**: `preferences.json` next to the profile's history and bookmarks, read fresh on a profile switch and landed before the swap, currently holding which AI assistant the profile uses | `preferencesNow`, `setPreferences`, `flushPreferences`, `ProfilePreferences` |
| `bookmarks.ts` | **The bookmark store**: three ordered roots (toolbar, menu, other) with folders, separators and links inside them, one versioned file per profile, and a one-time upgrade from the flat list earlier versions wrote. Order *is* the array order, so a drop rewrites what gets saved. Owns the bookmark clipboard (node + system clipboard), the two bar preferences, and **import/export**: the native dialogs, the merge that skips addresses already saved, and the path/extension guards that keep a renderer-named path from reading something that is not a bookmark file | `bookmarkSnapshot`, `listBookmarks`, `saveBookmark`, `removeBookmark`, `removeNode`, `renameNode`, `toggleBookmark`, `createFolder`, `createSeparator`, `moveNode`, `clipboardAction`, `pasteUrl`, `setBookmarkOptions`, `importBookmarks`, `exportBookmarks`, `flushBookmarks` |
| `favicon.ts` | **Tab-strip icons**: fetches the origin's `/favicon.ico` (3.5 s timeout, 96 KB cap, `image/*` check) and returns a data URL; session-scoped cache keyed by origin, with `forgetFavicon` for cleanup. No third-party icon service, no renderer network access | `faviconFor`, `forgetFavicon`, `FaviconResult` |
| `tracker-list.ts` | Two host lists: the base advertising/analytics tier and the aggressive tier (beacons, pixels, ad exchanges, telemetry), plus the tier resolver the protection engine uses | `TRACKER_SUFFIXES`, `AGGRESSIVE_TRACKER_SUFFIXES`, `matchesTrackerSuffix`, `trackedHostTier` |
| `guests.ts` | Per-guest instrumentation: console capture, navigation lifecycle events (start, redirects, ready, failure), the guest-id -> viewport map every other module asks about, and the **window-open policy**: an auth popup becomes a real child window on the *guest's own partition* (so `window.opener` and the session both survive), a tab request is forwarded to the strip with that partition, and navigation is guarded by protocol rather than origin so SSO/SAML round trips pass | `instrumentGuest`, `registerGuest`, `forgetGuest`, `viewIdForGuest`, `knownGuests`, `setEmitter`, `emitNetworkEntry` |
| `ai.ts` | AI provider abstraction with streamed completions (mock / Ollama / OpenAI-compatible) and abort support | `describeProvider`, `ask`, `abort` |
| `ide.ts` | "Open in VS Code" and click-to-source: builds `vscode://file/<path>:<line>` and maps a source URL back to a file inside the active workspace (paths can never escape the root) | `openInIde` |
| `local-servers.ts` | Dashboard probing of well-known dev ports (Vite, Next, CRA, Storybook, Jupyter, Docker-published databases), reading `Server` header and page title | `scanLocalServers` |
| `workspaces.ts` | Workspace MRU + the active click-to-source root, with dialog picking | `listWorkspaces`, `activeWorkspace`, `addWorkspace`, `removeWorkspace`, `setActiveWorkspace`, `pickWorkspace`, `markActive` |
| `output.ts` | Text exports (save dialog or `report.outputDir`) and clipboard writes | `saveTextFile`, `writeClipboard` |
| `config.ts` | Loads `devlens.config.json`, merges defaults, resolves every path, and reads the environment overrides (`DEVLENS_HOME_URL`, `DEVLENS_WORKSPACE_ROOT`, `DEVLENS_MODE`, `DEVLENS_PROTECTION`, `DEVLENS_PROFILE_ASK`, `DEVLENS_AI_*`, `DEVLENS_INTERCEPT`, `DEVLENS_WIMH`, `DEVLENS_CLIPBOARD_TTL_MS`, ...) | `loadConfig` |

## `src/preload` - the two bridges

| File | Responsibility | Key exports |
| --- | --- | --- |
| `index.ts` | Implements the `DevLensApi` contract as `window.devlens`: bootstrap, guest registration, IDE calls, log/interceptor/AI streams, history + bookmarks, favicons (`faviconGet`), ghost/session controls, protection (`protectionSetLevel`, `protectionSetSiteAllowed`), profiles, workspaces, `windowClose`, and every `subscribe()` helper | default `{}`; the object is attached via `contextBridge` |
| `webview.ts` | The guest bridge injected into every `<webview>`: scroll-sync reporter/applier with a fallback sampler, live design mode, the DOM/component finder (isolated world + page world for React fiber names), and the capability lock that refuses dev tooling - except under the WImH overlay's inspection lease | internal `canInspectPage()` + `ipcRenderer.on(...)` handlers |
| `index.d.ts` | Declares `Window.devlens: DevLensApi` for the renderer | `declare global` |

## `src/shared` - contracts and pure logic

Imported by all three targets; no Electron imports.

| File | Responsibility | Key exports |
| --- | --- | --- |
| `types.ts` | Every payload that crosses a boundary: log/network entries, bootstrap, guest status, AI stream events, interceptor records, ghost/WImH/inspection/protection state, profiles, workspaces, dashboard scans | `ViewportId`, `ConsoleLogEntry`, `NetworkEntry`, `BootstrapPayload`, `CapturedRequest`, `PausedRequest`, `InterceptorRule`, `GhostSessionState`, `InspectionState`, `ProtectionState`, `WimhState`, `BrowserProfile`, `ProfileAvatar`, `ProfileSettings`, `WorkspaceEntry`, `LocalServerScan`, ... |
| `ipc.ts` | Single source of truth for the 79 channel names, with a comment stating direction and purpose for each | `IPC`, `IpcChannel` |
| `api.ts` | The `DevLensApi` interface the preload must satisfy, so main and renderer cannot drift | `DevLensApi`, `Unsubscribe` |
| `omnibox.ts` | **The router and its ranking engine**: address-vs-query detection, prefix grammar (`@ # > : * & %`), stored engine lookup for `@`, stored shortcut lookup for `#`, action types, suggestion building, local scoring, inline completion, prefix-badge resolution and the `%` tab ranking. The `@` and `#` cheat sheets are generated in stored order; query engines become `entry` search actions, shortcuts become direct `entry` visits | `parseOmnibox`, `buildSuggestions`, `rankLocalEntries`, `rankOpenTabs`, `resolvePrefixBadge`, `engineMark`, `SEARCH_ENGINES`, `looksLikeUrl`, `toUrl`, `toSearchUrl`, `displayUrl`, `DEFAULT_SEARCH_ENGINE` |
| `omnibox-settings.ts` | **The split catalog contract and migration helpers**: separate ordered `engines` and `shortcuts`, stable built-in engine metadata, default rows, `@`/`#` prefix rules, draft validation, default-engine resolution and persisted-entry sanitisation | `OmniboxSettings`, `OmniboxEntry`, `DEFAULT_OMNIBOX_ENGINES`, `DEFAULT_SITE_SHORTCUTS`, `omniboxEntries`, `entryFromDraft`, `sanitizeOmniboxEntries`, `resolveDefaultEngine` |
| `routes.ts` | The shell's own URL vocabulary: route ids, canonical URLs and labels, case/trailing-slash resolution, and the route scope that makes every `devlens:settings/*` section share one tab instead of spawning a second settings form | `InternalRouteId`, `INTERNAL_ROUTES`, `OPENABLE_ROUTES`, `internalRouteUrl`, `internalRouteLabel`, `internalRouteOf`, `internalRouteScopeOf`, `isInternalUrl` |
| `mode.ts` | The capability table both processes obey, mode descriptors, developer-shortcut detection, dev-only panel list, the defense-overlay shortcut, and **`DOCK_TOOLS`** - the dock's own table (id, label, modes, slot) that both filters the rail and answers panel availability | `capabilitiesFor`, `modeDescriptor`, `MODE_DESCRIPTORS`, `isNormalMode`, `isDevMode`, `isDeveloperShortcut`, `isDefenseShortcut`, `isPanelAvailable`, `DEV_ONLY_PANELS`, `DOCK_TOOLS`, `dockToolsFor`, `DockToolId`, `DEFENSE_SHORTCUT_LABEL` |
| `protection.ts` | The protection level table, per-level policies, and the single copy of the local-first promise the UI renders | `PROTECTION_LEVELS`, `PROTECTION_DESCRIPTORS`, `protectionPolicy`, `LOCAL_ONLY_GUARANTEE`, `isProtectionLevel`, `resolveProtectionLevel` |
| `private-tab.ts` | **Tab-level maximum protection contract** shared by main, preload and the shell: the `ghost-incognito-` partition prefix (and the tab-id mapping both sides derive it from), the enforced Level 3 policy, the long-press duration, the label/summary strings the UI renders verbatim, `PrivateTabState`, and the badge view that mirrors the tab instead of the window dial | `privateTabPartition`, `isPrivateTabPartition`, `privateTabIdOf`, `privateTabPolicy`, `privateProtectionView`, `PrivateTabState`, `PRIVATE_TAB_LABEL`, `PRIVATE_TAB_SUMMARY`, `PRIVATE_TAB_SHORTCUT_LABEL`, `PRIVATE_TAB_LONG_PRESS_MS`, `PRIVATE_TAB_LEVEL` |
| `clipboard.ts` | Credential classifier shared by the WImH sentinel and the omnibox paste guard, plus redaction helpers | `classifyClipboardText`, `redactSecret`, `redactUrlSecrets`, `SENSITIVE_HEADERS` |
| `recon.ts` | Derives the recon snapshot: hosts, endpoints (with query keys), asset groups, failures, findings | `buildReconSnapshot`, `ReconSnapshot`, `ReconHost`, `ReconEndpoint`, `ReconFinding` |
| `report.ts` | Renders that snapshot as Markdown or JSON with per-section toggles | `renderMarkdown`, `renderJson`, `DEFAULT_REPORT_OPTIONS`, `ReportOptions` |
| `bookmarks-file.ts` | **The bookmark file formats**: a Netscape bookmark HTML reader (a token walk, since the main process has no DOM) and writer, a DevLens JSON reader/writer that also accepts the flat list earlier versions wrote, entity handling, and the sniffing that picks the reader from the file itself. Pure - no Electron, no filesystem | `parseNetscapeBookmarks`, `toNetscapeBookmarks`, `parseJsonBookmarks`, `toJsonBookmarks`, `parseBookmarkFile`, `ParsedBookmark` |
| `ai-sites.ts` | **The AI sites the assistant hosts**: id, label, URL, host and accent per provider, the default, the guard, and the partition naming (`persist:devlens-ai-<profile>-<provider>`). Shared because the choice is a profile preference main stores and the dock draws | `AiSiteId`, `AiSite`, `AI_SITES`, `DEFAULT_AI_SITE`, `isAiSiteId`, `aiSite`, `aiPartition` |
| `preferences.ts` | The per-profile preference shape and its defaults - small on purpose: a preference earns a place by being something the *profile* owns and the window follows | `ProfilePreferences`, `DEFAULT_PREFERENCES` |
| `config.ts` | Config shape, resolved-config shape, the device matrix and defaults. The matrix stores each device's *resolution and DPR* - the two figures a device database publishes - and `deviceViewport()` derives the CSS viewport from them, so a 1350px Surface Duo is previewed at 540 CSS px rather than at its panel resolution. Foldables carry `states` (main / cover / dual), which is what makes flipping a device one click instead of a second list entry | `DevLensConfig`, `ResolvedConfig`, `MOBILE_DEVICES`, `DEVICE_FAMILIES`, `DeviceProfile`, `DeviceState`, `deviceViewport`, `deviceState`, `customDevice`, `DESKTOP_WIDTHS`, `DEFAULT_CONFIG`, `AI_PROVIDER_DEFAULTS` |

## `src/renderer` - the React shell

| File | Responsibility | Key exports / notes |
| --- | --- | --- |
| `index.html` | Shell document and its CSP: `default-src 'self'`; images allow only `'self'` and `data:` so fetched favicons stay local data URLs. Search-engine marks are inline SVG, and no remote image host is allowed. Scripts, styles, fonts and connections stay local except localhost development sockets | the CSP is the security boundary for the whole shell |
| `src/main.tsx` | React root: mounts `<App />` into `#root` | - |
| `src/App.tsx` | **The shell's state hub** (the largest file): tabs and their per-tab viewport status, addresses, protection/inspection/profile/mode state, interceptor + log stores, design overrides, workspace and dashboard data, the omnibox action dispatcher, every keyboard shortcut, the tab context-menu handler, favicon resolution, and the render tree that lays out strip -> toolbar -> canvas -> sidebar -> status bar | `App` |
| `src/styles/index.css` | Project Nova tokens (`--devlens-*`), the standard compact 16px shell baseline, narrow-window filtering for secondary toolbar/status details, the `nova-glass` / `nova-field` / `nova-tab` components, the `.nova-drag` / `.nova-no-drag` window-drag utilities, and scrollbar/gutter rules. Settings-only comfort lives in `OmniboxSettings.tsx` and `AddEngineModal.tsx` | Tailwind 4 `@theme` |
| `src/types/webview-element.ts` | The `<webview>` surface DevLens actually uses, declared locally so the renderer project does not pull in Node typings (includes `setAudioMuted`/`isAudioMuted` for the tab menu) | `DevLensWebviewElement`, `GuestFailLoadEvent`, `GuestNavigateEvent`, `GuestIpcMessageEvent` |
| `src/types/webview.d.ts` | Makes the custom element known to JSX | `declare global` |

### `src/renderer/src/components`

| File | Responsibility | Key exports |
| --- | --- | --- |
| `Toolbar.tsx` | The browser chrome row: window drag-aware layout, the sidebar handle in its own leftmost slot (`layout.sidebarToggle === 'start'`, the default) with navigation after it, the omnibox, the bookmark star, the WImH shield, the protection badge + level menu, the mode switcher and the profile menu. The handle is one element rendered in one of two slots, never both, and cancels its own `mousedown`: a toolbar button that takes focus blurs the omnibox, which closes its dropdown and re-syncs the address - which is what "clicking the toggle collapses the toolbar" looks like from the outside. Dev-only controls (viewport chip, scroll sync, "Open in VS Code") are individually switchable in Settings | `Toolbar` |
| `Omnibox.tsx` | **The router's face**: the leading slot (unconditional DevLens vector on any `devlens:` tab; loaded-site favicon at rest otherwise; default-engine mark when empty, focused, cleared or searching; recognised prefix brand when a token matches, with a caret that opens a context-aware menu), inline ghost completion, the suggestion dropdown with keyboard contract (Up/Down, Tab, Right-arrow, Enter/Alt+Enter, Escape), `Ctrl/Cmd+L` (toolbar instance only), the paste sentinel, and the search/navigation vs site-protection menu switch. Its Settings gear dispatches the internal `devlens:settings/omnibox` route instead of inserting a command or opening a local modal. `variant="hero"` is the same field at front-page size, with its ids and test ids namespaced by surface | `Omnibox` |
| `PrefixIcons.tsx` | The omnibox marks. All six built-in search engines are **inline SVG drawn in one shared frame** (`MARK_FRAME`, carried by `viewBox` rather than a transform), so every logo's ink lands on the same optical size and no mark is clipped. Brave and DuckDuckGo use their brand-coloured knockout geometry; Bing/Wikipedia/Perplexity use simple-icons geometry and Google's four-part G is Google's own. Stored custom engines and every site shortcut use the contained favicon path through `FaviconMark`; no third-party artwork is redrawn. Exports the one box every caller draws its mark in | `PrefixMark`, `FaviconMark`, `MARK_BOX`, `MARK_FRAME`, `BRAND_ART`, `SIMPLE_MARKS` |
| `SiteProtectionPanel.tsx` | **Site panel** shown by the leading slot when a page is loaded: host + connection state, guard badge with the cancelled-request count, per-site enhanced-tracking-protection switch, "clear cookies & site data", and the session privacy level | `SiteProtectionPanel` |
| `ProtectionMenu.tsx` | The toolbar security badge and the protection-level dropdown (three levels, checkmark on the active one, counters and the local-first promise). While a private tab is focused it reports **Extreme Defense (this tab)** with the tab's own counters and disables the dial, with the reason in the menu | `ProtectionMenu` |
| `TabStrip.tsx` | The floating tab strip: chips with the site's **favicon** (14 px, data URL) or a coloured host initial, the shared inline **DevLens mark** for `devlens:` tabs, the **stealth mask badge** on private tabs, muted/unloaded indicators, whole-chip click target, middle-click close, `onContextMenu` hook for the tab menu, the single `+` button (click = new tab, right-click or a 300 ms hold = the new-tab menu), and the window drag region | `TabStrip`, `PageTab` |
| `NewTabMenu.tsx` | The `+` button's menu: New Tab, and New Max-Protection Private Tab (with the shortcut and a one-line description of what the tab enforces) | `NewTabMenu` |
| `BookmarksBar.tsx` | **The bookmarks toolbar**: renders the toolbar root in its stored order - links, folders with their own dropdowns, separators - with HTML5 drag and drop (reorder beside an item, drop dead centre to file into a folder), right-click menus for every node kind and for the blank space, and the "Other bookmarks" chip. Menus are placed in viewport coordinates because the bar scrolls and a scroll container clips absolute children | `BookmarksBar` |
| `BookmarksMenu.tsx` | The bar's context menus: one component for the link, folder, separator and blank-space variants, sharing the clipboard and "add" rows, with the container and toolbar submenus and disabled rows that state their reason | `BookmarksMenu`, `BookmarkMenuAction`, `BookmarkMenuTarget` |
| `AddFolderModal.tsx` | Create or rename a folder: name, the place it goes (a root or another folder), Save/Cancel, Escape and click-outside | `AddFolderModal`, `FolderChoice` |

### `src/renderer/src/components/dashboard`

The front page's parts. Each widget owns its own state and renders inside the shared card shell, so
the dashboard file is layout and wiring rather than a thousand lines of markup.

| File | Responsibility | Key exports |
| --- | --- | --- |
| `Widget.tsx` | The card shell every widget uses: hairline surface, icon + title header that wraps instead of clipping, an optional note line and right-aligned controls. Cards carry `data-widget="<title>"` so a card can be found by name | `Widget`, `WidgetAction` |
| `WorldClocks.tsx` | Four developer-centric zones (Macao, Tokyo, London, San Francisco) formatted with `Intl` so DST is never guessed, driven by one interval that is torn down with the card | `WorldClocks` |
| `FocusTimer.tsx` | Pomodoro rounds (25 focus / 5 break) with start/pause, reset and a phase switch; the handover at zero runs in an effect so React's double-invoke cannot advance two phases | `FocusTimer` |
| `Checklist.tsx` | A local task list (add, tick, remove, clear done) persisted under `devlens.checklist.<profileId>`, re-read when the profile changes | `Checklist` |
| `QuickLaunch.tsx` | The shortcut tile grid: fixed-size tiles, the site's icon or a coloured initial, middle/Alt-click opens a new tab, and an "Add" tile that focuses the hero field | `QuickLaunch`, `Shortcut` |
| `ServersWidget.tsx` | Local servers: chips for every port that answered, with the service and page title, plus the rescan control | `ServersWidget` |
| `WorkspacesWidget.tsx` | Workspaces (dev mode): the MRU list with framework/package, set-active, open-in-editor, remove, and a path field | `WorkspacesWidget` |
| `useFavicons.ts` | Resolves shortcut icons through `window.devlens.faviconGet` (main-process fetch, data URL) with a module-level session cache and in-flight de-duplication | `useFavicons`, `iconFor` |
| `TabContextMenu.tsx` | **The tab right-click menu**, built from the chip's context (its index, the strip's size, whether it holds a page, whether anything is on the closed stack) so that every row can act. No row is ever disabled: the entries this build has no backend for (tab groups, split view, cross-device hand-off, OS share targets) and the ones whose context is missing (Move Tab with one tab, Unload with no page) are not in the tree at all. Dismissal comes from `useMenuDismiss` | `TabContextMenu`, `TabMenuAction` |
| `NewTabDashboard.tsx` | **The front page** (page content of an empty tab or `devlens:newtab`): brand header, the hero omnibox (the toolbar's own component, passed down as one object of state and callbacks), the shortcut grid, the widget grid, recent pages and the cheat sheet. It is an absolute full-canvas system surface, measures itself with a container query so the layout follows the pane, and drops the developer widgets in normal mode | `NewTabDashboard` |
| `Sidebar.tsx` | **The dock and the panel column**: a left rail filtered by `DOCK_TOOLS` - the everyday four in normal mode, the whole toolset in dev, settings pinned last - plus one `<aside>` showing the selected tool. Clicking the active tool toggles the column; the resize handle is part of the column, and when the AI panel is open over a mobile preview the aside floats instead of taking a column | `Sidebar`, `SidebarPanel` |
| `HistoryPanel.tsx` | History for the active profile: filter, open (or open in a new tab), clear | `HistoryPanel` |
| `BookmarksPanel.tsx` | The bookmark tree as a list: three roots, nested folders, open-all per folder, delete, and the two bar visibility switches | `BookmarksPanel` |
| `SettingsPanel.tsx` | Settings that are genuinely runtime: the bookmarks toolbar switches, the protection level, the identity prompt, a row that opens the omnibox control panel, and the toolbar layout - where the dock handle sits (far left, the default, or with the tools) and which developer controls the toolbar is allowed to show | `SettingsPanel` |
| `OmniboxSettings.tsx` | **The Omnibox & Engines control room**, the full-width page behind `devlens:settings/omnibox`. Separate Search Engines (`@`) and Site Shortcuts (`#`) cards each expose up/down ordering, add/edit/delete and their stored evaluation order; built-ins use the same controls as user rows. A default-engine card and suggestion-source card complete the page. Every mark goes through `MARK_BOX` | `OmniboxSettingsPage` |
| `AddEngineModal.tsx` | The family-aware add/edit form: engine drafts require `%s`, shortcut drafts require a fixed URL, and both require an editable trigger (`@keyword` or `#keyword`). Preserves built-in engine branding while allowing every field to change | `AddEngineModal` |
| `PageContextMenu.tsx` | **The page's right-click menu**, built from the inspection the guest already did plus the clipboard read main performed before the menu mounted: navigation (only the directions the frame can go), the editing rows the selection and clipboard justify, and the link/media rows the target justifies. There is no `disabled` prop in the file | `PageContextMenu` |
| `DeviceSelector.tsx` | The emulator's controls: the device matrix grouped by family, the fold toggle (`FoldToggle`, its own element so it cannot end up underneath a neighbour in a narrow row), the free-size inputs with save/delete presets, and the CSS-viewport + DPR readout. `resolveDevice` turns the profile's settings into the profile the frame is built from | `DeviceSelector`, `FoldToggle`, `resolveDevice` |
| `hooks/useMenuDismiss.ts` | One dismissal contract for every menu: press, click, scroll, resize, Escape and window blur, all in the capture phase. Two details are load-bearing - the layout events are ignored for the first 200ms (the gesture that opened the menu can scroll the page), and `blur` only counts when the *window* is the target, because a menu row taking focus would otherwise dismiss the menu on the way into it | `useMenuDismiss` |
| `ServersPanel.tsx` | Local dev servers: every probed port with its service and page title, plus the IDE jump for the active workspace | `ServersPanel` |
| `ViewportPanel.tsx` | Responsive design mode: which viewport has focus, the mobile device presets, the desktop width and scroll sync. On a `devlens:` or front-page surface it renders an explanatory locked state instead of any emulator control | `ViewportPanel` |
| `StoragePanel.tsx` | Cookies and site storage: cookie rows with their flags and a delete, `localStorage`/`sessionStorage` entries read from the guest itself, and a per-origin clear | `StoragePanel`, `StorageArea` |
| `ConsolePanel.tsx` | Console & network list with filtering, source hand-off and counters | `ConsolePanel` |
| `InterceptorPanel.tsx` | Capture list + held queue + rules, with the segments (Capture / Repeater) | `InterceptorPanel` |
| `RequestList.tsx` | Presentational request rows for the capture list (method, status, duration, type, host) | `RequestList` |
| `InterceptorRules.tsx` | Rule editor: block / set-header / remove-header / redirect / pause patterns | `InterceptorRules` |
| `RepeaterPanel.tsx` | Replays a request with a custom method, URL, headers and body; owns the draft shape | `RepeaterPanel`, `EMPTY_REPEATER_REQUEST` |
| `HeaderPairs.tsx` | Small key/value editor reused by the Repeater and rules | `HeaderPairsEditor` |
| `DesignPanel.tsx` | Live design mode + CSS override editor (apply/clear/copy/export) and the target selector (`active` / `both`) | `DesignPanel`, `DesignTarget` |
| `ReconPanel.tsx` | The recon report: per-section checklist, live Markdown/JSON preview, copy and export | `ReconPanel` |
| `DefensePanel.tsx` | The WImH control surface: mode toggle, subsystem grid, memory scrub, clipboard TTL, defense log and the stated limits | `DefensePanel` |
| `DefenseOverlay.tsx` | The floating on-demand defense panel normal mode keeps: defense subsystems plus the lease's observed requests and page tooling (selector + design mode) | `DefenseOverlay` |
| `AiAssistantPanel.tsx` | **The AI assistant**: the provider's own chat embedded in its own partition, with a header that holds the provider dropdown, the copy button and "Summarise page". That action composes a prompt from the page in front and the captured context, copies it, and types it into the site's own composer when it can find one - nothing is sent on the operator's behalf. There is no built-in model half and no transcript | `AiAssistantPanel`, `buildSummarisePrompt` |
| `AiMark.tsx` | The four provider marks, drawn as hand-tuned 24-unit inline paths in `currentColor` (no CDN, no blank dock offline, no bitmap stretching): a curved Gemini sparkle, Claude's five-ray asterisk, the transparent OpenAI knot and DeepSeek's rising whale. The dock and panel both render it in the shared 20px `MARK_BOX` | `AiMark` |
| `DevLensMark.tsx` | The official inline viewfinder-and-lens identity mark: a 24-unit `currentColor` vector used by the omnibox leading slot, `devlens:` tab chips and the front-page wordmark. It never fetches an image and every call site places it in the shared `MARK_BOX` | `DevLensMark` |
| `ViewportFrame.tsx` | One viewport: the `<webview>` host, device header, scale-to-fit, scroll-sync plumbing, status reporting, CSS/design overrides, find results, and the imperative handle the shell drives | `ViewportFrame`, `ViewportHandle`, `ViewportStatus` |
| `StatusBar.tsx` | Bottom bar: mode banner (the `mode-indicator` testid), profile, viewport phase, counters, workspace, DevTools button (dev only) | `StatusBar` |
| `ModeSwitcher.tsx` | The two-state mode segment (the visible way in and out of dev mode) | `ModeSwitcher` |
| `ProfileSwitcher.tsx` | Toolbar profile menu: switch, create, delete | `ProfileSwitcher` |
| `ProfileGate.tsx` | **"Who is using DevLens?"** startup screen: profile cards with avatars and last-used, add-profile form with a glyph picker, and the "Always ask on startup" switch | `ProfileGate` |
| `IconButton.tsx` | Shared icon button with tooltip-as-accessible-name and pressed states | `IconButton` |

### `src/renderer/src/hooks`

| File | Responsibility | Key exports |
| --- | --- | --- |
| `useLogStore.ts` | Subscribes to the console/network streams and keeps the last 400 entries with counts. `enabled` exists for normal mode: nothing is collected there, so the subscription is only live while the WImH overlay borrows the pipeline | `useLogStore`, `LogStore`, `LogCounts` |
| `useInterceptorStore.ts` | Mirrors the main-process interceptor: batched request events, paused queue, rules, counters, and the control calls out. Batches updates through a ref map so 500 requests stay cheap | `useInterceptorStore`, `InterceptorStore` |
| `useElementSize.ts` | ResizeObserver-backed element size, used for the canvas geometry the mobile frame scales against | `useElementSize`, `ElementSize` |

### `src/renderer/src/lib`

| File | Responsibility | Key exports |
| --- | --- | --- |
| `url.ts` | Address helpers used by the shell and the strip | `normalizeAddress`, `shortenUrl`, `hostOf` |
| `format.ts` | Small formatters | `formatClock`, `formatDuration`, `tailPath` |
| `aiContext.ts` | Turns the recon snapshot, console, failures, CSS and design state into the attachable AI context chips | `buildAiChips` |

## Verification harness (outside the app directory)

Electron end-to-end suites driven by Playwright, one per feature area. Each boots the real app,
serves a fixture page on its own port, and asserts behaviour rather than implementation. They
live at `work/verify/` in the workspace, not inside the app.

| Suite | Covers | Checks |
| --- | --- | --- |
| `verify.mjs` | MVP: shell, two viewports, console/network capture, scroll sync, editor URI | 12 |
| `verify-features.mjs` | AI panel, design mode/CSS, interceptor + repeater, recon/report, the six sidebar panels and the report checklist | 27 |
| `verify-omnibox.mjs` | Prefix routing (`@` engines, `#` direct shortcuts, panels, commands, `%`), dropdown keyboard contract, local ranking, ghost completion, inline engine geometry and site-shortcut favicon identity, the leading menu and dashboard reachability. The `#` checks assert direct URLs are opened without building a search query | 86 |
| `verify-ranking.mjs` | The ranking engine as a unit: scoring signals, promotions, completions, the default-engine row and the branded `@` cheat sheet, purity and speed over 2200 entries | 25 |
| `verify-tabs.mjs` | Tab lifecycle (independent views, visibility toggling, scroll retention), the single new-tab button, `Ctrl+W` scope, middle-click close, frameless chrome + drag region | 33 |
| `verify-tab-menu.mjs` | The tab context menu - now with the zero-disabled-rows rule: no inert row in the tree, the entries this build has no backend for simply absent, and every remaining row's action performed - plus the favicon pipeline with its fallback | 41 |
| `verify-bookmarks.mjs` | The bookmarks toolbar, the Firefox-style Add Bookmark popover, per-profile storage and the star's page-only visibility | 19 |
| `verify-bookmarks-bar.mjs` | The bar's own behaviour: stored order rendered as drawn order, every menu row, no greyed-out row and no Paste until something is on the clipboard, open-in-tab and both window entries (plus the private window's session being wiped on close), edit/delete, cut-copy-paste through the system clipboard, folders and separators, a real drag reorder and a drop into a folder, folder batch open, the blank-space menu and the two toggles, the editor's folder locations, import (menu and API, into the bar and into a folder, with the duplicate and unreadable-file cases) and export (JSON and HTML, checked for the format each extension asks for), and an older `bookmarks.json` being read, drawn in order and upgraded | 49 |
| `verify-bookmarks-file.mjs` | The bookmark file formats as unit tests (esbuild-bundled, no Electron): Chrome's export read whole, nesting preserved, entities decoded, `ADD_DATE` parsed, Firefox/Safari quirks (single quotes, `TAGS`, numeric entities, an empty folder header), descriptions ignored, a tree written as HTML reading back the same, separators not written, the three JSON shapes accepted, the writer's version, format sniffing, and a malformed file failing loudly rather than quietly | 19 |
| `verify-dock.mjs` | The dock and the AI panel: the rail expands from the everyday four to the whole toolset on a mode switch without a restart, settings pinned last, the rail sits left of the canvas, every tool opens the panel it names, the four providers with a partition per provider per profile, the panel having no built-in model half left (asserted by absence), the dock's AI button wearing the provider's brand and following a switch, "Summarise page" composing a prompt and saying where it went, the choice being stored per profile (a fresh profile starts on the default), the panel becoming a floating overlay over a mobile preview, and the storage inspector reading (and deleting) a cookie and a `localStorage` key the page wrote | 44 |
| `verify-private-tab.mjs` | Tab-level maximum protection: the `+` menu and `Ctrl+Shift+P`, the `ghost-incognito-<tabId>` session, Level 3 blocking and headers on that session while the window stays Standard, the history refusal, two tabs sharing nothing, the wipe on close, the pill and the locked dial | 31 |
| `verify-protection.mjs` | The protection dropdown: three levels, policies, counters, header hardening end-to-end, per-site exemption, origin-scoped clearing | 30 |
| `verify-site-panel.mjs` | The context-aware leading menu: site panel on a page, search menu on the dashboard, per-site switch reaching the request filter | 19 |
| `verify-modes.mjs` | Normal vs dev enforcement, profile isolation, partition swaps, guest capability locks | 32 |
| `verify-normal-mode.mjs` | Normal-mode lock-down: no developer surface, no shortcuts, no triggers | 16 |
| `verify-startup.mjs` | Clean startup on the dashboard, no placeholder URL, local server detection, configured home URL | 16 |
| `verify-ntp.mjs` | The rebuilt front page: the hero field is the omnibox (one value, one router, `Ctrl+L` still the address bar), shortcut tiles with local icons, live clocks checked against `Intl`, the timer ticking/pausing/resetting, the checklist surviving a remount under the active profile's key, no overlap in a narrow pane, and normal mode dropping the developer cards | 29 |
| `verify-defense-ntp.mjs` | WImH defense (RAM-only, redaction, clipboard, history refusal) and the new tab dashboard | 23 |
| `verify-defense-normal.mjs` | The on-demand WImH overlay in normal mode: lease, capture only while open, clean close | 29 |
| `verify-profiles.mjs` | The startup identity screen, per-profile files and tabs, profile switching, the ask-on-startup preference | 21 |
| `verify-dev.mjs` | The Vite dev-server path (HMR bundle rather than the production build). Needs `npm run dev` already running: pass its URL as `DEVLENS_DEV_SERVER`, and run this suite directly - the runner's cleanup kills anything on 5173-5199, which is where the dev server listens | 3 |
| `verify-devices.mjs` | The mobile emulator: the device matrix (Apple, Android, foldables, custom), `Surface Duo`'s single and dual screens with the hinge drawn and published to the page, the `Z Flip`'s main and cover layouts, the `Z Fold`'s cover and inner screens, each foldable remembering its own layout, a typed size becoming the viewport, and a saved preset surviving a restart | 17 |
| `verify-oauth.mjs` | Navigation, sessions and sign-in: the guest's User-Agent is a plain Chrome one (no Electron or DevLens token, in the popup too), `window.open` opens a real child window with a working `window.opener`, a `target=_blank` link becomes a tab instead of a stray window, **the popup inherits the opener's partition (its cookie and localStorage are visible)** and the new tab is built on that same partition, a 302 through an identity provider to a callback is followed to the end with the session cookie intact while the twin viewport stays put, and a page cannot navigate itself into the shell's `devlens:` pages | 11 |
| `verify-ai-omnibox-marks.mjs` | Focused mark geometry in the real app: the dock AI vector's 20px `MARK_BOX`, 16px/24-unit ratio, `currentColor` hover change, centring against other rail icons, the loaded-page favicon and its contain-fit aspect ratio, the default-engine mark after focus/clear, and both toolbar and hero default marks on a new tab | 11 |
| `verify-omnibox-settings-route.mjs` | The omnibox gear as a navigation control: it opens the full `devlens:settings/omnibox` page with no dialog or leftover menu, the route occupies one tab, and a second click from another tab focuses that tab instead of creating a duplicate | 5 |
| `verify-omnibox-catalog.mjs` | Full catalog sovereignty: separate engine/shortcut cards, independent reordering, built-in rename/retrigger/delete, custom engine and shortcut creation, dropdown order, `@` query routing, `#` direct routing, and persistence across an app restart | 9 |
| `verify-internal-full-window.mjs` | System-surface layout lock: a web page keeps both viewports and controls, while `devlens:settings/omnibox`, the empty front page and `devlens:newtab` remove the emulator toolbar, fold control and viewport chip, lock the dock panel, fill the canvas, and restore preview mode when a web tab returns | 8 |
| `verify-internal-brand-mark.mjs` | Internal-page brand override: a web tab keeps its favicon, while `devlens:settings/omnibox` and `devlens:newtab` draw the same theme-aware DevLens viewfinder vector in the omnibox and selected tab, inside 20px `MARK_BOX` containers with no image or engine mark mounted, including while the omnibox is focused and typed | 7 |
| `verify-ui-scale.mjs` | Compact shell versus settings-only typography: unscaled 16px baseline, 12px omnibox, 11px tabs, 36px strip, 32px controls, a larger settings hierarchy, square 20px `MARK_BOX`, and overflow-free toolbar, status bar and settings layout at 1680px and the 1120px window minimum | 10 |
| `run-suite.mjs` | Runs suites one after another, killing leftover Electron and fixture processes between them so a crashed run cannot make the next one look broken | - |
| `diagnose*.mjs`, `measure.mjs`, `shots*.mjs`, `shots-ntp.mjs`, `shots-engines.mjs` | Scratch tools for ad-hoc inspection and screenshots (the last one photographs the engine rows, and a 96px strip of the marks so their optical sizing can be judged); not part of the pass/fail set. `tmp/` is scratch that the unit suites wipe on startup, so anything worth keeping lives elsewhere | - |
| `tools/measure-marks.mjs`, `tools/inspect-marks.mjs`, `tools/split-paths.mjs`, `tools/icons/*.svg` | Mark tooling, not checks. `measure-marks` prints what the app is drawing per engine - the shared frame, the rendered ink and its distance from centre, and the white/ink pixels of a canvas render (a zero in the white column for Brave or DuckDuckGo means the face or the duck is a hole again). `inspect-marks` renders a mark's subpaths in separate colours, which is how the knockout structure was read; `split-paths` prints a simple-icons path's subpaths as literals to paste. `tools/icons/` holds the simple-icons sources those two read, so the "official geometry" claim in the component is checkable and the literals can be regenerated; the app itself loads none of them | - |
| `site/index.html` | The shared fixture page: 60 blocks, console lines at every level, a failing fetch and image, and a stamped React fiber so the finder has a component name to report | - |

## Cross-cutting reference

### IPC channels (95)

Grouped by area; all names are declared in `src/shared/ipc.ts`.

- **Bootstrap & window**: `devlens:bootstrap`, `devlens:window:close`
- **Guests**: `devlens:guest:register`, `devlens:guest:status`, `devlens:log:console`, `devlens:log:network`
- **Viewport bridge (shell <-> guest)**: `devlens:viewport:scroll`, `devlens:viewport:apply-scroll`, `devlens:viewport:design-mode`, `devlens:viewport:find`, `devlens:viewport:find-result`, `devlens:viewport:mode`
- **Omnibox data**: `devlens:history:list`, `devlens:history:add`, `devlens:history:clear`, `devlens:bookmarks:list`, `devlens:bookmarks:toggle`, `devlens:bookmarks:changed`, `devlens:favicon:get`
- **Bookmarks bar**: `devlens:bookmarks:snapshot`, `create-folder`, `create-separator`, `rename-node`, `remove-node`, `move-node`, `clipboard`, `set-options`, `open-window` (each mutation answers with, and broadcasts, the whole snapshot)
- **Bookmark files**: `devlens:bookmarks:import`, `bookmarks:export` (both take an optional `file`, otherwise the environment names it, otherwise a native dialog asks)
- **Preferences**: `devlens:preferences:state`, `preferences:set`, `preferences:changed` (per profile, so the AI assistant a profile chose follows that identity)
- **AI**: `devlens:ai:provider`, `devlens:ai:ask`, `devlens:ai:abort`, `devlens:ai:stream`
- **Interceptor & repeater**: `devlens:interceptor:get-state`, `set-enabled`, `set-pause-all`, `set-rules`, `events`, `state-changed`, `resume`, `drop`, `clear`, `repeater`
- **Sessions**: `devlens:ghost:enter`, `ghost:exit`, `ghost:state`, `ghost:changed`, `devlens:session:clear-data`, `devlens:session:clear-site`, `devlens:sandbox:open`
- **Storage inspector**: `devlens:cookies:list`, `devlens:cookies:remove`
- **Private tabs**: `devlens:private-tab:open`, `private-tab:close`, `private-tab:state`, `private-tab:changed`
- **Defense**: `devlens:wimh:state`, `set-enabled`, `set-clipboard-ttl`, `scrub`, `check-clipboard`, `note-paste-blocked`, `changed`
- **On-demand inspection**: `devlens:inspection:set-open`, `inspection:state`, `inspection:changed`
- **Protection**: `devlens:protection:get-state`, `set-level`, `set-site-allowed`, `changed`
- **Profiles & mode**: `devlens:profiles:list`, `create`, `switch`, `delete`, `settings`, `set-ask-on-startup`, `changed`, `devlens:mode:state`, `mode:set`, `mode:changed`
- **Dashboard & IDE**: `devlens:ntp:servers`, `ntp:workspaces*` (list/add/pick/remove/active), `devlens:ide:open`, `devlens:file:save`, `devlens:clipboard:write`

### Who owns what

| State | Owner | Mirrored in the shell by |
| --- | --- | --- |
| Workspace mode + inspection lease | `main/mode.ts` | `App.mode`, `App.inspection` via `mode:changed` / `inspection:changed` |
| Protection level, policy, per-site exemptions | `main/protection.ts` | `App.protection` via `protection:changed` |
| Interceptor records, rules, held requests | `main/interceptor.ts` | `useInterceptorStore` |
| Console + failure log | `main/guests.ts` -> interceptor | `useLogStore` |
| Ghost / WImH sessions | `main/sessions.ts`, `main/wimh.ts` | `App.ghost`, `App.wimh` |
| Private tabs (session per tab, counters, wipe on close) | `main/private-tabs.ts`, policy contract in `shared/private-tab.ts` | `App.privateTabs` via `private-tab:changed`, the `private` flag on `PageTab` |
| Profiles, ask-on-startup, active partition | `main/profiles.ts` | `App.profiles`, `App.profileId` |
| History + bookmarks | `main/history.ts`, `main/bookmarks.ts` (per profile dir) | `App.history`, `App.bookmarks` |
| Tabs, their URLs/titles/flags and their view handles | `App.tsx` (renderer) | the tab strip, `PageTab` |
| The dock's selection and whether the panel column is open | `App.tsx` (`activePanel`, `sidebarOpen`) | `Sidebar.tsx`; the tool list itself is `shared/mode.ts` |
| AI provider sessions (one partition per provider per profile) | Electron partitions, named by `aiPartition` in `AiAssistantPanel.tsx` | the embedded `<webview>` in the AI panel |
| Per-profile preferences (which AI assistant) | `main/preferences.ts` (`profiles/<id>/preferences.json`) | `App.preferences` via `preferences:changed`, the dock's branded AI button |
| Site icons | `main/favicon.ts` cache | `App.tabIcons` (data URLs) |

### How a request and a console line travel

```
page fetch -> main/interceptor.ts onBeforeRequest
               |-- not a guest? ignore (the shell's own traffic is never touched)
               |-- monitoring off (normal mode, no lease)? tracker tiers decide, then pass
               |-- monitoring on -> remember(record) -> rules (dev only) -> hold or continue
               |-- onBeforeSendHeaders -> level policy (DNT/GPC, hints, referer) -> capture redaction
               `-- onCompleted/onError -> NetworkEntry -> IPC.log:network -> useLogStore -> Console panel

guest console.log -> main/guests.ts console-message -> IPC.log:console -> useLogStore -> Console panel
```

### Where the newest features live

| Feature | Files |
| --- | --- |
| Omnibox router (prefixes, engines, ranking, completions, `%` switcher) | `src/shared/omnibox.ts`, `src/renderer/src/components/Omnibox.tsx` |
| Prefix marks (inline SVG for all six engines in one shared frame, brand-coloured knockouts for Brave and DuckDuckGo, fetched-favicon marks for custom engines and shortcuts, one shared 20px box) | `src/renderer/src/components/PrefixIcons.tsx` (`MARK_BOX`, `MARK_FRAME`, `BRAND_ART`) |
| Engine logos and the default-engine row in the dropdown | `src/shared/omnibox.ts` (`mark`, `defaultEngine`, `engineMark`), `Omnibox.tsx` (the row's mark slot and the `default` chip) |
| Context-aware leading menu | `Omnibox.tsx` (search & navigation menu) + `SiteProtectionPanel.tsx` (site panel) |
| Tab right-click context menu | `TabContextMenu.tsx`, `TabStrip.tsx` (`onContextMenu`), `App.tsx` (`handleTabAction`, `closeTabs`, `moveTab`, `patchTab`) |
| Website favicons in the strip | `src/main/favicon.ts`, `src/shared/ipc.ts` (`favicon:get`), `TabStrip.tsx` (`TabIcon`), `App.tsx` (per-host icon resolution) |
| Protection levels + per-site protection | `src/shared/protection.ts`, `src/main/protection.ts`, `ProtectionMenu.tsx`, `SiteProtectionPanel.tsx` |
| On-demand WImH in normal mode | `src/main/mode.ts` (lease), `DefenseOverlay.tsx`, `preload/webview.ts` (guest lease) |
| Profiles, per-profile storage and tabs | `src/main/profiles.ts`, `storage.ts`, `history.ts`, `bookmarks.ts`, `ProfileGate.tsx` |
| Tab-level maximum protection (private tabs) | `src/shared/private-tab.ts`, `src/main/private-tabs.ts`, `history.ts` (refusal), `interceptor.ts` (per-session policy), `sessions.ts` (partition-aware clearing), `TabStrip.tsx` (badge + `+` gestures), `NewTabMenu.tsx`, `ProtectionMenu.tsx` (locked dial), `Toolbar.tsx` (pill), `App.tsx` (`openPrivateTab`, `partitionForTab`, `Ctrl/Cmd+Shift+P`) |
| Front page: hero omnibox, shortcuts and widgets | `NewTabDashboard.tsx`, `components/dashboard/*` (Widget, WorldClocks, FocusTimer, Checklist, QuickLaunch, ServersWidget, WorkspacesWidget, useFavicons), `Omnibox.tsx` (`variant="hero"`), `styles/index.css` (`.nova-ntp`), `App.tsx` (the `omnibox` object and `bookmarks`/`profileId` in `services`) |
| Bookmarks bar: order, folders, separators, menus, batch open | `main/bookmarks.ts` (tree store, clipboard, options), `shared/types.ts` (`BookmarkNode`, `BookmarkTree`, `BookmarkSnapshot`), `BookmarksBar.tsx`, `BookmarksMenu.tsx`, `AddFolderModal.tsx`, `AddBookmarkModal.tsx` (folder locations), `main/private-tabs.ts` (`openPrivateWindow`), `App.tsx` (`applyBookmarkSnapshot`, `runBookmarkAction`, `openAllBookmarkUrls`) |
| Bookmark import and export | `shared/bookmarks-file.ts` (both formats, pure), `main/bookmarks.ts` (`importBookmarks`, `exportBookmarks`, the merge and the path guards), `BookmarksMenu.tsx` (the two rows), `BookmarksBar.tsx` (`canExport`), `App.tsx` (the two action cases) |
| Mode-aware dock and the AI side panel | `shared/mode.ts` (`DOCK_TOOLS`, `dockToolsFor`), `Sidebar.tsx` (rail + panel column, overlay placement), `AiAssistantPanel.tsx` (`AI_SITES`, `aiPartition`, `buildSummarisePrompt`), `HistoryPanel.tsx`, `BookmarksPanel.tsx`, `SettingsPanel.tsx`, `ServersPanel.tsx`, `ViewportPanel.tsx`, `StoragePanel.tsx`, `main/sessions.ts` (`listCookies`, `removeCookie`), `ViewportFrame.tsx` (`ViewportHandle.evaluate`), `App.tsx` (`refreshStorage`, the mode-follow effect, the `everyday`/`tools` prop groups) |
| Mode-aware dock and the AI side panel | `shared/mode.ts` (`DOCK_TOOLS`, `dockToolsFor`), `shared/ai-sites.ts` (the provider table and partition naming), `main/preferences.ts` (the provider choice per profile), `Sidebar.tsx` (rail + panel column, overlay placement, the branded AI button), `AiAssistantPanel.tsx` (the site, the prompt composer, `buildSummarisePrompt`), `AiMark.tsx` (the inline brand marks), `HistoryPanel.tsx`, `BookmarksPanel.tsx`, `SettingsPanel.tsx`, `ServersPanel.tsx`, `ViewportPanel.tsx`, `StoragePanel.tsx`, `main/sessions.ts` (`listCookies`, `removeCookie`), `ViewportFrame.tsx` (`ViewportHandle.evaluate`), `App.tsx` (`refreshStorage`, `refreshPreferences`, the mode-follow effect, the `everyday`/`tools`/`ai` prop groups) |

### Keeping this document honest

Re-derive the two lists that change most often rather than trusting the prose:

```powershell
# every source file with its size
Get-ChildItem -Recurse -File src | Select-Object FullName, Length
# every exported symbol
rg -n "^export " src -g "*.ts" -g "*.tsx"
# every IPC channel
rg -n "^  [a-zA-Z]+: 'devlens:" src/shared/ipc.ts
```
