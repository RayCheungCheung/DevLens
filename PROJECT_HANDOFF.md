# DevLens — Project Handoff

Written 2026-10-17 for the next person (or model) picking this up. Read this first, then
`README.md` (feature rationale) and `DEVLENS_FILE_TREE.md` (every file, one line each).

## What this is

DevLens is a developer browser built as an Electron desktop app: a single window with floating
tabs, an omnibox with prefixes and local ranking, dual responsive viewports (mobile + desktop) in
dev mode, and a dock of developer tools around a real web page. Its philosophy: **"Be normal when
you need, be a hacker when you want."**

- **Stack:** Electron 44, React 19, TypeScript 5.9 (strict), Vite 7 / electron-vite 5, Tailwind 4,
  Lucide icons. No runtime network deps except two operator-pinned brand images.
- **App root:** `outputs/devlens` (inside this workspace). `npm run dev`, `npm run build`
  (typecheck + build), `npm run typecheck`.
- **Verification:** `work/verify/` (outside the app) — Playwright driving the real Electron app.
  Run `node work/verify/run-suite.mjs <suite> ...` from the workspace root.

## Architecture in one screen

```
src/main        Electron main: windows, sessions/partitions, IPC handlers, profiles, protection,
                interceptor, AI proxy, bookmarks/history files, favicons, guests instrumentation,
                OAuth/popup window policy, user agent.
src/preload     Two bridges: `index.ts` (shell <-> main API, typed in shared/api.ts) and
                `webview.ts` (sandboxed guest bridge: scroll sync, finder, design mode, fold hint,
                context-menu inspection).
src/renderer    React shell: tab strip, toolbar + omnibox, canvas (viewports / dashboard /
                internal pages), dock + panels, status bar, modals, overlays.
src/shared      Pure contracts and logic: ipc channel names, types, omnibox grammar + ranking +
                settings model + routes, mode/protection tables, bookmarks file format, report
                builders, device matrix.
```

Key invariants (do not break these):

1. **Normal mode** hides every developer surface. It is enforced in three places: the dock's tool
   table (`shared/mode.ts`), the renderer (no mounts/triggers/shortcuts), and the guest bridge
   (refuses design mode/finder). The only exception is the on-demand WImH overlay.
2. **Isolation is by Electron partition, not by URL.** Each profile has its own persistent
   partition; private tabs get `ghost-incognito-<tabId>` (in-memory, Level 3, no history);
   ghost/WImH sessions are in-memory. *Anything that opens a new view — popup, guest-opened tab —
   must carry the originating partition.*
3. **Local-first privacy.** No telemetry, no cloud sync. The shell CSP allows `'self'` + `data:`
   + one brand-image host used by two optional hub marks. Guests run sandboxed with context
   isolation and no node integration.
4. **Marks:** all engine marks are inline SVG in one shared `MARK_BOX` (20px box, 16px glyph,
   `MARK_FRAME` viewBox). Built-ins use hand-calibrated geometry; Brave/DuckDuckGo are
   brand-coloured knockouts (white underlay). Custom engines use the site favicon as an `<img>`,
   never redrawn. The four AI provider marks use the same `MARK_BOX` with hand-tuned 24-unit
   paths in `currentColor`.
5. **Menus render no disabled rows.** Applicability is decided before mount; a row that cannot act
   is absent. One dismissal hook (`useMenuDismiss`) covers press/click/scroll/resize/Escape/window
   blur.
6. **The address bar is the router.** `parseOmnibox()` is pure; `devlens:` routes resolve before
   URL/search detection; prefixes: `@` engines, `#` hubs, `>` panels, `:` commands, `*` ghost,
   `&` DOM finder, `%` tab switch.

## Feature map (where to look)

