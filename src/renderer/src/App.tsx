import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2, ShieldCheck, VenetianMask } from 'lucide-react'
import { DESKTOP_WIDTHS } from '@shared/config'
import { buildReconSnapshot, type ReconSnapshot } from '@shared/recon'
import {
  privateProtectionView,
  privateTabPartition,
  PRIVATE_TAB_LABEL,
  PRIVATE_TAB_SHORTCUT_LABEL,
  PRIVATE_TAB_SUMMARY,
  type PrivateTabState
} from '@shared/private-tab'
import {
  buildSuggestions,
  rankOpenTabs,
  type OmniboxAction,
  type OmniboxSuggestion
} from '@shared/omnibox'
import { protectionPolicy, type ProtectionLevel } from '@shared/protection'
import type { AiSiteId } from '@shared/ai-sites'
import {
  DEFAULT_BROWSER_PREFERENCES,
  DEFAULT_DEVELOPER_PREFERENCES,
  DEFAULT_PREFERENCES,
  DEFAULT_TOOLBAR_LAYOUT,
  DEFAULT_ABOUT_PREFERENCES,
  type BrowserPreferences,
  type DeveloperPreferences,
  type ProfilePreferences,
  type SidebarTogglePosition,
  type ToolbarLayout,
  type ToolbarTools
} from '@shared/preferences'
import { IDE_PRESETS, type IdeOption } from '@shared/ide'
import {
  DEFAULT_LAUNCHPAD_PREFERENCES,
  launchTargetUrl,
  type LaunchpadPreferences,
  type LaunchpadSession,
  type LaunchpadSystemState
} from '@shared/launchpad'
import {
  DEFAULT_PRIVACY_PREFERENCES,
  type ClearBrowsingDataRequest,
  type ClearBrowsingDataResult,
  type HistoryPolicy,
  type PrivacyPreferences,
  type ProfileDiskUsage
} from '@shared/privacy'
import {
  CODE_FONTS,
  DEFAULT_APPEARANCE_PREFERENCES,
  INTERFACE_FONTS,
  type AppearancePreferences,
  type UiDensity
} from '@shared/appearance'
import {
  DEFAULT_TABS_PREFERENCES,
  type TabsPreferences
} from '@shared/tabs'
import {
  DEFAULT_LANGUAGE_PREFERENCES,
  type LanguagePreferences
} from '@shared/languages'
import {
  capabilitiesFor,
  isDefenseShortcut,
  isDeveloperShortcut,
      isDevMode,
  isNormalMode,
  isPanelAvailable,
  type WorkspaceMode
} from '@shared/mode'
import type {
  AiContextChip,
  AboutInfo,
  BootstrapPayload,
  BookmarkEntry,
  BookmarkLocation,
  BookmarkNode,
  BookmarkOptions,
  BookmarkSnapshot,
  BookmarkTree,
  BrowserProfile,
  FindInPageResult,
  ProfileAvatar,
  FindResult,
  GhostSessionState,
  HistoryEntry,
  InspectionState,
  LocalServer,
  ModeState,
  PageCommandKind,
  PageContextMenuPayload,
  ProtectionState,
  ScrollSyncMessage,
  UpdateChannel,
  UpdateStrategy,
  ViewportId,
  WimhState,
  WorkspaceEntry
} from '@shared/types'
import { Toolbar } from '@renderer/components/Toolbar'
import { TabStrip, type PageTab } from '@renderer/components/TabStrip'
import { Sidebar, type SidebarPanel } from '@renderer/components/Sidebar'
import { StatusBar } from '@renderer/components/StatusBar'
import { NewTabDashboard } from '@renderer/components/NewTabDashboard'
import { HistoryPage } from '@renderer/components/HistoryPage'
import { BookmarksPage } from '@renderer/components/BookmarksPage'
import { FindBar } from '@renderer/components/FindBar'
import { SettingsPage } from '@renderer/components/SettingsPage'
import { ChangelogPage } from '@renderer/components/ChangelogPage'
import { DEFAULT_DOWNLOAD_PREFERENCES, type DownloadPreferencesPatch } from '@shared/downloads'
import { ThemeManagerPage } from '@renderer/components/ThemeManagerPage'
import { VerticalTabs } from '@renderer/components/VerticalTabs'
import { PageContextMenu } from '@renderer/components/PageContextMenu'
import { DeviceSelector, FoldToggle, resolveDevice } from '@renderer/components/DeviceSelector'
import { deviceViewport } from '@shared/config'
import { DEFAULT_MOBILE_SETTINGS, type MobileSettings } from '@shared/preferences'
import { useFavicons, iconFor } from '@renderer/components/dashboard/useFavicons'
import {
  internalRouteLabel,
  internalRouteOf,
  internalRouteScopeOf,
  internalRouteUrl,
  settingsCategoryOf,
  settingsCategoryUrl,
  type InternalRouteId,
  type SettingsCategoryId
} from '@shared/routes'
import {
  DEFAULT_OMNIBOX_SETTINGS,
  omniboxEntries,
  resolveDefaultEngine,
  type OmniboxSettings
} from '@shared/omnibox-settings'
import { ProfileGate } from '@renderer/components/ProfileGate'
import { BookmarksBar } from '@renderer/components/BookmarksBar'
import { AddBookmarkModal } from '@renderer/components/AddBookmarkModal'
import { AddFolderModal, type FolderChoice } from '@renderer/components/AddFolderModal'
import type {
  BookmarkMenuAction,
  BookmarkMenuTarget
} from '@renderer/components/BookmarksMenu'
import { DefenseOverlay } from '@renderer/components/DefenseOverlay'
import type { CookieRecord, StorageArea } from '@renderer/components/StoragePanel'
import type { DesignTarget } from '@renderer/components/DesignPanel'
import {
  ViewportFrame,
  type ViewportHandle,
  type ViewportStatus
} from '@renderer/components/ViewportFrame'
import { useElementSize } from '@renderer/hooks/useElementSize'
import { useInterceptorStore } from '@renderer/hooks/useInterceptorStore'
import { useLogStore } from '@renderer/hooks/useLogStore'
import { buildAiChips } from '@renderer/lib/aiContext'
import { hostOf } from '@renderer/lib/url'

const EMPTY_STATUS: ViewportStatus = {
  phase: 'idle',
  isLoading: false,
  url: '',
  title: '',
  error: null,
  canGoBack: false,
  canGoForward: false
}

/** A tab that has not reported yet: one shared value, so effects do not re-run needlessly. */
const EMPTY_TAB_STATUSES: Record<ViewportId, ViewportStatus> = {
  mobile: EMPTY_STATUS,
  desktop: EMPTY_STATUS
}

const EMPTY_INSPECTION: InspectionState = {
  open: false,
  capturing: false,
  source: 'off',
  capturedCount: 0,
  consoleCount: 0,
  grantedAt: null
}

/** Mirrors the engine's default (Standard) until the first state round-trip lands. */
const EMPTY_PROTECTION: ProtectionState = {
  level: 'standard',
  policy: protectionPolicy('standard'),
  blockedRequests: 0,
  scrubbedHeaders: 0,
  trimmedReferers: 0,
  ramOnlySession: false,
  allowedSites: [],
  changedAt: 0
}

const STATUS_TTL_MS = 8000
const DEFAULT_SIDEBAR_WIDTH = 440

/** Canvas geometry budgets used to scale a fixed-size device frame. */
const CANVAS_PADDING_PX = 16
const FRAME_GAP_PX = 16
const FRAME_HEADER_PX = 36
const FRAME_INSET_PX = 16
/** The desktop frame never shrinks below this, so the mobile frame has to make room. */
const DESKTOP_MIN_WIDTH_PX = 320
const MIN_DEVICE_SCALE = 0.45

const PANEL_FOR_COMMAND: Record<'recon' | 'design' | 'interceptor' | 'defense', SidebarPanel> = {
  recon: 'recon',
  design: 'design',
  interceptor: 'interceptor',
  defense: 'defense'
}

/** Panels whose omnibox shortcut must respect the mode. */
const PANEL_COMMAND_NAMES: Record<string, string> = {
  recon: '>sec',
  design: '>design',
  interceptor: '>intercept',
  defense: '>defense'
}

/* ---------------- bookmark tree helpers ---------------- */

function isRootLocation(value: string): value is BookmarkLocation {
  return value === 'toolbar' || value === 'menu' || value === 'other'
}

/** Every address a node holds, folders included. */
function urlsInNode(node: BookmarkNode | undefined): string[] {
  if (!node) return []
  if (node.kind === 'bookmark') return node.url ? [node.url] : []
  return (node.children ?? []).flatMap((child) => urlsInNode(child))
}

/** The name of a folder anywhere in the tree, for a status line or a dropdown label. */
function findFolderName(tree: BookmarkTree, id: string): string | null {
  const walk = (nodes: BookmarkNode[]): string | null => {
    for (const node of nodes) {
      if (node.kind !== 'folder') continue
      if (node.id === id) return node.title ?? 'Folder'
      const found = walk(node.children ?? [])
      if (found) return found
    }
    return null
  }
  for (const root of ['toolbar', 'menu', 'other'] as BookmarkLocation[]) {
    const found = walk(tree[root])
    if (found) return found
  }
  return null
}

/**
 * The places a page or a folder can be put, in the order the editor lists them.
 *
 * The three roots come first and always, because they exist whether or not anything is filed
 * there; the folders follow, labelled with their path so two folders with the same name are
 * still tellable apart.
 */
