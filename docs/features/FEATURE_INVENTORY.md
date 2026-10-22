# DevLens Feature Inventory

**Project:** DevLens  
**Version:** 0.1.0  
**Last Updated:** 2026-10-22  
**TypeScript Status:** ✅ 0 Errors (node/preload/web configs pass)

---

## Table of Contents

1. [Chrome & Navigation Architecture](#1-chrome--navigation-architecture)
2. [Developer Tools & Panels](#2-developer-tools--panels)
3. [Privacy & Security Features](#3-privacy--security-features)
4. [Workspaces & Profile Isolation](#4-workspaces--profile-isolation)
5. [AI Assistant Integration](#5-ai-assistant-integration)
6. [Tab Management System](#6-tab-management-system)
7. [Internationalization & Documentation](#7-internationalization--documentation)
8. [Settings & Preferences](#8-settings--preferences)
9. [Dashboard & New Tab](#9-dashboard--new-tab)
10. [Technical Architecture](#10-technical-architecture)

---

## 1. Chrome & Navigation Architecture

### 1.1 Tab Strip (`TabStrip.tsx`, `VerticalTabs.tsx`)

| Feature | Description |
|---------|-------------|
| **Horizontal/Vertical Layout** | Switch between horizontal tab strip and vertical tab rail |
| **Tab Grouping** | Create color-coded, collapsible tab groups |
| **Tab Pinning** | Pin tabs to prevent closure |
| **Tab Muting** | Mute/unmute audio from tabs |
| **Tab Unloading** | Release memory from inactive tabs |
| **Tab Duplication** | Duplicate current tab |
| **Tab Reopening** | Reopen recently closed tabs |
| **MRU Switching** | Switch tabs by most recent usage |
| **Hover Preview** | Preview tab on hover |
| **Taskbar Previews** | Show tab previews in Windows taskbar |
| **PIP on Tab Switch** | Picture-in-Picture mode when switching tabs |

### 1.2 Omnibox (`Omnibox.tsx`)

| Feature | Description |
|---------|-------------|
| **Search Engine Integration** | Google, Brave, DuckDuckGo support |
| **Prefix Shortcuts** | `>` for commands, `/` for search |
| **Suggestions Dropdown** | Local history, bookmarks, settings |
| **Engine Marks** | Visual indicators for search engines |
| **AI Integration** | Quick access to AI chat via prefix |
| **URL Auto-complete** | Fuzzy matching for visited URLs |
| **Keyboard Navigation** | Arrow keys, Enter, Escape support |

### 1.3 Sidebar (`Sidebar.tsx`, `VerticalTabs.tsx`)

| Feature | Description |
|---------|-------------|
| **Three-State Dock** | Hidden / Dock / Open states |
| **13 Dock Tools** | AI, Bookmarks, History, Elements, Console, Network, Servers, Viewport, Design, Storage, Recon, Defense, Settings |
| **Mode-Aware Display** | Different tools available in Normal vs Dev mode |
| **Resizable Panel** | Drag to resize sidebar width |
| **Icon Alignment** | Fixed width with centered icons |
| **Collapse/Expand** | Toggle entire sidebar visibility |

### 1.4 Toolbar (`Toolbar.tsx`)

| Feature | Description |
|---------|-------------|
| **Navigation Controls** | Back, Forward, Reload buttons |
| **Protection Menu** | Privacy level selector (Standard/Strict/Extreme) |
| **Mode Switcher** | Normal ↔ Dev mode toggle |
| **Profile Switcher** | Switch between user profiles |
| **Main Menu** | File, Edit, View, Tools, Help menus |
| **Viewport Chip** | Mobile/Desktop viewport indicator |
| **Scroll Sync** | Sync scroll position between viewports |
| **IDE Integration** | "Open in VS Code" button |
| **Defense Shield** | WImH mode quick toggle |

### 1.5 Context Menus

| Component | Features |
|-----------|----------|
| **TabContextMenu.tsx** | 28+ actions: new-right, reload, mute, pin, unload, duplicate, ask-ai, bookmark, move-left/right/first/last, split-side-by-side, split-stacked, group-assign/remove/new, copy-link, container-standard/ghost/wimh, close, close-others/right/left/duplicates, reopen, select-all |
| **PageContextMenu.tsx** | Page-level context menu (backwards compatible with browser context menus) |

---

## 2. Developer Tools & Panels

### 2.1 Console Panel (`ConsolePanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Log Capture** | Capture console.log, warn, error from web pages |
| **Filtering** | Filter by level (debug/info/log/warn/error) |
| **Source Links** | Click to open source file in IDE |
| **Real-time Updates** | Live log streaming |
| **Clear Function** | Clear all logs |

### 2.2 Network Interceptor (`InterceptorPanel.tsx`, `InterceptorRules.tsx`)

| Feature | Description |
|---------|-------------|
| **Request Capture** | Intercept all network requests |
| **Header Editor** | View and edit request/response headers |
| **Rule System** | Block, redirect, modify requests |
| **Request Repeater** | Replay captured requests with modifications |
| **Response Preview** | View response body and status codes |
| **Pause/Resume** | Hold requests until manually sent |

### 2.3 Inspector Panel (`InspectorPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **DOM Tree** | View and navigate page DOM |
| **Element Selection** | Click to select elements |
| **Style Inspection** | View computed styles |
| **Real-time Updates** | Live DOM changes |

### 2.4 Viewport Panel (`ViewportPanel.tsx`, `DeviceSelector.tsx`)

| Feature | Description |
|---------|-------------|
| **Device Presets** | iPhone, iPad, Android presets |
| **Custom Sizes** | Enter custom width/height |
| **Foldable Devices** | Support for foldable phone layouts |
| **Rotation** | Portrait/Landscape toggle |
| **Pixel Ratio** | Adjust device pixel ratio |

### 2.5 Design Panel (`DesignPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **CSS Injection** | Inject custom CSS into pages |
| **Design Mode** | Visual design overlay |
| **Live Preview** | See changes in real-time |

### 2.6 Storage Panel (`StoragePanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Cookies** | View/edit/delete cookies |
| **Local Storage** | Inspect localStorage entries |
| **Session Storage** | Inspect sessionStorage entries |
| **IndexedDB** | Browse IndexedDB databases |
| **Cache** | View service worker cache |

### 2.7 Recon Panel (`ReconPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Security Reports** | Generate security assessment reports |
| **Threat Detection** | Identify potential vulnerabilities |
| **HTTPS Analysis** | Check certificate validity |

### 2.8 Servers Panel (`ServersPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Local Server Detection** | Auto-detect running dev servers |
| **IDE Integration** | Click-to-source handoff to VS Code/WebStorm |
| **Quick Connect** | One-click navigate to local servers |

---

## 3. Privacy & Security Features

### 3.1 WImH Mode (`wimh.ts`)

| Feature | Description |
|---------|-------------|
| **RAM-Only Session** | In-memory partition (`devlens-wimh`), no disk storage |
| **Content Protection** | `setContentProtection(true)` prevents screen capture |
| **Clipboard Sentinel** | Auto-purges sensitive clipboard content after TTL |
| **Memory Hygiene** | Buffers sensitive data, zeros on TTL or demand |
| **Cookie Downgrade** | Persistent cookies downgraded to session cookies |
| **Display Media Blocked** | Refuses screen capture requests from pages |
| **Fingerprint Rotation** | Rotates browser fingerprint on entry/exit |

### 3.2 Protection Levels (`protection.ts`)

| Level | Features |
|-------|----------|
| **Standard** | Basic ad/tracker blocking |
| **Strict** | Enhanced blocking + fingerprint hardening + privacy headers |
| **Extreme** | Full script isolation + RAM-only session for both viewports |

### 3.3 Ghost Mode (`private-tabs.ts`, `PrivateSessionLanding.tsx`)

| Feature | Description |
|---------|-------------|
| **In-Memory Partition** | Separate from WImH, standard privacy |
| **No History** | Browsing history not recorded |
| **Clean Exit** | All data cleared on window close |

### 3.4 Tracker Blocking (`tracker-list.ts`)

| Feature | Description |
|---------|-------------|
| **Curated Blocklist** | 100+ known tracker domains |
| **Suffix Matching** | Block by domain suffix (e.g., `.doubleclick.net`) |
| **Cross-Site Tracking** | Blocks third-party cookies and trackers |

### 3.5 Site Protection Panel (`SiteProtectionPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Permission Controls** | Toggle Notifications, Camera, Mic, Geolocation |
| **Cross-Site Cookies** | Manage third-party cookie exceptions |
| **Tracker Sources** | List and block specific tracker domains |
| **Real-time Status** | Shows current protection state |

---

## 4. Workspaces & Profile Isolation

### 4.1 Multi-Profile System (`profiles.ts`)

| Feature | Description |
|---------|-------------|
| **Per-Profile Partitions** | Each profile has isolated cookies/storage |
| **Avatar Customization** | Choose from 7 avatar glyphs |
| **Profile Switching** | Quick switch between identities |
| **Gate Screen** | Profile selection on startup |
| **LocalStorage Isolation** | Each profile has separate storage |

### 4.2 Container Tabs (`tabs.ts`)

| Feature | Description |
|---------|-------------|
| **Container Definitions** | Predefined: Dev (teal), Staging (amber), Production (rose) |
| **Custom Containers** | User can create additional containers |
| **Color Coding** | Each container has distinct color |
| **Session Isolation** | Containers have separate cookies/sessions |

### 4.3 Workspace Switching (`workspaces.ts`)

| Feature | Description |
|---------|-------------|
| **Workspace Partition Binding** | Each workspace bound to specific Electron partition |
| **Path-Based Isolation** | Partition name includes workspace path |

---

## 5. AI Assistant Integration

### 5.1 AI Panel (`AiAssistantPanel.tsx`)

| Feature | Description |
|---------|-------------|
| **Multi-Provider Support** | Gemini, DeepSeek, ChatGPT, Claude |
| **Provider Selection** | Per-profile AI provider preference |
| **Context Chips** | Inject URL, title, tab state into prompts |
| **Brand-Aware Dock** | Different icon/mark for each provider |

### 5.2 AI Sites (`ai-sites.ts`)

| Provider | ID | URL | Accent |
|----------|-----|-----|--------|
| Google Gemini | `gemini` | `gemini.google.com` | Sky blue |
| DeepSeek | `deepseek` | `chat.deepseek.com` | Indigo |
| ChatGPT | `chatgpt` | `chatgpt.com` | Emerald |
| Anthropic Claude | `claude` | `claude.ai` | Orange |

---

## 6. Tab Management System

### 6.1 Tab Groups (`tabs.ts`, `TabGroupDialog.tsx`)

| Feature | Description |
|---------|-------------|
| **Custom Names** | Name groups anything you want |
| **Color Coding** | Choose from preset colors |
| **Collapse/Expand** | Toggle group visibility |
| **Drag-to-Add** | Drag tabs into groups |
| **Right-Click Menu** | "Add to Group > [list]" option |
| **Group-New** | Quick create new group from context menu |

### 6.2 Split View (`TabContextMenu.tsx`)

| Feature | Description |
|---------|-------------|
| **Side-by-Side** | Two tabs displayed horizontally |
| **Stacked** | Two tabs displayed vertically |
| **Smart Trigger** | Suggests adjacent tab as partner |
| **Context Menu Access** | Available via right-click |

---

## 7. Internationalization & Documentation

### 7.1 i18n Support (`languages.ts`)

| Feature | Description |
|---------|-------------|
| **22 README Files** | Complete localization in 21 languages + English |
| **Language Preference** | Per-profile language selection |
| **RTL Support** | Arabic (العربية) properly supported |
| **Web Languages** | Configure preferred web content languages |
| **Spell Check** | Multi-language spell checking |
| **Offline Models** | Local translation models (EN↔ZH, JA↔EN) |

### 7.2 Localization Files

| Language | File |
|----------|------|
| English | `README.md` (root) |
| Simplified Chinese | `docs/locales/README_zh-CN.md` |
| Traditional Chinese | `docs/locales/README_zh-TW.md` |
| Japanese | `docs/locales/README_ja.md` |
| Korean | `docs/locales/README_ko.md` |
| German | `docs/locales/README_de.md` |
| French | `docs/locales/README_fr.md` |
| Spanish | `docs/locales/README_es.md` |
| Italian | `docs/locales/README_it.md` |
| Portuguese (BR) | `docs/locales/README_pt-BR.md` |
| Russian | `docs/locales/README_ru.md` |
| Arabic | `docs/locales/README_ar.md` |
| Turkish | `docs/locales/README_tr.md` |
| Dutch | `docs/locales/README_da.md` |
| Swedish | `docs/locales/README_no.md` |
| Polish | `docs/locales/README_pl.md` |
| Greek | `docs/locales/README_el.md` |
| Thai | `docs/locales/README_th.md` |
| Vietnamese | `docs/locales/README_vi.md` |
| Bengali | `docs/locales/README_bn.md` |
| Bosnian | `docs/locales/README_bs.md` |
| Ukrainian | `docs/locales/README_uk.md` |

---

## 8. Settings & Preferences

### 8.1 Comprehensive Settings Pages

| Page | Component | Description |
|------|-----------|-------------|
| **General** | `SettingsPage.tsx` | Main settings hub |
| **Appearance** | `ThemeManagerPage.tsx` | Theme, font, icon customization |
| **Privacy** | `PrivateProtectionPage.tsx` | Protection levels, WImH config |
| **Tabs** | `StartupTabsSelect.tsx` | Startup behavior, tab preferences |
| **Downloads** | `DownloadsSettings.tsx` | Download folder, naming |
| **Browsing Data** | `BrowsingDataSettings.tsx` | Clear cookies, cache, history |
| **Hotkeys** | `HotkeySettings.tsx` | Customize keyboard shortcuts |
| **Launchpad** | `LaunchpadCustomizePanel.tsx` | New tab dashboard customization |
| **About** | `AboutSettings.tsx` | Version info, update channel |
| **IDE** | `IdeSelect.tsx` | VS Code/WebStorm integration |

### 8.2 Hotkey System (`hotkeys.ts`)

| Action | Default Shortcut |
|--------|------------------|
| New Tab | `Ctrl+T` |
| Close Tab | `Ctrl+W` |
| Reload Page | `Ctrl+R` |
| Find in Page | `Ctrl+F` |
| Open Settings | `Ctrl+,` |
| Open Shell DevTools | `F12` |
| New Private Tab | `Ctrl+Shift+P` |
| Open Elements Panel | `Ctrl+Shift+I` |
| Open Console Panel | `Ctrl+Shift+J` |
| Open Network Panel | `Ctrl+Shift+E` |
| Toggle Sidebar | `Ctrl+Shift+B` |
| Toggle Ghost Mode | `Ctrl+Shift+G` |
| Toggle WImH | `Ctrl+Shift+H` |
| MRU Tab Switch | `Ctrl+Tab` |
| Duplicate Tab | `Ctrl+Shift+D` |
| Group Selected Tab | `Ctrl+G` |

---

## 9. Dashboard & New Tab

### 9.1 Widget System (`NewTabDashboard.tsx`)

| Widget | Component | Description |
|--------|-----------|-------------|
| **Quick Launch** | `QuickLaunch.tsx` | Pinned app shortcuts |
| **Servers** | `ServersWidget.tsx` | Local dev server list |
| **System Health** | `SystemHealth.tsx` | CPU, RAM, network stats |
| **Weather** | `WeatherWidget.tsx` | Local weather display |
| **World Clocks** | `WorldClocks.tsx` | Multiple timezone display |
| **Focus Timer** | `FocusTimer.tsx` | Pomodoro-style timer |
| **Quick Snippets** | `QuickSnippets.tsx` | Code snippet manager |
| **Dev Spotlight** | `DevSpotlight.tsx` | Developer tips and tricks |
| **Checklist** | `Checklist.tsx` | Task checklist |
| **Workspaces** | `WorkspacesWidget.tsx` | Workspace quick switcher |

### 9.2 Easter Eggs

| Feature | Component |
|---------|-----------|
| **Browser Easter Eggs** | `BrowserEasterEggs.tsx` |
| **Dev Tools Easter Egg** | `DevToolsEasterEgg.tsx` |

---

## 10. Technical Architecture

### 10.1 Project Structure

```
src/
├── main/           # Electron main process
│   ├── wimh.ts     # WImH mode implementation
│   ├── protection.ts # Protection level logic
│   ├── profiles.ts   # Multi-profile system
│   ├── guests.ts     # WebContents lifecycle
│   ├── interceptor.ts # Network interception
│   └── ...         # 35+ modules
├── preload/        # Preload scripts (IPC bridge)
├── renderer/       # React + TypeScript renderer
│   ├── src/
│   │   ├── components/  # 70+ React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility libraries
│   │   ├── styles/      # CSS modules
│   │   └── types/       # Type definitions
│   └── index.html
└── shared/         # Cross-process shared code
    ├── types.ts    # Core type definitions
    ├── tabs.ts     # Tab/Group types
    ├── mode.ts     # Workspace mode definitions
    ├── privacy.ts  # Privacy preferences
    ├── hotkeys.ts  # Hotkey system
    └── ...         # 30+ shared modules
```

### 10.2 TypeScript Configuration

| Config | Purpose | Status |
|--------|---------|--------|
| `tsconfig.node.json` | Main process | ✅ 0 errors |
| `tsconfig.preload.json` | Preload scripts | ✅ 0 errors |
| `tsconfig.web.json` | Renderer/React | ✅ 0 errors |

### 10.3 Path Aliases

| Alias | Resolves To |
|-------|-------------|
| `@renderer/*` | `src/renderer/src/*` |
| `@shared/*` | `src/shared/*` |

### 10.4 Tech Stack

| Technology | Usage |
|------------|-------|
| **Electron** | Desktop app framework |
| **Vite** | Build tool and dev server |
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Lucide Icons** | Icon library |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **React Components** | 70+ |
| **Main Process Modules** | 35+ |
| **Shared Modules** | 30+ |
| **Localization Files** | 21 |
| **Hotkey Actions** | 15 |
| **Dock Tools** | 13 |
| **AI Providers** | 4 |
| **Workspace Themes** | 4 |
| **Protection Levels** | 3 |
| **Container Presets** | 3 |

---

*Last verified: TypeScript compilation passes with 0 errors across all configurations.*