| Area | Entry points |
| --- | --- |
| Tabs, context menu, favicons | `renderer/components/TabStrip.tsx`, `TabContextMenu.tsx`, `main/favicon.ts` |
| Toolbar, sidebar handle, layout prefs | `Toolbar.tsx`, `shared/preferences.ts`, `SettingsPanel.tsx` |
| Omnibox, engines, ranking, ghost text | `shared/omnibox.ts`, `Omnibox.tsx`, `PrefixIcons.tsx`, `hooks/useMenuDismiss.ts` |
| Omnibox control panel (`devlens:settings/omnibox`) | `components/OmniboxSettings.tsx`, `AddEngineModal.tsx`, `shared/omnibox-settings.ts`, `shared/routes.ts`, IPC `devlens:settings/omnibox*` |
| Profiles / modes / protection | `main/profiles.ts`, `mode.ts`, `protection.ts`, `SessionManager` in `sessions.ts`, `ModeSwitcher.tsx` |
| Private tabs | `main/private-tabs.ts`, `shared/private-tab.ts`, `App.tsx` (`openPrivateTab`) |
| WImH / defense | `main/wimh.ts`, `DefenseOverlay.tsx`, `DefensePanel.tsx` |
| Interceptor / repeater / recon | `main/interceptor.ts`, `InterceptorPanel.tsx`, `RepeaterPanel.tsx`, `ReconPanel.tsx` |
| New tab dashboard + widgets | `NewTabDashboard.tsx`, `components/dashboard/*` |
| Bookmarks + toolbar | `main/bookmarks.ts`, `shared/bookmarks-file.ts`, `BookmarksBar.tsx`, `BookmarksMenu.tsx`, `AddBookmarkModal.tsx` |
| AI side panel (site-only) | `AiAssistantPanel.tsx`, `AiMark.tsx`, `shared/ai-sites.ts` |
| Mobile emulator / foldables | `shared/config.ts` (`MOBILE_DEVICES`, `deviceViewport`), `DeviceSelector.tsx`, `ViewportFrame.tsx` |
| Guest instrumentation / popups / navigation | `main/guests.ts`, `preload/webview.ts`, `main/user-agent.ts`, `main/window.ts` (`will-attach-webview`) |
| Page context menu | `PageContextMenu.tsx`, IPC `devlens:page:command`, `devlens:clipboard:read` |

## Recent work (most recent last)

1. **Omnibox engine marks → inline SVG.** Replaced CDN images for all six engines with inline
   geometry, one shared frame; removed jsDelivr from the CSP.
2. **Fixed Brave/DuckDuckGo rendering.** They are knockouts (face/duck are holes). A single-colour
   fill showed the chrome through them. Now: brand-coloured, white underlay + published path.
   `normalizeInk/getBBox` removed in favour of a hand-set `MARK_FRAME` viewBox.
3. **Omnibox & Engines control panel** at `devlens:settings/omnibox`, as a real internal tab:
   default engine (mark-drawing selector), engine/shortcut list with add/edit/delete/set-default,
   add-or-shortcut modal (`%s` = engine, no `%s` = site shortcut), suggestion-source checkboxes.
   Custom keywords route in `@` and carry the site's favicon. Stored per profile in
   `preferences.json` (`omnibox`).
4. **Toolbar/sidebar layout.** Sidebar toggle is the leftmost control by default (configurable to
   the tool cluster); it cancels `mousedown` so it cannot blur the omnibox; dev tools are
   individually hideable. Stored per profile (`preferences.toolbar`).
5. **Context menus.** Zero disabled rows; shared global dismissal; new page menu with pre-render
   inspection (selection → Copy/Cut, editable+clipboard → Paste, link/image rows only for those
   targets).
6. **Mobile emulator.** Device matrix with resolution + DPR (CSS viewport derived), foldables with
   per-device remembered states (Surface Duo single/dual, Z Flip main/cover, Z Fold cover/inner,
   Pixel Fold), hinge drawn and published to the page (`data-devlens-fold`,
   `--devlens-fold-hinge`), custom size + saved presets. Stored per profile (`preferences.mobile`).
7. **OAuth/navigation fix.** `<webview allowpopups>` (empty attribute — React drops a boolean),
   `setWindowOpenHandler` allowing real child windows for auth popups and forwarding `_blank` to
   the tab strip; Chrome UA with Electron/DevLens tokens stripped; navigation guarded by protocol
   only; redirect hops reported.
8. **Session inheritance fix (401 bug).** A `Session` exposes no partition name, so the viewport
   reports it at attach; main keys `guestId → partition` and creates popups (and nested popups) on
   that partition. `devlens:guest:open-tab` now carries `{ url, partition }`; `PageTab.partition`
   stores it and `partitionForTab` prefers it. Private tabs keep their own partition and stay
   private.
9. **Mark identity fixes.** The dock AI entry now draws its provider as a crisp inline vector in
   the shared 20px `MARK_BOX`, following the button's `currentColor` on hover and when active.
   The omnibox shows the loaded site's favicon at rest and the profile's resolved default engine
   whenever it is empty, focused, cleared or searching; custom defaults use their fetched icon.
10. **Omnibox settings deep link.** The search/navigation menu's gear now dispatches the internal
    route instead of inserting `:` or opening a local popover. It opens the full
    `devlens:settings/omnibox` page; settings routes share one tab scope, so a second open focuses
    the existing tab and retargets it to the requested section.