function folderChoicesFrom(tree: BookmarkTree): FolderChoice[] {
  const roots: { id: BookmarkLocation; label: string }[] = [
    { id: 'toolbar', label: 'Bookmarks Toolbar' },
    { id: 'menu', label: 'Bookmarks Menu' },
    { id: 'other', label: 'Other Bookmarks' }
  ]
  const out: FolderChoice[] = [...roots]
  const walk = (nodes: BookmarkNode[], path: string): void => {
    for (const node of nodes) {
      if (node.kind !== 'folder') continue
      const name = node.title ?? 'Folder'
      out.push({ id: node.id, label: `${path} / ${name}` })
      walk(node.children ?? [], `${path} / ${name}`)
    }
  }
  for (const root of roots) {
    walk(tree[root.id], root.label)
  }
  return out
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  /**
   * Per-tab viewport status.
   *
   * Every open tab keeps its own frames alive - hidden, not unmounted - so its DOM, scroll
   * position and history survive a tab switch. That means viewport events have to be filed
   * under the tab that produced them instead of landing in one shared bucket.
   */
  const [statuses, setStatuses] = useState<Record<string, Record<ViewportId, ViewportStatus>>>({})
  const [address, setAddress] = useState('')
  const [activeView, setActiveView] = useState<ViewportId>('mobile')
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [activePanel, setActivePanel] = useState<SidebarPanel>('console')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const tabSeq = useRef(0)
  const [desktopWidth, setDesktopWidth] = useState<number | null>(null)
  const [guestSizes, setGuestSizes] = useState<Record<ViewportId, { width: number; height: number }>>({
    mobile: { width: 375, height: 812 },
    desktop: { width: 0, height: 0 }
  })

  /* Omnibox */
  const [history, setHistory] = useState<HistoryEntry[]>([])
  /** Locally saved pages. They feed omnibox ranking; nothing about them leaves the machine. */
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  /**
   * The bar's own view of the store: three ordered roots with folders and separators in them.
   *
   * Kept beside the flat list rather than derived from it, because the tree carries the order and
   * the containers while the list carries "which pages are saved" - the two are answers to
   * different questions, and both come out of the same snapshot.
   */
  const [barTree, setBarTree] = useState<BookmarkTree>({ toolbar: [], menu: [], other: [] })
  const [bookmarkOptions, setBookmarkOptions] = useState<BookmarkOptions>({
    toolbarVisible: false,
    showOtherBookmarks: false
  })
  /**
   * Whether the bookmarks bar's own clipboard is holding a node.
   *
   * Tracked here from the clipboard action's own replies rather than in the bar, because the bar
   * only draws: it is what decides whether the Paste row exists at all, and a menu should be able
   * to answer that question before it renders rather than by greying something out.
   */
  const [bookmarkClipboard, setBookmarkClipboard] = useState(false)
  /** The folder dialog: a new folder's draft, or an existing folder being renamed. */
  const [folderDialog, setFolderDialog] = useState<{
    folder: { id: string; title: string } | null
    location: string
  } | null>(null)
  const [omniboxHint, setOmniboxHint] = useState<string | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findFocusSignal, setFindFocusSignal] = useState(0)
  const [findTargetId, setFindTargetId] = useState<number | null>(null)
  const [findResult, setFindResult] = useState<FindInPageResult | null>(null)

  /* Session profile: ghost mode swaps both viewports onto an isolated partition. */
  const [ghost, setGhost] = useState<GhostSessionState>({
    active: false,
    partition: '',
    blockedRequests: 0,
    enteredAt: null
  })
  /**
   * Page tabs.
   *
   * Each tab owns its URL, its title *and* its own viewport instances. A tab with no URL is a
   * "new tab page": the dashboard is that tab's page, not an overlay painted over whichever tab
   * happened to be active, which is what used to let a fresh tab navigate the previous one away
   * from its site. `startUrl` is the active tab's page; `null` means the dashboard is showing
   * for this tab.
   */
  const [tabs, setTabs] = useState<PageTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  /** Site icons per tab, keyed by the host they belong to so a navigation invalidates them. */
  const [tabIcons, setTabIcons] = useState<Record<string, { host: string; dataUrl: string }>>({})
  /** Closed tabs, newest first, so "Reopen Closed Tab" has something to bring back. */
  const closedTabs = useRef<{ url: string; title: string; private?: boolean }[]>([])
  /**
   * Live state of the max-protection private tabs, straight from the main process.
   *
   * The tab strip only carries the flag; the counters, the partition and the enforced policy
   * come from here, so the pill in the toolbar is reporting what the session did rather than
   * what the renderer assumed it would do.
   */
  const [privateTabs, setPrivateTabs] = useState<PrivateTabState[]>([])
  /** Tab ids that have an unread notification (title or URL changed while backgrounded). */
  const [notifiedTabIds, setNotifiedTabIds] = useState<Set<string>>(new Set())
  /** Tabs already asked about, so a site without an icon is not asked for again. */
  const iconRequests = useRef(new Set<string>())
  /**
   * A mirror of the resolved icons for the effects below to read.
   *
   * Both icon effects used to list their own state in their dependencies, so every icon they
   * resolved re-ran them; reading the current value from a ref instead breaks that feedback and
   * leaves the toolbar free of a re-render storm while a page is loading.
   */
  const tabIconsRef = useRef(tabIcons)
  useLayoutEffect(() => {
    tabIconsRef.current = tabIcons
  })
  /** Favicons for the bookmarks bar, keyed by origin. */
  const [barIcons, setBarIcons] = useState<Record<string, string>>({})
  const barIconRequests = useRef(new Set<string>())
  const barIconsRef = useRef(barIcons)
  useLayoutEffect(() => {
    barIconsRef.current = barIcons
  })
  /** The add-bookmark editor's draft, or null when it is closed. */
  const [bookmarkEditor, setBookmarkEditor] = useState<{ url: string; title: string } | null>(null)
  /** Where the last bookmark was filed, and whether the star opens the editor at all. */
  const [bookmarkLocation, setBookmarkLocation] = useState<BookmarkLocation>('toolbar')
  const [showBookmarkEditor, setShowBookmarkEditor] = useState(true)

  /**
   * Tab-strip icons.
   *
   * Main fetches the site's `/favicon.ico` and hands back a data URL, so the renderer never
   * talks to the network and the CSP does not have to open up. A site with no icon simply gets
   * none, and the chip draws the site's initial instead.
   */
  useEffect(() => {
    /**
     * An icon belongs to the host it was fetched for, not to the tab forever: navigating a tab
     * to another site has to drop the old mark, or the chip keeps showing the previous site.
     */
    const current = tabIconsRef.current
    const stale = tabs.filter((tab) => current[tab.id] && current[tab.id].host !== tab.host)
    if (stale.length > 0) {
      // Leaving a host also clears the "already asked" mark, so coming back asks again.
      for (const tab of stale) {
        const oldHost = current[tab.id].host
        iconRequests.current.delete(`${tab.id}:${oldHost}`)
        iconRequests.current.delete(`x:${tab.id}:${oldHost}`)
      }
      setTabIcons((previous) => {
        const clone = { ...previous }
        for (const tab of stale) delete clone[tab.id]
        return clone
      })
    }

    /**
     * A tab that just changed host still carries the old icon in `current`, so its "already
     * asked" mark is what decides here - not the icon - or the new site would wait for some
     * later tab change before it got its own mark.
     */
    const moved = new Set(stale.map((tab) => tab.id))
    const pending = tabs.filter((tab) => {
      const key = `${tab.id}:${tab.host}`
      if (!tab.url || !tab.host) return false
      /**
       * A private tab has no icon fetched for it. The chip shows the shield instead, and asking
       * this process for the site's `/favicon.ico` would put a request on the wire that did not
       * come from the tab's own max-protection session.
       */
      if (tab.private) return false
      if (moved.has(tab.id)) return !iconRequests.current.has(key)
      return !iconRequests.current.has(key) && !current[tab.id]
    })
    if (pending.length === 0) return
    let cancelled = false
    for (const tab of pending) iconRequests.current.add(`${tab.id}:${tab.host}`)

    void (async () => {
      for (const tab of pending) {
        const result = await window.devlens.faviconGet(tab.url ?? '').catch(() => null)
        if (cancelled || !result?.dataUrl) continue
        const dataUrl = result.dataUrl
        const host = tab.host
        setTabIcons((previous) => ({ ...previous, [tab.id]: { host, dataUrl } }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tabs])
  /**
   * DOM-candidate icon fallback.
   *
   * Runs whenever the viewport statuses change (so we pick up the moment a page is ready) or
   * the tab list changes. For every tab where the plain `/favicon.ico` fetch came back empty -
   * meaning `tabIcons` has no entry yet, and we haven't already tried extraction for this host -
   * we read the page's own `link[rel*='icon']` hrefs through `executeJavaScript` on the live
   * guest, and hand them to the new `faviconExtract` IPC. Main resolves and fetches the best
   * candidate; the renderer never touches the network.
   *
   * Pinned/background tabs stay mounted (their DOM is intact), so this works for them the
   * moment their guest reports `ready`. A host we have already asked about is not re-asked:
   * the marker lives in `iconRequests` under an `x:` prefix, so the two paths co-exist.
   */
  useEffect(() => {
    /** No work to do while the tab list is still settling (navigation just started). */
    const resolved = tabIconsRef.current
    const tryExtract = tabs.filter((tab) => {
      if (tab.private) return false
      if (!tab.url || !tab.host) return false
      if (resolved[tab.id]) return false
      const extractKey = `x:${tab.id}:${tab.host}`
      if (iconRequests.current.has(extractKey)) return false
      // The guest must be actually ready - a `loading` or `failed` phase means the DOM is not
      // what the user is looking at yet, and an empty extraction would pollute the marker.
      const viewIds: ViewportId[] = ['desktop', 'mobile']
      return viewIds.some(
        (viewId) => statuses[tab.id]?.[viewId]?.phase === 'ready'
      )
    })
    if (tryExtract.length === 0) return
    let cancelled = false
    for (const tab of tryExtract) iconRequests.current.add(`x:${tab.id}:${tab.host}`)

    void (async () => {
      for (const tab of tryExtract) {
        if (cancelled) return
        // Prefer the desktop frame (the one actually visible in most layouts), fall back to
        // mobile. Both share the partition, so the same DOM is behind both.
        const framesForTab = frames.current[tab.id]
        const handle = framesForTab?.desktop ?? framesForTab?.mobile
        if (!handle) continue
        /**
         * Read the hrefs in the guest's own document. `l.href` is the resolved absolute URL
         * the browser would follow; `getAttribute('href')` is the raw attribute - we take the
         * former and only fall back when it is empty. The selector covers every variant of
         * `rel="icon"` (`shortcut icon`, `apple-touch-icon`, `manifest`-served icons) in one
         * shot because they all contain the substring `icon`.
         */
        const script =
          'JSON.stringify(Array.from(document.querySelectorAll("link[rel*=icon]"))' +
          '.map(function(l){return l.href || l.getAttribute("href") || ""})' +
          '.filter(Boolean))'
        const raw: unknown = await handle.evaluate(script).catch(() => null)
        if (cancelled) return
        if (typeof raw !== 'string') continue
        let hrefs: string[]
        try {
          const parsed = JSON.parse(raw)
          hrefs = Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : []
        } catch {
          continue
        }
        if (hrefs.length === 0) continue
        const result = await window.devlens.faviconExtract(tab.url ?? '', hrefs).catch(() => null)
        if (cancelled || !result?.dataUrl) continue
        const dataUrl = result.dataUrl
        const host = tab.host
        setTabIcons((previous) => ({ ...previous, [tab.id]: { host, dataUrl } }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tabs, statuses])
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const tabMru = useRef<string[]>([])
  useEffect(() => {
    if (!activeTabId) return
    tabMru.current = [activeTabId, ...tabMru.current.filter((id) => id !== activeTabId)].slice(0, 50)
  }, [activeTabId])
  /** The active tab's icon, but only while it still belongs to the page on screen. */
  const activeSiteIcon =
    activeTab && tabIcons[activeTab.id]?.host === activeTab.host
      ? tabIcons[activeTab.id].dataUrl
      : null
  const startUrl = activeTab?.url ?? null
  /**
   * The shell's own pages.
   *
   * `devlens:` URLs are answered here rather than loaded: a tab carrying one has no viewport at
   * all, which is what makes `devlens:settings/search` a page instead of a request to a host
   * called "devlens". The dashboard keeps its own rule - an *empty* tab is a new tab page.
   */
  const activeInternal = internalRouteOf(startUrl)
  /** The settings section is carried by the tab URL, not by component-local navigation state. */
  const activeSettingsCategory = settingsCategoryOf(startUrl)
  const dashboardVisible = Boolean(activeTab) && (!startUrl || activeInternal === 'newtab')
  /**
   * DevLens's own pages are an application surface, not a target to emulate. The empty front
   * page and every `devlens:` route therefore bypass the responsive preview controls together.
   */
  const internalSurface = Boolean(activeTab) && (dashboardVisible || activeInternal !== null)
  const activeStatuses = statuses[activeTabId ?? ''] ?? EMPTY_TAB_STATUSES
  const standardUrl = useRef('')

  /* WImH extreme defense + new tab dashboard */
  const [mode, setMode] = useState<WorkspaceMode>('dev')
  const [modeBusy, setModeBusy] = useState(false)
  /**
   * WImH overlay.
   *
   * This is the one security surface normal mode keeps: it is privacy rather than monitoring,
   * it is only reachable through a deliberate action, and while it is open main arms capture
   * for it. Closing it drops everything that was observed.
   */
  const [defenseOpen, setDefenseOpen] = useState(false)
  /** Bumped to ask the profile switcher to open; the main menu's identity row uses it. */
  const [profileOpenSignal, setProfileOpenSignal] = useState(0)
  /**
   * The page context menu, if one is open.
   *
   * The payload comes from the guest's own inspection and the clipboard is read before the menu is
   * drawn, so what is in here is everything needed to decide the rows - there is no state in the
   * menu itself, and nothing to grey out later.
   */
  const [pageMenu, setPageMenu] = useState<
    (PageContextMenuPayload & { clipboard: string; guestId: number | null }) | null
  >(null)
  const [inspection, setInspection] = useState<InspectionState>(EMPTY_INSPECTION)
  /**
   * Protection level. The dial is main-process truth and per-session by design: the renderer
   * shows what the engine is enforcing, it never keeps its own idea of a privacy setting.
   */
  const [protection, setProtection] = useState<ProtectionState>(EMPTY_PROTECTION)
  const [protectionBusy, setProtectionBusy] = useState(false)
  /** Sequence number of the latest protection request, so stale answers cannot win. */
  const protectionRequest = useRef(0)
  const [profiles, setProfiles] = useState<BrowserProfile[]>([])
  const [profilesBusy, setProfilesBusy] = useState(false)
  const [profilePartition, setProfilePartition] = useState('')
  /**
   * Identity. `profileId` is main-process truth; the gate is shown while the shell waits for a
   * choice, and the tab sets are filed per identity so two profiles never share a tab strip.
   */
  const [profileId, setProfileId] = useState('')
  const [profileAsk, setProfileAsk] = useState(true)
  const [gateOpen, setGateOpen] = useState(false)
  const tabSets = useRef<Record<string, { tabs: PageTab[]; activeId: string | null }>>({})
  const lastProfile = useRef('')
  const [wimh, setWimh] = useState<WimhState | null>(null)
  const [wimhBusy, setWimhBusy] = useState(false)
  const [servers, setServers] = useState<LocalServer[]>([])
  const [scanning, setScanning] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([])
  /**
   * The cookies and storage inspector's data.
   *
   * Cookies come from the main process (they belong to the session); localStorage and
   * sessionStorage are read from the guest document itself, because that is where they live. One
   * refresh fills both, so the panel has a single "as of now".
   */
  const [cookies, setCookies] = useState<CookieRecord[]>([])
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([])
  const [storageBusy, setStorageBusy] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  /**
   * This profile's small preferences, currently which AI assistant it uses.
   *
   * Main owns the file, so the shell reads it rather than remembering it: the dock's branding
   * and the panel's provider are the same value, and switching identity brings that identity's
   * choice with it.
   */
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES)
  const browserPreferences: BrowserPreferences =
    preferences.browser ?? DEFAULT_BROWSER_PREFERENCES
  const launchpadPreferences: LaunchpadPreferences =
    preferences.launchpad ?? DEFAULT_LAUNCHPAD_PREFERENCES
  const privacyPreferences: PrivacyPreferences =
    preferences.privacy ?? DEFAULT_PRIVACY_PREFERENCES
  const appearancePreferences: AppearancePreferences =
    preferences.appearance ?? DEFAULT_APPEARANCE_PREFERENCES
  const tabsPreferences: TabsPreferences =
    preferences.tabs ?? DEFAULT_TABS_PREFERENCES
  const languagePreferences: LanguagePreferences =
    preferences.languages ?? DEFAULT_LANGUAGE_PREFERENCES
  const aboutPreferences =
    preferences.about ?? DEFAULT_ABOUT_PREFERENCES
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)
  const [ideOptions, setIdeOptions] = useState<IdeOption[]>([])
  const downloadPreferences = preferences.downloads ?? DEFAULT_DOWNLOAD_PREFERENCES
  const developerPreferences = preferences.developer ?? DEFAULT_DEVELOPER_PREFERENCES
  const detectedIde = ideOptions.find((option) => option.id === developerPreferences.ideId)
  const ideEditorLabel =
    detectedIde?.label ??
    IDE_PRESETS.find((option) => option.id === developerPreferences.ideId)?.label ??
    developerPreferences.ideId
  const ideEnabled = developerPreferences.ideEnabled
  const browserPreferencesRef = useRef(browserPreferences)
  const launchpadPreferencesRef = useRef(launchpadPreferences)
  const privacyPreferencesRef = useRef(privacyPreferences)
  const appearancePreferencesRef = useRef(appearancePreferences)
  const tabsPreferencesRef = useRef(tabsPreferences)
  const languagePreferencesRef = useRef(languagePreferences)
  useLayoutEffect(() => {
    browserPreferencesRef.current = browserPreferences
    launchpadPreferencesRef.current = launchpadPreferences
    privacyPreferencesRef.current = privacyPreferences
    appearancePreferencesRef.current = appearancePreferences
    tabsPreferencesRef.current = tabsPreferences
    languagePreferencesRef.current = languagePreferences
  })
  /** Avoid replacing a restored session with the empty startup tab during bootstrap. */
  const sessionSaveReady = useRef(false)
  const [systemIntegration, setSystemIntegration] = useState<LaunchpadSystemState>({
    isDefaultBrowser: false,
    launchAtLogin: false
  })
  const [systemIntegrationBusy, setSystemIntegrationBusy] = useState(false)
  const [diskUsage, setDiskUsage] = useState<ProfileDiskUsage>({ bytes: 0, files: 0 })
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const effectiveDensity: UiDensity =
    appearancePreferences.density === 'automatic'
      ? screenWidth < 980
        ? 'touch'
        : screenWidth < 1420
          ? 'compact'
          : 'standard'
      : appearancePreferences.density
  const resolvedContentTheme =
    appearancePreferences.contentTheme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : appearancePreferences.contentTheme

  /**
   * The omnibox configuration, and the site icons the operator's own rows are drawn with.
   *
   * Main owns both the settings file and the favicon fetch, so this is a mirror plus a writer:
   * `devlens:settings/search` edits it, the field reads it, and a save round-trips through main
   * so the file is the one that decides what came back.
   */
  const omniboxSettings: OmniboxSettings = preferences.omnibox ?? DEFAULT_OMNIBOX_SETTINGS
  const allOmniboxEntries = useMemo(() => omniboxEntries(omniboxSettings), [omniboxSettings])
  const customIconUrls = useMemo(
    () => allOmniboxEntries.map((entry) => entry.template),
    [allOmniboxEntries]
  )
  const customOrigins = useFavicons(customIconUrls)
  const customFavicons = useMemo(() => {
    const icons: Record<string, string | null> = {}
    for (const entry of allOmniboxEntries) icons[entry.id] = iconFor(customOrigins, entry.template)
    return icons
  }, [allOmniboxEntries, customOrigins])
  /** One resolved answer for ranking, rendering, and the resting omnibox mark. */
  const defaultEngine = useMemo(() => resolveDefaultEngine(omniboxSettings), [omniboxSettings])

  const saveOmniboxSettings = useCallback((next: OmniboxSettings) => {
    /* Optimistic, then reconciled with what main actually stored: a rejected entry (no template)
       must not live on in the UI because the write was fire-and-forget. */
    setPreferences((current) => ({ ...current, omnibox: next }))
    void window.devlens
      .omniboxSettingsSet(next)
      .then((stored) => setPreferences((current) => ({ ...current, omnibox: stored })))
      .catch(() => undefined)
  }, [])

  /**
   * The mobile emulator's selection: which device, which fold state, and the free size.
   *
   * Held in the profile's preferences rather than in this window, so the device someone is testing
   * a layout on survives a restart and does not follow another identity around.
   */
  const mobileSettings: MobileSettings = preferences.mobile ?? DEFAULT_MOBILE_SETTINGS
  const saveMobileSettings = useCallback(
    (patch: Partial<MobileSettings>) => {
      void window.devlens
        .preferencesSet({ mobile: { ...mobileSettings, ...patch } })
        .then(setPreferences)
        .catch(() => undefined)
    },
    [mobileSettings]
  )

  /**
   * Toolbar arrangement.
   *
   * Same shape as the omnibox settings: the file is main's, so a change is written and the answer
   * is what the shell then shows. A partial patch is merged in main, which is also where an
   * unknown position is refused - a hand-edited file must not be able to leave the dock handle in
   * a slot the toolbar cannot render.
   */
  const toolbarLayout: ToolbarLayout = preferences.toolbar ?? DEFAULT_TOOLBAR_LAYOUT
  const saveToolbarLayout = useCallback(
    (patch: { sidebarToggle?: SidebarTogglePosition; tools?: Partial<ToolbarTools> }) => {
      void window.devlens
        .preferencesSet({
          toolbar: {
            sidebarToggle: patch.sidebarToggle ?? toolbarLayout.sidebarToggle,
            tools: { ...toolbarLayout.tools, ...patch.tools }
          }
        })
        .then(setPreferences)
        /* A failed write leaves the layout as it was rather than half-applied: the file is the
           truth, and the next read of it will say so. */
        .catch(() => undefined)
    },
    [toolbarLayout]
  )

  /** Browser-wide choices are a partial patch over the profile's current values. */
  const saveBrowserPreferences = useCallback(
    (patch: Partial<BrowserPreferences>) => {
      void window.devlens
        .preferencesSet({ browser: { ...browserPreferences, ...patch } })
        .then(setPreferences)
        .catch(() => undefined)
    },
    [browserPreferences]
  )

  const saveLaunchpadPreferences = useCallback(
    (patch: Partial<LaunchpadPreferences>) => {
      void window.devlens
        .preferencesSet({
          launchpad: {
            ...launchpadPreferences,
            ...patch,
            widgets: { ...launchpadPreferences.widgets, ...patch.widgets },
            activity: { ...launchpadPreferences.activity, ...patch.activity }
          }
        })
        .then(setPreferences)
        .catch(() => undefined)
    },
    [launchpadPreferences]
  )

  const setLaunchAtLogin = useCallback(
    (enabled: boolean): void => {
      setSystemIntegrationBusy(true)
      void window.devlens
        .launchpadSetLaunchAtLogin(enabled)
        .then((state) => {
          setSystemIntegration(state)
          saveLaunchpadPreferences({ launchAtLogin: state.launchAtLogin })
        })
        .finally(() => setSystemIntegrationBusy(false))
    },
    [saveLaunchpadPreferences]
  )

  const setDefaultBrowser = useCallback((): void => {
    setSystemIntegrationBusy(true)
    void window.devlens
      .launchpadSetDefaultBrowser()
      .then(setSystemIntegration)
      .finally(() => setSystemIntegrationBusy(false))
  }, [])

  const chooseLaunchpadWallpaper = useCallback((): void => {
    void window.devlens.launchpadPickWallpaper().then((result) => {
      if (result.ok && result.dataUrl) {
        saveLaunchpadPreferences({ wallpaperPreset: 'custom', wallpaper: result.dataUrl })
      }
    })
  }, [saveLaunchpadPreferences])

  const savePrivacyPreferences = useCallback(
    (patch: Partial<PrivacyPreferences>) => {
      void window.devlens
        .preferencesSet({ privacy: { ...privacyPreferences, ...patch } })
        .then(setPreferences)
        .catch(() => undefined)
    },
    [privacyPreferences]
  )

  const saveAppearancePreferences = useCallback(
    (patch: Partial<AppearancePreferences>) => {
      const next = { ...appearancePreferences, ...patch }
      void window.devlens
        .preferencesSet({ appearance: next })
        .then(setPreferences)
        .catch(() => undefined)
      if (patch.contentTheme) void window.devlens.appearanceApplyTheme(next.contentTheme)
      if (patch.appIcon) void window.devlens.appearanceSetAppIcon(next.appIcon)
    },
    [appearancePreferences]
  )

  const saveTabsPreferences = useCallback(
    (patch: Partial<TabsPreferences>) => {
      void window.devlens
        .preferencesSet({
          tabs: {
            ...tabsPreferences,
            ...patch,
            containers: patch.containers ?? tabsPreferences.containers,
            hotkeys: patch.hotkeys ?? tabsPreferences.hotkeys
          }
        })
        .then(setPreferences)
        .catch(() => undefined)
    },
    [tabsPreferences]
  )

  const saveLanguagePreferences = useCallback(
    (patch: Partial<LanguagePreferences>) => {
      const next = { ...languagePreferences, ...patch }
      void window.devlens
        .preferencesSet({ languages: next })
        .then(setPreferences)
        .catch(() => undefined)
      void window.devlens.languagesApply({
        spellCheck: next.spellCheck,
        spellCheckLanguages: next.spellCheckLanguages
      })
    },
    [languagePreferences]
  )

  const setSiteException = useCallback(
    (site: string, allowed: boolean): void => {
      void window.devlens.protectionSetSiteAllowed(site, allowed).then((state) => {
        setProtection(state)
        savePrivacyPreferences({ siteExceptions: state.allowedSites })
      })
    },
    [savePrivacyPreferences]
  )


  /* Live design session */
  const [cssDraft, setCssDraft] = useState('')
  const [cssApplied, setCssApplied] = useState('')
  const [designMode, setDesignMode] = useState(false)
  const [designTarget, setDesignTarget] = useState<DesignTarget>('both')
  const [designStatus, setDesignStatus] = useState<string | null>(null)
  const [cssAppliedAt, setCssAppliedAt] = useState<number | null>(null)

  /** Frame handles, filed per tab so a command always reaches the tab you are looking at. */
  const frames = useRef<Record<string, Partial<Record<ViewportId, ViewportHandle>>>>({})
  const frameRefs = useRef(new Map<string, Record<ViewportId, (instance: ViewportHandle | null) => void>>())
  const addressFocused = useRef(false)
  const statusTimer = useRef<number | null>(null)
  const { ref: canvasRef, size: canvasSize } = useElementSize<HTMLDivElement>()

  /** The active tab's handle for a viewport: every shell command goes through here. */
  const activeFrame = useCallback(
    (viewId: ViewportId): ViewportHandle | undefined =>
      activeTabId ? frames.current[activeTabId]?.[viewId] : undefined,
    [activeTabId]
  )

  /**
   * Stable per-tab ref callbacks.
   *
   * An inline arrow would be detached and re-attached on every render, which briefly nulls the
   * handles the shell drives, so one pair is created per tab and kept for that tab's lifetime.
   */
  const frameRefFor = useCallback((tabId: string, viewId: ViewportId) => {
    let entry = frameRefs.current.get(tabId)
    if (!entry) {
      const make = (id: ViewportId) => (instance: ViewportHandle | null) => {
        const bucket = frames.current[tabId] ?? (frames.current[tabId] = {})
        if (instance) bucket[id] = instance
        else delete bucket[id]
      }
      entry = { mobile: make('mobile'), desktop: make('desktop') }
      frameRefs.current.set(tabId, entry)
    }
    return entry[viewId]
  }, [])

  /**
   * Live capture belongs to the developer workspace. Normal mode only listens while the WImH
   * overlay is open, which mirrors what the main process actually records.
   */
  const monitoringLive = isDevMode(mode) || defenseOpen
  const { entries, counts, clear } = useLogStore(monitoringLive)
  const interceptor = useInterceptorStore(monitoringLive)
  const interceptorClear = interceptor.clear

  /* The lease is main-process truth: the renderer reports intent and follows the answer. */
  useEffect(() => window.devlens.onInspectionChanged(setInspection), [])

  /**
   * Protection level. The engine owns it; this side only reports what it is enforcing, so the
   * badge can never claim a level the request filter is not applying.
   */
  useEffect(() => window.devlens.onProtectionChanged(setProtection), [])

  useEffect(() => {
    let cancelled = false
    void window.devlens.inspectionState().then((state) => {
      if (!cancelled) setInspection(state)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    void window.devlens.inspectionSetOpen(defenseOpen).then((state) => {
      if (!cancelled) setInspection(state)
    })
    return () => {
      cancelled = true
    }
  }, [defenseOpen])

  /**
   * Nothing observed on demand outlives the panel that asked for it: when the overlay closes
   * in normal mode both sides forget, so a closed panel leaves a clean, unmonitored browser.
   */
  useEffect(() => {
    if (isDevMode(mode) || defenseOpen) return
    clear()
    // Both clear callbacks are stable, so this only fires when the lease actually ends.
    interceptorClear()
  }, [defenseOpen, mode, clear, interceptorClear])

  useEffect(() => {
    let cancelled = false
    window.devlens
      .getBootstrap()
      .then(async (payload) => {
        if (cancelled) return
        setBootstrap(payload)
        const [storedPreferences, recent, savedStore, ghostState] = await Promise.all([
          window.devlens.preferencesState(),
          window.devlens.historyList(payload.historyLimit),
          window.devlens.bookmarksSnapshot(),
          window.devlens.ghostState()
        ])
        if (cancelled) return
        setPreferences(storedPreferences)
        const storedPrivacy = storedPreferences.privacy ?? DEFAULT_PRIVACY_PREFERENCES
        const storedAppearance =
          storedPreferences.appearance ?? DEFAULT_APPEARANCE_PREFERENCES
        const storedLanguages =
          storedPreferences.languages ?? DEFAULT_LANGUAGE_PREFERENCES
        void window.devlens.appearanceApplyTheme(storedAppearance.contentTheme)
        void window.devlens.appearanceSetAppIcon(storedAppearance.appIcon)
        void window.devlens.languagesApply({
          spellCheck: storedLanguages.spellCheck,
          spellCheckLanguages: storedLanguages.spellCheckLanguages
        })
        void window.devlens.protectionSetShieldRules({
          crossSiteTrackers: storedPrivacy.blockCrossSiteTrackers,
          fingerprinters: storedPrivacy.blockFingerprinters,
          cryptominers: storedPrivacy.blockCryptominers,
          sendDnt: storedPrivacy.sendDnt
        })
        void window.devlens.privacyApplyNetwork({ dnsMode: storedPrivacy.dnsMode })
        void window.devlens.protectionSetLevel(storedPrivacy.shieldMode)
        for (const site of storedPrivacy.siteExceptions) {
          void window.devlens.protectionSetSiteAllowed(site, true)
        }
        const storedLaunchpad = storedPreferences.launchpad ?? DEFAULT_LAUNCHPAD_PREFERENCES
        const savedTabs = storedLaunchpad.session.tabs
        const restored =
          storedLaunchpad.startupTabs === 'all'
            ? savedTabs
            : storedLaunchpad.startupTabs === 'pinned'
              ? savedTabs.filter((tab) => tab.pinned === true)
              : []
        if (restored.length > 0) {
          const ids = restored.map((tab) =>
            openTab(tab.url, tab.title, {
              useNewTabTarget: false,
              pinned: tab.pinned === true
            })
          )
          const preferred = savedTabs[storedLaunchpad.session.activeIndex]
          const preferredIndex = restored.findIndex((tab) => tab.url === preferred?.url)
          const active = preferredIndex >= 0 ? preferredIndex : 0
          setActiveTabId(ids[active])
          setAddress(restored[active]?.url ?? '')
          standardUrl.current = restored[active]?.url ?? ''
        } else {
          /*
           * Home target is the launch surface. Launchpad itself is represented by a null URL;
           * Blank Canvas and Custom URL become the first tab's real address.
           */
          const startupUrl = launchTargetUrl(
            storedLaunchpad.homeTarget,
            storedLaunchpad.customUrl
          )
          setAddress(startupUrl ?? '')
          standardUrl.current = startupUrl ?? ''
          openTab(startupUrl, '', { useNewTabTarget: false })
        }
        sessionSaveReady.current = true
        setHistory(recent)
        if (storedPrivacy.historyPolicy === 'never') {
          await window.devlens.historyClear()
          if (!cancelled) setHistory([])
        } else if (
          storedPrivacy.historyExpiry === '7d' ||
          storedPrivacy.historyExpiry === '30d' ||
          storedPrivacy.historyExpiry === '90d'
        ) {
          const days =
            storedPrivacy.historyExpiry === '7d'
              ? 7
              : storedPrivacy.historyExpiry === '30d'
                ? 30
                : 90
          await window.devlens.historyPrune(days)
          const pruned = await window.devlens.historyList(payload.historyLimit)
          if (!cancelled) setHistory(pruned)
        }
        applyBookmarkSnapshot(savedStore)
        setGhost(ghostState)

        const [defense, workspaceList] = await Promise.all([
          window.devlens.wimhState(),
          window.devlens.workspacesList()
        ])
        if (cancelled) return
        setWimh(defense)
        setWorkspaces(workspaceList)
        const [modeSnapshot, profileList] = await Promise.all([
          window.devlens.modeState(),
          window.devlens.profilesList()
        ])
        if (cancelled) return
        setMode(modeSnapshot.mode)
        setProfiles(profileList)
        setProfilePartition(profileList.find((entry) => entry.active)?.partition ?? payload.profilePartition)
        setProfileId(payload.profileId)
        lastProfile.current = payload.profileId
        // The shell waits behind the identity screen when the registry holds more than one
        // profile and the operator has not turned the prompt off.
        setGateOpen(payload.profileAsk)
        setProfileAsk(payload.profileAsk)
        // The engine has already enforced its starting level; the badge follows that answer
        // rather than the boot payload, so the two can never disagree.
        setProtection(await window.devlens.protectionState())
      })
      .catch((error: unknown) => setBootError(error instanceof Error ? error.message : String(error)))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => window.devlens.onGhostChanged(setGhost), [])
  useEffect(() => window.devlens.onWimhChanged(setWimh), [])
  /**
   * Private tabs are main-process state, so the shell subscribes rather than tracking a copy:
   * the counters behind the pill and the badge arrive with every block, header rewrite and
   * refused history write the tab performed.
   */
  useEffect(() => window.devlens.onPrivateTabsChanged(setPrivateTabs), [])
  useEffect(() => {
    let cancelled = false
    void window.devlens.privateTabs().then((list) => {
      if (!cancelled) setPrivateTabs(list)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => window.devlens.onModeChanged((state: ModeState) => setMode(state.mode)), [])
  useEffect(
    () =>
      window.devlens.onProfilesChanged((list) => {
        setProfiles(list)
        const active = list.find((profile) => profile.active)
        if (active) {
          setProfilePartition(active.partition)
          // The identity is what the tab sets are filed under, so a switch made anywhere -
          // toolbar, omnibox or an IPC call - has to move this too.
          setProfileId(active.id)
        }
      }),
    []
  )

  // The address bar follows the active viewport until the user starts typing.
  useEffect(() => {
    if (addressFocused.current) return
    const url = activeStatuses[activeView].url
    if (url && url !== 'about:blank') {
      setAddress(url)
      return
    }
    // Internal pages have no guest status to report, so their route is the address.
    if (internalRouteOf(startUrl)) {
      setAddress(startUrl ?? '')
      return
    }
    // A tab with no page shows an empty address bar rather than the previous tab's URL.
    if (!startUrl) setAddress('')
  }, [activeStatuses, activeView, startUrl])

  /** Tab titles and URLs follow the page, so the strip stays truthful after in-page nav. */
  useEffect(() => {
    if (!activeTabId) return
    const title = activeStatuses.desktop.title || activeStatuses.mobile.title
    const url = activeStatuses[activeView].url
    if (!title && !url) return

    setTabs((current) =>
      {
        const target = current.find((tab) => tab.id === activeTabId)
        if (!target) return current

        const nextUrl = url && url !== 'about:blank' ? url : target.url
        const nextTitle = title || target.title
        // Return the same array when nothing changed: a new array here would re-render for
        // ever, because this effect depends on the status object that it updates.
        if (nextUrl === target.url && nextTitle === target.title) return current

        return current.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                url: nextUrl,
                title: nextTitle,
                host: hostOf(nextUrl),
                secure: Boolean(nextUrl?.startsWith('https://'))
              }
            : tab
        )
      }
    )
  }, [activeStatuses, activeTabId, activeView])

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message)
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current)
    statusTimer.current = window.setTimeout(() => setStatusMessage(null), STATUS_TTL_MS)
  }, [])

  const saveAboutPreferences = useCallback(
    (patch: Partial<{ updateChannel: UpdateChannel; updateStrategy: UpdateStrategy }>) => {
      void window.devlens.preferencesSet({ about: patch })
        .then(setPreferences)
        .catch(() => showStatus('Could not save update preferences. Please try again.'))
    },
    [showStatus]
  )

  const saveDownloadPreferences = useCallback((patch: DownloadPreferencesPatch) => {
    void window.devlens.preferencesSet({ downloads: patch })
      .then(setPreferences)
      .catch(() => showStatus('Could not save download preferences. Please try again.'))
  }, [showStatus])

  const saveDeveloperPreferences = useCallback(
    (patch: Partial<DeveloperPreferences>) => {
      void window.devlens
        .preferencesSet({ developer: { ...developerPreferences, ...patch } })
        .then(setPreferences)
        .catch(() => showStatus('Could not save the editor preference.'))
    },
    [developerPreferences, showStatus]
  )

  /** Switches the level and reflects the engine's answer, including its live counters. */
  const selectProtectionLevel = useCallback(
    async (level: ProtectionLevel) => {
      const request = protectionRequest.current + 1
      protectionRequest.current = request
      setProtectionBusy(true)
      try {
        const next = await window.devlens.protectionSetLevel(level)
        // An answer only counts when it is the answer to *this* selection: a slower earlier
        // switch must never overwrite the level the operator asked for afterwards.
        setProtection((current) => (next.level === level ? next : current))
        showStatus(
          next.policy.ramOnlySession
            ? `protection: ${next.level} - RAM-only session engaged`
            : `protection: ${next.level}`
        )
      } catch {
        showStatus('could not change the protection level')
      } finally {
        // Only the most recent switch owns the spinner.
        if (protectionRequest.current === request) setProtectionBusy(false)
      }
    },
    [showStatus]
  )

  const setShieldMode = useCallback(
    (mode: PrivacyPreferences['shieldMode']): void => {
      savePrivacyPreferences({ shieldMode: mode })
      void selectProtectionLevel(mode)
    },
    [savePrivacyPreferences, selectProtectionLevel]
  )

  /**
   * Main owns the history, so the renderer pulls it when it matters: focusing the omnibox and
   * after every navigation. Without this, suggestions on an empty field would only ever show
   * what existed at boot.
   */
  const refreshHistory = useCallback(async () => {
    try {
      const limit = bootstrap?.historyLimit ?? 200
      setHistory(await window.devlens.historyList(limit))
    } catch {
      /* history is a convenience: never let it break navigation */
    }
  }, [bootstrap?.historyLimit])

  /**
   * One place where a bookmark snapshot lands.
   *
   * Every mutation answers with the whole store and broadcasts it, so the flat list the omnibox
   * ranks, the tree the bar draws and the bar's two preferences are always updated together -
   * there is no path that can update one and forget the other two.
   *
   * Snapshots carry a revision and an older one is dropped: the reply to a mutation and the
   * broadcast of it travel on different channels, and without this a late reply could put the
   * bar back to a state the store had already left.
   */
  const bookmarkRevision = useRef(-1)
  const applyBookmarkSnapshot = useCallback((snapshot: BookmarkSnapshot) => {
    if (typeof snapshot?.revision === 'number') {
      if (snapshot.revision < bookmarkRevision.current) return
      bookmarkRevision.current = snapshot.revision
    }
    setBookmarks(snapshot.entries)
    setBarTree(snapshot.tree)
    setBookmarkOptions(snapshot.options)
  }, [])

  /** Bookmarks live next to history and are ranked together with it; both stay local. */
  const refreshBookmarks = useCallback(async () => {
    try {
      applyBookmarkSnapshot(await window.devlens.bookmarksSnapshot())
    } catch {
      /* the star is a convenience too: a failed read must not break navigation */
    }
  }, [applyBookmarkSnapshot])

  useEffect(() => window.devlens.onBookmarksChanged(applyBookmarkSnapshot), [applyBookmarkSnapshot])

  /**
   * Preferences are per profile, so the shell re-reads them whenever the identity changes - the
   * same hot-swap history and bookmarks get. Main broadcasts a change as well, which is how the
   * dock's branding follows a provider switch made inside the panel.
   */
  const refreshPreferences = useCallback(async () => {
    try {
      setPreferences(await window.devlens.preferencesState())
    } catch {
      /* a preference is a convenience: a failed read leaves the default in place */
    }
  }, [])

  useEffect(() => window.devlens.onPreferencesChanged(setPreferences), [])
  useEffect(() => {
    let cancelled = false
    void window.devlens.aboutInfo().then((info) => {
      if (!cancelled) setAboutInfo(info)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    let cancelled = false
    void window.devlens.ideList().then((options) => {
      if (!cancelled) setIdeOptions(options)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    void window.devlens.launchpadSystemState().then(setSystemIntegration)
  }, [])
  useEffect(() => {
    if (!launchpadPreferences.checkDefaultBrowser) return
    let cancelled = false
    const check = (): void => {
      void window.devlens
        .launchpadSystemState()
        .then((state) => {
          if (!cancelled) setSystemIntegration(state)
        })
        .catch(() => undefined)
    }
    check()
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [launchpadPreferences.checkDefaultBrowser])
  useEffect(() => {
    void window.devlens.privacyDiskUsage().then(setDiskUsage)
  }, [profileId])
  useEffect(() => {
    const onResize = (): void => setScreenWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    document.documentElement.lang = languagePreferences.primaryLanguage
  }, [languagePreferences.primaryLanguage])
  useEffect(() => {
    const root = document.documentElement
    const interfaceFont =
      INTERFACE_FONTS.find((font) => font.id === appearancePreferences.uiFont) ?? INTERFACE_FONTS[0]
    const codeFont =
      CODE_FONTS.find((font) => font.id === appearancePreferences.codeFont) ?? CODE_FONTS[0]
    const previousSans = root.style.getPropertyValue('--font-sans')
    const previousMono = root.style.getPropertyValue('--font-mono')
    root.style.setProperty('--font-sans', interfaceFont.family)
    root.style.setProperty('--font-mono', codeFont.family)
    root.dataset.uiFont = interfaceFont.id
    root.dataset.codeFont = codeFont.id
    return () => {
      if (previousSans) root.style.setProperty('--font-sans', previousSans)
      else root.style.removeProperty('--font-sans')
      if (previousMono) root.style.setProperty('--font-mono', previousMono)
      else root.style.removeProperty('--font-mono')
    }
  }, [appearancePreferences.uiFont, appearancePreferences.codeFont])

  /**
   * The omnibox panel's own channel.
   *
   * It carries the same value as the preferences event above, and is subscribed to separately on
   * purpose: Search settings at `devlens:settings/search` is a page in a tab, and a page that only
   * learns about its own settings when some *other* preference changes would be a page that is
   * right by accident.
   */
  useEffect(
    () =>
      window.devlens.onOmniboxSettingsChanged((omnibox) =>
        setPreferences((current) => ({ ...current, omnibox }))
      ),
    []
  )

  useEffect(() => {
    void refreshPreferences()
  }, [profileId, refreshPreferences])

  /**
   * Favicons for the bookmarks bar.
   *
   * The same main-process fetch the tab strip uses, cached by origin here as well so a bar full
   * of one site's pages costs one request. A site with no icon simply keeps the initial.
   */
  useEffect(() => {
    const origins = new Set<string>()
    for (const bookmark of bookmarks) {
      try {
        origins.add(new URL(bookmark.url).origin)
      } catch {
        /* an unusable address simply has no icon */
      }
    }
    const pending = [...origins].filter(
      (origin) => !barIconRequests.current.has(origin) && !barIconsRef.current[origin]
    )
    if (pending.length === 0) return
    for (const origin of pending) barIconRequests.current.add(origin)

    let cancelled = false
    void (async () => {
      for (const origin of pending) {
        const result = await window.devlens.faviconGet(`${origin}/`).catch(() => null)
        if (cancelled || !result?.dataUrl) continue
        const dataUrl = result.dataUrl
        setBarIcons((previous) => ({ ...previous, [origin]: dataUrl }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookmarks])

  /* ---------------- page tabs ---------------- */

  /**
   * Creates a tab, activates it, and returns its id.
   *
   * A null URL means "new tab page": the tab is real from the moment it exists, so typing an
   * address in it loads *that* tab and leaves every other tab exactly where it was. This is the
   * difference between a new tab and an overlay drawn on top of the current one.
   */
  const openTab = useCallback(
    (
      url: string | null = null,
      title = '',
      options?: {
        afterId?: string
        partition?: string
        useNewTabTarget?: boolean
        activate?: boolean
        pinned?: boolean
      }
    ): string => {
    tabSeq.current += 1
    const id = `tab-${tabSeq.current}`
    const targetUrl =
      url === null && options?.useNewTabTarget !== false
        ? launchTargetUrl(launchpadPreferences.newTabTarget, launchpadPreferences.customUrl)
        : url
    const tab: PageTab = {
      id,
      url: targetUrl,
      title: title || hostOf(targetUrl),
      host: hostOf(targetUrl),
      secure: Boolean(targetUrl?.startsWith('https://')),
      ...(options?.pinned ? { pinned: true } : {}),
      /* A tab opened *from* a page keeps that page's session; normal tabs leave this unset and
         follow the window. */
      ...(options?.partition ? { partition: options.partition } : {})
    }
    setTabs((current) => {
      if (options?.pinned) {
        const next = [...current]
        next.splice(next.filter((entry) => entry.pinned).length, 0, tab)
        return next
      }
      // "New Tab to Right" and "Duplicate Tab" land next to the tab they came from; everything
      // else goes on the end.
      const index = options?.afterId ? current.findIndex((entry) => entry.id === options.afterId) : -1
      if (index < 0) return [...current, tab]
      const next = [...current]
      next.splice(index + 1, 0, tab)
      return next
    })
    if (options?.activate !== false) {
      setActiveTabId(id)
      setAddress(targetUrl ?? '')
      setOmniboxHint(null)
    }
    return id
    },
    [launchpadPreferences.customUrl, launchpadPreferences.newTabTarget]
  )

  /**
   * Persist the restorable strip after the UI settles. Private tabs never enter this list, and a
   * debounce keeps rapid tab operations from turning the preference store into an event log.
   */
  const saveSessionForTabs = useCallback((nextTabs: PageTab[], activeUrl: string): void => {
    const restorable = nextTabs
      .filter((tab) => !tab.private && Boolean(tab.url))
      .map((tab) => ({
        url: tab.url ?? '',
        title: tab.title,
        ...(tab.pinned ? { pinned: true } : {})
      }))
    const activeIndex = Math.max(
      0,
      restorable.findIndex((tab) => tab.url === activeUrl)
    )
    const session: LaunchpadSession = {
      tabs: restorable,
      activeIndex,
      savedAt: Date.now()
    }
    void window.devlens.launchpadSaveSession(session).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!sessionSaveReady.current) return
    const timer = window.setTimeout(() => {
      saveSessionForTabs(tabs, activeTab?.url ?? '')
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeTab?.url, saveSessionForTabs, tabs])

  /**
   * Opens a tab that runs at maximum protection, on a session of its own.
   *
   * The order matters: main creates and hardens the tab's partition *first*, and only then does
   * the tab exist in the strip. Mounting the viewport before the session was ready would let the
   * first request out under the profile's session - cookies, the window's level, the lot - which
   * is exactly the window a private tab is supposed to not have.
   */
  const openPrivateTab = useCallback(
    async (url: string | null = null, title = ''): Promise<string> => {
      tabSeq.current += 1
      const id = `tab-${tabSeq.current}`
      try {
        const state = await window.devlens.privateTabOpen(id)
        setPrivateTabs((current) => [...current.filter((entry) => entry.tabId !== id), state])
      } catch {
        showStatus('could not open a private tab')
        return ''
      }
      const tab: PageTab = {
        id,
        url,
        title: title || hostOf(url),
        host: hostOf(url),
        secure: Boolean(url?.startsWith('https://')),
        private: true
      }
      setTabs((current) => [...current, tab])
      setActiveTabId(id)
      setAddress(url ?? '')
      setOmniboxHint(null)
      showStatus(`${PRIVATE_TAB_LABEL} - Level 3 for this tab, nothing written down`)
      return id
    },
    [showStatus]
  )

  /** Points the active tab at a URL; the frames remount because the key changes. */
  const setTabUrl = useCallback(
    (url: string, title = ''): void => {
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                url,
                title: title || tab.title || hostOf(url),
                host: hostOf(url),
                secure: url.startsWith('https://')
              }
            : tab
        )
      )
    },
    [activeTabId]
  )

  /** Loads a URL in the active tab, creating one when the session has no page yet. */
  const loadInActiveTab = useCallback(
    (url: string, title = ''): void => {
      if (!activeTabId) {
        openTab(url, title)
        return
      }
      if (!startUrl) {
        setTabUrl(url, title)
        return
      }
      activeFrame('mobile')?.loadUrl(url)
      activeFrame('desktop')?.loadUrl(url)
      setTabUrl(url, title)
    },
    [activeFrame, activeTabId, openTab, setTabUrl, startUrl]
  )

  const selectTab = useCallback(
    (id: string): void => {
      setActiveTabId(id)
      setOmniboxHint(null)
      // Clear the notification flag now that the user is looking at this tab.
      setNotifiedTabIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    []
  )

  /**
   * Opens one of the shell's own pages, or brings the one that is already open to the front.
   *
   * A page is a tab, and a tab is unique per page: opening the settings twice would give the
   * operator two forms editing one file, so the second "open" is a focus. Nothing is written to
   * history either - the address is not a place they visited.
   */
  const openInternalTab = useCallback(
    (route: InternalRouteId, requestedUrl?: string): void => {
      const url =
        route === 'settings'
          ? settingsCategoryUrl(settingsCategoryOf(requestedUrl ?? internalRouteUrl(route)))
          : internalRouteUrl(route)
      const title = internalRouteLabel(route)
      const scope = internalRouteScopeOf(url)
      const existing = tabs.find((tab) => internalRouteScopeOf(tab.url) === scope)
      if (existing) {
        /* One settings centre, not one tab per section: retarget the existing tab even if it is
           currently showing another settings section. */
        setTabs((current) =>
          current.map((tab) =>
            tab.id === existing.id
              ? {
                  ...tab,
                  url,
                  title,
                  host: hostOf(url),
                  secure: false,
                  unloaded: false
                }
              : tab
          )
        )
        selectTab(existing.id)
        setAddress(url)
        return
      }
      openTab(url, title)
    },
    [openTab, selectTab, tabs]
  )

  const openSettingsCategory = useCallback(
    (category: SettingsCategoryId): void => {
      openInternalTab('settings', settingsCategoryUrl(category))
    },
    [openInternalTab]
  )

  const closeTab = useCallback(
    (id: string): void => {
      const index = tabs.findIndex((tab) => tab.id === id)
      const next = tabs.filter((tab) => tab.id !== id)
      // Remember what left, so "Reopen Closed Tab" can put it back.
      const leaving = tabs[index]
      if (leaving?.url) {
        closedTabs.current = [
          { url: leaving.url, title: leaving.title, private: leaving.private },
          ...closedTabs.current
        ].slice(0, 20)
      }
      /**
       * A private tab's session dies with the tab. This runs before anything else so the wipe
       * starts as soon as the tab is gone, and the strip no longer offers a chip whose session
       * is being torn down.
       */
      if (leaving?.private) void window.devlens.privateTabClose(id)
      setTabs(next)
      // Only this tab's view is torn down: its handles, refs and status go with it, and the
      // other tabs keep their pages, scroll positions and history untouched.
      delete frames.current[id]
      frameRefs.current.delete(id)
      setTabIcons((previous) => {
        if (!(id in previous)) return previous
        const clone = { ...previous }
        delete clone[id]
        return clone
      })
      setStatuses((previous) => {
        if (!(id in previous)) return previous
        const clone = { ...previous }
        delete clone[id]
        return clone
      })
      if (activeTabId !== id) return

      // Firefox behaviour: the neighbour takes over. Closing the last tab leaves no tab at all,
      // so the shell drops back to a single empty tab rather than a page-less window.
      const fallback = next[Math.max(0, index - 1)] ?? next[0] ?? null
      if (!fallback) {
        tabSeq.current += 1
        const fresh = `tab-${tabSeq.current}`
        setTabs([{ id: fresh, url: null, title: '', host: '', secure: false }])
        setActiveTabId(fresh)
        setAddress('')
        return
      }
      setActiveTabId(fallback.id)
      setAddress(fallback.url ?? '')
    },
    [activeTabId, tabs]
  )

  // Isolation modes outrank the profile, which outranks the config default: WImH and ghost
  // are in-memory sessions, otherwise the active profile's own partition is used.
  const partition = !bootstrap
    ? ''
    : wimh?.active
      ? bootstrap.wimhPartition
      : ghost.active
        ? bootstrap.ghostPartition
        : profilePartition || bootstrap.profilePartition || bootstrap.partition

  /**
   * The partition one tab loads on.
   *
   * A private tab owns its own in-memory session, so it is the one case where the partition is a
   * property of the tab rather than of the window. Everything else follows the isolation the
   * window is in: defense, then ghost, then the active profile.
   */
  const partitionForTab = useCallback(
    (tab: PageTab | null | undefined): string =>
      tab?.private ? privateTabPartition(tab.id) : (tab?.partition ?? partition),
    [partition]
  )

  const capabilities = capabilitiesFor(mode)

  /**
   * Normal mode mounts one pane, so the active viewport can only be the desktop one.
   *
   * Without this, every reader of the active status - the address bar, the secure badge, the
   * bookmark star, the site panel - was looking at the status of a frame that is not mounted and
   * therefore saw an empty URL, even while a page was on screen.
   */
  useEffect(() => {
    if ((!capabilities.dualViewport || internalSurface) && activeView !== 'desktop') {
      setActiveView('desktop')
    }
  }, [activeView, capabilities.dualViewport, internalSurface])

  /**
   * Every path that could reveal the developer area goes through here.
   *
   * In normal mode it is a no-op, so no call site - toolbar, omnibox command, shortcut or a
   * future addition - can slide the sidebar out while the mode is normal.
  *
  * The dock is a different door: it only ever offers what the current mode allows (the list comes
  * from the shared table), so it needs no guard of its own - but this one stays exactly as it was
  * for the paths that open a panel by *name*, which is where a mode check actually belongs.
   */
  const openDeveloperArea = useCallback(
    (panel?: SidebarPanel): boolean => {
      if (isNormalMode(mode)) return false
      if (panel && !isPanelAvailable(mode, panel)) return false
      if (panel) setActivePanel(panel)
      setSidebarOpen(true)
      return true
    },
    [mode]
  )

  /**
   * The panel the dock shows, and whether it is open.
   *
   * Entering normal mode closes the panel and moves the selection to an everyday tool: leaving a
   * developer panel open behind a mode switch would be exactly the leak the mode exists to
   * prevent, and leaving the selection on a tool the mode does not offer would make the dock look
   * broken. The dock itself stays - it is the everyday half of the browser. Switching *back* to
   * dev mode changes only the highlighted panel when it is unavailable there; it never opens
   * the dock on the user's behalf - a panel opens only when the operator clicks a tool.
   */
  useEffect(() => {
    if (!isPanelAvailable(mode, activePanel)) {
      setActivePanel(isNormalMode(mode) ? 'bookmarks' : 'console')
      setSidebarOpen(false)
      return
    }
  }, [activePanel, mode])

  /** The toolbar toggle: closes what is open, otherwise asks to open it. */
  const toggleDeveloperArea = useCallback((): void => {
    if (isNormalMode(mode)) return
    if (sidebarOpen) setSidebarOpen(false)
    else openDeveloperArea()
  }, [mode, openDeveloperArea, sidebarOpen])

  /** Renderer -> main: bind a guest webContents id to its viewport. */
  const handleGuestAttached = useCallback(
    (viewId: ViewportId, guestId: number, guestPartition: string) => {
      window.devlens.registerGuest({ viewId, guestId, partition: guestPartition })
      const zoom = browserPreferencesRef.current.defaultZoom
      if (zoom !== 100) void window.devlens.pageZoomSet(guestId, zoom).catch(() => undefined)
    },
    []
  )

  /**
   * A right-click in a page.
   *
   * The inspection already happened in the guest, so the only thing left to find out is the
   * clipboard - and it is read *here*, before the menu is mounted, rather than inside it. That is
   * what keeps the "no greyed-out rows" rule honest: by the time the menu exists, every decision it
   * would make has been made.
   */
  const handleGuestContextMenu = useCallback(
    (tabId: string, viewId: ViewportId, payload: Omit<PageContextMenuPayload, 'viewId'>) => {
      const guestId = frames.current[tabId]?.[viewId]?.guestId() ?? null
      void window.devlens
        .clipboardRead()
        .catch(() => '')
        .then((clipboard) =>
          setPageMenu({ ...payload, viewId, clipboard, guestId })
        )
    },
    []
  )

  /** Runs one of the page's own commands in the frame the right-click came from. */
  const runPageCommand = useCallback(
    (command: PageCommandKind) => {
      const guestId = pageMenu?.guestId
      /* No guest id means the frame is gone: there is nothing to command, and the row that asked
         for it was built from a payload that arrived before that happened. */
      if (!guestId) return
      void window.devlens.pageCommand({ webContentsId: guestId, command }).catch(() => undefined)
    },
    [pageMenu?.guestId]
  )

  /** Files a viewport update under the tab that owns it, so tabs cannot overwrite each other. */
  const patchTabStatus = useCallback(
    (tabId: string, viewId: ViewportId, patch: Partial<ViewportStatus>) => {
      setStatuses((previous) => {
        const bucket = previous[tabId] ?? EMPTY_TAB_STATUSES
        const next = { ...bucket, [viewId]: { ...bucket[viewId], ...patch } }
        return { ...previous, [tabId]: next }
      })
      // Mark the tab as having a new notification when its title or URL changes
      // and it is not the currently active tab.
      if ((patch.title !== undefined || patch.url !== undefined) && tabId !== activeTabId) {
        setNotifiedTabIds((prev) => {
          if (prev.has(tabId)) return prev
          const next = new Set(prev)
          next.add(tabId)
          return next
        })
      }
    },
    [activeTabId]
  )

  /** The report and the status bar want the real viewport sizes, not the requested ones. */
  const handleMeasured = useCallback((viewId: ViewportId, size: { width: number; height: number }) => {
    setGuestSizes((previous) =>
      previous[viewId].width === size.width && previous[viewId].height === size.height
        ? previous
        : { ...previous, [viewId]: size }
    )
  }, [])

  const handleFindResult = useCallback(
    (result: FindResult) => {
      if (result.error) {
        setOmniboxHint(result.error)
        showStatus(result.error)
        return
      }
      const first = result.hits[0]
      const summary = first
        ? `${result.matches} match${result.matches === 1 ? '' : 'es'} - first: ${first.tag}${
            first.id ? `#${first.id}` : ''
          }${first.component ? ` (${first.component})` : ''}`
        : 'no matches'
      setOmniboxHint(summary)
      showStatus(`${result.selector}: ${summary} in ${result.viewId}`)
    },
    [showStatus]
  )

  /**
   * Scroll sync: each guest reports its ratio and applies the twin's. The shell stays a
   * pure relay, so a viewport that is not being scrolled is never touched.
   */
  const handleScroll = useCallback(
    (tabId: string, viewId: ViewportId, message: ScrollSyncMessage) => {
      if (!syncEnabled) return
      const twin: ViewportId = viewId === 'mobile' ? 'desktop' : 'mobile'
      // The twin of the *same* tab: syncing across tabs would drag a hidden page around.
      frames.current[tabId]?.[twin]?.applyScroll(message.ratio)
    },
    [syncEnabled]
  )

  /** Loads a URL in both viewports and remembers it for history and suggestions. */
  const navigate = useCallback(
    (url: string, title = '') => {
      url = enforceHttpsOnly(url, privacyPreferencesRef.current.httpsOnly)
      loadInActiveTab(url, title)
      setAddress(url)
      // A private tab is not remembered anywhere: not in this profile's history, not in its
      // suggestions, and not as the address ghost mode hands back when it ends.
      if (activeTab?.private) {
        window.devlens.historyAdd({ url, title, private: true, tabId: activeTab.id })
      } else {
        if (!ghost.active) standardUrl.current = url
        if (privacyPreferencesRef.current.historyPolicy !== 'never') {
          window.devlens.historyAdd({ url, title })
        }
      }
      void refreshHistory()
      setOmniboxHint(null)
    },
    [activeTab, ghost.active, loadInActiveTab, refreshHistory]
  )

  /** Alt+Enter and Alt-click: same flow, but the page lands in its own tab. */
  const openInNewTab = useCallback(
    (url: string, title = ''): void => {
      url = enforceHttpsOnly(url, privacyPreferencesRef.current.httpsOnly)
      // From a private tab this opens another private tab: staying at Level 3 is what the
      // operator asked for, and the alternative - a plain tab - would be a downgrade.
      if (activeTab?.private) {
        void openPrivateTab(url, title)
        setOmniboxHint(null)
        return
      }
      const activate = tabsPreferencesRef.current.switchToNewTabs
      openTab(url, title, { activate })
      if (activate) setAddress(url)
      if (!ghost.active) standardUrl.current = url
      if (
        !activeTab?.private &&
        privacyPreferencesRef.current.historyPolicy !== 'never'
      ) {
        window.devlens.historyAdd({ url, title })
      }
      void refreshHistory()
      setOmniboxHint(null)
    },
    [activeTab, ghost.active, openPrivateTab, openTab, refreshHistory]
  )

  /** Release notes stay in the shell; community links open in a separate web tab. */
  const openAboutRoute = useCallback((url: string): void => {
    const route = internalRouteOf(url)
    if (route) openInternalTab(route, url)
    else if (/^https:\/\//i.test(url)) openInNewTab(url)
  }, [openInternalTab, openInNewTab])

  /**
   * A page asked for a new tab.
   *
   * `target=_blank`, ctrl-click and middle-click all arrive here as a URL: main owns the guest's
   * `window.open` handler and the tab strip is this process's, so the request crosses once and
   * lands where a tab belongs. Auth popups do *not* come through here - they are real child windows
   * so their opener handshake survives - which is why this only ever sees a plain navigation.
   */
  useEffect(
    () =>
      window.devlens.onGuestOpenTab((request) => {
        /* A private tab keeps its own per-tab session; anything else opens on the partition the
           page was on, so the sub-system it links to sees the same cookies. */
        if (activeTab?.private) {
          void openPrivateTab(request.url)
          return
        }
        const settings = tabsPreferencesRef.current
        const activate = settings.switchToNewTabs
        openTab(request.url, '', {
          partition: request.partition,
          activate,
          ...(settings.externalLinksBesideCurrent && activeTabId
            ? { afterId: activeTabId }
            : {})
        })
        if (activate) setAddress(request.url)
        window.devlens.historyAdd({ url: request.url, title: '' })
      }),
    [activeTab?.private, activeTabId, openPrivateTab, openTab]
  )

  const reloadBoth = useCallback(() => {
    activeFrame('mobile')?.reload()
    activeFrame('desktop')?.reload()
  }, [activeFrame])
  useEffect(
    () => window.devlens.onReloadViewportsRequested(() => reloadBoth()),
    [reloadBoth]
  )

  /* ---------------- omnibox ---------------- */

  const sessionUrls = useMemo(() => {
    const seen = new Set<string>()
    const urls: string[] = []
    for (const request of interceptor.requests) {
      if (!request.url.startsWith('http')) continue
      const key = `${request.method} ${request.url}`
      if (seen.has(key)) continue
      seen.add(key)
      urls.push(request.url)
      if (urls.length >= 12) break
    }
    return urls
  }, [interceptor.requests])

  const suggestions: OmniboxSuggestion[] = useMemo(
    () =>
      buildSuggestions({
        query: address,
        history,
        bookmarks,
        // The `%` switcher reads the live tab strip, so it can only offer tabs that exist now.
        tabs: tabs.map((tab) => ({ id: tab.id, url: tab.url, title: tab.title })),
        sessionUrls,
        /**
         * The profile's own engine, not the config file's: `devlens:settings/search` is the
         * place the operator changes it, and the file it writes is per profile.
         */
        defaultEngine,
        entries: allOmniboxEntries,
        sources: omniboxSettings.sources,
        suggestFirst: omniboxSettings.suggestFirst,
        limit: 8
      }),
    [address, allOmniboxEntries, bookmarks, defaultEngine, history, omniboxSettings, sessionUrls, tabs]
  )

  /** Enters ghost mode, optionally navigating straight to a target. */
  const enterGhostSession = useCallback(
    async (target: string | null) => {
      // Extreme defense already isolates harder than ghost mode does.
      if (wimh?.active) {
        if (target) navigate(target)
        showStatus('already inside the extreme defense session')
        return wimh
      }
      const state = await window.devlens.ghostEnter()
      setGhost(state)
      if (!ghost.active) standardUrl.current = activeStatuses[activeView].url || startUrl || ''
      if (target) {
        loadInActiveTab(target)
        setAddress(target)
      }
      showStatus(
        target
          ? `ghost session: ${target}`
          : `ghost session active - in-memory storage, trackers blocked`
      )
      return state
    },
    [activeView, ghost.active, loadInActiveTab, navigate, showStatus, startUrl, statuses, wimh]
  )

  const leaveGhostSession = useCallback(async () => {
    const state = await window.devlens.ghostExit()
    setGhost(state)
    const restore = standardUrl.current || startUrl || ''
    if (restore) loadInActiveTab(restore)
    setAddress(restore)
    showStatus('ghost session closed, storage wiped')
  }, [loadInActiveTab, showStatus, startUrl])

  /* ---------------- extreme defense mode ---------------- */

  /**
   * Mode switching is main-process state; this only mirrors it and re-lays-out immediately.
   * No restart, no reload: normal mode drops the second viewport and the sidebar, dev mode
   * brings both back, and the main process flips capture/rules/AI at the same moment.
   */
  const changeMode = useCallback(
    async (next: WorkspaceMode) => {
      if (next === mode) return
      setModeBusy(true)
      try {
        const state = await window.devlens.modeSet(next)
        setMode(state.mode)
        if (state.mode === 'normal') {
          setActiveView('desktop')
          // Nothing developer-facing may remain, and the preference is forgotten so that
          // returning to dev mode is an explicit act rather than a surprise.
          setSidebarOpen(false)
          showStatus('normal mode - max privacy and immersion')
        } else {
          showStatus('dev mode - full tooling unlocked')
        }
      } finally {
        setModeBusy(false)
      }
    },
    [mode, showStatus]
  )

  /* ---------------- profiles ---------------- */

  const applyProfiles = useCallback((list: BrowserProfile[]) => {
    setProfiles(list)
    const active = list.find((profile) => profile.active)
    if (active) {
      setProfilePartition(active.partition)
      setProfileId(active.id)
    }
  }, [])

  /**
   * Swaps the whole tab set when the identity changes.
   *
   * Tabs opened as Personal must not appear as Work, so each profile's strip is filed under its
   * own key: the outgoing set is put away, the incoming one (or a single empty tab) is restored,
   * and every frame handle, status and ref from the previous identity is dropped.
   */
  useEffect(() => {
    if (!profileId || lastProfile.current === profileId) return
    const previous = lastProfile.current
    if (previous) tabSets.current[previous] = { tabs, activeId: activeTabId }
    lastProfile.current = profileId

    // The previous identity's views are gone with its tabs: forget everything about them.
    frames.current = {}
    frameRefs.current.clear()
    setStatuses({})
    const restored = tabSets.current[profileId]
    if (restored && restored.tabs.length > 0) {
      setTabs(restored.tabs)
      setActiveTabId(restored.activeId ?? restored.tabs[0].id)
      setAddress(restored.tabs.find((tab) => tab.id === restored.activeId)?.url ?? '')
      return
    }
    tabSeq.current += 1
    const fresh = `tab-${tabSeq.current}`
    setTabs([{ id: fresh, url: null, title: '', host: '', secure: false }])
    setActiveTabId(fresh)
    setAddress('')
  }, [activeTabId, profileId, tabs])

  const switchProfile = useCallback(
    async (id: string) => {
      setProfilesBusy(true)
      try {
        const list = await window.devlens.profilesSwitch(id)
        applyProfiles(list)
        const active = list.find((profile) => profile.active)
        showStatus(`profile: ${active?.name ?? id} - isolated cookies and storage`)
      } finally {
        setProfilesBusy(false)
      }
    },
    [applyProfiles, showStatus]
  )

  const createProfile = useCallback(
    async (name: string, avatar?: ProfileAvatar) => {
      setProfilesBusy(true)
      try {
        applyProfiles(await window.devlens.profilesCreate(avatar ? { name, avatar } : name))
        showStatus(`profile created: ${name}`)
      } finally {
        setProfilesBusy(false)
      }
    },
    [applyProfiles, showStatus]
  )

  /** The startup prompt's checkbox: identity settings, not a per-profile preference. */
  const setAskOnStartup = useCallback(async (ask: boolean) => {
    setProfileAsk(ask)
    try {
      const settings = await window.devlens.profilesSetAskOnStartup(ask)
      setProfileAsk(settings.askOnStartup)
    } catch {
      /* the prompt itself still works for this session */
    }
  }, [])

  /**
   * The site panel's per-site exemption.
   *
   * Exempting a site pauses cancellation for *that host* only, for this session; the level, the
   * header policy and the RAM-only session are untouched, and nothing is written to disk.
   */
  const toggleSiteProtection = useCallback(
    async (exempt: boolean) => {
      const url = activeStatuses[activeView].url
      if (!url || url === 'about:blank') return
      try {
        const state = await window.devlens.protectionSetSiteAllowed(url, exempt)
        setProtection(state)
        savePrivacyPreferences({ siteExceptions: state.allowedSites })
        showStatus(
          exempt
            ? `protection paused for this site - ${hostOf(url)}`
            : `protection resumed for ${hostOf(url)}`
        )
      } catch {
        showStatus('could not change site protection')
      }
    },
    [activeStatuses, activeView, savePrivacyPreferences, showStatus]
  )

  /** Clears cookies and storage for the page on screen, and nothing else. */
  const clearCurrentSiteData = useCallback(async () => {
    const url = activeStatuses[activeView].url
    if (!url || url === 'about:blank') return
    try {
      // "Forget this site" clears the origin in the session the page is actually on; a private
      // tab's cookies live in its own partition, not in the profile's.
      const result = await window.devlens.sessionClearSite(
        url,
        activeTab?.private ? partitionForTab(activeTab) : undefined
      )
      showStatus(
        result.ok
          ? `cleared ${result.cleared.join(' and ')} for ${result.origin}`
          : result.error ?? 'nothing to clear'
      )
    } catch {
      showStatus('could not clear this site')
    }
  }, [activeStatuses, activeTab, activeView, partitionForTab, showStatus])

  const deleteProfile = useCallback(
    async (id: string) => {
      setProfilesBusy(true)
      try {
        applyProfiles(await window.devlens.profilesDelete(id))
        showStatus('profile deleted and its storage wiped')
      } finally {
        setProfilesBusy(false)
      }
    },
    [applyProfiles, showStatus]
  )

  /**
   * WImH switches both viewports onto its own RAM-only partition, so enabling it also ends
   * a plain ghost session - there is no point running the weaker isolation underneath.
   */
  const toggleWimh = useCallback(
    async (enabled: boolean) => {
      setWimhBusy(true)
      try {
        if (enabled && ghost.active) await window.devlens.ghostExit()
        const next = await window.devlens.wimhSetEnabled(enabled)
        setWimh(next)
        setGhost(await window.devlens.ghostState())
        showStatus(
          enabled
            ? 'extreme defense on - RAM-only session, clipboard watched, capture excluded'
            : 'extreme defense off - session storage, cache and scratch memory wiped'
        )
      } finally {
        setWimhBusy(false)
      }
    },
    [ghost.active, showStatus]
  )

  const setClipboardTtl = useCallback(
    async (ms: number) => {
      setWimh(await window.devlens.wimhSetClipboardTtl(ms))
      showStatus(`clipboard purge set to ${Math.round(ms / 1000)}s`)
    },
    [showStatus]
  )

  const scrubNow = useCallback(async () => {
    setWimh(await window.devlens.wimhScrub())
  }, [])

  /* ---------------- dashboard data ---------------- */

  const scanServers = useCallback(async () => {
    setScanning(true)
    try {
      const scan = await window.devlens.scanLocalServers()
      setServers(scan.servers)
    } finally {
      setScanning(false)
    }
  }, [])

  const addWorkspacePath = useCallback(
    async (path: string) => {
      const next = await window.devlens.workspacesAdd(path)
      setWorkspaces(next)
      const found = next.find((entry) => entry.path === path || entry.name === path)
      showStatus(found ? `workspace added: ${found.name}` : `workspace added: ${path}`)
    },
    [showStatus]
  )

  const activateWorkspace = useCallback(
    async (path: string) => {
      const next = await window.devlens.workspacesSetActive(path)
      setWorkspaces(next)
      const active = next.find((entry) => entry.active)
      showStatus(`click-to-source now resolves in ${active?.name ?? path}`)
    },
    [showStatus]
  )

  const removeWorkspace = useCallback(async (path: string) => {
    setWorkspaces(await window.devlens.workspacesRemove(path))
  }, [])

  const openWorkspaceInIde = useCallback(
    async (path: string) => {
      const result = await window.devlens.openInIde({ filePath: path })
      showStatus(result.ok ? `editor -> ${result.resolvedPath}` : result.error ?? 'could not open the workspace')
    },
    [showStatus]
  )

  const insertPrefix = useCallback((text: string) => {
    setAddress(text)
  }, [])

  /* ---------------- cookies and site storage ---------------- */

  /**
   * What the inspector reads.
   *
   * Two sources, because they are two things: cookies belong to the session, so the main process
   * reads them for the partition the page is actually on, while localStorage and sessionStorage
   * belong to the document, so the guest reads its own. The values are truncated on the way in -
   * an inspector is for looking at names and shapes, and a 4 KB token in a list row helps nobody.
   */
  const refreshStorage = useCallback(async () => {
    const url = activeStatuses[activeView].url
    if (!url || !/^https?:/i.test(url)) {
      setCookies([])
      setStorageAreas([])
      setStorageError(null)
      return
    }
    setStorageBusy(true)
    setStorageError(null)
    const partition = partitionForTab(activeTab)

    const readStorage = async (): Promise<StorageArea[]> => {
      const frame = activeFrame(activeView)
      if (!frame) return []
      try {
        const result = (await frame.evaluate(`(() => {
          const dump = (store) => {
            const out = []
            for (let index = 0; index < store.length; index += 1) {
              const key = store.key(index)
              if (key === null) continue
              out.push({ key, value: String(store.getItem(key) ?? '').slice(0, 300) })
            }
            return out
          }
          return { local: dump(window.localStorage), session: dump(window.sessionStorage) }
        })()`)) as { local?: StorageArea['entries']; session?: StorageArea['entries'] } | null
        return [
          { id: 'local', entries: result?.local ?? [] },
          { id: 'session', entries: result?.session ?? [] }
        ]
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : String(error))
        return []
      }
    }

    try {
      const [cookieList, areas] = await Promise.all([
        window.devlens.cookiesList({ url, partition }),
        readStorage()
      ])
      setCookies(cookieList)
      setStorageAreas(areas)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : String(error))
    } finally {
      setStorageBusy(false)
    }
  }, [activeFrame, activeStatuses, activeTab, activeView, partitionForTab])

  const removeCookie = useCallback(
    async (name: string) => {
      const url = activeStatuses[activeView].url
      if (!url) return
      await window.devlens.cookiesRemove({ url, name, partition: partitionForTab(activeTab) })
      showStatus(`cookie ${name} deleted`)
      await refreshStorage()
    },
    [activeStatuses, activeTab, activeView, partitionForTab, refreshStorage, showStatus]
  )

  const removeStorageEntry = useCallback(
    async (area: StorageArea['id'], key: string) => {
      const store = area === 'local' ? 'localStorage' : 'sessionStorage'
      await activeFrame(activeView)?.evaluate(
        `window.${store}.removeItem(${JSON.stringify(key)}), 'ok'`
      )
      showStatus(`${store}.${key} deleted`)
      await refreshStorage()
    },
    [activeFrame, activeView, refreshStorage, showStatus]
  )

  const clearSiteStorage = useCallback(async () => {
    const url = activeStatuses[activeView].url
    if (!url) return
    const result = await window.devlens.sessionClearSite(url, partitionForTab(activeTab))
    showStatus(
      result.ok ? `cleared ${result.cleared.join(' and ')} for ${result.origin}` : result.error ?? 'nothing to clear'
    )
    await refreshStorage()
  }, [activeStatuses, activeTab, activeView, partitionForTab, refreshStorage, showStatus])

  /**
   * The inspector follows the page.
   *
   * Opening the panel reads the origin in front, and navigating while it is open reads the new
   * one - a storage panel still listing the previous site's cookies would be worse than empty.
   */
  useEffect(() => {
    if (activePanel !== 'storage' || !sidebarOpen) return
    void refreshStorage()
  }, [activePanel, refreshStorage, sidebarOpen, activeStatuses, activeView])

  const openSandbox = useCallback(
    async (url: string) => {
      const result = await window.devlens.openSandbox(url)
      showStatus(
        result.ok
          ? `sandbox window opened for ${url}`
          : `sandbox refused: ${result.error ?? 'unknown error'}`
      )
    },
    [showStatus]
  )

  /**
   * `:clear-cache`.
   *
   * A private tab clears *its own* session - that is the only one whose cookies the operator
   * was looking at - while everything else clears the window's session as before.
   */
  const clearSessionData = useCallback(async () => {
    const result = await window.devlens.sessionClearData(
      activeTab?.private ? 'private' : ghost.active ? 'ghost' : 'standard',
      activeTab?.private ? partitionForTab(activeTab) : undefined
    )
    showStatus(result.ok ? `cleared ${result.cleared.join(', ')}` : 'could not clear session data')
  }, [activeTab, ghost.active, partitionForTab, showStatus])

  const refreshDiskUsage = useCallback((): void => {
    void window.devlens.privacyDiskUsage().then(setDiskUsage)
  }, [])

  const clearBrowsingDataSelected = useCallback(
    async (request: ClearBrowsingDataRequest): Promise<ClearBrowsingDataResult> => {
      const result = await window.devlens.privacyClearBrowsingData(request)
      if (result.ok) {
        if (request.history) setHistory([])
        refreshDiskUsage()
        showStatus(`cleared ${result.cleared.join(', ') || 'no browsing data'}`)
      }
      return result
    },
    [refreshDiskUsage, showStatus]
  )

  const runRetentionCleanup = useCallback((): void => {
    void window.devlens.privacyRunRetentionCleanup().then(() => {
      void refreshHistory()
      refreshDiskUsage()
    })
  }, [refreshDiskUsage, refreshHistory])

  const updateShieldRules = useCallback(
    (
      patch: Pick<
        PrivacyPreferences,
        'blockCrossSiteTrackers' | 'blockFingerprinters' | 'blockCryptominers' | 'sendDnt'
      >
    ): void => {
      savePrivacyPreferences(patch)
      void window.devlens.protectionSetShieldRules({
        crossSiteTrackers: patch.blockCrossSiteTrackers,
        fingerprinters: patch.blockFingerprinters,
        cryptominers: patch.blockCryptominers,
        sendDnt: patch.sendDnt
      })
    },
    [savePrivacyPreferences]
  )

  const updateNetworkSecurity = useCallback(
    (patch: Pick<PrivacyPreferences, 'dnsMode' | 'httpsOnly'>): void => {
      savePrivacyPreferences(patch)
      void window.devlens.privacyApplyNetwork({ dnsMode: patch.dnsMode })
    },
    [savePrivacyPreferences]
  )

  const updateHistoryPolicy = useCallback(
    (policy: HistoryPolicy): void => {
      savePrivacyPreferences({ historyPolicy: policy })
      if (policy === 'never') {
        void window.devlens.historyClear().then(() => setHistory([]))
        return
      }
      runRetentionCleanup()
    },
    [runRetentionCleanup, savePrivacyPreferences]
  )

  const runFind = useCallback(
    (selector: string) => {
      if (selector.trim()) {
        const target = designTarget === 'both' ? (['mobile', 'desktop'] as ViewportId[]) : [activeView]
        for (const viewId of target) activeFrame(viewId)?.find(selector)
        setOmniboxHint(`searching ${selector}...`)
      } else {
        for (const viewId of ['mobile', 'desktop'] as ViewportId[]) activeFrame(viewId)?.find('')
        setOmniboxHint(null)
      }
    },
    [activeFrame, activeView, designTarget]
  )

  /** Start or continue Chromium's native finder in the page that owns focus. */
  const searchInPage = useCallback(
    (
      text: string,
      options?: { forward?: boolean; findNext?: boolean; webContentsId?: number }
    ): void => {
      const frame = activeFrame(activeView)
      const guestId = options?.webContentsId ?? findTargetId ?? frame?.guestId()
      if (!frame || !guestId) return
      setFindTargetId(guestId)
      frame.findText(text, {
        forward: options?.forward !== false,
        findNext: options?.findNext === true
      })
    },
    [activeFrame, activeView, findTargetId]
  )

  /** Open the bar, remember the target page, and focus/select the query again. */
  const openFindBar = useCallback(
    (knownGuestId?: number): void => {
      const frame = activeFrame(activeView)
      const guestId = knownGuestId ?? frame?.guestId() ?? null
      setFindTargetId(guestId)
      setFindOpen(true)
      setFindFocusSignal((value) => value + 1)
      if (guestId && frame && findQuery.trim()) {
        frame.findText(findQuery, { forward: true, findNext: false })
      }
    },
    [activeFrame, activeView, findQuery]
  )

  const closeFindBar = useCallback((): void => {
    setFindOpen(false)
    setFindResult(null)
    for (const viewId of ['mobile', 'desktop'] as ViewportId[]) {
      activeFrame(viewId)?.clearFindText()
    }
  }, [activeFrame])

  const changeFindQuery = useCallback(
    (value: string): void => {
      setFindQuery(value)
      setFindResult(null)
      if (!value.trim()) {
        for (const viewId of ['mobile', 'desktop'] as ViewportId[]) {
          activeFrame(viewId)?.clearFindText()
        }
        return
      }
      searchInPage(value)
    },
    [activeFrame, searchInPage]
  )

  const findNextMatch = useCallback(
    (forward: boolean): void => {
      if (!findQuery.trim()) return
      searchInPage(findQuery, { forward, findNext: true })
    },
    [findQuery, searchInPage]
  )

  /** The bar belongs to the page that opened it; changing tabs or leaving the web surface closes it. */
  useEffect(() => {
    closeFindBar()
  }, [activeTabId, closeFindBar, internalSurface])

  /** Native finder updates arrive on the frame's own `<webview>` element. */
  const handlePageFindResult = useCallback((result: FindInPageResult): void => {
    setFindResult(result)
  }, [])

  /** Escape belongs to the Find Bar while it is open, before any child can consume it. */
  useEffect(() => {
    if (!findOpen) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      closeFindBar()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeFindBar, findOpen])

  /** A page-owned Ctrl/Cmd+F is reported by main because the shell never sees that keydown. */
  useEffect(
    () =>
      window.devlens.onFindInPageRequested((request) => openFindBar(request.webContentsId)),
    [openFindBar]
  )

  /** The shell's own pages never focus a guest, so their wheel events arrive here. */
  useEffect(() => {
    const onWheel = (event: WheelEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || !event.deltaY) return
      const guestId = activeFrame(activeView)?.guestId()
      if (!guestId) return
      event.preventDefault()
      const step = Math.max(-0.5, Math.min(0.5, -event.deltaY * 0.002))
      if (step) void window.devlens.pageZoomBy(guestId, step).catch(() => undefined)
    }
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onWheel, true)
  }, [activeFrame, activeView])

  /** Zoom a guest from its own forwarded wheel gesture, keeping each step bounded. */
  const zoomFromGuestWheel = useCallback((guestId: number, deltaY: number): void => {
    const step = Math.max(-0.5, Math.min(0.5, -deltaY * 0.002))
    if (step) void window.devlens.pageZoomBy(guestId, step).catch(() => undefined)
  }, [])

  /** Apply a changed default only when the preference changes, not on every tab switch. */
  const appliedDefaultZoom = useRef(browserPreferences.defaultZoom)
  useEffect(() => {
    if (appliedDefaultZoom.current === browserPreferences.defaultZoom) return
    appliedDefaultZoom.current = browserPreferences.defaultZoom
    const guestId = activeFrame(activeView)?.guestId()
    if (guestId) {
      void window.devlens
        .pageZoomSet(guestId, browserPreferences.defaultZoom)
        .catch(() => undefined)
    }
  }, [activeFrame, activeView, browserPreferences.defaultZoom])

  /** Keyboard shortcuts for the dashboard, matching browser muscle memory. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault()
        // A real new tab, not an overlay: whatever is on screen keeps running and keeps its
        // address. The new tab starts on the dashboard until something opens in it.
        openTab(null)
        return
      }

      /** Refresh the active page, never the DevLens shell or its profile gate. */
      if (
        event.key === 'F5' ||
        ((event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === 'r')
      ) {
        event.preventDefault()
        reloadBoth()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && tabs.length > 1) {
        event.preventDefault()
        const forward = !event.shiftKey
        const mruTarget = tabsPreferencesRef.current.mruSwitching
          ? tabMru.current.find(
              (id) => id !== activeTabId && tabs.some((tab) => tab.id === id)
            )
          : undefined
        if (mruTarget) {
          selectTab(mruTarget)
          return
        }
        const index = Math.max(
          0,
          tabs.findIndex((tab) => tab.id === activeTabId)
        )
        const next =
          tabs[(index + (forward ? 1 : -1) + tabs.length) % tabs.length]
        if (next) selectTab(next.id)
        return
      }

      /** Ctrl/Cmd+F opens the same find bar in both modes and on every shell page. */
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault()
        openFindBar()
        return
      }

      /**
       * Ctrl/Cmd+Shift+P: a maximum-protection private tab.
       *
       * It is handled here, above the developer-shortcut table, and it deliberately works in
       * both modes: this is a privacy feature the operator asks for, not a developer tool, and
       * "be normal when you need" should not mean "lose your protection in normal mode".
       */
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'p'
      ) {
        event.preventDefault()
        void openPrivateTab()
        return
      }

      /**
       * Ctrl/Cmd+W closes the *tab*, not the window.
       *
       * The application menu used to own that accelerator through its Window role, which closed
       * the whole browser as soon as it was pressed. Closing the window is only right when the
       * last tab goes, which is what every browser does.
       */
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'w'
      ) {
        event.preventDefault()
        if (tabs.length > 1 && activeTabId) closeTab(activeTabId)
        else void window.devlens.windowClose()
        return
      }

      /**
       * In normal mode every developer combination is ignored outright - the mode switch
       * included, so a single keypress can never reveal the developer area. The toolbar's mode
       * segment is the way back, which is visible and deliberate.
       */
      if (isDeveloperShortcut(event)) {
        if (isNormalMode(mode)) return

        if (event.key.toLowerCase() === 'd') {
          event.preventDefault()
          void changeMode('normal')
          return
        }

        const panelByKey: Record<string, SidebarPanel> = {
          c: 'console',
          i: 'interceptor',
          r: 'recon',
          a: 'ai'
        }
        const panel = panelByKey[event.key.toLowerCase()]
        if (panel) {
          event.preventDefault()
          openDeveloperArea(panel)
          return
        }
      }

      /**
       * The defense overlay is the deliberate exception: privacy stays one keypress away in
       * both modes, while every combination that could reveal the *monitoring* workspace is
       * still ignored in normal mode above.
       */
      if (isDefenseShortcut(event)) {
        event.preventDefault()
        setDefenseOpen((open) => !open)
        return
      }

      // Escape dismisses the topmost on-demand surface, unless the omnibox owns the key.
      if (event.key === 'Escape' && findOpen && !addressFocused.current) {
        event.preventDefault()
        closeFindBar()
        return
      }
      if (event.key === 'Escape' && defenseOpen && !addressFocused.current) {
        event.preventDefault()
        setDefenseOpen(false)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeTabId,
    changeMode,
    closeTab,
    closeFindBar,
    defenseOpen,
    findOpen,
    mode,
    openDeveloperArea,
    openFindBar,
    openPrivateTab,
    openTab,
    reloadBoth,
    selectTab,
    tabs
  ])

  /**
   * Single entry point for everything the omnibox can do. The parser decides *what* was
   * asked for; this decides how the shell carries it out.
   */
  const runOmniboxAction = useCallback(
    (action: OmniboxAction, raw: string, options?: { newTab?: boolean }) => {
      switch (action.kind) {
        case 'navigate':
        case 'search':
        case 'hub-search':
        /* A row the operator added builds its own URL, so it navigates exactly like the rest. */
        case 'entry':
          setAddress(action.url)
          if (options?.newTab) openInNewTab(action.url, action.kind === 'navigate' ? '' : raw.trim())
          else navigate(action.url, action.kind === 'navigate' ? '' : raw.trim())
          return
        case 'internal':
          openInternalTab(action.route, action.url)
          showStatus(action.label)
          return
        case 'ghost': {
          if (!action.url) {
            void (ghost.active ? leaveGhostSession() : enterGhostSession(null))
            return
          }
          void enterGhostSession(action.url)
          return
        }
        case 'panel':
          // Monitoring and authoring panels belong to the developer workspace.
          if (!isPanelAvailable(mode, action.panel)) {
            // Security on demand: normal mode still reaches the defense overlay, which is
            // privacy rather than monitoring. The recon panel itself stays a dev tool.
            if (action.panel === 'recon' || action.panel === 'defense') {
              setDefenseOpen(true)
              showStatus('WImH defense overlay - the recon panel itself needs dev mode')
              return
            }
            showStatus(`${PANEL_COMMAND_NAMES[action.panel] ?? action.panel} needs dev mode`)
            return
          }
          openDeveloperArea(PANEL_FOR_COMMAND[action.panel])
          showStatus(action.label)
          return
        case 'find':
          runFind(action.selector)
          return
        case 'tab': {
          /**
           * `%` switches, it never opens. The row the operator picked carries its tab id; when
           * they pressed Enter on the raw text instead, the best match is resolved here so the
           * behaviour is the same either way - and an existing tab is focused rather than a
           * second copy of the page being opened.
           */
          const open = tabs.map((tab) => ({ id: tab.id, url: tab.url, title: tab.title }))
          const best = rankOpenTabs(action.query, open, 1)[0]
          const bestId = best && best.action.kind === 'tab' ? best.action.tabId : null
          const targetId = action.tabId ?? bestId
          const target = targetId ? tabs.find((tab) => tab.id === targetId) : undefined
          if (!target) {
            showStatus(action.query ? `no open tab matches "${action.query}"` : 'no other tab is open')
            return
          }
          selectTab(target.id)
          setAddress(target.url ?? '')
          showStatus(`switched to ${target.title || target.url || 'the new tab page'}`)
          return
        }
        case 'command':
          if (action.command === 'profile') {
            // `:profile` / `:user`: the identity screen, on demand, without a restart.
            setGateOpen(true)
            showStatus('who is using DevLens?')
            return
          }
          if (action.command === 'wimh') {
            // Works in both modes on purpose: defense is the promise that never locks.
            setDefenseOpen((open) => !open)
            showStatus('WImH overlay - observation only runs while it is open')
            return
          }
          if (action.command === 'port' && action.url) {
            setAddress(action.url)
            navigate(action.url)
            return
          }
          if (action.command === 'clear-cache') {
            void clearSessionData()
            return
          }
          void openSandbox(activeStatuses[activeView].url || action.url || address)
          return
        case 'insert':
          setAddress(action.text)
          return
      }
    },
    [
      address,
      activeView,
      clearSessionData,
      enterGhostSession,
      ghost.active,
      leaveGhostSession,
      navigate,
      openSandbox,
      openDeveloperArea,
      openInternalTab,
      openInNewTab,
      runFind,
      showStatus,
      activeStatuses,
      mode
    ]
  )

  /* ---------------- design overrides ---------------- */

  const applyCss = useCallback(() => {
    setCssApplied(cssDraft)
    setCssAppliedAt(Date.now())
    setDesignStatus(cssDraft.trim() ? 'applied to the live viewports' : 'overrides cleared')
  }, [cssDraft])

  const clearDesign = useCallback(() => {
    setCssDraft('')
    setCssApplied('')
    setCssAppliedAt(Date.now())
    setDesignStatus('overrides cleared')
  }, [])

  const toggleDesignMode = useCallback(
    (enabled: boolean) => {
      setDesignMode(enabled)
      setDesignStatus(enabled ? 'design mode on' : 'design mode off')
    },
    []
  )

  /* ---------------- derived data ---------------- */

  const viewportSummary = useMemo(
    () =>
      (['mobile', 'desktop'] as ViewportId[]).map((viewId) => ({
        viewId,
        width: guestSizes[viewId].width,
        height: guestSizes[viewId].height,
        url: activeStatuses[viewId].url
      })),
    [activeStatuses, guestSizes]
  )

  const reconSnapshot: ReconSnapshot = useMemo(
    () =>
      buildReconSnapshot({
        targetUrl: activeStatuses[activeView].url || bootstrap?.homeUrl || '',
        requests: interceptor.requests,
        consoleEntries: entries.filter((entry) => entry.kind === 'console'),
        failedRequests: entries.filter((entry) => entry.kind === 'network'),
        rules: interceptor.rules,
        viewports: viewportSummary,
        design: { designMode, css: cssApplied }
      }),
    [
      activeStatuses,
      activeView,
      bootstrap,
      interceptor.requests,
      interceptor.rules,
      entries,
      viewportSummary,
      designMode,
      cssApplied
    ]
  )

  const aiChips: AiContextChip[] = useMemo(
    () =>
      buildAiChips({
        snapshot: reconSnapshot,
        consoleEntries: entries.filter((entry) => entry.kind === 'console'),
        failedRequests: entries.filter((entry) => entry.kind === 'network'),
        css: cssApplied,
        designMode
      }),
    [reconSnapshot, entries, cssApplied, designMode]
  )

  if (!bootstrap) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {bootError ? (
          <>
            <p className="text-[12px] text-rose-300">DevLens could not start.</p>
            <p className="max-w-md text-center font-mono text-[11px] text-neutral-500">{bootError}</p>
          </>
        ) : (
          <>
            <Loader2 size={18} className="animate-spin text-teal-300" />
            <p className="text-[12px] text-neutral-500">Starting DevLens</p>
          </>
        )}
      </div>
    )
  }

  /**
   * The identity screen stands between the boot payload and the browser shell: nothing is
   * loaded, and no tab is created, until somebody says who is using DevLens.
   */
  if (gateOpen) {
    return (
      <ProfileGate
        profiles={profiles}
        busy={profilesBusy}
        askOnStartup={profileAsk}
        onSelect={(id) => {
          setGateOpen(false)
          void switchProfile(id)
        }}
        onCreate={(name, avatar) => void createProfile(name, avatar)}
        onAskOnStartupChange={(ask) => void setAskOnStartup(ask)}
      />
    )
  }

  const activeStatus = activeStatuses[activeView]
  /**
   * The emulated device.
   *
   * `resolveDevice` folds three sources into one profile - the matrix, a saved preset, and the
   * free-size entry - and `deviceViewport` turns its resolution and DPR into the CSS size the page
   * is actually laid out in. The frame never sees a device id, only the numbers, which is what
   * keeps "a preset" and "a typewriter's custom size" the same thing below this line.
   */
  const device = resolveDevice(mobileSettings)
  const viewport = deviceViewport(device, mobileSettings.fold[device.id])
  const deviceSize = { width: viewport.width, height: viewport.height }
  /**
   * The mobile frame is a real 375x812 viewport scaled down to fit, so the CSS viewport the
   * page sees never changes. The scale comes from the canvas box - which does not depend on
   * the frames - because measuring the frame itself would shrink it on every pass.
   */
  const availableHeight =
    canvasSize.height - CANVAS_PADDING_PX * 2 - FRAME_HEADER_PX - FRAME_INSET_PX
  const availableWidth = canvasSize.width - CANVAS_PADDING_PX * 2 - FRAME_GAP_PX - DESKTOP_MIN_WIDTH_PX
  const deviceScale = canvasSize.width
    ? Math.max(
        MIN_DEVICE_SCALE,
        Number(Math.min(availableWidth / deviceSize.width, availableHeight / deviceSize.height, 1).toFixed(3))
      )
    : 1

  const networkEntries = entries.filter((entry) => entry.kind === 'network')
  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.active)?.name ?? bootstrap.workspaceRoot

  // Bookmarks drop fragments so the star matches the page even after an in-page anchor jump.
  const bookmarkKey = activeStatus.url.replace(/#.*$/, '')
  const bookmarked = bookmarks.some((entry) => entry.url.replace(/#.*$/, '') === bookmarkKey)
  /**
   * Only a real page can be bookmarked: the dashboard, `about:blank` and internal pages are not
   * addresses, so the star stays out of the toolbar until there is something to save.
   */
  const canBookmark = /^(https?|file):/i.test(activeStatus.url)

  const sessionChip = ghost.active ? (
    <button
      type="button"
      onClick={() => void leaveGhostSession()}
      title={`Ghost session active - ${ghost.blockedRequests} tracker request(s) blocked. Click to exit.`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-400/50 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-100 transition-colors hover:bg-violet-500/25"
    >
      ghost
      <span className="text-violet-200/80">{ghost.blockedRequests}</span>
    </button>
  ) : wimh?.active ? (
    <button
      type="button"
      onClick={() => void toggleWimh(false)}
      title={`Extreme defense active - ${wimh.clipboard.purgedSecrets} clipboard purge(s), ${wimh.ramOnly.cookiesDowngraded} cookie(s) downgraded. Click to wipe and exit.`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-400/50 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-100 transition-colors hover:bg-violet-500/25"
    >
      wimh
      <ShieldCheck size={10} />
    </button>
  ) : null

  /* ---------------- maximum-protection private tab ---------------- */

  const activeIsPrivate = Boolean(activeTab?.private)
  /** Main's own record for the focused tab, so the pill reports what the session did. */
  const activePrivate = activeIsPrivate
    ? privateTabs.find((entry) => entry.tabId === activeTab?.id) ?? null
    : null
  /**
   * The badge mirrors the tab while a private tab is focused.
   *
   * Level 3 is what that tab enforces on itself, so showing the window's dial here would put a
   * level on screen that has nothing to do with the page in front of the operator.
   */
  const effectiveProtection = privateProtectionView(protection, activePrivate)
  const privatePill = activeIsPrivate ? (
    <span
      data-testid="private-tab-pill"
      data-level="extreme"
      title={`${PRIVATE_TAB_SUMMARY} Open one with ${PRIVATE_TAB_SHORTCUT_LABEL}.`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--devlens-stealth-line)] bg-[var(--devlens-stealth-soft)] px-1.5 py-0.5 font-mono text-[10px] text-ink-100"
    >
      <VenetianMask size={10} className="shrink-0 text-[var(--devlens-stealth)]" />
      {PRIVATE_TAB_LABEL}
      {activePrivate && (
        <span className="text-ink-400">
          {activePrivate.blockedRequests}/{activePrivate.historyBlocked}
        </span>
      )}
    </span>
  ) : null

  /**
   * Star in the toolbar.
   *
   * With the editor switched on it opens the add-bookmark panel for the page on screen; with it
   * switched off it saves straight away to wherever the last bookmark went, which is what the
   * checkbox in that panel promises.
   */
  const openBookmarkEditor = (): void => {
    if (!canBookmark) return
    if (!showBookmarkEditor) {
      void saveBookmarkEntry({
        url: activeStatus.url,
        title: activeStatus.title,
        location: bookmarkLocation
      })
      return
    }
    setBookmarkEditor({ url: activeStatus.url, title: activeStatus.title || activeStatus.url })
  }

  /** Writes the editor's answer to the store and reports what happened. */
  const saveBookmarkEntry = async (values: {
    url: string
    title: string
    location: string
  }): Promise<void> => {
    try {
      applyBookmarkSnapshot(await window.devlens.bookmarksSave(values))
      // Remember a *root* as the star's default; a folder id is specific to the page just saved.
      if (isRootLocation(values.location)) setBookmarkLocation(values.location)
      showStatus(
        values.location === 'toolbar' || folderNameOf(values.location)
          ? `saved to the bookmarks toolbar: ${values.title}`
          : `bookmarked to ${values.location}: ${values.title}`
      )
    } catch {
      showStatus('could not save the bookmark')
    }
  }

  const removeBookmarkEntry = async (url: string): Promise<void> => {
    try {
      applyBookmarkSnapshot(await window.devlens.bookmarksRemove(url))
      showStatus('bookmark removed')
    } catch {
      showStatus('could not remove the bookmark')
    }
  }

  /* ---------------- the bookmarks bar ---------------- */

  /**
   * The bar's own actions.
   *
   * Plain functions rather than hooks, for the reason spelled out above the tab helpers: they
   * are declared after the identity gate's early return, and a hook here would change how many
   * run the moment the gate closes.
   */

  /** Everywhere a page or a folder can be filed: the three roots, then the folders on the bar. */
  const folderChoices: FolderChoice[] = folderChoicesFrom(barTree)

  const folderNameOf = (id: string): string | null => {
    if (isRootLocation(id)) return null
    return findFolderName(barTree, id)
  }

  /** A mutation that answers with a snapshot, applied with one status line. */
  const applyAndSay = (next: Promise<BookmarkSnapshot>, message: string): void => {
    void next
      .then((snapshot) => {
        applyBookmarkSnapshot(snapshot)
        showStatus(message)
      })
      .catch(() => showStatus('the bookmark store refused that change'))
  }

  /**
   * Opens every address a node holds in its own tab.
   *
   * Capped, because a folder is a list of addresses and a stray drag should not be able to open
   * two hundred tabs; when the cap bites, the status line says so rather than pretending.
   */
  const openAllBookmarkUrls = (urls: string[], label: string): void => {
    const unique = [...new Set(urls.filter(Boolean))]
    if (unique.length === 0) {
      showStatus(`nothing to open in ${label}`)
      return
    }
    const limit = 30
    const opened = unique.slice(0, limit)
    for (const url of opened) openTab(url)
    showStatus(
      opened.length < unique.length
        ? `opened ${opened.length} of ${unique.length} from ${label}`
        : `opened ${opened.length} tab${opened.length === 1 ? '' : 's'} from ${label}`
    )
  }

  const runClipboard = (action: 'cut' | 'copy' | 'paste', id: string | undefined, location: string): void => {
    void window.devlens
      .bookmarksClipboard({ action, id, location })
      .then((result) => {
        applyBookmarkSnapshot(result.snapshot)
        /* Mirror of the bar's clipboard, so the menu can decide whether Paste belongs in the tree
           before it draws: cut and copy put a node on it, paste takes one off. */
        setBookmarkClipboard(action !== 'paste')
        showStatus(result.message)
      })
      .catch(() => showStatus('the bookmark clipboard refused that'))
  }

  const saveFolderDialog = (values: { title: string; location: string }): void => {
    const dialog = folderDialog
    setFolderDialog(null)
    if (!dialog) return
    if (dialog.folder) {
      applyAndSay(
        window.devlens.bookmarksRenameNode({ id: dialog.folder.id, title: values.title }),
        `folder renamed to ${values.title}`
      )
      return
    }
    applyAndSay(
      window.devlens.bookmarksCreateFolder({ title: values.title, location: values.location }),
      `folder created: ${values.title}`
    )
  }

  /**
   * Everything the bar's menus ask for.
   *
   * One switch, so a menu row name and the thing it does cannot drift apart: the union on the
   * menu side is the same list of names, and a missing case is a TypeScript error rather than a
   * button that quietly does nothing.
   */
  const runBookmarkAction = (action: BookmarkMenuAction, target: BookmarkMenuTarget): void => {
    const node = target.node
    const url = node?.url ?? ''
    const title = node?.title ?? ''
    /** New nodes from a folder's menu land inside it; from a link's menu, on the bar. */
    const container = target.kind === 'folder' && node ? node.id : 'toolbar'

    switch (action) {
      case 'open-new-tab':
        if (url) openInNewTab(url, title)
        return
      case 'container-standard':
        if (url) openInNewTab(url, title)
        return
      case 'container-ghost':
        if (url) void enterGhostSession(url)
        return
      case 'container-wimh':
        if (url) void toggleWimh(true).then(() => navigate(url, title))
        return
      case 'open-window':
      case 'open-private-window':
        if (!url) return
        void window.devlens
          .bookmarksOpenWindow({ url, private: action === 'open-private-window' })
          .then((result) =>
            showStatus(
              result.ok
                ? `${action === 'open-private-window' ? 'private window' : 'window'} opened for ${hostOf(url)}`
                : (result.error ?? 'could not open a window')
            )
          )
        return
      case 'edit-bookmark':
        if (url) setBookmarkEditor({ url, title: title || url })
        return
      case 'delete-bookmark':
        if (url) void removeBookmarkEntry(url)
        return
      case 'open-all-folder':
        openAllBookmarkUrls(urlsInNode(node), title || 'that folder')
        return
      case 'open-all':
      case 'toolbar-open-all':
        openAllBookmarkUrls(
          urlsInNode({ id: 'toolbar', kind: 'folder', addedAt: 0, children: barTree.toolbar }),
          'the bookmarks toolbar'
        )
        return
      case 'rename-folder':
        if (node) setFolderDialog({ folder: { id: node.id, title: node.title ?? 'Folder' }, location: container })
        return
      case 'delete-node':
      case 'delete-separator':
        if (node) applyAndSay(window.devlens.bookmarksRemoveNode(node.id), 'removed from the bar')
        return
      case 'cut':
      case 'copy':
      case 'paste':
        runClipboard(action, node?.id, container)
        return
      case 'add-bookmark':
        if (!canBookmark) {
          showStatus('open a page first')
          return
        }
        setBookmarkEditor({ url: activeStatus.url, title: activeStatus.title || activeStatus.url })
        return
      case 'add-folder':
        setFolderDialog({ folder: null, location: container })
        return
      case 'add-separator':
        applyAndSay(window.devlens.bookmarksCreateSeparator({ location: container }), 'separator added')
        return
      case 'toolbar-visible':
        applyAndSay(
          window.devlens.bookmarksSetOptions({ toolbarVisible: !bookmarkOptions.toolbarVisible }),
          bookmarkOptions.toolbarVisible ? 'the bookmarks toolbar is hidden when empty' : 'the bookmarks toolbar stays'
        )
        return
      case 'show-other':
        applyAndSay(
          window.devlens.bookmarksSetOptions({ showOtherBookmarks: !bookmarkOptions.showOtherBookmarks }),
          bookmarkOptions.showOtherBookmarks ? 'other bookmarks hidden' : 'other bookmarks shown'
        )
        return
      case 'import-bookmarks':
        /**
         * The file picker is main's, so the renderer only reports the outcome: how many arrived,
         * how many were already saved, and where the file came from. A cancelled dialog is not an
         * error and says nothing.
         */
        void window.devlens
          .bookmarksImport({ location: container })
          .then((result) => {
            if (result.snapshot) applyBookmarkSnapshot(result.snapshot)
            if (!result.ok) {
              if (result.file || result.error) showStatus(result.error ?? 'nothing was imported')
              return
            }
            const where = container === 'toolbar' ? 'the bookmarks toolbar' : folderNameOf(container) ?? 'that folder'
            const skipped = result.skipped > 0 ? `, ${result.skipped} already saved` : ''
            showStatus(`imported ${result.imported} bookmark${result.imported === 1 ? '' : 's'} into ${where}${skipped}`)
          })
          .catch(() => showStatus('could not import that file'))
        return
      case 'export-bookmarks':
        void window.devlens
          .bookmarksExport()
          .then((result) => {
            if (!result.ok) {
              if (result.error) showStatus(result.error)
              return
            }
            showStatus(`exported ${result.count} bookmark${result.count === 1 ? '' : 's'} to ${result.file}`)
          })
          .catch(() => showStatus('could not write that file'))
        return
      case 'manage-bookmarks':
        showStatus('the toolbar is the manager: drag to reorder, right-click to rename or delete')
        return
      default:
        return
    }
  }

  /** Drops everything the on-demand lease observed, on both sides of the bridge. */
  const forgetObservations = (): void => {
    clear()
    interceptor.clear()
    showStatus('observations dropped - staying in normal mode')
  }

  /* ---------------- tab strip context menu ---------------- */

  /**
   * These four are plain functions rather than `useCallback`s on purpose: they are declared
   * after the startup identity gate's early return, and React requires every render to run the
   * same hooks in the same order. A hook here would change the count the moment the gate closes.
   */

  /** Patches one tab's flags without disturbing the rest of the strip. */
  const patchTab = (id: string, patch: Partial<PageTab>): void => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)))
  }

  /** Closes a set of tabs in one pass: handles, icons, statuses and the fallback all follow. */
  const closeTabs = (ids: string[]): void => {
      const doomed = new Set(ids)
      if (doomed.size === 0) return

      const survivors = tabs.filter((tab) => !doomed.has(tab.id))
      closedTabs.current = [
        ...tabs
          .filter((tab) => doomed.has(tab.id) && tab.url)
          .map((tab) => ({ url: tab.url as string, title: tab.title, private: tab.private })),
        ...closedTabs.current
      ].slice(0, 20)

      for (const id of doomed) {
        // Batch closes ("close others", "close to the right", the container tab) release the
        // private sessions they close, not only the single-tab path.
        if (tabs.find((tab) => tab.id === id)?.private) void window.devlens.privateTabClose(id)
        delete frames.current[id]
        frameRefs.current.delete(id)
      }
      setStatuses((previous) => {
        const clone = { ...previous }
        for (const id of doomed) delete clone[id]
        return clone
      })
      setTabIcons((previous) => {
        const clone = { ...previous }
        for (const id of doomed) delete clone[id]
        return clone
      })
      setTabs(survivors)

      if (activeTabId && doomed.has(activeTabId)) {
        const next = survivors[survivors.length - 1] ?? survivors[0] ?? null
        setActiveTabId(next?.id ?? null)
        setAddress(next?.url ?? '')
      }
    }

  /** Reorders one tab inside the strip; pinned tabs keep their place at the front. */
  const moveTab = (id: string, where: 'left' | 'right' | 'first' | 'last'): void => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id)
      if (index < 0) return current
      const next = [...current]
      const [tab] = next.splice(index, 1)
      const pinnedCount = next.filter((entry) => entry.pinned).length
      if (tab.pinned) {
        if (where === 'left') next.splice(Math.max(0, index - 1), 0, tab)
        // After the removal `index` already points at the tab that was to its right, so moving
        // right means inserting one past it.
        else if (where === 'right') next.splice(Math.min(pinnedCount, index + 1), 0, tab)
        else if (where === 'first') next.unshift(tab)
        else next.splice(pinnedCount, 0, tab)
        return next
      }
      if (where === 'left') next.splice(Math.max(pinnedCount, index - 1), 0, tab)
      else if (where === 'right') next.splice(Math.min(next.length, index + 1), 0, tab)
      else if (where === 'first') next.splice(pinnedCount, 0, tab)
      else next.push(tab)
      return next
    })
  }

  /**
   * Everything the tab context menu can ask for.
   *
   * One switch keeps the wiring in one place: the menu names an action, this decides what the
   * browser does with it - which tab, which frame, which session.
   */
  const handleTabAction = (action: string, tabId: string): void => {
      const tab = tabs.find((entry) => entry.id === tabId)
      if (!tab) return
      const handles = frames.current[tabId]
      const url = tab.url ?? ''

      switch (action) {
        case 'new-right':
          openTab(null, '', { afterId: tabId })
          return
        case 'reload':
          handles?.mobile?.reload()
          handles?.desktop?.reload()
          if (tab.unloaded) patchTab(tabId, { unloaded: false })
          showStatus(`reloading ${tab.title || url}`)
          return
        case 'mute': {
          const muted = !tab.muted
          patchTab(tabId, { muted })
          handles?.mobile?.setAudioMuted(muted)
          handles?.desktop?.setAudioMuted(muted)
          showStatus(muted ? `muted ${tab.title || url}` : `unmuted ${tab.title || url}`)
          return
        }
        case 'pin':
          {
            const pinning = !tab.pinned
            const updated = tabs.map((entry) =>
              entry.id === tabId ? { ...entry, pinned: pinning } : entry
            )
            const nextTabs = pinning
              ? [
                  updated.find((entry) => entry.id === tabId)!,
                  ...updated.filter((entry) => entry.id !== tabId)
                ]
              : updated
            setTabs(nextTabs)
            saveSessionForTabs(nextTabs, activeTab?.url ?? '')
          }
          showStatus(tab.pinned ? 'tab unpinned' : 'tab pinned')
          return
        case 'unload':
          patchTab(tabId, { unloaded: !tab.unloaded })
          showStatus(
            tab.unloaded ? `loading ${tab.title || url}` : `unloaded ${tab.title || url} - memory released`
          )
          return
        case 'duplicate':
          // Duplicating a private tab gives another private tab: a copy that quietly dropped to
          // the profile's session would not be a copy of what the operator was looking at.
          if (tab.private) {
            void openPrivateTab(tab.url, tab.title)
            showStatus(url ? `duplicated ${tab.title || url}` : 'duplicated the private tab')
            return
          }
          openTab(tab.url, tab.title, { afterId: tabId })
          showStatus(url ? `duplicated ${tab.title || url}` : 'duplicated the new tab page')
          return
        case 'ask-ai':
          /**
           * The assistant is an everyday panel now - the same one the dock opens - so the tab
           * menu reaches it in both modes rather than being a developer-only door.
           */
          setActivePanel('ai')
          setSidebarOpen(true)
          showStatus(`opening the AI assistant for ${tab.title || url}`)
          return
        case 'bookmark':
          if (!url) return
          // Same editor as the star: the tab menu opens it for the tab that was right-clicked.
          setBookmarkEditor({ url, title: tab.title || url })
          return
        case 'move-left':
        case 'move-right':
        case 'move-first':
        case 'move-last':
          moveTab(tabId, action.replace('move-', '') as 'left' | 'right' | 'first' | 'last')
          return
        case 'copy-link':
          if (!url) return
          void window.devlens.clipboardWrite(url).then((ok) => showStatus(ok ? 'link copied' : 'could not copy'))
          return
        case 'container-standard':
          if (url) openTab(url, tab.title, { afterId: tabId })
          return
        case 'container-ghost':
          // Both container sessions are window-wide, and this tab already runs on its own
          // max-protection session: switching the window would leave the private tab exactly
          // where it is and confuse what the chip is promising.
          if (tab.private) {
            showStatus('this tab already runs in its own isolated session')
            return
          }
          if (url) void enterGhostSession(url)
          return
        case 'container-wimh':
          if (tab.private) {
            showStatus('this tab already runs at maximum protection')
            return
          }
          if (!url) return
          void toggleWimh(true).then(() => navigate(url, tab.title))
          return
        case 'close':
          closeTab(tabId)
          return
        case 'close-others':
          closeTabs(tabs.filter((entry) => entry.id !== tabId).map((entry) => entry.id))
          return
        case 'close-right': {
          const index = tabs.findIndex((entry) => entry.id === tabId)
          closeTabs(tabs.slice(index + 1).map((entry) => entry.id))
          return
        }
        case 'close-left': {
          const index = tabs.findIndex((entry) => entry.id === tabId)
          closeTabs(tabs.slice(0, index).map((entry) => entry.id))
          return
        }
        case 'close-duplicates': {
          const seen = new Set<string>()
          const duplicates: string[] = []
          for (const entry of tabs) {
            const key = entry.url ?? `empty:${entry.id}`
            if (seen.has(key)) duplicates.push(entry.id)
            else seen.add(key)
          }
          closeTabs(duplicates)
          showStatus(duplicates.length > 0 ? `closed ${duplicates.length} duplicate tab(s)` : 'no duplicates open')
          return
        }
        case 'reopen': {
          const [last, ...rest] = closedTabs.current
          if (!last) {
            showStatus('nothing to reopen')
            return
          }
          closedTabs.current = rest
          // A private tab comes back private: the flag is part of what was closed, and a
          // reopened page that had dropped to the profile's session would be a different page.
          if (last.private) void openPrivateTab(last.url, last.title)
          else openTab(last.url, last.title)
          showStatus(`reopened ${last.title || last.url}`)
          return
        }
        default:
          return
      }
    }

  /** The main menu on the toolbar. Every row does something real: the shell's own pages open
     as tabs, page operations reach the active guest, and the DevLens items toggle its own
     features - nothing in the list pretends. */
  const menu = {
    profileName: profiles.find((profile) => profile.active)?.name ?? 'Default',
    profileOpenSignal,
    onOpenProfileMenu: () => setProfileOpenSignal((value) => value + 1),
    onNewTab: () => openTab(null),
    onNewPrivateTab: () => void openPrivateTab(activeStatus.url || null),
    onHistory: () => openInternalTab('history'),
    onBookmarks: () => openInternalTab('bookmarks'),
    onPrint: () => {
      const id = activeFrame(activeView)?.guestId()
      if (id) void window.devlens.pageCommand({ webContentsId: id, command: 'print' })
    },
    onSavePage: async () => {
      const frame = activeFrame(activeView)
      if (!frame) {
        showStatus('No active page to save')
        return
      }
      try {
        const html = (await frame.evaluate('document.documentElement.outerHTML')) as string
        const safe = (activeStatus.title || 'page').replace(/[^a-z0-9]+/gi, '_')
        const result = await window.devlens.saveTextFile({
          filename: `${safe}.html`,
          content: html,
          title: 'Save Page As'
        })
        if (result.cancelled) showStatus('Save cancelled')
        else if (result.ok) showStatus(`Saved to ${result.path ?? 'unknown'}`)
        else showStatus(`Save failed: ${result.error ?? 'unknown'}`)
      } catch {
        showStatus('Could not save page')
      }
    },
    onFind: () => openFindBar(),
    onZoomIn: async () => {
      const id = activeFrame(activeView)?.guestId()
      if (!id) return 0
      await window.devlens.pageCommand({ webContentsId: id, command: 'zoom-in' })
      return window.devlens.pageZoom(id)
    },
    onZoomOut: async () => {
      const id = activeFrame(activeView)?.guestId()
      if (!id) return 0
      await window.devlens.pageCommand({ webContentsId: id, command: 'zoom-out' })
      return window.devlens.pageZoom(id)
    },
    onZoomReset: async () => {
      const id = activeFrame(activeView)?.guestId()
      if (!id) return 0
      await window.devlens.pageCommand({ webContentsId: id, command: 'zoom-reset' })
      return window.devlens.pageZoom(id)
    },
    onGetZoomPercent: async () => {
      const id = activeFrame(activeView)?.guestId()
      if (!id) return 100
      try {
        return await window.devlens.pageZoom(id)
      } catch {
        return 100
      }
    },
    onSettings: () => openInternalTab('settings'),
    onToggleDefense: () => void toggleWimh(!(wimh?.active)),
    defenseActive: Boolean(wimh?.active),
    onOpenDevTools: () => activeFrame(activeView)?.openGuestDevTools(),
    onExit: () => window.devlens.windowClose()
  }

  return (
    <div
      className="flex h-full flex-col bg-ink-950"
      data-mode={mode}
      data-workspace-theme={appearancePreferences.workspaceTheme}
      data-content-theme={resolvedContentTheme}
      data-density={effectiveDensity}
      data-density-preference={appearancePreferences.density}
      data-ui-font={appearancePreferences.uiFont}
      data-code-font={appearancePreferences.codeFont}
    >
      {/* Floating tab strip: the mode tokens are inherited from the root, so the accent
          changes with the mode without the strip knowing about modes at all. */}
      {tabsPreferences.layout === 'horizontal' && (
        <TabStrip
          tabs={tabs}
          activeId={activeTabId}
          mode={mode}
          onSelect={selectTab}
          onClose={closeTab}
          onNewTab={() => openTab(null)}
          onNewPrivateTab={() => void openPrivateTab()}
          onTabAction={handleTabAction}
          canReopen={closedTabs.current.length > 0}
          icons={Object.fromEntries(
            Object.entries(tabIcons).map(([id, entry]) => [id, entry.dataUrl])
          )}
          notifiedTabIds={notifiedTabIds}
        />
      )}
      <Toolbar
        address={address}
        onAddressChange={setAddress}
        onRun={runOmniboxAction}
        onAddressFocusChange={(focused) => {
          addressFocused.current = focused
          // Suggestions on an empty field should reflect what was visited, not what existed
          // when the window opened.
          if (focused) {
            void refreshHistory()
            void refreshBookmarks()
          }
        }}
        suggestions={suggestions}
        defaultEngine={defaultEngine}
        customs={{
          entries: allOmniboxEntries,
          engines: omniboxSettings.engines,
          shortcuts: omniboxSettings.shortcuts,
          favicons: customFavicons
        }}
        omniboxHint={omniboxHint}
        sessionChip={
          <>
            {privatePill}
            {sessionChip}
          </>
        }
        bookmarked={bookmarked}
        canBookmark={canBookmark}
        onToggleBookmark={openBookmarkEditor}
        bookmarkEditor={
          bookmarkEditor ? (
            <AddBookmarkModal
              page={bookmarkEditor}
              locations={folderChoices}
              existing={
                bookmarks.find(
                  (entry) => entry.url.replace(/#.*$/, '') === bookmarkEditor.url.replace(/#.*$/, '')
                ) ?? null
              }
              lastLocation={bookmarkLocation}
              onSave={(values, options) => {
                setShowBookmarkEditor(options.showEditor)
                setBookmarkEditor(null)
                void saveBookmarkEntry(values)
              }}
              onRemove={(url) => {
                setBookmarkEditor(null)
                void removeBookmarkEntry(url)
              }}
              onCancel={() => setBookmarkEditor(null)}
            />
          ) : null
        }
        bookmarkFolderEditor={
          folderDialog ? (
            <AddFolderModal
              folder={folderDialog.folder}
              location={folderDialog.location}
              choices={folderChoices}
              onSave={saveFolderDialog}
              onCancel={() => setFolderDialog(null)}
            />
          ) : null
        }
        defenseOpen={defenseOpen}
        onToggleDefense={() => setDefenseOpen((open) => !open)}
        protection={effectiveProtection}
        protectionBusy={protectionBusy}
        onProtectionChange={(level) => void selectProtectionLevel(level)}
        protectionLocked={
          activeIsPrivate
            ? {
                reason: `${PRIVATE_TAB_LABEL}: this tab enforces Level 3 on its own session. ${PRIVATE_TAB_SUMMARY}`
              }
            : null
        }
        site={{
          url: activeStatus.url,
          secure: activeStatus.url.startsWith('https://'),
          iconUrl: activeSiteIcon
        }}
        internalUrl={activeInternal ? startUrl : null}
        onToggleSiteProtection={(allowed) => void toggleSiteProtection(allowed)}
        onClearSiteData={() => void clearCurrentSiteData()}
        pasteGuard={{
          enabled: Boolean(wimh?.active && wimh.clipboard.enabled),
          check: (text) => window.devlens.wimhCheckClipboard(text),
          onBlocked: (reason) => {
            void window.devlens.wimhNotePasteBlocked(reason).then(setWimh)
            showStatus(`paste refused: clipboard holds a ${reason}`)
          }
        }}
        onBack={() => activeFrame(activeView)?.goBack()}
        onForward={() => activeFrame(activeView)?.goForward()}
        onReload={reloadBoth}
        canGoBack={activeStatus.canGoBack}
        canGoForward={activeStatus.canGoForward}
        activeView={activeView}
        viewportAvailable={!internalSurface}
        syncEnabled={syncEnabled}
        onToggleSync={() => setSyncEnabled((value) => !value)}
        onOpenInIde={() => void openEntryFile(bootstrap, showStatus)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleDeveloperArea}
        ideLabel={bootstrap.ide.entryFile}
        ideScheme={bootstrap.ide.scheme}
        ideEditorLabel={ideEditorLabel}
        ideEnabled={ideEnabled}
        mode={mode}
        modeBusy={modeBusy}
        layout={toolbarLayout}
        onModeChange={(next) => void changeMode(next)}
        profiles={profiles}
        profilesBusy={profilesBusy}
        onProfileSwitch={(id) => void switchProfile(id)}
        onProfileCreate={(name) => void createProfile(name)}
        onProfileDelete={(id) => void deleteProfile(id)}
        onNotice={showStatus}
        menu={menu}
      />

      {/* The bookmarks toolbar, right under the address bar. It renders nothing at all until
          something has been filed there. */}
      <BookmarksBar
        tree={barTree}
        options={bookmarkOptions}
        icons={barIcons}
        page={canBookmark ? { url: activeStatus.url, title: activeStatus.title } : null}
        onOpen={(url, options) => {
          setAddress(url)
          if (options?.newTab || browserPreferences.openBookmarksInNewTab) openInNewTab(url)
          else navigate(url)
        }}
        onMove={(input) => applyAndSay(window.devlens.bookmarksMoveNode(input), 'bookmarks reordered')}
        onAction={runBookmarkAction}
        hasClipboard={bookmarkClipboard}
      />

      <div className="flex min-h-0 flex-1">
        {tabsPreferences.layout === 'vertical' && (
          <VerticalTabs
            tabs={tabs}
            activeId={activeTabId}
            icons={Object.fromEntries(
              Object.entries(tabIcons).map(([id, entry]) => [id, entry.dataUrl])
            )}
            notifiedTabIds={notifiedTabIds}
            canReopen={closedTabs.current.length > 0}
            onSelect={selectTab}
            onClose={closeTab}
            onNewTab={() => openTab(null)}
            onTabAction={handleTabAction}
          />
        )}
        {/* The dock, on the left: the everyday four in normal mode, the whole toolset in dev.
            It is always mounted - it is browser chrome, not a developer surface - and the panel
            column beside it only exists while a tool is selected. */}
        <Sidebar
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          mode={mode}
          panel={activePanel}
          onPanelChange={setActivePanel}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          activeView={activeView}
          activeUrl={activeStatus.url}
          activeTitle={activeStatus.title}
          profileId={profileId}
          profileName={profiles.find((profile) => profile.active)?.name ?? 'Default'}
          logs={{
            entries,
            counts,
            onClear: clear,
            onOpenSource: (sourceUrl, line) => void openSource(sourceUrl, line, showStatus),
            failedRequests: networkEntries
          }}
          design={{
            css: cssDraft,
            onCssChange: setCssDraft,
            designMode,
            onDesignModeChange: toggleDesignMode,
            target: designTarget,
            onTargetChange: setDesignTarget,
            onApply: applyCss,
            onClear: clearDesign,
            status: designStatus,
            appliedAt: cssAppliedAt,
            dirty: cssDraft !== cssApplied
          }}
          interceptor={{ store: interceptor, onNotice: showStatus }}
          recon={{
            snapshot: reconSnapshot,
            outputDir: bootstrap.reportOutputDir,
            onNotice: showStatus
          }}
          defense={{
            state: wimh,
            busy: wimhBusy,
            onToggle: (enabled) => void toggleWimh(enabled),
            onScrub: () => void scrubNow(),
            onClipboardTtl: (ms) => void setClipboardTtl(ms),
            onExitSession: () => void toggleWimh(false),
            onNotice: showStatus
          }}
          ai={{
            chips: aiChips,
            provider: preferences.aiProvider,
            onProviderChange: (provider: AiSiteId) => {
              // The profile owns the choice, so it is written where a restart can find it.
              void window.devlens
                .preferencesSet({ aiProvider: provider })
                .then(setPreferences)
                .catch(() => showStatus('could not save that preference'))
            }
          }}
          everyday={{
            onNotice: showStatus,
            history,
            onOpenHistory: (url, options) => {
              setAddress(url)
              if (options?.newTab) openInNewTab(url)
              else navigate(url)
            },
            onClearHistory: () => {
              void window.devlens.historyClear().then(() => {
                setHistory([])
                showStatus('browsing history cleared for this profile')
              })
            },
            tree: barTree,
            bookmarkOptions,
            onOpenAllBookmarks: openAllBookmarkUrls,
            onRemoveBookmarkNode: (id) =>
              applyAndSay(window.devlens.bookmarksRemoveNode(id), 'bookmark removed'),
            onBookmarkOptions: (patch) =>
              applyAndSay(window.devlens.bookmarksSetOptions(patch), 'bookmark settings saved'),
            protection,
            onProtection: (level) => void selectProtectionLevel(level),
            profileAsk,
            onProfileAsk: (ask) => void setAskOnStartup(ask),
            layout: toolbarLayout,
            onLayout: (patch) => void saveToolbarLayout(patch),
            onOpenOmniboxSettings: () => openSettingsCategory('search')
          }}
          tools={{
            servers,
            scanning,
            workspace: workspaces.find((entry) => entry.active) ?? null,
            onScan: () => void scanServers(),
            onOpenUrl: (url, options) => {
              setAddress(url)
              if (options?.newTab) openInNewTab(url)
              else navigate(url)
            },
            onOpenWorkspaceInIde: () =>
              void openWorkspaceInIde(
                workspaces.find((entry) => entry.active)?.path ?? bootstrap.workspaceRoot
              ),
            deviceId: device.id,
            onDeviceIndex: (id) => void saveMobileSettings({ deviceId: id }),
            onActiveView: setActiveView,
            viewportAvailable: !internalSurface,
            desktopWidth,
            onDesktopWidth: setDesktopWidth,
            syncEnabled,
            onSyncChange: setSyncEnabled,
            cookies,
            storage: storageAreas,
            storageBusy,
            storageError,
            onRefreshStorage: () => void refreshStorage(),
            onRemoveCookie: (name) => void removeCookie(name),
            onRemoveStorageEntry: (area, key) => void removeStorageEntry(area, key),
            onClearSiteStorage: () => void clearSiteStorage()
          }}
        />

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {findOpen && (
            <FindBar
              query={findQuery}
              enabled={Boolean(findTargetId && activeTab?.url && !internalSurface)}
              focusSignal={findFocusSignal}
              result={findResult?.webContentsId === findTargetId ? findResult : null}
              onQueryChange={changeFindQuery}
              onNext={findNextMatch}
              onClose={closeFindBar}
            />
          )}
          <div
            ref={canvasRef}
            data-testid="viewport-canvas"
            data-surface={internalSurface ? 'internal' : 'web'}
            className={[
              'viewport-canvas relative min-h-0 flex-1',
              activeInternal === 'settings' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
              capabilities.dualViewport && !internalSurface ? 'p-4' : 'p-0'
            ].join(' ')}
          >
            {/* The emulator's controls, on a row of their own.
                They were in the mobile frame's header, which is as wide as the phone being emulated
                (240px for a Flip's cover screen) - a picker, a fold toggle and a metrics chip do not
                fit in that, and a control that is clipped is a control that cannot be clicked. The
                canvas is the one place that is always as wide as the window. */}
            {capabilities.dualViewport && !internalSurface && (
              <div
                data-testid="canvas-toolbar"
                className="mb-3 flex flex-wrap items-center gap-2"
              >
                <span className="font-mono text-[10px] tracking-wide text-ink-500 uppercase">
                  Device
                </span>
                <DeviceSelector
                  settings={mobileSettings}
                  onChange={(patch) => void saveMobileSettings(patch)}
                  active={device}
                />
                <FoldToggle
                  settings={mobileSettings}
                  onChange={(patch) => void saveMobileSettings(patch)}
                  active={device}
                />
              </div>
            )}
            {/* Nothing is mounted until there is a page: a fresh start shows the dashboard and
                no webview at all, so there is no placeholder URL to load or fail. */}
            {tabs
              /* Unloaded tabs keep their address but hold no viewports: that is the memory saver
                 the context menu's "Unload Tab" switches on. */
              /* Neither do the shell's own pages: `devlens:settings/search` is drawn by the
                 content area below, so mounting a viewport for it would be a request to a host
                 that does not exist. */
              .filter((tab) => tab.url && !tab.unloaded && !internalRouteOf(tab.url))
              .map((tab) => (
            <div
              key={tab.id}
              data-tab={tab.id}
              data-active={tab.id === activeTabId ? 'true' : 'false'}
              /* Every tab keeps its own frames alive; the inactive ones are hidden rather than
                 unmounted, which is what preserves their DOM and scroll position. */
              className={[
                tab.id === activeTabId && !dashboardVisible ? 'flex' : 'hidden',
                'h-full min-w-full items-stretch',
                capabilities.dualViewport ? 'gap-4' : 'gap-0'
              ].join(' ')}
            >
              {/* Dual viewport is the signature of dev mode; normal mode is one clean pane. */}
              {capabilities.dualViewport && (
              <ViewportFrame
                key={`${tab.id}-mobile-${partitionForTab(tab)}`}
                ref={frameRefFor(tab.id, 'mobile')}
                viewId="mobile"
                title="Mobile"
                initialUrl={tab.url ?? ''}
                guestPreloadUrl={bootstrap.guestPreloadUrl}
                partition={partitionForTab(tab)}
                width={deviceSize.width}
                height={deviceSize.height}
                fitScale={deviceScale}
                dpr={viewport.dpr}
                hinge={Boolean(viewport.state.hinge)}
                foldState={viewport.state.id}
                status={(statuses[tab.id] ?? EMPTY_TAB_STATUSES).mobile}
                active={activeView === 'mobile'}
                onActivate={setActiveView}
                onScroll={(viewId, message) => handleScroll(tab.id, viewId, message)}
                onStatusPatch={(viewId, patch) => patchTabStatus(tab.id, viewId, patch)}
                onGuestAttached={handleGuestAttached}
                onMeasured={handleMeasured}
                onFindResult={handleFindResult}
                onPageFindResult={handlePageFindResult}
                onZoomWheel={zoomFromGuestWheel}
                onContextMenu={(payload) => handleGuestContextMenu(tab.id, 'mobile', payload)}
                overrideCss={cssApplied}
                overrideDesignMode={designMode}
                devCapabilities={mode === 'dev'}
                inspectionLease={inspection.source === 'lease'}
              />
              )}

              <ViewportFrame
                key={`${tab.id}-desktop-${partitionForTab(tab)}`}
                ref={frameRefFor(tab.id, 'desktop')}
                viewId="desktop"
                title="Desktop"
                initialUrl={tab.url ?? ''}
                guestPreloadUrl={bootstrap.guestPreloadUrl}
                partition={partitionForTab(tab)}
                width={desktopWidth}
                height={null}
                status={(statuses[tab.id] ?? EMPTY_TAB_STATUSES).desktop}
                active={activeView === 'desktop'}
                onActivate={setActiveView}
                onScroll={(viewId, message) => handleScroll(tab.id, viewId, message)}
                onStatusPatch={(viewId, patch) => patchTabStatus(tab.id, viewId, patch)}
                onGuestAttached={handleGuestAttached}
                onMeasured={handleMeasured}
                onFindResult={handleFindResult}
                onPageFindResult={handlePageFindResult}
                onZoomWheel={zoomFromGuestWheel}
                onContextMenu={(payload) => handleGuestContextMenu(tab.id, 'desktop', payload)}
                overrideCss={cssApplied}
                overrideDesignMode={designMode}
                chrome={capabilities.dualViewport}
                devCapabilities={mode === 'dev'}
                inspectionLease={inspection.source === 'lease'}
                headerExtras={
                  <select
                    value={desktopWidth ?? 'fill'}
                    onChange={(event) =>
                      setDesktopWidth(event.target.value === 'fill' ? null : Number(event.target.value))
                    }
                    aria-label="Desktop width"
                    className="h-6 rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none hover:border-white/20"
                  >
                    <option value="fill">Fill</option>
                    {DESKTOP_WIDTHS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>
              ))}

            {/* The dashboard is the *page* of an empty tab, so it lives in the content area:
                the tab strip, toolbar and status bar stay interactive while it is showing. */}
            {dashboardVisible && (
              <NewTabDashboard
                launchpad={launchpadPreferences}
                services={{
                  servers,
                  scanning,
                  workspaces,
                  wimh,
                  ghostActive: ghost.active,
                  mode,
                  recent: history.slice(0, 6).map((entry) => ({ url: entry.url, title: entry.title })),
                  bookmarks,
                  profileId,
                  stats: {
                    requests: interceptor.requests.length,
                    failures: counts.errors,
                    consoleErrors: entries.filter(
                      (entry) => entry.kind === 'console' && entry.level === 'error'
                    ).length,
                    tracked: ghost.blockedRequests
                  }
                }}
                /* The hero field is the toolbar's omnibox: same value, same runner, same
                   suggestions. One message drawn twice beats two drafts that can disagree. */
                omnibox={{
                  value: address,
                  onChange: setAddress,
                  onRun: runOmniboxAction,
                  onFocusChange: (focused) => {
                    addressFocused.current = focused
                    if (focused) {
                      void refreshHistory()
                      void refreshBookmarks()
                    }
                  },
                  suggestions,
                  defaultEngine,
                  engines: omniboxSettings.engines,
                  shortcuts: omniboxSettings.shortcuts,
                  favicons: customFavicons,
                  internalUrl: activeInternal ? startUrl : null,
                  pasteGuard: {
                    enabled: Boolean(wimh?.active && wimh.clipboard.enabled),
                    check: (text) => window.devlens.wimhCheckClipboard(text),
                    onBlocked: (reason) => {
                      void window.devlens.wimhNotePasteBlocked(reason).then(setWimh)
                      showStatus(`paste refused: clipboard holds a ${reason}`)
                    }
                  }
                }}
                onOpenUrl={(url, options) => {
                  if (options?.newTab) openInNewTab(url)
                  else navigate(url)
                }}
                onScanServers={() => void scanServers()}
                onAddWorkspace={() => {
                  void window.devlens.workspacesPick().then((next) => {
                    setWorkspaces(next)
                    showStatus('workspace folder added')
                  })
                }}
                onAddWorkspacePath={(path) => void addWorkspacePath(path)}
                onRemoveWorkspace={(path) => void removeWorkspace(path)}
                onActivateWorkspace={(path) => void activateWorkspace(path)}
                onOpenInIde={(path) => void openWorkspaceInIde(path)}
                onInsertPrefix={insertPrefix}
                onToggleWimh={() => void toggleWimh(!wimh?.active)}
              />
            )}
            {activeInternal === 'blank' && (
              <div
                data-testid="blank-canvas"
                className="nova-ntp absolute inset-0 z-40"
                aria-label="Blank canvas"
              />
            )}
            {activeInternal === 'appearance-themes' && (
              <ThemeManagerPage
                appearance={appearancePreferences}
                onTheme={(workspaceTheme) => saveAppearancePreferences({ workspaceTheme })}
                onBack={() => openSettingsCategory('appearance')}
              />
            )}
            {activeInternal === 'changelog' && (
              <ChangelogPage
                version={aboutInfo?.version}
                onBack={() => openSettingsCategory('about')}
                onOpenReleaseHistory={openAboutRoute}
              />
            )}

            {/* The shell's own pages, drawn by the content area for the same reason the dashboard
                is: the tab strip, the toolbar and the status bar stay live around them. */}
            {activeInternal === 'history' && (
              <HistoryPage
                entries={history}
                onOpen={(url, options) => {
                  if (options?.newTab) openInNewTab(url)
                  else navigate(url)
                }}
                onClear={() => {
                  void window.devlens.historyClear().then(() => {
                    setHistory([])
                    showStatus('browsing history cleared')
                  })
                }}
              />
            )}
            {activeInternal === 'bookmarks' && (
              <BookmarksPage
                bookmarks={bookmarks}
                onOpen={(url, options) => {
                  if (options?.newTab || browserPreferences.openBookmarksInNewTab) openInNewTab(url)
                  else navigate(url)
                }}
                onRemove={(url) => void removeBookmarkEntry(url)}
              />
            )}
            {activeInternal === 'settings' && (
              <SettingsPage
                category={activeSettingsCategory}
                onCategoryChange={openSettingsCategory}
                aiProvider={preferences.aiProvider}
                onProviderChange={(provider) => {
                  // The profile owns the choice, so it is written where a restart can find it.
                  void window.devlens
                    .preferencesSet({ aiProvider: provider })
                    .then(setPreferences)
                    .catch(() => showStatus('could not save that preference'))
                }}
                omnibox={omniboxSettings}
                onOmnibox={saveOmniboxSettings}
                omniboxFavicons={customFavicons}
                browser={browserPreferences}
                onBrowser={saveBrowserPreferences}
                launchpad={launchpadPreferences}
                onLaunchpad={saveLaunchpadPreferences}
                systemIntegration={systemIntegration}
                systemIntegrationBusy={systemIntegrationBusy}
                onSetDefaultBrowser={setDefaultBrowser}
                onLaunchAtLogin={setLaunchAtLogin}
                onChooseWallpaper={chooseLaunchpadWallpaper}
                toolbarLayout={toolbarLayout}
                onLayout={(patch) => void saveToolbarLayout(patch)}
                bookmarkOptions={bookmarkOptions}
                onBookmarkOptions={(patch) =>
                  applyAndSay(window.devlens.bookmarksSetOptions(patch), 'bookmark settings saved')
                }
                protection={protection}
                privacy={privacyPreferences}
                diskUsage={diskUsage}
                onShieldMode={setShieldMode}
                onShieldRules={updateShieldRules}
                onNetworkSecurity={updateNetworkSecurity}
                onHistoryPolicy={updateHistoryPolicy}
                onClearBrowsingDataSelected={clearBrowsingDataSelected}
                onRunRetentionCleanup={runRetentionCleanup}
                onRefreshDiskUsage={refreshDiskUsage}
                onSiteException={setSiteException}
                onPrivacy={savePrivacyPreferences}
                appearance={appearancePreferences}
                onAppearance={saveAppearancePreferences}
                onOpenThemes={() => openInternalTab('appearance-themes')}
                tabsPreferences={tabsPreferences}
                onTabs={saveTabsPreferences}
                languages={languagePreferences}
                onLanguages={saveLanguagePreferences}
                profileAsk={profileAsk}
                onProfileAsk={(ask) => void setAskOnStartup(ask)}
                profileName={profiles.find((profile) => profile.active)?.name ?? 'Default'}
                profiles={profiles}
                profilesBusy={profilesBusy}
                onProfileSwitch={(id) => void switchProfile(id)}
                onProfileCreate={(name, avatar) => void createProfile(name, avatar)}
                onProfileDelete={(id) => void deleteProfile(id)}
                developer={developerPreferences}
                ideOptions={ideOptions}
                onDeveloperChange={saveDeveloperPreferences}
                aboutInfo={aboutInfo}
                aboutPreferences={aboutPreferences}
                downloads={downloadPreferences}
                onDownloads={saveDownloadPreferences}
                onAboutChange={saveAboutPreferences}
                onOpenAboutRoute={openAboutRoute}
              />
            )}

            {/* The page's context menu: built from an inspection that is already finished, so no
                row in it can be a promise the shell cannot keep. */}
            {pageMenu && (
              <PageContextMenu
                payload={pageMenu}
                context={{
                  clipboard: pageMenu.clipboard,
                  canGoBack: Boolean(activeStatuses[pageMenu.viewId].canGoBack),
                  canGoForward: Boolean(activeStatuses[pageMenu.viewId].canGoForward),
                  dev: mode === 'dev',
                  pageUrl: activeStatuses[pageMenu.viewId].url || startUrl || ''
                }}
                onCommand={runPageCommand}
                onOpenUrl={(url) => {
                  openInNewTab(url)
                  setPageMenu(null)
                }}
                onCopyText={(text) => {
                  void window.devlens.clipboardWrite(text)
                }}
                onClose={() => setPageMenu(null)}
              />
            )}
          </div>

          <StatusBar
            activeView={activeView}
            activeStatus={activeStatus}
            syncEnabled={syncEnabled}
            errorCount={counts.errors}
            entryFile={bootstrap.ide.entryFile}
            statusMessage={statusMessage}
            designMode={designMode}
            interceptedCount={interceptor.requests.length}
            heldCount={interceptor.paused.length}
            sessionProfile={wimh?.active ? 'wimh' : ghost.active ? 'ghost' : 'standard'}
            blockedTrackers={wimh?.active ? wimh.ramOnly.historyBlocked : ghost.blockedRequests}
            workspaceName={activeWorkspaceName}
            mode={mode}
            profileName={profiles.find((profile) => profile.active)?.name ?? 'Default'}
            onOpenGuestDevTools={() => activeFrame(activeView)?.openGuestDevTools()}
          />
        </main>

      </div>

      {/* Normal mode keeps exactly one developer-family surface, and it is on demand. */}
      {defenseOpen && (
        <DefenseOverlay
          mode={mode}
          defense={{
            state: wimh,
            busy: wimhBusy,
            onToggle: (enabled) => void toggleWimh(enabled),
            onScrub: () => void scrubNow(),
            onClipboardTtl: (ms) => void setClipboardTtl(ms),
            onExitSession: () => void toggleWimh(false)
          }}
          inspection={inspection}
          observed={interceptor.requests}
          pageTools={{
            enabled: inspection.capturing,
            designMode,
            onFind: (selector) => runFind(selector),
            onToggleDesignMode: (enabled) => toggleDesignMode(enabled)
          }}
          onClose={() => setDefenseOpen(false)}
          onStash={forgetObservations}
          onNotice={showStatus}
        />
      )}

    </div>
  )
}

/** Toolbar action: open the configured entry file through the editor URI scheme. */
async function openEntryFile(
  bootstrap: BootstrapPayload,
  showStatus: (message: string) => void
): Promise<void> {
  const result = await window.devlens.openInIde({
    filePath: bootstrap.ide.entryFile,
    line: bootstrap.ide.entryLine
  })
  showStatus(result.ok ? `${bootstrap.ide.scheme} -> ${result.resolvedPath}` : result.error ?? 'failed')
}

/** Click-to-source: map a log entry's source URL back to a file on disk. */
async function openSource(
  sourceUrl: string,
  line: number,
  showStatus: (message: string) => void
): Promise<void> {
  const result = await window.devlens.openInIde({ sourceUrl, line })
  showStatus(result.ok ? `${result.resolvedPath ?? ''}:${line}` : result.error ?? 'source not mapped')
}

/** HTTPS-only upgrades ordinary web navigations while leaving localhost development alone. */
function enforceHttpsOnly(url: string, enabled: boolean): string {
  if (!enabled || !/^http:\/\//i.test(url)) return url
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    ) {
      return url
    }
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return url
  }
}