11. **Internal pages bypass responsive preview.** The empty front page, `devlens:newtab` and
    every other `devlens:` route now force a single full-width canvas. The emulator toolbar,
    device/fold controls and toolbar viewport chip are absent, the dock viewport panel is locked,
    active-view focus resets to desktop, and a standard web tab restores dual view normally.
12. **Internal-page brand mark.** `devlens:settings/*` and `devlens:newtab` now render one inline
    `currentColor` DevLens viewfinder vector in both the omnibox leading slot and tab chip. The
    internal route bypasses favicon fetching and search-engine fallback entirely; ordinary web
    tabs keep their existing favicon behavior.
13. **Compact shell, comfortable settings.** The browser shell remains unscaled and compact:
    12px omnibox type, 11px tab titles, a 36px tab strip and 32px toolbar controls. The larger
    typography/card hierarchy is scoped to the Omnibox settings page and its editor modal. At
    minimum window width, low-priority toolbar and status details hide so the omnibox and primary
    state stay readable.
14. **Split omnibox catalog with full CRUD.** Preferences now store ordered `engines` (`@`,
    required `%s`) and `shortcuts` (`#`, fixed URLs) separately. Defaults are ordinary stored rows,
    so every built-in can be renamed, retriggered, edited, deleted and reordered. The settings page
    has two independent cards with up/down controls; dropdown order and routing both follow the
    stored sequence. Old mixed `entries` files are migrated on load.

## Verification harness

Suites live in `work/verify/verify-*.mjs` (29 of them). They boot the real built app; **build
first** (`npx electron-vite build`) because they launch `out/`, not the Vite dev server.

```
node work/verify/run-suite.mjs verify-omnibox verify-devices ...   # from the workspace root
node work/verify/verify-oauth.mjs                                  # single suite, useful when debugging
```

Approximate counts: verify 12, features 27, ntp 29, tabs 33, tab-menu 41, modes 32,
normal-mode 18, profiles 21, protection 30, private-tab 31, startup 16, site-panel 19,
bookmarks 19, bookmarks-file 19, bookmarks-bar 49, defense-normal 29, defense-ntp 23,
omnibox 86, ranking 25, dock 44, devices 17, oauth 11, ai-omnibox-marks 11,
omnibox-settings-route 5, internal-full-window 8, internal-brand-mark 7, ui-scale 10,
omnibox-catalog 9. `verify-dev` needs a running dev server.

Known environment flakes on this machine (not product bugs, all have passed alone repeatedly):
- The runner occasionally leaves Electron behind: a suite then stalls with a 0-byte log or fails a
  first `waitFor`, and `verify-dock`/`verify-tabs` can report "Target page has been closed".
  Fix: `Get-Process electron | Stop-Process -Force`, wait ~3s, re-run that suite alone.
- Run suites from the app dir needs escalation here (esbuild spawns children).

Tools: `work/verify/tools/measure-marks.mjs` (rendered mark geometry + white/ink pixels),
`inspect-marks.mjs` (per-subpath colours), `split-paths.mjs` (icon path → literals),
`shots-*.mjs` (screenshots).

## Known gaps / next steps

- **DPR is reported, not simulated.** `<webview>` has no per-view device-scale-factor; the CSS
  viewport is resolution / DPR (honest), and the number is shown. Do not fake it with zoom.
- **Draggable canvas edges** for the custom device preset are not implemented (typed sizes +
  saved presets are).
- **No live Google/eClass login test** (needs real accounts/network). `verify-oauth` proves the
  mechanisms: popup partition/cookie/storage inheritance, UA, redirects, opener.
- Bookmarks `Paste` appears when the bar's own clipboard holds a node; the system-clipboard
  fallback for content is still honoured by main.
- The tab menu offers only rows it can perform; tab groups, split-view-in-menu, cross-device
  hand-off and OS share targets were intentionally removed rather than disabled.
- `README.md` and `DEVLENS_FILE_TREE.md` are kept in sync with the code — update both when adding a
  module or a suite.

## House rules used throughout

- Pure logic in `shared/`, effects in `main/`, drawing in `renderer/`; no `ipcRenderer` outside the
  preloads; every channel named in `shared/ipc.ts`.
- Comments explain *why*, especially where a non-obvious constraint exists (Electron quirks,
  security boundaries, ordering).
- Tests assert behaviour and pixels where it matters, not implementation details; new features get
  a suite (or an extension of the closest one).
- Never revert someone else's change; keep unrelated diffs out.
